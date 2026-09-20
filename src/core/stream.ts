import { createParser } from 'eventsource-parser';
import type { Protocol } from './presets';

export interface StreamProgress { kind: 'text' | 'thinking' | 'tool' | 'model'; text: string; characters?: number }

// Reassemble provider protocol objects as well as visible deltas. Signatures never become UI text.
export class CompletionStream {
  private done = false;
  private model?: string;
  private finish: string | null = null;
  private text = '';
  private thinking = '';
  private calls = new Map<number, any>();
  private blocks = new Map<number, any>();
  private inputs = new Map<number, string>();
  private openBlocks = new Set<number>();
  private usage: any = {};
  private parser;
  constructor(private protocol: Protocol = 'chat-completions', private progress: (p: StreamProgress) => void = () => {}) {
    this.parser = createParser({ onEvent: e => this.event(e.data), onError: () => { throw new Error('模型流式数据格式无效。'); } });
  }
  feed(chunk: string) { this.parser.feed(chunk); }
  private event(raw: string) {
    if (raw === '[DONE]' && this.protocol !== 'anthropic') { this.done = true; return; }
    if (this.done) return;
    let data: any;
    try { data = JSON.parse(raw); } catch { throw new Error('模型流式数据不是有效 JSON。'); }
    if (data.error || data.type === 'error') throw new Error('模型服务在生成过程中返回错误；已收到的内容已保留，可稍后重试。');
    const model = data.model ?? data.message?.model;
    if (typeof model === 'string' && model.length <= 200 && model !== this.model) { this.model = model; this.progress({ kind: 'model', text: model }); }
    if (this.protocol === 'anthropic') this.anthropic(data); else this.chat(data);
  }
  private delta(kind: 'text' | 'thinking', value: unknown) {
    if (typeof value !== 'string' || !value) return;
    if (kind === 'text') this.text += value; else this.thinking += value;
    this.progress({ kind, text: value });
  }
  private chat(data: any) {
    if (data.usage) this.usage = data.usage;
    const choice = data.choices?.find((c: any) => c.index === 0 || c.index === undefined);
    if (!choice) return;
    if (choice.finish_reason) this.finish = choice.finish_reason;
    const delta = choice.delta ?? {};
    this.delta('text', delta.content ?? delta.refusal);
    this.delta('thinking', delta.reasoning_content);
    for (const part of delta.tool_calls ?? []) {
      const index = part.index;
      if (!Number.isInteger(index) || index < 0 || index >= 8) throw new Error('模型工具调用过多或编号无效。');
      const call = this.calls.get(index) ?? { id: '', type: 'function', function: { name: '', arguments: '' } };
      if (part.id) call.id = part.id;
      if (part.type) call.type = part.type;
      if (part.function?.name) call.function.name += part.function.name;
      if (typeof part.function?.arguments === 'string') call.function.arguments += part.function.arguments;
      if (part.extra_content) call.extra_content = { ...call.extra_content, ...part.extra_content };
      this.calls.set(index, call);
      this.progress({ kind: 'tool', text: call.function.name, characters: call.function.arguments.length });
    }
  }
  private anthropic(data: any) {
    if (data.type === 'message_start') { this.usage = data.message?.usage ?? {}; return; }
    if (data.type === 'message_delta') { this.finish = data.delta?.stop_reason ?? this.finish; this.usage = { ...this.usage, ...data.usage }; return; }
    if (data.type === 'message_stop') { this.done = true; return; }
    if (!['content_block_start', 'content_block_delta', 'content_block_stop'].includes(data.type)) return;
    const index = data.index;
    if (!Number.isInteger(index) || index < 0 || index >= 64) throw new Error('模型返回的内容块编号无效。');
    if (data.type === 'content_block_start') {
      const block = { ...data.content_block };
      if (this.blocks.has(index)) throw new Error('模型返回了重复内容块。');
      this.blocks.set(index, block);
      this.openBlocks.add(index);
      if (block.type === 'text') this.delta('text', block.text);
      if (block.type === 'thinking') this.delta('thinking', block.thinking);
      if (block.type === 'tool_use') this.progress({ kind: 'tool', text: block.name, characters: 0 });
      return;
    }
    const block = this.blocks.get(index);
    if (!block) throw new Error('模型流式内容块顺序无效。');
    const delta = data.delta ?? {};
    if (delta.type === 'text_delta') { block.text = (block.text ?? '') + delta.text; this.delta('text', delta.text); }
    if (delta.type === 'thinking_delta') { block.thinking = (block.thinking ?? '') + delta.thinking; this.delta('thinking', delta.thinking); }
    if (delta.type === 'signature_delta') block.signature = (block.signature ?? '') + delta.signature;
    if (delta.type === 'input_json_delta') {
      const input = (this.inputs.get(index) ?? '') + delta.partial_json;
      this.inputs.set(index, input); this.progress({ kind: 'tool', text: block.name, characters: input.length });
    }
    if (data.type === 'content_block_stop' && this.inputs.has(index)) {
      try { block.input = JSON.parse(this.inputs.get(index)!); } catch { throw new Error('模型流式工具参数不完整。'); }
    }
    if (data.type === 'content_block_stop') this.openBlocks.delete(index);
  }
  result() {
    if (!this.done || !this.finish || this.openBlocks.size) throw new Error('模型数据流提前结束；已收到的内容已保留，未应用代码。');
    if (this.protocol === 'anthropic') return { model: this.model, content: [...this.blocks].sort(([a], [b]) => a - b).map(([, v]) => v), stop_reason: this.finish, usage: this.usage };
    return { model: this.model, choices: [{ finish_reason: this.finish, message: { role: 'assistant', content: this.text || null, reasoning_content: this.thinking, tool_calls: [...this.calls].sort(([a], [b]) => a - b).map(([, v]) => v) } }], usage: this.usage };
  }
}

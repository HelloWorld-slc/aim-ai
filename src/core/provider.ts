import { Protocol, requestOptions, ThinkingEffort } from './presets';
import { CompletionStream, StreamProgress } from './stream';
export interface Message { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string; reasoning_content?: string; providerContent?: unknown[] }
export interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string }; extra_content?: Record<string, unknown> }
export interface Tool { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }
export interface ProviderConfig { baseUrl: string; model: string; apiKey: string; maxTokens: number; protocol?: Protocol; presetId?: string; thinkingEffort?: ThinkingEffort; stream?: boolean }

export function endpoint(baseUrl: string, protocol: Protocol = 'chat-completions'): URL {
  let url: URL;
  try { url = new URL(baseUrl.trim()); } catch { throw new Error('API 地址格式错误，请填写完整的 https:// 地址。'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('远程 API 必须使用 HTTPS；HTTP 仅允许本机模型服务。');
  if (url.username || url.password || url.search || url.hash) throw new Error('API 地址不能含账号、密码、查询参数或片段。');
  let pathname = url.pathname.replace(/\/+$/, '');
  const suffix = protocol === 'anthropic' ? '/messages' : '/chat/completions';
  if (protocol === 'anthropic' && !pathname) pathname = '/v1';
  if (!pathname.endsWith(suffix)) pathname += suffix;
  url.pathname = pathname;
  return url;
}

export function redact(message: string, secret: string): string {
  return secret ? message.split(secret).join('[REDACTED]') : message;
}

export function requestBody(config: ProviderConfig, messages: Message[], tools: Tool[]): Record<string, unknown> {
  const options = requestOptions(config.presetId, config.model, config.thinkingEffort, config.protocol, config.maxTokens);
  if (config.protocol !== 'anthropic') return { ...options, model: config.model, messages: messages.map(({ providerContent, ...m }) => m), stream: false, [config.presetId === 'openai' ? 'max_completion_tokens' : 'max_tokens']: config.maxTokens, ...(tools.length ? { tools, tool_choice: 'auto' } : {}) };
  const converted: { role: string; content: unknown[] }[] = [];
  for (const m of messages.filter(m => m.role !== 'system')) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const content = m.role === 'tool' ? [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content ?? '' }] : m.providerContent ?? [
      ...(m.content ? [{ type: 'text', text: m.content }] : []),
      ...(m.tool_calls ?? []).map(t => ({ type: 'tool_use', id: t.id, name: t.function.name, input: JSON.parse(t.function.arguments) }))
    ];
    if (!content.length) continue;
    if (converted.at(-1)?.role === role) converted.at(-1)!.content.push(...content);
    else converted.push({ role, content });
  }
  return { ...options, model: config.model, system: messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n'), messages: converted, max_tokens: config.maxTokens, stream: false, ...(tools.length ? { tools: tools.map(t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters })), tool_choice: { type: 'auto' } } : {}) };
}

function parseMessage(data: any, protocol?: Protocol): { message: Message; tokens?: number } {
  if (protocol === 'anthropic') {
    if (data.stop_reason === 'max_tokens') throw new Error('模型回答被长度限制截断；请缩小任务或提高输出上限后重试。');
    if (data.stop_reason === 'pause_turn') throw new Error('服务商暂停了本次生成，回答尚未完成；已收到内容会保留。');
    if (!Array.isArray(data.content)) throw new Error('返回格式不兼容 Anthropic Messages。');
    const calls: ToolCall[] = [];
    const texts: string[] = [];
    for (const part of data.content) {
      if (part.type === 'text' && typeof part.text === 'string') texts.push(part.text);
      else if (part.type === 'tool_use') {
        if (typeof part.id !== 'string' || typeof part.name !== 'string' || !part.input || typeof part.input !== 'object' || Array.isArray(part.input)) throw new Error('模型工具调用格式无效。');
        calls.push({ id: part.id, type: 'function', function: { name: part.name, arguments: JSON.stringify(part.input) } });
      } else if (part.type !== 'thinking' && part.type !== 'redacted_thinking') throw new Error('Claude 返回了当前插件不支持的内容类型。');
    }
    if (calls.length > 8 || (!texts.length && !calls.length)) throw new Error('模型返回内容为空或工具调用过多。');
    return { message: { role: 'assistant', content: texts.join('\n') || null, ...(calls.length ? { tool_calls: calls } : {}), providerContent: data.content }, tokens: typeof data.usage?.input_tokens === 'number' && typeof data.usage?.output_tokens === 'number' ? data.usage.input_tokens + data.usage.output_tokens : undefined };
  }
  if (data.choices?.[0]?.finish_reason === 'length') throw new Error('模型回答被长度限制截断；请缩小任务或提高输出上限后重试。');
  if (data.choices?.[0]?.finish_reason === 'content_filter') throw new Error('服务商中止了本次生成，回答尚未完成；已收到内容会保留。');
  const msg = data.choices?.[0]?.message;
  if (!msg || (typeof msg.content !== 'string' && !Array.isArray(msg.tool_calls))) throw new Error('返回格式不兼容 Chat Completions。');
  if (msg.tool_calls != null && (!Array.isArray(msg.tool_calls) || msg.tool_calls.length > 8 || msg.tool_calls.some((t: any) => typeof t.id !== 'string' || t.type !== 'function' || typeof t.function?.name !== 'string' || typeof t.function?.arguments !== 'string'))) throw new Error('模型工具调用格式无效。');
  return { message: { role: 'assistant', content: msg.content ?? null, ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}), ...(typeof msg.reasoning_content === 'string' ? { reasoning_content: msg.reasoning_content } : {}) }, tokens: typeof data.usage?.total_tokens === 'number' ? data.usage.total_tokens : undefined };
}

export async function completion(config: ProviderConfig, messages: Message[], tools: Tool[], signal?: AbortSignal, progress?: (p: StreamProgress) => void): Promise<{ message: Message; tokens?: number; model: string }> {
  const url = endpoint(config.baseUrl, config.protocol);
  if (!config.model.trim()) throw new Error('尚未设置模型 ID。');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), 240_000);
  try {
    const response = await fetch(url, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(config.protocol === 'anthropic' ? { 'anthropic-version': '2023-06-01', ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}) } : config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) },
      body: JSON.stringify({ ...requestBody(config, messages, tools), stream: config.stream === true })
    });
    // Bound the response while reading; a provider must not exhaust the extension host.
    if (!response.ok) {
      await response.body?.cancel();
      const hints: Record<number, string> = { 400: '请求参数不兼容；若服务不支持流式，可在模型页关闭后再试', 401: 'API 密钥无效或已过期', 403: '服务商拒绝访问', 404: '请检查 API 根地址和模型 ID', 429: '额度不足或请求过于频繁' };
      throw new Error(`API HTTP ${response.status}：${hints[response.status] || '请求失败，请检查服务商状态和配置'}。`);
    }
    const reader = response.body?.getReader();
    const stream = response.headers.get('content-type')?.includes('text/event-stream') ? new CompletionStream(config.protocol, progress) : undefined;
    let content = ''; let bytes = 0; const decoder = new TextDecoder();
    if (reader) for (;;) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > 4_000_000 || (!stream && bytes > 1_000_000)) { await reader.cancel(); throw new Error('模型返回内容过大。'); }
      const chunk = decoder.decode(item.value, { stream: true });
      if (stream) stream.feed(chunk); else content += chunk;
    }
    if (stream) stream.feed(decoder.decode()); else content += decoder.decode();
    let data: any;
    if (stream) data = stream.result();
    else { try { data = JSON.parse(content); } catch { throw new Error('服务商没有返回有效的 JSON。'); } }
    const result = parseMessage(data, config.protocol);
    const model = typeof data.model === 'string' && data.model.length <= 200 ? data.model : config.model;
    if (!stream) {
      progress?.({ kind: 'model', text: model });
      const thinking = result.message.reasoning_content ?? (result.message.providerContent as any[] | undefined)?.filter(p => p.type === 'thinking').map(p => p.thinking).join('\n');
      if (thinking) progress?.({ kind: 'thinking', text: thinking });
      if (result.message.content) progress?.({ kind: 'text', text: result.message.content });
    }
    return { ...result, model };
  } catch (error) {
    if (controller.signal.aborted) throw new Error(signal?.aborted ? '已取消请求。' : '模型请求超过 240 秒，请降低思考强度或稍后重试。');
    throw new Error(redact(error instanceof Error ? error.message : String(error), config.apiKey));
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); controller.abort(); }
}

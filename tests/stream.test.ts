import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { completion, requestBody, ProviderConfig } from '../src/core/provider';
import { CompletionStream, StreamProgress } from '../src/core/stream';

const event = (data: unknown) => `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\r\n\r\n`;
async function service(handler: http.RequestListener, run: (config: ProviderConfig) => Promise<void>) {
  const server = http.createServer(handler); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  try { await run({ baseUrl: `http://127.0.0.1:${(server.address() as any).port}/v1`, model: 'requested-model', apiKey: '', maxTokens: 4096, stream: true }); }
  finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
}
test('Chat SSE emits thinking and text before HTTP completion, preserves Chinese and actual model', async () => {
  let finish: (() => void) | undefined; let requested: any;
  await service(async (req, res) => {
    let body = ''; for await (const c of req) body += c; requested = JSON.parse(body);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const buffer = Buffer.from(event({ model: 'deepseek-v4.1-flash', choices: [{ index: 0, delta: { reasoning_content: '先核对机器人接口。' } }] }));
    // Deliberately split multibyte characters across writes.
    for (let i = 0; i < buffer.length; i += 5) res.write(buffer.subarray(i, i + 5));
    finish = () => res.end(event({ choices: [{ index: 0, delta: { content: '## 完成\n**已检查**' }, finish_reason: 'stop' }], usage: { total_tokens: 30 } }) + event('[DONE]'));
  }, async config => {
    const updates: StreamProgress[] = [];
    const result = await completion(config, [{ role: 'user', content: 'hello' }], [], undefined, p => { updates.push(p); if (p.kind === 'thinking') { assert.equal(p.text, '先核对机器人接口。'); finish!(); } });
    assert.equal(requested.stream, true); assert.equal(result.model, 'deepseek-v4.1-flash'); assert.equal(result.tokens, 30);
    assert.equal(result.message.content, '## 完成\n**已检查**'); assert.equal(updates.filter(p => p.kind === 'thinking').length, 1);
  });
});
test('interleaved fragmented tool arguments and Google signatures reassemble exactly', async () => {
  const stream = new CompletionStream();
  const chunks = [
    { choices: [{ delta: { tool_calls: [{ index: 0, id: 'a', type: 'function', function: { name: 'read_reference', arguments: '{"id":' } }, { index: 1, id: 'b', type: 'function', function: { name: 'get_diagnostics', arguments: '{' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 1, function: { arguments: '}' } }, { index: 0, function: { arguments: '"motion"}' }, extra_content: { google: { thought_signature: 'opaque' } } }] }, finish_reason: 'tool_calls' }] },
    '[DONE]'
  ].map(event).join('');
  for (const character of chunks) stream.feed(character);
  const data: any = stream.result(); const calls = data.choices[0].message.tool_calls;
  assert.equal(calls[0].function.arguments, '{"id":"motion"}'); assert.equal(calls[1].function.arguments, '{}');
  assert.equal(calls[0].extra_content.google.thought_signature, 'opaque');
});
test('Claude SSE preserves thinking/signature/tool blocks for the following tool round', async () => {
  const updates: StreamProgress[] = [];
  const events = [
    { type: 'message_start', message: { model: 'claude-sonnet-5', usage: { input_tokens: 23 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '核对运动单位。' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'signed-data' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'redacted_thinking', data: 'encrypted' } },
    { type: 'content_block_stop', index: 1 },
    { type: 'content_block_start', index: 2, content_block: { type: 'tool_use', id: 'tool', name: 'read_reference', input: {} } },
    { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: '{"id":"motion"}' } },
    { type: 'content_block_stop', index: 2 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 12 } }, { type: 'message_stop' }
  ];
  await service((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.end(events.map(event).join('')); }, async config => {
    config.protocol = 'anthropic'; const result = await completion(config, [], [], undefined, p => updates.push(p));
    assert.equal(result.tokens, 35); assert.equal(result.message.content, null);
    const body: any = requestBody(config, [result.message, { role: 'tool', tool_call_id: 'tool', content: 'API reference' }], []);
    assert.equal(body.messages[0].content[0].signature, 'signed-data'); assert.equal(body.messages[0].content[1].data, 'encrypted');
    assert.equal(body.messages[0].content[2].input.id, 'motion');
    assert.equal(updates.filter(p => p.kind === 'thinking').map(p => p.text).join(''), '核对运动单位。');
    assert.ok(!JSON.stringify(updates).includes('signed-data')); assert.ok(!JSON.stringify(updates).includes('encrypted'));
  });
});
test('abrupt EOF and server errors never produce a completed tool call', async () => {
  for (const tail of ['', event({ error: { message: 'secret body' } })]) {
    await service((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.end(event({ choices: [{ delta: { content: 'partial text' } }] }) + tail); }, async config => {
      const updates: StreamProgress[] = []; await assert.rejects(() => completion(config, [], [], undefined, p => updates.push(p)), e => { assert.doesNotMatch(String(e), /secret body/); return true; });
      assert.equal(updates[0].text, 'partial text');
    });
  }
});
test('cancelling a live stream stops the request after partial progress', async () => {
  await service((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write(event({ choices: [{ delta: { content: 'partial' } }] })); }, async config => {
    const controller = new AbortController();
    await assert.rejects(() => completion(config, [], [], controller.signal, p => { if (p.kind === 'text') controller.abort(); }), /已取消/);
  });
});

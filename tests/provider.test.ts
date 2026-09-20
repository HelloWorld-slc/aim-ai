import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { completion, endpoint, redact, ProviderConfig, requestBody } from '../src/core/provider';
import { PRESETS, thinkingOptions } from '../src/core/presets';
import fs from 'node:fs/promises';
import path from 'node:path';

async function server(handler: http.RequestListener, run: (config: ProviderConfig) => Promise<void>) {
  const service = http.createServer(handler);
  await new Promise<void>(resolve => service.listen(0, '127.0.0.1', resolve));
  const address = service.address() as { port: number };
  try { await run({ baseUrl: `http://127.0.0.1:${address.port}/v1`, model: 'fixture', apiKey: 'test-secret-not-real', maxTokens: 256 }); }
  finally { service.closeAllConnections(); await new Promise<void>(resolve => service.close(() => resolve())); }
}
test('API address validation and exact completion endpoint', () => {
  assert.equal(endpoint('https://example.org/v1/').href, 'https://example.org/v1/chat/completions');
  assert.equal(endpoint('https://api.deepseek.com').href, 'https://api.deepseek.com/chat/completions');
  assert.equal(endpoint('https://example.org/v1/chat/completions').href, 'https://example.org/v1/chat/completions');
  for (const url of ['http://remote.example/v1', 'file:///tmp/foo', 'https://key:secret@example.org', 'https://example.org/?key=secret']) assert.throws(() => endpoint(url));
  assert.equal(redact('token: xyz xyz', 'xyz'), 'token: [REDACTED] [REDACTED]');
});
test('Chat Completions request and tool response roundtrip', async () => {
  await server(async (req, res) => {
    assert.equal(req.url, '/v1/chat/completions'); assert.equal(req.headers.authorization, 'Bearer test-secret-not-real');
    let body = ''; for await (const chunk of req) body += chunk;
    const data = JSON.parse(body); assert.equal(data.stream, false); assert.equal(data.messages[0].content, 'hello');
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call1', type: 'function', function: { name: 'read_reference', arguments: '{"id":"motion"}' } }] } }], usage: { total_tokens: 123 } }));
  }, async config => {
    const result = await completion(config, [{ role: 'user', content: 'hello' }], []);
    assert.equal(result.message.tool_calls?.[0].function.name, 'read_reference'); assert.equal(result.tokens, 123);
  });
});
test('HTTP errors do not leak response secrets', async () => {
  await server((_req, res) => { res.statusCode = 401; res.end('echo test-secret-not-real plus confidential code'); }, async config => {
    await assert.rejects(() => completion(config, [], []), err => { assert.match(String(err), /401/); assert.doesNotMatch(String(err), /test-secret|confidential/); return true; });
  });
});
test('malformed, truncated and malicious tool data are rejected', async () => {
  for (const body of ['<html>oops</html>', JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: 'partial' } }] }), JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ function: {} }] } }] })]) {
    await server((_req, res) => res.end(body), async config => { await assert.rejects(() => completion(config, [], [])); });
  }
});
test('redirect never forwards a credential', async () => {
  let requests = 0;
  await server((_req, res) => { requests++; res.writeHead(302, { Location: '/other' }); res.end(); }, async config => {
    await assert.rejects(() => completion(config, [], [])); assert.equal(requests, 1);
  });
});
test('cancellation aborts pending request', async () => {
  await server(() => {}, async config => {
    const aborter = new AbortController(); setTimeout(() => aborter.abort(), 30);
    await assert.rejects(() => completion(config, [], [], aborter.signal), /已取消/);
  });
});
test('oversized provider output is bounded', async () => {
  await server((_req, res) => res.end('x'.repeat(1_000_100)), async config => { await assert.rejects(() => completion(config, [], []), /过大/); });
});

test('official presets have local icons and provider-specific request parameters', async () => {
  assert.equal(PRESETS.length, 7);
  const sources = JSON.parse(await fs.readFile(path.resolve('media/providers/SOURCES.json'), 'utf8'));
  for (const p of PRESETS) {
    await fs.access(path.resolve('media/providers', p.icon));
    assert.ok(sources.some((s: any) => s.id === p.id && s.file === p.icon && s.url.startsWith('https://')));
    assert.equal(endpoint(p.baseUrl, p.protocol).protocol, 'https:');
  }
  const base = { baseUrl: 'https://example.com/v1', model: 'fixture', apiKey: '', maxTokens: 4096 };
  const openai = requestBody({ ...base, model: 'gpt-5.6-terra', presetId: 'openai' }, [], []);
  assert.equal(openai.max_completion_tokens, 4096); assert.equal(openai.max_tokens, undefined);
  assert.equal(openai.reasoning_effort, 'low');
  assert.deepEqual(requestBody({ ...base, presetId: 'deepseek' }, [], []).thinking, { type: 'disabled' });
  assert.equal(requestBody({ ...base, presetId: 'qwen' }, [], []).enable_thinking, false);
  assert.equal(requestBody({ ...base, presetId: 'kimi', model: 'kimi-k3' }, [], []).thinking, undefined);
  assert.equal(requestBody({ ...base, presetId: 'kimi', model: 'kimi-k3' }, [], []).reasoning_effort, 'low');
});

test('Claude native request maps system, tool definitions and multiple tool results', async () => {
  await server(async (req, res) => {
    assert.equal(req.url, '/v1/messages'); assert.equal(req.headers['x-api-key'], 'test-secret-not-real');
    assert.equal(req.headers.authorization, undefined); assert.equal(req.headers['anthropic-version'], '2023-06-01');
    let raw = ''; for await (const chunk of req) raw += chunk;
    const b = JSON.parse(raw); assert.equal(b.system, 'system'); assert.equal(b.messages[0].role, 'user');
    assert.equal(b.tools[0].input_schema.type, 'object');
    res.end(JSON.stringify({ content: [{ type: 'text', text: '查资料' }, { type: 'tool_use', id: 'a', name: 'read_reference', input: { id: 'timer' } }], stop_reason: 'tool_use', usage: { input_tokens: 100, output_tokens: 20 } }));
  }, async config => {
    config.protocol = 'anthropic';
    const tools = [{ type: 'function' as const, function: { name: 'read_reference', description: 'docs', parameters: { type: 'object' } } }];
    const result = await completion(config, [{ role: 'system', content: 'system' }, { role: 'user', content: 'question' }], tools);
    assert.equal(result.tokens, 120); assert.equal(result.message.tool_calls?.[0].function.arguments, '{"id":"timer"}');
    const next: any = requestBody(config, [{ role: 'system', content: 'system' }, { role: 'user', content: 'question' }, result.message, { role: 'tool', tool_call_id: 'a', content: 'answer' }, { role: 'tool', tool_call_id: 'b', content: 'answer2' }], tools);
    assert.equal(next.messages[1].content[1].type, 'tool_use');
    assert.equal(next.messages[2].content.length, 2); assert.equal(next.messages[2].content[0].tool_use_id, 'a');
    assert.equal(endpoint('https://api.anthropic.com', 'anthropic').pathname, '/v1/messages');
  });
});

test('reasoning and Gemini tool signatures survive the next tool round, null tool_calls are accepted', async () => {
  await server((_req, res) => res.end(JSON.stringify({ choices: [{ message: { content: null, reasoning_content: 'private provider continuation', tool_calls: [{ id: 'a', type: 'function', function: { name: 'read_reference', arguments: '{}' }, extra_content: { google: { thought_signature: 'opaque-signature' } } }] } }] })), async config => {
    const result = await completion(config, [], []);
    const next: any = requestBody(config, [result.message], []);
    assert.equal(next.messages[0].reasoning_content, 'private provider continuation');
    assert.equal(next.messages[0].tool_calls[0].extra_content.google.thought_signature, 'opaque-signature');
  });
  await server((_req, res) => res.end(JSON.stringify({ choices: [{ message: { content: 'OK', tool_calls: null } }] })), async config => {
    assert.equal((await completion(config, [], [])).message.content, 'OK');
  });
});

test('thinking menus and outbound parameters agree across model families', () => {
  const base: ProviderConfig = { baseUrl: 'https://example.org/v1', apiKey: '', model: 'fixture', maxTokens: 4096 };
  const cases: [string, string, ProviderConfig['thinkingEffort'], Record<string, unknown>][] = [
    ['deepseek', 'deepseek-flash', 'high', { thinking: { type: 'enabled' }, reasoning_effort: 'high' }],
    ['deepseek', 'deepseek-v4-pro', 'off', { thinking: { type: 'disabled' } }],
    ['qwen', 'qwen-plus', 'medium', { enable_thinking: true, thinking_budget: 4096 }],
    ['kimi', 'kimi-k3', 'max', { reasoning_effort: 'max' }],
    ['kimi', 'kimi-k2.6', 'enabled', { thinking: { type: 'enabled' } }],
    ['glm', 'glm-4.7', 'enabled', { thinking: { type: 'enabled' } }],
    ['openai', 'gpt-5.6-terra', 'high', { reasoning_effort: 'high' }],
    ['gemini', 'gemini-3.8-flash', 'minimal', { reasoning_effort: 'minimal' }],
    ['custom', 'local-model', 'medium', { reasoning_effort: 'medium' }]
  ];
  for (const [presetId, model, thinkingEffort, expected] of cases) {
    assert.ok(thinkingOptions(presetId, model).options.some(o => o.value === thinkingEffort));
    const body = requestBody({ ...base, presetId, model, thinkingEffort }, [], []);
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(body[key], value);
    assert.equal(body.max_tokens ?? body.max_completion_tokens, 4096);
  }
  assert.ok(!thinkingOptions('kimi', 'kimi-k3').options.some(o => o.value === 'off'));
  assert.ok(!thinkingOptions('glm', 'glm-4.7').options.some(o => o.value === 'high'));
  assert.equal(requestBody({ ...base, presetId: 'glm', model: 'glm-4.7', thinkingEffort: 'high' }, [], []).reasoning_effort, undefined);
  const claude = { ...base, protocol: 'anthropic' as const, presetId: 'claude', model: 'claude-sonnet-5', thinkingEffort: 'high' as const };
  assert.deepEqual(requestBody(claude, [], []).output_config, { effort: 'high' });
  assert.deepEqual(requestBody(claude, [], []).thinking, { type: 'adaptive' });
  assert.throws(() => requestBody({ ...claude, model: 'claude-haiku-4-5', thinkingEffort: 'enabled', maxTokens: 1024 }, [], []), /输出上限/);
});

test('Claude thinking blocks and signatures replay unchanged without entering visible answer', async () => {
  const blocks = [{ type: 'thinking', thinking: 'provider-only reasoning', signature: 'opaque' }, { type: 'redacted_thinking', data: 'opaque-redacted' }, { type: 'tool_use', id: 'call', name: 'read_reference', input: { id: 'motion' } }];
  await server((_req, res) => res.end(JSON.stringify({ content: blocks, stop_reason: 'tool_use' })), async config => {
    config.protocol = 'anthropic'; config.model = 'claude-sonnet-5'; config.thinkingEffort = 'high';
    const response = await completion(config, [], []);
    assert.equal(response.message.content, null);
    const body: any = requestBody(config, [response.message, { role: 'tool', tool_call_id: 'call', content: 'reference' }], []);
    assert.deepEqual(body.messages[0].content, blocks); assert.equal(body.messages[1].content[0].tool_use_id, 'call');
  });
});

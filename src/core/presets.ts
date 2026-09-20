export type Protocol = 'chat-completions' | 'anthropic';
export interface Preset { id: string; name: string; region: '国内' | '国外'; baseUrl: string; models: string[]; protocol: Protocol; icon: string; docs: string; note: string }
// Verified against official provider documentation on 2026-09-20. IDs remain editable.
export const PRESETS: Preset[] = [
  { id: 'deepseek', name: 'DeepSeek', region: '国内', baseUrl: 'https://api.deepseek.com', models: ['deepseek-flash', 'deepseek-v4-pro'], protocol: 'chat-completions', icon: 'deepseek.ico', docs: 'https://api-docs.deepseek.com/', note: '使用 DeepSeek 开放平台 API Key；预设关闭深度思考。' },
  { id: 'qwen', name: '通义千问 Qwen', region: '国内', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen3.8-max'], protocol: 'chat-completions', icon: 'qwen.png', docs: 'https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope', note: '默认北京地域；API Key 和地址需属于同一地域，也可填写百炼提供的业务空间专属地址。' },
  { id: 'kimi', name: 'Kimi', region: '国内', baseUrl: 'https://api.moonshot.cn/v1', models: ['kimi-k2.6', 'kimi-k3'], protocol: 'chat-completions', icon: 'kimi.png', docs: 'https://platform.kimi.com/docs/api/models-overview', note: 'K2.6 默认关闭思考；K3 使用低推理强度。API Key 来自 Kimi 开放平台。' },
  { id: 'glm', name: '智谱 GLM', region: '国内', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4.7'], protocol: 'chat-completions', icon: 'glm.ico', docs: 'https://docs.bigmodel.cn/cn/guide/models/text/glm-4.7', note: '默认按量付费 API 地址；Coding Plan 使用不同地址，请按订阅文档修改。' },
  { id: 'openai', name: 'OpenAI', region: '国外', baseUrl: 'https://api.openai.com/v1', models: ['gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-6-astra'], protocol: 'chat-completions', icon: 'openai.png', docs: 'https://developers.openai.com/api/docs/models/compare', note: '使用 OpenAI API Key；ChatGPT 订阅与 API 计费独立。默认使用低推理强度。' },
  { id: 'claude', name: 'Claude', region: '国外', baseUrl: 'https://api.anthropic.com/v1', models: ['claude-sonnet-5', 'claude-haiku-4-5'], protocol: 'anthropic', icon: 'claude.png', docs: 'https://platform.claude.com/docs/en/api/messages/create', note: '使用 Anthropic API Key，通过原生 Messages 接口调用。' },
  { id: 'gemini', name: 'Gemini', region: '国外', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', models: ['gemini-3.8-flash'], protocol: 'chat-completions', icon: 'gemini.png', docs: 'https://ai.google.dev/gemini-api/docs/openai', note: '使用 Google AI Studio / Gemini API Key；通过官方 OpenAI 兼容接口调用。' }
];
export function preset(id?: string) { return PRESETS.find(p => p.id === id); }
export type ThinkingEffort = 'default' | 'off' | 'enabled' | 'minimal' | 'low' | 'medium' | 'high' | 'max';
const LABELS: Record<ThinkingEffort, string> = { default: '预设默认', off: '关闭思考', enabled: '开启思考', minimal: '极低', low: '低', medium: '中', high: '高', max: '最高' };
export function thinkingOptions(id: string | undefined, model: string, protocol: Protocol = 'chat-completions') {
  let values: ThinkingEffort[] = [];
  let note = '此模型尚未核对思考参数，沿用服务默认。';
  if (id === 'deepseek' && /^(deepseek-flash|deepseek-v4-pro)$/.test(model)) values = ['off', 'low', 'high', 'max'];
  if (id === 'qwen' && /^(qwen-plus|qwen3\.8-max)$/.test(model)) {
    values = ['off', 'low', 'medium', 'high']; note = '低 / 中 / 高分别设置 1024 / 4096 / 8192 个思考 token 的预算。';
  }
  if (id === 'kimi' && model === 'kimi-k3') values = ['low', 'high', 'max'];
  if ((id === 'kimi' && model === 'kimi-k2.6') || (id === 'glm' && model === 'glm-4.7')) {
    values = ['off', 'enabled']; note = '此模型提供思考开关，不发送不受支持的强度档位。';
  }
  if (id === 'openai' && ['gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-6-astra'].includes(model)) values = ['low', 'medium', 'high'];
  if (id === 'gemini' && model === 'gemini-3.8-flash') values = ['minimal', 'low', 'medium', 'high'];
  if (protocol === 'anthropic' && model === 'claude-sonnet-5') values = ['low', 'medium', 'high', 'max'];
  if (protocol === 'anthropic' && model === 'claude-haiku-4-5') { values = ['off', 'enabled']; note = '开启时使用思考预算；输出上限须大于 1024。'; }
  if ((!id || id === 'custom') && protocol === 'chat-completions') { values = ['low', 'medium', 'high']; note = '自定义接口仅在你确认支持 reasoning_effort 时选档，否则保留默认。'; }
  if (values.length && note.startsWith('此模型尚未')) note = '更高强度通常需要更多时间与用量；可用档位按当前模型调整。';
  return { options: (['default', ...values] as ThinkingEffort[]).map(value => ({ value, label: LABELS[value] })), note };
}
export function effectiveEffort(id: string | undefined, model: string, effort: string = 'default', protocol?: Protocol): ThinkingEffort {
  return thinkingOptions(id, model, protocol).options.find(o => o.value === effort)?.value ?? 'default';
}
export function requestOptions(id: string | undefined, model: string, effort: ThinkingEffort = 'default', protocol: Protocol = 'chat-completions', maxTokens = 4096): Record<string, unknown> {
  const selected = effectiveEffort(id, model, effort, protocol);
  if (selected !== 'default') {
    if (protocol === 'anthropic') {
      if (model === 'claude-sonnet-5') return { thinking: { type: 'adaptive' }, output_config: { effort: selected } };
      if (selected === 'off') return { thinking: { type: 'disabled' } };
      if (maxTokens <= 1024) throw new Error('此模型开启思考需要更大的输出上限，请将 AIM AI 的最大输出 tokens 调整到 2048 或以上。');
      return { thinking: { type: 'enabled', budget_tokens: Math.min(8192, Math.max(1024, Math.floor(maxTokens / 2))) } };
    }
    if (id === 'qwen') return selected === 'off' ? { enable_thinking: false } : { enable_thinking: true, thinking_budget: { low: 1024, medium: 4096, high: 8192 }[selected as 'low' | 'medium' | 'high'] };
    if (id === 'deepseek') return selected === 'off' ? { thinking: { type: 'disabled' } } : { thinking: { type: 'enabled' }, reasoning_effort: selected };
    if (selected === 'off' || selected === 'enabled') return { thinking: { type: selected === 'off' ? 'disabled' : 'enabled' } };
    return { reasoning_effort: selected };
  }
  if (protocol === 'anthropic') return {};
  if (id === 'openai' && /^gpt-(5\.[456]|6)/.test(model)) return { reasoning_effort: 'low' };
  if (id === 'deepseek') return { thinking: { type: 'disabled' } };
  if (id === 'qwen') return { enable_thinking: false };
  if (id === 'kimi') return model.startsWith('kimi-k3') ? { reasoning_effort: 'low' } : model.startsWith('kimi-k2.6') ? { thinking: { type: 'disabled' } } : {};
  if (id === 'glm' && /^glm-(4\.[567]|5)/.test(model)) return { thinking: { type: 'disabled' } };
  return {};
}

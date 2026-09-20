export type Outcome = { state: 'reported-success' | 'failed' | 'unknown'; detail: string };
export function interpretVexResult(value: unknown): Outcome {
  if (!value || typeof value !== 'object') return { state: 'unknown', detail: '命令已返回，但没有可核验的结果；请查看 VEX 输出。' };
  const r = value as Record<string, unknown>;
  const detail = typeof r.details === 'string' ? r.details : '';
  if (/no .*?(device|project)|not connected|failed|error|wrong platform|cancel|not supported/i.test(detail) || (typeof r.statusCode === 'number' && r.statusCode !== 0)) return { state: 'failed', detail: detail || `VEX 返回错误 ${String(r.statusCode)}` };
  if (r.statusCode === 0 && /success|downloaded|complete/i.test(detail)) return { state: 'reported-success', detail: `VEX 报告完成：${detail}。尚未独立核验机器人内程序内容。` };
  return { state: 'unknown', detail: 'VEX 命令返回，设备结果尚未确认。请查看 VEX 输出和机器人槽位。' };
}

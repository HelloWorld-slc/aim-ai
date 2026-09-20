import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { isIP } from 'node:net';

export interface RobotTest { kind: 'move' | 'turn'; amount: number; speed: number }
export interface RobotSnapshot {
  mode: 'simulation' | 'hardware'; capturedAt: string; batteryPercent: number;
  positionMm: { x: number; y: number }; headingDeg: number; stopped: boolean;
  vision?: Record<string, unknown[]>; scope: string;
}
export interface RobotReport {
  mode: 'simulation' | 'hardware'; kind: string; requested: number; speedPercent: number;
  elapsedSeconds: number; before: RobotSnapshot; after: RobotSnapshot;
  measured: { headingChangeDeg: number; positionDeltaMm: number }; verdict: string;
}
export function robotHost(value: string): string {
  const host = value.trim();
  if (isIP(host) !== 4 || host === '0.0.0.0' || host === '255.255.255.255') throw new Error('请输入机器人的 IPv4 地址，例如 192.168.4.1。');
  return host;
}
export function robotTest(value: unknown): RobotTest {
  if (!value || typeof value !== 'object') throw new Error('动作测试参数无效。');
  const p = value as RobotTest;
  if (!['move', 'turn'].includes(p.kind) || typeof p.amount !== 'number' || !Number.isFinite(p.amount) || p.amount < 1 || p.amount > (p.kind === 'move' ? 200 : 90) || typeof p.speed !== 'number' || !Number.isFinite(p.speed) || p.speed < 10 || p.speed > 30) throw new Error('测试范围：直行 1–200 mm、右转 1–90°，速度 10–30%。');
  return { kind: p.kind, amount: p.amount, speed: p.speed };
}
export function testLabel(p: RobotTest): string { return `${p.kind === 'move' ? '直行' : '右转'} ${p.amount}${p.kind === 'move' ? ' mm' : '°'} · ${p.speed}% 速度`; }
export function robotSummary(value: RobotSnapshot | RobotReport): string {
  const mode = value.mode === 'simulation' ? '模拟数据：未连接或验证真实机器人' : '实机远程调试数据';
  const text = JSON.stringify(value);
  if (text.length > 8000) throw new Error('机器人数据过长，请缩小测试。');
  return `${mode}。这是一次独立接口测试，不证明当前学生程序已下载或执行。\n${text}`;
}

export class RobotClient {
  private client?: Client;
  private transport?: StdioClientTransport;
  private readonly token = randomUUID();
  private connecting = false;
  onClose: () => void = () => {};
  get active() { return !!this.client && !this.connecting; }
  async connect(python: string, server: string, host: string, simulate: boolean, signal?: AbortSignal): Promise<RobotSnapshot> {
    if (this.client || this.connecting) throw new Error('请先断开现有调试会话。');
    if (!simulate) robotHost(host);
    this.connecting = true;
    const transport = new StdioClientTransport({ command: python, args: ['-u', server, ...(simulate ? ['--simulate'] : ['--host', host])], cwd: path.dirname(server), stderr: 'pipe', maxBufferSize: 128 * 1024, env: { PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1', PYTHONNOUSERSITE: '1', AIM_AI_MOTION_TOKEN: this.token } });
    // Consume diagnostics without forwarding arbitrary backend text to the model.
    transport.stderr?.on('data', () => {});
    const client = new Client({ name: 'aim-ai', version: '0.4.0' }, { capabilities: {} });
    this.client = client; this.transport = transport;
    client.onclose = () => { if (this.client === client) { this.client = undefined; this.onClose(); } };
    try {
      await client.connect(transport, { timeout: 15000, signal });
      const list = await client.listTools({}, { timeout: 5000, signal });
      for (const name of ['robot_connect', 'robot_snapshot', 'robot_test', 'robot_stop', 'robot_disconnect']) if (!list.tools.some(t => t.name === name)) throw new Error('机器人后台版本不匹配，请重新安装调试环境。');
      return await this.call<RobotSnapshot>('robot_connect', {}, signal, 25000);
    } catch (error) { await this.close(); throw error; }
    finally { this.connecting = false; }
  }
  private async call<T>(name: string, args: Record<string, unknown>, signal?: AbortSignal, timeout = 5000): Promise<T> {
    if (!this.client) throw new Error('机器人调试后台未连接。');
    const result = await this.client.callTool({ name, arguments: args }, undefined, { signal, timeout });
    const text = Array.isArray(result.content) ? result.content.filter(p => p.type === 'text').map(p => p.text).join('\n') : '';
    if (result.isError) throw new Error(text.slice(0, 1000) || '机器人操作失败。');
    if (text.length > 16000) throw new Error('机器人返回数据超出本次限制。');
    const value = result.structuredContent ?? JSON.parse(text);
    return value as T;
  }
  snapshot(vision = false, signal?: AbortSignal) { return this.call<RobotSnapshot>('robot_snapshot', { include_vision: vision }, signal); }
  test(plan: RobotTest, signal?: AbortSignal) { return this.call<RobotReport>('robot_test', { ...robotTest(plan), approval: this.token }, signal, 15000); }
  stop() { return this.call<{ requested: boolean; confirmed: boolean }>('robot_stop', {}, undefined, 3000); }
  async close() {
    const client = this.client, transport = this.transport;
    try { if (client) await this.call('robot_disconnect', {}, undefined, 2000).catch(() => {}); }
    finally { this.client = undefined; this.transport = undefined; if (client) await client.close().catch(() => {}); if (transport) await transport.close().catch(() => {}); }
  }
}

import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface ChatMessage { id: string; role: 'user' | 'assistant' | 'notice'; text: string; at: string; contextText?: string; model?: string; thinking?: string; status?: 'streaming' | 'complete' | 'interrupted' }
export interface Conversation { version: 1; id: string; title: string; createdAt: string; updatedAt: string; projectUri: string; projectName: string; messages: ChatMessage[] }
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_FILE_BYTES = 20_000_000;

// One file per conversation avoids a fragile global index. Writes are atomic and serialized.
export class Conversations {
  private chats = new Map<string, Conversation>();
  private writes: Promise<void> = Promise.resolve();
  private mutations: Promise<unknown> = Promise.resolve();
  readonly warnings: string[] = [];
  activeId?: string;
  constructor(readonly root: string) {}
  async load() {
    await fs.mkdir(this.root, { recursive: true });
    for (const name of await fs.readdir(this.root)) {
      if (!name.endsWith('.json') || !ID.test(name.slice(0, -5))) continue;
      try {
        const file = path.join(this.root, name);
        if ((await fs.stat(file)).size > MAX_FILE_BYTES) throw new Error('too large');
        const c: Conversation = JSON.parse(await fs.readFile(file, 'utf8'));
        if (c.version !== 1 || c.id !== name.slice(0, -5) || ![c.title, c.projectUri, c.projectName, c.createdAt, c.updatedAt].every(v => typeof v === 'string') || !Array.isArray(c.messages) || c.messages.some(m => !['user', 'assistant', 'notice'].includes(m.role) || typeof m.text !== 'string' || typeof m.at !== 'string' || typeof m.id !== 'string' || (m.contextText !== undefined && typeof m.contextText !== 'string'))) throw new Error('invalid');
        this.chats.set(c.id, c);
        for (const m of c.messages) {
          if (m.model !== undefined && typeof m.model !== 'string') delete m.model;
          if (m.thinking !== undefined && typeof m.thinking !== 'string') delete m.thinking;
          if (m.status === 'streaming') m.status = 'interrupted';
        }
      } catch { this.warnings.push(`有一份历史记录无法读取，已保留原文件：${name}`); }
    }
    try {
      const active = JSON.parse(await fs.readFile(path.join(this.root, 'active.json'), 'utf8')).id;
      this.activeId = typeof active === 'string' && this.chats.has(active) ? active : undefined;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.warnings.push('上次打开的对话状态无法读取，可从历史列表重新选择。'); }
  }
  async select(id?: string) {
    return this.change(async () => {
      if (id) this.get(id);
      const temp = path.join(this.root, `active.${randomUUID()}.tmp`);
      try {
        await fs.writeFile(temp, JSON.stringify({ id: id ?? null }), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        await fs.rename(temp, path.join(this.root, 'active.json')); this.activeId = id;
      } finally { await fs.rm(temp, { force: true }); }
    });
  }
  list() { return [...this.chats.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(({ messages, ...c }) => ({ ...c, count: messages.length })); }
  get(id: string) { const c = this.chats.get(id); if (!c) throw new Error('对话不存在或已删除。'); return structuredClone(c); }
  private change<T>(action: () => Promise<T>): Promise<T> {
    const pending = this.mutations.then(action); this.mutations = pending.catch(() => {}); return pending;
  }
  private save(c: Conversation): Promise<void> {
    const snapshot = structuredClone(c);
    const action = this.writes.then(async () => {
      if (!ID.test(snapshot.id)) throw new Error('对话编号无效。');
      const json = JSON.stringify(snapshot);
      if (Buffer.byteLength(json) > MAX_FILE_BYTES) throw new Error('本次对话已达到本地文件容量限制，请新建对话；已有记录仍保留。');
      const temp = path.join(this.root, `${snapshot.id}.${randomUUID()}.tmp`);
      try {
        await fs.writeFile(temp, json, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        await fs.rename(temp, path.join(this.root, `${snapshot.id}.json`));
        this.chats.set(snapshot.id, snapshot);
      } finally { await fs.rm(temp, { force: true }); }
    });
    this.writes = action.catch(() => {});
    return action;
  }
  async create(title: string, projectUri: string, projectName: string) {
    return this.change(async () => {
    const now = new Date().toISOString();
    const c: Conversation = { version: 1, id: randomUUID(), title: title.trim().slice(0, 80) || '新对话', projectUri, projectName, createdAt: now, updatedAt: now, messages: [] };
    await this.save(c); return this.get(c.id);
    });
  }
  async append(id: string, role: ChatMessage['role'], text: string, contextText?: string, meta: Pick<ChatMessage, 'model' | 'thinking' | 'status'> = {}) {
    return this.change(async () => {
    await this.writes;
    const c = this.get(id); const now = new Date().toISOString();
    const message: ChatMessage = { id: randomUUID(), role, text, at: now, ...meta, ...(contextText !== undefined ? { contextText } : {}) };
    c.messages.push(message);
    c.updatedAt = now; await this.save(c); return message;
    });
  }
  async upsert(id: string, message: ChatMessage) {
    const snapshot = structuredClone(message);
    return this.change(async () => {
      if (!ID.test(snapshot.id) || snapshot.role !== 'assistant') throw new Error('回答记录格式无效。');
      const c = this.get(id); const index = c.messages.findIndex(m => m.id === snapshot.id);
      if (index < 0) c.messages.push(snapshot); else c.messages[index] = snapshot;
      c.updatedAt = new Date().toISOString(); await this.save(c);
    });
  }
  async rename(id: string, title: string) {
    return this.change(async () => {
    await this.writes;
    if (!title.trim()) throw new Error('请输入对话名称。');
    const c = this.get(id); c.title = title.trim().slice(0, 80); await this.save(c);
    });
  }
  async remove(id: string) {
    return this.change(async () => {
    await this.writes; this.get(id);
    await fs.unlink(path.join(this.root, `${id}.json`)); this.chats.delete(id);
    });
  }
  context(id: string) {
    // Persist the full conversation; send only a bounded recent excerpt to the model.
    const messages = this.get(id).messages.filter(m => m.role !== 'notice' && m.text.trim() && (!m.status || m.status === 'complete'));
    const selected: { role: 'user' | 'assistant'; content: string }[] = [];
    let size = 0;
    for (const m of messages.slice().reverse()) {
      const content = (m.contextText ?? m.text).slice(0, 8000);
      if (selected.length >= 6 || size + content.length > 16000) break;
      selected.unshift({ role: m.role as 'user' | 'assistant', content }); size += content.length;
    }
    while (selected[0]?.role === 'assistant') selected.shift();
    return selected;
  }
}

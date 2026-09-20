import * as fs from 'node:fs/promises';
import path from 'node:path';

export interface Topic { id: string; title: string; keywords: string[]; file: string; group?: 'python' | 'guide'; parent?: string; source?: string }
export interface CatalogTopic { id: string; title: string; group: string; parent?: string; source?: string; searchText: string }
export const MAX_CONTEXT_CHARS = 16_000;
function contains(text: string, term: string): boolean {
  if (/^[a-z0-9_.]+$/i.test(term)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![a-z0-9_])${escaped}(?![a-z0-9_])`, 'i').test(text);
  }
  return text.includes(term);
}
export class Knowledge {
  topics: Topic[] = [];
  private documents = new Map<string, string>();
  constructor(readonly root: string) {}
  async load() {
    const topics: Topic[] = JSON.parse(await fs.readFile(path.join(this.root, 'index.json'), 'utf8'));
    const documents = new Map<string, string>();
    for (const t of topics) {
      if (!/^[a-z][a-z0-9-]*$/.test(t.id) || documents.has(t.id) || !/^[a-z0-9-]+\.md$/.test(t.file)) throw new Error('内置资料索引格式无效。');
      documents.set(t.id, await fs.readFile(path.join(this.root, t.file), 'utf8'));
    }
    if (!documents.has('start') || topics.some(t => t.parent && !documents.has(t.parent))) throw new Error('资料目录缺少父级或入门页。');
    this.topics = topics; this.documents = documents;
  }
  catalog(): CatalogTopic[] {
    return this.topics.map(t => ({ id: t.id, title: t.title, group: t.group ?? 'guide', parent: t.parent, source: t.source, searchText: [t.title, ...t.keywords, this.documents.get(t.id)].join('\n').toLowerCase() }));
  }
  async read(id: string): Promise<string> {
    const document = this.documents.get(id);
    if (document === undefined) throw new Error('资料不存在，请使用资料索引中的 id。');
    return document;
  }
  async context(query: string): Promise<{ text: string; ids: string[] }> {
    const lower = query.toLowerCase();
    const identifiers = [...new Set((lower.match(/[a-z_][a-z0-9_.]{2,}/g) ?? []).flatMap(term => {
      const clean = term.replace(/\.+$/, '');
      return [clean, ...(clean.includes('.') ? [clean.slice(clean.lastIndexOf('.') + 1)] : [])];
    }).filter(term => term.length >= 3))];
    const ranked = this.topics.filter(t => t.id !== 'start').map(t => {
      const body = this.documents.get(t.id)!.toLowerCase();
      const keywordScore = t.keywords.filter(k => contains(lower, k.toLowerCase())).length * 4;
      const apiScore = identifiers.filter(term => contains(body, term)).length * 8;
      return { topic: t, score: keywordScore + apiScore };
    }).filter(t => t.score > 0).sort((a, b) => b.score - a.score);
    const ids = ['start']; let text = await this.read('start');
    for (const { topic } of ranked) {
      if (ids.length >= 4) break;
      const body = await this.read(topic.id);
      if (text.length + body.length + 2 > MAX_CONTEXT_CHARS) continue;
      ids.push(topic.id); text += '\n\n' + body;
    }
    return { text, ids };
  }
}

import MarkdownIt from 'markdown-it';
import { diffLines } from 'diff';
import { MAX_SOURCE, preserveRegion } from './project';

const markdown = new MarkdownIt({ html: false });
export function detectedProgram(text: string, original: string): string | undefined {
  const blocks = markdown.parse(text, {}).filter(t => t.type === 'fence' && /^(python|py)?$/i.test(t.info.trim()));
  // Ambiguous alternatives and snippets should never become replacements for a whole program.
  if (blocks.length !== 1) return;
  const block = blocks[0];
  const closing = text.split(/\r?\n/)[(block.map?.[1] ?? 0) - 1]?.trim();
  if (!closing || !/^(`{3,}|~{3,})$/.test(closing) || closing[0] !== block.markup[0] || closing.length < block.markup.length) return;
  const source = block.content;
  if (!source.trim() || source.length > MAX_SOURCE || !/^from vex import \*/m.test(source) || !/^robot\s*=\s*Robot\(\)/m.test(source)) return;
  try { preserveRegion(original, source); } catch { return; }
  return source;
}
export function changeSummary(before: string, after: string) {
  const parts = diffLines(before.replace(/\r\n/g, '\n'), after.replace(/\r\n/g, '\n'), { timeout: 250 });
  if (!parts) return undefined;
  return parts.reduce((result, part) => { if (part.added) result.added += part.count ?? 0; if (part.removed) result.removed += part.count ?? 0; return result; }, { added: 0, removed: 0 });
}

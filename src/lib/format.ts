export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatTime(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

export type Lang = 'json' | 'xml' | 'html' | 'js' | 'text';

export function detectLang(contentType: string | undefined, body: string): Lang {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('json') || ct.includes('+json')) return 'json';
  if (ct.includes('html')) return 'html';
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('javascript')) return 'js';
  const t = body.trimStart();
  if (t.startsWith('{') || t.startsWith('[')) return 'json';
  if (t.startsWith('<?xml')) return 'xml';
  if (/^<!doctype html|^<html/i.test(t)) return 'html';
  return 'text';
}

const PRETTY_LIMIT = 5 * 1024 * 1024;

export function prettyJson(text: string): string | null {
  if (text.length > PRETTY_LIMIT) return null;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return null;
  }
}

/** Indentador XML simple (suficiente para legibilidad; no valida). */
export function prettyXml(text: string): string | null {
  if (text.length > PRETTY_LIMIT || !text.trimStart().startsWith('<')) return null;
  const tokens = text.replace(/>\s+</g, '><').trim().replaceAll('><', '>\n<').split('\n');
  let depth = 0;
  const out: string[] = [];
  for (const t of tokens) {
    if (t.startsWith('</')) depth = Math.max(0, depth - 1);
    out.push('  '.repeat(depth) + t);
    if (/^<[^!?/][^>]*[^/]>$/.test(t) && !/<\/[^>]+>$/.test(t)) depth++;
  }
  return out.join('\n');
}

export function pretty(text: string, lang: Lang): string {
  if (lang === 'json') return prettyJson(text) ?? text;
  if (lang === 'xml' || lang === 'html') return prettyXml(text) ?? text;
  return text;
}

export function headerValue(headers: { key: string; value: string }[], name: string): string | undefined {
  return headers.find((h) => h.key.toLowerCase() === name)?.value;
}

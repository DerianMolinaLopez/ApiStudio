import { uid } from './id';
import type { AuthModel, EngineBody, EngineRequest, KV, RequestModel } from './types';

// ── Constructores ───────────────────────────────────────────────────────
export const newKV = (key = '', value = '', enabled = true): KV => ({ id: uid(), key, value, description: '', enabled });

export function newRequest(partial: Partial<RequestModel> = {}): RequestModel {
  return {
    id: uid(),
    name: 'Nueva solicitud',
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: { mode: 'none', json: '', raw: '', rawType: 'text/plain', urlencoded: [], formData: [] },
    auth: { type: 'none' },
    preScript: '',
    postScript: '',
    tests: '',
    ...partial,
  };
}

// ── Variables {{nombre}} ────────────────────────────────────────────────
const VAR_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

export type Vars = Record<string, string>;

export function interpolate(text: string, vars: Vars): string {
  return text.replace(VAR_RE, (m, name: string) => (name in vars ? vars[name] : m));
}

/** Variables usadas en el texto que no existen en `vars`. */
export function unresolved(text: string, vars: Vars): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(VAR_RE)) if (!(m[1] in vars)) out.add(m[1]);
  return [...out];
}

// ── URL ↔ parámetros ────────────────────────────────────────────────────
export function splitUrl(url: string): { base: string; query: string; hash: string } {
  const h = url.indexOf('#');
  const hash = h >= 0 ? url.slice(h) : '';
  const rest = h >= 0 ? url.slice(0, h) : url;
  const q = rest.indexOf('?');
  return q >= 0 ? { base: rest.slice(0, q), query: rest.slice(q + 1), hash } : { base: rest, query: '', hash };
}

const encodePart = (s: string) =>
  s
    .split(/(\{\{[^{}]*\}\})/)
    .map((seg, i) => (i % 2 ? seg : encodeURIComponent(seg)))
    .join('');

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s.replaceAll('+', ' '));
  } catch {
    return s;
  }
};

export function buildQuery(params: KV[]): string {
  return params
    .filter((p) => p.enabled && p.key !== '')
    .map((p) => (p.value === '' ? encodePart(p.key) : `${encodePart(p.key)}=${encodePart(p.value)}`))
    .join('&');
}

/** Añade `extra` (p. ej. `k=v`) al final de la query existente, antes del #hash. */
export function appendQuery(url: string, extra: string): string {
  const { base, query, hash } = splitUrl(url);
  return `${base}?${[query, extra].filter(Boolean).join('&')}${hash}`;
}

/** Nueva URL con la query reconstruida desde la tabla de parámetros. */
export function urlWithParams(url: string, params: KV[]): string {
  const { base, hash } = splitUrl(url);
  const q = buildQuery(params);
  return base + (q ? `?${q}` : '') + hash;
}

/** Tabla de parámetros a partir de la URL, conservando ids/descripciones y los deshabilitados. */
export function paramsFromUrl(url: string, existing: KV[]): KV[] {
  const { query } = splitUrl(url);
  const parsed = query
    .split('&')
    .filter((s) => s !== '')
    .map((pair) => {
      const i = pair.indexOf('=');
      return i >= 0 ? [safeDecode(pair.slice(0, i)), safeDecode(pair.slice(i + 1))] : [safeDecode(pair), ''];
    });
  const enabled = existing.filter((p) => p.enabled);
  const disabled = existing.filter((p) => !p.enabled);
  const next = parsed.map(([key, value], i) => {
    const prev = enabled[i];
    return prev ? { ...prev, key, value } : newKV(key, value);
  });
  return [...next, ...disabled];
}

// ── Construcción de la petición para el motor ───────────────────────────
function basicToken(user: string, pass: string): string {
  const bytes = new TextEncoder().encode(`${user}:${pass}`);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCodePoint(b)));
  return btoa(bin);
}

function authHeader(auth: AuthModel, vars: Vars): { key: string; value: string } | null {
  switch (auth.type) {
    case 'basic':
      return { key: 'Authorization', value: `Basic ${basicToken(interpolate(auth.username, vars), interpolate(auth.password, vars))}` };
    case 'bearer':
      return auth.token ? { key: 'Authorization', value: `Bearer ${interpolate(auth.token, vars)}` } : null;
    case 'apikey':
      return auth.in === 'header' && auth.key ? { key: interpolate(auth.key, vars), value: interpolate(auth.value, vars) } : null;
    default:
      return null;
  }
}

export interface BuildOptions {
  vars: Vars;
  timeoutMs?: number;
  followRedirects?: boolean;
  verifyTls?: boolean;
  execId?: string;
}

export function buildEngineRequest(req: RequestModel, o: BuildOptions): EngineRequest {
  const { vars } = o;
  let url = interpolate(req.url.trim(), vars);

  if (req.auth.type === 'apikey' && req.auth.in === 'query' && req.auth.key) {
    const extra = `${encodePart(interpolate(req.auth.key, vars))}=${encodePart(interpolate(req.auth.value, vars))}`;
    url = appendQuery(url, extra);
  }

  const headers = req.headers
    .filter((h) => h.enabled && h.key.trim() !== '')
    .map((h) => ({ key: interpolate(h.key, vars), value: interpolate(h.value, vars) }));
  const ah = authHeader(req.auth, vars);
  if (ah && !headers.some((h) => h.key.toLowerCase() === ah.key.toLowerCase())) headers.push(ah);

  const b = req.body;
  let body: EngineBody = { type: 'none' };
  if (b.mode === 'json') body = { type: 'raw', content: interpolate(b.json, vars), contentType: 'application/json' };
  else if (b.mode === 'raw') body = { type: 'raw', content: interpolate(b.raw, vars), contentType: b.rawType };
  else if (b.mode === 'urlencoded')
    body = {
      type: 'form',
      fields: b.urlencoded.filter((f) => f.enabled && f.key !== '').map((f) => ({ key: interpolate(f.key, vars), value: interpolate(f.value, vars) })),
    };
  else if (b.mode === 'form-data')
    body = {
      type: 'multipart',
      fields: b.formData
        .filter((f) => f.enabled && f.key !== '')
        .map((f) => ({ key: interpolate(f.key, vars), value: interpolate(f.value, vars), kind: f.kind })),
    };

  return {
    id: o.execId ?? uid(),
    method: req.method,
    url,
    headers,
    body,
    options: {
      timeoutMs: o.timeoutMs && o.timeoutMs > 0 ? o.timeoutMs : undefined,
      followRedirects: o.followRedirects ?? true,
      verifyTls: o.verifyTls ?? true,
    },
  };
}

// ── cURL ────────────────────────────────────────────────────────────────
const SQ_ESCAPE = String.raw`'\''`;
const q = (s: string) => `'${s.replaceAll("'", SQ_ESCAPE)}'`;

function curlBodyArgs(req: EngineRequest): string[] {
  const b = req.body;
  if (b.type === 'raw') {
    const needsType = b.contentType && !req.headers.some((h) => h.key.toLowerCase() === 'content-type');
    return [...(needsType ? ['-H', q(`Content-Type: ${b.contentType}`)] : []), '--data-raw', q(b.content)];
  }
  if (b.type === 'form') return b.fields.flatMap((f) => ['--data-urlencode', q(`${f.key}=${f.value}`)]);
  if (b.type === 'multipart') return b.fields.flatMap((f) => ['-F', q(f.kind === 'file' ? `${f.key}=@${f.value}` : `${f.key}=${f.value}`)]);
  return [];
}

export function toCurl(req: EngineRequest): string {
  const parts = ['curl'];
  if (req.method !== 'GET') parts.push('-X', req.method);
  parts.push(q(req.url));
  for (const h of req.headers) parts.push('-H', q(`${h.key}: ${h.value}`));
  parts.push(...curlBodyArgs(req));
  if (!req.options.followRedirects) parts.push('--max-redirs', '0');
  else parts.push('-L');
  if (!req.options.verifyTls) parts.push('-k');
  return parts.join(' ');
}

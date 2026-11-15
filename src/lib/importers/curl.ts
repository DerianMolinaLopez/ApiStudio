import { appendQuery, newKV, newRequest, paramsFromUrl } from '../request';
import type { FormItem, KV, Method, RequestModel } from '../types';
import { METHODS } from '../types';

// ── Tokenizador de shell ────────────────────────────────────────────────
const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r' };

/** Lee un literal entre comillas simples (o $'…' con escapes). Devuelve el texto y el índice de la comilla de cierre. */
function readSingleQuoted(s: string, start: number, ansi: boolean): [string, number] {
  let out = '';
  let i = start;
  while (i < s.length && s[i] !== "'") {
    if (ansi && s[i] === '\\' && i + 1 < s.length) {
      const n = s[++i];
      out += ESCAPES[n] ?? n;
    } else out += s[i];
    i++;
  }
  return [out, i];
}

function readDoubleQuoted(s: string, start: number): [string, number] {
  let out = '';
  let i = start;
  while (i < s.length && s[i] !== '"') {
    if (s[i] === '\\' && i + 1 < s.length && '"\\$`'.includes(s[i + 1])) i++;
    out += s[i++];
  }
  return [out, i];
}

/** Divide un comando de shell respetando comillas simples/dobles, $'…' y continuaciones de línea. */
export function tokenize(input: string): string[] {
  const s = input.replace(/\\\r?\n/g, ' ').trim();
  const out: string[] = [];
  let cur = '';
  let has = false;
  const flush = () => {
    if (has) out.push(cur);
    cur = '';
    has = false;
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    let next = i + 1;
    if (c === "'" || (c === '$' && s[i + 1] === "'")) {
      const ansi = c === '$';
      const [text, end] = readSingleQuoted(s, i + (ansi ? 2 : 1), ansi);
      cur += text;
      has = true;
      next = end + 1;
    } else if (c === '"') {
      const [text, end] = readDoubleQuoted(s, i + 1);
      cur += text;
      has = true;
      next = end + 1;
    } else if (c === '\\' && i + 1 < s.length) {
      cur += s[i + 1];
      has = true;
      next = i + 2;
    } else if (/\s/.test(c)) {
      flush();
    } else {
      cur += c;
      has = true;
    }
    i = next;
  }
  flush();
  return out;
}

// ── Argumentos de curl ──────────────────────────────────────────────────
interface CurlArgs {
  method: string | null;
  url: string;
  headers: [string, string][];
  data: string[];
  urlencoded: string[];
  form: string[];
  user: string | null;
  head: boolean;
  getMode: boolean;
}

const addHeader = (a: CurlArgs, h: string) => {
  const k = h.indexOf(':');
  if (k > 0) a.headers.push([h.slice(0, k).trim(), h.slice(k + 1).trim()]);
};
const addData = (a: CurlArgs, v: string) => {
  a.data.push(v);
};
const addUrlEncoded = (a: CurlArgs, v: string) => {
  a.urlencoded.push(v);
};
const addCookie = (a: CurlArgs, v: string) => {
  a.headers.push(['Cookie', v]);
};
const addUserAgent = (a: CurlArgs, v: string) => {
  a.headers.push(['User-Agent', v]);
};
const setMethod = (a: CurlArgs, v: string) => {
  a.method = v.toUpperCase();
};
const setUser = (a: CurlArgs, v: string) => {
  a.user = v;
};
const addForm = (a: CurlArgs, v: string) => {
  a.form.push(v);
};
const setUrl = (a: CurlArgs, v: string) => {
  a.url = v;
};

/** Banderas que consumen un valor y lo aplican a los argumentos. */
const VALUE_FLAGS: Record<string, (a: CurlArgs, v: string) => void> = {
  '-X': setMethod, '--request': setMethod,
  '-H': addHeader, '--header': addHeader,
  '-d': addData, '--data': addData, '--data-raw': addData, '--data-binary': addData, '--data-ascii': addData,
  '--data-urlencode': addUrlEncoded,
  '-F': addForm, '--form': addForm,
  '-u': setUser, '--user': setUser,
  '-b': addCookie, '--cookie': addCookie,
  '-A': addUserAgent, '--user-agent': addUserAgent,
  '--url': setUrl,
};

/** Banderas booleanas que sí nos importan. */
const SWITCH_FLAGS: Record<string, (a: CurlArgs) => void> = {
  '-I': (a) => { a.head = true; }, '--head': (a) => { a.head = true; },
  '-G': (a) => { a.getMode = true; }, '--get': (a) => { a.getMode = true; },
};

/** Banderas con valor que se ignoran (se descarta su argumento). */
const IGNORED_WITH_VALUE = new Set([
  '-o', '--output', '-m', '--max-time', '--connect-timeout', '--max-redirs', '-w', '--write-out', '-e', '--referer',
  '--proxy', '-x', '--cacert', '--cert', '--key', '-K',
]);

function parseArgs(t: string[]): CurlArgs {
  const a: CurlArgs = { method: null, url: '', headers: [], data: [], urlencoded: [], form: [], user: null, head: false, getMode: false };
  const args = t.slice(1);
  let idx = 0;
  const take = () => args[idx++] ?? '';
  while (idx < args.length) {
    const flag = take();
    if (!flag.startsWith('-')) {
      a.url ||= flag;
      continue;
    }
    const withValue = VALUE_FLAGS[flag];
    if (withValue) withValue(a, take());
    else if (flag.startsWith('-X') && flag.length > 2) setMethod(a, flag.slice(2));
    else if (SWITCH_FLAGS[flag]) SWITCH_FLAGS[flag](a);
    else if (IGNORED_WITH_VALUE.has(flag)) take();
    // el resto (-s, -L, -k, --compressed…) no afecta a la solicitud
  }
  return a;
}

// ── Construcción de la solicitud ────────────────────────────────────────
function inferMethod(a: CurlArgs, hasBody: boolean): Method {
  const m = a.method ?? (a.head ? 'HEAD' : defaultMethod(hasBody && !a.getMode));
  return METHODS.includes(m as Method) ? (m as Method) : 'GET';
}
const defaultMethod = (sendsBody: boolean) => (sendsBody ? 'POST' : 'GET');

function applyHeadersAndAuth(req: RequestModel, a: CurlArgs): void {
  const keep: [string, string][] = [];
  for (const [k, v] of a.headers) {
    const lk = k.toLowerCase();
    if (lk === 'authorization' && /^bearer\s+/i.test(v)) req.auth = { type: 'bearer', token: v.replace(/^bearer\s+/i, '') };
    else if (lk === 'content-type' && /json/i.test(v) && a.data.length) continue; // lo fija el modo JSON
    else keep.push([k, v]);
  }
  if (a.user !== null) {
    const i = a.user.indexOf(':');
    req.auth = { type: 'basic', username: i >= 0 ? a.user.slice(0, i) : a.user, password: i >= 0 ? a.user.slice(i + 1) : '' };
  }
  req.headers = keep.map(([k, v]) => newKV(k, v));
}

const decodeForm = (x: string): string => {
  try {
    return decodeURIComponent(x.replaceAll('+', ' '));
  } catch {
    return x;
  }
};

function pairToKV(p: string): KV {
  const i = p.indexOf('=');
  return i >= 0 ? newKV(decodeForm(p.slice(0, i)), decodeForm(p.slice(i + 1))) : newKV(decodeForm(p), '');
}

function formPartToItem(f: string): FormItem {
  const i = f.indexOf('=');
  const key = i >= 0 ? f.slice(0, i) : f;
  const val = i >= 0 ? f.slice(i + 1) : '';
  return val.startsWith('@') ? { ...newKV(key, val.slice(1)), kind: 'file' } : { ...newKV(key, val), kind: 'text' };
}

const isJsonText = (t: string): boolean => {
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
};

function rawTypeOf(ct: string): string {
  if (/xml/i.test(ct)) return 'application/xml';
  return /html/i.test(ct) ? 'text/html' : 'text/plain';
}

function applyDataBody(req: RequestModel, data: string[], ct: string): void {
  const body = data.join('&');
  if (/json/i.test(ct) || isJsonText(body)) {
    req.body.mode = 'json';
    req.body.json = body;
    return;
  }
  req.body.mode = 'raw';
  req.body.raw = body;
  req.body.rawType = rawTypeOf(ct);
}

function applyBody(req: RequestModel, a: CurlArgs, ct: string): void {
  if (a.getMode && (a.data.length || a.urlencoded.length)) {
    req.url = appendQuery(req.url, [...a.data, ...a.urlencoded].join('&'));
  } else if (a.form.length) {
    req.body.mode = 'form-data';
    req.body.formData = a.form.map(formPartToItem);
  } else if (a.urlencoded.length || (a.data.length && /x-www-form-urlencoded/i.test(ct))) {
    req.body.mode = 'urlencoded';
    req.body.urlencoded = (a.urlencoded.length ? a.urlencoded : a.data.join('&').split('&')).filter(Boolean).map(pairToKV);
  } else if (a.data.length) {
    applyDataBody(req, a.data, ct);
  }
}

function nameFor(req: RequestModel): string {
  try {
    const u = new URL(req.url.replace(/\{\{[^{}]*\}\}/g, 'x'));
    return `${req.method} ${u.pathname === '/' ? u.host : u.pathname}`;
  } catch {
    return `${req.method} solicitud`;
  }
}

/** Convierte un comando `curl …` en una solicitud. Lanza Error si no es un cURL válido. */
export function parseCurl(command: string): RequestModel {
  const t = tokenize(command);
  if (t[0] !== 'curl') throw new Error('El texto no empieza con «curl».');
  const a = parseArgs(t);
  if (!a.url) throw new Error('No se encontró la URL en el comando cURL.');

  const hasBody = a.data.length > 0 || a.urlencoded.length > 0 || a.form.length > 0;
  const req = newRequest({ method: inferMethod(a, hasBody), url: a.url });
  const ct = a.headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '';

  applyHeadersAndAuth(req, a);
  applyBody(req, a, ct);
  req.params = paramsFromUrl(req.url, []);
  req.name = nameFor(req);
  return req;
}

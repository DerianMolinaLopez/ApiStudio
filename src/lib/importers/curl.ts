import { newKV, newRequest, paramsFromUrl, splitUrl } from '../request';
import type { Method, RequestModel } from '../types';
import { METHODS } from '../types';

/** Divide un comando de shell respetando comillas simples/dobles, $'…' y continuaciones de línea. */
export function tokenize(input: string): string[] {
  const s = input.replace(/\\\r?\n/g, ' ').trim();
  const out: string[] = [];
  let cur = '';
  let has = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || (c === '$' && s[i + 1] === "'")) {
      const ansi = c === '$';
      i += ansi ? 2 : 1;
      has = true;
      while (i < s.length && s[i] !== "'") {
        if (ansi && s[i] === '\\' && i + 1 < s.length) {
          const n = s[++i];
          cur += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n;
        } else cur += s[i];
        i++;
      }
    } else if (c === '"') {
      i++;
      has = true;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\' && i + 1 < s.length && '"\\$`'.includes(s[i + 1])) i++;
        cur += s[i++];
      }
    } else if (c === '\\' && i + 1 < s.length) {
      cur += s[++i];
      has = true;
    } else if (/\s/.test(c)) {
      if (has) out.push(cur);
      cur = '';
      has = false;
    } else {
      cur += c;
      has = true;
    }
  }
  if (has) out.push(cur);
  return out;
}

const DATA_FLAGS = new Set(['-d', '--data', '--data-raw', '--data-binary', '--data-ascii']);

/** Convierte un comando `curl …` en una solicitud. Lanza Error si no es un cURL válido. */
export function parseCurl(command: string): RequestModel {
  const t = tokenize(command);
  if (t[0] !== 'curl') throw new Error('El texto no empieza con «curl».');

  let method: string | null = null;
  let url = '';
  const headers: [string, string][] = [];
  const data: string[] = [];
  const urlencoded: string[] = [];
  const form: string[] = [];
  let user: string | null = null;
  let head = false;
  let getMode = false;

  for (let i = 1; i < t.length; i++) {
    const a = t[i];
    const next = () => t[++i] ?? '';
    if (a === '-X' || a === '--request') method = next().toUpperCase();
    else if (a.startsWith('-X') && a.length > 2) method = a.slice(2).toUpperCase();
    else if (a === '-H' || a === '--header') {
      const h = next();
      const k = h.indexOf(':');
      if (k > 0) headers.push([h.slice(0, k).trim(), h.slice(k + 1).trim()]);
    } else if (DATA_FLAGS.has(a)) data.push(next());
    else if (a === '--data-urlencode') urlencoded.push(next());
    else if (a === '-F' || a === '--form') form.push(next());
    else if (a === '-u' || a === '--user') user = next();
    else if (a === '-b' || a === '--cookie') headers.push(['Cookie', next()]);
    else if (a === '-A' || a === '--user-agent') headers.push(['User-Agent', next()]);
    else if (a === '-I' || a === '--head') head = true;
    else if (a === '-G' || a === '--get') getMode = true;
    else if (a === '--url') url = next();
    else if (['-o', '--output', '-m', '--max-time', '--connect-timeout', '--max-redirs', '-w', '--write-out', '-e', '--referer', '--proxy', '-x', '--cacert', '--cert', '--key', '-K'].includes(a)) next();
    else if (a.startsWith('-')) continue; // banderas sin argumento (-s, -L, -k, --compressed…)
    else if (!url) url = a;
  }
  if (!url) throw new Error('No se encontró la URL en el comando cURL.');

  const hasBody = data.length > 0 || urlencoded.length > 0 || form.length > 0;
  let m = (method ?? (head ? 'HEAD' : hasBody && !getMode ? 'POST' : 'GET')) as Method;
  if (!METHODS.includes(m)) m = 'GET';

  const req = newRequest({ method: m, url });
  const ct = headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '';
  const keep: [string, string][] = [];

  for (const [k, v] of headers) {
    const lk = k.toLowerCase();
    if (lk === 'authorization' && /^bearer\s+/i.test(v)) req.auth = { type: 'bearer', token: v.replace(/^bearer\s+/i, '') };
    else if (lk === 'content-type' && /json/i.test(v) && data.length) continue; // lo fija el modo JSON
    else keep.push([k, v]);
  }
  if (user !== null) {
    const i = user.indexOf(':');
    req.auth = { type: 'basic', username: i >= 0 ? user.slice(0, i) : user, password: i >= 0 ? user.slice(i + 1) : '' };
  }
  req.headers = keep.map(([k, v]) => newKV(k, v));

  if (getMode && (data.length || urlencoded.length)) {
    const extra = [...data, ...urlencoded].join('&');
    const { base, query, hash } = splitUrl(req.url);
    req.url = `${base}?${query ? `${query}&` : ''}${extra}${hash}`;
  } else if (form.length) {
    req.body.mode = 'form-data';
    req.body.formData = form.map((f) => {
      const i = f.indexOf('=');
      const key = i >= 0 ? f.slice(0, i) : f;
      const val = i >= 0 ? f.slice(i + 1) : '';
      return val.startsWith('@') ? { ...newKV(key, val.slice(1)), kind: 'file' as const } : { ...newKV(key, val), kind: 'text' as const };
    });
  } else if (urlencoded.length || (data.length && /x-www-form-urlencoded/i.test(ct))) {
    const pairs = urlencoded.length ? urlencoded : data.join('&').split('&');
    req.body.mode = 'urlencoded';
    req.body.urlencoded = pairs
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf('=');
        const dec = (x: string) => { try { return decodeURIComponent(x.replace(/\+/g, ' ')); } catch { return x; } };
        return i >= 0 ? newKV(dec(p.slice(0, i)), dec(p.slice(i + 1))) : newKV(dec(p), '');
      });
  } else if (data.length) {
    const body = data.join('&');
    let isJson = /json/i.test(ct);
    if (!isJson) { try { JSON.parse(body); isJson = true; } catch { /* no es JSON */ } }
    if (isJson) {
      req.body.mode = 'json';
      req.body.json = body;
    } else {
      req.body.mode = 'raw';
      req.body.raw = body;
      req.body.rawType = /xml/i.test(ct) ? 'application/xml' : /html/i.test(ct) ? 'text/html' : 'text/plain';
    }
  }

  req.params = paramsFromUrl(req.url, []);
  try {
    const u = new URL(req.url.replace(/\{\{[^}]*\}\}/g, 'x'));
    req.name = `${req.method} ${u.pathname === '/' ? u.host : u.pathname}`;
  } catch {
    req.name = `${req.method} solicitud`;
  }
  return req;
}

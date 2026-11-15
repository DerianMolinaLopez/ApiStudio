import { uid } from '../id';
import { newKV, newRequest, paramsFromUrl } from '../request';
import type { AuthModel, FormItem, KV, Method, RequestModel } from '../types';
import { METHODS } from '../types';
import type { Environment } from '../stores/environments.svelte';

/** Árbol neutro entre formatos de colección. */
export type ImportNode =
  | { type: 'folder'; name: string; children: ImportNode[] }
  | { type: 'request'; name: string; request: RequestModel };

export interface ImportedCollection { name: string; children: ImportNode[] }

type Any = Record<string, any>;

const kvList = (list: Any[] | undefined): KV[] =>
  (list ?? []).map((h) => ({ ...newKV(String(h.key ?? ''), String(h.value ?? ''), !h.disabled), description: String(h.description ?? '') }));

const pmGet = (list: Any[] | undefined, key: string): string => String((list ?? []).find((x) => x.key === key)?.value ?? '');

function importAuth(a: Any | undefined): AuthModel {
  if (!a) return { type: 'none' };
  if (a.type === 'bearer') return { type: 'bearer', token: pmGet(a.bearer, 'token') };
  if (a.type === 'basic') return { type: 'basic', username: pmGet(a.basic, 'username'), password: pmGet(a.basic, 'password') };
  if (a.type === 'apikey') return { type: 'apikey', key: pmGet(a.apikey, 'key'), value: pmGet(a.apikey, 'value'), in: pmGet(a.apikey, 'in') === 'query' ? 'query' : 'header' };
  return { type: 'none' };
}

const RAW_TYPES: Record<string, string> = { xml: 'application/xml', html: 'text/html', javascript: 'application/javascript' };

function importBody(req: RequestModel, b: Any | undefined): void {
  if (b?.mode === 'raw') {
    const lang = String(b.options?.raw?.language);
    if (lang === 'json') {
      req.body.mode = 'json';
      req.body.json = b.raw ?? '';
    } else {
      req.body.mode = 'raw';
      req.body.raw = b.raw ?? '';
      req.body.rawType = RAW_TYPES[lang] ?? 'text/plain';
    }
  } else if (b?.mode === 'urlencoded') {
    req.body.mode = 'urlencoded';
    req.body.urlencoded = kvList(b.urlencoded);
  } else if (b?.mode === 'formdata') {
    req.body.mode = 'form-data';
    req.body.formData = (b.formdata ?? []).map((f: Any): FormItem => ({
      ...newKV(String(f.key ?? ''), String(f.type === 'file' ? (f.src ?? '') : (f.value ?? '')), !f.disabled),
      kind: f.type === 'file' ? 'file' : 'text',
    }));
  }
}

function importRequest(name: string, r: Any): RequestModel {
  const raw = typeof r.url === 'string' ? r.url : (r.url?.raw ?? '');
  const method = String(r.method ?? 'GET').toUpperCase() as Method;
  const req = newRequest({ name, method: METHODS.includes(method) ? method : 'GET', url: raw, headers: kvList(r.header), auth: importAuth(r.auth) });
  req.params = paramsFromUrl(raw, []);
  importBody(req, r.body);
  return req;
}

function importItems(items: Any[]): ImportNode[] {
  return items.map((it) =>
    Array.isArray(it.item)
      ? { type: 'folder' as const, name: String(it.name ?? 'Carpeta'), children: importItems(it.item) }
      : { type: 'request' as const, name: String(it.name ?? 'Solicitud'), request: importRequest(String(it.name ?? 'Solicitud'), it.request ?? {}) },
  );
}

export const isPostmanCollection = (j: Any) => Array.isArray(j?.item) && typeof j?.info === 'object';
export const isPostmanEnvironment = (j: Any) => Array.isArray(j?.values) && typeof j?.name === 'string';

export function importPostmanCollection(j: Any): ImportedCollection {
  if (!isPostmanCollection(j)) throw new Error('No es una colección de Postman válida (v2.0/v2.1).');
  return { name: String(j.info.name ?? 'Colección importada'), children: importItems(j.item) };
}

export function importPostmanEnvironment(j: Any): Environment {
  if (!isPostmanEnvironment(j)) throw new Error('No es un entorno de Postman válido.');
  return {
    id: uid(),
    name: j.name,
    variables: j.values.map((v: Any) => newKV(String(v.key ?? ''), String(v.value ?? ''), v.enabled !== false)),
  };
}

// ── Exportación ─────────────────────────────────────────────────────────
const pmKV = (l: KV[]) => l.filter((x) => x.key !== '').map((x) => ({ key: x.key, value: x.value, ...(x.enabled ? {} : { disabled: true }), ...(x.description ? { description: x.description } : {}) }));

function exportAuth(a: AuthModel): Any | undefined {
  switch (a.type) {
    case 'bearer': return { type: 'bearer', bearer: [{ key: 'token', value: a.token, type: 'string' }] };
    case 'basic': return { type: 'basic', basic: [{ key: 'username', value: a.username, type: 'string' }, { key: 'password', value: a.password, type: 'string' }] };
    case 'apikey': return { type: 'apikey', apikey: [{ key: 'key', value: a.key }, { key: 'value', value: a.value }, { key: 'in', value: a.in }] };
    default: return undefined;
  }
}

const rawLanguage = (rawType: string): string => ['xml', 'html', 'javascript'].find((l) => rawType.includes(l)) ?? 'text';

function exportRequest(r: RequestModel): Any {
  const b = r.body;
  let body: Any | undefined;
  if (b.mode === 'json') body = { mode: 'raw', raw: b.json, options: { raw: { language: 'json' } } };
  else if (b.mode === 'raw') body = { mode: 'raw', raw: b.raw, options: { raw: { language: rawLanguage(b.rawType) } } };
  else if (b.mode === 'urlencoded') body = { mode: 'urlencoded', urlencoded: pmKV(b.urlencoded) };
  else if (b.mode === 'form-data')
    body = { mode: 'formdata', formdata: b.formData.filter((f) => f.key).map((f) => ({ key: f.key, type: f.kind, ...(f.kind === 'file' ? { src: f.value } : { value: f.value }), ...(f.enabled ? {} : { disabled: true }) })) };
  return { method: r.method, header: pmKV(r.headers), url: { raw: r.url }, ...(body ? { body } : {}), ...(exportAuth(r.auth) ? { auth: exportAuth(r.auth) } : {}) };
}

function exportNodes(nodes: ImportNode[]): Any[] {
  return nodes.map((n) => (n.type === 'folder' ? { name: n.name, item: exportNodes(n.children) } : { name: n.name, request: exportRequest(n.request) }));
}

export function exportPostmanCollection(c: ImportedCollection): Any {
  return {
    info: { name: c.name, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: exportNodes(c.children),
  };
}

import { newKV, newRequest } from '../request';
import type { AuthModel, FormItem, KV, Method, RequestModel } from '../types';
import { METHODS } from '../types';
import { uid } from '../id';
import type { Environment } from '../stores/environments.svelte';
import type { ImportNode, ImportedCollection } from './postman';

type Any = Record<string, any>;

export interface ImportedOpenApi {
  collection: ImportedCollection;
  environment: Environment | null;
  warnings: string[];
  endpoints: number;
}

const MAX_DEPTH = 6;
const MAX_REF_CHAIN = 20;
const DEFAULT_BASE_URL = 'http://localhost';
const IGNORED_HEADERS = new Set(['accept', 'content-type', 'authorization']);

export const isOpenApi = (j: Any): boolean =>
  !!j && typeof j === 'object' && (typeof j.openapi === 'string' || typeof j.swagger === 'string') && typeof j.paths === 'object' && j.paths !== null;

const isObj = (v: unknown): v is Any => typeof v === 'object' && v !== null && !Array.isArray(v);
const own = (o: Any, k: string): boolean => Object.hasOwn(o, k);

// ── $ref locales ────────────────────────────────────────────────────────
interface Ctx {
  doc: Any;
  warnings: Set<string>;
  vars: Map<string, string>;
}

function lookup(doc: Any, ref: string): Any | undefined {
  if (!ref.startsWith('#/')) return undefined;
  let cur: unknown = doc;
  for (const raw of ref.slice(2).split('/')) {
    let key = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    try {
      key = decodeURIComponent(key);
    } catch {
      /* se usa tal cual */
    }
    if (!isObj(cur) || !own(cur, key)) return undefined;
    cur = cur[key];
  }
  return isObj(cur) ? cur : undefined;
}

/** Sigue una cadena de `$ref` hasta el objeto real. Devuelve `undefined` si no se puede resolver. */
function deref(ctx: Ctx, node: unknown): Any | undefined {
  let cur = node;
  for (let i = 0; i < MAX_REF_CHAIN; i++) {
    if (!isObj(cur)) return undefined;
    if (typeof cur.$ref !== 'string') return cur;
    const target = lookup(ctx.doc, cur.$ref);
    if (!target) {
      ctx.warnings.add(cur.$ref.startsWith('#/') ? `Referencia no encontrada: ${cur.$ref}` : `Referencia externa ignorada: ${cur.$ref}`);
      return undefined;
    }
    cur = target;
  }
  ctx.warnings.add('Cadena de referencias demasiado larga o circular');
  return undefined;
}

// ── Ejemplos desde esquemas ─────────────────────────────────────────────
const FORMATS: Record<string, string> = {
  'date-time': '2024-01-01T00:00:00Z',
  date: '2024-01-01',
  time: '00:00:00',
  uuid: '00000000-0000-0000-0000-000000000000',
  email: 'user@example.com',
  uri: 'https://example.com',
  url: 'https://example.com',
  hostname: 'example.com',
  ipv4: '127.0.0.1',
  password: 'string',
  byte: 'c3RyaW5n',
};

function scalarSample(s: Any): unknown {
  const type = Array.isArray(s.type) ? (s.type.find((t: string) => t !== 'null') ?? 'string') : s.type;
  if (type === 'integer' || type === 'number') return s.minimum ?? 0;
  if (type === 'boolean') return false;
  if (type === 'null') return null;
  return FORMATS[s.format] ?? 'string';
}

function declaredExample(s: Any): { found: boolean; value?: unknown } {
  if (own(s, 'example')) return { found: true, value: s.example };
  if (Array.isArray(s.examples) && s.examples.length) return { found: true, value: s.examples[0] };
  if (own(s, 'default')) return { found: true, value: s.default };
  if (Array.isArray(s.enum) && s.enum.length) return { found: true, value: s.enum[0] };
  return { found: false };
}

function mergeAllOf(ctx: Ctx, s: Any, seen: Set<string>, depth: number): Any {
  const props: [string, unknown][] = [];
  for (const part of s.allOf as unknown[]) {
    const r = deref(ctx, part);
    if (!r) continue;
    const sub = Array.isArray(r.allOf) ? mergeAllOf(ctx, r, seen, depth) : r;
    if (isObj(sub.properties)) props.push(...Object.entries(sub.properties));
  }
  if (isObj(s.properties)) props.push(...Object.entries(s.properties));
  return { type: 'object', properties: Object.fromEntries(props) };
}

function objectSample(ctx: Ctx, s: Any, seen: Set<string>, depth: number): Any {
  const entries = Object.entries(s.properties as Any)
    .filter(([, v]) => !(isObj(v) && v.readOnly === true))
    .map(([k, v]) => [k, sample(ctx, v, seen, depth + 1)] as [string, unknown]);
  return Object.fromEntries(entries);
}

function sample(ctx: Ctx, node: unknown, seen: Set<string>, depth: number): unknown {
  if (depth > MAX_DEPTH) return null;
  const refKey = isObj(node) && typeof node.$ref === 'string' ? node.$ref : null;
  if (refKey && seen.has(refKey)) return null; // ciclo
  const s = deref(ctx, node);
  if (!s) return null;
  const nextSeen = refKey ? new Set(seen).add(refKey) : seen;

  const declared = declaredExample(s);
  if (declared.found) return declared.value;
  if (Array.isArray(s.allOf)) return sample(ctx, mergeAllOf(ctx, s, nextSeen, depth), nextSeen, depth);
  const alt = [...(Array.isArray(s.oneOf) ? s.oneOf : []), ...(Array.isArray(s.anyOf) ? s.anyOf : [])][0];
  if (alt) return sample(ctx, alt, nextSeen, depth + 1);
  if (isObj(s.properties) || s.type === 'object') return isObj(s.properties) ? objectSample(ctx, s, nextSeen, depth) : {};
  if (s.type === 'array' || s.items) return s.items ? [sample(ctx, s.items, nextSeen, depth + 1)] : [];
  return scalarSample(s);
}

const asText = (v: unknown): string => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

// ── Servidores ──────────────────────────────────────────────────────────
function oas3BaseUrl(servers: unknown): string | null {
  const first = Array.isArray(servers) ? servers[0] : undefined;
  if (!isObj(first) || typeof first.url !== 'string') return null;
  const vars = isObj(first.variables) ? first.variables : {};
  return first.url.replace(/\{([^{}]+)\}/g, (m: string, name: string) => (isObj(vars[name]) ? String(vars[name].default ?? m) : m));
}

function swagger2BaseUrl(doc: Any): string | null {
  if (typeof doc.host !== 'string') return null;
  const scheme = Array.isArray(doc.schemes) && doc.schemes.length ? doc.schemes[0] : 'https';
  const base = typeof doc.basePath === 'string' ? doc.basePath.replace(/\/$/, '') : '';
  return `${scheme}://${doc.host}${base}`;
}

function resolveBaseUrl(ctx: Ctx): string {
  const url = (ctx.doc.swagger ? swagger2BaseUrl(ctx.doc) : oas3BaseUrl(ctx.doc.servers)) ?? '';
  if (/^https?:\/\//i.test(url)) return url.replace(/\/$/, '');
  ctx.warnings.add(url ? `La URL base «${url}» es relativa: ajusta la variable baseUrl del entorno` : 'El archivo no define servidor: ajusta la variable baseUrl del entorno');
  return DEFAULT_BASE_URL + (url.startsWith('/') ? url.replace(/\/$/, '') : '');
}

// ── Autenticación ───────────────────────────────────────────────────────
function useVar(ctx: Ctx, name: string, value = ''): string {
  if (!ctx.vars.has(name)) ctx.vars.set(name, value);
  return `{{${name}}}`;
}

function schemeToAuth(ctx: Ctx, s: Any): AuthModel {
  const type = String(s.type);
  if (type === 'http') {
    if (String(s.scheme).toLowerCase() === 'basic') return { type: 'basic', username: useVar(ctx, 'username'), password: useVar(ctx, 'password') };
    return { type: 'bearer', token: useVar(ctx, 'token') };
  }
  if (type === 'basic') return { type: 'basic', username: useVar(ctx, 'username'), password: useVar(ctx, 'password') };
  if (type === 'apiKey' && (s.in === 'header' || s.in === 'query')) {
    return { type: 'apikey', key: String(s.name ?? 'X-API-Key'), value: useVar(ctx, 'apiKey'), in: s.in };
  }
  if (type === 'oauth2' || type === 'openIdConnect') return { type: 'bearer', token: useVar(ctx, 'token') };
  return { type: 'none' };
}

function securitySchemes(doc: Any): Any {
  const s = isObj(doc.components) ? doc.components.securitySchemes : doc.securityDefinitions;
  return isObj(s) ? s : {};
}

function authFor(ctx: Ctx, op: Any): AuthModel {
  const reqs = Array.isArray(op.security) ? op.security : ctx.doc.security;
  if (!Array.isArray(reqs)) return { type: 'none' };
  const schemes = securitySchemes(ctx.doc);
  for (const req of reqs) {
    for (const name of isObj(req) ? Object.keys(req) : []) {
      const scheme = deref(ctx, schemes[name]);
      const auth = scheme ? schemeToAuth(ctx, scheme) : ({ type: 'none' } as AuthModel);
      if (auth.type !== 'none') return auth;
    }
  }
  return { type: 'none' };
}

// ── Parámetros ──────────────────────────────────────────────────────────
function collectParams(ctx: Ctx, pathItem: Any, op: Any): Any[] {
  const merged = new Map<string, Any>();
  for (const raw of [...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []), ...(Array.isArray(op.parameters) ? op.parameters : [])]) {
    const p = deref(ctx, raw);
    if (p && typeof p.name === 'string' && typeof p.in === 'string') merged.set(`${p.in}:${p.name}`, p);
  }
  return [...merged.values()];
}

function paramValue(ctx: Ctx, p: Any): string {
  const schema = p.schema ?? p; // Swagger 2 define el tipo en el propio parámetro
  const ex = own(p, 'example') ? p.example : sample(ctx, schema, new Set(), 0);
  return asText(ex);
}

function pathWithVars(ctx: Ctx, path: string, params: Any[]): string {
  const known = new Map(params.filter((p) => p.in === 'path').map((p) => [p.name as string, p]));
  return path.replace(/\{([^{}]+)\}/g, (_m, name: string) => {
    const p = known.get(name);
    return useVar(ctx, name, p ? paramValue(ctx, p) : '');
  });
}

function toKV(ctx: Ctx, p: Any): KV {
  return newKV(p.name, paramValue(ctx, p), p.required === true);
}

// ── Body ────────────────────────────────────────────────────────────────
function pickContentType(types: string[]): string | undefined {
  return (
    types.find((t) => t.toLowerCase().includes('json')) ??
    types.find((t) => t.includes('x-www-form-urlencoded')) ??
    types.find((t) => t.includes('multipart/form-data')) ??
    types[0]
  );
}

function formFields(ctx: Ctx, schema: unknown, multipart: boolean): FormItem[] {
  const s = deref(ctx, schema);
  const props = s && isObj(s.properties) ? Object.entries(s.properties) : [];
  return props.map(([name, raw]) => {
    const prop = deref(ctx, raw) ?? {};
    const isFile = multipart && (prop.format === 'binary' || prop.type === 'file');
    return { ...newKV(name, isFile ? '' : asText(sample(ctx, prop, new Set(), 1)), true), kind: isFile ? ('file' as const) : ('text' as const) };
  });
}

function applyBody(ctx: Ctx, req: RequestModel, contentType: string | undefined, schema: unknown): void {
  if (!contentType) return;
  const ct = contentType.toLowerCase();
  if (ct.includes('json')) {
    req.body.mode = 'json';
    req.body.json = JSON.stringify(sample(ctx, schema, new Set(), 0) ?? {}, null, 2);
  } else if (ct.includes('x-www-form-urlencoded')) {
    req.body.mode = 'urlencoded';
    req.body.urlencoded = formFields(ctx, schema, false);
  } else if (ct.includes('multipart/form-data')) {
    req.body.mode = 'form-data';
    req.body.formData = formFields(ctx, schema, true);
  } else {
    req.body.mode = 'raw';
    req.body.rawType = ct.includes('xml') ? 'application/xml' : 'text/plain';
    req.body.raw = asText(sample(ctx, schema, new Set(), 0));
  }
}

function applyOas3Body(ctx: Ctx, req: RequestModel, op: Any): void {
  const rb = deref(ctx, op.requestBody);
  const content = rb && isObj(rb.content) ? rb.content : null;
  if (!content) return;
  const ct = pickContentType(Object.keys(content));
  if (!ct) return;
  const media = isObj(content[ct]) ? content[ct] : {};
  const schema = own(media, 'example') ? { example: media.example } : media.schema;
  applyBody(ctx, req, ct, schema);
}

function applySwagger2Body(ctx: Ctx, req: RequestModel, op: Any, params: Any[]): void {
  const consumes: string[] = (Array.isArray(op.consumes) ? op.consumes : Array.isArray(ctx.doc.consumes) ? ctx.doc.consumes : []) as string[];
  const bodyParam = params.find((p) => p.in === 'body');
  const formParams = params.filter((p) => p.in === 'formData');
  if (bodyParam) return applyBody(ctx, req, pickContentType(consumes) ?? 'application/json', bodyParam.schema);
  if (!formParams.length) return;
  const hasFile = formParams.some((p) => p.type === 'file');
  const props = Object.fromEntries(formParams.map((p) => [p.name, p.type === 'file' ? { type: 'string', format: 'binary' } : p]));
  const ct = hasFile || consumes.some((c) => c.includes('multipart')) ? 'multipart/form-data' : 'application/x-www-form-urlencoded';
  applyBody(ctx, req, ct, { type: 'object', properties: props });
}

// ── Operaciones ─────────────────────────────────────────────────────────
/** Nombre legible sin «/»: el almacenamiento usa el nombre como archivo y los convertiría en «-». */
function fallbackName(method: string, path: string): string {
  const segments = path.split('/').filter(Boolean);
  return `${method} ${segments.length ? segments.join(' › ') : 'raíz'}`;
}

function operationName(op: Any, method: string, path: string): string {
  const raw = [op.summary, op.operationId].find((v) => typeof v === 'string' && v.trim() !== '');
  return (raw ?? fallbackName(method, path)).trim().slice(0, 120);
}

function buildRequest(ctx: Ctx, pathItem: Any, path: string, method: Method, op: Any): RequestModel {
  const params = collectParams(ctx, pathItem, op);
  const req = newRequest({
    name: operationName(op, method, path),
    method,
    url: `{{baseUrl}}${pathWithVars(ctx, path, params)}`,
    auth: authFor(ctx, op),
  });
  req.params = params.filter((p) => p.in === 'query').map((p) => toKV(ctx, p));
  req.headers = params.filter((p) => p.in === 'header' && !IGNORED_HEADERS.has(String(p.name).toLowerCase())).map((p) => toKV(ctx, p));
  if (ctx.doc.swagger) applySwagger2Body(ctx, req, op, params);
  else applyOas3Body(ctx, req, op);
  const q = req.params.filter((p) => p.enabled);
  if (q.length) req.url += `?${q.map((p) => (p.value === '' ? p.key : `${p.key}=${p.value}`)).join('&')}`;
  return req;
}

function operationsOf(ctx: Ctx): { path: string; item: Any; method: Method; op: Any }[] {
  const out: { path: string; item: Any; method: Method; op: Any }[] = [];
  const paths = ctx.doc.paths as Any;
  for (const path of Object.keys(paths)) {
    const item = deref(ctx, paths[path]);
    if (!item) continue;
    for (const m of METHODS) {
      const op = item[m.toLowerCase()];
      if (isObj(op)) out.push({ path, item, method: m, op });
    }
  }
  return out;
}

function tagOrder(doc: Any): string[] {
  return Array.isArray(doc.tags) ? doc.tags.filter(isObj).map((t) => String(t.name)) : [];
}

function groupByTag(ctx: Ctx, ops: ReturnType<typeof operationsOf>): ImportNode[] {
  const folders = new Map<string, ImportNode[]>(tagOrder(ctx.doc).map((t) => [t, []]));
  const root: ImportNode[] = [];
  for (const { path, item, method, op } of ops) {
    const node: ImportNode = { type: 'request', name: operationName(op, method, path), request: buildRequest(ctx, item, path, method, op) };
    const tag = Array.isArray(op.tags) && typeof op.tags[0] === 'string' ? op.tags[0] : null;
    if (!tag) root.push(node);
    else folders.set(tag, [...(folders.get(tag) ?? []), node]);
  }
  const tagged: ImportNode[] = [...folders].filter(([, c]) => c.length).map(([name, children]) => ({ type: 'folder', name, children }));
  return [...tagged, ...root];
}

/** Convierte un documento OpenAPI 3.x o Swagger 2.0 (ya parseado desde JSON) en colección + entorno. */
export function importOpenApi(doc: Any): ImportedOpenApi {
  if (!isOpenApi(doc)) throw new Error('No es un documento OpenAPI/Swagger válido (falta «openapi»/«swagger» o «paths»).');
  const ctx: Ctx = { doc, warnings: new Set(), vars: new Map() };
  const baseUrl = resolveBaseUrl(ctx);
  const ops = operationsOf(ctx);
  if (!ops.length) throw new Error('El documento no define ninguna operación en «paths».');

  const title = isObj(doc.info) && typeof doc.info.title === 'string' && doc.info.title.trim() ? doc.info.title.trim() : 'API importada';
  const children = groupByTag(ctx, ops);
  const variables = [newKV('baseUrl', baseUrl), ...[...ctx.vars].map(([k, v]) => newKV(k, v))];
  return {
    collection: { name: title, children },
    environment: { id: uid(), name: title, variables },
    warnings: [...ctx.warnings],
    endpoints: ops.length,
  };
}

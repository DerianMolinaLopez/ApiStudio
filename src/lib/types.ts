// Modelos compartidos del frontend. Los de petición/respuesta reflejan src-tauri/src/models/http.rs.

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export const METHODS: Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export interface KV {
  id: string;
  key: string;
  value: string;
  description: string;
  enabled: boolean;
}

export interface FormItem extends KV {
  kind: 'text' | 'file';
}

export type BodyMode = 'none' | 'json' | 'form-data' | 'urlencoded' | 'raw';

export interface BodyModel {
  mode: BodyMode;
  json: string;
  raw: string;
  rawType: string;
  urlencoded: KV[];
  formData: FormItem[];
}

export type AuthModel =
  | { type: 'none' }
  | { type: 'basic'; username: string; password: string }
  | { type: 'bearer'; token: string }
  | { type: 'apikey'; key: string; value: string; in: 'header' | 'query' };

export interface RequestModel {
  id: string;
  name: string;
  method: Method;
  url: string;
  params: KV[];
  headers: KV[];
  body: BodyModel;
  auth: AuthModel;
  preScript: string;
  postScript: string;
  tests: string;
}

// ── Contrato con el motor Rust ──────────────────────────────────────────
export interface Header { key: string; value: string }

export type EngineBody =
  | { type: 'none' }
  | { type: 'raw'; content: string; contentType?: string }
  | { type: 'form'; fields: Header[] }
  | { type: 'multipart'; fields: { key: string; value: string; kind: 'text' | 'file' }[] };

export interface EngineRequest {
  id: string;
  method: string;
  url: string;
  headers: Header[];
  body: EngineBody;
  options: { timeoutMs?: number; followRedirects: boolean; verifyTls: boolean };
}

export interface ResponseCookie {
  name: string;
  value: string;
  domain: string | null;
  path: string | null;
  expires: string | null;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
}

export interface EngineResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  url: string;
  headers: Header[];
  cookies: ResponseCookie[];
  body: string;
  isBinary: boolean;
  sizeBytes: number;
  timeMs: number;
  ttfbMs: number;
}

export interface AppError {
  kind: 'invalidRequest' | 'script' | 'network' | 'timeout' | 'cancelled' | 'io' | 'storage';
  message: string;
}

// ── Workspace ───────────────────────────────────────────────────────────
export type TreeNode =
  | { kind: 'folder'; name: string; path: string; children: TreeNode[] }
  | { kind: 'request'; name: string; path: string; method: Method };

export interface HistoryEntry {
  id: string;
  ts: number;
  method: Method;
  url: string;
  status: number;
  timeMs: number;
  sizeBytes: number;
  request: RequestModel;
}

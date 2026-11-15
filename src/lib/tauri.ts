import { invoke } from '@tauri-apps/api/core';
import type { AppError, EngineRequest, EngineResponse, HistoryEntry, RequestModel, TreeNode } from './types';
import type { Environment } from './stores/environments.svelte';

/** Normaliza cualquier fallo de invoke() a AppError. */
export function toAppError(e: unknown): AppError {
  if (e && typeof e === 'object' && 'kind' in e && 'message' in e) return e as AppError;
  return { kind: 'io', message: String(e) };
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw toAppError(e);
  }
}

export const engine = {
  send: (request: EngineRequest) => call<EngineResponse>('send_request', { request }),
  cancel: (id: string) => call<boolean>('cancel_request', { id }),
  clearCookies: () => call<void>('clear_cookies'),
};

export const workspace = {
  path: () => call<string>('workspace_path'),
  listTree: () => call<TreeNode[]>('list_tree'),
  createFolder: (parent: string, name: string) => call<string>('create_folder', { parent, name }),
  readRequest: (path: string) => call<Partial<RequestModel>>('read_request', { path }),
  writeRequest: (path: string, request: RequestModel) => call<void>('write_request', { path, request }),
  createRequest: (parent: string, name: string, request: RequestModel) => call<string>('create_request', { parent, name, request }),
  rename: (path: string, name: string) => call<string>('rename_node', { path, name }),
  remove: (path: string) => call<void>('delete_node', { path }),
  move: (path: string, parent: string) => call<string>('move_node', { path, parent }),
  listEnvironments: () => call<Environment[]>('list_environments'),
  writeEnvironment: (environment: Environment) => call<void>('write_environment', { environment }),
  deleteEnvironment: (id: string) => call<void>('delete_environment', { id }),
};

export const historyApi = {
  list: () => call<HistoryEntry[]>('history_list'),
  add: (entry: HistoryEntry) => call<void>('history_add', { entry }),
  remove: (id: string) => call<void>('history_delete', { id }),
  clear: () => call<void>('history_clear'),
};

export const files = {
  read: (path: string) => call<string>('read_text_file', { path }),
  write: (path: string, content: string) => call<void>('write_text_file', { path, content }),
};

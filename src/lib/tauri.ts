import { invoke } from '@tauri-apps/api/core';
import type { AppError, EngineRequest, EngineResponse } from './types';

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

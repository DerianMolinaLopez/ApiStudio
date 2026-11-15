import { uid } from '../id';
import { buildEngineRequest, newRequest } from '../request';
import { engine, toAppError } from '../tauri';
import type { AppError, EngineRequest, EngineResponse, RequestModel } from '../types';
import { activeVars } from './environments.svelte';
import { settings } from './settings.svelte';

export interface Tab {
  id: string;
  request: RequestModel;
  /** Instantánea JSON de la última versión guardada/abierta; sirve para saber si hay cambios. */
  baseline: string;
  /** Ruta de la solicitud en una colección, si está guardada. */
  ref: string | null;
  loading: boolean;
  execId: string | null;
  response: EngineResponse | null;
  sent: EngineRequest | null;
  error: AppError | null;
}

export const tabs = $state<{ items: Tab[]; activeId: string | null }>({ items: [], activeId: null });

type SentListener = (tab: Tab, sent: EngineRequest, res: EngineResponse | null, err: AppError | null) => void;
const listeners: SentListener[] = [];
/** Permite a otros módulos (historial) reaccionar a cada envío. */
export const onSent = (fn: SentListener) => void listeners.push(fn);

export const snapshot = (r: RequestModel) => JSON.stringify($state.snapshot(r));

export function activeTab(): Tab | undefined {
  return tabs.items.find((t) => t.id === tabs.activeId);
}

export function openRequest(request: RequestModel, ref: string | null = null): Tab {
  const existing = ref ? tabs.items.find((t) => t.ref === ref) : undefined;
  if (existing) {
    tabs.activeId = existing.id;
    return existing;
  }
  const tab: Tab = { id: uid(), request, baseline: snapshot(request), ref, loading: false, execId: null, response: null, sent: null, error: null };
  tabs.items.push(tab);
  tabs.activeId = tab.id;
  return tab;
}

export const newTab = () => openRequest(newRequest());

export function closeTab(id: string): void {
  const i = tabs.items.findIndex((t) => t.id === id);
  if (i < 0) return;
  const tab = tabs.items[i];
  if (tab.loading && tab.execId) void engine.cancel(tab.execId);
  tabs.items.splice(i, 1);
  if (tabs.activeId === id) tabs.activeId = (tabs.items[i] ?? tabs.items[i - 1])?.id ?? null;
}

export function markSaved(tab: Tab, ref?: string): void {
  tab.baseline = snapshot(tab.request);
  if (ref) tab.ref = ref;
}

export const isDirty = (tab: Tab) => snapshot(tab.request) !== tab.baseline;

export function buildFor(tab: Tab, execId?: string): EngineRequest {
  return buildEngineRequest(tab.request, {
    vars: activeVars(),
    timeoutMs: settings.timeoutMs,
    followRedirects: settings.followRedirects,
    verifyTls: settings.verifyTls,
    execId,
  });
}

export async function send(tab: Tab): Promise<void> {
  if (tab.loading) return;
  const execId = uid();
  const sent = buildFor(tab, execId);
  tab.loading = true;
  tab.execId = execId;
  tab.error = null;
  tab.sent = sent;
  let res: EngineResponse | null = null;
  let err: AppError | null = null;
  try {
    res = await engine.send(sent);
    tab.response = res;
  } catch (e) {
    err = toAppError(e);
    if (err.kind !== 'cancelled') {
      tab.error = err;
      tab.response = null;
    }
  } finally {
    tab.loading = false;
    tab.execId = null;
  }
  if (err?.kind !== 'cancelled') listeners.forEach((fn) => fn(tab, sent, res, err));
}

export function cancel(tab: Tab): void {
  if (tab.execId) void engine.cancel(tab.execId);
}

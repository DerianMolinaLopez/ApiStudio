import { uid } from '../id';
import { historyApi } from '../tauri';
import type { HistoryEntry } from '../types';
import { onSent } from './tabs.svelte';

export const history = $state<{ items: HistoryEntry[] }>({ items: [] });

export async function loadHistory(): Promise<void> {
  history.items = await historyApi.list();
}

export async function clearHistory(): Promise<void> {
  await historyApi.clear();
  history.items = [];
}

export async function removeHistory(id: string): Promise<void> {
  await historyApi.remove(id);
  history.items = history.items.filter((h) => h.id !== id);
}

/** Registra cada respuesta recibida (los errores de red no se guardan). */
export function trackHistory(): void {
  onSent((tab, sent, res) => {
    if (!res) return;
    const entry: HistoryEntry = {
      id: uid(),
      ts: Date.now(),
      method: tab.request.method,
      url: sent.url,
      status: res.status,
      timeMs: res.timeMs,
      sizeBytes: res.sizeBytes,
      request: $state.snapshot(tab.request) as HistoryEntry['request'],
    };
    history.items.unshift(entry);
    if (history.items.length > 300) history.items.length = 300;
    historyApi.add(entry).catch(() => {});
  });
}

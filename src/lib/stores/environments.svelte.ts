import { uid } from '../id';
import { workspace } from '../tauri';
import type { KV } from '../types';
import type { Vars } from '../request';

export interface Environment {
  id: string;
  name: string;
  variables: KV[];
}

const ACTIVE_KEY = 'api-studio:active-env';

export const envs = $state<{ items: Environment[]; activeId: string | null }>({ items: [], activeId: null });

export async function loadEnvironments(): Promise<void> {
  envs.items = await workspace.listEnvironments();
  let saved: string | null = null;
  try { saved = localStorage.getItem(ACTIVE_KEY); } catch { /* sin almacenamiento */ }
  envs.activeId = envs.items.some((e) => e.id === saved) ? saved : null;
}

export function setActiveEnvironment(id: string | null): void {
  envs.activeId = id;
  try { id ? localStorage.setItem(ACTIVE_KEY, id) : localStorage.removeItem(ACTIVE_KEY); } catch { /* sin almacenamiento */ }
}

export function activeEnv(): Environment | undefined {
  return envs.items.find((e) => e.id === envs.activeId);
}

/** Variables del entorno activo (solo las habilitadas). */
export function activeVars(): Vars {
  const out: Vars = {};
  for (const v of activeEnv()?.variables ?? []) if (v.enabled && v.key) out[v.key] = v.value;
  return out;
}

export const newEnvironment = (name = 'Nuevo entorno'): Environment => ({ id: uid(), name, variables: [] });

export async function saveEnvironment(env: Environment): Promise<void> {
  const plain = $state.snapshot(env) as Environment;
  await workspace.writeEnvironment(plain);
  const i = envs.items.findIndex((e) => e.id === plain.id);
  if (i >= 0) envs.items[i] = plain;
  else envs.items.push(plain);
  envs.items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function removeEnvironment(id: string): Promise<void> {
  await workspace.deleteEnvironment(id);
  envs.items = envs.items.filter((e) => e.id !== id);
  if (envs.activeId === id) setActiveEnvironment(null);
}

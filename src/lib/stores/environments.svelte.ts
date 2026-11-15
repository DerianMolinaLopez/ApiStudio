import { uid } from '../id';
import type { KV } from '../types';
import type { Vars } from '../request';

export interface Environment {
  id: string;
  name: string;
  variables: KV[];
}

export const envs = $state<{ items: Environment[]; activeId: string | null }>({ items: [], activeId: null });

export function activeEnv(): Environment | undefined {
  return envs.items.find((e) => e.id === envs.activeId);
}

/** Variables del entorno activo (solo las habilitadas). */
export function activeVars(): Vars {
  const out: Vars = {};
  for (const v of activeEnv()?.variables ?? []) if (v.enabled && v.key) out[v.key] = v.value;
  return out;
}

export function addEnvironment(name: string): Environment {
  const env: Environment = { id: uid(), name, variables: [] };
  envs.items.push(env);
  if (!envs.activeId) envs.activeId = env.id;
  return env;
}

export function removeEnvironment(id: string): void {
  envs.items = envs.items.filter((e) => e.id !== id);
  if (envs.activeId === id) envs.activeId = envs.items[0]?.id ?? null;
}

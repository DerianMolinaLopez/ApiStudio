import { newRequest } from './../request';
import { toAppError, workspace } from '../tauri';
import type { RequestModel, TreeNode } from '../types';
import { closeTab, markSaved, openRequest, snapshot, tabs, type Tab } from './tabs.svelte';
import { toast } from './toast.svelte';

export const collections = $state<{ nodes: TreeNode[]; expanded: Record<string, boolean> }>({ nodes: [], expanded: {} });
/** Pestaña pendiente de guardar por primera vez (la atiende SaveDialog). */
export const saveUi = $state<{ tab: Tab | null }>({ tab: null });

const fail = (e: unknown) => toast(toAppError(e).message, 'error');

export async function loadCollections(): Promise<void> {
  try {
    collections.nodes = await workspace.listTree();
  } catch (e) {
    fail(e);
  }
}

export function countRequests(nodes: TreeNode[] = collections.nodes): number {
  return nodes.reduce((n, x) => n + (x.kind === 'request' ? 1 : countRequests(x.children)), 0);
}

export function folderOptions(nodes: TreeNode[] = collections.nodes, depth = 0): { path: string; label: string; depth: number }[] {
  return nodes.flatMap((n) => (n.kind === 'folder' ? [{ path: n.path, label: n.name, depth }, ...folderOptions(n.children, depth + 1)] : []));
}

const basename = (p: string) => p.split('/').pop() ?? p;
const stem = (p: string) => basename(p).replace(/\.json$/i, '');

/** Completa campos que falten en archivos escritos a mano o por versiones anteriores. */
export const hydrate = (raw: Partial<RequestModel>): RequestModel => {
  const base = newRequest();
  return { ...base, ...raw, body: { ...base.body, ...raw.body }, auth: raw.auth ?? base.auth };
};

export async function openSaved(path: string): Promise<void> {
  try {
    const req = hydrate(await workspace.readRequest(path));
    req.name = stem(path);
    openRequest(req, path);
  } catch (e) {
    fail(e);
  }
}

/** Ctrl+S: guarda en su archivo, o pide destino si es una solicitud nueva. */
export async function saveTab(tab: Tab): Promise<void> {
  if (!tab.ref) {
    saveUi.tab = tab;
    return;
  }
  try {
    const plain = $state.snapshot(tab.request) as RequestModel;
    await workspace.writeRequest(tab.ref, plain);
    if (stem(tab.ref) !== plain.name.trim() && plain.name.trim()) {
      const old = tab.ref;
      const next = await workspace.rename(old, plain.name);
      retarget(old, next);
      tab.request.name = stem(next);
    }
    markSaved(tab);
    await loadCollections();
    toast('Solicitud guardada');
  } catch (e) {
    fail(e);
  }
}

export async function saveNew(tab: Tab, parent: string, name: string): Promise<void> {
  try {
    const plain = { ...($state.snapshot(tab.request) as RequestModel), name };
    const path = await workspace.createRequest(parent, name, plain);
    tab.request.name = stem(path);
    markSaved(tab, path);
    collections.expanded[parent] = true;
    await loadCollections();
    toast('Solicitud guardada');
  } catch (e) {
    fail(e);
  }
}

export async function createCollection(name: string): Promise<string | null> {
  try {
    const p = await workspace.createFolder('', name);
    collections.expanded[p] = true;
    await loadCollections();
    return p;
  } catch (e) {
    fail(e);
    return null;
  }
}

export async function createFolder(parent: string, name: string): Promise<void> {
  try {
    const p = await workspace.createFolder(parent, name);
    collections.expanded[parent] = true;
    collections.expanded[p] = true;
    await loadCollections();
  } catch (e) {
    fail(e);
  }
}

export async function newRequestIn(parent: string, name = 'Nueva solicitud'): Promise<void> {
  try {
    const req = newRequest({ name });
    const path = await workspace.createRequest(parent, name, req);
    req.name = stem(path);
    collections.expanded[parent] = true;
    await loadCollections();
    openRequest(req, path);
  } catch (e) {
    fail(e);
  }
}

/** Reasigna `ref` de las pestañas abiertas cuando una ruta cambia de lugar. */
function retarget(from: string, to: string): void {
  for (const t of tabs.items) {
    if (t.ref === from) t.ref = to;
    else if (t.ref?.startsWith(from + '/')) t.ref = to + t.ref.slice(from.length);
  }
  for (const key of Object.keys(collections.expanded)) {
    if (key === from || key.startsWith(from + '/')) {
      collections.expanded[to + key.slice(from.length)] = collections.expanded[key];
      delete collections.expanded[key];
    }
  }
}

export async function renameNode(path: string, name: string): Promise<void> {
  try {
    const next = await workspace.rename(path, name);
    retarget(path, next);
    for (const t of tabs.items) if (t.ref === next) { t.request.name = stem(next); t.baseline = snapshot(t.request); }
    await loadCollections();
  } catch (e) {
    fail(e);
  }
}

export async function deleteNode(path: string): Promise<void> {
  try {
    await workspace.remove(path);
    for (const t of [...tabs.items]) if (t.ref === path || t.ref?.startsWith(path + '/')) closeTab(t.id);
    await loadCollections();
  } catch (e) {
    fail(e);
  }
}

export async function moveNode(path: string, parent: string): Promise<void> {
  try {
    const next = await workspace.move(path, parent);
    retarget(path, next);
    collections.expanded[parent] = true;
    await loadCollections();
  } catch (e) {
    fail(e);
  }
}

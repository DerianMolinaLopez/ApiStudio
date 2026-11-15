/// <reference lib="webworker" />
import { runScript, type ScriptContext } from './scriptCore';

// Aísla el script: sin red ni almacenamiento. (El worker tampoco ve la API de Tauri de la ventana.)
for (const k of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'BroadcastChannel']) {
  try {
    (self as any)[k] = undefined;
  } catch {
    /* propiedad no configurable */
  }
}

self.onmessage = async (e: MessageEvent<{ code: string; ctx: ScriptContext }>) => {
  self.postMessage(await runScript(e.data.code, e.data.ctx));
};

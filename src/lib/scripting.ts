import type { ScriptContext, ScriptOutput } from './scriptCore';
import ScriptWorker from './script.worker?worker';

const TIMEOUT_MS = 5000;

/** Ejecuta un script en un worker desechable; lo termina si excede el tiempo. */
export function runInWorker(code: string, ctx: ScriptContext): Promise<ScriptOutput> {
  return new Promise((resolve) => {
    const worker = new ScriptWorker();
    const fail = (error: string) => resolve({ ok: false, error, logs: [], tests: [], varChanges: {}, headers: [] });
    const timer = setTimeout(() => {
      worker.terminate();
      fail(`El script superó el límite de ${TIMEOUT_MS / 1000} s`);
    }, TIMEOUT_MS);
    worker.onmessage = (e: MessageEvent<ScriptOutput>) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      fail(e.message || 'Error al ejecutar el script');
    };
    worker.postMessage({ code, ctx });
  });
}

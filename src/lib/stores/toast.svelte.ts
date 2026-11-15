export interface Toast { id: number; text: string; kind: 'info' | 'error' }
export const toasts = $state<Toast[]>([]);
let n = 0;

export function toast(text: string, kind: Toast['kind'] = 'info', ms = 2600): void {
  const t = { id: ++n, text, kind };
  toasts.push(t);
  setTimeout(() => {
    const i = toasts.findIndex((x) => x.id === t.id);
    if (i >= 0) toasts.splice(i, 1);
  }, ms);
}

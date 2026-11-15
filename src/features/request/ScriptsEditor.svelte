<script lang="ts">
  import CodeEditor from '../../ui/CodeEditor.svelte';
  import type { RequestModel } from '../../lib/types';

  let { req = $bindable() }: { req: RequestModel } = $props();

  type Kind = 'preScript' | 'postScript' | 'tests';
  let kind = $state<Kind>('preScript');

  const kinds: { id: Kind; label: string; help: string; example: string }[] = [
    {
      id: 'preScript',
      label: 'Pre-request',
      help: 'Se ejecuta antes de enviar. Disponibles: env.get(k), env.set(k, v), request.setHeader(k, v), console.log().',
      example: "// env.set('timestamp', Date.now());\n// request.setHeader('X-Request-Id', crypto.randomUUID());",
    },
    {
      id: 'postScript',
      label: 'Post-response',
      help: 'Se ejecuta al recibir la respuesta. Disponibles: response.status, response.headers, response.json(), response.text(), env.set().',
      example: "// env.set('token', response.json().token);",
    },
    {
      id: 'tests',
      label: 'Tests',
      help: 'Aserciones sobre la respuesta: test(nombre, () => expect(valor).toBe(...)). Resultados en el panel de respuesta.',
      example: "// test('responde 200', () => expect(response.status).toBe(200));\n// test('es rápido', () => expect(response.time).toBeLessThan(500));\n// test('tiene id', () => expect(response.json()).toHaveProperty('id'));",
    },
  ];
  const cur = $derived(kinds.find((k) => k.id === kind)!);
</script>

<div class="scripts">
  <div class="head">
    <div class="seg" role="radiogroup" aria-label="Tipo de script">
      {#each kinds as k}
        <button role="radio" aria-checked={kind === k.id} class:on={kind === k.id} onclick={() => (kind = k.id)}>
          {k.label}{#if req[k.id].trim()}<span class="dot"></span>{/if}
        </button>
      {/each}
    </div>
    <span class="help">{cur.help}</span>
  </div>
  <div class="area">
    {#key kind}
      <CodeEditor bind:value={req[kind]} lang="js" placeholder={cur.example} />
    {/key}
  </div>
  <p class="note">Los scripts corren aislados, sin acceso a red ni a archivos. Admiten <code>await</code>.</p>
</div>

<style>
  .scripts { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .head { display: flex; align-items: center; gap: 14px; padding: 8px 12px; border-bottom: 1px solid var(--border); }
  .seg { display: flex; gap: 2px; flex: none; }
  .seg button { height: 26px; padding: 0 10px; border-radius: var(--radius-sm); color: var(--text-2); display: flex; align-items: center; gap: 6px; }
  .seg button:hover { color: var(--text); background: var(--hover); }
  .seg button.on { background: var(--accent-soft); color: var(--accent); }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ok); }
  .help { color: var(--text-3); font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .area { flex: 1; min-height: 0; }
  .note { margin: 0; padding: 6px 14px; color: var(--text-3); font-size: var(--text-xs); border-top: 1px solid var(--border); }
  code { font-family: var(--font-mono); }
</style>

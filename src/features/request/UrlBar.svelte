<script lang="ts">
  import Icon from '../../ui/Icon.svelte';
  import Menu from '../../ui/Menu.svelte';
  import CodeEditor from '../../ui/CodeEditor.svelte';
  import { METHODS, type Method } from '../../lib/types';
  import type { Vars } from '../../lib/request';

  let {
    method = $bindable(),
    url = $bindable(),
    vars,
    loading,
    onurl,
    onsend,
    oncancel,
    oncurl,
  }: {
    method: Method;
    url: string;
    vars: Vars;
    loading: boolean;
    onurl: () => void;
    onsend: () => void;
    oncancel: () => void;
    oncurl: () => void;
  } = $props();

  let menu = $state(false);
  let last = url;
  $effect(() => {
    if (url !== last) {
      last = url;
      onurl();
    }
  });
</script>

<div class="bar">
  <span class="method" style:--mc="var(--m-{method.toLowerCase()})">
    <select bind:value={method} aria-label="Método HTTP">
      {#each METHODS as m}<option value={m}>{m}</option>{/each}
    </select>
    <Icon name="chevron-down" size={14} />
  </span>

  <div class="url">
    <CodeEditor bind:value={url} singleLine {vars} placeholder="https://api.ejemplo.com/v1/recurso" onsubmit={onsend} />
  </div>

  <div class="send">
    {#if loading}
      <button class="btn danger" onclick={oncancel}><Icon name="stop" size={14} /> Cancelar</button>
    {:else}
      <button class="btn primary main" onclick={onsend} title="Enviar (Ctrl+Enter)"><Icon name="send" size={14} /> Enviar</button>
      <button class="btn primary more" onclick={() => (menu = !menu)} aria-label="Más opciones" aria-haspopup="menu"><Icon name="chevron-down" size={14} /></button>
      {#if menu}
        <Menu onclose={() => (menu = false)} items={[{ label: 'Copiar como cURL', icon: 'terminal', onclick: oncurl }]} />
      {/if}
    {/if}
  </div>
</div>

<style>
  .bar { display: flex; gap: 8px; padding: 12px; align-items: center; }
  .method { position: relative; display: inline-flex; align-items: center; height: 36px; background: var(--elevated); border: 1px solid var(--border); border-radius: var(--radius); color: var(--mc); transition: border-color var(--dur-fast); }
  .method:hover { border-color: var(--border-strong); }
  .method select { appearance: none; background: transparent; border: 0; height: 100%; padding: 0 28px 0 12px; font-weight: 600; letter-spacing: 0.02em; color: var(--mc); }
  .method select:focus-visible { outline: none; }
  .method:focus-within { border-color: var(--accent); }
  .method option { color: var(--text); background: var(--elevated); }
  .method :global(svg) { position: absolute; right: 8px; pointer-events: none; color: var(--text-2); }
  .url { flex: 1; min-width: 0; height: 36px; padding: 4px 12px; background: var(--elevated); border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--font-mono); font-size: var(--text-md); transition: border-color var(--dur-fast); }
  .url:hover { border-color: var(--border-strong); }
  .url:focus-within { border-color: var(--accent); }
  .url :global(.cm-editor) { background: transparent; }
  .send { position: relative; display: flex; }
  .send .btn { height: 36px; }
  .main { border-radius: var(--radius) 0 0 var(--radius); padding: 0 16px; }
  .more { border-radius: 0 var(--radius) var(--radius) 0; padding: 0 8px; border-left: 1px solid color-mix(in srgb, var(--accent-contrast) 25%, transparent); }
  .danger { border-color: var(--danger); color: var(--danger); background: transparent; }
  .danger:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); }
</style>

<script lang="ts">
  import CodeEditor from '../../ui/CodeEditor.svelte';
  import Select from '../../ui/Select.svelte';
  import KeyValueEditor from './KeyValueEditor.svelte';
  import { prettyJson, type Lang } from '../../lib/format';
  import type { Vars } from '../../lib/request';
  import type { BodyMode, BodyModel } from '../../lib/types';

  let { body = $bindable(), vars }: { body: BodyModel; vars: Vars } = $props();

  const modes: { id: BodyMode; label: string }[] = [
    { id: 'none', label: 'Ninguno' },
    { id: 'json', label: 'JSON' },
    { id: 'form-data', label: 'Form-data' },
    { id: 'urlencoded', label: 'x-www-form-urlencoded' },
    { id: 'raw', label: 'Raw' },
  ];
  const rawTypes = [
    { value: 'text/plain', label: 'Texto' },
    { value: 'application/xml', label: 'XML' },
    { value: 'text/html', label: 'HTML' },
    { value: 'application/javascript', label: 'JavaScript' },
  ];
  const rawLang: Record<string, Lang> = { 'text/plain': 'text', 'application/xml': 'xml', 'text/html': 'html', 'application/javascript': 'js' };

  let jsonError = $state('');
  function format() {
    const p = prettyJson(body.json);
    if (p === null) jsonError = 'El JSON no es válido';
    else {
      body.json = p;
      jsonError = '';
    }
  }
  $effect(() => {
    body.json;
    jsonError = '';
  });
</script>

<div class="body">
  <div class="modes" role="radiogroup" aria-label="Tipo de body">
    {#each modes as m}
      <button role="radio" aria-checked={body.mode === m.id} class:active={body.mode === m.id} onclick={() => (body.mode = m.id)}>{m.label}</button>
    {/each}
    <span class="spacer"></span>
    {#if body.mode === 'raw'}
      <Select bind:value={body.rawType} options={rawTypes} width={130} ariaLabel="Tipo de contenido" />
    {:else if body.mode === 'json'}
      {#if jsonError}<span class="err">{jsonError}</span>{/if}
      <button class="btn ghost" onclick={format}>Formatear</button>
    {/if}
  </div>

  <div class="area">
    {#if body.mode === 'none'}
      <p class="empty">Esta solicitud no envía cuerpo.</p>
    {:else if body.mode === 'json'}
      <CodeEditor bind:value={body.json} lang="json" {vars} placeholder={'{\n  "clave": "valor"\n}'} />
    {:else if body.mode === 'raw'}
      <CodeEditor bind:value={body.raw} lang={rawLang[body.rawType] ?? 'text'} {vars} />
    {:else if body.mode === 'urlencoded'}
      <div class="scroll"><KeyValueEditor bind:items={body.urlencoded} addLabel="Añadir campo" /></div>
    {:else}
      <div class="scroll"><KeyValueEditor bind:items={body.formData} addLabel="Añadir campo" withKind /></div>
    {/if}
  </div>
</div>

<style>
  .body { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .modes { display: flex; align-items: center; gap: 2px; padding: 8px 12px; border-bottom: 1px solid var(--border); }
  .modes > button:not(.btn) { height: 26px; padding: 0 10px; border-radius: var(--radius-sm); color: var(--text-2); transition: background var(--dur-fast), color var(--dur-fast); }
  .modes > button:not(.btn):hover { color: var(--text); background: var(--hover); }
  .modes > button.active { background: var(--accent-soft); color: var(--accent); }
  .spacer { flex: 1; }
  .err { color: var(--danger); font-size: var(--text-sm); margin-right: 8px; }
  .area { flex: 1; min-height: 0; }
  .scroll { height: 100%; overflow: auto; }
  .empty { margin: 0; padding: 24px 16px; color: var(--text-3); }
</style>

<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import Icon from '../../ui/Icon.svelte';
  import { newKV } from '../../lib/request';
  import type { FormItem, KV } from '../../lib/types';

  let {
    items = $bindable(),
    onchange,
    addLabel = 'Añadir',
    withKind = false,
    keyPlaceholder = 'Clave',
    valuePlaceholder = 'Valor',
  }: {
    items: (KV | FormItem)[];
    onchange?: () => void;
    addLabel?: string;
    withKind?: boolean;
    keyPlaceholder?: string;
    valuePlaceholder?: string;
  } = $props();

  function add() {
    items.push(withKind ? { ...newKV(), kind: 'text' } : newKV());
    onchange?.();
  }
  function remove(id: string) {
    items = items.filter((i) => i.id !== id);
    onchange?.();
  }
  async function pickFile(item: FormItem) {
    const path = await open({ multiple: false });
    if (typeof path === 'string') {
      item.value = path;
      onchange?.();
    }
  }
</script>

<div class="table" class:kind={withKind}>
  <div class="row head">
    <span></span><span>Clave</span>{#if withKind}<span>Tipo</span>{/if}<span>Valor</span><span>Descripción</span><span></span>
  </div>
  {#each items as item (item.id)}
    <div class="row" class:off={!item.enabled}>
      <input type="checkbox" bind:checked={item.enabled} onchange={() => onchange?.()} aria-label="Activar" />
      <input class="cell mono" bind:value={item.key} oninput={() => onchange?.()} placeholder={keyPlaceholder} spellcheck="false" />
      {#if withKind && 'kind' in item}
        <select class="cell" bind:value={item.kind} onchange={() => { item.value = ''; onchange?.(); }} aria-label="Tipo">
          <option value="text">Texto</option>
          <option value="file">Archivo</option>
        </select>
        {#if item.kind === 'file'}
          <button class="cell pick" onclick={() => pickFile(item as FormItem)}>
            <Icon name="file" size={14} /> {item.value ? item.value.split(/[\\/]/).pop() : 'Elegir archivo…'}
          </button>
        {:else}
          <input class="cell mono" bind:value={item.value} oninput={() => onchange?.()} placeholder={valuePlaceholder} spellcheck="false" />
        {/if}
      {:else}
        <input class="cell mono" bind:value={item.value} oninput={() => onchange?.()} placeholder={valuePlaceholder} spellcheck="false" />
      {/if}
      <input class="cell" bind:value={item.description} oninput={() => onchange?.()} placeholder="Descripción" />
      <button class="icon-btn del" onclick={() => remove(item.id)} aria-label="Eliminar"><Icon name="trash" size={14} /></button>
    </div>
  {/each}
  <button class="add" onclick={add}><Icon name="plus" size={14} /> {addLabel}</button>
</div>

<style>
  .table { --cols: 28px 1fr 1fr 1fr 30px; font-size: var(--text-md); }
  .table.kind { --cols: 28px 1fr 96px 1fr 1fr 30px; }
  .row { display: grid; grid-template-columns: var(--cols); align-items: center; border-bottom: 1px solid var(--border); min-height: 34px; padding: 0 8px; }
  .row.head { color: var(--text-2); font-size: var(--text-sm); min-height: 30px; background: var(--surface); position: sticky; top: 0; z-index: 1; }
  .row.head span { padding: 0 8px; border-left: 1px solid var(--border); }
  .row.head span:first-child { border: 0; }
  .row.off .cell { opacity: 0.5; }
  .cell { height: 32px; padding: 0 8px; background: transparent; border: 0; border-left: 1px solid var(--border); min-width: 0; color: var(--text); }
  .cell:focus { outline: none; background: var(--accent-soft); }
  .cell::placeholder { color: var(--text-3); }
  .mono { font-family: var(--font-mono); font-size: var(--text-sm); }
  select.cell option { background: var(--elevated); }
  .pick { display: flex; align-items: center; gap: 6px; text-align: left; color: var(--text-2); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .pick:hover { color: var(--text); }
  input[type='checkbox'] { accent-color: var(--accent); width: 15px; height: 15px; margin: 0; }
  .del { opacity: 0; justify-self: center; }
  .row:hover .del, .del:focus-visible { opacity: 1; }
  .add { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 16px; color: var(--text-2); width: 100%; text-align: left; }
  .add:hover { color: var(--accent); }
</style>

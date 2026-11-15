<script lang="ts">
  import Icon from '../../ui/Icon.svelte';
  import TreeItem from './TreeItem.svelte';
  import { askName } from '../../ui/dialogs.svelte';
  import { collections, createCollection } from '../../lib/stores/collections.svelte';

  let { onimport }: { onimport: () => void } = $props();

  async function create() {
    const name = await askName('Nueva colección', '', 'Crear');
    if (name) await createCollection(name);
  }
</script>

<div class="panel">
  <header>
    <h2>Colecciones</h2>
    <span class="acts">
      <button class="icon-btn" onclick={onimport} title="Importar" aria-label="Importar"><Icon name="upload" size={15} /></button>
      <button class="btn primary" onclick={create}><Icon name="plus" size={14} /> Nueva</button>
    </span>
  </header>

  {#if collections.nodes.length === 0}
    <div class="empty">
      <span class="mark"><Icon name="bolt" size={26} stroke={1.5} /></span>
      <strong>Organiza tus solicitudes</strong>
      <p>Crea colecciones para agrupar tus endpoints. Cada solicitud se guarda como un archivo JSON que puedes versionar con Git.</p>
      <button class="btn primary" onclick={create}>Crear colección</button>
    </div>
  {:else}
    <div class="tree" role="tree">
      {#each collections.nodes as node (node.path)}
        <TreeItem {node} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .panel { display: flex; flex-direction: column; min-height: 0; flex: 1; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 8px; }
  .acts { display: flex; align-items: center; gap: 6px; }
  h2 { margin: 0; font-size: var(--text-md); font-weight: 600; }
  header .btn { height: 26px; padding: 0 10px; }
  .tree { flex: 1; overflow: auto; padding-bottom: 12px; }
  .empty { margin: 8px 12px; padding: 18px 14px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; background: var(--bg); border: 1px dashed var(--border-strong); border-radius: var(--radius-lg); }
  .empty p { margin: 0 0 8px; color: var(--text-2); font-size: var(--text-sm); }
  .mark { color: var(--accent); }
</style>

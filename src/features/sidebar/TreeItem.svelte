<script lang="ts">
  import Self from './TreeItem.svelte';
  import Icon from '../../ui/Icon.svelte';
  import Menu, { type MenuItem } from '../../ui/Menu.svelte';
  import { askConfirm, askName } from '../../ui/dialogs.svelte';
  import { collections, createFolder, deleteNode, exportCollection, moveNode, newRequestIn, openSaved, renameNode } from '../../lib/stores/collections.svelte';
  import { activeTab } from '../../lib/stores/tabs.svelte';
  import type { TreeNode } from '../../lib/types';

  let { node, depth = 0 }: { node: TreeNode; depth?: number } = $props();

  let menu = $state(false);
  let over = $state(false);
  const open = $derived(collections.expanded[node.path] ?? false);
  const active = $derived(node.kind === 'request' && activeTab()?.ref === node.path);
  const short: Record<string, string> = { DELETE: 'DEL', OPTIONS: 'OPT' };

  const items: MenuItem[] = $derived(
    node.kind === 'folder'
      ? [
          { label: 'Nueva solicitud', icon: 'plus', onclick: () => newRequestIn(node.path) },
          { label: 'Nueva carpeta', icon: 'folder-plus', onclick: rename0('Nueva carpeta', (n) => createFolder(node.path, n), '') },
          { label: 'Renombrar', icon: 'edit', onclick: rename0('Renombrar', (n) => renameNode(node.path, n), node.name) },
          ...(depth === 0 ? [{ label: 'Exportar (Postman)', icon: 'download' as const, onclick: () => exportCollection(node) }] : []),
          { label: 'Eliminar', icon: 'trash', danger: true, onclick: remove },
        ]
      : [
          { label: 'Renombrar', icon: 'edit', onclick: rename0('Renombrar solicitud', (n) => renameNode(node.path, n), node.name) },
          { label: 'Eliminar', icon: 'trash', danger: true, onclick: remove },
        ],
  );

  function rename0(title: string, act: (n: string) => Promise<void>, value: string) {
    return async () => {
      const n = await askName(title, value);
      if (n) await act(n);
    };
  }
  async function remove() {
    const what = node.kind === 'folder' ? `la carpeta «${node.name}» y todo su contenido` : `la solicitud «${node.name}»`;
    if (await askConfirm('Eliminar', `Se eliminará ${what}. Esta acción no se puede deshacer.`)) await deleteNode(node.path);
  }

  function click() {
    if (node.kind === 'folder') collections.expanded[node.path] = !open;
    else void openSaved(node.path);
  }
  function dragstart(e: DragEvent) {
    e.dataTransfer?.setData('text/x-api-studio-path', node.path);
    e.dataTransfer!.effectAllowed = 'move';
  }
  function drop(e: DragEvent) {
    over = false;
    const from = e.dataTransfer?.getData('text/x-api-studio-path');
    if (from && node.kind === 'folder' && from !== node.path) {
      e.preventDefault();
      void moveNode(from, node.path);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="row"
  class:active
  class:over
  style:padding-left="{8 + depth * 14}px"
  draggable="true"
  ondragstart={dragstart}
  ondragover={(e) => { if (node.kind === 'folder') { e.preventDefault(); over = true; } }}
  ondragleave={() => (over = false)}
  ondrop={drop}
>
  <button class="main" onclick={click} title={node.name}>
    {#if node.kind === 'folder'}
      <span class="chev" class:open><Icon name="chevron-right" size={13} /></span>
      <Icon name={open ? 'folder-open' : 'folder'} size={15} />
      <span class="name">{node.name}</span>
    {:else}
      <span class="method" style:color="var(--m-{node.method.toLowerCase()})">{short[node.method] ?? node.method}</span>
      <span class="name">{node.name}</span>
    {/if}
  </button>
  <span class="more">
    <button class="icon-btn" aria-label="Acciones" aria-haspopup="menu" onclick={() => (menu = !menu)}><Icon name="more" size={15} /></button>
    {#if menu}<Menu {items} onclose={() => (menu = false)} />{/if}
  </span>
</div>

{#if node.kind === 'folder' && open}
  {#each node.children as child (child.path)}
    <Self node={child} depth={depth + 1} />
  {/each}
{/if}

<style>
  .row { display: flex; align-items: center; height: 28px; padding-right: 4px; border-radius: var(--radius); margin: 0 6px; color: var(--text-2); }
  .row:hover { background: var(--hover); color: var(--text); }
  .row.active { background: var(--accent-soft); color: var(--text); }
  .row.over { outline: 1px dashed var(--accent); background: var(--accent-soft); }
  .main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px; height: 100%; text-align: left; }
  .chev { display: flex; transition: transform var(--dur-fast); }
  .chev.open { transform: rotate(90deg); }
  .method { width: 30px; font-size: 10px; font-weight: 700; letter-spacing: 0.02em; flex: none; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .more { position: relative; display: none; }
  .row:hover .more, .more:focus-within { display: block; }
</style>

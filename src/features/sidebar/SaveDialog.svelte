<script lang="ts">
  import Modal from '../../ui/Modal.svelte';
  import { collections, createCollection, folderOptions, saveNew, saveUi } from '../../lib/stores/collections.svelte';

  const tab = $derived(saveUi.tab);
  const folders = $derived(folderOptions());
  let name = $state('');
  let target = $state('');
  let newCollection = $state('Mi colección');

  $effect(() => {
    if (tab) {
      name = tab.request.name;
      target = folders[0]?.path ?? '';
    }
  });

  const close = () => (saveUi.tab = null);

  async function submit(e: Event) {
    e.preventDefault();
    const t = tab;
    if (!t || !name.trim()) return;
    let parent = target;
    if (!parent) {
      const created = await createCollection(newCollection.trim() || 'Mi colección');
      if (!created) return;
      parent = created;
    }
    close();
    await saveNew(t, parent, name.trim());
  }
</script>

{#if tab}
  <Modal width={460} label="Guardar solicitud" onclose={close}>
    <form class="box" onsubmit={submit}>
      <h3>Guardar solicitud</h3>
      <label>Nombre
        <!-- svelte-ignore a11y_autofocus -->
        <input class="input" bind:value={name} autofocus spellcheck="false" />
      </label>
      {#if folders.length}
        <div class="field" role="radiogroup" aria-label="Guardar en">
          <span class="lbl">Guardar en</span>
          <div class="list">
            {#each folders as f (f.path)}
              <button type="button" role="radio" aria-checked={target === f.path} class:sel={target === f.path} style:padding-left="{10 + f.depth * 14}px" onclick={() => (target = f.path)}>
                {f.label}
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <label>Todavía no tienes colecciones. Se creará una nueva:
          <input class="input" bind:value={newCollection} spellcheck="false" />
        </label>
      {/if}
      <div class="actions">
        <button type="button" class="btn ghost" onclick={close}>Cancelar</button>
        <button type="submit" class="btn primary" disabled={!name.trim()}>Guardar</button>
      </div>
    </form>
  </Modal>
{/if}

<style>
  .box { width: 100%; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  h3 { margin: 0; font-size: var(--text-lg); font-weight: 600; }
  label, .field { display: flex; flex-direction: column; gap: 6px; color: var(--text-2); }
  .input { height: 34px; }
  .list { max-height: 200px; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); padding: 4px; }
  .list button { display: block; width: 100%; height: 28px; text-align: left; color: var(--text); border-radius: var(--radius-sm); }
  .list button:hover { background: var(--hover); }
  .list button.sel { background: var(--accent-soft); color: var(--accent); }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>

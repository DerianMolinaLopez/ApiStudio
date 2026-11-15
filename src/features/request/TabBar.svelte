<script lang="ts">
  import Icon from '../../ui/Icon.svelte';
  import { closeTab, isDirty, newTab, tabs } from '../../lib/stores/tabs.svelte';

  let renaming = $state<string | null>(null);
  const short: Record<string, string> = { DELETE: 'DEL', OPTIONS: 'OPT' };

  function onaux(e: MouseEvent, id: string) {
    if (e.button === 1) {
      e.preventDefault();
      closeTab(id);
    }
  }
</script>

<div class="bar" role="tablist">
  <div class="list">
    {#each tabs.items as t (t.id)}
      {@const m = t.request.method}
      <div
        class="tab"
        class:active={t.id === tabs.activeId}
        role="tab"
        tabindex="0"
        aria-selected={t.id === tabs.activeId}
        onclick={() => (tabs.activeId = t.id)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (tabs.activeId = t.id)}
        onauxclick={(e) => onaux(e, t.id)}
        ondblclick={() => (renaming = t.id)}
      >
        <span class="m" style:color="var(--m-{m.toLowerCase()})">{short[m] ?? m}</span>
        {#if renaming === t.id}
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="rename"
            bind:value={t.request.name}
            autofocus
            onblur={() => (renaming = null)}
            onkeydown={(e) => (e.key === 'Enter' || e.key === 'Escape') && (renaming = null)}
            onclick={(e) => e.stopPropagation()}
          />
        {:else}
          <span class="name">{t.request.name}</span>
        {/if}
        {#if isDirty(t)}<span class="dot" title="Cambios sin guardar"></span>{/if}
        <button class="x" onclick={(e) => { e.stopPropagation(); closeTab(t.id); }} aria-label="Cerrar pestaña"><Icon name="x" size={13} /></button>
      </div>
    {/each}
  </div>
  <button class="icon-btn add" onclick={newTab} aria-label="Nueva solicitud" title="Nueva solicitud (Ctrl+T)"><Icon name="plus" size={16} /></button>
</div>

<style>
  .bar { display: flex; align-items: flex-end; background: var(--surface); border-bottom: 1px solid var(--border); padding: 6px 8px 0; gap: 4px; }
  .list { display: flex; gap: 2px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .tab { display: flex; align-items: center; gap: 8px; height: 34px; max-width: 220px; padding: 0 8px 0 12px; border: 1px solid transparent; border-bottom: 0; border-radius: var(--radius) var(--radius) 0 0; color: var(--text-2); cursor: pointer; flex: none; transition: background var(--dur-fast), color var(--dur-fast); }
  .tab:hover { background: var(--hover); color: var(--text); }
  .tab.active { background: var(--bg); border-color: var(--border); color: var(--text); margin-bottom: -1px; height: 35px; }
  .m { font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.02em; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rename { width: 130px; height: 22px; padding: 0 6px; background: var(--elevated); border: 1px solid var(--accent); border-radius: var(--radius-sm); }
  .rename:focus { outline: none; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); flex: none; }
  .x { width: 20px; height: 20px; display: grid; place-items: center; border-radius: var(--radius-sm); color: var(--text-3); opacity: 0; }
  .tab:hover .x, .tab.active .x, .x:focus-visible { opacity: 1; }
  .x:hover { background: var(--elevated); color: var(--text); }
  .add { margin-bottom: 5px; flex: none; }
</style>

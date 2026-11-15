<script lang="ts">
  type Item = { id: string; label: string; badge?: number | string | null };
  let { items, active = $bindable() }: { items: Item[]; active: string } = $props();
</script>

<div class="tabs" role="tablist">
  {#each items as it}
    <button role="tab" aria-selected={active === it.id} class:active={active === it.id} onclick={() => (active = it.id)}>
      {it.label}
      {#if it.badge}<span class="badge">{it.badge}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .tabs { display: flex; gap: 2px; padding: 0 12px; border-bottom: 1px solid var(--border); }
  button { position: relative; height: 36px; padding: 0 10px; display: flex; align-items: center; gap: 6px; color: var(--text-2); transition: color var(--dur-fast); }
  button:hover { color: var(--text); }
  button.active { color: var(--text); }
  button.active::after { content: ''; position: absolute; left: 8px; right: 8px; bottom: -1px; height: 2px; background: var(--accent); border-radius: 2px; }
  .badge { min-width: 16px; height: 16px; line-height: 16px; padding: 0 5px; border-radius: 8px; background: var(--accent-soft); color: var(--accent); font-size: 10px; font-weight: 600; text-align: center; }
</style>

<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  export interface MenuItem { label: string; icon?: IconName; danger?: boolean; onclick: () => void }
  let { items, onclose, align = 'right' }: { items: MenuItem[]; onclose: () => void; align?: 'left' | 'right' } = $props();
</script>

<svelte:window onmousedown={onclose} onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="menu" class:left={align === 'left'} role="menu" tabindex="-1" onmousedown={(e) => e.stopPropagation()}>
  {#each items as it}
    <button role="menuitem" class:danger={it.danger} onclick={() => { onclose(); it.onclick(); }}>
      {#if it.icon}<Icon name={it.icon} size={14} />{/if}{it.label}
    </button>
  {/each}
</div>

<style>
  .menu { position: absolute; top: calc(100% + 4px); right: 0; z-index: 40; min-width: 180px; padding: 4px; background: var(--elevated); border: 1px solid var(--border-strong); border-radius: var(--radius); box-shadow: var(--shadow); animation: pop var(--dur-fast) var(--ease); }
  .menu.left { right: auto; left: 0; }
  button { display: flex; align-items: center; gap: 8px; width: 100%; height: 30px; padding: 0 10px; border-radius: var(--radius-sm); text-align: left; color: var(--text); }
  button:hover { background: var(--hover); }
  button.danger { color: var(--danger); }
  @keyframes pop { from { opacity: 0; transform: translateY(-3px); } }
</style>

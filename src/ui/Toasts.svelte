<script lang="ts">
  import { toasts } from '../lib/stores/toast.svelte';
  import Icon from './Icon.svelte';
</script>

<div class="stack" aria-live="polite">
  {#each toasts as t (t.id)}
    <div class="toast" class:error={t.kind === 'error'}>
      <Icon name={t.kind === 'error' ? 'alert-circle' : 'check'} size={15} /> {t.text}
    </div>
  {/each}
</div>

<style>
  .stack { position: fixed; right: 16px; bottom: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 60; }
  .toast { display: flex; align-items: center; gap: 8px; padding: 9px 14px; background: var(--elevated); border: 1px solid var(--border-strong); border-radius: var(--radius); box-shadow: var(--shadow); animation: in var(--dur) var(--ease); }
  .toast :global(svg) { color: var(--ok); }
  .toast.error :global(svg) { color: var(--danger); }
  @keyframes in { from { opacity: 0; transform: translateY(6px); } }
</style>

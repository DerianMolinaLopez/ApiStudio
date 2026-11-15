<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let { onclose, width = 720, label, children }: { onclose: () => void; width?: number; label: string; children: Snippet } = $props();

  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={onkey} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="scrim" onmousedown={(e) => e.target === e.currentTarget && onclose()}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label={label} style:width="{width}px">
    <button class="close" onclick={onclose} aria-label="Cerrar"><Icon name="x" size={16} /></button>
    {@render children()}
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    display: grid;
    place-items: center;
    z-index: 50;
    animation: fade var(--dur) var(--ease);
  }
  .dialog {
    position: relative;
    max-width: calc(100vw - 48px);
    max-height: calc(100vh - 48px);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    display: flex;
    overflow: hidden;
    animation: rise var(--dur) var(--ease);
  }
  .close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: var(--radius);
    color: var(--text-2);
    z-index: 1;
  }
  .close:hover { background: var(--hover); color: var(--text); }
  @keyframes fade { from { opacity: 0; } }
  @keyframes rise { from { opacity: 0; transform: translateY(6px) scale(0.99); } }
</style>

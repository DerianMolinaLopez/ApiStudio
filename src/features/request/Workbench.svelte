<script lang="ts">
  import TabBar from './TabBar.svelte';
  import RequestPane from './RequestPane.svelte';
  import ResponsePane from '../response/ResponsePane.svelte';
  import { activeTab, tabs } from '../../lib/stores/tabs.svelte';

  const KEY = 'api-studio:split';
  let ratio = $state(Number(localStorage.getItem(KEY)) || 0.5);
  let box = $state<HTMLDivElement>();
  let dragging = $state(false);

  const tab = $derived(activeTab());

  function start(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    const r = box!.getBoundingClientRect();
    ratio = Math.min(0.8, Math.max(0.2, (e.clientY - r.top) / r.height));
  }
  function end() {
    if (!dragging) return;
    dragging = false;
    try { localStorage.setItem(KEY, String(ratio)); } catch { /* sin almacenamiento */ }
  }
</script>

<div class="wb">
  <TabBar />
  {#if tab}
    <div class="split" bind:this={box} style:grid-template-rows="{ratio}fr 6px {1 - ratio}fr">
      {#key tab.id}
        <div class="req"><RequestPane {tab} /></div>
      {/key}
      <div
        class="handle"
        class:on={dragging}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Redimensionar paneles"
        onpointerdown={start}
        onpointermove={move}
        onpointerup={end}
      ></div>
      {#key tab.id}
        <div class="res"><ResponsePane {tab} /></div>
      {/key}
    </div>
  {/if}
</div>

<style>
  .wb { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .split { flex: 1; display: grid; min-height: 0; }
  .req, .res { min-height: 0; overflow: hidden; }
  .handle { cursor: row-resize; background: var(--border); position: relative; transition: background var(--dur-fast); }
  .handle::after { content: ''; position: absolute; inset: -4px 0; }
  .handle:hover, .handle.on { background: var(--accent); }
</style>

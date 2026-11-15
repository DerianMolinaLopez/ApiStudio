<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar, { type View } from './features/sidebar/Sidebar.svelte';
  import SettingsDialog from './features/settings/SettingsDialog.svelte';
  import Welcome from './features/welcome/Welcome.svelte';
  import Workbench from './features/request/Workbench.svelte';
  import Toasts from './ui/Toasts.svelte';
  import { initSettings } from './lib/stores/settings.svelte';
  import { activeTab, closeTab, newTab, send, tabs } from './lib/stores/tabs.svelte';

  let view = $state<View>('collections');
  let showSettings = $state(false);

  onMount(() => initSettings());

  function onkey(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const tab = activeTab();
    if (e.key === 'Enter' && tab) (e.preventDefault(), send(tab));
    else if (e.key.toLowerCase() === 't') (e.preventDefault(), newTab());
    else if (e.key.toLowerCase() === 'w' && tab) (e.preventDefault(), closeTab(tab.id));
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="app">
  <Sidebar bind:view counts={{}} onsettings={() => (showSettings = true)}>
    <p class="hint">Sin contenido todavía</p>
  </Sidebar>
  <main>
    {#if tabs.items.length}
      <Workbench />
    {:else}
      <Welcome onnew={newTab} onimport={() => {}} />
    {/if}
  </main>
</div>

{#if showSettings}<SettingsDialog onclose={() => (showSettings = false)} />{/if}
<Toasts />

<style>
  .app { display: grid; grid-template-columns: 264px 1fr; height: 100%; }
  main { min-width: 0; min-height: 0; background: var(--bg); }
  .hint { margin: 16px; color: var(--text-3); }
</style>

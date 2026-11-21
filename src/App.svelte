<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar, { type View } from './features/sidebar/Sidebar.svelte';
  import CollectionsPanel from './features/sidebar/CollectionsPanel.svelte';
  import EnvironmentsPanel from './features/sidebar/EnvironmentsPanel.svelte';
  import EnvironmentDialog from './features/sidebar/EnvironmentDialog.svelte';
  import HistoryPanel from './features/sidebar/HistoryPanel.svelte';
  import ImportDialog from './features/import/ImportDialog.svelte';
  import SaveDialog from './features/sidebar/SaveDialog.svelte';
  import SettingsDialog from './features/settings/SettingsDialog.svelte';
  import Welcome from './features/welcome/Welcome.svelte';
  import Workbench from './features/request/Workbench.svelte';
  import DialogHost from './ui/DialogHost.svelte';
  import Toasts from './ui/Toasts.svelte';
  import { initSettings } from './lib/stores/settings.svelte';
  import { collections, countRequests, loadCollections, saveTab } from './lib/stores/collections.svelte';
  import { envs, loadEnvironments, type Environment } from './lib/stores/environments.svelte';
  import { history, loadHistory, trackHistory } from './lib/stores/history.svelte';
  import { activeTab, closeTab, newTab, send, tabs } from './lib/stores/tabs.svelte';
  import { toast } from './lib/stores/toast.svelte';
  import { toAppError } from './lib/tauri';

  let view = $state<View>('collections');
  let showSettings = $state(false);
  let showImport = $state(false);
  let editingEnv = $state<Environment | null>(null);

  onMount(() => {
    const stop = initSettings();
    trackHistory();
    Promise.all([loadCollections(), loadEnvironments(), loadHistory()]).catch((e) => toast(toAppError(e).message, 'error'));
    return stop;
  });

  function onkey(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const tab = activeTab();
    const k = e.key.toLowerCase();
    if (e.key === 'Enter' && tab) (e.preventDefault(), send(tab));
    else if (k === 't') (e.preventDefault(), newTab());
    else if (k === 'w' && tab) (e.preventDefault(), closeTab(tab.id));
    else if (k === 's' && tab) (e.preventDefault(), saveTab(tab));
  }
</script>

<!-- Soltar un archivo fuera de una zona de importación no debe hacer que la ventana navegue hacia él. -->
<svelte:window
  onkeydown={onkey}
  ondragover={(e) => e.dataTransfer?.types.includes('Files') && e.preventDefault()}
  ondrop={(e) => e.dataTransfer?.types.includes('Files') && e.preventDefault()}
/>

<div class="app">
  <Sidebar bind:view counts={{ collections: countRequests(collections.nodes), environments: envs.items.length, history: history.items.length }} onsettings={() => (showSettings = true)}>
    {#if view === 'collections'}
      <CollectionsPanel onimport={() => (showImport = true)} />
    {:else if view === 'environments'}
      <EnvironmentsPanel onedit={(e) => (editingEnv = e)} />
    {:else}
      <HistoryPanel />
    {/if}
  </Sidebar>
  <main>
    {#if tabs.items.length}
      <Workbench />
    {:else}
      <Welcome onnew={newTab} onimport={() => (showImport = true)} />
    {/if}
  </main>
</div>

{#if showSettings}<SettingsDialog onclose={() => (showSettings = false)} />{/if}
{#if showImport}<ImportDialog onclose={() => (showImport = false)} />{/if}
{#if editingEnv}<EnvironmentDialog env={editingEnv} onclose={() => (editingEnv = null)} />{/if}
<SaveDialog />
<DialogHost />
<Toasts />

<style>
  .app { display: grid; grid-template-columns: 264px 1fr; height: 100%; }
  main { min-width: 0; min-height: 0; background: var(--bg); }
</style>

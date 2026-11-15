<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar, { type View } from './features/sidebar/Sidebar.svelte';
  import SettingsDialog from './features/settings/SettingsDialog.svelte';
  import Welcome from './features/welcome/Welcome.svelte';
  import { initSettings } from './lib/stores/settings.svelte';

  let view = $state<View>('collections');
  let showSettings = $state(false);

  onMount(() => initSettings());
</script>

<div class="app">
  <Sidebar bind:view counts={{}} onsettings={() => (showSettings = true)}>
    <p class="hint">Sin contenido todavía</p>
  </Sidebar>
  <main><Welcome onnew={() => {}} onimport={() => {}} /></main>
</div>

{#if showSettings}<SettingsDialog onclose={() => (showSettings = false)} />{/if}

<style>
  .app { display: grid; grid-template-columns: 264px 1fr; height: 100%; }
  main { min-width: 0; min-height: 0; background: var(--bg); }
  .hint { margin: 16px; color: var(--text-3); }
</style>

<script lang="ts">
  import Tabs from '../../ui/Tabs.svelte';
  import UrlBar from './UrlBar.svelte';
  import KeyValueEditor from './KeyValueEditor.svelte';
  import BodyEditor from './BodyEditor.svelte';
  import AuthEditor from './AuthEditor.svelte';
  import { paramsFromUrl, toCurl, urlWithParams } from '../../lib/request';
  import { activeVars } from '../../lib/stores/environments.svelte';
  import { buildFor, cancel, send, type Tab } from '../../lib/stores/tabs.svelte';
  import { toast } from '../../lib/stores/toast.svelte';

  let { tab }: { tab: Tab } = $props();

  let section = $state('params');
  const r = $derived(tab.request);
  const vars = $derived(activeVars());

  const count = (l: { enabled: boolean; key: string }[]) => l.filter((i) => i.enabled && i.key).length || null;
  const items = $derived([
    { id: 'params', label: 'Params', badge: count(r.params) },
    { id: 'headers', label: 'Headers', badge: count(r.headers) },
    { id: 'body', label: 'Body', badge: r.body.mode !== 'none' ? '•' : null },
    { id: 'auth', label: 'Authorization', badge: r.auth.type !== 'none' ? '•' : null },
  ]);

  // La URL es la fuente de verdad de la query: la tabla se sincroniza en ambos sentidos.
  const urlChanged = () => {
    if (urlWithParams(r.url, r.params) === r.url) return; // la tabla ya refleja la URL
    r.params = paramsFromUrl(r.url, r.params);
  };
  const paramsChanged = () => (r.url = urlWithParams(r.url, r.params));

  async function copyCurl() {
    try {
      await navigator.clipboard.writeText(toCurl(buildFor(tab)));
      toast('Comando cURL copiado');
    } catch {
      toast('No se pudo copiar al portapapeles', 'error');
    }
  }
</script>

<div class="pane">
  <UrlBar
    bind:method={r.method}
    bind:url={r.url}
    {vars}
    loading={tab.loading}
    onurl={urlChanged}
    onsend={() => send(tab)}
    oncancel={() => cancel(tab)}
    oncurl={copyCurl}
  />
  <Tabs {items} bind:active={section} />
  <div class="content">
    {#if section === 'params'}
      <div class="scroll"><KeyValueEditor bind:items={r.params} onchange={paramsChanged} addLabel="Añadir parámetro" /></div>
    {:else if section === 'headers'}
      <div class="scroll"><KeyValueEditor bind:items={r.headers} addLabel="Añadir cabecera" /></div>
    {:else if section === 'body'}
      <BodyEditor bind:body={r.body} {vars} />
    {:else}
      <div class="scroll"><AuthEditor bind:auth={r.auth} /></div>
    {/if}
  </div>
</div>

<style>
  .pane { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .content { flex: 1; min-height: 0; }
  .scroll { height: 100%; overflow: auto; }
</style>

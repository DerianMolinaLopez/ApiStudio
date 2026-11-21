<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import Modal from '../../ui/Modal.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { parseCurl } from '../../lib/importers/curl';
  import { importOpenApi, isOpenApi } from '../../lib/importers/openapi';
  import { importPostmanCollection, importPostmanEnvironment, isPostmanCollection, isPostmanEnvironment } from '../../lib/importers/postman';
  import { importCollection } from '../../lib/stores/collections.svelte';
  import { saveEnvironment, setActiveEnvironment, uniqueEnvironmentName } from '../../lib/stores/environments.svelte';
  import { openRequest } from '../../lib/stores/tabs.svelte';
  import { toast } from '../../lib/stores/toast.svelte';
  import { files, toAppError } from '../../lib/tauri';

  let { onclose }: { onclose: () => void } = $props();

  let curl = $state('');
  let error = $state('');
  let busy = $state(false);
  let summary = $state<{ endpoints: number; env: string | null; warnings: string[] } | null>(null);

  function importCurl() {
    error = '';
    try {
      openRequest(parseCurl(curl));
      toast('Solicitud importada desde cURL');
      onclose();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function importFile() {
    error = '';
    const path = await open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (typeof path !== 'string') return;
    busy = true;
    try {
      const json = JSON.parse(await files.read(path));
      if (isPostmanCollection(json)) {
        await importCollection(importPostmanCollection(json));
        toast('Colección importada');
      } else if (isOpenApi(json)) {
        const r = importOpenApi(json);
        await importCollection(r.collection);
        let envName: string | null = null;
        if (r.environment) {
          const env = { ...r.environment, name: uniqueEnvironmentName(r.environment.name) };
          await saveEnvironment(env);
          setActiveEnvironment(env.id);
          envName = env.name;
        }
        if (r.warnings.length) {
          summary = { endpoints: r.endpoints, env: envName, warnings: r.warnings };
          return;
        }
        toast(`${r.endpoints} endpoints importados`);
      } else if (isPostmanEnvironment(json)) {
        await saveEnvironment(importPostmanEnvironment(json));
        toast('Entorno importado');
      } else {
        throw new Error('El archivo no es una colección de Postman, un entorno de Postman ni un documento OpenAPI/Swagger.');
      }
      onclose();
    } catch (e) {
      error = e instanceof SyntaxError ? 'El archivo no es un JSON válido.' : e instanceof Error ? e.message : toAppError(e).message;
    } finally {
      busy = false;
    }
  }
</script>

<Modal width={560} label="Importar" {onclose}>
  <div class="box">
    <h3>Importar</h3>

    <section>
      <label for="curl">Comando cURL</label>
      <textarea id="curl" class="input" rows="5" bind:value={curl} spellcheck="false" placeholder={"curl -X POST 'https://api.ejemplo.com/v1/users' -H 'Content-Type: application/json' -d '{\"name\":\"Ana\"}'"}></textarea>
      <button class="btn primary" onclick={importCurl} disabled={!curl.trim()}><Icon name="terminal" size={14} /> Importar cURL</button>
    </section>

    <section>
      <span class="lbl">Postman y OpenAPI</span>
      <p>Colecciones y entornos de Postman (v2.0/2.1) o documentos OpenAPI 3.x / Swagger 2.0 en JSON. El tipo se detecta solo.</p>
      <button class="btn" onclick={importFile} disabled={busy}><Icon name="upload" size={14} /> {busy ? 'Importando…' : 'Elegir archivo…'}</button>
    </section>

    {#if summary}
      <div class="summary" role="status">
        <p><strong>{summary.endpoints} endpoints importados.</strong>{#if summary.env}{' '}Se creó y activó el entorno «{summary.env}».{/if}</p>
        <ul>{#each summary.warnings as w}<li>{w}</li>{/each}</ul>
        <button class="btn primary" onclick={onclose}>Listo</button>
      </div>
    {/if}
    {#if error}<p class="err" role="alert">{error}</p>{/if}
  </div>
</Modal>

<style>
  .box { width: 100%; padding: 20px 22px 22px; display: flex; flex-direction: column; gap: 18px; }
  h3 { margin: 0; font-size: var(--text-lg); font-weight: 600; }
  section { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  section + section { padding-top: 16px; border-top: 1px solid var(--border); }
  label, .lbl { font-weight: 500; }
  p { margin: 0; color: var(--text-2); }
  textarea { width: 100%; height: auto; padding: 8px 10px; resize: vertical; font: 400 var(--text-sm) / 1.5 var(--font-mono); user-select: text; }
  .err { color: var(--danger); }
  .summary { padding: 12px 14px; background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--radius); display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  .summary ul { margin: 0; padding-left: 18px; color: var(--warn); }
  .summary strong { color: var(--ok); }
</style>

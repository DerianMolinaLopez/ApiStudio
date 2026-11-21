<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import Modal from '../../ui/Modal.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { parseCurl } from '../../lib/importers/curl';
  import { detectKind } from '../../lib/importers/detect';
  import { importOpenApi } from '../../lib/importers/openapi';
  import { importPostmanCollection, importPostmanEnvironment } from '../../lib/importers/postman';
  import { importCollection } from '../../lib/stores/collections.svelte';
  import { saveEnvironment, setActiveEnvironment, uniqueEnvironmentName } from '../../lib/stores/environments.svelte';
  import { openRequest } from '../../lib/stores/tabs.svelte';
  import { toast } from '../../lib/stores/toast.svelte';
  import { files, toAppError } from '../../lib/tauri';

  let { onclose }: { onclose: () => void } = $props();

  const MAX_BYTES = 25 * 1024 * 1024;

  interface Outcome { file: string; message: string; warnings: string[] }

  let curl = $state('');
  let error = $state('');
  let busy = $state(false);
  let dragging = $state(false);
  let report = $state<Outcome[] | null>(null);
  let zone = $state<HTMLDivElement>();

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

  /** Importa el contenido de un archivo JSON (Postman u OpenAPI). Lanza Error con un mensaje para el usuario. */
  async function importJsonText(file: string, text: string): Promise<Outcome> {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('no es un JSON válido (los archivos YAML todavía no están soportados)');
    }
    const kind = detectKind(json);
    if (kind === 'postman-collection') {
      await importCollection(importPostmanCollection(json as Record<string, unknown>));
      return { file, message: 'Colección de Postman importada', warnings: [] };
    }
    if (kind === 'postman-environment') {
      await saveEnvironment(importPostmanEnvironment(json as Record<string, unknown>));
      return { file, message: 'Entorno de Postman importado', warnings: [] };
    }
    if (kind === 'openapi') {
      const r = importOpenApi(json as Record<string, unknown>);
      await importCollection(r.collection);
      let env = '';
      if (r.environment) {
        const e = { ...r.environment, name: uniqueEnvironmentName(r.environment.name) };
        await saveEnvironment(e);
        setActiveEnvironment(e.id);
        env = ` Se creó y activó el entorno «${e.name}».`;
      }
      return { file, message: `${r.endpoints} endpoints importados.${env}`, warnings: r.warnings };
    }
    throw new Error('no es una colección ni un entorno de Postman, ni un documento OpenAPI/Swagger');
  }

  /** Procesa varios archivos en orden y cierra el diálogo si todo salió bien y sin avisos. */
  async function run(items: { name: string; read: () => Promise<string> }[]) {
    error = '';
    report = null;
    busy = true;
    const done: Outcome[] = [];
    const failed: string[] = [];
    for (const it of items) {
      try {
        done.push(await importJsonText(it.name, await it.read()));
      } catch (e) {
        const msg = e instanceof Error ? e.message : toAppError(e).message;
        failed.push(`${it.name}: ${msg}`);
      }
    }
    busy = false;
    error = failed.join('\n');
    if (!done.length) return;
    if (!failed.length && done.every((d) => d.warnings.length === 0)) {
      toast(done.length === 1 ? done[0].message : `${done.length} archivos importados`);
      onclose();
    } else {
      report = done;
    }
  }

  async function pickFile() {
    const path = await open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (typeof path === 'string') await run([{ name: path.split(/[\\/]/).pop() ?? path, read: () => files.read(path) }]);
  }

  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

  function onDragOver(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    dragging = true;
  }
  function onDragLeave(e: DragEvent) {
    if (!zone?.contains(e.relatedTarget as Node | null)) dragging = false;
  }
  async function onDrop(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragging = false;
    const dropped = [...(e.dataTransfer?.files ?? [])];
    if (!dropped.length) return void (error = 'No se recibió ningún archivo.');
    await run(
      dropped.map((f) => ({
        name: f.name,
        read: async () => {
          if (f.size > MAX_BYTES) throw new Error('el archivo supera los 25 MB');
          return f.text();
        },
      })),
    );
  }
</script>

<Modal width={560} label="Importar" {onclose}>
  <div class="box">
    <h3>Importar</h3>

    <section>
      <label for="curl">Comando cURL</label>
      <textarea id="curl" class="input" rows="4" bind:value={curl} spellcheck="false" placeholder={"curl -X POST 'https://api.ejemplo.com/v1/users' -H 'Content-Type: application/json' -d '{\"name\":\"Ana\"}'"}></textarea>
      <button class="btn primary" onclick={importCurl} disabled={!curl.trim()}><Icon name="terminal" size={14} /> Importar cURL</button>
    </section>

    <section>
      <span class="lbl">Postman y OpenAPI</span>
      <div
        class="drop"
        class:over={dragging}
        class:busy
        bind:this={zone}
        role="group"
        aria-label="Zona para soltar archivos"
        ondragenter={onDragOver}
        ondragover={onDragOver}
        ondragleave={onDragLeave}
        ondrop={onDrop}
      >
        <Icon name="upload" size={26} stroke={1.5} />
        {#if busy}
          <strong>Importando…</strong>
        {:else}
          <strong>{dragging ? 'Suelta el archivo para importarlo' : 'Arrastra aquí tu archivo .json'}</strong>
          <p>Colecciones y entornos de Postman (v2.0/2.1) o documentos OpenAPI 3.x / Swagger 2.0. El tipo se detecta solo.</p>
          <button class="btn" onclick={pickFile}>o elegir archivo…</button>
        {/if}
      </div>
    </section>

    {#if report}
      <div class="summary" role="status">
        {#each report as r}
          <p><strong>{r.file}</strong> · {r.message}</p>
          {#if r.warnings.length}<ul>{#each r.warnings as w}<li>{w}</li>{/each}</ul>{/if}
        {/each}
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

  .drop { align-self: stretch; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 22px 16px; text-align: center; color: var(--text-2); background: var(--bg); border: 1.5px dashed var(--border-strong); border-radius: var(--radius-lg); transition: border-color var(--dur-fast), background var(--dur-fast), color var(--dur-fast); }
  .drop strong { color: var(--text); font-weight: 600; }
  .drop p { font-size: var(--text-sm); max-width: 44ch; margin-bottom: 4px; }
  .drop.over { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
  .drop.over strong { color: var(--accent); }
  .drop.busy { opacity: 0.7; }

  .err { color: var(--danger); white-space: pre-line; }
  .summary { padding: 12px 14px; background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--radius); display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .summary strong { color: var(--ok); }
  .summary ul { margin: 0; padding-left: 18px; color: var(--warn); }
</style>

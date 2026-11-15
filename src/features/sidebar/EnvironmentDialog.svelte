<script lang="ts">
  import Modal from '../../ui/Modal.svelte';
  import KeyValueEditor from '../request/KeyValueEditor.svelte';
  import { saveEnvironment, type Environment } from '../../lib/stores/environments.svelte';
  import { toast } from '../../lib/stores/toast.svelte';
  import { toAppError } from '../../lib/tauri';

  let { env, onclose }: { env: Environment; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  let draft = $state<Environment>(structuredClone($state.snapshot(env)));

  async function save(e: Event) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    draft.variables = draft.variables.filter((v) => v.key.trim() !== '' || v.value !== '');
    try {
      await saveEnvironment({ ...draft, name: draft.name.trim() });
      toast('Entorno guardado');
      onclose();
    } catch (err) {
      toast(toAppError(err).message, 'error');
    }
  }
</script>

<Modal width={680} label="Editar entorno" {onclose}>
  <form class="box" onsubmit={save}>
    <h3>Entorno</h3>
    <label>Nombre
      <!-- svelte-ignore a11y_autofocus -->
      <input class="input" bind:value={draft.name} autofocus spellcheck="false" />
    </label>
    <div class="vars">
      <KeyValueEditor bind:items={draft.variables} addLabel="Añadir variable" keyPlaceholder="host" valuePlaceholder="https://api.ejemplo.com" />
    </div>
    <p class="note">Úsalas en la URL, cabeceras y body como <code>{'{{host}}'}</code>. Se guardan en archivos JSON dentro de tu workspace; no pongas secretos en entornos que vayas a subir a Git.</p>
    <div class="actions">
      <button type="button" class="btn ghost" onclick={onclose}>Cancelar</button>
      <button type="submit" class="btn primary" disabled={!draft.name.trim()}>Guardar</button>
    </div>
  </form>
</Modal>

<style>
  .box { width: 100%; padding: 20px; display: flex; flex-direction: column; gap: 14px; min-height: 0; }
  h3 { margin: 0; font-size: var(--text-lg); font-weight: 600; }
  label { display: flex; flex-direction: column; gap: 6px; color: var(--text-2); }
  .input { height: 34px; }
  .vars { border: 1px solid var(--border); border-radius: var(--radius); max-height: 320px; overflow: auto; background: var(--bg); }
  .note { margin: 0; color: var(--text-3); font-size: var(--text-sm); }
  .note code { font-family: var(--font-mono); color: var(--ok); }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>

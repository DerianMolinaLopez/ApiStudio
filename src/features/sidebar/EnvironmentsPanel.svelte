<script lang="ts">
  import Icon from '../../ui/Icon.svelte';
  import { askConfirm } from '../../ui/dialogs.svelte';
  import { envs, newEnvironment, removeEnvironment, setActiveEnvironment, type Environment } from '../../lib/stores/environments.svelte';

  let { onedit }: { onedit: (env: Environment) => void } = $props();

  async function remove(env: Environment) {
    if (await askConfirm('Eliminar entorno', `Se eliminará el entorno «${env.name}».`)) await removeEnvironment(env.id);
  }
</script>

<div class="panel">
  <header>
    <h2>Entornos</h2>
    <button class="btn primary" onclick={() => onedit(newEnvironment())}><Icon name="plus" size={14} /> Nuevo</button>
  </header>

  {#if envs.items.length === 0}
    <div class="empty">
      <span class="mark"><Icon name="globe" size={26} stroke={1.5} /></span>
      <strong>Variables por entorno</strong>
      <p>Define variables como <code>{'{{host}}'}</code> y cambia de entorno (local, staging, producción) sin editar tus solicitudes.</p>
      <button class="btn primary" onclick={() => onedit(newEnvironment())}>Crear entorno</button>
    </div>
  {:else}
    <div class="list" role="radiogroup" aria-label="Entorno activo">
      <button class="row" role="radio" aria-checked={envs.activeId === null} class:on={envs.activeId === null} onclick={() => setActiveEnvironment(null)}>
        <span class="dot"></span><span class="name muted">Sin entorno</span>
      </button>
      {#each envs.items as env (env.id)}
        <div class="row-wrap">
          <button class="row" role="radio" aria-checked={envs.activeId === env.id} class:on={envs.activeId === env.id} onclick={() => setActiveEnvironment(env.id)}>
            <span class="dot"></span><span class="name">{env.name}</span><span class="n">{env.variables.length}</span>
          </button>
          <span class="acts">
            <button class="icon-btn" onclick={() => onedit(structuredClone($state.snapshot(env)))} aria-label="Editar"><Icon name="edit" size={14} /></button>
            <button class="icon-btn" onclick={() => remove(env)} aria-label="Eliminar"><Icon name="trash" size={14} /></button>
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .panel { display: flex; flex-direction: column; min-height: 0; flex: 1; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 8px; }
  h2 { margin: 0; font-size: var(--text-md); font-weight: 600; }
  header .btn { height: 26px; padding: 0 10px; }
  .list { padding: 0 6px; overflow: auto; }
  .row-wrap { position: relative; }
  .row { display: flex; align-items: center; gap: 10px; width: 100%; height: 30px; padding: 0 10px; border-radius: var(--radius); color: var(--text-2); text-align: left; }
  .row:hover { background: var(--hover); color: var(--text); }
  .row.on { color: var(--text); }
  .dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--text-3); flex: none; }
  .on .dot { background: var(--ok); border-color: var(--ok); }
  .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .muted { font-style: italic; }
  .n { color: var(--text-3); font-size: var(--text-xs); }
  .acts { position: absolute; right: 4px; top: 2px; display: none; background: var(--hover); border-radius: var(--radius); }
  .row-wrap:hover .acts { display: flex; }
  .row-wrap:hover .n { visibility: hidden; }
  .empty { margin: 8px 12px; padding: 18px 14px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; background: var(--bg); border: 1px dashed var(--border-strong); border-radius: var(--radius-lg); }
  .empty p { margin: 0 0 8px; color: var(--text-2); font-size: var(--text-sm); }
  .empty code { font-family: var(--font-mono); color: var(--ok); }
  .mark { color: var(--accent); }
</style>

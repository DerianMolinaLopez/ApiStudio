<script lang="ts">
  import Icon from '../../ui/Icon.svelte';
  import { askConfirm } from '../../ui/dialogs.svelte';
  import { clearHistory, history, removeHistory } from '../../lib/stores/history.svelte';
  import { formatBytes, formatTime } from '../../lib/format';
  import { hydrate } from '../../lib/stores/collections.svelte';
  import { openRequest } from '../../lib/stores/tabs.svelte';
  import type { HistoryEntry } from '../../lib/types';

  let filter = $state('');
  const rows = $derived(history.items.filter((h) => `${h.method} ${h.url}`.toLowerCase().includes(filter.toLowerCase())));
  const short: Record<string, string> = { DELETE: 'DEL', OPTIONS: 'OPT' };
  const tone = (s: number) => (s < 300 ? 'ok' : s < 400 ? 'info' : s < 500 ? 'warn' : 'danger');

  function ago(ts: number): string {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'ahora';
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    return new Date(ts).toLocaleDateString();
  }
  function reopen(h: HistoryEntry) {
    openRequest({ ...hydrate(h.request), id: crypto.randomUUID() });
  }
  async function clear() {
    if (await askConfirm('Borrar historial', 'Se eliminarán todas las entradas del historial.', 'Borrar')) await clearHistory();
  }
</script>

<div class="panel">
  <header>
    <h2>Historial</h2>
    {#if history.items.length}<button class="btn ghost" onclick={clear}>Borrar todo</button>{/if}
  </header>
  <div class="search"><Icon name="search" size={14} /><input bind:value={filter} placeholder="Buscar en el historial…" spellcheck="false" /></div>
  <div class="list">
    {#each rows as h (h.id)}
      <div class="row">
        <button class="main" onclick={() => reopen(h)} title={h.url}>
          <span class="top">
            <span class="m" style:color="var(--m-{h.method.toLowerCase()})">{short[h.method] ?? h.method}</span>
            <span class="url">{h.url}</span>
          </span>
          <span class="meta">
            <span class="st {tone(h.status)}">{h.status}</span>{formatTime(h.timeMs)} · {formatBytes(h.sizeBytes)} · {ago(h.ts)}
          </span>
        </button>
        <button class="icon-btn del" onclick={() => removeHistory(h.id)} aria-label="Quitar del historial"><Icon name="x" size={13} /></button>
      </div>
    {:else}
      <p class="empty">{history.items.length ? 'Sin resultados.' : 'Las solicitudes que envíes aparecerán aquí.'}</p>
    {/each}
  </div>
</div>

<style>
  .panel { display: flex; flex-direction: column; min-height: 0; flex: 1; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 8px; }
  h2 { margin: 0; font-size: var(--text-md); font-weight: 600; }
  header .btn { height: 24px; padding: 0 8px; font-size: var(--text-sm); }
  .search { display: flex; align-items: center; gap: 8px; margin: 0 12px 8px; padding: 0 10px; height: 30px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text-3); }
  .search:focus-within { border-color: var(--accent); }
  .search input { flex: 1; min-width: 0; background: transparent; border: 0; color: var(--text); }
  .search input:focus { outline: none; }
  .list { flex: 1; overflow: auto; padding: 0 6px 12px; }
  .row { display: flex; align-items: center; border-radius: var(--radius); }
  .row:hover { background: var(--hover); }
  .main { flex: 1; min-width: 0; overflow: hidden; padding: 6px 8px; text-align: left; display: flex; flex-direction: column; gap: 2px; }
  .top { display: flex; gap: 8px; align-items: baseline; min-width: 0; width: 100%; }
  .m { font-size: 10px; font-weight: 700; width: 28px; flex: none; }
  .url { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); font-size: var(--text-sm); }
  .meta { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 36px; color: var(--text-3); font-size: var(--text-xs); }
  .st { font-weight: 600; margin-right: 6px; }
  .st.ok { color: var(--ok); } .st.info { color: var(--info); } .st.warn { color: var(--warn); } .st.danger { color: var(--danger); }
  .del { opacity: 0; margin-right: 4px; }
  .row:hover .del { opacity: 1; }
  .empty { margin: 16px 8px; color: var(--text-3); text-align: center; }
</style>

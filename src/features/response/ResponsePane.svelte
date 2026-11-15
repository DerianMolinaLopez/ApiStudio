<script lang="ts">
  import Tabs from '../../ui/Tabs.svelte';
  import Icon from '../../ui/Icon.svelte';
  import CodeEditor from '../../ui/CodeEditor.svelte';
  import { detectLang, formatBytes, formatTime, headerValue, pretty } from '../../lib/format';
  import { cancel, type Tab } from '../../lib/stores/tabs.svelte';
  import { toast } from '../../lib/stores/toast.svelte';

  let { tab }: { tab: Tab } = $props();

  let section = $state('body');
  let view = $state<'pretty' | 'raw' | 'preview'>('pretty');

  const res = $derived(tab.response);
  const tone = $derived(!res ? '' : res.status < 300 ? 'ok' : res.status < 400 ? 'info' : res.status < 500 ? 'warn' : 'danger');
  const lang = $derived(res ? detectLang(headerValue(res.headers, 'content-type'), res.body) : 'text');
  const shown = $derived(!res ? '' : view === 'pretty' ? pretty(res.body, lang) : res.body);
  const tabs = $derived([
    { id: 'body', label: 'Body' },
    { id: 'headers', label: 'Headers', badge: res?.headers.length || null },
    { id: 'cookies', label: 'Cookies', badge: res?.cookies.length || null },
  ]);

  const errorTitle: Record<string, string> = {
    network: 'No se pudo completar la solicitud',
    timeout: 'La solicitud tardó demasiado',
    invalidRequest: 'La solicitud no es válida',
    io: 'No se pudo leer un archivo',
    storage: 'Error de almacenamiento',
    cancelled: 'Cancelada',
  };

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copiado');
    } catch {
      toast('No se pudo copiar', 'error');
    }
  }
</script>

<div class="pane">
  {#if tab.loading}
    <div class="state">
      <span class="spinner" aria-hidden="true"></span>
      <p>Enviando solicitud…</p>
      <button class="btn" onclick={() => cancel(tab)}>Cancelar</button>
    </div>
  {:else if tab.error}
    <div class="state error" role="alert">
      <Icon name="alert-circle" size={28} />
      <h3>{errorTitle[tab.error.kind] ?? 'Error'}</h3>
      <p class="mono">{tab.error.message}</p>
      {#if tab.error.kind === 'network'}<p class="tip">Revisa la URL, tu conexión y, si usas HTTPS local, la verificación TLS en Ajustes.</p>{/if}
      {#if tab.error.kind === 'timeout'}<p class="tip">Puedes subir el tiempo límite en Ajustes → Solicitudes.</p>{/if}
    </div>
  {:else if !res}
    <div class="state">
      <Icon name="send" size={26} />
      <h3>Aún no hay respuesta</h3>
      <p>Envía la solicitud con el botón Enviar o con <kbd>Ctrl</kbd> + <kbd>Enter</kbd>.</p>
    </div>
  {:else}
    <div class="top">
      <Tabs items={tabs} bind:active={section} />
      <div class="stats">
        <span class="status {tone}" title={res.httpVersion}>{res.status} {res.statusText}</span>
        <span class="stat" title="Tiempo hasta recibir la primera respuesta: {formatTime(res.ttfbMs)}">{formatTime(res.timeMs)}</span>
        <span class="stat">{formatBytes(res.sizeBytes)}</span>
      </div>
    </div>

    {#if section === 'body'}
      <div class="toolbar">
        <div class="seg" role="radiogroup" aria-label="Vista">
          <button class:on={view === 'pretty'} onclick={() => (view = 'pretty')}>Pretty</button>
          <button class:on={view === 'raw'} onclick={() => (view = 'raw')}>Raw</button>
          {#if lang === 'html'}<button class:on={view === 'preview'} onclick={() => (view = 'preview')}>Preview</button>{/if}
        </div>
        <span class="lang">{lang === 'text' ? 'Texto' : lang.toUpperCase()}</span>
        <span class="grow"></span>
        <button class="icon-btn" onclick={() => copy(res.body)} title="Copiar cuerpo" aria-label="Copiar cuerpo"><Icon name="copy" size={15} /></button>
      </div>
      <div class="view">
        {#if res.isBinary}
          <p class="note">Respuesta binaria ({formatBytes(res.sizeBytes)}). Este tipo de contenido todavía no se puede mostrar.</p>
        {:else if res.body === ''}
          <p class="note">La respuesta no tiene cuerpo.</p>
        {:else if view === 'preview' && lang === 'html'}
          <iframe title="Vista previa" sandbox="" srcdoc={res.body}></iframe>
        {:else}
          <CodeEditor value={shown} lang={view === 'raw' ? 'text' : lang} readonly />
        {/if}
      </div>
    {:else if section === 'headers'}
      <div class="view scroll">
        <table>
          <tbody>
            {#each res.headers as h}<tr><th>{h.key}</th><td class="mono">{h.value}</td></tr>{/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="view scroll">
        {#if res.cookies.length === 0}
          <p class="note">El servidor no envió cookies.</p>
        {:else}
          <table class="cookies">
            <thead><tr><th>Nombre</th><th>Valor</th><th>Dominio</th><th>Ruta</th><th>Expira</th><th>Flags</th></tr></thead>
            <tbody>
              {#each res.cookies as c}
                <tr>
                  <td>{c.name}</td><td class="mono">{c.value}</td><td>{c.domain ?? '—'}</td><td>{c.path ?? '—'}</td><td>{c.expires ?? 'Sesión'}</td>
                  <td>{[c.secure && 'Secure', c.httpOnly && 'HttpOnly', c.sameSite].filter(Boolean).join(', ') || '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .pane { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg); }
  .top { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding-right: 14px; }
  .top :global(.tabs) { border-bottom: 0; }
  .stats { display: flex; align-items: center; gap: 12px; font-size: var(--text-sm); }
  .stat { color: var(--text-2); font-variant-numeric: tabular-nums; }
  .status { padding: 2px 9px; border-radius: var(--radius-sm); font-weight: 600; font-variant-numeric: tabular-nums; background: color-mix(in srgb, var(--c) 15%, transparent); color: var(--c); }
  .status.ok { --c: var(--ok); } .status.info { --c: var(--info); } .status.warn { --c: var(--warn); } .status.danger { --c: var(--danger); }

  .toolbar { display: flex; align-items: center; gap: 10px; padding: 7px 12px; border-bottom: 1px solid var(--border); }
  .seg { display: flex; padding: 2px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
  .seg button { height: 22px; padding: 0 10px; border-radius: var(--radius-sm); color: var(--text-2); }
  .seg button:hover { color: var(--text); }
  .seg button.on { background: var(--elevated); color: var(--text); box-shadow: var(--shadow-sm); }
  .lang { color: var(--text-3); font-size: var(--text-xs); }
  .grow { flex: 1; }

  .view { flex: 1; min-height: 0; }
  .view.scroll { overflow: auto; }
  iframe { width: 100%; height: 100%; border: 0; background: #fff; }
  .note { margin: 0; padding: 20px 16px; color: var(--text-3); }

  table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); user-select: text; }
  th, td { text-align: left; padding: 7px 14px; border-bottom: 1px solid var(--border); vertical-align: top; word-break: break-all; }
  tbody th { width: 240px; font-weight: 500; color: var(--text-2); }
  thead th { color: var(--text-2); font-weight: 500; position: sticky; top: 0; background: var(--surface); }
  .mono { font-family: var(--font-mono); }

  .state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; color: var(--text-2); }
  .state h3 { margin: 6px 0 0; color: var(--text); font-size: var(--text-lg); font-weight: 600; }
  .state p { margin: 0; max-width: 56ch; }
  .state.error { color: var(--danger); }
  .state.error p.mono { color: var(--text); font-size: var(--text-sm); user-select: text; padding: 8px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
  .tip { color: var(--text-2); }
  kbd { font: 500 var(--text-xs) var(--font-mono); padding: 1px 6px; background: var(--elevated); border: 1px solid var(--border-strong); border-bottom-width: 2px; border-radius: 4px; color: var(--text); }
  .spinner { width: 22px; height: 22px; border: 2px solid var(--border-strong); border-top-color: var(--accent); border-radius: 50%; animation: spin 700ms linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>

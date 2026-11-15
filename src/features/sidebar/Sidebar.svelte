<script module lang="ts">
  export type View = 'collections' | 'environments' | 'history';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../../ui/Icon.svelte';
  import mark from '../../assets/mark.png';
  import type { IconName } from '../../ui/icons';

  let {
    view = $bindable(),
    counts,
    onsettings,
    children,
  }: { view: View; counts: Partial<Record<View, number>>; onsettings: () => void; children: Snippet } = $props();

  const items: { id: View; label: string; icon: IconName }[] = [
    { id: 'collections', label: 'Colecciones', icon: 'layers' },
    { id: 'environments', label: 'Entornos', icon: 'globe' },
    { id: 'history', label: 'Historial', icon: 'history' },
  ];
</script>

<aside>
  <header>
    <img class="logo" src={mark} alt="" width="30" height="20" />
    <span class="name">API Studio</span>
  </header>

  <nav aria-label="Secciones">
    {#each items as it}
      <button class:active={view === it.id} onclick={() => (view = it.id)}>
        <Icon name={it.icon} size={16} />
        <span>{it.label}</span>
        {#if counts[it.id]}<span class="count">{counts[it.id]}</span>{/if}
      </button>
    {/each}
    <button onclick={onsettings}><Icon name="settings" size={16} /><span>Ajustes</span></button>
  </nav>

  <div class="panel">{@render children()}</div>

  <div class="tip">
    <Icon name="star" size={14} />
    <div>
      <strong>Consejo</strong>
      <p>Usa entornos para gestionar tus variables y cambiar de servidor con un clic.</p>
      <button onclick={() => (view = 'environments')}>Ver entornos</button>
    </div>
  </div>
</aside>

<style>
  aside { display: flex; flex-direction: column; background: var(--surface); border-right: 1px solid var(--border); min-height: 0; }
  header { display: flex; align-items: center; gap: 10px; padding: 14px 16px 10px; }
  .logo { display: block; object-fit: contain; }
  .name { font-weight: 600; font-size: var(--text-lg); letter-spacing: -0.01em; }
  nav { display: flex; flex-direction: column; gap: 1px; padding: 6px 8px 10px; border-bottom: 1px solid var(--border); }
  nav button { display: flex; align-items: center; gap: 10px; height: 32px; padding: 0 10px; border-radius: var(--radius); color: var(--text-2); text-align: left; transition: background var(--dur-fast), color var(--dur-fast); }
  nav button span:first-of-type:not(.count) { flex: 1; }
  nav button:hover { background: var(--hover); color: var(--text); }
  nav button.active { background: var(--accent-soft); color: var(--accent); }
  .count { min-width: 20px; padding: 0 6px; height: 18px; line-height: 18px; text-align: center; border-radius: 9px; background: var(--accent-soft); color: var(--accent); font-size: var(--text-xs); font-weight: 600; }
  .panel { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .tip { display: flex; gap: 10px; margin: 8px; padding: 10px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-lg); color: var(--accent); }
  .tip strong { color: var(--text); font-weight: 600; }
  .tip p { margin: 2px 0 6px; color: var(--text-2); font-size: var(--text-sm); }
  .tip button { color: var(--accent); font-size: var(--text-sm); }
  .tip button:hover { color: var(--accent-hover); }
</style>

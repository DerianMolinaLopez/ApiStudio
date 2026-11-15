<script lang="ts">
  import Modal from '../../ui/Modal.svelte';
  import Icon from '../../ui/Icon.svelte';
  import Select from '../../ui/Select.svelte';
  import { ACCENTS, MONO_FONTS, settings, type SchemePref } from '../../lib/stores/settings.svelte';
  import type { IconName } from '../../ui/icons';

  let { onclose }: { onclose: () => void } = $props();

  type Section = 'appearance' | 'editor' | 'requests';
  let section = $state<Section>('appearance');

  const sections: { id: Section; label: string; icon: IconName }[] = [
    { id: 'appearance', label: 'Apariencia', icon: 'palette' },
    { id: 'editor', label: 'Editor', icon: 'code' },
    { id: 'requests', label: 'Solicitudes', icon: 'sliders' },
  ];
  const schemes: { id: SchemePref; label: string }[] = [
    { id: 'dark', label: 'Oscuro' },
    { id: 'light', label: 'Claro' },
    { id: 'system', label: 'Sistema' },
  ];
  const accentNames: Record<string, string> = {
    violet: 'Violeta', blue: 'Azul', teal: 'Turquesa', green: 'Verde', amber: 'Ámbar', red: 'Rojo', pink: 'Rosa',
  };
  const sizes = [11, 12, 13, 14, 15, 16];
</script>

<Modal {onclose} width={760} label="Ajustes">
  <nav class="nav">
    <h2>Ajustes</h2>
    {#each sections as s}
      <button class:active={section === s.id} onclick={() => (section = s.id)}>
        <Icon name={s.icon} size={15} /> {s.label}
      </button>
    {/each}
  </nav>

  <div class="content">
    {#if section === 'appearance'}
      <h3>Apariencia</h3>
      <p class="label">Tema</p>
      <div class="themes" role="radiogroup" aria-label="Tema">
        {#each schemes as s}
          <button class="theme" class:selected={settings.scheme === s.id} role="radio" aria-checked={settings.scheme === s.id} onclick={() => (settings.scheme = s.id)}>
            <span class="thumb" data-scheme={s.id === 'system' ? undefined : s.id} class:split={s.id === 'system'}>
              {#if s.id === 'system'}
                <span class="half" data-scheme="light"></span><span class="half" data-scheme="dark"></span>
              {:else}
                <span class="bar"></span><span class="line w1"></span><span class="line w2"></span>
              {/if}
            </span>
            {s.label}
          </button>
        {/each}
      </div>

      <p class="label">Color de acento</p>
      <div class="accents" role="radiogroup" aria-label="Color de acento">
        {#each ACCENTS as a}
          <button
            class="swatch"
            class:selected={settings.accent === a}
            style:--c="var(--swatch-{a})"
            role="radio"
            aria-checked={settings.accent === a}
            aria-label={accentNames[a]}
            title={accentNames[a]}
            onclick={() => (settings.accent = a)}
          ></button>
        {/each}
      </div>
    {:else if section === 'editor'}
      <h3>Editor</h3>
      <div class="row">
        <label for="ff">Fuente</label>
        <Select bind:value={settings.fontFamily} options={Object.keys(MONO_FONTS)} width={170} ariaLabel="Fuente del editor" />
      </div>
      <div class="row">
        <label for="fs">Tamaño</label>
        <Select bind:value={settings.fontSize} options={sizes.map((n) => ({ value: n, label: `${n}px` }))} width={100} ariaLabel="Tamaño de fuente" />
      </div>
      <pre class="sample">{'{ "status": "success", "id": 42 }'}</pre>
    {:else}
      <h3>Solicitudes</h3>
      <div class="row">
        <label for="to">Tiempo límite (ms, 0 = sin límite)</label>
        <input id="to" type="number" min="0" step="1000" bind:value={settings.timeoutMs} />
      </div>
      <label class="check"><input type="checkbox" bind:checked={settings.followRedirects} /> Seguir redirecciones</label>
      <label class="check"><input type="checkbox" bind:checked={settings.verifyTls} /> Verificar certificados TLS</label>
    {/if}
  </div>
</Modal>

<style>
  .nav { width: 190px; flex: none; padding: 16px 10px; background: var(--bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 2px; }
  h2 { margin: 2px 8px 12px; font-size: var(--text-lg); font-weight: 600; }
  .nav button { display: flex; align-items: center; gap: 10px; height: 32px; padding: 0 10px; border-radius: var(--radius); color: var(--text-2); text-align: left; transition: background var(--dur-fast), color var(--dur-fast); }
  .nav button:hover { background: var(--hover); color: var(--text); }
  .nav button.active { background: var(--accent-soft); color: var(--accent); }

  .content { flex: 1; min-height: 420px; padding: 20px 28px 28px; overflow: auto; }
  h3 { margin: 0 0 18px; font-size: var(--text-lg); font-weight: 600; }
  .label { margin: 18px 0 10px; color: var(--text-2); font-size: var(--text-sm); }

  .themes { display: flex; gap: 14px; }
  .theme { display: flex; flex-direction: column; gap: 8px; align-items: center; color: var(--text-2); font-size: var(--text-sm); }
  .theme.selected { color: var(--text); }
  .thumb { width: 112px; height: 68px; border-radius: var(--radius); background: var(--bg); border: 1px solid var(--border-strong); position: relative; display: block; overflow: hidden; transition: border-color var(--dur-fast), box-shadow var(--dur-fast); }
  .theme:hover .thumb { border-color: var(--text-3); }
  .theme.selected .thumb { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  .thumb .bar { position: absolute; left: 0; top: 0; bottom: 0; width: 26px; background: var(--surface); border-right: 1px solid var(--border); }
  .thumb .line { position: absolute; left: 36px; height: 5px; border-radius: 3px; background: var(--accent); opacity: 0.8; }
  .thumb .line.w1 { top: 16px; width: 50px; }
  .thumb .line.w2 { top: 30px; width: 34px; background: var(--text-3); opacity: 0.5; }
  .thumb.split { display: flex; }
  .half { flex: 1; background: var(--bg); }

  .accents { display: flex; gap: 12px; }
  .swatch { width: 24px; height: 24px; border-radius: 50%; background: var(--c); position: relative; transition: transform var(--dur-fast); }
  .swatch:hover { transform: scale(1.1); }
  .swatch.selected::after { content: ''; position: absolute; inset: -5px; border: 2px solid var(--c); border-radius: 50%; }

  .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .row label { color: var(--text); }
  input[type='number'] { width: 110px; height: var(--row-h); padding: 0 10px; background: var(--elevated); border: 1px solid var(--border); border-radius: var(--radius); }
  input[type='number']:focus-visible { outline: none; border-color: var(--accent); }
  .check { display: flex; align-items: center; gap: 10px; padding: 10px 0; }
  input[type='checkbox'] { accent-color: var(--accent); width: 15px; height: 15px; }
  .sample { margin: 18px 0 0; padding: 12px 14px; background: var(--editor-bg); border: 1px solid var(--border); border-radius: var(--radius); font: 400 var(--editor-font-size) / 1.5 var(--font-mono); color: var(--text-2); }
</style>

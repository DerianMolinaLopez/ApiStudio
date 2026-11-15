<script lang="ts">
  import Icon from '../../ui/Icon.svelte';
  let { onnew, onimport }: { onnew: () => void; onimport: () => void } = $props();
</script>

<section>
  <div class="mark"><Icon name="bolt" size={44} stroke={1.5} /></div>
  <h1>Bienvenido a API Studio</h1>
  <p>Un cliente HTTP moderno para desarrolladores. Todo se guarda en tu equipo.</p>
  <button class="primary" onclick={onnew}><Icon name="send" size={15} /> Crear una solicitud</button>
  <button class="link" onclick={onimport}><Icon name="upload" size={14} /> Importar desde archivo</button>
</section>

<style>
  section { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; padding: 24px; }
  .mark { color: var(--accent); margin-bottom: 6px; }
  h1 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: -0.01em; }
  p { margin: 0 0 18px; color: var(--text-2); max-width: 42ch; }
  .primary { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 16px; border-radius: var(--radius); background: var(--accent); color: var(--accent-contrast); font-weight: 600; transition: background var(--dur-fast); }
  .primary:hover { background: var(--accent-hover); }
  .link { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; color: var(--text-2); padding: 6px 8px; border-radius: var(--radius); }
  .link:hover { color: var(--text); background: var(--hover); }
</style>

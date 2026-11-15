<script lang="ts">
  import Modal from './Modal.svelte';
  import { dialog } from './dialogs.svelte';

  const d = $derived(dialog.current);
  let text = $state('');
  $effect(() => { if (d?.kind === 'prompt') text = d.value; });

  function close(result: string | boolean | null) {
    const cur = dialog.current;
    dialog.current = null;
    if (!cur) return;
    if (cur.kind === 'prompt') cur.resolve(typeof result === 'string' ? result : null);
    else cur.resolve(result === true);
  }
  function submit(e: Event) {
    e.preventDefault();
    if (d?.kind === 'prompt') text.trim() && close(text.trim());
    else close(true);
  }
</script>

{#if d}
  <Modal width={420} label={d.title} onclose={() => close(d.kind === 'prompt' ? null : false)}>
    <form class="box" onsubmit={submit}>
      <h3>{d.title}</h3>
      {#if d.kind === 'prompt'}
        <!-- svelte-ignore a11y_autofocus -->
        <input class="input" bind:value={text} autofocus onfocus={(e) => e.currentTarget.select()} spellcheck="false" />
      {:else}
        <p>{d.message}</p>
      {/if}
      <div class="actions">
        <button type="button" class="btn ghost" onclick={() => close(d.kind === 'prompt' ? null : false)}>Cancelar</button>
        <button type="submit" class="btn primary" class:danger={d.kind === 'confirm'} disabled={d.kind === 'prompt' && !text.trim()}>{d.confirm}</button>
      </div>
    </form>
  </Modal>
{/if}

<style>
  .box { width: 100%; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  h3 { margin: 0; font-size: var(--text-lg); font-weight: 600; }
  p { margin: 0; color: var(--text-2); }
  .input { height: 34px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
  .btn.danger { background: var(--danger); color: #fff; }
  .btn.danger:hover { background: color-mix(in srgb, var(--danger) 85%, #fff); }
</style>

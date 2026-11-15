<script lang="ts">
  import Select from '../../ui/Select.svelte';
  import type { AuthModel } from '../../lib/types';

  let { auth = $bindable() }: { auth: AuthModel } = $props();

  const types = [
    { value: 'none', label: 'Ninguna' },
    { value: 'basic', label: 'Basic Auth' },
    { value: 'bearer', label: 'Bearer Token' },
    { value: 'apikey', label: 'API Key' },
  ];

  function setType(t: string) {
    if (t === auth.type) return;
    if (t === 'basic') auth = { type: 'basic', username: '', password: '' };
    else if (t === 'bearer') auth = { type: 'bearer', token: '' };
    else if (t === 'apikey') auth = { type: 'apikey', key: '', value: '', in: 'header' };
    else auth = { type: 'none' };
  }
  let type = $state(auth.type as string);
  $effect(() => { type = auth.type; });
  $effect(() => setType(type));
</script>

<div class="auth">
  <div class="field">
    <label for="auth-type">Tipo</label>
    <Select bind:value={type} options={types} width={200} ariaLabel="Tipo de autenticación" />
  </div>

  {#if auth.type === 'none'}
    <p class="hint">Esta solicitud no usa autenticación.</p>
  {:else if auth.type === 'basic'}
    <div class="field"><label for="u">Usuario</label><input id="u" class="input" bind:value={auth.username} spellcheck="false" /></div>
    <div class="field"><label for="p">Contraseña</label><input id="p" class="input" type="password" bind:value={auth.password} /></div>
  {:else if auth.type === 'bearer'}
    <div class="field"><label for="t">Token</label><input id="t" class="input mono" bind:value={auth.token} spellcheck="false" placeholder={'{{token}}'} /></div>
  {:else}
    <div class="field"><label for="k">Clave</label><input id="k" class="input mono" bind:value={auth.key} spellcheck="false" placeholder="X-API-Key" /></div>
    <div class="field"><label for="v">Valor</label><input id="v" class="input mono" bind:value={auth.value} spellcheck="false" /></div>
    <div class="field">
      <label for="in">Enviar en</label>
      <Select bind:value={auth.in} options={[{ value: 'header', label: 'Cabecera' }, { value: 'query', label: 'Query param' }]} width={200} ariaLabel="Ubicación de la clave" />
    </div>
  {/if}
</div>

<style>
  .auth { padding: 16px; display: flex; flex-direction: column; gap: 14px; max-width: 520px; }
  .field { display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 12px; }
  label { color: var(--text-2); }
  .mono { font-family: var(--font-mono); font-size: var(--text-sm); }
  .hint { margin: 0; color: var(--text-3); }
</style>

<script lang="ts">
  import Icon from './Icon.svelte';

  type Option = string | { value: string | number; label: string };
  let {
    value = $bindable(),
    options,
    width,
    ariaLabel,
  }: { value: string | number; options: Option[]; width?: number | string; ariaLabel?: string } = $props();
</script>

<span class="wrap" style:width={typeof width === 'number' ? `${width}px` : width}>
  <select bind:value aria-label={ariaLabel}>
    {#each options as o}
      {@const v = typeof o === 'string' ? o : o.value}
      <option value={v}>{typeof o === 'string' ? o : o.label}</option>
    {/each}
  </select>
  <span class="chev"><Icon name="chevron-down" size={14} /></span>
</span>

<style>
  .wrap { position: relative; display: inline-flex; }
  select {
    appearance: none;
    width: 100%;
    height: var(--row-h);
    padding: 0 28px 0 10px;
    background: var(--elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    transition: border-color var(--dur-fast);
  }
  select:hover { border-color: var(--border-strong); }
  select:focus-visible { outline: none; border-color: var(--accent); }
  option { background: var(--elevated); color: var(--text); }
  .chev { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: var(--text-2); pointer-events: none; display: flex; }
</style>

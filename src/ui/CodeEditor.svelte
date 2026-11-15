<script lang="ts">
  import { onMount } from 'svelte';
  import { Compartment, EditorState, Facet, type Extension } from '@codemirror/state';
  import {
    Decoration, EditorView, MatchDecorator, ViewPlugin, keymap, lineNumbers, placeholder as cmPlaceholder,
    type DecorationSet, type ViewUpdate, highlightActiveLine,
  } from '@codemirror/view';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { HighlightStyle, bracketMatching, foldGutter, indentOnInput, syntaxHighlighting } from '@codemirror/language';
  import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
  import { tags as t } from '@lezer/highlight';
  import { json } from '@codemirror/lang-json';
  import { xml } from '@codemirror/lang-xml';
  import { html } from '@codemirror/lang-html';
  import { javascript } from '@codemirror/lang-javascript';
  import type { Lang } from '../lib/format';
  import type { Vars } from '../lib/request';

  let {
    value = $bindable(''),
    lang = 'text',
    readonly = false,
    singleLine = false,
    vars,
    placeholder = '',
    onsubmit,
  }: {
    value?: string;
    lang?: Lang;
    readonly?: boolean;
    singleLine?: boolean;
    vars?: Vars;
    placeholder?: string;
    onsubmit?: () => void;
  } = $props();

  let host: HTMLDivElement;
  let view: EditorView | undefined;
  const langC = new Compartment();
  const roC = new Compartment();
  const varsFacet = Facet.define<Vars, Vars>({ combine: (v) => v[0] ?? {} });
  const varsC = new Compartment();

  const highlight = HighlightStyle.define([
    { tag: [t.propertyName, t.attributeName], color: 'var(--syn-key)' },
    { tag: [t.string, t.special(t.string)], color: 'var(--syn-string)' },
    { tag: [t.number], color: 'var(--syn-number)' },
    { tag: [t.bool, t.null, t.atom, t.keyword], color: 'var(--syn-atom)' },
    { tag: [t.punctuation, t.separator, t.bracket, t.angleBracket, t.operator], color: 'var(--syn-punct)' },
    { tag: [t.tagName], color: 'var(--syn-key)' },
    { tag: [t.comment, t.blockComment, t.lineComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  ]);

  const theme = EditorView.theme({
    '&': { height: '100%', backgroundColor: 'var(--editor-bg)', color: 'var(--text)', fontSize: 'var(--editor-font-size)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6', overflow: 'auto' },
    '.cm-content': { caretColor: 'var(--accent)', padding: '8px 0' },
    '.cm-cursor': { borderLeftColor: 'var(--accent)' },
    '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--text-3)', border: 'none' },
    '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--text) 4%, transparent)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text-2)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--accent-soft) !important' },
    '.cm-matchingBracket': { backgroundColor: 'var(--accent-soft)', outline: '1px solid var(--accent-line)' },
    '.cm-placeholder': { color: 'var(--text-3)' },
    '.cm-foldPlaceholder': { backgroundColor: 'var(--elevated)', border: '1px solid var(--border)', color: 'var(--text-2)' },
    '.cm-var': { color: 'var(--ok)', backgroundColor: 'color-mix(in srgb, var(--ok) 14%, transparent)', borderRadius: '3px' },
    '.cm-var-missing': { color: 'var(--warn)', backgroundColor: 'color-mix(in srgb, var(--warn) 14%, transparent)', borderRadius: '3px' },
  });

  const varMatcher = new MatchDecorator({
    regexp: /\{\{\s*([\w.\-]+)\s*\}\}/g,
    decoration: (m, v) =>
      Decoration.mark({ class: m[1] in v.state.facet(varsFacet) ? 'cm-var' : 'cm-var-missing' }),
  });
  const varPlugin = ViewPlugin.fromClass(
    class {
      decos: DecorationSet;
      constructor(v: EditorView) {
        this.decos = varMatcher.createDeco(v);
      }
      update(u: ViewUpdate) {
        const changed = u.startState.facet(varsFacet) !== u.state.facet(varsFacet);
        this.decos = changed ? varMatcher.createDeco(u.view) : varMatcher.updateDeco(u, this.decos);
      }
    },
    { decorations: (p) => p.decos },
  );

  function language(l: Lang): Extension {
    switch (l) {
      case 'json': return json();
      case 'xml': return xml();
      case 'html': return html();
      case 'js': return javascript();
      default: return [];
    }
  }
  const readOnlyExt = (ro: boolean) => [EditorState.readOnly.of(ro), EditorView.editable.of(!ro)];

  onMount(() => {
    const extensions: Extension[] = [
      theme,
      syntaxHighlighting(highlight),
      langC.of(language(lang)),
      roC.of(readOnlyExt(readonly)),
      varsC.of(varsFacet.of(vars ?? {})),
      varPlugin,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) value = u.state.doc.toString();
      }),
      placeholder ? cmPlaceholder(placeholder) : [],
    ];
    if (singleLine) {
      extensions.push(
        EditorState.transactionFilter.of((tr) => (tr.newDoc.lines > 1 ? [] : tr)),
        keymap.of([{ key: 'Enter', run: () => (onsubmit?.(), true) }]),
        EditorView.theme({ '.cm-content': { padding: '0' }, '.cm-scroller': { lineHeight: '28px' } }),
      );
    } else {
      extensions.push(
        lineNumbers(), foldGutter(), highlightActiveLine(), history(), indentOnInput(), bracketMatching(),
        highlightSelectionMatches(), EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      );
    }
    view = new EditorView({ parent: host, state: EditorState.create({ doc: value, extensions }) });
    return () => view?.destroy();
  });

  // Sincroniza cambios externos de valor, lenguaje, solo-lectura y variables.
  $effect(() => {
    const v = value;
    if (view && v !== view.state.doc.toString()) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
  });
  $effect(() => { view?.dispatch({ effects: langC.reconfigure(language(lang)) }); });
  $effect(() => { view?.dispatch({ effects: roC.reconfigure(readOnlyExt(readonly)) }); });
  $effect(() => { view?.dispatch({ effects: varsC.reconfigure(varsFacet.of(vars ?? {})) }); });
</script>

<div class="editor" class:single={singleLine} bind:this={host}></div>

<style>
  .editor { height: 100%; min-height: 0; overflow: hidden; }
  .editor.single { height: 28px; }
</style>

export type SchemePref = 'dark' | 'light' | 'system';
export type Accent = 'violet' | 'blue' | 'teal' | 'green' | 'amber' | 'red' | 'pink';
export const ACCENTS: Accent[] = ['violet', 'blue', 'teal', 'green', 'amber', 'red', 'pink'];

export const MONO_FONTS: Record<string, string> = {
  'Fira Code': "'Fira Code', ui-monospace, monospace",
  'Sistema': "ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace",
};

export interface Settings {
  scheme: SchemePref;
  accent: Accent;
  fontFamily: string;
  fontSize: number;
  timeoutMs: number;
  followRedirects: boolean;
  verifyTls: boolean;
}

const KEY = 'api-studio:settings';
const defaults: Settings = {
  scheme: 'dark',
  accent: 'violet',
  fontFamily: 'Fira Code',
  fontSize: 13,
  timeoutMs: 30000,
  followRedirects: true,
  verifyTls: true,
};

function load(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...defaults };
  }
}

export const settings = $state<Settings>(load());

const media = window.matchMedia('(prefers-color-scheme: dark)');

function resolveScheme(pref: SchemePref): 'dark' | 'light' {
  if (pref !== 'system') return pref;
  return media.matches ? 'dark' : 'light';
}

function apply(): void {
  const root = document.documentElement;
  root.dataset.scheme = resolveScheme(settings.scheme);
  root.dataset.accent = settings.accent;
  root.style.setProperty('--font-mono', MONO_FONTS[settings.fontFamily] ?? MONO_FONTS['Fira Code']);
  root.style.setProperty('--editor-font-size', `${settings.fontSize}px`);
}

/** Aplica el tema, lo mantiene sincronizado con el SO (modo System) y persiste cambios. */
export function initSettings(): () => void {
  apply();
  const onMedia = () => apply();
  media.addEventListener('change', onMedia);
  const stop = $effect.root(() => {
    $effect(() => {
      const snap = $state.snapshot(settings);
      apply();
      try {
        localStorage.setItem(KEY, JSON.stringify(snap));
      } catch {
        /* almacenamiento no disponible: se ignora */
      }
    });
  });
  return () => {
    media.removeEventListener('change', onMedia);
    stop();
  };
}

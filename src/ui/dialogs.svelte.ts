interface Prompt { kind: 'prompt'; title: string; value: string; confirm: string; resolve: (v: string | null) => void }
interface Confirm { kind: 'confirm'; title: string; message: string; confirm: string; resolve: (v: boolean) => void }

export const dialog = $state<{ current: Prompt | Confirm | null }>({ current: null });

/** Pide un texto al usuario. Devuelve `null` si cancela. */
export const askName = (title: string, value = '', confirm = 'Aceptar') =>
  new Promise<string | null>((resolve) => (dialog.current = { kind: 'prompt', title, value, confirm, resolve }));

export const askConfirm = (title: string, message: string, confirm = 'Eliminar') =>
  new Promise<boolean>((resolve) => (dialog.current = { kind: 'confirm', title, message, confirm, resolve }));

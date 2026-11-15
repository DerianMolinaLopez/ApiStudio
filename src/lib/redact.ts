import type { RequestModel } from './types';

const SENSITIVE = /(authorization|cookie|token|secret|passw(or)?d|api[-_]?key|apikey|x-auth|signature|^sig$|credential)/i;
export const MASK = '';

export const isSensitiveName = (name: string): boolean => SENSITIVE.test(name);

/** Vacía los valores sensibles de la query (token, key, password…) conservando el resto de la URL. */
export function redactUrl(url: string): string {
  const q = url.indexOf('?');
  if (q < 0) return url;
  const h = url.indexOf('#', q);
  const query = url.slice(q + 1, h < 0 ? undefined : h);
  const out = query
    .split('&')
    .map((pair) => {
      const i = pair.indexOf('=');
      return i > 0 && isSensitiveName(decodeURIComponent(pair.slice(0, i))) ? `${pair.slice(0, i)}=` : pair;
    })
    .join('&');
  return url.slice(0, q + 1) + out + (h < 0 ? '' : url.slice(h));
}

/**
 * Copia de la solicitud sin credenciales, para guardarla en el historial:
 * auth (contraseña, token, API key), cabeceras y parámetros sensibles, y secretos en la URL.
 */
export function redactRequest(r: RequestModel): RequestModel {
  const c = structuredClone(r);
  if (c.auth.type === 'basic') c.auth.password = MASK;
  else if (c.auth.type === 'bearer') c.auth.token = MASK;
  else if (c.auth.type === 'apikey') c.auth.value = MASK;
  for (const list of [c.headers, c.params, c.body.urlencoded, c.body.formData]) {
    for (const kv of list) if (isSensitiveName(kv.key)) kv.value = MASK;
  }
  c.url = redactUrl(c.url);
  return c;
}

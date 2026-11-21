import { isOpenApi } from './openapi';
import { isPostmanCollection, isPostmanEnvironment } from './postman';

export type ImportKind = 'postman-collection' | 'postman-environment' | 'openapi';

/** Decide qué tipo de documento es un JSON ya parseado, o `null` si no se reconoce. */
export function detectKind(json: unknown): ImportKind | null {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return null;
  const j = json as Record<string, unknown>;
  if (isOpenApi(j)) return 'openapi';
  if (isPostmanCollection(j)) return 'postman-collection';
  if (isPostmanEnvironment(j)) return 'postman-environment';
  return null;
}

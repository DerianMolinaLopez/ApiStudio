import { describe, expect, it } from 'vitest';
import { detectKind } from './detect';

describe('detectKind', () => {
  it('reconoce cada formato', () => {
    expect(detectKind({ openapi: '3.0.1', paths: {} })).toBe('openapi');
    expect(detectKind({ swagger: '2.0', paths: {} })).toBe('openapi');
    expect(detectKind({ info: { name: 'c' }, item: [] })).toBe('postman-collection');
    expect(detectKind({ name: 'dev', values: [] })).toBe('postman-environment');
  });
  it('devuelve null para lo que no es un documento soportado', () => {
    for (const v of [null, 5, 'texto', [], {}, { info: {} }, { openapi: '3.0.0' }]) expect(detectKind(v)).toBeNull();
  });
});

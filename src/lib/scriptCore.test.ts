import { describe, expect, it } from 'vitest';
import { runScript } from './scriptCore';

const response = { status: 201, statusText: 'Created', headers: [{ key: 'Content-Type', value: 'application/json' }], body: '{"id":7,"tags":["a","b"]}', timeMs: 120, sizeBytes: 25 };

describe('scriptCore', () => {
  it('registra tests que pasan y fallan', async () => {
    const out = await runScript(
      `test('status', () => expect(response.status).toBe(201));
       test('json', () => expect(response.json()).toHaveProperty('id', 7));
       test('lento', () => expect(response.time).toBeLessThan(50));
       test('no', () => expect(response.body).not.toContain('zzz'));`,
      { vars: {}, response },
    );
    expect(out.ok).toBe(true);
    expect(out.tests.map((t) => t.passed)).toEqual([true, true, false, true]);
    expect(out.tests[2].error).toContain('menor que 50');
  });
  it('lee cabeceras en minúsculas y soporta await', async () => {
    const out = await runScript(`await Promise.resolve(); env.set('ct', response.headers['content-type']); console.log('hola', {a:1});`, { vars: {}, response });
    expect(out.varChanges).toEqual({ ct: 'application/json' });
    expect(out.logs).toEqual(['hola {"a":1}']);
  });
  it('pre-request: variables y cabeceras', async () => {
    const out = await runScript(`env.set('n', Number(env.get('n')) + 1); request.setHeader('X-Sig', 'abc');`, { vars: { n: '1' }, request: { method: 'GET', url: 'http://x' } });
    expect(out.varChanges).toEqual({ n: '2' });
    expect(out.headers).toEqual([{ key: 'X-Sig', value: 'abc' }]);
  });
  it('captura errores del script sin lanzar', async () => {
    const out = await runScript(`throw new Error('boom')`, { vars: {} });
    expect(out).toMatchObject({ ok: false, error: 'boom' });
    expect((await runScript(`let = =`, { vars: {} })).ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { buildEngineRequest, interpolate, newKV, newRequest, paramsFromUrl, toCurl, unresolved, urlWithParams } from './request';

describe('variables', () => {
  it('reemplaza las conocidas y deja las desconocidas', () => {
    expect(interpolate('{{host}}/v1/{{ id }}/{{x}}', { host: 'http://a', id: '7' })).toBe('http://a/v1/7/{{x}}');
  });
  it('lista las no resueltas', () => {
    expect(unresolved('{{a}} {{b}} {{a}}', { a: '1' })).toEqual(['b']);
  });
});

describe('url <-> params', () => {
  it('construye la query solo con habilitados y conserva variables', () => {
    const ps = [newKV('page', '1'), newKV('q', 'a b'), newKV('off', 'x', false), newKV('t', '{{tok}}')];
    expect(urlWithParams('http://x/y#h', ps)).toBe('http://x/y?page=1&q=a%20b&t={{tok}}#h');
  });
  it('extrae params de la URL y conserva los deshabilitados', () => {
    const prev = [newKV('page', '1'), newKV('off', 'x', false)];
    const next = paramsFromUrl('http://x?page=2&limit=10', prev);
    expect(next.map((p) => [p.key, p.value, p.enabled])).toEqual([
      ['page', '2', true],
      ['limit', '10', true],
      ['off', 'x', false],
    ]);
    expect(next[0].id).toBe(prev[0].id);
  });
});

describe('buildEngineRequest', () => {
  it('aplica entorno, bearer y body json', () => {
    const r = newRequest({ method: 'POST', url: '{{host}}/users' });
    r.auth = { type: 'bearer', token: '{{t}}' };
    r.body.mode = 'json';
    r.body.json = '{"n":"{{n}}"}';
    const e = buildEngineRequest(r, { vars: { host: 'http://h', t: 'abc', n: 'Ana' } });
    expect(e.url).toBe('http://h/users');
    expect(e.headers).toContainEqual({ key: 'Authorization', value: 'Bearer abc' });
    expect(e.body).toEqual({ type: 'raw', content: '{"n":"Ana"}', contentType: 'application/json' });
  });
  it('API key en query y basic en cabecera; no pisa Authorization manual', () => {
    const r = newRequest({ url: 'http://h/p?a=1' });
    r.auth = { type: 'apikey', key: 'k', value: 'v w', in: 'query' };
    expect(buildEngineRequest(r, { vars: {} }).url).toBe('http://h/p?a=1&k=v%20w');
    const r2 = newRequest({ url: 'http://h' });
    r2.auth = { type: 'basic', username: 'u', password: 'p' };
    r2.headers = [newKV('authorization', 'Custom')];
    expect(buildEngineRequest(r2, { vars: {} }).headers).toEqual([{ key: 'authorization', value: 'Custom' }]);
    r2.headers = [];
    expect(buildEngineRequest(r2, { vars: {} }).headers[0].value).toBe('Basic dTpw');
  });
});

describe('toCurl', () => {
  it('escapa comillas simples y arma el comando', () => {
    const r = newRequest({ method: 'POST', url: 'http://h/x' });
    r.body.mode = 'json';
    r.body.json = `{"a":"it's"}`;
    const c = toCurl(buildEngineRequest(r, { vars: {} }));
    expect(c).toBe(`curl -X POST 'http://h/x' -H 'Content-Type: application/json' --data-raw '{"a":"it'\\''s"}' -L`);
  });
});

describe('rendimiento de regex', () => {
  it('no se degrada con muchas llaves sin cerrar', () => {
    const t0 = performance.now();
    const hostile = '{{'.repeat(50000) + 'a';
    expect(urlWithParams(`http://h?${hostile}`, [])).toBeTypeOf('string');
    expect(unresolved(hostile, {})).toEqual([]);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});

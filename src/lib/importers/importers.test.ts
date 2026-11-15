import { describe, expect, it } from 'vitest';
import { parseCurl, tokenize } from './curl';
import { exportPostmanCollection, importPostmanCollection, importPostmanEnvironment } from './postman';

describe('cURL', () => {
  it('tokeniza comillas y continuaciones', () => {
    expect(tokenize(`curl -H 'A: b c' \\\n  "http://x/y?q=1" -d "{\\"a\\":1}"`)).toEqual(['curl', '-H', 'A: b c', 'http://x/y?q=1', '-d', '{"a":1}']);
  });
  it('convierte un POST JSON con bearer', () => {
    const r = parseCurl(`curl 'https://api.x.com/v1/users?page=2' -X POST -H 'Authorization: Bearer tok' -H 'Content-Type: application/json' --data-raw '{"name":"Ana"}'`);
    expect(r.method).toBe('POST');
    expect(r.auth).toEqual({ type: 'bearer', token: 'tok' });
    expect(r.body.mode).toBe('json');
    expect(r.body.json).toBe('{"name":"Ana"}');
    expect(r.headers).toHaveLength(0);
    expect(r.params.map((p) => [p.key, p.value])).toEqual([['page', '2']]);
    expect(r.name).toBe('POST /v1/users');
  });
  it('infiere POST con -d, form-data con -F y basic con -u', () => {
    expect(parseCurl(`curl http://h -d 'a=1&b=2'`).method).toBe('POST');
    expect(parseCurl(`curl http://h -d 'a=1&b=2' -H 'Content-Type: application/x-www-form-urlencoded'`).body.urlencoded.map((p) => p.key)).toEqual(['a', 'b']);
    const f = parseCurl(`curl http://h -F 'n=x' -F 'f=@/tmp/a.png' -u me:pw`);
    expect(f.body.formData.map((x) => [x.key, x.kind, x.value])).toEqual([['n', 'text', 'x'], ['f', 'file', '/tmp/a.png']]);
    expect(f.auth).toEqual({ type: 'basic', username: 'me', password: 'pw' });
  });
  it('rechaza texto que no es cURL', () => {
    expect(() => parseCurl('wget http://x')).toThrow();
    expect(() => parseCurl('curl -s')).toThrow();
  });
});

describe('Postman', () => {
  const sample = {
    info: { name: 'Demo', schema: 'v2.1' },
    item: [
      { name: 'Users', item: [{ name: 'Create', request: { method: 'POST', header: [{ key: 'X-A', value: '1', disabled: true }], url: { raw: '{{host}}/users?x=1' }, body: { mode: 'raw', raw: '{"a":1}', options: { raw: { language: 'json' } } }, auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{t}}' }] } } }] },
      { name: 'Ping', request: { method: 'GET', url: 'http://h/ping' } },
    ],
  };
  it('importa carpetas, body, auth y deshabilitados', () => {
    const c = importPostmanCollection(sample);
    expect(c.name).toBe('Demo');
    const f = c.children[0];
    expect(f.type === 'folder' && f.children[0].type === 'request' && f.children[0].request.body.mode).toBe('json');
    const r = f.type === 'folder' && f.children[0].type === 'request' ? f.children[0].request : null;
    expect(r?.auth).toEqual({ type: 'bearer', token: '{{t}}' });
    expect(r?.headers[0].enabled).toBe(false);
    expect(r?.params[0].key).toBe('x');
  });
  it('exporta y reimporta sin perder datos', () => {
    const again = importPostmanCollection(exportPostmanCollection(importPostmanCollection(sample)));
    expect(JSON.stringify(again.children.map((n) => n.name))).toBe('["Users","Ping"]');
    const r = again.children[0].type === 'folder' && again.children[0].children[0].type === 'request' ? again.children[0].children[0].request : null;
    expect(r?.body.json).toBe('{"a":1}');
    expect(r?.url).toBe('{{host}}/users?x=1');
  });
  it('importa entornos', () => {
    const e = importPostmanEnvironment({ name: 'Dev', values: [{ key: 'host', value: 'h', enabled: true }, { key: 'x', value: '', enabled: false }] });
    expect(e.variables.map((v) => [v.key, v.enabled])).toEqual([['host', true], ['x', false]]);
    expect(() => importPostmanCollection({})).toThrow();
  });
});

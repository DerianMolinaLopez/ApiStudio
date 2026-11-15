import { describe, expect, it } from 'vitest';
import { newKV, newRequest } from './request';
import { redactRequest, redactUrl } from './redact';

describe('redact', () => {
  it('vacía secretos de la query y conserva el resto', () => {
    expect(redactUrl('http://h/p?page=1&api_key=ABC&token=x%20y#f')).toBe('http://h/p?page=1&api_key=&token=#f');
    expect(redactUrl('http://h/p')).toBe('http://h/p');
  });
  it('quita credenciales de la solicitud sin tocar el original', () => {
    const r = newRequest({ url: 'http://h?access_token=zzz&a=1' });
    r.auth = { type: 'basic', username: 'ana', password: 'secreta' };
    r.headers = [newKV('Authorization', 'Bearer abc'), newKV('Accept', 'json'), newKV('Cookie', 'sid=1')];
    r.params = [newKV('apikey', 'k'), newKV('q', 'x')];
    const c = redactRequest(r);
    expect(c.auth).toEqual({ type: 'basic', username: 'ana', password: '' });
    expect(c.headers.map((h) => h.value)).toEqual(['', 'json', '']);
    expect(c.params.map((p) => p.value)).toEqual(['', 'x']);
    expect(c.url).toBe('http://h?access_token=&a=1');
    expect(r.auth).toMatchObject({ password: 'secreta' });
  });
  it('vacía token bearer y valor de API key', () => {
    const a = newRequest(); a.auth = { type: 'bearer', token: 't' };
    const b = newRequest(); b.auth = { type: 'apikey', key: 'X-K', value: 'v', in: 'header' };
    expect(redactRequest(a).auth).toEqual({ type: 'bearer', token: '' });
    expect(redactRequest(b).auth).toEqual({ type: 'apikey', key: 'X-K', value: '', in: 'header' });
  });
});

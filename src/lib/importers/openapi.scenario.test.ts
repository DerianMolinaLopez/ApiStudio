import { describe, expect, it } from 'vitest';
import fixture from './fixtures/aspnet-swashbuckle.json';
import { importOpenApi } from './openapi';
import { exportPostmanCollection, importPostmanCollection, type ImportNode } from './postman';
import { buildEngineRequest, toCurl, urlWithParams, type Vars } from '../request';
import type { EngineRequest, RequestModel } from '../types';

/**
 * Escenario del issue #1: un usuario con una API ASP.NET (Swashbuckle) importa su openapi.json,
 * apunta el entorno a su servidor y envía las solicitudes.
 */

type Req = Extract<ImportNode, { type: 'request' }>;
const flat = (nodes: ImportNode[]): Req[] => nodes.flatMap((n) => (n.type === 'folder' ? flat(n.children) : [n]));
const doc = () => structuredClone(fixture) as Record<string, any>;

/** Igual que la app: variables habilitadas del entorno activo. */
const varsOf = (env: NonNullable<ReturnType<typeof importOpenApi>['environment']>): Vars =>
  Object.fromEntries(env.variables.filter((v) => v.enabled && v.key).map((v) => [v.key, v.value]));

describe('escenario: importar un openapi.json de ASP.NET y enviar', () => {
  const result = importOpenApi(doc());
  const byName = (name: string): RequestModel => {
    const n = flat(result.collection.children).find((r) => r.name === name);
    if (!n) throw new Error(`No existe la solicitud «${name}»`);
    return n.request;
  };
  // El usuario cambia baseUrl a su servidor y rellena el token, como indica el aviso.
  const vars = { ...varsOf(result.environment!), baseUrl: 'https://localhost:7001', token: 'jwt.abc.def' };
  const send = (name: string): EngineRequest => buildEngineRequest(byName(name), { vars });

  it('importa todos los endpoints agrupados por controlador', () => {
    expect(result.endpoints).toBe(8);
    expect(result.collection.name).toBe('Tienda.Api');
    expect(result.collection.children.map((n) => n.name)).toEqual(['Auth', 'Productos', 'GET health']);
    const productos = result.collection.children[1];
    expect(productos.type === 'folder' && productos.children.length).toBe(6);
  });

  it('avisa de que falta el servidor y pide ajustar baseUrl (Swashbuckle no lo incluye)', () => {
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/baseUrl/);
    expect(varsOf(result.environment!).baseUrl).toBe('http://localhost');
  });

  it('el entorno trae las variables que las solicitudes necesitan', () => {
    const keys = result.environment!.variables.map((v) => v.key);
    expect(keys).toEqual(expect.arrayContaining(['baseUrl', 'token', 'id']));
    expect(new Set(keys).size).toBe(keys.length); // sin duplicados aunque `id` aparezca en 4 endpoints
  });

  it('POST login: JSON con ejemplo válido y sin credenciales de auth', () => {
    const r = send('POST api › Auth › login');
    expect(r.method).toBe('POST');
    expect(r.url).toBe('https://localhost:7001/api/Auth/login');
    expect(r.body).toMatchObject({ type: 'raw', contentType: 'application/json' });
    expect(JSON.parse((r.body as { content: string }).content)).toEqual({ email: 'user@example.com', password: 'string' });
    expect(r.headers.some((h) => h.key.toLowerCase() === 'authorization')).toBe(false);
  });

  it('GET productos: parámetros opcionales deshabilitados con su valor por defecto y Bearer resuelto', () => {
    const model = byName('GET api › Productos');
    expect(model.params.map((p) => [p.key, p.value, p.enabled])).toEqual([
      ['pagina', '1', false],
      ['buscar', 'string', false],
      ['estado', '0', false],
    ]);
    const r = send('GET api › Productos');
    expect(r.url).toBe('https://localhost:7001/api/Productos'); // nada activado: sin query
    expect(r.headers).toContainEqual({ key: 'Authorization', value: 'Bearer jwt.abc.def' });
  });

  it('GET productos: al activar un parámetro en la tabla, la URL enviada lo incluye', () => {
    const model = structuredClone(byName('GET api › Productos'));
    for (const p of model.params) p.enabled = p.key !== 'buscar';
    model.url = urlWithParams(model.url, model.params); // lo mismo que hace la UI al marcar la casilla
    const r = buildEngineRequest(model, { vars });
    expect(r.url).toBe('https://localhost:7001/api/Productos?pagina=1&estado=0');
  });

  it('POST productos: DTO completo, sin campos de solo lectura y tipos correctos', () => {
    const r = send('POST api › Productos');
    const body = JSON.parse((r.body as { content: string }).content);
    expect(body).toEqual({
      nombre: 'string',
      descripcion: 'string',
      precio: 0,
      estado: 0,
      creado: '2024-01-01T00:00:00Z',
      externalId: '00000000-0000-0000-0000-000000000000',
      dimensiones: { alto: 0, ancho: 0 },
      etiquetas: ['string'],
    });
    expect('id' in body).toBe(false); // readOnly
    expect(r.headers).toContainEqual({ key: 'Authorization', value: 'Bearer jwt.abc.def' });
  });

  it('rutas con {id}: usa la variable del entorno y la sustituye al enviar', () => {
    expect(byName('GET api › Productos › {id}').url).toBe('{{baseUrl}}/api/Productos/{{id}}');
    expect(send('GET api › Productos › {id}').url).toBe('https://localhost:7001/api/Productos/0');
    const withId = buildEngineRequest(byName('DELETE api › Productos › {id}'), { vars: { ...vars, id: '42' } });
    expect(withId.url).toBe('https://localhost:7001/api/Productos/42');
    expect(withId.method).toBe('DELETE');
    expect(withId.body).toEqual({ type: 'none' });
  });

  it('multipart: el campo binario es un archivo y el resto texto', () => {
    const r = send('POST api › Productos › {id} › imagen');
    expect(r.body.type).toBe('multipart');
    const fields = (r.body as { fields: { key: string; kind: string }[] }).fields;
    expect(fields.map((f) => [f.key, f.kind])).toEqual([['archivo', 'file'], ['descripcion', 'text']]);
  });

  it('endpoints públicos no llevan Authorization', () => {
    const r = send('GET health');
    expect(r.headers).toEqual([]);
    expect(r.url).toBe('https://localhost:7001/health');
  });

  it('se puede copiar cualquier solicitud importada como cURL ejecutable', () => {
    const curl = toCurl(send('POST api › Auth › login'));
    expect(curl).toContain("curl -X POST 'https://localhost:7001/api/Auth/login'");
    expect(curl).toContain("--data-raw '");
    expect(curl).toContain('Content-Type: application/json');
  });

  it('todas las solicitudes importadas son enviables: método, URL absoluta y sin variables sin resolver', () => {
    for (const { name, request } of flat(result.collection.children)) {
      const r = buildEngineRequest(request, { vars: { ...vars, id: '1' } });
      expect(r.url, name).toMatch(/^https:\/\/localhost:7001\//);
      expect(r.url, name).not.toContain('{{');
      expect(r.headers.every((h) => !h.value.includes('{{')), name).toBe(true);
    }
  });
});

describe('escenario: robustez del archivo real', () => {
  it('es idempotente: importar dos veces da la misma estructura', () => {
    const shape = (n: ImportNode[]): unknown[] => n.map((x) => (x.type === 'folder' ? [x.name, shape(x.children)] : [x.name, x.request.method, x.request.url]));
    expect(shape(importOpenApi(doc()).collection.children)).toEqual(shape(importOpenApi(doc()).collection.children));
  });

  it('no modifica el documento de entrada', () => {
    const d = doc();
    const copy = JSON.stringify(d);
    importOpenApi(d);
    expect(JSON.stringify(d)).toBe(copy);
  });

  it('sobrevive a exportar a Postman y volver a importar', () => {
    const r = importOpenApi(doc());
    const again = importPostmanCollection(exportPostmanCollection(r.collection));
    expect(flat(again.children).map((x) => x.request.url).sort()).toEqual(flat(r.collection.children).map((x) => x.request.url).sort());
    expect(flat(again.children).find((x) => x.request.method === 'POST' && x.request.url.endsWith('/login'))?.request.body.mode).toBe('json');
  });

  it('con `servers` presentes no avisa y usa esa URL', () => {
    const d = doc();
    d.servers = [{ url: 'https://api.tienda.com' }];
    const r = importOpenApi(d);
    expect(r.warnings).toEqual([]);
    expect(varsOf(r.environment!).baseUrl).toBe('https://api.tienda.com');
  });

  it('un archivo con miles de endpoints se convierte en tiempo razonable', () => {
    const d = doc();
    for (let i = 0; i < 1500; i++) d.paths[`/api/Recurso${i}/{id}`] = { get: { tags: [`T${i % 25}`], responses: {} }, post: { requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductoCrearDto' } } } } } };
    const t0 = performance.now();
    const r = importOpenApi(d);
    expect(r.endpoints).toBe(8 + 3000);
    expect(performance.now() - t0).toBeLessThan(3000);
  });

  it('rechaza archivos que no son OpenAPI con un mensaje útil', () => {
    expect(() => importOpenApi({ info: { title: 'x' }, item: [] })).toThrow(/OpenAPI\/Swagger/);
    expect(() => importOpenApi({ openapi: '3.0.0', paths: {} })).toThrow(/ninguna operación/);
  });
});

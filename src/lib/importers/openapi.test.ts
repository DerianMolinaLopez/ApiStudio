import { describe, expect, it } from 'vitest';
import { importOpenApi, isOpenApi } from './openapi';
import type { ImportNode } from './postman';

type Any = Record<string, any>;

/** Estilo Swashbuckle (ASP.NET): sin `servers`, mismo esquema en varios content-types, Bearer como apiKey. */
const aspnet: Any = {
  openapi: '3.0.1',
  info: { title: 'Tienda API', version: 'v1' },
  paths: {
    '/api/Productos': {
      get: {
        tags: ['Productos'],
        operationId: 'GetProductos',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', format: 'int32' } },
          { name: 'search', in: 'query', required: true, schema: { type: 'string', nullable: true } },
          { name: 'Accept-Language', in: 'header', schema: { type: 'string' } },
          { name: 'Authorization', in: 'header', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
      post: {
        tags: ['Productos'],
        summary: 'Crear producto',
        requestBody: {
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ProductoDto' } },
            'text/json': { schema: { $ref: '#/components/schemas/ProductoDto' } },
            'application/*+json': { schema: { $ref: '#/components/schemas/ProductoDto' } },
          },
        },
        security: [{ Bearer: [] }],
      },
    },
    '/api/Productos/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      delete: { tags: ['Productos'], responses: {} },
    },
    '/health': { get: { responses: {} } },
  },
  components: {
    schemas: {
      ProductoDto: {
        type: 'object',
        required: ['nombre'],
        properties: {
          id: { type: 'integer', format: 'int64', readOnly: true },
          nombre: { type: 'string' },
          precio: { type: 'number', format: 'double' },
          creado: { type: 'string', format: 'date-time' },
          categoria: { $ref: '#/components/schemas/Categoria' },
          etiquetas: { type: 'array', items: { type: 'string' } },
        },
      },
      Categoria: { type: 'string', enum: ['Ropa', 'Hogar'] },
    },
    securitySchemes: { Bearer: { type: 'apiKey', name: 'Authorization', in: 'header' } },
  },
};

const flat = (nodes: ImportNode[]): Extract<ImportNode, { type: 'request' }>[] =>
  nodes.flatMap((n) => (n.type === 'folder' ? flat(n.children) : [n]));
const find = (r: ReturnType<typeof importOpenApi>, name: string) => flat(r.collection.children).find((n) => n.name === name)!.request;

describe('OpenAPI: nombres', () => {
  it('sin summary ni operationId el nombre no contiene «/»', () => {
    const r = importOpenApi({ openapi: '3.0.0', info: { title: 'N' }, paths: { '/': { get: {} }, '/a/b/{id}': { get: {} } } });
    expect(flat(r.collection.children).map((n) => n.name)).toEqual(['GET raíz', 'GET a › b › {id}']);
  });
});

describe('OpenAPI: detección', () => {
  it('reconoce OpenAPI 3 y Swagger 2, rechaza lo demás', () => {
    expect(isOpenApi({ openapi: '3.1.0', paths: {} })).toBe(true);
    expect(isOpenApi({ swagger: '2.0', paths: {} })).toBe(true);
    expect(isOpenApi({ info: {}, item: [] })).toBe(false);
    expect(isOpenApi(null as any)).toBe(false);
    expect(() => importOpenApi({ openapi: '3.0.0', paths: {} })).toThrow(/ninguna operación/);
    expect(() => importOpenApi({} as any)).toThrow();
  });
});

describe('OpenAPI 3 estilo ASP.NET', () => {
  const r = importOpenApi(aspnet);

  it('agrupa por tag y deja sin tag en la raíz', () => {
    expect(r.endpoints).toBe(4);
    expect(r.collection.name).toBe('Tienda API');
    expect(r.collection.children.map((n) => n.name)).toEqual(['Productos', 'GET health']);
  });
  it('avisa cuando no hay servidor y define baseUrl', () => {
    expect(r.warnings.join(' ')).toMatch(/no define servidor/);
    expect(r.environment?.variables.find((v) => v.key === 'baseUrl')?.value).toBe('http://localhost');
  });
  it('parámetros: query con required, header sin los reservados, path como variable', () => {
    const get = find(r, 'GetProductos');
    expect(get.params.map((p) => [p.key, p.enabled])).toEqual([['page', false], ['search', true]]);
    expect(get.headers.map((h) => h.key)).toEqual(['Accept-Language']);
    expect(get.url).toBe('{{baseUrl}}/api/Productos?search=string');
    const del = find(r, 'DELETE api › Productos › {id}');
    expect(del.url).toBe('{{baseUrl}}/api/Productos/{{id}}');
    expect(r.environment?.variables.find((v) => v.key === 'id')?.value).toBe('00000000-0000-0000-0000-000000000000');
  });
  it('body JSON de ejemplo: resuelve $ref, enum y omite readOnly', () => {
    const post = find(r, 'Crear producto');
    expect(post.body.mode).toBe('json');
    expect(JSON.parse(post.body.json)).toEqual({ nombre: 'string', precio: 0, creado: '2024-01-01T00:00:00Z', categoria: 'Ropa', etiquetas: ['string'] });
  });
  it('apiKey en Authorization → Auth API Key con variable', () => {
    expect(find(r, 'Crear producto').auth).toEqual({ type: 'apikey', key: 'Authorization', value: '{{apiKey}}', in: 'header' });
    expect(r.environment?.variables.some((v) => v.key === 'apiKey')).toBe(true);
  });
});

describe('OpenAPI 3: servidores, auth y formularios', () => {
  it('usa servers[0] con variables por defecto y security global bearer', () => {
    const r = importOpenApi({
      openapi: '3.0.3', info: { title: 'X' },
      servers: [{ url: 'https://{env}.api.com/v2/', variables: { env: { default: 'staging' } } }],
      security: [{ jwt: [] }],
      components: { securitySchemes: { jwt: { type: 'http', scheme: 'bearer' } } },
      paths: { '/ping': { get: {}, post: { security: [] } } },
    });
    expect(r.environment?.variables[0]).toMatchObject({ key: 'baseUrl', value: 'https://staging.api.com/v2' });
    expect(r.warnings).toEqual([]);
    expect(find(r, 'GET ping').auth).toEqual({ type: 'bearer', token: '{{token}}' });
    expect(find(r, 'POST ping').auth).toEqual({ type: 'none' });
  });
  it('urlencoded y multipart con archivo', () => {
    const r = importOpenApi({
      openapi: '3.0.0', info: { title: 'F' },
      paths: {
        '/login': { post: { requestBody: { content: { 'application/x-www-form-urlencoded': { schema: { type: 'object', properties: { user: { type: 'string', example: 'ana' } } } } } } } },
        '/up': { post: { requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, nota: { type: 'string' } } } } } } } },
      },
    });
    expect(find(r, 'POST login').body.urlencoded.map((f) => [f.key, f.value])).toEqual([['user', 'ana']]);
    expect(find(r, 'POST up').body.formData.map((f) => [f.key, f.kind])).toEqual([['file', 'file'], ['nota', 'text']]);
  });
});

describe('Swagger 2.0', () => {
  it('host + basePath, body y basic auth', () => {
    const r = importOpenApi({
      swagger: '2.0', info: { title: 'Viejo' }, host: 'api.old.com', basePath: '/v1', schemes: ['https'],
      securityDefinitions: { b: { type: 'basic' } }, security: [{ b: [] }],
      paths: {
        '/users/{id}': {
          put: {
            parameters: [
              { name: 'id', in: 'path', required: true, type: 'integer' },
              { name: 'body', in: 'body', schema: { type: 'object', properties: { name: { type: 'string' } } } },
            ],
          },
        },
      },
    });
    expect(r.environment?.variables[0].value).toBe('https://api.old.com/v1');
    const put = find(r, 'PUT users › {id}');
    expect(put.url).toBe('{{baseUrl}}/users/{{id}}');
    expect(JSON.parse(put.body.json)).toEqual({ name: 'string' });
    expect(put.auth).toMatchObject({ type: 'basic' });
  });
});

describe('OpenAPI: entradas hostiles', () => {
  it('no se cuelga con $ref circulares y respeta la profundidad', () => {
    const r = importOpenApi({
      openapi: '3.0.0', info: { title: 'C' },
      components: { schemas: { Nodo: { type: 'object', properties: { hijo: { $ref: '#/components/schemas/Nodo' }, nombre: { type: 'string' } } }, A: { $ref: '#/components/schemas/B' }, B: { $ref: '#/components/schemas/A' } } },
      paths: { '/n': { post: { requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Nodo' } } } } } }, '/a': { post: { requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/A' } } } } } } },
    });
    expect(JSON.parse(find(r, 'POST n').body.json)).toEqual({ hijo: null, nombre: 'string' });
    expect(r.warnings.join(' ')).toMatch(/circular/);
  });
  it('ignora $ref externos con aviso y no contamina el prototipo con __proto__', () => {
    const r = importOpenApi(JSON.parse(`{"openapi":"3.0.0","info":{"title":"H"},"paths":{"/x":{"post":{"requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"__proto__":{"type":"string"},"ok":{"$ref":"http://evil.example/s.json"}}}}}}}}}}`));
    const body = JSON.parse(find(r, 'POST x').body.json);
    expect(Object.hasOwn(body, '__proto__')).toBe(true);
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect(r.warnings.join(' ')).toMatch(/externa ignorada/);
  });
  it('tolera partes malformadas sin lanzar', () => {
    const r = importOpenApi({ openapi: '3.0.0', info: 5, paths: { '/a': { get: { parameters: [null, 3, { name: 'q' }], tags: [7], requestBody: 'x' } }, '/b': null } } as any);
    expect(r.collection.name).toBe('API importada');
    expect(r.endpoints).toBe(1);
  });
});

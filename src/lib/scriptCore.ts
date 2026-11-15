// Núcleo del motor de scripts. Es independiente del DOM para poder probarlo; en la app corre
// dentro de un Web Worker (ver script.worker.ts).

export interface TestResult { name: string; passed: boolean; error?: string }

export interface ScriptContext {
  vars: Record<string, string>;
  request?: { method: string; url: string };
  response?: {
    status: number;
    statusText: string;
    headers: { key: string; value: string }[];
    body: string;
    timeMs: number;
    sizeBytes: number;
  };
}

export interface ScriptOutput {
  ok: boolean;
  error?: string;
  logs: string[];
  tests: TestResult[];
  varChanges: Record<string, string>;
  /** Cabeceras añadidas con request.setHeader() (solo en pre-request). */
  headers: { key: string; value: string }[];
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...a: unknown[]) => Promise<unknown>;

const fmt = (v: unknown): string => {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
};

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

function getPath(obj: unknown, path: string): { found: boolean; value: unknown } {
  let cur: any = obj;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined || !(part in Object(cur))) return { found: false, value: undefined };
    cur = cur[part];
  }
  return { found: true, value: cur };
}

export function makeExpect(actual: unknown) {
  const build = (neg: boolean) => {
    const check = (pass: boolean, what: string) => {
      if (pass === neg) throw new Error(`Se esperaba que ${fmt(actual)} ${neg ? 'no ' : ''}${what}`);
    };
    return {
      toBe: (e: unknown) => check(Object.is(actual, e), `fuera igual a ${fmt(e)}`),
      toEqual: (e: unknown) => check(deepEqual(actual, e), `fuera igual (estructural) a ${fmt(e)}`),
      toContain: (e: unknown) => check(typeof actual === 'string' || Array.isArray(actual) ? (actual as any).includes(e) : false, `contuviera ${fmt(e)}`),
      toMatch: (re: RegExp | string) => check(new RegExp(re).test(String(actual)), `coincidiera con ${String(re)}`),
      toBeGreaterThan: (n: number) => check(Number(actual) > n, `fuera mayor que ${n}`),
      toBeLessThan: (n: number) => check(Number(actual) < n, `fuera menor que ${n}`),
      toBeTruthy: () => check(!!actual, 'fuera verdadero'),
      toBeFalsy: () => check(!actual, 'fuera falso'),
      toBeDefined: () => check(actual !== undefined, 'estuviera definido'),
      toHaveLength: (n: number) => check((actual as any)?.length === n, `tuviera longitud ${n}`),
      toHaveProperty: (path: string, value?: unknown) => {
        const r = getPath(actual, path);
        check(r.found && (value === undefined || deepEqual(r.value, value)), `tuviera la propiedad «${path}»${value === undefined ? '' : ` = ${fmt(value)}`}`);
      },
    };
  };
  return Object.assign(build(false), { not: build(true) });
}

export async function runScript(code: string, ctx: ScriptContext): Promise<ScriptOutput> {
  const logs: string[] = [];
  const tests: TestResult[] = [];
  const vars = { ...ctx.vars };
  const varChanges: Record<string, string> = {};
  const headers: { key: string; value: string }[] = [];

  const log = (...a: unknown[]) => void logs.push(a.map(fmt).join(' '));
  const consoleApi = { log, info: log, warn: log, error: log };
  const env = {
    get: (k: string) => vars[k],
    set: (k: string, v: unknown) => {
      vars[k] = varChanges[k] = String(v);
    },
  };
  const request = ctx.request && {
    method: ctx.request.method,
    url: ctx.request.url,
    setHeader: (key: string, value: unknown) => void headers.push({ key, value: String(value) }),
  };
  const response = ctx.response && {
    status: ctx.response.status,
    statusText: ctx.response.statusText,
    time: ctx.response.timeMs,
    size: ctx.response.sizeBytes,
    body: ctx.response.body,
    headers: Object.fromEntries(ctx.response.headers.map((h) => [h.key.toLowerCase(), h.value])),
    text: () => ctx.response!.body,
    json: () => JSON.parse(ctx.response!.body),
  };
  const pending: Promise<void>[] = [];
  const test = (name: string, fn: () => unknown) => {
    const slot = tests.push({ name, passed: false }) - 1; // reserva el orden de declaración
    pending.push(
      (async () => {
        try {
          await fn();
          tests[slot] = { name, passed: true };
        } catch (e) {
          tests[slot] = { name, passed: false, error: e instanceof Error ? e.message : String(e) };
        }
      })(),
    );
  };

  try {
    await new AsyncFunction('request', 'response', 'env', 'console', 'test', 'expect', code)(request, response, env, consoleApi, test, makeExpect);
    await Promise.all(pending);
    return { ok: true, logs, tests, varChanges, headers };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), logs, tests, varChanges, headers };
  }
}

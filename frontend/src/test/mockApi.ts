import { vi } from 'vitest';

export interface RecordedRequest {
  path: string;
  method: string;
  body: unknown;
}

export type ApiHandler = (path: string, init: RequestInit, call: RecordedRequest) => unknown | Promise<unknown>;

/**
 * A route-aware useApiRequest double. Page effects commonly issue multiple
 * requests in parallel, so tests should resolve by method/path rather than by
 * the order in which promises happen to settle.
 */
export function createApiMock(handler: ApiHandler = () => {
  throw new Error('Unexpected API request');
}) {
  const calls: RecordedRequest[] = [];
  const request = vi.fn((path: string, init: RequestInit = {}) => {
    let body: unknown;
    if (typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const call: RecordedRequest = {
      path,
      method: (init.method ?? 'GET').toUpperCase(),
      body,
    };
    calls.push(call);
    return Promise.resolve(handler(path, init, call));
  });

  return { calls, request };
}

export function responseError(statusCode = 500, message = 'Request failed') {
  return Object.assign(new Error(message), { statusCode, code: statusCode === 404 ? 'NOT_FOUND' : 'REQUEST_ERROR', details: [] });
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

export function requestPath(calls: readonly RecordedRequest[], method: string, path: string) {
  return calls.find((call) => call.method === method && call.path === path);
}

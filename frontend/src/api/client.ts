import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useRef } from 'react';
import type { ApiEnvelope, ApiErrorEnvelope } from './types';
import { authConfig } from '../auth/config';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const API_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE ?? 'https://bbl-candidate-test-api';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: ApiErrorEnvelope['details'];

  constructor(error: ApiErrorEnvelope) {
    super(error.message);
    this.name = 'ApiError';
    this.statusCode = error.statusCode;
    this.code = error.code;
    this.details = error.details;
  }
}

export type TokenGetter = () => Promise<string>;
export type UnauthorizedHandler = () => void;

export async function apiRequest<T>(
  getToken: TokenGetter,
  path: string,
  init: RequestInit = {},
  onUnauthorized?: UnauthorizedHandler,
): Promise<ApiEnvelope<T>> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const error = isErrorEnvelope(body)
      ? body
      : {
          statusCode: response.status,
          code: response.status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR',
          message: response.status >= 500 ? 'Internal server error' : 'Request failed',
          details: [],
        };
    const apiError = new ApiError(error);
    if (response.status === 401) onUnauthorized?.();
    throw apiError;
  }

  if (!isSuccessEnvelope<T>(body, response.status)) {
    throw new ApiError({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      details: [],
    });
  }
  return body;
}

const isErrorEnvelope = (value: unknown): value is ApiErrorEnvelope => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ApiErrorEnvelope>;
  return (
    typeof candidate.statusCode === 'number' &&
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    Array.isArray(candidate.details)
  );
};

const isSuccessEnvelope = <T>(value: unknown, statusCode: number): value is ApiEnvelope<T> => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ApiEnvelope<T>>;
  return (
    candidate.statusCode === statusCode &&
    typeof candidate.message === 'string' &&
    'data' in candidate
  );
};

export function useApiRequest() {
  const { getAccessTokenSilently, logout } = useAuth0();
  const unauthorizedRedirectStarted = useRef(false);
  const handleUnauthorized = useCallback(() => {
    if (unauthorizedRedirectStarted.current) return;
    unauthorizedRedirectStarted.current = true;
    void logout({ logoutParams: { returnTo: authConfig.logoutUrl } });
  }, [logout]);

  return useCallback(
    <T,>(path: string, init?: RequestInit) =>
      apiRequest<T>(
        () =>
          getAccessTokenSilently({
            authorizationParams: {
              audience: API_AUDIENCE,
              scope: 'openid profile email',
            },
          }),
        path,
        init,
        handleUnauthorized,
      ),
    [getAccessTokenSilently, handleUnauthorized],
  );
}

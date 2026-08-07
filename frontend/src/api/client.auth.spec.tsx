import { useEffect, createElement } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApiRequest } from './client';

const authMocks = vi.hoisted(() => ({
  getAccessTokenSilently: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => authMocks,
}));

function UnauthorizedProbe() {
  const request = useApiRequest();

  useEffect(() => {
    void request('/me').catch(() => undefined);
  }, [request]);

  return createElement('div');
}

describe('useApiRequest authentication recovery', () => {
  beforeEach(() => {
    authMocks.getAccessTokenSilently.mockReset().mockResolvedValue('test-access-token');
    authMocks.logout.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
      details: [],
    }), { status: 401, headers: { 'content-type': 'application/json' } })));
  });

  it('logs out once and returns to the local sign-in entry point after a 401', async () => {
    render(createElement(UnauthorizedProbe));

    await waitFor(() => expect(authMocks.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: 'http://localhost:3000' },
    }));
    expect(authMocks.logout).toHaveBeenCalledOnce();
  });
});

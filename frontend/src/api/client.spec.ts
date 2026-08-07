import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './client';

describe('apiRequest', () => {
  it('requests an access token and validates the success envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      statusCode: 200,
      message: 'Bookmark retrieved',
      data: { id: 'bookmark-1' },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const getToken = vi.fn().mockResolvedValue('test-access-token');

    await expect(apiRequest(getToken, '/bookmarks/bookmark-1')).resolves.toMatchObject({ data: { id: 'bookmark-1' } });
    expect(getToken).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/bookmarks/bookmark-1', expect.objectContaining({
      headers: expect.any(Headers),
    }));
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-access-token');
  });

  it('raises a stable ApiError for a backend error envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Resource not found',
      details: [],
    }), { status: 404, headers: { 'content-type': 'application/json' } })));

    await expect(apiRequest(() => Promise.resolve('test-access-token'), '/bookmarks/missing')).rejects.toEqual(
      expect.objectContaining({ statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found', details: [] }),
    );
  });

  it('notifies the session handler when the API rejects the access token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
      details: [],
    }), { status: 401, headers: { 'content-type': 'application/json' } })));
    const onUnauthorized = vi.fn();

    await expect(apiRequest(
      () => Promise.resolve('test-access-token'),
      '/me',
      {},
      onUnauthorized,
    )).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});

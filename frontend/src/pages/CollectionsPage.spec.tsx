import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CollectionsPage } from './CollectionsPage';

const getAccessTokenSilently = vi.fn().mockResolvedValue('test-access-token');

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ getAccessTokenSilently }),
}));

describe('CollectionsPage', () => {
  it('loads the private collection list and creates a collection through the API', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ statusCode: 200, message: 'Collections retrieved', data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }))
      .mockResolvedValueOnce(jsonResponse({ statusCode: 201, message: 'Collection created', data: { id: 'collection-1', name: 'Reading', ownerId: 'owner-1', createdAt: '2026-08-07T00:00:00.000Z', updatedAt: '2026-08-07T00:00:00.000Z' } }))
      .mockResolvedValueOnce(jsonResponse({ statusCode: 200, message: 'Collections retrieved', data: [{ id: 'collection-1', name: 'Reading', ownerId: 'owner-1', createdAt: '2026-08-07T00:00:00.000Z', updatedAt: '2026-08-07T00:00:00.000Z' }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }));
    vi.stubGlobal('fetch', fetchMock);

    render(<MemoryRouter><CollectionsPage /></MemoryRouter>);
    expect(await screen.findByText('No collections match this view yet.')).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Reading' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Reading')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:3001/collections');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: 'Reading' });
    await waitFor(() => expect(getAccessTokenSilently).toHaveBeenCalled());
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: body && typeof body === 'object' && 'statusCode' in body ? Number((body as { statusCode: number }).statusCode) : 200, headers: { 'content-type': 'application/json' } });
}

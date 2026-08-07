import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionDetailPage } from './CollectionDetailPage';
import { bookmark, collection, envelope, listEnvelope } from '../test/fixtures';

const api = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, useApiRequest: () => api.request };
});

const reading = collection({ id: 'collection-1', name: 'Reading' });

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/collections/collection-1']}>
      <Routes>
        <Route element={<CollectionDetailPage />} path="/collections/:id" />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CollectionDetailPage', () => {
  beforeEach(() => {
    api.request.mockReset();
  });

  it('loads the collection and nested bookmarks with the detail page size of 20', async () => {
    api.request.mockImplementation((path: string) => {
      if (path === '/collections/collection-1') return Promise.resolve(envelope(reading));
      if (path === '/collections/collection-1/bookmarks?page=1&pageSize=20') return Promise.resolve(listEnvelope([bookmark()], { page: 1, pageSize: 20, total: 1, totalPages: 1 }));
      throw new Error(`Unexpected API request ${path}`);
    });

    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Reading' })).toBeInTheDocument();
    expect(await screen.findByText('Example article')).toBeInTheDocument();
    expect(api.request).toHaveBeenCalledWith('/collections/collection-1/bookmarks?page=1&pageSize=20');
  });

  it('preselects the route collection when adding a bookmark and refreshes nested data', async () => {
    const created = bookmark({ id: 'bookmark-created', title: 'Added in Reading' });
    let nestedCalls = 0;
    api.request.mockImplementation((path: string, init: RequestInit = {}) => {
      if (path === '/collections/collection-1') return Promise.resolve(envelope(reading));
      if (path === '/collections/collection-1/bookmarks?page=1&pageSize=20') {
        nestedCalls += 1;
        return Promise.resolve(listEnvelope(nestedCalls > 1 ? [created] : [], { page: 1, pageSize: 20, total: nestedCalls > 1 ? 1 : 0, totalPages: nestedCalls > 1 ? 1 : 0 }));
      }
      if (path === '/collections?page=1&pageSize=100') return Promise.resolve(listEnvelope([reading], { page: 1, pageSize: 100, total: 1, totalPages: 1 }));
      if (path === '/bookmarks' && init.method === 'POST') return Promise.resolve(envelope(created, { statusCode: 201, message: 'Bookmark created' }));
      throw new Error(`Unexpected API request ${init.method ?? 'GET'} ${path}`);
    });

    renderDetail();
    await screen.findByRole('heading', { name: 'Reading' });
    expect(await screen.findByText('This collection has no bookmarks.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add bookmark/i }));
    const dialog = await screen.findByRole('dialog', { name: /add bookmark/i });
    const collectionSelect = within(dialog).getByRole('combobox');
    if (collectionSelect.tagName === 'SELECT') expect(collectionSelect).toHaveValue('collection-1');
    else expect(collectionSelect).toHaveTextContent('Reading');
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^URL/i }), { target: { value: 'https://example.com/added' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Title/i }), { target: { value: 'Added in Reading' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add bookmark' }));
    expect(await screen.findByText('Added in Reading')).toBeInTheDocument();
    expect(nestedCalls).toBeGreaterThan(1);
  });

  it('edits a bookmark with PUT and removes it after moving it out of the collection', async () => {
    const visible = bookmark({ id: 'bookmark-1', collectionId: 'collection-1' });
    const moved = bookmark({ id: 'bookmark-1', title: 'Moved to another collection', collectionId: null });
    let nestedCalls = 0;
    api.request.mockImplementation((path: string, init: RequestInit = {}) => {
      if (path === '/collections/collection-1') return Promise.resolve(envelope(reading));
      if (path === '/collections/collection-1/bookmarks?page=1&pageSize=20') {
        nestedCalls += 1;
        return Promise.resolve(listEnvelope(nestedCalls > 1 ? [] : [visible], { page: 1, pageSize: 20, total: nestedCalls > 1 ? 0 : 1, totalPages: nestedCalls > 1 ? 0 : 1 }));
      }
      if (path === '/collections?page=1&pageSize=100') return Promise.resolve(listEnvelope([reading], { page: 1, pageSize: 100, total: 1, totalPages: 1 }));
      if (path === '/bookmarks/bookmark-1' && init.method === 'PUT') return Promise.resolve(envelope(moved, { message: 'Bookmark updated' }));
      throw new Error(`Unexpected API request ${init.method ?? 'GET'} ${path}`);
    });

    renderDetail();
    expect(await screen.findByText('Example article')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit bookmark' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Title/i }), { target: { value: moved.title } });
    const editCollectionSelect = within(dialog).getByRole('combobox');
    if (editCollectionSelect.tagName === 'SELECT') fireEvent.change(editCollectionSelect, { target: { value: '' } });
    else {
      fireEvent.mouseDown(editCollectionSelect);
      fireEvent.click(await screen.findByRole('option', { name: 'Uncategorized' }));
    }
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith('/bookmarks/bookmark-1', expect.objectContaining({ method: 'PUT' })));
    await waitFor(() => expect(screen.queryByText('Example article')).not.toBeInTheDocument());
    expect(nestedCalls).toBeGreaterThan(1);
  });
});

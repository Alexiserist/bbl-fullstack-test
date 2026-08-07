import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarkDetailPage } from './BookmarkDetailPage';
import { bookmark, collection, envelope, listEnvelope } from '../test/fixtures';

const api = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, useApiRequest: () => api.request };
});

const reading = collection({ id: 'collection-1', name: 'Reading' });

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/bookmarks/bookmark-1']}>
      <Routes>
        <Route element={<BookmarkDetailPage />} path="/bookmarks/:id" />
        <Route element={<h1>Bookmarks list</h1>} path="/bookmarks" />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BookmarkDetailPage', () => {
  beforeEach(() => {
    api.request.mockReset();
  });

  it('edits all writable fields, refreshes the detail, and renders Uncategorized when collection is cleared', async () => {
    const original = bookmark({ id: 'bookmark-1', collectionId: 'collection-1' });
    const edited = bookmark({ id: 'bookmark-1', title: 'Edited bookmark', notes: null, collectionId: null });
    let current = original;
    api.request.mockImplementation((path: string, init: RequestInit = {}) => {
      if (path === '/bookmarks/bookmark-1' && init.method === 'PUT') {
        current = edited;
        return Promise.resolve(envelope(edited, { message: 'Bookmark updated' }));
      }
      if (path === '/bookmarks/bookmark-1') return Promise.resolve(envelope(current));
      if (path === '/collections/collection-1') return Promise.resolve(envelope(reading));
      if (path === '/collections?page=1&pageSize=100') return Promise.resolve(listEnvelope([reading], { page: 1, pageSize: 100, total: 1, totalPages: 1 }));
      throw new Error(`Unexpected API request ${init.method ?? 'GET'} ${path}`);
    });

    renderDetail();
    expect(await screen.findByRole('heading', { name: original.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit bookmark' });
    expect(within(dialog).getByRole('textbox', { name: /^URL/i })).toHaveValue(original.url);
    expect(within(dialog).getByRole('textbox', { name: /^Title/i })).toHaveValue(original.title);
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Title/i }), { target: { value: edited.title } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Notes/i }), { target: { value: '' } });
    const collectionSelect = within(dialog).getByRole('combobox');
    if (collectionSelect.tagName === 'SELECT') fireEvent.change(collectionSelect, { target: { value: '' } });
    else {
      fireEvent.mouseDown(collectionSelect);
      fireEvent.click(await screen.findByRole('option', { name: 'Uncategorized' }));
    }
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(api.request).toHaveBeenCalledWith('/bookmarks/bookmark-1', expect.objectContaining({ method: 'PUT' })));
    expect(await screen.findByRole('heading', { name: edited.title })).toBeInTheDocument();
    expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    expect(screen.getByText('No notes.')).toBeInTheDocument();
  });

  it('requires confirmation for deletion and navigates to the bookmark list after confirming', async () => {
    const current = bookmark({ id: 'bookmark-1' });
    api.request.mockImplementation((path: string, init: RequestInit = {}) => {
      if (path === '/bookmarks/bookmark-1' && init.method === 'DELETE') return Promise.resolve(envelope(null, { message: 'Bookmark deleted' }));
      if (path === '/bookmarks/bookmark-1') return Promise.resolve(envelope(current));
      if (path === '/collections/collection-1') return Promise.resolve(envelope(reading));
      throw new Error(`Unexpected API request ${init.method ?? 'GET'} ${path}`);
    });

    renderDetail();
    expect(await screen.findByRole('heading', { name: current.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(api.request.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: current.title })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith('/bookmarks/bookmark-1', expect.objectContaining({ method: 'DELETE' })));
    expect(await screen.findByRole('heading', { name: 'Bookmarks list' })).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarksPage } from './BookmarksPage';
import { bookmark, collection, envelope, listEnvelope } from '../test/fixtures';

const api = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, useApiRequest: () => api.request };
});

const reading = collection({ id: 'collection-1', name: 'Reading' });
const work = collection({ id: 'collection-2', name: 'Work' });

function listResponse(items = [bookmark()], page = 1, total = items.length, totalPages = total ? 1 : 0) {
  return listEnvelope(items, { page, pageSize: 20, total, totalPages });
}

function routeFrom(path: unknown) {
  const [pathname, query = ''] = String(path ?? '').split('?');
  return { pathname, params: new URLSearchParams(query) };
}

describe('BookmarksPage', () => {
  beforeEach(() => {
    api.request.mockReset();
  });

  it('loads all collection option pages in batches of 100 and exposes later options', async () => {
    const later = collection({ id: 'collection-101', name: 'Later collection' });
    api.request.mockImplementation((path: string) => {
      const route = routeFrom(path);
      if (route.pathname === '/collections' && route.params.get('page') === '1') {
        return Promise.resolve(listEnvelope([reading], { page: 1, pageSize: 100, total: 101, totalPages: 2 }));
      }
      if (route.pathname === '/collections' && route.params.get('page') === '2') {
        return Promise.resolve(listEnvelope([later], { page: 2, pageSize: 100, total: 101, totalPages: 2 }));
      }
      if (route.pathname === '/bookmarks') return Promise.resolve(listResponse([]));
      throw new Error(`Unexpected API request ${String(path)}`);
    });

    render(<MemoryRouter><BookmarksPage /></MemoryRouter>);
    expect(await screen.findByText('No bookmarks match this view yet.')).toBeInTheDocument();
    expect(api.request).toHaveBeenCalledWith('/collections?page=1&pageSize=100');
    expect(api.request).toHaveBeenCalledWith('/collections?page=2&pageSize=100');

    const filter = screen.getByRole('combobox', { name: 'Show' });
    fireEvent.mouseDown(filter);
    expect(await screen.findByRole('option', { name: 'Later collection' })).toBeInTheDocument();
    fireEvent.input(filter, { target: { value: 'Later' } });
    expect(screen.getByRole('option', { name: 'Later collection' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Reading' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Later collection' }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith('/bookmarks?page=1&pageSize=20&collectionId=collection-101'));
  });

  it('uses only supported filter parameters and resets to page one when the filter changes', async () => {
    api.request.mockImplementation((path: string) => {
      const route = routeFrom(path);
      if (route.pathname === '/collections') return Promise.resolve(listEnvelope([reading], { page: 1, pageSize: 100, total: 1, totalPages: 1 }));
      if (route.pathname === '/bookmarks' && route.params.get('page') === '1' && !route.params.has('uncategorized') && !route.params.has('collectionId')) return Promise.resolve(listResponse([bookmark()], 1, 21, 2));
      if (route.pathname === '/bookmarks' && route.params.get('page') === '2') return Promise.resolve(listResponse([bookmark({ id: 'bookmark-2', title: 'Page two' })], 2, 21, 2));
      if (route.pathname === '/bookmarks' && route.params.get('uncategorized') === 'true') return Promise.resolve(listResponse([], 1, 0, 0));
      if (route.pathname === '/bookmarks' && route.params.get('collectionId') === 'collection-1') return Promise.resolve(listResponse([], 1, 0, 0));
      throw new Error(`Unexpected API request ${String(path)}`);
    });

    render(<MemoryRouter><BookmarksPage /></MemoryRouter>);
    expect(await screen.findByText('Example article')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(await screen.findByText('Page two')).toBeInTheDocument();

    const filter = screen.getByRole('combobox', { name: 'Show' });
    fireEvent.mouseDown(filter);
    fireEvent.click(await screen.findByRole('option', { name: 'Uncategorized' }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith('/bookmarks?page=1&pageSize=20&uncategorized=true'));
    const uncategorizedCall = api.request.mock.calls.find(([path]) => routeFrom(path).params.has('uncategorized'));
    expect(uncategorizedCall).toBeDefined();
    expect(routeFrom(uncategorizedCall![0]).params.has('collectionId')).toBe(false);
  });

  it('resets to page one and requests the selected bookmark page size', async () => {
    api.request.mockImplementation((path: string) => {
      const route = routeFrom(path);
      if (route.pathname === '/collections') {
        return Promise.resolve(listEnvelope([reading], { page: 1, pageSize: 100, total: 1, totalPages: 1 }));
      }
      if (route.pathname === '/bookmarks' && route.params.get('page') === '1' && route.params.get('pageSize') === '20') {
        return Promise.resolve(listResponse([bookmark()], 1, 41, 3));
      }
      if (route.pathname === '/bookmarks' && route.params.get('page') === '2' && route.params.get('pageSize') === '20') {
        return Promise.resolve(listResponse([bookmark({ id: 'bookmark-page-2', title: 'Page two' })], 2, 41, 3));
      }
      if (route.pathname === '/bookmarks' && route.params.get('page') === '1' && route.params.get('pageSize') === '50') {
        return Promise.resolve(listEnvelope([], { page: 1, pageSize: 50, total: 41, totalPages: 1 }));
      }
      throw new Error(`Unexpected API request ${String(path)}`);
    });

    render(<MemoryRouter><BookmarksPage /></MemoryRouter>);
    expect(await screen.findByText('Example article')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page two')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Items per page' }));
    fireEvent.click(await screen.findByRole('option', { name: '50' }));

    await waitFor(() => expect(api.request).toHaveBeenCalledWith('/bookmarks?page=1&pageSize=50'));
    expect(await screen.findByText('No bookmarks match this view yet.')).toBeInTheDocument();
  });

  it('creates through the shared dialog and refreshes the active page after success', async () => {
    const created = bookmark({ id: 'bookmark-created', title: 'Created bookmark' });
    let listCalls = 0;
    api.request.mockImplementation((path: string, init: RequestInit = {}) => {
      const route = routeFrom(path);
      if (route.pathname === '/collections') return Promise.resolve(listEnvelope([reading], { page: 1, pageSize: 100, total: 1, totalPages: 1 }));
      if (route.pathname === '/bookmarks' && init.method === 'POST') return Promise.resolve(envelope(created, { statusCode: 201, message: 'Bookmark created' }));
      if (route.pathname === '/bookmarks') {
        listCalls += 1;
        return Promise.resolve(listResponse(listCalls > 1 ? [created] : [bookmark()]));
      }
      throw new Error(`Unexpected API request ${init.method ?? 'GET'} ${path}`);
    });

    render(<MemoryRouter><BookmarksPage /></MemoryRouter>);
    expect(await screen.findByText('Example article')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add bookmark/i }));
    const dialog = await screen.findByRole('dialog', { name: /add bookmark/i });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^URL/i }), { target: { value: 'https://example.com/created' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Title/i }), { target: { value: 'Created bookmark' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add bookmark' }));
    expect(await screen.findByText('Created bookmark')).toBeInTheDocument();
    expect(api.request).toHaveBeenCalledWith('/bookmarks', expect.objectContaining({ method: 'POST' }));
    expect(listCalls).toBeGreaterThan(1);
  });

  it('edits with PUT, then removes a moved bookmark after refreshing the current filter', async () => {
    const visible = bookmark({ id: 'bookmark-1', collectionId: 'collection-1' });
    const edited = bookmark({ id: 'bookmark-1', title: 'Moved away', collectionId: 'collection-2' });
    let listCalls = 0;
    api.request.mockImplementation((path: string, init: RequestInit = {}) => {
      const route = routeFrom(path);
      if (route.pathname === '/collections') return Promise.resolve(listEnvelope([reading, work], { page: 1, pageSize: 100, total: 2, totalPages: 1 }));
      if (route.pathname === '/bookmarks/bookmark-1' && init.method === 'PUT') return Promise.resolve(envelope(edited, { message: 'Bookmark updated' }));
      if (route.pathname === '/bookmarks') {
        listCalls += 1;
        return Promise.resolve(listResponse(listCalls > 1 ? [] : [visible], 1, listCalls > 1 ? 0 : 1, listCalls > 1 ? 0 : 1));
      }
      throw new Error(`Unexpected API request ${init.method ?? 'GET'} ${path}`);
    });

    render(<MemoryRouter><BookmarksPage /></MemoryRouter>);
    expect(await screen.findByText('Example article')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit bookmark' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Title/i }), { target: { value: 'Moved away' } });
    const collectionSelect = within(dialog).getByRole('combobox');
    if (collectionSelect.tagName === 'SELECT') fireEvent.change(collectionSelect, { target: { value: 'collection-2' } });
    else {
      fireEvent.mouseDown(collectionSelect);
      fireEvent.click(await screen.findByRole('option', { name: 'Work' }));
    }
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(api.request).toHaveBeenCalledWith('/bookmarks/bookmark-1', expect.objectContaining({ method: 'PUT' })));
    await waitFor(() => expect(screen.queryByText('Example article')).not.toBeInTheDocument());
    expect(listCalls).toBeGreaterThan(1);
  });

  it('uses an accessible delete confirmation and refetches metadata after confirmation', async () => {
    let listCalls = 0;
    api.request.mockImplementation((path: string, init: RequestInit = {}) => {
      const route = routeFrom(path);
      if (route.pathname === '/collections') return Promise.resolve(listEnvelope([reading], { page: 1, pageSize: 100, total: 1, totalPages: 1 }));
      if (route.pathname === '/bookmarks/bookmark-1' && init.method === 'DELETE') return Promise.resolve(envelope(null, { message: 'Bookmark deleted' }));
      if (route.pathname === '/bookmarks') {
        listCalls += 1;
        return Promise.resolve(listResponse(listCalls > 1 ? [] : [bookmark()], 1, listCalls > 1 ? 0 : 1, listCalls > 1 ? 0 : 1));
      }
      throw new Error(`Unexpected API request ${init.method ?? 'GET'} ${path}`);
    });

    render(<MemoryRouter><BookmarksPage /></MemoryRouter>);
    expect(await screen.findByText('Example article')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(api.request.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    expect(screen.getByText('Example article')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith('/bookmarks/bookmark-1', expect.objectContaining({ method: 'DELETE' })));
    await waitFor(() => expect(screen.getByText('No bookmarks match this view yet.')).toBeInTheDocument());
    expect(listCalls).toBeGreaterThan(1);
  });
});

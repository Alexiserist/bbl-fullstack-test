import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionsPage } from './CollectionsPage';
import { collection, bookmark, envelope, listEnvelope } from '../test/fixtures';

const api = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, useApiRequest: () => api.request };
});

const collections = [
  collection({ id: 'collection-1', name: 'Reading' }),
  collection({ id: 'collection-2', name: 'Work' }),
];

describe('CollectionsPage', () => {
  beforeEach(() => {
    api.request.mockReset();
  });

  it('does not request nested bookmarks until a collection is expanded', async () => {
    api.request.mockImplementation((path: string, init: RequestInit = {}) => {
      if ((init.method ?? 'GET') === 'GET' && path === '/collections?page=1&pageSize=20') {
        return Promise.resolve(listEnvelope(collections, { page: 1, pageSize: 20, total: 2, totalPages: 1 }));
      }
      if (path === '/collections/collection-1/bookmarks?page=1&pageSize=5') {
        return Promise.resolve(listEnvelope([bookmark()], { page: 1, pageSize: 5, total: 1, totalPages: 1 }));
      }
      throw new Error(`Unexpected API request ${init.method ?? 'GET'} ${path}`);
    });

    render(<MemoryRouter><CollectionsPage /></MemoryRouter>);
    expect(await screen.findByText('Reading')).toBeInTheDocument();
    expect(api.request.mock.calls.some(([path]) => String(path).includes('/bookmarks'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /Reading/i }));
    expect(await screen.findByText('Example article')).toBeInTheDocument();
    expect(api.request).toHaveBeenCalledWith('/collections/collection-1/bookmarks?page=1&pageSize=5');
  });

  it('caches expanded pages and closes the previous collection when another opens', async () => {
    api.request.mockImplementation((path: string) => {
      if (path === '/collections?page=1&pageSize=20') return Promise.resolve(listEnvelope(collections, { total: 2, totalPages: 1 }));
      if (path === '/collections/collection-1/bookmarks?page=1&pageSize=5') return Promise.resolve(listEnvelope([bookmark()], { page: 1, pageSize: 5, total: 1, totalPages: 1 }));
      if (path === '/collections/collection-2/bookmarks?page=1&pageSize=5') return Promise.resolve(listEnvelope([bookmark({ id: 'bookmark-2', title: 'Work article', collectionId: 'collection-2' })], { page: 1, pageSize: 5, total: 1, totalPages: 1 }));
      throw new Error(`Unexpected API request ${path}`);
    });

    render(<MemoryRouter><CollectionsPage /></MemoryRouter>);
    await screen.findByText('Reading');
    const readingSummary = screen.getByRole('button', { name: /Reading/i });
    fireEvent.click(readingSummary);
    expect(await screen.findByText('Example article')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Work/i }));
    expect(await screen.findByText('Work article')).toBeInTheDocument();
    expect(screen.queryByText('Example article')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reading/i }));
    expect(await screen.findByText('Example article')).toBeInTheDocument();
    expect(api.request.mock.calls.filter(([path]) => path === '/collections/collection-1/bookmarks?page=1&pageSize=5')).toHaveLength(1);
  });

  it('requests nested pages at five items and returns to cached pages without refetching', async () => {
    const pageOne = Array.from({ length: 5 }, (_, index) => bookmark({ id: `bookmark-${index + 1}`, title: `Article ${index + 1}` }));
    const pageTwo = [bookmark({ id: 'bookmark-6', title: 'Article 6' })];
    api.request.mockImplementation((path: string) => {
      if (path === '/collections?page=1&pageSize=20') return Promise.resolve(listEnvelope([collections[0]], { total: 1, totalPages: 1 }));
      if (path === '/collections/collection-1/bookmarks?page=1&pageSize=5') return Promise.resolve(listEnvelope(pageOne, { page: 1, pageSize: 5, total: 6, totalPages: 2 }));
      if (path === '/collections/collection-1/bookmarks?page=2&pageSize=5') return Promise.resolve(listEnvelope(pageTwo, { page: 2, pageSize: 5, total: 6, totalPages: 2 }));
      throw new Error(`Unexpected API request ${path}`);
    });

    render(<MemoryRouter><CollectionsPage /></MemoryRouter>);
    await screen.findByText('Reading');
    fireEvent.click(screen.getByRole('button', { name: /Reading/i }));
    expect(await screen.findByText('Article 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(await screen.findByText('Article 6')).toBeInTheDocument();
    expect(api.request).toHaveBeenCalledWith('/collections/collection-1/bookmarks?page=2&pageSize=5');

    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(await screen.findByText('Article 1')).toBeInTheDocument();
    expect(api.request.mock.calls.filter(([path]) => path === '/collections/collection-1/bookmarks?page=1&pageSize=5')).toHaveLength(1);
  });

  it('opens collection-level bookmark creation with a preselected but editable collection', async () => {
    const created = bookmark({ id: 'bookmark-created', title: 'Created from collection' });
    let collectionListCalls = 0;
    api.request.mockImplementation((path: string, init: RequestInit = {}) => {
      if (path === '/collections?page=1&pageSize=20') {
        collectionListCalls += 1;
        return Promise.resolve(listEnvelope([collections[0]], { total: 1, totalPages: 1 }));
      }
      if (path === '/collections/collection-1/bookmarks?page=1&pageSize=5') return Promise.resolve(listEnvelope([], { page: 1, pageSize: 5, total: 0, totalPages: 0 }));
      if (path === '/bookmarks' && init.method === 'POST') return Promise.resolve(envelope(created, { statusCode: 201, message: 'Bookmark created' }));
      throw new Error(`Unexpected API request ${init.method ?? 'GET'} ${path}`);
    });

    render(<MemoryRouter><CollectionsPage /></MemoryRouter>);
    await screen.findByText('Reading');
    fireEvent.click(screen.getByRole('button', { name: /Reading/i }));
    await screen.findByText(/no bookmarks/i);
    fireEvent.click(screen.getAllByRole('button', { name: /^Add bookmark$/ })[1]);

    const dialog = await screen.findByRole('dialog', { name: /add bookmark/i });
    expect(within(dialog).getByRole('combobox', { name: /collection/i })).toHaveTextContent('Reading');
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^URL/i }), { target: { value: 'https://example.com/new' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Title/i }), { target: { value: 'New bookmark' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /add bookmark/i }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith('/bookmarks', expect.objectContaining({ method: 'POST' })));
    const createCall = api.request.mock.calls.find(([path, init]) => path === '/bookmarks' && init?.method === 'POST');
    expect(createCall).toBeDefined();
    expect(JSON.parse(createCall![1].body as string)).toMatchObject({ collectionId: 'collection-1', url: 'https://example.com/new', title: 'New bookmark', notes: null });
    await waitFor(() => expect(collectionListCalls).toBeGreaterThan(0));
  });

  it('uses a confirmation dialog for collection deletion and leaves the item on cancel', async () => {
    api.request.mockImplementation((path: string, init: RequestInit = {}) => {
      if (path === '/collections?page=1&pageSize=20') return Promise.resolve(listEnvelope([collections[0]], { total: 1, totalPages: 1 }));
      if (path === '/collections/collection-1' && init.method === 'DELETE') return Promise.resolve(envelope(null, { message: 'Collection deleted' }));
      throw new Error(`Unexpected API request ${init.method ?? 'GET'} ${path}`);
    });

    render(<MemoryRouter><CollectionsPage /></MemoryRouter>);
    await screen.findByText('Reading');
    fireEvent.click(screen.getAllByText('Delete')[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(api.request.mock.calls.some(([path, init]) => path === '/collections/collection-1' && init?.method === 'DELETE')).toBe(false);
    expect(screen.getByText('Reading')).toBeInTheDocument();
  });

  it('shows nested errors inside the expanded collection without hiding other collections', async () => {
    api.request.mockImplementation((path: string) => {
      if (path === '/collections?page=1&pageSize=20') return Promise.resolve(listEnvelope(collections, { total: 2, totalPages: 1 }));
      if (path === '/collections/collection-1/bookmarks?page=1&pageSize=5') return Promise.reject(new Error('Unable to load collection bookmarks.'));
      throw new Error(`Unexpected API request ${path}`);
    });

    render(<MemoryRouter><CollectionsPage /></MemoryRouter>);
    await screen.findByText('Reading');
    fireEvent.click(screen.getByRole('button', { name: /Reading/i }));
    expect(api.request).toHaveBeenCalledWith('/collections/collection-1/bookmarks?page=1&pageSize=5');
    expect(await screen.findByText('Unable to load bookmarks.')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });
});

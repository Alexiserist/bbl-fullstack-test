import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { BookmarkFormDialog } from './BookmarkFormDialog';
import { bookmark, collection, envelope } from '../test/fixtures';

const api = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, useApiRequest: () => api.request };
});

const collections = [
  collection({ id: 'collection-1', name: 'Reading' }),
  collection({ id: 'collection-2', name: 'Work' }),
];

function renderDialog(props: Partial<React.ComponentProps<typeof BookmarkFormDialog>> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <BookmarkFormDialog
      collections={collections}
      mode="create"
      onClose={onClose}
      onSaved={onSaved}
      open
      {...props}
    />,
  );
  return { onClose, onSaved };
}

describe('BookmarkFormDialog', () => {
  beforeEach(() => {
    api.request.mockReset();
  });

  it('has an accessible create dialog and normalizes blank notes and no collection to null', async () => {
    const saved = bookmark({ id: 'bookmark-created', notes: null, collectionId: null });
    api.request.mockResolvedValue(envelope(saved, { statusCode: 201, message: 'Bookmark created' }));
    const { onClose, onSaved } = renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Add bookmark' });

    expect(within(dialog).getByRole('textbox', { name: /^URL/i })).toHaveAttribute('maxlength', '2048');
    expect(within(dialog).getByRole('textbox', { name: /^Title/i })).toHaveAttribute('maxlength', '300');
    expect(within(dialog).getByRole('textbox', { name: /^Notes/i })).toHaveAttribute('maxlength', '10000');
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^URL/i }), { target: { value: '  https://example.com/new  ' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Title/i }), { target: { value: '  New bookmark  ' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Notes/i }), { target: { value: '   ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add bookmark' }));

    await waitFor(() => expect(api.request).toHaveBeenCalledWith('/bookmarks', expect.objectContaining({ method: 'POST' })));
    const [, init] = api.request.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      url: 'https://example.com/new',
      title: 'New bookmark',
      notes: null,
      collectionId: null,
    });
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('preselects the requested collection but allows changing it before create', async () => {
    api.request.mockResolvedValue(envelope(bookmark({ collectionId: 'collection-2' }), { statusCode: 201 }));
    renderDialog({ defaultCollectionId: 'collection-1' });
    const dialog = screen.getByRole('dialog', { name: 'Add bookmark' });
    expect(within(dialog).getByRole('combobox', { name: 'Collection' })).toHaveTextContent('Reading');

    fireEvent.change(within(dialog).getByRole('textbox', { name: /^URL/i }), { target: { value: 'https://example.com/new' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Title/i }), { target: { value: 'New bookmark' } });
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Collection' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Work' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add bookmark' }));

    await waitFor(() => expect(api.request).toHaveBeenCalled());
    expect(JSON.parse(api.request.mock.calls[0][1].body as string).collectionId).toBe('collection-2');
  });

  it('hydrates edit mode and sends a complete writable PUT representation, including null clearing', async () => {
    const original = bookmark({ notes: 'Existing note', collectionId: 'collection-1' });
    const saved = bookmark({ title: 'Edited title', notes: null, collectionId: null });
    api.request.mockResolvedValue(envelope(saved, { message: 'Bookmark updated' }));
    const { onSaved } = renderDialog({ mode: 'edit', bookmark: original });
    const dialog = screen.getByRole('dialog', { name: 'Edit bookmark' });
    expect(within(dialog).getByRole('textbox', { name: /^URL/i })).toHaveValue(original.url);
    expect(within(dialog).getByRole('textbox', { name: /^Title/i })).toHaveValue(original.title);
    expect(within(dialog).getByRole('textbox', { name: /^Notes/i })).toHaveValue(original.notes);
    expect(within(dialog).getByRole('combobox', { name: 'Collection' })).toHaveTextContent('Reading');

    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Title/i }), { target: { value: 'Edited title' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Notes/i }), { target: { value: ' ' } });
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Collection' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Uncategorized' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(api.request).toHaveBeenCalledWith('/bookmarks/bookmark-1', expect.objectContaining({ method: 'PUT' })));
    const [, init] = api.request.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      url: original.url,
      title: 'Edited title',
      notes: null,
      collectionId: null,
    });
    expect(JSON.parse(init.body as string)).not.toHaveProperty('ownerId');
    expect(JSON.parse(init.body as string)).not.toHaveProperty('id');
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it('keeps the dialog open and renders API errors, while canceling makes no request', async () => {
    api.request.mockRejectedValue(new ApiError({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'Request validation failed', details: [] }));
    const { onClose } = renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Add bookmark' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^URL/i }), { target: { value: 'https://example.com/new' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Title/i }), { target: { value: 'New bookmark' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add bookmark' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Request validation failed');
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(api.request).toHaveBeenCalledOnce();
  });

  it('disables the submit action while a save is pending', async () => {
    let resolve!: (value: unknown) => void;
    api.request.mockReturnValue(new Promise((promiseResolve) => { resolve = promiseResolve; }));
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Add bookmark' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^URL/i }), { target: { value: 'https://example.com/new' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Title/i }), { target: { value: 'New bookmark' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add bookmark' }));
    expect(within(dialog).getByRole('button', { name: /saving/i })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    resolve(envelope(bookmark({ notes: null, collectionId: null }), { statusCode: 201 }));
  });
});

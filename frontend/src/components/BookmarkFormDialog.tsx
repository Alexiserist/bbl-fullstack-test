import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { ApiError, useApiRequest } from '../api/client';
import type { Bookmark, Collection } from '../api/types';

export interface BookmarkFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  bookmark?: Bookmark | null;
  defaultCollectionId?: string | null;
  collections: Collection[];
  onClose: () => void;
  onSaved: (bookmark: Bookmark) => void;
}

/**
 * The one bookmark form used by every bookmark surface. Keeping the request
 * here means pages only need to react to a saved resource and can refresh the
 * appropriate list or nested cache.
 */
export function BookmarkFormDialog({
  open,
  mode,
  bookmark,
  defaultCollectionId = null,
  collections,
  onClose,
  onSaved,
}: BookmarkFormDialogProps) {
  const request = useApiRequest();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const options = useMemo(() => {
    const byId = new Map(collections.map((item) => [item.id, item]));
    if (bookmark?.collectionId && !byId.has(bookmark.collectionId)) {
      // A detail page may have loaded only the current collection. Keep the
      // current relation visible while the user decides whether to clear it.
      byId.set(bookmark.collectionId, {
        id: bookmark.collectionId,
        name: 'Current collection',
        ownerId: bookmark.ownerId,
        createdAt: bookmark.createdAt,
        updatedAt: bookmark.updatedAt,
      });
    }
    return [...byId.values()];
  }, [bookmark, collections]);

  useEffect(() => {
    if (!open) return;
    setUrl(bookmark?.url ?? '');
    setTitle(bookmark?.title ?? '');
    setNotes(bookmark?.notes ?? '');
    setCollectionId(bookmark?.collectionId ?? defaultCollectionId ?? '');
    setError('');
    setSubmitting(false);
  }, [bookmark, defaultCollectionId, open]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUrl = url.trim();
    const normalizedTitle = title.trim();
    const normalizedNotes = notes.trim() || null;
    if (!normalizedUrl || !normalizedTitle) {
      setError('URL and title are required.');
      return;
    }
    setError('');
    setSubmitting(true);
    const payload = {
      url: normalizedUrl,
      title: normalizedTitle,
      notes: normalizedNotes,
      collectionId: collectionId || null,
    };
    const path = mode === 'edit' && bookmark ? `/bookmarks/${bookmark.id}` : '/bookmarks';
    void request<Bookmark>(path, {
      method: mode === 'edit' ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    })
      .then((response) => {
        onSaved(response.data);
        onClose();
      })
      .catch((cause: unknown) => {
        setError(cause instanceof ApiError ? cause.message : 'Unable to save bookmark.');
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <Dialog aria-labelledby="bookmark-form-title" fullWidth maxWidth="sm" onClose={submitting ? undefined : onClose} open={open}>
      <form onSubmit={submit}>
        <DialogTitle id="bookmark-form-title">{mode === 'edit' ? 'Edit bookmark' : 'Add bookmark'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert role="alert" severity="error">{error}</Alert>}
            <TextField
              autoFocus
              fullWidth
              inputMode="url"
              label="URL"
              onChange={(event) => setUrl(event.target.value)}
              required
              slotProps={{ htmlInput: { maxLength: 2048 } }}
              type="url"
              value={url}
            />
            <TextField
              fullWidth
              label="Title"
              onChange={(event) => setTitle(event.target.value)}
              required
              slotProps={{ htmlInput: { maxLength: 300 } }}
              value={title}
            />
            <TextField
              fullWidth
              label="Notes"
              multiline
              minRows={3}
              onChange={(event) => setNotes(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 10000 } }}
              value={notes}
            />
            <FormControl fullWidth>
              <InputLabel id="bookmark-form-collection-label">Collection</InputLabel>
              <Select
                aria-label="Collection"
                label="Collection"
                labelId="bookmark-form-collection-label"
                onChange={(event) => setCollectionId(event.target.value)}
                value={collectionId}
              >
                <MenuItem value="">Uncategorized</MenuItem>
                {options.map((collection) => (
                  <MenuItem key={collection.id} value={collection.id}>{collection.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={submitting} onClick={onClose}>Cancel</Button>
          <Button disabled={submitting} type="submit" variant="contained">
            {submitting ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Add bookmark'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

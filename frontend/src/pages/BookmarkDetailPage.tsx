import { useEffect, useState } from 'react';
import { Alert, Button, Card, CardContent, Chip, Link, Snackbar, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { ApiError, useApiRequest } from '../api/client';
import type { Bookmark, Collection } from '../api/types';
import { BookmarkFormDialog } from '../components/BookmarkFormDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { fetchAllCollections } from '../components/collectionOptions';
import { ErrorState, LoadingState } from '../components/PageState';

export function BookmarkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const request = useApiRequest();
  const navigate = useNavigate();
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [bookmarkCollections, setBookmarkCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError('');
    void request<Bookmark>(`/bookmarks/${id}`)
      .then(async (response) => {
        if (!active) return;
        setBookmark(response.data);
        setCollection(null);
        if (response.data.collectionId) {
          try {
            const collectionResponse = await request<Collection>(`/collections/${response.data.collectionId}`);
            if (active) setCollection(collectionResponse.data);
          } catch {
            // The bookmark remains useful even when a related label cannot be loaded.
          }
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof ApiError ? cause.message : 'Unable to load bookmark.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, request]);

  const ensureBookmarkCollections = () => {
    if (bookmarkCollections.length > 0) return;
    void fetchAllCollections(request)
      .then(setBookmarkCollections)
      .catch(() => {
        if (collection) setBookmarkCollections([collection]);
      });
  };

  const openEdit = () => {
    ensureBookmarkCollections();
    setEditing(true);
  };

  const onSaved = (saved: Bookmark) => {
    setBookmark(saved);
    setEditing(false);
    setNotice('Bookmark updated.');
    if (saved.collectionId) {
      void request<Collection>(`/collections/${saved.collectionId}`)
        .then((response) => setCollection(response.data))
        .catch(() => setCollection(null));
    } else {
      setCollection(null);
    }
  };

  const deleteBookmark = () => {
    if (!bookmark) return;
    setDeleting(true);
    void request<null>(`/bookmarks/${bookmark.id}`, { method: 'DELETE' })
      .then(() => navigate('/bookmarks'))
      .catch((cause: unknown) => setError(cause instanceof ApiError ? cause.message : 'Unable to delete bookmark.'))
      .finally(() => setDeleting(false));
  };

  if (loading) return <LoadingState label="Loading bookmark..." />;
  if (error && !bookmark) return <Stack spacing={2}><ErrorState message={error} /><Button component={RouterLink} to="/bookmarks">Back to bookmarks</Button></Stack>;
  if (!bookmark) return <ErrorState message="Bookmark not found." />;

  return (
    <Stack spacing={3}>
      <Button component={RouterLink} sx={{ alignSelf: 'flex-start' }} to="/bookmarks">← Bookmarks</Button>
      {error && <ErrorState message={error} />}
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography component="h1" variant="h4">{bookmark.title}</Typography>
            <Link href={bookmark.url} rel="noreferrer" sx={{ overflowWrap: 'anywhere' }} target="_blank">{bookmark.url}</Link>
            <Typography>{bookmark.notes || 'No notes.'}</Typography>
            {collection ? <Chip component={RouterLink} label={collection.name} sx={{ alignSelf: 'flex-start' }} to={`/collections/${collection.id}`} clickable /> : <Chip label="Uncategorized" sx={{ alignSelf: 'flex-start' }} />}
            <Typography color="text.secondary" variant="body2">Saved {new Date(bookmark.createdAt).toLocaleString()}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button onClick={openEdit} variant="contained">Edit</Button>
              <Button color="error" onClick={() => setConfirmDelete(true)} variant="outlined">Delete</Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      <BookmarkFormDialog
        bookmark={bookmark}
        collections={bookmarkCollections.length > 0 ? bookmarkCollections : collection ? [collection] : []}
        mode="edit"
        onClose={() => setEditing(false)}
        onSaved={onSaved}
        open={editing}
      />
      <ConfirmDialog
        description={`Delete “${bookmark.title}”?`}
        loading={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={deleteBookmark}
        open={confirmDelete}
        title="Delete bookmark"
      />
      <Snackbar autoHideDuration={4500} onClose={() => setNotice('')} open={Boolean(notice)}>
        <Alert onClose={() => setNotice('')} severity="success">{notice}</Alert>
      </Snackbar>
    </Stack>
  );
}

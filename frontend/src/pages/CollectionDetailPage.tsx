import { useEffect, useState } from 'react';
import { Alert, Button, Card, CardContent, Divider, Snackbar, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { ApiError, useApiRequest } from '../api/client';
import type { Bookmark, Collection, PageMeta } from '../api/types';
import { BookmarkCard } from '../components/BookmarkCard';
import { BookmarkFormDialog } from '../components/BookmarkFormDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { fetchAllCollections } from '../components/collectionOptions';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { PaginationControls } from '../components/PaginationControls';

const emptyMeta: PageMeta = { page: 1, pageSize: 20, total: 0, totalPages: 0 };

export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const request = useApiRequest();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [bookmarkCollections, setBookmarkCollections] = useState<Collection[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [meta, setMeta] = useState<PageMeta>(emptyMeta);
  const [page, setPage] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [bookmarkDialog, setBookmarkDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; bookmark: Bookmark | null }>({
    open: false,
    mode: 'create',
    bookmark: null,
  });
  const [bookmarkToDelete, setBookmarkToDelete] = useState<Bookmark | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError('');
    const query = `?page=${page}&pageSize=20`;
    void Promise.all([
      request<Collection>(`/collections/${id}`),
      request<Bookmark[]>(`/collections/${id}/bookmarks${query}`),
    ])
      .then(([collectionResponse, bookmarkResponse]) => {
        if (!active) return;
        setCollection(collectionResponse.data);
        setBookmarks(bookmarkResponse.data);
        setMeta(bookmarkResponse.meta ?? emptyMeta);
        const totalPages = bookmarkResponse.meta?.totalPages ?? 0;
        if (page > 1 && totalPages === 0) setPage(1);
        else if (totalPages > 0 && page > totalPages) setPage(totalPages);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof ApiError ? cause.message : 'Unable to load collection.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, page, refreshToken, request]);

  const ensureBookmarkCollections = () => {
    if (bookmarkCollections.length > 0) return;
    void fetchAllCollections(request)
      .then(setBookmarkCollections)
      .catch(() => {
        if (collection) setBookmarkCollections([collection]);
      });
  };

  const openCreateBookmark = () => {
    ensureBookmarkCollections();
    setBookmarkDialog({ open: true, mode: 'create', bookmark: null });
  };
  const openEditBookmark = (bookmark: Bookmark) => {
    ensureBookmarkCollections();
    setBookmarkDialog({ open: true, mode: 'edit', bookmark });
  };

  const onBookmarkSaved = (saved: Bookmark) => {
    setBookmarkDialog((current) => ({ ...current, open: false }));
    setNotice(bookmarkDialog.mode === 'edit' ? 'Bookmark updated.' : 'Bookmark created.');
    setPage(1);
    setRefreshToken((value) => value + 1);
    // A bookmark edited into another collection no longer belongs in this
    // nested list; the refreshed page will apply the relation filter.
    if (saved.collectionId !== id) setBookmarks((current) => current.filter((item) => item.id !== saved.id));
  };

  const deleteBookmark = () => {
    if (!bookmarkToDelete) return;
    setDeleting(true);
    void request<null>(`/bookmarks/${bookmarkToDelete.id}`, { method: 'DELETE' })
      .then(() => {
        setNotice('Bookmark deleted.');
        setBookmarkToDelete(null);
        setRefreshToken((value) => value + 1);
      })
      .catch((cause: unknown) => setError(cause instanceof ApiError ? cause.message : 'Unable to delete bookmark.'))
      .finally(() => setDeleting(false));
  };

  if (loading) return <LoadingState label="Loading collection..." />;
  if (error && !collection) return <Stack spacing={2}><ErrorState message={error} /><Button onClick={() => navigate('/collections')}>Back to collections</Button></Stack>;
  if (!collection) return <ErrorState message="Collection not found." />;

  return (
    <Stack spacing={3}>
      <Stack direction={{ sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}>
        <Stack spacing={1}>
          <Button component={RouterLink} sx={{ alignSelf: 'flex-start' }} to="/collections">← Collections</Button>
          <Typography component="h1" variant="h4">{collection.name}</Typography>
          <Typography color="text.secondary">Bookmarks in this collection</Typography>
        </Stack>
        <Button onClick={openCreateBookmark} variant="contained">Add bookmark</Button>
      </Stack>
      {error && <ErrorState message={error} />}
      <Divider />
      {bookmarks.length === 0 ? <EmptyState>This collection has no bookmarks.</EmptyState> : (
        <Stack spacing={2}>
          {bookmarks.map((bookmark) => (
            <BookmarkCard key={bookmark.id} bookmark={bookmark} onDelete={setBookmarkToDelete} onEdit={openEditBookmark} />
          ))}
          <PaginationControls meta={meta} onPage={setPage} />
        </Stack>
      )}

      <BookmarkFormDialog
        bookmark={bookmarkDialog.bookmark}
        collections={bookmarkCollections.length > 0 ? bookmarkCollections : [collection]}
        defaultCollectionId={collection.id}
        mode={bookmarkDialog.mode}
        onClose={() => setBookmarkDialog((current) => ({ ...current, open: false }))}
        onSaved={onBookmarkSaved}
        open={bookmarkDialog.open}
      />
      <ConfirmDialog
        description={bookmarkToDelete ? `Delete “${bookmarkToDelete.title}”?` : ''}
        loading={deleting}
        onCancel={() => setBookmarkToDelete(null)}
        onConfirm={deleteBookmark}
        open={Boolean(bookmarkToDelete)}
        title="Delete bookmark"
      />
      <Snackbar autoHideDuration={4500} onClose={() => setNotice('')} open={Boolean(notice)}>
        <Alert onClose={() => setNotice('')} severity="success">{notice}</Alert>
      </Snackbar>
    </Stack>
  );
}

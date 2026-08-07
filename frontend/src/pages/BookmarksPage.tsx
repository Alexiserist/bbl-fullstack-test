import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ApiError, useApiRequest } from '../api/client';
import type { Bookmark, Collection, PageMeta } from '../api/types';
import { BookmarkCard } from '../components/BookmarkCard';
import { BookmarkFormDialog } from '../components/BookmarkFormDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { fetchAllCollections } from '../components/collectionOptions';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { PaginationControls } from '../components/PaginationControls';

const emptyMeta: PageMeta = { page: 1, pageSize: 20, total: 0, totalPages: 0 };
type BookmarkFilter = 'all' | 'uncategorized' | string;
interface BookmarkFilterOption {
  label: string;
  value: BookmarkFilter;
}

export function BookmarksPage() {
  const request = useApiRequest();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [filter, setFilter] = useState<BookmarkFilter>('all');
  const [filterInput, setFilterInput] = useState('All bookmarks');
  const [meta, setMeta] = useState<PageMeta>(emptyMeta);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(emptyMeta.pageSize);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [bookmarkDialog, setBookmarkDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; bookmark: Bookmark | null }>({
    open: false,
    mode: 'create',
    bookmark: null,
  });
  const [bookmarkToDelete, setBookmarkToDelete] = useState<Bookmark | null>(null);
  const [deleting, setDeleting] = useState(false);
  const bookmarkRequestId = useRef(0);
  const filterOptions = useMemo<BookmarkFilterOption[]>(() => [
    { label: 'All bookmarks', value: 'all' },
    { label: 'Uncategorized', value: 'uncategorized' },
    ...collections.map((collection) => ({ label: collection.name, value: collection.id })),
  ], [collections]);
  const selectedFilterOption = filterOptions.find((option) => option.value === filter) ?? filterOptions[0];

  const loadCollectionOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      setCollections(await fetchAllCollections(request));
    } catch {
      // Collection options are helpful but should not prevent bookmark reads.
    } finally {
      setOptionsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadCollectionOptions();
  }, [loadCollectionOptions]);

  const loadBookmarks = useCallback(() => {
    const requestId = ++bookmarkRequestId.current;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filter === 'uncategorized') params.set('uncategorized', 'true');
    if (filter !== 'all' && filter !== 'uncategorized') params.set('collectionId', filter);
    void request<Bookmark[]>(`/bookmarks?${params.toString()}`)
      .then((response) => {
        if (requestId !== bookmarkRequestId.current) return;
        const nextMeta = response.meta ?? emptyMeta;
        setBookmarks(response.data);
        setMeta(nextMeta);
        if (nextMeta.totalPages === 0 && page !== 1) setPage(1);
        else if (nextMeta.totalPages > 0 && page > nextMeta.totalPages) setPage(nextMeta.totalPages);
      })
      .catch((cause: unknown) => {
        if (requestId === bookmarkRequestId.current) {
          setError(cause instanceof ApiError ? cause.message : 'Unable to load bookmarks.');
        }
      })
      .finally(() => {
        if (requestId === bookmarkRequestId.current) setLoading(false);
      });
  }, [filter, page, pageSize, request]);

  useEffect(() => {
    loadBookmarks();
    return () => {
      bookmarkRequestId.current += 1;
    };
  }, [loadBookmarks, refreshToken]);

  const openCreateBookmark = () => setBookmarkDialog({ open: true, mode: 'create', bookmark: null });
  const openEditBookmark = (bookmark: Bookmark) => setBookmarkDialog({ open: true, mode: 'edit', bookmark });

  const onBookmarkSaved = () => {
    setBookmarkDialog((current) => ({ ...current, open: false }));
    setNotice(bookmarkDialog.mode === 'edit' ? 'Bookmark updated.' : 'Bookmark created.');
    setPage(1);
    setRefreshToken((value) => value + 1);
    // A bookmark may have moved into or out of the active collection filter;
    // always reload the canonical page instead of patching a stale card.
    void loadCollectionOptions();
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

  return (
    <Stack spacing={3}>
      <Stack direction={{ sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}>
        <Stack spacing={1}>
          <Typography component="h1" variant="h4">Bookmarks</Typography>
          <Typography color="text.secondary">Save links and find them again whenever you need them.</Typography>
        </Stack>
        <Button onClick={openCreateBookmark} variant="contained">Add bookmark</Button>
      </Stack>

      <Autocomplete
        disableClearable
        getOptionLabel={(option) => option.label}
        inputValue={filterInput}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        loading={optionsLoading}
        loadingText="Loading collections..."
        noOptionsText="No collections found"
        onChange={(_event, option) => {
          setFilter(option.value);
          setFilterInput(option.label);
          setPage(1);
        }}
        onInputChange={(_event, value, reason) => {
          if (reason === 'input' || reason === 'clear') setFilterInput(value);
          if (reason === 'blur') setFilterInput(selectedFilterOption.label);
        }}
        options={filterOptions}
        renderInput={(params) => <TextField {...params} label="Show" placeholder="Search collections" />}
        sx={{ maxWidth: { sm: 360 } }}
        value={selectedFilterOption}
      />
      {error && <ErrorState message={error} />}
      {loading ? <LoadingState label="Loading bookmarks..." /> : (
        <Stack spacing={2}>
          {bookmarks.length === 0
            ? <EmptyState>No bookmarks match this view yet.</EmptyState>
            : bookmarks.map((bookmark) => (
                <BookmarkCard
                  bookmark={bookmark}
                  key={bookmark.id}
                  onDelete={setBookmarkToDelete}
                  onEdit={openEditBookmark}
                  collectionName={collections.find((collection) => collection.id === bookmark.collectionId)?.name}
                />
              ))}
          <PaginationControls
            meta={{ ...meta, pageSize }}
            onPage={setPage}
            onPageSize={(nextPageSize) => {
              setPage(1);
              setPageSize(nextPageSize);
              setMeta((current) => ({ ...current, page: 1, pageSize: nextPageSize }));
            }}
          />
        </Stack>
      )}

      <BookmarkFormDialog
        bookmark={bookmarkDialog.bookmark}
        collections={collections}
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

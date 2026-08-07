import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ApiError, useApiRequest } from '../api/client';
import type { Bookmark, Collection, PageMeta } from '../api/types';
import { BookmarkCard } from '../components/BookmarkCard';
import { BookmarkFormDialog } from '../components/BookmarkFormDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { fetchAllCollections } from '../components/collectionOptions';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { PaginationControls } from '../components/PaginationControls';

const defaultMeta: PageMeta = { page: 1, pageSize: 20, total: 0, totalPages: 0 };
const defaultNestedPageSize = 5;

interface NestedEntry {
  bookmarks: Bookmark[];
  meta: PageMeta;
  loading: boolean;
  loaded: boolean;
  error: string;
}

const emptyNestedEntry = (pageSize = defaultNestedPageSize): NestedEntry => ({
  bookmarks: [],
  meta: { page: 1, pageSize, total: 0, totalPages: 0 },
  loading: false,
  loaded: false,
  error: '',
});

type BookmarkDialogState = {
  open: boolean;
  mode: 'create' | 'edit';
  bookmark: Bookmark | null;
  defaultCollectionId: string | null;
};

export function CollectionsPage() {
  const request = useApiRequest();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [bookmarkCollections, setBookmarkCollections] = useState<Collection[]>([]);
  const [bookmarkCollectionsLoaded, setBookmarkCollectionsLoaded] = useState(false);
  const [meta, setMeta] = useState<PageMeta>(defaultMeta);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultMeta.pageSize);
  const [filter, setFilter] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);
  const [nestedPageByCollection, setNestedPageByCollection] = useState<Record<string, number>>({});
  const [nestedPageSizeByCollection, setNestedPageSizeByCollection] = useState<Record<string, number>>({});
  const collectionRequestId = useRef(0);
  const nestedCache = useRef<Record<string, Record<string, NestedEntry>>>({});
  const [, redrawNested] = useState(0);
  const [bookmarkDialog, setBookmarkDialog] = useState<BookmarkDialogState>({
    open: false,
    mode: 'create',
    bookmark: null,
    defaultCollectionId: null,
  });
  const [bookmarkToDelete, setBookmarkToDelete] = useState<Bookmark | null>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCollections = useCallback(() => {
    const requestId = ++collectionRequestId.current;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (appliedFilter) params.set('name', appliedFilter);
    void request<Collection[]>(`/collections?${params.toString()}`)
      .then((response) => {
        if (requestId !== collectionRequestId.current) return;
        const nextMeta = response.meta ?? defaultMeta;
        setCollections(response.data);
        setMeta(nextMeta);
        if (nextMeta.totalPages === 0 && page !== 1) setPage(1);
        else if (nextMeta.totalPages > 0 && page > nextMeta.totalPages) setPage(nextMeta.totalPages);
      })
      .catch((cause: unknown) => {
        if (requestId === collectionRequestId.current) {
          setError(cause instanceof ApiError ? cause.message : 'Unable to load collections.');
        }
      })
      .finally(() => {
        if (requestId === collectionRequestId.current) setLoading(false);
      });
  }, [appliedFilter, page, pageSize, request]);

  useEffect(() => {
    loadCollections();
    return () => {
      collectionRequestId.current += 1;
    };
  }, [loadCollections, refreshToken]);

  const setNestedEntry = useCallback((collectionId: string, nestedPage: number, nestedPageSize: number, update: (entry: NestedEntry) => NestedEntry) => {
    const collectionCache = nestedCache.current[collectionId] ?? {};
    const cacheKey = `${nestedPageSize}:${nestedPage}`;
    const current = collectionCache[cacheKey] ?? emptyNestedEntry(nestedPageSize);
    collectionCache[cacheKey] = update(current);
    nestedCache.current[collectionId] = collectionCache;
    redrawNested((value) => value + 1);
  }, []);

  const loadNestedBookmarks = useCallback((collectionId: string, nestedPage: number, nestedPageSize: number, force = false) => {
    const cacheKey = `${nestedPageSize}:${nestedPage}`;
    const cached = nestedCache.current[collectionId]?.[cacheKey];
    if (!force && (cached?.loading || cached?.loaded)) return;
    setNestedEntry(collectionId, nestedPage, nestedPageSize, (entry) => ({ ...entry, loading: true, error: '' }));
    const params = new URLSearchParams({ page: String(nestedPage), pageSize: String(nestedPageSize) });
    void request<Bookmark[]>(`/collections/${collectionId}/bookmarks?${params.toString()}`)
      .then((response) => {
        const nextMeta = response.meta ?? emptyNestedEntry(nestedPageSize).meta;
        if (nextMeta.totalPages === 0 && nestedPage !== 1) {
          setNestedPageByCollection((current) => ({ ...current, [collectionId]: 1 }));
          loadNestedBookmarks(collectionId, 1, nestedPageSize, true);
          return;
        }
        if (nextMeta.totalPages > 0 && nestedPage > nextMeta.totalPages) {
          setNestedPageByCollection((current) => ({ ...current, [collectionId]: nextMeta.totalPages }));
          loadNestedBookmarks(collectionId, nextMeta.totalPages, nestedPageSize, true);
          return;
        }
        setNestedEntry(collectionId, nestedPage, nestedPageSize, (entry) => ({
          ...entry,
          bookmarks: response.data,
          meta: nextMeta,
          loading: false,
          loaded: true,
          error: '',
        }));
      })
      .catch((cause: unknown) => {
        setNestedEntry(collectionId, nestedPage, nestedPageSize, (entry) => ({
          ...entry,
          loading: false,
          loaded: false,
          error: cause instanceof ApiError ? cause.message : 'Unable to load bookmarks.',
        }));
      });
  }, [request, setNestedEntry]);

  const invalidateNested = useCallback((collectionIds: Array<string | null | undefined>, refreshExpanded = true) => {
    const uniqueCollectionIds = [...new Set(collectionIds.filter((value): value is string => Boolean(value)))];
    for (const collectionId of uniqueCollectionIds) {
      delete nestedCache.current[collectionId];
      if (refreshExpanded && expandedCollectionId === collectionId) {
        const expandedPageSize = nestedPageSizeByCollection[collectionId] ?? defaultNestedPageSize;
        setNestedPageByCollection((current) => ({ ...current, [collectionId]: 1 }));
        loadNestedBookmarks(collectionId, 1, expandedPageSize, true);
      }
    }
    redrawNested((value) => value + 1);
  }, [expandedCollectionId, loadNestedBookmarks, nestedPageSizeByCollection]);

  const submitFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilter(filter.trim());
  };

  const createCollection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError('Collection name is required.');
      return;
    }
    setError('');
    void request<Collection>('/collections', {
      method: 'POST',
      body: JSON.stringify({ name: normalizedName }),
    })
      .then((response) => {
        setName('');
        setNotice('Collection created.');
        if (bookmarkCollectionsLoaded) {
          setBookmarkCollections((current) => [
            response.data,
            ...current.filter((collection) => collection.id !== response.data.id),
          ]);
        }
        setPage(1);
        setRefreshToken((value) => value + 1);
      })
      .catch((cause: unknown) => setError(cause instanceof ApiError ? cause.message : 'Unable to create collection.'));
  };

  const requestCollectionDelete = (collection: Collection) => setCollectionToDelete(collection);

  const deleteCollection = () => {
    if (!collectionToDelete) return;
    setDeleting(true);
    void request<null>(`/collections/${collectionToDelete.id}`, { method: 'DELETE' })
      .then(() => {
        const deletedId = collectionToDelete.id;
        setNotice('Collection deleted. Its bookmarks were preserved as uncategorized.');
        setCollectionToDelete(null);
        if (expandedCollectionId === deletedId) setExpandedCollectionId(null);
        delete nestedCache.current[deletedId];
        if (bookmarkCollectionsLoaded) {
          setBookmarkCollections((current) => current.filter((collection) => collection.id !== deletedId));
        }
        setRefreshToken((value) => value + 1);
      })
      .catch((cause: unknown) => setError(cause instanceof ApiError ? cause.message : 'Unable to delete collection.'))
      .finally(() => setDeleting(false));
  };

  const ensureBookmarkCollections = () => {
    if (bookmarkCollectionsLoaded) return;
    void fetchAllCollections(request)
      .then((allCollections) => {
        setBookmarkCollections(allCollections);
        setBookmarkCollectionsLoaded(true);
      })
      .catch(() => setBookmarkCollections(collections));
  };

  const openCreateBookmark = (defaultCollectionId: string | null = null) => {
    ensureBookmarkCollections();
    setBookmarkDialog({ open: true, mode: 'create', bookmark: null, defaultCollectionId });
  };

  const openEditBookmark = (bookmark: Bookmark) => {
    ensureBookmarkCollections();
    setBookmarkDialog({ open: true, mode: 'edit', bookmark, defaultCollectionId: bookmark.collectionId });
  };

  const onBookmarkSaved = (saved: Bookmark) => {
    const originalCollectionId = bookmarkDialog.bookmark?.collectionId;
    invalidateNested([originalCollectionId, saved.collectionId], false);
    setNotice(bookmarkDialog.mode === 'edit' ? 'Bookmark updated.' : 'Bookmark created.');
    if (saved.collectionId) {
      const savedCollectionPageSize = nestedPageSizeByCollection[saved.collectionId] ?? defaultNestedPageSize;
      setExpandedCollectionId(saved.collectionId);
      setNestedPageByCollection((current) => ({ ...current, [saved.collectionId!]: 1 }));
      loadNestedBookmarks(saved.collectionId, 1, savedCollectionPageSize, true);
    }
  };

  const deleteBookmark = () => {
    if (!bookmarkToDelete) return;
    setDeleting(true);
    void request<null>(`/bookmarks/${bookmarkToDelete.id}`, { method: 'DELETE' })
      .then(() => {
        setNotice('Bookmark deleted.');
        invalidateNested([bookmarkToDelete.collectionId]);
        setBookmarkToDelete(null);
      })
      .catch((cause: unknown) => setError(cause instanceof ApiError ? cause.message : 'Unable to delete bookmark.'))
      .finally(() => setDeleting(false));
  };

  const renderNested = (collection: Collection) => {
    const nestedPage = nestedPageByCollection[collection.id] ?? 1;
    const nestedPageSize = nestedPageSizeByCollection[collection.id] ?? defaultNestedPageSize;
    const cacheKey = `${nestedPageSize}:${nestedPage}`;
    const entry = nestedCache.current[collection.id]?.[cacheKey] ?? emptyNestedEntry(nestedPageSize);
    if (entry.loading && !entry.loaded) return <LoadingState label="Loading bookmarks..." />;
    if (entry.error) {
      return (
        <Stack spacing={1}>
          <ErrorState message={entry.error} />
          <Button onClick={() => loadNestedBookmarks(collection.id, nestedPage, nestedPageSize, true)} size="small">Try again</Button>
        </Stack>
      );
    }
    return (
      <Stack spacing={2}>
        {entry.bookmarks.length === 0
          ? <EmptyState>No bookmarks in this collection yet.</EmptyState>
          : entry.bookmarks.map((bookmark) => (
              <BookmarkCard key={bookmark.id} bookmark={bookmark} onDelete={setBookmarkToDelete} onEdit={openEditBookmark} />
            ))}
        <PaginationControls
          meta={entry.meta}
          onPage={(nextPage) => {
            setNestedPageByCollection((current) => ({ ...current, [collection.id]: nextPage }));
            loadNestedBookmarks(collection.id, nextPage, nestedPageSize);
          }}
          onPageSize={(nextPageSize) => {
            setNestedPageSizeByCollection((current) => ({ ...current, [collection.id]: nextPageSize }));
            setNestedPageByCollection((current) => ({ ...current, [collection.id]: 1 }));
            loadNestedBookmarks(collection.id, 1, nextPageSize);
          }}
        />
      </Stack>
    );
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography component="h1" variant="h4">Collections</Typography>
          <Typography color="text.secondary">Keep your bookmarks organized in private groups.</Typography>
        </Box>
        <Button onClick={() => openCreateBookmark()} variant="contained">Add bookmark</Button>
      </Stack>

      <Card component="form" onSubmit={createCollection}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Create a collection</Typography>
            <Stack direction={{ sm: 'row' }} spacing={2}>
              <TextField fullWidth label="Name" onChange={(event) => setName(event.target.value)} required slotProps={{ htmlInput: { maxLength: 100 } }} value={name} />
              <Button type="submit" variant="contained">Create</Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Stack component="form" direction={{ sm: 'row' }} onSubmit={submitFilter} spacing={2}>
        <TextField fullWidth label="Filter by name" onChange={(event) => setFilter(event.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} value={filter} />
        <Button type="submit" variant="outlined">Filter</Button>
        <Button onClick={() => { setFilter(''); setAppliedFilter(''); setPage(1); }} variant="text">Clear</Button>
      </Stack>

      {error && <ErrorState message={error} />}
      <Divider />
      {loading ? <LoadingState label="Loading collections..." /> : (
        <Stack spacing={2}>
          {collections.length === 0 ? <EmptyState>No collections match this view yet.</EmptyState> : collections.map((collection) => {
            const expanded = expandedCollectionId === collection.id;
            return (
              <Accordion
                disableGutters
                expanded={expanded}
                key={collection.id}
                onChange={(_event, isExpanded) => {
                  setExpandedCollectionId(isExpanded ? collection.id : null);
                  if (isExpanded) {
                    const nestedPage = nestedPageByCollection[collection.id] ?? 1;
                    const nestedPageSize = nestedPageSizeByCollection[collection.id] ?? defaultNestedPageSize;
                    loadNestedBookmarks(collection.id, nestedPage, nestedPageSize);
                  }
                }}
                variant="outlined"
              >
                <AccordionSummary expandIcon={<span aria-hidden="true">+</span>}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }} variant="h6">{collection.name}</Typography>
                    <Typography color="text.secondary" variant="body2">Created {new Date(collection.createdAt).toLocaleDateString()}</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
                    <Button component={RouterLink} size="small" to={`/collections/${collection.id}`}>View</Button>
                    <Button onClick={() => openCreateBookmark(collection.id)} size="small">Add bookmark</Button>
                    <Button color="error" onClick={() => requestCollectionDelete(collection)} size="small">Delete</Button>
                  </Stack>
                  {expanded && renderNested(collection)}
                </AccordionDetails>
              </Accordion>
            );
          })}
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
        collections={bookmarkCollections.length > 0 ? bookmarkCollections : collections}
        defaultCollectionId={bookmarkDialog.defaultCollectionId}
        mode={bookmarkDialog.mode}
        onClose={() => setBookmarkDialog((current) => ({ ...current, open: false }))}
        onSaved={onBookmarkSaved}
        open={bookmarkDialog.open}
      />
      <ConfirmDialog
        description={collectionToDelete ? `Delete “${collectionToDelete.name}”? Its bookmarks will remain uncategorized.` : ''}
        loading={deleting}
        onCancel={() => setCollectionToDelete(null)}
        onConfirm={deleteCollection}
        open={Boolean(collectionToDelete)}
        title="Delete collection"
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

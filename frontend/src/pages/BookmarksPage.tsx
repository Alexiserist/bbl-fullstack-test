import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Card, CardActions, CardContent, Divider, FormControl, InputLabel, Link, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ApiError, useApiRequest } from '../api/client';
import type { Bookmark, Collection, PageMeta } from '../api/types';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { PaginationControls } from '../components/PaginationControls';

const emptyMeta: PageMeta = { page: 1, pageSize: 20, total: 0, totalPages: 0 };
type BookmarkFilter = 'all' | 'uncategorized' | string;

export function BookmarksPage() {
  const request = useApiRequest();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [filter, setFilter] = useState<BookmarkFilter>('all');
  const [meta, setMeta] = useState<PageMeta>(emptyMeta);
  const [page, setPage] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [newCollectionId, setNewCollectionId] = useState('');

  useEffect(() => {
    let active = true;
    void request<Collection[]>('/collections?page=1&pageSize=100')
      .then((response) => { if (active) setCollections(response.data); })
      .catch(() => { /* The bookmark list can still render if the filter options fail. */ });
    return () => { active = false; };
  }, [request]);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (filter === 'uncategorized') params.set('uncategorized', 'true');
    if (filter !== 'all' && filter !== 'uncategorized') params.set('collectionId', filter);
    void request<Bookmark[]>(`/bookmarks?${params.toString()}`)
      .then((response) => {
        setBookmarks(response.data);
        setMeta(response.meta ?? emptyMeta);
      })
      .catch((cause: unknown) => setError(cause instanceof ApiError ? cause.message : 'Unable to load bookmarks.'))
      .finally(() => setLoading(false));
  }, [filter, page, refreshToken, request]);

  const createBookmark = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    void request<Bookmark>('/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ url, title, notes: notes || null, collectionId: newCollectionId || null }),
    })
      .then(() => {
        setUrl(''); setTitle(''); setNotes(''); setNewCollectionId('');
        setNotice('Bookmark created.');
        setPage(1);
        setRefreshToken((current) => current + 1);
      })
      .catch((cause: unknown) => setError(cause instanceof ApiError ? cause.message : 'Unable to create bookmark.'));
  };

  const deleteBookmark = (bookmark: Bookmark) => {
    if (!window.confirm(`Delete “${bookmark.title}”?`)) return;
    void request<null>(`/bookmarks/${bookmark.id}`, { method: 'DELETE' })
      .then(() => {
        setNotice('Bookmark deleted.');
        setBookmarks((current) => current.filter((item) => item.id !== bookmark.id));
        setMeta((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
      })
      .catch((cause: unknown) => setError(cause instanceof ApiError ? cause.message : 'Unable to delete bookmark.'));
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography component="h1" variant="h4">Bookmarks</Typography>
        <Typography color="text.secondary">Save links and find them again whenever you need them.</Typography>
      </Stack>
      <Card component="form" onSubmit={createBookmark}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Save a bookmark</Typography>
            <TextField fullWidth label="URL" onChange={(event) => setUrl(event.target.value)} required type="url" value={url} />
            <TextField fullWidth label="Title" onChange={(event) => setTitle(event.target.value)} required value={title} />
            <TextField fullWidth label="Notes (optional)" multiline onChange={(event) => setNotes(event.target.value)} value={notes} />
            <FormControl fullWidth>
              <InputLabel id="new-bookmark-collection-label">Collection</InputLabel>
              <Select label="Collection" labelId="new-bookmark-collection-label" onChange={(event) => setNewCollectionId(event.target.value)} value={newCollectionId}>
                <MenuItem value="">Uncategorized</MenuItem>
                {collections.map((collection) => <MenuItem key={collection.id} value={collection.id}>{collection.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Button sx={{ alignSelf: 'flex-start' }} type="submit" variant="contained">Save bookmark</Button>
          </Stack>
        </CardContent>
      </Card>
      <Stack direction={{ sm: 'row' }} spacing={2}>
        <FormControl sx={{ minWidth: 240 }}>
          <InputLabel id="bookmark-filter-label">Show</InputLabel>
          <Select label="Show" labelId="bookmark-filter-label" onChange={(event) => { setFilter(event.target.value); setPage(1); }} value={filter}>
            <MenuItem value="all">All bookmarks</MenuItem>
            <MenuItem value="uncategorized">Uncategorized</MenuItem>
            {collections.map((collection) => <MenuItem key={collection.id} value={collection.id}>{collection.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {error && <ErrorState message={error} />}
      <Divider />
      {loading ? <LoadingState label="Loading bookmarks…" /> : bookmarks.length === 0 ? <EmptyState>No bookmarks match this view yet.</EmptyState> : (
        <Stack spacing={2}>
          {bookmarks.map((bookmark) => (
            <Card key={bookmark.id} variant="outlined">
              <CardContent>
                <Typography sx={{ fontWeight: 700 }} variant="h6"><RouterLink style={{ textDecoration: 'none' }} to={`/bookmarks/${bookmark.id}`}>{bookmark.title}</RouterLink></Typography>
                <Link href={bookmark.url} rel="noreferrer" sx={{ display: 'block' }} target="_blank">{bookmark.url}</Link>
                {bookmark.notes && <Typography color="text.secondary" sx={{ mt: 1 }}>{bookmark.notes}</Typography>}
              </CardContent>
              <CardActions>
                <Button component={RouterLink} size="small" to={`/bookmarks/${bookmark.id}`}>View details</Button>
                <Button color="error" onClick={() => deleteBookmark(bookmark)} size="small">Delete</Button>
              </CardActions>
            </Card>
          ))}
          <PaginationControls meta={meta} onPage={setPage} />
        </Stack>
      )}
    </Stack>
  );
}

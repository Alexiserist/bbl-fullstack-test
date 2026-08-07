import { useEffect, useState } from 'react';
import { Button, Card, CardContent, Divider, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { ApiError, useApiRequest } from '../api/client';
import type { Bookmark, Collection, PageMeta } from '../api/types';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { PaginationControls } from '../components/PaginationControls';

const emptyMeta: PageMeta = { page: 1, pageSize: 20, total: 0, totalPages: 0 };

export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const request = useApiRequest();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [meta, setMeta] = useState<PageMeta>(emptyMeta);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
  }, [id, page, request]);

  if (loading) return <LoadingState label="Loading collection…" />;
  if (error) return <Stack spacing={2}><ErrorState message={error} /><Button onClick={() => navigate('/collections')}>Back to collections</Button></Stack>;
  if (!collection) return <ErrorState message="Collection not found." />;

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Button component={RouterLink} sx={{ alignSelf: 'flex-start' }} to="/collections">← Collections</Button>
        <Typography component="h1" variant="h4">{collection.name}</Typography>
        <Typography color="text.secondary">Bookmarks in this collection</Typography>
      </Stack>
      <Divider />
      {bookmarks.length === 0 ? <EmptyState>This collection has no bookmarks.</EmptyState> : (
        <Stack spacing={2}>
          {bookmarks.map((bookmark) => (
            <Card key={bookmark.id} variant="outlined">
              <CardContent>
                <Typography sx={{ fontWeight: 700 }} variant="h6"><RouterLink style={{ textDecoration: 'none' }} to={`/bookmarks/${bookmark.id}`}>{bookmark.title}</RouterLink></Typography>
                <Link href={bookmark.url} rel="noreferrer" target="_blank">{bookmark.url}</Link>
              </CardContent>
            </Card>
          ))}
          <PaginationControls meta={meta} onPage={setPage} />
        </Stack>
      )}
    </Stack>
  );
}

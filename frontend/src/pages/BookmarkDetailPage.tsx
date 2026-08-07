import { useEffect, useState } from 'react';
import { Button, Card, CardContent, Chip, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { ApiError, useApiRequest } from '../api/client';
import type { Bookmark, Collection } from '../api/types';
import { ErrorState, LoadingState } from '../components/PageState';

export function BookmarkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const request = useApiRequest();
  const navigate = useNavigate();
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let active = true;
    void request<Bookmark>(`/bookmarks/${id}`)
      .then(async (response) => {
        if (!active) return;
        setBookmark(response.data);
        if (response.data.collectionId) {
          try {
            const collectionResponse = await request<Collection>(`/collections/${response.data.collectionId}`);
            if (active) setCollection(collectionResponse.data);
          } catch {
            // The bookmark remains useful even if the related label cannot be loaded.
          }
        }
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof ApiError ? cause.message : 'Unable to load bookmark.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, request]);

  const deleteBookmark = () => {
    if (!bookmark || !window.confirm(`Delete “${bookmark.title}”?`)) return;
    void request<null>(`/bookmarks/${bookmark.id}`, { method: 'DELETE' })
      .then(() => navigate('/bookmarks'))
      .catch((cause: unknown) => setError(cause instanceof ApiError ? cause.message : 'Unable to delete bookmark.'));
  };

  if (loading) return <LoadingState label="Loading bookmark…" />;
  if (error) return <Stack spacing={2}><ErrorState message={error} /><Button component={RouterLink} to="/bookmarks">Back to bookmarks</Button></Stack>;
  if (!bookmark) return <ErrorState message="Bookmark not found." />;

  return (
    <Stack spacing={3}>
      <Button component={RouterLink} sx={{ alignSelf: 'flex-start' }} to="/bookmarks">← Bookmarks</Button>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography component="h1" variant="h4">{bookmark.title}</Typography>
            <Link href={bookmark.url} rel="noreferrer" target="_blank">{bookmark.url}</Link>
            <Typography>{bookmark.notes || 'No notes.'}</Typography>
            {collection ? <Chip component={RouterLink} label={collection.name} sx={{ alignSelf: 'flex-start' }} to={`/collections/${collection.id}`} clickable /> : <Chip label="Uncategorized" sx={{ alignSelf: 'flex-start' }} />}
            <Typography color="text.secondary" variant="body2">Saved {new Date(bookmark.createdAt).toLocaleString()}</Typography>
            <Button color="error" onClick={deleteBookmark} sx={{ alignSelf: 'flex-start' }} variant="outlined">Delete bookmark</Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

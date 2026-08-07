import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Card, CardActions, CardContent, Divider, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ApiError, useApiRequest } from '../api/client';
import type { Collection, PageMeta } from '../api/types';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { PaginationControls } from '../components/PaginationControls';

const defaultMeta: PageMeta = { page: 1, pageSize: 20, total: 0, totalPages: 0 };

export function CollectionsPage() {
  const request = useApiRequest();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [meta, setMeta] = useState<PageMeta>(defaultMeta);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (appliedFilter) params.set('name', appliedFilter);
    void request<Collection[]>(`/collections?${params.toString()}`)
      .then((response) => {
        setCollections(response.data);
        setMeta(response.meta ?? defaultMeta);
      })
      .catch((cause: unknown) => setError(cause instanceof ApiError ? cause.message : 'Unable to load collections.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, appliedFilter, request]);

  const submitFilter = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilter(filter.trim());
  };

  const createCollection = (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    void request<Collection>('/collections', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
      .then(() => {
        setName('');
        setNotice('Collection created.');
        load();
      })
      .catch((cause: unknown) => setError(cause instanceof ApiError ? cause.message : 'Unable to create collection.'));
  };

  const deleteCollection = (collection: Collection) => {
    if (!window.confirm(`Delete “${collection.name}”? Its bookmarks will remain uncategorized.`)) return;
    void request<null>(`/collections/${collection.id}`, { method: 'DELETE' })
      .then(() => {
        setNotice('Collection deleted. Its bookmarks were preserved.');
        load();
      })
      .catch((cause: unknown) => setError(cause instanceof ApiError ? cause.message : 'Unable to delete collection.'));
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography component="h1" variant="h4">Collections</Typography>
        <Typography color="text.secondary">Keep your bookmarks organized in private groups.</Typography>
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
        <TextField fullWidth label="Filter by name" onChange={(event) => setFilter(event.target.value)} value={filter} />
        <Button type="submit" variant="outlined">Filter</Button>
        <Button onClick={() => { setFilter(''); setAppliedFilter(''); setPage(1); }} variant="text">Clear</Button>
      </Stack>
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {error && <ErrorState message={error} />}
      <Divider />
      {loading ? <LoadingState label="Loading collections…" /> : collections.length === 0 ? <EmptyState>No collections match this view yet.</EmptyState> : (
        <Stack spacing={2}>
          {collections.map((collection) => (
            <Card key={collection.id} variant="outlined">
              <CardContent>
                <Typography sx={{ fontWeight: 700 }} variant="h6"><RouterLink style={{ textDecoration: 'none' }} to={`/collections/${collection.id}`}>{collection.name}</RouterLink></Typography>
                <Typography color="text.secondary" variant="body2">Created {new Date(collection.createdAt).toLocaleDateString()}</Typography>
              </CardContent>
              <CardActions>
                <Button component={RouterLink} size="small" to={`/collections/${collection.id}`}>View</Button>
                <Button color="error" onClick={() => deleteCollection(collection)} size="small">Delete</Button>
              </CardActions>
            </Card>
          ))}
          <PaginationControls meta={meta} onPage={setPage} />
        </Stack>
      )}
    </Stack>
  );
}

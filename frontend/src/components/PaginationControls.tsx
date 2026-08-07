import { Button, Stack, Typography } from '@mui/material';
import type { PageMeta } from '../api/types';

export function PaginationControls({ meta, onPage }: { meta: PageMeta; onPage: (page: number) => void }) {
  if (meta.totalPages <= 1) return null;
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 3 }}>
      <Button disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
        Previous
      </Button>
      <Typography color="text.secondary" variant="body2">
        Page {meta.page} of {meta.totalPages}
      </Typography>
      <Button disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
        Next
      </Button>
    </Stack>
  );
}

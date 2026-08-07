import { Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { PageMeta } from '../api/types';

interface PaginationControlsProps {
  meta: PageMeta;
  onPage: (page: number) => void;
  onPageSize?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export function PaginationControls({
  meta,
  onPage,
  onPageSize,
  pageSizeOptions = [5, 10, 20, 50, 100],
}: PaginationControlsProps) {
  if (meta.totalPages <= 1 && !onPageSize) return null;
  const options = [...new Set([...pageSizeOptions, meta.pageSize])].sort((left, right) => left - right);

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', mt: 3 }}
    >
      {onPageSize && (
        <TextField
          label="Items per page"
          onChange={(event) => onPageSize(Number(event.target.value))}
          select
          size="small"
          sx={{ minWidth: 140 }}
          value={meta.pageSize}
        >
          {options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
        </TextField>
      )}
      <Typography color="text.secondary" variant="body2">
        {meta.totalPages === 0 ? '0 items' : `Page ${meta.page} of ${meta.totalPages}`}
      </Typography>
      {meta.totalPages > 1 && (
        <Stack direction="row" spacing={1} sx={{ justifyContent: { xs: 'space-between', sm: 'flex-end' } }}>
          <Button disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
          <Button disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next</Button>
        </Stack>
      )}
    </Stack>
  );
}

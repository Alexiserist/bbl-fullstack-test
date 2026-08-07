import { Button, Card, CardActions, CardContent, Chip, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { Bookmark } from '../api/types';

export interface BookmarkCardProps {
  bookmark: Bookmark;
  collectionName?: string;
  onEdit?: (bookmark: Bookmark) => void;
  onDelete?: (bookmark: Bookmark) => void;
  showDetails?: boolean;
}

export function BookmarkCard({ bookmark, collectionName, onEdit, onDelete, showDetails = true }: BookmarkCardProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1}>
          <Typography sx={{ fontWeight: 700 }} variant="h6">
            <RouterLink style={{ textDecoration: 'none' }} to={`/bookmarks/${bookmark.id}`}>{bookmark.title}</RouterLink>
          </Typography>
          <Link href={bookmark.url} rel="noreferrer" sx={{ overflowWrap: 'anywhere' }} target="_blank">{bookmark.url}</Link>
          {bookmark.notes && (
            <Typography
              color="text.secondary"
              sx={{ display: '-webkit-box', overflow: 'hidden', whiteSpace: 'pre-wrap', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3 }}
            >
              {bookmark.notes}
            </Typography>
          )}
          {collectionName && <Chip label={collectionName} size="small" sx={{ alignSelf: 'flex-start' }} />}
        </Stack>
      </CardContent>
      <CardActions>
        {showDetails && <Button component={RouterLink} size="small" to={`/bookmarks/${bookmark.id}`}>View details</Button>}
        {onEdit && <Button onClick={() => onEdit(bookmark)} size="small">Edit</Button>}
        {onDelete && <Button color="error" onClick={() => onDelete(bookmark)} size="small">Delete</Button>}
      </CardActions>
    </Card>
  );
}

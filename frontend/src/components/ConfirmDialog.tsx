import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, title, description, loading = false, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog aria-labelledby="confirm-dialog-title" maxWidth="xs" onClose={loading ? undefined : onCancel} open={open}>
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button disabled={loading} onClick={onCancel}>Cancel</Button>
        <Button color="error" disabled={loading} onClick={onConfirm} variant="contained">
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

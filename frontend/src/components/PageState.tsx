import { Alert, CircularProgress, Stack, Typography } from '@mui/material';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <Stack spacing={1} sx={{ alignItems: 'center', py: 8 }}>
      <CircularProgress size={28} />
      <Typography color="text.secondary">{label}</Typography>
    </Stack>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <Alert severity="error">{message}</Alert>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Typography color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>
      {children}
    </Typography>
  );
}

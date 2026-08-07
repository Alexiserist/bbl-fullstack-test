import { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { AppBar, Avatar, Box, Button, Chip, Container, Stack, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Outlet, useNavigate } from 'react-router-dom';
import type { Profile } from '../api/types';
import { useApiRequest } from '../api/client';
import { authConfig } from '../auth/config';

export function AppShell() {
  const { user, logout } = useAuth0();
  const request = useApiRequest();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    void request<Profile>('/me')
      .then((response) => {
        if (active) setProfile(response.data);
      })
      .catch(() => {
        // The Auth0 profile remains a safe display fallback if /me is unavailable.
      });
    return () => {
      active = false;
    };
  }, [request]);

  const displayName = profile?.name || profile?.email || user?.name || user?.email || 'Signed in';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const signOut = () => {
    void logout({ logoutParams: { returnTo: authConfig.logoutUrl } });
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 2 }}>
          <Typography color="inherit" sx={{ fontWeight: 700, mr: 1 }}>
            <RouterLink style={{ color: 'inherit', textDecoration: 'none' }} to="/collections">Private Bookmarks</RouterLink>
          </Typography>
          <Button color="inherit" component={RouterLink} to="/collections">
            Collections
          </Button>
          <Button color="inherit" component={RouterLink} to="/bookmarks">
            Bookmarks
          </Button>
          <Box sx={{ flex: 1 }} />
          <Chip avatar={<Avatar>{avatarLetter}</Avatar>} label={displayName} sx={{ color: 'inherit' }} variant="outlined" />
          <Button color="inherit" onClick={signOut}>Sign out</Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
      <Stack component="footer" sx={{ alignItems: 'center', pb: 3 }}>
        <Typography color="text.secondary" variant="caption">Your collections and bookmarks are private to your account.</Typography>
      </Stack>
    </Box>
  );
}

export function LoginPage() {
  const { loginWithRedirect } = useAuth0();
  return (
    <Box sx={{ alignItems: 'center', bgcolor: 'grey.50', display: 'flex', justifyContent: 'center', minHeight: '100vh', px: 2 }}>
      <Stack spacing={2} sx={{ alignItems: 'center', maxWidth: 480, textAlign: 'center' }}>
        <Typography component="h1" variant="h3">Private Bookmarks</Typography>
        <Typography color="text.secondary">Save links for later and organize them into private collections.</Typography>
        <Button variant="contained" onClick={() => void loginWithRedirect()}>Sign in</Button>
      </Stack>
    </Box>
  );
}

export function AuthLoadingPage() {
  return (
    <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'center', minHeight: '100vh' }}>
      <Typography color="text.secondary">Checking your session…</Typography>
    </Box>
  );
}

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Stack spacing={2} sx={{ alignItems: 'center', py: 8 }}>
      <Typography component="h1" variant="h4">Page not found</Typography>
      <Button onClick={() => navigate('/collections')} variant="contained">Back to collections</Button>
    </Stack>
  );
}

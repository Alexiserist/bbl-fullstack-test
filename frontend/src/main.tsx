import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import App from './App';
import { authConfig, authIsConfigured } from './auth/config';

const theme = createTheme({
  palette: {
    primary: { main: '#2557a7' },
    background: { default: '#f7f9fc' },
  },
  shape: { borderRadius: 12 },
});

function MissingAuthConfig() {
  return (
    <main style={{ fontFamily: 'system-ui', margin: '10rem auto', maxWidth: 640, padding: '0 1rem', textAlign: 'center' }}>
      <h1>Auth0 configuration is missing</h1>
      <p>Copy <code>frontend/.env.example</code> to <code>frontend/.env</code> and set the supplied client ID before signing in.</p>
    </main>
  );
}

function Auth0ProviderWithNavigation({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  return (
    <Auth0Provider
      authorizationParams={{
        audience: authConfig.audience,
        redirect_uri: authConfig.callbackUrl,
        scope: 'openid profile email',
      }}
      cacheLocation="memory"
      clientId={authConfig.clientId}
      domain={authConfig.domain}
      onRedirectCallback={(appState) => {
        navigate(appState?.returnTo ?? '/collections', { replace: true });
      }}
    >
      {children}
    </Auth0Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        {authIsConfigured ? (
          <Auth0ProviderWithNavigation>
            <App />
          </Auth0ProviderWithNavigation>
        ) : <MissingAuthConfig />}
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);

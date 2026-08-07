export const authConfig = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN ?? 'dev-yg.us.auth0.com',
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID ?? '',
  audience: import.meta.env.VITE_AUTH0_AUDIENCE ?? 'https://bbl-candidate-test-api',
  callbackUrl: import.meta.env.VITE_AUTH0_CALLBACK_URL ?? 'http://localhost:3000/callback',
  logoutUrl: import.meta.env.VITE_AUTH0_LOGOUT_URL ?? 'http://localhost:3000',
};

export const authIsConfigured = authConfig.clientId.trim().length > 0;

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  logout: vi.fn(),
  user: undefined as { name?: string; email?: string } | undefined,
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ user: mocks.user, logout: mocks.logout }),
}));

vi.mock('../api/client', () => ({
  useApiRequest: () => mocks.request,
}));

const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'person@example.test',
  name: 'Person Name',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/collections']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route element={<div>Page content</div>} path="/collections" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell current-user display', () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.logout.mockReset();
    mocks.user = undefined;
  });

  it('loads /me and displays the local profile name before other identity values', async () => {
    mocks.user = { name: 'Auth0 Name', email: 'auth0@example.test' };
    mocks.request.mockResolvedValue({ statusCode: 200, message: 'User retrieved', data: profile });

    renderShell();

    await waitFor(() => expect(screen.getByText('Person Name')).toBeInTheDocument());
    expect(mocks.request).toHaveBeenCalledWith('/me');
    expect(screen.queryByText('Auth0 Name')).not.toBeInTheDocument();
  });

  it('falls back from a null local name to the local email', async () => {
    mocks.request.mockResolvedValue({
      statusCode: 200,
      message: 'User retrieved',
      data: { ...profile, name: null },
    });

    renderShell();

    await waitFor(() => expect(screen.getByText('person@example.test')).toBeInTheDocument());
  });

  it('uses the generic signed-in label when no profile display value is available', async () => {
    mocks.request.mockResolvedValue({
      statusCode: 200,
      message: 'User retrieved',
      data: { ...profile, name: null, email: null },
    });

    renderShell();

    await waitFor(() => expect(screen.getByText('Signed in')).toBeInTheDocument());
  });

  it('signs out through Auth0 with the configured return URL', async () => {
    mocks.request.mockRejectedValue(new Error('profile unavailable'));

    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(mocks.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: 'http://localhost:3000' },
    });
  });
});

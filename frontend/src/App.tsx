import { useAuth0 } from '@auth0/auth0-react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell, AuthLoadingPage, LoginPage, NotFoundPage } from './components/AppShell';
import { CollectionDetailPage } from './pages/CollectionDetailPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { BookmarkDetailPage } from './pages/BookmarkDetailPage';
import { BookmarksPage } from './pages/BookmarksPage';

export default function App() {
  const { isLoading, isAuthenticated } = useAuth0();
  if (isLoading) return <AuthLoadingPage />;
  if (!isAuthenticated) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AuthLoadingPage />} path="/callback" />
      <Route element={<AppShell />}>
        <Route element={<Navigate replace to="/collections" />} index />
        <Route element={<CollectionsPage />} path="/collections" />
        <Route element={<CollectionDetailPage />} path="/collections/:id" />
        <Route element={<BookmarksPage />} path="/bookmarks" />
        <Route element={<BookmarkDetailPage />} path="/bookmarks/:id" />
        <Route element={<NotFoundPage />} path="*" />
      </Route>
    </Routes>
  );
}

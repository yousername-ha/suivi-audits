import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './generated/mantine-vars.css';
import './app.css';
import { Center, Loader, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router';
import { ApiError } from './api';
import { Layout } from './components/Layout';
import { AccountPage } from './pages/Account';
import { AdminPage } from './pages/Admin';
import { DocumentsPage } from './pages/Documents';
import { HomePage } from './pages/Home';
import { LoginPage } from './pages/Login';
import { ErrorPage, NotFoundPage } from './pages/NotFound';
import { SetupPage } from './pages/Setup';
import { RealtimeProvider } from './realtime';
import { SessionProvider, useMe } from './session';
import { themeOverride } from './theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
    },
  },
});

/** Accès réservé aux sessions complètes (double authentification faite), éventuellement aux administrateurs. */
function RequireAuth({ admin = false }: { admin?: boolean }) {
  const me = useMe();
  const loc = useLocation();
  if (me.stage !== 'ok')
    return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (admin && me.user?.role !== 'admin') return <Navigate to="/" replace />;
  return (
    <RealtimeProvider>
      <Layout>
        <Outlet />
      </Layout>
    </RealtimeProvider>
  );
}

const router = createBrowserRouter([
  { path: '/setup', element: <SetupPage />, errorElement: <ErrorPage /> },
  { path: '/login', element: <LoginPage />, errorElement: <ErrorPage /> },
  {
    element: <RequireAuth />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/documents', element: <DocumentsPage /> },
      { path: '/documents/:id', element: <DocumentsPage /> },
      { path: '/account', element: <AccountPage /> },
    ],
  },
  {
    element: <RequireAuth admin />,
    errorElement: <ErrorPage />,
    children: [{ path: '/admin/:tab?', element: <AdminPage /> }],
  },
  { path: '*', element: <NotFoundPage /> },
]);

const loading = (
  <Center h="100vh" aria-busy="true">
    <Loader aria-label="Chargement" />
  </Center>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Aucune balise <style> injectée (CSP stricte) : variables et classes dans src/generated/mantine-vars.css. */}
    <MantineProvider theme={themeOverride} defaultColorScheme="auto" withCssVariables={false} withGlobalClasses={false}>
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <SessionProvider fallback={loading}>
          <RouterProvider router={router} />
        </SessionProvider>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);

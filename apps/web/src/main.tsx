import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './generated/mantine-vars.css';
import '@suivi/ui/styles.css';
import './app.css';
import { Center, Loader, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router';
import { ApiError } from './api';
import { Layout } from './components/Layout';
import { AccountPage } from './pages/Account';
import { AdminPage } from './pages/Admin';
import { CartographiePage } from './pages/Cartographie';
import { ConfigurationGrcPage } from './pages/ConfigurationGrc';
import { DocumentsPage } from './pages/Documents';
const PilotagePage = lazy(() => import('./pages/Pilotage').then((m) => ({ default: m.PilotagePage })));
import { HomePage } from './pages/Home';
import { IaEvaluationsPage } from './pages/IaEvaluations';
import { ExportsPage } from './pages/Exports';
import { RegistresPage } from './registres/Registres';
import { HelpPage } from './pages/Help';
import { LoginPage } from './pages/Login';
import { MurActiverPage, MurPage } from './pages/Mur';
import { ErrorPage, NotFoundPage } from './pages/NotFound';
import { SettingsPage } from './pages/Settings';
import { SetupPage } from './pages/Setup';
import { RealtimeProvider } from './realtime';
import { canAdminArea, SessionProvider, useCan, useMe } from './session';
import { theme } from '@suivi/ui/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
    },
  },
});

/** Accès réservé aux sessions complètes (double authentification faite), éventuellement à l'administration.
    Confort d'affichage seulement : chaque appel reste contrôlé par le serveur. */
function RequireAuth({ admin = false }: { admin?: boolean }) {
  const me = useMe();
  const loc = useLocation();
  const can = useCan();
  if (me.stage !== 'ok')
    return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (admin && !canAdminArea(can)) return <Navigate to="/" replace />;
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
  // Écran mural : hors coquille (sans menu), accessible avec une session ou un appareil activé.
  { path: '/mur', element: <MurPage />, errorElement: <ErrorPage /> },
  { path: '/mur/activer', element: <MurActiverPage />, errorElement: <ErrorPage /> },
  {
    element: <RequireAuth />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/documents', element: <DocumentsPage /> },
      { path: '/documents/:id', element: <DocumentsPage /> },
      { path: '/cartographie/:vue?', element: <CartographiePage /> },
      { path: '/account', element: <AccountPage /> },
      {
        path: '/pilotage/:section?',
        element: (
          <Suspense
            fallback={
              <Center>
                <Loader aria-label="Chargement du pilotage" />
              </Center>
            }
          >
            <PilotagePage />
          </Suspense>
        ),
      },
      { path: '/grc', element: <Navigate to="/pilotage" replace /> },
      { path: '/ia/evaluations', element: <IaEvaluationsPage /> },
      { path: '/exports', element: <ExportsPage /> },
      { path: '/registres/:id?', element: <RegistresPage /> },
      { path: '/aide', element: <HelpPage /> },
      { path: '/parametres/configuration-grc/:kind?', element: <ConfigurationGrcPage /> },
      { path: '/parametres/:section?', element: <SettingsPage /> },
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
    <MantineProvider theme={theme} defaultColorScheme="auto" withCssVariables={false} withGlobalClasses={false}>
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <SessionProvider fallback={loading}>
          <RouterProvider router={router} />
        </SessionProvider>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);

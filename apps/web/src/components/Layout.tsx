/* Mise en page : barre supérieure, navigation, indicateur temps réel, préférences d'affichage.
   Téléphone : menu en tiroir ; tablette : menu replié en icônes ; bureau : menu déplié (packages/ui/src/styles.css).
   AppShell de Mantine n'est pas utilisé : il injecte des balises <style>, interdites par la CSP. */
import {
  Alert,
  Anchor,
  Badge,
  Burger,
  Button,
  Drawer,
  Group,
  NavLink,
  Stack,
  Text,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconeAccueil,
  IconeAdministration,
  IconeCarte,
  IconeCompte,
  IconeDocuments,
  IconeHistorique,
  IconeMur,
  IconeParametres,
  IconeTheme,
} from '@suivi/ui';
import type { SystemeOut } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { api, get, setCsrf } from '../api';
import { useLive } from '../realtime';
import { canAdminArea, canReadBusiness, ME_KEY, useCan, useMe, usePreferences } from '../session';

const SCHEME = { auto: 'auto', clair: 'light', sombre: 'dark' } as const;
const THEME_SUIVANT = { clair: 'sombre', sombre: 'auto', auto: 'clair' } as const;
const THEME_LIBELLE = { clair: 'clair', sombre: 'sombre', auto: 'automatique' } as const;

/** Applique taille d'affichage, densité et thème : préférences de la personne, sinon valeurs de l'organisation. */
function useAffichage() {
  const me = useMe();
  const { prefs } = usePreferences();
  // keepTransitions : sinon Mantine injecte une balise <style> (refusée par la CSP) à chaque changement de thème.
  const { colorScheme, setColorScheme } = useMantineColorScheme({ keepTransitions: true });
  const theme = prefs.theme === 'organisation' ? me.appearance.theme : prefs.theme;
  const densite = prefs.densite === 'organisation' ? me.appearance.densite : prefs.densite;
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.taille = prefs.taille;
    html.dataset.densite = densite;
    if (colorScheme !== SCHEME[theme]) setColorScheme(SCHEME[theme]);
  }, [prefs.taille, densite, theme, colorScheme, setColorScheme]);
  return theme;
}

/** Nouvelle version publiée (détectée par scripts/verifier-version.sh sur le serveur) : bandeau pour les administrateurs.
    Rien n'est installé automatiquement. */
function BandeauVersion() {
  const q = useQuery({
    queryKey: ['admin', 'systeme'],
    queryFn: () => get<SystemeOut>('/api/admin/systeme'),
    staleTime: 600_000,
  });
  const v = q.data?.versionDisponible;
  if (!v?.nouvelle) return null;
  return (
    <Alert color="violet" mb="md" className="bandeau-version">
      Nouvelle version disponible : <b>{v.derniere}</b> (en service : {q.data?.version}).{' '}
      <Anchor component={Link} to="/admin/system">
        Détails et procédure
      </Anchor>
    </Alert>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const me = useMe();
  const [opened, { toggle, close }] = useDisclosure();
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const live = useLive();
  const can = useCan();
  const { save } = usePreferences();
  const theme = useAffichage();
  const tablette = useMediaQuery('(min-width: 36em) and (max-width: 63.99em)');

  type Item = [string, string, () => ReactNode];
  const items: Item[] = [['/', 'Accueil', IconeAccueil]];
  if (can('documents', 'lire')) items.push(['/documents', 'Documents et liens', IconeDocuments]);
  if (can('cartographie', 'lire')) items.push(['/cartographie', 'Cartographie', IconeCarte]);
  items.push(['/account', 'Mon compte', IconeCompte]);
  if (can('parametres', 'lire')) items.push(['/parametres', 'Paramètres', IconeParametres]);
  if (canAdminArea(can)) items.push(['/admin', 'Administration', IconeAdministration]);
  if (canReadBusiness(can)) items.push(['/mur', 'Écran mural', IconeMur]);
  const active = (to: string) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to));
  const logout = async () => {
    await api('POST', '/api/auth/logout').catch(() => {});
    setCsrf(null);
    qc.clear();
    await qc.invalidateQueries({ queryKey: ME_KEY });
    nav('/login');
  };
  const withTip = (label: string, node: ReactNode) => (
    <Tooltip key={label} label={label} position="right" disabled={!tablette}>
      <div>{node}</div>
    </Tooltip>
  );

  const navigation = (
    <nav aria-label="Navigation principale" className="shell-nav-inner">
      <Stack gap="2xs">
        {items.map(([to, label, Icon]) =>
          withTip(
            label,
            <NavLink
              component={Link}
              to={to}
              label={<span className="nav-libelle">{label}</span>}
              leftSection={<Icon />}
              active={active(to)}
              onClick={close}
            />,
          ),
        )}
        {canReadBusiness(can) &&
          withTip(
            'Outil de suivi (ancienne interface)',
            <NavLink
              component="a"
              href="/legacy/"
              leftSection={<IconeHistorique />}
              label={<span className="nav-libelle">Outil de suivi (ancienne interface)</span>}
              description={<span className="nav-annexe">Modules pas encore repris</span>}
            />,
          )}
      </Stack>
      <Stack mt="xl" gap="2xs">
        {withTip(
          `Thème : ${THEME_LIBELLE[theme]}`,
          <Button
            variant="subtle"
            size="xs"
            fullWidth
            leftSection={<IconeTheme />}
            onClick={() => void save({ theme: THEME_SUIVANT[theme] })}
          >
            <span className="nav-libelle">Thème : {THEME_LIBELLE[theme]}</span>
          </Button>,
        )}
        <Text size="xs" c="dimmed" ta="center" className="app-version nav-annexe">
          Version {me.version}
        </Text>
      </Stack>
    </nav>
  );

  return (
    <div className="shell">
      <header className="shell-header">
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" aria-label="Ouvrir le menu" />
            <Anchor component={Link} to="/" underline="never" c="inherit">
              <Group gap="xs" wrap="nowrap">
                <span className="brand-mark" aria-hidden="true">
                  S
                </span>
                <Text fw={700} visibleFrom="xs">
                  {me.appName}
                </Text>
              </Group>
            </Anchor>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Tooltip
              label={
                live.connected ? 'Mises à jour en temps réel actives' : 'Temps réel déconnecté : reconnexion en cours'
              }
            >
              <Badge color={live.connected ? 'teal' : 'gray'} variant="dot" visibleFrom="xs" className="live-badge">
                {live.connected ? 'En direct' : 'Hors ligne'}
              </Badge>
            </Tooltip>
            <Text size="sm" fw={600} visibleFrom="sm">
              {me.user?.displayName || me.user?.username}
            </Text>
            <Badge variant="light" visibleFrom="md">
              {me.user?.roles.join(', ') || 'Aucun rôle'}
            </Badge>
            <Button size="xs" variant="default" onClick={logout}>
              Déconnexion
            </Button>
          </Group>
        </Group>
      </header>
      <div className="shell-body">
        <aside className="shell-nav">{navigation}</aside>
        <main className="shell-main app-main">
          {can('administration', 'lire') && <BandeauVersion />}
          {children}
        </main>
      </div>
      <Drawer opened={opened} onClose={close} title="Menu" size="xs" hiddenFrom="xs">
        {navigation}
      </Drawer>
    </div>
  );
}

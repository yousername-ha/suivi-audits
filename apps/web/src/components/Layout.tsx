/* Mise en page : barre supérieure, navigation, indicateur temps réel, préférences d'affichage.
   Téléphone : menu en tiroir ; tablette : menu replié en icônes ; bureau : menu déplié (packages/ui/src/styles.css).
   AppShell de Mantine n'est pas utilisé : il injecte des balises <style>, interdites par la CSP. */
import {
  Anchor,
  Badge,
  Box,
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
  IconeActions,
  IconeAdministration,
  IconeCompte,
  IconeConformite,
  IconeDocuments,
  IconeMur,
  IconeOrganisation,
  IconeParametres,
  IconePilotage,
  IconeResilience,
  IconeRisques,
  IconeTheme,
} from '@suivi/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { errorMessage } from '../api';
import { ALIAS_ADMINISTRATION, cartesVisibles } from '../administration-droits';
import { famillesVisibles, localiser, type FamilleId } from '../navigation';
import { logout as endSession } from '../logout';
import { alerteDeFamille, LibelleAlerte, useAlertesMenu } from '../pilotage/alertes-menu';
import { OngletsRubriques } from './OngletsRubriques';
import { AlerteSecuriteNotice } from './AlerteSecuriteNotice';
import { RetexInvitationNotice, useInvitationsRetex } from '../incidents/MesContributionsRetex';
import { CleSecoursNotice } from './CleSecours';
import { UpdateNotice } from './Updates';
import { ErrorAlert } from './common';
import { useLive } from '../realtime';
import { canReadBusiness, useCan, useMe, usePreferences } from '../session';

const ICONES_FAMILLE: Record<FamilleId, () => ReactNode> = {
  pilotage: IconePilotage,
  organisation: IconeOrganisation,
  risques: IconeRisques,
  conformite: IconeConformite,
  actions: IconeActions,
  resilience: IconeResilience,
  documents: IconeDocuments,
};
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
    html.dataset.style = me.appearance.style;
    if (colorScheme !== SCHEME[theme]) setColorScheme(SCHEME[theme]);
  }, [prefs.taille, densite, me.appearance.style, theme, colorScheme, setColorScheme]);
  return theme;
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
  const accueil: Item[] = [['/', 'Tableau de bord', IconeAccueil]];
  const administration: Item[] = [];
  if (cartesVisibles(can, 'plateforme').length > 0) administration.push(['/plateforme', 'Plateforme', IconeParametres]);
  if (cartesVisibles(can, 'systeme').length > 0)
    administration.push(['/systeme', 'Configuration système', IconeAdministration]);
  const invitationsRetex = useInvitationsRetex();
  const outils: Item[] = [['/account', 'Mon compte', IconeCompte]];
  outils.push(['/aide', 'Guide d’utilisation', IconeDocuments]);
  if (canReadBusiness(can)) outils.push(['/mur', 'Écran mural', IconeMur]);
  // Demandes de contribution à un RETEX : visibles pour toute personne invitée, même sans droit sur les incidents.
  if (invitationsRetex.data?.length) outils.push(['/retex', 'Mes contributions RETEX', IconeDocuments]);
  const active = (to: string) =>
    to === '/'
      ? loc.pathname === '/'
      : ALIAS_ADMINISTRATION[to]
        ? ALIAS_ADMINISTRATION[to].test(loc.pathname)
        : loc.pathname.startsWith(to);
  const alertes = useAlertesMenu();
  const familles = famillesVisibles(can);
  // Une seule famille dépliée à la fois : ouvrir une famille referme la précédente. La page affichée déplie la sienne.
  const familleDeLaPage = localiser(loc.pathname)?.famille.id;
  const [ouvert, setOuvert] = useState<string | null>(familleDeLaPage ?? null);
  useEffect(() => {
    if (familleDeLaPage) setOuvert(familleDeLaPage);
  }, [familleDeLaPage]);
  const basculer = (cle: string, ouvre: boolean) =>
    setOuvert((courant) => (ouvre ? cle : courant === cle ? null : courant));
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await endSession(qc);
      nav('/login', { replace: true });
    } catch (e) {
      setLogoutError(errorMessage(e));
    } finally {
      setLoggingOut(false);
    }
  };
  const withTip = (label: string, node: ReactNode) => (
    <Tooltip key={label} label={label} position="right" disabled={!tablette}>
      <div>{node}</div>
    </Tooltip>
  );

  const navigationItems = (entries: Item[]) =>
    entries.map(([to, label, Icon]) =>
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
    );
  const navigation = (
    <nav aria-label="Navigation principale" className="shell-nav-inner">
      <Text className="nav-caption nav-annexe">Espace de travail</Text>
      <Stack gap="2xs">
        {navigationItems(accueil)}
        {familles.map(({ famille, destinations }) => {
          const Icone = ICONES_FAMILLE[famille.id];
          const dansLaFamille = familleDeLaPage === famille.id;
          return (
            <NavLink
              key={famille.id}
              component={Link}
              to={destinations[0]!.to}
              className="nav-famille"
              data-famille={famille.id}
              label={<LibelleAlerte libelle={famille.label} alerte={alerteDeFamille(alertes, destinations)} />}
              leftSection={<Icone />}
              active={dansLaFamille}
              aria-expanded={!tablette && ouvert === famille.id}
              opened={!tablette && ouvert === famille.id}
              onChange={(o) => basculer(famille.id, o)}
              // Tablette : le menu est replié en icônes, un clic mène à la première destination de la famille.
              onClick={tablette ? () => close() : undefined}
            >
              {!tablette &&
                destinations.map((d) => (
                  <NavLink
                    key={d.id}
                    component={Link}
                    to={d.to}
                    className="nav-destination"
                    label={<LibelleAlerte libelle={d.label} alerte={alertes[d.id]} />}
                    active={localiser(loc.pathname)?.destination.id === d.id}
                    onClick={close}
                  />
                ))}
            </NavLink>
          );
        })}
      </Stack>
      <Stack gap="2xs" className="nav-administration">
        <Text className="nav-caption nav-annexe">Compte et administration</Text>
        {navigationItems(administration)}
        {navigationItems(outils)}
      </Stack>
      <Stack mt="xl" gap="2xs" className="nav-footer">
        <div className="nav-signature nav-annexe">
          <span className="nav-signature__mark" aria-hidden="true">
            <IconeAdministration />
          </span>
          <div>
            <Text size="sm" fw={600}>
              {me.orgName}
            </Text>
            <Text size="xs">Pilotage de l’organisation</Text>
          </div>
        </div>
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
      <div className="shell-top">
        <UpdateNotice />
        <CleSecoursNotice />
        <AlerteSecuriteNotice />
        <RetexInvitationNotice />
        <header className="shell-header">
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" aria-label="Ouvrir le menu" />
              <Anchor component={Link} to="/" underline="never" c="inherit" aria-label={`${me.appName} — accueil`}>
                <Group gap="xs" wrap="nowrap">
                  <span className="brand-mark" aria-hidden="true">
                    S
                  </span>
                  <div className="brand-wordmark">
                    <Text fw={700} visibleFrom="xs">
                      {me.appName}
                    </Text>
                    <Text className="brand-subtitle" size="xs" visibleFrom="sm">
                      Qualité, sécurité et référentiels
                    </Text>
                  </div>
                </Group>
              </Anchor>
              {me.orgName && (
                <Box className="org-signature" visibleFrom="lg">
                  <span className="org-signature__carre" aria-hidden="true" />
                  <span className="org-signature__nom">{me.orgName}</span>
                </Box>
              )}
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
              <Text size="sm" fw={600} visibleFrom="sm" className="header-user">
                {me.user?.displayName || me.user?.username}
              </Text>
              <Badge variant="light" visibleFrom="md">
                {me.user?.roles.join(', ') || 'Aucun rôle'}
              </Badge>
              <Button size="xs" variant="default" loading={loggingOut} onClick={() => void logout()}>
                Déconnexion
              </Button>
            </Group>
          </Group>
        </header>
      </div>
      <div className="shell-body">
        <aside className="shell-nav">{navigation}</aside>
        <main className="shell-main app-main">
          <ErrorAlert error={logoutError} />
          <OngletsRubriques />
          {children}
        </main>
      </div>
      <Drawer opened={opened} onClose={close} title="Menu" size="xs" hiddenFrom="xs">
        {navigation}
      </Drawer>
    </div>
  );
}

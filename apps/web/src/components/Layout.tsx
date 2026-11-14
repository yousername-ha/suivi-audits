/* Mise en page : barre supérieure, navigation, indicateur temps réel, préférences d'affichage.
   Téléphone : menu en tiroir ; tablette : menu replié en icônes ; bureau : menu déplié (packages/ui/src/styles.css).
   Menu bleu nuit opaque de la refonte Neon (packages/ui/src/neon-menu.css) : même charte dans les deux thèmes, teinte par
   identité d'entrée (data-identite), pictogrammes animés avec pause ; familles, destinations, compteurs et alertes restent
   ceux de la navigation réelle filtrée par les droits.
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
  useComputedColorScheme,
  useMantineColorScheme,
  VisuallyHidden,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconeAdministration, IconeMenu, IconeTheme, type IdentiteMenu } from '@suivi/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { errorMessage } from '../api';
import { AssistantGlobal } from '../assistant/AssistantGlobal';
import { ALIAS_ADMINISTRATION, cartesVisibles } from '../administration-droits';
import { famillesVisibles, localiser, type FamilleId } from '../navigation';
import { logout as endSession } from '../logout';
import { alerteDeFamille, LibelleAlerte, useAlertesMenu } from '../pilotage/alertes-menu';
import { OngletsRubriques } from './OngletsRubriques';
import { useTriMenu } from './tri-menu';
import { AlerteSecuriteNotice } from './AlerteSecuriteNotice';
import { RetexInvitationNotice, useInvitationsRetex } from '../incidents/MesContributionsRetex';
import { CleSecoursNotice } from './CleSecours';
import { UpdateNotice } from './Updates';
import { ErrorAlert } from './common';
import { useLive } from '../realtime';
import { canReadBusiness, useCan, useMe, usePreferences } from '../session';
import { MarqueOrganisation } from './MarqueOrganisation';
import { useMouvementMenu } from './mouvement-menu';

/** Identité d'une famille pour sa teinte et son pictogramme : la même quel que soit son rang dans le menu. */
const IDENTITE_FAMILLE: Record<FamilleId, IdentiteMenu> = {
  pilotage: 'pilotage',
  organisation: 'organisation',
  risques: 'risques',
  conformite: 'conformite',
  actions: 'actions',
  resilience: 'resilience',
  documents: 'documents',
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
  const [assistantPinned, setAssistantPinned] = useState(false);
  const [opened, { toggle, close }] = useDisclosure();
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const live = useLive();
  const can = useCan();
  const { save } = usePreferences();
  const theme = useAffichage();
  const schema = useComputedColorScheme('light');
  const tablette = useMediaQuery('(min-width: 36em) and (max-width: 63.99em)');
  const mouvement = useMouvementMenu();

  type Item = [string, string, IdentiteMenu | 'retex'];
  const accueil: Item[] = [['/', 'Tableau de bord', 'dashboard']];
  const administration: Item[] = [];
  if (cartesVisibles(can, 'plateforme').length > 0) administration.push(['/plateforme', 'Plateforme', 'plateforme']);
  if (cartesVisibles(can, 'systeme').length > 0)
    administration.push(['/systeme', 'Configuration système', 'parametres']);
  const invitationsRetex = useInvitationsRetex();
  const outils: Item[] = [['/account', 'Mon compte', 'compte']];
  outils.push(['/aide', 'Guide d’utilisation', 'aide']);
  if (canReadBusiness(can)) outils.push(['/mur', 'Écran mural', 'mur']);
  // Demandes de contribution à un RETEX : visibles pour toute personne invitée, même sans droit sur les incidents.
  if (invitationsRetex.data?.length) outils.push(['/retex', 'Mes contributions RETEX', 'retex']);
  // Assistant RSSI (ADR 0086) : présence flottante (AssistantGlobal), pas une entrée du menu.
  const active = (to: string) =>
    to === '/'
      ? loc.pathname === '/'
      : ALIAS_ADMINISTRATION[to]
        ? ALIAS_ADMINISTRATION[to].test(loc.pathname)
        : loc.pathname.startsWith(to);
  const alertes = useAlertesMenu();
  const tri = useTriMenu();
  const familles = famillesVisibles(can, tri.ordre);
  const idsFamilles = familles.map((f) => f.famille.id);
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
    entries.map(([to, label, identite]) =>
      withTip(
        label,
        <NavLink
          component={Link}
          to={to}
          label={<span className="nav-libelle">{label}</span>}
          leftSection={<IconeMenu identite={identite} />}
          active={active(to)}
          onClick={close}
          data-identite={identite}
        />,
      ),
    );
  const navigation = (
    <nav
      aria-label="Navigation principale"
      className="shell-nav-inner nav-neon"
      data-tri-actif={tri.glisse || undefined}
      data-mouvement={mouvement.arrete ? 'pause' : 'anime'}
      onClickCapture={tri.surClicCapture}
    >
      <Link to="/" className="nav-marque" onClick={close} aria-label={`${me.appName} — accueil`}>
        <MarqueOrganisation />
        <span>
          <strong>{me.appName}</strong>
          <small>Qualité, sécurité et référentiels</small>
        </span>
      </Link>
      <Text className="nav-caption nav-annexe">Espace de travail</Text>
      <Stack gap="2xs">
        {navigationItems(accueil)}
        {familles.map(({ famille, destinations }) => {
          const identite = IDENTITE_FAMILLE[famille.id];
          const dansLaFamille = familleDeLaPage === famille.id;
          return (
            <NavLink
              key={famille.id}
              component={Link}
              to={destinations[0]!.to}
              className="nav-famille"
              data-famille={famille.id}
              data-identite={identite}
              label={
                <span className="nav-famille__libelle">
                  <LibelleAlerte libelle={famille.label} alerte={alerteDeFamille(alertes, destinations)} />
                  {/* Nombre de destinations lisibles avec les droits de la personne (même source que le menu). */}
                  <small className="nav-compte nav-annexe" aria-hidden="true">
                    {destinations.length}
                  </small>
                </span>
              }
              leftSection={<IconeMenu identite={identite} />}
              active={dansLaFamille}
              aria-expanded={!tablette && ouvert === famille.id}
              opened={!tablette && ouvert === famille.id}
              onChange={(o) => basculer(famille.id, o)}
              // Tablette : le menu est replié en icônes, un clic mène à la première destination de la famille.
              onClick={tablette ? () => close() : undefined}
              {...tri.deplacable({ id: famille.id }, idsFamilles, famille.label)}
            >
              {!tablette &&
                destinations.map((d) => (
                  <NavLink
                    key={d.id}
                    component={Link}
                    to={d.to}
                    className="nav-destination"
                    data-identite={identite}
                    label={<LibelleAlerte libelle={d.label} alerte={alertes[d.id]} />}
                    active={localiser(loc.pathname)?.destination.id === d.id}
                    onClick={close}
                    {...tri.deplacable(
                      { famille: famille.id, id: d.id },
                      destinations.map((x) => x.id),
                      d.label,
                    )}
                  />
                ))}
            </NavLink>
          );
        })}
      </Stack>
      <VisuallyHidden aria-live="polite">{tri.annonce}</VisuallyHidden>
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
        <div className="nav-commandes">
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
          <Tooltip
            label={mouvement.pause ? 'Reprendre les animations du menu' : 'Mettre en pause les animations du menu'}
            position="right"
          >
            <button
              type="button"
              className="nav-pause"
              aria-label="Animations du menu en pause"
              aria-pressed={mouvement.pause}
              onClick={mouvement.basculer}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                {mouvement.pause ? <path d="M5 3.5v9l7-4.5Z" /> : <path d="M4.5 3h2.5v10H4.5ZM9 3h2.5v10H9Z" />}
              </svg>
            </button>
          </Tooltip>
        </div>
        <Text size="xs" c="dimmed" ta="center" className="app-version nav-annexe">
          Version {me.version}
        </Text>
      </Stack>
    </nav>
  );

  return (
    <div className="shell" data-assistant-pinned={assistantPinned || undefined}>
      <div className="shell-top">
        <UpdateNotice />
        <CleSecoursNotice />
        <AlerteSecuriteNotice />
        <RetexInvitationNotice />
        <header className="shell-header">
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" aria-label="Ouvrir le menu" />
              <Anchor
                component={Link}
                to="/"
                underline="never"
                c="inherit"
                className="entete-marque"
                aria-label={`${me.appName} — accueil`}
              >
                <Group gap="xs" wrap="nowrap">
                  <MarqueOrganisation />
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
              {/* Bascule rapide clair / sombre de la refonte Neon (même préférence que le réglage du pied de menu). */}
              <Button
                size="xs"
                variant="default"
                visibleFrom="md"
                leftSection={<IconeTheme />}
                onClick={() => void save({ theme: schema === 'dark' ? 'clair' : 'sombre' })}
              >
                {schema === 'dark' ? 'Mode clair' : 'Mode sombre'}
              </Button>
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
      {/* Hors de l’Outlet : l’instance et ses brouillons survivent aux changements de rubrique. */}
      <AssistantGlobal onPinned={setAssistantPinned} />
      <Drawer
        opened={opened}
        onClose={close}
        title="Menu"
        size="xs"
        hiddenFrom="xs"
        classNames={{ content: 'nav-tiroir' }}
      >
        {navigation}
      </Drawer>
    </div>
  );
}

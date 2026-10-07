/* Mise en page : barre supérieure, navigation (tiroir sur téléphone), indicateur temps réel.
   Mise en page en CSS statique (app.css) : AppShell de Mantine injecte des balises <style>, interdites par la CSP. */
import {
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
import { useDisclosure } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { api, setCsrf } from '../api';
import { useLive } from '../realtime';
import { canAdminArea, canReadBusiness, ME_KEY, useCan, useMe } from '../session';

export function Layout({ children }: { children: ReactNode }) {
  const me = useMe();
  const [opened, { toggle, close }] = useDisclosure();
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const live = useLive();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const can = useCan();
  const items: [string, string][] = [
    ['/', 'Accueil'],
    ...(can('documents', 'lire') ? ([['/documents', 'Documents et liens']] as [string, string][]) : []),
    ['/account', 'Mon compte'],
    ...(canAdminArea(can) ? ([['/admin', 'Administration']] as [string, string][]) : []),
  ];
  const legacy = canReadBusiness(can);
  const active = (to: string) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to));
  const logout = async () => {
    await api('POST', '/api/auth/logout').catch(() => {});
    setCsrf(null);
    qc.clear();
    await qc.invalidateQueries({ queryKey: ME_KEY });
    nav('/login');
  };

  const navigation = (
    <nav aria-label="Navigation principale" className="shell-nav-inner">
      <Stack gap={4}>
        {items.map(([to, label]) => (
          <NavLink key={to} component={Link} to={to} label={label} active={active(to)} onClick={close} />
        ))}
        {legacy && (
          <NavLink
            component="a"
            href="/legacy/"
            label="Outil de suivi (ancienne interface)"
            description="Modules pas encore repris"
          />
        )}
      </Stack>
      <Stack mt="xl" gap={4}>
        <Button
          variant="subtle"
          size="xs"
          onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : colorScheme === 'light' ? 'auto' : 'dark')}
        >
          Thème : {colorScheme === 'auto' ? 'automatique' : colorScheme === 'dark' ? 'sombre' : 'clair'}
        </Button>
        <Text size="xs" c="dimmed" ta="center">
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
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Ouvrir le menu" />
            <Anchor component={Link} to="/" underline="never" c="inherit">
              <Group gap={10} wrap="nowrap">
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
              <Badge color={live.connected ? 'teal' : 'gray'} variant="dot" visibleFrom="xs">
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
        <main className="shell-main app-main">{children}</main>
      </div>
      <Drawer opened={opened} onClose={close} title="Menu" size="xs" hiddenFrom="sm">
        {navigation}
      </Drawer>
    </div>
  );
}

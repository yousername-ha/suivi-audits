/* Accueil : accès aux modules, activité en cours, état de la migration de l'outil historique. */
import { Anchor, Badge, Button, Card, Group, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { get } from '../api';
import { useLive, usePresence } from '../realtime';
import { canAdminArea, canReadBusiness, useCan, useMe } from '../session';

interface LegacyModule {
  key: string;
  label: string;
  phase: number;
  takenOver: boolean;
}
const RESOURCE_LABELS: [RegExp, string][] = [
  [/^documents\/.+/, 'un document'],
  [/^documents$/, 'les documents'],
  [/^admin/, 'l’administration'],
  [/^account$/, 'son compte'],
  [/^home$/, 'l’accueil'],
];
const resourceLabel = (r: string) => RESOURCE_LABELS.find(([re]) => re.test(r))?.[1] ?? r;

export function HomePage() {
  const me = useMe();
  const can = useCan();
  usePresence('home');
  const { presence } = useLive();
  const modules = useQuery({
    queryKey: ['legacy', 'modules'],
    queryFn: () => get<LegacyModule[]>('/api/legacy/modules'),
    enabled: canReadBusiness(can),
  });
  const byPhase = new Map<number, LegacyModule[]>();
  for (const m of modules.data ?? []) if (m.phase > 0) byPhase.set(m.phase, [...(byPhase.get(m.phase) ?? []), m]);
  const online = [...new Map(presence.map((p) => [p.username, p])).values()];

  return (
    <Stack maw={1100} mx="auto">
      <Title order={1}>Bonjour {me.user?.displayName || me.user?.username}</Title>
      <div className="grid-3">
        {canReadBusiness(can) && (
          <Card withBorder>
            <Stack gap="xs">
              <Title order={2} size="h4">
                Outil de suivi
              </Title>
              <Text size="sm" c="dimmed">
                Mesures, écarts, plan d’audit, pilotage… dans l’interface historique, en attendant la reprise de chaque
                module.
              </Text>
              <Button component="a" href="/legacy/">
                Ouvrir l’outil de suivi
              </Button>
            </Stack>
          </Card>
        )}
        {can('documents', 'lire') && (
          <Card withBorder>
            <Stack gap="xs">
              <Title order={2} size="h4">
                Documents et liens
              </Title>
              <Text size="sm" c="dimmed">
                Preuves et documents chiffrés, versions, liens vers les partages réseau.
              </Text>
              <Button component={Link} to="/documents" variant="light">
                Voir les documents
              </Button>
            </Stack>
          </Card>
        )}
        {canAdminArea(can) && (
          <Card withBorder>
            <Stack gap="xs">
              <Title order={2} size="h4">
                Administration
              </Title>
              <Text size="sm" c="dimmed">
                Comptes, sessions, journal d’audit, versions, import des données de l’ancien outil.
              </Text>
              <Button component={Link} to="/admin" variant="light">
                Administrer
              </Button>
            </Stack>
          </Card>
        )}
      </div>

      <Card withBorder>
        <Title order={2} size="h4" mb="xs">
          En ce moment
        </Title>
        {online.length ? (
          <Stack gap={4}>
            {online.map((p) => (
              <Text size="sm" key={p.username}>
                <b>{p.name}</b> {p.mode === 'edit' ? 'modifie' : 'consulte'} {resourceLabel(p.resource)}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            Personne d’autre n’est connecté.
          </Text>
        )}
      </Card>

      <Card withBorder>
        <Title order={2} size="h4" mb="xs">
          Reprise des modules de l’outil historique
        </Title>
        <Text size="sm" c="dimmed" mb="sm">
          Chaque module est repris dans la nouvelle interface au fil des phases ; il reste alors consultable dans
          l’ancienne interface, en lecture seule. Détail :{' '}
          <Anchor href="https://github.com/yousername-ha/suivi-audits/blob/main/docs/ROADMAP.md">
            feuille de route
          </Anchor>
          .
        </Text>
        <div className="table-wrap">
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Phase</Table.Th>
                <Table.Th>Modules</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[...byPhase].map(([phase, list]) => (
                <Table.Tr key={phase}>
                  <Table.Td className="nowrap">Phase {phase}</Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      {list.map((m) => (
                        <Badge
                          key={m.key}
                          variant={m.takenOver ? 'filled' : 'light'}
                          color={m.takenOver ? 'teal' : 'gray'}
                        >
                          {m.label}
                          {m.takenOver ? ' — repris' : ''}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
    </Stack>
  );
}

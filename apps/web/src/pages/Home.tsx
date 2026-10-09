/* Accueil : tableau de bord (synthèse selon les droits), accès aux modules, activité en cours,
   état de la reprise de l'outil historique. Une seule grille de cartes : plus de colonnes sur les grands écrans. */
import { Anchor, Badge, Button, Card, Group, Stack, Table, Text, Title } from '@mantine/core';
import { ErrorAlert, IconeAdministration, IconeDocuments, IconeHistorique, Page, PageHeader } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { get } from '../api';
import { SyntheseCartes, type SyntheseApi } from '../components/Synthese';
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
  const synthese = useQuery({
    queryKey: ['synthese'],
    queryFn: () => get<SyntheseApi>('/api/mur/synthese'),
    enabled: canReadBusiness(can),
  });
  const byPhase = new Map<number, LegacyModule[]>();
  for (const m of modules.data ?? []) if (m.phase > 0) byPhase.set(m.phase, [...(byPhase.get(m.phase) ?? []), m]);
  const online = [...new Map(presence.map((p) => [p.username, p])).values()];

  const acces = (
    <>
      {canReadBusiness(can) && (
        <Card withBorder className="acces-carte">
          <Stack gap="sm">
            <span className="acces-icone" aria-hidden="true">
              <IconeHistorique />
            </span>
            <Title order={2} size="h4">
              Outil de suivi
            </Title>
            <Text size="sm" c="dimmed">
              Retrouvez vos mesures, vos écarts, votre plan d’audit et vos modules de pilotage.
            </Text>
            <Button component="a" href="/legacy/">
              Ouvrir l’outil de suivi
            </Button>
          </Stack>
        </Card>
      )}
      {can('documents', 'lire') && (
        <Card withBorder className="acces-carte">
          <Stack gap="sm">
            <span className="acces-icone" aria-hidden="true">
              <IconeDocuments />
            </span>
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
        <Card withBorder className="acces-carte">
          <Stack gap="sm">
            <span className="acces-icone" aria-hidden="true">
              <IconeAdministration />
            </span>
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
      <Card withBorder className="presence-liste">
        <Title order={2} size="h4" mb="xs">
          En ce moment
        </Title>
        {online.length ? (
          <Stack gap="2xs">
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

      <Card withBorder className="carte-large reprise-carte">
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
                    <Group gap="xs">
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
    </>
  );

  return (
    <Page>
      <Text className="page-eyebrow">Vue d’ensemble</Text>
      <PageHeader
        title={`Bonjour ${me.user?.displayName || me.user?.username}`}
        description={synthese.data ? `Tableau de bord — ${synthese.data.organisation}` : undefined}
      />
      {synthese.error && <ErrorAlert error={synthese.error} />}
      {synthese.data ? (
        <SyntheseCartes
          s={synthese.data}
          extra={
            <>
              <div className="section-label carte-large">
                <Text className="page-eyebrow">Votre espace de travail</Text>
                <Text size="sm" c="dimmed">
                  Accès aux modules et activité de l’équipe
                </Text>
              </div>
              {acces}
            </>
          }
        />
      ) : (
        <div className="grille-cartes">{acces}</div>
      )}
    </Page>
  );
}

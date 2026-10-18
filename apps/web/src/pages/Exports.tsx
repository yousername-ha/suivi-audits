/* Exports Excel de l'outil de suivi par rubrique : Excel classique (données brutes, filtres) et Excel pro (mise en forme,
   sommaire). Les données exportées sont filtrées selon les droits de lecture de la personne. */
import { Alert, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { Page, PageHeader } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { download, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';

interface Groupe {
  id: string;
  titre: string;
  description: string;
  feuilles: number;
}

export function ExportsPage() {
  const can = useCan();
  const autorise = can('import_export', 'exporter');
  const q = useQuery({
    queryKey: ['suivi', 'export', 'groupes'],
    queryFn: () => get<Groupe[]>('/api/suivi/export/groupes'),
    enabled: autorise,
  });
  if (!autorise)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit d’exporter les données.</Alert>
      </Page>
    );
  const lien = (groupe: string, mode: 'std' | 'pro') => () =>
    download(`/api/suivi/export?groupe=${groupe}&mode=${mode}`);
  return (
    <Page>
      <PageHeader
        title="Exports Excel"
        description="Excel classique : données brutes, filtres activés. Excel pro : mise en forme avec sommaire et pagination."
      />
      <Stack>
        <ErrorAlert error={q.error} />
        {(q.data ?? []).map((g) => (
          <Card key={g.id} withBorder>
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={2} size="h4">
                  {g.titre}
                </Title>
                <Text size="sm">{g.description}</Text>
                <Text size="xs" c="dimmed">
                  {g.feuilles} feuille{g.feuilles > 1 ? 's' : ''}
                </Text>
              </div>
              <Group gap="xs">
                <Button variant="default" onClick={lien(g.id, 'std')} aria-label={`Excel classique : ${g.titre}`}>
                  Excel
                </Button>
                <Button onClick={lien(g.id, 'pro')} aria-label={`Excel pro : ${g.titre}`}>
                  Excel pro
                </Button>
              </Group>
            </Group>
          </Card>
        ))}
        <Card withBorder>
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={2} size="h4">
                Export complet
              </Title>
              <Text size="sm">Toutes les rubriques ci-dessus, une feuille par jeu de données.</Text>
            </div>
            <Group gap="xs">
              <Button variant="default" onClick={lien('all', 'std')} aria-label="Excel classique : export complet">
                Excel
              </Button>
              <Button onClick={lien('all', 'pro')} aria-label="Excel pro : export complet">
                Excel pro
              </Button>
            </Group>
          </Group>
        </Card>
      </Stack>
    </Page>
  );
}

/* Exports Excel de l'outil de suivi par rubrique : Excel classique (données brutes, filtres) et Excel pro (mise en forme,
   sommaire). Les données exportées sont filtrées selon les droits de lecture de la personne. */
import { Alert, Button, Card, Group, Select, Stack, Text, Title } from '@mantine/core';
import { Page, PageHeader } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { download, get } from '../api';
import { ErrorAlert } from '../components/common';
import { usePerimetres } from '../components/selecteurs';
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
  const perimetres = usePerimetres(autorise);
  const [choisi, setPerimetre] = useState<string | null>(null);
  // Par défaut, le périmètre commun ; à défaut (compte rattaché à un autre périmètre), le premier périmètre accessible.
  const perimetre =
    choisi ??
    perimetres.data?.find((p) => p.id === '00000000-0000-4000-8000-000000000001')?.id ??
    perimetres.data?.[0]?.id ??
    null;
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
    download(`/api/suivi/export?groupe=${groupe}&mode=${mode}${perimetre ? `&perimetre=${perimetre}` : ''}`);
  return (
    <Page>
      <PageHeader
        title="Exports Excel"
        description="Excel classique : données brutes, filtres activés. Excel pro : mise en forme avec sommaire et pagination."
      />
      <Stack>
        <ErrorAlert error={q.error ?? perimetres.error} />
        {(perimetres.data?.length ?? 0) > 1 && (
          <Select
            label="Périmètre exporté"
            description="Fiches du Pilotage exportées : contexte, risques, continuité, revues. Par défaut, le périmètre commun."
            data={(perimetres.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            value={perimetre}
            onChange={setPerimetre}
            allowDeselect={false}
          />
        )}
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

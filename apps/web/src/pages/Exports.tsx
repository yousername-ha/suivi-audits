/* Exports Excel de l'outil de suivi par rubrique : Excel classique (données brutes, filtres) et Excel pro (mise en forme,
   sommaire). Les données exportées sont filtrées selon les droits de lecture de la personne.
   Style « Verre » (dessin DocExports validé par le RSSI le 28/11/2026, ExportsVerre.tsx) : périmètre dans l'en-tête,
   bandeau Classique / Pro et grille de cartes ; mêmes appels. Les autres styles gardent le rendu ci-dessous. */
import { Alert, Button, Card, Group, Select, Stack, Text, Title } from '@mantine/core';
import { APropos, Page, PageHeader } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { download, get } from '../api';
import { ErrorAlert } from '../components/common';
import { usePerimetres } from '../components/selecteurs';
import { useCan, useMe } from '../session';
import { BandeauModesExport, GrilleExportsVerre, type GroupeExport as Groupe } from './ExportsVerre';

const AIDE_PERIMETRE =
  'Fiches du Pilotage exportées : contexte, risques, continuité, revues. Par défaut, le périmètre commun.';

export function ExportsPage() {
  const can = useCan();
  const verre = useMe().appearance.style === 'verre';
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
  if (verre)
    return (
      <Page>
        <PageHeader
          title="Exports Excel"
          description="Un classeur par rubrique, ou tout le SMSI en un seul fichier."
          actions={
            (perimetres.data?.length ?? 0) > 1 && (
              <Select
                className="selecteur-perimetre"
                label="Périmètre exporté"
                title={AIDE_PERIMETRE}
                data={(perimetres.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                value={perimetre}
                onChange={setPerimetre}
                allowDeselect={false}
              />
            )
          }
        />
        {(perimetres.data?.length ?? 0) > 1 && (
          <APropos label="À propos du périmètre exporté">{AIDE_PERIMETRE}</APropos>
        )}
        <Stack>
          <ErrorAlert error={q.error ?? perimetres.error} />
          <BandeauModesExport />
          {q.data && <GrilleExportsVerre groupes={q.data} onExport={(g, mode) => lien(g, mode)()} />}
        </Stack>
      </Page>
    );
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
            description={AIDE_PERIMETRE}
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

/* Carte « Objectifs et indicateurs » de la Synthèse d'un périmètre (ISO/IEC 27001:2022, 6.2 et 9.1, BUG-055) : objectifs et
   indicateurs saisis comme fiches du Pilotage dans ce périmètre. Au périmètre commun, la carte des indicateurs de l'outil
   historique reste affichée à côté. */
import { Card, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { GrcObject } from '@suivi/shared';
import { get } from '../api';
import { useCan } from '../session';

interface Page {
  items: GrcObject[];
  total: number;
}

export function ObjectifsPerimetre({ smsi }: { smsi: string }) {
  const can = useCan();
  const autorise = can('pilotage', 'lire');
  const objectifs = useQuery({
    queryKey: ['grc', smsi, 'objects', 'objective', 'synthese'],
    queryFn: () => get<Page>(`/api/grc/${smsi}/objects?kind=objective`),
    enabled: autorise,
  });
  const indicateurs = useQuery({
    queryKey: ['grc', smsi, 'objects', 'indicator', 'synthese'],
    queryFn: () => get<Page>(`/api/grc/${smsi}/objects?kind=indicator`),
    enabled: autorise,
  });
  if (!autorise || !objectifs.data || !indicateurs.data) return null;
  if (!objectifs.data.total && !indicateurs.data.total) return null;
  const atteint = (o: GrcObject) => {
    const v = Number(o.data.value),
      cible = Number(o.data.target);
    return o.data.value !== '' && o.data.target !== '' && Number.isFinite(v) && Number.isFinite(cible)
      ? v >= cible
      : null;
  };
  const mesures = indicateurs.data.items.map(atteint);
  return (
    <Card withBorder aria-label="Objectifs et indicateurs du périmètre">
      <Stack gap="xs">
        <Text component="h2" fw={600} size="lg">
          Objectifs et indicateurs
        </Text>
        <Text>
          {objectifs.data.total} objectif{objectifs.data.total > 1 ? 's' : ''} et {indicateurs.data.total} indicateur
          {indicateurs.data.total > 1 ? 's' : ''} saisis pour ce périmètre.
        </Text>
        {indicateurs.data.total > 0 && (
          <Text size="sm" c="dimmed">
            {mesures.filter((m) => m === true).length} atteint(s) · {mesures.filter((m) => m === false).length} non
            atteint(s) · {mesures.filter((m) => m === null).length} sans valeur ou sans cible.
          </Text>
        )}
        {objectifs.data.items.slice(0, 5).map((o) => (
          <Text key={o.id} size="sm">
            {o.name}
            {typeof o.data.target === 'string' && o.data.target ? ` — ${o.data.target}` : ''}
          </Text>
        ))}
      </Stack>
    </Card>
  );
}

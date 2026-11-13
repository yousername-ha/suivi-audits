/* Carte « Objectifs et indicateurs » de la Synthèse d'un périmètre (ISO/IEC 27001:2022, 6.2 et 9.1, BUG-055) : un seul
   modèle, celui des objectifs et indicateurs de l'outil de suivi, rattachés à un périmètre. */
import { Card, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { indicateursSynthese, objectifsPilotage } from '@suivi/shared';
import { get } from '../api';
import { useCan } from '../session';
import { etatDePerimetre } from './perimetre-etat';

export function ObjectifsPerimetre({ smsi }: { smsi: string }) {
  const can = useCan();
  const autorise = can('pilotage', 'lire');
  const q = useQuery({
    queryKey: ['grc', smsi, 'legacy-objectifs', 'synthese'],
    queryFn: async () => etatDePerimetre(await get<Record<string, unknown>>('/api/suivi/etat'), smsi),
    enabled: autorise,
  });
  if (!autorise || !q.data) return null;
  const objectifs = objectifsPilotage(q.data);
  const synthese = indicateursSynthese(q.data);
  if (!objectifs.length && !synthese.total) return null;
  return (
    <Card withBorder aria-label="Objectifs et indicateurs du périmètre">
      <Stack gap="xs">
        <Text component="h2" fw={600} size="lg">
          Objectifs et indicateurs
        </Text>
        <Text>
          {objectifs.length} objectif{objectifs.length > 1 ? 's' : ''} et {synthese.total} indicateur
          {synthese.total > 1 ? 's' : ''} saisis pour ce périmètre.
        </Text>
        {synthese.total > 0 && (
          <Text size="sm" c="dimmed">
            {synthese.atteints} atteint(s) · {synthese.nonAtteints} non atteint(s) · {synthese.nonMesures} sans valeur
            ou sans cible.
          </Text>
        )}
        {objectifs.slice(0, 5).map((o) => (
          <Text key={o.id} size="sm">
            {o.nom}
          </Text>
        ))}
      </Stack>
    </Card>
  );
}

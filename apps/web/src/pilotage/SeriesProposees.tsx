/* Séries récurrentes proposées (ISO 9001:2015) : modèles tirés du texte de la norme, sans fréquence. Rien n'est planifié
   d'office : la série est préparée inactive, l'organisme choisit la fréquence, puis l'active. En style « Verre » (dessin
   TachesTimeline du 27/11/2026), le bloc est replié derrière le lien « Séries proposées par la norme » du pied de la
   Timeline (paramètre d'adresse « tnorme ») ; les autres styles le montrent toujours. */
import { Button, Card, Group, Stack, Text } from '@mantine/core';
import { jourParis, SERIES_PROPOSEES, type SerieProposee } from '@suivi/shared';
import { useEffect, useRef } from 'react';
import { useFiltreUrl } from '../components/filtre-url';
import { ID_SERIES_PROPOSEES } from '../grc/TimelineOccurrences';
import { useCan, useMe } from '../session';

export function SeriesProposees({ onPreparer }: { onPreparer: (name: string, data: Record<string, unknown>) => void }) {
  const can = useCan();
  const verre = useMe().appearance.style === 'verre';
  const [norme, setNorme] = useFiltreUrl('tnorme', '0');
  const bloc = useRef<HTMLDivElement>(null);
  const ouvert = !verre || norme === '1';
  // Ouvert depuis son lien : le bloc vient sous les yeux.
  useEffect(() => {
    if (verre && ouvert) bloc.current?.scrollIntoView?.({ block: 'start' });
  }, [verre, ouvert]);
  const preparer = (s: SerieProposee) =>
    onPreparer(s.titre, {
      description: `${s.description} (ISO 9001:2015, article ${s.article})`,
      recurrence: {
        start: jourParis(),
        time: '09:00',
        timezone: 'Europe/Paris',
        unit: 'month',
        interval: 1,
        until: null,
        count: null,
        reminderDays: 7,
        // Inactive : aucune fréquence n'est imposée, la série ne génère rien tant que l'organisme ne l'a pas choisie.
        active: false,
      },
    });
  if (!ouvert) return null;
  return (
    <Card withBorder aria-label="Séries proposées" id={ID_SERIES_PROPOSEES} ref={bloc}>
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600}>Séries proposées (ISO 9001:2015)</Text>
          {verre && (
            <Button size="xs" variant="default" onClick={() => setNorme('0')}>
              Replier
            </Button>
          )}
        </Group>
        <Text size="sm">
          Ces séries sont tirées du texte de la norme, qui fixe des « intervalles planifiés ou spécifiés » sans en
          donner la valeur. Aucune n’est créée d’office et aucune fréquence n’est imposée : la série est préparée
          inactive, vous choisissez la fréquence puis vous l’activez.
        </Text>
        {SERIES_PROPOSEES.map((s) => (
          <Group key={s.id} justify="space-between" wrap="nowrap">
            <div>
              <Text fw={500}>{s.titre}</Text>
              <Text size="sm" c="dimmed">
                Article {s.article} — {s.description}
              </Text>
            </div>
            {can('ecarts', 'modifier') && (
              <Button
                size="xs"
                variant="default"
                aria-label={`Préparer la série ${s.titre}`}
                onClick={() => preparer(s)}
              >
                Préparer la série
              </Button>
            )}
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

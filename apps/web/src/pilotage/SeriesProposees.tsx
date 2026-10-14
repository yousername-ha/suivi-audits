/* Séries récurrentes proposées (ISO 9001:2015) : modèles tirés du texte de la norme, sans fréquence. Rien n'est planifié
   d'office : la série est préparée inactive, l'organisme choisit la fréquence, puis l'active. */
import { Button, Card, Group, Stack, Text } from '@mantine/core';
import { SERIES_PROPOSEES, type SerieProposee } from '@suivi/shared';
import { useCan } from '../session';

export function SeriesProposees({ onPreparer }: { onPreparer: (name: string, data: Record<string, unknown>) => void }) {
  const can = useCan();
  const preparer = (s: SerieProposee) =>
    onPreparer(s.titre, {
      description: `${s.description} (ISO 9001:2015, article ${s.article})`,
      recurrence: {
        start: new Date().toISOString().slice(0, 10),
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
  return (
    <Card withBorder aria-label="Séries proposées">
      <Stack gap="xs">
        <Text fw={600}>Séries proposées (ISO 9001:2015)</Text>
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

/* Préparation d'une revue de direction (ISO 9001:2015, 9.3.2) : faits chiffrés tirés des données de la plateforme, repris
   dans une nouvelle fiche de revue. Rien n'est interprété : la direction apprécie, conclut et décide (9.3.3). */
import { Accordion, Alert, Button, Group, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { cleEntree, type EntreeRevue } from '@suivi/shared';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';

const SOCLE = '00000000-0000-4000-8000-000000000001';

export function PreparationRevue({
  smsi,
  onCreer,
}: {
  smsi: string;
  onCreer: (initial: Record<string, unknown>) => void;
}) {
  const can = useCan();
  const q = useQuery({
    queryKey: ['grc', smsi, 'revue-entrees'],
    queryFn: () =>
      get<{ precedente: { id: string; date: string } | null; entrees: EntreeRevue[] }>(
        `/api/grc/${smsi}/pilotage/revue/entrees`,
      ),
    enabled: smsi === SOCLE,
    retry: false,
  });
  if (smsi !== SOCLE) return null;
  const entrees = q.data?.entrees ?? [];
  const creer = () =>
    onCreer(
      Object.fromEntries(entrees.filter((e) => e.faits.length).map((e) => [cleEntree(e.id), e.faits.join('\n')])),
    );
  return (
    <Stack>
      <Alert>
        Les entrées de la revue (ISO 9001:2015, 9.3.2) sont préparées à partir des données de la plateforme : faits
        chiffrés, sans interprétation. Une donnée absente est signalée telle quelle, et l’adéquation des ressources
        reste à apprécier par la direction. Les sorties (9.3.3) se saisissent dans la fiche de revue.
      </Alert>
      <ErrorAlert error={q.error} />
      <Accordion variant="separated" multiple aria-label="Entrées de la revue de direction">
        {entrees.map((e) => (
          <Accordion.Item key={e.id} value={e.id}>
            <Accordion.Control>
              {e.titre} ({e.article})
            </Accordion.Control>
            <Accordion.Panel>
              {e.faits.map((f) => (
                <Text key={f} size="sm">
                  {f}
                </Text>
              ))}
              {e.aSaisir && <Text size="sm">À renseigner par la direction.</Text>}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
      {can('pilotage', 'modifier') && entrees.length > 0 && (
        <Group>
          <Button onClick={creer}>Préparer une revue avec ces entrées</Button>
        </Group>
      )}
    </Stack>
  );
}

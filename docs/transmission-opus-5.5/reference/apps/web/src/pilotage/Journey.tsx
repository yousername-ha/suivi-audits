import { Accordion, Anchor, Button, Card, Group, Select, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { JOURNEY_STEPS, GrcObject } from '@suivi/shared';
import { Link } from 'react-router';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
export function Journey({
  smsi,
  onCreate,
  onOpen,
  onValidate,
}: {
  smsi: string;
  onCreate: () => void;
  onOpen: (o: GrcObject) => void;
  onValidate: (o: GrcObject, step: string) => void;
}) {
  const can = useCan(),
    [id, setId] = useState<string | null>(null);
  const journeys = useQuery({
    queryKey: ['grc', smsi, 'journeys'],
    queryFn: () => get<{ items: GrcObject[] }>(`/api/grc/${smsi}/objects?kind=journey`),
  });
  const selected = id ?? journeys.data?.items[0]?.id;
  const data = useQuery({
    queryKey: ['grc', smsi, 'journey', selected],
    queryFn: () =>
      get<{
        object: GrcObject;
        steps: ((typeof JOURNEY_STEPS)[number] & {
          state: string;
          decision?: { createdBy: string; createdAt: string; note: string };
        })[];
        history: {
          id: string;
          step: string;
          sourceVersion: number;
          note: string;
          createdBy: string;
          createdAt: string;
        }[];
        note: string;
      }>(`/api/grc/${smsi}/pilotage/journeys/${selected}`),
    enabled: !!selected,
  });
  const completed = data.data?.steps.filter((s) => s.state === 'completed').length ?? 0;
  return (
    <Stack>
      <Text>
        Avancez étape par étape en réutilisant vos référentiels, documents, risques et actions. Vous pouvez quitter et
        reprendre à tout moment.
      </Text>
      <Group>
        {can('pilotage', 'modifier') && <Button onClick={onCreate}>Démarrer mon parcours</Button>}
        {data.data && (
          <Button variant="default" onClick={() => onOpen(data.data!.object)}>
            Organisation et objectifs
          </Button>
        )}
      </Group>
      {(journeys.data?.items.length ?? 0) > 1 && (
        <Select
          label="Parcours à reprendre"
          data={journeys.data!.items.map((o) => ({ value: o.id, label: o.name }))}
          value={selected ?? null}
          onChange={setId}
        />
      )}
      <ErrorAlert error={journeys.error ?? data.error} />
      {data.data && (
        <>
          <Text fw={600}>{data.data.object.name}</Text>
          <Text>
            {completed} étapes de travaux validées sur {data.data.steps.length} · {data.data.note}
          </Text>
          <progress
            aria-label="Avancement des travaux"
            value={completed}
            max={data.data.steps.length}
            className="pilotage-progress"
          />
          {data.data.steps.map((step, index) => (
            <Card key={step.id} withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={600}>
                    {index + 1}. {step.label}
                  </Text>
                  <Text>{step.state === 'completed' ? 'Travaux validés' : 'À réaliser'}</Text>
                </Group>
                <Text>{step.why}</Text>
                <Text>{step.todo}</Text>
                <Text size="sm">
                  À mobiliser : {step.actors}. À préparer : {step.document}.
                </Text>
                {step.decision && (
                  <Text size="sm">
                    Validé par {step.decision.createdBy} le{' '}
                    {new Date(step.decision.createdAt).toLocaleDateString('fr-FR')} · {step.decision.note}
                  </Text>
                )}
                <Group>
                  <Anchor component={Link} to={'/pilotage/' + step.href}>
                    Ouvrir les travaux
                  </Anchor>
                  {can('pilotage', 'administrer') && step.state !== 'completed' && (
                    <Button
                      variant="light"
                      disabled={index > completed}
                      onClick={() => onValidate(data.data!.object, step.id)}
                    >
                      Valider cette étape
                    </Button>
                  )}
                </Group>
                {index > completed && step.state !== 'completed' && (
                  <Text size="sm">Terminez et validez les étapes précédentes pour poursuivre.</Text>
                )}
              </Stack>
            </Card>
          ))}
          <Text size="sm">
            Une modification de l’organisation, du périmètre ou des objectifs demande une nouvelle revue des travaux.
            Les validations précédentes sont conservées.
          </Text>
          {data.data.history.length > 0 && (
            <Accordion>
              <Accordion.Item value="history">
                <Accordion.Control>Historique des validations</Accordion.Control>
                <Accordion.Panel>
                  <Stack>
                    {data.data.history.map((h) => (
                      <Text key={h.id}>
                        {data.data!.steps.find((s) => s.id === h.step)?.label ?? h.step} · Parcours version{' '}
                        {h.sourceVersion} · {new Date(h.createdAt).toLocaleDateString('fr-FR')} · {h.createdBy} ·{' '}
                        {h.note}
                      </Text>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          )}
          <Anchor href="https://www.iso.org/fr/standard/27001" target="_blank" rel="noreferrer">
            Ressource officielle ISO 27001
          </Anchor>
          <Anchor href="https://www.iso.org/standard/62085.html" target="_blank" rel="noreferrer">
            Ressource officielle ISO 9001
          </Anchor>
          <Anchor
            href="https://esante.gouv.fr/services/hebergeurs-de-donnees-de-sante"
            target="_blank"
            rel="noreferrer"
          >
            Ressource officielle HDS
          </Anchor>
        </>
      )}
      {journeys.data && !selected && (
        <Card withBorder>
          <Text>
            Démarrez un parcours pour votre démarche qualité, sécurité ou intégrée. Aucun nouveau système de données
            n’est créé : le parcours s’appuie sur ce qui existe déjà.
          </Text>
        </Card>
      )}
    </Stack>
  );
}

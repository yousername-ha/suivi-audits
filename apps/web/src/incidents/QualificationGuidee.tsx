/* Onglet « Qualification guidée » de la fiche d'un incident (ADR 0091) : les six questions oui / non / je ne sais pas,
   modifiables à tout moment (enregistrées dans les réponses de l'incident), la qualification proposée et les obligations à
   vérifier qui en découlent. La qualification de la fiche ne change que si l'utilisateur retient la proposition. */
import { Button, Card, Group, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import {
  QUESTIONS_INCIDENT,
  obligationsIncident,
  qualifierIncident,
  type Incident,
  type Reponses,
} from '@suivi/shared';
import { StatusChip } from '@suivi/ui';
import type { Agir } from './donnees';
import { ETAT_QUALIFICATION } from './qualification';

const CHOIX = [
  ['oui', 'Oui'],
  ['non', 'Non'],
  ['nsp', 'Je ne sais pas'],
] as const;

export function QualificationGuidee({
  i,
  categorieEntite,
  modifiable,
  agir,
}: {
  i: Incident;
  categorieEntite: string;
  modifiable: boolean;
  agir: Agir;
}) {
  const [envoi, setEnvoi] = useState(false);
  const url = `/api/incidents/${encodeURIComponent(i.id)}`;
  const res = qualifierIncident(i.answers);
  const renseignees = QUESTIONS_INCIDENT.filter(([k]) => i.answers[k]).length;
  const ob = obligationsIncident(i.answers, res.kind, categorieEntite);
  const enregistrer = async (corps: Record<string, unknown>) => {
    setEnvoi(true);
    try {
      await agir('PATCH', url, corps);
    } finally {
      setEnvoi(false);
    }
  };
  const repondre = (k: (typeof QUESTIONS_INCIDENT)[number][0], v: 'oui' | 'non' | 'nsp') => {
    const suivant: Reponses = { ...i.answers };
    if (suivant[k] === v) delete suivant[k];
    else suivant[k] = v;
    return enregistrer({ answers: suivant });
  };
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Répondez aux questions : l’outil indique s’il s’agit d’un incident de sécurité, d’un incident, d’un événement ou
        d’une demande. Les réponses sont enregistrées dans la fiche et restent modifiables ; la qualification de la
        fiche ne change que si vous retenez la proposition.
      </Text>
      <Group align="flex-start" grow>
        <Stack>
          {QUESTIONS_INCIDENT.map(([k, q]) => (
            <Card key={k} withBorder padding="sm">
              <Text size="sm" id={`question-${k}`}>
                {q}
              </Text>
              <div role="group" aria-labelledby={`question-${k}`}>
                <Group gap="xs" mt="xs">
                  {CHOIX.map(([v, l]) => (
                    <Button
                      key={v}
                      size="compact-sm"
                      variant={i.answers[k] === v ? 'filled' : 'default'}
                      aria-pressed={i.answers[k] === v}
                      disabled={!modifiable || envoi}
                      onClick={() => void repondre(k, v)}
                    >
                      {l}
                    </Button>
                  ))}
                </Group>
              </div>
            </Card>
          ))}
          <Text size="sm" c="dimmed">
            « Je ne sais pas » est traité comme « non » pour la qualification ; à réévaluer dès que l’information est
            connue.
          </Text>
        </Stack>
        <Stack>
          <Text fw={600}>Qualification proposée</Text>
          <Card withBorder>
            <StatusChip etat={ETAT_QUALIFICATION[res.kind] ?? 'neutre'}>{res.kind}</StatusChip>
            <Text size="sm" mt="xs">
              {res.why}
            </Text>
          </Card>
          <Text size="sm" c="dimmed">
            {renseignees}/{QUESTIONS_INCIDENT.length} questions renseignées. Qualification de la fiche : {i.kind}.
          </Text>
          {modifiable && renseignees > 0 && res.kind !== i.kind && (
            <div>
              <Button
                loading={envoi}
                onClick={() =>
                  void enregistrer({ kind: res.kind, ...(i.status === 'Nouveau' ? { status: 'Qualifié' } : {}) })
                }
              >
                Retenir « {res.kind} »
              </Button>
            </div>
          )}
          {ob.length > 0 && (
            <>
              <Text fw={600}>À vérifier</Text>
              <ul>
                {ob.map(([t, detail]) => (
                  <li key={t}>
                    <b>{t}</b> : {detail}
                  </li>
                ))}
              </ul>
              <Text size="sm" c="dimmed">
                Ces obligations se cochent dans l’onglet « Fiche » une fois la qualification retenue.
              </Text>
            </>
          )}
        </Stack>
      </Group>
    </Stack>
  );
}

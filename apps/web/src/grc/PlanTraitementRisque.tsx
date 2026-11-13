/* Plan d'action d'un risque (ADR 0090) : les traitements, mesures en place et actions rattachés au risque, dans le
   Registre des risques. Rien n'est recalculé : le risque résiduel reste celui de la dernière appréciation validée ; on ne
   fait que rattacher des mesures et des actions, qui restent des fiches ordinaires (liens « Traite »). */
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { GrcKind, GrcObject } from '@suivi/shared';
import { GRC_LABELS } from '@suivi/shared';
import { StatusChip } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { ActionDeTraitement } from './ActionDeTraitement';

interface Lien {
  id: string;
  type: string;
  other: { ref: string; name: string; kind: string; archived?: boolean };
}
const MESURES: string[] = ['treatment', 'measure', 'control'];
const ACTIONS: string[] = ['action', 'task_series'];

export function PlanTraitementRisque({
  smsi,
  risque,
  onClose,
  onAjouter,
  onOpen,
}: {
  smsi: string;
  risque: { id: string; name: string } | null;
  onClose: () => void;
  /** Crée un traitement déjà rattaché au risque (éditeur de fiche ouvert par la page). */
  onAjouter: (risqueId: string) => void;
  onOpen: (o: GrcObject) => void;
}) {
  const can = useCan(),
    [traitement, setTraitement] = useState<GrcObject | null>(null),
    [erreur, setErreur] = useState<unknown>(null);
  const ref = risque ? 'object:' + risque.id : '';
  const liens = useQuery({
    queryKey: ['grc', smsi, 'links', ref],
    queryFn: () => get<Lien[]>(`/api/grc/${smsi}/links?ref=${encodeURIComponent(ref)}`),
    enabled: !!risque,
  });
  const actifs = (liens.data ?? []).filter((l) => !l.other.archived);
  const mesures = actifs.filter((l) => MESURES.includes(l.other.kind)),
    actions = actifs.filter((l) => ACTIONS.includes(l.other.kind));
  const objet = async (l: Lien) => get<GrcObject>(`/api/grc/${smsi}/objects/${l.other.ref.replace(/^object:/, '')}`);
  const ouvrir = (l: Lien) =>
    objet(l)
      .then((o) => {
        onClose();
        onOpen(o);
      })
      .catch(setErreur);
  const ligne = (l: Lien, avecAction: boolean) => (
    <Group key={l.id} justify="space-between" wrap="nowrap">
      <div>
        <Text>{l.other.name}</Text>
        <StatusChip etat="neutre">{GRC_LABELS[l.other.kind as GrcKind] ?? l.other.kind}</StatusChip>
      </div>
      <Group gap="xs" wrap="nowrap">
        <Button size="xs" variant="default" aria-label={`Ouvrir ${l.other.name}`} onClick={() => void ouvrir(l)}>
          Ouvrir
        </Button>
        {avecAction && l.other.kind === 'treatment' && can('ecarts', 'modifier') && (
          <Button
            size="xs"
            variant="light"
            aria-label={`Générer une action pour ${l.other.name}`}
            onClick={() => void objet(l).then(setTraitement, setErreur)}
          >
            Générer une action
          </Button>
        )}
      </Group>
    </Group>
  );
  return (
    <>
      <Modal
        opened={!!risque && !traitement}
        onClose={onClose}
        size="lg"
        title={risque ? `Plan d’action : ${risque.name}` : ''}
      >
        <Stack>
          <Text size="sm">
            Mesures en place pour atténuer ce risque et actions qui les mettent en œuvre. Rattacher une mesure ou une
            action ne modifie pas le risque résiduel : il ne change que par une nouvelle appréciation.
          </Text>
          <ErrorAlert error={erreur ?? liens.error} />
          <Text fw={600}>Traitements et mesures en place</Text>
          {liens.data && !mesures.length && <Text size="sm">Aucune mesure rattachée à ce risque.</Text>}
          {mesures.map((l) => ligne(l, true))}
          <Text fw={600}>Actions rattachées</Text>
          {liens.data && !actions.length && <Text size="sm">Aucune action rattachée à ce risque.</Text>}
          {actions.map((l) => ligne(l, false))}
          {risque && can('pilotage', 'modifier') && (
            <Group>
              <Button
                onClick={() => {
                  onClose();
                  onAjouter(risque.id);
                }}
              >
                Ajouter un traitement ou une mesure
              </Button>
            </Group>
          )}
        </Stack>
      </Modal>
      {traitement && (
        <ActionDeTraitement
          key={traitement.id}
          smsi={smsi}
          traitement={traitement}
          opened
          onClose={() => setTraitement(null)}
          onCree={(action) => {
            setTraitement(null);
            onClose();
            onOpen(action);
          }}
        />
      )}
    </>
  );
}

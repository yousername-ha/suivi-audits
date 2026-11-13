/* PESTEL des enjeux externes (ISO 9001:2015, 4.1) : regroupement des enjeux existants de la carte de contexte, jamais un
   nouvel objet. La norme ne cite pas le PESTEL : l'écran le dit, et rappelle que « politique » et « environnemental »
   vont au-delà de la note 2 de 4.1. Les enjeux internes (note 3) restent hors PESTEL. */
import { Button, Group, Loader, Stack, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { syntheseParties, type EnjeuPestel, type VuePestel, type ProcessusCartes } from '@suivi/shared';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { PestelStudio } from './PestelStudio';
import { CARTES_PROCESSUS_KEY } from '../processus/CartesProcessus';

const SOCLE = '00000000-0000-4000-8000-000000000001';

export function Pestel({ smsi }: { smsi: string }) {
  const can = useCan(),
    qc = useQueryClient(),
    modifiable = can('pilotage', 'modifier'),
    [erreur, setErreur] = useState<unknown>(null),
    [enCours, setEnCours] = useState(false);
  const q = useQuery({
    queryKey: ['grc', smsi, 'pestel'],
    queryFn: () => get<VuePestel>(`/api/grc/${smsi}/pilotage/pestel`),
    enabled: smsi === SOCLE,
  });
  const processus = useQuery({
    queryKey: CARTES_PROCESSUS_KEY(smsi),
    queryFn: () => get<ProcessusCartes>(`/api/grc/${smsi}/pilotage/processus-cartes`),
    enabled: smsi === SOCLE,
  });
  if (smsi !== SOCLE) return <Text>Le PESTEL s’appuie sur le contexte du pilotage commun de l’organisation.</Text>;
  const classer = async (e: EnjeuPestel, facteur: string | null) => {
    if (!modifiable || enCours) return false;
    setEnCours(true);
    try {
      setErreur(null);
      await api('PUT', `/api/grc/${smsi}/pilotage/pestel`, { body: { assignments: { [e.ref]: facteur ?? '' } } });
      await qc.invalidateQueries({ queryKey: ['grc', smsi, 'pestel'] });
      return true;
    } catch (x) {
      setErreur(x);
      return false;
    } finally {
      setEnCours(false);
    }
  };
  const vue = q.data;
  return (
    <Stack>
      <ErrorAlert error={erreur ?? q.error} />
      {q.isPending && (
        <Group justify="center" py="xl">
          <Loader aria-label="Chargement du PESTEL" />
        </Group>
      )}
      {!vue && q.isError && (
        <Button variant="default" onClick={() => void q.refetch()}>
          Réessayer
        </Button>
      )}
      {vue && (
        <PestelStudio
          key={smsi}
          vue={vue}
          processus={new Map((processus.data?.processus ?? []).map((p) => [p.id, p.name]))}
          modifiable={modifiable}
          enCours={enCours}
          onClasser={classer}
        />
      )}
    </Stack>
  );
}

/** Chiffres clés des parties intéressées (ISO 9001:2015, 4.2), lus dans le registre de l'outil de suivi. */
export function SynthesePartiesBandeau({ smsi }: { smsi: string }) {
  const q = useQuery({
    queryKey: ['grc', smsi, 'legacy-parties'],
    queryFn: () => get<{ interested?: { addressed?: unknown; reviewed?: unknown }[] }>('/api/suivi/etat'),
    enabled: smsi === SOCLE,
  });
  if (smsi !== SOCLE || !q.data) return null;
  const s = syntheseParties(q.data.interested ?? [], new Date().toISOString().slice(0, 10));
  return (
    <Group gap="lg" aria-label="Synthèse des parties intéressées">
      {[
        [s.total, 'parties intéressées'],
        [s.traitees, 'exigences traitées'],
        [s.partielles, 'partiellement ou non traitées'],
        [s.nonRevues, 'non revues depuis un an'],
      ].map(([n, l]) => (
        <div key={String(l)}>
          <Text fw={700} size="xl">
            {n}
          </Text>
          <Text size="sm">{l}</Text>
        </div>
      ))}
    </Group>
  );
}

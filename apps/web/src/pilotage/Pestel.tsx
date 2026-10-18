/* PESTEL des enjeux externes (ISO 9001:2015, 4.1) : regroupement des enjeux existants de la carte de contexte, jamais un
   nouvel objet. La norme ne cite pas le PESTEL : l'écran le dit, et rappelle que « politique » et « environnemental »
   vont au-delà de la note 2 de 4.1. Les enjeux internes (note 3) restent hors PESTEL. */
import { Alert, Card, Group, Select, Stack, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { syntheseParties, type EnjeuPestel, type VuePestel } from '@suivi/shared';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';

const SOCLE = '00000000-0000-4000-8000-000000000001';

export function Pestel({ smsi }: { smsi: string }) {
  const can = useCan(),
    qc = useQueryClient(),
    modifiable = can('pilotage', 'modifier'),
    [erreur, setErreur] = useState<unknown>(null);
  const q = useQuery({
    queryKey: ['grc', smsi, 'pestel'],
    queryFn: () => get<VuePestel>(`/api/grc/${smsi}/pilotage/pestel`),
    enabled: smsi === SOCLE,
  });
  if (smsi !== SOCLE) return <Text>Le PESTEL s’appuie sur le contexte du pilotage commun de l’organisation.</Text>;
  const classer = async (e: EnjeuPestel, facteur: string | null) => {
    try {
      setErreur(null);
      await api('PUT', `/api/grc/${smsi}/pilotage/pestel`, { body: { assignments: { [e.ref]: facteur ?? '' } } });
      await qc.invalidateQueries({ queryKey: ['grc', smsi, 'pestel'] });
    } catch (x) {
      setErreur(x);
    }
  };
  const vue = q.data;
  const choix = (vue?.facteurs ?? []).map((f) => ({ value: f.id, label: f.label }));
  const ligne = (e: EnjeuPestel) => (
    <Group key={e.ref} justify="space-between" wrap="nowrap" align="flex-start">
      <div>
        <Text fw={500}>{e.label}</Text>
        {e.description && (
          <Text size="sm" c="dimmed">
            {e.description}
          </Text>
        )}
        {!!e.processus.length && <Text size="xs">Processus concernés : {e.processus.join(', ')}</Text>}
      </div>
      {modifiable && (
        <Select
          size="xs"
          aria-label={`Facteur de l’enjeu ${e.label}`}
          placeholder="Non classé"
          clearable
          data={choix}
          value={e.facteur && choix.some((c) => c.value === e.facteur) ? e.facteur : null}
          onChange={(v) => void classer(e, v)}
        />
      )}
    </Group>
  );
  return (
    <Stack>
      <Alert>
        Le PESTEL n’est pas exigé par la norme ISO 9001:2015 : c’est une présentation facultative des enjeux externes de
        l’article 4.1. La note 2 de 4.1 cite l’environnement juridique, technologique, concurrentiel, commercial,
        culturel, social et économique ; les facteurs « politique » et « environnemental » vont au-delà. Les facteurs
        sont ceux de votre nomenclature. Les enjeux internes (valeurs, culture, connaissances, performance, note 3)
        restent dans le contexte et le SWOT.
      </Alert>
      <ErrorAlert error={erreur ?? q.error} />
      {vue?.parFacteur.map(({ facteur, enjeux }) => (
        <Card key={facteur.id} withBorder aria-label={`Facteur ${facteur.label}`}>
          <Stack gap="xs">
            <Text fw={600}>
              {facteur.label} ({enjeux.length})
            </Text>
            {enjeux.length ? enjeux.map(ligne) : <Text size="sm">Aucun enjeu classé dans ce facteur.</Text>}
          </Stack>
        </Card>
      ))}
      {vue && (
        <Card withBorder aria-label="Enjeux externes non classés">
          <Stack gap="xs">
            <Text fw={600}>Enjeux externes non classés ({vue.nonClasses.length})</Text>
            {vue.nonClasses.length ? (
              vue.nonClasses.map(ligne)
            ) : (
              <Text size="sm">Tous les enjeux externes sont classés.</Text>
            )}
          </Stack>
        </Card>
      )}
      {vue && (
        <Card withBorder aria-label="Enjeux internes">
          <Stack gap="xs">
            <Text fw={600}>Enjeux internes, hors PESTEL ({vue.internes.length})</Text>
            {vue.internes.length ? (
              vue.internes.map((e) => (
                <div key={e.ref}>
                  <Text fw={500}>{e.label}</Text>
                  {e.description && (
                    <Text size="sm" c="dimmed">
                      {e.description}
                    </Text>
                  )}
                </div>
              ))
            ) : (
              <Text size="sm">Aucun enjeu interne.</Text>
            )}
          </Stack>
        </Card>
      )}
      {vue && !vue.nonClasses.length && !vue.internes.length && !vue.parFacteur.some((f) => f.enjeux.length) && (
        <Text>
          Aucun enjeu : ils proviennent des objectifs (enjeux associés), des analyses SWOT et de la carte de contexte.
        </Text>
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

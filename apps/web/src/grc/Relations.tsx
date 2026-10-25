import { Button, Card, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import {
  GRC_LABELS,
  libelleRelation,
  RELATIONS,
  relationsPossibles,
  TYPES_RELATION,
  type GrcKind,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
const APPLICABILITE: Record<string, string> = {
  applicable: 'applicable',
  exclue: 'exclue',
  a_determiner: 'à déterminer',
  non_evaluee: 'non évaluée',
};
/** sourceKind : type de la fiche source (absent pour une fiche historique) ; il permet de ne proposer que les relations que
    le serveur accepte pour la paire source/cible. */
export function Relations({ smsi, source, sourceKind }: { smsi: string; source: string; sourceKind?: string }) {
  const qc = useQueryClient(),
    [search, setSearch] = useState(''),
    [target, setTarget] = useState<string | null>(null),
    [type, setType] = useState('related_to'),
    [note, setNote] = useState(''),
    [error, setError] = useState<unknown>(null);
  const options = useQuery({
    queryKey: ['grc', smsi, 'sources', search],
    queryFn: () =>
      get<{ items: { ref: string; name: string; kind: string }[] }>(
        `/api/grc/${smsi}/sources?search=${encodeURIComponent(search)}`,
      ),
  });
  const links = useQuery({
    queryKey: ['grc', smsi, 'links', source],
    queryFn: () =>
      get<
        {
          id: string;
          type: string;
          note: string;
          derived?: boolean;
          sens?: 'sortant' | 'entrant';
          other: { ref: string; name: string; kind: string; archived?: boolean; applicabilite?: string | null };
        }[]
      >(`/api/grc/${smsi}/links?ref=${encodeURIComponent(source)}`),
  });
  const kindCible = options.data?.items.find((r) => r.ref === target)?.kind;
  const relationsCible =
    sourceKind && kindCible
      ? relationsPossibles(sourceKind, kindCible)
      : TYPES_RELATION.filter((t) => {
          const c = RELATIONS[t].cibles;
          return !kindCible || c === '*' || (c as readonly string[]).includes(kindCible);
        });
  const save = async () => {
    try {
      setError(null);
      await api('POST', `/api/grc/${smsi}/links`, {
        body: {
          source,
          target,
          type: relationsCible.includes(type as (typeof TYPES_RELATION)[number]) ? type : 'related_to',
          note,
        },
      });
      await qc.invalidateQueries({ queryKey: ['grc', smsi] });
      setTarget(null);
    } catch (e) {
      setError(e);
    }
  };
  return (
    <Stack>
      <Text fw={600}>Relations bidirectionnelles et justificatifs</Text>
      <Text size="sm">
        Sélectionnez les données existantes, y compris une version précise de document. Aucune copie n’est créée.
      </Text>
      <ErrorAlert error={error ?? options.error ?? links.error} />
      <TextInput label="Rechercher un objet lié" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
      <Select
        label="Objet ou version de preuve"
        searchable
        value={target}
        onChange={setTarget}
        data={(options.data?.items ?? [])
          .filter((r) => r.ref !== source)
          .map((r) => ({
            value: r.ref,
            label: r.name + ' · ' + (GRC_LABELS[r.kind as GrcKind] ?? 'Donnée existante'),
          }))}
      />
      <Select
        label="Type de relation"
        description="Seules les relations prévues pour ce type d’objet sont proposées ; « Lié à » convient à toute paire."
        value={relationsCible.includes(type as (typeof TYPES_RELATION)[number]) ? type : 'related_to'}
        onChange={(v) => setType(v ?? 'related_to')}
        data={relationsCible.map((t) => ({ value: t, label: RELATIONS[t].libelle }))}
      />
      <Textarea label="Justification du lien" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      <Button disabled={!target} onClick={() => void save()}>
        Enregistrer la relation
      </Button>
      {links.data?.map((l) => (
        <Card withBorder key={l.id}>
          <Text>
            {libelleRelation(l.type, l.sens !== 'entrant')} : {l.other.name} ·{' '}
            {GRC_LABELS[l.other.kind as GrcKind] ?? 'Donnée existante'}
            {l.other.archived ? ' (archivé)' : ''}
          </Text>
          {l.other.kind === 'requirement' && l.other.applicabilite && (
            <Text size="sm">
              Applicabilité dans ce périmètre : {APPLICABILITE[l.other.applicabilite] ?? l.other.applicabilite}. Le lien
              ne change ni l’applicabilité ni la couverture.
            </Text>
          )}
          {l.note && <Text size="sm">{l.note}</Text>}
          {l.derived ? (
            <Text size="sm">Modifier cette référence dans la fiche source.</Text>
          ) : (
            <Button
              variant="subtle"
              onClick={async () => {
                try {
                  await api('DELETE', `/api/grc/${smsi}/links/${l.id}`);
                  await qc.invalidateQueries({ queryKey: ['grc', smsi] });
                } catch (e) {
                  setError(e);
                }
              }}
            >
              Retirer la relation
            </Button>
          )}
        </Card>
      ))}
    </Stack>
  );
}

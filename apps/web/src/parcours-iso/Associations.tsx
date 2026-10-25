/* Associations explicites d'une fiche ou d'une preuve existante à une sous-action du parcours (migration 038). Le parcours ne
   crée aucune fiche : il garde une référence, versionnée au journal, avec le motif d'un éventuel retrait. Une association ne
   modifie pas sa cible et ne vaut ni revue, ni conformité. Les droits et la lisibilité de la cible sont vérifiés par le serveur. */
import { Anchor, Button, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  GRC_LABELS,
  type ApplicabiliteHdsDto,
  type AssociationParcoursDto,
  type GrcKind,
  type SousActionParcours,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { lienModule, resoudreDestination } from './destinations';

interface Source {
  ref: string;
  name: string;
  kind: string;
}
export const cleAssociations = (smsi: string) => ['grc', smsi, 'parcours-iso', 'associations'] as const;

export function useAssociations(smsi: string) {
  const can = useCan();
  return useQuery({
    queryKey: cleAssociations(smsi),
    queryFn: () => get<{ items: AssociationParcoursDto[] }>(`/api/grc/${smsi}/parcours/associations`),
    enabled: can('pilotage', 'lire'),
    staleTime: 15_000,
    retry: false,
  });
}
const libelleType = (kind: string | null) =>
  kind === 'evidence' ? 'Preuve' : kind ? (GRC_LABELS[kind as GrcKind] ?? 'Fiche') : 'Élément';

export function AssociationsSousAction({ smsi, sousAction }: { smsi: string; sousAction: SousActionParcours }) {
  const can = useCan();
  const qc = useQueryClient();
  const liste = useAssociations(smsi);
  const dest = resoudreDestination(sousAction.vers);
  const [recherche, setRecherche] = useState('');
  const [cible, setCible] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [retrait, setRetrait] = useState<{ ref: string; motif: string } | null>(null);
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const peutModifier = can('pilotage', 'modifier');
  const associees = (liste.data?.items ?? []).filter((a) => a.sousAction === sousAction.id);
  const sources = useQuery({
    queryKey: ['grc', smsi, 'parcours-iso', 'sources', recherche],
    queryFn: () => get<{ items: Source[] }>(`/api/grc/${smsi}/sources?search=${encodeURIComponent(recherche)}`),
    enabled: peutModifier,
    staleTime: 10_000,
  });
  const options = (sources.data?.items ?? [])
    .filter(
      (s) => (s.ref.startsWith('object:') || s.ref.startsWith('document:')) && !associees.some((a) => a.ref === s.ref),
    )
    .slice(0, 100)
    .map((s) => ({ value: s.ref, label: `${s.name} · ${libelleType(s.kind)}` }));
  const executer = async (chemin: string, body: Record<string, unknown>, message: string) => {
    setEnvoi(true);
    setErreur(null);
    try {
      await api('POST', `/api/grc/${smsi}/parcours/associations${chemin}`, {
        body: { requestId: crypto.randomUUID(), sousAction: sousAction.id, ...body },
      });
      await qc.invalidateQueries({ queryKey: cleAssociations(smsi) });
      notifications.show({ color: 'teal', message });
      return true;
    } catch (e) {
      setErreur(e);
      return false;
    } finally {
      setEnvoi(false);
    }
  };
  if (!can('pilotage', 'lire')) return null;
  return (
    <Stack gap="xs" role="group" aria-label="Fiches et preuves associées à cette sous-action">
      <Text fw={600} size="sm">
        Fiches et preuves associées
      </Text>
      <Text size="xs" c="dimmed">
        Une association est une référence : elle ne modifie pas la fiche ou la preuve et ne vaut ni revue, ni
        conformité.
      </Text>
      <ErrorAlert error={erreur ?? liste.error} />
      {liste.isLoading && <Text size="sm">Chargement…</Text>}
      {!liste.isLoading && associees.length === 0 && <Text size="sm">Aucune fiche ni preuve associée.</Text>}
      <ul className="parcours-travaux">
        {associees.map((a) => (
          <li key={a.ref}>
            <Group gap="xs" wrap="wrap">
              {a.name && dest && a.ref.startsWith('object:') && sousAction.kinds.includes(a.kind as GrcKind) ? (
                <Anchor component={Link} to={lienModule(dest, smsi, a.ref.slice('object:'.length))}>
                  {a.name}
                </Anchor>
              ) : (
                <span>{a.name ?? 'Élément non accessible avec vos droits'}</span>
              )}
              <Text size="xs" c="dimmed">
                {libelleType(a.kind)} · associé par {a.associePar} le{' '}
                {new Date(a.associeLe).toLocaleDateString('fr-FR')}
              </Text>
              {peutModifier && retrait?.ref !== a.ref && (
                <Button
                  variant="subtle"
                  size="compact-xs"
                  aria-label={`Retirer l’association de ${a.name ?? a.ref}`}
                  onClick={() => setRetrait({ ref: a.ref, motif: '' })}
                >
                  Retirer
                </Button>
              )}
            </Group>
            {a.note && <Text size="xs">{a.note}</Text>}
            {retrait?.ref === a.ref && (
              <Group align="end" gap="xs">
                <TextInput
                  label="Motif du retrait"
                  description="5 caractères au moins ; l’historique est conservé."
                  value={retrait.motif}
                  onChange={(e) => setRetrait({ ref: a.ref, motif: e.currentTarget.value })}
                />
                <Button
                  size="compact-sm"
                  loading={envoi}
                  disabled={retrait.motif.trim().length < 5}
                  onClick={async () => {
                    if (await executer('/retrait', { ref: a.ref, reason: retrait.motif }, 'Association retirée.'))
                      setRetrait(null);
                  }}
                >
                  Confirmer le retrait
                </Button>
                <Button size="compact-sm" variant="default" onClick={() => setRetrait(null)}>
                  Annuler
                </Button>
              </Group>
            )}
          </li>
        ))}
      </ul>
      {peutModifier ? (
        <Stack gap="xs">
          <Select
            label="Associer une fiche ou une preuve existante"
            description="Recherchez par intitulé : seuls les éléments que vous pouvez lire sont proposés."
            searchable
            clearable
            data={options}
            value={cible}
            onSearchChange={setRecherche}
            onChange={setCible}
            nothingFoundMessage={sources.isLoading ? 'Recherche…' : 'Aucun élément trouvé'}
          />
          <TextInput
            label="Note (facultative)"
            description="Pourquoi cet élément correspond à cette sous-action."
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
          <Group>
            <Button
              variant="light"
              loading={envoi}
              disabled={!cible}
              onClick={async () => {
                if (cible && (await executer('', { ref: cible, note }, 'Élément associé.'))) {
                  setCible(null);
                  setNote('');
                }
              }}
            >
              Associer
            </Button>
          </Group>
        </Stack>
      ) : (
        <Text size="xs" c="dimmed">
          Vous n’avez pas le droit de modifier le parcours : les associations restent consultables.
        </Text>
      )}
    </Stack>
  );
}

/** Applicabilité HDS dans le périmètre, lue sur les évaluations d'exigences du référentiel HDS rattaché (lecture seule). */
export function ApplicabiliteHds({ smsi }: { smsi: string }) {
  const can = useCan();
  const q = useQuery({
    queryKey: ['grc', smsi, 'parcours-iso', 'hds'],
    queryFn: () => get<ApplicabiliteHdsDto>(`/api/grc/${smsi}/parcours/hds`),
    enabled: can('conformite', 'lire'),
    staleTime: 30_000,
    retry: false,
  });
  if (!can('conformite', 'lire')) return null;
  if (q.isLoading) return <Text size="sm">Applicabilité HDS : lecture en cours…</Text>;
  if (q.error) return <ErrorAlert error={q.error} />;
  const d = q.data!;
  if (!d.referentiel)
    return (
      <Text size="sm" role="status">
        Applicabilité HDS : aucun référentiel HDS n’est rattaché et actif dans ce périmètre. Rien n’est déduit du
        secteur d’activité.
      </Text>
    );
  return (
    <Text size="sm" role="status">
      Applicabilité HDS dans ce périmètre — référentiel « {d.referentiel.name} » (version {d.referentiel.version}
      {d.referentiel.heritage ? ', hérité' : ''}) : {d.applicable} applicable{d.applicable > 1 ? 's' : ''}, {d.exclue}{' '}
      exclue{d.exclue > 1 ? 's' : ''}, {d.aDeterminer} à déterminer, {d.nonEvaluee} non évaluée
      {d.nonEvaluee > 1 ? 's' : ''} sur {d.total}. Lecture seule : l’applicabilité se décide dans la couverture par
      référentiel.
    </Text>
  );
}

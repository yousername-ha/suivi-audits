/* Fournisseurs de l'organisation (ADR 0032, lot M4) : le registre est celui de l'outil historique, l'évaluation est
   indépendante des périmètres, le rattachement à un périmètre ne porte aucune donnée d'évaluation. */
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { DataTable, StatusChip } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { lienHistorique } from '../pilotage-navigation';
import { useCan } from '../session';

export interface EvaluationCourante {
  id: string;
  evaluatedAt: string;
  evaluator: string;
  nextReviewAt: string | null;
  items: number;
  meets: number;
  notMeets: number;
  notAssessed: number;
}
export interface Fournisseur {
  id: string;
  name: string;
  saas: boolean;
  current: EvaluationCourante | null;
  toReview: boolean;
  scopes: string[];
}
export interface Critere {
  id: string;
  label: string;
  description: string;
  purposes: string[];
  requirementRefs: string[];
  version: number;
  archived: boolean;
}
interface Perimetre {
  id: string;
  name: string;
}
interface Historique {
  id: string;
  evaluatedAt: string;
  evaluator: string;
  conclusion: string;
  nextReviewAt: string | null;
  items: {
    criterionId: string;
    criterionLabel: string;
    criterionVersion: number;
    meets: boolean | null;
    result: string;
  }[];
}

export const REPONSE: Record<string, string> = { oui: 'Répond', non: 'Ne répond pas', nonevalue: 'Non évalué' };
const versOption = (m: boolean | null) => (m === true ? 'oui' : m === false ? 'non' : 'nonevalue');
const depuisOption = (v: string | null) => (v === 'oui' ? true : v === 'non' ? false : null);
const jour = (d: Date) => d.toISOString().slice(0, 10);

export function Fournisseurs() {
  const can = useCan(),
    qc = useQueryClient(),
    modifier = can('fournisseurs', 'modifier'),
    [nom, setNom] = useState<string | null>(null),
    [evaluer, setEvaluer] = useState<Fournisseur | null>(null),
    [historique, setHistorique] = useState<Fournisseur | null>(null),
    [perimetres, setPerimetres] = useState<Fournisseur | null>(null),
    [erreur, setErreur] = useState<unknown>(null);
  const liste = useQuery({ queryKey: ['suppliers'], queryFn: () => get<Fournisseur[]>('/api/suppliers') });
  const creer = async () => {
    if (nom === null) return;
    try {
      setErreur(null);
      await api('POST', '/api/suppliers', { body: { name: nom.trim() } });
      await qc.invalidateQueries({ queryKey: ['suppliers'] });
      await qc.invalidateQueries({ queryKey: ['grc'] });
      setNom(null);
    } catch (e) {
      setErreur(e);
    }
  };
  return (
    <Stack>
      <Alert>
        Les fournisseurs et leurs évaluations appartiennent à l’organisation, pas à un périmètre : un fournisseur évalué
        l’est de la même façon dans tous les périmètres où il est rattaché. Les critères sont définis par vos soins ;
        aucune grille ni aucun seuil n’est fourni. Les autres informations d’un fournisseur (contact, contrôles,
        certificats) se complètent dans{' '}
        <Anchor href={lienHistorique({ onglet: 'fournisseurs', vue: 'supView=list' })}>l’outil de suivi</Anchor>.
      </Alert>
      <ErrorAlert error={erreur ?? liste.error} />
      <Group justify="space-between">
        <Text>{liste.data ? `${liste.data.length} fournisseur(s)` : 'Chargement des fournisseurs…'}</Text>
        {modifier && <Button onClick={() => setNom('')}>Ajouter un fournisseur</Button>}
      </Group>
      <DataTable label="Fournisseurs de l’organisation, défilement horizontal possible">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fournisseur</Table.Th>
              <Table.Th>Évaluation courante</Table.Th>
              <Table.Th>Réévaluation</Table.Th>
              <Table.Th>Périmètres</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(liste.data ?? []).map((f) => (
              <Table.Tr key={f.id}>
                <Table.Td>
                  <Text fw={600}>{f.name}</Text>
                  <Text size="xs" c="dimmed">
                    {f.id}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {f.current ? (
                    <>
                      <Text>
                        Le {f.current.evaluatedAt} · {f.current.evaluator}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {f.current.meets} répond · {f.current.notMeets} ne répond pas · {f.current.notAssessed} non
                        évalué
                      </Text>
                    </>
                  ) : (
                    <StatusChip etat="neutre">Non évalué</StatusChip>
                  )}
                </Table.Td>
                <Table.Td>
                  {f.current?.nextReviewAt ? (
                    <>
                      <Text>{f.current.nextReviewAt}</Text>
                      {f.toReview && <StatusChip etat="erreur">À réévaluer</StatusChip>}
                    </>
                  ) : (
                    '—'
                  )}
                </Table.Td>
                <Table.Td>{f.scopes.length ? `${f.scopes.length} rattaché(s)` : 'Aucun'}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {modifier && (
                      <Button size="xs" aria-label={`Évaluer le fournisseur ${f.name}`} onClick={() => setEvaluer(f)}>
                        Évaluer
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="default"
                      aria-label={`Historique des évaluations de ${f.name}`}
                      onClick={() => setHistorique(f)}
                    >
                      Historique
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      aria-label={`Périmètres de rattachement de ${f.name}`}
                      onClick={() => setPerimetres(f)}
                    >
                      Périmètres
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataTable>
      {liste.data && !liste.data.length && <Text>Aucun fournisseur dans le registre.</Text>}
      <Modal opened={nom !== null} onClose={() => setNom(null)} title="Ajouter un fournisseur">
        <Stack>
          <ErrorAlert error={erreur} />
          <TextInput label="Nom" required value={nom ?? ''} onChange={(e) => setNom(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setNom(null)}>
              Annuler
            </Button>
            <Button disabled={(nom ?? '').trim().length < 2} onClick={creer}>
              Ajouter
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={!!evaluer}
        onClose={() => setEvaluer(null)}
        size="xl"
        title={evaluer ? `Évaluer ${evaluer.name}` : ''}
      >
        {evaluer && <EvaluationForm fournisseur={evaluer} onDone={() => setEvaluer(null)} />}
      </Modal>
      <Modal
        opened={!!historique}
        onClose={() => setHistorique(null)}
        size="xl"
        title={historique ? `Évaluations de ${historique.name}` : ''}
      >
        {historique && <HistoriqueEvaluations fournisseur={historique} />}
      </Modal>
      <Modal
        opened={!!perimetres}
        onClose={() => setPerimetres(null)}
        title={perimetres ? `Périmètres de ${perimetres.name}` : ''}
      >
        {perimetres && <RattachementPerimetres fournisseurId={perimetres.id} />}
      </Modal>
    </Stack>
  );
}

function EvaluationForm({ fournisseur, onDone }: { fournisseur: Fournisseur; onDone: () => void }) {
  const can = useCan(),
    qc = useQueryClient(),
    [date, setDate] = useState(jour(new Date())),
    [prochaine, setProchaine] = useState(''),
    [conclusion, setConclusion] = useState(''),
    [choix, setChoix] = useState<Record<string, { meets: string; result: string }>>({}),
    [erreur, setErreur] = useState<unknown>(null);
  const criteres = useQuery({
    queryKey: ['suppliers', 'criteria'],
    queryFn: () => get<Critere[]>('/api/suppliers/criteria'),
  });
  const retenus = Object.keys(choix);
  const enregistrer = async () => {
    try {
      setErreur(null);
      await api('POST', `/api/suppliers/${encodeURIComponent(fournisseur.id)}/evaluations`, {
        body: {
          evaluatedAt: date,
          conclusion,
          nextReviewAt: prochaine || null,
          items: retenus.map((id) => ({
            criterionId: id,
            meets: depuisOption(choix[id]!.meets),
            result: choix[id]!.result,
          })),
          confirm: 'ENREGISTRER',
        },
      });
      await qc.invalidateQueries({ queryKey: ['suppliers'] });
      await qc.invalidateQueries({ queryKey: ['grc'] });
      onDone();
    } catch (e) {
      setErreur(e);
    }
  };
  return (
    <Stack>
      <Alert>
        Une évaluation enregistrée ne se modifie plus : pour la corriger, enregistrez-en une nouvelle (la plus récente
        devient l’évaluation courante). « Répond » est un oui, un non ou un non évalué : il n’y a ni note ni seuil.
      </Alert>
      <ErrorAlert error={erreur ?? criteres.error} />
      {criteres.data && !criteres.data.length && (
        <Text>
          Aucun critère n’est défini.{' '}
          {can('fournisseurs', 'administrer') ? (
            <Anchor component={Link} to="/pilotage/criteres-fournisseurs">
              Définir les critères d’évaluation
            </Anchor>
          ) : (
            'Une personne habilitée doit d’abord les définir (rubrique « Critères d’évaluation »).'
          )}
        </Text>
      )}
      <Group grow align="flex-start">
        <TextInput
          label="Date de l’évaluation"
          type="date"
          value={date}
          onChange={(e) => setDate(e.currentTarget.value)}
        />
        <TextInput
          label="Prochaine réévaluation (facultatif)"
          type="date"
          value={prochaine}
          onChange={(e) => setProchaine(e.currentTarget.value)}
        />
      </Group>
      {(criteres.data ?? []).map((k) => {
        const c = choix[k.id];
        return (
          <Stack key={k.id} gap="xs">
            <Checkbox
              label={k.label}
              description={k.description || undefined}
              checked={!!c}
              onChange={(e) =>
                setChoix((v) => {
                  const next = { ...v };
                  if (e.currentTarget.checked) next[k.id] = { meets: 'nonevalue', result: '' };
                  else delete next[k.id];
                  return next;
                })
              }
            />
            {c && (
              <Group grow align="flex-start">
                <Select
                  label={`Répond au critère « ${k.label} » ?`}
                  allowDeselect={false}
                  data={Object.entries(REPONSE).map(([value, label]) => ({ value, label }))}
                  value={c.meets}
                  onChange={(v) => setChoix((x) => ({ ...x, [k.id]: { ...c, meets: v ?? 'nonevalue' } }))}
                />
                <TextInput
                  label={`Résultat pour « ${k.label} »`}
                  value={c.result}
                  onChange={(e) => setChoix((x) => ({ ...x, [k.id]: { ...c, result: e.currentTarget.value } }))}
                />
              </Group>
            )}
          </Stack>
        );
      })}
      <Textarea label="Conclusion" value={conclusion} onChange={(e) => setConclusion(e.currentTarget.value)} />
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button disabled={!retenus.length || !date} onClick={enregistrer}>
          Enregistrer l’évaluation
        </Button>
      </Group>
    </Stack>
  );
}

function HistoriqueEvaluations({ fournisseur }: { fournisseur: Fournisseur }) {
  const q = useQuery({
    queryKey: ['suppliers', fournisseur.id, 'evaluations'],
    queryFn: () => get<Historique[]>(`/api/suppliers/${encodeURIComponent(fournisseur.id)}/evaluations`),
  });
  return (
    <Stack>
      <ErrorAlert error={q.error} />
      {q.data && !q.data.length && <Text>Aucune évaluation enregistrée.</Text>}
      {(q.data ?? []).map((e, i) => (
        <Stack key={e.id} gap="xs">
          <Group>
            <Text fw={600}>
              Évaluation du {e.evaluatedAt} · {e.evaluator}
            </Text>
            {i === 0 && <StatusChip etat="succes">Courante</StatusChip>}
            {e.nextReviewAt && <Text size="sm">Réévaluation prévue le {e.nextReviewAt}</Text>}
          </Group>
          {e.conclusion && <Text>{e.conclusion}</Text>}
          <DataTable label={`Critères de l’évaluation du ${e.evaluatedAt}`}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Critère (version au moment de l’évaluation)</Table.Th>
                  <Table.Th>Répond</Table.Th>
                  <Table.Th>Résultat</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {e.items.map((it) => (
                  <Table.Tr key={it.criterionId}>
                    <Table.Td>
                      {it.criterionLabel} (v{it.criterionVersion})
                    </Table.Td>
                    <Table.Td>{REPONSE[versOption(it.meets)]}</Table.Td>
                    <Table.Td>{it.result || '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </DataTable>
        </Stack>
      ))}
    </Stack>
  );
}

function RattachementPerimetres({ fournisseurId }: { fournisseurId: string }) {
  const can = useCan(),
    qc = useQueryClient(),
    modifier = can('fournisseurs', 'modifier'),
    [erreur, setErreur] = useState<unknown>(null);
  const scopes = useQuery({ queryKey: ['grc', 'smsis'], queryFn: () => get<Perimetre[]>('/api/grc/smsis') });
  const liste = useQuery({ queryKey: ['suppliers'], queryFn: () => get<Fournisseur[]>('/api/suppliers') });
  const rattaches = new Set(liste.data?.find((f) => f.id === fournisseurId)?.scopes ?? []);
  const changer = async (smsi: string, rattacher: boolean) => {
    try {
      setErreur(null);
      await api(rattacher ? 'PUT' : 'DELETE', `/api/grc/${smsi}/suppliers/${encodeURIComponent(fournisseurId)}`);
      await qc.invalidateQueries({ queryKey: ['suppliers'] });
      await qc.invalidateQueries({ queryKey: ['grc'] });
    } catch (e) {
      setErreur(e);
    }
  };
  return (
    <Stack>
      <Text size="sm">
        Le rattachement ne contient aucune donnée d’évaluation : le retirer ne supprime ni le fournisseur ni ses
        évaluations.
      </Text>
      <ErrorAlert error={erreur ?? scopes.error ?? liste.error} />
      {(scopes.data ?? []).map((p) => (
        <Group key={p.id} justify="space-between">
          <Text>{p.name}</Text>
          {rattaches.has(p.id) ? (
            <Group gap="xs">
              <StatusChip etat="succes">Rattaché</StatusChip>
              {modifier && (
                <Button
                  size="xs"
                  variant="default"
                  aria-label={`Retirer le rattachement au périmètre ${p.name}`}
                  onClick={() => changer(p.id, false)}
                >
                  Retirer
                </Button>
              )}
            </Group>
          ) : (
            modifier && (
              <Button size="xs" aria-label={`Rattacher au périmètre ${p.name}`} onClick={() => changer(p.id, true)}>
                Rattacher
              </Button>
            )
          )}
        </Group>
      ))}
    </Stack>
  );
}

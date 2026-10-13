/* Correspondances de la bibliothèque (ADR 0031, lot M3) : on propose une correspondance entre deux exigences de deux
   référentiels de la bibliothèque, puis une personne habilitée la VALIDE une seule fois pour toute l'organisation.
   Aucune correspondance n'est fournie : elles sont rédigées et validées par l'organisme. */
import {
  Alert,
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FrameworkDefinition } from '@suivi/shared';
import { DataTable, StatusChip, type Etat } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { TYPES_CORRESPONDANCE } from './Rapprochements';

interface Referentiel {
  id: string;
  name: string;
  version: number;
}
interface Extremite {
  frameworkId: string;
  version: number;
  requirementId: string;
}
interface Correspondance {
  id: string;
  source: Extremite;
  target: Extremite;
  type: string;
  justification: string;
  coverage: number;
  status: 'proposed' | 'validated' | 'withdrawn';
  version: number;
  createdBy: string;
  validatedBy: string | null;
}
interface Formulaire {
  source: { frameworkId: string; version: string; requirementId: string };
  target: { frameworkId: string; version: string; requirementId: string };
  type: string;
  coverage: number;
  justification: string;
  origin: string;
  sourceUrl: string;
}
const VIDE: Formulaire = {
  source: { frameworkId: '', version: '', requirementId: '' },
  target: { frameworkId: '', version: '', requirementId: '' },
  type: 'equivalent',
  coverage: 100,
  justification: '',
  origin: 'human',
  sourceUrl: '',
};
const STATUTS: Record<Correspondance['status'], { etat: Etat; libelle: string }> = {
  proposed: { etat: 'info', libelle: 'Proposée' },
  validated: { etat: 'succes', libelle: 'Validée' },
  withdrawn: { etat: 'neutre', libelle: 'Retirée' },
};

function ExtremiteChamps({
  titre,
  valeur,
  referentiels,
  onChange,
}: {
  titre: string;
  valeur: Formulaire['source'];
  referentiels: Referentiel[];
  onChange: (v: Formulaire['source']) => void;
}) {
  const fw = referentiels.find((r) => r.id === valeur.frameworkId);
  const exigences = useQuery({
    queryKey: ['library', 'frameworks', valeur.frameworkId, valeur.version],
    queryFn: () =>
      get<{ definition: FrameworkDefinition }>(
        `/api/library/frameworks/${valeur.frameworkId}/versions/${valeur.version}`,
      ),
    enabled: !!valeur.frameworkId && !!valeur.version,
  });
  return (
    <Stack gap="xs">
      <Text fw={600}>{titre}</Text>
      <Select
        label={`Référentiel (${titre.toLowerCase()})`}
        data={referentiels.map((r) => ({ value: r.id, label: r.name }))}
        value={valeur.frameworkId || null}
        onChange={(v) =>
          onChange({
            frameworkId: v ?? '',
            version: v ? String(referentiels.find((r) => r.id === v)!.version) : '',
            requirementId: '',
          })
        }
      />
      {fw && (
        <Select
          label={`Version (${titre.toLowerCase()})`}
          allowDeselect={false}
          data={Array.from({ length: fw.version }, (_, i) => ({
            value: String(fw.version - i),
            label: `Version ${fw.version - i}`,
          }))}
          value={valeur.version}
          onChange={(v) => onChange({ ...valeur, version: v ?? '', requirementId: '' })}
        />
      )}
      <Select
        label={`Exigence (${titre.toLowerCase()})`}
        searchable
        limit={50}
        nothingFoundMessage="Aucune exigence"
        data={(exigences.data?.definition.requirements ?? []).map((r) => ({
          value: r.id,
          label: `${r.id} · ${r.title}`,
        }))}
        value={valeur.requirementId || null}
        onChange={(v) => onChange({ ...valeur, requirementId: v ?? '' })}
        disabled={!exigences.data}
      />
    </Stack>
  );
}

export function CorrespondancesBibliotheque() {
  const can = useCan(),
    qc = useQueryClient(),
    modifier = can('conformite', 'modifier'),
    administrer = can('conformite', 'administrer'),
    [statut, setStatut] = useState('proposed'),
    [formulaire, setFormulaire] = useState<Formulaire | null>(null),
    [decision, setDecision] = useState<{ m: Correspondance; action: 'validate' | 'withdraw' } | null>(null),
    [note, setNote] = useState(''),
    [erreur, setErreur] = useState<unknown>(null);
  const referentiels = useQuery({
    queryKey: ['library', 'frameworks'],
    queryFn: () => get<Referentiel[]>('/api/library/frameworks'),
  });
  const liste = useQuery({
    queryKey: ['library', 'mappings', statut],
    queryFn: () => get<Correspondance[]>(`/api/library/mappings?status=${statut}`),
  });
  const noms = new Map((referentiels.data ?? []).map((r) => [r.id, r.name]));
  const extremite = (e: Extremite) => (
    <>
      <Text size="xs" c="dimmed">
        {noms.get(e.frameworkId) ?? e.frameworkId} · version {e.version}
      </Text>
      <Text>
        <b>{e.requirementId}</b>
      </Text>
    </>
  );
  const proposer = async () => {
    if (!formulaire) return;
    try {
      setErreur(null);
      const f = formulaire;
      await api('POST', '/api/library/mappings', {
        body: {
          source: { ...f.source, version: Number(f.source.version) },
          target: { ...f.target, version: Number(f.target.version) },
          type: f.type,
          coverage: f.coverage,
          justification: f.justification,
          origin: f.origin,
          sourceUrl: f.sourceUrl,
        },
      });
      await qc.invalidateQueries({ queryKey: ['library', 'mappings'] });
      setFormulaire(null);
    } catch (e) {
      setErreur(e);
    }
  };
  const decider = async () => {
    if (!decision) return;
    try {
      setErreur(null);
      await api('POST', `/api/library/mappings/${decision.m.id}/${decision.action}`, {
        body: { note: note.trim(), confirm: decision.action === 'validate' ? 'VALIDER' : 'RETIRER' },
        ifMatch: decision.m.version,
      });
      setDecision(null);
      setNote('');
      await qc.invalidateQueries({ queryKey: ['library', 'mappings'] });
      await qc.invalidateQueries({ queryKey: ['grc'] });
    } catch (e) {
      setErreur(e);
    }
  };
  const champ = <K extends keyof Formulaire>(k: K, v: Formulaire[K]) =>
    setFormulaire((f) => (f ? { ...f, [k]: v } : f));
  const complet =
    !!formulaire &&
    !!formulaire.source.requirementId &&
    !!formulaire.target.requirementId &&
    formulaire.justification.trim().length >= 10 &&
    /^https:\/\//.test(formulaire.sourceUrl);
  return (
    <Stack>
      <Alert>
        Une correspondance dit en quoi une exigence d’un référentiel rejoint celle d’un autre. Elle est d’abord
        proposée, puis validée une seule fois pour toute l’organisation par une personne habilitée : c’est elle qui
        permet de proposer des rapprochements dans les périmètres. Aucune correspondance n’est fournie.
      </Alert>
      <ErrorAlert error={erreur ?? liste.error ?? referentiels.error} />
      <Group justify="space-between">
        <SegmentedControl
          aria-label="État des correspondances"
          value={statut}
          onChange={setStatut}
          data={[
            { value: 'proposed', label: 'Proposées' },
            { value: 'validated', label: 'Validées' },
            { value: 'withdrawn', label: 'Retirées' },
          ]}
        />
        {modifier && (
          <Button onClick={() => setFormulaire(VIDE)} disabled={(referentiels.data?.length ?? 0) < 1}>
            Proposer une correspondance
          </Button>
        )}
      </Group>
      <DataTable label="Correspondances de la bibliothèque, défilement horizontal possible">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Exigence source</Table.Th>
              <Table.Th>Exigence cible</Table.Th>
              <Table.Th>Correspondance</Table.Th>
              <Table.Th>État</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(liste.data ?? []).map((m) => (
              <Table.Tr key={m.id}>
                <Table.Td>{extremite(m.source)}</Table.Td>
                <Table.Td>{extremite(m.target)}</Table.Td>
                <Table.Td>
                  <Text>
                    {TYPES_CORRESPONDANCE[m.type] ?? m.type} · {m.coverage} %
                  </Text>
                  <Text size="xs" c="dimmed">
                    {m.justification}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <StatusChip etat={STATUTS[m.status].etat}>{STATUTS[m.status].libelle}</StatusChip>
                  {m.validatedBy && (
                    <Text size="xs" c="dimmed">
                      par {m.validatedBy}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {administrer && m.status === 'proposed' && (
                      <Button
                        size="xs"
                        aria-label={`Valider la correspondance ${m.source.requirementId} vers ${m.target.requirementId}`}
                        onClick={() => setDecision({ m, action: 'validate' })}
                      >
                        Valider
                      </Button>
                    )}
                    {administrer && m.status !== 'withdrawn' && (
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`Retirer la correspondance ${m.source.requirementId} vers ${m.target.requirementId}`}
                        onClick={() => setDecision({ m, action: 'withdraw' })}
                      >
                        Retirer
                      </Button>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataTable>
      {liste.data && !liste.data.length && <Text>Aucune correspondance dans cet état.</Text>}
      <Modal opened={!!formulaire} onClose={() => setFormulaire(null)} size="lg" title="Proposer une correspondance">
        {formulaire && (
          <Stack>
            <ErrorAlert error={erreur} />
            <ExtremiteChamps
              titre="Source"
              valeur={formulaire.source}
              referentiels={referentiels.data ?? []}
              onChange={(v) => champ('source', v)}
            />
            <ExtremiteChamps
              titre="Cible"
              valeur={formulaire.target}
              referentiels={referentiels.data ?? []}
              onChange={(v) => champ('target', v)}
            />
            <Select
              label="Nature de la correspondance"
              allowDeselect={false}
              data={Object.entries(TYPES_CORRESPONDANCE).map(([value, label]) => ({ value, label }))}
              value={formulaire.type}
              onChange={(v) => champ('type', v ?? 'equivalent')}
            />
            <NumberInput
              label="Couverture (%)"
              min={0}
              max={100}
              allowDecimal={false}
              value={formulaire.coverage}
              onChange={(v) => champ('coverage', Number(v) || 0)}
            />
            <Textarea
              label="Justification"
              description="10 caractères au moins."
              value={formulaire.justification}
              onChange={(e) => champ('justification', e.currentTarget.value)}
            />
            <TextInput
              label="Source de la correspondance (adresse https)"
              value={formulaire.sourceUrl}
              onChange={(e) => champ('sourceUrl', e.currentTarget.value)}
            />
            <Select
              label="Origine"
              allowDeselect={false}
              data={[
                { value: 'human', label: 'Rédigée par une personne' },
                { value: 'ai', label: 'Suggérée par une IA (à valider par une personne)' },
              ]}
              value={formulaire.origin}
              onChange={(v) => champ('origin', v ?? 'human')}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setFormulaire(null)}>
                Annuler
              </Button>
              <Button disabled={!complet} onClick={proposer}>
                Proposer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
      <Modal
        opened={!!decision}
        onClose={() => setDecision(null)}
        title={decision?.action === 'validate' ? 'Valider la correspondance' : 'Retirer la correspondance'}
      >
        <Stack>
          <ErrorAlert error={erreur} />
          <Textarea
            label="Motif"
            description="10 caractères au moins ; conservé dans l’historique de la correspondance."
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDecision(null)}>
              Annuler
            </Button>
            <Button disabled={note.trim().length < 10} onClick={decider}>
              {decision?.action === 'validate' ? 'Valider' : 'Retirer'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

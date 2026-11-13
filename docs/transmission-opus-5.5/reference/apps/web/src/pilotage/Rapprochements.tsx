/* Rapprochements à valider (ADR 0031, lot M3) : le système PROPOSE qu'une mesure déjà reliée à une exigence couvre aussi
   l'exigence équivalente d'un autre référentiel, selon une correspondance validée. Le pilote confirme (un lien explicite
   est créé) ou rejette (le motif est conservé). Tant qu'il n'a pas décidé, rien n'est compté comme couverture. */
import { Alert, Button, Checkbox, Group, Modal, SegmentedControl, Stack, Table, Text, Textarea } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { DataTable, StatusChip } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';

export const TYPES_CORRESPONDANCE: Record<string, string> = {
  identical: 'Identique',
  equivalent: 'Équivalente',
  partial: 'Partielle',
  complementary: 'Complémentaire',
  related: 'Liée',
  none: 'Aucune',
};
interface Exigence {
  ref: string;
  framework: string;
  requirementId: string;
  title: string;
}
interface Proposition {
  id: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'withdrawn';
  coverage: number;
  mappingType: string;
  justification: string;
  validatedBy: string | null;
  measure: { ref: string; name: string };
  source: Exigence;
  target: Exigence;
  decidedBy: string | null;
  decisionNote: string;
}
const STATUTS = { pending: 'À valider', confirmed: 'Confirmés', rejected: 'Rejetés' } as const;
const exigence = (e: Exigence) => (
  <>
    <Text size="xs" c="dimmed">
      {e.framework}
    </Text>
    <Text>
      <b>{e.requirementId}</b> · {e.title}
    </Text>
  </>
);

export function Rapprochements({ smsi }: { smsi: string }) {
  const can = useCan(),
    qc = useQueryClient(),
    decider = can('pilotage', 'modifier'),
    [statut, setStatut] = useState<keyof typeof STATUTS>('pending'),
    [choix, setChoix] = useState<Set<string>>(new Set()),
    [rejet, setRejet] = useState<string[] | null>(null),
    [motif, setMotif] = useState(''),
    [erreur, setErreur] = useState<unknown>(null),
    [echecs, setEchecs] = useState<string[]>([]);
  const liste = useQuery({
    queryKey: ['grc', smsi, 'rapprochements', 'liste', statut],
    queryFn: () => get<Proposition[]>(`/api/grc/${smsi}/rapprochements?status=${statut}`),
  });
  const rafraichir = async () => {
    await qc.invalidateQueries({ queryKey: ['grc', smsi] });
    setChoix(new Set());
  };
  const decision = async (ids: string[], d: 'confirm' | 'reject', note: string) => {
    try {
      setErreur(null);
      const r = await api<{ results: { id: string; ok: boolean; error?: string }[] }>(
        'POST',
        `/api/grc/${smsi}/rapprochements/decision`,
        { body: { ids, decision: d, note, confirm: 'DECIDER' } },
      );
      setEchecs(r.results.filter((x) => !x.ok).map((x) => x.error ?? 'Échec'));
      await rafraichir();
    } catch (e) {
      setErreur(e);
    }
  };
  const actualiser = async () => {
    try {
      setErreur(null);
      await api('POST', `/api/grc/${smsi}/rapprochements/sync`);
      await rafraichir();
    } catch (e) {
      setErreur(e);
    }
  };
  const lignes = liste.data ?? [];
  const bascule = (id: string) =>
    setChoix((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <Stack>
      <Alert>
        Une mesure déjà reliée à une exigence peut couvrir l’exigence équivalente d’un autre référentiel, selon une
        correspondance validée de la bibliothèque. Ces rapprochements sont seulement proposés : tant que vous ne les
        confirmez pas, ils ne comptent pas comme couverture. Confirmer crée un lien explicite en votre nom ; rejeter
        conserve votre motif.
      </Alert>
      <ErrorAlert error={erreur ?? liste.error} />
      {echecs.length > 0 && (
        <Alert color="orange" title="Certaines décisions n’ont pas pu être enregistrées">
          {echecs.map((e, i) => (
            <Text key={i}>{e}</Text>
          ))}
        </Alert>
      )}
      <Group justify="space-between">
        <SegmentedControl
          aria-label="État des rapprochements"
          value={statut}
          onChange={(v) => {
            setStatut(v as keyof typeof STATUTS);
            setChoix(new Set());
          }}
          data={Object.entries(STATUTS).map(([value, label]) => ({ value, label }))}
        />
        {decider && (
          <Button variant="default" onClick={actualiser}>
            Actualiser les propositions
          </Button>
        )}
      </Group>
      {decider && statut === 'pending' && lignes.length > 0 && (
        <Group>
          <Button disabled={!choix.size} onClick={() => decision([...choix], 'confirm', '')}>
            Confirmer la sélection ({choix.size})
          </Button>
          <Button variant="default" disabled={!choix.size} onClick={() => setRejet([...choix])}>
            Rejeter la sélection
          </Button>
        </Group>
      )}
      <DataTable label="Rapprochements proposés, défilement horizontal possible">
        <Table>
          <Table.Thead>
            <Table.Tr>
              {decider && statut === 'pending' && <Table.Th>Sélection</Table.Th>}
              <Table.Th>Mesure</Table.Th>
              <Table.Th>Déjà couverte</Table.Th>
              <Table.Th>Rapprochement proposé</Table.Th>
              <Table.Th>Correspondance</Table.Th>
              <Table.Th>{statut === 'pending' ? 'Décision' : 'Décidé par'}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lignes.map((p) => (
              <Table.Tr key={p.id}>
                {decider && statut === 'pending' && (
                  <Table.Td>
                    <Checkbox
                      aria-label={`Sélectionner le rapprochement vers ${p.target.requirementId} pour ${p.measure.name}`}
                      checked={choix.has(p.id)}
                      onChange={() => bascule(p.id)}
                    />
                  </Table.Td>
                )}
                <Table.Td>{p.measure.name || p.measure.ref}</Table.Td>
                <Table.Td>{exigence(p.source)}</Table.Td>
                <Table.Td>{exigence(p.target)}</Table.Td>
                <Table.Td>
                  <StatusChip etat={p.mappingType === 'partial' || p.mappingType === 'related' ? 'info' : 'neutre'}>
                    {TYPES_CORRESPONDANCE[p.mappingType] ?? p.mappingType} · {p.coverage} %
                  </StatusChip>
                  <Text size="xs" c="dimmed">
                    {p.justification}
                    {p.validatedBy ? ` — validée par ${p.validatedBy}` : ''}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {p.status === 'pending' ? (
                    decider ? (
                      <Group gap="xs">
                        <Button
                          size="xs"
                          aria-label={`Confirmer le rapprochement vers ${p.target.requirementId} pour ${p.measure.name}`}
                          onClick={() => decision([p.id], 'confirm', '')}
                        >
                          Confirmer
                        </Button>
                        <Button
                          size="xs"
                          variant="default"
                          aria-label={`Rejeter le rapprochement vers ${p.target.requirementId} pour ${p.measure.name}`}
                          onClick={() => setRejet([p.id])}
                        >
                          Rejeter
                        </Button>
                      </Group>
                    ) : (
                      'En attente'
                    )
                  ) : (
                    <>
                      <Text>{p.decidedBy}</Text>
                      {p.decisionNote && (
                        <Text size="xs" c="dimmed">
                          {p.decisionNote}
                        </Text>
                      )}
                    </>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataTable>
      {liste.data && !lignes.length && (
        <Text>{statut === 'pending' ? 'Aucun rapprochement à valider.' : 'Aucun rapprochement dans cet état.'}</Text>
      )}
      <Modal opened={!!rejet} onClose={() => setRejet(null)} title="Rejeter le rapprochement">
        <Stack>
          <Textarea
            label="Motif du rejet"
            description="5 caractères au moins ; conservé avec la décision."
            value={motif}
            onChange={(e) => setMotif(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRejet(null)}>
              Annuler
            </Button>
            <Button
              disabled={motif.trim().length < 5}
              onClick={async () => {
                const ids = rejet!;
                setRejet(null);
                await decision(ids, 'reject', motif.trim());
                setMotif('');
              }}
            >
              Rejeter
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

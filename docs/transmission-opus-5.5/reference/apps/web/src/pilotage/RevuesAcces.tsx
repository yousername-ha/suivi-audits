/* Revues des accès (reprise de la page de l'outil de suivi) : contrôles de la gestion des accès des applications,
   revue annuelle (politique fournisseurs ; ReCyF 10.A.6 et 10.C.4). Le mois de la dernière revue est relevé sur l'outil de
   contrôle ; la prochaine échéance et l'état se calculent comme dans l'outil historique. */
import { Button, Card, Group, Select, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { revueEtat, revueSuivante, revuesSynthese, type NiveauRevue, type RevueAcces } from '@suivi/shared';
import { DataTable, StatusChip, type Etat } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';

interface Donnees {
  version: number;
  revues: RevueAcces[];
  fournisseurs: string[];
}
const ETAT: Record<NiveauRevue, Etat> = { ok: 'succes', mid: 'attention', bad: 'erreur' };
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function RevuesAcces() {
  const can = useCan(),
    modifiable = can('pilotage', 'modifier'),
    qc = useQueryClient(),
    [erreur, setErreur] = useState<unknown>(null);
  const q = useQuery({ queryKey: ['revues-acces'], queryFn: () => get<Donnees>('/api/revues-acces') });
  const d = q.data;
  const agir = async (methode: string, url: string, body?: unknown) => {
    try {
      setErreur(null);
      await api(methode, url, body === undefined ? {} : { body });
      await qc.invalidateQueries({ queryKey: ['revues-acces'] });
      await qc.invalidateQueries({ queryKey: ['synthese'] });
    } catch (e) {
      setErreur(e);
    }
  };
  const jour = aujourdhui();
  const s = d ? revuesSynthese(d.revues, jour) : null;
  const modifier = (r: RevueAcces, champ: Partial<RevueAcces>) =>
    agir('PATCH', `/api/revues-acces/${encodeURIComponent(r.id)}`, champ);
  return (
    <Stack>
      <ErrorAlert error={q.error ?? erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Revues des accès</Text>
          <Text size="sm" c="dimmed">
            Contrôles de la gestion des accès, revue annuelle (politique fournisseurs ; ReCyF 10.A.6 et 10.C.4). Mois de
            la dernière revue relevé sur l’outil de contrôle.
          </Text>
        </div>
        {modifiable && <Button onClick={() => void agir('POST', '/api/revues-acces')}>Ajouter une revue</Button>}
      </Group>
      {s && (
        <Group>
          {[
            [`${s.aJour}/${s.total}`, 'à jour'],
            [s.jamais, 'jamais réalisées'],
            [s.enRetard, 'en retard'],
            [s.aPlanifier, 'à planifier sous 2 mois'],
          ].map(([n, l]) => (
            <Card key={String(l)} withBorder padding="xs">
              <Text fw={700} size="lg">
                {n}
              </Text>
              <Text size="xs" c="dimmed">
                {l}
              </Text>
            </Card>
          ))}
        </Group>
      )}
      {d && !d.revues.length && <Text size="sm">Aucune revue des accès.</Text>}
      {d && d.revues.length > 0 && (
        <DataTable label="Revues des accès">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Contrôle</Table.Th>
                <Table.Th>Application</Table.Th>
                <Table.Th className="col-p2">Fournisseur</Table.Th>
                <Table.Th>Dernière revue</Table.Th>
                <Table.Th>Prochaine</Table.Th>
                <Table.Th>État</Table.Th>
                <Table.Th className="col-p3">Commentaire</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {d.revues.map((r) => {
                const [libelle, niveau] = revueEtat(r, jour);
                const suivante = revueSuivante(r);
                return (
                  <Table.Tr key={r.id}>
                    <Table.Td>
                      <b>{r.id}</b>
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        aria-label={`Application de ${r.id}`}
                        disabled={!modifiable}
                        defaultValue={r.app}
                        onBlur={(e) => {
                          const v = e.currentTarget.value.trim();
                          if (v && v !== r.app) void modifier(r, { app: v });
                        }}
                      />
                    </Table.Td>
                    <Table.Td className="col-p2">
                      <Select
                        aria-label={`Fournisseur de ${r.id}`}
                        clearable
                        placeholder="–"
                        disabled={!modifiable}
                        data={[...new Set([...d.fournisseurs, ...(r.supplier ? [r.supplier] : [])])]}
                        value={r.supplier || null}
                        onChange={(v) => void modifier(r, { supplier: v ?? '' })}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        aria-label={`Dernière revue de ${r.id}`}
                        type="month"
                        disabled={!modifiable}
                        defaultValue={r.month}
                        onBlur={(e) => {
                          if (e.currentTarget.value !== r.month) void modifier(r, { month: e.currentTarget.value });
                        }}
                      />
                    </Table.Td>
                    <Table.Td>{suivante ? suivante.libelle : 'Dès que possible'}</Table.Td>
                    <Table.Td>
                      <StatusChip etat={ETAT[niveau]}>{libelle}</StatusChip>
                    </Table.Td>
                    <Table.Td className="col-p3">
                      <Textarea
                        aria-label={`Commentaire de ${r.id}`}
                        autosize
                        minRows={1}
                        disabled={!modifiable}
                        defaultValue={r.comment}
                        onBlur={(e) => {
                          if (e.currentTarget.value !== r.comment) void modifier(r, { comment: e.currentTarget.value });
                        }}
                      />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
    </Stack>
  );
}

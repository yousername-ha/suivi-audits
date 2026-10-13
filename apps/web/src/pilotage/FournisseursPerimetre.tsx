/* Fournisseurs rattachés au périmètre affiché (ADR 0032, lot M4) : lecture, sans copie. La même évaluation courante
   apparaît dans tous les périmètres où le fournisseur est rattaché ; ces chiffres aident à piloter, ils ne mesurent pas
   une conformité. */
import { Alert, Card, Group, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { DataTable, StatusChip } from '@suivi/ui';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import type { Fournisseur } from './Fournisseurs';

interface Lecture {
  suppliers: Fournisseur[];
  summary: { attached: number; evaluated: number; notEvaluated: number; toReview: number };
}

export function FournisseursPerimetre({ smsi }: { smsi: string }) {
  const q = useQuery({
    queryKey: ['grc', smsi, 'suppliers'],
    queryFn: () => get<Lecture>(`/api/grc/${smsi}/suppliers`),
  });
  const s = q.data?.summary;
  return (
    <Stack>
      <Alert>
        Seuls les fournisseurs rattachés à ce périmètre sont listés. Leur évaluation est celle de l’organisation : elle
        est identique dans tous les périmètres. Le rattachement se gère dans{' '}
        <Text component={Link} to="/pilotage/fournisseurs" inherit td="underline">
          les fournisseurs de l’organisation
        </Text>
        .
      </Alert>
      <ErrorAlert error={q.error} />
      {s && (
        <Group>
          <Card withBorder>
            <Text size="sm">Rattachés</Text>
            <Text fw={700}>{s.attached}</Text>
          </Card>
          <Card withBorder>
            <Text size="sm">Évalués</Text>
            <Text fw={700}>{s.evaluated}</Text>
          </Card>
          <Card withBorder>
            <Text size="sm">Non évalués</Text>
            <Text fw={700}>{s.notEvaluated}</Text>
          </Card>
          <Card withBorder>
            <Text size="sm">À réévaluer</Text>
            <Text fw={700}>{s.toReview}</Text>
          </Card>
        </Group>
      )}
      <DataTable label="Fournisseurs rattachés au périmètre, défilement horizontal possible">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fournisseur</Table.Th>
              <Table.Th>Évaluation courante</Table.Th>
              <Table.Th>Réévaluation</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(q.data?.suppliers ?? []).map((f) => (
              <Table.Tr key={f.id}>
                <Table.Td>
                  <Text fw={600}>{f.name}</Text>
                </Table.Td>
                <Table.Td>
                  {f.current ? (
                    `Le ${f.current.evaluatedAt} · ${f.current.meets} répond · ${f.current.notMeets} ne répond pas · ${f.current.notAssessed} non évalué`
                  ) : (
                    <StatusChip etat="neutre">Non évalué</StatusChip>
                  )}
                </Table.Td>
                <Table.Td>
                  {f.current?.nextReviewAt ?? '—'} {f.toReview && <StatusChip etat="erreur">À réévaluer</StatusChip>}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataTable>
      {q.data && !q.data.suppliers.length && <Text>Aucun fournisseur n’est rattaché à ce périmètre.</Text>}
    </Stack>
  );
}

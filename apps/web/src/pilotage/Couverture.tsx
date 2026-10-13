/* Vue commune (ADR 0031, lot M3) : pour chaque référentiel rattaché au périmètre, les exigences couvertes explicitement par
   une mesure, les rapprochements à valider et les exigences non couvertes. Indicateurs d'aide au pilotage : ni un taux de
   conformité, ni une preuve de conformité à un référentiel. */
import { Alert, Card, Group, Select, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DataTable, StatusChip, type Etat } from '@suivi/ui';
import { get } from '../api';
import { ErrorAlert } from '../components/common';

interface Referentiel {
  frameworkId: string;
  name: string;
  version: number;
  requirements: number;
  covered: number;
  toValidate: number;
  uncovered: number;
}
interface Detail {
  id: string;
  title: string;
  status: 'covered' | 'to_validate' | 'uncovered';
  measures: { ref: string; name: string }[];
}
const ETATS: Record<Detail['status'], { etat: Etat; libelle: string }> = {
  covered: { etat: 'succes', libelle: 'Couverte par une mesure' },
  to_validate: { etat: 'attention', libelle: 'Rapprochement à valider' },
  uncovered: { etat: 'neutre', libelle: 'Non couverte' },
};

export function Couverture({ smsi }: { smsi: string }) {
  const [choix, setChoix] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['grc', smsi, 'couverture', choix],
    queryFn: () =>
      get<{ frameworks: Referentiel[]; detail: Detail[] | null }>(
        `/api/grc/${smsi}/couverture${choix ? `?frameworkId=${choix}` : ''}`,
      ),
  });
  const frameworks = q.data?.frameworks ?? [];
  return (
    <Stack>
      <Alert>
        Une exigence est « couverte » quand une mesure la met en œuvre par un lien explicite. Un rapprochement non
        encore décidé est affiché à part et n’est pas compté. Ces chiffres aident à piloter : ils ne constituent ni un
        taux de conformité ni une preuve de conformité à un référentiel.
      </Alert>
      <ErrorAlert error={q.error} />
      {q.data && !frameworks.length && (
        <Text>
          Aucun référentiel de la bibliothèque n’est rattaché et actif dans ce périmètre (page Périmètres, bouton «
          Référentiels »).
        </Text>
      )}
      <Stack>
        {frameworks.map((f) => (
          <Card key={f.frameworkId} withBorder>
            <Text fw={600}>{f.name}</Text>
            <Text size="sm" c="dimmed">
              Version {f.version} · {f.requirements} exigence(s)
            </Text>
            <Group mt="sm" gap="xs">
              <StatusChip etat="succes">{f.covered} couverte(s)</StatusChip>
              <StatusChip etat="attention">{f.toValidate} à valider</StatusChip>
              <StatusChip etat="neutre">{f.uncovered} non couverte(s)</StatusChip>
            </Group>
          </Card>
        ))}
      </Stack>
      {frameworks.length > 0 && (
        <Select
          label="Détail par exigence"
          placeholder="Choisir un référentiel"
          clearable
          data={frameworks.map((f) => ({ value: f.frameworkId, label: f.name }))}
          value={choix}
          onChange={setChoix}
        />
      )}
      {q.data?.detail && (
        <DataTable label="Exigences du référentiel, défilement horizontal possible">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Exigence</Table.Th>
                <Table.Th>État</Table.Th>
                <Table.Th>Mesures</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {q.data.detail.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <b>{r.id}</b> · {r.title}
                  </Table.Td>
                  <Table.Td>
                    <StatusChip etat={ETATS[r.status].etat}>{ETATS[r.status].libelle}</StatusChip>
                  </Table.Td>
                  <Table.Td>{r.measures.map((m) => m.name || m.ref).join(', ') || '—'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
    </Stack>
  );
}

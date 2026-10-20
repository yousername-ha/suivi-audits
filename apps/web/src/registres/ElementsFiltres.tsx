/* Éléments des registres d'un périmètre (R02) : on choisit un périmètre, puis un ou plusieurs registres qui le portent ;
   la liste réunit leurs éléments sans doublon (chaque élément n'appartient qu'à un registre). */
import { Group, MultiSelect, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { REGISTRE_LABELS, type GrcObject, type RegistreDto } from '@suivi/shared';
import { DataTable } from '@suivi/ui';
import { get } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';

const ELEMENT_LABELS: Record<string, string> = {
  action: 'Action',
  nonconformity: 'Écart',
  task_series: 'Série de tâches',
};

export function ElementsFiltres() {
  const perimetres = useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () => get<{ id: string; name: string }[]>('/api/grc/smsis'),
  });
  const [perimetre, setPerimetre] = useState<string | null>(null);
  const [choisis, setChoisis] = useState<string[]>([]);
  const [recherche, setRecherche] = useState('');
  const liste = useQuery({
    queryKey: ['registres', 'elements-filtres', perimetre, choisis, recherche],
    queryFn: () =>
      get<{ registres: RegistreDto[]; items: GrcObject[]; total: number }>(
        `/api/registres/elements?perimetre=${perimetre}&registres=${choisis.join(',')}&search=${encodeURIComponent(recherche)}`,
      ),
    enabled: !!perimetre,
  });
  const nomRegistre = (id?: string | null) => liste.data?.registres.find((r) => r.id === id)?.name ?? '—';
  return (
    <Stack>
      <Group align="end">
        <Select
          label="Périmètre"
          placeholder="Choisir un périmètre"
          searchable
          data={(perimetres.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
          value={perimetre}
          onChange={(v) => {
            setPerimetre(v);
            setChoisis([]);
          }}
        />
        <MultiSelect
          label="Registres"
          placeholder={perimetre ? 'Tous les registres du périmètre' : 'Choisissez d’abord un périmètre'}
          disabled={!perimetre}
          searchable
          data={(liste.data?.registres ?? []).map((r) => ({
            value: r.id,
            label: `${r.name} (${REGISTRE_LABELS[r.kind]})`,
          }))}
          value={choisis}
          onChange={setChoisis}
        />
        <TextInput
          label="Rechercher un élément"
          value={recherche}
          onChange={(e) => setRecherche(e.currentTarget.value)}
        />
      </Group>
      <ErrorAlert error={liste.error} />
      {perimetre && liste.data && (
        <Text size="sm">
          {liste.data.total} élément(s) dans {liste.data.registres.length} registre(s) concerné(s).
        </Text>
      )}
      <DataTable label="Éléments des registres du périmètre, défilement horizontal possible">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Élément</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Registre</Table.Th>
              <Table.Th>Mis à jour</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(liste.data?.items ?? []).map((o) => (
              <Table.Tr key={o.id}>
                <Table.Td>{o.name}</Table.Td>
                <Table.Td>{ELEMENT_LABELS[o.kind] ?? o.kind}</Table.Td>
                <Table.Td>
                  <Text component={Link} to={`/registres/${o.registreId}`}>
                    {nomRegistre(o.registreId)}
                  </Text>
                </Table.Td>
                <Table.Td>{fmtDate(o.updatedAt)}</Table.Td>
              </Table.Tr>
            ))}
            {liste.data && !liste.data.items.length && (
              <Table.Tr>
                <Table.Td colSpan={4}>Aucun élément.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </DataTable>
    </Stack>
  );
}

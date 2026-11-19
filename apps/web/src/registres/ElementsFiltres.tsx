/* Éléments des registres d'un périmètre (R02) : on choisit un périmètre, puis un ou plusieurs registres qui le portent ;
   la liste réunit leurs éléments sans doublon (chaque élément n'appartient qu'à un registre). Boîte d'outils commune
   (7.3.0) : le choix du périmètre, premier geste de la page, reste visible à côté de la boîte (décision du RSSI du
   18/11/2026) ; recherche dans la boîte, registres dans les filtres avancés, pastilles des registres choisis dessous. */
import { MultiSelect, Select, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { REGISTRE_LABELS, type GrcObject, type RegistreDto } from '@suivi/shared';
import { DataTable } from '@suivi/ui';
import { get } from '../api';
import { BoiteOutils, PastillesCriteres, type CritereActif } from '../components/BarreOutils';
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
  // Les filtres avancés ne portent plus que les registres : les réinitialiser garde le périmètre choisi.
  const reinitialiser = () => setChoisis([]);
  const criteres: CritereActif[] = choisis.map((id) => ({
    cle: 'registre-' + id,
    libelle: 'Registre',
    valeur: liste.data?.registres.find((r) => r.id === id)?.name ?? 'sélectionné',
    retirer: () => setChoisis(choisis.filter((c) => c !== id)),
  }));
  return (
    <Stack>
      <div className="barre-avec-perimetre">
        <Select
          className="selecteur-perimetre"
          allowDeselect={false}
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
        <BoiteOutils
          label="Outils des éléments par périmètre"
          recherche={{ label: 'Rechercher un élément', value: recherche, onChange: setRecherche }}
          filtres={{
            actifs: choisis.length ? 1 : 0,
            onReinitialiser: reinitialiser,
            contenu: (
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
                comboboxProps={{ withinPortal: false }}
              />
            ),
          }}
        />
      </div>
      <PastillesCriteres criteres={criteres} onToutEffacer={reinitialiser} />
      <ErrorAlert error={liste.error} />
      {!perimetre && <Text size="sm">Choisissez un périmètre pour afficher ses éléments.</Text>}
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

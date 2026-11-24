/* Fiche du fournisseur, onglet « Machines et responsabilités » : groupes de machines maintenus par le fournisseur (maquette
   validée par le RSSI le 23/11/2026 ; route du lot GRP-MACHINES, ADR 0100). Sans aucun détail de machine : nom et description
   du groupe, machines que la personne lit, mention quand d'autres lui échappent, failles critiques ouvertes de ces seules
   machines (décision du RSSI du 23/11/2026), lien vers le parc filtré sur le groupe. Section affichée seulement avec le droit
   de lire le module Vulnérabilités ; le rattachement se fait depuis la fenêtre du groupe. */
import { Stack, Table, Text, Title, VisuallyHidden } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import type { GroupesDuFournisseur } from '@suivi/shared';
import { DataTable } from '@suivi/ui';
import { ApiError, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';

export const urlGroupesDuFournisseur = (id: string) =>
  `/api/vulnerabilites/fournisseurs/${encodeURIComponent(id)}/groupes`;
export const lienParcDuGroupe = (id: string) => `/vulnerabilites/machines?groupe=${encodeURIComponent(id)}`;

/** Nombre de machines lues, avec la mention des machines hors de la lecture de la personne (sans nombre). */
export function libelleMachinesLues(n: number, horsLecture: boolean): string {
  const base = `${n} machine${n > 1 ? 's' : ''}`;
  return horsLecture ? `${base} (d’autres hors de votre lecture)` : base;
}

/** Module désactivé (409) ou droit retiré entre-temps (403) : la section se tait plutôt que d'afficher une erreur. */
const silencieuse = (e: unknown) => e instanceof ApiError && (e.status === 403 || e.status === 409);

export function GroupesDuFournisseurSection({ fournisseurId }: { fournisseurId: string }) {
  const can = useCan();
  const visible = can('vulnerabilites', 'lire') && can('fournisseurs', 'lire');
  const q = useQuery({
    queryKey: ['vulnerabilites', 'groupes', 'fournisseur', fournisseurId],
    queryFn: () => get<GroupesDuFournisseur>(urlGroupesDuFournisseur(fournisseurId)),
    enabled: visible,
    retry: false,
  });
  if (!visible || (q.isError && silencieuse(q.error))) return null;
  const groupes = q.data?.groupes ?? [];
  return (
    <Stack gap="xs">
      <Title order={3} size="h5">
        Groupes de machines maintenus
      </Title>
      <Text size="sm" c="dimmed">
        Le rattachement d’un groupe à ce fournisseur se fait depuis la fenêtre du groupe (Vulnérabilités › Machines).
      </Text>
      <ErrorAlert error={q.isError ? q.error : null} />
      {q.isSuccess && !groupes.length && (
        <Text size="sm">Aucun groupe de machines n’est rattaché à ce fournisseur.</Text>
      )}
      {groupes.length > 0 && (
        <DataTable label="Groupes de machines maintenus par le fournisseur">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Groupe</Table.Th>
                <Table.Th scope="col">Machines</Table.Th>
                <Table.Th scope="col">Failles critiques ouvertes</Table.Th>
                <Table.Th scope="col">
                  <VisuallyHidden>Parc</VisuallyHidden>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {groupes.map((g) => (
                <Table.Tr key={g.id}>
                  <Table.Th scope="row">
                    {g.nom}
                    {g.description && (
                      <Text size="xs" c="dimmed">
                        {g.description}
                      </Text>
                    )}
                  </Table.Th>
                  <Table.Td>{libelleMachinesLues(g.machinesLues, g.horsLecture)}</Table.Td>
                  <Table.Td>
                    <Text
                      size="sm"
                      fw={g.faillesCritiquesOuvertes ? 600 : undefined}
                      c={g.faillesCritiquesOuvertes ? 'red' : undefined}
                    >
                      {g.faillesCritiquesOuvertes}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Link to={lienParcDuGroupe(g.id)} aria-label={`Voir le parc du groupe « ${g.nom} »`}>
                      Voir le parc
                    </Link>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
    </Stack>
  );
}

/* Droits attribués à un utilisateur ou à un groupe sur un registre ou sur un élément (ADR 0043). Réservé aux gestionnaires :
   l'API refuse tout autre appel ; l'écran n'affiche ce composant qu'à eux. */
import { Button, Group, Select, Stack, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ROLE_LABELS, ROLES_RESSOURCE, type RoleRessource } from '@suivi/shared';
import { ConfirmButton, DataTable } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';

interface Droit {
  id: string;
  subjectType: 'utilisateur' | 'groupe';
  subjectId: string;
  role: RoleRessource;
  libelle: string;
  grantedBy: string;
  grantedAt: string;
}
const ROLE_OPTIONS = ROLES_RESSOURCE.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

export function Droits({ type, id }: { type: 'registre' | 'objet'; id: string }) {
  const cible = type === 'registre' ? 'le registre' : 'l’élément';
  const qc = useQueryClient();
  const droits = useQuery({
    queryKey: ['droits', type, id],
    queryFn: () => get<{ items: Droit[] }>(`/api/droits/${type}/${id}`),
  });
  const [recherche, setRecherche] = useState('');
  const titulaires = useQuery({
    queryKey: ['droits', type, id, 'titulaires', recherche],
    queryFn: () =>
      get<{ utilisateurs: { id: string; libelle: string }[]; groupes: { id: string; libelle: string }[] }>(
        `/api/droits/${type}/${id}/titulaires?q=${encodeURIComponent(recherche)}`,
      ),
  });
  const [titulaire, setTitulaire] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>('contributeur');
  const [erreur, setErreur] = useState<unknown>(null);
  const options = [
    {
      group: 'Utilisateurs',
      items: (titulaires.data?.utilisateurs ?? []).map((u) => ({ value: `utilisateur:${u.id}`, label: u.libelle })),
    },
    {
      group: 'Groupes',
      items: (titulaires.data?.groupes ?? []).map((g) => ({ value: `groupe:${g.id}`, label: g.libelle })),
    },
  ];
  const rafraichir = () => qc.invalidateQueries({ queryKey: ['droits', type, id] });
  const accorder = async () => {
    if (!titulaire || !role) return;
    const [subjectType, subjectId] = titulaire.split(':');
    setErreur(null);
    try {
      await api('PUT', `/api/droits/${type}/${id}`, { body: { subjectType, subjectId, role } });
      setTitulaire(null);
      await rafraichir();
      notifications.show({ color: 'teal', message: 'Droit enregistré.' });
    } catch (e) {
      setErreur(e);
    }
  };
  const retirer = async (d: Droit) => {
    setErreur(null);
    try {
      await api('DELETE', `/api/droits/${type}/${id}/${d.id}`);
      await rafraichir();
    } catch (e) {
      setErreur(e);
    }
  };
  return (
    <Stack>
      <Text>
        Lecteur : consulte. Contributeur : renseigne l’avancement (statut, compte rendu) sans modifier la définition
        d’un élément. Gestionnaire : modifie, archive et attribue les droits. Ces droits s’ajoutent aux droits de
        module.
      </Text>
      <ErrorAlert error={erreur ?? droits.error} />
      <DataTable label={`Droits attribués sur ${cible}, défilement horizontal possible`}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Titulaire</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Rôle</Table.Th>
              <Table.Th>Attribué par</Table.Th>
              <Table.Th>Action</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(droits.data?.items ?? []).map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td>{d.libelle}</Table.Td>
                <Table.Td>{d.subjectType === 'groupe' ? 'Groupe' : 'Utilisateur'}</Table.Td>
                <Table.Td>{ROLE_LABELS[d.role]}</Table.Td>
                <Table.Td>
                  {d.grantedBy}, {fmtDate(d.grantedAt)}
                </Table.Td>
                <Table.Td>
                  <ConfirmButton
                    size="xs"
                    variant="default"
                    aria-label={`Retirer le droit de ${d.libelle}`}
                    message={`${d.libelle} perd son rôle ${ROLE_LABELS[d.role].toLowerCase()} sur ${cible}.`}
                    onConfirm={() => retirer(d)}
                  >
                    Retirer
                  </ConfirmButton>
                </Table.Td>
              </Table.Tr>
            ))}
            {droits.data && !droits.data.items.length && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  Aucun droit attribué : l’accès suit les droits de module et les périmètres.
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </DataTable>
      <Group align="end">
        <Select
          label="Utilisateur ou groupe"
          searchable
          placeholder="Rechercher…"
          data={options}
          value={titulaire}
          onChange={setTitulaire}
          onSearchChange={setRecherche}
          filter={({ options: o }) => o}
        />
        <Select label="Rôle" allowDeselect={false} data={ROLE_OPTIONS} value={role} onChange={setRole} />
        <Button disabled={!titulaire || !role} onClick={() => void accorder()}>
          Attribuer
        </Button>
      </Group>
    </Stack>
  );
}

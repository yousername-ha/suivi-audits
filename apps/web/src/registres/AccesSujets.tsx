/* Vue des accès (dossier 022) : on choisit une personne ou un groupe, puis on lit pour chaque registre le rôle attribué, son
   origine et ce que la personne peut réellement faire. Tout est calculé par le serveur avec les contrôles réels : l'écran ne
   déduit aucun droit et ne modifie rien (les droits se donnent depuis la fiche du registre). */
import {
  Alert,
  Badge,
  Group,
  Pagination,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { REGISTRE_LABELS, ROLE_LABELS, type AccesSujetPage, type AccesSujetRegistre } from '@suivi/shared';
import { DataTable, StatusChip } from '@suivi/ui';
import { get } from '../api';
import { ErrorAlert } from '../components/common';

const PAGE = 25;
const SOURCES: Record<AccesSujetRegistre['source'], string> = {
  administrateur: 'Administrateur',
  role: 'Rôle de ressource',
  module: 'Droits de module et périmètres',
  aucune: 'Aucun accès',
};

export function AccesSujets() {
  const [type, setType] = useState<'utilisateur' | 'groupe'>('utilisateur');
  const [sujet, setSujet] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const personnes = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => get<{ id: string; username: string; display_name: string }[]>('/api/admin/users'),
    enabled: type === 'utilisateur',
  });
  const groupes = useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: () => get<{ id: string; name: string }[]>('/api/admin/groups'),
    enabled: type === 'groupe',
  });
  const choix =
    type === 'utilisateur'
      ? (personnes.data ?? []).map((u) => ({ value: u.id, label: u.display_name || u.username }))
      : (groupes.data ?? []).map((g) => ({ value: g.id, label: g.name }));
  const acces = useQuery({
    queryKey: ['droits', 'sujet', type, sujet, q, page],
    queryFn: () =>
      get<AccesSujetPage>(
        `/api/droits/sujets/${type}/${sujet}/registres?limite=${PAGE}&decalage=${(page - 1) * PAGE}&q=${encodeURIComponent(q)}`,
      ),
    enabled: !!sujet,
  });
  const pages = acces.data ? Math.max(1, Math.ceil(acces.data.total / PAGE)) : 1;
  return (
    <Stack>
      <Alert>
        Cette vue montre les accès tels que le serveur les calcule : rôle attribué sur le registre, origine (direct ou
        groupe) et droits réels de la personne. Elle ne modifie rien ; les droits se donnent depuis la fiche d’un
        registre.
      </Alert>
      <Group align="end">
        <SegmentedControl
          aria-label="Type de sujet"
          value={type}
          onChange={(v) => {
            setType(v as 'utilisateur' | 'groupe');
            setSujet(null);
            setPage(1);
          }}
          data={[
            { value: 'utilisateur', label: 'Personne' },
            { value: 'groupe', label: 'Groupe' },
          ]}
        />
        <Select
          label={type === 'utilisateur' ? 'Personne' : 'Groupe'}
          searchable
          placeholder="Choisir"
          data={choix}
          value={sujet}
          onChange={(v) => {
            setSujet(v);
            setPage(1);
          }}
          nothingFoundMessage="Aucun résultat"
        />
        <TextInput
          label="Nom du registre"
          placeholder="Filtrer"
          value={q}
          onChange={(e) => {
            setQ(e.currentTarget.value);
            setPage(1);
          }}
        />
      </Group>
      <ErrorAlert error={acces.error ?? personnes.error ?? groupes.error} />
      {!sujet && <Text c="dimmed">Choisissez une personne ou un groupe pour voir ses accès aux registres.</Text>}
      {acces.data && (
        <>
          <Text size="sm">
            {acces.data.total} registre(s) pour {acces.data.sujet.libelle}.
          </Text>
          <DataTable label="Accès aux registres, défilement horizontal possible">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Registre</Table.Th>
                  <Table.Th>Famille</Table.Th>
                  <Table.Th>Périmètres</Table.Th>
                  <Table.Th>Rôle attribué</Table.Th>
                  <Table.Th>Origine</Table.Th>
                  <Table.Th>Peut</Table.Th>
                  <Table.Th>Accès par</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {acces.data.items.map((a) => (
                  <Table.Tr key={a.registre.id}>
                    <Table.Td>
                      <Link to={`/registres/${a.registre.id}`}>{a.registre.name}</Link>{' '}
                      {a.registre.restreint && <Badge size="xs">Restreint</Badge>}
                    </Table.Td>
                    <Table.Td>{REGISTRE_LABELS[a.registre.kind]}</Table.Td>
                    <Table.Td>{a.registre.perimetres.map((p) => p.name).join(', ') || '—'}</Table.Td>
                    <Table.Td>{a.role ? ROLE_LABELS[a.role] : 'Aucun'}</Table.Td>
                    <Table.Td>{a.origines.length ? a.origines.map((o) => o.libelle).join(', ') : '—'}</Table.Td>
                    <Table.Td>
                      {a.peut ? (
                        <Group gap="2xs">
                          <StatusChip etat={a.peut.lire ? 'succes' : 'neutre'}>
                            Lire : {a.peut.lire ? 'oui' : 'non'}
                          </StatusChip>
                          <StatusChip etat={a.peut.contribuer ? 'succes' : 'neutre'}>
                            Contribuer : {a.peut.contribuer ? 'oui' : 'non'}
                          </StatusChip>
                          <StatusChip etat={a.peut.gerer ? 'succes' : 'neutre'}>
                            Gérer : {a.peut.gerer ? 'oui' : 'non'}
                          </StatusChip>
                        </Group>
                      ) : (
                        'Selon les personnes du groupe'
                      )}
                    </Table.Td>
                    <Table.Td>{SOURCES[a.source]}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </DataTable>
          {pages > 1 && <Pagination total={pages} value={page} onChange={setPage} aria-label="Pages d’accès" />}
        </>
      )}
    </Stack>
  );
}

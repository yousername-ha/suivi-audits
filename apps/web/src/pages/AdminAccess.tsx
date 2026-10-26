/* Administration des droits : utilisateurs, groupes, rôles (matrice modules × actions), droits effectifs,
   export de la revue des accès. L'affichage suit les droits de la session ; le serveur reste seul juge. */
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  ACTION_LABELS,
  ACTIONS,
  AUDITOR_MODULES,
  MODULE_LABELS,
  MODULES,
  type EffectiveRightsOut,
  type GroupOut,
  type Module,
  type Permission,
  type RoleAssignment,
  type RoleOut,
  type UserOut,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError, download, errorMessage, get } from '../api';
import { ConfirmButton, ErrorAlert, fmtDate, SecretModal } from '../components/common';
import { useColonnes, type Colonne } from '../components/Colonnes';
import { EditeurReglages } from '../notifications/Reglages';
import { useCan, useMe } from '../session';
import { DataTable } from '@suivi/ui';

const useRoles = () => useQuery({ queryKey: ['admin', 'roles'], queryFn: () => get<RoleOut[]>('/api/admin/roles') });
const useGroups = () =>
  useQuery({ queryKey: ['admin', 'groups'], queryFn: () => get<GroupOut[]>('/api/admin/groups') });
const useUsers = () => useQuery({ queryKey: ['admin', 'users'], queryFn: () => get<UserOut[]>('/api/admin/users') });
const SCOPED = 'auditeur_externe';
const moduleOptions = (mods: readonly Module[]) => mods.map((m) => ({ value: m, label: MODULE_LABELS[m] }));
const isExpired = (d: string | null) => !!d && new Date(d) <= new Date();

function useAct() {
  const qc = useQueryClient();
  return async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn();
      if (msg) notifications.show({ color: 'teal', message: msg });
      await qc.invalidateQueries({ queryKey: ['admin'] });
      return true;
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
      return false;
    }
  };
}

/* ================================================================ Utilisateurs */
interface UserForm {
  username: string;
  displayName: string;
  email: string;
  roles: string[];
  auditorModules: string[];
  groups: string[];
  expiresAt: string;
  disabled: boolean;
}

const COLONNES_COMPTES: Colonne[] = [
  { cle: 'compte', libelle: 'Compte', priorite: 1, fixe: true },
  { cle: 'roles', libelle: 'Rôles', priorite: 1 },
  { cle: 'groupes', libelle: 'Groupes', priorite: 2 },
  { cle: 'etat', libelle: 'État', priorite: 1 },
  { cle: 'connexion', libelle: 'Dernière connexion', priorite: 3 },
  { cle: 'actions', libelle: 'Actions', priorite: 1, fixe: true },
];

export function UsersPanel() {
  const { cls, selecteur } = useColonnes('comptes', COLONNES_COMPTES);
  const me = useMe();
  const can = useCan();
  const q = useUsers();
  const act = useAct();
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
  const [form, setForm] = useState<{ user: UserOut | null } | null>(null);
  const [rightsOf, setRightsOf] = useState<UserOut | null>(null);
  const [notifsOf, setNotifsOf] = useState<UserOut | null>(null);
  const admin = can('administration', 'administrer');

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          {admin && <Button onClick={() => setForm({ user: null })}>Nouveau compte</Button>}
          {selecteur}
        </Group>
        {can('administration', 'exporter') && (
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Revue des accès (ISO 27001 A.5.18) :
            </Text>
            <Button variant="light" size="sm" onClick={() => download('/api/admin/access-review?format=xlsx')}>
              Excel
            </Button>
            <Button variant="light" size="sm" onClick={() => download('/api/admin/access-review?format=csv')}>
              CSV
            </Button>
          </Group>
        )}
      </Group>
      <ErrorAlert error={q.error} />
      <DataTable label="Comptes">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Compte</Table.Th>
              <Table.Th className={cls('roles')}>Rôles</Table.Th>
              <Table.Th className={cls('groupes')}>Groupes</Table.Th>
              <Table.Th className={cls('etat')}>État</Table.Th>
              <Table.Th className={cls('connexion')}>Dernière connexion</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(q.data ?? []).map((u) => {
              const locked = !!(u.locked_until && new Date(u.locked_until) > new Date());
              return (
                <Table.Tr key={u.id}>
                  <Table.Td>
                    <Text fw={600}>{u.display_name}</Text>
                    <Text size="xs" c="dimmed">
                      {u.username} {u.email && `· ${u.email}`}
                    </Text>
                  </Table.Td>
                  <Table.Td className={cls('roles')}>
                    <Group gap="2xs">
                      {u.roles.map((r) => (
                        <Badge key={r.id} variant="light">
                          {r.name}
                          {r.modules ? ` (${r.modules.length} module${r.modules.length > 1 ? 's' : ''})` : ''}
                        </Badge>
                      ))}
                      {!u.roles.length && (
                        <Text size="xs" c="dimmed">
                          aucun rôle direct
                        </Text>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td className={cls('groupes')}>
                    <Group gap="2xs">
                      {u.groups.map((g) => (
                        <Badge key={g.id} variant="outline">
                          {g.name}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td className={cls('etat')}>
                    <Group gap="2xs">
                      {u.disabled && <Badge color="gray">désactivé</Badge>}
                      {u.expires_at && (
                        <Badge color={isExpired(u.expires_at) ? 'red' : 'violet'} variant="light">
                          {isExpired(u.expires_at) ? 'expiré' : 'expire le'} {u.expires_at.slice(0, 10)}
                        </Badge>
                      )}
                      {locked && <Badge color="red">verrouillé</Badge>}
                      {!u.totp_enabled && <Badge color="orange">TOTP à configurer</Badge>}
                      {u.must_change_password && <Badge color="yellow">mot de passe temporaire</Badge>}
                      {u.sessions > 0 && <Badge variant="light">{u.sessions} session(s)</Badge>}
                    </Group>
                  </Table.Td>
                  <Table.Td className={`${cls('connexion') ?? ''} nowrap`}>{fmtDate(u.last_login_at)}</Table.Td>
                  <Table.Td>
                    <Group gap="2xs" wrap="nowrap">
                      <Button size="compact-sm" variant="default" onClick={() => setRightsOf(u)}>
                        Droits effectifs
                      </Button>
                      <Button size="compact-sm" variant="default" onClick={() => setNotifsOf(u)}>
                        Notifications
                      </Button>
                      {admin && (
                        <>
                          <Button size="compact-sm" variant="default" onClick={() => setForm({ user: u })}>
                            Modifier
                          </Button>
                          <ConfirmButton
                            size="compact-sm"
                            variant="light"
                            color="orange"
                            message={`Générer un mot de passe temporaire pour ${u.username} ? Ses sessions seront fermées.`}
                            onConfirm={() =>
                              act(async () => {
                                const r = await api<{ temporaryPassword: string }>(
                                  'POST',
                                  `/api/admin/users/${u.id}/reset-password`,
                                );
                                setSecret({
                                  title: `Mot de passe temporaire de ${u.username}`,
                                  value: r.temporaryPassword,
                                });
                              })
                            }
                          >
                            Mot de passe
                          </ConfirmButton>
                          <ConfirmButton
                            size="compact-sm"
                            variant="light"
                            color="orange"
                            message={`Réinitialiser la double authentification de ${u.username} (téléphone perdu) ? Il devra la reconfigurer.`}
                            onConfirm={() =>
                              act(
                                () => api('POST', `/api/admin/users/${u.id}/reset-mfa`),
                                'Double authentification réinitialisée.',
                              )
                            }
                          >
                            TOTP
                          </ConfirmButton>
                          {locked && (
                            <Button
                              size="compact-sm"
                              variant="light"
                              onClick={() =>
                                act(
                                  () =>
                                    api('PATCH', `/api/admin/users/${u.id}`, {
                                      body: { unlock: true },
                                      ifMatch: u.version,
                                    }),
                                  'Compte déverrouillé.',
                                )
                              }
                            >
                              Déverrouiller
                            </Button>
                          )}
                        </>
                      )}
                      {can('administration', 'supprimer') && u.id !== me.user?.id && (
                        <ConfirmButton
                          size="compact-sm"
                          variant="light"
                          message={`Supprimer définitivement le compte ${u.username} ?`}
                          onConfirm={() => act(() => api('DELETE', `/api/admin/users/${u.id}`), 'Compte supprimé.')}
                        >
                          Supprimer
                        </ConfirmButton>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </DataTable>

      <Modal
        opened={!!form}
        onClose={() => setForm(null)}
        title={form?.user ? `Modifier ${form.user.username}` : 'Nouveau compte'}
        size="lg"
        centered
      >
        {form && (
          <UserEditor
            user={form.user}
            self={form.user?.id === me.user?.id}
            onCreated={(username, pw) => setSecret({ title: `Compte ${username} créé`, value: pw })}
            onDone={() => setForm(null)}
          />
        )}
      </Modal>
      <Modal
        opened={!!rightsOf}
        onClose={() => setRightsOf(null)}
        title={`Droits effectifs de ${rightsOf?.username ?? ''}`}
        size="xl"
        centered
      >
        {rightsOf && <EffectiveRights userId={rightsOf.id} />}
      </Modal>
      <Modal
        opened={!!notifsOf}
        onClose={() => setNotifsOf(null)}
        title={`Notifications de ${notifsOf?.username ?? ''}`}
        size="xl"
        centered
      >
        {notifsOf && (
          <EditeurReglages
            url={`/api/admin/notifications/reglages/utilisateur/${notifsOf.id}`}
            ecriture={admin}
            sujet="son"
            etiquette={`Réglages de notification de ${notifsOf.username}`}
            introduction="Un réglage explicite ici l’emporte sur les groupes et les rôles du compte ; « Non défini » laisse l’héritage jouer. La personne peut aussi modifier ces réglages dans Mon compte."
          />
        )}
      </Modal>
      <SecretModal
        title={secret?.title ?? ''}
        intro="Mot de passe temporaire (affiché une seule fois) :"
        secret={secret?.value ?? null}
        onClose={() => setSecret(null)}
      />
    </Stack>
  );
}

function UserEditor({
  user,
  self,
  onCreated,
  onDone,
}: {
  user: UserOut | null;
  self: boolean;
  onCreated: (username: string, pw: string) => void;
  onDone: () => void;
}) {
  const roles = useRoles();
  const groups = useGroups();
  const act = useAct();
  const scoped = user?.roles.find((r) => r.id === SCOPED);
  const [f, setF] = useState<UserForm>({
    username: user?.username ?? '',
    displayName: user?.display_name ?? '',
    email: user?.email ?? '',
    roles: user ? user.roles.map((r) => r.id) : ['lecteur'],
    auditorModules: scoped?.modules ?? [],
    groups: user ? user.groups.map((g) => g.id) : [],
    expiresAt: user?.expires_at?.slice(0, 10) ?? '',
    disabled: user?.disabled ?? false,
  });
  const [err, setErr] = useState<string | null>(null);
  const auditor = f.roles.includes(SCOPED);
  const assignments: RoleAssignment[] = f.roles.map((id) =>
    id === SCOPED ? { roleId: id, modules: f.auditorModules as Module[] } : { roleId: id },
  );

  const save = async () => {
    setErr(null);
    try {
      if (!user) {
        const r = await api<{ temporaryPassword: string }>('POST', '/api/admin/users', {
          body: {
            username: f.username,
            displayName: f.displayName,
            email: f.email,
            roles: assignments,
            groups: f.groups,
            expiresAt: f.expiresAt || null,
          },
        });
        onCreated(f.username, r.temporaryPassword);
      } else {
        await api('PATCH', `/api/admin/users/${user.id}`, {
          body: {
            displayName: f.displayName,
            email: f.email,
            ...(self
              ? {}
              : { roles: assignments, groups: f.groups, expiresAt: f.expiresAt || null, disabled: f.disabled }),
          },
          ifMatch: user.version,
        });
        notifications.show({
          color: 'teal',
          message: 'Compte modifié. Ses sessions ont été fermées si ses droits ont changé.',
        });
      }
      await act(async () => {});
      onDone();
    } catch (e) {
      setErr(
        e instanceof ApiError && e.status === 412
          ? `${e.message} Fermez cette fenêtre pour recharger.`
          : errorMessage(e),
      );
    }
  };

  return (
    <Stack>
      {err && (
        <Alert color="red" role="alert">
          {err}
        </Alert>
      )}
      {!user && (
        <TextInput
          label="Identifiant"
          required
          value={f.username}
          onChange={(e) => setF({ ...f, username: e.currentTarget.value })}
        />
      )}
      <TextInput
        label="Nom affiché"
        value={f.displayName}
        onChange={(e) => setF({ ...f, displayName: e.currentTarget.value })}
      />
      <TextInput
        label="Adresse e-mail"
        type="email"
        value={f.email}
        onChange={(e) => setF({ ...f, email: e.currentTarget.value })}
      />
      {self && (
        <Alert color="gray">Vous ne pouvez pas modifier vos propres droits : demandez à un autre administrateur.</Alert>
      )}
      <MultiSelect
        label="Rôles"
        description="Droits effectifs = rôles directs + rôles des groupes."
        data={(roles.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
        value={f.roles}
        onChange={(v) => setF({ ...f, roles: v })}
        disabled={self}
        searchable
      />
      {auditor && (
        <MultiSelect
          label="Modules ouverts à l’auditeur externe (lecture seule)"
          required
          data={moduleOptions(AUDITOR_MODULES)}
          value={f.auditorModules}
          onChange={(v) => setF({ ...f, auditorModules: v })}
          disabled={self}
        />
      )}
      <MultiSelect
        label="Groupes"
        data={(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
        value={f.groups}
        onChange={(v) => setF({ ...f, groups: v })}
        disabled={self}
        searchable
      />
      <TextInput
        label="Date d’expiration du compte"
        description={
          auditor
            ? 'Obligatoire pour un auditeur externe. Le compte est désactivé automatiquement à cette date.'
            : 'Facultative. Le compte est désactivé automatiquement à cette date.'
        }
        type="date"
        required={auditor}
        value={f.expiresAt}
        onChange={(e) => setF({ ...f, expiresAt: e.currentTarget.value })}
        disabled={self}
      />
      {user && (
        <Select
          label="État"
          data={[
            { value: 'active', label: 'Actif' },
            { value: 'disabled', label: 'Désactivé' },
          ]}
          value={f.disabled ? 'disabled' : 'active'}
          onChange={(v) => setF({ ...f, disabled: v === 'disabled' })}
          allowDeselect={false}
          disabled={self}
        />
      )}
      <Group justify="flex-end">
        <Button onClick={() => void save()}>{user ? 'Enregistrer' : 'Créer'}</Button>
      </Group>
    </Stack>
  );
}

/* ---------------------------------------------------------------- Droits effectifs */
function EffectiveRights({ userId }: { userId: string }) {
  const q = useQuery({
    queryKey: ['admin', 'rights', userId],
    queryFn: () => get<EffectiveRightsOut>(`/api/admin/users/${userId}/rights`),
  });
  const by = new Map((q.data?.permissions ?? []).map((p) => [p.permission, p.origins]));
  const origin = (o: EffectiveRightsOut['permissions'][number]['origins'][number]) =>
    o.via.kind === 'group' ? `${o.roleName} (groupe ${o.via.groupName})` : `${o.roleName} (direct)`;
  return (
    <Stack>
      <ErrorAlert error={q.error} />
      <Text size="sm" c="dimmed">
        Survolez une case pour voir l’origine du droit : rôle attribué directement, ou rôle porté par un groupe.
      </Text>
      <RightsMatrix
        cell={(p) => {
          const o = by.get(p);
          return o ? (
            <Tooltip label={o.map(origin).join(' · ')} multiline w="var(--suivi-champ-m)">
              <Badge color={o.some((x) => x.via.kind === 'direct') ? 'suivi' : 'violet'} variant="light">
                {o.some((x) => x.via.kind === 'direct') ? 'direct' : 'groupe'}
              </Badge>
            </Tooltip>
          ) : (
            <Text size="xs" c="dimmed" aria-label="non accordé">
              —
            </Text>
          );
        }}
      />
      {q.data && (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Droit</Table.Th>
              <Table.Th>Origine</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {q.data.permissions.map((p) => {
              const [m, a] = p.permission.split(':') as [Module, (typeof ACTIONS)[number]];
              return (
                <Table.Tr key={p.permission}>
                  <Table.Td>
                    {MODULE_LABELS[m]} — {ACTION_LABELS[a]}
                  </Table.Td>
                  <Table.Td>{p.origins.map(origin).join(' · ')}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

/** Matrice modules × actions (lecture ou édition). */
function RightsMatrix({ cell }: { cell: (p: Permission) => React.ReactNode }) {
  return (
    <div className="table-wrap" role="region" aria-label="Droits par module" tabIndex={0}>
      <Table className="matrix" withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Module</Table.Th>
            {ACTIONS.map((a) => (
              <Table.Th key={a} className="center">
                {ACTION_LABELS[a]}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {MODULES.map((m) => (
            <Table.Tr key={m}>
              <Table.Th scope="row">{MODULE_LABELS[m]}</Table.Th>
              {ACTIONS.map((a) => (
                <Table.Td key={a} className="center">
                  {cell(`${m}:${a}`)}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}

/* ================================================================ Groupes */
export function GroupsPanel() {
  const can = useCan();
  const q = useGroups();
  const act = useAct();
  const [edit, setEdit] = useState<{ group: GroupOut | null } | null>(null);
  const admin = can('administration', 'administrer');
  return (
    <Stack>
      {admin && (
        <Group>
          <Button onClick={() => setEdit({ group: null })}>Nouveau groupe</Button>
        </Group>
      )}
      <ErrorAlert error={q.error} />
      <Card withBorder p={0}>
        <div className="table-wrap" role="region" aria-label="Groupes" tabIndex={0}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Groupe</Table.Th>
                <Table.Th>Rôles</Table.Th>
                <Table.Th>Membres</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(q.data ?? []).map((g) => (
                <Table.Tr key={g.id}>
                  <Table.Td>
                    <Text fw={600}>{g.name}</Text>
                    {g.description && (
                      <Text size="xs" c="dimmed">
                        {g.description}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="2xs">
                      {g.roles.map((r) => (
                        <Badge key={r.id} variant="light">
                          {r.name}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {g.members.length ? g.members.map((m) => m.display_name || m.username).join(', ') : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="2xs" wrap="nowrap">
                      {admin && (
                        <Button size="compact-sm" variant="default" onClick={() => setEdit({ group: g })}>
                          Modifier
                        </Button>
                      )}
                      {can('administration', 'supprimer') && (
                        <ConfirmButton
                          size="compact-sm"
                          variant="light"
                          message={`Supprimer le groupe « ${g.name} » ? Ses membres perdent les rôles qu’il porte.`}
                          onConfirm={() => act(() => api('DELETE', `/api/admin/groups/${g.id}`), 'Groupe supprimé.')}
                        >
                          Supprimer
                        </ConfirmButton>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {q.data && !q.data.length && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text size="sm" c="dimmed">
                      Aucun groupe. Un groupe porte un ou plusieurs rôles, accordés à tous ses membres.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
      <Modal
        opened={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.group ? `Modifier le groupe ${edit.group.name}` : 'Nouveau groupe'}
        size="lg"
        centered
      >
        {edit && <GroupEditor group={edit.group} onDone={() => setEdit(null)} />}
      </Modal>
    </Stack>
  );
}

function GroupEditor({ group, onDone }: { group: GroupOut | null; onDone: () => void }) {
  const roles = useRoles();
  const users = useUsers();
  const act = useAct();
  const [f, setF] = useState({
    name: group?.name ?? '',
    description: group?.description ?? '',
    roles: group?.roles.map((r) => r.id) ?? [],
    members: group?.members.map((m) => m.id) ?? [],
  });
  const [err, setErr] = useState<string | null>(null);
  return (
    <Stack>
      {err && (
        <Alert color="red" role="alert">
          {err}
        </Alert>
      )}
      <TextInput label="Nom" required value={f.name} onChange={(e) => setF({ ...f, name: e.currentTarget.value })} />
      <Textarea
        label="Description"
        value={f.description}
        onChange={(e) => setF({ ...f, description: e.currentTarget.value })}
        autosize
        minRows={2}
      />
      <MultiSelect
        label="Rôles portés par le groupe"
        data={(roles.data ?? []).filter((r) => !r.scoped).map((r) => ({ value: r.id, label: r.name }))}
        value={f.roles}
        onChange={(v) => setF({ ...f, roles: v })}
        searchable
      />
      <MultiSelect
        label="Membres"
        data={(users.data ?? []).map((u) => ({ value: u.id, label: `${u.display_name} (${u.username})` }))}
        value={f.members}
        onChange={(v) => setF({ ...f, members: v })}
        searchable
      />
      <Group justify="flex-end">
        <Button
          onClick={async () => {
            setErr(null);
            try {
              if (group) await api('PATCH', `/api/admin/groups/${group.id}`, { body: f, ifMatch: group.version });
              else await api('POST', '/api/admin/groups', { body: f });
              await act(async () => {}, group ? 'Groupe modifié.' : 'Groupe créé.');
              onDone();
            } catch (e) {
              setErr(errorMessage(e));
            }
          }}
        >
          {group ? 'Enregistrer' : 'Créer'}
        </Button>
      </Group>
    </Stack>
  );
}

/* ================================================================ Rôles */
export function RolesPanel() {
  const can = useCan();
  const q = useRoles();
  const act = useAct();
  const [matrix, setMatrix] = useState<RoleOut | null>(null);
  const [dup, setDup] = useState<RoleOut | null>(null);
  const admin = can('administration', 'administrer');
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Les rôles prédéfinis ne sont ni modifiables ni supprimables. Pour un besoin particulier, dupliquez un rôle puis
        adaptez sa matrice.
      </Text>
      <ErrorAlert error={q.error} />
      <Card withBorder p={0}>
        <div className="table-wrap" role="region" aria-label="Rôles" tabIndex={0}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Rôle</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Attribué à</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(q.data ?? []).map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <Text fw={600}>{r.name}</Text>
                    <Text size="xs" c="dimmed">
                      {r.description}
                    </Text>
                  </Table.Td>
                  <Table.Td className="nowrap">
                    <Badge variant={r.system ? 'filled' : 'light'} color={r.system ? 'suivi' : 'violet'}>
                      {r.system ? 'prédéfini' : 'personnalisé'}
                    </Badge>
                  </Table.Td>
                  <Table.Td className="nowrap">
                    {r.users} compte(s), {r.groups} groupe(s)
                  </Table.Td>
                  <Table.Td>
                    <Group gap="2xs" wrap="nowrap">
                      <Button size="compact-sm" variant="default" onClick={() => setMatrix(r)}>
                        {r.system || !admin ? 'Voir la matrice' : 'Modifier la matrice'}
                      </Button>
                      {admin && !r.scoped && (
                        <Button size="compact-sm" variant="light" onClick={() => setDup(r)}>
                          Dupliquer
                        </Button>
                      )}
                      {!r.system && can('administration', 'supprimer') && (
                        <ConfirmButton
                          size="compact-sm"
                          variant="light"
                          message={`Supprimer le rôle « ${r.name} » ? Il est retiré de ${r.users} compte(s) et ${r.groups} groupe(s).`}
                          onConfirm={() => act(() => api('DELETE', `/api/admin/roles/${r.id}`), 'Rôle supprimé.')}
                        >
                          Supprimer
                        </ConfirmButton>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
      <Modal opened={!!matrix} onClose={() => setMatrix(null)} title={`Rôle ${matrix?.name ?? ''}`} size="xl" centered>
        {matrix && <RoleEditor role={matrix} readOnly={matrix.system || !admin} onDone={() => setMatrix(null)} />}
      </Modal>
      <Modal opened={!!dup} onClose={() => setDup(null)} title={`Dupliquer le rôle ${dup?.name ?? ''}`} centered>
        {dup && (
          <DuplicateRole
            from={dup}
            onDone={(created) => {
              setDup(null);
              if (created) setMatrix(created);
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}

function DuplicateRole({ from, onDone }: { from: RoleOut; onDone: (r: RoleOut | null) => void }) {
  const act = useAct();
  const [name, setName] = useState(`${from.name} (copie)`);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Stack>
      {err && (
        <Alert color="red" role="alert">
          {err}
        </Alert>
      )}
      <TextInput label="Nom du nouveau rôle" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
      <Group justify="flex-end">
        <Button
          onClick={async () => {
            try {
              const r = await api<RoleOut>('POST', '/api/admin/roles', { body: { from: from.id, name } });
              await act(async () => {}, 'Rôle créé : adaptez maintenant sa matrice.');
              onDone(r);
            } catch (e) {
              setErr(errorMessage(e));
            }
          }}
        >
          Créer le rôle
        </Button>
      </Group>
    </Stack>
  );
}

function RoleEditor({ role, readOnly, onDone }: { role: RoleOut; readOnly: boolean; onDone: () => void }) {
  const act = useAct();
  const [perms, setPerms] = useState<Set<string>>(new Set(role.permissions));
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (p: Permission) => {
    const n = new Set(perms);
    if (n.has(p)) n.delete(p);
    else n.add(p);
    setPerms(n);
  };
  return (
    <Stack>
      {err && (
        <Alert color="red" role="alert">
          {err}
        </Alert>
      )}
      {role.scoped && (
        <Alert color="violet">
          Les modules réellement ouverts sont choisis à l’attribution, compte par compte, avec une date d’expiration
          obligatoire.
        </Alert>
      )}
      {!readOnly && (
        <>
          <TextInput label="Nom" value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        </>
      )}
      <RightsMatrix
        cell={(p) => (
          <Checkbox
            checked={perms.has(p)}
            onChange={() => toggle(p)}
            disabled={readOnly}
            aria-label={`${MODULE_LABELS[p.split(':')[0] as Module]} : ${ACTION_LABELS[p.split(':')[1] as (typeof ACTIONS)[number]]}`}
            className="matrix-check"
          />
        )}
      />
      {!readOnly && (
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            L’enregistrement ferme les sessions des comptes qui détiennent ce rôle.
          </Text>
          <Button
            onClick={async () => {
              setErr(null);
              try {
                await api('PATCH', `/api/admin/roles/${role.id}`, {
                  body: { name, description, permissions: [...perms] },
                  ifMatch: role.version,
                });
                await act(async () => {}, 'Rôle enregistré.');
                onDone();
              } catch (e) {
                setErr(errorMessage(e));
              }
            }}
          >
            Enregistrer la matrice
          </Button>
        </Group>
      )}
    </Stack>
  );
}

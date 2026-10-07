/* Administration : comptes, sessions, journal d'audit, versions, import legacy, système. */
import { Alert, Badge, Button, Card, Group, Modal, Select, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ROLE_LABELS, ROLES, type Role, type UserOut } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, ApiError, download, errorMessage, get } from '../api';
import { ConfirmButton, ErrorAlert, fmtDate, PresenceBar, SecretModal } from '../components/common';
import { usePresence } from '../realtime';
import { useMe } from '../session';
import { ImportPanel } from './AdminImport';

const TABS = [
  ['users', 'Comptes'],
  ['sessions', 'Sessions'],
  ['audit', 'Journal'],
  ['versions', 'Versions'],
  ['import', 'Import des données legacy'],
  ['system', 'Système'],
] as const;
const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

export function AdminPage() {
  const { tab = 'users' } = useParams();
  const nav = useNavigate();
  usePresence(`admin/${tab}`);
  return (
    <Stack maw={1200} mx="auto">
      <Group justify="space-between">
        <Title order={1}>Administration</Title>
        <PresenceBar resource="admin" />
      </Group>
      <Tabs value={tab} onChange={(v) => nav(`/admin/${v}`)} keepMounted={false}>
        <Tabs.List>
          {TABS.map(([k, l]) => (
            <Tabs.Tab key={k} value={k}>
              {l}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="users" pt="md">
          <Users />
        </Tabs.Panel>
        <Tabs.Panel value="sessions" pt="md">
          <Sessions />
        </Tabs.Panel>
        <Tabs.Panel value="audit" pt="md">
          <Audit />
        </Tabs.Panel>
        <Tabs.Panel value="versions" pt="md">
          <Versions />
        </Tabs.Panel>
        <Tabs.Panel value="import" pt="md">
          <ImportPanel />
        </Tabs.Panel>
        <Tabs.Panel value="system" pt="md">
          <System />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

/* ---------------------------------------------------------------- Comptes */
function Users() {
  const me = useMe();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'users'], queryFn: () => get<UserOut[]>('/api/admin/users') });
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
  const [creating, setCreating] = useState<{ username: string; displayName: string; email: string; role: Role } | null>(null);
  const [editing, setEditing] = useState<UserOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn();
      if (msg) notifications.show({ color: 'teal', message: msg });
      await refresh();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <Stack>
      <Group>
        <Button onClick={() => setCreating({ username: '', displayName: '', email: '', role: 'ro' })}>Nouveau compte</Button>
      </Group>
      <ErrorAlert error={q.error} />
      <Card withBorder p={0}>
        <div className="table-wrap">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Compte</Table.Th>
                <Table.Th>Rôle</Table.Th>
                <Table.Th>État</Table.Th>
                <Table.Th>Dernière connexion</Table.Th>
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
                    <Table.Td>{ROLE_LABELS[u.role]}</Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {u.disabled && <Badge color="gray">désactivé</Badge>}
                        {locked && <Badge color="red">verrouillé</Badge>}
                        {!u.totp_enabled && <Badge color="orange">TOTP à configurer</Badge>}
                        {u.must_change_password && <Badge color="yellow">mot de passe temporaire</Badge>}
                        {u.sessions > 0 && <Badge variant="light">{u.sessions} session(s)</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td className="nowrap">{fmtDate(u.last_login_at)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Button size="compact-sm" variant="default" onClick={() => setEditing(u)}>
                          Modifier
                        </Button>
                        <ConfirmButton
                          size="compact-sm"
                          variant="light"
                          color="orange"
                          message={`Générer un mot de passe temporaire pour ${u.username} ? Ses sessions seront fermées.`}
                          onConfirm={() =>
                            act(async () => {
                              const r = await api<{ temporaryPassword: string }>('POST', `/api/admin/users/${u.id}/reset-password`);
                              setSecret({ title: `Mot de passe temporaire de ${u.username}`, value: r.temporaryPassword });
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
                          onConfirm={() => act(() => api('POST', `/api/admin/users/${u.id}/reset-mfa`), 'Double authentification réinitialisée.')}
                        >
                          TOTP
                        </ConfirmButton>
                        {locked && (
                          <Button size="compact-sm" variant="light" onClick={() => act(() => api('PATCH', `/api/admin/users/${u.id}`, { body: { unlock: true }, ifMatch: u.version }), 'Compte déverrouillé.')}>
                            Déverrouiller
                          </Button>
                        )}
                        {u.id !== me.user?.id && (
                          <ConfirmButton size="compact-sm" variant="light" message={`Supprimer définitivement le compte ${u.username} ?`} onConfirm={() => act(() => api('DELETE', `/api/admin/users/${u.id}`), 'Compte supprimé.')}>
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
        </div>
      </Card>

      <Modal opened={!!creating} onClose={() => setCreating(null)} title="Nouveau compte" centered>
        {creating && (
          <Stack>
            {err && <Alert color="red">{err}</Alert>}
            <TextInput label="Identifiant" required value={creating.username} onChange={(e) => setCreating({ ...creating, username: e.currentTarget.value })} />
            <TextInput label="Nom affiché" value={creating.displayName} onChange={(e) => setCreating({ ...creating, displayName: e.currentTarget.value })} />
            <TextInput label="Adresse e-mail" type="email" value={creating.email} onChange={(e) => setCreating({ ...creating, email: e.currentTarget.value })} />
            <Select label="Rôle" data={roleOptions} value={creating.role} onChange={(v) => v && setCreating({ ...creating, role: v as Role })} allowDeselect={false} />
            <Group justify="flex-end">
              <Button
                onClick={async () => {
                  setErr(null);
                  try {
                    const r = await api<{ temporaryPassword: string }>('POST', '/api/admin/users', { body: creating });
                    setSecret({ title: `Compte ${creating.username} créé`, value: r.temporaryPassword });
                    setCreating(null);
                    await refresh();
                  } catch (e) {
                    setErr(errorMessage(e));
                  }
                }}
              >
                Créer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={`Modifier ${editing?.username ?? ''}`} centered>
        {editing && <EditUser user={editing} onDone={() => (setEditing(null), void refresh())} />}
      </Modal>
      <SecretModal title={secret?.title ?? ''} intro="Mot de passe temporaire :" secret={secret?.value ?? null} onClose={() => setSecret(null)} />
    </Stack>
  );
}

function EditUser({ user, onDone }: { user: UserOut; onDone: () => void }) {
  const [f, setF] = useState({ displayName: user.display_name, email: user.email, role: user.role, disabled: user.disabled });
  const [err, setErr] = useState<string | null>(null);
  return (
    <Stack>
      {err && <Alert color="red">{err}</Alert>}
      <TextInput label="Nom affiché" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.currentTarget.value })} />
      <TextInput label="Adresse e-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.currentTarget.value })} />
      <Select label="Rôle" data={roleOptions} value={f.role} onChange={(v) => v && setF({ ...f, role: v as Role })} allowDeselect={false} />
      <Select
        label="État"
        data={[
          { value: 'active', label: 'Actif' },
          { value: 'disabled', label: 'Désactivé' },
        ]}
        value={f.disabled ? 'disabled' : 'active'}
        onChange={(v) => setF({ ...f, disabled: v === 'disabled' })}
        allowDeselect={false}
      />
      <Group justify="flex-end">
        <Button
          onClick={async () => {
            try {
              await api('PATCH', `/api/admin/users/${user.id}`, { body: f, ifMatch: user.version });
              notifications.show({ color: 'teal', message: 'Compte modifié.' });
              onDone();
            } catch (e) {
              setErr(e instanceof ApiError && e.status === 412 ? `${e.message} Fermez cette fenêtre pour recharger.` : errorMessage(e));
            }
          }}
        >
          Enregistrer
        </Button>
      </Group>
    </Stack>
  );
}

/* ---------------------------------------------------------------- Sessions */
interface AdminSession {
  id: string;
  username: string;
  ip: string | null;
  user_agent: string;
  mfa_ok: boolean;
  created_at: string;
  last_seen_at: string;
  current: boolean;
}
function Sessions() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'sessions'], queryFn: () => get<AdminSession[]>('/api/admin/sessions') });
  return (
    <Card withBorder p={0}>
      <ErrorAlert error={q.error} />
      <div className="table-wrap">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Compte</Table.Th>
              <Table.Th>Navigateur</Table.Th>
              <Table.Th>IP</Table.Th>
              <Table.Th>Activité</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(q.data ?? []).map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>
                  {s.username} {s.current && <Badge size="xs">vous</Badge>} {!s.mfa_ok && <Badge size="xs" color="orange">TOTP non validé</Badge>}
                </Table.Td>
                <Table.Td>{s.user_agent.slice(0, 60)}</Table.Td>
                <Table.Td className="mono">{s.ip}</Table.Td>
                <Table.Td className="nowrap">{fmtDate(s.last_seen_at)}</Table.Td>
                <Table.Td>
                  {!s.current && (
                    <Button size="compact-sm" variant="light" color="red" onClick={() => api('DELETE', `/api/admin/sessions/${s.id}`).then(() => qc.invalidateQueries({ queryKey: ['admin', 'sessions'] }))}>
                      Fermer
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- Journal d'audit */
interface AuditRow {
  id: number;
  ts: string;
  username: string;
  ip: string | null;
  action: string;
  target: string;
  details: Record<string, unknown>;
}
function Audit() {
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');
  const r = useQuery({ queryKey: ['admin', 'audit', applied], queryFn: () => get<AuditRow[]>(`/api/admin/audit?limit=300${applied ? `&q=${encodeURIComponent(applied)}` : ''}`) });
  return (
    <Stack>
      <Group align="flex-end">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(q);
          }}
        >
          <Group align="flex-end">
            <TextInput label="Rechercher" placeholder="compte, action, cible, IP" value={q} onChange={(e) => setQ(e.currentTarget.value)} />
            <Button type="submit" variant="default">
              Filtrer
            </Button>
          </Group>
        </form>
        <Button variant="light" onClick={() => download(`/api/admin/audit?format=csv${applied ? `&q=${encodeURIComponent(applied)}` : ''}`)}>
          Exporter en CSV
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        Journal en ajout seul : aucune entrée ne peut être modifiée ni supprimée.
      </Text>
      <ErrorAlert error={r.error} />
      <Card withBorder p={0}>
        <div className="table-wrap">
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Compte</Table.Th>
                <Table.Th>Action</Table.Th>
                <Table.Th>Cible</Table.Th>
                <Table.Th>IP</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(r.data ?? []).map((a) => (
                <Table.Tr key={a.id}>
                  <Table.Td className="nowrap">{fmtDate(a.ts)}</Table.Td>
                  <Table.Td>{a.username}</Table.Td>
                  <Table.Td className="mono">{a.action}</Table.Td>
                  <Table.Td className="mono">{a.target}</Table.Td>
                  <Table.Td className="mono">{a.ip}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
    </Stack>
  );
}

/* ---------------------------------------------------------------- Versions de l'état legacy */
interface VersionRow {
  version: number;
  updated_at: string;
  updated_by: string;
  note: string;
  bytes: number;
  items: number;
  findings: number;
  import_batch_id: number | null;
}
function Versions() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'versions'], queryFn: () => get<VersionRow[]>('/api/admin/versions') });
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Historique des enregistrements de l’outil de suivi (ancienne interface). Une restauration crée une nouvelle version.
      </Text>
      <ErrorAlert error={q.error} />
      <Card withBorder p={0}>
        <div className="table-wrap">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Version</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Par</Table.Th>
                <Table.Th>Note</Table.Th>
                <Table.Th>Contenu</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(q.data ?? []).map((v) => (
                <Table.Tr key={v.version}>
                  <Table.Td>v{v.version}</Table.Td>
                  <Table.Td className="nowrap">{fmtDate(v.updated_at)}</Table.Td>
                  <Table.Td>{v.updated_by}</Table.Td>
                  <Table.Td>{v.note}</Table.Td>
                  <Table.Td className="nowrap">
                    {v.items} mesures, {v.findings} écarts
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Button size="compact-sm" variant="default" onClick={() => download(`/api/admin/versions/${v.version}`)}>
                        Télécharger
                      </Button>
                      <ConfirmButton
                        size="compact-sm"
                        variant="light"
                        color="orange"
                        message={`Restaurer la version ${v.version} ? L’état actuel restera disponible dans l’historique.`}
                        onConfirm={() =>
                          api('POST', `/api/admin/versions/${v.version}/restore`)
                            .then(() => notifications.show({ color: 'teal', message: 'Version restaurée.' }))
                            .then(() => qc.invalidateQueries({ queryKey: ['admin', 'versions'] }))
                            .catch((e) => notifications.show({ color: 'red', message: errorMessage(e) }))
                        }
                      >
                        Restaurer
                      </ConfirmButton>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
    </Stack>
  );
}

/* ---------------------------------------------------------------- Système */
function System() {
  const q = useQuery({ queryKey: ['admin', 'info'], queryFn: () => get<Record<string, unknown>>('/api/admin/info') });
  const d = q.data;
  const rows: [string, unknown][] = d
    ? [
        ['Version de l’application', d.app],
        ['Node.js', d.node],
        ['PostgreSQL', d.postgres],
        ['Taille de la base', d.dbSize],
        ['Migrations appliquées', (d.migrations as string[]).join(', ')],
        ['Temps réel', d.realtime],
        ['Antivirus (ClamAV)', d.clamav],
        ['Double authentification', d.mfaRequired ? 'obligatoire' : 'facultative'],
        ['Identifiant de la clé maître', d.keyId],
        ['Modules repris de l’ancienne interface', (d.legacyTakenOver as string[]).join(', ') || 'aucun (phase 0)'],
        ['Volumétrie', JSON.stringify(d.counts)],
      ]
    : [];
  return (
    <Card withBorder>
      <ErrorAlert error={q.error} />
      <Table>
        <Table.Tbody>
          {rows.map(([k, v]) => (
            <Table.Tr key={k}>
              <Table.Th>{k}</Table.Th>
              <Table.Td className="mono">{String(v ?? '')}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Text size="sm" c="dimmed" mt="sm">
        Documentation de l’API : <a href="/api/openapi.json">/api/openapi.json</a>
      </Text>
    </Card>
  );
}

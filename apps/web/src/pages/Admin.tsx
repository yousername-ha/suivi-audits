/* Administration : utilisateurs, groupes, rôles, sessions, journal d'audit, versions, import legacy, système.
   Chaque onglet n'apparaît qu'avec la permission correspondante (le serveur contrôle chaque appel). */
import { Alert, Badge, Button, Card, Group, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core';
import type { SystemeOut } from '@suivi/shared';
import { StatusChip, type Etat } from '@suivi/ui';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, download, errorMessage, get } from '../api';
import { ConfirmButton, ErrorAlert, fmtDate, fmtOctets, PresenceBar } from '../components/common';
import { usePresence } from '../realtime';
import { useCan } from '../session';
import { GroupsPanel, RolesPanel, UsersPanel } from './AdminAccess';
import { ImportPanel } from './AdminImport';
import { MursPanel } from './AdminMurs';
import { BackupsPanel } from './AdminBackups';
import { ModulesPanel } from './AdminModules';
import { EnvironmentPanel } from './AdminEnvironment';
import { UpdatesPanel } from '../components/Updates';
import { OperationsPanel } from './AdminOperations';

const TABS = [
  ['users', 'Utilisateurs', 'administration'],
  ['groups', 'Groupes', 'administration'],
  ['roles', 'Rôles', 'administration'],
  ['sessions', 'Sessions', 'administration'],
  ['audit', 'Journal', 'administration'],
  ['versions', 'Versions', 'administration'],
  ['murs', 'Écrans muraux', 'administration'],
  ['import', 'Import des données legacy', 'import_export'],
  ['system', 'Système', 'administration'],
] as const;

export function AdminPage() {
  const can = useCan();
  const tabs = TABS.filter(([, , m]) => can(m, 'lire'));
  const params = useParams();
  const tab = tabs.some(([k]) => k === params.tab) ? params.tab! : (tabs[0]?.[0] ?? 'users');
  const nav = useNavigate();
  usePresence(`admin/${params.tab === 'environment' && can('administration', 'lire') ? 'environment' : tab}`);
  if (params.tab === 'environment' && can('administration', 'lire'))
    return (
      <Stack className="page">
        <Title order={1}>Administration</Title>
        <Button component={Link} to="/admin/system" variant="subtle">
          Retour au système
        </Button>
        <EnvironmentPanel />
      </Stack>
    );
  return (
    <Stack className="page">
      <Group justify="space-between">
        <Title order={1}>Administration</Title>
        <PresenceBar resource="admin" />
      </Group>
      <Tabs value={tab} onChange={(v) => nav(`/admin/${v}`)} keepMounted={false}>
        <Tabs.List>
          {tabs.map(([k, l]) => (
            <Tabs.Tab key={k} value={k}>
              {l}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="users" pt="md">
          <UsersPanel />
        </Tabs.Panel>
        <Tabs.Panel value="groups" pt="md">
          <GroupsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="roles" pt="md">
          <RolesPanel />
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
        <Tabs.Panel value="murs" pt="md">
          <MursPanel />
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
                  {s.username} {s.current && <Badge size="xs">vous</Badge>}{' '}
                  {!s.mfa_ok && (
                    <Badge size="xs" color="orange">
                      TOTP non validé
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>{s.user_agent.slice(0, 60)}</Table.Td>
                <Table.Td className="mono">{s.ip}</Table.Td>
                <Table.Td className="nowrap">{fmtDate(s.last_seen_at)}</Table.Td>
                <Table.Td>
                  {!s.current && (
                    <Button
                      size="compact-sm"
                      variant="light"
                      color="red"
                      onClick={() =>
                        api('DELETE', `/api/admin/sessions/${s.id}`).then(() =>
                          qc.invalidateQueries({ queryKey: ['admin', 'sessions'] }),
                        )
                      }
                    >
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
  const r = useQuery({
    queryKey: ['admin', 'audit', applied],
    queryFn: () => get<AuditRow[]>(`/api/admin/audit?limit=300${applied ? `&q=${encodeURIComponent(applied)}` : ''}`),
  });
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
            <TextInput
              label="Rechercher"
              placeholder="compte, action, cible, IP"
              value={q}
              onChange={(e) => setQ(e.currentTarget.value)}
            />
            <Button type="submit" variant="default">
              Filtrer
            </Button>
          </Group>
        </form>
        <Button
          variant="light"
          onClick={() => download(`/api/admin/audit?format=csv${applied ? `&q=${encodeURIComponent(applied)}` : ''}`)}
        >
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
        Historique des enregistrements de l’outil de suivi (ancienne interface). Une restauration crée une nouvelle
        version.
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
                    <Group gap="2xs" wrap="nowrap">
                      <Button
                        size="compact-sm"
                        variant="default"
                        onClick={() => download(`/api/admin/versions/${v.version}`)}
                      >
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

const RESULTATS: Record<string, [Etat, string]> = {
  reussie: ['succes', 'Réussie'],
  'retour-arriere': ['attention', 'Retour arrière'],
  echec: ['erreur', 'Échec'],
  abandon: ['neutre', 'Abandonnée'],
};

/** Rapports d’exploitation historiques ; les commandes intégrées sont dans UpdatesPanel. */
function Exploitation() {
  const q = useQuery({ queryKey: ['admin', 'systeme'], queryFn: () => get<SystemeOut>('/api/admin/systeme') });
  const s = q.data;
  if (!s) return <ErrorAlert error={q.error} />;
  const disque = s.donnees.disque;
  const libre = disque ? disque.libreOctets / disque.totalOctets : null;
  const sv = s.sauvegarde;
  return (
    <Stack>
      <BackupsPanel />
      <UpdatesPanel />
      <OperationsPanel />
      {sv.enRetard && (
        <Alert color="red" title="Sauvegarde en retard">
          {sv.derniereReussie
            ? `Dernière sauvegarde réussie il y a ${Math.round(sv.ageHeures ?? 0)} h (plus de 48 h).`
            : 'Aucune sauvegarde réussie n’est connue sur ce serveur.'}{' '}
          Vérifier la tâche planifiée (guide d’installation, étape 11.3) et le fichier /var/log/suivi-backup.log.
        </Alert>
      )}
      <div className="grille-cartes">
        <Card withBorder>
          <Title order={2} size="h4" mb="xs">
            Version
          </Title>
          <Text className="chiffre-cle__valeur chiffres">{s.version}</Text>
          <Text size="sm" c="dimmed">
            {s.versionDisponible
              ? `Dernière version publiée : ${s.versionDisponible.derniere} (vérifiée le ${fmtDate(s.versionDisponible.verifieeLe)})`
              : 'Recherche de nouvelle version non planifiée (scripts/verifier-version.sh).'}
          </Text>
          <Text size="sm" c="dimmed">
            Dernière migration : {s.migrations[0]?.name ?? '—'}
          </Text>
        </Card>
        <Card withBorder>
          <Title order={2} size="h4" mb="xs">
            Dernière sauvegarde
          </Title>
          {sv.derniereReussie ? (
            <Stack gap="2xs">
              <Group gap="xs">
                <StatusChip etat={sv.enRetard ? 'erreur' : 'succes'}>{sv.enRetard ? 'En retard' : 'À jour'}</StatusChip>
                <Text size="sm">{fmtDate(sv.derniereReussie.date)}</Text>
              </Group>
              <Text size="sm" c="dimmed" className="mono">
                {sv.derniereReussie.fichier}
              </Text>
              <Text size="sm" c="dimmed">
                {sv.derniereReussie.tailleOctets != null ? fmtOctets(sv.derniereReussie.tailleOctets) : ''}
                {sv.derniereReussie.chiffree ? ' · chiffrée' : ' · NON chiffrée'}
              </Text>
            </Stack>
          ) : (
            <StatusChip etat="erreur">Aucune</StatusChip>
          )}
          {sv.derniere && sv.derniere.resultat !== 'reussie' && (
            <Text size="sm" c="red" mt="xs">
              Dernière tentative en échec le {fmtDate(sv.derniere.date)}.
            </Text>
          )}
        </Card>
        <Card withBorder>
          <Title order={2} size="h4" mb="xs">
            Données du serveur
          </Title>
          <Text size="sm" className="mono">
            {s.donnees.chemin || '(emplacement non communiqué)'}
          </Text>
          {disque && libre != null && (
            <Stack gap="2xs" mt="xs">
              <Group gap="xs">
                <StatusChip etat={libre < 0.1 ? 'erreur' : libre < 0.2 ? 'attention' : 'succes'}>
                  {Math.round(libre * 100)} % libres
                </StatusChip>
                <Text size="sm">
                  {fmtOctets(disque.libreOctets)} sur {fmtOctets(disque.totalOctets)}
                </Text>
              </Group>
            </Stack>
          )}
        </Card>
      </div>
      <Card withBorder>
        <Title order={2} size="h4" mb="xs">
          Historique des mises à jour
        </Title>
        {s.misesAJour.length ? (
          <div className="table-wrap">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Versions</Table.Th>
                  <Table.Th>Résultat</Table.Th>
                  <Table.Th>Migrations</Table.Th>
                  <Table.Th>Durée</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {s.misesAJour.map((m) => {
                  const [etat, libelle] = RESULTATS[m.resultat] ?? (['neutre', m.resultat] as [Etat, string]);
                  return (
                    <Table.Tr key={m.fichier}>
                      <Table.Td className="nowrap">{fmtDate(m.date) || m.fichier}</Table.Td>
                      <Table.Td className="nowrap">
                        {m.depuis || '?'} → {m.vers || '?'}
                      </Table.Td>
                      <Table.Td>
                        <StatusChip etat={etat}>{libelle}</StatusChip>
                        {m.message && (
                          <Text size="xs" c="dimmed">
                            {m.message}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>{m.migrations.join(', ') || '—'}</Table.Td>
                      <Table.Td className="nowrap chiffres">
                        {m.dureeSecondes != null ? `${Math.round(m.dureeSecondes)} s` : ''}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>
        ) : (
          <Text size="sm" c="dimmed">
            Aucune mise à jour enregistrée sur ce serveur (scripts/mettre-a-jour.sh).
          </Text>
        )}
      </Card>
    </Stack>
  );
}

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
    <Stack>
      <Exploitation />
      <ModulesPanel />
      <Card withBorder>
        <Stack>
          <Title order={2} size="h4">
            Configuration de l’environnement
          </Title>
          <Text size="sm">
            Échelles et matrices versionnées, simulation et historique. Les méthodes historiques restent conservées.
          </Text>
          <Button component={Link} to="/admin/environment" variant="light">
            Configurer l’environnement
          </Button>
        </Stack>
      </Card>
      <Card withBorder>
        <Title order={2} size="h4" mb="xs">
          Détails techniques
        </Title>
        <ErrorAlert error={q.error} />
        <div className="table-wrap">
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
        </div>
        <Text size="sm" c="dimmed" mt="sm">
          Documentation de l’API : <a href="/api/openapi.json">/api/openapi.json</a>
        </Text>
      </Card>
    </Stack>
  );
}

import {
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { Page, PageHeader } from '@suivi/ui';
import { GRC_KINDS, GRC_LABELS, GRC_MODULES, type GrcKind, type GrcObject, type BusinessPolicy } from '@suivi/shared';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get, saveBlob } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { MappingForm } from '../grc/MappingForm';
import { Overview } from '../grc/Overview';
import { Tasks } from '../grc/Tasks';
import { ObjectEditor } from '../grc/ObjectEditor';
import { RiskEvaluation } from '../grc/Risks';
import { Publication } from '../grc/Publication';
import { RiskMap } from '../grc/RiskMap';
import { Relations } from '../grc/Relations';
import { Imports } from '../grc/Imports';
import { BusinessPolicyPanel } from '../grc/BusinessPolicy';
interface Smsi {
  id: string;
  name: string;
  scope: string;
  version: number;
  businessVersion: number;
  visibility: string;
}
export function GrcPage() {
  const can = useCan(),
    [selected, setSelected] = useState<string | null>(null),
    [tab, setTab] = useState('tasks'),
    [create, setCreate] = useState(false),
    [name, setName] = useState(''),
    [scope, setScope] = useState(''),
    [error, setError] = useState<unknown>(null),
    qc = useQueryClient();
  const smsis = useQuery({ queryKey: ['grc', 'smsis'], queryFn: () => get<Smsi[]>('/api/grc/smsis') });
  const smsi = selected ?? smsis.data?.[0]?.id;
  const policy = useQuery({
    queryKey: ['grc', smsi, 'policy'],
    queryFn: () => get<{ definition: BusinessPolicy; version: number }>(`/api/grc/${smsi}/policy`),
    enabled: !!smsi,
  });
  const [kind, setKind] = useState<GrcKind>('action'),
    [editing, setEditing] = useState<GrcObject | null>(null),
    [open, setOpen] = useState(false),
    [evaluation, setEvaluation] = useState<GrcObject | null>(null),
    [relation, setRelation] = useState<string | null>(null);
  const notifications = useQuery({
    queryKey: ['grc', 'notifications'],
    queryFn: () =>
      get<{ id: string; smsiId: string; objectId: string; title: string; message: string; readAt: string | null }[]>(
        '/api/grc/notifications',
      ),
  });
  const edit = (o: GrcObject) => {
    setKind(o.kind);
    setEditing(o);
    setOpen(true);
  };
  const start = (k: GrcKind) => {
    setKind(k);
    setEditing(null);
    setOpen(true);
  };
  const available = [
    ['overview', 'Tableau de bord SMSI'],
    ...(can('ecarts', 'lire') ? [['tasks', 'Actions et récurrences']] : []),
    ...(can('pilotage', 'lire')
      ? [
          ['risks', 'Risques'],
          ['methods', 'Méthodes'],
        ]
      : []),
    ...(can('conformite', 'lire')
      ? [
          ['frameworks', 'Référentiels'],
          ['mappings', 'Correspondances'],
        ]
      : []),
    ['objects', 'Objets SMSI'],
    ...(can('cartographie', 'lire') && can('pilotage', 'lire') ? [['map', 'Cartographie des risques']] : []),
    ...(can('import_export', 'lire') ? [['imports', 'Import / export']] : []),
    ['notifications', 'Rappels'],
    ...(can('pilotage', 'administrer') ? [['scope', 'Périmètre et membres']] : []),
    ...(can('administration', 'lire') ? [['business', 'Configuration métier']] : []),
  ];
  const active = available.some(([k]) => k === tab) ? tab : (available[0]?.[0] ?? 'objects');
  return (
    <Page>
      <PageHeader
        title="Pilotage SMSI"
        description="Référentiels, risques, tâches et preuves reliés dans un même périmètre."
      />
      <Stack>
        <Group>
          <Select
            label="SMSI actif"
            data={(smsis.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            value={smsi ?? null}
            onChange={(v) => {
              setSelected(v);
              setEditing(null);
              setOpen(false);
              setRelation(null);
              setEvaluation(null);
            }}
          />
          {can('pilotage', 'administrer') && (
            <Button variant="light" onClick={() => setCreate(true)}>
              Créer un SMSI
            </Button>
          )}
          <Anchor href="/legacy/">Données historiques</Anchor>
        </Group>
        <ErrorAlert error={error ?? smsis.error ?? policy.error} />
        {smsi && policy.data && (
          <>
            <Text size="sm">
              Politique métier publiée : version {policy.data.version} · {smsis.data?.find((s) => s.id === smsi)?.scope}
            </Text>
            <Tabs value={active} onChange={(v) => setTab(v ?? 'tasks')} keepMounted={false}>
              <Tabs.List>
                {available.map(([key, label]) => (
                  <Tabs.Tab key={key} value={key!}>
                    {label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
              <Tabs.Panel value="overview" pt="md">
                <Overview key={smsi} smsi={smsi} />
              </Tabs.Panel>
              <Tabs.Panel value="tasks" pt="md">
                <Stack>
                  <Group>
                    {can('ecarts', 'modifier') && (
                      <>
                        <Button onClick={() => start('action')}>Créer une action</Button>
                        <Button variant="light" onClick={() => start('task_series')}>
                          Créer une tâche récurrente
                        </Button>
                      </>
                    )}
                  </Group>
                  <Tasks key={smsi} smsi={smsi} policy={policy.data.definition} onOpen={edit} />
                  <Registry
                    smsi={smsi}
                    fixedKind="task_series"
                    onOpen={edit}
                    onEvaluation={setEvaluation}
                    onRelation={setRelation}
                  />
                </Stack>
              </Tabs.Panel>
              <Tabs.Panel value="risks" pt="md">
                <Stack>
                  {can('pilotage', 'modifier') && <Button onClick={() => start('risk')}>Créer un risque</Button>}
                  <Registry
                    smsi={smsi}
                    fixedKind="risk"
                    onOpen={edit}
                    onEvaluation={setEvaluation}
                    onRelation={setRelation}
                  />
                </Stack>
              </Tabs.Panel>
              <Tabs.Panel value="methods" pt="md">
                <Publication key={smsi + 'methods'} smsi={smsi} type="methods" />
              </Tabs.Panel>
              <Tabs.Panel value="frameworks" pt="md">
                <Publication key={smsi + 'frameworks'} smsi={smsi} type="frameworks" />
              </Tabs.Panel>
              <Tabs.Panel value="mappings" pt="md">
                <MappingPanel smsi={smsi} />
              </Tabs.Panel>
              <Tabs.Panel value="objects" pt="md">
                <Registry
                  key={smsi}
                  smsi={smsi}
                  onOpen={edit}
                  onEvaluation={setEvaluation}
                  onRelation={setRelation}
                  onCreate={start}
                />
              </Tabs.Panel>
              <Tabs.Panel value="map" pt="md">
                <RiskMap key={smsi} smsi={smsi} onOpen={edit} />
              </Tabs.Panel>
              <Tabs.Panel value="imports" pt="md">
                <Imports smsi={smsi} />
              </Tabs.Panel>
              <Tabs.Panel value="notifications" pt="md">
                <ErrorAlert error={notifications.error} />
                {notifications.data
                  ?.filter((n) => n.smsiId === smsi)
                  .map((n) => (
                    <Card withBorder key={n.id}>
                      <Text fw={600}>{n.title}</Text>
                      <Text>{n.message}</Text>
                      <Group>
                        <Button
                          variant="light"
                          onClick={async () => {
                            try {
                              edit(await get<GrcObject>(`/api/grc/${smsi}/objects/${n.objectId}`));
                            } catch (e) {
                              setError(e);
                            }
                          }}
                        >
                          Ouvrir l’action
                        </Button>
                        {!n.readAt && (
                          <Button
                            variant="subtle"
                            onClick={async () => {
                              await api('PUT', `/api/grc/notifications/${n.id}/read`);
                              await qc.invalidateQueries({ queryKey: ['grc', 'notifications'] });
                            }}
                          >
                            Marquer comme lu
                          </Button>
                        )}
                      </Group>
                    </Card>
                  ))}
              </Tabs.Panel>
              <Tabs.Panel value="scope" pt="md">
                <Members smsi={smsi} />
              </Tabs.Panel>
              <Tabs.Panel value="business" pt="md">
                <BusinessPolicyPanel smsi={smsi} />
              </Tabs.Panel>
            </Tabs>
            <ObjectEditor
              key={editing?.id ?? kind + smsi}
              smsi={smsi}
              policy={policy.data.definition}
              kind={kind}
              object={editing}
              opened={open}
              onClose={() => setOpen(false)}
            />
            <RiskEvaluation
              key={evaluation?.id ?? 'none'}
              smsi={smsi}
              risk={evaluation}
              onClose={() => setEvaluation(null)}
            />
            <Modal opened={!!relation} onClose={() => setRelation(null)} title="Liens SMSI" size="lg">
              {relation && <Relations smsi={smsi} source={relation} />}
            </Modal>
          </>
        )}
        <Modal opened={create} onClose={() => setCreate(false)} title="Créer un SMSI">
          <Stack>
            <TextInput label="Nom du SMSI" value={name} onChange={(e) => setName(e.currentTarget.value)} />
            <Textarea label="Périmètre" value={scope} onChange={(e) => setScope(e.currentTarget.value)} />
            <Text>Le nouveau périmètre est restreint à ses membres.</Text>
            <Button
              onClick={async () => {
                try {
                  const s = await api<Smsi>('POST', '/api/grc/smsis', {
                    body: { name, scope, timezone: 'Europe/Paris' },
                  });
                  setSelected(s.id);
                  setCreate(false);
                  await qc.invalidateQueries({ queryKey: ['grc', 'smsis'] });
                } catch (e) {
                  setError(e);
                }
              }}
            >
              Créer le périmètre restreint
            </Button>
          </Stack>
        </Modal>
      </Stack>
    </Page>
  );
}
function Registry({
  smsi,
  fixedKind,
  onOpen,
  onEvaluation,
  onRelation,
  onCreate,
}: {
  smsi: string;
  fixedKind?: GrcKind;
  onOpen: (o: GrcObject) => void;
  onEvaluation: (o: GrcObject) => void;
  onRelation: (ref: string) => void;
  onCreate?: (kind: GrcKind) => void;
}) {
  const can = useCan(),
    [kind, setKind] = useState<GrcKind>('measure'),
    [search, setSearch] = useState(''),
    [error, setError] = useState<unknown>(null),
    qc = useQueryClient();
  const k = fixedKind ?? kind;
  const list = useInfiniteQuery({
    queryKey: ['grc', smsi, 'objects', k, search],
    queryFn: ({ pageParam }) =>
      get<{ items: GrcObject[]; total: number; nextOffset: number | null }>(
        `/api/grc/${smsi}/objects?kind=${k}&search=${encodeURIComponent(search)}&offset=${pageParam}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (p) => p.nextOffset ?? undefined,
    enabled: can(GRC_MODULES[k], 'lire'),
  });
  return (
    <Stack>
      {!fixedKind && (
        <Group>
          <Select
            label="Type d’objet SMSI"
            value={kind}
            onChange={(v) => v && setKind(v as GrcKind)}
            data={GRC_KINDS.filter(
              (k) => !['framework', 'requirement', 'mapping'].includes(k) && can(GRC_MODULES[k], 'lire'),
            ).map((k) => ({ value: k, label: GRC_LABELS[k] }))}
          />
          {can(GRC_MODULES[k], 'modifier') && (
            <Button onClick={() => onCreate?.(k)}>Créer {GRC_LABELS[k].toLowerCase()}</Button>
          )}
        </Group>
      )}
      <TextInput
        label="Rechercher dans le registre"
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />
      <ErrorAlert error={error ?? list.error} />
      <Text size="sm">{list.data?.pages[0]?.total ?? 0} fiches</Text>
      {list.data?.pages
        .flatMap((p) => p.items)
        .map((o) => (
          <Card withBorder key={o.id}>
            <Stack>
              <Text fw={600}>{o.name}</Text>
              <Text size="sm">
                Version {o.version} · {o.updatedBy}
              </Text>
              <Text>{String(o.data.description ?? '')}</Text>
              <Group>
                <Button variant="light" onClick={() => onOpen(o)}>
                  Ouvrir la fiche
                </Button>
                <Button variant="default" onClick={() => onRelation('object:' + o.id)}>
                  Liens et preuves
                </Button>
                {o.kind === 'risk' && <Button onClick={() => onEvaluation(o)}>Apprécier / réévaluer</Button>}
                {o.kind === 'treatment' && can('ecarts', 'modifier') && (
                  <Button
                    onClick={async () => {
                      try {
                        const action = await api<GrcObject>('POST', `/api/grc/${smsi}/treatments/${o.id}/action`, {
                          body: { name: 'Mettre en œuvre : ' + o.name, dueAt: null, ownerId: o.data.ownerId ?? null },
                        });
                        await qc.invalidateQueries({ queryKey: ['grc', smsi] });
                        onOpen(action);
                      } catch (e) {
                        setError(e);
                      }
                    }}
                  >
                    Générer une action de traitement
                  </Button>
                )}
              </Group>
            </Stack>
          </Card>
        ))}
      {list.hasNextPage && (
        <Button variant="light" onClick={() => void list.fetchNextPage()}>
          Charger les 50 suivantes
        </Button>
      )}
    </Stack>
  );
}
function Members({ smsi }: { smsi: string }) {
  const qc = useQueryClient(),
    [userId, setUserId] = useState(''),
    [write, setWrite] = useState('read'),
    [error, setError] = useState<unknown>(null);
  const members = useQuery({
    queryKey: ['grc', smsi, 'members'],
    queryFn: () =>
      get<{ userId: string; username: string; displayName: string; write: boolean }[]>(`/api/grc/${smsi}/members`),
  });
  const users = useQuery({
    queryKey: ['grc', 'accounts'],
    queryFn: () => get<{ id: string; username: string; displayName?: string }[]>(`/api/grc/${smsi}/member-candidates`),
  });
  return (
    <Stack>
      <ErrorAlert error={error ?? members.error} />
      <Select
        label="Compte à ajouter"
        searchable
        value={userId || null}
        onChange={(v) => setUserId(v ?? '')}
        data={(users.data ?? []).map((u) => ({ value: u.id, label: u.displayName || u.username }))}
      />
      <Select
        label="Accès au périmètre"
        value={write}
        onChange={(v) => setWrite(v ?? 'read')}
        data={[
          { value: 'read', label: 'Lecture seule' },
          { value: 'write', label: 'Lecture et écriture selon les droits métier' },
        ]}
      />
      <Button
        onClick={async () => {
          try {
            await api('PUT', `/api/grc/${smsi}/members`, { body: { userId, write: write === 'write' } });
            await qc.invalidateQueries({ queryKey: ['grc', smsi] });
          } catch (e) {
            setError(e);
          }
        }}
      >
        Attribuer l’accès
      </Button>
      {members.data?.map((m) => (
        <Card withBorder key={m.userId}>
          <Text>
            {m.displayName || m.username} · {m.write ? 'Écriture' : 'Lecture'}
          </Text>
          <Button
            variant="subtle"
            onClick={async () => {
              try {
                await api('DELETE', `/api/grc/${smsi}/members/${m.userId}`);
                await qc.invalidateQueries({ queryKey: ['grc', smsi] });
              } catch (e) {
                setError(e);
              }
            }}
          >
            Révoquer l’accès
          </Button>
        </Card>
      ))}
    </Stack>
  );
}
function MappingPanel({ smsi }: { smsi: string }) {
  const can = useCan(),
    qc = useQueryClient(),
    [note, setNote] = useState(''),
    [confirm, setConfirm] = useState<GrcObject | null>(null),
    [detail, setDetail] = useState<GrcObject | null>(null),
    [editing, setEditing] = useState<GrcObject | null>(null),
    [error, setError] = useState<unknown>(null);
  const list = useInfiniteQuery({
    queryKey: ['grc', smsi, 'mappings'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      get<{ items: GrcObject[]; nextOffset: number | null }>(
        `/api/grc/${smsi}/objects?kind=mapping&offset=${pageParam}`,
      ),
    getNextPageParam: (p) => p.nextOffset ?? undefined,
  });
  const history = useQuery({
    queryKey: ['grc', smsi, 'mapping-history', detail?.id],
    queryFn: () =>
      get<{ version: number; createdBy: string; createdAt: string; reason: string; snapshot: GrcObject }[]>(
        `/api/grc/${smsi}/objects/${detail!.id}/history`,
      ),
    enabled: !!detail,
  });
  return (
    <Stack>
      <Alert>
        Une correspondance décrit deux exigences de versions précises. Les propositions, y compris d’origine IA, ne
        contribuent à la couverture qu’après validation humaine.
      </Alert>
      <ErrorAlert error={error ?? list.error} />
      {can('conformite', 'modifier') && <MappingForm smsi={smsi} />}
      {list.data?.pages
        .flatMap((p) => p.items)
        .map((m) => (
          <Card withBorder key={m.id}>
            <Text>
              {m.name} · {String(m.data.status)} · {String(m.data.origin)}
            </Text>
            <Text>{String(m.data.justification)}</Text>
            <Text size="sm">
              Fiche version {m.version} · {m.updatedBy} · {new Date(m.updatedAt).toLocaleString('fr-FR')}
            </Text>
            <Button variant="light" onClick={() => setDetail(m)}>
              Historique et détail
            </Button>
            {can('conformite', 'modifier') && (
              <Button variant="subtle" onClick={() => setEditing(m)}>
                Modifier la correspondance
              </Button>
            )}
            <Text>
              Couverture justifiée : {Number(m.data.coverage)} % · {String(m.data.type)}
            </Text>
            <Button
              variant="subtle"
              disabled={!can('import_export', 'exporter') || !can('conformite', 'exporter')}
              onClick={async () => {
                try {
                  await get(`/api/grc/${smsi}/export/authorize?kind=frameworks`);
                  saveBlob('mapping-' + m.id + '.json', JSON.stringify(m, null, 2));
                } catch (e) {
                  setError(e);
                }
              }}
            >
              Exporter la fiche
            </Button>
            {can('conformite', 'administrer') && m.data.status !== 'validated' && (
              <Button onClick={() => setConfirm(m)}>Revue humaine</Button>
            )}
          </Card>
        ))}
      {list.hasNextPage && (
        <Button variant="light" onClick={() => void list.fetchNextPage()}>
          Charger les 50 correspondances suivantes
        </Button>
      )}
      <Modal opened={!!editing} onClose={() => setEditing(null)} title="Modifier la correspondance" size="lg">
        <Alert>
          Une modification remet la correspondance à l’état proposé. Sa couverture validée exige une nouvelle revue
          humaine.
        </Alert>
        {editing && (
          <MappingForm
            key={editing.id + editing.version}
            smsi={smsi}
            object={editing}
            onSaved={() => setEditing(null)}
          />
        )}
      </Modal>
      <Modal
        opened={!!detail}
        onClose={() => setDetail(null)}
        title="Historique de la correspondance"
        closeButtonProps={{ 'aria-label': 'Fermer l’historique' }}
        size="lg"
      >
        <Stack>
          <ErrorAlert error={history.error} />
          {history.data?.map((h) => (
            <Card key={h.version} withBorder>
              <Text fw={600}>
                Version {h.version} · {h.createdBy} · {new Date(h.createdAt).toLocaleString('fr-FR')}
              </Text>
              <Text>{h.reason}</Text>
              <Text component="pre">{JSON.stringify(h.snapshot.data, null, 2)}</Text>
            </Card>
          ))}
        </Stack>
      </Modal>
      <Modal opened={!!confirm} onClose={() => setConfirm(null)} title="Valider la correspondance">
        <Stack>
          <Textarea
            label="Décision et justification de la revue humaine"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
          <Button
            onClick={async () => {
              try {
                await api('POST', `/api/grc/${smsi}/mappings/${confirm!.id}/validate`, {
                  ifMatch: confirm!.version,
                  body: { note, confirm: 'VALIDER' },
                });
                setConfirm(null);
                await qc.invalidateQueries({ queryKey: ['grc', smsi] });
              } catch (e) {
                setError(e);
              }
            }}
          >
            Confirmer la validation humaine
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

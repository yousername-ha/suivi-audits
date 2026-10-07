/* Documents (chiffrés, versionnés) et liens, avec rattachements, présence et contrôle de concurrence. */
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  CopyButton,
  Drawer,
  FileButton,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Tabs,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { CLASSIFICATION_LABELS, CLASSIFICATIONS, type DocumentDetailOut, type DocumentOut, type LinkOut } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, ApiError, download, errorMessage, get } from '../api';
import { ConfirmButton, ErrorAlert, fmtDate, fmtSize, PresenceBar } from '../components/common';
import { usePresence } from '../realtime';
import { useMe } from '../session';

interface Ref {
  ref: string;
  label: string;
  kind: string;
}
const classifOptions = CLASSIFICATIONS.map((c) => ({ value: c, label: CLASSIFICATION_LABELS[c] }));

function useRefs() {
  const q = useQuery({ queryKey: ['refs'], queryFn: () => get<Ref[]>('/api/refs'), staleTime: 300_000 });
  // Une même référence peut exister dans plusieurs référentiels (ex. « 4.4 ») : liste dédoublonnée.
  return [...new Set((q.data ?? []).map((r) => r.ref))];
}

export function DocumentsPage() {
  const me = useMe();
  const canWrite = me.user?.role !== 'ro';
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<string | null>('docs');
  usePresence(id ? `documents/${id}` : 'documents');
  return (
    <Stack maw={1200} mx="auto">
      <Group justify="space-between">
        <Title order={1}>Documents et liens</Title>
        <PresenceBar resource="documents" />
      </Group>
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="docs">Documents</Tabs.Tab>
          <Tabs.Tab value="links">Liens</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="docs" pt="md">
          <DocumentList canWrite={canWrite} onOpen={(d) => nav(`/documents/${d}`)} />
        </Tabs.Panel>
        <Tabs.Panel value="links" pt="md">
          <LinkList canWrite={canWrite} />
        </Tabs.Panel>
      </Tabs>
      <Drawer opened={!!id} onClose={() => nav('/documents')} position="right" size="lg" title="Fiche du document">
        {id && <DocumentDetail id={id} canWrite={canWrite} isAdmin={me.user?.role === 'admin'} onClose={() => nav('/documents')} />}
      </Drawer>
    </Stack>
  );
}

/* ---------------------------------------------------------------- Liste et dépôt */
function DocumentList({ canWrite, onOpen }: { canWrite: boolean; onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [trash, setTrash] = useState('0');
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...(category ? { category } : {}), trash });
  const list = useQuery({ queryKey: ['documents', params.toString()], queryFn: () => get<DocumentOut[]>(`/api/documents?${params}`) });
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => get<string[]>('/api/documents/categories') });
  const [uploading, setUploading] = useState(false);

  const upload = async (files: File[]) => {
    setUploading(true);
    try {
      for (const f of files) {
        await api('POST', '/api/documents', {
          raw: await f.arrayBuffer(),
          headers: { 'X-File-Name': encodeURIComponent(f.name), 'X-Meta': encodeURIComponent(JSON.stringify(category ? { category } : {})) },
        });
      }
      notifications.show({ color: 'teal', message: `${files.length} document(s) déposé(s).` });
      await qc.invalidateQueries({ queryKey: ['documents'] });
    } catch (e) {
      notifications.show({ color: 'red', title: 'Dépôt refusé', message: errorMessage(e) });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Stack>
      <Group align="flex-end" wrap="wrap">
        <TextInput label="Rechercher" placeholder="Titre, fichier, rattachement…" value={q} onChange={(e) => setQ(e.currentTarget.value)} w={260} />
        <Select label="Catégorie" data={cats.data ?? []} value={category} onChange={setCategory} clearable w={200} />
        {canWrite && (
          <SegmentedControl
            value={trash}
            onChange={setTrash}
            data={[
              { value: '0', label: 'Documents' },
              { value: '1', label: 'Corbeille' },
            ]}
            aria-label="Afficher"
          />
        )}
        {canWrite && trash === '0' && (
          <FileButton onChange={(f) => f.length && void upload(f)} multiple>
            {(props) => (
              <Button {...props} loading={uploading}>
                Déposer des documents
              </Button>
            )}
          </FileButton>
        )}
      </Group>
      <ErrorAlert error={list.error} />
      <Card withBorder p={0}>
        <div className="table-wrap">
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Titre</Table.Th>
                <Table.Th>Rattachements</Table.Th>
                <Table.Th>Classification</Table.Th>
                <Table.Th>Modifié</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(list.data ?? []).map((d) => (
                <Table.Tr key={d.id}>
                  <Table.Td>
                    <Anchor component="button" type="button" onClick={() => onOpen(d.id)} fw={600}>
                      {d.title}
                    </Anchor>
                    <Text size="xs" c="dimmed">
                      {d.filename} · {fmtSize(d.size)} · v{d.current_version}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {d.refs.slice(0, 6).map((r) => (
                        <Badge key={r} variant="light" size="sm">
                          {r}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>{CLASSIFICATION_LABELS[d.classification]}</Table.Td>
                  <Table.Td className="nowrap">
                    {fmtDate(d.updated_at)}
                    <Text size="xs" c="dimmed">
                      {d.updated_by}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
              {list.data && !list.data.length && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text c="dimmed" ta="center" py="md">
                      Aucun document.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
    </Stack>
  );
}

/* ---------------------------------------------------------------- Fiche d'un document */
function DocumentDetail({ id, canWrite, isAdmin, onClose }: { id: string; canWrite: boolean; isAdmin: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const refs = useRefs();
  const q = useQuery({ queryKey: ['document', id], queryFn: () => get<DocumentDetailOut>(`/api/documents/${id}`) });
  const d = q.data;
  const [form, setForm] = useState<{ title: string; description: string; category: string; refs: string[]; tags: string[]; classification: string } | null>(null);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [conflict, setConflict] = useState<DocumentOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  usePresence(form ? `documents/${id}` : null, 'edit');

  useEffect(() => {
    if (d && !form) setBaseVersion(d.version);
  }, [d, form]);
  if (q.error) return <ErrorAlert error={q.error} />;
  if (!d) return null;
  const changedByOther = form && baseVersion !== null && d.version !== baseVersion;

  const startEdit = () => {
    setForm({ title: d.title, description: d.description, category: d.category, refs: d.refs, tags: d.tags, classification: d.classification });
    setBaseVersion(d.version);
    setConflict(null);
  };
  const save = async () => {
    if (!form) return;
    setErr(null);
    try {
      await api('PATCH', `/api/documents/${id}`, { body: form, ifMatch: baseVersion ?? d.version });
      setForm(null);
      notifications.show({ color: 'teal', message: 'Document enregistré.' });
      await qc.invalidateQueries({ queryKey: ['document', id] });
    } catch (e) {
      if (e instanceof ApiError && e.status === 412) setConflict((e.data?.current as DocumentOut) ?? null);
      setErr(errorMessage(e));
    }
  };
  const act = async (fn: () => Promise<unknown>, msg: string, close = false) => {
    try {
      await fn();
      notifications.show({ color: 'teal', message: msg });
      await qc.invalidateQueries({ queryKey: ['documents'] });
      if (close) onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };
  const internal = `${location.origin}/d/${d.id}`;

  return (
    <Stack>
      <PresenceBar resource={`documents/${id}`} />
      {d.deleted_at && <Alert color="orange">Document dans la corbeille depuis le {fmtDate(d.deleted_at)}.</Alert>}
      {!form ? (
        <Stack gap="xs">
          <Title order={2} size="h3">
            {d.title}
          </Title>
          {d.description && <Text className="pre">{d.description}</Text>}
          <Group gap={4}>
            {d.refs.map((r) => (
              <Badge key={r} variant="light">
                {r}
              </Badge>
            ))}
            {d.tags.map((t) => (
              <Badge key={t} variant="outline" color="gray">
                {t}
              </Badge>
            ))}
          </Group>
          <Text size="sm" c="dimmed">
            {CLASSIFICATION_LABELS[d.classification]} · {d.category || 'sans catégorie'} · modifié le {fmtDate(d.updated_at)} par {d.updated_by}
          </Text>
          <Text size="xs" c="dimmed" className="mono">
            SHA-256 : {d.sha256}
          </Text>
          <Group>
            <Button onClick={() => download(`/api/documents/${id}/download`)}>Télécharger</Button>
            <CopyButton value={internal}>{({ copied, copy }) => <Button variant="default" onClick={copy}>{copied ? 'Lien copié' : 'Copier le lien interne'}</Button>}</CopyButton>
            {canWrite && !d.deleted_at && (
              <Button variant="default" onClick={startEdit}>
                Modifier
              </Button>
            )}
          </Group>
        </Stack>
      ) : (
        <Stack>
          {changedByOther && !conflict && (
            <Alert color="orange">
              {d.updated_by} vient de modifier ce document. Votre enregistrement sera refusé : rechargez avant de poursuivre.
            </Alert>
          )}
          {conflict && (
            <Alert color="red" title="Conflit">
              {err}
              <Group mt="xs">
                <Button size="xs" onClick={startEdit}>
                  Recharger la version actuelle (v{conflict.version})
                </Button>
              </Group>
            </Alert>
          )}
          {err && !conflict && <Alert color="red">{err}</Alert>}
          <TextInput label="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} />
          <Textarea label="Description" autosize minRows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />
          <TextInput label="Catégorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.currentTarget.value })} />
          <TagsInput label="Rattachements (mesures, écarts, processus…)" data={refs} limit={30} value={form.refs} onChange={(v) => setForm({ ...form, refs: v })} />
          <TagsInput label="Mots-clés" value={form.tags} onChange={(v) => setForm({ ...form, tags: v })} />
          <Select label="Classification" data={classifOptions} value={form.classification} onChange={(v) => v && setForm({ ...form, classification: v })} allowDeselect={false} />
          <Group>
            <Button onClick={save}>Enregistrer</Button>
            <Button variant="default" onClick={() => setForm(null)}>
              Annuler
            </Button>
          </Group>
        </Stack>
      )}

      <Title order={3} size="h5" mt="md">
        Versions
      </Title>
      <div className="table-wrap">
        <Table>
          <Table.Tbody>
            {d.versions.map((v) => (
              <Table.Tr key={v.version}>
                <Table.Td>v{v.version}</Table.Td>
                <Table.Td>
                  <Anchor component="button" type="button" onClick={() => download(`/api/documents/${id}/download?v=${v.version}`)}>
                    {v.filename}
                  </Anchor>
                  <Text size="xs" c="dimmed">
                    {fmtSize(v.size)} · {v.scan_status} {v.comment && `· ${v.comment}`}
                  </Text>
                </Table.Td>
                <Table.Td className="nowrap">
                  {fmtDate(v.uploaded_at)}
                  <Text size="xs" c="dimmed">
                    {v.uploaded_by}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
      {canWrite && !d.deleted_at && (
        <FileButton
          onChange={(f) =>
            f &&
            void act(
              async () => api('POST', `/api/documents/${id}/versions`, { raw: await f.arrayBuffer(), headers: { 'X-File-Name': encodeURIComponent(f.name) } }),
              'Nouvelle version déposée.',
            ).then(() => qc.invalidateQueries({ queryKey: ['document', id] }))
          }
        >
          {(props) => (
            <Button {...props} variant="light" w="fit-content">
              Déposer une nouvelle version
            </Button>
          )}
        </FileButton>
      )}
      {canWrite && (
        <Group mt="md">
          {!d.deleted_at ? (
            <ConfirmButton variant="light" message="Mettre ce document à la corbeille ?" onConfirm={() => act(() => api('DELETE', `/api/documents/${id}`), 'Document mis à la corbeille.', true)}>
              Mettre à la corbeille
            </ConfirmButton>
          ) : (
            <>
              <Button variant="light" onClick={() => act(() => api('POST', `/api/documents/${id}/restore`), 'Document restauré.')}>
                Restaurer
              </Button>
              {isAdmin && (
                <ConfirmButton message="Supprimer définitivement ce document et toutes ses versions ? Cette action est irréversible." onConfirm={() => act(() => api('DELETE', `/api/documents/${id}?purge=1`), 'Document supprimé définitivement.', true)}>
                  Supprimer définitivement
                </ConfirmButton>
              )}
            </>
          )}
        </Group>
      )}
    </Stack>
  );
}

/* ---------------------------------------------------------------- Liens */
function LinkList({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const refs = useRefs();
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: ['links', q], queryFn: () => get<LinkOut[]>(`/api/links${q ? `?q=${encodeURIComponent(q)}` : ''}`) });
  const [edit, setEdit] = useState<(Partial<LinkOut> & { refs: string[]; tags: string[] }) | null>(null);
  const [err, setErr] = useState<string | null>(null);
  usePresence(edit ? `documents/links${edit.id ? '/' + edit.id : ''}` : null, 'edit');

  const save = async () => {
    if (!edit) return;
    setErr(null);
    const body = { title: edit.title ?? '', url: edit.url ?? '', description: edit.description ?? '', category: edit.category ?? '', refs: edit.refs, tags: edit.tags };
    try {
      if (edit.id) await api('PATCH', `/api/links/${edit.id}`, { body, ifMatch: edit.version });
      else await api('POST', '/api/links', { body });
      setEdit(null);
      await qc.invalidateQueries({ queryKey: ['links'] });
    } catch (e) {
      setErr(errorMessage(e));
      if (e instanceof ApiError && e.status === 412 && e.data?.current) {
        const c = e.data.current as LinkOut;
        setEdit({ ...c });
      }
    }
  };

  return (
    <Stack>
      <Group align="flex-end">
        <TextInput label="Rechercher" value={q} onChange={(e) => setQ(e.currentTarget.value)} w={260} />
        {canWrite && <Button onClick={() => setEdit({ refs: [], tags: [] })}>Ajouter un lien</Button>}
      </Group>
      <ErrorAlert error={list.error} />
      <Card withBorder p={0}>
        <div className="table-wrap">
          <Table highlightOnHover>
            <Table.Tbody>
              {(list.data ?? []).map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>
                    <Anchor href={l.url} target="_blank" rel="noopener noreferrer" fw={600}>
                      {l.title}
                    </Anchor>
                    <Text size="xs" c="dimmed" className="mono">
                      {l.url}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {l.refs.map((r) => (
                        <Badge key={r} variant="light" size="sm">
                          {r}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td className="nowrap">
                    {canWrite && (
                      <Group gap={4}>
                        <Button size="compact-sm" variant="default" onClick={() => setEdit({ ...l })}>
                          Modifier
                        </Button>
                        <ConfirmButton size="compact-sm" variant="light" message={`Supprimer le lien « ${l.title} » ?`} onConfirm={() => api('DELETE', `/api/links/${l.id}`).then(() => qc.invalidateQueries({ queryKey: ['links'] }))}>
                          Supprimer
                        </ConfirmButton>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
              {list.data && !list.data.length && (
                <Table.Tr>
                  <Table.Td>
                    <Text c="dimmed" ta="center" py="md">
                      Aucun lien.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
      <Modal opened={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Modifier le lien' : 'Ajouter un lien'} centered>
        {edit && (
          <Stack>
            {err && <Alert color="red">{err}</Alert>}
            <TextInput label="Adresse" description="http(s)://…, file://… ou \\serveur\partage\…" required value={edit.url ?? ''} onChange={(e) => setEdit({ ...edit, url: e.currentTarget.value })} />
            <TextInput label="Titre" value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.currentTarget.value })} />
            <Textarea label="Description" value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.currentTarget.value })} />
            <TagsInput label="Rattachements" data={refs} value={edit.refs} onChange={(v) => setEdit({ ...edit, refs: v })} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEdit(null)}>
                Annuler
              </Button>
              <Button onClick={save}>Enregistrer</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

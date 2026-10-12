/* Documents (chiffrés, versionnés) et liens, avec rattachements, présence et contrôle de concurrence.
   Liste et fiche : tiroir sur petit écran ; côte à côte à partir de 1440 px ; troisième panneau (versions,
   rattachements) à partir de 2560 px. */
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
import {
  CLASSIFICATION_LABELS,
  CLASSIFICATIONS,
  type DocumentDetailOut,
  type DocumentOut,
  type LinkOut,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMediaQuery } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, ApiError, download, errorMessage, get } from '../api';
import { ConfirmButton, ErrorAlert, fmtDate, fmtSize, PresenceBar } from '../components/common';
import { useColonnes, type Colonne } from '../components/Colonnes';
import { usePresence } from '../realtime';
import { useCan } from '../session';
import { DataTable } from '@suivi/ui';

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
  const can = useCan();
  const canWrite = can('documents', 'modifier');
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<string | null>('docs');
  usePresence(id ? `documents/${id}` : 'documents');
  const large = useMediaQuery('(min-width: 90em)');
  const ultra = useMediaQuery('(min-width: 160em)');
  const close = () => nav('/documents');
  const detail = (annexe: boolean) =>
    id && (
      <DocumentDetail
        key={id}
        id={id}
        canWrite={canWrite}
        isAdmin={can('documents', 'administrer')}
        onClose={close}
        annexe={annexe}
      />
    );
  return (
    <Stack className="page">
      <Group justify="space-between">
        <Title order={1}>Documents et liens</Title>
        <PresenceBar resource="documents" />
      </Group>
      <div className={id && large ? 'maitre-detail maitre-detail--ouvert' : 'maitre-detail'}>
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List>
            <Tabs.Tab value="docs">Documents</Tabs.Tab>
            <Tabs.Tab value="links">Liens</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="docs" pt="md">
            <DocumentList canWrite={canWrite} selected={id} onOpen={(d) => nav(`/documents/${d}`)} />
          </Tabs.Panel>
          <Tabs.Panel value="links" pt="md">
            <LinkList canWrite={canWrite} />
          </Tabs.Panel>
        </Tabs>
        {id && large && (
          <aside className="maitre-detail__fiche" aria-label="Fiche du document">
            <Card withBorder>
              <Group justify="space-between" mb="xs">
                <Text fw={600}>Fiche du document</Text>
                <Button variant="subtle" size="xs" onClick={close}>
                  Fermer
                </Button>
              </Group>
              {detail(!!ultra)}
            </Card>
          </aside>
        )}
        {id && ultra && (
          <aside className="maitre-detail__annexe" aria-label="Versions et rattachements">
            <DocumentAnnexe id={id} />
          </aside>
        )}
      </div>
      <Drawer opened={!!id && !large} onClose={close} position="right" size="lg" title="Fiche du document">
        {id && !large && detail(false)}
      </Drawer>
    </Stack>
  );
}

/* ---------------------------------------------------------------- Liste et dépôt */
const COLONNES_DOCS: Colonne[] = [
  { cle: 'titre', libelle: 'Titre', priorite: 1, fixe: true },
  { cle: 'rattachements', libelle: 'Rattachements', priorite: 1 },
  { cle: 'classification', libelle: 'Classification', priorite: 2 },
  { cle: 'categorie', libelle: 'Catégorie', priorite: 3 },
  { cle: 'taille', libelle: 'Taille et version', priorite: 3 },
  { cle: 'modifie', libelle: 'Modifié', priorite: 1 },
];

function DocumentList({
  canWrite,
  onOpen,
  selected,
}: {
  canWrite: boolean;
  onOpen: (id: string) => void;
  selected?: string;
}) {
  const { cls, selecteur } = useColonnes('documents', COLONNES_DOCS);
  const canDelete = useCan()('documents', 'supprimer');
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [trash, setTrash] = useState('0');
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...(category ? { category } : {}), trash });
  const list = useQuery({
    queryKey: ['documents', params.toString()],
    queryFn: () => get<DocumentOut[]>(`/api/documents?${params}`),
  });
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => get<string[]>('/api/documents/categories') });
  const [uploading, setUploading] = useState(false);

  const upload = async (files: File[]) => {
    setUploading(true);
    try {
      for (const f of files) {
        await api('POST', '/api/documents', {
          raw: await f.arrayBuffer(),
          headers: {
            'X-File-Name': encodeURIComponent(f.name),
            'X-Meta': encodeURIComponent(JSON.stringify(category ? { category } : {})),
          },
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
        <TextInput
          label="Rechercher"
          placeholder="Titre, fichier, rattachement…"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          className="champ-m"
        />
        <Select
          label="Catégorie"
          data={cats.data ?? []}
          value={category}
          onChange={setCategory}
          clearable
          className="champ-s"
        />
        {canDelete && (
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
        <div className="pousse-droite">{selecteur}</div>
      </Group>
      <ErrorAlert error={list.error} />
      <DataTable label="Documents">
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Titre</Table.Th>
              <Table.Th className={cls('rattachements')}>Rattachements</Table.Th>
              <Table.Th className={cls('classification')}>Classification</Table.Th>
              <Table.Th className={cls('categorie')}>Catégorie</Table.Th>
              <Table.Th className={cls('taille')}>Taille</Table.Th>
              <Table.Th className={cls('modifie')}>Modifié</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(list.data ?? []).map((d) => (
              <Table.Tr
                key={d.id}
                aria-selected={d.id === selected}
                className={d.id === selected ? 'ligne-choisie' : undefined}
              >
                <Table.Td>
                  <Anchor component="button" type="button" onClick={() => onOpen(d.id)} fw={600}>
                    {d.title}
                  </Anchor>
                  <Text size="xs" c="dimmed">
                    {d.filename} · {fmtSize(d.size)} · v{d.current_version}
                  </Text>
                </Table.Td>
                <Table.Td className={cls('rattachements')}>
                  <Group gap="2xs">
                    {d.refs.slice(0, 6).map((r) => (
                      <Badge key={r} variant="light" size="sm">
                        {r}
                      </Badge>
                    ))}
                  </Group>
                </Table.Td>
                <Table.Td className={cls('classification')}>{CLASSIFICATION_LABELS[d.classification]}</Table.Td>
                <Table.Td className={cls('categorie')}>{d.category}</Table.Td>
                <Table.Td className={[cls('taille'), 'nowrap'].filter(Boolean).join(' ')}>
                  {fmtSize(d.size)} · v{d.current_version}
                </Table.Td>
                <Table.Td className={[cls('modifie'), 'nowrap'].filter(Boolean).join(' ')}>
                  <span className="horodatage">{fmtDate(d.updated_at)}</span>
                  <Text size="xs" c="dimmed">
                    {d.updated_by}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
            {list.data && !list.data.length && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" ta="center" py="md">
                    Aucun document.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </DataTable>
    </Stack>
  );
}

/* ---------------------------------------------------------------- Fiche d'un document */
function DocumentDetail({
  id,
  canWrite,
  isAdmin,
  onClose,
  annexe = false,
}: {
  id: string;
  canWrite: boolean;
  isAdmin: boolean;
  onClose: () => void;
  /** Versions affichées dans le troisième panneau (très grands écrans). */
  annexe?: boolean;
}) {
  const canDelete = useCan()('documents', 'supprimer');
  const qc = useQueryClient();
  const refs = useRefs();
  const q = useQuery({ queryKey: ['document', id], queryFn: () => get<DocumentDetailOut>(`/api/documents/${id}`) });
  const d = q.data;
  const [form, setForm] = useState<{
    title: string;
    description: string;
    category: string;
    refs: string[];
    tags: string[];
    classification: string;
  } | null>(null);
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
    setForm({
      title: d.title,
      description: d.description,
      category: d.category,
      refs: d.refs,
      tags: d.tags,
      classification: d.classification,
    });
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
          <Group gap="2xs">
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
            {CLASSIFICATION_LABELS[d.classification]} · {d.category || 'sans catégorie'} · modifié le{' '}
            <span className="horodatage">{fmtDate(d.updated_at)}</span> par {d.updated_by}
          </Text>
          <Text size="xs" c="dimmed" className="mono">
            SHA-256 : {d.sha256}
          </Text>
          <Group>
            <Button onClick={() => download(`/api/documents/${id}/download`)}>Télécharger</Button>
            <CopyButton value={internal}>
              {({ copied, copy }) => (
                <Button variant="default" onClick={copy}>
                  {copied ? 'Lien copié' : 'Copier le lien interne'}
                </Button>
              )}
            </CopyButton>
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
              {d.updated_by} vient de modifier ce document. Votre enregistrement sera refusé : rechargez avant de
              poursuivre.
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
          <TextInput
            label="Titre"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            autosize
            minRows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
          />
          <TextInput
            label="Catégorie"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.currentTarget.value })}
          />
          <TagsInput
            label="Rattachements (mesures, écarts, processus…)"
            data={refs}
            limit={30}
            value={form.refs}
            onChange={(v) => setForm({ ...form, refs: v })}
          />
          <TagsInput label="Mots-clés" value={form.tags} onChange={(v) => setForm({ ...form, tags: v })} />
          <Select
            label="Classification"
            data={classifOptions}
            value={form.classification}
            onChange={(v) => v && setForm({ ...form, classification: v })}
            allowDeselect={false}
          />
          <Group>
            <Button onClick={save}>Enregistrer</Button>
            <Button variant="default" onClick={() => setForm(null)}>
              Annuler
            </Button>
          </Group>
        </Stack>
      )}

      {!annexe && (
        <>
          <Title order={3} size="h5" mt="md">
            Versions
          </Title>
          <VersionsTable d={d} />
        </>
      )}
      {canWrite && !d.deleted_at && (
        <FileButton
          onChange={(f) =>
            f &&
            void act(
              async () =>
                api('POST', `/api/documents/${id}/versions`, {
                  raw: await f.arrayBuffer(),
                  headers: { 'X-File-Name': encodeURIComponent(f.name) },
                }),
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
      {canDelete && (
        <Group mt="md">
          {!d.deleted_at ? (
            <ConfirmButton
              variant="light"
              message="Mettre ce document à la corbeille ?"
              onConfirm={() => act(() => api('DELETE', `/api/documents/${id}`), 'Document mis à la corbeille.', true)}
            >
              Mettre à la corbeille
            </ConfirmButton>
          ) : (
            <>
              <Button
                variant="light"
                onClick={() => act(() => api('POST', `/api/documents/${id}/restore`), 'Document restauré.')}
              >
                Restaurer
              </Button>
              {isAdmin && (
                <ConfirmButton
                  message="Supprimer définitivement ce document et toutes ses versions ? Cette action est irréversible."
                  onConfirm={() =>
                    act(() => api('DELETE', `/api/documents/${id}?purge=1`), 'Document supprimé définitivement.', true)
                  }
                >
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

function VersionsTable({ d }: { d: DocumentDetailOut }) {
  const id = d.id;
  return (
    <div className="table-wrap" role="region" aria-label="Versions du document" tabIndex={0}>
      <Table>
        <Table.Tbody>
          {d.versions.map((v) => (
            <Table.Tr key={v.version}>
              <Table.Td>v{v.version}</Table.Td>
              <Table.Td>
                <Anchor
                  component="button"
                  type="button"
                  onClick={() => download(`/api/documents/${id}/download?v=${v.version}`)}
                >
                  {v.filename}
                </Anchor>
                <Text size="xs" c="dimmed">
                  {fmtSize(v.size)} · {v.scan_status} {v.comment && `· ${v.comment}`}
                </Text>
              </Table.Td>
              <Table.Td className="nowrap">
                <span className="horodatage">{fmtDate(v.uploaded_at)}</span>
                <Text size="xs" c="dimmed">
                  {v.uploaded_by}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}

/** Troisième panneau (très grands écrans) : historique des versions et rattachements du document. */
function DocumentAnnexe({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['document', id], queryFn: () => get<DocumentDetailOut>(`/api/documents/${id}`) });
  const d = q.data;
  if (!d) return null;
  return (
    <Stack>
      <Card withBorder>
        <Title order={2} size="h5" mb="xs">
          Historique des versions
        </Title>
        <VersionsTable d={d} />
      </Card>
      <Card withBorder>
        <Title order={2} size="h5" mb="xs">
          Rattachements
        </Title>
        {d.refs.length ? (
          <Group gap="2xs">
            {d.refs.map((r) => (
              <Badge key={r} variant="light">
                {r}
              </Badge>
            ))}
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            Aucun rattachement.
          </Text>
        )}
        <Text size="sm" c="dimmed" mt="sm">
          Créé le <span className="horodatage">{fmtDate(d.created_at)}</span> par {d.created_by}.
        </Text>
      </Card>
    </Stack>
  );
}

/* ---------------------------------------------------------------- Liens */
function LinkList({ canWrite }: { canWrite: boolean }) {
  const canDelete = useCan()('documents', 'supprimer');
  const qc = useQueryClient();
  const refs = useRefs();
  const [q, setQ] = useState('');
  const list = useQuery({
    queryKey: ['links', q],
    queryFn: () => get<LinkOut[]>(`/api/links${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  });
  const [edit, setEdit] = useState<(Partial<LinkOut> & { refs: string[]; tags: string[] }) | null>(null);
  const [err, setErr] = useState<string | null>(null);
  usePresence(edit ? `documents/links${edit.id ? '/' + edit.id : ''}` : null, 'edit');

  const save = async () => {
    if (!edit) return;
    setErr(null);
    const body = {
      title: edit.title ?? '',
      url: edit.url ?? '',
      description: edit.description ?? '',
      category: edit.category ?? '',
      refs: edit.refs,
      tags: edit.tags,
    };
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
        <TextInput label="Rechercher" value={q} onChange={(e) => setQ(e.currentTarget.value)} className="champ-m" />
        {canWrite && <Button onClick={() => setEdit({ refs: [], tags: [] })}>Ajouter un lien</Button>}
      </Group>
      <ErrorAlert error={list.error} />
      <Card withBorder p={0}>
        <div className="table-wrap" role="region" aria-label="Liens du document" tabIndex={0}>
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
                    <Group gap="2xs">
                      {l.refs.map((r) => (
                        <Badge key={r} variant="light" size="sm">
                          {r}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td className="nowrap">
                    {canWrite && (
                      <Group gap="2xs">
                        <Button size="compact-sm" variant="default" onClick={() => setEdit({ ...l })}>
                          Modifier
                        </Button>
                        {canDelete && (
                          <ConfirmButton
                            size="compact-sm"
                            variant="light"
                            message={`Supprimer le lien « ${l.title} » ?`}
                            onConfirm={() =>
                              api('DELETE', `/api/links/${l.id}`).then(() =>
                                qc.invalidateQueries({ queryKey: ['links'] }),
                              )
                            }
                          >
                            Supprimer
                          </ConfirmButton>
                        )}
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
      <Modal
        opened={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Modifier le lien' : 'Ajouter un lien'}
        centered
      >
        {edit && (
          <Stack>
            {err && <Alert color="red">{err}</Alert>}
            <TextInput
              label="Adresse"
              description="http(s)://…, file://… ou \\serveur\partage\…"
              required
              value={edit.url ?? ''}
              onChange={(e) => setEdit({ ...edit, url: e.currentTarget.value })}
            />
            <TextInput
              label="Titre"
              value={edit.title ?? ''}
              onChange={(e) => setEdit({ ...edit, title: e.currentTarget.value })}
            />
            <Textarea
              label="Description"
              value={edit.description ?? ''}
              onChange={(e) => setEdit({ ...edit, description: e.currentTarget.value })}
            />
            <TagsInput
              label="Rattachements"
              data={refs}
              value={edit.refs}
              onChange={(v) => setEdit({ ...edit, refs: v })}
            />
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

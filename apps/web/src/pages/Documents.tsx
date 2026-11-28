/* Documents (chiffrés, versionnés) et liens, avec rattachements, présence et contrôle de concurrence.
   Liste et fiche : tiroir sur petit écran ; côte à côte à partir de 1440 px ; troisième panneau (versions,
   rattachements) à partir de 2560 px.
   Style « Verre » (dessin DocDocuments validé par le RSSI le 28/11/2026, DocumentsVerre.tsx) : onglets en rail avec leur
   nombre, quatre tuiles, liste en lignes de verre avec puces de classification et corbeille, document choisi à droite
   (le premier par défaut), zone de dépôt par glisser-déposer ; la fiche existante s'ouvre dans un tiroir. Les autres
   styles gardent le rendu ci-dessous. */
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
  ActionIcon,
  MultiSelect,
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
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  CLASSIFICATION_LABELS,
  CLASSIFICATIONS,
  type DocumentDetailOut,
  type DocumentOut,
  type LinkOut,
  type TagCount,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Page, PageHeader } from '@suivi/ui';
import { useMediaQuery } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, ApiError, download, errorMessage, get } from '../api';
import {
  BoiteOutils,
  ListeFiltreMultiple,
  Surligne,
  type CritereActif,
  type CriterePuces,
} from '../components/BarreOutils';
import { compterPuces } from '../components/recherche-liste';
import { ConfirmButton, ErrorAlert, fmtDate, fmtSize, PresenceBar } from '../components/common';
import { useColonnes, type Colonne } from '../components/Colonnes';
import { usePresence } from '../realtime';
import { useCan, useMe } from '../session';
import { ficheCliquable } from '../fiche-cliquable';
import { DataTable } from '@suivi/ui';
import { filtrerClassification, pucesClassification, tuilesDocuments } from './documents-verre';
import { ListeDocumentsVerre, PanneauDocumentVerre, TuilesDocumentsVerre, ZoneDepotVerre } from './DocumentsVerre';

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

/** Étiquettes déjà utilisées avec leur nombre d'emplois : valeurs du filtre et suggestions de saisie. */
function useEtiquettes(portee: 'documents' | 'liens' | 'tous') {
  return useQuery({
    queryKey: ['etiquettes', portee],
    queryFn: () => get<TagCount[]>(`/api/documents/tags?portee=${portee}`),
    staleTime: 60_000,
  });
}
const optionsEtiquettes = (t?: TagCount[]) => (t ?? []).map((e) => ({ value: e.tag, label: `${e.tag} (${e.count})` }));
/** Pastilles des étiquettes filtrées : une par étiquette, retirable seule. */
const criteresEtiquettes = (tags: string[], setTags: (t: string[]) => void): CritereActif[] =>
  tags.map((t) => ({
    cle: 'etiquette:' + t,
    libelle: 'Étiquette',
    valeur: t,
    retirer: () => setTags(tags.filter((x) => x !== t)),
  }));

/** Saisie d'étiquettes : une étiquette qui ne diffère d'une étiquette existante que par la casse est refusée
 *  (« rgpd » si « RGPD » existe) ; un doublon dans la même liste est ignoré. */
function saisirEtiquettes(existantes: string[], actuelles: string[], proposees: string[]): string[] {
  const gardees = proposees.filter((t) => actuelles.includes(t));
  const acceptees: string[] = [];
  for (const t of proposees.filter((x) => !actuelles.includes(x))) {
    const existante = existantes.find((e) => e !== t && e.toLowerCase() === t.toLowerCase());
    if (existante) {
      notifications.show({
        color: 'orange',
        title: 'Étiquette déjà existante',
        message: `« ${existante} » existe déjà : choisissez-la dans la liste.`,
      });
    } else if (![...gardees, ...acceptees].some((g) => g.toLowerCase() === t.toLowerCase())) {
      acceptees.push(t);
    }
  }
  return [...gardees, ...acceptees];
}

type CleTri = 'modifie' | 'titre' | 'categorie' | 'classification' | 'taille';
interface OrdreTri {
  tri: CleTri;
  ordre: 'asc' | 'desc';
}
const TRI_DEFAUT: OrdreTri = { tri: 'modifie', ordre: 'desc' };
/** Clés de tri (style « Verre », liste sans titres de colonnes : choix dans une liste, sens par un bouton). */
const LIBELLES_TRI: { value: CleTri; label: string }[] = [
  { value: 'modifie', label: 'Dernière modification' },
  { value: 'titre', label: 'Titre' },
  { value: 'categorie', label: 'Catégorie' },
  { value: 'classification', label: 'Classification' },
  { value: 'taille', label: 'Taille' },
];

/** Liste des documents (recherche, catégorie, étiquettes, tri, corbeille) et liste de base sans recherche ni filtre
    (même requête que la liste quand rien n'est filtré) : nombres des puces et seuil de la recherche. */
function useListeDocuments(f: { q: string; category: string | null; tags: string[]; ordre: OrdreTri; trash: string }) {
  const params = new URLSearchParams({
    ...(f.q ? { q: f.q } : {}),
    ...(f.category ? { category: f.category } : {}),
    ...(f.tags.length ? { tags: f.tags.join(',') } : {}),
    tri: f.ordre.tri,
    ordre: f.ordre.ordre,
    trash: f.trash,
  });
  const list = useQuery({
    queryKey: ['documents', params.toString()],
    queryFn: () => get<DocumentOut[]>(`/api/documents?${params}`),
  });
  const paramsBase = new URLSearchParams({ tri: f.ordre.tri, ordre: f.ordre.ordre, trash: f.trash });
  const base = useQuery({
    queryKey: ['documents', paramsBase.toString()],
    queryFn: () => get<DocumentOut[]>(`/api/documents?${paramsBase}`),
  });
  return { list, base };
}

/** Dépôt de documents (bouton de l'en-tête et zone de glisser-déposer du style « Verre ») : un envoi par fichier. */
function useDepotDocuments() {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const upload = async (files: File[], meta: { category: string | null; tags: string[] }) => {
    setUploading(true);
    try {
      for (const f of files) {
        await api('POST', '/api/documents', {
          raw: await f.arrayBuffer(),
          headers: {
            'X-File-Name': encodeURIComponent(f.name),
            // Un dépôt fait pendant un filtrage reprend la catégorie et les étiquettes filtrées.
            'X-Meta': encodeURIComponent(
              JSON.stringify({
                ...(meta.category ? { category: meta.category } : {}),
                ...(meta.tags.length ? { tags: meta.tags } : {}),
              }),
            ),
          },
        });
      }
      notifications.show({ color: 'teal', message: `${files.length} document(s) déposé(s).` });
      await qc.invalidateQueries({ queryKey: ['documents'] });
      await qc.invalidateQueries({ queryKey: ['etiquettes'] });
    } catch (e) {
      notifications.show({ color: 'red', title: 'Dépôt refusé', message: errorMessage(e) });
    } finally {
      setUploading(false);
    }
  };
  return { uploading, upload };
}

/** En-tête de colonne triable : un second clic inverse le sens ; l'état est annoncé par aria-sort. Plus d'entonnoir
    (refonte Verre, 27/11/2026) : les filtres sont dans la barre de la liste. */
function EnteteTri({
  cle,
  libelle,
  courant,
  onChange,
  className,
}: {
  cle: CleTri;
  libelle: string;
  courant: OrdreTri;
  onChange: (o: OrdreTri) => void;
  className?: string;
}) {
  const actif = courant.tri === cle;
  const suivant = actif
    ? courant.ordre === 'asc'
      ? 'desc'
      : 'asc'
    : cle === 'modifie' || cle === 'taille'
      ? 'desc'
      : 'asc';
  const tri = (
    <UnstyledButton type="button" className="entete-tri" onClick={() => onChange({ tri: cle, ordre: suivant })}>
      {libelle}
      {actif ? (courant.ordre === 'asc' ? ' ▲' : ' ▼') : ''}
    </UnstyledButton>
  );
  return (
    <Table.Th className={className} aria-sort={actif ? (courant.ordre === 'asc' ? 'ascending' : 'descending') : 'none'}>
      {tri}
    </Table.Th>
  );
}

/** Pastilles d'étiquettes ; un clic ajoute l'étiquette au filtre de la liste. */
function Etiquettes({ tags, onChoisir }: { tags: string[]; onChoisir?: (t: string) => void }) {
  return (
    <Group gap="2xs">
      {tags.map((t) =>
        onChoisir ? (
          <Badge
            key={t}
            component="button"
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Filtrer sur l’étiquette ${t}`}
            onClick={() => onChoisir(t)}
          >
            {t}
          </Badge>
        ) : (
          <Badge key={t} variant="outline" size="sm">
            {t}
          </Badge>
        ),
      )}
    </Group>
  );
}

export function DocumentsPage() {
  const verre = useMe().appearance.style === 'verre';
  return verre ? <DocumentsPageVerre /> : <DocumentsPageClassique />;
}

function DocumentsPageClassique() {
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

/* ---------------------------------------------------------------- Style « Verre » */
/** Page en style « Verre » : mêmes requêtes, mêmes droits et même fiche que le rendu classique. Le document montré à
    droite est celui de l'adresse (/documents/:id), à défaut le premier de la liste affichée. */
function DocumentsPageVerre() {
  const can = useCan();
  const canWrite = can('documents', 'modifier');
  const canDelete = can('documents', 'supprimer');
  const isAdmin = can('documents', 'administrer');
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  usePresence(id ? `documents/${id}` : 'documents');
  const [tab, setTab] = useState<string | null>('docs');
  const [fiche, setFiche] = useState(false);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [classification, setClassification] = useState<string | null>(null);
  const [ordre, setOrdre] = useState<OrdreTri>(TRI_DEFAUT);
  const [trash, setTrash] = useState('0');
  const etiquettes = useEtiquettes('documents');
  const { list, base } = useListeDocuments({ q, category, tags, ordre, trash });
  const { uploading, upload } = useDepotDocuments();
  // Registre (hors corbeille, sans filtre) pour les tuiles et le rail ; nombre de documents de la corbeille ; nombre de
  // liens. Mêmes clés que les listes : réponses partagées.
  const registre = useQuery({
    queryKey: ['documents', 'tri=modifie&ordre=desc&trash=0'],
    queryFn: () => get<DocumentOut[]>('/api/documents?tri=modifie&ordre=desc&trash=0'),
  });
  const corbeille = useQuery({
    queryKey: ['documents', 'tri=modifie&ordre=desc&trash=1'],
    queryFn: () => get<DocumentOut[]>('/api/documents?tri=modifie&ordre=desc&trash=1'),
    enabled: canDelete,
  });
  const liens = useQuery({
    queryKey: ['links', 'tri=modifie'],
    queryFn: () => get<LinkOut[]>('/api/links?tri=modifie'),
  });
  const affiches = filtrerClassification(list.data ?? [], classification);
  const choisi = id ?? affiches[0]?.id;
  const detail = useQuery({
    queryKey: ['document', choisi],
    queryFn: () => get<DocumentDetailOut>(`/api/documents/${choisi}`),
    enabled: !!choisi,
  });
  const deposer = (f: File[]) => void upload(f, { category, tags });
  const nouvelleVersion = async (docId: string, f: File) => {
    try {
      await api('POST', `/api/documents/${docId}/versions`, {
        raw: await f.arrayBuffer(),
        headers: { 'X-File-Name': encodeURIComponent(f.name) },
      });
      notifications.show({ color: 'teal', message: 'Nouvelle version déposée.' });
      await qc.invalidateQueries({ queryKey: ['documents'] });
      await qc.invalidateQueries({ queryKey: ['document', docId] });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };
  const ajouterEtiquette = (t: string) => setTags((cur) => (cur.includes(t) ? cur : [...cur, t]));
  const toutEffacer = () => {
    setQ('');
    setCategory(null);
    setTags([]);
    setClassification(null);
  };
  const puces: CriterePuces[] = [
    {
      cle: 'classification',
      libelle: 'Classification',
      valeur: classification,
      options: pucesClassification(base.data ?? []),
      onChange: setClassification,
    },
    {
      cle: 'categorie',
      libelle: 'Catégorie',
      valeur: category,
      options: compterPuces(base.data ?? [], (d) => d.category),
      onChange: setCategory,
    },
  ];
  const total = base.isPending ? undefined : base.data?.length;
  const nombre = (n: number | undefined) => (n === undefined ? '' : ` · ${n}`);
  const d = detail.data;
  return (
    <Page>
      <PageHeader
        title="Documents et liens"
        description="Le registre documentaire du SMSI : versions, classification et rattachements."
        actions={
          <>
            {/* Bouton principal : variante pleine, dégradé violet des boutons principaux du style « Verre » (verre.css). */}
            {canWrite && tab === 'docs' && trash === '0' && (
              <FileButton onChange={(f) => f.length && deposer(f)} multiple>
                {(props) => (
                  <Button {...props} variant="filled" loading={uploading}>
                    Déposer des documents
                  </Button>
                )}
              </FileButton>
            )}
            <PresenceBar resource="documents" />
          </>
        }
      />
      <Tabs value={tab} onChange={setTab} className="docv-onglets">
        <Tabs.List aria-label="Documents et liens">
          <Tabs.Tab value="docs">Documents{nombre(registre.data?.length)}</Tabs.Tab>
          <Tabs.Tab value="links">Liens{nombre(liens.data?.length)}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="docs" pt="md">
          <Stack>
            {registre.data && <TuilesDocumentsVerre t={tuilesDocuments(registre.data, Date.now())} />}
            <div className="docv">
              <section className="docv-liste" aria-label={trash === '1' ? 'Corbeille' : 'Documents'}>
                <BoiteOutils
                  label="Outils des documents"
                  titre={
                    total !== undefined && (
                      <h2 className="docv-liste__titre">
                        {total} document{total > 1 ? 's' : ''}
                        {trash === '1' && ' dans la corbeille'}
                      </h2>
                    )
                  }
                  total={total ?? 0}
                  affiches={affiches.length}
                  recherche={{
                    label: 'Rechercher dans les documents',
                    placeholder: 'Rechercher un document',
                    value: q,
                    onChange: setQ,
                  }}
                  puces={puces}
                  criteres={criteresEtiquettes(tags, setTags)}
                  onToutEffacer={toutEffacer}
                  filtres={{
                    actifs: tags.length ? 1 : 0,
                    onReinitialiser: () => setTags([]),
                    contenu: (
                      <ListeFiltreMultiple
                        libelle="Étiquettes"
                        description="Toutes les étiquettes cochées sont exigées."
                        valeurs={tags}
                        options={optionsEtiquettes(etiquettes.data)}
                        onChange={setTags}
                      />
                    ),
                  }}
                >
                  {canDelete && (
                    <Button
                      variant="default"
                      aria-pressed={trash === '1'}
                      onClick={() => {
                        setTrash(trash === '1' ? '0' : '1');
                        if (id) nav('/documents');
                      }}
                    >
                      Corbeille{nombre(corbeille.data?.length)}
                    </Button>
                  )}
                  <Group gap="2xs" wrap="nowrap" className="docv-tri">
                    <Select
                      aria-label="Trier par"
                      className="liste-outils__tri"
                      data={LIBELLES_TRI}
                      value={ordre.tri}
                      onChange={(v) =>
                        v &&
                        setOrdre({
                          tri: v as CleTri,
                          ordre: v === 'modifie' || v === 'taille' ? 'desc' : 'asc',
                        })
                      }
                      allowDeselect={false}
                    />
                    <ActionIcon
                      variant="default"
                      size="lg"
                      aria-label={ordre.ordre === 'asc' ? 'Ordre croissant, inverser' : 'Ordre décroissant, inverser'}
                      title={ordre.ordre === 'asc' ? 'Ordre croissant' : 'Ordre décroissant'}
                      onClick={() => setOrdre({ ...ordre, ordre: ordre.ordre === 'asc' ? 'desc' : 'asc' })}
                    >
                      {ordre.ordre === 'asc' ? '▲' : '▼'}
                    </ActionIcon>
                  </Group>
                </BoiteOutils>
                <ErrorAlert error={list.error} />
                {list.data && (
                  <ListeDocumentsVerre
                    documents={affiches}
                    choisi={choisi}
                    recherche={q}
                    onChoisir={(docId) => nav(`/documents/${docId}`)}
                  />
                )}
                {canWrite && trash === '0' && <ZoneDepotVerre enCours={uploading} onDeposer={deposer} />}
              </section>
              <section className="docv-panneau" aria-label="Document choisi">
                <ErrorAlert error={detail.error} />
                {d ? (
                  <PanneauDocumentVerre
                    d={d}
                    peutDeposerVersion={canWrite && !d.deleted_at}
                    onTelecharger={() => download(`/api/documents/${d.id}/download`)}
                    onTelechargerVersion={(v) => download(`/api/documents/${d.id}/download?v=${v}`)}
                    onNouvelleVersion={(f) => void nouvelleVersion(d.id, f)}
                    onFiche={() => setFiche(true)}
                    onEtiquette={ajouterEtiquette}
                    libelleFiche={canWrite || canDelete ? 'Modifier la fiche' : 'Ouvrir la fiche'}
                  />
                ) : (
                  !detail.error && (
                    <Text size="sm" c="dimmed">
                      Choisissez un document dans la liste pour l’afficher ici.
                    </Text>
                  )
                )}
              </section>
            </div>
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="links" pt="md">
          <LinkList canWrite={canWrite} />
        </Tabs.Panel>
      </Tabs>
      <Drawer
        opened={fiche && !!choisi}
        onClose={() => setFiche(false)}
        position="right"
        size="lg"
        title="Fiche du document"
      >
        {fiche && choisi && (
          <DocumentDetail
            key={choisi}
            id={choisi}
            canWrite={canWrite}
            isAdmin={isAdmin}
            onClose={() => {
              setFiche(false);
              nav('/documents');
            }}
          />
        )}
      </Drawer>
    </Page>
  );
}

/* ---------------------------------------------------------------- Liste et dépôt */
const COLONNES_DOCS: Colonne[] = [
  { cle: 'titre', libelle: 'Titre', priorite: 1, fixe: true },
  { cle: 'rattachements', libelle: 'Rattachements', priorite: 1 },
  { cle: 'etiquettes', libelle: 'Étiquettes', priorite: 2 },
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
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [ordre, setOrdre] = useState<OrdreTri>(TRI_DEFAUT);
  const [trash, setTrash] = useState('0');
  const etiquettes = useEtiquettes('documents');
  const { list, base } = useListeDocuments({ q, category, tags, ordre, trash });
  const { uploading, upload } = useDepotDocuments();

  const toutEffacer = () => {
    setQ('');
    setCategory(null);
    setTags([]);
    setTrash('0');
  };
  const puces: CriterePuces[] = [
    {
      cle: 'categorie',
      libelle: 'Catégorie',
      valeur: category,
      options: compterPuces(base.data ?? [], (d) => d.category),
      onChange: setCategory,
    },
  ];
  return (
    <Stack>
      {/* Recherche et filtres des listes (refonte Verre, 27/11/2026) : recherche, catégorie en puces avec leur nombre,
          étiquettes (cases à cocher, toutes exigées) dans « Plus de filtres » ; la corbeille, le choix des colonnes et le
          dépôt restent toujours visibles. */}
      <BoiteOutils
        label="Outils des documents"
        total={base.isPending ? 0 : base.data?.length}
        affiches={list.data?.length}
        recherche={{
          label: 'Rechercher dans les documents',
          placeholder: 'Titre, fichier, rattachement…',
          value: q,
          onChange: setQ,
        }}
        puces={puces}
        criteres={criteresEtiquettes(tags, setTags)}
        onToutEffacer={toutEffacer}
        filtres={{
          actifs: tags.length ? 1 : 0,
          onReinitialiser: () => setTags([]),
          contenu: (
            <ListeFiltreMultiple
              libelle="Étiquettes"
              description="Toutes les étiquettes cochées sont exigées."
              valeurs={tags}
              options={optionsEtiquettes(etiquettes.data)}
              onChange={setTags}
            />
          ),
        }}
        ajout={
          <Group gap="xs">
            {selecteur}
            {canWrite && trash === '0' && (
              <FileButton onChange={(f) => f.length && void upload(f, { category, tags })} multiple>
                {(props) => (
                  <Button {...props} loading={uploading}>
                    Déposer des documents
                  </Button>
                )}
              </FileButton>
            )}
          </Group>
        }
      >
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
      </BoiteOutils>
      <ErrorAlert error={list.error} />
      <DataTable label="Documents">
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <EnteteTri cle="titre" libelle="Titre" courant={ordre} onChange={setOrdre} />
              <Table.Th className={cls('rattachements')}>Rattachements</Table.Th>
              <Table.Th className={cls('etiquettes')}>Étiquettes</Table.Th>
              <EnteteTri
                cle="classification"
                libelle="Classification"
                courant={ordre}
                onChange={setOrdre}
                className={cls('classification')}
              />
              <EnteteTri
                cle="categorie"
                libelle="Catégorie"
                courant={ordre}
                onChange={setOrdre}
                className={cls('categorie')}
              />
              <EnteteTri cle="taille" libelle="Taille" courant={ordre} onChange={setOrdre} className={cls('taille')} />
              <EnteteTri
                cle="modifie"
                libelle="Modifié"
                courant={ordre}
                onChange={setOrdre}
                className={cls('modifie')}
              />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(list.data ?? []).map((d) => (
              <Table.Tr
                key={d.id}
                {...ficheCliquable(() => onOpen(d.id), `Afficher ${d.title}`)}
                aria-selected={d.id === selected}
                className={d.id === selected ? 'ligne-choisie' : undefined}
              >
                <Table.Td>
                  <Anchor component="button" type="button" onClick={() => onOpen(d.id)} fw={600}>
                    <Surligne texte={d.title} recherche={q} />
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
                <Table.Td className={cls('etiquettes')}>
                  <Etiquettes
                    tags={d.tags.slice(0, 6)}
                    onChoisir={(t) => setTags((cur) => (cur.includes(t) ? cur : [...cur, t]))}
                  />
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
                <Table.Td colSpan={7}>
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
  const suggestions = useEtiquettes('tous');
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
      await qc.invalidateQueries({ queryKey: ['etiquettes'] });
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
          <TagsInput
            label="Étiquettes"
            description="Pour classer et filtrer. Choisissez une étiquette existante ou tapez-en une nouvelle (la casse ne crée pas une autre étiquette)."
            data={(suggestions.data ?? []).map((e) => e.tag)}
            limit={30}
            value={form.tags}
            onChange={(v) =>
              setForm({
                ...form,
                tags: saisirEtiquettes(
                  (suggestions.data ?? []).map((e) => e.tag),
                  form.tags,
                  v,
                ),
              })
            }
          />
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
  const [tags, setTags] = useState<string[]>([]);
  const [tri, setTri] = useState<'modifie' | 'titre' | 'categorie'>('modifie');
  const etiquettes = useEtiquettes('liens');
  const suggestions = useEtiquettes('tous');
  const params = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(tags.length ? { tags: tags.join(',') } : {}),
    tri,
  });
  const list = useQuery({
    queryKey: ['links', params.toString()],
    queryFn: () => get<LinkOut[]>(`/api/links?${params}`),
  });
  // Liste sans recherche ni étiquette (même requête que la liste quand rien n'est filtré) : seuil de la recherche.
  const paramsBase = new URLSearchParams({ tri });
  const base = useQuery({
    queryKey: ['links', paramsBase.toString()],
    queryFn: () => get<LinkOut[]>(`/api/links?${paramsBase}`),
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
      await qc.invalidateQueries({ queryKey: ['etiquettes'] });
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
      {/* Recherche et filtres des listes (refonte Verre, 27/11/2026) : recherche, étiquettes (toutes exigées) dans « Plus de
          filtres », tri toujours visible ; la liste des liens n'a pas de titres de colonnes. L'ajout au bout de la ligne. */}
      <BoiteOutils
        label="Outils des liens"
        total={base.isPending ? 0 : base.data?.length}
        affiches={list.data?.length}
        recherche={{ label: 'Rechercher dans les liens', value: q, onChange: setQ }}
        criteres={criteresEtiquettes(tags, setTags)}
        onToutEffacer={() => {
          setQ('');
          setTags([]);
        }}
        filtres={{
          actifs: tags.length ? 1 : 0,
          onReinitialiser: () => setTags([]),
          contenu: (
            <MultiSelect
              label="Étiquettes"
              description="Toutes les étiquettes choisies"
              placeholder={tags.length ? undefined : 'Toutes'}
              data={optionsEtiquettes(etiquettes.data)}
              value={tags}
              onChange={setTags}
              searchable
              clearable
              nothingFoundMessage="Aucune étiquette"
              comboboxProps={{ withinPortal: false }}
            />
          ),
        }}
        ajout={canWrite && <Button onClick={() => setEdit({ refs: [], tags: [] })}>Ajouter un lien</Button>}
      >
        <Select
          label="Trier par"
          className="liste-outils__tri"
          data={[
            { value: 'modifie', label: 'Dernière modification' },
            { value: 'titre', label: 'Titre' },
            { value: 'categorie', label: 'Catégorie' },
          ]}
          value={tri}
          onChange={(v) => setTri((v as typeof tri) ?? 'modifie')}
          allowDeselect={false}
        />
      </BoiteOutils>
      <ErrorAlert error={list.error} />
      <Card withBorder p={0}>
        <div className="table-wrap" role="region" aria-label="Liens du document" tabIndex={0}>
          <Table highlightOnHover>
            <Table.Tbody>
              {(list.data ?? []).map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>
                    <Anchor href={l.url} target="_blank" rel="noopener noreferrer" fw={600}>
                      <Surligne texte={l.title} recherche={q} />
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
                  <Table.Td>
                    <Etiquettes
                      tags={l.tags}
                      onChoisir={(t) => setTags((cur) => (cur.includes(t) ? cur : [...cur, t]))}
                    />
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
            <TagsInput
              label="Étiquettes"
              description="Pour classer et filtrer. Choisissez une étiquette existante ou tapez-en une nouvelle (la casse ne crée pas une autre étiquette)."
              data={(suggestions.data ?? []).map((e) => e.tag)}
              limit={30}
              value={edit.tags}
              onChange={(v) =>
                setEdit({
                  ...edit,
                  tags: saisirEtiquettes(
                    (suggestions.data ?? []).map((e) => e.tag),
                    edit.tags,
                    v,
                  ),
                })
              }
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

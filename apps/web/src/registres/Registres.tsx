/* Registres, périmètres hérités et droits par ressource (ADR 0043). Liste des registres accessibles, fiche d'un registre
   (éléments, périmètres avec aperçu de l'impact, droits, paramètres). L'affichage ne décide d'aucun accès : les boutons
   suivent `peut`, mais l'API refuse tout ce que la personne n'a pas le droit de faire. */
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  REGISTRE_KINDS,
  REGISTRE_LABELS,
  ROLE_LABELS,
  ROLES_RESSOURCE,
  type GrcObject,
  type RegistreDto,
  type RoleRessource,
} from '@suivi/shared';
import { ConfirmButton, DataTable, Page, PageHeader, StatusChip } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';

interface Perimetre {
  id: string;
  name: string;
}
interface Droit {
  id: string;
  subjectType: 'utilisateur' | 'groupe';
  subjectId: string;
  role: RoleRessource;
  libelle: string;
  grantedBy: string;
  grantedAt: string;
}
interface Impact {
  ajoutes: Perimetre[];
  retires: Perimetre[];
  elements: number;
  series: number;
  liens: number;
  droits: number;
}
const KIND_OPTIONS = REGISTRE_KINDS.map((k) => ({ value: k, label: REGISTRE_LABELS[k] }));
const ROLE_OPTIONS = ROLES_RESSOURCE.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
const ELEMENT_LABELS: Record<string, string> = {
  action: 'Action',
  nonconformity: 'Écart',
  task_series: 'Série de tâches',
};

const usePerimetres = () => useQuery({ queryKey: ['grc', 'smsis'], queryFn: () => get<Perimetre[]>('/api/grc/smsis') });

function Puces({ r }: { r: RegistreDto }) {
  return (
    <Group gap="xs">
      {r.parDefaut && <StatusChip etat="neutre">Par défaut</StatusChip>}
      {r.restreint && <StatusChip etat="attention">Restreint</StatusChip>}
      {r.archived && <StatusChip etat="neutre">Archivé</StatusChip>}
    </Group>
  );
}
const perimetresTexte = (r: RegistreDto) =>
  [
    ...r.perimetres.map((p) => p.name),
    ...(r.autresPerimetres ? [`${r.autresPerimetres} autre(s) périmètre(s) non accessible(s)`] : []),
  ].join(', ');
const roleTexte = (r: RegistreDto) =>
  r.role ? ROLE_LABELS[r.role] : r.peut.gerer ? 'Droits du module' : r.peut.contribuer ? 'Contribution' : 'Lecture';

export function RegistresPage() {
  const { id } = useParams();
  return id ? <FicheRegistre id={id} /> : <ListeRegistres />;
}

/* ------------------------------------------------------------------------------------------------------- liste */
function ListeRegistres() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [kind, setKind] = useState<string | null>(null);
  const [archives, setArchives] = useState(false);
  const [creation, setCreation] = useState(false);
  const liste = useQuery({
    queryKey: ['registres', kind, archives],
    queryFn: () => get<{ items: RegistreDto[] }>(`/api/registres?archives=${archives}${kind ? `&kind=${kind}` : ''}`),
  });
  return (
    <Page>
      <PageHeader
        title="Registres"
        description="Un registre rassemble des actions, des écarts ou des tâches récurrentes et porte leurs périmètres : les éléments les héritent sans copie. Les droits se donnent à une personne ou à un groupe sur un registre entier."
        actions={<Button onClick={() => setCreation(true)}>Nouveau registre</Button>}
      />
      <Stack>
        <Group align="end">
          <Select
            label="Famille"
            clearable
            placeholder="Toutes les familles"
            data={KIND_OPTIONS}
            value={kind}
            onChange={setKind}
          />
          <Checkbox
            label="Afficher les registres archivés"
            checked={archives}
            onChange={(e) => setArchives(e.currentTarget.checked)}
          />
        </Group>
        <ErrorAlert error={liste.error} />
        <DataTable label="Registres accessibles, défilement horizontal possible">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Registre</Table.Th>
                <Table.Th>Famille</Table.Th>
                <Table.Th>Périmètres</Table.Th>
                <Table.Th>Éléments</Table.Th>
                <Table.Th>Votre accès</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(liste.data?.items ?? []).map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <Text component={Link} to={`/registres/${r.id}`} fw={600}>
                      {r.name}
                    </Text>
                    <Puces r={r} />
                  </Table.Td>
                  <Table.Td>{REGISTRE_LABELS[r.kind]}</Table.Td>
                  <Table.Td>{perimetresTexte(r)}</Table.Td>
                  <Table.Td>{r.elements}</Table.Td>
                  <Table.Td>{roleTexte(r)}</Table.Td>
                </Table.Tr>
              ))}
              {liste.data && !liste.data.items.length && (
                <Table.Tr>
                  <Table.Td colSpan={5}>Aucun registre accessible.</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </DataTable>
      </Stack>
      <NouveauRegistre
        ouvert={creation}
        onClose={() => setCreation(false)}
        onCree={async (r) => {
          await qc.invalidateQueries({ queryKey: ['registres'] });
          setCreation(false);
          nav(`/registres/${r.id}`);
        }}
      />
    </Page>
  );
}

function NouveauRegistre({
  ouvert,
  onClose,
  onCree,
}: {
  ouvert: boolean;
  onClose: () => void;
  onCree: (r: RegistreDto) => void | Promise<void>;
}) {
  const perimetres = usePerimetres();
  const [kind, setKind] = useState<string | null>('plan_actions');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [autres, setAutres] = useState<string[]>([]);
  const [restreint, setRestreint] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const options = (perimetres.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const valide = !!kind && !!name.trim() && !!referenceId;
  const creer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api<RegistreDto>('POST', '/api/registres', {
        body: { kind, name, description, referenceId, perimetres: autres, restreint },
      });
      await onCree(r);
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Modal opened={ouvert} onClose={onClose} title="Nouveau registre">
      <Stack>
        <ErrorAlert error={erreur} />
        <Select label="Famille" required allowDeselect={false} data={KIND_OPTIONS} value={kind} onChange={setKind} />
        <TextInput label="Nom" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Textarea
          label="Description"
          autosize
          minRows={2}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Select
          label="Périmètre de référence"
          description="Politique métier et fuseau des éléments : il ne peut plus être retiré du registre."
          required
          searchable
          data={options}
          value={referenceId}
          onChange={setReferenceId}
        />
        <MultiSelect
          label="Autres périmètres"
          description="Les éléments du registre y sont visibles sans être copiés."
          searchable
          data={options.filter((o) => o.value !== referenceId)}
          value={autres}
          onChange={setAutres}
        />
        <Checkbox
          label="Registre restreint"
          description="Seuls les droits attribués au registre (et les administrateurs) donnent accès."
          checked={restreint}
          onChange={(e) => setRestreint(e.currentTarget.checked)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={envoi} disabled={!valide} onClick={() => void creer()}>
            Créer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/* ------------------------------------------------------------------------------------------------------- fiche */
function FicheRegistre({ id }: { id: string }) {
  const registre = useQuery({ queryKey: ['registres', id], queryFn: () => get<RegistreDto>(`/api/registres/${id}`) });
  const r = registre.data;
  return (
    <Page>
      <PageHeader
        title={r?.name ?? 'Registre'}
        description={r ? `${REGISTRE_LABELS[r.kind]} · ${roleTexte(r)}` : undefined}
        actions={
          <Button component={Link} to="/registres" variant="default">
            Tous les registres
          </Button>
        }
      />
      <ErrorAlert error={registre.error} />
      {r && (
        <Stack>
          <Puces r={r} />
          {r.description && <Text>{r.description}</Text>}
          <Tabs defaultValue="elements" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="elements">Éléments ({r.elements})</Tabs.Tab>
              <Tabs.Tab value="perimetres">Périmètres</Tabs.Tab>
              {r.peut.gerer && <Tabs.Tab value="droits">Droits</Tabs.Tab>}
              {r.peut.gerer && <Tabs.Tab value="parametres">Paramètres</Tabs.Tab>}
            </Tabs.List>
            <Tabs.Panel value="elements" pt="md">
              <Elements id={id} />
            </Tabs.Panel>
            <Tabs.Panel value="perimetres" pt="md">
              <PerimetresRegistre r={r} />
            </Tabs.Panel>
            {r.peut.gerer && (
              <Tabs.Panel value="droits" pt="md">
                <Droits id={id} />
              </Tabs.Panel>
            )}
            {r.peut.gerer && (
              <Tabs.Panel value="parametres" pt="md">
                <Parametres r={r} />
              </Tabs.Panel>
            )}
          </Tabs>
        </Stack>
      )}
    </Page>
  );
}

function Elements({ id }: { id: string }) {
  const [recherche, setRecherche] = useState('');
  const liste = useQuery({
    queryKey: ['registres', id, 'elements', recherche],
    queryFn: () =>
      get<{ items: GrcObject[]; total: number }>(
        `/api/registres/${id}/elements?search=${encodeURIComponent(recherche)}`,
      ),
  });
  return (
    <Stack>
      <TextInput
        label="Rechercher un élément"
        value={recherche}
        onChange={(e) => setRecherche(e.currentTarget.value)}
      />
      <ErrorAlert error={liste.error} />
      <DataTable label="Éléments du registre, défilement horizontal possible">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Élément</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Statut</Table.Th>
              <Table.Th>Mis à jour</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(liste.data?.items ?? []).map((o) => (
              <Table.Tr key={o.id}>
                <Table.Td>{o.name}</Table.Td>
                <Table.Td>{ELEMENT_LABELS[o.kind] ?? o.kind}</Table.Td>
                <Table.Td>{typeof o.data.status === 'string' ? o.data.status : '—'}</Table.Td>
                <Table.Td>{fmtDate(o.updatedAt)}</Table.Td>
              </Table.Tr>
            ))}
            {liste.data && !liste.data.items.length && (
              <Table.Tr>
                <Table.Td colSpan={4}>Aucun élément.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </DataTable>
      {liste.data && liste.data.total > liste.data.items.length && (
        <Text size="sm">{liste.data.total} éléments au total ; affinez la recherche pour les retrouver.</Text>
      )}
    </Stack>
  );
}

function PerimetresRegistre({ r }: { r: RegistreDto }) {
  const qc = useQueryClient();
  const tous = usePerimetres();
  const [edition, setEdition] = useState(false);
  const [choix, setChoix] = useState<string[]>([]);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const options = (tous.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const ouvrir = () => {
    setChoix(r.perimetres.map((p) => p.id));
    setImpact(null);
    setMotif('');
    setErreur(null);
    setEdition(true);
  };
  const apercu = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const rep = await api<{ impact: Impact }>('PUT', `/api/registres/${r.id}/perimetres`, {
        body: { perimetres: choix, apercu: true },
      });
      setImpact(rep.impact);
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const confirmer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await api('PUT', `/api/registres/${r.id}/perimetres`, {
        body: { perimetres: choix, reason: motif },
        ifMatch: r.version,
      });
      await qc.invalidateQueries({ queryKey: ['registres'] });
      notifications.show({ color: 'teal', message: 'Périmètres du registre modifiés.' });
      setEdition(false);
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Stack>
      <Text>
        Les éléments du registre héritent de ses périmètres : ajouter ou retirer un périmètre ici s’applique à tous,
        sans copie ni écriture individuelle. Le périmètre de référence reste toujours rattaché.
      </Text>
      <ul>
        {r.perimetres.map((p) => (
          <li key={p.id}>
            {p.name}
            {p.id === r.referenceId ? ' (référence)' : ''}
          </li>
        ))}
      </ul>
      {r.autresPerimetres > 0 && (
        <Text size="sm">
          {r.autresPerimetres} autre(s) périmètre(s) rattaché(s) auquel(s) vous n’avez pas accès ne sont pas nommés.
        </Text>
      )}
      {r.peut.gerer && !r.archived && (
        <Group>
          <Button variant="default" onClick={ouvrir}>
            Modifier les périmètres
          </Button>
        </Group>
      )}
      <Modal opened={edition} onClose={() => setEdition(false)} title="Modifier les périmètres du registre">
        <Stack>
          <ErrorAlert error={erreur} />
          <MultiSelect
            label="Périmètres du registre"
            searchable
            data={options}
            value={choix}
            onChange={(v) => {
              setChoix(v);
              setImpact(null);
            }}
          />
          {impact && (
            <Alert title="Impact de la modification">
              <Text size="sm">
                {impact.ajoutes.length ? `Ajoutés : ${impact.ajoutes.map((p) => p.name).join(', ')}. ` : ''}
                {impact.retires.length ? `Retirés : ${impact.retires.map((p) => p.name).join(', ')}. ` : ''}
                {!impact.ajoutes.length && !impact.retires.length ? 'Aucun changement. ' : ''}
                Éléments concernés : {impact.elements} (dont {impact.series} série(s) de tâches), liens : {impact.liens}
                , droits attribués au registre : {impact.droits}.
              </Text>
            </Alert>
          )}
          {impact && (
            <Textarea
              label="Motif du changement"
              description="10 caractères au moins ; conservé au journal."
              required
              autosize
              minRows={2}
              value={motif}
              onChange={(e) => setMotif(e.currentTarget.value)}
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEdition(false)}>
              Annuler
            </Button>
            {!impact ? (
              <Button loading={envoi} disabled={!choix.length} onClick={() => void apercu()}>
                Prévisualiser l’impact
              </Button>
            ) : (
              <Button loading={envoi} disabled={motif.trim().length < 10} onClick={() => void confirmer()}>
                Confirmer le changement
              </Button>
            )}
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function Droits({ id }: { id: string }) {
  const qc = useQueryClient();
  const droits = useQuery({
    queryKey: ['droits', 'registre', id],
    queryFn: () => get<{ items: Droit[] }>(`/api/droits/registre/${id}`),
  });
  const [recherche, setRecherche] = useState('');
  const titulaires = useQuery({
    queryKey: ['droits', 'registre', id, 'titulaires', recherche],
    queryFn: () =>
      get<{ utilisateurs: { id: string; libelle: string }[]; groupes: { id: string; libelle: string }[] }>(
        `/api/droits/registre/${id}/titulaires?q=${encodeURIComponent(recherche)}`,
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
  const rafraichir = () => qc.invalidateQueries({ queryKey: ['droits', 'registre', id] });
  const accorder = async () => {
    if (!titulaire || !role) return;
    const [subjectType, subjectId] = titulaire.split(':');
    setErreur(null);
    try {
      await api('PUT', `/api/droits/registre/${id}`, { body: { subjectType, subjectId, role } });
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
      await api('DELETE', `/api/droits/registre/${id}/${d.id}`);
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
      <DataTable label="Droits attribués sur le registre, défilement horizontal possible">
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
                    message={`${d.libelle} perd son rôle ${ROLE_LABELS[d.role].toLowerCase()} sur ce registre.`}
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

function Parametres({ r }: { r: RegistreDto }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [name, setName] = useState(r.name);
  const [description, setDescription] = useState(r.description);
  const [restreint, setRestreint] = useState(r.restreint);
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const enregistrer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await api('PATCH', `/api/registres/${r.id}`, { body: { name, description, restreint }, ifMatch: r.version });
      await qc.invalidateQueries({ queryKey: ['registres'] });
      notifications.show({ color: 'teal', message: 'Registre enregistré.' });
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const archiver = async () => {
    setErreur(null);
    try {
      await api('POST', `/api/registres/${r.id}/archivage`, { ifMatch: r.version });
      await qc.invalidateQueries({ queryKey: ['registres'] });
      nav('/registres');
    } catch (e) {
      setErreur(e);
    }
  };
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <TextInput label="Nom" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
      <Textarea
        label="Description"
        autosize
        minRows={2}
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
      />
      <Checkbox
        label="Registre restreint"
        description="Seuls les droits attribués au registre (et les administrateurs) donnent accès."
        checked={restreint}
        onChange={(e) => setRestreint(e.currentTarget.checked)}
      />
      <Group>
        <Button loading={envoi} disabled={!name.trim() || r.archived} onClick={() => void enregistrer()}>
          Enregistrer
        </Button>
        {!r.archived && !r.parDefaut && (
          <ConfirmButton
            variant="default"
            message="Archiver ce registre ? Il n’accepte plus de nouveaux éléments ; ses éléments, ses périmètres et ses droits ne sont pas touchés."
            onConfirm={archiver}
          >
            Archiver le registre
          </ConfirmButton>
        )}
      </Group>
    </Stack>
  );
}

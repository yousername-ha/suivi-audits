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
  STATUT_PLAN_REGISTRE_LABELS,
  STATUTS_PLAN_REGISTRE,
  type GrcObject,
  type RegistreDto,
  type ResponsableRef,
  type StatutPlanRegistre,
} from '@suivi/shared';
import { ConfirmButton, DataTable, Page, PageHeader, StatusChip } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';
import { useCan } from '../session';
import { libelleDesignation, SelecteurResponsableTypé, useProposables } from '../components/selecteurs';
import { AccesSujets } from './AccesSujets';
import { Droits } from './Droits';
import { ElementsFiltres } from './ElementsFiltres';

interface Perimetre {
  id: string;
  name: string;
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
const ELEMENT_LABELS: Record<string, string> = {
  action: 'Action',
  nonconformity: 'Écart',
  task_series: 'Série de tâches',
};

const usePerimetres = () => useQuery({ queryKey: ['grc', 'smsis'], queryFn: () => get<Perimetre[]>('/api/grc/smsis') });

function Puces({ r }: { r: RegistreDto }) {
  return (
    <Group gap="xs">
      {r.kind === 'plan_actions' && (
        <StatusChip etat={r.statut === 'termine' ? 'succes' : r.statut === 'abandonne' ? 'neutre' : 'info'}>
          {STATUT_PLAN_REGISTRE_LABELS[r.statut]}
        </StatusChip>
      )}
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
  const can = useCan();
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
      <Tabs defaultValue="registres" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="registres">Registres</Tabs.Tab>
          <Tabs.Tab value="elements">Éléments par périmètre</Tabs.Tab>
          {can('administration', 'lire') && <Tabs.Tab value="acces">Vue des accès</Tabs.Tab>}
        </Tabs.List>
        {can('administration', 'lire') && (
          <Tabs.Panel value="acces" pt="md">
            <AccesSujets />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="registres" pt="md">
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
        </Tabs.Panel>
        <Tabs.Panel value="elements" pt="md">
          <ElementsFiltres />
        </Tabs.Panel>
      </Tabs>
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

const dateFr = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : null);

/** Dates, responsable et avancement d'un plan d'actions (le plan est le conteneur ordonné de ses actions). */
function ResumePlan({ r }: { r: RegistreDto }) {
  const proposables = useProposables(r.referenceId, !!r.responsable);
  const periode =
    r.dateDebut || r.dateFin
      ? `${r.dateDebut ? 'du ' + dateFr(r.dateDebut) : ''}${r.dateDebut && r.dateFin ? ' ' : ''}${r.dateFin ? 'au ' + dateFr(r.dateFin) : ''}`
      : 'Sans période';
  return (
    <Group gap="xl" role="group" aria-label="Plan d’actions">
      <Text size="sm">Période : {periode}</Text>
      <Text size="sm">
        Responsable :{' '}
        {r.responsable ? libelleDesignation({ responsable: r.responsable }, proposables.data) : 'Non attribué'}
      </Text>
      <Text size="sm">
        Avancement : {r.avancement.terminees} action(s) terminée(s) sur {r.avancement.total}
      </Text>
    </Group>
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
          {r.kind === 'plan_actions' && <ResumePlan r={r} />}
          <Tabs defaultValue="elements" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="elements">Éléments ({r.elements})</Tabs.Tab>
              <Tabs.Tab value="perimetres">Périmètres</Tabs.Tab>
              {r.peut.gerer && <Tabs.Tab value="droits">Droits</Tabs.Tab>}
              {r.peut.gerer && <Tabs.Tab value="parametres">Paramètres</Tabs.Tab>}
            </Tabs.List>
            <Tabs.Panel value="elements" pt="md">
              <Elements r={r} />
            </Tabs.Panel>
            <Tabs.Panel value="perimetres" pt="md">
              <PerimetresRegistre r={r} />
            </Tabs.Panel>
            {r.peut.gerer && (
              <Tabs.Panel value="droits" pt="md">
                <Droits type="registre" id={id} peutAttribuer={r.peutAttribuer} />
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

function Elements({ r }: { r: RegistreDto }) {
  const id = r.id;
  const qc = useQueryClient();
  const [recherche, setRecherche] = useState('');
  const [erreurOrdre, setErreurOrdre] = useState<unknown>(null);
  const liste = useQuery({
    queryKey: ['registres', id, 'elements', recherche],
    queryFn: () =>
      get<{ items: GrcObject[]; total: number }>(
        `/api/registres/${id}/elements?search=${encodeURIComponent(recherche)}`,
      ),
  });
  const items = liste.data?.items ?? [];
  const ordonnable =
    r.kind === 'plan_actions' && r.peut.gerer && !r.archived && !recherche && liste.data?.total === items.length;
  const deplacer = async (index: number, delta: -1 | 1) => {
    const ids = items.map((o) => o.id);
    const [a, b] = [ids[index]!, ids[index + delta]!];
    ids[index] = b;
    ids[index + delta] = a;
    setErreurOrdre(null);
    try {
      await api('PUT', `/api/registres/${id}/ordre`, { body: { ids }, ifMatch: r.version });
      await qc.invalidateQueries({ queryKey: ['registres'] });
    } catch (e) {
      setErreurOrdre(e);
    }
  };
  return (
    <Stack>
      <TextInput
        label="Rechercher un élément"
        value={recherche}
        onChange={(e) => setRecherche(e.currentTarget.value)}
      />
      <ErrorAlert error={liste.error} />
      <ErrorAlert error={erreurOrdre} />
      <DataTable label="Éléments du registre, défilement horizontal possible">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Élément</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Statut</Table.Th>
              <Table.Th>Mis à jour</Table.Th>
              {ordonnable && <Table.Th>Ordre</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((o, i) => (
              <Table.Tr key={o.id}>
                <Table.Td>{o.name}</Table.Td>
                <Table.Td>{ELEMENT_LABELS[o.kind] ?? o.kind}</Table.Td>
                <Table.Td>{typeof o.data.status === 'string' ? o.data.status : '—'}</Table.Td>
                <Table.Td>{fmtDate(o.updatedAt)}</Table.Td>
                {ordonnable && (
                  <Table.Td>
                    <Group gap="2xs" wrap="nowrap">
                      <Button
                        size="compact-sm"
                        variant="default"
                        disabled={i === 0}
                        aria-label={`Monter ${o.name}`}
                        onClick={() => void deplacer(i, -1)}
                      >
                        Monter
                      </Button>
                      <Button
                        size="compact-sm"
                        variant="default"
                        disabled={i === items.length - 1}
                        aria-label={`Descendre ${o.name}`}
                        onClick={() => void deplacer(i, 1)}
                      >
                        Descendre
                      </Button>
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
            {liste.data && !liste.data.items.length && (
              <Table.Tr>
                <Table.Td colSpan={ordonnable ? 5 : 4}>Aucun élément.</Table.Td>
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

function Parametres({ r }: { r: RegistreDto }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [name, setName] = useState(r.name);
  const [description, setDescription] = useState(r.description);
  const [restreint, setRestreint] = useState(r.restreint);
  const [dateDebut, setDateDebut] = useState(r.dateDebut ?? '');
  const [dateFin, setDateFin] = useState(r.dateFin ?? '');
  const [statut, setStatut] = useState<StatutPlanRegistre>(r.statut);
  const [responsable, setResponsable] = useState<ResponsableRef | null>(r.responsable);
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const plan = r.kind === 'plan_actions';
  const enregistrer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await api('PATCH', `/api/registres/${r.id}`, {
        body: {
          name,
          description,
          restreint,
          ...(plan ? { dateDebut: dateDebut || null, dateFin: dateFin || null, statut, responsable } : {}),
        },
        ifMatch: r.version,
      });
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
      {plan && (
        <>
          <Group grow align="flex-start">
            <TextInput
              type="date"
              label="Début du plan"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.currentTarget.value)}
            />
            <TextInput
              type="date"
              label="Fin du plan"
              value={dateFin}
              onChange={(e) => setDateFin(e.currentTarget.value)}
            />
          </Group>
          <Select
            label="Statut du plan"
            allowDeselect={false}
            data={STATUTS_PLAN_REGISTRE.map((v) => ({ value: v, label: STATUT_PLAN_REGISTRE_LABELS[v] }))}
            value={statut}
            onChange={(v) => v && setStatut(v as StatutPlanRegistre)}
          />
          <SelecteurResponsableTypé
            smsi={r.referenceId}
            data={{ responsable }}
            onChange={(p) => setResponsable(p.ownerId ? { type: 'utilisateur', id: p.ownerId } : p.responsable)}
          />
        </>
      )}
      <Checkbox
        label="Registre restreint"
        description={
          r.peutAttribuer
            ? 'Seuls les droits attribués au registre (et les administrateurs) donnent accès.'
            : 'Seuls les droits attribués au registre (et les administrateurs) donnent accès. Le modifier demande le droit d’administrer le module ou le rôle de gestionnaire.'
        }
        checked={restreint}
        disabled={!r.peutAttribuer && !r.archived}
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

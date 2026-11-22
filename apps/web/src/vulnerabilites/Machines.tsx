/* Module Vulnérabilités (ADR 0100, lot V5) : écran « Machines ». Machines lues dans Tenable Security Center (ou importées
   d'un scan Nessus, lot N1 : marquées de leur source, une machine vue par les deux apparaît deux fois), visibles à
   travers les droits du périmètre de chacune (une machine sans périmètre n'est visible qu'avec le droit d'administrer le
   module). Recherche par nom, filtres par rôle et par périmètre, constats présents par gravité, bandeau des machines sans
   rôle ; rôle et périmètre indiqués une machine à la fois ou en masse (sélection multiple), avec le droit de modifier le
   module et l'écriture sur le périmètre visé : le serveur en est seul juge, les boutons ne font que suivre la session.
   Lot V4a : machines rangées de la plus critique à la moins critique (rang calculé par la plateforme, faits affichés),
   fiche d'une machine avec ses produits surveillés reliés à la main (relier, délier : droit de modifier le module).
   Lot V4d : périmètre relié par dépôt de Tenable (onglet « Dépôts Tenable », droit d'administrer le module, comme l'onglet
   « Périmètres » de la surface externe) ; la liste dit si le périmètre d'une machine est hérité du dépôt ou indiqué à la
   main, et « Hérité du dépôt » retire le périmètre indiqué à la main.
   Lot ALH3 : la fiche d'une machine dit par quels actifs exposés sur Internet (AlgoLightHouse) elle est jointe, pour les
   actifs que la personne peut lire.
   Lot PC2 : deux présentations, mémorisées dans les préférences de la personne : « Liste » (ci-dessous, avec la priorité la
   plus haute et les marques zero-day et exploitable de chaque machine) et « Parc » (ParcMachines.tsx : une tuile par
   machine, zones front, back applicatif, base de données et rôle non indiqué, mode réduit ou grand écran). Mêmes filtres,
   même fiche.
   Composants de la charte, CSP stricte (ADR 0006). */
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Group,
  Modal,
  Pagination,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  type DepotTenableDto,
  type EchelleParc,
  type ExpositionMachineDto,
  type MachineDto,
  type MarquesMachineDto,
  type ParcMachinesDto,
  type PageMachines,
  type PerimetreAffectableDto,
  type ProduitRelieDto,
  type ProduitSurveilleDto,
  ROLES_MACHINE,
  ROLE_MACHINE_LIBELLES,
  type RoleMachine,
  type VueMachines,
  type ZoneParc,
} from '@suivi/shared';
import { DataTable, ErrorAlert, Page, PageHeader, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { api, errorMessage, get } from '../api';
import { fmtDate } from '../components/common';
import { useCan, usePreferences } from '../session';
import {
  corpsAffectation,
  faitsDuRang,
  FILTRES_MACHINES_VIDES,
  type FiltresMachines,
  libelleMachine,
  libelleRole,
  originePerimetre,
  urlMachines,
} from './failles';
import { libellePrioriteMachine, urlParc } from './parc';
import { adressePerimetre, CLE_PERIMETRES_AFFECTABLES, filtresDepuisAdresse } from './perimetres';
import { LegendeMarques, MarquesMachine, MentionFinSupport, MentionSansCorrectif, ParcMachines } from './ParcMachines';
import { libelleExposition, urlExpositionMachine } from './surface';
import { ouvertureMachines } from './recherche';
import { nombrePages } from './veille';
import { SourceConnecteur } from './SourceConnecteur';

const CLE = ['vulnerabilites', 'machines'] as const;
const OPTIONS_ROLE = [
  ...ROLES_MACHINE.map((r) => ({ value: r, label: ROLE_MACHINE_LIBELLES[r] })),
  { value: 'aucun', label: 'Rôle non renseigné' },
];

/** Machines (sans état), dans l'ordre du rang ; avec `selection`, une case par machine pour l'affectation en masse ; avec
    `onOuvrir`, le nom ouvre la fiche de la machine. Lot PC2 : priorité la plus haute et marques (zero-day, exploitable)
    quand la route les rend. Lot PC3 : avec `onPerimetre`, le nom du périmètre ouvre son détail (onglet « Périmètres »). */
export function MachinesTable({
  machines,
  selection,
  onSelection,
  onOuvrir,
  onPerimetre,
}: {
  machines: (MachineDto & { marques?: MarquesMachineDto })[];
  selection?: ReadonlySet<string>;
  onSelection?: (id: string, choisie: boolean) => void;
  onOuvrir?: (m: MachineDto) => void;
  onPerimetre?: (perimetreId: string) => void;
}) {
  const choix = !!selection && !!onSelection;
  return (
    <DataTable label="Machines">
      <Table>
        <Table.Thead>
          <Table.Tr>
            {choix && <Table.Th>Choisir</Table.Th>}
            <Table.Th>Rang</Table.Th>
            <Table.Th>Priorité et marques</Table.Th>
            <Table.Th>Machine</Table.Th>
            <Table.Th>Rôle</Table.Th>
            <Table.Th>Périmètre</Table.Th>
            <Table.Th>Failles présentes (critiques, élevées, moyennes, faibles)</Table.Th>
            <Table.Th>Exploitées, exploitables, déclarées</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {machines.map((m) => (
            <Table.Tr key={m.id}>
              {choix && (
                <Table.Td>
                  <Checkbox
                    aria-label={`Choisir ${libelleMachine(m)}`}
                    checked={selection.has(m.id)}
                    onChange={(e) => onSelection(m.id, e.currentTarget.checked)}
                  />
                </Table.Td>
              )}
              <Table.Td>
                <Text size="sm" fw={600}>
                  {m.rang.position} / {m.rang.total}
                </Text>
                <Text size="xs" c="dimmed">
                  {faitsDuRang(m.rang).join(' · ')}
                </Text>
              </Table.Td>
              <Table.Td>
                {m.marques ? (
                  <span className="parc-liste-marques">
                    <Text size="sm" fw={600} span>
                      {libellePrioriteMachine(m.marques.priorite)}
                    </Text>
                    <MarquesMachine marques={m.marques} texte />
                    {m.marques.exploiteeSansCorrectif && <MentionSansCorrectif />}
                  </span>
                ) : (
                  <Text size="sm" c="dimmed">
                    Non calculée
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {onOuvrir ? (
                  <Anchor component="button" type="button" onClick={() => onOuvrir(m)} className="veille-texte">
                    {libelleMachine(m)}
                  </Anchor>
                ) : (
                  <Text size="sm" className="veille-texte">
                    {libelleMachine(m)}
                  </Text>
                )}
                {m.nom && m.adresse && (
                  <Text size="xs" c="dimmed" className="veille-code">
                    {m.adresse}
                  </Text>
                )}
                {m.systeme && (
                  <Text size="xs" c="dimmed" className="veille-texte" lang="en">
                    {m.systeme}
                  </Text>
                )}
                {m.finDeSupport && <MentionFinSupport court />}
                <SourceConnecteur origine={m.integration} />
              </Table.Td>
              <Table.Td>
                {m.role ? libelleRole(m.role) : <StatusChip etat="attention">{libelleRole(null)}</StatusChip>}
              </Table.Td>
              <Table.Td>
                {onPerimetre && m.perimetreId && m.perimetreNom ? (
                  <Anchor
                    component="button"
                    type="button"
                    size="sm"
                    className="veille-texte"
                    onClick={() => onPerimetre(m.perimetreId!)}
                  >
                    {m.perimetreNom}
                  </Anchor>
                ) : (
                  <Text size="sm">{m.perimetreNom ?? 'Sans périmètre'}</Text>
                )}
                {originePerimetre(m) && (
                  <Text size="xs" c="dimmed" className="veille-texte">
                    {originePerimetre(m)}
                  </Text>
                )}
                {!m.perimetreOrigine && m.depot && (
                  <Text size="xs" c="dimmed" className="veille-texte">
                    Dépôt « {m.depot.nom} » non relié
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {m.compteurs.critique} · {m.compteurs.elevee} · {m.compteurs.moyenne} · {m.compteurs.faible}
              </Table.Td>
              <Table.Td>
                {m.compteurs.exploites} · {m.compteurs.exploitables} · {m.compteurs.declarees}
              </Table.Td>
            </Table.Tr>
          ))}
          {machines.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={choix ? 8 : 7}>
                <Text size="sm" c="dimmed">
                  Aucune machine ne correspond, parmi celles que vous pouvez lire.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Dépôts de Tenable et leur liaison (sans état) ; `onLier` reçoit le périmètre visé (null : délier). */
export function DepotsTenableTable({
  depots,
  options,
  enCours,
  onLier,
}: {
  depots: DepotTenableDto[];
  options: PerimetreAffectableDto[];
  enCours: string | null;
  onLier: (d: DepotTenableDto, perimetreId: string | null) => void;
}) {
  return (
    <DataTable label="Dépôts Tenable">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Dépôt Tenable</Table.Th>
            <Table.Th>Machines</Table.Th>
            <Table.Th>Périmètre de la plateforme</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {depots.map((d) => (
            <Table.Tr key={d.id}>
              <Table.Td>
                <Text size="sm" fw={600} className="veille-texte">
                  {d.nom}
                </Text>
                <Text size="xs" c="dimmed">
                  {d.integration.nom} · dépôt {d.depotTenable}
                  {d.present ? '' : ' · absent de la dernière synchronisation complète'}
                </Text>
              </Table.Td>
              <Table.Td>
                {d.machines} machine{d.machines > 1 ? 's' : ''}
                {d.exceptions > 0 && (
                  <Text size="xs" c="dimmed">
                    dont {d.exceptions} au périmètre indiqué à la main
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Select
                  label={`Périmètre de la plateforme pour ${d.nom}`}
                  placeholder="Non relié"
                  clearable
                  disabled={enCours === d.id}
                  value={d.perimetreId}
                  onChange={(v) => {
                    if ((v ?? null) !== d.perimetreId) onLier(d, v ?? null);
                  }}
                  data={[
                    ...options.map((o) => ({ value: o.id, label: o.nom })),
                    // Un périmètre relié que la personne ne peut plus choisir reste affiché.
                    ...(d.perimetreId && !options.some((o) => o.id === d.perimetreId)
                      ? [{ value: d.perimetreId, label: d.perimetreNom ?? 'Périmètre non accessible' }]
                      : []),
                  ]}
                  comboboxProps={{ withinPortal: false }}
                />
                {!d.perimetreId && (
                  <Text size="xs" c="dimmed">
                    Non relié : ses machines sans périmètre indiqué à la main ne sont visibles que de l’administration
                    du module.
                  </Text>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
          {depots.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={3}>
                <Text size="sm" c="dimmed">
                  Aucun dépôt Tenable : ils apparaissent après une synchronisation du connecteur.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Onglet « Dépôts Tenable » (droit d'administrer le module ; le serveur en reste seul juge). */
function OngletDepots() {
  const qc = useQueryClient();
  const [enCours, setEnCours] = useState<string | null>(null);
  const depots = useQuery({
    queryKey: [...CLE, 'depots'],
    queryFn: () => get<DepotTenableDto[]>('/api/vulnerabilites/depots'),
  });
  const options = useQuery({
    queryKey: [...CLE_PERIMETRES_AFFECTABLES],
    queryFn: () => get<PerimetreAffectableDto[]>('/api/vulnerabilites/perimetres'),
  });
  const lier = async (d: DepotTenableDto, perimetreId: string | null) => {
    setEnCours(d.id);
    try {
      await api('PUT', `/api/vulnerabilites/depots/${d.id}`, { body: { perimetreId }, ifMatch: d.version });
      notifications.show({ color: 'teal', message: perimetreId ? 'Dépôt relié.' : 'Liaison retirée.' });
      await qc.invalidateQueries({ queryKey: CLE });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
      await qc.invalidateQueries({ queryKey: [...CLE, 'depots'] });
    } finally {
      setEnCours(null);
    }
  };
  return (
    <Stack>
      <Text size="sm">
        Reliez chaque dépôt de Tenable à un périmètre de la plateforme : ses machines sans périmètre indiqué à la main
        prennent ce périmètre et deviennent lisibles par les personnes qui le lisent. Un périmètre indiqué à la main sur
        une machine prime sur celui du dépôt. Il faut pouvoir écrire sur le périmètre choisi (et sur celui d’avant). Une
        synchronisation ne change jamais une liaison ; chaque liaison est inscrite au journal d’audit, sans nom de
        machine.
      </Text>
      <ErrorAlert error={depots.error ?? options.error} />
      {depots.data && (
        <DepotsTenableTable
          depots={depots.data}
          options={options.data ?? []}
          enCours={enCours}
          onLier={(d, v) => void lier(d, v)}
        />
      )}
    </Stack>
  );
}

/** Bandeau des machines sans rôle (sans état). */
export function BandeauSansRole({ n }: { n: number }) {
  if (!n) return null;
  return (
    <Alert color="orange" role="status" title="Machines sans rôle">
      {n} machine{n > 1 ? 's' : ''} lisible{n > 1 ? 's' : ''} sans rôle (front, back applicatif ou base de données) :
      indiquez-le pour préparer le classement par ligne.
    </Alert>
  );
}

/** Produits surveillés reliés à une machine (sans état). */
export function ProduitsRelies({
  produits,
  peutModifier,
  onDelier,
}: {
  produits: ProduitRelieDto[];
  peutModifier: boolean;
  onDelier: (p: ProduitRelieDto) => void;
}) {
  if (!produits.length)
    return (
      <Text size="sm" c="dimmed">
        Aucun produit surveillé relié à cette machine.
      </Text>
    );
  return (
    <DataTable label="Produits surveillés reliés">
      <Table>
        <Table.Tbody>
          {produits.map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td>
                <Text size="sm">
                  {p.nom} {p.versionProduit}
                </Text>
                <Text size="xs" c="dimmed">
                  {p.editeur}
                </Text>
              </Table.Td>
              <Table.Td>
                {p.cvesRattachees} CVE rattachée{p.cvesRattachees > 1 ? 's' : ''}
              </Table.Td>
              {peutModifier && (
                <Table.Td>
                  <Button
                    size="compact-sm"
                    variant="light"
                    color="red"
                    onClick={() => onDelier(p)}
                    aria-label={`Délier ${p.nom}`}
                  >
                    Délier
                  </Button>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Actifs exposés sur Internet reliés à une machine (sans état) : seuls ceux que la personne lit sont nommés. */
export function ExpositionMachine({ exposition }: { exposition: ExpositionMachineDto }) {
  return (
    <Text size="sm" className="veille-texte">
      {libelleExposition(exposition)}
    </Text>
  );
}

/** Fiche d'une machine : rang et faits, exposition sur Internet, produits surveillés reliés, relier un produit (droit de
    modifier le module). */
export function FicheMachine({ machine, modifier }: { machine: MachineDto; modifier: boolean }) {
  const qc = useQueryClient();
  const [choix, setChoix] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const relies = useQuery({
    queryKey: [...CLE, 'produits', machine.id],
    queryFn: () => get<ProduitRelieDto[]>(`/api/vulnerabilites/machines/${machine.id}/produits`),
  });
  const produits = useQuery({
    queryKey: ['vulnerabilites', 'produits', 'toutes'],
    queryFn: () => get<ProduitSurveilleDto[]>('/api/vulnerabilites/produits'),
    enabled: modifier,
  });
  const exposition = useQuery({
    queryKey: [...CLE, 'exposition', machine.id],
    queryFn: () => get<ExpositionMachineDto>(urlExpositionMachine(machine.id)),
  });
  const dejaRelies = new Set((relies.data ?? []).map((p) => p.id));
  const action = async (fn: () => Promise<unknown>, message: string) => {
    setEnvoi(true);
    try {
      await fn();
      notifications.show({ color: 'teal', message });
      setChoix(null);
      await qc.invalidateQueries({ queryKey: ['vulnerabilites'] });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      setEnvoi(false);
    }
  };
  const relier = () => {
    const p = (produits.data ?? []).find((x) => x.id === choix);
    if (!p) return;
    void action(
      () =>
        api('POST', `/api/vulnerabilites/produits/${p.id}/machines`, {
          body: { machineId: machine.id },
          ifMatch: p.version,
        }),
      'Produit relié à la machine.',
    );
  };
  return (
    <Stack>
      <Stack gap="2xs">
        <Title order={3} size="h6">
          Rang {machine.rang.position} sur {machine.rang.total}
        </Title>
        <Text size="sm">{faitsDuRang(machine.rang).join(' · ')}</Text>
      </Stack>
      {machine.finDeSupport && (
        <Stack gap="2xs">
          <Title order={3} size="h6">
            Fin de support
          </Title>
          <MentionFinSupport />
          <Text size="sm">
            Selon Tenable (date de fin de support du logiciel, passée), ces contrôles présents sur la machine visent un
            système ou un logiciel qui ne reçoit plus de correctif de sécurité de l’éditeur (textes de Tenable, en
            anglais) :
          </Text>
          <Stack gap="2xs" role="list" aria-label="Contrôles de Tenable en fin de support">
            {machine.finsDeSupport.map((f) => (
              <Text key={`${f.nom}-${f.le}`} size="sm" role="listitem">
                <span lang="en" className="veille-texte">
                  {f.nom}
                </span>{' '}
                · fin de support le <span className="horodatage">{fmtDate(f.le)}</span>
              </Text>
            ))}
          </Stack>
        </Stack>
      )}
      <Title order={3} size="h6">
        Exposition sur Internet
      </Title>
      <ErrorAlert error={exposition.error} />
      {exposition.data && <ExpositionMachine exposition={exposition.data} />}
      <Title order={3} size="h6">
        Produits surveillés reliés
      </Title>
      <ErrorAlert error={relies.error ?? produits.error} />
      {relies.data && (
        <ProduitsRelies
          produits={relies.data}
          peutModifier={modifier}
          onDelier={(p) =>
            void action(
              () =>
                api('DELETE', `/api/vulnerabilites/produits/${p.id}/machines/${machine.id}`, { ifMatch: p.version }),
              'Produit délié de la machine.',
            )
          }
        />
      )}
      {modifier && (
        <Group align="flex-end">
          <Select
            label="Produit surveillé à relier"
            placeholder="Choisir un produit"
            searchable
            clearable
            value={choix}
            onChange={setChoix}
            data={(produits.data ?? [])
              .filter((p) => !dejaRelies.has(p.id))
              .map((p) => ({ value: p.id, label: `${p.nom} ${p.versionProduit} (${p.editeur})` }))}
            nothingFoundMessage="Aucun produit"
            comboboxProps={{ withinPortal: false }}
          />
          <Button loading={envoi} disabled={!choix} onClick={relier}>
            Relier
          </Button>
        </Group>
      )}
    </Stack>
  );
}

function OngletMachines() {
  const can = useCan();
  const qc = useQueryClient();
  const modifier = can('vulnerabilites', 'modifier');
  const navigate = useNavigate();
  // Lot PC3 : filtres initiaux lus dans l'adresse (« voir la liste » depuis l'onglet « Périmètres »).
  const [adresse] = useSearchParams();
  const [filtres, setFiltres] = useState<FiltresMachines>(() => ({
    ...FILTRES_MACHINES_VIDES,
    ...filtresDepuisAdresse(adresse),
    q: ouvertureMachines(adresse).q ?? '',
  }));
  const [saisie, setSaisie] = useState(filtres.q);
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<RoleMachine | 'aucun' | ''>('');
  const [perimetre, setPerimetre] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [ouverte, setOuverte] = useState<MachineDto | null>(null);
  // Lot R1 : la barre de recherche du module ouvre la liste filtrée (`?q=`) ou la fiche d'une machine (`?machine=`), lue par
  // la route existante (404 pour une machine illisible ou inconnue), y compris quand la page est déjà affichée.
  const loc = useLocation();
  const [machineVoulue, setMachineVoulue] = useState<string | null>(null);
  useEffect(() => {
    const o = ouvertureMachines(new URLSearchParams(loc.search));
    if (o.q !== null) {
      setSaisie(o.q);
      setFiltres((f) => ({ ...f, q: o.q! }));
      setPage(1);
    }
    setMachineVoulue(o.machine);
  }, [loc.key, loc.search]);
  const ficheVoulue = useQuery({
    queryKey: ['vulnerabilites', 'machines', 'fiche', machineVoulue],
    queryFn: () => get<MachineDto>(`/api/vulnerabilites/machines/${machineVoulue}`),
    enabled: !!machineVoulue,
    retry: false,
  });
  useEffect(() => {
    if (!machineVoulue) return;
    if (ficheVoulue.data) {
      setOuverte(ficheVoulue.data);
      setMachineVoulue(null);
    } else if (ficheVoulue.error) {
      notifications.show({ color: 'red', message: errorMessage(ficheVoulue.error) });
      setMachineVoulue(null);
    }
  }, [machineVoulue, ficheVoulue.data, ficheVoulue.error]);
  // Présentation mémorisée pour la personne (préférences du compte) : liste par défaut, parc réduit par défaut.
  const { prefs, save } = usePreferences();
  const affichage = prefs.vulnerabilitesMachines ?? {};
  const vue: VueMachines = affichage.vue ?? 'liste';
  const echelle: EchelleParc = affichage.echelle ?? 'reduit';
  const regler = (patch: { vue?: VueMachines; echelle?: EchelleParc }) =>
    void save({ vulnerabilitesMachines: { ...affichage, ...patch } }).catch((e: unknown) =>
      notifications.show({ color: 'red', message: errorMessage(e) }),
    );
  const machines = useQuery({
    queryKey: [...CLE, filtres, page],
    queryFn: () => get<PageMachines>(urlMachines(filtres, page)),
    enabled: vue === 'liste',
  });
  // Parc : une seule requête pour tout le parc lisible (bornée par zone), aucune par machine.
  const parc = useQuery({
    queryKey: [...CLE, 'parc', filtres],
    queryFn: () => get<ParcMachinesDto>(urlParc(filtres)),
    enabled: vue === 'parc',
  });
  /** « Et n autres : voir la liste » d'une zone tronquée : la liste, filtrée sur la zone. */
  const voirListe = (z: ZoneParc) => {
    changer({ role: z });
    regler({ vue: 'liste' });
  };
  // Même clé que les autres lectures de /api/vulnerabilites/perimetres : [...CLE, 'perimetres'] est celle des cartes de
  // l'onglet « Périmètres » (CLE_PERIMETRES), d'une autre forme ; la partager plantait cette page en venant de l'onglet.
  const perimetres = useQuery({
    queryKey: [...CLE_PERIMETRES_AFFECTABLES],
    queryFn: () => get<PerimetreAffectableDto[]>('/api/vulnerabilites/perimetres'),
    enabled: modifier,
  });
  const changer = (f: Partial<FiltresMachines>) => {
    setFiltres({ ...filtres, ...f });
    setPage(1);
    setSelection(new Set());
  };
  const chercher = (e: FormEvent) => {
    e.preventDefault();
    changer({ q: saisie.trim() });
  };
  const choisies = (machines.data?.elements ?? []).filter((m) => selection.has(m.id));
  const affecter = async () => {
    setEnvoi(true);
    try {
      const r = await api<{ machines: number }>('POST', '/api/vulnerabilites/machines/affectation', {
        body: corpsAffectation(choisies, role, perimetre),
      });
      notifications.show({
        color: 'teal',
        message: `${r.machines} machine${r.machines > 1 ? 's' : ''} mise${r.machines > 1 ? 's' : ''} à jour.`,
      });
      setSelection(new Set());
      setRole('');
      setPerimetre('');
      await qc.invalidateQueries({ queryKey: ['vulnerabilites'] });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      setEnvoi(false);
    }
  };

  // « Hérité du dépôt » : retire le périmètre indiqué à la main (sans dépôt relié, le serveur exige administrer).
  const optionsPerimetre = [
    ...(perimetres.data ?? []).map((p) => ({ value: p.id, label: p.nom })),
    { value: 'aucun', label: 'Hérité du dépôt (retirer le périmètre indiqué à la main)' },
  ];
  const pages = machines.data ? nombrePages(machines.data.total, machines.data.parPage) : 1;
  return (
    <>
      <Stack>
        <Group align="center" gap="md">
          <SegmentedControl
            value={vue}
            onChange={(v) => regler({ vue: v as VueMachines })}
            data={[
              { value: 'liste', label: 'Liste' },
              { value: 'parc', label: 'Parc' },
            ]}
            aria-label="Présentation des machines"
          />
          {vue === 'parc' && (
            <SegmentedControl
              value={echelle}
              onChange={(v) => regler({ echelle: v as EchelleParc })}
              data={[
                { value: 'reduit', label: 'Réduit' },
                { value: 'grand', label: 'Grand écran' },
              ]}
              aria-label="Échelle du parc"
            />
          )}
          {vue === 'parc' && (
            <Text size="sm" c="dimmed">
              {echelle === 'reduit'
                ? 'Les plus prioritaires de chaque zone (5, et 8 sans rôle), le reste à déplier.'
                : 'Tout le parc, de la plus prioritaire à la moins prioritaire, en tuiles denses.'}
            </Text>
          )}
        </Group>
        {vue === 'liste' && machines.data && <BandeauSansRole n={machines.data.sansRole} />}
        <form onSubmit={chercher} role="search">
          <Group align="flex-end">
            <TextInput
              label="Rechercher"
              description="Nom, adresse IP (début ou adresse exacte) ou système."
              maxLength={100}
              value={saisie}
              onChange={(e) => setSaisie(e.currentTarget.value)}
            />
            <Button type="submit" variant="default">
              Rechercher
            </Button>
            <Select
              label="Rôle"
              placeholder="Tous"
              clearable
              value={filtres.role || null}
              onChange={(v) => changer({ role: (v ?? '') as FiltresMachines['role'] })}
              data={OPTIONS_ROLE}
              comboboxProps={{ withinPortal: false }}
            />
            <Select
              label="Périmètre"
              placeholder="Tous"
              clearable
              value={filtres.perimetre || null}
              onChange={(v) => changer({ perimetre: v ?? '' })}
              data={[
                ...(perimetres.data ?? []).map((p) => ({ value: p.id, label: p.nom })),
                // Périmètre reçu par l'adresse et absent des choix (lecture seule) : il reste nommé dans le filtre.
                ...(filtres.perimetre &&
                filtres.perimetre !== 'aucun' &&
                !(perimetres.data ?? []).some((p) => p.id === filtres.perimetre)
                  ? [{ value: filtres.perimetre, label: 'Périmètre choisi dans « Périmètres »' }]
                  : []),
                { value: 'aucun', label: 'Sans périmètre' },
              ]}
              comboboxProps={{ withinPortal: false }}
            />
            <Checkbox
              label="Fin de support"
              description="Plus de correctif de sécurité de l’éditeur"
              checked={!!filtres.finSupport}
              onChange={(e) => changer({ finSupport: e.currentTarget.checked })}
            />
          </Group>
        </form>
        {vue === 'liste' && modifier && (
          <Group align="flex-end" role="group" aria-label="Affectation des machines choisies">
            <Select
              label="Rôle à indiquer"
              placeholder="Inchangé"
              clearable
              value={role || null}
              onChange={(v) => setRole((v ?? '') as RoleMachine | 'aucun' | '')}
              data={OPTIONS_ROLE}
              comboboxProps={{ withinPortal: false }}
            />
            <Select
              label="Périmètre à indiquer"
              placeholder="Inchangé"
              clearable
              value={perimetre || null}
              onChange={(v) => setPerimetre(v ?? '')}
              data={optionsPerimetre}
              comboboxProps={{ withinPortal: false }}
            />
            <Button
              loading={envoi}
              disabled={!choisies.length || (!role && !perimetre)}
              onClick={() => void affecter()}
            >
              Appliquer à {choisies.length} machine{choisies.length > 1 ? 's' : ''}
            </Button>
          </Group>
        )}
        <ErrorAlert error={(vue === 'liste' ? machines.error : parc.error) ?? perimetres.error} />
        <LegendeMarques parc={vue === 'parc'} />
        {vue === 'parc' && parc.data && (
          <>
            <ParcMachines parc={parc.data} echelle={echelle} onOuvrir={setOuverte} onVoirListe={voirListe} />
            <Group justify="space-between">
              <Text size="sm" c="dimmed" role="status">
                {parc.data.total} machine{parc.data.total > 1 ? 's' : ''}
              </Text>
              {filtres.perimetre && filtres.perimetre !== 'aucun' && (
                <Anchor component={Link} to={adressePerimetre(filtres.perimetre)} size="sm">
                  Voir ce périmètre dans l’onglet « Périmètres »
                </Anchor>
              )}
            </Group>
          </>
        )}
        {vue === 'liste' && machines.data && (
          <MachinesTable
            machines={machines.data.elements}
            selection={modifier ? selection : undefined}
            onSelection={
              modifier
                ? (id, choisie) => {
                    const s = new Set(selection);
                    if (choisie) s.add(id);
                    else s.delete(id);
                    setSelection(s);
                  }
                : undefined
            }
            onOuvrir={setOuverte}
            onPerimetre={(id) => void navigate(adressePerimetre(id))}
          />
        )}
        {vue === 'liste' && machines.data && (
          <Group justify="space-between">
            <Text size="sm" c="dimmed" role="status">
              {machines.data.total} machine{machines.data.total > 1 ? 's' : ''}
            </Text>
            {pages > 1 && <Pagination total={pages} value={page} onChange={setPage} aria-label="Pages des machines" />}
          </Group>
        )}
      </Stack>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!ouverte}
        onClose={() => setOuverte(null)}
        title={ouverte ? libelleMachine(ouverte) : 'Machine'}
        size="lg"
        centered
        lockScroll={false}
      >
        {ouverte && <FicheMachine machine={ouverte} modifier={modifier} />}
      </Modal>
    </>
  );
}

export function MachinesPage() {
  const can = useCan();
  const lire = can('vulnerabilites', 'lire');
  const administrer = can('vulnerabilites', 'administrer');
  const [onglet, setOnglet] = useState<string | null>('machines');
  if (!lire)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit de lire les vulnérabilités.</Alert>
      </Page>
    );
  return (
    <Page>
      <PageHeader
        title="Machines"
        description="Machines lues dans Tenable Security Center ou importées d’un scan Nessus, chacune marquée de sa source (une machine vue par les deux apparaît deux fois), de la plus critique à la moins critique : exploitation avérée d’abord, puis rôle (front, back applicatif, base de données), puis nombre de failles critiques et élevées. Vous voyez celles des périmètres que vous pouvez lire ; une machine sans périmètre n’est visible qu’avec le droit d’administrer le module. Le périmètre d’une machine vient de son dépôt Tenable relié (onglet « Dépôts Tenable »), sauf s’il est indiqué à la main, ce qui prime ; une machine importée d’un scan Nessus n’a pas de dépôt : son périmètre s’indique ici. Le rôle et le périmètre sont indiqués ici, une machine à la fois ou en masse ; la fiche d’une machine relie ses produits surveillés."
      />
      <Tabs value={onglet} onChange={setOnglet} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="machines">Machines</Tabs.Tab>
          {administrer && <Tabs.Tab value="depots">Dépôts Tenable</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="machines" pt="md">
          <OngletMachines />
        </Tabs.Panel>
        {administrer && (
          <Tabs.Panel value="depots" pt="md">
            <OngletDepots />
          </Tabs.Panel>
        )}
      </Tabs>
    </Page>
  );
}

/* Module Vulnérabilités (ADR 0100, lot V5) : écran « Failles détectées ». Bascule par faille (un constat par contrôle de
   Tenable) ou par machine (constats présents par gravité), recherche (identifiant CVE, numéro ou nom du contrôle), filtres
   (gravité, exploitée, exploitable, non maintenu), fiche d'un constat (CVE, vecteur CVSS tel quel, correctif en anglais tel
   quel, machines par rôle). Écran sobre avec les composants de la charte (packages/ui), sous la CSP stricte (ADR 0006) ;
   le style du poste de commandement viendra au lot V8. Seules les machines que la personne peut lire (périmètre) sont
   comptées et montrées : le serveur en est seul juge. Lot V4a : colonne et filtre de priorité (niveau calculé par la
   plateforme et faits qui le fondent), failles « déclarées » (CVE rattachées à un produit surveillé relié à des machines),
   distinctes des failles détectées par Tenable. Lot V4b : état de suivi et filtre de suivi (par défaut, les failles encore à
   traiter ; « à clore » : corrigées selon la source, à confirmer), fiche d'une faille déclarée, suivi dans chaque fiche
   (SuiviFaille). */
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
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  type ConstatDto,
  type ConstatResumeDto,
  type EtatSynchronisationDto,
  type FailleDeclareeDto,
  type FicheDeclareeDto,
  type FiltreSuivi,
  GRAVITES_TENABLE,
  GRAVITE_TENABLE_LIBELLES,
  type GraviteTenable,
  NIVEAUX_PRIORITE,
  type NiveauPriorite,
  type PageFailles,
  type PageMachines,
  type Priorite,
  STATUT_RAPPROCHEMENT_LIBELLES,
} from '@suivi/shared';
import { DataTable, ErrorAlert, Page, PageHeader, StatusChip } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { get } from '../api';
import { fmtDate } from '../components/common';
import { resumeExecution } from '../integrations/integrations';
import { useCan } from '../session';
import {
  ETAT_PRIORITE,
  faitsPriorite,
  FILTRES_CONSTATS_VIDES,
  FILTRES_MACHINES_VIDES,
  type FiltresConstats,
  GRAVITE_TENABLE_ETAT,
  groupesParRole,
  libelleEpssTenable,
  libelleGravite,
  libelleMachine,
  lienVoirAussi,
  marquesConstat,
  resumeCves,
  urlConstats,
  urlDeclarees,
  urlMachines,
} from './failles';
import { nombrePages } from './veille';
import { MachinesTable } from './Machines';
import { MarquesSuivi, SuiviFaille } from './SuiviFaille';
import { OPTIONS_FILTRE_SUIVI } from './suivi';

const CLE = ['vulnerabilites', 'failles'] as const;

/** Priorité calculée par la plateforme et faits qui la fondent (sans état). */
export function PrioriteFaits({ p }: { p: Priorite }) {
  return (
    <Stack gap="2xs">
      <StatusChip etat={ETAT_PRIORITE[p.niveau]}>{p.niveau}</StatusChip>
      <Text size="xs" c="dimmed">
        {faitsPriorite(p).join(' · ')}
      </Text>
    </Stack>
  );
}

/** Liste des constats (sans état) : rendu testable hors navigateur. */
export function ConstatsTable({
  constats,
  onOuvrir,
}: {
  constats: ConstatResumeDto[];
  onOuvrir: (id: string) => void;
}) {
  return (
    <DataTable label="Failles détectées">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Priorité</Table.Th>
            <Table.Th>Contrôle de Tenable</Table.Th>
            <Table.Th>Suivi</Table.Th>
            <Table.Th>Gravité</Table.Th>
            <Table.Th>CVE</Table.Th>
            <Table.Th>Machines</Table.Th>
            <Table.Th>Dernière détection</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {constats.map((c) => (
            <Table.Tr key={c.id}>
              <Table.Td>
                <PrioriteFaits p={c.priorite} />
              </Table.Td>
              <Table.Td>
                <Anchor
                  component="button"
                  type="button"
                  onClick={() => onOuvrir(c.id)}
                  className="veille-texte"
                  lang="en"
                >
                  {c.nom}
                </Anchor>
                <Text size="xs" c="dimmed">
                  Contrôle n° {c.plugin}
                  {c.famille ? ` · ${c.famille}` : ''}
                </Text>
                <Group gap="2xs">
                  <StatusChip etat="info">Détecté par Tenable</StatusChip>
                  {marquesConstat(c).map((m) => (
                    <StatusChip key={m.libelle} etat={m.etat}>
                      {m.libelle}
                    </StatusChip>
                  ))}
                </Group>
              </Table.Td>
              <Table.Td>
                <MarquesSuivi s={c.suivi} present={c.present} source="Tenable" />
              </Table.Td>
              <Table.Td>
                <StatusChip etat={GRAVITE_TENABLE_ETAT[c.gravite]}>{libelleGravite(c.gravite)}</StatusChip>
                {c.cvss3Score !== null && (
                  <Text size="xs" c="dimmed">
                    CVSS 3 : {c.cvss3Score.toLocaleString('fr-FR')}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="xs" className="veille-code">
                  {resumeCves(c)}
                </Text>
                {c.nonMaintenu && c.finSupportLe && (
                  <Text size="xs" c="dimmed">
                    Fin de support : <span className="horodatage">{fmtDate(c.finSupportLe)}</span>
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {c.machines}
                {!c.present && (
                  <Text size="xs" c="dimmed">
                    vue en dernier
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {c.derniereDetection ? <span className="horodatage">{fmtDate(c.derniereDetection)}</span> : '—'}
              </Table.Td>
            </Table.Tr>
          ))}
          {constats.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text size="sm" c="dimmed">
                  Aucune faille détectée ne correspond, parmi les machines que vous pouvez lire.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Failles déclarées (sans état) : CVE rattachées à un produit surveillé relié à des machines, mention « déclaré ». */
export function DeclareesTable({
  failles,
  onOuvrir,
}: {
  failles: FailleDeclareeDto[];
  onOuvrir?: (rapprochementId: string) => void;
}) {
  return (
    <DataTable label="Failles déclarées">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Priorité</Table.Th>
            <Table.Th>CVE</Table.Th>
            <Table.Th>Suivi</Table.Th>
            <Table.Th>Produit surveillé</Table.Th>
            <Table.Th>Gravité (NVD)</Table.Th>
            <Table.Th>Machines</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {failles.map((f) => (
            <Table.Tr key={f.rapprochementId}>
              <Table.Td>
                <PrioriteFaits p={f.priorite} />
              </Table.Td>
              <Table.Td>
                {onOuvrir ? (
                  <Anchor
                    component="button"
                    type="button"
                    size="sm"
                    className="veille-code"
                    onClick={() => onOuvrir(f.rapprochementId)}
                  >
                    {f.cve}
                  </Anchor>
                ) : (
                  <Text size="sm" className="veille-code">
                    {f.cve}
                  </Text>
                )}
                <Group gap="2xs">
                  <StatusChip etat="attention">Déclaré</StatusChip>
                  {f.kev && <StatusChip etat="erreur">Exploitée (KEV)</StatusChip>}
                  {f.alerteCertFr && <StatusChip etat="erreur">Alerte CERT-FR</StatusChip>}
                </Group>
              </Table.Td>
              <Table.Td>
                <MarquesSuivi s={f.suivi} present={f.present} source="la veille" />
              </Table.Td>
              <Table.Td>
                <Text size="sm">
                  {f.produit.nom} {f.produit.versionProduit}
                </Text>
                <Text size="xs" c="dimmed">
                  {f.produit.editeur} · {STATUT_RAPPROCHEMENT_LIBELLES[f.statut]}
                </Text>
              </Table.Td>
              <Table.Td>
                {f.gravite ? (
                  <StatusChip etat={GRAVITE_TENABLE_ETAT[f.gravite]}>{libelleGravite(f.gravite)}</StatusChip>
                ) : (
                  'Non publiée'
                )}
                {f.cvssScore !== null && (
                  <Text size="xs" c="dimmed">
                    CVSS : {f.cvssScore.toLocaleString('fr-FR')}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{f.machines}</Table.Td>
            </Table.Tr>
          ))}
          {failles.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text size="sm" c="dimmed">
                  Aucune faille déclarée ne correspond : reliez un produit surveillé à ses machines depuis sa fiche.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Fiche d'un constat (sans état). Textes de Tenable en anglais, tels quels, en texte simple. */
export function FicheConstat({ c }: { c: ConstatDto }) {
  const lien = lienVoirAussi(c);
  return (
    <Stack>
      <Stack gap="2xs">
        <Title order={3} size="h6">
          Priorité calculée par la plateforme
        </Title>
        <PrioriteFaits p={c.priorite} />
      </Stack>
      <Group gap="xs">
        <StatusChip etat={GRAVITE_TENABLE_ETAT[c.gravite]}>{libelleGravite(c.gravite)}</StatusChip>
        {marquesConstat(c).map((m) => (
          <StatusChip key={m.libelle} etat={m.etat}>
            {m.libelle}
          </StatusChip>
        ))}
      </Group>
      <Text size="sm">
        Contrôle n° {c.plugin} de « {c.integration.nom} »{c.famille ? ` · ${c.famille}` : ''}.
      </Text>
      {c.synopsis && (
        <Text size="sm" className="veille-texte" lang="en">
          {c.synopsis}
        </Text>
      )}
      <Stack gap="2xs">
        <Title order={3} size="h6">
          Correctif indiqué par Tenable
        </Title>
        <Text size="sm" className="veille-texte" lang="en">
          {c.correctif ?? 'Aucun correctif indiqué.'}
        </Text>
        {c.correctifLe && (
          <Text size="xs" c="dimmed">
            Correctif publié le <span className="horodatage">{fmtDate(c.correctifLe)}</span>
          </Text>
        )}
      </Stack>
      <Stack gap="2xs">
        <Title order={3} size="h6">
          Scores
        </Title>
        <Text size="sm">
          CVSS 3 : {c.cvss3Score?.toLocaleString('fr-FR') ?? '—'} · VPR : {c.vpr?.toLocaleString('fr-FR') ?? '—'} · EPSS
          : {libelleEpssTenable(c.epss)}
        </Text>
        <Text size="xs" className="veille-code">
          {c.cvss3Vecteur ?? 'Vecteur CVSS non publié.'}
        </Text>
        {c.exploitLibelle && (
          <Text size="xs" c="dimmed" lang="en">
            {c.exploitLibelle}
          </Text>
        )}
        {c.failleLe && (
          <Text size="xs" c="dimmed">
            Faille publiée le <span className="horodatage">{fmtDate(c.failleLe)}</span>
          </Text>
        )}
        {c.finSupportLe && (
          <Text size="xs" c="dimmed">
            Fin de support : <span className="horodatage">{fmtDate(c.finSupportLe)}</span>
          </Text>
        )}
      </Stack>
      <Stack gap="2xs">
        <Title order={3} size="h6">
          CVE ({c.nombreCves})
        </Title>
        {c.cvesDetail.length ? (
          <Text size="xs" className="veille-code">
            {c.cvesDetail.map((x) => (x.kev ? `${x.cve} (KEV)` : x.cve)).join(', ')}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            Aucune CVE : système ou logiciel qui n’est plus maintenu.
          </Text>
        )}
        {c.cvesTronquees && (
          <Text size="xs" c="orange">
            Tenable cite plus de CVE que la borne retenue : seules les premières sont gardées.
          </Text>
        )}
      </Stack>
      {lien && (
        <Anchor href={lien} target="_blank" rel="noopener noreferrer" size="sm" className="veille-texte">
          Voir aussi (source externe) : {lien}
        </Anchor>
      )}
      <Title order={3} size="h6">
        Machines touchées, par rôle ({c.machines})
      </Title>
      {groupesParRole(c).map((g) => (
        <Stack key={g.role} gap="2xs" role="group" aria-label={g.libelle}>
          <Text fw={600} size="sm">
            {g.libelle} ({g.machines.length})
          </Text>
          <DataTable label={`Machines : ${g.libelle}`}>
            <Table>
              <Table.Tbody>
                {g.machines.map((m) => (
                  <Table.Tr key={`${m.machineId}-${m.port}-${m.protocole}`}>
                    <Table.Td>
                      <Text size="sm">{libelleMachine(m)}</Text>
                      {m.nom && m.adresse && (
                        <Text size="xs" c="dimmed" className="veille-code">
                          {m.adresse}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>{m.perimetreNom ?? 'Sans périmètre'}</Table.Td>
                    <Table.Td>
                      {m.protocole} {m.port}
                    </Table.Td>
                    <Table.Td>
                      {[
                        m.attenue && 'Atténuée',
                        m.risqueAccepte && 'Risque accepté',
                        m.risqueRequalifie && 'Requalifiée',
                      ]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </DataTable>
        </Stack>
      ))}
    </Stack>
  );
}

/** Fiche d'une faille déclarée (sans état) : description de NVD et action exigée du catalogue KEV en anglais, telles
    quelles ; machines lisibles reliées au produit. */
export function FicheDeclaree({ f }: { f: FicheDeclareeDto }) {
  return (
    <Stack>
      <Stack gap="2xs">
        <Title order={3} size="h6">
          Priorité calculée par la plateforme
        </Title>
        <PrioriteFaits p={f.priorite} />
      </Stack>
      <Group gap="xs">
        {f.gravite && <StatusChip etat={GRAVITE_TENABLE_ETAT[f.gravite]}>{libelleGravite(f.gravite)}</StatusChip>}
        <StatusChip etat="attention">Déclaré</StatusChip>
        {f.kev && <StatusChip etat="erreur">Exploitée (KEV)</StatusChip>}
        {f.alerteCertFr && <StatusChip etat="erreur">Alerte CERT-FR</StatusChip>}
      </Group>
      <Text size="sm">
        Produit surveillé : {f.produit.editeur} {f.produit.nom} {f.produit.versionProduit} ·{' '}
        {STATUT_RAPPROCHEMENT_LIBELLES[f.statut]}.
      </Text>
      {f.description && (
        <Text size="sm" className="veille-texte" lang="en">
          {f.description}
        </Text>
      )}
      <Stack gap="2xs">
        <Title order={3} size="h6">
          Action exigée par le catalogue KEV
        </Title>
        <Text size="sm" className="veille-texte" lang="en">
          {f.kevAction ?? 'Aucune : la faille ne figure pas au catalogue KEV.'}
        </Text>
        {f.kevEcheance && (
          <Text size="xs" c="dimmed">
            Échéance fixée par la CISA : <span className="horodatage">{fmtDate(f.kevEcheance)}</span>
          </Text>
        )}
      </Stack>
      <Title order={3} size="h6">
        Machines reliées au produit ({f.machinesReliees.length})
      </Title>
      <DataTable label="Machines reliées au produit">
        <Table>
          <Table.Tbody>
            {f.machinesReliees.map((m) => (
              <Table.Tr key={m.id}>
                <Table.Td>
                  <Text size="sm">{libelleMachine(m)}</Text>
                  {m.nom && m.adresse && (
                    <Text size="xs" c="dimmed" className="veille-code">
                      {m.adresse}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{m.perimetreNom ?? 'Sans périmètre'}</Table.Td>
                <Table.Td>{m.detectee ? 'Détectée aussi par Tenable' : 'Déclarée'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataTable>
    </Stack>
  );
}

/** Dernière synchronisation de chaque instance (sans état). */
export function EtatSynchronisations({ etats }: { etats: EtatSynchronisationDto[] }) {
  if (!etats.length)
    return (
      <Alert color="gray" role="status">
        Aucun connecteur Tenable Security Center : il se configure dans Pilotage &gt; Intégrations.
      </Alert>
    );
  return (
    <Stack gap="2xs">
      {etats.map((e) => (
        <Text key={e.integrationId} size="sm" role="status">
          <strong>{e.nom}</strong> :{' '}
          {e.derniere ? (
            <>
              <span className="horodatage">{fmtDate(e.derniere.demandeLe)}</span> ·{' '}
              {resumeExecution({ etat: e.derniere.etat, resultat: e.derniere.bilan, erreur: e.derniere.erreur })}
            </>
          ) : (
            'jamais synchronisé.'
          )}
        </Text>
      ))}
    </Stack>
  );
}

export function FaillesDetecteesPage() {
  const can = useCan();
  const lire = can('vulnerabilites', 'lire');
  const [vue, setVue] = useState<'failles' | 'machines'>('failles');
  const [saisie, setSaisie] = useState('');
  const [filtres, setFiltres] = useState<FiltresConstats>(FILTRES_CONSTATS_VIDES);
  const [page, setPage] = useState(1);
  const [pageMachines, setPageMachines] = useState(1);
  const [pageDeclarees, setPageDeclarees] = useState(1);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [declareeOuverte, setDeclareeOuverte] = useState<string | null>(null);
  const etat = useQuery({
    queryKey: [...CLE, 'etat'],
    queryFn: () => get<EtatSynchronisationDto[]>('/api/vulnerabilites/synchronisation'),
    enabled: lire,
    refetchInterval: 60_000,
  });
  const constats = useQuery({
    queryKey: [...CLE, 'constats', filtres, page],
    queryFn: () => get<PageFailles<ConstatResumeDto>>(urlConstats(filtres, page)),
    enabled: lire && vue === 'failles',
  });
  const declarees = useQuery({
    queryKey: [...CLE, 'declarees', filtres.q, filtres.priorite, filtres.etat, pageDeclarees],
    queryFn: () => get<PageFailles<FailleDeclareeDto>>(urlDeclarees(filtres, pageDeclarees)),
    enabled: lire && vue === 'failles',
  });
  const machines = useQuery({
    queryKey: [...CLE, 'machines', filtres.q, pageMachines],
    queryFn: () => get<PageMachines>(urlMachines({ ...FILTRES_MACHINES_VIDES, q: filtres.q }, pageMachines)),
    enabled: lire && vue === 'machines',
  });
  const fiche = useQuery({
    queryKey: [...CLE, 'constat', ouvert],
    queryFn: () => get<ConstatDto>(`/api/vulnerabilites/constats/${ouvert}`),
    enabled: lire && !!ouvert,
  });
  const ficheDeclaree = useQuery({
    queryKey: [...CLE, 'declaree', declareeOuverte],
    queryFn: () => get<FicheDeclareeDto>(`/api/vulnerabilites/declarees/${declareeOuverte}`),
    enabled: lire && !!declareeOuverte,
  });
  const changer = (f: Partial<FiltresConstats>) => {
    setFiltres({ ...filtres, ...f });
    setPage(1);
    setPageMachines(1);
    setPageDeclarees(1);
  };
  const chercher = (e: FormEvent) => {
    e.preventDefault();
    changer({ q: saisie.trim() });
  };

  if (!lire)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit de lire les vulnérabilités.</Alert>
      </Page>
    );
  const donnees = vue === 'failles' ? constats.data : machines.data;
  const pages = donnees ? nombrePages(donnees.total, donnees.parPage) : 1;
  return (
    <Page>
      <PageHeader
        title="Failles détectées"
        description="Failles rapportées par Tenable Security Center sur les machines que vous pouvez lire (périmètre de chaque machine), puis failles déclarées : CVE rattachées à un produit surveillé relié à ces machines. Un constat par contrôle de Tenable ; « exploitée » : une de ses CVE figure au catalogue KEV de la veille ; « non maintenu » : constat sans CVE. La priorité est calculée par la plateforme, avec les faits qui la fondent. Par défaut, seules les failles encore à traiter sont listées : le filtre « Suivi » montre les autres états et les failles à clore. Textes de Tenable en anglais, tels quels."
        actions={
          <Button component={Link} to="/vulnerabilites/machines" variant="default">
            Machines
          </Button>
        }
      />
      <Stack>
        <ErrorAlert error={etat.error} />
        {etat.data && <EtatSynchronisations etats={etat.data} />}
        <SegmentedControl
          value={vue}
          onChange={(v) => setVue(v as 'failles' | 'machines')}
          data={[
            { value: 'failles', label: 'Par faille' },
            { value: 'machines', label: 'Par machine' },
          ]}
          aria-label="Vue"
        />
        <form onSubmit={chercher} role="search">
          <Group align="flex-end">
            <TextInput
              label="Rechercher"
              description={
                vue === 'failles' ? 'Identifiant CVE, numéro ou nom du contrôle de Tenable.' : 'Nom de la machine.'
              }
              placeholder={vue === 'failles' ? 'CVE-2026-…, 900001, OpenSSL' : 'srv-…'}
              maxLength={100}
              value={saisie}
              onChange={(e) => setSaisie(e.currentTarget.value)}
            />
            <Button type="submit" variant="default">
              Rechercher
            </Button>
          </Group>
        </form>
        {vue === 'failles' && (
          <Group align="flex-end">
            <Select
              label="Suivi"
              placeholder="À traiter (nouvelles, à traiter, en cours)"
              clearable
              value={filtres.etat || null}
              onChange={(v) => changer({ etat: (v ?? '') as FiltreSuivi | '' })}
              data={OPTIONS_FILTRE_SUIVI}
              comboboxProps={{ withinPortal: false }}
            />
            <Select
              label="Priorité"
              placeholder="Toutes"
              clearable
              value={filtres.priorite || null}
              onChange={(v) => changer({ priorite: (v ?? '') as NiveauPriorite | '' })}
              data={NIVEAUX_PRIORITE.map((p) => ({ value: p, label: p }))}
              comboboxProps={{ withinPortal: false }}
            />
            <Select
              label="Gravité"
              placeholder="Toutes"
              clearable
              value={filtres.gravite || null}
              onChange={(v) => changer({ gravite: (v ?? '') as GraviteTenable | '' })}
              data={GRAVITES_TENABLE.map((g) => ({ value: g, label: GRAVITE_TENABLE_LIBELLES[g] }))}
              comboboxProps={{ withinPortal: false }}
            />
            <Checkbox
              label="Exploitées (KEV)"
              checked={filtres.exploite}
              onChange={(e) => changer({ exploite: e.currentTarget.checked })}
            />
            <Checkbox
              label="Exploitables"
              checked={filtres.exploitable}
              onChange={(e) => changer({ exploitable: e.currentTarget.checked })}
            />
            <Checkbox
              label="Non maintenus"
              checked={filtres.nonMaintenu}
              onChange={(e) => changer({ nonMaintenu: e.currentTarget.checked })}
            />
          </Group>
        )}
        <ErrorAlert error={vue === 'failles' ? constats.error : machines.error} />
        {vue === 'failles' && constats.data && <ConstatsTable constats={constats.data.elements} onOuvrir={setOuvert} />}
        {vue === 'machines' && machines.data && <MachinesTable machines={machines.data.elements} />}
        {donnees && (
          <Group justify="space-between">
            <Text size="sm" c="dimmed" role="status">
              {donnees.total} résultat{donnees.total > 1 ? 's' : ''}
            </Text>
            {pages > 1 && (
              <Pagination
                total={pages}
                value={vue === 'failles' ? page : pageMachines}
                onChange={vue === 'failles' ? setPage : setPageMachines}
                aria-label="Pages"
              />
            )}
          </Group>
        )}
        {vue === 'failles' && (
          <Stack gap="xs">
            <Title order={2} size="h4">
              Failles déclarées (produits surveillés reliés aux machines)
            </Title>
            <Text size="sm" c="dimmed">
              Une CVE rattachée à un produit surveillé (d’office ou confirmée) apparaît sur chaque machine reliée au
              produit avec la mention « déclaré », sans prétendre à une détection. Si Tenable la détecte aussi sur une
              machine, elle n’y est comptée qu’une fois, comme détectée.
            </Text>
            <ErrorAlert error={declarees.error} />
            {declarees.data && <DeclareesTable failles={declarees.data.elements} onOuvrir={setDeclareeOuverte} />}
            {declarees.data && nombrePages(declarees.data.total, declarees.data.parPage) > 1 && (
              <Pagination
                total={nombrePages(declarees.data.total, declarees.data.parPage)}
                value={pageDeclarees}
                onChange={setPageDeclarees}
                aria-label="Pages des failles déclarées"
              />
            )}
          </Stack>
        )}
      </Stack>
      <Modal
        opened={!!ouvert}
        onClose={() => setOuvert(null)}
        title={fiche.data?.nom ?? 'Faille détectée'}
        size="xl"
        centered
        lockScroll={false}
      >
        <ErrorAlert error={fiche.error} />
        {fiche.data && (
          <Stack>
            <FicheConstat c={fiche.data} />
            <SuiviFaille nature="constat" id={fiche.data.id} source="Tenable" />
          </Stack>
        )}
      </Modal>
      <Modal
        opened={!!declareeOuverte}
        onClose={() => setDeclareeOuverte(null)}
        title={ficheDeclaree.data ? `${ficheDeclaree.data.cve} (faille déclarée)` : 'Faille déclarée'}
        size="xl"
        centered
        lockScroll={false}
      >
        <ErrorAlert error={ficheDeclaree.error} />
        {ficheDeclaree.data && (
          <Stack>
            <FicheDeclaree f={ficheDeclaree.data} />
            <SuiviFaille nature="declaree" id={ficheDeclaree.data.rapprochementId} source="la veille" />
          </Stack>
        )}
      </Modal>
    </Page>
  );
}

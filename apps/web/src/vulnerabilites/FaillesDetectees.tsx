/* Module Vulnérabilités (ADR 0100, lot V5) : écran « Failles détectées ». Bascule par faille (un constat par contrôle de
   Tenable) ou par machine (constats présents par gravité), recherche (identifiant CVE, numéro ou nom du contrôle), filtres
   (gravité, exploitée, exploitable, non maintenu), fiche d'un constat (CVE, vecteur CVSS tel quel, correctif en anglais tel
   quel, machines par rôle). Écran sobre avec les composants de la charte (packages/ui), sous la CSP stricte (ADR 0006) ;
   le style du poste de commandement viendra au lot V8. Seules les machines que la personne peut lire (périmètre) sont
   comptées et montrées : le serveur en est seul juge. Lot V4a : colonne et filtre de priorité (niveau calculé par la
   plateforme et faits qui le fondent), failles « déclarées » (CVE rattachées à un produit surveillé relié à des machines),
   distinctes des failles détectées par Tenable. Lot V4b : état de suivi et filtre de suivi (par défaut, les failles encore à
   traiter ; « à clore » : corrigées selon la source, à confirmer), fiche d'une faille déclarée, suivi dans chaque fiche
   (SuiviFaille). Lot V4c : ce que chaque source dit de la faille (SourcesFaille) : exploitation avérée et « exploitable »
   avec la première source et sa date, valeurs par source et celle retenue, mentions du CERT Santé ; gravité retenue (la plus
   sévère) dans la liste des failles déclarées. Lot S1 : colonne « Délai » (état du délai de correction en clair, âge,
   échéance calculée, délai de la priorité), filtre « Délai » et tri par échéance, repris de l'adresse. Lot S3 : vue « Par
   correctif » (Correctifs.tsx : « n mises à jour à faire pour m failles »), marque et filtre « Fin de support » (date de fin
   de support de Tenable passée), distincte de « Non maintenu » (constat sans CVE) ; `?vue=correctifs` ouvre la vue. */
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
  type DelaiFailleDto,
  type EtatDelai,
  type TriFailles,
  type ConstatDto,
  type ConstatResumeDto,
  type EtatImportNessusDto,
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
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { ouvertureConstat } from './recherche';
import { get } from '../api';
import { fmtDate } from '../components/common';
import { EtatIntegration } from '../integrations/EtatIntegration';
import { peutConfigurerIntegration } from '../integrations/etat-integration';
import { resumeExecution } from '../integrations/integrations';
import { machinesImportees, resumeBilanImport } from '../integrations/nessus';
import { useCan } from '../session';
import {
  ETAT_PRIORITE,
  faitsPriorite,
  FILTRES_MACHINES_VIDES,
  filtresDepuisAdresse,
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
import { ETAT_DELAI_PUCE, libelleEtatDelai, lignesDelai, OPTIONS_FILTRE_DELAI, OPTIONS_TRI } from './delais';
import { nombrePages } from './veille';
import { CorrectifsVue } from './Correctifs';
import { FicheFaille } from './FicheFaille';
import { MachinesTable } from './Machines';
import { MarquesSources, SourcesFaille } from './SourcesFaille';
import { MarquesSuivi, SuiviFaille } from './SuiviFaille';
import { SourceConnecteur } from './SourceConnecteur';
import { OPTIONS_FILTRE_SUIVI } from './suivi';

const CLE = ['vulnerabilites', 'failles'] as const;
/** Boutons de pagination nommés (flèches comprises) : sans nom, l'axe `wcag2a` les refuse dès qu'il y a deux pages. */
const NOMS_PAGINATION = {
  getControlProps: (c: 'first' | 'previous' | 'last' | 'next') => ({
    'aria-label':
      c === 'previous'
        ? 'Page précédente'
        : c === 'next'
          ? 'Page suivante'
          : c === 'first'
            ? 'Première page'
            : 'Dernière page',
  }),
  getItemProps: (n: number) => ({ 'aria-label': `Page ${n}` }),
};

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

/** Délai de correction d'une faille (sans état, lot S1) : état en clair, âge, échéance, délai de la priorité. */
export function DelaiFaille({ d, maintenant = new Date() }: { d: DelaiFailleDto; maintenant?: Date }) {
  const l = lignesDelai(d, maintenant);
  return (
    <Stack gap="2xs">
      <StatusChip etat={ETAT_DELAI_PUCE[d.etat]}>{libelleEtatDelai(d.etat)}</StatusChip>
      <Text size="xs" c="dimmed">
        {l.age}
      </Text>
      {l.echeance && (
        <Text size="xs" c="dimmed">
          Échéance : <span className="horodatage">{l.echeance}</span>
        </Text>
      )}
      <Text size="xs" c="dimmed">
        {l.regle}
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
            <Table.Th>Délai</Table.Th>
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
                <MarquesSources s={c.sources} />
                <SourceConnecteur origine={c.integration} />
              </Table.Td>
              <Table.Td>
                <MarquesSuivi s={c.suivi} present={c.present} source="Tenable" />
              </Table.Td>
              <Table.Td>
                <DelaiFaille d={c.delai} />
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
                {c.finSupportLe && (
                  <Text size="xs" c="dimmed">
                    {c.finDeSupport ? 'Fin de support' : 'Fin de support annoncée'} :{' '}
                    <span className="horodatage">{fmtDate(c.finSupportLe)}</span>
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
              <Table.Td colSpan={8}>
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
            <Table.Th>Délai</Table.Th>
            <Table.Th>Produit surveillé</Table.Th>
            <Table.Th>Gravité (la plus sévère)</Table.Th>
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
                <MarquesSources s={f.sources} />
              </Table.Td>
              <Table.Td>
                <MarquesSuivi s={f.suivi} present={f.present} source="la veille" />
              </Table.Td>
              <Table.Td>
                <DelaiFaille d={f.delai} />
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
              <Table.Td colSpan={7}>
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

/** Fiche d'un constat (sans état). Textes de Tenable en anglais, tels quels, en texte simple. Lot PC4 : la priorité, le
    vecteur traduit, le schéma et les recommandations (dont le correctif de Tenable) sont dans la fiche illustrée commune
    (FicheFaille), placée au-dessus ; ici, le détail propre au constat. */
export function FicheConstat({ c }: { c: ConstatDto }) {
  const lien = lienVoirAussi(c);
  return (
    <Stack>
      <Group gap="xs">
        <StatusChip etat={GRAVITE_TENABLE_ETAT[c.gravite]}>{libelleGravite(c.gravite)}</StatusChip>
        {marquesConstat(c, true).map((m) => (
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
      <SourcesFaille s={c.sources} />
      <Stack gap="2xs">
        <Title order={3} size="h6">
          Scores de Tenable
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

/** Fiche d'une faille déclarée (sans état) : description de NVD en anglais, telle quelle ; machines lisibles reliées au
    produit. Lot PC4 : la priorité, le vecteur traduit, le schéma et les recommandations (dont l'action exigée du catalogue
    KEV) sont dans la fiche illustrée commune (FicheFaille), placée au-dessus. */
export function FicheDeclaree({ f }: { f: FicheDeclareeDto }) {
  return (
    <Stack>
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
      <SourcesFaille s={f.sources} />
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

/** Lot N1 : état en lecture seule de chaque instance « Nessus, import de fichier » (sans état) : date du dernier import et
    nombre de machines, erreur éventuelle, bilan ; aucun bouton (l'import se fait dans la carte « Intégrations »). */
export function EtatImports({
  etats,
  peutConfigurer = false,
}: {
  etats: EtatImportNessusDto[];
  peutConfigurer?: boolean;
}) {
  return (
    <EtatIntegration
      type="Nessus (import de fichier)"
      nature="import"
      connecteurs={etats}
      peutConfigurer={peutConfigurer}
      apresDate={(e) => (e.derniere?.bilan ? machinesImportees(e.derniere.bilan) : null)}
      detail={(e) => (e.derniere?.etat === 'recu' && e.derniere.bilan ? resumeBilanImport(e.derniere.bilan) : null)}
    />
  );
}

/** État en lecture seule de chaque instance de Tenable (sans état) : dernière synchronisation, erreur éventuelle, bilan, et
    lien « Configurer l'intégration » pour qui lit la carte de la Plateforme (ADR 0076, addendum du 19/11/2026). */
export function EtatSynchronisations({
  etats,
  peutConfigurer = false,
}: {
  etats: EtatSynchronisationDto[];
  peutConfigurer?: boolean;
}) {
  return (
    <EtatIntegration
      type="Tenable Security Center"
      connecteurs={etats}
      peutConfigurer={peutConfigurer}
      detail={(e) =>
        e.derniere?.etat === 'recu' && e.derniere.bilan
          ? resumeExecution({ etat: 'recu', resultat: e.derniere.bilan, erreur: null })
          : null
      }
    />
  );
}

export function FaillesDetecteesPage() {
  const can = useCan();
  const lire = can('vulnerabilites', 'lire');
  // Lot PC1 : les tuiles de la Vue d'ensemble ouvrent cette liste déjà filtrée (priorité, suivi, exploitation).
  const [adresse] = useSearchParams();
  const [vue, setVue] = useState<'failles' | 'machines' | 'correctifs'>(() =>
    adresse.get('vue') === 'correctifs' ? 'correctifs' : adresse.get('vue') === 'machines' ? 'machines' : 'failles',
  );
  const [filtres, setFiltres] = useState<FiltresConstats>(() => filtresDepuisAdresse(adresse));
  const [saisie, setSaisie] = useState(filtres.q);
  const [page, setPage] = useState(1);
  const [pageMachines, setPageMachines] = useState(1);
  const [pageDeclarees, setPageDeclarees] = useState(1);
  const [ouvert, setOuvert] = useState<string | null>(() => ouvertureConstat(adresse));
  // Lot R1 : la barre de recherche du module ouvre cette liste filtrée (`?q=`) ou la fiche d'un contrôle (`?constat=`), y
  // compris quand la page est déjà affichée (chaque navigation a sa clé) ; la fiche répond 404 pour l'illisible.
  const loc = useLocation();
  useEffect(() => {
    const p = new URLSearchParams(loc.search);
    if (p.has('q')) {
      const f = filtresDepuisAdresse(p);
      setVue('failles');
      setFiltres(f);
      setSaisie(f.q);
      setPage(1);
    }
    const c = ouvertureConstat(p);
    if (c) setOuvert(c);
  }, [loc.key, loc.search]);
  const [declareeOuverte, setDeclareeOuverte] = useState<string | null>(null);
  const etat = useQuery({
    queryKey: [...CLE, 'etat'],
    queryFn: () => get<EtatSynchronisationDto[]>('/api/vulnerabilites/synchronisation'),
    enabled: lire,
    refetchInterval: 60_000,
  });
  const imports = useQuery({
    queryKey: [...CLE, 'imports'],
    queryFn: () => get<EtatImportNessusDto[]>('/api/vulnerabilites/imports/etat'),
    enabled: lire,
    refetchInterval: 60_000,
  });
  const constats = useQuery({
    queryKey: [...CLE, 'constats', filtres, page],
    queryFn: () => get<PageFailles<ConstatResumeDto>>(urlConstats(filtres, page)),
    enabled: lire && vue === 'failles',
  });
  const declarees = useQuery({
    queryKey: [
      ...CLE,
      'declarees',
      filtres.q,
      filtres.priorite,
      filtres.etat,
      filtres.delai,
      filtres.tri,
      pageDeclarees,
    ],
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
  const donnees = vue === 'failles' ? constats.data : vue === 'machines' ? machines.data : undefined;
  const pages = donnees ? nombrePages(donnees.total, donnees.parPage) : 1;
  return (
    <Page>
      <PageHeader
        title="Failles détectées"
        description="Failles rapportées par Tenable Security Center, ou importées d’un scan Nessus (carte « Intégrations » de la page Plateforme), sur les machines que vous pouvez lire (périmètre de chaque machine), puis failles déclarées : CVE rattachées à un produit surveillé relié à ces machines. Un constat par contrôle de Tenable ; « exploitation avérée » : une source le signale pour une de ses CVE (catalogue KEV, alerte du CERT-FR, fiche du CERT Santé) ; « exploitable » : selon Tenable ou la fiche du CERT Santé ; « non maintenu » : constat sans CVE. La priorité est calculée par la plateforme, avec les faits qui la fondent. Par défaut, seules les failles encore à traiter sont listées : le filtre « Suivi » montre les autres états et les failles à clore. Textes de Tenable en anglais, tels quels."
        actions={
          <Button component={Link} to="/vulnerabilites/machines" variant="default">
            Machines
          </Button>
        }
      />
      <Stack>
        <ErrorAlert error={etat.error ?? imports.error} />
        {/* Lot N1 : sans instance Security Center, seul l'état des imports est montré quand il y en a. */}
        {etat.data && (etat.data.length > 0 || !imports.data?.length) && (
          <EtatSynchronisations
            etats={etat.data}
            peutConfigurer={peutConfigurerIntegration(can) && !imports.data?.length}
          />
        )}
        {!!imports.data?.length && <EtatImports etats={imports.data} peutConfigurer={peutConfigurerIntegration(can)} />}
        <SegmentedControl
          value={vue}
          onChange={(v) => setVue(v as 'failles' | 'machines' | 'correctifs')}
          data={[
            { value: 'failles', label: 'Par faille' },
            { value: 'machines', label: 'Par machine' },
            { value: 'correctifs', label: 'Par correctif' },
          ]}
          aria-label="Vue"
        />
        {vue === 'correctifs' && <CorrectifsVue onOuvrirConstat={setOuvert} />}
        {vue !== 'correctifs' && (
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
        )}
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
            <Select
              label="Délai"
              placeholder="Tous"
              clearable
              value={filtres.delai || null}
              onChange={(v) => changer({ delai: (v ?? '') as EtatDelai | '' })}
              data={OPTIONS_FILTRE_DELAI}
              comboboxProps={{ withinPortal: false }}
            />
            <Select
              label="Trier par"
              allowDeselect={false}
              value={filtres.tri || 'priorite'}
              onChange={(v) => changer({ tri: v === 'echeance' ? 'echeance' : ('' as TriFailles | '') })}
              data={OPTIONS_TRI}
              comboboxProps={{ withinPortal: false }}
            />
            <Checkbox
              label="Exploitation avérée"
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
            <Checkbox
              label="Fin de support"
              description="Plus de correctif de sécurité de l’éditeur"
              checked={filtres.finSupport}
              onChange={(e) => changer({ finSupport: e.currentTarget.checked })}
            />
          </Group>
        )}
        {vue !== 'correctifs' && <ErrorAlert error={vue === 'failles' ? constats.error : machines.error} />}
        {vue === 'failles' && constats.data && <ConstatsTable constats={constats.data.elements} onOuvrir={setOuvert} />}
        {vue === 'machines' && machines.data && <MachinesTable machines={machines.data.elements} />}
        {donnees && vue !== 'correctifs' && (
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
                {...NOMS_PAGINATION}
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
                {...NOMS_PAGINATION}
              />
            )}
          </Stack>
        )}
      </Stack>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
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
            <FicheFaille nature="constat" id={fiche.data.id} />
            <FicheConstat c={fiche.data} />
            <SuiviFaille nature="constat" id={fiche.data.id} source="Tenable" />
          </Stack>
        )}
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
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
            <FicheFaille nature="declaree" id={ficheDeclaree.data.rapprochementId} />
            <FicheDeclaree f={ficheDeclaree.data} />
            <SuiviFaille nature="declaree" id={ficheDeclaree.data.rapprochementId} source="la veille" />
          </Stack>
        )}
      </Modal>
    </Page>
  );
}

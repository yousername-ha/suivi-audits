/* Module Vulnérabilités (ADR 0100, lots V2 et V3) : écran « Veille ». État de chaque source (dernière collecte réussie,
   erreur, retard), activation de la veille (destinations et ce qui sort, validation explicite d'un administrateur), failles
   exploitées récentes (catalogue KEV) avec l'action exigée et l'échéance, alertes et avis récents, barre de recherche.
   Écran sobre avec les composants de la charte (packages/ui), sous la CSP stricte (ADR 0006) ; le style du poste de
   commandement viendra au lot V8. Les textes des sources s'affichent tels quels (anglais pour la CISA et NVD), comme texte
   simple ; un lien vers l'avis s'ouvre dans un nouvel onglet sans transmettre de référent. Les boutons suivent les droits de
   la session pour l'affichage seulement : le serveur reste seul juge.
   Lot V4c : état de la lecture des fiches du CERT Santé ; produit cité et mentions de chaque fiche, telles quelles ; pour
   une faille connue, sources qui l'ont publiée (la première d'abord), exploitation avérée et « exploitable » avec leur
   première source et sa date.
   Lot L1 : pastille de chaque source (PictoSource) ; alertes et avis en liste aérée (AvisVeille.tsx), une alerte du CERT-FR
   se détache d'un avis, la fiche d'une alerte ou d'un avis s'ouvre depuis la liste, ses CVE ouvrent leur fiche illustrée ;
   failles connues en liste, un fait par ligne (gravité, exploitation, EPSS, produit touché).
   Lot F1 : fréquence de chaque source (liste déroulante pour qui administre le module, texte sinon ; EPSS fixe), avertissement
   de NVD et d'EPSS, prochaine collecte prévue. */
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Modal,
  Pagination,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  avertissementVeille,
  fluxExterne,
  FREQUENCES_VEILLE,
  frequenceVeilleModifiable,
  libelleFrequence,
  PRECISION_MANDATAIRE,
  type AvisVeilleDto,
  type EtatSourceVeilleDto,
  type EtatVeilleDto,
  type FailleVeilleDto,
  type PageVeille,
  type SourceVeille,
} from '@suivi/shared';
import { ConfirmButton, DataTable, ErrorAlert, Page, PageHeader, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { api, errorMessage, get } from '../api';
import { FicheAvis, ListeAvis } from './AvisVeille';
import { fmtDate } from '../components/common';
import { ChampFrequence } from '../components/ChampFrequence';
import { CLE_FLUX_EXTERNES } from '../components/FluxExternes';
import { Destinations, useValidationFlux } from '../components/ValidationFlux';
import { useCan } from '../session';
import { FicheFaille } from './FicheFaille';
import { ouvertureVeille } from './recherche';
import { resumeFichesCertSante, resumePublications } from './sources';
import { PictoSource, PictosSources } from './PictoSource';
import { pictoVeille, sansDoublon, type SourcePicto } from './pictos-sources';
import { MarquesSources } from './SourcesFaille';
import { libelleSurfaceCve, LIEN_SURFACE } from './surface';
import {
  dateCourte,
  echeanceDepassee,
  etatSource,
  GRAVITE_ETAT,
  GRAVITE_LIBELLES,
  identifiantAvis,
  libelleEpss,
  libelleLangue,
  messageCollectesDemandees,
  nombrePages,
  urlAvis,
  urlFailles,
} from './veille';

const CLE = ['vulnerabilites', 'veille'] as const;
const FLUX = 'veille-vulnerabilites' as const;

/** Lot F1 : fréquence d'une source (liste déroulante pour qui administre, texte sinon ; EPSS fixe), avertissement du tableau du
    RSSI relié au champ, et prochaine collecte automatique prévue. Sans état React. */
export function FrequenceSource({
  s,
  peutRegler,
  enCours,
  onFrequence,
}: {
  s: EtatSourceVeilleDto;
  peutRegler: boolean;
  enCours: boolean;
  onFrequence?: (s: EtatSourceVeilleDto, heures: number) => void;
}) {
  const avertissement = avertissementVeille(s.source);
  const reglable = peutRegler && !!onFrequence && frequenceVeilleModifiable(s.source);
  return (
    <Stack gap="2xs">
      {reglable ? (
        <ChampFrequence
          size="xs"
          ariaLabel={`Fréquence de la source ${s.libelle}`}
          frequences={FREQUENCES_VEILLE[s.source]}
          valeur={s.frequenceHeures}
          disabled={enCours}
          avertissement={avertissement}
          onChange={(h) => onFrequence(s, h)}
        />
      ) : (
        <>
          <Text size="sm">
            {libelleFrequence(s.frequenceHeures)}
            {!frequenceVeilleModifiable(s.source) && ' (fixe)'}
          </Text>
          {avertissement && (
            <Text size="xs" c="dimmed" className="veille-texte">
              {avertissement}
            </Text>
          )}
        </>
      )}
      <Text size="xs" c="dimmed">
        Prochaine collecte :{' '}
        {s.prochaineCollecte ? (
          <span className="horodatage">{fmtDate(s.prochaineCollecte)}</span>
        ) : (
          'aucune (veille désactivée)'
        )}
      </Text>
    </Stack>
  );
}

/** État des sources (sans état React) : rendu testable hors navigateur. */
export function SourcesTable({
  sources,
  fluxOuvert,
  peutRegler = false,
  enCours = null,
  onFrequence,
}: {
  sources: EtatSourceVeilleDto[];
  fluxOuvert: boolean;
  /** Droit d'administrer le module (affichage seulement : le serveur reste seul juge). */
  peutRegler?: boolean;
  /** Source dont le réglage est en cours d'envoi. */
  enCours?: SourceVeille | null;
  onFrequence?: (s: EtatSourceVeilleDto, heures: number) => void;
}) {
  return (
    <DataTable label="Sources de la veille">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Source</Table.Th>
            <Table.Th>Format et langue</Table.Th>
            <Table.Th>Fréquence</Table.Th>
            <Table.Th>Dernière collecte réussie</Table.Th>
            <Table.Th>État</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sources.map((s) => {
            const e = etatSource(s, fluxOuvert);
            return (
              <Table.Tr key={s.source}>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap" align="center">
                    <PictoSource source={pictoVeille(s.source)} />
                    <Text fw={600}>{s.libelle}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {s.organisme} · <span className="veille-code">{s.hote}</span>
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{s.format}</Text>
                  <Text size="xs" c="dimmed">
                    {libelleLangue(s.langue)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <FrequenceSource
                    s={s}
                    peutRegler={peutRegler}
                    enCours={enCours === s.source}
                    onFrequence={onFrequence}
                  />
                </Table.Td>
                <Table.Td>
                  {s.derniereReussite ? (
                    <span className="horodatage">{fmtDate(s.derniereReussite)}</span>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Jamais
                    </Text>
                  )}
                  {s.derniereCollecte?.tronque && s.derniereCollecte.etat === 'recu' && (
                    <Text size="xs" c="orange">
                      Dernière collecte incomplète : la source annonçait plus d’éléments que la borne.
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <StatusChip etat={e.etat}>{e.libelle}</StatusChip>
                  {s.erreur && (
                    <Text size="xs" c="red" className="veille-texte">
                      {s.erreur}
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Lecture des fiches du CERT Santé (sans état React) : fiches lues, à lire, date de la dernière lecture. */
export function FichesCertSante({ f }: { f: EtatVeilleDto['fichesCertSante'] }) {
  return (
    <Text size="sm">
      Fiches du CERT Santé (mentions structurées de chaque publication qui cite une CVE) : {resumeFichesCertSante(f)}{' '}
      Dernière lecture :{' '}
      {f.derniereLecture ? <span className="horodatage">{fmtDate(f.derniereLecture)}</span> : 'jamais'}.
    </Text>
  );
}

/** Activation de la veille : flux fermé, destinations et ce qui sort, bouton pour l'administrateur ; ouvert, désactivation. */
export function ActivationVeille({
  etat,
  peutActiver,
  envoi,
  onActiver,
  onDesactiver,
}: {
  etat: EtatVeilleDto;
  peutActiver: boolean;
  envoi: boolean;
  onActiver: () => void;
  onDesactiver: () => void;
}) {
  const f = fluxExterne(FLUX);
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Title order={2} size="h4">
          Activation
        </Title>
        <Badge variant="light" color={etat.flux.ouvert ? 'green' : 'gray'}>
          {etat.flux.ouvert ? 'Veille active' : 'Veille inactive'}
        </Badge>
      </Group>
      {!etat.flux.ouvert && (
        <Alert color="orange" role="status" title="Aucune source n’est lue">
          La veille est inactive : son flux vers l’extérieur est fermé. L’activer ouvre ce flux, après validation par un
          administrateur ; la désactivation du module Vulnérabilités le referme.
        </Alert>
      )}
      <Text size="sm">Destinations, toutes en lecture :</Text>
      <Destinations f={f} />
      {etat.mandataire.actif && (
        <Text size="sm">
          <strong>Par le mandataire de l’établissement :</strong> {PRECISION_MANDATAIRE} Pare-feu : sortie du serveur
          vers le mandataire, sur le port réglé (Configuration système, Mandataire sortant).
        </Text>
      )}
      <Text size="sm">
        <strong>Ce qui sort du serveur :</strong> {f.donnees}
      </Text>
      {etat.flux.ouvert && !etat.executant.disponible && (
        <Alert color="orange" role="status" title="Exécutant d’exploitation non vu">
          C’est l’exécutant d’exploitation du serveur qui lit les sources : sans lui, aucune collecte n’est faite (guide
          d’installation, étape 11.6).
        </Alert>
      )}
      {peutActiver ? (
        <Group>
          {etat.flux.ouvert ? (
            <ConfirmButton
              variant="default"
              disabled={envoi}
              message="Désactiver la veille ? Son flux vers l’extérieur est refermé ; les failles et avis déjà collectés restent consultables."
              onConfirm={onDesactiver}
            >
              Désactiver la veille
            </ConfirmButton>
          ) : (
            <Button loading={envoi} onClick={onActiver}>
              Activer la veille
            </Button>
          )}
        </Group>
      ) : (
        !etat.flux.ouvert && (
          <Text size="sm" c="dimmed">
            Seul un administrateur peut activer la veille.
          </Text>
        )
      )}
    </Stack>
  );
}

/** Identifiant d'une CVE ; avec `onOuvrir`, bouton qui ouvre sa fiche illustrée (lot PC4). */
function CodeCve({ cve, onOuvrir }: { cve: string; onOuvrir?: (cve: string) => void }) {
  return onOuvrir ? (
    <Anchor component="button" type="button" fw={600} className="veille-code" onClick={() => onOuvrir(cve)}>
      {cve}
    </Anchor>
  ) : (
    <Text fw={600} className="veille-code">
      {cve}
    </Text>
  );
}

/** Failles du catalogue KEV : action exigée et échéance, textes de la CISA tels quels (anglais). */
export function KevTable({
  failles,
  aujourdhui,
  onOuvrir,
}: {
  failles: FailleVeilleDto[];
  aujourdhui: string;
  onOuvrir?: (cve: string) => void;
}) {
  return (
    <DataTable label="Failles exploitées (catalogue KEV)">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Faille</Table.Th>
            <Table.Th>Éditeur et produit</Table.Th>
            <Table.Th>Action exigée (CISA)</Table.Th>
            <Table.Th>Échéance</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {failles.map((f) => (
            <Table.Tr key={f.cve}>
              <Table.Td>
                <CodeCve cve={f.cve} onOuvrir={onOuvrir} />
                <Text size="xs" className="veille-texte" lang="en">
                  {f.kev?.nom}
                </Text>
                <Text size="xs" c="dimmed">
                  Ajoutée le {dateCourte(f.kev?.ajoutLe ?? null)}
                  {f.kev?.rancongiciel ? ' · utilisée par un rançongiciel' : ''}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" lang="en">
                  {f.kev?.editeur} · {f.kev?.produit}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="xs" className="veille-texte" lang="en">
                  {f.kev?.action}
                </Text>
              </Table.Td>
              <Table.Td>
                {f.kev?.echeance ? (
                  <StatusChip etat={echeanceDepassee(f.kev.echeance, aujourdhui) ? 'attention' : 'neutre'}>
                    {dateCourte(f.kev.echeance)}
                  </StatusChip>
                ) : (
                  '—'
                )}
              </Table.Td>
            </Table.Tr>
          ))}
          {failles.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text size="sm" c="dimmed">
                  Aucune faille du catalogue KEV à afficher.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Sources d'une CVE de la veille : celles qui l'ont publiée, FIRST pour un score EPSS, AlgoLightHouse pour l'exposition. */
function sourcesCve(f: FailleVeilleDto): SourcePicto[] {
  return sansDoublon([
    ...f.publications.map((p) => pictoVeille(p.source)),
    ...(f.epss ? (['epss'] as const) : []),
    ...(f.surfaceExterne ? (['algolighthouse'] as const) : []),
  ]);
}

/** Failles connues (résultat d'une recherche), en liste : un fait par ligne (gravité CVSS, exploitation, score EPSS,
    produit touché), sources en pastilles. Sans état React : rendu testable hors navigateur. */
export function ListeFailles({ failles, onOuvrir }: { failles: FailleVeilleDto[]; onOuvrir?: (cve: string) => void }) {
  if (!failles.length)
    return (
      <Text size="sm" c="dimmed">
        Aucune faille connue ne correspond à la recherche.
      </Text>
    );
  return (
    <ul className="vf-liste" aria-label="Failles connues de la veille">
      {failles.map((f) => {
        const cvss = f.cvss40 ?? f.cvss31;
        const produits = [
          ...new Set([...(f.kev ? [`${f.kev.editeur} · ${f.kev.produit}`] : []), ...f.produits, ...f.produitsCites]),
        ];
        return (
          <li key={f.cve} className={`vf-item${f.kev ? ' vf-item--exploitee' : ''}`}>
            <div className="vf-tete">
              <CodeCve cve={f.cve} onOuvrir={onOuvrir} />
              {f.kev && <StatusChip etat="erreur">Exploitée (KEV)</StatusChip>}
              {f.publieLe && <span className="vf-date">Publiée le {dateCourte(f.publieLe)}</span>}
            </div>
            <div className="vf-sources">
              <PictosSources sources={sourcesCve(f)} libelle={`Sources de ${f.cve}`} />
              <Text size="xs" c="dimmed" span>
                Publiée par : {resumePublications(f.publications)}
              </Text>
            </div>
            {f.description && (
              <p className="vf-description veille-texte" lang="en">
                {f.description}
              </p>
            )}
            <dl className="vf-faits">
              <div>
                <dt>Gravité (CVSS)</dt>
                <dd>
                  {cvss ? (
                    <>
                      <StatusChip etat={GRAVITE_ETAT[cvss.gravite]}>
                        {GRAVITE_LIBELLES[cvss.gravite]} · {cvss.score.toLocaleString('fr-FR')}
                      </StatusChip>
                      <span className="vf-vecteur veille-code">{cvss.vecteur}</span>
                    </>
                  ) : (
                    <span className="vf-vide">Non publiée</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Exploitation</dt>
                <dd>
                  {f.sources.exploitation.length || f.sources.exploitable.length ? (
                    <MarquesSources s={f.sources} />
                  ) : (
                    <span className="vf-vide">Aucune source ne la signale</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>EPSS (FIRST)</dt>
                <dd>{f.epss ? libelleEpss(f.epss) : <span className="vf-vide">Non publié</span>}</dd>
              </div>
              <div>
                <dt>Produit touché</dt>
                <dd>
                  {produits.length ? (
                    <ul className="vf-produits">
                      {produits.map((p) => (
                        <li key={p} className="veille-texte">
                          {p}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="vf-vide">Non publié</span>
                  )}
                  {f.editeurs.length > 0 && (
                    <span className="vf-editeurs veille-texte">Éditeurs (CPE) : {f.editeurs.join(', ')}</span>
                  )}
                </dd>
              </div>
              {f.surfaceExterne && (
                <div>
                  <dt>Exposition</dt>
                  <dd>
                    <StatusChip etat="attention">Exposée sur Internet</StatusChip>{' '}
                    <Anchor component={Link} to={LIEN_SURFACE} size="xs">
                      {libelleSurfaceCve(f.surfaceExterne)}
                    </Anchor>
                  </dd>
                </div>
              )}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

function Pages({
  donnees,
  page,
  onPage,
  libelle,
}: {
  donnees: PageVeille<unknown> | undefined;
  page: number;
  onPage: (p: number) => void;
  libelle: string;
}) {
  if (!donnees) return null;
  const pages = nombrePages(donnees.total, donnees.parPage);
  return (
    <Group justify="space-between">
      <Text size="sm" c="dimmed" role="status">
        {donnees.total} résultat{donnees.total > 1 ? 's' : ''}
      </Text>
      {pages > 1 && <Pagination total={pages} value={page} onChange={onPage} aria-label={libelle} />}
    </Group>
  );
}

export function VeillePage() {
  const can = useCan();
  const qc = useQueryClient();
  const lire = can('vulnerabilites', 'lire');
  const administrer = can('vulnerabilites', 'administrer');
  const admin = can('administration', 'administrer');
  const flux = useValidationFlux();
  // Lot PC1 : la Vue d'ensemble ouvre la veille sur une CVE (`?q=`) quand aucune fiche de faille n'est lisible.
  const [adresse] = useSearchParams();
  const [saisie, setSaisie] = useState(() => (adresse.get('q') ?? '').trim().slice(0, 100));
  const [recherche, setRecherche] = useState(saisie);
  const [pageKev, setPageKev] = useState(1);
  const [pageAvis, setPageAvis] = useState(1);
  const [pageFailles, setPageFailles] = useState(1);
  const [envoi, setEnvoi] = useState(false);
  const [collecte, setCollecte] = useState(false);
  const [frequenceEnCours, setFrequenceEnCours] = useState<SourceVeille | null>(null);
  const [erreur, setErreur] = useState<unknown>(null);
  const [cveOuverte, setCveOuverte] = useState<string | null>(() => ouvertureVeille(adresse).cve);
  const [avisOuvert, setAvisOuvert] = useState<AvisVeilleDto | null>(null);
  // Une CVE citée par une alerte ou un avis ouvre sa fiche illustrée à la place de la fiche de l'avis.
  const ouvrirCve = (cve: string) => {
    setAvisOuvert(null);
    setCveOuverte(cve);
  };
  // Lot R1 : la barre de recherche du module ouvre la veille sur une recherche (`?q=`) ou sur la fiche d'une CVE (`?cve=`),
  // y compris quand la page est déjà affichée (chaque navigation a sa clé).
  const loc = useLocation();
  useEffect(() => {
    const o = ouvertureVeille(new URLSearchParams(loc.search));
    if (o.q !== null) {
      setSaisie(o.q);
      setRecherche(o.q);
      setPageKev(1);
      setPageAvis(1);
      setPageFailles(1);
    }
    if (o.cve) setCveOuverte(o.cve);
  }, [loc.key, loc.search]);
  const etat = useQuery({
    queryKey: [...CLE, 'etat'],
    queryFn: () => get<EtatVeilleDto>('/api/vulnerabilites/veille/etat'),
    enabled: lire,
    refetchInterval: 30_000,
  });
  const kev = useQuery({
    queryKey: [...CLE, 'kev', recherche, pageKev],
    queryFn: () => get<PageVeille<FailleVeilleDto>>(urlFailles(recherche, true, pageKev)),
    enabled: lire,
  });
  const avis = useQuery({
    queryKey: [...CLE, 'avis', recherche, pageAvis],
    queryFn: () => get<PageVeille<AvisVeilleDto>>(urlAvis(recherche, pageAvis)),
    enabled: lire,
  });
  const failles = useQuery({
    queryKey: [...CLE, 'failles', recherche, pageFailles],
    queryFn: () => get<PageVeille<FailleVeilleDto>>(urlFailles(recherche, false, pageFailles)),
    enabled: lire && !!recherche,
  });
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const basculer = async (ouvert: boolean) => {
    if (ouvert && !(await flux.valider(FLUX, undefined, etat.data?.mandataire.actif))) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await api('PUT', `/api/admin/flux-externes/${FLUX}`, { body: { ouvert, confirmation: true } });
      await qc.invalidateQueries({ queryKey: CLE });
      await qc.invalidateQueries({ queryKey: CLE_FLUX_EXTERNES });
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const collecter = async () => {
    setCollecte(true);
    try {
      const r = await api<unknown[]>('POST', '/api/vulnerabilites/veille/collectes', { body: {} });
      notifications.show({
        color: 'teal',
        message: messageCollectesDemandees(r.length),
      });
      await qc.invalidateQueries({ queryKey: [...CLE, 'etat'] });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      setCollecte(false);
    }
  };
  // Lot F1 : la fréquence choisie part aussitôt (If-Match : version de la source) ; le serveur refuse ce qui sort de la liste.
  const reglerFrequence = async (src: EtatSourceVeilleDto, heures: number) => {
    setFrequenceEnCours(src.source);
    try {
      await api('PUT', `/api/vulnerabilites/veille/sources/${src.source}/frequence`, {
        body: { frequenceHeures: heures },
        ifMatch: src.version,
      });
      notifications.show({
        color: 'teal',
        message: `${src.libelle} : ${libelleFrequence(heures).toLowerCase()}.`,
      });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      await qc.invalidateQueries({ queryKey: [...CLE, 'etat'] });
      setFrequenceEnCours(null);
    }
  };
  const chercher = (e: FormEvent) => {
    e.preventDefault();
    setRecherche(saisie.trim());
    setPageKev(1);
    setPageAvis(1);
    setPageFailles(1);
  };

  if (!lire)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit de lire les vulnérabilités.</Alert>
      </Page>
    );
  return (
    <Page>
      <PageHeader
        title="Veille"
        description="Failles et avis publiés par cinq sources publiques (CISA, NIST, FIRST, CERT-FR, CERT Santé), lus à la fréquence choisie pour chaque source (toutes les deux heures par défaut, EPSS une fois par jour) par l’exécutant d’exploitation du serveur. Les textes des sources sont repris tels quels : ce sont des données, pas des consignes."
        actions={
          administrer &&
          etat.data?.flux.ouvert && (
            <Button loading={collecte} onClick={() => void collecter()}>
              Collecter maintenant
            </Button>
          )
        }
      />
      <Stack>
        <ErrorAlert error={etat.error || erreur} />
        {etat.data && (
          <>
            <ActivationVeille
              etat={etat.data}
              peutActiver={admin}
              envoi={envoi}
              onActiver={() => void basculer(true)}
              onDesactiver={() => void basculer(false)}
            />
            {flux.fenetre}
            <Title order={2} size="h4">
              Sources
            </Title>
            <SourcesTable
              sources={etat.data.sources}
              fluxOuvert={etat.data.flux.ouvert}
              peutRegler={administrer}
              enCours={frequenceEnCours}
              onFrequence={(src, h) => void reglerFrequence(src, h)}
            />
            <FichesCertSante f={etat.data.fichesCertSante} />
          </>
        )}
        <form onSubmit={chercher} role="search">
          <Group align="flex-end">
            <TextInput
              label="Rechercher"
              description="Identifiant CVE, éditeur, produit, ou texte du titre d’un avis."
              placeholder="CVE-2026-…, éditeur, produit"
              maxLength={100}
              value={saisie}
              onChange={(e) => setSaisie(e.currentTarget.value)}
            />
            <Button type="submit" variant="default">
              Rechercher
            </Button>
            {recherche && (
              <Button
                variant="subtle"
                onClick={() => {
                  setSaisie('');
                  setRecherche('');
                  setPageKev(1);
                  setPageAvis(1);
                }}
              >
                Effacer
              </Button>
            )}
          </Group>
        </form>
        {recherche && (
          <>
            <Title order={2} size="h4">
              Failles connues
            </Title>
            <ErrorAlert error={failles.error} />
            {failles.data && <ListeFailles failles={failles.data.elements} onOuvrir={setCveOuverte} />}
            <Pages donnees={failles.data} page={pageFailles} onPage={setPageFailles} libelle="Pages des failles" />
          </>
        )}
        <Title order={2} size="h4">
          Failles exploitées récentes (catalogue KEV)
        </Title>
        <ErrorAlert error={kev.error} />
        {kev.data && <KevTable failles={kev.data.elements} aujourdhui={aujourdhui} onOuvrir={setCveOuverte} />}
        <Pages donnees={kev.data} page={pageKev} onPage={setPageKev} libelle="Pages du catalogue KEV" />
        <Title order={2} size="h4">
          Alertes et avis récents
        </Title>
        <ErrorAlert error={avis.error} />
        {avis.data && <ListeAvis avis={avis.data.elements} onOuvrir={setAvisOuvert} onOuvrirCve={ouvrirCve} />}
        <Pages donnees={avis.data} page={pageAvis} onPage={setPageAvis} libelle="Pages des avis" />
      </Stack>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!cveOuverte}
        onClose={() => setCveOuverte(null)}
        title={cveOuverte ? `${cveOuverte} (veille)` : 'Faille de la veille'}
        size="xl"
        centered
        lockScroll={false}
      >
        {cveOuverte && <FicheFaille nature="cve" id={cveOuverte} />}
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!avisOuvert}
        onClose={() => setAvisOuvert(null)}
        title={
          avisOuvert ? `${identifiantAvis(avisOuvert)} (${avisOuvert.nature === 'alerte' ? 'alerte' : 'avis'})` : 'Avis'
        }
        size="lg"
        centered
        lockScroll={false}
      >
        {avisOuvert && <FicheAvis a={avisOuvert} onOuvrirCve={ouvrirCve} />}
      </Modal>
    </Page>
  );
}

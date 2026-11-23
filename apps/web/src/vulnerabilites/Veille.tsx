import { BarreFiltres } from '../components/BarreFiltres';
/* Module Vulnérabilités (ADR 0100, lots V2 et V3) : écran « Veille ». Failles exploitées récentes (catalogue KEV) avec
   l'action exigée et l'échéance, alertes et avis récents, barre de recherche. Écran sobre avec les composants de la charte
   (packages/ui), sous la CSP stricte (ADR 0006). Les textes des sources s'affichent tels quels (anglais pour la CISA et NVD),
   comme texte simple ; un lien vers l'avis s'ouvre dans un nouvel onglet sans transmettre de référent.
   Lot V4c : état de la lecture des fiches du CERT Santé ; produit cité et mentions de chaque fiche, telles quelles ; pour
   une faille connue, sources qui l'ont publiée (la première d'abord), exploitation avérée et « exploitable » avec leur
   première source et sa date.
   Lot L1 : pastille de chaque source (PictoSource) ; alertes et avis en liste aérée (AvisVeille.tsx), une alerte du CERT-FR
   se détache d'un avis, la fiche d'une alerte ou d'un avis s'ouvre depuis la liste, ses CVE ouvrent leur fiche illustrée ;
   failles connues en liste, un fait par ligne (gravité, exploitation, EPSS, produit touché).
   Lot CVE-INC : annonces des sources facultatives (préavis de Cloudflare Radar, résumés de tldrcve ; AnnoncesVeille.tsx) ; la
   fiche d'une CVE (FicheCve.tsx) montre leurs marques, et, pour une CVE inconnue de la veille, la consultation de cve.org et
   NVD sur clic, les contrôles Tenable et le lien « Voir chez Tenable ».
   Lot VEILLE-PLATEFORME (décision du RSSI du 23/11/2026, « comme pour les intégrations ») : aucun réglage ici. Activation,
   fréquences, « Collecter maintenant », dictionnaire CPE et sources facultatives se règlent dans la carte « Veille des
   vulnérabilités » de la Plateforme (ConfigurationVeille.tsx) ; l'écran n'en garde qu'une ligne d'état par source et un lien
   « Configurer », visible seulement de qui peut configurer la veille (peutConfigurerVeille). */
import { Alert, Anchor, Group, Modal, Pagination, Stack, Table, Text, TextInput, Title, Button } from '@mantine/core';
import {
  type AvisVeilleDto,
  type EtatDictionnaireCpeDto,
  type EtatVeilleDto,
  type FailleVeilleDto,
  type PageVeille,
} from '@suivi/shared';
import { DataTable, ErrorAlert, Page, StatusChip } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { EnteteVulnerabilites } from './EnteteVulnerabilites';
import { get } from '../api';
import { FicheAvis, ListeAvis } from './AvisVeille';
import { URL_DICTIONNAIRE_CPE } from './dictionnaire-cpe';
import { fmtDate } from '../components/common';
import { useCan } from '../session';
import { FicheCve } from './FicheCve';
import { AnnoncesVeilleSection, useSourcesAnnonces } from './AnnoncesVeille';
import { ouvertureVeille } from './recherche';
import { resumeFichesCertSante, resumePublications } from './sources';
import { PictoSource, PictosSources } from './PictoSource';
import { pictoVeille, sansDoublon, type SourcePicto } from './pictos-sources';
import { MarquesSources } from './SourcesFaille';
import { libelleSurfaceCve, LIEN_SURFACE } from './surface';
import {
  dateCourte,
  echeanceDepassee,
  GRAVITE_ETAT,
  GRAVITE_LIBELLES,
  identifiantAvis,
  libelleEpss,
  LIEN_CONFIGURATION_VEILLE,
  type LigneEtatVeille,
  lignesEtatVeille,
  nombrePages,
  peutConfigurerVeille,
  urlAvis,
  urlFailles,
} from './veille';
import { NOMS_PAGINATION } from './pagination';

const CLE = ['vulnerabilites', 'veille'] as const;

/** Lot VEILLE-PLATEFORME : une ligne d'état par source, en lecture seule (active ou non, dernière collecte réussie, retard,
    erreur courte), puis le lien « Configurer » vers la carte de la Plateforme, visible seulement de qui peut configurer la
    veille (droit passé par l'appelant). Aucun réglage, aucun bouton. Sans état React : rendu testable hors navigateur. */
export function EtatSourcesVeille({
  lignes,
  veilleActive,
  executantVu,
  peutConfigurer,
}: {
  lignes: readonly LigneEtatVeille[];
  veilleActive: boolean;
  executantVu: boolean;
  /** Droit de configurer la veille (`peutConfigurerVeille`), calculé par l'appelant : seul il montre le lien. */
  peutConfigurer: boolean;
}) {
  return (
    <Stack gap="xs" component="section" aria-label="État de la veille">
      <Group justify="space-between">
        <Title order={2} size="h4">
          État des sources
        </Title>
        <Group gap="xs">
          <StatusChip etat={veilleActive ? 'succes' : 'neutre'}>
            {veilleActive ? 'Veille active' : 'Veille inactive'}
          </StatusChip>
          {veilleActive && !executantVu && <StatusChip etat="attention">Exécutant non vu</StatusChip>}
        </Group>
      </Group>
      <DataTable label="État des sources de la veille">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Source</Table.Th>
              <Table.Th>État</Table.Th>
              <Table.Th>Dernière collecte réussie</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lignes.map((l) => (
              <Table.Tr key={l.cle}>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap" align="center">
                    {l.picto && <PictoSource source={pictoVeille(l.picto)} />}
                    <Text size="sm" fw={600}>
                      {l.libelle}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <StatusChip etat={l.etat.etat}>{l.etat.libelle}</StatusChip>
                  {l.erreur && (
                    <Text size="xs" c="red" className="veille-texte">
                      {l.erreur}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {l.derniere ? (
                    <span className="horodatage">{fmtDate(l.derniere)}</span>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Jamais
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataTable>
      {peutConfigurer && (
        <div>
          <Anchor component={Link} to={LIEN_CONFIGURATION_VEILLE} size="sm">
            Configurer<span className="sr-only"> la veille des vulnérabilités</span>
          </Anchor>
        </div>
      )}
    </Stack>
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
      {pages > 1 && (
        <Pagination {...NOMS_PAGINATION} total={pages} value={page} onChange={onPage} aria-label={libelle} />
      )}
    </Group>
  );
}

export function VeillePage() {
  const can = useCan();
  const lire = can('vulnerabilites', 'lire');
  // Lot PC1 : la Vue d'ensemble ouvre la veille sur une CVE (`?q=`) quand aucune fiche de faille n'est lisible.
  const [adresse] = useSearchParams();
  const [saisie, setSaisie] = useState(() => (adresse.get('q') ?? '').trim().slice(0, 100));
  const [recherche, setRecherche] = useState(saisie);
  const [pageKev, setPageKev] = useState(1);
  const [pageAvis, setPageAvis] = useState(1);
  const [pageFailles, setPageFailles] = useState(1);
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
  // État en lecture seule des sources (lignes d'état) : mêmes lectures que la carte de la Plateforme, sans réglage.
  const etat = useQuery({
    queryKey: [...CLE, 'etat'],
    queryFn: () => get<EtatVeilleDto>('/api/vulnerabilites/veille/etat'),
    enabled: lire,
    refetchInterval: 30_000,
  });
  const dictionnaire = useQuery({
    queryKey: [...CLE, 'dictionnaire-cpe'],
    queryFn: () => get<EtatDictionnaireCpeDto>(URL_DICTIONNAIRE_CPE),
    enabled: lire,
    refetchInterval: 30_000,
  });
  const annonces = useSourcesAnnonces(lire);
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
      <EnteteVulnerabilites
        title="Veille"
        description="Failles et avis publiés par les sources publiques (CISA, NIST, FIRST, CERT-FR, CERT Santé), repris tels quels : ce sont des données, pas des consignes."
      />
      <Stack>
        <ErrorAlert error={etat.error || dictionnaire.error || annonces.error} />
        {etat.data && (
          <>
            <EtatSourcesVeille
              lignes={lignesEtatVeille(etat.data, dictionnaire.data, annonces.data)}
              veilleActive={etat.data.flux.ouvert}
              executantVu={etat.data.executant.disponible}
              peutConfigurer={peutConfigurerVeille(can)}
            />
            <FichesCertSante f={etat.data.fichesCertSante} />
          </>
        )}
        <form onSubmit={chercher} role="search">
          <BarreFiltres label="Veille des vulnérabilités">
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
          </BarreFiltres>
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
        <AnnoncesVeilleSection sources={annonces.data} onOuvrirCve={setCveOuverte} />
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
        {cveOuverte && <FicheCve cve={cveOuverte} />}
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

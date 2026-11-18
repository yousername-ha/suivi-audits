/* Module Vulnérabilités (ADR 0100, lots V2 et V3) : écran « Veille ». État de chaque source (dernière collecte réussie,
   erreur, retard), activation de la veille (destinations et ce qui sort, validation explicite d'un administrateur), failles
   exploitées récentes (catalogue KEV) avec l'action exigée et l'échéance, alertes et avis récents, barre de recherche.
   Écran sobre avec les composants de la charte (packages/ui), sous la CSP stricte (ADR 0006) ; le style du poste de
   commandement viendra au lot V8. Les textes des sources s'affichent tels quels (anglais pour la CISA et NVD), comme texte
   simple ; un lien vers l'avis s'ouvre dans un nouvel onglet sans transmettre de référent. Les boutons suivent les droits de
   la session pour l'affichage seulement : le serveur reste seul juge.
   Lot V4c : état de la lecture des fiches du CERT Santé ; produit cité et mentions de chaque fiche, telles quelles ; pour
   une faille connue, sources qui l'ont publiée (la première d'abord), exploitation avérée et « exploitable » avec leur
   première source et sa date. */
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
  fluxExterne,
  PRECISION_MANDATAIRE,
  type AvisVeilleDto,
  type EtatSourceVeilleDto,
  type EtatVeilleDto,
  type FailleVeilleDto,
  type PageVeille,
} from '@suivi/shared';
import { ConfirmButton, DataTable, ErrorAlert, Page, PageHeader, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, errorMessage, get } from '../api';
import { fmtDate } from '../components/common';
import { CLE_FLUX_EXTERNES } from '../components/FluxExternes';
import { Destinations, useValidationFlux } from '../components/ValidationFlux';
import { useCan } from '../session';
import { FicheFaille } from './FicheFaille';
import { resumeFichesCertSante, resumePublications } from './sources';
import { MarquesSources, MentionsFicheCertSante } from './SourcesFaille';
import { libelleSurfaceCve, LIEN_SURFACE } from './surface';
import {
  adresseAvis,
  dateCourte,
  echeanceDepassee,
  etatSource,
  GRAVITE_ETAT,
  GRAVITE_LIBELLES,
  identifiantAvis,
  libelleEpss,
  libelleLangue,
  libelleSourceAvis,
  nombrePages,
  urlAvis,
  urlFailles,
} from './veille';

const CLE = ['vulnerabilites', 'veille'] as const;
const FLUX = 'veille-vulnerabilites' as const;

/** État des sources (sans état React) : rendu testable hors navigateur. */
export function SourcesTable({ sources, fluxOuvert }: { sources: EtatSourceVeilleDto[]; fluxOuvert: boolean }) {
  return (
    <DataTable label="Sources de la veille">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Source</Table.Th>
            <Table.Th>Format et langue</Table.Th>
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
                  <Text fw={600}>{s.libelle}</Text>
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

/** Alertes et avis : identifiant (lien vers l'avis, nouvel onglet, sans référent), titre et résumé en texte simple. */
export function AvisTable({ avis }: { avis: AvisVeilleDto[] }) {
  return (
    <DataTable label="Alertes et avis">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Avis</Table.Th>
            <Table.Th>Titre et résumé</Table.Th>
            <Table.Th>Failles citées</Table.Th>
            <Table.Th>Publié le</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {avis.map((a) => {
            const lien = adresseAvis(a);
            return (
              <Table.Tr key={a.id}>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {libelleSourceAvis(a.source)} · {a.nature === 'alerte' ? 'alerte' : 'avis'}
                  </Text>
                  {lien ? (
                    <Anchor
                      href={lien}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      size="sm"
                      className="veille-code"
                    >
                      {identifiantAvis(a)}
                    </Anchor>
                  ) : (
                    <Text size="sm" className="veille-code">
                      {identifiantAvis(a)}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={600} className="veille-texte">
                    {a.titre}
                  </Text>
                  {a.resume && (
                    <Text size="xs" c="dimmed" className="veille-texte">
                      {a.resume}
                    </Text>
                  )}
                  {a.produit && (
                    <Text size="xs" className="veille-texte">
                      Produit cité : {a.produit}
                    </Text>
                  )}
                  {a.fiche && <MentionsFicheCertSante f={a.fiche} />}
                </Table.Td>
                <Table.Td>
                  <Text size="xs" className="veille-code">
                    {a.cves.length
                      ? a.cves.slice(0, 6).join(', ') + (a.cves.length > 6 ? ` (+${a.cves.length - 6})` : '')
                      : '—'}
                  </Text>
                </Table.Td>
                <Table.Td>{a.publieLe ? <span className="horodatage">{fmtDate(a.publieLe)}</span> : '—'}</Table.Td>
              </Table.Tr>
            );
          })}
          {avis.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text size="sm" c="dimmed">
                  Aucune alerte ni aucun avis à afficher.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Failles connues (résultat d'une recherche) : gravité CVSS, score EPSS, éditeurs et produits des CPE, présence au KEV. */
export function FaillesTable({ failles, onOuvrir }: { failles: FailleVeilleDto[]; onOuvrir?: (cve: string) => void }) {
  return (
    <DataTable label="Failles connues de la veille">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Faille</Table.Th>
            <Table.Th>Gravité (CVSS)</Table.Th>
            <Table.Th>EPSS</Table.Th>
            <Table.Th>Éditeurs et produits</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {failles.map((f) => {
            const cvss = f.cvss40 ?? f.cvss31;
            return (
              <Table.Tr key={f.cve}>
                <Table.Td>
                  <Group gap="2xs">
                    <CodeCve cve={f.cve} onOuvrir={onOuvrir} />
                    {f.kev && <StatusChip etat="erreur">Exploitée (KEV)</StatusChip>}
                  </Group>
                  {f.description && (
                    <Text size="xs" className="veille-texte" lang="en">
                      {f.description}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    Publiée par : {resumePublications(f.publications)}
                  </Text>
                  <MarquesSources s={f.sources} />
                  {f.surfaceExterne && (
                    <Group gap="2xs">
                      <StatusChip etat="attention">Exposée sur Internet</StatusChip>
                      <Anchor component={Link} to={LIEN_SURFACE} size="xs">
                        {libelleSurfaceCve(f.surfaceExterne)}
                      </Anchor>
                    </Group>
                  )}
                </Table.Td>
                <Table.Td>
                  {cvss ? (
                    <>
                      <StatusChip etat={GRAVITE_ETAT[cvss.gravite]}>
                        {GRAVITE_LIBELLES[cvss.gravite]} · {cvss.score.toLocaleString('fr-FR')}
                      </StatusChip>
                      <Text size="xs" c="dimmed" className="veille-code">
                        {cvss.vecteur}
                      </Text>
                    </>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Non publiée
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{f.epss ? libelleEpss(f.epss) : '—'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" className="veille-texte">
                    {[
                      ...new Set([
                        ...(f.kev ? [`${f.kev.editeur} · ${f.kev.produit}`] : []),
                        ...f.produits,
                        ...f.produitsCites,
                      ]),
                    ].join(', ') || '—'}
                  </Text>
                  {f.editeurs.length > 0 && (
                    <Text size="xs" c="dimmed" className="veille-texte">
                      Éditeurs (CPE) : {f.editeurs.join(', ')}
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
          {failles.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text size="sm" c="dimmed">
                  Aucune faille connue ne correspond à la recherche.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
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
  const [erreur, setErreur] = useState<unknown>(null);
  const [cveOuverte, setCveOuverte] = useState<string | null>(null);
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
        message: `${r.length} collecte${r.length > 1 ? 's' : ''} demandée${r.length > 1 ? 's' : ''} : l’exécutant les traite à son prochain passage.`,
      });
      await qc.invalidateQueries({ queryKey: [...CLE, 'etat'] });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      setCollecte(false);
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
        description="Failles et avis publiés par cinq sources publiques (CISA, NIST, FIRST, CERT-FR, CERT Santé), lus une fois par jour par l’exécutant d’exploitation du serveur. Les textes des sources sont repris tels quels : ce sont des données, pas des consignes."
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
            <SourcesTable sources={etat.data.sources} fluxOuvert={etat.data.flux.ouvert} />
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
            {failles.data && <FaillesTable failles={failles.data.elements} onOuvrir={setCveOuverte} />}
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
        {avis.data && <AvisTable avis={avis.data.elements} />}
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
    </Page>
  );
}

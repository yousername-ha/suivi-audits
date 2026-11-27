import { BarreFiltres } from '../components/BarreFiltres';
/* Veille réglementaire (ADR 0110, lots VR-1 et VR-2) : publications de la CNIL, du CEPD, d'EUR-Lex, de l'ANSSI, du CERT
   Santé et du Journal officiel, filtrées
   par statut, domaine et source, avec recherche ; qualification en un clic (« Sans objet », « À suivre », « Impactant ») pour
   qui tient le rôle du domaine (RSSI pour la sécurité, DPO pour les données personnelles) ; état des sources (activation,
   fréquence, dernière collecte réussie, erreur) et activation du flux, sur le modèle de l'écran Veille des vulnérabilités ;
   mots-clés des filtres d'EUR-Lex et du Journal officiel, une carte par source (lecture pour tous, saisie pour qui
   administre).
   Charte de packages/ui, CSP stricte (ADR 0006) : aucun style en ligne, `lockScroll={false}`, aucune prop Mantine de style
   responsive. Les textes des sources s'affichent tels quels, comme texte simple (rendu échappé par React) ; un lien s'ouvre
   dans un nouvel onglet sans transmettre de référent. Les boutons suivent les droits pour l'affichage seulement : le serveur
   reste seul juge.
   Style « Verre » (dessin Veille validé par le RSSI le 27/11/2026, VeilleVerre.tsx) : sources en rail dans l'en-tête,
   tuiles par statut, liste compacte et publication choisie côte à côte ; activation, sources et mots-clés restent dessous. */
import {
  Alert,
  Badge,
  Button,
  Group,
  Pagination,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  VisuallyHidden,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  DOMAINES_REGLEMENTAIRES,
  type DroitsVeilleReglementaireDto,
  estSourceFiltree,
  type EtatSourceReglementaireDto,
  type EtatVeilleReglementaireDto,
  type MotCleEurLex,
  fluxExterne,
  FREQUENCES_VEILLE_REGLEMENTAIRE,
  libelleFrequence,
  LIBELLES_DOMAINES,
  type PagePublicationsDto,
  PRECISION_MANDATAIRE,
  type PublicationReglementaireDto,
  SOURCES_REGLEMENTAIRES,
  STATUTS_PUBLICATION,
  STATUTS_QUALIFIES,
  type StatutQualifie,
  type SyntheseVeilleReglementaireDto,
} from '@suivi/shared';
import { APropos, ConfirmButton, DataTable, ErrorAlert, Page, PageHeader, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api, errorMessage, get } from '../api';
import { ChampFrequence } from '../components/ChampFrequence';
import { fmtDate } from '../components/common';
import { CLE_FLUX_EXTERNES } from '../components/FluxExternes';
import { Destinations, useValidationFlux } from '../components/ValidationFlux';
import { useCan, useMe, usePermission } from '../session';
import { DetailPublicationVerre, ListeTextesVerre, RailSources, RailStatut, TuilesVeilleVerre } from './VeilleVerre';
import { TeteCase } from '../vulnerabilites/Instruments';
import { TRACES_FORMES } from '../vulnerabilites/pictos-sources';
import { deuxChiffres } from '../vulnerabilites/vue-ensemble';
import {
  AUTORITES_REGLEMENTAIRES,
  etatSourceReglementaire,
  FILTRES_MOTS_CLES,
  FILTRES_VIDES,
  type FiltresPublications,
  libelleSource,
  libelleStatut,
  lienPublication,
  lignesMotsCles,
  motsClesSaisis,
  messageCollectes,
  peutQualifier,
  PICTOS_REGLEMENTAIRES,
  qualifieurDuDomaine,
  urlPublications,
} from './veille-reglementaire';
import { NOMS_PAGINATION } from '../vulnerabilites/pagination';

const CLE = ['veille-reglementaire'] as const;
const FLUX = 'veille-reglementaire' as const;

/** Pastille d'une source réglementaire (sigle, forme, teinte de la charte ; classes de packages/ui, aucun logo officiel). */
export function PictoReglementaire({ source }: { source: PublicationReglementaireDto['source'] }) {
  const d = PICTOS_REGLEMENTAIRES[source];
  return (
    <span className={`ps ps--${d.teinte} ps--${d.forme}`} role="img" aria-label={`Source : ${d.nom}`}>
      <svg className="ps__pastille" viewBox="0 0 44 24" aria-hidden="true" focusable="false">
        <path className="ps__forme" d={TRACES_FORMES[d.forme]} />
        <text className="ps__sigle" x={22} y={16.2} textAnchor="middle" fontSize={d.sigle.length > 3 ? 10.5 : 12}>
          {d.sigle}
        </text>
      </svg>
    </span>
  );
}

/** Synthèse (sans état React) : nombre de publications par statut, dernière collecte, sources en erreur. */
export function SyntheseReglementaire({ s }: { s: SyntheseVeilleReglementaireDto }) {
  // Cases d'instrument (choix du RSSI du 22/11/2026) : le chiffre et l'icône sont décoratifs, le texte lu reste
  // « À qualifier : 3 ».
  return (
    <Stack gap="xs">
      <div className="pc-tuiles vr-sommaire" role="list" aria-label="Synthèse de la veille réglementaire">
        {(
          [
            ['À qualifier', s.aQualifier, 'a-qualifier', 'aQualifierVeille'],
            ['À suivre', s.aSuivre, 'a-suivre', 'aSuivreVeille'],
            ['Impactant', s.impactant, 'impactant', 'impactantVeille'],
            ['Sans objet', s.sansObjet, 'sans-objet', 'sansObjetVeille'],
          ] as const
        ).map(([libelle, n, statut, icone], i) => (
          <div role="listitem" key={libelle} className={`pc-tuile vr--${statut}`}>
            <TeteCase icone={icone} rang={i + 1} />
            <span className="pc-etiquette" aria-hidden="true">
              {libelle}
            </span>
            <b aria-hidden="true">{deuxChiffres(n)}</b>
            <VisuallyHidden>
              {libelle} : {n}
            </VisuallyHidden>
          </div>
        ))}
      </div>
      <Text size="sm" c="dimmed">
        Dernière collecte :{' '}
        {s.derniereCollecteLe ? <span className="horodatage">{fmtDate(s.derniereCollecteLe)}</span> : 'jamais'}
        {s.sourcesEnErreur > 0 && ` · ${s.sourcesEnErreur} source${s.sourcesEnErreur > 1 ? 's' : ''} en erreur`}
      </Text>
    </Stack>
  );
}

/** Boutons de qualification d'une publication (sans état React). */
export function BoutonsQualification({
  p,
  enCours,
  onQualifier,
}: {
  p: PublicationReglementaireDto;
  enCours: boolean;
  onQualifier: (p: PublicationReglementaireDto, statut: StatutQualifie) => void;
}) {
  return (
    <Group gap="xs" role="group" aria-label={`Qualifier « ${p.titre} »`}>
      {STATUTS_QUALIFIES.map((statut) => (
        <Button
          key={statut}
          size="xs"
          variant={p.statut === statut ? 'filled' : 'default'}
          aria-pressed={p.statut === statut}
          disabled={enCours}
          onClick={() => onQualifier(p, statut)}
        >
          {libelleStatut(statut)}
        </Button>
      ))}
    </Group>
  );
}

/** Liste des publications (sans état React) : rendu testable hors navigateur. */
export function ListePublications({
  publications,
  droits,
  enCours = null,
  onQualifier,
}: {
  publications: PublicationReglementaireDto[];
  droits?: DroitsVeilleReglementaireDto;
  enCours?: string | null;
  onQualifier?: (p: PublicationReglementaireDto, statut: StatutQualifie) => void;
}) {
  if (!publications.length)
    return (
      <Text size="sm" c="dimmed">
        Aucune publication ne correspond.
      </Text>
    );
  return (
    <Stack gap="sm" role="list" aria-label="Publications">
      {publications.map((p) => {
        const lien = lienPublication(p);
        const autorite = AUTORITES_REGLEMENTAIRES[p.source];
        // Carte d'acte (choix du RSSI du 22/11/2026, style de la page de maintenance, sobre) : source et autorité,
        // statut, titre, résumé en citation, champs datés, puis qualification et lien.
        return (
          <article key={p.id} role="listitem" className={`pc-niveau vr-acte vr--${p.statut}`}>
            <header className="vr-tete">
              <span className="vr-source">
                <PictoReglementaire source={p.source} />
                {autorite.court} · {autorite.autorite}
              </span>
              <span className="vr-statut">{libelleStatut(p.statut)}</span>
            </header>
            <h3 className="vr-titre veille-texte">{p.titre}</h3>
            {p.resume && <blockquote className="vr-resume veille-texte">{p.resume}</blockquote>}
            <dl className="vr-champs">
              <div>
                <dt>Publié le</dt>
                <dd className="horodatage">{fmtDate(p.publieLe)}</dd>
              </div>
              <div>
                <dt>Domaine</dt>
                <dd>{LIBELLES_DOMAINES[p.domaine]}</dd>
              </div>
              <div>
                <dt>Qualification</dt>
                <dd>
                  {p.qualifiePar && p.qualifieLe ? (
                    <>
                      Qualifiée par {p.qualifiePar.nom} le <span className="horodatage">{fmtDate(p.qualifieLe)}</span>
                    </>
                  ) : (
                    'Non qualifiée'
                  )}
                </dd>
              </div>
            </dl>
            <div className="vr-pied">
              {onQualifier && peutQualifier(droits, p) ? (
                <BoutonsQualification p={p} enCours={enCours === p.id} onQualifier={onQualifier} />
              ) : (
                p.statut === 'a-qualifier' && (
                  <Text size="xs" c="dimmed">
                    Qualification réservée {qualifieurDuDomaine(p.domaine)}.
                  </Text>
                )
              )}
              {lien ? (
                <a
                  className="va-lien"
                  href={lien}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >
                  Lire sur le site de la source
                </a>
              ) : (
                <Text size="xs" c="dimmed">
                  Lien indisponible
                </Text>
              )}
            </div>
          </article>
        );
      })}
    </Stack>
  );
}

/** État des sources (sans état React). */
export function SourcesReglementaires({
  sources,
  fluxOuvert,
  peutRegler = false,
  enCours = null,
  onRegler,
}: {
  sources: EtatSourceReglementaireDto[];
  fluxOuvert: boolean;
  peutRegler?: boolean;
  enCours?: string | null;
  onRegler?: (s: EtatSourceReglementaireDto, r: { activee?: boolean; frequenceHeures?: number }) => void;
}) {
  return (
    <DataTable label="Sources de la veille réglementaire">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Source</Table.Th>
            <Table.Th>Domaine et reprise</Table.Th>
            <Table.Th>Activée</Table.Th>
            <Table.Th>Fréquence</Table.Th>
            <Table.Th>Dernière collecte réussie</Table.Th>
            <Table.Th>État</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sources.map((s) => {
            const e = etatSourceReglementaire(s, fluxOuvert);
            const reglable = peutRegler && !!onRegler && s.collecteur;
            return (
              <Table.Tr key={s.source}>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap" align="center">
                    <PictoReglementaire source={s.source} />
                    <Text fw={600}>{s.libelle}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {s.organisme}
                    {s.hote && (
                      <>
                        {' '}
                        · <span className="veille-code">{s.hote}</span>
                      </>
                    )}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{LIBELLES_DOMAINES[s.domaine]}</Text>
                  <Text size="xs" c="dimmed" className="veille-texte">
                    {s.reprise}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {reglable ? (
                    <Switch
                      aria-label={`Activer la source ${s.libelle}`}
                      checked={s.activee}
                      disabled={enCours === s.source}
                      onChange={(ev) => onRegler(s, { activee: ev.currentTarget.checked })}
                    />
                  ) : (
                    <Text size="sm">{s.activee ? 'Oui' : 'Non'}</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {reglable ? (
                    <ChampFrequence
                      size="xs"
                      ariaLabel={`Fréquence de la source ${s.libelle}`}
                      frequences={FREQUENCES_VEILLE_REGLEMENTAIRE}
                      valeur={s.frequenceHeures}
                      disabled={enCours === s.source}
                      avertissement={null}
                      onChange={(h) => onRegler(s, { frequenceHeures: h })}
                    />
                  ) : (
                    <Text size="sm">{s.collecteur ? libelleFrequence(s.frequenceHeures) : '—'}</Text>
                  )}
                  {s.prochaineCollecte && (
                    <Text size="xs" c="dimmed">
                      Prochaine : <span className="horodatage">{fmtDate(s.prochaineCollecte)}</span>
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {s.derniereReussite ? (
                    <span className="horodatage">{fmtDate(s.derniereReussite)}</span>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Jamais
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

/** Mots-clés du filtre d'une source (EUR-Lex, Journal officiel) : liste par domaine ; saisie (un mot par ligne) pour qui
    administre. Une région nommée par carte : les champs de saisie de deux cartes se distinguent par elle. */
export function MotsClesEurLex({
  source,
  peutRegler = false,
  enCours = false,
  onEnregistrer,
}: {
  source: EtatSourceReglementaireDto;
  peutRegler?: boolean;
  enCours?: boolean;
  onEnregistrer?: (motsCles: MotCleEurLex[] | null) => void;
}) {
  const liste = source.motsCles?.liste ?? [];
  const [texte, setTexte] = useState(() => ({
    securite: lignesMotsCles(liste, 'securite'),
    'donnees-personnelles': lignesMotsCles(liste, 'donnees-personnelles'),
  }));
  const reglable = peutRegler && !!onEnregistrer;
  const filtre = FILTRES_MOTS_CLES[estSourceFiltree(source.source) ? source.source : 'eur-lex'];
  return (
    <Stack gap="xs" component="section" aria-label={filtre.titre}>
      <Title order={2} size="h4">
        {filtre.titre}
      </Title>
      <Text size="sm" className="lecture">
        {filtre.texte} Le domaine de l’acte est celui du mot trouvé ; si des mots des deux domaines sont trouvés, l’acte
        va aux données personnelles. {source.motsCles?.parDefaut ? 'Liste par défaut.' : 'Liste réglée.'}
      </Text>
      {reglable ? (
        <>
          <Group align="flex-start" grow>
            {DOMAINES_REGLEMENTAIRES.map((d) => (
              <Textarea
                key={d}
                label={`Mots du domaine « ${LIBELLES_DOMAINES[d]} »`}
                description="Un mot ou une expression par ligne."
                autosize
                minRows={4}
                maxRows={12}
                value={texte[d]}
                disabled={enCours}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setTexte((x) => ({ ...x, [d]: v }));
                }}
              />
            ))}
          </Group>
          <Group>
            <Button loading={enCours} onClick={() => onEnregistrer(motsClesSaisis(texte))}>
              Enregistrer les mots-clés
            </Button>
            {!source.motsCles?.parDefaut && (
              <ConfirmButton
                variant="default"
                color="gray"
                disabled={enCours}
                message="Rétablir la liste de mots-clés par défaut ?"
                onConfirm={() => onEnregistrer(null)}
              >
                Rétablir la liste par défaut
              </ConfirmButton>
            )}
          </Group>
        </>
      ) : (
        <Group align="flex-start" grow>
          {DOMAINES_REGLEMENTAIRES.map((d) => (
            <Stack key={d} gap="2xs">
              <Text size="sm" fw={600}>
                {LIBELLES_DOMAINES[d]}
              </Text>
              <Text size="sm" className="veille-texte">
                {liste
                  .filter((m) => m.domaine === d)
                  .map((m) => m.mot)
                  .join(' · ') || '—'}
              </Text>
            </Stack>
          ))}
        </Group>
      )}
    </Stack>
  );
}

/** Activation du flux de la veille réglementaire (sans état React) : destinations, ce qui sort, bouton de l'administrateur. */
export function ActivationVeilleReglementaire({
  etat,
  peutActiver,
  envoi,
  onActiver,
  onDesactiver,
}: {
  etat: EtatVeilleReglementaireDto;
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
          La veille réglementaire est inactive : son flux vers l’extérieur est fermé. L’activer ouvre ce flux, après
          validation par un administrateur ; chaque source s’active ensuite à part. La désactivation du module le
          referme.
        </Alert>
      )}
      <Text size="sm">Destinations, toutes en lecture :</Text>
      <Destinations f={f} />
      {etat.mandataire.actif && (
        <Text size="sm">
          <strong>Par le mandataire de l’établissement :</strong> {PRECISION_MANDATAIRE}
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
              message="Désactiver la veille réglementaire ? Son flux vers l’extérieur est refermé ; les publications déjà collectées et leur qualification restent consultables."
              onConfirm={onDesactiver}
            >
              Désactiver la veille réglementaire
            </ConfirmButton>
          ) : (
            <Button loading={envoi} onClick={onActiver}>
              Activer la veille réglementaire
            </Button>
          )}
        </Group>
      ) : (
        !etat.flux.ouvert && (
          <Text size="sm" c="dimmed">
            Seul un administrateur peut activer la veille réglementaire.
          </Text>
        )
      )}
    </Stack>
  );
}

const optionsStatut = STATUTS_PUBLICATION.map((s) => ({ value: s, label: libelleStatut(s) }));
const optionsDomaine = DOMAINES_REGLEMENTAIRES.map((d) => ({ value: d, label: LIBELLES_DOMAINES[d] }));
const optionsSource = SOURCES_REGLEMENTAIRES.map((s) => ({ value: s, label: libelleSource(s) }));

export function VeilleReglementairePage() {
  const can = useCan();
  const qc = useQueryClient();
  const has = usePermission();
  // Lecture : droit du module, ou le droit réservé « DPO » à lui seul (comme le serveur).
  const lire = can('veille_reglementaire', 'lire') || has('veille_reglementaire:dpo');
  const administrer = can('veille_reglementaire', 'administrer');
  const admin = can('administration', 'administrer');
  const flux = useValidationFlux();
  const [filtres, setFiltres] = useState<FiltresPublications>(FILTRES_VIDES);
  const [saisie, setSaisie] = useState('');
  const [page, setPage] = useState(1);
  const [envoi, setEnvoi] = useState(false);
  const [collecte, setCollecte] = useState(false);
  const [qualification, setQualification] = useState<string | null>(null);
  const [reglage, setReglage] = useState<string | null>(null);
  const [motsClesEnCours, setMotsClesEnCours] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const verre = useMe().appearance.style === 'verre';
  // Publication montrée à droite (style « Verre ») : la première de la page tant qu'aucune n'est choisie.
  const [choisie, setChoisie] = useState<string | null>(null);

  const synthese = useQuery({
    queryKey: [...CLE, 'synthese'],
    queryFn: () => get<SyntheseVeilleReglementaireDto>('/api/veille-reglementaire/synthese'),
    enabled: lire,
  });
  const publications = useQuery({
    queryKey: [...CLE, 'publications', filtres, page],
    queryFn: () => get<PagePublicationsDto>(urlPublications(filtres, page)),
    enabled: lire,
  });
  const etat = useQuery({
    queryKey: [...CLE, 'sources'],
    queryFn: () => get<EtatVeilleReglementaireDto>('/api/veille-reglementaire/sources'),
    enabled: lire,
    refetchInterval: 30_000,
  });
  const droits = useQuery({
    queryKey: [...CLE, 'droits'],
    queryFn: () => get<DroitsVeilleReglementaireDto>('/api/veille-reglementaire/droits'),
    enabled: lire,
  });

  const filtrer = (f: Partial<FiltresPublications>) => {
    setFiltres((x) => ({ ...x, ...f }));
    setPage(1);
  };
  const chercher = (e: FormEvent) => {
    e.preventDefault();
    filtrer({ q: saisie.trim() });
  };
  // Qualification en un clic : If-Match sur la version lue ; le serveur refuse ce que le rôle ne permet pas.
  const qualifier = async (p: PublicationReglementaireDto, statut: StatutQualifie) => {
    setQualification(p.id);
    try {
      await api('PATCH', `/api/veille-reglementaire/publications/${p.id}`, { body: { statut }, ifMatch: p.version });
      notifications.show({ color: 'teal', message: `« ${p.titre} » : ${libelleStatut(statut).toLowerCase()}.` });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      await qc.invalidateQueries({ queryKey: [...CLE, 'publications'] });
      await qc.invalidateQueries({ queryKey: [...CLE, 'synthese'] });
      setQualification(null);
    }
  };
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
      const r = await api<unknown[]>('POST', '/api/veille-reglementaire/collectes', { body: {} });
      notifications.show({ color: 'teal', message: messageCollectes(r.length) });
      await qc.invalidateQueries({ queryKey: [...CLE, 'sources'] });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      setCollecte(false);
    }
  };
  const regler = async (s: EtatSourceReglementaireDto, r: { activee?: boolean; frequenceHeures?: number }) => {
    setReglage(s.source);
    try {
      await api('PATCH', `/api/veille-reglementaire/sources/${s.source}`, { body: r, ifMatch: s.version });
      notifications.show({
        color: 'teal',
        message:
          r.activee === undefined
            ? `${s.libelle} : ${libelleFrequence(r.frequenceHeures!).toLowerCase()}.`
            : `${s.libelle} : source ${r.activee ? 'activée' : 'désactivée'}.`,
      });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      await qc.invalidateQueries({ queryKey: [...CLE, 'sources'] });
      setReglage(null);
    }
  };

  const reglerMotsCles = async (s: EtatSourceReglementaireDto, motsCles: MotCleEurLex[] | null) => {
    setMotsClesEnCours(true);
    try {
      await api('PUT', `/api/veille-reglementaire/sources/${s.source}/mots-cles`, {
        body: { motsCles },
        ifMatch: s.version,
      });
      notifications.show({
        color: 'teal',
        message: motsCles
          ? `Mots-clés ${estSourceFiltree(s.source) ? FILTRES_MOTS_CLES[s.source].nom : ''} enregistrés.`
          : 'Liste de mots-clés par défaut rétablie.',
      });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      await qc.invalidateQueries({ queryKey: [...CLE, 'sources'] });
      setMotsClesEnCours(false);
    }
  };

  if (!lire)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit de lire la veille réglementaire.</Alert>
      </Page>
    );
  const pages = publications.data ? Math.max(1, Math.ceil(publications.data.total / publications.data.parPage)) : 1;
  const description =
    'Publications de la CNIL, du CEPD, d’EUR-Lex et du Journal officiel (actes filtrés par mots-clés), de l’ANSSI et du CERT Santé, lues par l’exécutant d’exploitation du serveur à la fréquence choisie pour chaque source. Chaque publication arrive « à qualifier » : le rôle RSSI qualifie la sécurité, le droit DPO les données personnelles. Les textes des sources sont repris tels quels ; pour l’ANSSI, le CERT Santé et le Journal officiel, seuls le titre, la date et le lien sont gardés.';
  const collecteBouton = administrer && etat.data?.flux.ouvert && (
    <Button loading={collecte} onClick={() => void collecter()}>
      Collecter maintenant
    </Button>
  );
  const pagination = pages > 1 && (
    <Group justify="center">
      <Pagination
        {...NOMS_PAGINATION}
        total={pages}
        value={page}
        onChange={setPage}
        aria-label="Pages des publications"
      />
    </Group>
  );
  const fonctionnement = (
    <>
      <ErrorAlert error={etat.error} />
      {etat.data && (
        <>
          <ActivationVeilleReglementaire
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
          <SourcesReglementaires
            sources={etat.data.sources}
            fluxOuvert={etat.data.flux.ouvert}
            peutRegler={administrer}
            enCours={reglage}
            onRegler={(s, r) => void regler(s, r)}
          />
          {etat.data.sources
            .filter((x) => x.motsCles)
            .map((filtree) => (
              <MotsClesEurLex
                // Clé : la saisie repart de la liste enregistrée après chaque réglage.
                key={`${filtree.source}-${filtree.version}`}
                source={filtree}
                peutRegler={administrer}
                enCours={motsClesEnCours}
                onEnregistrer={(m) => void reglerMotsCles(filtree, m)}
              />
            ))}
        </>
      )}
    </>
  );
  if (verre) {
    const elements = publications.data?.elements ?? [];
    const montree = elements.find((p) => p.id === choisie) ?? elements[0];
    const s = synthese.data;
    return (
      <Page>
        <p className="vr-verre__surtitre">
          Conformité · dernière collecte{' '}
          {s?.derniereCollecteLe ? (
            <>
              le <span className="horodatage">{fmtDate(s.derniereCollecteLe)}</span>
            </>
          ) : (
            ': jamais'
          )}
          {!!s?.sourcesEnErreur && ` · ${s.sourcesEnErreur} source${s.sourcesEnErreur > 1 ? 's' : ''} en erreur`}
        </p>
        <PageHeader
          title="Veille réglementaire"
          actions={
            <>
              <RailSources source={filtres.source} onSource={(source) => filtrer({ source })} />
              {collecteBouton}
            </>
          }
        />
        <APropos label="À propos de la veille réglementaire">{description}</APropos>
        <Stack>
          <ErrorAlert error={synthese.error || erreur} />
          {s && <TuilesVeilleVerre s={s} statut={filtres.statut} onStatut={(statut) => filtrer({ statut })} />}
          <div className="vr-verre">
            <section className="vr-verre__liste" aria-labelledby="vr-verre-liste">
              <div className="vr-verre__liste-tete">
                <h2 id="vr-verre-liste">Publications</h2>
                <RailStatut statut={filtres.statut} onStatut={(statut) => filtrer({ statut })} />
              </div>
              <form onSubmit={chercher} role="search">
                <BarreFiltres label="Veille réglementaire">
                  <Select
                    label="Domaine"
                    placeholder="Tous"
                    data={optionsDomaine}
                    value={filtres.domaine || null}
                    onChange={(v) => filtrer({ domaine: (v as FiltresPublications['domaine']) ?? '' })}
                    clearable
                    comboboxProps={{ withinPortal: true }}
                  />
                  <TextInput
                    label="Rechercher"
                    description="Texte du titre ou du résumé."
                    maxLength={100}
                    value={saisie}
                    onChange={(e) => setSaisie(e.currentTarget.value)}
                  />
                  <Button type="submit" variant="default">
                    Rechercher
                  </Button>
                </BarreFiltres>
              </form>
              <ErrorAlert error={publications.error} />
              {publications.data && (
                <ListeTextesVerre publications={elements} choisie={montree?.id ?? null} onChoisir={setChoisie} />
              )}
              {pagination}
            </section>
            <section className="vr-verre__droite" aria-label="Publication choisie">
              {montree ? (
                <DetailPublicationVerre
                  p={montree}
                  droits={droits.data}
                  enCours={qualification === montree.id}
                  onQualifier={(p, st) => void qualifier(p, st)}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  Choisissez une publication dans la liste pour la lire et la qualifier.
                </Text>
              )}
            </section>
          </div>
          {fonctionnement}
        </Stack>
      </Page>
    );
  }
  return (
    <Page>
      <p className="vu-surtitre" aria-hidden="true">
        Veille réglementaire · Sécurité et données personnelles
      </p>
      <PageHeader title="Veille réglementaire" description={description} actions={collecteBouton} />
      <Stack>
        <ErrorAlert error={synthese.error || erreur} />
        {synthese.data && <SyntheseReglementaire s={synthese.data} />}
        <Title order={2} size="h4">
          Publications
        </Title>
        <form onSubmit={chercher} role="search">
          <BarreFiltres label="Veille réglementaire">
            <Select
              label="Statut"
              placeholder="Tous"
              data={optionsStatut}
              value={filtres.statut || null}
              onChange={(v) => filtrer({ statut: (v as FiltresPublications['statut']) ?? '' })}
              clearable
              comboboxProps={{ withinPortal: true }}
            />
            <Select
              label="Domaine"
              placeholder="Tous"
              data={optionsDomaine}
              value={filtres.domaine || null}
              onChange={(v) => filtrer({ domaine: (v as FiltresPublications['domaine']) ?? '' })}
              clearable
              comboboxProps={{ withinPortal: true }}
            />
            <Select
              label="Source"
              placeholder="Toutes"
              data={optionsSource}
              value={filtres.source || null}
              onChange={(v) => filtrer({ source: (v as FiltresPublications['source']) ?? '' })}
              clearable
              comboboxProps={{ withinPortal: true }}
            />
            <TextInput
              label="Rechercher"
              description="Texte du titre ou du résumé."
              maxLength={100}
              value={saisie}
              onChange={(e) => setSaisie(e.currentTarget.value)}
            />
            <Button type="submit" variant="default">
              Rechercher
            </Button>
          </BarreFiltres>
        </form>
        <ErrorAlert error={publications.error} />
        {publications.data && (
          <ListePublications
            publications={publications.data.elements}
            droits={droits.data}
            enCours={qualification}
            onQualifier={(p, s) => void qualifier(p, s)}
          />
        )}
        {pagination}
        {fonctionnement}
      </Stack>
    </Page>
  );
}

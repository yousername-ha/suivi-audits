/* Module Vulnérabilités (ADR 0100, lot VEILLE-PLATEFORME) : configuration de la veille, carte « Veille des vulnérabilités »
   de la page Plateforme (décision du RSSI du 23/11/2026 : « comme pour les intégrations »). Tout ce qui se réglait dans
   l'écran « Veille » du module vient ici, sans changement de route ni de droit :
   - activation de la veille (son flux vers l'extérieur, validation explicite d'un administrateur), destinations et ce qui
     sort, « Collecter maintenant » (droit d'administrer le module) ;
   - sources et leurs fréquences (lot F1 : liste déroulante, avertissement de NVD et d'EPSS, prochaine collecte) ;
   - dictionnaire des produits (CPE) : activation, état du chargement, copie complète et sa suppression (lot CPE-1) ;
   - sources facultatives (Cloudflare Radar, tldrcve) : activation et fréquence (lot CVE-INC).
   L'écran « Veille » ne garde que le contenu et une ligne d'état par source, avec un lien « Configurer » vers cette carte.
   Les boutons suivent les droits de la session pour l'affichage seulement : le serveur reste seul juge (If-Match, journal
   d'audit inchangés). Composants de la charte, sous la CSP stricte (ADR 0006). */
import { Alert, Badge, Button, Group, Stack, Switch, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  avertissementAnnonces,
  avertissementVeille,
  type EtatDictionnaireCpeDto,
  type EtatSourceAnnonceDto,
  type EtatSourceVeilleDto,
  type EtatVeilleDto,
  fluxExterne,
  FREQUENCES_VEILLE,
  frequenceVeilleModifiable,
  libelleFrequence,
  libelleFrequenceMinutes,
  PRECISION_MANDATAIRE,
  type ReglageDictionnaireCpe,
  type SourceAnnonce,
  type SourceVeille,
} from '@suivi/shared';
import { ConfirmButton, DataTable, ErrorAlert, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, get } from '../api';
import { ChampFrequence } from '../components/ChampFrequence';
import { fmtDate } from '../components/common';
import { CLE_FLUX_EXTERNES } from '../components/FluxExternes';
import { Destinations, useValidationFlux } from '../components/ValidationFlux';
import { useCan } from '../session';
import { CLE_ANNONCES_SOURCES, useSourcesAnnonces } from './AnnoncesVeille';
import { DictionnaireCpeSection } from './DictionnaireCpe';
import { URL_COPIE_CPE, URL_DICTIONNAIRE_CPE } from './dictionnaire-cpe';
import { PictoSource } from './PictoSource';
import { pictoVeille } from './pictos-sources';
import { urlSourceAnnonce } from './cve-inconnue';
import { etatSource, libelleLangue, messageCollectesDemandees } from './veille';

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

/** Sources de la veille et leurs fréquences (sans état React) : rendu testable hors navigateur. */
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

/** Sources facultatives (lot CVE-INC) : activation et fréquence pour qui administre le module, texte sinon ; avertissement
    des fréquences élevées, comme pour un connecteur sous 24 heures. Sans état React. */
export function SourcesFacultatives({
  sources,
  fluxOuvert,
  peutRegler,
  enCours,
  onReglage,
}: {
  sources: EtatSourceAnnonceDto[];
  fluxOuvert: boolean;
  peutRegler: boolean;
  enCours: SourceAnnonce | null;
  onReglage: (s: EtatSourceAnnonceDto, r: { activee?: boolean; frequenceMinutes?: number }) => void;
}) {
  return (
    <Table striped withTableBorder aria-label="Sources facultatives de la veille">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Source</Table.Th>
          <Table.Th>Activée</Table.Th>
          <Table.Th>Fréquence</Table.Th>
          <Table.Th>Dernière collecte réussie</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {sources.map((s) => {
          const avertissement = avertissementAnnonces(s.source, s.frequenceMinutes);
          return (
            <Table.Tr key={s.source}>
              <Table.Td>
                <Text size="sm" fw={600}>
                  {s.libelle}
                </Text>
                <Text size="xs" c="dimmed">
                  {s.organisme} · <span className="veille-code">{s.hote}</span>
                </Text>
                {s.erreur && (
                  <Text size="xs" c="red">
                    Erreur : {s.erreur}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {peutRegler ? (
                  <Switch
                    aria-label={`Activer la source ${s.libelle}`}
                    checked={s.activee}
                    disabled={enCours === s.source}
                    onChange={(e) => onReglage(s, { activee: e.currentTarget.checked })}
                  />
                ) : (
                  <Text size="sm">{s.activee ? 'Oui' : 'Non (désactivée)'}</Text>
                )}
              </Table.Td>
              <Table.Td>
                <Stack gap="2xs">
                  {peutRegler ? (
                    <ChampFrequence
                      size="xs"
                      ariaLabel={`Fréquence de la source ${s.libelle}`}
                      frequences={s.frequences}
                      valeur={s.frequenceMinutes}
                      libelle={libelleFrequenceMinutes}
                      disabled={enCours === s.source}
                      avertissement={avertissement}
                      onChange={(m) => onReglage(s, { frequenceMinutes: m })}
                    />
                  ) : (
                    <Text size="sm">{libelleFrequenceMinutes(s.frequenceMinutes)}</Text>
                  )}
                  <Text size="xs" c="dimmed">
                    Prochaine collecte :{' '}
                    {s.prochaineCollecte ? (
                      <span className="horodatage">{fmtDate(s.prochaineCollecte)}</span>
                    ) : !fluxOuvert ? (
                      'aucune (veille inactive)'
                    ) : (
                      'aucune (source désactivée)'
                    )}
                  </Text>
                </Stack>
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
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

/** Panneau de la carte « Veille des vulnérabilités » de la page Plateforme. */
export function ConfigurationVeillePanel() {
  const can = useCan();
  const qc = useQueryClient();
  const lire = can('vulnerabilites', 'lire');
  const administrer = can('vulnerabilites', 'administrer');
  const admin = can('administration', 'administrer');
  const flux = useValidationFlux();
  const [envoi, setEnvoi] = useState(false);
  const [collecte, setCollecte] = useState(false);
  const [frequenceEnCours, setFrequenceEnCours] = useState<SourceVeille | null>(null);
  const [envoiCpe, setEnvoiCpe] = useState(false);
  const [annonceEnCours, setAnnonceEnCours] = useState<SourceAnnonce | null>(null);
  const [erreur, setErreur] = useState<unknown>(null);
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
      notifications.show({ color: 'teal', message: messageCollectesDemandees(r.length) });
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
      notifications.show({ color: 'teal', message: `${src.libelle} : ${libelleFrequence(heures).toLowerCase()}.` });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      await qc.invalidateQueries({ queryKey: [...CLE, 'etat'] });
      setFrequenceEnCours(null);
    }
  };
  // Lot CPE-1 : réglage, copie complète et sa suppression, If-Match sur la version de la source.
  const actionCpe = async (methode: 'PATCH' | 'POST' | 'DELETE', url: string, body?: ReglageDictionnaireCpe) => {
    if (!dictionnaire.data) return;
    setEnvoiCpe(true);
    try {
      await api(methode, url, { body, ifMatch: dictionnaire.data.version });
      notifications.show({ color: 'teal', message: 'Dictionnaire des produits (CPE) : réglage enregistré.' });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      await qc.invalidateQueries({ queryKey: [...CLE, 'dictionnaire-cpe'] });
      setEnvoiCpe(false);
    }
  };
  // Lot CVE-INC : activation et fréquence d'une source facultative, If-Match sur sa version.
  const reglerAnnonce = async (s: EtatSourceAnnonceDto, r: { activee?: boolean; frequenceMinutes?: number }) => {
    setAnnonceEnCours(s.source);
    try {
      await api('PATCH', urlSourceAnnonce(s.source), { body: r, ifMatch: s.version });
      notifications.show({ color: 'teal', message: `${s.libelle} : réglage enregistré.` });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      await qc.invalidateQueries({ queryKey: CLE_ANNONCES_SOURCES });
      setAnnonceEnCours(null);
    }
  };

  if (!lire) return <Alert>Vous ne disposez pas du droit de lire les vulnérabilités.</Alert>;
  return (
    <Stack gap="lg">
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
          <Group justify="space-between">
            <Title order={2} size="h4">
              Sources et fréquences
            </Title>
            {administrer && etat.data.flux.ouvert && (
              <Button loading={collecte} onClick={() => void collecter()}>
                Collecter maintenant
              </Button>
            )}
          </Group>
          <SourcesTable
            sources={etat.data.sources}
            fluxOuvert={etat.data.flux.ouvert}
            peutRegler={administrer}
            enCours={frequenceEnCours}
            onFrequence={(src, h) => void reglerFrequence(src, h)}
          />
        </>
      )}
      <ErrorAlert error={dictionnaire.error} />
      {dictionnaire.data && (
        <DictionnaireCpeSection
          etat={dictionnaire.data}
          peutRegler={administrer}
          envoi={envoiCpe}
          onReglage={(r) => void actionCpe('PATCH', URL_DICTIONNAIRE_CPE, r)}
          onCopier={() => void actionCpe('POST', URL_COPIE_CPE)}
          onSupprimerCopie={() => void actionCpe('DELETE', URL_COPIE_CPE)}
        />
      )}
      <Stack gap="xs">
        <Title order={2} size="h4">
          Sources facultatives
        </Title>
        <Text size="sm" c="dimmed">
          Désactivées au départ. Les préavis de Cloudflare Radar annoncent des CVE avant leur publication par NVD ou un
          CERT : seules les CVE critiques et celles qui citent un produit surveillé sont gardées, sans notification ni
          alerte. Les résumés de tldrcve sont présentés tels que le flux les publie, à côté des faits de la plateforme,
          sans effet sur la priorité.
        </Text>
        <ErrorAlert error={annonces.error} />
        {annonces.data && (
          <SourcesFacultatives
            sources={annonces.data}
            fluxOuvert={!!etat.data?.flux.ouvert}
            peutRegler={administrer}
            enCours={annonceEnCours}
            onReglage={(s, r) => void reglerAnnonce(s, r)}
          />
        )}
      </Stack>
    </Stack>
  );
}

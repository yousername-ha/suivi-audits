/* Module Vulnérabilités (ADR 0100, lot ALH1) : écran « Surface externe ». Alertes, actifs (hôtes et domaines) et
   technologies lus dans AlgoLightHouse (éditeur AlgoSecure), visibles à travers les droits du périmètre de la plateforme
   relié à chaque périmètre de l'éditeur ; un périmètre non relié n'est visible qu'avec le droit d'administrer le module.
   Onglet « Périmètres » (administration du module) : relier chaque périmètre de l'éditeur à un périmètre de la plateforme.
   Lecture seule : rien n'est jamais écrit chez l'éditeur ; ses textes s'affichent tels quels. Composants de la charte, CSP
   stricte (ADR 0006) ; le serveur est seul juge des droits, les onglets ne font que suivre la session.
   Lot ALH2 : priorité calculée par la plateforme (alertes, technologies et leurs CVE), tri par priorité, fiche d'une alerte
   avec les défauts et résolutions recommandés par l'éditeur, rendus comme texte (jamais comme HTML), produits surveillés
   rapprochés d'une technologie.
   Lot ALH3 : colonne « Machine interne » des actifs (reliée, proposée, à relier) et filtre ; fiche d'un actif pour confirmer
   ou rejeter une proposition de la plateforme, relier à la main une machine (sélecteur avec recherche) et délier. Le
   serveur ne rend que les machines que la personne peut lire et reste seul juge des droits d'écriture.
   Lot ALH4 : onglet « Carte » (lignes d'approche), affiché en premier ; les autres onglets en sont l'équivalent en
   tableau.
   Lot ALH5 : priorités les mêmes pour tout le monde (une technologie peut tenir sa priorité de versions que la personne ne
   voit pas : dit sans nom) ; « Relier en masse » dans l'onglet « Actifs » (droit de modifier) : motifs à joker, aperçu
   obligatoire, puis liaison des seules paires de l'aperçu.
   Lot ALH6 : services exposés (port/protocole · service, produit et version) dans l'onglet « Actifs », la fiche d'un actif
   et la fiche d'une alerte ; seuls les services portés par une alerte sont connus (l'éditeur ne publie pas la liste des
   ports ouverts).
   Lot SI1 : Silène (ANSSI) comme seconde source de la surface externe (SurfaceSilene.tsx) : note Silène en tête à côté de
   l'état d'AlgoLightHouse, chacun avec sa pastille ; liste « Actifs » commune (un actif par adresse IP ou nom de domaine,
   ports ouverts de Silène et services d'AlgoLightHouse réunis, la source de chaque information visible) ; onglet
   « Constats Silène » ; liaison de chaque instance Silène à un périmètre dans l'onglet « Périmètres ». La carte n'est pas
   changée dans ce lot. */
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Group,
  List,
  Modal,
  Pagination,
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
  serviceEnFinDeSupport,
  type ActifAlhDto,
  type ActifCarteDto,
  type FicheConstatSileneDto,
  libelleClasseSilene,
  type ActifSurfaceDto,
  type NoteSileneDto,
  type AlerteAlhDto,
  type ApercuLiaisonMasseDto,
  type ModeLiaisonMasse,
  type ResultatLiaisonMasseDto,
  type CarteSurfaceDto,
  CRITICITES_ALH,
  LIAISONS_MASSE_MAX,
  type EtatSurfaceExterneDto,
  type FicheAlerteAlhDto,
  type FicheLiaisonsActifDto,
  type FiltreLiaisonActif,
  type LiaisonMachineDto,
  libelleProduitService,
  libelleService,
  type MachineDto,
  type PageMachines,
  type PageSurface,
  type PerimetreAffectableDto,
  type PerimetreAlhDto,
  type ServiceAlhDto,
  type ServiceExposeDto,
  STATUT_VERSION_ALH_LIBELLES,
  STATUTS_ALERTE_ALH,
  type TechnologieAlhDto,
  TYPES_ACTIF_ALH,
  TYPES_ALERTE_ALH,
  type TypeActifAlh,
} from '@suivi/shared';
import { DataTable, ErrorAlert, Page, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { type OngletSurface, ouvertureSurface } from './recherche';
import { EnteteVulnerabilites } from './EnteteVulnerabilites';
import { CLE_PERIMETRES_AFFECTABLES } from './perimetres';
import { api, errorMessage, get } from '../api';
import { fmtDate } from '../components/common';
import { EtatIntegration } from '../integrations/EtatIntegration';
import { peutConfigurerIntegration } from '../integrations/etat-integration';
import { useCan } from '../session';
import { CarteSurface, VUE_CARTE_INITIALE, type VueCarte } from './CarteSurface';
import { constatsDeLaCarte } from './carte-surface';
import { PictoSource } from './PictoSource';
import {
  FicheActifSileneLue,
  FicheConstatSilene,
  NoteSilene,
  OngletConstatsSilene,
  PerimetresSilene,
  PortsActif,
  SILENE_SEUL,
  SourcesActif,
} from './SurfaceSilene';
import { URL_NOTES_SILENE, urlFicheConstatSilene } from './surface-silene';
import { ETAT_PRIORITE, FILTRES_MACHINES_VIDES, libelleMachine, urlMachines } from './failles';
import { FicheMachine } from './Machines';
import { MentionFinSupport } from './ParcMachines';
import { PrioriteFaits } from './FaillesDetectees';
import { FicheFaille } from './FicheFaille';
import { MarquesSources } from './SourcesFaille';
import {
  alerteOuverte,
  CRITICITE_ALH_ETAT,
  demandeMasse,
  OPTIONS_MODE_MASSE,
  prioriteHorsDetail,
  resumeApercuMasse,
  resumeResultatMasse,
  SAISIE_MASSE_VIDE,
  type SaisieMasse,
  URL_APERCU_MASSE,
  URL_LIAISON_MASSE,
  FILTRES_ALERTES_VIDES,
  type FiltresAlertesAlh,
  libelleCible,
  libelleCriticite,
  libelleLiaison,
  libellePerimetre,
  libelleProduitRapproche,
  libelleStatutActif,
  libelleStatutAlerte,
  libelleTypeActif,
  libelleTypeAlerte,
  pourcentage,
  OPTIONS_LIAISON_ACTIF,
  detailEtatAlh,
  resumeEtatAlh,
  resumeMachineInterne,
  urlActifsAlh,
  urlDecisionLiaison,
  urlDeliaison,
  urlLiaisonsActif,
  OPTIONS_TRI_ALERTES,
  OPTIONS_TRI_TECHNOLOGIES,
  triDepuis,
  urlAlertesAlh,
  URL_CARTE_SURFACE,
  urlFicheAlerteAlh,
  urlTechnologiesAlh,
} from './surface';
import { nombrePages } from './veille';

const CLE = ['vulnerabilites', 'surface'] as const;
const OPTIONS_TYPE = TYPES_ALERTE_ALH.map((t) => ({ value: t, label: libelleTypeAlerte(t) }));
const OPTIONS_CRITICITE = CRITICITES_ALH.map((c) => ({ value: c, label: libelleCriticite(c) }));
const OPTIONS_STATUT = [
  { value: 'toutes', label: 'Tous les statuts' },
  ...STATUTS_ALERTE_ALH.map((s) => ({ value: s, label: libelleStatutAlerte(s) })),
];
const OPTIONS_ACTIF = TYPES_ACTIF_ALH.map((t) => ({ value: t, label: libelleTypeActif(t) }));

/** État en lecture seule de chaque instance AlgoLightHouse (sans état) : état, dernière synchronisation, erreur éventuelle,
    bilan et périmètres non reliés, puis « Configurer l'intégration » pour qui lit la carte de la Plateforme (ADR 0076,
    addendum du 19/11/2026). */
export function EtatSurface({
  etats,
  peutConfigurer = false,
}: {
  etats: EtatSurfaceExterneDto[];
  peutConfigurer?: boolean;
}) {
  return (
    <EtatIntegration
      type="AlgoLightHouse"
      connecteurs={etats}
      peutConfigurer={peutConfigurer}
      qualifier={resumeEtatAlh}
      detail={detailEtatAlh}
    />
  );
}

/** Priorité d'une alerte ou d'une technologie : faits, ou « sans CVE » (sans état). */
function PrioriteOuSansCve({ p }: { p: AlerteAlhDto['priorite'] }) {
  return p ? (
    <PrioriteFaits p={p} />
  ) : (
    <Text size="sm" c="dimmed">
      Sans CVE
    </Text>
  );
}

/** Alertes (sans état) ; `onOuvrir` ouvre la fiche d'une alerte. */
export function AlertesAlhTable({
  alertes,
  onOuvrir = () => undefined,
}: {
  alertes: AlerteAlhDto[];
  onOuvrir?: (id: string) => void;
}) {
  return (
    <DataTable label="Alertes AlgoLightHouse">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Priorité</Table.Th>
            <Table.Th>Criticité</Table.Th>
            <Table.Th>Alerte</Table.Th>
            <Table.Th>Cible</Table.Th>
            <Table.Th>CVE</Table.Th>
            <Table.Th>Statut chez l’éditeur</Table.Th>
            <Table.Th>Périmètre</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {alertes.map((a) => (
            <Table.Tr key={a.id}>
              <Table.Td>
                <PrioriteOuSansCve p={a.priorite} />
              </Table.Td>
              <Table.Td>
                {a.criticite ? (
                  <StatusChip etat={CRITICITE_ALH_ETAT[a.criticite]}>{libelleCriticite(a.criticite)}</StatusChip>
                ) : (
                  <Text size="sm" c="dimmed">
                    {libelleCriticite(null)}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Anchor component="button" type="button" onClick={() => onOuvrir(a.id)} className="veille-texte">
                  {a.titre}
                </Anchor>
                <Text size="xs" c="dimmed">
                  {libelleTypeAlerte(a.type)}
                  {a.verifiee ? ' · vérifiée par un analyste de l’éditeur' : ''}
                  {a.nombreDefauts
                    ? ` · ${a.nombreDefauts} recommandation${a.nombreDefauts > 1 ? 's' : ''} de l’éditeur`
                    : ''}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" className="veille-code">
                  {libelleCible(a)}
                </Text>
              </Table.Td>
              <Table.Td>
                {a.cves.length ? (
                  <Text size="sm" className="veille-code">
                    {a.cves.slice(0, 5).join(', ')}
                    {a.cves.length > 5 ? ` et ${a.cves.length - 5} autres` : ''}
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    —
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <StatusChip etat={alerteOuverte(a.statut) ? 'attention' : 'neutre'}>
                  {libelleStatutAlerte(a.statut)}
                </StatusChip>
                {(a.majLe ?? a.creeLe) && (
                  <Text size="xs" c="dimmed" className="horodatage">
                    {fmtDate((a.majLe ?? a.creeLe)!)}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{libellePerimetre(a)}</Table.Td>
            </Table.Tr>
          ))}
          {alertes.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text size="sm" c="dimmed">
                  Aucune alerte ne correspond, parmi celles que vous pouvez lire.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Limite de la connaissance des services, dite partout où ils s'affichent (lot ALH6). */
export const LIMITE_SERVICES =
  'Seuls les services portés par une alerte sont connus : AlgoLightHouse ne publie pas la liste des ports ouverts.';
/** Lot SI1 : ce que Silène ajoute. */
export const PORTS_SILENE =
  'Silène publie les ports ouverts de chaque hôte (pastille SIL) : ils sont réunis ici avec les services d’AlgoLightHouse (pastille ALH), sans doublon de port et de protocole.';

/** Services exposés (sans état, lot ALH6) : port/protocole · service, produit et version, éditeur et CPE ; avec les
    alertes ouvertes lisibles qui les portent quand elles sont données. */
export function ServicesTable({ services, titre }: { services: (ServiceAlhDto | ServiceExposeDto)[]; titre: string }) {
  const avecAlertes = services.some((s) => 'alertes' in s);
  return (
    <DataTable label={titre}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Service (port/protocole · service)</Table.Th>
            <Table.Th>Produit et version</Table.Th>
            {avecAlertes && <Table.Th>Alertes ouvertes qui le portent</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {services.map((s) => (
            <Table.Tr key={`${s.port}/${s.protocole ?? ''}`}>
              <Table.Td>
                <Text size="sm" className="veille-code">
                  {libelleService(s)}
                </Text>
                {!s.protocole && (
                  <Text size="xs" c="dimmed">
                    protocole non communiqué
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm" className="veille-texte">
                  {libelleProduitService(s) ?? '—'}
                </Text>
                {(s.editeur || s.statutVersion) && (
                  <Text size="xs" c="dimmed" className="veille-texte">
                    {[
                      s.editeur ? `éditeur : ${s.editeur}` : null,
                      s.statutVersion ? STATUT_VERSION_ALH_LIBELLES[s.statutVersion] : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                )}
                {s.cpe && (
                  <Text size="xs" c="dimmed" className="veille-code">
                    {s.cpe}
                  </Text>
                )}
                {serviceEnFinDeSupport(s.statutVersion) && <MentionFinSupport court />}
              </Table.Td>
              {avecAlertes && (
                <Table.Td>
                  <Text size="sm" className="veille-texte">
                    {'alertes' in s && s.alertes.length
                      ? s.alertes.map((a) => a.titre).join(' ; ')
                      : 'Aucune que vous pouvez lire'}
                  </Text>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Fiche d'une alerte (sans état) : CVE avec leur priorité et leurs sources, services portés. Lot PC4 : les défauts et
    résolutions recommandés par l'éditeur, le vecteur traduit et le schéma sont dans la fiche illustrée commune
    (FicheFaille), placée au-dessus ; les textes de l'éditeur y sont rendus comme texte (aucun HTML interprété). */
export function FicheAlerteAlh({ a }: { a: FicheAlerteAlhDto }) {
  return (
    <Stack>
      <Group gap="xs">
        {a.criticite && <StatusChip etat={CRITICITE_ALH_ETAT[a.criticite]}>{libelleCriticite(a.criticite)}</StatusChip>}
        <StatusChip etat={alerteOuverte(a.statut) ? 'attention' : 'neutre'}>{libelleStatutAlerte(a.statut)}</StatusChip>
        <Text size="sm">{libelleTypeAlerte(a.type)}</Text>
      </Group>
      <Text size="sm">
        Cible : <span className="veille-code">{libelleCible(a)}</span> · Périmètre : {libellePerimetre(a)}
      </Text>
      <Title order={3} size="h6">
        Services portés par l’alerte
      </Title>
      {a.services.length ? (
        <ServicesTable services={a.services} titre="Services portés par l’alerte" />
      ) : (
        <Text size="sm" c="dimmed">
          {a.detail
            ? 'Port non communiqué : le détail de l’alerte ne donne aucun service (ou son actif n’est pas lisible).'
            : 'Détail pas encore lu : les services viendront à une prochaine synchronisation.'}
        </Text>
      )}
      <Title order={3} size="h6">
        Priorité calculée par la plateforme
      </Title>
      {a.cvesDetail.length ? (
        <DataTable label="CVE de l’alerte">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>CVE</Table.Th>
                <Table.Th>Priorité</Table.Th>
                <Table.Th>Sources</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {a.cvesDetail.map((c) => (
                <Table.Tr key={c.cve}>
                  <Table.Td className="veille-code">{c.cve}</Table.Td>
                  <Table.Td>
                    <PrioriteFaits p={c.priorite} />
                  </Table.Td>
                  <Table.Td>
                    <MarquesSources s={c.sources} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
      ) : (
        <Text size="sm" c="dimmed">
          Aucune CVE citée par l’éditeur : l’alerte n’a pas de priorité calculée ; sa criticité est celle de l’éditeur.
        </Text>
      )}
      {!a.detail && (
        <Text size="sm" c="dimmed">
          Détail pas encore lu : les recommandations de l’éditeur viendront à une prochaine synchronisation.
        </Text>
      )}
    </Stack>
  );
}

/** Actif de la liste : d'AlgoLightHouse, et (lot SI1) ce que Silène en dit, avec ses sources. */
type ActifListe = ActifAlhDto & Partial<Pick<ActifSurfaceDto, 'sources' | 'silene' | 'alhId'>>;

/** Hôtes et domaines (sans état) ; `onOuvrir` ouvre la fiche d'un actif (machines internes, et ce qu'en dit Silène). */
export function ActifsAlhTable<A extends ActifListe>({ actifs, onOuvrir }: { actifs: A[]; onOuvrir?: (x: A) => void }) {
  return (
    <DataTable label="Actifs exposés">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Actif</Table.Th>
            <Table.Th>Surveillance</Table.Th>
            <Table.Th>Réseau</Table.Th>
            <Table.Th>Alertes ouvertes</Table.Th>
            <Table.Th>Services connus</Table.Th>
            <Table.Th>Technologies</Table.Th>
            <Table.Th>Machine interne</Table.Th>
            <Table.Th>Périmètre</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {actifs.map((x) => {
            const mi = resumeMachineInterne(x.machinesInternes);
            // Lot SI1 : actif vu par Silène seul (aucun champ d'AlgoLightHouse, aucune liaison possible).
            const sileneSeul = !!x.sources && !x.sources.includes('alh');
            return (
              <Table.Tr key={x.id}>
                <Table.Td>
                  {onOuvrir ? (
                    <Anchor component="button" type="button" onClick={() => onOuvrir(x)} className="veille-code">
                      {x.valeur}
                    </Anchor>
                  ) : (
                    <Text size="sm" className="veille-code">
                      {x.valeur}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {libelleTypeActif(x.type)}
                    {x.adresse ? ` · résout vers ${x.adresse}` : ''}
                  </Text>
                  {x.sources && <SourcesActif sources={x.sources} />}
                </Table.Td>
                <Table.Td>{sileneSeul ? '—' : libelleStatutActif(x.statut)}</Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {[x.fai, x.asn ? `AS${x.asn}` : null, x.pays].filter(Boolean).join(' · ') || '—'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {[
                      x.cdn ? 'CDN' : null,
                      x.mutualise ? 'serveur mutualisé' : null,
                      x.joignable === false ? 'ne répond plus' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {x.alertesOuvertes ? (
                    <StatusChip etat="attention">{x.alertesOuvertes}</StatusChip>
                  ) : (
                    <Text size="sm">0</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {x.silene ? (
                    <PortsActif actif={x as ActifSurfaceDto} />
                  ) : x.services.length ? (
                    <>
                      {x.services.slice(0, 3).map((sv) => (
                        <div key={`${sv.port}/${sv.protocole ?? ''}`}>
                          <Text size="sm" className="veille-code">
                            {libelleService(sv)}
                          </Text>
                          {libelleProduitService(sv) && (
                            <Text size="xs" c="dimmed" className="veille-texte">
                              {libelleProduitService(sv)}
                            </Text>
                          )}
                          {serviceEnFinDeSupport(sv.statutVersion) && <MentionFinSupport court />}
                        </div>
                      ))}
                      {x.nombreServices > 3 && (
                        <Text size="xs" c="dimmed">
                          et {x.nombreServices - 3} autre{x.nombreServices - 3 > 1 ? 's' : ''}
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text size="sm" c="dimmed">
                      {x.alertesOuvertes ? 'port non communiqué' : '—'}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{x.technologies}</Table.Td>
                <Table.Td>
                  {sileneSeul ? (
                    <Text size="sm" c="dimmed">
                      {SILENE_SEUL}
                    </Text>
                  ) : (
                    <>
                      <StatusChip etat={mi.etat}>{mi.libelle}</StatusChip>
                      {mi.detail && (
                        <Text size="xs" c="dimmed">
                          {mi.detail}
                        </Text>
                      )}
                    </>
                  )}
                </Table.Td>
                <Table.Td>{libellePerimetre(x)}</Table.Td>
              </Table.Tr>
            );
          })}
          {actifs.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={8}>
                <Text size="sm" c="dimmed">
                  Aucun actif ne correspond, parmi ceux que vous pouvez lire.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Liaisons d'un même statut (sans état) ; `actions` rend les boutons d'une ligne. */
function TableLiaisons({
  titre,
  liaisons,
  actions,
}: {
  titre: string;
  liaisons: LiaisonMachineDto[];
  actions?: (l: LiaisonMachineDto) => ReactNode;
}) {
  return (
    <DataTable label={titre}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Machine</Table.Th>
            <Table.Th>Périmètre de la machine</Table.Th>
            <Table.Th>Liaison</Table.Th>
            {actions && <Table.Th>Décision</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {liaisons.map((l) => (
            <Table.Tr key={l.id}>
              <Table.Td>
                <Text size="sm" className="veille-texte">
                  {libelleMachine(l.machine)}
                </Text>
                {l.machine.nom && l.machine.adresse && (
                  <Text size="xs" c="dimmed" className="veille-code">
                    {l.machine.adresse}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{l.machine.perimetreNom ?? 'Sans périmètre'}</Table.Td>
              <Table.Td>
                <Text size="sm">{libelleLiaison(l)}</Text>
                {l.decideLe && (
                  <Text size="xs" c="dimmed" className="horodatage">
                    {fmtDate(l.decideLe)}
                  </Text>
                )}
                {l.note && (
                  <Text size="xs" c="dimmed" className="veille-texte">
                    Note : {l.note}
                  </Text>
                )}
              </Table.Td>
              {actions && (
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    {actions(l)}
                  </Group>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Fiche des machines internes d'un actif (sans état) : reliées (délier), propositions (confirmer, rejeter), rejetées. Les
    boutons ne paraissent qu'avec le droit de modifier le module ; le serveur juge l'écriture sur les deux périmètres. */
export function FicheLiaisonsActif({
  fiche,
  peutModifier,
  enCours,
  onDecider,
  onDelier,
}: {
  fiche: FicheLiaisonsActifDto;
  peutModifier: boolean;
  enCours: boolean;
  onDecider: (l: LiaisonMachineDto, decision: 'confirmer' | 'rejeter') => void;
  onDelier: (l: LiaisonMachineDto) => void;
}) {
  return (
    <Stack>
      <Title order={3} size="h6">
        Machines internes reliées
      </Title>
      {fiche.reliees.length ? (
        <TableLiaisons
          titre="Machines internes reliées"
          liaisons={fiche.reliees}
          actions={
            peutModifier
              ? (l) => (
                  <Button
                    size="compact-sm"
                    variant="light"
                    color="red"
                    disabled={enCours}
                    onClick={() => onDelier(l)}
                    aria-label={`Délier ${libelleMachine(l.machine)}`}
                  >
                    Délier
                  </Button>
                )
              : undefined
          }
        />
      ) : (
        <Text size="sm" c="dimmed">
          Aucune machine interne reliée, parmi celles que vous pouvez lire.
        </Text>
      )}
      {fiche.autresMachines && (
        <Text size="sm" role="status">
          L’actif est aussi relié à une machine que vous ne pouvez pas lire : elle n’est ni nommée ni comptée.
        </Text>
      )}
      <Text size="xs" c="dimmed">
        Un actif peut mener à plusieurs machines (répartiteur de charge), {fiche.max} au plus.
      </Text>
      <Title order={3} size="h6">
        Propositions de la plateforme
      </Title>
      {fiche.propositions.length ? (
        <TableLiaisons
          titre="Propositions de la plateforme"
          liaisons={fiche.propositions}
          actions={
            peutModifier
              ? (l) => (
                  <>
                    <Button
                      size="compact-sm"
                      disabled={enCours}
                      onClick={() => onDecider(l, 'confirmer')}
                      aria-label={`Confirmer ${libelleMachine(l.machine)}`}
                    >
                      Confirmer
                    </Button>
                    <Button
                      size="compact-sm"
                      variant="default"
                      disabled={enCours}
                      onClick={() => onDecider(l, 'rejeter')}
                      aria-label={`Rejeter ${libelleMachine(l.machine)}`}
                    >
                      Rejeter
                    </Button>
                  </>
                )
              : undefined
          }
        />
      ) : (
        <Text size="sm" c="dimmed">
          Aucune proposition à décider. La plateforme propose une machine de même adresse IP, ou dont le nom correspond
          au domaine ; rien n’est relié sans votre confirmation.
        </Text>
      )}
      {fiche.rejetees.length > 0 && (
        <>
          <Title order={3} size="h6">
            Rejetées ou déliées
          </Title>
          <TableLiaisons titre="Liaisons rejetées ou déliées" liaisons={fiche.rejetees} />
        </>
      )}
    </Stack>
  );
}

/** Services exposés d'un actif (sans état, lot ALH6), dans sa fiche. */
export function ServicesActif({ services }: { services: ServiceExposeDto[] }) {
  return (
    <Stack gap="xs">
      <Title order={3} size="h6">
        Services exposés
      </Title>
      {services.length ? (
        <ServicesTable services={services} titre="Services exposés de l’actif" />
      ) : (
        <Text size="sm" c="dimmed">
          Aucun service connu pour cet actif.
        </Text>
      )}
      <Text size="xs" c="dimmed">
        {LIMITE_SERVICES}
      </Text>
    </Stack>
  );
}

/** Actif dont on ouvre la fiche : ligne de la liste ou nœud de la carte. */
type ActifOuvert = Pick<ActifAlhDto, 'id' | 'type' | 'valeur' | 'adresse' | 'perimetreNom' | 'perimetreAlh'>;

/** Fiche d'un actif : liaisons, décisions et liaison à la main (droit de modifier le module). */
function FicheActif({ actif, modifier }: { actif: ActifOuvert; modifier: boolean }) {
  const qc = useQueryClient();
  const [enCours, setEnCours] = useState(false);
  const [terme, setTerme] = useState('');
  const [choix, setChoix] = useState<{ value: string; label: string } | null>(null);
  const [note, setNote] = useState('');
  const fiche = useQuery({
    queryKey: [...CLE, 'liaisons', actif.id],
    queryFn: () => get<FicheLiaisonsActifDto>(urlLiaisonsActif(actif.id)),
  });
  const machines = useQuery({
    queryKey: ['vulnerabilites', 'machines', 'recherche', terme],
    queryFn: () => get<PageMachines>(urlMachines({ ...FILTRES_MACHINES_VIDES, q: terme })),
    enabled: modifier,
  });
  const dejaReliees = new Set((fiche.data?.reliees ?? []).map((l) => l.machine.id));
  const resultats = (machines.data?.elements ?? [])
    .filter((m) => !dejaReliees.has(m.id))
    .map((m) => ({ value: m.id, label: m.nom && m.adresse ? `${m.nom} (${m.adresse})` : libelleMachine(m) }));
  const action = async (fn: (version: number) => Promise<unknown>, message: string) => {
    if (!fiche.data) return;
    setEnCours(true);
    try {
      await fn(fiche.data.versionLiaisons);
      notifications.show({ color: 'teal', message });
      setChoix(null);
      setNote('');
      await qc.invalidateQueries({ queryKey: ['vulnerabilites'] });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
      await qc.invalidateQueries({ queryKey: [...CLE, 'liaisons', actif.id] });
    } finally {
      setEnCours(false);
    }
  };
  return (
    <Stack>
      <Text size="sm">
        {libelleTypeActif(actif.type)} <span className="veille-code">{actif.valeur}</span>
        {actif.adresse ? ` · résout vers ${actif.adresse}` : ''} · Périmètre : {libellePerimetre(actif)}
      </Text>
      <Text size="xs" c="dimmed">
        Reliez l’actif exposé à la ou aux machines internes vers lesquelles va la connexion (machines lues dans
        Tenable). Il faut pouvoir écrire sur le périmètre de l’actif et sur celui de la machine ; chaque décision est
        inscrite au journal d’audit, sans nom de machine ni adresse.
      </Text>
      <ErrorAlert error={fiche.error ?? machines.error} />
      {fiche.data && <ServicesActif services={fiche.data.services} />}
      {fiche.data && (
        <FicheLiaisonsActif
          fiche={fiche.data}
          peutModifier={modifier}
          enCours={enCours}
          onDecider={(l, decision) =>
            void action(
              (v) => api('POST', urlDecisionLiaison(l.id), { body: { decision, note }, ifMatch: v }),
              decision === 'confirmer' ? 'Machine interne reliée.' : 'Proposition rejetée.',
            )
          }
          onDelier={(l) =>
            void action(
              (v) => api('POST', urlDeliaison(l.id), { body: { note }, ifMatch: v }),
              'Machine interne déliée.',
            )
          }
        />
      )}
      {modifier && fiche.data && (
        <Stack gap="xs" role="group" aria-label="Relier à la main">
          <Title order={3} size="h6">
            Relier à la main
          </Title>
          <Group align="flex-end">
            <Select
              label="Machine interne à relier"
              description="Recherche par nom de machine, parmi celles que vous pouvez lire."
              placeholder="Choisir une machine"
              searchable
              clearable
              searchValue={terme}
              onSearchChange={setTerme}
              value={choix?.value ?? null}
              onChange={(_v, option) => setChoix(option ?? null)}
              data={[
                // La machine choisie reste proposée même quand la recherche (son libellé) ne la renvoie plus.
                ...(choix && !resultats.some((o) => o.value === choix.value) ? [choix] : []),
                ...resultats,
              ]}
              nothingFoundMessage="Aucune machine"
              comboboxProps={{ withinPortal: false }}
            />
            <Button
              loading={enCours}
              disabled={!choix}
              onClick={() =>
                void action(
                  (v) =>
                    api('POST', urlLiaisonsActif(actif.id), { body: { machineId: choix?.value, note }, ifMatch: v }),
                  'Machine interne reliée.',
                )
              }
            >
              Relier
            </Button>
          </Group>
          <TextInput
            label="Note de la décision (facultative)"
            description="Gardée avec la liaison, jamais inscrite au journal d’audit."
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
        </Stack>
      )}
    </Stack>
  );
}

/** Technologies, versions détectées sur des actifs lisibles et leurs CVE (sans état). */
export function TechnologiesAlh({ technologies }: { technologies: TechnologieAlhDto[] }) {
  return (
    <DataTable label="Technologies détectées">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Priorité</Table.Th>
            <Table.Th>Technologie</Table.Th>
            <Table.Th>Versions et actifs</Table.Th>
            <Table.Th>CVE selon l’éditeur</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {technologies.map((t) => (
            <Table.Tr key={t.id}>
              <Table.Td>
                <PrioriteOuSansCve p={t.priorite} />
                {prioriteHorsDetail(t) && (
                  <Text size="xs" c="dimmed">
                    Priorité tenue de versions détectées sur des actifs que vous ne pouvez pas lire (ni nommés ni
                    détaillés).
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={600} className="veille-texte">
                  {t.nom}
                </Text>
                <Text size="xs" c="dimmed" className="veille-texte">
                  {[t.editeur, t.produit].filter(Boolean).join(' · ')}
                </Text>
                <Group gap="2xs">
                  {t.exploitees > 0 && <StatusChip etat="erreur">{t.exploitees} exploitée(s)</StatusChip>}
                  {t.preuves > 0 && <Badge variant="outline">{t.preuves} avec preuve de concept</Badge>}
                  {t.tronquee && <Badge variant="outline">Liste tronquée</Badge>}
                </Group>
                {t.produits.map((p) => (
                  <Text key={p.id} size="xs">
                    Produit surveillé : {libelleProduitRapproche(p)}
                  </Text>
                ))}
              </Table.Td>
              <Table.Td>
                <Stack gap="2xs">
                  {t.versions.map((v) => (
                    <Text key={v.version} size="sm">
                      <span className="veille-code">{v.version || 'version inconnue'}</span> :{' '}
                      {v.actifs.map((a) => a.libelle).join(', ')}
                    </Text>
                  ))}
                  {t.actifsInactifs > 0 && (
                    <Text size="xs" c="dimmed">
                      Plus détectée sur {t.actifsInactifs} actif{t.actifsInactifs > 1 ? 's' : ''}.
                    </Text>
                  )}
                </Stack>
              </Table.Td>
              <Table.Td>
                <Stack gap="2xs">
                  {t.versions.flatMap((v) =>
                    v.cves.slice(0, 10).map((c) => (
                      <Text key={`${v.version}-${c.cve}`} size="sm">
                        <StatusChip etat={ETAT_PRIORITE[c.priorite.niveau]}>{c.priorite.niveau}</StatusChip>{' '}
                        <span className="veille-code">{c.cve}</span>
                        {` · CVSS ${c.cvss ?? '—'} · EPSS ${pourcentage(c.epss)}`}
                        {c.exploitee ? ' · exploitée' : ''}
                        {c.preuve ? ' · preuve de concept' : ''}
                      </Text>
                    )),
                  )}
                  {t.nombreCves === 0 && (
                    <Text size="sm" c="dimmed">
                      Aucune CVE connue de l’éditeur.
                    </Text>
                  )}
                </Stack>
              </Table.Td>
            </Table.Tr>
          ))}
          {technologies.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text size="sm" c="dimmed">
                  Aucune technologie ne correspond, parmi celles des actifs que vous pouvez lire.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Périmètres de l'éditeur et leur liaison (sans état) ; `onLier` reçoit le périmètre visé (null : délier). */
export function PerimetresAlhTable({
  perimetres,
  options,
  enCours,
  onLier,
}: {
  perimetres: PerimetreAlhDto[];
  options: PerimetreAffectableDto[];
  enCours: string | null;
  onLier: (p: PerimetreAlhDto, perimetreId: string | null) => void;
}) {
  return (
    <DataTable label="Périmètres AlgoLightHouse">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Périmètre de l’éditeur</Table.Th>
            <Table.Th>Contenu</Table.Th>
            <Table.Th>Périmètre de la plateforme</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {perimetres.map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td>
                <Text size="sm" fw={600} className="veille-texte">
                  {p.nom}
                </Text>
                <Text size="xs" c="dimmed">
                  {p.integration.nom}
                  {p.present ? '' : ' · absent de la dernière synchronisation complète'}
                </Text>
              </Table.Td>
              <Table.Td>
                {p.alertes} alerte{p.alertes > 1 ? 's' : ''} · {p.actifs} actif{p.actifs > 1 ? 's' : ''}
              </Table.Td>
              <Table.Td>
                <Select
                  label={`Périmètre de la plateforme pour ${p.nom}`}
                  placeholder="Non relié"
                  clearable
                  disabled={enCours === p.id}
                  value={p.perimetreId}
                  onChange={(v) => {
                    if ((v ?? null) !== p.perimetreId) onLier(p, v ?? null);
                  }}
                  data={[
                    ...options.map((o) => ({ value: o.id, label: o.nom })),
                    // Un périmètre relié que la personne ne peut plus choisir reste affiché.
                    ...(p.perimetreId && !options.some((o) => o.id === p.perimetreId)
                      ? [{ value: p.perimetreId, label: p.perimetreNom ?? 'Périmètre non accessible' }]
                      : []),
                  ]}
                  comboboxProps={{ withinPortal: false }}
                />
                {!p.perimetreId && (
                  <Text size="xs" c="dimmed">
                    Non relié : visible de l’administration du module seulement.
                  </Text>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
          {perimetres.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={3}>
                <Text size="sm" c="dimmed">
                  Aucun périmètre AlgoLightHouse : ils apparaissent après une synchronisation du connecteur.
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
  nom,
}: {
  donnees: PageSurface<unknown>;
  page: number;
  onPage: (p: number) => void;
  nom: string;
}) {
  const pages = nombrePages(donnees.total, donnees.parPage);
  return (
    <Group justify="space-between">
      <Text size="sm" c="dimmed" role="status">
        {donnees.total} résultat{donnees.total > 1 ? 's' : ''}
      </Text>
      {pages > 1 && <Pagination total={pages} value={page} onChange={onPage} aria-label={`Pages des ${nom}`} />}
    </Group>
  );
}

/** Aperçu d'une liaison en masse (sans état) : résumé, paires proposées, actifs sans correspondance ou écartés. Tout est
    limité à ce que la personne lit. */
export function ApercuMasse({ apercu }: { apercu: ApercuLiaisonMasseDto }) {
  return (
    <Stack gap="xs">
      <Text size="sm" role="status">
        {resumeApercuMasse(apercu)}
      </Text>
      {apercu.paires.length > 0 && (
        <DataTable label="Paires à relier">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Actif exposé</Table.Th>
                <Table.Th>Machine interne</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {apercu.paires.map((p) => (
                <Table.Tr key={`${p.actif.id}-${p.machine.id}`}>
                  <Table.Td className="veille-code">{p.actif.valeur}</Table.Td>
                  <Table.Td className="veille-texte">{libelleMachine(p.machine)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
      {apercu.sansCorrespondance.length > 0 && (
        <Text size="xs" c="dimmed" className="veille-code">
          Sans correspondance : {apercu.sansCorrespondance.map((a) => a.valeur).join(', ')}
          {apercu.nombreSansCorrespondance > apercu.sansCorrespondance.length
            ? ` et ${apercu.nombreSansCorrespondance - apercu.sansCorrespondance.length} autres`
            : ''}
        </Text>
      )}
      {apercu.multiples.length > 0 && (
        <Text size="xs" c="dimmed" className="veille-code">
          Écartés, plusieurs machines correspondent :{' '}
          {apercu.multiples.map((m) => `${m.actif.valeur} (${m.machines})`).join(', ')}
          {apercu.nombreMultiples > apercu.multiples.length
            ? ` et ${apercu.nombreMultiples - apercu.multiples.length} autres`
            : ''}
        </Text>
      )}
    </Stack>
  );
}

/** « Relier en masse » (lot ALH5, droit de modifier) : motifs à joker « * », aperçu obligatoire, puis liaison des seules
    paires de l'aperçu (le serveur revérifie chacune). Toute modification de la saisie efface l'aperçu. */
function RelierEnMasse({ onFini }: { onFini: () => void }) {
  const qc = useQueryClient();
  const [saisie, setSaisie] = useState<SaisieMasse>(SAISIE_MASSE_VIDE);
  const [apercu, setApercu] = useState<ApercuLiaisonMasseDto | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [terme, setTerme] = useState('');
  const [choix, setChoix] = useState<{ value: string; label: string } | null>(null);
  const machines = useQuery({
    queryKey: ['vulnerabilites', 'machines', 'recherche', terme],
    queryFn: () => get<PageMachines>(urlMachines({ ...FILTRES_MACHINES_VIDES, q: terme })),
    enabled: saisie.mode === 'tous_vers_une',
  });
  const resultats = (machines.data?.elements ?? []).map((m) => ({
    value: m.id,
    label: m.nom && m.adresse ? `${m.nom} (${m.adresse})` : libelleMachine(m),
  }));
  const changer = (x: Partial<SaisieMasse>) => {
    setSaisie({ ...saisie, ...x });
    setApercu(null);
    setErreur(null);
  };
  const voir = async () => {
    const d = demandeMasse(saisie);
    if (typeof d === 'string') {
      setErreur(d);
      return;
    }
    setEnCours(true);
    try {
      setApercu(await api<ApercuLiaisonMasseDto>('POST', URL_APERCU_MASSE, { body: d }));
      setErreur(null);
    } catch (e) {
      setApercu(null);
      setErreur(errorMessage(e));
    } finally {
      setEnCours(false);
    }
  };
  const relier = async () => {
    if (!apercu?.paires.length) return;
    setEnCours(true);
    try {
      const r = await api<ResultatLiaisonMasseDto>('POST', URL_LIAISON_MASSE, {
        body: {
          demande: apercu.demande,
          empreinte: apercu.empreinte,
          paires: apercu.paires.map((p) => ({
            actifId: p.actif.id,
            machineId: p.machine.id,
            versionLiaisons: p.versionLiaisons,
          })),
        },
      });
      notifications.show({ color: r.ecartees ? 'orange' : 'teal', message: resumeResultatMasse(r) });
      await qc.invalidateQueries({ queryKey: ['vulnerabilites'] });
      onFini();
    } catch (e) {
      setErreur(errorMessage(e));
    } finally {
      setEnCours(false);
    }
  };
  return (
    <Stack>
      <Text size="xs" c="dimmed">
        Reliez d’un coup les actifs exposés dont le domaine ou l’adresse suit un motif. Seul joker : « * » (zéro ou
        plusieurs caractères), sans distinction de casse. « Un pour un » relie chaque actif à la machine dont la partie
        couverte par le joker est la même (pre-*.exemple.example et srv-pre-* relient pre-web01.exemple.example à
        srv-pre-web01). L’aperçu est obligatoire ; seules ses paires sont reliées, {LIAISONS_MASSE_MAX} au plus, et
        chacune est revérifiée. Une seule entrée au journal d’audit, avec les motifs et les nombres.
      </Text>
      <Select
        label="Mode"
        allowDeselect={false}
        value={saisie.mode}
        onChange={(v) => changer({ mode: (v ?? 'un_pour_un') as ModeLiaisonMasse })}
        data={OPTIONS_MODE_MASSE}
        comboboxProps={{ withinPortal: false }}
      />
      <TextInput
        label="Motif des actifs"
        description="Domaine ou adresse, avec le joker « * »."
        placeholder="pre-*.exemple.example"
        maxLength={253}
        value={saisie.motifActifs}
        onChange={(e) => changer({ motifActifs: e.currentTarget.value })}
      />
      {saisie.mode === 'un_pour_un' ? (
        <TextInput
          label="Motif des machines"
          description="Nom de machine interne, avec autant de jokers « * »."
          placeholder="srv-pre-*"
          maxLength={253}
          value={saisie.motifMachines}
          onChange={(e) => changer({ motifMachines: e.currentTarget.value })}
        />
      ) : (
        <Select
          label="Machine interne"
          description="Recherche par nom de machine, parmi celles que vous pouvez lire."
          placeholder="Choisir une machine"
          searchable
          clearable
          searchValue={terme}
          onSearchChange={setTerme}
          value={choix?.value ?? null}
          onChange={(_v, option) => {
            setChoix(option ?? null);
            changer({ machineId: option?.value ?? null });
          }}
          data={[...(choix && !resultats.some((o) => o.value === choix.value) ? [choix] : []), ...resultats]}
          nothingFoundMessage="Aucune machine"
          comboboxProps={{ withinPortal: false }}
        />
      )}
      {erreur && (
        <Alert color="red" role="alert">
          {erreur}
        </Alert>
      )}
      <ErrorAlert error={machines.error} />
      <Group>
        <Button variant="default" loading={enCours && !apercu} onClick={() => void voir()}>
          Voir l’aperçu
        </Button>
        {apercu && (
          <Button loading={enCours} disabled={!apercu.paires.length} onClick={() => void relier()}>
            {`Relier ${apercu.paires.length} paire${apercu.paires.length > 1 ? 's' : ''}`}
          </Button>
        )}
      </Group>
      {apercu && <ApercuMasse apercu={apercu} />}
    </Stack>
  );
}

function OngletAlertes() {
  const [saisie, setSaisie] = useState('');
  const [filtres, setFiltres] = useState<FiltresAlertesAlh>(FILTRES_ALERTES_VIDES);
  const [page, setPage] = useState(1);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const q = useQuery({
    queryKey: [...CLE, 'alertes', filtres, page],
    queryFn: () => get<PageSurface<AlerteAlhDto>>(urlAlertesAlh(filtres, page)),
  });
  const fiche = useQuery({
    queryKey: [...CLE, 'alerte', ouverte],
    queryFn: () => get<FicheAlerteAlhDto>(urlFicheAlerteAlh(ouverte!)),
    enabled: !!ouverte,
  });
  const changer = (f: Partial<FiltresAlertesAlh>) => {
    setFiltres({ ...filtres, ...f });
    setPage(1);
  };
  const chercher = (e: FormEvent) => {
    e.preventDefault();
    changer({ q: saisie.trim() });
  };
  return (
    <Stack>
      <form onSubmit={chercher} role="search">
        <Group align="flex-end">
          <TextInput
            label="Rechercher une alerte"
            description="Titre, cible (domaine, adresse) ou identifiant CVE."
            maxLength={100}
            value={saisie}
            onChange={(e) => setSaisie(e.currentTarget.value)}
          />
          <Button type="submit" variant="default">
            Rechercher
          </Button>
        </Group>
      </form>
      <Group align="flex-end">
        <Select
          label="Type d’alerte"
          placeholder="Tous"
          clearable
          value={filtres.type || null}
          onChange={(v) => changer({ type: (v ?? '') as FiltresAlertesAlh['type'] })}
          data={OPTIONS_TYPE}
          comboboxProps={{ withinPortal: false }}
        />
        <Select
          label="Criticité"
          placeholder="Toutes"
          clearable
          value={filtres.criticite || null}
          onChange={(v) => changer({ criticite: (v ?? '') as FiltresAlertesAlh['criticite'] })}
          data={OPTIONS_CRITICITE}
          comboboxProps={{ withinPortal: false }}
        />
        <Select
          label="Statut chez l’éditeur"
          placeholder="Ouvertes"
          clearable
          value={filtres.statut || null}
          onChange={(v) => changer({ statut: (v ?? '') as FiltresAlertesAlh['statut'] })}
          data={OPTIONS_STATUT}
          comboboxProps={{ withinPortal: false }}
        />
        <Select
          label="Trier les alertes par"
          allowDeselect={false}
          value={filtres.tri || 'criticite'}
          onChange={(v) => changer({ tri: triDepuis(v) })}
          data={OPTIONS_TRI_ALERTES}
          comboboxProps={{ withinPortal: false }}
        />
      </Group>
      <ErrorAlert error={q.error} />
      {q.data && <AlertesAlhTable alertes={q.data.elements} onOuvrir={setOuverte} />}
      {q.data && <Pages donnees={q.data} page={page} onPage={setPage} nom="alertes" />}
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!ouverte}
        onClose={() => setOuverte(null)}
        title={fiche.data?.titre ?? 'Alerte AlgoLightHouse'}
        size="xl"
        centered
        lockScroll={false}
      >
        <ErrorAlert error={fiche.error} />
        {fiche.data && (
          <Stack>
            <FicheFaille nature="alerte-alh" id={fiche.data.id} />
            <FicheAlerteAlh a={fiche.data} />
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

function OngletActifs() {
  const can = useCan();
  const modifier = can('vulnerabilites', 'modifier');
  const [saisie, setSaisie] = useState('');
  const [recherche, setRecherche] = useState('');
  const [type, setType] = useState<TypeActifAlh | ''>('');
  const [liaison, setLiaison] = useState<FiltreLiaisonActif | ''>('');
  const [page, setPage] = useState(1);
  const [ouvert, setOuvert] = useState<ActifSurfaceDto | null>(null);
  const [masse, setMasse] = useState(false);
  // Lot R1 : la barre de recherche du module ouvre cet onglet filtré (`?onglet=actifs&q=`) et, le cas échéant, la fiche
  // d'un actif de la liste filtrée (`&actif=`), y compris quand l'onglet est déjà affiché.
  const loc = useLocation();
  const [actifVoulu, setActifVoulu] = useState<string | null>(null);
  useEffect(() => {
    const o = ouvertureSurface(new URLSearchParams(loc.search));
    if (o.onglet !== 'actifs') return;
    if (o.q !== null) {
      setSaisie(o.q);
      setRecherche(o.q);
      setType('');
      setLiaison('');
      setPage(1);
    }
    setActifVoulu(o.actif);
  }, [loc.key, loc.search]);
  const q = useQuery({
    queryKey: [...CLE, 'actifs', recherche, type, liaison, page],
    queryFn: () => get<PageSurface<ActifSurfaceDto>>(urlActifsAlh(recherche, type, page, liaison)),
  });
  useEffect(() => {
    if (!actifVoulu || !q.data) return;
    const x = q.data.elements.find((e) => e.id === actifVoulu);
    if (x) setOuvert(x);
    setActifVoulu(null);
  }, [actifVoulu, q.data]);
  return (
    <Stack>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setRecherche(saisie.trim());
          setPage(1);
        }}
      >
        <Group align="flex-end">
          <TextInput
            label="Rechercher un actif"
            description="Adresse IP ou nom de domaine."
            maxLength={100}
            value={saisie}
            onChange={(e) => setSaisie(e.currentTarget.value)}
          />
          <Button type="submit" variant="default">
            Rechercher
          </Button>
          <Select
            label="Type d’actif"
            placeholder="Tous"
            clearable
            value={type || null}
            onChange={(v) => {
              setType((v ?? '') as TypeActifAlh | '');
              setPage(1);
            }}
            data={OPTIONS_ACTIF}
            comboboxProps={{ withinPortal: false }}
          />
          <Select
            label="Machine interne"
            placeholder="Toutes"
            clearable
            value={liaison || null}
            onChange={(v) => {
              setLiaison((v ?? '') as FiltreLiaisonActif | '');
              setPage(1);
            }}
            data={OPTIONS_LIAISON_ACTIF}
            comboboxProps={{ withinPortal: false }}
          />
          {modifier && (
            <Button variant="light" onClick={() => setMasse(true)}>
              Relier en masse
            </Button>
          )}
        </Group>
      </form>
      <ErrorAlert error={q.error} />
      {q.data && <ActifsAlhTable actifs={q.data.elements} onOuvrir={setOuvert} />}
      {q.data && (
        <Text size="xs" c="dimmed">
          Services connus : {LIMITE_SERVICES} {PORTS_SILENE}
        </Text>
      )}
      {q.data && <Pages donnees={q.data} page={page} onPage={setPage} nom="actifs" />}
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!ouvert}
        onClose={() => setOuvert(null)}
        title={
          ouvert
            ? ouvert.alhId
              ? `Machines internes de ${ouvert.valeur}`
              : `Actif exposé : ${ouvert.valeur}`
            : 'Actif exposé'
        }
        size="xl"
        centered
        lockScroll={false}
      >
        {ouvert && (
          <Stack>
            {ouvert.alhId && <FicheActif actif={{ ...ouvert, id: ouvert.alhId }} modifier={modifier} />}
            {ouvert.silene && <FicheActifSileneLue type={ouvert.type} valeur={ouvert.valeur} />}
          </Stack>
        )}
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={masse}
        onClose={() => setMasse(false)}
        title="Relier en masse les actifs exposés aux machines internes"
        size="xl"
        centered
        lockScroll={false}
      >
        {masse && <RelierEnMasse onFini={() => setMasse(false)} />}
      </Modal>
    </Stack>
  );
}

function OngletTechnologies() {
  const [saisie, setSaisie] = useState('');
  const [recherche, setRecherche] = useState('');
  const [exploitee, setExploitee] = useState(false);
  const [tri, setTri] = useState<ReturnType<typeof triDepuis>>('');
  const [page, setPage] = useState(1);
  // Lot R1 : la barre de recherche du module ouvre cet onglet filtré (`?onglet=technologies&q=`).
  const loc = useLocation();
  useEffect(() => {
    const o = ouvertureSurface(new URLSearchParams(loc.search));
    if (o.onglet !== 'technologies' || o.q === null) return;
    setSaisie(o.q);
    setRecherche(o.q);
    setExploitee(false);
    setPage(1);
  }, [loc.key, loc.search]);
  const q = useQuery({
    queryKey: [...CLE, 'technologies', recherche, exploitee, tri, page],
    queryFn: () => get<PageSurface<TechnologieAlhDto>>(urlTechnologiesAlh(recherche, exploitee, page, tri)),
  });
  return (
    <Stack>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setRecherche(saisie.trim());
          setPage(1);
        }}
      >
        <Group align="flex-end">
          <TextInput
            label="Rechercher une technologie"
            description="Nom, éditeur, produit ou identifiant CVE."
            maxLength={100}
            value={saisie}
            onChange={(e) => setSaisie(e.currentTarget.value)}
          />
          <Button type="submit" variant="default">
            Rechercher
          </Button>
          <Checkbox
            label="Avec une CVE exploitée selon l’éditeur"
            checked={exploitee}
            onChange={(e) => {
              setExploitee(e.currentTarget.checked);
              setPage(1);
            }}
          />
          <Select
            label="Trier les technologies par"
            allowDeselect={false}
            value={tri || 'exploitation'}
            onChange={(v) => {
              setTri(triDepuis(v));
              setPage(1);
            }}
            data={OPTIONS_TRI_TECHNOLOGIES}
            comboboxProps={{ withinPortal: false }}
          />
        </Group>
      </form>
      <ErrorAlert error={q.error} />
      {q.data && <TechnologiesAlh technologies={q.data.elements} />}
      {q.data && <Pages donnees={q.data} page={page} onPage={setPage} nom="technologies" />}
    </Stack>
  );
}

/** Onglet « Carte » (lot ALH4) : graphe lu une fois, filtré par les droits côté serveur ; un nœud ouvre la fiche
    existante de l'alerte, de l'actif (et, lot SI2, ce qu'en dit Silène) ou de la machine, ou les constats Silène d'un hôte.
    La vue (regroupement, filtres, replis) est tenue par l'écran : elle survit au changement d'onglet. */
function OngletCarte({ vue, onVue }: { vue: VueCarte; onVue: (v: VueCarte) => void }) {
  const can = useCan();
  const modifier = can('vulnerabilites', 'modifier');
  const [alerte, setAlerte] = useState<string | null>(null);
  const [actif, setActif] = useState<ActifCarteDto | null>(null);
  const [machine, setMachine] = useState<string | null>(null);
  const [constats, setConstats] = useState<{
    hote: ActifCarteDto;
    port: { port: number; protocole: 'tcp' | 'udp' | null } | null;
  } | null>(null);
  const [constat, setConstat] = useState<string | null>(null);
  const carte = useQuery({
    queryKey: [...CLE, 'carte'],
    queryFn: () => get<CarteSurfaceDto>(URL_CARTE_SURFACE),
  });
  const ficheAlerte = useQuery({
    queryKey: [...CLE, 'alerte', alerte],
    queryFn: () => get<FicheAlerteAlhDto>(urlFicheAlerteAlh(alerte!)),
    enabled: !!alerte,
  });
  const ficheMachine = useQuery({
    queryKey: ['vulnerabilites', 'machines', 'fiche', machine],
    queryFn: () => get<MachineDto>(`/api/vulnerabilites/machines/${encodeURIComponent(machine!)}`),
    enabled: !!machine,
  });
  const ficheConstat = useQuery({
    queryKey: [...CLE, 'silene', 'constat', constat],
    queryFn: () => get<FicheConstatSileneDto>(urlFicheConstatSilene(constat!)),
    enabled: !!constat,
  });
  const listeConstats = constats && carte.data ? constatsDeLaCarte(carte.data, constats.hote, constats.port) : [];
  return (
    <Stack>
      <ErrorAlert error={carte.error} />
      {carte.data && (
        <CarteSurface
          carte={carte.data}
          peutModifier={modifier}
          vue={vue}
          onVue={onVue}
          actions={{
            onAlerte: setAlerte,
            onActif: setActif,
            onMachine: setMachine,
            onConstats: (hote, port) => setConstats({ hote, port }),
          }}
        />
      )}
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!alerte}
        onClose={() => setAlerte(null)}
        title={ficheAlerte.data?.titre ?? 'Alerte AlgoLightHouse'}
        size="xl"
        centered
        lockScroll={false}
      >
        <ErrorAlert error={ficheAlerte.error} />
        {ficheAlerte.data && (
          <Stack>
            <FicheFaille nature="alerte-alh" id={ficheAlerte.data.id} />
            <FicheAlerteAlh a={ficheAlerte.data} />
          </Stack>
        )}
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!actif}
        onClose={() => setActif(null)}
        title={
          actif
            ? actif.alhId
              ? `Machines internes de ${actif.valeur}`
              : `Actif exposé : ${actif.valeur}`
            : 'Actif exposé'
        }
        size="xl"
        centered
        lockScroll={false}
      >
        {actif && (
          <Stack>
            {actif.alhId && <FicheActif actif={{ ...actif, id: actif.alhId }} modifier={modifier} />}
            {actif.silene && <FicheActifSileneLue type={actif.type} valeur={actif.valeur} />}
          </Stack>
        )}
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!constats}
        onClose={() => {
          setConstats(null);
          setConstat(null);
        }}
        title={
          constats
            ? `Constats Silène de ${constats.hote.valeur}${constats.port ? `, port ${constats.port.port}${constats.port.protocole ? `/${constats.port.protocole}` : ''}` : ''}`
            : 'Constats Silène'
        }
        size="xl"
        centered
        lockScroll={false}
      >
        {constats && (
          <Stack>
            <Text size="sm" c="dimmed">
              Sans priorité : un constat Silène n’a pas de CVE ; sa classe est celle du rapport (sens à confirmer).
            </Text>
            <List size="sm">
              {listeConstats.map((c) => (
                <List.Item key={c.id}>
                  <Anchor component="button" type="button" onClick={() => setConstat(c.id)}>
                    {c.controle}
                  </Anchor>{' '}
                  ({libelleClasseSilene(c.classe)}, {c.identifiant})
                </List.Item>
              ))}
            </List>
            {constats.hote.silene && listeConstats.length < constats.hote.silene.nombreConstats && !constats.port && (
              <Text size="xs" c="dimmed">
                Les autres sont dans la fiche de l’actif et dans l’onglet « Constats Silène ».
              </Text>
            )}
            <ErrorAlert error={ficheConstat.error} />
            {ficheConstat.data && <FicheConstatSilene c={ficheConstat.data} />}
          </Stack>
        )}
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!machine}
        onClose={() => setMachine(null)}
        title={ficheMachine.data ? libelleMachine(ficheMachine.data) : 'Machine'}
        size="lg"
        centered
        lockScroll={false}
      >
        <ErrorAlert error={ficheMachine.error} />
        {ficheMachine.data && <FicheMachine machine={ficheMachine.data} modifier={modifier} />}
      </Modal>
    </Stack>
  );
}

function OngletPerimetres() {
  const qc = useQueryClient();
  const [enCours, setEnCours] = useState<string | null>(null);
  const perimetres = useQuery({
    queryKey: [...CLE, 'perimetres'],
    queryFn: () => get<PerimetreAlhDto[]>('/api/vulnerabilites/surface/perimetres'),
  });
  const options = useQuery({
    queryKey: CLE_PERIMETRES_AFFECTABLES,
    queryFn: () => get<PerimetreAffectableDto[]>('/api/vulnerabilites/perimetres'),
  });
  const lier = async (p: PerimetreAlhDto, perimetreId: string | null) => {
    setEnCours(p.id);
    try {
      await api('PUT', `/api/vulnerabilites/surface/perimetres/${p.id}`, { body: { perimetreId }, ifMatch: p.version });
      notifications.show({ color: 'teal', message: perimetreId ? 'Périmètre relié.' : 'Liaison retirée.' });
      await qc.invalidateQueries({ queryKey: CLE });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
      await qc.invalidateQueries({ queryKey: [...CLE, 'perimetres'] });
    } finally {
      setEnCours(null);
    }
  };
  return (
    <Stack>
      <Text size="sm">
        Reliez chaque périmètre d’AlgoLightHouse à un périmètre de la plateforme : ses alertes, actifs et technologies
        deviennent lisibles par les personnes qui lisent ce périmètre. Il faut pouvoir écrire sur le périmètre choisi
        (et sur celui d’avant). Une synchronisation ne change jamais une liaison ; chaque liaison est inscrite au
        journal d’audit.
      </Text>
      <ErrorAlert error={perimetres.error ?? options.error} />
      {perimetres.data && (
        <PerimetresAlhTable
          perimetres={perimetres.data}
          options={options.data ?? []}
          enCours={enCours}
          onLier={(p, v) => void lier(p, v)}
        />
      )}
      <PerimetresSilene options={options.data ?? []} />
    </Stack>
  );
}

export function SurfaceExternePage() {
  const can = useCan();
  const lire = can('vulnerabilites', 'lire');
  const administrer = can('vulnerabilites', 'administrer');
  // Lot R1 : onglet choisi par l'adresse (`?onglet=`, barre de recherche du module), au premier affichage et à chaque
  // navigation.
  const loc = useLocation();
  const ongletAdresse = (search: string): OngletSurface | null => {
    const o = ouvertureSurface(new URLSearchParams(search)).onglet;
    return o && (o !== 'perimetres' || administrer) ? o : null;
  };
  const [onglet, setOnglet] = useState<string | null>(() => ongletAdresse(loc.search) ?? 'carte');
  // Lot SI2 : vue de la carte (regroupement, filtres, replis) gardée pendant la navigation dans la page.
  const [vueCarte, setVueCarte] = useState<VueCarte>(VUE_CARTE_INITIALE);
  useEffect(() => {
    const o = ouvertureSurface(new URLSearchParams(loc.search)).onglet;
    if (o && (o !== 'perimetres' || administrer)) setOnglet(o);
  }, [loc.key, loc.search, administrer]);
  const etat = useQuery({
    queryKey: [...CLE, 'etat'],
    queryFn: () => get<EtatSurfaceExterneDto[]>('/api/vulnerabilites/surface/etat'),
    enabled: lire,
  });
  // Lot SI1 : note Silène de chaque instance lisible.
  const notes = useQuery({
    queryKey: [...CLE, 'silene', 'notes'],
    queryFn: () => get<NoteSileneDto[]>(URL_NOTES_SILENE),
    enabled: lire,
  });
  if (!lire)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit de lire les vulnérabilités.</Alert>
      </Page>
    );
  return (
    <Page>
      <EnteteVulnerabilites
        title="Surface externe"
        description="Ce que deux sources voient de l’organisation sur Internet. AlgoLightHouse (éditeur AlgoSecure) : alertes de ses analystes, hôtes et domaines exposés, technologies détectées et leurs CVE. Silène (ANSSI) : note du rapport importé, ports ouverts par hôte et constats. Un actif (adresse IP ou nom de domaine) vu par les deux n’apparaît qu’une fois. Une CVE portée par un actif exposé est une faille présente chez nous : sa priorité est calculée par la plateforme avec toutes les sources. Lecture seule : AlgoLightHouse est synchronisé chaque jour par l’exécutant d’exploitation, Silène est importé par fichier ; rien n’est écrit chez l’éditeur. Vous voyez ce qui relève des périmètres que vous pouvez lire ; un périmètre d’AlgoLightHouse ou une instance Silène non reliés ne sont visibles qu’avec le droit d’administrer le module. L’onglet « Carte » trace les lignes d’approche, de l’Internet aux machines internes reliées. Dans l’onglet « Actifs », chaque actif exposé se relie à la ou aux machines internes vers lesquelles va la connexion, à la main ou sur proposition de la plateforme confirmée par une personne. Textes de l’éditeur tels quels."
      />
      <Stack>
        <ErrorAlert error={etat.error ?? notes.error} />
        <div className="ss-sources">
          <Stack gap="sm" component="section" aria-label="AlgoLightHouse" className="ss-source">
            <Group gap="xs">
              <PictoSource source="algolighthouse" avecNom decoratif />
              <Title order={2} size="h5">
                AlgoLightHouse
              </Title>
            </Group>
            {etat.data && <EtatSurface etats={etat.data} peutConfigurer={peutConfigurerIntegration(can)} />}
          </Stack>
          {notes.data && <NoteSilene notes={notes.data} peutConfigurer={peutConfigurerIntegration(can)} />}
        </div>
        <Tabs value={onglet} onChange={setOnglet} keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="carte">Carte</Tabs.Tab>
            <Tabs.Tab value="alertes">Alertes</Tabs.Tab>
            <Tabs.Tab value="actifs">Actifs</Tabs.Tab>
            <Tabs.Tab value="technologies">Technologies</Tabs.Tab>
            <Tabs.Tab value="constats-silene">Constats Silène</Tabs.Tab>
            {administrer && <Tabs.Tab value="perimetres">Périmètres</Tabs.Tab>}
          </Tabs.List>
          <Tabs.Panel value="carte" pt="md">
            <OngletCarte vue={vueCarte} onVue={setVueCarte} />
          </Tabs.Panel>
          <Tabs.Panel value="alertes" pt="md">
            <OngletAlertes />
          </Tabs.Panel>
          <Tabs.Panel value="actifs" pt="md">
            <OngletActifs />
          </Tabs.Panel>
          <Tabs.Panel value="technologies" pt="md">
            <OngletTechnologies />
          </Tabs.Panel>
          <Tabs.Panel value="constats-silene" pt="md">
            <OngletConstatsSilene />
          </Tabs.Panel>
          {administrer && (
            <Tabs.Panel value="perimetres" pt="md">
              <OngletPerimetres />
            </Tabs.Panel>
          )}
        </Tabs>
      </Stack>
    </Page>
  );
}

/* Module Vulnérabilités (ADR 0100, lot ALH1) : écran « Surface externe ». Alertes, actifs (hôtes et domaines) et
   technologies lus dans AlgoLightHouse (éditeur AlgoSecure), visibles à travers les droits du périmètre de la plateforme
   relié à chaque périmètre de l'éditeur ; un périmètre non relié n'est visible qu'avec le droit d'administrer le module.
   Onglet « Périmètres » (administration du module) : relier chaque périmètre de l'éditeur à un périmètre de la plateforme.
   Lecture seule : rien n'est jamais écrit chez l'éditeur ; ses textes s'affichent tels quels. Composants de la charte, CSP
   stricte (ADR 0006) ; le serveur est seul juge des droits, les onglets ne font que suivre la session.
   Lot ALH2 : priorité calculée par la plateforme (alertes, technologies et leurs CVE), tri par priorité, fiche d'une alerte
   avec les défauts et résolutions recommandés par l'éditeur, rendus comme texte (jamais comme HTML), produits surveillés
   rapprochés d'une technologie. */
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
  type ActifAlhDto,
  type AlerteAlhDto,
  CRITICITES_ALH,
  type EtatSurfaceExterneDto,
  type FicheAlerteAlhDto,
  type PageSurface,
  type PerimetreAffectableDto,
  type PerimetreAlhDto,
  STATUTS_ALERTE_ALH,
  type TechnologieAlhDto,
  TYPES_ACTIF_ALH,
  TYPES_ALERTE_ALH,
  type TypeActifAlh,
} from '@suivi/shared';
import { DataTable, ErrorAlert, Page, PageHeader, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, errorMessage, get } from '../api';
import { fmtDate } from '../components/common';
import { useCan } from '../session';
import { ETAT_PRIORITE } from './failles';
import { PrioriteFaits } from './FaillesDetectees';
import { MarquesSources } from './SourcesFaille';
import {
  alerteOuverte,
  CRITICITE_ALH_ETAT,
  FILTRES_ALERTES_VIDES,
  type FiltresAlertesAlh,
  libelleCible,
  libelleCriticite,
  libellePerimetre,
  libelleProduitRapproche,
  libelleStatutActif,
  libelleStatutAlerte,
  libelleTypeActif,
  libelleTypeAlerte,
  pourcentage,
  resumeEtatAlh,
  urlActifsAlh,
  OPTIONS_TRI_ALERTES,
  OPTIONS_TRI_TECHNOLOGIES,
  triDepuis,
  urlAlertesAlh,
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

/** État de la synchronisation de chaque instance AlgoLightHouse (sans état). */
export function EtatSurface({ etats }: { etats: EtatSurfaceExterneDto[] }) {
  if (!etats.length)
    return (
      <Alert role="status" title="Aucun connecteur AlgoLightHouse">
        Aucune instance AlgoLightHouse n’est configurée : un administrateur des intégrations l’ajoute dans{' '}
        <Link to="/integrations">Pilotage &gt; Intégrations</Link>.
      </Alert>
    );
  return (
    <Stack gap="xs">
      {etats.map((e) => {
        const r = resumeEtatAlh(e);
        return (
          <Group key={e.integrationId} gap="sm" wrap="nowrap" align="flex-start">
            <StatusChip etat={r.etat}>{r.libelle}</StatusChip>
            <Stack gap="2xs">
              <Text size="sm" fw={600}>
                {e.nom}
              </Text>
              {r.detail && (
                <Text size="xs" c="dimmed" role="status">
                  {r.detail}
                </Text>
              )}
              {e.derniereCompleteLe && (
                <Text size="xs" c="dimmed">
                  Dernière synchronisation complète :{' '}
                  <span className="horodatage">{fmtDate(e.derniereCompleteLe)}</span>
                </Text>
              )}
            </Stack>
          </Group>
        );
      })}
    </Stack>
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

/** Fiche d'une alerte (sans état) : CVE avec leur priorité et leurs sources, défauts et résolutions recommandés par
    l'éditeur. Les textes de l'éditeur sont rendus comme texte (React les échappe) : aucun HTML n'est interprété. */
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
      <Title order={3} size="h6">
        Recommandations de l’éditeur
      </Title>
      {a.defauts.length ? (
        a.defauts.map((d, i) => (
          <Stack key={`${i}-${d.nom}`} gap="2xs" role="group" aria-label={`Défaut : ${d.nom}`}>
            <Text size="sm" fw={600} className="veille-texte">
              {d.nom}
            </Text>
            {d.description && (
              <Text size="sm" className="veille-texte">
                {d.description}
              </Text>
            )}
            {d.resolutions.length > 0 && (
              <List size="sm" spacing="2xs">
                {d.resolutions.map((r, j) => (
                  <List.Item key={`${j}-${r.nom}`}>
                    <Text size="sm" fw={600} span className="veille-texte">
                      {r.nom}
                    </Text>
                    {(r.facilite || r.gain) && (
                      <Text size="xs" c="dimmed" span>
                        {` (${[r.facilite ? `facilité : ${r.facilite}` : null, r.gain ? `gain : ${r.gain}` : null]
                          .filter(Boolean)
                          .join(' · ')})`}
                      </Text>
                    )}
                    {r.description && (
                      <Text size="sm" className="veille-texte">
                        {r.description}
                      </Text>
                    )}
                  </List.Item>
                ))}
              </List>
            )}
          </Stack>
        ))
      ) : (
        <Text size="sm" c="dimmed">
          {a.detail
            ? 'L’éditeur ne publie aucune recommandation pour cette alerte.'
            : 'Détail pas encore lu : les recommandations viendront à une prochaine synchronisation.'}
        </Text>
      )}
      <Text size="xs" c="dimmed">
        Textes de l’éditeur tels quels (anglais ou français), sans mise en forme.
      </Text>
    </Stack>
  );
}

/** Hôtes et domaines (sans état). */
export function ActifsAlhTable({ actifs }: { actifs: ActifAlhDto[] }) {
  return (
    <DataTable label="Actifs exposés">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Actif</Table.Th>
            <Table.Th>Surveillance</Table.Th>
            <Table.Th>Réseau</Table.Th>
            <Table.Th>Alertes ouvertes</Table.Th>
            <Table.Th>Technologies</Table.Th>
            <Table.Th>Périmètre</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {actifs.map((x) => (
            <Table.Tr key={x.id}>
              <Table.Td>
                <Text size="sm" className="veille-code">
                  {x.valeur}
                </Text>
                <Text size="xs" c="dimmed">
                  {libelleTypeActif(x.type)}
                  {x.adresse ? ` · résout vers ${x.adresse}` : ''}
                </Text>
              </Table.Td>
              <Table.Td>{libelleStatutActif(x.statut)}</Table.Td>
              <Table.Td>
                <Text size="sm">{[x.fai, x.asn ? `AS${x.asn}` : null, x.pays].filter(Boolean).join(' · ') || '—'}</Text>
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
              <Table.Td>{x.technologies}</Table.Td>
              <Table.Td>{libellePerimetre(x)}</Table.Td>
            </Table.Tr>
          ))}
          {actifs.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
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
                  Aucun périmètre AlgoLightHouse : lancez une synchronisation depuis Pilotage &gt; Intégrations.
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
        {fiche.data && <FicheAlerteAlh a={fiche.data} />}
      </Modal>
    </Stack>
  );
}

function OngletActifs() {
  const [saisie, setSaisie] = useState('');
  const [recherche, setRecherche] = useState('');
  const [type, setType] = useState<TypeActifAlh | ''>('');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: [...CLE, 'actifs', recherche, type, page],
    queryFn: () => get<PageSurface<ActifAlhDto>>(urlActifsAlh(recherche, type, page)),
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
        </Group>
      </form>
      <ErrorAlert error={q.error} />
      {q.data && <ActifsAlhTable actifs={q.data.elements} />}
      {q.data && <Pages donnees={q.data} page={page} onPage={setPage} nom="actifs" />}
    </Stack>
  );
}

function OngletTechnologies() {
  const [saisie, setSaisie] = useState('');
  const [recherche, setRecherche] = useState('');
  const [exploitee, setExploitee] = useState(false);
  const [tri, setTri] = useState<ReturnType<typeof triDepuis>>('');
  const [page, setPage] = useState(1);
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

function OngletPerimetres() {
  const qc = useQueryClient();
  const [enCours, setEnCours] = useState<string | null>(null);
  const perimetres = useQuery({
    queryKey: [...CLE, 'perimetres'],
    queryFn: () => get<PerimetreAlhDto[]>('/api/vulnerabilites/surface/perimetres'),
  });
  const options = useQuery({
    queryKey: ['vulnerabilites', 'perimetres-affectables'],
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
    </Stack>
  );
}

export function SurfaceExternePage() {
  const can = useCan();
  const lire = can('vulnerabilites', 'lire');
  const administrer = can('vulnerabilites', 'administrer');
  const [onglet, setOnglet] = useState<string | null>('alertes');
  const etat = useQuery({
    queryKey: [...CLE, 'etat'],
    queryFn: () => get<EtatSurfaceExterneDto[]>('/api/vulnerabilites/surface/etat'),
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
      <PageHeader
        title="Surface externe"
        description="Ce qu’AlgoLightHouse (éditeur AlgoSecure) voit de l’organisation sur Internet : alertes de ses analystes, hôtes et domaines exposés, technologies détectées et leurs CVE. Une CVE portée par un actif exposé est une faille présente chez nous : sa priorité est calculée par la plateforme avec toutes les sources. Lecture seule, synchronisée chaque jour par l’exécutant d’exploitation ; rien n’est écrit chez l’éditeur. Vous voyez ce qui relève des périmètres que vous pouvez lire ; un périmètre d’AlgoLightHouse non relié n’est visible qu’avec le droit d’administrer le module. Textes de l’éditeur tels quels."
      />
      <Stack>
        <ErrorAlert error={etat.error} />
        {etat.data && <EtatSurface etats={etat.data} />}
        <Tabs value={onglet} onChange={setOnglet} keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="alertes">Alertes</Tabs.Tab>
            <Tabs.Tab value="actifs">Actifs</Tabs.Tab>
            <Tabs.Tab value="technologies">Technologies</Tabs.Tab>
            {administrer && <Tabs.Tab value="perimetres">Périmètres</Tabs.Tab>}
          </Tabs.List>
          <Tabs.Panel value="alertes" pt="md">
            <OngletAlertes />
          </Tabs.Panel>
          <Tabs.Panel value="actifs" pt="md">
            <OngletActifs />
          </Tabs.Panel>
          <Tabs.Panel value="technologies" pt="md">
            <OngletTechnologies />
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

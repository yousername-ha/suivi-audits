/* Études EBIOS RM (lot U3, ADR 0027) : liste des études, puis une étude par atelier. Chaque élément est un objet
   typé rattaché à l'étude ; la validation d'un atelier est une décision tracée ; un scénario opérationnel donne un
   risque du registre avec sa filiation. Démarche inspirée du guide de l'ANSSI, sans conformité revendiquée. */
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Menu,
  Modal,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
} from '@mantine/core';
import {
  ECHELLE_GRAVITE,
  ECHELLE_VRAISEMBLANCE,
  GRC_LABELS,
  libelleOptionTraitement,
  type GrcKind,
  type GrcObject,
  type PilotageRecord,
} from '@suivi/shared';
import { DataTable, StatusChip } from '@suivi/ui';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { api, get } from '../api';
import { BoiteOutils } from '../components/BarreOutils';
import { ErrorAlert } from '../components/common';
import { correspond } from '../components/recherche-liste';
import { ficheCliquable } from '../fiche-cliquable';
import { useCan } from '../session';
import { Chemins } from './ebios-visuel/Chemins';
import { familleSource } from './ebios-visuel/modele';
import { libelleFamille, PictoSource } from './ebios-visuel/Pictos';
import { Synthese } from './ebios-visuel/Synthese';
import { etatEtude, etudesAffichees, libelleAvancement, syntheseEtudes, type EtatEtude } from './gestion-risques';

interface ObjetEtude {
  id: string;
  kind: GrcKind;
  name: string;
  version: number;
  data: Record<string, unknown>;
  calcul: {
    menace?: number | null;
    graviteProposee?: number | null;
    graviteCatalogue?: string | null;
    graviteScenarioCatalogue?: string | null;
    vraisemblanceCatalogue?: string | null;
    /** Source de la bibliothèque partagée (sans étude propriétaire), lue par référence. */
    bibliotheque?: boolean;
    /** Version actuelle de la source de la bibliothèque quand elle a changé depuis le choix du couple. */
    sourceModifiee?: number | null;
  };
}
interface SourceBibliotheque {
  id: string;
  name: string;
  version: number;
  category: string;
  motive: string;
  resources: string;
  targetObjective: string;
  usages: number;
  etudes: number;
}
interface VueEtude {
  etude: GrcObject;
  ateliers: {
    id: string;
    label: string;
    aide: string;
    kinds: GrcKind[];
    objets: ObjetEtude[];
    valide: boolean;
    modifieDepuisValidation: boolean;
    validations: { step: string; result: string; date: string; by: string; sourceVersion: number }[];
  }[];
}

const niveau = (v: unknown, echelle: readonly string[]) =>
  typeof v === 'number' && v >= 1 && v <= 4 ? `${v} — ${echelle[v - 1]}` : '—';

/** Colonnes de synthèse propres à chaque type d'élément. */
function resume(o: ObjetEtude, noms: Map<string, string>) {
  const nom = (r: unknown) => (typeof r === 'string' ? (noms.get(r) ?? 'Élément lié') : '—');
  const liste = (v: unknown) => (Array.isArray(v) && v.length ? v.map(nom).join(', ') : '—');
  switch (o.kind) {
    case 'feared_event':
      return `Gravité ${
        o.calcul.graviteCatalogue
          ? `« ${o.calcul.graviteCatalogue} » (échelle publiée)`
          : niveau(o.data.gravity, ECHELLE_GRAVITE)
      } · valeur métier : ${nom(o.data.businessAssetRef)}`;
    case 'sr_ov':
      return `${o.data.retained ? 'Retenu' : 'Non retenu'} · source : ${nom(o.data.sourceRef)}`;
    case 'ecosystem_party':
      return o.calcul.menace == null
        ? 'Indice de menace : critères à compléter'
        : `Indice de menace : ${o.calcul.menace}`;
    case 'strategic_scenario':
      return `Gravité ${
        o.calcul.graviteScenarioCatalogue
          ? `« ${o.calcul.graviteScenarioCatalogue} » (échelle publiée)`
          : niveau(o.data.gravity, ECHELLE_GRAVITE)
      }${
        o.calcul.graviteProposee ? ` (proposée : ${niveau(o.calcul.graviteProposee, ECHELLE_GRAVITE)})` : ''
      } · couple : ${nom(o.data.srOvRef)}`;
    case 'operational_scenario':
      return `Vraisemblance ${
        o.calcul.vraisemblanceCatalogue
          ? `« ${o.calcul.vraisemblanceCatalogue} » (échelle publiée)`
          : niveau(o.data.likelihood, ECHELLE_VRAISEMBLANCE)
      } · scénario : ${nom(o.data.strategicScenarioRef)}`;
    case 'support_asset':
      return `Valeurs métier : ${liste(o.data.businessAssetRefs)}`;
    case 'business_asset':
      return String(o.data.mission ?? '') || '—';
    case 'treatment':
      return `Risques traités : ${liste(o.data.riskRefs)}`;
    case 'risk':
      return `Option : ${libelleOptionTraitement(o.data.strategy) || '—'}`;
    default:
      return String(o.data.description ?? '') || '—';
  }
}

const ETAT_SOCLE: Record<string, string> = { applied: 'Appliqué', partial: 'Partiellement appliqué', gap: 'Écart' };

/** Socle de sécurité de l'étude (atelier 1) : référentiels appliqués et écarts constatés, saisis dans la fiche de l'étude. */
function SocleSecurite({ socle }: { socle: unknown }) {
  const lignes = Array.isArray(socle) ? (socle as { referential: string; status: string; gap?: string }[]) : [];
  return (
    <Stack gap="2xs" data-testid="socle-securite">
      <Text fw={600} size="sm">
        Socle de sécurité
      </Text>
      {lignes.length ? (
        <ul aria-label="Socle de sécurité de l’étude">
          {lignes.map((l, i) => (
            <li key={i}>
              {l.referential} : {ETAT_SOCLE[l.status] ?? l.status}
              {l.gap ? ` — ${l.gap}` : ''}
            </li>
          ))}
        </ul>
      ) : (
        <Text size="sm">Aucun socle renseigné : à saisir dans la fiche de l’étude.</Text>
      )}
    </Stack>
  );
}

/** Bibliothèque partagée des sources de risque du périmètre (décision 10) : sources sans étude propriétaire, réutilisées par
    référence dans les couples des études ; les cotations (motivation, ressources, pertinence) restent propres à chaque étude. */
function BibliothequeSources({
  smsi,
  onOpen,
  onCreate,
}: {
  smsi: string;
  onOpen: (o: GrcObject) => void;
  onCreate: (kind: GrcKind, initial?: Record<string, unknown>) => void;
}) {
  const can = useCan();
  const q = useQuery({
    queryKey: ['grc', smsi, 'risk-library'],
    queryFn: () => get<{ items: SourceBibliotheque[] }>(`/api/grc/${smsi}/risk-library`),
  });
  return (
    <Card withBorder>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>Bibliothèque de sources de risque</Text>
          {can('pilotage', 'modifier') && (
            <Button size="xs" variant="light" onClick={() => onCreate('risk_source')}>
              Ajouter une source à la bibliothèque
            </Button>
          )}
        </Group>
        <Text size="sm">
          Les sources de la bibliothèque sont partagées par toutes les études du périmètre : une étude les choisit au
          lieu de les ressaisir, et les cotations de chaque couple restent propres à l’étude.
        </Text>
        <ErrorAlert error={q.error} />
        {q.data && !q.data.items.length && <Text size="sm">Aucune source dans la bibliothèque.</Text>}
        {!!q.data?.items.length && (
          <DataTable label="Bibliothèque de sources de risque">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Source</Table.Th>
                  <Table.Th>Catégorie</Table.Th>
                  <Table.Th>Version</Table.Th>
                  <Table.Th>Utilisation</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {q.data.items.map((s) => (
                  <Table.Tr
                    key={s.id}
                    {...ficheCliquable(
                      () => void get<GrcObject>(`/api/grc/${smsi}/objects/${s.id}`).then(onOpen),
                      `Afficher ${s.name}`,
                    )}
                  >
                    <Table.Td>{s.name}</Table.Td>
                    <Table.Td>{s.category || '—'}</Table.Td>
                    <Table.Td>{s.version}</Table.Td>
                    <Table.Td>
                      {s.usages ? `${s.usages} couple(s) dans ${s.etudes} étude(s)` : 'Pas encore utilisée'}
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="default"
                        onClick={() => void get<GrcObject>(`/api/grc/${smsi}/objects/${s.id}`).then(onOpen)}
                      >
                        Ouvrir
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </DataTable>
        )}
      </Stack>
    </Card>
  );
}

export function EtudesEbios({
  smsi,
  onOpen,
  onCreate,
  onCreateRisk,
  onDecision,
}: {
  smsi: string;
  onOpen: (o: GrcObject) => void;
  onCreate: (kind: GrcKind, initial?: Record<string, unknown>) => void;
  onCreateRisk: (name: string, data: Record<string, unknown>) => void;
  onDecision: (o: GrcObject, operation: PilotageRecord['operation'], step?: string) => void;
}) {
  const can = useCan();
  const [choisie, setChoisie] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<string>('a1');
  const [cheminChoisi, setCheminChoisi] = useState<string | null>(null);
  const [scenarioChoisi, setScenarioChoisi] = useState<string | null>(null);
  const [choixBibliotheque, setChoixBibliotheque] = useState(false);
  const [sourceChoisie, setSourceChoisie] = useState<string | null>(null);
  const qc = useQueryClient();
  const etudes = useQuery({
    queryKey: ['grc', smsi, 'objects', 'risk_study'],
    queryFn: () => get<{ items: GrcObject[] }>(`/api/grc/${smsi}/objects?kind=risk_study`),
  });
  const vue = useQuery({
    queryKey: ['grc', smsi, 'risk-study', choisie],
    queryFn: () => get<VueEtude>(`/api/grc/${smsi}/risk-studies/${choisie}`),
    enabled: !!choisie,
  });
  const ouvrir = async (id: string) => onOpen(await get<GrcObject>(`/api/grc/${smsi}/objects/${id}`));
  const bibliotheque = useQuery({
    queryKey: ['grc', smsi, 'risk-library'],
    queryFn: () => get<{ items: SourceBibliotheque[] }>(`/api/grc/${smsi}/risk-library`),
    enabled: !!choisie,
  });
  /** Le couple a été relu après l'évolution de la source de la bibliothèque : la version retenue passe à la version actuelle. */
  const marquerRelue = async (o: ObjetEtude) => {
    const fiche = await get<GrcObject>(`/api/grc/${smsi}/objects/${o.id}`);
    await api('PUT', `/api/grc/${smsi}/objects/${o.id}`, {
      ifMatch: fiche.version,
      body: { kind: fiche.kind, name: fiche.name, data: { ...fiche.data, sourceVersion: o.calcul.sourceModifiee } },
    });
    await qc.invalidateQueries({ queryKey: ['grc', smsi, 'risk-study', choisie] });
  };
  const modifier = can('pilotage', 'modifier');
  if (!choisie)
    return (
      <ListeEtudes
        smsi={smsi}
        etudes={etudes.data?.items}
        erreur={etudes.error}
        modifier={modifier}
        onCreate={onCreate}
        onOpen={onOpen}
        onOuvrir={(id, atelier) => {
          setOnglet(atelier);
          setChoisie(id);
        }}
      />
    );
  const v = vue.data;
  const noms = new Map((v?.ateliers ?? []).flatMap((a) => a.objets.map((o) => ['object:' + o.id, o.name] as const)));
  const etudeRef = 'object:' + choisie;
  const tousObjets = (v?.ateliers ?? []).flatMap((a) => a.objets);
  const sourceDeBibliotheque = bibliotheque.data?.items.find((x) => x.id === sourceChoisie);
  return (
    <Stack>
      <Modal
        opened={choixBibliotheque}
        onClose={() => setChoixBibliotheque(false)}
        title="Choisir une source dans la bibliothèque"
        closeButtonProps={{ 'aria-label': 'Fermer le choix de la source' }}
      >
        <Stack>
          <Text size="sm">
            Le couple source / objectif visé de l’étude référence la source de la bibliothèque (rien n’est copié) ; ses
            cotations restent propres à cette étude.
          </Text>
          <ErrorAlert error={bibliotheque.error} />
          {bibliotheque.data && !bibliotheque.data.items.length && (
            <Text size="sm">La bibliothèque est vide : ajoutez-y une source depuis la liste des études.</Text>
          )}
          <Select
            allowDeselect={false}
            label="Source de risque"
            searchable
            data={(bibliotheque.data?.items ?? []).map((x) => ({
              value: x.id,
              label: x.category ? `${x.name} (${x.category})` : x.name,
            }))}
            value={sourceChoisie}
            onChange={setSourceChoisie}
          />
          {sourceDeBibliotheque?.targetObjective && (
            <Text size="sm">Objectif visé proposé : {sourceDeBibliotheque.targetObjective}</Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setChoixBibliotheque(false)}>
              Annuler
            </Button>
            <Button
              disabled={!sourceDeBibliotheque}
              onClick={() => {
                if (!sourceDeBibliotheque) return;
                setChoixBibliotheque(false);
                setSourceChoisie(null);
                onCreate('sr_ov', {
                  studyRef: etudeRef,
                  sourceRef: 'object:' + sourceDeBibliotheque.id,
                  sourceVersion: sourceDeBibliotheque.version,
                  objective: sourceDeBibliotheque.targetObjective,
                });
              }}
            >
              Créer le couple
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Group>
        <Button variant="default" onClick={() => setChoisie(null)}>
          Toutes les études
        </Button>
        {v && (
          <Button variant="light" onClick={() => onOpen(v.etude)}>
            Fiche de l’étude
          </Button>
        )}
      </Group>
      <ErrorAlert error={vue.error} />
      {v && (
        <>
          <Text fw={600}>{v.etude.name}</Text>
          <Group gap="xs">
            {v.ateliers.map((a) => (
              <Badge
                key={a.id}
                variant={a.valide ? 'filled' : 'light'}
                color={a.valide ? 'suivi' : a.modifieDepuisValidation ? 'orange' : 'gray'}
              >
                {a.id.toUpperCase()}{' '}
                {a.valide ? 'validé' : a.modifieDepuisValidation ? 'modifié depuis la validation' : 'en cours'}
              </Badge>
            ))}
          </Group>
          <Tabs value={onglet} onChange={(t) => t && setOnglet(t)} keepMounted={false}>
            <Tabs.List>
              {v.ateliers.map((a) => (
                <Tabs.Tab key={a.id} value={a.id}>
                  {a.label.replace(/^Atelier (\d) — /, '$1. ')}
                </Tabs.Tab>
              ))}
              <Tabs.Tab value="synthese">Suivi, matrice et cercle</Tabs.Tab>
              <Tabs.Tab value="chemins">Chemins</Tabs.Tab>
            </Tabs.List>
            {v.ateliers.map((a) => (
              <Tabs.Panel key={a.id} value={a.id} pt="md">
                <Stack>
                  <Text size="sm">{a.aide}</Text>
                  {a.id === 'a1' && <SocleSecurite socle={v.etude.data.baseline} />}
                  {a.modifieDepuisValidation && (
                    <Alert color="orange" title="Modifié depuis la validation">
                      Un élément de cet atelier a changé après sa dernière validation : la validation ne vaut plus pour
                      son contenu actuel. Validez de nouveau l’atelier après relecture.
                    </Alert>
                  )}
                  {modifier && (
                    <Group>
                      {a.kinds.map((k) => (
                        <Button key={k} size="xs" variant="light" onClick={() => onCreate(k, { studyRef: etudeRef })}>
                          {`Ajouter : ${GRC_LABELS[k]}`}
                        </Button>
                      ))}
                      {a.id === 'a2' && (
                        <Button size="xs" variant="default" onClick={() => setChoixBibliotheque(true)}>
                          Choisir une source dans la bibliothèque
                        </Button>
                      )}
                    </Group>
                  )}
                  {a.objets.length ? (
                    <DataTable label={a.label}>
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Élément</Table.Th>
                            <Table.Th>Type</Table.Th>
                            <Table.Th>Synthèse</Table.Th>
                            <Table.Th>Actions</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {a.objets.map((o) => (
                            <Table.Tr key={o.id} {...ficheCliquable(() => void ouvrir(o.id), `Afficher ${o.name}`)}>
                              <Table.Td>
                                {o.kind === 'risk_source' ? (
                                  <Group gap="xs" wrap="nowrap">
                                    <PictoSource famille={familleSource(o.data.category)} />
                                    <span>{o.name}</span>
                                    <Text span size="xs" c="dimmed">
                                      (pictogramme indicatif : {libelleFamille(familleSource(o.data.category))})
                                    </Text>
                                  </Group>
                                ) : (
                                  o.name
                                )}
                                {o.calcul.bibliotheque && (
                                  <Badge ml="xs" variant="light" color="gray">
                                    Bibliothèque
                                  </Badge>
                                )}
                                {o.kind === 'sr_ov' && o.calcul.sourceModifiee != null && (
                                  <Group gap="xs" mt="2xs">
                                    <Badge variant="light" color="orange">
                                      Source modifiée depuis le choix (version {o.calcul.sourceModifiee})
                                    </Badge>
                                    {modifier && (
                                      <Button size="compact-xs" variant="subtle" onClick={() => void marquerRelue(o)}>
                                        Marquer comme relue
                                      </Button>
                                    )}
                                  </Group>
                                )}
                              </Table.Td>
                              <Table.Td>{GRC_LABELS[o.kind]}</Table.Td>
                              <Table.Td>{resume(o, noms)}</Table.Td>
                              <Table.Td>
                                <Group gap="xs" wrap="nowrap">
                                  <Button size="xs" variant="default" onClick={() => void ouvrir(o.id)}>
                                    Ouvrir
                                  </Button>
                                  {o.kind === 'operational_scenario' && modifier && (
                                    <Button
                                      size="xs"
                                      variant="light"
                                      onClick={() =>
                                        onCreateRisk('Risque : ' + o.name, {
                                          studyRef: etudeRef,
                                          scenarioRef: 'object:' + o.id,
                                          description: String(o.data.attackSequence ?? ''),
                                        })
                                      }
                                    >
                                      Créer le risque
                                    </Button>
                                  )}
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </DataTable>
                  ) : (
                    <Text size="sm">Aucun élément dans cet atelier.</Text>
                  )}
                  <Group>
                    {a.valide ? (
                      <StatusChip etat="succes">Atelier validé</StatusChip>
                    ) : (
                      can('pilotage', 'administrer') && (
                        <Button size="xs" onClick={() => onDecision(v.etude, 'step_validation', a.id)}>
                          Valider l’atelier
                        </Button>
                      )
                    )}
                    {a.validations.map((x, i) => (
                      <Text key={i} size="xs" c="dimmed">
                        Validé le {x.date} par {x.by}
                        {x.sourceVersion !== v.etude.version ? ' (version antérieure de l’étude)' : ''}
                      </Text>
                    ))}
                  </Group>
                </Stack>
              </Tabs.Panel>
            ))}
            <Tabs.Panel value="synthese" pt="md">
              <Synthese
                objets={tousObjets}
                choisi={scenarioChoisi}
                onChoisir={setScenarioChoisi}
                onOuvrir={(id) => void ouvrir(id)}
                onVoirChemin={(r) => {
                  setCheminChoisi(r);
                  setOnglet('chemins');
                }}
                actions={
                  modifier
                    ? (l) => (
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => {
                            const o = tousObjets.find((x) => x.id === l.id);
                            if (o)
                              onCreateRisk('Risque : ' + o.name, {
                                studyRef: etudeRef,
                                scenarioRef: 'object:' + o.id,
                                description: String(o.data.attackSequence ?? ''),
                              });
                          }}
                        >
                          Créer le risque
                        </Button>
                      )
                    : undefined
                }
              />
            </Tabs.Panel>
            <Tabs.Panel value="chemins" pt="md">
              <Chemins
                objets={tousObjets}
                choisi={cheminChoisi}
                onChoisir={setCheminChoisi}
                onOuvrir={(id) => void ouvrir(id)}
                onVoirSynthese={(r) => {
                  setScenarioChoisi(r);
                  setOnglet('synthese');
                }}
              />
            </Tabs.Panel>
          </Tabs>
        </>
      )}
    </Stack>
  );
}

const jourFr = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('fr-FR');
const texte = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Liste des études EBIOS RM (dessin validé par le RSSI le 27/11/2026) : compteurs, une carte par étude avec ses cinq
    ateliers, ses chiffres et « Reprendre l'atelier ». Décision 1 du RSSI : une étude terminée (cinq ateliers validés)
    disparaît de la liste ; « Afficher les études terminées » (décochée par défaut) permet de les revoir. L'avancement est lu
    dans la vue de chaque étude (validations tracées par le serveur), rien n'est calculé ici sans elles. */
function ListeEtudes({
  smsi,
  etudes,
  erreur,
  modifier,
  onCreate,
  onOpen,
  onOuvrir,
}: {
  smsi: string;
  etudes: GrcObject[] | undefined;
  erreur: unknown;
  modifier: boolean;
  onCreate: (kind: GrcKind, initial?: Record<string, unknown>) => void;
  onOpen: (o: GrcObject) => void;
  /** Ouvre l'étude sur l'onglet donné (« a1 » à « a5 »). */
  onOuvrir: (id: string, atelier: string) => void;
}) {
  const [terminees, setTerminees] = useState(false);
  const [recherche, setRecherche] = useState('');
  const liste = etudes ?? [];
  // Même clé que la vue d'une étude ouverte : la vue lue pour la carte sert aussi à l'ouverture.
  const vues = useQueries({
    queries: liste.map((e) => ({
      queryKey: ['grc', smsi, 'risk-study', e.id],
      queryFn: () => get<VueEtude>(`/api/grc/${smsi}/risk-studies/${e.id}`),
    })),
  });
  const etats = new Map<string, EtatEtude | undefined>(
    liste.map((e, i) => {
      const d = vues[i]?.data;
      return [e.id, d ? etatEtude(d) : undefined] as const;
    }),
  );
  return (
    <Stack className="ris-etudes">
      <ErrorAlert error={erreur} />
      <ListeEtudesVue
        etudes={etudes}
        etats={etats}
        terminees={terminees}
        onTerminees={setTerminees}
        recherche={recherche}
        onRecherche={setRecherche}
        ajout={modifier && <Button onClick={() => onCreate('risk_study')}>Nouvelle étude</Button>}
        onOpen={onOpen}
        onOuvrir={onOuvrir}
      />
      <BibliothequeSources smsi={smsi} onOpen={onOpen} onCreate={onCreate} />
    </Stack>
  );
}

/** Présentation de la liste des études (sans appel serveur) : outils, case « Afficher les études terminées », compteurs
    et cartes. `etats` : avancement de chaque étude, absent tant que sa vue n'est pas lue. */
export function ListeEtudesVue({
  etudes,
  etats,
  terminees,
  onTerminees,
  recherche,
  onRecherche,
  ajout,
  onOpen,
  onOuvrir,
}: {
  etudes: GrcObject[] | undefined;
  etats: ReadonlyMap<string, EtatEtude | undefined>;
  terminees: boolean;
  onTerminees: (v: boolean) => void;
  recherche: string;
  onRecherche: (v: string) => void;
  ajout?: ReactNode;
  onOpen: (o: GrcObject) => void;
  onOuvrir: (id: string, atelier: string) => void;
}) {
  const liste = etudes ?? [];
  const chiffres = syntheseEtudes(liste, etats);
  const { visibles, masquees } = etudesAffichees(liste, etats, terminees);
  const trouvees = visibles.filter((e) => correspond([e.name, e.data.objective, e.data.scope], recherche));
  return (
    <>
      <BoiteOutils
        label="Outils des études EBIOS RM"
        total={etudes ? liste.length : undefined}
        affiches={trouvees.length}
        recherche={{ label: 'Rechercher dans les études', value: recherche, onChange: onRecherche }}
        onToutEffacer={() => onRecherche('')}
        ajout={ajout}
      >
        <Group gap="sm" className="ris-etudes__terminees">
          <Checkbox
            label="Afficher les études terminées"
            checked={terminees}
            onChange={(e) => onTerminees(e.currentTarget.checked)}
            aria-describedby={masquees ? 'ris-etudes-masquees' : undefined}
          />
          {masquees > 0 && (
            <Text component="span" id="ris-etudes-masquees" className="ris-etudes__masquees">
              {pluriel(masquees, 'étude terminée masquée', 'études terminées masquées')}
            </Text>
          )}
        </Group>
      </BoiteOutils>
      {liste.length > 0 && (
        <ul className="ris-compteurs" aria-label="Études du périmètre">
          <li>
            <b className="chiffres">{chiffres.total}</b> {chiffres.total > 1 ? 'études EBIOS RM' : 'étude EBIOS RM'}
          </li>
          <li data-ton="avance">
            <b className="chiffres">{chiffres.enCours}</b> en cours
            {chiffres.auCadrage ? `, dont ${chiffres.auCadrage} au cadrage` : ''}
          </li>
          <li data-ton="succes">
            <b className="chiffres">{chiffres.terminees}</b>{' '}
            {chiffres.terminees > 1 ? 'terminées et validées' : 'terminée et validée'}
          </li>
          <li>
            <b className="chiffres">{chiffres.risques}</b>{' '}
            {chiffres.risques > 1 ? 'risques reportés au registre' : 'risque reporté au registre'}
          </li>
        </ul>
      )}
      {etudes && !liste.length && <Text>Aucune étude pour ce périmètre.</Text>}
      {liste.length > 0 && !trouvees.length && (
        <Text>{recherche ? 'Aucune étude ne correspond.' : 'Toutes les études du périmètre sont terminées.'}</Text>
      )}
      <div className="ris-etudes__grille">
        {trouvees.map((e) => (
          <CarteEtude
            key={e.id}
            etude={e}
            etat={etats.get(e.id)}
            onOpen={() => onOpen(e)}
            onOuvrir={(atelier) => onOuvrir(e.id, atelier)}
          />
        ))}
      </div>
    </>
  );
}

/** Carte d'une étude : intitulé, objet, dates, avancement, les cinq ateliers, chiffres et commandes. */
function CarteEtude({
  etude,
  etat,
  onOpen,
  onOuvrir,
}: {
  etude: GrcObject;
  etat: EtatEtude | undefined;
  onOpen: () => void;
  onOuvrir: (atelier: string) => void;
}) {
  const idTitre = `ris-etude-${etude.id}`;
  const objet = [texte(etude.data.scope), texte(etude.data.objective)].filter(Boolean).join(' · ');
  const debut = texte(etude.data.startAt),
    fin = texte(etude.data.endAt);
  const modifie = etat?.ateliers.find((a) => a.modifie);
  const reprendre = !!etat && etat.courant !== null;
  return (
    <article className="ris-etude" aria-labelledby={idTitre} data-etat={etat?.terminee ? 'terminee' : undefined}>
      <div className="ris-etude__tete">
        <div className="ris-etude__identite">
          <h2 id={idTitre} className="ris-etude__titre">
            {etude.name}
          </h2>
          <p className="ris-etude__objet">{objet || 'Objet de l’étude à préciser.'}</p>
          <p className="ris-etude__dates">
            {debut ? (
              <>
                Lancée le <b>{jourFr(debut)}</b>
              </>
            ) : (
              <>
                Créée le <b>{jourFr(etude.createdAt)}</b>
              </>
            )}
            {fin && (
              <>
                {' '}
                · échéance <b>{jourFr(fin)}</b>
              </>
            )}
          </p>
        </div>
        {etat && (
          <span
            className="ris-etude__avancement"
            data-etat={etat.terminee ? 'terminee' : etat.courant === 1 ? 'cadrage' : 'en-cours'}
          >
            {libelleAvancement(etat)}
          </span>
        )}
      </div>
      {etat && (
        <ol className="ris-etapes" aria-label={`Ateliers de l’étude ${etude.name}`}>
          {etat.ateliers.map((a) => (
            <li
              key={a.id}
              data-etat={a.etat}
              aria-label={`Atelier ${a.numero}, ${a.libelle} : ${
                a.etat === 'valide' ? 'validé' : a.etat === 'courant' ? 'en cours' : 'à faire'
              }${a.modifie ? ', modifié depuis sa validation' : ''}`}
            >
              <span className="ris-etapes__rond" aria-hidden="true">
                {a.etat === 'valide' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                    <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  a.numero
                )}
              </span>
              <span className="ris-etapes__libelle" aria-hidden="true">
                {a.libelle}
              </span>
            </li>
          ))}
        </ol>
      )}
      {etat && (
        <ul className="ris-etude__chiffres" aria-label={`Chiffres de l’étude ${etude.name}`}>
          <li>
            <b className="chiffres">{etat.evenements}</b>
            {etat.evenements > 1 ? 'événements redoutés' : 'événement redouté'}
          </li>
          <li>
            <b className="chiffres">{etat.couples}</b>
            {'couples SR / OV'}
          </li>
          <li>
            <b className="chiffres">{etat.scenariosStrategiques}</b>
            {etat.scenariosStrategiques > 1 ? 'scénarios stratégiques' : 'scénario stratégique'}
          </li>
          <li>
            <b className="chiffres">{etat.scenariosOperationnels}</b>
            {etat.scenariosOperationnels > 1 ? 'scénarios opérationnels' : 'scénario opérationnel'}
          </li>
        </ul>
      )}
      <div className="ris-etude__pied">
        <p className="ris-etude__suivi" data-ton={modifie ? 'alerte' : undefined}>
          {modifie
            ? `Atelier ${modifie.numero} modifié depuis sa validation`
            : etat?.derniereValidation
              ? `Atelier ${etat.derniereValidation.numero} validé le ${jourFr(etat.derniereValidation.date)}`
              : etat
                ? 'Aucun atelier validé pour l’instant'
                : ''}
          {etat && etat.risques > 0
            ? ` · ${pluriel(etat.risques, 'risque reporté au registre', 'risques reportés au registre')}`
            : ''}
        </p>
        <Button
          size="sm"
          variant="default"
          aria-label={
            reprendre
              ? `Reprendre l’atelier ${etat.courant} : ouvrir l’étude ${etude.name}`
              : `Ouvrir l’étude ${etude.name}`
          }
          onClick={() => onOuvrir(reprendre ? `a${etat.courant}` : 'a1')}
        >
          {reprendre ? 'Reprendre l’atelier' : 'Ouvrir l’étude'}
        </Button>
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="default" size="lg" radius="xl" aria-label={`Autres actions pour ${etude.name}`}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="ris-etude__plus">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={onOpen}>Fiche de l’étude</Menu.Item>
            <Menu.Item onClick={() => onOuvrir('synthese')}>Suivi, matrice et cercle</Menu.Item>
            <Menu.Item onClick={() => onOuvrir('chemins')}>Chemins</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </article>
  );
}

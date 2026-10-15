/* Plans du SMSI (reprise du Calendrier, du Planning, des plans de formation, de sensibilisation, d'audit interne et
   d'exercices de l'outil de suivi) : les données restent dans l'état historique (clé `plans`), l'écran les lit et les
   modifie sous verrou. Le planning annuel est un SVG (aucun style en ligne : CSP stricte, ADR 0006) dont les barres se
   décalent à la souris ou au clavier. */
import {
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  PLANS,
  RESULTATS_EXERCICE,
  STATUTS_PLAN,
  TYPES_ACTION_PLAN,
  actionPlanEtat,
  decalerDate,
  occurrenceRealisee,
  planStatistiques,
  plansDe,
  recurrenceOccurrences,
  type ActionPlan,
  type NiveauPlan,
  type TacheRecurrente,
  type TypePlan,
} from '@suivi/shared';
import { ConfirmButton, DataTable, StatusChip, type Etat } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';

export type VuePlans = 'calendrier' | 'planning' | TypePlan;
interface Mesure {
  id: string;
  ref: string;
  code: string;
  titre: string;
}
interface Donnees {
  version: number;
  plans: ActionPlan[];
  recurrences: TacheRecurrente[];
  annees: number[];
  indicateurs: { id: string; name: string; auto: boolean }[];
  mesures: Mesure[];
}

const ETAT: Record<NiveauPlan, Etat> = { ok: 'succes', mid: 'info', hi: 'attention', bad: 'erreur', na: 'neutre' };
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const REF_MESURES: Record<string, string> = { ISO: 'ISO 27001 (clauses)', A: 'Annexe A', HDS: 'HDS' };
const jour = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : '–');
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const estLien = (v: string) => /^https?:\/\//i.test(v);
const PLAN_DE: Record<string, { titre: string; description: string }> = {
  calendrier: {
    titre: 'Calendrier des plans',
    description:
      'Formation, sensibilisation, audit interne et exercices PRA ou de crise. Une action est « en retard » quand sa date est passée sans être réalisée.',
  },
  planning: {
    titre: 'Planning annuel des plans',
    description:
      'Diagramme annuel des actions. Glissez une barre (ou utilisez les flèches du clavier) pour décaler ses dates ; ouvrez la fiche en la sélectionnant. Le trait marque aujourd’hui, la coche la date de réalisation.',
  },
};

export function PlansSmsi({ vue }: { vue: VuePlans }) {
  const can = useCan(),
    modifier = can('pilotage', 'modifier'),
    qc = useQueryClient(),
    [annee, setAnnee] = useState(new Date().getFullYear()),
    [fiche, setFiche] = useState<string | null>(null),
    [erreur, setErreur] = useState<unknown>(null);
  const q = useQuery({ queryKey: ['plans'], queryFn: () => get<Donnees>('/api/plans') });
  const donnees = q.data;
  const rafraichir = async () => {
    await qc.invalidateQueries({ queryKey: ['plans'] });
    await qc.invalidateQueries({ queryKey: ['synthese'] });
  };
  const ajouter = async (type: TypePlan) => {
    try {
      setErreur(null);
      const p = await api<ActionPlan>('POST', '/api/plans', { body: { type } });
      await rafraichir();
      setFiche(p.id);
    } catch (e) {
      setErreur(e);
    }
  };
  const decaler = async (id: string, jours: number) => {
    try {
      setErreur(null);
      await api('POST', `/api/plans/${encodeURIComponent(id)}/decalage`, { body: { jours } });
      await rafraichir();
    } catch (e) {
      setErreur(e);
    }
  };
  const ouverte = donnees?.plans.find((p) => p.id === fiche) ?? null;
  const entete = PLAN_DE[vue] ?? {
    titre: PLANS[vue as TypePlan].plan,
    description: `Références : ${PLANS[vue as TypePlan].reference}.`,
  };
  const choixAnnee = (
    <Group gap="xs">
      <Button variant="default" aria-label="Année précédente" onClick={() => setAnnee(annee - 1)}>
        ‹
      </Button>
      <Text fw={700}>{annee}</Text>
      <Button variant="default" aria-label="Année suivante" onClick={() => setAnnee(annee + 1)}>
        ›
      </Button>
    </Group>
  );
  return (
    <Stack>
      <ErrorAlert error={q.error ?? erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>{entete.titre}</Text>
          <Text size="sm" c="dimmed">
            {entete.description}
          </Text>
        </div>
        {(vue === 'calendrier' || vue === 'planning') && choixAnnee}
        {vue !== 'calendrier' && vue !== 'planning' && modifier && (
          <Button onClick={() => void ajouter(vue)}>Ajouter</Button>
        )}
      </Group>
      {donnees && vue === 'calendrier' && <Calendrier d={donnees} annee={annee} onOuvrir={setFiche} />}
      {donnees && vue === 'planning' && (
        <Planning
          d={donnees}
          annee={annee}
          modifiable={modifier}
          onOuvrir={setFiche}
          onDecaler={decaler}
          onAjouter={ajouter}
        />
      )}
      {donnees && vue !== 'calendrier' && vue !== 'planning' && (
        <Liste d={donnees} type={vue} annee={annee} onOuvrir={setFiche} />
      )}
      <Modal
        opened={!!ouverte}
        onClose={() => setFiche(null)}
        size="xl"
        lockScroll={false}
        title={ouverte ? `${ouverte.id} — ${PLANS[ouverte.type].plan}` : ''}
      >
        {ouverte && donnees && (
          <FicheAction
            key={ouverte.id}
            action={ouverte}
            d={donnees}
            modifiable={modifier}
            onDone={() => setFiche(null)}
            onChange={rafraichir}
          />
        )}
      </Modal>
    </Stack>
  );
}

/* ------------------------------------------------------------------------------------------------ calendrier */
function Calendrier({ d, annee, onOuvrir }: { d: Donnees; annee: number; onOuvrir: (id: string) => void }) {
  const jourJ = aujourdhui();
  const toutes = plansDe(d.plans, null, annee).filter((p) => p.status !== 'Annulé');
  const enRetard = planStatistiques(d.plans, null, annee, jourJ).enRetard;
  const actives = d.recurrences.filter((r) => r.active);
  const mois = (date: string) => Number(date.slice(5, 7)) - 1;
  return (
    <Stack>
      <Group>
        {[
          [toutes.length, 'actions planifiées'],
          [toutes.filter((p) => p.status === 'Réalisé').length, 'réalisées'],
          [enRetard, 'en retard'],
          [
            toutes.filter((p) => p.status !== 'Réalisé' && actionPlanEtat(p, jourJ)[0] !== 'En retard').length,
            'à venir',
          ],
        ].map(([n, l]) => (
          <Card key={String(l)} withBorder padding="xs">
            <Text fw={700} size="lg">
              {n}
            </Text>
            <Text size="xs" c="dimmed">
              {l}
            </Text>
          </Card>
        ))}
      </Group>
      <DataTable label={`Calendrier des plans ${annee}`}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Plan</Table.Th>
              {MOIS.map((m) => (
                <Table.Th key={m}>{m}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {TYPES_ACTION_PLAN.map((type) => {
              const liste = plansDe(d.plans, type, annee);
              const s = planStatistiques(d.plans, type, annee, jourJ);
              return (
                <Table.Tr key={type}>
                  <Table.Td>
                    <Text fw={600} size="sm">
                      {PLANS[type].plan}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {s.realises}/{s.total} réalisé(s){s.enRetard ? `, ${s.enRetard} en retard` : ''}
                    </Text>
                  </Table.Td>
                  {MOIS.map((m, i) => (
                    <Table.Td key={m} className="plan-cellule">
                      {liste
                        .filter((p) => (p.start || p.done) && mois(p.start || p.done) === i)
                        .map((p) => {
                          const [libelle, niveau] = actionPlanEtat(p, jourJ);
                          return (
                            <Button
                              key={p.id}
                              size="compact-xs"
                              variant="light"
                              className={`plan-pastille plan-pastille-${niveau}`}
                              title={`${p.title || '(sans titre)'} — ${libelle}`}
                              onClick={() => onOuvrir(p.id)}
                            >
                              {p.title || '(sans titre)'}
                            </Button>
                          );
                        })}
                    </Table.Td>
                  ))}
                </Table.Tr>
              );
            })}
            {actives.length > 0 && (
              <Table.Tr>
                <Table.Td>
                  <Text fw={600} size="sm">
                    Tâches récurrentes
                  </Text>
                  <Text size="xs" c="dimmed">
                    {actives.length} tâche(s) active(s)
                  </Text>
                </Table.Td>
                {MOIS.map((m, i) => (
                  <Table.Td key={m} className="plan-cellule">
                    {actives.flatMap((r) =>
                      recurrenceOccurrences(r, annee, jourJ)
                        .filter((o) => mois(o) === i)
                        .map((o) => {
                          const faite = occurrenceRealisee(r, o);
                          const niveau = faite ? 'ok' : o < jourJ ? 'bad' : 'na';
                          return (
                            <span
                              key={r.id + o}
                              className={`plan-pastille plan-pastille-${niveau}`}
                              title={`${r.title} — ${jour(o)}${faite ? ' — réalisée' : o < jourJ ? ' — non réalisée' : ''}`}
                            >
                              {r.title}
                            </span>
                          );
                        }),
                    )}
                  </Table.Td>
                ))}
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </DataTable>
    </Stack>
  );
}

/* ------------------------------------------------------------------------------------------------ liste d'un plan */
const COLONNES: Record<TypePlan, { titre: string; valeur: (p: ActionPlan) => string }[]> = {
  formation: [
    { titre: 'Modalité', valeur: (p) => p.kind },
    { titre: 'Participants (présents / prévus)', valeur: (p) => `${p.attended || '–'} / ${p.planned || '–'}` },
  ],
  sensi: [
    { titre: 'Campagne', valeur: (p) => p.kind },
    { titre: 'Plateforme', valeur: (p) => p.provider },
    { titre: 'Participation', valeur: (p) => (p.participation ? `${p.participation} %` : '–') },
    { titre: 'Réussite', valeur: (p) => (p.success ? `${p.success} %` : '–') },
  ],
  audit: [
    { titre: 'Type', valeur: (p) => p.kind },
    { titre: 'Périmètre', valeur: (p) => p.scope },
    { titre: 'Mesures', valeur: (p) => String(p.items.length) },
    { titre: 'Auditeur', valeur: (p) => p.auditor },
  ],
  exo: [
    { titre: 'Type', valeur: (p) => p.kind },
    { titre: 'Périmètre ou SI', valeur: (p) => p.systems },
    { titre: 'Résultat', valeur: (p) => p.result || '–' },
  ],
};
function Liste({
  d,
  type,
  annee,
  onOuvrir,
}: {
  d: Donnees;
  type: TypePlan;
  annee: number;
  onOuvrir: (id: string) => void;
}) {
  const jourJ = aujourdhui();
  const liste = d.plans.filter((p) => p.type === type).sort((a, b) => (a.start || '9').localeCompare(b.start || '9'));
  const s = planStatistiques(d.plans, type, annee, jourJ);
  return (
    <Stack>
      <Group>
        <Card withBorder padding="xs">
          <Text fw={700} size="lg">
            {s.realises}/{s.total}
          </Text>
          <Text size="xs" c="dimmed">
            réalisé(s) en {annee}
          </Text>
        </Card>
        <Card withBorder padding="xs">
          <Text fw={700} size="lg">
            {s.enRetard}
          </Text>
          <Text size="xs" c="dimmed">
            en retard
          </Text>
        </Card>
        <Card withBorder padding="xs">
          <Text fw={700} size="lg">
            {liste.length}
          </Text>
          <Text size="xs" c="dimmed">
            au total
          </Text>
        </Card>
      </Group>
      {!liste.length && <Text size="sm">Aucune action dans ce plan.</Text>}
      {!!liste.length && (
        <DataTable label={PLANS[type].plan}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Réf.</Table.Th>
                <Table.Th>Intitulé</Table.Th>
                <Table.Th>Date prévue</Table.Th>
                <Table.Th>Réalisé le</Table.Th>
                <Table.Th>État</Table.Th>
                <Table.Th className="col-p2">Responsable</Table.Th>
                {COLONNES[type].map((c) => (
                  <Table.Th key={c.titre} className="col-p3">
                    {c.titre}
                  </Table.Th>
                ))}
                <Table.Th className="col-p3">Preuve</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {liste.map((p) => {
                const [libelle, niveau] = actionPlanEtat(p, jourJ);
                return (
                  <Table.Tr key={p.id}>
                    <Table.Td>
                      <Anchor component="button" type="button" onClick={() => onOuvrir(p.id)}>
                        {p.id}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>
                      {p.title || '(sans titre)'}
                      {p.audience && (
                        <Text size="xs" c="dimmed">
                          {p.audience}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {jour(p.start)}
                      {p.end && p.end !== p.start && (
                        <Text size="xs" c="dimmed">
                          au {jour(p.end)}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>{jour(p.done)}</Table.Td>
                    <Table.Td>
                      <StatusChip etat={ETAT[niveau]}>{libelle}</StatusChip>
                    </Table.Td>
                    <Table.Td className="col-p2">{p.owner || '–'}</Table.Td>
                    {COLONNES[type].map((c) => (
                      <Table.Td key={c.titre} className="col-p3">
                        {c.valeur(p) || '–'}
                      </Table.Td>
                    ))}
                    <Table.Td className="col-p3">
                      {estLien(p.proof) ? (
                        <Anchor href={p.proof} target="_blank" rel="noopener noreferrer">
                          Preuve
                        </Anchor>
                      ) : (
                        p.proof || ''
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------------------------------------ planning (SVG) */
const LARGEUR = 1000,
  GAUCHE = 250,
  HAUTEUR_LIGNE = 28,
  ENTETE = 30;
const LONGUEUR = LARGEUR - GAUCHE;
const TEINTE: Record<NiveauPlan, string> = { ok: 'ok', mid: 'mid', hi: 'hi', bad: 'bad', na: 'na' };

function Planning({
  d,
  annee,
  modifiable,
  onOuvrir,
  onDecaler,
  onAjouter,
}: {
  d: Donnees;
  annee: number;
  modifiable: boolean;
  onOuvrir: (id: string) => void;
  onDecaler: (id: string, jours: number) => Promise<void>;
  onAjouter: (type: TypePlan) => Promise<void>;
}) {
  const [filtre, setFiltre] = useState<string>('all');
  const [glisse, setGlisse] = useState<{ id: string; depart: number; dx: number; largeurPx: number } | null>(null);
  const jourJ = aujourdhui();
  const debut = Date.UTC(annee, 0, 1),
    fin = Date.UTC(annee + 1, 0, 1);
  const jours = (fin - debut) / 864e5;
  const echelle = LONGUEUR / jours;
  const position = (date: string) => ((Date.parse(date.slice(0, 10) + 'T00:00:00Z') - debut) / 864e5) * echelle;
  const bornees = (v: number) => Math.max(0, Math.min(LONGUEUR, v));
  const groupes = TYPES_ACTION_PLAN.filter((t) => filtre === 'all' || filtre === t).map((type) => ({
    type,
    actions: d.plans
      .filter((p) => p.type === type && p.status !== 'Annulé')
      .filter((p) => {
        const a = p.start || p.done,
          b = p.end || p.start || p.done;
        return a && b && Date.parse(b) >= debut && Date.parse(a) < fin;
      })
      .sort((a, b) => a.start.localeCompare(b.start)),
  }));
  let ligne = 0;
  const lignes = groupes.map((g) => ({ ...g, ligneDebut: (ligne += 1), lignes: (ligne += g.actions.length || 1) }));
  const hauteur = ENTETE + ligne * HAUTEUR_LIGNE + 10;
  const jourDansAnnee = jourJ >= `${annee}-01-01` && jourJ < `${annee + 1}-01-01`;
  const terminer = (p: ActionPlan, dx: number) => {
    const delta = Math.round(dx / echelle);
    if (delta) void onDecaler(p.id, delta);
  };
  return (
    <Stack>
      <Group justify="space-between">
        <Select
          label="Plan affiché"
          allowDeselect={false}
          value={filtre}
          onChange={(v) => setFiltre(v ?? 'all')}
          data={[
            { value: 'all', label: 'Tous les plans' },
            ...TYPES_ACTION_PLAN.map((t) => ({ value: t, label: PLANS[t].libelle })),
          ]}
        />
        <Group gap="md" component="ul" className="plan-legende">
          {(
            [
              ['na', 'Planifié'],
              ['mid', 'En préparation'],
              ['ok', 'Réalisé'],
              ['hi', 'Reporté'],
              ['bad', 'En retard'],
            ] as const
          ).map(([n, l]) => (
            <li key={n}>
              <span className={`plan-pastille-pt plan-barre-${n}`} aria-hidden="true" />
              {l}
            </li>
          ))}
        </Group>
      </Group>
      <div className="plan-planning">
        <svg
          viewBox={`0 0 ${LARGEUR} ${hauteur}`}
          role="group"
          aria-label={`Planning des plans ${annee}`}
          className="plan-svg"
        >
          {MOIS.map((m, i) => {
            const x = GAUCHE + position(`${annee}-${String(i + 1).padStart(2, '0')}-01`);
            return (
              <g key={m}>
                <line x1={x} x2={x} y1={ENTETE - 6} y2={hauteur} className="plan-grille" />
                <text x={x + 4} y={ENTETE - 12} className="plan-mois">
                  {m}
                </text>
              </g>
            );
          })}
          {jourDansAnnee && (
            <line
              x1={GAUCHE + position(jourJ)}
              x2={GAUCHE + position(jourJ)}
              y1={ENTETE - 6}
              y2={hauteur}
              className="plan-aujourdhui"
            >
              <title>Aujourd’hui</title>
            </line>
          )}
          {lignes.map((g) => {
            const s = planStatistiques(d.plans, g.type, annee, jourJ);
            const y0 = ENTETE + (g.ligneDebut - 1) * HAUTEUR_LIGNE;
            return (
              <g key={g.type}>
                <text x={4} y={y0 + 18} className="plan-groupe">
                  {PLANS[g.type].plan} — {s.realises}/{s.total} réalisé(s)
                  {s.enRetard ? `, ${s.enRetard} en retard` : ''}
                </text>
                {g.actions.length === 0 && (
                  <text x={GAUCHE + 6} y={y0 + HAUTEUR_LIGNE + 18} className="plan-vide">
                    Aucune action sur l’année.
                  </text>
                )}
                {g.actions.map((p, i) => {
                  const y = y0 + (i + 1) * HAUTEUR_LIGNE;
                  const [libelle, niveau] = actionPlanEtat(p, jourJ);
                  const a = p.start || p.done,
                    b = p.end || p.start || p.done;
                  const xa = bornees(position(a)),
                    xb = bornees(position(decalerDate(b, 1)));
                  const largeur = Math.max(6, xb - xa);
                  const dx = glisse?.id === p.id ? glisse.dx : 0;
                  const titre = `${p.title || '(sans titre)'} — ${libelle} — ${jour(p.start)}${p.end && p.end !== p.start ? ' au ' + jour(p.end) : ''}${p.done ? ' — réalisé le ' + jour(p.done) : ''}`;
                  return (
                    <g key={p.id}>
                      <text x={4} y={y + 18} className="plan-etiquette">
                        {p.id} {p.title || '(sans titre)'}
                      </text>
                      <rect
                        x={GAUCHE + xa + dx}
                        y={y + 4}
                        width={largeur}
                        height={HAUTEUR_LIGNE - 10}
                        rx={3}
                        className={`plan-barre plan-barre-${TEINTE[niveau]}${glisse?.id === p.id ? ' plan-barre-deplacee' : ''}`}
                        tabIndex={0}
                        role="button"
                        aria-label={`${titre}. Entrée : ouvrir la fiche.${modifiable ? ' Flèches gauche et droite : décaler d’un jour ; avec Maj, de sept jours.' : ''}`}
                        onPointerDown={(e) => {
                          if (!modifiable || !p.start) return;
                          const largeurPx = e.currentTarget.ownerSVGElement?.getBoundingClientRect().width ?? LARGEUR;
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setGlisse({ id: p.id, depart: e.clientX, dx: 0, largeurPx });
                        }}
                        onPointerMove={(e) => {
                          if (glisse?.id === p.id)
                            setGlisse({ ...glisse, dx: ((e.clientX - glisse.depart) * LARGEUR) / glisse.largeurPx });
                        }}
                        onPointerUp={() => {
                          const g2 = glisse;
                          setGlisse(null);
                          if (g2?.id !== p.id) return;
                          if (Math.abs((g2.dx * g2.largeurPx) / LARGEUR) < 4) onOuvrir(p.id);
                          else terminer(p, g2.dx);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOuvrir(p.id);
                          } else if (modifiable && p.start && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                            e.preventDefault();
                            void onDecaler(p.id, (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 7 : 1));
                          }
                        }}
                      >
                        <title>{titre}</title>
                      </rect>
                      {p.done && Date.parse(p.done) >= debut && Date.parse(p.done) < fin && (
                        <text x={GAUCHE + position(p.done)} y={y + 19} className="plan-realise">
                          ✓<title>{`Réalisé le ${jour(p.done)}`}</title>
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      {modifiable && (
        <Group>
          {TYPES_ACTION_PLAN.filter((t) => filtre === 'all' || filtre === t).map((t) => (
            <Button key={t} variant="default" onClick={() => void onAjouter(t)}>
              Ajouter : {PLANS[t].libelle.toLowerCase()}
            </Button>
          ))}
        </Group>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------------------------------------ fiche d'une action */
type Champs = Omit<ActionPlan, 'id' | 'type' | 'createdAt' | 'pushedAt' | 'findings'>;
const MODIFIABLES: (keyof Champs)[] = [
  'title',
  'kind',
  'start',
  'end',
  'done',
  'status',
  'owner',
  'provider',
  'audience',
  'notes',
  'proof',
  'planned',
  'attended',
  'duration',
  'participation',
  'success',
  'indicator',
  'items',
  'scope',
  'auditor',
  'scenario',
  'systems',
  'objectives',
  'result',
  'retex',
];

function FicheAction({
  action,
  d,
  modifiable,
  onDone,
  onChange,
}: {
  action: ActionPlan;
  d: Donnees;
  modifiable: boolean;
  onDone: () => void;
  onChange: () => Promise<void>;
}) {
  const def = PLANS[action.type];
  const initial = Object.fromEntries(MODIFIABLES.map((k) => [k, action[k]])) as Champs;
  const [v, setV] = useState<Champs>(initial);
  const [erreur, setErreur] = useState<unknown>(null);
  const [info, setInfo] = useState('');
  const [occupe, setOccupe] = useState(false);
  const modifie = MODIFIABLES.filter((k) => JSON.stringify(v[k]) !== JSON.stringify(initial[k]));
  const regler = <K extends keyof Champs>(k: K, valeur: Champs[K]) => setV((x) => ({ ...x, [k]: valeur }));
  const texte = (k: keyof Champs, label: string, o: { type?: string; area?: boolean; placeholder?: string } = {}) =>
    o.area ? (
      <Textarea
        label={label}
        autosize
        minRows={2}
        disabled={!modifiable}
        value={v[k] as string}
        placeholder={o.placeholder}
        onChange={(e) => regler(k, e.currentTarget.value as never)}
      />
    ) : (
      <TextInput
        label={label}
        type={o.type}
        disabled={!modifiable}
        value={v[k] as string}
        placeholder={o.placeholder}
        onChange={(e) => regler(k, e.currentTarget.value as never)}
      />
    );
  const lancer = async (fn: () => Promise<string | void>) => {
    try {
      setErreur(null);
      setInfo('');
      setOccupe(true);
      const message = await fn();
      await onChange();
      if (message) setInfo(message);
    } catch (e) {
      setErreur(e);
    } finally {
      setOccupe(false);
    }
  };
  const enregistrer = () =>
    lancer(async () => {
      const corps = Object.fromEntries(modifie.map((k) => [k, v[k]]));
      await api('PATCH', `/api/plans/${encodeURIComponent(action.id)}`, { body: corps });
      return 'Modifications enregistrées.';
    });
  const changerStatut = (statut: string | null) => {
    if (!statut) return;
    setV((x) => ({ ...x, status: statut, done: statut === 'Réalisé' && !x.done ? aujourdhui() : x.done }));
  };
  const [libelle, niveau] = actionPlanEtat({ status: v.status, start: v.start, end: v.end }, aujourdhui());
  const action_ = (url: string, texteOk: (r: never) => string) => () =>
    lancer(async () => texteOk((await api('POST', `/api/plans/${encodeURIComponent(action.id)}/${url}`)) as never));
  const enregistre = modifie.length === 0;
  const sensi = d.indicateurs;
  const mesures = (['ISO', 'A', 'HDS'] as const).map((ref) => ({
    group: REF_MESURES[ref]!,
    items: d.mesures.filter((m) => m.ref === ref).map((m) => ({ value: m.id, label: `${m.code} ${m.titre}` })),
  }));
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      {info && <Alert color="green">{info}</Alert>}
      <Group>
        <StatusChip etat={ETAT[niveau]}>{libelle}</StatusChip>
        <Text size="xs" c="dimmed">
          Références : {def.reference}
        </Text>
      </Group>
      {texte('title', 'Intitulé de l’action')}
      <div className="grille-formulaire">
        <div className="grille-formulaire__champs">
          {texte('start', 'Date prévue', { type: 'date' })}
          {texte('end', 'Date de fin (facultatif)', { type: 'date' })}
          <Select
            label="Statut"
            allowDeselect={false}
            disabled={!modifiable}
            data={[...STATUTS_PLAN]}
            value={v.status || 'Planifié'}
            onChange={changerStatut}
          />
          {texte('done', 'Réalisé le', { type: 'date' })}
          {texte('owner', 'Responsable')}
          {texte('provider', action.type === 'sensi' ? 'Plateforme ou prestataire' : 'Prestataire ou organisme')}
          {texte('audience', 'Public ou population cible')}
          <Select
            label={def.libelleGenre}
            allowDeselect={false}
            disabled={!modifiable}
            data={[...new Set([...def.genres, ...(v.kind ? [v.kind] : [])])]}
            value={v.kind || def.genres[0]}
            onChange={(x) => x && regler('kind', x)}
          />
          {action.type === 'formation' && (
            <>
              {texte('duration', 'Durée (heures)')}
              {texte('planned', 'Participants prévus')}
              {texte('attended', 'Participants présents')}
            </>
          )}
          {action.type === 'sensi' && (
            <>
              {texte('participation', 'Taux de participation (%)')}
              {texte('success', 'Taux de réussite (%)')}
              <Select
                label="Indicateur alimenté"
                clearable
                disabled={!modifiable}
                data={sensi.map((i) => ({ value: i.id, label: `${i.id} — ${i.name}${i.auto ? ' (calculé)' : ''}` }))}
                value={v.indicator || null}
                onChange={(x) => regler('indicator', x ?? '')}
              />
            </>
          )}
          {action.type === 'audit' && (
            <>
              {texte('scope', 'Périmètre ou thème')}
              {texte('auditor', 'Auditeur (interne ou cabinet)')}
            </>
          )}
          {action.type === 'exo' && (
            <>
              {texte('systems', 'Périmètre ou SI concernés')}
              <Select
                label="Résultat"
                clearable
                disabled={!modifiable}
                data={[...RESULTATS_EXERCICE]}
                value={v.result || null}
                onChange={(x) => regler('result', (x ?? '') as never)}
              />
            </>
          )}
        </div>
      </div>
      {action.type === 'exo' && (
        <>
          {texte('scenario', 'Scénario', { area: true })}
          {texte('objectives', 'Objectifs (ex. RTO, RPO)', { area: true })}
          {texte('retex', 'Retour d’expérience (RETEX)', { area: true })}
        </>
      )}
      {action.type === 'audit' && (
        <MultiSelect
          label={`Mesures auditées (${v.items.length})`}
          searchable
          clearable
          disabled={!modifiable}
          data={mesures}
          value={v.items}
          onChange={(x) => regler('items', x)}
          nothingFoundMessage="Aucune mesure"
        />
      )}
      {texte('proof', 'Preuve (lien : attestation, rapport, compte rendu)', { placeholder: 'https://…' })}
      {estLien(v.proof) && (
        <Anchor href={v.proof} target="_blank" rel="noopener noreferrer">
          Ouvrir la preuve
        </Anchor>
      )}
      {texte('notes', 'Notes', { area: true })}
      {action.type === 'audit' && (
        <Group>
          <Button
            variant="default"
            disabled={!modifiable || occupe || !enregistre || action.status !== 'Réalisé'}
            title={action.status !== 'Réalisé' ? 'Disponible quand l’audit est réalisé' : undefined}
            onClick={action_(
              'couverture',
              (r: { marquees: number }) =>
                `${r.marquees} mesure(s) marquée(s) « auditée en interne ${(action.done || action.start).slice(0, 4)} ».`,
            )}
          >
            Reporter dans la couverture du cycle (audit interne {(action.done || action.start).slice(0, 4)})
          </Button>
        </Group>
      )}
      {action.type === 'sensi' && action.status === 'Réalisé' && action.indicator && (
        <Group>
          <Button
            variant="default"
            disabled={!modifiable || occupe || !enregistre}
            onClick={action_('indicateur', () => `Valeur enregistrée dans ${action.indicator}.`)}
          >
            Enregistrer le taux dans {action.indicator}
          </Button>
          {action.pushedAt && (
            <Text size="xs" c="dimmed">
              Déjà enregistré le {jour(action.pushedAt.slice(0, 10))}
            </Text>
          )}
        </Group>
      )}
      {action.type === 'exo' && (
        <Group>
          <Button
            variant="default"
            disabled={!modifiable || occupe || !enregistre}
            onClick={action_('ecart', (r: { ecart: string }) => `Action ${r.ecart} créée dans le registre des écarts.`)}
          >
            Créer une action dans le registre des écarts
          </Button>
          {action.findings.length > 0 && (
            <Text size="xs" c="dimmed">
              Actions créées : {action.findings.join(', ')}
            </Text>
          )}
        </Group>
      )}
      {!enregistre && modifiable && (
        <Text size="xs" c="dimmed">
          Enregistrez d’abord vos modifications pour utiliser les actions ci-dessus.
        </Text>
      )}
      <Group justify="space-between">
        {modifiable ? (
          <ConfirmButton
            message={`Supprimer ${action.id} ? Cette action disparaîtra aussi de l’outil historique.`}
            onConfirm={() =>
              lancer(async () => {
                await api('DELETE', `/api/plans/${encodeURIComponent(action.id)}`);
                onDone();
              })
            }
            variant="light"
          >
            Supprimer
          </ConfirmButton>
        ) : (
          <span />
        )}
        <Group>
          <Button variant="default" onClick={onDone}>
            Fermer
          </Button>
          {modifiable && (
            <Button disabled={enregistre || occupe} onClick={() => void enregistrer()}>
              Enregistrer
            </Button>
          )}
        </Group>
      </Group>
    </Stack>
  );
}

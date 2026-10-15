/* Organisation de l'audit (reprise de « Déroulé », « Planning » et « Participants ») : jours, créneaux, personnes,
   mesures abordées, preuves à préparer et questions probables. Les données restent dans le plan d'audit de l'état
   historique. Le planning est un SVG (aucun style en ligne : CSP stricte, ADR 0006). */
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useState } from 'react';
import {
  PLAN_STATUSES,
  SLOT_KINDS,
  SLOT_KIND_LABELS,
  guideDe,
  itemCode,
  planCoverage,
  slotFindings,
  worstLevel,
  type Analysis,
  type AuditPlan,
  type AuditPlanSlot,
} from '@suivi/shared/audit';
import { ConfirmButton, DataTable } from '@suivi/ui';
import { Table } from '@mantine/core';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { heureFr, jourFr, minutes, useActionAudit, useAudit, type DonneesAudit } from './commun';

export type VueOrganisation = 'deroule' | 'planning' | 'participants';
const duree = (min: number) => (min ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : '–');
const jourLong = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '';

export function Organisation({ vue }: { vue: VueOrganisation }) {
  const { q, d, analyses } = useAudit();
  const can = useCan(),
    modifiable = can('plan_audit', 'modifier'),
    agir = useActionAudit(),
    [erreur, setErreur] = useState<unknown>(null),
    [recherche, setRecherche] = useState(''),
    [creneau, setCreneau] = useState<string | null>(null);
  if (!d) return <ErrorAlert error={q.error} />;
  if (!d.plan) return <Text>Vous ne disposez pas du droit de consulter l’organisation de l’audit.</Text>;
  const plan = d.plan;
  const couverture = planCoverage(d.items, plan.slots, analyses);
  const lancer = (methode: string, url: string, corps?: unknown) => {
    setErreur(null);
    return agir(methode, url, corps).catch((e) => {
      setErreur(e);
      throw e;
    });
  };
  const ajouterCreneau = async (day?: string) => {
    try {
      const s = (await lancer('POST', '/plan/creneaux', day ? { day } : {})) as { id: string };
      setCreneau(s.id);
    } catch {
      /* erreur affichée */
    }
  };
  const ouvert = plan.slots.find((s) => s.id === creneau) ?? null;
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Organisation de l’audit {d.nextYear}</Text>
          <TextInput
            label="Note"
            disabled={!modifiable}
            defaultValue={plan.note}
            onBlur={(e) => {
              if (e.currentTarget.value !== plan.note) void lancer('PATCH', '/plan', { note: e.currentTarget.value });
            }}
          />
        </div>
        <Select
          label="État du plan"
          allowDeselect={false}
          disabled={!modifiable}
          data={[...PLAN_STATUSES]}
          value={plan.status}
          onChange={(v) => v && void lancer('PATCH', '/plan', { status: v })}
        />
      </Group>
      {d.items.length > 0 &&
        (couverture.miss.length ? (
          <Alert
            color="red"
            title={`${couverture.miss.length} mesure${couverture.miss.length > 1 ? 's' : ''} ciblée${couverture.miss.length > 1 ? 's' : ''} sans créneau`}
          >
            Placez-les dans le plan pour que l’auditeur trouve un interlocuteur préparé :{' '}
            {couverture.miss.map((i) => itemCode(i)).join(', ')}.
          </Alert>
        ) : (
          <Alert color="green">
            Les {couverture.targets.length} mesures ciblées ont toutes un créneau (certaines, très probables et
            systématiques).{' '}
            {d.items.length - couverture.placed.size
              ? `${d.items.length - couverture.placed.size} autres mesures restent hors plan.`
              : 'Toutes les mesures du référentiel sont placées.'}
          </Alert>
        ))}
      {modifiable && (
        <Group justify="flex-end">
          {vue === 'participants' ? (
            <Button variant="default" onClick={() => void lancer('POST', '/plan/personnes', {})}>
              Ajouter une personne
            </Button>
          ) : (
            <>
              <Button variant="default" onClick={() => void lancer('POST', '/plan/jours', {})}>
                Ajouter un jour
              </Button>
              <Button onClick={() => void ajouterCreneau()} disabled={!plan.days.length}>
                Ajouter un créneau
              </Button>
            </>
          )}
        </Group>
      )}
      {vue === 'deroule' && (
        <Deroule
          d={d}
          plan={plan}
          analyses={analyses}
          modifiable={modifiable}
          recherche={recherche}
          onRecherche={setRecherche}
          onOuvrir={setCreneau}
          onAjouter={ajouterCreneau}
          lancer={lancer}
        />
      )}
      {vue === 'planning' && <Planning plan={plan} analyses={analyses} onOuvrir={setCreneau} />}
      {vue === 'participants' && (
        <Participants plan={plan} modifiable={modifiable} onOuvrir={setCreneau} lancer={lancer} />
      )}
      <Modal
        opened={!!ouvert}
        onClose={() => setCreneau(null)}
        size="xl"
        lockScroll={false}
        title={ouvert ? `${jourLibelle(plan, ouvert)} ${heureFr(ouvert.start)}` : ''}
      >
        {ouvert && (
          <FicheCreneau
            key={ouvert.id}
            d={d}
            plan={plan}
            s={ouvert}
            modifiable={modifiable}
            onDone={() => setCreneau(null)}
            lancer={lancer}
          />
        )}
      </Modal>
    </Stack>
  );
}

const jourLibelle = (plan: AuditPlan, s: AuditPlanSlot) => plan.days.find((x) => x.id === s.day)?.label ?? '';
const duJour = (plan: AuditPlan, jour: string) =>
  plan.slots.filter((s) => s.day === jour).sort((a, b) => minutes(a.start) - minutes(b.start));

/* ------------------------------------------------------------------------------------------------ déroulé */
type Lancer = (methode: string, url: string, corps?: unknown) => Promise<unknown>;
function Deroule({
  d,
  plan,
  analyses,
  modifiable,
  recherche,
  onRecherche,
  onOuvrir,
  onAjouter,
  lancer,
}: {
  d: DonneesAudit;
  plan: AuditPlan;
  analyses: Record<string, Analysis>;
  modifiable: boolean;
  recherche: string;
  onRecherche: (v: string) => void;
  onOuvrir: (id: string) => void;
  onAjouter: (day?: string) => Promise<void>;
  lancer: Lancer;
}) {
  const terme = recherche.trim().toLowerCase();
  const correspond = (s: AuditPlanSlot) =>
    !terme ||
    [
      s.title,
      s.detail,
      s.place,
      SLOT_KIND_LABELS[s.type as keyof typeof SLOT_KIND_LABELS] ?? '',
      ...s.items.map((id) => {
        const it = d.items.find((x) => x.id === id);
        return it ? `${itemCode(it)} ${it.title}` : '';
      }),
      ...s.people.map((p) => {
        const x = plan.people.find((y) => y.id === p);
        return x ? `${x.name} ${x.role}` : '';
      }),
    ]
      .join(' ')
      .toLowerCase()
      .includes(terme);
  if (!plan.days.length) return <Text size="sm">Aucun jour d’audit : ajoutez un jour pour commencer.</Text>;
  return (
    <Stack>
      <TextInput label="Rechercher un créneau" value={recherche} onChange={(e) => onRecherche(e.currentTarget.value)} />
      {plan.days.map((j) => {
        const creneaux = duJour(plan, j.id).filter(correspond);
        if (terme && !creneaux.length) return null;
        return (
          <section key={j.id} aria-label={j.label}>
            <Group justify="space-between" align="flex-end">
              <Group align="flex-end">
                <Text fw={600}>{j.label}</Text>
                <TextInput
                  aria-label={`Date du ${j.label}`}
                  type="date"
                  disabled={!modifiable}
                  defaultValue={j.date}
                  onBlur={(e) => {
                    if (e.currentTarget.value !== j.date)
                      void lancer('PATCH', `/plan/jours/${j.id}`, { date: e.currentTarget.value });
                  }}
                />
                <Text size="sm" c="dimmed">
                  {jourLong(j.date)}
                </Text>
              </Group>
              {modifiable && !duJour(plan, j.id).length && (
                <Button variant="subtle" onClick={() => void lancer('DELETE', `/plan/jours/${j.id}`)}>
                  Supprimer ce jour
                </Button>
              )}
            </Group>
            {!creneaux.length && (
              <Text size="sm">
                Aucun créneau.{' '}
                {modifiable && (
                  <Anchor component="button" type="button" onClick={() => void onAjouter(j.id)}>
                    Ajouter un créneau
                  </Anchor>
                )}
              </Text>
            )}
            <Stack gap="xs">
              {creneaux.map((s) => (
                <LigneCreneau key={s.id} d={d} plan={plan} s={s} analyses={analyses} onOuvrir={onOuvrir} />
              ))}
            </Stack>
          </section>
        );
      })}
    </Stack>
  );
}

function LigneCreneau({
  d,
  plan,
  s,
  analyses,
  onOuvrir,
}: {
  d: DonneesAudit;
  plan: AuditPlan;
  s: AuditPlanSlot;
  analyses: Record<string, Analysis>;
  onOuvrir: (id: string) => void;
}) {
  const niveau = worstLevel(s, analyses);
  const ecarts = slotFindings(d.findings, s);
  const nc = ecarts.filter((f) => f.type.startsWith('NC')).length,
    ps = ecarts.filter((f) => f.type === 'PS').length;
  const faites = s.proofs.filter((p) => p.done).length;
  const exigences = s.items
    .map((id) => d.items.find((x) => x.id === id))
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => d.items.indexOf(a) - d.items.indexOf(b));
  const type = SLOT_KIND_LABELS[s.type as keyof typeof SLOT_KIND_LABELS] ?? '';
  return (
    <button type="button" className={`audit-creneau audit-creneau-${s.type}`} onClick={() => onOuvrir(s.id)}>
      <span className="audit-creneau-heure">
        {heureFr(s.start)}
        <span>{heureFr(s.end)}</span>
      </span>
      <span className={`audit-rail ${niveau ? `audit-niv-${niveau}` : ''}`} aria-hidden="true" />
      <span className="audit-creneau-corps">
        <span className="audit-creneau-genre">
          {type}
          {s.place ? `, ${s.place}` : ''}, {minutes(s.end) - minutes(s.start)} min
        </span>
        <b>{s.type === 'pause' ? s.title || 'Pause' : s.title}</b>
        {s.type !== 'pause' && exigences.length > 0 && (
          <span className="audit-tuiles">
            {exigences.slice(0, 14).map((i) => (
              <span key={i.id} className={`audit-tuile audit-niv-${analyses[i.id]?.level ?? 'faible'}`}>
                {itemCode(i)}
              </span>
            ))}
            {exigences.length > 14 && <span className="audit-tuile">+{exigences.length - 14}</span>}
          </span>
        )}
        {(nc > 0 || ps > 0) && (
          <span className="audit-creneau-ecarts">
            {nc ? `${nc} NC ` : ''}
            {ps ? `${ps} PS ` : ''}ouverts à présenter
          </span>
        )}
      </span>
      {s.type !== 'pause' && (
        <span className="audit-creneau-cote">
          {s.people.length ? (
            s.people.map((p) => <span key={p}>{plan.people.find((x) => x.id === p)?.name}</span>)
          ) : s.type !== 'synthese' ? (
            <span className="audit-alerte">Aucun participant</span>
          ) : null}
          {s.proofs.length > 0 && (
            <span>
              Preuves {faites}/{s.proofs.length}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------------------------------------ planning (SVG) */
const ECHELLE = 1.3,
  COLONNE = 220,
  AXE = 48,
  ENTETE_J = 38;
function Planning({
  plan,
  analyses,
  onOuvrir,
}: {
  plan: AuditPlan;
  analyses: Record<string, Analysis>;
  onOuvrir: (id: string) => void;
}) {
  if (!plan.slots.length) return <Text size="sm">Aucun créneau.</Text>;
  const debut = Math.floor(Math.min(...plan.slots.map((s) => minutes(s.start))) / 60) * 60,
    fin = Math.ceil(Math.max(...plan.slots.map((s) => minutes(s.end))) / 60) * 60;
  const hauteur = (fin - debut) * ECHELLE;
  // Largeur de référence 1000 : avec peu de jours les colonnes s'élargissent, la taille du texte reste constante.
  const colonne = Math.max(COLONNE, Math.floor((1000 - AXE) / Math.max(plan.days.length, 1)));
  const largeur = AXE + plan.days.length * colonne;
  const heures: number[] = [];
  for (let m = debut + 60; m < fin; m += 60) heures.push(m);
  return (
    <Stack>
      <div className="plan-planning">
        <svg
          viewBox={`0 0 ${largeur} ${hauteur + ENTETE_J}`}
          role="group"
          aria-label="Planning de l’audit"
          className="plan-svg audit-calendrier"
        >
          {heures.map((m) => (
            <g key={m}>
              <line
                x1={AXE}
                x2={largeur}
                y1={ENTETE_J + (m - debut) * ECHELLE}
                y2={ENTETE_J + (m - debut) * ECHELLE}
                className="plan-grille"
              />
              <text x={AXE - 6} y={ENTETE_J + (m - debut) * ECHELLE + 4} textAnchor="end" className="plan-mois">
                {m / 60}h
              </text>
            </g>
          ))}
          {plan.days.map((j, k) => {
            const x0 = AXE + k * colonne;
            return (
              <g key={j.id}>
                <line x1={x0} x2={x0} y1={0} y2={hauteur + ENTETE_J} className="plan-grille" />
                <text x={x0 + 8} y={16} className="plan-groupe">
                  {j.label}
                </text>
                <text x={x0 + 8} y={32} className="plan-mois">
                  {jourFr(j.date) || 'Date à fixer'}
                </text>
                {duJour(plan, j.id).map((s) => {
                  const y = ENTETE_J + (minutes(s.start) - debut) * ECHELLE;
                  const h = Math.max(18, (minutes(s.end) - minutes(s.start)) * ECHELLE - 2);
                  const niveau = worstLevel(s, analyses);
                  const lib = `${heureFr(s.start)}–${heureFr(s.end)} ${s.title}`;
                  return (
                    <svg key={s.id} x={x0 + 4} y={y} width={colonne - 8} height={h}>
                      <g
                        role="button"
                        tabIndex={0}
                        aria-label={lib}
                        className={`audit-evenement audit-creneau-${s.type}`}
                        onClick={() => onOuvrir(s.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOuvrir(s.id);
                          }
                        }}
                      >
                        <title>{lib}</title>
                        <rect x={0} y={0} width={colonne - 8} height={h} rx={3} className="audit-evenement-fond" />
                        <rect
                          x={0}
                          y={0}
                          width={4}
                          height={h}
                          className={niveau ? `audit-niv-${niveau}` : 'audit-niv-faible'}
                        />
                        <text x={10} y={13} className="plan-etiquette">
                          {heureFr(s.start)} {s.title}
                        </text>
                        {h > 34 && s.items.length > 0 && (
                          <text x={10} y={27} className="plan-mois">
                            {s.items.length} mesures
                          </text>
                        )}
                      </g>
                    </svg>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <Text size="sm" c="dimmed">
        La bordure gauche de chaque créneau reprend le pronostic le plus élevé parmi ses mesures.
      </Text>
    </Stack>
  );
}

/* ------------------------------------------------------------------------------------------------ participants */
function Participants({
  plan,
  modifiable,
  onOuvrir,
  lancer,
}: {
  plan: AuditPlan;
  modifiable: boolean;
  onOuvrir: (id: string) => void;
  lancer: Lancer;
}) {
  if (!plan.people.length) return <Text size="sm">Aucune personne : ajoutez les interlocuteurs de l’audit.</Text>;
  return (
    <Stack>
      <DataTable label="Participants à l’audit">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Personne ou fonction</Table.Th>
              <Table.Th>Rôle dans l’audit</Table.Th>
              <Table.Th>Créneaux</Table.Th>
              <Table.Th>Temps mobilisé</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {plan.people.map((p) => {
              const creneaux = plan.slots
                .filter((s) => s.people.includes(p.id))
                .sort(
                  (a, b) =>
                    plan.days.findIndex((x) => x.id === a.day) - plan.days.findIndex((x) => x.id === b.day) ||
                    minutes(a.start) - minutes(b.start),
                );
              const total = creneaux.reduce((m, s) => m + minutes(s.end) - minutes(s.start), 0);
              return (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <TextInput
                      aria-label="Nom"
                      disabled={!modifiable}
                      defaultValue={p.name}
                      onBlur={(e) => {
                        if (e.currentTarget.value.trim() && e.currentTarget.value !== p.name)
                          void lancer('PATCH', `/plan/personnes/${p.id}`, { name: e.currentTarget.value });
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      aria-label="Fonction"
                      placeholder="Fonction, périmètre"
                      disabled={!modifiable}
                      defaultValue={p.role}
                      onBlur={(e) => {
                        if (e.currentTarget.value !== p.role)
                          void lancer('PATCH', `/plan/personnes/${p.id}`, { role: e.currentTarget.value });
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    {creneaux.length ? (
                      <Group gap="xs">
                        {creneaux.map((s) => (
                          <Button key={s.id} size="compact-xs" variant="light" onClick={() => onOuvrir(s.id)}>
                            {jourLibelle(plan, s)} {heureFr(s.start)}, {s.title}
                          </Button>
                        ))}
                      </Group>
                    ) : (
                      <Text size="sm" c="dimmed">
                        Aucun créneau
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{duree(total)}</Table.Td>
                  <Table.Td>
                    {modifiable && (
                      <ConfirmButton
                        message={`Retirer « ${p.name} » de l’organisation et de tous ses créneaux ?`}
                        onConfirm={() => lancer('DELETE', `/plan/personnes/${p.id}`)}
                        variant="subtle"
                      >
                        Retirer
                      </ConfirmButton>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </DataTable>
      <Text size="sm" c="dimmed">
        Remplacez les fonctions par les noms des interlocuteurs. Le planning de chaque personne sert de base aux
        convocations.
      </Text>
    </Stack>
  );
}

/* ------------------------------------------------------------------------------------------------ fiche créneau */
function FicheCreneau({
  d,
  plan,
  s,
  modifiable,
  onDone,
  lancer,
}: {
  d: DonneesAudit;
  plan: AuditPlan;
  s: AuditPlanSlot;
  modifiable: boolean;
  onDone: () => void;
  lancer: Lancer;
}) {
  const [v, setV] = useState({
    title: s.title,
    day: s.day,
    start: s.start,
    end: s.end,
    type: s.type,
    place: s.place,
    detail: s.detail,
    people: s.people,
    requirements: s.items,
    proofs: s.proofs,
    questions: s.questions,
  });
  const [preuve, setPreuve] = useState('');
  const [question, setQuestion] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [info, setInfo] = useState('');
  const initial = JSON.stringify({
    title: s.title,
    day: s.day,
    start: s.start,
    end: s.end,
    type: s.type,
    place: s.place,
    detail: s.detail,
    people: s.people,
    requirements: s.items,
    proofs: s.proofs,
    questions: s.questions,
  });
  const modifie = JSON.stringify(v) !== initial;
  const regler = <K extends keyof typeof v>(k: K, valeur: (typeof v)[K]) => setV((x) => ({ ...x, [k]: valeur }));
  const ecarts = slotFindings(d.findings, { items: v.requirements });
  const exigences = v.requirements
    .map((id) => d.items.find((x) => x.id === id))
    .filter((x): x is NonNullable<typeof x> => !!x);
  const avecGuide = exigences.filter((i) => guideDe(i)).length;
  const enregistrer = async () => {
    try {
      setErreur(null);
      await lancer('PATCH', `/plan/creneaux/${s.id}`, v);
      setInfo('Créneau enregistré.');
    } catch (e) {
      setErreur(e);
    }
  };
  const ajouterGuide = () => {
    let n = 0;
    const preuves = [...v.proofs],
      questions = [...v.questions];
    for (const i of exigences) {
      const g = guideDe(i);
      if (!g) continue;
      for (const p of g.preuves)
        if (!preuves.some((x) => x.t === p)) {
          preuves.push({ t: p, done: false });
          n++;
        }
      for (const q of g.questions) if (!questions.includes(q)) questions.push(q);
    }
    setV((x) => ({ ...x, proofs: preuves, questions }));
    setInfo(
      n
        ? `${n} preuve${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} (à enregistrer).`
        : 'Toutes les preuves types sont déjà dans la liste.',
    );
  };
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      {info && <Alert color="green">{info}</Alert>}
      <TextInput
        label="Thème du créneau"
        disabled={!modifiable}
        value={v.title}
        onChange={(e) => regler('title', e.currentTarget.value)}
      />
      <div className="grille-formulaire">
        <div className="grille-formulaire__champs">
          <Select
            label="Jour"
            allowDeselect={false}
            disabled={!modifiable}
            data={plan.days.map((j) => ({ value: j.id, label: j.label }))}
            value={v.day}
            onChange={(x) => x && regler('day', x)}
          />
          <TextInput
            label="Début"
            type="time"
            disabled={!modifiable}
            value={v.start}
            onChange={(e) => regler('start', e.currentTarget.value)}
          />
          <TextInput
            label="Fin"
            type="time"
            disabled={!modifiable}
            value={v.end}
            onChange={(e) => regler('end', e.currentTarget.value)}
          />
          <Select
            label="Type"
            allowDeselect={false}
            disabled={!modifiable}
            data={SLOT_KINDS.map((k) => ({ value: k, label: SLOT_KIND_LABELS[k] }))}
            value={v.type}
            onChange={(x) => x && regler('type', x)}
          />
          <TextInput
            label="Lieu ou visio"
            placeholder="Salle, site, lien"
            disabled={!modifiable}
            value={v.place}
            onChange={(e) => regler('place', e.currentTarget.value)}
          />
        </div>
      </div>
      <Textarea
        label="Contenu"
        autosize
        minRows={3}
        disabled={!modifiable}
        value={v.detail}
        onChange={(e) => regler('detail', e.currentTarget.value)}
      />
      <div>
        <Text fw={600} size="sm">
          Participants
        </Text>
        <Group gap="xs">
          {plan.people.map((p) => {
            const actif = v.people.includes(p.id);
            return (
              <Button
                key={p.id}
                size="compact-sm"
                variant={actif ? 'filled' : 'default'}
                aria-pressed={actif}
                title={p.role}
                disabled={!modifiable}
                onClick={() => regler('people', actif ? v.people.filter((x) => x !== p.id) : [...v.people, p.id])}
              >
                {p.name}
              </Button>
            );
          })}
          {!plan.people.length && <Text size="sm">Ajoutez d’abord des personnes (page Participants).</Text>}
        </Group>
      </div>
      {v.type !== 'pause' && (
        <>
          <MultiSelect
            label={`Mesures abordées (${v.requirements.length})`}
            searchable
            clearable
            disabled={!modifiable}
            data={d.items.map((i) => ({ value: i.id, label: `${itemCode(i)} ${i.title}` }))}
            value={v.requirements}
            onChange={(x) => regler('requirements', x)}
            nothingFoundMessage="Aucune mesure"
          />
          <div>
            <Text fw={600} size="sm">
              Écarts ouverts à présenter
            </Text>
            {!ecarts.length && <Text size="sm">Aucun écart ouvert sur les mesures de ce créneau.</Text>}
            <ul className="audit-motifs">
              {ecarts.map((f) => (
                <li key={f.id}>
                  {f.id} — {f.type}, {f.source} {f.year} : {d.findings.find((x) => x.id === f.id)?.text}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Text fw={600} size="sm">
              Preuves à préparer ({v.proofs.filter((p) => p.done).length}/{v.proofs.length})
            </Text>
            <Stack gap="xs">
              {v.proofs.map((p, i) => (
                <Group key={i} wrap="nowrap">
                  <Checkbox
                    aria-label="Preuve prête"
                    disabled={!modifiable}
                    checked={p.done}
                    onChange={(e) =>
                      regler(
                        'proofs',
                        v.proofs.map((x, j) => (j === i ? { ...x, done: e.currentTarget.checked } : x)),
                      )
                    }
                  />
                  <TextInput
                    aria-label="Preuve"
                    className="audit-champ-large"
                    disabled={!modifiable}
                    value={p.t}
                    onChange={(e) =>
                      regler(
                        'proofs',
                        v.proofs.map((x, j) => (j === i ? { ...x, t: e.currentTarget.value } : x)),
                      )
                    }
                  />
                  {modifiable && (
                    <Button
                      variant="subtle"
                      aria-label="Supprimer la preuve"
                      onClick={() =>
                        regler(
                          'proofs',
                          v.proofs.filter((_, j) => j !== i),
                        )
                      }
                    >
                      ×
                    </Button>
                  )}
                </Group>
              ))}
            </Stack>
            {modifiable && (
              <Group mt="xs">
                <TextInput
                  aria-label="Nouvelle preuve"
                  placeholder="Ajouter une preuve"
                  className="audit-champ-large"
                  value={preuve}
                  onChange={(e) => setPreuve(e.currentTarget.value)}
                />
                <Button
                  variant="default"
                  onClick={() => {
                    if (preuve.trim()) {
                      regler('proofs', [...v.proofs, { t: preuve.trim(), done: false }]);
                      setPreuve('');
                    }
                  }}
                >
                  Ajouter la preuve
                </Button>
                {avecGuide > 0 && (
                  <Button variant="subtle" onClick={ajouterGuide}>
                    Ajouter les preuves types des {avecGuide} mesures
                  </Button>
                )}
              </Group>
            )}
          </div>
          <div>
            <Text fw={600} size="sm">
              Questions probables de l’auditeur
            </Text>
            <Stack gap="xs">
              {v.questions.map((x, i) => (
                <Group key={i} wrap="nowrap">
                  <TextInput
                    aria-label="Question"
                    className="audit-champ-large"
                    disabled={!modifiable}
                    value={x}
                    onChange={(e) =>
                      regler(
                        'questions',
                        v.questions.map((y, j) => (j === i ? e.currentTarget.value : y)),
                      )
                    }
                  />
                  {modifiable && (
                    <Button
                      variant="subtle"
                      aria-label="Supprimer la question"
                      onClick={() =>
                        regler(
                          'questions',
                          v.questions.filter((_, j) => j !== i),
                        )
                      }
                    >
                      ×
                    </Button>
                  )}
                </Group>
              ))}
            </Stack>
            {modifiable && (
              <Group mt="xs">
                <TextInput
                  aria-label="Nouvelle question"
                  placeholder="Ajouter une question"
                  className="audit-champ-large"
                  value={question}
                  onChange={(e) => setQuestion(e.currentTarget.value)}
                />
                <Button
                  variant="default"
                  onClick={() => {
                    if (question.trim()) {
                      regler('questions', [...v.questions, question.trim()]);
                      setQuestion('');
                    }
                  }}
                >
                  Ajouter la question
                </Button>
              </Group>
            )}
          </div>
        </>
      )}
      <Group justify="space-between">
        {modifiable ? (
          <ConfirmButton
            message={`Supprimer le créneau « ${s.title} » ?`}
            onConfirm={async () => {
              await lancer('DELETE', `/plan/creneaux/${s.id}`);
              onDone();
            }}
            variant="light"
          >
            Supprimer ce créneau
          </ConfirmButton>
        ) : (
          <span />
        )}
        <Group>
          <Button variant="default" onClick={onDone}>
            Fermer
          </Button>
          {modifiable && (
            <Button disabled={!modifie} onClick={() => void enregistrer()}>
              Enregistrer
            </Button>
          )}
        </Group>
      </Group>
    </Stack>
  );
}

/* Cellule de crise (reprise de la page de l'outil de suivi) : cellules avec main courante horodatée, échéances et
   check-list de scénario, contacts de crise et scénarios. Calculs repris à l'identique de l'outil historique
   (durées, avancement de la check-list, clôture d'un exercice planifié). Horodatages au format ISO 8601. */
import { z } from 'zod';

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const objet = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);

export const TYPES_ENTREE_CRISE = ['Information', 'Point de situation', 'Décision', 'Action', 'Communication'] as const;
export const PHASES_CRISE = ['Alerte', 'Mobilisation', 'Gestion', 'Sortie de crise'] as const;
export const MODES_CRISE = ['Exercice', 'Réel'] as const;
/** Raccourcis d'échéance proposés dans la cellule : libellé et délai en heures. */
export const ECHEANCES_RAPIDES = [
  { libelle: 'Alerte précoce NIS 2', heures: 24, court: 'NIS 2 24 h' },
  { libelle: 'Notification NIS 2', heures: 72, court: 'NIS 2 72 h' },
  { libelle: 'Notification CNIL (RGPD)', heures: 72, court: 'CNIL 72 h' },
] as const;

export interface EntreeMainCourante {
  ts: string;
  type: string;
  author: string;
  text: string;
}
export interface EcheanceCrise {
  label: string;
  due: string;
}
export interface CelluleCrise {
  id: string;
  title: string;
  mode: string;
  scenario: string;
  plan: string;
  start: string;
  end: string;
  status: string;
  log: EntreeMainCourante[];
  checks: Record<string, { done: boolean; ts: string }>;
  deadlines: EcheanceCrise[];
}
export interface ContactCrise {
  createdAt: string;
  name: string;
  org: string;
  role: string;
  phone: string;
  phone2: string;
  email: string;
  avail: string;
  notes: string;
  key: boolean;
}
export interface ActionScenario {
  phase: string;
  t: string;
  owner: string;
}
export interface ScenarioCrise {
  id: string;
  title: string;
  ref: string;
  desc: string;
  items: ActionScenario[];
}
export interface EtatCrise {
  contacts: ContactCrise[];
  scenarios: ScenarioCrise[];
  cells: CelluleCrise[];
}

export function lireEtatCrise(brut: unknown): EtatCrise {
  const c = objet(brut) ?? {};
  const liste = (v: unknown) => (Array.isArray(v) ? v.map(objet).filter((x): x is Obj => !!x) : []);
  return {
    contacts: liste(c.contacts).map((x) => ({
      createdAt: str(x.createdAt),
      name: str(x.name),
      org: str(x.org),
      role: str(x.role),
      phone: str(x.phone),
      phone2: str(x.phone2),
      email: str(x.email),
      avail: str(x.avail),
      notes: str(x.notes),
      key: !!x.key,
    })),
    scenarios: liste(c.scenarios)
      .filter((x) => str(x.id))
      .map((x) => ({
        id: str(x.id),
        title: str(x.title),
        ref: str(x.ref),
        desc: str(x.desc),
        items: liste(x.items).map((i) => ({ phase: str(i.phase) || 'Gestion', t: str(i.t), owner: str(i.owner) })),
      })),
    cells: liste(c.cells)
      .filter((x) => str(x.id))
      .map((x) => ({
        id: str(x.id),
        title: str(x.title),
        mode: str(x.mode) || 'Exercice',
        scenario: str(x.scenario),
        plan: str(x.plan),
        start: str(x.start),
        end: str(x.end),
        status: str(x.status),
        log: liste(x.log).map((l) => ({ ts: str(l.ts), type: str(l.type), author: str(l.author), text: str(l.text) })),
        checks: Object.fromEntries(
          Object.entries(objet(x.checks) ?? {}).flatMap(([k, v]) => {
            const o = objet(v);
            return o && o.done ? [[k, { done: true, ts: str(o.ts) }]] : [];
          }),
        ),
        deadlines: liste(x.deadlines).map((d) => ({ label: str(d.label), due: str(d.due) })),
      })),
  };
}
export const celluleActive = (e: EtatCrise) => e.cells.find((c) => c.status === 'Active');

/** Durée « 1 h 05 min 09 s » comme l'outil historique (heures omises si nulles). */
export function formaterDureeCrise(ms: number): string {
  const t = Math.max(0, ms),
    s = Math.floor(t / 1000),
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    x = s % 60;
  return `${h ? `${h} h ` : ''}${String(m).padStart(2, '0')} min ${String(x).padStart(2, '0')} s`;
}
/** Écart « T+… » de la main courante : durée depuis l'ouverture sans les secondes. */
export const ecartMainCourante = (ts: string, debut: string) =>
  formaterDureeCrise(Date.parse(ts) - Date.parse(debut)).replace(/ \d+ s$/, '');
export function formaterDateHeure(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? ts
    : `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}
/** Avancement de la check-list du scénario associé à la cellule. */
export function avancementChecklist(c: CelluleCrise, s: ScenarioCrise | undefined): { faits: number; total: number } {
  const items = s?.items ?? [];
  return { faits: items.filter((_, k) => c.checks[String(k)]?.done).length, total: items.length };
}
/** Reste avant une échéance (négatif si dépassée), en millisecondes. */
export const resteEcheance = (e: EcheanceCrise, maintenant: number) => Date.parse(e.due) - maintenant;
/** Texte de la clôture d'un exercice planifié : synthèse de la main courante pour le retour d'expérience. */
export const syntheseRetex = (c: CelluleCrise, fin: string) =>
  `Main courante : ${c.log.length} entrées, durée ${formaterDureeCrise(Date.parse(fin) - Date.parse(c.start))}.`;

const t = (n: number) => z.string().trim().max(n);
export const CelluleOuverture = z
  .object({
    mode: z.enum(MODES_CRISE),
    title: t(300),
    scenario: t(100),
    plan: t(100),
  })
  .partial()
  .strict();
export const EntreeCreation = z.object({ type: z.enum(TYPES_ENTREE_CRISE), author: t(200), text: t(5000).min(1) }).strict();
export const EcheanceCreation = z.object({ label: t(300).min(1), heures: z.number().int().min(1).max(8760) }).strict();
export const ChecklistBascule = z.object({ fait: z.boolean(), author: t(200).optional() }).strict();
export const AuteurCrise = z.object({ author: t(200).optional() }).strict();
export const ContactModification = z
  .object({
    name: t(200),
    org: t(200),
    role: t(200),
    phone: t(100),
    phone2: t(100),
    email: t(200),
    avail: t(200),
    notes: t(2000),
    key: z.boolean(),
  })
  .partial()
  .strict();
export const ScenarioModification = z.object({ title: t(300), ref: t(100), desc: t(5000) }).partial().strict();
export const ActionScenarioModification = z
  .object({ phase: z.enum(PHASES_CRISE), t: t(2000), owner: t(200) })
  .partial()
  .strict();

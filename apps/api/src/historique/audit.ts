/* Gestion de l'audit de l'outil de suivi (reprise des pages « Pronostic », « Couverture du cycle », « Déroulé »,
   « Planning » et « Participants ») : exigences (`items`), cycle (`years`, `nextYear`…) et organisation de l'audit
   (`plan`) de l'état historique, modifiés sous verrou et sans copie. Le pronostic se calcule côté client avec les
   fonctions partagées (`@suivi/shared/audit`, testées en parité). Aucun plan, aucun jour ni aucune personne n'est
   créé par défaut : l'organisation de l'audit démarre vide. */
import crypto from 'node:crypto';
import {
  AUDIT_REFS,
  COVERAGE_VALUES,
  PREP_VALUES,
  PLAN_STATUSES,
  PlanDayBody,
  PlanPersonBody,
  PlanUpdateBody,
  SlotUpdateBody,
  type AuditPlan,
} from '@suivi/shared/audit';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import { z } from 'zod';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { entrees, type RegistreHistorique } from './registre.js';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown, defaut: number) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : defaut);
const date = z.union([z.iso.date(), z.literal('')]);

/** Couverture d'une exigence : « prévue » (P) ou « auditée » (X) par l'AFNOR ou en interne, pour une année du cycle. */
export const CouvertureBody = z
  .object({
    id: z.string().trim().min(1).max(64),
    source: z.enum(['afnor', 'interne']),
    year: z.number().int().min(2000).max(2100),
    valeur: z.enum(COVERAGE_VALUES),
  })
  .strict();
export const PreparationBody = z.object({ id: z.string().trim().min(1).max(64), valeur: z.enum(PREP_VALUES) }).strict();
/** Cycle d'audit : prochain audit, dates, années et libellés. Toutes les valeurs sont facultatives. */
export const CycleBody = z
  .object({
    nextYear: z.number().int().min(2000).max(2100),
    nextDate: date,
    internalDate: date,
    closeDeadline: date,
    years: z.array(z.number().int().min(2000).max(2100)).min(1).max(30),
    yearLabels: z.record(z.string().regex(/^\d{4}$/), z.string().trim().max(80)),
  })
  .partial()
  .strict();

export interface VueAudit {
  version: number;
  years: number[];
  yearLabels: Record<string, string>;
  nextYear: number;
  nextDate: string;
  internalDate: string;
  closeDeadline: string;
  groups: { id: string; ref: string; num: string; title: string }[];
  items: {
    id: string;
    ref: string;
    num: string;
    title: string;
    group: string;
    depth: number;
    afnor: Record<string, string>;
    interne: Record<string, string>;
    prep: string;
    owner: string;
  }[];
  findings: {
    id: string;
    source: string;
    year: number;
    type: string;
    status: string;
    text: string;
    action: string;
    items: string[];
  }[];
  /** Organisation de l'audit, réservée au droit `plan_audit` ; `null` sans ce droit. */
  plan: AuditPlan | null;
}

const vide = (): AuditPlan => ({ status: PLAN_STATUSES[0], note: '', days: [], slots: [], people: [] });
const mapTexte = (o: unknown): Record<string, string> =>
  isObject(o) ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, str(v)])) : {};
const identifiant = (prefixe: string) => prefixe + crypto.randomBytes(5).toString('hex');
const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const heure = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
/** Jour ouvré suivant (ni samedi ni dimanche) d'une date AAAA-MM-JJ. */
function jourOuvreSuivant(d: string): string {
  const x = new Date(d + 'T12:00:00Z');
  if (Number.isNaN(x.getTime())) return '';
  do x.setUTCDate(x.getUTCDate() + 1);
  while (x.getUTCDay() === 0 || x.getUTCDay() === 6);
  return x.toISOString().slice(0, 10);
}

export class AuditSuivi {
  constructor(private readonly r: RegistreHistorique) {}

  async vue(user: SessionUser): Promise<VueAudit> {
    const { version, data } = await this.r.lire(user, 'audit');
    const peutPlan = user.rights.can('plan_audit', 'lire');
    const years = (Array.isArray(data.years) ? data.years : []).map(Number).filter(Number.isInteger);
    return {
      version,
      years,
      yearLabels: mapTexte(data.yearLabels),
      nextYear: num(data.nextYear, years.length ? Math.max(...years) : new Date().getFullYear()),
      nextDate: str(data.nextDate),
      internalDate: str(data.internalDate),
      closeDeadline: str(data.closeDeadline),
      groups: entrees(data, 'groups').map((g) => ({
        id: str(g.id),
        ref: str(g.ref),
        num: str(g.num),
        title: str(g.title),
      })),
      items: entrees(data, 'items')
        .filter((i) => str(i.id) && (AUDIT_REFS as readonly string[]).includes(str(i.ref)))
        .map((i) => ({
          id: str(i.id),
          ref: str(i.ref),
          num: str(i.num),
          title: str(i.title),
          group: str(i.group),
          depth: num(i.depth, 0),
          afnor: mapTexte(i.afnor),
          interne: mapTexte(i.interne),
          prep: str(i.prep),
          owner: str(i.owner),
        })),
      findings: entrees(data, 'findings')
        .filter((f) => str(f.id))
        .map((f) => ({
          id: str(f.id),
          source: str(f.source),
          year: num(f.year, 0),
          type: str(f.type),
          status: str(f.status),
          text: str(f.text),
          action: str(f.action),
          items: (Array.isArray(f.items) ? f.items : []).filter((x): x is string => typeof x === 'string'),
        })),
      plan: peutPlan ? this.lirePlan(data) : null,
    };
  }

  /* ------------------------------------------------------------------------------ exigences et cycle */
  /** Fait avancer la couverture d'une exigence : vide, prévue (P), auditée (X). */
  async couvrir(input: unknown, user: SessionUser, ip: string) {
    const b = CouvertureBody.parse(input);
    return this.r.modifier<{ id: string }>(
      user,
      ip,
      { module: 'audit', action: 'audit.coverage.updated', reference: (x) => `legacy:items:${x.id}` },
      (data) => {
        this.verifierAnnee(data, b.year);
        return this.changerExigence(data, b.id, (it) => {
          const col = { ...(isObject(it[b.source]) ? (it[b.source] as JsonObject) : {}) };
          if (b.valeur) col[String(b.year)] = b.valeur;
          else delete col[String(b.year)];
          return { ...it, [b.source]: col };
        });
      },
    );
  }
  async preparer(input: unknown, user: SessionUser, ip: string) {
    const b = PreparationBody.parse(input);
    return this.r.modifier<{ id: string }>(
      user,
      ip,
      { module: 'audit', action: 'audit.preparation.updated', reference: (x) => `legacy:items:${x.id}` },
      (data) => this.changerExigence(data, b.id, (it) => ({ ...it, prep: b.valeur })),
    );
  }
  /** Cycle d'audit : prochain audit, dates, années (ajout seulement) et libellés. */
  async regler(input: unknown, user: SessionUser, ip: string) {
    const b = CycleBody.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'audit', action: 'audit.cycle.updated', reference: () => 'legacy:cycle' },
      (data) => {
        const avant = (Array.isArray(data.years) ? data.years : []).map(Number).filter(Number.isInteger);
        if (b.years) {
          const manquantes = avant.filter((y) => !b.years!.includes(y));
          if (manquantes.length)
            throw new HttpError(422, `Une année du cycle ne se retire pas : ${manquantes.join(', ')}.`);
          data.years = [...new Set(b.years)].sort((x, y) => x - y);
        }
        const annees = (Array.isArray(data.years) ? data.years : []).map(Number);
        if (b.nextYear !== undefined) {
          if (annees.length && !annees.includes(b.nextYear))
            throw new HttpError(422, 'Le prochain audit doit être une année du cycle.');
          data.nextYear = b.nextYear;
        }
        for (const k of ['nextDate', 'internalDate', 'closeDeadline'] as const) if (b[k] !== undefined) data[k] = b[k];
        if (b.yearLabels) data.yearLabels = { ...(isObject(data.yearLabels) ? data.yearLabels : {}), ...b.yearLabels };
        return { ok: true };
      },
    );
  }

  /* ------------------------------------------------------------------------------ organisation de l'audit */
  async majPlan(input: unknown, user: SessionUser, ip: string) {
    const b = PlanUpdateBody.parse(input);
    return this.modifierPlan(user, ip, 'audit.plan.updated', (plan) => {
      if (b.status !== undefined) plan.status = b.status;
      if (b.note !== undefined) plan.note = b.note;
      return { ok: true };
    });
  }
  async ajouterJour(input: unknown, user: SessionUser, ip: string) {
    const b = PlanDayBody.partial().parse(input ?? {});
    return this.modifierPlan(user, ip, 'audit.plan.day-created', (plan) => {
      const dernier = plan.days.at(-1);
      const jour = {
        id: identifiant('j'),
        label: b.label || `Jour ${plan.days.length + 1}`,
        date: b.date === undefined ? (dernier?.date ? jourOuvreSuivant(dernier.date) : '') : (b.date ?? ''),
      };
      plan.days.push(jour);
      return jour;
    });
  }
  async modifierJour(id: string, input: unknown, user: SessionUser, ip: string) {
    const b = PlanDayBody.partial().parse(input);
    return this.modifierPlan(user, ip, 'audit.plan.day-updated', (plan, data) => {
      const jour = plan.days.find((d) => d.id === id);
      if (!jour) throw new HttpError(404, 'Jour absent du plan.');
      if (b.label !== undefined) jour.label = b.label;
      if (b.date !== undefined) {
        jour.date = b.date ?? '';
        // Comme l'outil de suivi : la date du premier jour fixe la date de l'audit si elle est absente.
        if (jour === plan.days[0] && jour.date && !str(data.nextDate)) data.nextDate = jour.date;
      }
      return jour;
    });
  }
  async supprimerJour(id: string, user: SessionUser, ip: string) {
    return this.modifierPlan(
      user,
      ip,
      'audit.plan.day-deleted',
      (plan) => {
        if (!plan.days.some((d) => d.id === id)) throw new HttpError(404, 'Jour absent du plan.');
        if (plan.slots.some((s) => s.day === id))
          throw new HttpError(409, 'Ce jour porte encore des créneaux : supprimez-les ou déplacez-les d’abord.');
        plan.days = plan.days.filter((d) => d.id !== id);
        plan.days.forEach((d, i) => {
          if (/^Jour \d+$/.test(d.label)) d.label = `Jour ${i + 1}`;
        });
        return { id };
      },
      'supprimer',
    );
  }
  /** Ajout avec les valeurs de l'outil de suivi : à la suite du dernier créneau du jour (09h00 pour le premier, 1 h). */
  async ajouterCreneau(input: unknown, user: SessionUser, ip: string) {
    const { day } = z
      .object({ day: z.string().trim().min(1).max(64).optional() })
      .strict()
      .parse(input ?? {});
    return this.modifierPlan(user, ip, 'audit.plan.slot-created', (plan) => {
      const jour = day ?? plan.days.at(-1)?.id;
      if (!jour) throw new HttpError(409, 'Ajoutez d’abord un jour.');
      this.verifierJour(plan, jour);
      const duJour = plan.slots.filter((s) => s.day === jour).sort((a, b) => minutes(a.start) - minutes(b.start));
      const debut = duJour.length ? minutes(duJour.at(-1)!.end) : 540;
      const creneau = {
        id: identifiant('s'),
        day: jour,
        start: heure(debut),
        end: heure(Math.min(debut + 60, 1439)),
        type: 'audit',
        title: 'Nouveau créneau',
        detail: '',
        place: '',
        items: [] as string[],
        people: [] as string[],
        proofs: [],
        questions: [],
      };
      plan.slots.push(creneau);
      return creneau;
    });
  }
  async modifierCreneau(id: string, input: unknown, user: SessionUser, ip: string) {
    const b = SlotUpdateBody.parse(input);
    return this.modifierPlan(user, ip, 'audit.plan.slot-updated', (plan, data) => {
      const i = plan.slots.findIndex((s) => s.id === id);
      if (i < 0) throw new HttpError(404, 'Créneau absent du plan.');
      if (b.day !== undefined) this.verifierJour(plan, b.day);
      this.verifierRefs(data, plan, b.requirements ?? [], b.people ?? []);
      const { requirements, ...reste } = b;
      const suivant = { ...plan.slots[i]!, ...reste, ...(requirements ? { items: requirements } : {}) };
      // Comme l'outil de suivi : un début tardif repousse la fin d'une heure.
      if (b.start !== undefined && b.end === undefined && minutes(suivant.end) <= minutes(suivant.start))
        suivant.end = heure(Math.min(minutes(suivant.start) + 60, 1439));
      if (minutes(suivant.end) < minutes(suivant.start))
        throw new HttpError(422, 'La fin du créneau précède son début.');
      plan.slots[i] = suivant;
      return suivant;
    });
  }
  async supprimerCreneau(id: string, user: SessionUser, ip: string) {
    return this.modifierPlan(
      user,
      ip,
      'audit.plan.slot-deleted',
      (plan) => {
        if (!plan.slots.some((s) => s.id === id)) throw new HttpError(404, 'Créneau absent du plan.');
        plan.slots = plan.slots.filter((s) => s.id !== id);
        return { id };
      },
      'supprimer',
    );
  }
  async ajouterPersonne(input: unknown, user: SessionUser, ip: string) {
    const b = z
      .object({ name: PlanPersonBody.shape.name.optional(), role: PlanPersonBody.shape.role.optional() })
      .parse(input ?? {});
    return this.modifierPlan(user, ip, 'audit.plan.person-created', (plan) => {
      const personne = { id: identifiant('p'), name: b.name ?? 'Nouvelle personne', role: b.role ?? '' };
      plan.people.push(personne);
      return personne;
    });
  }
  async modifierPersonne(id: string, input: unknown, user: SessionUser, ip: string) {
    const b = PlanPersonBody.partial().parse(input);
    return this.modifierPlan(user, ip, 'audit.plan.person-updated', (plan) => {
      const p = plan.people.find((x) => x.id === id);
      if (!p) throw new HttpError(404, 'Personne absente du plan.');
      if (b.name !== undefined) p.name = b.name;
      if (b.role !== undefined) p.role = b.role;
      return p;
    });
  }
  async supprimerPersonne(id: string, user: SessionUser, ip: string) {
    return this.modifierPlan(
      user,
      ip,
      'audit.plan.person-deleted',
      (plan) => {
        if (!plan.people.some((p) => p.id === id)) throw new HttpError(404, 'Personne absente du plan.');
        plan.people = plan.people.filter((p) => p.id !== id);
        plan.slots.forEach((s) => (s.people = s.people.filter((x) => x !== id)));
        return { id };
      },
      'supprimer',
    );
  }

  /* ------------------------------------------------------------------------------------------------ interne */
  private lirePlan(data: JsonObject): AuditPlan {
    const p = isObject(data.plan) ? data.plan : {};
    const liste = (v: unknown) => (Array.isArray(v) ? v.filter(isObject) : []);
    const textes = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return {
      status: str(p.status) || PLAN_STATUSES[0],
      note: str(p.note),
      days: liste(p.days).map((d) => ({ id: str(d.id), label: str(d.label), date: str(d.date) })),
      people: liste(p.people).map((x) => ({ id: str(x.id), name: str(x.name), role: str(x.role) })),
      slots: liste(p.slots).map((s) => ({
        id: str(s.id),
        day: str(s.day),
        start: str(s.start),
        end: str(s.end),
        type: str(s.type),
        title: str(s.title),
        detail: str(s.detail),
        place: str(s.place),
        items: textes(s.items),
        people: textes(s.people),
        proofs: liste(s.proofs).map((x) => ({ t: str(x.t), done: x.done === true })),
        questions: textes(s.questions),
      })),
    };
  }
  /** Modifie le plan sous verrou : l'état normalisé est réécrit en conservant les champs inconnus du plan. */
  private modifierPlan<T extends object>(
    user: SessionUser,
    ip: string,
    action: string,
    appliquer: (plan: AuditPlan, data: JsonObject) => T,
    droit: 'modifier' | 'supprimer' = 'modifier',
  ): Promise<T> {
    const reference = (r: T) => ((r as { id?: string }).id ? `legacy:plan:${(r as { id: string }).id}` : 'legacy:plan');
    return this.r.modifier(user, ip, { module: 'plan_audit', action, reference, droit }, (data) => {
      const plan = this.lirePlan(data);
      const resultat = appliquer(plan, data);
      data.plan = { ...(isObject(data.plan) ? data.plan : vide()), ...plan } as unknown as JsonObject;
      return resultat;
    });
  }
  private changerExigence(data: JsonObject, id: string, f: (it: JsonObject) => JsonObject) {
    const trouvees = entrees(data, 'items').filter((i) => i.id === id);
    if (trouvees.length > 1)
      throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
    if (!trouvees[0]) throw new HttpError(404, 'Exigence absente.');
    const suivante = f(trouvees[0]);
    data.items = (data.items as JsonObject[]).map((i) => (isObject(i) && i.id === id ? suivante : i));
    return { id };
  }
  private verifierAnnee(data: JsonObject, annee: number) {
    const annees = (Array.isArray(data.years) ? data.years : []).map(Number);
    if (!annees.includes(annee))
      throw new HttpError(422, `L’année ${annee} n’est pas dans le cycle (${annees.join(', ')}).`);
  }
  private verifierJour(plan: AuditPlan, jour: string) {
    if (!plan.days.some((d) => d.id === jour)) throw new HttpError(422, 'Jour absent du plan.');
  }
  private verifierRefs(data: JsonObject, plan: AuditPlan, exigences: string[], personnes: string[]) {
    const connues = new Set(entrees(data, 'items').map((i) => str(i.id)));
    const inconnue = exigences.find((x) => !connues.has(x));
    if (inconnue) throw new HttpError(422, `Exigence inconnue : ${inconnue}.`);
    const absente = personnes.find((p) => !plan.people.some((x) => x.id === p));
    if (absente) throw new HttpError(422, 'Personne absente du plan.');
  }
}

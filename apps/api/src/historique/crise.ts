/* Cellule de crise (reprise de la page de l'outil de suivi) : clé `crisis` de l'état historique (cellules avec main
   courante, contacts de crise, scénarios et check-lists), modifiée sous verrou et sans copie. La clôture d'une
   cellule liée à un exercice planifié marque cet exercice « Réalisé » (droit du pilotage requis, comme dans l'outil
   historique). L'export Excel de la main courante et l'import des scénarios depuis Excel ne sont pas repris. */
import {
  ActionScenarioModification,
  AuteurCrise,
  CelluleOuverture,
  ChecklistBascule,
  ContactModification,
  EcheanceCreation,
  EntreeCreation,
  ScenarioModification,
  lireEtatCrise,
  syntheseRetex,
  type EtatCrise,
} from '@suivi/shared';
import { isObject, type Json, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { entrees, remplacerEntree, type RegistreHistorique } from './registre.js';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const now = () => new Date().toISOString();
type Racine = JsonObject & { contacts: Json[]; scenarios: Json[]; cells: Json[] };

function racine(data: JsonObject): Racine {
  const c: JsonObject = isObject(data.crisis) ? { ...data.crisis } : {};
  for (const k of ['contacts', 'scenarios', 'cells']) c[k] = Array.isArray(c[k]) ? c[k] : [];
  data.crisis = c;
  return c as Racine;
}
const parId = (l: Json[], id: string, libelle: string): JsonObject => {
  const t = l.filter((x): x is JsonObject => isObject(x) && x.id === id);
  if (t.length > 1) throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
  if (!t[0]) throw new HttpError(404, `${libelle} absent(e).`);
  return t[0];
};
const remplacer = (c: Racine, cle: 'scenarios' | 'cells', id: string, s: JsonObject | null) => {
  c[cle] = c[cle].flatMap((x) => (isObject(x) && x.id === id ? (s ? [s] : []) : [x]));
};
const liste = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
const entreeLog = (type: string, author: string, text: string): JsonObject => ({ ts: now(), type, author, text });

export interface VueCrise {
  version: number;
  etat: EtatCrise;
  /** Exercices planifiés (plan « exo ») non réalisés, proposés à l'ouverture d'une cellule. */
  exercices: { id: string; title: string }[];
  /** Fournisseurs critiques ou hébergeurs HDS, proposés comme contacts. */
  fournisseursCritiques: string[];
}

export class Crise {
  constructor(private readonly r: RegistreHistorique) {}

  async vue(user: SessionUser): Promise<VueCrise> {
    const { version, data } = await this.r.lire(user, 'incidents');
    return {
      version,
      etat: lireEtatCrise(data.crisis),
      exercices: entrees(data, 'plans')
        .filter((p) => p.type === 'exo' && p.status !== 'Réalisé')
        .map((p) => ({ id: str(p.id), title: str(p.title) })),
      fournisseursCritiques: entrees(data, 'suppliers')
        .filter((s) => s.critical === 'Oui' || s.hds === 'Oui')
        .map((s) => str(s.name)),
    };
  }

  private ecrire<T>(
    user: SessionUser,
    ip: string,
    action: string,
    reference: (x: T) => string,
    appliquer: (c: Racine, data: JsonObject) => T | Promise<T>,
    droit: 'modifier' | 'supprimer' = 'modifier',
  ): Promise<T> {
    return this.r.modifier(user, ip, { module: 'incidents', action, reference, droit }, (data) =>
      appliquer(racine(data), data),
    );
  }
  private cellule(c: Racine, id: string, active = false): JsonObject {
    const x = parId(c.cells, id, 'Cellule');
    if (active && x.status !== 'Active') throw new HttpError(409, 'La cellule est clôturée.');
    return x;
  }

  /* ------------------------------------------------------------------------------------------- cellules */
  ouvrir(input: unknown, user: SessionUser, ip: string): Promise<{ id: string }> {
    const body = CelluleOuverture.parse(input);
    return this.ecrire(
      user,
      ip,
      'crisis.cell-opened',
      (x: { id: string }) => `legacy:crisis:${x.id}`,
      (c, data) => {
        const mode = body.mode ?? 'Exercice';
        if (body.scenario) parId(c.scenarios, body.scenario, 'Scénario');
        if (body.plan && !entrees(data, 'plans').some((p) => p.id === body.plan && p.type === 'exo'))
          throw new HttpError(422, 'Exercice planifié absent.');
        const start = now();
        const cell: JsonObject = {
          id: `CRISE-${Date.now().toString(36)}`,
          createdAt: start,
          title: body.title || (mode === 'Réel' ? 'Crise' : 'Exercice de crise'),
          mode,
          scenario: body.scenario ?? '',
          plan: body.plan ?? '',
          start,
          end: '',
          status: 'Active',
          log: [
            { ts: start, type: 'Information', author: '', text: `Ouverture de la cellule (${mode.toLowerCase()}).` },
          ],
          checks: {},
          deadlines: [],
        };
        c.cells = [...c.cells, cell];
        return { id: str(cell.id) };
      },
    );
  }

  entree(id: string, input: unknown, user: SessionUser, ip: string): Promise<{ id: string }> {
    const b = EntreeCreation.parse(input);
    return this.ecrire(
      user,
      ip,
      'crisis.log-added',
      (x: { id: string }) => `legacy:crisis:${x.id}`,
      (c) => {
        const cell = this.cellule(c, id, true);
        remplacer(c, 'cells', id, { ...cell, log: [...liste(cell.log), entreeLog(b.type, b.author, b.text)] });
        return { id };
      },
    );
  }

  /** Clôture : un exercice planifié lié est marqué « Réalisé » avec la synthèse de la main courante. */
  cloturer(id: string, input: unknown, user: SessionUser, ip: string): Promise<{ id: string; plan: string }> {
    const b = AuteurCrise.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'incidents', action: 'crisis.cell-closed', reference: (x: { id: string }) => `legacy:crisis:${x.id}` },
      async (data) => {
        const c = racine(data);
        const cell = this.cellule(c, id, true);
        const fin = now();
        const log = [...liste(cell.log), entreeLog('Décision', b.author ?? '', 'Clôture de la cellule.')];
        remplacer(c, 'cells', id, { ...cell, end: fin, status: 'Clôturée', log });
        const planId = str(cell.plan);
        const plan = planId ? entrees(data, 'plans').find((p) => p.id === planId) : undefined;
        if (plan) {
          await this.r.g.permission(user, 'pilotage', 'modifier');
          const lue = lireEtatCrise({ cells: [{ ...cell, log }] }).cells[0]!;
          remplacerEntree(data, 'plans', planId, {
            ...plan,
            status: 'Réalisé',
            done: fin.slice(0, 10),
            retex: str(plan.retex) || syntheseRetex(lue, fin),
          });
        }
        return { id, plan: plan ? planId : '' };
      },
    );
  }

  /** Bascule exercice ↔ crise réelle, consignée dans la main courante. */
  mode(id: string, input: unknown, user: SessionUser, ip: string): Promise<{ id: string; mode: string }> {
    const b = AuteurCrise.parse(input);
    return this.ecrire(
      user,
      ip,
      'crisis.mode-changed',
      (x: { id: string }) => `legacy:crisis:${x.id}`,
      (c) => {
        const cell = this.cellule(c, id, true);
        const vers = cell.mode === 'Réel' ? 'Exercice' : 'Réel';
        remplacer(c, 'cells', id, {
          ...cell,
          mode: vers,
          log: [
            ...liste(cell.log),
            entreeLog(
              'Décision',
              b.author ?? '',
              vers === 'Réel' ? 'Bascule en crise réelle.' : 'Retour en mode exercice.',
            ),
          ],
        });
        return { id, mode: vers };
      },
    );
  }

  echeance(id: string, input: unknown, user: SessionUser, ip: string): Promise<{ id: string }> {
    const b = EcheanceCreation.parse(input);
    return this.ecrire(
      user,
      ip,
      'crisis.deadline-added',
      (x: { id: string }) => `legacy:crisis:${x.id}`,
      (c) => {
        const cell = this.cellule(c, id, true);
        const due = new Date(Date.parse(str(cell.start)) + b.heures * 3600e3).toISOString();
        remplacer(c, 'cells', id, { ...cell, deadlines: [...liste(cell.deadlines), { label: b.label, due }] });
        return { id };
      },
    );
  }
  retirerEcheance(id: string, k: number, user: SessionUser, ip: string): Promise<{ id: string }> {
    return this.ecrire(
      user,
      ip,
      'crisis.deadline-removed',
      (x: { id: string }) => `legacy:crisis:${x.id}`,
      (c) => {
        const cell = this.cellule(c, id, true);
        const l = liste(cell.deadlines);
        if (!l[k]) throw new HttpError(404, 'Échéance absente.');
        remplacer(c, 'cells', id, { ...cell, deadlines: l.filter((_, i) => i !== k) });
        return { id };
      },
      'supprimer',
    );
  }

  /** Coche ou décoche une action de la check-list du scénario ; cocher ajoute une entrée « Action » à la main courante. */
  checklist(id: string, k: number, input: unknown, user: SessionUser, ip: string): Promise<{ id: string }> {
    const b = ChecklistBascule.parse(input);
    return this.ecrire(
      user,
      ip,
      'crisis.checklist',
      (x: { id: string }) => `legacy:crisis:${x.id}`,
      (c) => {
        const cell = this.cellule(c, id, true);
        const sc = c.scenarios.find((s) => isObject(s) && s.id === cell.scenario);
        const items = isObject(sc) ? liste(sc.items) : [];
        if (!items[k]) throw new HttpError(404, 'Action de la check-list absente.');
        const checks: JsonObject = isObject(cell.checks) ? { ...cell.checks } : {};
        let log = liste(cell.log);
        if (b.fait) {
          checks[String(k)] = { done: true, ts: now() };
          log = [
            ...log,
            entreeLog('Action', b.author ?? '', `Check-list : ${isObject(items[k]) ? str(items[k].t) : ''} — fait.`),
          ];
        } else delete checks[String(k)];
        remplacer(c, 'cells', id, { ...cell, checks, log });
        return { id };
      },
    );
  }

  /* ------------------------------------------------------------------------------------------ contacts */
  creerContact(user: SessionUser, ip: string): Promise<{ id: string }> {
    return this.ecrire(
      user,
      ip,
      'crisis.contact-added',
      (x: { id: string }) => `legacy:crisis:contact:${x.id}`,
      (c) => {
        c.contacts = [
          ...c.contacts,
          {
            createdAt: now(),
            name: '',
            org: '',
            role: '',
            phone: '',
            phone2: '',
            email: '',
            avail: '',
            notes: '',
            key: false,
          },
        ];
        return { id: String(c.contacts.length - 1) };
      },
    );
  }
  modifierContact(k: number, input: unknown, user: SessionUser, ip: string): Promise<{ id: string }> {
    const b = ContactModification.parse(input);
    return this.ecrire(
      user,
      ip,
      'crisis.contact-updated',
      (x: { id: string }) => `legacy:crisis:contact:${x.id}`,
      (c) => {
        const x = c.contacts[k];
        if (!isObject(x)) throw new HttpError(404, 'Contact absent.');
        c.contacts = c.contacts.map((y, i) => (i === k ? { ...x, ...b } : y));
        return { id: String(k) };
      },
    );
  }
  supprimerContact(k: number, user: SessionUser, ip: string): Promise<{ id: string }> {
    return this.ecrire(
      user,
      ip,
      'crisis.contact-removed',
      (x: { id: string }) => `legacy:crisis:contact:${x.id}`,
      (c) => {
        if (!isObject(c.contacts[k])) throw new HttpError(404, 'Contact absent.');
        c.contacts = c.contacts.filter((_, i) => i !== k);
        return { id: String(k) };
      },
      'supprimer',
    );
  }
  /** Ajoute comme contacts clés les fournisseurs critiques ou hébergeurs HDS du registre qui n'y figurent pas. */
  importerFournisseurs(user: SessionUser, ip: string): Promise<{ id: string; ajoutes: number }> {
    return this.ecrire(
      user,
      ip,
      'crisis.contacts-imported',
      (x: { id: string }) => `legacy:crisis:contact:${x.id}`,
      (c, data) => {
        let n = 0;
        for (const s of entrees(data, 'suppliers').filter((s) => s.critical === 'Oui' || s.hds === 'Oui')) {
          if (c.contacts.some((x) => isObject(x) && x.org === s.name)) continue;
          c.contacts = [
            ...c.contacts,
            {
              createdAt: now(),
              name: '',
              org: str(s.name),
              role: 'Support ou astreinte',
              phone: '',
              phone2: '',
              email: '',
              avail: '',
              notes: '',
              key: true,
            },
          ];
          n++;
        }
        return { id: 'import', ajoutes: n };
      },
    );
  }

  /* ----------------------------------------------------------------------------------------- scénarios */
  creerScenario(user: SessionUser, ip: string): Promise<{ id: string }> {
    return this.ecrire(
      user,
      ip,
      'crisis.scenario-added',
      (x: { id: string }) => `legacy:crisis:${x.id}`,
      (c) => {
        const s: JsonObject = {
          id: `SCN-${Date.now().toString(36)}`,
          createdAt: now(),
          title: 'Nouveau scénario',
          ref: '',
          desc: '',
          items: [],
        };
        c.scenarios = [...c.scenarios, s];
        return { id: str(s.id) };
      },
    );
  }
  modifierScenario(id: string, input: unknown, user: SessionUser, ip: string): Promise<{ id: string }> {
    const b = ScenarioModification.parse(input);
    return this.ecrire(
      user,
      ip,
      'crisis.scenario-updated',
      (x: { id: string }) => `legacy:crisis:${x.id}`,
      (c) => {
        remplacer(c, 'scenarios', id, { ...parId(c.scenarios, id, 'Scénario'), ...b });
        return { id };
      },
    );
  }
  supprimerScenario(id: string, user: SessionUser, ip: string): Promise<{ id: string }> {
    return this.ecrire(
      user,
      ip,
      'crisis.scenario-removed',
      (x: { id: string }) => `legacy:crisis:${x.id}`,
      (c) => {
        parId(c.scenarios, id, 'Scénario');
        remplacer(c, 'scenarios', id, null);
        return { id };
      },
      'supprimer',
    );
  }
  ajouterAction(id: string, user: SessionUser, ip: string): Promise<{ id: string }> {
    return this.ecrire(
      user,
      ip,
      'crisis.scenario-action-added',
      (x: { id: string }) => `legacy:crisis:${x.id}`,
      (c) => {
        const s = parId(c.scenarios, id, 'Scénario');
        remplacer(c, 'scenarios', id, { ...s, items: [...liste(s.items), { phase: 'Gestion', t: '', owner: '' }] });
        return { id };
      },
    );
  }
  modifierAction(id: string, k: number, input: unknown, user: SessionUser, ip: string): Promise<{ id: string }> {
    const b = ActionScenarioModification.parse(input);
    return this.ecrire(
      user,
      ip,
      'crisis.scenario-action-updated',
      (x: { id: string }) => `legacy:crisis:${x.id}`,
      (c) => {
        const s = parId(c.scenarios, id, 'Scénario');
        const items = liste(s.items);
        if (!isObject(items[k])) throw new HttpError(404, 'Action absente.');
        remplacer(c, 'scenarios', id, {
          ...s,
          items: items.map((x, i) => (i === k ? { ...(x as JsonObject), ...b } : x)),
        });
        return { id };
      },
    );
  }
  retirerAction(id: string, k: number, user: SessionUser, ip: string): Promise<{ id: string }> {
    return this.ecrire(
      user,
      ip,
      'crisis.scenario-action-removed',
      (x: { id: string }) => `legacy:crisis:${x.id}`,
      (c) => {
        const s = parId(c.scenarios, id, 'Scénario');
        const items = liste(s.items);
        if (!isObject(items[k])) throw new HttpError(404, 'Action absente.');
        remplacer(c, 'scenarios', id, { ...s, items: items.filter((_, i) => i !== k) });
        return { id };
      },
      'supprimer',
    );
  }
}

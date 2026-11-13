/* Cellule de crise (reprise de la page de l'outil de suivi) : clé `crisis` de l'état historique (cellules avec main
   courante, contacts de crise, scénarios et check-lists), modifiée sous verrou et sans copie. La clôture d'une
   cellule liée à un exercice planifié marque cet exercice « Réalisé » (droit du pilotage requis, comme dans l'outil
   historique). L'export Excel de la main courante et l'import des scénarios depuis Excel ne sont pas repris. */
import {
  ActionScenarioModification,
  AuteurCrise,
  CelluleOuverture,
  ChecklistBascule,
  PerimetreCrise,
  ContactModification,
  EcheanceCreation,
  EntreeCreation,
  ScenarioModification,
  lireEtatCrise,
  syntheseRetex,
  type EtatCrise,
} from '@suivi/shared';
import { isObject, nextLegacyId, type Json, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { DEFAULT_SMSI } from '../grc/core.js';
import { HttpError } from '../http/errors.js';
import { entrees, perimetreDe, remplacerEntree, type RegistreHistorique } from './registre.js';

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
const aUnId = (l: Json) => isObject(l) && typeof l.id === 'string' && l.id !== '';
/** Identifiants « CL- » du schéma 15 sur la main courante, uniques dans toutes les cellules, comme l'outil historique.
    Une entrée qui n'en a pas (écrite avant ce correctif) en reçoit un, avec la même numérotation qu'à l'export. */
function numeroterMainCourante(c: Racine) {
  const pris = c.cells.flatMap((x) => (isObject(x) ? liste(x.log).filter(aUnId) : [])).map((l) => (l as JsonObject).id);
  c.cells = c.cells.map((x) =>
    isObject(x) && liste(x.log).some((l) => isObject(l) && !aUnId(l))
      ? {
          ...x,
          log: liste(x.log).map((l) => {
            if (!isObject(l) || aUnId(l)) return l;
            const id = nextLegacyId('CL-', pris);
            pris.push(id);
            return { id, ...l };
          }),
        }
      : x,
  );
}

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

  async vue(user: SessionUser, smsi?: string): Promise<VueCrise> {
    const { version, data } = await this.r.lire(user, 'incidents');
    const lisibles = await this.r.perimetresLisibles(user);
    if (smsi && !lisibles.has(smsi)) throw new HttpError(404, 'Périmètre introuvable ou non accessible.');
    // Les cellules d'un périmètre illisible ne sont pas montrées (BUG-044).
    const crise = isObject(data.crisis) ? data.crisis : {};
    const visible = (x: Json) => isObject(x) && (smsi ? perimetreDe(x) === smsi : lisibles.has(perimetreDe(x)));
    const cellules = liste(crise.cells).filter(visible);
    // Contacts et scénarios suivent le même périmètre ; les contacts gardent leur rang d'origine (`lireEtatCrise`).
    const contactsBruts = liste(crise.contacts);
    const rangsVisibles = new Set(contactsBruts.flatMap((x, i) => (visible(x) ? [i] : [])));
    return {
      version,
      etat: (() => {
        const e = lireEtatCrise({ ...crise, cells: cellules, scenarios: liste(crise.scenarios).filter(visible) });
        return { ...e, contacts: e.contacts.filter((x) => rangsVisibles.has(x.rang)) };
      })(),
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
    return this.r.modifier(user, ip, { module: 'incidents', action, reference, droit }, async (data) => {
      const c = racine(data);
      const resultat = await appliquer(c, data);
      numeroterMainCourante(c);
      return resultat;
    });
  }
  /** Cellule `id`, après contrôle de l'accès (en écriture) au périmètre qui la porte (BUG-044). */
  /** Scénario `id`, après contrôle de l'accès (en écriture) au périmètre qui le porte (BUG-044). */
  private async scenario(c: Racine, id: string, user: SessionUser): Promise<JsonObject> {
    const x = parId(c.scenarios, id, 'Scénario');
    await this.r.exigerPerimetre(user, x, true, 'Scénario absent.');
    return x;
  }
  private async cellule(c: Racine, id: string, active: boolean, user: SessionUser): Promise<JsonObject> {
    const x = parId(c.cells, id, 'Cellule');
    await this.r.exigerPerimetre(user, x, true, 'Cellule absente.');
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
      async (c, data) => {
        const mode = body.mode ?? 'Exercice';
        const smsi = body.smsi ?? DEFAULT_SMSI;
        await this.r.exigerPerimetre(user, { smsi }, true, 'Périmètre introuvable ou non accessible.');
        if (body.scenario)
          await this.r.exigerPerimetre(user, parId(c.scenarios, body.scenario, 'Scénario'), false, 'Scénario absent.');
        if (body.plan && !entrees(data, 'plans').some((p) => p.id === body.plan && p.type === 'exo'))
          throw new HttpError(422, 'Exercice planifié absent.');
        const start = now();
        const cell: JsonObject = {
          id: `CRISE-${Date.now().toString(36)}`,
          smsi,
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
      async (c) => {
        const cell = await this.cellule(c, id, true, user);
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
        const cell = await this.cellule(c, id, true, user);
        const fin = now();
        const log = [...liste(cell.log), entreeLog('Décision', b.author ?? '', 'Clôture de la cellule.')];
        remplacer(c, 'cells', id, { ...cell, end: fin, status: 'Clôturée', log });
        numeroterMainCourante(c);
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
      async (c) => {
        const cell = await this.cellule(c, id, true, user);
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
      async (c) => {
        const cell = await this.cellule(c, id, true, user);
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
      async (c) => {
        const cell = await this.cellule(c, id, true, user);
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
      async (c) => {
        const cell = await this.cellule(c, id, true, user);
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
  creerContact(input: unknown, user: SessionUser, ip: string): Promise<{ id: string }> {
    const smsi = PerimetreCrise.parse(input ?? {}).smsi ?? DEFAULT_SMSI;
    return this.ecrire(
      user,
      ip,
      'crisis.contact-added',
      (x: { id: string }) => `legacy:crisis:contact:${x.id}`,
      async (c) => {
        await this.r.exigerPerimetre(user, { smsi }, true, 'Périmètre introuvable ou non accessible.');
        c.contacts = [
          ...c.contacts,
          {
            smsi,
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
      async (c) => {
        const x = c.contacts[k];
        if (!isObject(x)) throw new HttpError(404, 'Contact absent.');
        await this.r.exigerPerimetre(user, x, true, 'Contact absent.');
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
      async (c) => {
        const x = c.contacts[k];
        if (!isObject(x)) throw new HttpError(404, 'Contact absent.');
        await this.r.exigerPerimetre(user, x, true, 'Contact absent.');
        c.contacts = c.contacts.filter((_, i) => i !== k);
        return { id: String(k) };
      },
      'supprimer',
    );
  }
  /** Ajoute comme contacts clés les fournisseurs critiques ou hébergeurs HDS du registre qui n'y figurent pas. */
  importerFournisseurs(input: unknown, user: SessionUser, ip: string): Promise<{ id: string; ajoutes: number }> {
    const smsi = PerimetreCrise.parse(input ?? {}).smsi ?? DEFAULT_SMSI;
    return this.ecrire(
      user,
      ip,
      'crisis.contacts-imported',
      (x: { id: string }) => `legacy:crisis:contact:${x.id}`,
      async (c, data) => {
        await this.r.exigerPerimetre(user, { smsi }, true, 'Périmètre introuvable ou non accessible.');
        let n = 0;
        for (const s of entrees(data, 'suppliers').filter((s) => s.critical === 'Oui' || s.hds === 'Oui')) {
          if (c.contacts.some((x) => isObject(x) && x.org === s.name && perimetreDe(x) === smsi)) continue;
          c.contacts = [
            ...c.contacts,
            {
              smsi,
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
  creerScenario(input: unknown, user: SessionUser, ip: string): Promise<{ id: string }> {
    const smsi = PerimetreCrise.parse(input ?? {}).smsi ?? DEFAULT_SMSI;
    return this.ecrire(
      user,
      ip,
      'crisis.scenario-added',
      (x: { id: string }) => `legacy:crisis:${x.id}`,
      async (c) => {
        await this.r.exigerPerimetre(user, { smsi }, true, 'Périmètre introuvable ou non accessible.');
        const s: JsonObject = {
          smsi,
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
      async (c) => {
        const s = await this.scenario(c, id, user);
        remplacer(c, 'scenarios', id, { ...s, ...b });
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
      async (c) => {
        await this.scenario(c, id, user);
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
      async (c) => {
        const s = await this.scenario(c, id, user);
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
      async (c) => {
        const s = await this.scenario(c, id, user);
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
      async (c) => {
        const s = await this.scenario(c, id, user);
        const items = liste(s.items);
        if (!isObject(items[k])) throw new HttpError(404, 'Action absente.');
        remplacer(c, 'scenarios', id, { ...s, items: items.filter((_, i) => i !== k) });
        return { id };
      },
      'supprimer',
    );
  }
}

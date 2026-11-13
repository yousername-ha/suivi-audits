/* Registre des incidents (reprise de la page « Incidents » de l'outil de suivi) : clé `incidents` de l'état historique,
   modifiée sous verrou et sans copie. La qualification est recalculée côté serveur d'après les réponses au
   questionnaire ; une action du registre des écarts (INC-AC-nn) peut être créée depuis un incident (droit des écarts
   requis en plus), comme dans l'outil historique. */
import {
  EvenementRetexModification,
  EvenementRetexSaisie,
  IncidentCreation,
  MAX_EVENEMENTS_RETEX,
  identifiantEvenementRetex,
  IncidentModification,
  ObligationTraitee,
  identifiantActionIncident,
  identifiantIncident,
  lireIncident,
  qualifierIncident,
  type Incident,
  type Reponses,
} from '@suivi/shared';
import { isObject, type Json, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { DEFAULT_SMSI } from '../grc/core.js';
import { HttpError } from '../http/errors.js';
import { entrees, perimetreDe, remplacerEntree, type RegistreHistorique } from './registre.js';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const maintenant16 = () => new Date().toISOString().slice(0, 16);

export interface VueIncidents {
  version: number;
  incidents: Incident[];
  /** Catégorie d'entité NIS 2 de l'organisation, citée dans les obligations (vide si non renseignée). */
  categorieEntite: string;
  /** Statut des actions du registre des écarts rattachées aux incidents. */
  ecarts: Record<string, string>;
}

/** Nouvel incident brut : valeurs par défaut de l'outil historique, complétées par `o`. */
export function incidentBrut(data: JsonObject, o: JsonObject = {}): JsonObject {
  const annee = new Date().getFullYear();
  return {
    id: identifiantIncident(
      entrees(data, 'incidents').map((x) => str(x.id)),
      annee,
    ),
    createdAt: new Date().toISOString(),
    detectedAt: maintenant16(),
    reporter: '',
    title: '',
    desc: '',
    kind: 'Incident',
    cat: 'Autre',
    impact: '',
    urgency: '',
    status: 'Nouveau',
    owner: '',
    actions: '',
    cause: '',
    resolvedAt: '',
    retex: '',
    answers: {},
    notified: {},
    ...o,
  };
}
/** Chronologie brute du RETEX, telle que stockée (valeurs non objet conservées à leur place). */
const chronologieBrute = (i: JsonObject): Json[] => (Array.isArray(i.timeline) ? [...i.timeline] : []);

export const ajouterIncident = (data: JsonObject, brut: JsonObject) => {
  data.incidents = [...(Array.isArray(data.incidents) ? data.incidents : []), brut];
};

export class Incidents {
  constructor(private readonly r: RegistreHistorique) {}

  /** Registre des incidents lisibles par l'utilisateur : ceux des périmètres qu'il ouvre (BUG-044) ; `smsi` restreint la
      vue à un seul périmètre, qui doit alors être accessible. */
  async vue(user: SessionUser, smsi?: string): Promise<VueIncidents> {
    const { version, data } = await this.r.lire(user, 'incidents');
    const lisibles = await this.r.perimetresLisibles(user);
    if (smsi && !lisibles.has(smsi)) throw new HttpError(404, 'Périmètre introuvable ou non accessible.');
    const incidents = entrees(data, 'incidents')
      .filter((x) => (smsi ? perimetreDe(x) === smsi : lisibles.has(perimetreDe(x))))
      .map(lireIncident)
      .filter((x): x is Incident => !!x);
    const statuts = new Map(entrees(data, 'findings').map((f) => [str(f.id), str(f.status)]));
    return {
      version,
      incidents,
      categorieEntite: str(data.entityCategory),
      ecarts: Object.fromEntries(
        incidents.filter((i) => statuts.has(i.findingId)).map((i) => [i.findingId, statuts.get(i.findingId)!]),
      ),
    };
  }

  creer(input: unknown, user: SessionUser, ip: string): Promise<Incident> {
    const body = IncidentCreation.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'incidents', action: 'incident.created', reference: (x) => `legacy:incidents:${x.id}` },
      async (data) => {
        // Un incident relève d'un périmètre (BUG-044) : celui qui est affiché, sinon le périmètre commun.
        const smsi = body.smsi ?? DEFAULT_SMSI;
        await this.r.exigerPerimetre(user, { smsi }, true, 'Périmètre introuvable ou non accessible.');
        const q = body.answers ? qualifierIncident(body.answers as Reponses) : null;
        const brut = incidentBrut(data, {
          smsi,
          title: body.title ?? '',
          reporter: body.reporter ?? '',
          ...(q ? { kind: q.kind, status: 'Qualifié', answers: body.answers as JsonObject } : {}),
        });
        ajouterIncident(data, brut);
        return lireIncident(brut)!;
      },
    );
  }

  modifier(id: string, input: unknown, user: SessionUser, ip: string): Promise<Incident> {
    const body = IncidentModification.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'incidents', action: 'incident.updated', reference: (x) => `legacy:incidents:${x.id}` },
      async (data) => {
        const i = await this.trouver(data, id, user);
        const { answers, ...champs } = body;
        const suivant: JsonObject = { ...i, ...champs, ...(answers ? { answers: answers as JsonObject } : {}) };
        if (body.status && ['Résolu', 'Clos'].includes(body.status) && !str(suivant.resolvedAt))
          suivant.resolvedAt = maintenant16();
        remplacerEntree(data, 'incidents', id, suivant);
        return lireIncident(suivant)!;
      },
    );
  }

  supprimer(id: string, user: SessionUser, ip: string): Promise<{ id: string }> {
    return this.r.modifier(
      user,
      ip,
      {
        droit: 'supprimer',
        module: 'incidents',
        action: 'incident.deleted',
        reference: (x) => `legacy:incidents:${x.id}`,
      },
      async (data) => {
        await this.trouver(data, id, user);
        remplacerEntree(data, 'incidents', id, null);
        return { id };
      },
    );
  }

  /** Marque une obligation (indice dans la liste affichée) comme traitée ou non, avec l'horodatage du traitement. */
  obligation(id: string, k: number, input: unknown, user: SessionUser, ip: string): Promise<Incident> {
    const body = ObligationTraitee.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'incidents', action: 'incident.obligation', reference: (x) => `legacy:incidents:${x.id}` },
      async (data) => {
        const i = await this.trouver(data, id, user);
        const notified: JsonObject = isObject(i.notified) ? { ...i.notified } : {};
        if (body.traitee) notified[String(k)] = new Date().toISOString();
        else delete notified[String(k)];
        const suivant = { ...i, notified };
        remplacerEntree(data, 'incidents', id, suivant);
        return lireIncident(suivant)!;
      },
    );
  }

  /** Crée dans le registre des écarts l'action de l'incident (INC-AC-nn) : droit des écarts requis. */
  action(id: string, user: SessionUser, ip: string): Promise<{ id: string; findingId: string }> {
    return this.r.modifier(
      user,
      ip,
      {
        module: 'incidents',
        droits: ['ecarts'],
        action: 'incident.action-created',
        reference: (x) => `legacy:incidents:${x.id}`,
      },
      async (data, c) => {
        const i = await this.trouver(data, id, user);
        if (str(i.findingId)) throw new HttpError(409, `Une action existe déjà : ${str(i.findingId)}.`);
        const fid = identifiantActionIncident(entrees(data, 'findings').map((f) => str(f.id)));
        const connus = new Set(entrees(data, 'items').map((x) => str(x.id)));
        await this.r.creerEcart(c, user, ip, {
          id: fid,
          name: `Action issue de l’incident ${id} : ${str(i.title)}`,
          description: str(i.retex) || str(i.cause),
          findingType: 'opportunity',
          origin: 'incident',
          items: ['A-5.27'].filter((x) => connus.has(x)),
        });
        remplacerEntree(data, 'incidents', id, { ...i, findingId: fid });
        return { id, findingId: fid };
      },
    );
  }

  /* ------------------------------------------------------------------------------- RETEX : chronologie */
  /** Ajoute un événement à la chronologie du RETEX (champs inconnus des autres événements conservés). */
  ajouterEvenement(id: string, input: unknown, user: SessionUser, ip: string): Promise<Incident> {
    const body = EvenementRetexSaisie.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'incidents', action: 'incident.retex-added', reference: (x) => `legacy:incidents:${x.id}` },
      async (data) => {
        const i = await this.trouver(data, id, user);
        const liste = chronologieBrute(i);
        if (liste.length >= MAX_EVENEMENTS_RETEX)
          throw new HttpError(409, `La chronologie est limitée à ${MAX_EVENEMENTS_RETEX} événements.`);
        const eid = identifiantEvenementRetex(
          liste.filter(isObject).map((e) => str(e.id)),
          typeof i.timelineSeq === 'number' ? i.timelineSeq : 0,
        );
        const evenement: JsonObject = {
          id: eid,
          createdAt: new Date().toISOString(),
          description: '',
          acteur: '',
          gravite: '',
          ...body,
        };
        const suivant = { ...i, timeline: [...liste, evenement], timelineSeq: Number(eid.slice(3)) };
        remplacerEntree(data, 'incidents', id, suivant);
        return lireIncident(suivant)!;
      },
    );
  }

  modifierEvenement(id: string, eid: string, input: unknown, user: SessionUser, ip: string): Promise<Incident> {
    const body = EvenementRetexModification.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'incidents', action: 'incident.retex-updated', reference: (x) => `legacy:incidents:${x.id}` },
      async (data) => {
        const i = await this.trouver(data, id, user);
        const liste = chronologieBrute(i);
        if (liste.filter((e) => isObject(e) && e.id === eid).length !== 1)
          throw new HttpError(404, 'Événement absent de la chronologie.');
        const suivant = {
          ...i,
          timeline: liste.map((e) =>
            isObject(e) && e.id === eid ? { ...e, ...body, updatedAt: new Date().toISOString() } : e,
          ),
        };
        remplacerEntree(data, 'incidents', id, suivant);
        return lireIncident(suivant)!;
      },
    );
  }

  supprimerEvenement(id: string, eid: string, user: SessionUser, ip: string): Promise<Incident> {
    // Le contenu retiré reste au journal d'audit (BUG-050) ; retirer un événement exige le droit de suppression.
    let retire: JsonObject | undefined;
    return this.r.modifier(
      user,
      ip,
      {
        module: 'incidents',
        action: 'incident.retex-deleted',
        droit: 'supprimer',
        reference: (x) => `legacy:incidents:${x.id}`,
        detail: () => (retire ? { evenement: retire } : undefined),
      },
      async (data) => {
        const i = await this.trouver(data, id, user);
        const liste = chronologieBrute(i);
        const present = liste.find((e): e is JsonObject => isObject(e) && e.id === eid);
        if (!present) throw new HttpError(404, 'Événement absent de la chronologie.');
        retire = present;
        const suivant = { ...i, timeline: liste.filter((e) => !(isObject(e) && e.id === eid)) };
        remplacerEntree(data, 'incidents', id, suivant);
        return lireIncident(suivant)!;
      },
    );
  }

  /** Incident `id`, après contrôle de l'accès à son périmètre (écriture pour toute modification). */
  private async trouver(data: JsonObject, id: string, user: SessionUser, ecriture = true): Promise<JsonObject> {
    const t = entrees(data, 'incidents').filter((x) => x.id === id);
    if (t.length > 1) throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
    if (!t[0]) throw new HttpError(404, 'Incident absent.');
    await this.r.exigerPerimetre(user, t[0], ecriture, 'Incident absent.');
    return t[0];
  }
}

/* Registre des incidents (reprise de la page « Incidents » de l'outil de suivi) : clé `incidents` de l'état historique,
   modifiée sous verrou et sans copie. La qualification est recalculée côté serveur d'après les réponses au
   questionnaire ; une action du registre des écarts (INC-AC-nn) peut être créée depuis un incident (droit des écarts
   requis en plus), comme dans l'outil historique. */
import {
  IncidentCreation,
  IncidentModification,
  ObligationTraitee,
  identifiantActionIncident,
  identifiantIncident,
  lireIncident,
  qualifierIncident,
  type Incident,
  type Reponses,
} from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { entrees, remplacerEntree, type RegistreHistorique } from './registre.js';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const maintenant16 = () => new Date().toISOString().slice(0, 16);

export interface VueIncidents {
  version: number;
  incidents: Incident[];
  /** Catégorie d'entité NIS 2 du GCS, citée dans les obligations (vide si non renseignée). */
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
export const ajouterIncident = (data: JsonObject, brut: JsonObject) => {
  data.incidents = [...(Array.isArray(data.incidents) ? data.incidents : []), brut];
};

export class Incidents {
  constructor(private readonly r: RegistreHistorique) {}

  async vue(user: SessionUser): Promise<VueIncidents> {
    const { version, data } = await this.r.lire(user, 'incidents');
    const incidents = entrees(data, 'incidents')
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
      (data) => {
        const q = body.answers ? qualifierIncident(body.answers as Reponses) : null;
        const brut = incidentBrut(data, {
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
      (data) => {
        const i = this.trouver(data, id);
        const suivant: JsonObject = { ...i, ...body };
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
      (data) => {
        this.trouver(data, id);
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
      (data) => {
        const i = this.trouver(data, id);
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
        const i = this.trouver(data, id);
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

  private trouver(data: JsonObject, id: string): JsonObject {
    const t = entrees(data, 'incidents').filter((x) => x.id === id);
    if (t.length > 1) throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
    if (!t[0]) throw new HttpError(404, 'Incident absent.');
    return t[0];
  }
}

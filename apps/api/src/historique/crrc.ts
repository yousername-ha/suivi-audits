/* Gestion CRRC (reprise de la page de l'outil de suivi) : clé `crrc` de l'état historique (offres, établissements,
   ressources, sauvegardes, restaurations, alertes), modifiée sous verrou et sans copie. Comme dans l'outil historique,
   la suppression d'une ressource supprime ses sauvegardes et celle d'un contrat laisse ses ressources. Une alerte peut
   ouvrir une fiche du registre des incidents (droit des incidents requis en plus). L'import de rapports et l'export
   Excel ne sont pas repris. */
import {
  AlerteCreation,
  AlerteModification,
  EtablissementModification,
  OFFRE_SAUVEGARDE,
  OffreModification,
  RessourceCreation,
  RessourceModification,
  RestaurationCreation,
  RestaurationModification,
  SauvegardeCreation,
  identifiantCrrc,
  identifiantEtablissement,
  lireEtatCrrc,
  type EtatCrrc,
} from '@suivi/shared';
import { isObject, type Json, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { ajouterIncident, incidentBrut } from './incidents.js';
import type { RegistreHistorique } from './registre.js';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const CLES = ['offers', 'establishments', 'resources', 'runs', 'restores', 'alerts'] as const;
type Cle = (typeof CLES)[number];
const maintenantIso = () => new Date().toISOString().slice(0, 16);

const offreBrute = (): JsonObject => ({
  id: OFFRE_SAUVEGARDE.id,
  name: OFFRE_SAUVEGARDE.name,
  status: OFFRE_SAUVEGARDE.status,
  partner: OFFRE_SAUVEGARDE.partner,
  desc: OFFRE_SAUVEGARDE.desc,
  perimeters: OFFRE_SAUVEGARDE.perimeters.map((p) => [p.cle, p.libelle, p.description, p.etiquettes]),
});

/** Objet `crrc` de l'état (créé s'il manque) ; l'offre de sauvegarde y est ajoutée comme le fait l'outil historique. */
function racine(data: JsonObject): Record<Cle, Json[]> & JsonObject {
  const c: JsonObject = isObject(data.crrc) ? { ...data.crrc } : {};
  for (const k of CLES) c[k] = Array.isArray(c[k]) ? c[k] : [];
  if (!(c.offers as Json[]).some((o) => isObject(o) && o.id === 'backup'))
    c.offers = [offreBrute(), ...(c.offers as Json[])];
  data.crrc = c;
  return c as Record<Cle, Json[]> & JsonObject;
}
const trouver = (c: JsonObject, cle: Cle, id: string, libelle: string): JsonObject => {
  const t = (c[cle] as Json[]).filter((x): x is JsonObject => isObject(x) && x.id === id);
  if (t.length > 1) throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
  if (!t[0]) throw new HttpError(404, `${libelle} absent(e).`);
  return t[0];
};
const remplacer = (c: JsonObject, cle: Cle, id: string, suivante: JsonObject | null) => {
  c[cle] = (c[cle] as Json[]).flatMap((x) => (isObject(x) && x.id === id ? (suivante ? [suivante] : []) : [x]));
};

export class GestionCrrc {
  constructor(private readonly r: RegistreHistorique) {}

  async vue(user: SessionUser): Promise<{ version: number; etat: EtatCrrc }> {
    const { version, data } = await this.r.lire(user, 'crrc');
    return { version, etat: lireEtatCrrc(data.crrc) };
  }

  private ecrire<T extends { id: string }>(
    user: SessionUser,
    ip: string,
    action: string,
    appliquer: (c: Record<Cle, Json[]> & JsonObject, data: JsonObject) => T,
    droit: 'modifier' | 'supprimer' = 'modifier',
  ): Promise<T> {
    return this.r.modifier(
      user,
      ip,
      { module: 'crrc', action, droit, reference: (x) => `legacy:crrc:${x.id}` },
      (data) => appliquer(racine(data), data),
    );
  }

  /* -------------------------------------------------------------------------------- établissements */
  creerEtablissement(user: SessionUser, ip: string) {
    return this.ecrire(user, ip, 'crrc.establishment.created', (c) => {
      const brut: JsonObject = {
        id: identifiantEtablissement(c.establishments.length, Date.now()),
        createdAt: new Date().toISOString(),
        name: 'Nouvel établissement',
        finess: '',
        status: 'À compléter',
        adminContact: '',
        adminEmail: '',
        techContact: '',
        techEmail: '',
        prestataire: '',
        alerts: '',
        signed: '',
        serviceDate: '',
        capacityGb: 0,
        retentionDays: 90,
        offers: ['backup'],
        scopes: { s3: true },
        notes: '',
      };
      c.establishments = [brut, ...c.establishments];
      return { id: str(brut.id) };
    });
  }
  modifierEtablissement(id: string, input: unknown, user: SessionUser, ip: string) {
    const body = EtablissementModification.parse(input);
    return this.ecrire(user, ip, 'crrc.establishment.updated', (c) => {
      const e = trouver(c, 'establishments', id, 'Établissement');
      const { scopes, ...reste } = body;
      const suivante: JsonObject = { ...e, ...reste };
      if (scopes) suivante.scopes = { ...(isObject(e.scopes) ? e.scopes : {}), ...scopes } as JsonObject;
      remplacer(c, 'establishments', id, suivante);
      return { id };
    });
  }
  supprimerEtablissement(id: string, user: SessionUser, ip: string) {
    return this.ecrire(
      user,
      ip,
      'crrc.establishment.deleted',
      (c) => {
        trouver(c, 'establishments', id, 'Établissement');
        remplacer(c, 'establishments', id, null);
        return { id };
      },
      'supprimer',
    );
  }

  /* ------------------------------------------------------------------------------------- ressources */
  creerRessource(input: unknown, user: SessionUser, ip: string) {
    const body = RessourceCreation.parse(input);
    return this.ecrire(user, ip, 'crrc.resource.created', (c) => {
      const est = body.est ?? str((c.establishments.find(isObject) as JsonObject | undefined)?.id);
      if (body.est) trouver(c, 'establishments', body.est, 'Établissement');
      const brut: JsonObject = {
        id: identifiantCrrc('RES', Date.now()),
        createdAt: new Date().toISOString(),
        est,
        name: 'Nouvelle ressource',
        tech: body.tech ?? 's3',
        freq: 'Quotidienne',
        notes: '',
      };
      c.resources = [...c.resources, brut];
      return { id: str(brut.id) };
    });
  }
  modifierRessource(id: string, input: unknown, user: SessionUser, ip: string) {
    const body = RessourceModification.parse(input);
    return this.ecrire(user, ip, 'crrc.resource.updated', (c) => {
      const x = trouver(c, 'resources', id, 'Ressource');
      if (body.est) trouver(c, 'establishments', body.est, 'Établissement');
      remplacer(c, 'resources', id, { ...x, ...body } as JsonObject);
      return { id };
    });
  }
  supprimerRessource(id: string, user: SessionUser, ip: string) {
    return this.ecrire(
      user,
      ip,
      'crrc.resource.deleted',
      (c) => {
        trouver(c, 'resources', id, 'Ressource');
        remplacer(c, 'resources', id, null);
        c.runs = c.runs.filter((x) => !(isObject(x) && x.res === id));
        return { id };
      },
      'supprimer',
    );
  }

  /* ----------------------------------------------------------------------------------- sauvegardes */
  creerSauvegarde(res: string, input: unknown, user: SessionUser, ip: string) {
    const body = SauvegardeCreation.parse(input);
    return this.ecrire(user, ip, 'crrc.run.created', (c) => {
      trouver(c, 'resources', res, 'Ressource');
      const brut: JsonObject = { id: identifiantCrrc('RUN', Date.now()), res, ...body };
      c.runs = [...c.runs, brut];
      return { id: str(brut.id) };
    });
  }
  supprimerSauvegarde(id: string, user: SessionUser, ip: string) {
    return this.ecrire(
      user,
      ip,
      'crrc.run.deleted',
      (c) => {
        trouver(c, 'runs', id, 'Sauvegarde');
        remplacer(c, 'runs', id, null);
        return { id };
      },
      'supprimer',
    );
  }

  /* --------------------------------------------------------------------------------- restaurations */
  creerRestauration(input: unknown, user: SessionUser, ip: string) {
    const body = RestaurationCreation.parse(input);
    return this.ecrire(user, ip, 'crrc.restore.created', (c) => {
      const res = trouver(c, 'resources', body.res, 'Ressource');
      const brut: JsonObject = {
        id: identifiantCrrc('RST', Date.now()),
        createdAt: new Date().toISOString(),
        date: maintenantIso(),
        est: str(res.est),
        res: body.res,
        scope: body.scope || 'Intégralité',
        type: body.type,
        status: 'Demandée',
        owner: body.owner,
        duration: '',
        dest: body.dest,
        path: body.path,
        conflict: body.conflict,
        point: body.point,
      };
      c.restores = [...c.restores, brut];
      return { id: str(brut.id) };
    });
  }
  modifierRestauration(id: string, input: unknown, user: SessionUser, ip: string) {
    const body = RestaurationModification.parse(input);
    return this.ecrire(user, ip, 'crrc.restore.updated', (c) => {
      remplacer(c, 'restores', id, { ...trouver(c, 'restores', id, 'Restauration'), ...body });
      return { id };
    });
  }

  /* ---------------------------------------------------------------------------------------- alertes */
  creerAlerte(input: unknown, user: SessionUser, ip: string) {
    const body = AlerteCreation.parse(input);
    return this.ecrire(user, ip, 'crrc.alert.created', (c) => {
      const res = trouver(c, 'resources', body.res, 'Ressource');
      const brut: JsonObject = {
        id: identifiantCrrc('ALR', Date.now()),
        createdAt: new Date().toISOString(),
        date: maintenantIso(),
        severity: body.severity,
        est: str(res.est),
        res: body.res,
        message: body.message,
        status: 'Ouverte',
      };
      c.alerts = [...c.alerts, brut];
      return { id: str(brut.id) };
    });
  }
  modifierAlerte(id: string, input: unknown, user: SessionUser, ip: string) {
    const body = AlerteModification.parse(input);
    return this.ecrire(user, ip, 'crrc.alert.updated', (c) => {
      remplacer(c, 'alerts', id, { ...trouver(c, 'alerts', id, 'Alerte'), ...body });
      return { id };
    });
  }

  /** Ouvre une fiche du registre des incidents depuis une alerte (qualifiée, rapportée par « Gestion CRRC »). */
  creerIncidentAlerte(id: string, user: SessionUser, ip: string) {
    return this.r.modifier(
      user,
      ip,
      {
        module: 'crrc',
        droits: ['incidents'],
        action: 'crrc.alert.incident-created',
        reference: (x: { id: string }) => `legacy:crrc:${x.id}`,
      },
      (data) => {
        const c = racine(data);
        const al = trouver(c, 'alerts', id, 'Alerte');
        if (str(al.incident)) throw new HttpError(409, `Un incident existe déjà : ${str(al.incident)}.`);
        const nom = (cle: Cle, ref: unknown) => c[cle].find((x): x is JsonObject => isObject(x) && x.id === ref)?.name;
        const quand = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(str(al.date));
        const date = quand ? `${quand[3]}/${quand[2]}/${quand[1]} ${quand[4]}` : str(al.date);
        const incident = incidentBrut(data, {
          title: `Sauvegarde : ${str(al.message) || 'alerte'} (${str(nom('establishments', al.est))})`,
          desc: `Alerte ${id} du ${date} sur ${str(nom('resources', al.res))}.`,
          kind: al.severity === 'Haute' ? 'Incident' : 'Événement',
          cat: 'Indisponibilité de service',
          status: 'Qualifié',
          reporter: 'Gestion CRRC',
        });
        ajouterIncident(data, incident);
        remplacer(c, 'alerts', id, {
          ...al,
          incident: str(incident.id),
          status: str(al.status) === 'Ouverte' ? 'En cours' : str(al.status),
        });
        return { id, incident: str(incident.id) };
      },
    );
  }

  /* ------------------------------------------------------------------------------------------ offres */
  creerOffre(user: SessionUser, ip: string) {
    return this.ecrire(user, ip, 'crrc.offer.created', (c) => {
      const brut: JsonObject = {
        id: identifiantCrrc('OFF', Date.now()),
        name: 'Nouvelle offre CRRC',
        status: 'En préparation',
        partner: '',
        desc: '',
      };
      c.offers = [...c.offers, brut];
      return { id: str(brut.id) };
    });
  }
  modifierOffre(id: string, input: unknown, user: SessionUser, ip: string) {
    const body = OffreModification.parse(input);
    return this.ecrire(user, ip, 'crrc.offer.updated', (c) => {
      remplacer(c, 'offers', id, { ...trouver(c, 'offers', id, 'Offre'), ...body });
      return { id };
    });
  }
  supprimerOffre(id: string, user: SessionUser, ip: string) {
    return this.ecrire(
      user,
      ip,
      'crrc.offer.deleted',
      (c) => {
        if (id === 'backup') throw new HttpError(422, 'L’offre de sauvegarde ne se supprime pas.');
        trouver(c, 'offers', id, 'Offre');
        remplacer(c, 'offers', id, null);
        return { id };
      },
      'supprimer',
    );
  }
}

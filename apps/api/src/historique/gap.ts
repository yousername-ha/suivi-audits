/* Applications à intégrer au périmètre (reprise de « Applications à intégrer » de l'outil de suivi) : clé `appGaps` de
   l'état historique, modifiée sous verrou et sans copie. La liste de contrôle, les états et le questionnaire guidé sont
   ceux de l'outil historique (`@suivi/shared`, testés en parité). Le questionnaire guidé peut créer le plan d'action
   (registre des écarts), un fournisseur et un usage du registre IA ; la préparation d'une évaluation de sécurité du
   fournisseur n'est pas reprise (voir l'évaluation de sécurité des fournisseurs). */
import {
  AppGapModification,
  GuideGapCreation,
  LigneGapModification,
  PointGapCreation,
  etatPointGap,
  identifiantApp,
  identifiantEcartGap,
  identifiantExigence,
  lireAppGap,
  pointsGap,
  questionnaireGap,
  questionnaireGapIa,
  questionsIaVisibles,
  type AppGap,
} from '@suivi/shared';
import { itemCode } from '@suivi/shared/audit';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { entrees, type RegistreHistorique } from './registre.js';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export interface VueGap {
  version: number;
  apps: AppGap[];
  fournisseurs: { id: string; name: string }[];
  exigences: { id: string; code: string; titre: string }[];
  /** Exigences exclues de la déclaration d'applicabilité (points « Non applicable » par défaut). */
  exclues: string[];
  /** Actions du registre des écarts liées (identifiant → statut). */
  ecarts: Record<string, string>;
}

export class Gap {
  constructor(private readonly r: RegistreHistorique) {}

  async vue(user: SessionUser): Promise<VueGap> {
    const { version, data } = await this.r.lire(user, 'conformite');
    const dda = isObject(data.dda) ? data.dda : {};
    const items = entrees(data, 'items').filter((i) => str(i.id));
    return {
      version,
      apps: entrees(data, 'appGaps')
        .map(lireAppGap)
        .filter((x): x is AppGap => !!x),
      fournisseurs: entrees(data, 'suppliers')
        .map((s) => ({ id: str(s.id), name: str(s.name) }))
        .filter((s) => s.id),
      exigences: items.map((i) => ({
        id: str(i.id),
        code: itemCode({ ref: str(i.ref), num: str(i.num) }),
        titre: str(i.title),
      })),
      exclues: items
        .filter((i) => isObject(dda[str(i.id)]) && (dda[str(i.id)] as JsonObject).app === 'non')
        .map((i) => str(i.id)),
      ecarts: Object.fromEntries(
        entrees(data, 'findings')
          .filter((f) => str(f.id))
          .map((f) => [str(f.id), str(f.status)]),
      ),
    };
  }

  /** Ajout sans questionnaire. */
  async creer(user: SessionUser, ip: string): Promise<AppGap> {
    return this.r.modifier(
      user,
      ip,
      { module: 'conformite', action: 'gap.created', reference: (a) => `legacy:appGaps:${a.id}` },
      (data) => {
        const liste = entrees(data, 'appGaps');
        const id = identifiantApp(liste.map((a) => str(a.id)));
        const neuve: JsonObject = {
          id,
          createdAt: new Date().toISOString(),
          name: 'Nouvelle application',
          supplier: '',
          dscp: 'À qualifier',
          cloud: 'À qualifier',
          status: 'À étudier',
          owner: '',
          target: '',
          desc: '',
          lines: {},
          custom: [],
        };
        data.appGaps = [...(Array.isArray(data.appGaps) ? data.appGaps : []), neuve];
        return lireAppGap(neuve)!;
      },
    );
  }

  async modifier(id: string, input: unknown, user: SessionUser, ip: string): Promise<AppGap> {
    const body = AppGapModification.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'conformite', action: 'gap.updated', reference: (a) => `legacy:appGaps:${a.id}` },
      (data) => {
        if (body.supplier && !entrees(data, 'suppliers').some((s) => s.id === body.supplier))
          throw new HttpError(422, 'Fournisseur absent du registre.');
        return lireAppGap(this.remplacer(data, id, (a) => ({ ...a, ...body })))!;
      },
    );
  }

  async supprimer(id: string, user: SessionUser, ip: string): Promise<{ id: string }> {
    return this.r.modifier(
      user,
      ip,
      { droit: 'supprimer', module: 'conformite', action: 'gap.deleted', reference: (a) => `legacy:appGaps:${a.id}` },
      (data) => {
        this.trouver(data, id);
        data.appGaps = (data.appGaps as JsonObject[]).filter((a) => !(isObject(a) && a.id === id));
        return { id };
      },
    );
  }

  /** État, constat, pilote ou échéance d'un point de la liste de contrôle. */
  async majPoint(id: string, ligne: string, input: unknown, user: SessionUser, ip: string): Promise<AppGap> {
    const body = LigneGapModification.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'conformite', action: 'gap.line-updated', reference: (a) => `legacy:appGaps:${a.id}` },
      (data) => {
        const brut = this.trouver(data, id);
        const app = lireAppGap(brut)!;
        const point = pointsGap(app).find((p) => p.id === ligne);
        if (!point) throw new HttpError(404, 'Point de contrôle absent de cette application.');
        const avant = isObject(brut.lines) && isObject(brut.lines[ligne]) ? (brut.lines[ligne] as JsonObject) : {};
        const suivant = this.remplacer(data, id, (a) => ({
          ...a,
          lines: { ...(isObject(a.lines) ? a.lines : {}), [ligne]: { ...avant, ...body } },
        }));
        return lireAppGap(suivant)!;
      },
    );
  }

  async ajouterPoint(id: string, input: unknown, user: SessionUser, ip: string): Promise<AppGap> {
    const body = PointGapCreation.parse(input);
    return this.r.modifier(
      user,
      ip,
      { module: 'conformite', action: 'gap.point-created', reference: (a) => `legacy:appGaps:${a.id}` },
      (data) => {
        const connues = new Set(entrees(data, 'items').map((i) => str(i.id)));
        const refs = body.refs
          .split(/[;,]/)
          .map((x) => identifiantExigence(x))
          .filter((x): x is string => !!x && connues.has(x));
        return lireAppGap(
          this.remplacer(data, id, (a) => {
            const custom = Array.isArray(a.custom) ? a.custom.filter(isObject) : [];
            let k = 1;
            while (custom.some((l) => l.id === 'C' + k)) k++;
            return {
              ...a,
              custom: [...custom, { id: 'C' + k, sec: 'per', refs, t: body.t, createdAt: new Date().toISOString() }],
            };
          }),
        )!;
      },
    );
  }

  async retirerPoint(id: string, ligne: string, user: SessionUser, ip: string): Promise<AppGap> {
    return this.r.modifier(
      user,
      ip,
      {
        droit: 'supprimer',
        module: 'conformite',
        action: 'gap.point-deleted',
        reference: (a) => `legacy:appGaps:${a.id}`,
      },
      (data) => {
        const app = lireAppGap(this.trouver(data, id))!;
        if (!app.custom.some((l) => l.id === ligne)) throw new HttpError(404, 'Seuls les points ajoutés se retirent.');
        return lireAppGap(
          this.remplacer(data, id, (a) => {
            const lines = { ...(isObject(a.lines) ? a.lines : {}) };
            delete lines[ligne];
            return {
              ...a,
              lines,
              custom: (Array.isArray(a.custom) ? a.custom : []).filter((l) => !(isObject(l) && l.id === ligne)),
            };
          }),
        )!;
      },
    );
  }

  /** Crée une action dans le registre des écarts pour un point partiel ou non conforme. */
  async creerAction(id: string, ligne: string, user: SessionUser, ip: string): Promise<{ app: AppGap; ecart: string }> {
    return this.r.modifier(
      user,
      ip,
      {
        module: 'conformite',
        droits: ['ecarts'],
        action: 'gap.finding-created',
        reference: (x) => `legacy:appGaps:${x.app.id}`,
      },
      async (data, c) => {
        const brut = this.trouver(data, id);
        const app = lireAppGap(brut)!;
        const point = pointsGap(app).find((p) => p.id === ligne);
        if (!point) throw new HttpError(404, 'Point de contrôle absent de cette application.');
        const exclues = new Set<string>();
        const etat = etatPointGap(app, point, exclues);
        if (!['Partiel', 'Non conforme'].includes(etat))
          throw new HttpError(409, 'Seul un point partiel ou non conforme crée une action.');
        const v = app.lines[ligne] ?? {};
        if (v.fd) throw new HttpError(409, `Une action existe déjà : ${v.fd}.`);
        const ecart = identifiantEcartGap(entrees(data, 'findings').map((f) => str(f.id)));
        await this.r.creerEcart(c, user, ip, {
          id: ecart,
          name: `${app.name} : ${point.t}`,
          description: [v.comment ?? '', `Analyse d'écart ${app.id}, point ${point.id}.`].filter(Boolean).join('\n'),
          findingType: 'observation',
          items: point.refs.slice(),
          dueAt: v.due || app.target,
        });
        const suivante = this.remplacer(data, id, (a) => ({
          ...a,
          lines: {
            ...(isObject(a.lines) ? a.lines : {}),
            [ligne]: { ...(isObject(a.lines) && isObject(a.lines[ligne]) ? a.lines[ligne] : {}), fd: ecart },
          },
        }));
        return { app: lireAppGap(suivante)!, ecart };
      },
    );
  }

  /** Questionnaire guidé : crée l'application avec sa liste de contrôle pré-évaluée, et au choix le plan d'action, le
      et le fournisseur. */
  async guider(
    input: unknown,
    user: SessionUser,
    ip: string,
  ): Promise<{ app: AppGap; plan: string | null; fournisseur: string | null }> {
    const b = GuideGapCreation.parse(input);
    return this.r.modifier(
      user,
      ip,
      {
        module: 'conformite',
        droits: ['ecarts'],
        action: 'gap.guided',
        reference: (x) => `legacy:appGaps:${x.app.id}`,
      },
      async (data, c) => {
        const ia = b.modele === 'ia';
        // GAP IA : seules les réponses aux questions des cas d'usage choisis sont retenues.
        const visibles = new Set(questionsIaVisibles(b.answers).map((x) => x.k));
        const reponses = ia
          ? Object.fromEntries(Object.entries(b.answers).filter(([k]) => visibles.has(k)))
          : b.answers;
        const q = ia ? questionnaireGapIa(reponses) : questionnaireGap(reponses);
        const maintenant = new Date().toISOString();
        const id = identifiantApp(entrees(data, 'appGaps').map((a) => str(a.id)));
        const fournisseurs = entrees(data, 'suppliers');
        let fournisseur = b.supplier;
        let fournisseurCree: string | null = null;
        if (fournisseur && !fournisseurs.some((s) => s.id === fournisseur))
          throw new HttpError(422, 'Fournisseur absent du registre.');
        if (!ia && !fournisseur && b.supplierNew) {
          await this.r.g.permission(user, 'fournisseurs', 'modifier');
          let n = 1;
          while (fournisseurs.some((s) => s.id === 'SUP' + String(n).padStart(2, '0'))) n++;
          fournisseur = 'SUP' + String(n).padStart(2, '0');
          fournisseurCree = fournisseur;
          data.suppliers = [
            ...(Array.isArray(data.suppliers) ? data.suppliers : []),
            {
              id: fournisseur,
              createdAt: maintenant,
              name: b.supplierNew,
              saas: q.saas,
              rattachement: '',
              sso: '',
              mfa: '',
              critical: str(b.answers.crit).startsWith('Critique') ? 'Oui' : '',
              hds: q.dscp === 'Oui' && q.fournisseur ? 'Oui' : '',
              notes: `Ajouté par le GAP guidé ${id}.`,
              controls: [],
              certs: [],
            },
          ];
        }
        const lines: Record<string, JsonObject> = {};
        for (const l of new Set([...Object.keys(q.st), ...Object.keys(q.cm)])) {
          lines[l] = {};
          if (q.st[l]) lines[l]!.st = q.st[l]!;
          if (q.cm[l]) lines[l]!.comment = 'Questionnaire : ' + q.cm[l];
        }
        const brut: JsonObject = {
          id,
          createdAt: maintenant,
          name: b.name,
          supplier: fournisseur,
          dscp: q.dscp,
          cloud: q.cloud,
          status: 'En cours',
          owner: b.owner,
          target: b.target,
          desc: b.desc,
          ...(ia ? { modele: 'ia' } : {}),
          lines,
          custom: q.custom.map((x) => ({ ...x, createdAt: maintenant })),
          profile: { ...reponses, at: maintenant },
        };
        let app = lireAppGap(brut)!;
        let plan: string | null = null;
        if (b.mkPlan) {
          const connues = new Set(entrees(data, 'items').map((i) => str(i.id)));
          const aFaire = pointsGap(app).filter(
            (l) => !['Conforme', 'Non applicable'].includes(etatPointGap(app, l, new Set())),
          );
          plan = identifiantEcartGap(entrees(data, 'findings').map((f) => str(f.id)));
          await this.r.creerEcart(c, user, ip, {
            id: plan,
            name: ia
              ? `Maîtrise de l’IA : « ${app.name} » (ISO 27001 / HDS)`
              : `Intégration de « ${app.name} » au périmètre ISO 27001 / HDS`,
            description: [b.desc, 'Points à traiter :', ...aFaire.map((l) => `- ${l.t}`)].filter(Boolean).join('\n'),
            findingType: 'observation',
            items: [...new Set(aFaire.flatMap((l) => l.refs))].filter((r) => connues.has(r)),
            dueAt: b.target,
          });
          for (const l of aFaire) lines[l.id] = { ...(lines[l.id] ?? {}), fd: plan };
          brut.planFd = plan;
          app = lireAppGap(brut)!;
        }
        data.appGaps = [...(Array.isArray(data.appGaps) ? data.appGaps : []), brut];
        return { app, plan, fournisseur: fournisseurCree };
      },
    );
  }

  /* ------------------------------------------------------------------------------------------------ interne */
  private trouver(data: JsonObject, id: string): JsonObject {
    const t = entrees(data, 'appGaps').filter((a) => a.id === id);
    if (t.length > 1) throw new HttpError(409, 'Identifiant historique ambigu : corrigez les doublons dans la source.');
    if (!t[0]) throw new HttpError(404, 'Application absente.');
    return t[0];
  }
  private remplacer(data: JsonObject, id: string, f: (a: JsonObject) => JsonObject): JsonObject {
    const suivante = f(this.trouver(data, id));
    data.appGaps = (data.appGaps as JsonObject[]).map((a) => (isObject(a) && a.id === id ? suivante : a));
    return suivante;
  }
}

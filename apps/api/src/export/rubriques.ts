/* Exports Excel par rubrique de l'outil de suivi : jeux de données et groupes repris de l'outil historique (feuilles,
   colonnes, largeurs), construits à partir de l'état recomposé et filtré selon les droits de la personne qui exporte.
   Les états calculés (échéances, niveaux, scores) viennent des fonctions partagées utilisées par l'interface. */
import {
  FREQUENCES_CONTROLE,
  PLANS,
  actionPlanEtat,
  etatCertificats,
  etatControle,
  etatIndicateur,
  formatValeurIndicateur,
  prioriteIncident,
  recurrenceSuivante,
  revueEtat,
  valeurIndicateur,
  evaluationIa,
  etapeIa,
  lireAppGap,
  etatPointGap,
  pointsGap,
  SECTIONS_GAP,
  statsGap,
  lireEvaluationClausier,
  pointsEvaluation,
  scoreEvaluation,
  etatPoint,
  type TypePlan,
} from '@suivi/shared';
import {
  AUDIT_REF_EXPORT_LABELS,
  LV,
  PREP_LABELS,
  analyzeAll,
  itemCode,
  type AuditState,
  type AuditRef,
  type PrepValue,
} from '@suivi/shared/audit';
import { CLAUSIER_2026 } from '../historique/clausier-club-rssi-sante-2026.js';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { Feuille } from './classeur.js';

type Obj = Record<string, unknown>;
type Cellule = string | number;
interface Contexte {
  etat: JsonObject;
  aujourdhui: string;
}
interface Jeu {
  titre: (c: Contexte) => string;
  colonnes: readonly (readonly [string, number])[];
  lignes: (c: Contexte) => Cellule[][];
}

const objs = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x): x is Obj => isObject(x as never)) : []);
const obj = (v: unknown): Obj => (isObject(v as never) ? (v as Obj) : {});
const texte = (v: unknown): string => (v == null ? '' : typeof v === 'string' ? v : String(v));
const nombre = (v: unknown): number => (Number.isFinite(+(v as number)) ? +(v as number) : 0);
/** Date ISO (ou date-heure) affichée jj/mm/aaaa ; une autre valeur est reprise telle quelle. */
const dFr = (v: unknown): string => {
  const s = texte(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : s;
};
const dateHeure = (v: unknown) => texte(v).replace('T', ' ');
const moisFr = (v: unknown) => {
  const m = /^(\d{4})-(\d{2})$/.exec(texte(v));
  return m ? `${m[2]}/${m[1]}` : texte(v);
};
const oui = (b: unknown) => (b ? 'Oui' : 'Non');
const codeMesure = (m: Obj) =>
  m.ref === 'A' ? `A.${texte(m.num)}` : m.ref === 'HDS' ? `HDS ${texte(m.num)}` : texte(m.num);
const typeEcart = (t: unknown) =>
  ({ NC: 'Non-conformité', PP: 'Point sensible', OBS: 'Observation' })[texte(t)] ?? texte(t);

const liste = (v: unknown) => (Array.isArray(v) ? v.map(texte).filter(Boolean).join(', ') : '');

const REF_DDA = {
  ISO: 'ISO 27001 — clauses 4 à 10',
  A: "Déclaration d'applicabilité — Annexe A",
  HDS: "Déclaration d'applicabilité — HDS v2",
};
const COLONNES_DDA = [
  ['Mesure', 10],
  ['Intitulé', 46],
  ['Applicable', 11],
  ['Mise en œuvre', 14],
  ['Actions ou justification', 50],
  ['Documents', 40],
  ['Lien', 30],
  ['Écarts ouverts', 18],
] as const;
const lignesDda =
  (ref: 'ISO' | 'A' | 'HDS') =>
  ({ etat }: Contexte): Cellule[][] => {
    const dda = obj(etat.dda);
    const ecarts = objs(etat.findings);
    return objs(etat.items)
      .filter((m) => m.ref === ref)
      .map((m) => {
        const d = obj(dda[texte(m.id)]);
        const ouverts = ecarts
          .filter((f) => f.status !== 'Clos' && Array.isArray(f.items) && (f.items as unknown[]).includes(m.id))
          .map((f) => texte(f.id))
          .join(', ');
        return [
          codeMesure(m),
          texte(m.title),
          ref === 'ISO' ? 'Obligatoire' : texte(d.app),
          d.app === 'non' ? 'Exclue' : texte(d.level) || 'Non renseigné',
          d.app === 'non' ? texte(d.just) : texte(d.actions),
          texte(d.docs),
          texte(d.url),
          ouverts,
        ];
      });
  };

const nomFournisseur = (etat: JsonObject, id: unknown) =>
  texte(objs(etat.suppliers).find((s) => s.id === id)?.name) || texte(id);

/** Exigences exclues de la déclaration d'applicabilité (points GAP « Non applicable » par défaut). */
const exigencesExclues = (etat: JsonObject): Set<string> => {
  const dda = obj(etat.dda);
  return new Set(
    objs(etat.items)
      .filter((i) => obj(dda[texte(i.id)]).app === 'non')
      .map((i) => texte(i.id)),
  );
};
const appsGap = (etat: JsonObject) =>
  (Array.isArray(etat.appGaps) ? etat.appGaps : []).map(lireAppGap).filter((a): a is NonNullable<typeof a> => !!a);
const codeExigence = (etat: JsonObject, id: string) => {
  const m = objs(etat.items).find((x) => x.id === id);
  return m ? codeMesure(m) : id;
};

export const JEUX: Record<string, Jeu> = {
  plan: {
    titre: ({ etat }) => `Plan de l'audit ${texte(etat.nextYear)}`.trim(),
    colonnes: [
      ['Jour', 10],
      ['Date', 12],
      ['Début', 8],
      ['Fin', 8],
      ['Thème', 40],
      ['Détail', 60],
      ['Mesures', 40],
      ['Participants', 40],
    ],
    lignes: ({ etat }) => {
      const plan = obj(etat.plan);
      const jours = objs(plan.days);
      const personnes = objs(plan.people);
      const mesures = objs(etat.items);
      return objs(plan.slots).map((s) => {
        const j = jours.find((x) => x.id === s.day) ?? {};
        return [
          texte(j.label),
          dFr(j.date),
          texte(s.start),
          texte(s.end),
          texte(s.title),
          texte(s.detail),
          (Array.isArray(s.items) ? (s.items as unknown[]) : [])
            .map((id) => {
              const m = mesures.find((x) => x.id === id);
              return m ? codeMesure(m) : texte(id);
            })
            .join(', '),
          (Array.isArray(s.people) ? (s.people as unknown[]) : [])
            .map((id) => texte(personnes.find((p) => p.id === id)?.name) || texte(id))
            .join(', '),
        ];
      });
    },
  },
  participants: {
    titre: () => 'Participants',
    colonnes: [
      ['Personne ou fonction', 30],
      ['Rôle', 40],
      ['Créneaux', 60],
    ],
    lignes: ({ etat }) => {
      const plan = obj(etat.plan);
      const creneaux = objs(plan.slots);
      return objs(plan.people).map((p) => [
        texte(p.name),
        texte(p.role),
        creneaux
          .filter((s) => Array.isArray(s.people) && (s.people as unknown[]).includes(p.id))
          .map((s) => `${texte(s.start)} ${texte(s.title)}`.trim())
          .join(' ; '),
      ]);
    },
  },
  couverture: {
    titre: () => "Couverture du cycle d'audit",
    colonnes: [
      ['Mesure', 10],
      ['Intitulé', 46],
      ['Année', 8],
      ['AFNOR', 12],
      ['Interne', 12],
    ],
    lignes: ({ etat }) => {
      const annees = Array.isArray(etat.years) ? (etat.years as unknown[]) : [];
      return objs(etat.items).flatMap((m) =>
        annees.map((a) => [
          codeMesure(m),
          texte(m.title),
          texte(a),
          texte(obj(m.afnor)[texte(a)]),
          texte(obj(m.interne)[texte(a)]),
        ]),
      );
    },
  },
  objectifs: {
    titre: () => 'Objectifs de sécurité',
    colonnes: [
      ['ID', 8],
      ['Objectif', 60],
      ['Processus', 18],
      ['Échéance', 12],
      ['Responsable', 16],
      ['Indicateurs atteints', 14],
    ],
    lignes: ({ etat }) => {
      const inds = objs(etat.indicators);
      return objs(etat.objectives).map((o) => {
        const siens = inds.filter((i) => i.obj === o.id);
        return [
          texte(o.id),
          texte(o.name),
          liste(o.processes),
          dFr(o.due),
          texte(o.owner),
          `${siens.filter((i) => etatIndicateur(i, etat) === 'ok').length}/${siens.length}`,
        ];
      });
    },
  },
  indicateurs: {
    titre: () => 'Indicateurs',
    colonnes: [
      ['Objectif', 8],
      ['ID', 11],
      ['Indicateur', 56],
      ['Fréquence', 12],
      ['Cible', 14],
      ['Valeur courante', 16],
      ['Date de la valeur', 14],
      ['État', 14],
      ["Plan d'action", 44],
      ['Responsable', 18],
      ['Échéance', 12],
    ],
    lignes: ({ etat }) =>
      objs(etat.indicators).map((i) => {
        const v = valeurIndicateur(i, etat);
        const st = etatIndicateur(i, etat);
        return [
          texte(i.obj),
          texte(i.id),
          texte(i.name),
          texte(i.freq),
          `${texte(i.dir) || '?'} ${formatValeurIndicateur(i, i.target)}`,
          formatValeurIndicateur(i, v.v),
          dFr(v.date),
          { ok: 'Atteint', ko: 'Non atteint', na: 'Non mesuré', undef: 'Cible à définir' }[st] ?? st,
          texte(i.action),
          texte(i.actionOwner),
          dFr(i.actionDue),
        ];
      }),
  },
  processus: {
    titre: () => 'Processus',
    colonnes: [
      ['Code', 10],
      ['Processus', 50],
      ['Famille', 14],
      ['Pilote', 20],
    ],
    lignes: ({ etat }) =>
      objs(etat.processes).map((p) => [texte(p.id), texte(p.name), texte(p.family), texte(p.owner)]),
  },
  clauses: { titre: () => REF_DDA.ISO, colonnes: COLONNES_DDA, lignes: lignesDda('ISO') },
  annexeA: { titre: () => REF_DDA.A, colonnes: COLONNES_DDA, lignes: lignesDda('A') },
  hds: { titre: () => REF_DDA.HDS, colonnes: COLONNES_DDA, lignes: lignesDda('HDS') },
  ecarts: {
    titre: () => 'Registre des écarts',
    colonnes: [
      ['ID', 13],
      ['Source', 9],
      ['Année', 7],
      ['Type', 14],
      ['Statut', 10],
      ['Constat', 50],
      ['Description', 70],
      ['Action corrective', 50],
      ['Mesures', 22],
      ['Pilote', 14],
      ['Échéance', 12],
      ['Actions faites', 12],
      ['Créé le', 12],
    ],
    lignes: ({ etat }) => {
      const mesures = objs(etat.items);
      return objs(etat.findings).map((f) => {
        const taches = objs(f.tasks);
        return [
          texte(f.id),
          texte(f.source),
          texte(f.year),
          typeEcart(f.type),
          texte(f.status),
          texte(f.text),
          texte(f.desc),
          texte(f.action),
          (Array.isArray(f.items) ? (f.items as unknown[]) : [])
            .map((id) => {
              const m = mesures.find((x) => x.id === id);
              return m ? codeMesure(m) : texte(id);
            })
            .join(', '),
          texte(f.owner),
          dFr(f.due),
          `${taches.filter((t) => t.done).length}/${taches.length}`,
          dFr(f.createdAt),
        ];
      });
    },
  },
  actions: {
    titre: () => "Plan d'actions",
    colonnes: [
      ['Écart', 13],
      ['Type', 14],
      ['Action', 70],
      ['Réalisée', 9],
      ['Pilote', 14],
      ['Échéance', 12],
      ['Créée le', 12],
    ],
    lignes: ({ etat }) =>
      objs(etat.findings).flatMap((f) =>
        objs(f.tasks).map((t) => [
          texte(f.id),
          typeEcart(f.type),
          texte(t.t),
          t.done ? 'Oui' : 'Non',
          texte(f.owner),
          dFr(f.due),
          dFr(t.createdAt),
        ]),
      ),
  },
  fournisseurs: {
    titre: () => 'Fournisseurs et applications',
    colonnes: [
      ['Fournisseur', 26],
      ['Rattachement', 20],
      ['SaaS', 7],
      ['SSO', 9],
      ['MFA', 10],
      ['Critique', 9],
      ['Hébergeur HDS', 12],
      ['Certificats', 16],
      ['Contrôles', 30],
      ['Notes', 40],
    ],
    lignes: ({ etat, aujourdhui }) =>
      objs(etat.suppliers).map((s) => [
        texte(s.name),
        texte(s.rattachement),
        s.saas ? 'Oui' : 'Non',
        texte(s.sso),
        texte(s.mfa),
        texte(s.critical),
        texte(s.hds),
        etatCertificats(s, aujourdhui)[0],
        objs(s.controls)
          .map((c) => `${texte(c.t)} : ${etatControle(c, aujourdhui)[0]}`)
          .join(' ; '),
        texte(s.notes),
      ]),
  },
  certificats: {
    titre: () => 'Certificats fournisseurs',
    colonnes: [
      ['Fournisseur', 26],
      ['Certificat', 12],
      ['Périmètre', 40],
      ['Reçu le', 12],
      ["Valide jusqu'au", 14],
      ['Emplacement', 50],
    ],
    lignes: ({ etat }) =>
      objs(etat.suppliers).flatMap((s) =>
        objs(s.certs).map((c) => [
          texte(s.name),
          texte(c.type),
          texte(c.scope),
          dFr(c.received),
          dFr(c.validUntil),
          texte(c.location),
        ]),
      ),
  },
  controles: {
    titre: () => 'Contrôles fournisseurs',
    colonnes: [
      ['Fournisseur', 26],
      ['Contrôle', 50],
      ['Référence', 40],
      ['Fréquence', 12],
      ['Dernier contrôle', 14],
      ['Résultat', 12],
      ['État', 12],
    ],
    lignes: ({ etat, aujourdhui }) =>
      objs(etat.suppliers).flatMap((s) =>
        objs(s.controls).map((c) => [
          texte(s.name),
          texte(c.t),
          texte(c.ref),
          FREQUENCES_CONTROLE[nombre(c.freq)] ?? '',
          dFr(c.last),
          texte(c.result),
          etatControle(c, aujourdhui)[0],
        ]),
      ),
  },
  revues: {
    titre: () => 'Revues des accès',
    colonnes: [
      ['Contrôle', 14],
      ['Application', 30],
      ['Fournisseur', 26],
      ['Dernière revue', 14],
      ['État', 16],
      ['Commentaire', 40],
    ],
    lignes: ({ etat, aujourdhui }) =>
      objs(etat.accessReviews).map((a) => [
        texte(a.id),
        texte(a.app),
        texte(a.supplier),
        moisFr(a.month),
        revueEtat({ month: texte(a.month), freq: nombre(a.freq) || 12 }, aujourdhui)[0],
        texte(a.comment),
      ]),
  },
  perimetre: {
    titre: () => 'Périmètre du SMSI',
    colonnes: [
      ['Élément', 30],
      ['Contenu', 100],
    ],
    lignes: ({ etat }) => {
      const s = obj(etat.scope);
      return [
        ['Version', texte(s.version)],
        ['Validé le', dFr(s.validatedOn)],
        ['Validé par', texte(s.validatedBy)],
        ['Énoncé', texte(s.statement)],
        ['Sites', texte(s.sites)],
        ['Processus inclus', liste(s.processes)],
        ...objs(s.excl).map((x): Cellule[] => [`Exclusion : ${texte(x.t)}`, texte(x.just)]),
      ];
    },
  },
  parties: {
    titre: () => 'Parties intéressées',
    colonnes: [
      ['Partie intéressée', 26],
      ['Type', 10],
      ['Catégorie', 22],
      ['Besoins et attentes', 50],
      ['Exigences', 40],
      ['Traitée', 9],
      ['Traitement', 40],
      ['Responsable', 16],
      ['Revue le', 12],
    ],
    lignes: ({ etat }) =>
      objs(etat.interested).map((x) => [
        texte(x.name),
        texte(x.type),
        texte(x.cat),
        texte(x.needs),
        texte(x.req),
        texte(x.addressed),
        texte(x.how),
        texte(x.owner),
        dFr(x.reviewed),
      ]),
  },
  swot: {
    titre: () => 'Analyses SWOT',
    colonnes: [
      ['Processus', 12],
      ['Date', 12],
      ['Version', 8],
      ['Réalisée par', 16],
      ['Catégorie', 14],
      ['Élément', 80],
    ],
    lignes: ({ etat }) =>
      objs(etat.swots).flatMap((s) =>
        (
          [
            ['S', 'Force'],
            ['W', 'Faiblesse'],
            ['O', 'Opportunité'],
            ['T', 'Menace'],
          ] as const
        ).flatMap(([k, l]) =>
          (Array.isArray(s[k]) ? (s[k] as unknown[]) : []).map((v): Cellule[] => [
            texte(s.process),
            dFr(s.date),
            texte(s.version),
            texte(s.author),
            l,
            texte(v),
          ]),
        ),
      ),
  },
  roles: {
    titre: () => 'Rôles et responsabilités',
    colonnes: [
      ['Rôle', 24],
      ['Titulaire', 22],
      ['Suppléant', 22],
      ['Courriel', 28],
      ['Téléphone', 16],
      ['Responsabilités', 60],
      ['Références', 24],
    ],
    lignes: ({ etat }) =>
      objs(etat.roles).map((r) => [
        texte(r.name),
        texte(r.holder),
        texte(r.deputy),
        texte(r.email),
        texte(r.phone),
        texte(r.resp),
        texte(r.refs),
      ]),
  },
  incidents: {
    titre: () => 'Registre des incidents',
    colonnes: [
      ['Réf.', 14],
      ['Détection', 16],
      ['Qualification', 20],
      ['Catégorie', 24],
      ['Intitulé', 44],
      ['Priorité', 14],
      ['Statut', 10],
      ['Responsable', 16],
      ['Description', 60],
      ['Actions', 50],
      ['Cause', 40],
      ['Résolu le', 16],
    ],
    lignes: ({ etat }) =>
      objs(etat.incidents).map((i) => [
        texte(i.id),
        dateHeure(i.detectedAt),
        texte(i.kind),
        texte(i.cat),
        texte(i.title),
        prioriteIncident(texte(i.impact), texte(i.urgency)),
        texte(i.status),
        texte(i.owner),
        texte(i.desc),
        texte(i.actions),
        texte(i.cause),
        dateHeure(i.resolvedAt),
      ]),
  },
  contactsCrise: {
    titre: () => 'Contacts de crise',
    colonnes: [
      ['Clé', 6],
      ['Nom', 22],
      ['Organisation', 24],
      ['Rôle', 22],
      ['Téléphone', 16],
      ['Téléphone 2', 16],
      ['Courriel', 28],
      ['Disponibilité', 18],
      ['Notes', 30],
    ],
    lignes: ({ etat }) =>
      objs(obj(etat.crisis).contacts).map((x) => [
        x.key ? 'Oui' : '',
        texte(x.name),
        texte(x.org),
        texte(x.role),
        texte(x.phone),
        texte(x.phone2),
        texte(x.email),
        texte(x.avail),
        texte(x.notes),
      ]),
  },
  mainCourante: {
    titre: () => 'Mains courantes',
    colonnes: [
      ['Cellule', 30],
      ['Mode', 10],
      ['Date et heure', 18],
      ['Type', 18],
      ['Auteur', 16],
      ['Entrée', 90],
    ],
    lignes: ({ etat }) =>
      objs(obj(etat.crisis).cells).flatMap((c) =>
        objs(c.log).map((l) => [
          texte(c.title),
          texte(c.mode),
          dateHeure(l.ts),
          texte(l.type),
          texte(l.author),
          texte(l.text),
        ]),
      ),
  },
  crrcEst: {
    titre: () => 'CRRC Établissements',
    colonnes: [
      ['Réf.', 16],
      ['Établissement', 34],
      ['FINESS', 12],
      ['Statut', 14],
      ['Contact administratif', 22],
      ['Courriel administratif', 26],
      ['Contact technique', 22],
      ['Courriel technique', 26],
      ['Prestataire local', 22],
      ['Destinataires des alertes', 30],
      ['Signature', 12],
      ['Mise en service', 12],
      ['Renouvellement', 12],
      ['Capacité (Go)', 12],
      ['Rétention (jours)', 12],
      ['Microsoft 365', 8],
      ['Google Workspace', 8],
      ['Serveurs Windows', 8],
      ['NAS S3', 8],
      ['Notes', 30],
    ],
    lignes: ({ etat }) =>
      objs(obj(etat.crrc).establishments).map((e) => [
        texte(e.id),
        texte(e.name),
        texte(e.finess),
        texte(e.status),
        texte(e.adminContact),
        texte(e.adminEmail),
        texte(e.techContact),
        texte(e.techEmail),
        texte(e.prestataire),
        texte(e.alerts),
        dFr(e.signed),
        dFr(e.serviceDate),
        dFr(e.renewal),
        nombre(e.capacityGb),
        nombre(e.retentionDays),
        ...(['m365', 'gws', 'windows', 's3'] as const).map((k) => oui(obj(e.scopes)[k])),
        texte(e.notes),
      ]),
  },
  crrcRes: {
    titre: () => 'CRRC Ressources',
    colonnes: [
      ['Réf.', 16],
      ['Ressource', 30],
      ['Établissement', 30],
      ['Technologie', 20],
      ['Fréquence', 14],
      ['Rétention (jours)', 12],
      ['Notes', 30],
    ],
    lignes: ({ etat }) => {
      const crrc = obj(etat.crrc);
      const ets = objs(crrc.establishments);
      return objs(crrc.resources).map((r) => [
        texte(r.id),
        texte(r.name),
        texte(ets.find((e) => e.id === r.est)?.name),
        texte(r.tech),
        texte(r.freq),
        texte(r.retention),
        texte(r.notes),
      ]);
    },
  },
  crrcRuns: {
    titre: () => 'CRRC Sauvegardes',
    colonnes: [
      ['Date', 18],
      ['Établissement', 30],
      ['Ressource', 30],
      ['Technologie', 20],
      ['Type', 14],
      ['Statut', 12],
      ['Volume (Go)', 12],
      ['Durée (min)', 12],
    ],
    lignes: ({ etat }) => {
      const crrc = obj(etat.crrc);
      const ets = objs(crrc.establishments);
      const res = objs(crrc.resources);
      return objs(crrc.runs)
        .slice()
        .sort((a, b) => texte(b.date).localeCompare(texte(a.date)))
        .map((x) => {
          const r = res.find((y) => y.id === x.res) ?? {};
          return [
            dateHeure(x.date),
            texte(ets.find((e) => e.id === r.est)?.name),
            texte(r.name),
            texte(r.tech),
            texte(x.type),
            texte(x.status),
            nombre(x.volumeGb),
            nombre(x.durationMin),
          ];
        });
    },
  },
  crrcAlerts: {
    titre: () => 'CRRC Alertes',
    colonnes: [
      ['Réf.', 14],
      ['Date', 18],
      ['Sévérité', 12],
      ['Établissement', 30],
      ['Ressource', 30],
      ['Message', 50],
      ['Statut', 12],
      ['Incident', 14],
    ],
    lignes: ({ etat }) => {
      const crrc = obj(etat.crrc);
      const ets = objs(crrc.establishments);
      const res = objs(crrc.resources);
      return objs(crrc.alerts).map((a) => [
        texte(a.id),
        dateHeure(a.date),
        texte(a.severity),
        texte(ets.find((e) => e.id === a.est)?.name),
        texte(res.find((r) => r.id === a.res)?.name),
        texte(a.message),
        texte(a.status),
        texte(a.incident),
      ]);
    },
  },
  crrcRestores: {
    titre: () => 'CRRC Restaurations',
    colonnes: [
      ['Réf.', 14],
      ['Date', 18],
      ['Établissement', 30],
      ['Ressource', 30],
      ['Périmètre', 30],
      ['Type', 22],
      ['Statut', 12],
      ['Responsable', 18],
      ['Durée', 12],
    ],
    lignes: ({ etat }) => {
      const crrc = obj(etat.crrc);
      const ets = objs(crrc.establishments);
      const res = objs(crrc.resources);
      return objs(crrc.restores).map((x) => [
        texte(x.id),
        dateHeure(x.date),
        texte(ets.find((e) => e.id === x.est)?.name),
        texte(res.find((r) => r.id === x.res)?.name),
        texte(x.scope),
        texte(x.type),
        texte(x.status),
        texte(x.owner),
        texte(x.duration),
      ]);
    },
  },
  invest: {
    titre: () => "Plan d'investissement",
    colonnes: [
      ['Réf.', 10],
      ['Société', 24],
      ['Priorité', 8],
      ['Type', 22],
      ['Description', 50],
      ['Prix N', 12],
      ['N+1', 12],
      ['N+2', 12],
      ['Total 3 ans', 12],
      ['Commentaires', 40],
      ['Alternative', 30],
      ['Code Comptable', 14],
      ['Périmètre', 16],
      ['Status', 14],
      ['Nature', 16],
      ['Renouvellement', 14],
      ['Préavis (jours)', 10],
    ],
    lignes: ({ etat }) =>
      objs(obj(etat.invest).lines).map((l) => [
        texte(l.id),
        texte(l.company),
        texte(l.priority),
        texte(l.type),
        texte(l.desc),
        nombre(l.n0),
        nombre(l.n1),
        nombre(l.n2),
        nombre(l.n0) + nombre(l.n1) + nombre(l.n2),
        texte(l.comment),
        texte(l.alt),
        texte(l.account),
        texte(l.perimeter),
        texte(l.status),
        texte(l.nature),
        dFr(l.renewal),
        texte(l.notice),
      ]),
  },
  preuves: {
    titre: () => 'Registre des preuves',
    colonnes: [
      ['Réf.', 10],
      ['Preuve', 40],
      ['Type', 20],
      ['Statut', 14],
      ['Responsable', 18],
      ['Date', 12],
      ['Revue', 12],
      ['Classification', 14],
      ['Emplacement', 40],
      ['Mesures', 24],
      ['Écarts', 20],
      ['Plans', 16],
      ['Tâches', 16],
      ['Indicateurs', 16],
      ['Fournisseurs', 16],
    ],
    lignes: ({ etat }) => {
      const mesures = objs(etat.items);
      return objs(etat.evidences).map((x) => {
        const l = obj(x.links);
        return [
          texte(x.id),
          texte(x.title),
          texte(x.type),
          texte(x.status),
          texte(x.owner),
          dFr(x.date),
          dFr(x.review),
          texte(x.classification),
          texte(x.location),
          (Array.isArray(l.items) ? (l.items as unknown[]) : [])
            .map((id) => {
              const m = mesures.find((y) => y.id === id);
              return m ? codeMesure(m) : texte(id);
            })
            .join(', '),
          liste(l.findings),
          liste(l.plans),
          liste(l.recurring),
          liste(l.indicators),
          (Array.isArray(l.suppliers) ? (l.suppliers as unknown[]) : [])
            .map((id) => nomFournisseur(etat, id))
            .join(', '),
        ];
      });
    },
  },
  plans: {
    titre: () => 'Plans du SMSI',
    colonnes: [
      ['Réf.', 12],
      ['Plan', 22],
      ['Intitulé', 44],
      ['Type', 22],
      ['Date prévue', 12],
      ['Réalisé le', 12],
      ['État', 14],
      ['Responsable', 16],
      ['Prestataire', 18],
      ['Public', 26],
      ['Résultat', 30],
      ['Preuve', 30],
    ],
    lignes: ({ etat, aujourdhui }) =>
      objs(etat.plans).map((p) => {
        const type = texte(p.type);
        const resultat =
          type === 'formation'
            ? `${texte(p.attended) || '–'} présents / ${texte(p.planned) || '–'} prévus`
            : type === 'sensi'
              ? `participation ${texte(p.participation) || '–'} %, réussite ${texte(p.success) || '–'} %`
              : type === 'audit'
                ? `${Array.isArray(p.items) ? p.items.length : 0} mesure(s) — ${texte(p.scope)}`
                : `${texte(p.result)} ${p.systems ? `— ${texte(p.systems)}` : ''}`.trim();
        return [
          texte(p.id),
          PLANS[type as TypePlan]?.plan ?? type,
          texte(p.title),
          texte(p.kind),
          dFr(p.start),
          dFr(p.done),
          actionPlanEtat({ status: texte(p.status) as never, start: texte(p.start), end: texte(p.end) }, aujourdhui)[0],
          texte(p.owner),
          texte(p.provider),
          texte(p.audience),
          resultat,
          texte(p.proof),
        ];
      }),
  },
  recurrentes: {
    titre: () => 'Tâches récurrentes',
    colonnes: [
      ['Réf.', 10],
      ['Tâche', 44],
      ['Catégorie', 20],
      ['Fréquence', 18],
      ['Responsable', 18],
      ['Dernière réalisation', 14],
      ['Prochaine échéance', 14],
      ['Réalisations', 10],
      ['Références', 40],
    ],
    lignes: ({ etat, aujourdhui }) =>
      objs(etat.recurring).map((r) => [
        texte(r.id),
        texte(r.title),
        texte(r.cat),
        `tous les ${nombre(r.n) || 1} ${texte(r.u)}`,
        texte(r.owner),
        dFr(r.last),
        dFr(
          recurrenceSuivante(
            { last: texte(r.last), start: texte(r.start), n: nombre(r.n) || 1, u: texte(r.u) as never },
            aujourdhui,
          ),
        ),
        Array.isArray(r.history) ? r.history.length : 0,
        texte(r.refs),
      ]),
  },
  iaRegistre: {
    titre: () => 'IA — registre des usages',
    colonnes: [
      ['ID', 10],
      ['IA présente', 10],
      ['Catégorie', 28],
      ['Fournisseur, service', 46],
      ["Cas d'usage", 40],
      ['DSCP', 10],
      ['Autorisation', 18],
    ],
    lignes: ({ etat }) =>
      objs(obj(etat.ai).register).map((r) => [
        texte(r.id),
        texte(r.aiPresence),
        texte(r.category),
        texte(r.provider),
        texte(r.usecase),
        texte(r.dscp),
        texte(r.authz),
      ]),
  },
  iaEval: {
    titre: () => 'IA — évaluation des risques',
    colonnes: [
      ['ID', 6],
      ['Domaine', 26],
      ['Scénario', 70],
      ['Périmètre', 22],
      ['Maturité', 9],
      ['Indice', 8],
      ['Niveau', 12],
      ['Mesure attendue', 50],
    ],
    lignes: ({ etat }) =>
      objs(obj(etat.ai).evals).map((e) => {
        const r = evaluationIa({
          app: texte(e.app),
          c: nombre(e.c),
          i: nombre(e.i),
          a: nombre(e.a),
          audit: nombre(e.audit),
          patient: nombre(e.patient),
          prob: nombre(e.prob),
          dscp: texte(e.dscp),
          maturity: nombre(e.maturity),
          effort: nombre(e.effort),
        } as never);
        return [
          texte(e.id),
          texte(e.domain),
          texte(e.scenario),
          texte(e.scope),
          texte(e.maturity),
          r.indice ?? '',
          r.niveau,
          texte(e.measure),
        ];
      }),
  },
  iaPlan: {
    titre: () => "IA — plan d'action",
    colonnes: [
      ['Étape', 7],
      ['Phase', 22],
      ['Action', 60],
      ['Pilote', 18],
      ['Échéance', 12],
      ['Statut', 12],
      ['Avancement', 11],
      ['Alerte', 16],
    ],
    lignes: ({ etat, aujourdhui }) => {
      const ia = obj(etat.ai);
      return objs(ia.plan).map((p) => {
        const e = etapeIa(
          { jStart: nombre(p.jStart), jEnd: nombre(p.jEnd), status: texte(p.status) as never },
          texte(ia.start),
          !!ia.startValidated,
          aujourdhui,
        );
        return [
          texte(p.step),
          texte(p.phase),
          texte(p.action),
          texte(p.owner),
          dFr(e.echeance),
          texte(p.status),
          `${nombre(p.progress)} %`,
          e.alerte[0],
        ];
      });
    },
  },
  iaPolitiques: {
    titre: () => 'IA — politiques à adapter',
    colonnes: [
      ['Politique', 40],
      ['Modification attendue', 70],
      ['Propriétaire', 20],
      ['Statut', 14],
    ],
    lignes: ({ etat }) =>
      objs(obj(etat.ai).policies).map((p) => [texte(p.policy), texte(p.change), texte(p.owner), texte(p.status)]),
  },
  pronostic: {
    titre: ({ etat }) => `Pronostic de l'audit ${texte(etat.nextYear)}`.trim(),
    colonnes: [
      ['Mesure', 10],
      ['Intitulé', 46],
      ['Référentiel', 18],
      ['Pronostic', 14],
      ['Raisons', 60],
      ['Préparation', 12],
      ['Créneau', 36],
    ],
    lignes: ({ etat }) => {
      const annees = (Array.isArray(etat.years) ? etat.years : []).map(Number).filter(Number.isInteger);
      const N = Number.isInteger(+(etat.nextYear as number)) && etat.nextYear !== '' ? +(etat.nextYear as number) : 0;
      const exigences = objs(etat.items)
        .filter((i) => ['ISO', 'A', 'HDS'].includes(texte(i.ref)))
        .map((i) => ({
          id: texte(i.id),
          ref: texte(i.ref),
          num: texte(i.num),
          title: texte(i.title),
          group: texte(i.group),
          depth: nombre(i.depth),
          afnor: obj(i.afnor) as Record<string, string>,
          interne: obj(i.interne) as Record<string, string>,
          prep: texte(i.prep),
        }));
      const ecarts = objs(etat.findings).map((f) => ({
        id: texte(f.id),
        source: texte(f.source),
        year: nombre(f.year),
        type: texte(f.type),
        status: texte(f.status),
        items: Array.isArray(f.items) ? (f.items as unknown[]).map(texte) : [],
      }));
      const AN = analyzeAll(
        { years: annees, findings: ecarts, items: exigences } as Pick<AuditState, 'years' | 'findings' | 'items'>,
        N,
      );
      const plan = obj(etat.plan);
      const jours = objs(plan.days);
      const creneau = (id: string) => {
        const s = objs(plan.slots).find((x) => Array.isArray(x.items) && (x.items as unknown[]).includes(id));
        if (!s) return '';
        return `${texte(jours.find((d) => d.id === s.day)?.label)} ${texte(s.start)} — ${texte(s.title)}`.trim();
      };
      return exigences
        .filter((i) => AN[i.id] && AN[i.id]!.level !== 'faible')
        .sort((a, b) => LV[AN[a.id]!.level].o - LV[AN[b.id]!.level].o)
        .map((i) => [
          itemCode({ ref: i.ref, num: i.num }),
          i.title,
          AUDIT_REF_EXPORT_LABELS[i.ref as AuditRef],
          LV[AN[i.id]!.level].l,
          AN[i.id]!.reasons.join(' ; '),
          PREP_LABELS[(i.prep in PREP_LABELS ? i.prep : '') as PrepValue],
          creneau(i.id),
        ]);
    },
  },
  gapApps: {
    titre: () => 'GAP — applications à intégrer',
    colonnes: [
      ['Application', 30],
      ['DSCP', 10],
      ['Nuage', 10],
      ['Statut', 12],
      ['Avancement', 11],
      ['Conformes', 10],
      ['Écarts', 8],
      ['À évaluer', 10],
      ['Responsable', 18],
      ['Échéance cible', 14],
    ],
    lignes: ({ etat }) => {
      const exclues = exigencesExclues(etat);
      return appsGap(etat).map((a) => {
        const st = statsGap(a, exclues);
        return [
          a.name,
          a.dscp,
          a.cloud,
          a.status,
          `${st.pct} %`,
          st.c.Conforme,
          st.ouverts,
          st.c['À évaluer'],
          a.owner,
          dFr(a.target),
        ];
      });
    },
  },
  gapLignes: {
    titre: () => 'GAP — points de contrôle',
    colonnes: [
      ['Application', 26],
      ['Section', 22],
      ['Références', 20],
      ['Point de contrôle', 60],
      ['État', 14],
      ['Constat', 40],
      ['Pilote', 16],
      ['Échéance', 12],
    ],
    lignes: ({ etat }) => {
      const exclues = exigencesExclues(etat);
      return appsGap(etat).flatMap((a) =>
        pointsGap(a).map((l) => {
          const v = a.lines[l.id] ?? {};
          return [
            a.name,
            SECTIONS_GAP.find((x) => x[0] === l.sec)?.[1] ?? '',
            l.refs.map((r) => codeExigence(etat, r)).join(', '),
            l.t,
            etatPointGap(a, l, exclues),
            v.comment ?? '',
            v.owner ?? '',
            dFr(v.due),
          ];
        }),
      );
    },
  },
  evalFournisseurs: {
    titre: () => 'Évaluations sécurité fournisseurs',
    colonnes: [
      ['Fournisseur', 24],
      ['Produit', 24],
      ['Date', 12],
      ['Note indicative', 10],
      ['Conformité', 10],
      ['Exigence du clausier', 12],
      ['Libellé', 70],
      ['État', 14],
      ['Commentaire', 40],
    ],
    lignes: ({ etat }) => {
      const fournisseurs = objs(etat.suppliers);
      return (Array.isArray(etat.supEvals) ? etat.supEvals : [])
        .map(lireEvaluationClausier)
        .filter((e): e is NonNullable<typeof e> => !!e)
        .flatMap((ev) => {
          const points = pointsEvaluation(CLAUSIER_2026, ev.cases);
          const sc = scoreEvaluation(points, ev);
          const nom = texte(fournisseurs.find((x) => x.id === ev.supplier)?.name);
          return points.map((p) => [
            nom,
            ev.product,
            dFr(ev.date),
            sc.note,
            sc.pc == null ? '' : `${sc.pc} %`,
            p.id,
            p.titre,
            etatPoint(ev, p.id),
            ev.ans[p.id]?.c ?? '',
          ]);
        });
    },
  },
};

/** Groupes proposés à l'export (repris de l'outil historique ; les jeux absents de cette liste n'ont pas encore d'équivalent). */
export const GROUPES: readonly { id: string; titre: string; description: string; jeux: readonly string[] }[] = [
  {
    id: 'audit',
    titre: "Gestion de l'audit",
    description: 'Pronostic, plan, participants et couverture du cycle.',
    jeux: ['pronostic', 'plan', 'participants', 'couverture'],
  },
  {
    id: 'obj',
    titre: 'Objectifs et indicateurs',
    description: 'Objectifs, indicateurs et processus.',
    jeux: ['objectifs', 'indicateurs', 'processus'],
  },
  {
    id: 'conf',
    titre: 'Conformité',
    description: 'Clauses ISO 27001, DdA Annexe A et HDS.',
    jeux: ['clauses', 'annexeA', 'hds'],
  },
  {
    id: 'ec',
    titre: 'Écarts et actions',
    description: 'Registre des écarts et plan d’actions.',
    jeux: ['ecarts', 'actions'],
  },
  {
    id: 'sup',
    titre: 'Fournisseurs',
    description: 'Fournisseurs, certificats, contrôles, revues des accès et évaluations sécurité.',
    jeux: ['fournisseurs', 'certificats', 'controles', 'revues', 'evalFournisseurs'],
  },
  {
    id: 'ctx',
    titre: 'Contexte du SMSI',
    description: 'Périmètre, parties intéressées, analyses SWOT et rôles.',
    jeux: ['perimetre', 'parties', 'swot', 'roles'],
  },
  {
    id: 'incs',
    titre: 'Incidents et crise',
    description: 'Registre des incidents, contacts de crise et mains courantes.',
    jeux: ['incidents', 'contactsCrise', 'mainCourante'],
  },
  {
    id: 'crrcx',
    titre: 'Gestion CRRC',
    description: 'Établissements, ressources, sauvegardes, alertes et restaurations.',
    jeux: ['crrcEst', 'crrcRes', 'crrcRuns', 'crrcAlerts', 'crrcRestores'],
  },
  {
    id: 'invx',
    titre: 'Plan d’investissement',
    description: 'Lignes budgétaires sur trois ans et renouvellements.',
    jeux: ['invest'],
  },
  { id: 'prvx', titre: 'Preuves', description: 'Registre des preuves et rattachements.', jeux: ['preuves'] },
  {
    id: 'plans',
    titre: 'Plans du SMSI',
    description: 'Formation, sensibilisation, audit interne, exercices et tâches récurrentes.',
    jeux: ['plans', 'recurrentes'],
  },
  {
    id: 'ia',
    titre: 'GAP — Intelligence artificielle',
    description: 'Registre, évaluation, plan d’action et politiques.',
    jeux: ['iaRegistre', 'iaEval', 'iaPlan', 'iaPolitiques'],
  },
  {
    id: 'apps',
    titre: 'GAP — Applications',
    description: 'Synthèse par application et points de contrôle.',
    jeux: ['gapApps', 'gapLignes'],
  },
];
export const TOUS_LES_JEUX = GROUPES.flatMap((g) => g.jeux);

export function feuillesDuGroupe(id: string, c: Contexte): Feuille[] | null {
  const jeux = id === 'all' ? TOUS_LES_JEUX : GROUPES.find((g) => g.id === id)?.jeux;
  if (!jeux) return null;
  return jeux.map((k) => {
    const j = JEUX[k]!;
    return { titre: j.titre(c), colonnes: j.colonnes, lignes: j.lignes(c) };
  });
}

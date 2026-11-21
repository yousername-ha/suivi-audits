/* Module Vulnérabilités (ADR 0100, lot AD-1) : lecture, dans le navigateur, du rapport d'analyse de l'Active Directory produit
   par le service ADS de l'ANSSI à partir d'une collecte ORADAD (fichier JSON). Sans dépendance (`JSON.parse`). Seul un extrait
   en liste blanche part vers l'API (packages/shared/src/import-ads.ts) ; le fichier complet ne quitte jamais le poste et son
   nom n'est jamais envoyé. Ne sont jamais lus ni envoyés : mots de passe, empreintes, attributs détaillés des comptes, SID,
   chemins LDAP complets (réduits au nom court), nom de domaine, et tout champ hors de la liste ci-dessous.

   FORME DU RAPPORT NON VÉRIFIÉE : aucun rapport réel n'a été lu. Les noms de clés sont SUPPOSÉS ; ils sont tous regroupés
   dans CLES_RAPPORT_ADS, pour être corrigés à un seul endroit. Pour chaque information, la première clé présente dont la
   valeur a la forme attendue l'emporte. Toute l'analyse tient dans lireRapportAds : un rapport dont une partie attendue
   manque ou ne se lit pas est refusé en entier (« forme non reconnue », avec la clé en cause), jamais importé en partie en
   silence. Seuls les objets sans nom lisible, au-delà de la borne ou en double sont écartés, et comptés. */
import {
  ADS_BORNES,
  CHEMIN_LDAP_ADS,
  DATE_ADS,
  ECART_ADS_LIBELLES,
  ECARTS_ADS,
  type EcartsImportAds,
  ecartsAdsVides,
  IDENTIFIANT_POINT_ADS,
  IDENTIFIANT_PUBLIC_ADS,
  type ImportAds,
  type NatureObjetAds,
  type NomObjetAds,
  nomObjetAdsValide,
  type PointAds,
  PREFIXE_TYPE_ADS,
  type ProgressionNiveauAds,
  SID_ADS,
  texteExterneValide,
  type TypePointAds,
} from '@suivi/shared';

/** Clés supposées du rapport, par information (à corriger ici quand un rapport réel sera connu). */
export const CLES_RAPPORT_ADS = {
  /** Enveloppe éventuelle autour du rapport (un seul niveau est descendu). */
  enveloppe: ['report', 'rapport', 'data', 'result', 'results'],
  /** Note globale, entier de 1 à 5. */
  note: ['score', 'note', 'level', 'niveau', 'global_level', 'globalLevel', 'maturity_level', 'maturity'],
  /** Date du rapport ou de la collecte (seul le jour est gardé). */
  date: [
    'date',
    'generated',
    'generated_at',
    'generatedAt',
    'generation_date',
    'collect_date',
    'collection_date',
    'timestamp',
  ],
  /** Progression par niveau : tableau, ou objet indexé par niveau (« 1 » à « 5 », « level1 »…). */
  progression: ['levels', 'niveaux', 'progression', 'progress', 'level_progress', 'levelProgress'],
  niveauNumero: ['level', 'niveau', 'id'],
  niveauConformes: ['passed', 'ok', 'conformes', 'compliant', 'success', 'validated'],
  niveauTotal: ['total', 'count', 'nombre', 'checks'],
  niveauPourcentage: ['percent', 'percentage', 'pourcentage', 'progress', 'ratio'],
  /** Total des points conformes, à la racine ou dans un bloc de totaux. */
  totaux: ['totals', 'summary', 'stats', 'statistics', 'synthese'],
  conformes: ['passed', 'ok', 'conformes', 'compliant', 'success'],
  /** Points de contrôle non conformes : tableau, ou objet indexé par identifiant. */
  points: ['rules', 'checks', 'points', 'findings', 'controles', 'vulnerabilities', 'anomalies'],
  pointIdentifiant: ['id', 'identifier', 'identifiant', 'code', 'rule_id', 'ruleId'],
  pointType: ['type', 'severity', 'kind'],
  pointNiveau: ['level', 'niveau'],
  pointReference: ['reference', 'ref', 'module', 'rule', 'check'],
  pointTitre: ['title', 'titre', 'name', 'nom', 'label', 'description'],
  /** Objets concernés : tableau (de textes ou d'objets), ou objet de tableaux rangés par nature. */
  pointObjets: ['objects', 'objets', 'members', 'items', 'affected', 'details', 'entries', 'accounts'],
  pointNombre: ['count', 'nombre', 'total', 'objects_count', 'objectsCount'],
  /** Nom affichable d'un objet, par ordre de préférence (le plus court d'abord) ; un chemin LDAP est réduit à son CN. */
  objetNom: [
    'samaccountname',
    'sAMAccountName',
    'name',
    'nom',
    'displayName',
    'displayname',
    'cn',
    'dnshostname',
    'dNSHostName',
    'distinguishedName',
    'dn',
  ],
  objetNature: ['type', 'objectClass', 'objectclass', 'class', 'category', 'nature', 'kind'],
} as const;

export class ErreurRapportAds extends Error {}

const MO = 1_000_000;

/** Taille du fichier : au-delà de la borne, refus avant toute lecture. */
export function erreurTailleAds(octets: number): string | null {
  if (octets <= 0) return 'Fichier vide.';
  if (octets > ADS_BORNES.fichierMo * MO)
    return `Fichier trop volumineux : ${(octets / MO).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo, pour ${ADS_BORNES.fichierMo} Mo au plus. Vérifiez qu’il s’agit bien du rapport JSON de l’analyse de l’Active Directory, et non de la collecte ORADAD elle-même.`;
  return null;
}

/** Analyse du texte (JSON seulement) ; une erreur d'analyse vaut refus. */
export function lireJsonAds(texte: string): unknown {
  try {
    return JSON.parse(texte) as unknown;
  } catch {
    throw new ErreurRapportAds('Fichier refusé : ce n’est pas un fichier JSON valide.');
  }
}

/** Ce qui part vers l'API, plus les nombres d'aperçu. */
export interface ExtraitAds extends ImportAds {
  objets: number;
  noms: number;
}

type Objet = Record<string, unknown>;
const objet = (v: unknown): v is Objet => typeof v === 'object' && v !== null && !Array.isArray(v);
// eslint-disable-next-line no-control-regex
const CONTROLES = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g;

/** Nature d'un objet d'après sa classe ou son type (texte ou liste de textes), du plus précis au plus général. */
export function natureObjetAds(v: unknown, nom = ''): NatureObjetAds {
  const t = (Array.isArray(v) ? v : [v])
    .filter((x): x is string => typeof x === 'string')
    .join(' ')
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
  const a = (...m: string[]) => m.some((x) => t.includes(x));
  if (a('domaincontroller', 'domain controller', 'controleur', 'contrôleur') || /(^| )dcs?( |$)/.test(t))
    return 'controleur';
  if (a('managedserviceaccount', 'managed service account', 'gmsa', 'service')) return 'service';
  if (a('computer', 'ordinateur', 'machine', 'workstation', 'server')) return 'ordinateur';
  // « groupPolicyContainer » contient « group » : la stratégie de groupe passe avant le groupe.
  if (a('grouppolicy', 'group policy', 'gpo')) return 'gpo';
  if (a('group', 'groupe')) return 'groupe';
  if (a('trust', 'approbation')) return 'approbation';
  if (a('user', 'utilisateur', 'person', 'account', 'compte')) return 'utilisateur';
  return nom.endsWith('$') ? 'ordinateur' : 'autre';
}

/** Nom court d'un objet : chemin LDAP réduit à son premier élément, « domaine\nom » et « nom@domaine » réduits au nom,
    texte nettoyé et borné. Rend null pour un SID seul (jamais gardé) ou un nom illisible. */
export function nomCourtAds(v: unknown): { nom: string; raccourci: boolean } | { sid: true } | null {
  if (typeof v !== 'string') return null;
  let n = v.replace(CONTROLES, ' ').trim();
  if (SID_ADS.test(n)) return { sid: true };
  if (CHEMIN_LDAP_ADS.test(n)) {
    const m = /^\s*[A-Za-z]+\s*=\s*((?:\\.|[^,])*)/.exec(n);
    n = m ? m[1]!.replace(/\\(.)/g, '$1').trim() : '';
  }
  if (n.includes('\\')) n = n.slice(n.lastIndexOf('\\') + 1);
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(n)) n = n.slice(0, n.indexOf('@'));
  n = n
    .split(/\s+/u)
    .filter(Boolean)
    .join(' ')
    .replace(/<(?=[A-Za-z/!?])/g, '‹');
  if (!n || SID_ADS.test(n)) return n ? { sid: true } : null;
  let raccourci = false;
  if (n.length > ADS_BORNES.nom) {
    n = `${n.slice(0, ADS_BORNES.nom - 1).trimEnd()}…`;
    raccourci = true;
  }
  return nomObjetAdsValide(n) ? { nom: n, raccourci } : null;
}

/** Lit le rapport (JSON déjà analysé) et rend l'extrait à envoyer ; lève ErreurRapportAds « forme non reconnue » sinon. */
export function lireRapportAds(json: unknown): ExtraitAds {
  const K = CLES_RAPPORT_ADS;
  const refus = (quoi: string, cles: readonly string[]): never => {
    throw new ErreurRapportAds(
      `Forme non reconnue : ${quoi} (clés cherchées : ${cles.join(', ')}). Rien n’a été importé. Le rapport n’a peut-être pas la forme supposée par la plateforme : signalez-le, sans joindre le fichier.`,
    );
  };
  const premier = <T>(o: unknown, cles: readonly string[], lire: (v: unknown) => T | undefined): T | undefined => {
    if (!objet(o)) return undefined;
    for (const c of cles)
      if (Object.hasOwn(o, c)) {
        const r = lire(o[c]);
        if (r !== undefined) return r;
      }
    return undefined;
  };
  const entier = (min: number, max: number) => (v: unknown) => {
    const n = typeof v === 'string' && /^\s*\d+\s*$/.test(v) ? Number(v) : v;
    return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : undefined;
  };
  const texte = (v: unknown) =>
    typeof v === 'string' || typeof v === 'number'
      ? String(v)
          .replace(CONTROLES, ' ')
          .split(/\s+/u)
          .filter(Boolean)
          .join(' ')
          .replace(/<(?=[A-Za-z/!?])/g, '‹') || undefined
      : undefined;
  const ecartes: EcartsImportAds = ecartsAdsVides();

  if (!objet(json)) refus('le fichier n’est pas un objet JSON', []);
  let racine = json as Objet;
  if (premier(racine, K.points, (v) => (Array.isArray(v) || objet(v) ? v : undefined)) === undefined) {
    const dedans = premier(racine, K.enveloppe, (v) => (objet(v) ? v : undefined));
    if (dedans) racine = dedans;
  }

  /* Synthèse */
  const note = premier(racine, K.note, entier(1, 5));
  if (note === undefined) refus('note globale de 1 à 5 introuvable', K.note);
  const date = premier(racine, K.date, (v) => {
    const m = typeof v === 'string' ? /^(\d{4}-\d{2}-\d{2})/.exec(v.trim()) : null;
    return m && DATE_ADS.test(m[1]!) ? m[1]! : undefined;
  });
  const brute = premier(racine, K.progression, (v) => (Array.isArray(v) || objet(v) ? v : undefined));
  if (brute === undefined) refus('progression par niveau introuvable', K.progression);
  const entrees: [number | undefined, unknown][] = Array.isArray(brute)
    ? brute.map((v, i) => [objet(v) ? (premier(v, K.niveauNumero, entier(1, 5)) ?? i + 1) : i + 1, v])
    : Object.entries(brute as Objet).map(([c, v]) => [entier(1, 5)(c.replace(/^\D+/, '')), v]);
  const progression: ProgressionNiveauAds[] = [];
  for (const [niveau, v] of entrees) {
    if (niveau === undefined || progression.some((p) => p.niveau === niveau))
      refus('niveau de la progression illisible ou en double', K.niveauNumero);
    const pct = (x: unknown) =>
      typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 100 ? Math.round(x * 10) / 10 : undefined;
    const conformes = objet(v) ? (premier(v, K.niveauConformes, entier(0, 10_000_000)) ?? null) : null;
    const total = objet(v) ? (premier(v, K.niveauTotal, entier(0, 10_000_000)) ?? null) : null;
    const pourcentage = objet(v) ? (premier(v, K.niveauPourcentage, pct) ?? null) : (pct(v) ?? null);
    if ((conformes === null || total === null || conformes > total) && pourcentage === null)
      refus(`progression du niveau ${niveau} illisible`, [
        ...K.niveauConformes,
        ...K.niveauTotal,
        ...K.niveauPourcentage,
      ]);
    progression.push({ niveau: niveau!, conformes, total, pourcentage });
  }
  if (progression.length > 5) refus('plus de cinq niveaux dans la progression', K.progression);
  progression.sort((a, b) => a.niveau - b.niveau);
  const conformes =
    premier(racine, K.conformes, entier(0, 10_000_000)) ??
    premier(
      premier(racine, K.totaux, (v) => (objet(v) ? v : undefined)),
      K.conformes,
      entier(0, 10_000_000),
    ) ??
    null;

  /* Points non conformes */
  const liste = premier(racine, K.points, (v) => (Array.isArray(v) || objet(v) ? v : undefined));
  if (liste === undefined) refus('liste des points de contrôle introuvable', K.points);
  const bruts: [string | undefined, unknown][] = Array.isArray(liste)
    ? liste.map((v) => [undefined, v])
    : Object.entries(liste as Objet);
  if (bruts.length > ADS_BORNES.points)
    refus(`plus de ${ADS_BORNES.points} points de contrôle non conformes`, K.points);
  const points: PointAds[] = [];
  bruts.forEach(([cle, v], i) => {
    const ou = `point n° ${i + 1}`;
    if (!objet(v)) refus(`${ou} : ce n’est pas un objet`, K.points);
    const id = premier(v, K.pointIdentifiant, texte) ?? cle;
    const pub = id ? IDENTIFIANT_PUBLIC_ADS.exec(id) : null;
    const typePub = pub ? ({ info: 1, warn: 2, vuln: 3 } as const)[pub[1] as 'info' | 'warn' | 'vuln'] : undefined;
    const type = (premier(v, K.pointType, entier(1, 3)) ?? typePub) as TypePointAds | undefined;
    if (type === undefined) refus(`${ou} : type 1, 2 ou 3 introuvable`, K.pointType);
    const niveau = premier(v, K.pointNiveau, entier(1, 5)) ?? (pub ? Number(pub[2]) : undefined);
    if (niveau === undefined) refus(`${ou} : niveau de 1 à 5 introuvable`, K.pointNiveau);
    const reference = premier(v, K.pointReference, texte) ?? pub?.[3];
    if (!reference || reference.length > ADS_BORNES.reference || !texteExterneValide(reference))
      refus(`${ou} : référence de module introuvable ou trop longue`, K.pointReference);
    // Identifiant : celui du rapport ; à défaut, la forme publique supposée « {vuln|warn|info}{niveau}_{référence} ».
    const identifiant = id ?? `${PREFIXE_TYPE_ADS[type!]}${niveau}_${reference!.replace(/[^A-Za-z0-9_.:-]+/g, '_')}`;
    if (!IDENTIFIANT_POINT_ADS.test(identifiant)) refus(`${ou} : identifiant hors forme`, K.pointIdentifiant);
    if (points.some((p) => p.identifiant === identifiant)) refus(`${ou} : identifiant en double`, K.pointIdentifiant);
    let titre = premier(v, K.pointTitre, texte);
    if (!titre) refus(`${ou} : titre introuvable`, K.pointTitre);
    if (titre!.length > ADS_BORNES.titre) {
      titre = `${titre!.slice(0, ADS_BORNES.titre - 1).trimEnd()}…`;
      ecartes.titresRaccourcis += 1;
    }
    if (!texteExterneValide(titre!)) refus(`${ou} : titre illisible`, K.pointTitre);

    // Objets : textes, objets, ou objets rangés par nature (« users », « groups »…).
    const objets = premier(v, K.pointObjets, (x) => (Array.isArray(x) || objet(x) ? x : undefined));
    const elements: { valeur: unknown; nature: unknown }[] = [];
    if (Array.isArray(objets)) for (const o of objets) elements.push({ valeur: o, nature: undefined });
    else if (objets)
      for (const [groupe, contenu] of Object.entries(objets))
        for (const o of Array.isArray(contenu) ? contenu : [contenu]) elements.push({ valeur: o, nature: groupe });
    const annonce = premier(v, K.pointNombre, entier(0, ADS_BORNES.objetsMax));
    const total = Math.max(annonce ?? 0, elements.length);
    if (total === 0 && objets === undefined && annonce === undefined)
      refus(`${ou} : objets concernés introuvables`, [...K.pointObjets, ...K.pointNombre]);
    const noms: NomObjetAds[] = [];
    const vus = new Set<string>();
    for (const e of elements) {
      const brut = objet(e.valeur)
        ? premier(e.valeur, K.objetNom, (x) => (typeof x === 'string' && x.trim() ? x : undefined))
        : e.valeur;
      const court = nomCourtAds(brut);
      if (!court) {
        ecartes.nomsIllisibles += 1;
        continue;
      }
      if ('sid' in court) {
        ecartes.identifiantsSeuls += 1;
        continue;
      }
      const genre = objet(e.valeur) ? premier(e.valeur, K.objetNature, (x) => x ?? undefined) : undefined;
      const nature = natureObjetAds(genre ?? e.nature, court.nom);
      const c = `${nature}\u0000${court.nom}`;
      if (vus.has(c)) {
        ecartes.nomsEnDouble += 1;
        continue;
      }
      if (noms.length >= ADS_BORNES.nomsParPoint) {
        ecartes.nomsAuDela += 1;
        continue;
      }
      if (court.raccourci) ecartes.nomsRaccourcis += 1;
      vus.add(c);
      noms.push({ nom: court.nom, nature });
    }
    points.push({
      identifiant,
      reference: reference!,
      type: type!,
      niveau: niveau!,
      titre: titre!,
      objets: total,
      noms,
    });
  });
  return {
    rapport: { date: date ?? null, note: note!, progression, conformes },
    points,
    ecartes,
    objets: points.reduce((s, p) => s + p.objets, 0),
    noms: points.reduce((s, p) => s + p.noms.length, 0),
  };
}

/** Corps envoyé à l'API : la liste blanche seule (les nombres d'aperçu restent sur le poste). */
export const corpsImportAds = (e: ExtraitAds): ImportAds => ({
  rapport: e.rapport,
  points: e.points,
  ecartes: e.ecartes,
});

const pluriel = (n: number, un: string, plusieurs: string) => `${n.toLocaleString('fr-FR')} ${n > 1 ? plusieurs : un}`;

/** Aperçu avant l'envoi : nombres seulement (aucun nom n'est affiché ici). */
export function resumeExtraitAds(e: ExtraitAds): string {
  return `Note globale ${e.rapport.note} sur 5${e.rapport.date ? ` (rapport du ${e.rapport.date.split('-').reverse().join('/')})` : ''}, ${pluriel(e.points.length, 'point de contrôle non conforme', 'points de contrôle non conformes')}, ${pluriel(e.objets, 'objet concerné', 'objets concernés')} dont ${pluriel(e.noms, 'nom conservé', 'noms conservés')}.`;
}

/** Éléments écartés, en clair (« aucun » s'il n'y en a pas). */
export function libelleEcartsAds(e: EcartsImportAds): string {
  const l = ECARTS_ADS.filter((k) => e[k] > 0).map((k) => `${e[k].toLocaleString('fr-FR')} ${ECART_ADS_LIBELLES[k]}`);
  return l.length ? l.join(' ; ') : 'aucun';
}

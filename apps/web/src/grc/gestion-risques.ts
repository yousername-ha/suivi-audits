/* Gestion des risques, dessins validés par le RSSI le 27/11/2026 (registre, études EBIOS RM, cartographie) : calculs
   d'affichage, sans appel serveur. Toute échelle (niveaux, couleurs, libellés, plages de score, acceptabilité) vient de la
   méthode d'appréciation publiée dans l'application, jamais d'une échelle codée en dur (décision 2 du RSSI). Une valeur
   que l'application ne fournit pas n'est pas inventée : elle est absente. Fonctions pures, testées sans navigateur
   (apps/web/test/gestion-risques.test.ts). */
import { EBIOS_ATELIERS, type EcartMatrice, type EtatAcceptation, type RiskMethod } from '@suivi/shared';

/* ---------------------------------------------------------------- Échelle de la méthode */

export type NiveauMethode = RiskMethod['levels'][number];

/** Niveau de la méthode qui porte ce libellé (le registre ne transmet que le libellé enregistré). Libellé absent de la
    méthode, ou méthode inconnue : null (pastille neutre, rien n'est deviné). */
export function niveauParLibelle(methode: RiskMethod | null | undefined, libelle: string | null): NiveauMethode | null {
  if (!methode || !libelle) return null;
  const cherche = libelle.trim().toLocaleLowerCase('fr');
  return methode.levels.find((l) => l.label.trim().toLocaleLowerCase('fr') === cherche) ?? null;
}

/** Plage des scores de chaque niveau d'une méthode à matrice (« 1–2 », « 9 ») ; null quand la matrice ne porte pas de
    score pour ce niveau ou que la méthode n'a pas de matrice. */
export function plagesScores(methode: RiskMethod): Map<string, string | null> {
  const out = new Map<string, string | null>(methode.levels.map((l) => [l.id, null]));
  if (methode.calculation.kind !== 'matrix') return out;
  for (const l of methode.levels) {
    const scores = methode.calculation.cells
      .filter((c) => c.level === l.id && c.score !== null)
      .map((c) => c.score as number);
    if (!scores.length) continue;
    const min = Math.min(...scores),
      max = Math.max(...scores);
    out.set(l.id, min === max ? String(min) : `${min}–${max}`);
  }
  return out;
}

export interface LegendeMethode {
  /** Lecture du niveau : « Niveau : gravité × vraisemblance (4 × 4) », selon la méthode. */
  formule: string;
  niveaux: (NiveauMethode & { plage: string | null })[];
  /** Niveaux regroupés par acceptabilité, dans l'ordre de la méthode (seuil d'acceptation de la méthode). */
  acceptabilite: { acceptabilite: NiveauMethode['acceptability']; niveaux: string[] }[];
}

/** Légende de l'échelle de la méthode : formule, niveaux avec leur couleur et leur plage, seuil d'acceptation. */
export function legendeMethode(methode: RiskMethod): LegendeMethode {
  const calc = methode.calculation;
  const dimension = calc.kind === 'matrix' ? methode.dimensions.find((d) => d.id === calc.dimension) : undefined;
  const formule = dimension
    ? `Niveau : ${dimension.label.toLocaleLowerCase('fr')} × vraisemblance (${dimension.levels.length} × ${methode.likelihood.length}), méthode « ${methode.name} »`
    : `Niveau selon la méthode « ${methode.name} »`;
  const plages = plagesScores(methode);
  const ordre: NiveauMethode['acceptability'][] = ['acceptable', 'conditional', 'unacceptable'];
  return {
    formule,
    niveaux: methode.levels.map((l) => ({ ...l, plage: plages.get(l.id) ?? null })),
    acceptabilite: ordre
      .map((a) => ({
        acceptabilite: a,
        niveaux: methode.levels.filter((l) => l.acceptability === a).map((l) => l.label),
      }))
      .filter((g) => g.niveaux.length > 0),
  };
}

/* ---------------------------------------------------------------- Registre */

/** Ligne du registre des risques (GET /api/grc/:smsi/risks/register). */
export interface LigneRegistre {
  id: string;
  name: string;
  code: string;
  demarche: string | null;
  strategie: string;
  /** Responsable de la fiche (compte). */
  ownerId?: string | null;
  brut: string | null;
  residuel: string | null;
  acceptabilite: string | null;
  appreciationValidee: boolean;
  acceptation: EtatAcceptation;
  decisionAcceptation: { result: string; until: string | null; date: string; by: string } | null;
  prochaineRevue: string | null;
  enRetard: boolean;
  /** Référence « object:<id> » de l'étude dont le risque est issu. */
  etude: string | null;
  /** Écart entre le niveau enregistré et la matrice courante : signalé, jamais recalculé (le registre fait foi). */
  ecartMatrice: EcartMatrice | null;
}

/** Nombre de jours entre deux dates civiles AAAA-MM-JJ (0 si la date est invalide ou à venir). */
export function joursEcoules(depuis: string | null, jour: string): number {
  if (!depuis || !/^\d{4}-\d{2}-\d{2}$/.test(depuis) || !/^\d{4}-\d{2}-\d{2}$/.test(jour)) return 0;
  const utc = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.max(0, Math.round((utc(jour) - utc(depuis)) / 86_400_000));
}

export interface SyntheseRegistre {
  total: number;
  /** Risques sans aucune appréciation (niveau brut absent). */
  aApprecier: number;
  /** Risques dont l'appréciation retenue n'est pas validée (brouillon, ou aucune appréciation). */
  sansValidation: number;
  revuesEchues: { nombre: number; noms: string[] };
  /** Résiduel inacceptable selon la méthode, sur les risques appréciés ; et nombre de niveaux bruts inacceptables. */
  auDessusSeuil: { nombre: number; apprecies: number; brut: number | null };
  /** Répartition des niveaux résiduels sur l'échelle de la méthode (ordre de la méthode). */
  repartition: { id: string; label: string; color: string; nombre: number }[];
}

/** Chiffres des tuiles du registre, calculés sur le registre complet (sans filtre). */
export function syntheseRegistre(lignes: readonly LigneRegistre[], methode: RiskMethod | null): SyntheseRegistre {
  const apprecies = lignes.filter((l) => l.residuel !== null);
  const echues = lignes.filter((l) => l.enRetard);
  return {
    total: lignes.length,
    aApprecier: lignes.filter((l) => l.brut === null && l.residuel === null).length,
    sansValidation: lignes.filter((l) => !l.appreciationValidee).length,
    revuesEchues: { nombre: echues.length, noms: echues.map((l) => l.name) },
    auDessusSeuil: {
      nombre: apprecies.filter((l) => l.acceptabilite === 'unacceptable').length,
      apprecies: apprecies.length,
      brut: methode
        ? lignes.filter((l) => niveauParLibelle(methode, l.brut)?.acceptability === 'unacceptable').length
        : null,
    },
    repartition: (methode?.levels ?? []).map((n) => ({
      id: n.id,
      label: n.label,
      color: n.color,
      nombre: apprecies.filter((l) => niveauParLibelle(methode, l.residuel)?.id === n.id).length,
    })),
  };
}

/** Segments d'une barre de répartition (abscisses en pourcentage, sans style en ligne : attributs SVG). Les niveaux sans
    risque n'ont pas de segment. */
export function segmentsRepartition(
  parts: readonly { id: string; color: string; nombre: number }[],
): { id: string; color: string; x: number; largeur: number }[] {
  const total = parts.reduce((s, p) => s + p.nombre, 0);
  if (!total) return [];
  let x = 0;
  return parts
    .filter((p) => p.nombre > 0)
    .map((p) => {
      const largeur = (p.nombre / total) * 100;
      const seg = { id: p.id, color: p.color, x, largeur };
      x += largeur;
      return seg;
    });
}

/* ---------------------------------------------------------------- Études EBIOS RM */

/** Vue d'une étude (GET /api/grc/:smsi/risk-studies/:id), réduite à ce que la liste lit. */
export interface VueEtudeResume {
  ateliers: {
    id: string;
    objets: { kind: string }[];
    valide: boolean;
    modifieDepuisValidation: boolean;
    validations: { step: string; date: string }[];
  }[];
}

export type EtatAtelier = 'valide' | 'courant' | 'a_venir';

export interface EtatEtude {
  ateliers: { id: string; numero: number; libelle: string; etat: EtatAtelier; modifie: boolean }[];
  /** Numéro (1 à 5) du premier atelier non validé ; null quand tous sont validés. */
  courant: number | null;
  /** Étude terminée : ses cinq ateliers sont validés, sans modification depuis. */
  terminee: boolean;
  evenements: number;
  couples: number;
  scenariosStrategiques: number;
  scenariosOperationnels: number;
  /** Risques de l'étude reportés au registre (atelier 5). */
  risques: number;
  /** Dernière validation encore valable (atelier validé, le plus récent). */
  derniereValidation: { numero: number; date: string } | null;
}

/** État d'avancement d'une étude, lu dans sa vue par atelier (validations tracées par le serveur). */
export function etatEtude(vue: VueEtudeResume): EtatEtude {
  const parId = new Map(vue.ateliers.map((a) => [a.id, a]));
  const lignes = EBIOS_ATELIERS.map((def, i) => {
    const a = parId.get(def.id);
    return { def, numero: i + 1, valide: !!a?.valide, modifie: !!a?.modifieDepuisValidation, a };
  });
  const premier = lignes.find((l) => !l.valide);
  const courant = premier ? premier.numero : null;
  const objets = vue.ateliers.flatMap((a) => a.objets);
  const compte = (kind: string) => objets.filter((o) => o.kind === kind).length;
  let derniere: EtatEtude['derniereValidation'] = null;
  for (const l of lignes) {
    if (!l.valide) continue;
    const date = l.a?.validations.at(-1)?.date;
    if (date && (!derniere || date >= derniere.date)) derniere = { numero: l.numero, date };
  }
  return {
    ateliers: lignes.map((l) => ({
      id: l.def.id,
      numero: l.numero,
      libelle: l.def.court,
      etat: l.valide ? 'valide' : l.numero === courant ? 'courant' : 'a_venir',
      modifie: l.modifie,
    })),
    courant,
    terminee: vue.ateliers.length > 0 && courant === null,
    evenements: compte('feared_event'),
    couples: compte('sr_ov'),
    scenariosStrategiques: compte('strategic_scenario'),
    scenariosOperationnels: compte('operational_scenario'),
    risques: compte('risk'),
    derniereValidation: derniere,
  };
}

/** Libellé d'avancement d'une étude. */
export function libelleAvancement(e: EtatEtude): string {
  if (e.terminee) return 'Terminée';
  if (e.courant === 1) return 'Cadrage à valider';
  return `En cours · atelier ${e.courant}`;
}

/** Études affichées (décision 1 du RSSI, 27/11/2026) : une étude terminée disparaît de la liste, sauf si « Afficher les
    études terminées » est cochée. Une étude dont l'état n'est pas encore connu reste affichée : rien n'est masqué sur une
    supposition. */
export function etudesAffichees<T extends { id: string }>(
  etudes: readonly T[],
  etats: ReadonlyMap<string, EtatEtude | undefined>,
  afficherTerminees: boolean,
): { visibles: T[]; masquees: number } {
  const terminee = (e: T) => !!etats.get(e.id)?.terminee;
  return {
    visibles: afficherTerminees ? [...etudes] : etudes.filter((e) => !terminee(e)),
    masquees: afficherTerminees ? 0 : etudes.filter(terminee).length,
  };
}

export interface SyntheseEtudes {
  total: number;
  enCours: number;
  auCadrage: number;
  terminees: number;
  risques: number;
}

/** Chiffres des tuiles des études : toutes les études du périmètre, terminées comprises. */
export function syntheseEtudes(
  etudes: readonly { id: string }[],
  etats: ReadonlyMap<string, EtatEtude | undefined>,
): SyntheseEtudes {
  const connus = etudes.map((e) => etats.get(e.id)).filter((e): e is EtatEtude => !!e);
  return {
    total: etudes.length,
    enCours: connus.filter((e) => !e.terminee).length,
    auCadrage: connus.filter((e) => e.courant === 1).length,
    terminees: connus.filter((e) => e.terminee).length,
    risques: connus.reduce((s, e) => s + e.risques, 0),
  };
}

/* ---------------------------------------------------------------- Cartographie */

/** Risque projeté sur la carte (GET /api/grc/:smsi/risk-map), réduit à ce que la répartition lit. */
export interface RisqueProjete {
  assessment: {
    method_version_id: string;
    result: Partial<Record<'gross' | 'residual', { level: string }>>;
  } | null;
}

export interface RepartitionNiveaux {
  niveaux: { id: string; label: string; color: string; brut: number; residuel: number }[];
  /** Risques appréciés selon cette publication de la méthode. */
  places: number;
}

/** Du brut au résiduel : nombre de risques par niveau de la méthode, appréciés selon cette publication. */
export function repartitionBrutResiduel(
  items: readonly RisqueProjete[],
  publicationId: string,
  methode: RiskMethod,
): RepartitionNiveaux {
  const ici = items.filter((i) => i.assessment?.method_version_id === publicationId);
  return {
    niveaux: methode.levels.map((n) => ({
      id: n.id,
      label: n.label,
      color: n.color,
      brut: ici.filter((i) => i.assessment?.result.gross?.level === n.id).length,
      residuel: ici.filter((i) => i.assessment?.result.residual?.level === n.id).length,
    })),
    places: ici.length,
  };
}

/** Risques sans appréciation : ils ne se placent dans aucune matrice. */
export const risquesNonPlaces = (items: readonly RisqueProjete[]) => items.filter((i) => !i.assessment).length;

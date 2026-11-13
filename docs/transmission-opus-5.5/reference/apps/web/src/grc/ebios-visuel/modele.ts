/* Couche visuelle EBIOS RM (décision 5 du 25/10/2026, 003-07 à 003-10) : calculs purs, sans React.
   Tout vient des liens enregistrés dans l'étude (couple source/objectif visé, parties prenantes, événements redoutés) :
   aucune position ni couleur ne porte un score ; les valeurs sont toujours écrites en toutes lettres à côté. */

export interface ObjetVisuel {
  id: string;
  kind: string;
  name: string;
  data: Record<string, unknown>;
  calcul: {
    menace?: number | null;
    graviteScenarioCatalogue?: string | null;
    vraisemblanceCatalogue?: string | null;
  };
}

/* ------------------------------------------------------------------------------- pictogrammes (003-09) */
export type FamilleSource = 'malveillant' | 'criminel' | 'etatique' | 'interne' | 'accident' | 'naturel' | 'autre';
export const FAMILLES: { id: FamilleSource; libelle: string }[] = [
  { id: 'malveillant', libelle: 'Acteur malveillant' },
  { id: 'criminel', libelle: 'Criminel, voleur' },
  { id: 'etatique', libelle: 'Acteur étatique' },
  { id: 'interne', libelle: 'Interne, prestataire' },
  { id: 'accident', libelle: 'Accident, incendie, panne' },
  { id: 'naturel', libelle: 'Événement naturel' },
  { id: 'autre', libelle: 'Catégorie non reconnue' },
];
const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Pictogramme indicatif d'après la catégorie saisie. Il ne change ni la source ni son classement : un accident ou un feu
    n'est jamais présenté comme un attaquant, et une catégorie inconnue reste « non reconnue ». L'ordre des règles place
    d'abord ce qui n'est pas intentionnel. */
export function familleSource(categorie: unknown): FamilleSource {
  const c = typeof categorie === 'string' ? sansAccent(categorie) : '';
  if (!c.trim()) return 'autre';
  if (/\b(feu|incendie|accident|panne|defaillance|degat)/.test(c)) return 'accident';
  if (/(naturel|inondation|tempete|seisme|canicule|climat|foudre)/.test(c)) return 'naturel';
  if (/(etat|etatique|gouvern|espion|renseignement)/.test(c)) return 'etatique';
  if (/(crimin|voleur|vol\b|mafia|escroc|ranconn|fraud)/.test(c)) return 'criminel';
  if (/(interne|employe|salarie|negligen|erreur|prestataire|sous-traitant)/.test(c)) return 'interne';
  if (/(malveill|pirate|attaqu|hacker|cyber|hacktivis|concurrent|vengeur)/.test(c)) return 'malveillant';
  return 'autre';
}

/* ------------------------------------------------------------------------------------ chemins (003-08) */
export interface Etape {
  ref: string;
  colonne: 0 | 1 | 2;
  libelle: string;
  detail: string;
  famille?: FamilleSource;
}
export interface Chemin {
  /** Référence du scénario stratégique (object:<id>). */
  ref: string;
  nom: string;
  source: string | null;
  parties: string[];
  evenements: string[];
  gravite: string;
  /** Données absentes, dites explicitement : un chemin incomplet n'est pas dessiné. */
  manques: string[];
}
export interface Arete {
  de: string;
  vers: string;
  chemins: string[];
}
export interface ModeleChemins {
  chemins: Chemin[];
  etapes: Map<string, Etape>;
  aretes: Arete[];
}

const refs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const ref = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

const NIVEAU = ['Mineure', 'Significative', 'Grave', 'Critique'];
const texteGravite = (o: ObjetVisuel) =>
  o.calcul.graviteScenarioCatalogue
    ? `« ${o.calcul.graviteScenarioCatalogue} » (échelle publiée)`
    : typeof o.data.gravity === 'number' && o.data.gravity >= 1 && o.data.gravity <= 4
      ? `G${o.data.gravity} — ${NIVEAU[o.data.gravity - 1]}`
      : 'non renseignée';

/** Chemins stratégiques de l'étude : source → parties prenantes (dans l'ordre saisi) → événements redoutés. */
export function construireChemins(objets: readonly ObjetVisuel[]): ModeleChemins {
  const parRef = new Map(objets.map((o) => ['object:' + o.id, o]));
  const etapes = new Map<string, Etape>();
  const chemins: Chemin[] = [];
  const ajouter = (r: string, colonne: 0 | 1 | 2, detail: (o: ObjetVisuel) => string, famille?: FamilleSource) => {
    const o = parRef.get(r);
    if (!o) return false;
    if (!etapes.has(r)) etapes.set(r, { ref: r, colonne, libelle: o.name, detail: detail(o), famille });
    return true;
  };
  for (const [r, s] of parRef) {
    if (s.kind !== 'strategic_scenario') continue;
    const manques: string[] = [];
    const couple = parRef.get(ref(s.data.srOvRef) ?? '');
    const sourceRef = couple ? ref(couple.data.sourceRef) : null;
    const source = sourceRef && parRef.get(sourceRef) ? sourceRef : null;
    if (!source) manques.push(couple ? 'source du couple absente' : 'couple source / objectif visé absent');
    const evenements = refs(s.data.fearedEventRefs).filter((e) => parRef.get(e)?.kind === 'feared_event');
    if (!evenements.length) manques.push('événement redouté absent');
    const parties = refs(s.data.partyRefs).filter((p) => parRef.get(p)?.kind === 'ecosystem_party');
    if (source) {
      const famille = familleSource(parRef.get(source)!.data.category);
      ajouter(
        source,
        0,
        (o) =>
          String(o.data.category ?? '').trim() ? `Catégorie : ${String(o.data.category)}` : 'Catégorie non saisie',
        famille,
      );
    }
    for (const p of parties)
      ajouter(p, 1, (o) =>
        o.calcul.menace == null ? 'Indice de menace : critères à compléter' : `Indice de menace : ${o.calcul.menace}`,
      );
    for (const e of evenements) ajouter(e, 2, () => 'Événement redouté');
    chemins.push({ ref: r, nom: s.name, source, parties, evenements, gravite: texteGravite(s), manques });
  }
  chemins.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const aretes = new Map<string, Arete>();
  const lier = (de: string, vers: string, chemin: string) => {
    const k = de + '→' + vers;
    const a = aretes.get(k) ?? { de, vers, chemins: [] };
    if (!a.chemins.includes(chemin)) a.chemins.push(chemin);
    aretes.set(k, a);
  };
  for (const c of chemins) {
    if (c.manques.length || !c.source) continue;
    const suite = [c.source, ...c.parties];
    for (let i = 0; i + 1 < suite.length; i++) lier(suite[i]!, suite[i + 1]!, c.ref);
    for (const e of c.evenements) lier(suite[suite.length - 1]!, e, c.ref);
  }
  return { chemins, etapes, aretes: [...aretes.values()] };
}

/** Chemins qui partagent la source ou un événement redouté avec le chemin choisi (alternatives à comparer). */
export function alternatives(chemins: readonly Chemin[], choisi: Chemin) {
  const autres = chemins.filter((c) => c.ref !== choisi.ref && !c.manques.length);
  return {
    memeEvenement: autres.filter((c) => c.evenements.some((e) => choisi.evenements.includes(e))),
    memeSource: autres.filter((c) => c.source && c.source === choisi.source),
  };
}

export const LARGEUR_NOEUD = 200;
export const HAUTEUR_NOEUD = 46;
export const ECART_X = 92;
const ECART_Y = 18;
const MARGE = 16;
export interface Position {
  x: number;
  y: number;
}
/** Trois colonnes (source, parties prenantes, événements redoutés), une ligne par étape dans l'ordre de l'étude. */
export function disposer(etapes: ReadonlyMap<string, Etape>) {
  const lignes = [0, 0, 0];
  const positions = new Map<string, Position>();
  for (const e of etapes.values()) {
    const ligne = lignes[e.colonne]!;
    lignes[e.colonne] = ligne + 1;
    positions.set(e.ref, {
      x: MARGE + e.colonne * (LARGEUR_NOEUD + ECART_X),
      y: MARGE + ligne * (HAUTEUR_NOEUD + ECART_Y),
    });
  }
  const hauteur = MARGE * 2 + Math.max(1, ...lignes) * (HAUTEUR_NOEUD + ECART_Y) - ECART_Y;
  return { positions, largeur: MARGE * 2 + 3 * LARGEUR_NOEUD + 2 * ECART_X, hauteur };
}
/** Courbe de Bézier du bord droit d'une étape au bord gauche de la suivante (sens de lecture : départ → pointe). */
export function trace(a: Position, b: Position): string {
  const x1 = a.x + LARGEUR_NOEUD;
  const y1 = a.y + HAUTEUR_NOEUD / 2;
  const x2 = b.x;
  const y2 = b.y + HAUTEUR_NOEUD / 2;
  const m = Math.round((x1 + x2) / 2);
  return `M${x1} ${y1} C${m} ${y1} ${m} ${y2} ${x2} ${y2}`;
}

/* ------------------------------------------------------------------- suivi, matrice et cercle (003-07) */
export interface Ligne {
  id: string;
  ref: string;
  nom: string;
  gravite: number | null;
  vraisemblance: number | null;
  graviteTexte: string;
  vraisemblanceTexte: string;
  strategique: string;
  strategiqueRef: string;
}
/** Scénarios opérationnels de l'étude avec la gravité de leur scénario stratégique. Une valeur de l'échelle publiée sans
    rang numérique est écrite en toutes lettres mais ne se place pas dans la matrice 4 × 4. */
export function lignes(objets: readonly ObjetVisuel[]): Ligne[] {
  const parRef = new Map(objets.map((o) => ['object:' + o.id, o]));
  return objets
    .filter((o) => o.kind === 'operational_scenario')
    .map((o) => {
      const sRef = ref(o.data.strategicScenarioRef) ?? '';
      const s = parRef.get(sRef);
      const g =
        s && typeof s.data.gravity === 'number' && s.data.gravity >= 1 && s.data.gravity <= 4 ? s.data.gravity : null;
      const v =
        typeof o.data.likelihood === 'number' && o.data.likelihood >= 1 && o.data.likelihood <= 4
          ? o.data.likelihood
          : null;
      return {
        id: o.id,
        ref: 'object:' + o.id,
        nom: o.name,
        gravite: g,
        vraisemblance: v,
        graviteTexte: s ? texteGravite(s) : 'scénario stratégique absent',
        vraisemblanceTexte: o.calcul.vraisemblanceCatalogue
          ? `« ${o.calcul.vraisemblanceCatalogue} » (échelle publiée)`
          : v
            ? `V${v}`
            : 'non renseignée',
        strategique: s?.name ?? '—',
        strategiqueRef: sRef,
      };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}
export interface Filtre {
  gravite: number | null;
  vraisemblance: number | null;
}
export const filtrer = (l: readonly Ligne[], f: Filtre) =>
  l.filter(
    (x) =>
      (f.gravite === null || x.gravite === f.gravite) &&
      (f.vraisemblance === null || x.vraisemblance === f.vraisemblance),
  );
/** Scénarios sans rang de gravité ou de vraisemblance : listés à part, jamais placés. */
export const nonPlaces = (l: readonly Ligne[]) => l.filter((x) => x.gravite === null || x.vraisemblance === null);

/** Points régulièrement répartis sur un cercle (départ en haut, sens horaire). L'ordre est alphabétique : la position ne
    traduit aucun score. */
export function pointsCercle(n: number, rayon: number, cx: number, cy: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, n) - Math.PI / 2;
    return { x: Math.round((cx + rayon * Math.cos(a)) * 10) / 10, y: Math.round((cy + rayon * Math.sin(a)) * 10) / 10 };
  });
}

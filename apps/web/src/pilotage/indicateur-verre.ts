/* Fenêtre d'un indicateur en style « Verre » (dessin FicheIndicateur validé par le RSSI le 27/11/2026) : calculs purs,
   sans React. Ils ne lisent que l'indicateur tel que l'outil de suivi le conserve (sens, cible, mesures datées) et
   réutilisent les règles partagées (formatValeurIndicateur, analyserValeurIndicateur, etatIndicateur). Le dessin montre
   un « seuil d'alerte » et une « preuve » : l'outil ne les connaît pas, ils ne sont ni inventés ni affichés. */
import { analyserValeurIndicateur, etatIndicateur, formatValeurIndicateur } from '@suivi/shared';

type Ind = Record<string, unknown>;
const texte = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const mesures = (ind: Ind) =>
  (Array.isArray(ind.values) ? ind.values : [])
    .filter((x): x is Ind => !!x && typeof x === 'object')
    .map((m) => ({ date: texte(m.date).slice(0, 10), v: m.v, note: texte(m.note), hist: texte(m.hist) }))
    .filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.date));
const JOUR = 864e5;
const temps = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
/** Date AAAA-MM-JJ affichée JJ/MM/AAAA. */
export const jourCourt = (d: string) => d.split('-').reverse().join('/');

/** Une cible chiffrée entre 0 et 1 désigne un taux (même règle que formatValeurIndicateur). */
export const estTaux = (ind: Ind) => typeof ind.target === 'number' && ind.target > 0 && ind.target <= 1;

/** Sens de lecture de la cible, en clair. */
export function libelleSens(dir: string): string {
  if (dir === '≤') return 'Plus bas, c’est mieux';
  if (dir === '≥') return 'Plus haut, c’est mieux';
  if (dir === '=') return 'Valeur attendue';
  return 'À définir';
}

/** « cible ≤ 10 », « cible ≥ 90 % », « cible : Oui » ; « cible à définir » sans sens ou sans valeur. */
export function libelleCible(ind: Ind): string {
  const dir = texte(ind.dir);
  if (!dir || ind.target === '' || ind.target == null) return 'cible à définir';
  const v = formatValeurIndicateur(ind, ind.target);
  return dir === '=' ? `cible : ${v}` : `cible ${dir} ${v}`;
}

export interface PointSerie {
  date: string;
  v: number;
}
export type PeriodeSerie = 6 | 12 | 'tout';
/** Mesures chiffrées de la période courante (les valeurs d'une « période historique » sont à part), par date, limitées aux
    `periode` derniers mois avant la mesure la plus récente. */
export function serieIndicateur(ind: Ind, periode: PeriodeSerie): PointSerie[] {
  const points = mesures(ind)
    .filter((m) => !m.hist && typeof m.v === 'number' && Number.isFinite(m.v))
    .map((m) => ({ date: m.date, v: m.v as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (periode === 'tout' || !points.length) return points;
  const fin = points.at(-1)!.date;
  const debut = new Date(temps(fin));
  debut.setUTCMonth(debut.getUTCMonth() - periode);
  const borne = debut.toISOString().slice(0, 10);
  return points.filter((p) => p.date > borne);
}

export interface Tendance {
  sens: 'hausse' | 'baisse' | 'stable';
  /** Variation en clair, par exemple « ↓ 5 en 30 jours » ou « ↑ 2,5 pts en 31 jours ». */
  texte: string;
  /** Sens favorable selon l'opérateur de la cible (≤ : baisse ; ≥ : hausse) ; null pour « = », sans sens ou stable. */
  favorable: boolean | null;
}
/** Variation entre les deux dernières mesures chiffrées de la période courante ; null s'il n'y en a pas deux. */
export function tendanceMesures(ind: Ind): Tendance | null {
  const s = serieIndicateur(ind, 'tout');
  if (s.length < 2) return null;
  const [a, b] = [s.at(-2)!, s.at(-1)!];
  const ecart = b.v - a.v;
  const jours = Math.round((temps(b.date) - temps(a.date)) / JOUR);
  const sens = ecart > 0 ? 'hausse' : ecart < 0 ? 'baisse' : 'stable';
  const absolu = Math.abs(ecart);
  const valeur = estTaux(ind)
    ? `${String(Math.round(absolu * 1000) / 10).replace('.', ',')} pt${absolu * 100 >= 2 ? 's' : ''}`
    : String(Math.round(absolu * 100) / 100).replace('.', ',');
  const duree = jours === 0 ? 'le même jour' : `en ${jours} jour${jours > 1 ? 's' : ''}`;
  const dir = texte(ind.dir);
  const favorable = sens === 'stable' || !['≤', '≥'].includes(dir) ? null : (dir === '≤') === (sens === 'baisse');
  return {
    sens,
    texte: sens === 'stable' ? `→ stable ${duree}` : `${sens === 'hausse' ? '↑' : '↓'} ${valeur} ${duree}`,
    favorable,
  };
}

/** Les `n` mesures les plus récentes (période historique comprise, signalée), valeur mise en forme. */
export function dernieresMesures(ind: Ind, n = 3): { date: string; valeur: string; hist: string }[] {
  return mesures(ind)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n)
    .map((m) => ({ date: m.date, valeur: formatValeurIndicateur(ind, m.v), hist: m.hist }));
}

/** Alerte de la saisie : la valeur saisie, comparée à la cible enregistrée selon son opérateur, la manquerait. Rien tant
    que la valeur est vide, que la cible n'est pas définie ou que la valeur la respecte. */
export function alerteSaisie(ind: Ind, saisie: string): string | null {
  const v = analyserValeurIndicateur(ind, saisie);
  if (v === null) return null;
  const essai = { dir: ind.dir, target: ind.target, values: [{ date: '2000-01-01', v }] };
  if (etatIndicateur(essai, {}) !== 'ko') return null;
  const dir = texte(ind.dir);
  const ecart =
    dir === '≤' ? 'Au-dessus de la cible' : dir === '≥' ? 'En dessous de la cible' : 'Différente de la valeur attendue';
  const action = texte(ind.action).trim();
  return `${ecart} (${libelleCible(ind)}) : la mesure sera « Non atteint ». ${
    action
      ? `Action prévue si non atteint : ${action}.`
      : 'Aucune action n’est prévue si non atteint (onglet Définition).'
  }`;
}

/** Lien du pied vers les données d'un indicateur calculé par l'outil ; null pour un indicateur saisi. */
export function lienSource(calc: unknown): { to: string; libelle: string; module: 'fournisseurs' | 'ecarts' } | null {
  if (calc === 'saasMfa' || calc === 'saasSso')
    return { to: '/pilotage/fournisseurs', libelle: 'Voir les services SaaS', module: 'fournisseurs' };
  if (calc === 'afnorNcMaj' || calc === 'interneNcMaj' || calc === 'interneNcMajOpen')
    return { to: '/pilotage/amelioration', libelle: 'Voir les écarts', module: 'ecarts' };
  return null;
}

/* ------------------------------------------------------------------ Géométrie du graphique (SVG à attributs) */
export interface GeometrieSerie {
  /** Tracé de la courbe et de l'aire sous la courbe. */
  ligne: string;
  aire: string;
  points: { x: number; y: number; date: string; v: number }[];
  /** Ordonnée de la cible chiffrée, et zone où la cible est respectée (≤ : dessous ; ≥ : dessus). */
  cible: { y: number; zone: { y: number; hauteur: number } | null } | null;
  /** Repères de l'axe du temps, régulièrement espacés de la première à la dernière date. */
  reperes: string[];
}
/** Positions dans un cadre `largeur` × `hauteur` (unités CSS) : abscisse proportionnelle au temps, ordonnée à la valeur,
    domaine élargi à la cible pour qu'elle reste visible. */
export function geometrieSerie(
  ind: Ind,
  serie: readonly PointSerie[],
  largeur: number,
  hauteur: number,
): GeometrieSerie {
  const marge = { haut: 12, bas: 12, gauche: 6, droite: 6 };
  const cibleChiffree = typeof ind.target === 'number' && ['≤', '≥'].includes(texte(ind.dir)) ? ind.target : null;
  const valeurs = [...serie.map((p) => p.v), ...(cibleChiffree !== null ? [cibleChiffree] : [])];
  let min = Math.min(...valeurs),
    max = Math.max(...valeurs);
  if (!valeurs.length) [min, max] = [0, 1];
  if (min === max) [min, max] = [min - (estTaux(ind) ? 0.1 : 1), max + (estTaux(ind) ? 0.1 : 1)];
  const jeu = (max - min) * 0.12;
  [min, max] = [min - jeu, max + jeu];
  const t0 = serie.length ? temps(serie[0]!.date) : 0,
    t1 = serie.length ? temps(serie.at(-1)!.date) : 1;
  const xDe = (d: string) =>
    t1 === t0 ? largeur / 2 : marge.gauche + ((temps(d) - t0) / (t1 - t0)) * (largeur - marge.gauche - marge.droite);
  const yDe = (v: number) => marge.haut + (1 - (v - min) / (max - min)) * (hauteur - marge.haut - marge.bas);
  const arrondi = (n: number) => Math.round(n * 10) / 10;
  const points = serie.map((p) => ({ x: arrondi(xDe(p.date)), y: arrondi(yDe(p.v)), date: p.date, v: p.v }));
  const ligne = points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  const aire = points.length ? `${ligne} L${points.at(-1)!.x} ${hauteur} L${points[0]!.x} ${hauteur} Z` : '';
  let cible: GeometrieSerie['cible'] = null;
  if (cibleChiffree !== null) {
    const y = arrondi(yDe(cibleChiffree));
    cible = { y, zone: texte(ind.dir) === '≤' ? { y, hauteur: arrondi(hauteur - y) } : { y: 0, hauteur: y } };
  }
  const mois = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
  const annee = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const surPlusieursAnnees = serie.length > 0 && serie[0]!.date.slice(0, 4) !== serie.at(-1)!.date.slice(0, 4);
  const nb = serie.length < 2 ? serie.length : Math.min(7, serie.length);
  const reperes = Array.from({ length: nb }, (_, k) => {
    const t = nb === 1 ? t0 : t0 + ((t1 - t0) * k) / (nb - 1);
    return (surPlusieursAnnees ? annee : mois).format(new Date(t));
  });
  return { ligne, aire, points, cible, reperes };
}

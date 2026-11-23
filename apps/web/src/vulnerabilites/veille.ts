/* Veille des vulnérabilités (ADR 0100, lots V2 et V3) : présentation sans état ni appel réseau (testée à part). Le serveur
   reste seul juge des droits, du flux et de la file des collectes. Les textes des sources s'affichent tels quels, comme
   texte simple ; une adresse d'avis n'est rendue en lien que si elle a la forme attendue pour sa source (https, hôte de la
   source), contrôlée une seconde fois ici. */
import {
  type Action,
  ADRESSE_CERTFR,
  ADRESSE_CERTSANTE,
  type AvisVeilleDto,
  type EtatDictionnaireCpeDto,
  type EtatSourceAnnonceDto,
  type EtatSourceVeilleDto,
  type EtatVeilleDto,
  type GraviteCvss,
  type Module,
  type SourceVeille,
  sourceVeille,
} from '@suivi/shared';
import type { Etat } from '@suivi/ui';
import { etatDictionnaireCpe } from './dictionnaire-cpe';

/** Adresse de la liste des avis (recherche, source, page), lue par le serveur. */
export function urlAvis(q: string, page = 1): string {
  const p = new URLSearchParams();
  if (q.trim()) p.set('q', q.trim());
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return `/api/vulnerabilites/veille/avis${s ? `?${s}` : ''}`;
}

/** Adresse de la liste des failles connues ; `kev` : seulement le catalogue des failles exploitées. */
export function urlFailles(q: string, kev: boolean, page = 1): string {
  const p = new URLSearchParams();
  if (q.trim()) p.set('q', q.trim());
  if (kev) p.set('kev', 'oui');
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return `/api/vulnerabilites/veille/failles${s ? `?${s}` : ''}`;
}

/** État affiché d'une source : veille inactive, collecte en cours, erreur, retard, à jour ou jamais collectée. */
export function etatSource(s: EtatSourceVeilleDto, fluxOuvert: boolean): { libelle: string; etat: Etat } {
  const c = s.derniereCollecte;
  if (c && (c.etat === 'en_file' || c.etat === 'en_cours'))
    return { libelle: c.etat === 'en_file' ? 'Collecte demandée' : 'Collecte en cours', etat: 'info' };
  if (!fluxOuvert) return { libelle: 'Veille inactive', etat: 'neutre' };
  if (s.erreur) return { libelle: 'En erreur', etat: 'erreur' };
  if (s.enRetard) return { libelle: s.derniereReussite ? 'En retard' : 'Jamais collectée', etat: 'attention' };
  return { libelle: 'À jour', etat: 'succes' };
}

/* ------------------------------------------------------------------ Lot VEILLE-PLATEFORME */
/** Carte de la page Plateforme où se configure la veille (décision du RSSI du 23/11/2026, « comme pour les intégrations »). */
export const LIEN_CONFIGURATION_VEILLE = '/plateforme/veille-vulnerabilites';

/** Droit qui montre la carte « Veille des vulnérabilités » de la Plateforme et le lien « Configurer » de l'écran « Veille » :
    celui qui protégeait déjà ces réglages (administrer le module, avec sa lecture, sans laquelle l'état ne se lit pas).
    Affichage seulement : le serveur reste seul juge (routes inchangées). */
export const peutConfigurerVeille = (can: (m: Module, a: Action) => boolean) =>
  can('vulnerabilites', 'lire') && can('vulnerabilites', 'administrer');

/** Longueur d'une erreur sur la ligne d'état d'une source ; le texte entier se lit dans la carte de la Plateforme. */
export const ERREUR_COURTE = 140;
export function erreurCourte(e: string | null, max = ERREUR_COURTE): string | null {
  if (!e) return null;
  const t = e.trim().replace(/\s+/g, ' ');
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** État d'une source facultative (préavis de Cloudflare Radar, résumés de tldrcve). */
export function etatSourceAnnonce(
  s: Pick<EtatSourceAnnonceDto, 'activee' | 'erreur' | 'derniereReussite'>,
  fluxOuvert: boolean,
): { libelle: string; etat: Etat } {
  if (!s.activee) return { libelle: 'Désactivée', etat: 'neutre' };
  if (!fluxOuvert) return { libelle: 'Veille inactive', etat: 'neutre' };
  if (s.erreur) return { libelle: 'En erreur', etat: 'erreur' };
  if (!s.derniereReussite) return { libelle: 'Jamais collectée', etat: 'attention' };
  return { libelle: 'À jour', etat: 'succes' };
}

/** Une ligne d'état d'une source, en lecture seule, sur l'écran « Veille ». */
export interface LigneEtatVeille {
  cle: string;
  libelle: string;
  /** Source dont la pastille existe (les cinq sources et NVD pour le dictionnaire) ; null sinon. */
  picto: SourceVeille | null;
  etat: { libelle: string; etat: Etat };
  /** Dernière collecte réussie (dictionnaire : date jusqu'à laquelle la liste est à jour). */
  derniere: string | null;
  erreur: string | null;
}

/** Lignes d'état de toutes les sources : les cinq sources publiques, le dictionnaire CPE, les sources facultatives. */
export function lignesEtatVeille(
  etat: EtatVeilleDto | undefined,
  dictionnaire: EtatDictionnaireCpeDto | undefined,
  annonces: readonly EtatSourceAnnonceDto[] | undefined,
): LigneEtatVeille[] {
  const ouvert = !!etat?.flux.ouvert;
  return [
    ...(etat?.sources ?? []).map((s) => ({
      cle: s.source,
      libelle: s.libelle,
      picto: s.source,
      etat: etatSource(s, ouvert),
      derniere: s.derniereReussite,
      erreur: erreurCourte(s.erreur),
    })),
    ...(dictionnaire
      ? [
          {
            cle: 'nvd-cpe',
            libelle: dictionnaire.source.libelle,
            picto: 'nvd' as const,
            etat: etatDictionnaireCpe(dictionnaire),
            derniere: dictionnaire.derniereMiseAJour,
            erreur: erreurCourte(dictionnaire.erreur),
          },
        ]
      : []),
    ...(annonces ?? []).map((s) => ({
      cle: s.source,
      libelle: s.libelle,
      picto: null,
      etat: etatSourceAnnonce(s, ouvert),
      derniere: s.derniereReussite,
      erreur: erreurCourte(s.erreur),
    })),
  ];
}

export const libelleLangue = (l: 'fr' | 'en') => (l === 'fr' ? 'Français' : 'Anglais (texte d’origine)');
export const libelleSource = (s: SourceVeille) => sourceVeille(s).libelle;
export const libelleSourceAvis = (s: AvisVeilleDto['source']) => (s === 'cert-fr' ? 'CERT-FR' : 'CERT Santé');

/** Lien vers l'avis, seulement s'il a la forme attendue pour sa source ; sinon aucun lien. */
export function adresseAvis(a: Pick<AvisVeilleDto, 'source' | 'adresse'>): string | null {
  if (!a.adresse) return null;
  return (a.source === 'cert-fr' ? ADRESSE_CERTFR : ADRESSE_CERTSANTE).test(a.adresse) ? a.adresse : null;
}

/** Identifiant affiché d'un avis : celui du CERT-FR, ou le numéro de l'alerte du CERT Santé. */
export const identifiantAvis = (a: Pick<AvisVeilleDto, 'source' | 'identifiant'>) =>
  a.source === 'cert-fr' ? a.identifiant : `CERT Santé n° ${a.identifiant}`;

export const GRAVITE_LIBELLES: Record<GraviteCvss, string> = {
  NONE: 'Aucune',
  LOW: 'Faible',
  MEDIUM: 'Moyenne',
  HIGH: 'Élevée',
  CRITICAL: 'Critique',
};
export const GRAVITE_ETAT: Record<GraviteCvss, Etat> = {
  NONE: 'neutre',
  LOW: 'neutre',
  MEDIUM: 'attention',
  HIGH: 'erreur',
  CRITICAL: 'erreur',
};

const pourcent = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 2 });
/** Score EPSS : probabilité publiée entre 0 et 1, affichée en pourcentage, avec son centile. */
export const libelleEpss = (e: { score: number; centile: number }) =>
  `${pourcent.format(e.score)} (centile ${pourcent.format(e.centile)})`;

/** Date du jour (AAAA-MM-JJ) affichée à la française, sans conversion de fuseau. */
export function dateCourte(d: string | null): string {
  const m = d ? /^(\d{4})-(\d{2})-(\d{2})/.exec(d) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

/** Échéance du catalogue KEV dépassée à la date donnée (AAAA-MM-JJ). */
export const echeanceDepassee = (echeance: string | null, aujourdhui: string) => !!echeance && echeance < aujourdhui;

/** Nombre de pages d'une liste paginée. */
export const nombrePages = (total: number, parPage: number) => Math.max(1, Math.ceil(total / parPage));

/** Message après « Collecter maintenant » (demande du RSSI du 19/11/2026) : seules les sources de la veille sont relancées ;
    les connecteurs se synchronisent depuis la carte « Intégrations » de la Plateforme. */
export function messageCollectesDemandees(n: number): string {
  const s = n > 1 ? 's' : '';
  return `${n} collecte${s} de veille demandée${s} : l’exécutant les traite à son prochain passage. Les connecteurs (Tenable, AlgoLightHouse) ne sont pas concernés.`;
}

/* ------------------------------------------------------------------ Lot L1 : lisibilité des alertes et avis */
/** Bloc d'un texte de source : paragraphe ou liste à puces. Le texte reste du texte simple (rendu échappé par React). */
export type BlocTexte = { type: 'paragraphe'; texte: string } | { type: 'liste'; elements: string[] };

/** Puce intégrée au texte : tiret, tiret moyen, puce ou astérisque entre espaces, après une ponctuation de fin. */
const PUCE_EN_LIGNE = /(?<=[.:;!?])\s+[-–•*]\s+/g;
const PUCE_EN_TETE = /^\s*[-–•*]\s+/;

/** Découpe un texte de source en paragraphes et listes, sans rien réécrire : retours à la ligne (paragraphe sur une ligne
    vide, puce en tête de ligne) et, pour un texte sur une ligne (forme rangée par la veille), puces intégrées quand il y en
    a au moins deux. Aucun balisage n'est interprété. */
export function blocsTexte(texte: string): BlocTexte[] {
  const brut = texte.trim();
  if (!brut) return [];
  const enLigne = brut.match(PUCE_EN_LIGNE)?.length ?? 0;
  const normalise = !brut.includes('\n') && enLigne >= 2 ? brut.replace(PUCE_EN_LIGNE, '\n- ') : brut;
  const blocs: BlocTexte[] = [];
  let paragraphe: string[] = [];
  const fermer = () => {
    if (paragraphe.length) blocs.push({ type: 'paragraphe', texte: paragraphe.join(' ') });
    paragraphe = [];
  };
  for (const ligne of normalise.split(/\r?\n/).map((l) => l.trim())) {
    if (!ligne) {
      fermer();
      continue;
    }
    if (PUCE_EN_TETE.test(ligne)) {
      fermer();
      const element = ligne.replace(PUCE_EN_TETE, '');
      const dernier = blocs[blocs.length - 1];
      if (dernier?.type === 'liste') dernier.elements.push(element);
      else blocs.push({ type: 'liste', elements: [element] });
      continue;
    }
    paragraphe.push(ligne);
  }
  fermer();
  return blocs;
}

/** Une alerte du CERT-FR se distingue d'un avis (et d'une publication du CERT Santé, toujours rangée comme alerte) : c'est
    la règle des recommandations de la fiche illustrée (lot PC4). */
export const alerteUrgente = (a: Pick<AvisVeilleDto, 'source' | 'nature'>) =>
  a.source === 'cert-fr' && a.nature === 'alerte';

/** Marques d'une alerte ou d'un avis, tirées de ce que la veille range déjà (rien n'est déduit d'ailleurs) : exploitation
    avérée selon la règle V26 (alerte du CERT-FR qui cite une CVE, mention « activement exploitée : oui » de la fiche du
    CERT Santé), preuve de concept disponible (fiche du CERT Santé). La présence sur le parc et l'exposition sur Internet ne
    sont pas dans la réponse de la liste : elles se lisent dans la fiche de chaque CVE. */
export function marquesAvis(
  a: Pick<AvisVeilleDto, 'source' | 'nature' | 'cves' | 'fiche'> & { parc?: AvisVeilleDto['parc'] },
): { libelle: string; etat: 'erreur' | 'attention' }[] {
  const out: { libelle: string; etat: 'erreur' | 'attention' }[] = [];
  if (alerteUrgente(a) && a.cves.length)
    out.push({ libelle: 'Exploitation avérée (alerte du CERT-FR)', etat: 'erreur' });
  if (a.fiche?.exploitee === 'oui') out.push({ libelle: 'Exploitée selon le CERT Santé', etat: 'erreur' });
  if (a.fiche?.preuveConcept === 'disponible')
    out.push({ libelle: 'Preuve de concept disponible (CERT Santé)', etat: 'attention' });
  // Lot PRIO-1 (décision du RSSI du 20/11/2026) : une CVE citée concerne la plateforme.
  if (a.parc?.presentes.length)
    out.push({ libelle: marqueParc('Présente sur le parc', a.parc.presentes, a.cves), etat: 'attention' });
  if (a.parc?.exposees.length)
    out.push({ libelle: marqueParc('Exposée sur Internet', a.parc.exposees, a.cves), etat: 'erreur' });
  return out;
}

/** « Présente sur le parc », ou « Présente sur le parc (2 CVE citées sur 5) » quand toutes ne le sont pas. */
function marqueParc(libelle: string, concernees: readonly string[], citees: readonly string[]): string {
  return concernees.length === citees.length
    ? libelle
    : `${libelle} (${concernees.length} CVE citée${concernees.length > 1 ? 's' : ''} sur ${citees.length})`;
}

/** Libellé de la nature : « Alerte » ou « Avis ». */
export const libelleNatureAvis = (a: Pick<AvisVeilleDto, 'nature'>) => (a.nature === 'alerte' ? 'Alerte' : 'Avis');

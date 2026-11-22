/* Veille réglementaire (ADR 0110) : présentation sans état ni appel réseau (testée à part). Le serveur reste seul juge des
   droits, du flux et de la file des collectes. Les textes des sources s'affichent tels quels, comme texte simple ; le lien
   d'une publication n'est rendu que s'il a la forme attendue pour sa source (https, hôte de la source), contrôlée une
   seconde fois ici. Pastilles de source dessinées pour la charte (sigle, forme, teinte), jamais un logo officiel. */
import {
  DOMAINES_REGLEMENTAIRES,
  type DomaineReglementaire,
  type DroitsVeilleReglementaireDto,
  type EtatSourceReglementaireDto,
  LIBELLES_STATUTS,
  lienPublicationValide,
  type MotCleEurLex,
  type PublicationReglementaireDto,
  sourceReglementaire,
  type SourceReglementaire,
  type StatutPublication,
} from '@suivi/shared';
import type { Etat } from '@suivi/ui';
import type { FormePicto, TeintePicto } from '../vulnerabilites/pictos-sources';

export interface FiltresPublications {
  statut: StatutPublication | '';
  domaine: DomaineReglementaire | '';
  source: SourceReglementaire | '';
  q: string;
}
export const FILTRES_VIDES: FiltresPublications = { statut: '', domaine: '', source: '', q: '' };

/** Adresse de la liste des publications (filtres, recherche, page), lue par le serveur. */
export function urlPublications(f: FiltresPublications, page = 1): string {
  const p = new URLSearchParams();
  if (f.statut) p.set('statut', f.statut);
  if (f.domaine) p.set('domaine', f.domaine);
  if (f.source) p.set('source', f.source);
  if (f.q.trim()) p.set('q', f.q.trim());
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return `/api/veille-reglementaire/publications${s ? `?${s}` : ''}`;
}

/** Lien de la publication, seulement s'il a la forme attendue pour sa source ; sinon aucun lien. */
export const lienPublication = (p: Pick<PublicationReglementaireDto, 'source' | 'lien'>): string | null =>
  lienPublicationValide(p.source, p.lien) ? p.lien : null;

export const ETAT_STATUT: Record<StatutPublication, Etat> = {
  'a-qualifier': 'info',
  'sans-objet': 'neutre',
  'a-suivre': 'attention',
  impactant: 'erreur',
};
export const libelleStatut = (s: StatutPublication) => LIBELLES_STATUTS[s];

/** La personne peut-elle qualifier cette publication (rôle du domaine) ? Affichage seulement. */
export const peutQualifier = (
  d: DroitsVeilleReglementaireDto | undefined,
  p: Pick<PublicationReglementaireDto, 'domaine'>,
) => !!d && (p.domaine === 'securite' ? d.qualifier.securite : d.qualifier.donneesPersonnelles);

/** Qui qualifie un domaine, en clair : le rôle RSSI (sécurité), le droit DPO (données personnelles). */
export const qualifieurDuDomaine = (domaine: DomaineReglementaire) =>
  domaine === 'securite' ? 'au rôle RSSI' : 'au droit DPO';

/** État affiché d'une source : non disponible (sans collecteur : ANS, Légifrance), désactivée, veille inactive, collecte en cours, erreur, retard, à jour. */
export function etatSourceReglementaire(
  s: EtatSourceReglementaireDto,
  fluxOuvert: boolean,
): { libelle: string; etat: Etat } {
  if (!s.collecteur) return { libelle: 'Non disponible', etat: 'neutre' };
  if (!s.activee) return { libelle: 'Désactivée', etat: 'neutre' };
  const c = s.derniereCollecte;
  if (c && (c.etat === 'en_file' || c.etat === 'en_cours'))
    return { libelle: c.etat === 'en_file' ? 'Collecte demandée' : 'Collecte en cours', etat: 'info' };
  if (!fluxOuvert) return { libelle: 'Veille inactive', etat: 'neutre' };
  if (s.enErreur) return { libelle: 'En erreur', etat: 'erreur' };
  if (s.enRetard) return { libelle: s.derniereReussite ? 'En retard' : 'Jamais collectée', etat: 'attention' };
  return { libelle: 'À jour', etat: 'succes' };
}

/** Mots-clés d'EUR-Lex d'un domaine, un par ligne, pour la saisie. */
export const lignesMotsCles = (liste: readonly MotCleEurLex[], domaine: DomaineReglementaire) =>
  liste
    .filter((m) => m.domaine === domaine)
    .map((m) => m.mot)
    .join('\n');

/** Liste saisie (un mot par ligne et par domaine), lignes vides retirées ; le serveur valide bornes et doublons. */
export function motsClesSaisis(texte: Record<DomaineReglementaire, string>): MotCleEurLex[] {
  return DOMAINES_REGLEMENTAIRES.flatMap((domaine) =>
    texte[domaine]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((mot) => ({ mot, domaine })),
  );
}

/** Message après « Collecter maintenant ». */
export function messageCollectes(n: number): string {
  const s = n > 1 ? 's' : '';
  return `${n} collecte${s} demandée${s} : l’exécutant les traite à son prochain passage.`;
}

/** Nom de la source. */
export const libelleSource = (s: SourceReglementaire) => sourceReglementaire(s).libelle;

/** Carte d'une publication (choix du RSSI du 22/11/2026, « actes ») : nom court de la source et nature de l'autorité,
    affichés en tête de la carte. Libellés descriptifs, sans valeur juridique. */
export const AUTORITES_REGLEMENTAIRES: Record<SourceReglementaire, { court: string; autorite: string }> = {
  cnil: { court: 'CNIL', autorite: 'Autorité de contrôle' },
  cepd: { court: 'CEPD', autorite: 'Comité européen' },
  'eur-lex': { court: 'EUR-Lex', autorite: 'Union européenne' },
  anssi: { court: 'ANSSI', autorite: 'Agence nationale' },
  ans: { court: 'ANS', autorite: 'Agence nationale (santé)' },
  legifrance: { court: 'Légifrance', autorite: 'Journal officiel' },
};

/* ------------------------------------------------------------------ Pastilles (dessinées pour la charte) */
export interface PictoReglementaire {
  sigle: string;
  nom: string;
  forme: FormePicto;
  teinte: TeintePicto;
}
/** Une pastille par source, de forme différente de ses voisines : la distinction ne repose jamais sur la couleur seule. */
export const PICTOS_REGLEMENTAIRES: Record<SourceReglementaire, PictoReglementaire> = {
  cnil: { sigle: 'CNIL', nom: 'CNIL', forme: 'hexagone', teinte: 'violet' },
  cepd: { sigle: 'CEPD', nom: 'Comité européen de la protection des données', forme: 'pilule', teinte: 'bleu' },
  'eur-lex': { sigle: 'EUR', nom: 'EUR-Lex', forme: 'rectangle', teinte: 'marine' },
  anssi: { sigle: 'SSI', nom: 'ANSSI', forme: 'bouclier', teinte: 'rouge' },
  ans: { sigle: 'ANS', nom: 'Agence du numérique en santé', forme: 'octogone', teinte: 'vert' },
  legifrance: { sigle: 'JO', nom: 'Journal officiel (Légifrance)', forme: 'trapeze', teinte: 'gris' },
};

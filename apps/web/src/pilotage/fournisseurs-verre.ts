/* Fournisseurs, présentation « Verre » (dessins validés par le RSSI le 27/11/2026 : liste compacte qui se déplie, fiche
   du fournisseur). Fonctions pures, sans React ni requête : elles ne lisent que les champs déjà rendus par
   `GET /api/suppliers` et n'ajoutent ni note, ni seuil, ni verdict qui n'existe pas dans l'outil. */
import { etatControle, maintenantLocalParis, prochainControle } from '@suivi/shared';
import {
  jourFr,
  type CertificatFournisseur,
  type ControleFournisseur,
  type Fournisseur,
  type TonFournisseur,
} from './fournisseurs-types';

/** Une seule ligne dépliée à la fois : cliquer la ligne ouverte la replie, cliquer une autre ligne la remplace. */
export const basculerDepli = (ouvert: string | null, id: string): string | null => (ouvert === id ? null : id);

/** Initiales de la pastille : premières lettres des deux premiers mots significatifs (« Éditeur fictif » → « ÉF »). */
export function initiales(nom: string): string {
  const mots = nom
    .split(/[\s\-–—'’.,/()]+/u)
    .filter((m) => m.length > 1 || /\p{Lu}/u.test(m))
    .filter((m) => !/^(de|du|des|la|le|les|et|d|l|en|à|au|aux)$/iu.test(m));
  const lettres = (mots.length ? mots : [nom.trim()])
    .slice(0, 2)
    .map((m) => Array.from(m)[0] ?? '')
    .join('');
  return lettres.toLocaleUpperCase('fr') || '?';
}

/** Signe d'une valeur de suivi au format « SSO ✓ · MFA ✓ » choisi par le RSSI : coche verte (oui), croix rose (non),
    tiret (sans objet) ; « En cours » et « non renseigné » gardent leur texte. Le texte accessible dit la valeur. */
export interface SigneAcces {
  signe: string;
  texte: string;
  ton: TonFournisseur;
}
export function signeAcces(valeur: string): SigneAcces {
  if (valeur === 'Oui') return { signe: '✓', texte: 'oui', ton: 'good' };
  if (valeur === 'Non') return { signe: '✕', texte: 'non', ton: 'bad' };
  if (valeur === 'N/A') return { signe: '—', texte: 'sans objet', ton: 'neutral' };
  if (valeur === 'En cours') return { signe: '…', texte: 'en cours', ton: 'warn' };
  return { signe: '?', texte: 'non renseigné', ton: 'neutral' };
}

/** Résumé de l'évaluation courante en une puce, à partir des seuls décomptes oui / non / non évalué : aucune note. */
export function etatEvaluation(f: Pick<Fournisseur, 'current' | 'toReview'>): { libelle: string; ton: TonFournisseur } {
  const e = f.current;
  if (!e) return { libelle: 'Non évalué', ton: 'neutral' };
  if (f.toReview) return { libelle: 'À réévaluer', ton: 'bad' };
  if (e.notMeets > 0)
    return {
      libelle: `${e.notMeets} critère${e.notMeets > 1 ? 's' : ''} non satisfait${e.notMeets > 1 ? 's' : ''}`,
      ton: 'bad',
    };
  if (e.notAssessed > 0) return { libelle: 'À compléter', ton: 'warn' };
  if (!e.items) return { libelle: 'Sans critère', ton: 'neutral' };
  return { libelle: 'Critères satisfaits', ton: 'good' };
}

/** Date AAAA-MM-JJ affichée MM/AAAA (colonne « Prochain contrôle ») ; « – » si absente. */
export const moisAnnee = (d: string | null | undefined) =>
  d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : '–';

const JOUR = 864e5;
const versJour = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
/** Échéance d'un certificat, avec le même seuil de 90 jours que l'état calculé par le serveur (etatCertificats). */
export function echeanceCertificat(
  c: Pick<CertificatFournisseur, 'validUntil'>,
  aujourdhui: string,
): { ton: TonFournisseur; alerte: string | null } {
  const fin = c.validUntil ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fin)) return { ton: 'warn', alerte: 'Date de validité à saisir.' };
  const jours = Math.round((versJour(fin) - versJour(aujourdhui)) / JOUR);
  if (jours < 0) return { ton: 'bad', alerte: 'Expiré : demander le certificat renouvelé.' };
  if (jours <= 90) {
    const delai =
      jours === 0
        ? 'aujourd’hui'
        : jours < 14
          ? `dans ${jours} jour${jours > 1 ? 's' : ''}`
          : `dans ${Math.floor(jours / 7)} semaines`;
    return { ton: 'warn', alerte: `Expire ${delai} : demander le renouvellement.` };
  }
  return { ton: 'good', alerte: null };
}

/** Ligne d'un contrôle périodique : intitulé et fréquence, puis l'état de l'outil de suivi (en retard, à réaliser, non
    conforme), le résultat « Conforme » du dernier contrôle, ou la prochaine échéance. */
export function ligneControle(
  c: ControleFournisseur,
  aujourdhui: string,
): { intitule: string; etat: string; ton: TonFournisseur | null } {
  const intitule = `${c.t} · ${c.freq ?? 12} mois`;
  const [libelle, niveau] = etatControle(c as unknown as Record<string, unknown>, aujourdhui);
  if (niveau === 'bad') return { intitule, etat: libelle, ton: 'bad' };
  if (niveau === 'mid') return { intitule, etat: libelle, ton: 'warn' };
  if (c.result === 'Conforme') return { intitule, etat: 'Conforme', ton: 'good' };
  return {
    intitule,
    etat: `prévu en ${moisAnnee(prochainControle(c as unknown as Record<string, unknown>))}`,
    ton: null,
  };
}

/** Puces de l'en-tête de la fiche : criticité, hébergeur HDS déclaré, état des certificats s'il demande une action. */
export function pucesFiche(
  f: Pick<Fournisseur, 'critical' | 'hds' | 'certificateState'>,
): { libelle: string; ton: TonFournisseur }[] {
  const out: { libelle: string; ton: TonFournisseur }[] = [];
  if (f.critical === 'Oui') out.push({ libelle: 'Critique', ton: 'bad' });
  if (f.hds === 'Oui') out.push({ libelle: 'Hébergeur HDS', ton: 'info' });
  const [etat, niveau] = f.certificateState;
  const certificat: Record<string, string> = {
    'Expire ≤ 90 j': 'Certificat à renouveler',
    Expiré: 'Certificat expiré',
    'À fournir': 'Certificat à fournir',
    'Date à saisir': 'Date de certificat à saisir',
  };
  if (niveau === 'bad' || niveau === 'mid')
    out.push({ libelle: certificat[etat] ?? `Certificat : ${etat}`, ton: niveau === 'bad' ? 'bad' : 'warn' });
  return out;
}

/** Ligne « Évaluée le … · N périmètres » de la dernière évaluation. */
export function ligneEvaluee(f: Pick<Fournisseur, 'current' | 'scopes'>): string {
  const n = f.scopes.length;
  const perimetres = n ? `${n} périmètre${n > 1 ? 's' : ''}` : 'aucun périmètre';
  return f.current ? `Évaluée le ${jourFr(f.current.evaluatedAt)} · ${perimetres}` : `Jamais évaluée · ${perimetres}`;
}

/** Pied de la fiche, onglet « Machines et responsabilités » : auteur et date de la dernière modification de la matrice
    RACI, seule donnée datée et signée rendue pour un fournisseur (le registre historique ne garde pas l'auteur). */
export function ligneModificationRaci(
  m: { misAJourPar: string; misAJourLe: string } | null | undefined,
): string | null {
  if (!m) return null;
  const d = new Date(m.misAJourLe);
  if (Number.isNaN(d.getTime())) return `Matrice RACI modifiée par ${m.misAJourPar}`;
  const local = maintenantLocalParis(d);
  return `Matrice RACI modifiée par ${m.misAJourPar} le ${jourFr(local.slice(0, 10))} à ${local.slice(11, 16)}`;
}

/** Teinte stable de la pastille aux initiales (six teintes du verre), tirée de l'identifiant : décorative seulement. */
export function teinteInitiales(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.codePointAt(0)!) % 9973;
  return h % 6;
}

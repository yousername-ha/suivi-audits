/* Suivi des fournisseurs et applications : états des contrôles périodiques et des certificats, repris à l'identique de
   l'outil de suivi historique (`ctrlState`, `ctrlNext`, `certState`, filtres de « Fournisseurs et applications »).
   Aucune valeur n'est estimée : sans date de contrôle, l'état reste « À réaliser ». Dates au format AAAA-MM-JJ. */
type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Obj[]) : []);

export type NiveauEtat = 'ok' | 'mid' | 'bad' | '';
export type EtatSuivi = [libelle: string, niveau: NiveauEtat];

const parse = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)) : null;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Ajoute des mois comme l'outil historique (`Date.setMonth`, débordement compris). */
export function ajouterMois(date: string, mois: number): string | null {
  const d = parse(date);
  if (!d) return null;
  d.setUTCMonth(d.getUTCMonth() + mois);
  return iso(d);
}

/** Fréquences proposées pour un contrôle (en mois), comme l'outil de suivi. */
export const FREQUENCES_CONTROLE: Record<number, string> = {
  12: 'Annuelle',
  6: 'Semestrielle',
  3: 'Trimestrielle',
  1: 'Mensuelle',
};
export const TYPES_CERTIFICAT = ['ISO 27001', 'HDS', 'SecNumCloud', 'Autre'] as const;

/** Prochaine échéance d'un contrôle : dernier contrôle + fréquence (12 mois par défaut) ; nulle sans dernier contrôle. */
export function prochainControle(c: Obj): string | null {
  return str(c.last) ? ajouterMois(str(c.last), +str(c.freq) || 12) : null;
}
export function etatControle(c: Obj, aujourdhui: string): EtatSuivi {
  const next = prochainControle(c);
  if (!str(c.last)) return ['À réaliser', 'mid'];
  if (next && next < aujourdhui) return ['En retard', 'bad'];
  if (c.result === 'Non conforme') return ['Non conforme', 'bad'];
  return ['À jour', 'ok'];
}
/** Certificats d'un fournisseur : attendus pour un hébergeur HDS ou un fournisseur critique. */
export function etatCertificats(sp: Obj, aujourdhui: string): EtatSuivi {
  const certs = arr(sp.certs).filter((c) => str(c.type));
  const attendu = sp.hds === 'Oui' || sp.critical === 'Oui';
  if (!certs.length) return attendu ? ['À fournir', 'bad'] : ['', ''];
  const dates = certs.map((c) => parse(str(c.validUntil)));
  if (dates.some((d) => !d)) return ['Date à saisir', 'mid'];
  const limite = iso(new Date(parse(aujourdhui)!.getTime() + 90 * 864e5));
  const jours = dates.map((d) => iso(d!));
  if (jours.some((d) => d < aujourdhui)) return ['Expiré', 'bad'];
  if (jours.some((d) => d <= limite)) return ['Expire ≤ 90 j', 'mid'];
  return ['Valide', 'ok'];
}

export interface ResumeControles {
  enRetard: number;
  aRealiser: number;
  nonConformes: number;
  total: number;
  /** Prochaine échéance (la plus proche) parmi les contrôles datés. */
  prochain: string | null;
}
export function resumeControles(sp: Obj, aujourdhui: string): ResumeControles {
  const controles = arr(sp.controls);
  const etats = controles.map((c) => etatControle(c, aujourdhui)[0]);
  const prochains = controles.map(prochainControle).filter((x): x is string => !!x);
  return {
    enRetard: etats.filter((e) => e === 'En retard').length,
    aRealiser: etats.filter((e) => e === 'À réaliser').length,
    nonConformes: etats.filter((e) => e === 'Non conforme').length,
    total: controles.length,
    prochain: prochains.sort()[0] ?? null,
  };
}

export type FiltreFournisseur = 'all' | 'nomfa' | 'ctl' | 'cert' | 'crit';
/** Filtres de la liste « Fournisseurs et applications » de l'outil de suivi. */
export function correspondFiltre(sp: Obj, filtre: FiltreFournisseur, aujourdhui: string): boolean {
  if (filtre === 'nomfa') return sp.mfa !== 'Oui';
  if (filtre === 'ctl')
    return (
      resumeControles(sp, aujourdhui).enRetard +
        resumeControles(sp, aujourdhui).aRealiser +
        resumeControles(sp, aujourdhui).nonConformes >
      0
    );
  if (filtre === 'crit') return sp.critical === 'Oui';
  if (filtre === 'cert') return ['bad', 'mid'].includes(etatCertificats(sp, aujourdhui)[1]);
  return true;
}
/** Part de services SaaS avec MFA / SSO confirmés (en %, arrondi) : indicateurs INDOBJ3.2 et INDOBJ3.3 (cible 90 %). */
export function partSaas(
  suppliers: { saas?: unknown; mfa?: unknown; sso?: unknown }[],
  champ: 'mfa' | 'sso',
): { oui: number; saas: number; pct: number } {
  const saas = suppliers.filter((s) => s.saas);
  const oui = saas.filter((s) => s[champ] === 'Oui').length;
  return { oui, saas: saas.length, pct: saas.length ? Math.round((oui * 100) / saas.length) : 0 };
}

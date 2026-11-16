/* Plusieurs sources (ADR 0100, décisions V23, V26 et V27 ; lot V4c) : présentation sans état ni appel réseau (testée à
   part) de ce que chaque source dit d'une faille. La plateforme a déjà rangé les sources de la première à la dernière et
   retenu la valeur la plus sévère ; l'écran ne recalcule rien, il affiche. Les mentions du CERT Santé sont rendues telles
   quelles (oui, non, non renseignée). */
import {
  type FicheCertSanteDto,
  GRAVITE_TENABLE_LIBELLES,
  type MentionCertSante,
  type PreuveConcept,
  type Signalement,
  SOURCE_EXPLOITABLE_LIBELLES,
  SOURCE_EXPLOITATION_LIBELLES,
  SOURCE_VALEUR_LIBELLES,
  type SourceExploitable,
  type SourceExploitation,
  type SourcesFailleDto,
  type SourceVeille,
  valeursRetenues,
} from '@suivi/shared';
import { dateCourte } from './veille';

/** Libellé d'un signalement : source, et date (JJ/MM/AAAA) quand elle est connue. */
const avecDate = (libelle: string, le: string | null) => (le ? `${libelle} (le ${dateCourte(le)})` : libelle);

/** Sources de l'exploitation avérée, de la première à la dernière, chacune avec sa date ; null s'il n'y en a pas. */
export function resumeExploitation(s: Pick<SourcesFailleDto, 'exploitation'>): string | null {
  if (!s.exploitation.length) return null;
  return s.exploitation.map((x) => avecDate(SOURCE_EXPLOITATION_LIBELLES[x.source], x.le)).join(', ');
}

/** Sources de « exploitable », de la première à la dernière ; null s'il n'y en a pas. */
export function resumeExploitable(s: Pick<SourcesFailleDto, 'exploitable'>): string | null {
  if (!s.exploitable.length) return null;
  return s.exploitable.map((x) => avecDate(SOURCE_EXPLOITABLE_LIBELLES[x.source], x.le)).join(', ');
}

/** Première source et sa date, pour une marque courte dans une liste. */
export function premiere<S extends SourceExploitation | SourceExploitable>(
  liste: readonly Signalement<S>[],
  libelles: Record<S, string>,
): string | null {
  const x = liste[0];
  if (!x) return null;
  return avecDate(`d’abord ${libelles[x.source]}`, x.le);
}

/** Marques d'une faille dans une liste : exploitation avérée et « exploitable », avec la première source et sa date. */
export function marquesSources(
  s: SourcesFailleDto,
): { libelle: string; detail: string; etat: 'erreur' | 'attention' }[] {
  const out: { libelle: string; detail: string; etat: 'erreur' | 'attention' }[] = [];
  if (s.exploitation.length)
    out.push({
      libelle: `Exploitation avérée (${s.exploitation.length} source${s.exploitation.length > 1 ? 's' : ''})`,
      detail: premiere(s.exploitation, SOURCE_EXPLOITATION_LIBELLES)!,
      etat: 'erreur',
    });
  if (s.exploitable.length)
    out.push({
      libelle: 'Exploitable',
      detail: premiere(s.exploitable, SOURCE_EXPLOITABLE_LIBELLES)!,
      etat: 'attention',
    });
  return out;
}

const pourcent = (x: number) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

/** Valeurs par source, en lignes : fait, source, valeur, et la valeur retenue pour la priorité (la plus sévère, V27). */
export function lignesValeurs(
  s: SourcesFailleDto,
): { fait: string; source: string; valeur: string; retenue: boolean }[] {
  const r = valeursRetenues(s.valeurs);
  return [
    ...s.valeurs.gravites.map((x) => ({
      fait: 'Gravité',
      source: SOURCE_VALEUR_LIBELLES[x.source],
      valeur: GRAVITE_TENABLE_LIBELLES[x.gravite],
      retenue: r.gravite?.source === x.source,
    })),
    ...s.valeurs.cvss.map((x) => ({
      fait: 'Score CVSS',
      source: SOURCE_VALEUR_LIBELLES[x.source],
      valeur: x.score.toLocaleString('fr-FR'),
      retenue: r.cvss?.source === x.source,
    })),
    ...s.valeurs.epss.map((x) => ({
      fait: 'Score EPSS',
      source: SOURCE_VALEUR_LIBELLES[x.source],
      valeur: pourcent(x.score),
      retenue: r.epss?.source === x.source,
    })),
  ];
}

/** Mention de la fiche du CERT Santé, telle quelle. */
export const libelleMention = (m: MentionCertSante | null) =>
  m === 'oui' ? 'Oui' : m === 'non' ? 'Non' : 'Non renseignée';
export const libellePreuve = (p: PreuveConcept | null) =>
  p === 'disponible' ? 'Disponible' : p === 'indisponible' ? 'Aucune en sources ouvertes' : 'Non renseignée';

/** Mentions d'une fiche du CERT Santé, dans l'ordre de la fiche. */
export function mentionsFiche(f: FicheCertSanteDto): { libelle: string; valeur: string }[] {
  return [
    { libelle: 'Activement exploitée', valeur: libelleMention(f.exploitee) },
    { libelle: 'Un correctif existe', valeur: libelleMention(f.correctif) },
    { libelle: 'Une mesure de contournement existe', valeur: libelleMention(f.contournement) },
    { libelle: 'Preuve de concept', valeur: libellePreuve(f.preuveConcept) },
    { libelle: 'Score CVSS v3.1', valeur: f.cvss31 === null ? 'Non renseigné' : f.cvss31.toLocaleString('fr-FR') },
  ];
}

const LIBELLES_PUBLICATION: Record<Exclude<SourceVeille, 'epss'>, string> = {
  nvd: 'NVD',
  'cisa-kev': 'catalogue KEV',
  'cert-fr': 'CERT-FR',
  'cert-sante': 'CERT Santé',
};
/** Sources qui ont publié une CVE, de la première à la dernière (V26), avec leur date. */
export function resumePublications(liste: readonly Signalement<Exclude<SourceVeille, 'epss'>>[]): string {
  if (!liste.length) return 'Aucune publication rangée';
  return liste.map((x) => avecDate(LIBELLES_PUBLICATION[x.source], x.le)).join(', ');
}

/** État de la lecture des fiches du CERT Santé (écran « Veille »). */
export function resumeFichesCertSante(f: { lues: number; aLire: number; relectureJours: number }): string {
  const lues = `${f.lues} fiche${f.lues > 1 ? 's' : ''} lue${f.lues > 1 ? 's' : ''}`;
  const reste = f.aLire
    ? `${f.aLire} à lire (nouvelles, modifiées ou lues il y a plus de ${f.relectureJours} jours)`
    : 'aucune à lire';
  return `${lues}, ${reste}.`;
}

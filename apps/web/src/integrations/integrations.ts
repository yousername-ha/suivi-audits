/* Module Intégrations (ADR 0076), socle des connecteurs réseau : présentation et formulaires, sans état ni appel réseau
   (testés à part). Le serveur reste seul juge des droits, de la configuration, des secrets et du flux. */
import {
  ETAT_EXECUTION_LIBELLES,
  erreurAdresse,
  OPERATION_LIBELLES,
  type EtatIntegrationsDto,
  type ExecutionIntegrationDto,
  type IntegrationDto,
  type TypeIntegrationDto,
} from '@suivi/shared';
import type { Etat } from '@suivi/ui';

export const LIEN_INTEGRATIONS = '/integrations';

/** État affiché d'une instance (tuile) : non configurée (secret manquant), inactive, flux fermé, en échec, active. */
export type EtatTuile = 'non_configuree' | 'inactive' | 'flux_ferme' | 'echec' | 'active';
export const ETAT_TUILE: Record<EtatTuile, { libelle: string; etat: Etat }> = {
  non_configuree: { libelle: 'Non configurée', etat: 'neutre' },
  inactive: { libelle: 'Inactive', etat: 'neutre' },
  flux_ferme: { libelle: 'Flux fermé', etat: 'attention' },
  echec: { libelle: 'En échec', etat: 'erreur' },
  active: { libelle: 'Active', etat: 'succes' },
};

export function etatTuile(i: Pick<IntegrationDto, 'actif' | 'secrets' | 'derniereExecution'>, fluxOuvert: boolean) {
  if (!Object.values(i.secrets).every(Boolean)) return 'non_configuree' as const;
  if (!i.actif) return 'inactive' as const;
  if (!fluxOuvert) return 'flux_ferme' as const;
  const e = i.derniereExecution?.etat;
  if (e === 'echec' || e === 'expire') return 'echec' as const;
  return 'active' as const;
}

/** « défini » / « non défini », sans jamais la valeur (le serveur ne la renvoie pas). */
export const libelleSecret = (defini: boolean) => (defini ? 'Défini' : 'Non défini');

export const ETAT_EXECUTION: Record<ExecutionIntegrationDto['etat'], Etat> = {
  en_file: 'info',
  en_cours: 'info',
  recu: 'succes',
  echec: 'erreur',
  expire: 'attention',
};
export const libelleEtatExecution = (e: ExecutionIntegrationDto['etat']) => ETAT_EXECUTION_LIBELLES[e];
export const libelleOperation = (o: ExecutionIntegrationDto['operation']) => OPERATION_LIBELLES[o];
export const executionEnCours = (e: Pick<ExecutionIntegrationDto, 'etat'> | null | undefined) =>
  e?.etat === 'en_file' || e?.etat === 'en_cours';

/** Résultat lisible d'une exécution terminée : version rendue par « Tester la connexion », ou l'erreur courte. */
export function resumeExecution(e: Pick<ExecutionIntegrationDto, 'etat' | 'resultat' | 'erreur'>): string {
  if (e.etat === 'recu') {
    const v = e.resultat?.version;
    return typeof v === 'string' ? `Connexion établie : version ${v}.` : 'Résultat reçu.';
  }
  if (e.etat === 'en_file') return 'En attente de l’exécutant d’exploitation (en général moins d’une minute).';
  if (e.etat === 'en_cours') return 'Appel en cours…';
  return e.erreur ?? 'Échec sans détail.';
}

/** Message affiché quand l'exécutant n'est pas vu : sans lui, aucun appel réseau n'est possible. */
export function messageExecutant(e: EtatIntegrationsDto['executant']): string | null {
  if (e.disponible) return null;
  return e.vuLe
    ? 'L’exécutant d’exploitation du serveur ne s’est pas signalé depuis plus de deux minutes : aucun connecteur ne peut interroger un outil externe tant qu’il n’est pas revenu (guide d’installation, étape 11.6).'
    : 'L’exécutant d’exploitation du serveur n’a jamais été vu : c’est lui qui interroge les outils externes. Installez-le (guide d’installation, étape 11.6).';
}

/** Flux du type d'une instance, d'après l'état rendu par l'API (fermé si inconnu). */
export const fluxOuvertPour = (etat: EtatIntegrationsDto | undefined, type: IntegrationDto['type']) =>
  etat?.flux.find((f) => f.type === type)?.ouvert === true;

/* ------------------------------------------------------------------ Formulaire de configuration (Tenable) */
export interface FormulaireConfiguration {
  nom: string;
  adresse: string;
  autoriteCertification: string;
  delaiSecondes: number;
}

export function formulaireDepuis(i: IntegrationDto | null, t: TypeIntegrationDto): FormulaireConfiguration {
  const c = i?.configuration ?? {};
  return {
    nom: i?.nom ?? t.libelle,
    adresse: typeof c.adresse === 'string' ? c.adresse : '',
    autoriteCertification: typeof c.autoriteCertification === 'string' ? c.autoriteCertification : '',
    delaiSecondes: typeof c.delaiSecondes === 'number' ? c.delaiSecondes : 30,
  };
}

/** Erreurs à corriger avant l'envoi (le serveur refait chaque contrôle). */
export function erreursFormulaire(f: FormulaireConfiguration): string[] {
  const r: string[] = [];
  if (!f.nom.trim()) r.push('Nom obligatoire.');
  const a = erreurAdresse(f.adresse);
  if (a) r.push(a);
  return r;
}

export const configurationDepuis = (f: FormulaireConfiguration) => ({
  adresse: f.adresse.trim(),
  autoriteCertification: f.autoriteCertification,
  delaiSecondes: f.delaiSecondes,
});

export const corpsCreation = (t: TypeIntegrationDto, f: FormulaireConfiguration) => ({
  type: t.id,
  nom: f.nom.trim(),
  configuration: configurationDepuis(f),
});

/** Modification : seuls le nom et la configuration changés sont envoyés. */
export function corpsModification(i: IntegrationDto, f: FormulaireConfiguration) {
  const out: { nom?: string; configuration?: ReturnType<typeof configurationDepuis> } = {};
  if (f.nom.trim() !== i.nom) out.nom = f.nom.trim();
  const c = configurationDepuis(f);
  const avant = formulaireDepuis(i, { libelle: i.nom } as TypeIntegrationDto);
  if (
    c.adresse.replace(/\/$/, '').toLowerCase() !== avant.adresse ||
    c.autoriteCertification !== avant.autoriteCertification ||
    c.delaiSecondes !== avant.delaiSecondes
  )
    out.configuration = c;
  return out;
}

/** Changer l'adresse ou l'autorité de certification supprime les clés enregistrées (règle du serveur, annoncée ici). */
export function destinationChangee(i: IntegrationDto, f: FormulaireConfiguration): boolean {
  const avant = formulaireDepuis(i, { libelle: i.nom } as TypeIntegrationDto);
  return (
    f.adresse.trim().replace(/\/$/, '').toLowerCase() !== avant.adresse ||
    f.autoriteCertification !== avant.autoriteCertification
  );
}

/* Module Intégrations (ADR 0076), socle des connecteurs réseau : présentation et formulaires, sans état ni appel réseau
   (testés à part). Le serveur reste seul juge des droits, de la configuration, des secrets et du flux. */
import {
  CHAMPS_CONFIGURATION,
  type ChampConfiguration,
  ETAT_EXECUTION_LIBELLES,
  erreurAdresse,
  erreurAdresseAlh,
  GRAVITES_PAR_DEFAUT,
  GRAVITES_TENABLE,
  GRAVITE_TENABLE_LIBELLES,
  type GraviteTenable,
  OPERATION_LIBELLES,
  portAdresse,
  type EtatIntegrationsDto,
  type ExecutionIntegrationDto,
  type IntegrationDto,
  type TypeIntegrationDto,
} from '@suivi/shared';
import type { Etat } from '@suivi/ui';
import { resumeBilanAlh } from '../vulnerabilites/surface';

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

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Bilan lisible d'une synchronisation (nombres seulement) : constats, machines, détections, borne atteinte, inventaire. */
export function resumeSynchronisation(r: Record<string, unknown>): string {
  const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : 0);
  const inventaire = r.inventaire as { ok?: boolean; erreur?: string | null } | undefined;
  return [
    `Synchronisation reçue : ${pluriel(n('constats'), 'faille', 'failles')} sur ${pluriel(n('machines'), 'machine', 'machines')} (${pluriel(n('detections'), 'détection', 'détections')}).`,
    r.tronque === true
      ? 'Incomplète : une borne a été atteinte (pages, détections ou durée) ; aucune faille n’est marquée disparue.'
      : '',
    inventaire?.ok === false
      ? `Inventaire des machines (expérimental) indisponible : ${inventaire.erreur ?? 'sans détail'}`
      : `Inventaire : ${pluriel(n('hotes'), 'machine lue', 'machines lues')}.`,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Résultat lisible d'une exécution terminée : version rendue par « Tester la connexion », bilan d'une synchronisation, ou
    l'erreur courte. */
export function resumeExecution(e: Pick<ExecutionIntegrationDto, 'etat' | 'resultat' | 'erreur'>): string {
  if (e.etat === 'recu') {
    const v = e.resultat?.version;
    if (typeof v === 'string') return `Connexion établie : version ${v}.`;
    if (e.resultat && typeof e.resultat.constats === 'number') return resumeSynchronisation(e.resultat);
    if (e.resultat && typeof e.resultat.alertes === 'number') return resumeBilanAlh(e.resultat);
    return 'Résultat reçu.';
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

/* ------------------------------------------------------------------ Formulaire de configuration */
/** Le formulaire porte tous les champs connus ; seuls ceux du type (catalogue, `champs`) sont affichés, contrôlés et
    envoyés. Sans type précisé : tous (Tenable). */
type TypeChamps = Pick<TypeIntegrationDto, 'id' | 'champs'> | undefined;
const champsDe = (t: TypeChamps): readonly ChampConfiguration[] => t?.champs ?? CHAMPS_CONFIGURATION;
export interface FormulaireConfiguration {
  nom: string;
  adresse: string;
  autoriteCertification: string;
  delaiSecondes: number;
  /** Gravités lues par « Synchroniser » (critiques et élevées par défaut). */
  gravites: GraviteTenable[];
}

export const OPTIONS_GRAVITES = GRAVITES_TENABLE.map((g) => ({ value: g, label: GRAVITE_TENABLE_LIBELLES[g] }));
const gravitesDe = (v: unknown): GraviteTenable[] =>
  Array.isArray(v) ? GRAVITES_TENABLE.filter((g) => v.includes(g)) : [...GRAVITES_PAR_DEFAUT];
export const libelleGravites = (v: unknown) =>
  gravitesDe(v)
    .map((g) => GRAVITE_TENABLE_LIBELLES[g])
    .join(', ');

/** Port effectivement réglé d'une instance, pour la validation du flux (443 sans port explicite). */
export const precisionPort = (i: Pick<IntegrationDto, 'nom' | 'configuration'>) =>
  `Port réglé pour « ${i.nom} » : TCP ${portAdresse(typeof i.configuration.adresse === 'string' ? i.configuration.adresse : '')}.`;

export function formulaireDepuis(i: IntegrationDto | null, t: TypeIntegrationDto): FormulaireConfiguration {
  const c = i?.configuration ?? {};
  return {
    nom: i?.nom ?? t.libelle,
    adresse: typeof c.adresse === 'string' ? c.adresse : '',
    autoriteCertification: typeof c.autoriteCertification === 'string' ? c.autoriteCertification : '',
    delaiSecondes: typeof c.delaiSecondes === 'number' ? c.delaiSecondes : 30,
    gravites: gravitesDe(c.gravites),
  };
}

/** Erreurs à corriger avant l'envoi (le serveur refait chaque contrôle). AlgoLightHouse : adresse de l'espace chez
    l'éditeur seulement. */
export function erreursFormulaire(f: FormulaireConfiguration, t?: TypeChamps): string[] {
  const r: string[] = [];
  if (!f.nom.trim()) r.push('Nom obligatoire.');
  const a = t?.id === 'algolighthouse' ? erreurAdresseAlh(f.adresse) : erreurAdresse(f.adresse);
  if (a) r.push(a);
  if (champsDe(t).includes('gravites') && !f.gravites.length) r.push('Choisissez au moins une gravité à synchroniser.');
  return r;
}

/** Configuration envoyée : les seuls champs du type. */
export function configurationDepuis(f: FormulaireConfiguration, t?: TypeChamps) {
  const champs = champsDe(t);
  const c: {
    adresse: string;
    autoriteCertification?: string;
    delaiSecondes?: number;
    gravites?: GraviteTenable[];
  } = { adresse: f.adresse.trim() };
  if (champs.includes('autoriteCertification')) c.autoriteCertification = f.autoriteCertification;
  if (champs.includes('delaiSecondes')) c.delaiSecondes = f.delaiSecondes;
  if (champs.includes('gravites')) c.gravites = GRAVITES_TENABLE.filter((g) => f.gravites.includes(g));
  return c;
}

export const corpsCreation = (t: TypeIntegrationDto, f: FormulaireConfiguration) => ({
  type: t.id,
  nom: f.nom.trim(),
  configuration: configurationDepuis(f, t),
});

/** Modification : seuls le nom et la configuration changés sont envoyés. */
export function corpsModification(i: IntegrationDto, f: FormulaireConfiguration, t?: TypeChamps) {
  const out: { nom?: string; configuration?: ReturnType<typeof configurationDepuis> } = {};
  if (f.nom.trim() !== i.nom) out.nom = f.nom.trim();
  const c = configurationDepuis(f, t);
  const avant = formulaireDepuis(i, { libelle: i.nom } as TypeIntegrationDto);
  if (
    c.adresse.replace(/\/$/, '').toLowerCase() !== avant.adresse ||
    (c.autoriteCertification !== undefined && c.autoriteCertification !== avant.autoriteCertification) ||
    (c.delaiSecondes !== undefined && c.delaiSecondes !== avant.delaiSecondes) ||
    (c.gravites !== undefined && c.gravites.join() !== avant.gravites.join())
  )
    out.configuration = c;
  return out;
}

/** Changer l'adresse (port compris) ou l'autorité de certification supprime les clés enregistrées (règle du serveur,
    annoncée ici). */
export function destinationChangee(i: IntegrationDto, f: FormulaireConfiguration): boolean {
  const avant = formulaireDepuis(i, { libelle: i.nom } as TypeIntegrationDto);
  return (
    f.adresse.trim().replace(/\/$/, '').toLowerCase() !== avant.adresse ||
    f.autoriteCertification !== avant.autoriteCertification
  );
}

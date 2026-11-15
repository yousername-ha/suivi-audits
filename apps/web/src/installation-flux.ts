/* Étape « Flux vers l'extérieur » de l'assistant d'installation (ADR 0097, point 5 et lot 3) : pour chaque module du registre,
   « Activer » ou « Plus tard » ; l'étape entière peut se passer d'un coup. Elle est proposée une seule fois, à la première
   connexion complète du compte administrateur créé par l'installation (droit administration:administrer, second facteur
   enrôlé), pour que chaque ouverture passe par les mêmes routes, droits, validation et journal que les gestes du lot 1.
   Règles sans dépendance à React (testées seules) :
   - « Plus tard » ne fait aucun appel : le flux reste fermé ;
   - « Activer » exige la case de validation (destinations, ports, données qui sortent) avant tout appel ;
   - antivirus et mises à jour, dont l'activation est le flux lui-même, s'ouvrent par la route commune ;
   - l'assistant s'active par sa route de réglages avec le fournisseur choisi (adresse et modèle, exigés pour l'activer) ; sa
     clé et ses profils se règlent ensuite dans sa page : tant qu'aucune clé n'est enregistrée, rien ne sort ;
   - courriel et certificat ACME ne s'ouvrent pas depuis l'installation : sans serveur SMTP réglé (ou sans nom public et
     ports joignables pour ACME), leur activation n'aurait pas de sens. « Activer » renvoie à leur page, où le geste
     d'activation demande la même validation. */
import { fluxExterne, type FluxExterneDefinition, type FluxModule } from '@suivi/shared';

export const LIEN_QUESTIONS_FLUX = '/installation/flux-externes';

export type ChoixFlux = 'activer' | 'plus-tard';
/** « direct » : ouvert depuis l'étape, après validation ; « page » : activé dans la page du module (ses réglages d'abord). */
export type ModeInstallation = 'direct' | 'page';

/** Mode d'activation d'un module depuis l'étape. L'assistant s'active directement si la personne peut régler l'assistant
    (assistant:administrer, module activé) ; sinon, comme le courriel et ACME, depuis sa page. */
export function modeInstallation(f: Pick<FluxExterneDefinition, 'id' | 'activation'>, peutAssistant: boolean) {
  if (f.activation.par === 'flux') return 'direct' as const;
  return f.id === 'assistant' && peutAssistant ? ('direct' as const) : ('page' as const);
}

export interface SaisieQuestions {
  choix: Partial<Record<FluxModule, ChoixFlux>>;
  /** Case de validation cochée, par module. */
  valides: Partial<Record<FluxModule, boolean>>;
  /** Fournisseur de l'assistant (adresse HTTPS et modèle), exigé pour l'activer. */
  fournisseur: { adresse: string; modele: string };
}

export const SAISIE_VIDE: SaisieQuestions = { choix: {}, valides: {}, fournisseur: { adresse: '', modele: '' } };

/** Modules à ouvrir en terminant l'étape : choisis « Activer », ouvrables depuis l'étape, validés, pas déjà ouverts. Un
    module laissé « Plus tard » (ou sans choix) n'y figure jamais. */
export function ouvertures(
  modules: readonly FluxModule[],
  saisie: SaisieQuestions,
  mode: (m: FluxModule) => ModeInstallation,
  ouvert: (m: FluxModule) => boolean,
): FluxModule[] {
  return modules.filter(
    (m) => saisie.choix[m] === 'activer' && mode(m) === 'direct' && !ouvert(m) && saisie.valides[m] === true,
  );
}

/** Ce qui manque avant de terminer : un module choisi « Activer » et ouvrable depuis l'étape sans sa case cochée, ou
    l'assistant sans adresse ni modèle. Liste vide : « Terminer » est possible. */
export function manques(
  modules: readonly FluxModule[],
  saisie: SaisieQuestions,
  mode: (m: FluxModule) => ModeInstallation,
  ouvert: (m: FluxModule) => boolean,
): string[] {
  const r: string[] = [];
  for (const m of modules) {
    if (saisie.choix[m] !== 'activer' || mode(m) !== 'direct' || ouvert(m)) continue;
    const f = fluxExterne(m);
    if (saisie.valides[m] !== true) r.push(`${f.libelle} : cochez la case de validation, ou choisissez Plus tard.`);
    if (m === 'assistant' && (!saisie.fournisseur.adresse.trim() || !saisie.fournisseur.modele.trim()))
      r.push(`${f.libelle} : indiquez l’adresse du service de modèle et le nom du modèle.`);
  }
  return r;
}

/** Appel d'ouverture d'un module dont l'activation est le flux lui-même : la route commune, confirmation jointe. */
export function appelOuverture(m: FluxModule): { url: string; corps: { ouvert: true; confirmation: true } } {
  if (fluxExterne(m).activation.par !== 'flux') throw new Error(`Le flux « ${m} » s’ouvre par le geste de son module.`);
  return { url: `/api/admin/flux-externes/${m}`, corps: { ouvert: true, confirmation: true } };
}

/** Ce qui reste à régler dans la page de chaque module après l'étape : modules « page » choisis « Activer », et l'assistant
    activé depuis l'étape (clé et profils). */
export function aReglerEnsuite(
  modules: readonly FluxModule[],
  saisie: SaisieQuestions,
  mode: (m: FluxModule) => ModeInstallation,
  ouvertsParEtape: readonly FluxModule[],
): { module: FluxModule; libelle: string; lien: string; quoi: string }[] {
  return modules.flatMap((m) => {
    const f = fluxExterne(m);
    const base = { module: m, libelle: f.libelle, lien: f.reglage.lien };
    if (saisie.choix[m] === 'activer' && mode(m) === 'page')
      return [
        { ...base, quoi: `${f.reglage.libelle} : régler le module, puis ${f.activation.geste} (validation demandée).` },
      ];
    if (m === 'assistant' && ouvertsParEtape.includes(m))
      return [
        {
          ...base,
          quoi: `${f.reglage.libelle} : enregistrer la clé du fournisseur et vérifier les profils ; tant qu’aucune clé n’est enregistrée, rien ne sort.`,
        },
      ];
    return [];
  });
}

/** Après une connexion complète : l'étape si elle reste à proposer, sinon la page demandée. */
export const destinationApresConnexion = (next: string, aProposer: boolean): string =>
  aProposer ? `${LIEN_QUESTIONS_FLUX}?next=${encodeURIComponent(next)}` : next;

/** Adresse de retour sûre (chemin interne seulement). */
export const retourSur = (n: string | null): string => (n && /^\/(?!\/)/.test(n) ? n : '/');

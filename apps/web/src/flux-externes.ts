/* Flux vers l'extérieur (ADR 0097) : libellés et règles d'affichage de la page d'administration, sans dépendance à React
   (testés seuls). Le registre (destinations, porteur, données qui sortent) vient de @suivi/shared. */
import { sensDuFlux, type FluxExterneDefinition, type FluxExterneEtat } from '@suivi/shared';

/** Adresse de la carte qui ouvre et ferme les flux. */
export const LIEN_FLUX_EXTERNES = '/systeme/flux-externes';

export const libelleSens = (f: Pick<FluxExterneDefinition, 'destinations'>): string => {
  const s = sensDuFlux(f);
  return s.length === 2 ? 'Sortant et entrant' : s[0] === 'entrant' ? 'Entrant' : 'Sortant';
};

export type Ton = 'vert' | 'gris' | 'rouge' | 'orange';

/** État appliqué, tel que l'exécutant l'a rapporté, comparé à l'état voulu. */
export function etatApplique(e: Pick<FluxExterneEtat, 'ouvert' | 'applique'>): { libelle: string; ton: Ton } {
  if (e.applique === 'erreur') return { libelle: 'Erreur', ton: 'rouge' };
  if (e.applique === null)
    return e.ouvert
      ? { libelle: 'En attente de l’exécutant', ton: 'orange' }
      : { libelle: 'Non rapporté', ton: 'gris' };
  const ouvert = e.applique === 'ouvert';
  if (ouvert !== e.ouvert)
    return { libelle: e.ouvert ? 'Ouverture en attente' : 'Fermeture en attente', ton: 'orange' };
  return ouvert ? { libelle: 'Ouvert', ton: 'vert' } : { libelle: 'Fermé', ton: 'gris' };
}

/** Ouvrir exige la case de validation cochée ; fermer se confirme sans case. Rien pendant un envoi. */
export const peutConfirmer = (ouvrir: boolean, valide: boolean, envoi: boolean): boolean =>
  !envoi && (!ouvrir || valide);

/** Flux à faire autoriser sur le pare-feu de l'hôte et du réseau : ceux des modules voulus ouverts. */
export function pareFeuAOuvrir(
  registre: readonly FluxExterneDefinition[],
  etats: readonly Pick<FluxExterneEtat, 'module' | 'ouvert'>[],
): { libelle: string; regles: readonly string[] }[] {
  const ouverts = new Set(etats.filter((e) => e.ouvert).map((e) => e.module));
  return registre.filter((f) => ouverts.has(f.id)).map((f) => ({ libelle: f.libelle, regles: f.pareFeu }));
}

/* ------------------------------------------------------------------ Garde-fou HSTS (précision du RSSI du 16/11/2026) */
/** Le site envoie toujours l'en-tête HSTS (un an, docker/Caddyfile*) : un navigateur qui l'a ouvert par son nom avec un
    certificat public refuse ensuite le certificat de l'autorité interne, sans possibilité de passer outre. Quitter ACME
    n'est pas bloqué ; la confirmation le dit clairement, avec le recours (l'adresse IP du serveur). */
export const AVERTISSEMENT_HSTS =
  'Le site repassera sur le certificat de l’autorité interne du serveur. Comme il envoie l’en-tête HSTS (valable un an), les navigateurs qui l’ont déjà ouvert par son nom de domaine refuseront ce certificat : le site risque de devenir inaccessible par son nom de domaine. Il reste joignable par l’adresse IP du serveur (https://adresse-ip-du-serveur), le temps de revenir à un certificat public.';

/** Variante du certificat fourni : le flux ACME est refermé, le certificat installé doit être reconnu pour ce nom. */
export const AVERTISSEMENT_HSTS_FOURNI =
  'Le flux « Certificat public ACME » sera refermé. Comme le site envoie l’en-tête HSTS (valable un an), le certificat fourni doit être reconnu par les navigateurs pour ce nom de domaine : sinon, le site devient inaccessible par son nom. Il reste joignable par l’adresse IP du serveur (https://adresse-ip-du-serveur).';

/** Texte de la confirmation de fermeture depuis le résumé ; fermer « acme » ramène la passerelle à l'autorité interne. */
export function texteFermeture(f: Pick<FluxExterneDefinition, 'id' | 'siFerme' | 'reglage'>): string {
  const base = `Plus aucun échange de ce module avec l’extérieur : ${f.siFerme.charAt(0).toLowerCase()}${f.siFerme.slice(1)} Pour le rouvrir, réactivez le module dans sa page (${f.reglage.libelle}).`;
  return f.id === 'acme' ? `${base} ${AVERTISSEMENT_HSTS}` : base;
}

/** Confirmation d'un changement de mode depuis la page Certificats. « quitteAcme » : la passerelle est en ACME, ou le flux
    « acme » est ouvert. */
export function messageChangementCertificat(
  geste: 'tls_internal' | 'tls_install' | 'tls_reset',
  quitteAcme: boolean,
): string {
  const base = {
    tls_internal:
      'Utiliser le certificat de l’autorité interne ? Le frontal est redémarré, contrôlé, puis la configuration précédente est rétablie en cas d’échec.',
    tls_install:
      'Remplacer le certificat TLS ? Le serveur contrôlera la clé, l’hôte, la validité et la santé. La configuration précédente sera rétablie en cas d’échec.',
    tls_reset:
      'Revenir au réglage de départ du serveur (CADDY_TLS dans .env) ? Le mode choisi ici sera désactivé après validation du frontal.',
  }[geste];
  if (!quitteAcme) return base;
  if (geste === 'tls_install') return `${base} ${AVERTISSEMENT_HSTS_FOURNI}`;
  if (geste === 'tls_reset')
    return `${base} Si ce réglage de départ est l’autorité interne (CADDY_TLS=internal) : ${AVERTISSEMENT_HSTS.charAt(0).toLowerCase()}${AVERTISSEMENT_HSTS.slice(1)}`;
  return `${base} ${AVERTISSEMENT_HSTS}`;
}

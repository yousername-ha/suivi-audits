/* Connexion unique SAML (ADR 0114) : règles sans React de la page de connexion (boutons, message après un refus), de la
   carte d'administration (formulaire d'un fournisseur, valeurs par défaut par type, validation du flux, état des
   métadonnées) et du formulaire des comptes (champs de connexion envoyés). */
import {
  CODES_ECHEC_SSO,
  MESSAGES_ECHEC_SSO,
  MFA_PAR_DEFAUT,
  SSO_BORNES,
  destinationMetadonnees,
  type CodeEchecSso,
  type FournisseurSsoBody,
  type FournisseurSsoOut,
  type ModeConnexion,
  type Rapprochement,
  type SourceMfa,
  type SsoType,
  type UserOut,
} from '@suivi/shared';

/** Adresse du départ vers le fournisseur (navigation de la page entière : le serveur redirige vers lui). */
export const lienConnexionSso = (id: string, retour: string) =>
  `/api/auth/sso/${encodeURIComponent(id)}/connexion?retour=${encodeURIComponent(retour)}`;

/** Message de la page de connexion après un refus (paramètre « sso ») ; un code inconnu n'affiche rien. */
export function messageEchecSso(code: string | null): string | null {
  return code && (CODES_ECHEC_SSO as readonly string[]).includes(code)
    ? MESSAGES_ECHEC_SSO[code as CodeEchecSso]
    : null;
}

export interface FormulaireFournisseur {
  type: SsoType;
  libelle: string;
  actif: boolean;
  entityId: string;
  urlMetadonnees: string;
  autoriteTls: string;
  mfaSource: SourceMfa;
  mfaAttribut: string;
  /** Une valeur par ligne. */
  mfaValeurs: string;
  rapprochement: Rapprochement;
  rapprochementAttribut: string;
}

/** Valeurs par défaut d'un nouveau fournisseur, ou celles d'un fournisseur existant. */
export function formulaireDepuis(f: FournisseurSsoOut | null, type: SsoType = 'entra'): FormulaireFournisseur {
  if (f)
    return {
      type: f.type,
      libelle: f.libelle,
      actif: f.actif,
      entityId: f.entityId,
      urlMetadonnees: f.urlMetadonnees ?? '',
      autoriteTls: f.autoriteTls ?? '',
      mfaSource: f.mfaSource,
      mfaAttribut: f.mfaAttribut,
      mfaValeurs: f.mfaValeurs.join('\n'),
      rapprochement: f.rapprochement,
      rapprochementAttribut: f.rapprochementAttribut,
    };
  const d = MFA_PAR_DEFAUT[type];
  return {
    type,
    libelle: type === 'entra' ? 'Microsoft Entra ID' : type === 'keycloak' ? 'Keycloak' : '',
    actif: true,
    entityId: '',
    urlMetadonnees: '',
    autoriteTls: '',
    mfaSource: d.source,
    mfaAttribut: d.attribut,
    mfaValeurs: d.valeurs.join('\n'),
    rapprochement: 'nameid',
    rapprochementAttribut: '',
  };
}

/** Changement de type : la preuve de double authentification reprend les valeurs par défaut du nouveau type. */
export function changerType(f: FormulaireFournisseur, type: SsoType): FormulaireFournisseur {
  const d = MFA_PAR_DEFAUT[type];
  return {
    ...f,
    type,
    mfaSource: d.source,
    mfaAttribut: d.attribut,
    mfaValeurs: d.valeurs.join('\n'),
    autoriteTls: type === 'entra' ? '' : f.autoriteTls,
  };
}

/** Corps de la requête (sans la validation du flux). */
export function corpsFournisseur(f: FormulaireFournisseur): Omit<FournisseurSsoBody, 'fluxConfirme'> {
  const valeurs = f.mfaValeurs
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, SSO_BORNES.valeursMfa);
  return {
    type: f.type,
    libelle: f.libelle.trim(),
    actif: f.actif,
    entityId: f.entityId.trim(),
    urlMetadonnees: f.urlMetadonnees.trim() || null,
    autoriteTls: f.type === 'entra' ? null : f.autoriteTls.trim() || null,
    mfaSource: f.mfaSource,
    mfaAttribut: f.mfaSource === 'attribut' ? f.mfaAttribut.trim() : '',
    mfaValeurs: valeurs,
    rapprochement: f.rapprochement,
    rapprochementAttribut: f.rapprochement === 'attribut' ? f.rapprochementAttribut.trim() : '',
  };
}

/** Une adresse de métadonnées nouvelle ou changée ouvre le flux « sso-saml » vers son hôte : validation explicite. */
export const validationFluxRequise = (avant: string | null, apres: string | null) => !!apres && apres !== avant;

/** Précision montrée dans la fenêtre de validation : l'hôte réellement joint. */
export const precisionDestination = (url: string) => {
  const d = destinationMetadonnees(url);
  return d ? `Hôte joint par la lecture automatique : ${d} (HTTPS).` : undefined;
};

/** Jours avant l'expiration (arrondis vers le bas), ou null. */
export function joursAvant(iso: string | null, maintenant = Date.now()): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - maintenant) / 86400e3);
}

/** État des métadonnées, en une phrase. */
export function etatMetadonnees(f: FournisseurSsoOut): { texte: string; couleur: 'green' | 'orange' | 'red' | 'gray' } {
  if (f.metadonnees.erreur && !f.pret)
    return { texte: `Métadonnées refusées : ${f.metadonnees.erreur}`, couleur: 'red' };
  if (!f.pret)
    return {
      texte: f.urlMetadonnees
        ? 'Métadonnées pas encore lues : l’exécutant les lit à son prochain passage (flux ouvert).'
        : 'Aucune métadonnée : importez le fichier XML du fournisseur.',
      couleur: 'gray',
    };
  const j = joursAvant(f.certificatExpireLe);
  if (j !== null && j < SSO_BORNES.preavisExpirationJours)
    return {
      texte: `Certificat du fournisseur expiré ou proche de l’expiration (${Math.max(j, 0)} j).`,
      couleur: 'red',
    };
  if (f.metadonnees.erreur)
    return {
      texte: `Dernière relecture en échec (configuration conservée) : ${f.metadonnees.erreur}`,
      couleur: 'orange',
    };
  return {
    texte: `Métadonnées ${f.metadonnees.source === 'url' ? 'lues automatiquement' : 'importées'}${f.metadonnees.signees ? ', signature vérifiée' : ''}.`,
    couleur: 'green',
  };
}

/** Champs de connexion d'un compte à envoyer : rien pour un compte local qui le reste ; le mode et, en connexion unique,
    le fournisseur et l'identifiant attendu sinon (rien non plus s'ils sont inchangés). */
export function champsConnexion(
  f: { modeConnexion: ModeConnexion; fournisseurId: string; identifiantExterne: string },
  user: Pick<UserOut, 'mode_connexion' | 'sso_fournisseur_id' | 'sso_identifiant'> | null,
): { modeConnexion?: ModeConnexion; fournisseurId?: string; identifiantExterne?: string } {
  if (f.modeConnexion === 'local') return user && user.mode_connexion === 'sso' ? { modeConnexion: 'local' } : {};
  if (
    user &&
    user.mode_connexion === 'sso' &&
    user.sso_fournisseur_id === f.fournisseurId &&
    user.sso_identifiant === f.identifiantExterne.trim()
  )
    return {};
  return { modeConnexion: 'sso', fournisseurId: f.fournisseurId, identifiantExterne: f.identifiantExterne.trim() };
}

/* Connexion unique SAML (ADR 0114) : valeurs par défaut de la preuve de double authentification par type, adresse des
   métadonnées (HTTPS, sans identifiant, hôte d'Entra ID imposé), schéma d'un fournisseur, codes affichés après un refus,
   flux « sso-saml » du registre. Valeurs fictives. */
import { describe, expect, it } from 'vitest';
import {
  ATTRIBUT_MFA_ENTRA,
  CODES_ECHEC_SSO,
  FLUX_SANS_REPRISE,
  FournisseurSsoBody,
  HOTE_METADONNEES_ENTRA,
  MESSAGES_ECHEC_SSO,
  MFA_PAR_DEFAUT,
  MOTIFS_REFUS_SSO,
  RapportMetadonneesSso,
  UserCreateBody,
  VALEUR_MFA_ENTRA,
  codeEchecSso,
  destinationMetadonnees,
  fluxExterne,
  refusUrlMetadonnees,
} from '../src/index.js';

const corps = (o: Record<string, unknown> = {}) => ({
  type: 'entra',
  libelle: 'Entra ID',
  actif: true,
  entityId: 'https://sts.windows.net/00000000-0000-4000-8000-0000000000aa/',
  urlMetadonnees: null,
  autoriteTls: null,
  mfaSource: 'attribut',
  mfaAttribut: ATTRIBUT_MFA_ENTRA,
  mfaValeurs: [VALEUR_MFA_ENTRA],
  rapprochement: 'nameid',
  rapprochementAttribut: '',
  ...o,
});

describe('connexion unique : réglages par défaut', () => {
  it('Entra ID : claim authnmethodsreferences contenant multipleauthn ; Keycloak : classe du contexte', () => {
    expect(MFA_PAR_DEFAUT.entra).toEqual({
      source: 'attribut',
      attribut: 'http://schemas.microsoft.com/claims/authnmethodsreferences',
      valeurs: ['http://schemas.microsoft.com/claims/multipleauthn'],
    });
    expect(MFA_PAR_DEFAUT.keycloak.source).toBe('authn_context');
    expect(MFA_PAR_DEFAUT.keycloak.valeurs.length).toBeGreaterThan(0);
    expect(MFA_PAR_DEFAUT.saml.valeurs.length).toBeGreaterThan(0);
  });
});

describe('connexion unique : adresse des métadonnées', () => {
  it('HTTPS seulement, sans identifiant ni fragment ; hôte d’Entra ID imposé', () => {
    expect(refusUrlMetadonnees('http://kc.example.org/x', 'keycloak')).toMatch(/https/);
    expect(refusUrlMetadonnees('https://u:p@kc.example.org/x', 'keycloak')).toMatch(/identifiant/);
    expect(refusUrlMetadonnees('https://kc.example.org/x#f', 'keycloak')).toMatch(/fragment/);
    expect(refusUrlMetadonnees('pas une adresse', 'saml')).toMatch(/illisible/);
    expect(refusUrlMetadonnees('https://kc.example.org:8443/realms/r/protocol/saml/descriptor', 'keycloak')).toBeNull();
    expect(
      refusUrlMetadonnees(
        `https://${HOTE_METADONNEES_ENTRA}/t/federationmetadata/2007-06/federationmetadata.xml`,
        'entra',
      ),
    ).toBeNull();
    expect(refusUrlMetadonnees('https://login.example.org/t/federationmetadata.xml', 'entra')).toMatch(/Entra/);
    expect(refusUrlMetadonnees(`https://${HOTE_METADONNEES_ENTRA}:8443/t`, 'entra')).toMatch(/Entra/);
    expect(destinationMetadonnees('https://kc.example.org:8443/x')).toBe('kc.example.org:8443');
    expect(destinationMetadonnees(`https://${HOTE_METADONNEES_ENTRA}/x`)).toBe(HOTE_METADONNEES_ENTRA);
  });
});

describe('connexion unique : schéma d’un fournisseur', () => {
  it('accepte une configuration complète ; refuse une preuve sans valeur, un attribut manquant, une adresse refusée', () => {
    expect(FournisseurSsoBody.safeParse(corps()).success).toBe(true);
    expect(FournisseurSsoBody.safeParse(corps({ mfaValeurs: [] })).success).toBe(false);
    expect(FournisseurSsoBody.safeParse(corps({ mfaAttribut: '' })).success).toBe(false);
    expect(FournisseurSsoBody.safeParse(corps({ rapprochement: 'attribut', rapprochementAttribut: '' })).success).toBe(
      false,
    );
    expect(FournisseurSsoBody.safeParse(corps({ urlMetadonnees: 'http://login.microsoftonline.com/x' })).success).toBe(
      false,
    );
    expect(FournisseurSsoBody.safeParse(corps({ autoriteTls: 'pas un certificat' })).success).toBe(false);
    expect(FournisseurSsoBody.safeParse(corps({ champ: 'en trop' })).success).toBe(false);
    expect(FournisseurSsoBody.safeParse(corps({ libelle: 'a\u0007b' })).success).toBe(false);
  });
  it('un compte peut être créé d’avance en « connexion unique »', () => {
    const r = UserCreateBody.safeParse({
      username: 'alice',
      modeConnexion: 'sso',
      fournisseurId: '00000000-0000-4000-8000-0000000000aa',
      identifiantExterne: 'alice@example.org',
    });
    expect(r.success).toBe(true);
    expect(UserCreateBody.safeParse({ username: 'alice', modeConnexion: 'autre' }).success).toBe(false);
  });
});

describe('connexion unique : refus et rapport de l’exécutant', () => {
  it('chaque motif a un code d’affichage, qui ne révèle pas le motif exact', () => {
    for (const m of MOTIFS_REFUS_SSO) expect(CODES_ECHEC_SSO).toContain(codeEchecSso(m));
    expect(codeEchecSso('mfa_absente')).toBe('mfa');
    expect(codeEchecSso('compte_desactive')).toBe(codeEchecSso('compte_inconnu'));
    expect(codeEchecSso('signature')).toBe('refus');
    for (const c of CODES_ECHEC_SSO) expect(MESSAGES_ECHEC_SSO[c]).not.toBe('');
  });
  it('rapport : base64 ou erreur sur une ligne ; rien d’autre', () => {
    expect(RapportMetadonneesSso.safeParse({ ok: true, contenu: 'PG1kLz4=' }).success).toBe(true);
    expect(RapportMetadonneesSso.safeParse({ ok: false, erreur: 'Délai dépassé.' }).success).toBe(true);
    expect(RapportMetadonneesSso.safeParse({ ok: false, erreur: 'a\nb' }).success).toBe(false);
    expect(RapportMetadonneesSso.safeParse({ ok: true, contenu: 'PG1kLz4=', extra: 1 }).success).toBe(false);
    expect(RapportMetadonneesSso.safeParse({ ok: true, contenu: '<md/>' }).success).toBe(false);
  });
});

describe('connexion unique : flux « sso-saml » du registre', () => {
  it('sortant, porté par l’exécutant, ouvert par l’enregistrement du fournisseur, sans reprise', () => {
    const f = fluxExterne('sso-saml');
    expect(f.destinations.map((d) => d.sens)).toEqual(['sortant', 'sortant']);
    expect(f.destinations[0]!.hote).toContain(HOTE_METADONNEES_ENTRA);
    expect(f.porteur).toMatchObject({ type: 'executant', services: ['updater'] });
    expect(f.activation.par).toBe('module');
    expect(f.reglage.lien).toBe('/systeme/securite');
    expect(FLUX_SANS_REPRISE).toContain('sso-saml');
    expect(f.pareFeu.join(' ')).toContain(HOTE_METADONNEES_ENTRA);
  });
});

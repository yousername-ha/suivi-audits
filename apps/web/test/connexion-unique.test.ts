/* Connexion unique SAML (ADR 0114) : boutons de la page de connexion (un lien par fournisseur actif, au-dessus du formulaire
   local), message après un refus, carte d'administration « Connexion unique (SAML) » (service à déclarer, fournisseurs,
   état du flux et des métadonnées, actions réservées à l'écriture), formulaire d'un fournisseur (valeurs par défaut par
   type, validation du flux pour une adresse nouvelle) et champs de connexion d'un compte. Données fictives. */
import { MantineProvider } from '@mantine/core';
import {
  ATTRIBUT_MFA_ENTRA,
  MESSAGES_ECHEC_SSO,
  VALEUR_MFA_ENTRA,
  type ConnexionUniqueOut,
  type FluxExternesOut,
  type FournisseurSsoOut,
} from '@suivi/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { CLE_SSO, ConnexionUniquePanel } from '../src/components/ConnexionUnique';
import { CLE_FLUX_EXTERNES } from '../src/components/FluxExternes';
import {
  champsConnexion,
  changerType,
  corpsFournisseur,
  etatMetadonnees,
  formulaireDepuis,
  lienConnexionSso,
  messageEchecSso,
  precisionDestination,
  validationFluxRequise,
} from '../src/connexion-unique';
import { BoutonsConnexionUnique } from '../src/pages/Login';

const rendu = (e: ReactElement) =>
  renderToStaticMarkup(createElement(MantineProvider, null, createElement(MemoryRouter, null, e)));

const ID = '00000000-0000-4000-8000-0000000000aa';
const fournisseur = (o: Partial<FournisseurSsoOut> = {}): FournisseurSsoOut => ({
  id: ID,
  type: 'entra',
  libelle: 'Entra ID (fictif)',
  actif: true,
  entityId: 'https://sts.windows.net/00000000-0000-4000-8000-0000000000bb/',
  urlMetadonnees:
    'https://login.microsoftonline.com/00000000-0000-4000-8000-0000000000bb/federationmetadata/2007-06/federationmetadata.xml',
  autoriteTls: null,
  mfaSource: 'attribut',
  mfaAttribut: ATTRIBUT_MFA_ENTRA,
  mfaValeurs: [VALEUR_MFA_ENTRA],
  rapprochement: 'nameid',
  rapprochementAttribut: '',
  ssoUrl: 'https://login.microsoftonline.com/00000000-0000-4000-8000-0000000000bb/saml2',
  certificats: [{ empreinte: 'ab'.repeat(32), sujet: 'CN=idp.example.org', expireLe: '2036-01-01T00:00:00.000Z' }],
  certificatExpireLe: '2036-01-01T00:00:00.000Z',
  metadonnees: {
    source: 'url',
    lueLe: '2026-11-25T08:00:00.000Z',
    signees: true,
    erreur: null,
    erreurLe: null,
    relectureDemandee: false,
  },
  pret: true,
  comptes: 2,
  sp: { acsUrl: `https://suivi.example.org/api/auth/sso/${ID}/acs` },
  version: 3,
  ...o,
});
const sso = (fournisseurs: FournisseurSsoOut[]): ConnexionUniqueOut => ({
  sp: {
    disponible: true,
    raison: null,
    entityId: 'https://suivi.example.org/api/auth/sso/sp',
    certificat: '-----BEGIN CERTIFICATE-----\nMIIFICTIF\n-----END CERTIFICATE-----\n',
    certificatExpireLe: '2036-11-25T00:00:00.000Z',
    signeRequetes: true,
  },
  fournisseurs,
});
const flux = (ouvert: boolean): FluxExternesOut => ({
  modules: [
    {
      module: 'sso-saml',
      ouvert,
      decidePar: null,
      decideLe: null,
      applique: ouvert ? 'ouvert' : null,
      appliqueLe: null,
      erreur: null,
    },
  ],
  mandataire: { actif: false },
});
const carte = (donnees: ConnexionUniqueOut, ecriture: boolean, ouvert = true) => {
  const qc = new QueryClient();
  qc.setQueryData(CLE_SSO, donnees);
  qc.setQueryData(CLE_FLUX_EXTERNES, flux(ouvert));
  return rendu(createElement(QueryClientProvider, { client: qc }, createElement(ConnexionUniquePanel, { ecriture })));
};

describe('page de connexion : connexion unique', () => {
  it('un lien « Se connecter avec … » par fournisseur, vers le départ du serveur avec le chemin de retour', () => {
    const html = rendu(
      createElement(BoutonsConnexionUnique, {
        fournisseurs: [
          { id: ID, libelle: 'Entra ID (fictif)', type: 'entra' },
          { id: '00000000-0000-4000-8000-0000000000cc', libelle: 'Keycloak (fictif)', type: 'keycloak' },
        ],
        retour: '/accueil',
      }),
    );
    expect(html).toContain('Se connecter avec Entra ID (fictif)');
    expect(html).toContain('Se connecter avec Keycloak (fictif)');
    expect(html).toContain(`href="/api/auth/sso/${ID}/connexion?retour=%2Faccueil"`);
    expect(html).toContain('aria-label="Connexion unique"');
    // Simples liens, sans script (CSP stricte, ADR 0006) : la navigation part vers le serveur, qui redirige.
    const nav = /<nav[\s\S]*<\/nav>/.exec(html)![0];
    expect(nav).not.toMatch(/<script|onclick|javascript:/i);
    expect(nav.match(/<a /g)).toHaveLength(2);
  });
  it('aucun fournisseur actif : rien n’est affiché', () => {
    expect(rendu(createElement(BoutonsConnexionUnique, { fournisseurs: [], retour: '/' }))).not.toContain('<nav');
  });
  it('message après un refus : un code connu seulement, jamais le motif exact', () => {
    expect(messageEchecSso('mfa')).toBe(MESSAGES_ECHEC_SSO.mfa);
    expect(messageEchecSso('compte')).toBe(MESSAGES_ECHEC_SSO.compte);
    expect(messageEchecSso('<script>')).toBeNull();
    expect(messageEchecSso(null)).toBeNull();
    expect(lienConnexionSso(ID, '/registres?x=1')).toBe(`/api/auth/sso/${ID}/connexion?retour=%2Fregistres%3Fx%3D1`);
  });
});

describe('carte d’administration « Connexion unique (SAML) »', () => {
  it('montre le service à déclarer, le fournisseur, l’état du flux et des métadonnées, l’expiration du certificat', () => {
    const html = carte(sso([fournisseur()]), true);
    expect(html).toContain('Connexion unique (SAML)');
    expect(html).toContain('https://suivi.example.org/api/auth/sso/sp');
    // Certificat du service : copié par un bouton, pas affiché (le bloc PEM empêchait la fenêtre de se découper).
    expect(html).toContain('Copier le certificat du service');
    expect(html).not.toContain('BEGIN CERTIFICATE');
    expect(html).toContain('Entra ID (fictif)');
    expect(html).toContain(`https://suivi.example.org/api/auth/sso/${ID}/acs`);
    expect(html).toContain('Flux des métadonnées ouvert, appliqué');
    expect(html).toContain('lues automatiquement, signature vérifiée');
    expect(html).toContain('Certificat de signature valable jusqu’au');
    for (const b of ['Ajouter un fournisseur', 'Modifier', 'Relire les métadonnées', 'Importer le fichier XML'])
      expect(html, b).toContain(b);
    // Deux comptes rattachés : pas de suppression proposée.
    expect(html).not.toContain('>Supprimer<');
  });
  it('lecture seule : aucune action d’écriture ; flux fermé et import manuel affichés', () => {
    const html = carte(
      sso([fournisseur({ urlMetadonnees: null, metadonnees: { ...fournisseur().metadonnees, source: 'import' } })]),
      false,
      false,
    );
    expect(html).toContain('Flux des métadonnées fermé');
    expect(html).toContain('import manuel');
    for (const b of ['Ajouter un fournisseur', 'Modifier', 'Relire les métadonnées', 'Importer le fichier XML'])
      expect(html, b).not.toContain(b);
    expect(html).toContain('Métadonnées du service (XML)');
  });
  it('service indisponible sans adresse publique', () => {
    const d = sso([]);
    const html = carte(
      { ...d, sp: { ...d.sp, disponible: false, raison: 'Adresse publique absente.', entityId: null } },
      true,
    );
    expect(html).toContain('Connexion unique indisponible');
    expect(html).not.toContain('Ajouter un fournisseur');
  });
});

describe('formulaire d’un fournisseur', () => {
  it('valeurs par défaut par type : Entra ID (claim des méthodes), Keycloak (classe du contexte)', () => {
    const e = formulaireDepuis(null, 'entra');
    expect(e).toMatchObject({ mfaSource: 'attribut', mfaAttribut: ATTRIBUT_MFA_ENTRA, mfaValeurs: VALEUR_MFA_ENTRA });
    const k = changerType(e, 'keycloak');
    expect(k.mfaSource).toBe('authn_context');
    expect(k.mfaValeurs).toContain('https://refeds.org/profile/mfa');
  });
  it('corps envoyé : valeurs une par ligne, champs inutiles vidés, adresse vide en import manuel', () => {
    const c = corpsFournisseur({
      ...formulaireDepuis(null, 'keycloak'),
      entityId: ' https://sso.example.org/realms/fictif ',
      mfaValeurs: 'a\n\n b \n',
      mfaAttribut: 'ignoré',
      urlMetadonnees: '  ',
    });
    expect(c).toMatchObject({
      entityId: 'https://sso.example.org/realms/fictif',
      mfaValeurs: ['a', 'b'],
      mfaAttribut: '',
      urlMetadonnees: null,
    });
  });
  it('une adresse nouvelle ou changée demande la validation du flux, avec l’hôte joint', () => {
    expect(validationFluxRequise(null, 'https://kc.example.org/x')).toBe(true);
    expect(validationFluxRequise('https://kc.example.org/x', 'https://kc.example.org/x')).toBe(false);
    expect(validationFluxRequise('https://kc.example.org/x', null)).toBe(false);
    expect(precisionDestination('https://kc.example.org:8443/x')).toContain('kc.example.org:8443');
  });
  it('état des métadonnées : refusées, à lire, certificat proche de l’expiration, relecture en échec', () => {
    expect(
      etatMetadonnees(fournisseur({ pret: false, metadonnees: { ...fournisseur().metadonnees, erreur: 'entityID' } }))
        .couleur,
    ).toBe('red');
    expect(etatMetadonnees(fournisseur({ pret: false })).couleur).toBe('gray');
    const bientot = new Date(Date.now() + 5 * 86400e3).toISOString();
    expect(etatMetadonnees(fournisseur({ certificatExpireLe: bientot })).couleur).toBe('red');
    expect(
      etatMetadonnees(fournisseur({ metadonnees: { ...fournisseur().metadonnees, erreur: 'Délai' } })).couleur,
    ).toBe('orange');
    expect(etatMetadonnees(fournisseur()).couleur).toBe('green');
  });
});

describe('compte : champs de connexion', () => {
  const local = { mode_connexion: 'local' as const, sso_fournisseur_id: null, sso_identifiant: null };
  const sso_ = { mode_connexion: 'sso' as const, sso_fournisseur_id: ID, sso_identifiant: 'alice@example.org' };
  it('rien pour un compte local qui le reste ; mode, fournisseur et identifiant pour un passage en connexion unique', () => {
    expect(champsConnexion({ modeConnexion: 'local', fournisseurId: '', identifiantExterne: '' }, local)).toEqual({});
    expect(
      champsConnexion({ modeConnexion: 'sso', fournisseurId: ID, identifiantExterne: ' alice@example.org ' }, local),
    ).toEqual({
      modeConnexion: 'sso',
      fournisseurId: ID,
      identifiantExterne: 'alice@example.org',
    });
    expect(
      champsConnexion({ modeConnexion: 'sso', fournisseurId: ID, identifiantExterne: 'alice@example.org' }, sso_),
    ).toEqual({});
    expect(champsConnexion({ modeConnexion: 'local', fournisseurId: ID, identifiantExterne: '' }, sso_)).toEqual({
      modeConnexion: 'local',
    });
  });
});

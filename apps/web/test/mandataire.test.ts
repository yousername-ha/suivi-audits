/* Mandataire sortant de l'établissement (ADR 0101, lot P1) : carte réservée au droit d'administrer, règles de l'écran
   (erreur d'adresse, mot de passe effacé quand l'adresse ou l'identifiant change), écran du réglage (mot de passe « défini »
   ou « non défini », jamais affiché ; avertissement sur l'inspection ; flux qui l'utilisent, en accès direct, pas encore
   pris en charge), validation d'un flux et pare-feu quand il est actif, article d'aide. Données fictives. */
import { MantineProvider } from '@mantine/core';
import { FLUX_EXTERNES, FLUX_MODULES, fluxExterne, type MandataireOut } from '@suivi/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { cartesVisibles } from '../src/administration-droits';
import { CLE_MANDATAIRE, MandatairePanel } from '../src/components/Mandataire';
import { DetailValidationFlux } from '../src/components/ValidationFlux';
import { pareFeuAOuvrir } from '../src/flux-externes';
import { HELP_ARTICLES } from '../src/help';
import {
  effaceraMotDePasse,
  erreurAdresse,
  LIEN_MANDATAIRE,
  lignesFluxMandataire,
  peutEnregistrer,
} from '../src/mandataire';

const avec = (droits: string[]) => (m: string, a: string) => droits.includes(`${m}:${a}`);
const rendu = (e: ReactElement) =>
  renderToStaticMarkup(createElement(MantineProvider, null, createElement(MemoryRouter, null, e)));
const panneau = (out: MandataireOut) => {
  const qc = new QueryClient();
  qc.setQueryData(CLE_MANDATAIRE, out);
  return rendu(createElement(QueryClientProvider, { client: qc }, createElement(MandatairePanel)));
};
const reglage = {
  actif: true,
  adresse: 'http://mandataire.exemple.test:3128',
  identifiant: 'compte-veille',
  autoriteCertification: '',
};

describe('mandataire sortant : carte et règles', () => {
  it('la carte est dans la Configuration système, réservée au droit d’administrer', () => {
    expect(LIEN_MANDATAIRE).toBe('/systeme/mandataire');
    expect(cartesVisibles(avec(['administration:administrer']), 'systeme')).toContain('mandataire');
    for (const droits of [['administration:lire'], ['parametres:administrer'], ['vulnerabilites:administrer'], []])
      expect(cartesVisibles(avec(droits), 'systeme')).not.toContain('mandataire');
  });
  it('erreur d’adresse en clair ; enregistrement possible seulement avec une adresse valide quand il est actif', () => {
    expect(erreurAdresse('')).toBeNull();
    expect(erreurAdresse('http://10.0.0.8:8080')).toBeNull();
    expect(erreurAdresse('http://[2001:db8::8]:3128')).toBeNull();
    expect(erreurAdresse('http://mandataire.exemple.test')).toMatch(/Port obligatoire/);
    expect(erreurAdresse('http://compte:x@mandataire.exemple.test:3128')).toMatch(/identifiant/);
    expect(erreurAdresse('https://mandataire.exemple.test:3128')).toMatch(/non pris en charge/);
    expect(peutEnregistrer(reglage)).toBe(true);
    expect(peutEnregistrer({ ...reglage, adresse: '' })).toBe(false);
    expect(peutEnregistrer({ ...reglage, actif: false, adresse: '' })).toBe(true);
    expect(peutEnregistrer({ ...reglage, adresse: 'http://mandataire.exemple.test:0' })).toBe(false);
  });
  it('prévient que changer l’adresse ou l’identifiant efface le mot de passe enregistré', () => {
    expect(effaceraMotDePasse(reglage, reglage, true)).toBe(false);
    expect(effaceraMotDePasse(reglage, { ...reglage, adresse: 'http://autre.exemple.test:3128' }, true)).toBe(true);
    expect(effaceraMotDePasse(reglage, { ...reglage, identifiant: 'autre' }, true)).toBe(true);
    expect(effaceraMotDePasse(reglage, { ...reglage, identifiant: 'autre' }, false)).toBe(false);
  });
  it('liste les flux : la veille l’utilise, Tenable et le courriel en accès direct, les autres pas encore pris en charge', () => {
    const g = lignesFluxMandataire();
    expect(g.map((x) => [x.libelle, x.flux.map((f) => f.id)])).toEqual([
      ['Utilise le mandataire', ['veille-vulnerabilites']],
      ['Accès direct, par construction', ['courriel', 'tenable']],
      ['Pas encore pris en charge', ['assistant', 'acme', 'antivirus', 'mises-a-jour']],
    ]);
    expect(g.flatMap((x) => x.flux.map((f) => f.id)).sort()).toEqual([...FLUX_MODULES].sort());
  });
});

describe('mandataire sortant : écran du réglage', () => {
  it('mot de passe « non défini » ou « défini », jamais affiché ; avertissement sur l’inspection ; flux listés', () => {
    const vide = panneau({
      values: { actif: false, adresse: '', identifiant: '', autoriteCertification: '' },
      version: 0,
      motDePasseDefini: false,
    });
    expect(vide).toContain('Non défini');
    expect(vide).toContain('Inspection du trafic chiffré');
    expect(vide).toContain('lit ce qui passe');
    expect(vide).toContain('source sûre');
    expect(vide).toContain('NTLM et Kerberos ne sont pas pris en charge');
    expect(vide).toContain('Utilise le mandataire');
    expect(vide).toContain('Accès direct, par construction');
    expect(vide).toContain('Pas encore pris en charge');
    expect(vide).toContain('Veille sur les vulnérabilités');
    expect(vide).toContain('Tenable Security Center');
    const defini = panneau({ values: reglage, version: 3, motDePasseDefini: true });
    expect(defini).toContain('Défini');
    expect(defini).not.toContain('Non défini');
    expect(defini).toContain('Retirer');
    expect(defini).toContain('http://mandataire.exemple.test:3128');
    // Le champ du mot de passe reste vide : le serveur ne le renvoie jamais.
    expect(/<input[^>]*type="password"[^>]*value="[^"]+"/.test(defini)).toBe(false);
  });
});

describe('flux et mandataire actif', () => {
  it('la validation de la veille dit que les demandes passent par le mandataire ; pare-feu vers le mandataire', () => {
    const sans = rendu(
      createElement(DetailValidationFlux, { module: 'veille-vulnerabilites', valide: false, onValide: () => {} }),
    );
    expect(sans).not.toContain('passent par le mandataire');
    expect(sans).toContain('Sortie TCP 443 du serveur vers www.cisa.gov');
    const par = rendu(
      createElement(DetailValidationFlux, {
        module: 'veille-vulnerabilites',
        valide: false,
        onValide: () => {},
        mandataire: true,
      }),
    );
    expect(par).toContain('passent par le mandataire réglé');
    expect(par).toContain('la destination finale est inchangée');
    expect(par).toContain('Sortie TCP du serveur vers le mandataire de l’établissement, sur le port réglé.');
    expect(par).not.toContain('Sortie TCP 443 du serveur vers www.cisa.gov');
    // Destinations finales inchangées.
    expect(par).toContain('www.cisa.gov');
    // Un flux qui ne l'utilise pas ne prétend pas passer par lui.
    for (const m of ['assistant', 'mises-a-jour', 'antivirus', 'acme', 'tenable', 'courriel'] as const) {
      const html = rendu(
        createElement(DetailValidationFlux, { module: m, valide: false, onValide: () => {}, mandataire: true }),
      );
      expect(html, m).not.toContain('mandataire');
    }
  });
  it('pare-feu à faire autoriser : vers le mandataire pour la veille seulement', () => {
    const etats = FLUX_MODULES.map((module) => ({ module, ouvert: true }));
    const sans = pareFeuAOuvrir(FLUX_EXTERNES, etats);
    const par = pareFeuAOuvrir(FLUX_EXTERNES, etats, true);
    const veille = fluxExterne('veille-vulnerabilites').libelle;
    expect(sans.find((p) => p.libelle === veille)!.regles.join(' ')).toContain('www.cisa.gov');
    expect(par.find((p) => p.libelle === veille)!.regles).toEqual([
      'Sortie TCP du serveur vers le mandataire de l’établissement, sur le port réglé.',
    ]);
    for (const p of par.filter((x) => x.libelle !== veille))
      expect(p.regles, p.libelle).toEqual(sans.find((x) => x.libelle === p.libelle)!.regles);
  });
});

describe('aide', () => {
  it('l’article décrit le réglage, le mot de passe en écriture seule, l’inspection et les limites', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'mandataire-sortant');
    expect(a?.permission).toBe('administration:administrer');
    expect(a?.link).toBe(LIEN_MANDATAIRE);
    const texte = a!.steps.join(' ');
    for (const attendu of [
      'http://hôte:port',
      'jamais affiché',
      'efface le mot de passe',
      'inspecte',
      'NTLM et Kerberos',
      'Tenable',
      'pas encore',
      'démon Docker',
    ])
      expect(texte).toContain(attendu);
    expect(texte).not.toMatch(/assistant[^.]*passe par le mandataire/i);
  });
});

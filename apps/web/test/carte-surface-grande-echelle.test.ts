/* Carte de la surface externe à grande échelle (7.6.1, demande du RSSI du 22/11/2026, rendu validé le même jour) : carte
   sans cadre, tronc unique depuis Internet, ordre naturel des noms, regroupements « Bloc d'adresses » et « Hébergeur ».
   Données entièrement fictives : domaines en .example, adresses de documentation (192.0.2.0/24, 198.51.100.0/24,
   2001:db8::/32), numéros de système autonome réservés à la documentation (64496 à 64511). */
import type { ActifCarteDto, AlerteCarteDto, CarteSurfaceDto } from '@suivi/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  blocAdresse,
  construireModele,
  disposer,
  FILTRES_CARTE_VIDES,
  filtrerModele,
  hebergeurDe,
  libelleColonneGroupe,
  OPTIONS_REGROUPEMENT,
  type Regroupement,
  toutDeplier,
  X,
} from '../src/vulnerabilites/carte-surface';

const UI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/ui/src');
const id = (k: number) => `00000000-0000-4000-8000-${String(k).padStart(12, '0')}`;
let n = 0;
const actif = (v: Partial<ActifCarteDto>): ActifCarteDto => {
  const a: ActifCarteDto = {
    id: id(++n),
    type: 'domaine',
    valeur: 'exemple.example',
    adresse: null,
    niveau: 2,
    parentId: null,
    perimetreNom: 'Périmètre fictif A',
    perimetreAlh: 'Périmètre ALH fictif 1',
    machines: [],
    propositions: 0,
    autresMachines: false,
    versionLiaisons: 1,
    services: [],
    nombreServices: 0,
    sources: ['alh'],
    alhId: null,
    silene: null,
    ...v,
  };
  return { ...a, alhId: a.alhId ?? a.id };
};
const alerte = (v: Partial<AlerteCarteDto>): AlerteCarteDto => ({
  id: id(1000 + ++n),
  type: 'vulnerable_service',
  criticite: 'major',
  titre: 'Alerte fictive',
  cves: [],
  priorite: null,
  cible: null,
  actifId: null,
  ...v,
});
const ALPHA = { asn: '64496', fai: 'Hébergeur fictif Alpha', pays: 'FR', cdn: false };
const DIFFUSION = { asn: '64498', fai: 'Réseau de diffusion fictif', pays: 'NL', cdn: true };

/** Deux racines (exemple-2 et exemple-10), trois noms, trois hôtes : deux dans 192.0.2.0/24 (hébergeur Alpha et réseau
    de diffusion), un dans 198.51.100.0/24 (Alpha) ; un hôte IPv6 vu par Silène seul, sans hébergeur connu. */
function surface() {
  n = 0;
  const r2 = actif({ valeur: 'exemple-2.example' });
  const r10 = actif({ valeur: 'exemple-10.example' });
  const vpn = actif({ valeur: 'vpn.exemple-2.example', adresse: '192.0.2.10', parentId: r2.id });
  const mail = actif({ valeur: 'mail.exemple-2.example', adresse: '192.0.2.20', parentId: r2.id });
  const www = actif({ valeur: 'www.exemple-10.example', adresse: '198.51.100.5', parentId: r10.id });
  const h1 = actif({ type: 'hote', valeur: '192.0.2.10', niveau: null, reseau: ALPHA });
  const h2 = actif({ type: 'hote', valeur: '192.0.2.20', niveau: null, reseau: DIFFUSION });
  const h3 = actif({ type: 'hote', valeur: '198.51.100.5', niveau: null, reseau: ALPHA });
  const h6 = actif({
    type: 'hote',
    valeur: '2001:db8:0:1::25',
    niveau: null,
    sources: ['silene'],
    alhId: null,
    perimetreNom: null,
  });
  const critique = alerte({ criticite: 'critical', priorite: 'P1', actifId: vpn.id });
  const carte: CarteSurfaceDto = {
    actifs: [r10, r2, vpn, mail, www, h1, h2, h3, h6],
    alertes: [critique],
    constatsSilene: [],
    tronquee: false,
    totaux: { actifs: 9, alertes: 1 },
  };
  return { carte, vpn };
}
const modele = (r: Regroupement) => filtrerModele(construireModele(surface().carte, r), FILTRES_CARTE_VIDES);

describe('bloc d’adresses et hébergeur', () => {
  it('bloc : /24 en IPv4, /64 en IPv6 (groupes sans zéros de tête)', () => {
    expect(blocAdresse('192.0.2.10')).toBe('192.0.2.0/24');
    expect(blocAdresse('2001:0db8:0000:0001:0000:0000:0000:0025')).toBe('2001:db8:0:1::/64');
  });
  it('hébergeur : fournisseur, numéro de système autonome, pays, CDN ; sinon « Hébergeur inconnu »', () => {
    expect(hebergeurDe({ reseau: ALPHA }).libelle).toBe('Hébergeur fictif Alpha · AS64496 · FR');
    expect(hebergeurDe({ reseau: DIFFUSION }).libelle).toBe('Réseau de diffusion fictif · AS64498 · NL · CDN');
    expect(hebergeurDe({ reseau: { asn: '64499', fai: null, pays: null, cdn: null } }).libelle).toBe(
      'Fournisseur non communiqué · AS64499',
    );
    for (const h of [null, undefined, { reseau: null }, { reseau: { asn: null, fai: null, pays: 'FR', cdn: true } }])
      expect(hebergeurDe(h).libelle).toBe('Hébergeur inconnu');
  });
  it('les deux regroupements sont proposés, avec leur titre de colonne', () => {
    expect(OPTIONS_REGROUPEMENT.map((o) => o.label)).toEqual([
      'Nom de domaine',
      'Adresse IP publique',
      'Bloc d’adresses',
      'Hébergeur',
      'Périmètre',
    ]);
    expect(libelleColonneGroupe('bloc')).toBe('Bloc d’adresses');
    expect(libelleColonneGroupe('hebergeur')).toBe('Hébergeur');
  });
});

describe('modèle : une ligne par adresse, réunies par bloc ou par hébergeur', () => {
  it('par bloc : chaque adresse dans son bloc, avec les noms qui y résolvent ; la branche critique d’abord', () => {
    const m = modele('bloc');
    // Les racines sans adresse vont, comme dans le regroupement par adresse, dans « Noms sans adresse connue ».
    expect(m.groupes.map((g) => g.libelle)).toEqual([
      '192.0.2.0/24',
      '198.51.100.0/24',
      '2001:db8:0:1::/64',
      'Noms sans adresse connue',
    ]);
    const bloc = m.groupes[0]!;
    expect(bloc.critique).toBe(true);
    expect(bloc.lignes.map((l) => [l.adresse, l.domaines.map((d) => d.valeur)])).toEqual([
      ['192.0.2.10', ['vpn.exemple-2.example']],
      ['192.0.2.20', ['mail.exemple-2.example']],
    ]);
  });
  it('par hébergeur : adresses du même fournisseur réunies, « Hébergeur inconnu » après les hébergeurs connus', () => {
    const m = modele('hebergeur');
    expect(m.groupes.map((g) => g.libelle)).toEqual([
      'Hébergeur fictif Alpha · AS64496 · FR',
      'Réseau de diffusion fictif · AS64498 · NL · CDN',
      'Hébergeur inconnu',
      'Noms sans adresse connue',
    ]);
    expect(m.groupes[0]!.lignes.map((l) => l.adresse).sort()).toEqual(['192.0.2.10', '198.51.100.5']);
    expect(m.groupes[2]!.lignes.map((l) => l.adresse)).toEqual(['2001:0db8:0000:0001:0000:0000:0000:0025']);
  });
  it('ordre naturel des noms : « exemple-2 » avant « exemple-10 » à égalité', () => {
    const m = filtrerModele(construireModele({ ...surface().carte, alertes: [] }, 'parent'), FILTRES_CARTE_VIDES);
    expect(m.groupes.map((g) => g.libelle).slice(0, 2)).toEqual(['exemple-2.example', 'exemple-10.example']);
  });
});

describe('scène : un seul tronc depuis Internet', () => {
  it('tronc unique, rouge jusqu’à la dernière branche critique ; chaque branche raccordée par un court trait', () => {
    const m = modele('bloc');
    const s = disposer(m, toutDeplier(m), { peutModifier: true });
    expect(s.tronc).not.toBeNull();
    expect(s.tronc!.x).toBe(X.tronc);
    expect(s.tronc!.y0).toBe(s.origine.y);
    const dernier = s.groupes[s.groupes.length - 1]!;
    expect(s.tronc!.y1).toBeLessThanOrEqual(dernier.y);
    // Seule la première branche porte un chemin critique : le rouge s'arrête avant la deuxième.
    expect(s.tronc!.yCritique).not.toBeNull();
    expect(s.tronc!.yCritique!).toBeLessThan(s.groupes[1]!.y);
    for (const g of s.groupes) {
      const lien = s.liens.find((l) => l.cle === `o:${g.cle}`)!;
      // Le raccord part du tronc, jamais du point « Internet ».
      expect(lien.d.startsWith(`M${X.tronc} `)).toBe(true);
      expect(lien.d.endsWith(`L${X.groupe} ${g.y}`)).toBe(true);
    }
  });
  it('sans branche critique, le tronc reste gris ; sans branche, pas de tronc', () => {
    const calme = filtrerModele(construireModele({ ...surface().carte, alertes: [] }, 'bloc'), FILTRES_CARTE_VIDES);
    expect(disposer(calme, toutDeplier(calme), { peutModifier: true }).tronc!.yCritique).toBeNull();
    const vide = filtrerModele(
      construireModele(
        { actifs: [], alertes: [], constatsSilene: [], tronquee: false, totaux: { actifs: 0, alertes: 0 } },
        'bloc',
      ),
      FILTRES_CARTE_VIDES,
    );
    expect(disposer(vide, toutDeplier(vide), { peutModifier: true }).tronc).toBeNull();
  });
});

describe('carte posée dans la page', () => {
  it('la zone de dessin n’a ni bordure, ni coins arrondis, ni fond propre', () => {
    const css = readFileSync(path.join(UI, 'neon-surface.css'), 'utf8');
    const regle = /\.sc-dessin \{([^}]*)\}/.exec(css)![1]!;
    expect(regle).not.toMatch(/border|background/);
  });
});

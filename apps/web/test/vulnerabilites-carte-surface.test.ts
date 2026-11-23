/* Module Vulnérabilités (ADR 0100, lot ALH4) : carte « Lignes d'approche » de la surface externe, côté interface. Modèle
   (branches par domaine parent ou par périmètre, hôte relié par l'adresse de résolution, typosquatting et fuites côté
   Internet), filtres, repli par défaut au-delà d'un seuil, faisceaux, borne d'affichage à grande échelle (150 domaines et
   plus), chemin d'entrée critique (P1), « à relier » réservé à qui peut modifier, machine illisible jamais nommée, rendu
   sans style en ligne. Lot SI2 : deux sources (nœud unique, pastilles, services réunis, constats Silène sans priorité),
   regroupement par adresse IP, noms d'une même adresse réunis et renvoi entre branches, filtre par nom de domaine ou début
   d'adresse, carte « page entière » (plus de caméra : scène entière, repères collants, présentation empilée sur écran
   étroit), grande échelle (150 noms, 60 adresses, 200 services) dans les deux regroupements. Décision du RSSI du
   23/11/2026 : un seul champ « Filtrer la carte », dans la barre collante (nom, adresse, CVE, port ; une partie d'un nom ne
   garde que les noms qui la contiennent). Données entièrement fictives :
   domaines en .example et example.org, adresses de 192.0.2.0/24, 198.51.100.0/24 et 203.0.113.0/24, machines inventées. */
import { MantineProvider } from '@mantine/core';
import type { ActifCarteDto, AlerteCarteDto, CarteSurfaceDto, ServiceAlhDto, SileneCarteDto } from '@suivi/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { annonceFiltre, CarteSurface, type VueCarte } from '../src/vulnerabilites/CarteSurface';
import * as carteSurface from '../src/vulnerabilites/carte-surface';
import {
  basculerCalmes,
  basculerGroupe,
  constatsDeLaCarte,
  constatsDuPort,
  construireModele,
  deplierVers,
  disposer,
  DOMAINE_H,
  epaisseurFaisceau,
  etiquetteDomaine,
  FILTRES_CARTE_VIDES,
  type FiltresCarte,
  filtrerModele,
  filtreTexte,
  LIGNES_MAX,
  type LigneDessinee,
  type LigneFiltree,
  type ModeleFiltre,
  parentDeduit,
  type Regroupement,
  replisParDefaut,
  SEUIL_DEPLIE,
  serviceDessine,
  toutDeplier,
  toutReplier,
  X,
} from '../src/vulnerabilites/carte-surface';
import { URL_CARTE_SURFACE } from '../src/vulnerabilites/surface';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let n = 0;
/** Actif d'AlgoLightHouse par défaut (`alhId` = `id`) ; `alhId: null` et `sources: ['silene']` : vu par Silène seul. */
const actif = (v: Partial<ActifCarteDto>): ActifCarteDto => {
  const a = brut(v);
  return 'alhId' in v ? a : { ...a, alhId: a.id };
};
const brut = (v: Partial<ActifCarteDto>): ActifCarteDto => ({
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
});
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

/** Petite surface : deux racines, sous-domaines, un hôte relié par résolution, un hôte isolé, un chemin critique. */
function petite() {
  const sante = actif({ valeur: 'exemple-sante.example', adresse: '192.0.2.1' });
  const vpn = actif({
    valeur: 'vpn.exemple-sante.example',
    adresse: '192.0.2.10',
    parentId: sante.id,
    machines: [{ id: id(9001), nom: 'srv-vpn-01.interne.invalid', adresse: '10.0.0.1', role: 'front' }],
  });
  const mail = actif({
    valeur: 'mail.exemple-sante.example',
    adresse: '192.0.2.11',
    parentId: sante.id,
    propositions: 1,
  });
  const extranet = actif({
    valeur: 'extranet.exemple-sante.example',
    adresse: '192.0.2.12',
    parentId: sante.id,
    autresMachines: true,
  });
  const calme = actif({ valeur: 'calme.exemple-sante.example', parentId: sante.id });
  const labo = actif({ valeur: 'exemple-labo.example', perimetreNom: 'Périmètre fictif B' });
  const hoteVpn = actif({ type: 'hote', valeur: '192.0.2.10', niveau: null });
  const isole = actif({ type: 'hote', valeur: '198.51.100.20', niveau: null, perimetreNom: null });
  const critique = alerte({
    criticite: 'critical',
    titre: 'VPN SSL : exécution de code à distance',
    cves: ['CVE-2026-90014'],
    priorite: 'P1',
    actifId: vpn.id,
  });
  const surHote = alerte({ criticite: 'minor', titre: 'Service exposé', type: 'exposed_service', actifId: hoteVpn.id });
  const surMail = alerte({ criticite: 'important', titre: 'Messagerie web exposée', actifId: mail.id });
  const surExtranet = alerte({
    criticite: 'major',
    titre: 'Console exposée',
    type: 'config_defect',
    actifId: extranet.id,
  });
  const typo = alerte({
    type: 'typosquatting',
    criticite: 'important',
    titre: 'Domaine ressemblant',
    cible: { type: 'domain', valeur: 'exemp1e-sante.example' },
  });
  const fuite = alerte({ type: 'data_leak', criticite: 'major', titre: 'Identifiants divulgués' });
  const orpheline = alerte({ criticite: 'minor', titre: 'Cible hors carte' });
  const carte: CarteSurfaceDto = {
    actifs: [sante, vpn, mail, extranet, calme, labo, hoteVpn, isole],
    alertes: [critique, surHote, surMail, surExtranet, typo, fuite, orpheline],
    constatsSilene: [],
    tronquee: false,
    totaux: { actifs: 8, alertes: 7 },
  };
  return { carte, sante, vpn, mail, extranet, calme, labo, hoteVpn, isole, critique, surHote, typo, fuite, orpheline };
}

/** Grande surface : `racines` domaines parents de `parRacine` sous-domaines, un hôte pour trois sous-domaines sur quatre,
    une alerte pour un sous-domaine sur dix d'une racine sur deux. */
function grande(racines: number, parRacine: number): CarteSurfaceDto {
  const actifs: ActifCarteDto[] = [];
  const alertes: AlerteCarteDto[] = [];
  let ip = 0;
  for (let r = 0; r < racines; r++) {
    const racine = actif({ valeur: `exemple-${r}.example` });
    actifs.push(racine);
    for (let i = 0; i < parRacine; i++) {
      ip++;
      const adresse = `${ip < 250 ? '192.0.2' : '198.51.100'}.${ip % 250}`;
      const d = actif({ valeur: `s${i}.exemple-${r}.example`, adresse, parentId: racine.id });
      actifs.push(d);
      if (i % 4 !== 3) actifs.push(actif({ type: 'hote', valeur: adresse }));
      if (i % 10 === 0 && r % 2 === 0) alertes.push(alerte({ actifId: d.id, criticite: 'minor' }));
    }
  }
  return {
    actifs,
    alertes,
    constatsSilene: [],
    tronquee: false,
    totaux: { actifs: actifs.length, alertes: alertes.length },
  };
}

/** Petite surface au-delà du seuil de repli par défaut : trente noms calmes de plus sous exemple-labo.example. */
function petiteAuDela() {
  const p = petite();
  const calmes = Array.from({ length: SEUIL_DEPLIE.lignes }, (_, i) =>
    actif({ valeur: `c${i}.exemple-labo.example`, parentId: p.labo.id, perimetreNom: 'Périmètre fictif B' }),
  );
  return { ...p, carte: { ...p.carte, actifs: [...p.carte.actifs, ...calmes] } };
}

const rendre = (carte: CarteSurfaceDto, peutModifier = true) =>
  renderToStaticMarkup(
    createElement(
      MantineProvider,
      null,
      createElement(CarteSurface, {
        carte,
        peutModifier,
        actions: { onAlerte: () => undefined, onActif: () => undefined, onMachine: () => undefined },
      }),
    ),
  );
const filtres = (f: Partial<FiltresCarte>): FiltresCarte => ({ ...FILTRES_CARTE_VIDES, ...f });

describe('carte « Lignes d’approche » : modèle', () => {
  it('branches par domaine parent ; hôte relié par l’adresse de résolution ; hôte isolé à part', () => {
    const p = petite();
    const m = construireModele(p.carte, 'parent');
    const sante = m.groupes.find((g) => g.libelle === 'exemple-sante.example')!;
    expect(sante.lignes.map((l) => l.etiquette).sort()).toEqual(
      ['calme', 'exemple-sante.example', 'extranet', 'mail', 'vpn'].sort(),
    );
    const vpn = sante.lignes.find((l) => l.etiquette === 'vpn')!;
    expect(vpn.hote?.id).toBe(p.hoteVpn.id);
    // Alertes du domaine et de son hôte, sans doublon ; machines reliées du domaine.
    expect(vpn.alertes.map((a) => a.id).sort()).toEqual([p.critique.id, p.surHote.id].sort());
    expect(vpn.machines.map((x) => x.nom)).toEqual(['srv-vpn-01.interne.invalid']);
    expect(m.groupes.find((g) => g.libelle === 'Hôtes sans domaine')!.lignes.map((l) => l.hote?.valeur)).toEqual([
      '198.51.100.20',
    ]);
    // Typosquatting et fuites : côté Internet ; alerte sans actif de la carte : à part.
    expect(m.internet.map((a) => a.id).sort()).toEqual([p.typo.id, p.fuite.id].sort());
    expect(m.sansActif.map((a) => a.id)).toEqual([p.orpheline.id]);
    expect(m.perimetres).toEqual(['Périmètre ALH fictif 1 (non relié)', 'Périmètre fictif A', 'Périmètre fictif B']);
  });

  it('regroupement par périmètre : un domaine relié non lisible n’est pas inventé, le nom complet est gardé', () => {
    const p = petite();
    const m = construireModele(p.carte, 'perimetre');
    expect(m.groupes.map((g) => g.libelle).sort()).toEqual(
      ['Périmètre ALH fictif 1 (non relié)', 'Périmètre fictif A', 'Périmètre fictif B'].sort(),
    );
    expect(m.groupes.find((g) => g.libelle === 'Périmètre fictif A')!.lignes.map((l) => l.etiquette)).toContain(
      'vpn.exemple-sante.example',
    );
  });

  it('libellé court sous la racine, nom complet sinon', () => {
    expect(etiquetteDomaine('vpn.exemple.example', 'exemple.example')).toBe('vpn');
    expect(etiquetteDomaine('exemple.example', 'exemple.example')).toBe('exemple.example');
    expect(etiquetteDomaine('autre.example', 'exemple.example')).toBe('autre.example');
    expect(etiquetteDomaine('vpn.exemple.example', null)).toBe('vpn.exemple.example');
  });
});

describe('carte « Lignes d’approche » : filtres', () => {
  const p = petite();
  const m = construireModele(p.carte, 'parent');
  const lignes = (f: Partial<FiltresCarte>) =>
    filtrerModele(m, filtres(f)).groupes.flatMap((g) => g.lignes.map((l) => l.etiquette));

  it('sans filtre : tout ; la branche critique d’abord, la ligne critique en tête', () => {
    const r = filtrerModele(m, FILTRES_CARTE_VIDES);
    expect(r.groupes[0]!.libelle).toBe('exemple-sante.example');
    expect(r.groupes[0]!.critique).toBe(true);
    expect(r.groupes[0]!.lignes[0]!.etiquette).toBe('vpn');
    expect(r.groupes[0]!.lignes[0]!.principale?.id).toBe(p.critique.id);
  });
  it('texte : domaine, adresse ou CVE', () => {
    expect(lignes({ texte: 'MAIL.' })).toEqual(['mail']);
    expect(lignes({ texte: '198.51.100.20' })).toEqual(['198.51.100.20']);
    expect(lignes({ texte: 'cve-2026-90014' })).toEqual(['vpn']);
  });
  it('criticité, type et « branches en alerte seulement »', () => {
    expect(lignes({ criticites: ['critical'], enAlerteSeulement: true })).toEqual(['vpn']);
    expect(lignes({ typeAlerte: 'config_defect', enAlerteSeulement: true })).toEqual(['extranet']);
    expect(lignes({ enAlerteSeulement: true }).sort()).toEqual(['extranet', 'mail', 'vpn'].sort());
    // Sans « en alerte seulement », une criticité non retenue laisse la ligne, sans alerte.
    const r = filtrerModele(m, filtres({ criticites: ['minor'] }));
    expect(r.groupes.flatMap((g) => g.lignes).find((l) => l.etiquette === 'mail')!.principale).toBeNull();
    // Les alertes côté Internet suivent aussi les filtres.
    expect(filtrerModele(m, filtres({ typeAlerte: 'typosquatting' })).internet.map((a) => a.id)).toEqual([p.typo.id]);
  });
  it('périmètre', () => {
    expect(lignes({ perimetre: 'Périmètre fictif B' })).toEqual(['exemple-labo.example']);
  });
});

describe('carte « Lignes d’approche » : repli et mise en page', () => {
  const p = petite();
  const f = filtrerModele(construireModele(p.carte, 'parent'), FILTRES_CARTE_VIDES);

  it('sous le seuil : tout est déplié par défaut (branches et lignes sans alerte)', () => {
    const e = replisParDefaut(f);
    expect([...e.groupes].sort()).toEqual(f.groupes.map((g) => g.cle).sort());
    const s = disposer(f, e, { peutModifier: true });
    expect(s.rangees.every((r) => r.type === 'ligne')).toBe(true);
    expect(s.lignesAffichees).toBe(f.groupes.reduce((n, g) => n + g.lignes.length, 0));
  });

  it('au-delà du seuil : seules les branches en alerte sont dépliées ; leurs lignes sans alerte en faisceau chiffré', () => {
    const fa = filtrerModele(construireModele(petiteAuDela().carte, 'parent'), FILTRES_CARTE_VIDES);
    const e = replisParDefaut(fa);
    expect([...e.groupes]).toEqual([fa.groupes[0]!.cle]);
    const s = disposer(fa, e, { peutModifier: true });
    const sante = s.groupes.find((g) => g.libelle === 'exemple-sante.example')!;
    expect(sante.deplie).toBe(true);
    expect(s.groupes.filter((g) => !g.deplie).map((g) => g.libelle)).toEqual(
      expect.arrayContaining(['exemple-labo.example', 'Hôtes sans domaine']),
    );
    const faisceaux = s.rangees.filter((r) => r.type === 'faisceau');
    // Faisceau des lignes calmes de la branche dépliée (calme, racine) et faisceau de chaque branche repliée.
    expect(faisceaux.find((r) => r.type === 'faisceau' && r.calmes)).toMatchObject({ lignes: 2 });
    expect(faisceaux.filter((r) => r.type === 'faisceau' && !r.calmes)).toHaveLength(2);
  });

  it('chemin d’entrée critique : tracé de l’Internet à la machine reliée', () => {
    const s = disposer(f, replisParDefaut(f), { peutModifier: true });
    const vpn = s.rangees.find((r) => r.type === 'ligne' && r.ligne.etiquette === 'vpn') as LigneDessinee;
    expect(vpn.ligne.critique).toBe(true);
    expect(vpn.machinesY).toHaveLength(1);
    const critiques = s.liens.filter((l) => l.critique).map((l) => l.cle);
    expect(critiques).toEqual(expect.arrayContaining([`o:${f.groupes[0]!.cle}`, `${vpn.cle}:g`, `${vpn.cle}:t`]));
    // Le tracé va jusqu'à la colonne des machines internes (abscisse X.machine).
    expect(s.liens.find((l) => l.cle === `${vpn.cle}:t`)!.d).toMatch(new RegExp(`L${X.machine} `));
    expect(s.liens.filter((l) => l.critique)).toHaveLength(3);
  });

  it('« à relier » : seulement pour qui peut modifier, jamais quand une machine illisible est reliée', () => {
    const ligne = (s: ReturnType<typeof disposer>, e: string) =>
      s.rangees.find((r) => r.type === 'ligne' && r.ligne.etiquette === e) as LigneDessinee;
    const s = disposer(f, replisParDefaut(f), { peutModifier: true });
    expect(ligne(s, 'mail').aRelier).toBe(true);
    expect(ligne(s, 'vpn').aRelier).toBe(false);
    expect(ligne(s, 'extranet').aRelier).toBe(false);
    const lecteur = disposer(f, replisParDefaut(f), { peutModifier: false });
    expect(lecteur.rangees.some((r) => r.type === 'ligne' && r.aRelier)).toBe(false);
  });

  it('bascules : une branche, ses lignes calmes ; une branche sans alerte se déplie sur ses lignes', () => {
    const cle = f.groupes[0]!.cle;
    // Repli par défaut au-delà du seuil : la branche en alerte dépliée, ses lignes calmes en faisceau.
    let e: ReturnType<typeof replisParDefaut> = { groupes: new Set([cle]), calmes: new Set() };
    e = basculerCalmes(e, cle);
    expect(
      disposer(f, e, { peutModifier: false }).rangees.filter((r) => r.groupe === cle && r.type === 'ligne'),
    ).toHaveLength(5);
    e = basculerGroupe(e, cle);
    expect(disposer(f, e, { peutModifier: false }).rangees.filter((r) => r.groupe === cle)).toHaveLength(1);
    const labo = f.groupes.find((g) => g.libelle === 'exemple-labo.example')!.cle;
    const d = disposer(f, basculerGroupe(toutReplier(), labo), { peutModifier: false });
    expect(d.rangees.filter((r) => r.groupe === labo).map((r) => r.type)).toEqual(['ligne']);
  });

  it('épaisseur d’un faisceau selon le nombre de lignes, bornée', () => {
    expect(epaisseurFaisceau(1)).toBeLessThan(epaisseurFaisceau(60));
    expect(epaisseurFaisceau(10_000)).toBe(14);
  });
});

describe('carte « Lignes d’approche » : grande échelle', () => {
  it('150 domaines et plus de 100 hôtes : quelques lignes par défaut, le reste en faisceaux chiffrés', () => {
    const c = grande(6, 25);
    expect(c.actifs.filter((a) => a.type === 'domaine').length).toBeGreaterThanOrEqual(150);
    expect(c.actifs.filter((a) => a.type === 'hote').length).toBeGreaterThan(100);
    const f = filtrerModele(construireModele(c, 'parent'), FILTRES_CARTE_VIDES);
    const s = disposer(f, replisParDefaut(f), { peutModifier: true });
    expect(s.lignesAffichees).toBeLessThan(30);
    expect(s.groupes.filter((g) => g.deplie)).toHaveLength(3);
    const repliee = s.rangees.find((r) => r.type === 'faisceau' && !r.calmes)!;
    expect(repliee.type === 'faisceau' && repliee.lignes).toBe(26);
  });

  it('« Tout déplier » borné : au-delà de LIGNES_MAX lignes, des branches restent en faisceau et c’est dit', () => {
    const f = filtrerModele(construireModele(grande(12, 40), 'parent'), FILTRES_CARTE_VIDES);
    const s = disposer(f, toutDeplier(f), { peutModifier: true });
    expect(s.lignesAffichees).toBeLessThanOrEqual(LIGNES_MAX);
    expect(s.replieesParBorne).toBeGreaterThan(0);
    expect(s.groupes.filter((g) => g.replieParBorne)).toHaveLength(s.replieesParBorne);
    const petite = filtrerModele(construireModele(grande(2, 10), 'parent'), FILTRES_CARTE_VIDES);
    expect(disposer(petite, toutDeplier(petite), { peutModifier: true }).replieesParBorne).toBe(0);
  });
});

describe('carte « Lignes d’approche » : la page elle-même (décision du RSSI du 19/11/2026)', () => {
  it('plus de caméra ni de zoom : la scène entière est la viewBox, la page défile', () => {
    for (const retire of ['cameraInitiale', 'zoomer', 'deplacer', 'recadrer', 'borner', 'RAPPORT', 'ZOOM_MIN'])
      expect(retire in carteSurface).toBe(false);
    const p = petite();
    const f = filtrerModele(construireModele(p.carte, 'parent'), FILTRES_CARTE_VIDES);
    const s = disposer(f, replisParDefaut(f), { peutModifier: true });
    const html = rendre(p.carte);
    const svg = html.match(/<svg[^>]*class="sc-svg"[^>]*>/i)![0];
    expect(svg).toContain(`viewBox="0 0 ${s.largeur} ${s.hauteur}"`);
    // Le dessin n'est plus une zone focalisable qui capte les flèches ; ses nœuds le sont.
    expect(svg).not.toMatch(/tabindex/i);
    expect(html).not.toContain('Vue d’ensemble');
    expect(html).not.toContain('Rapprocher (zoom avant)');
    expect(html).not.toContain('Recadrer');
    // Repères collants : la seule barre de la carte (décision du RSSI du 23/11/2026) avec son unique champ « Filtrer la
    // carte », le regroupement et les autres filtres dans son panneau, puis les titres des colonnes.
    const debut = html.indexOf('<div class="sc-collant">');
    const collant = html.slice(debut, html.indexOf('</svg>', html.indexOf('class="sc-entetes"')));
    expect(collant).toContain('Regrouper par');
    expect(collant).toContain('>Filtrer la carte<');
    expect(collant).toContain('placeholder="Nom, adresse, CVE, port…"');
    for (const t of ['>Périmètre<', '>Type d’alerte<', '>Criticité<', '>Branches en alerte seulement<'])
      expect(collant).toContain(t);
    // Un seul champ de filtre et une seule barre : plus de « Nom de domaine ou adresse IP », rien au-dessus de la barre.
    expect(html.split('>Filtrer la carte<')).toHaveLength(2);
    expect(html).not.toContain('Nom de domaine ou adresse IP');
    expect(html.match(/role="toolbar"/g)).toHaveLength(1);
    expect(html.slice(0, debut)).not.toContain('role="toolbar"');
    expect(collant).toMatch(/<svg[^>]*class="sc-entetes"/);
    for (const t of ['>Domaine parent<', '>Nom de domaine<', '>IP publique<', '>Service<', '>Limite du SI<'])
      expect(collant).toContain(t);
  });

  it('écran étroit : la même scène, empilée branche par branche, avec les mêmes noms accessibles', () => {
    const html = rendre(petite().carte);
    const pile = html.match(/<div class="sc-empile">[\s\S]*?<\/ol><\/li><\/ol>/i)![0];
    expect(pile).toContain('aria-label="Lignes d’approche, branche par branche"');
    expect(pile).toMatch(/aria-expanded="true"[^>]*aria-label="Replier la branche exemple-sante\.example/);
    expect(pile).toContain(
      'aria-label="Nom de domaine vpn.exemple-sante.example, résout vers 192.0.2.10, vu par AlgoLightHouse : ouvrir sa fiche"',
    );
    expect(pile).toContain('Machine interne (derrière la limite du SI)');
    expect(pile).toContain('srv-vpn-01.interne.invalid');
    // Les éléments propres à la présentation empilée n'ont aucun attribut de style (Mantine pose les siens à part).
    const propres = pile.match(/<(?:ol|li|div|span)[^>]*class="sc-pile[^"]*"[^>]*>/g) ?? [];
    expect(propres.length).toBeGreaterThan(5);
    for (const e of propres) expect(e).not.toMatch(/\sstyle=/i);
  });
});

describe('carte « Lignes d’approche » : rendu', () => {
  it('branches, faisceaux, chemin critique, « à relier », machine illisible sans nom ; aucun style en ligne', () => {
    const p = petite();
    const html = rendre(p.carte);
    // Le dessin (en-têtes, carte, légende) n'a aucun attribut de style ; Mantine pose les siens hors du dessin.
    const dessins = html.match(/<svg(?=[^>]*class="sc-)[\s\S]*?<\/svg>/gi) ?? [];
    expect(dessins.length).toBeGreaterThanOrEqual(3);
    for (const d of dessins) expect(d).not.toMatch(/\sstyle=/i);
    expect(html.match(/<ul class="sc-legende"[\s\S]*?<\/ul>/i)?.[0]).not.toMatch(/\sstyle=/i);
    expect(html).toMatch(/<svg[^>]*role="group"[^>]*aria-label="Carte des lignes d’approche/i);
    expect(html).toContain('exemple-sante.example');
    expect(rendre(petiteAuDela().carte)).toContain('lignes sans alerte');
    expect(html).toContain('sc-lien--critique');
    expect(html).toContain('Un actif exposé sur Internet porte une faille en priorité P1');
    expect(html).toContain('À relier à une machine interne (1 proposition à décider)');
    expect(html).toContain('Reliée à une machine que vous ne pouvez pas lire');
    expect(html).toContain('srv-vpn-01.interne.invalid');
    // Nœuds atteignables au clavier, avec un nom.
    expect(html).toMatch(/<g role="button" tabindex="0" aria-label="Nom de domaine vpn\.exemple-sante\.example/i);
    expect(html).toMatch(/aria-label="Critique \(2 alertes\), P1 : VPN SSL/i);
    // Typosquatting côté Internet ; boutons de zoom nommés ; légende avec formes et libellés.
    expect(html).toContain('exemp1e-sante.example');
    expect(html).toContain('Pointillé rouge : chemin d’entrée critique (P1)');
    // Regroupement par défaut confirmé par le RSSI (lot ALH5) : plus de mention « à confirmer ».
    expect(html).toContain('Regrouper par');
    expect(html).not.toContain('Choix par défaut à confirmer.');
  });

  it('sans droit de modifier : aucune marque « à relier »', () => {
    expect(rendre(petite().carte, false)).not.toContain('À relier à une machine interne');
  });

  it('carte vide et carte bornée : dit', () => {
    expect(
      rendre({ actifs: [], alertes: [], constatsSilene: [], tronquee: false, totaux: { actifs: 0, alertes: 0 } }),
    ).toContain('la carte est vide');
    const p = petite();
    expect(rendre({ ...p.carte, tronquee: true, totaux: { actifs: 5000, alertes: 7 } })).toContain(
      'Carte bornée : 8 actifs sur 5000',
    );
  });

  it('adresse de l’API et aide', () => {
    expect(URL_CARTE_SURFACE).toBe('/api/vulnerabilites/surface/carte');
    const aide = HELP_ARTICLES.find((a) => a.id === 'vulnerabilites-surface')!.steps.join(' ');
    expect(aide).toContain('lignes d’approche');
    expect(aide).toContain('à relier');
  });
});

/* ------------------------------------------------------------------ Lot SI2 */
const service = (port: number, protocole: 'tcp' | 'udp' | null, extra: Partial<ServiceAlhDto> = {}): ServiceAlhDto => ({
  port,
  protocole,
  nom: null,
  produit: null,
  version: null,
  editeur: null,
  cpe: null,
  statutVersion: null,
  ...extra,
});
const vuParSilene = (v: Partial<SileneCarteDto>): SileneCarteDto => ({
  adresses: [],
  ports: [],
  nombrePorts: 0,
  portsOuverts: null,
  constats: [],
  nombreConstats: 0,
  ...v,
});
const filtrer = (c: CarteSurfaceDto, r: Regroupement, f: Partial<FiltresCarte> = {}) =>
  filtrerModele(construireModele(c, r), filtres(f));
const lignesDe = (m: ModeleFiltre) => m.groupes.flatMap((g) => g.lignes);
const ligneDe = (m: ModeleFiltre, ip: string) => lignesDe(m).find((l) => l.adresse === ip && !l.renvoi)!;

/** Deux sources : l'hôte 192.0.2.10 vu par AlgoLightHouse (service 443 porté par une alerte) et par Silène (ports 22 et
    443, un constat sur le port 443) ; www.example.org vu par les deux ; 203.0.113.30 et vpn.example.org vus par Silène
    seul ; 198.51.100.20 porté par deux noms de deux branches (renvoi). */
function deuxSources() {
  const constat = { id: id(7001), identifiant: 'RES-FICTIF-0001', controle: 'OpenPort', classe: 2 };
  const autre = { id: id(7002), identifiant: 'RES-FICTIF-0002', controle: 'SelfSignedCertificate', classe: 1 };
  const hote = actif({
    type: 'hote',
    valeur: '192.0.2.10',
    niveau: null,
    sources: ['alh', 'silene'],
    services: [service(443, null, { nom: 'https', produit: 'nginx', version: '1.18' })],
    nombreServices: 1,
    silene: vuParSilene({
      adresses: ['192.0.2.10'],
      ports: [
        { port: 22, protocole: 'tcp', service: 'ssh', produit: 'FictionalSSH', tunnel: null },
        { port: 443, protocole: 'tcp', service: 'https', produit: 'Fictional httpd', tunnel: 'ssl' },
      ],
      nombrePorts: 2,
      portsOuverts: 2,
      constats: [
        { id: constat.id, ports: [{ port: 443, protocole: 'tcp' }] },
        { id: autre.id, ports: [] },
      ],
      nombreConstats: 2,
    }),
  });
  const www = actif({
    valeur: 'www.example.org',
    adresse: '192.0.2.10',
    sources: ['alh', 'silene'],
    silene: vuParSilene({ adresses: ['192.0.2.10'] }),
  });
  const api = actif({ valeur: 'api.example.org', adresse: '192.0.2.10' });
  const seulHote = actif({
    id: id(8001),
    alhId: null,
    type: 'hote',
    valeur: '203.0.113.30',
    niveau: null,
    sources: ['silene'],
    silene: vuParSilene({
      adresses: ['203.0.113.30'],
      ports: [{ port: 443, protocole: 'tcp', service: 'https', produit: null, tunnel: null }],
      nombrePorts: 1,
    }),
  });
  const seulNom = actif({
    id: id(8002),
    alhId: null,
    valeur: 'vpn.example.org',
    adresse: '203.0.113.30',
    niveau: null,
    sources: ['silene'],
    silene: vuParSilene({ adresses: ['203.0.113.30'] }),
  });
  const partage = actif({
    type: 'hote',
    valeur: '198.51.100.20',
    niveau: null,
    services: [service(25, 'tcp')],
    nombreServices: 1,
  });
  const mailA = actif({ valeur: 'mail.example.org', adresse: '198.51.100.20' });
  const mailB = actif({ valeur: 'mail.exemple-b.example', adresse: '198.51.100.20' });
  const surHote = alerte({ criticite: 'major', titre: 'Service exposé', actifId: hote.id });
  const surPartage = alerte({ criticite: 'minor', titre: 'Messagerie exposée', actifId: partage.id });
  const carte: CarteSurfaceDto = {
    actifs: [hote, www, api, seulHote, seulNom, partage, mailA, mailB],
    alertes: [surHote, surPartage],
    constatsSilene: [constat, autre],
    tronquee: false,
    totaux: { actifs: 8, alertes: 2 },
  };
  return { carte, hote, www, api, seulHote, seulNom, partage, mailA, mailB, constat, autre };
}

describe('lot SI2 : deux sources', () => {
  it('un actif vu par les deux est un seul nœud ; services réunis sans doublon port/protocole, source de chacun', () => {
    const d = deuxSources();
    const m = filtrer(d.carte, 'parent');
    const l = ligneDe(m, '192.0.2.10');
    expect(lignesDe(m).filter((x) => x.hote?.id === d.hote.id && !x.renvoi)).toHaveLength(1);
    expect(l.sources).toEqual(['alh', 'silene']);
    expect(l.domaines.map((x) => x.valeur)).toEqual(['api.example.org', 'www.example.org']);
    // 443 sans protocole chez AlgoLightHouse rejoint le 443/tcp de Silène : deux services, pas trois.
    expect(l.ports.map((p) => `${p.port}/${p.protocole}`)).toEqual(['22/tcp', '443/tcp']);
    expect(l.nombreServices).toBe(2);
    const https = serviceDessine(l, l.ports[1]!);
    expect(https).toMatchObject({
      libelle: '443/tcp · HTTPS',
      produit: 'Fictional httpd, tunnel ssl',
      sources: ['alh', 'silene'],
    });
    expect(https.nom).toBe(
      'Service 443/tcp · HTTPS, Fictional httpd, tunnel ssl, vu par AlgoLightHouse et Silène (ANSSI), 1 constat Silène sur ce port',
    );
    expect(serviceDessine(l, l.ports[0]!).sources).toEqual(['silene']);
  });

  it('constats Silène : sur l’hôte et sur le port, comptés, sans priorité ni confusion avec les alertes', () => {
    const d = deuxSources();
    const l = ligneDe(filtrer(d.carte, 'parent'), '192.0.2.10');
    expect(l.nombreConstats).toBe(2);
    expect(constatsDuPort(l, { port: 443, protocole: 'tcp' }).map((c) => c.constat.id)).toEqual([d.constat.id]);
    expect(constatsDuPort(l, { port: 22, protocole: 'tcp' })).toEqual([]);
    expect(constatsDeLaCarte(d.carte, d.hote, null).map((c) => c.controle)).toEqual([
      'OpenPort',
      'SelfSignedCertificate',
    ]);
    expect(constatsDeLaCarte(d.carte, d.hote, { port: 443, protocole: 'tcp' }).map((c) => c.id)).toEqual([
      d.constat.id,
    ]);
    // Les alertes de la ligne sont celles d'AlgoLightHouse seulement : un constat n'est jamais une alerte.
    expect(l.alertes.map((a) => a.titre)).toEqual(['Service exposé']);
    const html = rendre(d.carte);
    expect(html).toContain('aria-label="2 constats Silène sur 192.0.2.10, sans priorité : les voir"');
    expect(html).toContain(
      'aria-label="1 constat Silène sur le port 443/tcp · HTTPS de 192.0.2.10, sans priorité : les voir"',
    );
    expect(html).toContain(
      'aria-label="IP publique 192.0.2.10, vu par AlgoLightHouse et Silène (ANSSI), 2 services connus : ouvrir sa fiche"',
    );
    expect(html).toMatch(/class="sc-constats"/);
    expect(html).toContain('>2 SIL<');
    // Pastilles dessinées : formes et monogrammes du lot L1.
    expect(html).toMatch(/<g class="ps ps--sarcelle" transform="translate\([0-9. ]+\) scale\(0\.5\)">/);
    expect(html).toContain('>SIL<');
    expect(html).toContain('>ALH<');
  });

  it('actif vu par Silène seul : présent, sans liaison possible ; domaine parent déduit', () => {
    const d = deuxSources();
    const m = filtrer(d.carte, 'parent');
    const l = ligneDe(m, '203.0.113.30');
    expect(l.sources).toEqual(['silene']);
    expect(l.reliable).toBe(false);
    expect(l.domaines.map((x) => x.valeur)).toEqual(['vpn.example.org']);
    // vpn.example.org n'a pas de parent chez Silène : il rejoint la branche example.org (deux derniers niveaux).
    expect(m.groupes.find((g) => g.lignes.includes(l))!.libelle).toBe('example.org');
    expect(parentDeduit('a.b.example.org', new Set(['b.example.org']))).toBe('b.example.org');
    expect(parentDeduit('www.example.org', new Set())).toBe('example.org');
    expect(parentDeduit('example.org', new Set())).toBe('example.org');
    const s = disposer(m, toutDeplier(m), { peutModifier: true });
    const r = s.rangees.find((x): x is LigneDessinee => x.type === 'ligne' && x.ligne === l)!;
    expect(r.aRelier).toBe(false);
    expect(rendre(d.carte)).toContain(
      'aria-label="Nom de domaine vpn.example.org, résout vers 203.0.113.30, vu par Silène (ANSSI) : ouvrir sa fiche"',
    );
  });
});

describe('lot SI2 : noms d’une même adresse et renvoi', () => {
  it('par nom de domaine : deux noms d’une branche vers une adresse rejoignent un seul nœud d’adresse', () => {
    const d = deuxSources();
    const m = filtrer(d.carte, 'parent');
    const s = disposer(m, toutDeplier(m), { peutModifier: true });
    const r = s.rangees.find((x): x is LigneDessinee => x.type === 'ligne' && x.ligne.adresse === '192.0.2.10')!;
    expect(r.domainesY).toEqual([r.y, r.y + DOMAINE_H]);
    // Le second nom rejoint l'adresse par une courbe ; un seul trait de l'adresse vers les services.
    expect(s.liens.find((x) => x.cle === `${r.cle}:d1`)!.d).toMatch(new RegExp(`C.* ${X.hote - 6} ${r.y}$`));
    expect(s.liens.filter((x) => x.cle.startsWith(`${r.cle}:t`))).toHaveLength(1);
    // La courbe part après la colonne des noms : elle ne traverse aucun libellé de nom (32 caractères au plus).
    expect(s.liens.find((x) => x.cle === `${r.cle}:d1`)!.d).toContain(`L${X.hote - 56} ${r.y + DOMAINE_H} C`);
    expect(X.hote - 56).toBeGreaterThan(X.domaine + (32 * 6.4) / 2);
  });

  it('adresse déjà tracée dans une autre branche : renvoi explicite, services et alertes de l’hôte non répétés', () => {
    const d = deuxSources();
    const m = filtrer(d.carte, 'parent');
    const portees = lignesDe(m).filter((l) => l.adresse === '198.51.100.20');
    expect(portees).toHaveLength(2);
    const [porteur, renvoi] = [portees.find((l) => !l.renvoi)!, portees.find((l) => l.renvoi)!];
    expect(renvoi.renvoi).toMatchObject({ cle: porteur.cle });
    expect(porteur.ports.map((p) => p.port)).toEqual([25]);
    expect(renvoi.ports).toEqual([]);
    expect(renvoi.alertes).toEqual([]);
    // Résumé : le service de l'adresse n'est compté qu'une fois.
    const total = lignesDe(m)
      .filter((l) => l.adresse === '198.51.100.20')
      .reduce((n, l) => n + l.nombreServices, 0);
    expect(total).toBe(1);
    // Aller à la ligne qui porte l'adresse : sa branche se déplie.
    const g = m.groupes.find((x) => x.lignes.includes(porteur))!;
    expect(deplierVers(m, toutReplier(), porteur.cle).groupes.has(g.cle)).toBe(true);
    expect(rendre(d.carte)).toContain(
      `aria-label="Adresse IP 198.51.100.20, déjà tracée sous la branche ${porteur.renvoi?.libelle ?? g.libelle} avec ses services, ses alertes et ses machines : y aller"`,
    );
  });

  it('par adresse IP : la branche est l’adresse, ses noms, ses services une fois, puis la limite et les machines', () => {
    const d = deuxSources();
    const m = filtrer(d.carte, 'adresse');
    const g = m.groupes.find((x) => x.libelle === '198.51.100.20')!;
    expect(g.lignes).toHaveLength(1);
    expect(g.lignes[0]!.domaines.map((x) => x.valeur)).toEqual(['mail.example.org', 'mail.exemple-b.example']);
    expect(g.lignes[0]!.ports.map((p) => p.port)).toEqual([25]);
    expect(lignesDe(m).some((l) => l.renvoi)).toBe(false);
    expect(m.groupes.map((x) => x.libelle).sort()).toEqual(['192.0.2.10', '198.51.100.20', '203.0.113.30']);
    // Le titre de la colonne de branche suit le regroupement.
    expect(rendreRegroupe(d.carte, 'adresse')).toContain('>Adresse IP publique<');
  });
});

describe('filtre de la carte, un seul champ (lot SI2, fusion décidée par le RSSI le 23/11/2026)', () => {
  it('partie du nom, casse ignorée ; seuls les noms qui correspondent restent, les autres comptés', () => {
    const d = deuxSources();
    for (const r of ['parent', 'adresse'] as const) {
      const m = filtrer(d.carte, r, { texte: 'WWW.Example' });
      expect(lignesDe(m).flatMap((l) => l.domaines.map((x) => x.valeur))).toEqual(['www.example.org']);
      expect(lignesDe(m)[0]!.domainesMasques).toBe(1);
      expect(m.correspondances).toEqual({ domaines: 1, adresses: 1 });
    }
  });
  it('début d’adresse IP : toute la ligne, tous ses noms ; aucune expression régulière construite', () => {
    const d = deuxSources();
    const m = filtrer(d.carte, 'parent', { texte: '192.0.2.' });
    expect(lignesDe(m).map((l) => l.adresse)).toEqual(['192.0.2.10']);
    expect(lignesDe(m)[0]!.domaines).toHaveLength(2);
    expect(lignesDe(m)[0]!.domainesMasques).toBe(0);
    // Saisie prise à la lettre : « .* » ne correspond à rien.
    expect(lignesDe(filtrer(d.carte, 'parent', { texte: '.*' }))).toEqual([]);
    // « 0.2.10 » n'est pas un début d'adresse : la ligne reste (son adresse le contient), mais seuls les noms qui le
    // contiennent sont gardés ; « 192.0.2. » en est un : tous les noms restent.
    const l = {
      domaines: [actif({ valeur: 'srv-0.2.10.example.org' }), actif({ valeur: 'www.example.org' })],
      adresse: '192.0.2.10',
      hote: null,
      ports: [],
    };
    expect(filtreTexte(l, [], '0.2.10')).toEqual({ domaines: [l.domaines[0]], masques: 1 });
    expect(filtreTexte(l, [], '192.0.2.')).toEqual({ domaines: l.domaines, masques: 0 });
    expect(filtreTexte({ ...l, domaines: [] }, [], '0.2.10')).toEqual({ domaines: [], masques: 0 });
    expect(filtreTexte(l, [], '0.2.11')).toBeNull();
    // S'ajoute aux autres filtres : seule l'adresse en alerte reste, avec le renvoi de l'autre branche vers elle.
    const enAlerte = lignesDe(filtrer(d.carte, 'parent', { texte: 'mail', enAlerteSeulement: true }));
    expect(enAlerte.map((l) => l.adresse)).toEqual(['198.51.100.20', '198.51.100.20']);
    expect(enAlerte.filter((l) => l.renvoi)).toHaveLength(1);
    expect(lignesDe(filtrer(d.carte, 'parent', { texte: 'vpn', enAlerteSeulement: true }))).toEqual([]);
  });
  it('CVE d’une alerte retenue ou service : la ligne entière, sans réduire ses noms', () => {
    const d = deuxSources();
    // Port et protocole, puis produit (Silène) : 192.0.2.10 et ses deux noms.
    for (const texte of ['22/tcp', 'fictionalssh']) {
      const m = filtrer(d.carte, 'parent', { texte });
      expect(lignesDe(m).map((l) => l.adresse)).toEqual(['192.0.2.10']);
      const noms = lignesDe(m)[0]!.domaines.map((x) => x.valeur);
      expect(noms.sort()).toEqual(['api.example.org', 'www.example.org']);
      expect(lignesDe(m)[0]!.domainesMasques).toBe(0);
      expect(m.correspondances).toEqual({ domaines: 2, adresses: 1 });
    }
    // CVE d'une alerte de l'hôte : retenue tant que l'alerte l'est (criticité), sans réduire les noms.
    const avecCve: CarteSurfaceDto = {
      ...d.carte,
      alertes: d.carte.alertes.map((a) => (a.actifId === d.hote.id ? { ...a, cves: ['CVE-2026-90021'] } : a)),
    };
    const parCve = filtrer(avecCve, 'parent', { texte: 'cve-2026-90021' });
    expect(lignesDe(parCve).map((l) => l.adresse)).toEqual(['192.0.2.10']);
    expect(lignesDe(parCve)[0]!.domaines).toHaveLength(2);
    expect(lignesDe(filtrer(avecCve, 'parent', { texte: 'cve-2026-90021', criticites: ['minor'] }))).toEqual([]);
  });
  it('nombre de résultats annoncé dans la barre collante, bouton d’effacement, texte gardé par la vue', () => {
    expect(annonceFiltre('', { domaines: 3, adresses: 2 })).toBe('');
    expect(annonceFiltre(' mail ', { domaines: 2, adresses: 1 })).toBe(
      '2 noms de domaine et 1 adresse IP correspondent à « mail ».',
    );
    expect(annonceFiltre('zz', { domaines: 0, adresses: 0 })).toBe(
      'Aucun nom de domaine ni aucune adresse IP ne correspond à « zz ».',
    );
    const html = rendre(deuxSources().carte);
    const annonce = html.match(/<p[^>]*sc-annonce[^>]*>/)![0];
    expect(annonce).toContain('role="status"');
    expect(annonce).toContain('aria-live="polite"');
    expect(html.indexOf(annonce)).toBeGreaterThan(html.indexOf('<div class="sc-collant">'));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*>Effacer le filtre</);
    expect(html).not.toContain('Effacer le filtre par nom');
    // Le texte du champ est tenu par la vue de la carte (gardée par l'écran pendant la navigation dans la page).
    const tenue = rendreVue(deuxSources().carte, {
      regroupement: 'parent',
      filtres: { ...FILTRES_CARTE_VIDES, texte: 'www' },
      replis: {},
    });
    expect(tenue).toMatch(/<input[^>]*value="www"/);
    expect(tenue).toContain('1 nom de domaine et 1 adresse IP correspondent à « www ».');
    expect(tenue).toContain('>Effacer le filtre<');
    expect(tenue).not.toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*>Effacer le filtre</);
  });
});

/** Fabrique du jeu de grande taille (essai du lot SI2, rien n'est commité d'autre) : `noms` noms de domaine sous
    `racines` domaines parents, répartis sur `adresses` adresses (plusieurs noms par adresse), `services` services
    répartis sur les hôtes (une source ou l'autre ou les deux), une alerte pour un hôte sur six, des constats Silène. */
export function grandeEchelle(noms = 150, adresses = 60, services = 200, racines = 8): CarteSurfaceDto {
  const actifs: ActifCarteDto[] = [];
  const alertes: AlerteCarteDto[] = [];
  const ip = (i: number) => ['192.0.2', '198.51.100', '203.0.113'][i % 3] + `.${10 + Math.floor(i / 3)}`;
  const parents = Array.from({ length: racines }, (_, r) => actif({ valeur: `exemple-${r}.example` }));
  actifs.push(...parents);
  const hotes = Array.from({ length: adresses }, (_, i) => {
    const deux = i % 3 === 0;
    const n = Math.floor(services / adresses) + (i < services % adresses ? 1 : 0);
    const ports = Array.from({ length: n }, (_, k) => 1000 + k * 7 + i);
    return actif({
      type: 'hote',
      valeur: ip(i),
      niveau: null,
      ...(i % 3 === 2
        ? { alhId: null, sources: ['silene'] as const }
        : { sources: deux ? ['alh', 'silene'] : ['alh'] }),
      // AlgoLightHouse seul : tous les ports ; deux sources : un sur deux chez AlgoLightHouse, tous chez Silène.
      services:
        i % 3 === 2 ? [] : ports.filter((_, k) => !deux || k % 2 === 0).map((p) => service(p, 'tcp', { nom: 'http' })),
      nombreServices: i % 3 === 2 ? 0 : ports.filter((_, k) => !deux || k % 2 === 0).length,
      silene:
        i % 3 === 0 || i % 3 === 2
          ? vuParSilene({
              adresses: [ip(i)],
              ports: ports.map((p) => ({
                port: p,
                protocole: 'tcp' as const,
                service: 'http',
                produit: null,
                tunnel: null,
              })),
              nombrePorts: ports.length,
              constats: i % 5 === 0 ? [{ id: id(90000 + i), ports: [{ port: ports[0]!, protocole: 'tcp' }] }] : [],
              nombreConstats: i % 5 === 0 ? 1 : 0,
            })
          : null,
    } as Partial<ActifCarteDto>);
  });
  actifs.push(...hotes);
  for (let i = 0; i < noms; i++) {
    const r = parents[i % racines]!;
    actifs.push(
      actif({
        valeur: `service-${String(i).padStart(3, '0')}-portail.${r.valeur}`,
        adresse: ip(i % adresses),
        parentId: r.id,
        perimetreNom: `Périmètre fictif ${i % 4}`,
      }),
    );
  }
  hotes.forEach((h, i) => {
    if (i % 6 === 0) alertes.push(alerte({ actifId: h.id, criticite: i % 12 === 0 ? 'critical' : 'minor' }));
  });
  return {
    actifs,
    alertes,
    constatsSilene: hotes.flatMap((_, i) =>
      i % 5 === 0 ? [{ id: id(90000 + i), identifiant: `RES-FICTIF-${i}`, controle: 'OpenPort', classe: 2 }] : [],
    ),
    tronquee: false,
    totaux: { actifs: actifs.length, alertes: alertes.length },
  };
}

describe('lot SI2 : grande échelle (150 noms, 60 adresses, 200 services)', () => {
  const c = grandeEchelle();
  it('jeu conforme : 150 noms, 60 adresses, 200 services réunis', () => {
    expect(c.actifs.filter((a) => a.type === 'domaine' && a.parentId)).toHaveLength(150);
    const m = filtrer(c, 'adresse');
    expect(m.groupes.filter((g) => g.lignes[0]!.hote)).toHaveLength(60);
    expect(lignesDe(m).reduce((n, l) => n + l.ports.length, 0)).toBe(200);
  });
  for (const r of ['parent', 'adresse'] as const)
    it(`regroupement « ${r} » : replié par défaut, borné, sans service dupliqué, calcul rapide`, () => {
      const debut = performance.now();
      const m = filtrer(c, r);
      const s = disposer(m, replisParDefaut(m), { peutModifier: true });
      const duree = performance.now() - debut;
      expect(duree).toBeLessThan(500);
      expect(s.lignesAffichees).toBeLessThanOrEqual(LIGNES_MAX);
      expect(s.groupes.filter((g) => g.deplie).length).toBeLessThanOrEqual(SEUIL_DEPLIE.branches);
      expect(s.groupes.filter((g) => !g.deplie).length).toBeGreaterThan(0);
      // Chaque adresse ne porte ses services qu'une fois (renvois exclus).
      const porteurs = lignesDe(m).filter((l): l is LigneFiltree => !!l.hote && !l.renvoi);
      expect(new Set(porteurs.map((l) => l.adresse)).size).toBe(porteurs.length);
      expect(porteurs.reduce((n, l) => n + l.ports.length, 0)).toBe(200);
      // Tout déplier reste borné ; le filtre de la carte, sur une partie d'un nom, réduit à quelques lignes.
      const tout = disposer(m, toutDeplier(m), { peutModifier: true });
      expect(tout.lignesAffichees).toBeLessThanOrEqual(LIGNES_MAX);
      expect(lignesDe(filtrer(c, r, { texte: 'service-007' })).flatMap((l) => l.domaines)).toHaveLength(1);
    });
});

const rendreVue = (carte: CarteSurfaceDto, vue: VueCarte) =>
  renderToStaticMarkup(
    createElement(
      MantineProvider,
      null,
      createElement(CarteSurface, {
        carte,
        peutModifier: true,
        vue,
        onVue: () => undefined,
        actions: { onAlerte: () => undefined, onActif: () => undefined, onMachine: () => undefined },
      }),
    ),
  );
const rendreRegroupe = (carte: CarteSurfaceDto, regroupement: Regroupement) =>
  rendreVue(carte, { regroupement, filtres: FILTRES_CARTE_VIDES, replis: {} });

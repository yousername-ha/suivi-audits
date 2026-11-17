/* Module Vulnérabilités (ADR 0100, lot ALH4) : carte « Lignes d'approche » de la surface externe, côté interface. Modèle
   (branches par domaine parent ou par périmètre, hôte relié par l'adresse de résolution, typosquatting et fuites côté
   Internet), filtres, repli par défaut des branches sans alerte, faisceaux, borne d'affichage à grande échelle (150
   domaines et plus), chemin d'entrée critique (P1), « à relier » réservé à qui peut modifier, machine illisible jamais
   nommée, caméra (zoom, déplacement, recadrage) et rendu sans style en ligne. Données entièrement fictives : domaines en
   .example, adresses de 192.0.2.0/24 et 198.51.100.0/24, machines inventées. */
import { MantineProvider } from '@mantine/core';
import type { ActifCarteDto, AlerteCarteDto, CarteSurfaceDto } from '@suivi/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { CarteSurface } from '../src/vulnerabilites/CarteSurface';
import {
  basculerCalmes,
  basculerGroupe,
  borner,
  cameraInitiale,
  construireModele,
  deplacer,
  disposer,
  epaisseurFaisceau,
  etiquetteDomaine,
  FILTRES_CARTE_VIDES,
  type FiltresCarte,
  filtrerModele,
  hauteurCamera,
  LIGNES_MAX,
  type LigneDessinee,
  RAPPORT,
  recadrer,
  replisParDefaut,
  toutDeplier,
  toutReplier,
  ZOOM_MIN,
  zoomer,
} from '../src/vulnerabilites/carte-surface';
import { URL_CARTE_SURFACE } from '../src/vulnerabilites/surface';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let n = 0;
const actif = (v: Partial<ActifCarteDto>): ActifCarteDto => ({
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
  return { actifs, alertes, tronquee: false, totaux: { actifs: actifs.length, alertes: alertes.length } };
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

  it('par défaut : seules les branches en alerte sont dépliées ; leurs lignes sans alerte en faisceau chiffré', () => {
    const e = replisParDefaut(f);
    expect([...e.groupes]).toEqual([f.groupes[0]!.cle]);
    const s = disposer(f, e, { peutModifier: true });
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
    expect(s.liens.find((l) => l.cle === `${vpn.cle}:t`)!.d).toMatch(/L944 /);
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
    let e = replisParDefaut(f);
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

describe('carte « Lignes d’approche » : caméra', () => {
  const scene = { largeur: 1176, hauteur: 3000 };
  it('vue de départ : toute la largeur ; rapport constant', () => {
    const c = cameraInitiale(scene);
    expect(c).toEqual({ x: 0, y: 0, w: 1176 });
    expect(hauteurCamera(c)).toBeCloseTo(1176 * RAPPORT);
  });
  it('zoom borné autour d’un point ; déplacement borné ; recadrer montre tout', () => {
    const c = cameraInitiale(scene);
    const proche = zoomer(c, 0.5, scene, { x: 588, y: 300 });
    expect(proche.w).toBe(588);
    expect(proche.x).toBeCloseTo(294);
    expect(zoomer(proche, 0.01, scene).w).toBe(ZOOM_MIN);
    expect(deplacer(c, -10_000, -10_000, scene)).toMatchObject({ x: -588, y: (-c.w * RAPPORT) / 2 });
    const tout = recadrer(scene);
    expect(hauteurCamera(tout)).toBeGreaterThanOrEqual(3000);
    expect(borner({ x: 0, y: 0, w: 1e9 }, scene).w).toBeLessThan(1e9);
  });
});

describe('carte « Lignes d’approche » : rendu', () => {
  it('branches, faisceaux, chemin critique, « à relier », machine illisible sans nom ; aucun style en ligne', () => {
    const p = petite();
    const html = rendre(p.carte);
    // Le dessin (carte, vue d'ensemble, légende) n'a aucun attribut de style ; Mantine pose les siens hors du dessin.
    const dessins = html.match(/<svg(?=[^>]*class="sc-)[\s\S]*?<\/svg>/gi) ?? [];
    expect(dessins.length).toBeGreaterThanOrEqual(3);
    for (const d of dessins) expect(d).not.toMatch(/\sstyle=/i);
    expect(html.match(/<ul class="sc-legende"[\s\S]*?<\/ul>/i)?.[0]).not.toMatch(/\sstyle=/i);
    expect(html).toMatch(/<svg[^>]*role="group"[^>]*aria-label="Carte des lignes d’approche/i);
    expect(html).toContain('exemple-sante.example');
    expect(html).toContain('lignes sans alerte');
    expect(html).toContain('sc-lien--critique');
    expect(html).toContain('Un actif exposé sur Internet porte une faille exploitée');
    expect(html).toContain('À relier à une machine interne (1 proposition à décider)');
    expect(html).toContain('Reliée à une machine que vous ne pouvez pas lire');
    expect(html).toContain('srv-vpn-01.interne.invalid');
    // Nœuds atteignables au clavier, avec un nom.
    expect(html).toMatch(/<g role="button" tabindex="0" aria-label="Domaine vpn\.exemple-sante\.example/i);
    expect(html).toMatch(/aria-label="Critique \(2 alertes\), P1 : VPN SSL/i);
    // Typosquatting côté Internet ; boutons de zoom nommés ; légende avec formes et libellés.
    expect(html).toContain('exemp1e-sante.example');
    expect(html).toContain('aria-label="Rapprocher (zoom avant)"');
    expect(html).toContain('aria-label="Recadrer : toute la carte"');
    expect(html).toContain('Pointillé rouge : chemin d’entrée critique (P1)');
    expect(html).toContain('Choix par défaut à confirmer.');
  });

  it('sans droit de modifier : aucune marque « à relier »', () => {
    expect(rendre(petite().carte, false)).not.toContain('À relier à une machine interne');
  });

  it('carte vide et carte bornée : dit', () => {
    expect(rendre({ actifs: [], alertes: [], tronquee: false, totaux: { actifs: 0, alertes: 0 } })).toContain(
      'la carte est vide',
    );
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

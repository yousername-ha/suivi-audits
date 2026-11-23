/* Module Vulnérabilités (ADR 0100, lot ALH6) : services exposés côté interface. Colonne « Service » de la carte entre
   « IP publique » et « Alerte ouverte », libellés exacts (« 443/tcp · HTTPS » puis « nginx 1.18 »), « port non communiqué »
   pour un actif en alerte sans port connu, nombre de services dans les faisceaux, filtre par port et par produit, libellés
   du typosquatting et des fuites hors des traits et non tronqués ; onglet « Actifs » et fiche d'un actif ; limite « seuls
   les services portés par une alerte sont connus » dite dans la légende, l'aide et les écrans. Données entièrement
   fictives : domaines en .example, adresses de 192.0.2.0/24 et 198.51.100.0/24. */
import { MantineProvider } from '@mantine/core';
import type {
  ActifAlhDto,
  ActifCarteDto,
  AlerteCarteDto,
  CarteSurfaceDto,
  ServiceAlhDto,
  ServiceExposeDto,
} from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { CarteSurface } from '../src/vulnerabilites/CarteSurface';
import {
  COLONNES,
  construireModele,
  couperLibelle,
  disposer,
  FILTRES_CARTE_VIDES,
  filtrerModele,
  INTERNET_CARACTERES,
  INTERNET_INTERLIGNE,
  type LigneDessinee,
  libelleResume,
  serviceAbsent,
  serviceDessine,
  toutDeplier,
  X,
  yInternet,
} from '../src/vulnerabilites/carte-surface';
import { ActifsAlhTable, LIMITE_SERVICES, ServicesActif } from '../src/vulnerabilites/SurfaceExterne';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let n = 0;
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
const HTTPS = service(443, 'tcp', { nom: 'https', produit: 'nginx', version: '1.18' });
const actif = (v: Partial<ActifCarteDto>): ActifCarteDto => {
  const a = base(v);
  return 'alhId' in v ? a : { ...a, alhId: a.id };
};
const base = (v: Partial<ActifCarteDto>): ActifCarteDto => ({
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
  type: 'exposed_service',
  criticite: 'major',
  titre: 'Alerte fictive',
  cves: [],
  priorite: null,
  cible: null,
  actifId: null,
  ...v,
});

/** Une racine, un domaine long (plus de 30 caractères) qui résout vers un hôte porteur de services, un domaine en alerte
    sans port connu, un domaine calme avec un service, une alerte de typosquatting au nom long. */
function surface() {
  const racine = actif({ valeur: 'exemple-sante.example' });
  const portail = actif({
    valeur: 'portail-patients-consultations.exemple-sante.example',
    adresse: '192.0.2.10',
    parentId: racine.id,
  });
  const hote = actif({
    type: 'hote',
    valeur: '192.0.2.10',
    niveau: null,
    services: [HTTPS, service(22, 'tcp', { nom: 'ssh', produit: 'OpenSSH', version: '9.6' })],
    nombreServices: 3,
  });
  const vpn = actif({ valeur: 'vpn.exemple-sante.example', adresse: '192.0.2.11', parentId: racine.id });
  const calme = actif({
    valeur: 'calme.exemple-sante.example',
    parentId: racine.id,
    services: [service(8443, null, { produit: 'nginx' })],
    nombreServices: 1,
  });
  const v6 = actif({ type: 'hote', valeur: '2001:db8:4000:1200:8000:0:aa:12', niveau: null });
  const carte: CarteSurfaceDto = {
    actifs: [racine, portail, hote, vpn, calme, v6],
    alertes: [
      alerte({ criticite: 'critical', titre: 'Service vulnérable', actifId: portail.id }),
      alerte({ criticite: 'important', titre: 'VPN exposé', actifId: vpn.id }),
      alerte({ criticite: 'minor', titre: 'Hôte IPv6 exposé', actifId: v6.id }),
      alerte({
        type: 'typosquatting',
        titre: 'Domaine ressemblant',
        cible: { type: 'domain', valeur: 'portail-patients-consultations-exemp1e.example' },
      }),
      alerte({ type: 'data_leak', titre: 'Identifiants divulgués de la messagerie' }),
    ],
    constatsSilene: [],
    tronquee: false,
    totaux: { actifs: 6, alertes: 5 },
  };
  return { carte, portail, vpn, calme };
}
const rendre = (e: ReactElement) => renderToStaticMarkup(createElement(MantineProvider, null, e));
const rendreCarte = (carte: CarteSurfaceDto) =>
  rendre(
    createElement(CarteSurface, {
      carte,
      peutModifier: true,
      actions: { onAlerte: () => undefined, onActif: () => undefined, onMachine: () => undefined },
    }),
  );

describe('carte : colonne « Service »', () => {
  it('entre « IP publique » et « Alerte ouverte », chaque colonne nommée par un terme précis', () => {
    expect(COLONNES.map((c) => c.libelle)).toEqual([
      'Internet',
      'Domaine parent',
      'Nom de domaine',
      'IP publique',
      'Service',
      'Alerte ouverte',
      'Limite du SI',
      'Machine interne',
    ]);
    expect(X.hote).toBeLessThan(X.service);
    expect(X.service).toBeLessThan(X.alerte);
  });

  it('libellés exacts : port/protocole · service, puis produit et version ; « port non communiqué » en alerte sans port', () => {
    const { carte } = surface();
    const m = filtrerModele(construireModele(carte, 'parent'), FILTRES_CARTE_VIDES);
    const lignes = new Map(m.groupes.flatMap((g) => g.lignes).map((l) => [l.domaines[0]?.valeur ?? l.hote?.valeur, l]));
    const portail = lignes.get('portail-patients-consultations.exemple-sante.example')!;
    // Services de l'hôte vers lequel résout le domaine, fusionnés, triés par port ; le total compte ceux au-delà de la borne.
    expect(portail.ports.map((s) => s.port)).toEqual([22, 443]);
    expect(portail.nombreServices).toBe(3);
    expect(serviceDessine(portail, portail.ports[0]!)).toEqual({
      libelle: '22/tcp · SSH',
      produit: 'OpenSSH 9.6',
      sources: ['alh'],
      constats: [],
      nom: 'Service 22/tcp · SSH, OpenSSH 9.6, vu par AlgoLightHouse',
    });
    expect(serviceDessine(portail, portail.ports[1]!)).toMatchObject({
      libelle: '443/tcp · HTTPS',
      produit: 'nginx 1.18',
    });
    expect(serviceAbsent(lignes.get('vpn.exemple-sante.example')!)).toMatchObject({ libelle: 'port non communiqué' });
    // Sans alerte et sans service : rien ; sans alerte avec un service : le service, protocole jamais inventé.
    const racine = lignes.get('exemple-sante.example')!;
    expect(racine.ports).toEqual([]);
    expect(serviceAbsent(racine)).toBeNull();
    const calme = lignes.get('calme.exemple-sante.example')!;
    expect(serviceAbsent(calme)).toBeNull();
    expect(serviceDessine(calme, calme.ports[0]!)).toMatchObject({ libelle: '8443', produit: 'nginx' });
  });

  it('faisceaux repliés : nombre de services connus', () => {
    const { carte } = surface();
    const m = filtrerModele(construireModele(carte, 'parent'), FILTRES_CARTE_VIDES);
    // Branche en alerte dépliée, ses lignes sans alerte en faisceau (repli par défaut au-delà du seuil).
    const s = disposer(m, { groupes: new Set([m.groupes[0]!.cle]), calmes: new Set() }, { peutModifier: true });
    const faisceau = s.rangees.find((r) => r.type === 'faisceau' && r.calmes)!;
    expect(faisceau.type === 'faisceau' && faisceau.resume.services).toBe(1);
    expect(libelleResume(s.groupes[0]!.resume)).toContain('4 services connus');
  });

  it('filtre : le texte cherche aussi le port (« 443 », « 443/tcp ») et le produit', () => {
    const { carte } = surface();
    const modele = construireModele(carte, 'parent');
    const lignes = (texte: string) =>
      filtrerModele(modele, { ...FILTRES_CARTE_VIDES, texte })
        .groupes.flatMap((g) => g.lignes)
        .map((l) => l.etiquette)
        .sort();
    expect(lignes('443')).toEqual(['portail-patients-consultations']);
    expect(lignes('443/tcp')).toEqual(['portail-patients-consultations']);
    expect(lignes('443/udp')).toEqual([]);
    expect(lignes('8443')).toEqual(['calme']);
    expect(lignes('nginx')).toEqual(['calme', 'portail-patients-consultations']);
    expect(lignes('openssh 9.6')).toEqual(['portail-patients-consultations']);
  });
});

describe('carte : côté Internet lisible', () => {
  it('aucun trait vers les branches ne passe dans la colonne « Internet » ; libellés sur deux lignes', () => {
    const { carte } = surface();
    const m = filtrerModele(construireModele(carte, 'parent'), FILTRES_CARTE_VIDES);
    const s = disposer(m, toutDeplier(m), { peutModifier: true });
    // Bord droit des libellés côté Internet (caractères d'au plus 7 unités de large).
    const bord = X.internet + (INTERNET_CARACTERES * 7) / 2;
    for (const l of s.liens.filter((x) => x.cle.startsWith('o:'))) {
      const abscisses = [...l.d.matchAll(/([0-9.]+) [0-9.]+/g)].map((x) => Number(x[1]));
      // Le premier point est l'origine (au-dessus des libellés) ; tous les autres sont à droite de la colonne.
      for (const x of abscisses.slice(1)) expect(x).toBeGreaterThan(bord);
    }
    // Trois lignes de libellé et la nature tiennent entre deux alertes.
    expect(yInternet(1) - yInternet(0)).toBeGreaterThanOrEqual(22 + 4 * INTERNET_INTERLIGNE);
    expect(couperLibelle('portail-patients-consultations-exemp1e.example', INTERNET_CARACTERES)).toEqual([
      'portail-patients-',
      'consultations-exemp1e.',
      'example',
    ]);
    expect(couperLibelle('x'.repeat(80), INTERNET_CARACTERES)).toEqual([
      'x'.repeat(24),
      'x'.repeat(24),
      `${'x'.repeat(23)}…`,
    ]);
    expect(couperLibelle('exemp1e-sante.example', INTERNET_CARACTERES)).toEqual(['exemp1e-sante.example']);
    expect(couperLibelle('Identifiants divulgués de la messagerie (3 comptes)', INTERNET_CARACTERES)).toEqual([
      'Identifiants divulgués',
      'de la messagerie (3',
      'comptes)',
    ]);
    expect(couperLibelle('typosquatting-exemple.example', INTERNET_CARACTERES)).toEqual([
      'typosquatting-exemple.',
      'example',
    ]);
  });
});

describe('carte : rendu', () => {
  it('colonne, libellés, légende et aide disent que seuls les services portés par une alerte sont connus', () => {
    const html = rendreCarte(surface().carte);
    for (const t of [
      '>Service<',
      '>22/tcp · SSH<',
      '>443/tcp · HTTPS<',
      'OpenSSH 9.6',
      'et 1 autre service',
      'port non communiqué',
      'aria-label="Port non communiqué : le détail des alertes de cet actif ne donne aucun service"',
      'aria-label="Service 22/tcp · SSH, OpenSSH 9.6, vu par AlgoLightHouse : ouvrir la fiche de 192.0.2.10"',
      'seuls les services portés par une alerte sont connus',
      'AlgoLightHouse ne publie pas la liste des ports ouverts',
      // Le champ unique de la carte (décision du RSSI du 23/11/2026) dit qu'il cherche aussi le port et le produit.
      'Partie d’un nom de domaine (seuls les noms qui correspondent restent), début d’adresse IP (192.0.2.), CVE, port (443, 443/tcp), service ou produit.',
      'placeholder="Nom, adresse, CVE, port…"',
      // Typosquatting : le nom long sur deux lignes, coupé après un tiret ; IPv6 sur deux lignes.
      '>portail-patients-<',
      '>2001:db8:4000:<',
      '>1200:8000:0:aa:12<',
    ])
      expect(html).toContain(t);
    const dessin = html.match(/<svg(?=[^>]*class="sc-svg)[\s\S]*?<\/svg>/i)![0];
    expect(dessin).not.toMatch(/\sstyle=/i);
    expect(dessin).toMatch(/<rect[^>]*class="sc-forme sc-service"/i);
    const aide = HELP_ARTICLES.find((a) => a.id === 'vulnerabilites-surface')!.steps.join(' ');
    expect(aide).toContain('443/tcp · HTTPS');
    expect(aide).toContain('port non communiqué');
    expect(aide).toContain('seuls les services portés par une alerte');
  });

  it('ligne dessinée : la capsule du service est sur la ligne, entre l’hôte et l’alerte', () => {
    const { carte } = surface();
    const m = filtrerModele(construireModele(carte, 'parent'), FILTRES_CARTE_VIDES);
    const s = disposer(m, toutDeplier(m), { peutModifier: true });
    const r = s.rangees.find(
      (x): x is LigneDessinee => x.type === 'ligne' && x.ligne.etiquette === 'portail-patients-consultations',
    )!;
    const trait = s.liens.find((l) => l.cle === `${r.cle}:t`)!.d;
    const [, debut, fin] = /^M([0-9.]+) [0-9.]+ L([0-9.]+) /.exec(trait)!;
    expect(Number(debut)).toBeLessThan(X.service);
    expect(Number(fin)).toBeGreaterThan(X.service);
  });
});

describe('onglet « Actifs » et fiche d’un actif', () => {
  const ligne = (x: Partial<ActifAlhDto>): ActifAlhDto => ({
    id: id(++n),
    type: 'hote',
    valeur: '198.51.100.20',
    statut: 'monitored',
    adresse: null,
    fai: null,
    asn: null,
    pays: null,
    cdn: null,
    mutualise: null,
    joignable: true,
    joignableLe: null,
    niveau: null,
    alertesOuvertes: 1,
    technologies: 0,
    creeLe: null,
    majLe: null,
    perimetreAlh: null,
    perimetreNom: 'Périmètre fictif A',
    integration: { id: id(1), nom: 'AlgoLightHouse fictif' },
    machinesInternes: { reliees: [], nombreReliees: 0, propositions: 0, autresMachines: false },
    versionLiaisons: 1,
    services: [],
    nombreServices: 0,
    ...x,
  });
  it('colonne « Services connus » : libellés exacts, « port non communiqué » en alerte, « et n autres »', () => {
    const html = rendre(
      createElement(ActifsAlhTable, {
        actifs: [
          ligne({
            services: [HTTPS, service(22, 'tcp', { nom: 'ssh' }), service(53, 'udp'), service(8443, null)],
            nombreServices: 5,
          }),
          ligne({ valeur: '198.51.100.21' }),
          ligne({ valeur: '198.51.100.22', alertesOuvertes: 0 }),
        ],
      }),
    );
    for (const t of ['Services connus', '443/tcp · HTTPS', 'nginx 1.18', '22/tcp · SSH', '53/udp', 'et 2 autres'])
      expect(html).toContain(t);
    expect(html).toContain('port non communiqué');
    expect(html).not.toContain('8443');
  });
  it('fiche : services avec les alertes lisibles qui les portent, et la limite de la connaissance', () => {
    const services: ServiceExposeDto[] = [
      {
        ...HTTPS,
        cpe: 'cpe:/a:f5:nginx:1.18',
        alertes: [{ id: id(1), titre: 'Service vulnérable', criticite: 'major' }],
      },
      { ...service(8443, null), alertes: [] },
    ];
    const html = rendre(createElement(ServicesActif, { services }));
    for (const t of [
      'Services exposés',
      'Service (port/protocole · service)',
      '443/tcp · HTTPS',
      'nginx 1.18',
      'cpe:/a:f5:nginx:1.18',
      'Service vulnérable',
      'protocole non communiqué',
      'Aucune que vous pouvez lire',
      LIMITE_SERVICES,
    ])
      expect(html).toContain(t);
    expect(rendre(createElement(ServicesActif, { services: [] }))).toContain('Aucun service connu pour cet actif.');
  });
});

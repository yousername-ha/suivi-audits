/* Module Vulnérabilités (ADR 0100, lot ALH4) : carte « Lignes d'approche » de la surface externe, retenue par le RSSI le
   17/11/2026. Fonctions pures, sans appel réseau ni DOM (testées à part) : regroupement des actifs en branches, filtres,
   repli des branches et des lignes sans alerte, mise en page en colonnes (Internet → branche → nom de domaine → IP publique
   → service → alerte ouverte → limite du SI → machine interne).
   Lot ALH6 : colonne « Service » (port/protocole · service, puis produit et version).
   Lot SI2 (demandes du RSSI du 19/11/2026) :
   - deux sources : un actif vu par AlgoLightHouse et par Silène est un seul nœud, avec ses pastilles ; les services d'une
     ligne réunissent les ports ouverts de Silène et les services portés par les alertes d'AlgoLightHouse
     (`fusionnerPortsActif`, sans doublon port/protocole, la source de chaque service gardée) ; les constats Silène de
     l'hôte sont joints, sans priorité ;
   - une ligne est une adresse IP publique : dans une branche, les noms de domaine qui résolvent vers la même adresse
     convergent vers un seul nœud d'adresse (services, alertes de l'hôte et machines une seule fois). Une adresse déjà
     tracée dans une autre branche devient un renvoi explicite vers la ligne qui la porte, sans répéter ses services ;
   - regroupement par nom de domaine (domaine parent), par adresse IP (la branche est l'adresse, dépliée sur ses noms, ses
     services, la limite du SI et les machines) ou par périmètre ;
   - filtre par nom de domaine (partie du nom, casse ignorée, comparaison littérale) ou début d'adresse IP ; réuni le
     23/11/2026 (décision du RSSI) avec le filtre de la carte en un seul texte (`filtreTexte`) ;
   - la carte est la page elle-même (décision du RSSI du 19/11/2026) : plus de caméra ni de zoom, la scène entière est
     dessinée à la largeur de la page et se parcourt par le défilement normal ; les branches repliées par défaut au-delà
     d'un seuil, le regroupement et les filtres la gardent lisible. */
import {
  type ActifCarteDto,
  type AlerteCarteDto,
  type CarteSurfaceDto,
  type ConstatCarteDto,
  CRITICITES_ALH,
  type CriticiteAlh,
  fusionnerPortsActif,
  fusionnerServices,
  libelleProduitService,
  type MachineCarteDto,
  normaliserAdresseIp,
  type PortActifDto,
  type ProtocoleSilene,
  serviceCorrespond,
  SOURCES_SURFACE,
  type SourceSurface,
  type TypeAlerteAlh,
} from '@suivi/shared';
import { libelleCriticite, libellePerimetre } from './surface';
import { libellePortActif, produitPortSilene } from './surface-silene';

export type Regroupement = 'parent' | 'adresse' | 'bloc' | 'hebergeur' | 'perimetre';
export const OPTIONS_REGROUPEMENT: { value: Regroupement; label: string }[] = [
  { value: 'parent', label: 'Nom de domaine' },
  { value: 'adresse', label: 'Adresse IP publique' },
  // 7.6.1 (choix du RSSI du 22/11/2026) : lecture d'une grande surface par réseau, une ligne par adresse.
  { value: 'bloc', label: 'Bloc d’adresses' },
  { value: 'hebergeur', label: 'Hébergeur' },
  { value: 'perimetre', label: 'Périmètre' },
];
/** Regroupement par défaut : par domaine parent (confirmé par le RSSI le 17/11/2026, lot ALH5). */
export const REGROUPEMENT_DEFAUT: Regroupement = 'parent';

/** Alertes tracées du côté d'Internet, hors des branches : elles ne visent pas un actif de l'organisation. */
export const TYPES_ALERTE_INTERNET: readonly TypeAlerteAlh[] = ['typosquatting', 'data_leak'];

/** Au-delà de ce nombre de lignes affichées, les branches suivantes restent repliées en faisceaux. */
export const LIGNES_MAX = 250;
/** Repli par défaut (lot SI2) : jusqu'à `lignes` lignes, tout est déplié ; au-delà, seules les branches qui portent une
    alerte retenue sont dépliées, `branches` au plus (les plus graves d'abord), et leurs lignes sans alerte restent en
    faisceau. */
export const SEUIL_DEPLIE = { lignes: 30, branches: 12 } as const;

const GROUPE_HOTES = '§hotes';
const GROUPE_SANS_ADRESSE = '§sans-adresse';
const GROUPE_HEBERGEUR_INCONNU = '§hebergeur-inconnu';
/** Branches de reste, rangées après les autres à égalité d'alertes. */
const GROUPES_RESTE = new Set([GROUPE_HOTES, GROUPE_SANS_ADRESSE, GROUPE_HEBERGEUR_INCONNU]);

/** Bloc d'une adresse normalisée (7.6.1) : /24 en IPv4 (« 192.0.2.0/24 »), /64 en IPv6 (« 2001:db8:0:1::/64 »). */
export function blocAdresse(ip: string): string {
  if (!ip.includes(':')) return `${ip.split('.').slice(0, 3).join('.')}.0/24`;
  return `${ip
    .split(':')
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}

/** Hébergeur d'un hôte (7.6.1) : clé et libellé de sa branche, d'après le réseau qu'en donne AlgoLightHouse (fournisseur,
    numéro de système autonome, pays, CDN). Sans réseau connu (Silène seul, nom sans hôte) : « Hébergeur inconnu ». */
export function hebergeurDe(h: Pick<ActifCarteDto, 'reseau'> | null | undefined): { cle: string; libelle: string } {
  const r = h?.reseau;
  if (!r || (!r.asn && !r.fai)) return { cle: GROUPE_HEBERGEUR_INCONNU, libelle: 'Hébergeur inconnu' };
  const morceaux = [r.fai ?? 'Fournisseur non communiqué', r.asn ? `AS${r.asn}` : null, r.pays, r.cdn ? 'CDN' : null];
  return { cle: `n:${r.asn ?? ''}|${r.fai ?? ''}`, libelle: morceaux.filter(Boolean).join(' · ') };
}
const rangCriticite = (c: CriticiteAlh | null) => (c ? CRITICITES_ALH.indexOf(c) : CRITICITES_ALH.length);
/** Ordre des noms : alphabétique, nombres dans l'ordre naturel (« exemple-2 » avant « exemple-10 »), 7.6.1. */
const parNom = (a: string, b: string) => a.localeCompare(b, 'fr', { numeric: true });

/* ------------------------------------------------------------------ Modèle */
/** Constat Silène d'une ligne et les ports de l'hôte que ses lignes de détail citent. */
export interface ConstatLigne {
  constat: ConstatCarteDto;
  ports: { port: number; protocole: ProtocoleSilene | null }[];
}

/** Ce que portent les actifs d'une ligne : alertes, machines, services, constats. */
export interface Agregat {
  /** Alertes ouvertes (hors typosquatting et fuites), sans doublon. */
  alertes: AlerteCarteDto[];
  machines: MachineCarteDto[];
  propositions: number;
  autresMachines: boolean;
  /** Services réunis des deux sources, sans doublon port/protocole, triés par port. */
  ports: PortActifDto[];
  /** Total des services connus (au-delà des bornes de la route aussi). */
  nombreServices: number;
  constats: ConstatLigne[];
  nombreConstats: number;
}

export interface LigneCarte extends Agregat {
  /** « a:<branche>|<adresse> » (adresse IP), « d:<id> » (nom sans adresse connue) ou « h:<id> » (hôte sans nom). */
  cle: string;
  /** Noms de domaine de la ligne, qui résolvent vers son adresse (triés). */
  domaines: ActifCarteDto[];
  /** Hôte exposé de l'adresse (null : l'adresse n'est connue que par la résolution d'un nom). */
  hote: ActifCarteDto | null;
  /** Adresse IP publique de la ligne (normalisée), ou null (nom sans adresse connue). */
  adresse: string | null;
  /** Libellé de tri : premier nom (court sous sa racine en regroupement par domaine parent), sinon l'adresse. */
  etiquette: string;
  perimetre: string;
  /** Sources qui voient un actif de la ligne (ordre fixe). */
  sources: SourceSurface[];
  /** Actif dont la fiche liste les services (l'hôte, sinon le premier nom qui en porte). */
  actifServices: ActifCarteDto | null;
  /** Au moins un actif d'AlgoLightHouse : la ligne peut se relier à une machine interne (Silène seul : non). */
  reliable: boolean;
  /** Ce que portent les seuls noms de la ligne (sans l'hôte) : affiché quand l'adresse est un renvoi. */
  propre: Agregat & { reliable: boolean };
}

export interface GroupeCarte {
  cle: string;
  libelle: string;
  lignes: LigneCarte[];
}

export interface ModeleCarte {
  groupes: GroupeCarte[];
  /** Typosquatting et fuites de données : côté Internet. */
  internet: AlerteCarteDto[];
  /** Alertes dont la cible n'est pas un actif de la carte. */
  sansActif: AlerteCarteDto[];
  /** Périmètres présents (libellés), pour le filtre. */
  perimetres: string[];
}

const dedoublonner = <T extends { id: string }>(l: T[]) => [...new Map(l.map((x) => [x.id, x])).values()];
const sourcesDe = (actifs: ActifCarteDto[]): SourceSurface[] => {
  const vues = new Set(actifs.flatMap((a) => a.sources));
  return SOURCES_SURFACE.filter((s) => vues.has(s));
};

/** Domaine racine d'un domaine : on remonte les parents rendus par la route (cycle évité). */
function racineDe(d: ActifCarteDto, parId: Map<string, ActifCarteDto>): ActifCarteDto {
  const vus = new Set<string>([d.id]);
  let r = d;
  while (r.parentId) {
    const p = parId.get(r.parentId);
    if (!p || vus.has(p.id)) break;
    vus.add(p.id);
    r = p;
  }
  return r;
}

/** Domaine parent déduit d'un nom dont le parent n'est pas rendu (Silène ne le dit pas ; chez AlgoLightHouse, il peut être
    absent ou illisible) : le plus proche nom de la carte dont il est un sous-domaine, sinon ses deux derniers niveaux
    (« example.org » pour « www.example.org »). */
export function parentDeduit(valeur: string, connus: ReadonlySet<string>): string {
  const niveaux = valeur.split('.');
  for (let i = 1; i < niveaux.length - 1; i++) {
    const c = niveaux.slice(i).join('.');
    if (connus.has(c)) return c;
  }
  return niveaux.length > 2 ? niveaux.slice(-2).join('.') : valeur;
}

/** Libellé court d'un domaine sous sa racine ; la racine garde son nom complet. */
export function etiquetteDomaine(valeur: string, racine: string | null): string {
  if (racine && valeur !== racine && valeur.endsWith(`.${racine}`)) return valeur.slice(0, -racine.length - 1);
  return valeur;
}

/** Adresses IP d'un nom de domaine : celle d'AlgoLightHouse, puis celles des hôtes de Silène qui le portent. */
export const adressesDomaine = (d: ActifCarteDto): string[] => [
  ...new Set([d.adresse, ...(d.silene?.adresses ?? [])].map(normaliserAdresseIp).filter((x): x is string => !!x)),
];

export function construireModele(dto: CarteSurfaceDto, regroupement: Regroupement): ModeleCarte {
  const parId = new Map(dto.actifs.map((a) => [a.id, a]));
  const hotes = dto.actifs.filter((a) => a.type === 'hote');
  const domaines = dto.actifs.filter((a) => a.type === 'domaine').sort((a, b) => parNom(a.valeur, b.valeur));
  const constats = new Map((dto.constatsSilene ?? []).map((c) => [c.id, c]));
  const hoteParIp = new Map<string, ActifCarteDto>();
  for (const h of hotes) {
    const ip = normaliserAdresseIp(h.valeur);
    if (ip && !hoteParIp.has(ip)) hoteParIp.set(ip, h);
  }
  const internet: AlerteCarteDto[] = [];
  const sansActif: AlerteCarteDto[] = [];
  const alertesDe = new Map<string, AlerteCarteDto[]>();
  for (const a of dto.alertes) {
    if (a.type && TYPES_ALERTE_INTERNET.includes(a.type)) internet.push(a);
    else if (a.actifId && parId.has(a.actifId)) alertesDe.set(a.actifId, [...(alertesDe.get(a.actifId) ?? []), a]);
    else sansActif.push(a);
  }

  const agreger = (actifs: ActifCarteDto[], hote: ActifCarteDto | null): Agregat => {
    const alh = fusionnerServices(actifs.flatMap((x) => x.services));
    const ports = fusionnerPortsActif(alh, hote?.silene?.ports ?? []);
    const horsBorne =
      actifs.reduce((n, x) => n + Math.max(0, x.nombreServices - x.services.length), 0) +
      Math.max(0, (hote?.silene?.nombrePorts ?? 0) - (hote?.silene?.ports.length ?? 0));
    const cs = (hote?.silene?.constats ?? []).flatMap((c) => {
      const constat = constats.get(c.id);
      return constat ? [{ constat, ports: c.ports }] : [];
    });
    return {
      alertes: dedoublonner(actifs.flatMap((x) => alertesDe.get(x.id) ?? [])),
      machines: dedoublonner(actifs.flatMap((x) => x.machines)),
      propositions: actifs.reduce((n, x) => n + x.propositions, 0),
      autresMachines: actifs.some((x) => x.autresMachines),
      ports,
      nombreServices: ports.length + horsBorne,
      constats: cs,
      nombreConstats: Math.max(cs.length, hote?.silene?.nombreConstats ?? 0),
    };
  };
  const ligne = (
    cle: string,
    noms: ActifCarteDto[],
    hote: ActifCarteDto | null,
    adresse: string | null,
    etiquette: string,
  ): LigneCarte => {
    const actifs = [...noms, ...(hote ? [hote] : [])];
    return {
      cle,
      domaines: noms,
      hote,
      adresse,
      etiquette,
      perimetre: libellePerimetre(noms[0] ?? hote!),
      sources: sourcesDe(actifs),
      actifServices: hote ?? noms.find((x) => x.services.length) ?? null,
      reliable: actifs.some((x) => !!x.alhId),
      ...agreger(actifs, hote),
      propre: { ...agreger(noms, null), reliable: noms.some((x) => !!x.alhId) },
    };
  };

  const groupes = new Map<string, GroupeCarte & { parAdresse: Map<string, ActifCarteDto[]> }>();
  const groupe = (cle: string, libelle: string) => {
    let g = groupes.get(cle);
    if (!g) groupes.set(cle, (g = { cle, libelle, lignes: [], parAdresse: new Map() }));
    return g;
  };
  const valeurs = new Set(domaines.map((d) => d.valeur));
  /** Branche d'un nom (domaine parent ou périmètre) et sa racine (pour le libellé court). */
  const brancheDe = (d: ActifCarteDto): { cle: string; libelle: string; racine: string | null } => {
    if (regroupement === 'perimetre') {
      const p = libellePerimetre(d);
      return { cle: `p:${p}`, libelle: p, racine: null };
    }
    if (d.parentId) {
      const r = racineDe(d, parId);
      return { cle: `r:${r.valeur}`, libelle: r.valeur, racine: r.valeur };
    }
    // Parent non rendu (Silène ne le dit pas ; chez AlgoLightHouse, absent ou illisible) : parent déduit du nom, puis sa
    // propre racine s'il est un actif de la carte.
    const p = parentDeduit(d.valeur, valeurs);
    const actifParent = domaines.find((x) => x.valeur === p && x.id !== d.id);
    const r = actifParent?.parentId ? racineDe(actifParent, parId).valeur : p;
    return { cle: `r:${r}`, libelle: r, racine: r };
  };

  if (regroupement === 'adresse' || regroupement === 'bloc' || regroupement === 'hebergeur') {
    // Une ligne par adresse, avec les noms qui y résolvent ; la branche est l'adresse elle-même, son bloc ou son hébergeur.
    const brancheIp = (ip: string): { cle: string; libelle: string } =>
      regroupement === 'adresse'
        ? { cle: `a:${ip}`, libelle: ip }
        : regroupement === 'bloc'
          ? { cle: `b:${blocAdresse(ip)}`, libelle: blocAdresse(ip) }
          : hebergeurDe(hoteParIp.get(ip));
    const parIp = new Map<string, ActifCarteDto[]>();
    const sansAdresse: ActifCarteDto[] = [];
    for (const d of domaines) {
      const ips = adressesDomaine(d);
      if (!ips.length) sansAdresse.push(d);
      for (const ip of ips) parIp.set(ip, [...(parIp.get(ip) ?? []), d]);
    }
    for (const ip of hoteParIp.keys()) if (!parIp.has(ip)) parIp.set(ip, []);
    for (const [ip, noms] of parIp) {
      const b = brancheIp(ip);
      const g = groupe(b.cle, b.libelle);
      g.lignes.push(ligne(`a:${ip}`, noms, hoteParIp.get(ip) ?? null, ip, noms[0]?.valeur ?? ip));
    }
    for (const d of sansAdresse)
      groupe(GROUPE_SANS_ADRESSE, 'Noms sans adresse connue').lignes.push(
        ligne(`d:${d.id}`, [d], null, null, d.valeur),
      );
  } else {
    const relies = new Set<string>();
    const racines = new Map<string, string | null>();
    for (const d of domaines) {
      const b = brancheDe(d);
      racines.set(b.cle, b.racine);
      const ip = adressesDomaine(d)[0] ?? null;
      const g = groupe(b.cle, b.libelle);
      if (!ip) {
        g.lignes.push(ligne(`d:${d.id}`, [d], null, null, etiquetteDomaine(d.valeur, b.racine)));
        continue;
      }
      g.parAdresse.set(ip, [...(g.parAdresse.get(ip) ?? []), d]);
    }
    for (const g of groupes.values())
      for (const [ip, noms] of g.parAdresse) {
        const h = hoteParIp.get(ip) ?? null;
        if (h) relies.add(h.id);
        const racine = racines.get(g.cle) ?? null;
        g.lignes.push(ligne(`a:${g.cle}|${ip}`, noms, h, ip, etiquetteDomaine(noms[0]!.valeur, racine)));
      }
    for (const h of hotes) {
      if (relies.has(h.id)) continue;
      const ip = normaliserAdresseIp(h.valeur);
      const l = ligne(`h:${h.id}`, [], h, ip, h.valeur);
      if (regroupement === 'parent') groupe(GROUPE_HOTES, 'Hôtes sans domaine').lignes.push(l);
      else groupe(`p:${l.perimetre}`, l.perimetre).lignes.push(l);
    }
  }
  return {
    groupes: [...groupes.values()].map(({ cle, libelle, lignes }) => ({ cle, libelle, lignes })),
    internet,
    sansActif,
    perimetres: [...new Set(dto.actifs.map((a) => libellePerimetre(a)))].sort(parNom),
  };
}

/* ------------------------------------------------------------------ Filtres */
export interface FiltresCarte {
  /** Seul champ texte de la carte (`filtreTexte`) : nom de domaine, adresse ou identifiant CVE (partie) ; port (« 443 »,
      « 443/tcp ») ; service ou produit (partie). Une partie d'un nom ne garde que les noms qui la contiennent. */
  texte: string;
  /** Criticités retenues (vide : toutes). */
  criticites: CriticiteAlh[];
  enAlerteSeulement: boolean;
  /** Libellé du périmètre (vide : tous). */
  perimetre: string;
  typeAlerte: TypeAlerteAlh | '';
}
export const FILTRES_CARTE_VIDES: FiltresCarte = {
  texte: '',
  criticites: [],
  enAlerteSeulement: false,
  perimetre: '',
  typeAlerte: '',
};

export const alerteRetenue = (a: AlerteCarteDto, f: FiltresCarte) =>
  (!f.criticites.length || (a.criticite !== null && f.criticites.includes(a.criticite))) &&
  (!f.typeAlerte || a.type === f.typeAlerte);

/** Chemin d'entrée critique : une alerte ouverte en P1 (exploitation avérée d'une CVE portée par un actif exposé, ou
    priorité majorée parce que l'actif mène à une machine interne vulnérable ; lot ALH5). */
export const alerteCritique = (a: AlerteCarteDto) => a.priorite === 'P1';

/** Renvoi : l'adresse de la ligne est déjà tracée, avec ses services, dans une autre branche. */
export interface Renvoi {
  /** Ligne qui porte l'adresse, et sa branche. */
  cle: string;
  groupe: string;
  libelle: string;
}

export interface LigneFiltree extends LigneCarte {
  /** Alertes retenues par les filtres de criticité et de type. */
  retenues: AlerteCarteDto[];
  /** Alerte la plus haute (criticité de l'éditeur, puis priorité), ou null. */
  principale: AlerteCarteDto | null;
  critique: boolean;
  /** Noms de la ligne écartés par le filtre de la carte (comptés, non dessinés). */
  domainesMasques: number;
  renvoi: Renvoi | null;
}
export interface GroupeFiltre extends Omit<GroupeCarte, 'lignes'> {
  lignes: LigneFiltree[];
  critique: boolean;
  alertes: number;
}
export interface ModeleFiltre {
  groupes: GroupeFiltre[];
  internet: AlerteCarteDto[];
  sansActif: AlerteCarteDto[];
  /** Noms de domaine et adresses IP retenus (annoncés avec le filtre de la carte). */
  correspondances: { domaines: number; adresses: number };
}

const comparerAlertes = (a: AlerteCarteDto, b: AlerteCarteDto) =>
  Number(alerteCritique(b)) - Number(alerteCritique(a)) ||
  rangCriticite(a.criticite) - rangCriticite(b.criticite) ||
  (a.priorite ?? 'P5').localeCompare(b.priorite ?? 'P5') ||
  parNom(a.titre, b.titre);

const contient = (valeurs: (string | null | undefined)[], t: string) =>
  valeurs.some((v) => !!v && v.toLowerCase().includes(t));

/** Le texte désigne le service d'un port réuni (l'une ou l'autre source). */
export function portCorrespond(p: PortActifDto, t: string): boolean {
  if (p.alh && serviceCorrespond(p.alh, t)) return true;
  if (!p.silene) return false;
  return serviceCorrespond(
    {
      port: p.port,
      protocole: p.protocole,
      nom: p.silene.service,
      produit: produitPortSilene(p.silene),
      version: null,
      editeur: null,
    },
    t,
  );
}

/** Filtre de la carte, un seul champ (décision du RSSI du 23/11/2026, qui réunit le filtre texte du lot ALH4 et le filtre
    par nom du lot SI2). Le texte retient une ligne entière s'il paraît dans un de ses noms, son adresse, une CVE d'une de
    ses alertes retenues ou un de ses services (port « 443 », « 443/tcp », nom du service, produit). Sur une ligne retenue,
    s'il est une partie d'un nom et pas le début de l'adresse, seuls les noms qui le contiennent restent (les autres sont
    comptés) ; le début de l'adresse (« 192.0.2. »), une CVE ou un service gardent tous les noms. Casse ignorée, comparaison
    littérale : aucune expression régulière n'est construite à partir de la saisie. Rend null si la ligne n'est pas
    retenue. */
export function filtreTexte(
  l: Pick<LigneCarte, 'domaines' | 'adresse' | 'hote' | 'ports'>,
  retenues: readonly Pick<AlerteCarteDto, 'cves'>[],
  saisie: string,
): { domaines: ActifCarteDto[]; masques: number } | null {
  const t = saisie.trim().toLowerCase();
  if (!t) return { domaines: l.domaines, masques: 0 };
  const adresses = [l.adresse, l.hote?.valeur];
  const trouves = l.domaines.filter((d) => d.valeur.toLowerCase().includes(t));
  const debutAdresse = adresses.some((v) => !!v && v.toLowerCase().startsWith(t));
  if (trouves.length && !debutAdresse) return { domaines: trouves, masques: l.domaines.length - trouves.length };
  if (
    trouves.length ||
    contient(adresses, t) ||
    retenues.some((a) => contient(a.cves, t)) ||
    l.ports.some((p) => portCorrespond(p, t))
  )
    return { domaines: l.domaines, masques: 0 };
  return null;
}

const alertesRetenues = (l: Pick<Agregat, 'alertes'>, f: FiltresCarte) => {
  const retenues = l.alertes.filter((a) => alerteRetenue(a, f)).sort(comparerAlertes);
  return { retenues, principale: retenues[0] ?? null, critique: retenues.some(alerteCritique) };
};

export function filtrerModele(m: ModeleCarte, f: FiltresCarte): ModeleFiltre {
  const t = f.texte.trim().toLowerCase();
  const alerteCorrespond = (a: AlerteCarteDto) => contient([...a.cves, a.cible?.valeur, a.titre], t);
  const groupes: GroupeFiltre[] = [];
  for (const g of m.groupes) {
    const lignes: LigneFiltree[] = [];
    for (const l of g.lignes) {
      if (f.perimetre && l.perimetre !== f.perimetre) continue;
      const r = alertesRetenues(l, f);
      if (f.enAlerteSeulement && !r.retenues.length) continue;
      const noms = filtreTexte(l, r.retenues, t);
      if (!noms) continue;
      lignes.push({ ...l, ...r, domaines: noms.domaines, domainesMasques: noms.masques, renvoi: null });
    }
    if (!lignes.length) continue;
    lignes.sort(
      (a, b) =>
        Number(b.critique) - Number(a.critique) ||
        Number(!!b.principale) - Number(!!a.principale) ||
        rangCriticite(a.principale?.criticite ?? null) - rangCriticite(b.principale?.criticite ?? null) ||
        parNom(a.etiquette, b.etiquette),
    );
    groupes.push({ cle: g.cle, libelle: g.libelle, lignes, critique: false, alertes: 0 });
  }
  const resumerGroupe = (g: GroupeFiltre) => {
    g.critique = g.lignes.some((l) => l.critique);
    g.alertes = new Set(g.lignes.flatMap((l) => l.retenues.map((a) => a.id))).size;
  };
  groupes.forEach(resumerGroupe);
  const ordre = () =>
    groupes.sort(
      (a, b) =>
        Number(b.critique) - Number(a.critique) ||
        b.alertes - a.alertes ||
        Number(GROUPES_RESTE.has(a.cle)) - Number(GROUPES_RESTE.has(b.cle)) ||
        parNom(a.libelle, b.libelle),
    );
  ordre();
  // Une adresse n'est tracée qu'une fois, avec ses services, ses alertes et ses machines : sur la première ligne qui la
  // porte, dans l'ordre d'affichage ; ailleurs, la ligne garde ses noms (et ce qu'ils portent eux-mêmes) et renvoie vers
  // elle.
  const porteurs = new Map<string, Renvoi>();
  for (const g of groupes) {
    g.lignes = g.lignes.map((l) => {
      if (!l.adresse || !l.hote) return l;
      const porteur = porteurs.get(l.adresse);
      if (!porteur) {
        porteurs.set(l.adresse, { cle: l.cle, groupe: g.cle, libelle: g.libelle });
        return l;
      }
      const { reliable, ...propre } = l.propre;
      return { ...l, ...propre, ...alertesRetenues(propre, f), reliable, renvoi: porteur };
    });
    resumerGroupe(g);
  }
  ordre();
  const filtreInternet = (a: AlerteCarteDto) => alerteRetenue(a, f) && (!t || alerteCorrespond(a));
  const toutes = groupes.flatMap((g) => g.lignes);
  return {
    groupes,
    internet: m.internet.filter(filtreInternet).sort(comparerAlertes),
    sansActif: m.sansActif.filter(filtreInternet).sort(comparerAlertes),
    correspondances: {
      domaines: new Set(toutes.flatMap((l) => l.domaines.map((d) => d.valeur))).size,
      adresses: new Set(toutes.flatMap((l) => (l.adresse ? [l.adresse] : []))).size,
    },
  };
}

/* ------------------------------------------------------------------ Repli */
export interface EtatReplis {
  /** Branches dépliées. */
  groupes: ReadonlySet<string>;
  /** Branches dont les lignes sans alerte sont aussi dépliées. */
  calmes: ReadonlySet<string>;
}
export const toutReplier = (): EtatReplis => ({ groupes: new Set(), calmes: new Set() });
export const toutDeplier = (m: ModeleFiltre): EtatReplis => ({
  groupes: new Set(m.groupes.map((g) => g.cle)),
  calmes: new Set(m.groupes.map((g) => g.cle)),
});
/** Par défaut (lot SI2) : tout déplié jusqu'à SEUIL_DEPLIE.lignes lignes ; au-delà, seules les branches qui portent une
    alerte retenue sont dépliées (SEUIL_DEPLIE.branches au plus, les plus graves d'abord), leurs lignes sans alerte en
    faisceau. */
export function replisParDefaut(m: ModeleFiltre): EtatReplis {
  if (m.groupes.reduce((n, g) => n + g.lignes.length, 0) <= SEUIL_DEPLIE.lignes) return toutDeplier(m);
  return {
    groupes: new Set(
      m.groupes
        .filter((g) => g.alertes > 0)
        .slice(0, SEUIL_DEPLIE.branches)
        .map((g) => g.cle),
    ),
    calmes: new Set(),
  };
}
const basculer = (s: ReadonlySet<string>, cle: string) => {
  const n = new Set(s);
  if (!n.delete(cle)) n.add(cle);
  return n;
};
export const basculerGroupe = (e: EtatReplis, cle: string): EtatReplis => ({ ...e, groupes: basculer(e.groupes, cle) });
export const basculerCalmes = (e: EtatReplis, cle: string): EtatReplis => ({ ...e, calmes: basculer(e.calmes, cle) });
/** Déplie la branche d'une ligne (et ses lignes sans alerte si la ligne en est une) : aller à la ligne d'un renvoi. */
export function deplierVers(m: ModeleFiltre, e: EtatReplis, cle: string): EtatReplis {
  const g = m.groupes.find((x) => x.lignes.some((l) => l.cle === cle));
  if (!g) return e;
  const l = g.lignes.find((x) => x.cle === cle)!;
  return {
    groupes: new Set([...e.groupes, g.cle]),
    calmes: l.principale ? e.calmes : new Set([...e.calmes, g.cle]),
  };
}

/* ------------------------------------------------------------------ Mise en page */
/** Abscisses des colonnes (unités de la viewBox). `tronc` : les traits d'Internet vers les branches descendent le long de
    cette abscisse, à droite de la colonne « Internet » (lot ALH6). Écarts calculés pour des libellés de 32 caractères
    (domaine), 24 (service, produit, machine) et 26 (alerte) sans chevauchement. */
export const X = {
  internet: 96,
  tronc: 210,
  groupe: 220,
  groupeFin: 440,
  domaine: 560,
  hote: 722,
  service: 884,
  alerte: 1062,
  rempart: 1176,
  machine: 1226,
  fin: 1460,
} as const;
/** Marge du haut : la première ligne sous les libellés (les en-têtes de colonnes sont dessinés à part, collants). */
export const HAUT = 44;
/** Hauteur d'une ligne : libellés au-dessus (deux lignes pour une alerte), pastilles et produit en dessous. */
export const LIGNE_H = 56;
/** Rayon du raccord d'une branche au tronc (unités de la viewBox). */
const RACCORD = 16;
export const MACHINE_H = 24;
/** Écart vertical entre deux noms empilés d'une même adresse (libellé au-dessus, pastilles en dessous). */
export const DOMAINE_H = 46;
/** Écart vertical entre deux services empilés (libellé au-dessus, produit et pastilles en dessous). */
export const SERVICE_H = 48;
export const ECART_GROUPES = 16;
/** Machines, noms et services dessinés au plus par ligne ; les autres sont comptés (« et n autres »). */
export const MACHINES_PAR_LIGNE = 3;
export const DOMAINES_PAR_LIGNE = 8;
export const SERVICES_PAR_LIGNE = 3;

export const libelleColonneGroupe = (r: Regroupement) =>
  ({
    parent: 'Domaine parent',
    adresse: 'Adresse IP publique',
    bloc: 'Bloc d’adresses',
    hebergeur: 'Hébergeur',
    perimetre: 'Périmètre',
  })[r];
export const COLONNES = [
  { cle: 'internet', libelle: 'Internet', x: X.internet },
  { cle: 'groupe', libelle: 'Domaine parent', x: (X.groupe + X.groupeFin) / 2 },
  { cle: 'domaine', libelle: 'Nom de domaine', x: X.domaine },
  { cle: 'hote', libelle: 'IP publique', x: X.hote },
  { cle: 'service', libelle: 'Service', x: X.service },
  { cle: 'alerte', libelle: 'Alerte ouverte', x: X.alerte },
  { cle: 'rempart', libelle: 'Limite du SI', x: X.rempart },
  { cle: 'machine', libelle: 'Machine interne', x: X.machine + 70 },
] as const;

export type ParCriticite = Record<CriticiteAlh | 'inconnue', number>;
const compterCriticites = (alertes: AlerteCarteDto[]): ParCriticite => {
  const r: ParCriticite = { critical: 0, major: 0, important: 0, minor: 0, inconnue: 0 };
  for (const a of dedoublonner(alertes)) r[a.criticite ?? 'inconnue']++;
  return r;
};

export interface Resume {
  domaines: number;
  hotes: number;
  machines: number;
  /** Services connus (deux sources, sans doublon par adresse). */
  services: number;
  /** Constats Silène des hôtes. */
  constats: number;
  alertes: number;
  parCriticite: ParCriticite;
  critique: boolean;
}
export function resumer(lignes: LigneFiltree[]): Resume {
  const alertes = lignes.flatMap((l) => l.retenues);
  return {
    domaines: new Set(lignes.flatMap((l) => l.domaines.map((d) => d.id))).size,
    hotes: new Set(lignes.flatMap((l) => (l.hote ? [l.hote.id] : []))).size,
    machines: new Set(lignes.flatMap((l) => l.machines.map((m) => m.id))).size,
    services: lignes.reduce((n, l) => n + l.nombreServices, 0),
    constats: lignes.reduce((n, l) => n + l.nombreConstats, 0),
    alertes: new Set(alertes.map((a) => a.id)).size,
    parCriticite: compterCriticites(alertes),
    critique: lignes.some((l) => l.critique),
  };
}

export interface NoeudGroupe {
  cle: string;
  libelle: string;
  y: number;
  deplie: boolean;
  /** Replié parce que la borne d'affichage est atteinte (et non par la personne). */
  replieParBorne: boolean;
  resume: Resume;
}
export interface LigneDessinee {
  type: 'ligne';
  cle: string;
  groupe: string;
  y: number;
  ligne: LigneFiltree;
  /** Ordonnées des noms, des services et des machines dessinés (… _PAR_LIGNE au plus). */
  domainesY: number[];
  servicesY: number[];
  machinesY: number[];
  /** Marque « à relier » : aucune machine lisible reliée, aucune liaison vers une machine illisible, un actif
      d'AlgoLightHouse sur la ligne, droit de modifier. */
  aRelier: boolean;
  hauteur: number;
}
export interface FaisceauDessine {
  type: 'faisceau';
  cle: string;
  groupe: string;
  y: number;
  /** Faisceau des lignes sans alerte d'une branche dépliée (sinon : toute la branche repliée). */
  calmes: boolean;
  lignes: number;
  resume: Resume;
  epaisseur: number;
}
export type Rangee = LigneDessinee | FaisceauDessine;

export interface Lien {
  cle: string;
  d: string;
  critique: boolean;
  faisceau: boolean;
  epaisseur: number | null;
}

export interface Scene {
  largeur: number;
  hauteur: number;
  origine: { x: number; y: number };
  groupes: NoeudGroupe[];
  rangees: Rangee[];
  liens: Lien[];
  internet: { alerte: AlerteCarteDto; y: number }[];
  /** Alertes côté Internet non dessinées (au-delà de INTERNET_MAX). */
  internetAutres: number;
  /** Tronc unique d'Internet vers les branches (7.6.1) : il descend le long de `x` jusqu'à la dernière branche ; il est
      rouge jusqu'à la dernière branche qui porte un chemin d'entrée critique (`yCritique`), gris au-delà. Chaque branche
      s'y raccorde par un court trait (lien `o:<branche>`), au lieu d'une courbe tirée depuis Internet. */
  tronc: { x: number; y0: number; y1: number; yCritique: number | null } | null;
  /** Branches repliées à cause de la borne LIGNES_MAX. */
  replieesParBorne: number;
  lignesAffichees: number;
}

export const INTERNET_MAX = 6;
/** Ordonnée de la n-ième alerte tracée côté Internet (sous le point de départ). */
export const yInternet = (i: number) => HAUT + 80 + i * 92;
/** Caractères par ligne d'un libellé côté Internet : la colonne s'arrête avant le tronc. Trois lignes au plus. */
export const INTERNET_CARACTERES = 24;
export const INTERNET_LIGNES = 3;
/** Écart entre deux lignes d'un libellé (unités de la viewBox), sans chevauchement à la taille de la charte. */
export const INTERNET_INTERLIGNE = 15;

/** Épaisseur d'un faisceau selon le nombre de lignes qu'il replie (bornée). */
export const epaisseurFaisceau = (n: number) => Math.min(14, Math.round((2 + Math.sqrt(n) * 1.5) * 10) / 10);

/** Courbe de Bézier horizontale entre deux points. */
export function courbe(x1: number, y1: number, x2: number, y2: number): string {
  const m = (x1 + x2) / 2;
  return `M${x1} ${y1} C${m} ${y1} ${m} ${y2} ${x2} ${y2}`;
}
const droite = (x1: number, y: number, x2: number) => `M${x1} ${y} L${x2} ${y}`;
/** Trait d'une branche vers une de ses rangées : il descend juste à droite de la branche, puis file à l'horizontale sous
    la ligne des libellés, pour ne pas traverser les noms de domaine (lot ALH6). */
export const branche = (y0: number, x2: number, y: number) =>
  y === y0
    ? droite(X.groupeFin, y, x2)
    : `M${X.groupeFin} ${y0} C${X.groupeFin + 12} ${y0} ${X.groupeFin + 12} ${y} ${X.groupeFin + 24} ${y} L${x2} ${y}`;

/** Nom empilé vers le nœud d'adresse : à l'horizontale sous son libellé, puis une courbe courte après la colonne des noms
    (elle ne traverse pas les libellés des autres noms). */
export const versAdresse = (yd: number, y: number) =>
  `M${X.domaine + 8} ${yd} L${X.hote - 56} ${yd} C${X.hote - 30} ${yd} ${X.hote - 30} ${y} ${X.hote - 6} ${y}`;
/** Adresse vers un service empilé : courbe courte juste après l'adresse, puis à l'horizontale jusqu'au service (elle ne
    traverse pas le produit du service au-dessus). */
export const versService = (y: number, ys: number) =>
  `M${X.hote + 6} ${y} C${X.hote + 30} ${y} ${X.hote + 30} ${ys} ${X.hote + 56} ${ys} L${X.service - 8} ${ys}`;

/** Lignes sans alerte retenue, repliables en faisceau dans une branche dépliée. */
const calmesDe = (g: GroupeFiltre) => g.lignes.filter((l) => !l.principale);
const activesDe = (g: GroupeFiltre) => g.lignes.filter((l) => !!l.principale);

/** Ordonnées empilées à partir de `y` (`n` au plus). */
const empiler = (y: number, n: number, pas: number) => Array.from({ length: n }, (_, i) => y + i * pas);

export function disposer(m: ModeleFiltre, etat: EtatReplis, o: { peutModifier: boolean }): Scene {
  const groupes: NoeudGroupe[] = [];
  const rangees: Rangee[] = [];
  const liens: Lien[] = [];
  let y = HAUT;
  let affichees = 0;
  let parBorne = 0;
  for (const [i, g] of m.groupes.entries()) {
    // Chaque branche suivante garde au moins son faisceau : sa place est réservée sous la borne.
    const reserve = m.groupes.length - i - 1;
    const actives = activesDe(g);
    const calmes = calmesDe(g);
    let deplie = etat.groupes.has(g.cle);
    // Une branche sans ligne en alerte montre directement ses lignes quand on la déplie.
    let calmesDeplies = deplie && (etat.calmes.has(g.cle) || !actives.length);
    const cout = () => (deplie ? actives.length + (calmesDeplies ? calmes.length : calmes.length ? 1 : 0) : 1);
    let replieParBorne = false;
    if (affichees + cout() + reserve > LIGNES_MAX && calmesDeplies && actives.length) calmesDeplies = false;
    if (affichees + cout() + reserve > LIGNES_MAX && deplie) {
      deplie = false;
      replieParBorne = true;
      parBorne++;
    }
    affichees += cout();
    const y0 = y;
    const debut = rangees.length;
    if (!deplie) {
      rangees.push({
        type: 'faisceau',
        cle: `f:${g.cle}`,
        groupe: g.cle,
        y,
        calmes: false,
        lignes: g.lignes.length,
        resume: resumer(g.lignes),
        epaisseur: epaisseurFaisceau(g.lignes.length),
      });
      y += LIGNE_H;
    } else {
      const dessinees = calmesDeplies ? [...actives, ...calmes] : actives;
      for (const l of dessinees) {
        const nd = Math.min(l.domaines.length, DOMAINES_PAR_LIGNE);
        const ns = Math.min(l.ports.length, SERVICES_PAR_LIGNE);
        const nm = Math.min(l.machines.length, MACHINES_PAR_LIGNE);
        const plus = (n: number, max: number) => (n > max ? MACHINE_H / 2 : 0);
        const hauteur =
          LIGNE_H +
          Math.max(
            Math.max(0, nd - 1) * DOMAINE_H + plus(l.domaines.length + l.domainesMasques, DOMAINES_PAR_LIGNE),
            Math.max(0, ns - 1) * SERVICE_H + plus(l.nombreServices, SERVICES_PAR_LIGNE),
            Math.max(0, nm - 1) * MACHINE_H + plus(l.machines.length, MACHINES_PAR_LIGNE),
          );
        rangees.push({
          type: 'ligne',
          cle: l.cle,
          groupe: g.cle,
          y,
          ligne: l,
          domainesY: empiler(y, nd, DOMAINE_H),
          servicesY: empiler(y, ns, SERVICE_H),
          machinesY: empiler(y, nm, MACHINE_H),
          aRelier: o.peutModifier && l.reliable && !l.machines.length && !l.autresMachines,
          hauteur,
        });
        y += hauteur;
      }
      if (!calmesDeplies && calmes.length) {
        rangees.push({
          type: 'faisceau',
          cle: `c:${g.cle}`,
          groupe: g.cle,
          y,
          calmes: true,
          lignes: calmes.length,
          resume: resumer(calmes),
          epaisseur: epaisseurFaisceau(calmes.length),
        });
        y += LIGNE_H;
      }
    }
    groupes.push({ cle: g.cle, libelle: g.libelle, y: y0, deplie, replieParBorne, resume: resumer(g.lignes) });
    // Liens de la branche : groupe → chaque nom (ou l'adresse), noms → adresse, adresse → services, puis le long de la
    // rangée jusqu'au rempart et aux machines.
    for (const r of rangees.slice(debut)) {
      if (r.type === 'faisceau') {
        const critique = r.resume.critique;
        if (r.calmes)
          liens.push({
            cle: `${r.cle}:g`,
            d: branche(y0, X.domaine - 8, r.y),
            critique: false,
            faisceau: true,
            epaisseur: r.epaisseur,
          });
        liens.push({
          cle: `${r.cle}:t`,
          d: droite(r.calmes ? X.domaine - 8 : X.groupeFin, r.y, X.rempart),
          critique,
          faisceau: true,
          epaisseur: r.epaisseur,
        });
        continue;
      }
      const l = r.ligne;
      const lien = (cle: string, d: string) =>
        liens.push({ cle: `${r.cle}:${cle}`, d, critique: l.critique, faisceau: false, epaisseur: null });
      const xDepart = r.domainesY.length ? X.domaine : X.hote;
      if (r.domainesY.length)
        r.domainesY.forEach((yd, j) => {
          lien(j ? `g${j}` : 'g', branche(y0, X.domaine - 8, yd));
          if (j) lien(`d${j}`, versAdresse(yd, r.y));
        });
      else lien('g', branche(y0, X.hote - 8, r.y));
      // Un renvoi s'arrête à l'adresse, sauf si ses noms portent eux-mêmes une alerte ou une machine.
      const fin =
        r.machinesY.length || r.aRelier ? X.machine : l.renvoi && !l.principale && !l.ports.length ? X.hote : X.rempart;
      lien('t', droite(xDepart, r.y, fin));
      r.servicesY.slice(1).forEach((ys, j) => lien(`s${j + 1}`, versService(r.y, ys)));
      r.machinesY.slice(1).forEach((my, j) => lien(`m${j + 1}`, courbe(X.rempart, r.y, X.machine, my)));
    }
    y += ECART_GROUPES;
  }
  const internetDessinees = m.internet.slice(0, INTERNET_MAX);
  const hauteur = Math.max(y, yInternet(internetDessinees.length) + LIGNE_H) + HAUT / 2;
  const origine = { x: X.internet, y: HAUT };
  // Internet → chaque branche (rouge si la branche porte un chemin d'entrée critique) : à droite jusqu'au tronc, puis vers
  // la branche ; la colonne « Internet » (typosquatting, fuites) reste libre de tout trait.
  // 7.6.1 : un seul tronc (dessiné à part, voir `tronc`) et un court raccord par branche, pour que des dizaines de
  // branches ne superposent plus leurs courbes le long du tronc.
  for (const g of groupes)
    liens.unshift({
      cle: `o:${g.cle}`,
      d:
        g.y <= origine.y + RACCORD
          ? `M${X.tronc} ${g.y} L${X.groupe} ${g.y}`
          : `M${X.tronc} ${g.y - RACCORD} Q${X.tronc} ${g.y} ${X.tronc + RACCORD} ${g.y} L${X.groupe} ${g.y}`,
      critique: g.resume.critique,
      faisceau: false,
      epaisseur: null,
    });
  const critiques = groupes.filter((g) => g.resume.critique);
  const tronc = groupes.length
    ? {
        x: X.tronc,
        y0: origine.y,
        y1: Math.max(origine.y, groupes[groupes.length - 1]!.y - RACCORD),
        yCritique: critiques.length ? Math.max(origine.y, critiques[critiques.length - 1]!.y - RACCORD) : null,
      }
    : null;
  return {
    largeur: X.fin,
    hauteur,
    origine,
    groupes,
    rangees,
    liens,
    internet: internetDessinees.map((alerte, i) => ({ alerte, y: yInternet(i) })),
    internetAutres: m.internet.length - internetDessinees.length,
    tronc,
    replieesParBorne: parBorne,
    lignesAffichees: affichees,
  };
}

/* ------------------------------------------------------------------ Libellés */
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Résumé d'un faisceau en une ligne (nombres seulement). */
export function libelleResume(r: Resume): string {
  const parts = [
    r.domaines ? pluriel(r.domaines, 'nom de domaine', 'noms de domaine') : null,
    r.hotes ? pluriel(r.hotes, 'hôte', 'hôtes') : null,
    pluriel(r.alertes, 'alerte ouverte', 'alertes ouvertes'),
    r.services ? pluriel(r.services, 'service connu', 'services connus') : null,
    r.constats ? pluriel(r.constats, 'constat Silène', 'constats Silène') : null,
    r.machines ? pluriel(r.machines, 'machine interne reliée', 'machines internes reliées') : null,
  ].filter(Boolean);
  const crit = r.parCriticite.critical ? `, dont ${pluriel(r.parCriticite.critical, 'critique', 'critiques')}` : '';
  return `${parts.join(', ')}${crit}${r.critique ? ', chemin d’entrée critique' : ''}`;
}

/** Libellé de l'alerte principale d'une ligne (criticité, nombre, P1). */
export function libelleAlertes(l: LigneFiltree): string {
  if (!l.principale) return 'Sans alerte ouverte';
  const n = l.retenues.length;
  const tete = `${libelleCriticite(l.principale.criticite)}${n > 1 ? ` (${n} alertes)` : ''}`;
  return l.critique ? `${tete}, P1` : tete;
}

export const nomMachineCarte = (m: MachineCarteDto) => m.nom ?? m.adresse ?? 'Machine sans nom';

/** Sources en clair : « vu par AlgoLightHouse et Silène (ANSSI) ». */
export function texteSources(s: readonly SourceSurface[]): string {
  const noms = s.map((x) => (x === 'alh' ? 'AlgoLightHouse' : 'Silène (ANSSI)'));
  return noms.length ? `vu par ${noms.join(' et ')}` : 'source inconnue';
}

/** Constats Silène d'une ligne qui citent un port (même numéro ; même protocole s'il est connu des deux côtés). */
export const constatsDuPort = (l: Pick<Agregat, 'constats'>, p: Pick<PortActifDto, 'port' | 'protocole'>) =>
  l.constats.filter((c) =>
    c.ports.some((x) => x.port === p.port && (!x.protocole || !p.protocole || x.protocole === p.protocole)),
  );

/** Un service de la colonne « Service » : libellé, produit et version (Silène d'abord), sources, nom accessible complet. */
export interface ServiceDessine {
  libelle: string;
  produit: string | null;
  sources: SourceSurface[];
  constats: ConstatLigne[];
  nom: string;
}
export function serviceDessine(l: Pick<Agregat, 'constats'>, p: PortActifDto): ServiceDessine {
  const sources: SourceSurface[] = [...(p.alh ? (['alh'] as const) : []), ...(p.silene ? (['silene'] as const) : [])];
  const produit = (p.silene ? produitPortSilene(p.silene) : null) ?? (p.alh ? libelleProduitService(p.alh) : null);
  const constats = constatsDuPort(l, p);
  const libelle = libellePortActif(p);
  return {
    libelle,
    produit,
    sources,
    constats,
    nom: `Service ${libelle}${produit ? `, ${produit}` : ''}, ${texteSources(sources)}${
      constats.length ? `, ${pluriel(constats.length, 'constat Silène', 'constats Silène')} sur ce port` : ''
    }`,
  };
}

/** Colonne « Service » d'une ligne sans service connu : « port non communiqué » pour un actif en alerte ; sinon rien. */
export function serviceAbsent(l: LigneFiltree): { libelle: string; nom: string } | null {
  if (l.ports.length || !l.principale) return null;
  return {
    libelle: 'port non communiqué',
    nom: 'Port non communiqué : le détail des alertes de cet actif ne donne aucun service',
  };
}

/** Libellé coupé en lignes de `n` caractères au plus (`lignes` au plus), de préférence après un point ou un tiret ; au-delà,
    la dernière ligne se termine par « … » (le nom accessible garde le texte entier). */
export function couperLibelle(texte: string, n: number, lignes = INTERNET_LIGNES): string[] {
  const out: string[] = [];
  let reste = texte;
  while (reste.length > n && out.length < lignes - 1) {
    // Après un point ou un tiret (gardé en fin de ligne), ou à une espace (retirée) ; sinon, au nombre de caractères.
    const apres = Math.max(reste.lastIndexOf('.', n - 1), reste.lastIndexOf('-', n - 1)) + 1;
    const espace = reste.lastIndexOf(' ', n);
    const [fin, suite] = espace >= apres ? [espace, espace + 1] : [apres, apres];
    const [i, j] = fin > n / 3 ? [fin, suite] : [n, n];
    out.push(reste.slice(0, i));
    reste = reste.slice(j);
  }
  out.push(reste.length > n ? `${reste.slice(0, n - 1)}…` : reste);
  return out;
}

/** Constats Silène d'un hôte de la carte (tous, ou ceux qui citent un port), avec leur contrôle et leur classe. */
export function constatsDeLaCarte(
  dto: Pick<CarteSurfaceDto, 'constatsSilene'>,
  hote: ActifCarteDto,
  port: Pick<PortActifDto, 'port' | 'protocole'> | null,
): ConstatCarteDto[] {
  const parId = new Map(dto.constatsSilene.map((c) => [c.id, c]));
  return (hote.silene?.constats ?? [])
    .filter(
      (c) =>
        !port ||
        c.ports.some(
          (x) => x.port === port.port && (!x.protocole || !port.protocole || x.protocole === port.protocole),
        ),
    )
    .flatMap((c) => (parId.has(c.id) ? [parId.get(c.id)!] : []));
}

/* Module Vulnérabilités (ADR 0100, lot ALH4) : carte « Lignes d'approche » de la surface externe, retenue par le RSSI le
   17/11/2026. Fonctions pures, sans appel réseau ni DOM (testées à part) : regroupement des actifs en branches (domaine
   parent ou périmètre), filtres, repli des branches et des lignes sans alerte, mise en page en colonnes (Internet → groupes
   → domaines → hôtes → alertes → rempart → machines internes), caméra (déplacement et zoom par la viewBox).
   La carte ne montre que ce que la route rend : les services (ports) ne sont pas rangés comme objets, l'alerte ouverte la
   plus haute d'une ligne en tient lieu. Les machines sont celles des liaisons confirmées lisibles (lot ALH3) ; une machine
   illisible n'est jamais nommée (drapeau seulement), une proposition ou l'absence de liaison s'affiche « à relier » pour
   qui peut modifier. */
import {
  type ActifCarteDto,
  type AlerteCarteDto,
  type CarteSurfaceDto,
  CRITICITES_ALH,
  type CriticiteAlh,
  type MachineCarteDto,
  normaliserAdresseIp,
  type TypeAlerteAlh,
} from '@suivi/shared';
import { libelleCriticite, libellePerimetre } from './surface';

export type Regroupement = 'parent' | 'perimetre';
export const OPTIONS_REGROUPEMENT: { value: Regroupement; label: string }[] = [
  { value: 'parent', label: 'Domaine parent' },
  { value: 'perimetre', label: 'Périmètre' },
];
/** Regroupement par défaut : par domaine parent (choix de la session, à confirmer par le RSSI). */
export const REGROUPEMENT_DEFAUT: Regroupement = 'parent';

/** Alertes tracées du côté d'Internet, hors des branches : elles ne visent pas un actif de l'organisation. */
export const TYPES_ALERTE_INTERNET: readonly TypeAlerteAlh[] = ['typosquatting', 'data_leak'];

/** Au-delà de ce nombre de lignes affichées, les branches suivantes restent repliées en faisceaux. */
export const LIGNES_MAX = 250;

const GROUPE_HOTES = '§hotes';
const rangCriticite = (c: CriticiteAlh | null) => (c ? CRITICITES_ALH.indexOf(c) : CRITICITES_ALH.length);
const parNom = (a: string, b: string) => a.localeCompare(b, 'fr');

/* ------------------------------------------------------------------ Modèle */
export interface LigneCarte {
  /** « d:<id> » (domaine, avec l'hôte vers lequel il résout) ou « h:<id> » (hôte sans domaine). */
  cle: string;
  domaine: ActifCarteDto | null;
  hote: ActifCarteDto | null;
  /** Libellé court du domaine dans sa branche (« vpn » pour vpn.exemple.example sous exemple.example). */
  etiquette: string;
  perimetre: string;
  /** Alertes ouvertes du domaine et de son hôte (hors typosquatting et fuites), sans doublon. */
  alertes: AlerteCarteDto[];
  machines: MachineCarteDto[];
  propositions: number;
  autresMachines: boolean;
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

/** Libellé court d'un domaine sous sa racine ; la racine garde son nom complet. */
export function etiquetteDomaine(valeur: string, racine: string | null): string {
  if (racine && valeur !== racine && valeur.endsWith(`.${racine}`)) return valeur.slice(0, -racine.length - 1);
  return valeur;
}

export function construireModele(dto: CarteSurfaceDto, regroupement: Regroupement): ModeleCarte {
  const parId = new Map(dto.actifs.map((a) => [a.id, a]));
  const hotes = dto.actifs.filter((a) => a.type === 'hote');
  const domaines = dto.actifs.filter((a) => a.type === 'domaine');
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
  const groupes = new Map<string, GroupeCarte>();
  const ajouter = (cle: string, libelle: string, l: LigneCarte) => {
    let g = groupes.get(cle);
    if (!g) groupes.set(cle, (g = { cle, libelle, lignes: [] }));
    g.lignes.push(l);
  };
  const ligne = (cle: string, domaine: ActifCarteDto | null, hote: ActifCarteDto | null, etiquette: string) => {
    const actifs = [domaine, hote].filter((x): x is ActifCarteDto => !!x);
    return {
      cle,
      domaine,
      hote,
      etiquette,
      perimetre: libellePerimetre(domaine ?? hote!),
      alertes: dedoublonner(actifs.flatMap((x) => alertesDe.get(x.id) ?? [])),
      machines: dedoublonner(actifs.flatMap((x) => x.machines)),
      propositions: actifs.reduce((n, x) => n + x.propositions, 0),
      autresMachines: actifs.some((x) => x.autresMachines),
    } satisfies LigneCarte;
  };
  const relies = new Set<string>();
  for (const d of domaines) {
    const ip = normaliserAdresseIp(d.adresse);
    const h = ip ? (hoteParIp.get(ip) ?? null) : null;
    if (h) relies.add(h.id);
    const racine = racineDe(d, parId);
    const l = ligne(`d:${d.id}`, d, h, etiquetteDomaine(d.valeur, regroupement === 'parent' ? racine.valeur : null));
    if (regroupement === 'parent') ajouter(`r:${racine.id}`, racine.valeur, l);
    else ajouter(`p:${l.perimetre}`, l.perimetre, l);
  }
  for (const h of hotes) {
    if (relies.has(h.id)) continue;
    const l = ligne(`h:${h.id}`, null, h, h.valeur);
    if (regroupement === 'parent') ajouter(GROUPE_HOTES, 'Hôtes sans domaine', l);
    else ajouter(`p:${l.perimetre}`, l.perimetre, l);
  }
  return {
    groupes: [...groupes.values()],
    internet,
    sansActif,
    perimetres: [...new Set(dto.actifs.map((a) => libellePerimetre(a)))].sort(parNom),
  };
}

/* ------------------------------------------------------------------ Filtres */
export interface FiltresCarte {
  /** Domaine, adresse ou identifiant CVE (partie). */
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

/** Chemin d'entrée critique : une alerte ouverte en P1 (exploitation avérée d'une CVE portée par un actif exposé). */
export const alerteCritique = (a: AlerteCarteDto) => a.priorite === 'P1';

export interface LigneFiltree extends LigneCarte {
  /** Alertes retenues par les filtres de criticité et de type. */
  retenues: AlerteCarteDto[];
  /** Alerte la plus haute (criticité de l'éditeur, puis priorité), ou null. */
  principale: AlerteCarteDto | null;
  critique: boolean;
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
}

const comparerAlertes = (a: AlerteCarteDto, b: AlerteCarteDto) =>
  Number(alerteCritique(b)) - Number(alerteCritique(a)) ||
  rangCriticite(a.criticite) - rangCriticite(b.criticite) ||
  (a.priorite ?? 'P5').localeCompare(b.priorite ?? 'P5') ||
  parNom(a.titre, b.titre);

const contient = (valeurs: (string | null | undefined)[], t: string) =>
  valeurs.some((v) => !!v && v.toLowerCase().includes(t));

export function filtrerModele(m: ModeleCarte, f: FiltresCarte): ModeleFiltre {
  const t = f.texte.trim().toLowerCase();
  const alerteCorrespond = (a: AlerteCarteDto) => contient([...a.cves, a.cible?.valeur, a.titre], t);
  const groupes: GroupeFiltre[] = [];
  for (const g of m.groupes) {
    const lignes: LigneFiltree[] = [];
    for (const l of g.lignes) {
      if (f.perimetre && l.perimetre !== f.perimetre) continue;
      const retenues = l.alertes.filter((a) => alerteRetenue(a, f)).sort(comparerAlertes);
      if (f.enAlerteSeulement && !retenues.length) continue;
      if (
        t &&
        !contient([l.domaine?.valeur, l.domaine?.adresse, l.hote?.valeur], t) &&
        !retenues.some((a) => contient(a.cves, t))
      )
        continue;
      lignes.push({ ...l, retenues, principale: retenues[0] ?? null, critique: retenues.some(alerteCritique) });
    }
    if (!lignes.length) continue;
    lignes.sort(
      (a, b) =>
        Number(b.critique) - Number(a.critique) ||
        Number(!!b.principale) - Number(!!a.principale) ||
        rangCriticite(a.principale?.criticite ?? null) - rangCriticite(b.principale?.criticite ?? null) ||
        parNom(a.etiquette, b.etiquette),
    );
    groupes.push({
      cle: g.cle,
      libelle: g.libelle,
      lignes,
      critique: lignes.some((l) => l.critique),
      alertes: new Set(lignes.flatMap((l) => l.retenues.map((a) => a.id))).size,
    });
  }
  groupes.sort(
    (a, b) =>
      Number(b.critique) - Number(a.critique) ||
      b.alertes - a.alertes ||
      Number(a.cle === GROUPE_HOTES) - Number(b.cle === GROUPE_HOTES) ||
      parNom(a.libelle, b.libelle),
  );
  const filtreInternet = (a: AlerteCarteDto) => alerteRetenue(a, f) && (!t || alerteCorrespond(a));
  return {
    groupes,
    internet: m.internet.filter(filtreInternet).sort(comparerAlertes),
    sansActif: m.sansActif.filter(filtreInternet).sort(comparerAlertes),
  };
}

/* ------------------------------------------------------------------ Repli */
export interface EtatReplis {
  /** Branches dépliées. */
  groupes: ReadonlySet<string>;
  /** Branches dont les lignes sans alerte sont aussi dépliées. */
  calmes: ReadonlySet<string>;
}
/** Par défaut, seules les branches qui portent une alerte retenue sont dépliées ; leurs lignes sans alerte restent en
    faisceau. */
export const replisParDefaut = (m: ModeleFiltre): EtatReplis => ({
  groupes: new Set(m.groupes.filter((g) => g.alertes > 0).map((g) => g.cle)),
  calmes: new Set(),
});
export const toutReplier = (): EtatReplis => ({ groupes: new Set(), calmes: new Set() });
export const toutDeplier = (m: ModeleFiltre): EtatReplis => ({
  groupes: new Set(m.groupes.map((g) => g.cle)),
  calmes: new Set(m.groupes.map((g) => g.cle)),
});
const basculer = (s: ReadonlySet<string>, cle: string) => {
  const n = new Set(s);
  if (!n.delete(cle)) n.add(cle);
  return n;
};
export const basculerGroupe = (e: EtatReplis, cle: string): EtatReplis => ({ ...e, groupes: basculer(e.groupes, cle) });
export const basculerCalmes = (e: EtatReplis, cle: string): EtatReplis => ({ ...e, calmes: basculer(e.calmes, cle) });

/* ------------------------------------------------------------------ Mise en page */
/** Abscisses des colonnes (unités de la viewBox). */
export const X = {
  internet: 64,
  groupe: 150,
  groupeFin: 380,
  domaine: 466,
  hote: 636,
  alerte: 786,
  rempart: 896,
  machine: 944,
  fin: 1176,
} as const;
export const HAUT = 64;
export const LIGNE_H = 44;
export const MACHINE_H = 24;
export const ECART_GROUPES = 16;
/** Machines dessinées au plus par ligne ; les autres sont comptées (« et n autres »). */
export const MACHINES_PAR_LIGNE = 3;

export const COLONNES = [
  { cle: 'internet', libelle: 'Internet', x: X.internet },
  { cle: 'groupe', libelle: 'Branches', x: (X.groupe + X.groupeFin) / 2 },
  { cle: 'domaine', libelle: 'Domaines', x: X.domaine },
  { cle: 'hote', libelle: 'Hôtes exposés', x: X.hote },
  { cle: 'alerte', libelle: 'Alertes ouvertes', x: X.alerte },
  { cle: 'rempart', libelle: 'Rempart', x: X.rempart },
  { cle: 'machine', libelle: 'Machines internes', x: X.machine + 70 },
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
  alertes: number;
  parCriticite: ParCriticite;
  critique: boolean;
}
export function resumer(lignes: LigneFiltree[]): Resume {
  const alertes = lignes.flatMap((l) => l.retenues);
  return {
    domaines: lignes.filter((l) => l.domaine).length,
    hotes: new Set(lignes.flatMap((l) => (l.hote ? [l.hote.id] : []))).size,
    machines: new Set(lignes.flatMap((l) => l.machines.map((m) => m.id))).size,
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
  /** Ordonnées des machines dessinées (MACHINES_PAR_LIGNE au plus). */
  machinesY: number[];
  /** Marque « à relier » : aucune machine lisible reliée, aucune liaison vers une machine illisible, droit de modifier. */
  aRelier: boolean;
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
  /** Branches repliées à cause de la borne LIGNES_MAX. */
  replieesParBorne: number;
  lignesAffichees: number;
}

export const INTERNET_MAX = 6;
/** Ordonnée de la n-ième alerte tracée côté Internet (sous le point de départ). */
export const yInternet = (i: number) => HAUT + 80 + i * 56;

/** Épaisseur d'un faisceau selon le nombre de lignes qu'il replie (bornée). */
export const epaisseurFaisceau = (n: number) => Math.min(14, Math.round((2 + Math.sqrt(n) * 1.5) * 10) / 10);

/** Courbe de Bézier horizontale entre deux points. */
export function courbe(x1: number, y1: number, x2: number, y2: number): string {
  const m = (x1 + x2) / 2;
  return `M${x1} ${y1} C${m} ${y1} ${m} ${y2} ${x2} ${y2}`;
}
const droite = (x1: number, y: number, x2: number) => `M${x1} ${y} L${x2} ${y}`;

/** Lignes sans alerte retenue, repliables en faisceau dans une branche dépliée. */
const calmesDe = (g: GroupeFiltre) => g.lignes.filter((l) => !l.principale);
const activesDe = (g: GroupeFiltre) => g.lignes.filter((l) => !!l.principale);

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
      const resume = resumer(g.lignes);
      rangees.push({
        type: 'faisceau',
        cle: `f:${g.cle}`,
        groupe: g.cle,
        y,
        calmes: false,
        lignes: g.lignes.length,
        resume,
        epaisseur: epaisseurFaisceau(g.lignes.length),
      });
      y += LIGNE_H;
    } else {
      const dessinees = calmesDeplies ? [...actives, ...calmes] : actives;
      for (const l of dessinees) {
        const n = Math.min(l.machines.length, MACHINES_PAR_LIGNE);
        const machinesY = Array.from({ length: n }, (_, i) => y + i * MACHINE_H);
        rangees.push({
          type: 'ligne',
          cle: l.cle,
          groupe: g.cle,
          y,
          ligne: l,
          machinesY,
          aRelier: o.peutModifier && !l.machines.length && !l.autresMachines,
        });
        y += LIGNE_H + Math.max(0, n - 1) * MACHINE_H + (l.machines.length > MACHINES_PAR_LIGNE ? MACHINE_H / 2 : 0);
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
    // Liens de la branche : groupe → chaque rangée, puis le long de la rangée jusqu'au rempart et aux machines.
    for (const r of rangees.slice(debut)) {
      if (r.type === 'faisceau') {
        const critique = r.resume.critique;
        if (r.calmes)
          liens.push({
            cle: `${r.cle}:g`,
            d: courbe(X.groupeFin, y0, X.domaine - 8, r.y),
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
      const xDepart = l.domaine ? X.domaine : X.hote;
      liens.push({
        cle: `${r.cle}:g`,
        d: courbe(X.groupeFin, y0, xDepart - 8, r.y),
        critique: l.critique,
        faisceau: false,
        epaisseur: null,
      });
      const fin = r.machinesY.length || r.aRelier ? X.machine : X.rempart;
      liens.push({
        cle: `${r.cle}:t`,
        d: droite(xDepart, r.y, fin),
        critique: l.critique,
        faisceau: false,
        epaisseur: null,
      });
      r.machinesY.slice(1).forEach((my, i) =>
        liens.push({
          cle: `${r.cle}:m${i + 1}`,
          d: courbe(X.rempart, r.y, X.machine, my),
          critique: l.critique,
          faisceau: false,
          epaisseur: null,
        }),
      );
    }
    y += ECART_GROUPES;
  }
  const internetDessinees = m.internet.slice(0, INTERNET_MAX);
  const hauteur = Math.max(y, yInternet(internetDessinees.length) + LIGNE_H) + HAUT / 2;
  const origine = { x: X.internet, y: HAUT };
  // Internet → chaque branche (rouge si la branche porte un chemin d'entrée critique).
  for (const g of groupes)
    liens.unshift({
      cle: `o:${g.cle}`,
      d: courbe(origine.x + 12, origine.y, X.groupe, g.y),
      critique: g.resume.critique,
      faisceau: false,
      epaisseur: null,
    });
  return {
    largeur: X.fin,
    hauteur,
    origine,
    groupes,
    rangees,
    liens,
    internet: internetDessinees.map((alerte, i) => ({ alerte, y: yInternet(i) })),
    internetAutres: m.internet.length - internetDessinees.length,
    replieesParBorne: parBorne,
    lignesAffichees: affichees,
  };
}

/* ------------------------------------------------------------------ Libellés */
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Résumé d'un faisceau en une ligne (nombres seulement). */
export function libelleResume(r: Resume): string {
  const parts = [
    r.domaines ? pluriel(r.domaines, 'domaine', 'domaines') : null,
    r.hotes ? pluriel(r.hotes, 'hôte', 'hôtes') : null,
    pluriel(r.alertes, 'alerte ouverte', 'alertes ouvertes'),
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

/* ------------------------------------------------------------------ Caméra */
/** Rapport hauteur / largeur de la zone affichée (le cadre de la carte a le même, par sa feuille de style). */
export const RAPPORT = 0.6;
export interface Camera {
  x: number;
  y: number;
  w: number;
}
export const ZOOM_MIN = 280;
export const hauteurCamera = (c: Camera) => c.w * RAPPORT;
export const viewBoxDe = (c: Camera) =>
  `${c.x.toFixed(1)} ${c.y.toFixed(1)} ${c.w.toFixed(1)} ${hauteurCamera(c).toFixed(1)}`;
const largeurMax = (s: Pick<Scene, 'largeur' | 'hauteur'>) => Math.max(s.largeur, s.hauteur / RAPPORT) * 1.05;

/** La zone affichée reste à moitié au moins sur la carte. */
export function borner(c: Camera, s: Pick<Scene, 'largeur' | 'hauteur'>): Camera {
  const w = Math.min(Math.max(c.w, ZOOM_MIN), largeurMax(s));
  const h = w * RAPPORT;
  return {
    w,
    x: Math.min(Math.max(c.x, -w / 2), s.largeur - w / 2),
    y: Math.min(Math.max(c.y, -h / 2), s.hauteur - h / 2),
  };
}
/** Vue de départ : toute la largeur, depuis le haut. */
export const cameraInitiale = (s: Pick<Scene, 'largeur' | 'hauteur'>): Camera =>
  borner({ x: 0, y: 0, w: s.largeur }, s);
/** Recadrer : toute la carte dans la zone affichée. */
export const recadrer = (s: Pick<Scene, 'largeur' | 'hauteur'>): Camera =>
  borner({ x: 0, y: 0, w: Math.max(s.largeur, s.hauteur / RAPPORT) }, s);
/** Zoom d'un facteur (moins de 1 : rapproche) autour d'un point de la carte (par défaut, le centre affiché). */
export function zoomer(
  c: Camera,
  facteur: number,
  s: Pick<Scene, 'largeur' | 'hauteur'>,
  centre?: { x: number; y: number },
): Camera {
  const p = centre ?? { x: c.x + c.w / 2, y: c.y + hauteurCamera(c) / 2 };
  const w = Math.min(Math.max(c.w * facteur, ZOOM_MIN), largeurMax(s));
  const k = w / c.w;
  return borner({ w, x: p.x - (p.x - c.x) * k, y: p.y - (p.y - c.y) * k }, s);
}
export const deplacer = (c: Camera, dx: number, dy: number, s: Pick<Scene, 'largeur' | 'hauteur'>): Camera =>
  borner({ ...c, x: c.x + dx, y: c.y + dy }, s);
/** Centre la zone affichée sur un point (vue d'ensemble). */
export const centrerSur = (c: Camera, x: number, y: number, s: Pick<Scene, 'largeur' | 'hauteur'>): Camera =>
  borner({ ...c, x: x - c.w / 2, y: y - hauteurCamera(c) / 2 }, s);

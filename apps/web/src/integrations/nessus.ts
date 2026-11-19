/* Module Vulnérabilités (ADR 0100, lot N1) : lecture d'un scan Nessus (.nessus, XML « NessusClientData_v2 ») dans le
   navigateur, sans dépendance (API du navigateur, DOMParser). Seul un extrait en liste blanche est envoyé à l'API, en JSON,
   par lots de machines entières ; le fichier complet, les sorties brutes des contrôles (`plugin_output`), leur description
   longue et la politique du scan (`Policy`, comptes de scan) ne quittent jamais le poste : ils ne sont même pas lus.
   Règles calquées sur ce que garde le script de Tenable Security Center (scripts/integration-http.py) et sur les bornes de
   la migration 075 : noms en minuscules, adresse IP, textes nettoyés et bornés, lien https seul, CVE de forme contrôlée.
   Tout élément hors norme est écarté et compté (jamais tronqué en silence ; un texte raccourci à sa borne porte « … » et
   est compté). Fonctions pures, testées hors navigateur sur une représentation minimale d'un nœud XML (NoeudXml) ; seule
   `lireDocument` touche au DOMParser. Format écrit d'après la connaissance de « NessusClientData_v2 », non vérifié sur un
   export réel. */
import {
  ADRESSE_IP,
  cleMachine,
  ConstatImportNessus,
  CVE_ID,
  CVSS3_VECTEUR_TENABLE,
  ECART_IMPORT_LIBELLES,
  ECARTS_IMPORT,
  type EcartImport,
  type EcartsImportNessus,
  type BilanImportNessus,
  GRAVITE_TENABLE_LIBELLES,
  GRAVITES_TENABLE,
  type GraviteTenable,
  type LotImportNessus,
  MachineLotNessus,
  NESSUS_BORNES,
  NOM_MACHINE,
  PLUGIN_ID,
  PROTOCOLE,
  TENABLE_BORNES,
  VOIR_AUSSI,
} from '@suivi/shared';

/* ------------------------------------------------------------------ Nœud XML minimal */
/** Ce que l'extraction lit d'un élément XML : nom local, attribut, éléments enfants, texte. Fourni par le DOMParser dans le
    navigateur (`noeudDom`), par un lecteur de test hors navigateur. */
export interface NoeudXml {
  nom: string;
  attribut(nom: string): string | null;
  enfants(): NoeudXml[];
  texte(): string;
}

export class ErreurImport extends Error {}

const MO = 1_000_000;
export const RACINE_NESSUS = 'NessusClientData_v2';

/** Taille du fichier : au-delà de la borne, refus avec un message clair (avant toute lecture). */
export function erreurTaille(octets: number): string | null {
  if (octets <= 0) return 'Fichier vide.';
  if (octets > NESSUS_BORNES.fichierMo * MO)
    return `Fichier trop volumineux : ${(octets / MO).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo, pour ${NESSUS_BORNES.fichierMo} Mo au plus. Exportez un scan plus petit (moins de machines, ou critiques et élevées seulement) et importez-le en plusieurs fois : les machines absentes d’un fichier ne changent pas.`;
  return null;
}

/** Contrôle du texte AVANT toute analyse XML : une déclaration de type de document ou d'entité est refusée (aucune
    expansion d'entité, aucune ressource externe). Casse ignorée. */
export function erreurTexte(texte: string): string | null {
  const t = texte.toUpperCase();
  if (t.includes('<!DOCTYPE')) return 'Fichier refusé : il contient une déclaration de type de document (DOCTYPE).';
  if (t.includes('<!ENTITY')) return 'Fichier refusé : il contient une déclaration d’entité (ENTITY).';
  return null;
}

/** Adaptateur du DOMParser (navigateur). */
export function noeudDom(e: Element): NoeudXml {
  return {
    nom: e.localName,
    attribut: (n) => e.getAttribute(n),
    enfants: () => Array.from(e.children, noeudDom),
    texte: () => e.textContent ?? '',
  };
}

/** Analyse le texte par le DOMParser du navigateur, après le contrôle du texte ; une erreur d'analyse vaut refus. */
export function lireDocument(texte: string, analyseur: Pick<DOMParser, 'parseFromString'> = new DOMParser()): NoeudXml {
  const e = erreurTexte(texte);
  if (e) throw new ErreurImport(e);
  const doc = analyseur.parseFromString(texte, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0 || !doc.documentElement)
    throw new ErreurImport('Fichier illisible : ce n’est pas un document XML bien formé.');
  return noeudDom(doc.documentElement);
}

/* ------------------------------------------------------------------ Valeurs */
const BALISE = /<[A-Za-z/!?][^<>]{0,2000}>/g;
const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const ENTITE = /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z]{2,6}));/g;
const INVISIBLES = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Zl}\p{Zp}]/gu;

function decoder(t: string): string {
  return t.replace(ENTITE, (m, dec: string | undefined, hex: string | undefined, nom: string | undefined) => {
    if (nom) return ENTITES[nom.toLowerCase()] ?? m;
    const n = dec ? Number(dec) : parseInt(hex!, 16);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
  });
}

/** Texte simple sur une ligne, comme le script de Tenable : balises retirées et entités décodées jusqu'au point fixe, tout
    « < » suivi d'une lettre restant remplacé, caractères invisibles remplacés, espaces réduits, longueur bornée (« … » et
    compté). Vide : null. */
export function texteNettoye(brut: string | null, maximum: number, ecarts?: Compteur): string | null {
  if (brut === null) return null;
  let t = brut.slice(0, maximum * 20);
  for (let i = 0; i < 10; i++) {
    const avant = t;
    t = decoder(t.replace(BALISE, ' '));
    if (t === avant) break;
  }
  t = t.replace(BALISE, ' ').replace(/<(?=[A-Za-z/!?])/g, '‹');
  t = t.replace(INVISIBLES, ' ').split(/\s+/u).filter(Boolean).join(' ');
  if (t.length > maximum) {
    ecarts?.compter('textesRaccourcis');
    t = `${t.slice(0, maximum - 1).trimEnd()}…`;
  }
  return t || null;
}

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
/** Adresse IP (IPv4, ou IPv6 en minuscules), sinon null. */
export function adresseIp(v: string | null): string | null {
  const a = v?.trim().toLowerCase() ?? '';
  return a && a.length <= 45 && ADRESSE_IP.test(a) ? a : null;
}

/** Nom de machine (DNS ou NetBIOS « DOMAINE\NOM »), en minuscules, sinon null. Une adresse n'est pas un nom. */
export function nomMachine(v: string | null): string | null {
  let n = v?.trim().toLowerCase() ?? '';
  if (n.includes('\\')) n = n.slice(n.lastIndexOf('\\') + 1);
  if (!n || IPV4.test(n) || adresseIp(n)) return null;
  return n.length <= TENABLE_BORNES.nomMachine && NOM_MACHINE.test(n) ? n : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE_MAX = Date.UTC(2100, 0, 1);
const iso = (ms: number) => (Number.isFinite(ms) && ms > 0 && ms < DATE_MAX ? new Date(ms).toISOString() : null);
const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CTIME = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) ([A-Z][a-z]{2}) {1,2}(\d{1,2}) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/;

/** Début ou fin du scan d'une machine : `HOST_*_TIMESTAMP` (secondes depuis 1970) s'il existe, sinon `HOST_*` (forme
    « Tue Nov 18 08:00:00 2026 », sans fuseau : lue à l'heure du poste). */
export function instantHote(horodatage: string | null, texte: string | null): string | null {
  const s = horodatage?.trim() ?? '';
  if (/^\d{1,12}$/.test(s)) return iso(Number(s) * 1000);
  const m = CTIME.exec(texte?.trim() ?? '');
  if (!m || !MOIS.includes(m[1]!)) return null;
  return iso(new Date(+m[6]!, MOIS.indexOf(m[1]!), +m[2]!, +m[3]!, +m[4]!, +m[5]!).getTime());
}

/** Date de publication d'un contrôle (« 2026/10/01 »), à minuit UTC. */
export function datePublication(v: string | null): string | null {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(v?.trim() ?? '');
  if (!m) return null;
  const ms = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!);
  const d = new Date(ms);
  return d.getUTCMonth() === +m[2]! - 1 && d.getUTCDate() === +m[3]! ? iso(ms) : null;
}

/** Score de 0 à 10, à une décimale ; sinon null. */
export function score10(v: string | null): number | null {
  const s = v?.trim() ?? '';
  if (!/^\d{1,2}(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= 10 ? Math.round(n * 10) / 10 : null;
}

const VOIR_AUSSI_INTERDITS = /["'<>\\`]/;
/** Premier lien https admis (comme le script de Tenable), sinon null. */
export function voirAussi(v: string | null): string | null {
  for (const lien of (v ?? '').split(/\s+/))
    if (lien && lien.length <= TENABLE_BORNES.voirAussi && VOIR_AUSSI.test(lien) && !VOIR_AUSSI_INTERDITS.test(lien))
      return lien;
  return null;
}

/* ------------------------------------------------------------------ Extraction */
/** Compteur des éléments écartés. */
export class Compteur {
  readonly valeurs: EcartsImportNessus = Object.fromEntries(ECARTS_IMPORT.map((e) => [e, 0])) as EcartsImportNessus;
  compter(e: EcartImport, n = 1) {
    this.valeurs[e] += n;
  }
}

const GRAVITE_DE_NESSUS: Record<string, GraviteTenable> = {
  '4': 'critique',
  '3': 'elevee',
  '2': 'moyenne',
  '1': 'faible',
};
const ordreGravite = (g: GraviteTenable) => GRAVITES_TENABLE.indexOf(g);

/** Étiquettes lues dans `HostProperties` (toutes les autres sont ignorées, sans être lues). `host-uuid` : identifiant de
    l'hôte, s'il est donné (nom de l'étiquette non vérifié sur un export réel). */
export const ETIQUETTES_HOTE = [
  'host-ip',
  'host-fqdn',
  'netbios-name',
  'operating-system',
  'HOST_START',
  'HOST_END',
  'HOST_START_TIMESTAMP',
  'HOST_END_TIMESTAMP',
  'host-uuid',
] as const;
/** Éléments lus dans un `ReportItem` (tous les autres, `plugin_output` et `description` d'abord, ne sont jamais lus). */
export const CHAMPS_CONTROLE = [
  'synopsis',
  'solution',
  'cvss3_vector',
  'cvss3_base_score',
  'vpr_score',
  'exploit_available',
  'exploitability_ease',
  'vuln_publication_date',
  'patch_publication_date',
  'see_also',
  'cve',
] as const;
/** Attributs lus d'un `ReportItem`. */
export const ATTRIBUTS_CONTROLE = ['pluginID', 'pluginName', 'pluginFamily', 'severity', 'port', 'protocol'] as const;

interface MachineExtraite {
  machine: MachineLotNessus['machine'];
  detections: Map<string, MachineLotNessus['detections'][number]>;
}

export interface ExtraitNessus {
  /** Machines retenues, chacune entière, dans l'ordre du fichier. */
  machines: MachineLotNessus[];
  /** Contrôles décrits, par numéro. */
  constats: Map<string, ConstatImportNessus>;
  ecartes: EcartsImportNessus;
  detections: number;
  gravites: GraviteTenable[];
}

const enfantsNommes = (n: NoeudXml, nom: string) => n.enfants().filter((e) => e.nom === nom);

function lireHote(h: NoeudXml): Record<(typeof ETIQUETTES_HOTE)[number], string | null> {
  const r = Object.fromEntries(ETIQUETTES_HOTE.map((e) => [e, null])) as Record<
    (typeof ETIQUETTES_HOTE)[number],
    string | null
  >;
  for (const p of enfantsNommes(h, 'HostProperties'))
    for (const tag of enfantsNommes(p, 'tag')) {
      const nom = tag.attribut('name') as (typeof ETIQUETTES_HOTE)[number] | null;
      if (nom && (ETIQUETTES_HOTE as readonly string[]).includes(nom) && r[nom] === null) r[nom] = tag.texte();
    }
  return r;
}

/** Description d'un contrôle, lue une fois : seuls les éléments de CHAMPS_CONTROLE sont lus. */
function lireControle(
  item: NoeudXml,
  plugin: string,
  nom: string,
  gravite: GraviteTenable,
  ecarts: Compteur,
): ConstatImportNessus | null {
  const v: Partial<Record<(typeof CHAMPS_CONTROLE)[number], string>> = {};
  const cves: string[] = [];
  for (const e of item.enfants()) {
    if (!(CHAMPS_CONTROLE as readonly string[]).includes(e.nom)) continue;
    const champ = e.nom as (typeof CHAMPS_CONTROLE)[number];
    if (champ === 'cve') {
      const c = e.texte().trim().toUpperCase();
      if (CVE_ID.test(c)) {
        if (!cves.includes(c)) cves.push(c);
      } else ecarts.compter('cvesInvalides');
    } else if (v[champ] === undefined) v[champ] = e.texte();
  }
  const valeur = <T>(brut: string | undefined, lu: T | null): T | null => {
    if (brut !== undefined && brut.trim() !== '' && lu === null) ecarts.compter('valeursInvalides');
    return lu;
  };
  const vecteur = v.cvss3_vector?.trim() ?? '';
  const lien = voirAussi(v.see_also ?? null);
  if (v.see_also !== undefined && v.see_also.trim() !== '' && lien === null) ecarts.compter('liensRefuses');
  const c: ConstatImportNessus = {
    plugin,
    nom,
    gravite,
    famille: texteNettoye(item.attribut('pluginFamily'), TENABLE_BORNES.famille, ecarts),
    synopsis: texteNettoye(v.synopsis ?? null, TENABLE_BORNES.synopsis, ecarts),
    correctif: texteNettoye(v.solution ?? null, TENABLE_BORNES.correctif, ecarts),
    cvss3Vecteur: valeur(v.cvss3_vector, vecteur.length <= 200 && CVSS3_VECTEUR_TENABLE.test(vecteur) ? vecteur : null),
    cvss3Score: valeur(v.cvss3_base_score, score10(v.cvss3_base_score ?? null)),
    vpr: valeur(v.vpr_score, score10(v.vpr_score ?? null)),
    // Score EPSS de Nessus non repris : son unité (probabilité ou pourcentage) n'est pas vérifiée sur un export réel ; la
    // veille le lit chez FIRST pour chaque CVE.
    epss: null,
    exploitable: v.exploit_available?.trim().toLowerCase() === 'true',
    exploitLibelle: texteNettoye(v.exploitability_ease ?? null, TENABLE_BORNES.libelleExploit, ecarts),
    failleLe: valeur(v.vuln_publication_date, datePublication(v.vuln_publication_date ?? null)),
    correctifLe: valeur(v.patch_publication_date, datePublication(v.patch_publication_date ?? null)),
    voirAussi: lien,
    cves: cves.slice(0, TENABLE_BORNES.cvesParConstat),
    cvesTronquees: cves.length > TENABLE_BORNES.cvesParConstat,
  };
  const ok = ConstatImportNessus.safeParse(c);
  return ok.success ? ok.data : null;
}

/** Extrait d'un document .nessus : machines et contrôles retenus pour les gravités de l'instance, éléments écartés
    comptés. Refus (ErreurImport) : racine inconnue, aucune machine, plus de machines que la borne. */
export function extraireNessus(racine: NoeudXml, gravites: readonly GraviteTenable[]): ExtraitNessus {
  if (racine.nom !== RACINE_NESSUS)
    throw new ErreurImport(
      `Fichier refusé : ce n’est pas un export .nessus (racine « ${RACINE_NESSUS} » attendue, « ${racine.nom.slice(0, 60)} » trouvée).`,
    );
  const ecarts = new Compteur();
  const retenues = new Set(gravites);
  const machines = new Map<string, MachineExtraite>();
  const constats = new Map<string, ConstatImportNessus>();
  const hotes = enfantsNommes(racine, 'Report').flatMap((r) => enfantsNommes(r, 'ReportHost'));
  for (const h of hotes) {
    const p = lireHote(h);
    const nomCible = h.attribut('name');
    const adresse = adresseIp(p['host-ip']) ?? adresseIp(nomCible);
    if (p['host-ip'] !== null && adresseIp(p['host-ip']) === null) ecarts.compter('valeursInvalides');
    const nom = nomMachine(p['host-fqdn']) ?? nomMachine(p['netbios-name']) ?? nomMachine(nomCible);
    if (p['host-fqdn'] !== null && p['host-fqdn'].trim() && nomMachine(p['host-fqdn']) === null)
      ecarts.compter('valeursInvalides');
    const uuid = p['host-uuid']?.trim().toLowerCase() ?? '';
    const cle = cleMachine(UUID.test(uuid) ? uuid : null, adresse, nom);
    if (!cle) {
      ecarts.compter('machinesSansIdentite');
      continue;
    }
    const debut = instantHote(p.HOST_START_TIMESTAMP, p.HOST_START);
    const fin = instantHote(p.HOST_END_TIMESTAMP, p.HOST_END);
    let m = machines.get(cle);
    if (!m) {
      m = {
        machine: {
          cle,
          uuid: UUID.test(uuid) ? uuid : null,
          nom,
          adresse,
          systeme: texteNettoye(p['operating-system'], TENABLE_BORNES.systeme, ecarts),
          debut,
          fin,
        },
        detections: new Map(),
      };
      machines.set(cle, m);
    } else {
      // Même machine vue deux fois dans le fichier : un seul passage, du premier début à la dernière fin.
      if (debut && (!m.machine.debut || debut < m.machine.debut)) m.machine.debut = debut;
      if (fin && (!m.machine.fin || fin > m.machine.fin)) m.machine.fin = fin;
    }
    for (const item of enfantsNommes(h, 'ReportItem')) {
      const severite = item.attribut('severity')?.trim() ?? '';
      if (severite === '0') {
        ecarts.compter('controlesInformatifs');
        continue;
      }
      const gravite = GRAVITE_DE_NESSUS[severite];
      const plugin = item.attribut('pluginID')?.trim() ?? '';
      const nomControle = texteNettoye(item.attribut('pluginName'), TENABLE_BORNES.nomControle, ecarts);
      if (!gravite || !PLUGIN_ID.test(plugin) || !nomControle) {
        ecarts.compter('controlesInvalides');
        continue;
      }
      if (!retenues.has(gravite)) {
        ecarts.compter('controlesHorsGravite');
        continue;
      }
      const portBrut = item.attribut('port')?.trim() ?? '0';
      const port = /^\d{1,5}$/.test(portBrut) && Number(portBrut) <= 65535 ? Number(portBrut) : null;
      const protoBrut = item.attribut('protocol')?.trim().toUpperCase() ?? '';
      const protocole = PROTOCOLE.test(protoBrut) ? protoBrut : null;
      if (port === null || protocole === null) ecarts.compter('valeursInvalides');
      const deja = constats.get(plugin);
      if (!deja) {
        const c = lireControle(item, plugin, nomControle, gravite, ecarts);
        if (!c) {
          ecarts.compter('controlesInvalides');
          continue;
        }
        constats.set(plugin, c);
      } else if (ordreGravite(gravite) < ordreGravite(deja.gravite)) deja.gravite = gravite;
      const d = { plugin, port: port ?? 0, protocole: protocole ?? 'UNKNOWN' };
      m.detections.set(`${d.plugin}\u0000${d.port}\u0000${d.protocole}`, d);
    }
  }
  const retenuesMachines: MachineLotNessus[] = [];
  for (const m of machines.values()) {
    if (m.detections.size > NESSUS_BORNES.detectionsParMachine) {
      ecarts.compter('machinesTropVolumineuses');
      continue;
    }
    const v = MachineLotNessus.safeParse({ machine: m.machine, detections: [...m.detections.values()] });
    if (!v.success) {
      ecarts.compter('valeursInvalides');
      continue;
    }
    retenuesMachines.push(v.data);
  }
  if (retenuesMachines.length > NESSUS_BORNES.machinesParImport)
    throw new ErreurImport(
      `Fichier refusé : ${retenuesMachines.length} machines, pour ${NESSUS_BORNES.machinesParImport} au plus par import. Exportez le scan en plusieurs fichiers.`,
    );
  // Contrôles portés par au moins une machine retenue.
  const utilises = new Set(retenuesMachines.flatMap((m) => m.detections.map((d) => d.plugin)));
  for (const p of [...constats.keys()]) if (!utilises.has(p)) constats.delete(p);
  return {
    machines: retenuesMachines,
    constats,
    ecartes: ecarts.valeurs,
    detections: retenuesMachines.reduce((s, m) => s + m.detections.length, 0),
    gravites: GRAVITES_TENABLE.filter((g) => retenues.has(g)),
  };
}

/* ------------------------------------------------------------------ Lots */
const taille = (x: unknown) => new TextEncoder().encode(JSON.stringify(x)).length;

/** Découpe en lots de machines entières : machines, détections et taille bornées ; chaque lot porte les contrôles de ses
    machines, chacun une fois. Une machine dont le lot seul dépasserait le corps admis par l'API est écartée et comptée. */
export function decouperEnLots(extrait: ExtraitNessus): LotImportNessus[] {
  const tailleConstat = new Map([...extrait.constats].map(([p, c]) => [p, taille(c)]));
  const lots: LotImportNessus[] = [];
  let courant: { machines: MachineLotNessus[]; plugins: Set<string>; detections: number; octets: number } | null = null;
  const fermer = () => {
    if (courant?.machines.length)
      lots.push({
        machines: courant.machines,
        constats: [...courant.plugins].map((p) => extrait.constats.get(p)!),
      });
    courant = null;
  };
  const gardees: MachineLotNessus[] = [];
  for (const m of extrait.machines) {
    const plugins = new Set(m.detections.map((d) => d.plugin));
    const seule = taille(m) + [...plugins].reduce((s, p) => s + tailleConstat.get(p)!, 0);
    if (seule > NESSUS_BORNES.corpsLot - 1024) {
      extrait.ecartes.machinesTropVolumineuses += 1;
      continue;
    }
    gardees.push(m);
    const c: { machines: MachineLotNessus[]; plugins: Set<string>; detections: number; octets: number } = courant ?? {
      machines: [],
      plugins: new Set(),
      detections: 0,
      octets: 0,
    };
    const nouveaux = [...plugins].filter((p) => !c.plugins.has(p));
    const ajout = taille(m) + nouveaux.reduce((s, p) => s + tailleConstat.get(p)!, 0);
    const deborde =
      c.machines.length >= NESSUS_BORNES.machinesParLot ||
      c.detections + m.detections.length > NESSUS_BORNES.detectionsParLot ||
      c.plugins.size + nouveaux.length > NESSUS_BORNES.constatsParLot ||
      c.octets + ajout > NESSUS_BORNES.octetsParLot;
    if (c.machines.length && deborde) {
      fermer();
      courant = { machines: [m], plugins: plugins, detections: m.detections.length, octets: seule };
    } else {
      c.machines.push(m);
      for (const p of nouveaux) c.plugins.add(p);
      c.detections += m.detections.length;
      c.octets += ajout;
      courant = c;
    }
  }
  fermer();
  if (gardees.length !== extrait.machines.length) {
    extrait.machines = gardees;
    extrait.detections = gardees.reduce((s, m) => s + m.detections.length, 0);
  }
  return lots;
}

/* ------------------------------------------------------------------ Textes */
const pluriel = (n: number, un: string, plusieurs: string) => `${n.toLocaleString('fr-FR')} ${n > 1 ? plusieurs : un}`;

/** Éléments écartés, en clair (seulement ceux qui comptent). */
export function libelleEcartes(e: EcartsImportNessus): string {
  const l = ECARTS_IMPORT.filter((k) => e[k] > 0).map(
    (k) => `${ECART_IMPORT_LIBELLES[k]} : ${e[k].toLocaleString('fr-FR')}`,
  );
  return l.length ? l.join(' ; ') : 'aucun';
}

export const libelleGravitesImport = (g: readonly GraviteTenable[]) =>
  g.map((x) => GRAVITE_TENABLE_LIBELLES[x]).join(', ');

/** Ce que le fichier apporte, avant l'envoi. */
export function resumeExtrait(x: ExtraitNessus): string {
  return `${pluriel(x.machines.length, 'machine', 'machines')} et ${pluriel(x.constats.size, 'faille', 'failles')} (${pluriel(x.detections, 'détection', 'détections')}) à importer ; gravités retenues : ${libelleGravitesImport(x.gravites)}.`;
}

/** Bilan lisible d'un import (exécution de l'instance) : nombres seulement. */
export function resumeBilanImport(b: BilanImportNessus): string {
  return [
    `Import : ${pluriel(b.machines, 'machine', 'machines')} sur ${b.machinesAnnoncees}, ${pluriel(b.constats, 'faille', 'failles')} (${pluriel(b.detections, 'détection', 'détections')}) en ${pluriel(b.lots, 'lot', 'lots')}.`,
    b.disparues
      ? `${pluriel(b.disparues, 'détection disparue', 'détections disparues')} sur les machines scannées.`
      : '',
    `Gravités retenues : ${libelleGravitesImport(b.gravites)}.`,
    `Écartés : ${libelleEcartes(b.ecartes)}.`,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Machines du dernier import, pour l'état en lecture seule des écrans du module (« 3 machines »). */
export const machinesImportees = (b: Pick<BilanImportNessus, 'machines'>) => pluriel(b.machines, 'machine', 'machines');

/** Nom affiché d'une machine du fichier (sur le poste seulement). */
export const nomAffiche = (m: MachineLotNessus) => m.machine.nom ?? m.machine.adresse ?? m.machine.cle;

/** Machines importées et non importées après un arrêt : listes bornées pour l'écran (vingt noms, puis « et N autres »). */
export function listeBornee(noms: readonly string[], max = 20): string {
  if (!noms.length) return 'aucune';
  const tete = noms.slice(0, max).join(', ');
  return noms.length > max ? `${tete} et ${noms.length - max} autres` : tete;
}

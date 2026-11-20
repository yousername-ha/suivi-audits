/* Module Vulnérabilités (ADR 0100, lot SI1) : lecture du rapport Silène de l'ANSSI (export JSON) dans le navigateur, sans
   dépendance (`JSON.parse`). Seul un extrait en liste blanche est envoyé à l'API, en JSON, par lots ; le fichier complet ne
   quitte jamais le poste, et ces parties ne sont même pas lues : certificats et clés (`ssl-cert`, `pem`, `pubkey`,
   empreintes), en-têtes HTTP et sorties brutes des sondes (`scripts`), titres de pages, géolocalisation et système autonome
   (`infos`), `db_name`, `filter`, `networks`, passage précédent (`_prev`), sujet et noms d'un certificat dans le détail
   d'un constat (`subject`, `san`), origines d'un produit. Le nom du fichier n'est jamais envoyé.
   Tout élément hors norme est écarté et compté (jamais tronqué en silence ; un texte raccourci à sa borne porte « … » et est
   compté). Fonctions pures, testées hors navigateur. Forme écrite d'après un relevé des seuls noms de champs, types et
   nombres d'un export réel : AUCUNE valeur réelle n'est connue ; sens de `result_class`, échelle de `grade` et format exact
   des dates de 19 caractères non vérifiés. */
import {
  ADRESSE_IP,
  type BilanImportSilene,
  CLASSE_SILENE_MAX,
  CLASSE_SILENE_MIN,
  CONTROLE_SILENE,
  type ConstatSilene,
  DATE_SILENE,
  ECART_SILENE_LIBELLES,
  ECARTS_SILENE,
  type EcartSilene,
  type EcartsImportSilene,
  ecartsSileneVides,
  type HoteSilene,
  IDENTIFIANT_CONSTAT_SILENE,
  type LigneSilene,
  type LotImportSilene,
  NOM_DOMAINE_ALH,
  NOTE_SILENE_MAX,
  type NomHoteSilene,
  plageSileneValide,
  type PerimetreDeclareSilene,
  type PortSilene,
  type ProduitSilene,
  PROTOCOLES_SILENE,
  type RapportSilene,
  SILENE_BORNES,
  texteExterneValide,
  TYPES_CPE_SILENE,
  TYPES_NOM_SILENE,
} from '@suivi/shared';

export class ErreurImportSilene extends Error {}

const MO = 1_000_000;

/** Taille du fichier : au-delà de la borne, refus avec un message clair (avant toute lecture). */
export function erreurTailleSilene(octets: number): string | null {
  if (octets <= 0) return 'Fichier vide.';
  if (octets > SILENE_BORNES.fichierMo * MO)
    return `Fichier trop volumineux : ${(octets / MO).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo, pour ${SILENE_BORNES.fichierMo} Mo au plus. Un rapport Silène dépasse rarement cette taille : vérifiez qu’il s’agit bien de l’export JSON du rapport.`;
  return null;
}

/** Analyse du texte (JSON seulement) ; une erreur d'analyse vaut refus. */
export function lireJson(texte: string): unknown {
  try {
    return JSON.parse(texte) as unknown;
  } catch {
    throw new ErreurImportSilene('Fichier refusé : ce n’est pas un fichier JSON valide.');
  }
}

/* ------------------------------------------------------------------ Valeurs */
type Objet = Record<string, unknown>;
const objet = (v: unknown): v is Objet => typeof v === 'object' && v !== null && !Array.isArray(v);
const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const champ = (o: unknown, nom: string): unknown => (objet(o) && Object.hasOwn(o, nom) ? o[nom] : undefined);

/** Compteur des éléments écartés. */
export class CompteurSilene {
  readonly valeurs: EcartsImportSilene = ecartsSileneVides();
  compter(e: EcartSilene, n = 1) {
    this.valeurs[e] += n;
  }
}

// eslint-disable-next-line no-control-regex
const CONTROLES = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g;
/** Texte simple sur une ligne : caractères de contrôle et invisibles remplacés, espaces réduits, « < » suivi d'une lettre
    remplacé, longueur bornée (« … » et compté). Vide ou non texte : null ; refusé par la règle commune : null et compté. */
export function texteSilene(v: unknown, ecarts: CompteurSilene, maximum: number = SILENE_BORNES.texte): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string' && typeof v !== 'number') {
    ecarts.compter('valeursInvalides');
    return null;
  }
  let t = String(v)
    .slice(0, maximum * 20)
    .replace(CONTROLES, ' ')
    .replace(/<(?=[A-Za-z/!?])/g, '‹')
    .split(/\s+/u)
    .filter(Boolean)
    .join(' ');
  if (!t) return null;
  if (t.length > maximum) {
    ecarts.compter('textesRaccourcis');
    t = `${t.slice(0, maximum - 1).trimEnd()}…`;
  }
  if (!texteExterneValide(t)) {
    ecarts.compter('valeursInvalides');
    return null;
  }
  return t;
}

/** Adresse IP (IPv4, ou IPv6 en minuscules), sinon null. */
export function adresseSilene(v: unknown): string | null {
  const a = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return a && a.length <= 45 && ADRESSE_IP.test(a) ? a : null;
}

/** Nom de domaine en minuscules (point final retiré), sinon null. */
export function domaineSilene(v: unknown): string | null {
  let n = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (n.endsWith('.')) n = n.slice(0, -1);
  return n && n.length <= SILENE_BORNES.nomDomaine && NOM_DOMAINE_ALH.test(n) && !adresseSilene(n) ? n : null;
}

/** Horodatage de 19 caractères (« AAAA-MM-JJ HH:MM:SS » ou « AAAA-MM-JJTHH:MM:SS »), normalisé « AAAA-MM-JJTHH:MM:SS »,
    sans fuseau ; absent : null ; autre forme : null et compté. */
export function horodatageSilene(v: unknown, ecarts: CompteurSilene): string | null {
  if (v === undefined || v === null || v === '') return null;
  const m = typeof v === 'string' ? /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(v.trim()) : null;
  const t = m ? `${m[1]}T${m[2]}` : null;
  if (t && /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(t)) return t;
  ecarts.compter('valeursInvalides');
  return null;
}

/** Note ou points : nombre fini borné, arrondi à quatre décimales ; absent : null ; hors norme : null et compté. */
export function noteSilene(v: unknown, ecarts: CompteurSilene): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= NOTE_SILENE_MAX)
    return Math.round(v * 10000) / 10000;
  ecarts.compter('valeursInvalides');
  return null;
}

/** Nombre entier positif ou nul (au plus `max`) ; absent : null ; hors norme : null et compté. */
export function compteSilene(v: unknown, ecarts: CompteurSilene, max = 10_000_000): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max) return v;
  ecarts.compter('valeursInvalides');
  return null;
}

const port = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 65535 ? v : null;
const protocole = (v: unknown): PortSilene['protocole'] | null => {
  const p = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return (PROTOCOLES_SILENE as readonly string[]).includes(p) ? (p as PortSilene['protocole']) : null;
};

/* ------------------------------------------------------------------ Extraction */
export interface ExtraitSilene {
  rapport: RapportSilene;
  perimetre: PerimetreDeclareSilene;
  hotes: HoteSilene[];
  constats: ConstatSilene[];
  ecartes: EcartsImportSilene;
}

/** Champs lus à la racine (tous les autres sont ignorés, sans être lus). */
export const CHAMPS_RACINE = ['computation_date', 'summary', 'perimeter', 'modules', 'results', 'hosts'] as const;
/** Champs lus dans un hôte. */
export const CHAMPS_HOTE = ['addr', 'hostnames', 'cpes', 'openports', 'ports', 'categories'] as const;
/** Champs lus dans un port d'un hôte (jamais `scripts`, ni les raisons de l'état). */
export const CHAMPS_PORT = [
  'port',
  'protocol',
  'state_state',
  'service_name',
  'service_product',
  'service_tunnel',
] as const;
/** Champs lus dans un constat et dans une ligne de son détail (jamais `subject`, `san`, `domain`, `version`). */
export const CHAMPS_CONSTAT = ['id', 'result_class', 'max_points', 'grades', 'applicable_hosts', 'listing'] as const;
export const CHAMPS_LIGNE = ['addr', 'hostname', 'port', 'protocol', 'service', 'product', 'type', 'expires'] as const;

function lireRapport(racine: Objet, ecarts: CompteurSilene): RapportSilene {
  const resume = champ(racine, 'summary');
  const brute = champ(champ(resume, 'computation_date'), 'v') ?? champ(champ(racine, 'computation_date'), 'v');
  let date: string | null = null;
  if (brute !== undefined && brute !== null) {
    const d = typeof brute === 'string' ? brute.trim().slice(0, 10) : '';
    if (DATE_SILENE.test(d)) date = d;
    else ecarts.compter('valeursInvalides');
  }
  return {
    date,
    debut: horodatageSilene(champ(resume, 'starttime'), ecarts),
    fin: horodatageSilene(champ(resume, 'endtime'), ecarts),
    note: noteSilene(champ(resume, 'grade'), ecarts),
    noteReseau: noteSilene(champ(champ(resume, 'grades'), 'network'), ecarts),
    vulnreco: compteSilene(champ(resume, 'vulnreco_count'), ecarts),
    warning: compteSilene(champ(resume, 'warning_count'), ecarts),
    info: compteSilene(champ(resume, 'info_count'), ecarts),
    ok: compteSilene(champ(resume, 'ok_count'), ecarts),
  };
}

function lirePerimetre(racine: Objet, ecarts: CompteurSilene): PerimetreDeclareSilene {
  const p = champ(racine, 'perimeter');
  const domaines = new Set<string>();
  for (const d of tableau(champ(p, 'domains'))) {
    const n = domaineSilene(d);
    if (!n || domaines.size >= SILENE_BORNES.perimetreDomaines) ecarts.compter('perimetreInvalide');
    else domaines.add(n);
  }
  const plages = new Set<string>();
  for (const x of tableau(champ(p, 'ip'))) {
    const v = typeof x === 'string' ? x.trim().toLowerCase() : '';
    if (!v || !plageSileneValide(v) || plages.size >= SILENE_BORNES.perimetrePlages)
      ecarts.compter('perimetreInvalide');
    else plages.add(v);
  }
  return { domaines: [...domaines], plages: [...plages] };
}

function lireHote(cle: string, h: unknown, ecarts: CompteurSilene): HoteSilene | null {
  if (!objet(h)) {
    ecarts.compter('hotesInvalides');
    return null;
  }
  const adresse = adresseSilene(champ(h, 'addr')) ?? adresseSilene(cle);
  if (!adresse) {
    ecarts.compter('hotesInvalides');
    return null;
  }
  const noms: NomHoteSilene[] = [];
  for (const n of tableau(champ(h, 'hostnames'))) {
    const nom = domaineSilene(champ(n, 'name'));
    const type = champ(n, 'type');
    if (!nom || typeof type !== 'string' || !(TYPES_NOM_SILENE as readonly string[]).includes(type)) {
      ecarts.compter('nomsInvalides');
      continue;
    }
    if (noms.some((x) => x.nom === nom && x.type === type)) continue;
    if (noms.length >= SILENE_BORNES.nomsParHote) ecarts.compter('nomsInvalides');
    else noms.push({ nom, type: type as NomHoteSilene['type'] });
  }
  const ports = new Map<string, PortSilene>();
  for (const p of tableau(champ(h, 'ports'))) {
    const etat = champ(p, 'state_state');
    // Un port qui n'est pas annoncé ouvert n'est pas un port ouvert : ignoré sans être compté.
    if (etat !== undefined && etat !== 'open') continue;
    const n = port(champ(p, 'port'));
    const pr = protocole(champ(p, 'protocol'));
    if (n === null || pr === null) {
      ecarts.compter('portsInvalides');
      continue;
    }
    const cleP = `${n}/${pr}`;
    if (ports.has(cleP)) continue;
    ports.set(cleP, {
      port: n,
      protocole: pr,
      service: texteSilene(champ(p, 'service_name'), ecarts),
      produit: texteSilene(champ(p, 'service_product'), ecarts),
      tunnel: texteSilene(champ(p, 'service_tunnel'), ecarts),
    });
  }
  const ouverts = champ(h, 'openports');
  for (const pr of PROTOCOLES_SILENE)
    for (const x of tableau(champ(champ(ouverts, pr), 'ports'))) {
      const n = port(x);
      if (n === null) {
        ecarts.compter('portsInvalides');
        continue;
      }
      if (!ports.has(`${n}/${pr}`))
        ports.set(`${n}/${pr}`, { port: n, protocole: pr, service: null, produit: null, tunnel: null });
    }
  const tries = [...ports.values()].sort(
    (a, b) => a.port - b.port || PROTOCOLES_SILENE.indexOf(a.protocole) - PROTOCOLES_SILENE.indexOf(b.protocole),
  );
  if (tries.length > SILENE_BORNES.portsParHote)
    ecarts.compter('portsAuDela', tries.length - SILENE_BORNES.portsParHote);
  const produits: ProduitSilene[] = [];
  for (const c of tableau(champ(h, 'cpes'))) {
    const type = champ(c, 'type');
    const editeur = texteSilene(champ(c, 'vendor'), ecarts);
    const produit = texteSilene(champ(c, 'product'), ecarts);
    const version = texteSilene(champ(c, 'version'), ecarts);
    if (typeof type !== 'string' || !(TYPES_CPE_SILENE as readonly string[]).includes(type) || !editeur || !produit) {
      ecarts.compter('produitsInvalides');
      continue;
    }
    const p: ProduitSilene = { type: type as ProduitSilene['type'], editeur, produit, version };
    if (
      produits.some(
        (x) => x.type === p.type && x.editeur === p.editeur && x.produit === p.produit && x.version === p.version,
      )
    )
      continue;
    if (produits.length >= SILENE_BORNES.produitsParHote) ecarts.compter('produitsInvalides');
    else produits.push(p);
  }
  const controles: string[] = [];
  for (const c of tableau(champ(h, 'categories'))) {
    if (typeof c !== 'string' || !CONTROLE_SILENE.test(c)) {
      ecarts.compter('controlesInvalides');
      continue;
    }
    if (controles.includes(c)) continue;
    if (controles.length >= SILENE_BORNES.controlesParHote) ecarts.compter('controlesInvalides');
    else controles.push(c);
  }
  return {
    adresse,
    noms,
    ports: tries.slice(0, SILENE_BORNES.portsParHote),
    portsOuverts: compteSilene(champ(ouverts, 'count'), ecarts, 131070),
    produits,
    controles,
  };
}

function lireLignes(listing: unknown, ecarts: CompteurSilene): LigneSilene[] {
  const lignes: LigneSilene[] = [];
  if (!objet(listing)) return lignes;
  for (const [cle, items] of Object.entries(listing)) {
    let parHote = 0;
    for (const it of tableau(items)) {
      if (!objet(it)) {
        ecarts.compter('lignesInvalides');
        continue;
      }
      const hote = adresseSilene(champ(it, 'addr')) ?? adresseSilene(cle);
      if (!hote) {
        ecarts.compter('lignesInvalides');
        continue;
      }
      if (parHote >= SILENE_BORNES.lignesParHote || lignes.length >= SILENE_BORNES.lignesParConstat) {
        ecarts.compter('lignesAuDela');
        continue;
      }
      const brutPort = champ(it, 'port');
      const p = port(brutPort);
      if (brutPort !== undefined && brutPort !== null && p === null) ecarts.compter('valeursInvalides');
      const brutNom = champ(it, 'hostname');
      const nomHote = domaineSilene(brutNom);
      if (brutNom !== undefined && brutNom !== null && brutNom !== '' && !nomHote) ecarts.compter('valeursInvalides');
      lignes.push({
        hote,
        port: p,
        protocole: protocole(champ(it, 'protocol')),
        service: texteSilene(champ(it, 'service'), ecarts),
        produit: texteSilene(champ(it, 'product'), ecarts),
        nomHote,
        type: texteSilene(champ(it, 'type'), ecarts),
        echeance: horodatageSilene(champ(it, 'expires'), ecarts),
      });
      parHote += 1;
    }
  }
  return lignes;
}

/** Extrait en liste blanche d'un rapport Silène déjà analysé (`JSON.parse`). Structure inconnue : refus. */
export function extraireSilene(racine: unknown): ExtraitSilene {
  if (
    !objet(racine) ||
    !objet(champ(racine, 'summary')) ||
    !objet(champ(racine, 'hosts')) ||
    !objet(champ(racine, 'results')) ||
    !objet(champ(racine, 'modules'))
  )
    throw new ErreurImportSilene(
      'Structure inconnue : ce fichier n’est pas un rapport Silène (objet JSON avec « summary », « modules », « results » et « hosts » attendu).',
    );
  const ecarts = new CompteurSilene();
  const rapport = lireRapport(racine, ecarts);
  const perimetre = lirePerimetre(racine, ecarts);

  // Contrôle de chaque constat : le module (contrôle) dont la liste `results` cite son identifiant.
  const controleDe = new Map<string, string>();
  for (const [nom, m] of Object.entries(champ(racine, 'modules') as Objet)) {
    if (!CONTROLE_SILENE.test(nom)) {
      ecarts.compter('controlesInvalides');
      continue;
    }
    for (const r of tableau(champ(m, 'results')))
      if (typeof r === 'string' && !controleDe.has(r)) controleDe.set(r, nom);
  }

  const hotes = new Map<string, HoteSilene>();
  for (const [cle, h] of Object.entries(champ(racine, 'hosts') as Objet)) {
    const x = lireHote(cle, h, ecarts);
    if (!x) continue;
    if (hotes.has(x.adresse)) {
      ecarts.compter('hotesInvalides');
      continue;
    }
    if (hotes.size >= SILENE_BORNES.hotesParImport) ecarts.compter('hotesAuDela');
    else hotes.set(x.adresse, x);
  }

  const constats = new Map<string, ConstatSilene>();
  for (const [cle, r] of Object.entries(champ(racine, 'results') as Objet)) {
    const identifiant = champ(r, 'id');
    const classe = champ(r, 'result_class');
    if (
      typeof identifiant !== 'string' ||
      !IDENTIFIANT_CONSTAT_SILENE.test(identifiant) ||
      typeof classe !== 'number' ||
      !Number.isInteger(classe) ||
      classe < CLASSE_SILENE_MIN ||
      classe > CLASSE_SILENE_MAX ||
      constats.has(identifiant)
    ) {
      ecarts.compter('constatsInvalides');
      continue;
    }
    const controle = controleDe.get(identifiant) ?? controleDe.get(cle);
    if (!controle) {
      ecarts.compter('constatsSansControle');
      continue;
    }
    if (constats.size >= SILENE_BORNES.constatsParImport) {
      ecarts.compter('constatsAuDela');
      continue;
    }
    const concernes: string[] = [];
    for (const a of tableau(champ(r, 'applicable_hosts'))) {
      const x = adresseSilene(a);
      if (!x) ecarts.compter('valeursInvalides');
      else if (!concernes.includes(x) && concernes.length < SILENE_BORNES.hotesParConstat) concernes.push(x);
    }
    constats.set(identifiant, {
      identifiant,
      controle,
      classe,
      points: noteSilene(champ(champ(r, 'max_points'), 'network'), ecarts),
      note: noteSilene(champ(champ(r, 'grades'), 'network'), ecarts),
      hotes: concernes,
      lignes: lireLignes(champ(r, 'listing'), ecarts),
    });
  }
  return { rapport, perimetre, hotes: [...hotes.values()], constats: [...constats.values()], ecartes: ecarts.valeurs };
}

/* ------------------------------------------------------------------ Lots */
const taille = (x: unknown) => new TextEncoder().encode(JSON.stringify(x)).length;

/** Lots bornés (nombre et taille visée) : les hôtes d'abord, puis les constats ; aucun élément n'est coupé. */
export function decouperEnLotsSilene(extrait: ExtraitSilene): LotImportSilene[] {
  const lots: LotImportSilene[] = [];
  let hotes: HoteSilene[] = [];
  let octets = 0;
  for (const h of extrait.hotes) {
    const t = taille(h);
    if (hotes.length && (hotes.length >= SILENE_BORNES.hotesParLot || octets + t > SILENE_BORNES.octetsParLot)) {
      lots.push({ hotes, constats: [] });
      hotes = [];
      octets = 0;
    }
    hotes.push(h);
    octets += t;
  }
  if (hotes.length) lots.push({ hotes, constats: [] });
  let constats: ConstatSilene[] = [];
  octets = 0;
  for (const c of extrait.constats) {
    const t = taille(c);
    if (
      constats.length &&
      (constats.length >= SILENE_BORNES.constatsParLot || octets + t > SILENE_BORNES.octetsParLot)
    ) {
      lots.push({ hotes: [], constats });
      constats = [];
      octets = 0;
    }
    constats.push(c);
    octets += t;
  }
  if (constats.length) lots.push({ hotes: [], constats });
  return lots;
}

/* ------------------------------------------------------------------ Libellés */
const pluriel = (n: number, un: string, plusieurs: string) => `${n.toLocaleString('fr-FR')} ${n > 1 ? plusieurs : un}`;

export function libelleEcartsSilene(e: EcartsImportSilene): string {
  const l = ECARTS_SILENE.filter((k) => e[k] > 0).map(
    (k) => `${ECART_SILENE_LIBELLES[k]} : ${e[k].toLocaleString('fr-FR')}`,
  );
  return l.length ? l.join(' ; ') : 'aucun';
}

/** « 3 hôtes, 12 ports ouverts et 2 constats à importer (rapport du 15/11/2026, note 14,5). » */
export function resumeExtraitSilene(x: ExtraitSilene): string {
  const ports = x.hotes.reduce((s, h) => s + h.ports.length, 0);
  const date = x.rapport.date ? `rapport du ${x.rapport.date.split('-').reverse().join('/')}` : 'rapport sans date';
  const note = x.rapport.note === null ? 'sans note' : `note ${x.rapport.note.toLocaleString('fr-FR')}`;
  return `${pluriel(x.hotes.length, 'hôte', 'hôtes')}, ${pluriel(ports, 'port ouvert', 'ports ouverts')} et ${pluriel(x.constats.length, 'constat', 'constats')} à importer (${date}, ${note}).`;
}

export function resumeBilanSilene(b: BilanImportSilene): string {
  return [
    `Import : ${pluriel(b.hotes, 'hôte', 'hôtes')} sur ${b.hotesAnnonces}, ${pluriel(b.constats, 'constat', 'constats')} sur ${b.constatsAnnonces}, en ${pluriel(b.lots, 'lot', 'lots')}.`,
    b.hotesDisparus || b.constatsDisparus
      ? `Plus présents depuis le rapport précédent : ${pluriel(b.hotesDisparus, 'hôte', 'hôtes')}, ${pluriel(b.constatsDisparus, 'constat', 'constats')}.`
      : '',
    `Écartés : ${libelleEcartsSilene(b.ecartes)}.`,
  ]
    .filter(Boolean)
    .join(' ');
}

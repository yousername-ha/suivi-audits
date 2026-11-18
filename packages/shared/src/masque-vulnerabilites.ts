/* Module Vulnérabilités et assistant RSSI (ADR 0100, décision V31) : liste de mots à ne pas masquer. Le masque des machines
   (apps/api/src/assistant/masque.ts) reste strict : tout nom, adresse ou identifiant de machine de l'inventaire est remplacé
   par un repère ou par « [machine] » avant l'envoi au fournisseur du modèle. Quand une machine porte le nom d'une application
   (« dpi », « pacs », « web »), ce mot serait masqué partout ; la liste, tenue avec le droit d'administrer le module, lève ce
   contresens mot par mot : un mot de la liste qui apparaît seul n'est plus masqué. Un mot est un mot : lettres et chiffres
   (toute écriture) et tirets, ni point, ni espace, ni « \ », ni « : » ; il ne peut donc être ni un nom complet, ni une
   adresse ; la forme d'un identifiant de Tenable (UUID) et celle d'un repère (« M-001 ») sont refusées en plus. Fonctions
   pures. */
import { z } from 'zod';

export const MOTS_NON_MASQUES_MAX = 200;
export const MOT_NON_MASQUE_MIN = 2;
export const MOT_NON_MASQUE_MAX = 60;
/** Lettres et chiffres de toute écriture, tirets à l'intérieur seulement. */
const FORME = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u;
/** Identifiant de Tenable (UUID), avec ou sans tirets. */
const UUID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i;
/** Repère d'une machine dans une conversation (« M-001 »), quel que soit le nombre de chiffres. */
const REPERE = /^m-\d+$/i;

/** Motif du refus d'un mot (déjà débarrassé de ses espaces autour), ou null s'il est admis. */
export function refusMotNonMasque(mot: string): string | null {
  const n = [...mot].length;
  if (n < MOT_NON_MASQUE_MIN || n > MOT_NON_MASQUE_MAX)
    return `Un mot fait de ${MOT_NON_MASQUE_MIN} à ${MOT_NON_MASQUE_MAX} caractères.`;
  if (!FORME.test(mot))
    return 'Un mot ne contient que des lettres, des chiffres et des tirets (ni point, ni espace, ni « \\ », ni « : ») et ne commence ni ne finit par un tiret.';
  if (UUID.test(mot)) return 'Un identifiant de Tenable ne peut pas être laissé sans masque.';
  if (REPERE.test(mot)) return 'Un repère de machine ne peut pas être un mot de la liste.';
  return null;
}
/** Le mot est admis dans la liste (forme seule ; les doublons se contrôlent sur la liste). */
export const motNonMasqueAdmis = (mot: string): boolean => refusMotNonMasque(mot) === null;
/** Clé de comparaison d'un mot : sans tenir compte de la casse. */
export const cleMotNonMasque = (mot: string): string => mot.normalize('NFC').toLowerCase();

export const MotNonMasque = z
  .string()
  .trim()
  .normalize('NFC')
  .superRefine((mot, ctx) => {
    const refus = refusMotNonMasque(mot);
    if (refus) ctx.addIssue({ code: 'custom', message: refus });
  });

/** Réglage rangé dans `settings` (clé `vulnerabilites:masque`) : liste vide par défaut (masque strict). */
export const ReglageMasque = z
  .object({
    mots: z.array(MotNonMasque).max(MOTS_NON_MASQUES_MAX, `${MOTS_NON_MASQUES_MAX} mots au plus.`),
  })
  .strict()
  .superRefine((r, ctx) => {
    const vus = new Set<string>();
    r.mots.forEach((mot, i) => {
      const k = cleMotNonMasque(mot);
      if (vus.has(k))
        ctx.addIssue({ code: 'custom', path: ['mots', i], message: `Le mot « ${mot} » figure déjà dans la liste.` });
      vus.add(k);
    });
  });
export type ReglageMasque = z.infer<typeof ReglageMasque>;
export const REGLAGE_MASQUE_DEFAUT: ReglageMasque = { mots: [] };

/** Noms de machines rendus au plus pour un mot (les autres sont comptés). */
export const EFFET_MOT_NOMS_MAX = 20;

/** Ce qu'un mot laisse sortir : machines de l'inventaire dont il est le nom court (premier libellé, partie après « \ », nom
    sans « $ ») ou le nom entier. `noms` : seulement les machines que la personne peut lire, 20 au plus. */
export interface EffetMotNonMasque {
  mot: string;
  machines: number;
  noms: string[];
  /** Machines désignées que la personne ne peut pas lire (comptées, jamais nommées). */
  nonLisibles: number;
}

export interface ReglageMasqueOut {
  values: ReglageMasque;
  version: number;
  effets: EffetMotNonMasque[];
}

export const EffetMotQuery = z.object({ mot: MotNonMasque }).strict();

/** Phrase de l'effet d'un mot, pour l'écran. */
export function libelleEffetMot(e: Pick<EffetMotNonMasque, 'machines'>): string {
  if (e.machines === 0)
    return 'Ce mot ne désigne aucune machine de l’inventaire : il n’a aucun effet aujourd’hui (il n’est pas masqué).';
  const n = e.machines === 1 ? 'd’une machine' : `de ${e.machines} machines`;
  return `Ce mot est aussi le nom court ${n} : il partira chez le fournisseur du modèle quand quelqu’un l’écrit.`;
}

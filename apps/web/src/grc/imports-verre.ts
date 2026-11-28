/* Import et rapports en style « Verre » (dessin DocImports validé par le RSSI le 28/11/2026) : fonctions pures, testées
   sans navigateur (apps/web/test/imports-verre.test.tsx).
   La simulation de l'API (POST /api/grc/:smsi/import/preview) rend, pour un référentiel : le nombre de domaines et
   d'exigences, l'identifiant de simulation, l'avertissement de source non vérifiée, la présence d'un référentiel de même
   identifiant (doublon) et l'autorisation d'importer. Elle ne rend ni fiches créées, mises à jour ou rejetées, ni détail
   par feuille : ces chiffres du dessin ne sont pas affichés. Un fichier refusé l'est en entier (422), avec ses motifs. */

/** Réponse de la simulation, telle que rendue par l'API (champs lus par l'écran). */
export interface SimulationImport {
  previewId: string;
  canImport: boolean;
  duplicate: boolean;
  requirements: number;
  domains: number;
  warning?: string | null;
  definition?: { name?: string; identifier?: string };
}

export type EtatEtape = 'fait' | 'en-cours' | 'a-venir' | 'bloque';
export interface EtapeImport {
  cle: 'choisir' | 'simuler' | 'appliquer';
  libelle: string;
  etat: EtatEtape;
}

/** Trois étapes visibles : choisir le fichier (ou coller son contenu), simuler, appliquer. Une simulation refusée ou
    signalant un doublon bloque l'étape « Appliquer ». */
export function etapesImport(contenu: boolean, simulation: Pick<SimulationImport, 'canImport'> | null): EtapeImport[] {
  return [
    { cle: 'choisir', libelle: 'Choisir le fichier', etat: contenu ? 'fait' : 'en-cours' },
    { cle: 'simuler', libelle: 'Simuler', etat: simulation ? 'fait' : contenu ? 'en-cours' : 'a-venir' },
    {
      cle: 'appliquer',
      libelle: 'Appliquer',
      etat: !simulation ? 'a-venir' : simulation.canImport ? 'en-cours' : 'bloque',
    },
  ];
}

const PREFIXE_INVALIDE = /^Données invalides\s*[—-]\s*/;

/** Motifs d'un refus de la simulation : le message de validation du serveur (« Données invalides — champ : motif ;
    … ») découpé en un motif par anomalie ; tout autre message tel quel. */
export function motifsRefus(message: string): string[] {
  const m = message.trim();
  if (!m) return [];
  if (!PREFIXE_INVALIDE.test(m)) return [m];
  return m
    .replace(PREFIXE_INVALIDE, '')
    .split(' ; ')
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Heure de la simulation : « 10 h 42 ». */
export function heureSimulation(d: Date): string {
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
}

/* Jeu de données fictif du RSSI virtuel (donnees/gcs-fictif.json), typé pour les tests. */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface LigneDdaFictive {
  mesure: string;
  applicable: 'oui' | 'non';
  niveau: '' | 'Total' | 'Partiel' | 'Insuffisant';
  justification: string;
}
export interface EcartFictif {
  titre: string;
  source: 'Interne' | 'AFNOR';
  classification: 'majeure' | 'mineure' | 'point_sensible';
  mesures: string[];
  action: string;
}
export interface DonneesFictives {
  organisation: { nom: string };
  dda: LigneDdaFictive[];
  ecarts: EcartFictif[];
}

const donnees = JSON.parse(
  readFileSync(path.join(import.meta.dirname, 'donnees', 'gcs-fictif.json'), 'utf8'),
) as DonneesFictives;
export default donnees;

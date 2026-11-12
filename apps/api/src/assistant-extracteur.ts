/* Processus d'extraction de texte (ADR 0086, point 12) : lancé par l'API pour UN document, avec le modèle de permissions de
   Node (aucune écriture, aucune lecture hors du code de l'application, aucun processus fils), sans variable d'environnement
   et avec une mémoire bornée. Il reçoit le fichier sur son entrée standard et rend un JSON sur sa sortie. Un fichier piégé
   ne peut atteindre ni la base, ni les secrets, ni le réseau de l'API. */
import { extraireTexte } from './assistant/extraction.js';

const morceaux: Buffer[] = [];
process.stdin.on('data', (c: Buffer) => morceaux.push(c));
process.stdin.on('end', () => {
  process.stdout.write(JSON.stringify(extraireTexte(process.argv[2] ?? '', Buffer.concat(morceaux))));
});

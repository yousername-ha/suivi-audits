/* Modèle de document d'une revue de direction (ISO 9001:2015, 9.3) : compte rendu et support projeté, construits à partir de
   la fiche de revue de la plateforme. Rien n'est interprété ni complété : une rubrique vide est signalée « À renseigner ». */
import { ENTREES_REVUE, SORTIES_REVUE, cleEntree } from '@suivi/shared';
import type { ModeleDocument } from './office.js';

const A_RENSEIGNER = 'À renseigner';
const STATUTS: Record<string, string> = { draft: 'Brouillon', review: 'En relecture', validated: 'Validée' };
const jour = (d: string) => (/^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10).split('-').reverse().join('/') : d);
const texte = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const lignes = (v: unknown) =>
  texte(v)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

export function modeleRevue(fiche: { name: string; data: Record<string, unknown> }): ModeleDocument {
  const d = fiche.data;
  const date = jour(texte(d.heldAt));
  const statut = STATUTS[texte(d.status)] ?? texte(d.status);
  const rubrique = (titre: string, valeur: unknown) => ({
    titre,
    paragraphes: lignes(valeur).length ? lignes(valeur) : [A_RENSEIGNER],
  });
  return {
    titre: fiche.name || 'Revue de direction',
    sousTitre: [date && `Revue du ${date}`, statut && `Statut : ${statut}`].filter(Boolean).join(' — '),
    sections: [
      rubrique('Participants', d.participants),
      rubrique('Éléments généraux', d.inputs),
      ...ENTREES_REVUE.map((e) => rubrique(`${e.titre} (${e.article})`, d[cleEntree(e.id)])),
      ...SORTIES_REVUE.map((s) => rubrique(`${s.titre} (${s.article})`, d[s.cle])),
      rubrique('Décisions', d.decisions),
      rubrique('Suivi', d.followup),
    ],
  };
}

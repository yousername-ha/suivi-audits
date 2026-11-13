/* Gestion CRRC (reprise de la page de l'outil de suivi) : lecture de l'état, écriture et éléments communs aux pages. */
import { Pagination, Group, Text } from '@mantine/core';
import { useState } from 'react';
import { niveauCrrc, type EtatCrrc, type NiveauCrrc } from '@suivi/shared';
import { StatusChip, type Etat } from '@suivi/ui';
import { useModule } from '../historique/champs';

export interface DonneesCrrc {
  version: number;
  etat: EtatCrrc;
}
export type AgirCrrc = <R = unknown>(methode: string, chemin: string, corps?: unknown) => Promise<R | undefined>;

export const useCrrc = () => useModule<DonneesCrrc>('crrc', '/api/crrc');

const ETAT: Record<NiveauCrrc, Etat> = { ok: 'succes', mid: 'attention', bad: 'erreur', na: 'neutre', info: 'info' };
/** Pastille d'un libellé de l'outil historique (contrat, sauvegarde, restauration, alerte). */
export const Pastille = ({ s }: { s: string }) => <StatusChip etat={ETAT[niveauCrrc(s)]}>{s || '–'}</StatusChip>;
export const nomEtablissement = (e: EtatCrrc, id: string) => e.establishments.find((x) => x.id === id)?.name ?? '';
export const nomRessource = (e: EtatCrrc, id: string) => e.resources.find((x) => x.id === id)?.name ?? '';

/** Pagination d'une liste (taille de page fixe), comme les listes paginées de l'outil historique. */
export function usePage<T>(liste: readonly T[], taille: number) {
  const [p, setP] = useState(1);
  const n = Math.max(1, Math.ceil(liste.length / taille));
  const page = Math.min(p, n);
  return {
    lignes: liste.slice((page - 1) * taille, page * taille),
    nav: (
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {liste.length} résultat(s)
        </Text>
        {liste.length > taille && <Pagination total={n} value={page} onChange={setP} size="sm" />}
      </Group>
    ),
    retour: () => setP(1),
  };
}

/* Conservation (décision 2 du 25/10/2026) : durées réglables par catégorie, sans purge automatique. Cette classe ne fait
   que LIRE : elle décrit, pour chaque durée réglée, ce qui serait candidat à une purge. Aucune suppression n'est lancée ici ni
   par un planificateur ; la suppression définitive d'un document reste l'action manuelle de Documents. Le journal d'audit est
   immuable et ne figure pas ici. */
import type { ApercuConservation, CategorieApercuConservation, SettingsValues } from '@suivi/shared';
import type { Db } from './db/db.js';
import { totalUsages, usagesPreuve } from './documents-usage.js';

const PLAFOND_DOCUMENTS = 2000;

export class Conservation {
  constructor(private readonly db: Db) {}

  async apercu(r: SettingsValues['conservation'], maintenant = new Date()): Promise<ApercuConservation> {
    const limite = (jours: number) => new Date(maintenant.getTime() - jours * 86_400_000);
    const categories: CategorieApercuConservation[] = [];

    const docs = r.documentsCorbeilleJours;
    let candidats = 0,
      proteges = 0,
      ancien: Date | null = null;
    if (docs !== null) {
      const lignes = (
        await this.db.q<{ id: string; deleted_at: Date }>(
          'SELECT id,deleted_at FROM documents WHERE deleted_at IS NOT NULL AND deleted_at < $1 ORDER BY deleted_at LIMIT $2',
          [limite(docs), PLAFOND_DOCUMENTS],
        )
      ).rows;
      candidats = lignes.length;
      ancien = lignes[0]?.deleted_at ?? null;
      for (const l of lignes) if (totalUsages(await usagesPreuve(this.db.pool, l.id)) > 0) proteges++;
    }
    categories.push({
      id: 'documents_corbeille',
      label: 'Documents dans la corbeille',
      days: docs,
      candidates: docs === null ? null : candidats,
      protectedCount: proteges,
      oldest: ancien ? ancien.toISOString() : null,
      note: 'La suppression définitive se fait à la main dans Documents. Un document cité comme preuve ne peut pas être supprimé définitivement.',
    });

    const rappels = r.rappelsLusJours;
    let lus = { n: 0, ancien: null as Date | null };
    if (rappels !== null)
      lus = (
        await this.db.q<{ n: number; ancien: Date | null }>(
          'SELECT count(*)::int AS n,min(read_at) AS ancien FROM grc_notifications WHERE read_at IS NOT NULL AND read_at < $1',
          [limite(rappels)],
        )
      ).rows[0]!;
    categories.push({
      id: 'rappels_lus',
      label: 'Rappels déjà lus',
      days: rappels,
      candidates: rappels === null ? null : lus.n,
      protectedCount: 0,
      oldest: lus.ancien ? lus.ancien.toISOString() : null,
      note: 'Aucune suppression des rappels n’existe aujourd’hui ; l’aperçu mesure seulement leur ancienneté.',
    });

    const archives = r.elementsArchivesJours;
    let arch = { n: 0, ancien: null as Date | null };
    if (archives !== null)
      arch = (
        await this.db.q<{ n: number; ancien: Date | null }>(
          'SELECT count(*)::int AS n,min(updated_at) AS ancien FROM grc_objects WHERE archived AND updated_at < $1',
          [limite(archives)],
        )
      ).rows[0]!;
    categories.push({
      id: 'elements_archives',
      label: 'Éléments archivés (fiches, registres)',
      days: archives,
      candidates: archives === null ? null : arch.n,
      protectedCount: 0,
      oldest: arch.ancien ? arch.ancien.toISOString() : null,
      note: 'Un élément archivé garde ses liens et son historique ; aucune purge n’existe aujourd’hui pour cette catégorie.',
    });

    return { generatedAt: maintenant.toISOString(), automaticPurge: false, categories };
  }
}

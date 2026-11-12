-- Retrait définitif du module « Applications à intégrer » (analyse d'écart GAP) : décision du RSSI du 12/11/2026, ADR 0089 (lot 2).
-- Suppression DÉFINITIVE de la table et de ses données : la sauvegarde automatique de la mise à jour précède cette migration,
-- c'est le seul retour arrière. Le module n'avait pas de droit propre (il relevait de « conformite ») : aucun rôle ni attribution
-- à modifier. Le journal d'audit n'est pas touché. Les applications de la cartographie (nœuds « application ») sont retirées du
-- code ; les cartes déjà enregistrées sont nettoyées par la lecture (voir l'ADR 0089), sans traitement SQL ici.
DROP TABLE IF EXISTS suivi_app_gaps;
DELETE FROM suivi_presence WHERE cle = 'appGaps';
UPDATE app_state SET data = data - 'appGaps' WHERE id = 1 AND data ? 'appGaps';

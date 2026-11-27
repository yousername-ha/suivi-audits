/* Tuiles d'en-tête des tâches récurrentes et du plan d'actions, style « Verre » (dessins TachesTimeline et PlanTimeline
   validés par le RSSI le 27/11/2026) : séries actives, résultat attendu, en retard, tenue des échéances ; actions
   ouvertes, en retard, à échéance ce mois, terminées dans l'année. Sans état React ; chaque tuile se lit en une phrase (titre,
   valeur, précision). Calculs dans taches-recurrentes.ts, sur les fiches chargées. */
import type { TuileRecurrence } from './taches-recurrentes';

export function TuilesRecurrences({
  tuiles,
  partiel = false,
  label = 'Synthèse des tâches récurrentes',
}: {
  tuiles: TuileRecurrence[];
  partiel?: boolean;
  label?: string;
}) {
  return (
    <div className="taches-tuiles-zone">
      <ul className="taches-tuiles" aria-label={label}>
        {tuiles.map((t) => (
          <li key={t.cle} className="taches-tuile" data-tuile={t.cle} data-sens={t.ton}>
            <span className="taches-tuile__titre">{t.titre}</span>
            <span className="taches-tuile__valeur">{t.valeur}</span>
            <span className="taches-tuile__detail">{t.detail}</span>
          </li>
        ))}
      </ul>
      {partiel && (
        <p className="taches-tuiles__partiel">
          Calculé sur les fiches chargées : d’autres restent à charger (bouton « Charger les 50 … suivantes »).
        </p>
      )}
    </div>
  );
}

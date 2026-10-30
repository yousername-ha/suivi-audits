/* Préparation d'une revue de direction (ISO 9001:2015, 9.3.2) : faits chiffrés tirés des données de la plateforme, repris
   dans une nouvelle fiche de revue. Rien n'est interprété : la direction apprécie, conclut et décide (9.3.3).
   Habillage : écran sombre de la chronologie RETEX (bandeau téléscripteur, grille, halos) et dalles en verre du tableau de
   bord ; les entrées sont regroupées en trois temps de lecture et affichées d'emblée, chiffres mis en évidence. */
import { useQuery } from '@tanstack/react-query';
import { cleEntree, type EntreeRevue } from '@suivi/shared';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';

const SOCLE = '00000000-0000-4000-8000-000000000001';

/** Trois temps de lecture, dans l'ordre de 9.3.2 (a et b, puis c, puis d à f), chacun dans une teinte de la charte. */
const TEMPS: readonly { titre: string; resume: string; teinte: string; ids: readonly string[] }[] = [
  {
    titre: 'Suites et contexte',
    resume: 'Ce qui a été décidé la dernière fois, et ce qui a changé autour de l’organisation.',
    teinte: 'bleu',
    ids: ['a', 'b'],
  },
  {
    titre: 'Performance et efficacité',
    resume: 'Clients, objectifs, processus, écarts, mesures, audits et prestataires.',
    teinte: 'vert',
    ids: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'],
  },
  {
    titre: 'Ressources, risques et amélioration',
    resume: 'Les moyens, les risques et opportunités, et les pistes de progrès.',
    teinte: 'violet',
    ids: ['d', 'e', 'f'],
  },
];

/** Dates et nombres d'un fait (hors identifiants comme IND-001) : mis en évidence sans rien recalculer. */
const CHIFFRE = /(?<![\p{L}\d-])(\d{2}\/\d{2}\/\d{4}|\d+(?:[.,]\d+)?(?:\/\d+)?(?:\s?%)?)(?![\p{L}\d-])/u;
function Fait({ texte }: { texte: string }) {
  return (
    <li>
      {texte.split(CHIFFRE).map((morceau, i) =>
        i % 2 ? (
          <strong key={i} className="revue-chiffre">
            {morceau}
          </strong>
        ) : (
          morceau
        ),
      )}
    </li>
  );
}

function DalleEntree({ entree, teinte }: { entree: EntreeRevue; teinte: string }) {
  return (
    <article
      className={`tdb-dalle revue-dalle retex-c-${entree.aSaisir ? 'orange' : teinte}`}
      data-etat={entree.aSaisir ? 'a-saisir' : 'faits'}
      aria-label={entree.titre}
    >
      <div className="revue-dalle__tete">
        <span className="revue-dalle__article">{entree.article}</span>
        {entree.aSaisir && (
          <span className="revue-pastille">
            <span className="retex-bandeau__voyant" aria-hidden="true" />À apprécier par la direction
          </span>
        )}
      </div>
      <h4 className="revue-dalle__titre">{entree.titre}</h4>
      <span className="revue-dalle__souligne" aria-hidden="true" />
      {entree.faits.length > 0 && (
        <ul className="revue-faits">
          {entree.faits.map((f) => (
            <Fait key={f} texte={f} />
          ))}
        </ul>
      )}
    </article>
  );
}

export function PreparationRevue({
  smsi,
  onCreer,
}: {
  smsi: string;
  onCreer: (initial: Record<string, unknown>) => void;
}) {
  const can = useCan();
  const q = useQuery({
    queryKey: ['grc', smsi, 'revue-entrees'],
    queryFn: () =>
      get<{ precedente: { id: string; date: string } | null; entrees: EntreeRevue[] }>(
        `/api/grc/${smsi}/pilotage/revue/entrees`,
      ),
    enabled: smsi === SOCLE,
    retry: false,
  });
  if (smsi !== SOCLE) return null;
  const entrees = q.data?.entrees ?? [];
  const precedente = q.data?.precedente;
  const aApprecier = entrees.filter((e) => e.aSaisir).length;
  const creer = () =>
    onCreer(
      Object.fromEntries(entrees.filter((e) => e.faits.length).map((e) => [cleEntree(e.id), e.faits.join('\n')])),
    );
  return (
    <section className="retex-chronologie revue-ecran" aria-label="Entrées de la revue de direction">
      <header className="retex-bandeau revue-bandeau">
        <div className="retex-bandeau__titre">
          <span className="retex-bandeau__sur">
            <span className="retex-bandeau__voyant" aria-hidden="true" />
            Revue de direction · ISO 9001:2015, 9.3.2
          </span>
          <h2 className="retex-bandeau__nom">Préparer la prochaine revue</h2>
          <p className="revue-bandeau__texte">
            Des faits tirés de vos données, sans interprétation : une donnée absente est signalée telle quelle. La
            direction apprécie, conclut et décide ; les sorties (9.3.3) se saisissent dans la fiche de revue.
          </p>
        </div>
        {q.data && (
          <dl className="retex-bandeau__chiffres">
            <div data-teinte="non">
              <dt>Dernière revue</dt>
              <dd>{precedente ? precedente.date.split('-').reverse().join('/') : 'Aucune'}</dd>
            </div>
            <div className="retex-c-vert">
              <dt>Entrées préparées</dt>
              <dd>{entrees.length}</dd>
            </div>
            <div className={aApprecier ? 'retex-c-orange' : 'retex-c-gris'}>
              <dt>À apprécier</dt>
              <dd>{aApprecier}</dd>
            </div>
          </dl>
        )}
      </header>
      {can('pilotage', 'modifier') && entrees.length > 0 && (
        <div className="revue-commande">
          <button type="button" className="retex-bouton retex-bouton--principal" onClick={creer}>
            Préparer une revue avec ces entrées
          </button>
        </div>
      )}
      <ErrorAlert error={q.error} />
      {entrees.length > 0 &&
        TEMPS.map((t, n) => {
          const dalles = entrees.filter((e) => t.ids.includes(e.id));
          if (!dalles.length) return null;
          return (
            <section key={t.titre} className={`revue-temps retex-c-${t.teinte}`} aria-labelledby={`revue-temps-${n}`}>
              <div className="revue-temps__tete">
                <span className="revue-temps__anneau" aria-hidden="true">
                  {n + 1}
                </span>
                <div>
                  <span className="revue-temps__sur">Temps {n + 1}</span>
                  <h3 id={`revue-temps-${n}`} className="revue-temps__titre">
                    {t.titre}
                  </h3>
                  <p className="revue-temps__resume">{t.resume}</p>
                </div>
              </div>
              <div className="revue-dalles">
                {dalles.map((e) => (
                  <DalleEntree key={e.id} entree={e} teinte={t.teinte} />
                ))}
              </div>
            </section>
          );
        })}
    </section>
  );
}

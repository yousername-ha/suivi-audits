/* Dalles de synthèse de la déclaration d'applicabilité (refonte Neon, lot 4, ADR 0093) : mise en forme des statistiques
   partagées existantes (statsDda), sans nouveau calcul métier ni score de certification. Les couleurs viennent des
   classes (neon-dda.css), jamais d'un style en ligne (CSP stricte). Les libellés lus par les parcours existants restent :
   « x % » puis « en mise en œuvre totale », le nombre puis « exclue(s) », « « Total » avec écart ouvert ». */
import { useId } from 'react';
import { type StatsDda } from '@suivi/shared';
import { IconeDda } from './DdaIcone';
import { arcsAnneau, largeurBarre, niveauxSynthese } from './dda-studio';

export function DdaSynthese({
  st,
  reference,
  incoherentes,
}: {
  st: StatsDda;
  reference: string;
  incoherentes: number;
}) {
  const id = 'dda' + useId().replace(/[^\w-]/g, '');
  const niveaux = niveauxSynthese(st);
  const arcs = arcsAnneau(niveaux, st.app);
  const maximum = Math.max(1, ...niveaux.map((n) => n.valeur));
  return (
    <section className="dda-synthese" aria-label="Pilotage de la déclaration">
      <p className="dda-section-title">
        <span aria-hidden="true">01</span> Vue d’ensemble
      </p>
      <div className="dda-graphs">
        <article className="dda-panel dda-graph">
          <div className="dda-graph-entete">
            <span className="dda-tuile-icone">
              <IconeDda type="niveaux" />
            </span>
            <div>
              <h3>Niveaux déclarés</h3>
              <p className="dda-caption">Mise en œuvre des mesures</p>
            </div>
          </div>
          <div className="dda-donut-layout">
            <svg
              className="dda-donut"
              viewBox="0 0 140 140"
              role="img"
              aria-label={`Répartition des mesures applicables par niveau de mise en œuvre : ${st.app} applicable${st.app > 1 ? 's' : ''} ; ${st.pct} % au niveau Total`}
            >
              <circle cx="70" cy="70" r="56" className="dda-ring-track" />
              {arcs
                .filter((a) => a.part > 0)
                .map((a) => (
                  <circle
                    key={a.ton}
                    cx="70"
                    cy="70"
                    r="56"
                    pathLength="100"
                    transform="rotate(-90 70 70)"
                    className={`dda-ring-part dda-tone-${a.ton}`}
                    strokeDasharray={`${a.part} 100`}
                    strokeDashoffset={a.decalage}
                  />
                ))}
              <text x="70" y="76" textAnchor="middle" className="dda-ring-number">
                {st.pct}
                <tspan className="dda-ring-pourcent">%</tspan>
              </text>
              <text x="70" y="95" textAnchor="middle" className="dda-ring-label">
                Niveau Total
              </text>
            </svg>
            <dl className="dda-legend">
              {niveaux.map((n) => (
                <div key={n.ton}>
                  <dt>
                    <i className={`dda-dot dda-tone-${n.ton}`} aria-hidden="true" />
                    {n.label}
                  </dt>
                  <dd>{n.valeur}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="dda-graph-pied dda-chiffre">
            <b>{st.pct} %</b>
            <span>en mise en œuvre totale</span>
          </p>
        </article>
        <article className="dda-panel dda-graph">
          <div className="dda-graph-entete">
            <span className="dda-tuile-icone">
              <IconeDda type="repartition" />
            </span>
            <div>
              <h3>Mesures par niveau</h3>
              <p className="dda-caption">Répartition des déclarations</p>
            </div>
          </div>
          <dl className="dda-bars">
            {niveaux.map((n) => (
              <div key={n.ton} className={`dda-bar dda-tone-${n.ton}`}>
                <dt>{n.label}</dt>
                <dd>
                  <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                    <defs>
                      <linearGradient id={`${id}-${n.ton}`}>
                        <stop className="dda-gradient-start" />
                        <stop offset="1" className="dda-gradient-end" />
                      </linearGradient>
                    </defs>
                    <rect width="100" height="8" rx="4" className="dda-bar-track" />
                    <rect
                      width={largeurBarre(n.valeur, maximum)}
                      height="8"
                      rx="4"
                      fill={`url(#${id}-${n.ton})`}
                      className="dda-bar-fill"
                    />
                  </svg>
                  <strong>{n.valeur}</strong>
                </dd>
              </div>
            ))}
          </dl>
          <p className="dda-graph-pied">
            <span>Référentiel</span>
            <b>{reference}</b>
          </p>
        </article>
        <article className="dda-panel dda-graph">
          <div className="dda-graph-entete">
            <span className="dda-tuile-icone" data-ton="vert">
              <IconeDda type="applicabilite" />
            </span>
            <div>
              <h3>Applicabilité</h3>
              <p className="dda-caption">Périmètre des mesures</p>
            </div>
          </div>
          <p className="dda-coverage">
            <strong>{st.app}</strong>
            <span>/ {st.total}</span>
          </p>
          <p className="dda-coverage-caption">mesures applicables</p>
          <svg
            className="dda-coverage-rail dda-tone-total"
            viewBox="0 0 100 8"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id={`${id}-couverture`}>
                <stop className="dda-gradient-start" />
                <stop offset="1" className="dda-gradient-end" />
              </linearGradient>
            </defs>
            <rect width="100" height="8" rx="4" className="dda-bar-track" />
            <rect width={largeurBarre(st.app, st.total)} height="8" rx="4" fill={`url(#${id}-couverture)`} />
          </svg>
          <p className="dda-exclusions">
            <IconeDda type="document" />
            <b>{st.na}</b>
            <span>{`exclue${st.na > 1 ? 's' : ''}`}</span>
          </p>
        </article>
        <article className="dda-panel dda-graph dda-vigilance">
          <div className="dda-graph-entete">
            <span className="dda-tuile-icone" data-ton="orange">
              <IconeDda type="vigilance" />
            </span>
            <div>
              <h3>Points de vigilance</h3>
              <p className="dda-caption">Mesures à examiner</p>
            </div>
          </div>
          <p className="dda-vigilance-valeur">
            <strong>{st.c.Insuffisant}</strong>
            <span>{`mesure${st.c.Insuffisant > 1 ? 's' : ''} au niveau Insuffisant`}</span>
          </p>
          <dl className="dda-substats">
            <div>
              <dt>{`Partielle${st.c.Partiel > 1 ? 's' : ''}`}</dt>
              <dd>{st.c.Partiel}</dd>
            </div>
            <div>
              <dt>« Total » avec écart ouvert</dt>
              <dd>{incoherentes}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}

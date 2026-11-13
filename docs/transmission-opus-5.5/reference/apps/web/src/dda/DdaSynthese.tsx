/* Mise en forme des statistiques partagées existantes, sans nouveau calcul métier. */
import { useId } from 'react';
import { type StatsDda } from '@suivi/shared';
import { IconeDda } from './DdaIcone';

export function DdaSynthese({
  st,
  reference,
  incoherentes,
}: {
  st: StatsDda;
  reference: string;
  incoherentes: number;
}) {
  const id = useId();
  const niveaux = [
    { label: 'Total', valeur: st.c.Total, ton: 'total' },
    { label: 'Partiel', valeur: st.c.Partiel, ton: 'partiel' },
    { label: 'Insuffisant', valeur: st.c.Insuffisant, ton: 'insuffisant' },
    { label: 'Non renseigné', valeur: st.c[''], ton: 'inconnu' },
  ];
  const maximum = Math.max(1, ...niveaux.map((n) => n.valeur));
  return (
    <section aria-label="Pilotage de la déclaration">
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
              <h2>Niveaux déclarés</h2>
              <p className="dda-caption">Mise en œuvre des mesures</p>
            </div>
          </div>
          <div className="dda-donut-layout">
            <svg
              className="dda-donut"
              viewBox="0 0 140 140"
              role="img"
              aria-label={`Répartition des mesures applicables par niveau de mise en œuvre : ${st.app} applicables ; ${st.pct} % au niveau Total`}
            >
              <circle cx="70" cy="70" r="56" className="dda-ring-track" />
              {niveaux.map((n, i) => (
                <circle
                  key={n.ton}
                  cx="70"
                  cy="70"
                  r="56"
                  pathLength="100"
                  transform="rotate(-90 70 70)"
                  className={`dda-ring-part dda-tone-${n.ton}`}
                  strokeDasharray={`${st.app ? (n.valeur / st.app) * 100 : 0} 100`}
                  strokeDashoffset={
                    st.app ? (-niveaux.slice(0, i).reduce((s, v) => s + v.valeur, 0) / st.app) * 100 : 0
                  }
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
          <div className="dda-graph-pied">
            <span>Mesures applicables</span>
            <b>{st.app}</b>
          </div>
        </article>
        <article className="dda-panel dda-graph">
          <div className="dda-graph-entete">
            <span className="dda-tuile-icone">
              <IconeDda type="repartition" />
            </span>
            <div>
              <h2>Mesures par niveau</h2>
              <p className="dda-caption">Répartition des déclarations</p>
            </div>
          </div>
          <dl className="dda-bars">
            {niveaux.map((n) => (
              <div key={n.ton} className={`dda-bar dda-tone-${n.ton}`}>
                <dt>{n.label}</dt>
                <dd>
                  <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id={`${id}-${n.ton}`}>
                        <stop className="dda-gradient-start" />
                        <stop offset="1" className="dda-gradient-end" />
                      </linearGradient>
                    </defs>
                    <rect width="100" height="8" rx="4" className="dda-bar-track" />
                    <rect
                      width={(n.valeur / maximum) * 100}
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
          <div className="dda-graph-pied">
            <span>Référentiel</span>
            <b>{reference}</b>
          </div>
        </article>
        <article className="dda-panel dda-graph">
          <div className="dda-graph-entete">
            <span className="dda-tuile-icone" data-ton="vert">
              <IconeDda type="applicabilite" />
            </span>
            <div>
              <h2>Applicabilité</h2>
              <p className="dda-caption">Périmètre des mesures</p>
            </div>
          </div>
          <div className="dda-coverage">
            <strong>{st.app}</strong>
            <span>/ {st.total}</span>
          </div>
          <p className="dda-coverage-caption">mesures applicables</p>
          <svg
            className="dda-coverage-rail dda-tone-total"
            viewBox="0 0 100 8"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`${id}-couverture`}>
                <stop className="dda-gradient-start" />
                <stop offset="1" className="dda-gradient-end" />
              </linearGradient>
            </defs>
            <rect width="100" height="8" rx="4" className="dda-bar-track" />
            <rect width={st.total ? (st.app / st.total) * 100 : 0} height="8" rx="4" fill={`url(#${id}-couverture)`} />
          </svg>
          <p className="dda-exclusions">
            <IconeDda type="document" />
            <b>{st.na}</b> mesure{st.na > 1 ? 's' : ''} exclue{st.na > 1 ? 's' : ''}
          </p>
        </article>
        <article className="dda-panel dda-graph dda-vigilance">
          <div className="dda-graph-entete">
            <span className="dda-tuile-icone" data-ton="orange">
              <IconeDda type="vigilance" />
            </span>
            <div>
              <h2>Points de vigilance</h2>
              <p className="dda-caption">Mesures à examiner</p>
            </div>
          </div>
          <div className="dda-vigilance-valeur">
            <strong>{st.c.Insuffisant}</strong>
            <span>mesures au niveau Insuffisant</span>
          </div>
          <dl className="dda-substats">
            <div>
              <dt>Partielles</dt>
              <dd>{st.c.Partiel}</dd>
            </div>
            <div>
              <dt>Total avec écart ouvert</dt>
              <dd>{incoherentes}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}

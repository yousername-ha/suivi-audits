/* Présentation des statistiques existantes : aucun score ou niveau n'est recalculé ici. */
import { useId } from 'react';
import { type StatsDda } from '@suivi/shared';

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
      <p className="dda-section-title">Pilotage de la déclaration</p>
      <div className="dda-graphs">
        <article className="dda-panel dda-graph">
          <span className="dda-eyebrow">01 / Mise en œuvre</span>
          <h3>Niveaux déclarés</h3>
          <p className="dda-caption">Répartition des mesures applicables</p>
          <div className="dda-donut-layout">
            <svg
              className="dda-donut"
              viewBox="0 0 140 140"
              role="img"
              aria-label={`Répartition des mesures applicables par niveau de mise en œuvre : ${st.app} applicables`}
            >
              <circle cx="70" cy="70" r="56" className="dda-ring-track" />
              {niveaux.map((n, i) => (
                <circle
                  key={n.ton}
                  cx="70"
                  cy="70"
                  r="56"
                  pathLength="100"
                  transform="rotate(-180 70 70)"
                  className={`dda-ring-part dda-tone-${n.ton}`}
                  strokeDasharray={`${st.app ? (n.valeur / st.app) * 100 : 0} 100`}
                  strokeDashoffset={
                    st.app ? (-niveaux.slice(0, i).reduce((s, v) => s + v.valeur, 0) / st.app) * 100 : 0
                  }
                />
              ))}
              <text x="70" y="73" textAnchor="middle" className="dda-ring-number">
                {st.app}
              </text>
              <text x="70" y="93" textAnchor="middle" className="dda-ring-label">
                applicables
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
        </article>
        <article className="dda-panel dda-graph">
          <span className="dda-eyebrow">02 / Répartition</span>
          <h3>Mesures par niveau</h3>
          <p className="dda-caption">Nombre de mesures applicables</p>
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
        </article>
        <article className="dda-panel dda-graph">
          <span className="dda-eyebrow">03 / Périmètre</span>
          <h3>Applicabilité</h3>
          <p className="dda-caption">{reference}</p>
          <div className="dda-coverage">
            <strong>{st.app}</strong>
            <span>
              mesures applicables
              <br />
              sur {st.total}
            </span>
          </div>
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
          <dl className="dda-substats">
            <div>
              <dt>Applicables</dt>
              <dd>{st.app}</dd>
            </div>
            <div>
              <dt>Exclues</dt>
              <dd>{st.na}</dd>
            </div>
            <div>
              <dt>Total déclaré</dt>
              <dd>{st.pct} %</dd>
            </div>
          </dl>
        </article>
        <article className="dda-panel dda-graph dda-vigilance">
          <span className="dda-eyebrow">04 / Vigilance</span>
          <h3>Mesures à examiner</h3>
          <p className="dda-caption">Niveaux insuffisants déclarés</p>
          <div className="dda-coverage">
            <strong>{st.c.Insuffisant}</strong>
            <span>insuffisantes</span>
          </div>
          <span className="dda-orb" aria-hidden="true">
            !
          </span>
          <dl className="dda-substats">
            <div>
              <dt>Partielles</dt>
              <dd>{st.c.Partiel}</dd>
            </div>
            <div>
              <dt>Non renseignées</dt>
              <dd>{st.c['']}</dd>
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

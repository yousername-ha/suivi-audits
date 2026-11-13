import { ListeDefilante } from '@suivi/ui';
import { ficheCliquable } from '../fiche-cliquable';
/* Timeline Studio : les objets, résultats, droits et éditions restent ceux des API métier. */
import type { BusinessPolicy, GrcObject } from '@suivi/shared';
import { useResizeObserver } from '@mantine/hooks';
import { useState } from 'react';
import { useFiltreUrl } from '../components/filtre-url';
import { enRetard, libelleStatut, symboleStatut, validationDe } from './etat-action';
import type { JourFond } from './jours-de-fond';
import {
  classerDates,
  dateFrise,
  decalerPeriode,
  ECHELLES,
  etagerReperes,
  infererEchelle,
  JOUR,
  jour,
  periodeCalendaire,
  uniteSerie,
  type ChoixEchelle,
  type Echelle,
  type Placement,
} from './timeline-calendrier';

export type TonTache = 'amber' | 'blue' | 'teal' | 'red' | 'muted';
export function tonTache(o: GrcObject, policy: BusinessPolicy): TonTache {
  const result = validationDe(o);
  if (result) return result === 'OK' ? 'teal' : result === 'KO' ? 'red' : 'muted';
  if (o.data.seriesId || o.data.status === 'todo') return 'amber';
  if (o.data.status === 'blocked') return 'red';
  if (o.data.status === 'cancelled') return 'muted';
  return policy.statuses.find((s) => s.id === o.data.status)?.terminal || o.data.status === 'done' ? 'teal' : 'blue';
}
export function EtatTache({ objet, policy }: { objet: GrcObject; policy: BusinessPolicy }) {
  const v = validationDe(objet);
  return (
    <span className="task-state" data-tone={tonTache(objet, policy)}>
      <span aria-hidden="true">
        {v === 'KO' ? '✕' : v === 'OK' ? '✓' : v === 'NA' ? '−' : symboleStatut(policy, objet.data.status)}
      </span>
      {v ? `Validée ${v}` : objet.data.seriesId ? 'En attente' : libelleStatut(policy, objet)}
    </span>
  );
}
export function IconeCycle({ kind = 'cycle' }: { kind?: string }) {
  return (
    <svg
      className="task-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      {kind === 'cycle' ? (
        <>
          <path d="M20 9A8 8 0 0 0 5 5L2 8m0-5v5h5M4 15a8 8 0 0 0 15 4l3-3m0 5v-5h-5" />
        </>
      ) : kind === 'warning' ? (
        <>
          <path d="m12 3 10 18H2L12 3Z" />
          <path d="M12 9v5m0 3v1" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
    </svg>
  );
}
export function rythmeSerie(s: GrcObject): string {
  const r = s.data.recurrence as { unit?: Echelle; interval?: number; active?: boolean } | undefined;
  const unite = uniteSerie(s),
    n = r?.interval ?? 1;
  const nom = { day: 'jour', week: 'semaine', month: 'mois', year: n === 1 ? 'année' : 'an' }[unite];
  return `${n === 1 ? 'Chaque' : 'Tous les ' + n} ${nom}${n > 1 && nom !== 'mois' ? 's' : ''}${r?.active === false ? ' · En pause' : ''}`;
}

export function TimelineStudio({
  items,
  series = [],
  occurrences = false,
  policy,
  onOpen,
  onValidate,
  ownerOf,
  fond = [],
}: {
  items: GrcObject[];
  series?: GrcObject[];
  occurrences?: boolean;
  policy: BusinessPolicy;
  onOpen: (o: GrcObject) => void;
  onValidate: (o: GrcObject, declencheur: HTMLButtonElement) => void;
  ownerOf: (o: GrcObject) => string;
  fond?: JourFond[];
}) {
  const [scale, setScale] = useFiltreUrl('techelle', 'auto');
  const [focus, setFocus] = useFiltreUrl('tserie', '');
  const [start, setStart] = useFiltreUrl('tdebut', '');
  const [fit, setFit] = useFiltreUrl('ttout', '0');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [trackRef, rect] = useResizeObserver<HTMLDivElement>();
  const width = Math.max(180, rect.width || 700);
  const today = Math.floor(Date.now() / JOUR) * JOUR;
  const chosen: ChoixEchelle = scale in ECHELLES ? (scale as Echelle) : 'auto';
  const filtered = occurrences && focus ? items.filter((o) => o.data.seriesId === focus) : items;
  const inferred = occurrences ? infererEchelle(series, filtered, focus) : 'week';
  const unite = chosen === 'auto' ? inferred : chosen;
  const dates = filtered.flatMap((o) => [jour(o.data.startAt), jour(o.data.dueAt)]);
  const p = periodeCalendaire(
    unite,
    today,
    Number.isFinite(jour(start)) ? jour(start) : undefined,
    fit === '1' ? dates : undefined,
  );
  const { visibles, horsPeriode, sansDate, incoherentes } = classerDates(filtered, p, occurrences);
  const x = (n: number) => ((n - p.debut) / (p.fin - p.debut)) * width;
  const clamp = (n: number, margin = 28) => Math.max(margin, Math.min(width - margin, x(n)));
  const selectedSerie = series.find((s) => s.id === focus);
  const reset = () => {
    setStart('');
    setFit('0');
  };
  const move = (direction: number) => {
    setStart(new Date(decalerPeriode(p, direction)).toISOString().slice(0, 10));
    setFit('0');
  };
  const groups = new Map<string, Placement[]>();
  for (const e of visibles) {
    const key = occurrences ? String(e.objet.data.seriesId || e.objet.id) : e.objet.id;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const openDetail = (id: string) => setExpanded(expanded === id ? null : id);
  const detail = (o: GrcObject) => (
    <div className="task-inline-detail" id={`task-detail-${o.id}`}>
      <div className="task-detail-heading">
        <div>
          <small>LECTURE DE LA FICHE</small>
          <h3>{o.name}</h3>
        </div>
        <button type="button" className="task-button" onClick={() => onOpen(o)}>
          Ouvrir la fiche ↗
        </button>
      </div>
      <div className="task-detail-grid">
        <section>
          <h4>Objectif et réalisation</h4>
          <p>{String(o.data.description || 'Aucune description renseignée.')}</p>
          <p>{String(o.data.justification || 'Aucune justification renseignée.')}</p>
        </section>
        <section>
          <h4>Responsabilité et échéance</h4>
          <dl>
            <dt>Responsable</dt>
            <dd>{ownerOf(o)}</dd>
            <dt>Début</dt>
            <dd>
              {Number.isFinite(jour(o.data.startAt))
                ? dateFrise(jour(o.data.startAt), { dateStyle: 'long' })
                : 'Non renseigné'}
            </dd>
            <dt>Échéance</dt>
            <dd>
              {Number.isFinite(jour(o.data.dueAt))
                ? dateFrise(jour(o.data.dueAt), { dateStyle: 'long' })
                : 'Non renseignée'}
            </dd>
            <dt>Priorité</dt>
            <dd>
              {({ low: 'Basse', normal: 'Normale', high: 'Haute', urgent: 'Urgente' } as Record<string, string>)[
                String(o.data.priority)
              ] ?? String(o.data.priority || 'Non renseignée')}
            </dd>
          </dl>
        </section>
        <section>
          <h4>État et suivi</h4>
          <EtatTache objet={o} policy={policy} />
          {enRetard(o, policy) && <p className="task-late">⚠ Échéance dépassée</p>}
          <p>{Array.isArray(o.data.dependencies) ? o.data.dependencies.length : 0} dépendance(s)</p>
          <p>Cliquez sur le repère de la Timeline pour renseigner le résultat et sa preuve.</p>
        </section>
      </div>
    </div>
  );
  const grid = (height: number) => (
    <g aria-hidden="true">
      {p.reperes.map((r, i) => (
        <rect
          key={r.debut}
          className={i % 2 ? 'task-grid-band is-alt' : 'task-grid-band'}
          x={x(r.debut)}
          y="0"
          width={x(r.fin) - x(r.debut)}
          height={height}
        />
      ))}
      {fond.map((j) => {
        const n = jour(j.date);
        return n >= p.debut && n < p.fin ? (
          <rect
            className="task-background-day"
            data-fond={j.famille}
            key={j.calendrier + j.date}
            x={x(n)}
            y="0"
            width={Math.max(1, width / p.jours)}
            height={height}
          >
            <title>{j.label}</title>
          </rect>
        ) : null;
      })}
      {today >= p.debut && today < p.fin && (
        <line className="task-today-line" x1={x(today)} x2={x(today)} y1="0" y2={height} />
      )}
    </g>
  );
  const extras = (objs: GrcObject[], title: string, message: string) =>
    objs.length > 0 && (
      <section className="task-extras">
        <h3>
          {title} · {objs.length}
        </h3>
        <p>{message}</p>
        <div>
          {objs.map((o) => (
            <button
              type="button"
              key={o.id}
              className="task-button"
              onClick={(event) => onValidate(o, event.currentTarget)}
              aria-haspopup="dialog"
            >
              {o.name} ＋
            </button>
          ))}
        </div>
      </section>
    );
  const detached = filtered.find((o) => o.id === expanded && !visibles.some((e) => e.objet.id === o.id));
  return (
    <section className="timeline-studio" aria-label={occurrences ? 'Timeline des occurrences' : 'Timeline des actions'}>
      <header className="task-timeline-header">
        <div>
          <small>{occurrences ? 'RÉCURRENCES' : 'PLAN D’ACTIONS'} / TIMELINE</small>
          <h2>{occurrences ? 'Le rythme de vos contrôles' : 'Le temps de vos actions'}</h2>
          <p>
            {dateFrise(p.debut, { day: 'numeric', month: 'short', year: 'numeric' })} —{' '}
            {dateFrise(p.fin - JOUR, { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="task-period-tools">
          <div className="task-scale" role="group" aria-label="Échelle de la Timeline">
            {(['auto', ...Object.keys(ECHELLES)] as ChoixEchelle[]).map((k) => (
              <button
                type="button"
                key={k}
                aria-pressed={chosen === k}
                onClick={() => {
                  setScale(k);
                  reset();
                }}
              >
                {k === 'auto' ? 'Auto' : ECHELLES[k]}
              </button>
            ))}
          </div>
          <div className="task-navigation">
            <button type="button" className="task-button" aria-label="Période précédente" onClick={() => move(-1)}>
              ‹
            </button>
            <button type="button" className="task-button" onClick={reset}>
              Aujourd’hui
            </button>
            <button type="button" className="task-button" aria-label="Période suivante" onClick={() => move(1)}>
              ›
            </button>
            <button type="button" className="task-button" onClick={() => setFit('1')}>
              Tout afficher
            </button>
          </div>
        </div>
      </header>
      <div className="task-scale-context">
        {occurrences && (
          <label>
            Série à suivre
            <select
              aria-label="Série à suivre"
              value={focus}
              onChange={(e) => {
                setFocus(e.currentTarget.value);
                setScale('auto');
                reset();
                setExpanded(null);
              }}
            >
              <option value="">Toutes les séries</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {rythmeSerie(s)}
                </option>
              ))}
            </select>
          </label>
        )}
        <p>
          <strong>
            {chosen === 'auto' ? 'Auto · ' : ''}
            {ECHELLES[unite]}
          </strong>
          <span>
            {p.jours} jours ·{' '}
            {chosen === 'auto' && occurrences ? 'Adaptée à la périodicité affichée' : 'Période affichée'}
          </span>
        </p>
      </div>
      <div className="task-legend" role="group" aria-label="Légende de la Timeline">
        <span data-tone="amber">◈ En attente</span>
        <span data-tone="teal">◈ Validée OK / terminée</span>
        <span data-tone="red">◈ Validée KO / bloquée</span>
        <span data-tone="muted">◈ Validée NA / annulée</span>
        <span className="task-late">⚠ Contour rouge : en retard</span>
      </div>
      <div className="task-axis-row">
        <div className="task-horizon">
          <span className="task-horizon-count">
            <IconeCycle />
            {visibles.length}
          </span>
          <div>
            <small>DANS CET HORIZON</small>
            <h3>{occurrences ? 'Occurrences' : 'Actions'}</h3>
            <p>
              {groups.size} {occurrences ? 'série(s)' : 'action(s)'} représentée(s)
              <br />
              {visibles.filter((e) => enRetard(e.objet, policy)).length} en retard
            </p>
          </div>
        </div>
        <div ref={trackRef} className="task-axis">
          <svg
            width="100%"
            height="154"
            role="img"
            aria-label={`Repères du ${dateFrise(p.debut)} au ${dateFrise(p.fin - JOUR)}`}
          >
            {grid(154)}
            <text className="task-axis-period" x="12" y="20">
              {dateFrise(p.debut, { month: 'long', year: 'numeric' })} —{' '}
              {dateFrise(p.fin - JOUR, { month: 'long', year: 'numeric' })}
            </text>
            {p.reperes.map((r) => (
              <text className="task-tick" key={r.debut} x={(x(r.debut) + x(r.fin)) / 2} y="141" textAnchor="middle">
                <title>{r.label}</title>
                {width < 560 ? r.court : r.label}
              </text>
            ))}
            {today >= p.debut && today < p.fin && (
              <foreignObject x={clamp(today, 54) - 50} y="25" width="100" height="100">
                <div className="task-today-orb">
                  <IconeCycle kind="clock" />
                  <b>{dateFrise(today, { day: '2-digit' })}</b>
                  <span>{dateFrise(today, { month: 'long' })}</span>
                  <small>Aujourd’hui</small>
                </div>
              </foreignObject>
            )}
          </svg>
        </div>
      </div>
      <ListeDefilante className="task-timeline-rows" label="Lignes de la Timeline">
        {[...groups.entries()].map(([key, raw]) => {
          const entries = [...raw].sort((a, b) => a.fin - b.fin),
            sample = entries[0]!.objet;
          const serie = occurrences ? series.find((s) => s.id === key) : undefined;
          const late = entries.some((e) => enRetard(e.objet, policy));
          const tone = late
            ? 'red'
            : occurrences
              ? entries.some((e) => !validationDe(e.objet))
                ? 'blue'
                : 'teal'
              : tonTache(sample, policy);
          const positions = entries.map((e) => clamp(e.fin));
          const levels = occurrences ? etagerReperes(positions) : [0];
          const height = Math.max(96, (Math.max(...levels) + 1) * 86 + 18);
          const current = entries.find((e) => e.objet.id === expanded)?.objet;
          return (
            <article
              className="task-timeline-row"
              key={key}
              data-tone={tone}
              data-expanded={!!current}
              {...ficheCliquable(() => onOpen(current ?? sample), `Afficher ${serie?.name ?? sample.name}`)}
            >
              <div className="task-row-grid">
                <button
                  type="button"
                  className="task-identity"
                  onClick={() => openDetail((entries.find((e) => !validationDe(e.objet)) ?? entries[0])!.objet.id)}
                  aria-expanded={!!current}
                  aria-controls={current ? `task-detail-${current.id}` : undefined}
                >
                  <span className="task-identity-seal">
                    <IconeCycle kind={occurrences ? 'cycle' : late ? 'warning' : 'clock'} />
                  </span>
                  <span className="task-identity-text">
                    <small>
                      {occurrences ? 'SÉRIE RÉCURRENTE' : 'ACTION'} / {(serie?.id ?? sample.id).slice(0, 8)}
                    </small>
                    <strong>{serie?.name || sample.name}</strong>
                    <span>
                      {serie ? rythmeSerie(serie) + ' · ' : ''}
                      {ownerOf(serie ?? sample)}
                    </span>
                    <span className="task-identity-footer">
                      {occurrences ? (
                        <span>
                          {entries.length} occurrence(s) · {entries.filter((e) => !validationDe(e.objet)).length} en
                          attente
                        </span>
                      ) : (
                        <EtatTache objet={sample} policy={policy} />
                      )}
                      {late && <span className="task-late">⚠ En retard</span>}
                    </span>
                  </span>
                  <span className="task-identity-plus" aria-hidden="true">
                    {current ? '−' : '+'}
                  </span>
                </button>
                <div className="task-lane">
                  <svg
                    width="100%"
                    height={height}
                    aria-label={
                      occurrences ? `Échéances de ${serie?.name || sample.name}` : `Période de ${sample.name}`
                    }
                  >
                    {grid(height)}
                    {occurrences && entries.length > 1 && (
                      <line
                        className="task-occ-guide"
                        x1={positions[0]}
                        x2={positions[positions.length - 1]}
                        y1="40"
                        y2="40"
                        aria-hidden="true"
                      />
                    )}
                    {entries.map((e, i) => {
                      const o = e.objet,
                        lateItem = enRetard(o, policy),
                        v = validationDe(o),
                        color = tonTache(o, policy);
                      const label = `${o.name}, ${v ? 'validation ' + v : libelleStatut(policy, o)}, échéance ${dateFrise(e.fin, { dateStyle: 'long' })}${lateItem ? ', en retard' : ''}`;
                      if (occurrences || o.data.occurrenceKey)
                        return (
                          <foreignObject
                            key={o.id}
                            x={positions[i]! - 34}
                            y={levels[i]! * 86 + 10}
                            width="68"
                            height="85"
                          >
                            <button
                              type="button"
                              className="task-occurrence"
                              id={`task-resultat-${o.id}`}
                              data-tone={color}
                              data-late={lateItem}
                              onClick={(event) => onValidate(o, event.currentTarget)}
                              aria-label={label}
                              aria-haspopup="dialog"
                            >
                              <span className="task-diamond">
                                <b>{v === 'OK' ? '✓' : v === 'KO' ? '✕' : v === 'NA' ? '−' : '◷'}</b>
                              </span>
                              <small>{dateFrise(e.fin)}</small>
                              <em>{lateItem ? 'En retard' : v || 'À valider'}</em>
                            </button>
                          </foreignObject>
                        );
                      const a = Math.min(width - 52, Math.max(18, x(e.debut))),
                        b = Math.min(width - 18, x(e.fin + JOUR));
                      const w = Math.min(width - 18 - a, Math.max(34, b - a));
                      return (
                        <foreignObject key={o.id} x={a} y="8" width={w} height="86">
                          <button
                            type="button"
                            className="task-ribbon"
                            id={`task-resultat-${o.id}`}
                            data-tone={color}
                            data-late={lateItem}
                            data-short={w < 145}
                            onClick={(event) => onValidate(o, event.currentTarget)}
                            aria-label={label}
                            aria-haspopup="dialog"
                          >
                            <span className="task-ribbon-line">
                              <i className="task-ribbon-start" />
                              <span>
                                {dateFrise(e.debut)} → {dateFrise(e.fin)}
                              </span>
                              <i className="task-ribbon-end">
                                {v === 'OK'
                                  ? '✓'
                                  : v === 'KO'
                                    ? '✕'
                                    : v === 'NA'
                                      ? '−'
                                      : symboleStatut(policy, o.data.status)}
                              </i>
                            </span>
                            <small>
                              {dateFrise(e.fin)}
                              {e.debut < p.debut || e.fin >= p.fin ? ' · période partielle' : ''}
                            </small>
                          </button>
                        </foreignObject>
                      );
                    })}
                  </svg>
                </div>
              </div>
              {current && detail(current)}
              {serie && (
                <button type="button" className="task-series-link" onClick={() => onOpen(serie)}>
                  Réglages de la série ↗
                </button>
              )}
            </article>
          );
        })}
      </ListeDefilante>
      {!visibles.length && (
        <div className="task-empty">
          {selectedSerie && (selectedSerie.data.recurrence as { active?: boolean } | undefined)?.active === false
            ? 'Cette série est en pause. Aucune occurrence dans cette période.'
            : 'Aucune échéance dans cette période et ces filtres.'}{' '}
          Les contrôles de période restent disponibles.
        </div>
      )}
      {extras(
        horsPeriode,
        'Hors de la période',
        'Ces échéances restent accessibles. « Tout afficher » agrandit la période.',
      )}
      {extras(sansDate, 'Sans échéance', 'Aucune date inventée : ouvrir la fiche pour la renseigner.')}
      {extras(
        incoherentes,
        'Dates à vérifier',
        'Date illisible ou début postérieur à l’échéance : ouvrir la fiche pour corriger.',
      )}
      {detached && detail(detached)}
      {fond.length > 0 && (
        <details className="task-background-details" data-testid="timeline-fond">
          <summary>Jours fériés et fermetures en fond · {fond.length} repères disponibles</summary>
          <ul>
            {fond.map((j) => (
              <li key={j.calendrier + j.date}>
                {dateFrise(jour(j.date), { dateStyle: 'long' })} · {j.label} ({j.calendrier})
              </li>
            ))}
          </ul>
        </details>
      )}
      <footer className="task-timeline-footer">
        <span>
          ◈ {visibles.length} repère(s) · Dates réelles{occurrences ? ' · Regroupées par série' : ''}
        </span>
        <span>Sélectionnez une carte ou un repère pour déplier sa fiche.</span>
      </footer>
    </section>
  );
}

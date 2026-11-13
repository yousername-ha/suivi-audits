/* Présentation Studio validée : les enjeux et la nomenclature restent ceux de l’API PESTEL existante. */
import { Select } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import type { EnjeuPestel, FacteurPestel, VuePestel } from '@suivi/shared';
import { useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

const TONES = ['politique', 'economique', 'social', 'technologique', 'environnemental', 'legal'] as const;
const normalize = (v: string) =>
  v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
function presentation(f: FacteurPestel, index: number) {
  const known = TONES.find((tone) => tone === normalize(f.id) || tone === normalize(f.label));
  return {
    tone: known ?? TONES[index % TONES.length],
    icon: known ?? 'globe',
    letter: Array.from(f.label.trim())[0] ?? '•',
    known,
  };
}
const ICONS: Record<string, ReactNode> = {
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18M5 6h14M5 18h14" />
    </>
  ),
  politique: <path d="m3 8 9-5 9 5H3Zm2 2v8m5-8v8m4-8v8m5-8v8M3 21h18" />,
  economique: <path d="M18 5a7 7 0 1 0 0 14M3 10h11M3 14h10" />,
  social: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M2 21v-3a5 5 0 0 1 10 0v3m3-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 5 5v2" />
    </>
  ),
  technologique: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4" />
    </>
  ),
  environnemental: <path d="M19 3C6 2 1 8 6 16s16 4 13-13Zm-1 2L6 18m6-7-5-1m6 0 1 5" />,
  legal: <path d="M12 3v18M5 21h14M3 7h18M5 7l-3 7h6L5 7Zm14 0-3 7h6l-3-7Z" />,
  tree: (
    <>
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <path d="M12 8v4H5v4m7-4h7v4" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  warning: (
    <>
      <path d="m12 3 10 18H2Z" />
      <path d="M12 9v5m0 3h.01" />
    </>
  ),
  pause: <path d="M8 5v14M16 5v14" />,
  play: <path d="m8 4 12 8-12 8Z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10h.01" />
    </>
  ),
  document: <path d="M6 2h8l4 4v16H6Zm8 0v5h4M9 11h6m-6 4h6m-6 4h4" />,
};
function Icon({ name }: { name: string }) {
  return (
    <svg className="pestel-icon" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name] ?? ICONS.globe}
    </svg>
  );
}
function Processus({ enjeu, labels }: { enjeu: EnjeuPestel; labels: ReadonlyMap<string, string> }) {
  return (
    <div className="pestel-process-tags" role="group" aria-label="Processus concernés">
      {enjeu.processus.length ? (
        enjeu.processus.map((p, i) => (
          <span className="pestel-process-tag" key={i}>
            <Icon name="tree" />
            {labels.has(p) && labels.get(p) !== p && <b>{p}</b>}
            <span>{labels.get(p) ?? p}</span>
          </span>
        ))
      ) : (
        <span className="pestel-no-process">Aucun processus renseigné</span>
      )}
    </div>
  );
}
type Classer = (enjeu: EnjeuPestel, facteur: string | null) => Promise<boolean>;
interface IssueProps {
  enjeu: EnjeuPestel;
  facteurs: FacteurPestel[];
  processus: ReadonlyMap<string, string>;
  modifiable: boolean;
  enCours: boolean;
  onClasser: Classer;
  registre?: boolean;
}
function Classement({ enjeu, facteurs, modifiable, enCours, onClasser, registre }: IssueProps) {
  const facteur = facteurs.find((f) => f.id === enjeu.facteur);
  if (!modifiable) return <span className="pestel-static-factor">{facteur?.label ?? 'Non classé'}</span>;
  return (
    <div className="pestel-assignment">
      <Select
        label="Classement"
        aria-label={`Facteur de l’enjeu ${enjeu.label}${registre ? ' dans le registre' : ''}`}
        placeholder="Non classé"
        clearable
        clearButtonProps={{
          'aria-hidden': false,
          tabIndex: 0,
          'aria-label': `Retirer le classement de l’enjeu ${enjeu.label}${registre ? ' dans le registre' : ''}`,
        }}
        searchable
        disabled={enCours || !facteurs.length}
        data={facteurs.map((f) => ({ value: f.id, label: f.label }))}
        value={facteur?.id ?? null}
        onChange={(value) => void onClasser(enjeu, value)}
      />
    </div>
  );
}
function Enjeu({ enjeu, ...props }: IssueProps) {
  return (
    <article className="pestel-focus-issue">
      <div className="pestel-issue-title">
        <span className="pestel-issue-pin">
          <Icon name="document" />
        </span>
        <h3>{enjeu.label}</h3>
      </div>
      {enjeu.description && <p>{enjeu.description}</p>}
      <div className="pestel-issue-bottom">
        <Processus enjeu={enjeu} labels={props.processus} />
        <Classement enjeu={enjeu} {...props} />
      </div>
    </article>
  );
}

export function PestelStudio({
  vue,
  processus,
  modifiable,
  enCours,
  onClasser,
}: {
  vue: VuePestel;
  processus: ReadonlyMap<string, string>;
  modifiable: boolean;
  enCours: boolean;
  onClasser: Classer;
}) {
  const [params, setParams] = useSearchParams();
  const [registre, setRegistre] = useState(false),
    [recherche, setRecherche] = useState(''),
    [status, setStatus] = useState('');
  const [motion, setMotion] = useState<'auto' | 'on' | 'off'>('auto');
  const reduced = useReducedMotion(),
    moving = motion === 'on' || (motion === 'auto' && !reduced);
  const registreRef = useRef<HTMLElement>(null),
    searchRef = useRef<HTMLInputElement>(null),
    toolbarRef = useRef<HTMLButtonElement>(null),
    unknownRef = useRef<HTMLElement>(null);
  const nodesRef = useRef(new Map<string, HTMLButtonElement>());
  const groupes = vue.facteurs.map((f, i) => ({
    facteur: f,
    enjeux: vue.parFacteur.find((g) => g.facteur.id === f.id)?.enjeux ?? [],
    ...presentation(f, i),
  }));
  const selection =
    groupes.find((g) => g.facteur.id === params.get('facteur')) ??
    groupes.find((g) => g.known === 'technologique') ??
    groupes.find((g) => g.enjeux.length) ??
    groupes[0];
  const externes = [...vue.parFacteur.flatMap((g) => g.enjeux), ...vue.nonClasses];
  const classes = vue.parFacteur.reduce((n, g) => n + g.enjeux.length, 0);
  const dense = groupes.length > 6 || groupes.some((g) => g.facteur.label.length > 20);
  const mots = ['', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six'];
  const perspectives = groupes.length
    ? `Une vue d’ensemble, ${mots[groupes.length] ?? groupes.length} perspective${groupes.length > 1 ? 's' : ''}`
    : 'Une vue d’ensemble des enjeux externes';
  const choisir = (id: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set('facteur', id);
        return next;
      },
      { replace: true },
    );
  const classer: Classer = async (enjeu, facteur) => {
    setStatus('');
    const focused = document.activeElement as HTMLElement | null;
    const origin = focused?.closest('.pestel-assignment')?.querySelector<HTMLInputElement>('input') ?? focused;
    const depuisNonClasses = !!origin?.closest('.pestel-unclassified');
    const saved = await onClasser(enjeu, facteur);
    if (saved) setStatus('Classement enregistré.');
    requestAnimationFrame(() => {
      if (origin && (!origin.isConnected || document.activeElement === document.body)) {
        const fallback = depuisNonClasses
          ? unknownRef.current
          : (nodesRef.current.get(selection?.facteur.id ?? '') ?? unknownRef.current);
        (origin.isConnected ? origin : fallback)?.focus({ preventScroll: true });
      }
    });
    return saved;
  };
  const issueProps = { facteurs: vue.facteurs, processus, modifiable, enCours, onClasser: classer };
  const ouvrirRegistre = () => {
    setRegistre(true);
    requestAnimationFrame(() => {
      registreRef.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' });
      searchRef.current?.focus({ preventScroll: true });
    });
  };
  const replierRegistre = () => {
    setRegistre(false);
    toolbarRef.current?.focus({ preventScroll: true });
    toolbarRef.current?.scrollIntoView({ block: 'center', behavior: reduced ? 'instant' : 'smooth' });
  };
  const afficherNonClasses = () => {
    unknownRef.current?.scrollIntoView({ block: 'center', behavior: reduced ? 'instant' : 'smooth' });
    unknownRef.current?.focus({ preventScroll: true });
  };
  const filtre = normalize(recherche);
  const visibles = externes.filter((e) =>
    normalize(
      [
        e.label,
        e.description,
        ...e.processus,
        ...e.processus.map((p) => processus.get(p) ?? p),
        vue.facteurs.find((f) => f.id === e.facteur)?.label ?? 'Non classé',
      ].join(' '),
    ).includes(filtre),
  );
  return (
    <section className="pestel-studio" aria-label="PESTEL des enjeux externes" data-motion={moving ? 'on' : 'off'}>
      <div className="pestel-toolbar">
        <span className="pestel-status" role="status">
          {enCours ? 'Enregistrement du classement…' : status}
        </span>
        <button
          type="button"
          className="pestel-button"
          ref={toolbarRef}
          aria-expanded={registre}
          aria-controls="pestel-registre"
          onClick={registre ? replierRegistre : ouvrirRegistre}
        >
          <Icon name="list" />
          Registre complet
        </button>
      </div>
      <section className="pestel-overview" aria-label="Synthèse des enjeux">
        {[
          { value: externes.length, label: 'Enjeux externes', icon: 'globe', tone: '' },
          { value: classes, label: 'Classés par facteur', icon: 'check', tone: 'pestel-metric-green' },
          { value: vue.nonClasses.length, label: 'À classer', icon: 'warning', tone: 'pestel-metric-amber' },
          { value: vue.internes.length, label: 'Internes · hors PESTEL', icon: 'tree', tone: '' },
        ].map((m) => (
          <div key={m.label} className={m.tone}>
            <span className="pestel-metric-icon">
              <Icon name={m.icon} />
            </span>
            <span>
              <b>{m.value}</b>
              <small>{m.label}</small>
            </span>
          </div>
        ))}
      </section>
      <section className="pestel-stage" aria-labelledby="pestel-stage-title">
        <header className="pestel-stage-heading">
          <div>
            <span className="pestel-eyebrow">Lecture de l’environnement</span>
            <h2 id="pestel-stage-title">{perspectives}</h2>
          </div>
          <button
            type="button"
            className="pestel-button pestel-small"
            aria-pressed={!moving}
            onClick={() => setMotion(moving ? 'off' : 'on')}
          >
            <Icon name={moving ? 'pause' : 'play'} />
            {moving ? 'Pause animations' : 'Reprendre les animations'}
          </button>
        </header>
        <div className="pestel-explorer">
          <div className="pestel-graph-panel">
            <div
              className={`pestel-constellation${dense ? ' pestel-constellation-dense' : ''}`}
              data-count={groupes.length}
            >
              {!dense && (
                <svg className="pestel-connections" viewBox="0 0 440 404" aria-hidden="true">
                  <circle className="pestel-orbit" cx="220" cy="202" r="142" />
                  <circle className="pestel-orbit-inner" cx="220" cy="202" r="98" />
                  {groupes.map((g, i) => {
                    const angle = ((-90 + (i * 360) / groupes.length) * Math.PI) / 180,
                      x = 220 + Math.cos(angle) * 142,
                      y = 202 + Math.sin(angle) * 142;
                    return (
                      <g key={g.facteur.id} data-tone={g.tone} className={g === selection ? 'pestel-current' : ''}>
                        <path className="pestel-ray" d={`M220 202L${x} ${y}`} />
                        <path className="pestel-flow" d={`M220 202L${x} ${y}`} />
                      </g>
                    );
                  })}
                </svg>
              )}
              <div className="pestel-context-hub" role="img" aria-label={`${externes.length} enjeux externes`}>
                <span>
                  <Icon name="globe" />
                </span>
                <strong>{externes.length}</strong>
                <small>ENJEUX EXTERNES</small>
                <i aria-hidden="true" />
              </div>
              {groupes.map((g, i) => (
                <button
                  type="button"
                  key={g.facteur.id}
                  ref={(node) => {
                    if (node) nodesRef.current.set(g.facteur.id, node);
                    else nodesRef.current.delete(g.facteur.id);
                  }}
                  className="pestel-factor-node"
                  data-factor={g.facteur.id}
                  data-tone={g.tone}
                  data-index={i}
                  aria-pressed={g === selection}
                  aria-controls="pestel-factor-focus"
                  aria-label={`${g.facteur.label}, ${g.enjeux.length} enjeu${g.enjeux.length > 1 ? 'x' : ''}`}
                  onClick={() => choisir(g.facteur.id)}
                >
                  <span className="pestel-node-top">
                    <Icon name={g.icon} />
                    <b>{g.enjeux.length}</b>
                  </span>
                  <strong>{g.facteur.label}</strong>
                </button>
              ))}
            </div>
            <p className="pestel-graph-caption">
              <Icon name="info" />
              {groupes.length
                ? 'Sélectionnez un facteur pour explorer ses enjeux.'
                : 'Aucun facteur défini dans la nomenclature.'}
            </p>
          </div>
          <section
            className="pestel-factor-focus"
            id="pestel-factor-focus"
            data-tone={selection?.tone ?? 'technologique'}
            aria-labelledby="pestel-factor-title"
          >
            <header>
              <div className="pestel-focus-icon">
                <Icon name={selection?.icon ?? 'globe'} />
              </div>
              <div className="pestel-factor-heading">
                <span className="pestel-eyebrow">
                  {selection
                    ? `${String(groupes.indexOf(selection) + 1).padStart(2, '0')} / Facteur sélectionné`
                    : 'Nomenclature'}
                </span>
                <h2 id="pestel-factor-title">{selection?.facteur.label ?? 'Aucun facteur défini'}</h2>
              </div>
              {selection && (
                <span className="pestel-focus-count">
                  <b>{selection.enjeux.length}</b> enjeu{selection.enjeux.length > 1 ? 'x' : ''}
                </span>
              )}
            </header>
            <div className="pestel-focus-list">
              {selection?.enjeux.length ? (
                selection.enjeux.map((e) => <Enjeu key={e.ref} enjeu={e} {...issueProps} />)
              ) : (
                <div className="pestel-factor-empty">
                  <Icon name={selection?.icon ?? 'globe'} />
                  <h3>{selection ? 'Aucun enjeu classé' : 'Nomenclature à renseigner'}</h3>
                  <p>
                    {selection
                      ? 'Les enjeux associés à ce facteur apparaîtront ici.'
                      : 'Les enjeux existants restent accessibles dans le registre.'}
                  </p>
                  <button type="button" className="pestel-button pestel-small" onClick={afficherNonClasses}>
                    Voir les enjeux à classer <Icon name="arrow" />
                  </button>
                </div>
              )}
            </div>
            <footer>
              <span className="pestel-factor-dot" />
              Enjeux externes du contexte de l’organisation
            </footer>
          </section>
        </div>
        {!!groupes.length && (
          <div className="pestel-factor-legend" aria-label="Facteurs de la nomenclature">
            {groupes.map((g) => (
              <button
                type="button"
                key={g.facteur.id}
                data-tone={g.tone}
                aria-pressed={g === selection}
                aria-controls="pestel-factor-focus"
                onClick={() => choisir(g.facteur.id)}
              >
                <span>{g.letter}</span>
                {g.facteur.label}
                <b>{g.enjeux.length}</b>
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="pestel-unclassified" aria-label="Enjeux externes non classés" ref={unknownRef} tabIndex={-1}>
        <header>
          <span className="pestel-metric-icon">
            <Icon name="warning" />
          </span>
          <div>
            <span className="pestel-eyebrow">À compléter</span>
            <h2>
              Enjeux externes à classer <b>{vue.nonClasses.length}</b>
            </h2>
          </div>
        </header>
        <div className="pestel-unknown-rows">
          {vue.nonClasses.length ? (
            vue.nonClasses.map((e) => (
              <article className="pestel-unknown-row" key={e.ref}>
                <div>
                  <h3>{e.label}</h3>
                  {e.description && <p className="pestel-issue-description">{e.description}</p>}
                  <Processus enjeu={e} labels={processus} />
                </div>
                <Classement enjeu={e} {...issueProps} />
              </article>
            ))
          ) : (
            <p className="pestel-all-classified">Tous les enjeux externes sont classés.</p>
          )}
        </div>
      </section>
      <details className="pestel-internal-shelf" aria-label="Enjeux internes">
        <summary>
          <span className="pestel-metric-icon">
            <Icon name="tree" />
          </span>
          <span>
            <strong>
              Enjeux internes <b>{vue.internes.length}</b>
            </strong>
            <small>Conservés dans le contexte et le SWOT, hors classement PESTEL.</small>
          </span>
          <span className="pestel-shelf-plus" aria-hidden="true" />
        </summary>
        <div>
          {vue.internes.length ? (
            vue.internes.map((e) => (
              <article key={e.ref}>
                <h3>{e.label}</h3>
                {e.description && <p>{e.description}</p>}
                <Processus enjeu={e} labels={processus} />
              </article>
            ))
          ) : (
            <p className="pestel-no-process">Aucun enjeu interne.</p>
          )}
        </div>
      </details>
      <section
        id="pestel-registre"
        className="pestel-registry"
        ref={registreRef}
        aria-labelledby="pestel-registry-title"
        hidden={!registre}
      >
        <header>
          <div>
            <span className="pestel-eyebrow">Tous les enjeux externes</span>
            <h2 id="pestel-registry-title">
              Registre complet <span>{externes.length}</span>
            </h2>
          </div>
          <label htmlFor="pestel-search">
            Rechercher un enjeu
            <input
              id="pestel-search"
              type="search"
              ref={searchRef}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Intitulé ou processus…"
            />
          </label>
        </header>
        <div>
          {visibles.map((e) => (
            <article className="pestel-registry-row" key={e.ref}>
              <div>
                <h3>{e.label}</h3>
                {e.description && <p className="pestel-issue-description">{e.description}</p>}
                <Processus enjeu={e} labels={processus} />
              </div>
              <Classement enjeu={e} {...issueProps} registre />
            </article>
          ))}
        </div>
        {!visibles.length && (
          <p>{externes.length ? 'Aucun enjeu ne correspond à votre recherche.' : 'Aucun enjeu externe.'}</p>
        )}
        <footer>
          <span>
            {visibles.length} sur {externes.length} enjeux externes
          </span>
          <button type="button" className="pestel-button pestel-small" onClick={replierRegistre}>
            Revenir à la vue graphique <Icon name="arrow" />
          </button>
        </footer>
      </section>
      <details className="pestel-methodology">
        <summary>
          <Icon name="info" />
          Comprendre cette lecture PESTEL<span>À propos</span>
        </summary>
        <p>
          Le PESTEL n’est pas exigé par la norme ISO 9001:2015 : c’est une présentation facultative des enjeux externes
          de l’article 4.1. La note 2 de 4.1 cite l’environnement juridique, technologique, concurrentiel, commercial,
          culturel, social et économique ; les facteurs « politique » et « environnemental » vont au-delà. Les facteurs
          sont ceux de votre nomenclature. Les enjeux internes (valeurs, culture, connaissances, performance, note 3)
          restent dans le contexte et le SWOT.
        </p>
      </details>
      {!externes.length && !vue.internes.length && (
        <p className="pestel-source-empty">
          Aucun enjeu : ils proviennent des objectifs (enjeux associés), des analyses SWOT et de la carte de contexte.
        </p>
      )}
    </section>
  );
}

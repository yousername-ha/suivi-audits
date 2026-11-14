/* PESTEL Studio (refonte Neon, lot 5, ADR 0093) : constellation des facteurs validée par le RSSI. Présentation seulement : la
   vue, la nomenclature et les classements viennent de l'API PESTEL existante, les écritures passent par `onClasser` (PUT
   existant, dans Pestel.tsx). Les enjeux internes restent à part et ne se classent pas. Aucun rattachement n'est fabriqué. */
import { Select } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import type { EnjeuPestel, FacteurPestel, VuePestel } from '@suivi/shared';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import {
  constellationDense,
  enjeuxExternes,
  facteurAffiche,
  filtrerEnjeux,
  groupesPestel,
  processusEnjeu,
  titrePerspectives,
} from './pestel-presentation';

const ICONES: Record<string, ReactNode> = {
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
function Icone({ nom }: { nom: string }) {
  return (
    <svg className="pestel-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {ICONES[nom] ?? ICONES.globe}
    </svg>
  );
}

function Processus({ enjeu, noms }: { enjeu: EnjeuPestel; noms: ReadonlyMap<string, string> }) {
  const liste = processusEnjeu(enjeu, noms);
  return (
    <div className="pestel-process-tags" role="group" aria-label="Processus concernés">
      {liste.length ? (
        liste.map((p, i) => (
          <span className="pestel-process-tag" key={i}>
            <Icone nom="tree" />
            {p.resolu && <b>{p.code}</b>}
            <span>{p.nom}</span>
          </span>
        ))
      ) : (
        <span className="pestel-no-process">Aucun processus renseigné</span>
      )}
    </div>
  );
}

type Classer = (enjeu: EnjeuPestel, facteur: string | null) => Promise<boolean>;
interface ProprietesEnjeu {
  facteurs: FacteurPestel[];
  noms: ReadonlyMap<string, string>;
  modifiable: boolean;
  enCours: boolean;
  onClasser: Classer;
  registre?: boolean;
}
/** Classement d'un enjeu externe : liste de la nomenclature pour qui peut modifier, lecture seule sinon. */
function Classement({
  enjeu,
  facteurs,
  modifiable,
  enCours,
  onClasser,
  registre,
}: ProprietesEnjeu & { enjeu: EnjeuPestel }) {
  const facteur = facteurs.find((f) => f.id === enjeu.facteur);
  const suffixe = registre ? ' dans le registre' : '';
  if (!modifiable) return <span className="pestel-static-factor">{facteur?.label ?? 'Non classé'}</span>;
  return (
    <div className="pestel-assignment">
      <Select
        clearable
        searchable
        label="Classement"
        aria-label={`Facteur de l’enjeu ${enjeu.label}${suffixe}`}
        placeholder="Non classé"
        clearButtonProps={{
          'aria-hidden': false,
          tabIndex: 0,
          'aria-label': `Retirer le classement de l’enjeu ${enjeu.label}${suffixe}`,
        }}
        disabled={enCours || !facteurs.length}
        data={facteurs.map((f) => ({ value: f.id, label: f.label }))}
        value={facteur?.id ?? null}
        onChange={(valeur) => void onClasser(enjeu, valeur)}
      />
    </div>
  );
}
function Enjeu({ enjeu, ...props }: ProprietesEnjeu & { enjeu: EnjeuPestel }) {
  return (
    <article className="pestel-focus-issue">
      <div className="pestel-issue-title">
        <span className="pestel-issue-pin">
          <Icone nom="document" />
        </span>
        <h3>{enjeu.label}</h3>
      </div>
      {enjeu.description && <p className="pestel-issue-description">{enjeu.description}</p>}
      <div className="pestel-issue-bottom">
        <Processus enjeu={enjeu} noms={props.noms} />
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
  /** Noms des processus par identifiant (cartes des processus). */
  processus: ReadonlyMap<string, string>;
  modifiable: boolean;
  enCours: boolean;
  onClasser: Classer;
}) {
  const [params, setParams] = useSearchParams();
  const [registre, setRegistre] = useState(false),
    [recherche, setRecherche] = useState(''),
    [statut, setStatut] = useState(''),
    [pause, setPause] = useState(false);
  const reduit = useReducedMotion();
  const anime = !reduit && !pause;
  const id = useId();
  const ids = {
    scene: `${id}-scene`,
    focus: `${id}-focus`,
    titreFocus: `${id}-titre-focus`,
    registre: `${id}-registre`,
    titreRegistre: `${id}-titre-registre`,
    recherche: `${id}-recherche`,
  };
  const registreRef = useRef<HTMLElement>(null),
    rechercheRef = useRef<HTMLInputElement>(null),
    commandeRegistre = useRef<HTMLButtonElement>(null),
    nonClassesRef = useRef<HTMLElement>(null);
  const noeuds = useRef(new Map<string, HTMLButtonElement>());

  const groupes = groupesPestel(vue);
  const selection = facteurAffiche(groupes, params.get('facteur'));
  const externes = enjeuxExternes(vue);
  const classes = vue.parFacteur.reduce((n, g) => n + g.enjeux.length, 0);
  const dense = constellationDense(groupes);
  const visibles = filtrerEnjeux(externes, recherche, vue.facteurs, processus);
  const defilement: ScrollBehavior = reduit ? 'auto' : 'smooth';

  const choisir = (facteur: string) =>
    setParams(
      (p) => {
        const suite = new URLSearchParams(p);
        suite.set('facteur', facteur);
        return suite;
      },
      { replace: true },
    );
  /** Après un déplacement d'enjeu, le focus revient au champ ou, s'il a disparu, à sa zone. */
  const classer: Classer = async (enjeu, facteur) => {
    setStatut('');
    const actif = document.activeElement as HTMLElement | null;
    const origine = actif?.closest('.pestel-assignment')?.querySelector<HTMLInputElement>('input') ?? actif;
    const depuisNonClasses = !!origine?.closest('.pestel-unclassified');
    const enregistre = await onClasser(enjeu, facteur);
    if (enregistre) setStatut('Classement enregistré.');
    requestAnimationFrame(() => {
      if (origine && (!origine.isConnected || document.activeElement === document.body)) {
        const repli = depuisNonClasses
          ? nonClassesRef.current
          : (noeuds.current.get(selection?.facteur.id ?? '') ?? nonClassesRef.current);
        (origine.isConnected ? origine : repli)?.focus({ preventScroll: true });
      }
    });
    return enregistre;
  };
  const proprietes = { facteurs: vue.facteurs, noms: processus, modifiable, enCours, onClasser: classer };
  const ouvrirRegistre = () => {
    setRegistre(true);
    requestAnimationFrame(() => {
      registreRef.current?.scrollIntoView({ block: 'start', behavior: defilement });
      rechercheRef.current?.focus({ preventScroll: true });
    });
  };
  const replierRegistre = () => {
    setRegistre(false);
    commandeRegistre.current?.focus({ preventScroll: true });
    commandeRegistre.current?.scrollIntoView({ block: 'center', behavior: defilement });
  };
  const voirNonClasses = () => {
    nonClassesRef.current?.scrollIntoView({ block: 'center', behavior: defilement });
    nonClassesRef.current?.focus({ preventScroll: true });
  };

  return (
    <section className="pestel-studio" aria-label="PESTEL des enjeux externes" data-motion={anime ? 'on' : 'off'}>
      <div className="pestel-toolbar">
        <span className="pestel-status" role="status">
          {enCours ? 'Enregistrement du classement…' : statut}
        </span>
        <button
          type="button"
          className="pestel-button"
          ref={commandeRegistre}
          aria-expanded={registre}
          aria-controls={ids.registre}
          onClick={registre ? replierRegistre : ouvrirRegistre}
        >
          <Icone nom="list" />
          Registre complet
        </button>
      </div>
      <div className="pestel-overview" role="group" aria-label="Synthèse des enjeux">
        {[
          { valeur: externes.length, libelle: 'Enjeux externes', icone: 'globe', ton: 'pestel-metric-blue' },
          { valeur: classes, libelle: 'Classés par facteur', icone: 'check', ton: 'pestel-metric-green' },
          { valeur: vue.nonClasses.length, libelle: 'À classer', icone: 'warning', ton: 'pestel-metric-amber' },
          { valeur: vue.internes.length, libelle: 'Internes · hors PESTEL', icone: 'tree', ton: 'pestel-metric-muted' },
        ].map((m) => (
          <div key={m.libelle} className={m.ton}>
            <span className="pestel-metric-icon">
              <Icone nom={m.icone} />
            </span>
            <span>
              <b>{m.valeur}</b>
              <small>{m.libelle}</small>
            </span>
          </div>
        ))}
      </div>
      <section className="pestel-stage" aria-labelledby={ids.scene}>
        <header className="pestel-stage-heading">
          <div>
            <span className="pestel-eyebrow">Lecture de l’environnement</span>
            <h2 id={ids.scene}>{titrePerspectives(groupes.length)}</h2>
          </div>
          {!reduit && (
            <button
              type="button"
              className="pestel-button pestel-small"
              aria-pressed={pause}
              onClick={() => setPause((v) => !v)}
            >
              <Icone nom={pause ? 'play' : 'pause'} />
              {pause ? 'Reprendre les animations' : 'Pause animations'}
            </button>
          )}
        </header>
        <div className="pestel-explorer">
          <div className="pestel-graph-panel">
            <div
              className={`pestel-constellation${dense ? ' pestel-constellation-dense' : ''}`}
              data-count={groupes.length}
            >
              {!dense && groupes.length > 0 && (
                <svg className="pestel-connections" viewBox="0 0 440 404" aria-hidden="true" focusable="false">
                  <circle className="pestel-orbit" cx="220" cy="202" r="142" />
                  <circle className="pestel-orbit-inner" cx="220" cy="202" r="98" />
                  {groupes.map((g, i) => {
                    const angle = ((-90 + (i * 360) / groupes.length) * Math.PI) / 180,
                      x = Math.round((220 + Math.cos(angle) * 142) * 10) / 10,
                      y = Math.round((202 + Math.sin(angle) * 142) * 10) / 10;
                    return (
                      <g
                        key={g.facteur.id}
                        data-tone={g.teinte}
                        data-index={i}
                        className={g === selection ? 'pestel-current' : undefined}
                      >
                        <path className="pestel-ray" d={`M220 202L${x} ${y}`} />
                        <path className="pestel-flow" d={`M220 202L${x} ${y}`} />
                      </g>
                    );
                  })}
                </svg>
              )}
              <div className="pestel-context-hub" role="img" aria-label={`${externes.length} enjeux externes`}>
                <span>
                  <Icone nom="globe" />
                </span>
                <strong>{externes.length}</strong>
                <small>Enjeux externes</small>
                <i aria-hidden="true" />
              </div>
              {groupes.map((g, i) => (
                <button
                  type="button"
                  key={g.facteur.id}
                  ref={(noeud) => {
                    if (noeud) noeuds.current.set(g.facteur.id, noeud);
                    else noeuds.current.delete(g.facteur.id);
                  }}
                  className="pestel-factor-node"
                  data-factor={g.facteur.id}
                  data-tone={g.teinte}
                  data-index={i}
                  aria-pressed={g === selection}
                  aria-controls={ids.focus}
                  aria-label={`${g.facteur.label}, ${g.enjeux.length} enjeu${g.enjeux.length > 1 ? 'x' : ''}`}
                  onClick={() => choisir(g.facteur.id)}
                >
                  <span className="pestel-node-top">
                    <Icone nom={g.icone} />
                    <b>{g.enjeux.length}</b>
                  </span>
                  <strong>{g.facteur.label}</strong>
                </button>
              ))}
            </div>
            <p className="pestel-graph-caption">
              <Icone nom="info" />
              {groupes.length
                ? 'Sélectionnez un facteur pour explorer ses enjeux.'
                : 'Aucun facteur défini dans la nomenclature.'}
            </p>
          </div>
          <section
            className="pestel-factor-focus"
            id={ids.focus}
            data-tone={selection?.teinte ?? 'technologique'}
            aria-labelledby={ids.titreFocus}
          >
            <header>
              <div className="pestel-focus-icon">
                <Icone nom={selection?.icone ?? 'globe'} />
              </div>
              <div className="pestel-factor-heading">
                <span className="pestel-eyebrow">
                  {selection
                    ? `${String(groupes.indexOf(selection) + 1).padStart(2, '0')} / Facteur sélectionné`
                    : 'Nomenclature'}
                </span>
                <h2 id={ids.titreFocus}>{selection?.facteur.label ?? 'Aucun facteur défini'}</h2>
              </div>
              {selection && (
                <span className="pestel-focus-count">
                  <b>{selection.enjeux.length}</b> enjeu{selection.enjeux.length > 1 ? 'x' : ''}
                </span>
              )}
            </header>
            <div className="pestel-focus-list">
              {selection?.enjeux.length ? (
                selection.enjeux.map((e) => <Enjeu key={e.ref} enjeu={e} {...proprietes} />)
              ) : (
                <div className="pestel-factor-empty">
                  <Icone nom={selection?.icone ?? 'globe'} />
                  <h3>{selection ? 'Aucun enjeu classé' : 'Nomenclature à renseigner'}</h3>
                  <p>
                    {selection
                      ? 'Les enjeux associés à ce facteur apparaîtront ici.'
                      : 'Les facteurs se définissent dans la politique métier du périmètre ; les enjeux existants restent accessibles dans le registre.'}
                  </p>
                  {vue.nonClasses.length > 0 && (
                    <button type="button" className="pestel-button pestel-small" onClick={voirNonClasses}>
                      Voir les enjeux à classer <Icone nom="arrow" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <footer>
              <span className="pestel-factor-dot" aria-hidden="true" />
              Enjeux externes du contexte de l’organisation
            </footer>
          </section>
        </div>
        {!!groupes.length && (
          <div className="pestel-factor-legend" role="group" aria-label="Facteurs de la nomenclature">
            {groupes.map((g) => (
              <button
                type="button"
                key={g.facteur.id}
                data-tone={g.teinte}
                aria-pressed={g === selection}
                aria-controls={ids.focus}
                onClick={() => choisir(g.facteur.id)}
              >
                <span aria-hidden="true">{g.lettre}</span>
                {g.facteur.label}
                <b>{g.enjeux.length}</b>
              </button>
            ))}
          </div>
        )}
      </section>
      <section
        className="pestel-unclassified"
        aria-label="Enjeux externes non classés"
        ref={nonClassesRef}
        tabIndex={-1}
      >
        <header>
          <span className="pestel-metric-icon">
            <Icone nom="warning" />
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
                  <Processus enjeu={e} noms={processus} />
                </div>
                <Classement enjeu={e} {...proprietes} />
              </article>
            ))
          ) : (
            <p className="pestel-all-classified">
              {externes.length ? 'Tous les enjeux externes sont classés.' : 'Aucun enjeu externe à classer.'}
            </p>
          )}
        </div>
      </section>
      <details className="pestel-internal-shelf" aria-label="Enjeux internes">
        <summary>
          <span className="pestel-metric-icon">
            <Icone nom="tree" />
          </span>
          <span>
            <strong>
              Enjeux internes, hors PESTEL <b>{vue.internes.length}</b>
            </strong>
            <small>Conservés dans le contexte et le SWOT, sans classement PESTEL.</small>
          </span>
          <span className="pestel-shelf-plus" aria-hidden="true" />
        </summary>
        <div>
          {vue.internes.length ? (
            vue.internes.map((e) => (
              <article key={e.ref}>
                <h3>{e.label}</h3>
                {e.description && <p>{e.description}</p>}
                <Processus enjeu={e} noms={processus} />
              </article>
            ))
          ) : (
            <p className="pestel-no-process">Aucun enjeu interne.</p>
          )}
        </div>
      </details>
      <section
        id={ids.registre}
        className="pestel-registry"
        ref={registreRef}
        aria-labelledby={ids.titreRegistre}
        hidden={!registre}
      >
        <header>
          <div>
            <span className="pestel-eyebrow">Tous les enjeux externes</span>
            <h2 id={ids.titreRegistre}>
              Registre complet <span>{externes.length}</span>
            </h2>
          </div>
          <label htmlFor={ids.recherche}>
            Rechercher un enjeu
            <input
              id={ids.recherche}
              type="search"
              ref={rechercheRef}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Intitulé, facteur ou processus…"
            />
          </label>
        </header>
        <div>
          {visibles.map((e) => (
            <article className="pestel-registry-row" key={e.ref}>
              <div>
                <h3>{e.label}</h3>
                {e.description && <p className="pestel-issue-description">{e.description}</p>}
                <Processus enjeu={e} noms={processus} />
              </div>
              <Classement enjeu={e} {...proprietes} registre />
            </article>
          ))}
        </div>
        {!visibles.length && (
          <p className="pestel-registry-empty">
            {externes.length ? 'Aucun enjeu ne correspond à votre recherche.' : 'Aucun enjeu externe.'}
          </p>
        )}
        <footer>
          <span>
            {visibles.length} sur {externes.length} enjeux externes
          </span>
          <button type="button" className="pestel-button pestel-small" onClick={replierRegistre}>
            Revenir à la vue graphique <Icone nom="arrow" />
          </button>
        </footer>
      </section>
      {!externes.length && !vue.internes.length && (
        <p className="pestel-source-empty">
          Aucun enjeu : ils proviennent des objectifs (enjeux associés), des analyses SWOT et de la carte de contexte.
        </p>
      )}
      <aside className="pestel-methodology" aria-label="À propos de la lecture PESTEL">
        <p className="pestel-methodology-title">
          <Icone nom="info" />
          Comprendre cette lecture PESTEL
        </p>
        <p>
          Le PESTEL n’est pas exigé par la norme ISO 9001:2015 : c’est une présentation facultative des enjeux externes
          de l’article 4.1. La note 2 de 4.1 cite l’environnement juridique, technologique, concurrentiel, commercial,
          culturel, social et économique ; les facteurs « politique » et « environnemental » vont au-delà. Les facteurs
          sont ceux de votre nomenclature. Les enjeux internes (valeurs, culture, connaissances, performance, note 3)
          restent dans le contexte et le SWOT.
        </p>
      </aside>
    </section>
  );
}

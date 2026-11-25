/* Parties intéressées Studio (refonte Neon, lot 5, ADR 0093) : panorama centré (internes à gauche, externes à droite,
   périmètre au centre) et liste compacte du registre déjà chargé par BusinessRegistry. Aucune requête ni écriture métier
   supplémentaire : les filtres, la recherche et les compteurs portent sur les fiches chargées, la pagination existante
   reste visible. Les liaisons et les deux points lumineux sont décoratifs (transform et opacity seulement) ; ils
   tournent en continu, sans bouton de pause (ADR 0099), et s'arrêtent onglet masqué ou en mouvement réduit.
   Boîte d'outils commune (7.3.0) : vues, recherche, filtres avancés et bascule du registre détaillé ; l'ajout au bout
   de la ligne. Les en-têtes de la liste compacte restent décoratifs (aria-hidden), sans filtre de colonne. */
import { ActionIcon, Button, Select } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import { type GrcObject, jourParis } from '@suivi/shared';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BoiteOutils, PastillesCriteres, type CritereActif } from '../components/BarreOutils';
import { ficheCliquable } from '../fiche-cliquable';
import { liaisonsParties, parcoursParties, cheminPartie, type CartePartie, type RoutePartie } from './parties-liaisons';

export const textePartie = (value: unknown) => (typeof value === 'string' ? value : '');
export const datePartie = (value: unknown) =>
  textePartie(value).slice(0, 10).split('-').reverse().join('/') || 'Non renseignée';
export const etatPartie = (o: GrcObject) =>
  o.data.addressed === 'Oui'
    ? 'Traitées'
    : o.data.addressed === 'Partiel'
      ? 'Partiellement'
      : o.data.addressed === 'Non'
        ? 'Non traitées'
        : 'Non renseigné';
/** Une nature absente ou inconnue reste « À préciser » : aucune liaison n'est inventée pour elle. */
export const naturePartie = (o: GrcObject) =>
  ['Interne', 'Externe'].includes(textePartie(o.data.nature)) ? textePartie(o.data.nature) : 'À préciser';
/** Repère de revue : seuil existant de 365 jours, sans obligation de revue annuelle inventée. */
export function revuePartie(o: GrcObject, today = jourParis()) {
  const cutoff = new Date(new Date(today + 'T00:00:00Z').getTime() - 365 * 864e5).toISOString().slice(0, 10);
  return !textePartie(o.data.reviewedAt) || textePartie(o.data.reviewedAt).slice(0, 10) < cutoff;
}
const ICONES: Record<string, ReactNode> = {
  network: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="4" cy="4" r="2" />
      <circle cx="20" cy="4" r="2" />
      <circle cx="4" cy="20" r="2" />
      <circle cx="20" cy="20" r="2" />
      <path d="m6 6 4 4m4 4 4 4m0-12-4 4m-4 4-4 4" />
    </>
  ),
  tree: (
    <>
      <rect x="9" y="2" width="6" height="5" />
      <path d="M12 7v5M5 17v-5h14v5" />
      <rect x="2" y="17" width="6" height="5" />
      <rect x="16" y="17" width="6" height="5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18M5 6h14M5 18h14" />
    </>
  ),
  building: <path d="M4 22V3h14v19M2 22h20M8 7h2m4 0h1M8 11h2m4 0h1M8 15h2m4 0h1M10 22v-3h3v3" />,
  list: <path d="M7 6h14M7 12h14M7 18h14M3 6h.01M3 12h.01M3 18h.01" />,
  search: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 6 6" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 2v6m10-6v6M3 11h18" />
    </>
  ),
  warning: <path d="m12 3 10 18H2zM12 9v5m0 3h.01" />,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
};
export function IconePartie({ name }: { name: string }) {
  return (
    <svg
      className="pi-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONES[name] ?? ICONES.network}
    </svg>
  );
}
/** Prise en compte des exigences : le libellé porte l'information, la teinte la double. */
export function EtatPartie({ object }: { object: GrcObject }) {
  return (
    <span
      className="pi-treatment"
      data-tone={
        object.data.addressed === 'Oui'
          ? 'teal'
          : object.data.addressed === 'Partiel'
            ? 'amber'
            : object.data.addressed === 'Non'
              ? 'red'
              : 'muted'
      }
    >
      <IconePartie
        name={object.data.addressed === 'Oui' ? 'check' : object.data.addressed === 'Non' ? 'close' : 'warning'}
      />
      {etatPartie(object)}
    </span>
  );
}
function Revue({ object }: { object: GrcObject }) {
  const aVerifier = revuePartie(object);
  return (
    <span
      className="pi-review"
      data-check={aVerifier}
      title={aVerifier ? 'Date de revue absente ou de plus de 365 jours' : 'Dernière revue'}
    >
      <IconePartie name={aVerifier ? 'warning' : 'calendar'} />
      {datePartie(object.data.reviewedAt)}
    </span>
  );
}

/** Deux points lumineux au plus, un par nature, déplacés par transform le long des branches ; lignes et textes fixes. */
function Flux({ routes, moving }: { routes: RoutePartie[]; moving: boolean }) {
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const elapsed = useRef(0);
  const courses = useMemo(() => parcoursParties(routes), [routes]);
  useEffect(() => {
    if (!moving) return;
    let frame = 0,
      previous = 0;
    const tick = (now: number) => {
      const delta = previous ? Math.min(now - previous, 100) : 0;
      previous = now;
      if (!document.hidden) elapsed.current += delta;
      for (const [sideIndex, side] of ['internal', 'external'].entries()) {
        const indices = courses.flatMap((c, i) => (c.side === side ? [i] : []));
        const dot = dots.current[sideIndex];
        if (!indices.length || !dot) continue;
        const time = elapsed.current + sideIndex * 1100,
          phase = time % 4400;
        const index = indices[Math.floor(time / 4400) % indices.length]!;
        const path = paths.current[index];
        if (!path) continue;
        const point = path.getPointAtLength(path.getTotalLength() * Math.min(1, phase / 3800));
        dot.setAttribute('transform', `translate(${point.x} ${point.y})`);
        dot.setAttribute('opacity', phase < 3800 ? '1' : '0');
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [moving, courses]);
  return (
    <g className="pi-flow-layer" aria-hidden="true">
      {courses.map((c, i) => (
        <path
          className="pi-flow-path"
          key={c.target}
          d={cheminPartie(c.points)}
          ref={(el) => {
            paths.current[i] = el;
          }}
        />
      ))}
      {(['internal', 'external'] as const).map(
        (side, i) =>
          courses.some((c) => c.side === side) && (
            <circle
              key={side}
              data-side={side}
              className="pi-flow-dot"
              r="2.7"
              opacity="0"
              ref={(el) => {
                dots.current[i] = el;
              }}
            />
          ),
      )}
    </g>
  );
}

function Panorama({
  items,
  scopeName,
  moving,
  onOpen,
}: {
  items: GrcObject[];
  scopeName: string;
  moving: boolean;
  onOpen: (o: GrcObject) => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState<{ width: number; height: number; routes: RoutePartie[] }>({
    width: 1,
    height: 1,
    routes: [],
  });
  // Tracé recalculé après redimensionnement, changement de contenu et chargement des polices.
  useLayoutEffect(() => {
    const root = canvas.current;
    if (!root) return;
    let frame = 0,
      disposed = false;
    const measure = () => {
      const h = root.querySelector('.pi-hub-circle')?.getBoundingClientRect(),
        cr = root.getBoundingClientRect();
      if (!h || !cr.width) return;
      const cards = (side: string): CartePartie[] =>
        [...root.querySelectorAll<HTMLButtonElement>(`.${side} .pi-card`)].map((el) => {
          const b = el.getBoundingClientRect();
          return {
            id: el.dataset.id!,
            left: b.left - cr.left,
            right: b.right - cr.left,
            top: b.top - cr.top,
            bottom: b.bottom - cr.top,
          };
        });
      const routes = liaisonsParties(
        { cx: h.left - cr.left + h.width / 2, cy: h.top - cr.top + h.height / 2, radius: h.width / 2 },
        cards('internal'),
        cards('external'),
      );
      const next = { width: cr.width, height: cr.height, routes };
      setModel((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    [root, ...root.querySelectorAll('.pi-hub-circle,.pi-group-cards,.pi-card')].forEach((el) => observer.observe(el));
    void document.fonts.ready.then(() => {
      if (!disposed) schedule();
    });
    document.fonts.addEventListener('loadingdone', schedule);
    schedule();
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.fonts.removeEventListener('loadingdone', schedule);
    };
  }, [items]);
  const internal = items.filter((o) => naturePartie(o) === 'Interne'),
    external = items.filter((o) => naturePartie(o) === 'Externe'),
    unknown = items.filter((o) => naturePartie(o) === 'À préciser');
  const card = (o: GrcObject) => (
    <button
      type="button"
      className="pi-card"
      data-id={o.id}
      key={o.id}
      id={`pi-open-${o.id}`}
      {...ficheCliquable(() => onOpen(o), `Afficher ${o.name}`)}
      aria-label={`Afficher ${o.name}`}
    >
      <span className="pi-card-top">
        <span className="pi-glyph">
          <IconePartie name={naturePartie(o) === 'Interne' ? 'building' : 'globe'} />
        </span>
        <span className="pi-card-code">
          {o.id.startsWith('legacy:') ? o.id.split(':').slice(2).join(':') : 'Partie intéressée'}
        </span>
        <span className="pi-card-type">{naturePartie(o)}</span>
      </span>
      <strong>{o.name}</strong>
      <span className="pi-card-category">{textePartie(o.data.category) || 'Catégorie non renseignée'}</span>
      <span className="pi-card-expectation">
        {textePartie(o.data.expectations) || 'Besoins et attentes non renseignés'}
      </span>
      <span className="pi-card-bottom">
        <EtatPartie object={o} />
        <Revue object={o} />
      </span>
    </button>
  );
  const cluster = (objects: GrcObject[], side: 'internal' | 'external') => (
    <section
      className={`pi-cluster ${side}`}
      aria-label={side === 'internal' ? 'Acteurs internes' : 'Acteurs externes'}
    >
      <header>
        <IconePartie name={side === 'internal' ? 'building' : 'globe'} />
        <h2>{side === 'internal' ? 'Acteurs internes' : 'Acteurs externes'}</h2>
        <span>{objects.length}</span>
      </header>
      <div className="pi-group-cards">{objects.map(card)}</div>
    </section>
  );
  return (
    <div
      ref={canvas}
      className="pi-panorama"
      data-groups={
        internal.length && external.length
          ? 'both'
          : external.length
            ? 'external'
            : internal.length
              ? 'internal'
              : 'unknown'
      }
    >
      <svg className="pi-wires" viewBox={`0 0 ${model.width} ${model.height}`} aria-hidden="true" focusable="false">
        {model.routes.map((r, i) => (
          <path key={i} data-side={r.side} data-role={r.role} data-target={r.target} d={cheminPartie(r.points)} />
        ))}
        {model.routes
          .filter((r) => r.role === 'outlet' || r.role === 'branch')
          .map((r, i) => (
            <circle
              key={i}
              data-side={r.side}
              cx={(r.role === 'outlet' ? r.points[0] : r.points.at(-1))![0]}
              cy={(r.role === 'outlet' ? r.points[0] : r.points.at(-1))![1]}
              r="2.3"
            />
          ))}
        <Flux routes={model.routes} moving={moving} />
      </svg>
      {!!internal.length && cluster(internal, 'internal')}
      <div className="pi-hub">
        <span className="pi-hub-circle">
          <IconePartie name="tree" />
          <span>{items.length}</span>
        </span>
        <div className="pi-hub-caption">
          <span className="pi-hub-label">Périmètre</span>
          <strong>{scopeName}</strong>
          <small>Acteurs de la vue</small>
        </div>
      </div>
      {!!external.length && cluster(external, 'external')}
      {!!unknown.length && (
        <section className="pi-unknown" aria-label="Nature à préciser">
          <h2>Nature à préciser</h2>
          <div className="pi-group-cards">{unknown.map(card)}</div>
        </section>
      )}
    </div>
  );
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr');

const OPTIONS_NATURE = [
  { value: 'all', label: 'Toutes' },
  ...['Interne', 'Externe', 'À préciser'].map((v) => ({ value: v, label: v })),
];
const OPTIONS_EXIGENCES = [
  { value: 'all', label: 'Toutes' },
  { value: 'Oui', label: 'Traitées' },
  { value: 'Partiel', label: 'Partiellement' },
  { value: 'Non', label: 'Non traitées' },
  { value: 'unknown', label: 'Non renseigné' },
];
const OPTIONS_REVUE = [
  { value: 'all', label: 'Toutes' },
  { value: 'check', label: 'À vérifier (date absente ou > 365 jours)' },
  { value: 'missing', label: 'Non renseignée' },
  { value: 'recent', label: 'Depuis moins de 365 jours' },
];

/** Présentation du registre déjà chargé : aucune requête ou écriture métier supplémentaire. */
export function PartiesInteresseesStudio({
  objects,
  scopeName,
  owner,
  writable,
  loading,
  total,
  onOpen,
  onCreate,
  onBrowse,
  registreOuvert,
  pagination,
}: {
  objects: GrcObject[];
  scopeName: string;
  owner: (o: GrcObject) => string;
  writable: boolean;
  loading: boolean;
  total: number;
  onOpen: (o: GrcObject) => void;
  onCreate: () => void;
  /** Ouvre ou replie le registre détaillé (filtres d'URL, décisions et réalisations, commandes existantes). */
  onBrowse: () => void;
  registreOuvert: boolean;
  pagination: ReactNode;
}) {
  const [mode, setMode] = useState<'panorama' | 'list'>('panorama');
  const [query, setQuery] = useState(''),
    [nature, setNature] = useState('all'),
    [addressed, setAddressed] = useState('all'),
    [review, setReview] = useState('all'),
    [category, setCategory] = useState('all'),
    [responsable, setResponsable] = useState('all');
  // Animations en continu (ADR 0099) : seule la préférence système de mouvement réduit les arrête.
  const moving = !useReducedMotion();
  const active = [nature, addressed, review, category, responsable].filter((v) => v !== 'all').length + Number(!!query);
  const items = objects.filter(
    (o) =>
      (!query ||
        sansAccents(
          [o.name, ...Object.values(o.data).filter((v) => typeof v === 'string'), owner(o)].join(' '),
        ).includes(sansAccents(query))) &&
      (nature === 'all' || naturePartie(o) === nature) &&
      (addressed === 'all' || (textePartie(o.data.addressed) || 'unknown') === addressed) &&
      (category === 'all' || textePartie(o.data.category) === category) &&
      (responsable === 'all' || owner(o) === responsable) &&
      (review === 'all' ||
        (review === 'check' ? revuePartie(o) : review === 'missing' ? !o.data.reviewedAt : !revuePartie(o))),
  );
  // Filtres avancés : tous les critères sauf la recherche, qui reste dans son champ.
  const avances = [nature, addressed, review, category, responsable].filter((v) => v !== 'all').length;
  const reinitialiserFiltres = () => {
    setNature('all');
    setAddressed('all');
    setReview('all');
    setCategory('all');
    setResponsable('all');
  };
  const reset = () => {
    setQuery('');
    reinitialiserFiltres();
  };
  const select = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    data: { value: string; label: string }[],
  ) => (
    <Select
      label={label}
      value={value}
      onChange={(v) => onChange(v ?? 'all')}
      allowDeselect={false}
      data={data}
      comboboxProps={{ withinPortal: false }}
    />
  );
  const choices = (values: string[]) => [
    { value: 'all', label: 'Tous' },
    ...[...new Set(values.filter(Boolean))].sort().map((v) => ({ value: v, label: v })),
  ];
  const libelleDe = (options: { value: string; label: string }[], v: string) =>
    options.find((o) => o.value === v)?.label ?? v;
  const criteres = (
    [
      [!!query, { cle: 'piq', libelle: 'Recherche', valeur: query, retirer: () => setQuery('') }],
      [
        nature !== 'all',
        { cle: 'pinat', libelle: 'Nature', valeur: libelleDe(OPTIONS_NATURE, nature), retirer: () => setNature('all') },
      ],
      [
        addressed !== 'all',
        {
          cle: 'piexi',
          libelle: 'Exigences traitées',
          valeur: libelleDe(OPTIONS_EXIGENCES, addressed),
          retirer: () => setAddressed('all'),
        },
      ],
      [
        review !== 'all',
        {
          cle: 'pirev',
          libelle: 'Dernière revue',
          valeur: libelleDe(OPTIONS_REVUE, review),
          retirer: () => setReview('all'),
        },
      ],
      [category !== 'all', { cle: 'picat', libelle: 'Catégorie', valeur: category, retirer: () => setCategory('all') }],
      [
        responsable !== 'all',
        { cle: 'piresp', libelle: 'Responsable', valeur: responsable, retirer: () => setResponsable('all') },
      ],
    ] as [boolean, CritereActif][]
  ).flatMap(([actif, c]) => (actif ? [c] : []));
  return (
    <section
      className="parties-studio"
      aria-label="Parties intéressées du périmètre"
      data-motion={moving ? 'on' : 'off'}
    >
      <header className="pi-heading">
        <div className="pi-summary">
          <span>
            <b>{objects.length}</b> chargées{total > objects.length ? ` sur ${total}` : ''}
          </span>
          <span>
            <i data-tone="teal" />
            {objects.filter((o) => o.data.addressed === 'Oui').length} traitées
          </span>
          <span>
            <i data-tone="amber" />
            {objects.filter((o) => ['Partiel', 'Non'].includes(textePartie(o.data.addressed))).length} partiel / non
          </span>
          <span title="Date absente ou de plus de 365 jours">
            <i data-tone="red" />
            {objects.filter((o) => revuePartie(o)).length} revues à vérifier
          </span>
        </div>
      </header>
      <div className="pi-surface">
        {/* Boîte d'outils commune (7.3.0) : vues, recherche, bascule du registre détaillé et filtres avancés ; ajout
            au bout de la ligne. */}
        <BoiteOutils
          label="Outils des parties intéressées"
          vues={[
            { value: 'panorama', label: 'Vue panorama', icone: <IconePartie name="network" /> },
            { value: 'list', label: 'Vue liste compacte', icone: <IconePartie name="list" /> },
          ]}
          vue={mode}
          onVue={(v) => setMode(v === 'list' ? 'list' : 'panorama')}
          recherche={{
            label: 'Rechercher une partie',
            value: query,
            onChange: setQuery,
            placeholder: 'Nom, besoin, responsable…',
          }}
          filtres={{
            actifs: avances,
            onReinitialiser: reinitialiserFiltres,
            contenu: (
              <>
                {select('Nature', nature, setNature, OPTIONS_NATURE)}
                {select('Exigences traitées', addressed, setAddressed, OPTIONS_EXIGENCES)}
                {select('Dernière revue', review, setReview, OPTIONS_REVUE)}
                {select('Catégorie', category, setCategory, choices(objects.map((o) => textePartie(o.data.category))))}
                {select('Responsable', responsable, setResponsable, choices(objects.map(owner)))}
              </>
            ),
          }}
          ajout={
            writable && (
              <Button onClick={onCreate}>
                <span aria-hidden="true">+&nbsp;</span>Ajouter une partie intéressée
              </Button>
            )
          }
        >
          <ActionIcon
            size="lg"
            variant="subtle"
            id="pi-bascule-registre"
            aria-label={registreOuvert ? 'Replier le registre détaillé' : 'Ouvrir le registre détaillé'}
            aria-expanded={registreOuvert}
            title="Registre détaillé et historique des décisions"
            onClick={onBrowse}
          >
            <IconePartie name="more" />
          </ActionIcon>
        </BoiteOutils>
        <PastillesCriteres criteres={criteres} onToutEffacer={reset} />
        <div className="pi-content" tabIndex={0} role="region" aria-label="Acteurs affichés" aria-busy={loading}>
          {loading && <p role="status">Chargement des parties intéressées…</p>}
          {!items.length && !loading ? (
            <div className="pi-empty">
              <h2>{active ? 'Aucune partie dans cette vue' : 'Aucune partie intéressée'}</h2>
              <p>
                {active
                  ? 'Adaptez les filtres pour retrouver les acteurs.'
                  : 'Les parties du périmètre apparaîtront ici.'}
              </p>
              {!!active && (
                <Button variant="default" onClick={reset}>
                  Réinitialiser
                </Button>
              )}
            </div>
          ) : mode === 'panorama' ? (
            <Panorama items={items} scopeName={scopeName} moving={moving} onOpen={onOpen} />
          ) : (
            <div className="pi-list">
              <div className="pi-list-header" aria-hidden="true">
                <span>Partie intéressée</span>
                <span>Besoins et attentes</span>
                <span>Responsable</span>
                <span>Exigences</span>
                <span>Dernière revue</span>
                <span />
              </div>
              {items.map((o) => (
                <button
                  type="button"
                  className="pi-row"
                  key={o.id}
                  id={`pi-open-${o.id}`}
                  {...ficheCliquable(() => onOpen(o), `Afficher ${o.name}`)}
                  aria-label={`Afficher ${o.name}`}
                >
                  <span className="pi-row-title">
                    <strong>{o.name}</strong>
                    <small>
                      {naturePartie(o)} · {textePartie(o.data.category) || 'Catégorie non renseignée'}
                    </small>
                  </span>
                  <span className="pi-row-expectation">{textePartie(o.data.expectations) || 'Non renseignés'}</span>
                  <span>{owner(o)}</span>
                  <EtatPartie object={o} />
                  <Revue object={o} />
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <footer className="pi-footer">
          <span role="status">
            {items.length} partie{items.length > 1 ? 's' : ''} affichée{items.length > 1 ? 's' : ''} sur{' '}
            {objects.length} chargée{objects.length > 1 ? 's' : ''}
          </span>
          <span>Traitement des exigences · dernière revue</span>
        </footer>
        {pagination}
      </div>
    </section>
  );
}

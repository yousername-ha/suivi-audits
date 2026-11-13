/* Matrice Studio approuvée : les processus et relations restent lus par leurs API existantes.
   Le registre complet et RecordEditor restent responsables de la recherche, des écritures et de l'historique. */
import { Button, Group, Loader, Modal, Select, Text } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import type { GrcObject, ProcessusCartes, Rattache } from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { CARTES_PROCESSUS_KEY } from '../processus/CartesProcessus';
import {
  QUADRANTS_SWOT,
  choixSwot,
  elementsSwot,
  referenceSwot,
  type LienSwot,
  type QuadrantSwot,
} from './swot-presentation';

const SOCLE = '00000000-0000-4000-8000-000000000001';
const REGISTRE = '__registre__';
interface ProcessusSwot {
  id: string;
  ref: string;
  name: string;
  owner: string;
  family: string;
  purpose: string;
  rattaches?: Rattache[] | null;
}
const txt = (v: unknown) => (typeof v === 'string' ? v : '');
const code = (p: ProcessusSwot) => (p.id.length <= 12 ? p.id : 'Processus');
const date = (v: unknown) => (txt(v) ? txt(v).slice(0, 10).split('-').reverse().join('/') : '');

const ICONS: Record<string, ReactNode> = {
  tree: (
    <>
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <path d="M12 8v4H5v4m7-4h7v4" />
    </>
  ),
  people: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-3.87" />
      <circle cx="9" cy="7" r="4" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  layers: <path d="m12 3 10 6-10 6L2 9Zm-9 10 9 5 9-5m-18 5 9 5 9-5" />,
  bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7Z" />,
  adjust: (
    <>
      <path d="M4 6h16M4 18h16M7 2v8m10 4v8" />
      <circle cx="7" cy="6" r="3" />
      <circle cx="17" cy="18" r="3" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m16 8-2 6-6 2 2-6Z" />
    </>
  ),
  warning: (
    <>
      <path d="m12 3 10 18H2Z" />
      <path d="M12 9v5m0 3h.01" />
    </>
  ),
  pause: <path d="M8 5v14M16 5v14" />,
  play: <path d="m8 4 12 8-12 8Z" />,
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5" />,
  edit: <path d="m15 4 5 5-11 11-6 1 1-6Zm-1 1 5 5" />,
  link: <path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10h.01" />
    </>
  ),
  arrow: <path d="M5 19 19 5M5 5h14v14" />,
  plus: <path d="M12 5v14M5 12h14" />,
};
function Icon({ name }: { name: string }) {
  return (
    <svg className="swot-icon" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name] ?? ICONS.layers}
    </svg>
  );
}

/** La pagination des processus natifs est suivie entièrement : le sélecteur ne dépend pas de la page du registre. */
async function processusNatifs(smsi: string) {
  const items: GrcObject[] = [],
    seen = new Set<number>();
  let offset: number | null = 0;
  while (offset !== null) {
    if (seen.has(offset)) throw new Error('La liste des processus n’a pas pu être chargée entièrement.');
    seen.add(offset);
    const page: { items: GrcObject[]; nextOffset: number | null } = await get(
      `/api/grc/${smsi}/objects?kind=process&offset=${offset}`,
    );
    items.push(...page.items);
    offset = page.nextOffset;
  }
  return items;
}
async function lireAnalyse(smsi: string, ref: string) {
  if (ref.startsWith('legacy:swots:'))
    return get<GrcObject>(
      `/api/grc/${smsi}/pilotage/legacy/swots/${encodeURIComponent(ref.slice('legacy:swots:'.length))}`,
    );
  return get<GrcObject>(`/api/grc/${smsi}/objects/${encodeURIComponent(ref.slice('object:'.length))}`);
}

export function SwotMatrice({
  smsi,
  objects,
  owners,
  writable,
  onOpen,
  onCreate,
  onHistory,
  onBrowse,
}: {
  smsi: string;
  objects: GrcObject[];
  owners: readonly { id: string; displayName: string }[];
  writable: boolean;
  onOpen: (o: GrcObject) => void;
  onCreate: () => void;
  onHistory: (o: GrcObject) => void;
  onBrowse: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const [focus, setFocus] = useState<QuadrantSwot | null>(null),
    [processOpened, setProcessOpened] = useState(false);
  const reduced = useReducedMotion();
  const [motion, setMotion] = useState<'auto' | 'on' | 'off'>('auto');
  const moving = motion === 'on' || (motion === 'auto' && !reduced);
  const plane = useRef<HTMLDivElement>(null);
  const focusOrigin = useRef<HTMLButtonElement>(null);
  const closeFocus = () => {
    setFocus(null);
    requestAnimationFrame(() => focusOrigin.current?.focus());
  };
  const legacy = useQuery({
    queryKey: CARTES_PROCESSUS_KEY(smsi),
    queryFn: () => get<ProcessusCartes>(`/api/grc/${smsi}/pilotage/processus-cartes`),
    enabled: smsi === SOCLE,
  });
  const native = useQuery({ queryKey: ['grc', smsi, 'swot-processus-natifs'], queryFn: () => processusNatifs(smsi) });
  const processes: ProcessusSwot[] = [
    ...(legacy.data?.processus ?? []).map((p) => ({
      ...p,
      family: legacy.data?.types.find((t) => t.code === p.family)?.label ?? p.family,
      rattaches: p.rattaches.swots,
    })),
    ...(native.data ?? []).map((p) => ({
      id: p.id,
      ref: `object:${p.id}`,
      name: p.name,
      owner: owners.find((o) => o.id === p.data.ownerId)?.displayName ?? txt(p.data.ownerLabel),
      family: txt(p.data.family),
      purpose: txt(p.data.mission) || txt(p.data.purpose),
    })),
  ];
  const initialProcess = processes.find((p) => p.rattaches?.length) ?? processes[0];
  const requestedProcess = params.get('processus');
  const process =
    requestedProcess === REGISTRE
      ? undefined
      : (processes.find((p) => p.ref === requestedProcess || p.id === requestedProcess) ?? initialProcess);
  const links = useQuery({
    queryKey: ['grc', smsi, 'links', process?.ref],
    queryFn: () => get<LienSwot[]>(`/api/grc/${smsi}/links?ref=${encodeURIComponent(process!.ref)}`),
    enabled: !!process,
  });
  const choices = process
    ? choixSwot(process.rattaches, links.data ?? [])
    : objects.map((o) => ({ ref: referenceSwot(o), name: o.name }));
  const choice = choices.find((c) => c.ref === params.get('analyse')) ?? choices[0];
  const current = useQuery({
    queryKey: ['grc', smsi, 'swot-matrice', choice?.ref],
    queryFn: () => lireAnalyse(smsi, choice!.ref),
    enabled: !!choice,
  });
  const object = current.data;
  const loading =
    native.isPending ||
    (smsi === SOCLE && legacy.isPending) ||
    (!!process && links.isPending) ||
    (!!choice && current.isPending);
  const sourceError = native.error ?? legacy.error ?? links.error ?? current.error;
  const chooseProcess = (value: string | null) =>
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search);
        if (value) next.set('processus', value);
        else next.delete('processus');
        next.delete('analyse');
        return next;
      },
      { replace: true },
    );
  const chooseAnalysis = (value: string | null) =>
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search);
        if (value) next.set('analyse', value);
        else next.delete('analyse');
        return next;
      },
      { replace: true },
    );

  // Les connecteurs suivent la hauteur réelle des textes ; aucun panneau n'a de hauteur maximale.
  useEffect(() => {
    const root = plane.current;
    if (!root) return;
    const resize = () => {
      const svg = root.querySelector<SVGSVGElement>('.swot-circuit'),
        hub = root.querySelector<HTMLElement>('.swot-process-hub');
      const top = root.querySelector<HTMLElement>('[data-key=S]'),
        bottom = root.querySelector<HTMLElement>('[data-key=O]');
      if (!svg || !hub || !top || !bottom) return;
      if (window.matchMedia('(max-width: 760px)').matches) {
        hub.style.removeProperty('top');
        return;
      }
      const w = root.clientWidth,
        h = root.clientHeight,
        x = w / 2,
        y = (top.offsetTop + top.offsetHeight + bottom.offsetTop) / 2,
        left = w * 0.34,
        right = w * 0.66;
      const axes = root.closest('.swot-matrix-layout')?.querySelector<HTMLElement>('.swot-row-axis');
      if (axes) {
        axes.style.gridTemplateRows = `${top.offsetHeight}px ${bottom.offsetHeight}px`;
        axes.style.rowGap = `${bottom.offsetTop - top.offsetTop - top.offsetHeight}px`;
      }
      hub.style.top = y + 'px';
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const paths: Record<string, string> = {
        S: `M ${x - 22} ${y - 18} H ${left + 14} Q ${left} ${y - 18} ${left} ${y - 32} V ${top.offsetTop + top.offsetHeight - 5}`,
        W: `M ${x + 22} ${y - 18} H ${right - 14} Q ${right} ${y - 18} ${right} ${y - 32} V ${top.offsetTop + top.offsetHeight - 5}`,
        O: `M ${x - 22} ${y + 18} H ${left + 14} Q ${left} ${y + 18} ${left} ${y + 32} V ${bottom.offsetTop + 5}`,
        T: `M ${x + 22} ${y + 18} H ${right - 14} Q ${right} ${y + 18} ${right} ${y + 32} V ${bottom.offsetTop + 5}`,
      };
      svg
        .querySelectorAll<SVGPathElement>('[data-wire]')
        .forEach((path) => path.setAttribute('d', paths[path.dataset.wire!]!));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();
    return () => observer.disconnect();
  }, [object, process?.ref]);

  const relation = process ? `${code(process)} · ${process.name}` : 'Analyses du registre';
  const meta =
    object &&
    [
      date(object.data.date),
      object.data.version !== undefined ? `Version ${String(object.data.version)}` : `Fiche version ${object.version}`,
    ]
      .filter(Boolean)
      .join(' / ');
  const renderSector = (q: QuadrantSwot) => {
    const entries = elementsSwot(object!.data, q);
    return (
      <article className="swot-sector" data-key={q.key} key={q.key} aria-label={q.label}>
        <span className="swot-sector-cut-line" aria-hidden="true" />
        <header>
          <span className="swot-sector-mark">
            <Icon name={q.icon} />
          </span>
          <div className="swot-sector-title">
            <small>{q.nature}</small>
            <h3>{q.label}</h3>
          </div>
          <span className="swot-sector-count">
            <b>{entries.length}</b>
            <small>élément{entries.length > 1 ? 's' : ''}</small>
          </span>
        </header>
        {entries.length ? (
          <ul>
            {entries.map((text, i) => (
              <li key={i}>
                <i aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="swot-sector-empty">Aucun élément renseigné.</p>
        )}
        <footer>
          <span className="swot-sector-nature">
            <i aria-hidden="true">{q.sign}</i>
            {q.angle}
          </span>
          <button
            type="button"
            className="swot-sector-read"
            onClick={(event) => {
              focusOrigin.current = event.currentTarget;
              setFocus(q);
            }}
            aria-label={`Agrandir ${q.label}`}
          >
            Lire <Icon name="expand" />
          </button>
        </footer>
      </article>
    );
  };

  return (
    <section className="swot-studio" aria-label="SWOT par processus" data-motion={moving ? 'on' : 'off'}>
      <Group justify="flex-end" mb="sm">
        {writable && (
          <Button onClick={onCreate} leftSection={<Icon name="plus" />}>
            Nouvelle analyse
          </Button>
        )}
      </Group>
      <div className="swot-process-hero">
        <div className="swot-hero-identity">
          <span className="swot-hero-symbol">
            <Icon name="tree" />
            <small>{process ? code(process) : 'SWOT'}</small>
          </span>
          <div>
            <div className="swot-hero-eyebrow">
              {process ? 'Processus rattaché' : 'Analyses du registre'}
              {process?.family && <> · {process.family}</>}
            </div>
            <h2>{process?.name ?? 'Toutes les analyses accessibles'}</h2>
            <div className="swot-hero-meta">
              {process && (
                <span>
                  <Icon name="people" />
                  {process.owner ? `Pilote : ${process.owner}` : 'Pilote non renseigné'}
                </span>
              )}
              <span>
                <Icon name="link" />
                {loading
                  ? 'Chargement…'
                  : sourceError
                    ? 'Lecture partielle'
                    : `${choices.length} analyse${choices.length > 1 ? 's' : ''}${process ? ' SWOT' : ' chargée' + (choices.length > 1 ? 's' : '')}`}
              </span>
            </div>
          </div>
        </div>
        <div className="swot-hero-picker">
          <Select
            label="Choisir un processus"
            searchable
            allowDeselect={false}
            value={process?.ref ?? REGISTRE}
            onChange={chooseProcess}
            data={[
              ...processes.map((p) => ({ value: p.ref, label: `${code(p)} · ${p.name}` })),
              { value: REGISTRE, label: 'Analyses du registre' },
            ]}
            description={
              process
                ? 'Ses analyses sont regroupées dans cette vue.'
                : 'Le registre complet conserve sa recherche et sa pagination.'
            }
          />
        </div>
      </div>
      <ErrorAlert error={sourceError} />
      {choices.length > 1 && (
        <Select
          className="swot-analysis-picker"
          label="Analyse affichée"
          searchable
          allowDeselect={false}
          value={choice?.ref ?? null}
          onChange={chooseAnalysis}
          data={choices.map((c) => ({ value: c.ref, label: c.name }))}
        />
      )}
      {loading && !object && (
        <Group justify="center" py="xl">
          <Loader aria-label="Chargement de l’analyse SWOT" />
        </Group>
      )}
      {!loading && !object && !sourceError && (
        <div className="swot-empty-analysis">
          <span className="swot-tile-icon">
            <Icon name="layers" />
          </span>
          <h2>{process ? `Aucune analyse SWOT rattachée à ${code(process)}` : 'Aucune analyse chargée'}</h2>
          <p>{process?.name ?? 'Retrouvez les analyses avec les commandes du registre.'}</p>
          <Button variant="default" onClick={onBrowse}>
            Parcourir le registre
          </Button>
        </div>
      )}
      {object && (
        <>
          <section className="swot-matrix-wrap" aria-label={`Matrice SWOT ${object.name}`}>
            <div className="swot-matrix-surface">
              <header className="swot-matrix-toolbar">
                <div className="swot-matrix-heading">
                  <span className="swot-tile-icon swot-blue">
                    <Icon name="layers" />
                  </span>
                  <div>
                    <h2>Analyse SWOT · {object.name}</h2>
                    <p>{meta}</p>
                  </div>
                </div>
                <div className="swot-matrix-actions">
                  <button
                    type="button"
                    className="swot-button swot-motion-control"
                    aria-pressed={!moving}
                    onClick={() => setMotion(moving ? 'off' : 'on')}
                  >
                    <Icon name={moving ? 'pause' : 'play'} />
                    {moving ? 'Pause animations' : 'Reprendre les animations'}
                  </button>
                  <button type="button" className="swot-button" onClick={() => onOpen(object)}>
                    <Icon name="edit" />
                    Ouvrir la fiche
                  </button>
                </div>
              </header>
              <div className="swot-column-axis" aria-hidden="true">
                <span>
                  <i>+</i>FAVORABLE
                </span>
                <span>
                  <i>−</i>DÉFAVORABLE
                </span>
              </div>
              <div className="swot-matrix-layout">
                <div className="swot-row-axis" aria-hidden="true">
                  <span>ENVIRONNEMENT INTERNE</span>
                  <span>ENVIRONNEMENT EXTERNE</span>
                </div>
                <div className="swot-matrix-plane" ref={plane}>
                  <svg className="swot-circuit" aria-hidden="true" preserveAspectRatio="none">
                    {QUADRANTS_SWOT.map((q) => (
                      <g key={q.key}>
                        <path data-wire={q.key} />
                        <path className="swot-wire-flow" data-wire={q.key} />
                      </g>
                    ))}
                  </svg>
                  <div className="swot-matrix-grid">{QUADRANTS_SWOT.map(renderSector)}</div>
                  {process ? (
                    <button
                      type="button"
                      className="swot-process-hub"
                      onClick={() => setProcessOpened(true)}
                      aria-label={`Voir le processus ${code(process)}`}
                    >
                      <span className="swot-hub-orbit" aria-hidden="true" />
                      <span className="swot-hub-core">
                        <Icon name="tree" />
                        <strong>{code(process)}</strong>
                        <small>PROCESSUS</small>
                      </span>
                    </button>
                  ) : (
                    <div className="swot-process-hub" aria-hidden="true">
                      <span className="swot-hub-core">
                        <Icon name="layers" />
                        <strong>SWOT</strong>
                        <small>ANALYSE</small>
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <footer className="swot-matrix-foot">
                <span>
                  <Icon name="link" />
                  {process ? (
                    <>
                      Processus <b className="swot-relation-id">{code(process)}</b> →{' '}
                    </>
                  ) : null}
                  Analyse <b className="swot-relation-id">{object.name}</b>
                  {txt(object.data.author) && <> · Auteur : {txt(object.data.author)}</>}
                </span>
                <span>
                  <Icon name="info" />
                  Analyse qualitative
                </span>
              </footer>
            </div>
          </section>
          <div className="swot-analysis-strip">
            <span className="swot-tile-icon">
              <Icon name="layers" />
            </span>
            <div className="swot-strip-title">
              <h2>{process ? 'Les analyses de ce processus' : 'Le registre des analyses'}</h2>
              <p>
                {object.name}
                {date(object.data.date) && ` · ${date(object.data.date)}`}
                {txt(object.data.author) && ` · ${txt(object.data.author)}`}
              </p>
            </div>
            <button type="button" className="swot-button" onClick={onBrowse}>
              Parcourir le registre <Icon name="arrow" />
            </button>
            <button type="button" className="swot-button" onClick={() => onHistory(object)}>
              Décisions et réalisations
            </button>
          </div>
        </>
      )}
      {!object && (loading || !!sourceError) && (
        <Group mt="md">
          <Button variant="default" onClick={onBrowse}>
            Parcourir le registre
          </Button>
        </Group>
      )}
      {focus && object && (
        <Modal
          opened
          returnFocus={false}
          onClose={closeFocus}
          title={focus?.label}
          size={850}
          closeButtonProps={{ 'aria-label': 'Fermer la lecture agrandie' }}
        >
          {focus && object && (
            <div className="swot-studio swot-focus-body" data-focus={focus.key} data-motion={moving ? 'on' : 'off'}>
              <div className="swot-focus-context">
                <Icon name="tree" />
                <strong>{relation}</strong>
                <span>→ SWOT {object.name}</span>
              </div>
              <div className="swot-focus-banner">
                <span className="swot-sector-mark">
                  <Icon name={focus.icon} />
                </span>
                <div>
                  <h3>{focus.label}</h3>
                  <p>
                    {focus.nature} · {focus.angle} · {elementsSwot(object.data, focus).length} élément(s)
                  </p>
                </div>
              </div>
              <ul className="swot-focus-list">
                {elementsSwot(object.data, focus).map((text, i) => (
                  <li key={i}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {text}
                  </li>
                ))}
              </ul>
              {!elementsSwot(object.data, focus).length && <Text>Aucun élément renseigné.</Text>}
              <Group justify="space-between" mt="xl">
                <Button variant="default" onClick={closeFocus}>
                  Revenir à la matrice
                </Button>
                <Button
                  leftSection={<Icon name="edit" />}
                  onClick={() => {
                    setFocus(null);
                    // La lecture est retirée avant l'ouverture de la fiche : une seule fenêtre et un seul piège de focus.
                    requestAnimationFrame(() => {
                      focusOrigin.current?.focus();
                      onOpen(object);
                    });
                  }}
                >
                  Ouvrir la fiche SWOT
                </Button>
              </Group>
            </div>
          )}
        </Modal>
      )}
      <Modal
        opened={processOpened && !!process}
        onClose={() => setProcessOpened(false)}
        title={`Processus — ${process ? code(process) : ''}`}
        size={850}
        closeButtonProps={{ 'aria-label': 'Fermer le résumé du processus' }}
      >
        {process && (
          <div className="swot-studio">
            <div className="swot-record-context">
              <Icon name="tree" />
              <div>
                <small>Processus rattaché à l’analyse affichée</small>
                <strong>{process.name}</strong>
              </div>
            </div>
            <dl className="swot-process-details">
              <div>
                <dt>Type</dt>
                <dd>{process.family || 'Non renseigné'}</dd>
              </div>
              <div>
                <dt>Pilote</dt>
                <dd>{process.owner || 'Non renseigné'}</dd>
              </div>
              <div className="swot-wide">
                <dt>Finalité</dt>
                <dd>{process.purpose || 'Non renseignée'}</dd>
              </div>
              <div className="swot-wide">
                <dt>Analyses SWOT rattachées</dt>
                <dd>{choices.map((c) => c.name).join(', ') || 'Aucune'}</dd>
              </div>
            </dl>
            <Group justify="flex-end" mt="xl">
              <Button variant="default" onClick={() => setProcessOpened(false)}>
                Revenir à la matrice
              </Button>
            </Group>
          </div>
        )}
      </Modal>
    </section>
  );
}

/* Matrice SWOT Studio (refonte Neon, lot 5, ADR 0093) : modèle retenu par le RSSI, au grand cercle processus centré.
   Lecture seule : les processus, les analyses et leurs relations viennent des API existantes (cartes des processus,
   processus natifs, relations transverses, fiche de l'analyse). Le registre complet de BusinessRegistry (recherche, filtres,
   pages, création, fiche, historique et droits) reste affiché sous la matrice, inchangé. Le décor (cercle, liaisons,
   pictogrammes) ne crée ni processus ni lien : le cercle ouvre le résumé du processus réel. */
import { Button, Group, Loader, Modal, Select, Text } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import type { GrcObject, ProcessusCartes, Rattache } from '@suivi/shared';
import { retenirFocusFiche } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { CARTES_PROCESSUS_KEY } from '../processus/CartesProcessus';
import {
  QUADRANTS_SWOT,
  analyseLisible,
  choixSwot,
  codeProcessus,
  dateSwot,
  elementsSwot,
  metaAnalyse,
  processusParDefaut,
  referenceSwot,
  type LienSwot,
  type QuadrantSwot,
} from './swot-presentation';

const SOCLE = '00000000-0000-4000-8000-000000000001';
/** Valeur du sélecteur pour les analyses du registre, sans processus. */
const REGISTRE = '__registre__';

interface ProcessusSwot {
  id: string;
  ref: string;
  name: string;
  owner: string;
  family: string;
  purpose: string;
  /** Analyses rattachées connues de la carte du processus ; absent pour un processus natif (lues par ses relations). */
  rattaches?: Rattache[] | null;
}
const txt = (v: unknown) => (typeof v === 'string' ? v : '');

const ICONES: Record<string, ReactNode> = {
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
  arrow: <path d="M12 5v14m-6-6 6 6 6-6" />,
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
};
function Icone({ nom }: { nom: string }) {
  return (
    <svg className="swot-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {ICONES[nom] ?? ICONES.layers}
    </svg>
  );
}

/** Processus natifs : toutes les pages sont lues, le sélecteur ne dépend pas de la page affichée du registre. */
async function processusNatifs(smsi: string) {
  const items: GrcObject[] = [],
    vus = new Set<number>();
  let offset: number | null = 0;
  while (offset !== null) {
    if (vus.has(offset)) throw new Error('La liste des processus n’a pas pu être chargée entièrement.');
    vus.add(offset);
    const page: { items: GrcObject[]; nextOffset: number | null } = await get(
      `/api/grc/${smsi}/objects?kind=process&offset=${offset}`,
    );
    items.push(...page.items);
    offset = page.nextOffset;
  }
  return items;
}
/** Une analyse rattachée se lit par sa référence, indépendamment de la page courante du registre. */
function lireAnalyse(smsi: string, ref: string) {
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
  children,
}: {
  smsi: string;
  /** Analyses chargées par le registre (première page et suivantes affichées). */
  objects: GrcObject[];
  owners: readonly { id: string; displayName: string }[];
  writable: boolean;
  onOpen: (o: GrcObject) => void;
  onCreate: () => void;
  onHistory: (o: GrcObject) => void;
  /** Registre complet, affiché tel quel sous la matrice. */
  children: ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const commun = smsi === SOCLE;
  const [lecture, setLecture] = useState<QuadrantSwot | null>(null),
    [resume, setResume] = useState(false),
    [pause, setPause] = useState(false);
  const reduit = useReducedMotion();
  const anime = !reduit && !pause;
  const origineLecture = useRef<HTMLButtonElement | null>(null);
  const registre = useRef<HTMLElement>(null);
  const titreRegistre = useId();

  const cartes = useQuery({
    queryKey: CARTES_PROCESSUS_KEY(smsi),
    queryFn: () => get<ProcessusCartes>(`/api/grc/${smsi}/pilotage/processus-cartes`),
  });
  const natifs = useQuery({ queryKey: ['grc', smsi, 'swot-processus-natifs'], queryFn: () => processusNatifs(smsi) });
  const processus: ProcessusSwot[] = [
    ...(cartes.data?.processus ?? []).map((p) => ({
      id: p.id,
      ref: p.ref,
      name: p.name,
      owner: p.owner,
      family: cartes.data?.types.find((t) => t.code === p.family)?.label ?? p.family,
      purpose: p.purpose,
      rattaches: p.rattaches.swots,
    })),
    ...(natifs.data ?? []).map((p) => ({
      id: p.id,
      ref: `object:${p.id}`,
      name: p.name,
      owner: owners.find((o) => o.id === p.data.ownerId)?.displayName ?? txt(p.data.ownerLabel),
      family: txt(p.data.family),
      purpose: txt(p.data.mission) || txt(p.data.purpose),
    })),
  ];
  const demande = params.get('processus');
  const process =
    demande === REGISTRE
      ? undefined
      : (processus.find((p) => p.ref === demande || p.id === demande) ?? processusParDefaut(processus));
  const liens = useQuery({
    queryKey: ['grc', smsi, 'links', process?.ref],
    queryFn: () => get<LienSwot[]>(`/api/grc/${smsi}/links?ref=${encodeURIComponent(process!.ref)}`),
    enabled: !!process,
  });
  const choix = process
    ? choixSwot(process.rattaches, liens.data ?? [], commun)
    : objects.map((o) => ({ ref: referenceSwot(o), name: o.name })).filter((c) => analyseLisible(c.ref, commun));
  const choisi = choix.find((c) => c.ref === params.get('analyse')) ?? choix[0];
  const courant = useQuery({
    queryKey: ['grc', smsi, 'swot-matrice', choisi?.ref],
    queryFn: () => lireAnalyse(smsi, choisi!.ref),
    enabled: !!choisi,
  });
  const object = courant.data;
  const chargement =
    natifs.isPending || cartes.isPending || (!!process && liens.isPending) || (!!choisi && courant.isPending);
  const erreur = natifs.error ?? cartes.error ?? liens.error ?? courant.error;

  const regler = (cle: string, valeur: string | null, effacer?: string) =>
    setParams(
      (p) => {
        const suite = new URLSearchParams(p);
        if (valeur) suite.set(cle, valeur);
        else suite.delete(cle);
        if (effacer) suite.delete(effacer);
        return suite;
      },
      { replace: true },
    );
  const parcourir = () => {
    registre.current?.scrollIntoView({ block: 'start', behavior: reduit ? 'auto' : 'smooth' });
    registre.current?.focus({ preventScroll: true });
  };
  const ouvrirFiche = (o: GrcObject, origine: HTMLElement | null) => {
    if (origine) retenirFocusFiche(origine);
    onOpen(o);
  };
  const fermerLecture = () => {
    setLecture(null);
    requestAnimationFrame(() => origineLecture.current?.focus());
  };

  const code = process ? codeProcessus(process.id) : 'SWOT';
  const relation = process ? `${code} · ${process.name}` : 'Analyses du registre';
  const secteur = (q: QuadrantSwot) => {
    const elements = elementsSwot(object!.data, q);
    return (
      <article className="swot-sector" data-key={q.key} key={q.key} aria-label={q.label}>
        <span className="swot-sector-cut-line" aria-hidden="true" />
        <span className="swot-sector-letter" aria-hidden="true">
          {q.key}
        </span>
        <header>
          <span className="swot-sector-mark">
            <Icone nom={q.icon} />
          </span>
          <div className="swot-sector-title">
            <small>{q.nature}</small>
            <h3>{q.label}</h3>
          </div>
          <span className="swot-sector-count">
            <b>{elements.length}</b>
            <small>élément{elements.length > 1 ? 's' : ''}</small>
          </span>
        </header>
        {elements.length ? (
          <ul>
            {elements.map((texte, i) => (
              <li key={i}>
                <i aria-hidden="true" />
                <span>{texte}</span>
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
            aria-label={`Lire les ${q.label.toLowerCase()}`}
            onClick={(event) => {
              origineLecture.current = event.currentTarget;
              setLecture(q);
            }}
          >
            Lire <Icone nom="expand" />
          </button>
        </footer>
      </article>
    );
  };

  return (
    <>
      <section
        className="swot-studio swot-vue"
        aria-label="Matrice SWOT par processus"
        data-motion={anime ? 'on' : 'off'}
      >
        {writable && (
          <Group justify="flex-end" className="swot-commandes">
            <Button onClick={onCreate} leftSection={<Icone nom="plus" />}>
              Nouvelle analyse
            </Button>
          </Group>
        )}
        <div className="swot-process-hero">
          <div className="swot-hero-identity">
            <span className="swot-hero-symbol">
              <Icone nom="tree" />
              <small>{code}</small>
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
                    <Icone nom="people" />
                    {process.owner ? `Pilote : ${process.owner}` : 'Pilote non renseigné'}
                  </span>
                )}
                <span>
                  <Icone nom="link" />
                  {chargement
                    ? 'Chargement…'
                    : erreur
                      ? 'Lecture partielle'
                      : `${choix.length} analyse${choix.length > 1 ? 's' : ''} ${process ? 'SWOT' : 'chargée' + (choix.length > 1 ? 's' : '')}`}
                </span>
              </div>
            </div>
          </div>
          <div className="swot-hero-picker">
            <Select
              allowDeselect={false}
              searchable
              label="Choisir un processus"
              value={process?.ref ?? REGISTRE}
              onChange={(v) => regler('processus', v, 'analyse')}
              data={[
                ...processus.map((p) => ({ value: p.ref, label: `${codeProcessus(p.id)} · ${p.name}` })),
                { value: REGISTRE, label: 'Analyses du registre' },
              ]}
              description={
                process
                  ? 'Ses analyses SWOT sont regroupées dans cette vue.'
                  : 'Le registre complet, plus bas, conserve sa recherche et sa pagination.'
              }
            />
          </div>
        </div>
        <ErrorAlert error={erreur} />
        {choix.length > 1 && (
          <Select
            allowDeselect={false}
            searchable
            className="swot-analysis-picker"
            label="Analyse affichée"
            value={choisi?.ref ?? null}
            onChange={(v) => regler('analyse', v)}
            data={choix.map((c) => ({ value: c.ref, label: c.name }))}
          />
        )}
        {chargement && !object && (
          <Group justify="center" py="xl">
            <Loader aria-label="Chargement de l’analyse SWOT" />
          </Group>
        )}
        {!chargement && !object && !erreur && (
          <div className="swot-empty-analysis">
            <span className="swot-tile-icon">
              <Icone nom="layers" />
            </span>
            <h2>{process ? `Aucune analyse SWOT rattachée à ${code}` : 'Aucune analyse chargée'}</h2>
            <p>{process?.name ?? 'Retrouvez les analyses avec les commandes du registre.'}</p>
            <button type="button" className="swot-button" onClick={parcourir}>
              Parcourir le registre <Icone nom="arrow" />
            </button>
          </div>
        )}
        {!object && !chargement && !!erreur && (
          <Group>
            <button type="button" className="swot-button" onClick={parcourir}>
              Parcourir le registre <Icone nom="arrow" />
            </button>
          </Group>
        )}
        {object && (
          <>
            <section className="swot-matrix-wrap" aria-label={`Matrice SWOT ${object.name}`}>
              <div className="swot-matrix-surface">
                <header className="swot-matrix-toolbar">
                  <div className="swot-matrix-heading">
                    <span className="swot-tile-icon swot-blue">
                      <Icone nom="layers" />
                    </span>
                    <div>
                      <h2>Analyse SWOT · {object.name}</h2>
                      <p>{metaAnalyse(object)}</p>
                    </div>
                  </div>
                  <div className="swot-matrix-actions">
                    {!reduit && (
                      <button
                        type="button"
                        className="swot-button swot-motion-control"
                        aria-pressed={pause}
                        onClick={() => setPause((v) => !v)}
                      >
                        <Icone nom={pause ? 'play' : 'pause'} />
                        {pause ? 'Reprendre les animations' : 'Pause animations'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="swot-button"
                      onClick={(event) => ouvrirFiche(object, event.currentTarget)}
                    >
                      <Icone nom="edit" />
                      Ouvrir la fiche
                    </button>
                  </div>
                </header>
                <div className="swot-plan">
                  <span className="swot-axis swot-axis-col" data-axe="favorable" aria-hidden="true">
                    <i>+</i>Favorable
                  </span>
                  <span className="swot-axis swot-axis-col" data-axe="defavorable" aria-hidden="true">
                    <i>−</i>Défavorable
                  </span>
                  <span className="swot-axis swot-axis-row" data-axe="interne" aria-hidden="true">
                    Environnement interne
                  </span>
                  <span className="swot-axis swot-axis-row" data-axe="externe" aria-hidden="true">
                    Environnement externe
                  </span>
                  {QUADRANTS_SWOT.map(secteur)}
                  <div className="swot-wires" aria-hidden="true">
                    {QUADRANTS_SWOT.map((q) => (
                      <span className="swot-wire" data-wire={q.key} key={q.key}>
                        <i />
                      </span>
                    ))}
                  </div>
                  <div className="swot-hub-slot">
                    {process ? (
                      <button
                        type="button"
                        className="swot-process-hub"
                        onClick={() => setResume(true)}
                        aria-label={`${code} Processus, ouvrir le résumé : ${process.name}`}
                      >
                        <span className="swot-hub-orbit" aria-hidden="true" />
                        <span className="swot-hub-core">
                          <Icone nom="tree" />
                          <strong>{code}</strong>
                          <small>Processus</small>
                        </span>
                      </button>
                    ) : (
                      <div className="swot-process-hub" aria-hidden="true">
                        <span className="swot-hub-core">
                          <Icone nom="layers" />
                          <strong>SWOT</strong>
                          <small>Analyse</small>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <footer className="swot-matrix-foot">
                  <span>
                    <Icone nom="link" />
                    <span>
                      {process && (
                        <>
                          Processus <b className="swot-relation-id">{code}</b> →{' '}
                        </>
                      )}
                      Analyse <b className="swot-relation-id">{object.name}</b>
                      {txt(object.data.author) && <> · Auteur : {txt(object.data.author)}</>}
                    </span>
                  </span>
                  <span>
                    <Icone nom="info" />
                    Analyse qualitative
                  </span>
                </footer>
              </div>
            </section>
            <div className="swot-analysis-strip">
              <span className="swot-tile-icon">
                <Icone nom="layers" />
              </span>
              <div className="swot-strip-title">
                <h2>{process ? 'Les analyses de ce processus' : 'Le registre des analyses'}</h2>
                <p>
                  {object.name}
                  {dateSwot(object.data.date) && ` · ${dateSwot(object.data.date)}`}
                  {txt(object.data.author) && ` · ${txt(object.data.author)}`}
                </p>
              </div>
              <button type="button" className="swot-button" onClick={parcourir}>
                Parcourir le registre <Icone nom="arrow" />
              </button>
              <button type="button" className="swot-button" onClick={() => onHistory(object)}>
                <Icone nom="history" />
                Décisions et réalisations
              </button>
            </div>
          </>
        )}
        {lecture && object && (
          <Modal
            opened
            size="lg"
            returnFocus={false}
            onClose={fermerLecture}
            title={lecture.label}
            closeButtonProps={{ 'aria-label': 'Fermer la lecture agrandie' }}
          >
            <div className="swot-studio swot-focus-body" data-focus={lecture.key} data-motion={anime ? 'on' : 'off'}>
              <div className="swot-focus-context">
                <Icone nom="tree" />
                <strong>{relation}</strong>
                <span>→ SWOT {object.name}</span>
              </div>
              <div className="swot-focus-banner">
                <span className="swot-sector-mark">
                  <Icone nom={lecture.icon} />
                </span>
                <div>
                  <h3>{lecture.label}</h3>
                  <p>
                    {lecture.nature} · {lecture.angle} · {elementsSwot(object.data, lecture).length} élément(s)
                  </p>
                </div>
              </div>
              {elementsSwot(object.data, lecture).length ? (
                <ol className="swot-focus-list">
                  {elementsSwot(object.data, lecture).map((texte, i) => (
                    <li key={i}>
                      <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                      <p>{texte}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <Text>Aucun élément renseigné.</Text>
              )}
              <Group justify="space-between" mt="xl">
                <Button variant="default" onClick={fermerLecture}>
                  Revenir à la matrice
                </Button>
                <Button
                  leftSection={<Icone nom="edit" />}
                  onClick={() => {
                    setLecture(null);
                    // La lecture est retirée avant l'ouverture de la fiche : une seule fenêtre, un seul piège de focus.
                    requestAnimationFrame(() => {
                      origineLecture.current?.focus();
                      ouvrirFiche(object, origineLecture.current);
                    });
                  }}
                >
                  Ouvrir la fiche SWOT
                </Button>
              </Group>
            </div>
          </Modal>
        )}
        <Modal
          opened={resume && !!process}
          size="lg"
          onClose={() => setResume(false)}
          title={`Processus — ${process ? code : ''}`}
          closeButtonProps={{ 'aria-label': 'Fermer le résumé du processus' }}
        >
          {process && (
            <div className="swot-studio">
              <div className="swot-record-context">
                <Icone nom="tree" />
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
                  <dd>{choix.map((c) => c.name).join(', ') || 'Aucune'}</dd>
                </div>
              </dl>
              <Group justify="flex-end" mt="xl">
                <Button variant="default" onClick={() => setResume(false)}>
                  Revenir à la matrice
                </Button>
              </Group>
            </div>
          )}
        </Modal>
      </section>
      <section className="swot-registry" ref={registre} tabIndex={-1} aria-labelledby={titreRegistre}>
        <h2 id={titreRegistre} className="swot-registry-title">
          Registre complet des analyses SWOT
        </h2>
        {children}
      </section>
    </>
  );
}

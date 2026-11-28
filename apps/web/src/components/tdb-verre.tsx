/* Dalles du tableau de bord en style « Verre » (dessin validé, décision du RSSI du 27/11/2026). Même structure pour
   chaque dalle : titre et flèche de détail en haut ; chiffre clé et graphique centrés au milieu ; rangée de chiffres en
   bas, alignée d'une dalle à l'autre. Tableau de bord cliquable : chaque élément d'un graphique (arc, segment, case,
   barre, point, sommet) affiche son intitulé dans une bulle au survol et au focus clavier (reliée par
   aria-describedby, fermée par Échap) et mène à sa fiche ou à la page filtrée qui le montre. Quand plusieurs fiches
   partagent un élément (case de la grille des risques, mois d'incidents) et qu'aucun filtre d'adresse ne permet de les
   montrer ensemble, le clic ouvre la liste de leurs liens. Les couleurs viennent de la feuille verre.css (classes), les
   géométries des attributs SVG : aucun style en ligne (ADR 0006). Les autres styles gardent les cartes de tdb-neon.tsx. */
import { Popover } from '@mantine/core';
import {
  incidentOuvert,
  LIBELLES_NATURE_CONSTAT,
  NATURES_CONSTAT,
  type EtatActionTdb,
  type GrilleRisques,
  type Incident,
  type NatureConstat,
  type Synthese,
} from '@suivi/shared';
import { Dalle } from '@suivi/ui';
import { useId, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCan } from '../session';
import {
  casesActions,
  constatsParNature,
  detailAction,
  libelleReferentiel,
  lienIncident,
  lienNatureConstat,
  lienReferentiel,
  lienRisque,
  moisIncidents,
  PAGE_ACTIONS,
  PAGE_APPLICABILITE,
  PAGE_RISQUES,
  pluriel,
  rangeesGrille,
  teinteNiveau,
  vueRisques,
} from './tdb-verre-calculs';
import type { RenduDalle } from './tdb-types';

type Teinte = 'violet' | 'sarcelle' | 'jaune' | 'vert' | 'ambre' | 'rouge' | 'rose' | 'bleu' | 'orange' | 'gris';
/** Teintes successives des séries (référentiels). */
const SERIES: readonly Teinte[] = ['violet', 'sarcelle', 'jaune', 'bleu', 'rose', 'orange'];
const pourcent = (v: number) => `${Math.round(v)}\u202f%`;
type Referentiel = NonNullable<Synthese['conformite']>[number];

/* ---------------------------------------------------------------- Bulles et éléments cliquables */

interface Bulles {
  actif: string | null;
  interactif: boolean;
  id: (cle: string) => string;
  evts: (cle: string) => {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
    onKeyDown: (e: KeyboardEvent) => void;
  };
  fermer: () => void;
}

/** Bulle active d'un graphique : une à la fois, ouverte au survol ou au focus, fermée en sortant ou par Échap. */
function useBulles(interactif: boolean): Bulles {
  const base = useId();
  const [actif, setActif] = useState<string | null>(null);
  return {
    actif,
    interactif,
    id: (cle) => `${base}-${cle}`,
    evts: (cle) => ({
      onMouseEnter: () => setActif(cle),
      onMouseLeave: () => setActif((a) => (a === cle ? null : a)),
      onFocus: () => setActif(cle),
      onBlur: () => setActif((a) => (a === cle ? null : a)),
      onKeyDown: (e) => {
        if (e.key !== 'Escape' || actif !== cle) return;
        e.stopPropagation();
        setActif(null);
      },
    }),
    fermer: () => setActif(null),
  };
}

/** Bulle d'un élément : intitulé, détail, liste éventuelle, invitation au clic. Présente dans le document même fermée
    (cible de aria-describedby), affichée seulement quand l'élément est actif. */
function Bulle({
  b,
  cle,
  titre,
  detail,
  liste,
  invite,
}: {
  b: Bulles;
  cle: string;
  titre: string;
  detail?: string;
  liste?: readonly string[];
  invite?: string;
}) {
  if (!b.interactif) return null;
  return (
    <div id={b.id(cle)} role="tooltip" className="tdbv-bulle" hidden={b.actif !== cle}>
      <b>{titre}</b>
      {detail && <span>{detail}</span>}
      {liste && liste.length > 0 && (
        <ul>
          {liste.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}
      {invite && <span className="tdbv-bulle-invite">{invite}</span>}
    </div>
  );
}

/** Choix parmi plusieurs fiches d'un même élément : liste de liens dans une fenêtre accrochée à l'élément. */
interface Choix {
  titre: string;
  liens: readonly { nom: string; vers: string }[];
  /** Fiches non listées et page qui les montre toutes. */
  reste?: { n: number; vers: string; libelle: string };
}

/** Élément HTML cliquable : lien direct vers sa fiche, ou bouton qui ouvre le choix entre plusieurs fiches ; simple
    pavé sans destination (mode modification, chiffres ouverts d'un auteur). */
function Point({
  b,
  cle,
  nom,
  vers,
  choix,
  className,
  children,
}: {
  b: Bulles;
  cle: string;
  nom: string;
  vers?: string | null;
  choix?: Choix | null;
  className: string;
  children?: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  if (!b.interactif || (!vers && !choix)) return <span className={className}>{children}</span>;
  if (vers)
    return (
      <Link
        to={vers}
        className={`tdbv-cible ${className}`}
        aria-label={nom}
        aria-describedby={b.id(cle)}
        {...b.evts(cle)}
      >
        {children}
      </Link>
    );
  const c = choix!;
  return (
    <Popover opened={ouvert} onChange={setOuvert} position="top" withArrow shadow="md" trapFocus returnFocus>
      <Popover.Target>
        <button
          type="button"
          className={`tdbv-cible ${className}`}
          aria-label={nom}
          aria-describedby={b.id(cle)}
          {...b.evts(cle)}
          onClick={() => {
            b.fermer();
            setOuvert((o) => !o);
          }}
        >
          {children}
        </button>
      </Popover.Target>
      <Popover.Dropdown className="tdbv-choix" aria-label={c.titre}>
        <p className="tdbv-choix-titre">{c.titre}</p>
        <ul>
          {c.liens.map((l) => (
            <li key={l.vers}>
              <Link to={l.vers} onClick={() => setOuvert(false)}>
                {l.nom}
              </Link>
            </li>
          ))}
        </ul>
        {c.reste && c.reste.n > 0 && (
          <Link to={c.reste.vers} className="tdbv-choix-reste" onClick={() => setOuvert(false)}>
            {`+ ${pluriel(c.reste.n, 'autre')} : ${c.reste.libelle}`}
          </Link>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}

/** Élément SVG cliquable (arc, segment, sommet) : lien SVG, navigation de l'application sans rechargement. */
function LienSvg({
  b,
  cle,
  nom,
  vers,
  className,
  children,
}: {
  b: Bulles;
  cle: string;
  nom: string;
  vers: string | null;
  className: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const actif = b.actif === cle ? ' actif' : '';
  if (!b.interactif || !vers) return <g className={className}>{children}</g>;
  return (
    <a
      href={vers}
      className={`tdbv-cible-svg ${className}${actif}`}
      aria-label={nom}
      aria-describedby={b.id(cle)}
      {...b.evts(cle)}
      onClick={(e: MouseEvent) => {
        if (e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        navigate(vers);
      }}
    >
      {children}
    </a>
  );
}

/* ---------------------------------------------------------------- Cadre commun */

interface ChiffrePied {
  libelle: string;
  valeur: ReactNode;
  teinte: Teinte;
}

function Pied({ chiffres }: { chiffres: readonly ChiffrePied[] }) {
  return (
    <dl className={`tdbv-pied tdbv-pied--${Math.min(4, chiffres.length)}`}>
      {chiffres.map((c) => (
        <div key={c.libelle}>
          <dt>{c.libelle}</dt>
          <dd className={`chiffres tdbv-t-${c.teinte}`}>{c.valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

function Cle({
  valeur,
  etiquette,
  teinte,
  titre,
}: {
  valeur: ReactNode;
  etiquette: string;
  teinte?: Teinte;
  /** Étiquette complète en bulle native, quand elle peut être tronquée (nom de méthode long). */
  titre?: string;
}) {
  return (
    <p className="tdbv-cle">
      <span className={`tdbv-gros chiffres${teinte ? ` tdbv-t-${teinte}` : ''}`}>{valeur}</span>
      <span className="tdbv-etiq" title={titre}>
        {etiquette}
      </span>
    </p>
  );
}

/** Dalle au cadre du dessin : titre et flèche, bandeau facultatif sous le titre (rail de choix), centre (chiffre clé et
    graphique), rangée du bas. */
function Cadre({
  p,
  titre,
  variante,
  bandeau,
  centre,
  pied,
}: {
  p: RenduDalle;
  titre: string;
  variante: string;
  bandeau?: ReactNode;
  centre: ReactNode;
  pied: ReactNode;
}) {
  return (
    <Dalle
      titre={titre}
      largeur={p.largeur}
      hauteur={p.hauteur}
      action={p.action}
      dalle={p.id}
      className={`tdb-neon tdbv tdbv--${variante}`}
    >
      {bandeau}
      <div className="tdbv-centre">{centre}</div>
      {pied}
    </Dalle>
  );
}

function Vide({ children }: { children: ReactNode }) {
  return <p className="tdbv-vide">{children}</p>;
}

/* ---------------------------------------------------------------- Conformité : arcs concentriques */

export function ConformiteVerre({
  p,
  refs,
  moyenne,
}: {
  p: RenduDalle;
  refs: readonly Referentiel[];
  moyenne: number | null;
}) {
  const can = useCan();
  const b = useBulles(!!p.interactif);
  const lignes = refs.filter((r) => r.applicables > 0);
  const T = 188,
    c = T / 2,
    k = lignes.length;
  const pas = k > 1 ? Math.min(15, 44 / (k - 1)) : 0;
  const ep = k > 1 ? Math.max(5, Math.min(11, pas - 4)) : 11;
  const lire = can('audit', 'lire');
  return (
    <Cadre
      p={p}
      titre="Conformité"
      variante="conformite"
      centre={
        lignes.length ? (
          <div className="tdbv-graphe">
            <div className="tdbv-anneau">
              <svg
                width={T}
                height={T}
                viewBox={`0 0 ${T} ${T}`}
                role="group"
                aria-label="Taux de conformité par référentiel, autour de leur moyenne"
              >
                {lignes.map((r, i) => {
                  const rayon = 84 - i * pas,
                    circ = 2 * Math.PI * rayon,
                    taux = (r.total * 100) / r.applicables,
                    l = (circ * taux) / 100;
                  const nom = libelleReferentiel(r.ref, r.libelle);
                  return (
                    <LienSvg
                      key={r.ref}
                      b={b}
                      cle={`ref-${r.ref}`}
                      nom={`${nom} : ${pourcent(taux)} de conformité, ouvrir sa déclaration d’applicabilité`}
                      vers={lire ? lienReferentiel(r.ref) : null}
                      className={`tdbv-s-${SERIES[i % SERIES.length]}`}
                    >
                      <circle cx={c} cy={c} r={rayon} strokeWidth={ep} className="tdbv-piste" />
                      {l > 0 && (
                        <circle
                          cx={c}
                          cy={c}
                          r={rayon}
                          strokeWidth={ep}
                          strokeDasharray={`${l.toFixed(1)} ${circ.toFixed(1)}`}
                          transform={`rotate(-90 ${c} ${c})`}
                          className="tdbv-arc"
                        />
                      )}
                    </LienSvg>
                  );
                })}
              </svg>
              <p className="tdbv-anneau-centre" aria-hidden="true">
                <span className="tdbv-anneau-valeur chiffres">{moyenne === null ? '—' : pourcent(moyenne)}</span>
                <span className="tdbv-anneau-libelle">moyenne</span>
              </p>
            </div>
            {lignes.map((r) => {
              const taux = (r.total * 100) / r.applicables;
              const nom = libelleReferentiel(r.ref, r.libelle);
              return (
                <Bulle
                  key={r.ref}
                  b={b}
                  cle={`ref-${r.ref}`}
                  titre={`${nom} : ${pourcent(taux)}`}
                  detail={`${r.total} exigences mises en œuvre totalement sur ${r.applicables} applicables`}
                  invite="Ouvrir la déclaration d’applicabilité ›"
                />
              );
            })}
            <p className="sr-only">
              {`Moyenne des référentiels : ${moyenne === null ? 'non calculée' : pourcent(moyenne)}. Déclaration interne, non certifiée.`}
            </p>
          </div>
        ) : (
          <Vide>Aucun référentiel applicable.</Vide>
        )
      }
      pied={
        <Pied
          chiffres={lignes.slice(0, 4).map((r, i) => ({
            libelle: libelleReferentiel(r.ref, r.libelle),
            valeur: pourcent((r.total * 100) / r.applicables),
            teinte: SERIES[i % SERIES.length]!,
          }))}
        />
      }
    />
  );
}

/* ---------------------------------------------------------------- Applicabilité : anneau */

export function ApplicabiliteVerre({ p, refs }: { p: RenduDalle; refs: readonly Referentiel[] }) {
  const b = useBulles(!!p.interactif);
  const somme = (f: (r: Referentiel) => number) => refs.reduce((n, r) => n + f(r), 0);
  const exigences = somme((r) => r.exigences);
  const segments = [
    { cle: 'total', libelle: 'Conforme', detail: 'niveau « Total »', v: somme((r) => r.total), teinte: 'vert' },
    { cle: 'partiel', libelle: 'Partiel', detail: 'niveau « Partiel »', v: somme((r) => r.partiel), teinte: 'ambre' },
    {
      cle: 'insuffisant',
      libelle: 'Insuffisant',
      detail: 'niveau « Insuffisant »',
      v: somme((r) => r.insuffisant),
      teinte: 'rouge',
    },
    {
      cle: 'autres',
      libelle: 'Non renseigné ou non applicable',
      detail: 'sans niveau déclaré, ou hors du périmètre d’application',
      v: somme((r) => r.nonRenseigne + Math.max(0, r.exigences - r.applicables)),
      teinte: 'gris',
    },
  ] as const;
  const T = 188,
    c = T / 2,
    rayon = 78,
    circ = 2 * Math.PI * rayon;
  let decalage = 0;
  return (
    <Cadre
      p={p}
      titre="Applicabilité et mesures"
      variante="applicabilite"
      centre={
        <div className="tdbv-graphe">
          <div className="tdbv-anneau">
            <svg
              width={T}
              height={T}
              viewBox={`0 0 ${T} ${T}`}
              role="group"
              aria-label="Exigences par niveau de mise en œuvre"
            >
              <circle cx={c} cy={c} r={rayon} strokeWidth={16} className="tdbv-piste" />
              {exigences > 0 &&
                segments.map((s) => {
                  if (!s.v) return null;
                  const l = (circ * s.v) / exigences;
                  const debut = decalage;
                  decalage += l;
                  return (
                    <LienSvg
                      key={s.cle}
                      b={b}
                      cle={s.cle}
                      nom={`${pluriel(s.v, 'exigence')} : ${s.libelle}, ouvrir l’applicabilité`}
                      vers={PAGE_APPLICABILITE}
                      className={`tdbv-s-${s.teinte}`}
                    >
                      <circle
                        cx={c}
                        cy={c}
                        r={rayon}
                        strokeWidth={16}
                        strokeDasharray={`${Math.max(0.5, l - 3).toFixed(1)} ${circ.toFixed(1)}`}
                        strokeDashoffset={(-debut).toFixed(1)}
                        transform={`rotate(-90 ${c} ${c})`}
                        className="tdbv-arc tdbv-arc--plat"
                      />
                    </LienSvg>
                  );
                })}
            </svg>
            <p className="tdbv-anneau-centre" aria-hidden="true">
              <span className="tdbv-anneau-valeur tdbv-anneau-valeur--grand chiffres">{exigences}</span>
              <span className="tdbv-anneau-libelle">exigences</span>
            </p>
          </div>
          {segments.map((s) => (
            <Bulle
              key={s.cle}
              b={b}
              cle={s.cle}
              titre={`${pluriel(s.v, 'exigence')} · ${s.libelle}`}
              detail={s.detail}
              invite="Ouvrir l’applicabilité ›"
            />
          ))}
        </div>
      }
      pied={
        <Pied
          chiffres={[
            { libelle: 'Conforme', valeur: segments[0].v, teinte: 'vert' },
            { libelle: 'Partiel', valeur: segments[1].v, teinte: 'ambre' },
            { libelle: 'Insuffisant', valeur: segments[2].v, teinte: 'rouge' },
          ]}
        />
      }
    />
  );
}

/* ---------------------------------------------------------------- Niveau de risque : grille de la méthode */

/** Rail des méthodes d'appréciation (deux grilles au moins) : un bouton par méthode, avec son nombre de risques placés ;
    simple rangée sans commande en mode modification de la disposition. */
function RailMethodes({
  grilles,
  choisie,
  choisir,
  interactif,
}: {
  grilles: readonly GrilleRisques[];
  choisie: number;
  choisir: (i: number) => void;
  interactif: boolean;
}) {
  if (grilles.length < 2) return null;
  return (
    <div className="tdbv-rail" role="group" aria-label="Méthode d’appréciation">
      {grilles.map((g, i) => {
        const contenu = (
          <>
            <span className="tdbv-rail-nom">{g.methode}</span>
            <span className="tdbv-rail-n chiffres">{g.places}</span>
          </>
        );
        const titre = `${g.methode} : ${pluriel(g.places, 'risque placé', 'risques placés')}`;
        const classe = `tdbv-rail-bouton${i === choisie ? ' actif' : ''}`;
        return interactif ? (
          <button
            key={`${g.methode}-${i}`}
            type="button"
            className={classe}
            aria-pressed={i === choisie}
            aria-label={titre}
            title={titre}
            onClick={() => choisir(i)}
          >
            {contenu}
          </button>
        ) : (
          <span key={`${g.methode}-${i}`} className={classe} title={titre}>
            {contenu}
          </span>
        );
      })}
    </div>
  );
}

export function RisquesVerre({ p, s }: { p: RenduDalle; s: Synthese }) {
  const b = useBulles(!!p.interactif);
  const [choix, setChoix] = useState(0);
  const r = s.risques!;
  const detail = s.detailRisques;
  const vue = vueRisques(detail, r.total, choix);
  const g = vue.grille;
  const niveau = (i: number | null) => (g && i !== null ? (g.niveaux[i] ?? '').toLocaleLowerCase('fr') : null);
  return (
    <Cadre
      p={p}
      titre="Niveau de risque"
      variante="risques"
      bandeau={
        <RailMethodes grilles={vue.grilles} choisie={vue.choisie} choisir={setChoix} interactif={!!p.interactif} />
      }
      centre={
        <>
          <Cle valeur={vue.valeur} etiquette={vue.etiquette} titre={g ? vue.etiquette : undefined} />
          {g ? (
            <div className="tdbv-graphe">
              <div
                className={`tdbv-grille${g.lignes.length > 4 ? ' tdbv-grille--dense' : ''}`}
                role="group"
                aria-label={`Grille ${g.axe.toLocaleLowerCase('fr')} × vraisemblance, méthode ${g.methode}, niveaux ${g.base === 'gross' ? 'bruts' : 'résiduels'}${g.horsGrille ? `, ${pluriel(g.horsGrille, 'risque apprécié', 'risques appréciés')} hors de la grille` : ''}`}
              >
                {rangeesGrille(g).map((rangee, i) => (
                  <div key={i} className="tdbv-grille-rangee">
                    {rangee.map((c) => {
                      const cle = `case-${c.colonne}-${c.ligne}`;
                      const classe = `tdbv-case tdbv-chaleur-${teinteNiveau(c.niveau, g.niveaux.length)}`;
                      const position = `${g.axe} ${g.colonnes[c.colonne]}, vraisemblance ${g.lignes[c.ligne]}`;
                      if (!c.n) return <span key={cle} className={classe} />;
                      const titre = `${pluriel(c.n, 'risque')}${niveau(c.niveau) ? ` · niveau ${niveau(c.niveau)}` : ''}`;
                      const noms = c.risques.map((x) => (x.code ? `${x.code} · ${x.nom}` : x.nom));
                      return (
                        <span key={cle} className="tdbv-case-boite">
                          <Point
                            b={b}
                            cle={cle}
                            className={classe}
                            nom={
                              c.n === 1
                                ? `Risque ${noms[0]} (${position}) : ouvrir sa fiche`
                                : `${titre} (${position}) : choisir un risque`
                            }
                            vers={
                              c.n === 1 && c.risques[0] ? lienRisque(c.risques[0].perimetre, c.risques[0].id) : null
                            }
                            choix={
                              c.n > 1
                                ? {
                                    titre: `${titre} · ${position}`,
                                    liens: c.risques.map((x, k) => ({
                                      nom: noms[k]!,
                                      vers: lienRisque(x.perimetre, x.id),
                                    })),
                                    reste: {
                                      n: c.n - c.risques.length,
                                      vers: PAGE_RISQUES,
                                      libelle: 'ouvrir le registre des risques',
                                    },
                                  }
                                : null
                            }
                          >
                            {c.n}
                          </Point>
                          <Bulle
                            b={b}
                            cle={cle}
                            titre={titre}
                            detail={position}
                            liste={[
                              ...noms,
                              ...(c.n > noms.length ? [`+ ${pluriel(c.n - noms.length, 'autre')}`] : []),
                            ]}
                            invite={c.n === 1 ? 'Ouvrir le risque ›' : 'Choisir un risque ›'}
                          />
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="tdbv-axes" aria-hidden="true">
                <span>{g.axe} →</span>
                <span>Vraisemblance ↑</span>
              </p>
            </div>
          ) : (
            <Vide>
              {detail === undefined || detail === null
                ? 'Grille des risques indisponible pour ce tableau.'
                : 'Aucun risque apprécié selon une méthode à matrice.'}
            </Vide>
          )}
        </>
      }
      pied={
        <Pied
          chiffres={[
            { libelle: 'Critiques', valeur: vue.critiques ?? '—', teinte: 'rouge' },
            { libelle: 'À apprécier', valeur: detail?.aApprecier ?? '—', teinte: 'violet' },
            { libelle: 'Revues échues', valeur: r.revueEchue, teinte: 'ambre' },
          ]}
        />
      }
    />
  );
}

/* ---------------------------------------------------------------- Incidents : courbe sur douze mois */

/** Incidents de la dalle : agrégats, et liste quand la personne lit le registre (pas pour des chiffres ouverts). */
export interface IncidentsVerre {
  total: number;
  enCours: number;
  clos: number;
  parMois: { libelle: string; valeur: number }[];
  liste?: readonly Incident[];
}

export function IncidentsVerreDalle({
  p,
  s,
  i,
  etat,
}: {
  p: RenduDalle;
  s: Synthese;
  i: IncidentsVerre | undefined;
  etat: ReactNode;
}) {
  const b = useBulles(!!p.interactif);
  const degrade = useId();
  if (!i)
    return (
      <Cadre p={p} titre="Incidents de sécurité" variante="incidents" centre={etat} pied={<Pied chiffres={[]} />} />
    );
  const mois = moisIncidents(s.genereLe, i.liste ? { liste: i.liste } : { parMois: i.parMois });
  const sur12 = mois.reduce((n, m) => n + m.n, 0);
  const cles = new Set(mois.map((m) => m.cle));
  const clos12 = i.liste
    ? i.liste.filter((x) => cles.has(x.detectedAt.slice(0, 7)) && !incidentOuvert(x)).length
    : null;
  const W = 228,
    H = 104,
    haut = 8,
    bas = 8;
  const max = Math.max(1, ...mois.map((m) => m.n));
  const pts = mois.map((m, k) => ({
    x: ((k + 0.5) * W) / mois.length,
    y: haut + (1 - m.n / max) * (H - haut - bas),
  }));
  const ligne = pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');
  const aire = `M${pts[0]!.x.toFixed(1)} ${H} ${pts.map((q) => `L${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ')} L${pts.at(-1)!.x.toFixed(1)} ${H} Z`;
  const ouverts = s.incidents?.ouverts ?? i.total - i.clos;
  return (
    <Cadre
      p={p}
      titre="Incidents de sécurité"
      variante="incidents"
      centre={
        <>
          <Cle valeur={ouverts} etiquette={ouverts > 1 ? 'ouverts' : 'ouvert'} teinte="rose" />
          <div className="tdbv-graphe">
            <div className="tdbv-courbe">
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
                <defs>
                  <linearGradient id={degrade} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" className="tdbv-degrade-haut" />
                    <stop offset="1" className="tdbv-degrade-bas" />
                  </linearGradient>
                </defs>
                {[haut, H / 2, H - bas].map((y) => (
                  <line key={y} x1="0" x2={W} y1={y} y2={y} className="tdbv-repere" />
                ))}
                <path d={aire} fill={`url(#${degrade})`} />
                <polyline points={ligne} className="tdbv-courbe-trait" />
                {mois.map((m, k) =>
                  m.n || k === mois.length - 1 ? (
                    <circle
                      key={m.cle}
                      cx={pts[k]!.x}
                      cy={pts[k]!.y}
                      r={b.actif === `mois-${m.cle}` || k === mois.length - 1 ? 4.5 : 3}
                      className={`tdbv-courbe-point${b.actif === `mois-${m.cle}` ? ' actif' : ''}${k === mois.length - 1 ? ' fin' : ''}`}
                    />
                  ) : null,
                )}
              </svg>
              <p className="tdbv-axes tdbv-axes--mois" aria-hidden="true">
                {mois.map((m, k) => (
                  <span key={m.cle}>{[0, 3, 6, 9, 11].includes(k) ? m.court : ''}</span>
                ))}
              </p>
              <div className="tdbv-colonnes tdbv-colonnes--12">
                {mois.map((m) => {
                  const cle = `mois-${m.cle}`;
                  if (!m.n) return <span key={cle} className="tdbv-colonne" />;
                  const titre = `${pluriel(m.n, 'incident')} · ${m.long}`;
                  const liste = m.incidents ?? [];
                  return (
                    <span key={cle} className="tdbv-colonne-boite">
                      <Point
                        b={b}
                        cle={cle}
                        className="tdbv-colonne"
                        nom={
                          m.incidents && m.n === 1
                            ? `Incident détecté en ${m.long} : ${liste[0]!.titre}, ouvrir sa fiche`
                            : `${titre} : choisir un incident`
                        }
                        vers={m.incidents && m.n === 1 ? lienIncident(liste[0]!.perimetre, liste[0]!.id) : null}
                        choix={
                          m.incidents && m.n > 1
                            ? {
                                titre,
                                liens: liste.map((x) => ({ nom: x.titre, vers: lienIncident(x.perimetre, x.id) })),
                              }
                            : null
                        }
                      />
                    </span>
                  );
                })}
              </div>
            </div>
            {mois.map((m) =>
              m.n ? (
                <Bulle
                  key={m.cle}
                  b={b}
                  cle={`mois-${m.cle}`}
                  titre={`${pluriel(m.n, 'incident')} · ${m.long}`}
                  liste={
                    m.incidents
                      ? [
                          ...m.incidents.slice(0, 4).map((x) => x.titre),
                          ...(m.n > 4 ? [`+ ${pluriel(m.n - 4, 'autre')}`] : []),
                        ]
                      : undefined
                  }
                  invite={m.incidents ? (m.n === 1 ? 'Ouvrir l’incident ›' : 'Choisir un incident ›') : undefined}
                />
              ) : null,
            )}
          </div>
        </>
      }
      pied={
        <Pied
          chiffres={[
            { libelle: 'Sur 12 mois', valeur: sur12, teinte: 'rose' },
            clos12 === null
              ? { libelle: 'Clos au total', valeur: i.clos, teinte: 'vert' }
              : { libelle: 'Clos', valeur: clos12, teinte: 'vert' },
          ]}
        />
      }
    />
  );
}

/* ---------------------------------------------------------------- Audits et constats : histogramme par nature */

const NATURE: Record<NatureConstat, { court: string; un: string; plusieurs: string; teinte: Teinte }> = {
  majeure: {
    court: 'Majeures',
    un: 'non-conformité majeure',
    plusieurs: 'non-conformités majeures',
    teinte: 'rouge',
  },
  mineure: {
    court: 'Mineures',
    un: 'non-conformité mineure',
    plusieurs: 'non-conformités mineures',
    teinte: 'ambre',
  },
  point_sensible: { court: 'Points sensibles', un: 'point sensible', plusieurs: 'points sensibles', teinte: 'violet' },
  observation: { court: 'Observations', un: 'observation', plusieurs: 'observations', teinte: 'bleu' },
  piste: { court: 'Pistes', un: 'piste de progrès', plusieurs: 'pistes de progrès', teinte: 'sarcelle' },
};

/** Légende du bas sur trois lignes de deux colonnes : Majeures | Points sensibles ; Mineures | Observations ; Pistes. */
const LEGENDE_CONSTATS: readonly NatureConstat[] = ['majeure', 'point_sensible', 'mineure', 'observation', 'piste'];

export function ConstatsVerre({ p, s }: { p: RenduDalle; s: Synthese }) {
  const can = useCan();
  const b = useBulles(!!p.interactif);
  const natures = constatsParNature(s.ecartsOuverts);
  const ouverts = s.ecartsOuverts?.ouverts ?? s.ecarts?.ouverts ?? 0;
  const nb = NATURES_CONSTAT.length;
  const W = 220,
    H = 112,
    marge = 6,
    ecart = 12,
    largeur = (W - 2 * marge - (nb - 1) * ecart) / nb;
  const max = Math.max(1, ...NATURES_CONSTAT.map((k) => natures?.[k] ?? 0));
  const lire = can('ecarts', 'lire');
  return (
    <Cadre
      p={p}
      titre="Audits et constats"
      variante="constats"
      centre={
        <>
          <Cle valeur={ouverts} etiquette={ouverts > 1 ? 'constats ouverts' : 'constat ouvert'} />
          {natures ? (
            <div className="tdbv-graphe">
              <div className="tdbv-histo">
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
                  {NATURES_CONSTAT.map((k, i) => {
                    const v = natures[k];
                    const h = v ? Math.max(6, (H * v) / max) : 0;
                    return v ? (
                      <rect
                        key={k}
                        x={marge + i * (largeur + ecart)}
                        y={H - h}
                        width={largeur}
                        height={h}
                        rx={6}
                        className={`tdbv-barre tdbv-s-${NATURE[k].teinte}${b.actif === `nature-${k}` ? ' actif' : ''}`}
                      />
                    ) : null;
                  })}
                  <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="tdbv-socle" />
                </svg>
                <div className="tdbv-colonnes tdbv-colonnes--5">
                  {NATURES_CONSTAT.map((k) => {
                    const v = natures[k];
                    const n = NATURE[k];
                    const titre = `${v} ${v > 1 ? n.plusieurs : n.un}`;
                    return (
                      <span key={k} className="tdbv-colonne-boite">
                        <Point
                          b={b}
                          cle={`nature-${k}`}
                          className="tdbv-colonne"
                          nom={`${titre}, parmi les constats ouverts : voir les constats de cette nature`}
                          vers={v && lire ? lienNatureConstat(k) : null}
                        />
                      </span>
                    );
                  })}
                </div>
              </div>
              {NATURES_CONSTAT.map((k) =>
                natures[k] ? (
                  <Bulle
                    key={k}
                    b={b}
                    cle={`nature-${k}`}
                    titre={`${natures[k]} ${natures[k] > 1 ? NATURE[k].plusieurs : NATURE[k].un}`}
                    detail={`${LIBELLES_NATURE_CONSTAT[k]} : constats ouverts`}
                    invite="Voir les constats de cette nature ›"
                  />
                ) : null,
              )}
            </div>
          ) : (
            <Vide>Répartition indisponible.</Vide>
          )}
        </>
      }
      pied={
        <dl className="tdbv-pied tdbv-pied--legende">
          {LEGENDE_CONSTATS.map((k) => (
            <div key={k}>
              <dt>{NATURE[k].court}</dt>
              <dd className={`chiffres tdbv-t-${NATURE[k].teinte}`}>{natures?.[k] ?? '—'}</dd>
            </div>
          ))}
        </dl>
      }
    />
  );
}

/* ---------------------------------------------------------------- Plan d'action : une case par action */

/** Classe de l'état d'une case d'action (couleur) ; le retard (case rouge) et la priorité (contour or) s'y ajoutent. */
const CLASSE_ETAT_ACTION: Record<EtatActionTdb, string> = {
  a_faire: 'afaire',
  en_cours: 'encours',
  planifiee: 'planifiee',
  terminee: 'terminee',
};

export function PlanActionVerre({ p, s }: { p: RenduDalle; s: Synthese }) {
  const b = useBulles(!!p.interactif);
  const c = casesActions(s.planActions, s.actions);
  if (!c) return null;
  return (
    <Cadre
      p={p}
      titre="Plan d’action"
      variante="actions"
      centre={
        <>
          <Cle valeur={c.total} etiquette={c.total > 1 ? 'actions' : 'action'} />
          {c.total > 0 ? (
            <div className="tdbv-graphe">
              <div className="tdbv-cases" role="group" aria-label="Actions, une case par action">
                {c.cases.map((a) => {
                  const cle = `action-${a.cle}`;
                  const classe = [
                    'tdbv-carre',
                    `tdbv-action--${CLASSE_ETAT_ACTION[a.etat]}`,
                    ...(a.retard ? ['tdbv-action--retard'] : []),
                    ...(a.prioritaire ? ['tdbv-action--prioritaire'] : []),
                  ].join(' ');
                  return (
                    <span key={cle} className="tdbv-case-boite">
                      <Point
                        b={b}
                        cle={cle}
                        className={classe}
                        nom={`Action ${a.nom ?? ''} (${detailAction(a)}) : ouvrir sa fiche`}
                        vers={a.lien}
                      />
                      {a.nom && (
                        <Bulle b={b} cle={cle} titre={a.nom} detail={detailAction(a)} invite="Ouvrir l’action ›" />
                      )}
                    </span>
                  );
                })}
                {c.reste > 0 && (
                  <span className="tdbv-case-boite tdbv-case-boite--reste">
                    <Point
                      b={b}
                      cle="actions-reste"
                      className="tdbv-carre tdbv-carre--reste"
                      nom={`${pluriel(c.reste, 'autre action', 'autres actions')} : ouvrir le plan d’action`}
                      vers={PAGE_ACTIONS}
                    >
                      {`+${c.reste}`}
                    </Point>
                    <Bulle
                      b={b}
                      cle="actions-reste"
                      titre={`+ ${pluriel(c.reste, 'autre action', 'autres actions')}`}
                      detail="Les plus urgentes sont affichées d’abord."
                      invite="Ouvrir le plan d’action ›"
                    />
                  </span>
                )}
              </div>
            </div>
          ) : (
            <Vide>Aucune action.</Vide>
          )}
        </>
      }
      pied={
        <dl className="tdbv-pied tdbv-pied--legende">
          {(
            [
              ['À faire', c.aFaire, 'tdbv-t-bleu'],
              ['En cours', c.enCours, 'tdbv-t-violet'],
              ['Planifiées', c.planifiees, 'tdbv-t-gris'],
              ['Terminées', c.terminees, 'tdbv-t-vert'],
              ['En retard', c.enRetard, 'tdbv-t-retard'],
              ['Prioritaires', c.prioritaires, 'tdbv-t-or'],
            ] as const
          ).map(([libelle, valeur, classe]) => (
            <div key={libelle}>
              <dt>{libelle}</dt>
              <dd className={`chiffres ${classe}`}>{valeur ?? '—'}</dd>
            </div>
          ))}
        </dl>
      }
    />
  );
}

/* ---------------------------------------------------------------- Indicateurs et maturité : triangle */

export function MaturiteVerre({ p, s, refs }: { p: RenduDalle; s: Synthese; refs: readonly Referentiel[] }) {
  const can = useCan();
  const b = useBulles(!!p.interactif);
  const ind = s.indicateurs!;
  const axes = refs.filter((r) => r.applicables > 0);
  const W = 230,
    H = 152,
    cx = 115,
    cy = 90,
    R = 64;
  const point = (k: number, r: number) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / axes.length;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const poly = (f: (k: number) => number) =>
    axes
      .map((_, k) => point(k, f(k)))
      .map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`)
      .join(' ');
  const taux = axes.map((r) => (r.total * 100) / r.applicables);
  const lire = can('audit', 'lire');
  return (
    <Cadre
      p={p}
      titre="Indicateurs et maturité"
      variante="maturite"
      centre={
        <>
          <Cle valeur={ind.atteints} etiquette={`/ ${ind.total} atteints`} />
          {axes.length >= 3 && (
            <div className="tdbv-graphe">
              <div className="tdbv-radar">
                <svg
                  width={W}
                  height={H}
                  viewBox={`0 0 ${W} ${H}`}
                  role="group"
                  aria-label="Maturité : part des exigences au niveau Total, par référentiel"
                >
                  <g className="tdbv-radar-trame">
                    <polygon points={poly(() => R)} />
                    <polygon points={poly(() => R / 2)} />
                    {axes.map((r, k) => {
                      const q = point(k, R);
                      return <line key={r.ref} x1={cx} y1={cy} x2={q.x} y2={q.y} />;
                    })}
                  </g>
                  <polygon points={poly((k) => (R * taux[k]!) / 100)} className="tdbv-radar-valeur" />
                  {axes.map((r, k) => {
                    const v = point(k, (R * taux[k]!) / 100);
                    return <circle key={r.ref} cx={v.x} cy={v.y} r={3.5} className="tdbv-radar-point" />;
                  })}
                  {axes.map((r, k) => {
                    const q = point(k, R);
                    const e = point(k, R + 15);
                    const nom = libelleReferentiel(r.ref, r.libelle);
                    const bas = e.y > cy + 4;
                    return (
                      <LienSvg
                        key={r.ref}
                        b={b}
                        cle={`sommet-${r.ref}`}
                        nom={`${nom} : ${pourcent(taux[k]!)} au niveau Total, ouvrir sa déclaration d’applicabilité`}
                        vers={lire ? lienReferentiel(r.ref) : null}
                        className="tdbv-sommet"
                      >
                        <circle cx={q.x} cy={q.y} r={12} className="tdbv-sommet-zone" />
                        <circle cx={q.x} cy={q.y} r={4} className="tdbv-sommet-point" />
                        <text
                          x={Math.min(W - 4, Math.max(4, e.x))}
                          y={bas ? e.y + 8 : e.y}
                          textAnchor={e.x > cx + 30 ? 'end' : e.x < cx - 30 ? 'start' : 'middle'}
                          className="tdbv-radar-libelle"
                        >
                          {nom}
                        </text>
                      </LienSvg>
                    );
                  })}
                </svg>
              </div>
              {axes.map((r, k) => (
                <Bulle
                  key={r.ref}
                  b={b}
                  cle={`sommet-${r.ref}`}
                  titre={`${libelleReferentiel(r.ref, r.libelle)} : ${pourcent(taux[k]!)}`}
                  detail="Exigences applicables au niveau « Total », sans score certifiant"
                  invite="Ouvrir la déclaration d’applicabilité ›"
                />
              ))}
            </div>
          )}
        </>
      }
      pied={
        <Pied
          chiffres={[
            { libelle: 'Non atteints', valeur: ind.nonAtteints, teinte: 'ambre' },
            { libelle: 'Non mesurés', valeur: ind.nonMesures, teinte: 'gris' },
          ]}
        />
      }
    />
  );
}

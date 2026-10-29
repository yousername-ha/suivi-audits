/* Chronologie animée du RETEX d'un incident, à la manière d'un écran de cotation : courbe de gravité lissée et
   lumineuse tracée point par point sur une scène en profondeur (grille, halo, courbes fantômes floutées). Le point
   actif ouvre une bulle d'information : un trait monte du point, puis le titre, son soulignement, les repères et la
   description apparaissent successivement. Navigation au clic (points ou frise), au clavier (flèches, Début, Fin,
   Espace) ou en lecture automatique. SVG, foreignObject et classes CSS uniquement (CSP : aucun style en ligne) ;
   animations neutralisées si l'utilisateur préfère réduire les mouvements. */
import { Text, VisuallyHidden } from '@mantine/core';
import {
  GRAVITES_RETEX,
  dateHeureRetex,
  dureeRetex,
  type IndicateursRetex,
  type PointChronologie,
} from '@suivi/shared';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

/** Teinte de la charte associée à chaque type d'événement (classes « graph-<teinte> » et « retex-c-<teinte> »). */
export const TEINTE_TYPE_RETEX: Record<string, string> = {
  Détection: 'rouge',
  Qualification: 'orange',
  'Alerte et escalade': 'orange',
  Analyse: 'violet',
  Confinement: 'bleu',
  Décision: 'violet',
  Communication: 'gris',
  Éradication: 'bleu',
  Rétablissement: 'vert',
  Clôture: 'vert',
  Autre: 'gris',
};
/** Teinte de la gravité maximale dans le bandeau. */
const TEINTE_GRAVITE: Record<string, string> = {
  Critique: 'rouge',
  Élevée: 'orange',
  Modérée: 'violet',
  Faible: 'vert',
  Aucune: 'gris',
};
const couleur = (type: string) => `retex-c-${TEINTE_TYPE_RETEX[type] ?? 'gris'}`;

/* Géométrie de la scène (unités du viewBox) : bande des bulles en haut, courbe en dessous. */
const L = 1200,
  H = 624,
  G = 112,
  D = 56,
  RETRAIT = 44,
  BULLE_HAUT = 22,
  BULLE_L = 440,
  BULLE_H = 236,
  HAUT = 288,
  BAS = 560;
const DELAI_LECTURE = 4500;

type XY = readonly [number, number];
const abscisse = (rang: number, n: number) =>
  n <= 1 ? (G + L - D) / 2 : G + RETRAIT + (rang * (L - G - D - 2 * RETRAIT)) / (n - 1);
const ordonnee = (niveau: number) => HAUT + ((4 - niveau) * (BAS - HAUT)) / 4;
const heureCourte = (ts: string) => `${ts.slice(8, 10)}/${ts.slice(5, 7)} ${ts.slice(11, 16)}`;
const borne = (y: number) => Math.max(HAUT - 6, Math.min(BAS, y));

/** Tronçon lissé (Catmull-Rom → Bézier) entre les points k et k+1, contrôles bornés à la zone de la courbe. */
function troncon(p: readonly XY[], k: number, debut = true): string {
  const a = p[k - 1] ?? p[k]!,
    b = p[k]!,
    c = p[k + 1]!,
    d = p[k + 2] ?? c;
  const c1: XY = [b[0] + (c[0] - a[0]) / 6, borne(b[1] + (c[1] - a[1]) / 6)];
  const c2: XY = [c[0] - (d[0] - b[0]) / 6, borne(c[1] - (d[1] - b[1]) / 6)];
  return `${debut ? `M ${b[0]} ${b[1]} ` : ''}C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${c[0]} ${c[1]}`;
}
/** Courbe lissée complète jusqu'au point `fin` inclus. */
function courbe(p: readonly XY[], fin = p.length - 1): string {
  if (!p.length) return '';
  let d = `M ${p[0]![0]} ${p[0]![1]}`;
  for (let k = 0; k < fin; k++) d += ` ${troncon(p, k, false)}`;
  return d;
}
/** Tendance de gravité par rapport à l'événement précédent. */
const tendance = (p: PointChronologie, avant: PointChronologie | undefined) =>
  !avant || p.niveau === avant.niveau ? 'stable' : p.niveau > avant.niveau ? 'hausse' : 'baisse';

/** Icône « première / dernière étape » : barre et double triangle, dessinés pour rester alignés quelle que soit la police. */
function IconeExtremite({ sens }: { sens: 'debut' | 'fin' }) {
  return (
    <svg viewBox="0 0 16 16" className="retex-bouton__icone" aria-hidden="true" focusable="false">
      <g transform={sens === 'fin' ? 'matrix(-1 0 0 1 16 0)' : undefined}>
        <rect x="2" y="3" width="2" height="10" rx="0.6" />
        <path d="M9 3.6 L4.8 8 L9 12.4 Z" />
        <path d="M14 3.6 L9.8 8 L14 12.4 Z" />
      </g>
    </svg>
  );
}

export function ChronologieRetex({
  titre,
  points,
  indicateurs,
}: {
  titre: string;
  points: PointChronologie[];
  indicateurs: IndicateursRetex;
}) {
  const [actif, setActif] = useState(0);
  const [sens, setSens] = useState<'avant' | 'arriere'>('avant');
  const [lecture, setLecture] = useState(false);
  const scene = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, '');
  const n = points.length;
  const courant = points[Math.min(actif, n - 1)];

  const aller = (k: number) => {
    const cible = Math.max(0, Math.min(n - 1, k));
    if (cible === actif) return;
    setSens(cible > actif ? 'avant' : 'arriere');
    setActif(cible);
  };

  // Lecture automatique : un point toutes les DELAI_LECTURE ms, arrêt sur le dernier.
  useEffect(() => {
    if (!lecture) return;
    if (actif >= n - 1) {
      setLecture(false);
      return;
    }
    const t = window.setTimeout(() => {
      setSens('avant');
      setActif((a) => Math.min(n - 1, a + 1));
    }, DELAI_LECTURE);
    return () => window.clearTimeout(t);
  }, [lecture, actif, n]);

  // Le nombre de points peut diminuer (suppression) : rester dans les bornes.
  useEffect(() => {
    if (actif > n - 1) setActif(Math.max(0, n - 1));
  }, [actif, n]);

  if (!courant) return <Text c="dimmed">Aucun événement : ajoutez-en au moins un pour générer la chronologie.</Text>;

  const clavier = (e: KeyboardEvent) => {
    const actions: Record<string, () => void> = {
      ArrowRight: () => aller(actif + 1),
      ArrowDown: () => aller(actif + 1),
      ArrowLeft: () => aller(actif - 1),
      ArrowUp: () => aller(actif - 1),
      Home: () => aller(0),
      End: () => aller(n - 1),
      ' ': () => setLecture((l) => !l),
    };
    const a = actions[e.key];
    if (a) {
      e.preventDefault();
      a();
    }
  };
  const choisir = (k: number) => {
    setLecture(false);
    aller(k);
  };

  const xy: XY[] = points.map((p) => [abscisse(p.rang, n), ordonnee(p.niveau)]);
  const r = courant.rang;
  const [xa, ya] = xy[r]!;
  const complete = courbe(xy);
  const parcourue = courbe(xy, r);
  const aire = `${parcourue} L ${xa} ${BAS} L ${xy[0]![0]} ${BAS} Z`;
  // Courbes fantômes (décor) : la courbe décalée et aplatie, floutée en arrière-plan.
  const fantome = (dx: number, dy: number, f: number) =>
    courbe(xy.map(([x, y]) => [x + dx, BAS - (BAS - y) * f + dy] as XY));
  const droite = xa < L * 0.6;
  const bulleX = droite ? xa + 20 : xa - 20 - BULLE_L;
  const tend = tendance(courant, points[r - 1]);
  const colonnes = Array.from({ length: 21 }, (_, k) => G + (k * (L - G - D)) / 20);

  const duree = (m: number | null) => (m == null ? '–' : dureeRetex(m));
  const chiffres: [string, string | number, string][] = [
    ['Événements', indicateurs.evenements, ''],
    ['Durée totale', duree(indicateurs.dureeTotale), ''],
    ['Confinement après', duree(indicateurs.avantConfinement), ''],
    ['Rétablissement après', duree(indicateurs.avantRetablissement), ''],
    ['Gravité maximale', indicateurs.graviteMax || '–', TEINTE_GRAVITE[indicateurs.graviteMax] ?? ''],
  ];

  return (
    <div className="retex-chronologie">
      <header className="retex-bandeau">
        <div className="retex-bandeau__titre">
          <span className="retex-bandeau__sur">
            <span className="retex-bandeau__voyant" aria-hidden="true" />
            Retour d’expérience
          </span>
          <span className="retex-bandeau__nom">{titre}</span>
        </div>
        <dl className="retex-bandeau__chiffres">
          {chiffres.map(([libelle, valeur, teinte]) => (
            <div
              key={libelle}
              className={teinte ? `retex-c-${teinte}` : undefined}
              data-teinte={teinte ? 'oui' : 'non'}
            >
              <dt>{libelle}</dt>
              <dd>{valeur}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div
        ref={scene}
        className="retex-scene"
        tabIndex={0}
        role="group"
        aria-roledescription="chronologie"
        aria-label={`Chronologie de ${n} événements. Flèches gauche et droite pour naviguer, Espace pour la lecture.`}
        onKeyDown={clavier}
      >
        <svg viewBox={`0 0 ${L} ${H}`} className="retex-svg">
          <defs>
            <linearGradient id={`aire-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="retex-degrade-haut" />
              <stop offset="1" className="retex-degrade-bas" />
            </linearGradient>
            <radialGradient id={`halo-${id}`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" className="retex-halo-centre" />
              <stop offset="1" className="retex-halo-bord" />
            </radialGradient>
            <filter id={`lueur-${id}`} x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="5" result="flou" />
              <feMerge>
                <feMergeNode in="flou" />
                <feMergeNode in="flou" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={`profondeur-${id}`} x="-10%" y="-30%" width="120%" height="160%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>

          {/* Arrière-plan : halo derrière le point actif, grille fine et grille des paliers. */}
          <ellipse
            key={`halo-${r}`}
            cx={xa}
            cy={ya}
            rx={260}
            ry={200}
            fill={`url(#halo-${id})`}
            className="retex-halo"
          />
          {colonnes.map((x) => (
            <line key={x} x1={x} x2={x} y1={HAUT - 40} y2={BAS} className="retex-grille retex-grille--fine" />
          ))}
          {GRAVITES_RETEX.map((g, k) => (
            <g key={g}>
              {k < 4 && (
                <line
                  x1={G}
                  x2={L - D}
                  y1={(ordonnee(k) + ordonnee(k + 1)) / 2}
                  y2={(ordonnee(k) + ordonnee(k + 1)) / 2}
                  className="retex-grille retex-grille--fine"
                />
              )}
              <line x1={G} x2={L - D} y1={ordonnee(k)} y2={ordonnee(k)} className="retex-grille" />
              <text x={G - 16} y={ordonnee(k) + 5} textAnchor="end" className="retex-axe">
                {g}
              </text>
            </g>
          ))}

          {/* Profondeur : courbes fantômes floutées derrière la courbe principale. */}
          <g className="retex-fantomes" aria-hidden="true" filter={`url(#profondeur-${id})`}>
            <path d={fantome(-36, 26, 0.7)} className="retex-fantome retex-c-violet" />
            <path d={fantome(28, 44, 0.45)} className="retex-fantome retex-c-vert" />
            <path d={fantome(-12, 10, 0.9)} className="retex-fantome retex-c-rouge" />
          </g>

          {/* Courbe complète en filigrane, zone parcourue, puis tronçons parcourus et tronçon en cours de tracé. */}
          <path d={complete} className="retex-avenir" />
          <path key={`aire-${r}`} d={aire} className="retex-aire" fill={`url(#aire-${id})`} />
          <g filter={`url(#lueur-${id})`}>
            {xy
              .slice(1)
              .map((_, k) =>
                k + 1 > r ? null : (
                  <path
                    key={k + 1 === r ? `seg-${k}-${r}-${sens}` : `seg-${k}`}
                    d={troncon(xy, k)}
                    pathLength={1}
                    className="retex-segment"
                    data-etat={k + 1 === r ? 'trace' : 'parcouru'}
                    data-sens={sens}
                  />
                ),
              )}
          </g>

          {/* Repères du point actif : ligne de niveau vers l'axe et étiquette d'heure. */}
          <g key={`repere-${r}`} className="retex-repere">
            <line x1={G} x2={xa} y1={ya} y2={ya} className="retex-repere__ligne" />
            <line x1={xa} x2={xa} y1={ya} y2={BAS} className="retex-repere__ligne" />
            <rect x={xa - 56} y={BAS + 18} width={112} height={28} rx={14} className="retex-repere__fond" />
            <text x={xa} y={BAS + 37} textAnchor="middle" className="retex-repere__texte">
              {heureCourte(courant.ts)}
            </text>
          </g>

          {/* Points cliquables. */}
          {points.map((p, k) => {
            const [x, y] = xy[k]!;
            const etat = k < r ? 'passe' : k === r ? 'actif' : 'avenir';
            return (
              <g
                key={p.id}
                className={`retex-point ${couleur(p.type)}`}
                data-etat={etat}
                role="button"
                tabIndex={-1}
                aria-label={`${dateHeureRetex(p.ts)}, ${p.type} : ${p.titre}`}
                aria-current={etat === 'actif' ? 'step' : undefined}
                onClick={() => {
                  choisir(k);
                  scene.current?.focus();
                }}
              >
                <circle cx={x} cy={y} r={24} className="retex-point__cible" />
                <circle cx={x} cy={y} r={etat === 'actif' ? 7 : 5.5} className="retex-point__disque" />
              </g>
            );
          })}

          {/* Bulle du point actif : anneau, trait montant, puis texte (foreignObject, classes uniquement). */}
          <g key={`bulle-${courant.id}`} className={`retex-bulle ${couleur(courant.type)}`} data-sens={sens}>
            <circle cx={xa} cy={ya} r={15} className="retex-bulle__anneau" />
            <circle cx={xa} cy={ya} r={15} className="retex-bulle__onde" />
            <path d={`M ${xa} ${ya - 15} L ${xa} ${BULLE_HAUT + 6}`} pathLength={1} className="retex-bulle__trait" />
            <circle cx={xa} cy={BULLE_HAUT + 6} r={3.5} className="retex-bulle__tete" />
            {tend !== 'stable' && (
              <text
                x={droite ? xa - 22 : xa + 22}
                y={ya + (tend === 'hausse' ? -22 : 34)}
                textAnchor={droite ? 'end' : 'start'}
                className="retex-tendance"
                data-tendance={tend}
              >
                {tend === 'hausse' ? '▲' : '▼'} {GRAVITES_RETEX[courant.niveau]}
              </text>
            )}
            <foreignObject x={bulleX} y={BULLE_HAUT} width={BULLE_L} height={BULLE_H}>
              <div className="retex-bulle__contenu" data-cote={droite ? 'droite' : 'gauche'}>
                <div className="retex-bulle__sur">
                  <span className="retex-bulle__type">{courant.type}</span>
                  <span>
                    Étape {r + 1} / {n}
                  </span>
                </div>
                <div className="retex-bulle__titre">{courant.titre}</div>
                <div className="retex-bulle__souligne" />
                <div className="retex-bulle__tirets" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="retex-bulle__quand">
                  <span>{dateHeureRetex(courant.ts)}</span>
                  <span>T+{dureeRetex(courant.depuisDebut)}</span>
                  {courant.depuisPrecedent != null && <span>+{dureeRetex(courant.depuisPrecedent)}</span>}
                </div>
                {courant.description && <div className="retex-bulle__texte">{courant.description}</div>}
                <div className="retex-bulle__pied">
                  {courant.acteur && <span>{courant.acteur}</span>}
                  <span>
                    Gravité {GRAVITES_RETEX[courant.niveau]?.toLowerCase()}
                    {courant.niveauReporte ? ' (reportée)' : ''}
                  </span>
                </div>
              </div>
            </foreignObject>
          </g>
        </svg>
        <VisuallyHidden aria-live="polite">
          {`Étape ${r + 1} sur ${n}, ${dateHeureRetex(courant.ts)}, ${courant.type} : ${courant.titre}. ${courant.description}`}
        </VisuallyHidden>
      </div>

      {/* Frise : un repère par événement, cliquable. */}
      <ol className="retex-frise" aria-label="Étapes de la chronologie">
        {points.map((p, k) => (
          <li key={p.id} data-etat={k < r ? 'passe' : k === r ? 'actif' : 'avenir'} className={couleur(p.type)}>
            <button type="button" onClick={() => choisir(k)} aria-current={k === r ? 'step' : undefined}>
              <span className="retex-frise__pastille" aria-hidden="true" />
              <span className="retex-frise__heure">{heureCourte(p.ts)}</span>
              <span className="retex-frise__type">{p.type}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="retex-commandes">
        <span className="retex-commandes__aide">← → naviguer · Espace lecture</span>
        <div className="retex-commandes__boutons">
          <button
            type="button"
            className="retex-bouton retex-bouton--icone"
            onClick={() => aller(0)}
            disabled={r === 0}
            aria-label="Première étape"
          >
            <IconeExtremite sens="debut" />
          </button>
          <button type="button" className="retex-bouton" onClick={() => aller(actif - 1)} disabled={r === 0}>
            ‹ Précédent
          </button>
          <button
            type="button"
            className="retex-bouton retex-bouton--principal"
            data-lecture={lecture ? 'oui' : 'non'}
            onClick={() => {
              if (!lecture && actif >= n - 1) {
                setSens('arriere');
                setActif(0);
              }
              setLecture((l) => !l);
            }}
            disabled={n < 2}
          >
            {lecture ? '❚❚ Pause' : '▶ Lecture'}
          </button>
          <button type="button" className="retex-bouton" onClick={() => aller(actif + 1)} disabled={r >= n - 1}>
            Suivant ›
          </button>
          <button
            type="button"
            className="retex-bouton retex-bouton--icone"
            onClick={() => aller(n - 1)}
            disabled={r >= n - 1}
            aria-label="Dernière étape"
          >
            <IconeExtremite sens="fin" />
          </button>
        </div>
        <span className="retex-commandes__compteur" aria-hidden="true">
          <b>{String(r + 1).padStart(2, '0')}</b> / {String(n).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}

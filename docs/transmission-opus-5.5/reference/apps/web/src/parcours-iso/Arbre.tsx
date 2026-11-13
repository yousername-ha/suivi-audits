/* Arbre du parcours ISO / HDS (composition de la maquette v011) : branches colorées, un cercle par raccourci, bouton « + / − »
   distinct du cercle pour déplier les sous-actions (une seule branche à la fois), fond décoratif non interactif. Tout est
   dessiné dans un repère fixe (SVG) : aucun style en ligne, les couleurs et les animations viennent de la feuille de style.
   Les cercles et libellés sont des boutons atteignables au clavier ; les sous-actions repliées ne sont pas dans le DOM. */
import { useReducedMotion } from '@mantine/hooks';
import { useMemo } from 'react';
import {
  BRANCHE_LABELS,
  BRANCHES_PARCOURS,
  RACCOURCIS_PARCOURS,
  etapeParcours,
  etapesAffichees,
  etapesSansRaccourci,
  sousActionsDuRaccourci,
  type RaccourciParcours,
} from '@suivi/shared';
import gondorUrl from '../assets/parcours-gondor.webp';
import { iconeParcours } from './icones';
import {
  COURBES,
  FEUILLES,
  HAUTEUR,
  LARGEUR,
  POINTS,
  RACINE,
  RAYON_ENFANT,
  RAYON_NOEUD,
  TITRES_BRANCHES,
  placerEnfants,
  rectDeEnfant,
  zoneNoeud,
} from './geometrie';
import type { Mouvement } from './mouvement';
import { LIBELLE_PRESENCE, presence, type TravauxDuType } from './travaux';

const rectAttributs = (r: { x: number; y: number; l: number; h: number }) => ({
  x: r.x,
  y: r.y,
  width: r.l,
  height: r.h,
});
const FEUILLE = 'M0 0 C-12-6 -17-15 -12-23 C2-20 7-10 0 0Z';
const SYMBOLE: Record<ReturnType<typeof presence>, string> = {
  presents: '●',
  aucun: '○',
  chargement: '…',
  indisponible: '✕',
  'non-compte': '–',
};

function Pictogramme({ id, x, y, taille = 1 }: { id: string; x: number; y: number; taille?: number }) {
  return (
    <path
      className="parcours-pictogramme"
      d={iconeParcours(id)}
      transform={`translate(${x - 12 * taille} ${y - 12 * taille}) scale(${taille})`}
    />
  );
}

export function Arbre({
  hds,
  mouvement,
  visible,
  selection,
  carteVisible,
  depliee,
  halo,
  travaux,
  onSelectionner,
  onFermerCarte,
  onBascule,
  onOuvrirSousAction,
  onOuvrirEtape,
  onToutes,
  carte,
}: {
  hds: boolean;
  mouvement: Mouvement;
  visible: boolean;
  selection: string | null;
  carteVisible: boolean;
  depliee: string | null;
  halo: string | null;
  travaux: Record<string, TravauxDuType>;
  onSelectionner: (id: string) => void;
  onFermerCarte: () => void;
  onBascule: (id: string) => void;
  onOuvrirSousAction: (raccourci: RaccourciParcours, sousActionId: string) => void;
  onOuvrirEtape: (id: string) => void;
  onToutes: () => void;
  carte: React.ReactNode;
}) {
  // « Animées » force les effets ; « Automatiques » suit le réglage de mouvement réduit du système ; « Arrêtées » les coupe.
  const reduit = useReducedMotion();
  const anime = mouvement === 'animees' || (mouvement === 'automatique' && !reduit);
  const raccourcis = RACCOURCIS_PARCOURS.filter((r) => hds || POINTS[r.id]!.branche !== 'hds');
  const enfants = useMemo(() => (depliee ? placerEnfants(depliee, hds) : []), [depliee, hds]);
  const parent = depliee ? RACCOURCIS_PARCOURS.find((r) => r.id === depliee) : undefined;
  const autres = etapesSansRaccourci(hds);
  const activer = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };
  return (
    <div
      className="parcours-arbre"
      data-mouvement={mouvement}
      data-anime={anime ? 'oui' : 'non'}
      data-visible={visible}
      data-deplie={depliee ? 'oui' : 'non'}
    >
      <div
        className="parcours-arbre__defilement"
        tabIndex={0}
        role="region"
        aria-label="Arbre du parcours, défilement possible"
      >
        <div className="parcours-arbre__toile">
          <img className="parcours-arbre__gondor" src={gondorUrl} alt="" aria-hidden="true" draggable={false} />
          <svg
            className="parcours-arbre__dessin"
            viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
            role="group"
            aria-label="Étapes du parcours"
          >
            <defs>
              <filter id="parcours-lueur">
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>
            <rect className="parcours-fond" width={LARGEUR} height={HAUTEUR} onClick={onFermerCarte} />
            {COURBES.filter((c) => hds || !c.hds).map((c) => (
              <g key={c.id} data-branche={c.branche} aria-hidden="true">
                <path className="parcours-aura" d={c.d} filter="url(#parcours-lueur)" />
                <path className="parcours-branche" d={c.d} />
                <path className="parcours-flux" d={c.d} pathLength={100} />
              </g>
            ))}
            {FEUILLES.filter((f) => hds || f.branche !== 'hds').map((f) => (
              <path
                key={`${f.x}-${f.y}`}
                className="parcours-feuille"
                data-branche={f.branche}
                d={FEUILLE}
                transform={`translate(${f.x} ${f.y}) rotate(${f.rot}) scale(${f.echelle})`}
                aria-hidden="true"
              />
            ))}
            {BRANCHES_PARCOURS.filter((b) => hds || b !== 'hds').map((b) => {
              const t = TITRES_BRANCHES[b];
              return (
                <text
                  key={b}
                  className="parcours-titre-branche"
                  data-branche={b}
                  x={t.x}
                  y={t.y}
                  textAnchor="middle"
                  aria-hidden="true"
                >
                  <tspan className="parcours-titre-branche__nom" x={t.x}>
                    {t.nom}
                  </tspan>
                  {t.lignes.map((l, i) => (
                    <tspan key={l} className="parcours-titre-branche__ligne" x={t.x} dy={i === 0 ? '1.5em' : '1.25em'}>
                      {l}
                    </tspan>
                  ))}
                </text>
              );
            })}
            <g
              className="parcours-racine"
              role="button"
              tabIndex={0}
              aria-label="Démarrer le parcours : afficher toutes les étapes"
              onClick={onToutes}
              onKeyDown={activer(onToutes)}
            >
              <circle className="parcours-racine__cercle" cx={RACINE.x} cy={RACINE.y} r={RACINE.rayon} />
              <Pictogramme id="shield" x={RACINE.x} y={RACINE.y} taille={1.5} />
              <text className="parcours-libelle" x={RACINE.x} y={RACINE.y + RACINE.rayon + 18} textAnchor="middle">
                {RACINE.lignes[0]}
              </text>
              <text className="parcours-libelle" x={RACINE.x} y={RACINE.y + RACINE.rayon + 34} textAnchor="middle">
                {RACINE.lignes[1]}
              </text>
              <circle className="parcours-anneau" cx={RACINE.x} cy={RACINE.y} r={RACINE.rayon + 5} />
            </g>
            {raccourcis.map((r) => {
              const p = POINTS[r.id]!;
              const pres = presence(
                travaux,
                sousActionsDuRaccourci(r).flatMap((s) => s.kinds),
              );
              const etape = etapeParcours(r.etape)!;
              const ouvert = depliee === r.id;
              const choisi = selection === r.id && carteVisible;
              const nom = p.lignes.join(' ');
              return (
                <g
                  key={r.id}
                  className="parcours-noeud"
                  data-branche={p.branche}
                  data-raccourci={r.id}
                  data-choisi={choisi || undefined}
                  data-estompe={depliee && !ouvert ? 'oui' : undefined}
                >
                  <g
                    role="button"
                    tabIndex={0}
                    className="parcours-noeud__bouton"
                    aria-label={`${nom} (${etape.titre}) — ${LIBELLE_PRESENCE[pres]}`}
                    aria-pressed={choisi}
                    onClick={() => onSelectionner(r.id)}
                    onKeyDown={activer(() => onSelectionner(r.id))}
                  >
                    <rect className="parcours-zone" {...rectAttributs(zoneNoeud(r.id))} />
                    <circle className="parcours-anneau" cx={p.x} cy={p.y} r={RAYON_NOEUD + 5} />
                    <circle className="parcours-orbe" cx={p.x} cy={p.y} r={RAYON_NOEUD} />
                    <Pictogramme id={r.icone} x={p.x} y={p.y} />
                    {halo === r.id && <circle key={halo} className="parcours-halo" cx={p.x} cy={p.y} r={RAYON_NOEUD} />}
                    <text
                      className="parcours-presence"
                      data-presence={pres}
                      x={p.x + RAYON_NOEUD - 4}
                      y={p.y - RAYON_NOEUD + 6}
                      textAnchor="middle"
                      aria-hidden="true"
                    >
                      {SYMBOLE[pres]}
                    </text>
                    <text
                      className="parcours-libelle"
                      x={p.x + RAYON_NOEUD + 8}
                      y={p.lignes.length > 1 ? p.y - 3 : p.y + 5}
                    >
                      {p.lignes.map((l, i) => (
                        <tspan key={l} x={p.x + RAYON_NOEUD + 8} dy={i === 0 ? 0 : '1.2em'}>
                          {l}
                        </tspan>
                      ))}
                    </text>
                  </g>
                  <g
                    className="parcours-bascule"
                    role="button"
                    tabIndex={0}
                    aria-expanded={ouvert}
                    aria-controls={ouvert ? `parcours-enfants-${r.id}` : undefined}
                    aria-label={`${ouvert ? 'Replier' : 'Déplier'} les sous-actions : ${nom}`}
                    onClick={() => onBascule(r.id)}
                    onKeyDown={activer(() => onBascule(r.id))}
                  >
                    <circle className="parcours-bascule__zone" cx={p.x + 22} cy={p.y + 24} r={20} />
                    <circle className="parcours-bascule__disque" cx={p.x + 22} cy={p.y + 24} r={9} />
                    <path
                      className="parcours-bascule__trait"
                      d={
                        ouvert
                          ? `M${p.x + 17} ${p.y + 24}H${p.x + 27}`
                          : `M${p.x + 17} ${p.y + 24}H${p.x + 27}M${p.x + 22} ${p.y + 19}V${p.y + 29}`
                      }
                    />
                  </g>
                </g>
              );
            })}
            {parent && enfants.length > 0 && (
              <g
                id={`parcours-enfants-${parent.id}`}
                className="parcours-enfants"
                data-branche={POINTS[parent.id]!.branche}
                role="group"
                aria-label={`Sous-actions : ${POINTS[parent.id]!.lignes.join(' ')}`}
              >
                {enfants.map((e, i) => (
                  <g key={e.id} className="parcours-enfant">
                    <path className="parcours-enfant__lien" d={e.d} pathLength={1} aria-hidden="true" />
                    <g className="parcours-enfant__apparition" data-rang={i}>
                      <g
                        role="button"
                        tabIndex={0}
                        className="parcours-enfant__bouton"
                        data-sous-action={e.id}
                        aria-label={`${e.titre} : voir l’attendu`}
                        onClick={() => onOuvrirSousAction(parent, e.id)}
                        onKeyDown={activer(() => onOuvrirSousAction(parent, e.id))}
                      >
                        <rect className="parcours-zone" {...rectAttributs(rectDeEnfant(e))} />
                        <circle className="parcours-orbe parcours-orbe--enfant" cx={e.x} cy={e.y} r={RAYON_ENFANT} />
                        <Pictogramme id={etapeParcours(parent.etape)!.icone} x={e.x} y={e.y} taille={0.75} />
                        <text
                          className="parcours-libelle parcours-libelle--enfant"
                          x={e.cote === 'droite' ? e.x + RAYON_ENFANT + 8 : e.x - RAYON_ENFANT - 8}
                          y={e.lignes.length > 1 ? e.y - 3 : e.y + 4}
                          textAnchor={e.cote === 'droite' ? 'start' : 'end'}
                        >
                          {e.lignes.map((l, j) => (
                            <tspan
                              key={l}
                              x={e.cote === 'droite' ? e.x + RAYON_ENFANT + 8 : e.x - RAYON_ENFANT - 8}
                              dy={j === 0 ? 0 : '1.2em'}
                            >
                              {l}
                            </tspan>
                          ))}
                        </text>
                      </g>
                    </g>
                  </g>
                ))}
              </g>
            )}
          </svg>
          {carte}
        </div>
      </div>
      <div className="parcours-arbre__pied">
        <ul className="parcours-legende" aria-label="Légende de la présence de travaux">
          {(['presents', 'aucun', 'non-compte', 'indisponible'] as const).map((k) => (
            <li key={k}>
              <span className="parcours-presence-legende" data-presence={k} aria-hidden="true">
                {SYMBOLE[k]}
              </span>{' '}
              {LIBELLE_PRESENCE[k]}
            </li>
          ))}
        </ul>
        {autres.length > 0 && (
          <nav className="parcours-autres" aria-label="Autres étapes du parcours">
            <span>Autres étapes :</span>
            {autres.map((e) => (
              <button
                key={e.id}
                type="button"
                className="parcours-puce"
                data-branche={e.branche}
                onClick={() => onOuvrirEtape(e.id)}
              >
                {e.titre}
              </button>
            ))}
          </nav>
        )}
        <button type="button" className="parcours-toutes" onClick={onToutes}>
          Toutes les étapes · {etapesAffichees(hds).length} →
        </button>
      </div>
      <span className="parcours-sr-only" role="note">
        {BRANCHES_PARCOURS.filter((b) => hds || b !== 'hds')
          .map((b) => `${BRANCHE_LABELS[b].nom} : ${BRANCHE_LABELS[b].sousTitre}`)
          .join(' ; ')}
      </span>
    </div>
  );
}

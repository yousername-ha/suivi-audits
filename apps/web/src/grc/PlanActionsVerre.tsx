/* Plan d'actions en Timeline, style « Verre » (dessin PlanTimeline validé par le RSSI le 27/11/2026 : « pas de carré,
   logique, épuré, propre ») : une ligne par action, triée par échéance ; à gauche le point d'état (couleur de la politique
   métier), l'intitulé, l'origine et le responsable ; à droite une barre fine du début à l'échéance (partie écoulée pleine,
   reste en filet, anneau au début, rond à l'échéance, ↑ pour une priorité haute ou urgente). Retard : rond plein rose et
   pointillé jusqu'au trait violet d'aujourd'hui. Sans échéance : pas de barre, en fin de liste. Actions terminées
   repliées. Pied « Total » : échéances par période et retards.
   Origine : l'action ne porte pas la source qui l'a fait naître (constat, risque, revue, audit, vulnérabilité) ; seules
   les relations de sa fiche la disent, servies une fiche à la fois. La ligne montre donc le registre de l'action (ou
   « Outil historique »), jamais une origine devinée.
   Une ligne ouvre la fiche de l'action. Dessin par attributs SVG, couleurs d'état par l'attribut `color` (CSP stricte),
   textes de 13 px au moins (verre.css). Les autres styles gardent la frise du 20/11/2026 (FriseActions). */
import { ActionIcon, Button, Group, Text } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import type { BusinessPolicy, GrcObject } from '@suivi/shared';
import { useFiltreUrl } from '../components/filtre-url';
import { ficheCliquable } from '../fiche-cliquable';
import { libelleStatut } from './etat-action';
import {
  ECHELLES_PLAN,
  estEchellePlan,
  fenetrePlan,
  LIBELLES_ECHELLE_PLAN,
  libelleFenetre,
  libelleTotalPlan,
  lignesPlan,
  sousTitre,
  totauxPlan,
  type EchellePlan,
  type LignePlan,
} from './plan-actions';
import { sansResponsable } from './Timeline';
import {
  largeurTexte,
  PastilleResponsable,
  RegleTemps,
  Segmente,
  TAILLE_LISIBLE,
  TexteMasque,
  usePolicesChargees,
} from './TimelineCommun';

const JOUR = 86_400_000;
const LIGNE = 44;
const ENTETE = 40;
const PIED = 46;
const TITRE_PIED: Record<EchellePlan, string> = {
  semaine: 'échéances de la semaine',
  mois: 'échéances du mois',
  trimestre: 'échéances du trimestre',
};
const dateLongue = (n: number) => new Date(n).toLocaleDateString('fr-FR', { timeZone: 'UTC' });

/** Barre d'une action dans la fenêtre : filet du début à l'échéance, partie écoulée pleine, anneau du début, rond de
    l'échéance (plein et rose en retard, pointillé jusqu'à aujourd'hui), flèche de priorité. Rien hors de la fenêtre. */
export function BarreAction({
  l,
  x,
  largeur,
  hauteur = LIGNE,
  aujourdhui,
  couleur,
}: {
  l: LignePlan;
  x: (n: number) => number;
  largeur: number;
  hauteur?: number;
  aujourdhui: number;
  couleur: string;
}) {
  if (l.echeance === null) return null;
  const y = hauteur / 2,
    borne = (v: number) => Math.max(0, Math.min(largeur, v));
  const xe = x(l.echeance + JOUR / 2),
    xd = l.debut === null ? null : x(l.debut + JOUR / 2),
    xa = x(aujourdhui);
  const dansFenetre = (v: number) => v >= 0 && v <= largeur;
  const ecoule = xd === null ? null : [borne(xd), borne(Math.min(xa, xe))];
  return (
    <g className="pa-action" color={couleur} data-retard={l.retard ? '' : undefined}>
      {xd !== null && borne(xd) < borne(xe) && (
        <line className="pa-filet" x1={borne(xd)} x2={borne(xe)} y1={y} y2={y} />
      )}
      {ecoule && ecoule[1]! > ecoule[0]! && <line className="pa-ecoule" x1={ecoule[0]} x2={ecoule[1]} y1={y} y2={y} />}
      {l.retard && borne(xa) > borne(xe) && (
        <line className="pa-depassement" x1={borne(xe)} x2={borne(xa)} y1={y} y2={y} />
      )}
      {xd !== null && dansFenetre(xd) && <circle className="pa-debut" cx={xd} cy={y} r="4.5" />}
      {dansFenetre(xe) && (
        <>
          <circle className={l.retard ? 'pa-echeance pa-echeance--retard' : 'pa-echeance'} cx={xe} cy={y} r="7.5" />
          {l.haute && (
            <text className="pa-priorite" x={xe + 11} y={y - 4}>
              ↑
            </text>
          )}
        </>
      )}
    </g>
  );
}

/** Pied « Total » : échéances par période, « · N en retard » en rose ; nom accessible complet. */
export function TotalPlan({
  colonnes,
  totaux,
  x,
  largeur,
  hauteur = PIED,
  courante = -1,
}: {
  colonnes: readonly { debut: number; fin: number; libelle: string }[];
  totaux: readonly { echeances: number; retards: number }[];
  x: (n: number) => number;
  largeur: number;
  hauteur?: number;
  courante?: number;
}) {
  return (
    <svg
      className="pa-total__svg"
      width={largeur}
      height={hauteur}
      role="img"
      aria-label={`Échéances par période : ${colonnes
        .map((c, i) => {
          const t = totaux[i] ?? { echeances: 0, retards: 0 };
          return `${c.libelle}, ${t.echeances}${t.retards ? ` dont ${t.retards} en retard` : ''}`;
        })
        .join(' · ')}`}
    >
      {colonnes.map((c, i) => {
        const t = totaux[i] ?? { echeances: 0, retards: 0 };
        // Colonne étroite (semaines) : « · 1 » en rose ; le nom accessible garde « dont 1 en retard ».
        const long = ` · ${t.retards} en retard`,
          tient = largeurTexte(`${t.echeances}${long}`, TAILLE_LISIBLE, 700) + 12 <= x(c.fin) - x(c.debut);
        return (
          <text
            key={c.debut}
            x={(x(c.debut) + x(c.fin)) / 2}
            y={hauteur / 2 + 5}
            textAnchor="middle"
            className={[
              'pa-total__nb',
              t.echeances ? '' : 'pa-total__nb--zero',
              i === courante ? 'pa-total__nb--courant' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {t.echeances}
            {t.retards > 0 && <tspan className="pa-total__retard">{tient ? long : ` · ${t.retards}`}</tspan>}
          </text>
        );
      })}
    </svg>
  );
}

/** Pastille d'état (point de la couleur de la politique) : décorative, l'état est écrit dans le nom de la ligne. */
function PointEtat({ couleur }: { couleur: string }) {
  return (
    <svg className="pa-etat" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <circle cx="5" cy="5" r="4.5" fill={couleur} color={couleur} />
    </svg>
  );
}

export function PlanActionsVerre({
  items,
  policy,
  onOpen,
  ownerOf,
  closes,
  origineDe,
}: {
  items: GrcObject[];
  policy: BusinessPolicy;
  onOpen: (o: GrcObject) => void;
  ownerOf: (o: GrcObject) => string;
  /** Filtre « Afficher les actions closes » de la page : valeur par défaut du dépliage des actions terminées. */
  closes: boolean;
  /** Registre de l'action (nom), ou null s'il n'est pas connu. */
  origineDe: (o: GrcObject) => string | null;
}) {
  const [pas, setPas] = useFiltreUrl('tpas', 'mois'),
    [depart, setDepart] = useFiltreUrl('tpdebut', ''),
    [terminees, setTerminees] = useFiltreUrl('tterminees', closes ? '1' : '0');
  usePolicesChargees();
  const unite: EchellePlan = estEchellePlan(pas) ? pas : 'mois';
  const regle = useElementSize<HTMLDivElement>();
  const largeur = Math.max(160, Math.floor(regle.width || 640));
  const maintenant = Date.now();
  const annee = new Date(maintenant).getUTCFullYear();
  const origine = depart ? Date.parse(`${depart}T00:00:00Z`) : Number.NaN;
  const f = fenetrePlan(unite, maintenant, Number.isFinite(origine) ? origine : undefined);
  const x = (n: number) => ((n - f.debut) / (f.fin - f.debut)) * largeur;
  const { ouvertes, terminees: closesLignes } = lignesPlan(items, policy, maintenant);
  const deplies = terminees === '1';
  const montrees = deplies ? [...ouvertes, ...closesLignes] : ouvertes;
  const totaux = totauxPlan(f.colonnes, montrees);
  const courante = f.colonnes.findIndex((c) => maintenant >= c.debut && maintenant < c.fin);
  const couleurDe = (o: GrcObject) =>
    policy.statuses.find((s) => s.id === o.data.status)?.color ?? policy.statuses[0]?.color ?? '';
  const incoherentes = montrees.filter((l) => l.incoherente);
  const xa = x(maintenant);
  const aujourdhuiVisible = xa >= 0 && xa <= largeur;
  const ligne = (l: LignePlan) => {
    const o = l.objet,
      reg = o.id.startsWith('legacy:') ? 'Outil historique' : origineDe(o),
      etat = libelleStatut(policy, o),
      st = sousTitre(l, annee),
      responsable = ownerOf(o);
    const description = [
      etat,
      reg ? `origine : ${reg}` : 'origine non renseignée',
      l.echeance === null
        ? 'sans échéance'
        : `échéance le ${dateLongue(l.echeance)}${l.retard ? `, en retard de ${l.joursRetard} jour${l.joursRetard > 1 ? 's' : ''}` : ''}`,
      l.debut !== null ? `début le ${dateLongue(l.debut)}${l.debutCreation ? ' (création de la fiche)' : ''}` : '',
      l.incoherente ? 'début postérieur à l’échéance, à vérifier' : '',
      l.haute ? 'priorité haute' : '',
      `responsable : ${responsable}`,
      'ouvre la fiche de l’action',
    ]
      .filter(Boolean)
      .join(' ; ');
    return (
      <div
        key={o.id}
        className="pa-rang"
        data-retard={l.retard ? '' : undefined}
        data-terminee={l.terminee ? '' : undefined}
        {...ficheCliquable(() => onOpen(o), `Afficher ${o.name}`)}
        role="button"
        aria-label={o.name}
        aria-description={description}
      >
        <div className="pa-gauche">
          <PointEtat couleur={couleurDe(o)} />
          <span className="pa-textes">
            <span className="pa-nom" title={o.name}>
              {o.name}
            </span>
            <span className="pa-sous">
              <span className={reg ? 'pa-origine' : 'pa-origine pa-origine--vide'}>
                {reg ?? 'origine non renseignée'}
              </span>
              {' · '}
              <span className={l.retard ? 'pa-quand pa-quand--retard' : 'pa-quand'}>{st}</span>
            </span>
          </span>
          <PastilleResponsable libelle={responsable} vide={sansResponsable(o)} />
        </div>
        <div className="pa-piste">
          <svg className="pa-piste__svg" width={largeur} height={LIGNE} aria-hidden="true">
            {f.colonnes.map((c) => (
              <line key={c.debut} className="frise-trait" x1={x(c.debut)} x2={x(c.debut)} y1="0" y2={LIGNE} />
            ))}
            {aujourdhuiVisible && <line className="grc-timeline__aujourdhui" x1={xa} x2={xa} y1="0" y2={LIGNE} />}
            <BarreAction l={l} x={x} largeur={largeur} aujourdhui={maintenant} couleur={couleurDe(o)} />
          </svg>
        </div>
      </div>
    );
  };
  const nav = (n: number) => setDepart(new Date(n).toISOString().slice(0, 10));
  return (
    <section className="timeline-studio frise pa" data-mode="plan" aria-label="Timeline du plan d’actions">
      <div className="frise-barre">
        <span className="frise-barre__titre">Timeline</span>
        <span className="frise-barre__periode frise-barre__periode--souple">
          <span className="frise-barre__dates">
            <TexteMasque>Période affichée : </TexteMasque>
            {libelleFenetre(f, unite)}
          </span>
          <span className="frise-barre__suite"> · triée par échéance · trait violet : aujourd’hui</span>
        </span>
        <Segmente
          label="Échelle de la Timeline"
          options={ECHELLES_PLAN.map((k) => ({ value: k, label: LIBELLES_ECHELLE_PLAN[k] }))}
          valeur={unite}
          onChange={(k) => {
            setPas(k);
            setDepart('');
          }}
        />
        <Group gap="xs" role="group" aria-label="Navigation dans la période" className="frise-navigation">
          <ActionIcon variant="default" aria-label="Période précédente" onClick={() => nav(f.precedente)}>
            <span aria-hidden="true">‹</span>
          </ActionIcon>
          <Button variant="default" size="compact-sm" onClick={() => setDepart('')}>
            Aujourd’hui
          </Button>
          <ActionIcon variant="default" aria-label="Période suivante" onClick={() => nav(f.suivante)}>
            <span aria-hidden="true">›</span>
          </ActionIcon>
        </Group>
      </div>
      <div className="frise-legende">
        <div className="frise-legende__items" role="group" aria-label="Légende : états et barres des actions">
          {policy.statuses
            .filter((s) => s.id !== 'cancelled')
            .map((s) => (
              <span key={s.id} className="frise-legende__item">
                <PointEtat couleur={s.color} />
                {s.label}
              </span>
            ))}
          <span className="pa-legende__sep" aria-hidden="true" />
          <span className="frise-legende__item">
            <svg className="pa-legende" width="22" height="10" aria-hidden="true">
              <line className="pa-ecoule" x1="2" x2="20" y1="5" y2="5" />
            </svg>
            écoulé
          </span>
          <span className="frise-legende__item">
            <svg className="pa-legende" width="22" height="10" aria-hidden="true">
              <line className="pa-filet" x1="1" x2="21" y1="5" y2="5" />
            </svg>
            à venir
          </span>
          <span className="frise-legende__item">
            <svg className="pa-legende" width="14" height="14" aria-hidden="true">
              <circle className="pa-echeance" cx="7" cy="7" r="5" />
            </svg>
            échéance
          </span>
          <span className="frise-legende__item pa-legende--retard">
            <svg className="pa-legende" width="22" height="10" aria-hidden="true">
              <line className="pa-depassement" x1="1" x2="21" y1="5" y2="5" />
            </svg>
            dépassement
          </span>
          <span className="frise-legende__item">
            <span aria-hidden="true">↑</span> priorité haute
          </span>
        </div>
      </div>
      <div
        className="pa-grille"
        role="region"
        tabIndex={0}
        aria-label="Timeline des actions, défilement vertical possible"
      >
        <div className="pa-axe">
          <div className="pa-coin">Action · origine · responsable</div>
          <div ref={regle.ref} className="pa-regle">
            <RegleTemps colonnes={f.colonnes} x={x} largeur={largeur} hauteur={ENTETE} aujourdhui={maintenant} verre />
          </div>
        </div>
        {ouvertes.map(ligne)}
        {!ouvertes.length && (
          <Text size="sm" className="pa-vide">
            Aucune action ouverte dans ces filtres.
          </Text>
        )}
        {closesLignes.length > 0 && (
          <div className="pa-plus">
            <button
              type="button"
              className="pa-plus__bouton"
              aria-expanded={deplies}
              onClick={() => setTerminees(deplies ? '0' : '1')}
            >
              <span aria-hidden="true">{deplies ? '▾' : '▸'}</span> Actions terminées ({closesLignes.length})
            </button>{' '}
            ·{' '}
            {deplies
              ? 'affichées ci-dessous'
              : 'masquées, comme dans la liste ; « Afficher les actions closes » les fait revenir'}
          </div>
        )}
        {deplies && closesLignes.map(ligne)}
        <div className="pa-total">
          <div className="pa-total__titre">
            <span className="pa-total__nom">Total · {TITRE_PIED[unite]}</span>
            <span className="pa-total__recap">{libelleTotalPlan(ouvertes)}</span>
          </div>
          <div className="pa-regle">
            <TotalPlan colonnes={f.colonnes} totaux={totaux} x={x} largeur={largeur} courante={courante} />
          </div>
        </div>
      </div>
      {incoherentes.length > 0 && (
        <Text size="sm" className="pa-note">
          Dates à vérifier ({incoherentes.length}) : début postérieur à l’échéance, rien n’est corrigé ; ouvrez la
          fiche.
        </Text>
      )}
    </section>
  );
}

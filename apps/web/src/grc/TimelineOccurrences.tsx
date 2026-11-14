/* Timeline adaptative des tâches récurrentes (refonte Neon, lot 6, ADR 0093) : une ligne par série, ses occurrences à
   leur échéance, sur une période qui suit la périodicité (Auto) ou l'échelle choisie : 14 jours, 12 semaines ISO,
   12 mois civils ou 5 années civiles. Navigation, retour à aujourd'hui et « Tout afficher » ; les repères proches
   prennent un étage. Le rendu ne crée aucune occurrence : il ne montre que les fiches chargées, et celles qui ne se
   placent pas (hors période, sans échéance, dates incohérentes, actions hors série) restent listées et ouvrables.
   - Ligne (intitulé, fond) : fiche complète de la série (planning, iCalendar, réglages).
   - Repère : petite fenêtre de résultat (OK, KO, NA) de l'occurrence. */
import { ActionIcon, Button, Group, Select, Stack, Text } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import type { BusinessPolicy, GrcObject } from '@suivi/shared';
import { useFiltreUrl } from '../components/filtre-url';
import { ficheCliquable } from '../fiche-cliquable';
import {
  classeResultat,
  commandeRepere,
  descriptionRepere,
  enRetard,
  estRecurrente,
  tonTache,
  validationDe,
} from './etat-action';
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
  rythmeSerie,
  type ChoixEchelle,
  type Echelle,
  type Periode,
  type Placement,
} from './timeline-calendrier';
import { LegendeTimeline, ListeHors, toucheRepere, type OuvrirResultat } from './TimelineCommun';

/** Géométrie du dessin (pixels du SVG) : règle, étage de repères, demi-côté du carré, écart minimal sur un étage. */
const REGLE = 46;
const ETAGE = 40;
const HAUT = 15;
const DEMI = 7;
const ECART = 58;

/** Bandes calendaires, jours de fond et ligne d'aujourd'hui, derrière les repères d'une ligne. */
function Grille({
  p,
  x,
  hauteur,
  largeur,
  fond,
  aujourdhui,
}: {
  p: Periode;
  x: (n: number) => number;
  hauteur: number | string;
  largeur: number;
  fond: readonly JourFond[];
  aujourdhui: number;
}) {
  return (
    <g aria-hidden="true" className="timeline-occurrences__grille">
      {p.reperes.map((r, i) => (
        <rect
          key={r.debut}
          className={
            i % 2 ? 'timeline-occurrences__bande timeline-occurrences__bande--alt' : 'timeline-occurrences__bande'
          }
          x={x(r.debut)}
          y="0"
          width={Math.max(0, x(r.fin) - x(r.debut))}
          height={hauteur}
        />
      ))}
      {fond.map((j) => {
        const n = jour(j.date);
        return n >= p.debut && n < p.fin ? (
          <rect
            key={j.calendrier + j.date}
            className={`grc-timeline__fond grc-timeline__fond--${j.famille}`}
            data-fond={j.famille}
            x={x(n)}
            y="0"
            width={Math.max(1, largeur / p.jours)}
            height={hauteur}
          >
            <title>{`${dateFrise(n, { dateStyle: 'long' })} — ${j.label}`}</title>
          </rect>
        ) : null;
      })}
      {aujourdhui >= p.debut && aujourdhui < p.fin && (
        <line className="grc-timeline__aujourdhui" x1={x(aujourdhui)} x2={x(aujourdhui)} y1="0" y2={hauteur} />
      )}
    </g>
  );
}

export function FriseOccurrences({
  items,
  series,
  policy,
  onOpen,
  onResultat,
  ownerOf,
  fond,
}: {
  items: GrcObject[];
  series: GrcObject[];
  policy: BusinessPolicy;
  onOpen: (o: GrcObject) => void;
  onResultat: OuvrirResultat;
  ownerOf: (o: GrcObject) => string;
  fond: readonly JourFond[];
}) {
  // Réglages conservés dans l'adresse, comme les autres filtres des tâches.
  const [echelle, setEchelle] = useFiltreUrl('techelle', 'auto'),
    [focus, setFocus] = useFiltreUrl('tserie', ''),
    [depart, setDepart] = useFiltreUrl('tdebut', ''),
    [tout, setTout] = useFiltreUrl('ttout', '0');
  const regle = useElementSize<HTMLDivElement>();
  const largeur = Math.max(160, Math.floor(regle.width || 640));
  const maintenant = Date.now();
  // Aujourd'hui à l'heure courante ; chaque repère au milieu de son jour d'échéance (lisible à l'échelle journalière).
  const aujourdhui = maintenant;
  const recurrentes = items.filter(estRecurrente);
  const horsSerie = items.filter((o) => !estRecurrente(o));
  const suivies = focus ? recurrentes.filter((o) => o.data.seriesId === focus) : recurrentes;
  const choisie: ChoixEchelle = echelle in ECHELLES ? (echelle as Echelle) : 'auto';
  const unite = choisie === 'auto' ? infererEchelle(series, suivies, focus) : choisie;
  const origine = jour(depart);
  const p = periodeCalendaire(
    unite,
    maintenant,
    Number.isFinite(origine) ? origine : undefined,
    tout === '1' ? suivies.map((o) => jour(o.data.dueAt)) : undefined,
  );
  const { visibles, horsPeriode, sansDate, incoherentes } = classerDates(suivies, p, true);
  const x = (n: number) => ((n - p.debut) / (p.fin - p.debut)) * largeur;
  const borne = (n: number) => Math.max(DEMI + 6, Math.min(largeur - DEMI - 6, x(n)));
  const date = (iso: string) => dateFrise(jour(iso), { dateStyle: 'short' });
  const reinitialiser = () => {
    setDepart('');
    setTout('0');
  };
  const deplacer = (sens: number) => {
    setDepart(new Date(decalerPeriode(p, sens)).toISOString().slice(0, 10));
    setTout('0');
  };
  // Une ligne par série (ou par tâche historique), dans l'ordre de la première échéance ; la série suivie garde sa ligne
  // même vide ou en pause, avec ses commandes.
  const groupes = new Map<string, Placement[]>();
  for (const e of visibles) {
    const cle = String(e.objet.data.seriesId || e.objet.id);
    groupes.set(cle, [...(groupes.get(cle) ?? []), e]);
  }
  const serieSuivie = series.find((s) => s.id === focus);
  if (serieSuivie && !groupes.has(serieSuivie.id)) groupes.set(serieSuivie.id, []);
  const etroit = largeur / Math.max(1, p.reperes.length) < 72;
  const pausee = (serieSuivie?.data.recurrence as { active?: boolean } | undefined)?.active === false;
  return (
    <Stack gap="sm" className="timeline-studio" data-mode="occurrences">
      <div className="timeline-studio__entete">
        <div>
          <Text className="timeline-studio__surtitre">Tâches récurrentes · Timeline adaptative</Text>
          <Text size="sm">
            Période affichée : du {dateFrise(p.debut, { dateStyle: 'short' })} au{' '}
            {dateFrise(p.fin - JOUR, { dateStyle: 'short' })}.
          </Text>
          <Text size="xs" c="dimmed">
            {choisie === 'auto' ? 'Auto · ' : ''}
            {ECHELLES[unite]} · {p.jours} jours
            {choisie === 'auto' ? ' · adaptée à la périodicité affichée' : ''}
          </Text>
        </div>
        <div className="timeline-studio__outils">
          <Button.Group className="timeline-echelle" aria-label="Échelle de la Timeline">
            {(['auto', ...Object.keys(ECHELLES)] as ChoixEchelle[]).map((k) => (
              <Button
                key={k}
                size="compact-sm"
                variant={choisie === k ? 'filled' : 'default'}
                aria-pressed={choisie === k}
                onClick={() => {
                  setEchelle(k);
                  reinitialiser();
                }}
              >
                {k === 'auto' ? 'Auto' : ECHELLES[k]}
              </Button>
            ))}
          </Button.Group>
          <Group gap="xs" role="group" aria-label="Navigation dans la période">
            <ActionIcon variant="default" aria-label="Période précédente" onClick={() => deplacer(-1)}>
              <span aria-hidden="true">‹</span>
            </ActionIcon>
            <Button variant="default" size="compact-sm" onClick={reinitialiser}>
              Aujourd’hui
            </Button>
            <ActionIcon variant="default" aria-label="Période suivante" onClick={() => deplacer(1)}>
              <span aria-hidden="true">›</span>
            </ActionIcon>
            <Button variant="default" size="compact-sm" aria-pressed={tout === '1'} onClick={() => setTout('1')}>
              Tout afficher
            </Button>
          </Group>
        </div>
      </div>
      <Select
        className="timeline-serie"
        label="Série à suivre"
        placeholder="Toutes les séries"
        clearable
        searchable
        value={focus || null}
        onChange={(v) => {
          setFocus(v ?? '');
          setEchelle('auto');
          reinitialiser();
        }}
        data={series.map((s) => ({ value: s.id, label: `${s.name} · ${rythmeSerie(s)}` }))}
        nothingFoundMessage="Aucune série ne correspond."
      />
      <LegendeTimeline policy={policy} />
      <div
        className="timeline-occurrences"
        role="region"
        tabIndex={0}
        aria-label="Timeline des occurrences, défilement vertical possible"
      >
        <div className="timeline-occurrences__axe">
          <div className="timeline-occurrences__coin">Série · rythme</div>
          <div ref={regle.ref} className="timeline-occurrences__regle">
            <svg width={largeur} height={REGLE} aria-hidden="true">
              {/* Sur la règle, aujourd'hui est un libellé et un court repère : la ligne pleine est dans les lignes. */}
              <Grille p={p} x={x} hauteur={REGLE} largeur={largeur} fond={[]} aujourdhui={Number.NaN} />
              {p.reperes.map((r) => (
                <text
                  key={r.debut}
                  className="timeline-occurrences__graduation"
                  x={(x(r.debut) + x(r.fin)) / 2}
                  y={REGLE - 10}
                  textAnchor="middle"
                >
                  {etroit ? r.court : r.label}
                </text>
              ))}
              {aujourdhui >= p.debut && aujourdhui < p.fin && (
                <>
                  <text
                    className="timeline-occurrences__aujourdhui"
                    x={Math.max(40, Math.min(largeur - 40, x(aujourdhui)))}
                    y="13"
                    textAnchor="middle"
                  >
                    Aujourd’hui
                  </text>
                  <line className="grc-timeline__aujourdhui" x1={x(aujourdhui)} x2={x(aujourdhui)} y1="17" y2="24" />
                  <line
                    className="grc-timeline__aujourdhui"
                    x1={x(aujourdhui)}
                    x2={x(aujourdhui)}
                    y1={REGLE - 6}
                    y2={REGLE}
                  />
                </>
              )}
            </svg>
          </div>
        </div>
        {[...groupes.entries()].map(([cle, brutes]) => {
          const entrees = [...brutes].sort((a, b) => a.fin - b.fin);
          const serie = series.find((s) => s.id === cle);
          const premier = entrees[0]?.objet;
          const cible = serie ?? premier;
          if (!cible) return null;
          const nom = serie?.name ?? premier?.name ?? '';
          const rythme = serie ? rythmeSerie(serie) : 'Tâche récurrente historique';
          const positions = entrees.map((e) => borne(e.fin + JOUR / 2));
          const etages = etagerReperes(positions, ECART);
          const hauteur = HAUT * 2 + 16 + Math.max(0, ...etages) * ETAGE;
          const enAttente = entrees.filter((e) => !validationDe(e.objet)).length;
          const retard = entrees.some((e) => enRetard(e.objet, policy, maintenant));
          const ton = !entrees.length ? 'muted' : enAttente ? 'amber' : 'teal';
          const resume = `${entrees.length} occurrence(s) dans la période · ${enAttente} en attente`;
          return (
            <div key={cle} className="timeline-occurrences__rang" data-ton={ton}>
              <div
                {...ficheCliquable(() => onOpen(cible), `Afficher ${nom}`)}
                role="button"
                className="timeline-occurrences__serie"
                aria-label={nom}
                aria-description={`${rythme} ; ${resume}${retard ? ', en retard' : ''} ; ouvre la fiche${serie ? ' de la série' : ''}`}
                title={nom}
              >
                <span className="timeline-occurrences__nom">{nom}</span>
                <span className="timeline-occurrences__rythme">
                  {rythme} · {ownerOf(cible)}
                </span>
                <span className="timeline-occurrences__compte">
                  {resume}
                  {retard && <span className="grc-timeline__retard">! En retard</span>}
                </span>
              </div>
              {/* Piste : le fond (bandes, jours de fond, aujourd'hui) suit la hauteur de la ligne ; un clic sur le fond
                  ouvre la fiche complète, un clic sur un repère sa petite fenêtre de résultat. */}
              <div
                className="timeline-occurrences__piste"
                onClick={(ev) => {
                  if (!(ev.target as Element).closest('[role="button"]')) onOpen(cible);
                }}
              >
                <svg className="timeline-occurrences__fond" width={largeur} height="100%" aria-hidden="true">
                  <Grille p={p} x={x} hauteur="100%" largeur={largeur} fond={fond} aujourdhui={aujourdhui} />
                </svg>
                <svg
                  className="timeline-occurrences__voie"
                  width={largeur}
                  height={hauteur}
                  role="group"
                  aria-label={`Échéances de ${nom}`}
                >
                  {positions.length > 1 && (
                    <line
                      className="grc-timeline__guide"
                      x1={positions[0]}
                      x2={positions[positions.length - 1]}
                      y1={HAUT}
                      y2={HAUT}
                      aria-hidden="true"
                    />
                  )}
                  {entrees.map((e, i) => {
                    const o = e.objet,
                      cx = positions[i]!,
                      cy = HAUT + etages[i]! * ETAGE,
                      retardO = enRetard(o, policy, maintenant),
                      ouvrir = (el: SVGElement) => onResultat(o, el);
                    return (
                      <g
                        key={o.id}
                        role="button"
                        tabIndex={0}
                        className="grc-timeline__repere"
                        data-ton={tonTache(o, policy)}
                        data-retard={retardO ? '' : undefined}
                        aria-haspopup="dialog"
                        aria-label={`${commandeRepere(o)} : ${descriptionRepere(o, policy, maintenant, date)}`}
                        onClick={(ev) => ouvrir(ev.currentTarget)}
                        onKeyDown={toucheRepere(ouvrir)}
                      >
                        <title>{o.name}</title>
                        <g transform={`rotate(45 ${cx} ${cy})`}>
                          {retardO && (
                            <rect
                              className="grc-timeline__contour-retard"
                              x={cx - DEMI - 3}
                              y={cy - DEMI - 3}
                              width={DEMI * 2 + 6}
                              height={DEMI * 2 + 6}
                              rx="3"
                            />
                          )}
                          {!validationDe(o) && (
                            <rect
                              className="grc-timeline__pouls grc-timeline__pouls--carre"
                              x={cx - DEMI}
                              y={cy - DEMI}
                              width={DEMI * 2}
                              height={DEMI * 2}
                              rx="2"
                            />
                          )}
                          <rect
                            className={`grc-timeline__occurrence grc-timeline__occurrence--${classeResultat(o)}`}
                            x={cx - DEMI}
                            y={cy - DEMI}
                            width={DEMI * 2}
                            height={DEMI * 2}
                            rx="2"
                          />
                        </g>
                        <text className="timeline-occurrences__date" x={cx} y={cy + DEMI + 17} textAnchor="middle">
                          {dateFrise(e.fin)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          );
        })}
        {!groupes.size && (
          <Text size="sm" className="timeline-occurrences__vide">
            Aucune échéance dans cette période et ces filtres. Les commandes de période restent disponibles.
          </Text>
        )}
        {serieSuivie && !visibles.length && (
          <Text size="sm" className="timeline-occurrences__vide">
            {pausee
              ? 'Cette série est en pause : aucune occurrence dans cette période. Ses réglages restent accessibles.'
              : 'Aucune occurrence de cette série dans cette période.'}
          </Text>
        )}
      </div>
      <ListeHors
        titre={`Hors de la période (${horsPeriode.length})`}
        message="Ces échéances restent accessibles ; « Tout afficher » élargit la période."
        objets={horsPeriode}
        onOpen={onOpen}
      />
      <ListeHors
        titre={`Sans échéance (${sansDate.length})`}
        message="Aucune date n’est inventée : ouvrez la fiche pour la renseigner."
        objets={sansDate}
        onOpen={onOpen}
      />
      <ListeHors
        titre={`Dates à vérifier (${incoherentes.length})`}
        message="Date illisible ou début postérieur à l’échéance : ouvrez la fiche pour la corriger."
        objets={incoherentes}
        onOpen={onOpen}
      />
      <ListeHors
        titre={`Actions hors série (${horsSerie.length})`}
        message="Elles n’appartiennent à aucune série : elles se suivent dans le plan d’actions et restent ouvrables ici."
        objets={horsSerie}
        onOpen={onOpen}
      />
      {fond.length > 0 && (
        <Text size="xs" data-testid="timeline-fond" className="timeline-fond">
          Jours de fond disponibles ({fond.length}) :{' '}
          {fond
            .map(
              (j) =>
                `${dateFrise(jour(j.date), { dateStyle: 'short' })} ${j.label} (${j.famille === 'feries' ? 'férié' : 'fermeture'})`,
            )
            .join(' ; ')}
          .
        </Text>
      )}
    </Stack>
  );
}

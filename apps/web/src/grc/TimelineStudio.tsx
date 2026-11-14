/* Timeline Studio (refonte Neon, lot 6, ADR 0093) : rendu de la vue Timeline des actions et des tâches récurrentes.
   Les objets, états, résultats, droits et éditions restent ceux des API métier ; la présentation ne crée ni ne corrige
   aucune date. Contrats conservés de la Timeline précédente : région « Timeline des actions » défilant dans les deux
   sens, colonne d'intitulés fixe (`.grc-timeline__etiquettes`), un guide par action placée, période affichée, légende,
   mentions « ! En retard » et jours de fond (`data-fond`, `timeline-fond`).
   - Ligne (intitulé, fond de la ligne) : fiche complète, comme la commande existante.
   - Repère (barre ou carré d'occurrence) : petite fenêtre de résultat (ValidationRapide).
   Les teintes disent l'état ; le retard a son propre repère (contour et texte), distinct de l'état et du résultat. */
import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import type { BusinessPolicy, GrcObject } from '@suivi/shared';
import { useLayoutEffect, useRef } from 'react';
import { ficheCliquable } from '../fiche-cliquable';
import {
  classeResultat,
  commandeRepere,
  descriptionRepere,
  enRetard,
  estOccurrence,
  tonTache,
  validationDe,
} from './etat-action';
import type { JourFond } from './jours-de-fond';
import { calculerFrise, RAISON_DATE_LABELS } from './Timeline';
import {
  EtatTache,
  LegendeTimeline,
  ListeHors,
  ResultatTache,
  toucheRepere,
  type OuvrirResultat,
} from './TimelineCommun';
import { FriseOccurrences } from './TimelineOccurrences';

const JOUR = 86_400_000;
const LARGEUR_JOUR = 4;
/** Lignes fines : hauteur d'une ligne et de l'en-tête (pixels du dessin, reportés dans la colonne d'intitulés). */
const HAUTEUR_LIGNE = 30;
const ENTETE = 34;
const BARRE = 12;
const CARRE = 14;

/** Jours de fond de la période, écrits en toutes lettres (le dessin n'est qu'un repère). */
function JoursDeFond({
  jours,
  fr,
}: {
  jours: { jour: number; label: string; famille: string }[];
  fr: (n: number) => string;
}) {
  if (!jours.length) return null;
  return (
    <Text size="xs" data-testid="timeline-fond" className="timeline-fond">
      Jours de fond dans la période ({jours.length}) :{' '}
      {jours.map((j) => `${fr(j.jour)} ${j.label} (${j.famille === 'feries' ? 'férié' : 'fermeture'})`).join(' ; ')}.
    </Text>
  );
}

/** Intitulé d'une action : ouvre la fiche complète (clic, Entrée, Espace), comme la commande existante. Son nom
    accessible est l'intitulé exact ; l'état, le résultat, le retard et la période sont dans sa description. */
function IntituleAction({
  objet,
  policy,
  maintenant,
  date,
  onOpen,
}: {
  objet: GrcObject;
  policy: BusinessPolicy;
  maintenant: number;
  date: (iso: string) => string;
  onOpen: (o: GrcObject) => void;
}) {
  const retard = enRetard(objet, policy, maintenant);
  return (
    <div
      {...ficheCliquable(() => onOpen(objet), `Afficher ${objet.name}`)}
      role="button"
      className="grc-timeline__ligne"
      aria-label={objet.name}
      aria-description={`${descriptionRepere(objet, policy, maintenant, date)} ; ouvre la fiche`}
      title={objet.name}
      data-ton={tonTache(objet, policy)}
    >
      <EtatTache objet={objet} policy={policy} />
      <span className="grc-timeline__nom">{objet.name}</span>
      <ResultatTache objet={objet} />
      {retard && <span className="grc-timeline__retard">! En retard</span>}
    </div>
  );
}

function FriseActions({
  items,
  policy,
  onOpen,
  onResultat,
  fond,
}: {
  items: GrcObject[];
  policy: BusinessPolicy;
  onOpen: (o: GrcObject) => void;
  onResultat: OuvrirResultat;
  fond: readonly JourFond[];
}) {
  const region = useRef<HTMLDivElement>(null);
  // Une seule source pour la hauteur des lignes : le dessin et la colonne d'intitulés (CSSOM, autorisé par la CSP).
  useLayoutEffect(() => {
    region.current?.style.setProperty('--grc-timeline-rang', `${HAUTEUR_LIGNE}px`);
    region.current?.style.setProperty('--grc-timeline-entete', `${ENTETE}px`);
  }, []);
  const maintenant = Date.now();
  const frise = calculerFrise(items, maintenant);
  const x = (jour: number) => ((jour - frise.debut) / JOUR) * LARGEUR_JOUR;
  const largeurFrise = frise.jours * LARGEUR_JOUR + 20;
  const hauteur = ENTETE + frise.placees.length * HAUTEUR_LIGNE + 6;
  const finFrise = frise.debut + (frise.jours - 1) * JOUR;
  const mois: { jour: number; libelle: string }[] = [];
  for (let d = new Date(frise.debut); d.getTime() <= finFrise; d.setUTCDate(d.getUTCDate() + 1))
    if (d.getUTCDate() === 1)
      mois.push({
        jour: d.getTime(),
        libelle: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      });
  const aujourdhui = Math.floor(maintenant / JOUR) * JOUR;
  const fondVisible = fond
    .map((j) => ({ ...j, jour: Date.parse(j.date + 'T00:00:00Z') }))
    .filter((j) => Number.isFinite(j.jour) && j.jour >= frise.debut && j.jour <= finFrise);
  const fr = (jour: number) => new Date(jour).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
  const date = (iso: string) => fr(Math.floor(new Date(iso).getTime() / JOUR) * JOUR);
  const nbRetard = frise.placees.filter((p) => enRetard(p.objet, policy, maintenant)).length;
  return (
    <Stack gap="sm" className="timeline-studio" data-mode="actions">
      <div className="timeline-studio__entete">
        <div>
          <Text className="timeline-studio__surtitre">Plan d’actions · Timeline</Text>
          <Text size="sm">
            Période affichée : du {fr(frise.debut)} au {fr(finFrise)}.
          </Text>
        </div>
        <Text size="xs" c="dimmed" className="timeline-studio__compte">
          {frise.placees.length} action(s) placée(s) · {nbRetard} en retard
        </Text>
      </div>
      <LegendeTimeline policy={policy} />
      <JoursDeFond jours={fondVisible} fr={fr} />
      {frise.tronquee && (
        <Alert color="orange" role="status">
          La période est limitée à deux ans pour rester lisible : les échéances plus lointaines ne sont pas dessinées
          {frise.horsPeriode.length ? ` (${frise.horsPeriode.length} action(s) hors période, listées ci-dessous)` : ''}.
        </Alert>
      )}
      {frise.incoherentes.length > 0 && (
        <Alert color="red" role="alert" title="Dates à corriger : ces actions ne peuvent pas être placées">
          {frise.incoherentes.map(({ objet, raison }) => (
            <Group key={objet.id} gap="xs">
              <Text size="sm">
                {objet.name} : {RAISON_DATE_LABELS[raison]}.
              </Text>
              <Button variant="subtle" size="compact-sm" onClick={() => onOpen(objet)}>
                Corriger les dates
              </Button>
            </Group>
          ))}
        </Alert>
      )}
      <div
        ref={region}
        className="grc-timeline"
        role="region"
        tabIndex={0}
        aria-label="Timeline des actions, défilement possible dans les deux sens"
      >
        <div className="grc-timeline__etiquettes" role="group" aria-label="Intitulés des actions">
          <div className="grc-timeline__entete">Action · état</div>
          {frise.placees.map(({ objet }) => (
            <IntituleAction
              key={objet.id}
              objet={objet}
              policy={policy}
              maintenant={maintenant}
              date={date}
              onOpen={onOpen}
            />
          ))}
        </div>
        <svg
          className="grc-timeline__frise"
          role="group"
          aria-label="Repères du début à l’échéance de chaque action"
          width={largeurFrise}
          height={hauteur}
        >
          <g aria-hidden="true">
            {fondVisible.map((j) => (
              <rect
                key={j.date + j.calendrier}
                x={x(j.jour)}
                y={ENTETE - 6}
                width={LARGEUR_JOUR}
                height={hauteur - ENTETE + 6}
                className={`grc-timeline__fond grc-timeline__fond--${j.famille}`}
                data-fond={j.famille}
              >
                <title>{`${fr(j.jour)} — ${j.label}`}</title>
              </rect>
            ))}
            {mois.map((m) => (
              <g key={m.jour}>
                <line x1={x(m.jour)} x2={x(m.jour)} y1={ENTETE - 6} y2={hauteur} className="grc-timeline__mois" />
                <text x={x(m.jour) + 4} y="20" className="grc-timeline__mois-libelle">
                  {m.libelle}
                </text>
              </g>
            ))}
            <line
              x1={x(aujourdhui)}
              x2={x(aujourdhui)}
              y1={ENTETE - 6}
              y2={hauteur}
              className="grc-timeline__aujourdhui"
            />
          </g>
          {frise.placees.map(({ objet, de, a }, i) => {
            const y = ENTETE + i * HAUTEUR_LIGNE;
            const cy = y + HAUTEUR_LIGNE / 2;
            const retard = enRetard(objet, policy, maintenant);
            const occurrence = estOccurrence(objet);
            const ton = tonTache(objet, policy);
            const pouls = ton === 'amber' && !validationDe(objet);
            const debut = x(de),
              fin = x(a),
              largeur = Math.max(8, fin - debut + LARGEUR_JOUR);
            const ouvrir = (el: SVGElement) => onResultat(objet, el);
            return (
              <g key={objet.id} className="grc-timeline__rangee" data-ton={ton}>
                <rect
                  className="grc-timeline__fond-ligne"
                  x="0"
                  y={y}
                  width={largeurFrise}
                  height={HAUTEUR_LIGNE}
                  aria-hidden="true"
                  onClick={() => onOpen(objet)}
                />
                <line
                  x1="0"
                  x2={occurrence ? fin : debut}
                  y1={cy}
                  y2={cy}
                  className="grc-timeline__guide"
                  aria-hidden="true"
                />
                <g
                  role="button"
                  tabIndex={0}
                  className="grc-timeline__repere"
                  data-ton={ton}
                  data-retard={retard ? '' : undefined}
                  aria-haspopup="dialog"
                  aria-label={`${commandeRepere(objet)} : ${descriptionRepere(objet, policy, maintenant, date)}`}
                  onClick={(e) => ouvrir(e.currentTarget)}
                  onKeyDown={toucheRepere(ouvrir)}
                >
                  <title>{objet.name}</title>
                  {occurrence ? (
                    <g transform={`rotate(45 ${fin + CARRE / 2} ${cy})`}>
                      {retard && (
                        <rect
                          className="grc-timeline__contour-retard"
                          x={fin - 3}
                          y={cy - CARRE / 2 - 3}
                          width={CARRE + 6}
                          height={CARRE + 6}
                          rx="3"
                        />
                      )}
                      {pouls && (
                        <rect
                          className="grc-timeline__pouls grc-timeline__pouls--carre"
                          x={fin}
                          y={cy - CARRE / 2}
                          width={CARRE}
                          height={CARRE}
                          rx="2"
                        />
                      )}
                      <rect
                        x={fin}
                        y={cy - CARRE / 2}
                        width={CARRE}
                        height={CARRE}
                        rx="2"
                        className={`grc-timeline__occurrence grc-timeline__occurrence--${classeResultat(objet)}`}
                      />
                    </g>
                  ) : (
                    <>
                      {retard && (
                        <rect
                          className="grc-timeline__contour-retard"
                          x={debut - 3}
                          y={cy - BARRE / 2 - 3}
                          width={largeur + 6}
                          height={BARRE + 6}
                          rx={BARRE / 2 + 3}
                        />
                      )}
                      {pouls && (
                        <rect
                          className="grc-timeline__pouls"
                          x={debut}
                          y={cy - BARRE / 2}
                          width={largeur}
                          height={BARRE}
                          rx={BARRE / 2}
                        />
                      )}
                      <rect
                        className="grc-timeline__barre"
                        x={debut}
                        y={cy - BARRE / 2}
                        width={largeur}
                        height={BARRE}
                        rx={BARRE / 2}
                      />
                    </>
                  )}
                </g>
              </g>
            );
          })}
        </svg>
      </div>
      <ListeHors
        titre={`Hors de la période affichée (${frise.horsPeriode.length})`}
        objets={frise.horsPeriode}
        onOpen={onOpen}
      />
      <ListeHors
        titre={`Sans date de début ni d’échéance (${frise.sansDate.length})`}
        objets={frise.sansDate}
        onOpen={onOpen}
      />
    </Stack>
  );
}

export function TimelineStudio({
  items,
  series = [],
  occurrences = false,
  policy,
  onOpen,
  onResultat,
  ownerOf,
  fond = [],
}: {
  items: GrcObject[];
  /** Séries récurrentes lisibles (Timeline des occurrences). */
  series?: GrcObject[];
  /** Vrai sur la page Tâches récurrentes : Timeline adaptée à la périodicité, regroupée par série. */
  occurrences?: boolean;
  policy: BusinessPolicy;
  onOpen: (o: GrcObject) => void;
  onResultat: OuvrirResultat;
  ownerOf: (o: GrcObject) => string;
  /** Jours de fond (fériés, fermetures) : repères derrière les barres, sans effet sur les actions. */
  fond?: readonly JourFond[];
}) {
  return occurrences ? (
    <FriseOccurrences
      items={items}
      series={series}
      policy={policy}
      onOpen={onOpen}
      onResultat={onResultat}
      ownerOf={ownerOf}
      fond={fond}
    />
  ) : (
    <FriseActions items={items} policy={policy} onOpen={onOpen} onResultat={onResultat} fond={fond} />
  );
}

/* Timeline adaptative des tâches récurrentes (refonte Neon, lot 6, ADR 0093 ; refonte des frises décidée par le RSSI le
   20/11/2026 sur maquette) : une ligne par série (colonnes Série, Rythme, Resp., Prochaine, Dernier), ses occurrences à
   leur échéance, sur une période qui suit la périodicité (Auto) ou l'échelle choisie : 14 jours, 12 semaines ISO, 12 mois
   civils ou 5 années civiles. Navigation, retour à aujourd'hui et « Tout afficher » ; les repères trop proches prennent
   un étage. Le rendu ne crée aucune occurrence : il ne montre que les fiches chargées, et celles qui ne se placent pas
   (hors période, sans échéance, dates incohérentes, actions hors série) restent listées et ouvrables.
   - Ligne (intitulé, fond) : fiche complète de la série (planning, iCalendar, réglages).
   - Repère : petite fenêtre de résultat (OK, KO, NA) de l'occurrence. */
import { ActionIcon, Anchor, Button, Group, Select, Text } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import type { BusinessPolicy, GrcObject } from '@suivi/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { useFiltreUrl } from '../components/filtre-url';
import { ficheCliquable } from '../fiche-cliquable';
import {
  commandeRepere,
  descriptionRepere,
  enRetard,
  estRecurrente,
  infobulleRepere,
  tonTache,
  validationDe,
} from './etat-action';
import type { FamilleFond, JourFond } from './jours-de-fond';
import { compterParColonne, dateCourte, sansResponsable } from './Timeline';
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
import {
  Bascule,
  CarreOccurrence,
  DefsVerre,
  ElementLegende,
  InfobulleRepere,
  etatCarre,
  ListeHors,
  PastilleResponsable,
  PastilleResultat,
  PeriodeAffichee,
  PiedTemps,
  RegleTemps,
  Segmente,
  TexteMasque,
  useInfobulle,
  toucheRepere,
  usePolicesChargees,
  type ColonneTemps,
  type OuvrirResultat,
} from './TimelineCommun';

/** Géométrie du dessin (pixels du SVG) : ligne, étage supplémentaire, règle, pied, écart minimal sur un étage. */
const LIGNE = 40;
const ETAGE = 20;
const ENTETE = 46;
const PIED = 38;
const DEMI = 8;
const ECART = 19;
const PIED_TITRE: Record<Echelle, string> = {
  day: 'Occurrences du jour',
  week: 'Occurrences de la semaine',
  month: 'Occurrences du mois',
  year: 'Occurrences de l’année',
};
/** Libellés courts du sélecteur d'échelle (maquette) : Auto, puis l'unité de chaque échelle (journalière à annuelle). */
const SEGMENTS: Record<ChoixEchelle, string> = {
  auto: 'Auto',
  day: 'Jours',
  week: 'Semaines',
  month: 'Mois',
  year: 'Années',
};
const moisCourt = (n: number) => dateFrise(n, { month: 'short' });

/** Colonnes de la règle : libellés courts des mois (« nov. 26 ») ; les autres échelles gardent ceux du calendrier. */
function colonnesTemps(p: Periode): ColonneTemps[] {
  return p.reperes.map((r) => {
    const mensuel = p.unite === 'month' && r.fin - r.debut <= 31 * JOUR;
    return {
      debut: r.debut,
      fin: r.fin,
      libelle: mensuel
        ? `${moisCourt(r.debut)} ${String(new Date(r.debut).getUTCFullYear() % 100).padStart(2, '0')}`
        : r.label,
      court: mensuel ? moisCourt(r.debut) : r.court,
    };
  });
}

/** Traits des colonnes, jours de fond et ligne d'aujourd'hui, derrière les repères d'une ligne. */
function Grille({
  colonnes,
  x,
  largeur,
  joursPeriode,
  fond,
  aujourdhui,
  p,
}: {
  colonnes: readonly ColonneTemps[];
  x: (n: number) => number;
  largeur: number;
  joursPeriode: number;
  fond: readonly JourFond[];
  aujourdhui: number;
  p: Periode;
}) {
  return (
    <g aria-hidden="true" className="timeline-occurrences__grille">
      {fond.map((j) => {
        const n = jour(j.date);
        return n >= p.debut && n < p.fin ? (
          <rect
            key={j.calendrier + j.date}
            className={`grc-timeline__fond grc-timeline__fond--${j.famille}`}
            data-fond={j.famille}
            x={x(n)}
            y="0"
            width={Math.max(2, largeur / joursPeriode)}
            height="100%"
          >
            <title>{`${dateFrise(n, { dateStyle: 'long' })} — ${j.label}`}</title>
          </rect>
        ) : null;
      })}
      {colonnes.map((c) => (
        <line key={c.debut} className="frise-trait" x1={x(c.debut)} x2={x(c.debut)} y1="0" y2="100%" />
      ))}
      {aujourdhui >= p.debut && aujourdhui < p.fin && (
        <line className="grc-timeline__aujourdhui" x1={x(aujourdhui)} x2={x(aujourdhui)} y1="0" y2="100%" />
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
  fondActif,
  onFond,
}: {
  items: GrcObject[];
  series: GrcObject[];
  policy: BusinessPolicy;
  onOpen: (o: GrcObject) => void;
  onResultat: OuvrirResultat;
  ownerOf: (o: GrcObject) => string;
  fond: readonly JourFond[];
  fondActif: Readonly<Record<FamilleFond, boolean>>;
  onFond: (famille: FamilleFond, actif: boolean) => void;
}) {
  // Réglages conservés dans l'adresse, comme les autres filtres des tâches.
  const [echelle, setEchelle] = useFiltreUrl('techelle', 'auto'),
    [focus, setFocus] = useFiltreUrl('tserie', ''),
    [depart, setDepart] = useFiltreUrl('tdebut', ''),
    [tout, setTout] = useFiltreUrl('ttout', '0');
  usePolicesChargees();
  const bulle = useInfobulle();
  const [horsOuvert, setHorsOuvert] = useState(false);
  const regle = useElementSize<HTMLDivElement>();
  const largeur = Math.max(160, Math.floor(regle.width || 640));
  const maintenant = Date.now();
  // Aujourd'hui à l'heure courante ; chaque repère au milieu de son jour d'échéance (lisible à l'échelle journalière).
  const aujourdhui = maintenant;
  const annee = new Date(maintenant).getUTCFullYear();
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
  const colonnes = colonnesTemps(p);
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
  // Toutes les occurrences chargées de chaque série (dans ou hors de la période) : prochaine et dernier résultat.
  const parSerie = new Map<string, GrcObject[]>();
  for (const o of suivies) {
    const cle = String(o.data.seriesId || o.id);
    parSerie.set(cle, [...(parSerie.get(cle) ?? []), o]);
  }
  const serieSuivie = series.find((s) => s.id === focus);
  if (serieSuivie && !groupes.has(serieSuivie.id)) groupes.set(serieSuivie.id, []);
  const pausee = (serieSuivie?.data.recurrence as { active?: boolean } | undefined)?.active === false;
  const comptes = compterParColonne(
    colonnes,
    visibles.map((e) => e.fin),
  );
  const jours = (p.fin - p.debut) / JOUR;
  const parEcheance = (a: GrcObject, b: GrcObject) => jour(a.data.dueAt) - jour(b.data.dueAt);
  const datee = (o: GrcObject) => Number.isFinite(jour(o.data.dueAt));
  return (
    <section className="timeline-studio frise" data-mode="occurrences">
      <DefsVerre />
      <InfobulleRepere infobulle={bulle.infobulle} />
      <div className="frise-barre">
        <span className="frise-barre__titre">Planning des séries</span>
        <PeriodeAffichee
          debut={dateFrise(p.debut, { dateStyle: 'short' })}
          fin={dateFrise(p.fin - JOUR, { dateStyle: 'short' })}
          suite={choisie === 'auto' ? ' · adapté au rythme affiché' : undefined}
          souple
        />
        <Select
          className="frise-serie"
          aria-label="Série à suivre"
          placeholder="Toutes les séries"
          size="xs"
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
        <Segmente
          label="Échelle de la Timeline"
          options={(['auto', ...Object.keys(ECHELLES)] as ChoixEchelle[]).map((k) => ({
            value: k,
            label: SEGMENTS[k],
          }))}
          valeur={choisie}
          onChange={(k) => {
            setEchelle(k);
            reinitialiser();
          }}
        />
        <Group gap="xs" role="group" aria-label="Navigation dans la période" className="frise-navigation">
          <ActionIcon variant="default" aria-label="Période précédente" onClick={() => deplacer(-1)}>
            <span aria-hidden="true">‹</span>
          </ActionIcon>
          <Button variant="default" size="compact-sm" onClick={reinitialiser}>
            Aujourd’hui
          </Button>
          <ActionIcon variant="default" aria-label="Période suivante" onClick={() => deplacer(1)}>
            <span aria-hidden="true">›</span>
          </ActionIcon>
        </Group>
        <Button variant="default" size="compact-sm" aria-pressed={tout === '1'} onClick={() => setTout('1')}>
          Tout afficher
        </Button>
      </div>
      <div className="frise-legende">
        <div
          className="timeline-legende frise-legende__items"
          role="group"
          aria-label="Légende : résultat et échéance des occurrences"
        >
          <ElementLegende icone="ok">OK</ElementLegende>
          <ElementLegende icone="ko">KO</ElementLegende>
          <ElementLegende icone="na">NA</ElementLegende>
          <ElementLegende icone="attendu">Résultat attendu</ElementLegende>
          <ElementLegende icone="retard">En retard</ElementLegende>
          <ElementLegende icone="avenir">À venir</ElementLegende>
        </div>
        <div className="frise-legende__droite">
          <div className="frise-bascules" role="group" aria-label="Affichage de la frise">
            <Bascule
              libelle="Jours fériés"
              complement="en fond"
              coche={fondActif.feries}
              onChange={(v) => onFond('feries', v)}
            />
            <Bascule
              libelle="Autres calendriers"
              complement="en fond"
              coche={fondActif.autres}
              onChange={(v) => onFond('autres', v)}
            />
          </div>
        </div>
      </div>
      <div
        className="timeline-occurrences"
        role="region"
        tabIndex={0}
        aria-label="Timeline des occurrences, défilement vertical possible"
      >
        <div className="timeline-occurrences__axe">
          <div className="timeline-occurrences__coin frise-cols-series">
            <span>Série</span>
            <span className="frise-col-rythme">Rythme</span>
            <span className="frise-col-resp">Resp.</span>
            <span className="frise-col-prochaine">Prochaine</span>
            <span className="frise-col-dernier">Dernier</span>
          </div>
          <div ref={regle.ref} className="timeline-occurrences__regle">
            <RegleTemps colonnes={colonnes} x={x} largeur={largeur} hauteur={ENTETE} aujourdhui={aujourdhui} />
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
          const hauteur = LIGNE + Math.max(0, ...etages) * ETAGE;
          const enAttente = entrees.filter((e) => !validationDe(e.objet)).length;
          const retard = entrees.some((e) => enRetard(e.objet, policy, maintenant));
          const ton = !entrees.length ? 'muted' : enAttente ? 'amber' : 'teal';
          const resume = `${entrees.length} occurrence(s) dans la période · ${enAttente} en attente`;
          const chargees = (parSerie.get(cle) ?? []).filter(datee);
          const prochaine = chargees.filter((o) => !validationDe(o)).sort(parEcheance)[0];
          const dernier = chargees
            .filter((o) => validationDe(o))
            .sort(parEcheance)
            .at(-1);
          const prochaineRetard = !!prochaine && enRetard(prochaine, policy, maintenant);
          const responsable = ownerOf(cible);
          const xs = positions.filter((_, i) => etages[i] === 0);
          return (
            <div key={cle} className="timeline-occurrences__rang" data-ton={ton}>
              <div
                {...ficheCliquable(() => onOpen(cible), `Afficher ${nom}`)}
                role="button"
                className="timeline-occurrences__serie frise-cols-series"
                aria-label={nom}
                aria-description={`${rythme} ; ${resume}${retard ? ', en retard' : ''}${prochaine ? ` ; prochaine échéance le ${date(String(prochaine.data.dueAt))}` : ''}${dernier ? ` ; dernier résultat ${validationDe(dernier)}` : ''}, responsable : ${responsable} ; ouvre la fiche${serie ? ' de la série' : ''}`}
                title={nom}
              >
                <span className="timeline-occurrences__nom">{nom}</span>
                <span className="frise-col-rythme timeline-occurrences__rythme" title={rythme}>
                  {rythme}
                </span>
                <span className="frise-col-resp">
                  <PastilleResponsable libelle={responsable} vide={sansResponsable(cible)} />
                </span>
                <span
                  className={
                    prochaineRetard
                      ? 'frise-col-prochaine frise-date frise-date--retard'
                      : 'frise-col-prochaine frise-date'
                  }
                >
                  {prochaine ? dateCourte(jour(prochaine.data.dueAt), annee) : '—'}
                </span>
                <span className="frise-col-dernier">
                  <PastilleResultat objet={dernier} />
                </span>
                {retard && <TexteMasque>! En retard</TexteMasque>}
              </div>
              {/* Piste : le fond (traits, jours de fond, aujourd'hui) suit la hauteur de la ligne ; un clic sur le fond
                  ouvre la fiche complète, un clic sur un repère sa petite fenêtre de résultat. */}
              <div
                className="timeline-occurrences__piste"
                onClick={(ev) => {
                  if (!(ev.target as Element).closest('[role="button"]')) onOpen(cible);
                }}
              >
                <svg className="timeline-occurrences__fond" width={largeur} height="100%" aria-hidden="true">
                  <Grille
                    colonnes={colonnes}
                    x={x}
                    largeur={largeur}
                    joursPeriode={jours}
                    fond={fond}
                    aujourdhui={aujourdhui}
                    p={p}
                  />
                </svg>
                <svg
                  className="timeline-occurrences__voie"
                  width={largeur}
                  height={hauteur}
                  role="group"
                  aria-label={`Échéances de ${nom}`}
                >
                  {xs.length > 1 && (
                    <line
                      className="grc-timeline__guide frise-fil"
                      x1={xs[0]}
                      x2={xs[xs.length - 1]}
                      y1={LIGNE / 2}
                      y2={LIGNE / 2}
                      aria-hidden="true"
                    />
                  )}
                  {entrees.map((e, i) => {
                    const o = e.objet,
                      cx = positions[i]!,
                      cy = LIGNE / 2 + etages[i]! * ETAGE,
                      ouvrir = (el: SVGElement) => {
                        bulle.fermer();
                        onResultat(o, el);
                      };
                    return (
                      <g
                        key={o.id}
                        role="button"
                        tabIndex={0}
                        className="grc-timeline__repere"
                        data-ton={tonTache(o, policy)}
                        data-retard={enRetard(o, policy, maintenant) ? '' : undefined}
                        aria-haspopup="dialog"
                        aria-label={`${commandeRepere(o)} : ${descriptionRepere(o, policy, maintenant, date)}`}
                        onClick={(ev) => ouvrir(ev.currentTarget)}
                        onKeyDown={toucheRepere(ouvrir)}
                        {...bulle.surRepere(() => infobulleRepere(o, policy, maintenant, { carre: true }))}
                      >
                        <CarreOccurrence
                          cx={cx}
                          cy={cy}
                          etat={etatCarre(o, maintenant, enRetard(o, policy, maintenant))}
                        />
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
        <div className="timeline-occurrences__pied">
          <div className="frise-pied">{PIED_TITRE[unite]}</div>
          <div className="timeline-occurrences__regle">
            <PiedTemps
              titre={PIED_TITRE[unite]}
              colonnes={colonnes}
              comptes={comptes}
              x={x}
              largeur={largeur}
              hauteur={PIED}
            />
          </div>
        </div>
      </div>
      <div className="frise-notes">
        <ListeHors
          titre={`Hors de la période (${horsPeriode.length})`}
          message="Ces échéances restent accessibles. « Tout afficher » élargit la période."
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
        {fond.length > 0 && (
          <Text size="xs" data-testid="timeline-fond" className="timeline-fond">
            Jours de fond disponibles ({fond.length}) :{' '}
            {fond
              .map(
                (j) =>
                  `${dateFrise(jour(j.date), { dateStyle: 'short' })} ${j.label} (${j.famille === 'feries' ? 'férié' : 'fermeture'})`,
              )
              .join(' · ')}
            . Le fond est un repère : il ne change aucune occurrence.
          </Text>
        )}
      </div>
      {horsSerie.length > 0 && (
        <div className="frise-plus">
          <button
            type="button"
            className="frise-plus__bouton"
            aria-expanded={horsOuvert}
            onClick={() => setHorsOuvert((v) => !v)}
          >
            <span aria-hidden="true">{horsOuvert ? '▾' : '▸'}</span> Actions hors série ({horsSerie.length})
          </button>{' '}
          · elles se suivent dans le{' '}
          <Anchor component={Link} to="/pilotage/actions?tvue=timeline" inherit>
            plan d’actions
          </Anchor>
          .
          {horsOuvert && (
            <Group gap="xs" className="frise-plus__liste">
              {horsSerie.map((o) => (
                <Button key={o.id} variant="subtle" size="compact-sm" onClick={() => onOpen(o)}>
                  {o.name}
                </Button>
              ))}
            </Group>
          )}
        </div>
      )}
    </section>
  );
}

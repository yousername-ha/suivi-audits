/* Fenêtre d'un indicateur et saisie d'une mesure, style « Verre » (dessin FicheIndicateur validé par le RSSI le
   27/11/2026). En-tête : pastille, intitulé, puces (code, état, origine de la valeur) et onglets « Suivi », « Définition »,
   « Historique ». Suivi : à gauche la série (valeur courante, cible, variation, graphique avec la zone où la cible est
   respectée) et la définition résumée ; à droite « Saisir une mesure » (alerte si la valeur saisie manque la cible) et
   « Dernières mesures ». Définition : tous les champs de la fiche existante. Historique : le tableau des mesures et leur
   suppression. Pied : lien vers les données d'un indicateur calculé, « Fermer ». Les champs, écritures et droits sont
   ceux de FicheIndicateur (FichesObjectifs.tsx), passés tels quels. Graphique en SVG à attributs (CSP stricte), couleurs
   portées par des classes (verre.css). Le dessin montre aussi un seuil d'alerte et une preuve jointe : l'outil ne les
   connaît pas, ils ne sont pas affichés. */
import {
  Alert,
  Anchor,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  etatIndicateur,
  formatValeurIndicateur,
  valeurIndicateur,
  type EtatIndicateur,
  type IndicateurObjectif,
} from '@suivi/shared';
import { useCan } from '../session';
import {
  alerteSaisie,
  dernieresMesures,
  geometrieSerie,
  jourCourt,
  libelleCible,
  libelleSens,
  lienSource,
  serieIndicateur,
  tendanceMesures,
  type PeriodeSerie,
} from './indicateur-verre';
import { LIBELLES_ETAT } from './objectifs-presentation';

type Ligne = Record<string, unknown>;
const texte = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
type Onglet = 'suivi' | 'definition' | 'historique';
const HAUTEUR_GRAPHIQUE = 200;

function Pastille() {
  return (
    <span className="indv-pastille" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        focusable="false"
      >
        <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />
      </svg>
    </span>
  );
}

/** Graphique de la série : abscisse au temps, zone où la cible est respectée, ligne de cible pointillée, courbe et aire. */
export function GraphiqueSerie({ indicateur, periode }: { indicateur: Ligne; periode: PeriodeSerie }) {
  const { ref, width } = useElementSize();
  const degrade = useId().replace(/:/g, '');
  const serie = serieIndicateur(indicateur, periode);
  const g = geometrieSerie(indicateur, serie, Math.max(width, 1), HAUTEUR_GRAPHIQUE);
  const resume = serie.length
    ? `${serie.length} mesure${serie.length > 1 ? 's' : ''} du ${jourCourt(serie[0]!.date)} au ${jourCourt(serie.at(-1)!.date)}, de ${formatValeurIndicateur(indicateur, Math.min(...serie.map((p) => p.v)))} à ${formatValeurIndicateur(indicateur, Math.max(...serie.map((p) => p.v)))} ; ${libelleCible(indicateur)}.`
    : '';
  if (!serie.length) return <p className="indv-vide">Aucune mesure chiffrée à tracer sur cette période.</p>;
  return (
    <div className="indv-graphique">
      <div ref={ref} className="indv-graphique__cadre">
        {width > 0 && (
          <svg
            className="indv-graphique__svg"
            width={width}
            height={HAUTEUR_GRAPHIQUE}
            viewBox={`0 0 ${width} ${HAUTEUR_GRAPHIQUE}`}
            role="img"
            aria-label={`Série de l’indicateur : ${resume}`}
          >
            <defs>
              <linearGradient id={degrade} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="indv-degrade-haut" />
                <stop offset="1" className="indv-degrade-bas" />
              </linearGradient>
            </defs>
            {g.cible?.zone && (
              <rect
                className="indv-zone-cible"
                x="0"
                y={g.cible.zone.y}
                width={width}
                height={Math.max(g.cible.zone.hauteur, 0)}
              />
            )}
            <path className="indv-aire" d={g.aire} fill={`url(#${degrade})`} />
            <path className="indv-courbe" d={g.ligne} fill="none" />
            {g.cible && (
              <>
                <line
                  className="indv-ligne-cible"
                  x1="0"
                  x2={width}
                  y1={g.cible.y}
                  y2={g.cible.y}
                  strokeDasharray="5 5"
                />
                <text
                  className="indv-etiquette-cible"
                  x={width - 6}
                  y={g.cible.y > 24 ? g.cible.y - 7 : g.cible.y + 18}
                  textAnchor="end"
                >
                  {libelleCible(indicateur)}
                </text>
              </>
            )}
            {g.points.map((p, i) => (
              <circle
                key={p.date + i}
                className={i === g.points.length - 1 ? 'indv-point indv-point--dernier' : 'indv-point'}
                cx={p.x}
                cy={p.y}
                r={i === g.points.length - 1 ? 5 : 3}
              >
                <title>{`${jourCourt(p.date)} : ${formatValeurIndicateur(indicateur, p.v)}`}</title>
              </circle>
            ))}
          </svg>
        )}
      </div>
      <p className="indv-axe" aria-hidden="true">
        {g.reperes.map((r, i) => (
          <span key={i}>{r}</span>
        ))}
      </p>
    </div>
  );
}

export interface SaisieMesure {
  date: string;
  setDate: (v: string) => void;
  valeur: string;
  setValeur: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  hist: string;
  setHist: (v: string) => void;
  ajouter: () => Promise<void>;
}

export function FicheIndicateurVerre({
  indicateur,
  synthese,
  modifiable,
  calcule,
  erreur,
  definition,
  historique,
  saisie,
  supprimer,
  enregistrer,
  onClose,
}: {
  indicateur: Ligne;
  synthese?: IndicateurObjectif;
  modifiable: boolean;
  calcule: boolean;
  erreur: ReactNode;
  /** Rubriques « Définition et cible », « Surveillance et mesure » et « Plan d'action » de la fiche existante. */
  definition: ReactNode;
  /** Tableau des mesures de la fiche existante (avec leur suppression). */
  historique: ReactNode;
  saisie: SaisieMesure;
  supprimer: ReactNode;
  enregistrer: ReactNode;
  onClose: () => void;
}) {
  const can = useCan();
  const [onglet, setOnglet] = useState<Onglet>('suivi'),
    [periode, setPeriode] = useState<PeriodeSerie>(12);
  const id = texte(indicateur.id);
  const titreSerie = useId(),
    titreDefinition = useId(),
    titreSaisie = useId(),
    titreDernieres = useId();
  const etat: EtatIndicateur = synthese?.etat ?? etatIndicateur(indicateur, {});
  const valeur = synthese?.valeur ?? formatValeurIndicateur(indicateur, valeurIndicateur(indicateur, {}).v);
  const origine = calcule ? `Mesure automatique${synthese?.source ? ` · ${synthese.source}` : ''}` : 'Saisie manuelle';
  const tendance = calcule ? null : tendanceMesures(indicateur);
  const alerte = modifiable && !calcule ? alerteSaisie(indicateur, saisie.valeur) : null;
  const dernieres = dernieresMesures(indicateur, 3);
  const lien = lienSource(indicateur.calc);
  const lienVisible = lien && can(lien.module, 'lire') ? lien : null;
  const dir = texte(indicateur.dir);
  return (
    <Modal
      opened
      onClose={onClose}
      size="xl"
      classNames={{ content: 'objectifs-fiche indv-fenetre fiche-defilement' }}
      title={
        <span className="indv-titre">
          <Pastille />
          <span>{texte(indicateur.name) || `Indicateur ${id}`}</span>
        </span>
      }
    >
      <Tabs value={onglet} onChange={(v) => v && setOnglet(v as Onglet)} keepMounted className="indv-onglets">
        <div className="indv-tete">
          <p className="indv-puces">
            <span className="indv-puce" data-ton="code">
              {id}
            </span>
            <span className="indv-puce" data-etat={etat}>
              {LIBELLES_ETAT[etat]}
            </span>
            <span className="indv-puce">{origine}</span>
          </p>
          <Tabs.List aria-label="Rubriques de l’indicateur">
            <Tabs.Tab value="suivi">Suivi</Tabs.Tab>
            <Tabs.Tab value="definition">Définition</Tabs.Tab>
            <Tabs.Tab value="historique">Historique</Tabs.Tab>
          </Tabs.List>
        </div>
        {erreur}
        <Tabs.Panel value="suivi" pt="md">
          <div className="indv-suivi">
            <div className="indv-gauche">
              <section className="indv-bloc indv-serie" aria-labelledby={titreSerie}>
                <div className="indv-bloc__tete">
                  <h3 id={titreSerie} className="indv-bloc__titre">
                    Série
                  </h3>
                  <SegmentedControl
                    size="xs"
                    aria-label="Période de la série"
                    value={String(periode)}
                    onChange={(v) => setPeriode(v === 'tout' ? 'tout' : v === '6' ? 6 : 12)}
                    data={[
                      { value: '6', label: '6 mois' },
                      { value: '12', label: '12 mois' },
                      { value: 'tout', label: 'Tout' },
                    ]}
                  />
                </div>
                <p className="indv-chiffre">
                  <span className="indv-chiffre__valeur" data-etat={etat}>
                    {valeur}
                  </span>
                  <span className="indv-chiffre__cible">{libelleCible(indicateur)}</span>
                  {tendance && (
                    <span
                      className="indv-tendance"
                      data-favorable={tendance.favorable === null ? undefined : String(tendance.favorable)}
                    >
                      {tendance.texte}
                    </span>
                  )}
                </p>
                <GraphiqueSerie indicateur={indicateur} periode={periode} />
                {calcule && (
                  <p className="indv-note">
                    Valeur calculée par l’outil à partir des autres modules ; la série ne montre que les mesures
                    enregistrées.
                  </p>
                )}
              </section>
              <section className="indv-bloc" aria-labelledby={titreDefinition}>
                <h3 id={titreDefinition} className="indv-bloc__titre">
                  Définition
                </h3>
                <dl className="indv-definition">
                  <div>
                    <dt>Ce qui est mesuré</dt>
                    <dd>{texte(indicateur.monitored) || 'À préciser (onglet Définition)'}</dd>
                  </div>
                  <div>
                    <dt>Fréquence</dt>
                    <dd>{texte(indicateur.freq) || 'À définir'}</dd>
                  </div>
                  <div>
                    <dt>Responsable</dt>
                    <dd>{texte(indicateur.owner) || 'Non désigné'}</dd>
                  </div>
                  <div>
                    <dt>Sens</dt>
                    <dd>{libelleSens(dir)}</dd>
                  </div>
                </dl>
              </section>
            </div>
            <section className="indv-bloc indv-saisie" aria-labelledby={titreSaisie}>
              <h3 id={titreSaisie} className="indv-bloc__titre">
                Saisir une mesure
              </h3>
              {calcule ? (
                <Alert>Indicateur calculé automatiquement : sa valeur ne se saisit pas manuellement.</Alert>
              ) : !modifiable ? (
                <Text size="sm">La saisie d’une mesure demande le droit de modifier le Pilotage.</Text>
              ) : (
                <Stack gap="sm">
                  <TextInput
                    label="Date"
                    type="date"
                    value={saisie.date}
                    onChange={(e) => saisie.setDate(e.currentTarget.value)}
                  />
                  <TextInput
                    label="Valeur"
                    placeholder={dir === '=' ? 'Oui ou Non' : 'ex. 88 %'}
                    value={saisie.valeur}
                    onChange={(e) => saisie.setValeur(e.currentTarget.value)}
                  />
                  <Textarea
                    label="Commentaire"
                    autosize
                    minRows={2}
                    value={saisie.note}
                    onChange={(e) => saisie.setNote(e.currentTarget.value)}
                  />
                  <TextInput
                    label="Période historique"
                    placeholder="ex. 2025-2026 (facultatif)"
                    value={saisie.hist}
                    onChange={(e) => saisie.setHist(e.currentTarget.value)}
                  />
                  {alerte && (
                    <p className="indv-alerte" role="status">
                      {alerte}
                    </p>
                  )}
                  <Button
                    className="indv-enregistrer"
                    disabled={!saisie.valeur.trim() || !saisie.date}
                    onClick={() => void saisie.ajouter()}
                  >
                    Enregistrer la mesure
                  </Button>
                </Stack>
              )}
              <h3 id={titreDernieres} className="indv-bloc__titre">
                Dernières mesures
              </h3>
              {dernieres.length ? (
                <ol className="indv-dernieres" aria-labelledby={titreDernieres}>
                  {dernieres.map((m, i) => (
                    <li key={m.date + i}>
                      <span>
                        {jourCourt(m.date)}
                        {m.hist && ` · période ${m.hist}`}
                      </span>
                      <strong>{m.valeur}</strong>
                    </li>
                  ))}
                </ol>
              ) : (
                <Text size="sm">Aucune valeur saisie.</Text>
              )}
            </section>
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="definition" pt="md">
          <Stack>{definition}</Stack>
        </Tabs.Panel>
        <Tabs.Panel value="historique" pt="md">
          {historique}
        </Tabs.Panel>
      </Tabs>
      <Group justify="space-between" className="fenetre-actions objectifs-fiche-actions indv-pied">
        {lienVisible ? (
          <Anchor component={Link} to={lienVisible.to}>
            {lienVisible.libelle}
          </Anchor>
        ) : (
          <span />
        )}
        <Group>
          {onglet === 'definition' && supprimer}
          <Button variant="default" onClick={onClose}>
            Fermer
          </Button>
          {onglet === 'definition' && enregistrer}
        </Group>
      </Group>
    </Modal>
  );
}

/* Objectifs, indicateurs et processus du SMSI : interface de l'outil de suivi historique reprise dans le Pilotage
   (vues « Par processus », « Par objectif », « Vue compacte » et « Boîtes de pilotage », ajout, fiches, mesures, tendance,
   source de la valeur). Les états sont calculés par les fonctions partagées testées en parité
   (packages/shared/src/tableau-de-bord.ts) ; les indicateurs « calculés » sont alimentés par les autres modules, aucune
   valeur n'est estimée. Présentation « compact Studio » (refonte Neon, lot 3) : cible violette, valeur mesurée et état en
   blocs colorés, « Non atteint » signalé par un pictogramme et un halo animé, flèches d'évolution animées ; la flèche décrit
   la variation de la valeur, l'état sa comparaison à la cible selon l'opérateur (objectifs-presentation.ts). */
import { Anchor, Badge, Button, Card, Group, Progress, Stack, Table, Tabs, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  indicateursSynthese,
  objectifsParProcessus,
  objectifsPilotage,
  valeurIndicateur,
  type EtatIndicateur,
  type IndicateurObjectif,
  type ObjectifPilotage,
} from '@suivi/shared';
import { DataTable, NeonAnneau } from '@suivi/ui';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { Filtres } from '../components/Filtres';
import { ficheCliquable } from '../fiche-cliquable';
import { useCan } from '../session';
import { useState } from 'react';
import { FicheIndicateur, FicheObjectif, FicheProcessus, texte, useEcriture, type Ligne } from './FichesObjectifs';
import { etatDePerimetre } from './perimetre-etat';
import {
  compterParEtat,
  EXPLICATIONS_ETAT,
  FILTRES_ETAT,
  jour,
  LIBELLES_ETAT,
  LIBELLES_TENDANCE,
  pireEtat,
  sensTendance,
} from './objectifs-presentation';

const COULEURS_ETAT: Record<EtatIndicateur, string> = { ok: 'green', ko: 'red', na: 'gray', undef: 'orange' };
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const rows = (v: unknown): Ligne[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Ligne[]) : [];
type Vue = 'processus' | 'objectif' | 'compacte' | 'boites';
interface Boite {
  ref: string;
  actionsOuvertes: number | null;
  actionsEnRetard: number | null;
  risques: number | null;
  series: number | null;
  prochaineEcheance: string | null;
}
type Ouvert = { type: 'processus' | 'objectif' | 'indicateur'; id: string } | null;

/** Triangle d'avertissement, décoratif : le libellé « Non atteint » porte l'information. */
function Avertissement() {
  return (
    <svg
      className="objectifs-avertissement"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.3 4.6a2 2 0 0 1 3.4 0l8 13.9a2 2 0 0 1-1.7 3H4a2 2 0 0 1-1.7-3Z" />
      <path d="M12 9v5m0 3h.01" />
    </svg>
  );
}

/** Puce d'état (légende, boîtes) : mêmes libellés que les blocs, pictogramme pour « Non atteint ». */
function EtatObjectifs({ etat }: { etat: EtatIndicateur }) {
  return (
    <Badge
      color={COULEURS_ETAT[etat]}
      variant="light"
      data-etat={etat}
      className="objectifs-puce"
      leftSection={etat === 'ko' ? <Avertissement /> : undefined}
    >
      {LIBELLES_ETAT[etat]}
    </Badge>
  );
}

/** Flèche d'évolution numérique (hausse, baisse, stable) ; rien sans tendance connue. */
function Tendance({ valeur }: { valeur: IndicateurObjectif['tendance'] }) {
  const sens = sensTendance(valeur);
  if (!sens) return null;
  return (
    <svg
      className="objectifs-tendance"
      data-tendance={sens}
      viewBox="0 0 16 16"
      role="img"
      aria-label={`Tendance : ${LIBELLES_TENDANCE[sens]}`}
    >
      <path
        d={
          sens === 'hausse' ? 'M3 13 13 3M5 3h8v8' : sens === 'baisse' ? 'M3 3 13 13M5 13h8V5' : 'M2 8h12m-4-4 4 4-4 4'
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

const TRACES_ENTETE = {
  indicateur: 'M5 5h12M5 10h12M5 15h8M2 5h.01M2 10h.01M2 15h.01',
  cible: 'M10 1v3m0 12v3M1 10h3m12 0h3',
  mesure: 'M3 16h14M5 13V9m5 4V3m5 10V6',
  etat: 'M10 2 17 5v5c0 4-3 7-7 8-4-1-7-4-7-8V5Zm-3 8 2 2 4-4',
  source: 'M6 2v4m8-4v4M3 8h14m-10 4h3',
} as const;
/** En-tête de colonne centré, avec pictogramme : les noms des colonnes restent lisibles dans toutes les vues. */
function EnteteColonne({ type, libelle }: { type: keyof typeof TRACES_ENTETE; libelle: string }) {
  return (
    <span className="objectifs-entete-colonne" data-type={type}>
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {type === 'cible' && (
          <>
            <circle cx="10" cy="10" r="5.5" />
            <circle cx="10" cy="10" r="2" />
          </>
        )}
        {type === 'source' && <rect x="3" y="4" width="14" height="13" rx="2" />}
        <path d={TRACES_ENTETE[type]} />
      </svg>
      <span>{libelle}</span>
    </span>
  );
}

/** Origine de la valeur (source du calcul ou date de la mesure) et dernière valeur historique. */
function SourceIndicateur({ indicateur: i }: { indicateur: IndicateurObjectif }) {
  if (!i.source && !i.historique) return null;
  return (
    <span className="objectifs-source">
      {i.source && <span>{i.calcule ? i.source : jour(i.source)}</span>}
      {i.historique && (
        <span>
          {i.historique.periode} : {i.historique.valeur}
        </span>
      )}
    </span>
  );
}

function CibleIndicateur({ indicateur: i, compacte = false }: { indicateur: IndicateurObjectif; compacte?: boolean }) {
  return (
    <div className="objectifs-donnee objectifs-donnee--cible" data-compacte={compacte || undefined}>
      <span className="objectifs-donnee-label">Cible à atteindre</span>
      <strong>{i.cible}</strong>
      {!compacte && <span className="objectifs-source">Valeur attendue</span>}
    </div>
  );
}

function MesureIndicateur({ indicateur: i, compacte = false }: { indicateur: IndicateurObjectif; compacte?: boolean }) {
  return (
    <div className="objectifs-donnee objectifs-donnee--mesure" data-etat={i.etat} data-compacte={compacte || undefined}>
      <span className="objectifs-donnee-label">Valeur mesurée</span>
      <span className="objectifs-mesure-chiffre">
        <strong className="objectifs-valeur" data-etat={i.etat}>
          {i.valeur}
        </strong>
        <Tendance valeur={i.tendance} />
      </span>
      {!compacte && <SourceIndicateur indicateur={i} />}
    </div>
  );
}

function EtatIndicateurBloc({ etat, compacte = false }: { etat: EtatIndicateur; compacte?: boolean }) {
  return (
    <div className="objectifs-donnee objectifs-donnee--etat" data-etat={etat} data-compacte={compacte || undefined}>
      <span className="objectifs-donnee-label">État</span>
      <strong className="objectifs-etat-libelle">
        {etat === 'ko' && <Avertissement />}
        <span>{LIBELLES_ETAT[etat]}</span>
      </strong>
      {!compacte && <span className="objectifs-source">{EXPLICATIONS_ETAT[etat]}</span>}
    </div>
  );
}

export function ObjectifsProcessus({ smsi, vue: vueInitiale = 'processus' }: { smsi: string; vue?: Vue }) {
  const can = useCan(),
    modifiable = can('pilotage', 'modifier'),
    [vue, setVue] = useState<Vue>(vueInitiale),
    [ouvert, setOuvert] = useState<Ouvert>(null),
    [etat, setEtat] = useState('all'),
    { ecrire, erreur } = useEcriture(smsi);
  const q = useQuery({
    queryKey: ['grc', smsi, 'legacy-objectifs'],
    queryFn: async () => etatDePerimetre(await get<Record<string, unknown>>('/api/suivi/etat'), smsi),
  });
  const boites = useQuery({
    queryKey: ['grc', smsi, 'legacy-objectifs', 'boites'],
    queryFn: () => get<Boite[]>(`/api/grc/${smsi}/pilotage/boites`),
    enabled: vue === 'boites',
  });
  const donnees = q.data;
  const objectifs = donnees ? objectifsPilotage(donnees) : [];
  const parProcessus = donnees ? objectifsParProcessus(donnees) : null;
  const synthese = donnees ? indicateursSynthese(donnees) : null;
  const rProcessus = rows(donnees?.processes),
    rObjectifs = rows(donnees?.objectives),
    rIndicateurs = rows(donnees?.indicators);
  const ligne = (liste: Ligne[], id: string) => liste.find((x) => texte(x.id) === id);
  const garde = (i: IndicateurObjectif) => etat === 'all' || i.etat === etat;
  const comptes = compterParEtat(objectifs.flatMap((o) => o.indicateurs));
  const ajouter = async (cle: 'processes' | 'objectives' | 'indicators', corps: unknown = {}) => {
    const r = await ecrire('POST', cle, corps);
    if (r && typeof r.id === 'string')
      setOuvert({
        type: cle === 'processes' ? 'processus' : cle === 'objectives' ? 'objectif' : 'indicateur',
        id: r.id,
      });
  };
  const ouvrirIndicateur = (id: string) => setOuvert({ type: 'indicateur', id });
  const ouvrirObjectif = (id: string) => setOuvert({ type: 'objectif', id });

  const tableauIndicateurs = (o: ObjectifPilotage) => {
    const lignes = o.indicateurs.filter(garde);
    if (!lignes.length)
      return (
        <Text size="sm" className="objectifs-vide">
          {o.indicateurs.length ? 'Aucun indicateur pour ce filtre.' : 'Aucun indicateur.'}
        </Text>
      );
    return (
      <div className="objectifs-table-indicateurs">
        <DataTable label={`Indicateurs de l’objectif ${o.id}`}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <EnteteColonne type="indicateur" libelle="Indicateur" />
                </Table.Th>
                <Table.Th className="objectifs-colonne-donnee objectifs-colonne-cible">
                  <EnteteColonne type="cible" libelle="Cible à atteindre" />
                </Table.Th>
                <Table.Th className="objectifs-colonne-donnee">
                  <EnteteColonne type="mesure" libelle="Valeur mesurée" />
                </Table.Th>
                <Table.Th className="objectifs-colonne-donnee">
                  <EnteteColonne type="etat" libelle="État" />
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lignes.map((i) => (
                <Table.Tr
                  key={i.id}
                  data-etat={i.etat}
                  {...ficheCliquable(() => ouvrirIndicateur(i.id), `Afficher l’indicateur ${i.id}`)}
                >
                  <Table.Td data-label="Indicateur" className="objectifs-cellule-nom">
                    <Button
                      variant="subtle"
                      size="compact-sm"
                      className="objectifs-ouvrir"
                      aria-label={`Ouvrir l’indicateur ${i.id}`}
                      onClick={() => ouvrirIndicateur(i.id)}
                    >
                      <span className="objectifs-code">{i.id}</span>
                      <span>{i.nom}</span>
                    </Button>
                    {i.calcule && (
                      <Badge size="sm" variant="light" className="objectifs-marque">
                        calculé
                      </Badge>
                    )}
                    {i.categorie === 'satisfaction' && (
                      <Badge size="sm" variant="light" color="encre" className="objectifs-marque">
                        satisfaction client
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td data-label="Cible" className="objectifs-cellule-donnee">
                    <CibleIndicateur indicateur={i} />
                  </Table.Td>
                  <Table.Td data-label="Valeur mesurée" className="objectifs-cellule-donnee">
                    <MesureIndicateur indicateur={i} />
                  </Table.Td>
                  <Table.Td data-label="État" className="objectifs-cellule-donnee objectifs-cellule-etat">
                    <EtatIndicateurBloc etat={i.etat} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
      </div>
    );
  };
  const blocObjectif = (o: ObjectifPilotage) => (
    <Stack key={o.id} gap="sm" className="objectifs-bloc" role="group" aria-label={`Objectif ${o.id}`}>
      <div className="objectifs-entete">
        <div className="objectifs-identite">
          <Button
            variant="subtle"
            size="compact-sm"
            className="objectifs-ouvrir objectifs-titre"
            aria-label={`Ouvrir l’objectif ${o.id}`}
            onClick={() => ouvrirObjectif(o.id)}
          >
            <span className="objectifs-code">{o.id}</span>
            <span>{o.nom}</span>
          </Button>
          <dl className="objectifs-meta">
            <div>
              <dt>Responsable</dt>
              <dd>{o.responsable || 'à définir'}</dd>
            </div>
            <div>
              <dt>Échéance</dt>
              <dd>{jour(o.echeance)}</dd>
            </div>
          </dl>
        </div>
        <div className="objectifs-avancement" data-etat={pireEtat(o.indicateurs) ?? 'na'}>
          <NeonAnneau
            titre={`Indicateurs atteints de l’objectif ${o.id}`}
            valeur={o.atteints}
            total={o.indicateurs.length}
            centre={o.indicateurs.length ? `${o.atteints}/${o.indicateurs.length}` : '—'}
            detail="atteints"
          />
        </div>
      </div>
      {tableauIndicateurs(o)}
    </Stack>
  );

  return (
    <Stack className="objectifs-module">
      <Group justify="space-between" className="objectifs-commandes">
        <Text size="sm">
          Processus, objectifs de sécurité et indicateurs associés. Les indicateurs marqués « calculé » sont alimentés
          par les autres modules ; aucune valeur n’est estimée.
        </Text>
        {modifiable && (
          <Group>
            <Button variant="default" onClick={() => ajouter('processes')}>
              Ajouter un processus
            </Button>
            <Button variant="default" onClick={() => ajouter('objectives')}>
              Ajouter un objectif
            </Button>
            <Button onClick={() => ajouter('indicators')} disabled={!rObjectifs.length}>
              Ajouter un indicateur
            </Button>
          </Group>
        )}
      </Group>
      <ErrorAlert error={erreur ?? q.error} />
      {synthese && (
        <section className="objectifs-synthese" aria-label="Synthèse des indicateurs">
          <Card withBorder className="objectifs-kpi" data-etat="ok">
            <div className="objectifs-kpi-texte">
              <span className="objectifs-repere">Résultats mesurés</span>
              <h3>Indicateurs atteints</h3>
              <p className="objectifs-kpi-nombre">
                <strong>
                  {synthese.atteints}
                  <small> / {synthese.total}</small>
                </strong>
                <span>indicateurs atteints</span>
              </p>
              <small>Seuils respectés selon leur cible</small>
            </div>
            <NeonAnneau titre="Indicateurs atteints" valeur={synthese.atteints} total={synthese.total} />
          </Card>
          <Card withBorder className="objectifs-kpi" data-etat="ko">
            <div className="objectifs-kpi-texte">
              <span className="objectifs-repere">Résultats à suivre</span>
              <h3>Non atteints</h3>
              <p className="objectifs-kpi-nombre">
                <strong>
                  {synthese.nonAtteints}
                  <small> / {synthese.total}</small>
                </strong>
                <span>non atteints</span>
              </p>
              <small>Écart entre la mesure et la cible</small>
            </div>
            <span className="objectifs-kpi-icone">
              <Avertissement />
            </span>
            <div className="objectifs-kpi-pied">
              <Progress
                value={synthese.total ? (synthese.nonAtteints * 100) / synthese.total : 0}
                aria-label={`${synthese.nonAtteints} indicateur(s) non atteint(s) sur ${synthese.total}`}
              />
            </div>
          </Card>
          <Card withBorder className="objectifs-kpi" data-etat="na">
            <div className="objectifs-kpi-texte">
              <span className="objectifs-repere">Mesure et définition</span>
              <h3>À mesurer ou définir</h3>
              <p className="objectifs-kpi-nombre">
                <strong>{synthese.nonMesures}</strong>
                <span>non mesurés ou cible à définir</span>
              </p>
              <small>À compléter pour évaluer le résultat</small>
            </div>
            <span className="objectifs-kpi-icone">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M4 20h17M6 16V9m6 7V3m6 13V6" />
              </svg>
            </span>
          </Card>
        </section>
      )}
      {donnees && !objectifs.length && !rProcessus.length && <Text>Aucun processus ni objectif enregistré.</Text>}
      {donnees && (
        <section className="objectifs-registre" aria-label="Suivi des objectifs et de leurs indicateurs">
          <header className="objectifs-registre-entete">
            <div>
              <span className="objectifs-repere">Suivi des résultats</span>
              <h2>Les objectifs et leurs indicateurs</h2>
            </div>
          </header>
          <Tabs
            className="objectifs-vues"
            value={vue}
            onChange={(v) => setVue((v as Vue) ?? 'processus')}
            keepMounted={false}
          >
            <Tabs.List>
              <Tabs.Tab value="processus">Par processus</Tabs.Tab>
              <Tabs.Tab value="objectif">Par objectif</Tabs.Tab>
              <Tabs.Tab value="compacte">Vue compacte</Tabs.Tab>
              <Tabs.Tab value="boites">Boîtes de pilotage</Tabs.Tab>
            </Tabs.List>
            <div className="objectifs-outils">
              <Group
                gap="2xs"
                className="objectifs-filtres-rapides"
                role="group"
                aria-label="Filtrer les indicateurs par état"
              >
                {FILTRES_ETAT.map(([cle, libelle]) => (
                  <Button
                    key={cle}
                    variant="subtle"
                    size="compact-xs"
                    data-etat={cle}
                    aria-pressed={etat === cle}
                    onClick={() => setEtat(cle)}
                  >
                    {cle !== 'all' && <span className="objectifs-point" aria-hidden="true" />}
                    {libelle}
                    <span className="objectifs-filtre-nombre">{comptes[cle]}</span>
                  </Button>
                ))}
              </Group>
              <Group gap="xs" className="objectifs-outils-droite">
                <Filtres actifs={etat === 'all' ? 0 : 1} onReinitialiser={() => setEtat('all')}>
                  <Tabs value={etat} onChange={(v) => setEtat(v ?? 'all')} variant="pills">
                    <Tabs.List>
                      {FILTRES_ETAT.map(([v, l]) => (
                        <Tabs.Tab key={v} value={v}>
                          {l}
                        </Tabs.Tab>
                      ))}
                    </Tabs.List>
                  </Tabs>
                </Filtres>
                <Group gap="2xs" role="group" aria-label="Légende des états" className="objectifs-legende-etats">
                  {(Object.keys(LIBELLES_ETAT) as EtatIndicateur[]).map((k) => (
                    <EtatObjectifs key={k} etat={k} />
                  ))}
                </Group>
              </Group>
            </div>
            <Tabs.Panel value="boites">
              <Stack>
                <Text size="sm" className="objectifs-explication">
                  Une boîte par processus (ISO 9001:2015, 4.4.1 c et 9.1.1) : indicateurs liés par leurs objectifs ou
                  directement, avec leur état, puis ce qui est rattaché au processus dans le registre commun. Ces
                  chiffres aident le pilotage ; ils ne constituent pas un taux de conformité.
                </Text>
                <ErrorAlert error={boites.error} />
                <div className="grc-dashboard-grid boites-pilotage">
                  {rProcessus.map((p) => {
                    const id = texte(p.id);
                    const mesObjectifs = objectifs.filter((o) => o.processus.includes(id));
                    const directs = rIndicateurs.filter(
                      (i) => Array.isArray(i.processes) && (i.processes as unknown[]).includes(id),
                    );
                    const parObjectif = mesObjectifs.flatMap((o) => o.indicateurs);
                    const tous = [
                      ...parObjectif,
                      ...objectifs
                        .flatMap((o) => o.indicateurs)
                        .filter(
                          (i) => directs.some((d) => texte(d.id) === i.id) && !parObjectif.some((x) => x.id === i.id),
                        ),
                    ].filter(garde);
                    const pire = pireEtat(tous);
                    const b = boites.data?.find((x) => x.ref === `legacy:processes:${id}`);
                    const chiffres: [string, string, string?][] = [
                      [
                        'Actions ouvertes',
                        String(b?.actionsOuvertes ?? '–'),
                        b?.actionsEnRetard ? `dont ${b.actionsEnRetard} en retard` : undefined,
                      ],
                      ['Risques liés', String(b?.risques ?? '–')],
                      ['Séries récurrentes', String(b?.series ?? '–')],
                      ['Prochaine échéance', b?.prochaineEcheance ? jour(b.prochaineEcheance) : '–'],
                    ];
                    return (
                      <Card
                        key={id}
                        withBorder
                        aria-label={`Boîte du processus ${id}`}
                        className="boite-pilotage objectifs-boite"
                        data-etat={pire}
                      >
                        <Stack gap="sm">
                          <Group justify="space-between" wrap="nowrap" align="flex-start">
                            <div>
                              <Anchor
                                component="button"
                                type="button"
                                fw={700}
                                className="objectifs-boite-titre"
                                aria-label={`Ouvrir le processus ${id}`}
                                onClick={() => setOuvert({ type: 'processus', id })}
                              >
                                {id} · {texte(p.name)}
                              </Anchor>
                              <Text size="sm" className="objectifs-boite-pilote">
                                Pilote : {texte(p.owner) || 'à définir'}
                              </Text>
                            </div>
                            {pire && <EtatObjectifs etat={pire} />}
                          </Group>
                          {tous.length ? (
                            <ul className="boite-indicateurs" aria-label={`Indicateurs du processus ${id}`}>
                              {tous.map((i) => (
                                <li key={i.id} data-etat={i.etat}>
                                  <Anchor
                                    component="button"
                                    type="button"
                                    size="sm"
                                    fw={600}
                                    aria-label={`Ouvrir l’indicateur ${i.id}`}
                                    onClick={() => ouvrirIndicateur(i.id)}
                                  >
                                    {i.nom}
                                  </Anchor>
                                  <Group justify="space-between" gap="xs" wrap="nowrap" align="center">
                                    <Text size="sm" className="objectifs-boite-valeur">
                                      <strong className="objectifs-valeur" data-etat={i.etat}>
                                        {i.valeur}
                                      </strong>{' '}
                                      <Tendance valeur={i.tendance} />{' '}
                                      <span className="objectifs-boite-cible">cible {i.cible || '–'}</span>
                                    </Text>
                                    <EtatObjectifs etat={i.etat} />
                                  </Group>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <Text size="sm" className="objectifs-vide">
                              Aucun indicateur pour ce processus.
                            </Text>
                          )}
                          <dl className="boite-chiffres" aria-label={`Registre du processus ${id}`}>
                            {chiffres.map(([libelle, valeur, detail]) => (
                              <div key={libelle}>
                                <dt>{libelle}</dt>
                                <dd>
                                  {valeur}
                                  {detail && <span className="boite-chiffres-detail"> {detail}</span>}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </Stack>
                      </Card>
                    );
                  })}
                </div>
                {!rProcessus.length && (
                  <Text>Aucun processus : ajoutez-en un pour constituer sa boîte de pilotage.</Text>
                )}
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="processus">
              <Stack>
                {parProcessus?.familles.map((f) => (
                  <Stack key={f.famille} gap="xs">
                    <Text fw={600} className="objectifs-famille">
                      {f.famille === 'Autres' ? 'Processus non classés' : `Processus de ${f.famille.toLowerCase()}`}
                    </Text>
                    {f.avecObjectif.map((p) => (
                      <Card key={p.id} withBorder className="objectifs-processus">
                        <Stack gap="xs">
                          <Group gap="xs" className="objectifs-processus-entete">
                            <Button
                              variant="subtle"
                              size="compact-sm"
                              className="objectifs-ouvrir"
                              aria-label={`Ouvrir le processus ${p.id}`}
                              onClick={() => setOuvert({ type: 'processus', id: p.id })}
                            >
                              <span className="objectifs-code">{p.id}</span>
                            </Button>
                            <Text fw={600} className="objectifs-processus-nom">
                              {p.nom}
                            </Text>
                          </Group>
                          <Text size="sm" className="objectifs-processus-meta">
                            Pilote : {p.pilote || 'à définir'} · {pluriel(p.objectifs.length, 'objectif')} ·{' '}
                            {p.atteints} atteint(s), {p.nonAtteints} non atteint(s), {p.aMesurer} à mesurer ou définir
                          </Text>
                          {p.objectifs.map(blocObjectif)}
                        </Stack>
                      </Card>
                    ))}
                    {!!f.sansObjectif.length && (
                      <Group gap="xs" className="objectifs-sans-objectif">
                        <Text size="sm">Sans objectif de sécurité rattaché :</Text>
                        {f.sansObjectif.map((p) => (
                          <Button
                            key={p.id}
                            size="compact-sm"
                            variant="default"
                            onClick={() => setOuvert({ type: 'processus', id: p.id })}
                          >
                            {p.id} {p.nom}
                          </Button>
                        ))}
                      </Group>
                    )}
                  </Stack>
                ))}
                {!!parProcessus?.sansProcessus.length && (
                  <Card withBorder className="objectifs-processus">
                    <Stack gap="xs">
                      <Text fw={600} className="objectifs-processus-nom">
                        Objectifs sans processus
                      </Text>
                      {parProcessus.sansProcessus.map(blocObjectif)}
                    </Stack>
                  </Card>
                )}
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="objectif">
              <Stack>
                {objectifs.map((o) => {
                  const brut = ligne(rObjectifs, o.id);
                  const enjeux = Array.isArray(brut?.enjeux) ? (brut.enjeux as unknown[]).map(texte) : [];
                  return (
                    <Card key={o.id} withBorder className="objectifs-carte">
                      <Stack gap="xs">
                        {blocObjectif(o)}
                        {!!enjeux.length && (
                          <details className="objectifs-enjeux">
                            <summary>Enjeux associés ({enjeux.length})</summary>
                            <ul>
                              {enjeux.map((e) => (
                                <li key={e}>{e}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </Stack>
                    </Card>
                  );
                })}
                {!objectifs.length && <Text>Aucun objectif.</Text>}
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="compacte">
              <div className="objectifs-table-compacte">
                <DataTable label="Objectifs, vue compacte">
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>
                          <EnteteColonne type="indicateur" libelle="Indicateur" />
                        </Table.Th>
                        <Table.Th className="objectifs-colonne-donnee objectifs-colonne-cible">
                          <EnteteColonne type="cible" libelle="Cible à atteindre" />
                        </Table.Th>
                        <Table.Th className="objectifs-colonne-donnee">
                          <EnteteColonne type="mesure" libelle="Valeur mesurée" />
                        </Table.Th>
                        <Table.Th className="objectifs-colonne-donnee objectifs-colonne-etat">
                          <EnteteColonne type="etat" libelle="État" />
                        </Table.Th>
                        <Table.Th className="objectifs-colonne-source">
                          <EnteteColonne type="source" libelle="Relevé / source" />
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    {objectifs.map((o) => {
                      const visibles = o.indicateurs.filter(garde);
                      return (
                        <Table.Tbody key={o.id}>
                          <Table.Tr
                            className="objectifs-compact-groupe"
                            {...ficheCliquable(() => ouvrirObjectif(o.id), `Afficher l’objectif ${o.id}`)}
                          >
                            <Table.Th colSpan={5} scope="rowgroup">
                              <div className="objectifs-compact-entete">
                                <div>
                                  <Button
                                    variant="subtle"
                                    size="compact-sm"
                                    aria-label={`Ouvrir l’objectif ${o.id}`}
                                    onClick={() => ouvrirObjectif(o.id)}
                                  >
                                    <span className="objectifs-code">{o.id}</span>
                                    <span>{o.nom}</span>
                                  </Button>
                                  <div className="objectifs-compact-meta">
                                    <span>Processus : {o.processus.join(', ') || '–'}</span>
                                    <span>Responsable : {o.responsable || '–'}</span>
                                    <span>Échéance : {jour(o.echeance)}</span>
                                    {!visibles.length && (
                                      <span>
                                        {o.indicateurs.length ? 'Aucun indicateur pour ce filtre' : 'Aucun indicateur'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="objectifs-compact-avancement">
                                  <Progress
                                    value={o.indicateurs.length ? (o.atteints * 100) / o.indicateurs.length : 0}
                                    aria-label={`${o.atteints} indicateur(s) atteint(s) sur ${o.indicateurs.length}`}
                                  />
                                  <span>
                                    {o.atteints}/{o.indicateurs.length} atteints
                                  </span>
                                </div>
                              </div>
                            </Table.Th>
                          </Table.Tr>
                          {visibles.map((i) => (
                            <Table.Tr
                              key={i.id}
                              data-etat={i.etat}
                              {...ficheCliquable(() => ouvrirIndicateur(i.id), `Afficher l’indicateur ${i.id}`)}
                            >
                              <Table.Td data-label="Indicateur" className="objectifs-cellule-nom">
                                <Button
                                  variant="subtle"
                                  size="compact-sm"
                                  aria-label={`Ouvrir l’indicateur ${i.id}`}
                                  onClick={() => ouvrirIndicateur(i.id)}
                                >
                                  <span className="objectifs-code">{i.id.replace('INDOBJ', '')}</span>
                                  <span>
                                    {i.nom}
                                    {i.calcule ? ' (auto)' : ''}
                                  </span>
                                </Button>
                              </Table.Td>
                              <Table.Td data-label="Cible" className="objectifs-cellule-donnee">
                                <CibleIndicateur indicateur={i} compacte />
                              </Table.Td>
                              <Table.Td data-label="Valeur mesurée" className="objectifs-cellule-donnee">
                                <MesureIndicateur indicateur={i} compacte />
                              </Table.Td>
                              <Table.Td data-label="État" className="objectifs-cellule-donnee objectifs-cellule-etat">
                                <EtatIndicateurBloc etat={i.etat} compacte />
                              </Table.Td>
                              <Table.Td data-label="Relevé / source" className="objectifs-cellule-source">
                                <SourceIndicateur indicateur={i} />
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      );
                    })}
                  </Table>
                </DataTable>
              </div>
            </Tabs.Panel>
          </Tabs>
          <p className="objectifs-legende">
            Flèches : évolution de la valeur depuis la mesure précédente · Couleur de la valeur et état : comparaison à
            la cible selon son opérateur (≥, ≤ ou =).
          </p>
        </section>
      )}
      {ouvert?.type === 'processus' && ligne(rProcessus, ouvert.id) && (
        <FicheProcessus
          key={ouvert.id}
          smsi={smsi}
          processus={ligne(rProcessus, ouvert.id)!}
          objectifs={rObjectifs}
          indicateurs={rIndicateurs}
          modifiable={modifiable}
          onClose={() => setOuvert(null)}
        />
      )}
      {ouvert?.type === 'objectif' && ligne(rObjectifs, ouvert.id) && (
        <FicheObjectif
          key={ouvert.id}
          smsi={smsi}
          objectif={ligne(rObjectifs, ouvert.id)!}
          processus={rProcessus}
          indicateurs={rIndicateurs}
          modifiable={modifiable}
          onClose={() => setOuvert(null)}
          onOpenIndicateur={ouvrirIndicateur}
        />
      )}
      {ouvert?.type === 'indicateur' && ligne(rIndicateurs, ouvert.id) && donnees && (
        <FicheIndicateur
          key={ouvert.id}
          smsi={smsi}
          indicateur={ligne(rIndicateurs, ouvert.id)!}
          objectifs={rObjectifs}
          processus={rProcessus}
          modifiable={modifiable}
          onClose={() => setOuvert(null)}
          automatique={(() => {
            const i = ligne(rIndicateurs, ouvert.id)!;
            const fait = objectifs.flatMap((o) => o.indicateurs).find((x) => x.id === ouvert.id);
            return i.calc && i.auto !== false && fait
              ? `${fait.valeur} (${fait.source})`
              : valeurIndicateur(i, donnees).calcule
                ? 'oui'
                : null;
          })()}
        />
      )}
    </Stack>
  );
}

/* Objectifs, indicateurs et processus du SMSI : interface de l'outil de suivi historique reprise dans le Pilotage
   (vues « Par processus », « Par objectif » et « Vue compacte », ajout, fiches, mesures, tendance, source de la valeur).
   Les états sont calculés par les fonctions partagées testées en parité (packages/shared/src/tableau-de-bord.ts) ;
   les indicateurs « calculés » sont alimentés par les autres modules, aucune valeur n'est estimée. */
import { Badge, Button, Card, Group, Progress, Stack, Table, Tabs, Text } from '@mantine/core';
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
import { useCan } from '../session';
import { useState } from 'react';
import { FicheIndicateur, FicheObjectif, FicheProcessus, texte, useEcriture, type Ligne } from './FichesObjectifs';

const SOCLE = '00000000-0000-4000-8000-000000000001';
const ETATS: Record<EtatIndicateur, [string, string]> = {
  ok: ['Atteint', 'green'],
  ko: ['Non atteint', 'red'],
  na: ['Non mesuré', 'gray'],
  undef: ['Cible à définir', 'orange'],
};

function EtatObjectifs({ etat }: { etat: EtatIndicateur }) {
  return (
    <Badge color={ETATS[etat][1]} variant="light" data-etat={etat}>
      {ETATS[etat][0]}
    </Badge>
  );
}
const jour = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : '–');
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
const PIRE: EtatIndicateur[] = ['ko', 'undef', 'na', 'ok'];
type Ouvert = { type: 'processus' | 'objectif' | 'indicateur'; id: string } | null;

function Tendance({ valeur }: { valeur: IndicateurObjectif['tendance'] }) {
  if (!valeur) return null;
  return (
    <svg
      className="objectifs-tendance"
      data-tendance={valeur}
      viewBox="0 0 16 16"
      role="img"
      aria-label={`Tendance : ${valeur === '↗' ? 'en hausse' : valeur === '↘' ? 'en baisse' : 'stable'}`}
    >
      <path
        d={valeur === '↗' ? 'M3 13 13 3M5 3h8v8' : valeur === '↘' ? 'M3 3 13 13M5 13h8V5' : 'M2 8h12m-4-4 4 4-4 4'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
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
    queryFn: () => get<Record<string, unknown>>('/api/suivi/etat'),
    enabled: smsi === SOCLE,
  });
  const boites = useQuery({
    queryKey: ['grc', smsi, 'legacy-objectifs', 'boites'],
    queryFn: () => get<Boite[]>(`/api/grc/${smsi}/pilotage/boites`),
    enabled: smsi === SOCLE && vue === 'boites',
  });
  if (smsi !== SOCLE) return null;
  const donnees = q.data;
  const objectifs = donnees ? objectifsPilotage(donnees) : [];
  const parProcessus = donnees ? objectifsParProcessus(donnees) : null;
  const synthese = donnees ? indicateursSynthese(donnees) : null;
  const rProcessus = rows(donnees?.processes),
    rObjectifs = rows(donnees?.objectives),
    rIndicateurs = rows(donnees?.indicators);
  const ligne = (liste: Ligne[], id: string) => liste.find((x) => texte(x.id) === id);
  const garde = (i: IndicateurObjectif) => etat === 'all' || i.etat === etat;
  const ajouter = async (cle: 'processes' | 'objectives' | 'indicators', corps: unknown = {}) => {
    const r = await ecrire('POST', cle, corps);
    if (r && typeof r.id === 'string')
      setOuvert({
        type: cle === 'processes' ? 'processus' : cle === 'objectives' ? 'objectif' : 'indicateur',
        id: r.id,
      });
  };
  const ouvrirIndicateur = (id: string) => setOuvert({ type: 'indicateur', id });

  const tableauIndicateurs = (o: ObjectifPilotage) => {
    const lignes = o.indicateurs.filter(garde);
    if (!lignes.length)
      return <Text size="sm">{o.indicateurs.length ? 'Aucun indicateur pour ce filtre.' : 'Aucun indicateur.'}</Text>;
    return (
      <div className="objectifs-table-indicateurs">
        <DataTable label={`Indicateurs de l’objectif ${o.id}`}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Indicateur</Table.Th>
                <Table.Th>Cible</Table.Th>
                <Table.Th>Valeur</Table.Th>
                <Table.Th>État</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lignes.map((i) => (
                <Table.Tr key={i.id}>
                  <Table.Td data-label="Indicateur" className="objectifs-cellule-nom">
                    <Button
                      variant="default"
                      size="compact-sm"
                      className="objectifs-ouvrir"
                      aria-label={`Ouvrir l’indicateur ${i.id}`}
                      onClick={() => ouvrirIndicateur(i.id)}
                    >
                      <span className="objectifs-code">{i.id}</span>
                      <span>{i.nom}</span>
                    </Button>
                    {i.calcule && (
                      <Badge ml="xs" size="sm" variant="light">
                        calculé
                      </Badge>
                    )}
                    {i.categorie === 'satisfaction' && (
                      <Badge ml="xs" size="sm" variant="light" color="encre">
                        satisfaction client
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td data-label="Cible">{i.cible}</Table.Td>
                  <Table.Td data-label="Valeur">
                    <Text span fw={650} className="objectifs-valeur" data-etat={i.etat}>
                      {i.valeur}
                    </Text>{' '}
                    <Tendance valeur={i.tendance} />
                    <Text size="xs" c="dimmed">
                      {i.source ? (i.calcule ? i.source : jour(i.source)) : ''}
                    </Text>
                    {i.historique && (
                      <Text size="xs" c="dimmed">
                        {i.historique.periode} : {i.historique.valeur}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td data-label="État" className="objectifs-cellule-etat">
                    <EtatObjectifs etat={i.etat} />
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
            variant="default"
            size="compact-sm"
            className="objectifs-ouvrir objectifs-titre"
            aria-label={`Ouvrir l’objectif ${o.id}`}
            onClick={() => setOuvert({ type: 'objectif', id: o.id })}
          >
            <span className="objectifs-code">{o.id}</span>
            <span>{o.nom}</span>
          </Button>
          <dl className="objectifs-meta">
            <div>
              <dt>Responsable</dt>
              <dd>{o.responsable || 'À définir'}</dd>
            </div>
            <div>
              <dt>Échéance</dt>
              <dd>{jour(o.echeance)}</dd>
            </div>
          </dl>
        </div>
        <div
          className="objectifs-avancement"
          data-etat={PIRE.find((etat) => o.indicateurs.some((i) => i.etat === etat)) ?? 'na'}
        >
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
          <Card withBorder className="objectifs-kpi neon-cadre-biseau">
            <div>
              <span className="objectifs-repere">Résultats mesurés</span>
              <h3>Indicateurs atteints</h3>
              <Text size="sm" c="dimmed">
                {synthese.atteints} sur {synthese.total} indicateurs
              </Text>
            </div>
            <NeonAnneau
              titre="Indicateurs atteints"
              valeur={synthese.atteints}
              total={synthese.total}
              centre={synthese.total ? `${synthese.atteints}/${synthese.total}` : '—'}
            />
          </Card>
          <Card withBorder className="objectifs-kpi neon-cadre-biseau" data-etat="ko">
            <span className="objectifs-repere">Résultats à suivre</span>
            <h3>Non atteints</h3>
            <strong className="objectifs-kpi-valeur">{synthese.nonAtteints}</strong>
            <Text size="sm" c="dimmed">
              sur {synthese.total} indicateurs
            </Text>
            <Progress
              value={synthese.total ? (synthese.nonAtteints * 100) / synthese.total : 0}
              color="red"
              aria-label={`${synthese.nonAtteints} indicateurs non atteints sur ${synthese.total}`}
            />
          </Card>
          <Card withBorder className="objectifs-kpi neon-cadre-biseau" data-etat="na">
            <span className="objectifs-repere">Mesure et définition</span>
            <h3>À mesurer ou définir</h3>
            <strong className="objectifs-kpi-valeur">{synthese.nonMesures}</strong>
            <Text size="sm" c="dimmed">
              non mesurés ou cible à définir
            </Text>
            <Progress
              value={synthese.total ? (synthese.nonMesures * 100) / synthese.total : 0}
              color="gray"
              aria-label={`${synthese.nonMesures} indicateurs non mesurés ou cible à définir sur ${synthese.total}`}
            />
          </Card>
        </section>
      )}
      {donnees && !objectifs.length && !rProcessus.length && <Text>Aucun processus ni objectif enregistré.</Text>}
      {donnees && (
        <>
          <Group className="objectifs-outils">
            <Filtres actifs={etat === 'all' ? 0 : 1} onReinitialiser={() => setEtat('all')}>
              <Tabs value={etat} onChange={(v) => setEtat(v ?? 'all')} variant="pills">
                <Tabs.List>
                  {[
                    ['all', 'Tous'],
                    ['ok', 'Atteints'],
                    ['ko', 'Non atteints'],
                    ['na', 'Non mesurés'],
                    ['undef', 'Cible à définir'],
                  ].map(([v, l]) => (
                    <Tabs.Tab key={v} value={v!}>
                      {l}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs>
            </Filtres>
            <Group gap="xs" aria-label="Légende des états">
              {(Object.keys(ETATS) as EtatIndicateur[]).map((k) => (
                <EtatObjectifs key={k} etat={k} />
              ))}
            </Group>
          </Group>
          <Text size="xs" c="dimmed">
            Flèches : évolution de la valeur · Couleur du chiffre : comparaison à la cible.
          </Text>
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
            <Tabs.Panel value="boites">
              <Stack>
                <Text size="sm">
                  Une boîte par processus (ISO 9001:2015, 4.4.1 c et 9.1.1) : indicateurs liés par leurs objectifs ou
                  directement, avec leur état, puis ce qui est rattaché au processus dans le registre commun. Ces
                  chiffres aident le pilotage ; ils ne constituent pas un taux de conformité.
                </Text>
                <ErrorAlert error={boites.error} />
                <div className="grc-dashboard-grid">
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
                    const pire = PIRE.find((e) => tous.some((i) => i.etat === e));
                    const b = boites.data?.find((x) => x.ref === `legacy:processes:${id}`);
                    return (
                      <Card
                        key={id}
                        withBorder
                        className="objectifs-boite neon-cadre-biseau"
                        aria-label={`Boîte du processus ${id}`}
                      >
                        <Stack gap="xs">
                          <Group justify="space-between" wrap="nowrap">
                            <Button
                              variant="subtle"
                              size="compact-sm"
                              aria-label={`Ouvrir le processus ${id}`}
                              onClick={() => setOuvert({ type: 'processus', id })}
                            >
                              {id} · {texte(p.name)}
                            </Button>
                            {pire && <EtatObjectifs etat={pire} />}
                          </Group>
                          <Text size="sm" c="dimmed">
                            Pilote : {texte(p.owner) || 'à définir'}
                          </Text>
                          {tous.length ? (
                            tous.map((i) => (
                              <Group key={i.id} justify="space-between" wrap="nowrap" className="objectifs-boite-ligne">
                                <Button
                                  variant="subtle"
                                  size="compact-sm"
                                  aria-label={`Ouvrir l’indicateur ${i.id}`}
                                  onClick={() => ouvrirIndicateur(i.id)}
                                >
                                  {i.nom}
                                </Button>
                                <Text size="sm">
                                  <b className="objectifs-valeur" data-etat={i.etat}>
                                    {i.valeur}
                                  </b>{' '}
                                  <Tendance valeur={i.tendance} /> · {i.cible}
                                </Text>
                                <EtatObjectifs etat={i.etat} />
                              </Group>
                            ))
                          ) : (
                            <Text size="sm">Aucun indicateur pour ce processus.</Text>
                          )}
                          <Group gap="md">
                            <Text size="sm">
                              Actions ouvertes : {b?.actionsOuvertes ?? '–'}
                              {b?.actionsEnRetard ? ` (dont ${b.actionsEnRetard} en retard)` : ''}
                            </Text>
                            <Text size="sm">Risques liés : {b?.risques ?? '–'}</Text>
                            <Text size="sm">Séries récurrentes : {b?.series ?? '–'}</Text>
                            <Text size="sm">
                              Prochaine échéance : {b?.prochaineEcheance ? jour(b.prochaineEcheance) : '–'}
                            </Text>
                          </Group>
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
                      <Card key={p.id} withBorder className="objectifs-processus neon-cadre-biseau">
                        <Stack gap="xs">
                          <Group gap="xs">
                            <Button
                              variant="subtle"
                              size="compact-sm"
                              aria-label={`Ouvrir le processus ${p.id}`}
                              onClick={() => setOuvert({ type: 'processus', id: p.id })}
                            >
                              {p.id}
                            </Button>
                            <Text fw={600}>{p.nom}</Text>
                          </Group>
                          <Text size="sm">
                            Pilote : {p.pilote || 'à définir'} · {pluriel(p.objectifs.length, 'objectif')} ·{' '}
                            {p.atteints} atteint(s), {p.nonAtteints} non atteint(s), {p.aMesurer} à mesurer ou définir
                          </Text>
                          {p.objectifs.map(blocObjectif)}
                        </Stack>
                      </Card>
                    ))}
                    {!!f.sansObjectif.length && (
                      <Group gap="xs">
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
                  <Card withBorder className="objectifs-processus neon-cadre-biseau">
                    <Stack gap="xs">
                      <Text fw={600}>Objectifs sans processus</Text>
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
                    <Card key={o.id} withBorder className="objectifs-carte neon-cadre-biseau">
                      <Stack gap="xs">
                        {blocObjectif(o)}
                        {!!enjeux.length && (
                          <details>
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
                        <Table.Th>Objectif</Table.Th>
                        <Table.Th className="col-p2">Processus</Table.Th>
                        <Table.Th>Indicateurs (valeur · cible)</Table.Th>
                        <Table.Th>Atteints</Table.Th>
                        <Table.Th className="col-p2">Échéance</Table.Th>
                        <Table.Th className="col-p3">Responsable</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {objectifs.map((o) => (
                        <Table.Tr key={o.id}>
                          <Table.Td data-label="Objectif">
                            <Button
                              variant="subtle"
                              size="compact-sm"
                              onClick={() => setOuvert({ type: 'objectif', id: o.id })}
                            >
                              {o.id} · {o.nom}
                            </Button>
                          </Table.Td>
                          <Table.Td className="col-p2" data-label="Processus">
                            {o.processus.join(', ') || '–'}
                          </Table.Td>
                          <Table.Td data-label="Indicateurs">
                            <Stack gap="2xs">
                              {o.indicateurs.filter(garde).map((i) => (
                                <Group key={i.id} gap="xs" wrap="nowrap" className="objectifs-indicateur-resume">
                                  <EtatObjectifs etat={i.etat} />
                                  <Button
                                    variant="subtle"
                                    size="compact-sm"
                                    aria-label={`Ouvrir l’indicateur ${i.id}`}
                                    onClick={() => ouvrirIndicateur(i.id)}
                                  >
                                    {i.id.replace('INDOBJ', '')} {i.nom}
                                    {i.calcule ? ' (auto)' : ''}
                                  </Button>
                                  <Text size="sm">
                                    <b className="objectifs-valeur" data-etat={i.etat}>
                                      {i.valeur}
                                    </b>{' '}
                                    <Tendance valeur={i.tendance} /> · {i.cible}
                                  </Text>
                                  {i.valeur === '–' && i.historique && (
                                    <Text size="xs" c="dimmed">
                                      {i.historique.periode} : {i.historique.valeur}
                                    </Text>
                                  )}
                                </Group>
                              ))}
                            </Stack>
                          </Table.Td>
                          <Table.Td data-label="Atteints">
                            <Progress
                              value={o.indicateurs.length ? (o.atteints * 100) / o.indicateurs.length : 0}
                              aria-label={`${o.atteints} indicateur(s) atteint(s) sur ${o.indicateurs.length}`}
                            />
                            <Text size="xs">
                              {o.atteints}/{o.indicateurs.length}
                            </Text>
                          </Table.Td>
                          <Table.Td className="col-p2" data-label="Échéance">
                            {jour(o.echeance)}
                          </Table.Td>
                          <Table.Td className="col-p3" data-label="Responsable">
                            {o.responsable || '–'}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </DataTable>
              </div>
            </Tabs.Panel>
          </Tabs>
        </>
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

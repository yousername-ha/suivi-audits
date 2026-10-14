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
import { DataTable, StatusChip, type Etat } from '@suivi/ui';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { Filtres } from '../components/Filtres';
import { useCan } from '../session';
import { useState } from 'react';
import { FicheIndicateur, FicheObjectif, FicheProcessus, texte, useEcriture, type Ligne } from './FichesObjectifs';

const SOCLE = '00000000-0000-4000-8000-000000000001';
const ETATS: Record<EtatIndicateur, [string, Etat]> = {
  ok: ['Atteint', 'succes'],
  ko: ['Non atteint', 'erreur'],
  na: ['Non mesuré', 'neutre'],
  undef: ['Cible à définir', 'attention'],
};
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

export function ObjectifsProcessus({ smsi, vue: vueInitiale = 'processus' }: { smsi: string; vue?: Vue }) {
  const can = useCan(),
    modifiable = can('pilotage', 'modifier'),
    [vue, setVue] = useState<Vue>(vueInitiale),
    [ouvert, setOuvert] = useState<Ouvert>(null),
    [etat, setEtat] = useState('all'),
    { ecrire, erreur } = useEcriture(smsi);
  const q = useQuery({
    queryKey: ['grc', smsi, 'legacy-objectifs'],
    queryFn: () => get<Record<string, unknown>>('/api/legacy/state'),
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
      <DataTable label={`Indicateurs de l’objectif ${o.id}`}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="col-p3">Code</Table.Th>
              <Table.Th>Indicateur</Table.Th>
              <Table.Th className="col-p2">Cible</Table.Th>
              <Table.Th>Valeur</Table.Th>
              <Table.Th>État</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lignes.map((i) => (
              <Table.Tr key={i.id}>
                <Table.Td className="col-p3">
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    aria-label={`Ouvrir l’indicateur ${i.id}`}
                    onClick={() => ouvrirIndicateur(i.id)}
                  >
                    {i.id}
                  </Button>
                </Table.Td>
                <Table.Td>
                  {i.nom}
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
                <Table.Td className="col-p2">{i.cible}</Table.Td>
                <Table.Td>
                  <Text span fw={700}>
                    {i.valeur}
                  </Text>{' '}
                  {i.tendance}
                  <Text size="xs" c="dimmed">
                    {i.source ? (i.calcule ? i.source : jour(i.source)) : ''}
                  </Text>
                  {i.historique && (
                    <Text size="xs" c="dimmed">
                      {i.historique.periode} : {i.historique.valeur}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <StatusChip etat={ETATS[i.etat][1]}>{ETATS[i.etat][0]}</StatusChip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataTable>
    );
  };
  const blocObjectif = (o: ObjectifPilotage) => (
    <Stack key={o.id} gap="xs">
      <Group gap="xs">
        <Button
          variant="subtle"
          size="compact-sm"
          aria-label={`Ouvrir l’objectif ${o.id}`}
          onClick={() => setOuvert({ type: 'objectif', id: o.id })}
        >
          {o.id}
        </Button>
        <Text fw={600}>{o.nom}</Text>
        <Text size="sm" c="dimmed">
          Échéance {jour(o.echeance)} · {o.responsable || 'responsable à définir'}
        </Text>
      </Group>
      {tableauIndicateurs(o)}
    </Stack>
  );

  return (
    <Stack>
      <Group justify="space-between">
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
        <Group gap="lg" aria-label="Synthèse des indicateurs">
          <div>
            <Text fw={700} size="xl">
              {synthese.atteints}/{synthese.total}
            </Text>
            <Text size="sm">indicateurs atteints</Text>
          </div>
          <div>
            <Text fw={700} size="xl">
              {synthese.nonAtteints}
            </Text>
            <Text size="sm">non atteints</Text>
          </div>
          <div>
            <Text fw={700} size="xl">
              {synthese.nonMesures}
            </Text>
            <Text size="sm">non mesurés ou cible à définir</Text>
          </div>
        </Group>
      )}
      {donnees && !objectifs.length && !rProcessus.length && <Text>Aucun processus ni objectif enregistré.</Text>}
      {donnees && (
        <>
          <Group>
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
                <StatusChip key={k} etat={ETATS[k][1]}>
                  {ETATS[k][0]}
                </StatusChip>
              ))}
            </Group>
          </Group>
          <Tabs value={vue} onChange={(v) => setVue((v as Vue) ?? 'processus')} keepMounted={false}>
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
                      <Card key={id} withBorder aria-label={`Boîte du processus ${id}`}>
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
                            {pire && <StatusChip etat={ETATS[pire][1]}>{ETATS[pire][0]}</StatusChip>}
                          </Group>
                          <Text size="sm" c="dimmed">
                            Pilote : {texte(p.owner) || 'à définir'}
                          </Text>
                          {tous.length ? (
                            tous.map((i) => (
                              <Group key={i.id} justify="space-between" wrap="nowrap">
                                <Button
                                  variant="subtle"
                                  size="compact-sm"
                                  aria-label={`Ouvrir l’indicateur ${i.id}`}
                                  onClick={() => ouvrirIndicateur(i.id)}
                                >
                                  {i.nom}
                                </Button>
                                <Text size="sm">
                                  <b>{i.valeur}</b> {i.tendance} · {i.cible}
                                </Text>
                                <StatusChip etat={ETATS[i.etat][1]}>{ETATS[i.etat][0]}</StatusChip>
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
                    <Text fw={600}>
                      {f.famille === 'Autres' ? 'Processus non classés' : `Processus de ${f.famille.toLowerCase()}`}
                    </Text>
                    {f.avecObjectif.map((p) => (
                      <Card key={p.id} withBorder>
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
                  <Card withBorder>
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
                    <Card key={o.id} withBorder>
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
                        <Table.Td>
                          <Button
                            variant="subtle"
                            size="compact-sm"
                            onClick={() => setOuvert({ type: 'objectif', id: o.id })}
                          >
                            {o.id} · {o.nom}
                          </Button>
                        </Table.Td>
                        <Table.Td className="col-p2">{o.processus.join(', ') || '–'}</Table.Td>
                        <Table.Td>
                          <Stack gap="2xs">
                            {o.indicateurs.filter(garde).map((i) => (
                              <Group key={i.id} gap="xs" wrap="nowrap">
                                <StatusChip etat={ETATS[i.etat][1]}>{ETATS[i.etat][0]}</StatusChip>
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
                                  <b>{i.valeur}</b> {i.tendance} · {i.cible}
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
                        <Table.Td>
                          <Progress
                            value={o.indicateurs.length ? (o.atteints * 100) / o.indicateurs.length : 0}
                            aria-label={`${o.atteints} indicateur(s) atteint(s) sur ${o.indicateurs.length}`}
                          />
                          <Text size="xs">
                            {o.atteints}/{o.indicateurs.length}
                          </Text>
                        </Table.Td>
                        <Table.Td className="col-p2">{jour(o.echeance)}</Table.Td>
                        <Table.Td className="col-p3">{o.responsable || '–'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </DataTable>
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

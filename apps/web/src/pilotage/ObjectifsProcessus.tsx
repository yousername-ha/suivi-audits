/* Objectifs du SMSI par processus (lot U2) : vues « Par processus » et « Vue compacte » de l'onglet Pilotage de
   l'outil historique, relues depuis sa source (aucune copie). Les états des indicateurs sont calculés par les fonctions
   partagées testées en parité (packages/shared/src/tableau-de-bord.ts). La saisie reste dans les registres ci-dessous
   ou dans l'outil historique. */
import { Anchor, Card, Group, Stack, Table, Tabs, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { objectifsParProcessus, objectifsPilotage, type EtatIndicateur, type ObjectifPilotage } from '@suivi/shared';
import { DataTable, StatusChip, type Etat } from '@suivi/ui';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { lienHistorique } from '../pilotage-navigation';

const SOCLE = '00000000-0000-4000-8000-000000000001';
const ETATS: Record<EtatIndicateur, [string, Etat]> = {
  ok: ['Atteint', 'succes'],
  ko: ['Non atteint', 'erreur'],
  na: ['Non mesuré', 'neutre'],
  undef: ['Cible à définir', 'attention'],
};
const jour = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : '–');
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

function Indicateurs({ objectif }: { objectif: ObjectifPilotage }) {
  if (!objectif.indicateurs.length) return <Text size="sm">Aucun indicateur.</Text>;
  return (
    <DataTable label={`Indicateurs de l’objectif ${objectif.id}`}>
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
        {objectif.indicateurs.map((i) => (
          <Table.Tr key={i.id}>
            <Table.Td className="col-p3">{i.id}</Table.Td>
            <Table.Td>
              {i.nom}
              {i.calcule ? ' (calculé)' : ''}
            </Table.Td>
            <Table.Td className="col-p2">{i.cible}</Table.Td>
            <Table.Td>{i.valeur}</Table.Td>
            <Table.Td>
              <StatusChip etat={ETATS[i.etat][1]}>{ETATS[i.etat][0]}</StatusChip>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </DataTable>
  );
}

function Objectif({ objectif }: { objectif: ObjectifPilotage }) {
  return (
    <Stack gap="xs">
      <Text fw={600}>
        {objectif.id} · {objectif.nom}
      </Text>
      <Text size="sm">
        Échéance {jour(objectif.echeance)} · {objectif.responsable || 'responsable à définir'}
      </Text>
      <Indicateurs objectif={objectif} />
    </Stack>
  );
}

export function ObjectifsProcessus({ smsi }: { smsi: string }) {
  const q = useQuery({
    queryKey: ['grc', smsi, 'legacy-objectifs'],
    queryFn: () => get<Record<string, unknown>>('/api/legacy/state'),
    enabled: smsi === SOCLE,
  });
  if (smsi !== SOCLE) return null;
  const vue = q.data ? objectifsParProcessus(q.data) : null;
  const objectifs = q.data ? objectifsPilotage(q.data) : [];
  return (
    <Card withBorder>
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>Objectifs de sécurité et indicateurs de l’outil de suivi</Text>
          <Anchor href={lienHistorique({ onglet: 'pilotage', vue: 'pilView=proc' })}>
            Modifier dans l’outil historique
          </Anchor>
        </Group>
        <Text size="sm">
          Lecture directe des processus, objectifs et indicateurs historiques. Les indicateurs « calculés » sont
          alimentés par les autres modules ; aucune valeur n’est estimée.
        </Text>
        <ErrorAlert error={q.error} />
        {vue && !objectifs.length && <Text>Aucun objectif enregistré dans l’outil de suivi.</Text>}
        {vue && !!objectifs.length && (
          <Tabs defaultValue="processus" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="processus">Par processus</Tabs.Tab>
              <Tabs.Tab value="compacte">Vue compacte</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="processus">
              <Stack>
                {vue.familles.map((f) => (
                  <Stack key={f.famille} gap="xs">
                    <Text fw={600}>
                      {f.famille === 'Autres' ? 'Processus non classés' : `Processus de ${f.famille.toLowerCase()}`}
                    </Text>
                    {f.avecObjectif.map((p) => (
                      <Card key={p.id} withBorder>
                        <Stack gap="xs">
                          <Text fw={600}>
                            {p.id} · {p.nom}
                          </Text>
                          <Text size="sm">
                            Pilote : {p.pilote || 'à définir'} · {pluriel(p.objectifs.length, 'objectif')} ·{' '}
                            {p.atteints} atteint(s), {p.nonAtteints} non atteint(s), {p.aMesurer} à mesurer ou définir
                          </Text>
                          {p.objectifs.map((o) => (
                            <Objectif key={o.id} objectif={o} />
                          ))}
                        </Stack>
                      </Card>
                    ))}
                    {!!f.sansObjectif.length && (
                      <Text size="sm">
                        Sans objectif de sécurité rattaché : {f.sansObjectif.map((p) => `${p.id} ${p.nom}`).join(', ')}
                      </Text>
                    )}
                  </Stack>
                ))}
                {!!vue.sansProcessus.length && (
                  <Card withBorder>
                    <Stack gap="xs">
                      <Text fw={600}>Objectifs sans processus</Text>
                      {vue.sansProcessus.map((o) => (
                        <Objectif key={o.id} objectif={o} />
                      ))}
                    </Stack>
                  </Card>
                )}
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="compacte">
              <DataTable label="Objectifs, vue compacte">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Objectif</Table.Th>
                    <Table.Th className="col-p2">Processus</Table.Th>
                    <Table.Th>Atteints</Table.Th>
                    <Table.Th className="col-p2">Échéance</Table.Th>
                    <Table.Th className="col-p3">Responsable</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {objectifs.map((o) => (
                    <Table.Tr key={o.id}>
                      <Table.Td>
                        {o.id} · {o.nom}
                      </Table.Td>
                      <Table.Td className="col-p2">{o.processus.join(', ') || '–'}</Table.Td>
                      <Table.Td>
                        {o.atteints}/{o.indicateurs.length}
                      </Table.Td>
                      <Table.Td className="col-p2">{jour(o.echeance)}</Table.Td>
                      <Table.Td className="col-p3">{o.responsable || '–'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </DataTable>
            </Tabs.Panel>
          </Tabs>
        )}
      </Stack>
    </Card>
  );
}

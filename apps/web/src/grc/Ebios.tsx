/* Études EBIOS RM (lot U3, ADR 0027) : liste des études, puis une étude par atelier. Chaque élément est un objet
   typé rattaché à l'étude ; la validation d'un atelier est une décision tracée ; un scénario opérationnel donne un
   risque du registre avec sa filiation. Démarche inspirée du guide de l'ANSSI, sans conformité revendiquée. */
import { Alert, Badge, Button, Card, Group, Stack, Table, Tabs, Text } from '@mantine/core';
import {
  ECHELLE_GRAVITE,
  ECHELLE_VRAISEMBLANCE,
  GRC_LABELS,
  type GrcKind,
  type GrcObject,
  type PilotageRecord,
} from '@suivi/shared';
import { DataTable, StatusChip } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';

interface ObjetEtude {
  id: string;
  kind: GrcKind;
  name: string;
  version: number;
  data: Record<string, unknown>;
  calcul: { menace?: number | null; graviteProposee?: number | null };
}
interface VueEtude {
  etude: GrcObject;
  ateliers: {
    id: string;
    label: string;
    aide: string;
    kinds: GrcKind[];
    objets: ObjetEtude[];
    valide: boolean;
    validations: { step: string; result: string; date: string; by: string; sourceVersion: number }[];
  }[];
}

const niveau = (v: unknown, echelle: readonly string[]) =>
  typeof v === 'number' && v >= 1 && v <= 4 ? `${v} — ${echelle[v - 1]}` : '—';

/** Colonnes de synthèse propres à chaque type d'élément. */
function resume(o: ObjetEtude, noms: Map<string, string>) {
  const nom = (r: unknown) => (typeof r === 'string' ? (noms.get(r) ?? 'Élément lié') : '—');
  const liste = (v: unknown) => (Array.isArray(v) && v.length ? v.map(nom).join(', ') : '—');
  switch (o.kind) {
    case 'feared_event':
      return `Gravité ${niveau(o.data.gravity, ECHELLE_GRAVITE)} · valeur métier : ${nom(o.data.businessAssetRef)}`;
    case 'sr_ov':
      return `${o.data.retained ? 'Retenu' : 'Non retenu'} · source : ${nom(o.data.sourceRef)}`;
    case 'ecosystem_party':
      return o.calcul.menace == null
        ? 'Indice de menace : critères à compléter'
        : `Indice de menace : ${o.calcul.menace}`;
    case 'strategic_scenario':
      return `Gravité ${niveau(o.data.gravity, ECHELLE_GRAVITE)}${
        o.calcul.graviteProposee ? ` (proposée : ${niveau(o.calcul.graviteProposee, ECHELLE_GRAVITE)})` : ''
      } · couple : ${nom(o.data.srOvRef)}`;
    case 'operational_scenario':
      return `Vraisemblance ${niveau(o.data.likelihood, ECHELLE_VRAISEMBLANCE)} · scénario : ${nom(o.data.strategicScenarioRef)}`;
    case 'support_asset':
      return `Valeurs métier : ${liste(o.data.businessAssetRefs)}`;
    case 'business_asset':
      return String(o.data.mission ?? '') || '—';
    case 'treatment':
      return `Risques traités : ${liste(o.data.riskRefs)}`;
    case 'risk':
      return `Option : ${String(o.data.strategy ?? '—')}`;
    default:
      return String(o.data.description ?? '') || '—';
  }
}

/** Matrice gravité × vraisemblance des scénarios opérationnels de l'étude (gravité du scénario stratégique). */
function Matrice({ vue }: { vue: VueEtude }) {
  const tous = vue.ateliers.flatMap((a) => a.objets);
  const parRef = new Map(tous.map((o) => ['object:' + o.id, o]));
  const cases = new Map<string, string[]>();
  for (const o of tous.filter((x) => x.kind === 'operational_scenario')) {
    const s = parRef.get(String(o.data.strategicScenarioRef ?? ''));
    const g = typeof s?.data.gravity === 'number' ? s.data.gravity : null;
    const v = typeof o.data.likelihood === 'number' ? o.data.likelihood : null;
    if (g && v) cases.set(`${g}-${v}`, [...(cases.get(`${g}-${v}`) ?? []), o.name]);
  }
  if (!cases.size)
    return (
      <Text size="sm">
        La matrice apparaît dès qu’un scénario opérationnel a une vraisemblance et un scénario stratégique gradué.
      </Text>
    );
  return (
    <DataTable label="Scénarios opérationnels par gravité et vraisemblance">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Gravité \ vraisemblance</Table.Th>
            {ECHELLE_VRAISEMBLANCE.map((l, i) => (
              <Table.Th key={l}>{`V${i + 1}`}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[4, 3, 2, 1].map((g) => (
            <Table.Tr key={g}>
              <Table.Th scope="row">{`G${g} — ${ECHELLE_GRAVITE[g - 1]}`}</Table.Th>
              {[1, 2, 3, 4].map((v) => (
                <Table.Td key={v}>{(cases.get(`${g}-${v}`) ?? []).join(', ')}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

export function EtudesEbios({
  smsi,
  onOpen,
  onCreate,
  onCreateRisk,
  onDecision,
}: {
  smsi: string;
  onOpen: (o: GrcObject) => void;
  onCreate: (kind: GrcKind, initial?: Record<string, unknown>) => void;
  onCreateRisk: (name: string, data: Record<string, unknown>) => void;
  onDecision: (o: GrcObject, operation: PilotageRecord['operation'], step?: string) => void;
}) {
  const can = useCan();
  const [choisie, setChoisie] = useState<string | null>(null);
  const etudes = useQuery({
    queryKey: ['grc', smsi, 'objects', 'risk_study'],
    queryFn: () => get<{ items: GrcObject[] }>(`/api/grc/${smsi}/objects?kind=risk_study`),
  });
  const vue = useQuery({
    queryKey: ['grc', smsi, 'risk-study', choisie],
    queryFn: () => get<VueEtude>(`/api/grc/${smsi}/risk-studies/${choisie}`),
    enabled: !!choisie,
  });
  const ouvrir = async (id: string) => onOpen(await get<GrcObject>(`/api/grc/${smsi}/objects/${id}`));
  const modifier = can('pilotage', 'modifier');
  if (!choisie)
    return (
      <Stack>
        <Alert>
          Démarche inspirée de la méthode EBIOS Risk Manager (guide de l’ANSSI) : cinq ateliers, des éléments reliés et
          des décisions tracées. L’outil ne délivre aucune attestation de conformité.
        </Alert>
        <ErrorAlert error={etudes.error} />
        {modifier && (
          <Group>
            <Button onClick={() => onCreate('risk_study')}>Nouvelle étude</Button>
          </Group>
        )}
        {etudes.data && !etudes.data.items.length && <Text>Aucune étude pour ce périmètre.</Text>}
        <div className="grc-dashboard-grid">
          {etudes.data?.items.map((e) => (
            <Card key={e.id} withBorder>
              <Stack gap="xs">
                <Text fw={600}>{e.name}</Text>
                <Text size="sm">{String(e.data.objective ?? '') || 'Objet de l’étude à préciser.'}</Text>
                <Group>
                  <Button size="xs" onClick={() => setChoisie(e.id)}>
                    Ouvrir l’étude
                  </Button>
                  <Button size="xs" variant="default" onClick={() => onOpen(e)}>
                    Fiche
                  </Button>
                </Group>
              </Stack>
            </Card>
          ))}
        </div>
      </Stack>
    );
  const v = vue.data;
  const noms = new Map((v?.ateliers ?? []).flatMap((a) => a.objets.map((o) => ['object:' + o.id, o.name] as const)));
  const etudeRef = 'object:' + choisie;
  return (
    <Stack>
      <Group>
        <Button variant="default" onClick={() => setChoisie(null)}>
          Toutes les études
        </Button>
        {v && (
          <Button variant="light" onClick={() => onOpen(v.etude)}>
            Fiche de l’étude
          </Button>
        )}
      </Group>
      <ErrorAlert error={vue.error} />
      {v && (
        <>
          <Text fw={600}>{v.etude.name}</Text>
          <Group gap="xs">
            {v.ateliers.map((a) => (
              <Badge key={a.id} variant={a.valide ? 'filled' : 'light'} color={a.valide ? 'suivi' : 'gray'}>
                {a.id.toUpperCase()} {a.valide ? 'validé' : 'en cours'}
              </Badge>
            ))}
          </Group>
          <Tabs defaultValue="a1" keepMounted={false}>
            <Tabs.List>
              {v.ateliers.map((a) => (
                <Tabs.Tab key={a.id} value={a.id}>
                  {a.label.replace(/^Atelier (\d) — /, '$1. ')}
                </Tabs.Tab>
              ))}
              <Tabs.Tab value="matrice">Matrice</Tabs.Tab>
            </Tabs.List>
            {v.ateliers.map((a) => (
              <Tabs.Panel key={a.id} value={a.id} pt="md">
                <Stack>
                  <Text size="sm">{a.aide}</Text>
                  {modifier && (
                    <Group>
                      {a.kinds.map((k) => (
                        <Button key={k} size="xs" variant="light" onClick={() => onCreate(k, { studyRef: etudeRef })}>
                          {`Ajouter : ${GRC_LABELS[k]}`}
                        </Button>
                      ))}
                    </Group>
                  )}
                  {a.objets.length ? (
                    <DataTable label={a.label}>
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Élément</Table.Th>
                            <Table.Th>Type</Table.Th>
                            <Table.Th>Synthèse</Table.Th>
                            <Table.Th>Actions</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {a.objets.map((o) => (
                            <Table.Tr key={o.id}>
                              <Table.Td>{o.name}</Table.Td>
                              <Table.Td>{GRC_LABELS[o.kind]}</Table.Td>
                              <Table.Td>{resume(o, noms)}</Table.Td>
                              <Table.Td>
                                <Group gap="xs" wrap="nowrap">
                                  <Button size="xs" variant="default" onClick={() => void ouvrir(o.id)}>
                                    Ouvrir
                                  </Button>
                                  {o.kind === 'operational_scenario' && modifier && (
                                    <Button
                                      size="xs"
                                      variant="light"
                                      onClick={() =>
                                        onCreateRisk('Risque : ' + o.name, {
                                          studyRef: etudeRef,
                                          scenarioRef: 'object:' + o.id,
                                          description: String(o.data.attackSequence ?? ''),
                                        })
                                      }
                                    >
                                      Créer le risque
                                    </Button>
                                  )}
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </DataTable>
                  ) : (
                    <Text size="sm">Aucun élément dans cet atelier.</Text>
                  )}
                  <Group>
                    {a.valide ? (
                      <StatusChip etat="succes">Atelier validé</StatusChip>
                    ) : (
                      can('pilotage', 'administrer') && (
                        <Button size="xs" onClick={() => onDecision(v.etude, 'step_validation', a.id)}>
                          Valider l’atelier
                        </Button>
                      )
                    )}
                    {a.validations.map((x, i) => (
                      <Text key={i} size="xs" c="dimmed">
                        Validé le {x.date} par {x.by}
                        {x.sourceVersion !== v.etude.version ? ' (version antérieure de l’étude)' : ''}
                      </Text>
                    ))}
                  </Group>
                </Stack>
              </Tabs.Panel>
            ))}
            <Tabs.Panel value="matrice" pt="md">
              <Matrice vue={v} />
            </Tabs.Panel>
          </Tabs>
        </>
      )}
    </Stack>
  );
}

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { EnvironmentDefinition, type EnvironmentVersion, type RiskExample, type calculateRisk } from '@suivi/shared';
import { ConfirmDialog } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, get } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';
import { useCan } from '../session';

type History = Omit<EnvironmentVersion, 'definition'>;
type Preview = { version: number; previewId: string; changed: boolean; calculation: ReturnType<typeof calculateRisk> };
const baseUrl = '/api/admin/environment';
const key = ['admin', 'environment'];
export function EnvironmentPanel() {
  const q = useQuery({ queryKey: key, queryFn: () => get<EnvironmentVersion>(baseUrl) });
  return (
    <>
      <ErrorAlert error={q.error} />
      {q.data && <Editor current={q.data} />}
    </>
  );
}

function Editor({ current }: { current: EnvironmentVersion }) {
  const canWrite = useCan()('administration', 'administrer');
  const qc = useQueryClient();
  const history = useQuery({ queryKey: [...key, 'history'], queryFn: () => get<History[]>(`${baseUrl}/history`) });
  const [base, setBase] = useState(current);
  const [draft, setDraft] = useState(() => EnvironmentDefinition.parse(current.definition));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [reload, setReload] = useState(false);
  const [replacement, setReplacement] = useState<number | null>(null);
  const [past, setPast] = useState<EnvironmentVersion | null>(null);
  const [example, setExample] = useState<RiskExample>({
    impact: draft.impact[0]!.id,
    probability: draft.probability[0]!.id,
    maturity: draft.maturity[0]!.id,
  });
  const scenario = Object.fromEntries(
    (['impact', 'probability', 'maturity'] as const).map((k) => [
      k,
      draft[k].some((l) => l.id === example[k]) ? example[k] : draft[k][0]!.id,
    ]),
  ) as RiskExample;
  const stale = base.version !== current.version;
  const dirty = JSON.stringify(EnvironmentDefinition.parse(base.definition)) !== JSON.stringify(draft);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [dirty]);
  const edit = (next: EnvironmentDefinition) => {
    if (next.calculation.method === 'matrix') {
      next = {
        ...next,
        calculation: {
          ...next.calculation,
          cells: next.impact.flatMap((i) =>
            next.probability.map((p) => ({
              impact: i.id,
              probability: p.id,
              score:
                next.calculation.cells.find((c) => c.impact === i.id && c.probability === p.id)?.score ??
                Math.min(i.value * p.value, next.calculation.ceiling),
            })),
          ),
        },
      };
    }
    setDraft(next);
    setPreview(null);
    setConfirmation('');
    setError(null);
  };
  const simulate = async () => {
    setBusy(true);
    setError(null);
    setPreview(null);
    setConfirmation('');
    try {
      setPreview(await api<Preview>('POST', `${baseUrl}/preview`, { body: { definition: draft, example: scenario } }));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api<EnvironmentVersion>('PUT', baseUrl, {
        ifMatch: base.version,
        body: { definition: draft, previewId: preview.previewId, reason, confirm: confirmation },
      });
      setBase(next);
      setDraft(EnvironmentDefinition.parse(next.definition));
      setPreview(null);
      setReason('');
      setConfirmation('');
      qc.setQueryData(key, next);
      await qc.invalidateQueries({ queryKey: [...key, 'history'] });
      notifications.show({ color: 'teal', message: `Configuration : version ${next.version} publiée.` });
    } catch (e) {
      setError(e);
      setPreview(null);
      setConfirmation('');
      await qc.invalidateQueries({ queryKey: key });
    } finally {
      setBusy(false);
    }
  };
  const prepareVersion = async (version: number) => {
    setBusy(true);
    setError(null);
    try {
      const past = await get<EnvironmentVersion>(`${baseUrl}/versions/${version}`);
      edit(EnvironmentDefinition.parse(past.definition));
      setReason(`Reprise de la définition de la version ${version}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const inspectVersion = async (version: number) => {
    setBusy(true);
    setError(null);
    try {
      setPast(await get<EnvironmentVersion>(`${baseUrl}/versions/${version}`));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const disabled = !canWrite || busy;
  const bands = draft.criticality;
  return (
    <Stack>
      <Title order={2} size="h3">
        Configuration de l’environnement
      </Title>
      <Text size="sm">
        Échelles et matrice pour de nouveaux usages. Les évaluations et calculs de l’outil historique restent inchangés.
        Ce simulateur ne crée pas d’évaluation métier.
      </Text>
      <Group>
        <Badge variant="light">Version publiée : {current.version}</Badge>
        {dirty && <Badge variant="light">Brouillon non publié</Badge>}
      </Group>
      {!canWrite && <Alert color="blue">Consultation seule : la publication exige le droit d’administrer.</Alert>}
      {stale && (
        <Alert color="orange">
          Une nouvelle version a été publiée ailleurs. Votre brouillon est conservé ; rechargez avant de publier.
          <Button variant="subtle" onClick={() => setReload(true)}>
            Recharger la version publiée
          </Button>
        </Alert>
      )}
      <ErrorAlert error={error || history.error} />
      <Card withBorder>
        <Stack>
          <TextInput
            label="Nom de la configuration"
            value={draft.name}
            maxLength={100}
            disabled={disabled}
            onChange={(e) => edit({ ...draft, name: e.currentTarget.value })}
          />
          <Tabs defaultValue="impact" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="impact">Impact</Tabs.Tab>
              <Tabs.Tab value="probability">Probabilité</Tabs.Tab>
              <Tabs.Tab value="maturity">Maturité</Tabs.Tab>
              <Tabs.Tab value="criticality">Criticité</Tabs.Tab>
              <Tabs.Tab value="matrix">Calcul et matrice</Tabs.Tab>
            </Tabs.List>
            {(['impact', 'probability'] as const).map((k) => (
              <Tabs.Panel key={k} value={k} pt="md">
                <Levels
                  title={k === 'impact' ? 'Impact' : 'Probabilité'}
                  items={draft[k]}
                  max={10}
                  disabled={disabled}
                  onChange={(items) => edit({ ...draft, [k]: items })}
                />
              </Tabs.Panel>
            ))}
            <Tabs.Panel value="maturity" pt="md">
              <Levels
                title="Maturité"
                items={draft.maturity.map((l) => ({ id: l.id, label: l.label, value: l.reduction }))}
                valueLabel="Réduction du risque (%)"
                max={100}
                disabled={disabled}
                onChange={(items) =>
                  edit({ ...draft, maturity: items.map((l) => ({ id: l.id, label: l.label, reduction: l.value })) })
                }
              />
            </Tabs.Panel>
            <Tabs.Panel value="criticality" pt="md">
              <Stack>
                <Text size="sm">
                  Le premier seuil est zéro. Chaque niveau s’applique dès son seuil, jusqu’au seuil suivant.
                </Text>
                {bands.map((l, i) => (
                  <Card withBorder key={i}>
                    <Stack>
                      <TextInput
                        label={`Libellé de criticité ${i + 1}`}
                        value={l.label}
                        disabled={disabled}
                        maxLength={100}
                        onChange={(e) =>
                          edit({
                            ...draft,
                            criticality: bands.map((x, j) => (j === i ? { ...x, label: e.currentTarget.value } : x)),
                          })
                        }
                      />
                      <Group grow>
                        <TextInput
                          label="Identifiant"
                          value={l.id}
                          disabled={disabled}
                          onChange={(e) =>
                            edit({
                              ...draft,
                              criticality: bands.map((x, j) => (j === i ? { ...x, id: e.currentTarget.value } : x)),
                            })
                          }
                        />
                        <NumberInput
                          label="Seuil inclus"
                          min={0}
                          max={100}
                          value={l.minimum}
                          disabled={disabled}
                          onChange={(v) =>
                            edit({
                              ...draft,
                              criticality: bands.map((x, j) => (j === i ? { ...x, minimum: Number(v) || 0 } : x)),
                            })
                          }
                        />
                        <Select
                          label="Intensité visuelle"
                          value={l.tone}
                          allowDeselect={false}
                          disabled={disabled}
                          data={[
                            { value: 'neutral', label: 'Neutre' },
                            { value: 'low', label: 'Faible' },
                            { value: 'medium', label: 'Modérée' },
                            { value: 'high', label: 'Élevée' },
                          ]}
                          onChange={(v) =>
                            edit({
                              ...draft,
                              criticality: bands.map((x, j) => (j === i ? { ...x, tone: v as typeof l.tone } : x)),
                            })
                          }
                        />
                      </Group>
                      <Button
                        variant="subtle"
                        disabled={disabled || bands.length <= 2}
                        onClick={() => edit({ ...draft, criticality: bands.filter((_, j) => j !== i) })}
                      >
                        Retirer le niveau {i + 1}
                      </Button>
                    </Stack>
                  </Card>
                ))}
                <Button
                  variant="light"
                  disabled={disabled || bands.length >= 10}
                  onClick={() =>
                    edit({
                      ...draft,
                      criticality: [
                        ...bands,
                        {
                          id: `level_${crypto.randomUUID().slice(0, 8)}`,
                          label: 'Nouveau niveau',
                          minimum: Math.min(100, bands[bands.length - 1]!.minimum + 1),
                          tone: 'neutral',
                        },
                      ],
                    })
                  }
                >
                  Ajouter un niveau de criticité
                </Button>
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="matrix" pt="md">
              <Stack>
                <Select
                  label="Règle de calcul"
                  value={draft.calculation.method}
                  disabled={disabled}
                  allowDeselect={false}
                  data={[
                    { value: 'product', label: 'Impact × probabilité' },
                    { value: 'sum', label: 'Impact + probabilité' },
                    { value: 'matrix', label: 'Matrice explicite' },
                  ]}
                  onChange={(v) =>
                    edit({
                      ...draft,
                      calculation: {
                        ...draft.calculation,
                        method: v as EnvironmentDefinition['calculation']['method'],
                        cells: [],
                      },
                    })
                  }
                />
                <NumberInput
                  label="Plafond du risque initial"
                  min={1}
                  max={100}
                  value={draft.calculation.ceiling}
                  disabled={disabled}
                  onChange={(v) => edit({ ...draft, calculation: { ...draft.calculation, ceiling: Number(v) || 1 } })}
                />
                <Text size="sm">
                  Le risque initial est plafonné, puis réduit selon la maturité. Le risque résiduel est arrondi au
                  dixième avant classement. Aucune formule libre n’est exécutée.
                </Text>
                {draft.calculation.method === 'matrix' &&
                  draft.impact.map((i) => (
                    <Card key={i.id} withBorder>
                      <Stack>
                        <Text fw={600}>Impact : {i.label}</Text>
                        {draft.probability.map((p) => (
                          <NumberInput
                            key={p.id}
                            label={`Probabilité : ${p.label}`}
                            min={0}
                            max={100}
                            value={
                              draft.calculation.cells.find((c) => c.impact === i.id && c.probability === p.id)?.score ??
                              0
                            }
                            disabled={disabled}
                            onChange={(v) =>
                              edit({
                                ...draft,
                                calculation: {
                                  ...draft.calculation,
                                  cells: draft.calculation.cells.map((c) =>
                                    c.impact === i.id && c.probability === p.id ? { ...c, score: Number(v) || 0 } : c,
                                  ),
                                },
                              })
                            }
                          />
                        ))}
                      </Stack>
                    </Card>
                  ))}
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Card>
      <Card withBorder>
        <Stack>
          <Title order={3} size="h4">
            Simulation et publication
          </Title>
          <Group grow>
            {(['impact', 'probability', 'maturity'] as const).map((k) => (
              <Select
                key={k}
                label={
                  {
                    impact: 'Impact du scénario',
                    probability: 'Probabilité du scénario',
                    maturity: 'Maturité du scénario',
                  }[k]
                }
                value={scenario[k]}
                data={draft[k].map((l) => ({ value: l.id, label: l.label }))}
                allowDeselect={false}
                disabled={disabled}
                onChange={(v) => {
                  setExample({ ...scenario, [k]: v! });
                  setPreview(null);
                  setConfirmation('');
                }}
              />
            ))}
          </Group>
          {canWrite && (
            <Button variant="light" loading={busy} onClick={() => void simulate()}>
              Valider et simuler le brouillon
            </Button>
          )}
          {preview && (
            <>
              <Alert color="blue">
                Risque initial : {preview.calculation.initial} — réduction : {preview.calculation.reduction} % — risque
                résiduel : {preview.calculation.residual} — {preview.calculation.criticality.label}. Version de départ :{' '}
                {preview.version}. Aucun enregistrement métier modifié.
              </Alert>
              {!preview.changed && <Text size="sm">La définition est identique à la version publiée.</Text>}
            </>
          )}
          {canWrite && (
            <>
              <Textarea
                label="Motif de publication"
                description="Obligatoire, de 5 à 1 000 caractères."
                value={reason}
                maxLength={1000}
                disabled={busy}
                onChange={(e) => setReason(e.currentTarget.value)}
              />
              <TextInput
                label="Saisissez PUBLIER pour confirmer"
                value={confirmation}
                disabled={busy || !preview?.changed || stale}
                onChange={(e) => setConfirmation(e.currentTarget.value)}
              />
              <Button
                loading={busy}
                disabled={
                  !preview?.changed ||
                  stale ||
                  preview.version !== base.version ||
                  confirmation !== 'PUBLIER' ||
                  reason.trim().length < 5
                }
                onClick={() => void publish()}
              >
                Publier une nouvelle version
              </Button>
            </>
          )}
        </Stack>
      </Card>
      <Title order={3} size="h4">
        Historique des configurations
      </Title>
      <Text size="sm">
        Les versions sont immuables. Reprendre une ancienne définition prépare un brouillon ; seule une nouvelle
        publication l’applique.
      </Text>
      {history.data?.map((h) => (
        <Card key={h.version} withBorder>
          <Stack gap="xs">
            <Text size="sm">
              Version {h.version} — {fmtDate(h.createdAt)} — {h.createdBy}
            </Text>
            <Text size="sm">{h.reason}</Text>
            <Button variant="subtle" disabled={busy} onClick={() => void inspectVersion(h.version)}>
              Consulter la version {h.version}
            </Button>
            {canWrite && (
              <Button
                variant="subtle"
                disabled={busy}
                onClick={() => (dirty ? setReplacement(h.version) : void prepareVersion(h.version))}
              >
                Préparer la définition v{h.version}
              </Button>
            )}
          </Stack>
        </Card>
      ))}
      <Modal
        opened={!!past}
        onClose={() => setPast(null)}
        title={`Configuration publiée — version ${past?.version ?? ''}`}
        size="lg"
        closeButtonProps={{ 'aria-label': 'Fermer la version' }}
      >
        {past && (
          <Stack>
            <Text fw={600}>{past.definition.name}</Text>
            <Text size="sm">{past.reason}</Text>
            {(['impact', 'probability', 'maturity', 'criticality'] as const).map((k) => (
              <Stack key={k} gap="xs">
                <Text fw={600}>
                  {{ impact: 'Impact', probability: 'Probabilité', maturity: 'Maturité', criticality: 'Criticité' }[k]}
                </Text>
                {past.definition[k].map((l) => (
                  <Text size="sm" key={l.id}>
                    {l.label} —{' '}
                    {'value' in l
                      ? l.value
                      : 'reduction' in l
                        ? `${l.reduction} % de réduction`
                        : `à partir de ${l.minimum}`}
                  </Text>
                ))}
              </Stack>
            ))}
            <Text size="sm">
              Calcul :{' '}
              {{ product: 'produit', sum: 'somme', matrix: 'matrice explicite' }[past.definition.calculation.method]} ;
              plafond : {past.definition.calculation.ceiling}.
            </Text>
            {past.definition.calculation.cells.map((c) => (
              <Text size="sm" key={`${c.impact}/${c.probability}`}>
                {past.definition.impact.find((l) => l.id === c.impact)?.label} ×{' '}
                {past.definition.probability.find((l) => l.id === c.probability)?.label} : {c.score}
              </Text>
            ))}
          </Stack>
        )}
      </Modal>
      <ConfirmDialog
        opened={replacement !== null}
        title="Remplacer le brouillon"
        message="Abandonner votre brouillon et préparer cette ancienne définition ? Elle ne sera pas publiée automatiquement."
        confirmLabel="Préparer l’ancienne définition"
        onClose={() => setReplacement(null)}
        onConfirm={() => {
          if (replacement !== null) void prepareVersion(replacement);
          setReplacement(null);
        }}
      />
      <ConfirmDialog
        opened={reload}
        title="Recharger la configuration"
        message="Abandonner votre brouillon et charger la dernière version publiée ?"
        confirmLabel="Abandonner le brouillon"
        onClose={() => setReload(false)}
        onConfirm={() => {
          setBase(current);
          setDraft(EnvironmentDefinition.parse(current.definition));
          setPreview(null);
          setConfirmation('');
          setReason('');
          setError(null);
          setReload(false);
        }}
      />
    </Stack>
  );
}

function Levels({
  title,
  items,
  max,
  disabled,
  onChange,
  valueLabel = 'Valeur',
}: {
  title: string;
  items: { id: string; label: string; value: number }[];
  max: number;
  disabled: boolean;
  onChange: (items: { id: string; label: string; value: number }[]) => void;
  valueLabel?: string;
}) {
  return (
    <Stack>
      <Text size="sm">
        Identifiants stables, libellés et valeurs. L’ordre des niveaux est contrôlé lors de la simulation.
      </Text>
      {items.map((l, i) => (
        <Card key={i} withBorder>
          <Stack>
            <TextInput
              label={`${title} ${i + 1}`}
              value={l.label}
              maxLength={100}
              disabled={disabled}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.currentTarget.value } : x)))}
            />
            <Group grow>
              <TextInput
                label="Identifiant"
                value={l.id}
                maxLength={40}
                disabled={disabled}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, id: e.currentTarget.value } : x)))}
              />
              <NumberInput
                label={valueLabel}
                min={0}
                max={max}
                allowDecimal={false}
                value={l.value}
                disabled={disabled}
                onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, value: Number(v) || 0 } : x)))}
              />
            </Group>
            <Button
              variant="subtle"
              disabled={disabled || items.length <= 2}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              Retirer {title.toLowerCase()} {i + 1}
            </Button>
          </Stack>
        </Card>
      ))}
      <Button
        variant="light"
        disabled={disabled || items.length >= 10}
        onClick={() =>
          onChange([
            ...items,
            {
              id: `level_${crypto.randomUUID().slice(0, 8)}`,
              label: 'Nouveau niveau',
              value: Math.min(max, items[items.length - 1]!.value + 1),
            },
          ])
        }
      >
        Ajouter un niveau de {title.toLowerCase()}
      </Button>
    </Stack>
  );
}

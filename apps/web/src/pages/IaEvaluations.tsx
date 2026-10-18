import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  type AssessmentIntent,
  type AssessmentSource,
  type EnvironmentVersion,
  type RiskAssessment,
  type RiskExample,
  type legacyAiRisk,
} from '@suivi/shared';
import { Page, PageHeader } from '@suivi/ui';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, download, get } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';
import { useCan } from '../session';

const root = '/api/ia/evaluations';
const key = ['ia', 'evaluations'];
type Detail = {
  source: Record<string, unknown> | null;
  sourceSha: string | null;
  ambiguous: boolean;
  revision: number;
  configuration: EnvironmentVersion;
  legacy: ReturnType<typeof legacyAiRisk> | null;
  lastAssessment: RiskAssessment | null;
};
type Preview = { revision: number; previewId: string; result: RiskAssessment['result'] };
export function IaEvaluationsPage() {
  const can = useCan();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const list = useInfiniteQuery({
    queryKey: [...key, 'list', search],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      get<{ items: AssessmentSource[]; total: number; nextOffset: number | null }>(
        `${root}?search=${encodeURIComponent(search)}&offset=${pageParam}`,
      ),
    getNextPageParam: (p) => p.nextOffset ?? undefined,
    enabled: can('ia', 'lire'),
  });
  if (!can('ia', 'lire'))
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit de consulter les évaluations IA.</Alert>
      </Page>
    );
  return (
    <Page>
      <PageHeader
        title="Évaluations IA versionnées"
        description="Décisions explicites, sources conservées et configurations immuables."
      />
      <Stack>
        <Text size="sm">
          Le registre historique reste la source des scénarios. Une réévaluation enregistre une nouvelle décision ; elle
          ne remplace pas les calculs historiques.
        </Text>
        <Anchor href="/pilotage">Ouvrir le pilotage</Anchor>
        <TextInput
          label="Rechercher un scénario"
          maxLength={200}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <ErrorAlert error={list.error} />
        {list.data?.pages[0]?.total === 0 && (
          <Text>Aucun scénario IA. Créez vos scénarios dans le registre historique.</Text>
        )}
        {list.data?.pages
          .flatMap((p) => p.items)
          .map((s) => (
            <Card withBorder key={s.id}>
              <Stack gap="xs">
                <Text fw={600}>{s.scenario || s.id}</Text>
                <Text size="sm">{s.domain}</Text>
                <Group>
                  <Badge variant="light">{s.sourcePresent ? 'Source présente' : 'Source retirée'}</Badge>
                  {s.ambiguous && <Badge variant="light">Identifiant ambigu</Badge>}
                  {s.lastAssessment && (
                    <Text size="sm">
                      Décision {s.revision} · configuration v{s.lastAssessment.configurationVersion} · risque{' '}
                      {s.lastAssessment.result.residual}
                    </Text>
                  )}
                </Group>
                <Button variant="light" onClick={() => setSelected(s.id)} aria-label={`Consulter ${s.id}`}>
                  Consulter les évaluations
                </Button>
              </Stack>
            </Card>
          ))}
        {list.hasNextPage && (
          <Button variant="subtle" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            Afficher plus de scénarios
          </Button>
        )}
        {selected && <Scenario key={selected} id={selected} />}
      </Stack>
    </Page>
  );
}
function Scenario({ id }: { id: string }) {
  const can = useCan();
  const [inspected, setInspected] = useState<RiskAssessment | null>(null);
  const [version, setVersion] = useState<number | undefined>();
  const path = `${root}/${encodeURIComponent(id)}`;
  const detail = useQuery({
    queryKey: [...key, id, 'detail', version],
    queryFn: () => get<Detail>(`${path}${version ? `?configurationVersion=${version}` : ''}`),
  });
  useEffect(() => {
    if (version === undefined && detail.data) setVersion(detail.data.configuration.version);
  }, [version, detail.data]);
  const configurations = useQuery({
    queryKey: [...key, 'configurations'],
    queryFn: () => get<Omit<EnvironmentVersion, 'definition'>[]>(`${root}/configurations`),
  });
  const history = useInfiniteQuery({
    queryKey: [...key, id, 'history'],
    initialPageParam: 2147483647,
    queryFn: ({ pageParam }) =>
      get<{ items: RiskAssessment[]; nextBefore: number | null }>(`${path}/history?before=${pageParam}`),
    getNextPageParam: (p) => p.nextBefore ?? undefined,
  });
  return (
    <Stack>
      <Title order={2} size="h3">
        Scénario {id}
      </Title>
      <ErrorAlert error={detail.error || configurations.error || history.error} />
      {detail.data && (
        <>
          {detail.data.ambiguous && (
            <Alert>
              Identifiant présent plusieurs fois : corrigez les doublons dans le registre avant de réévaluer.
            </Alert>
          )}
          {!detail.data.source && !detail.data.ambiguous && (
            <Alert>La source a été retirée. Les décisions et leurs instantanés restent consultables.</Alert>
          )}
          {detail.data.lastAssessment && detail.data.sourceSha !== detail.data.lastAssessment.sourceSha && (
            <Alert>La source a changé depuis la dernière décision. Son résultat passé reste inchangé.</Alert>
          )}
          {detail.data.legacy && (
            <Text size="sm">
              Méthode historique courante : {detail.data.legacy.level}
              {detail.data.legacy.idx !== null ? ` · indice ${detail.data.legacy.idx}` : ''}. Ce calcul à l’affichage
              n’est pas une décision historisée.
            </Text>
          )}
          {can('ia', 'modifier') &&
            detail.data.source &&
            !detail.data.ambiguous &&
            detail.data.legacy?.idx !== null && (
              <>
                <Select
                  label="Version de configuration"
                  allowDeselect={false}
                  value={String(detail.data.configuration.version)}
                  data={[
                    ...new Map(
                      [
                        { version: detail.data.configuration.version, reason: detail.data.configuration.reason },
                        ...(configurations.data ?? []),
                      ].map((v) => [v.version, v]),
                    ).values(),
                  ].map((v) => ({ value: String(v.version), label: `Version ${v.version} — ${v.reason}` }))}
                  onChange={(v) => setVersion(Number(v))}
                />
                <Decision
                  key={`${detail.data.sourceSha}/${detail.data.revision}/${detail.data.configuration.version}`}
                  id={id}
                  detail={detail.data}
                />
              </>
            )}
          {can('ia', 'modifier') && detail.data.legacy?.idx === null && (
            <Alert>Scénario conditionnel : validez son applicabilité dans le registre avant de réévaluer.</Alert>
          )}
        </>
      )}
      <Modal
        opened={!!inspected}
        onClose={() => setInspected(null)}
        title="Instantané immuable de la décision"
        size="lg"
        closeButtonProps={{ 'aria-label': 'Fermer l’instantané' }}
      >
        {inspected && (
          <Stack>
            <Text size="sm">Source et configuration utilisées lors de la décision. Elles restent inchangées.</Text>
            <Textarea
              label="Source conservée"
              readOnly
              autosize
              maxRows={15}
              value={JSON.stringify(inspected.sourceSnapshot, null, 2)}
            />
            <Textarea
              label="Configuration conservée"
              readOnly
              autosize
              maxRows={15}
              value={JSON.stringify(inspected.configuration, null, 2)}
            />
          </Stack>
        )}
      </Modal>
      <Title order={3} size="h4">
        Historique des décisions
      </Title>
      {history.data?.pages[0]?.items.length === 0 && <Text>Aucune décision enregistrée.</Text>}
      {history.data?.pages
        .flatMap((p) => p.items)
        .map((a) => (
          <Card withBorder key={a.id}>
            <Stack gap="xs">
              <Text fw={600}>
                Décision {a.revision} · configuration v{a.configuration.version}
              </Text>
              <Text size="sm">
                {fmtDate(a.createdAt)} · {a.createdBy}
              </Text>
              <Text size="sm">{String(a.sourceSnapshot.scenario ?? a.sourceId)}</Text>
              <Text size="sm">
                {(['impact', 'probability', 'maturity'] as const)
                  .map(
                    (k) =>
                      `${{ impact: 'Impact', probability: 'Probabilité', maturity: 'Maturité' }[k]} : ${a.configuration.definition[k].find((l) => l.id === a.ratings[k])?.label ?? a.ratings[k]}`,
                  )
                  .join(' · ')}
              </Text>
              <Result result={a.result} />
              <Text size="sm">{a.rationale}</Text>
              <Button variant="subtle" onClick={() => setInspected(a)}>
                Consulter l’instantané de la décision {a.revision}
              </Button>
            </Stack>
          </Card>
        ))}
      {history.hasNextPage && (
        <Button variant="subtle" loading={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>
          Afficher les décisions précédentes
        </Button>
      )}
      {can('ia', 'exporter') && can('import_export', 'exporter') && (
        <Button variant="light" onClick={() => download(`${path}/export`)}>
          Exporter l’historique complet (JSON)
        </Button>
      )}
    </Stack>
  );
}
function Decision({ id, detail }: { id: string; detail: Detail }) {
  const qc = useQueryClient();
  const configuration = detail.configuration;
  const [ratings, setRatings] = useState<RiskExample>({
    impact: configuration.definition.impact[0]!.id,
    probability: configuration.definition.probability[0]!.id,
    maturity: configuration.definition.maturity[0]!.id,
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const intent: AssessmentIntent = {
    sourceSha: detail.sourceSha!,
    configurationVersion: configuration.version,
    ratings,
  };
  const path = `${root}/${encodeURIComponent(id)}`;
  const simulate = async () => {
    setBusy(true);
    setError(null);
    setPreview(null);
    setConfirm('');
    setRequestId(crypto.randomUUID());
    try {
      setPreview(await api<Preview>('POST', `${path}/preview`, { body: intent }));
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
      await api<RiskAssessment>('POST', `${path}/assessments`, {
        ifMatch: preview.revision,
        body: { requestId, intent, previewId: preview.previewId, rationale: reason, confirm },
      });
      setPreview(null);
      setConfirm('');
      setReason('');
      await qc.invalidateQueries({ queryKey: key });
      notifications.show({ color: 'teal', message: 'La décision et sa configuration ont été conservées.' });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card withBorder>
      <Stack>
        <Title order={3} size="h4">
          Nouvelle réévaluation
        </Title>
        <Text size="sm">
          Configuration v{configuration.version} : {configuration.definition.name}. Choisissez les niveaux explicitement
          ; aucune conversion automatique des notes historiques.
        </Text>
        <ErrorAlert error={error} />
        {(['impact', 'probability', 'maturity'] as const).map((k) => (
          <Select
            key={k}
            label={{ impact: 'Impact évalué', probability: 'Probabilité évaluée', maturity: 'Maturité évaluée' }[k]}
            value={ratings[k]}
            allowDeselect={false}
            disabled={busy}
            data={configuration.definition[k].map((l) => ({ value: l.id, label: l.label }))}
            onChange={(v) => {
              setRatings({ ...ratings, [k]: v! });
              setPreview(null);
              setConfirm('');
            }}
          />
        ))}
        <Button variant="light" loading={busy} onClick={() => void simulate()}>
          Simuler la réévaluation
        </Button>
        {preview && (
          <Alert>
            <Text size="sm">
              Prévisualisation · source et configuration v{configuration.version} vérifiées. Aucun enregistrement
              effectué.
            </Text>
            <Result result={preview.result} />
          </Alert>
        )}
        <Textarea
          label="Motif de la décision"
          description="De 10 à 2 000 caractères."
          maxLength={2000}
          value={reason}
          disabled={busy}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <TextInput
          label="Saisissez ENREGISTRER pour confirmer"
          value={confirm}
          disabled={busy || !preview}
          onChange={(e) => setConfirm(e.currentTarget.value)}
        />
        <Button
          loading={busy}
          disabled={!preview || confirm !== 'ENREGISTRER' || reason.trim().length < 10}
          onClick={() => void publish()}
        >
          Enregistrer la décision
        </Button>
      </Stack>
    </Card>
  );
}
function Result({ result }: { result: RiskAssessment['result'] }) {
  return (
    <Text size="sm">
      Risque initial : {result.initial} · réduction : {result.reduction} % · risque résiduel : {result.residual} ·{' '}
      {result.criticality.label}
    </Text>
  );
}

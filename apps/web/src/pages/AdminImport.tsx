/* Administration → Import des données legacy : dépôt, simulation (aucune écriture), confirmation, application, annulation. */
import {
  Alert,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  Radio,
  Select,
  Stack,
  Stepper,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IMPORT_MODE_LABELS, IMPORT_MODES, type ImportMode } from '@suivi/shared';
import { LEGACY_MODULES, TECHNICAL_KEYS, type ImportReport } from '@suivi/shared/legacy';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, download, errorMessage, get, saveBlob } from '../api';
import { ConfirmButton, fmtDate, fmtSize } from '../components/common';

interface SimResult {
  filename: string;
  size: number;
  sha256: string;
  envelope: unknown;
  report: ImportReport;
}
interface Batch {
  id: number;
  created_at: string;
  created_by: string;
  filename: string;
  size: number;
  mode: ImportMode;
  module: string | null;
  modules: string[];
  totals: ImportReport['totals'];
  status: 'applied' | 'undone';
  undone_at: string | null;
  undone_by: string | null;
}
const CHANGE: Record<string, [string, string]> = {
  created: ['créé', 'teal'],
  updated: ['modifié', 'blue'],
  unchanged: ['inchangé', 'gray'],
  deleted: ['supprimé', 'red'],
};
const moduleOptions = LEGACY_MODULES.filter((m) => !TECHNICAL_KEYS.has(m.key)).map((m) => ({
  value: m.key,
  label: `${m.label} (${m.key})`,
}));

export function ImportPanel() {
  const qc = useQueryClient();
  const [file, setFile] = useState<{ name: string; buf: ArrayBuffer } | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [module, setModule] = useState<string | null>(null);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const history = useQuery({ queryKey: ['admin', 'imports'], queryFn: () => get<Batch[]>('/api/admin/import') });
  const step = !file ? 0 : !sim ? 1 : 2;
  const q = (extra = '') =>
    `mode=${mode}${mode === 'replace' && module ? `&module=${encodeURIComponent(module)}` : ''}${extra}`;
  const headers = file ? { 'X-File-Name': encodeURIComponent(file.name) } : undefined;

  const reset = () => {
    setSim(null);
    setConfirm('');
    setError(null);
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const d = (e as { data?: { details?: string[] } }).data;
      setError({ message: errorMessage(e), details: d?.details });
    } finally {
      setBusy(false);
    }
  };
  const simulate = () =>
    run(async () => {
      if (!file) return;
      setSim(await api<SimResult>('POST', `/api/admin/import/simulate?${q()}`, { raw: file.buf, headers }));
    });
  const apply = () =>
    run(async () => {
      if (!file || !sim) return;
      const r = await api<{ batch: number }>(
        'POST',
        `/api/admin/import/apply?${q(`&sha256=${sim.sha256}${mode === 'replace' ? `&confirm=${encodeURIComponent(confirm)}` : ''}`)}`,
        {
          raw: file.buf,
          headers,
        },
      );
      notifications.show({
        color: 'teal',
        title: 'Import appliqué',
        message: `Import n°${r.batch} enregistré. Il peut être annulé depuis l’historique.`,
      });
      setFile(null);
      reset();
      await qc.invalidateQueries();
    });

  return (
    <Stack>
      <Text c="dimmed" size="sm">
        Reprise des données de l’outil historique : sauvegarde JSON (Paramètres → Sauvegarde) ou fichier « Exporter pour
        la nouvelle version ». La simulation n’écrit rien ; l’application se fait en une seule transaction, après une
        sauvegarde de l’état actuel, et reste annulable.
      </Text>
      <Stepper active={step} size="sm">
        <Stepper.Step label="Dépôt" description="Fichier JSON" />
        <Stepper.Step label="Simulation" description="Aucune écriture" />
        <Stepper.Step label="Confirmation" description="Application" />
      </Stepper>

      <Card withBorder>
        <Stack>
          <Group>
            <FileButton
              accept="application/json,.json"
              onChange={async (f) => {
                if (!f) return;
                reset();
                setFile({ name: f.name, buf: await f.arrayBuffer() });
              }}
            >
              {(props) => <Button {...props}>{file ? 'Changer de fichier' : 'Choisir le fichier à importer'}</Button>}
            </FileButton>
            {file && (
              <Text size="sm">
                {file.name} ({fmtSize(file.buf.byteLength)})
              </Text>
            )}
          </Group>
          <Radio.Group
            label="Mode d’import"
            value={mode}
            onChange={(v) => {
              setMode(v as ImportMode);
              reset();
            }}
          >
            <Stack gap="xs" mt="xs">
              {IMPORT_MODES.map((m) => (
                <Radio key={m} value={m} label={IMPORT_MODE_LABELS[m]} />
              ))}
            </Stack>
          </Radio.Group>
          {mode === 'replace' && (
            <Select
              label="Module à remplacer"
              data={moduleOptions}
              value={module}
              onChange={(v) => {
                setModule(v);
                reset();
              }}
              searchable
              className="champ-l"
            />
          )}
          <Button
            onClick={simulate}
            disabled={!file || (mode === 'replace' && !module)}
            loading={busy && !sim}
            w="fit-content"
          >
            Simuler l’import
          </Button>
          {error && (
            <Alert color="red" title="Import impossible" role="alert">
              {error.message}
              {error.details && error.details.length > 0 && <div className="pre">{error.details.join('\n')}</div>}
            </Alert>
          )}
        </Stack>
      </Card>

      {sim && <ReportView sim={sim} />}

      {sim && (
        <Card withBorder>
          <Stack>
            <Title order={3} size="h4">
              Confirmation
            </Title>
            {sim.report.affected.length === 0 ? (
              <Alert color="gray">Ce fichier ne modifie aucune donnée : rien à importer.</Alert>
            ) : (
              <>
                <Text size="sm">
                  Modules modifiés : <b>{sim.report.affected.join(', ')}</b>. Une sauvegarde de l’état actuel est faite
                  juste avant.
                </Text>
                {mode === 'replace' && (
                  <Alert color="red" title="Confirmation renforcée">
                    Les éléments du module « {module} » absents du fichier seront supprimés ({sim.report.totals.deleted}
                    ). Ressaisissez le nom du module pour confirmer.
                    <TextInput
                      mt="xs"
                      value={confirm}
                      onChange={(e) => setConfirm(e.currentTarget.value)}
                      placeholder={module ?? ''}
                      aria-label="Nom du module à remplacer"
                    />
                  </Alert>
                )}
                <Group>
                  <Button
                    color={mode === 'replace' ? 'red' : undefined}
                    onClick={apply}
                    loading={busy}
                    disabled={mode === 'replace' && confirm !== module}
                  >
                    Appliquer l’import
                  </Button>
                  <Button variant="default" onClick={reset}>
                    Annuler
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        </Card>
      )}

      <Card withBorder>
        <Group justify="space-between" mb="sm">
          <Title order={3} size="h4">
            Historique des imports
          </Title>
          <Button variant="light" onClick={() => download('/api/admin/export/legacy')}>
            Exporter au format legacy (schéma 15)
          </Button>
        </Group>
        <div className="table-wrap" role="region" aria-label="Enregistrements de l’état" tabIndex={0}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>N°</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Fichier</Table.Th>
                <Table.Th>Mode</Table.Th>
                <Table.Th>Modules</Table.Th>
                <Table.Th>État</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(history.data ?? []).map((b) => (
                <Table.Tr key={b.id}>
                  <Table.Td>{b.id}</Table.Td>
                  <Table.Td className="nowrap">
                    {fmtDate(b.created_at)}
                    <Text size="xs" c="dimmed">
                      {b.created_by}
                    </Text>
                  </Table.Td>
                  <Table.Td>{b.filename}</Table.Td>
                  <Table.Td>
                    {b.mode === 'replace' ? `remplacer ${b.module}` : b.mode === 'init' ? 'initialiser' : 'fusionner'}
                  </Table.Td>
                  <Table.Td>{b.modules.join(', ')}</Table.Td>
                  <Table.Td className="nowrap">
                    {b.status === 'undone' ? (
                      <Badge color="gray">annulé le {fmtDate(b.undone_at)}</Badge>
                    ) : (
                      <Badge color="teal">appliqué</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="2xs" wrap="nowrap">
                      <Button
                        size="compact-sm"
                        variant="default"
                        onClick={() =>
                          get<{ report: ImportReport }>(`/api/admin/import/${b.id}`).then((r) =>
                            saveBlob(`rapport-import-${b.id}.json`, JSON.stringify(r.report, null, 2)),
                          )
                        }
                      >
                        Rapport
                      </Button>
                      <Button
                        size="compact-sm"
                        variant="default"
                        onClick={() => download(`/api/admin/import/${b.id}/file`)}
                      >
                        Fichier
                      </Button>
                      {b.status === 'applied' && (
                        <ConfirmButton
                          size="compact-sm"
                          variant="light"
                          color="orange"
                          message={`Annuler l’import n°${b.id} ? Les modules ${b.modules.join(', ')} retrouveront leur contenu d’avant l’import (refusé s’ils ont été modifiés depuis).`}
                          onConfirm={() =>
                            api('POST', `/api/admin/import/${b.id}/undo`)
                              .then(() => notifications.show({ color: 'teal', message: `Import n°${b.id} annulé.` }))
                              .then(() => qc.invalidateQueries())
                              .catch((e) =>
                                notifications.show({
                                  color: 'red',
                                  title: 'Annulation impossible',
                                  message: errorMessage(e),
                                }),
                              )
                          }
                        >
                          Annuler
                        </ConfirmButton>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {history.data && !history.data.length && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text c="dimmed" ta="center">
                      Aucun import.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
    </Stack>
  );
}

function ReportView({ sim }: { sim: SimResult }) {
  const r = sim.report;
  return (
    <Card withBorder data-testid="import-report">
      <Stack>
        <Group justify="space-between">
          <Title order={3} size="h4">
            Rapport de simulation
          </Title>
          <Button
            variant="default"
            onClick={() =>
              saveBlob(`simulation-${sim.filename.replace(/\.json$/i, '')}.json`, JSON.stringify(sim, null, 2))
            }
          >
            Télécharger le rapport
          </Button>
        </Group>
        <Text size="sm">
          Fichier au schéma {r.sourceSchema}
          {sim.envelope ? ' (export pour la nouvelle version)' : ' (sauvegarde brute)'} — {r.totals.created}{' '}
          création(s), {r.totals.updated} mise(s) à jour, {r.totals.deleted} suppression(s), {r.totals.unchanged}{' '}
          inchangé(s).
        </Text>
        <div className="table-wrap" role="region" aria-label="Résultat de la simulation" tabIndex={0}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Module</Table.Th>
                <Table.Th>Effet</Table.Th>
                <Table.Th>Créés</Table.Th>
                <Table.Th>Modifiés</Table.Th>
                <Table.Th>Inchangés</Table.Th>
                <Table.Th>Supprimés</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {r.modules.map((m) => {
                const sum = (k: 'created' | 'updated' | 'unchanged' | 'deleted') =>
                  m.collections.reduce((n, c) => n + c[k], 0);
                const [label, color] = CHANGE[m.change] ?? ['', 'gray'];
                return (
                  <Table.Tr key={m.module}>
                    <Table.Td>
                      {m.label}
                      {m.fields.length > 0 && (
                        <Text size="xs" c="dimmed">
                          champs : {m.fields.map((f) => f.replace(`$.${m.module}.`, '')).join(', ')}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={color} variant="light">
                        {label}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{sum('created') || ''}</Table.Td>
                    <Table.Td>{sum('updated') || ''}</Table.Td>
                    <Table.Td>{sum('unchanged') || ''}</Table.Td>
                    <Table.Td>{sum('deleted') || ''}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>
        {r.brokenRefs.length > 0 && (
          <Alert color="orange" title={`Références cassées (${r.brokenRefs.length})`}>
            Éléments qui citent un élément inexistant (à corriger après l’import si nécessaire) :
            <div className="pre">{r.brokenRefs.map((b) => `${b.path} → ${b.value}`).join('\n')}</div>
          </Alert>
        )}
        {r.unknownPaths.length > 0 && (
          <Alert color="blue" title={`Champs inconnus du contrat (${r.unknownPaths.length})`}>
            Ces champs sont conservés tels quels :<div className="pre">{r.unknownPaths.join('\n')}</div>
          </Alert>
        )}
        {r.warnings.length > 0 && (
          <Alert color="yellow" title="Avertissements">
            <div className="pre">{r.warnings.join('\n')}</div>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}

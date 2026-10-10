import { Alert, Button, Card, Group, Select, Stack, Textarea, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { methodTemplate, type FrameworkDefinition, type GrcObject } from '@suivi/shared';
import { api, get, saveBlob } from '../api';
import { ErrorAlert } from '../components/common';
import { LegacyFrameworks } from './LegacyFrameworks';
import { ConfigurationEditor } from './ConfigurationEditor';
import type { MethodVersion } from './Risks';
import { useCan } from '../session';
export const exampleFramework: FrameworkDefinition = {
  name: 'PSSI — exemple fictif',
  identifier: 'PSSI-EXEMPLE',
  source: {
    organisation: 'Organisation fictive',
    document: 'Politique de sécurité fictive',
    url: 'https://example.invalid/pssi',
    version: '1',
    date: '2026-10-10',
    license: 'Exemple fictif libre ; ne reproduit aucun référentiel officiel.',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'governance', label: 'Gouvernance' }],
  requirements: [
    {
      id: 'PSSI-01',
      domain: 'governance',
      title: 'Revue périodique de la politique',
      description: 'Exemple fictif : organiser et documenter la revue de la politique.',
      applicability: 'Périmètre de l’organisation fictive',
      measureRefs: [],
    },
  ],
};
export function Publication({ smsi, type }: { smsi: string; type: 'methods' | 'frameworks' }) {
  const can = useCan(),
    qc = useQueryClient(),
    [id, setId] = useState<string | null>(null),
    [draft, setDraft] = useState<unknown>(null),
    [reason, setReason] = useState(''),
    [preview, setPreview] = useState<{ previewId: string; version: number; warning?: string | null } | null>(null),
    [error, setError] = useState<unknown>(null),
    [confirm, setConfirm] = useState(false),
    [advanced, setAdvanced] = useState(''),
    [historicalVersion, setHistoricalVersion] = useState<string | null>(null),
    [requirementLimit, setRequirementLimit] = useState(50);
  const list = useQuery({
    queryKey: ['grc', smsi, type],
    queryFn: async () =>
      type === 'methods'
        ? await get<MethodVersion[]>(`/api/grc/${smsi}/methods`)
        : (await get<{ items: GrcObject[] }>(`/api/grc/${smsi}/objects?kind=framework`)).items,
  });
  const history = useQuery({
    queryKey: ['grc', smsi, type, 'history', id],
    queryFn: () =>
      get<{ version: number; definition: unknown; reason: string; createdBy: string; createdAt: string }[]>(
        `/api/grc/${smsi}/${type}/${id}/history`,
      ),
    enabled: !!id,
  });
  const historical = history.data?.find((h) => String(h.version) === historicalVersion);
  const choices = (list.data ?? []).map((o) =>
    'methodId' in o ? { value: o.methodId, label: o.definition.name } : { value: o.id, label: o.name },
  );
  const edit = (value: string | null) => {
    setId(value);
    setHistoricalVersion(null);
    setPreview(null);
    setConfirm(false);
    const o = list.data?.find((o) => ('methodId' in o ? o.methodId : o.id) === value);
    setDraft(o ? ('definition' in o ? o.definition : o.data.definition) : null);
  };
  const execute = async (save = false) => {
    try {
      setError(null);
      const body = { id, definition: draft };
      if (save && preview) {
        await api('POST', `/api/grc/${smsi}/${type}/publish`, {
          ifMatch: preview.version,
          body: { ...body, previewId: preview.previewId, reason, confirm: 'PUBLIER' },
        });
        setDraft(null);
        setPreview(null);
        setConfirm(false);
        await qc.invalidateQueries({ queryKey: ['grc', smsi] });
      } else setPreview(await api('POST', `/api/grc/${smsi}/${type}/preview`, { body }));
    } catch (e) {
      setError(e);
    }
  };
  const write = can(type === 'methods' ? 'pilotage' : 'conformite', type === 'methods' ? 'administrer' : 'modifier');
  return (
    <Stack>
      <Alert>
        {type === 'methods'
          ? 'Chaque SMSI conserve ses méthodes et versions. Les modèles sont des propositions organisationnelles à adapter ; aucun calcul unique n’est imposé.'
          : 'Activez les référentiels correspondant au périmètre. Les exigences sont issues de leurs publications ; aucun texte ISO sous licence n’est fourni.'}
      </Alert>
      <Select
        label={type === 'methods' ? 'Méthode publiée' : 'Référentiel publié'}
        data={choices}
        clearable
        value={id}
        onChange={edit}
      />
      {id && (
        <Stack>
          <Select
            label="Consulter une version publiée"
            clearable
            value={historicalVersion}
            onChange={setHistoricalVersion}
            data={(history.data ?? []).map((h) => ({
              value: String(h.version),
              label: `Version ${h.version} · ${h.createdBy}`,
            }))}
          />
          <ErrorAlert error={history.error} />
          {historical && (
            <Card withBorder>
              <Text>
                {historical.createdAt} · {historical.reason}
              </Text>
              <Text component="pre">{JSON.stringify(historical.definition, null, 2)}</Text>
            </Card>
          )}
        </Stack>
      )}
      {write && (
        <Group>
          {type === 'methods' ? (
            (['ebios_rm', 'iso27005', 'mehari', 'custom'] as const).map((f) => (
              <Button
                key={f}
                variant="light"
                onClick={() => {
                  setId(null);
                  setDraft(methodTemplate(f));
                  setPreview(null);
                }}
              >
                Créer{' '}
                {f === 'ebios_rm'
                  ? 'EBIOS RM'
                  : f === 'iso27005'
                    ? 'ISO 27005'
                    : f === 'mehari'
                      ? 'MÉHARI'
                      : 'une méthode personnalisée'}
              </Button>
            ))
          ) : (
            <Button
              onClick={() => {
                setId(null);
                setDraft(structuredClone(exampleFramework));
                setPreview(null);
              }}
            >
              Créer un référentiel
            </Button>
          )}
        </Group>
      )}
      <ErrorAlert error={error ?? list.error} />
      {draft !== null && (
        <>
          <Button
            variant="subtle"
            disabled={
              id !== null &&
              (!can('import_export', 'exporter') ||
                !can(type === 'methods' ? 'cartographie' : 'conformite', 'exporter'))
            }
            onClick={async () => {
              try {
                if (id)
                  await get(`/api/grc/${smsi}/export/authorize?kind=${type === 'methods' ? 'risks' : 'frameworks'}`);
                saveBlob(type + '.json', JSON.stringify(draft, null, 2));
              } catch (e) {
                setError(e);
              }
            }}
          >
            Exporter la définition JSON
          </Button>
          {write ? (
            <ConfigurationEditor
              value={draft}
              onChange={(next) => {
                setDraft(next);
                setPreview(null);
                setConfirm(false);
              }}
            />
          ) : (
            <Text component="pre">{JSON.stringify(draft, null, 2)}</Text>
          )}
          {write && (
            <>
              <Button variant="subtle" onClick={() => setAdvanced(JSON.stringify(draft, null, 2))}>
                Ouvrir le mode JSON avancé
              </Button>
              {advanced && (
                <>
                  <Textarea
                    label="Définition JSON avancée"
                    minRows={12}
                    value={advanced}
                    onChange={(e) => setAdvanced(e.currentTarget.value)}
                  />
                  <Button
                    variant="light"
                    onClick={() => {
                      try {
                        setDraft(JSON.parse(advanced));
                        setPreview(null);
                        setAdvanced('');
                      } catch (e) {
                        setError(e);
                      }
                    }}
                  >
                    Appliquer au brouillon
                  </Button>
                </>
              )}
              <Textarea
                label="Motif de publication"
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
              />
              <Button onClick={() => void execute()}>Simuler la publication</Button>
              {preview && (
                <Card withBorder>
                  <Text>Configuration valide · publication après version {preview.version}</Text>
                  {preview.warning && <Alert>{preview.warning}</Alert>}
                  <Button onClick={() => setConfirm(true)}>Publier cette version</Button>
                </Card>
              )}
              {confirm && (
                <Alert>
                  <Text>
                    Confirmer cette publication ? Les décisions existantes conservent leur version précédente.
                  </Text>
                  <Button onClick={() => void execute(true)}>Confirmer la publication</Button>
                  <Button variant="subtle" onClick={() => setConfirm(false)}>
                    Annuler
                  </Button>
                </Alert>
              )}
            </>
          )}
        </>
      )}
      {type === 'methods' &&
        write &&
        (list.data as MethodVersion[] | undefined)?.map((m) => (
          <Card withBorder key={m.methodId}>
            <Text fw={600}>
              {m.definition.name} · version {m.version}
            </Text>
            <Button
              variant="light"
              onClick={async () => {
                try {
                  const scopes = await get<{ id: string; version: number }[]>('/api/grc/smsis');
                  await api('PUT', `/api/grc/${smsi}/method`, {
                    ifMatch: scopes.find((s) => s.id === smsi)?.version,
                    body: { methodId: m.methodId, version: m.version, confirm: 'CHOISIR' },
                  });
                  await qc.invalidateQueries({ queryKey: ['grc'] });
                } catch (e) {
                  setError(e);
                }
              }}
            >
              Choisir pour les nouveaux risques du SMSI
            </Button>
          </Card>
        ))}
      {type === 'frameworks' &&
        (list.data as GrcObject[] | undefined)?.map((o) => (
          <Card withBorder key={o.id}>
            <Text fw={600}>{o.name}</Text>
            <Text>
              Version de fiche {o.version} · {o.data.enabled ? 'Actif' : 'Inactif'}
            </Text>
            {write && (
              <Button
                variant="light"
                onClick={async () => {
                  try {
                    await api('PUT', `/api/grc/${smsi}/frameworks/${o.id}/activation`, {
                      ifMatch: o.version,
                      body: { enabled: !o.data.enabled },
                    });
                    await qc.invalidateQueries({ queryKey: ['grc', smsi] });
                  } catch (e) {
                    setError(e);
                  }
                }}
              >
                {o.data.enabled ? 'Désactiver' : 'Activer'}
              </Button>
            )}
            {(o.data.definition as FrameworkDefinition).requirements.slice(0, requirementLimit).map((r) => (
              <Text key={r.id}>
                {r.id} · {r.title}
              </Text>
            ))}
            {(o.data.definition as FrameworkDefinition).requirements.length > requirementLimit && (
              <Button variant="subtle" onClick={() => setRequirementLimit((n) => n + 50)}>
                Afficher 50 exigences supplémentaires
              </Button>
            )}
          </Card>
        ))}
      {type === 'frameworks' && <LegacyFrameworks smsi={smsi} />}
    </Stack>
  );
}

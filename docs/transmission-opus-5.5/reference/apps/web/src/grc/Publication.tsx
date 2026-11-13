import { Alert, Button, Card, Group, Select, Stack, Textarea, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { methodTemplate, type FrameworkDefinition, type GrcObject } from '@suivi/shared';
import { api, get, saveBlob } from '../api';
import { ErrorAlert } from '../components/common';
import { PromotionBouton } from '../pilotage/Bibliotheque';
import { LegacyFrameworks } from './LegacyFrameworks';
import { ConfigurationEditor } from './ConfigurationEditor';
import { EpinglagesMethode } from '../config-grc/EpinglagesMethode';
import type { MethodVersion } from './Risks';
import { useCan } from '../session';
import { Link } from 'react-router';
import { LivreReferentiel, ExigencesReferentiel, SourceReferentiel, LIBELLES_SOURCE } from './ReferentielsStudio';
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
/** Épinglages, objets et livrables ont leur propre éditeur : l'éditeur générique ne les voit pas. */
const GEREES = ['bindings', 'objects', 'deliverables'] as const;
const withoutBindings = (d: unknown) => {
  if (!d || typeof d !== 'object') return d;
  const reste = { ...(d as Record<string, unknown>) };
  for (const k of GEREES) delete reste[k];
  return reste;
};
const withManaged = (next: unknown, d: unknown) => {
  if (!d || typeof d !== 'object') return next;
  const out = { ...(next as Record<string, unknown>) };
  for (const k of GEREES) if (k in d) out[k] = (d as Record<string, unknown>)[k];
  return out;
};
export function Publication({ smsi, type }: { smsi: string; type: 'methods' | 'frameworks' }) {
  const can = useCan(),
    qc = useQueryClient(),
    [id, setId] = useState<string | null | undefined>(type === 'frameworks' ? undefined : null),
    [sourceOuverte, setSourceOuverte] = useState(false),
    [editing, setEditing] = useState(false),
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
  const referentiels = type === 'frameworks' ? ((list.data as GrcObject[] | undefined) ?? []) : [];
  const selectionId = id === undefined ? (referentiels[0]?.id ?? null) : id;
  const selection = referentiels.find((o) => o.id === selectionId);
  const definitionSelection = selection?.data.definition as FrameworkDefinition | undefined;
  const definitionAffichee = type === 'frameworks' && !editing ? (definitionSelection ?? draft) : draft;
  const history = useQuery({
    queryKey: ['grc', smsi, type, 'history', selectionId],
    queryFn: () =>
      get<{ version: number; definition: unknown; reason: string; createdBy: string; createdAt: string }[]>(
        `/api/grc/${smsi}/${type}/${selectionId}/history`,
      ),
    enabled: !!selectionId,
  });
  const historical = history.data?.find((h) => String(h.version) === historicalVersion);
  const choices = (list.data ?? []).map((o) =>
    'methodId' in o ? { value: o.methodId, label: o.definition.name } : { value: o.id, label: o.name },
  );
  const edit = (value: string | null) => {
    setId(value);
    setEditing(false);
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
    <Stack className={type === 'frameworks' ? 'referentiels-studio' : undefined}>
      <Alert>
        {type === 'methods'
          ? 'Chaque périmètre conserve ses méthodes et versions. Les modèles sont des propositions organisationnelles à adapter ; aucun calcul unique n’est imposé.'
          : 'Activez les référentiels correspondant au périmètre. Les exigences sont issues de leurs publications ; aucun texte ISO sous licence n’est fourni.'}
      </Alert>
      {type === 'frameworks' && referentiels.length > 0 && (
        <>
          <div className="rfs-synthese">
            <span>
              <b>{referentiels.length}</b> référentiel(s) publié(s)
            </span>
            <span>
              <b>
                {referentiels.reduce((n, o) => n + (o.data.definition as FrameworkDefinition).requirements.length, 0)}
              </b>{' '}
              exigences
            </span>
            <span>
              <b>{referentiels.filter((o) => o.data.enabled).length}</b> actif(s) dans le périmètre
            </span>
          </div>
          <div className="rfs-catalogue">
            {referentiels.map((o, index) => {
              const d = o.data.definition as FrameworkDefinition;
              return (
                <article
                  key={o.id}
                  className="rfs-catalogue-carte"
                  data-ton={index % 3}
                  data-selection={selectionId === o.id}
                  aria-label={`Référentiel ${o.name}`}
                >
                  <header>
                    <LivreReferentiel ton={index} />
                    <span className="rfs-etat" data-actif={!!o.data.enabled}>
                      {o.data.enabled ? 'Actif' : 'Inactif'}
                    </span>
                  </header>
                  <h2>{o.name}</h2>
                  <p>{d.source.document || d.identifier}</p>
                  <div className="rfs-carte-chiffres">
                    <span>
                      <strong>{d.requirements.length}</strong> exigences
                    </span>
                    <small>
                      Édition de la source <b>{d.source.version || 'Non renseignée'}</b>
                    </small>
                  </div>
                  <footer>
                    <span>Version de fiche {o.version}</span>
                    <Button
                      variant="light"
                      size="compact-xs"
                      aria-pressed={selectionId === o.id}
                      onClick={() => edit(o.id)}
                      aria-label={`Consulter ${o.name}`}
                    >
                      Consulter
                    </Button>
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
                  </footer>
                </article>
              );
            })}
          </div>
        </>
      )}
      <Stack className={type === 'frameworks' ? 'rfs-registre' : undefined} data-edition={editing}>
        {type === 'frameworks' && (
          <header className="rfs-registre-entete">
            <LivreReferentiel />
            <div>
              <span className="rfs-surtitre">Exigences de la version publiée</span>
              <h2>
                {selection?.name ??
                  (editing
                    ? 'Préparation de publication'
                    : referentiels.length
                      ? 'Choisir un référentiel publié'
                      : 'Aucun référentiel publié ici')}
              </h2>
            </div>
            {definitionSelection && (
              <Button variant="default" onClick={() => setSourceOuverte(true)}>
                Source et publication
              </Button>
            )}
          </header>
        )}
        {type === 'frameworks' && !referentiels.length && !editing && (
          <Text size="sm">
            Les référentiels partagés de l’organisation se consultent dans la{' '}
            <Link to="/pilotage/bibliotheque">bibliothèque de référentiels</Link>.
          </Text>
        )}
        <Select
          label={type === 'methods' ? 'Méthode publiée' : 'Référentiel publié'}
          data={choices}
          clearable
          value={selectionId}
          onChange={edit}
        />
        {selectionId && (
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
                    setEditing(true);
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
                  setEditing(true);
                  setPreview(null);
                }}
              >
                Créer un référentiel
              </Button>
            )}
          </Group>
        )}
        <ErrorAlert error={error ?? list.error} />
        {definitionAffichee != null && (
          <>
            <Button
              className={type === 'frameworks' ? 'rfs-export' : undefined}
              variant="subtle"
              disabled={
                selectionId !== null &&
                (!can('import_export', 'exporter') ||
                  !can(type === 'methods' ? 'cartographie' : 'conformite', 'exporter'))
              }
              onClick={async () => {
                try {
                  if (selectionId)
                    await get(`/api/grc/${smsi}/export/authorize?kind=${type === 'methods' ? 'risks' : 'frameworks'}`);
                  saveBlob(type + '.json', JSON.stringify(definitionAffichee, null, 2));
                } catch (e) {
                  setError(e);
                }
              }}
            >
              Exporter la définition JSON
            </Button>
            {write && !editing && (
              <Button
                className={type === 'frameworks' ? 'rfs-preparer' : undefined}
                variant="light"
                onClick={() => {
                  setId(selectionId);
                  setDraft(definitionAffichee);
                  setEditing(true);
                }}
              >
                Préparer une nouvelle version
              </Button>
            )}
            {write && editing ? (
              <>
                {type === 'methods' && (
                  <EpinglagesMethode
                    value={draft as Parameters<typeof EpinglagesMethode>[0]['value']}
                    onChange={(next) => {
                      setDraft(next);
                      setPreview(null);
                      setConfirm(false);
                    }}
                  />
                )}
                <ConfigurationEditor
                  value={type === 'methods' ? withoutBindings(draft) : draft}
                  onChange={(next) => {
                    setDraft(type === 'methods' ? withManaged(next, draft) : next);
                    setPreview(null);
                    setConfirm(false);
                  }}
                />
              </>
            ) : (
              <Text>Consultez les exigences ci-dessous. Pour adapter le contenu, préparez une nouvelle version.</Text>
            )}
            {write && editing && (
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
                Utiliser pour les nouveaux risques
              </Button>
            </Card>
          ))}
        {type === 'frameworks' && definitionSelection && !editing && (
          <>
            <div className="rfs-informations">
              <span>{definitionSelection.requirements.length} exigences</span>
              <span>{LIBELLES_SOURCE[definitionSelection.source.status] ?? definitionSelection.source.status}</span>
            </div>
            <ExigencesReferentiel definition={definitionSelection} limite={requirementLimit} />
            <div className="rfs-chargement">
              <span>
                {Math.min(requirementLimit, definitionSelection.requirements.length)} exigences affichées sur{' '}
                {definitionSelection.requirements.length}
              </span>
              {definitionSelection.requirements.length > requirementLimit && (
                <Button variant="subtle" onClick={() => setRequirementLimit((n) => n + 50)}>
                  Afficher 50 exigences supplémentaires
                </Button>
              )}
            </div>
            <div className="rfs-registre-pied">
              <Text size="xs">Le contenu est celui de la publication ; aucun texte ISO sous licence n’est fourni.</Text>
              {selection && write && can('pilotage', 'administrer') && (
                <PromotionBouton smsi={smsi} id={selection.id} />
              )}
            </div>
          </>
        )}
      </Stack>
      {type === 'frameworks' && <LegacyFrameworks smsi={smsi} />}
      {sourceOuverte && definitionSelection && (
        <SourceReferentiel
          definition={definitionSelection}
          versionFiche={selection?.version}
          versionPubliee={history.data?.length ? Math.max(...history.data.map((h) => h.version)) : undefined}
          actif={!!selection?.data.enabled}
          onClose={() => setSourceOuverte(false)}
        />
      )}
    </Stack>
  );
}

import { Alert, Button, Card, Group, Modal, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { GRC_KINDS, GRC_LABELS, GRC_MODULES, type GrcKind, type GrcObject } from '@suivi/shared';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get, saveBlob } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { MappingForm } from '../grc/MappingForm';
export function Registry({
  smsi,
  fixedKind,
  onOpen,
  onEvaluation,
  onRelation,
  onCreate,
  choices,
}: {
  smsi: string;
  choices?: GrcKind[];
  fixedKind?: GrcKind;
  onOpen: (o: GrcObject) => void;
  onEvaluation: (o: GrcObject) => void;
  onRelation: (ref: string) => void;
  onCreate?: (kind: GrcKind) => void;
}) {
  const can = useCan(),
    [kind, setKind] = useState<GrcKind>(choices?.[0] ?? 'measure'),
    [search, setSearch] = useState(''),
    [error, setError] = useState<unknown>(null),
    qc = useQueryClient();
  const k = fixedKind ?? kind;
  const list = useInfiniteQuery({
    queryKey: ['grc', smsi, 'objects', k, search],
    queryFn: ({ pageParam }) =>
      get<{ items: GrcObject[]; total: number; nextOffset: number | null }>(
        `/api/grc/${smsi}/objects?kind=${k}&search=${encodeURIComponent(search)}&offset=${pageParam}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (p) => p.nextOffset ?? undefined,
    enabled: can(GRC_MODULES[k], 'lire'),
  });
  return (
    <Stack>
      {!fixedKind && (
        <Group>
          <Select
            label="Type de fiche"
            value={kind}
            onChange={(v) => v && setKind(v as GrcKind)}
            data={(choices ?? GRC_KINDS)
              .filter((k) => !['framework', 'requirement', 'mapping'].includes(k) && can(GRC_MODULES[k], 'lire'))
              .map((k) => ({ value: k, label: GRC_LABELS[k] }))}
          />
          {can(GRC_MODULES[k], 'modifier') && (
            <Button onClick={() => onCreate?.(k)}>Créer {GRC_LABELS[k].toLowerCase()}</Button>
          )}
        </Group>
      )}
      <TextInput
        label="Rechercher dans le registre"
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />
      <ErrorAlert error={error ?? list.error} />
      <Text size="sm">{list.data?.pages[0]?.total ?? 0} fiches</Text>
      {list.data?.pages
        .flatMap((p) => p.items)
        .map((o) => (
          <Card withBorder key={o.id}>
            <Stack>
              <Text fw={600}>{o.name}</Text>
              <Text size="sm">
                Version {o.version} · {o.updatedBy}
              </Text>
              <Text>{String(o.data.description ?? '')}</Text>
              <Group>
                <Button variant="light" onClick={() => onOpen(o)}>
                  Ouvrir la fiche
                </Button>
                <Button variant="default" onClick={() => onRelation('object:' + o.id)}>
                  Liens et preuves
                </Button>
                {o.kind === 'risk' && <Button onClick={() => onEvaluation(o)}>Apprécier / réévaluer</Button>}
                {o.kind === 'treatment' && can('ecarts', 'modifier') && (
                  <Button
                    onClick={async () => {
                      try {
                        const action = await api<GrcObject>('POST', `/api/grc/${smsi}/treatments/${o.id}/action`, {
                          body: { name: 'Mettre en œuvre : ' + o.name, dueAt: null, ownerId: o.data.ownerId ?? null },
                        });
                        await qc.invalidateQueries({ queryKey: ['grc', smsi] });
                        onOpen(action);
                      } catch (e) {
                        setError(e);
                      }
                    }}
                  >
                    Générer une action de traitement
                  </Button>
                )}
              </Group>
            </Stack>
          </Card>
        ))}
      {list.hasNextPage && (
        <Button variant="light" onClick={() => void list.fetchNextPage()}>
          Charger les 50 suivantes
        </Button>
      )}
    </Stack>
  );
}
export function MappingPanel({ smsi }: { smsi: string }) {
  const can = useCan(),
    qc = useQueryClient(),
    [note, setNote] = useState(''),
    [confirm, setConfirm] = useState<GrcObject | null>(null),
    [detail, setDetail] = useState<GrcObject | null>(null),
    [editing, setEditing] = useState<GrcObject | null>(null),
    [error, setError] = useState<unknown>(null);
  const list = useInfiniteQuery({
    queryKey: ['grc', smsi, 'mappings'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      get<{ items: GrcObject[]; nextOffset: number | null }>(
        `/api/grc/${smsi}/objects?kind=mapping&offset=${pageParam}`,
      ),
    getNextPageParam: (p) => p.nextOffset ?? undefined,
  });
  const history = useQuery({
    queryKey: ['grc', smsi, 'mapping-history', detail?.id],
    queryFn: () =>
      get<{ version: number; createdBy: string; createdAt: string; reason: string; snapshot: GrcObject }[]>(
        `/api/grc/${smsi}/objects/${detail!.id}/history`,
      ),
    enabled: !!detail,
  });
  return (
    <Stack>
      <Alert>
        Une correspondance décrit deux exigences de versions précises. Les propositions, y compris d’origine IA, ne
        contribuent à la couverture qu’après validation humaine.
      </Alert>
      <ErrorAlert error={error ?? list.error} />
      {can('conformite', 'modifier') && <MappingForm smsi={smsi} />}
      {list.data?.pages
        .flatMap((p) => p.items)
        .map((m) => (
          <Card withBorder key={m.id}>
            <Text>
              {m.name} · {String(m.data.status)} · {String(m.data.origin)}
            </Text>
            <Text>{String(m.data.justification)}</Text>
            <Text size="sm">
              Fiche version {m.version} · {m.updatedBy} · {new Date(m.updatedAt).toLocaleString('fr-FR')}
            </Text>
            <Button variant="light" onClick={() => setDetail(m)}>
              Historique et détail
            </Button>
            {can('conformite', 'modifier') && (
              <Button variant="subtle" onClick={() => setEditing(m)}>
                Modifier la correspondance
              </Button>
            )}
            <Text>
              Couverture justifiée : {Number(m.data.coverage)} % · {String(m.data.type)}
            </Text>
            <Button
              variant="subtle"
              disabled={!can('import_export', 'exporter') || !can('conformite', 'exporter')}
              onClick={async () => {
                try {
                  await get(`/api/grc/${smsi}/export/authorize?kind=frameworks`);
                  saveBlob('mapping-' + m.id + '.json', JSON.stringify(m, null, 2));
                } catch (e) {
                  setError(e);
                }
              }}
            >
              Exporter la fiche
            </Button>
            {can('conformite', 'administrer') && m.data.status !== 'validated' && (
              <Button onClick={() => setConfirm(m)}>Revue humaine</Button>
            )}
          </Card>
        ))}
      {list.hasNextPage && (
        <Button variant="light" onClick={() => void list.fetchNextPage()}>
          Charger les 50 correspondances suivantes
        </Button>
      )}
      <Modal opened={!!editing} onClose={() => setEditing(null)} title="Modifier la correspondance" size="lg">
        <Alert>
          Une modification remet la correspondance à l’état proposé. Sa couverture validée exige une nouvelle revue
          humaine.
        </Alert>
        {editing && (
          <MappingForm
            key={editing.id + editing.version}
            smsi={smsi}
            object={editing}
            onSaved={() => setEditing(null)}
          />
        )}
      </Modal>
      <Modal
        opened={!!detail}
        onClose={() => setDetail(null)}
        title="Historique de la correspondance"
        closeButtonProps={{ 'aria-label': 'Fermer l’historique' }}
        size="lg"
      >
        <Stack>
          <ErrorAlert error={history.error} />
          {history.data?.map((h) => (
            <Card key={h.version} withBorder>
              <Text fw={600}>
                Version {h.version} · {h.createdBy} · {new Date(h.createdAt).toLocaleString('fr-FR')}
              </Text>
              <Text>{h.reason}</Text>
              <Text component="pre">{JSON.stringify(h.snapshot.data, null, 2)}</Text>
            </Card>
          ))}
        </Stack>
      </Modal>
      <Modal opened={!!confirm} onClose={() => setConfirm(null)} title="Valider la correspondance">
        <Stack>
          <Textarea
            label="Décision et justification de la revue humaine"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
          <Button
            onClick={async () => {
              try {
                await api('POST', `/api/grc/${smsi}/mappings/${confirm!.id}/validate`, {
                  ifMatch: confirm!.version,
                  body: { note, confirm: 'VALIDER' },
                });
                setConfirm(null);
                await qc.invalidateQueries({ queryKey: ['grc', smsi] });
              } catch (e) {
                setError(e);
              }
            }}
          >
            Confirmer la validation humaine
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

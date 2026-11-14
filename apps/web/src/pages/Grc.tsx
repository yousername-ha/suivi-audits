import { Button, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { GRC_KINDS, GRC_LABELS, GRC_MODULES, type GrcKind, type GrcObject } from '@suivi/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { ficheCliquable } from '../fiche-cliquable';
import { ActionDeTraitement } from '../grc/ActionDeTraitement';
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
    [traitement, setTraitement] = useState<GrcObject | null>(null);
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
              .filter((k) => !['framework', 'requirement'].includes(k) && can(GRC_MODULES[k], 'lire'))
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
      <ErrorAlert error={list.error} />
      <Text size="sm">{list.data?.pages[0]?.total ?? 0} fiches</Text>
      {list.data?.pages
        .flatMap((p) => p.items)
        .map((o) => (
          <Card withBorder key={o.id} {...ficheCliquable(() => onOpen(o), `Afficher ${o.name}`)}>
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
                  <Button onClick={() => setTraitement(o)}>Générer une action de traitement</Button>
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
      {traitement && (
        <ActionDeTraitement
          key={traitement.id}
          smsi={smsi}
          traitement={traitement}
          opened
          onClose={() => setTraitement(null)}
          onCree={(action) => {
            setTraitement(null);
            onOpen(action);
          }}
        />
      )}
    </Stack>
  );
}

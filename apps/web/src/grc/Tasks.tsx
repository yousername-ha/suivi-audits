import { Alert, Badge, Button, Card, Checkbox, Group, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { BusinessPolicy, GrcObject, TaskData } from '@suivi/shared';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { libelleDesignation, SelecteurResponsable, useProposables } from '../components/selecteurs';
import { enRetard, validationDe } from './etat-action';
import { Timeline } from './Timeline';
const views = [
  { value: 'list', label: 'Liste' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'calendar', label: 'Calendrier' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'gantt', label: 'Planning / Gantt' },
  { value: 'dashboard', label: 'Tableau de bord' },
];
export function Tasks({
  smsi,
  policy,
  onOpen,
}: {
  smsi: string;
  policy: BusinessPolicy;
  onOpen: (o: GrcObject) => void;
}) {
  const [view, setView] = useState(policy.display.defaultTaskView),
    [month, setMonth] = useState(new Date().toISOString().slice(0, 7)),
    [search, setSearch] = useState(''),
    [owner, setOwner] = useState<string | null>(null),
    [status, setStatus] = useState<string | null>(null),
    [showClosed, setShowClosed] = useState(policy.display.showClosed);
  const first = new Date(month + '-01T00:00:00Z'),
    last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 23, 59, 59));
  const list = useQuery({
    queryKey: ['grc', smsi, 'tasks', month],
    queryFn: () =>
      get<{ items: GrcObject[] }>(`/api/grc/${smsi}/tasks/window?from=${first.toISOString()}&to=${last.toISOString()}`),
  });
  const all = useInfiniteQuery({
    queryKey: ['grc', smsi, 'tasks-all', search, status, owner],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      get<{ items: GrcObject[]; total: number; nextOffset: number | null }>(
        `/api/grc/${smsi}/tasks?${new URLSearchParams({ search, offset: String(pageParam), ...(status ? { status } : {}), ...(owner ? { ownerId: owner } : {}) })}`,
      ),
    getNextPageParam: (p) => p.nextOffset ?? undefined,
    enabled: view === 'list' || view === 'kanban' || view === 'timeline',
  });
  const summary = useQuery({
    queryKey: ['grc', smsi, 'task-dashboard'],
    queryFn: () =>
      get<{
        summary: { total: number; closed: number; overdue: number; unassigned: number };
        byStatus: { status: string; count: number }[];
      }>(`/api/grc/${smsi}/tasks/dashboard`),
  });
  const proposables = useProposables(smsi);
  const items = (
    view === 'list' || view === 'kanban' || view === 'timeline'
      ? (all.data?.pages.flatMap((p) => p.items) ?? [])
      : (list.data?.items ?? [])
  ).filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) &&
      (!owner || o.data.ownerId === owner) &&
      (!status || o.data.status === status) &&
      (showClosed ||
        (!(o.data.legacy && o.data.status === 'done') &&
          !policy.statuses.find((s) => s.id === o.data.status)?.terminal)),
  );
  const card = (o: GrcObject) => (
    <Card withBorder key={o.id}>
      <Stack gap="xs">
        <Button variant="subtle" onClick={() => onOpen(o)}>
          {o.name}
        </Button>
        <Text size="sm">
          {policy.statuses.find((s) => s.id === o.data.status)?.label ??
            (o.data.status === 'done' ? 'Terminée (historique)' : 'À faire (historique)')}{' '}
          · {String(o.data.priority)}
        </Text>
        <Text size="sm">{o.data.dueAt ? new Date(String(o.data.dueAt)).toLocaleString('fr-FR') : 'Sans échéance'}</Text>
        {enRetard(o, policy) && (
          <Badge variant="light" color="red">
            ! En retard
          </Badge>
        )}
        {Boolean(o.data.seriesId) && <Badge variant="light">Occurrence récurrente</Badge>}
        {validationDe(o) && (
          <Badge variant="light" color="teal">
            Validée : {validationDe(o)}
          </Badge>
        )}
      </Stack>
    </Card>
  );
  const days = Array.from({ length: last.getUTCDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  return (
    <Stack>
      <Group>
        <Select label="Vue synchronisée" data={views} value={view} onChange={(v) => v && setView(v as typeof view)} />
        <TextInput
          label="Mois"
          type="month"
          value={month}
          onChange={(e) => {
            if (/^\d{4}-\d{2}$/.test(e.currentTarget.value)) setMonth(e.currentTarget.value);
          }}
        />
        <TextInput label="Rechercher une action" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
        <SelecteurResponsable smsi={smsi} value={owner} onChange={setOwner} sansRecherche />
        <Select
          label="État"
          clearable
          value={status}
          onChange={setStatus}
          data={policy.statuses.map((s) => ({ value: s.id, label: s.label }))}
        />
      </Group>
      <Checkbox
        label="Afficher les actions closes"
        checked={showClosed}
        onChange={(e) => setShowClosed(e.currentTarget.checked)}
      />
      <ErrorAlert error={list.error ?? all.error} />
      {(view === 'list' || view === 'kanban' || view === 'timeline') && all.hasNextPage && (
        <Button variant="light" onClick={() => void all.fetchNextPage()}>
          Charger les 50 actions suivantes
        </Button>
      )}
      <ErrorAlert error={summary.error} />
      {view === 'list' && (
        <Table.ScrollContainer
          minWidth={650}
          scrollAreaProps={{
            viewportProps: { tabIndex: 0, role: 'region', 'aria-label': 'Tableau, défilement horizontal possible' },
          }}
        >
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Action</Table.Th>
                <Table.Th>État</Table.Th>
                <Table.Th>Responsable</Table.Th>
                <Table.Th>Échéance</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((o) => (
                <Table.Tr key={o.id}>
                  <Table.Td>
                    <Button variant="subtle" onClick={() => onOpen(o)}>
                      {o.name}
                    </Button>
                  </Table.Td>
                  <Table.Td>
                    {policy.statuses.find((s) => s.id === o.data.status)?.label ??
                      (o.data.status === 'done' ? 'Terminée (historique)' : 'À faire (historique)')}
                  </Table.Td>
                  <Table.Td>{libelleDesignation(o.data, proposables.data)}</Table.Td>
                  <Table.Td>
                    {o.data.dueAt ? new Date(String(o.data.dueAt)).toLocaleDateString('fr-FR') : 'Sans échéance'}
                    {enRetard(o, policy) && (
                      <Badge ml="xs" variant="light" color="red">
                        ! En retard
                      </Badge>
                    )}
                    {validationDe(o) && (
                      <Badge ml="xs" variant="light" color="teal">
                        Validée : {validationDe(o)}
                      </Badge>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      {view === 'kanban' && (
        <div className="grc-kanban">
          {policy.statuses.map((s) => (
            <Stack key={s.id}>
              <Text fw={600}>
                {s.label} ({items.filter((o) => o.data.status === s.id).length})
              </Text>
              {items.filter((o) => o.data.status === s.id).map(card)}
            </Stack>
          ))}
        </div>
      )}
      {view === 'calendar' && (
        <>
          <div className="grc-calendar">
            {(policy.display.weekStartsOn === 0
              ? ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
              : ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
            ).map((d) => (
              <Text key={d} fw={600}>
                {d}
              </Text>
            ))}
            {Array.from({ length: (first.getUTCDay() + 7 - policy.display.weekStartsOn) % 7 }, (_, i) => (
              <div key={'empty' + i} />
            ))}
            {days.map((d) => (
              <Card withBorder key={d}>
                <Text fw={600}>{d.slice(-2)}</Text>
                {items
                  .filter((o) => String(o.data.dueAt).startsWith(d))
                  .map((o) => (
                    <Button key={o.id} variant="subtle" size="compact-xs" onClick={() => onOpen(o)}>
                      {o.name}
                    </Button>
                  ))}
              </Card>
            ))}
          </div>
          <Text size="sm">Sans échéance</Text>
          {items.filter((o) => !o.data.dueAt).map(card)}
        </>
      )}
      {view === 'timeline' && <Timeline items={items} policy={policy} onOpen={onOpen} />}
      {view === 'gantt' && (
        <div className="grc-planning">
          <svg
            role="img"
            aria-label="Planning des actions et dépendances"
            viewBox={`0 0 1100 ${Math.max(100, items.length * 42 + 50)}`}
          >
            <text x="280" y="20">
              {month} — début et échéance réels
            </text>
            {days
              .filter((_, i) => i % 5 === 0)
              .map((d) => (
                <text key={d} x={280 + (Number(d.slice(-2)) - 1) * 25} y="40">
                  {d.slice(-2)}
                </text>
              ))}
            {items.map((o, i) => {
              const t = o.data as TaskData,
                day = (s: string | null) =>
                  s ? Math.max(0, Math.min(30, (new Date(s).getTime() - first.getTime()) / 86400000)) : 0,
                x = 280 + day(t.startAt ?? t.dueAt) * 25,
                w = Math.max(8, (day(t.dueAt) - day(t.startAt ?? t.dueAt)) * 25);
              return (
                <g
                  key={o.id}
                  role="button"
                  tabIndex={0}
                  aria-label={o.name}
                  onClick={() => onOpen(o)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onOpen(o);
                  }}
                >
                  <text x="5" y={i * 42 + 70}>
                    {o.name.slice(0, 32)}
                  </text>
                  <rect
                    x={x}
                    y={i * 42 + 55}
                    width={w}
                    height="22"
                    rx="5"
                    fill={policy.statuses.find((s) => s.id === t.status)?.color ?? 'var(--carte-vert-accent)'}
                  />
                  {t.dependencies.map((id) => {
                    const j = items.findIndex((o) => o.id === id);
                    return j < 0 ? null : (
                      <path
                        key={id}
                        d={`M 265 ${j * 42 + 65} L 270 ${j * 42 + 65} L 270 ${i * 42 + 65} L ${x} ${i * 42 + 65}`}
                        fill="none"
                        stroke="var(--carte-bleu-accent)"
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      )}
      {view === 'dashboard' && summary.data && (
        <>
          <div className="grc-dashboard-grid">
            {Object.entries({
              Total: summary.data.summary.total,
              Terminées: summary.data.summary.closed,
              'En retard': summary.data.summary.overdue,
              'Sans responsable': summary.data.summary.unassigned,
            }).map(([name, n]) => (
              <Card withBorder key={name}>
                <Text>{name}</Text>
                <Text size="xl" fw={600}>
                  {n}
                </Text>
              </Card>
            ))}
          </div>
          {summary.data.byStatus.map((s) => (
            <Text key={s.status}>
              {policy.statuses.find((x) => x.id === s.status)?.label} : {s.count}
            </Text>
          ))}
        </>
      )}
      {!items.length && view !== 'dashboard' && <Alert>Aucune action dans cette période et ces filtres.</Alert>}
    </Stack>
  );
}

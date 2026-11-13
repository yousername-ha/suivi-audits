import { ListeDefilante, retenirFocusFiche } from '@suivi/ui';
import { ValidationRapide } from './ValidationRapide';
import { ficheCliquable } from '../fiche-cliquable';
import { Alert, Badge, Button, Card, Checkbox, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import type { BusinessPolicy, GrcObject, RegistreDto, TaskData } from '@suivi/shared';
import { useFiltreUrl } from '../components/filtre-url';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { libelleDesignation, SelecteurResponsable, useProposables } from '../components/selecteurs';
import { definirListeCourante } from '../registres/liste-courante';
import { enRetard, validationDe } from './etat-action';
import { BasculesFond, useJoursDeFond, type FamilleFond } from './jours-de-fond';
import { EtatTache, IconeCycle, TimelineStudio, tonTache } from './TimelineStudio';
const views = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'list', label: 'Liste' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'calendar', label: 'Calendrier' },
  { value: 'gantt', label: 'Planning / Gantt' },
  { value: 'dashboard', label: 'Tableau de bord' },
];
export function Tasks({
  smsi,
  policy,
  onOpen,
  occurrences = false,
  seriesPanel,
}: {
  smsi: string;
  policy: BusinessPolicy;
  onOpen: (o: GrcObject) => void;
  occurrences?: boolean;
  seriesPanel?: ReactNode;
}) {
  // Filtres conservés dans l'adresse (retour depuis une fiche, lien partagé) : vue, mois, recherche, responsable, état, registre.
  const [vue, setVue] = useFiltreUrl('tvue', 'timeline'),
    [month, setMonth] = useFiltreUrl('tmois', new Date().toISOString().slice(0, 7)),
    [search, setSearch] = useFiltreUrl('tq', ''),
    [responsable, setResponsable] = useFiltreUrl('tresp', ''),
    [etat, setEtat] = useFiltreUrl('tetat', ''),
    [registre, setRegistre] = useFiltreUrl('treg', ''),
    [clos, setClos] = useFiltreUrl('tclos', policy.display.showClosed ? '1' : '0'),
    [feries, setFeries] = useFiltreUrl('tferies', '0'),
    [fermetures, setFermetures] = useFiltreUrl('tfermetures', '0'),
    [serie, setSerie] = useFiltreUrl('tserie', '');
  const [panel, setPanel] = useState('occurrences');
  const [paused, setPaused] = useState(false);
  const [validationRapide, setValidationRapide] = useState<GrcObject | null>(null);
  const [validationOuverte, setValidationOuverte] = useState(false);
  const ouvrirValidation = (o: GrcObject, declencheur: HTMLButtonElement) => {
    retenirFocusFiche(declencheur);
    setValidationRapide(o);
    setValidationOuverte(true);
  };
  const view = (views.some((v) => v.value === vue) ? vue : 'timeline') as (typeof views)[number]['value'],
    setView = setVue,
    owner = responsable || null,
    setOwner = (v: string | null) => setResponsable(v ?? ''),
    status = etat || null,
    setStatus = (v: string | null) => setEtat(v ?? ''),
    showClosed = clos === '1',
    setShowClosed = (v: boolean) => setClos(v ? '1' : '0');
  const fondActif = { feries: feries === '1', autres: fermetures === '1' },
    fond = useJoursDeFond(fondActif),
    basculerFond = (f: FamilleFond, actif: boolean) => (f === 'feries' ? setFeries : setFermetures)(actif ? '1' : '0');
  const registres = useQuery({
    queryKey: ['registres', 'filtre-taches', smsi],
    queryFn: () => get<{ items: RegistreDto[] }>('/api/registres?archives=false'),
  });
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
  const series = useInfiniteQuery({
    queryKey: ['grc', smsi, 'business-register', 'task_series', ''],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      get<{ items: GrcObject[]; total: number; nextOffset: number | null }>(
        `/api/grc/${smsi}/objects?kind=task_series&search=&offset=${pageParam}`,
      ),
    getNextPageParam: (p) => p.nextOffset ?? undefined,
    enabled: occurrences,
  });
  const seriesItems = series.data?.pages.flatMap((p) => p.items) ?? [];
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
      (!registre || o.registreId === registre) &&
      (!status || o.data.status === status) &&
      (!occurrences || (!!o.data.seriesId && (!serie || o.data.seriesId === serie))) &&
      (showClosed ||
        (!(o.data.legacy && o.data.status === 'done') &&
          !policy.statuses.find((s) => s.id === o.data.status)?.terminal)),
  );
  // La liste affichée (ordre et filtres compris) sert à enchaîner la validation sur l'occurrence suivante de cette liste.
  const idsAffiches = items.map((o) => o.id).join(',');
  useEffect(() => {
    definirListeCourante(idsAffiches ? idsAffiches.split(',') : []);
    return () => definirListeCourante([]);
  }, [idsAffiches]);
  const card = (o: GrcObject) => (
    <Card
      withBorder
      key={o.id}
      {...ficheCliquable(() => onOpen(o), `Afficher ${o.name}`)}
      className="task-secondary-card"
      data-tone={tonTache(o, policy)}
    >
      <Stack gap="xs">
        <Button variant="subtle" onClick={() => onOpen(o)}>
          {o.name}
        </Button>
        <EtatTache objet={o} policy={policy} />
        <Text size="sm">{String(o.data.priority)}</Text>
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
    <Stack className="tasks-studio" data-motion={paused ? 'off' : 'on'}>
      {validationRapide && (
        <ValidationRapide
          key={validationRapide.id}
          object={validationRapide}
          opened={validationOuverte}
          onClose={() => setValidationOuverte(false)}
          onOpen={onOpen}
        />
      )}
      <div className="tasks-studio-heading">
        <div>
          <small>ACTIONS / PILOTAGE OPÉRATIONNEL</small>
          <h2>{occurrences ? 'Gardez le rythme de vos contrôles' : 'Faites avancer vos engagements'}</h2>
          <p>
            {occurrences
              ? 'Séries, échéances et résultats, dans une même lecture.'
              : 'Les actions, leurs responsables et leurs échéances réelles.'}
          </p>
        </div>
        <button type="button" className="task-button" onClick={() => setPaused(!paused)} aria-pressed={paused}>
          {paused ? '▷ Reprendre les animations' : 'Ⅱ Mettre les animations en pause'}
        </button>
      </div>
      <div className="task-metrics">
        {(occurrences
          ? [
              {
                label: 'Séries récurrentes',
                value: series.data?.pages[0]?.total ?? 0,
                note: 'Définitions disponibles',
                tone: 'blue',
              },
              {
                label: 'Occurrences affichées',
                value: items.length,
                note: 'Selon les filtres et les pages chargées',
                tone: 'teal',
              },
              {
                label: 'En attente',
                value: items.filter((o) => !validationDe(o)).length,
                note: 'Résultat non renseigné',
                tone: 'amber',
              },
              {
                label: 'Échéances dépassées',
                value: items.filter((o) => enRetard(o, policy)).length,
                note: 'Sans validation',
                tone: 'red',
              },
            ]
          : [
              {
                label: 'Actions affichées',
                value: items.length,
                note: 'Selon les filtres et les pages chargées',
                tone: 'blue',
              },
              {
                label: 'À faire',
                value: items.filter((o) => o.data.status === 'todo').length,
                note: 'Statut de la politique métier',
                tone: 'amber',
              },
              {
                label: 'Échéances dépassées',
                value: items.filter((o) => enRetard(o, policy)).length,
                note: 'Actions ouvertes en retard',
                tone: 'red',
              },
              {
                label: 'Terminées ou validées',
                value: items.filter(
                  (o) => validationDe(o) || policy.statuses.find((s) => s.id === o.data.status)?.terminal,
                ).length,
                note: 'Parmi les actions affichées',
                tone: 'teal',
              },
            ]
        ).map((m) => (
          <div className="task-metric" data-tone={m.tone} key={m.label}>
            <span className="task-metric-icon">
              <IconeCycle kind={m.tone === 'red' ? 'warning' : 'cycle'} />
            </span>
            <span>
              <small>{m.label}</small>
              <em>{m.note}</em>
            </span>
            <b>{m.value}</b>
          </div>
        ))}
      </div>
      {occurrences && seriesPanel && (
        <div className="task-panel-tabs" role="group" aria-label="Registre récurrent">
          <button
            type="button"
            className="task-button"
            aria-pressed={panel === 'occurrences'}
            onClick={() => setPanel('occurrences')}
          >
            Occurrences
          </button>
          <button
            type="button"
            className="task-button"
            aria-pressed={panel === 'series'}
            onClick={() => setPanel('series')}
          >
            Séries et réglages
          </button>
        </div>
      )}
      {panel === 'series' ? (
        seriesPanel
      ) : (
        <>
          <nav className="task-view-tabs" aria-label="Vues des actions">
            {views.map((v) => (
              <button type="button" key={v.value} aria-pressed={view === v.value} onClick={() => setView(v.value)}>
                {v.value === 'list' ? 'Liste compacte' : v.label}
                {v.value === 'timeline' && <small>PAR DÉFAUT</small>}
              </button>
            ))}
          </nav>
          <Group className="task-filter-bar">
            <Select
              label="Vue synchronisée"
              data={views}
              value={view}
              onChange={(v) => v && setView(v as typeof view)}
            />
            <TextInput
              label="Mois"
              type="month"
              value={month}
              onChange={(e) => {
                if (/^\d{4}-\d{2}$/.test(e.currentTarget.value)) setMonth(e.currentTarget.value);
              }}
            />
            <TextInput
              label="Rechercher une action"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <SelecteurResponsable smsi={smsi} value={owner} onChange={setOwner} sansRecherche />
            <Select
              label="Registre"
              description="Plans d’actions et tâches récurrentes que vous pouvez lire."
              clearable
              value={registre || null}
              onChange={(v) => setRegistre(v ?? '')}
              data={(registres.data?.items ?? [])
                .filter((r) => r.kind === 'plan_actions' || r.kind === 'recurrences')
                .map((r) => ({ value: r.id, label: r.name }))}
            />
            <Select
              label="État"
              clearable
              value={status}
              onChange={setStatus}
              data={policy.statuses.map((s) => ({ value: s.id, label: s.label }))}
            />
          </Group>
          <Checkbox
            label={occurrences ? 'Afficher les occurrences closes' : 'Afficher les actions closes'}
            checked={showClosed}
            onChange={(e) => setShowClosed(e.currentTarget.checked)}
          />
          {(view === 'calendar' || view === 'timeline') && (
            <>
              <BasculesFond actives={fondActif} onChange={basculerFond} />
              <ErrorAlert error={fond.erreur} />
            </>
          )}
          <ErrorAlert error={list.error ?? all.error} />
          {occurrences && <ErrorAlert error={series.error} />}
          {occurrences && series.hasNextPage && (
            <Button variant="light" onClick={() => void series.fetchNextPage()}>
              Charger les 50 séries suivantes
            </Button>
          )}
          {(view === 'list' || view === 'kanban' || view === 'timeline') && all.hasNextPage && (
            <Button variant="light" onClick={() => void all.fetchNextPage()}>
              Charger les 50 actions suivantes
            </Button>
          )}
          <ErrorAlert error={summary.error} />
          {view === 'list' && (
            <ListeDefilante label="Actions et occurrences, vue compacte">
              <table className="task-compact-list">
                <thead>
                  <tr className="task-compact-labels">
                    <th scope="col">Action / occurrence</th>
                    <th scope="col">Responsable</th>
                    <th scope="col">Échéance</th>
                    <th scope="col">État</th>
                    <th scope="col">Fiche</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((o) => (
                    <tr
                      className="task-compact-row"
                      data-tone={tonTache(o, policy)}
                      key={o.id}
                      {...ficheCliquable(() => onOpen(o), `Afficher ${o.name}`)}
                    >
                      <td className="task-compact-title">
                        <button type="button" className="task-title-button" onClick={() => onOpen(o)}>
                          {o.name}
                        </button>
                      </td>
                      <td>{libelleDesignation(o.data, proposables.data)}</td>
                      <td>
                        {o.data.dueAt ? new Date(String(o.data.dueAt)).toLocaleDateString('fr-FR') : 'Sans échéance'}
                        {enRetard(o, policy) && <small className="task-late">⚠ En retard</small>}
                      </td>
                      <td>
                        <EtatTache objet={o} policy={policy} />
                      </td>
                      <td className="task-compact-open">
                        <button
                          type="button"
                          className="task-button"
                          aria-label={`Ouvrir ${o.name}`}
                          onClick={() => onOpen(o)}
                        >
                          ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ListeDefilante>
          )}
          {view === 'kanban' && (
            <div className="grc-kanban" role="region" aria-label="Kanban des actions, défilement possible" tabIndex={0}>
              {policy.statuses.map((s) => (
                <Stack key={s.id} role="group" aria-label={`Colonne ${s.label}`}>
                  <Text fw={600} className="grc-kanban__titre">
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
                  <Card
                    withBorder
                    key={d}
                    className={fond.jours.some((j) => j.date === d) ? 'grc-calendar__fond' : undefined}
                  >
                    <Text fw={600}>{d.slice(-2)}</Text>
                    {fond.jours
                      .filter((j) => j.date === d)
                      .map((j) => (
                        <Text key={j.calendrier + j.label} size="xs" className="grc-calendar__fond-libelle">
                          {j.famille === 'feries' ? 'Férié' : 'Fermé'} : {j.label}
                        </Text>
                      ))}
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
          {view === 'timeline' && (
            <TimelineStudio
              items={items}
              series={seriesItems}
              occurrences={occurrences}
              policy={policy}
              onOpen={onOpen}
              onValidate={ouvrirValidation}
              ownerOf={(o) => libelleDesignation(o.data, proposables.data)}
              fond={fond.jours}
            />
          )}
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
          {!items.length && view !== 'dashboard' && view !== 'timeline' && (
            <Alert>Aucune action dans cette période et ces filtres.</Alert>
          )}
          {occurrences && serie && (
            <Button variant="subtle" onClick={() => setSerie('')}>
              Retrouver toutes les séries
            </Button>
          )}
        </>
      )}
    </Stack>
  );
}

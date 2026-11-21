/* Plan d'actions et tâches récurrentes (refonte Neon, lot 6, ADR 0093) : vues synchronisées (Timeline Studio, liste
   compacte, Kanban, calendrier, Gantt, tableau de bord) sur les mêmes données, filtres et commandes que la version
   précédente. La vue par défaut reste celle de la politique métier du périmètre (« Vue des actions par défaut »). */
import { Alert, Badge, Button, Card, Checkbox, Group, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import type { BusinessPolicy, GrcObject, RegistreDto, TaskData } from '@suivi/shared';
import { DataTable, retenirFocusFiche } from '@suivi/ui';
import { useFiltreUrl } from '../components/filtre-url';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { BoiteOutils, FiltreColonne, PastillesCriteres, type CritereActif } from '../components/BarreOutils';
import { libelleDesignation, SelecteurResponsable, useProposables, useResponsables } from '../components/selecteurs';
import { ficheCliquable } from '../fiche-cliquable';
import { useOngletVisible } from '../parcours-iso/mouvement';
import { definirListeCourante } from '../registres/liste-courante';
import { enRetard, estOccurrence, tonStatut, tonTache, validationDe } from './etat-action';
import { BasculesFond, useJoursDeFond, type FamilleFond } from './jours-de-fond';
import { EtatTache, ResultatTache, type OuvrirResultat } from './TimelineCommun';
import { TimelineStudio } from './TimelineStudio';
import { ValidationRapide } from './ValidationRapide';

const views = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'list', label: 'Liste' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'calendar', label: 'Calendrier' },
  { value: 'gantt', label: 'Planning / Gantt' },
  { value: 'dashboard', label: 'Tableau de bord' },
] as const;
type Vue = (typeof views)[number]['value'];
type Page = { items: GrcObject[]; total: number; nextOffset: number | null };

/** Pictogramme de chaque vue (décoratif : le nom de la vue est porté par le bouton et son info-bulle). */
function IconeVue({ vue }: { vue: Vue }) {
  const d: Record<Vue, string> = {
    timeline: 'M4 4v16M7 7h7M10 12h10M7 17h6',
    list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    kanban: 'M4 4h4.5v16H4zM10 4h4.5v10H10zM16 4h4v13h-4z',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
    gantt: 'M4 5h7M8 10h9M13 15h7M6 20h8M11 5v5M17 10v5',
    dashboard: 'M4 4h7v8H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 14h7v6H4z',
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d[vue]} />
    </svg>
  );
}

export function Tasks({
  smsi,
  policy,
  onOpen,
  occurrences = false,
  outils,
}: {
  smsi: string;
  policy: BusinessPolicy;
  onOpen: (o: GrcObject) => void;
  /** Commandes d'ajout placées au bout de la barre d'outils commune (en-tête compact, 7.3.0). */
  outils?: ReactNode;
  /** Page Tâches récurrentes : Timeline adaptée à la périodicité, regroupée par série. */
  occurrences?: boolean;
}) {
  // Filtres conservés dans l'adresse (retour depuis une fiche, lien partagé) : vue, mois, recherche, responsable, état, registre.
  const [vue, setVue] = useFiltreUrl('tvue', policy.display.defaultTaskView),
    [month, setMonth] = useFiltreUrl('tmois', new Date().toISOString().slice(0, 7)),
    [search, setSearch] = useFiltreUrl('tq', ''),
    [responsable, setResponsable] = useFiltreUrl('tresp', ''),
    [etat, setEtat] = useFiltreUrl('tetat', ''),
    [registre, setRegistre] = useFiltreUrl('treg', ''),
    [clos, setClos] = useFiltreUrl('tclos', policy.display.showClosed ? '1' : '0'),
    [feries, setFeries] = useFiltreUrl('tferies', '0'),
    [fermetures, setFermetures] = useFiltreUrl('tfermetures', '0');
  const view: Vue = views.some((v) => v.value === vue) ? (vue as Vue) : 'list',
    setView = setVue,
    owner = responsable || null,
    setOwner = (v: string | null) => setResponsable(v ?? ''),
    status = etat || null,
    setStatus = (v: string | null) => setEtat(v ?? ''),
    showClosed = clos === '1',
    setShowClosed = (v: boolean) => setClos(v ? '1' : '0');
  // Animation des tâches « à faire » en continu, sans bouton de pause (ADR 0099) : arrêtée quand l'onglet est masqué ; le
  // mouvement réduit du système, l'impression et les couleurs forcées l'arrêtent par neon-taches.css.
  const ongletVisible = useOngletVisible();
  // Barre d'outils discrète (lot 8) : loupe et raccourci « / » sur la recherche, pastilles des critères actifs. Les
  // champs de filtre restent affichés (vue, mois, responsable, registre, état) : rien n'est caché derrière un bouton.
  const responsables = useResponsables(smsi);
  // Petite fenêtre de résultat, ouverte depuis un repère de la Timeline ; le repère retrouve le focus à sa fermeture.
  const [resultat, setResultat] = useState<GrcObject | null>(null),
    [resultatOuvert, setResultatOuvert] = useState(false);
  const ouvrirResultat: OuvrirResultat = (o, declencheur) => {
    retenirFocusFiche(declencheur as HTMLElement);
    // Une tâche historique se réalise dans sa source, par sa fiche (date, commentaire, justificatif).
    if (o.id.startsWith('legacy:')) return onOpen(o);
    setResultat(o);
    setResultatOuvert(true);
  };
  const fondActif = { feries: feries === '1', autres: fermetures === '1' },
    fond = useJoursDeFond(fondActif),
    basculerFond = (f: FamilleFond, actif: boolean) => (f === 'feries' ? setFeries : setFermetures)(actif ? '1' : '0');
  const registres = useQuery({
    queryKey: ['registres', 'filtre-taches', smsi],
    queryFn: () => get<{ items: RegistreDto[] }>('/api/registres?archives=false'),
  });
  const responsableChoisi = (responsables.data ?? []).find((r) => r.id === owner);
  const criteresTaches: CritereActif[] = [
    ...(search ? [{ cle: 'tq', libelle: 'Recherche', valeur: search, retirer: () => setSearch('') }] : []),
    ...(owner
      ? [
          {
            cle: 'tresp',
            libelle: 'Responsable',
            valeur: responsableChoisi ? responsableChoisi.displayName || responsableChoisi.username : 'sélectionné',
            retirer: () => setOwner(null),
          },
        ]
      : []),
    ...(registre
      ? [
          {
            cle: 'treg',
            libelle: 'Registre',
            valeur: (registres.data?.items ?? []).find((r) => r.id === registre)?.name ?? 'sélectionné',
            retirer: () => setRegistre(''),
          },
        ]
      : []),
    ...(status
      ? [
          {
            cle: 'tetat',
            libelle: 'État',
            valeur: policy.statuses.find((x) => x.id === status)?.label ?? status,
            retirer: () => setStatus(null),
          },
        ]
      : []),
  ];
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
      get<Page>(
        `/api/grc/${smsi}/tasks?${new URLSearchParams({ search, offset: String(pageParam), ...(status ? { status } : {}), ...(owner ? { ownerId: owner } : {}) })}`,
      ),
    getNextPageParam: (p) => p.nextOffset ?? undefined,
    enabled: view === 'list' || view === 'kanban' || view === 'timeline',
  });
  // Séries de la Timeline des récurrences (nom, rythme, échelle Auto) : même requête que le registre des séries de la page.
  const series = useInfiniteQuery({
    queryKey: ['grc', smsi, 'objects', 'task_series', ''],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => get<Page>(`/api/grc/${smsi}/objects?kind=task_series&search=&offset=${pageParam}`),
    getNextPageParam: (p) => p.nextOffset ?? undefined,
    enabled: occurrences && view === 'timeline',
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
  const ownerOf = (o: GrcObject) => libelleDesignation(o.data, proposables.data);
  const filtrees = (
    view === 'list' || view === 'kanban' || view === 'timeline'
      ? (all.data?.pages.flatMap((p) => p.items) ?? [])
      : (list.data?.items ?? [])
  ).filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) &&
      (!owner || o.data.ownerId === owner) &&
      (!registre || o.registreId === registre) &&
      (!status || o.data.status === status),
  );
  const items = filtrees.filter(
    (o) =>
      showClosed ||
      (!(o.data.legacy && o.data.status === 'done') && !policy.statuses.find((s) => s.id === o.data.status)?.terminal),
  );
  // Frise du plan d'actions : elle reçoit aussi les actions closes, qu'elle masque par ses bascules « Terminées » et
  // « Annulées » (par défaut, le filtre « Afficher les actions closes »).
  const itemsFrise = view === 'timeline' && !occurrences ? filtrees : items;
  // La liste affichée (ordre et filtres compris) sert à enchaîner la validation sur l'occurrence suivante de cette liste.
  const idsAffiches = items.map((o) => o.id).join(',');
  useEffect(() => {
    definirListeCourante(idsAffiches ? idsAffiches.split(',') : []);
    return () => definirListeCourante([]);
  }, [idsAffiches]);
  // Synthèse des fiches chargées et filtrées (les totaux du serveur sont dans le tableau de bord).
  const recurrentes = items.filter(estOccurrence);
  const metriques = occurrences
    ? [
        {
          label: 'Occurrences affichées',
          valeur: recurrentes.length,
          note: 'Fiches chargées et filtrées',
          ton: 'blue',
        },
        {
          label: 'Résultat en attente',
          valeur: recurrentes.filter((o) => !validationDe(o)).length,
          note: 'Ni OK, ni KO, ni NA',
          ton: 'amber',
        },
        {
          label: 'Échéances dépassées',
          valeur: recurrentes.filter((o) => enRetard(o, policy)).length,
          note: 'Sans résultat enregistré',
          ton: 'red',
        },
        {
          label: 'Résultats enregistrés',
          valeur: recurrentes.filter((o) => validationDe(o)).length,
          note: 'OK, KO ou NA au journal',
          ton: 'teal',
        },
      ]
    : [
        { label: 'Actions affichées', valeur: items.length, note: 'Fiches chargées et filtrées', ton: 'blue' },
        {
          label: 'À faire',
          valeur: items.filter((o) => tonStatut(policy, o.data.status) === 'amber' && !validationDe(o)).length,
          note: 'Premier état du parcours',
          ton: 'amber',
        },
        {
          label: 'Échéances dépassées',
          valeur: items.filter((o) => enRetard(o, policy)).length,
          note: 'Actions ouvertes',
          ton: 'red',
        },
        {
          label: 'Terminées ou validées',
          valeur: items.filter((o) => validationDe(o) || policy.statuses.find((s) => s.id === o.data.status)?.terminal)
            .length,
          note: 'Parmi les fiches affichées',
          ton: 'teal',
        },
      ];
  const card = (o: GrcObject) => (
    <Card
      withBorder
      key={o.id}
      {...ficheCliquable(() => onOpen(o), `Afficher ${o.name}`)}
      className="tache-carte"
      data-ton={tonTache(o, policy)}
    >
      <Stack gap="xs">
        <Button variant="subtle" onClick={() => onOpen(o)}>
          {o.name}
        </Button>
        <Group gap="xs">
          <EtatTache objet={o} policy={policy} />
          <Text size="sm">{String(o.data.priority)}</Text>
        </Group>
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
    <Stack className="taches-studio" data-mouvement={ongletVisible ? 'anime' : 'pause'}>
      {resultat && (
        <ValidationRapide
          key={resultat.id}
          smsi={smsi}
          object={resultat}
          policy={policy}
          responsable={ownerOf(resultat)}
          opened={resultatOuvert}
          onClose={() => setResultatOuvert(false)}
          onOpen={onOpen}
        />
      )}
      <div className="taches-entete">
        <div
          className="taches-metriques"
          role="group"
          aria-label={occurrences ? 'Synthèse des occurrences affichées' : 'Synthèse des actions affichées'}
        >
          {metriques.map((m) => (
            <div className="taches-metrique" data-ton={m.ton} key={m.label}>
              <span className="taches-metrique__libelle">{m.label}</span>
              <span className="taches-metrique__valeur">{m.valeur}</span>
              <span className="taches-metrique__note">{m.note}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Boîte d'outils commune (7.3.0) : vues, recherche et filtres avancés ; État et Responsable se filtrent aussi sur le
          titre de leur colonne dans la liste. Ajouts au bout de la ligne. */}
      <BoiteOutils
        label="Outils des actions"
        vues={views.map((v) => ({ value: v.value, label: v.label, icone: <IconeVue vue={v.value} /> }))}
        vue={view}
        onVue={(v) => setView(v as Vue)}
        recherche={{ label: 'Rechercher une action', value: search, onChange: setSearch }}
        filtres={{
          actifs: [owner, registre, status, showClosed ? '1' : ''].filter(Boolean).length,
          onReinitialiser: () => {
            setOwner(null);
            setRegistre('');
            setStatus(null);
            setShowClosed(false);
          },
          contenu: (
            <>
              <Select
                allowDeselect={false}
                label="Vue synchronisée"
                data={views.map((v) => ({ value: v.value, label: v.label }))}
                value={view}
                onChange={(v) => v && setView(v)}
                comboboxProps={{ withinPortal: false }}
              />
              <TextInput
                label="Mois"
                type="month"
                value={month}
                onChange={(e) => {
                  if (/^\d{4}-\d{2}$/.test(e.currentTarget.value)) setMonth(e.currentTarget.value);
                }}
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
                comboboxProps={{ withinPortal: false }}
              />
              <Select
                label="État"
                clearable
                value={status}
                onChange={setStatus}
                data={policy.statuses.map((s) => ({ value: s.id, label: s.label }))}
                comboboxProps={{ withinPortal: false }}
              />
              <Checkbox
                label="Afficher les actions closes"
                checked={showClosed}
                onChange={(e) => setShowClosed(e.currentTarget.checked)}
              />
            </>
          ),
        }}
        ajout={outils}
      />
      <PastillesCriteres
        criteres={criteresTaches}
        onToutEffacer={() => {
          setSearch('');
          setOwner(null);
          setRegistre('');
          setStatus(null);
        }}
      />
      {/* Jours de fond : bascules au-dessus du calendrier ; dans la Timeline, elles sont dans la légende de la frise. */}
      {view === 'calendar' && <BasculesFond actives={fondActif} onChange={basculerFond} />}
      {(view === 'calendar' || view === 'timeline') && <ErrorAlert error={fond.erreur} />}
      <ErrorAlert error={list.error ?? all.error} />
      {occurrences && view === 'timeline' && <ErrorAlert error={series.error} />}
      {(view === 'list' || view === 'kanban' || view === 'timeline') && all.hasNextPage && (
        <Button variant="light" onClick={() => void all.fetchNextPage()}>
          Charger les 50 actions suivantes
        </Button>
      )}
      {occurrences && view === 'timeline' && series.hasNextPage && (
        <Button variant="light" onClick={() => void series.fetchNextPage()}>
          Charger les 50 séries suivantes
        </Button>
      )}
      <ErrorAlert error={summary.error} />
      {view === 'list' && (
        <DataTable label="Actions, vue compacte">
          <Table className="taches-liste">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Action</Table.Th>
                <Table.Th>
                  <FiltreColonne
                    libelle="État"
                    valeur={status}
                    options={policy.statuses.map((s) => ({ value: s.id, label: s.label }))}
                    onChange={setStatus}
                  />
                </Table.Th>
                <Table.Th>
                  <FiltreColonne
                    libelle="Responsable"
                    valeur={owner}
                    options={(responsables.data ?? []).map((r) => ({
                      value: r.id,
                      label: r.displayName || r.username,
                    }))}
                    onChange={setOwner}
                  />
                </Table.Th>
                <Table.Th>Échéance</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((o) => (
                <Table.Tr
                  key={o.id}
                  {...ficheCliquable(() => onOpen(o), `Afficher ${o.name}`)}
                  data-ton={tonTache(o, policy)}
                >
                  <Table.Td>
                    <Button
                      variant="subtle"
                      size="compact-sm"
                      className="taches-liste__titre"
                      onClick={() => onOpen(o)}
                    >
                      {o.name}
                    </Button>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <EtatTache objet={o} policy={policy} />
                      <ResultatTache objet={o} />
                    </Group>
                  </Table.Td>
                  <Table.Td>{ownerOf(o)}</Table.Td>
                  <Table.Td>
                    {o.data.dueAt ? new Date(String(o.data.dueAt)).toLocaleDateString('fr-FR') : 'Sans échéance'}
                    {enRetard(o, policy) && (
                      <Badge ml="xs" variant="light" color="red">
                        ! En retard
                      </Badge>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
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
                    <Button
                      key={o.id}
                      variant="subtle"
                      size="compact-xs"
                      className="taches-calendrier__tache"
                      data-ton={tonTache(o, policy)}
                      onClick={() => onOpen(o)}
                    >
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
          items={itemsFrise}
          series={seriesItems}
          occurrences={occurrences}
          policy={policy}
          onOpen={onOpen}
          onResultat={ouvrirResultat}
          ownerOf={ownerOf}
          fond={fond.jours}
          fondActif={fondActif}
          onFond={basculerFond}
          closes={showClosed}
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
      {!itemsFrise.length && view !== 'dashboard' && <Alert>Aucune action dans cette période et ces filtres.</Alert>}
    </Stack>
  );
}

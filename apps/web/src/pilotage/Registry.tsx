import { Badge, Button, Card, Group, Menu, Modal, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import {
  ECART_CLASSIFICATION_LABELS,
  GRC_LABELS,
  GRC_MODULES,
  classificationEcart,
  type GrcKind,
  type GrcObject,
  type PilotageRecord,
} from '@suivi/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { download, get } from '../api';
import { ErrorAlert } from '../components/common';
import { Filtres } from '../components/Filtres';
import { useCan } from '../session';
import { OPERATION_LABELS } from './Decision';
import { useFiltreUrl } from '../components/filtre-url';
import { useResponsables } from '../components/selecteurs';
import { idObjetDeRef, lienContexte } from '../retour';
const STATES: Record<string, string> = {
  draft: 'À préparer',
  review: 'À valider',
  validated: 'Validé',
  rejected: 'À corriger',
  open: 'Ouvert',
  progress: 'En cours',
  effectiveness: 'À vérifier',
  closed: 'Clos',
  scheduled: 'Planifié',
  active: 'En cours',
  paused: 'Suspendu',
  planned: 'Planifié',
  done: 'Réalisé',
  pass: 'Réussi',
  partial: 'Partiellement réussi',
  fail: 'Non réussi',
  accepted: 'Accepté',
  completed: 'Réalisé',
  effective: 'Efficace',
  ineffective: 'Non efficace',
  identified: 'Identifiée',
  evaluated: 'Évaluée',
  pursued: 'Poursuivie',
  realised: 'Réalisée',
  dropped: 'Écartée',
};
export function stateLabel(value: unknown) {
  return STATES[String(value)] ?? String(value ?? '—');
}
type Page = { items: GrcObject[]; total: number; nextOffset: number | null };
/** Classification et lien de récidive d'un constat, affichés dans la liste (la classification de l'outil de suivi
    historique est reprise telle quelle). */
function EtiquettesEcart({ o, taille }: { o: GrcObject; taille?: 'xs' }) {
  const classification = classificationEcart(o.data);
  return (
    <>
      {classification && (
        <Badge size={taille} variant="light" color={classification === 'majeure' ? 'red' : 'gray'}>
          {ECART_CLASSIFICATION_LABELS[classification]}
        </Badge>
      )}
      {typeof o.data.recidiveRef === 'string' && o.data.recidiveRef && (
        <Badge size={taille} variant="light" color="orange">
          Récidive
        </Badge>
      )}
    </>
  );
}
export function BusinessRegistry({
  smsi,
  kind,
  legacyKey,
  onOpen,
  onCreate,
  onDecision,
  onSchedule,
}: {
  smsi: string;
  kind: GrcKind;
  legacyKey?: string;
  onOpen: (o: GrcObject) => void;
  /** `init` : valeurs préremplies de la fiche créée (par exemple l'audit d'origine ou le constat dont c'est la récidive). */
  onCreate: (k: GrcKind, init?: Record<string, unknown>) => void;
  onDecision: (o: GrcObject, operation: PilotageRecord['operation']) => void;
  onSchedule?: (o: GrcObject) => void;
}) {
  const can = useCan(),
    emplacement = useLocation(),
    [search, setSearch] = useFiltreUrl('q', ''),
    [history, setHistory] = useState<GrcObject | null>(null),
    [fEtat, setFEtat] = useFiltreUrl('etat', 'all'),
    [fResp, setFResp] = useFiltreUrl('resp', 'all'),
    [fEcheance, setFEcheance] = useFiltreUrl('ech', 'all'),
    [fOrigine, setFOrigine] = useFiltreUrl('orig', 'all');
  const native = useInfiniteQuery({
    queryKey: ['grc', smsi, 'business-register', kind, search],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      get<Page>(`/api/grc/${smsi}/objects?kind=${kind}&search=${encodeURIComponent(search)}&offset=${pageParam}`),
    getNextPageParam: (p) => p.nextOffset ?? undefined,
  });
  const historical = useInfiniteQuery({
    queryKey: ['grc', smsi, 'legacy-register', legacyKey, search],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      get<Page>(
        `/api/grc/${smsi}/pilotage/legacy/${legacyKey}?search=${encodeURIComponent(search)}&offset=${pageParam}`,
      ),
    getNextPageParam: (p) => p.nextOffset ?? undefined,
    enabled:
      !!legacyKey &&
      smsi === '00000000-0000-4000-8000-000000000001' &&
      (legacyKey !== 'evidences' || can('pilotage', 'lire')),
  });
  const decisions = useInfiniteQuery({
    queryKey: ['grc', smsi, 'decision-history', history?.id],
    initialPageParam: '' as string,
    queryFn: ({ pageParam }) =>
      get<{
        items: {
          id: string;
          operation: PilotageRecord['operation'];
          result: string;
          date: string;
          note: string;
          refs: string[];
          createdBy: string;
          createdAt: string;
          sourceVersion: number;
          generatedRefs: string[];
        }[];
        nextBefore: string | null;
        references: Record<string, { name: string; version: number }>;
        referencesTruncated: boolean;
      }>(
        `/api/grc/${smsi}/pilotage/history?ref=${encodeURIComponent(history!.id.startsWith('legacy:') ? history!.id : 'object:' + history!.id)}${pageParam ? '&before=' + encodeURIComponent(pageParam) : ''}`,
      ),
    getNextPageParam: (p) => p.nextBefore ?? undefined,
    enabled: !!history,
  });
  const owners = useResponsables(smsi);
  const toutes = [
    ...(native.data?.pages.flatMap((p) => p.items) ?? []),
    ...(historical.data?.pages.flatMap((p) => p.items) ?? []),
  ];
  const writable = can(GRC_MODULES[kind], 'modifier');
  const date = (v: unknown) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—');
  const owner = (o: GrcObject) =>
    owners.data?.find((u) => u.id === o.data.ownerId)?.displayName || String(o.data.ownerLabel || 'Non attribué');
  const state = (o: GrcObject) =>
    kind === 'nonconformity' && o.data.effectiveness === 'effective' && o.data.status !== 'closed'
      ? 'Efficacité vérifiée'
      : stateLabel(o.data.status ?? o.data.result);
  const echeanceDe = (o: GrcObject) =>
    String(o.data.dueAt ?? o.data.reviewAt ?? o.data.validUntil ?? o.data.plannedAt ?? '').slice(0, 10);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const etats = [...new Set(toutes.map(state))].sort();
  const responsables = [...new Set(toutes.map(owner))].sort();
  const rows = toutes.filter(
    (o) =>
      (fEtat === 'all' || state(o) === fEtat) &&
      (fResp === 'all' || owner(o) === fResp) &&
      (fOrigine === 'all' || (fOrigine === 'existant') === o.id.startsWith('legacy:')) &&
      (fEcheance === 'all' ||
        (fEcheance === 'sans' && !echeanceDe(o)) ||
        (fEcheance === 'retard' && !!echeanceDe(o) && echeanceDe(o) < aujourdhui && o.data.status !== 'closed') ||
        (fEcheance === 'avenir' && !!echeanceDe(o) && echeanceDe(o) >= aujourdhui)),
  );
  const filtresActifs = [fEtat, fResp, fEcheance, fOrigine].filter((f) => f !== 'all').length;
  const actions = (o: GrcObject) => {
    const editable = writable && o.data.status !== 'closed';
    const primary =
      kind === 'evidence'
        ? 'proof_review'
        : kind === 'control'
          ? 'control_execution'
          : kind === 'nonconformity'
            ? 'effectiveness'
            : null;
    return (
      <Group gap="xs">
        <Button variant="light" size="xs" onClick={() => onOpen(o)}>
          Ouvrir
        </Button>
        {editable && primary && (
          <Button variant="default" size="xs" onClick={() => onDecision(o, primary)}>
            {primary === 'proof_review'
              ? 'Examiner'
              : primary === 'control_execution'
                ? 'Réaliser le contrôle'
                : 'Vérifier l’efficacité'}
          </Button>
        )}
        {editable &&
          ['bia', 'continuity_plan', 'management_review'].includes(kind) &&
          can('pilotage', 'administrer') && (
            <Button variant="default" size="xs" onClick={() => onDecision(o, 'approval')}>
              Valider
            </Button>
          )}
        <Menu>
          <Menu.Target>
            <Button variant="subtle" size="xs" aria-label={'Autres actions pour ' + o.name}>
              Autres actions
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {editable && kind === 'control' && can('ecarts', 'modifier') && !o.data.seriesRef && (
              <Menu.Item onClick={() => onSchedule?.(o)}>Planifier les répétitions</Menu.Item>
            )}
            {editable && kind === 'nonconformity' && (
              <Menu.Item onClick={() => onDecision(o, 'close')}>Clôturer le constat</Menu.Item>
            )}
            {writable && kind === 'nonconformity' && o.data.status === 'closed' && (
              <Menu.Item onClick={() => onDecision(o, 'reopen')}>Rouvrir le constat</Menu.Item>
            )}
            {kind === 'nonconformity' && idObjetDeRef(o.data.auditRef) && (
              <Menu.Item
                component={Link}
                to={lienContexte('audits', idObjetDeRef(o.data.auditRef)!, emplacement.pathname + emplacement.search)}
              >
                Voir l’audit d’origine
              </Menu.Item>
            )}
            {kind === 'nonconformity' && idObjetDeRef(o.data.recidiveRef) && (
              <Menu.Item
                component={Link}
                to={lienContexte(
                  'ecarts',
                  idObjetDeRef(o.data.recidiveRef)!,
                  emplacement.pathname + emplacement.search,
                )}
              >
                Voir le constat précédent
              </Menu.Item>
            )}
            {writable && kind === 'nonconformity' && o.data.status === 'closed' && !o.id.startsWith('legacy:') && (
              <Menu.Item
                onClick={() =>
                  onCreate('nonconformity', {
                    name: `Récidive : ${o.name}`.slice(0, 200),
                    recidiveRef: 'object:' + o.id,
                    auditRef: o.data.auditRef ?? null,
                    classification: o.data.classification ?? '',
                    findingType: o.data.findingType,
                    origin: o.data.origin,
                  })
                }
              >
                Déclarer une récidive
              </Menu.Item>
            )}
            {kind === 'audit' && can('ecarts', 'modifier') && !o.id.startsWith('legacy:') && (
              <Menu.Item onClick={() => onCreate('nonconformity', { auditRef: 'object:' + o.id, origin: 'audit' })}>
                Constater un écart pour cet audit
              </Menu.Item>
            )}
            {editable &&
              [
                'nonconformity',
                'control',
                'management_review',
                'continuity_exercise',
                'continuity_plan',
                'bia',
                'objective',
              ].includes(kind) &&
              can('ecarts', 'modifier') && (
                <Menu.Item onClick={() => onDecision(o, 'action_create')}>Créer une action suivie</Menu.Item>
              )}
            {kind === 'management_review' && can('pilotage', 'exporter') && (
              <>
                <Menu.Item onClick={() => download(`/api/grc/${smsi}/pilotage/revue/${o.id}/export?format=docx`)}>
                  Compte rendu (Word)
                </Menu.Item>
                <Menu.Item onClick={() => download(`/api/grc/${smsi}/pilotage/revue/${o.id}/export?format=pptx`)}>
                  Support de présentation (PowerPoint)
                </Menu.Item>
                <Menu.Item onClick={() => download(`/api/grc/${smsi}/pilotage/revue/${o.id}/export?format=xlsx`)}>
                  Classeur (Excel)
                </Menu.Item>
              </>
            )}
            <Menu.Item onClick={() => setHistory(o)}>Décisions et réalisations</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    );
  };
  return (
    <Stack>
      <Group justify="space-between">
        <Group align="flex-end">
          <TextInput label="Rechercher" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
          <Filtres
            actifs={filtresActifs}
            onReinitialiser={() => {
              setFEtat('all');
              setFResp('all');
              setFEcheance('all');
              setFOrigine('all');
            }}
          >
            <Select
              label="État"
              allowDeselect={false}
              data={[{ value: 'all', label: 'Tous les états' }, ...etats.map((e) => ({ value: e, label: e }))]}
              value={fEtat}
              onChange={(v) => setFEtat(v ?? 'all')}
            />
            <Select
              label="Responsable"
              allowDeselect={false}
              data={[{ value: 'all', label: 'Tous' }, ...responsables.map((e) => ({ value: e, label: e }))]}
              value={fResp}
              onChange={(v) => setFResp(v ?? 'all')}
            />
            <Select
              label="Échéance"
              allowDeselect={false}
              data={[
                { value: 'all', label: 'Toutes' },
                { value: 'retard', label: 'Dépassée' },
                { value: 'avenir', label: 'À venir' },
                { value: 'sans', label: 'Sans échéance' },
              ]}
              value={fEcheance}
              onChange={(v) => setFEcheance(v ?? 'all')}
            />
            <Select
              label="Origine"
              allowDeselect={false}
              data={[
                { value: 'all', label: 'Toutes' },
                { value: 'existant', label: 'Existant (outil de suivi)' },
                { value: 'natif', label: 'Créé dans le Pilotage' },
              ]}
              value={fOrigine}
              onChange={(v) => setFOrigine(v ?? 'all')}
            />
          </Filtres>
        </Group>
        {writable && (
          <Button onClick={() => onCreate(kind)}>
            {kind === 'nonconformity'
              ? 'Ajouter un constat'
              : kind === 'journey'
                ? 'Démarrer mon parcours'
                : 'Ajouter ' + GRC_LABELS[kind].toLowerCase()}
          </Button>
        )}
      </Group>
      <ErrorAlert error={native.error ?? historical.error} />
      <Text size="sm">
        {filtresActifs
          ? `${rows.length} sur ${toutes.length} affichées`
          : `${(native.data?.pages[0]?.total ?? 0) + (historical.data?.pages[0]?.total ?? 0)} `}
        {filtresActifs ? '' : kind === 'nonconformity' ? 'constats' : 'fiches'}
      </Text>
      {!rows.length && !native.isPending && (
        <Card withBorder>
          <Text>
            Aucune fiche pour le moment. Ajoutez votre premier élément ou recherchez dans les données existantes.
          </Text>
        </Card>
      )}
      <Table.ScrollContainer
        minWidth={650}
        scrollAreaProps={{
          viewportProps: { tabIndex: 0, role: 'region', 'aria-label': 'Tableau, défilement horizontal possible' },
        }}
        visibleFrom="sm"
      >
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Intitulé</Table.Th>
              <Table.Th>État</Table.Th>
              <Table.Th>Responsable</Table.Th>
              <Table.Th>Échéance</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((o) => (
              <Table.Tr key={o.id}>
                <Table.Td>
                  <Text fw={600}>{o.name}</Text>
                  <Text size="xs" c="dimmed">
                    {String(o.data.description ?? '').slice(0, 120)}
                  </Text>
                  {o.id.startsWith('legacy:') && (
                    <Badge size="xs" variant="light">
                      Existant
                    </Badge>
                  )}
                  {kind === 'nonconformity' && <EtiquettesEcart o={o} taille="xs" />}
                  {Array.isArray(o.data.auditedFrameworks) && (o.data.auditedFrameworks as unknown[]).length > 0 && (
                    <Badge size="xs" variant="light" color="encre">
                      {(o.data.auditedFrameworks as unknown[]).length > 1 ? 'Audit combiné : ' : 'Audit : '}
                      {(o.data.auditedFrameworks as string[]).join(' + ')}
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  {state(o)}
                  {kind === 'control' && o.data.result !== undefined && (
                    <Text size="sm">Dernier résultat : {stateLabel(o.data.result)}</Text>
                  )}
                </Table.Td>
                <Table.Td>{owner(o)}</Table.Td>
                <Table.Td>{date(o.data.dueAt ?? o.data.reviewAt ?? o.data.validUntil ?? o.data.plannedAt)}</Table.Td>
                <Table.Td>{actions(o)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Stack hiddenFrom="sm">
        {rows.map((o) => (
          <Card key={o.id} withBorder>
            <Stack gap="xs">
              <Text fw={600}>{o.name}</Text>
              <Text size="sm">{String(o.data.description ?? '').slice(0, 120)}</Text>
              {o.id.startsWith('legacy:') && <Badge variant="light">Existant</Badge>}
              {kind === 'nonconformity' && <EtiquettesEcart o={o} />}
              <Text size="sm">
                {state(o)} · {owner(o)}
              </Text>
              {kind === 'control' && o.data.result !== undefined && (
                <Text size="sm">Dernier résultat : {stateLabel(o.data.result)}</Text>
              )}
              <Text size="sm">
                Échéance : {date(o.data.dueAt ?? o.data.reviewAt ?? o.data.validUntil ?? o.data.plannedAt)}
              </Text>
              {actions(o)}
            </Stack>
          </Card>
        ))}
      </Stack>
      <Group>
        {native.hasNextPage && (
          <Button variant="light" onClick={() => void native.fetchNextPage()}>
            Afficher les fiches suivantes
          </Button>
        )}
        {historical.hasNextPage && (
          <Button variant="light" onClick={() => void historical.fetchNextPage()}>
            Afficher les données existantes suivantes
          </Button>
        )}
      </Group>
      <Modal
        opened={!!history}
        onClose={() => setHistory(null)}
        title="Décisions et réalisations"
        size="lg"
        closeButtonProps={{ 'aria-label': 'Fermer l’historique' }}
      >
        <Stack>
          <Text fw={600}>{history?.name}</Text>
          <ErrorAlert error={decisions.error} />
          {decisions.data?.pages
            .flatMap((p) => p.items)
            .map((h) => (
              <Card key={h.id} withBorder>
                <Stack gap="xs">
                  <Text fw={600}>
                    {OPERATION_LABELS[h.operation]} · {stateLabel(h.result)}
                  </Text>
                  <Text size="sm">
                    {date(h.date)} · {h.createdBy} · Fiche version {h.sourceVersion}
                  </Text>
                  <Text>{h.note}</Text>
                  {h.refs.map((ref) => (
                    <Text size="sm" key={ref}>
                      {decisions.data?.pages.find((p) => p.references[ref])?.references[ref]?.name ??
                        'Justificatif conservé'}
                      {ref.startsWith('document:') ? ' · Document examiné, version ' + ref.split(':')[2] : ''}
                    </Text>
                  ))}
                  {h.generatedRefs.length > 0 && (
                    <Text size="sm">
                      {h.generatedRefs.length} action(s) ou constat(s) créé(s) dans les registres communs.
                    </Text>
                  )}
                </Stack>
              </Card>
            ))}
          {decisions.data && !decisions.data.pages[0]?.items.length && (
            <Text>Aucune décision enregistrée pour cette fiche.</Text>
          )}
          {decisions.data?.pages.some((p) => p.referencesTruncated) && (
            <Text size="sm">
              Certaines références restent identifiées dans l’export ; la résolution des libellés est limitée à 200 par
              page.
            </Text>
          )}
          {decisions.hasNextPage && (
            <Button onClick={() => void decisions.fetchNextPage()}>Voir les décisions précédentes</Button>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}

import { Badge, Box, Button, Card, Group, Menu, Modal, Stack, Table, Text, Title } from '@mantine/core';
import { DataTable, ListeDefilante } from '@suivi/ui';
import {
  ECART_CLASSIFICATION_LABELS,
  GRC_LABELS,
  GRC_MODULES,
  classificationEcart,
  LIBELLES_NATURE_CONSTAT,
  NATURES_CONSTAT,
  natureConstat,
  type NatureConstat,
  type GrcKind,
  type GrcObject,
  type PilotageRecord,
  jourParis,
} from '@suivi/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { download, get } from '../api';
import { ErrorAlert } from '../components/common';
import { ficheCliquable } from '../fiche-cliquable';
import { BoiteOutils, Surligne, type CriterePuces } from '../components/BarreOutils';
import { compterPuces, correspond, textesFiche } from '../components/recherche-liste';
import { useCan } from '../session';
import { OPERATION_LABELS } from './Decision';
import { useFiltreUrl } from '../components/filtre-url';
import { usePerimetres, useResponsables } from '../components/selecteurs';
import { PartiesInteresseesStudio } from './PartiesInteresseesStudio';
import { idObjetDeRef, lienContexte } from '../retour';
import { SwotMatrice } from './SwotMatrice';
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
function stateLabel(value: unknown) {
  return STATES[String(value)] ?? String(value ?? '—');
}
type Page = { items: GrcObject[]; total: number; nextOffset: number | null };
/** Rouge : majeure ; orange foncé : mineure ; violet : point sensible. Le libellé est toujours écrit : la couleur ne porte
    jamais seule l'information. */
const COULEUR_CLASSIFICATION = { majeure: 'red', mineure: 'orange', point_sensible: 'violet' } as const;
/** Classification et lien de récidive d'un constat, affichés dans la liste (la classification de l'outil de suivi
    historique est reprise telle quelle). */
function EtiquettesEcart({ o, taille }: { o: GrcObject; taille?: 'xs' }) {
  const classification = classificationEcart(o.data);
  return (
    <>
      {classification && (
        <Badge size={taille} variant="light" color={COULEUR_CLASSIFICATION[classification]}>
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
    [fOrigine, setFOrigine] = useFiltreUrl('orig', 'all'),
    [fClassif, setFClassif] = useFiltreUrl('classif', 'all'),
    // Nature d'un constat (lien d'une barre « Audits et constats » du tableau de bord, style « Verre », 27/11/2026).
    [fNature, setFNature] = useFiltreUrl('nature', 'all');
  /* Recherche (refonte Verre, 27/11/2026) : dans l'intitulé et dans le texte des fiches (description, responsable,
     état…), sur la liste chargée. Tant que toutes les pages ne sont pas chargées, la recherche par intitulé du serveur
     complète le résultat, comme avant : aucune fiche trouvée jusqu'ici par son intitulé n'est perdue. */
  const terme = search.trim();
  const pageNative = (q: string) => (offset: number) =>
    get<Page>(`/api/grc/${smsi}/objects?kind=${kind}&search=${encodeURIComponent(q)}&offset=${offset}`);
  const pageHistorique = (q: string) => (offset: number) =>
    get<Page>(`/api/grc/${smsi}/pilotage/legacy/${legacyKey}?search=${encodeURIComponent(q)}&offset=${offset}`);
  const historiqueLisible =
    !!legacyKey &&
    smsi === '00000000-0000-4000-8000-000000000001' &&
    (legacyKey !== 'evidences' || can('pilotage', 'lire'));
  const native = useInfiniteQuery({
    queryKey: ['grc', smsi, 'business-register', kind, ''],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => pageNative('')(pageParam),
    getNextPageParam: (p) => p.nextOffset ?? undefined,
  });
  const historical = useInfiniteQuery({
    queryKey: ['grc', smsi, 'legacy-register', legacyKey, ''],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => pageHistorique('')(pageParam),
    getNextPageParam: (p) => p.nextOffset ?? undefined,
    enabled: historiqueLisible,
  });
  const nativeCherche = useInfiniteQuery({
    queryKey: ['grc', smsi, 'business-register', kind, terme],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => pageNative(terme)(pageParam),
    getNextPageParam: (p) => p.nextOffset ?? undefined,
    enabled: !!terme && !!native.hasNextPage,
  });
  const historicalCherche = useInfiniteQuery({
    queryKey: ['grc', smsi, 'legacy-register', legacyKey, terme],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => pageHistorique(terme)(pageParam),
    getNextPageParam: (p) => p.nextOffset ?? undefined,
    enabled: historiqueLisible && !!terme && !!historical.hasNextPage,
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
  const chargees = new Set(toutes.map((o) => o.id));
  // Fiches trouvées par le serveur (intitulé) dans les pages pas encore chargées.
  const complement = terme
    ? [
        ...((native.hasNextPage && nativeCherche.data?.pages.flatMap((p) => p.items)) || []),
        ...((historical.hasNextPage && historicalCherche.data?.pages.flatMap((p) => p.items)) || []),
      ].filter((o) => !chargees.has(o.id))
    : [];
  const total = (native.data?.pages[0]?.total ?? 0) + (historical.data?.pages[0]?.total ?? 0);
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
  const aujourdhui = jourParis();
  const echeanceCle = (o: GrcObject) => {
    const e = echeanceDe(o);
    if (!e) return 'sans';
    if (e < aujourdhui && o.data.status !== 'closed') return 'retard';
    return e >= aujourdhui ? 'avenir' : null;
  };
  const rows = [...toutes, ...complement].filter(
    (o) =>
      correspond(textesFiche(o, state(o), owner(o)), terme) &&
      (fEtat === 'all' || state(o) === fEtat) &&
      (fResp === 'all' || owner(o) === fResp) &&
      (fOrigine === 'all' || (fOrigine === 'existant') === o.id.startsWith('legacy:')) &&
      (fClassif === 'all' || (classificationEcart(o.data) ?? 'non_classe') === fClassif) &&
      (fNature === 'all' || kind !== 'nonconformity' || natureConstat(o.data) === fNature) &&
      (fEcheance === 'all' ||
        (fEcheance === 'sans' && !echeanceDe(o)) ||
        (fEcheance === 'retard' && !!echeanceDe(o) && echeanceDe(o) < aujourdhui && o.data.status !== 'closed') ||
        (fEcheance === 'avenir' && !!echeanceDe(o) && echeanceDe(o) >= aujourdhui)),
  );
  const filtresActifs = [fEtat, fResp, fEcheance, fOrigine, fClassif, fNature].filter((f) => f !== 'all').length;
  const reinitialiserFiltres = () => {
    setFEtat('all');
    setFResp('all');
    setFEcheance('all');
    setFOrigine('all');
    setFClassif('all');
    setFNature('all');
  };
  const ECHEANCES: Record<string, string> = { retard: 'Dépassée', avenir: 'À venir', sans: 'Sans échéance' };
  const ORIGINES: Record<string, string> = { existant: 'Existant (outil de suivi)', natif: 'Créé dans le Pilotage' };
  const valeur = (v: string) => (v === 'all' ? null : v);
  // Filtres en puces (refonte Verre, 27/11/2026) : valeurs présentes dans la liste chargée, avec leur nombre ; un critère
  // de plus de huit valeurs (responsables, par exemple) passe dans « Plus de filtres ». Mêmes paramètres d'adresse.
  const puces: CriterePuces[] = [
    {
      cle: 'etat',
      libelle: 'État',
      valeur: valeur(fEtat),
      options: compterPuces(toutes, state),
      onChange: (v) => setFEtat(v ?? 'all'),
    },
    {
      cle: 'ech',
      libelle: 'Échéance',
      valeur: valeur(fEcheance),
      options: compterPuces(toutes, echeanceCle, {
        ordre: ['retard', 'avenir', 'sans'],
        libelle: (v) => ECHEANCES[v] ?? v,
        ton: (v) => (v === 'retard' ? 'alerte' : undefined),
      }),
      onChange: (v) => setFEcheance(v ?? 'all'),
    },
    ...(kind === 'nonconformity'
      ? [
          {
            cle: 'classif',
            libelle: 'Classification',
            valeur: valeur(fClassif),
            options: compterPuces(toutes, (o) => classificationEcart(o.data) ?? 'non_classe', {
              ordre: [...(Object.keys(ECART_CLASSIFICATION_LABELS) as string[]), 'non_classe'],
              libelle: (v) =>
                v === 'non_classe'
                  ? 'Non classé'
                  : (ECART_CLASSIFICATION_LABELS[v as keyof typeof ECART_CLASSIFICATION_LABELS] ?? v),
            }),
            onChange: (v: string | null) => setFClassif(v ?? 'all'),
          },
          {
            cle: 'nature',
            libelle: 'Nature',
            valeur: valeur(fNature),
            options: compterPuces(toutes, (o) => natureConstat(o.data), {
              ordre: NATURES_CONSTAT,
              libelle: (v) => LIBELLES_NATURE_CONSTAT[v as NatureConstat] ?? v,
            }),
            onChange: (v: string | null) => setFNature(v ?? 'all'),
          },
        ]
      : []),
    {
      cle: 'resp',
      libelle: 'Responsable',
      valeur: valeur(fResp),
      options: compterPuces(toutes, owner),
      onChange: (v) => setFResp(v ?? 'all'),
    },
    {
      cle: 'orig',
      libelle: 'Origine',
      valeur: valeur(fOrigine),
      options: compterPuces(toutes, (o) => (o.id.startsWith('legacy:') ? 'existant' : 'natif'), {
        ordre: ['existant', 'natif'],
        libelle: (v) => ORIGINES[v] ?? v,
      }),
      onChange: (v) => setFOrigine(v ?? 'all'),
    },
  ];
  const nomListe = kind === 'nonconformity' ? 'constats' : 'fiches';
  const titreListe = `${total} ${total > 1 ? nomListe : nomListe.slice(0, -1)}`;
  /* Parties intéressées (refonte Neon, lot 5) : panorama Studio par défaut ; le registre détaillé ci-dessous (filtres
     d'URL, commandes, décisions et réalisations) s'ouvre à la demande, ou d'emblée quand une recherche ou un filtre
     d'URL est actif. Il est replié par la feuille de styles (neon-parties.css), sans être démonté. */
  const [registreParties, setRegistreParties] = useState(!!search || !!filtresActifs);
  const titreRegistreParties = useRef<HTMLHeadingElement>(null);
  const nomPerimetre = usePerimetres(kind === 'stakeholder').data?.find((p) => p.id === smsi)?.name;
  const basculerRegistreParties = () => {
    const ouvert = !registreParties;
    setRegistreParties(ouvert);
    if (ouvert) requestAnimationFrame(() => titreRegistreParties.current?.focus());
  };
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
          {['context', 'stakeholder'].includes(kind) ? 'Afficher' : 'Ouvrir'}
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
        {editable && ['continuity_plan', 'management_review'].includes(kind) && can('pilotage', 'administrer') && (
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
                  'amelioration',
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
  const registre = (
    <Stack
      className={kind === 'stakeholder' ? 'pi-registry-shell' : undefined}
      data-registre-parties={kind === 'stakeholder' ? (registreParties ? 'ouvert' : 'replie') : undefined}
    >
      {kind === 'stakeholder' && (
        <div className="pi-registry-vue">
          {!registreParties && <ErrorAlert error={native.error ?? historical.error ?? owners.error} />}
          <PartiesInteresseesStudio
            objects={toutes}
            scopeName={nomPerimetre || 'Périmètre sélectionné'}
            owner={owner}
            writable={writable}
            loading={native.isPending || historical.isLoading}
            total={(native.data?.pages[0]?.total ?? 0) + (historical.data?.pages[0]?.total ?? 0)}
            onOpen={onOpen}
            onCreate={() => onCreate(kind)}
            onBrowse={basculerRegistreParties}
            registreOuvert={registreParties}
            pagination={
              !registreParties && (native.hasNextPage || historical.hasNextPage) ? (
                <Group className="pi-pagination">
                  {native.hasNextPage && (
                    <Button
                      variant="light"
                      loading={native.isFetchingNextPage}
                      onClick={() => void native.fetchNextPage()}
                    >
                      Afficher les fiches suivantes
                    </Button>
                  )}
                  {historical.hasNextPage && (
                    <Button
                      variant="light"
                      loading={historical.isFetchingNextPage}
                      onClick={() => void historical.fetchNextPage()}
                    >
                      Afficher les données existantes suivantes
                    </Button>
                  )}
                </Group>
              ) : null
            }
          />
        </div>
      )}
      {kind === 'stakeholder' && registreParties && (
        <Group justify="space-between" className="pi-registry-details">
          <Title order={2} size="h4" tabIndex={-1} ref={titreRegistreParties}>
            Registre détaillé des parties intéressées
          </Title>
          <Button
            variant="default"
            onClick={() => {
              setRegistreParties(false);
              requestAnimationFrame(() => document.getElementById('pi-bascule-registre')?.focus());
            }}
          >
            Replier le registre
          </Button>
        </Group>
      )}
      <BoiteOutils
        label="Outils du registre"
        titre={titreListe}
        total={total}
        affiches={rows.length}
        recherche={{
          label: `Rechercher dans les ${nomListe}`,
          value: search,
          onChange: setSearch,
          placeholder: 'Intitulé, description, responsable…',
        }}
        puces={puces}
        onToutEffacer={() => {
          setSearch('');
          reinitialiserFiltres();
        }}
        ajout={
          writable && (
            <Button onClick={() => onCreate(kind)}>
              {kind === 'nonconformity'
                ? 'Ajouter un constat'
                : kind === 'journey'
                  ? 'Démarrer mon parcours'
                  : 'Ajouter ' + GRC_LABELS[kind].toLowerCase()}
            </Button>
          )
        }
      />
      <ErrorAlert error={native.error ?? historical.error ?? nativeCherche.error ?? historicalCherche.error} />
      {kind === 'nonconformity' && (
        <Group gap="xs" role="group" aria-label="Légende des classifications d’écart">
          <Text size="xs">Classification :</Text>
          {(Object.keys(COULEUR_CLASSIFICATION) as (keyof typeof COULEUR_CLASSIFICATION)[]).map((c) => (
            <Badge key={c} size="xs" variant="light" color={COULEUR_CLASSIFICATION[c]}>
              {ECART_CLASSIFICATION_LABELS[c]}
            </Badge>
          ))}
        </Group>
      )}
      {!rows.length && !native.isPending && (
        <Card withBorder>
          <Text>
            {terme || filtresActifs
              ? 'Aucune fiche ne correspond à la recherche ou aux filtres.'
              : 'Aucune fiche pour le moment. Ajoutez votre premier élément ou recherchez dans les données existantes.'}
          </Text>
        </Card>
      )}
      <Box visibleFrom="sm">
        <DataTable label="Fiches du registre">
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
                <Table.Tr key={o.id} {...ficheCliquable(() => onOpen(o), `Afficher ${o.name}`)}>
                  <Table.Td>
                    <Text fw={600}>
                      <Surligne texte={o.name} recherche={terme} />
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      <Surligne texte={String(o.data.description ?? '').slice(0, 120)} recherche={terme} />
                    </Text>
                    {o.id.startsWith('legacy:') && (
                      <Badge size="xs" variant="light">
                        Existant
                      </Badge>
                    )}
                    {o.smsiId !== smsi && !o.id.startsWith('legacy:') && (
                      <Badge size="xs" variant="light" color="encre">
                        Registre partagé avec ce périmètre
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
        </DataTable>
      </Box>
      <Stack hiddenFrom="sm">
        <ListeDefilante className="fiches-mobiles" label="Fiches du registre, vue mobile">
          {rows.map((o) => (
            <Card key={o.id} withBorder {...ficheCliquable(() => onOpen(o), `Afficher ${o.name}`)}>
              <Stack gap="xs">
                <Text fw={600}>
                  <Surligne texte={o.name} recherche={terme} />
                </Text>
                <Text size="sm">
                  <Surligne texte={String(o.data.description ?? '').slice(0, 120)} recherche={terme} />
                </Text>
                {o.id.startsWith('legacy:') && <Badge variant="light">Existant</Badge>}
                {o.smsiId !== smsi && !o.id.startsWith('legacy:') && (
                  <Badge variant="light" color="encre">
                    Registre partagé avec ce périmètre
                  </Badge>
                )}
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
        </ListeDefilante>
      </Stack>
      <Group>
        {native.hasNextPage && (
          <Button variant="light" loading={native.isFetchingNextPage} onClick={() => void native.fetchNextPage()}>
            Afficher les fiches suivantes
          </Button>
        )}
        {historical.hasNextPage && (
          <Button variant="light" onClick={() => void historical.fetchNextPage()}>
            Afficher les données existantes suivantes
          </Button>
        )}
        {!!terme && (nativeCherche.hasNextPage || historicalCherche.hasNextPage) && (
          <Button
            variant="light"
            onClick={() => {
              if (nativeCherche.hasNextPage) void nativeCherche.fetchNextPage();
              if (historicalCherche.hasNextPage) void historicalCherche.fetchNextPage();
            }}
          >
            Afficher les autres fiches trouvées par leur intitulé
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
  // SWOT : la matrice Studio (refonte Neon, lot 5) précède le registre complet, conservé tel quel et toujours affiché.
  if (kind !== 'swot') return registre;
  return (
    <SwotMatrice
      smsi={smsi}
      objects={toutes}
      owners={owners.data ?? []}
      writable={writable}
      onOpen={onOpen}
      onCreate={() => onCreate(kind)}
      onHistory={setHistory}
    >
      {registre}
    </SwotMatrice>
  );
}

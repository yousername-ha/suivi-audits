/* Cartographie du SMSI (CARTO-01 à CARTO-14, ADR 0013) : vue contexte et vue processus, générées à partir des
   données de la plateforme puis ajustées à la main. La carte ne garde que la présentation ; les objets sont relus à
   chaque affichage et à chaque changement (temps réel). Lecture seule réelle sans cartographie:modifier. */
import {
  Alert,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  GENERATE_CONFIRM,
  GENERATE_MAX,
  MAP_VIEW_LABELS,
  MAP_VIEW_TITLES,
  REFERENTIELS,
  UNDO_LEVELS,
  addEdge,
  addObjects,
  blankLayout,
  cartoContext,
  computeScene,
  defaultGenerateOptions,
  deleteEdge,
  dropMissing,
  emptyLayout,
  generateLayout,
  hideRelation,
  ignoreObjects,
  moveGroup,
  pruneEdges,
  refModule,
  refreshLabels,
  relayout,
  removeNode,
  resetSize,
  selectForGeneration,
  setEdgeType,
  syncInfo,
  validateEdge,
  withDependencies,
  type CartoObject,
  type GenerateOptions,
  type MapLayout,
  type MapOut,
  type MapVersionOut,
  type MapView,
  type ObjectsOut,
  type Referentiel,
  type RelationType,
} from '@suivi/shared/carto';
import { ConfirmDialog, ErrorAlert, IconeCarte, Page, PageHeader } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router';
import { api, ApiError, errorMessage, get } from '../api';
import { Canevas, fitViewport, type Selection, type Viewport } from '../carto/Canevas';
import { Ajout, Assistant, Conflit, NouvelleRelation, Versions } from '../carto/Dialogues';
import { exporter, type FormatExport } from '../carto/exports';
import { Inspecteur } from '../carto/Inspecteur';
import { Panneau } from '../carto/Panneau';
import { usePresence, usePresenceOn } from '../realtime';
import { useCan, usePreferences } from '../session';

interface Travail {
  base: MapOut | null;
  layout: MapLayout | null;
  dirty: boolean;
  undo: MapLayout[];
  redo: MapLayout[];
}
const VIDE: Travail = { base: null, layout: null, dirty: false, undo: [], redo: [] };
const SEGMENT: Record<MapView, string> = { context: 'contexte', process: 'processus' };
const nouvelId = () => {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return 'e' + [...a].map((b) => b.toString(36).padStart(2, '0')).join('');
};
const dateHeure = (d: string) => {
  const x = new Date(d);
  return `${x.toLocaleDateString('fr-FR')} à ${x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

export function CartographiePage() {
  const params = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const can = useCan();
  const canEdit = can('cartographie', 'modifier'),
    canDelete = can('cartographie', 'supprimer'),
    canExport = can('cartographie', 'exporter');
  const { prefs, save } = usePreferences();
  const pc = useMemo(() => prefs.cartographie ?? {}, [prefs.cartographie]);
  const view: MapView =
    params.vue === 'processus' ? 'process' : params.vue === 'contexte' ? 'context' : (pc.vue ?? 'context');
  const large = useMediaQuery('(min-width: 160em)');

  /* ---------------------------------------------------------------- Données */
  const objetsQ = useQuery({ queryKey: ['carto', 'objects'], queryFn: () => get<ObjectsOut>('/api/carto/objects') });
  const cartesQ = useQuery({ queryKey: ['carto', 'maps'], queryFn: () => get<MapOut[]>('/api/carto/maps') });
  const objs = useMemo(
    () => new Map((objetsQ.data?.objects ?? []).map((o) => [o.ref, o as CartoObject])),
    [objetsQ.data],
  );
  const ctx = useMemo(() => cartoContext(objs), [objs]);
  const hidden = useMemo(() => new Set<string>(objetsQ.data?.hiddenModules ?? []), [objetsQ.data]);
  const inaccessible = useCallback((ref: string) => hidden.has(refModule(ref) ?? ''), [hidden]);
  const carte = cartesQ.data?.find((m) => m.view === view) ?? null;

  /* ---------------------------------------------------------------- Carte de travail (par vue) */
  const [travaux, setTravaux] = useState<Record<MapView, Travail>>({ context: VIDE, process: VIDE });
  const w = travaux[view];
  const layout = w.layout;
  useEffect(() => {
    if (!cartesQ.data) return;
    setTravaux((t) => {
      const cur = t[view];
      if (cur.dirty) return t;
      if (carte && cur.base?.id === carte.id && cur.base.version === carte.version && cur.layout) return t;
      if (!carte && !cur.base && !cur.layout) return t;
      return { ...t, [view]: { ...VIDE, base: carte, layout: carte?.layout ?? null } };
    });
  }, [cartesQ.data, carte, view]);
  const majTravail = (fn: (cur: Travail) => Travail) => setTravaux((t) => ({ ...t, [view]: fn(t[view]) }));
  /** Modification annulable de la carte. */
  const muter = (fn: (l: MapLayout | null) => MapLayout) =>
    majTravail((cur) => {
      const l1 = fn(cur.layout);
      if (l1 === cur.layout) return cur;
      return {
        ...cur,
        layout: l1,
        dirty: true,
        undo: cur.layout ? [...cur.undo, cur.layout].slice(-UNDO_LEVELS) : cur.undo,
        redo: [],
      };
    });
  const annuler = (retablir: boolean) =>
    majTravail((cur) => {
      const A = retablir ? cur.redo : cur.undo;
      const st = A[A.length - 1];
      if (!st || !cur.layout) return cur;
      return retablir
        ? { ...cur, layout: st, redo: cur.redo.slice(0, -1), undo: [...cur.undo, cur.layout], dirty: true }
        : { ...cur, layout: st, undo: cur.undo.slice(0, -1), redo: [...cur.redo, cur.layout], dirty: true };
    });
  const dirtyAny = travaux.context.dirty || travaux.process.dirty;

  /* ---------------------------------------------------------------- Affichage */
  const [sel, setSel] = useState<Selection>(null);
  const [info, setInfo] = useState(false);
  const [edit, setEdit] = useState(false);
  const [link, setLink] = useState<{ src: string | null } | undefined>(undefined);
  const [q, setQ] = useState('');
  const [presets, setPresets] = useState<Record<MapView, string>>({ context: 'all', process: 'all' });
  const [full, setFull] = useState(false);
  const std = useMemo(() => (pc.referentiels ?? [...REFERENTIELS]) as Referentiel[], [pc.referentiels]);
  const sec = pc.secondaires ?? false;
  const gen = pc.propositions ?? true;
  const panneau = pc.panneau ?? true;
  const majPrefs = (patch: Partial<typeof pc>) => void save({ cartographie: { ...pc, ...patch } }).catch(() => {});
  const [vps, setVps] = useState<Partial<Record<MapView, Viewport>>>(pc.viewport ?? {});
  const taille = useRef({ w: 800, h: 500 });
  const vpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editMode = edit && canEdit;

  const scene = useMemo(
    () =>
      layout
        ? computeScene(layout, view, ctx.lookup, ctx.relations, { std, preset: presets[view], q, sec, gen })
        : null,
    [layout, view, ctx, std, presets, q, sec, gen],
  );
  const sync = useMemo(() => {
    const s = syncInfo(layout, objs, view);
    return { ...s, miss: s.miss.filter((r) => !inaccessible(r)) };
  }, [layout, objs, view, inaccessible]);

  const vp = vps[view];
  const setVp = useCallback(
    (v: Viewport, persist?: boolean) => {
      setVps((x) => ({ ...x, [view]: v }));
      if (persist) {
        if (vpTimer.current) clearTimeout(vpTimer.current);
        vpTimer.current = setTimeout(() => {
          setVps((x) => {
            void save({ cartographie: { ...pc, viewport: { ...(pc.viewport ?? {}), ...x } } }).catch(() => {});
            return x;
          });
        }, 1500);
      }
    },
    [view, pc, save],
  );
  // Première ouverture (ou génération) : la vue s'ajuste à la carte.
  useEffect(() => {
    if (scene && !vp && scene.nodes.length) setVp(fitViewport(scene, taille.current.w, taille.current.h));
  }, [scene, vp, setVp]);

  usePresence(`cartographie/${view}`, editMode ? 'edit' : 'view');
  const editeurs = usePresenceOn(`cartographie/${view}`).filter((p) => p.mode === 'edit');

  /* ---------------------------------------------------------------- Quitter sans enregistrer */
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyAny &&
      !nextLocation.pathname.startsWith('/cartographie') &&
      currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirtyAny) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirtyAny]);

  /* ---------------------------------------------------------------- Dialogues */
  const [assistant, setAssistant] = useState(false);
  const [ajout, setAjout] = useState(false);
  const [liaison, setLiaison] = useState<{ s: string; t: string } | null>(null);
  const [versionsOuvert, setVersionsOuvert] = useState(false);
  const [conflit, setConflit] = useState<{ par: string; le: string; version: number } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    titre: string;
    message: string;
    libelle: string;
    action: () => unknown;
    couleur?: string;
  } | null>(null);
  const [erreur, setErreur] = useState<unknown>(null);
  const versionsQ = useQuery({
    queryKey: ['carto', 'versions', w.base?.id],
    queryFn: () => get<MapVersionOut[]>(`/api/carto/maps/${w.base!.id}/versions`),
    enabled: versionsOuvert && !!w.base,
  });

  const changerVue = (v: MapView) => {
    setSel(null);
    setInfo(false);
    setLink(undefined);
    nav(`/cartographie/${SEGMENT[v]}`);
    majPrefs({ vue: v });
  };
  const nom = (r: string) => {
    const o = ctx.lookup(r);
    return o ? o.name : layout?.nodes[r]?.label || r;
  };
  const centrer = (ref: string) => {
    const n = layout?.nodes[ref];
    if (!n) return;
    const cur = vps[view] ?? { x: 0, y: 0, k: 1 };
    setVp(
      {
        k: cur.k,
        x: taille.current.w / 2 - (n.x + n.w / 2) * cur.k,
        y: taille.current.h / 2 - (n.y + n.h / 2) * cur.k,
      },
      true,
    );
  };
  const aller = (ref: string) => {
    if (layout?.nodes[ref]) {
      setSel({ k: 'n', ref });
      setInfo(false);
      centrer(ref);
    } else notifications.show({ message: `« ${nom(ref)} » ne figure pas sur cette carte.` });
  };

  /* ---------------------------------------------------------------- Actions */
  const generer = (o: GenerateOptions) => {
    const refs = selectForGeneration(ctx, view, o);
    if (refs.length > GENERATE_MAX) {
      notifications.show({
        color: 'red',
        message: `Plus de ${GENERATE_MAX} objets (${refs.length}) : la génération est limitée. Réduisez les types sélectionnés.`,
      });
      return;
    }
    const faire = () => {
      setAssistant(false);
      muter((l) => generateLayout(l, ctx, view, refs, o, nouvelId));
      setSel(null);
      setVps((x) => ({ ...x, [view]: undefined }));
      notifications.show({ message: `Carte générée : ${refs.length} objets. Pensez à l’enregistrer.` });
    };
    if (refs.length > GENERATE_CONFIRM)
      setConfirmation({
        titre: 'Carte très chargée',
        message: `La carte comportera ${refs.length} objets, ce qui risque d’être difficile à lire. Continuer ?`,
        libelle: 'Générer quand même',
        couleur: 'blue',
        action: faire,
      });
    else faire();
  };
  const enregistrer = async (ecraser?: number) => {
    if (!layout) return;
    setErreur(null);
    const l = refreshLabels(pruneEdges(layout), objs);
    try {
      const out = w.base
        ? await api<MapOut>('PUT', `/api/carto/maps/${w.base.id}`, {
            body: { layout: l, ...(ecraser !== undefined ? { overwrite: true } : {}) },
            ifMatch: ecraser ?? w.base.version,
          })
        : await api<MapOut>('POST', '/api/carto/maps', { body: { view, layout: l } });
      majTravail((cur) => ({ ...cur, base: out, layout: out.layout, dirty: false }));
      setConflit(null);
      void qc.invalidateQueries({ queryKey: ['carto', 'maps'] });
      notifications.show({ color: 'teal', message: 'Carte enregistrée.' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 412) {
        const c = (e.data?.current ?? {}) as { updated_by?: string; updated_at?: string; version?: number };
        setConflit({ par: c.updated_by ?? 'un autre utilisateur', le: c.updated_at ?? '', version: c.version ?? 0 });
      } else setErreur(e);
    }
  };
  const recharger = async () => {
    setConflit(null);
    const r = await cartesQ.refetch();
    const m = r.data?.find((x) => x.view === view) ?? null;
    majTravail(() => ({ ...VIDE, base: m, layout: m?.layout ?? null }));
  };
  const basculerEdition = () => {
    if (!editMode) {
      setEdit(true);
      return;
    }
    setEdit(false);
    setLink(undefined);
    if (w.dirty)
      setConfirmation({
        titre: 'Fin de l’édition',
        message: 'Enregistrer les modifications de la carte ?',
        libelle: 'Enregistrer',
        couleur: 'blue',
        action: () => enregistrer(),
      });
  };
  const nature = async (ref: string, kind: 'ext' | 'int' | null) => {
    try {
      await api('PUT', '/api/carto/settings/issue-kind', { body: { ref, kind } });
      await qc.invalidateQueries({ queryKey: ['carto', 'objects'] });
      notifications.show({
        message:
          'Nature de l’enjeu mise à jour. Utilisez « Disposition automatique » pour le déplacer dans la bonne bande.',
      });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };
  const exporterCarte = async (f: FormatExport) => {
    if (!layout) return;
    try {
      const sc = computeScene(layout, view, ctx.lookup, ctx.relations, {
        std,
        preset: 'all',
        q: '',
        sec,
        gen,
        export: true,
      });
      await exporter(f, {
        view,
        layout,
        scene: sc,
        lookup: ctx.lookup,
        organisation: objetsQ.data?.organisation ?? '',
        std,
      });
      await api('POST', '/api/carto/exports', { body: { view, format: f } });
    } catch (e) {
      notifications.show({ color: 'red', message: 'L’export n’a pas pu être produit : ' + errorMessage(e) });
    }
  };
  const versionsAction = async (fn: () => Promise<unknown>) => {
    setErreur(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['carto'] });
    } catch (e) {
      setErreur(e);
    }
  };

  /* ---------------------------------------------------------------- Clavier */
  const clavier = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
    const cible = (e.target as Element).closest?.('[data-n]');
    if (e.key === 'Enter' && cible) {
      e.preventDefault();
      setSel({ k: 'n', ref: cible.getAttribute('data-n')! });
      setInfo(false);
      return;
    }
    if (e.key === 'Escape') {
      if (link) setLink(undefined);
      else {
        setSel(null);
        setInfo(false);
      }
      return;
    }
    if (!editMode || !layout) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') {
      e.preventDefault();
      annuler(e.shiftKey);
    } else if ((e.ctrlKey || e.metaKey) && k === 'y') {
      e.preventDefault();
      annuler(true);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
      e.preventDefault();
      if (sel.k === 'n') {
        muter((l) => removeNode(l ?? emptyLayout(), sel.ref));
        setSel(null);
      } else if (sel.key.startsWith('m:')) {
        muter((l) => deleteEdge(l ?? emptyLayout(), sel.key.slice(2)));
        setSel(null);
      } else {
        muter((l) => hideRelation(l ?? emptyLayout(), sel.key));
        setSel(null);
      }
    } else if (sel?.k === 'n' && /^Arrow/.test(e.key)) {
      e.preventDefault();
      const n = layout.nodes[sel.ref];
      if (!n) return;
      const s = e.shiftKey ? 20 : 4;
      const dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0,
        dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0;
      muter((l) => moveGroup(l ?? emptyLayout(), [[sel.ref, n.x, n.y]], dx, dy));
    }
  };

  // Raccourcis actifs sur toute la page (et pas seulement sur l'objet qui a le focus, qui peut disparaître : Suppr).
  const clavierRef = useRef(clavier);
  clavierRef.current = clavier;
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (document.querySelector('[role="dialog"]')) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      clavierRef.current(e);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const optionsAssistant = useMemo(() => defaultGenerateOptions(view, objs), [view, objs]);

  /* ---------------------------------------------------------------- Rendu */
  if (objetsQ.isLoading || cartesQ.isLoading)
    return (
      <Center className="carte-chargement">
        <Loader aria-label="Chargement de la cartographie" />
      </Center>
    );
  const erreurChargement = objetsQ.error ?? cartesQ.error;
  const titre = MAP_VIEW_TITLES[view];
  const sousTitre =
    view === 'context'
      ? 'Périmètre • Parties intéressées • Enjeux • Applications • Fournisseurs'
      : 'Pilotage • Réalisation • Support • Sous-processus et flux';

  const barreVue = (
    <Group gap="xs" wrap="wrap">
      <div className="carte-vues" role="group" aria-label="Vue">
        {(['context', 'process'] as const).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={view === v ? 'filled' : 'default'}
            aria-pressed={view === v}
            onClick={() => changerVue(v)}
          >
            {MAP_VIEW_LABELS[v]}
          </Button>
        ))}
      </div>
      <TextInput
        className="carte-recherche"
        aria-label="Rechercher un objet sur la carte"
        placeholder="Rechercher un objet sur la carte"
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && scene?.hits.size) {
            const r = [...scene.hits][0]!;
            setSel({ k: 'n', ref: r });
            setInfo(false);
            centrer(r);
          }
          if (e.key === 'Escape') setQ('');
        }}
        rightSection={
          q.trim() && scene ? (
            <Text size="xs" c="dimmed" className="carte-compteur">
              {scene.hits.size}
            </Text>
          ) : null
        }
        rightSectionWidth="auto"
      />
      {q.trim() && scene && (
        <Text size="sm" c="dimmed" aria-live="polite">
          {scene.hits.size} résultat{scene.hits.size > 1 ? 's' : ''}
        </Text>
      )}
    </Group>
  );

  const outils = layout && (
    <Group gap="xs" wrap="wrap" className="carte-outils">
      {canEdit && (
        <>
          <Button size="xs" variant="default" onClick={() => setAssistant(true)}>
            Générer…
          </Button>
          <Button size="xs" variant="default" onClick={() => setAjout(true)}>
            Ajouter depuis la plateforme
          </Button>
          <Button size="xs" variant={editMode ? 'filled' : 'default'} onClick={basculerEdition} aria-pressed={editMode}>
            {editMode ? 'Terminer l’édition' : 'Modifier la disposition'}
          </Button>
        </>
      )}
      {editMode && (
        <>
          <Button
            size="xs"
            variant={link ? 'filled' : 'default'}
            aria-pressed={!!link}
            onClick={() => setLink(link ? undefined : { src: null })}
          >
            {link ? 'Annuler la liaison' : 'Relier'}
          </Button>
          <Button size="xs" variant="default" disabled={!w.undo.length} onClick={() => annuler(false)} title="Ctrl+Z">
            Annuler
          </Button>
          <Button size="xs" variant="default" disabled={!w.redo.length} onClick={() => annuler(true)} title="Ctrl+Y">
            Rétablir
          </Button>
          <Button
            size="xs"
            variant="default"
            onClick={() =>
              setConfirmation({
                titre: 'Disposition automatique',
                message:
                  'Recalculer la disposition ? Les positions manuelles de cette carte seront remplacées (vous pourrez annuler).',
                libelle: 'Recalculer',
                couleur: 'blue',
                action: () => {
                  muter((l) => relayout(l ?? emptyLayout(), ctx, view));
                  setVps((x) => ({ ...x, [view]: undefined }));
                },
              })
            }
          >
            Disposition automatique
          </Button>
        </>
      )}
      {canEdit && (
        <>
          <Button size="xs" variant={w.dirty ? 'filled' : 'default'} disabled={!w.dirty} onClick={() => enregistrer()}>
            Enregistrer
          </Button>
          <Button size="xs" variant="default" disabled={!w.base} onClick={() => setVersionsOuvert(true)}>
            Versions
          </Button>
        </>
      )}
      {!canEdit && w.base && (
        <Button size="xs" variant="default" onClick={() => setVersionsOuvert(true)}>
          Versions
        </Button>
      )}
      {w.dirty && (
        <Badge color="orange" variant="light">
          Modifications non enregistrées
        </Badge>
      )}
      {!!editeurs.length && (
        <Badge color="violet" variant="dot" className="carte-presence">
          {editeurs.map((p) => p.name).join(', ')} modifie{editeurs.length > 1 ? 'nt' : ''} la carte
        </Badge>
      )}
      <span className="carte-espace" />
      <Button
        size="xs"
        variant={info ? 'light' : 'default'}
        aria-pressed={info}
        onClick={() => {
          setInfo(!info);
          setSel(null);
        }}
      >
        Infos
      </Button>
      <Button
        size="xs"
        variant={panneau ? 'light' : 'default'}
        aria-pressed={panneau}
        onClick={() => majPrefs({ panneau: !panneau })}
      >
        Panneau
      </Button>
      <Button size="xs" variant={full ? 'light' : 'default'} aria-pressed={full} onClick={() => setFull(!full)}>
        {full ? 'Quitter le plein écran' : 'Plein écran'}
      </Button>
      {canExport && (
        <Menu position="bottom-end" withinPortal={false}>
          <Menu.Target>
            <Button size="xs" variant="default">
              Exporter
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => void exporterCarte('png')}>Image PNG (haute définition)</Menu.Item>
            <Menu.Item onClick={() => void exporterCarte('pdf')}>PDF A3 paysage</Menu.Item>
            <Menu.Item onClick={() => void exporterCarte('svg')}>SVG (vectoriel, modifiable)</Menu.Item>
            <Menu.Item onClick={() => void exporterCarte('json')}>Disposition de la carte (JSON)</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );

  const bandeaux = layout && (
    <>
      {!!sync.miss.length && (
        <Alert
          color="orange"
          className="carte-bandeau"
          title={`${sync.miss.length} objet${sync.miss.length > 1 ? 's' : ''} indisponible${sync.miss.length > 1 ? 's' : ''}`}
        >
          <Group justify="space-between" wrap="wrap">
            <Text size="sm">
              Supprimé{sync.miss.length > 1 ? 's' : ''} ou renommé{sync.miss.length > 1 ? 's' : ''} dans la plateforme ;
              la position est conservée en attendant votre décision.
            </Text>
            {canEdit && (
              <Button
                size="xs"
                variant="light"
                color="orange"
                onClick={() => muter((l) => dropMissing(l ?? emptyLayout(), sync.miss))}
              >
                Retirer de la carte
              </Button>
            )}
          </Group>
        </Alert>
      )}
      {!!sync.news.length && canEdit && (
        <Alert
          color="blue"
          className="carte-bandeau"
          title={`${sync.news.length} nouvel${sync.news.length > 1 ? 's' : ''} objet${sync.news.length > 1 ? 's' : ''}`}
        >
          <Group justify="space-between" wrap="wrap">
            <Text size="sm">
              dans la plateforme ne figure{sync.news.length > 1 ? 'nt' : ''} pas sur la carte (
              {sync.news
                .slice(0, 3)
                .map((o) => o.name)
                .join(', ')}
              {sync.news.length > 3 ? '…' : ''}).
            </Text>
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={() => setAjout(true)}>
                Choisir et ajouter
              </Button>
              <Button
                size="xs"
                variant="default"
                onClick={() =>
                  muter((l) =>
                    ignoreObjects(
                      l ?? emptyLayout(),
                      sync.news.map((o) => o.ref),
                    ),
                  )
                }
              >
                Ignorer
              </Button>
            </Group>
          </Group>
        </Alert>
      )}
    </>
  );

  const vide = !layout && (
    <Center className="carte-vide">
      <Stack align="center" gap="sm" className="lecture">
        <span className="carte-vide-icone" aria-hidden="true">
          <IconeCarte />
        </span>
        <Title order={2} size="h4">
          {view === 'context' ? 'Aucune carte de contexte' : 'Aucune carte des processus'}
        </Title>
        <Text c="dimmed" ta="center" size="sm">
          {view === 'context'
            ? 'Générez une première carte à partir du périmètre, des processus, des parties intéressées, des enjeux (objectifs et SWOT), des applications et des fournisseurs déjà saisis.'
            : 'Générez la carte à partir des processus de la plateforme : bandes pilotage, réalisation et support, sous-processus regroupés dans leur parent.'}{' '}
          Vous pourrez ensuite tout déplacer, relier et masquer.
        </Text>
        {canEdit ? (
          <Group>
            <Button onClick={() => setAssistant(true)}>Générer la carte</Button>
            <Button variant="default" onClick={() => muter(() => blankLayout(view))}>
              Partir d’une carte vide
            </Button>
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            Lecture seule : aucune carte n’a encore été créée pour cette vue.
          </Text>
        )}
      </Stack>
    </Center>
  );

  const inspecteur = layout && (sel || info) && (
    <Inspecteur
      sel={sel}
      info={info}
      layout={layout}
      lookup={ctx.lookup}
      relations={ctx.relations}
      sync={sync}
      inaccessible={inaccessible}
      canEdit={canEdit}
      edit={editMode}
      carte={w.base}
      onClose={() => {
        setSel(null);
        setInfo(false);
      }}
      onGoto={aller}
      onRemove={(r) => {
        muter((l) => removeNode(l ?? emptyLayout(), r));
        setSel(null);
        notifications.show({ message: 'Objet retiré de la carte (il reste dans la plateforme).' });
      }}
      onDefaultSize={(r) => muter((l) => resetSize(l ?? emptyLayout(), r, view, ctx.lookup))}
      onIssueKind={nature}
      onHide={(k) => {
        muter((l) => hideRelation(l ?? emptyLayout(), k));
        setSel(null);
      }}
      onDeleteEdge={(id) => {
        muter((l) => deleteEdge(l ?? emptyLayout(), id));
        setSel(null);
      }}
      onValidate={(id) => muter((l) => validateEdge(l ?? emptyLayout(), id))}
      onEdgeType={(id, t) => muter((l) => setEdgeType(l ?? emptyLayout(), id, t))}
      onVersions={() => setVersionsOuvert(true)}
    />
  );

  return (
    <Page>
      <div className={`carte-page${full ? ' carte-plein-ecran' : ''}`}>
        <PageHeader title={titre} description={sousTitre} actions={barreVue} />
        <ErrorAlert error={erreurChargement} />
        <ErrorAlert error={erreur} />
        {outils}
        {bandeaux}
        {!!objetsQ.data?.hiddenModules.length && (
          <Text size="xs" c="dimmed">
            Certains objets ne sont pas affichés : vos droits ne permettent pas de consulter leur module d’origine.
          </Text>
        )}
        {vide}
        {layout && scene && (
          <div className={`carte-grille${panneau ? '' : ' sans-panneau'}${large ? ' avec-inspecteur' : ''}`}>
            {panneau && (
              <Panneau
                view={view}
                layout={layout}
                lookup={ctx.lookup}
                std={std}
                preset={presets[view]}
                sec={sec}
                gen={gen}
                onStd={(s) => majPrefs({ referentiels: s })}
                onPreset={(k) => setPresets((x) => ({ ...x, [view]: k }))}
                onSec={(v) => majPrefs({ secondaires: v })}
                onGen={(v) => majPrefs({ propositions: v })}
              />
            )}
            <div className="carte-canevas">
              <Canevas
                layout={layout}
                view={view}
                scene={scene}
                lookup={ctx.lookup}
                std={std}
                hidden={hidden}
                sel={sel}
                edit={editMode}
                linkSrc={link ? link.src : undefined}
                vp={vp ?? { x: 0, y: 0, k: 1 }}
                setVp={setVp}
                onSize={(wd, h) => {
                  taille.current = { w: wd, h };
                }}
                onLive={(l) => majTravail((cur) => ({ ...cur, layout: l }))}
                onCommit={(before) =>
                  majTravail((cur) => ({
                    ...cur,
                    dirty: true,
                    undo: [...cur.undo, before].slice(-UNDO_LEVELS),
                    redo: [],
                  }))
                }
                onSelect={(s) => {
                  setSel(s);
                  setInfo(false);
                }}
                onOpen={(r) => {
                  setSel({ k: 'n', ref: r });
                  setInfo(false);
                }}
                onLink={(r) => {
                  if (!link) return;
                  if (!link.src) setLink({ src: r });
                  else if (link.src !== r) setLiaison({ s: link.src, t: r });
                }}
              />
              {(link || editMode) && (
                <div className="carte-astuce" role="status">
                  <Text size="sm">
                    {link
                      ? link.src
                        ? 'Cliquez sur l’objet cible'
                        : 'Cliquez sur l’objet source'
                      : 'Mode édition : glisser pour déplacer, poignée pour redimensionner, Suppr pour retirer de la carte, flèches pour ajuster'}
                  </Text>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    className="carte-astuce-bouton"
                    onClick={() => (link ? setLink(undefined) : basculerEdition())}
                  >
                    {link ? 'Annuler' : 'Terminer'}
                  </Button>
                </div>
              )}
              {!large && inspecteur && <aside className="carte-inspecteur">{inspecteur}</aside>}
            </div>
            {large && (
              <aside className="carte-inspecteur-fixe">
                {inspecteur || (
                  <Text size="sm" c="dimmed">
                    Sélectionnez un objet ou une relation pour afficher sa fiche.
                  </Text>
                )}
              </aside>
            )}
          </div>
        )}
      </div>

      <Assistant
        opened={assistant}
        view={view}
        objs={[...objs.values()]}
        existe={!!layout}
        initial={optionsAssistant}
        onClose={() => setAssistant(false)}
        onGenerate={generer}
      />
      <Ajout
        opened={ajout}
        view={view}
        objs={[...objs.values()]}
        layout={layout}
        onClose={() => setAjout(false)}
        onAdd={(refs, depth) => {
          setAjout(false);
          const l0 = layout ?? emptyLayout();
          const tous = withDependencies(refs, depth, l0, ctx, view);
          muter((l) => addObjects(l ?? emptyLayout(), tous, view, ctx));
          notifications.show({
            message: `${tous.length} objet${tous.length > 1 ? 's' : ''} ajouté${tous.length > 1 ? 's' : ''} à la carte.`,
          });
        }}
      />
      <NouvelleRelation
        liaison={liaison}
        view={view}
        nom={nom}
        onClose={() => {
          setLiaison(null);
          setLink(undefined);
        }}
        onCreate={(type: RelationType) => {
          const id = nouvelId();
          muter((l) => addEdge(l ?? emptyLayout(), liaison!.s, liaison!.t, type, id));
          setSel({ k: 'e', key: 'm:' + id });
          setLiaison(null);
          setLink(undefined);
        }}
      />
      <Versions
        opened={versionsOuvert}
        versions={versionsQ.data ?? []}
        peutFiger={!!w.base && !w.dirty}
        modifiee={w.dirty}
        canEdit={canEdit}
        canDelete={canDelete}
        erreur={erreur}
        onClose={() => setVersionsOuvert(false)}
        onCreate={(label) =>
          void versionsAction(async () => {
            await api('POST', `/api/carto/maps/${w.base!.id}/versions`, { body: { label } });
            notifications.show({ color: 'teal', message: 'Version enregistrée.' });
          })
        }
        onRestore={(id) => {
          const faire = () =>
            void versionsAction(async () => {
              const out = await api<MapOut>('POST', `/api/carto/maps/${w.base!.id}/versions/${id}/restore`, {
                ifMatch: w.base!.version,
              });
              majTravail(() => ({ ...VIDE, base: out, layout: out.layout }));
              setVps((x) => ({ ...x, [view]: undefined }));
              setVersionsOuvert(false);
              notifications.show({
                color: 'teal',
                message: 'Version restaurée : elle est désormais la carte courante.',
              });
            });
          if (w.dirty)
            setConfirmation({
              titre: 'Restaurer une version',
              message: 'Les modifications non enregistrées seront perdues. Restaurer la version ?',
              libelle: 'Restaurer',
              action: faire,
            });
          else faire();
        }}
        onDelete={(id) =>
          setConfirmation({
            titre: 'Supprimer une version',
            message: 'Supprimer cette version de la carte ?',
            libelle: 'Supprimer',
            action: () => versionsAction(() => api('DELETE', `/api/carto/maps/${w.base!.id}/versions/${id}`)),
          })
        }
      />
      <Conflit
        conflit={conflit}
        onClose={() => setConflit(null)}
        onReload={() => void recharger()}
        onOverwrite={() => conflit && void enregistrer(conflit.version)}
      />
      <ConfirmDialog
        opened={!!confirmation}
        title={confirmation?.titre}
        message={confirmation?.message ?? ''}
        confirmLabel={confirmation?.libelle}
        color={confirmation?.couleur ?? 'red'}
        onConfirm={() => confirmation?.action()}
        onClose={() => setConfirmation(null)}
      />
      <Modal
        opened={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title="Modifications non enregistrées"
        centered
      >
        <Stack>
          <Text>La carte comporte des modifications non enregistrées. Quitter la page sans les enregistrer ?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => blocker.reset?.()}>
              Rester sur la carte
            </Button>
            <Button color="red" onClick={() => blocker.proceed?.()}>
              Quitter sans enregistrer
            </Button>
          </Group>
        </Stack>
      </Modal>
      {w.base && (
        <Tooltip label={`Enregistrée le ${dateHeure(w.base.updated_at)} par ${w.base.updated_by}`}>
          <Text size="xs" c="dimmed" className="carte-pied">
            Version {w.base.version} — enregistrée le {dateHeure(w.base.updated_at)} par {w.base.updated_by}
          </Text>
        </Tooltip>
      )}
    </Page>
  );
}

/* Construire une carte de zéro (CARTO-15 à CARTO-19, ADR 0016) : palette en glisser-déposer, menu contextuel,
   fenêtre de création d'un objet de la plateforme (enregistré dans son module), renommage, notes et cadres libres,
   sélection multiple (aligner, répartir, grouper). Le menu est dessiné dans la surcouche SVG du canevas
   (foreignObject positionné par attributs) : aucun style en ligne, CSP stricte. */
import {
  Alert,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  CREATABLE,
  PI_CATEGORIES,
  PROCESS_FAMILIES,
  PROCESS_FAMILY_LABELS,
  TINTS,
  TINT_LABELS,
  TYPE_LABELS,
  nextProcessCode,
  type Alignement,
  type CartoObject,
  type CreatableType,
  type CreateObjectInput,
  type MapView,
  type Tint,
} from '@suivi/shared/carto';
import { ErrorAlert } from '@suivi/ui';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Point } from './Canevas';
import { Icone } from './rendu';

/* ---------------------------------------------------------------- Palette (CARTO-17) */
export type ElementPalette =
  | { k: 'type'; type: CreatableType }
  | { k: 'note' }
  | { k: 'frame' }
  | { k: 'obj'; ref: string; name: string; type: string };

export const libelleElement = (e: ElementPalette) =>
  e.k === 'type' ? CREATABLE[e.type].l : e.k === 'note' ? 'Note' : e.k === 'frame' ? 'Cadre' : e.name;
const icone = (e: ElementPalette) =>
  e.k === 'type' ? CREATABLE[e.type].ic : e.k === 'note' ? 'doc' : e.k === 'frame' ? 'frame' : 'layers';
const teinte = (e: ElementPalette) =>
  e.k === 'type' ? CREATABLE[e.type].tint : e.k === 'note' ? 'orange' : e.k === 'frame' ? 'gris' : 'bleu';

function PictoPalette({ e }: { e: ElementPalette }) {
  return (
    <svg viewBox="0 0 24 24" className={`carte-palette-ic ct-${teinte(e)}`} aria-hidden="true">
      <Icone k={icone(e)} x={0} y={0} s={24} cls="c-accent-s" />
    </svg>
  );
}

export interface PaletteProps {
  view: MapView;
  /** Types créables, avec la raison s'ils sont refusés (droit du module d'origine). */
  types: { type: CreatableType; refus?: string }[];
  nonPlaces: CartoObject[];
  arme: ElementPalette | null;
  onSaisie: (e: ElementPalette, ev: PointerEvent<HTMLElement>) => void;
  onClavier: (e: ElementPalette) => void;
}

export function Palette(p: PaletteProps) {
  const [q, setQ] = useState('');
  const items: ElementPalette[] = [
    ...p.types.filter((t) => !t.refus).map((t) => ({ k: 'type' as const, type: t.type })),
    { k: 'note' },
    { k: 'frame' },
  ];
  const libres = p.nonPlaces.filter((o) => !q.trim() || o.name.toLowerCase().includes(q.trim().toLowerCase()));
  const bouton = (e: ElementPalette, i: number) => {
    const actif =
      !!p.arme &&
      p.arme.k === e.k &&
      (e.k !== 'type' || (p.arme.k === 'type' && p.arme.type === e.type)) &&
      (e.k !== 'obj' || (p.arme.k === 'obj' && p.arme.ref === e.ref));
    return (
      <UnstyledButton
        key={i}
        className={`carte-palette-item${actif ? ' actif' : ''}`}
        aria-pressed={actif}
        aria-label={`${libelleElement(e)} : glisser sur la carte, ou cliquer puis cliquer sur la carte`}
        onPointerDown={(ev) => p.onSaisie(e, ev)}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            p.onClavier(e);
          }
        }}
        data-palette={e.k === 'type' ? e.type : e.k === 'obj' ? e.ref : e.k}
      >
        <PictoPalette e={e} />
        <Text size="sm" className="carte-palette-libelle">
          {libelleElement(e)}
        </Text>
      </UnstyledButton>
    );
  };
  const refuses = p.types.filter((t) => t.refus);
  return (
    <section className="carte-palette" aria-label="Palette : construire la carte">
      <Title order={2} size="h6">
        Construire
      </Title>
      <Text size="xs" c="dimmed">
        Glissez un élément sur la carte, ou cliquez dessus puis à l’endroit voulu. Clic droit sur la carte : autres
        actions.
      </Text>
      <div className="carte-palette-grille">{items.map(bouton)}</div>
      {!!refuses.length && (
        <Text size="xs" c="dimmed">
          Non disponible avec vos droits : {refuses.map((t) => CREATABLE[t.type].l.toLowerCase()).join(', ')}.
        </Text>
      )}
      {!!p.nonPlaces.length && (
        <>
          <Title order={3} size="h6">
            Objets de la plateforme non placés ({p.nonPlaces.length})
          </Title>
          <TextInput
            size="xs"
            aria-label="Rechercher un objet non placé"
            placeholder="Rechercher"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />
          <div className="carte-palette-liste">
            {libres
              .slice(0, 60)
              .map((o, i) => bouton({ k: 'obj', ref: o.ref, name: o.name, type: TYPE_LABELS[o.type] }, 100 + i))}
            {libres.length > 60 && (
              <Text size="xs" c="dimmed">
                … {libres.length - 60} autres : affinez la recherche.
              </Text>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Fantôme d'un élément glissé depuis la palette (surcouche du canevas). */
export function Fantome({ e, ecran }: { e: ElementPalette; ecran: Point }) {
  const l = libelleElement(e);
  const w = Math.max(120, Math.min(260, l.length * 7.5 + 50));
  return (
    <g className={`carte-fantome ct-${teinte(e)}`}>
      <rect x={ecran.x - w / 2} y={ecran.y - 20} width={w} height={40} rx={10} className="c-doux c-trait-accent" />
      <Icone k={icone(e)} x={ecran.x - w / 2 + 10} y={ecran.y - 10} s={20} cls="c-accent-s" />
      <text x={ecran.x - w / 2 + 38} y={ecran.y + 5} fontSize={13} fontWeight={600} className="c-accent-f">
        {l}
      </text>
    </g>
  );
}

/* ---------------------------------------------------------------- Menu contextuel (CARTO-16) */
export type EntreeMenu =
  | { titre: string }
  | { separateur: true }
  | { libelle: string; action: () => void; refus?: string; danger?: boolean; raccourci?: string };

const LARGEUR_MENU = 270;
const HAUTEUR_ENTREE = 34;
const HAUTEUR_TITRE = 26;

export function MenuContextuel({
  entrees,
  ecran,
  taille,
  titre,
  onClose,
}: {
  entrees: EntreeMenu[];
  ecran: Point;
  taille: { w: number; h: number };
  titre: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const h =
    16 + entrees.reduce((a, e) => a + ('titre' in e ? HAUTEUR_TITRE : 'separateur' in e ? 9 : HAUTEUR_ENTREE), 0);
  const x = Math.max(4, Math.min(ecran.x, taille.w - LARGEUR_MENU - 4));
  const y = Math.max(4, ecran.y + h > taille.h - 4 ? Math.max(4, taille.h - h - 4) : ecran.y);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus();
    const dehors = (e: globalThis.PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => window.addEventListener('pointerdown', dehors), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', dehors);
    };
  }, [onClose]);
  const clavier = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const n = items.length;
      items[(i + (e.key === 'ArrowDown' ? 1 : n - 1) + n) % n]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      (e.key === 'Home' ? items[0] : items.at(-1))?.focus();
    }
  };
  return (
    <foreignObject x={x} y={y} width={LARGEUR_MENU} height={h}>
      <div ref={ref} className="carte-menu" role="menu" aria-label={titre} onKeyDown={clavier}>
        {entrees.map((e, i) =>
          'titre' in e ? (
            <div key={i} className="carte-menu-titre" role="presentation">
              {e.titre}
            </div>
          ) : 'separateur' in e ? (
            <div key={i} className="carte-menu-separateur" role="separator" />
          ) : (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={`carte-menu-item${e.danger ? ' danger' : ''}`}
              disabled={!!e.refus}
              title={e.refus}
              onClick={() => {
                onClose();
                e.action();
              }}
            >
              <span>{e.libelle}</span>
              {e.refus ? (
                <span className="carte-menu-raison">droit manquant</span>
              ) : e.raccourci ? (
                <span className="carte-menu-raccourci">{e.raccourci}</span>
              ) : null}
            </button>
          ),
        )}
      </div>
    </foreignObject>
  );
}

/* ---------------------------------------------------------------- Création (CARTO-15, CARTO-19) */
export interface DemandeCreation {
  item: Exclude<ElementPalette, { k: 'obj' }>;
  monde: Point;
  /** Famille ou processus parent déduits du point visé (bande ou processus sous le pointeur). */
  famille?: (typeof PROCESS_FAMILIES)[number];
  parent?: string;
}

export function Creation({
  demande,
  objs,
  onClose,
  onCreate,
  onCreateFree,
}: {
  demande: DemandeCreation | null;
  objs: CartoObject[];
  onClose: () => void;
  onCreate: (body: CreateObjectInput, completer: boolean) => Promise<void>;
  onCreateFree: (kind: 'note' | 'frame', text: string, tint: Tint) => void;
}) {
  const [f, setF] = useState<Record<string, string | boolean>>({});
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    if (!demande) return;
    setErreur(null);
    const item = demande.item;
    setF(
      item.k === 'type' && item.type === 'process'
        ? { family: demande.famille ?? 'Réalisation' }
        : item.k === 'type' && item.type === 'subprocess'
          ? { parent: demande.parent ?? '' }
          : item.k === 'type' && (item.type === 'stakeholder' || item.type === 'issue')
            ? { nature: 'Externe', kind: 'ext', category: '' }
            : item.k === 'note'
              ? { tint: 'orange' }
              : item.k === 'frame'
                ? { tint: 'gris' }
                : {},
    );
  }, [demande]);
  const processus = useMemo(() => objs.filter((o) => o.type === 'process'), [objs]);
  const codes = useMemo(
    () => objs.filter((o) => o.type === 'process' || o.type === 'subprocess').map((o) => o.code ?? ''),
    [objs],
  );
  const fournisseurs = useMemo(
    () => [...new Set(objs.filter((o) => o.type === 'supplier').map((o) => o.name))].sort(),
    [objs],
  );
  if (!demande) return null;
  const item = demande.item;
  const s = (k: string) => String(f[k] ?? '');
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const titre =
    item.k === 'note'
      ? 'Ajouter une note'
      : item.k === 'frame'
        ? 'Ajouter un cadre'
        : `Créer : ${CREATABLE[item.type].l}`;
  const libre = item.k !== 'type';

  const corps = (): CreateObjectInput | null => {
    if (item.k !== 'type') return null;
    const name = s('name');
    switch (item.type) {
      case 'stakeholder':
        return {
          type: 'stakeholder',
          name,
          nature: s('nature') === 'Interne' ? 'Interne' : 'Externe',
          category: s('category') as never,
          needs: s('needs'),
        };
      case 'supplier':
        return { type: 'supplier', name, saas: !!f.saas, hds: !!f.hds, critical: !!f.critical };
      case 'application':
        return { type: 'application', name, supplier: s('supplier') };
      case 'issue':
        return { type: 'issue', name, kind: s('kind') === 'int' ? 'int' : 'ext', desc: s('desc') };
      case 'site':
      case 'infrastructure':
        return { type: item.type, name };
      case 'process':
        return { type: 'process', name, code: s('code'), family: s('family') as never, owner: s('owner') };
      case 'subprocess':
        return { type: 'subprocess', name, parent: s('parent'), code: s('code'), owner: s('owner') };
    }
  };
  const valider = async (completer: boolean) => {
    if (libre) {
      onCreateFree(item.k, s('name').trim() || (item.k === 'note' ? 'Note' : 'Cadre'), (s('tint') || 'gris') as Tint);
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      await onCreate(corps()!, completer);
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const nomObligatoire = !libre && !s('name').trim();
  const sansParent = item.k === 'type' && item.type === 'subprocess' && !s('parent');
  const teintes = TINTS.map((t) => ({ value: t, label: TINT_LABELS[t] }));
  const nature = (
    <SegmentedControl
      aria-label="Nature"
      value={item.k === 'type' && item.type === 'issue' ? s('kind') || 'ext' : s('nature') || 'Externe'}
      onChange={(v) => set(item.k === 'type' && item.type === 'issue' ? 'kind' : 'nature', v)}
      data={
        item.k === 'type' && item.type === 'issue'
          ? [
              { value: 'ext', label: 'Externe' },
              { value: 'int', label: 'Interne' },
            ]
          : ['Externe', 'Interne']
      }
    />
  );

  return (
    <Modal opened onClose={onClose} title={titre} size="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nomObligatoire && !sansParent && !envoi) void valider(false);
        }}
      >
        <Stack>
          {!libre && (
            <Text size="sm" c="dimmed">
              L’objet est enregistré dans la plateforme
              {item.k === 'type' && item.type === 'issue'
                ? ' (réglages de la carte de contexte, en attendant la reprise des enjeux)'
                : ' (module d’origine, visible aussi dans l’outil de suivi)'}{' '}
              puis placé sur la carte à l’endroit choisi.
            </Text>
          )}
          {item.k === 'type' && item.type === 'subprocess' && (
            <Select
              label="Processus parent"
              required
              searchable
              data={processus.map((o) => ({ value: o.code ?? '', label: `${o.code} — ${o.name}` }))}
              value={s('parent') || null}
              onChange={(v) => set('parent', v ?? '')}
              nothingFoundMessage="Aucun processus : créez d’abord un processus"
            />
          )}
          {item.k === 'type' && (item.type === 'process' || item.type === 'subprocess') && (
            <TextInput
              label="Code"
              description="Laisser vide pour le code proposé"
              placeholder={nextProcessCode(codes, item.type === 'subprocess' ? s('parent') || undefined : undefined)}
              value={s('code')}
              onChange={(e) => set('code', e.currentTarget.value)}
            />
          )}
          {item.k === 'note' ? (
            <Textarea
              label="Texte"
              autosize
              minRows={3}
              maxLength={500}
              data-autofocus
              value={s('name')}
              onChange={(e) => set('name', e.currentTarget.value)}
            />
          ) : (
            <TextInput
              label={
                item.k === 'frame' ? 'Titre du cadre' : item.k === 'type' && item.type === 'issue' ? 'Libellé' : 'Nom'
              }
              required={!libre}
              maxLength={200}
              data-autofocus
              value={s('name')}
              onChange={(e) => set('name', e.currentTarget.value)}
            />
          )}
          {item.k === 'type' && item.type === 'stakeholder' && (
            <>
              {nature}
              <Select
                label="Catégorie"
                data={[...PI_CATEGORIES]}
                value={s('category') || null}
                onChange={(v) => set('category', v ?? '')}
                clearable
                placeholder="Autre"
              />
              <Textarea
                label="Besoins et attentes"
                autosize
                minRows={2}
                value={s('needs')}
                onChange={(e) => set('needs', e.currentTarget.value)}
              />
            </>
          )}
          {item.k === 'type' && item.type === 'issue' && (
            <>
              {nature}
              <Textarea
                label="Description"
                autosize
                minRows={2}
                maxLength={500}
                value={s('desc')}
                onChange={(e) => set('desc', e.currentTarget.value)}
              />
            </>
          )}
          {item.k === 'type' && item.type === 'supplier' && (
            <Group>
              <Switch label="Service SaaS" checked={!!f.saas} onChange={(e) => set('saas', e.currentTarget.checked)} />
              <Switch label="Hébergeur HDS" checked={!!f.hds} onChange={(e) => set('hds', e.currentTarget.checked)} />
              <Switch
                label="Critique"
                checked={!!f.critical}
                onChange={(e) => set('critical', e.currentTarget.checked)}
              />
            </Group>
          )}
          {item.k === 'type' && item.type === 'application' && (
            <Select
              label="Fournisseur"
              data={fournisseurs}
              searchable
              clearable
              value={s('supplier') || null}
              onChange={(v) => set('supplier', v ?? '')}
              nothingFoundMessage="Aucun fournisseur"
            />
          )}
          {item.k === 'type' && item.type === 'process' && (
            <Select
              label="Famille"
              required
              data={PROCESS_FAMILIES.map((x) => ({ value: x, label: PROCESS_FAMILY_LABELS[x] }))}
              value={s('family')}
              onChange={(v) => set('family', v ?? 'Réalisation')}
              allowDeselect={false}
            />
          )}
          {item.k === 'type' && (item.type === 'process' || item.type === 'subprocess') && (
            <TextInput label="Pilote" value={s('owner')} onChange={(e) => set('owner', e.currentTarget.value)} />
          )}
          {libre && (
            <Select
              label="Teinte"
              data={teintes}
              value={s('tint')}
              onChange={(v) => set('tint', v ?? 'gris')}
              allowDeselect={false}
            />
          )}
          <ErrorAlert error={erreur} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Annuler
            </Button>
            {!libre && (
              <Button
                variant="default"
                disabled={nomObligatoire || sansParent}
                loading={envoi}
                onClick={() => void valider(true)}
                title="Crée l’objet puis ouvre l’outil de suivi pour compléter sa fiche"
              >
                Créer et compléter
              </Button>
            )}
            <Button type="submit" disabled={nomObligatoire || sansParent} loading={envoi}>
              {libre ? 'Ajouter' : 'Créer'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------- Renommer (CARTO-18) */
export function Renommer({
  demande,
  onClose,
  onRename,
}: {
  demande: { ref: string; name: string; module: string } | null;
  onClose: () => void;
  onRename: (ref: string, name: string) => Promise<void>;
}) {
  const [nom, setNom] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    if (demande) {
      setNom(demande.name);
      setErreur(null);
    }
  }, [demande]);
  if (!demande) return null;
  return (
    <Modal opened onClose={onClose} title="Renommer" size="md">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!nom.trim() || nom.trim() === demande.name) return onClose();
          setEnvoi(true);
          try {
            await onRename(demande.ref, nom.trim());
          } catch (x) {
            setErreur(x);
          } finally {
            setEnvoi(false);
          }
        }}
      >
        <Stack>
          <Alert color="blue" variant="light">
            Le nom change partout dans la plateforme ({demande.module}), pas seulement sur cette carte. La position de
            l’objet est conservée.
          </Alert>
          <TextInput
            label="Nouveau nom"
            required
            maxLength={200}
            data-autofocus
            value={nom}
            onChange={(e) => setNom(e.currentTarget.value)}
          />
          <ErrorAlert error={erreur} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={envoi} disabled={!nom.trim()}>
              Renommer
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------- Sélection multiple (CARTO-16) */
export const ALIGNEMENTS: { k: Alignement; l: string }[] = [
  { k: 'left', l: 'Aligner à gauche' },
  { k: 'hcenter', l: 'Centrer horizontalement' },
  { k: 'right', l: 'Aligner à droite' },
  { k: 'top', l: 'Aligner en haut' },
  { k: 'vcenter', l: 'Centrer verticalement' },
  { k: 'bottom', l: 'Aligner en bas' },
];

export function SelectionMultiple({
  refs,
  edit,
  nom,
  onAlign,
  onDistribute,
  onGroup,
  onRemove,
  onClose,
}: {
  refs: string[];
  edit: boolean;
  nom: (r: string) => string;
  onAlign: (m: Alignement) => void;
  onDistribute: (axis: 'h' | 'v') => void;
  onGroup: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <Stack className="carte-fiche" gap="sm">
      <Group justify="space-between" wrap="nowrap">
        <Title order={3} size="h5">
          {refs.length} objets sélectionnés
        </Title>
        <Button variant="subtle" size="compact-sm" onClick={onClose} aria-label="Fermer la sélection">
          ×
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        {refs.slice(0, 6).map(nom).join(', ')}
        {refs.length > 6 ? '…' : ''}
      </Text>
      {edit ? (
        <>
          <div className="carte-actions-grille">
            {ALIGNEMENTS.map((a) => (
              <Button key={a.k} size="xs" variant="default" onClick={() => onAlign(a.k)}>
                {a.l}
              </Button>
            ))}
            <Button size="xs" variant="default" disabled={refs.length < 3} onClick={() => onDistribute('h')}>
              Répartir horizontalement
            </Button>
            <Button size="xs" variant="default" disabled={refs.length < 3} onClick={() => onDistribute('v')}>
              Répartir verticalement
            </Button>
          </div>
          <Group gap="xs">
            <Button size="xs" variant="light" onClick={onGroup}>
              Grouper dans un cadre
            </Button>
            <Button size="xs" color="red" variant="light" onClick={onRemove}>
              Retirer de la carte
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            Glisser l’un des objets déplace toute la sélection. Maj+clic ajoute ou retire un objet ; Maj+glisser sur le
            fond sélectionne au lasso.
          </Text>
        </>
      ) : (
        <Text size="xs" c="dimmed">
          Passez en mode édition pour aligner ou grouper ces objets.
        </Text>
      )}
    </Stack>
  );
}

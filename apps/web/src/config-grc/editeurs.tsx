/* Éditeurs guidés des cinq types d'éléments du catalogue : aucune saisie de JSON. La validation complète (exhaustivité des
   matrices, couverture des correspondances, références épinglées) reste faite par le serveur à la simulation. */
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Checkbox,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import {
  CFG_FAMILIES,
  CFG_FAMILY_LABELS,
  MAPPING_AGGREGATION_LABELS,
  MAPPING_AGGREGATIONS,
  MATRIX_CATEGORIES,
  MATRIX_CATEGORY_LABELS,
  SCALE_CATEGORIES,
  SCALE_CATEGORY_LABELS,
  TAXONOMY_PURPOSE_LABELS,
  TAXONOMY_PURPOSES,
  type CfgFamily,
  type CfgRef,
  type CriteriaDefinition,
  type MappingDefinition,
  type MatrixDefinition,
  type ScaleDefinition,
  type ScaleLevel,
  type TaxonomyDefinition,
} from '@suivi/shared';
import { MATRICE } from '@suivi/ui';
import { texteSur } from '../grc/MatriceRisques';
import { cleDepuis, SelecteurElement, useVersion } from './commun';

interface Props<T> {
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}

const ACCEPTABILITE = [
  { value: 'acceptable', label: 'Acceptable' },
  { value: 'conditional', label: 'Sous conditions' },
  { value: 'unacceptable', label: 'Inacceptable' },
];
const EFFETS = [
  { value: 'retained', label: 'Retenu' },
  { value: 'excluded', label: 'Écarté' },
];

/** Champs d'en-tête communs : nom, description, applicabilité. */
function Entete<T extends { name: string; description: string; appliesTo: 'all' | CfgFamily[] }>({
  value,
  onChange,
  disabled,
}: Props<T>) {
  const toutes = value.appliesTo === 'all';
  return (
    <div className="grille-formulaire__champs">
      <TextInput
        label="Nom"
        required
        disabled={disabled}
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.currentTarget.value })}
      />
      <Textarea
        label="Description"
        autosize
        minRows={1}
        disabled={disabled}
        value={value.description}
        onChange={(e) => onChange({ ...value, description: e.currentTarget.value })}
      />
      <Stack gap="2xs">
        <Checkbox
          label="S’applique à toutes les méthodes"
          disabled={disabled}
          checked={toutes}
          onChange={(e) => onChange({ ...value, appliesTo: e.currentTarget.checked ? 'all' : ['custom'] })}
        />
        {!toutes && (
          <MultiSelect
            label="Familles de méthode concernées"
            disabled={disabled}
            data={CFG_FAMILIES.map((f) => ({ value: f, label: CFG_FAMILY_LABELS[f] }))}
            value={value.appliesTo as CfgFamily[]}
            onChange={(v) => onChange({ ...value, appliesTo: v.length ? (v as CfgFamily[]) : ['custom'] })}
          />
        )}
      </Stack>
    </div>
  );
}

function deplacer<T>(liste: T[], i: number, delta: number) {
  const j = i + delta;
  if (j < 0 || j >= liste.length) return liste;
  const copie = [...liste];
  [copie[i], copie[j]] = [copie[j]!, copie[i]!];
  return copie;
}

function Ordre({
  i,
  n,
  disabled,
  onMove,
  onRemove,
  libelle,
}: {
  i: number;
  n: number;
  disabled?: boolean;
  onMove: (delta: number) => void;
  onRemove: () => void;
  libelle: string;
}) {
  return (
    <Group gap="2xs" wrap="nowrap">
      <ActionIcon
        variant="default"
        aria-label={`Monter ${libelle}`}
        disabled={disabled || i === 0}
        onClick={() => onMove(-1)}
      >
        ↑
      </ActionIcon>
      <ActionIcon
        variant="default"
        aria-label={`Descendre ${libelle}`}
        disabled={disabled || i === n - 1}
        onClick={() => onMove(1)}
      >
        ↓
      </ActionIcon>
      <ActionIcon variant="default" aria-label={`Retirer ${libelle}`} disabled={disabled} onClick={onRemove}>
        ×
      </ActionIcon>
    </Group>
  );
}

/* ---------------------------------------------------------------- Échelle */
export function EditeurEchelle({
  value,
  onChange,
  disabled,
  idsFiges,
}: Props<ScaleDefinition> & { idsFiges: ReadonlySet<string> }) {
  const set = (patch: Partial<ScaleDefinition>) => onChange({ ...value, ...patch });
  const setLevel = (i: number, patch: Partial<ScaleLevel>) =>
    set({ levels: value.levels.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  const ajouter = () =>
    set({
      levels: [
        ...value.levels,
        {
          id: cleDepuis(
            '',
            value.levels.map((l) => l.id),
            'niveau',
          ),
          label: '',
          description: '',
          value: null,
          color: null,
          effect: null,
          acceptability: null,
          criteria: {},
        },
      ],
    });
  return (
    <Stack>
      <Entete value={value} onChange={(v) => onChange({ ...value, ...v })} disabled={disabled} />
      <div className="grille-formulaire__champs">
        <Select
          label="Catégorie"
          allowDeselect={false}
          disabled={disabled}
          data={SCALE_CATEGORIES.map((c) => ({ value: c, label: SCALE_CATEGORY_LABELS[c] }))}
          value={value.category}
          onChange={(v) => v && set({ category: v as ScaleDefinition['category'] })}
        />
        <Select
          label="Nature"
          description="Qualitative : aucune valeur numérique requise. Quantitative : une valeur à chaque niveau."
          allowDeselect={false}
          disabled={disabled}
          data={[
            { value: 'qualitative', label: 'Qualitative' },
            { value: 'quantitative', label: 'Quantitative' },
            { value: 'hybrid', label: 'Hybride (valeurs facultatives)' },
          ]}
          value={value.nature}
          onChange={(v) => v && set({ nature: v as ScaleDefinition['nature'] })}
        />
        <TextInput
          label="Unité"
          description="Facultative (par exemple euros, heures)."
          disabled={disabled}
          value={value.unit}
          onChange={(e) => set({ unit: e.currentTarget.value })}
        />
      </div>
      <Textarea
        label="Règles d’utilisation"
        description="Consultatif : comment choisir un niveau."
        autosize
        minRows={1}
        disabled={disabled}
        value={value.usage}
        onChange={(e) => set({ usage: e.currentTarget.value })}
      />
      <Text fw={600}>Niveaux, du plus faible au plus fort</Text>
      {value.levels.map((l, i) => (
        <Card withBorder key={i}>
          <Stack>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={600}>Niveau {i + 1}</Text>
              <Ordre
                i={i}
                n={value.levels.length}
                disabled={disabled}
                libelle={`le niveau ${l.label || i + 1}`}
                onMove={(d) => set({ levels: deplacer(value.levels, i, d) })}
                onRemove={() => set({ levels: value.levels.filter((_, k) => k !== i) })}
              />
            </Group>
            <div className="grille-formulaire__champs">
              <TextInput
                label="Libellé"
                required
                disabled={disabled}
                value={l.label}
                onChange={(e) => setLevel(i, { label: e.currentTarget.value })}
              />
              <TextInput
                label="Identifiant"
                description={idsFiges.has(l.id) ? 'Figé : déjà publié.' : 'Technique, non modifiable une fois publié.'}
                disabled={disabled || idsFiges.has(l.id)}
                value={l.id}
                onChange={(e) => setLevel(i, { id: e.currentTarget.value })}
              />
              <NumberInput
                label="Valeur numérique"
                description={value.nature === 'qualitative' ? 'Facultative.' : undefined}
                disabled={disabled}
                value={l.value ?? ''}
                allowNegative
                onChange={(v) => setLevel(i, { value: v === '' ? null : Number(v) })}
              />
              <Select
                label="Effet sur la suite de l’analyse"
                placeholder="Aucun"
                clearable
                disabled={disabled}
                data={EFFETS}
                value={l.effect}
                onChange={(v) => setLevel(i, { effect: (v as ScaleLevel['effect']) ?? null })}
              />
              <Select
                label="Acceptabilité"
                placeholder="Non renseignée"
                clearable
                disabled={disabled}
                data={ACCEPTABILITE}
                value={l.acceptability}
                onChange={(v) => setLevel(i, { acceptability: (v as ScaleLevel['acceptability']) ?? null })}
              />
              <Stack gap="2xs">
                <Checkbox
                  label="Couleur"
                  disabled={disabled}
                  checked={l.color !== null}
                  onChange={(e) => setLevel(i, { color: e.currentTarget.checked ? MATRICE.neutre : null })}
                />
                {l.color !== null && (
                  <TextInput
                    type="color"
                    aria-label={`Couleur du niveau ${l.label || i + 1}`}
                    disabled={disabled}
                    value={l.color}
                    onChange={(e) => setLevel(i, { color: e.currentTarget.value })}
                  />
                )}
              </Stack>
            </div>
            <Textarea
              label="Description du niveau"
              description="Ce que ce niveau signifie concrètement, pour que deux personnes l’appliquent de la même façon."
              autosize
              minRows={1}
              disabled={disabled}
              value={l.description}
              onChange={(e) => setLevel(i, { description: e.currentTarget.value })}
            />
            {value.dimensions.map((d) => (
              <Textarea
                key={d.id}
                label={`Descripteur : ${d.label}`}
                autosize
                minRows={1}
                disabled={disabled}
                value={l.criteria[d.id] ?? ''}
                onChange={(e) => setLevel(i, { criteria: { ...l.criteria, [d.id]: e.currentTarget.value } })}
              />
            ))}
          </Stack>
        </Card>
      ))}
      <Group>
        <Button variant="default" disabled={disabled || value.levels.length >= 20} onClick={ajouter}>
          Ajouter un niveau
        </Button>
      </Group>
      <Text fw={600}>Dimensions de la grille (facultatif)</Text>
      <Text size="sm" c="dimmed">
        Une grille décrit chaque niveau selon plusieurs dimensions, par exemple une catégorie d’impact. Sans dimension,
        l’échelle est simple.
      </Text>
      {value.dimensions.map((d, i) => (
        <Group key={i} align="end" wrap="nowrap">
          <TextInput
            label="Libellé de la dimension"
            disabled={disabled}
            value={d.label}
            onChange={(e) =>
              set({
                dimensions: value.dimensions.map((x, k) => (k === i ? { ...x, label: e.currentTarget.value } : x)),
              })
            }
          />
          <TextInput
            label="Identifiant"
            disabled={disabled || idsFiges.has('dim:' + d.id)}
            value={d.id}
            onChange={(e) =>
              set({ dimensions: value.dimensions.map((x, k) => (k === i ? { ...x, id: e.currentTarget.value } : x)) })
            }
          />
          <ActionIcon
            variant="default"
            aria-label={`Retirer la dimension ${d.label || i + 1}`}
            disabled={disabled}
            onClick={() => set({ dimensions: value.dimensions.filter((_, k) => k !== i) })}
          >
            ×
          </ActionIcon>
        </Group>
      ))}
      <Group>
        <Button
          variant="default"
          disabled={disabled || value.dimensions.length >= 20}
          onClick={() =>
            set({
              dimensions: [
                ...value.dimensions,
                {
                  id: cleDepuis(
                    '',
                    value.dimensions.map((d) => d.id),
                    'dimension',
                  ),
                  label: '',
                  short: '',
                },
              ],
            })
          }
        >
          Ajouter une dimension
        </Button>
      </Group>
    </Stack>
  );
}

/* ---------------------------------------------------------------- Matrice */
export function EditeurMatrice({ value, onChange, disabled }: Props<MatrixDefinition>) {
  const lignes = useVersion(value.rows.scale);
  const colonnes = useVersion(value.columns.scale);
  const resultat = useVersion(value.result.scale);
  const levels = (d?: { definition: Record<string, unknown> }) =>
    ((d?.definition?.levels as ScaleLevel[] | undefined) ?? []).map((l) => ({
      id: l.id,
      label: l.label,
      color: l.color ?? null,
    }));
  const L = levels(lignes.data),
    C = levels(colonnes.data),
    R = levels(resultat.data);
  const cellule = (row: string, column: string) => value.cells.find((c) => c.row === row && c.column === column);
  const poser = (row: string, column: string, result: string | null) => {
    const sans = value.cells.filter((c) => !(c.row === row && c.column === column));
    onChange({
      ...value,
      cells: result ? [...sans, { row, column, result, score: cellule(row, column)?.score ?? null }] : sans,
    });
  };
  const manquantes =
    L.length * C.length -
    value.cells.filter((c) => L.some((l) => l.id === c.row) && C.some((k) => k.id === c.column)).length;
  const echelle = (k: 'rows' | 'columns' | 'result', ref: CfgRef | null) => {
    if (!ref) return;
    onChange({
      ...value,
      cells: [],
      [k]: k === 'result' ? { scale: ref } : { ...value[k], scale: ref },
    });
  };
  return (
    <Stack>
      <Entete value={value} onChange={(v) => onChange({ ...value, ...v })} disabled={disabled} />
      <Select
        label="Catégorie"
        allowDeselect={false}
        disabled={disabled}
        data={MATRIX_CATEGORIES.map((c) => ({ value: c, label: MATRIX_CATEGORY_LABELS[c] }))}
        value={value.category}
        onChange={(v) => v && onChange({ ...value, category: v as MatrixDefinition['category'] })}
      />
      <Alert color="gray" title="Échelles épinglées">
        Changer une échelle efface les cellules déjà saisies : la grille dépend des niveaux de chaque échelle.
      </Alert>
      <div className="grille-formulaire__champs">
        <SelecteurElement
          label="Échelle des lignes"
          value={value.rows.scale}
          disabled={disabled}
          onChange={(r) => echelle('rows', r)}
        />
        <SelecteurElement
          label="Échelle des colonnes"
          value={value.columns.scale}
          disabled={disabled}
          onChange={(r) => echelle('columns', r)}
        />
        <SelecteurElement
          label="Échelle des résultats"
          value={value.result.scale}
          disabled={disabled}
          onChange={(r) => echelle('result', r)}
        />
        <TextInput
          label="Titre de l’axe des lignes"
          disabled={disabled}
          value={value.rows.label}
          onChange={(e) => onChange({ ...value, rows: { ...value.rows, label: e.currentTarget.value } })}
        />
        <TextInput
          label="Titre de l’axe des colonnes"
          disabled={disabled}
          value={value.columns.label}
          onChange={(e) => onChange({ ...value, columns: { ...value.columns, label: e.currentTarget.value } })}
        />
      </div>
      {L.length > 0 && C.length > 0 && R.length > 0 ? (
        <>
          <Text fw={600}>
            Résultat de chaque combinaison{' '}
            {manquantes > 0 ? `(${manquantes} case${manquantes > 1 ? 's' : ''} à renseigner)` : '(grille complète)'}
          </Text>
          <div className="matrice-defilement">
            <table className="matrice-risques" aria-label="Grille de la matrice">
              <thead>
                <tr>
                  <th scope="col">
                    {value.rows.label || 'Lignes'} ↓ · {value.columns.label || 'Colonnes'} →
                  </th>
                  {C.map((c) => (
                    <th key={c.id} scope="col">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {L.map((l) => (
                  <tr key={l.id}>
                    <th scope="row">{l.label}</th>
                    {C.map((c) => {
                      const r = cellule(l.id, c.id);
                      const niveau = R.find((x) => x.id === r?.result);
                      const fond = niveau?.color ?? MATRICE.neutre;
                      return (
                        <td key={c.id} className="matrice-cellule-td">
                          <div className={`matrice-cellule ${texteSur(fond)}`}>
                            <svg
                              className="matrice-fond"
                              aria-hidden="true"
                              focusable="false"
                              preserveAspectRatio="none"
                            >
                              <rect width="100%" height="100%" rx="6" fill={fond} />
                            </svg>
                            <Select
                              aria-label={`${value.rows.label || 'Ligne'} ${l.label}, ${value.columns.label || 'colonne'} ${c.label}`}
                              placeholder="À choisir"
                              clearable
                              disabled={disabled}
                              data={R.map((x) => ({ value: x.id, label: x.label }))}
                              value={r?.result ?? null}
                              onChange={(v) => poser(l.id, c.id, v)}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Text size="sm" c="dimmed">
          Choisissez les trois échelles pour afficher la grille.
        </Text>
      )}
    </Stack>
  );
}

/* ---------------------------------------------------------------- Correspondance */
export function EditeurCorrespondance({ value, onChange, disabled }: Props<MappingDefinition>) {
  const source = useVersion(value.from);
  const cible = useVersion(value.to);
  const S = (source.data?.definition.levels as ScaleLevel[] | undefined) ?? [];
  const T = (cible.data?.definition.levels as ScaleLevel[] | undefined) ?? [];
  const choisi = (from: string) => value.pairs.find((p) => p.from === from)?.to ?? null;
  const poser = (from: string, to: string | null) =>
    onChange({
      ...value,
      pairs: [...value.pairs.filter((p) => p.from !== from), ...(to ? [{ from, to }] : [])],
    });
  return (
    <Stack>
      <Entete value={value} onChange={(v) => onChange({ ...value, ...v })} disabled={disabled} />
      <div className="grille-formulaire__champs">
        <SelecteurElement
          label="Échelle de départ"
          value={value.from}
          disabled={disabled}
          onChange={(r) => r && onChange({ ...value, from: r, pairs: [] })}
        />
        <SelecteurElement
          label="Échelle d’arrivée"
          value={value.to}
          disabled={disabled}
          onChange={(r) => r && onChange({ ...value, to: r, pairs: [] })}
        />
        <Select
          label="Agrégation de plusieurs entrées"
          allowDeselect={false}
          disabled={disabled}
          data={MAPPING_AGGREGATIONS.map((a) => ({ value: a, label: MAPPING_AGGREGATION_LABELS[a] }))}
          value={value.aggregation}
          onChange={(v) => v && onChange({ ...value, aggregation: v as MappingDefinition['aggregation'] })}
        />
      </div>
      <Text fw={600}>Niveau d’arrivée associé à chaque niveau de départ</Text>
      {S.length === 0 || T.length === 0 ? (
        <Text size="sm" c="dimmed">
          Choisissez les deux échelles.
        </Text>
      ) : (
        S.map((s) => (
          <Select
            key={s.id}
            label={s.label}
            placeholder="À choisir"
            clearable
            disabled={disabled}
            data={T.map((t) => ({ value: t.id, label: t.label }))}
            value={choisi(s.id)}
            onChange={(v) => poser(s.id, v)}
          />
        ))
      )}
    </Stack>
  );
}

/* ---------------------------------------------------------------- Critères */
export function EditeurCriteres({
  value,
  onChange,
  disabled,
  idsFiges,
}: Props<CriteriaDefinition> & { idsFiges: ReadonlySet<string> }) {
  const set = (i: number, patch: Partial<CriteriaDefinition['criteria'][number]>) =>
    onChange({ ...value, criteria: value.criteria.map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  return (
    <Stack>
      <Entete value={value} onChange={(v) => onChange({ ...value, ...v })} disabled={disabled} />
      <Text fw={600}>Critères</Text>
      {value.criteria.map((c, i) => (
        <Card withBorder key={i}>
          <Stack>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={600}>Critère {i + 1}</Text>
              <Ordre
                i={i}
                n={value.criteria.length}
                disabled={disabled}
                libelle={`le critère ${c.label || i + 1}`}
                onMove={(d) => onChange({ ...value, criteria: deplacer(value.criteria, i, d) })}
                onRemove={() => onChange({ ...value, criteria: value.criteria.filter((_, k) => k !== i) })}
              />
            </Group>
            <div className="grille-formulaire__champs">
              <TextInput
                label="Libellé"
                required
                disabled={disabled}
                value={c.label}
                onChange={(e) => set(i, { label: e.currentTarget.value })}
              />
              <TextInput
                label="Identifiant"
                disabled={disabled || idsFiges.has(c.id)}
                value={c.id}
                onChange={(e) => set(i, { id: e.currentTarget.value })}
              />
              <SelecteurElement
                label="Échelle propre à ce critère"
                value={c.scale}
                disabled={disabled}
                onChange={(r) => r && set(i, { scale: r })}
              />
            </div>
            <Textarea
              label="Description"
              autosize
              minRows={1}
              disabled={disabled}
              value={c.description}
              onChange={(e) => set(i, { description: e.currentTarget.value })}
            />
          </Stack>
        </Card>
      ))}
      <Group>
        <AjouterCritere value={value} onChange={onChange} disabled={disabled} />
      </Group>
    </Stack>
  );
}

/* ---------------------------------------------------------------- Taxonomie */
export function EditeurTaxonomie({
  value,
  onChange,
  disabled,
  idsFiges,
}: Props<TaxonomyDefinition> & { idsFiges: ReadonlySet<string> }) {
  const set = (i: number, patch: Partial<TaxonomyDefinition['nodes'][number]>) =>
    onChange({ ...value, nodes: value.nodes.map((n, k) => (k === i ? { ...n, ...patch } : n)) });
  return (
    <Stack>
      <Entete value={value} onChange={(v) => onChange({ ...value, ...v })} disabled={disabled} />
      <Select
        label="Finalité"
        allowDeselect={false}
        disabled={disabled}
        data={TAXONOMY_PURPOSES.map((p) => ({ value: p, label: TAXONOMY_PURPOSE_LABELS[p] }))}
        value={value.purpose}
        onChange={(v) => v && onChange({ ...value, purpose: v as TaxonomyDefinition['purpose'] })}
      />
      <Text fw={600}>Catégories</Text>
      {value.nodes.map((n, i) => (
        <Card withBorder key={i}>
          <Stack>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={600}>{n.label || `Catégorie ${i + 1}`}</Text>
              <Ordre
                i={i}
                n={value.nodes.length}
                disabled={disabled}
                libelle={`la catégorie ${n.label || i + 1}`}
                onMove={(d) => onChange({ ...value, nodes: deplacer(value.nodes, i, d) })}
                onRemove={() =>
                  onChange({
                    ...value,
                    nodes: value.nodes
                      .filter((_, k) => k !== i)
                      .map((x) => (x.parent === n.id ? { ...x, parent: null } : x)),
                  })
                }
              />
            </Group>
            <div className="grille-formulaire__champs">
              <TextInput
                label="Libellé"
                required
                disabled={disabled}
                value={n.label}
                onChange={(e) => set(i, { label: e.currentTarget.value })}
              />
              <TextInput
                label="Identifiant"
                disabled={disabled || idsFiges.has(n.id)}
                value={n.id}
                onChange={(e) => set(i, { id: e.currentTarget.value })}
              />
              <Select
                label="Catégorie parente"
                placeholder="Aucune (racine)"
                clearable
                disabled={disabled}
                data={value.nodes.filter((x) => x.id !== n.id).map((x) => ({ value: x.id, label: x.label || x.id }))}
                value={n.parent}
                onChange={(v) => set(i, { parent: v })}
              />
            </div>
          </Stack>
        </Card>
      ))}
      <Group>
        <Button
          variant="default"
          disabled={disabled || value.nodes.length >= 500}
          onClick={() =>
            onChange({
              ...value,
              nodes: [
                ...value.nodes,
                {
                  id: cleDepuis(
                    '',
                    value.nodes.map((x) => x.id),
                    'categorie',
                  ),
                  label: '',
                  short: '',
                  parent: null,
                  description: '',
                },
              ],
            })
          }
        >
          Ajouter une catégorie
        </Button>
      </Group>
    </Stack>
  );
}

/* Ajout d'un critère (le type « critères » n'a pas d'autre point d'entrée). */
function AjouterCritere({ value, onChange, disabled }: Props<CriteriaDefinition>) {
  return (
    <Button
      variant="default"
      disabled={disabled || value.criteria.length >= 30 || !value.criteria[0]}
      onClick={() =>
        onChange({
          ...value,
          criteria: [
            ...value.criteria,
            {
              id: cleDepuis(
                '',
                value.criteria.map((x) => x.id),
                'critere',
              ),
              label: '',
              description: '',
              scale: value.criteria[0]!.scale,
            },
          ],
        })
      }
    >
      Ajouter un critère
    </Button>
  );
}

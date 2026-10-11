/* Boîtes de dialogue de la cartographie : assistant de génération (CARTO-05), ajout depuis la plateforme (CARTO-09),
   nouvelle relation (CARTO-07), versions (CARTO-11), conflit d'enregistrement (CARTO-07). */
import {
  Button,
  Checkbox,
  Group,
  Modal,
  Radio,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  ADD_TYPES,
  GRAPHIC_RELATION_TYPES,
  RELATIONS,
  TYPE_LABELS,
  type CartoObject,
  type GenerateOptions,
  type MapLayout,
  type MapVersionOut,
  type MapView,
  type RelationType,
} from '@suivi/shared/carto';
import { ErrorAlert } from '@suivi/ui';
import { useEffect, useMemo, useState } from 'react';

const compte = (objs: CartoObject[], t: string) => objs.filter((o) => o.type === t).length;

/* ---------------------------------------------------------------- Assistant de génération */
export function Assistant({
  opened,
  view,
  objs,
  existe,
  initial,
  onClose,
  onGenerate,
}: {
  opened: boolean;
  view: MapView;
  objs: CartoObject[];
  existe: boolean;
  initial: GenerateOptions;
  onClose: () => void;
  onGenerate: (o: GenerateOptions) => void;
}) {
  const [o, setO] = useState<GenerateOptions>(initial);
  useEffect(() => {
    if (opened) setO(initial);
  }, [opened, initial]);
  const set = (patch: Partial<GenerateOptions>) => setO((x) => ({ ...x, ...patch }));
  const cb = (k: keyof GenerateOptions, l: string, n?: number) => (
    <Checkbox
      key={k}
      label={n === undefined ? l : `${l} (${n})`}
      checked={!!o[k]}
      onChange={(e) => set({ [k]: e.currentTarget.checked })}
    />
  );
  const sp = objs.filter((x) => x.type === 'supplier');
  const spc = sp.filter((x) => x.crit || x.hds).length;
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      title={view === 'context' ? 'Générer la carte du contexte' : 'Générer la carte des processus'}
    >
      <Stack>
        {view === 'context' ? (
          <>
            <Text size="sm" c="dimmed">
              La carte est construite à partir des objets déjà saisis dans la plateforme puis disposée automatiquement :
              périmètre et SMSI au centre, parties intéressées à gauche, fournisseurs à droite, enjeux externes en haut
              et internes en bas.
            </Text>
            <Title order={4} size="h6">
              Types d’objets
            </Title>
            <div className="grille-formulaire">
              {cb('process', 'Processus', compte(objs, 'process'))}
              {cb('subprocess', 'Sous-processus', compte(objs, 'subprocess'))}
              {cb('stakeholder', 'Parties intéressées', compte(objs, 'stakeholder'))}
              {cb('supplier', 'Fournisseurs', sp.length)}
              {cb('external_issue', 'Enjeux externes', compte(objs, 'external_issue'))}
              {cb('internal_issue', 'Enjeux internes', compte(objs, 'internal_issue'))}
              {cb('application', 'Applications (GAP)', compte(objs, 'application'))}
              {cb('assets', 'Sites et infrastructures', compte(objs, 'site') + compte(objs, 'infrastructure'))}
            </div>
            <Title order={4} size="h6">
              Origine des enjeux
            </Title>
            <Group>
              {cb('iss_obj', 'Enjeux des objectifs')}
              {cb('iss_swot', 'Éléments des SWOT par processus')}
            </Group>
            <Radio.Group
              label="Fournisseurs"
              value={o.sups ?? 'all'}
              onChange={(v) => set({ sups: v as 'crit' | 'all' })}
            >
              <Stack gap="2xs" mt="2xs">
                <Radio
                  value="crit"
                  label={`Critiques ou hébergeurs HDS, et ceux liés à une application (${spc} qualifié${spc > 1 ? 's' : ''})`}
                />
                <Radio value="all" label={`Tous les fournisseurs (${sp.length})`} />
              </Stack>
            </Radio.Group>
            <Select
              label="Profondeur des relations"
              allowDeselect={false}
              value={String(o.depth ?? 2)}
              onChange={(v) => set({ depth: Number(v) as 1 | 2 | 3 })}
              data={[
                { value: '1', label: '1 — liens directs avec le SMSI et le périmètre' },
                { value: '2', label: '2 — et dépendances indirectes' },
                { value: '3', label: '3 — toutes les relations' },
              ]}
            />
          </>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              Les processus sont répartis en bandes selon leur famille (pilotage, réalisation, support) ; les
              sous-processus sont regroupés dans leur processus parent.
            </Text>
            <Group>
              {cb('process', 'Processus', compte(objs, 'process'))}
              {cb('subprocess', 'Sous-processus', compte(objs, 'subprocess'))}
            </Group>
            <Title order={4} size="h6">
              Relations proposées
            </Title>
            <Stack gap="2xs">
              {cb(
                'flows',
                'Flux principal entre processus de réalisation et entre processus de pilotage (ordre des codes)',
              )}
              {cb('lanes', 'Processus de support et de pilotage vers chaque processus de réalisation')}
            </Stack>
            <Text size="sm" c="dimmed">
              Les relations entre processus n’existent pas dans les données de la plateforme : elles sont créées comme
              propositions à valider sur la carte.
            </Text>
          </>
        )}
        {existe && (
          <Select
            label="Carte existante"
            allowDeselect={false}
            value={o.mode ?? 'replace'}
            onChange={(v) => set({ mode: v as 'replace' | 'complete' })}
            data={[
              { value: 'replace', label: 'Remplacer la disposition' },
              { value: 'complete', label: 'Compléter (conserver les positions)' },
            ]}
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => onGenerate(o)}>Générer</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/* ---------------------------------------------------------------- Ajout depuis la plateforme */
export function Ajout({
  opened,
  view,
  objs,
  layout,
  onClose,
  onAdd,
}: {
  opened: boolean;
  view: MapView;
  objs: CartoObject[];
  layout: MapLayout | null;
  onClose: () => void;
  onAdd: (refs: string[], depth: number) => void;
}) {
  const [q, setQ] = useState('');
  const [choix, setChoix] = useState<Set<string>>(new Set());
  const [dep, setDep] = useState('0');
  useEffect(() => {
    if (opened) {
      setQ('');
      setChoix(new Set());
      setDep('0');
    }
  }, [opened]);
  const types = ADD_TYPES[view];
  const L = useMemo(() => objs.filter((o) => types.includes(o.type) && !layout?.nodes[o.ref]), [objs, types, layout]);
  const filtre = q.trim().toLowerCase();
  const visibles = L.filter(
    (o) => !filtre || `${o.code ?? ''} ${o.name} ${o.sub ?? ''}`.toLowerCase().includes(filtre),
  );
  return (
    <Modal opened={opened} onClose={onClose} size="lg" title="Ajouter depuis la plateforme">
      <Stack>
        {!L.length ? (
          <Text>Tous les objets de la plateforme figurent déjà sur la carte.</Text>
        ) : (
          <>
            <TextInput
              label="Filtrer les objets"
              value={q}
              onChange={(e) => setQ(e.currentTarget.value)}
              data-autofocus
            />
            <ScrollArea.Autosize mah="50vh" type="auto">
              <Stack gap="xs">
                {types
                  .filter((t) => visibles.some((o) => o.type === t))
                  .map((t) => (
                    <Stack key={t} gap="2xs">
                      <Text size="sm" fw={700}>
                        {TYPE_LABELS[t]} ({visibles.filter((o) => o.type === t).length})
                      </Text>
                      {visibles
                        .filter((o) => o.type === t)
                        .map((o) => (
                          <Checkbox
                            key={o.ref}
                            checked={choix.has(o.ref)}
                            onChange={(e) => {
                              const n = new Set(choix);
                              if (e.currentTarget.checked) n.add(o.ref);
                              else n.delete(o.ref);
                              setChoix(n);
                            }}
                            label={`${o.code ? o.code + ' ' : ''}${o.name}`}
                            description={`${o.sub ?? ''}${layout?.ignored[o.ref] ? ' — ignoré précédemment' : ''}`}
                          />
                        ))}
                    </Stack>
                  ))}
              </Stack>
            </ScrollArea.Autosize>
            <Select
              label="Ajouter aussi"
              allowDeselect={false}
              value={dep}
              onChange={(v) => setDep(v ?? '0')}
              data={[
                { value: '0', label: 'L’objet seul' },
                { value: '1', label: 'L’objet et ses dépendances directes' },
                { value: '9', label: 'L’objet et tous les objets liés' },
              ]}
            />
          </>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!choix.size} onClick={() => onAdd([...choix], Number(dep))}>
            Ajouter
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/* ---------------------------------------------------------------- Nouvelle relation */
export function NouvelleRelation({
  liaison,
  view,
  nom,
  onClose,
  onCreate,
}: {
  liaison: { s: string; t: string } | null;
  view: MapView;
  nom: (ref: string) => string;
  onClose: () => void;
  onCreate: (type: RelationType) => void;
}) {
  const def: RelationType = view === 'process' ? 'flows_to' : 'related_to';
  const [type, setType] = useState<RelationType>(def);
  useEffect(() => {
    if (liaison) setType(def);
  }, [liaison, def]);
  return (
    <Modal opened={!!liaison} onClose={onClose} title="Nouvelle relation">
      {liaison && (
        <Stack>
          <Text size="sm">
            <b>{nom(liaison.s)}</b> → <b>{nom(liaison.t)}</b>
          </Text>
          <Select
            label="Type de relation"
            allowDeselect={false}
            value={type}
            onChange={(v) => v && setType(v as RelationType)}
            data={GRAPHIC_RELATION_TYPES.map((k) => ({ value: k, label: RELATIONS[k].l }))}
          />
          <Text size="sm" c="dimmed">
            La relation est enregistrée dans la présentation de la carte (relation graphique). Elle n’ajoute aucune
            donnée métier.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={() => onCreate(type)}>Créer la relation</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

/* ---------------------------------------------------------------- Versions */
const dateHeure = (d: string) => {
  const x = new Date(d);
  return `${x.toLocaleDateString('fr-FR')} à ${x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};
export function Versions({
  opened,
  versions,
  peutFiger,
  modifiee,
  canEdit,
  canDelete,
  erreur,
  onClose,
  onCreate,
  onRestore,
  onDelete,
}: {
  opened: boolean;
  versions: MapVersionOut[];
  peutFiger: boolean;
  modifiee: boolean;
  canEdit: boolean;
  canDelete: boolean;
  erreur: unknown;
  onClose: () => void;
  onCreate: (label: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [choix, setChoix] = useState<string | null>(null);
  useEffect(() => {
    if (opened) {
      setLabel('');
      setChoix(null);
    }
  }, [opened]);
  return (
    <Modal opened={opened} onClose={onClose} size="lg" title="Versions de la carte">
      <Stack>
        <ErrorAlert error={erreur} />
        {canEdit && (
          <Group align="flex-end" wrap="wrap">
            <TextInput
              className="carte-version-libelle"
              label="Nouvelle version"
              placeholder="Ex. Revue de direction 2026, validée en COPIL"
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              disabled={!peutFiger}
            />
            <Button onClick={() => onCreate(label)} disabled={!peutFiger}>
              Enregistrer une version
            </Button>
          </Group>
        )}
        {canEdit && modifiee && (
          <Text size="sm" c="dimmed">
            Enregistrez d’abord la carte : une version fige la carte enregistrée.
          </Text>
        )}
        <Title order={4} size="h6">
          Versions enregistrées ({versions.length})
        </Title>
        {versions.length ? (
          <Radio.Group value={choix} onChange={setChoix} aria-label="Versions enregistrées">
            <Stack gap="xs">
              {versions.map((v) => (
                <Radio
                  key={v.id}
                  value={v.id}
                  disabled={!canEdit && !canDelete}
                  label={v.label || 'Version'}
                  description={`${dateHeure(v.created_at)} par ${v.created_by} — ${v.nodes} éléments`}
                />
              ))}
            </Stack>
          </Radio.Group>
        ) : (
          <Text size="sm" c="dimmed">
            Aucune version. Une version fige la disposition enregistrée (par exemple pour la présenter en revue de
            direction) ; 20 versions au plus sont conservées.
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Fermer
          </Button>
          {canDelete && !!versions.length && (
            <Button color="red" variant="light" disabled={!choix} onClick={() => choix && onDelete(choix)}>
              Supprimer la version
            </Button>
          )}
          {canEdit && !!versions.length && (
            <Button disabled={!choix} onClick={() => choix && onRestore(choix)}>
              Restaurer la version
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}

/* ---------------------------------------------------------------- Conflit (412) */
export function Conflit({
  conflit,
  onReload,
  onOverwrite,
  onClose,
}: {
  conflit: { par: string; le: string } | null;
  onReload: () => void;
  onOverwrite: () => void;
  onClose: () => void;
}) {
  return (
    <Modal opened={!!conflit} onClose={onClose} title="Carte modifiée entre-temps">
      {conflit && (
        <Stack>
          <Text>
            La carte a été modifiée par <b>{conflit.par}</b>
            {conflit.le ? ` le ${dateHeure(conflit.le)}` : ''} depuis son ouverture.
          </Text>
          <Text size="sm" c="dimmed">
            « Recharger » abandonne vos modifications et affiche la carte enregistrée. « Écraser » enregistre votre
            carte à la place de la sienne (action journalisée).
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={onReload}>
              Recharger
            </Button>
            <Button color="red" onClick={onOverwrite}>
              Écraser
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

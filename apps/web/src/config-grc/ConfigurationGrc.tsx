/* Configuration GRC : échelles, matrices, correspondances, critères et taxonomies versionnés (ADR 0038). Cet écran est
   monté à deux endroits (Paramètres → Configuration GRC et Gestion des risques → Configuration des analyses) : mêmes API,
   même stockage, mêmes droits. Aucune valeur n'est fournie par défaut ; des modèles peuvent être adoptés à la demande. */
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Tabs,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  CFG_FAMILIES,
  CFG_FAMILY_LABELS,
  CFG_KINDS,
  CFG_KIND_LABELS,
  CFG_STATE_LABELS,
  CFG_STATES,
  MATRIX_CATEGORIES,
  MATRIX_CATEGORY_LABELS,
  SCALE_CATEGORIES,
  SCALE_CATEGORY_LABELS,
  TAXONOMY_PURPOSE_LABELS,
  TAXONOMY_PURPOSES,
  type CfgKind,
  type CfgRef,
  type CfgScope,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { cleDepuis, SelecteurElement, useElements, type ElementListe, type ModeleListe } from './commun';
import { Fiche } from './Fiche';

const PLURIELS: Record<CfgKind, string> = {
  scale: 'Échelles',
  matrix: 'Matrices',
  mapping: 'Correspondances',
  criteria: 'Critères',
  taxonomy: 'Taxonomies',
};
const AIDES: Record<CfgKind, string> = {
  scale:
    'Une échelle définit des niveaux libellés et décrits (impact, vraisemblance, gravité, besoin de sécurité…). Aucun nombre de niveaux ni aucune valeur numérique n’est imposé.',
  matrix:
    'Une matrice donne le niveau résultant de chaque combinaison de deux échelles (par exemple gravité et vraisemblance, ou ressources et motivation).',
  mapping:
    'Une correspondance associe chaque niveau d’une échelle à un niveau d’une autre (par exemple un impact vers une gravité proposée). L’analyste reste libre de retenir une autre valeur en la justifiant.',
  criteria:
    'Une liste de critères (par exemple disponibilité, intégrité, confidentialité) dont chacun a sa propre échelle.',
  taxonomy: 'Une taxonomie est une liste hiérarchique de catégories (catégories d’impact, de sources de risque…).',
};
export const CLE_FORMAT = /^[a-z][a-z0-9_]{0,63}$/;

export function ConfigurationGrc({
  kind,
  onKind,
  contexte,
}: {
  kind: CfgKind | 'modeles';
  onKind: (k: CfgKind | 'modeles') => void;
  contexte: 'plateforme' | 'analyses';
}) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [creer, setCreer] = useState(false);
  const can = useCan();
  const peutCreer = can('parametres', 'modifier') || can('pilotage', 'administrer');
  return (
    <Stack className="grille-formulaire">
      <Text>
        {contexte === 'plateforme'
          ? 'Définissez une fois les échelles, matrices, critères et catégories ; toutes les méthodes d’analyse les réutilisent.'
          : 'Ce sont les mêmes éléments que dans les paramètres de la plateforme : une modification faite ici est visible là-bas, et inversement.'}{' '}
        Une version publiée ne change jamais ; les méthodes et analyses restent épinglées à la version qu’elles
        utilisent.
      </Text>
      <Tabs value={kind} onChange={(v) => v && (setOuvert(null), onKind(v as CfgKind | 'modeles'))} keepMounted={false}>
        <Tabs.List>
          {CFG_KINDS.map((k) => (
            <Tabs.Tab key={k} value={k}>
              {PLURIELS[k]}
            </Tabs.Tab>
          ))}
          <Tabs.Tab value="modeles">Modèles</Tabs.Tab>
        </Tabs.List>
        {CFG_KINDS.map((k) => (
          <Tabs.Panel key={k} value={k} pt="md">
            <Stack>
              <Text size="sm">{AIDES[k]}</Text>
              <Liste
                kind={k}
                selection={ouvert}
                onOpen={setOuvert}
                action={
                  peutCreer ? (
                    <Button onClick={() => setCreer(true)}>Nouvel élément : {CFG_KIND_LABELS[k].toLowerCase()}</Button>
                  ) : null
                }
              />
              {ouvert && <Fiche id={ouvert} onClose={() => setOuvert(null)} />}
            </Stack>
          </Tabs.Panel>
        ))}
        <Tabs.Panel value="modeles" pt="md">
          <Modeles onOpen={(k, id) => (onKind(k), setOuvert(id))} />
        </Tabs.Panel>
      </Tabs>
      {kind !== 'modeles' && (
        <Nouveau
          kind={kind}
          opened={creer}
          onClose={() => setCreer(false)}
          onCreated={(id) => {
            setCreer(false);
            setOuvert(id);
          }}
        />
      )}
    </Stack>
  );
}

/* ---------------------------------------------------------------- Liste */
function Liste({
  kind,
  selection,
  onOpen,
  action,
}: {
  kind: CfgKind;
  selection: string | null;
  onOpen: (id: string) => void;
  action: React.ReactNode;
}) {
  const [etat, setEtat] = useState<string | null>(null);
  const [famille, setFamille] = useState<string | null>(null);
  const [texte, setTexte] = useState('');
  const extra: Record<string, string> = {};
  if (etat) extra.state = etat;
  if (famille) extra.family = famille;
  if (texte.trim()) extra.q = texte.trim();
  const q = useElements(kind, extra);
  const categorie = (e: ElementListe) =>
    kind === 'scale'
      ? (SCALE_CATEGORY_LABELS[e.category as keyof typeof SCALE_CATEGORY_LABELS] ?? e.category)
      : kind === 'matrix'
        ? (MATRIX_CATEGORY_LABELS[e.category as keyof typeof MATRIX_CATEGORY_LABELS] ?? e.category)
        : kind === 'taxonomy'
          ? (TAXONOMY_PURPOSE_LABELS[e.category as keyof typeof TAXONOMY_PURPOSE_LABELS] ?? e.category)
          : '';
  return (
    <Stack>
      <Group align="end" justify="space-between">
        <Group align="end">
          <TextInput label="Recherche" value={texte} onChange={(e) => setTexte(e.currentTarget.value)} />
          <Select
            label="État"
            placeholder="Tous"
            clearable
            data={CFG_STATES.map((s) => ({ value: s, label: CFG_STATE_LABELS[s] }))}
            value={etat}
            onChange={setEtat}
          />
          <Select
            label="Méthode concernée"
            placeholder="Toutes"
            clearable
            data={CFG_FAMILIES.map((f) => ({ value: f, label: CFG_FAMILY_LABELS[f] }))}
            value={famille}
            onChange={setFamille}
          />
        </Group>
        {action}
      </Group>
      <ErrorAlert error={q.error} />
      {q.data && q.data.length === 0 && (
        <Alert color="gray" title="Aucun élément">
          Le catalogue est vide à l’installation. Créez un élément, ou adoptez un modèle depuis l’onglet « Modèles ».
        </Alert>
      )}
      {q.data && q.data.length > 0 && (
        <div className="table-wrap" role="region" aria-label={PLURIELS[kind]} tabIndex={0}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nom</Table.Th>
                <Table.Th>Identifiant</Table.Th>
                {categorie(q.data[0]!) !== '' && <Table.Th>Catégorie</Table.Th>}
                <Table.Th>Portée</Table.Th>
                <Table.Th>État</Table.Th>
                <Table.Th>Version</Table.Th>
                <Table.Th>Usages</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {q.data.map((e) => (
                <Table.Tr key={e.id} data-selected={e.id === selection || undefined}>
                  <Table.Td>{e.name || '(sans nom)'}</Table.Td>
                  <Table.Td>
                    <code>{e.key}</code>
                  </Table.Td>
                  {categorie(q.data[0]!) !== '' && <Table.Td>{categorie(e)}</Table.Td>}
                  <Table.Td>{e.scope === 'instance' ? 'Organisation' : 'Périmètre'}</Table.Td>
                  <Table.Td>
                    <Badge
                      variant="light"
                      color={e.state === 'active' ? 'teal' : e.state === 'archived' ? 'orange' : 'gray'}
                    >
                      {CFG_STATE_LABELS[e.state]}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{e.currentVersion ?? '—'}</Table.Td>
                  <Table.Td>{e.usages}</Table.Td>
                  <Table.Td>
                    <Button size="compact-sm" variant="default" onClick={() => onOpen(e.id)}>
                      Ouvrir
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      )}
    </Stack>
  );
}

/* ---------------------------------------------------------------- Création */
function Nouveau({
  kind,
  opened,
  onClose,
  onCreated,
}: {
  kind: CfgKind;
  opened: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const can = useCan();
  const [nom, setNom] = useState('');
  const [cle, setCle] = useState('');
  const [cleManuelle, setCleManuelle] = useState(false);
  const [portee, setPortee] = useState<CfgScope>('instance');
  const [smsi, setSmsi] = useState<string | null>(null);
  const [categorie, setCategorie] = useState<string | null>(null);
  const [niveaux, setNiveaux] = useState<string[]>([]);
  const [critere, setCritere] = useState('');
  const [noeud, setNoeud] = useState('');
  const [a, setA] = useState<CfgRef | null>(null);
  const [b, setB] = useState<CfgRef | null>(null);
  const [c, setC] = useState<CfgRef | null>(null);
  const [erreur, setErreur] = useState<unknown>(null);
  const perimetres = useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () => get<{ id: string; name: string }[]>('/api/grc/smsis'),
    enabled: opened,
  });
  const droitOrganisation = can('parametres', 'modifier');
  const droitPerimetre = can('pilotage', 'administrer');
  const complet = (() => {
    if (!nom.trim() || !CLE_FORMAT.test(cle)) return false;
    if (portee === 'smsi' && !smsi) return false;
    if (kind === 'scale') return !!categorie && niveaux.length >= 2;
    if (kind === 'matrix') return !!categorie && !!a && !!b && !!c;
    if (kind === 'mapping') return !!a && !!b;
    if (kind === 'criteria') return !!critere.trim() && !!a;
    return !!categorie && !!noeud.trim();
  })();
  const definition = () => {
    const base = { name: nom.trim(), description: '', appliesTo: 'all' };
    switch (kind) {
      case 'scale':
        return {
          ...base,
          category: categorie,
          nature: 'qualitative',
          levels: niveaux.map((label, i) => ({
            id: cleDepuis(
              label,
              niveaux.slice(0, i).map((x, k) => cleDepuis(x, [], 'niveau') + k),
              'niveau',
            ),
            label,
          })),
        };
      case 'matrix':
        return {
          ...base,
          category: categorie,
          rows: { scale: a, label: '' },
          columns: { scale: b, label: '' },
          result: { scale: c },
          cells: [],
        };
      case 'mapping':
        return { ...base, from: a, to: b, pairs: [], aggregation: 'max' };
      case 'criteria':
        return { ...base, criteria: [{ id: cleDepuis(critere, [], 'critere'), label: critere.trim(), scale: a }] };
      case 'taxonomy':
        return { ...base, purpose: categorie, nodes: [{ id: cleDepuis(noeud, [], 'categorie'), label: noeud.trim() }] };
    }
  };
  const creer = async () => {
    setErreur(null);
    try {
      const item = await api<{ id: string }>('POST', '/api/config-grc/items', {
        body: { kind, key: cle, scope: portee, smsiId: portee === 'smsi' ? smsi : null, definition: definition() },
      });
      notifications.show({ color: 'teal', message: 'Brouillon créé : complétez-le puis publiez-le.' });
      await qc.invalidateQueries({ queryKey: ['config-grc'] });
      setNom('');
      setCle('');
      setCleManuelle(false);
      setNiveaux([]);
      setCritere('');
      setNoeud('');
      setCategorie(null);
      setA(null);
      setB(null);
      setC(null);
      onCreated(item.id);
    } catch (e) {
      setErreur(e);
    }
  };
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Nouvel élément : ${CFG_KIND_LABELS[kind].toLowerCase()}`}
      size="lg"
      centered
      lockScroll={false}
    >
      <Stack>
        <TextInput
          label="Nom"
          required
          value={nom}
          onChange={(e) => {
            setNom(e.currentTarget.value);
            if (!cleManuelle) setCle(cleDepuis(e.currentTarget.value, [], kind));
          }}
        />
        <TextInput
          label="Identifiant"
          description="Technique et stable : minuscules, chiffres et tirets bas, commence par une lettre."
          value={cle}
          error={cle && !CLE_FORMAT.test(cle) ? 'Format invalide.' : undefined}
          onChange={(e) => {
            setCle(e.currentTarget.value);
            setCleManuelle(true);
          }}
        />
        <Select
          label="Portée"
          allowDeselect={false}
          data={[
            ...(droitOrganisation
              ? [{ value: 'instance', label: 'Organisation (toutes les méthodes et tous les périmètres)' }]
              : []),
            ...(droitPerimetre ? [{ value: 'smsi', label: 'Un périmètre' }] : []),
          ]}
          value={portee}
          onChange={(v) => v && setPortee(v as CfgScope)}
        />
        {portee === 'smsi' && (
          <Select
            label="Périmètre"
            data={(perimetres.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            value={smsi}
            onChange={setSmsi}
          />
        )}
        {kind === 'scale' && (
          <>
            <Select
              label="Catégorie"
              data={SCALE_CATEGORIES.map((x) => ({ value: x, label: SCALE_CATEGORY_LABELS[x] }))}
              value={categorie}
              onChange={setCategorie}
            />
            <TagsInput
              label="Libellés des niveaux, du plus faible au plus fort"
              description="Au moins deux. Validez chaque libellé avec Entrée ; vous pourrez ensuite les décrire, les réordonner et ajouter des valeurs."
              value={niveaux}
              onChange={setNiveaux}
            />
          </>
        )}
        {kind === 'matrix' && (
          <>
            <Select
              label="Catégorie"
              data={MATRIX_CATEGORIES.map((x) => ({ value: x, label: MATRIX_CATEGORY_LABELS[x] }))}
              value={categorie}
              onChange={setCategorie}
            />
            <SelecteurElement label="Échelle des lignes" value={a} onChange={setA} />
            <SelecteurElement label="Échelle des colonnes" value={b} onChange={setB} />
            <SelecteurElement label="Échelle des résultats" value={c} onChange={setC} />
          </>
        )}
        {kind === 'mapping' && (
          <>
            <SelecteurElement label="Échelle de départ" value={a} onChange={setA} />
            <SelecteurElement label="Échelle d’arrivée" value={b} onChange={setB} />
          </>
        )}
        {kind === 'criteria' && (
          <>
            <TextInput
              label="Premier critère"
              required
              value={critere}
              onChange={(e) => setCritere(e.currentTarget.value)}
            />
            <SelecteurElement label="Échelle de ce critère" value={a} onChange={setA} />
          </>
        )}
        {kind === 'taxonomy' && (
          <>
            <Select
              label="Finalité"
              data={TAXONOMY_PURPOSES.map((x) => ({ value: x, label: TAXONOMY_PURPOSE_LABELS[x] }))}
              value={categorie}
              onChange={setCategorie}
            />
            <TextInput
              label="Première catégorie"
              required
              value={noeud}
              onChange={(e) => setNoeud(e.currentTarget.value)}
            />
          </>
        )}
        <ErrorAlert error={erreur} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!complet} onClick={() => void creer()}>
            Créer le brouillon
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/* ---------------------------------------------------------------- Modèles */
function Modeles({ onOpen }: { onOpen: (kind: CfgKind, id: string) => void }) {
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery({
    queryKey: ['config-grc', 'modeles'],
    queryFn: () => get<ModeleListe[]>('/api/config-grc/templates'),
  });
  const [erreur, setErreur] = useState<unknown>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const adopter = async (m: ModeleListe) => {
    setOccupe(m.id);
    setErreur(null);
    try {
      const items = await api<{ id: string; kind: CfgKind }[]>('POST', `/api/config-grc/templates/${m.id}/adopt`);
      notifications.show({
        color: 'teal',
        message: `Modèle adopté : ${items.length} éléments créés en version 1, à relire.`,
      });
      await qc.invalidateQueries({ queryKey: ['config-grc'] });
      if (items[0]) onOpen(items[0].kind, items[0].id);
    } catch (e) {
      setErreur(e);
    } finally {
      setOccupe(null);
    }
  };
  return (
    <Stack>
      <Text size="sm">
        Les modèles sont des propositions : rien n’est présent dans le catalogue tant que vous n’en adoptez pas un. Un
        modèle adopté crée des éléments d’organisation, publiés en version 1 avec leur provenance ; relisez-les et
        faites-les valider avant usage.
      </Text>
      <ErrorAlert error={erreur ?? q.error} />
      {q.data?.map((m) => (
        <Card withBorder key={m.id}>
          <Stack>
            <Text fw={600}>{m.label}</Text>
            <Text size="sm">{m.description}</Text>
            <Alert color="gray" title="À valider">
              {m.note}
            </Alert>
            <Text size="sm">
              Contenu : {m.items.map((i) => `${CFG_KIND_LABELS[i.kind].toLowerCase()} « ${i.key} »`).join(', ')}.
            </Text>
            {can('parametres', 'administrer') && (
              <Group>
                <Button loading={occupe === m.id} onClick={() => void adopter(m)}>
                  Adopter ce modèle
                </Button>
              </Group>
            )}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

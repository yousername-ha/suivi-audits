/* Fiche d'un élément du catalogue : définition (brouillon éditable), versions immuables, dépendances. Publier passe par une
   simulation (validation et impact), un motif et une confirmation explicite. */
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
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  CFG_KIND_LABELS,
  CFG_STATE_LABELS,
  parseCfgDefinition,
  type CriteriaDefinition,
  type MappingDefinition,
  type MatrixDefinition,
  type ScaleDefinition,
  type ScaleDiff,
  type TaxonomyDefinition,
} from '@suivi/shared';
import { ConfirmDialog } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';
import { useCan } from '../session';
import { EditeurCorrespondance, EditeurCriteres, EditeurEchelle, EditeurMatrice, EditeurTaxonomie } from './editeurs';
import { USAGE_LABELS, useElement, type Definition, type ElementDetail, type Simulation, type Usage } from './commun';

const ETAT_COULEUR = { draft: 'gray', active: 'teal', archived: 'orange' } as const;

function DiffEchelle({ diff }: { diff: ScaleDiff }) {
  const rien =
    !diff.added.length && !diff.removed.length && !diff.renamed.length && !diff.valueChanged.length && !diff.reordered;
  if (rien) return <Text size="sm">Aucune différence de niveaux.</Text>;
  return (
    <Stack gap="2xs">
      {diff.breaking && (
        <Alert color="orange" title="Changement structurant">
          Un niveau disparaît, l’ordre ou les valeurs changent : les consommateurs doivent être revus avant d’adopter
          cette version.
        </Alert>
      )}
      <ul>
        {diff.added.map((x) => (
          <li key={'a' + x}>Niveau ajouté : {x}</li>
        ))}
        {diff.removed.map((x) => (
          <li key={'r' + x}>Niveau retiré : {x}</li>
        ))}
        {diff.renamed.map((x) => (
          <li key={'n' + x.id}>
            Libellé de « {x.id} » : {x.from} → {x.to}
          </li>
        ))}
        {diff.valueChanged.map((x) => (
          <li key={'v' + x.id}>
            Valeur de « {x.id} » : {x.from ?? 'aucune'} → {x.to ?? 'aucune'}
          </li>
        ))}
        {diff.reordered && <li>Ordre des niveaux modifié.</li>}
      </ul>
    </Stack>
  );
}

export function Fiche({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useElement(id);
  if (q.error) return <ErrorAlert error={q.error} />;
  if (!q.data) return null;
  // key : une nouvelle version de l'élément (enregistrement, publication, autre personne) recharge le brouillon local.
  return <FicheChargee key={q.data.id + ':' + q.data.version} item={q.data} onClose={onClose} />;
}

function FicheChargee({ item, onClose }: { item: ElementDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const can = useCan();
  const enregistre = item.draft ?? item.definition ?? {};
  const [valeur, setValeur] = useState<Definition>(enregistre);
  const [erreur, setErreur] = useState<unknown>(null);
  const [occupe, setOccupe] = useState(false);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [motif, setMotif] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deriver, setDeriver] = useState(false);
  const [dialogue, setDialogue] = useState<'archiver' | 'restaurer' | 'supprimer' | null>(null);

  const droitEcriture = item.scope === 'instance' ? can('parametres', 'modifier') : can('pilotage', 'administrer');
  const droitPublier = item.scope === 'instance' ? can('parametres', 'administrer') : can('pilotage', 'administrer');
  const modifiable = droitEcriture && item.state !== 'archived';
  const modifie = JSON.stringify(valeur) !== JSON.stringify(enregistre);
  const analyse = parseCfgDefinition(item.kind, valeur);
  const invalides = analyse.ok ? [] : analyse.errors;
  const idsFiges = new Set<string>();
  if (item.definition) {
    const d = item.definition as Record<string, unknown>;
    for (const l of (d.levels as { id: string }[] | undefined) ?? []) idsFiges.add(l.id);
    for (const l of (d.dimensions as { id: string }[] | undefined) ?? []) idsFiges.add('dim:' + l.id);
    for (const l of (d.criteria as { id: string }[] | undefined) ?? []) idsFiges.add(l.id);
    for (const l of (d.nodes as { id: string }[] | undefined) ?? []) idsFiges.add(l.id);
  }
  const rafraichir = () => qc.invalidateQueries({ queryKey: ['config-grc'] });

  const enregistrer = async () => {
    await api('PUT', `/api/config-grc/items/${item.id}/draft`, {
      body: { definition: analyse.ok ? analyse.definition : valeur },
      ifMatch: item.version,
    });
  };
  const agir = async (f: () => Promise<unknown>, ok?: string) => {
    setOccupe(true);
    setErreur(null);
    try {
      await f();
      if (ok) notifications.show({ color: 'teal', message: ok });
      await rafraichir();
    } catch (e) {
      setErreur(e);
    } finally {
      setOccupe(false);
    }
  };
  const simuler = () =>
    agir(async () => {
      if (modifie) await enregistrer();
      const s = await api<Simulation>('POST', `/api/config-grc/items/${item.id}/preview`);
      setSimulation(s);
      setMotif('');
      setConfirmation('');
    });
  const publier = () =>
    agir(async () => {
      const fresh = await get<ElementDetail>(`/api/config-grc/items/${item.id}`);
      await api('POST', `/api/config-grc/items/${item.id}/publish`, {
        body: { previewId: simulation!.previewId, reason: motif.trim(), confirm: 'PUBLIER' },
        ifMatch: fresh.version,
      });
      setSimulation(null);
    }, 'Version publiée.');

  const editeur = () => {
    const props = { disabled: !modifiable || occupe };
    switch (item.kind) {
      case 'scale':
        return (
          <EditeurEchelle
            {...props}
            idsFiges={idsFiges}
            value={valeur as unknown as ScaleDefinition}
            onChange={(v) => setValeur(v as unknown as Definition)}
          />
        );
      case 'matrix':
        return (
          <EditeurMatrice
            {...props}
            value={valeur as unknown as MatrixDefinition}
            onChange={(v) => setValeur(v as unknown as Definition)}
          />
        );
      case 'mapping':
        return (
          <EditeurCorrespondance
            {...props}
            value={valeur as unknown as MappingDefinition}
            onChange={(v) => setValeur(v as unknown as Definition)}
          />
        );
      case 'criteria':
        return (
          <EditeurCriteres
            {...props}
            idsFiges={idsFiges}
            value={valeur as unknown as CriteriaDefinition}
            onChange={(v) => setValeur(v as unknown as Definition)}
          />
        );
      case 'taxonomy':
        return (
          <EditeurTaxonomie
            {...props}
            idsFiges={idsFiges}
            value={valeur as unknown as TaxonomyDefinition}
            onChange={(v) => setValeur(v as unknown as Definition)}
          />
        );
    }
  };

  return (
    <Card withBorder>
      <Stack>
        <Group justify="space-between" align="start">
          <div>
            <Text fw={700} size="lg">
              {item.name || item.key}
            </Text>
            <Text size="sm" c="dimmed">
              {CFG_KIND_LABELS[item.kind]} · identifiant <code>{item.key}</code> ·{' '}
              {item.scope === 'instance' ? 'organisation' : 'périmètre'}
            </Text>
          </div>
          <Group gap="xs">
            <Badge color={ETAT_COULEUR[item.state]}>{CFG_STATE_LABELS[item.state]}</Badge>
            {item.currentVersion && <Badge variant="light">Version {item.currentVersion}</Badge>}
            {item.draft && item.currentVersion && <Badge color="blue">Brouillon en cours</Badge>}
            <Button variant="default" size="xs" onClick={onClose}>
              Fermer la fiche
            </Button>
          </Group>
        </Group>
        {item.derivedFrom && (
          <Text size="sm">
            Variante dérivée de la version {item.derivedFrom.version} d’un autre élément (l’origine n’est jamais
            modifiée).
          </Text>
        )}
        {typeof item.origin.note === 'string' && (
          <Alert color="gray" title="Modèle adopté">
            {item.origin.note}
          </Alert>
        )}
        <ErrorAlert error={erreur} />
        <Tabs defaultValue="definition" keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="definition">Définition</Tabs.Tab>
            <Tabs.Tab value="versions">Versions ({item.versions.length})</Tabs.Tab>
            <Tabs.Tab value="dependances">Dépendances ({item.usages})</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="definition" pt="md">
            <Stack>
              {!droitEcriture && (
                <Alert color="gray">
                  Vous pouvez consulter cet élément ; sa modification exige un droit supplémentaire.
                </Alert>
              )}
              {item.state === 'archived' && (
                <Alert color="orange">
                  Élément archivé : il ne reçoit plus de nouvel usage. Restaurez-le pour le modifier.
                </Alert>
              )}
              {editeur()}
              {modifiable && invalides.length > 0 && (
                <Alert color="orange" title="À compléter avant d’enregistrer">
                  <ul>
                    {invalides.slice(0, 6).map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              <Group>
                {modifiable && (
                  <Button
                    loading={occupe}
                    disabled={!modifie || !analyse.ok}
                    onClick={() => void agir(enregistrer, 'Brouillon enregistré.')}
                  >
                    Enregistrer le brouillon
                  </Button>
                )}
                {droitPublier && item.state !== 'archived' && (
                  <Button
                    variant="default"
                    loading={occupe}
                    disabled={!analyse.ok || (!modifie && !item.draft)}
                    onClick={() => void simuler()}
                  >
                    Simuler et publier
                  </Button>
                )}
                {item.currentVersion && droitEcriture && (
                  <Button variant="default" onClick={() => setDeriver(true)}>
                    Créer une variante
                  </Button>
                )}
                {droitPublier && item.state !== 'archived' && item.currentVersion && (
                  <Button variant="default" onClick={() => setDialogue('archiver')}>
                    Archiver
                  </Button>
                )}
                {droitPublier && item.state === 'archived' && (
                  <Button variant="default" onClick={() => setDialogue('restaurer')}>
                    Restaurer
                  </Button>
                )}
                {droitPublier && !item.currentVersion && (
                  <Button color="red" variant="outline" onClick={() => setDialogue('supprimer')}>
                    Supprimer le brouillon
                  </Button>
                )}
              </Group>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="versions" pt="md">
            <Versions item={item} />
          </Tabs.Panel>
          <Tabs.Panel value="dependances" pt="md">
            <Dependances item={item} />
          </Tabs.Panel>
        </Tabs>
      </Stack>

      <Modal
        opened={!!simulation}
        onClose={() => setSimulation(null)}
        title={`Publier la version ${simulation?.nextVersion ?? ''}`}
        size="lg"
        centered
        lockScroll={false}
      >
        {simulation && (
          <Stack>
            {simulation.errors.length > 0 && (
              <Alert color="red" title="La simulation refuse cette définition">
                <ul>
                  {simulation.errors.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </Alert>
            )}
            {!simulation.changed && <Alert color="orange">Aucun changement par rapport à la version courante.</Alert>}
            <Text size="sm">{simulation.impact.note}</Text>
            {simulation.impact.pinnedConsumers > 0 && (
              <Text size="sm">
                Consommateurs de la version courante : {simulation.impact.pinnedConsumers}. Ils restent épinglés à leur
                version.
              </Text>
            )}
            {simulation.impact.scaleDiff && <DiffEchelle diff={simulation.impact.scaleDiff} />}
            <Textarea
              label="Motif de la publication"
              description="Obligatoire (5 caractères au moins) ; conservé avec la version."
              value={motif}
              onChange={(e) => setMotif(e.currentTarget.value)}
              autosize
              minRows={2}
            />
            <TextInput
              label="Pour confirmer, saisissez PUBLIER"
              value={confirmation}
              onChange={(e) => setConfirmation(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setSimulation(null)}>
                Annuler
              </Button>
              <Button
                loading={occupe}
                disabled={
                  !simulation.valid || !simulation.changed || motif.trim().length < 5 || confirmation !== 'PUBLIER'
                }
                onClick={() => void publier()}
              >
                Publier la version {simulation.nextVersion}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
      <Deriver item={item} opened={deriver} onClose={() => setDeriver(false)} />
      <ConfirmDialog
        opened={dialogue !== null}
        title={dialogue === 'supprimer' ? 'Supprimer le brouillon' : dialogue === 'archiver' ? 'Archiver' : 'Restaurer'}
        message={
          dialogue === 'supprimer'
            ? 'Ce brouillon, jamais publié, sera supprimé définitivement.'
            : dialogue === 'archiver'
              ? 'L’élément n’acceptera plus de nouvel usage ; les usages existants et leurs versions sont conservés.'
              : 'L’élément redevient utilisable.'
        }
        confirmLabel={dialogue === 'supprimer' ? 'Supprimer' : dialogue === 'archiver' ? 'Archiver' : 'Restaurer'}
        color={dialogue === 'restaurer' ? 'teal' : 'red'}
        onClose={() => setDialogue(null)}
        onConfirm={() =>
          agir(async () => {
            if (dialogue === 'supprimer') {
              await api('DELETE', `/api/config-grc/items/${item.id}`);
              onClose();
            } else
              await api('POST', `/api/config-grc/items/${item.id}/${dialogue === 'archiver' ? 'archive' : 'restore'}`);
          })
        }
      />
    </Card>
  );
}

function Deriver({ item, opened, onClose }: { item: ElementDetail; opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [cle, setCle] = useState('');
  const [nom, setNom] = useState('');
  const [portee, setPortee] = useState<'instance' | 'smsi'>('instance');
  const [smsi, setSmsi] = useState<string | null>(null);
  const [erreur, setErreur] = useState<unknown>(null);
  const perimetres = useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () => get<{ id: string; name: string }[]>('/api/grc/smsis'),
    enabled: opened,
  });
  const creer = async () => {
    setErreur(null);
    try {
      await api('POST', `/api/config-grc/items/${item.id}/derive`, {
        body: { key: cle, name: nom || undefined, scope: portee, smsiId: portee === 'smsi' ? smsi : null },
      });
      notifications.show({ color: 'teal', message: 'Variante créée en brouillon.' });
      await qc.invalidateQueries({ queryKey: ['config-grc'] });
      onClose();
    } catch (e) {
      setErreur(e);
    }
  };
  return (
    <Modal opened={opened} onClose={onClose} title="Créer une variante" centered lockScroll={false}>
      <Stack>
        <Text size="sm">
          La variante est une copie de la version {item.currentVersion} qui mémorise son origine. L’élément d’origine
          n’est jamais modifié.
        </Text>
        <TextInput
          label="Identifiant"
          description="Minuscules, chiffres et tirets bas ; commence par une lettre."
          value={cle}
          onChange={(e) => setCle(e.currentTarget.value)}
        />
        <TextInput label="Nom (facultatif)" value={nom} onChange={(e) => setNom(e.currentTarget.value)} />
        <Select
          label="Portée"
          allowDeselect={false}
          data={[
            { value: 'instance', label: 'Organisation' },
            { value: 'smsi', label: 'Un périmètre' },
          ]}
          value={portee}
          onChange={(v) => v && setPortee(v as 'instance' | 'smsi')}
        />
        {portee === 'smsi' && (
          <Select
            label="Périmètre"
            data={(perimetres.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            value={smsi}
            onChange={setSmsi}
          />
        )}
        <ErrorAlert error={erreur} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!cle || (portee === 'smsi' && !smsi)} onClick={() => void creer()}>
            Créer la variante
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function Versions({ item }: { item: ElementDetail }) {
  const [comparaison, setComparaison] = useState<number | null>(null);
  const diff = useQuery({
    queryKey: ['config-grc', 'impact', item.id, comparaison],
    queryFn: () =>
      get<{ diff: ScaleDiff; consumersCount: number }>(
        `/api/config-grc/items/${item.id}/impact?from=${comparaison! - 1}&to=${comparaison}`,
      ),
    enabled: comparaison !== null && item.kind === 'scale',
  });
  if (!item.versions.length) return <Text size="sm">Aucune version publiée : l’élément est encore un brouillon.</Text>;
  return (
    <Stack>
      <div className="table-wrap" role="region" aria-label="Versions publiées" tabIndex={0}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Version</Table.Th>
              <Table.Th>Motif</Table.Th>
              <Table.Th>Auteur</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {item.versions.map((v) => (
              <Table.Tr key={v.version}>
                <Table.Td>{v.version}</Table.Td>
                <Table.Td>{v.reason}</Table.Td>
                <Table.Td>{v.createdBy}</Table.Td>
                <Table.Td className="nowrap">{fmtDate(v.createdAt)}</Table.Td>
                <Table.Td>
                  {item.kind === 'scale' && v.version > 1 && (
                    <Button size="compact-sm" variant="default" onClick={() => setComparaison(v.version)}>
                      Comparer avec la précédente
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
      {comparaison !== null && diff.data && (
        <Card withBorder>
          <Text fw={600}>
            Version {comparaison - 1} → version {comparaison}
          </Text>
          <DiffEchelle diff={diff.data.diff} />
          <Text size="sm">
            Consommateurs épinglés à la version {comparaison - 1} : {diff.data.consumersCount}.
          </Text>
        </Card>
      )}
      <ErrorAlert error={diff.error} />
    </Stack>
  );
}

function Dependances({ item }: { item: ElementDetail }) {
  const q = useQuery({
    queryKey: ['config-grc', 'usages', item.id],
    queryFn: () => get<Usage[]>(`/api/config-grc/items/${item.id}/usages`),
  });
  if (q.error) return <ErrorAlert error={q.error} />;
  if (!q.data) return null;
  if (!q.data.length)
    return <Text size="sm">Aucune méthode, aucun élément ni aucune analyse n’épingle cet élément.</Text>;
  return (
    <div className="table-wrap" role="region" aria-label="Dépendances" tabIndex={0}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Version épinglée</Table.Th>
            <Table.Th>Consommateur</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Depuis</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {q.data.map((u) => (
            <Table.Tr key={`${u.itemVersion}-${u.consumerKind}-${u.consumerId}-${u.consumerVersion}`}>
              <Table.Td>{u.itemVersion}</Table.Td>
              <Table.Td>
                {u.label ?? u.consumerId}
                {u.consumerVersion ? ` (version ${u.consumerVersion})` : ''}
              </Table.Td>
              <Table.Td>{USAGE_LABELS[u.consumerKind]}</Table.Td>
              <Table.Td className="nowrap">{fmtDate(u.createdAt)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}

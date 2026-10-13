/* Fiches des processus, objectifs et indicateurs du Pilotage : mêmes informations que l'outil de suivi historique, plus les
   points que l'ISO 9001:2015 demande de définir (4.4.1 a à h, 6.2.2, 9.1.1, 9.1.2). Tous ces champs sont facultatifs et vides
   par défaut : la norme n'impose ni valeur, ni fréquence, ni méthode. Les écritures passent par l'API du Pilotage. */
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { formatValeurIndicateur } from '@suivi/shared';
import { ConfirmButton, DataTable } from '@suivi/ui';
import { api } from '../api';
import { ErrorAlert } from '../components/common';

export type Ligne = Record<string, unknown>;
export const texte = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const liste = (v: unknown): string[] => (Array.isArray(v) ? v.map(texte) : []);
const lignes = (v: unknown): Ligne[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Ligne[]) : [];

/** Envoi d'une écriture, puis rechargement des vues qui lisent l'état de l'outil de suivi. */
export function useEcriture(smsi: string) {
  const qc = useQueryClient();
  const [erreur, setErreur] = useState<unknown>(null);
  const ecrire = async (methode: string, chemin: string, corps?: unknown) => {
    try {
      setErreur(null);
      const r = await api<Record<string, unknown>>(methode, `/api/grc/${smsi}/pilotage/objectifs/${chemin}`, {
        body: corps,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['grc', smsi, 'legacy-objectifs'] }),
        qc.invalidateQueries({ queryKey: ['synthese'] }),
        qc.invalidateQueries({ queryKey: ['grc', smsi, 'business-register'] }),
      ]);
      return r;
    } catch (e) {
      setErreur(e);
      return null;
    }
  };
  return { ecrire, erreur, setErreur };
}

/** Cible saisie : « 90 % » → 0,9 ; un nombre reste un nombre ; sens « = » ou texte libre : conservé tel quel. */
export function analyserCible(saisie: string, dir: string): string | number {
  const brut = saisie.trim().replace(/\s+/g, ' ');
  if (!brut || dir === '=') return brut;
  const n = parseFloat(brut.replace(',', '.').replace('%', ''));
  if (Number.isNaN(n)) return brut;
  return brut.includes('%') ? Math.round(n * 10) / 1000 : n;
}
export const saisieCible = (ind: Ligne) =>
  typeof ind.target === 'number' && ind.target > 0 && ind.target <= 1
    ? formatValeurIndicateur(ind, ind.target)
    : texte(ind.target);

/* ------------------------------------------------------------------------------------------ Processus */
export function FicheProcessus({
  smsi,
  processus,
  objectifs,
  indicateurs,
  modifiable,
  onClose,
}: {
  smsi: string;
  processus: Ligne;
  objectifs: Ligne[];
  indicateurs: Ligne[];
  modifiable: boolean;
  onClose: () => void;
}) {
  const id = texte(processus.id),
    { ecrire, erreur } = useEcriture(smsi),
    [v, setV] = useState({
      name: texte(processus.name),
      owner: texte(processus.owner),
      family: texte(processus.family),
      parent: texte(processus.parent),
      purpose: texte(processus.purpose),
      entity: texte(processus.entity),
      scope: texte(processus.scope),
      inputs: texte(processus.inputs),
      outputs: texte(processus.outputs),
      sequence: texte(processus.sequence),
      controlCriteria: texte(processus.controlCriteria),
      resources: texte(processus.resources),
      responsibilities: texte(processus.responsibilities),
      risksOpportunities: texte(processus.risksOpportunities),
      evaluation: texte(processus.evaluation),
      improvement: texte(processus.improvement),
    });
  const champ = (cle: keyof typeof v, label: string, aide?: string, long = true) =>
    long ? (
      <Textarea
        label={label}
        description={aide}
        autosize
        minRows={2}
        disabled={!modifiable}
        value={v[cle]}
        onChange={(e) => setV({ ...v, [cle]: e.currentTarget.value })}
      />
    ) : (
      <TextInput
        label={label}
        description={aide}
        disabled={!modifiable}
        value={v[cle]}
        onChange={(e) => setV({ ...v, [cle]: e.currentTarget.value })}
      />
    );
  const siens = objectifs.filter((o) => liste(o.processes).includes(id));
  const liesParObjectif = new Set(siens.map((o) => texte(o.id)));
  const indicateursLies = indicateurs.filter(
    (i) => liesParObjectif.has(texte(i.obj)) || liste(i.processes).includes(id),
  );
  const enregistrer = async () => {
    if ((await ecrire('PATCH', `processes/${encodeURIComponent(id)}`, v)) !== null) onClose();
  };
  return (
    <Modal opened onClose={onClose} size="xl" title={`Processus ${id}`}>
      <Stack>
        <ErrorAlert error={erreur} />
        <Group grow align="flex-start">
          {champ('name', 'Nom du processus', undefined, false)}
          {champ('owner', 'Pilote', undefined, false)}
        </Group>
        <Group grow align="flex-start">
          <Select
            label="Famille"
            clearable
            disabled={!modifiable}
            data={['Management', 'Réalisation', 'Support']}
            value={v.family || null}
            onChange={(f) => setV({ ...v, family: f ?? '' })}
          />
          {champ('parent', 'Processus parent', undefined, false)}
          {champ('entity', 'Entité', undefined, false)}
        </Group>
        {champ('purpose', 'Finalité du processus')}
        {champ('scope', 'Périmètre')}
        <Text fw={600}>Fiche processus (ISO 9001:2015, 4.4.1)</Text>
        <Text size="sm">
          Champs facultatifs, vides par défaut : la norme demande de les déterminer, sans imposer de contenu.
        </Text>
        {champ('inputs', 'Entrées requises (a)', 'Les entrées requises pour le processus.')}
        {champ('outputs', 'Sorties attendues (a)', 'Les sorties attendues du processus.')}
        {champ('sequence', 'Séquence et interaction avec les autres processus (b)')}
        {champ(
          'controlCriteria',
          'Critères et méthodes de maîtrise (c)',
          'Surveillance, mesures et indicateurs de performance.',
        )}
        {champ('resources', 'Ressources nécessaires et leur disponibilité (d)')}
        {champ('responsibilities', 'Responsabilités et autorités (e)')}
        {champ('risksOpportunities', 'Risques et opportunités (f)', 'Selon l’article 6.1.')}
        {champ('evaluation', 'Évaluation du processus et changements nécessaires (g)')}
        {champ('improvement', 'Amélioration du processus et du système de management (h)')}
        <Text fw={600}>Indicateurs associés (c)</Text>
        {indicateursLies.length ? (
          <Text size="sm">
            {indicateursLies.map((i) => `${texte(i.id)} ${texte(i.name)}`).join(' · ')} — rattachés par leurs objectifs
            ou directement.
          </Text>
        ) : (
          <Text size="sm">Aucun indicateur rattaché à ce processus.</Text>
        )}
        <Text fw={600}>Objectifs rattachés</Text>
        <Text size="sm">
          {siens.length ? siens.map((o) => `${texte(o.id)} ${texte(o.name)}`).join(' · ') : 'Aucun.'}
        </Text>
        <Group justify="space-between">
          {modifiable ? (
            <ConfirmButton
              size="xs"
              variant="default"
              message={`Supprimer le processus ${id} ? Il est retiré des objectifs et des indicateurs qui le citent.`}
              onConfirm={async () => {
                if ((await ecrire('DELETE', `processes/${encodeURIComponent(id)}?confirm=SUPPRIMER`)) !== null)
                  onClose();
              }}
            >
              Supprimer le processus
            </ConfirmButton>
          ) : (
            <span />
          )}
          <Group>
            <Button variant="default" onClick={onClose}>
              Fermer
            </Button>
            {modifiable && (
              <Button disabled={!v.name.trim()} onClick={enregistrer}>
                Enregistrer
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

/* ------------------------------------------------------------------------------------------ Objectif */
export function FicheObjectif({
  smsi,
  objectif,
  processus,
  indicateurs,
  modifiable,
  onClose,
  onOpenIndicateur,
}: {
  smsi: string;
  objectif: Ligne;
  processus: Ligne[];
  indicateurs: Ligne[];
  modifiable: boolean;
  onClose: () => void;
  onOpenIndicateur: (id: string) => void;
}) {
  const id = texte(objectif.id),
    { ecrire, erreur } = useEcriture(smsi),
    [nom, setNom] = useState(texte(objectif.name)),
    [echeance, setEcheance] = useState(texte(objectif.due).slice(0, 10)),
    [responsable, setResponsable] = useState(texte(objectif.owner)),
    [liens, setLiens] = useState<string[]>(liste(objectif.processes)),
    [enjeux, setEnjeux] = useState(liste(objectif.enjeux).join('\n')),
    [plan, setPlan] = useState(texte(objectif.plan)),
    [ressources, setRessources] = useState(texte(objectif.resources)),
    [evaluation, setEvaluation] = useState(texte(objectif.evaluation));
  const siens = indicateurs.filter((i) => i.obj === id);
  const enregistrer = async () => {
    const ok = await ecrire('PATCH', `objectives/${encodeURIComponent(id)}`, {
      name: nom,
      due: echeance,
      owner: responsable,
      processes: liens,
      enjeux: enjeux
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      plan,
      resources: ressources,
      evaluation,
    });
    if (ok !== null) onClose();
  };
  return (
    <Modal opened onClose={onClose} size="xl" title={`Objectif ${id}`}>
      <Stack>
        <ErrorAlert error={erreur} />
        <Textarea
          label="Objectif"
          autosize
          minRows={2}
          disabled={!modifiable}
          value={nom}
          onChange={(e) => setNom(e.currentTarget.value)}
        />
        <Group grow align="flex-start">
          <TextInput
            label="Échéance"
            type="date"
            disabled={!modifiable}
            value={echeance}
            onChange={(e) => setEcheance(e.currentTarget.value)}
          />
          <TextInput
            label="Responsable"
            disabled={!modifiable}
            value={responsable}
            onChange={(e) => setResponsable(e.currentTarget.value)}
          />
        </Group>
        <div>
          <Text fw={600}>Processus associés</Text>
          <Chip.Group multiple value={liens} onChange={setLiens}>
            <Group gap="xs">
              {processus.map((p) => (
                <Chip key={texte(p.id)} value={texte(p.id)} disabled={!modifiable}>
                  {texte(p.id)}
                </Chip>
              ))}
              {!processus.length && <Text size="sm">Aucun processus.</Text>}
            </Group>
          </Chip.Group>
        </div>
        <Textarea
          label="Enjeux associés (un par ligne)"
          autosize
          minRows={3}
          disabled={!modifiable}
          value={enjeux}
          onChange={(e) => setEnjeux(e.currentTarget.value)}
        />
        <Text fw={600}>Planification de l’atteinte (ISO 9001:2015, 6.2.2)</Text>
        <Textarea
          label="Ce qui sera fait"
          autosize
          minRows={2}
          disabled={!modifiable}
          value={plan}
          onChange={(e) => setPlan(e.currentTarget.value)}
        />
        <Textarea
          label="Ressources nécessaires"
          autosize
          minRows={2}
          disabled={!modifiable}
          value={ressources}
          onChange={(e) => setRessources(e.currentTarget.value)}
        />
        <Textarea
          label="Comment les résultats seront évalués"
          autosize
          minRows={2}
          disabled={!modifiable}
          value={evaluation}
          onChange={(e) => setEvaluation(e.currentTarget.value)}
        />
        <div>
          <Text fw={600}>Indicateurs</Text>
          <Group gap="xs">
            {siens.map((i) => (
              <Button key={texte(i.id)} size="xs" variant="default" onClick={() => onOpenIndicateur(texte(i.id))}>
                {texte(i.id)}
              </Button>
            ))}
            {!siens.length && <Text size="sm">Aucun.</Text>}
          </Group>
        </div>
        <Group justify="space-between">
          {modifiable ? (
            <ConfirmButton
              size="xs"
              variant="default"
              message={`Supprimer l’objectif ${id} et ses ${siens.length} indicateur(s) ?`}
              onConfirm={async () => {
                if ((await ecrire('DELETE', `objectives/${encodeURIComponent(id)}?confirm=SUPPRIMER`)) !== null)
                  onClose();
              }}
            >
              Supprimer l’objectif
            </ConfirmButton>
          ) : (
            <span />
          )}
          <Group>
            <Button variant="default" onClick={onClose}>
              Fermer
            </Button>
            {modifiable && (
              <Button disabled={!nom.trim()} onClick={enregistrer}>
                Enregistrer
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

/* ------------------------------------------------------------------------------------------ Indicateur */
export function FicheIndicateur({
  smsi,
  indicateur,
  objectifs,
  processus,
  modifiable,
  onClose,
  automatique,
}: {
  smsi: string;
  indicateur: Ligne;
  objectifs: Ligne[];
  processus: Ligne[];
  modifiable: boolean;
  onClose: () => void;
  /** Valeur et source du calcul automatique, si l'indicateur est calculé par l'outil. */
  automatique: string | null;
}) {
  const id = texte(indicateur.id),
    { ecrire, erreur } = useEcriture(smsi),
    [v, setV] = useState({
      name: texte(indicateur.name),
      obj: texte(indicateur.obj),
      dir: texte(indicateur.dir),
      cible: saisieCible(indicateur),
      owner: texte(indicateur.owner),
      freq: texte(indicateur.freq),
      auto: indicateur.auto !== false,
      action: texte(indicateur.action),
      actionOwner: texte(indicateur.actionOwner),
      actionDue: texte(indicateur.actionDue).slice(0, 10),
      lastReview: texte(indicateur.lastReview).slice(0, 10),
      monitored: texte(indicateur.monitored),
      method: texte(indicateur.method),
      monitorWhen: texte(indicateur.monitorWhen),
      analyzeWhen: texte(indicateur.analyzeWhen),
      category: texte(indicateur.category),
      source: texte(indicateur.source),
      processes: liste(indicateur.processes),
    }),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [valeur, setValeur] = useState(''),
    [note, setNote] = useState(''),
    [hist, setHist] = useState('');
  const mesures = lignes(indicateur.values)
    .map((m, rang) => ({ m, rang }))
    .sort((a, b) => texte(a.m.date).localeCompare(texte(b.m.date)));
  const calcule = !!indicateur.calc && v.auto;
  const maj = <K extends keyof typeof v>(cle: K, valeurChamp: (typeof v)[K]) => setV({ ...v, [cle]: valeurChamp });
  const enregistrer = async () => {
    const { cible, ...reste } = v;
    const ok = await ecrire('PATCH', `indicators/${encodeURIComponent(id)}`, {
      ...reste,
      dir: v.dir,
      target: analyserCible(cible, v.dir),
      ...(indicateur.calc ? {} : { auto: undefined }),
    });
    if (ok !== null) onClose();
  };
  const ajouter = async () => {
    const ok = await ecrire('POST', `indicators/${encodeURIComponent(id)}/values`, { date, value: valeur, note, hist });
    if (ok !== null) {
      setValeur('');
      setNote('');
      setHist('');
    }
  };
  return (
    <Modal opened onClose={onClose} size="xl" title={`Indicateur ${id}`}>
      <Stack>
        <ErrorAlert error={erreur} />
        <Textarea
          label="Indicateur"
          autosize
          minRows={2}
          disabled={!modifiable}
          value={v.name}
          onChange={(e) => maj('name', e.currentTarget.value)}
        />
        <Group grow align="flex-start">
          <Select
            label="Objectif"
            allowDeselect={false}
            disabled={!modifiable}
            data={objectifs.map((o) => ({ value: texte(o.id), label: `${texte(o.id)} ${texte(o.name)}` }))}
            value={v.obj}
            onChange={(o) => maj('obj', o ?? v.obj)}
          />
          <Select
            label="Sens"
            allowDeselect={false}
            disabled={!modifiable}
            data={[
              { value: '', label: 'À définir' },
              { value: '≤', label: '≤ (au plus)' },
              { value: '≥', label: '≥ (au moins)' },
              { value: '=', label: '= (égal)' },
            ]}
            value={v.dir}
            onChange={(d) => maj('dir', d ?? '')}
          />
          <TextInput
            label="Cible"
            disabled={!modifiable}
            value={v.cible}
            onChange={(e) => maj('cible', e.currentTarget.value)}
          />
        </Group>
        <Group grow align="flex-start">
          <TextInput
            label="Responsable"
            disabled={!modifiable}
            value={v.owner}
            onChange={(e) => maj('owner', e.currentTarget.value)}
          />
          <TextInput
            label="Fréquence de mesure"
            placeholder="à définir"
            disabled={!modifiable}
            value={v.freq}
            onChange={(e) => maj('freq', e.currentTarget.value)}
          />
        </Group>
        {!!indicateur.calc && (
          <Checkbox
            label={`Calcul automatique${automatique ? ` : ${automatique}` : ''}`}
            disabled={!modifiable}
            checked={v.auto}
            onChange={(e) => maj('auto', e.currentTarget.checked)}
          />
        )}
        <Text fw={600}>Surveillance et mesure (ISO 9001:2015, 9.1.1)</Text>
        <Textarea
          label="Ce qui est surveillé et mesuré"
          autosize
          minRows={2}
          disabled={!modifiable}
          value={v.monitored}
          onChange={(e) => maj('monitored', e.currentTarget.value)}
        />
        <Textarea
          label="Méthodes de surveillance et de mesure"
          autosize
          minRows={2}
          disabled={!modifiable}
          value={v.method}
          onChange={(e) => maj('method', e.currentTarget.value)}
        />
        <Group grow align="flex-start">
          <TextInput
            label="Quand surveiller"
            disabled={!modifiable}
            value={v.monitorWhen}
            onChange={(e) => maj('monitorWhen', e.currentTarget.value)}
          />
          <TextInput
            label="Quand analyser et évaluer"
            disabled={!modifiable}
            value={v.analyzeWhen}
            onChange={(e) => maj('analyzeWhen', e.currentTarget.value)}
          />
        </Group>
        <Group grow align="flex-start">
          <Select
            label="Catégorie"
            allowDeselect={false}
            disabled={!modifiable}
            data={[
              { value: '', label: 'Indicateur de performance' },
              { value: 'satisfaction', label: 'Satisfaction du client (9.1.2)' },
            ]}
            value={v.category}
            onChange={(c) => maj('category', c ?? '')}
          />
          <TextInput
            label="Source de l’information"
            description="Enquête, réclamations, retours… choisis par l’organisme."
            disabled={!modifiable}
            value={v.source}
            onChange={(e) => maj('source', e.currentTarget.value)}
          />
        </Group>
        <div>
          <Text fw={600}>Processus concernés (en plus de ceux de l’objectif)</Text>
          <Chip.Group multiple value={v.processes} onChange={(p) => maj('processes', p)}>
            <Group gap="xs">
              {processus.map((p) => (
                <Chip key={texte(p.id)} value={texte(p.id)} disabled={!modifiable}>
                  {texte(p.id)}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </div>
        <Text fw={600}>Valeurs mesurées</Text>
        {mesures.length ? (
          <DataTable label={`Mesures de l’indicateur ${id}`}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Valeur</Table.Th>
                  <Table.Th>Commentaire</Table.Th>
                  <Table.Th>Période historique</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {mesures.map(({ m, rang }) => (
                  <Table.Tr key={rang}>
                    <Table.Td>{texte(m.date)}</Table.Td>
                    <Table.Td>{formatValeurIndicateur(indicateur, m.v)}</Table.Td>
                    <Table.Td>{texte(m.note) || '–'}</Table.Td>
                    <Table.Td>{texte(m.hist) || '–'}</Table.Td>
                    <Table.Td>
                      {modifiable && (
                        <ConfirmButton
                          size="xs"
                          variant="default"
                          message="Supprimer cette mesure ?"
                          onConfirm={() => ecrire('DELETE', `indicators/${encodeURIComponent(id)}/values/${rang}`)}
                        >
                          {`Supprimer la mesure du ${texte(m.date)}`}
                        </ConfirmButton>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </DataTable>
        ) : (
          <Text size="sm">Aucune valeur saisie.</Text>
        )}
        {modifiable && !calcule && (
          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Date de la mesure"
              type="date"
              value={date}
              onChange={(e) => setDate(e.currentTarget.value)}
            />
            <TextInput
              label="Valeur"
              placeholder={v.dir === '=' ? 'Oui ou Non' : 'ex. 88 %'}
              value={valeur}
              onChange={(e) => setValeur(e.currentTarget.value)}
            />
            <TextInput label="Commentaire" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
            <TextInput
              label="Période historique"
              placeholder="ex. 2025-2026 (facultatif)"
              value={hist}
              onChange={(e) => setHist(e.currentTarget.value)}
            />
            <Button variant="default" disabled={!valeur.trim() || !date} onClick={ajouter}>
              Ajouter la mesure
            </Button>
          </Group>
        )}
        {calcule && <Alert>Indicateur calculé automatiquement : sa valeur ne se saisit pas manuellement.</Alert>}
        <Text fw={600}>Plan d’action si non atteint</Text>
        <Group grow align="flex-start">
          <TextInput
            label="Action"
            disabled={!modifiable}
            value={v.action}
            onChange={(e) => maj('action', e.currentTarget.value)}
          />
          <TextInput
            label="Responsable de l’action"
            disabled={!modifiable}
            value={v.actionOwner}
            onChange={(e) => maj('actionOwner', e.currentTarget.value)}
          />
        </Group>
        <Group grow align="flex-start">
          <TextInput
            label="Échéance de l’action"
            type="date"
            disabled={!modifiable}
            value={v.actionDue}
            onChange={(e) => maj('actionDue', e.currentTarget.value)}
          />
          <TextInput
            label="Dernière revue"
            type="date"
            disabled={!modifiable}
            value={v.lastReview}
            onChange={(e) => maj('lastReview', e.currentTarget.value)}
          />
        </Group>
        <Group justify="space-between">
          {modifiable ? (
            <ConfirmButton
              size="xs"
              variant="default"
              message={`Supprimer l’indicateur ${id} ?`}
              onConfirm={async () => {
                if ((await ecrire('DELETE', `indicators/${encodeURIComponent(id)}?confirm=SUPPRIMER`)) !== null)
                  onClose();
              }}
            >
              Supprimer l’indicateur
            </ConfirmButton>
          ) : (
            <span />
          )}
          <Group>
            <Button variant="default" onClick={onClose}>
              Fermer
            </Button>
            {modifiable && (
              <Button disabled={!v.name.trim()} onClick={enregistrer}>
                Enregistrer
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

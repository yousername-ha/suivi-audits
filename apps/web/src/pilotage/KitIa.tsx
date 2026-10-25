/* Kit d'intégration IA (ADR 0055) : chargement de fichiers JSON depuis l'interface, aperçu, import confirmé, puis lecture
   des annexes de veille. Rien n'est versionné dans le dépôt ni conservé dans le navigateur. Les correspondances sont
   importées « proposées » (validation humaine dans les correspondances de la bibliothèque) ; les sources et les deltas HDS
   2.1 sont toujours « à revérifier » et ne deviennent jamais des exigences en vigueur. */
import { Alert, Badge, Button, FileInput, Group, List, Modal, Stack, Table, Text, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { DataTable } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { assembler, libelleRubrique, type KitCharge } from './kit-ia-chargement';

interface Apercu {
  version: string;
  dejaImporte: boolean;
  controles: number;
  domaines: { domaine: string; n: number }[];
  portees: { externe: number; metier: number; les_deux: number };
  referentiel: {
    existant: boolean;
    versionCourante: number;
    identique: boolean;
    previewId: string;
    warning: string | null;
  };
  correspondances: {
    total: number;
    resolues: number;
    dejaPresentes: number;
    nouvelles: number;
    themesIso42001: number;
    nonResolues: { controle: string; type: string; indication: string; raison: string }[];
    nonResoluesTotal: number;
  };
  annexes: { actions: number; scenarios: number; deltas: number; memosHds: number; questions: number; sources: number };
  avertissements: string[];
}
interface Dernier {
  importe: boolean;
  version?: string;
  importePar?: string;
  importeLe?: string;
  annexes?: {
    deltas?: {
      delta_id: string;
      draft_ref: string;
      theme_fr: string;
      proposed_change_fr: string;
      ans_draft_url?: string | null;
    }[];
    sources?: { title: string; type_fr?: string | null; url: string; qualification_fr?: string | null }[];
    actions?: unknown[];
    scenarios?: unknown[];
    questionnaire?: unknown[];
  };
}

/** Carte « Kit d'intégration IA » de la page Bibliothèque. */
export function KitIa() {
  const can = useCan(),
    modifier = can('conformite', 'modifier'),
    [ouvert, setOuvert] = useState(false),
    [veille, setVeille] = useState(false);
  const dernier = useQuery({ queryKey: ['library', 'ia-kit'], queryFn: () => get<Dernier>('/api/library/ia-kit') });
  const d = dernier.data;
  return (
    <Stack gap="xs" data-testid="kit-ia">
      <Text fw={600}>Kit d’intégration IA</Text>
      <ErrorAlert error={dernier.error} />
      {d?.importe ? (
        <Text size="sm">
          Kit {d.version} importé par {d.importePar} le{' '}
          {d.importeLe ? new Date(d.importeLe).toLocaleDateString('fr-FR') : ''}. Ses contrôles forment le référentiel «
          Contrôles IA internes » ; les correspondances proposées se valident dans la page Correspondances.
        </Text>
      ) : (
        <Text size="sm">
          Aucun kit importé. Chargez les fichiers du kit : un aperçu s’affiche avant toute écriture, et rien n’est
          validé automatiquement.
        </Text>
      )}
      <Group>
        {modifier && (
          <Button onClick={() => setOuvert(true)}>
            {d?.importe ? 'Importer une nouvelle édition du kit' : 'Importer le kit IA'}
          </Button>
        )}
        {d?.importe && (
          <Button variant="default" onClick={() => setVeille(true)}>
            Veille et annexes du kit
          </Button>
        )}
      </Group>
      {ouvert && <ImportKit onClose={() => setOuvert(false)} />}
      {veille && d?.importe && <Veille dernier={d} onClose={() => setVeille(false)} />}
    </Stack>
  );
}

function ImportKit({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient(),
    [charge, setCharge] = useState<KitCharge | null>(null),
    [apercu, setApercu] = useState<Apercu | null>(null),
    [motif, setMotif] = useState(''),
    [confirme, setConfirme] = useState(''),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false),
    [resultat, setResultat] = useState<string | null>(null);
  const lire = async (fichiers: File[]) => {
    setErreur(null);
    setApercu(null);
    setResultat(null);
    if (!fichiers.length) return setCharge(null);
    try {
      if (fichiers.some((f) => f.size > 4 * 1024 * 1024)) throw new Error('Chaque fichier est limité à 4 Mo.');
      const c = assembler(await Promise.all(fichiers.map(async (f) => ({ nom: f.name, texte: await f.text() }))));
      setCharge(c);
      if (!c.problemes.length)
        setApercu(await api<Apercu>('POST', '/api/library/ia-kit/preview', { body: { kit: c.kit } }));
    } catch (e) {
      setErreur(e);
    }
  };
  const importer = async () => {
    if (!charge || !apercu) return;
    setEnvoi(true);
    try {
      setErreur(null);
      const r = await api<{ statut: string; mappings: number }>('POST', '/api/library/ia-kit/import', {
        body: { kit: charge.kit, previewId: apercu.referentiel.previewId, reason: motif, confirm: 'IMPORTER' },
      });
      setResultat(
        r.statut === 'deja_importe'
          ? 'Ce kit était déjà importé : rien n’a été modifié.'
          : `Kit importé. ${r.mappings} correspondance(s) proposée(s), à valider une par une.`,
      );
      await qc.invalidateQueries({ queryKey: ['library'] });
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Modal opened onClose={onClose} size="xl" title="Importer le kit d’intégration IA">
      <Stack>
        <ErrorAlert error={erreur} />
        <Text size="sm">
          Choisissez les fichiers JSON du kit (le kit complet, ou ses listes : contrôles, correspondances, actions,
          scénarios, deltas HDS, mémos, questionnaire, sources). Ils sont reconnus d’après leur contenu.
        </Text>
        <FileInput label="Fichiers du kit" accept=".json" multiple clearable onChange={lire} />
        {charge && (
          <>
            <List size="sm" aria-label="Rubriques reconnues">
              {charge.trouvees.map((t) => (
                <List.Item key={t.rubrique}>
                  {t.n} {libelleRubrique(t.rubrique)} ({t.fichier})
                </List.Item>
              ))}
            </List>
            {charge.problemes.map((p) => (
              <Alert key={p} color="red">
                {p}
              </Alert>
            ))}
          </>
        )}
        {apercu && (
          <Stack gap="xs" data-testid="apercu-kit">
            <Text>
              {apercu.controles} contrôle(s) en {apercu.domaines.length} domaine(s) · {apercu.portees.externe} pour l’IA
              externe, {apercu.portees.metier} pour l’IA des applications métier, {apercu.portees.les_deux} pour les
              deux
              {apercu.referentiel.existant
                ? ` · référentiel existant en version ${apercu.referentiel.versionCourante}`
                : ''}
              .
            </Text>
            <Text size="sm">
              Correspondances : {apercu.correspondances.resolues} rattachée(s) à une exigence de la bibliothèque (
              {apercu.correspondances.nouvelles} nouvelle(s), {apercu.correspondances.dejaPresentes} déjà présente(s)),{' '}
              {apercu.correspondances.themesIso42001} indication(s) de thème ISO/IEC 42001 conservée(s) sans
              rattachement, {apercu.correspondances.nonResoluesTotal} non reconnue(s).
            </Text>
            {apercu.correspondances.nonResolues.length > 0 && (
              <DataTable label="Indications non rattachées">
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Contrôle</Table.Th>
                      <Table.Th>Indication du kit</Table.Th>
                      <Table.Th>Raison</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {apercu.correspondances.nonResolues.map((n, i) => (
                      <Table.Tr key={`${n.controle}-${i}`}>
                        <Table.Td>{n.controle}</Table.Td>
                        <Table.Td>{n.indication}</Table.Td>
                        <Table.Td>{n.raison}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </DataTable>
            )}
            {apercu.referentiel.warning && <Alert color="orange">{apercu.referentiel.warning}</Alert>}
            {apercu.avertissements.map((a) => (
              <Alert key={a} color="blue">
                {a}
              </Alert>
            ))}
            {apercu.dejaImporte ? (
              <Alert color="green">Ce kit est déjà importé à l’identique : il n’y a rien à écrire.</Alert>
            ) : (
              <>
                <TextInput
                  label="Motif de l’import"
                  description="10 caractères au moins ; conservé dans le journal."
                  value={motif}
                  onChange={(e) => setMotif(e.currentTarget.value)}
                />
                <TextInput
                  label="Confirmation"
                  description="Saisissez IMPORTER pour confirmer."
                  value={confirme}
                  onChange={(e) => setConfirme(e.currentTarget.value)}
                />
              </>
            )}
          </Stack>
        )}
        {resultat && <Alert color="green">{resultat}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Fermer
          </Button>
          <Button
            loading={envoi}
            disabled={
              !apercu || apercu.dejaImporte || motif.trim().length < 10 || confirme !== 'IMPORTER' || !!resultat
            }
            onClick={importer}
          >
            Importer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function Veille({ dernier, onClose }: { dernier: Dernier; onClose: () => void }) {
  const a = dernier.annexes ?? {};
  return (
    <Modal opened onClose={onClose} size="xl" title="Veille et annexes du kit IA">
      <Stack>
        <Alert color="orange" title="À revérifier">
          Les sources et les statuts juridiques ci-dessous viennent du kit : aucune date de vérification n’est
          enregistrée. Vérifiez-les auprès de l’autorité avant de vous y appuyer. Les deltas HDS 2.1 sont des projets
          préparatoires, jamais des exigences en vigueur.
        </Alert>
        <Text size="sm">
          {a.actions?.length ?? 0} action(s) suggérée(s), {a.scenarios?.length ?? 0} scénario(s) de risque,{' '}
          {a.questionnaire?.length ?? 0} question(s) de qualification, conservés avec le kit.
        </Text>
        <Text fw={600}>Deltas HDS 2.1 préparatoires</Text>
        <DataTable label="Deltas HDS 2.1">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Projet</Table.Th>
                <Table.Th>Thème</Table.Th>
                <Table.Th>Évolution envisagée</Table.Th>
                <Table.Th>Statut</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(a.deltas ?? []).map((x) => (
                <Table.Tr key={x.delta_id}>
                  <Table.Td>{x.draft_ref}</Table.Td>
                  <Table.Td>{x.theme_fr}</Table.Td>
                  <Table.Td>{x.proposed_change_fr}</Table.Td>
                  <Table.Td>
                    <Badge color="orange" variant="light">
                      Préparatoire — à revérifier
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
              {!(a.deltas ?? []).length && (
                <Table.Tr>
                  <Table.Td colSpan={4}>Aucun delta dans ce kit.</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </DataTable>
        <Text fw={600}>Sources citées</Text>
        <List size="sm">
          {(a.sources ?? []).map((s) => (
            <List.Item key={s.url}>
              {s.title} —{' '}
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.url}
              </a>{' '}
              <Badge color="orange" variant="light">
                à revérifier
              </Badge>
            </List.Item>
          ))}
          {!(a.sources ?? []).length && <List.Item>Aucune source dans ce kit.</List.Item>}
        </List>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Fermer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/* Bibliothèque de référentiels de l'organisation (ADR 0031, lot M2) : importer un référentiel une fois, le rattacher à
   plusieurs périmètres et promouvoir un référentiel déjà publié dans un périmètre. Aucun texte normatif n'est fourni :
   l'organisation importe les exigences dont elle détient les droits. Les droits sont ceux de l'API. */
import { Alert, Button, Group, Modal, Select, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FrameworkDefinition } from '@suivi/shared';
import { ConfirmButton, DataTable, StatusChip } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';

interface Referentiel {
  id: string;
  identifier: string;
  name: string;
  version: number;
  requirements: number;
  scopes: number;
  source: { status: string; organisation: string };
}
interface Rattachement {
  frameworkId: string;
  identifier: string;
  name: string;
  version: number;
  latestVersion: number;
  enabled: boolean;
}
/** Exemple fictif d'import : ne reproduit aucun référentiel officiel. */
const EXEMPLE_FICTIF: FrameworkDefinition = {
  name: 'Référentiel fictif de recette',
  identifier: 'EXEMPLE-FICTIF',
  source: {
    organisation: 'Organisation fictive',
    document: 'Exemple fictif',
    url: 'https://example.invalid/exemple',
    version: '1',
    date: '2026-10-13',
    license: 'Exemple fictif libre ; ne reproduit aucun référentiel officiel.',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'gouvernance', label: 'Gouvernance' }],
  requirements: [
    {
      id: 'EX-01',
      domain: 'gouvernance',
      title: 'Revue périodique',
      description: 'Exemple fictif.',
      applicability: 'Périmètre de l’organisation fictive',
      measureRefs: [],
    },
  ],
};
const STATUTS: Record<string, string> = {
  official_verified: 'Source officielle vérifiée',
  licensed_import: 'Importé sous licence',
  organisation: 'Choix de l’organisation',
  unverified: 'Source non vérifiée',
};
const versions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ value: String(n - i), label: `Version ${n - i}` }));

/** Page « Bibliothèque de référentiels » : liste, consultation des exigences, import et nouvelles versions. */
export function Bibliotheque() {
  const can = useCan(),
    qc = useQueryClient(),
    modifier = can('conformite', 'modifier'),
    [import_, setImport] = useState<{ cible: Referentiel | null } | null>(null),
    [depuisSuivi, setDepuisSuivi] = useState(false),
    [consulte, setConsulte] = useState<{ cible: Referentiel; version: string } | null>(null);
  const liste = useQuery({
    queryKey: ['library', 'frameworks'],
    queryFn: () => get<Referentiel[]>('/api/library/frameworks'),
  });
  const exigences = useQuery({
    queryKey: ['library', 'frameworks', consulte?.cible.id, consulte?.version],
    queryFn: () =>
      get<{ definition: FrameworkDefinition }>(
        `/api/library/frameworks/${consulte!.cible.id}/versions/${consulte!.version}`,
      ),
    enabled: !!consulte,
  });
  return (
    <Stack>
      <Alert>
        La bibliothèque contient les référentiels de l’organisation, importés une seule fois puis rattachés aux
        périmètres qui les utilisent (page Périmètres). Aucun texte normatif n’est fourni : importez les exigences dont
        vous détenez les droits. Chaque version publiée est immuable.
      </Alert>
      <ErrorAlert error={liste.error ?? exigences.error} />
      <Group justify="space-between">
        <Text>{liste.data ? `${liste.data.length} référentiel(s) dans la bibliothèque` : 'Chargement…'}</Text>
        {modifier && (
          <Group>
            <Button variant="default" onClick={() => setDepuisSuivi(true)}>
              Importer depuis l’outil de suivi
            </Button>
            <Button onClick={() => setImport({ cible: null })}>Importer un référentiel</Button>
          </Group>
        )}
      </Group>
      <DataTable label="Référentiels de la bibliothèque, défilement horizontal possible">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Référentiel</Table.Th>
              <Table.Th>Version</Table.Th>
              <Table.Th>Exigences</Table.Th>
              <Table.Th>Périmètres</Table.Th>
              <Table.Th>Source</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(liste.data ?? []).map((f) => (
              <Table.Tr key={f.id}>
                <Table.Td>
                  <Text fw={600}>{f.name}</Text>
                  <Text size="xs" c="dimmed">
                    {f.identifier}
                  </Text>
                </Table.Td>
                <Table.Td>{f.version}</Table.Td>
                <Table.Td>{f.requirements}</Table.Td>
                <Table.Td>{f.scopes}</Table.Td>
                <Table.Td>
                  <StatusChip etat={f.source.status === 'unverified' ? 'attention' : 'neutre'}>
                    {STATUTS[f.source.status] ?? f.source.status}
                  </StatusChip>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="default"
                      aria-label={`Consulter les exigences de ${f.name}`}
                      onClick={() => setConsulte({ cible: f, version: String(f.version) })}
                    >
                      Exigences
                    </Button>
                    {modifier && (
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`Publier une nouvelle version de ${f.name}`}
                        onClick={() => setImport({ cible: f })}
                      >
                        Nouvelle version
                      </Button>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataTable>
      <Modal
        opened={!!consulte}
        onClose={() => setConsulte(null)}
        size="lg"
        title={consulte ? `Exigences de ${consulte.cible.name}` : ''}
      >
        {consulte && (
          <Stack>
            <Select
              label="Version"
              allowDeselect={false}
              data={versions(consulte.cible.version)}
              value={consulte.version}
              onChange={(v) => v && setConsulte({ ...consulte, version: v })}
            />
            {(exigences.data?.definition.requirements ?? []).map((r) => (
              <Text key={r.id}>
                <b>{r.id}</b> · {r.title}
              </Text>
            ))}
          </Stack>
        )}
      </Modal>
      {depuisSuivi && (
        <ImportOutilSuivi
          onClose={() => setDepuisSuivi(false)}
          onDone={() => qc.invalidateQueries({ queryKey: ['library'] })}
        />
      )}
      {import_ && (
        <Import
          cible={import_.cible}
          onClose={() => setImport(null)}
          onDone={async () => {
            setImport(null);
            await qc.invalidateQueries({ queryKey: ['library'] });
          }}
        />
      )}
    </Stack>
  );
}

function Import({
  cible,
  onClose,
  onDone,
}: {
  cible: Referentiel | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [texte, setTexte] = useState(''),
    [motif, setMotif] = useState(''),
    [simulation, setSimulation] = useState<{
      previewId: string;
      version: number;
      requirements: number;
      domains: number;
      duplicate: boolean;
      canPublish: boolean;
      warning: string | null;
    } | null>(null),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false);
  const definition = () => JSON.parse(texte) as unknown;
  const simuler = async () => {
    try {
      setErreur(null);
      setSimulation(null);
      setSimulation(
        await api('POST', '/api/library/frameworks/preview', {
          body: { id: cible?.id ?? null, definition: definition() },
        }),
      );
    } catch (e) {
      setErreur(e instanceof SyntaxError ? new Error('Le texte saisi n’est pas un JSON valide.') : e);
    }
  };
  const publier = async () => {
    if (!simulation) return;
    setEnvoi(true);
    try {
      setErreur(null);
      await api('POST', '/api/library/frameworks/publish', {
        body: {
          id: cible?.id ?? null,
          definition: definition(),
          previewId: simulation.previewId,
          reason: motif,
          confirm: 'PUBLIER',
        },
        ifMatch: simulation.version,
      });
      await onDone();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Modal
      opened
      onClose={onClose}
      size="lg"
      title={cible ? `Nouvelle version de ${cible.name}` : 'Importer un référentiel dans la bibliothèque'}
    >
      <Stack>
        <ErrorAlert error={erreur} />
        <Text size="sm">
          Collez la définition du référentiel (JSON : nom, identifiant, source avec licence, domaines et exigences). Les
          exigences ne portent aucun lien vers une mesure : ces liens sont propres à chaque périmètre.
        </Text>
        <Textarea
          label="Définition du référentiel (JSON)"
          autosize
          minRows={8}
          maxRows={16}
          value={texte}
          onChange={(e) => {
            setTexte(e.currentTarget.value);
            setSimulation(null);
          }}
        />
        <Group>
          <Button variant="default" onClick={() => setTexte(JSON.stringify(EXEMPLE_FICTIF, null, 2))}>
            Insérer un exemple fictif
          </Button>
          <Button onClick={simuler} disabled={!texte.trim()}>
            Simuler la publication
          </Button>
        </Group>
        {simulation && (
          <>
            <Text>
              {simulation.requirements} exigence(s) dans {simulation.domains} domaine(s) · version{' '}
              {simulation.version + 1}
            </Text>
            {simulation.warning && <Alert color="orange">{simulation.warning}</Alert>}
            {simulation.duplicate && (
              <Alert color="red">
                Un référentiel de la bibliothèque porte déjà cet identifiant : publiez-y une nouvelle version.
              </Alert>
            )}
            <TextInput
              label="Motif de la publication"
              description="10 caractères au moins ; conservé avec la version."
              value={motif}
              onChange={(e) => setMotif(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={onClose}>
                Annuler
              </Button>
              <Button loading={envoi} disabled={!simulation.canPublish || motif.trim().length < 10} onClick={publier}>
                Publier
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}

/** Référentiels de la bibliothèque rattachés à un périmètre : version rattachée, mise à jour, activation, détachement. */
export function ReferentielsDuPerimetre({ smsi }: { smsi: string }) {
  const can = useCan(),
    qc = useQueryClient(),
    admin = can('pilotage', 'administrer'),
    [choix, setChoix] = useState<string | null>(null),
    [version, setVersion] = useState<string | null>(null),
    [erreur, setErreur] = useState<unknown>(null);
  const rattaches = useQuery({
    queryKey: ['grc', smsi, 'attachments'],
    queryFn: () => get<Rattachement[]>(`/api/grc/${smsi}/framework-attachments`),
  });
  const biblio = useQuery({
    queryKey: ['library', 'frameworks'],
    queryFn: () => get<Referentiel[]>('/api/library/frameworks'),
  });
  const libres = (biblio.data ?? []).filter((f) => !(rattaches.data ?? []).some((r) => r.frameworkId === f.id));
  const selection = libres.find((f) => f.id === choix);
  const agir = async (action: () => Promise<unknown>) => {
    try {
      setErreur(null);
      await action();
      await qc.invalidateQueries({ queryKey: ['grc', smsi, 'attachments'] });
      await qc.invalidateQueries({ queryKey: ['library'] });
    } catch (e) {
      setErreur(e);
    }
  };
  const rattacher = (id: string, v: number) =>
    agir(() =>
      api('PUT', `/api/grc/${smsi}/framework-attachments/${id}`, { body: { version: v, confirm: 'RATTACHER' } }),
    );
  return (
    <Stack>
      <ErrorAlert error={erreur ?? rattaches.error ?? biblio.error} />
      {(rattaches.data ?? []).length === 0 && (
        <Text>Aucun référentiel de la bibliothèque n’est rattaché à ce périmètre.</Text>
      )}
      {(rattaches.data ?? []).map((r) => (
        <Group key={r.frameworkId} justify="space-between" wrap="nowrap">
          <div>
            <Text fw={600}>{r.name}</Text>
            <Text size="sm">
              Version {r.version}
              {r.latestVersion > r.version && ` (la version ${r.latestVersion} est disponible)`} ·{' '}
              {r.enabled ? 'Actif' : 'Inactif'}
            </Text>
          </div>
          {admin && (
            <Group gap="xs">
              {r.latestVersion > r.version && (
                <Button size="xs" variant="default" onClick={() => rattacher(r.frameworkId, r.latestVersion)}>
                  Passer à la version {r.latestVersion}
                </Button>
              )}
              <Button
                size="xs"
                variant="default"
                onClick={() =>
                  agir(() =>
                    api('PUT', `/api/grc/${smsi}/framework-attachments/${r.frameworkId}/activation`, {
                      body: { enabled: !r.enabled },
                    }),
                  )
                }
              >
                {r.enabled ? 'Désactiver' : 'Activer'}
              </Button>
              <ConfirmButton
                size="xs"
                variant="default"
                message={`Détacher « ${r.name} » de ce périmètre ? Le référentiel reste dans la bibliothèque.`}
                onConfirm={() => agir(() => api('DELETE', `/api/grc/${smsi}/framework-attachments/${r.frameworkId}`))}
              >
                Détacher
              </ConfirmButton>
            </Group>
          )}
        </Group>
      ))}
      {admin && libres.length > 0 && (
        <Group align="flex-end">
          <Select
            label="Rattacher un référentiel de la bibliothèque"
            placeholder="Choisir un référentiel"
            data={libres.map((f) => ({ value: f.id, label: f.name }))}
            value={choix}
            onChange={(v) => {
              setChoix(v);
              setVersion(v ? String(libres.find((f) => f.id === v)!.version) : null);
            }}
          />
          {selection && (
            <Select
              label="Version"
              allowDeselect={false}
              data={versions(selection.version)}
              value={version}
              onChange={setVersion}
            />
          )}
          <Button
            disabled={!selection || !version}
            onClick={async () => {
              await rattacher(selection!.id, Number(version));
              setChoix(null);
              setVersion(null);
            }}
          >
            Rattacher
          </Button>
        </Group>
      )}
    </Stack>
  );
}

/** Bouton de promotion d'un référentiel publié dans un périmètre : simulation, puis confirmation explicite. */
export function PromotionBouton({ smsi, id }: { smsi: string; id: string }) {
  const qc = useQueryClient(),
    [ouvert, setOuvert] = useState(false),
    [simulation, setSimulation] = useState<{
      previewId: string;
      sourceVersion: number;
      requirements: number;
      droppedMeasureRefs: number;
      alreadyPromoted: boolean;
      libraryFrameworkId: string | null;
      identicalToLibrary: boolean;
      canPromote: boolean;
    } | null>(null),
    [fait, setFait] = useState(false),
    [erreur, setErreur] = useState<unknown>(null);
  const ouvrir = async () => {
    setOuvert(true);
    setFait(false);
    setSimulation(null);
    try {
      setErreur(null);
      setSimulation(await api('POST', `/api/grc/${smsi}/frameworks/${id}/promotion/preview`));
    } catch (e) {
      setErreur(e);
    }
  };
  const promouvoir = async () => {
    try {
      setErreur(null);
      await api('POST', `/api/grc/${smsi}/frameworks/${id}/promotion`, {
        body: { previewId: simulation!.previewId, confirm: 'PROMOUVOIR' },
      });
      setFait(true);
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['grc', smsi] });
    } catch (e) {
      setErreur(e);
    }
  };
  return (
    <>
      <Button variant="default" onClick={ouvrir}>
        Promouvoir dans la bibliothèque
      </Button>
      <Modal opened={ouvert} onClose={() => setOuvert(false)} title="Promouvoir dans la bibliothèque">
        <Stack>
          <ErrorAlert error={erreur} />
          {simulation && !fait && (
            <>
              <Text>
                La version {simulation.sourceVersion} ({simulation.requirements} exigence(s)) est copiée dans la
                bibliothèque de l’organisation et rattachée à ce périmètre. L’original est conservé.
              </Text>
              {simulation.droppedMeasureRefs > 0 && (
                <Alert color="orange">
                  {simulation.droppedMeasureRefs} lien(s) entre une exigence et une mesure ne sont pas copiés : ils
                  restent propres à ce périmètre.
                </Alert>
              )}
              {simulation.alreadyPromoted && <Alert>Cette version est déjà dans la bibliothèque.</Alert>}
              {simulation.libraryFrameworkId && !simulation.alreadyPromoted && (
                <Alert color="orange">
                  Un référentiel de la bibliothèque porte déjà cet identifiant
                  {simulation.identicalToLibrary ? ' avec la même définition' : ''} : rattachez-le au périmètre depuis
                  la page Périmètres.
                </Alert>
              )}
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setOuvert(false)}>
                  Annuler
                </Button>
                <Button disabled={!simulation.canPromote} onClick={promouvoir}>
                  Promouvoir
                </Button>
              </Group>
            </>
          )}
          {fait && (
            <Alert color="green">
              Référentiel promu : il est désormais dans la bibliothèque et rattaché à ce périmètre.
            </Alert>
          )}
        </Stack>
      </Modal>
    </>
  );
}

interface CandidatSuivi {
  definition: { name: string; identifier: string; source: { status: string; organisation: string; version: string } };
  previewId: string;
  requirements: number;
  domains: number;
  duplicate: boolean;
  canPublish: boolean;
  warning: string | null;
  notes: string[];
}

/** Référentiels déjà saisis dans l'outil de suivi (clauses ISO 27001, Annexe A, HDS, ReCyF…) : simulation, puis
    importation explicite, un référentiel à la fois. Seuls les champs présents dans l'outil de suivi sont repris. */
function ImportOutilSuivi({ onClose, onDone }: { onClose: () => void; onDone: () => unknown }) {
  const qc = useQueryClient(),
    [erreur, setErreur] = useState<unknown>(null),
    [fait, setFait] = useState<string[]>([]);
  const q = useQuery({
    queryKey: ['library', 'tracker-import'],
    queryFn: () => get<CandidatSuivi[]>('/api/library/tracker-import'),
  });
  const importer = async (c: CandidatSuivi) => {
    try {
      setErreur(null);
      await api('POST', '/api/library/tracker-import', {
        body: { identifier: c.definition.identifier, previewId: c.previewId, confirm: 'IMPORTER' },
      });
      setFait((f) => [...f, c.definition.identifier]);
      await qc.invalidateQueries({ queryKey: ['library', 'tracker-import'] });
      await onDone();
    } catch (e) {
      setErreur(e);
    }
  };
  return (
    <Modal opened onClose={onClose} size="lg" title="Importer depuis l’outil de suivi">
      <Stack>
        <Text size="sm">
          Simulation : rien n’est écrit tant que vous n’avez pas confirmé un référentiel. Les référentiels importés
          portent le statut « non vérifié » et ne sont jamais présentés comme normatifs ; seuls les intitulés ou textes
          saisis dans l’outil de suivi sont repris.
        </Text>
        <ErrorAlert error={erreur ?? q.error} />
        {q.data && !q.data.length && <Text>Aucun référentiel à importer dans l’outil de suivi.</Text>}
        {(q.data ?? []).map((c) => (
          <Stack key={c.definition.identifier} gap="xs">
            <Group justify="space-between">
              <Text fw={600}>{c.definition.name}</Text>
              {c.duplicate ? (
                <StatusChip etat="succes">
                  {fait.includes(c.definition.identifier) ? 'Importé' : 'Déjà dans la bibliothèque'}
                </StatusChip>
              ) : (
                <ConfirmButton
                  size="xs"
                  color="orange"
                  disabled={!c.canPublish}
                  message={`Importer « ${c.definition.name} » (${c.requirements} exigences) dans la bibliothèque, en version 1 ? Cette version sera immuable.`}
                  onConfirm={() => importer(c)}
                >
                  {`Importer ${c.definition.name}`}
                </ConfirmButton>
              )}
            </Group>
            <Text size="sm">
              {c.requirements} exigence(s) · {c.domains} domaine(s) · source : {c.definition.source.organisation},
              version {c.definition.source.version}
            </Text>
            {c.warning && <Alert color="orange">{c.warning}</Alert>}
            {c.notes.map((n) => (
              <Text key={n} size="sm">
                {n}
              </Text>
            ))}
          </Stack>
        ))}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Fermer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

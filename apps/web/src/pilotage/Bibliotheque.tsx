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
  /** Version source : verrouillée, seule une copie se personnalise. */
  locked: boolean;
  derivedFrom: { identifier: string; name: string; version: number } | null;
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
  unverified: 'Repris de l’outil de suivi',
};
const versions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ value: String(n - i), label: `Version ${n - i}` }));

/** Page « Bibliothèque de référentiels » : liste, consultation des exigences, import et nouvelles versions. */
export function Bibliotheque() {
  const can = useCan(),
    qc = useQueryClient(),
    modifier = can('conformite', 'modifier'),
    [import_, setImport] = useState<{ cible: Referentiel | null } | null>(null),
    [copie, setCopie] = useState<Referentiel | null>(null),
    [ajout, setAjout] = useState<Referentiel | null>(null),
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
        {modifier && <Button onClick={() => setImport({ cible: null })}>Importer un référentiel</Button>}
      </Group>
      {modifier && <StandardsDisponibles onDone={() => qc.invalidateQueries({ queryKey: ['library'] })} />}
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
                  <Group gap="xs">
                    <StatusChip etat={f.locked ? 'neutre' : 'succes'}>
                      {f.locked ? 'Version source verrouillée' : 'Copie de l’organisation'}
                    </StatusChip>
                    <Text size="xs" c="dimmed">
                      {f.derivedFrom ? `Copie de ${f.derivedFrom.name}` : (STATUTS[f.source.status] ?? f.source.status)}
                    </Text>
                  </Group>
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
                        aria-label={`Créer une copie personnalisable de ${f.name}`}
                        onClick={() => setCopie(f)}
                      >
                        Créer une copie
                      </Button>
                    )}
                    {modifier && !f.locked && (
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`Ajouter une exigence à ${f.name}`}
                        onClick={() => setAjout(f)}
                      >
                        Ajouter une exigence
                      </Button>
                    )}
                    {modifier && (
                      <Button
                        size="xs"
                        variant="subtle"
                        aria-label={`Importer une nouvelle édition de ${f.name}`}
                        onClick={() => setImport({ cible: f })}
                      >
                        Nouvelle édition
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
      {copie && (
        <CopieReferentiel
          cible={copie}
          onClose={() => setCopie(null)}
          onDone={async () => {
            setCopie(null);
            await qc.invalidateQueries({ queryKey: ['library'] });
          }}
        />
      )}
      {ajout && (
        <AjoutExigence
          cible={ajout}
          onClose={() => setAjout(null)}
          onDone={async () => {
            setAjout(null);
            await qc.invalidateQueries({ queryKey: ['library'] });
          }}
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
  const standards = useStandards(can('conformite', 'modifier'));
  const libres = (biblio.data ?? []).filter((f) => !(rattaches.data ?? []).some((r) => r.frameworkId === f.id));
  const selection = libres.find((f) => f.id === choix);
  // Standards pas encore dans la bibliothèque : proposés à la sélection, ajoutés en version source verrouillée au rattachement.
  const standardsOfferts = (standards.data ?? []).filter((c) => !c.duplicate && !c.error);
  const standardChoisi = standardsOfferts.find((c) => 'standard:' + c.definition.identifier === choix);
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
      {admin && (libres.length > 0 || standardsOfferts.length > 0) && (
        <Group align="flex-end">
          <Select
            label="Rattacher un référentiel de la bibliothèque"
            placeholder="Choisir un référentiel"
            data={[
              ...libres.map((f) => ({ value: f.id, label: f.name })),
              ...standardsOfferts.map((c) => ({
                value: 'standard:' + c.definition.identifier,
                label: `${c.definition.name} (standard)`,
              })),
            ]}
            value={choix}
            onChange={(v) => {
              setChoix(v);
              setVersion(v && libres.some((f) => f.id === v) ? String(libres.find((f) => f.id === v)!.version) : null);
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
            disabled={!(selection && version) && !standardChoisi}
            onClick={async () => {
              if (standardChoisi) {
                // Standard de l'outil de suivi : ajouté à la bibliothèque (version source verrouillée), puis rattaché.
                try {
                  setErreur(null);
                  const ajoute = await adopterStandard(standardChoisi.definition.identifier);
                  await rattacher(ajoute.id, ajoute.version);
                } catch (e) {
                  setErreur(e);
                  return;
                }
              } else await rattacher(selection!.id, Number(version));
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

export interface CandidatSuivi {
  definition: { name: string; identifier: string; source: { status: string; organisation: string; version: string } };
  previewId: string;
  requirements: number;
  domains: number;
  duplicate: boolean;
  canPublish: boolean;
  warning: string | null;
  notes: string[];
  error: string | null;
}

/** Standards disponibles : lus dans l'outil de suivi (aucun texte normatif n'est fourni par l'application). Un geste les
    ajoute à la bibliothèque en version source verrouillée ; un standard dont les données sont incomplètes est indiqué
    sans alerte et sans bloquer les autres. */
export function useStandards(actif: boolean) {
  return useQuery({
    queryKey: ['library', 'tracker-import'],
    queryFn: () => get<CandidatSuivi[]>('/api/library/tracker-import'),
    enabled: actif,
    retry: false,
  });
}
export async function adopterStandard(identifier: string) {
  return api<{ id: string; version: number }>('POST', '/api/library/standards/adopt', { body: { identifier } });
}
function StandardsDisponibles({ onDone }: { onDone: () => unknown }) {
  const qc = useQueryClient(),
    [erreur, setErreur] = useState<unknown>(null),
    q = useStandards(true);
  const proposes = (q.data ?? []).filter((c) => !c.duplicate);
  if (!proposes.length) return null;
  const adopter = async (c: CandidatSuivi) => {
    try {
      setErreur(null);
      await adopterStandard(c.definition.identifier);
      await qc.invalidateQueries({ queryKey: ['library', 'tracker-import'] });
      await onDone();
    } catch (e) {
      setErreur(e);
    }
  };
  return (
    <Stack gap="xs" aria-label="Standards disponibles">
      <Text fw={600}>Standards disponibles</Text>
      <Text size="sm">
        Repris de l’outil de suivi : les intitulés et textes qui y sont saisis, sans rien ajouter. Une fois ajouté, un
        standard est une version source verrouillée ; pour le personnaliser, créez-en une copie.
      </Text>
      <ErrorAlert error={erreur} />
      {proposes.map((c) => (
        <Group key={c.definition.identifier} justify="space-between" wrap="nowrap">
          <div>
            <Text fw={500}>{c.definition.name}</Text>
            <Text size="sm" c="dimmed">
              {c.requirements} exigence(s) · {c.domains} domaine(s) · {c.definition.source.organisation}
              {c.error ? ` · non repris : ${c.error}` : ''}
            </Text>
          </div>
          <Button
            size="xs"
            variant="default"
            disabled={!!c.error}
            aria-label={`Ajouter ${c.definition.name} à la bibliothèque`}
            onClick={() => adopter(c)}
          >
            Ajouter à la bibliothèque
          </Button>
        </Group>
      ))}
    </Stack>
  );
}

function CopieReferentiel({
  cible,
  onClose,
  onDone,
}: {
  cible: Referentiel;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [nom, setNom] = useState(`${cible.name} — version de l’organisation`.slice(0, 200)),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false);
  const creer = async () => {
    setEnvoi(true);
    try {
      setErreur(null);
      await api('POST', `/api/library/frameworks/${cible.id}/copy`, { body: { name: nom } });
      await onDone();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Modal opened onClose={onClose} title={`Créer une copie de ${cible.name}`}>
      <Stack>
        <ErrorAlert error={erreur} />
        <Text size="sm">
          {cible.locked
            ? 'Cette version source reste verrouillée et inchangée. '
            : 'La copie repart de la version courante de cette copie. '}
          La copie est un référentiel de l’organisation : vous pourrez y ajouter vos propres exigences et mesures, puis
          la rattacher à un périmètre.
        </Text>
        <TextInput label="Nom de la copie" value={nom} onChange={(e) => setNom(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={envoi} disabled={!nom.trim()} onClick={creer}>
            Créer la copie
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function AjoutExigence({
  cible,
  onClose,
  onDone,
}: {
  cible: Referentiel;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const def = useQuery({
    queryKey: ['library', 'frameworks', cible.id, cible.version],
    queryFn: () =>
      get<{ definition: FrameworkDefinition }>(`/api/library/frameworks/${cible.id}/versions/${cible.version}`),
  });
  const [domaine, setDomaine] = useState<string | null>(null),
    [nouveau, setNouveau] = useState(''),
    [id, setId] = useState(''),
    [titre, setTitre] = useState(''),
    [description, setDescription] = useState(''),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false);
  const domaines = def.data?.definition.domains ?? [];
  const valide = id.trim() && titre.trim() && (nouveau.trim() || domaine);
  const enregistrer = async () => {
    setEnvoi(true);
    try {
      setErreur(null);
      await api('POST', `/api/library/frameworks/${cible.id}/requirements`, {
        body: {
          expectedVersion: cible.version,
          ...(nouveau.trim() ? { newDomainLabel: nouveau.trim() } : { domain: domaine }),
          id: id.trim(),
          title: titre.trim(),
          description,
        },
      });
      await onDone();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Modal opened onClose={onClose} size="lg" title={`Ajouter une exigence à ${cible.name}`}>
      <Stack>
        <ErrorAlert error={erreur ?? def.error} />
        <Text size="sm">
          Chaque ajout publie une nouvelle version immuable de la copie. Un identifiant déjà présent est remplacé dans
          cette nouvelle version ; les versions précédentes restent consultables.
        </Text>
        <Select
          label="Domaine"
          searchable
          clearable
          data={domaines.map((d) => ({ value: d.id, label: d.label }))}
          value={domaine}
          onChange={setDomaine}
          disabled={!!nouveau.trim()}
        />
        <TextInput
          label="Ou nouveau domaine"
          description="Libellé du domaine à créer."
          value={nouveau}
          onChange={(e) => setNouveau(e.currentTarget.value)}
        />
        <TextInput label="Identifiant de l’exigence" value={id} onChange={(e) => setId(e.currentTarget.value)} />
        <TextInput label="Intitulé" value={titre} onChange={(e) => setTitre(e.currentTarget.value)} />
        <Textarea
          label="Description"
          autosize
          minRows={3}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={envoi} disabled={!valide} onClick={enregistrer}>
            Publier la nouvelle version
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/* Bibliothèque de référentiels de l'organisation (ADR 0031, lot M2 ; ADR 0082) : importer un référentiel une fois ; la
   bibliothèque est figée (versions immuables, aucune personnalisation). L'attribuer à un périmètre en crée une copie
   propre au périmètre, modifiable librement, « en préparation » ; l'appliquer en fait un référentiel suivi en conformité.
   Aucun texte normatif n'est fourni : l'organisation importe les exigences dont elle détient les droits. Les droits sont
   ceux de l'API. */
import { Alert, Button, Card, Group, Modal, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FrameworkDefinition } from '@suivi/shared';
import { ConfirmButton, StatusChip } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { DetailExigences, EtatsCouverture, type CouvertureReferentiel } from './Couverture';
import { KitIa } from './KitIa';

interface Referentiel {
  id: string;
  identifier: string;
  name: string;
  version: number;
  requirements: number;
  scopes: number;
  source: { status: string; organisation: string };
  /** Toujours vrai : la bibliothèque est figée (la personnalisation se fait dans la copie d'un périmètre). */
  locked: boolean;
  derivedFrom: { identifier: string; name: string; version: number } | null;
}
interface Rattachement {
  frameworkId: string;
  identifier: string;
  name: string;
  libraryName: string;
  version: number;
  latestVersion: number;
  enabled: boolean;
  statut: 'preparation' | 'applique';
  suivi: boolean;
  copyVersion: number;
  requirements: number;
  inherited: boolean;
  overridden: boolean;
  originId: string;
  originName: string | null;
  orphan: boolean;
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

/** Page « Bibliothèque de référentiels » (ADR 0089) : une carte par référentiel, qui réunit la bibliothèque (exigences au
    catalogue, périmètres rattachés, import et nouvelles éditions) et la couverture dans le périmètre affiché. */
export function Bibliotheque({ smsi }: { smsi?: string }) {
  const can = useCan(),
    qc = useQueryClient(),
    modifier = can('conformite', 'modifier'),
    [detail, setDetail] = useState<CouvertureReferentiel | null>(null),
    [import_, setImport] = useState<{ cible: Referentiel | null } | null>(null),
    [consulte, setConsulte] = useState<{ cible: Referentiel; version: string } | null>(null);
  const liste = useQuery({
    queryKey: ['library', 'frameworks'],
    queryFn: () => get<Referentiel[]>('/api/library/frameworks'),
  });
  const couverture = useQuery({
    queryKey: ['grc', smsi, 'couverture', null],
    queryFn: () => get<{ frameworks: CouvertureReferentiel[] }>(`/api/grc/${smsi}/couverture`),
    enabled: !!smsi,
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
        La bibliothèque contient les référentiels de l’organisation, importés une seule fois. Elle est figée : chaque
        édition publiée est immuable et ne se personnalise pas. Attribuer un référentiel à un périmètre (page
        Périmètres) en crée une copie propre à ce périmètre, que vous adaptez librement ; une fois appliquée, la copie
        est suivie en conformité. Aucun texte normatif n’est fourni : importez les exigences dont vous détenez les
        droits.
      </Alert>
      <ErrorAlert error={liste.error ?? exigences.error ?? couverture.error} />
      <Group justify="space-between">
        <Text>{liste.data ? `${liste.data.length} référentiel(s) dans la bibliothèque` : 'Chargement…'}</Text>
        {modifier && <Button onClick={() => setImport({ cible: null })}>Importer un référentiel</Button>}
      </Group>
      {modifier && <StandardsDisponibles onDone={() => qc.invalidateQueries({ queryKey: ['library'] })} />}
      <KitIa />
      {smsi && (
        <Alert>
          Couverture dans le périmètre affiché : les états ci-dessous concernent uniquement ce périmètre. Ils aident à
          piloter ; ils ne constituent ni un taux de conformité ni une preuve de conformité.
        </Alert>
      )}
      <Stack>
        {(liste.data ?? []).map((f) => {
          const couv = couverture.data?.frameworks.find((c) => c.identifier === f.identifier) ?? null;
          return (
            <Card key={f.id} withBorder aria-label={`Référentiel ${f.name}`}>
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text fw={600}>{f.name}</Text>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">
                        {f.identifier} · version {f.version}
                      </Text>
                      <StatusChip etat="neutre">Figé</StatusChip>
                      <Text size="xs" c="dimmed">
                        {f.derivedFrom
                          ? `Copie de ${f.derivedFrom.name}`
                          : (STATUTS[f.source.status] ?? f.source.status)}
                      </Text>
                    </Group>
                  </div>
                  <Group gap="md" align="flex-start">
                    <div>
                      <Text fw={600}>{f.requirements}</Text>
                      <Text size="xs" c="dimmed">
                        exigences au catalogue
                      </Text>
                    </div>
                    <div>
                      <Text fw={600}>{f.scopes}</Text>
                      <Text size="xs" c="dimmed">
                        {f.scopes > 1 ? 'périmètres rattachés' : 'périmètre rattaché'}
                      </Text>
                    </div>
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
                          variant="subtle"
                          aria-label={`Importer une nouvelle édition de ${f.name}`}
                          onClick={() => setImport({ cible: f })}
                        >
                          Nouvelle édition
                        </Button>
                      )}
                    </Group>
                  </Group>
                </Group>
                {smsi && couv && (
                  <>
                    <EtatsCouverture f={couv} />
                    <Group justify="flex-end">
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`Voir la couverture de ${f.name}`}
                        onClick={() => setDetail(couv)}
                      >
                        Voir la couverture
                      </Button>
                    </Group>
                  </>
                )}
                {smsi && !couv && couverture.data && (
                  <Text size="sm" c="dimmed">
                    Non appliqué dans ce périmètre : aucune couverture à afficher. Attribuez ce référentiel au périmètre
                    (page Périmètres, bouton « Référentiels ») puis appliquez sa copie.
                  </Text>
                )}
              </Stack>
            </Card>
          );
        })}
      </Stack>
      {smsi && detail && (
        <DetailExigences
          smsi={smsi}
          frameworkId={detail.frameworkId}
          nom={detail.name}
          onClose={() => setDetail(null)}
        />
      )}
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

/** Statut affiché d'un référentiel du périmètre. */
function statutDe(r: Rattachement): { etat: 'succes' | 'attention' | 'neutre'; libelle: string } {
  if (r.orphan) return { etat: 'neutre', libelle: 'Sans effet' };
  if (!r.enabled) return { etat: 'neutre', libelle: 'Inactif' };
  return r.statut === 'applique'
    ? { etat: 'succes', libelle: 'Appliqué : suivi en conformité' }
    : { etat: 'attention', libelle: 'En préparation' };
}

/** Référentiels d'un périmètre (ADR 0082) : attribuer un référentiel de la bibliothèque crée une copie propre au
    périmètre, en préparation ; on l'adapte librement, puis on l'applique pour la suivre en conformité. Les périmètres qui
    héritent lisent la copie de leur ancêtre et peuvent seulement la désactiver chez eux. */
export function ReferentielsDuPerimetre({ smsi }: { smsi: string }) {
  const can = useCan(),
    qc = useQueryClient(),
    admin = can('pilotage', 'administrer'),
    [choix, setChoix] = useState<string | null>(null),
    [version, setVersion] = useState<string | null>(null),
    [edite, setEdite] = useState<Rattachement | null>(null),
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
  const liste = rattaches.data ?? [];
  // Un référentiel hérité peut recevoir sa propre copie, qui l'emporte sur celle de l'ancêtre.
  const libres = (biblio.data ?? []).filter(
    (f) => !liste.some((r) => r.frameworkId === f.id && (!r.inherited || r.overridden)),
  );
  const selection = libres.find((f) => f.id === choix);
  // Standards pas encore dans la bibliothèque : proposés à la sélection, ajoutés (figés) à la bibliothèque à l'attribution.
  const standardsOfferts = (standards.data ?? []).filter((c) => !c.duplicate && !c.error);
  const standardChoisi = standardsOfferts.find((c) => 'standard:' + c.definition.identifier === choix);
  const rafraichir = async () => {
    await qc.invalidateQueries({ queryKey: ['grc', smsi] });
    await qc.invalidateQueries({ queryKey: ['library'] });
  };
  const agir = async (action: () => Promise<unknown>) => {
    try {
      setErreur(null);
      await action();
      await rafraichir();
    } catch (e) {
      setErreur(e);
    }
  };
  const attribuer = (id: string, v: number) =>
    agir(() =>
      api('PUT', `/api/grc/${smsi}/framework-attachments/${id}`, { body: { version: v, confirm: 'RATTACHER' } }),
    );
  const statut = (id: string, s: 'preparation' | 'applique') =>
    agir(() =>
      api('PUT', `/api/grc/${smsi}/framework-attachments/${id}/statut`, { body: { statut: s, confirm: 'APPLIQUER' } }),
    );
  const activer = (id: string, enabled: boolean) =>
    agir(() => api('PUT', `/api/grc/${smsi}/framework-attachments/${id}/activation`, { body: { enabled } }));
  return (
    <Stack>
      <Text size="sm">
        Attribuer un référentiel de la bibliothèque crée une copie propre à ce périmètre, en préparation. Adaptez-la
        librement (ajout, modification ou retrait d’exigences), puis appliquez-la : elle devient un référentiel suivi en
        conformité. La bibliothèque n’est jamais modifiée.
      </Text>
      <ErrorAlert error={erreur ?? rattaches.error ?? biblio.error} />
      {liste.length === 0 && <Text>Aucun référentiel n’est attribué à ce périmètre.</Text>}
      {liste.map((r) => {
        const s = statutDe(r);
        return (
          <Stack key={r.frameworkId} gap="2xs">
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <div>
                <Group gap="xs">
                  <Text fw={600}>{r.name}</Text>
                  <StatusChip etat={s.etat}>{s.libelle}</StatusChip>
                </Group>
                <Text size="sm" c="dimmed">
                  Copie de « {r.libraryName} », édition {r.version}
                  {!r.inherited && r.latestVersion > r.version && ` (édition ${r.latestVersion} disponible)`}
                  {!r.orphan && ` · ${r.requirements} exigence(s) · version ${r.copyVersion} de la copie`}
                </Text>
                {r.inherited && (
                  <Text size="sm">
                    Copie héritée de {r.originName ?? 'un périmètre parent non accessible'} : elle se modifie et
                    s’applique dans ce périmètre.{r.overridden && ' Activation réglée ici.'}
                  </Text>
                )}
                {r.orphan && (
                  <Text size="sm">Réglage local d’un référentiel qui n’est plus hérité : sans effet, à retirer.</Text>
                )}
              </div>
            </Group>
            <Group gap="xs">
              {!r.orphan && (
                <Button
                  size="xs"
                  variant="default"
                  aria-label={`${!r.inherited && can('conformite', 'modifier') ? 'Modifier' : 'Consulter'} la copie de ${r.name}`}
                  onClick={() => setEdite(r)}
                >
                  {!r.inherited && can('conformite', 'modifier') ? 'Modifier la copie' : 'Consulter la copie'}
                </Button>
              )}
              {admin && !r.inherited && !r.orphan && r.statut === 'preparation' && (
                <ConfirmButton
                  size="xs"
                  color="blue"
                  message={`Appliquer « ${r.name} » à ce périmètre ? La copie devient un référentiel suivi en conformité (couverture, évaluations) ; elle reste modifiable.`}
                  onConfirm={() => statut(r.frameworkId, 'applique')}
                >
                  Appliquer
                </ConfirmButton>
              )}
              {admin && !r.inherited && !r.orphan && r.statut === 'applique' && (
                <ConfirmButton
                  size="xs"
                  variant="default"
                  message={`Repasser « ${r.name} » en préparation ? Il sort du suivi de conformité ; évaluations, liens et historique sont conservés.`}
                  onConfirm={() => statut(r.frameworkId, 'preparation')}
                >
                  Repasser en préparation
                </ConfirmButton>
              )}
              {admin && !r.inherited && !r.orphan && r.latestVersion > r.version && (
                <ConfirmButton
                  size="xs"
                  variant="default"
                  message={`Reprendre l’édition ${r.latestVersion} de « ${r.libraryName} » ? Le contenu de la copie est remplacé par cette édition (vos adaptations sont conservées dans l’historique de la copie).`}
                  onConfirm={() => attribuer(r.frameworkId, r.latestVersion)}
                >
                  Reprendre l’édition {r.latestVersion}
                </ConfirmButton>
              )}
              {admin && r.inherited && (
                <Button size="xs" variant="default" onClick={() => activer(r.frameworkId, !r.enabled)}>
                  {r.enabled ? 'Désactiver ici' : 'Réactiver ici'}
                </Button>
              )}
              {admin && !r.inherited && !r.orphan && (
                <Button size="xs" variant="default" onClick={() => activer(r.frameworkId, !r.enabled)}>
                  {r.enabled ? 'Désactiver' : 'Activer'}
                </Button>
              )}
              {admin && (!r.inherited || r.overridden) && (
                <ConfirmButton
                  size="xs"
                  variant="default"
                  message={
                    r.inherited || r.orphan
                      ? `Retirer le réglage local de « ${r.name} » ?`
                      : `Détacher « ${r.name} » de ce périmètre ? Le référentiel reste dans la bibliothèque ; l’historique de la copie est conservé.`
                  }
                  onConfirm={() => agir(() => api('DELETE', `/api/grc/${smsi}/framework-attachments/${r.frameworkId}`))}
                >
                  {r.inherited || r.orphan ? 'Retirer le réglage local' : 'Détacher'}
                </ConfirmButton>
              )}
            </Group>
          </Stack>
        );
      })}
      {admin && (libres.length > 0 || standardsOfferts.length > 0) && (
        <Group align="flex-end">
          <Select
            allowDeselect={false}
            label="Attribuer un référentiel de la bibliothèque"
            description="Crée une copie propre à ce périmètre, en préparation."
            placeholder="Choisir un référentiel"
            data={[
              ...libres.map((f) => ({
                value: f.id,
                label: liste.some((r) => r.frameworkId === f.id) ? `${f.name} (remplace la copie héritée)` : f.name,
              })),
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
              label="Édition"
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
                // Standard de l'outil de suivi : ajouté à la bibliothèque (figé), puis attribué au périmètre.
                try {
                  setErreur(null);
                  const ajoute = await adopterStandard(standardChoisi.definition.identifier);
                  await attribuer(ajoute.id, ajoute.version);
                } catch (e) {
                  setErreur(e);
                  return;
                }
              } else await attribuer(selection!.id, Number(version));
              setChoix(null);
              setVersion(null);
            }}
          >
            Attribuer
          </Button>
        </Group>
      )}
      <Modal
        opened={!!edite}
        onClose={() => setEdite(null)}
        size="xl"
        title={edite ? `Copie : ${edite.name}` : ''}
        closeButtonProps={{ 'aria-label': 'Fermer la copie' }}
      >
        {edite && <EditeurCopie smsi={smsi} frameworkId={edite.frameworkId} onChanged={rafraichir} />}
      </Modal>
    </Stack>
  );
}

interface CopieDuPerimetre {
  frameworkId: string;
  definition: FrameworkDefinition;
  version: number;
  versionCourante: number;
  sourceVersion: number;
  statut: 'preparation' | 'applique';
  modifiable: boolean;
  historique: { version: number; sourceVersion: number; reason: string; createdBy: string; createdAt: string }[];
}
type Exigence = FrameworkDefinition['requirements'][number];

/** Copie du référentiel dans le périmètre : exigences par domaine, ajout, modification, retrait, renommage et historique
    des versions. Chaque modification publie une version immuable de la copie ; la bibliothèque n'est pas touchée. */
function EditeurCopie({
  smsi,
  frameworkId,
  onChanged,
}: {
  smsi: string;
  frameworkId: string;
  onChanged: () => Promise<void>;
}) {
  const [vue, setVue] = useState<string | null>(null),
    [formulaire, setFormulaire] = useState<{ exigence: Exigence | null } | null>(null),
    [nom, setNom] = useState<string | null>(null),
    [erreur, setErreur] = useState<unknown>(null);
  const q = useQuery({
    queryKey: ['grc', smsi, 'copie', frameworkId, vue],
    queryFn: () =>
      get<CopieDuPerimetre>(`/api/grc/${smsi}/framework-copies/${frameworkId}${vue ? `?version=${vue}` : ''}`),
  });
  const c = q.data;
  const courante = !!c && c.version === c.versionCourante;
  const modifiable = !!c?.modifiable && courante;
  const agir = async (action: () => Promise<unknown>) => {
    try {
      setErreur(null);
      await action();
      setFormulaire(null);
      await onChanged();
    } catch (e) {
      setErreur(e);
    }
  };
  if (!c) return <ErrorAlert error={q.error} />;
  const domaines = c.definition.domains;
  return (
    <Stack>
      <ErrorAlert error={erreur ?? q.error} />
      <Text size="sm">
        {c.statut === 'applique'
          ? 'Copie appliquée : ses exigences sont suivies en conformité. Les évaluations et les mesures reliées suivent chaque exigence par son identifiant ; une exigence retirée garde son historique mais n’est plus comptée.'
          : 'Copie en préparation : adaptez-la, puis appliquez-la depuis la liste des référentiels du périmètre.'}
        {!c.modifiable &&
          ' Lecture seule : la copie se modifie dans le périmètre qui la porte, avec le droit de modifier la conformité.'}
      </Text>
      <Select
        label="Version de la copie"
        allowDeselect={false}
        data={c.historique.map((h) => ({
          value: String(h.version),
          label: `Version ${h.version}${h.version === c.versionCourante ? ' (courante)' : ''} · ${h.reason}`,
        }))}
        value={String(c.version)}
        onChange={(v) => {
          setFormulaire(null);
          setVue(v && Number(v) !== c.versionCourante ? v : null);
        }}
      />
      {modifiable && (
        <Group align="flex-end">
          <TextInput
            label="Nom de la copie"
            value={nom ?? c.definition.name}
            onChange={(e) => setNom(e.currentTarget.value)}
          />
          <Button
            variant="default"
            disabled={!nom?.trim() || nom.trim() === c.definition.name}
            onClick={() =>
              agir(async () => {
                await api('PUT', `/api/grc/${smsi}/framework-copies/${frameworkId}`, {
                  body: { name: nom!.trim(), expectedVersion: c.versionCourante },
                });
                setNom(null);
              })
            }
          >
            Renommer
          </Button>
        </Group>
      )}
      {domaines.map((d) => {
        const exigences = c.definition.requirements.filter((r) => r.domain === d.id);
        if (!exigences.length && !modifiable) return null;
        return (
          <Stack key={d.id} gap="2xs">
            <Text fw={600}>{d.label}</Text>
            {exigences.length === 0 && (
              <Text size="sm" c="dimmed">
                Aucune exigence dans ce domaine.
              </Text>
            )}
            {exigences.map((r) => (
              <Group key={r.id} justify="space-between" wrap="nowrap">
                <Text size="sm">
                  <b>{r.id}</b> · {r.title}
                </Text>
                {modifiable && (
                  <Group gap="xs" wrap="nowrap">
                    <Button
                      size="xs"
                      variant="default"
                      aria-label={`Modifier l’exigence ${r.id}`}
                      onClick={() => setFormulaire({ exigence: r })}
                    >
                      Modifier
                    </Button>
                    <ConfirmButton
                      size="xs"
                      variant="default"
                      aria-label={`Retirer l’exigence ${r.id}`}
                      message={`Retirer l’exigence ${r.id} de la copie ? Ses évaluations et liens restent dans l’historique ; elle ne sera plus comptée.`}
                      onConfirm={() =>
                        agir(() =>
                          api(
                            'DELETE',
                            `/api/grc/${smsi}/framework-copies/${frameworkId}/requirements/${encodeURIComponent(r.id)}`,
                            { ifMatch: c.versionCourante },
                          ),
                        )
                      }
                    >
                      Retirer
                    </ConfirmButton>
                  </Group>
                )}
              </Group>
            ))}
          </Stack>
        );
      })}
      {modifiable && !formulaire && (
        <Group>
          <Button onClick={() => setFormulaire({ exigence: null })}>Ajouter une exigence</Button>
        </Group>
      )}
      {modifiable && formulaire && (
        <FormulaireExigence
          key={formulaire.exigence?.id ?? 'nouvelle'}
          domaines={domaines}
          exigence={formulaire.exigence}
          onCancel={() => setFormulaire(null)}
          onSave={(corps) =>
            agir(() =>
              api('POST', `/api/grc/${smsi}/framework-copies/${frameworkId}/requirements`, {
                body: { expectedVersion: c.versionCourante, ...corps },
              }),
            )
          }
        />
      )}
    </Stack>
  );
}

function FormulaireExigence({
  domaines,
  exigence,
  onCancel,
  onSave,
}: {
  domaines: FrameworkDefinition['domains'];
  exigence: Exigence | null;
  onCancel: () => void;
  onSave: (corps: Record<string, unknown>) => Promise<void>;
}) {
  const [domaine, setDomaine] = useState<string | null>(exigence?.domain ?? null),
    [nouveau, setNouveau] = useState(''),
    [id, setId] = useState(exigence?.id ?? ''),
    [titre, setTitre] = useState(exigence?.title ?? ''),
    [description, setDescription] = useState(exigence?.description ?? ''),
    [applicabilite, setApplicabilite] = useState(exigence?.applicability ?? ''),
    [envoi, setEnvoi] = useState(false);
  const valide = id.trim() && titre.trim() && (nouveau.trim() || domaine);
  return (
    <Stack gap="xs">
      <Text fw={600}>{exigence ? `Modifier l’exigence ${exigence.id}` : 'Nouvelle exigence'}</Text>
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
      <TextInput
        label="Identifiant de l’exigence"
        value={id}
        disabled={!!exigence}
        onChange={(e) => setId(e.currentTarget.value)}
      />
      <TextInput label="Intitulé" value={titre} onChange={(e) => setTitre(e.currentTarget.value)} />
      <Textarea
        label="Description"
        autosize
        minRows={3}
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
      />
      <TextInput
        label="Applicabilité"
        value={applicabilite}
        onChange={(e) => setApplicabilite(e.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={envoi}
          disabled={!valide}
          onClick={async () => {
            setEnvoi(true);
            try {
              await onSave({
                ...(nouveau.trim() ? { newDomainLabel: nouveau.trim() } : { domain: domaine }),
                id: id.trim(),
                title: titre.trim(),
                description,
                applicability: applicabilite,
              });
            } finally {
              setEnvoi(false);
            }
          }}
        >
          Enregistrer dans la copie
        </Button>
      </Group>
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
                bibliothèque de l’organisation, où elle est figée ; ce périmètre en reçoit une copie, appliquée.
                L’original est conservé.
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
                  {simulation.identicalToLibrary ? ' avec la même définition' : ''} : attribuez-le au périmètre depuis
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
  error: string | null;
}

/** Standards disponibles : lus dans l'outil de suivi (aucun texte normatif n'est fourni par l'application). Un geste les
    ajoute à la bibliothèque en version source verrouillée ; un standard dont les données sont incomplètes est indiqué
    sans alerte et sans bloquer les autres. */
function useStandards(actif: boolean) {
  return useQuery({
    queryKey: ['library', 'tracker-import'],
    queryFn: () => get<CandidatSuivi[]>('/api/library/tracker-import'),
    enabled: actif,
    retry: false,
  });
}
async function adopterStandard(identifier: string) {
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
        standard est figé dans la bibliothèque ; pour l’adapter, attribuez-le à un périmètre et modifiez sa copie.
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

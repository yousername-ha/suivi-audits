/* Module Intégrations (ADR 0076), socle des connecteurs réseau : carte « Intégrations » de la page Plateforme (addendum du
   19/11/2026 : les intégrations se configurent là et nulle part ailleurs ; l'ancienne adresse /integrations y redirige). Une
   tuile par type de connecteur
   (catalogue) et par instance, avec un pictogramme neutre de packages/ui (aucun logo de marque dans ce lot). Configuration,
   secrets en écriture seule (« défini » / « non défini »), activation qui ouvre le flux du type après validation explicite
   (ADR 0097), « Tester la connexion », « Synchroniser maintenant » (Tenable : failles et machines, ADR 0100 lot V5) avec
   le filtre de gravité de l'instance et le dernier résultat, dernières exécutions, message clair si l'exécutant n'est pas
   vu. Lot F1 (ADR 0100) : fréquence de la synchronisation automatique de chaque instance, réglée dans « Configurer »,
   avec un avertissement (sans blocage) en dessous de 24 heures. Lot N1 (ADR 0100) : type « Nessus, import de fichier »,
   sans adresse, sans clé, sans flux ni exécutant, avec « Importer un scan » sur l'instance (droit d'administrer les
   intégrations) ; ses imports figurent dans « Exécutions ». CSP stricte (ADR 0006) : ni style ni script en ligne. Les boutons
   suivent les droits de la session pour l'affichage seulement. */
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Paper,
  PasswordInput,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  avertissementConnecteur,
  DELAI_MAX,
  DELAI_MIN,
  FREQUENCES_CONNECTEUR,
  libelleFrequence,
  type EtatIntegrationsDto,
  type ExecutionIntegrationDto,
  type IntegrationDto,
  type TypeIntegrationDto,
} from '@suivi/shared';
import { DataTable, ErrorAlert, IconeConnecteur, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, get } from '../api';
import { fmtDate } from '../components/common';
import { ChampFrequence } from '../components/ChampFrequence';
import { CLE_FLUX_EXTERNES, FluxFermeAlerte } from '../components/FluxExternes';
import { useValidationFlux } from '../components/ValidationFlux';
import { useCan } from '../session';
import {
  corpsCreation,
  corpsModification,
  destinationChangee,
  ETAT_EXECUTION,
  ETAT_TUILE,
  erreursFormulaire,
  etatTuile,
  executionEnCours,
  fluxOuvertInstance,
  formulaireDepuis,
  libelleEtatExecution,
  libelleGravites,
  libelleOperation,
  libelleSecret,
  messageExecutant,
  OPTIONS_GRAVITES,
  precisionPort,
  resumeExecution,
  type FormulaireConfiguration,
} from './integrations';
import { ImportNessus } from './ImportNessus';

const CLE = ['integrations'] as const;

function Picto() {
  return (
    <span className="integration-picto">
      <IconeConnecteur />
    </span>
  );
}

/** Tuile d'un type du catalogue (sans état) : rendu testable hors navigateur. */
export function TuileType({
  t,
  peutAjouter,
  onAjouter,
}: {
  t: TypeIntegrationDto;
  peutAjouter: boolean;
  onAjouter: () => void;
}) {
  return (
    <Paper withBorder p="md" radius="md" className="integration-tuile" component="section" aria-label={t.libelle}>
      <Stack gap="xs">
        <Group gap="sm" wrap="nowrap">
          <Picto />
          <Stack gap="2xs">
            <Text fw={700}>{t.libelle}</Text>
            <Text size="xs" c="dimmed">
              {t.portee === 'organisation' ? 'Toute l’organisation' : 'Un périmètre'} ·{' '}
              {t.flux === null ? 'import de fichier, sans réseau' : 'lecture seule'}
            </Text>
          </Stack>
        </Group>
        <Text size="sm">{t.description}</Text>
        {peutAjouter && (
          <Group justify="flex-end">
            <Button size="compact-sm" variant="default" onClick={onAjouter}>
              Ajouter une instance
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}

/** Tuile d'une instance (sans état) : état, secrets, dernière exécution, gestes permis. */
export function TuileInstance({
  i,
  t,
  fluxOuvert,
  peutAdministrer,
  peutLancer,
  enCours,
  onConfigurer,
  onActiver,
  onTester,
  onSynchroniser,
  onImporter,
  onExecutions,
}: {
  i: IntegrationDto;
  t: TypeIntegrationDto | undefined;
  fluxOuvert: boolean;
  peutAdministrer: boolean;
  peutLancer: boolean;
  enCours: boolean;
  onConfigurer: () => void;
  onActiver: (actif: boolean) => void;
  onTester: () => void;
  onSynchroniser?: () => void;
  onImporter?: () => void;
  onExecutions: () => void;
}) {
  const synchronisable = !!t?.operations.includes('synchroniser');
  const testable = !!t?.operations.includes('tester');
  const importable = !!t?.operations.includes('importer');
  const pret = i.actif && fluxOuvert && Object.values(i.secrets).every(Boolean);
  const e = ETAT_TUILE[etatTuile(i, fluxOuvert)];
  const derniere = i.derniereExecution;
  const adresse = typeof i.configuration.adresse === 'string' ? i.configuration.adresse : '';
  return (
    <Paper withBorder p="md" radius="md" className="integration-tuile" component="section" aria-label={i.nom}>
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Group gap="sm" wrap="nowrap">
            <Picto />
            <Stack gap="2xs">
              <Text fw={700}>{i.nom}</Text>
              <Text size="xs" c="dimmed">
                {t?.libelle ?? i.type}
                {adresse && ` · ${adresse}`}
              </Text>
            </Stack>
          </Group>
          <StatusChip etat={e.etat}>{e.libelle}</StatusChip>
        </Group>
        <Group gap="xs">
          {(t?.secrets ?? []).map((s) => (
            <Badge key={s.id} variant="outline" color={i.secrets[s.id] ? 'teal' : 'gray'}>
              {s.libelle} : {libelleSecret(i.secrets[s.id] === true)}
            </Badge>
          ))}
        </Group>
        {synchronisable && t?.champs.includes('gravites') && i.frequenceHeures !== null && (
          <Text size="xs" c="dimmed">
            Synchronisation automatique : {libelleFrequence(i.frequenceHeures).toLowerCase()} ; failles lues :{' '}
            {libelleGravites(i.configuration.gravites)}.
          </Text>
        )}
        {synchronisable && t && !t.champs.includes('gravites') && i.frequenceHeures !== null && (
          <Text size="xs" c="dimmed">
            Synchronisation automatique : {libelleFrequence(i.frequenceHeures).toLowerCase()}, rangée dans Risques &gt;
            Vulnérabilités &gt; Surface externe.
          </Text>
        )}
        {importable && (
          <Text size="xs" c="dimmed">
            Import de fichier, sans synchronisation automatique ; gravités retenues :{' '}
            {libelleGravites(i.configuration.gravites)} ; rangé dans Risques &gt; Vulnérabilités.
          </Text>
        )}
        {i.actif && !fluxOuvert && t?.flux && <FluxFermeAlerte module={t.flux} />}
        <Text size="sm" c={derniere ? undefined : 'dimmed'} role="status">
          {derniere ? (
            <>
              Dernière exécution ({libelleOperation(derniere.operation)},{' '}
              <span className="horodatage">{fmtDate(derniere.demandeLe)}</span>) : {resumeExecution(derniere)}
            </>
          ) : (
            'Aucune exécution.'
          )}
        </Text>
        <Group gap="xs" justify="flex-end">
          <Button size="compact-sm" variant="subtle" onClick={onExecutions}>
            Exécutions
          </Button>
          {peutAdministrer && (
            <Button size="compact-sm" variant="default" onClick={onConfigurer} aria-label={`Configurer ${i.nom}`}>
              Configurer
            </Button>
          )}
          {peutAdministrer && (
            <Button
              size="compact-sm"
              variant={i.actif && fluxOuvert ? 'light' : 'filled'}
              color={i.actif && fluxOuvert ? 'red' : undefined}
              onClick={() => onActiver(!(i.actif && fluxOuvert))}
            >
              {i.actif && fluxOuvert ? 'Désactiver' : 'Activer'}
            </Button>
          )}
          {peutLancer && testable && (
            <Button size="compact-sm" variant="default" loading={enCours} disabled={!pret} onClick={onTester}>
              Tester la connexion
            </Button>
          )}
          {peutLancer && synchronisable && onSynchroniser && (
            <Button size="compact-sm" loading={enCours} disabled={!pret} onClick={onSynchroniser}>
              Synchroniser maintenant
            </Button>
          )}
          {peutAdministrer && importable && onImporter && (
            <Button
              size="compact-sm"
              disabled={!i.actif}
              onClick={onImporter}
              aria-label={`Importer un scan dans ${i.nom}`}
            >
              Importer un scan
            </Button>
          )}
        </Group>
        {peutAdministrer && importable && !i.actif && (
          <Text size="xs" c="dimmed">
            Activez le connecteur pour importer un scan.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

/** Dernières exécutions d'une instance (sans état). */
export function TableExecutions({ executions }: { executions: ExecutionIntegrationDto[] }) {
  return (
    <DataTable label="Dernières exécutions">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Demandée le</Table.Th>
            <Table.Th>Opération</Table.Th>
            <Table.Th>Par</Table.Th>
            <Table.Th>État</Table.Th>
            <Table.Th>Résultat</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {executions.map((e) => (
            <Table.Tr key={e.id}>
              <Table.Td className="horodatage">{fmtDate(e.demandeLe)}</Table.Td>
              <Table.Td>{libelleOperation(e.operation)}</Table.Td>
              <Table.Td>{e.demandePar}</Table.Td>
              <Table.Td>
                <StatusChip etat={ETAT_EXECUTION[e.etat]}>{libelleEtatExecution(e.etat)}</StatusChip>
              </Table.Td>
              <Table.Td>{resumeExecution(e)}</Table.Td>
            </Table.Tr>
          ))}
          {executions.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text size="sm" c="dimmed">
                  Aucune exécution.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Contenu de la carte « Intégrations » de la page Plateforme : la fenêtre de la carte porte le titre, le panneau ne le
    répète pas. */
export function IntegrationsPanel() {
  const can = useCan();
  const qc = useQueryClient();
  const lire = can('integrations', 'lire');
  const administrer = can('integrations', 'administrer');
  const lancer = can('integrations', 'modifier');
  const flux = useValidationFlux();
  const [edition, setEdition] = useState<{ type: TypeIntegrationDto; instance: IntegrationDto | null } | null>(null);
  const [historique, setHistorique] = useState<IntegrationDto | null>(null);
  const [importation, setImportation] = useState<IntegrationDto | null>(null);
  const [importOccupe, setImportOccupe] = useState(false);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const catalogue = useQuery({
    queryKey: [...CLE, 'catalogue'],
    queryFn: () => get<TypeIntegrationDto[]>('/api/integrations/catalogue'),
    enabled: lire,
  });
  const etat = useQuery({
    queryKey: [...CLE, 'etat'],
    queryFn: () => get<EtatIntegrationsDto>('/api/integrations/etat'),
    enabled: lire,
    refetchInterval: 30_000,
  });
  const instances = useQuery({
    queryKey: [...CLE, 'instances'],
    queryFn: () => get<IntegrationDto[]>('/api/integrations/instances'),
    enabled: lire,
    // Une exécution en file ou en cours : suivi toutes les deux secondes jusqu'à son terme.
    refetchInterval: (q) => (q.state.data?.some((i) => executionEnCours(i.derniereExecution)) ? 2000 : false),
  });
  const rafraichir = async () => {
    await qc.invalidateQueries({ queryKey: CLE });
  };
  const types = new Map((catalogue.data ?? []).map((t) => [t.id, t]));

  const agir = async (id: string, fn: () => Promise<void>) => {
    setEnvoi(id);
    try {
      await fn();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      setEnvoi(null);
      await rafraichir();
    }
  };
  const activer = (i: IntegrationDto, actif: boolean) =>
    agir(i.id, async () => {
      const t = types.get(i.type);
      const ouvert = fluxOuvertInstance(etat.data, i.type, t);
      // Activer ouvre le flux du type, après validation explicite (une fois, tant qu'il est fermé) ; le port réglé de
      // l'instance est rappelé. Un type sans réseau (import de fichier) n'a aucun flux.
      if (actif && !ouvert && t?.flux && !(await flux.valider(t.flux, precisionPort(i)))) return;
      await api('PUT', `/api/integrations/instances/${i.id}/activation`, {
        body: actif && !ouvert ? { actif, fluxConfirme: true } : { actif },
        ifMatch: i.version,
      });
      await qc.invalidateQueries({ queryKey: CLE_FLUX_EXTERNES });
      notifications.show({ color: 'teal', message: actif ? 'Connecteur activé.' : 'Connecteur désactivé.' });
    });
  const tester = (i: IntegrationDto) =>
    agir(i.id, async () => {
      await api('POST', `/api/integrations/instances/${i.id}/tester`);
      notifications.show({ color: 'teal', message: 'Test demandé à l’exécutant d’exploitation.' });
    });
  const synchroniser = (i: IntegrationDto) =>
    agir(i.id, async () => {
      await api('POST', `/api/integrations/instances/${i.id}/synchroniser`);
      notifications.show({ color: 'teal', message: 'Synchronisation demandée à l’exécutant d’exploitation.' });
    });

  if (!lire) return <Alert>Vous ne disposez pas du droit de lire les intégrations.</Alert>;
  const avertissement = etat.data ? messageExecutant(etat.data.executant) : null;
  return (
    <>
      <Stack>
        <Text size="sm" c="dimmed" className="lecture">
          Connecteurs en lecture seule vers des outils de l’organisation. Le serveur d’application n’a pas d’accès
          réseau : c’est l’exécutant d’exploitation qui interroge chaque outil, flux par flux, après validation par un
          administrateur. Les outils qui exploitent un connecteur (module Vulnérabilités) n’en montrent que l’état.
        </Text>
        {avertissement && (
          <Alert color="orange" role="status" title="Exécutant d’exploitation non vu">
            {avertissement}
          </Alert>
        )}
        <ErrorAlert error={catalogue.error ?? instances.error ?? etat.error} />
        <Title order={3} size="h4">
          Connecteurs configurés
        </Title>
        {instances.data && instances.data.length === 0 && (
          <Text size="sm" c="dimmed">
            Aucun connecteur configuré.{administrer ? ' Ajoutez une instance depuis le catalogue ci-dessous.' : ''}
          </Text>
        )}
        <div className="integrations-tuiles">
          {(instances.data ?? []).map((i) => (
            <TuileInstance
              key={i.id}
              i={i}
              t={types.get(i.type)}
              fluxOuvert={fluxOuvertInstance(etat.data, i.type, types.get(i.type))}
              peutAdministrer={administrer}
              peutLancer={lancer}
              enCours={envoi === i.id || executionEnCours(i.derniereExecution)}
              onConfigurer={() => {
                const t = types.get(i.type);
                if (t) setEdition({ type: t, instance: i });
              }}
              onActiver={(actif) => void activer(i, actif)}
              onTester={() => void tester(i)}
              onSynchroniser={() => void synchroniser(i)}
              onImporter={() => setImportation(i)}
              onExecutions={() => setHistorique(i)}
            />
          ))}
        </div>
        <Title order={3} size="h4">
          Catalogue
        </Title>
        <div className="integrations-tuiles">
          {(catalogue.data ?? []).map((t) => (
            <TuileType
              key={t.id}
              t={t}
              peutAjouter={administrer}
              onAjouter={() => setEdition({ type: t, instance: null })}
            />
          ))}
        </div>
      </Stack>
      {flux.fenetre}
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!edition}
        onClose={() => setEdition(null)}
        title={edition?.instance ? `Configurer ${edition.instance.nom}` : `Ajouter : ${edition?.type.libelle ?? ''}`}
        size="lg"
        centered
        lockScroll={false}
        classNames={{ content: 'fenetre-admin' }}
      >
        {edition && (
          <EditeurInstance
            type={edition.type}
            instance={edition.instance}
            onFait={async (i) => {
              await rafraichir();
              if (i) setEdition({ type: edition.type, instance: i });
            }}
          />
        )}
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!historique}
        onClose={() => setHistorique(null)}
        title={`Exécutions : ${historique?.nom ?? ''}`}
        size="xl"
        centered
        lockScroll={false}
        classNames={{ content: 'fenetre-admin' }}
      >
        {historique && <Historique id={historique.id} />}
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!importation}
        onClose={() => {
          if (!importOccupe) setImportation(null);
        }}
        withCloseButton={!importOccupe}
        closeOnEscape={!importOccupe}
        closeOnClickOutside={!importOccupe}
        title={`Importer un scan : ${importation?.nom ?? ''}`}
        size="lg"
        centered
        lockScroll={false}
        classNames={{ content: 'fenetre-admin' }}
      >
        {importation && (
          <ImportNessus instance={importation} onOccupe={setImportOccupe} onFait={() => void rafraichir()} />
        )}
      </Modal>
    </>
  );
}

function Historique({ id }: { id: string }) {
  const q = useQuery({
    queryKey: [...CLE, 'executions', id],
    queryFn: () => get<ExecutionIntegrationDto[]>(`/api/integrations/instances/${id}/executions`),
    refetchInterval: (r) => (r.state.data?.some((e) => executionEnCours(e)) ? 2000 : false),
  });
  return (
    <Stack>
      <ErrorAlert error={q.error} />
      {q.data && <TableExecutions executions={q.data} />}
    </Stack>
  );
}

/** Configuration et secrets d'une instance. À la création, les secrets se saisissent ensuite (l'instance doit exister). */
function EditeurInstance({
  type,
  instance,
  onFait,
}: {
  type: TypeIntegrationDto;
  instance: IntegrationDto | null;
  onFait: (i: IntegrationDto | null) => Promise<void>;
}) {
  const [f, setF] = useState<FormulaireConfiguration>(() => formulaireDepuis(instance, type));
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const enregistrer = async () => {
    setErreur(null);
    const e = erreursFormulaire(f, type);
    if (e.length) {
      setErreur(e.join(' '));
      return;
    }
    setEnCours(true);
    try {
      let i: IntegrationDto;
      if (instance) {
        const patch = corpsModification(instance, f, type);
        i = Object.keys(patch).length
          ? await api<IntegrationDto>('PATCH', `/api/integrations/instances/${instance.id}`, {
              body: patch,
              ifMatch: instance.version,
            })
          : instance;
      } else i = await api<IntegrationDto>('POST', '/api/integrations/instances', { body: corpsCreation(type, f) });
      notifications.show({ color: 'teal', message: instance ? 'Configuration enregistrée.' : 'Instance créée.' });
      await onFait(i);
    } catch (e) {
      setErreur(errorMessage(e));
    } finally {
      setEnCours(false);
    }
  };
  return (
    <Stack>
      {erreur && (
        <Alert color="red" role="alert">
          {erreur}
        </Alert>
      )}
      <TextInput
        label="Nom"
        required
        maxLength={120}
        value={f.nom}
        onChange={(e) => setF({ ...f, nom: e.currentTarget.value })}
      />
      {type.champs.includes('adresse') && (
        <TextInput
          label="Adresse du service"
          description={type.aideAdresse}
          required
          value={f.adresse}
          onChange={(e) => setF({ ...f, adresse: e.currentTarget.value })}
          spellCheck={false}
        />
      )}
      {type.champs.includes('autoriteCertification') && (
        <Textarea
          label="Autorité de certification (facultatif)"
          description="Pour un service dont le certificat est signé par une autorité interne : collez son certificat PEM. Vide : autorités reconnues du système. Le certificat est toujours vérifié."
          autosize
          minRows={2}
          maxRows={8}
          value={f.autoriteCertification}
          onChange={(e) => setF({ ...f, autoriteCertification: e.currentTarget.value })}
          spellCheck={false}
        />
      )}
      {type.champs.includes('delaiSecondes') && (
        <NumberInput
          label="Délai d’une requête (secondes)"
          min={DELAI_MIN}
          max={DELAI_MAX}
          allowDecimal={false}
          value={f.delaiSecondes}
          onChange={(v) => setF({ ...f, delaiSecondes: typeof v === 'number' ? v : f.delaiSecondes })}
        />
      )}
      {type.champs.includes('gravites') && (
        <Checkbox.Group
          label={type.flux === null ? 'Gravités à importer' : 'Gravités à synchroniser'}
          description={
            type.flux === null
              ? 'Failles retenues à chaque import (les contrôles informatifs ne sont jamais rangés) : critiques et élevées par défaut. Le navigateur filtre, le serveur revérifie.'
              : 'Failles lues dans Tenable à chaque synchronisation : critiques et élevées par défaut.'
          }
          value={f.gravites}
          onChange={(v) => setF({ ...f, gravites: v as FormulaireConfiguration['gravites'] })}
        >
          <Group gap="md">
            {OPTIONS_GRAVITES.map((o) => (
              <Checkbox key={o.value} value={o.value} label={o.label} />
            ))}
          </Group>
        </Checkbox.Group>
      )}
      {type.operations.includes('synchroniser') && (
        <ChampFrequence
          label="Fréquence de la synchronisation automatique"
          frequences={FREQUENCES_CONNECTEUR[type.id]}
          valeur={f.frequenceHeures}
          onChange={(h) => setF({ ...f, frequenceHeures: h })}
          avertissement={avertissementConnecteur(type.id, f.frequenceHeures)}
        />
      )}
      {instance && destinationChangee(instance, f) && Object.values(instance.secrets).some(Boolean) && (
        <Alert color="orange" role="status">
          Changer l’adresse (port compris) ou l’autorité de certification supprime les clés enregistrées : il faudra les
          ressaisir.
        </Alert>
      )}
      <Group justify="flex-end">
        <Button onClick={() => void enregistrer()} loading={enCours}>
          {instance ? 'Enregistrer la configuration' : 'Créer l’instance'}
        </Button>
      </Group>
      {type.secrets.length > 0 &&
        (instance ? (
          <Secrets type={type} instance={instance} onFait={() => onFait(null)} />
        ) : (
          <Text size="sm" c="dimmed">
            Les clés se saisissent une fois l’instance créée. Elles sont scellées et ne sont jamais réaffichées.
          </Text>
        ))}
    </Stack>
  );
}

/** Secrets en écriture seule : la valeur saisie part au serveur, qui ne rend que « défini » ou « non défini ». */
function Secrets({
  type,
  instance,
  onFait,
}: {
  type: TypeIntegrationDto;
  instance: IntegrationDto;
  onFait: () => Promise<void>;
}) {
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [definis, setDefinis] = useState<Record<string, boolean>>(instance.secrets);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const agir = async (fn: () => Promise<void>) => {
    setEnCours(true);
    setErreur(null);
    try {
      await fn();
      await onFait();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnCours(false);
    }
  };
  const saisis = Object.fromEntries(Object.entries(valeurs).filter(([, v]) => v));
  return (
    <Stack gap="xs" role="group" aria-label="Secrets du connecteur">
      <Text fw={600}>Secrets</Text>
      <Text size="sm" c="dimmed">
        Scellés par le coffre du serveur, jamais réaffichés ni journalisés ; seul l’exécutant d’exploitation les reçoit,
        au moment de l’appel.
      </Text>
      <ErrorAlert error={erreur} />
      {type.secrets.map((s) => (
        <Group key={s.id} align="flex-end">
          <PasswordInput
            label={`${s.libelle} (${libelleSecret(definis[s.id] === true).toLowerCase()})`}
            description={s.aide}
            value={valeurs[s.id] ?? ''}
            onChange={(e) => setValeurs({ ...valeurs, [s.id]: e.currentTarget.value })}
            autoComplete="new-password"
          />
          {definis[s.id] && (
            <Button
              variant="light"
              color="red"
              loading={enCours}
              onClick={() =>
                void agir(async () => {
                  await api('DELETE', `/api/integrations/instances/${instance.id}/secrets/${s.id}`);
                  setDefinis({ ...definis, [s.id]: false });
                  notifications.show({ color: 'teal', message: `${s.libelle} retirée.` });
                })
              }
            >
              Retirer
            </Button>
          )}
        </Group>
      ))}
      <Group justify="flex-end">
        <Button
          variant="default"
          loading={enCours}
          disabled={!Object.keys(saisis).length}
          onClick={() =>
            void agir(async () => {
              await api('PUT', `/api/integrations/instances/${instance.id}/secrets`, { body: saisis });
              setDefinis({ ...definis, ...Object.fromEntries(Object.keys(saisis).map((k) => [k, true])) });
              setValeurs({});
              notifications.show({ color: 'teal', message: 'Secrets enregistrés.' });
            })
          }
        >
          Enregistrer les secrets
        </Button>
      </Group>
    </Stack>
  );
}

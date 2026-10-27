/* Page Paramètres : pleine page, une section par thème, chacune avec son propre enregistrement (version, If-Match)
   et l'indication des modifications non enregistrées. Grand écran : navigation latérale ; tablette et téléphone :
   sélecteur de section en haut, champs en pleine largeur. */
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  FileButton,
  Group,
  Image,
  PasswordInput,
  NavLink,
  NumberInput,
  Radio,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  TagsInput,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  FENETRE_MAINTENANCE_DEFAUT,
  FenetreMaintenance,
  JOURS_SEMAINE,
  libelleFenetre,
  SETTINGS_LABELS,
  SETTINGS_SECTIONS,
  type ApercuConservation,
  type TestCourrielDto,
  type SettingsSection,
  type SettingsSectionOut,
} from '@suivi/shared';
import { ConfirmDialog, FormSection, Page, PageHeader, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, ApiError, download, errorMessage, get } from '../api';
import { CopyCommand, ErrorAlert } from '../components/common';
import { usePresence } from '../realtime';
import { ME_KEY, useCan, useMe } from '../session';

const DESCRIPTIONS: Record<SettingsSection, string> = {
  general: 'Identité de l’organisation : nom, logo et coordonnées affichés dans l’application.',
  cycle: 'Années du cycle de certification, prochain audit et audit interne.',
  referentiels: 'Référentiels chargés et référentiel complémentaire actif.',
  apparence: 'Thème et densité par défaut pour l’organisation.',
  notifications:
    'Délais d’alerte avant une échéance. Qui reçoit quoi, dans l’application et par courriel, se règle dans « Destinataires des notifications » et dans Mon compte.',
  import_export: 'Reprise des données de l’ancien outil et exports.',
  sauvegardes:
    'Suivi des sauvegardes et des tests de restauration (les sauvegardes elles-mêmes sont faites sur le serveur).',
  courriel:
    'Envoi de courriels par SMTP ou SMTPS, contact technique et message de test réel. Le mot de passe est scellé et jamais relu.',
  conservation:
    'Durées de conservation par catégorie. Aucune suppression n’est automatique : les durées servent à l’aperçu de ce qui serait candidat à une purge.',
  securite: 'Politique de mots de passe, durée des sessions et double authentification.',
};

export function SettingsPage() {
  const can = useCan();
  const visible = SETTINGS_SECTIONS.filter((s) => s !== 'cycle' || can('audit', 'lire'))
    .filter((s) => s !== 'referentiels' || can('conformite', 'lire'))
    .filter((s) => s !== 'import_export' || can('import_export', 'lire'));
  const params = useParams();
  const nav = useNavigate();
  const current = (visible as readonly string[]).includes(params.section ?? '')
    ? (params.section as SettingsSection)
    : 'general';
  usePresence(`parametres/${current}`);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<SettingsSection | null>(null);
  const go = (s: SettingsSection) => {
    if (s === current) return;
    if (dirty) setPending(s);
    else nav(`/parametres/${s}`);
  };
  const options = [
    ...visible.map((s) => ({ value: s as string, label: SETTINGS_LABELS[s] })),
    { value: 'configuration-grc', label: 'Configuration GRC' },
  ];

  return (
    <Page>
      <PageHeader title="Paramètres" description="Chaque section s’enregistre séparément." />
      <div className="settings">
        <nav className="settings-nav" aria-label="Sections des paramètres">
          {visible.map((s) => (
            <NavLink
              key={s}
              label={SETTINGS_LABELS[s]}
              active={s === current}
              onClick={() => go(s)}
              component="button"
            />
          ))}
          <NavLink component={Link} to="/parametres/configuration-grc" label="Configuration GRC" />
        </nav>
        <Select
          className="settings-select"
          label="Section"
          data={options}
          value={current}
          onChange={(v) =>
            v && (v === 'configuration-grc' ? nav('/parametres/configuration-grc') : go(v as SettingsSection))
          }
          allowDeselect={false}
        />
        <div className="settings-content grille-formulaire">
          <SectionLoader key={current} section={current} onDirty={setDirty} />
        </div>
      </div>
      <ConfirmDialog
        opened={!!pending}
        title="Modifications non enregistrées"
        message="Quitter cette section sans enregistrer ? Vos modifications seront perdues."
        confirmLabel="Quitter sans enregistrer"
        color="orange"
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) {
            setDirty(false);
            nav(`/parametres/${pending}`);
          }
        }}
      />
    </Page>
  );
}

/* ---------------------------------------------------------------- Chargement et enregistrement d'une section */
export function SectionLoader({ section, onDirty }: { section: SettingsSection; onDirty: (d: boolean) => void }) {
  const q = useQuery({
    queryKey: ['settings', section],
    queryFn: () => get<SettingsSectionOut>(`/api/settings/${section}`),
  });
  if (q.error) return <ErrorAlert error={q.error} />;
  if (!q.data) return null;
  return <SectionForm key={q.data.version} data={q.data} onDirty={onDirty} />;
}

function SectionForm({ data, onDirty }: { data: SettingsSectionOut; onDirty: (d: boolean) => void }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, unknown>>(data.values);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(data.values);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  const set = (k: string, v: unknown) => setValues((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const out = await api<SettingsSectionOut>('PUT', `/api/settings/${data.section}`, {
        body: values,
        ifMatch: data.version,
      });
      qc.setQueryData(['settings', data.section], out);
      if (['general', 'apparence', 'securite'].includes(data.section)) await qc.invalidateQueries({ queryKey: ME_KEY });
      notifications.show({ color: 'teal', message: `${SETTINGS_LABELS[data.section]} : enregistré.` });
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 412
          ? `${e.message} Vos modifications ne sont pas enregistrées.`
          : errorMessage(e),
      );
    } finally {
      setSaving(false);
    }
  };
  const ro = !data.canWrite;
  const props = { values, set, ro, info: data.info ?? {} };
  return (
    <FormSection
      title={SETTINGS_LABELS[data.section]}
      description={DESCRIPTIONS[data.section]}
      dirty={dirty}
      saving={saving}
      canSave={data.canWrite}
      readOnlyReason="Consultation seule : vos droits ne permettent pas de modifier cette section."
      onSave={save}
      onReset={() => setValues(data.values)}
      error={error}
    >
      {SECTIONS[data.section](props)}
    </FormSection>
  );
}

interface P {
  values: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  ro: boolean;
  info: Record<string, unknown>;
}
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' ? v : 0);

function Text2({ p, k, label, ...rest }: { p: P; k: string; label: string; type?: string; description?: string }) {
  return (
    <TextInput
      label={label}
      value={str(p.values[k])}
      onChange={(e) => p.set(k, e.currentTarget.value)}
      disabled={p.ro}
      {...rest}
    />
  );
}
function Num({
  p,
  k,
  label,
  min,
  max,
  description,
}: {
  p: P;
  k: string;
  label: string;
  min: number;
  max: number;
  description?: string;
}) {
  return (
    <NumberInput
      label={label}
      description={description}
      value={num(p.values[k])}
      onChange={(v) => p.set(k, typeof v === 'number' ? v : Number(v) || 0)}
      min={min}
      max={max}
      allowDecimal={false}
      disabled={p.ro}
    />
  );
}

/** Courriel : paramètres SMTP/SMTPS, mot de passe scellé (écriture seule) et message de test réel vers le contact technique. */
function CourrielForm({ p }: { p: P }) {
  const [defini, setDefini] = useState(p.info.motDePasseDefini === true);
  const [mdp, setMdp] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [test, setTest] = useState<TestCourrielDto | null>(null);
  const enCours = test?.status === 'en_attente' || test?.status === 'en_cours';
  useEffect(() => {
    if (!test || !enCours) return;
    const id = window.setInterval(() => {
      get<TestCourrielDto>(`/api/settings/courriel/test/${test.id}`)
        .then(setTest)
        .catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(id);
  }, [test, enCours]);
  const [erreur, setErreur] = useState<unknown>(null);
  const agir = async (fn: () => Promise<void>) => {
    setEnvoi(true);
    setErreur(null);
    try {
      await fn();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Stack>
      <Alert color="blue" title="L’exécutant d’exploitation envoie les courriels">
        Le serveur d’application n’a pas d’accès à Internet : c’est l’exécutant d’exploitation du serveur (le même que
        pour les sauvegardes) qui se connecte au serveur SMTP. Tout se règle ici, sans fichier à modifier.
      </Alert>
      <Switch
        label="Activer l’envoi de courriels"
        checked={p.values.actif === true}
        onChange={(e) => p.set('actif', e.currentTarget.checked)}
        disabled={p.ro}
      />
      <div className="grille-formulaire__champs">
        <Text2 p={p} k="hote" label="Serveur SMTP (nom d’hôte)" />
        <Num p={p} k="port" label="Port" min={1} max={65535} />
        <Select
          label="Chiffrement"
          description="Un échange sans chiffrement n’est pas proposé."
          allowDeselect={false}
          data={[
            { value: 'starttls', label: 'SMTP avec STARTTLS (en général port 587)' },
            { value: 'smtps', label: 'SMTPS, TLS implicite (en général port 465)' },
          ]}
          value={str(p.values.securite) || 'starttls'}
          onChange={(v) => v && p.set('securite', v)}
          disabled={p.ro}
        />
        <Text2 p={p} k="utilisateur" label="Compte (laisser vide pour un relais sans authentification)" />
        <Text2 p={p} k="expediteur" label="Adresse d’expédition" type="email" />
        <Text2
          p={p}
          k="contactTechnique"
          label="Contact technique"
          type="email"
          description="Reçoit les alertes d’exploitation et le message de test ; distinct des rappels métier."
        />
        <Num
          p={p}
          k="relanceEssais"
          label="Essais par notification"
          min={1}
          max={10}
          description="Premier envoi compris. 1 : aucune relance. Une notification dont l’envoi échoue de façon passagère est renvoyée automatiquement."
        />
        <Num
          p={p}
          k="relanceDelaiMinutes"
          label="Délai avant la première relance (minutes)"
          min={1}
          max={1440}
          description="Doublé à chaque nouvel échec, sans dépasser 24 heures."
        />
      </div>
      <Textarea
        label="Autorité de certification du serveur SMTP (facultatif)"
        description="Pour un relais interne dont le certificat est signé par une autorité privée : collez son certificat PEM. Vide : autorités reconnues du système."
        autosize
        minRows={2}
        maxRows={8}
        value={str(p.values.autoriteCertification)}
        onChange={(e) => p.set('autoriteCertification', e.currentTarget.value)}
        disabled={p.ro}
        spellCheck={false}
      />
      <Stack gap="xs" role="group" aria-label="Mot de passe du compte SMTP">
        <Text fw={600}>Mot de passe du compte</Text>
        <Text size="sm" c="dimmed">
          {defini ? 'Un mot de passe est enregistré (scellé, jamais affiché).' : 'Aucun mot de passe enregistré.'}
        </Text>
        {!p.ro && (
          <Group align="flex-end">
            <PasswordInput
              label={defini ? 'Nouveau mot de passe' : 'Mot de passe'}
              value={mdp}
              onChange={(e) => setMdp(e.currentTarget.value)}
              autoComplete="new-password"
            />
            <Button
              variant="default"
              loading={envoi}
              disabled={!mdp}
              onClick={() =>
                void agir(async () => {
                  await api('PUT', '/api/settings/courriel/mot-de-passe', { body: { password: mdp } });
                  setMdp('');
                  setDefini(true);
                  notifications.show({ color: 'teal', message: 'Mot de passe enregistré.' });
                })
              }
            >
              Enregistrer le mot de passe
            </Button>
            {defini && (
              <Button
                variant="light"
                color="red"
                loading={envoi}
                onClick={() =>
                  void agir(async () => {
                    await api('DELETE', '/api/settings/courriel/mot-de-passe');
                    setDefini(false);
                    notifications.show({ color: 'teal', message: 'Mot de passe supprimé.' });
                  })
                }
              >
                Supprimer
              </Button>
            )}
          </Group>
        )}
      </Stack>
      {!p.ro && (
        <Stack gap="xs" role="group" aria-label="Message de test">
          <Text fw={600}>Message de test</Text>
          <Text size="sm" c="dimmed">
            Envoie un vrai message au contact technique, avec les paramètres enregistrés. Enregistrez d’abord vos
            modifications.
          </Text>
          <ErrorAlert error={erreur} />
          <Group>
            <Button
              loading={envoi || enCours}
              onClick={() =>
                void agir(async () => {
                  setTest(await api<TestCourrielDto>('POST', '/api/settings/courriel/test'));
                })
              }
            >
              Envoyer un message de test
            </Button>
          </Group>
          {test && (
            <Stack gap="2xs" role="region" aria-label="Résultat du test">
              {test.status === 'en_attente' && (
                <Text size="sm">
                  Demande envoyée à l’exécutant d’exploitation du serveur : il la prend en charge à son prochain passage
                  (en général moins d’une minute).
                </Text>
              )}
              {test.status === 'en_cours' && <Text size="sm">Envoi en cours…</Text>}
              {test.status === 'reussie' && <StatusChip etat="succes">Message accepté par le serveur</StatusChip>}
              {test.status === 'echec' && (
                <Alert color="red" role="alert" title="L’envoi a échoué">
                  {test.error}
                </Alert>
              )}
              {test.steps.map((e, i) => (
                <Text key={i} size="sm">
                  {e.ok ? 'OK' : 'Échec'} · {e.step} : {e.detail}
                </Text>
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  );
}

/** Une durée de conservation : « sans limite » (nul) ou un nombre de jours. */
function DureeConservation({ p, k, label }: { p: P; k: string; label: string }) {
  const v = p.values[k];
  const limitee = typeof v === 'number';
  return (
    <Group align="flex-end" gap="md">
      <Switch
        label={`${label} : limiter la durée`}
        checked={limitee}
        disabled={p.ro}
        onChange={(e) => p.set(k, e.currentTarget.checked ? 365 : null)}
      />
      {limitee && (
        <NumberInput
          aria-label={`${label} : durée en jours`}
          label="Durée (jours)"
          value={v}
          min={1}
          max={3650}
          allowDecimal={false}
          disabled={p.ro}
          onChange={(n) => p.set(k, typeof n === 'number' ? n : 365)}
        />
      )}
      {!limitee && (
        <Text size="sm" c="dimmed">
          Conservation sans limite
        </Text>
      )}
    </Group>
  );
}

/** Aperçu de ce qui serait candidat à une purge, d'après les durées enregistrées (lecture seule). */
function ApercuConservationPanel() {
  const section = useQuery({
    queryKey: ['settings', 'conservation'],
    queryFn: () => get<SettingsSectionOut>('/api/settings/conservation'),
  });
  const version = section.data?.version ?? 0;
  const q = useQuery({
    queryKey: ['settings', 'conservation', 'apercu', version],
    queryFn: () => get<ApercuConservation>('/api/settings/conservation/apercu'),
    enabled: !!section.data,
  });
  return (
    <Stack gap="xs" role="region" aria-label="Aperçu de conservation">
      <Text fw={600}>Aperçu de ce qui serait purgé</Text>
      <Text size="sm" c="dimmed">
        D’après les durées enregistrées. Enregistrez vos modifications pour mettre l’aperçu à jour.
      </Text>
      <ErrorAlert error={q.error} />
      {q.data && (
        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Catégorie</Table.Th>
              <Table.Th>Durée</Table.Th>
              <Table.Th>Candidats</Table.Th>
              <Table.Th>Dont protégés</Table.Th>
              <Table.Th>Plus ancien</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {q.data.categories.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>
                  {c.label}
                  <Text size="xs" c="dimmed">
                    {c.note}
                  </Text>
                  {c.exclusions.length > 0 && (
                    <Text size="xs" c="dimmed" component="div">
                      Non candidats :
                      <ul>
                        {c.exclusions.map((x) => (
                          <li key={x.motif}>
                            {x.motif} ({x.count})
                          </li>
                        ))}
                      </ul>
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{c.days === null ? 'Sans limite' : `${c.days} jours`}</Table.Td>
                <Table.Td>{c.candidates === null ? '—' : c.candidates}</Table.Td>
                <Table.Td>{c.candidates === null ? '—' : c.protectedCount}</Table.Td>
                <Table.Td>{c.oldest ? new Date(c.oldest).toLocaleDateString('fr-FR') : '—'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

/** Style global de l'instance : aperçu local tant que la section n'est pas enregistrée ; abandonné en quittant le panneau. */
function StyleGlobal({ p }: { p: P }) {
  const enregistre = useMe().appearance.style;
  const choisi = p.values.style === 'clair' ? 'clair' : 'sage';
  useEffect(() => {
    document.documentElement.dataset.style = choisi;
    return () => {
      document.documentElement.dataset.style = enregistre;
    };
  }, [choisi, enregistre]);
  return (
    <Radio.Group
      label="Style de l’application (global)"
      description="Pour tous les comptes de l’instance. Le thème clair, sombre ou automatique reste un choix personnel."
      value={choisi}
      onChange={(v) => p.set('style', v)}
    >
      <Stack gap="xs" mt="xs">
        <Radio
          value="sage"
          label="Référence 08 — Sauge"
          description="Fonds sauge chauds (par défaut)."
          disabled={p.ro}
        />
        <Radio
          value="clair"
          label="Clair bleuté"
          description="Fonds et bordures bleutés ; navigation vert profond conservée."
          disabled={p.ro}
        />
      </Stack>
    </Radio.Group>
  );
}

/* ---------------------------------------------------------------- Sections */
const SECTIONS: Record<SettingsSection, (p: P) => ReactNode> = {
  general: (p) => <General p={p} />,
  cycle: (p) => <Cycle p={p} />,
  referentiels: (p) => <Referentiels p={p} />,
  apparence: (p) => (
    <Stack>
      <Stack gap="2xs">
        <Text size="sm" fw={500}>
          Thème par défaut
        </Text>
        <SegmentedControl
          aria-label="Thème par défaut"
          data={[
            { value: 'auto', label: 'Automatique' },
            { value: 'clair', label: 'Clair' },
            { value: 'sombre', label: 'Sombre' },
          ]}
          value={str(p.values.theme)}
          onChange={(v) => p.set('theme', v)}
          disabled={p.ro}
        />
      </Stack>
      <Stack gap="2xs">
        <Text size="sm" fw={500}>
          Densité par défaut
        </Text>
        <SegmentedControl
          aria-label="Densité par défaut"
          data={[
            { value: 'compacte', label: 'Compacte' },
            { value: 'normale', label: 'Normale' },
            { value: 'confortable', label: 'Confortable' },
          ]}
          value={str(p.values.densite)}
          onChange={(v) => p.set('densite', v)}
          disabled={p.ro}
        />
      </Stack>
      <StyleGlobal p={p} />
      <Text size="sm" c="dimmed">
        Thème et densité s’appliquent à toute personne qui n’a pas choisi ses propres préférences d’affichage. Le style
        est le même pour tous les comptes.
      </Text>
    </Stack>
  ),
  notifications: (p) => (
    <div className="grille-formulaire__champs">
      <Num p={p} k="echeancesJours" label="Alerte avant une échéance (jours)" min={0} max={365} />
      <Num p={p} k="conventionJours" label="Alerte avant l’échéance d’une convention (jours)" min={0} max={365} />
      <Switch
        label="Signaler les imports de données aux administrateurs"
        checked={p.values.alerterImports === true}
        onChange={(e) => p.set('alerterImports', e.currentTarget.checked)}
        disabled={p.ro}
      />
      <Switch
        label="Signaler les modifications de droits aux administrateurs"
        checked={p.values.alerterDroits === true}
        onChange={(e) => p.set('alerterDroits', e.currentTarget.checked)}
        disabled={p.ro}
      />
    </div>
  ),
  import_export: (p) => <ImportExport p={p} />,
  sauvegardes: (p) => (
    <Stack>
      {p.info.enRetard === true ? (
        <Alert color="orange" title="Test de restauration à faire">
          {p.values.dernierTestRestauration
            ? `Le prochain test était prévu le ${str(p.info.prochainTest)}.`
            : 'Aucun test de restauration n’est enregistré.'}{' '}
          Une sauvegarde qui n’a jamais été restaurée n’est pas une sauvegarde (guide d’installation, étape 11.4).
        </Alert>
      ) : (
        <StatusChip etat="succes">Prochain test de restauration : {str(p.info.prochainTest)}</StatusChip>
      )}
      <div className="grille-formulaire__champs">
        <Text2 p={p} k="emplacement" label="Emplacement des sauvegardes sur le serveur" />
        <Text2 p={p} k="dernierTestRestauration" label="Date du dernier test de restauration" type="date" />
        <Num p={p} k="frequenceTestMois" label="Fréquence des tests de restauration (mois)" min={1} max={36} />
      </div>
      <Text size="sm">Sauvegarde manuelle, depuis le dossier de l’application sur le serveur :</Text>
      <CopyCommand
        command={`sudo BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh ${str(p.values.emplacement) || '/srv/sauvegardes/suivi-audits'}`}
      />
    </Stack>
  ),
  conservation: (p) => (
    <Stack>
      <Alert color="blue" title="Aucune suppression automatique">
        Régler une durée ne supprime rien. L’aperçu ci-dessous dit seulement ce qui serait candidat à une purge. Le
        journal d’audit est immuable et n’est jamais concerné.
      </Alert>
      <DureeConservation p={p} k="documentsCorbeilleJours" label="Documents dans la corbeille" />
      <DureeConservation p={p} k="rappelsLusJours" label="Rappels déjà lus" />
      <DureeConservation p={p} k="elementsArchivesJours" label="Éléments archivés (fiches, registres)" />
      <ApercuConservationPanel />
    </Stack>
  ),
  courriel: (p) => <CourrielForm p={p} />,
  securite: (p) => (
    <Stack>
      <div className="grille-formulaire__champs">
        <Num
          p={p}
          k="passwordMinLength"
          label="Longueur minimale des mots de passe"
          min={12}
          max={64}
          description="12 au minimum."
        />
        <Num p={p} k="sessionIdleMinutes" label="Fermeture après inactivité (minutes)" min={5} max={240} />
        <Num p={p} k="sessionMaxHours" label="Durée maximale d’une session (heures)" min={1} max={24} />
        <Num p={p} k="lockoutThreshold" label="Échecs avant verrouillage du compte" min={3} max={10} />
        <Num p={p} k="lockoutMinutes" label="Durée du verrouillage (minutes)" min={5} max={1440} />
      </div>
      <Switch
        label="Double authentification obligatoire"
        description="Toujours active : exigence de sécurité non négociable."
        checked
        disabled
        readOnly
      />
      <Text size="sm" c="dimmed">
        Les nouvelles valeurs s’appliquent immédiatement : aux prochaines connexions pour les sessions, au prochain
        changement de mot de passe pour la longueur minimale.
      </Text>
      <FenetreMaintenanceForm p={p} />
    </Stack>
  ),
};

/** Créneau d'installation des mises à jour (heure de Paris) : hors créneau, l'installation est refusée par le serveur. */
function FenetreMaintenanceForm({ p }: { p: P }) {
  const lu = FenetreMaintenance.safeParse(p.values.fenetreMaintenance);
  const f = lu.success
    ? lu.data
    : { ...FENETRE_MAINTENANCE_DEFAUT, ...(p.values.fenetreMaintenance as Partial<FenetreMaintenance>) };
  const set = (changes: Partial<FenetreMaintenance>) => p.set('fenetreMaintenance', { ...f, ...changes });
  return (
    <Stack gap="xs">
      <Text fw={600}>Fenêtre de maintenance des mises à jour</Text>
      <Switch
        label="Limiter l’installation des mises à jour à un créneau"
        description="Hors créneau, le serveur refuse l’installation ; la vérification des nouvelles versions reste possible."
        checked={f.active}
        disabled={p.ro}
        onChange={(e) => set({ active: e.currentTarget.checked })}
      />
      <Checkbox.Group
        label="Jours autorisés"
        value={f.jours.map(String)}
        onChange={(v) => set({ jours: v.map(Number).sort((a, b) => a - b) })}
      >
        <Group gap="sm">
          {JOURS_SEMAINE.map((j, i) => (
            <Checkbox key={j} value={String(i + 1)} label={j} disabled={p.ro || !f.active} />
          ))}
        </Group>
      </Checkbox.Group>
      <div className="grille-formulaire__champs">
        <TextInput
          type="time"
          label="Début (heure de Paris)"
          value={f.debut}
          disabled={p.ro || !f.active}
          onChange={(e) => set({ debut: e.currentTarget.value.slice(0, 5) })}
        />
        <TextInput
          type="time"
          label="Fin (heure de Paris)"
          description="Une fin avant le début passe minuit."
          value={f.fin}
          disabled={p.ro || !f.active}
          onChange={(e) => set({ fin: e.currentTarget.value.slice(0, 5) })}
        />
      </div>
      <Text size="sm" c="dimmed" role="status">
        {lu.success ? `Créneau : ${libelleFenetre(f)}` : 'Créneau incomplet : vérifiez les jours et les heures.'}
      </Text>
    </Stack>
  );
}

function General({ p }: { p: P }) {
  const qc = useQueryClient();
  const [stamp, setStamp] = useState(0);
  const hasLogo = p.info.logo === true;
  const refresh = async () => {
    setStamp(Date.now());
    await qc.invalidateQueries({ queryKey: ['settings', 'general'] });
  };
  return (
    <Stack>
      <div className="grille-formulaire__champs">
        <Text2 p={p} k="appName" label="Nom de l’application" />
        <Text2 p={p} k="orgName" label="Organisation" />
        <Text2 p={p} k="rssi" label="RSSI (nom ou fonction)" />
        <Text2 p={p} k="email" label="Adresse e-mail de contact" type="email" />
        <Text2 p={p} k="telephone" label="Téléphone" />
        <Text2 p={p} k="site" label="Site web" />
      </div>
      <Textarea
        label="Adresse postale"
        value={str(p.values.adresse)}
        onChange={(e) => p.set('adresse', e.currentTarget.value)}
        disabled={p.ro}
        autosize
        minRows={2}
      />
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          Logo (PNG ou JPEG, 256 Ko au plus)
        </Text>
        {hasLogo ? (
          <Image
            src={`/api/settings/logo?v=${stamp}`}
            alt="Logo de l’organisation"
            className="settings-logo"
            fit="contain"
          />
        ) : (
          <Text size="sm" c="dimmed">
            Aucun logo.
          </Text>
        )}
        {!p.ro && (
          <Group gap="xs">
            <FileButton
              accept="image/png,image/jpeg"
              onChange={async (f) => {
                if (!f) return;
                try {
                  await api('PUT', '/api/settings/logo', { raw: await f.arrayBuffer() });
                  notifications.show({ color: 'teal', message: 'Logo enregistré.' });
                  await refresh();
                } catch (e) {
                  notifications.show({ color: 'red', message: errorMessage(e) });
                }
              }}
            >
              {(fp) => (
                <Button variant="light" {...fp}>
                  {hasLogo ? 'Changer le logo' : 'Ajouter un logo'}
                </Button>
              )}
            </FileButton>
            {hasLogo && (
              <Button
                variant="default"
                onClick={async () => {
                  await api('DELETE', '/api/settings/logo').catch(() => {});
                  await refresh();
                }}
              >
                Retirer le logo
              </Button>
            )}
          </Group>
        )}
      </Stack>
    </Stack>
  );
}

function Cycle({ p }: { p: P }) {
  const years = (Array.isArray(p.values.years) ? p.values.years : []) as number[];
  const labels = (p.values.yearLabels ?? {}) as Record<string, string>;
  return (
    <Stack>
      <TagsInput
        label="Années du cycle de certification"
        description="Saisissez une année puis Entrée (par exemple 2026)."
        value={years.map(String)}
        onChange={(v) =>
          p.set(
            'years',
            [...new Set(v.map((x) => parseInt(x, 10)).filter((n) => n >= 2000 && n <= 2100))].sort((a, b) => a - b),
          )
        }
        disabled={p.ro}
      />
      {years.length > 0 && (
        <div className="grille-formulaire__champs">
          {years.map((y) => (
            <TextInput
              key={y}
              label={`Libellé de l’année ${y}`}
              placeholder="Audit initial, surveillance 1…"
              value={labels[String(y)] ?? ''}
              onChange={(e) => p.set('yearLabels', { ...labels, [String(y)]: e.currentTarget.value })}
              disabled={p.ro}
            />
          ))}
        </div>
      )}
      <div className="grille-formulaire__champs">
        <Select
          label="Année du prochain audit"
          data={years.map(String)}
          value={p.values.nextYear == null ? null : String(p.values.nextYear)}
          onChange={(v) => p.set('nextYear', v ? parseInt(v, 10) : null)}
          disabled={p.ro}
          clearable
        />
        <Text2 p={p} k="nextDate" label="Date du prochain audit" type="date" />
        <Text2 p={p} k="internalDate" label="Date de l’audit interne" type="date" />
      </div>
      <Switch
        label="Organisation certifiée ISO 27001"
        checked={p.values.iso27001Certified === true}
        onChange={(e) => p.set('iso27001Certified', e.currentTarget.checked)}
        disabled={p.ro}
      />
    </Stack>
  );
}

function Referentiels({ p }: { p: P }) {
  const refs = (p.info.referentiels ?? []) as { nom: string; exigences: number }[];
  const comp = (p.info.complementaires ?? []) as { nom: string; exigences: number }[];
  return (
    <Stack>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Référentiel</Table.Th>
            <Table.Th className="chiffres">Exigences</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[...refs, ...comp].map((r) => (
            <Table.Tr key={r.nom}>
              <Table.Td>{r.nom}</Table.Td>
              <Table.Td className="chiffres">{r.exigences}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <div className="grille-formulaire__champs">
        <Select
          label="Référentiel complémentaire actif"
          data={comp.map((c) => c.nom)}
          value={str(p.values.activeFw) || null}
          onChange={(v) => p.set('activeFw', v ?? '')}
          disabled={p.ro}
          clearable
          placeholder={comp.length ? 'Aucun' : 'Aucun référentiel complémentaire chargé'}
        />
        <Select
          label="Catégorie d’entité (NIS 2)"
          data={[
            { value: '', label: 'Non renseignée' },
            { value: 'essentielle', label: 'Entité essentielle' },
            { value: 'importante', label: 'Entité importante' },
            { value: 'hors_champ', label: 'Hors champ' },
          ]}
          value={str(p.values.entityCategory)}
          onChange={(v) => p.set('entityCategory', v ?? '')}
          disabled={p.ro}
          allowDeselect={false}
        />
      </div>
    </Stack>
  );
}

function ImportExport({ p }: { p: P }) {
  const can = useCan();
  return (
    <Stack>
      <Select
        label="Format par défaut de la revue des accès"
        data={[
          { value: 'xlsx', label: 'Excel (.xlsx)' },
          { value: 'csv', label: 'CSV' },
        ]}
        value={str(p.values.formatRevue)}
        onChange={(v) => v && p.set('formatRevue', v)}
        disabled={p.ro}
        allowDeselect={false}
        className="champ-l"
      />
      <Text size="sm">
        Taille maximale d’un fichier importé : {num(p.info.tailleMaxImportMo)} Mo. Imports réalisés :{' '}
        <span className="chiffres">{num(p.info.imports)}</span>.
      </Text>
      <Group gap="xs">
        {can('import_export', 'lire') && (
          <Anchor component={Link} to="/admin/import">
            Ouvrir l’import des données de l’ancien outil
          </Anchor>
        )}
        {can('import_export', 'exporter') && (
          <Button variant="light" onClick={() => download('/api/admin/export/legacy')}>
            Exporter au format legacy
          </Button>
        )}
      </Group>
    </Stack>
  );
}

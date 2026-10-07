/* Page Paramètres : pleine page, une section par thème, chacune avec son propre enregistrement (version, If-Match)
   et l'indication des modifications non enregistrées. Grand écran : navigation latérale ; tablette et téléphone :
   sélecteur de section en haut, champs en pleine largeur. */
import {
  Alert,
  Anchor,
  Button,
  FileButton,
  Group,
  Image,
  NavLink,
  NumberInput,
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
import { SETTINGS_LABELS, SETTINGS_SECTIONS, type SettingsSection, type SettingsSectionOut } from '@suivi/shared';
import { ConfirmDialog, FormSection, Page, PageHeader, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, ApiError, download, errorMessage, get } from '../api';
import { CopyCommand, ErrorAlert } from '../components/common';
import { usePresence } from '../realtime';
import { ME_KEY, useCan } from '../session';

const DESCRIPTIONS: Record<SettingsSection, string> = {
  general: 'Identité de l’organisation : nom, logo et coordonnées affichés dans l’application.',
  cycle: 'Années du cycle de certification, prochain audit et audit interne.',
  referentiels: 'Référentiels chargés et référentiel complémentaire actif.',
  apparence: 'Thème et densité par défaut pour l’organisation.',
  notifications: 'Alertes affichées dans l’application (aucun envoi d’e-mail : le serveur n’a pas d’accès sortant).',
  import_export: 'Reprise des données de l’ancien outil et exports.',
  sauvegardes:
    'Suivi des sauvegardes et des tests de restauration (les sauvegardes elles-mêmes sont faites sur le serveur).',
  securite: 'Politique de mots de passe, durée des sessions et double authentification.',
};

export function SettingsPage() {
  const params = useParams();
  const nav = useNavigate();
  const current = (SETTINGS_SECTIONS as readonly string[]).includes(params.section ?? '')
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
  const options = SETTINGS_SECTIONS.map((s) => ({ value: s, label: SETTINGS_LABELS[s] }));

  return (
    <Page>
      <PageHeader title="Paramètres" description="Chaque section s’enregistre séparément." />
      <div className="settings">
        <nav className="settings-nav" aria-label="Sections des paramètres">
          {SETTINGS_SECTIONS.map((s) => (
            <NavLink
              key={s}
              label={SETTINGS_LABELS[s]}
              active={s === current}
              onClick={() => go(s)}
              component="button"
            />
          ))}
        </nav>
        <Select
          className="settings-select"
          label="Section"
          data={options}
          value={current}
          onChange={(v) => v && go(v as SettingsSection)}
          allowDeselect={false}
        />
        <div className="settings-content">
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
function SectionLoader({ section, onDirty }: { section: SettingsSection; onDirty: (d: boolean) => void }) {
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
      <Text size="sm" c="dimmed">
        Valeurs appliquées à toute personne qui n’a pas choisi ses propres préférences d’affichage.
      </Text>
    </Stack>
  ),
  notifications: (p) => (
    <div className="grid-2">
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
      <div className="grid-2">
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
  securite: (p) => (
    <Stack>
      <div className="grid-2">
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
    </Stack>
  ),
};

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
      <div className="grid-2">
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
        <div className="grid-2">
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
      <div className="grid-2">
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
      <div className="grid-2">
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

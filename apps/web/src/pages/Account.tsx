/* Mon compte : affichage (taille, densité, thème), mot de passe, double authentification, sessions ouvertes. */
import {
  Alert,
  Badge,
  Button,
  Card,
  PasswordInput,
  PinInput,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { TAILLE_LABELS, TAILLES, type Preferences } from '@suivi/shared';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import qrcode from 'qrcode-generator';
import { useState } from 'react';
import { errorMessage, get, post } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';
import { usePresence } from '../realtime';
import { useMe, usePreferences, useRefreshMe } from '../session';

interface MySession {
  id: string;
  ip: string | null;
  user_agent: string;
  created_at: string;
  last_seen_at: string;
  current: boolean;
}

export function AccountPage() {
  const me = useMe();
  usePresence('account');
  return (
    <Stack className="page">
      <Title order={1}>Mon compte</Title>
      <Text c="dimmed">
        {me.user?.displayName} ({me.user?.username})
      </Text>
      <AffichageCard />
      <PasswordCard minLen={me.passwordMinLength} />
      <TotpCard />
      <SessionsCard />
    </Stack>
  );
}

const DENSITES = [
  { value: 'organisation', label: 'Organisation' },
  { value: 'compacte', label: 'Compacte' },
  { value: 'normale', label: 'Normale' },
  { value: 'confortable', label: 'Confortable' },
];
const THEMES = [
  { value: 'organisation', label: 'Organisation' },
  { value: 'auto', label: 'Système' },
  { value: 'clair', label: 'Clair' },
  { value: 'sombre', label: 'Sombre' },
];

/** Préférences d'affichage : enregistrées sur le serveur, appliquées sur tous les appareils de la personne. */
function AffichageCard() {
  const { prefs, save } = usePreferences();
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Preferences>) => {
    setErr(null);
    save(patch).catch((e: unknown) => setErr(errorMessage(e)));
  };
  return (
    <Card withBorder>
      <Title order={2} size="h4" mb="xs">
        Affichage
      </Title>
      <Text size="sm" c="dimmed" mb="sm" className="lecture">
        Enregistré sur le serveur : vos choix s’appliquent sur tous vos appareils. Le zoom du navigateur et la mise à
        l’échelle du système restent pris en compte.
      </Text>
      <Stack className="formulaire">
        <Select
          label="Taille d’affichage"
          description="« Automatique » agrandit le texte sur les très grands écrans (au-delà de 2560 px)."
          data={TAILLES.map((t) => ({ value: t, label: TAILLE_LABELS[t] }))}
          value={prefs.taille}
          allowDeselect={false}
          onChange={(v) => v && set({ taille: v as Preferences['taille'] })}
        />
        <div>
          <Text size="sm" fw={500} mb="2xs" id="densite-label">
            Densité
          </Text>
          <SegmentedControl
            aria-labelledby="densite-label"
            fullWidth
            data={DENSITES}
            value={prefs.densite}
            onChange={(v) => set({ densite: v as Preferences['densite'] })}
          />
        </div>
        <div>
          <Text size="sm" fw={500} mb="2xs" id="theme-label">
            Thème
          </Text>
          <SegmentedControl
            aria-labelledby="theme-label"
            fullWidth
            data={THEMES}
            value={prefs.theme}
            onChange={(v) => set({ theme: v as Preferences['theme'] })}
          />
        </div>
        {err && <Alert color="red">{err}</Alert>}
      </Stack>
    </Card>
  );
}

function PasswordCard({ minLen }: { minLen: number }) {
  const refresh = useRefreshMe();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card withBorder>
      <Title order={2} size="h4" mb="sm">
        Mot de passe
      </Title>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          if (f.next !== f.confirm) return setErr('Les deux saisies ne correspondent pas.');
          setBusy(true);
          try {
            await post('/api/account/password', { current: f.current, next: f.next });
            await refresh();
            setF({ current: '', next: '', confirm: '' });
            notifications.show({
              color: 'teal',
              message: 'Mot de passe modifié. Vos autres sessions ont été fermées.',
            });
          } catch (x) {
            setErr(errorMessage(x));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Stack className="formulaire">
          <PasswordInput
            label="Mot de passe actuel"
            autoComplete="current-password"
            required
            value={f.current}
            onChange={(e) => setF({ ...f, current: e.currentTarget.value })}
          />
          <PasswordInput
            label="Nouveau mot de passe"
            description={`Au moins ${minLen} caractères et 3 types de caractères.`}
            autoComplete="new-password"
            required
            value={f.next}
            onChange={(e) => setF({ ...f, next: e.currentTarget.value })}
          />
          <PasswordInput
            label="Confirmation"
            autoComplete="new-password"
            required
            value={f.confirm}
            onChange={(e) => setF({ ...f, confirm: e.currentTarget.value })}
          />
          {err && <Alert color="red">{err}</Alert>}
          <Button type="submit" loading={busy} w="fit-content">
            Changer le mot de passe
          </Button>
        </Stack>
      </form>
    </Card>
  );
}

function TotpCard() {
  const refresh = useRefreshMe();
  const [pw, setPw] = useState('');
  const [data, setData] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const img = (() => {
    if (!data) return null;
    const q = qrcode(0, 'M');
    q.addData(data.uri);
    q.make();
    return q.createDataURL(6, 2);
  })();
  return (
    <Card withBorder>
      <Title order={2} size="h4" mb="xs">
        Double authentification
      </Title>
      <Text size="sm" c="dimmed" mb="sm">
        Active et obligatoire. Pour changer de téléphone, configurez le nouveau ci-dessous (votre mot de passe est
        demandé).
      </Text>
      {!data ? (
        <Stack className="formulaire">
          <PasswordInput
            label="Mot de passe"
            value={pw}
            onChange={(e) => setPw(e.currentTarget.value)}
            autoComplete="current-password"
          />
          <Button
            variant="light"
            w="fit-content"
            onClick={() =>
              post<{ secret: string; uri: string }>('/api/account/totp/begin', { password: pw })
                .then((d) => {
                  setData(d);
                  setErr(null);
                })
                .catch((x) => setErr(errorMessage(x)))
            }
          >
            Configurer un nouveau téléphone
          </Button>
        </Stack>
      ) : (
        <Stack className="formulaire">
          {img && (
            <div className="qr">
              <img src={img} alt="QR code de configuration" />
            </div>
          )}
          <PinInput
            length={6}
            type="number"
            oneTimeCode
            value={code}
            onChange={setCode}
            aria-label="Code à 6 chiffres"
            getInputProps={(i) => ({ 'aria-label': `Chiffre ${i + 1} sur 6` })}
          />
          <Button
            w="fit-content"
            disabled={code.length !== 6}
            onClick={() =>
              post('/api/account/totp/confirm', { code })
                .then(async () => {
                  await refresh();
                  setData(null);
                  setCode('');
                  notifications.show({ color: 'teal', message: 'Nouveau téléphone configuré.' });
                })
                .catch((x) => setErr(errorMessage(x)))
            }
          >
            Valider
          </Button>
        </Stack>
      )}
      {err && (
        <Alert color="red" mt="sm">
          {err}
        </Alert>
      )}
    </Card>
  );
}

function SessionsCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['account', 'sessions'], queryFn: () => get<MySession[]>('/api/account/sessions') });
  return (
    <Card withBorder>
      <Title order={2} size="h4" mb="sm">
        Sessions ouvertes
      </Title>
      <ErrorAlert error={q.error} />
      <div className="table-wrap" role="region" aria-label="Sessions ouvertes" tabIndex={0}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Navigateur</Table.Th>
              <Table.Th>Adresse IP</Table.Th>
              <Table.Th>Dernière activité</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(q.data ?? []).map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>
                  {s.user_agent.slice(0, 80) || '—'} {s.current && <Badge size="xs">cette session</Badge>}
                </Table.Td>
                <Table.Td className="mono">{s.ip}</Table.Td>
                <Table.Td className="nowrap">{fmtDate(s.last_seen_at)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
      <Button
        mt="sm"
        variant="default"
        w="fit-content"
        onClick={() =>
          post('/api/account/sessions/revoke-others').then(() =>
            qc.invalidateQueries({ queryKey: ['account', 'sessions'] }),
          )
        }
      >
        Fermer mes autres sessions
      </Button>
    </Card>
  );
}

/* Connexion : mot de passe, puis double authentification (code TOTP), enrôlement TOTP, changement de mot de passe imposé. */
import {
  Alert,
  Button,
  Card,
  Group,
  PasswordInput,
  PinInput,
  Stack,
  Stepper,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import qrcode from 'qrcode-generator';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError, api, get, post, setCsrf } from '../api';
import { useMe, useRefreshMe } from '../session';

const safeNext = (n: string | null) => (n && /^\/(?!\/)/.test(n) ? n : '/');

function AuthCard({ title, step, children }: { title: string; step: number; children: ReactNode }) {
  return (
    <main className="auth-wrap">
      <section className="auth-editorial" aria-label="Suivi du SMSI">
        <span className="auth-kicker">ISO 27001 / HDS</span>
        <h2>
          Une vision claire.
          <br />
          Un pilotage serein.
        </h2>
        <p>Vos audits, vos preuves et vos actions, dans un même espace de travail.</p>
        <div className="auth-illustration" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="auth-caption">Système de management de la sécurité de l’information</span>
      </section>
      <Card className="auth-card" withBorder padding="xl" radius="lg">
        <Stack>
          <Group gap="xs">
            <span className="brand-mark" aria-hidden="true">
              S
            </span>
            <Text fw={700}>{useMe().appName}</Text>
          </Group>
          {step > 0 && (
            <Stepper active={step - 1} size="xs" aria-label="Étapes de connexion">
              <Stepper.Step label="Mot de passe" />
              <Stepper.Step label="Double authentification" />
              <Stepper.Step label="Accès" />
            </Stepper>
          )}
          <Title order={1} size="h2">
            {title}
          </Title>
          {children}
        </Stack>
      </Card>
    </main>
  );
}

export function LoginPage() {
  const me = useMe();
  const refresh = useRefreshMe();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setup = useQuery({
    queryKey: ['setup'],
    queryFn: () => get<{ needed: boolean; adminExists: boolean }>('/api/setup'),
    enabled: me.stage === 'anon',
  });

  useEffect(() => {
    if (me.stage === 'ok') nav(next, { replace: true });
  }, [me.stage, next, nav]);
  if (me.stage === 'anon' && setup.data?.needed && !setup.data.adminExists) return <Navigate to="/setup" replace />;

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const err = error && (
    <Alert color="red" role="alert">
      {error}
    </Alert>
  );
  const restart = (
    <Button
      variant="subtle"
      size="xs"
      onClick={() =>
        run(async () => {
          await api('POST', '/api/auth/logout');
          setCsrf(null);
        })
      }
    >
      Changer de compte
    </Button>
  );

  if (me.stage === 'mfa')
    return (
      <MfaForm busy={busy} err={err} restart={restart} onCode={(code) => run(() => post('/api/auth/mfa', { code }))} />
    );
  if (me.stage === 'enroll') return <EnrollForm busy={busy} err={err} restart={restart} run={run} />;
  if (me.stage === 'password') return <PasswordForm busy={busy} err={err} run={run} minLen={me.passwordMinLength} />;
  return (
    <PasswordLogin
      busy={busy}
      err={err}
      onLogin={(username, password) => run(() => post('/api/auth/login', { username, password }))}
    />
  );
}

function PasswordLogin({
  busy,
  err,
  onLogin,
}: {
  busy: boolean;
  err: ReactNode;
  onLogin: (u: string, p: string) => void;
}) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  return (
    <AuthCard title="Connexion" step={1}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onLogin(u.trim(), p);
        }}
      >
        <Stack>
          <TextInput
            label="Identifiant"
            autoComplete="username"
            required
            autoFocus
            value={u}
            onChange={(e) => setU(e.currentTarget.value)}
          />
          <PasswordInput
            label="Mot de passe"
            autoComplete="current-password"
            required
            value={p}
            onChange={(e) => setP(e.currentTarget.value)}
          />
          {err}
          <Button type="submit" loading={busy} fullWidth>
            Se connecter
          </Button>
        </Stack>
      </form>
      <Text size="xs" c="dimmed" ta="center">
        Mot de passe oublié ou compte verrouillé : contactez un administrateur.
      </Text>
    </AuthCard>
  );
}

function CodeInput({ onComplete, busy }: { onComplete: (c: string) => void; busy: boolean }) {
  const [code, setCode] = useState('');
  return (
    <Stack align="center">
      <PinInput
        length={6}
        type="number"
        oneTimeCode
        autoFocus
        size="lg"
        value={code}
        onChange={setCode}
        onComplete={(c) => onComplete(c)}
        aria-label="Code à 6 chiffres"
        getInputProps={(i) => ({ 'aria-label': `Chiffre ${i + 1} sur 6` })}
        disabled={busy}
      />
      <Button onClick={() => onComplete(code)} loading={busy} disabled={code.length !== 6} fullWidth>
        Valider
      </Button>
    </Stack>
  );
}

function MfaForm({
  busy,
  err,
  restart,
  onCode,
}: {
  busy: boolean;
  err: ReactNode;
  restart: ReactNode;
  onCode: (c: string) => void;
}) {
  return (
    <AuthCard title="Double authentification" step={2}>
      <Text size="sm" c="dimmed">
        Saisissez le code à 6 chiffres affiché par votre application d’authentification.
      </Text>
      <CodeInput onComplete={onCode} busy={busy} />
      {err}
      <Text size="xs" c="dimmed">
        Code refusé : vérifiez que l’heure du téléphone est automatique. Téléphone perdu : un administrateur peut
        réinitialiser votre double authentification.
      </Text>
      {restart}
    </AuthCard>
  );
}

function EnrollForm({
  busy,
  err,
  restart,
  run,
}: {
  busy: boolean;
  err: ReactNode;
  restart: ReactNode;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [data, setData] = useState<{ secret: string; uri: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    post<{ secret: string; uri: string }>('/api/account/totp/begin', {})
      .then(setData)
      .catch((e: Error) => setLoadError(e.message));
  }, []);
  const img = (() => {
    if (!data) return null;
    const q = qrcode(0, 'M');
    q.addData(data.uri);
    q.make();
    return q.createDataURL(6, 2);
  })();
  return (
    <AuthCard title="Activer la double authentification" step={2}>
      <Text size="sm">
        1. Scannez ce QR code avec une application d’authentification (Microsoft Authenticator, FreeOTP, Aegis…).
      </Text>
      {loadError && <Alert color="red">{loadError}</Alert>}
      {img && (
        <div className="qr">
          <img src={img} alt="QR code de configuration de la double authentification" />
        </div>
      )}
      {data && (
        <Text size="xs" c="dimmed">
          Saisie manuelle : <span className="mono">{data.secret.replace(/(.{4})/g, '$1 ').trim()}</span>
        </Text>
      )}
      <Text size="sm">2. Saisissez le code affiché par l’application.</Text>
      <CodeInput busy={busy} onComplete={(code) => run(() => post('/api/account/totp/confirm', { code }))} />
      {err}
      {restart}
    </AuthCard>
  );
}

function PasswordForm({
  busy,
  err,
  run,
  minLen,
}: {
  busy: boolean;
  err: ReactNode;
  run: (fn: () => Promise<unknown>) => void;
  minLen: number;
}) {
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [local, setLocal] = useState<string | null>(null);
  return (
    <AuthCard title="Choisir un nouveau mot de passe" step={3}>
      <Text size="sm" c="dimmed">
        Votre mot de passe est temporaire : choisissez-en un personnel.
      </Text>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (f.next !== f.confirm) return setLocal('Les deux saisies ne correspondent pas.');
          setLocal(null);
          run(() => post('/api/account/password', { current: f.current, next: f.next }));
        }}
      >
        <Stack>
          <PasswordInput
            label="Mot de passe temporaire"
            autoComplete="current-password"
            required
            value={f.current}
            onChange={(e) => setF({ ...f, current: e.currentTarget.value })}
          />
          <PasswordInput
            label="Nouveau mot de passe"
            description={`Au moins ${minLen} caractères et 3 types parmi minuscules, majuscules, chiffres, symboles.`}
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
          {local && <Alert color="red">{local}</Alert>}
          {err}
          <Button type="submit" loading={busy}>
            Enregistrer
          </Button>
        </Stack>
      </form>
    </AuthCard>
  );
}

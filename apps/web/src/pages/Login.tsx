/* Connexion : mot de passe, puis double authentification (code TOTP), enrôlement TOTP, changement de mot de passe imposé. */
import { Alert, Button, Loader, PasswordInput, PinInput, Stack, Text, VisuallyHidden } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import qrcode from 'qrcode-generator';
import { useEffect, useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError, api, get, post, setCsrf } from '../api';
import { CriteresMotDePasse } from '../components/CriteresMotDePasse';
import { OndeMenu } from '../components/OndeMenu';
import { FondConnexion } from '../connexion/FondConnexion';
import { IconeCadenas, IconeFleche, IconeOeil, IconeOeilBarre, IconePersonne } from '../connexion/icones';
import { Sceau } from '../connexion/Sceau';
import { useMe, useRefreshMe } from '../session';

const safeNext = (n: string | null) => (n && /^\/(?!\/)/.test(n) ? n : '/');

/* Panneau unique centré : bandeau, accroche, puis le formulaire de l'étape (connexion, code, enrôlement, mot de passe). */
function AuthCard({ title, etape = true, children }: { title: string; etape?: boolean; children: ReactNode }) {
  // Panneau sans nom accessible : le h1 suffit, et un nom ferait doublon avec les libellés des champs.
  return (
    <main className="auth-wrap auth-connexion">
      <FondConnexion />
      <section className="auth-panneau">
        <OndeMenu />
        <Sceau />
        <VisuallyHidden component="h1">{title}</VisuallyHidden>
        <span className="auth-kicker">Gouvernance · Risques · Conformité</span>
        <h2 className="auth-accroche">
          Une vision claire.
          <br />
          Un pilotage serein.
        </h2>
        {etape ? (
          <Stack className="auth-etape">
            <span className="auth-label" aria-hidden="true">
              {title}
            </span>
            {children}
          </Stack>
        ) : (
          children
        )}
      </section>
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
  const [voir, setVoir] = useState(false);
  const [majuscules, setMajuscules] = useState(false);
  const id = useId();
  const verifierMajuscules = (e: KeyboardEvent<HTMLInputElement>) => setMajuscules(e.getModifierState('CapsLock'));
  return (
    <AuthCard title="Connexion" etape={false}>
      <form
        className="auth-pile"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onLogin(u.trim(), p);
        }}
      >
        <div className="auth-carte auth-carte--identifiant">
          <label className="auth-label" htmlFor={`${id}-u`}>
            Identifiant
          </label>
          <div className="auth-boite">
            <IconePersonne />
            <input
              id={`${id}-u`}
              className="auth-champ"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="prenom.nom"
              required
              autoFocus
              value={u}
              onChange={(e) => setU(e.currentTarget.value)}
            />
          </div>
        </div>
        <div className="auth-carte auth-carte--mot-de-passe">
          <div className="auth-tete">
            <label className="auth-label" htmlFor={`${id}-p`}>
              Mot de passe
            </label>
            {majuscules && (
              <span className="auth-majuscules" id={`${id}-maj`} role="status">
                Majuscules verrouillées
              </span>
            )}
          </div>
          <div className="auth-boite">
            <IconeCadenas />
            <input
              id={`${id}-p`}
              className="auth-champ auth-champ--secret"
              name="password"
              type={voir ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Votre mot de passe"
              required
              aria-describedby={majuscules ? `${id}-maj` : undefined}
              value={p}
              onChange={(e) => setP(e.currentTarget.value)}
              onKeyDown={verifierMajuscules}
              onKeyUp={verifierMajuscules}
              onBlur={() => setMajuscules(false)}
            />
            {/* Libellé sans « mot de passe » : le champ reste seul à porter ce nom. */}
            <button
              type="button"
              className="auth-oeil"
              aria-label="Afficher la saisie"
              aria-pressed={voir}
              aria-controls={`${id}-p`}
              onClick={() => setVoir((v) => !v)}
            >
              {voir ? <IconeOeilBarre /> : <IconeOeil />}
            </button>
          </div>
        </div>
        <button type="submit" className="auth-carte auth-carte--valider" disabled={busy} aria-busy={busy}>
          <span>Se connecter</span>
          {busy ? <Loader size="xs" className="auth-attente" /> : <IconeFleche />}
        </button>
      </form>
      {err}
      <p className="auth-aide">Mot de passe oublié ou compte verrouillé ? Un administrateur peut le réinitialiser.</p>
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
    <AuthCard title="Double authentification">
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
    <AuthCard title="Activer la double authentification">
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
      <CodeInput
        busy={busy}
        onComplete={(code) =>
          run(async () => {
            const r = await post<{ demo?: 'ok' | 'echec' }>('/api/account/totp/confirm', { code });
            if (r.demo === 'ok')
              notifications.show({
                color: 'teal',
                autoClose: false,
                message:
                  'Données de démonstration chargées (établissement fictif). Pour repartir d’une base vide : Administration, Remettre la base à vide.',
              });
            if (r.demo === 'echec')
              notifications.show({
                color: 'red',
                autoClose: false,
                message:
                  'Le chargement des données de démonstration a été interrompu : la démonstration peut être incomplète. Consultez le journal d’audit, puis Administration, Remettre la base à vide.',
              });
          })
        }
      />
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
  const me = useMe();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [local, setLocal] = useState<string | null>(null);
  return (
    <AuthCard title="Choisir un nouveau mot de passe">
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
            withAsterisk={false}
            autoComplete="current-password"
            required
            value={f.current}
            onChange={(e) => setF({ ...f, current: e.currentTarget.value })}
          />
          <PasswordInput
            label="Nouveau mot de passe"
            withAsterisk={false}
            description={`Au moins ${minLen} caractères et 3 types parmi minuscules, majuscules, chiffres, symboles, sans répétition ni suite.`}
            autoComplete="new-password"
            required
            value={f.next}
            onChange={(e) => setF({ ...f, next: e.currentTarget.value })}
          />
          <CriteresMotDePasse
            valeur={f.next}
            minLen={minLen}
            identifiants={[me.user?.username ?? '']}
            noms={[me.appName, me.orgName]}
            ancien={f.current}
          />
          <PasswordInput
            label="Confirmation"
            withAsterisk={false}
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

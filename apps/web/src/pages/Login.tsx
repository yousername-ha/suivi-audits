/* Connexion : mot de passe, puis double authentification (code TOTP, clé de sécurité ou code de récupération), enrôlement TOTP
   (avec ajout facultatif d'une clé), enrôlement d'une clé imposé, changement de mot de passe imposé. */
import { Alert, Button, Loader, PasswordInput, PinInput, Stack, Text, TextInput, VisuallyHidden } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import qrcode from 'qrcode-generator';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError, api, get, post, setCsrf } from '../api';
import { CriteresMotDePasse } from '../components/CriteresMotDePasse';
import { AjoutCle, EnrolementImpose } from '../components/ClesSecurite';
import { OndeMenu } from '../components/OndeMenu';
import { dispositionConnexion, type DispositionConnexion } from '../components/onde-menu';
import { FondConnexion } from '../connexion/FondConnexion';
import { IconeCadenas, IconeFleche, IconeOeil, IconeOeilBarre, IconePersonne } from '../connexion/icones';
import { Sceau } from '../connexion/Sceau';
import { fetchMe, useMe, useRefreshMe } from '../session';
import { connexionParCle, MESSAGE_NAVIGATEUR, navigateurCompatible } from '../webauthn';

const safeNext = (n: string | null) => (n && /^\/(?!\/)/.test(n) ? n : '/');

/* Panneau unique centré : bandeau, accroche, puis le formulaire de l'étape (connexion, code, enrôlement, mot de passe). */
/** Horizon de l'onde : à mi-chemin entre le bas du titre et le haut de la première carte, mesuré sur la mise en page
    (taille du panneau, chargement des polices). */
function useDispositionOnde(panneau: RefObject<HTMLElement | null>, titre: RefObject<HTMLElement | null>) {
  const [disposition, setDisposition] = useState<DispositionConnexion | null>(null);
  useEffect(() => {
    const p = panneau.current;
    const h2 = titre.current;
    if (!p || !h2) return;
    const mesurer = () => {
      const carte = p.querySelector('.auth-carte--identifiant, .auth-etape');
      if (!carte) return;
      const d = dispositionConnexion(
        p.getBoundingClientRect(),
        h2.getBoundingClientRect().bottom,
        carte.getBoundingClientRect().top,
      );
      setDisposition((avant) => (avant && avant.horizon === d.horizon && avant.ecart === d.ecart ? avant : d));
    };
    mesurer();
    const taille = typeof ResizeObserver === 'function' ? new ResizeObserver(mesurer) : null;
    taille?.observe(p);
    const polices = 'fonts' in document ? document.fonts : null;
    void polices?.ready.then(mesurer);
    polices?.addEventListener('loadingdone', mesurer);
    return () => {
      taille?.disconnect();
      polices?.removeEventListener('loadingdone', mesurer);
    };
  }, [panneau, titre]);
  return disposition;
}

function AuthCard({ title, etape = true, children }: { title: string; etape?: boolean; children: ReactNode }) {
  const panneau = useRef<HTMLElement>(null);
  const titre = useRef<HTMLHeadingElement>(null);
  const disposition = useDispositionOnde(panneau, titre);
  // Panneau sans nom accessible : le h1 suffit, et un nom ferait doublon avec les libellés des champs.
  return (
    <main className="auth-wrap auth-connexion">
      <FondConnexion />
      <section className="auth-panneau" ref={panneau}>
        {disposition && <OndeMenu connexion={disposition} />}
        <Sceau />
        <VisuallyHidden component="h1">{title}</VisuallyHidden>
        <span className="auth-kicker">Gouvernance · Risques · Conformité</span>
        <h2 className="auth-accroche" ref={titre}>
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

  const run = async (fn: () => Promise<unknown>, o: { rafraichir?: boolean } = {}) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      if (o.rafraichir !== false) await refresh();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : String(e));
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
      <MfaForm
        busy={busy}
        err={err}
        restart={restart}
        cle={me.webauthn && (me.user?.cles ?? 0) > 0}
        totp={!!me.user?.totpEnabled}
        onCode={(code) => run(() => post('/api/auth/mfa', { code }))}
        onCle={() => run(connexionParCle)}
        onRecuperation={(code) => run(() => post('/api/auth/recovery', { code }))}
      />
    );
  if (me.stage === 'enroll')
    return <EnrollForm busy={busy} err={err} restart={restart} run={run} cleProposee={me.webauthn} />;
  if (me.stage === 'enroll_key')
    return (
      <AuthCard title="Enregistrer une clé de sécurité">
        <EnrolementImpose />
        {err}
        {restart}
      </AuthCard>
    );
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

function CodeInput({
  onComplete,
  busy,
  autoFocus = true,
}: {
  onComplete: (c: string) => void;
  busy: boolean;
  autoFocus?: boolean;
}) {
  const [code, setCode] = useState('');
  return (
    <Stack align="center">
      <PinInput
        length={6}
        type="number"
        oneTimeCode
        autoFocus={autoFocus}
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
  cle,
  totp,
  onCode,
  onCle,
  onRecuperation,
}: {
  busy: boolean;
  err: ReactNode;
  restart: ReactNode;
  /** Le compte a une clé utilisable et le serveur propose les clés. */
  cle: boolean;
  totp: boolean;
  onCode: (c: string) => void;
  onCle: () => void;
  onRecuperation: (c: string) => void;
}) {
  const [recuperation, setRecuperation] = useState(false);
  const [code, setCode] = useState('');
  const compatible = navigateurCompatible();
  return (
    <AuthCard title="Double authentification">
      {cle && (
        <Stack gap="xs">
          <Button onClick={onCle} loading={busy} disabled={!compatible} fullWidth autoFocus={compatible}>
            Utiliser ma clé de sécurité
          </Button>
          {!compatible && (
            <Text size="xs" c="orange.8" role="status">
              {MESSAGE_NAVIGATEUR}
            </Text>
          )}
        </Stack>
      )}
      {totp && !recuperation && (
        <>
          <Text size="sm" c="dimmed">
            {cle ? 'Ou saisissez' : 'Saisissez'} le code à 6 chiffres affiché par votre application d’authentification.
          </Text>
          <CodeInput onComplete={onCode} busy={busy} autoFocus={!cle || !compatible} />
        </>
      )}
      {recuperation && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            onRecuperation(code);
          }}
        >
          <Stack gap="xs">
            <TextInput
              label="Code de récupération"
              description="Un des dix codes remis lors de leur création (XXXX-XXXX-XXXX-XXXX), utilisable une seule fois."
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
            />
            <Button type="submit" loading={busy} disabled={code.replace(/[\s-]/g, '').length !== 16} fullWidth>
              Valider le code de récupération
            </Button>
          </Stack>
        </form>
      )}
      {err}
      <Button variant="subtle" size="xs" onClick={() => setRecuperation(!recuperation)}>
        {recuperation ? 'Revenir au code de double authentification' : 'Utiliser un code de récupération'}
      </Button>
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
  cleProposee,
}: {
  busy: boolean;
  err: ReactNode;
  restart: ReactNode;
  run: (fn: () => Promise<unknown>, o?: { rafraichir?: boolean }) => void;
  /** Le serveur propose les clés : après le TOTP, ajout facultatif d'une clé (dès l'installation). */
  cleProposee: boolean;
}) {
  const refresh = useRefreshMe();
  const proposerCle = cleProposee && navigateurCompatible();
  const [etapeCle, setEtapeCle] = useState(false);
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
  if (etapeCle)
    return (
      <AuthCard title="Ajouter une clé de sécurité (facultatif)">
        <Text size="sm">
          La double authentification est active. Vous pouvez aussi enregistrer dès maintenant une clé de sécurité
          (YubiKey, clé FIDO2) : elle remplacera le code à 6 chiffres à la connexion, le code restant utilisable en
          secours.
        </Text>
        <AjoutCle libelleBouton="Enregistrer ma clé" onAjout={() => void refresh()} />
        <Button variant="default" onClick={() => void refresh()}>
          Plus tard
        </Button>
      </AuthCard>
    );
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
          run(
            async () => {
              const r = await post<{ demo?: 'ok' | 'echec' }>('/api/account/totp/confirm', { code });
              // Session régénérée par la confirmation : nouveau jeton CSRF, sans quitter encore cet écran.
              if (proposerCle) {
                await fetchMe();
                setEtapeCle(true);
              }
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
            },
            { rafraichir: !proposerCle },
          )
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

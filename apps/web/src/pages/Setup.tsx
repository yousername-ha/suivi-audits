/* Installation initiale : création du compte administrateur avec le jeton d'installation. */
import { Alert, Button, Card, Group, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import {
  formatSetupToken,
  SETUP_TOKEN_COMMANDS,
  SETUP_TOKEN_PLACEHOLDER,
  setupTokenChars,
  setupTokenInputProblem,
} from '@suivi/shared';
import type { PoivreAEnregistrer } from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ApiError, get, post } from '../api';
import { CopyCommand } from '../components/common';
import { CriteresMotDePasse } from '../components/CriteresMotDePasse';
import { SaisiePoivre } from '../components/Poivre';
import { useMe, useRefreshMe } from '../session';

/** Mise en forme XXXXX-XXXXX-XXXXX-XXXXX pendant la saisie, en conservant la position du curseur. */
function useTokenInput() {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const pos = el.selectionStart ?? el.value.length;
    const keep = setupTokenChars(el.value.slice(0, pos)).length;
    const next = formatSetupToken(setupTokenChars(el.value));
    setValue(next);
    requestAnimationFrame(() => {
      let i = 0,
        n = 0;
      while (i < next.length && n < keep) {
        if (/[A-Z0-9]/.test(next[i]!)) n++;
        i++;
      }
      ref.current?.setSelectionRange(i, i);
    });
  };
  // Retour arrière juste après un tiret : supprime le caractère qui le précède.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const p = el.selectionStart ?? 0;
    if (e.key === 'Backspace' && p === el.selectionEnd && p > 0 && el.value[p - 1] === '-')
      el.setSelectionRange(p - 1, p - 1);
  };
  return { value, ref, onChange, onKeyDown };
}

export function SetupPage() {
  const me = useMe();
  const refresh = useRefreshMe();
  const nav = useNavigate();
  const status = useQuery({
    queryKey: ['setup'],
    queryFn: () =>
      get<{ needed: boolean; adminExists: boolean; pending: boolean; poivreDefini: boolean }>('/api/setup'),
  });
  // Étape 1 (poivre des mots de passe, ADR 0072) quand il n'est pas encore défini ; étape 2 : le compte administrateur.
  const [etape, setEtape] = useState<'poivre' | 'compte'>('poivre');
  const [poivre, setPoivre] = useState<PoivreAEnregistrer | null>(null);
  const interdits = useMemo(() => [me.appName], [me.appName]);
  const token = useTokenInput();
  const [f, setF] = useState({ username: '', displayName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status.data && !status.data.needed) return <Navigate to="/login" replace />;
  const minLen = me.passwordMinLength;
  const avecPoivre = !!status.data && !status.data.poivreDefini;
  const surPoivre = avecPoivre && etape === 'poivre';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const tp = setupTokenInputProblem(token.value);
    if (tp) return setError(tp);
    if (f.password !== f.confirm) return setError('Les deux saisies du mot de passe ne correspondent pas.');
    setBusy(true);
    try {
      await post('/api/setup', {
        token: token.value,
        username: f.username.trim(),
        displayName: f.displayName,
        email: f.email,
        password: f.password,
        ...(avecPoivre && poivre ? { poivre } : {}),
      });
      await refresh();
      nav('/login', { replace: true });
    } catch (x) {
      setError(x instanceof ApiError ? x.message : String(x));
      // Un refus du poivre se corrige à l'étape 1.
      const raison = x instanceof ApiError ? x.data?.reason : undefined;
      if (raison === 'poivre_faible' || raison === 'engagement' || raison === 'poivre_requis') setEtape('poivre');
      else token.ref.current?.focus();
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.currentTarget.value });

  return (
    <main className="auth-wrap">
      <Card className="auth-card" withBorder padding="xl" radius="lg">
        <Stack>
          <Group gap="xs">
            <span className="brand-mark" aria-hidden="true">
              S
            </span>
            <Text fw={700}>Installation initiale</Text>
          </Group>
          <Title order={1} size="h2">
            {surPoivre ? 'Poivre des mots de passe' : 'Créer le compte administrateur'}
          </Title>
          {surPoivre ? (
            <Stack>
              <Text size="sm">
                Étape 1 sur 2. Avant de créer le compte, définissez le poivre qui protégera tous les mots de passe de
                l’application. Il est conservé au coffre-fort de l’organisation, pas sur le serveur.
              </Text>
              <SaisiePoivre interdits={interdits} onChange={setPoivre} />
              {error && (
                <Alert color="red" role="alert">
                  {error}
                </Alert>
              )}
              <Button disabled={!poivre} onClick={() => setEtape('compte')} fullWidth>
                Continuer
              </Button>
            </Stack>
          ) : (
            <>
              <Card withBorder bg="var(--mantine-color-default-hover)" component="section" aria-labelledby="tokbox">
                <Stack gap="xs">
                  <Title order={2} size="h5" id="tokbox">
                    Récupérer le jeton
                  </Title>
                  <Text size="sm" c="dimmed">
                    Sur le serveur, dans le dossier de l’application, exécuter l’une des commandes suivantes. Le jeton
                    est valable 24 h ; en générer un nouveau annule le précédent.
                  </Text>
                  <CopyCommand command={`sudo ${SETUP_TOKEN_COMMANDS.generate}`} />
                  <Text size="sm" c="dimmed">
                    ou, pour retrouver le jeton émis au démarrage :
                  </Text>
                  <CopyCommand command={`sudo ${SETUP_TOKEN_COMMANDS.logs}`} />
                </Stack>
              </Card>
              <form onSubmit={submit} noValidate>
                <Stack>
                  <TextInput
                    label="Jeton d’installation"
                    description="20 caractères, majuscules et chiffres de 2 à 9. Minuscules, espaces et tirets acceptés."
                    placeholder={SETUP_TOKEN_PLACEHOLDER}
                    className="token-input"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    required
                    ref={token.ref}
                    value={token.value}
                    onChange={token.onChange}
                    onKeyDown={token.onKeyDown}
                  />
                  <div className="grid-2">
                    <TextInput
                      label="Identifiant"
                      required
                      maxLength={64}
                      autoComplete="username"
                      value={f.username}
                      onChange={set('username')}
                    />
                    <TextInput
                      label="Nom affiché"
                      maxLength={120}
                      autoComplete="name"
                      value={f.displayName}
                      onChange={set('displayName')}
                    />
                  </div>
                  <TextInput
                    label="Adresse e-mail (facultatif)"
                    type="email"
                    maxLength={200}
                    autoComplete="email"
                    value={f.email}
                    onChange={set('email')}
                  />
                  <PasswordInput
                    label="Mot de passe"
                    description={`Au moins ${minLen} caractères et 3 types parmi minuscules, majuscules, chiffres, symboles, sans répétition ni suite.`}
                    required
                    autoComplete="new-password"
                    value={f.password}
                    onChange={set('password')}
                  />
                  <CriteresMotDePasse
                    valeur={f.password}
                    minLen={minLen}
                    identifiants={[f.username.trim()]}
                    noms={[me.appName, me.orgName]}
                  />
                  <PasswordInput
                    label="Confirmation"
                    required
                    autoComplete="new-password"
                    value={f.confirm}
                    onChange={set('confirm')}
                  />
                  {error && (
                    <Alert color="red" role="alert">
                      {error}
                    </Alert>
                  )}
                  <Button type="submit" loading={busy} fullWidth>
                    Créer le compte
                  </Button>
                </Stack>
              </form>
              <Text size="xs" c="dimmed" ta="center">
                La double authentification sera configurée à l’étape suivante.
              </Text>
              {avecPoivre && (
                <Button variant="subtle" size="xs" onClick={() => setEtape('poivre')}>
                  Revenir au poivre
                </Button>
              )}
            </>
          )}
        </Stack>
      </Card>
    </main>
  );
}

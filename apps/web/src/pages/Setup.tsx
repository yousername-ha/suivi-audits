/* Installation initiale : création du compte administrateur avec le jeton d'installation. */
import { Alert, Button, Card, Checkbox, Group, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import {
  formatSetupToken,
  SETUP_TOKEN_COMMANDS,
  SETUP_TOKEN_PLACEHOLDER,
  setupTokenChars,
  setupTokenInputProblem,
} from '@suivi/shared';
import type { CleSecoursAEnregistrer, PoivreAEnregistrer } from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ApiError, get, post } from '../api';
import { CopyCommand } from '../components/common';
import { GenerationCleSecours } from '../components/CleSecours';
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
      get<{
        needed: boolean;
        adminExists: boolean;
        pending: boolean;
        poivreDefini: boolean;
        cleSecoursDefinie: boolean;
        adresseSite: string | null;
      }>('/api/setup'),
  });
  // Étapes : poivre des mots de passe (ADR 0072) et clé de secours des sauvegardes (ADR 0077) quand ils ne sont pas encore
  // définis, puis le compte administrateur. Tout est envoyé ensemble, dans la requête qui consomme le jeton.
  const [etape, setEtape] = useState<'poivre' | 'cle' | 'compte'>('poivre');
  const [poivre, setPoivre] = useState<PoivreAEnregistrer | null>(null);
  const [cleSecours, setCleSecours] = useState<CleSecoursAEnregistrer | null>(null);
  const interdits = useMemo(() => [me.appName], [me.appName]);
  const token = useTokenInput();
  const [demo, setDemo] = useState(false);
  const [f, setF] = useState({ orgName: '', username: '', displayName: '', email: '', password: '', confirm: '' });
  // Adresse du site (ADR 0077) : par défaut celle par laquelle ce navigateur a ouvert l'assistant.
  const [adresse, setAdresse] = useState(() => window.location.hostname);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status.data && !status.data.needed) return <Navigate to="/login" replace />;
  const minLen = me.passwordMinLength;
  const avecPoivre = !!status.data && !status.data.poivreDefini;
  const avecCle = !!status.data && !status.data.cleSecoursDefinie;
  const etapes = [
    ...(avecPoivre ? (['poivre'] as const) : []),
    ...(avecCle ? (['cle'] as const) : []),
    'compte' as const,
  ];
  const courante = etapes.includes(etape) ? etape : etapes[0]!;
  const numero = etapes.indexOf(courante) + 1;
  const suivante = () => setEtape(etapes[numero] ?? 'compte');
  const precedente = numero > 1 ? etapes[numero - 2] : null;
  const surPoivre = courante === 'poivre';
  const surCle = courante === 'cle';

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
        orgName: f.orgName.trim() || undefined,
        username: f.username.trim(),
        displayName: f.displayName,
        email: f.email,
        password: f.password,
        demo,
        ...(avecPoivre && poivre ? { poivre } : {}),
        ...(avecCle && cleSecours ? { cleSecours } : {}),
        ...(adresse.trim() ? { adresseSite: adresse.trim() } : {}),
      });
      await refresh();
      nav('/login', { replace: true });
    } catch (x) {
      setError(x instanceof ApiError ? x.message : String(x));
      // Un refus du poivre se corrige à l'étape 1.
      const raison = x instanceof ApiError ? x.data?.reason : undefined;
      if (raison === 'poivre_faible' || raison === 'engagement' || raison === 'poivre_requis') setEtape('poivre');
      else if (raison === 'cle_secours_requise') setEtape('cle');
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
            {surPoivre
              ? 'Poivre des mots de passe'
              : surCle
                ? 'Clé de secours des sauvegardes'
                : 'Créer le compte administrateur'}
          </Title>
          {etapes.length > 1 && (
            <Text size="xs" c="dimmed">
              Étape {numero} sur {etapes.length}
            </Text>
          )}
          {surPoivre ? (
            <Stack>
              <Text size="sm">
                Avant de créer le compte, définissez le poivre qui protégera tous les mots de passe de l’application. Il
                est conservé au coffre-fort de l’organisation, pas sur le serveur.
              </Text>
              <SaisiePoivre interdits={interdits} onChange={setPoivre} />
              {error && (
                <Alert color="red" role="alert">
                  {error}
                </Alert>
              )}
              <Button disabled={!poivre} onClick={suivante} fullWidth>
                Continuer
              </Button>
            </Stack>
          ) : surCle ? (
            <Stack>
              <GenerationCleSecours onChange={setCleSecours} />
              {error && (
                <Alert color="red" role="alert">
                  {error}
                </Alert>
              )}
              <Button disabled={!cleSecours} onClick={suivante} fullWidth>
                Continuer
              </Button>
              {precedente && (
                <Button variant="subtle" size="xs" onClick={() => setEtape(precedente)}>
                  Revenir à l’étape précédente
                </Button>
              )}
            </Stack>
          ) : (
            <>
              <Card withBorder bg="var(--mantine-color-default-hover)" component="section" aria-labelledby="tokbox">
                <Stack gap="xs">
                  <Title order={2} size="h5" id="tokbox">
                    Récupérer le jeton
                  </Title>
                  <Text size="sm" c="dimmed">
                    Le jeton est affiché à la fin de la commande d’installation, sur le serveur. Il est valable 24 h ;
                    relancer la commande, dans le dossier de l’application, en affiche un nouveau et annule le précédent
                    :
                  </Text>
                  <CopyCommand command={SETUP_TOKEN_COMMANDS.installer} />
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
                  <TextInput
                    label="Adresse du site"
                    description={
                      status.data?.adresseSite && adresse.trim().toLowerCase() !== status.data.adresseSite
                        ? `Nom DNS ou adresse IP par lesquels les utilisateurs ouvriront l’application. Elle remplacera « ${status.data.adresseSite} » une minute après la création du compte ; le site restera aussi joignable par les adresses du serveur.`
                        : 'Nom DNS ou adresse IP par lesquels les utilisateurs ouvriront l’application (modifiable ensuite dans Administration).'
                    }
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={253}
                    value={adresse}
                    onChange={(e) => setAdresse(e.currentTarget.value)}
                  />
                  <TextInput
                    label="Nom de l’organisation"
                    description="Affiché dans l’application et les exports ; modifiable ensuite dans Paramètres."
                    maxLength={120}
                    autoComplete="organization"
                    value={f.orgName}
                    onChange={set('orgName')}
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
                  <Checkbox
                    label="Charger des données de démonstration"
                    description="Établissement de santé fictif avec ISO 27001, HDS et une étude EBIOS RM complète, pour découvrir l’outil. Chargées à la fin de la configuration de la double authentification (environ une minute). À retirer avant la production : Administration, Remettre la base à vide."
                    checked={demo}
                    onChange={(e) => setDemo(e.currentTarget.checked)}
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
              {precedente && (
                <Button variant="subtle" size="xs" onClick={() => setEtape(precedente)}>
                  Revenir à l’étape précédente
                </Button>
              )}
            </>
          )}
        </Stack>
      </Card>
    </main>
  );
}

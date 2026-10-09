/* Écran mural (/mur) : tableau de bord plein écran, sans menu, texte agrandi, mis à jour en temps réel,
   rotation facultative entre les vues. Lecture seule. Accessible avec une session (droit de lecture métier)
   ou depuis un appareil activé par un administrateur (/mur/activer#code). */
import { Alert, Badge, Button, Center, Group, Loader, Select, Stack, Switch, Text, Title } from '@mantine/core';
import { useFullscreen } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ApiError, errorMessage, get, post } from '../api';
import { WALL_QUERY_KEY } from '../logout';
import { SyntheseCartes, VUE_LABELS, VUES, type SyntheseApi, type Vue } from '../components/Synthese';

const KEY = WALL_QUERY_KEY;
const ROTATION_S = [15, 30, 60, 120] as const;

function useMurPlein() {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.mur = '';
    return () => {
      delete html.dataset.mur;
    };
  }, []);
}

/** Flux temps réel de l'écran : recharge la synthèse à chaque changement ; « révoqué » si le serveur coupe l'accès. */
function useFluxMur(onRevoque: () => void) {
  const qc = useQueryClient();
  const [connecte, setConnecte] = useState(false);
  useEffect(() => {
    const es = new EventSource('/api/mur/events');
    es.addEventListener('hello', () => {
      setConnecte(true);
      void qc.invalidateQueries({ queryKey: KEY });
    });
    es.addEventListener('change', () => void qc.invalidateQueries({ queryKey: KEY }));
    es.addEventListener('logout', () => {
      es.close();
      setConnecte(false);
      onRevoque();
    });
    es.onerror = () => setConnecte(false);
    return () => es.close();
  }, [qc, onRevoque]);
  return connecte;
}

function MessageMur({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="mur-message">
      <Stack align="center" gap="md" className="lecture">
        <Title order={1}>{titre}</Title>
        {children}
      </Stack>
    </div>
  );
}

export function MurPage() {
  useMurPlein();
  const [params, setParams] = useSearchParams();
  const [revoque, setRevoque] = useState(false);
  const [onRevoque] = useState(() => () => setRevoque(true));
  const connecte = useFluxMur(onRevoque);
  const { toggle: pleinEcran, fullscreen } = useFullscreen();
  const [heure, setHeure] = useState(() => new Date());
  const q = useQuery({ queryKey: KEY, queryFn: () => get<SyntheseApi>('/api/mur/synthese'), refetchInterval: 300_000 });

  const vuesParam = (params.get('vues') ?? '')
    .split(',')
    .filter((v): v is Vue => (VUES as readonly string[]).includes(v));
  const vues: Vue[] = vuesParam.length ? vuesParam : [...VUES];
  const rotation = Number(params.get('rotation')) || 0;
  const vue: Vue = (VUES as readonly string[]).includes(params.get('vue') ?? '')
    ? (params.get('vue') as Vue)
    : vues[0]!;
  const setParam = (k: string, v: string | null) =>
    setParams(
      (p) => {
        if (v === null) p.delete(k);
        else p.set(k, v);
        return p;
      },
      { replace: true },
    );

  useEffect(() => {
    const t = setInterval(() => setHeure(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!rotation) return;
    const t = setInterval(() => {
      const i = vues.indexOf(vue);
      setParam('vue', vues[(i + 1) % vues.length]!);
    }, rotation * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotation, vue, vues.join(',')]);

  const refuse = q.error instanceof ApiError && (q.error.status === 401 || q.error.status === 403);
  if (revoque || refuse)
    return (
      <MessageMur titre="Écran non autorisé">
        <Text>
          {revoque
            ? 'L’accès de cet écran a été révoqué ou a expiré.'
            : 'Cet appareil n’est pas activé comme écran mural et aucune session ne donne accès au tableau de bord.'}
        </Text>
        <Text c="dimmed">
          Un administrateur peut créer un lien d’activation dans Administration, onglet « Écrans muraux ».
        </Text>
        <Button component={Link} to="/login?next=/mur" variant="light">
          Se connecter
        </Button>
      </MessageMur>
    );
  if (!q.data)
    return q.error ? (
      <MessageMur titre="Tableau de bord indisponible">
        <Alert color="red">{errorMessage(q.error)}</Alert>
      </MessageMur>
    ) : (
      <Center h="100vh" aria-busy="true">
        <Loader aria-label="Chargement" />
      </Center>
    );

  const s = q.data;
  return (
    <main className="mur" aria-label="Écran mural">
      <header className="mur-entete">
        <div>
          <Title order={1}>
            {s.organisation} — {VUE_LABELS[vue]}
          </Title>
          <Text c="dimmed">
            {s.ecran ? `Écran « ${s.ecran} » · ` : ''}
            {heure.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })} · mis à jour à{' '}
            {new Date(s.genereLe).toLocaleTimeString('fr-FR', { timeStyle: 'short' })}
          </Text>
        </div>
        <Group gap="sm" className="mur-commandes">
          <Badge color={connecte ? 'teal' : 'gray'} variant="dot" size="lg" className="live-badge">
            {connecte ? 'En direct' : 'Reconnexion…'}
          </Badge>
          <Select
            aria-label="Vue affichée"
            className="champ-s"
            allowDeselect={false}
            value={vue}
            onChange={(v) => v && setParam('vue', v)}
            data={vues.map((v) => ({ value: v, label: VUE_LABELS[v] }))}
          />
          <Switch
            label="Rotation"
            checked={!!rotation}
            onChange={(e) => setParam('rotation', e.currentTarget.checked ? '30' : null)}
          />
          {!!rotation && (
            <Select
              aria-label="Durée de chaque vue"
              className="champ-xs"
              allowDeselect={false}
              value={String(rotation)}
              onChange={(v) => v && setParam('rotation', v)}
              data={ROTATION_S.map((n) => ({ value: String(n), label: `${n} s` }))}
            />
          )}
          <Button variant="default" onClick={() => void pleinEcran()}>
            {fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          </Button>
        </Group>
      </header>
      <SyntheseCartes s={s} vue={vue} />
    </main>
  );
}

/** Activation d'un écran : le code est lu dans le fragment de l'adresse (#), jamais envoyé dans l'URL au serveur. */
export function MurActiverPage() {
  const nav = useNavigate();
  const [erreur, setErreur] = useState<string | null>(null);
  const fait = useRef(false);
  useEffect(() => {
    if (fait.current) return;
    fait.current = true;
    const code = window.location.hash.slice(1);
    window.history.replaceState(null, '', '/mur/activer');
    if (!code) {
      setErreur('Lien d’activation incomplet : utilisez le lien complet fourni par l’administrateur.');
      return;
    }
    post<{ nom: string }>('/api/mur/activer', { code })
      .then(() => nav('/mur?rotation=30', { replace: true }))
      .catch((e: unknown) => setErreur(errorMessage(e)));
  }, [nav]);
  return erreur ? (
    <MessageMur titre="Activation impossible">
      <Alert color="red">{erreur}</Alert>
      <Text c="dimmed">Demandez un nouveau lien (valable 24 heures, utilisable une seule fois).</Text>
    </MessageMur>
  ) : (
    <Center h="100vh" aria-busy="true">
      <Loader aria-label="Activation de l’écran" />
    </Center>
  );
}

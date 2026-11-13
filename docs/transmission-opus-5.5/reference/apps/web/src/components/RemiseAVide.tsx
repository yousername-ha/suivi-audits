/* Remise à vide de la base, pour la recette (ADR 0065). Interrupteur désactivé par défaut ; le bouton rouge n'apparaît
   qu'une fois la fonction autorisée. Deux portées au choix, phrase à recopier, code de double authentification. */
import { Alert, Badge, Button, Card, Group, Modal, Radio, Stack, Switch, Text, TextInput, Title } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  REMISE_A_VIDE_PHRASES,
  type RemiseAVideEtat,
  type RemiseAVidePortee,
  type RemiseAVideResultat,
} from '@suivi/shared';
import { useRef, useState } from 'react';
import { api, get } from '../api';
import { ErrorAlert } from './common';

const CLE = ['admin', 'remise-a-vide'] as const;

/** Le bouton d'effacement n'est actif que si tout est prêt : phrase exacte, code à six chiffres, sauvegarde récente,
    exploitation libre. Le serveur refait tous ces contrôles. */
export function peutRemettreAVide(
  etat: Pick<RemiseAVideEtat, 'autorisee' | 'occupee' | 'sauvegarde'> | undefined,
  portee: RemiseAVidePortee,
  confirm: string,
  code: string,
): boolean {
  return (
    !!etat &&
    etat.autorisee &&
    !etat.occupee &&
    etat.sauvegarde.recente &&
    confirm === REMISE_A_VIDE_PHRASES[portee] &&
    /^\d{6}$/.test(code)
  );
}

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : 'jamais';

export function RemiseAVidePanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: CLE, queryFn: () => get<RemiseAVideEtat>('/api/admin/remise-a-vide') });
  const etat = q.data;
  const [activation, setActivation] = useState(false);
  const [codeActivation, setCodeActivation] = useState('');
  const [ouverte, setOuverte] = useState(false);
  const [portee, setPortee] = useState<RemiseAVidePortee>('travail');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [resultat, setResultat] = useState<RemiseAVideResultat | null>(null);
  const idRequete = useRef<string | null>(null);

  async function autoriser(autorisee: boolean) {
    setPending(true);
    setError(null);
    try {
      const body = autorisee ? { autorisee, code: codeActivation } : { autorisee };
      qc.setQueryData(CLE, await api<RemiseAVideEtat>('PUT', '/api/admin/remise-a-vide/autorisation', { body }));
      setActivation(false);
    } catch (e) {
      setError(e);
    } finally {
      setCodeActivation('');
      setPending(false);
    }
  }

  async function effacer() {
    idRequete.current ??= crypto.randomUUID();
    setPending(true);
    setError(null);
    try {
      setResultat(
        await api<RemiseAVideResultat>('POST', '/api/admin/remise-a-vide', {
          body: { requestId: idRequete.current, portee, confirm, code },
        }),
      );
      idRequete.current = null;
    } catch (e) {
      // Un code est à usage unique : toujours en saisir un nouveau après un refus.
      setCode('');
      setError(e);
    } finally {
      setPending(false);
    }
  }

  function fermer() {
    if (pending) return;
    setOuverte(false);
    setConfirm('');
    setCode('');
    setError(null);
    void qc.invalidateQueries({ queryKey: CLE });
  }

  return (
    <Card withBorder padding="md" aria-labelledby="remise-a-vide-titre">
      <Stack gap="sm">
        <Title order={3} id="remise-a-vide-titre">
          Remise à vide de la base
        </Title>
        <Text size="sm">
          Pour la recette : efface les données saisies ou importées et revient à un état initial vide. Désactivée par
          défaut ; une sauvegarde réussie de moins de {etat?.sauvegarde.delaiMinutes ?? 30} minutes est exigée, ainsi
          que votre code de double authentification. L’opération est tracée dans le journal d’audit, qui n’est jamais
          effacé.
        </Text>
        <ErrorAlert error={error || q.error} />
        <Switch
          label="Autoriser la remise à vide sur ce serveur"
          description="À activer seulement sur un serveur de recette. Désactivée, le bouton rouge n’apparaît pas."
          checked={!!etat?.autorisee || activation}
          disabled={!etat || pending}
          onChange={(e) => {
            if (e.currentTarget.checked) setActivation(true);
            else void autoriser(false);
          }}
        />
        {activation && !etat?.autorisee && (
          <Group align="flex-end">
            <TextInput
              label="Code de double authentification"
              value={codeActivation}
              inputMode="numeric"
              autoComplete="one-time-code"
              onChange={(e) => setCodeActivation(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
            />
            <Button
              disabled={pending || !/^\d{6}$/.test(codeActivation)}
              loading={pending}
              onClick={() => void autoriser(true)}
            >
              Autoriser
            </Button>
            <Button
              variant="default"
              disabled={pending}
              onClick={() => {
                setActivation(false);
                setCodeActivation('');
              }}
            >
              Annuler
            </Button>
          </Group>
        )}
        {etat?.autorisee && (
          <>
            <Group gap="xs">
              <Text size="sm">Dernière sauvegarde réussie : {date(etat.sauvegarde.derniere)}</Text>
              <Badge color={etat.sauvegarde.recente ? 'green' : 'orange'} variant="light">
                {etat.sauvegarde.recente ? 'récente' : `de plus de ${etat.sauvegarde.delaiMinutes} min`}
              </Badge>
            </Group>
            {!etat.sauvegarde.recente && (
              <Alert color="orange" role="status">
                Lancez une sauvegarde dans « Sauvegardes et restauration », puis revenez ici dans les{' '}
                {etat.sauvegarde.delaiMinutes} minutes.
              </Alert>
            )}
            {etat.occupee && (
              <Alert color="orange" role="status">
                Une sauvegarde ou une opération d’exploitation est en cours : patientez.
              </Alert>
            )}
            <Group>
              <Button color="red" onClick={() => setOuverte(true)}>
                Remettre la base à vide…
              </Button>
            </Group>
          </>
        )}
      </Stack>
      <Modal opened={ouverte} onClose={fermer} title="Remettre la base à vide" size="lg" closeOnClickOutside={false}>
        {resultat ? (
          <Stack>
            <Alert color={resultat.jeton ? 'orange' : 'green'} role="status" title="Terminé">
              {resultat.message}
            </Alert>
            <Group>
              <Button onClick={() => window.location.assign('/')}>Recharger l’application</Button>
            </Group>
          </Stack>
        ) : (
          <Stack>
            <Alert color="red" title="Opération irréversible">
              Les données effacées ne se récupèrent que par une restauration de la sauvegarde. Les décisions et versions
              publiées, normalement immuables, sont effacées aussi.
            </Alert>
            <Radio.Group
              label="Que faut-il effacer ?"
              value={portee}
              onChange={(v) => {
                setPortee(v as RemiseAVidePortee);
                setConfirm('');
              }}
            >
              <Stack gap="xs" mt="xs">
                <Radio
                  value="travail"
                  label="Les données de travail seulement"
                  description="Pilotage, risques, actions, écarts, documents, référentiels importés. Comptes, rôles et réglages conservés : vous restez connecté."
                />
                <Radio
                  value="tout"
                  label="Tout, comptes compris"
                  description="Efface aussi les comptes, groupes, rôles personnalisés et réglages. Retour à l’écran d’installation avec un nouveau jeton."
                />
              </Stack>
            </Radio.Group>
            <TextInput
              label={`Recopier exactement : ${REMISE_A_VIDE_PHRASES[portee]}`}
              value={confirm}
              disabled={pending}
              autoComplete="off"
              onChange={(e) => setConfirm(e.currentTarget.value)}
            />
            <TextInput
              label="Code de double authentification"
              description="Code à 6 chiffres de votre application d’authentification."
              value={code}
              disabled={pending}
              inputMode="numeric"
              autoComplete="one-time-code"
              onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
            />
            <ErrorAlert error={error} />
            <Group justify="flex-end">
              <Button variant="default" disabled={pending} onClick={fermer}>
                Annuler
              </Button>
              <Button
                color="red"
                loading={pending}
                disabled={pending || !peutRemettreAVide(etat, portee, confirm, code)}
                onClick={() => void effacer()}
              >
                Effacer définitivement
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Card>
  );
}

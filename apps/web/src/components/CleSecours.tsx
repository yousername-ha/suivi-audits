/* Clé de secours des sauvegardes (ADR 0077) : génération dans ce navigateur (WebCrypto X25519, format age), téléchargement et
   engagement de rangement au coffre-fort ; seule la clé publique est envoyée au serveur. Panneau d'administration pour la
   remplacer (code de double authentification) et bandeau tant qu'aucune clé n'est en place. La clé privée n'est gardée qu'en
   mémoire du composant : jamais dans l'adresse, le stockage du navigateur ni une requête. */
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Code,
  CopyButton,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  empreinteCleSecours,
  finCleSecoursCorrespond,
  genererCleSecours,
  type CleSecoursAEnregistrer,
  type CleSecoursEtat,
  type CleSecoursGeneree,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, get, saveBlob } from '../api';
import { useCan } from '../session';
import { ErrorAlert, fmtDate } from './common';

export const CLE_CLE_SECOURS = ['admin', 'sauvegardes', 'cle-secours'] as const;

/** État de la clé de secours ; `suivre` rafraîchit toutes les 15 s (panneau ouvert, en attente de l'exécutant). */
export function useEtatCleSecours(actif: boolean, suivre = false) {
  return useQuery({
    queryKey: CLE_CLE_SECOURS,
    queryFn: () => get<CleSecoursEtat>('/api/admin/cle-secours-sauvegardes'),
    enabled: actif,
    refetchInterval: suivre ? 15_000 : false,
  });
}

const nomFichier = () => `cle-secours-sauvegardes-${new Date().toISOString().slice(0, 10)}.txt`;

/** Génère la clé, la fait télécharger, puis demande la preuve de rangement (8 derniers caractères de la clé privée). */
export function GenerationCleSecours({ onChange }: { onChange: (c: CleSecoursAEnregistrer | null) => void }) {
  const [cle, setCle] = useState<CleSecoursGeneree | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [coffre, setCoffre] = useState(false);
  const [fin, setFin] = useState('');
  const finOk = !!cle && finCleSecoursCorrespond(cle.privee, fin);
  const publique = cle && coffre && finOk ? cle.publique : null;
  useEffect(() => onChange(publique ? { publique, coffre: true } : null), [publique, onChange]);

  const generer = async () => {
    setErreur(null);
    setCoffre(false);
    setFin('');
    try {
      setCle(await genererCleSecours());
    } catch {
      setErreur(
        'Ce navigateur ne sait pas générer la clé (X25519) : utilisez une version récente de Firefox, Chrome, Edge ou Safari.',
      );
    }
  };

  return (
    <Stack gap="sm">
      <Text size="sm">
        Chaque sauvegarde est chiffrée pour deux clés : celle du serveur, créée automatiquement, et cette clé de
        secours, générée ici par votre navigateur. Elle permet de restaurer les données si le serveur et sa clé sont
        perdus. Seule sa partie publique est envoyée au serveur.
      </Text>
      {erreur && (
        <Alert color="red" role="alert">
          {erreur}
        </Alert>
      )}
      {!cle ? (
        <Group>
          <Button onClick={() => void generer()}>Générer la clé de secours</Button>
        </Group>
      ) : (
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Clé privée de secours
          </Text>
          <Code block fz="sm" aria-label="Clé privée de secours" data-testid="cle-secours-privee">
            {cle.privee}
          </Code>
          <Group gap="xs">
            <Button variant="default" size="xs" onClick={() => saveBlob(nomFichier(), cle.fichier, 'text/plain')}>
              Télécharger le fichier de la clé
            </Button>
            <CopyButton value={cle.privee}>
              {({ copied, copy }) => (
                <Button variant="default" size="xs" onClick={copy}>
                  {copied ? 'Copiée' : 'Copier la clé privée'}
                </Button>
              )}
            </CopyButton>
            <Button variant="subtle" size="xs" onClick={() => void generer()}>
              Générer une autre clé
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            Clé publique (enregistrée sur le serveur) : <Code>{cle.publique}</Code>
          </Text>
          <Alert color="orange" title="À conserver hors du serveur" role="note">
            Rangez le fichier ou la clé privée dans le coffre-fort de l’organisation, avec le poivre. Elle ne sera plus
            jamais affichée et ne doit jamais être copiée sur le serveur. Sans elle ni la clé du serveur, les
            sauvegardes sont illisibles.
          </Alert>
          <Checkbox
            label="J’ai rangé la clé privée de secours dans le coffre-fort de l’organisation"
            checked={coffre}
            onChange={(e) => setCoffre(e.currentTarget.checked)}
          />
          <TextInput
            label="Les 8 derniers caractères de la clé privée"
            description="Recopiez-les depuis le coffre-fort pour prouver le rangement."
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
            value={fin}
            onChange={(e) => setFin(e.currentTarget.value)}
            error={fin !== '' && !finOk ? 'Ne correspond pas à la fin de la clé privée.' : undefined}
          />
        </Stack>
      )}
    </Stack>
  );
}

/** Panneau de l'administration : état de la clé de secours et remplacement. */
export function CleSecoursPanel() {
  const qc = useQueryClient();
  const peutAdministrer = useCan()('administration', 'administrer');
  const q = useEtatCleSecours(true, true);
  const [nouvelle, setNouvelle] = useState<CleSecoursAEnregistrer | null>(null);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fait, setFait] = useState(false);
  const [cle, setCle] = useState(0);
  const etat = q.data;
  if (!etat || !Array.isArray(etat.serveur)) return <ErrorAlert error={q.error} />;
  const enregistree = etat.publique;
  const pret = !!nouvelle && /^\d{6}$/.test(code);

  async function envoyer() {
    if (!nouvelle) return;
    setPending(true);
    setError(null);
    setFait(false);
    try {
      qc.setQueryData(
        CLE_CLE_SECOURS,
        await api<CleSecoursEtat>('POST', '/api/admin/cle-secours-sauvegardes', {
          body: { cleSecours: nouvelle, code },
        }),
      );
      setFait(true);
      setNouvelle(null);
      setCle((n) => n + 1);
    } catch (e) {
      setError(e);
    } finally {
      setCode('');
      setPending(false);
    }
  }

  return (
    <Card component="section" withBorder padding="md" aria-labelledby="cle-secours-titre">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={3} id="cle-secours-titre">
            Clé de secours des sauvegardes
          </Title>
          <Badge color={etat.sauvegardesPossibles ? 'green' : 'red'} variant="light">
            {etat.sauvegardesPossibles ? 'En place' : enregistree ? 'En attente de l’exécutant' : 'Non définie'}
          </Badge>
        </Group>
        <Text size="sm">
          {enregistree
            ? `Clé se terminant par ${empreinteCleSecours(enregistree)}, définie le ${fmtDate(etat.definiLe)} par ${etat.definiPar ?? '—'}.`
            : etat.serveur.length
              ? `Clé déposée sur le serveur, se terminant par ${empreinteCleSecours(etat.serveur[0]!)}.`
              : 'Aucune clé de secours : les sauvegardes sont bloquées tant qu’elle n’est pas définie.'}{' '}
          {enregistree &&
            !etat.serveur.includes(enregistree) &&
            'L’exécutant des sauvegardes la recopiera sous une minute.'}
        </Text>
        <ErrorAlert error={error} />
        {fait && (
          <Alert color="green" role="status">
            Clé de secours enregistrée : les prochaines sauvegardes seront chiffrées pour elle. Les sauvegardes déjà
            faites restent lisibles avec l’ancienne clé de secours : conservez-la tant qu’elles existent.
          </Alert>
        )}
        {peutAdministrer && (
          <>
            <Title order={4}>
              {enregistree || etat.serveur.length ? 'Remplacer la clé de secours' : 'Définir la clé de secours'}
            </Title>
            <GenerationCleSecours key={cle} onChange={setNouvelle} />
            <TextInput
              label="Code de double authentification"
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
            />
            <Group>
              <Button disabled={!pret || pending} loading={pending} onClick={() => void envoyer()}>
                Enregistrer la clé de secours
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Card>
  );
}

/** Bandeau non fermable pour les administrateurs tant qu'aucune clé de secours n'est en place (sauvegardes bloquées). */
export function CleSecoursNotice() {
  const peutAdministrer = useCan()('administration', 'administrer');
  const q = useEtatCleSecours(peutAdministrer);
  if (!peutAdministrer || !q.data || q.data.publique || !Array.isArray(q.data.serveur) || q.data.serveur.length)
    return null;
  return (
    <div className="update-notice" role="alert" data-cle-secours-requise>
      <span>
        Aucune clé de secours des sauvegardes : <b>les sauvegardes sont bloquées</b>.
      </span>
      <Anchor size="xs" component={Link} to="/systeme/sauvegardes">
        Définir la clé de secours
      </Anchor>
    </div>
  );
}

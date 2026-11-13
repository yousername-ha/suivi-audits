/* Clés de sécurité FIDO2 / WebAuthn (ADR 0079) : page « Sécurité du compte » (liste, ajout, renommage, révocation, codes de
   récupération), ré-authentification (mot de passe puis code ou clé) et enrôlement imposé à la connexion. Le serveur reste seul
   juge (ré-authentification récente, dernier facteur fort, politique) ; l'interface n'en reprend que les messages. */
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  List,
  Modal,
  PasswordInput,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { CLES_RECOMMANDEES, type CleOut, type FacteursOut } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api, ApiError, del, errorMessage, get, post, saveBlob } from '../api';
import { useMe, useRefreshMe } from '../session';
import { enrolerCle, MESSAGE_NAVIGATEUR, navigateurCompatible, reauthentifier } from '../webauthn';
import { ConfirmButton, ErrorAlert, fmtDate } from './common';

export const CLE_FACTEURS = ['account', 'factors'] as const;
export const useFacteurs = (actif = true) =>
  useQuery({ queryKey: CLE_FACTEURS, queryFn: () => get<FacteursOut>('/api/account/factors'), enabled: actif });

export const libelleType = (c: Pick<CleOut, 'deviceType' | 'backedUp'>) =>
  c.deviceType === 'multiDevice' ? (c.backedUp ? 'Passkey synchronisée' : 'Passkey') : 'Clé matérielle';

const heure = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );

/** Ré-authentification (step-up) : mot de passe, puis code TOTP ou clé. Valable 5 minutes côté serveur. */
export function Reauthentification({ facteurs, onOk }: { facteurs: FacteursOut; onOk: () => void }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cles = facteurs.cles.filter((c) => !c.revokedAt && !c.suspect).length;
  const sansFacteur = !facteurs.totpEnabled && cles === 0;
  const lancer = async (second: { code: string } | { cle: true } | null) => {
    setErr(null);
    setBusy(true);
    try {
      await reauthentifier(password, second);
      setPassword('');
      setCode('');
      onOk();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void lancer(sansFacteur ? null : { code });
      }}
    >
      <Stack className="formulaire" gap="sm">
        <Text size="sm">
          Confirmez votre identité pour ajouter ou révoquer une clé, ou générer des codes de récupération : la
          confirmation vaut 5 minutes.
        </Text>
        <PasswordInput
          label="Mot de passe"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        {!sansFacteur && facteurs.totpEnabled && (
          <TextInput
            label="Code de double authentification"
            description="Code à 6 chiffres de votre application d’authentification."
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, ''))}
          />
        )}
        {err && (
          <Alert color="red" role="alert">
            {err}
          </Alert>
        )}
        <Group gap="sm">
          {(sansFacteur || facteurs.totpEnabled) && (
            <Button type="submit" loading={busy} disabled={!password || (!sansFacteur && code.length !== 6)}>
              {sansFacteur ? 'Confirmer' : 'Confirmer avec le code'}
            </Button>
          )}
          {cles > 0 && facteurs.disponible && (
            <Button variant="light" loading={busy} disabled={!password} onClick={() => void lancer({ cle: true })}>
              Utiliser ma clé de sécurité
            </Button>
          )}
        </Group>
      </Stack>
    </form>
  );
}

/** Ajout d'une clé : nom choisi par la personne, puis geste sur la clé (toucher, code PIN ou biométrie). */
export function AjoutCle({
  onAjout,
  libelleBouton = 'Ajouter une clé',
}: {
  onAjout: () => void;
  libelleBouton?: string;
}) {
  const [label, setLabel] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!navigateurCompatible()) return <Alert color="orange">{MESSAGE_NAVIGATEUR}</Alert>;
  return (
    <form
      onSubmit={async (e: FormEvent) => {
        e.preventDefault();
        setErr(null);
        setBusy(true);
        try {
          await enrolerCle(label.trim() || 'Clé de sécurité');
          setLabel('');
          notifications.show({ color: 'teal', message: 'Clé de sécurité enregistrée.' });
          onAjout();
        } catch (x) {
          setErr(errorMessage(x));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Stack className="formulaire" gap="sm">
        <TextInput
          label="Nom de la clé"
          description="Pour la reconnaître dans la liste, par exemple « YubiKey bureau » ou « YubiKey de secours »."
          maxLength={64}
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
        />
        {err && (
          <Alert color="red" role="alert">
            {err}
          </Alert>
        )}
        <Button type="submit" loading={busy} w="fit-content">
          {libelleBouton}
        </Button>
        <Text size="xs" c="dimmed">
          Le navigateur vous demande ensuite de brancher ou d’approcher la clé, de saisir son code PIN puis de la
          toucher.
        </Text>
      </Stack>
    </form>
  );
}

function Renommer({ cle, onFait }: { cle: CleOut; onFait: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [label, setLabel] = useState(cle.label);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <Button size="compact-sm" variant="default" onClick={() => setOuvert(true)}>
        Renommer
      </Button>
      <Modal opened={ouvert} onClose={() => setOuvert(false)} title="Renommer la clé" centered lockScroll={false}>
        <Stack>
          <TextInput
            label="Nom de la clé"
            maxLength={64}
            data-autofocus
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
          />
          {err && <Alert color="red">{err}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button
              disabled={!label.trim()}
              onClick={async () => {
                try {
                  await api('PATCH', `/api/account/webauthn/${cle.id}`, { body: { label: label.trim() } });
                  setOuvert(false);
                  onFait();
                } catch (x) {
                  setErr(errorMessage(x));
                }
              }}
            >
              Enregistrer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

/** Codes de récupération : affichés une seule fois, à imprimer ou ranger hors ligne. */
function CodesRecuperation({ restants, ouvert, onFait }: { restants: number; ouvert: boolean; onFait: () => void }) {
  const me = useMe();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Stack gap="xs">
      <Title order={3} size="h5">
        Codes de récupération
      </Title>
      <Text size="sm" c="dimmed">
        À utiliser une seule fois chacun si vous n’avez ni votre clé ni votre téléphone. {restants} code
        {restants > 1 ? 's' : ''} restant{restants > 1 ? 's' : ''}.
      </Text>
      {err && <Alert color="red">{err}</Alert>}
      <Button
        variant="light"
        w="fit-content"
        disabled={!ouvert}
        onClick={async () => {
          setErr(null);
          try {
            setCodes((await post<{ codes: string[] }>('/api/account/recovery-codes', {})).codes);
            onFait();
          } catch (x) {
            setErr(errorMessage(x));
          }
        }}
      >
        {restants > 0 ? 'Générer de nouveaux codes (annule les anciens)' : 'Générer mes codes de récupération'}
      </Button>
      <Modal
        opened={!!codes}
        onClose={() => setCodes(null)}
        title="Vos codes de récupération"
        centered
        lockScroll={false}
      >
        <Stack>
          <Alert color="orange">
            Ces codes ne seront plus jamais affichés. Rangez-les hors ligne (imprimés, coffre-fort de mots de passe) :
            chacun ne sert qu’une fois.
          </Alert>
          <List className="mono" data-testid="codes-recuperation">
            {(codes ?? []).map((c) => (
              <List.Item key={c}>{c}</List.Item>
            ))}
          </List>
          <Group justify="flex-end">
            <CopyButton value={(codes ?? []).join('\n')}>
              {({ copied, copy }) => (
                <Button variant="default" onClick={copy}>
                  {copied ? 'Copiés' : 'Copier'}
                </Button>
              )}
            </CopyButton>
            <Button
              variant="default"
              onClick={() =>
                saveBlob(
                  `codes-recuperation-${me.user?.username ?? 'compte'}.txt`,
                  `${me.appName} — codes de récupération de ${me.user?.username ?? ''}\n\n${(codes ?? []).join('\n')}\n`,
                  'text/plain',
                )
              }
            >
              Télécharger
            </Button>
            <Button onClick={() => setCodes(null)}>J’ai rangé mes codes</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

/** Carte « Clés de sécurité » de la page Mon compte. */
export function ClesSecuriteCard() {
  const me = useMe();
  const qc = useQueryClient();
  const refresh = useRefreshMe();
  const q = useFacteurs(me.webauthn);
  const recharger = async () => {
    await qc.invalidateQueries({ queryKey: CLE_FACTEURS });
    await refresh();
  };
  const f = q.data;
  const reauth = !!f?.reauthJusqua;
  const actives = (f?.cles ?? []).filter((c) => !c.revokedAt);
  return (
    <Card withBorder>
      <Title order={2} size="h4" mb="xs">
        Clés de sécurité (FIDO2)
      </Title>
      {!me.webauthn ? (
        <Text size="sm" c="dimmed">
          Les clés de sécurité ne sont pas proposées sur ce serveur : l’adresse du site doit être un nom de domaine en
          HTTPS. Votre code de double authentification reste utilisé.
        </Text>
      ) : (
        <Stack gap="md">
          <Text size="sm" c="dimmed" className="lecture">
            Une clé de sécurité (YubiKey, clé FIDO2) remplace le code à 6 chiffres à la connexion : branchez-la,
            saisissez son code PIN et touchez-la. Votre code de double authentification reste utilisable en secours.
          </Text>
          <ErrorAlert error={q.error} />
          {f?.obligatoire && (
            <Alert color={f.echeance ? 'orange' : 'red'}>
              {f.echeance
                ? `Une clé de sécurité sera obligatoire pour votre compte à partir du ${fmtDate(f.echeance)}.`
                : 'Une clé de sécurité est obligatoire pour votre compte.'}
            </Alert>
          )}
          {f && actives.length < CLES_RECOMMANDEES && (
            <Alert color="blue">
              Nous recommandons d’enregistrer {CLES_RECOMMANDEES} clés : une utilisée au quotidien, une de secours
              rangée en lieu sûr.
            </Alert>
          )}
          {actives.length > 0 && (
            <div className="table-wrap" role="region" aria-label="Mes clés de sécurité" tabIndex={0}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nom</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Ajoutée le</Table.Th>
                    <Table.Th>Dernière utilisation</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {actives.map((c) => (
                    <Table.Tr key={c.id}>
                      <Table.Td>
                        {c.label} {c.suspect && <Badge color="red">suspendue</Badge>}
                      </Table.Td>
                      <Table.Td>{libelleType(c)}</Table.Td>
                      <Table.Td className="nowrap">{fmtDate(c.createdAt)}</Table.Td>
                      <Table.Td className="nowrap">{c.lastUsedAt ? fmtDate(c.lastUsedAt) : 'jamais'}</Table.Td>
                      <Table.Td>
                        <Group gap="2xs" wrap="nowrap">
                          <Renommer cle={c} onFait={() => void recharger()} />
                          <ConfirmButton
                            size="compact-sm"
                            variant="light"
                            disabled={!reauth}
                            message={`Révoquer la clé « ${c.label} » ? Elle ne permettra plus de vous connecter.`}
                            onConfirm={async () => {
                              try {
                                await del(`/api/account/webauthn/${c.id}`);
                                notifications.show({ color: 'teal', message: 'Clé révoquée.' });
                              } catch (x) {
                                notifications.show({ color: 'red', message: errorMessage(x) });
                              }
                              await recharger();
                            }}
                          >
                            Révoquer
                          </ConfirmButton>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}
          {f && !reauth && <Reauthentification facteurs={f} onOk={() => void recharger()} />}
          {f && reauth && (
            <>
              <Text size="sm" c="teal">
                Identité confirmée jusqu’à {heure(f.reauthJusqua!)}.
              </Text>
              <AjoutCle onAjout={() => void recharger()} />
            </>
          )}
          {f && <CodesRecuperation restants={f.codesRestants} ouvert={reauth} onFait={() => void recharger()} />}
        </Stack>
      )}
    </Card>
  );
}

/** Étape « enroll_key » de la connexion : clé exigée (politique des administrateurs, ou ré-enrôlement imposé). */
export function EnrolementImpose() {
  const refresh = useRefreshMe();
  const qc = useQueryClient();
  const q = useFacteurs();
  const f = q.data;
  const pret = !!f?.reauthJusqua;
  return (
    <Stack>
      <Text size="sm">
        {f?.reenrolement
          ? 'Un administrateur a réinitialisé vos clés de sécurité : enregistrez-en une nouvelle pour continuer.'
          : 'Une clé de sécurité est obligatoire pour votre compte : enregistrez-en une pour continuer.'}
      </Text>
      <ErrorAlert error={q.error instanceof ApiError ? q.error : null} />
      {f && !pret && (
        <Reauthentification facteurs={f} onOk={() => void qc.invalidateQueries({ queryKey: CLE_FACTEURS })} />
      )}
      {f && pret && <AjoutCle libelleBouton="Enregistrer ma clé" onAjout={() => void refresh()} />}
    </Stack>
  );
}

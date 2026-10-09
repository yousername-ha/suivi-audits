/* Lot A : catalogue et opérations du serveur, composants et tokens Sauge existants. */
import {
  Alert,
  Button,
  Card,
  FileInput,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  nextBackupAt,
  type BackupPolicyOut,
  type BackupsOut,
  type ExploitationOut,
  type OperationIn,
  type OperationOut,
} from '@suivi/shared';
import { StatusChip, type Etat } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, get, post } from '../api';
import { ConfirmButton, ErrorAlert, fmtDate, fmtOctets } from '../components/common';
import { useCan } from '../session';

const KEY = ['admin', 'exploitation'];
const STATES: Record<OperationOut['status'], [Etat, string]> = {
  en_attente: ['attention', 'En attente'],
  en_cours: ['info', 'En cours'],
  reussie: ['succes', 'Réussie'],
  echec: ['erreur', 'Échec'],
  annulee: ['neutre', 'Annulée'],
  intervention: ['erreur', 'Intervention requise'],
};
const PHASES: Record<string, string> = {
  preparation: 'Contrôles préalables',
  sauvegarde_securite: 'Sauvegarde de sécurité',
  restauration: 'Restauration',
  retour_arriere: 'Retour arrière',
  tls_application: 'Application du certificat',
  tls_validation: 'Contrôle du frontal',
  tls_retour_arriere: 'Retour arrière TLS',
};
const KINDS: Record<OperationOut['kind'], string> = {
  verify: 'Vérification',
  restore: 'Restauration',
  tls_install: 'Remplacement TLS',
  tls_reset: 'Retour TLS à .env',
};
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((label, i) => ({
  value: String(i + 1),
  label,
}));

export function OperationsPanel() {
  const q = useQuery({
    queryKey: KEY,
    queryFn: () => get<ExploitationOut>('/api/admin/exploitation'),
    refetchInterval: 5000,
  });
  const backups = useQuery({
    queryKey: ['admin', 'sauvegardes'],
    queryFn: () => get<BackupsOut>('/api/admin/sauvegardes'),
    refetchInterval: 5000,
  });
  const qc = useQueryClient();
  const can = useCan();
  const admin = can('administration', 'administrer');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [draft, setDraft] = useState<BackupPolicyOut | null>(null);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [certificate, setCertificate] = useState<File | null>(null);
  const [key, setKey] = useState<File | null>(null);
  const ids = useRef(new Map<string, string>());
  const seen = useRef(new Map<string, string>());
  const initialized = useRef(false);
  useEffect(() => {
    if (!q.data) return;
    for (const j of q.data.jobs) {
      const before = seen.current.get(j.id);
      if (initialized.current && before !== j.status && ['reussie', 'echec', 'intervention'].includes(j.status))
        notifications.show({
          message: `${KINDS[j.kind]} : ${STATES[j.status][1]}. ${j.message}`,
          color: j.status === 'reussie' ? 'teal' : 'red',
        });
      seen.current.set(j.id, j.status);
    }
    initialized.current = true;
  }, [q.data]);
  const update = async (fn: () => Promise<unknown>) => {
    setPending(true);
    setError(null);
    try {
      await fn();
      await Promise.all([
        qc.invalidateQueries({ queryKey: KEY }),
        qc.invalidateQueries({ queryKey: ['admin', 'sauvegardes'] }),
        qc.invalidateQueries({ queryKey: ['admin', 'systeme'] }),
      ]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };
  const request = (
    input:
      | Omit<Extract<OperationIn, { kind: 'verify' }>, 'requestId'>
      | Omit<Extract<OperationIn, { kind: 'restore' }>, 'requestId'>
      | Omit<Extract<OperationIn, { kind: 'tls_install' }>, 'requestId'>
      | Omit<Extract<OperationIn, { kind: 'tls_reset' }>, 'requestId'>,
  ) =>
    update(async () => {
      const k = input.kind + ('archiveId' in input ? ':' + input.archiveId : '');
      const requestId = ids.current.get(k) ?? crypto.randomUUID();
      ids.current.set(k, requestId);
      await post<OperationOut>('/api/admin/exploitation/operations', { ...input, requestId });
      ids.current.delete(k);
      setSelected(null);
      setConfirmation('');
      if (input.kind === 'tls_install') {
        setCertificate(null);
        setKey(null);
      }
      notifications.show({
        message: 'Demande enregistrée. Suivez son résultat dans le journal des opérations.',
        color: 'blue',
      });
    });
  const host = q.data?.host;
  const policy = draft ?? q.data?.policy;
  const active =
    q.data?.jobs.some((j) => ['en_attente', 'en_cours', 'intervention'].includes(j.status)) ||
    backups.data?.jobs.some((j) => ['en_attente', 'en_cours'].includes(j.status));
  const disabled = pending || !q.data?.available || !!active;
  const archives = host?.archives.filter((a) => a.name.toLowerCase().includes(filter.toLowerCase())) ?? [];
  const archive = host?.archives.find((a) => a.id === selected);
  const verified = (id: string, sha: string) =>
    host?.jobs.some((j) => j.kind === 'verify' && j.status === 'reussie' && j.archiveId === id && j.sha256 === sha);
  const setPolicy = (patch: Partial<BackupPolicyOut>) => policy && setDraft({ ...policy, ...patch });
  const next = policy ? nextBackupAt(policy) : null;
  const cert = host?.certificate;
  const remaining = cert ? Math.ceil((Date.parse(cert.validTo) - Date.now()) / 86400000) : null;
  return (
    <Stack>
      <ErrorAlert error={error ?? q.error} />
      {!q.isPending && !q.data?.available && (
        <Alert color="yellow" title="Pilotage serveur indisponible">
          L’exécutant d’exploitation doit être configuré par l’administrateur du serveur. Les opérations sont
          désactivées tant qu’il ne répond pas.
        </Alert>
      )}
      {host?.message && (
        <Text size="sm" c="dimmed">
          {host.message} Dernier contact : {fmtDate(host.seenAt)}
        </Text>
      )}
      <Card withBorder>
        <Stack>
          <Title order={2} size="h4">
            Planification et rétention
          </Title>
          <Text size="sm">
            La destination et la clé de chiffrement restent configurées sur le serveur. La politique ci-dessous
            s’applique aux sauvegardes exécutées par le pilotage web.
          </Text>
          {host?.destination && <Text size="sm">Destination configurée : {host.destination}</Text>}
          {policy && (
            <>
              <Switch
                label="Activer la sauvegarde planifiée"
                checked={policy.enabled}
                disabled={!admin || pending}
                onChange={(e) => setPolicy({ enabled: e.currentTarget.checked })}
              />
              <MultiSelect
                label="Jours de sauvegarde"
                data={DAYS}
                value={policy.days.map(String)}
                disabled={!admin || pending}
                onChange={(v) => setPolicy({ days: v.map(Number) })}
              />
              <Group grow>
                <NumberInput
                  label="Heure UTC"
                  min={0}
                  max={23}
                  allowDecimal={false}
                  value={policy.hourUtc}
                  disabled={!admin || pending}
                  onChange={(v) => setPolicy({ hourUtc: Number(v) })}
                />
                <NumberInput
                  label="Minute UTC"
                  min={0}
                  max={59}
                  allowDecimal={false}
                  value={policy.minuteUtc}
                  disabled={!admin || pending}
                  onChange={(v) => setPolicy({ minuteUtc: Number(v) })}
                />
              </Group>
              <NumberInput
                label="Rétention (jours)"
                min={1}
                max={36500}
                allowDecimal={false}
                value={policy.retentionDays}
                disabled={!admin || pending}
                onChange={(v) => setPolicy({ retentionDays: Number(v) })}
              />
              <Text size="sm">
                {next
                  ? `Prochain créneau prévu : ${fmtDate(next)} (heure locale affichée ; programmation UTC).`
                  : 'Planification désactivée.'}
              </Text>
              <Text size="sm" c="dimmed">
                Une baisse de rétention peut supprimer les anciennes archives du préfixe standard lors de la prochaine
                sauvegarde. Les sauvegardes de sécurité de restauration restent conservées séparément. Le guide explique
                comment éviter un doublon avec un cron existant.
              </Text>
              {admin && (
                <Group>
                  <ConfirmButton
                    disabled={pending || !policy.days.length}
                    message="Enregistrer cette planification et cette rétention ? Les prochaines sauvegardes appliqueront cette politique."
                    onConfirm={() =>
                      void update(async () => {
                        const { version, ...body } = policy;
                        await api('PUT', '/api/admin/exploitation/politique', { body, ifMatch: version });
                        setDraft(null);
                        notifications.show({ message: 'Politique enregistrée.', color: 'teal' });
                      })
                    }
                  >
                    Enregistrer la politique
                  </ConfirmButton>
                  <Button
                    variant="default"
                    disabled={pending}
                    onClick={() => {
                      setDraft(null);
                      void q.refetch();
                    }}
                  >
                    Recharger la politique
                  </Button>
                </Group>
              )}
            </>
          )}
        </Stack>
      </Card>
      <Card withBorder>
        <Stack>
          <Title order={2} size="h4">
            Archives disponibles
          </Title>
          <Text size="sm">
            Les 200 archives les plus récentes de la destination configurée. L’empreinte prouve l’intégrité du fichier ;
            une vérification de structure ne remplace pas une restauration de recette isolée.
          </Text>
          <TextInput label="Rechercher une archive" value={filter} onChange={(e) => setFilter(e.currentTarget.value)} />
          {!archives.length && (
            <Text size="sm" c="dimmed">
              Aucune archive disponible pour ce filtre.
            </Text>
          )}
          {!!archives.length && (
            <div className="table-wrap">
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Archive</Table.Th>
                    <Table.Th>Contrôles</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {archives.map((a) => (
                    <Table.Tr key={a.id}>
                      <Table.Td>
                        <Text size="sm" className="mono">
                          {a.name}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {fmtDate(a.modifiedAt)} · {fmtOctets(a.size)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <StatusChip etat={a.integrity ? 'succes' : 'erreur'}>
                          {a.integrity ? 'SHA-256 cohérent' : 'Empreinte absente ou incohérente'}
                        </StatusChip>
                        <Text size="sm">
                          {a.encrypted ? 'Chiffrée' : 'Non chiffrée'}
                          {verified(a.id, a.sha256) ? ' · Structure vérifiée' : ''}
                        </Text>
                        <Text size="sm" className="mono">
                          {a.sha256}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {admin && (
                          <Group>
                            <Button
                              variant="default"
                              size="xs"
                              disabled={disabled || !host?.backupReady || !a.integrity}
                              onClick={() => void request({ kind: 'verify', archiveId: a.id, sha256: a.sha256 })}
                            >
                              Vérifier
                            </Button>
                            <Button
                              size="xs"
                              color="red"
                              disabled={
                                disabled ||
                                !host?.restoreReady ||
                                !a.encrypted ||
                                !a.integrity ||
                                !verified(a.id, a.sha256)
                              }
                              onClick={() => {
                                setSelected(a.id);
                                setConfirmation('');
                              }}
                            >
                              Restaurer
                            </Button>
                          </Group>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}
        </Stack>
      </Card>
      <Card withBorder>
        <Stack>
          <Title order={2} size="h4">
            Certificats TLS
          </Title>
          <Text size="sm">
            Configuration active :{' '}
            {host?.tlsMode === 'web'
              ? 'certificat web'
              : host?.tlsMode === 'external'
                ? 'infrastructure externe'
                : '.env'}
            . La gestion web nécessite une activation explicite sur le serveur. Sans certificat web actif, CADDY_TLS
            dans .env reste prioritaire.
          </Text>
          {cert ? (
            <>
              <Text size="sm">Sujet : {cert.subject}</Text>
              <Text size="sm">Émetteur : {cert.issuer}</Text>
              <Text size="sm">
                Validité : {fmtDate(cert.validFrom)} au {fmtDate(cert.validTo)}
              </Text>
              <Text size="sm" className="mono">
                Empreinte SHA-256 : {cert.fingerprint}
              </Text>
              <Text size="sm">
                Correspondance avec l’hôte : {cert.hostMatches ? 'oui' : 'non'}. Cohérence clé/certificat :{' '}
                {cert.keyMatches === null
                  ? 'non exposée par l’observation'
                  : cert.keyMatches
                    ? 'vérifiée'
                    : 'incohérente'}
                .
              </Text>
              {remaining !== null && remaining <= 30 && (
                <Alert
                  color={remaining <= 0 ? 'red' : 'yellow'}
                  title={remaining <= 0 ? 'Certificat expiré' : 'Expiration prochaine'}
                >
                  {remaining <= 0 ? 'Le certificat a expiré.' : `Le certificat expire dans ${remaining} jour(s).`}{' '}
                  Vérifiez le renouvellement ou remplacez-le selon votre mode de déploiement.
                </Alert>
              )}
            </>
          ) : (
            <Text size="sm" c="dimmed">
              Métadonnées du certificat indisponibles. Vérifiez la connectivité du frontal.
            </Text>
          )}
          <Text size="sm">
            Caddy assure le renouvellement des certificats internes et ACME. Les certificats fournis manuellement
            nécessitent un remplacement. Une infrastructure TLS externe conserve sa propre procédure de gestion.
          </Text>
          {admin && host?.tlsManaged && host.tlsMode !== 'external' && (
            <>
              <FileInput
                label="Certificat et chaîne PEM"
                accept=".pem,.crt,.cer"
                value={certificate}
                disabled={disabled}
                onChange={(f) => {
                  setCertificate(f);
                  ids.current.delete('tls_install');
                }}
              />
              <FileInput
                label="Clé privée PEM (contenu masqué)"
                accept=".pem,.key"
                value={key}
                disabled={disabled}
                onChange={(f) => {
                  setKey(f);
                  ids.current.delete('tls_install');
                }}
              />
              <Text size="sm" c="dimmed">
                La clé est transmise par HTTPS, chiffrée à réception et jamais retournée ou affichée. Les clés protégées
                par mot de passe ne sont pas acceptées.
              </Text>
              <Group>
                <ConfirmButton
                  color="red"
                  disabled={disabled || !certificate || !key}
                  message="Remplacer le certificat TLS ? Le serveur contrôlera la clé, l’hôte, la validité et la santé. La configuration précédente sera rétablie en cas d’échec."
                  onConfirm={() => {
                    if (!certificate || !key) return;
                    if (certificate.size > 65536 || key.size > 16384) {
                      setError('Fichier PEM trop volumineux.');
                      return;
                    }
                    void update(async () => {
                      const [pem, privateKey] = await Promise.all([certificate.text(), key.text()]);
                      const id = ids.current.get('tls_install') ?? crypto.randomUUID();
                      ids.current.set('tls_install', id);
                      await post('/api/admin/exploitation/operations', {
                        requestId: id,
                        kind: 'tls_install',
                        certificate: pem,
                        privateKey,
                      });
                      ids.current.delete('tls_install');
                      setCertificate(null);
                      setKey(null);
                      notifications.show({
                        message: 'Remplacement TLS demandé. Consultez son résultat dans le journal.',
                        color: 'blue',
                      });
                    });
                  }}
                >
                  Remplacer le certificat
                </ConfirmButton>
                <ConfirmButton
                  disabled={disabled || host.tlsMode !== 'web'}
                  message="Revenir à CADDY_TLS dans .env ? Le certificat web sera désactivé après validation du frontal."
                  onConfirm={() => void request({ kind: 'tls_reset', confirmation: 'REVENIR' })}
                >
                  Revenir à .env
                </ConfirmButton>
              </Group>
            </>
          )}
        </Stack>
      </Card>
      <Card withBorder>
        <Stack>
          <Title order={2} size="h4">
            Journal des opérations
          </Title>
          <Text size="sm">
            Le journal serveur demeure disponible après restauration et reconnexion. Une intervention requise bloque les
            nouvelles opérations jusqu’à la reprise par l’exploitant.
          </Text>
          {q.data?.jobs.length === 0 && (
            <Text size="sm" c="dimmed">
              Aucune opération.
            </Text>
          )}
          {!!q.data?.jobs.length && (
            <div className="table-wrap">
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Opération</Table.Th>
                    <Table.Th>État</Table.Th>
                    <Table.Th>Résultat</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {q.data.jobs.map((j) => (
                    <Table.Tr key={j.id}>
                      <Table.Td>
                        <Text size="sm">
                          {KINDS[j.kind]} · {fmtDate(j.createdAt)}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {j.requestedBy}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <StatusChip etat={STATES[j.status][0]}>{STATES[j.status][1]}</StatusChip>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {j.message || (j.status === 'en_attente' ? 'En attente du serveur.' : 'Opération en cours.')}{' '}
                          {j.status === 'en_cours' && (PHASES[j.phase] ?? 'Traitement')}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {admin && j.status === 'en_attente' && (
                          <Button
                            variant="default"
                            size="xs"
                            disabled={pending}
                            onClick={() =>
                              void update(() =>
                                api('POST', `/api/admin/exploitation/operations/${j.id}/annuler`, {
                                  body: {},
                                  ifMatch: j.version,
                                }),
                              )
                            }
                          >
                            Annuler l’opération
                          </Button>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}
        </Stack>
      </Card>
      <Modal
        opened={selected !== null}
        onClose={() => {
          if (!pending) setSelected(null);
        }}
        title="Restaurer cette sauvegarde"
        closeOnClickOutside={!pending}
        closeOnEscape={!pending}
      >
        <Stack>
          <Alert color="red" title="Remplacement complet">
            Cette opération remplace les données, les secrets et les certificats sauvegardés. Les sessions seront
            fermées : une reconnexion sera nécessaire. Le serveur créera et vérifiera une sauvegarde de sécurité avant
            remplacement et tentera un retour arrière en cas d’échec.
          </Alert>
          <Text size="sm">
            Serveur concerné : {window.location.host}. Archive :{' '}
            {archive?.name ?? 'Archive devenue indisponible ; fermez ce dialogue.'}
          </Text>
          <Text size="sm" className="mono">
            SHA-256 : {archive?.sha256 ?? '—'}
          </Text>
          <Text size="sm">
            Vérifiez le périmètre et la date de cette sauvegarde. L’indisponibilité peut durer pendant la restauration ;
            consultez ensuite le journal après reconnexion.
          </Text>
          <TextInput
            label="Taper RESTAURER pour confirmer"
            value={confirmation}
            disabled={pending}
            onChange={(e) => setConfirmation(e.currentTarget.value)}
          />
          <Button
            color="red"
            disabled={disabled || confirmation !== 'RESTAURER' || !archive || !verified(archive.id, archive.sha256)}
            onClick={() =>
              archive &&
              void request({
                kind: 'restore',
                archiveId: archive.id,
                sha256: archive.sha256,
                confirmation: 'RESTAURER',
              })
            }
          >
            Confirmer la restauration
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

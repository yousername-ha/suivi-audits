/* Administration : facteurs d'authentification d'un compte (ADR 0079). Révocation d'une clé, réactivation d'une clé suspendue
   et réinitialisation (toutes les clés révoquées, ré-enrôlement imposé) : chaque intervention exige un motif, consigné au
   journal d'audit. Pas de double validation (décision du RSSI). */
import { Alert, Badge, Button, Group, Modal, Stack, Table, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { CleOut, FacteursOut } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage, get, post } from '../api';
import { libelleType } from './ClesSecurite';
import { ErrorAlert, fmtDate } from './common';

interface Intervention {
  titre: string;
  message: string;
  url: string;
  succes: string;
}

export function FacteursCompte({
  userId,
  username,
  ecriture,
}: {
  userId: string;
  username: string;
  ecriture: boolean;
}) {
  const qc = useQueryClient();
  const cle = ['admin', 'users', userId, 'factors'];
  const q = useQuery({ queryKey: cle, queryFn: () => get<FacteursOut>(`/api/admin/users/${userId}/factors`) });
  const [action, setAction] = useState<Intervention | null>(null);
  const [motif, setMotif] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const f = q.data;
  const etat = (c: CleOut) =>
    c.revokedAt ? (
      <Badge color="gray">révoquée le {fmtDate(c.revokedAt)}</Badge>
    ) : c.suspect ? (
      <Badge color="red">suspendue (compteur)</Badge>
    ) : (
      <Badge color="teal">active</Badge>
    );
  return (
    <Stack>
      <ErrorAlert error={q.error} />
      {f && (
        <>
          <Group gap="xs">
            <Badge color={f.totpEnabled ? 'teal' : 'orange'}>TOTP {f.totpEnabled ? 'actif' : 'à configurer'}</Badge>
            <Badge variant="light">{f.codesRestants} code(s) de récupération</Badge>
            {f.obligatoire && (
              <Badge color="violet">clé obligatoire{f.echeance ? ` au ${fmtDate(f.echeance)}` : ''}</Badge>
            )}
            {f.reenrolement && <Badge color="orange">ré-enrôlement imposé</Badge>}
          </Group>
          {f.cles.length === 0 ? (
            <Text size="sm" c="dimmed">
              Aucune clé de sécurité enregistrée.
            </Text>
          ) : (
            <div className="table-wrap" role="region" aria-label={`Clés de sécurité de ${username}`} tabIndex={0}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nom</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>AAGUID</Table.Th>
                    <Table.Th>Ajoutée le</Table.Th>
                    <Table.Th>Dernière utilisation</Table.Th>
                    <Table.Th>État</Table.Th>
                    {ecriture && <Table.Th>Actions</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {f.cles.map((c) => (
                    <Table.Tr key={c.id}>
                      <Table.Td>{c.label}</Table.Td>
                      <Table.Td>{libelleType(c)}</Table.Td>
                      <Table.Td className="mono">{c.aaguid}</Table.Td>
                      <Table.Td className="nowrap">{fmtDate(c.createdAt)}</Table.Td>
                      <Table.Td className="nowrap">{c.lastUsedAt ? fmtDate(c.lastUsedAt) : 'jamais'}</Table.Td>
                      <Table.Td>{etat(c)}</Table.Td>
                      {ecriture && (
                        <Table.Td>
                          {!c.revokedAt && (
                            <Group gap="2xs" wrap="nowrap">
                              {c.suspect && (
                                <Button
                                  size="compact-sm"
                                  variant="light"
                                  onClick={() =>
                                    setAction({
                                      titre: `Réactiver la clé « ${c.label} »`,
                                      message:
                                        'Réactivez seulement après avoir vérifié la clé avec son porteur (clé en sa possession, aucune perte ni prêt).',
                                      url: `/api/admin/users/${userId}/webauthn/${c.id}/reactivate`,
                                      succes: 'Clé réactivée.',
                                    })
                                  }
                                >
                                  Réactiver
                                </Button>
                              )}
                              <Button
                                size="compact-sm"
                                variant="light"
                                color="red"
                                onClick={() =>
                                  setAction({
                                    titre: `Révoquer la clé « ${c.label} »`,
                                    message:
                                      'La clé ne permettra plus de se connecter ; les sessions du compte sont fermées.',
                                    url: `/api/admin/users/${userId}/webauthn/${c.id}/revoke`,
                                    succes: 'Clé révoquée.',
                                  })
                                }
                              >
                                Révoquer
                              </Button>
                            </Group>
                          )}
                        </Table.Td>
                      )}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}
          {ecriture && (
            <Button
              variant="light"
              color="orange"
              w="fit-content"
              onClick={() =>
                setAction({
                  titre: `Réinitialiser les clés de ${username}`,
                  message:
                    'Toutes les clés sont révoquées, les codes de récupération effacés et les sessions fermées. Le compte devra enregistrer une nouvelle clé à sa prochaine connexion (après son mot de passe et son code TOTP).',
                  url: `/api/admin/users/${userId}/webauthn/reset`,
                  succes: 'Clés réinitialisées : ré-enrôlement imposé.',
                })
              }
            >
              Réinitialiser les clés (forcer le ré-enrôlement)
            </Button>
          )}
        </>
      )}
      <Modal opened={!!action} onClose={() => setAction(null)} title={action?.titre ?? ''} centered lockScroll={false}>
        <Stack>
          <Text size="sm">{action?.message}</Text>
          <Textarea
            label="Motif"
            description="Consigné au journal d’audit (exemple : clé perdue, ticket 1234 ; départ de poste)."
            required
            autosize
            minRows={2}
            maxLength={500}
            data-autofocus
            value={motif}
            onChange={(e) => setMotif(e.currentTarget.value)}
          />
          {err && <Alert color="red">{err}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setAction(null)}>
              Annuler
            </Button>
            <Button
              color="red"
              loading={busy}
              disabled={motif.trim().length < 3}
              onClick={async () => {
                if (!action) return;
                setErr(null);
                setBusy(true);
                try {
                  await post(action.url, { motif: motif.trim() });
                  notifications.show({ color: 'teal', message: action.succes });
                  setAction(null);
                  setMotif('');
                  await qc.invalidateQueries({ queryKey: ['admin'] });
                } catch (x) {
                  setErr(errorMessage(x));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirmer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

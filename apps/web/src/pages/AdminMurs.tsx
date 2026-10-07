/* Administration > Écrans muraux : création (lien d'activation affiché une seule fois), suivi, révocation. */
import { Button, Card, Group, MultiSelect, NumberInput, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { BUSINESS_MODULES, MODULE_LABELS, type BusinessModule, type WallOut } from '@suivi/shared';
import { DataTable, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api, errorMessage, get, post } from '../api';
import { ConfirmButton, ErrorAlert, fmtDate, SecretModal } from '../components/common';
import { useCan } from '../session';

function etat(w: WallOut) {
  if (w.revoked_at) return <StatusChip etat="neutre">Révoqué</StatusChip>;
  if (new Date(w.expires_at) < new Date()) return <StatusChip etat="neutre">Expiré</StatusChip>;
  if (!w.activated_at)
    return w.activation_expires && new Date(w.activation_expires) > new Date() ? (
      <StatusChip etat="attention">En attente d’activation</StatusChip>
    ) : (
      <StatusChip etat="erreur">Lien expiré</StatusChip>
    );
  return <StatusChip etat="succes">Actif</StatusChip>;
}

export function MursPanel() {
  const qc = useQueryClient();
  const can = useCan();
  const admin = can('administration', 'administrer');
  const q = useQuery({ queryKey: ['admin', 'murs'], queryFn: () => get<WallOut[]>('/api/admin/murs') });
  const [f, setF] = useState({ nom: '', jours: 180, modules: [...BUSINESS_MODULES] as BusinessModule[] });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lien, setLien] = useState<string | null>(null);

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await post<{ lien: string }>('/api/admin/murs', f);
      setLien(r.lien);
      setF({ ...f, nom: '' });
      await qc.invalidateQueries({ queryKey: ['admin', 'murs'] });
    } catch (x) {
      setErr(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack>
      <Text size="sm" c="dimmed" className="lecture">
        Un écran mural affiche le tableau de bord en plein écran (vue /mur), en lecture seule et en temps réel, sans
        compte nominatif. Il ne voit que les modules choisis ici. L’accès est limité à la vue /mur, expire à la date
        prévue et peut être révoqué à tout moment (effet en moins d’une minute).
      </Text>
      {admin && (
        <Card withBorder>
          <Title order={2} size="h4" mb="sm">
            Nouvel écran
          </Title>
          <form onSubmit={creer}>
            <div className="grille-formulaire">
              <div className="grille-formulaire__champs">
                <TextInput
                  label="Nom de l’écran"
                  description="Exemple : salle de réunion du 2e étage."
                  required
                  maxLength={80}
                  value={f.nom}
                  onChange={(e) => setF({ ...f, nom: e.currentTarget.value })}
                />
                <NumberInput
                  label="Durée de validité (jours)"
                  description="Entre 1 et 365 jours ; l’écran se coupe ensuite."
                  min={1}
                  max={365}
                  required
                  value={f.jours}
                  onChange={(v) => setF({ ...f, jours: Number(v) || 1 })}
                />
                <MultiSelect
                  label="Modules affichés"
                  required
                  data={BUSINESS_MODULES.map((m) => ({ value: m, label: MODULE_LABELS[m] }))}
                  value={f.modules}
                  onChange={(v) => setF({ ...f, modules: v as BusinessModule[] })}
                />
              </div>
            </div>
            {err && (
              <Text c="red" size="sm" mt="sm">
                {err}
              </Text>
            )}
            <Group justify="flex-end" mt="md">
              <Button type="submit" loading={busy} disabled={!f.nom.trim() || !f.modules.length}>
                Créer le lien d’activation
              </Button>
            </Group>
          </form>
        </Card>
      )}
      <ErrorAlert error={q.error} />
      <DataTable label="Écrans muraux">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Écran</Table.Th>
              <Table.Th>État</Table.Th>
              <Table.Th className="col-p2">Modules</Table.Th>
              <Table.Th>Expiration</Table.Th>
              <Table.Th className="col-p2">Dernière activité</Table.Th>
              <Table.Th className="col-p3">Créé par</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(q.data ?? []).map((w) => (
              <Table.Tr key={w.id}>
                <Table.Td>{w.name}</Table.Td>
                <Table.Td className="nowrap">{etat(w)}</Table.Td>
                <Table.Td className="col-p2">
                  {w.modules.length === BUSINESS_MODULES.length
                    ? 'Tous les modules métier'
                    : w.modules.map((m) => MODULE_LABELS[m as BusinessModule] ?? m).join(', ')}
                </Table.Td>
                <Table.Td className="nowrap">{fmtDate(w.expires_at)}</Table.Td>
                <Table.Td className="col-p2 nowrap">{fmtDate(w.last_seen_at) || '—'}</Table.Td>
                <Table.Td className="col-p3">{w.created_by}</Table.Td>
                <Table.Td>
                  {admin && !w.revoked_at && (
                    <ConfirmButton
                      size="xs"
                      variant="light"
                      message={`Révoquer l’écran « ${w.name} » ? Il n’aura plus accès au tableau de bord.`}
                      onConfirm={async () => {
                        await api('DELETE', `/api/admin/murs/${w.id}`);
                        await qc.invalidateQueries({ queryKey: ['admin', 'murs'] });
                        notifications.show({ color: 'teal', message: `Écran « ${w.name} » révoqué.` });
                      }}
                    >
                      Révoquer
                    </ConfirmButton>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {q.data && !q.data.length && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text size="sm" c="dimmed">
                    Aucun écran mural.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </DataTable>
      <SecretModal
        title="Lien d’activation de l’écran"
        intro="Ouvrez ce lien dans le navigateur de l’écran mural (valable 24 heures, utilisable une seule fois) :"
        secret={lien}
        onClose={() => setLien(null)}
        warning="Ce lien n’est affiché qu’une fois. Ne le diffusez pas : il donne accès au tableau de bord sans mot de passe jusqu’à son utilisation."
      />
    </Stack>
  );
}

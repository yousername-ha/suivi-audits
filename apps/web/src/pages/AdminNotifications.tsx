/* Destinataires des notifications (Administration, Plateforme) : réglage par groupe ou par rôle (« profil »), aperçu « qui
   recevrait quoi » avec l'origine de chaque destinataire et les exclusions personnelles. Les réglages d'un compte se font
   depuis sa fiche (Utilisateurs) ; chaque personne règle les siens dans Mon compte. Un réglage personnel l'emporte toujours
   sur ceux des groupes et des rôles (ADR 0058). */
import { Badge, Group, Select, Stack, Table, Text, Title } from '@mantine/core';
import {
  NOTIFICATION_CANAL_LABELS,
  NOTIFICATION_CANAUX,
  NOTIFICATION_TYPES,
  type ApercuDestinatairesDto,
  type CanalCourrielDto,
  type DestinataireApercuDto,
  type NotificationCanal,
  type NotificationType,
  type PorteeListeDto,
} from '@suivi/shared';
import { DataTable } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';
import { textOrigine } from '../notifications/libelles';
import { BandeauCourriel, EditeurReglages, NOTIFICATIONS_KEY } from '../notifications/Reglages';
import { useCan } from '../session';

interface EtatEnvois {
  courriel: CanalCourrielDto;
  envois: {
    enAttente: number;
    envoyees: number;
    echecs: number;
    derniereErreur: string | null;
    derniereErreurLe: string | null;
  };
}

export function NotificationsPanel() {
  const can = useCan();
  const ecriture = can('administration', 'administrer');
  const portees = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'portees'],
    queryFn: () => get<{ groupes: PorteeListeDto[]; roles: PorteeListeDto[] }>('/api/admin/notifications/portees'),
  });
  const etat = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'etat'],
    queryFn: () => get<EtatEnvois>('/api/admin/notifications/etat'),
  });
  const [portee, setPortee] = useState<string | null>(null);
  const liste = (l: PorteeListeDto[]) =>
    l.map((p) => ({
      value: `${p.kind}/${p.id}`,
      label: `${p.nom} (${p.membres} compte${p.membres > 1 ? 's' : ''} actif${p.membres > 1 ? 's' : ''})`,
    }));
  const e = etat.data?.envois;
  return (
    <Stack gap="xl">
      <Text size="sm" c="dimmed" className="lecture">
        Pour chaque type de notification, cochez un canal pour un groupe ou pour un rôle : tous ses comptes le
        reçoivent, sauf ceux qui l’ont retiré dans leur propre profil (le réglage personnel l’emporte toujours). Par
        défaut, la notification s’affiche dans l’application et aucun courriel n’est envoyé.
      </Text>
      <ErrorAlert error={portees.error ?? etat.error} />
      {etat.data && !portee && <BandeauCourriel courriel={etat.data.courriel} />}
      {e && (e.enAttente > 0 || e.envoyees > 0 || e.echecs > 0) && (
        <Group gap="xs" aria-label="Envois de courriel des sept derniers jours">
          <Text size="sm">Sept derniers jours :</Text>
          <Badge variant="light">
            {e.envoyees} envoyé{e.envoyees > 1 ? 's' : ''}
          </Badge>
          <Badge variant="light" color="gray">
            {e.enAttente} en attente
          </Badge>
          <Badge variant="light" color={e.echecs ? 'red' : 'gray'}>
            {e.echecs} échec{e.echecs > 1 ? 's' : ''}
          </Badge>
          {e.derniereErreur && (
            <Text size="xs" c="dimmed">
              Dernier échec{e.derniereErreurLe ? ` (${fmtDate(e.derniereErreurLe)})` : ''} : {e.derniereErreur}
            </Text>
          )}
        </Group>
      )}

      <Stack>
        <Title order={3} size="h5">
          Réglage par groupe ou par rôle
        </Title>
        <Select
          label="Groupe ou rôle"
          description="Le rôle est le « profil » de droits d’un compte, attribué directement ou par un groupe."
          placeholder="Choisir un groupe ou un rôle"
          searchable
          data={[
            { group: 'Groupes', items: liste(portees.data?.groupes ?? []) },
            { group: 'Rôles', items: liste(portees.data?.roles ?? []) },
          ]}
          value={portee}
          onChange={setPortee}
        />
        {portee && (
          <EditeurReglages
            key={portee}
            url={`/api/admin/notifications/reglages/${portee}`}
            ecriture={ecriture}
            sujet="son"
            etiquette="Réglages de notification de la portée choisie"
          />
        )}
      </Stack>

      <Apercu />
    </Stack>
  );
}

function Apercu() {
  const [type, setType] = useState<NotificationType>('task_due');
  const [canal, setCanal] = useState<NotificationCanal>('courriel');
  const q = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'apercu', type, canal],
    queryFn: () => get<ApercuDestinatairesDto>(`/api/admin/notifications/apercu?type=${type}&canal=${canal}`),
  });
  const d = q.data;
  const ligne = (x: DestinataireApercuDto, exclu: boolean) => (
    <Table.Tr key={x.userId}>
      <Table.Td>
        <Text fw={600}>{x.displayName}</Text>
        <Text size="xs" c="dimmed">
          {x.username}
        </Text>
      </Table.Td>
      <Table.Td>{exclu ? 'Exclu par son réglage personnel' : textOrigine(x.origine, x.sources)}</Table.Td>
      {canal === 'courriel' && (
        <Table.Td>
          {x.sansAdresse ? (
            <Badge color="orange" variant="light">
              Sans adresse : rien ne peut être envoyé
            </Badge>
          ) : (
            <Text size="sm">Adresse renseignée</Text>
          )}
        </Table.Td>
      )}
    </Table.Tr>
  );
  return (
    <Stack>
      <Title order={3} size="h5">
        Qui recevrait quoi
      </Title>
      <Group align="flex-end">
        <Select
          label="Type de notification"
          data={NOTIFICATION_TYPES.map((t) => ({ value: t.id, label: t.label }))}
          value={type}
          allowDeselect={false}
          onChange={(v) => v && setType(v as NotificationType)}
        />
        <Select
          label="Canal"
          data={NOTIFICATION_CANAUX.map((c) => ({ value: c, label: NOTIFICATION_CANAL_LABELS[c] }))}
          value={canal}
          allowDeselect={false}
          onChange={(v) => v && setCanal(v as NotificationCanal)}
        />
      </Group>
      <ErrorAlert error={q.error} />
      {d && (
        <>
          {canal === 'courriel' && !d.courriel.actif && (
            <Text size="sm" role="status">
              Courriel non configuré : même listés ci-dessous, ces comptes ne recevraient aucun courriel pour l’instant.
            </Text>
          )}
          <Text size="sm" role="status">
            {d.destinataires.length} destinataire{d.destinataires.length > 1 ? 's' : ''} (comptes actifs),{' '}
            {d.exclus.length} exclu{d.exclus.length > 1 ? 's' : ''} par un réglage personnel, {d.autres} sans réglage
            qui l’active.
          </Text>
          <DataTable label="Destinataires résolus">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Compte</Table.Th>
                  <Table.Th>Origine</Table.Th>
                  {canal === 'courriel' && <Table.Th>Adresse</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {d.destinataires.map((x) => ligne(x, false))}
                {d.exclus.map((x) => ligne(x, true))}
                {!d.destinataires.length && !d.exclus.length && (
                  <Table.Tr>
                    <Table.Td colSpan={canal === 'courriel' ? 3 : 2}>
                      <Text c="dimmed">Personne ne recevrait cette notification par ce canal.</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </DataTable>
        </>
      )}
    </Stack>
  );
}

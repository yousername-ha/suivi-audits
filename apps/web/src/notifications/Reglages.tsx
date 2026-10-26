/* Réglages de notification (décision 012-10, ADR 0058) : matrice type × canal en tri-état (« Non défini », « Activé »,
   « Désactivé »), avec le résultat effectif et son origine quand il s'agit d'un compte. Le même éditeur sert aux groupes, aux
   rôles, à la fiche d'un compte (administration) et à « Mon compte ». L'information ne repose jamais sur la couleur seule :
   chaque état est écrit en toutes lettres. Le serveur reste seul juge des droits et de la concurrence (If-Match). */
import { Alert, Button, Group, Select, Stack, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  NOTIFICATION_CANAL_LABELS,
  NOTIFICATION_CANAUX,
  NOTIFICATION_TYPES,
  type CanalCourrielDto,
  type EffectifDto,
  type NotificationCanal,
  type NotificationType,
  type Reglage,
  type ReglagesPorteeDto,
} from '@suivi/shared';
import { DataTable, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError, errorMessage, get } from '../api';
import { ErrorAlert } from '../components/common';
import { textOrigine } from './libelles';

export const NOTIFICATIONS_KEY = ['notifications'] as const;

const OPTIONS = [
  { value: 'herite', label: 'Non défini (hérite)' },
  { value: 'oui', label: 'Activé' },
  { value: 'non', label: 'Désactivé' },
];
const versChoix = (v: Reglage | undefined) => (v === true ? 'oui' : v === false ? 'non' : 'herite');
const depuisChoix = (c: string | null): Reglage => (c === 'oui' ? true : c === 'non' ? false : null);
const cle = (type: string, canal: string) => `${type}/${canal}`;

/** Avertissement du canal courriel : réglable, mais rien n'est envoyé tant que le courriel n'est pas configuré. */
export function BandeauCourriel({ courriel }: { courriel: CanalCourrielDto }) {
  return courriel.actif ? (
    <Alert color="teal" title="Courriel configuré" role="status">
      {courriel.message}
    </Alert>
  ) : (
    <Alert color="orange" title="Courriel non configuré, rien n’est envoyé" role="status">
      Le réglage « Par courriel » reste enregistrable, mais aucun courriel ne part tant que l’envoi n’est pas activé et
      configuré (Administration, Configuration système, Courriel).
    </Alert>
  );
}

interface MatriceProps {
  reglages: ReglagesPorteeDto['reglages'];
  effectifs?: EffectifDto[];
  brouillon: Record<string, Reglage>;
  onChange: (type: NotificationType, canal: NotificationCanal, valeur: Reglage) => void;
  lecture: boolean;
  sujet: string;
  etiquette: string;
}

function Matrice({ reglages, effectifs, brouillon, onChange, lecture, sujet, etiquette }: MatriceProps) {
  const base = new Map(reglages.map((r) => [cle(r.type, r.canal), r.valeur]));
  const eff = new Map((effectifs ?? []).map((e) => [cle(e.type, e.canal), e]));
  return (
    <DataTable label={etiquette}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Notification</Table.Th>
            {NOTIFICATION_CANAUX.map((canal) => (
              <Table.Th key={canal}>{NOTIFICATION_CANAL_LABELS[canal]}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {NOTIFICATION_TYPES.map((t) => (
            <Table.Tr key={t.id}>
              <Table.Td>
                <Text fw={600}>{t.label}</Text>
                <Text size="xs" c="dimmed">
                  {t.description}
                </Text>
              </Table.Td>
              {NOTIFICATION_CANAUX.map((canal) => {
                const k = cle(t.id, canal);
                const valeur = k in brouillon ? brouillon[k] : (base.get(k) ?? null);
                const e = eff.get(k);
                return (
                  <Table.Td key={canal}>
                    <Stack gap="2xs">
                      <Select
                        aria-label={`${t.label} : ${NOTIFICATION_CANAL_LABELS[canal]}`}
                        data={OPTIONS}
                        value={versChoix(valeur)}
                        allowDeselect={false}
                        disabled={lecture}
                        onChange={(c) => onChange(t.id, canal, depuisChoix(c))}
                      />
                      {e && (
                        <Group gap="xs">
                          <StatusChip etat={e.actif ? 'succes' : 'neutre'}>
                            {e.actif ? 'Résultat : activé' : 'Résultat : désactivé'}
                          </StatusChip>
                          <Text size="xs" c="dimmed">
                            {textOrigine(e.origine, e.sources, sujet)}
                          </Text>
                        </Group>
                      )}
                      {e?.exclu && (
                        <Text size="xs">Exclu par {sujet} réglage personnel alors que l’héritage l’activerait.</Text>
                      )}
                    </Stack>
                  </Table.Td>
                );
              })}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Éditeur d'une portée : charge, affiche, enregistre les seuls changements avec If-Match, recharge en cas de conflit. */
export function EditeurReglages({
  url,
  ecriture,
  sujet,
  etiquette,
  introduction,
}: {
  url: string;
  ecriture: boolean;
  /** « votre » (Mon compte) ou « son » (fiche d'un autre compte). */
  sujet: 'votre' | 'son';
  etiquette: string;
  introduction?: string;
}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...NOTIFICATIONS_KEY, 'reglages', url], queryFn: () => get<ReglagesPorteeDto>(url) });
  const [brouillon, setBrouillon] = useState<Record<string, Reglage>>({});
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const data = q.data;
  const base = new Map((data?.reglages ?? []).map((r) => [cle(r.type, r.canal), r.valeur]));
  const changements = Object.entries(brouillon)
    .filter(([k, v]) => (base.get(k) ?? null) !== v)
    .map(([k, valeur]) => {
      const [type, canal] = k.split('/') as [NotificationType, NotificationCanal];
      return { type, canal, valeur };
    });

  const enregistrer = async () => {
    if (!data) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const out = await api<ReglagesPorteeDto>('PUT', url, { body: { changements }, ifMatch: data.version });
      qc.setQueryData([...NOTIFICATIONS_KEY, 'reglages', url], out);
      await qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY, 'apercu'] });
      setBrouillon({});
      notifications.show({ color: 'teal', message: 'Réglages de notification enregistrés.' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 412) {
        setErreur(
          'Ces réglages ont été modifiés par quelqu’un d’autre depuis leur ouverture. Ils ont été rechargés : refaites vos modifications.',
        );
        setBrouillon({});
        await q.refetch();
      } else setErreur(errorMessage(e));
    } finally {
      setEnvoi(false);
    }
  };

  if (q.error) return <ErrorAlert error={q.error} />;
  if (!data) return <Text c="dimmed">Chargement des réglages…</Text>;
  return (
    <Stack>
      {introduction && (
        <Text size="sm" c="dimmed" className="lecture">
          {introduction}
        </Text>
      )}
      <BandeauCourriel courriel={data.courriel} />
      {data.sansAdresse && (
        <Alert color="orange" title="Aucune adresse courriel" role="status">
          {sujet === 'votre' ? 'Votre compte' : 'Ce compte'} n’a pas d’adresse courriel renseignée : le canal « Par
          courriel » ne peut rien envoyer.
        </Alert>
      )}
      {erreur && (
        <Alert color="red" role="alert">
          {erreur}
        </Alert>
      )}
      <Matrice
        reglages={data.reglages}
        effectifs={data.effectifs}
        brouillon={brouillon}
        onChange={(type, canal, valeur) => setBrouillon({ ...brouillon, [cle(type, canal)]: valeur })}
        lecture={!ecriture || envoi}
        sujet={sujet}
        etiquette={etiquette}
      />
      {ecriture && (
        <Group justify="flex-end">
          <Button variant="default" disabled={!changements.length || envoi} onClick={() => setBrouillon({})}>
            Annuler les modifications
          </Button>
          <Button loading={envoi} disabled={!changements.length} onClick={() => void enregistrer()}>
            Enregistrer
          </Button>
        </Group>
      )}
      {!ecriture && (
        <Text size="sm" c="dimmed">
          Lecture seule : l’administration des comptes est requise pour modifier ces réglages.
        </Text>
      )}
    </Stack>
  );
}

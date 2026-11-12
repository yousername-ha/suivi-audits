/* Autonomie de l'assistant RSSI (ADR 0086, lot A3) : rondes et leurs rapports, missions confiées par le RSSI, mémoire par
   profil. Une ronde lit avec les droits de son référent ; son rapport n'est rendu qu'à lui et aux administrateurs de
   l'assistant (le serveur reste seul juge). */
import { Badge, Button, Card, Group, Select, Stack, Text, Textarea, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { StatusChip } from '@suivi/ui';
import {
  MISSION_ASSISTANT_MAX,
  type MemoireAssistantDto,
  type MissionAssistantDto,
  type ProfilAssistant,
  type RondeAssistantDetailDto,
  type RondeAssistantDto,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get } from '../api';
import { ConfirmButton, ErrorAlert, fmtDate } from '../components/common';

const CLE_RONDES = ['assistant', 'rondes'];
const CLE_MISSIONS = ['assistant', 'missions'];
const CLE_MEMOIRE = ['assistant', 'memoire'];
type Profils = readonly { id: ProfilAssistant; libelle: string }[];
const ETATS = {
  en_cours: { etat: 'info', libelle: 'En cours' },
  terminee: { etat: 'succes', libelle: 'Terminée' },
  echec: { etat: 'erreur', libelle: 'Échec' },
} as const;

function useAction() {
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const agir = async (fn: () => Promise<unknown>, message?: string) => {
    setEnvoi(true);
    try {
      setErreur(null);
      await fn();
      if (message) notifications.show({ message, color: 'green' });
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return { erreur, envoi, agir };
}

function Rapport({ id }: { id: string }) {
  const q = useQuery({
    queryKey: [...CLE_RONDES, id],
    queryFn: () => get<RondeAssistantDetailDto>(`/api/assistant/rondes/${id}`),
  });
  if (q.error) return <ErrorAlert error={q.error} />;
  if (!q.data) return <Text c="dimmed">Chargement du rapport…</Text>;
  const d = q.data;
  const elements = d.sources.filter((s) => s.objet);
  return (
    <Stack gap="xs">
      {d.erreur && <Text c="red">{d.erreur}</Text>}
      {d.rapport && <Text className="assistant-message__texte">{d.rapport}</Text>}
      {d.outils.length > 0 && (
        <Text size="xs" c="dimmed">
          Lectures et envois faits : {d.outils.map((o) => `${o.nom} (${o.elements})`).join(' ; ')}
        </Text>
      )}
      {elements.length > 0 && (
        <Text size="xs" c="dimmed">
          Éléments lus :{' '}
          {elements
            .slice(0, 12)
            .map((s) => s.nom)
            .join(' ; ')}
          {elements.length > 12 ? ` ; et ${elements.length - 12} autres` : ''}
        </Text>
      )}
    </Stack>
  );
}

/** Rondes de l'assistant : liste, rapport au clic, lancement immédiat pour un administrateur de l'assistant. */
export function RondesAssistant({ profils, peutLancer }: { profils: Profils; peutLancer: boolean }) {
  const qc = useQueryClient();
  const { erreur, envoi, agir } = useAction();
  const [profil, setProfil] = useState<ProfilAssistant | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const q = useQuery({
    queryKey: CLE_RONDES,
    queryFn: () => get<RondeAssistantDto[]>('/api/assistant/rondes'),
    // Ronde en cours : la liste est relue jusqu'à sa fin.
    refetchInterval: (x) => (x.state.data?.some((r) => r.etat === 'en_cours') ? 3000 : false),
  });
  const choisi = profil ?? profils[0]?.id ?? null;
  const libelle = (p: string) => profils.find((x) => x.id === p)?.libelle ?? p;
  const lancer = () =>
    agir(async () => {
      await api('POST', '/api/assistant/rondes', { body: { profil: choisi } });
      await qc.invalidateQueries({ queryKey: CLE_RONDES });
    }, 'Ronde lancée.');
  const liste = q.data ?? [];

  return (
    <Card withBorder>
      <Stack>
        <Title order={2} size="h4">
          Rondes de l’assistant
        </Title>
        <Text size="sm" c="dimmed">
          Pendant une ronde, l’assistant travaille seul : il relève les retards et les manques, rappelle les
          responsables et rend un rapport. Il ne modifie aucun registre.
        </Text>
        <ErrorAlert error={q.error ?? erreur} />
        {peutLancer && profils.length > 0 && (
          <Group align="flex-end">
            <Select
              label="Profil de la ronde"
              data={profils.map((p) => ({ value: p.id, label: p.libelle }))}
              value={choisi}
              onChange={(v) => setProfil(v as ProfilAssistant | null)}
              allowDeselect={false}
              comboboxProps={{ withinPortal: true }}
            />
            <Button variant="default" onClick={() => void lancer()} loading={envoi} disabled={!choisi}>
              Lancer une ronde maintenant
            </Button>
          </Group>
        )}
        {q.data && liste.length === 0 && <Text c="dimmed">Aucune ronde pour le moment.</Text>}
        {liste.map((r) => (
          <Card key={r.id} withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="xs">
                  <StatusChip etat={ETATS[r.etat].etat}>{ETATS[r.etat].libelle}</StatusChip>
                  <Text size="sm" fw={600}>
                    {libelle(r.profil)}
                  </Text>
                  <Text size="sm" c="dimmed" className="horodatage">
                    {fmtDate(r.debut)}
                  </Text>
                  <Badge variant="light" color="gray">
                    {r.declencheur === 'planifiee' ? 'Planifiée' : 'Demandée'}
                  </Badge>
                  {r.rappels > 0 && (
                    <Badge variant="light" color="gray">
                      {r.rappels} rappel{r.rappels > 1 ? 's' : ''}
                    </Badge>
                  )}
                </Group>
                {r.etat !== 'en_cours' && (
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    aria-expanded={ouverte === r.id}
                    onClick={() => setOuverte(ouverte === r.id ? null : r.id)}
                  >
                    {ouverte === r.id ? 'Fermer le rapport' : 'Lire le rapport'}
                  </Button>
                )}
              </Group>
              {r.referent && (
                <Text size="xs" c="dimmed">
                  Lectures faites avec les droits de {r.referent}.
                </Text>
              )}
              {ouverte === r.id && <Rapport id={r.id} />}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Card>
  );
}

/** Missions : consignes durables que l'assistant reprend à chaque ronde, jusqu'à leur clôture. */
export function MissionsAssistant({ profils }: { profils: Profils }) {
  const qc = useQueryClient();
  const { erreur, envoi, agir } = useAction();
  const [profil, setProfil] = useState<ProfilAssistant | null>(null);
  const [consigne, setConsigne] = useState('');
  const q = useQuery({ queryKey: CLE_MISSIONS, queryFn: () => get<MissionAssistantDto[]>('/api/assistant/missions') });
  const choisi = profil ?? profils[0]?.id ?? null;
  const libelle = (p: string) => profils.find((x) => x.id === p)?.libelle ?? p;
  const relire = () => qc.invalidateQueries({ queryKey: CLE_MISSIONS });

  return (
    <Card withBorder>
      <Stack>
        <Title order={3} size="h5">
          Missions
        </Title>
        <Text size="sm" c="dimmed">
          Une mission est une consigne durable, par exemple « suivre le plan d’action du dernier audit ». L’assistant la
          reprend à chaque ronde, jusqu’à sa clôture. N’y écrivez aucune donnée de santé.
        </Text>
        <ErrorAlert error={q.error ?? erreur} />
        {(q.data ?? []).map((m) => (
          <Group key={m.id} justify="space-between" wrap="nowrap" align="flex-start">
            <Stack gap="xs">
              <Text size="sm">{m.consigne}</Text>
              <Text size="xs" c="dimmed">
                {libelle(m.profil)} · confiée par {m.createdBy || 'inconnu'} le {fmtDate(m.createdAt)}
                {m.closedAt ? ` · close le ${fmtDate(m.closedAt)}` : ''}
              </Text>
            </Stack>
            {m.etat === 'ouverte' ? (
              <ConfirmButton
                variant="default"
                message="Clore cette mission ? L’assistant ne la reprendra plus."
                onConfirm={() =>
                  agir(async () => {
                    await api('POST', `/api/assistant/missions/${m.id}/cloture`);
                    await relire();
                  }, 'Mission close.')
                }
              >
                Clore
              </ConfirmButton>
            ) : (
              <StatusChip etat="neutre">Close</StatusChip>
            )}
          </Group>
        ))}
        <Select
          label="Profil de la nouvelle mission"
          data={profils.map((p) => ({ value: p.id, label: p.libelle }))}
          value={choisi}
          onChange={(v) => setProfil(v as ProfilAssistant | null)}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
        />
        <Textarea
          label="Consigne de la nouvelle mission"
          value={consigne}
          onChange={(e) => setConsigne(e.currentTarget.value)}
          maxLength={MISSION_ASSISTANT_MAX}
          autosize
          minRows={2}
        />
        <Group>
          <Button
            variant="default"
            loading={envoi}
            disabled={!choisi || consigne.trim() === ''}
            onClick={() =>
              void agir(async () => {
                await api('POST', '/api/assistant/missions', { body: { profil: choisi, consigne } });
                setConsigne('');
                await relire();
              }, 'Mission confiée à l’assistant.')
            }
          >
            Confier la mission
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

/** Mémoire : notes que l'assistant écrit pendant ses rondes. Le RSSI les lit et les supprime. */
export function MemoireAssistant({ profils }: { profils: Profils }) {
  const qc = useQueryClient();
  const { erreur, agir } = useAction();
  const q = useQuery({ queryKey: CLE_MEMOIRE, queryFn: () => get<MemoireAssistantDto[]>('/api/assistant/memoire') });
  const libelle = (p: string) => profils.find((x) => x.id === p)?.libelle ?? p;

  return (
    <Card withBorder>
      <Stack>
        <Title order={3} size="h5">
          Mémoire de l’assistant
        </Title>
        <Text size="sm" c="dimmed">
          Notes courtes que l’assistant écrit pendant ses rondes et relit aux suivantes. Chaque profil a la sienne.
          Retirer un périmètre à un profil efface sa mémoire.
        </Text>
        <ErrorAlert error={q.error ?? erreur} />
        {q.data && q.data.length === 0 && <Text c="dimmed">La mémoire est vide.</Text>}
        {(q.data ?? []).map((m) => (
          <Group key={m.id} justify="space-between" wrap="nowrap" align="flex-start">
            <Stack gap="xs">
              <Text size="sm">{m.contenu}</Text>
              <Text size="xs" c="dimmed">
                {libelle(m.profil)} · {fmtDate(m.createdAt)}
              </Text>
            </Stack>
            <ConfirmButton
              variant="default"
              message="Supprimer cette note ? L’assistant ne la relira plus."
              onConfirm={() =>
                agir(async () => {
                  await api('DELETE', `/api/assistant/memoire/${m.id}`);
                  await qc.invalidateQueries({ queryKey: CLE_MEMOIRE });
                }, 'Note supprimée.')
              }
            >
              Supprimer
            </ConfirmButton>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

/* Autonomie de l'assistant RSSI (ADR 0086, lot A3) : rondes et leurs rapports, missions confiées par le RSSI, mémoire par
   profil. Une ronde lit avec les droits de son référent ; son rapport n'est rendu qu'à lui et aux administrateurs de
   l'assistant (le serveur reste seul juge). */
import { Badge, Button, Card, Group, Select, Stack, Table, Text, Textarea, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { StatusChip } from '@suivi/ui';
import {
  AVIS_MOTIF_MAX,
  METHODE_CONTENU_MAX,
  METHODE_TITRE_MAX,
  MISSION_ASSISTANT_MAX,
  type MemoireAssistantDto,
  type MesureAssistantDto,
  type MethodeAssistantDto,
  type MissionAssistantDto,
  PROPOSITION_DESCRIPTION_MAX,
  RONDE_DECLENCHEUR_LIBELLES,
  PROPOSITION_TITRE_MAX,
  type ProfilAssistant,
  type PropositionAssistantDto,
  type QuestionAssistantDto,
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
const CLE_QUESTIONS = ['assistant', 'questions'];
const CLE_PROPOSITIONS = ['assistant', 'propositions'];
const CLE_METHODES = ['assistant', 'methodes'];
const CLE_MESURES = ['assistant', 'mesures'];
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
  const qc = useQueryClient();
  const { erreur, envoi, agir } = useAction();
  const [motif, setMotif] = useState('');
  const noter = (avis: 'utile' | 'inutile') =>
    agir(async () => {
      await api('PUT', `/api/assistant/rondes/${id}/avis`, { body: { avis, motif } });
      setMotif('');
      await qc.invalidateQueries({ queryKey: CLE_RONDES });
    }, 'Avis enregistré : l’assistant le relira à la prochaine ronde.');
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
      {d.etat === 'terminee' && (
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Constaté par la plateforme
          </Text>
          {d.actions.length === 0 ? (
            <Text size="sm">Aucun rappel envoyé, aucune note ni fiche écrite pendant cette ronde.</Text>
          ) : (
            d.actions.map((a, i) => (
              <Text key={i} size="sm">
                {a}
              </Text>
            ))
          )}
        </Stack>
      )}
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
      <ErrorAlert error={erreur} />
      {d.avis && (
        <Text size="sm">
          Avis rendu : {d.avis === 'utile' ? 'utile' : 'pas utile'}
          {d.avisMotif ? ` (${d.avisMotif})` : ''}.
        </Text>
      )}
      <TextInput
        label="Votre avis sur cette ronde (motif facultatif)"
        description="L’assistant relit les derniers avis à chaque ronde."
        value={motif}
        onChange={(e) => setMotif(e.currentTarget.value)}
        maxLength={AVIS_MOTIF_MAX}
      />
      <Group>
        <Button variant="default" size="compact-sm" loading={envoi} onClick={() => void noter('utile')}>
          Ronde utile
        </Button>
        <Button variant="default" size="compact-sm" loading={envoi} onClick={() => void noter('inutile')}>
          Ronde pas utile
        </Button>
      </Group>
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
                    {RONDE_DECLENCHEUR_LIBELLES[r.declencheur]}
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

function FicheProposee({
  m,
  libelle,
  relire,
}: {
  m: MethodeAssistantDto;
  libelle: string;
  relire: () => Promise<void>;
}) {
  const { erreur, envoi, agir } = useAction();
  const [contenu, setContenu] = useState(m.contenu);
  const decider = (decision: 'valider' | 'refuser') =>
    agir(
      async () => {
        await api('POST', `/api/assistant/methodes/${m.id}/decision`, {
          body: decision === 'valider' ? { decision, contenu } : { decision },
        });
        await relire();
      },
      decision === 'valider' ? 'Fiche validée : l’assistant la suivra.' : 'Fiche refusée.',
    );
  return (
    <Card withBorder>
      <Stack gap="xs">
        <ErrorAlert error={erreur} />
        <Group gap="xs">
          <StatusChip etat="attention">À décider</StatusChip>
          <Text size="sm" fw={600}>
            {m.titre}
          </Text>
          <Text size="xs" c="dimmed">
            {libelle} · proposée par l’assistant le {fmtDate(m.createdAt)}
          </Text>
        </Group>
        <Textarea
          label={`Texte de la fiche « ${m.titre} » (modifiable avant validation)`}
          value={contenu}
          onChange={(e) => setContenu(e.currentTarget.value)}
          maxLength={METHODE_CONTENU_MAX}
          autosize
          minRows={3}
        />
        <Group>
          <Button
            variant="default"
            loading={envoi}
            disabled={contenu.trim() === ''}
            onClick={() => void decider('valider')}
          >
            Valider
          </Button>
          <Button variant="default" loading={envoi} onClick={() => void decider('refuser')}>
            Refuser
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

/** Fiches de méthode : façons de faire propres à l'organisation. L'assistant en propose ; seules les fiches validées
    par une personne sont relues. */
export function MethodesAssistant({ profils }: { profils: Profils }) {
  const qc = useQueryClient();
  const { erreur, envoi, agir } = useAction();
  const [profil, setProfil] = useState<ProfilAssistant | null>(null);
  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');
  const q = useQuery({ queryKey: CLE_METHODES, queryFn: () => get<MethodeAssistantDto[]>('/api/assistant/methodes') });
  const choisi = profil ?? profils[0]?.id ?? null;
  const libelle = (p: string) => profils.find((x) => x.id === p)?.libelle ?? p;
  const relire = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: CLE_METHODES }),
      qc.invalidateQueries({ queryKey: CLE_MESURES }),
    ]);
  };
  const liste = q.data ?? [];

  return (
    <Card withBorder>
      <Stack>
        <Title order={3} size="h5">
          Fiches de méthode
        </Title>
        <Text size="sm" c="dimmed">
          Une fiche décrit une façon de faire propre à votre organisation. L’assistant peut en proposer après une ronde
          ; il ne suit que celles que vous avez validées. Vous pouvez aussi en rédiger vous-même.
        </Text>
        <ErrorAlert error={q.error ?? erreur} />
        {liste
          .filter((m) => m.etat === 'proposee')
          .map((m) => (
            <FicheProposee key={m.id} m={m} libelle={libelle(m.profil)} relire={relire} />
          ))}
        {liste
          .filter((m) => m.etat !== 'proposee')
          .map((m) => (
            <Group key={m.id} justify="space-between" wrap="nowrap" align="flex-start">
              <Stack gap="xs">
                <Group gap="xs">
                  <StatusChip etat={m.etat === 'validee' ? 'succes' : 'neutre'}>
                    {m.etat === 'validee' ? 'Validée' : 'Refusée'}
                  </StatusChip>
                  <Text size="sm" fw={600}>
                    {m.titre}
                  </Text>
                </Group>
                <Text size="sm" className="assistant-message__texte">
                  {m.contenu}
                </Text>
                <Text size="xs" c="dimmed">
                  {libelle(m.profil)} ·{' '}
                  {m.origine === 'assistant' ? 'proposée par l’assistant' : 'rédigée par une personne'}
                  {m.decidedBy ? ` · décision de ${m.decidedBy}` : ''}
                </Text>
              </Stack>
              <ConfirmButton
                variant="default"
                message="Supprimer cette fiche ? L’assistant ne la suivra plus."
                onConfirm={() =>
                  agir(async () => {
                    await api('DELETE', `/api/assistant/methodes/${m.id}`);
                    await relire();
                  }, 'Fiche supprimée.')
                }
              >
                Supprimer
              </ConfirmButton>
            </Group>
          ))}
        <Select
          label="Profil de la nouvelle fiche"
          data={profils.map((p) => ({ value: p.id, label: p.libelle }))}
          value={choisi}
          onChange={(v) => setProfil(v as ProfilAssistant | null)}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
        />
        <TextInput
          label="Titre de la nouvelle fiche"
          value={titre}
          onChange={(e) => setTitre(e.currentTarget.value)}
          maxLength={METHODE_TITRE_MAX}
        />
        <Textarea
          label="Texte de la nouvelle fiche"
          description="Ce texte part chez le fournisseur du modèle : aucune donnée de santé ni donnée personnelle."
          value={contenu}
          onChange={(e) => setContenu(e.currentTarget.value)}
          maxLength={METHODE_CONTENU_MAX}
          autosize
          minRows={3}
        />
        <Group>
          <Button
            variant="default"
            loading={envoi}
            disabled={!choisi || titre.trim() === '' || contenu.trim() === ''}
            onClick={() =>
              void agir(async () => {
                await api('POST', '/api/assistant/methodes', { body: { profil: choisi, titre, contenu } });
                setTitre('');
                setContenu('');
                await relire();
              }, 'Fiche enregistrée : l’assistant la suivra.')
            }
          >
            Enregistrer la fiche
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

/** Mesure : chiffres calculés par la plateforme, pour voir si l'assistant progresse. */
export function MesuresAssistant() {
  const q = useQuery({ queryKey: CLE_MESURES, queryFn: () => get<MesureAssistantDto[]>('/api/assistant/mesures') });
  return (
    <Card withBorder>
      <Stack>
        <Title order={3} size="h5">
          Mesure
        </Title>
        <Text size="sm" c="dimmed">
          Six derniers mois, comptés par la plateforme. Les avis viennent des personnes : celui du référent sur chaque
          ronde, celui du destinataire sur chaque rappel.
        </Text>
        <ErrorAlert error={q.error} />
        <Table.ScrollContainer minWidth={820}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Mois</Table.Th>
                <Table.Th scope="col">Rondes</Table.Th>
                <Table.Th scope="col">En échec</Table.Th>
                <Table.Th scope="col">Jugées utiles</Table.Th>
                <Table.Th scope="col">Jugées pas utiles</Table.Th>
                <Table.Th scope="col">Propositions confirmées</Table.Th>
                <Table.Th scope="col">Propositions rejetées</Table.Th>
                <Table.Th scope="col">Rappels</Table.Th>
                <Table.Th scope="col">Rappels utiles</Table.Th>
                <Table.Th scope="col">Rappels pas utiles</Table.Th>
                <Table.Th scope="col">Fiches validées</Table.Th>
                <Table.Th scope="col">Fiches refusées</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(q.data ?? []).map((m) => (
                <Table.Tr key={m.mois}>
                  <Table.Th scope="row">{m.mois}</Table.Th>
                  <Table.Td>{m.rondes}</Table.Td>
                  <Table.Td>{m.rondesEnEchec}</Table.Td>
                  <Table.Td>{m.rondesUtiles}</Table.Td>
                  <Table.Td>{m.rondesInutiles}</Table.Td>
                  <Table.Td>{m.propositionsConfirmees}</Table.Td>
                  <Table.Td>{m.propositionsRejetees}</Table.Td>
                  <Table.Td>{m.rappels}</Table.Td>
                  <Table.Td>{m.rappelsUtiles}</Table.Td>
                  <Table.Td>{m.rappelsInutiles}</Table.Td>
                  <Table.Td>{m.methodesValidees}</Table.Td>
                  <Table.Td>{m.methodesRefusees}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
    </Card>
  );
}

const ETATS_QUESTION = {
  ouverte: { etat: 'attention', libelle: 'En attente' },
  repondue: { etat: 'succes', libelle: 'Répondue' },
  sans_reponse: { etat: 'erreur', libelle: 'Sans réponse' },
} as const;

/** Questions posées par l'assistant pendant ses rondes, avec leurs réponses : pour le référent et les administrateurs. */
export function QuestionsAssistant() {
  const q = useQuery({
    queryKey: CLE_QUESTIONS,
    queryFn: () => get<QuestionAssistantDto[]>('/api/assistant/questions'),
  });
  const liste = q.data ?? [];
  return (
    <Card withBorder>
      <Stack>
        <Title order={2} size="h4">
          Questions posées par l’assistant
        </Title>
        <Text size="sm" c="dimmed">
          L’assistant interroge le responsable d’un élément quand il lui manque une information. Sans réponse, il
          relance une fois, puis vous le signale.
        </Text>
        <ErrorAlert error={q.error} />
        {q.data && liste.length === 0 && <Text c="dimmed">Aucune question pour le moment.</Text>}
        {liste.map((x) => (
          <Stack key={x.id} gap="xs">
            <Group gap="xs">
              <StatusChip etat={ETATS_QUESTION[x.etat].etat}>{ETATS_QUESTION[x.etat].libelle}</StatusChip>
              <Text size="sm" fw={600}>
                {x.objetNom}
              </Text>
              <Text size="xs" c="dimmed" className="horodatage">
                à {x.destinataire}, le {fmtDate(x.createdAt)}
                {x.relances > 0 ? ' · relancée' : ''}
              </Text>
            </Group>
            <Text size="sm">{x.texte}</Text>
            {x.reponse && (
              <Text size="sm" className="assistant-message__texte">
                Réponse : {x.reponse}
              </Text>
            )}
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}

function PropositionADecider({ p, relire }: { p: PropositionAssistantDto; relire: () => Promise<void> }) {
  const { erreur, envoi, agir } = useAction();
  const [titre, setTitre] = useState(p.titre);
  const [description, setDescription] = useState(p.description);
  const [echeance, setEcheance] = useState(p.echeance ?? '');
  const [note, setNote] = useState('');
  const decider = (decision: 'confirmer' | 'rejeter') =>
    agir(
      async () => {
        await api('POST', `/api/assistant/propositions/${p.id}/decision`, {
          body:
            decision === 'confirmer'
              ? { decision, titre, description, echeance: echeance || null, note }
              : { decision, note },
        });
        await relire();
      },
      decision === 'confirmer' ? 'Action créée à votre nom.' : 'Proposition rejetée.',
    );
  return (
    <Card withBorder>
      <Stack gap="xs">
        <ErrorAlert error={erreur} />
        <Group gap="xs">
          <StatusChip etat="attention">À décider</StatusChip>
          <Text size="xs" c="dimmed" className="horodatage">
            Proposée le {fmtDate(p.createdAt)}
            {p.sourceNom ? ` au sujet de « ${p.sourceNom} »` : ''}
          </Text>
        </Group>
        <TextInput
          label="Intitulé de l’action proposée"
          value={titre}
          onChange={(e) => setTitre(e.currentTarget.value)}
          maxLength={PROPOSITION_TITRE_MAX}
        />
        <Textarea
          label={`Description de l’action « ${p.titre} »`}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          maxLength={PROPOSITION_DESCRIPTION_MAX}
          autosize
          minRows={2}
        />
        <TextInput
          label={`Échéance de l’action « ${p.titre} »`}
          description="Au format AAAA-MM-JJ ; vide pour ne pas en fixer."
          value={echeance}
          onChange={(e) => setEcheance(e.currentTarget.value)}
          maxLength={10}
        />
        <TextInput
          label={`Motif de votre décision sur « ${p.titre} » (facultatif)`}
          description="L’assistant relit les dernières décisions à chaque ronde."
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          maxLength={AVIS_MOTIF_MAX}
        />
        <Group>
          <Button
            variant="default"
            loading={envoi}
            disabled={titre.trim() === ''}
            onClick={() => void decider('confirmer')}
          >
            Confirmer et créer l’action
          </Button>
          <Button variant="default" loading={envoi} onClick={() => void decider('rejeter')}>
            Rejeter
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

/** Propositions de l'assistant : rien n'entre dans un registre avant la confirmation d'une personne, qui crée l'élément
    à son nom et avec ses droits. */
export function PropositionsAssistant({ peutDecider }: { peutDecider: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: CLE_PROPOSITIONS,
    queryFn: () => get<PropositionAssistantDto[]>('/api/assistant/propositions'),
  });
  const relire = async () => {
    await qc.invalidateQueries({ queryKey: CLE_PROPOSITIONS });
  };
  const liste = q.data ?? [];
  return (
    <Card withBorder>
      <Stack>
        <Title order={2} size="h4">
          Propositions de l’assistant
        </Title>
        <Text size="sm" c="dimmed">
          L’assistant ne crée rien lui-même. Quand il estime qu’une action manque, il la propose : vous la corrigez, la
          confirmez ou la rejetez. Une action confirmée est créée à votre nom, avec vos droits.
        </Text>
        <ErrorAlert error={q.error} />
        {q.data && liste.length === 0 && <Text c="dimmed">Aucune proposition pour le moment.</Text>}
        {liste.map((p) =>
          p.etat === 'en_attente' && peutDecider ? (
            <PropositionADecider key={p.id} p={p} relire={relire} />
          ) : (
            <Stack key={p.id} gap="xs">
              <Group gap="xs">
                <StatusChip etat={p.etat === 'confirmee' ? 'succes' : p.etat === 'rejetee' ? 'neutre' : 'attention'}>
                  {p.etat === 'confirmee' ? 'Confirmée' : p.etat === 'rejetee' ? 'Rejetée' : 'À décider'}
                </StatusChip>
                <Text size="sm" fw={600}>
                  {p.titre}
                </Text>
              </Group>
              <Text size="sm">{p.description}</Text>
              <Text size="xs" c="dimmed">
                {p.decidedBy ? `Décision de ${p.decidedBy}` : 'En attente d’une personne autorisée à décider'}
                {p.decisionNote ? ` : ${p.decisionNote}` : ''}
              </Text>
            </Stack>
          ),
        )}
      </Stack>
    </Card>
  );
}

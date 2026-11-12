/* Assistant RSSI (ADR 0086, lot A1) : dialogue avec un profil de l'assistant. L'assistant lit avec les droits de la personne,
   dans les périmètres du profil ; il ne modifie rien. Chaque réponse montre les éléments lus. La réponse se prépare sur le
   serveur : le fil est relu tant qu'elle est en cours. */
import { Alert, Anchor, Badge, Button, Card, Group, Loader, Select, Stack, Text, Textarea, Title } from '@mantine/core';
import { Page, PageHeader } from '@suivi/ui';
import {
  MESSAGE_ASSISTANT_MAX,
  type ConversationAssistantDetailDto,
  type ConversationAssistantDto,
  type EtatAssistantDto,
  type MessageAssistantDto,
  type ProfilAssistant,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, get } from '../api';
import { ConfirmButton, ErrorAlert, fmtDate } from '../components/common';
import { useCan } from '../session';
import { PropositionsAssistant, QuestionsAssistant, RondesAssistant } from './AutonomieAssistant';
import { CLE_ETAT_ASSISTANT } from './ReglagesAssistant';

const CLE_FILS = ['assistant', 'conversations'];
const OUTILS: Record<string, string> = {
  lister_perimetres: 'périmètres',
  synthese_perimetre: 'synthèse',
  lister_elements: 'liste',
  lire_element: 'fiche',
  historique_element: 'historique',
  actions_en_retard: 'actions en retard',
  couverture_referentiels: 'couverture',
  chercher_documents: 'recherche de documents',
  lire_document: 'document',
  signaux: 'points d’attention',
};

function Message({ m }: { m: MessageAssistantDto }) {
  const perimetres = new Map(m.sources.filter((s) => s.perimetre).map((s) => [s.perimetre, s]));
  const elements = m.sources.filter((s) => s.objet && s.type !== 'document');
  const documents = m.sources.filter((s) => s.type === 'document');
  return (
    <Card withBorder className="assistant-message" data-role={m.role} data-erreur={m.erreur || undefined}>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="xs" fw={600}>
            {m.role === 'utilisateur' ? 'Vous' : 'Assistant'}
          </Text>
          <Text size="xs" c="dimmed" className="horodatage">
            {fmtDate(m.createdAt)}
          </Text>
        </Group>
        <Text className="assistant-message__texte">{m.contenu}</Text>
        {m.role === 'assistant' && !m.erreur && (
          <Stack gap="xs">
            {m.outils.length > 0 && (
              <Group gap="xs">
                <Text size="xs" c="dimmed">
                  Lectures faites :
                </Text>
                {m.outils.map((o, i) => (
                  <Badge key={i} variant="light" color="gray">
                    {OUTILS[o.nom] ?? o.nom} ({o.elements})
                  </Badge>
                ))}
              </Group>
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
            {documents.length > 0 && (
              <Text size="xs" c="dimmed">
                Documents consultés :{' '}
                {documents
                  .slice(0, 8)
                  .map((s) => s.nom)
                  .join(' ; ')}
              </Text>
            )}
            {perimetres.size > 0 && (
              <Group gap="xs">
                <Text size="xs" c="dimmed">
                  Périmètres consultés :
                </Text>
                {[...perimetres.keys()].map((id) => (
                  <Anchor key={id} size="xs" component={Link} to={`/pilotage/synthese?perimetre=${id}`}>
                    Ouvrir la synthèse
                  </Anchor>
                ))}
              </Group>
            )}
            {m.outils.length === 0 && (
              <Text size="xs" c="dimmed">
                Réponse donnée sans lecture de la plateforme : à vérifier.
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

export function AssistantPage() {
  const can = useCan();
  const autorise = can('assistant', 'lire');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { id } = useParams();
  const [profil, setProfil] = useState<ProfilAssistant | null>(null);
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const fin = useRef<HTMLDivElement>(null);

  const etat = useQuery({
    queryKey: CLE_ETAT_ASSISTANT,
    queryFn: () => get<EtatAssistantDto>('/api/assistant/etat'),
    enabled: autorise,
  });
  const fils = useQuery({
    queryKey: CLE_FILS,
    queryFn: () => get<ConversationAssistantDto[]>('/api/assistant/conversations'),
    enabled: autorise,
  });
  const fil = useQuery({
    queryKey: [...CLE_FILS, id],
    queryFn: () => get<ConversationAssistantDetailDto>(`/api/assistant/conversations/${id}`),
    enabled: autorise && !!id,
    // Réponse en préparation : le fil est relu jusqu'à son arrivée.
    refetchInterval: (q) => (q.state.data?.etat === 'en_cours' ? 1500 : false),
  });
  const nombre = fil.data?.messages.length ?? 0;
  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'nearest' });
  }, [nombre]);
  const enCours = fil.data?.etat === 'en_cours';
  useEffect(() => {
    if (!enCours) void qc.invalidateQueries({ queryKey: CLE_ETAT_ASSISTANT });
  }, [enCours, qc]);

  if (!autorise)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit d’utiliser l’assistant.</Alert>
      </Page>
    );
  const e = etat.data;
  const profils = e?.profils ?? [];
  const choisi = profil ?? profils[0]?.id ?? null;
  const agir = async (fn: () => Promise<void>) => {
    setEnvoi(true);
    try {
      setErreur(null);
      await fn();
    } catch (x) {
      setErreur(x);
    } finally {
      setEnvoi(false);
    }
  };
  const ouvrir = () =>
    agir(async () => {
      const c = await api<ConversationAssistantDto>('POST', '/api/assistant/conversations', {
        body: { profil: choisi },
      });
      await qc.invalidateQueries({ queryKey: CLE_FILS });
      void navigate(`/assistant/${c.id}`);
    });
  const envoyer = () =>
    agir(async () => {
      const d = await api<ConversationAssistantDetailDto>('POST', `/api/assistant/conversations/${id}/messages`, {
        body: { texte },
      });
      qc.setQueryData([...CLE_FILS, id], d);
      setTexte('');
      await qc.invalidateQueries({ queryKey: CLE_FILS, exact: true });
    });
  const supprimer = () =>
    agir(async () => {
      await api('DELETE', `/api/assistant/conversations/${id}`);
      qc.removeQueries({ queryKey: [...CLE_FILS, id] });
      await qc.invalidateQueries({ queryKey: CLE_FILS, exact: true });
      void navigate('/assistant');
    });
  const libelleProfil = (p: string) => profils.find((x) => x.id === p)?.libelle ?? p;

  return (
    <Page>
      <PageHeader
        title="Assistant RSSI"
        description="L’assistant lit la plateforme avec vos droits et répond en citant ce qu’il a lu. Il ne modifie rien."
      />
      <Stack>
        <ErrorAlert error={etat.error ?? fils.error ?? erreur} />
        {e && !e.pret && (
          <Alert color="orange" title="Assistant indisponible">
            {e.motif}
            {can('assistant', 'administrer') && (
              <>
                {' '}
                <Anchor component={Link} to="/plateforme/assistant">
                  Ouvrir les réglages
                </Anchor>
              </>
            )}
          </Alert>
        )}
        {e?.fournisseur && (
          <Text size="sm" c="dimmed">
            Vos questions et les extraits lus sont envoyés au fournisseur du modèle : {e.fournisseur}
            {e.modele ? ` (${e.modele})` : ''}. Consommation du jour : {e.jetonsDuJour.toLocaleString('fr-FR')} jetons
            sur {e.budgetJetonsJour.toLocaleString('fr-FR')}.
          </Text>
        )}

        <Card withBorder>
          <Group align="flex-end">
            <Select
              label="Profil de l’assistant"
              data={profils.map((p) => ({ value: p.id, label: p.libelle }))}
              value={choisi}
              onChange={(v) => setProfil(v as ProfilAssistant | null)}
              allowDeselect={false}
              disabled={!profils.length}
              comboboxProps={{ withinPortal: true }}
            />
            <Button onClick={() => void ouvrir()} loading={envoi} disabled={!choisi || !e?.pret}>
              Nouvelle conversation
            </Button>
          </Group>
          {choisi && (
            <Text size="xs" c="dimmed" mt="xs">
              Périmètres que ce profil peut lire pour vous :{' '}
              {profils
                .find((p) => p.id === choisi)
                ?.perimetres.map((p) => p.nom)
                .join(' ; ') || 'aucun'}
              .
            </Text>
          )}
        </Card>

        {(fils.data?.length ?? 0) > 0 && (
          <Card withBorder>
            <Title order={2} size="h5" mb="xs">
              Conversations
            </Title>
            <Stack gap="xs">
              {fils.data!.map((c) => (
                <Group key={c.id} justify="space-between" wrap="nowrap">
                  <Anchor
                    component={Link}
                    to={`/assistant/${c.id}`}
                    size="sm"
                    fw={c.id === id ? 700 : 400}
                    aria-current={c.id === id ? 'page' : undefined}
                    truncate
                  >
                    {c.titre || 'Conversation sans question'}
                  </Anchor>
                  <Group gap="xs" wrap="nowrap">
                    <Badge variant="light" color="gray">
                      {libelleProfil(c.profil)}
                    </Badge>
                    <Text size="xs" c="dimmed" className="horodatage">
                      {fmtDate(c.updatedAt)}
                    </Text>
                  </Group>
                </Group>
              ))}
            </Stack>
          </Card>
        )}

        {!id && e && (
          <>
            {e.enPause && (
              <Alert color="orange" title="Assistant en pause">
                Aucune ronde ne part tant que la pause est active. Le dialogue reste disponible.
              </Alert>
            )}
            <RondesAssistant profils={profils} peutLancer={can('assistant', 'administrer') && e.pret && !e.enPause} />
            <PropositionsAssistant peutDecider={can('assistant', 'modifier')} />
            <QuestionsAssistant />
          </>
        )}

        {id && (
          <Stack>
            <ErrorAlert error={fil.error} />
            {fil.data && (
              <>
                <Group justify="space-between">
                  <Title order={2} size="h4">
                    {fil.data.titre || 'Nouvelle conversation'} — {libelleProfil(fil.data.profil)}
                  </Title>
                  <ConfirmButton
                    variant="default"
                    message="Supprimer cette conversation ? Elle ne pourra pas être retrouvée."
                    onConfirm={() => supprimer()}
                    disabled={enCours}
                  >
                    Supprimer
                  </ConfirmButton>
                </Group>
                <Stack gap="sm" role="log" aria-label="Messages de la conversation" aria-live="polite">
                  {fil.data.messages.map((m) => (
                    <Message key={m.id} m={m} />
                  ))}
                  {enCours && (
                    <Group gap="xs">
                      <Loader size="sm" aria-hidden="true" />
                      <Text size="sm" c="dimmed">
                        L’assistant lit la plateforme et prépare sa réponse…
                      </Text>
                    </Group>
                  )}
                  <div ref={fin} />
                </Stack>
                <Textarea
                  label="Votre question"
                  value={texte}
                  onChange={(x) => setTexte(x.currentTarget.value)}
                  maxLength={MESSAGE_ASSISTANT_MAX}
                  autosize
                  minRows={2}
                  maxRows={8}
                  disabled={enCours}
                />
                <Group>
                  <Button
                    onClick={() => void envoyer()}
                    loading={envoi}
                    disabled={enCours || !texte.trim() || !e?.pret}
                  >
                    Envoyer
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        )}
      </Stack>
    </Page>
  );
}

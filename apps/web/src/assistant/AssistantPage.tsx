/* Suivi de l'assistant RSSI (ADR 0086) : rondes et leurs rapports, propositions à décider, questions posées.
   Le dialogue ne se tient plus ici : il vit dans le panneau flottant commun à toute la plateforme (AssistantGlobal), pour
   ne jamais afficher deux conversations concurrentes. Un lien direct /assistant/:id y ouvre la conversation demandée. */
import { Alert, Anchor, Stack, Text } from '@mantine/core';
import { Page, PageHeader } from '@suivi/ui';
import type { EtatAssistantDto } from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { PropositionsAssistant, QuestionsAssistant, RondesAssistant } from './AutonomieAssistant';
import { CLE_ETAT_ASSISTANT } from './ReglagesAssistant';

export function AssistantPage() {
  const can = useCan();
  const autorise = can('assistant', 'lire');
  const { id } = useParams();
  const etat = useQuery({
    queryKey: CLE_ETAT_ASSISTANT,
    queryFn: () => get<EtatAssistantDto>('/api/assistant/etat'),
    enabled: autorise,
  });
  if (!autorise)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit d’utiliser l’assistant.</Alert>
      </Page>
    );
  const e = etat.data;
  return (
    <Page>
      <PageHeader
        title="Suivi de l’assistant RSSI"
        description="Rondes et rapports, propositions à décider, questions posées. Le dialogue se tient dans le panneau de l’assistant, en bas à droite de chaque page."
      />
      <Stack>
        <ErrorAlert error={etat.error} />
        {id && (
          <Alert title="Discussion ouverte dans le panneau de l’assistant">
            Cette discussion s’affiche dans le panneau de l’assistant, en bas à droite. Si elle n’apparaît pas, elle a
            été supprimée ou appartient à une autre personne.
          </Alert>
        )}
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
            Les questions et les extraits lus sont envoyés au fournisseur du modèle : {e.fournisseur}
            {e.modele ? ` (${e.modele})` : ''}. Consommation du jour : {e.jetonsDuJour.toLocaleString('fr-FR')} jetons
            sur {e.budgetJetonsJour.toLocaleString('fr-FR')}.
          </Text>
        )}
        {e?.enPause && (
          <Alert color="orange" title="Rondes en pause">
            Aucune ronde ne part tant que la pause est active. Le dialogue reste disponible.
          </Alert>
        )}
        {e && (
          <>
            <RondesAssistant profils={e.profils} peutLancer={can('assistant', 'administrer') && e.pret && !e.enPause} />
            <PropositionsAssistant peutDecider={can('assistant', 'modifier')} />
            <QuestionsAssistant />
          </>
        )}
      </Stack>
    </Page>
  );
}

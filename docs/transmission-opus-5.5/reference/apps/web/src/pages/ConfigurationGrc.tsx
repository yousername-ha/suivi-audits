/* Paramètres de la plateforme → Configuration GRC (ADR 0038). Mêmes éléments et mêmes API que Gestion des risques →
   Configuration des analyses. */
import { CFG_KINDS, type CfgKind } from '@suivi/shared';
import { Page, PageHeader } from '@suivi/ui';
import { Text } from '@mantine/core';
import { useNavigate, useParams } from 'react-router';
import { ConfigurationGrc } from '../config-grc/ConfigurationGrc';
import { usePresence } from '../realtime';
import { useCan } from '../session';

export function ConfigurationGrcPage() {
  const { kind } = useParams();
  const nav = useNavigate();
  const can = useCan();
  const courant: CfgKind | 'modeles' = kind === 'modeles' ? 'modeles' : (CFG_KINDS.find((k) => k === kind) ?? 'scale');
  usePresence('parametres/configuration-grc');
  const lecture = can('parametres', 'lire') || can('pilotage', 'lire') || can('administration', 'lire');
  return (
    <Page>
      <PageHeader
        title="Configuration GRC"
        description="Échelles, matrices, critères et classifications partagés par toutes les méthodes d’analyse."
      />
      {lecture ? (
        <ConfigurationGrc
          kind={courant}
          onKind={(k) => nav(`/parametres/configuration-grc/${k}`)}
          contexte="plateforme"
        />
      ) : (
        <Text>Vous ne disposez pas du droit de consulter la configuration.</Text>
      )}
    </Page>
  );
}

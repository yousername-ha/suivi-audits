/* Ce qu'un outil montre d'une intégration qu'il exploite (ADR 0076, addendum du 19/11/2026) : l'état en lecture seule
   (dernière synchronisation, erreur éventuelle) et un lien « Configurer l'intégration » vers la carte de la page Plateforme,
   visible seulement de qui peut administrer les intégrations (décision du RSSI du 19/11/2026, lot F1). Lot F1 : fréquence
   de la synchronisation automatique et prochaine synchronisation prévue, en lecture. Aucun réglage, aucune clé, aucun bouton de test ni de synchronisation :
   tout cela vit dans la carte. Composants sans état (droit passé par l'appelant), réutilisables par un futur outil. */
import { Anchor, Group, Stack, Text } from '@mantine/core';
import { StatusChip, type Etat } from '@suivi/ui';
import { Link } from 'react-router';
import { fmtDate } from '../components/common';
import {
  dateDerniereSynchronisation,
  erreurSynchronisation,
  etatConnecteur,
  type ConnecteurLu,
  texteFrequence,
  texteProchaine,
} from './etat-integration';
import { LIEN_INTEGRATIONS } from './integrations';

/** Lien vers la carte « Intégrations » de la Plateforme ; rien sans le droit de les administrer
    (`integrations:administrer`, décision du RSSI du 19/11/2026). */
export function LienConfigurerIntegration({ visible, size = 'sm' }: { visible: boolean; size?: 'xs' | 'sm' }) {
  if (!visible) return null;
  return (
    <Anchor component={Link} to={LIEN_INTEGRATIONS} size={size}>
      Configurer l’intégration
    </Anchor>
  );
}

/** État en lecture seule des connecteurs d'un type, puis le lien de configuration. `qualifier` remplace l'état par défaut
    (pastille) ; `detail` ajoute un complément en lecture (bilan, périmètres non reliés). */
export function EtatIntegration<C extends ConnecteurLu>({
  type,
  connecteurs,
  peutConfigurer,
  qualifier = etatConnecteur,
  detail,
}: {
  /** Nom de l'outil (« Tenable Security Center », « AlgoLightHouse »). */
  type: string;
  connecteurs: readonly C[];
  /** Droit d'administrer les intégrations (`integrations:administrer`), calculé par l'appelant : seul il montre le lien. */
  peutConfigurer: boolean;
  qualifier?: (c: C) => { libelle: string; etat: Etat };
  detail?: (c: C) => string | null | undefined;
}) {
  return (
    <Stack gap="xs" component="section" aria-label={`État de l’intégration ${type}`}>
      {connecteurs.length === 0 ? (
        <Text size="sm" c="dimmed" role="status">
          Aucune instance {type} n’est configurée.
          {peutConfigurer ? '' : ' Un administrateur des intégrations l’ajoute dans la page Plateforme.'}
        </Text>
      ) : (
        connecteurs.map((c) => {
          const q = qualifier(c);
          const date = dateDerniereSynchronisation(c);
          const erreur = erreurSynchronisation(c);
          const complement = detail?.(c);
          return (
            <Group key={c.integrationId} gap="sm" wrap="nowrap" align="flex-start">
              <StatusChip etat={q.etat}>{q.libelle}</StatusChip>
              <Stack gap="2xs">
                <Text size="sm" fw={600}>
                  {c.nom}
                </Text>
                <Text size="xs" c="dimmed">
                  Dernière synchronisation :{' '}
                  {date ? <span className="horodatage">{fmtDate(date)}</span> : 'aucune pour le moment'}
                  {c.derniereCompleteLe && c.derniereCompleteLe !== date && (
                    <>
                      {' '}
                      · dernière complète : <span className="horodatage">{fmtDate(c.derniereCompleteLe)}</span>
                    </>
                  )}
                </Text>
                {c.frequenceHeures !== undefined && (
                  <Text size="xs" c="dimmed">
                    {texteFrequence(c.frequenceHeures)} · {texteProchaine(c.prochaineSynchronisation ?? null)}
                    {c.prochaineSynchronisation && (
                      <span className="horodatage">{fmtDate(c.prochaineSynchronisation)}</span>
                    )}
                  </Text>
                )}
                {erreur && (
                  <Text size="xs" role="status">
                    <strong>Erreur de la dernière synchronisation :</strong> {erreur}
                  </Text>
                )}
                {complement && (
                  <Text size="xs" c="dimmed" role="status">
                    {complement}
                  </Text>
                )}
              </Stack>
            </Group>
          );
        })
      )}
      {peutConfigurer && (
        <div>
          <LienConfigurerIntegration visible />
        </div>
      )}
    </Stack>
  );
}

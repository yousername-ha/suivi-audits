/* Critères d'un mot de passe, évalués en direct avec les règles partagées du serveur (ADR 0075). Le serveur reste l'autorité. */
import { Text } from '@mantine/core';
import { problemesMotDePasse, type ContexteMotDePasse } from '@suivi/shared';

export function CriteresMotDePasse({ valeur, ...ctx }: ContexteMotDePasse & { valeur: string }) {
  if (!valeur) return null;
  const problemes = problemesMotDePasse(valeur, ctx);
  return problemes.length === 0 ? (
    <Text size="xs" c="green" role="status" data-mdp-conforme>
      Ce mot de passe respecte les règles.
    </Text>
  ) : (
    <Text size="xs" c="red" role="status" data-mdp-criteres>
      À corriger : {problemes.join(' ; ')}.
    </Text>
  );
}

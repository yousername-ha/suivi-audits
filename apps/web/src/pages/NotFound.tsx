import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { Link, useRouteError } from 'react-router';

export function NotFoundPage() {
  return (
    <Center h="100vh" p="md">
      <Stack align="center">
        <Title order={1}>Page introuvable</Title>
        <Text c="dimmed">L’adresse demandée n’existe pas.</Text>
        <Button component={Link} to="/">
          Retour à l’accueil
        </Button>
      </Stack>
    </Center>
  );
}

/** Erreur inattendue de l'interface : message en français, sans détail technique superflu. */
export function ErrorPage() {
  const err = useRouteError();
  return (
    <Center h="100vh" p="md">
      <Stack align="center" className="lecture">
        <Title order={1}>Une erreur est survenue</Title>
        <Text c="dimmed" ta="center">
          L’affichage de cette page a échoué. Rechargez la page ; si le problème persiste, transmettez ce message à
          l’administrateur.
        </Text>
        <Text size="sm" className="mono" ta="center">
          {err instanceof Error ? err.message : String(err)}
        </Text>
        <Button onClick={() => location.reload()}>Recharger</Button>
      </Stack>
    </Center>
  );
}

/* Accueil : tableau de bord (synthèse selon les droits), accès aux modules, activité en cours,
   et activité en cours. Une seule grille de cartes : plus de colonnes sur les grands écrans. */
import { Button, Card, Stack, Text, Title, VisuallyHidden } from '@mantine/core';
import { ErrorAlert, IconeAdministration, IconeDocuments, IconeHistorique, Page, PageHeader } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { cartesVisibles } from '../administration-droits';
import { get } from '../api';
import { SyntheseCartes, type SyntheseApi } from '../components/Synthese';
import { useLive, usePresence } from '../realtime';
import { canAdminArea, canReadBusiness, useCan, useMe } from '../session';

const RESOURCE_LABELS: [RegExp, string][] = [
  [/^documents\/.+/, 'un document'],
  [/^documents$/, 'les documents'],
  [/^admin/, 'l’administration'],
  [/^account$/, 'son compte'],
  [/^home$/, 'l’accueil'],
];
const resourceLabel = (r: string) => RESOURCE_LABELS.find(([re]) => re.test(r))?.[1] ?? r;

/** Adresse du site de l'organisation, acceptée seulement en https : lien ouvert par clic explicite, jamais chargé. */
const siteHttps = (u: string) => {
  try {
    return new URL(u).protocol === 'https:' ? u : '';
  } catch {
    return '';
  }
};
function LienSite({ url, nom }: { url: string; nom: string }) {
  return (
    <Button
      component="a"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      variant="default"
      rightSection={
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M7 17L17 7M9 7h8v8" />
        </svg>
      }
    >
      Site {nom}
      <VisuallyHidden> (nouvel onglet)</VisuallyHidden>
    </Button>
  );
}

export function HomePage() {
  const me = useMe();
  const can = useCan();
  const site = siteHttps(me.orgSite);
  usePresence('home');
  const { presence } = useLive();
  const synthese = useQuery({
    queryKey: ['synthese'],
    queryFn: () => get<SyntheseApi>('/api/mur/synthese'),
    enabled: canReadBusiness(can),
  });
  const online = [...new Map(presence.map((p) => [p.username, p])).values()];

  const acces = (
    <>
      {canReadBusiness(can) && (
        <Card withBorder className="acces-carte">
          <Stack gap="sm">
            <span className="acces-icone" aria-hidden="true">
              <IconeHistorique />
            </span>
            <Title order={2} size="h4">
              Pilotage
            </Title>
            <Text size="sm" c="dimmed">
              Retrouvez vos mesures, vos écarts, votre plan d’audit et vos modules de pilotage.
            </Text>
            <Button component={Link} to="/pilotage">
              Ouvrir le pilotage
            </Button>
          </Stack>
        </Card>
      )}
      {can('documents', 'lire') && (
        <Card withBorder className="acces-carte">
          <Stack gap="sm">
            <span className="acces-icone" aria-hidden="true">
              <IconeDocuments />
            </span>
            <Title order={2} size="h4">
              Documents et liens
            </Title>
            <Text size="sm" c="dimmed">
              Preuves et documents chiffrés, versions, liens vers les partages réseau.
            </Text>
            <Button component={Link} to="/documents" variant="light">
              Voir les documents
            </Button>
          </Stack>
        </Card>
      )}
      {canAdminArea(can) && (
        <Card withBorder className="acces-carte">
          <Stack gap="sm">
            <span className="acces-icone" aria-hidden="true">
              <IconeAdministration />
            </span>
            <Title order={2} size="h4">
              Administration
            </Title>
            <Text size="sm" c="dimmed">
              Plateforme (comptes, référentiels, import) et configuration système (sauvegardes, versions, journal
              d’audit).
            </Text>
            <Button
              component={Link}
              to={cartesVisibles(can, 'plateforme').length ? '/plateforme' : '/systeme'}
              variant="light"
            >
              Administrer
            </Button>
          </Stack>
        </Card>
      )}
      <Card withBorder className="presence-liste">
        <Title order={2} size="h4" mb="xs">
          En ce moment
        </Title>
        {online.length ? (
          <Stack gap="2xs">
            {online.map((p) => (
              <Text size="sm" key={p.username}>
                <b>{p.name}</b> {p.mode === 'edit' ? 'modifie' : 'consulte'} {resourceLabel(p.resource)}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            Personne d’autre n’est connecté.
          </Text>
        )}
      </Card>
    </>
  );

  return (
    <Page>
      <Text className="page-eyebrow">Vue d’ensemble</Text>
      <PageHeader
        title={`Bonjour ${me.user?.displayName || me.user?.username}`}
        description={synthese.data ? `Tableau de bord — ${synthese.data.organisation}` : undefined}
        actions={site && <LienSite url={site} nom={me.orgName} />}
      />
      {synthese.error && <ErrorAlert error={synthese.error} />}
      {synthese.data ? (
        <SyntheseCartes
          s={synthese.data}
          extra={
            <>
              <div className="section-label carte-large">
                <Text className="page-eyebrow">Votre espace de travail</Text>
                <Text size="sm" c="dimmed">
                  Accès aux modules et activité de l’équipe
                </Text>
              </div>
              {acces}
            </>
          }
        />
      ) : (
        <div className="grille-cartes">{acces}</div>
      )}
    </Page>
  );
}

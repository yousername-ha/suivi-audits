/* Accueil : tableau de bord « Suivi de la conformité » en verre et relief (synthèse selon les droits, ADR 0069), dans la
   disposition de la personne ou dans un tableau partagé avec elle (ADR 0078), puis accès aux modules et activité en
   cours. Plus de colonnes sur les grands écrans. */
import { Button, Card, NativeSelect, Stack, Text, Title, VisuallyHidden } from '@mantine/core';
import {
  ConfirmButton,
  ErrorAlert,
  IconeAdministration,
  IconeDocuments,
  IconeHistorique,
  Page,
  PageHeader,
} from '@suivi/ui';
import type { DispositionEnregistree, DispositionsOut, TableauPartage } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { cartesVisibles } from '../administration-droits';
import { api, del, get } from '../api';
import type { SyntheseApi } from '../components/Synthese';
import { CLE_DISPOSITION, EditionTableauDeBord } from '../components/DispositionTableauDeBord';
import { PartageTableauDeBord } from '../components/PartageTableauDeBord';
import { TableauDeBordConformite } from '../components/TableauDeBord';
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

/** Tableau affiché : celui choisi s'il est encore visible, sinon le sien, sinon celui de l'organisation (null : la
    disposition standard). */
function tableauAffiche(d: DispositionsOut): DispositionEnregistree | TableauPartage | null {
  const choisi = d.choix && [d.personnelle, d.organisation, ...d.partages].find((x) => x?.id === d.choix);
  return choisi || d.personnelle || d.organisation;
}

/** Tableaux que la personne peut afficher ; la valeur vide est le choix automatique. */
function choixTableaux(d: DispositionsOut) {
  const auto = d.personnelle
    ? 'Mon tableau de bord'
    : d.organisation
      ? 'Tableau de bord de l’organisation'
      : 'Tableau de bord standard';
  return [
    { value: '', label: auto },
    ...(d.personnelle && d.organisation
      ? [{ value: d.organisation.id, label: 'Tableau de bord de l’organisation' }]
      : []),
    ...d.partages.map((p) => ({ value: p.id, label: `Tableau de bord de ${p.auteur}` })),
  ];
}

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
  const dispositions = useQuery({
    queryKey: CLE_DISPOSITION,
    queryFn: () => get<DispositionsOut>('/api/tableau-de-bord/disposition'),
    enabled: canReadBusiness(can),
  });
  const qc = useQueryClient();
  const [mode, setMode] = useState<'lecture' | 'edition' | 'partage'>('lecture');
  const [erreurChoix, setErreurChoix] = useState<unknown>(null);
  const d = dispositions.data;
  // Disposer et partager son tableau : droit tableau_de_bord:modifier (ADR 0078, lot 2b).
  const peutModifier = can('tableau_de_bord', 'modifier');
  // Tableau choisi, sinon le sien, sinon celui de l'organisation, sinon la standard (aussi s'il ne se charge pas).
  const affiche = d ? tableauAffiche(d) : null;
  const disposition = affiche?.disposition ?? null;
  const recu = d?.partages.find((p) => p.id === affiche?.id) ?? null;
  const choix = d ? choixTableaux(d) : [];

  async function choisir(tableau: string) {
    setErreurChoix(null);
    try {
      qc.setQueryData(
        CLE_DISPOSITION,
        await api<DispositionsOut>('PUT', '/api/tableau-de-bord/choix', {
          body: { tableau: tableau || null },
        }),
      );
    } catch (e) {
      setErreurChoix(e);
    }
  }
  async function abandonner() {
    setErreurChoix(null);
    try {
      await del('/api/tableau-de-bord/disposition');
      await qc.invalidateQueries({ queryKey: CLE_DISPOSITION });
    } catch (e) {
      setErreurChoix(e);
    }
  }
  async function copier(t: TableauPartage) {
    setErreurChoix(null);
    try {
      await api('PUT', '/api/tableau-de-bord/disposition', {
        body: { disposition: t.disposition },
        ifMatch: d?.personnelle?.version ?? 0,
      });
      await qc.invalidateQueries({ queryKey: CLE_DISPOSITION });
    } catch (e) {
      setErreurChoix(e);
    }
  }
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
        actions={
          (site || (synthese.data && d && mode === 'lecture' && (peutModifier || d.personnelle))) && (
            <>
              {synthese.data && d && mode === 'lecture' && peutModifier && (
                <>
                  <Button variant="default" onClick={() => setMode('edition')}>
                    Modifier la disposition
                  </Button>
                  {d.personnelle && (
                    <Button variant="default" onClick={() => setMode('partage')}>
                      Partager
                    </Button>
                  )}
                  {recu && (
                    <ConfirmButton
                      variant="light"
                      color="blue"
                      message={
                        d.personnelle
                          ? `Copier le tableau de bord de ${recu.auteur} ? Il remplacera votre disposition.`
                          : `Copier le tableau de bord de ${recu.auteur} comme le vôtre ?`
                      }
                      onConfirm={() => void copier(recu)}
                    >
                      Copier comme mon tableau
                    </ConfirmButton>
                  )}
                </>
              )}
              {synthese.data && d?.personnelle && mode === 'lecture' && !peutModifier && (
                // Disposition enregistrée avant le droit dédié : on peut toujours l'abandonner (ADR 0078, lot 2b).
                <ConfirmButton
                  variant="default"
                  color="gray"
                  message="Revenir à la disposition par défaut ? Votre disposition personnelle sera supprimée."
                  onConfirm={() => void abandonner()}
                >
                  Revenir à la disposition par défaut
                </ConfirmButton>
              )}
              {site && <LienSite url={site} nom={me.orgName} />}
            </>
          )
        }
      />
      {synthese.error && <ErrorAlert error={synthese.error} />}
      <ErrorAlert error={erreurChoix} />
      {synthese.data && d && mode === 'lecture' && choix.length > 1 && (
        <NativeSelect
          className="tdb-choix"
          label="Tableau affiché"
          value={d.choix ?? ''}
          data={choix}
          onChange={(e) => void choisir(e.currentTarget.value)}
        />
      )}
      {synthese.data && mode === 'partage' && <PartageTableauDeBord onFin={() => setMode('lecture')} />}
      {synthese.data &&
        !dispositions.isPending &&
        (mode === 'edition' && d ? (
          <EditionTableauDeBord
            s={synthese.data}
            dispositions={d}
            base={disposition}
            peutDefinirDefaut={can('administration', 'administrer')}
            onFin={() => setMode('lecture')}
          />
        ) : (
          <TableauDeBordConformite s={synthese.data} disposition={disposition} />
        ))}
      <div className="grille-cartes">
        {synthese.data && (
          <div className="section-label carte-large">
            <Text className="page-eyebrow">Votre espace de travail</Text>
            <Text size="sm" c="dimmed">
              Accès aux modules et activité de l’équipe
            </Text>
          </div>
        )}
        {acces}
      </div>
    </Page>
  );
}

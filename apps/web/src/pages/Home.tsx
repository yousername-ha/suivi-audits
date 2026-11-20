/* Accueil : tableaux de bord de la personne en onglets (ADR 0109), au style de la vue analytique (ADR 0108) ; le premier
   onglet s'ouvre à l'arrivée. Ses tableaux se modifient et se partagent ; ceux des autres (proposés d'office, partagés,
   publics) restent en lecture seule, avec les chiffres de leur auteur quand ils sont ouverts. Puis accès aux modules et
   activité en cours. Sans droit métier, seuls les tableaux aux chiffres ouverts ont des données. */
import { Button, Card, Stack, Text, Title, VisuallyHidden } from '@mantine/core';
import { ErrorAlert, IconeAdministration, IconeDocuments, IconeHistorique, Page, PageHeader } from '@suivi/ui';
import type { ChiffresPublics, TableauDetail } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { cartesVisibles } from '../administration-droits';
import { api, get } from '../api';
import type { SyntheseApi } from '../components/Synthese';
import { EditionTableauDeBord } from '../components/DispositionTableauDeBord';
import { syntheseOuverte, TableauDeBordConformite } from '../components/TableauDeBord';
import {
  BandeauTableau,
  CLE_TABLEAUX,
  FenetreAjouter,
  FenetreCreer,
  OngletsTableaux,
  PartageTableau,
  useTableaux,
} from '../components/TableauxDeBord';
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
  const qc = useQueryClient();
  const tableaux = useTableaux();
  const t = tableaux.data;
  const [choisi, setChoisi] = useState<string | null>(null);
  const [mode, setMode] = useState<'lecture' | 'edition' | 'partage'>('lecture');
  const [catalogueAuDepart, setCatalogueAuDepart] = useState(false);
  const [fenetre, setFenetre] = useState<'creer' | 'ajouter' | null>(null);
  const [erreurOnglet, setErreurOnglet] = useState<unknown>(null);
  // Premier onglet à l'arrivée (ADR 0109) ; un onglet retiré ou devenu invisible ramène au premier.
  const actif: TableauDetail | undefined = t ? (t.onglets.find((o) => o.id === choisi) ?? t.onglets[0]) : undefined;
  const ouverts = useQuery({
    queryKey: [...CLE_TABLEAUX, actif?.id, 'chiffres'],
    queryFn: () => get<ChiffresPublics>(`/api/tableaux-de-bord/${actif!.id}/chiffres`),
    enabled: !!actif?.chiffresOuverts,
  });
  const chiffres = actif?.chiffresOuverts ? (ouverts.data ?? null) : null;
  const s = chiffres ? syntheseOuverte(chiffres, synthese.data, me.orgName) : synthese.data;
  const peutPartager =
    !!actif &&
    ((actif.origine === 'mien' && !!t?.droits.creer) || (actif.origine === 'propose' && !!t?.droits.modeles));

  function choisir(id: string) {
    setChoisi(id);
    setMode('lecture');
  }
  async function retirer(id: string) {
    setErreurOnglet(null);
    try {
      await api('PUT', '/api/tableaux-de-bord/onglets', {
        body: { tableaux: (t?.onglets ?? []).map((o) => o.id).filter((x) => x !== id) },
      });
      setChoisi(null);
      await qc.invalidateQueries({ queryKey: CLE_TABLEAUX });
    } catch (e) {
      setErreurOnglet(e);
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
        description={s ? `Tableau de bord — ${s.organisation}` : undefined}
        actions={
          (site || (s && actif && mode === 'lecture' && (actif.modifiable || peutPartager))) && (
            <>
              {s && actif && mode === 'lecture' && actif.modifiable && (
                <Button
                  variant="default"
                  onClick={() => {
                    setCatalogueAuDepart(false);
                    setMode('edition');
                  }}
                >
                  Modifier la disposition
                </Button>
              )}
              {actif && mode === 'lecture' && peutPartager && (
                <Button variant="default" onClick={() => setMode('partage')}>
                  Partager
                </Button>
              )}
              {site && <LienSite url={site} nom={me.orgName} />}
            </>
          )
        }
      />
      {synthese.error && <ErrorAlert error={synthese.error} />}
      <ErrorAlert error={ouverts.error ?? erreurOnglet} />
      {t && actif && mode !== 'edition' && (
        <OngletsTableaux
          donnees={t}
          actif={actif.id}
          onChoisir={choisir}
          onCreer={() => setFenetre('creer')}
          onAjouter={() => setFenetre('ajouter')}
        />
      )}
      {actif && mode === 'lecture' && (
        <BandeauTableau
          tableau={actif}
          onRetirer={
            actif.origine !== 'mien' && (t?.onglets.length ?? 0) > 1 ? () => void retirer(actif.id) : undefined
          }
        />
      )}
      {actif && mode === 'partage' && t && (
        <PartageTableau tableau={actif} peutPublier={t.droits.publier} onFin={() => setMode('lecture')} />
      )}
      {s &&
        (mode === 'edition' && actif?.modifiable && synthese.data ? (
          <EditionTableauDeBord
            key={actif.id}
            s={synthese.data}
            tableau={actif}
            ouvrirCatalogue={catalogueAuDepart}
            onFin={() => setMode('lecture')}
          />
        ) : (
          // Module « tableau de bord » désactivé ou onglets indisponibles : disposition standard, sans onglets.
          <TableauDeBordConformite
            key={actif?.id ?? 'standard'}
            s={s}
            disposition={actif?.disposition ?? null}
            ouverts={chiffres}
          />
        ))}
      {t && (
        <>
          <FenetreCreer
            ouverte={fenetre === 'creer'}
            donnees={t}
            onFermer={() => setFenetre(null)}
            onCree={(nouveau) => {
              setFenetre(null);
              setChoisi(nouveau.id);
              setCatalogueAuDepart(nouveau.disposition.dalles.every((x) => x.masquee));
              setMode('edition');
            }}
          />
          <FenetreAjouter
            ouverte={fenetre === 'ajouter'}
            donnees={t}
            onFermer={() => setFenetre(null)}
            onAjoute={(id) => {
              setFenetre(null);
              choisir(id);
            }}
          />
        </>
      )}
      <div className="grille-cartes">
        {s && (
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

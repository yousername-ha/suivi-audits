/* Administration en deux entrées, chacune une page de cartes (icône, nom, synthèse) : « Plateforme » (organisation,
   comptes, référentiels, échelles, affichage) et « Configuration système » (exploitation du serveur). Le détail d'une carte
   s'ouvre dans une fenêtre centrée à bordure visible ; la fermer ramène à la page de cartes. Les anciennes adresses
   /parametres/… et /admin/… restent valables. Aucune API nouvelle : les panneaux sont ceux des écrans historiques. */
import { Badge, Card, Group, Modal, Stack, Text, Title } from '@mantine/core';
import { ConfirmDialog, Page, PageHeader } from '@suivi/ui';
import type { SystemeOut } from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { cartesVisibles, type Cote, type Peut } from '../administration-droits';
import { get } from '../api';
import { fmtDate } from '../components/common';
import { PoivrePanel } from '../components/Poivre';
import { RemiseAVidePanel } from '../components/RemiseAVide';
import { UpdatesPanel } from '../components/Updates';
import { useCan } from '../session';
import { DetailsTechniques, Audit, Sessions, Versions } from './Admin';
import { GroupsPanel, RolesPanel, UsersPanel } from './AdminAccess';
import { BackupsPanel } from './AdminBackups';
import { CleSecoursPanel } from '../components/CleSecours';
import { CalendriersPanel } from './AdminCalendriers';
import { FonctionsPanel } from './AdminFonctions';
import { JournauxTechniquesPanel } from './AdminJournauxTechniques';
import { ImportPanel } from './AdminImport';
import { ImportTenacyPanel } from './AdminImportTenacy';
import { ModulesPanel } from './AdminModules';
import { MursPanel } from './AdminMurs';
import { NotificationsPanel } from './AdminNotifications';
import { OperationsPanel } from './AdminOperations';
import { TypesProcessusPanel } from './AdminTypesProcessus';
import { SectionLoader } from './Settings';

type Teinte = 'vert' | 'bleu' | 'violet' | 'orange' | 'rouge' | 'gris';
type Icone =
  | 'reglages'
  | 'calendrier'
  | 'livre'
  | 'echelles'
  | 'personne'
  | 'groupe'
  | 'fonction'
  | 'cle'
  | 'palette'
  | 'cloche'
  | 'ecran'
  | 'import'
  | 'base'
  | 'maj'
  | 'cadenas'
  | 'bouclier'
  | 'horloge'
  | 'journal'
  | 'logs'
  | 'modules'
  | 'terminal';

interface Carte {
  id: string;
  cote: Cote;
  titre: string;
  resume: string;
  icone: Icone;
  teinte: Teinte;
  /** Détail affiché dans la fenêtre centrée. Absent : la carte ouvre une page entière (`lien`). */
  detail?: (modifie: (m: boolean) => void, can: Peut) => ReactNode;
  lien?: string;
}

const DEFINITIONS: Omit<Carte, 'peut'>[] = [
  {
    id: 'general',
    cote: 'plateforme',
    titre: 'Général',
    resume: 'Nom de l’organisation, logo et coordonnées affichés dans l’application.',
    icone: 'reglages',
    teinte: 'vert',
    detail: (m) => <SectionLoader section="general" onDirty={m} />,
  },
  {
    id: 'cycle',
    cote: 'plateforme',
    titre: 'Cycle de certification',
    resume: 'Années du cycle, prochain audit et audit interne.',
    icone: 'calendrier',
    teinte: 'bleu',
    detail: (m) => <SectionLoader section="cycle" onDirty={m} />,
  },
  {
    id: 'referentiels',
    cote: 'plateforme',
    titre: 'Référentiels',
    resume: 'Référentiels chargés et référentiel complémentaire actif.',
    icone: 'livre',
    teinte: 'orange',
    detail: (m) => <SectionLoader section="referentiels" onDirty={m} />,
  },
  {
    id: 'echelles',
    cote: 'plateforme',
    titre: 'Échelles et matrices (GRC)',
    resume: 'Échelles de vraisemblance et de gravité, matrices versionnées.',
    icone: 'echelles',
    teinte: 'rouge',
    lien: '/parametres/configuration-grc',
  },
  {
    id: 'utilisateurs',
    cote: 'plateforme',
    titre: 'Utilisateurs',
    resume: 'Comptes, statut et double authentification.',
    icone: 'personne',
    teinte: 'vert',
    detail: () => <UsersPanel />,
  },
  {
    id: 'groupes',
    cote: 'plateforme',
    titre: 'Groupes',
    resume: 'Groupes et appartenances.',
    icone: 'groupe',
    teinte: 'bleu',
    detail: () => <GroupsPanel />,
  },
  {
    id: 'fonctions',
    cote: 'plateforme',
    titre: 'Fonctions',
    resume: 'RSSI, DPO, pilotes de processus et autres fonctions.',
    icone: 'fonction',
    teinte: 'violet',
    detail: () => <FonctionsPanel />,
  },
  {
    id: 'roles',
    cote: 'plateforme',
    titre: 'Rôles et droits',
    resume: 'Droits par module, rôles et revue des accès.',
    icone: 'cle',
    teinte: 'rouge',
    detail: () => <RolesPanel />,
  },
  {
    id: 'conservation',
    cote: 'plateforme',
    titre: 'Conservation',
    resume: 'Durées de conservation et aperçu de ce qui serait purgé. Aucune suppression automatique.',
    icone: 'horloge',
    teinte: 'orange',
    detail: (m) => <SectionLoader section="conservation" onDirty={m} />,
  },
  {
    id: 'calendriers',
    cote: 'plateforme',
    titre: 'Calendriers',
    resume: 'Jours fériés français et calendriers iCalendar réutilisés par les séries de tâches.',
    icone: 'calendrier',
    teinte: 'bleu',
    detail: () => <CalendriersPanel />,
  },
  {
    id: 'types-processus',
    cote: 'plateforme',
    titre: 'Types de processus',
    resume: 'Pilotage, réalisation, support ou vos propres types : classement des processus et de la cartographie.',
    icone: 'fonction',
    teinte: 'violet',
    detail: () => <TypesProcessusPanel />,
  },
  {
    id: 'apparence',
    cote: 'plateforme',
    titre: 'Apparence',
    resume: 'Thème, densité et style par défaut pour l’organisation.',
    icone: 'palette',
    teinte: 'orange',
    detail: (m) => <SectionLoader section="apparence" onDirty={m} />,
  },
  {
    id: 'notifications',
    cote: 'plateforme',
    titre: 'Notifications',
    resume: 'Délais d’alerte avant une échéance.',
    icone: 'cloche',
    teinte: 'vert',
    detail: (m) => <SectionLoader section="notifications" onDirty={m} />,
  },
  {
    id: 'notifications-destinataires',
    cote: 'plateforme',
    titre: 'Destinataires des notifications',
    resume: 'Qui reçoit quoi, dans l’application et par courriel : réglage par groupe, rôle et compte.',
    icone: 'cloche',
    teinte: 'orange',
    detail: () => <NotificationsPanel />,
  },
  {
    id: 'murs',
    cote: 'plateforme',
    titre: 'Écrans muraux',
    resume: 'Affichages en salle : jeton, périmètre et contenu.',
    icone: 'ecran',
    teinte: 'bleu',
    detail: () => <MursPanel />,
  },
  {
    id: 'import',
    cote: 'plateforme',
    titre: 'Import et export',
    resume: 'Reprise des données de l’ancien outil, import de référence et exports.',
    icone: 'import',
    teinte: 'violet',
    detail: (m, can) => (
      <Stack gap="xl">
        {can('parametres', 'lire') && <SectionLoader section="import_export" onDirty={m} />}
        <ImportPanel />
        <ImportTenacyPanel />
      </Stack>
    ),
  },
  {
    id: 'sauvegardes',
    cote: 'systeme',
    titre: 'Sauvegardes et restauration',
    resume: 'Archives, restauration guidée et suivi des tests de restauration.',
    icone: 'base',
    teinte: 'vert',
    detail: (m, can) => (
      <Stack gap="xl">
        {can('administration', 'lire') && <CleSecoursPanel />}
        <BackupsPanel />
        {can('parametres', 'lire') && <SectionLoader section="sauvegardes" onDirty={m} />}
        {can('administration', 'administrer') && <RemiseAVidePanel />}
      </Stack>
    ),
  },
  {
    id: 'courriel',
    cote: 'systeme',
    titre: 'Courriel',
    resume: 'Serveur SMTP/SMTPS, contact technique et message de test.',
    icone: 'cloche',
    teinte: 'bleu',
    detail: (m) => <SectionLoader section="courriel" onDirty={m} />,
  },
  {
    id: 'mises-a-jour',
    cote: 'systeme',
    titre: 'Mises à jour et versions',
    resume: 'Version installée, mise à jour depuis l’interface, historique des versions.',
    icone: 'maj',
    teinte: 'bleu',
    detail: () => (
      <Stack gap="xl">
        <UpdatesPanel />
        <Versions />
      </Stack>
    ),
  },
  {
    id: 'certificats',
    cote: 'systeme',
    titre: 'Certificats et opérations',
    resume: 'Certificat du serveur (aperçu, échéance), opérations d’exploitation.',
    icone: 'cadenas',
    teinte: 'rouge',
    detail: () => <OperationsPanel />,
  },
  {
    id: 'securite',
    cote: 'systeme',
    titre: 'Sécurité',
    resume: 'Mots de passe, durée des sessions et double authentification.',
    icone: 'bouclier',
    teinte: 'vert',
    detail: (m, can) => (
      <Stack gap="xl">
        <SectionLoader section="securite" onDirty={m} />
        {can('administration', 'administrer') && <PoivrePanel />}
      </Stack>
    ),
  },
  {
    id: 'sessions',
    cote: 'systeme',
    titre: 'Sessions actives',
    resume: 'Connexions en cours et déconnexion forcée.',
    icone: 'horloge',
    teinte: 'violet',
    detail: () => <Sessions />,
  },
  {
    id: 'journal',
    cote: 'systeme',
    titre: 'Journal d’audit',
    resume: 'Qui a fait quoi : période, compte, filtres, export JSON.',
    icone: 'journal',
    teinte: 'orange',
    detail: () => <Audit />,
  },
  {
    id: 'journaux-techniques',
    cote: 'systeme',
    titre: 'Journaux techniques',
    resume: 'Entrées du serveur par niveau (debug, info, avertissement, erreur), réglage du niveau, téléchargement.',
    icone: 'logs',
    teinte: 'rouge',
    detail: () => <JournauxTechniquesPanel />,
  },
  {
    id: 'modules',
    cote: 'systeme',
    titre: 'Modules',
    resume: 'Activation et désactivation des modules de l’outil.',
    icone: 'modules',
    teinte: 'bleu',
    detail: () => <ModulesPanel />,
  },
  {
    id: 'details',
    cote: 'systeme',
    titre: 'Détails techniques',
    resume: 'Versions logicielles, base de données, migrations, volumétrie.',
    icone: 'terminal',
    teinte: 'gris',
    detail: () => <DetailsTechniques />,
  },
];

export const COTES: Record<Cote, { route: string; titre: string; description: string }> = {
  plateforme: {
    route: '/plateforme',
    titre: 'Plateforme',
    description: 'Ce qui définit votre organisation et qui a accès à quoi.',
  },
  systeme: {
    route: '/systeme',
    titre: 'Configuration système',
    description: 'Ce qui fait tourner l’outil : sauvegardes, versions, sécurité, journaux.',
  },
};

/** Cartes d'un côté, filtrées par les droits de la personne. */
const CARTES = DEFINITIONS;
export const cartesDuCote = (can: Peut, cote: Cote) => {
  const ids = new Set(cartesVisibles(can, cote));
  return CARTES.filter((c) => c.cote === cote && ids.has(c.id));
};

const TRACES: Record<Icone, ReactNode> = {
  reglages: <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4" />,
  calendrier: <path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4" />,
  livre: <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11" />,
  echelles: <path d="M4 20V10M10 20V4M16 20v-8M3 20h18" />,
  personne: <path d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />,
  groupe: (
    <path d="M9 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM17 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 20c0-3 3-5 6-5s6 2 6 5M16 15c3 0 5 2 5 5" />
  ),
  fonction: <path d="M4 8h16v11H4zM9 8V5h6v3M4 13h16" />,
  cle: <path d="M8 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 12h9M18 12v4M21 12v3" />,
  palette: (
    <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 0 0 3-3c0-5-4-11-8-11zM8 11h0M12 7h0M16 10h0" />
  ),
  cloche: <path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4" />,
  ecran: <path d="M3 4h18v12H3zM8 20h8M12 16v4" />,
  import: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  base: (
    <path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  ),
  maj: <path d="M20 12a8 8 0 1 1-3-6.200M20 4v5h-5" />,
  cadenas: <path d="M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3" />,
  bouclier: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" />,
  horloge: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2" />,
  journal: <path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h3" />,
  modules: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  logs: <path d="M4 6h16M4 12h10M4 18h14M19 12h0" />,
  terminal: <path d="M3 5h18v14H3zM7 10l3 2-3 2M12 15h5" />,
};

function Pictogramme({ icone, teinte }: { icone: Icone; teinte: Teinte }) {
  return (
    <span className="carte-admin__icone" data-teinte={teinte} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {TRACES[icone]}
      </svg>
    </span>
  );
}

/** Synthèses lues sur le serveur pour les cartes d'exploitation (droit d'administration requis). */
function useSyntheses(actif: boolean): Record<string, ReactNode> {
  const q = useQuery({
    queryKey: ['admin', 'systeme'],
    queryFn: () => get<SystemeOut>('/api/admin/systeme'),
    enabled: actif,
  });
  const s = q.data;
  if (!s) return {};
  const sv = s.sauvegarde;
  return {
    sauvegardes: sv.enRetard ? (
      <Badge color="red" variant="light">
        Sauvegarde en retard
      </Badge>
    ) : sv.derniereReussie ? (
      <Badge color="green" variant="light">
        Dernière : {fmtDate(sv.derniereReussie.date)}
      </Badge>
    ) : (
      <Badge color="orange" variant="light">
        Aucune sauvegarde connue
      </Badge>
    ),
    'mises-a-jour': (
      <Badge variant="light" color="gray">
        Version {s.version}
      </Badge>
    ),
  };
}

export function PageCartes({ cote }: { cote: Cote }) {
  const can = useCan();
  const nav = useNavigate();
  const { carte } = useParams();
  const info = COTES[cote];
  const cartes = cartesDuCote(can, cote);
  const syntheses = useSyntheses(cote === 'systeme' && can('administration', 'lire'));
  const [modifie, setModifie] = useState(false);
  const [quitter, setQuitter] = useState(false);
  const signaler = useCallback((m: boolean) => setModifie(m), []);
  if (!cartes.length) return <Navigate to="/" replace />;
  const ouverte = cartes.find((c) => c.id === carte && c.detail);
  const fermer = () => {
    setModifie(false);
    setQuitter(false);
    nav(info.route);
  };
  return (
    <Page>
      <PageHeader title={info.titre} description={info.description} />
      <div className="grille-cartes cartes-admin">
        {cartes.map((c) => (
          <Card
            key={c.id}
            withBorder
            className="carte-admin"
            component={Link}
            to={c.lien ?? `${info.route}/${c.id}`}
            aria-label={`${c.titre} : ${c.resume}`}
          >
            <Pictogramme icone={c.icone} teinte={c.teinte} />
            <Title order={2} size="h4">
              {c.titre}
            </Title>
            <Text size="sm" c="dimmed">
              {c.resume}
            </Text>
            {syntheses[c.id] && <Group mt="xs">{syntheses[c.id]}</Group>}
          </Card>
        ))}
      </div>
      <Modal
        closeButtonProps={{ 'aria-label': `Fermer ${ouverte?.titre ?? 'la fenêtre'}` }}
        opened={!!ouverte}
        onClose={() => (modifie ? setQuitter(true) : fermer())}
        title={ouverte?.titre}
        size="xl"
        centered
        classNames={{ content: 'fenetre-admin' }}
        keepMounted={false}
      >
        {ouverte?.detail?.(signaler, can)}
      </Modal>
      <ConfirmDialog
        opened={quitter}
        title="Modifications non enregistrées"
        message="Fermer cette fenêtre sans enregistrer ? Vos modifications seront perdues."
        confirmLabel="Fermer sans enregistrer"
        color="orange"
        onClose={() => setQuitter(false)}
        onConfirm={fermer}
      />
    </Page>
  );
}

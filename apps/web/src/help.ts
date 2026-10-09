/* Guide embarqué versionné avec le code : seulement les fonctionnalités réellement disponibles. */
import { MODULE_LABELS, type BusinessModule, type Permission } from '@suivi/shared';
export const HELP_VERSION = '2026-10-09';
export interface HelpArticle {
  id: string;
  title: string;
  permission?: Permission;
  link: string;
  steps: string[];
}
const HISTORICAL_MODULES: readonly BusinessModule[] = [
  'audit',
  'ecarts',
  'plan_audit',
  'pilotage',
  'fournisseurs',
  'conformite',
  'ia',
  'crrc',
  'investissements',
  'incidents',
];

export const HELP_ARTICLES: HelpArticle[] = [
  ...HISTORICAL_MODULES.map((module): HelpArticle => ({
    id: `historique-${module}`,
    title: MODULE_LABELS[module],
    permission: `${module}:lire`,
    link: '/legacy/',
    steps: [
      `Ouvrez l’outil de suivi historique, puis la rubrique « ${MODULE_LABELS[module]} ».`,
      'Ce module fait partie du socle de la plateforme. Ses données et ses fonctions restent accessibles pendant sa reprise progressive dans la charte Sauge.',
      'Les modifications et exports dépendent de vos droits. Le serveur contrôle les permissions et conserve un historique des états.',
      'La reprise dans la nouvelle interface sera validée sur les données, les relations, les exports et les parcours existants avant le retrait de l’ancienne rubrique.',
    ],
  })),
  {
    id: 'compte',
    title: 'Connexion, double authentification et déconnexion',
    link: '/account',
    steps: [
      'Connectez-vous avec votre identifiant et votre mot de passe, puis saisissez le code de votre application d’authentification.',
      'Lors de la première connexion, activez la double authentification et changez le mot de passe temporaire si cela vous est demandé.',
      'Dans Mon compte, gérez votre mot de passe, votre double authentification et vos sessions.',
      'Utilisez Déconnexion pour fermer la session. En cas d’erreur réseau ou de refus du serveur, un message vous permet de réessayer : la fermeture n’est pas annoncée comme réussie.',
    ],
  },
  {
    id: 'documents',
    title: 'Documents, liens et versions',
    permission: 'documents:lire',
    link: '/documents',
    steps: [
      'Ouvrez Documents et liens pour rechercher une pièce ou consulter sa fiche et ses rattachements.',
      'Si vos droits le permettent, déposez un document, renseignez son titre et ses références, ou ajoutez un lien.',
      'Une nouvelle version conserve les versions précédentes. Vérifiez la version de la pièce utilisée comme preuve.',
      'Les téléchargements et les modifications restent soumis à vos droits ; un lien interne ne rend pas le document public.',
    ],
  },
  {
    id: 'cartographie',
    title: 'Cartographie et fiche de sélection',
    permission: 'cartographie:lire',
    link: '/cartographie',
    steps: [
      'Choisissez la vue contexte ou processus. La génération utilise les objets déjà présents dans la plateforme, selon vos droits.',
      'Sélectionnez un objet ou une relation pour ouvrir sa fiche. Sur grand écran, fermer la fiche libère la place pour la carte ; Infos permet de rouvrir les informations de la carte.',
      'Le bouton Panneau contrôle les filtres. Il est distinct de la fiche de sélection.',
      'Si vous pouvez modifier la carte, enregistrez votre disposition. En cas de conflit, examinez la version courante avant de choisir Recharger ou Écraser.',
      'Les exports disponibles sont proposés dans Exporter selon vos droits. Une carte ne prouve pas à elle seule la conformité à un référentiel.',
    ],
  },
  {
    id: 'historique',
    title: 'Outil de suivi historique',
    permission: 'audit:lire',
    link: '/legacy/',
    steps: [
      'Le lien Outil de suivi (ancienne interface) donne accès aux modules qui ne sont pas encore repris dans la nouvelle interface.',
      'Les modules visibles et les possibilités de modification dépendent de vos permissions.',
      'Les données sont enregistrées sur le serveur et versionnées ; en cas d’écriture concurrente, examinez le conflit avant de remplacer un état.',
    ],
  },
  {
    id: 'import',
    title: 'Simulation, import et historique',
    permission: 'import_export:lire',
    link: '/admin/import',
    steps: [
      'Utilisez l’écran Import pour charger une sauvegarde JSON de l’outil historique. Commencez par la simulation et lisez le rapport.',
      'Vérifiez le mode d’import et ses conséquences avant l’application. Seuls les utilisateurs disposant des droits nécessaires peuvent appliquer les données.',
      'Consultez l’historique pour retrouver le rapport et le fichier source. L’annulation reste soumise aux contrôles de concurrence et aux permissions.',
    ],
  },
  {
    id: 'droits',
    title: 'Comptes, groupes et rôles',
    permission: 'administration:lire',
    link: '/admin/users',
    steps: [
      'Dans Administration, attribuez aux comptes les groupes et rôles correspondant à leur besoin réel.',
      'La matrice décrit les permissions par module et action. Les droits effectifs indiquent leur origine.',
      'Transmettez un mot de passe temporaire par un canal adapté. Ne le copiez pas dans un ticket ou un journal public.',
      'Une revue des accès peut être exportée. Le contrôle serveur demeure actif même si une entrée du menu est masquée.',
    ],
  },
  {
    id: 'systeme',
    title: 'Sauvegardes, restauration et exploitation',
    permission: 'administration:lire',
    link: '/admin/system',
    steps: [
      'L’écran Système affiche les rapports d’exploitation, la version et la dernière sauvegarde connue. Il ne lance pas une mise à jour ni une restauration.',
      'Dans Système, un administrateur peut confirmer une demande de sauvegarde chiffrée et suivre son état. L’exécutant doit être configuré sur le serveur ; une demande en attente peut être annulée. Les comptes en lecture seule consultent les résultats.',
      'Une restauration remplace les données et les secrets : préparez une sauvegarde, une confirmation et une recette isolée avec l’équipe d’exploitation.',
      'Le certificat HTTPS est géré par Caddy et la configuration du serveur. La destination, les clés et la rétention restent configurées sur le serveur. La restauration guidée, la planification depuis le navigateur et le pilotage TLS restent à développer.',
    ],
  },
];

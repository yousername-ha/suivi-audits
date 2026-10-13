/* Guide embarqué versionné avec le code : seulement les fonctionnalités réellement disponibles. */
import { MODULE_LABELS, type BusinessModule, type Permission } from '@suivi/shared';
export const HELP_VERSION = '2026-10-10';
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
  {
    id: 'pilotage-smsi-grc',
    title: 'Pilotage : qualité, sécurité et référentiels',
    permission: 'pilotage:lire',
    link: '/pilotage',
    steps: [
      'Ouvrez Pilotage dans le menu. Les rubriques reprennent le contexte, les objectifs, la conformité, les écarts, les preuves et les plans ; aucune création de SMSI n’est nécessaire.',
      'Publiez vos référentiels et méthodes après simulation. Les modèles EBIOS RM, ISO 27005 et MÉHARI sont des propositions à adapter ; les exigences ISO sous licence doivent être importées avec leurs droits.',
      'Créez les risques et complétez les étapes de leur méthode. Simulez puis enregistrez explicitement les appréciations brutes et résiduelles ; les décisions sont immuables.',
      'Reliez les fiches à des actifs, exigences, preuves versionnées, audits, contrôles et objectifs existants. Une mesure de traitement génère une action sans recalculer le risque résiduel.',
      'Les actions se synchronisent en liste, Kanban, calendrier, planning et tableau de bord. Les récurrences produisent des occurrences uniques ; les réalisations historiques restent dans leur source.',
      'La cartographie se met à jour depuis le registre. Les couleurs et niveaux appartiennent à chaque méthode ; les versions incompatibles ne produisent pas de comparaison numérique.',
      'Importez les gabarits JSON ou Excel avec simulation et confirmation. Les propositions de correspondance requièrent une revue humaine. Consultez les rappels et exportez les rapports pour le comité de pilotage.',
    ],
  },
  {
    id: 'preuves-controles',
    title: 'Preuves et plan de contrôle',
    permission: 'pilotage:lire',
    link: '/pilotage/controles',
    steps: [
      'Définissez l’objectif, le périmètre, la méthode, les critères de réussite et la prochaine échéance du contrôle.',
      'Planifiez ses répétitions ; les actions utilisent le moteur commun et le plan d’actions.',
      'Réalisez le contrôle avec un résultat, une justification et des références aux pièces. Un résultat insuffisant peut créer un constat et une action corrective.',
      'Dans le registre des preuves, examinez les versions exactes des documents. Les décisions sont conservées sans duplication des fichiers.',
    ],
  },
  {
    id: 'amelioration',
    title: 'Amélioration continue',
    permission: 'ecarts:lire',
    link: '/pilotage/amelioration',
    steps: [
      'Le registre reprend les écarts historiques et leurs tâches dans leur source. Ajoutez les constats et opportunités, renseignez l’origine et les causes.',
      'Créez les actions suivies et reliez audits, incidents, mesures, risques, contrôles et revues.',
      'Vérifiez l’efficacité avec une justification et des pièces. Une clôture exige une efficacité positive et les actions liées terminées.',
      'Les indicateurs utilisent uniquement les dates, causes et résultats renseignés.',
    ],
  },
  {
    id: 'perimetres-pilotage',
    title: 'Périmètres de management',
    permission: 'pilotage:lire',
    link: '/pilotage/perimetres',
    steps: [
      'La rubrique Périmètres liste les périmètres auxquels vous avez accès. « Afficher » ouvre le périmètre choisi dans le Pilotage.',
      'Le rôle de Pilotage crée et modifie un périmètre : nom, texte du périmètre, fuseau et nature. La nature (SMSI, SMQ, SMI ou un libellé libre) est facultative et ne change pas le fonctionnement.',
      'Pour un périmètre restreint, « Accès » attribue ou retire l’accès des comptes. Rien n’est supprimé : les données d’un périmètre restent conservées.',
    ],
  },
  {
    id: 'bibliotheque-referentiels',
    title: 'Bibliothèque de référentiels',
    permission: 'conformite:lire',
    link: '/pilotage/bibliotheque',
    steps: [
      'La bibliothèque contient les référentiels de l’organisation, importés une seule fois. Aucun texte normatif n’est fourni : importez les exigences dont vous détenez les droits.',
      'Importer un référentiel : collez sa définition, simulez la publication, indiquez un motif puis publiez. Chaque version est immuable ; une évolution crée une nouvelle version.',
      'Dans la page Périmètres, « Référentiels » rattache une version précise à un périmètre. Le même référentiel peut être rattaché à plusieurs périmètres sans être importé à nouveau.',
      'Un référentiel déjà publié dans un périmètre peut être promu dans la bibliothèque (simulation puis confirmation) ; l’original est conservé.',
    ],
  },
  {
    id: 'parcours-pilotage',
    title: 'Parcours guidé',
    permission: 'pilotage:lire',
    link: '/pilotage/parcours',
    steps: [
      'Démarrez un parcours pour une démarche qualité, sécurité, HDS, intégrée ou personnalisée. Indiquez organisation, périmètre et objectifs.',
      'Chaque étape indique pourquoi agir, les travaux, les acteurs et les documents utiles. Ouvrez les modules liés et réutilisez les données présentes.',
      'Un administrateur valide les travaux avec des références et une justification. Quittez et reprenez le parcours à tout moment.',
      'L’avancement représente des travaux réalisés ; il ne vaut ni conformité ni certification. Une modification du cadrage demande une nouvelle revue.',
    ],
  },
  {
    id: 'continuite',
    title: 'BIA, continuité, reprise et exercices',
    permission: 'pilotage:lire',
    link: '/pilotage/bia',
    steps: [
      'Décrivez les activités, services, scénarios, ressources, dépendances et impacts pour plusieurs durées d’interruption.',
      'Fixez la durée maximale d’interruption, l’objectif de reprise et la perte de données acceptable.',
      'Préparez un PCA, PRA, PCRA cadre ou plan propre à une activité ; reliez les BIA, actifs, risques et documents existants.',
      'Planifiez les exercices et enregistrez leurs résultats et le RETEX. Créez des actions suivies pour les améliorations.',
      'Cette première étape E fournit des formulaires génériques ; les kits ANS et le programme CaRE ne sont pas incorporés.',
    ],
  },
  {
    id: 'evaluations-ia-versionnees',
    title: 'Évaluations IA versionnées',
    permission: 'ia:lire',
    link: '/ia/evaluations',
    steps: [
      'Depuis le menu utilisateur du registre historique ou ce guide, ouvrez les évaluations IA versionnées et consultez un scénario existant.',
      'Avec le droit de modification IA, choisissez une version publiée et les niveaux explicitement, puis simulez sans écriture.',
      'Saisissez le motif et ENREGISTRER pour conserver une décision immuable : source complète, configuration, résultat et auteur.',
      'Les décisions restent consultables après modification ou retrait de la source. Une nouvelle configuration ne recalcule jamais le passé. L’export JSON exige les droits IA et import/export.',
    ],
  },
  {
    id: 'configuration-environnement',
    title: 'Configuration de l’environnement',
    permission: 'administration:lire',
    link: '/admin/environment',
    steps: [
      'Depuis Administration → Système, ouvrez Configurer l’environnement pour consulter les échelles, la matrice et les versions publiées.',
      'Un administrateur peut modifier un brouillon, choisir un scénario puis valider et simuler. Le simulateur ne crée pas d’évaluation métier.',
      'La publication exige un motif et la confirmation PUBLIER. Chaque version reste immuable ; reprendre une ancienne définition prépare une nouvelle publication.',
      'Les évaluations et méthodes de l’outil historique restent inchangées. Le raccordement explicite des scénarios IA est disponible dans Évaluations IA versionnées. Les autres familles et paramètres métier restent à reprendre dans B2.',
    ],
  },
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
      'L’écran Système affiche les rapports d’exploitation, la version et la dernière sauvegarde connue. Dans Mise à jour de l’application, le rôle Administrateur peut vérifier les nouveautés puis confirmer une installation ; les autres comptes sont informés par le bandeau. Enregistrez vos modifications en cours : la page de maintenance suit les étapes réelles et vous ramène automatiquement à l’application après vérification. Un retour arrière est signalé et peut demander une reconnexion.',
      'Dans Certificats TLS, consultez sujet, émetteur, validité et empreinte. Caddy renouvelle les certificats internes/ACME. Le remplacement web nécessite une activation explicite : fournissez le certificat/chaîne et le fichier de clé, dont le contenu reste masqué. Un échec rétablit la configuration antérieure ; Revenir à .env désactive le couple web. Une terminaison TLS externe reste en lecture seule.',
      'Dans Système, un administrateur peut confirmer une demande de sauvegarde chiffrée et suivre son état. Le service de sauvegarde démarre avec l’installation normale ; une demande en attente peut être annulée. Les comptes en lecture seule consultent les résultats.',
      'Dans Archives disponibles, vérifiez l’archive avant de choisir Restaurer. Confirmez le périmètre et tapez RESTAURER. Le serveur crée une sauvegarde de sécurité, applique l’archive et contrôle la santé ; un échec déclenche un retour arrière. Les sessions sont fermées : reconnectez-vous puis consultez le journal des opérations.',
      'Configurez les jours, l’heure UTC et la rétention dans Planification et rétention. La destination et la clé restent privées sur le serveur. L’exploitant doit activer le poller et gérer la transition du cron existant. Une vérification de structure ne remplace pas un test de restauration isolé.',
    ],
  },
];

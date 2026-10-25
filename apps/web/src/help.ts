/* Guide embarqué versionné avec le code : seulement les fonctionnalités réellement disponibles. */
import type { Permission } from '@suivi/shared';
export const HELP_VERSION = '2026-10-10';
export interface HelpArticle {
  id: string;
  title: string;
  permission?: Permission;
  link: string;
  steps: string[];
}
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
      'Importer depuis l’outil de suivi : les clauses ISO 27001, l’Annexe A, le HDS et le ReCyF déjà saisis dans l’outil de suivi s’importent d’un clic après simulation et confirmation. Seuls les intitulés ou textes saisis sont repris ; la source reste « non vérifiée » et jamais normative.',
      'Dans la page Périmètres, « Référentiels » rattache une version précise à un périmètre. Le même référentiel peut être rattaché à plusieurs périmètres sans être importé à nouveau.',
      'Un référentiel déjà publié dans un périmètre peut être promu dans la bibliothèque (simulation puis confirmation) ; l’original est conservé.',
    ],
  },
  {
    id: 'rapprochements',
    title: 'Rapprochements entre référentiels',
    permission: 'conformite:lire',
    link: '/pilotage/rapprochements',
    steps: [
      'Une correspondance de la bibliothèque dit en quoi une exigence d’un référentiel rejoint celle d’un autre. Elle est proposée, puis validée une seule fois pour l’organisation par une personne habilitée (rubrique « Correspondances de la bibliothèque »). Aucune correspondance n’est fournie.',
      'Quand une mesure met déjà en œuvre une exigence et qu’une correspondance validée la rattache à une exigence d’un autre référentiel du périmètre, un rapprochement est proposé. Il n’est jamais appliqué seul : une pastille du menu « Rapprochements à valider », un bandeau de la synthèse et « Mes rappels » signalent les propositions en attente.',
      'Le pilote confirme (un lien « met en œuvre » est alors créé, à son nom) ou rejette avec un motif, une proposition à la fois ou en lot. Une correspondance partielle ne donne jamais une couverture complète.',
      '« Couverture par référentiel » compte, pour chaque référentiel rattaché, les exigences couvertes, à valider et non couvertes. Ce sont des repères de pilotage, pas un taux de conformité.',
    ],
  },
  {
    id: 'fournisseurs-organisation',
    title: 'Fournisseurs de l’organisation',
    permission: 'fournisseurs:lire',
    link: '/pilotage/fournisseurs',
    steps: [
      'Les fournisseurs et leurs évaluations appartiennent à l’organisation, pas à un périmètre : un fournisseur évalué l’est de la même façon dans tous les périmètres où il est rattaché. Le registre est celui de l’outil de suivi ; vous pouvez y ajouter un fournisseur, le reste de sa fiche se complète dans l’outil de suivi.',
      'Rubrique « Critères d’évaluation des fournisseurs » : les critères sont définis par votre organisme (aucun n’est fourni, ni note ni seuil). Chaque critère a des usages tirés de l’ISO 9001:2015 8.4.1 (sélection, évaluation, surveillance, réévaluation) et peut viser des exigences des référentiels de la bibliothèque.',
      'Évaluer : choisissez les critères retenus et indiquez pour chacun « Répond », « Ne répond pas » ou « Non évalué », avec un résultat libre. Une évaluation enregistrée ne se modifie plus ; la plus récente est la courante, les autres restent dans l’historique. Une date de réévaluation est facultative.',
      'Périmètres : rattachez un fournisseur à un ou plusieurs périmètres sans copier son évaluation ; « Fournisseurs du périmètre » les liste avec l’évaluation courante et ceux à réévaluer. Retirer un rattachement ne supprime ni le fournisseur ni ses évaluations.',
      'Donner suite : dans l’historique, « Donner suite » crée dans le périmètre de votre choix une action ou une série de réévaluation liée au fournisseur. Pour la série, indiquez vous-même la première échéance et la fréquence : aucune n’est proposée.',
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
    id: 'parcours-iso',
    title: 'Parcours ISO 27001 / HDS',
    permission: 'pilotage:lire',
    link: '/pilotage/parcours-iso',
    steps: [
      'Le parcours est une autre porte d’entrée vers vos modules : l’arbre (11 raccourcis) et la liste (16 étapes, 26 sous-actions) couvrent les mêmes travaux. Le périmètre affiché est celui du Pilotage ; changez-le avec le sélecteur de périmètre.',
      'Cliquez un cercle pour voir l’étape, le bouton « + » pour déplier ses sous-actions, puis une sous-action pour lire l’attendu. Les travaux déjà présents dans le périmètre sont retrouvés et s’ouvrent dans leur module, avec le même identifiant.',
      'Le parcours n’écrit rien : créez et modifiez dans les modules, la vue se met à jour. La présence de travaux n’est ni une revue, ni une conformité, ni une certification.',
      'Les compléments HDS peuvent être masqués : c’est un réglage d’affichage, il ne change aucune décision d’applicabilité. Les animations se règlent (animées, automatiques selon le système, arrêtées).',
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
    id: 'exports-excel',
    title: 'Exports Excel',
    permission: 'import_export:exporter',
    link: '/exports',
    steps: [
      'Ouvrez Exports Excel dans le menu : les rubriques sont regroupées (audit avec le pronostic, objectifs et indicateurs, conformité, écarts, fournisseurs avec les évaluations par le clausier, contexte, incidents et crise, CRRC, investissements, preuves, plans, IA, GAP applications).',
      'Excel classique donne les données brutes avec filtres ; Excel pro ajoute un sommaire, des en-têtes colorés et une mise en page prête à imprimer.',
      'Les rubriques que vous n’avez pas le droit de lire sont exportées vides. Chaque export est tracé dans le journal d’audit.',
    ],
  },
  {
    id: 'import',
    title: 'Simulation, import et historique',
    permission: 'import_export:lire',
    link: '/plateforme/import',
    steps: [
      'Utilisez l’écran Import pour charger une sauvegarde JSON au format de l’outil de suivi. Commencez par la simulation et lisez le rapport.',
      'Vérifiez le mode d’import et ses conséquences avant l’application. Seuls les utilisateurs disposant des droits nécessaires peuvent appliquer les données.',
      'Consultez l’historique pour retrouver le rapport et le fichier source. L’annulation reste soumise aux contrôles de concurrence et aux permissions.',
    ],
  },
  {
    id: 'parametres-apparence',
    title: 'Paramètres et apparence',
    permission: 'parametres:lire',
    link: '/plateforme',
    steps: [
      'Style global : dans Paramètres > Apparence, choisissez « Référence 08 — Sauge » (défaut) ou « Clair bleuté » pour tous les comptes ; l’aperçu s’affiche avant l’enregistrement. Le thème clair, sombre ou automatique reste un choix personnel.',
      'Thème et densité par défaut s’appliquent à toute personne qui n’a pas choisi ses propres préférences (Mon compte). Seule la permission d’écriture sur les paramètres permet de les modifier.',
    ],
  },
  {
    id: 'droits',
    title: 'Comptes, groupes et rôles',
    permission: 'administration:lire',
    link: '/plateforme/utilisateurs',
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
    link: '/systeme',
    steps: [
      'L’écran Système affiche les rapports d’exploitation, la version et la dernière sauvegarde connue. Dans Mise à jour de l’application, le rôle Administrateur peut vérifier les nouveautés puis confirmer une installation ; les autres comptes sont informés par le bandeau. Enregistrez vos modifications en cours : la page de maintenance s’ouvre dès la confirmation, suit les étapes réelles et vous ramène automatiquement à l’application après vérification. Un retour arrière est signalé et peut demander une reconnexion.',
      'Dans Certificats TLS, consultez sujet, émetteur, validité et empreinte. Caddy renouvelle les certificats internes/ACME. Le remplacement web nécessite une activation explicite : fournissez le certificat/chaîne et le fichier de clé, dont le contenu reste masqué. Un échec rétablit la configuration antérieure ; Revenir à .env désactive le couple web. Une terminaison TLS externe reste en lecture seule.',
      'Dans Système, un administrateur peut confirmer une demande de sauvegarde chiffrée et suivre son état. Le service de sauvegarde démarre avec l’installation normale ; une demande en attente peut être annulée. Les comptes en lecture seule consultent les résultats.',
      'Dans Archives disponibles, vérifiez l’archive avant de choisir Restaurer. Confirmez le périmètre et tapez RESTAURER. Le serveur crée une sauvegarde de sécurité, applique l’archive et contrôle la santé ; un échec déclenche un retour arrière. Les sessions sont fermées : reconnectez-vous puis consultez le journal des opérations.',
      'Configurez les jours, l’heure UTC et la rétention dans Planification et rétention. La destination et la clé restent privées sur le serveur. L’exploitant doit activer le poller et gérer la transition du cron existant. Une vérification de structure ne remplace pas un test de restauration isolé.',
    ],
  },
];

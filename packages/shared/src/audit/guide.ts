/* Aide à la préparation de l'audit : preuves types et questions probables de l'auditeur, par clause ISO 27001 ou mesure
   de l'Annexe A. Contenu repris tel quel du bloc « guide » de l'outil de suivi historique (aucun texte ajouté) ; clés :
   « 5 », « 6.1 » (clauses) et « A.5.15 » (Annexe A). */
export interface GuideAudit {
  preuves: string[];
  questions: string[];
}
export const GUIDE_AUDIT: Record<string, GuideAudit> = {
  '5': {
    preuves: [
      "Politique de sécurité de l'information signée par la direction",
      'Comptes-rendus de comité SMSI ou revue de direction',
      'Organigramme SMSI avec rôles et autorités assignés',
    ],
    questions: [
      'Comment la direction démontre-t-elle son engagement au quotidien ?',
      'La politique de sécurité est-elle communiquée et comprise par le personnel ?',
      'Les rôles SMSI sont-ils formellement nommés et actifs ?',
    ],
  },
  '9': {
    preuves: [
      "Programme d'audit interne et rapport du dernier audit",
      'Tableau de bord SMSI utilisé en revue de direction',
      'Compte-rendu de la revue de direction',
    ],
    questions: [
      'Le tableau de bord SMSI est-il présenté en revue de direction ?',
      'Les indicateurs couvrent-ils tous les processus du SMSI ? (cf. DHA-61)',
      "Pourquoi la revue de direction du 01/04/2025 n'a-t-elle pas traité la performance ? (cf. DHA-63)",
    ],
  },
  '10': {
    preuves: [
      'Registre des non-conformités et actions correctives',
      'Preuves de clôture des actions issues du précédent audit',
      "Plan d'amélioration continue du SMSI",
    ],
    questions: [
      'Quel est le taux de clôture des actions correctives ?',
      'Comment les non-conformités sont-elles analysées en causes racines ?',
      'Comment garantit-on que les actions correctives sont efficaces avant clôture ?',
    ],
  },
  '4.1': {
    preuves: [
      'Analyse PESTEL ou SWOT documentée des enjeux internes et externes',
      'Liste des enjeux contextuels formalisée et datée',
      'Procédure ou méthode de mise à jour du contexte',
    ],
    questions: [
      'Comment les enjeux internes (culture, ressources, SI) sont-ils identifiés et mis à jour ?',
      'Comment les enjeux externes (réglementation, technologie) sont-ils surveillés ?',
      'À quelle fréquence cette analyse est-elle révisée ?',
    ],
  },
  '4.2': {
    preuves: [
      'Cartographie des parties intéressées (internes et externes)',
      'Tableau des exigences associées à chaque partie intéressée',
      'Traçabilité entre exigences et politiques SMSI',
    ],
    questions: [
      'Quelles sont les parties intéressées pertinentes pour le SMSI du GCS ?',
      'Comment les exigences des hébergés (clients HDS) sont-elles intégrées ?',
      'Les exigences ont-elles évolué depuis le dernier audit ?',
    ],
  },
  '4.3': {
    preuves: [
      "Document formel du domaine d'application du SMSI (signé, daté)",
      'Justification des exclusions éventuelles',
      'Carte du périmètre (sites, services, prestataires)',
    ],
    questions: [
      "Comment le domaine d'application a-t-il été délimité ?",
      'Pourquoi certains sites ou services ont-ils été exclus du périmètre ?',
      'Le périmètre a-t-il évolué depuis la dernière certification ?',
    ],
  },
  '4.4': {
    preuves: [
      'Cartographie des processus du SMSI (cohérente avec la cartographie GCS)',
      'Preuves de pilotage du SMSI (réunions, comptes-rendus, indicateurs)',
      'Liste des processus nécessaires au SMSI avec leurs interactions',
    ],
    questions: [
      'Comment les processus nécessaires au SMSI sont-ils identifiés ?',
      'Comment la cohérence entre la cartographie GCS et celle du SMSI est-elle assurée ? (cf. DHA-6)',
      'Qui est responsable de tenir la cartographie à jour ?',
    ],
  },
  '6.1': {
    preuves: [
      "Rapport d'appréciation des risques SSI (méthode, critères, résultats)",
      "Plan de traitement des risques avec suivi d'avancement",
      'DDA avec justification des exclusions A.8.29 et A.8.33 (cf. DHA-10)',
      'Analyse des risques et opportunités généraux',
    ],
    questions: [
      "Quelle méthode d'analyse des risques SSI est utilisée ?",
      'Le plan de traitement des risques est-il à jour — quels risques restent non traités ?',
      'Pourquoi A.8.29 et A.8.33 sont-ils exclus de la DDA ?',
    ],
  },
  '6.2': {
    preuves: [
      'Document des objectifs de sécurité 2025–2026 (SMART, formalisés)',
      'Tableau de bord de suivi des objectifs',
      'Compte-rendu présentant les objectifs à la direction',
    ],
    questions: [
      'Comment les objectifs de sécurité sont-ils définis et mesurés ?',
      "Quels objectifs n'ont pas été atteints l'année passée ?",
      'Comment les objectifs sont-ils communiqués aux équipes ?',
    ],
  },
  '7.3': {
    preuves: [
      'Programme annuel de sensibilisation',
      'Preuves de réalisation : attestations, quiz, registre de présence',
      'Supports de sensibilisation diffusés',
    ],
    questions: [
      'Quel est le taux de couverture de la sensibilisation ?',
      'Comment vérifiez-vous que les messages sont compris ?',
      'Comment la sensibilisation est-elle adaptée aux populations à risque ?',
    ],
  },
  '7.4': {
    preuves: [
      'Plan de communication interne et externe relatif au SMSI',
      'Preuves de communication (emails, intranet)',
      "Procédure de communication en cas d'incident",
    ],
    questions: [
      'Comment les évolutions du SMSI sont-elles communiquées en interne ?',
      'Comment les clients sont-ils informés des changements impactant la sécurité ?',
      'La procédure de communication de crise est-elle documentée et testée ?',
    ],
  },
  '7.5': {
    preuves: [
      'Liste maîtrisée des documents du SMSI',
      'Procédure de gestion documentaire (création, revue, approbation)',
      'Preuves de révision périodique des documents',
    ],
    questions: [
      'Comment les informations documentées sont-elles approuvées avant diffusion ?',
      "Pouvez-vous montrer l'historique de révision d'une procédure clé ?",
      'Comment les documents obsolètes sont-ils retirés ?',
    ],
  },
  '8.1': {
    preuves: [
      'Procédures opérationnelles documentées pour les processus critiques',
      'Contrats et conventions avec les adhérents intégrant les clauses HDS',
      'Preuves de réalisation des activités planifiées',
    ],
    questions: [
      "Comment s'assure-t-on que les processus opérationnels sont réalisés comme planifié ?",
      'Comment les modifications non planifiées des processus sont-elles gérées ?',
      'Les contrats adhérents sont-ils tous conformes aux exigences HDS en vigueur ?',
    ],
  },
  'A.5.1': {
    preuves: [
      "Politique de sécurité de l'information (version, signée, diffusée)",
      "Politiques thématiques (contrôle d'accès, cryptographie, BYOD, cloud)",
      'Preuves de revue périodique',
    ],
    questions: [
      'La politique est-elle accessible à tout le personnel ?',
      'Quand a eu lieu la dernière révision ?',
      'Les politiques thématiques couvrent-elles tous les domaines HDS ?',
    ],
  },
  'A.5.4': {
    preuves: [
      'Note de service ou lettre de mission formalisant les responsabilités',
      'Procédures RH : clauses sécurité dans les contrats, onboarding, offboarding',
      "Preuves d'application des politiques par le personnel",
    ],
    questions: [
      "Comment la direction s'assure-t-elle du respect des politiques ?",
      'Les clauses de sécurité sont-elles présentes dans tous les contrats ?',
      "Que se passe-t-il en cas de non-respect d'une politique ?",
    ],
  },
  'A.5.8': {
    preuves: [
      'Méthodologie de gestion de projet intégrant la sécurité',
      'Exemple de dossier de projet avec section sécurité',
      "Preuves d'implication du RSSI dans les projets",
    ],
    questions: [
      "À quel stade d'un projet la sécurité est-elle formellement intégrée ?",
      'Comment les projets internes (GOUTI) prennent-ils en compte la sécurité ? (cf. DHA-28)',
      'Qui donne le go sécurité avant la mise en production ?',
    ],
  },
  'A.5.9': {
    preuves: [
      'Inventaire des actifs (liste, classification, propriétaire, localisation)',
      "Procédure de mise à jour de l'inventaire",
      'Preuves de revue périodique',
    ],
    questions: [
      "L'inventaire couvre-t-il les actifs cloud et externalisés ?",
      'Comment les nouveaux actifs sont-ils intégrés ?',
      'Qui est propriétaire des actifs de données de santé hébergées ?',
    ],
  },
  'A.5.10': {
    preuves: [
      "Politique d'utilisation acceptable des actifs",
      'Preuves de diffusion et signature par le personnel',
      'Preuves de contrôle du respect',
    ],
    questions: [
      'Comment les règles sont-elles communiquées aux nouveaux arrivants ?',
      'Comment les dérogations sont-elles gérées ?',
      'Les prestataires sont-ils soumis aux mêmes règles ?',
    ],
  },
  'A.5.11': {
    preuves: [
      "Procédure d'offboarding incluant la restitution des actifs",
      'Registre ou checklist de restitution',
      "Preuves d'application sur des départs récents",
    ],
    questions: [
      "Pouvez-vous montrer un exemple récent de restitution d'actifs ?",
      "Comment s'assure-t-on qu'aucun actif n'est emporté à la sortie ?",
      'La procédure couvre-t-elle prestataires et intérimaires ?',
    ],
  },
  'A.5.12': {
    preuves: [
      'Politique ou guide de classification (niveaux, critères)',
      'Exemples de documents classifiés',
      "Preuves d'application pratique",
    ],
    questions: [
      'Combien de niveaux de classification sont définis ?',
      'Comment la classification est-elle appliquée aux données de santé ?',
      "Comment s'assure-t-on de la cohérence entre équipes ?",
    ],
  },
  'A.5.13': {
    preuves: [
      'Procédure de marquage des informations',
      'Exemples de documents marqués',
      'Outils de marquage automatique',
    ],
    questions: [
      'Comment le marquage est-il appliqué aux documents électroniques ?',
      'Un outil automatise-t-il le marquage des échanges avec les clients ?',
      'Comment les informations sans marquage sont-elles traitées ?',
    ],
  },
  'A.5.15': {
    preuves: [
      "Politique de contrôle d'accès documentée",
      "Matrice des droits d'accès par rôle",
      'Procédure de gestion des accès',
    ],
    questions: [
      'La politique est-elle appliquée de manière cohérente entre systèmes ?',
      'Comment les accès des prestataires et clients HDS sont-ils gérés ?',
      "Comment les accès d'urgence (break-glass) sont-ils contrôlés ?",
    ],
  },
  'A.5.16': {
    preuves: [
      "Référentiel d'identités à jour (AD, LDAP, IAM)",
      'Procédure de création et désactivation',
      'Preuves de désactivation rapide en cas de départ',
    ],
    questions: [
      'Combien de comptes orphelins ou inactifs lors de la dernière revue ?',
      "Quel est le délai moyen de désactivation lors d'un départ ?",
      'Comment les comptes de service et partagés sont-ils gérés ?',
    ],
  },
  'A.5.17': {
    preuves: [
      "Politique de mots de passe et preuves d'application",
      'Déploiement du MFA sur les accès sensibles',
      'Procédure de gestion des secrets (coffre-fort)',
    ],
    questions: [
      'Le MFA est-il déployé sur tous les accès à risque ?',
      'Comment les mots de passe par défaut sont-ils changés ?',
      'Existe-t-il un gestionnaire de secrets pour les comptes de service ?',
    ],
  },
  'A.5.18': {
    preuves: [
      "Procédure formelle de revue des droits d'accès",
      'Preuves de revues réalisées pour SALESFORCE et ENRS (cf. DHA-19)',
      'Tickets ou rapports de révocation suite aux revues',
      'Preuves de revue des droits privilégiés',
    ],
    questions: [
      "Comment les revues sont-elles planifiées et tracées — au-delà d'un seul ticket TENACY ?",
      'Les revues SALESFORCE et ENRS sont-elles tracées depuis DHA-19 ?',
      'Que se passe-t-il quand un excès de droits est détecté ?',
    ],
  },
  'A.5.19': {
    preuves: [
      'Procédure de gestion des risques fournisseurs',
      'Registre des fournisseurs avec évaluation sécurité',
      'Preuves de revue annuelle des fournisseurs critiques (AZN, Maincare)',
    ],
    questions: [
      "Comment les risques d'AZN et Maincare sont-ils évalués et suivis ?",
      'Existe-t-il un processus de qualification sécurité avant choix ?',
      'Comment les incidents chez les fournisseurs sont-ils remontés ?',
    ],
  },
  'A.5.20': {
    preuves: [
      "Contrat avec AZN — clauses sécurité, SLA, droit d'audit",
      'Contrat avec Maincare — gestion des vulnérabilités, notification incidents',
      'Preuves de révision lors de changements majeurs',
    ],
    questions: [
      "Les contrats incluent-ils des clauses de notification d'incident ?",
      "Le droit d'audit sur les fournisseurs est-il formalisé et exercé ?",
      'Les contrats ont-ils été mis à jour pour HDS V2 2024 ?',
    ],
  },
  'A.5.24': {
    preuves: [
      'Procédure de gestion des incidents de sécurité',
      'Plan de réponse aux incidents avec rôles',
      'Preuves de formation des équipes',
    ],
    questions: [
      'La procédure est-elle connue et maîtrisée par les équipes ?',
      'Comment les incidents HDS sont-ils traités spécifiquement ?',
      'Quel est le processus de notification aux autorités (ANSSI, CNIL, ANS) ?',
    ],
  },
  'A.5.25': {
    preuves: [
      'Critères formels de qualification des événements',
      "Exemples d'événements qualifiés ou non",
      'Tableau de bord de qualification',
    ],
    questions: [
      'Quels critères permettent de qualifier un événement en incident ?',
      'Quel est le délai moyen de qualification ?',
      'Comment les faux positifs sont-ils gérés ?',
    ],
  },
  'A.5.26': {
    preuves: [
      'Procédure de réponse aux incidents (containment, recovery)',
      'Preuves de mise en œuvre sur incidents récents',
      'Preuves de tests ou exercices (tabletop)',
    ],
    questions: [
      "Pouvez-vous décrire le traitement d'un incident récent significatif ?",
      'Des exercices de simulation sont-ils réalisés ?',
      'Comment la continuité des soins des clients est-elle préservée ?',
    ],
  },
  'A.5.27': {
    preuves: [
      'Rapport REX/RETEX sur les incidents clos',
      "Preuves d'actions correctives suite aux REX",
      'Intégration dans politiques et procédures',
    ],
    questions: [
      "Les incidents font-ils l'objet d'un REX systématique ?",
      'Pouvez-vous montrer un cas où un incident a modifié un processus ?',
      'Comment les enseignements sont-ils partagés ?',
    ],
  },
  'A.5.28': {
    preuves: [
      'Procédure de collecte et conservation des preuves numériques',
      'Preuves de chaîne de traçabilité sur un incident récent',
      'Outils forensiques disponibles',
    ],
    questions: [
      'Comment les preuves sont-elles collectées de façon à préserver leur intégrité légale ?',
      "Existe-t-il une procédure de préservation des logs lors d'un incident ?",
      'Les preuves ont-elles déjà été utilisées légalement ?',
    ],
  },
  'A.5.29': {
    preuves: [
      "PCA incluant la sécurité de l'information",
      'BIA avec scénario sinistre datacenter AZN (cf. DHA-31)',
      'Procédures de fonctionnement en mode dégradé sécurisé',
    ],
    questions: [
      'Le PCA inclut-il un scénario de sinistre AZN ? Pourquoi manquait-il ? (cf. DHA-31)',
      'Comment la sécurité des données est-elle maintenue pendant le PCA ?',
      'Les procédures ont-elles été testées avec les équipes sécurité ?',
    ],
  },
  'A.5.30': {
    preuves: [
      'PRA incluant les TIC — RTO/RPO documentés',
      'Politique de test PCA/PRA révisée et réaliste',
      'Comptes-rendus des tests PRA AZN',
    ],
    questions: [
      'La politique de test a-t-elle été révisée depuis DHA-32 ?',
      'Quand le PRA AZN sera-t-il testé ?',
      'Les RTO/RPO sont-ils cohérents avec les exigences clients ?',
    ],
  },
  'A.5.31': {
    preuves: [
      'Registre des exigences légales et réglementaires applicables',
      'Processus de veille réglementaire documenté',
      'Matrice de conformité',
    ],
    questions: [
      'Comment la veille est-elle organisée — qui est responsable ?',
      'Comment les exigences HDS V2 2024 ont-elles été intégrées ?',
      "Comment s'assure-t-on que les contrats respectent toutes les exigences ?",
    ],
  },
  'A.5.32': {
    preuves: [
      'Registre des licences logicielles',
      "Procédure d'utilisation des droits de propriété intellectuelle",
      'Preuves de contrôle de conformité (audit logiciel)',
    ],
    questions: [
      'Comment la conformité des licences est-elle contrôlée ?',
      "Existe-t-il un processus pour gérer l'open source ?",
      'Comment les droits de propriété des clients sur leurs données sont-ils protégés ?',
    ],
  },
  'A.5.33': {
    preuves: [
      'Politique de conservation et archivage des enregistrements',
      'Registre de traitement RGPD à jour (cf. DHA-57 : GLPI, SIEM)',
      'Preuves de destruction sécurisée',
    ],
    questions: [
      'Le registre a-t-il été mis à jour pour GLPI et le SIEM depuis DHA-57 ?',
      'Comment les enregistrements sont-ils protégés contre la modification ?',
      'Comment la fin de vie est-elle gérée de façon sécurisée ?',
    ],
  },
  'A.5.34': {
    preuves: [
      'Registre des traitements RGPD complet et à jour',
      'Rapport DPO',
      'Preuves de réponse aux demandes de droits',
      'Procédure de gestion des violations de données',
    ],
    questions: [
      'Le registre est-il complet pour GLPI et le SIEM ?',
      "Comment les demandes d'accès, rectification, effacement sont-elles traitées ?",
      'La procédure de notification CNIL est-elle documentée ?',
    ],
  },
  'A.5.35': {
    preuves: [
      "Programme d'audit interne SMSI",
      'Rapport du dernier audit interne avec constats',
      "Preuves d'indépendance des auditeurs",
      'Preuves de suivi des actions',
    ],
    questions: [
      "Quel est le programme d'audit pour 2025–2026 — tous les processus sont-ils couverts ?",
      "Comment l'indépendance des auditeurs est-elle garantie ?",
      'Les résultats sont-ils présentés en revue de direction ?',
    ],
  },
  'A.5.36': {
    preuves: ['Résultats des contrôles de conformité', 'Surveillance des indicateurs', "Plan d'actions correctives"],
    questions: [
      'Comment la conformité aux politiques est-elle vérifiée au quotidien ?',
      'Les contrôles couvrent-ils les prestataires (Maincare, AZN) ?',
      'Comment les non-conformités sont-elles escaladées ?',
    ],
  },
  'A.5.37': {
    preuves: [
      "Liste des procédures d'exploitation documentées",
      'Procédure de gestion des changements',
      "DAT de l'ENRS — état d'avancement (cf. DHA-35)",
    ],
    questions: [
      "Toutes les opérations critiques disposent-elles d'une procédure ?",
      'Où en est la finalisation du DAT ENRS ?',
      "Comment s'assure-t-on que les procédures sont appliquées par Maincare ?",
    ],
  },
  'A.6.8': {
    preuves: [
      'Canal de déclaration des événements (email, portail, GLPI)',
      'Preuves de déclarations reçues et traitées',
      "Indicateur : nb d'événements déclarés vs détectés automatiquement",
    ],
    questions: [
      'Comment le personnel est-il informé du canal de déclaration ?',
      'Des campagnes de phishing simulé sont-elles réalisées ?',
      'Que se passe-t-il pour un collaborateur qui ne déclare pas un événement ?',
    ],
  },
  'A.8.1': {
    preuves: [
      'Politique de sécurité des terminaux (MDM, chiffrement, antivirus)',
      'Inventaire des terminaux gérés',
      'Preuves de déploiement de la politique',
    ],
    questions: [
      'Tous les postes sont-ils chiffrés ?',
      'Comment les terminaux personnels (BYOD) sont-ils traités ?',
      'Comment les terminaux perdus sont-ils pris en charge ?',
    ],
  },
  'A.8.2': {
    preuves: [
      'Liste des comptes à privilèges et justification',
      'Procédure de gestion (PAM, enregistrement de sessions)',
      'Preuves de tracabilité des actions',
    ],
    questions: [
      'Comment les comptes admin sont-ils protégés (MFA, PAM, session recording) ?',
      'Les actions admin sont-elles toutes tracées et auditées ?',
      'Comment les droits temporaires sont-ils gérés et révoqués ?',
    ],
  },
  'A.8.3': {
    preuves: [
      "Matrice des droits d'accès appliquée",
      'Preuves de cloisonnement entre clients hébergés',
      "Logs d'accès aux ressources sensibles",
    ],
    questions: [
      "Comment le moindre privilège est-il appliqué sur l'ENRS ?",
      'Les données des clients sont-elles bien cloisonnées entre elles ?',
      'Comment les accès aux données de santé sont-ils restreints ?',
    ],
  },
  'A.8.4': {
    preuves: [
      "Politique de gestion de l'accès au code source",
      'Liste des développeurs avec droits',
      'Preuves de revue des accès',
    ],
    questions: [
      'Qui a accès au code source — le GCS développe-t-il en interne ?',
      'Comment les accès des prestataires de développement sont-ils contrôlés ?',
      'Les dépôts sont-ils protégés contre les modifications non autorisées ?',
    ],
  },
  'A.8.5': {
    preuves: [
      'Déploiement MFA sur les accès sensibles',
      "Politique d'authentification par niveau",
      "Preuves de désactivation de l'authentification simple",
    ],
    questions: [
      'Le MFA est-il obligatoire sur tous les accès distants et admin ?',
      'Comment les sessions sont-elles fermées après inactivité ?',
      'Les protocoles faibles (NTLM, Telnet) ont-ils été désactivés ?',
    ],
  },
  'A.8.6': {
    preuves: [
      'Rapports de capacité (stockage, CPU, bande passante)',
      'Alertes de seuil dans le monitoring',
      'Plan de capacité à 12 mois',
    ],
    questions: [
      'Comment la capacité ENRS est-elle surveillée et anticipée ?',
      'Des dépassements ont-ils causé des incidents récents ?',
      'Le plan est-il revu en fonction des nouveaux clients hébergés ?',
    ],
  },
  'A.8.7': {
    preuves: [
      'Solution antimalware déployée et à jour',
      'Procédure de gestion des infections malware',
      "Preuves d'incidents traités",
    ],
    questions: [
      'Quelle solution est déployée — couvre-t-elle 100% des endpoints et serveurs ?',
      'Comment les mises à jour des signatures sont-elles assurées ?',
      'Les équipes sont-elles formées au phishing ?',
    ],
  },
  'A.8.8': {
    preuves: [
      'Outil de scan de vulnérabilités et calendrier',
      'Plan de remédiation des 18 vulnérabilités MAINCARE (cf. DHA-30)',
      'Rapport pentest EXCUBE 07/05/2025',
      'Procédure de gestion des vulnérabilités (délais par criticité)',
    ],
    questions: [
      'Où en est la remédiation des 18 vulnérabilités critiques EXCUBE ?',
      'Ces vulnérabilités ont-elles été communiquées à MAINCARE ?',
      'Quel est le délai cible de correction par criticité ?',
    ],
  },
  'A.8.9': {
    preuves: [
      'Baseline de configuration sécurisée (hardening)',
      'Outil de gestion de configuration (CMDB, Ansible)',
      'Preuves de contrôle de conformité',
    ],
    questions: [
      'Existe-t-il des guides de configuration sécurisée ?',
      'Comment les dérives sont-elles détectées et corrigées ?',
      'La CMDB est-elle à jour et complète ?',
    ],
  },
  'A.8.10': {
    preuves: [
      'Procédure de suppression sécurisée',
      'Preuves de mise en œuvre (certificats de destruction)',
      'Politique de gestion des données temporaires',
    ],
    questions: [
      "Comment les données d'un client sont-elles supprimées en fin de contrat ?",
      'Les disques des équipements réformés sont-ils effacés ou détruits ?',
      'Les données temporaires sont-elles traitées comme données sensibles ?',
    ],
  },
  'A.8.11': {
    preuves: [
      'Procédure de masquage des données',
      "Preuves d'application (tests, recettes)",
      'Liste des traitements utilisant données masquées',
    ],
    questions: [
      'Comment le masquage est-il appliqué dans les tests et recettes ?',
      'Des données de santé réelles sont-elles utilisées en tests ?',
      'Le masquage est-il irréversible et conforme HDS/RGPD ?',
    ],
  },
  'A.8.12': {
    preuves: [
      'Solution DLP déployée (email, endpoint, réseau)',
      "Rapports d'incidents DLP",
      'Politique de classification couplée au DLP',
    ],
    questions: [
      'Quelle solution DLP est en place — couverture ?',
      'Comment les alertes sont-elles traitées et escaladées ?',
      'Les transferts de données de santé non autorisés sont-ils bloqués ?',
    ],
  },
  'A.8.13': {
    preuves: [
      'Politique de sauvegarde',
      'Rapports de sauvegardes (succès / échecs)',
      'Preuves de tests de restauration',
    ],
    questions: [
      'Quelle fréquence de tests de restauration ?',
      'Les sauvegardes sont-elles offsite — quelles protections ?',
      'Toutes les données de santé sont-elles sauvegardées ?',
    ],
  },
  'A.8.14': {
    preuves: [
      'Architecture HA documentée (clustering, load balancing)',
      'SLA de disponibilité contractualisés',
      'Preuves de tests de basculement',
    ],
    questions: [
      "L'infrastructure ENRS est-elle redondée ?",
      'Les tests de failover sont-ils réguliers ?',
      'Comment la disponibilité contractualisée est-elle mesurée ?',
    ],
  },
  'A.8.15': {
    preuves: [
      'Architecture de journalisation centralisée (SIEM)',
      'Politique de rétention des logs',
      "Preuves d'analyse et alertes",
    ],
    questions: [
      'Tous les systèmes du périmètre HDS envoient-ils leurs logs au SIEM ?',
      "Comment les logs sont-ils protégés contre l'altération ?",
      'Quelle est la rétention — conforme HDS et RGPD ?',
    ],
  },
  'A.8.16': {
    preuves: [
      'Tableau de bord de surveillance opérationnelle',
      'Règles de corrélation et alertes SIEM',
      'Preuves de réponse aux alertes',
    ],
    questions: [
      'Comment le SOC surveille-t-il le périmètre HDS ?',
      "Quel est le délai moyen de prise en charge d'une alerte ?",
      'Les comportements anormaux des utilisateurs (UEBA) sont-ils surveillés ?',
    ],
  },
  'A.8.17': {
    preuves: [
      "Configuration NTP sur l'ensemble des équipements",
      'Preuves de synchronisation',
      'Tolérance de dérive et alertes',
    ],
    questions: [
      'Tous les équipements sont-ils synchronisés sur la même source NTP ?',
      'La tolérance répond-elle aux exigences de non-répudiation ?',
      'Comment les désynchronisations sont-elles détectées ?',
    ],
  },
  'A.8.18': {
    preuves: [
      "Liste des outils d'administration sur les systèmes",
      "Procédure de contrôle d'usage",
      'Preuves de revue périodique',
    ],
    questions: [
      "Les outils d'administration sont-ils contrôlés et inventoriés ?",
      "Comment l'utilisation est-elle tracée ?",
      'Les outils inutilisés sont-ils désinstallés ?',
    ],
  },
  'A.8.19': {
    preuves: [
      "Procédure d'installation en production",
      "Preuves d'approbation (tickets de changement)",
      'Liste blanche des logiciels autorisés',
    ],
    questions: [
      'Comment une installation en production est-elle autorisée et tracée ?',
      'Existe-t-il une liste blanche maintenue ?',
      'Comment les installations non autorisées sont-elles détectées ?',
    ],
  },
  'A.8.20': {
    preuves: ['Schéma réseau à jour', 'Politique de filtrage (pare-feu)', 'Preuves de revue périodique des règles'],
    questions: [
      'Le schéma réseau est-il documenté et à jour ?',
      'Comment les règles de pare-feu sont-elles purgées ?',
      "Le réseau de production HDS est-il cloisonné de l'admin ?",
    ],
  },
  'A.8.21': {
    preuves: [
      'Contrats de services réseau avec clauses sécurité',
      'Supervision des services réseau',
      'Preuves de revue de sécurité',
    ],
    questions: [
      'Les FAI/opérateurs ont-ils des clauses sécurité dans leurs contrats ?',
      'Comment la sécurité des accès distants (VPN) est-elle maintenue ?',
      'Les accès internet sortants sont-ils filtrés ?',
    ],
  },
  'A.8.22': {
    preuves: [
      'Architecture de cloisonnement (VLAN, DMZ, zones)',
      "Preuves d'isolation des environnements HDS",
      'Politique de segmentation',
    ],
    questions: [
      'Comment le réseau est-il segmenté — zones HDS, admin, utilisateurs ?',
      'Les pentests couvrent-ils les mouvements latéraux ?',
      'Comment les accès inter-zones sont-ils contrôlés ?',
    ],
  },
  'A.8.23': {
    preuves: [
      'Solution de filtrage web déployée',
      "Politique de catégories d'URL bloquées",
      "Preuves d'incidents bloqués",
    ],
    questions: [
      'Le filtrage couvre-t-il les postes nomades ?',
      'Comment les dérogations sont-elles gérées ?',
      'Le filtrage DNS est-il utilisé en complément ?',
    ],
  },
  'A.8.25': {
    preuves: ['Procédure SSDLC documentée', "Preuves d'application dans projets récents", 'Formation des développeurs'],
    questions: [
      'Un SSDLC est-il formalisé et appliqué ?',
      'Comment la sécurité est-elle intégrée dès la conception ?',
      'Les développeurs sont-ils formés (OWASP) ?',
    ],
  },
  'A.8.26': {
    preuves: [
      "Dossier d'exigences sécurité pour un projet récent",
      'Checklist exigences applicatives',
      "Preuves d'évaluation sécurité avant choix",
    ],
    questions: [
      "Comment les exigences sont-elles définies lors d'une acquisition ?",
      "Une analyse sécurité est-elle réalisée avant choix d'un progiciel ?",
      "Les exigences HDS sont-elles intégrées dans les appels d'offres ?",
    ],
  },
  'A.8.27': {
    preuves: [
      "Documentation des principes d'architecture sécurisée",
      'DAT ENRS (cf. DHA-35)',
      "Preuves d'application dans les projets infra",
    ],
    questions: [
      "Quels principes sont appliqués sur l'ENRS ?",
      'Le DAT intègre-t-il les principes de sécurité ?',
      'Comment ces principes sont-ils vérifiés en recette ?',
    ],
  },
  'A.8.28': {
    preuves: [
      'Guide de codage sécurisé adopté (OWASP)',
      'Preuves de revues de code sécurité',
      "Résultats d'analyses SAST",
    ],
    questions: [
      'Des outils SAST sont-ils utilisés en CI ?',
      'Comment les vulnérabilités détectées sont-elles traitées ?',
      'Le GCS développe-t-il en interne — dans quels projets ?',
    ],
  },
  'A.8.29': {
    preuves: [
      'Rapport de test de sécurité (DAST, pentest)',
      'Preuves de recette sécurité (cf. DHA-27)',
      'Plan de remédiation des vulnérabilités',
    ],
    questions: [
      'Des tests sont-ils systématiques avant mise en production ?',
      'Pouvez-vous montrer les preuves de recette consolidées ? (cf. DHA-27)',
      'Comment les résultats des pentests sont-ils intégrés ?',
    ],
  },
  'A.8.30': {
    preuves: [
      'Contrats de développement externalisé avec clauses sécurité (Maincare)',
      'Procédure de supervision',
      'Preuves de revue sécurité des livrables tiers',
    ],
    questions: [
      'Comment le GCS supervise-t-il la qualité sécurité Maincare ?',
      'Existe-t-il une recette sécurité sur les livrables externalisés ?',
      'Les sous-traitants sont-ils soumis aux mêmes exigences ?',
    ],
  },
  'A.8.31': {
    preuves: [
      'Architecture documentée des environnements (dev, test, prod)',
      'Procédure de transfert vers la production',
      'Preuves de non-utilisation de données réelles en test',
    ],
    questions: [
      'Les environnements sont-ils bien séparés ?',
      'Comment les déploiements en production sont-ils tracés ?',
      'Des données réelles sont-elles utilisées en test ?',
    ],
  },
  'A.8.32': {
    preuves: [
      'Procédure de gestion des changements',
      'CAB — comptes-rendus',
      "Preuves de changements d'urgence régularisés",
    ],
    questions: [
      'Comment un changement est-il approuvé avant mise en production ?',
      'Les hotfix sont-ils tracés et régularisés a posteriori ?',
      'Comment le rollback est-il préparé ?',
    ],
  },
  'A.8.33': {
    preuves: [
      'Procédure de gestion des données de test',
      "Preuves d'absence de données de production en test",
      'Registre des jeux de données de test',
    ],
    questions: [
      'Comment les données de test sont-elles générées — anonymisées ou synthétiques ?',
      "Pouvez-vous prouver l'absence de données réelles en test ? (cf. DHA-10)",
      'Comment les données de test sont-elles détruites ?',
    ],
  },
  'A.5.2': {
    preuves: [
      'Fiches de fonction ou lettres de mission SSI (RSSI, référents)',
      'Matrice RACI des processus du SMSI',
      'Nominations formalisées (DPO, référent HDS)',
    ],
    questions: [
      'Comment les responsabilités SSI sont-elles attribuées et communiquées ?',
      'Qui assure la suppléance du RSSI ?',
    ],
  },
  'A.5.3': {
    preuves: [
      'Liste des tâches incompatibles identifiées (administration et contrôle, demande et validation)',
      'Preuves de double validation (droits, changements, paiements)',
      "Mesures compensatoires lorsque l'effectif ne permet pas la séparation",
    ],
    questions: [
      'Quelles tâches incompatibles avez-vous identifiées ?',
      'Comment gérez-vous la séparation des tâches avec une petite équipe ?',
    ],
  },
  'A.5.5': {
    preuves: [
      'Liste des autorités et points de contact (CERT Santé, ANSSI, CNIL, ARS, ANS)',
      'Procédure de signalement et de notification avec délais',
      "Traces de signalements ou d'échanges récents",
    ],
    questions: ["Qui contacte les autorités en cas d'incident, et dans quels délais ?"],
  },
  'A.5.6': {
    preuves: [
      "Adhésions à des groupes d'intérêt (club RSSI santé, CLUSIF, réseau des GRADeS)",
      'Comptes rendus de participation',
      'Abonnements aux bulletins de sécurité',
    ],
    questions: ['Comment ces échanges alimentent-ils le SMSI ?'],
  },
  'A.5.7': {
    preuves: [
      'Sources de renseignement sur les menaces (CERT-FR, CERT Santé, éditeurs)',
      "Processus d'analyse et de diffusion",
      "Exemples d'actions déclenchées (correctif, règle de détection)",
    ],
    questions: [
      "Montrez une alerte récente et l'action qui en a découlé.",
      "Comment le renseignement alimente-t-il l'appréciation des risques ?",
    ],
  },
  'A.5.14': {
    preuves: [
      'Règles de transfert des informations selon la classification',
      "Outils autorisés (messagerie sécurisée de santé, plateforme d'échange chiffrée)",
      'Accords de transfert avec les tiers',
    ],
    questions: [
      'Comment un document confidentiel est-il transmis à un adhérent ?',
      'Quels moyens de transfert sont interdits ?',
    ],
  },
  'A.5.21': {
    preuves: [
      'Exigences SSI intégrées aux marchés (CCTP, clauses sécurité)',
      'Liste des sous-traitants des prestataires critiques',
      'Certificats HDS et ISO 27001 des fournisseurs',
    ],
    questions: [
      'Comment maîtrisez-vous les sous-traitants de vos prestataires ?',
      'Comment vérifiez-vous la validité des certificats fournisseurs ?',
    ],
  },
  'A.5.22': {
    preuves: [
      'Comptes rendus des comités de pilotage et revues de service',
      'Indicateurs de niveau de service',
      'Évaluation annuelle des fournisseurs',
    ],
    questions: [
      "Quand a eu lieu la dernière revue de service avec l'hébergeur ?",
      "Comment les changements de service d'un fournisseur sont-ils évalués ?",
    ],
  },
  'A.5.23': {
    preuves: [
      "Politique d'usage des services en nuage",
      'Inventaire des services en nuage utilisés',
      'Configuration de sécurité (durcissement du tenant, MFA)',
      'Clauses de réversibilité et de sortie',
    ],
    questions: ["Qui valide l'adoption d'un nouveau service en nuage ?", 'Comment la réversibilité est-elle prévue ?'],
  },
  'A.6.1': {
    preuves: [
      'Procédure de recrutement avec vérifications proportionnées au poste',
      "Dossier d'un recrutement récent (vérifications réalisées)",
    ],
    questions: ['Quelles vérifications pour un poste à privilèges ?'],
  },
  'A.6.2': {
    preuves: [
      'Clauses de confidentialité et de sécurité du contrat de travail',
      'Charte informatique signée, annexée au règlement intérieur',
    ],
    questions: ["La charte est-elle signée avant l'ouverture des accès ?"],
  },
  'A.6.3': {
    preuves: [
      'Plan annuel de sensibilisation et supports',
      'Taux de participation par population',
      "Résultats des campagnes d'hameçonnage simulé",
      'Formations spécifiques (administrateurs, développeurs)',
    ],
    questions: ['Quel est le taux de couverture ?', "Comment mesurez-vous l'efficacité de la sensibilisation ?"],
  },
  'A.6.4': {
    preuves: [
      'Règlement intérieur ou charte mentionnant les sanctions',
      'Procédure disciplinaire applicable aux manquements SSI',
    ],
    questions: ['Comment un manquement à la charte serait-il traité ?'],
  },
  'A.6.5': {
    preuves: [
      'Procédure de départ et de mobilité (checklist RH et DSI)',
      'Rappel des obligations de confidentialité après le départ',
      "Preuve de désactivation des comptes d'un départ récent",
    ],
    questions: [
      'Quel délai entre le départ et la désactivation des accès ?',
      "Comment les droits sont-ils revus lors d'une mobilité interne ?",
    ],
  },
  'A.6.6': {
    preuves: [
      "Modèles d'engagement de confidentialité (prestataires, stagiaires, intérimaires)",
      'Registre des engagements signés',
      'Date de dernière revue des modèles',
    ],
    questions: ['Les prestataires intervenant sur site signent-ils un engagement ?'],
  },
  'A.6.7': {
    preuves: [
      'Politique de télétravail',
      'Moyens techniques (VPN, MFA, poste maîtrisé)',
      'Charte ou avenant de télétravail signé',
    ],
    questions: ['Comment le poste de télétravail est-il sécurisé ?', 'Les équipements personnels sont-ils autorisés ?'],
  },
  'A.7.1': {
    preuves: ['Plan des locaux avec zones de sécurité', 'Liste des zones sensibles (local technique, archives)'],
    questions: ['Quelles zones avez-vous définies, et selon quels critères ?'],
  },
  'A.7.2': {
    preuves: [
      "Système de contrôle d'accès par badge et gestion des badges",
      'Registre des visiteurs',
      "Dernière revue des droits d'accès physiques",
    ],
    questions: ['Comment un visiteur est-il accueilli et accompagné ?', 'Qui revoit les droits des badges ?'],
  },
  'A.7.3': {
    preuves: ['Règles de fermeture des bureaux et salles', 'Sécurisation du local technique et des armoires'],
    questions: ['Qui a accès au local technique ?'],
  },
  'A.7.4': {
    preuves: ['Vidéoprotection et alarme intrusion', 'Contrat de télésurveillance', 'Journal des alarmes'],
    questions: ['Qui reçoit les alertes hors heures ouvrées ?'],
  },
  'A.7.5': {
    preuves: [
      'Analyse des risques physiques et environnementaux',
      'Détection incendie et climatisation du local technique',
      'Rapports de vérification périodique',
    ],
    questions: ['Quand ont eu lieu les derniers contrôles incendie et climatisation ?'],
  },
  'A.7.6': {
    preuves: [
      'Règles de travail en zone sécurisée (accompagnement, photos interdites)',
      'Registre des accès au local technique',
    ],
    questions: ['Un prestataire peut-il intervenir seul en zone sécurisée ?'],
  },
  'A.7.7': {
    preuves: [
      "Politique du bureau propre et de l'écran vide",
      'Verrouillage automatique des sessions (stratégie de groupe)',
      'Impression sécurisée',
      'Contrôles ou rondes réalisés',
    ],
    questions: ["Quelles actions depuis le constat sur les documents laissés à l'imprimante ?"],
  },
  'A.7.8': {
    preuves: ['Implantation et protection des équipements (baies fermées, écrans orientés)'],
    questions: ['Comment les équipements sensibles sont-ils protégés des accès non autorisés ?'],
  },
  'A.7.9': {
    preuves: [
      'Règles pour les équipements nomades (chiffrement, verrouillage)',
      'Inventaire des équipements nomades',
      'Procédure en cas de perte ou de vol',
    ],
    questions: ['Que se passe-t-il si un portable est perdu ?'],
  },
  'A.7.10': {
    preuves: [
      'Politique des supports amovibles',
      'Preuve du blocage ou du contrôle USB',
      'Procédure de destruction des supports',
    ],
    questions: ["Comment l'usage des clés USB est-il contrôlé ?"],
  },
  'A.7.11': {
    preuves: [
      'Onduleurs, alimentation de secours et redondance réseau',
      'Contrats de maintenance',
      'Comptes rendus de tests',
    ],
    questions: ["Quand l'onduleur a-t-il été testé ? Quelle autonomie ?"],
  },
  'A.7.12': {
    preuves: ['Plan de câblage', 'Protection des câbles et baies fermées'],
    questions: ["Comment le câblage est-il protégé contre l'interception ou les dommages ?"],
  },
  'A.7.13': {
    preuves: [
      'Contrats et planning de maintenance',
      'Traces des interventions',
      'Encadrement des prestataires de maintenance',
    ],
    questions: ['Comment une intervention de maintenance est-elle tracée ?'],
  },
  'A.7.14': {
    preuves: ["Procédure d'effacement sécurisé", 'Certificats de destruction', 'Prestataire de recyclage agréé'],
    questions: ['Montrez un certificat de destruction récent.'],
  },
  'A.8.24': {
    preuves: [
      'Politique de chiffrement (algorithmes, longueurs de clés)',
      'Inventaire des certificats et suivi des expirations',
      'Chiffrement au repos et en transit (TLS, chiffrement des disques)',
    ],
    questions: ["Comment suivez-vous l'expiration des certificats ?", 'Qui détient et protège les clés ?'],
  },
  'A.8.34': {
    preuves: [
      "Procédure d'encadrement des audits techniques et tests d'intrusion",
      'Autorisations, périmètre et créneaux validés',
      "Convention de test d'intrusion",
    ],
    questions: ["Comment un test d'intrusion est-il autorisé et encadré ?"],
  },
  '6.3': {
    preuves: [
      'Procédure de planification des modifications du SMSI',
      "Exemples de modifications planifiées et analyse d'impact",
    ],
    questions: ['Comment une modification du SMSI est-elle planifiée ?'],
  },
  '7.1': {
    preuves: ['Budget et effectifs dédiés à la SSI', 'Arbitrages de ressources en revue de direction'],
    questions: ["Les ressources sont-elles suffisantes pour le plan d'actions ?"],
  },
  '7.2': {
    preuves: ['Fiches de poste et matrice de compétences', 'Plan de formation et attestations'],
    questions: ['Comment évaluez-vous les compétences des acteurs du SMSI ?'],
  },
  '8.2': {
    preuves: ['Dernière appréciation des risques datée', 'Déclencheurs de réévaluation'],
    questions: ["Quand l'appréciation des risques a-t-elle été mise à jour ?"],
  },
  '8.3': {
    preuves: [
      'Plan de traitement des risques et avancement',
      'Acceptation des risques résiduels par les propriétaires',
    ],
    questions: ['Qui accepte formellement les risques résiduels ?'],
  },
};

/** Aide d'une exigence (`guideFor`) : mesure de l'Annexe A, ou clause ISO en remontant à sa clause parente. */
export function guideDe(ex: { ref: string; num: string }): GuideAudit | null {
  if (ex.ref === 'A') return GUIDE_AUDIT['A.' + ex.num] ?? null;
  if (ex.ref === 'ISO') {
    let n = ex.num;
    while (n) {
      if (GUIDE_AUDIT[n]) return GUIDE_AUDIT[n]!;
      const k = n.lastIndexOf('.');
      if (k < 0) break;
      n = n.slice(0, k);
    }
  }
  return null;
}

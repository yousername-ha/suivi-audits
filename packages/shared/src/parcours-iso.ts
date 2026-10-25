/* Parcours guidé ISO/IEC 27001 / HDS (dossier 024, référence de conception v011) : catalogue des étapes, des sous-actions, des
   raccourcis de l'arbre et des sources. C'est le contenu d'une vue de navigation, pas un registre métier : chaque sous-action
   renvoie à un module existant (rubrique du Pilotage ou page) et aux types d'objets que ce module tient déjà. Les identifiants
   sont stables ; aucun état de progression ni de conformité n'est porté ici. Les regroupements et l'ordre sont des aides de
   travail proposées, pas une séquence normative : ISO/IEC 27001 n'impose ni cet ordre ni EBIOS RM, et une étape parcourue, une
   preuve attachée ou une action close n'établit ni revue, ni conformité, ni certification. */
import { z } from 'zod';
import type { GrcKind } from './grc.js';
import type { Module } from './permissions.js';

export const BRANCHES_PARCOURS = ['cadrer', 'maitriser', 'evaluer', 'hds'] as const;
export type BrancheParcours = (typeof BRANCHES_PARCOURS)[number];
export const BRANCHE_LABELS: Record<BrancheParcours, { nom: string; sousTitre: string }> = {
  cadrer: { nom: 'Cadrer', sousTitre: 'Poser les fondations de votre démarche' },
  maitriser: { nom: 'Maîtriser', sousTitre: 'Piloter et traiter vos risques' },
  evaluer: { nom: 'Évaluer et améliorer', sousTitre: 'Mesurer la performance et progresser' },
  hds: { nom: 'Compléments HDS', sousTitre: 'Spécificités relatives à l’hébergement des données de santé' },
};

/** Sources officielles consultées pour les repères (le texte intégral des normes n'est ni reproduit ni distribué). */
export interface SourceParcours {
  id: string;
  libelle: string;
  url: string;
  /** Utilisation et limite de la source. */
  limite: string;
}
export const SOURCES_PARCOURS: readonly SourceParcours[] = [
  {
    id: 'ISO-01',
    libelle: 'ISO/IEC 27001:2022',
    url: 'https://www.iso.org/standard/27001',
    limite:
      'Cadre du SMSI et référence des clauses. Les exigences des clauses 4 à 10 ne sont pas rendues facultatives ; pas d’accès revendiqué au texte intégral sous licence.',
  },
  {
    id: 'ISO-AMD',
    libelle: 'ISO/IEC 27001:2022/Amd 1:2024',
    url: 'https://www.iso.org/standard/88435.html',
    limite:
      'Examen des enjeux climatiques dans le contexte et les attentes pertinentes ; ni politique climatique préremplie ni conclusion de pertinence automatique.',
  },
  {
    id: 'ISO-GUIDE',
    libelle: 'Guide pratique ISO pour les PME (présentation officielle)',
    url: 'https://www.iso.org/obp/ui?_escaped_fragment_=iso:pub:PUB100484',
    limite:
      'Présentation publique seulement : le contenu payant n’a pas été lu et n’est pas attribué à cette séquence.',
  },
  {
    id: 'ISO-SOA',
    libelle: 'Note de pratiques d’audit ISO/IEC JTC 1/SC 27 sur la SoA',
    url: 'https://committee.iso.org/files/live/sites/jtc1sc27/files/resources/ISO-IECJTC1-SC27-WG1_N3298_Auditing%20Practices%20Note%20-%20SoA.pdf',
    limite:
      'Note explicative de 2022, pas une nouvelle exigence : justification des mesures et rôle de l’Annexe A ; elle ne rend pas toutes les mesures applicables.',
  },
  {
    id: 'HDS-02',
    libelle: 'ANS — référentiel de certification HDS v2.0 (avril 2024)',
    url: 'https://esante.gouv.fr/sites/default/files/media_entity/documents/referentiel_certification_hds---fr--v2.pdf',
    limite:
      'Chapitres 3 à 5 : champ, certification et SMSI ; 6 : contrats ; 7 et 8 : souveraineté et garanties. Le document désigne la référence française NF ISO/IEC 27001:2023.',
  },
  {
    id: 'HDS-PROC',
    libelle: 'ANS — procédure de certification HDS',
    url: 'https://esante.gouv.fr/services/hebergeurs-de-donnees-de-sante/les-referentiels-de-la-procedure-de-certification',
    limite:
      'Certification externe, audits et surveillance : l’interface ne délivre aucun certificat ni ne déduit l’applicabilité du secteur santé.',
  },
  {
    id: 'ISO-03-LIMITE',
    libelle: 'ISO/IEC 27003:2017',
    url: 'https://www.iso.org/standard/63417.html',
    limite: 'Cette édition guide ISO/IEC 27001:2013 : elle n’est pas transposée automatiquement à la version 2022.',
  },
];
export const SOURCE_ETAPE = {
  iso: 'https://www.iso.org/standard/27001',
  hds: 'https://esante.gouv.fr/sites/default/files/media_entity/documents/referentiel_certification_hds---fr--v2.pdf',
} as const;

/** Destination d'une sous-action : une rubrique du Pilotage (id de `pilotage-navigation.ts`) ou une page hors Pilotage. */
export type DestinationParcours = { rubrique: string } | { chemin: string; module: Module };
export interface SousActionParcours {
  id: string;
  titre: string;
  description: string;
  /** Ce qu'on attend de ce travail : aide de travail, pas une exigence supplémentaire de la norme. */
  attendu: string;
  /** Exemple de livrable : format proposé, non imposé par la norme. */
  livrable: string;
  /** Indice du repère de l'étape que cette sous-action prépare. */
  repere: number;
  vers: DestinationParcours;
  /** Types de fiches que ce module tient déjà et que le parcours relit (seulement pour les retrouver et les ouvrir). */
  kinds: readonly GrcKind[];
}
export interface EtapeParcours {
  id: string;
  titre: string;
  sousTitre: string;
  reference: string;
  source: keyof typeof SOURCE_ETAPE;
  branche: BrancheParcours;
  icone: string;
  reperes: readonly string[];
  /** Module(s) où se retrouvent les travaux (libellé indicatif). */
  module: string;
  /** Dépendances de travail proposées : jamais des verrous, tout reste consultable. */
  dependances: readonly string[];
  sousActions: readonly SousActionParcours[];
}

export const ETAPES_PARCOURS: readonly EtapeParcours[] = [
  {
    id: 'context',
    titre: 'Définir le cadre',
    sousTitre: 'Contexte · Parties intéressées · Périmètre',
    reference: 'ISO 27001 · 4.1–4.4',
    source: 'iso',
    branche: 'cadrer',
    icone: 'context',
    reperes: ['Périmètre documenté', 'Contexte et attentes à examiner'],
    module: 'Organisation / Périmètres',
    dependances: [],
    sousActions: [
      {
        id: 'context-1',
        titre: 'Décrire le périmètre',
        description: 'Préciser ce que couvre le SMSI.',
        attendu:
          'Un périmètre documenté et relié à l’organisation, qui permet de comprendre les activités, entités et limites retenues.',
        livrable: 'Fiche périmètre et document de portée',
        repere: 0,
        vers: { rubrique: 'contexte' },
        kinds: ['context'],
      },
      {
        id: 'context-2',
        titre: 'Examiner le contexte',
        description: 'Recenser les enjeux et les attentes.',
        attendu:
          'Une synthèse reliée au périmètre pour examiner le contexte et les parties intéressées, incluant l’examen des enjeux climatiques pertinents.',
        livrable: 'Synthèse de contexte et attentes',
        repere: 1,
        vers: { rubrique: 'parties' },
        kinds: ['stakeholder', 'swot'],
      },
    ],
  },
  {
    id: 'govern',
    titre: 'Engager la direction',
    sousTitre: 'Politique · Responsabilités',
    reference: 'ISO 27001 · 5.1–5.3',
    source: 'iso',
    branche: 'cadrer',
    icone: 'govern',
    reperes: ['Politique associée', 'Rôles et responsabilités documentés'],
    module: 'Organisation / Gouvernance',
    dependances: ['context'],
    sousActions: [
      {
        id: 'govern-1',
        titre: 'Préparer la politique',
        description: 'Relier les orientations de la direction.',
        attendu:
          'Une politique identifiée, versionnée et présentable à la direction pour sa revue ; la validation réelle reste à tracer dans les services métier.',
        livrable: 'Politique et référence de décision',
        repere: 0,
        vers: { chemin: '/documents', module: 'documents' },
        kinds: [],
      },
      {
        id: 'govern-2',
        titre: 'Définir les responsabilités',
        description: 'Clarifier qui porte chaque rôle.',
        attendu:
          'Une description des rôles et responsabilités liée aux personnes, groupes ou fonctions de l’organisation.',
        livrable: 'Matrice de responsabilités ou fiches de rôles',
        repere: 1,
        vers: { rubrique: 'responsabilites' },
        kinds: ['governance'],
      },
    ],
  },
  {
    id: 'support',
    titre: 'Mobiliser les moyens',
    sousTitre: 'Compétences · Communication · Documents',
    reference: 'ISO 27001 · 7.1–7.5',
    source: 'iso',
    branche: 'cadrer',
    icone: 'support',
    reperes: ['Ressources et compétences examinées', 'Documents de travail référencés'],
    module: 'Organisation / Ressources',
    dependances: ['context'],
    sousActions: [
      {
        id: 'support-1',
        titre: 'Examiner les moyens',
        description: 'Ressources et compétences à mobiliser.',
        attendu:
          'Une vue des moyens et compétences à examiner pour les travaux du SMSI, avec les éléments existants et les besoins identifiés.',
        livrable: 'État des moyens et éléments de compétence',
        repere: 0,
        vers: { rubrique: 'plans-formation' },
        kinds: [],
      },
      {
        id: 'support-2',
        titre: 'Relier les documents',
        description: 'Retrouver les versions utiles au travail.',
        attendu:
          'Des références aux documents de travail dans le registre existant, avec leur version et leur contexte d’utilisation.',
        livrable: 'Documents liés au registre central',
        repere: 1,
        vers: { chemin: '/documents', module: 'documents' },
        kinds: [],
      },
    ],
  },
  {
    id: 'risk',
    titre: 'Apprécier les risques',
    sousTitre: 'Méthode · Critères · Évaluation',
    reference: 'ISO 27001 · 6.1.1–6.1.2 ; 8.2',
    source: 'iso',
    branche: 'maitriser',
    icone: 'risk',
    reperes: ['Critères de risque référencés', 'Évaluations liées au périmètre'],
    module: 'Risques / Registre',
    dependances: ['context', 'govern'],
    sousActions: [
      {
        id: 'risk-1',
        titre: 'Poser les critères',
        description: 'Utiliser les échelles et critères retenus.',
        attendu:
          'Une méthode et des critères de risque identifiables, utilisant les versions du catalogue et les décisions d’acceptation retenues par l’organisation.',
        livrable: 'Méthode et références de configuration',
        repere: 0,
        vers: { rubrique: 'configuration-analyses' },
        kinds: [],
      },
      {
        id: 'risk-2',
        titre: 'Relier les évaluations',
        description: 'Retrouver les risques du périmètre.',
        attendu:
          'Des évaluations reliées aux risques du périmètre, avec leurs versions et les éléments permettant leur examen.',
        livrable: 'Registre et évaluations associées',
        repere: 1,
        vers: { rubrique: 'risques' },
        kinds: ['risk'],
      },
    ],
  },
  {
    id: 'objectives',
    titre: 'Fixer les objectifs',
    sousTitre: 'Objectifs · Évolution du SMSI',
    reference: 'ISO 27001 · 6.2–6.3',
    source: 'iso',
    branche: 'cadrer',
    icone: 'objectives',
    reperes: ['Objectifs et suivi préparés', 'Modifications du SMSI examinées'],
    module: 'Pilotage / Objectifs',
    dependances: ['govern'],
    sousActions: [
      {
        id: 'objectives-1',
        titre: 'Préparer les objectifs',
        description: 'Relier objectifs et suivi.',
        attendu:
          'Des objectifs accompagnés des éléments prévus pour leur suivi dans les modules de pilotage existants.',
        livrable: 'Objectifs et suivi associé',
        repere: 0,
        vers: { rubrique: 'objectifs' },
        kinds: ['objective'],
      },
      {
        id: 'objectives-2',
        titre: 'Examiner les changements',
        description: 'Anticiper les évolutions du SMSI.',
        attendu:
          'Les changements du SMSI identifiés et les éléments préparant leur examen, sans modifier silencieusement les décisions passées.',
        livrable: 'Relevé des modifications envisagées',
        repere: 1,
        vers: { rubrique: 'actions' },
        kinds: ['action'],
      },
    ],
  },
  {
    id: 'treatment',
    titre: 'Choisir le traitement',
    sousTitre: 'Plan · Applicabilité · Risques résiduels',
    reference: 'ISO 27001 · 6.1.3 ; Annexe A',
    source: 'iso',
    branche: 'maitriser',
    icone: 'treatment',
    reperes: [
      'Plan de traitement associé',
      'Déclaration d’applicabilité référencée',
      'Approbations des propriétaires de risques à recueillir',
    ],
    module: 'Risques / Traitement & SoA',
    dependances: ['risk'],
    sousActions: [
      {
        id: 'treatment-1',
        titre: 'Construire le traitement',
        description: 'Relier les mesures aux travaux prévus.',
        attendu:
          'Un plan de traitement relié aux risques et aux mesures retenues, avec les actions qui permettent d’en suivre la réalisation.',
        livrable: 'Plan de traitement et actions liées',
        repere: 0,
        vers: { rubrique: 'traitements' },
        kinds: ['treatment'],
      },
      {
        id: 'treatment-2',
        titre: 'Préparer l’applicabilité',
        description: 'Documenter le choix des mesures.',
        attendu:
          'Une déclaration d’applicabilité versionnée permettant de retrouver les mesures retenues, leur justification et les exclusions à examiner.',
        livrable: 'SoA / déclaration d’applicabilité',
        repere: 1,
        vers: { rubrique: 'applicabilite' },
        kinds: ['soa'],
      },
      {
        id: 'treatment-3',
        titre: 'Recueillir les décisions',
        description: 'Faire examiner le traitement et le résiduel.',
        attendu:
          'Des références aux décisions des propriétaires de risques sur le traitement et les risques résiduels. Une case de cette maquette ne remplace pas ces décisions.',
        livrable: 'Décisions liées aux risques',
        repere: 2,
        vers: { rubrique: 'risques' },
        kinds: ['risk'],
      },
    ],
  },
  {
    id: 'operate',
    titre: 'Mettre en œuvre',
    sousTitre: 'Opérations · Mesures · Traitement',
    reference: 'ISO 27001 · 8.1 ; 8.3',
    source: 'iso',
    branche: 'maitriser',
    icone: 'operate',
    reperes: ['Mesures et travaux liés', 'Enregistrements opérationnels référencés'],
    module: 'Actions / Plans d’action',
    dependances: ['treatment', 'support', 'objectives'],
    sousActions: [
      {
        id: 'operate-1',
        titre: 'Suivre les mesures',
        description: 'Raccorder les travaux opérationnels.',
        attendu:
          'Les mesures et travaux associés sont identifiables depuis les plans existants, avec leur avancement et leurs liens.',
        livrable: 'Mesures et plans d’action',
        repere: 0,
        vers: { rubrique: 'mesures' },
        kinds: ['measure'],
      },
      {
        id: 'operate-2',
        titre: 'Conserver les enregistrements',
        description: 'Retrouver les résultats opérationnels.',
        attendu:
          'Les enregistrements utiles à l’examen des opérations sont référencés et retrouvables dans les registres existants.',
        livrable: 'Enregistrements opérationnels liés',
        repere: 1,
        vers: { rubrique: 'preuves' },
        kinds: ['evidence'],
      },
    ],
  },
  {
    id: 'audit',
    titre: 'Auditer le SMSI',
    sousTitre: 'Audit interne',
    reference: 'ISO 27001 · 9.2',
    source: 'iso',
    branche: 'evaluer',
    icone: 'audit',
    reperes: ['Programme et résultats d’audit référencés', 'Constats liés au registre des écarts'],
    module: 'Conformité & audits / Audits',
    dependances: ['operate'],
    sousActions: [
      {
        id: 'audit-1',
        titre: 'Préparer et suivre l’audit',
        description: 'Relier programme et résultats.',
        attendu:
          'Les références du programme d’audit interne et de ses résultats sont associées au périmètre concerné.',
        livrable: 'Programme et rapport d’audit',
        repere: 0,
        vers: { rubrique: 'audits' },
        kinds: ['audit'],
      },
      {
        id: 'audit-2',
        titre: 'Relier les constats',
        description: 'Retrouver les suites de l’audit.',
        attendu:
          'Les constats et leurs suites sont retrouvables dans les registres d’écarts et d’actions, sans recopier les mêmes objets.',
        livrable: 'Constats et liens correctifs',
        repere: 1,
        vers: { rubrique: 'amelioration' },
        kinds: ['nonconformity'],
      },
    ],
  },
  {
    id: 'measure',
    titre: 'Mesurer les résultats',
    sousTitre: 'Indicateurs · Analyse',
    reference: 'ISO 27001 · 9.1',
    source: 'iso',
    branche: 'evaluer',
    icone: 'measure',
    reperes: ['Indicateurs et résultats référencés'],
    module: 'Pilotage / Indicateurs',
    dependances: ['operate', 'objectives'],
    sousActions: [
      {
        id: 'measure-1',
        titre: 'Examiner les indicateurs',
        description: 'Relier mesures, résultats et analyse.',
        attendu:
          'Les indicateurs suivis, leurs résultats et les éléments d’analyse sont accessibles depuis le pilotage du périmètre.',
        livrable: 'Indicateurs et résultats référencés',
        repere: 0,
        vers: { rubrique: 'indicateurs' },
        kinds: ['indicator'],
      },
    ],
  },
  {
    id: 'review',
    titre: 'Réunir la direction',
    sousTitre: 'Revue et décisions',
    reference: 'ISO 27001 · 9.3',
    source: 'iso',
    branche: 'evaluer',
    icone: 'review',
    reperes: ['Revue et décisions documentées'],
    module: 'Pilotage / Revue de direction',
    dependances: ['audit', 'measure'],
    sousActions: [
      {
        id: 'review-1',
        titre: 'Préparer la revue',
        description: 'Rassembler les éléments et décisions.',
        attendu:
          'Les éléments présentés à la direction et les décisions issues de la revue sont documentés et liés aux travaux concernés.',
        livrable: 'Dossier de revue et décisions',
        repere: 0,
        vers: { rubrique: 'revues' },
        kinds: ['management_review'],
      },
    ],
  },
  {
    id: 'improve',
    titre: 'Améliorer dans la durée',
    sousTitre: 'Corrections · Amélioration continue',
    reference: 'ISO 27001 · 10.1–10.2',
    source: 'iso',
    branche: 'evaluer',
    icone: 'improve',
    reperes: ['Actions correctives liées', 'Efficacité et amélioration suivies'],
    module: 'Actions / Amélioration',
    dependances: ['review'],
    sousActions: [
      {
        id: 'improve-1',
        titre: 'Suivre les corrections',
        description: 'Relier les suites aux constats.',
        attendu:
          'Les actions correctives sont liées aux écarts concernés et suivies sans effacer le constat ou la clôture historique.',
        livrable: 'Écarts et actions correctives',
        repere: 0,
        vers: { rubrique: 'amelioration' },
        kinds: ['nonconformity', 'action'],
      },
      {
        id: 'improve-2',
        titre: 'Examiner l’efficacité',
        description: 'Préparer le cycle d’amélioration suivant.',
        attendu:
          'Les résultats de suivi permettent d’examiner l’efficacité des corrections et les améliorations à poursuivre.',
        livrable: 'Éléments de suivi et conclusions',
        repere: 1,
        vers: { rubrique: 'amelioration' },
        kinds: ['nonconformity'],
      },
    ],
  },
  {
    id: 'hds-scope',
    titre: 'Qualifier les activités',
    sousTitre: 'Déterminer le champ HDS',
    reference: 'HDS v2.0 · §3 ; §5.4',
    source: 'hds',
    branche: 'hds',
    icone: 'hds',
    reperes: ['Activités et périmètre à examiner'],
    module: 'Conformité / HDS',
    dependances: ['context'],
    sousActions: [
      {
        id: 'hds-scope-1',
        titre: 'Qualifier le champ HDS',
        description: 'Examiner activités, données et rôle.',
        attendu:
          'Une analyse du champ HDS pour les activités du périmètre, en s’appuyant sur le chapitre 3 du référentiel ANS ; aucune conclusion déduite du seul secteur santé.',
        livrable: 'Analyse d’applicabilité à instruire',
        repere: 0,
        vers: { rubrique: 'dda-hds' },
        kinds: [],
      },
    ],
  },
  {
    id: 'hds-smsi',
    titre: 'Compléter le SMSI',
    sousTitre: 'Relier les compléments HDS au socle',
    reference: 'HDS v2.0 · §5',
    source: 'hds',
    branche: 'hds',
    icone: 'hds',
    reperes: ['Exigences HDS liées aux travaux SMSI'],
    module: 'Conformité / HDS',
    dependances: ['risk', 'support'],
    sousActions: [
      {
        id: 'hds-smsi-1',
        titre: 'Relier les compléments',
        description: 'Associer HDS aux travaux du SMSI.',
        attendu:
          'Les compléments du chapitre 5 sont reliés aux travaux ISO correspondants, sans créer un second jeu de preuves.',
        livrable: 'Correspondances et documents existants',
        repere: 0,
        vers: { rubrique: 'correspondances' },
        kinds: ['mapping'],
      },
    ],
  },
  {
    id: 'hds-contract',
    titre: 'Examiner les contrats',
    sousTitre: 'Clients · Prestations · Sous-traitants',
    reference: 'HDS v2.0 · §6',
    source: 'hds',
    branche: 'hds',
    icone: 'handshake',
    reperes: ['Contrats et responsabilités à examiner'],
    module: 'Conformité / HDS',
    dependances: ['hds-scope'],
    sousActions: [
      {
        id: 'hds-contract-1',
        titre: 'Examiner les engagements',
        description: 'Retrouver contrats et responsabilités.',
        attendu:
          'Les contrats et responsabilités sont disponibles pour un examen au regard du chapitre 6, sur le périmètre effectivement étudié.',
        livrable: 'Contrats et répartition des responsabilités',
        repere: 0,
        vers: { rubrique: 'fournisseurs-perimetre' },
        kinds: [],
      },
    ],
  },
  {
    id: 'hds-sovereignty',
    titre: 'Examiner la souveraineté',
    sousTitre: 'Données · Accès · Transparence',
    reference: 'HDS v2.0 · §7–8',
    source: 'hds',
    branche: 'hds',
    icone: 'hds',
    reperes: ['Éléments de localisation et garanties référencés'],
    module: 'Conformité / HDS',
    dependances: ['hds-scope'],
    sousActions: [
      {
        id: 'hds-sovereignty-1',
        titre: 'Documenter les garanties',
        description: 'Examiner localisation et conditions d’accès.',
        attendu:
          'Les informations à examiner selon les chapitres 7 et 8 sont rassemblées : localisation, conditions d’accès et garanties présentées.',
        livrable: 'Éléments de localisation et garanties',
        repere: 0,
        vers: { rubrique: 'dda-hds' },
        kinds: [],
      },
    ],
  },
  {
    id: 'hds-cert',
    titre: 'Préparer la certification',
    sousTitre: 'Organisme certificateur · Audits externes',
    reference: 'HDS v2.0 · §4',
    source: 'hds',
    branche: 'hds',
    icone: 'hds',
    reperes: ['Dossier à présenter à l’organisme certificateur'],
    module: 'Conformité / HDS',
    dependances: ['hds-smsi', 'hds-contract', 'hds-sovereignty', 'review'],
    sousActions: [
      {
        id: 'hds-cert-1',
        titre: 'Préparer le dossier',
        description: 'Organiser l’échange avec le certificateur.',
        attendu:
          'Un dossier permettant de présenter le périmètre et ses éléments à l’organisme certificateur. L’application ne prend aucune décision de certification.',
        livrable: 'Dossier de préparation de l’audit externe',
        repere: 0,
        vers: { rubrique: 'audits' },
        kinds: ['audit'],
      },
    ],
  },
];

/** Raccourcis graphiques de l'arbre : un cercle par entrée, qui désigne une étape et, le cas échéant, une partie de ses
    sous-actions. Les deux raccourcis d'une même étape ne dupliquent aucune sous-action. Les étapes sans raccourci restent
    accessibles depuis la liste et la bande « autres étapes ». */
export interface RaccourciParcours {
  id: string;
  etape: string;
  /** Sous-actions rattachées au raccourci ; absent : toutes celles de l'étape. */
  sousActions?: readonly string[];
  libelle: string;
  icone: string;
}
export const RACCOURCIS_PARCOURS: readonly RaccourciParcours[] = [
  { id: 'contexte', etape: 'context', sousActions: ['context-2'], libelle: 'Contexte', icone: 'audit' },
  { id: 'perimetre', etape: 'context', sousActions: ['context-1'], libelle: 'Périmètre', icone: 'objectives' },
  { id: 'gouvernance', etape: 'govern', libelle: 'Gouvernance', icone: 'govern' },
  {
    id: 'applicabilite',
    etape: 'treatment',
    sousActions: ['treatment-2'],
    libelle: 'Applicabilité',
    icone: 'treatment',
  },
  { id: 'risques', etape: 'risk', libelle: 'Risques', icone: 'risk' },
  {
    id: 'traitement',
    etape: 'treatment',
    sousActions: ['treatment-1', 'treatment-3'],
    libelle: 'Traitement',
    icone: 'settings',
  },
  { id: 'audits', etape: 'audit', libelle: 'Audits', icone: 'audit' },
  { id: 'revue', etape: 'review', libelle: 'Revue', icone: 'review' },
  { id: 'actions-correctives', etape: 'improve', libelle: 'Actions correctives', icone: 'measure' },
  { id: 'contrats', etape: 'hds-contract', libelle: 'Contrats', icone: 'handshake' },
  { id: 'activites', etape: 'hds-scope', libelle: 'Activités', icone: 'hds' },
];

export const etapeParcours = (id: string) => ETAPES_PARCOURS.find((e) => e.id === id);
export const sousActionParcours = (id: string) => {
  for (const e of ETAPES_PARCOURS) {
    const s = e.sousActions.find((x) => x.id === id);
    if (s) return { etape: e, sousAction: s };
  }
  return undefined;
};
/** Sous-actions d'un raccourci. */
export function sousActionsDuRaccourci(r: RaccourciParcours): readonly SousActionParcours[] {
  const e = etapeParcours(r.etape);
  if (!e) return [];
  return r.sousActions ? e.sousActions.filter((s) => r.sousActions!.includes(s.id)) : e.sousActions;
}
/** Étapes affichées : masquer la branche HDS est une préférence d'affichage, jamais une décision d'applicabilité. */
export const etapesAffichees = (hds: boolean) => ETAPES_PARCOURS.filter((e) => hds || e.branche !== 'hds');
/** Étapes qu'aucun raccourci graphique ne désigne : elles restent accessibles depuis la bande « autres étapes » et la liste. */
export const etapesSansRaccourci = (hds: boolean) =>
  etapesAffichees(hds).filter((e) => !RACCOURCIS_PARCOURS.some((r) => r.etape === e.id));

/* ------------------------------------------------------------------------------ associations (migration 038)
   Association explicite d'une fiche ou d'une preuve existante à une sous-action, dans un périmètre. Journal immuable : associer,
   puis éventuellement retirer avec un motif. L'association ne modifie pas la cible et ne vaut ni revue, ni conformité. */
const refCible = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(
    /^(object:[0-9a-f-]{36}|document:[0-9a-f-]{36}:\d+)$/,
    'Une fiche (object:…) ou une version de document (document:…:n) est attendue.',
  );
export const AssociationParcoursBody = z
  .object({
    /** Identifiant de requête fourni par le client : rejouer la commande ne crée pas de second enregistrement. */
    requestId: z.uuid(),
    sousAction: z.string().trim().min(1).max(100),
    ref: refCible,
    note: z.string().trim().max(500).default(''),
  })
  .strict();
export type AssociationParcoursBody = z.infer<typeof AssociationParcoursBody>;
export const RetraitAssociationBody = z
  .object({
    requestId: z.uuid(),
    sousAction: z.string().trim().min(1).max(100),
    ref: refCible,
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
export type RetraitAssociationBody = z.infer<typeof RetraitAssociationBody>;
export interface AssociationParcoursDto {
  sousAction: string;
  ref: string;
  /** Intitulé résolu avec les droits de la personne ; null : non lisible (la référence reste affichée). */
  name: string | null;
  kind: string | null;
  note: string;
  associePar: string;
  associeLe: string;
}
/** Applicabilité, dans le périmètre, des exigences du référentiel HDS qui lui est rattaché (lecture seule). */
export interface ApplicabiliteHdsDto {
  /** Référentiel HDS rattaché et actif, ou null : aucune applicabilité n'est alors déduite (jamais du secteur de santé). */
  referentiel: { id: string; name: string; version: number; heritage: boolean } | null;
  total: number;
  applicable: number;
  exclue: number;
  aDeterminer: number;
  nonEvaluee: number;
}

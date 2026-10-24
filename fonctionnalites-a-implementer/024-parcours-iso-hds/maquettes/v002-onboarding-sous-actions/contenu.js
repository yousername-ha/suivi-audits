window.ParcoursNodes = [
  {
    "id": "context",
    "title": "Définir le cadre",
    "sub": "Contexte · Parties intéressées · Périmètre",
    "ref": "ISO 27001 · 4.1–4.4",
    "source": "https://www.iso.org/standard/27001",
    "icon": "♧",
    "x": 380,
    "y": 20,
    "deps": [],
    "artifacts": [
      "Périmètre documenté",
      "Contexte et attentes à examiner"
    ],
    "module": "Organisation / Périmètres",
    "status": "done",
    "type": "iso",
    "row": 0,
    "actions": [
      {
        "id": "context-1",
        "icon": "♧",
        "title": "Décrire le périmètre",
        "description": "Préciser ce que couvre le SMSI.",
        "expected": "Un périmètre documenté et relié à l’organisation, qui permet de comprendre les activités, entités et limites retenues.",
        "deliverable": "Fiche périmètre et document de portée",
        "artifactIndex": 0
      },
      {
        "id": "context-2",
        "icon": "◎",
        "title": "Examiner le contexte",
        "description": "Recenser les enjeux et les attentes.",
        "expected": "Une synthèse reliée au périmètre pour examiner le contexte et les parties intéressées, incluant l’examen des enjeux climatiques pertinents.",
        "deliverable": "Synthèse de contexte et attentes",
        "artifactIndex": 1
      }
    ]
  },
  {
    "id": "govern",
    "title": "Engager la direction",
    "sub": "Politique · Responsabilités",
    "ref": "ISO 27001 · 5.1–5.3",
    "source": "https://www.iso.org/standard/27001",
    "icon": "⚑",
    "x": 180,
    "y": 130,
    "deps": [
      "context"
    ],
    "artifacts": [
      "Politique associée",
      "Rôles et responsabilités documentés"
    ],
    "module": "Organisation / Gouvernance",
    "status": "done",
    "type": "iso",
    "row": 1,
    "actions": [
      {
        "id": "govern-1",
        "icon": "⚑",
        "title": "Préparer la politique",
        "description": "Relier les orientations de la direction.",
        "expected": "Une politique identifiée, versionnée et présentable à la direction pour sa revue ; la validation réelle reste à tracer dans les services métier.",
        "deliverable": "Politique et référence de décision",
        "artifactIndex": 0
      },
      {
        "id": "govern-2",
        "icon": "♙",
        "title": "Définir les responsabilités",
        "description": "Clarifier qui porte chaque rôle.",
        "expected": "Une description des rôles et responsabilités liée aux personnes, groupes ou fonctions de l’organisation.",
        "deliverable": "Matrice de responsabilités ou fiches de rôles",
        "artifactIndex": 1
      }
    ]
  },
  {
    "id": "support",
    "title": "Mobiliser les moyens",
    "sub": "Compétences · Communication · Documents",
    "ref": "ISO 27001 · 7.1–7.5",
    "source": "https://www.iso.org/standard/27001",
    "icon": "♙",
    "x": 580,
    "y": 130,
    "deps": [
      "context"
    ],
    "artifacts": [
      "Ressources et compétences examinées",
      "Documents de travail référencés"
    ],
    "module": "Organisation / Ressources",
    "status": "progress",
    "type": "iso",
    "row": 1,
    "actions": [
      {
        "id": "support-1",
        "icon": "♙",
        "title": "Examiner les moyens",
        "description": "Ressources et compétences à mobiliser.",
        "expected": "Une vue des moyens et compétences à examiner pour les travaux du SMSI, avec les éléments existants et les besoins identifiés.",
        "deliverable": "État des moyens et éléments de compétence",
        "artifactIndex": 0
      },
      {
        "id": "support-2",
        "icon": "▤",
        "title": "Relier les documents",
        "description": "Retrouver les versions utiles au travail.",
        "expected": "Des références aux documents de travail dans le registre existant, avec leur version et leur contexte d’utilisation.",
        "deliverable": "Documents liés au registre central",
        "artifactIndex": 1
      }
    ]
  },
  {
    "id": "risk",
    "title": "Apprécier les risques",
    "sub": "Méthode · Critères · Évaluation",
    "ref": "ISO 27001 · 6.1.1–6.1.2 ; 8.2",
    "source": "https://www.iso.org/standard/27001",
    "icon": "△",
    "x": 180,
    "y": 240,
    "deps": [
      "context",
      "govern"
    ],
    "artifacts": [
      "Critères de risque référencés",
      "Évaluations liées au périmètre"
    ],
    "module": "Risques / Registre",
    "status": "progress",
    "type": "iso",
    "row": 2,
    "actions": [
      {
        "id": "risk-1",
        "icon": "▥",
        "title": "Poser les critères",
        "description": "Utiliser les échelles et critères retenus.",
        "expected": "Une méthode et des critères de risque identifiables, utilisant les versions du catalogue et les décisions d’acceptation retenues par l’organisation.",
        "deliverable": "Méthode et références de configuration",
        "artifactIndex": 0
      },
      {
        "id": "risk-2",
        "icon": "△",
        "title": "Relier les évaluations",
        "description": "Retrouver les risques du périmètre.",
        "expected": "Des évaluations reliées aux risques du périmètre, avec leurs versions et les éléments permettant leur examen.",
        "deliverable": "Registre et évaluations associées",
        "artifactIndex": 1
      }
    ]
  },
  {
    "id": "objectives",
    "title": "Fixer les objectifs",
    "sub": "Objectifs · Évolution du SMSI",
    "ref": "ISO 27001 · 6.2–6.3",
    "source": "https://www.iso.org/standard/27001",
    "icon": "◎",
    "x": 580,
    "y": 240,
    "deps": [
      "govern"
    ],
    "artifacts": [
      "Objectifs et suivi préparés",
      "Modifications du SMSI examinées"
    ],
    "module": "Pilotage / Objectifs",
    "status": "todo",
    "type": "iso",
    "row": 2,
    "actions": [
      {
        "id": "objectives-1",
        "icon": "◎",
        "title": "Préparer les objectifs",
        "description": "Relier objectifs et suivi.",
        "expected": "Des objectifs accompagnés des éléments prévus pour leur suivi dans les modules de pilotage existants.",
        "deliverable": "Objectifs et suivi associé",
        "artifactIndex": 0
      },
      {
        "id": "objectives-2",
        "icon": "↻",
        "title": "Examiner les changements",
        "description": "Anticiper les évolutions du SMSI.",
        "expected": "Les changements du SMSI identifiés et les éléments préparant leur examen, sans modifier silencieusement les décisions passées.",
        "deliverable": "Relevé des modifications envisagées",
        "artifactIndex": 1
      }
    ]
  },
  {
    "id": "treatment",
    "title": "Choisir le traitement",
    "sub": "Plan · Applicabilité · Risques résiduels",
    "ref": "ISO 27001 · 6.1.3 ; Annexe A",
    "source": "https://www.iso.org/standard/27001",
    "icon": "♢",
    "x": 180,
    "y": 350,
    "deps": [
      "risk"
    ],
    "artifacts": [
      "Plan de traitement associé",
      "Déclaration d’applicabilité référencée",
      "Approbations des propriétaires de risques à recueillir"
    ],
    "module": "Risques / Traitement & SoA",
    "status": "todo",
    "type": "iso",
    "row": 3,
    "actions": [
      {
        "id": "treatment-1",
        "icon": "✓",
        "title": "Construire le traitement",
        "description": "Relier les mesures aux travaux prévus.",
        "expected": "Un plan de traitement relié aux risques et aux mesures retenues, avec les actions qui permettent d’en suivre la réalisation.",
        "deliverable": "Plan de traitement et actions liées",
        "artifactIndex": 0
      },
      {
        "id": "treatment-2",
        "icon": "♢",
        "title": "Préparer l’applicabilité",
        "description": "Documenter le choix des mesures.",
        "expected": "Une déclaration d’applicabilité versionnée permettant de retrouver les mesures retenues, leur justification et les exclusions à examiner.",
        "deliverable": "SoA / déclaration d’applicabilité",
        "artifactIndex": 1
      },
      {
        "id": "treatment-3",
        "icon": "♙",
        "title": "Recueillir les décisions",
        "description": "Faire examiner le traitement et le résiduel.",
        "expected": "Des références aux décisions des propriétaires de risques sur le traitement et les risques résiduels. Une case de cette maquette ne remplace pas ces décisions.",
        "deliverable": "Décisions liées aux risques",
        "artifactIndex": 2
      }
    ]
  },
  {
    "id": "operate",
    "title": "Mettre en œuvre",
    "sub": "Opérations · Mesures · Traitement",
    "ref": "ISO 27001 · 8.1 ; 8.3",
    "source": "https://www.iso.org/standard/27001",
    "icon": "⚙",
    "x": 580,
    "y": 350,
    "deps": [
      "treatment",
      "support",
      "objectives"
    ],
    "artifacts": [
      "Mesures et travaux liés",
      "Enregistrements opérationnels référencés"
    ],
    "module": "Actions / Plans d’action",
    "status": "todo",
    "type": "iso",
    "row": 3,
    "actions": [
      {
        "id": "operate-1",
        "icon": "⚙",
        "title": "Suivre les mesures",
        "description": "Raccorder les travaux opérationnels.",
        "expected": "Les mesures et travaux associés sont identifiables depuis les plans existants, avec leur avancement et leurs liens.",
        "deliverable": "Mesures et plans d’action",
        "artifactIndex": 0
      },
      {
        "id": "operate-2",
        "icon": "▤",
        "title": "Conserver les enregistrements",
        "description": "Retrouver les résultats opérationnels.",
        "expected": "Les enregistrements utiles à l’examen des opérations sont référencés et retrouvables dans les registres existants.",
        "deliverable": "Enregistrements opérationnels liés",
        "artifactIndex": 1
      }
    ]
  },
  {
    "id": "audit",
    "title": "Auditer le SMSI",
    "sub": "Audit interne",
    "ref": "ISO 27001 · 9.2",
    "source": "https://www.iso.org/standard/27001",
    "icon": "▤",
    "x": 180,
    "y": 460,
    "deps": [
      "operate"
    ],
    "artifacts": [
      "Programme et résultats d’audit référencés",
      "Constats liés au registre des écarts"
    ],
    "module": "Conformité & audits / Audits",
    "status": "todo",
    "type": "iso",
    "row": 4,
    "actions": [
      {
        "id": "audit-1",
        "icon": "▤",
        "title": "Préparer et suivre l’audit",
        "description": "Relier programme et résultats.",
        "expected": "Les références du programme d’audit interne et de ses résultats sont associées au périmètre concerné.",
        "deliverable": "Programme et rapport d’audit",
        "artifactIndex": 0
      },
      {
        "id": "audit-2",
        "icon": "△",
        "title": "Relier les constats",
        "description": "Retrouver les suites de l’audit.",
        "expected": "Les constats et leurs suites sont retrouvables dans les registres d’écarts et d’actions, sans recopier les mêmes objets.",
        "deliverable": "Constats et liens correctifs",
        "artifactIndex": 1
      }
    ]
  },
  {
    "id": "measure",
    "title": "Mesurer les résultats",
    "sub": "Indicateurs · Analyse",
    "ref": "ISO 27001 · 9.1",
    "source": "https://www.iso.org/standard/27001",
    "icon": "▥",
    "x": 580,
    "y": 460,
    "deps": [
      "operate",
      "objectives"
    ],
    "artifacts": [
      "Indicateurs et résultats référencés"
    ],
    "module": "Pilotage / Indicateurs",
    "status": "todo",
    "type": "iso",
    "row": 4,
    "actions": [
      {
        "id": "measure-1",
        "icon": "▥",
        "title": "Examiner les indicateurs",
        "description": "Relier mesures, résultats et analyse.",
        "expected": "Les indicateurs suivis, leurs résultats et les éléments d’analyse sont accessibles depuis le pilotage du périmètre.",
        "deliverable": "Indicateurs et résultats référencés",
        "artifactIndex": 0
      }
    ]
  },
  {
    "id": "review",
    "title": "Réunir la direction",
    "sub": "Revue et décisions",
    "ref": "ISO 27001 · 9.3",
    "source": "https://www.iso.org/standard/27001",
    "icon": "♧",
    "x": 380,
    "y": 570,
    "deps": [
      "audit",
      "measure"
    ],
    "artifacts": [
      "Revue et décisions documentées"
    ],
    "module": "Pilotage / Revue de direction",
    "status": "todo",
    "type": "iso",
    "row": 5,
    "actions": [
      {
        "id": "review-1",
        "icon": "♙",
        "title": "Préparer la revue",
        "description": "Rassembler les éléments et décisions.",
        "expected": "Les éléments présentés à la direction et les décisions issues de la revue sont documentés et liés aux travaux concernés.",
        "deliverable": "Dossier de revue et décisions",
        "artifactIndex": 0
      }
    ]
  },
  {
    "id": "improve",
    "title": "Améliorer dans la durée",
    "sub": "Corrections · Amélioration continue",
    "ref": "ISO 27001 · 10.1–10.2",
    "source": "https://www.iso.org/standard/27001",
    "icon": "↻",
    "x": 380,
    "y": 680,
    "deps": [
      "review"
    ],
    "artifacts": [
      "Actions correctives liées",
      "Efficacité et amélioration suivies"
    ],
    "module": "Actions / Amélioration",
    "status": "todo",
    "type": "iso",
    "row": 6,
    "actions": [
      {
        "id": "improve-1",
        "icon": "✓",
        "title": "Suivre les corrections",
        "description": "Relier les suites aux constats.",
        "expected": "Les actions correctives sont liées aux écarts concernés et suivies sans effacer le constat ou la clôture historique.",
        "deliverable": "Écarts et actions correctives",
        "artifactIndex": 0
      },
      {
        "id": "improve-2",
        "icon": "↻",
        "title": "Examiner l’efficacité",
        "description": "Préparer le cycle d’amélioration suivant.",
        "expected": "Les résultats de suivi permettent d’examiner l’efficacité des corrections et les améliorations à poursuivre.",
        "deliverable": "Éléments de suivi et conclusions",
        "artifactIndex": 1
      }
    ]
  },
  {
    "id": "hds-scope",
    "title": "Qualifier les activités",
    "sub": "Déterminer le champ HDS",
    "ref": "HDS v2.0 · §3 ; §5.4",
    "source": "https://esante.gouv.fr/sites/default/files/media_entity/documents/referentiel_certification_hds---fr--v2.pdf",
    "icon": "✦",
    "deps": [
      "context"
    ],
    "artifacts": [
      "Activités et périmètre à examiner"
    ],
    "module": "Conformité / HDS",
    "status": "todo",
    "type": "hds",
    "row": null,
    "actions": [
      {
        "id": "hds-scope-1",
        "icon": "♧",
        "title": "Qualifier le champ HDS",
        "description": "Examiner activités, données et rôle.",
        "expected": "Une analyse du champ HDS pour les activités du périmètre, en s’appuyant sur le chapitre 3 du référentiel ANS ; aucune conclusion déduite du seul secteur santé.",
        "deliverable": "Analyse d’applicabilité à instruire",
        "artifactIndex": 0
      }
    ]
  },
  {
    "id": "hds-smsi",
    "title": "Compléter le SMSI",
    "sub": "Relier les compléments HDS au socle",
    "ref": "HDS v2.0 · §5",
    "source": "https://esante.gouv.fr/sites/default/files/media_entity/documents/referentiel_certification_hds---fr--v2.pdf",
    "icon": "✦",
    "deps": [
      "risk",
      "support"
    ],
    "artifacts": [
      "Exigences HDS liées aux travaux SMSI"
    ],
    "module": "Conformité / HDS",
    "status": "todo",
    "type": "hds",
    "row": null,
    "actions": [
      {
        "id": "hds-smsi-1",
        "icon": "♢",
        "title": "Relier les compléments",
        "description": "Associer HDS aux travaux du SMSI.",
        "expected": "Les compléments du chapitre 5 sont reliés aux travaux ISO correspondants, sans créer un second jeu de preuves.",
        "deliverable": "Correspondances et documents existants",
        "artifactIndex": 0
      }
    ]
  },
  {
    "id": "hds-contract",
    "title": "Examiner les contrats",
    "sub": "Clients · Prestations · Sous-traitants",
    "ref": "HDS v2.0 · §6",
    "source": "https://esante.gouv.fr/sites/default/files/media_entity/documents/referentiel_certification_hds---fr--v2.pdf",
    "icon": "✦",
    "deps": [
      "hds-scope"
    ],
    "artifacts": [
      "Contrats et responsabilités à examiner"
    ],
    "module": "Conformité / HDS",
    "status": "todo",
    "type": "hds",
    "row": null,
    "actions": [
      {
        "id": "hds-contract-1",
        "icon": "▤",
        "title": "Examiner les engagements",
        "description": "Retrouver contrats et responsabilités.",
        "expected": "Les contrats et responsabilités sont disponibles pour un examen au regard du chapitre 6, sur le périmètre effectivement étudié.",
        "deliverable": "Contrats et répartition des responsabilités",
        "artifactIndex": 0
      }
    ]
  },
  {
    "id": "hds-sovereignty",
    "title": "Examiner la souveraineté",
    "sub": "Données · Accès · Transparence",
    "ref": "HDS v2.0 · §7–8",
    "source": "https://esante.gouv.fr/sites/default/files/media_entity/documents/referentiel_certification_hds---fr--v2.pdf",
    "icon": "✦",
    "deps": [
      "hds-scope"
    ],
    "artifacts": [
      "Éléments de localisation et garanties référencés"
    ],
    "module": "Conformité / HDS",
    "status": "todo",
    "type": "hds",
    "row": null,
    "actions": [
      {
        "id": "hds-sovereignty-1",
        "icon": "◎",
        "title": "Documenter les garanties",
        "description": "Examiner localisation et conditions d’accès.",
        "expected": "Les informations à examiner selon les chapitres 7 et 8 sont rassemblées : localisation, conditions d’accès et garanties présentées.",
        "deliverable": "Éléments de localisation et garanties",
        "artifactIndex": 0
      }
    ]
  },
  {
    "id": "hds-cert",
    "title": "Préparer la certification",
    "sub": "Organisme certificateur · Audits externes",
    "ref": "HDS v2.0 · §4",
    "source": "https://esante.gouv.fr/sites/default/files/media_entity/documents/referentiel_certification_hds---fr--v2.pdf",
    "icon": "✦",
    "deps": [
      "hds-smsi",
      "hds-contract",
      "hds-sovereignty",
      "review"
    ],
    "artifacts": [
      "Dossier à présenter à l’organisme certificateur"
    ],
    "module": "Conformité / HDS",
    "status": "todo",
    "type": "hds",
    "row": null,
    "actions": [
      {
        "id": "hds-cert-1",
        "icon": "✦",
        "title": "Préparer le dossier",
        "description": "Organiser l’échange avec le certificateur.",
        "expected": "Un dossier permettant de présenter le périmètre et ses éléments à l’organisme certificateur. L’application ne prend aucune décision de certification.",
        "deliverable": "Dossier de préparation de l’audit externe",
        "artifactIndex": 0
      }
    ]
  }
];

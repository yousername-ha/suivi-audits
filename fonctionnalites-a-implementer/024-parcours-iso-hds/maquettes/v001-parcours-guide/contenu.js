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
    "type": "iso"
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
    "type": "iso"
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
    "type": "iso"
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
    "type": "iso"
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
    "type": "iso"
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
    "type": "iso"
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
    "type": "iso"
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
    "type": "iso"
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
    "type": "iso"
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
    "type": "iso"
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
    "type": "iso"
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
    "type": "hds"
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
    "type": "hds"
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
    "type": "hds"
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
    "type": "hds"
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
    "type": "hds"
  }
];

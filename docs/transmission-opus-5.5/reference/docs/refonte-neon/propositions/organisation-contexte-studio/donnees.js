/* global window */
/* Jeu fictif fourni ; affectations PESTEL illustratives, sans lecture ni écriture API. */
window.DEMO_ORGANISATION = {
  "date": "2026-11-09",
  "scope": "Pilotage de l’organisation",
  "processes": [
    {
      "id": "PR1",
      "name": "Direction et pilotage de l’établissement",
      "owner": "Direction",
      "family": "Management",
      "purpose": "Définir les orientations et les moyens."
    },
    {
      "id": "PR2",
      "name": "Accueil et prise en charge des patients",
      "owner": "Responsable accueil",
      "family": "Réalisation",
      "purpose": "Accueillir les patients et assurer leur prise en charge."
    },
    {
      "id": "PR3",
      "name": "Achats et prestataires",
      "owner": "Responsable achats",
      "family": "Support",
      "purpose": "Choisir et suivre les prestataires externes."
    },
    {
      "id": "PR4",
      "name": "Systèmes d’information",
      "owner": "RSI",
      "family": "Support",
      "purpose": "Exploiter et protéger les systèmes."
    },
    {
      "id": "PR5",
      "name": "Amélioration continue",
      "owner": "Responsable qualité",
      "family": "Management",
      "purpose": "Traiter écarts, audits et revues."
    },
    {
      "id": "PR6",
      "name": "Gestion documentaire",
      "owner": "Assistante de direction",
      "family": "Support",
      "purpose": ""
    }
  ],
  "parties": [
    {
      "id": "PI1",
      "name": "Patients",
      "type": "Externe",
      "cat": "Patient ou usager",
      "needs": "Accueil de qualité, confidentialité",
      "req": "Respect de la vie privée",
      "addressed": "Oui",
      "reviewed": "2026-07-03",
      "how": "Charte d’accueil",
      "owner": "Responsable accueil"
    },
    {
      "id": "PI2",
      "name": "Autorité de tutelle fictive",
      "type": "Externe",
      "cat": "Autorité ou régulateur",
      "needs": "Conformité réglementaire",
      "req": "Déclarations annuelles",
      "addressed": "Partiel",
      "reviewed": "2025-06-18",
      "how": "Suivi des déclarations",
      "owner": "Direction"
    },
    {
      "id": "PI3",
      "name": "Personnel",
      "type": "Interne",
      "cat": "Personnel",
      "needs": "Outils fiables, formation",
      "req": "",
      "addressed": "Oui",
      "reviewed": "2026-09-01",
      "how": "Plan de formation",
      "owner": "Direction"
    },
    {
      "id": "PI4",
      "name": "Établissements partenaires",
      "type": "Externe",
      "cat": "Partenaire",
      "needs": "Échanges sécurisés",
      "req": "Clauses de confidentialité",
      "addressed": "Non",
      "reviewed": "",
      "how": "",
      "owner": "Responsable achats"
    },
    {
      "id": "PI5",
      "name": "Hébergeur de données fictif",
      "type": "Externe",
      "cat": "Fournisseur ou prestataire",
      "needs": "Contrat à jour",
      "req": "Certificat valide",
      "addressed": "Oui",
      "reviewed": "2026-10-01",
      "how": "Suivi du certificat",
      "owner": "RSI"
    },
    {
      "id": "PI6",
      "name": "Conseil d’administration",
      "type": "Interne",
      "cat": "Instance de gouvernance",
      "needs": "Tableaux de bord",
      "req": "",
      "addressed": "Oui",
      "reviewed": "2026-08-02",
      "how": "Revue de direction",
      "owner": "Direction"
    }
  ],
  "swots": [
    {
      "id": "SW1",
      "process": "PR2",
      "date": "2026-09-16",
      "author": "Responsable accueil",
      "version": "1",
      "S": [
        {
          "text": "Équipe stable"
        }
      ],
      "W": [
        {
          "text": "Charge de travail en pointe"
        }
      ],
      "O": [
        {
          "text": "Téléconsultation fictive"
        }
      ],
      "T": [
        {
          "text": "Évolution des exigences réglementaires"
        }
      ],
      "processName": "Accueil et prise en charge des patients"
    }
  ],
  "factors": [
    {
      "id": "politique",
      "label": "Politique",
      "letter": "P",
      "tone": "blue"
    },
    {
      "id": "economique",
      "label": "Économique",
      "letter": "E",
      "tone": "amber"
    },
    {
      "id": "social",
      "label": "Social",
      "letter": "S",
      "tone": "teal"
    },
    {
      "id": "technologique",
      "label": "Technologique",
      "letter": "T",
      "tone": "indigo"
    },
    {
      "id": "environnemental",
      "label": "Environnemental",
      "letter": "E",
      "tone": "green"
    },
    {
      "id": "legal",
      "label": "Légal",
      "letter": "L",
      "tone": "red"
    }
  ],
  "issues": [
    {
      "id": "ext-legislation",
      "label": "Évolution de la législation sur les données de santé",
      "nature": "ext",
      "factor": "legal",
      "processus": [
        "Direction et pilotage de l’établissement"
      ]
    },
    {
      "id": "ext-cyber",
      "label": "Menace cyber sur les dossiers",
      "nature": "ext",
      "factor": "technologique",
      "processus": [
        "Systèmes d’information"
      ]
    },
    {
      "id": "ext-hebergeur",
      "label": "Dépendance à un hébergeur unique",
      "nature": "ext",
      "factor": null,
      "processus": [
        "Systèmes d’information"
      ]
    },
    {
      "id": "ext-teleconsultation",
      "label": "Téléconsultation fictive",
      "nature": "ext",
      "factor": "technologique",
      "processus": [
        "Accueil et prise en charge des patients"
      ]
    },
    {
      "id": "ext-reglementation",
      "label": "Évolution des exigences réglementaires",
      "nature": "ext",
      "factor": "legal",
      "processus": [
        "Accueil et prise en charge des patients"
      ]
    },
    {
      "id": "int-competences",
      "label": "Compétences internes en sécurité",
      "nature": "int",
      "factor": null,
      "processus": []
    },
    {
      "id": "int-equipe",
      "label": "Équipe stable",
      "nature": "int",
      "factor": null,
      "processus": [
        "Accueil et prise en charge des patients"
      ]
    },
    {
      "id": "int-charge",
      "label": "Charge de travail en pointe",
      "nature": "int",
      "factor": null,
      "processus": [
        "Accueil et prise en charge des patients"
      ]
    }
  ]
};

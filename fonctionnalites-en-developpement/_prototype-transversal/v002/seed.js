window.ASTRA_SEED = {
  "schema": 2,
  "theme": "forest",
  "catalog": [
    {
      "id": "VM-01",
      "kind": "value",
      "name": "Continuité du service de démonstration",
      "category": "Service essentiel",
      "owner": "Rôle RSSI démo"
    },
    {
      "id": "VM-02",
      "kind": "value",
      "name": "Informations de démonstration",
      "category": "Information",
      "owner": "Rôle métier démo"
    },
    {
      "id": "AS-01",
      "kind": "asset",
      "name": "Application de démonstration",
      "category": "Logiciel",
      "owner": "Rôle DSI démo"
    },
    {
      "id": "AS-02",
      "kind": "asset",
      "name": "Annuaire de démonstration",
      "category": "Service",
      "owner": "Rôle DSI démo"
    },
    {
      "id": "SUP-01",
      "kind": "supplier",
      "name": "Prestataire fictif Alpha",
      "category": "Hébergement",
      "owner": "Rôle achats démo"
    },
    {
      "id": "ROLE-01",
      "kind": "role",
      "name": "Rôle RSSI démo",
      "category": "Responsable",
      "owner": "Organisation démo"
    },
    {
      "id": "PER-01",
      "kind": "perimeter",
      "name": "Activité pilote fictive",
      "category": "Activité",
      "owner": "Organisation démo"
    },
    {
      "id": "PROC-01",
      "kind": "process",
      "name": "Fournir le service fictif",
      "category": "Processus métier",
      "owner": "Rôle métier démo"
    },
    {
      "id": "SR-01",
      "kind": "source",
      "name": "Source intentionnelle A — FICTIF",
      "category": "Externe",
      "owner": ""
    },
    {
      "id": "SR-02",
      "kind": "source",
      "name": "Source intentionnelle B — FICTIF",
      "category": "Interne",
      "owner": ""
    },
    {
      "id": "OV-01",
      "kind": "objective",
      "name": "Entraver le service — FICTIF",
      "category": "Entrave",
      "owner": ""
    },
    {
      "id": "OV-02",
      "kind": "objective",
      "name": "Obtenir les informations — FICTIF",
      "category": "Information",
      "owner": ""
    }
  ],
  "scales": [
    {
      "id": "scale-1",
      "name": "Intégrité",
      "versions": [
        {
          "number": 1,
          "levels": [
            {
              "id": "level-1",
              "label": "Négligeable",
              "color": "#72bba4",
              "order": 1
            },
            {
              "id": "level-2",
              "label": "Limitée",
              "color": "#72bba4",
              "order": 2
            },
            {
              "id": "level-3",
              "label": "Critique",
              "color": "#72bba4",
              "order": 3
            }
          ]
        }
      ]
    },
    {
      "id": "scale-2",
      "name": "Confidentialité",
      "versions": [
        {
          "number": 1,
          "levels": [
            {
              "id": "level-1",
              "label": "Public",
              "color": "#72bba4",
              "order": 1
            },
            {
              "id": "level-2",
              "label": "Interne",
              "color": "#72bba4",
              "order": 2
            },
            {
              "id": "level-3",
              "label": "Restreint",
              "color": "#72bba4",
              "order": 3
            },
            {
              "id": "level-4",
              "label": "Confidentiel",
              "color": "#72bba4",
              "order": 4
            }
          ]
        }
      ]
    },
    {
      "id": "scale-3",
      "name": "Disponibilité",
      "versions": [
        {
          "number": 1,
          "levels": [
            {
              "id": "level-1",
              "label": "Négligeable",
              "color": "#72bba4",
              "order": 1
            },
            {
              "id": "level-2",
              "label": "Limitée",
              "color": "#72bba4",
              "order": 2
            },
            {
              "id": "level-3",
              "label": "Importante",
              "color": "#72bba4",
              "order": 3
            },
            {
              "id": "level-4",
              "label": "Critique",
              "color": "#72bba4",
              "order": 4
            }
          ]
        }
      ]
    },
    {
      "id": "scale-4",
      "name": "Gravité",
      "versions": [
        {
          "number": 1,
          "levels": [
            {
              "id": "level-1",
              "label": "G1 - Mineure",
              "color": "#009F8F",
              "order": 1
            },
            {
              "id": "level-2",
              "label": "G2 - Significative",
              "color": "#F6EB45",
              "order": 2
            },
            {
              "id": "level-3",
              "label": "G3 - Grave",
              "color": "#FF9A35",
              "order": 3
            },
            {
              "id": "level-4",
              "label": "G4 - Critique",
              "color": "#E73C50",
              "order": 4
            }
          ]
        }
      ]
    },
    {
      "id": "scale-5",
      "name": "Niveau d'impact",
      "versions": [
        {
          "number": 1,
          "levels": [
            {
              "id": "level-1",
              "label": "Mineure",
              "color": "#009F8F",
              "order": 1
            },
            {
              "id": "level-2",
              "label": "Significatif",
              "color": "#F6EB45",
              "order": 2
            },
            {
              "id": "level-3",
              "label": "Grave",
              "color": "#FF9A35",
              "order": 3
            },
            {
              "id": "level-4",
              "label": "Critique",
              "color": "#E73C50",
              "order": 4
            }
          ]
        }
      ]
    },
    {
      "id": "scale-6",
      "name": "Motivation",
      "versions": [
        {
          "number": 1,
          "levels": [
            {
              "id": "level-1",
              "label": "+",
              "color": "#72bba4",
              "order": 1
            },
            {
              "id": "level-2",
              "label": "++",
              "color": "#72bba4",
              "order": 2
            },
            {
              "id": "level-3",
              "label": "+++",
              "color": "#72bba4",
              "order": 3
            }
          ]
        }
      ]
    },
    {
      "id": "scale-7",
      "name": "Pertinence",
      "versions": [
        {
          "number": 1,
          "levels": [
            {
              "id": "level-1",
              "label": "Faible",
              "color": "#009F8F",
              "order": 1
            },
            {
              "id": "level-2",
              "label": "Moyenne",
              "color": "#FF9A35",
              "order": 2
            },
            {
              "id": "level-3",
              "label": "Élevée",
              "color": "#E73C50",
              "order": 3
            }
          ]
        }
      ]
    },
    {
      "id": "scale-8",
      "name": "Échelle des ressources",
      "versions": [
        {
          "number": 1,
          "levels": [
            {
              "id": "level-1",
              "label": "+",
              "color": "#72bba4",
              "order": 1
            },
            {
              "id": "level-2",
              "label": "++",
              "color": "#72bba4",
              "order": 2
            },
            {
              "id": "level-3",
              "label": "+++",
              "color": "#72bba4",
              "order": 3
            }
          ]
        }
      ]
    }
  ],
  "matrixVersions": [
    {
      "number": 1,
      "cells": [
        [
          1,
          1,
          2
        ],
        [
          1,
          2,
          3
        ],
        [
          2,
          3,
          3
        ]
      ],
      "reason": "Reprise structurelle ARM ; jeu fictif de maquette"
    }
  ],
  "studies": [
    {
      "id": "ETU-DEMO",
      "name": "Étude pilote — FICTIF",
      "scope": "PER-01",
      "owner": "ROLE-01",
      "method": "EBIOS RM",
      "matrixVersion": 1,
      "scaleVersions": {
        "scale-1": 1,
        "scale-2": 1,
        "scale-3": 1,
        "scale-4": 1,
        "scale-5": 1,
        "scale-6": 1,
        "scale-7": 1,
        "scale-8": 1
      },
      "validated": {},
      "created": "2026-10-14",
      "notes": {},
      "archived": false
    }
  ],
  "events": [
    {
      "id": "ER-DEMO",
      "studyId": "ETU-DEMO",
      "title": "Interruption du service — FICTIF",
      "valueId": "VM-01",
      "assetId": "AS-01",
      "criterion": "Disponibilité",
      "gravity": 3,
      "justification": "Conséquence fictive utilisée pour tester les relations du parcours."
    }
  ],
  "pairs": [
    {
      "id": "CP-DEMO",
      "studyId": "ETU-DEMO",
      "sourceId": "SR-01",
      "objectiveId": "OV-01",
      "resources": 3,
      "motivation": 2,
      "activity": "Présence supposée dans ce scénario fictif",
      "retained": "Oui",
      "justification": "Couple de démonstration retenu pour tester le parcours."
    },
    {
      "id": "CP-02",
      "studyId": "ETU-DEMO",
      "sourceId": "SR-02",
      "objectiveId": "OV-02",
      "resources": 2,
      "motivation": 2,
      "activity": "À documenter",
      "retained": "À examiner",
      "justification": ""
    }
  ],
  "strategies": [
    {
      "id": "SS-DEMO",
      "studyId": "ETU-DEMO",
      "pairId": "CP-DEMO",
      "eventId": "ER-DEMO",
      "supplierId": "SUP-01",
      "title": "Passage par une dépendance de démonstration",
      "description": "Scénario fictif pour illustrer les relations entre le couple et la conséquence."
    }
  ],
  "operations": [
    {
      "id": "SO-DEMO",
      "studyId": "ETU-DEMO",
      "strategyId": "SS-DEMO",
      "title": "Scénario opérationnel fictif",
      "likelihood": 3,
      "nodes": [
        "Observation du contexte",
        "Accès A fictif",
        "Accès B fictif",
        "Progression fictive",
        "Conséquence sur la valeur métier"
      ],
      "justification": "Valeur choisie pour tester la maquette ; aucune évaluation réelle."
    }
  ],
  "risks": [
    {
      "id": "R-DEMO",
      "studyId": "ETU-DEMO",
      "title": "Interruption du service fictif",
      "eventId": "ER-DEMO",
      "operationId": "SO-DEMO",
      "gravity": 3,
      "likelihood": 3,
      "justification": "Appréciation de démonstration selon la matrice de risque fictive.",
      "history": [],
      "decision": "À traiter",
      "decisionReason": "",
      "residual": null
    }
  ],
  "actions": [
    {
      "id": "ACT-DEMO",
      "title": "Vérifier la mesure fictive de sauvegarde",
      "owner": "Rôle DSI démo",
      "status": "Ouvert",
      "due": "2026-11-15",
      "riskId": "R-DEMO",
      "control": "8.13 · Sauvegarde des informations",
      "proofId": ""
    }
  ],
  "tasks": [
    {
      "id": "REC-DEMO",
      "title": "Revoir les habilitations fictives",
      "owner": "Rôle RSSI démo",
      "status": "À faire",
      "due": "2026-11-01",
      "frequency": "Mensuelle",
      "runs": []
    }
  ],
  "proofs": [
    {
      "id": "PRV-DEMO",
      "title": "Compte rendu de démonstration",
      "owner": "Rôle RSSI démo",
      "status": "Brouillon",
      "reference": "Document fictif, sans pièce réelle"
    }
  ],
  "records": {
    "objectives": [
      {
        "id": "OBJ-DEMO",
        "title": "Suivre la couverture de démonstration",
        "status": "En cours",
        "owner": "Rôle RSSI démo",
        "description": "Objectif fictif"
      }
    ],
    "audits": [
      {
        "id": "AUD-DEMO",
        "title": "Audit de démonstration",
        "status": "Planifié",
        "owner": "Rôle RSSI démo",
        "description": "Campagne fictive"
      }
    ],
    "incidents": [
      {
        "id": "INC-DEMO",
        "title": "Signalement fictif",
        "status": "Ouvert",
        "owner": "Rôle RSSI démo",
        "description": "Aucun incident réel"
      }
    ]
  },
  "imports": [],
  "history": [
    {
      "at": "2026-10-14T12:00:00Z",
      "action": "Jeu fictif initialisé",
      "detail": "Maquette autonome à valider ; aucune connexion au serveur métier."
    }
  ]
};

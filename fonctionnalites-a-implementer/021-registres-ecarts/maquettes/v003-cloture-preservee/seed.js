window.REGISTRES_SEED = {
  "schema": "astra-ecarts-1",
  "revision": 1,
  "scopes": [
    {
      "id": "PER-01",
      "title": "Hébergement santé — FICTIF"
    },
    {
      "id": "PER-02",
      "title": "SI interne — FICTIF"
    }
  ],
  "frameworks": [
    {
      "id": "ISO",
      "title": "ISO/IEC 27001",
      "version": "2022"
    },
    {
      "id": "HDS",
      "title": "HDS",
      "version": "Jeu de démonstration · édition à configurer"
    }
  ],
  "requirements": [
    {
      "id": "REQ-01",
      "frameworkId": "ISO",
      "code": "A.5.15",
      "title": "Contrôle des accès"
    },
    {
      "id": "REQ-02",
      "frameworkId": "ISO",
      "code": "A.8.13",
      "title": "Sauvegarde des informations"
    },
    {
      "id": "REQ-03",
      "frameworkId": "ISO",
      "code": "10.2",
      "title": "Non-conformité et actions correctives"
    },
    {
      "id": "REQ-04",
      "frameworkId": "HDS",
      "code": "DEMO-HDS-01",
      "title": "Exigence fictive à remplacer par la référence HDS applicable"
    }
  ],
  "applicability": [
    {
      "scopeId": "PER-01",
      "requirementId": "REQ-01",
      "applicable": true,
      "reason": "Périmètre de démonstration."
    },
    {
      "scopeId": "PER-01",
      "requirementId": "REQ-02",
      "applicable": true,
      "reason": "Périmètre de démonstration."
    },
    {
      "scopeId": "PER-01",
      "requirementId": "REQ-03",
      "applicable": true,
      "reason": "Périmètre de démonstration."
    },
    {
      "scopeId": "PER-01",
      "requirementId": "REQ-04",
      "applicable": true,
      "reason": "Périmètre de démonstration."
    },
    {
      "scopeId": "PER-02",
      "requirementId": "REQ-01",
      "applicable": true,
      "reason": "Périmètre de démonstration."
    },
    {
      "scopeId": "PER-02",
      "requirementId": "REQ-02",
      "applicable": true,
      "reason": "Périmètre de démonstration."
    },
    {
      "scopeId": "PER-02",
      "requirementId": "REQ-03",
      "applicable": true,
      "reason": "Périmètre de démonstration."
    }
  ],
  "audits": [
    {
      "id": "AUD-01",
      "title": "Audit de surveillance 2026 — FICTIF",
      "scopeId": "PER-01",
      "date": "2026-10-05"
    },
    {
      "id": "AUD-02",
      "title": "Audit interne SI — FICTIF",
      "scopeId": "PER-02",
      "date": "2026-10-08"
    }
  ],
  "registers": [
    {
      "id": "REG-001",
      "title": "Audit de surveillance 2026",
      "scopeId": "PER-01",
      "auditId": "AUD-01",
      "owner": "RSSI démo",
      "description": "Écarts relevés lors de la surveillance ISO 27001 / HDS.",
      "archived": false
    },
    {
      "id": "REG-002",
      "title": "Contrôles internes — SI",
      "scopeId": "PER-02",
      "auditId": "AUD-02",
      "owner": "Responsable SI démo",
      "description": "Suivi des constats des contrôles internes.",
      "archived": false
    },
    {
      "id": "REG-003",
      "title": "Revue trimestrielle des accès",
      "scopeId": "PER-01",
      "auditId": "",
      "owner": "RSSI démo",
      "description": "Constats hors audit, issus de la revue périodique.",
      "archived": false
    }
  ],
  "plans": [
    {
      "id": "PLAN-001",
      "title": "Remédiation surveillance 2026",
      "scopeIds": [
        "PER-01"
      ],
      "owner": "RSSI démo",
      "description": "Correction des écarts issus de la surveillance.",
      "archived": false
    },
    {
      "id": "PLAN-002",
      "title": "Programme transverse de sécurisation",
      "scopeIds": [
        "PER-01",
        "PER-02"
      ],
      "owner": "Responsable SI démo",
      "description": "Un plan pour plusieurs registres et périmètres.",
      "archived": false
    }
  ],
  "gaps": [
    {
      "id": "ECA-001",
      "registerId": "REG-001",
      "title": "Revue des habilitations incomplète",
      "description": "Certaines habilitations du périmètre fictif ne disposent pas de revue tracée.",
      "type": "NC mineure",
      "owner": "RSSI démo",
      "due": "2026-11-15",
      "requirementIds": [
        "REQ-01",
        "REQ-04"
      ],
      "status": "En traitement",
      "cause": "Processus de revue non formalisé.",
      "correction": "Revue immédiate des comptes concernés.",
      "closure": null
    },
    {
      "id": "ECA-002",
      "registerId": "REG-001",
      "title": "Test de restauration non documenté",
      "description": "Le dernier essai fictif ne dispose pas de compte rendu.",
      "type": "Point sensible",
      "owner": "Équipe SI démo",
      "due": "2026-11-30",
      "requirementIds": [
        "REQ-02"
      ],
      "status": "Ouvert",
      "cause": "",
      "correction": "",
      "closure": null
    },
    {
      "id": "ECA-003",
      "registerId": "REG-002",
      "title": "Accès de prestataire à réexaminer",
      "description": "Revue du compte de prestation de démonstration.",
      "type": "NC mineure",
      "owner": "Responsable SI démo",
      "due": "2026-11-20",
      "requirementIds": [
        "REQ-01"
      ],
      "status": "Ouvert",
      "cause": "",
      "correction": "",
      "closure": null
    },
    {
      "id": "ECA-004",
      "registerId": "REG-003",
      "title": "Responsable de revue à désigner",
      "description": "Désigner le propriétaire de la revue trimestrielle.",
      "type": "Observation",
      "owner": "RSSI démo",
      "due": "2026-12-01",
      "requirementIds": [
        "REQ-01"
      ],
      "status": "Ouvert",
      "cause": "",
      "correction": "",
      "closure": null
    }
  ],
  "actions": [
    {
      "id": "ACT-001",
      "planId": "PLAN-001",
      "scopeId": "PER-01",
      "title": "Formaliser et réaliser la revue des accès",
      "owner": "RSSI démo",
      "due": "2026-11-10",
      "status": "En cours",
      "gapIds": [
        "ECA-001"
      ],
      "requirementIds": [
        "REQ-01"
      ],
      "description": "Définir les responsables et conserver la revue.",
      "evidence": ""
    },
    {
      "id": "ACT-002",
      "planId": "PLAN-002",
      "scopeId": "PER-01",
      "title": "Désigner les responsables de revue",
      "owner": "RSSI démo",
      "due": "2026-11-18",
      "status": "À faire",
      "gapIds": [
        "ECA-001",
        "ECA-004"
      ],
      "requirementIds": [],
      "description": "Action commune à deux registres.",
      "evidence": ""
    },
    {
      "id": "ACT-003",
      "planId": "PLAN-002",
      "scopeId": "PER-02",
      "title": "Revoir les comptes des prestataires",
      "owner": "Responsable SI démo",
      "due": "2026-11-20",
      "status": "À faire",
      "gapIds": [
        "ECA-003"
      ],
      "requirementIds": [],
      "description": "Revue sur le périmètre SI interne.",
      "evidence": ""
    }
  ],
  "evaluations": [
    {
      "id": "EVAL-001",
      "scopeId": "PER-01",
      "requirementId": "REQ-01",
      "status": "Partiel",
      "reason": "Revue incomplète, écart ECA-001.",
      "evidence": "Constat de démonstration",
      "reviewer": "RSSI démo",
      "at": "2026-10-10T10:00:00Z",
      "revision": 1
    }
  ],
  "history": []
};

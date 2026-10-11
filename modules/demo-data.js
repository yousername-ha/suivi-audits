/* Jeu explicitement FICTIF, ajouté à la demande, sans comptes ni mots de passe. */
(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports
      ? require("./df-core")
      : root.LegacyDF,
    typeof module === "object" && module.exports
      ? require("./integration-core")
      : root.LegacyIntegration,
    typeof module === "object" && module.exports
      ? require("./risk-core")
      : root.LegacyRisks,
    typeof module === "object" && module.exports
      ? require("./pcra-core")
      : root.LegacyPCRA,
    typeof module === "object" && module.exports
      ? require("./journey-core")
      : root.LegacyJourney,
    typeof module === "object" && module.exports
      ? require("./finance-core")
      : root.LegacyFinance,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LegacyDemo = api;
})(
  typeof globalThis === "object" ? globalThis : this,
  function (C, I, R, P, J, F) {
    "use strict";
    const KEY = "horizon-fictif-v1";
    function build(state, author) {
      const s = C.clone(state);
      R.init(s);
      P.init(s);
      J.init(s);
      if (s.integration.demoDatasets?.includes(KEY))
        return { state: s, created: false };
      const before = new Set(
        Object.values(I.collections(s))
          .flat()
          .map((r) => r.id),
      );
      const g = I.perimeter(s, {
          name: "GHT Horizon (FICTIF)",
          type: "GHT",
          description:
            "Organisation de démonstration, sans lien avec un établissement réel.",
        }),
        a = I.perimeter(s, {
          name: "Centre Aurore (FICTIF)",
          type: "Support",
          parentId: g.id,
          description: "Établissement support de démonstration.",
        }),
        b = I.perimeter(s, {
          name: "Centre Rivage (FICTIF)",
          type: "Établissement",
          parentId: g.id,
          description: "Établissement partie de démonstration.",
        });
      I.perimeter(s, {
        name: "SI mutualisé Horizon (FICTIF)",
        type: "SI mutualisé",
        relatedIds: [a.id, b.id],
        description: "SI de démonstration partagé ; ne confère aucun droit.",
      });
      const roles = [
        [
          "RSSI de démonstration (FICTIF)",
          "Camille Exemple (FICTIF)",
          "Responsable sécurité",
        ],
        [
          "Métier de démonstration (FICTIF)",
          "Alex Exemple (FICTIF)",
          "Responsable des soins",
        ],
        [
          "PCRA de démonstration (FICTIF)",
          "Morgan Exemple (FICTIF)",
          "Coordination continuité",
        ],
      ].map(([name, holder, fun]) => {
        const r = {
          id: C.id("ROLE"),
          name,
          holder,
          function: fun,
          resp: "Responsabilité de démonstration explicitement fictive.",
          perimeterIds: [g.id],
          userIds: [],
          deputy: "",
          refs: [],
          email: "",
          phone: "",
        };
        s.roles.push(r);
        return r;
      });
      const responsible = { roleId: roles[0].id, userId: "" };
      a.responsible = responsible;
      b.responsible = { roleId: roles[2].id, userId: "" };
      const processes = [
        "Accueil et prise en charge des urgences",
        "Circuit de dispensation des médicaments",
      ].map((name) => {
        const p = {
          id: C.id("PROC"),
          name: name + " (FICTIF)",
          desc: "Processus de recette entièrement fictif.",
          owner: roles[1].name,
          responsible: { roleId: roles[1].id, userId: "" },
          perimeterIds: [a.id],
        };
        s.processes = s.processes || [];
        s.processes.push(p);
        return p;
      });
      const risks = [
        R.risk(s, {
          title: "Rançongiciel sur le dossier patient (FICTIF)",
          description:
            "Indisponibilité du dossier patient au Centre Aurore, continuité des soins en mode dégradé à organiser.",
          perimeterIds: [a.id],
          domain: "Soins / SI",
          responsible,
          reviewDate: "2030-09-01",
        }),
        R.risk(s, {
          title: "Perte des sauvegardes mutualisées (FICTIF)",
          description:
            "Perte de la capacité de restauration du SI partagé entre les deux établissements fictifs.",
          perimeterIds: [a.id, b.id],
          domain: "Sauvegarde",
          responsible,
        }),
        R.risk(s, {
          title: "Interruption de l’imagerie (FICTIF)",
          description:
            "Retard des examens au Centre Rivage et report vers une solution alternative.",
          perimeterIds: [b.id],
          domain: "Plateau technique",
          responsible,
        }),
      ];
      const policy = R.policy(s, {
        ...C.clone(R.DEFAULT_POLICY),
        title: "Politique Horizon de démonstration (FICTIF)",
        perimeterIds: [g.id],
      });
      const st1 = R.study(s, {
        title: "Étude EBIOS RM initiale Horizon (FICTIF)",
        date: "2026-09-15",
        perimeterIds: [g.id],
        riskIds: risks.map((r) => r.id),
        responsible,
        workshops: {
          0: "Activités de soins et SI mutualisé fictifs ; disponibilité prioritaire.",
          1: "Cybercriminel fictif visant l’extorsion.",
          2: "Propagation via un prestataire et des accès insuffisamment cloisonnés.",
          3: "Compromission d’un compte, déplacement latéral et chiffrement.",
          4: "Renforcement des accès, séparation des sauvegardes et exercices de reprise.",
        },
      });
      const sc = R.scenario(s, {
        title: "Compromission puis chiffrement (FICTIF)",
        description: "Scénario opérationnel de recette, aucune attaque réelle.",
        source: "Cybercriminel fictif",
        fearedEvent: "Interruption de la prise en charge",
        supportingAssets: "Dossier patient fictif et annuaire",
        type: "Opérationnel",
        studyId: st1.id,
        riskIds: [risks[0].id],
        perimeterIds: [a.id],
      });
      for (const [n, r] of risks.entries()) {
        const evaluation = R.assessment(
          s,
          {
            riskId: r.id,
            studyId: st1.id,
            policyId: policy.id,
            stage: "initial",
            date: "2026-09-15",
            impactId: n === 0 ? "I4" : "I3",
            likelihoodId: "V3",
            levelId: n === 2 ? "L2" : "L3",
            justification:
              "Appréciation de démonstration, à ne pas utiliser pour une décision réelle.",
            results: "Données de recette explicitement fictives.",
            scenarioIds: n === 0 ? [sc.id] : [],
          },
          author,
        );
        R.reference(s, r.id, evaluation.id);
      }
      const st2 = R.study(s, {
        title: "Réévaluation EBIOS RM Horizon (FICTIF)",
        date: "2026-10-11",
        perimeterIds: [g.id],
        riskIds: [risks[0].id],
        responsible,
        workshops: {
          0: "Même risque central, après travaux de démonstration.",
          4: "Nouvelle appréciation explicite après amélioration fictive.",
        },
      });
      const residual = R.assessment(
        s,
        {
          riskId: risks[0].id,
          studyId: st2.id,
          policyId: policy.id,
          stage: "residual",
          date: "2026-10-11",
          impactId: "I3",
          likelihoodId: "V1",
          levelId: "L2",
          justification:
            "Réévaluation fictive après amélioration des accès et exercice ; aucune clôture d’action ne modifie automatiquement le niveau.",
        },
        author,
      );
      R.reference(s, risks[0].id, residual.id);
      R.decision(
        s,
        {
          riskId: risks[0].id,
          assessmentId: residual.id,
          kind: "Accepter",
          date: "2026-10-11",
          validUntil: "2030-09-01",
          justification:
            "Acceptation de recette strictement fictive, sous revue périodique.",
        },
        author,
      );
      const tr = R.treatment(s, {
        riskId: risks[0].id,
        title: "Protection du dossier patient (FICTIF)",
        strategy: "Réduire",
        description:
          "Actions de démonstration : sécuriser les accès et exercer la reprise.",
        due: "2030-03-01",
        responsible,
      });
      const m = R.measure(s, {
        title: "Tester la reprise du dossier patient (FICTIF)",
        description:
          "Exercice de démonstration avec compte rendu et vérification du besoin métier.",
        treatmentId: tr.id,
        responsible,
        due: "2030-03-01",
      });
      R.action(s, m.id);
      const pp = P.policy(s, {
        ...C.clone(P.DEFAULT_POLICY),
        title: "Politique BIA Horizon (FICTIF)",
        perimeterIds: [g.id],
      });
      let bia = P.saveBia(s, {
        title: "BIA des soins Aurore (FICTIF)",
        perimeterIds: [a.id],
        policyId: pp.id,
        responsible: { roleId: roles[1].id, userId: "" },
        analysisDate: "2026-09-15",
        reviewDate: "2030-09-01",
        notes: "Démonstration sans données de patients.",
      });
      for (const [n, p] of processes.entries()) {
        bia = P.activity(s, bia.id, {
          name: p.name,
          processId: p.id,
          category: "Soins",
          minimumService: "Prise en charge urgente en mode dégradé (FICTIF)",
          humanNeeds: "Deux soignants et un coordinateur fictifs",
          materialNeeds: "Supports papier et moyens de communication fictifs",
          siNeeds: "Dossier patient fictif",
          buildingNeeds: "Zone de soins fictive",
          supplierNeeds: "Prestataire fictif",
          dependencies: "Circuit de médicaments fictif",
          workarounds: "Procédure papier de démonstration",
          justification: "Besoins établis uniquement pour la recette.",
          maxInterruptionHours: n ? 8 : 4,
          rtoBusinessHours: n ? 4 : 2,
          rpoBusinessHours: 1,
          impacts: Object.fromEntries(
            pp.horizons.map((h) => [
              h.id,
              Object.fromEntries(
                pp.dimensions.map((d) => [d.id, h.hours >= 24 ? "L4" : "L3"]),
              ),
            ]),
          ),
        });
      }
      P.validateBia(s, bia.id, author);
      const plan = P.savePlan(s, {
        kind: "PCA",
        title: "Continuité des soins Aurore (FICTIF)",
        biaId: bia.id,
        activityIds: bia.activities.map((a) => a.id),
        perimeterIds: [a.id],
        responsible,
        scenario: "Interruption du dossier patient fictif",
        activation: "Déclenchement de recette uniquement",
        procedure: "Procédure papier fictive puis reprise contrôlée",
        communication: "Circuit de communication de démonstration",
        resources: "Équipe et matériels fictifs",
        dependencies: "Pharmacie et dossier patient de démonstration",
        returnToNormal: "Contrôle de cohérence fictif avant reprise",
        technicalRtoHours: 2,
        technicalRpoHours: 1,
      });
      P.validatePlan(s, plan.id, author);
      const ex = P.exercise(s, {
        title: "Exercice de reprise Horizon (FICTIF)",
        planId: plan.id,
        date: "2026-10-11",
        type: "Sur table (FICTIF)",
        participants: "Participants fictifs",
        conduct: "Simulation de démonstration",
        results: "Résultats entièrement fictifs",
        retex: "Améliorer la coordination et les supports papier de recette",
        gaps: "Compléter le circuit de communication fictif",
        status: "Réalisé",
        actualRtoHours: 2,
        actualRpoHours: 1,
        responsible,
      });
      P.corrective(s, ex.id, {
        title: "Préciser les communications (FICTIF)",
        description: "Action corrective de démonstration",
        sourceKey: "communications",
        responsible,
        due: "2030-03-01",
      });
      // Toutes les nouvelles activités sont livrées dans une seule transaction serveur.
      bia.contentRevision = 1;
      bia.validation.contentRevision = 1;
      plan.biaRevision = 1;
      plan.validation.biaRevision = 1;
      const proof = F.save(s, {
        title: "Facture d’exercice Horizon (FICTIF)",
        type: "Facture",
        supplier: "Prestataire Démonstration (FICTIF)",
        number: "FACT-DEMO-001",
        issueDate: "2026-09-15",
        amountHT: "1200",
        amountTTC: "1440",
        perimeterIds: [a.id],
        careRequirementId: "D2.O1.C",
        responsible,
        notes: "Aucune dépense réelle, aucune éligibilité présumée.",
      });
      const fw = s.frameworks.find(
        (f) => f.dfKind === "CARE" && f.domain === "D2",
      );
      let dossier = null,
        journey = null;
      if (fw) {
        journey = J.create(s, {
          title: "Parcours CaRE D2 Aurore (FICTIF)",
          perimeterIds: [a.id],
          frameworkIds: [fw.id],
          responsible,
        });
        dossier =
          s.df.dossiers.find((d) => d.id === journey.dossierIds?.[0]) ||
          s.df.dossiers.find(
            (d) => d.frameworkId === fw.id && d.perimeterIds?.includes(a.id),
          );
        if (dossier) {
          dossier.title = "Suivi CaRE D2 Aurore (FICTIF)";
          const e = s.df.evaluations.find(
            (e) => e.dossierId === dossier.id && e.requirementId === "D2.O1.C",
          );
          if (e) {
            e.status = "En cours";
            e.notes =
              "BIA et PCA de démonstration reliés ; aucune validation ANS.";
            I.relate(
              s,
              { kind: "evaluation", id: e.id },
              { kind: "bia", id: bia.id },
            );
          }
        }
      }
      for (const rows of Object.values(I.collections(s)))
        for (const r of rows) if (!before.has(r.id)) r.demoDataset = KEY;
      s.integration.demoDatasets = I.unique([
        ...(s.integration.demoDatasets || []),
        KEY,
      ]);
      return {
        state: s,
        created: true,
        proofId: proof.id,
        biaId: bia.id,
        planId: plan.id,
        measureId: m.id,
        dossierId: dossier?.id,
        risks: risks.map((r) => r.id),
        studies: [st1.id, st2.id],
      };
    }
    function attachProof(s, info, version) {
      const ref = { evidenceId: info.proofId, versionId: version.id };
      for (const [kind, id] of [
        ["bia", info.biaId],
        ["continuity", info.planId],
        ["riskMeasure", info.measureId],
      ])
        if (id) {
          const r = I.object(s, { kind, id });
          r.proofRefs = I.unique([
            ...(r.proofRefs || []).map((x) => JSON.stringify(x)),
            JSON.stringify(ref),
          ]).map((x) => JSON.parse(x));
          I.relate(s, { kind: "proof", id: info.proofId }, { kind, id });
        }
      if (info.dossierId) {
        const e = s.df.evaluations.find(
          (e) =>
            e.dossierId === info.dossierId && e.requirementId === "D2.O1.C",
        );
        if (e) C.attachProof(s, e.id, info.proofId, version.id);
        const budget = C.upsertBudget(s, info.dossierId, null, {
          label: "Exercice PCRA (FICTIF)",
          year: 2026,
          planned: "1440",
          committed: "1440",
          spent: "1440",
          declared: "0",
          requested: "0",
          notified: "0",
          received: "0",
          notes: "Montants de démonstration ; aucune demande réelle.",
          proofRefs: [ref],
        });
        budget.perimeterIds = I.object(s, {
          kind: "proof",
          id: info.proofId,
        }).perimeterIds;
        budget.demoDataset = KEY;
      }
      return s;
    }
    return { KEY, build, attachProof };
  },
);

(function () {
  "use strict";
  const F = LegacyFinance,
    C = LegacyDF,
    I = LegacyIntegration;
  let U;
  function form(id) {
    const p = id ? I.object(U.state(), { kind: "proof", id }) : null,
      f = p?.financial || {};
    U.dialog(
      id ? "Justificatif financier" : "Ajouter une pièce comptable",
      U.field("title", "Titre", p?.title, "text", "required") +
        U.select("type", "Type de justificatif", F.TYPES, f.type || "Facture") +
        U.field("supplier", "Fournisseur / prestataire", f.supplier) +
        U.field("number", "Numéro de pièce", f.number) +
        U.field("issueDate", "Date de la pièce", f.issueDate, "date") +
        U.field(
          "paymentDate",
          "Date du paiement (si applicable)",
          f.paymentDate,
          "date",
        ) +
        U.field(
          "amountHT",
          "Montant HT (€)",
          C.amountInput(f.amountHT),
          "text",
          'inputmode="decimal"',
        ) +
        U.field(
          "amountTTC",
          "Montant TTC (€)",
          C.amountInput(f.amountTTC),
          "text",
          'inputmode="decimal"',
        ) +
        U.field("commitment", "Dépense / engagement concerné", f.commitment) +
        U.select(
          "careRequirementId",
          "Objectif CaRE concerné",
          U.state()
            .df.evaluations.filter((e) =>
              U.state().df.dossiers.some(
                (d) => d.id === e.dossierId && d.kind === "CARE",
              ),
            )
            .map((e) => ({
              value: e.requirementId,
              label: e.requirementId + " · " + e.requirement.title,
            })),
          f.careRequirementId,
        ) +
        U.scopes(p?.perimeterIds) +
        U.responsible(p?.responsible, p?.perimeterIds) +
        U.select(
          "classification",
          "Classification",
          ["PUBLIC", "INTERNE", "RESTREINT", "CONFIDENTIEL"],
          p?.classification || "RESTREINT",
        ) +
        U.area("notes", "Notes", f.notes) +
        '<label class="lx-field">Pièce physique (facultative au stade du brouillon, 20 Mo maximum)<input name="file" type="file"></label><p class="lx-muted">Les fichiers et les anciennes versions sont conservés dans le registre central des preuves. La présence d’un devis ou d’un justificatif de paiement n’est pas automatiquement obligatoire pour tous les objectifs.</p>',
      async (fd) => {
        const working = C.clone(U.state()),
          proof = F.save(
            working,
            {
              ...Object.fromEntries(fd),
              perimeterIds: fd.getAll("perimeterIds"),
              responsible: U.parseResponsible(fd),
            },
            id,
          ),
          file = fd.get("file");
        if (file?.size) await LegacyDFStore.deposit(working, proof.id, file);
        await U.mutate(() => U.api().replaceState(working));
      },
    );
  }
  function link(id) {
    const options = Object.entries(I.collections(U.state()))
      .filter(([kind]) =>
        [
          "budget",
          "evaluation",
          "action",
          "task",
          "bia",
          "continuity",
        ].includes(kind),
      )
      .flatMap(([kind, rows]) =>
        rows.map((x) => ({
          value: kind + "|" + x.id,
          label:
            kind +
            " · " +
            (x.label || x.title || x.text || x.requirementId || x.id),
        })),
      );
    U.dialog(
      "Rattacher le justificatif",
      U.select("ref", "Objet concerné", options),
      (fd) =>
        U.mutate((s) => {
          const [kind, rid] = (fd.get("ref") || "").split("|");
          F.attach(s, id, { kind, id: rid });
        }),
    );
  }
  function validation(id) {
    if (!LegacyServer.canValidate()) throw Error("Validation non autorisée.");
    U.dialog(
      "Examen interne du justificatif",
      U.select(
        "status",
        "Décision",
        [
          "À vérifier",
          "Acceptée en interne",
          "À corriger",
          "Refusée en interne",
        ],
        "À vérifier",
      ) +
        U.field("date", "Date", C.now().slice(0, 10), "date", "required") +
        U.area("comment", "Commentaire") +
        '<p class="lx-muted">Cette décision interne ne remplace pas l’examen de l’ANS.</p>',
      (fd) =>
        U.mutate((s) =>
          F.validate(s, id, {
            ...Object.fromEntries(fd),
            reviewer: LegacyServer.user().name,
          }),
        ),
    );
  }
  function view() {
    const rows = U.state()
      .evidences.filter((p) => p.financial)
      .filter(
        (p) =>
          !U.api().ui.financeQuery ||
          [p.title, p.financial.supplier, p.financial.number].some((v) =>
            v?.toLowerCase().includes(U.api().ui.financeQuery.toLowerCase()),
          ),
      );
    return (
      U.header(
        "Pièces comptables et justificatifs financiers",
        "Pièces, dépenses et objectifs CaRE reliés aux mêmes preuves.",
        U.button("Ajouter une pièce", "finance-new", "", true),
      ) +
      `<p class="lx-muted">Le guide ANS D2 des dépenses éligibles (1.0, 11 mars 2026) décrit notamment les bons de commande et factures pour les coûts externes, et les justificatifs de coûts internes. L’éligibilité reste examinée par l’ANS selon votre dossier et la version applicable.</p><label class="lx-field">Rechercher une pièce ou un fournisseur<input data-lx-query="financeQuery" data-ro-ok value="${U.esc(U.api().ui.financeQuery || "")}"></label>` +
      (rows.length
        ? `<div class="lx-table-wrap"><table class="lx-table"><thead><tr><th>Pièce</th><th>Établissements / fournisseur</th><th>Montants</th><th>Version / examen</th><th>Liens</th></tr></thead><tbody>${rows
            .map((p) => {
              const f = p.financial,
                v = p.dfVersions?.at(-1),
                val = v
                  ? C.proofValidation(U.state(), {
                      evidenceId: p.id,
                      versionId: v.id,
                    })
                  : null;
              return `<tr><td><strong>${U.esc(p.title)}</strong><small>${U.esc(f.type)} · ${U.esc(f.number || "Sans numéro")} · ${U.esc(f.issueDate || "Date à préciser")}</small>${U.button("Modifier", "finance-edit", `data-id="${p.id}"`)}</td><td>${U.esc(U.scopeLabel(p.perimeterIds))}<small>${U.esc(f.supplier)}</small></td><td>${U.esc(C.formatMoney(f.amountHT))} HT<small>${U.esc(C.formatMoney(f.amountTTC))} TTC</small></td><td>${v ? "v" + v.number : "Pièce à déposer"}<small>${U.esc(val?.status || "À vérifier")}</small>${U.button("Versions / fichier", "finance-proof", `data-id="${p.id}"`)}${LegacyServer.canValidate() ? U.button("Examiner", "finance-validate", `data-id="${p.id}"`) : ""}</td><td>${(p.objectRefs || []).length} objet(s)<small>${U.esc(f.careRequirementId || "Objectif à préciser")}</small>${U.button("Rattacher", "finance-link", `data-id="${p.id}"`)}</td></tr>`;
            })
            .join("")}</tbody></table></div>`
        : U.empty(
            "Aucun justificatif financier",
            "Ajoutez une pièce au registre commun puis rattachez-la au budget, à une action ou à une exigence.",
          ))
    );
  }
  LegacyIntegrationUI.register({
    install: (u) => {
      U = u;
      U.api().TABS.push({
        id: "finance",
        label: () => "Pièces comptables",
        view,
      });
    },
    extendNav: (nav) => {
      nav
        .find((x) => x.id === "care")
        ?.items.push({
          id: "care-finance",
          label: "Pièces comptables et financières",
          tab: "finance",
        });
      return nav;
    },
    readActions: ["finance-proof"],
    click: async (act, el) => {
      if (act === "finance-new") form();
      else if (act === "finance-edit") form(el.dataset.id);
      else if (act === "finance-proof") U.api().df.openProof(el.dataset.id);
      else if (act === "finance-link") link(el.dataset.id);
      else if (act === "finance-validate") validation(el.dataset.id);
      else return false;
      return true;
    },
  });
})();

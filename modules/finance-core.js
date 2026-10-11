(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports
      ? require("./df-core")
      : root.LegacyDF,
    typeof module === "object" && module.exports
      ? require("./integration-core")
      : root.LegacyIntegration,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LegacyFinance = api;
})(typeof globalThis === "object" ? globalThis : this, function (C, I) {
  "use strict";
  const TYPES = [
    "Devis",
    "Bon de commande",
    "Facture",
    "Justificatif de paiement",
    "État financier",
    "Coût interne",
    "Autre justificatif",
  ];
  function save(s, f, id) {
    I.init(s);
    const existing = id ? I.object(s, { kind: "proof", id }) : null;
    const financial = {
      ...(existing?.financial || {}),
      type: f.type || "Facture",
      supplier: C.cleanText(f.supplier || "", 500),
      number: C.cleanText(f.number || "", 150),
      issueDate: C.date(f.issueDate || ""),
      paymentDate: C.date(f.paymentDate || ""),
      amountHT: C.parseMoney(f.amountHT),
      amountTTC: C.parseMoney(f.amountTTC),
      commitment: C.cleanText(f.commitment || ""),
      careRequirementId: C.cleanText(f.careRequirementId || "", 100),
      validation: existing?.financial?.validation || null,
      notes: C.cleanText(f.notes || ""),
    };
    if (!TYPES.includes(financial.type))
      throw Error("Type de pièce comptable invalide.");
    if (financial.amountTTC < financial.amountHT)
      throw Error("Le montant TTC ne peut pas être inférieur au HT.");
    if (!f.perimeterIds?.length)
      throw Error("Choisissez les périmètres couverts par la pièce.");
    const title = C.required(f.title, "Le titre");
    for (const id of f.perimeterIds) I.object(s, { kind: "perimeter", id });
    const p =
      existing ||
      C.createProof(s, {
        title,
        type: "Document",
        classification: f.classification || "RESTREINT",
        owner: f.owner || "",
      });
    const before = existing ? C.clone(existing) : null;
    p.title = title;
    p.category = "Pièces comptables et justificatifs financiers";
    p.financial = financial;
    p.perimeterIds = I.unique(f.perimeterIds);
    p.responsible = f.responsible || null;
    if (f.classification) p.classification = f.classification;
    C.log(s, "Justificatif financier", "evidence", p.id, before, p);
    return p;
  }
  function attach(s, evidenceId, ref) {
    const p = I.object(s, { kind: "proof", id: evidenceId }),
      v = p.dfVersions?.at(-1);
    if (!v) throw Error("Déposez une version physique avant rattachement.");
    const r = I.object(s, ref);
    if (ref.kind === "evaluation") C.attachProof(s, r.id, p.id, v.id);
    else {
      r.proofRefs = r.proofRefs || [];
      if (
        !r.proofRefs.some((x) => x.evidenceId === p.id && x.versionId === v.id)
      )
        r.proofRefs.push({ evidenceId: p.id, versionId: v.id });
    }
    I.relate(s, { kind: "proof", id: p.id }, ref);
    return r;
  }
  function validate(s, id, fields) {
    const p = I.object(s, { kind: "proof", id }),
      v = p.dfVersions?.at(-1);
    if (!v)
      throw Error(
        "Une pièce physique est requise pour examiner ce justificatif.",
      );
    C.validateProof(s, p.id, v.id, {
      status: fields.status,
      reviewer: fields.reviewer,
      date: fields.date,
      comment: fields.comment || "",
    });
    p.financial.validation = {
      versionId: v.id,
      status: fields.status,
      reviewer: fields.reviewer,
      date: C.date(fields.date),
      comment: fields.comment || "",
    };
    return p;
  }
  return { TYPES, save, attach, validate };
});

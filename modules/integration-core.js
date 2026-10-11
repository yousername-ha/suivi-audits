/* Fondations transversales du Legacy. Les actions, rôles et preuves restent dans leurs registres. */
(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports
      ? require("./df-core.js")
      : root.LegacyDF,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LegacyIntegration = api;
})(typeof globalThis === "object" ? globalThis : this, function (C) {
  "use strict";
  const TYPES = [
    "GHT",
    "Support",
    "Établissement",
    "Entité juridique",
    "Site",
    "Activité",
    "SI mutualisé",
  ];
  const unique = (xs) => [...new Set(xs || [])],
    find = (xs, id, label) => {
      const r = (xs || []).find((x) => x.id === id);
      if (!r) throw Error(label + " introuvable.");
      return r;
    };
  function init(s) {
    C.initialise(s);
    s.perimeters = s.perimeters || [];
    s.roles = s.roles || [];
    s.integration = s.integration || { schema: 1 };
    if (s.integration.schema !== 1)
      throw Error("Version des relations non reconnue.");
    for (const r of s.roles) {
      r.id = r.id || C.id("ROLE");
      r.perimeterIds = r.perimeterIds || [];
      r.userIds = r.userIds || [];
    }
    for (const p of s.perimeters) {
      p.perimeterIds = [p.id];
      p.relatedIds = p.relatedIds || [];
    }
    return s;
  }
  function descendants(s, id) {
    const ids = new Set([id]);
    let n;
    do {
      n = ids.size;
      for (const p of s.perimeters) if (ids.has(p.parentId)) ids.add(p.id);
    } while (n !== ids.size);
    return [...ids];
  }
  function perimeter(s, fields, id) {
    init(s);
    const old = id ? find(s.perimeters, id, "Périmètre") : null;
    const p = {
      ...(old || { id: C.id("PER"), createdAt: C.now() }),
      name: C.required(fields.name, "Le nom"),
      type: fields.type || "Établissement",
      internalId: old?.internalId || "",
      finessEJ: C.cleanText(fields.finessEJ || "", 9),
      finessEG: C.cleanText(fields.finessEG || "", 9),
      parentId: fields.parentId || "",
      description: C.cleanText(fields.description || ""),
      status: fields.status || "Actif",
      relatedIds: unique(fields.relatedIds),
      frameworkIds: unique(fields.frameworkIds),
      referentRoleIds: unique(fields.referentRoleIds),
      responsible: fields.responsible || null,
      updatedAt: C.now(),
    };
    if (!TYPES.includes(p.type)) throw Error("Type de périmètre inconnu.");
    if (!["Actif", "Brouillon", "Archivé"].includes(p.status))
      throw Error("Statut de périmètre invalide.");
    if (
      (p.finessEJ || p.finessEG) &&
      !["Support", "Établissement", "Entité juridique", "Site"].includes(p.type)
    )
      throw Error("Le FINESS ne concerne pas ce type de périmètre.");
    for (const f of [p.finessEJ, p.finessEG])
      if (f && !/^\d{9}$/.test(f)) throw Error("FINESS : 9 chiffres requis.");
    if (p.parentId) {
      find(s.perimeters, p.parentId, "Parent");
      if (descendants(s, p.id).includes(p.parentId))
        throw Error("Ce rattachement crée un cycle.");
    }
    for (const id of p.relatedIds)
      find(s.perimeters, id, "Périmètre mutualisé");
    for (const id of p.frameworkIds) find(s.frameworks, id, "Référentiel");
    checkResponsible(s, p.responsible, [p.id], true);
    p.perimeterIds = [p.id];
    const before = old ? C.clone(old) : null;
    if (old) Object.assign(old, p);
    else s.perimeters.push(p);
    C.log(s, old ? "Modification" : "Création", "perimeter", p.id, before, p);
    return old || p;
  }
  function linkEstablishment(s, establishmentId, perimeterId) {
    const e = object(s, { kind: "establishment", id: establishmentId }),
      p = object(s, { kind: "perimeter", id: perimeterId });
    if (
      !["Support", "Établissement", "Entité juridique", "Site"].includes(p.type)
    )
      throw Error(
        "Choisissez un établissement, une entité juridique ou un site.",
      );
    e.legacyName = e.legacyName || e.name;
    e.perimeterId = p.id;
    e.perimeterIds = [p.id];
    e.name = p.name;
    e.syncedPerimeterName = p.name;
    relate(
      s,
      { kind: "establishment", id: e.id },
      { kind: "perimeter", id: p.id },
    );
    return e;
  }
  function sync(s) {
    init(s);
    for (const e of s.crrc?.establishments || []) {
      const p = s.perimeters.find((p) => p.id === e.perimeterId);
      if (!p) continue;
      if (
        e.syncedPerimeterName &&
        e.name !== e.syncedPerimeterName &&
        p.name === e.syncedPerimeterName
      )
        p.name = e.name;
      e.name = p.name;
      e.syncedPerimeterName = p.name;
      e.perimeterIds = [p.id];
    }
    for (const d of s.df.dossiers)
      if (d.perimeterIds?.length)
        d.scope = d.perimeterIds.map(
          (id) => s.perimeters.find((p) => p.id === id)?.name || id,
        );
    return s;
  }
  function roleLabel(r, users = []) {
    const member = users.filter(
      (u) => (r.userIds || []).includes(u.id) || u.roleIds?.includes(r.id),
    );
    return [
      r.holder ||
        member.map((u) => u.name).join(", ") ||
        "Titulaire à désigner",
      r.function || "",
      r.name,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  function responsibles(s, ids = [], users = []) {
    init(s);
    return s.roles
      .filter(
        (r) =>
          !ids.length ||
          !r.perimeterIds.length ||
          ids.some((id) =>
            r.perimeterIds.some((root) => descendants(s, root).includes(id)),
          ),
      )
      .flatMap((r) => {
        const members = users.filter(
          (u) =>
            u.active &&
            ((r.userIds || []).includes(u.id) || u.roleIds?.includes(r.id)) &&
            (!ids.length ||
              ids.every(
                (id) =>
                  u.permission === "admin" ||
                  u.perimeterIds.some((root) =>
                    descendants(s, root).includes(id),
                  ),
              )),
        );
        return members.length
          ? members.map((u) => ({
              value: r.id + "|" + u.id,
              label: [u.name, r.function || "", r.name]
                .filter(Boolean)
                .join(" · "),
              roleId: r.id,
              userId: u.id,
            }))
          : [
              {
                value: r.id + "|",
                label: roleLabel(r) + " · compte non affecté",
                roleId: r.id,
                userId: "",
              },
            ];
      });
  }
  function checkResponsible(s, ref, ids, allowNew = false) {
    if (!ref) return;
    const r = find(s.roles, ref.roleId, "Rôle");
    if (
      ids.length &&
      r.perimeterIds.length &&
      !allowNew &&
      !ids.every((id) =>
        r.perimeterIds.some((root) => descendants(s, root).includes(id)),
      )
    )
      throw Error("Ce rôle ne couvre pas le périmètre.");
  }
  function collections(s) {
    init(s);
    return {
      risk: s.riskMgmt?.risks || [],
      riskStudy: s.riskMgmt?.studies || [],
      riskAssessment: s.riskMgmt?.assessments || [],
      riskScenario: s.riskMgmt?.scenarios || [],
      riskTreatment: s.riskMgmt?.treatments || [],
      riskMeasure: s.riskMgmt?.measures || [],
      riskDecision: s.riskMgmt?.decisions || [],
      riskPolicy: s.riskMgmt?.policies || [],
      control: s.items,
      action: s.findings,
      establishment: s.crrc?.establishments || [],
      proof: s.evidences,
      role: s.roles,
      perimeter: s.perimeters,
      process: s.processes || [],
      objective: s.objectives || [],
      indicator: s.indicators || [],
      incident: s.incidents || [],
      plan: s.plans || [],
      dossier: s.df.dossiers,
      evaluation: s.df.evaluations,
      budget: s.df.budgets,
      bia: s.pcra?.bias || [],
      continuity: s.pcra?.plans || [],
      exercise: s.pcra?.exercises || [],
      policy: s.pcra?.policies || [],
      journey: s.journey?.runs || [],
      task: s.journey?.tasks || [],
    };
  }
  function object(s, ref) {
    return find(collections(s)[ref.kind], ref.id, "Objet " + ref.kind);
  }
  function assign(s, ref, ids, responsible) {
    const r = object(s, ref);
    ids = unique(ids);
    for (const id of ids) find(s.perimeters, id, "Périmètre");
    checkResponsible(s, responsible, ids);
    r.perimeterIds = ids;
    if (responsible) {
      r.responsible = responsible;
      const role = find(s.roles, responsible.roleId, "Rôle");
      r.owner = role.name;
    }
    C.log(s, "Affectation", "relation", r.id, null, {
      perimeterIds: ids,
      responsible,
    });
    return r;
  }
  function relate(s, left, right) {
    const a = object(s, left),
      b = object(s, right);
    if (left.kind === right.kind && left.id === right.id)
      throw Error("Relation vers soi-même.");
    for (const [r, ref] of [
      [a, right],
      [b, left],
    ]) {
      r.objectRefs = r.objectRefs || [];
      if (!r.objectRefs.some((x) => x.kind === ref.kind && x.id === ref.id))
        r.objectRefs.push(C.clone(ref));
    }
    C.log(s, "Rattachement bidirectionnel", "relation", a.id, null, {
      left,
      right,
    });
  }
  function related(s, ref) {
    const r = object(s, ref);
    return (r.objectRefs || []).map((x) => ({ ...x, object: object(s, x) }));
  }
  function validate(s) {
    init(s);
    const ids = new Set();
    for (const p of s.perimeters) {
      if (ids.has(p.id)) throw Error("Périmètre dupliqué.");
      ids.add(p.id);
      if (p.parentId && !s.perimeters.some((x) => x.id === p.parentId))
        throw Error("Parent absent.");
      let seen = new Set(),
        cur = p;
      while (cur.parentId) {
        if (seen.has(cur.id)) throw Error("Cycle dans les périmètres.");
        seen.add(cur.id);
        cur = find(s.perimeters, cur.parentId, "Parent");
      }
    }
    return s;
  }
  return {
    TYPES,
    init,
    sync,
    linkEstablishment,
    validate,
    descendants,
    perimeter,
    roleLabel,
    responsibles,
    checkResponsible,
    collections,
    object,
    assign,
    relate,
    related,
    unique,
  };
});

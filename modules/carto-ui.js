/* Adaptation du canevas SVG historique, source : docs/cartographie/reference-beta-legacy.
   Les dispositions sont distinctes des objets métier et soumises au serveur local. */
(function () {
  "use strict";
  window.LegacyCartography = {
    install(ctx) {
      const {
        ui,
        esc,
        clone,
        brand,
        nowTs,
        todayFr,
        stamp,
        saveFile,
        touch,
        render,
        toast,
        askModal,
        openSheet,
        navDef,
        navGo,
        indState,
        dFr,
        ICONS,
        saveUI,
      } = ctx;
      const $ = (s, r = document) => r.querySelector(s),
        Core = LegacyCartographyCore;
      const source = ctx.getState,
        admin = () => LegacyServer.user()?.permission === "admin";
      const state = () => Core.scoped(source(), ui.mbScope, admin());
      const readOnly = () =>
        ctx.readOnly() ||
        !!Core.record(source(), ui.mbScope, mbView(), admin())?.restricted;
      const swotLatest = (id) =>
        state()
          .swots.filter((s) => s.process === id)
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      function scopeName() {
        return (
          source().perimeters.find((p) => p.id === ui.mbScope)?.name ||
          (ui.mbScope === "__legacy"
            ? "Contexte historique"
            : "Périmètres autorisés")
        );
      }
      function scopePicker() {
        const ps = source().perimeters || [];
        if (
          !["__all", "__legacy", ...ps.map((p) => p.id)].includes(ui.mbScope) ||
          (ui.mbScope === "__legacy" && !admin())
        )
          ui.mbScope = ps.length ? "__all" : "__legacy";
        return `<label class="mb-scope">Périmètre <select id="mbScope" data-ro-ok><option value="__all" ${ui.mbScope === "__all" ? "selected" : ""}>Tous les périmètres autorisés</option>${ps.map((p) => `<option value="${esc(p.id)}" ${ui.mbScope === p.id ? "selected" : ""}>${esc((p.internalId ? p.internalId + " · " : "") + p.name)}</option>`).join("")}${admin() ? `<option value="__legacy" ${ui.mbScope === "__legacy" ? "selected" : ""}>Contexte historique (administration)</option>` : ""}</select></label>${Core.record(source(), ui.mbScope, mbView(), admin())?.restricted ? '<p class="note">Certaines références ont changé de périmètre : cette disposition est en lecture seule. Demandez sa révision à un administrateur.</p>' : ""}`;
      }
      /* ---------- Cartographie (bêta) : éditeur de cartes Vue contexte / Vue processus ----------
   Séparation données métier / présentation : les objets (processus, parties intéressées, enjeux,
   applications, fournisseurs…) sont lus dans state() à chaque affichage ; mbStore() ne conserve que la
   présentation (positions, tailles, relations graphiques, masquages, versions). */
      const MB_C = {
        navy: "#0B2B55",
        blue: "#1677FF",
        blueSoft: "#EAF3FF",
        purple: "#7A4CE0",
        purpleSoft: "#F3EEFF",
        orange: "#E98A15",
        orangeSoft: "#FFF5E8",
        green: "#20A05A",
        greenSoft: "#EAF8F0",
        red: "#D84949",
        border: "#DDE5EF",
        text: "#102445",
        muted: "#66758F",
      };
      const MB_I = {
        shield:
          '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
        building:
          '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-5h6v5M8 10.5h.01M12 10.5h.01M16 10.5h.01M8 13.5h.01M12 13.5h.01M16 13.5h.01"/>',
        gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
        doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
        users:
          '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.6 14.1c3 .2 5.4 2.6 5.4 5.9"/>',
        alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
        target:
          '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12h.01"/>',
        app: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
        server:
          '<rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M8 7.5h.01M8 16.5h.01"/>',
        pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
        box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
        cloud:
          '<path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 9.6 4.2 4.2 0 0 0 7 18z"/>',
        ghost:
          '<circle cx="12" cy="12" r="9"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>',
        headset:
          '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
        cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
        chat: '<path d="M4 5h16v11H9l-5 4z"/>',
        cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h12L22 7H6.2"/>',
        compass:
          '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
        cycle:
          '<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
        tools:
          '<path d="M14.5 6.5a4 4 0 0 0 5 5l-8 8a2.1 2.1 0 0 1-3-3z"/><path d="M4 4l5 5M3 7l4-4"/>',
        layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
      };
      const MB_FAM = {
        Management: {
          k: "pil",
          l: "Processus de pilotage",
          sub: "Diriger, piloter et améliorer le système de management",
          ac: "#7A4CE0",
          soft: "#F1EAFF",
          lf: "#F8F5FF",
          ls: "#E2D7F9",
          ic: "compass",
        },
        Réalisation: {
          k: "rea",
          l: "Processus de réalisation",
          sub: "Concevoir, déployer et exploiter les services et usages",
          ac: "#1677FF",
          soft: "#EAF3FF",
          lf: "#F2F7FF",
          ls: "#D5E4FA",
          ic: "gear",
        },
        Support: {
          k: "sup",
          l: "Processus de support",
          sub: "Fournir les ressources et fonctions support",
          ac: "#1F9A57",
          soft: "#E5F6EC",
          lf: "#F1FAF4",
          ls: "#CBE9D6",
          ic: "tools",
        },
        "": {
          k: "oth",
          l: "Autres processus",
          sub: "Famille non renseignée dans la plateforme",
          ac: "#5D6B82",
          soft: "#EEF1F5",
          lf: "#F8F9FB",
          ls: "#DCE2EA",
          ic: "layers",
        },
      };
      const mbFam = (f) => MB_FAM[f] || MB_FAM[""];
      const MB_LANE_FAM = {
        pil: "Management",
        rea: "Réalisation",
        sup: "Support",
        oth: "",
      };
      const MB_T = {
        isms: { l: "pilotage" },
        scope: { l: "Périmètre", cont: 1 },
        lane: { l: "Zone de processus", cont: 1 },
        band: { l: "Bande d’enjeux", cont: 1 },
        zone: { l: "Zone hors périmètre", cont: 1 },
        process: { l: "Processus" },
        subprocess: { l: "Sous-processus" },
        stakeholder: {
          l: "Partie intéressée",
          ic: "users",
          fill: "#F8F5FF",
          stroke: "#DCCDF7",
          ac: "#7A4CE0",
          soft: "#EDE4FF",
        },
        external_issue: {
          l: "Enjeu externe",
          ic: "alert",
          fill: "#FFFFFF",
          stroke: "#F1D2A8",
          ac: "#E98A15",
          soft: "#FFF1DE",
        },
        internal_issue: {
          l: "Enjeu interne",
          ic: "target",
          fill: "#FFFFFF",
          stroke: "#F1D2A8",
          ac: "#C9700E",
          soft: "#FFF1DE",
        },
        application: {
          l: "Application / service",
          ic: "app",
          fill: "#FFFFFF",
          stroke: "#CFE0FA",
          ac: "#1677FF",
          soft: "#EAF3FF",
        },
        infrastructure: {
          l: "Infrastructure",
          ic: "server",
          fill: "#FFFFFF",
          stroke: "#CFE0FA",
          ac: "#1677FF",
          soft: "#EAF3FF",
        },
        site: {
          l: "Site",
          ic: "pin",
          fill: "#FFFFFF",
          stroke: "#CFE0FA",
          ac: "#1677FF",
          soft: "#EAF3FF",
        },
        supplier: {
          l: "Fournisseur",
          ic: "box",
          fill: "#F8F5FF",
          stroke: "#DCCDF7",
          ac: "#7A4CE0",
          soft: "#EDE4FF",
        },
        missing: {
          l: "Objet indisponible",
          ic: "ghost",
          fill: "#F4F5F7",
          stroke: "#C4CAD4",
          ac: "#98A2B3",
          soft: "#E9ECF1",
        },
      };
      const MB_E = {
        part_of: { l: "Fait partie du pilotage", st: "primary", dir: 1 },
        flows_to: { l: "Flux principal", st: "primary", dir: 1 },
        depends_on: { l: "Dépendance", st: "dependency", dir: 1 },
        supports: { l: "Supporte", st: "dependency", dir: 1 },
        interacts_with: { l: "Interaction", st: "secondary", dir: 0 },
        impacts: { l: "Impacte", st: "issue", dir: 1 },
        applies_to: { l: "S’applique à", st: "secondary", dir: 1 },
        contains: { l: "Contient", st: "structural", dir: 1 },
        related_to: { l: "Lié à", st: "secondary", dir: 0 },
      };
      const MB_ES = {
        primary: { c: "#1677FF", w: 1.9, d: "", m: "b" },
        dependency: { c: "#1677FF", w: 1.5, d: "6 5", m: "b" },
        secondary: { c: "#93A3BA", w: 1.3, d: "4 5", m: "g" },
        issue: { c: "#E98A15", w: 1.5, d: "5 5", m: "o" },
        structural: { c: "#8DA2C0", w: 1.3, d: "2 4", m: "g" },
      };
      const MB = {
        at: {},
        sRef: null,
        work: {},
        dirty: {},
        undo: {},
        redo: {},
        vp: {},
        sel: null,
        edit: false,
        link: null,
        q: "",
        drag: null,
        raf: 0,
        objs: null,
        info: false,
        full: false,
      };

      const mbView = () => (ui.mbView === "process" ? "process" : "context");
      const mbHash = (s) => {
        let h = 5381;
        for (const c of String(s)) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
        return (h >>> 0).toString(36);
      };
      const mbDt = (x) => {
        const d = new Date(x);
        return isNaN(d)
          ? String(x || "")
          : d.toLocaleDateString("fr-FR") +
              " à " +
              d.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              });
      };
      const mbYes = (v) =>
        !!v && !/^(non|no|false|0|-)$/i.test(String(v).trim());
      function mbStore() {
        return new Proxy(
          {},
          {
            get(_t, view) {
              return Core.record(source(), ui.mbScope, view, admin());
            },
            set(_t, view, layout) {
              if (readOnly()) throw Error("Cartographie en lecture seule.");
              Core.save(source(), ui.mbScope, view, layout, admin());
              return true;
            },
          },
        );
      }
      function mbClean(m) {
        m = m || {};
        return {
          nodes: m.nodes || {},
          edges: m.edges || [],
          hide: m.hide || {},
          ignored: m.ignored || {},
          issueKind: m.issueKind || {},
        };
      }
      function mbWork(v) {
        v = v || mbView();
        if (MB.sRef !== source() || MB.scopeKey !== ui.mbScope) {
          MB.sRef = source();
          MB.scopeKey = ui.mbScope;
          MB.vp = {};
          MB.edit = false;
          MB.link = null;
          MB.work = {};
          MB.dirty = {};
          MB.undo = {};
          MB.redo = {};
          MB.at = {};
          MB.sel = null;
        }
        const s = (mbStore() || {})[v],
          at = (s && s.updatedAt) || "";
        if (MB.work[v] === undefined || (!MB.dirty[v] && at !== MB.at[v])) {
          MB.work[v] = s && s.nodes ? mbClean(clone(s)) : null;
          MB.at[v] = at;
        }
        return MB.work[v];
      }
      function mbProcIcon(name) {
        const n = String(name || "").toLowerCase();
        return /infra/.test(n)
          ? "server"
          : /support/.test(n)
            ? "headset"
            : /projet|concevoir|développ/.test(n)
              ? "doc"
              : /usage|déploy/.test(n)
                ? "users"
                : /formation/.test(n)
                  ? "cap"
                  : /communi/.test(n)
                    ? "chat"
                    : /ressources humaines|\brh\b/.test(n)
                      ? "users"
                      : /achat|conformit/.test(n)
                        ? "cart"
                        : /amélioration/.test(n)
                          ? "cycle"
                          : /pilot|diriger|direction/.test(n)
                            ? "compass"
                            : "gear";
      }
      function mbIssueKindAuto(label) {
        return /menace|cyber|réglement|reglement|législ|legisl|loi|climat|confiance|écosyst|ecosyst|exigences des|attentes|marché|concurren|géopolit|tutelle|ars\b|ans\b|cnil/i.test(
          label,
        )
          ? "ext"
          : "int";
      }
      function mbLines(v) {
        return (Array.isArray(v) ? v : String(v || "").split(/\n|;/))
          .map((x) =>
            String(x)
              .replace(/^[-•*\s]+/, "")
              .trim(),
          )
          .filter(Boolean);
      }

      /* Objets métier lus dans la plateforme */
      function mbObjects() {
        const data = state(),
          latest = new Map();
        for (const sw of data.swots)
          if (
            !latest.has(sw.process) ||
            String(sw.date) > String(latest.get(sw.process).date)
          )
            latest.set(sw.process, sw);
        const M = new Map(),
          b = brand(),
          sc = data.scope || {},
          inSc = new Set(sc.processes || []),
          scDef = inSc.size > 0,
          add = (o) => {
            M.set(o.ref, o);
            return o;
          };
        const kinds = mbWork()?.issueKind || {};
        add({
          ref: "isms",
          type: "isms",
          name: "Pilotage – " + b.org,
          sub: "Activités et référentiels de l’organisation",
        });
        add({
          ref: "scope",
          type: "scope",
          name: scopeName(),
          sub: sc.statement
            ? String(sc.statement)
            : "Organisation et activités",
          data: sc,
          scDef,
        });
        const objOf = (id) =>
          (data.objectives || []).filter((o) =>
            (o.processes || []).includes(id),
          );
        (data.processes || []).forEach((p) => {
          const parent =
            p.parent ||
            (String(p.id).includes(".") ? String(p.id).split(".")[0] : "");
          const scp = scDef
            ? inSc.has(p.id) || (parent && inSc.has(parent))
              ? "in"
              : "out"
            : "unk";
          const ob = objOf(p.id),
            ind = (data.indicators || []).filter((i) =>
              ob.some((o) => o.id === i.obj),
            ),
            ko = ind.filter((i) => indState(i).st === "ko").length;
          add({
            ref: "process:" + p.id,
            type: parent ? "subprocess" : "process",
            code: p.internalId || p.id,
            name: p.name || p.id,
            owner: p.owner || "",
            family: p.family || "",
            parent: parent ? "process:" + parent : "",
            scope: scp,
            ic: mbProcIcon(p.name),
            nObj: ob.length,
            nInd: ind.length,
            nKo: ko,
            data: p,
          });
        });
        (data.interested || []).forEach((p) =>
          add({
            ref: "pi:" + p.id,
            type: "stakeholder",
            name: p.name || "Partie intéressée",
            sub: p.cat || p.type || "",
            ext: p.type !== "Interne",
            owner: p.owner || "",
            data: p,
          }),
        );
        const addIssue = (label, desc, kind, src, procs) => {
          label = String(label || "").trim();
          if (!label) return;
          const ref = "issue:" + mbHash(label.toLowerCase());
          let o = M.get(ref);
          if (!o) {
            const k = kinds[ref] || kind;
            o = add({
              ref,
              type: k === "ext" ? "external_issue" : "internal_issue",
              name: label,
              sub: desc || "",
              src: [],
              procs: new Set(),
              auto: kind,
            });
          }
          o.src.push(src);
          (procs || []).forEach((p) => o.procs.add(p));
          if (desc && !o.sub) o.sub = desc;
        };
        (data.objectives || []).forEach((ob) =>
          (ob.enjeux || []).forEach((e) => {
            const s = String(e),
              i = s.indexOf(":");
            const label = i > 0 && i < 70 ? s.slice(0, i).trim() : s,
              desc = i > 0 && i < 70 ? s.slice(i + 1).trim() : "";
            addIssue(
              label,
              desc,
              mbIssueKindAuto(label),
              { k: "obj", id: ob.id, l: ob.id + " — " + ob.name },
              ob.processes || [],
            );
          }),
        );
        (data.processes || []).forEach((p) => {
          const s = latest.get(p.id);
          if (!s) return;
          [
            ["S", "int", "Force"],
            ["W", "int", "Faiblesse"],
            ["O", "ext", "Opportunité"],
            ["T", "ext", "Menace"],
          ].forEach(([q, kind, l]) =>
            (s[q] || []).forEach((t) =>
              addIssue(
                t,
                l + " — SWOT " + p.id,
                kind,
                {
                  k: "swot",
                  id: s.id,
                  proc: p.id,
                  q,
                  l:
                    "SWOT " +
                    p.id +
                    " (" +
                    l.toLowerCase() +
                    ", " +
                    (typeof dFr === "function" ? dFr(s.date) : s.date) +
                    ")",
                },
                [p.id],
              ),
            ),
          );
        });
        const supByName = new Map(
          (data.suppliers || []).map((s) => [
            String(s.name || "").toLowerCase(),
            s,
          ]),
        );
        (data.suppliers || []).forEach((s) => {
          const hds = mbYes(s.hds),
            crit = mbYes(s.critical);
          add({
            ref: "sup:" + s.id,
            type: "supplier",
            name: s.name || s.id,
            sub:
              [
                s.saas ? "SaaS" : "",
                hds ? "Hébergeur HDS" : "",
                crit ? "Critique" : "",
              ]
                .filter(Boolean)
                .join(" · ") ||
              s.rattachement ||
              "Fournisseur",
            crit,
            hds,
            saas: !!s.saas,
            data: s,
            ic: s.saas ? "cloud" : "box",
          });
        });
        (data.appGaps || []).forEach((a) => {
          const sp = supByName.get(String(a.supplier || "").toLowerCase());
          const scp =
            a.status === "Intégrée"
              ? "in"
              : a.status === "Écartée"
                ? "out"
                : "unk";
          add({
            ref: "app:" + a.id,
            type: "application",
            name: a.name || a.id,
            sub: [a.supplier, a.status].filter(Boolean).join(" · "),
            scope: scp,
            supRef: sp ? "sup:" + sp.id : "",
            owner: a.owner || "",
            data: a,
            scopeLabel: scp === "unk" ? a.status || "À étudier" : "",
          });
        });
        mbLines(sc.sites).forEach((l) =>
          add({
            ref: "site:" + mbHash(l.toLowerCase()),
            type: "site",
            name: l,
            sub: "Site du périmètre",
            scope: "in",
          }),
        );
        mbLines(sc.systems).forEach((l) =>
          add({
            ref: "infra:" + mbHash(l.toLowerCase()),
            type: "infrastructure",
            name: l,
            sub: "Système du périmètre",
            scope: "in",
          }),
        );
        for (const o of M.values()) delete o.std;
        return M;
      }
      /* Relations métier dérivées des données (lecture seule sur la carte) */
      function mbRelations(M) {
        const R = [],
          r = (s, t, type, o) => {
            if (M.has(s) && M.has(t) && s !== t)
              R.push(
                Object.assign(
                  { s, t, type, der: 1, key: "d:" + s + ">" + t + ":" + type },
                  o || {},
                ),
              );
          };
        for (const o of M.values()) {
          if (o.type === "process" && o.scope !== "out")
            r(o.ref, "isms", "part_of");
          if (o.type === "subprocess") r(o.parent, o.ref, "contains");
          if (
            ["application", "infrastructure", "site"].includes(o.type) &&
            o.scope === "in"
          )
            r(o.ref, "isms", "part_of");
          if (o.type === "stakeholder") r(o.ref, "scope", "interacts_with");
          if (o.type === "supplier") r(o.ref, "scope", "supports");
          if (o.type === "application" && o.supRef)
            r(o.ref, o.supRef, "depends_on");
          if (o.type === "external_issue" || o.type === "internal_issue") {
            r(o.ref, "scope", "impacts");
            [...o.procs].forEach((p) =>
              r(o.ref, "process:" + p, "impacts", { sec: 1 }),
            );
          }
        }
        return R;
      }
      /* Objets propres à la carte (cadres) */
      function mbMapOnly(ref) {
        const [k, v] = String(ref).split(":");
        if (k === "lane") {
          const f = mbFam(MB_LANE_FAM[v]);
          return {
            ref,
            type: "lane",
            name: f.l,
            sub: f.sub,
            fam: MB_LANE_FAM[v],
            mapOnly: 1,
          };
        }
        if (k === "band")
          return {
            ref,
            type: "band",
            name: v === "ext" ? "Enjeux externes" : "Enjeux internes",
            kind: v,
            mapOnly: 1,
          };
        if (k === "zone")
          return {
            ref,
            type: "zone",
            name: "Hors périmètre",
            sub: "Objets de la plateforme non inclus dans le périmètre",
            mapOnly: 1,
          };
        return null;
      }
      function mbObj(ref) {
        return (MB.objs && MB.objs.get(ref)) || mbMapOnly(ref);
      }
      const mbIsCont = (o, n) =>
        !!o &&
        ((MB_T[o.type] && MB_T[o.type].cont) ||
          (o.type === "process" && n && n.h >= 190));

      /* Tailles par défaut et dispositions automatiques */
      function mbDefSize(v, o) {
        if (!o) return { w: 200, h: 78 };
        if (v === "process")
          return o.type === "subprocess"
            ? { w: 220, h: 126 }
            : { w: 236, h: 156 };
        return o.type === "isms"
          ? { w: 300, h: 116 }
          : o.type === "process" || o.type === "subprocess"
            ? { w: 200, h: 96 }
            : /issue/.test(o.type)
              ? { w: 224, h: 76 }
              : o.type === "stakeholder" || o.type === "supplier"
                ? { w: 212, h: 66 }
                : { w: 200, h: 80 };
      }
      function mbLayoutContext(refs) {
        const P = {},
          objs = MB.objs,
          L = [...refs].map((r) => objs.get(r)).filter(Boolean),
          by = (f) => L.filter(f);
        const procIn = by(
          (o) =>
            (o.type === "process" || o.type === "subprocess") &&
            o.scope !== "out",
        ).sort((a, b) => String(a.code).localeCompare(String(b.code)));
        const assetsIn = by(
          (o) =>
            ["application", "infrastructure", "site"].includes(o.type) &&
            o.scope !== "out",
        );
        const outs = by(
          (o) =>
            [
              "process",
              "subprocess",
              "application",
              "infrastructure",
              "site",
            ].includes(o.type) && o.scope === "out",
        );
        const pis = by((o) => o.type === "stakeholder"),
          sups = by((o) => o.type === "supplier"),
          ext = by((o) => o.type === "external_issue"),
          int = by((o) => o.type === "internal_issue");
        const W = 200,
          H = 96,
          G = 18,
          pad = 28,
          C = Math.max(
            4,
            Math.min(6, Math.max(procIn.length, assetsIn.length) > 8 ? 6 : 5),
          );
        const rows = (n) => Math.ceil(n / C),
          SW = C * W + (C - 1) * G + 2 * pad;
        const prH = rows(procIn.length) * (H + G) - (procIn.length ? G : 0),
          asH = rows(assetsIn.length) * (80 + G) - (assetsIn.length ? G : 0);
        const scH =
          86 +
          (procIn.length ? prH + 56 : 0) +
          116 +
          (assetsIn.length ? 56 + asH : 0) +
          30;
        const colH = Math.max(scH, 420),
          fit = Math.max(4, Math.floor((colH + 16) / (66 + 16))),
          perCol = Math.max(
            fit,
            Math.ceil(Math.max(pis.length, sups.length) / 2),
          );
        const lc = Math.max(pis.length ? 1 : 0, Math.ceil(pis.length / perCol));
        const x0 = lc * (212 + 16) + (lc ? 44 : 0);
        const bandRows = (n) => Math.ceil(n / 4),
          bandH = (n) => 48 + bandRows(n) * (76 + 12);
        let y = 0;
        const band = (k, list) => {
          const bh = bandH(list.length);
          P["band:" + k] = { x: x0, y, w: SW, h: bh };
          const per = Math.min(4, Math.max(1, list.length)),
            cw = Math.floor((SW - 32 - (per - 1) * 14) / per);
          list.forEach((o, i) => {
            P[o.ref] = {
              x: x0 + 16 + (i % per) * (cw + 14),
              y: y + 44 + Math.floor(i / per) * (76 + 12),
              w: cw,
              h: 76,
            };
          });
          y += bh + 56;
        };
        if (ext.length) band("ext", ext);
        const sy = y;
        P.scope = { x: x0, y: sy, w: SW, h: scH };
        let iy = sy + 86;
        const row = (list, h) => {
          const n = list.length;
          list.forEach((o, i) => {
            const r = Math.floor(i / C),
              inRow = Math.min(C, n - r * C),
              rw = inRow * W + (inRow - 1) * G;
            P[o.ref] = {
              x: x0 + (SW - rw) / 2 + (i % C) * (W + G),
              y: iy + r * (h + G),
              w: W,
              h,
            };
          });
        };
        if (procIn.length) {
          row(procIn, H);
          iy += prH + 56;
        }
        P.isms = { x: x0 + (SW - 300) / 2, y: iy, w: 300, h: 116 };
        iy += 116;
        if (assetsIn.length) {
          iy += 56;
          row(assetsIn, 80);
        }
        y = sy + scH + 50;
        const placeOut = () => {
          if (!outs.length) return;
          const zr = Math.ceil(outs.length / C),
            zh = 44 + zr * (H + G);
          P["zone:out"] = { x: x0, y, w: SW, h: zh };
          outs.forEach((o, i) => {
            P[o.ref] = {
              x: x0 + pad + (i % C) * (W + G),
              y: y + 40 + Math.floor(i / C) * (H + G),
              w: W,
              h: H,
            };
          });
          y += zh + 50;
        };
        const colY = (n) =>
          sy + Math.max(0, (scH - (Math.min(n, perCol) * (66 + 16) - 16)) / 2);
        pis.forEach((o, i) => {
          const c = Math.floor(i / perCol),
            k = i % perCol;
          P[o.ref] = {
            x: (lc - 1 - c) * (212 + 16),
            y: colY(pis.length) + k * (66 + 16),
            w: 212,
            h: 66,
          };
        });
        sups.forEach((o, i) => {
          const c = Math.floor(i / perCol),
            k = i % perCol;
          P[o.ref] = {
            x: x0 + SW + 44 + c * (212 + 16),
            y: colY(sups.length) + k * (66 + 16),
            w: 212,
            h: 66,
          };
        });
        if (int.length) band("int", int);
        placeOut();
        return P;
      }
      function mbLayoutProcess(refs) {
        const P = {},
          objs = MB.objs,
          L = [...refs].map((r) => objs.get(r)).filter(Boolean);
        const top = L.filter((o) => o.type === "process").sort((a, b) =>
          String(a.code).localeCompare(String(b.code), "fr", { numeric: true }),
        );
        const kids = (p) =>
          L.filter((o) => o.type === "subprocess" && o.parent === p.ref).sort(
            (a, b) =>
              String(a.code).localeCompare(String(b.code), "fr", {
                numeric: true,
              }),
          );
        const orphans = L.filter(
          (o) => o.type === "subprocess" && !refs.has(o.parent),
        );
        const lanes = ["pil", "rea", "sup", "oth"]
          .map((k) => ({
            k,
            list: top
              .filter((o) => mbFam(o.family).k === k)
              .concat(k === "oth" ? orphans : []),
          }))
          .filter((l) => l.list.length);
        const GW = 44,
          pad = 28,
          CW = 236,
          CH = 156,
          SWd = 220,
          SH = 126;
        const itemW = (o) => {
            const c = kids(o);
            return c.length ? c.length * SWd + (c.length - 1) * 20 + 32 : CW;
          },
          itemH = (o) => (kids(o).length ? 92 + SH + 20 : CH);
        const LW = Math.max(
          940,
          ...lanes.map(
            (l) =>
              l.list.reduce((a, o) => a + itemW(o), 0) +
              (l.list.length - 1) * GW +
              2 * pad,
          ),
        );
        let y = 0;
        lanes.forEach((l) => {
          const h = 86 + Math.max(...l.list.map(itemH)) + 26;
          P["lane:" + l.k] = { x: 0, y, w: LW, h };
          let x = pad;
          l.list.forEach((o) => {
            const w = itemW(o),
              hh = itemH(o);
            P[o.ref] = { x, y: y + 86, w, h: hh };
            kids(o).forEach((c, i) => {
              P[c.ref] = {
                x: x + 16 + i * (SWd + 20),
                y: y + 86 + 82,
                w: SWd,
                h: SH,
              };
            });
            x += w + GW;
          });
          y += h + 70;
        });
        return P;
      }
      function mbProcessGenEdges(refs, opt) {
        const E = [],
          objs = MB.objs,
          L = [...refs]
            .map((r) => objs.get(r))
            .filter((o) => o && o.type === "process");
        const fam = (k) =>
          L.filter((o) => mbFam(o.family).k === k).sort((a, b) =>
            String(a.code).localeCompare(String(b.code), "fr", {
              numeric: true,
            }),
          );
        const id = () => "e" + Math.random().toString(36).slice(2, 9);
        if (opt.flows) {
          ["rea", "pil"].forEach((k) => {
            const f = fam(k);
            for (let i = 0; i + 1 < f.length; i++)
              E.push({
                id: id(),
                s: f[i].ref,
                t: f[i + 1].ref,
                type: "flows_to",
                gen: 1,
              });
          });
        }
        if (opt.lanes) {
          const rea = fam("rea");
          if (fam("sup").length)
            rea.forEach((o) =>
              E.push({
                id: id(),
                s: "lane:sup",
                t: o.ref,
                type: "supports",
                gen: 1,
              }),
            );
          if (fam("pil").length)
            rea.forEach((o) =>
              E.push({
                id: id(),
                s: "lane:pil",
                t: o.ref,
                type: "applies_to",
                gen: 1,
              }),
            );
        }
        return E;
      }

      /* Géométrie */
      const mbRect = (n) => ({ x: n.x, y: n.y, w: n.w, h: n.h });
      function mbBBox(nodes) {
        let x1 = 1e9,
          y1 = 1e9,
          x2 = -1e9,
          y2 = -1e9,
          k = 0;
        for (const n of nodes) {
          k++;
          x1 = Math.min(x1, n.x);
          y1 = Math.min(y1, n.y);
          x2 = Math.max(x2, n.x + n.w);
          y2 = Math.max(y2, n.y + n.h);
        }
        return k
          ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
          : { x: 0, y: 0, w: 800, h: 500 };
      }
      function mbAnch(a, b) {
        const ax = a.x + a.w / 2,
          ay = a.y + a.h / 2,
          bx = b.x + b.w / 2,
          by = b.y + b.h / 2,
          cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        const vg =
            b.y >= a.y + a.h
              ? b.y - (a.y + a.h)
              : a.y >= b.y + b.h
                ? a.y - (b.y + b.h)
                : -1,
          hg =
            b.x >= a.x + a.w
              ? b.x - (a.x + a.w)
              : a.x >= b.x + b.w
                ? a.x - (b.x + b.w)
                : -1;
        if (vg >= 0 && (hg < 0 || vg >= hg * 0.6)) {
          const dn = b.y >= a.y + a.h,
            o0 = Math.max(a.x, b.x),
            o1 = Math.min(a.x + a.w, b.x + b.w);
          let x1, x2;
          if (o1 - o0 >= 28) {
            x1 = x2 = cl(a.w <= b.w ? ax : bx, o0 + 14, o1 - 14);
          } else {
            x1 = cl(bx, a.x + 16, a.x + a.w - 16);
            x2 = cl(ax, b.x + 18, b.x + b.w - 18);
          }
          return {
            p1: [x1, dn ? a.y + a.h : a.y],
            p2: [x2, dn ? b.y : b.y + b.h],
            o: "v",
          };
        }
        if (hg >= 0) {
          const rt = b.x >= a.x + a.w,
            o0 = Math.max(a.y, b.y),
            o1 = Math.min(a.y + a.h, b.y + b.h);
          let y1, y2;
          if (o1 - o0 >= 20) {
            y1 = y2 = cl(a.h <= b.h ? ay : by, o0 + 10, o1 - 10);
          } else {
            y1 = cl(by, a.y + 12, a.y + a.h - 12);
            y2 = cl(ay, b.y + 14, b.y + b.h - 14);
          }
          return {
            p1: [rt ? a.x + a.w : a.x, y1],
            p2: [rt ? b.x : b.x + b.w, y2],
            o: "h",
          };
        }
        return { p1: [ax, a.y + a.h], p2: [bx, b.y], o: "v" };
      }
      function mbPath(an, ortho) {
        const [x1, y1] = an.p1,
          [x2, y2] = an.p2;
        if (Math.abs(x1 - x2) < 1.5 || Math.abs(y1 - y2) < 1.5)
          return `M${x1} ${y1}L${x2} ${y2}`;
        if (!ortho) {
          if (an.o === "v") {
            const m = (y2 - y1) / 2;
            return `M${x1} ${y1}C${x1} ${y1 + m} ${x2} ${y2 - m} ${x2} ${y2}`;
          }
          const m = (x2 - x1) / 2;
          return `M${x1} ${y1}C${x1 + m} ${y1} ${x2 - m} ${y2} ${x2} ${y2}`;
        }
        const r = Math.min(10, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2),
          sx = Math.sign(x2 - x1),
          sy = Math.sign(y2 - y1);
        if (an.o === "v") {
          const ym = (y1 + y2) / 2;
          return `M${x1} ${y1}V${ym - sy * r}Q${x1} ${ym} ${x1 + sx * r} ${ym}H${x2 - sx * r}Q${x2} ${ym} ${x2} ${ym + sy * r}V${y2}`;
        }
        const xm = (x1 + x2) / 2;
        return `M${x1} ${y1}H${xm - sx * r}Q${xm} ${y1} ${xm} ${y1 + sy * r}V${y2 - sy * r}Q${xm} ${y2} ${xm + sx * r} ${y2}H${x2}`;
      }

      /* Rendu SVG */
      function mbWrap(t, maxW, fs, maxL, bold) {
        const n = Math.max(4, Math.floor(maxW / (fs * (bold ? 0.585 : 0.54)))),
          words = String(t || "")
            .split(/\s+/)
            .filter(Boolean),
          L = [];
        let cur = "";
        for (const w of words) {
          const c = cur ? cur + " " + w : w;
          if (c.length <= n) cur = c;
          else {
            if (cur) L.push(cur);
            cur = w.length > n ? w.slice(0, n - 1) + "…" : w;
          }
        }
        if (cur) L.push(cur);
        if (L.length > maxL) {
          const k = L.slice(0, maxL);
          let l = k[maxL - 1];
          if (l.length > n - 1) l = l.slice(0, n - 1);
          k[maxL - 1] = l.replace(/[\s,;:.–-]+$/, "") + "…";
          return k;
        }
        return L;
      }
      function mbTxt(x, y, lines, fs, fill, o) {
        o = o || {};
        if (!lines.length) return "";
        const lh = o.lh || Math.round(fs * 1.3);
        return `<text x="${x}" y="${y}" font-size="${fs}" fill="${fill}"${o.b ? ` font-weight="${o.b}"` : ""}${o.a ? ` text-anchor="${o.a}"` : ""}>${lines.map((l, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${esc(l)}</tspan>`).join("")}</text>`;
      }
      const mbIco = (k, x, y, s, c, sw) =>
        `<g transform="translate(${x} ${y}) scale(${s / 24})" fill="none" stroke="${c}" stroke-width="${sw || 1.8}" stroke-linecap="round" stroke-linejoin="round">${MB_I[k] || MB_I.layers}</g>`;
      const MB_CHIP = {
        in: ["#E6F6EC", "#1B7F47"],
        out: ["#EEF1F5", "#5D6B82"],
        unk: ["#FFF1DE", "#B45F06"],
        blue: ["#EAF3FF", "#1662D6"],
        hds: ["#F1EAFF", "#6A3FD0"],
        bad: ["#FDECEC", "#C2312A"],
        gen: ["#FFF1DE", "#B45F06"],
      };
      const mbChipW = (l, k) =>
        Math.round(String(l).length * 5.85 + (k === "in" ? 27 : 16));
      function mbChip(x, y, l, k) {
        const P = MB_CHIP[k] || MB_CHIP.out,
          w = mbChipW(l, k);
        return `<rect x="${x}" y="${y}" width="${w}" height="18" rx="9" fill="${P[0]}"/>${k === "in" ? `<circle cx="${x + 10}" cy="${y + 9}" r="5.2" fill="${P[1]}"/><path d="M${x + 7.5} ${y + 9.2}l1.8 1.8 3.1-3.3" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ""}<text x="${x + (k === "in" ? 19 : 8)}" y="${y + 12.7}" font-size="10.5" font-weight="600" fill="${P[1]}">${esc(l)}</text>`;
      }
      const mbScopeChip = (o) =>
        o.scope === "in"
          ? ["Dans le périmètre", "in"]
          : o.scope === "out"
            ? ["Hors périmètre", "out"]
            : o.scope === "unk"
              ? [o.scopeLabel || "Périmètre à confirmer", "unk"]
              : null;
      function mbColors(o) {
        if (!o) return MB_T.missing;
        if (o.type === "process" || o.type === "subprocess") {
          const f = mbFam(o.family);
          return {
            fill: "#FFFFFF",
            stroke: o.type === "subprocess" ? "#C9D6E8" : f.ls,
            ac: f.ac,
            soft: f.soft,
            dash: o.type === "subprocess" ? "5 4" : "",
          };
        }
        return MB_T[o.type] || MB_T.missing;
      }
      function mbNodeSvg(ref, n, o, st) {
        const x = n.x,
          y = n.y,
          w = n.w,
          h = n.h;
        let s = "";
        if (!o) {
          const c = MB_T.missing;
          s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${c.fill}" stroke="${c.stroke}" stroke-dasharray="4 4"/>${mbIco("ghost", x + 14, y + (h - 22) / 2, 22, c.ac)}${mbTxt(x + 46, y + h / 2 - 4, mbWrap(n.label || ref, w - 56, 12, 1, 1), 12, "#5D6B82", { b: 700 })}${mbTxt(x + 46, y + h / 2 + 12, ["Objet indisponible"], 10.5, "#98A2B3")}`;
        } else if (o.type === "isms") {
          s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${MB_C.navy}" filter="url(#mbSh)"/>${mbIco("building", x + w / 2 - 13, y + 13, 26, "#FFFFFF", 1.7)}`;
          const t = mbWrap(o.name, w - 30, 15, 2, 1);
          s += mbTxt(x + w / 2, y + 60, t, 15, "#FFFFFF", {
            b: 700,
            a: "middle",
          });
          s += mbTxt(
            x + w / 2,
            y + 60 + t.length * 19 + 2,
            mbWrap(
              o.sub,
              w - 30,
              11.5,
              Math.max(
                1,
                Math.floor((h - (60 + t.length * 19 + 2) - 8) / 15) + 1,
              ),
            ),
            11.5,
            "#C3D3EC",
            { a: "middle" },
          );
        } else if (o.type === "scope") {
          const sd = (st.std || []).join(" / ") || "Aucun référentiel";
          s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="#F6FAFF" fill-opacity=".85" stroke="#6FA3F7" stroke-width="1.6" stroke-dasharray="8 6"/>${mbIco("shield", x + 22, y + 20, 26, MB_C.blue)}${mbTxt(x + 58, y + 38, ["Périmètre"], 17, MB_C.navy, { b: 700 })}${mbTxt(x + 58, y + 57, mbWrap(o.data && o.data.statement ? o.data.statement : "Certification " + sd, Math.max(200, w - 300), 12, 1), 12, MB_C.muted)}`;
          const cl = "Certification " + sd,
            cw = mbChipW(cl, "blue");
          s += mbChip(x + w - cw - 22, y + 24, cl, "blue");
          if (!o.scDef) {
            const l = "Processus du périmètre à préciser",
              lw = mbChipW(l, "unk");
            s += mbChip(x + w - lw - 22, y + 48, l, "unk");
          }
        } else if (o.type === "band") {
          const c = o.kind === "ext" ? "#C46A08" : "#B0630B";
          s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#FFF9F1" stroke="#F4DCB9"/>${mbTxt(x + 18, y + 29, [o.name], 15, c, { b: 700 })}`;
        } else if (o.type === "zone") {
          s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#F8F9FB" stroke="#CDD5DF" stroke-dasharray="6 5"/>${mbTxt(x + 16, y + 25, [o.name], 13, "#5D6B82", { b: 700 })}${mbTxt(x + 130, y + 25, [o.sub], 11.5, "#98A2B3")}`;
        } else if (o.type === "lane") {
          const f = mbFam(o.fam);
          s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${f.lf}" stroke="${f.ls}"/>${mbIco(f.ic, x + 22, y + 20, 30, f.ac, 2)}${mbTxt(x + 64, y + 40, [o.name], 19, f.ac === "#1677FF" ? "#1662D6" : f.ac, { b: 700 })}${mbTxt(x + 64, y + 62, [o.sub], 13, MB_C.muted)}`;
        } else {
          const c = mbColors(o),
            cont = mbIsCont(o, n),
            tall = !cont && w >= 180 && h >= 118,
            ic = o.ic || c.ic || "layers",
            chips = [];
          const sc = mbScopeChip(o);
          if (sc) chips.push(sc);
          if (o.type === "supplier" && o.hds) chips.push(["HDS", "hds"]);
          if (o.nKo)
            chips.push([
              o.nKo + " indicateur" + (o.nKo > 1 ? "s" : "") + " KO",
              "bad",
            ]);
          s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${cont ? 16 : 11}" fill="${cont ? "#FFFFFF" : c.fill}" stroke="${c.stroke}" stroke-width="1.2"${c.dash ? ` stroke-dasharray="${c.dash}"` : ""}${o.type === "process" || o.type === "isms" ? ' filter="url(#mbSh)"' : ""}/>`;
          const sub =
            o.type === "process" || o.type === "subprocess"
              ? st.view === "process"
                ? [
                    o.owner ? "Pilote : " + o.owner : "",
                    o.nObj
                      ? o.nObj +
                        " objectif" +
                        (o.nObj > 1 ? "s" : "") +
                        (o.nInd
                          ? " · " +
                            o.nInd +
                            " indicateur" +
                            (o.nInd > 1 ? "s" : "")
                          : "")
                      : "",
                  ]
                    .filter(Boolean)
                    .join("\n") || mbFam(o.family).l
                : mbFam(o.family).l
              : o.sub;
          if (tall || cont) {
            s += `<rect x="${x + 14}" y="${y + 14}" width="38" height="38" rx="10" fill="${c.soft}"/>${mbIco(ic, x + 22, y + 22, 22, c.ac)}`;
            let ty = y + 38;
            if (o.code) {
              s += mbTxt(x + 62, y + 30, [o.code], 12.5, c.ac, { b: 700 });
              ty = y + 30;
            }
            const tl = mbWrap(
              o.name,
              cont ? w - 80 : w - 28,
              14,
              cont ? 1 : 3,
              1,
            );
            if (cont) {
              s += mbTxt(x + 62, y + 50, tl, 14, MB_C.text, { b: 700 });
              ty = y + 50 + 16;
            } else {
              s += mbTxt(x + 14, y + 76, tl, 14, MB_C.text, { b: 700 });
              ty = y + 76 + tl.length * 18;
            }
            const sl = String(sub || "")
              .split("\n")
              .flatMap((l) =>
                mbWrap(l, cont ? w - 80 : w - 28, 12, cont ? 1 : 2),
              );
            if (sl.length && ty + 4 < y + h - 30) {
              s += mbTxt(
                cont ? x + 62 : x + 14,
                ty + (cont ? 0 : 2),
                sl.slice(
                  0,
                  cont ? 1 : Math.max(1, Math.floor((y + h - 30 - ty) / 15)),
                ),
                12,
                MB_C.muted,
              );
            }
            let cx = cont ? x + w - 14 : x + 14;
            chips.forEach(([l, k]) => {
              const cw = mbChipW(l, k);
              if (cont) {
                cx -= cw;
                s += mbChip(cx, y + 18, l, k);
                cx -= 6;
              } else if (cx + cw <= x + w - 8) {
                s += mbChip(cx, y + h - 28, l, k);
                cx += cw + 6;
              }
            });
          } else {
            const ix = x + 12,
              iy = y + Math.min(14, (h - 34) / 2);
            s += `<rect x="${ix}" y="${iy}" width="34" height="34" rx="9" fill="${c.soft}"/>${mbIco(ic, ix + 7, iy + 7, 20, c.ac)}`;
            const tx = x + 56,
              tw = w - 64;
            let ty = y + 20;
            if (o.code) {
              s += mbTxt(tx, ty, [o.code], 10.5, c.ac, { b: 700 });
              ty += 14;
            }
            const room = h - (ty - y) - (chips.length && h >= 74 ? 26 : 6),
              tl = mbWrap(
                o.name,
                tw,
                12.5,
                Math.max(1, Math.min(2, Math.floor(room / 16))),
                1,
              );
            s += mbTxt(tx, ty, tl, 12.5, MB_C.text, { b: 700, lh: 15 });
            ty += tl.length * 15;
            const left = y + h - (chips.length && h >= 74 ? 26 : 6) - ty;
            if (sub && left >= 10)
              s += mbTxt(
                tx,
                ty + 1,
                mbWrap(
                  String(sub).split("\n")[0],
                  tw,
                  11,
                  Math.max(1, Math.min(2, Math.floor(left / 14))),
                ),
                11,
                MB_C.muted,
                { lh: 13.5 },
              );
            if (chips.length && h >= 74) {
              let cx = tx;
              chips.forEach(([l, k]) => {
                const cw = mbChipW(l, k);
                if (cx + cw <= x + w - 6) {
                  s += mbChip(cx, y + h - 25, l, k);
                  cx += cw + 5;
                }
              });
            }
          }
        }
        if (st.hit)
          s += `<rect x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${h + 10}" rx="14" fill="none" stroke="#F5B400" stroke-width="3"/>`;
        if (st.sel)
          s += `<rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" rx="14" fill="none" stroke="#1677FF" stroke-width="2.4"/>`;
        if (st.src)
          s += `<rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" rx="14" fill="none" stroke="#20A05A" stroke-width="2.4" stroke-dasharray="6 4"/>`;
        if (st.sel && st.edit)
          s += `<rect data-h="${esc(ref)}" x="${x + w - 7}" y="${y + h - 7}" width="14" height="14" rx="3.5" fill="#FFFFFF" stroke="#1677FF" stroke-width="2" style="cursor:nwse-resize"/>`;
        return `<g class="mbn" data-n="${esc(ref)}"${st.dim ? ' opacity=".26"' : ""}><title>${esc(o ? (MB_T[o.type] || {}).l + " — " + o.name : "Objet indisponible — " + (n.label || ref))}</title>${s}</g>`;
      }
      const MB_DEFS = `<defs><filter id="mbSh" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#0B2B55" flood-opacity=".09"/></filter>${Object.entries(
        { b: "#1677FF", g: "#93A3BA", o: "#E98A15", s: "#0B57D0" },
      )
        .map(
          ([k, c]) =>
            `<marker id="mbA${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`,
        )
        .join("")}</defs>`;
      /* Calcul de la scène : nœuds visibles, arêtes visibles, atténuation */
      function mbScene(v, o) {
        o = o || {};
        const w = mbWork(v);
        if (!w) return { svg: "", nodes: [], edges: [] };
        const std = mbStdOn(),
          q = (o.export ? "" : MB.q || "").toLowerCase().trim(),
          pre = o.export ? "all" : mbPreset(v);
        const vis = [],
          dimSet = new Set(),
          hits = new Set();
        for (const [ref, n] of Object.entries(w.nodes)) {
          if (n.hidden) continue;
          const ob = mbObj(ref);
          if (
            ob &&
            !ob.mapOnly &&
            ob.std &&
            !ob.std.some((s) => std.includes(s)) &&
            !["isms", "scope"].includes(ob.type)
          )
            continue;
          vis.push([ref, n, ob]);
          if (!mbPresetMatch(v, pre, ref, ob)) dimSet.add(ref);
          if (
            q &&
            ob &&
            !ob.mapOnly &&
            (String(ob.name) + " " + (ob.code || "") + " " + (ob.sub || ""))
              .toLowerCase()
              .includes(q)
          )
            hits.add(ref);
        }
        if (q) {
          for (const [ref] of vis)
            if (!hits.has(ref) && !mbIsCont(mbObj(ref), w.nodes[ref]))
              dimSet.add(ref);
        }
        const on = new Map(vis.map(([r, n]) => [r, n]));
        const E = [];
        const rel = MB.objs ? mbRelations(MB.objs) : [];
        rel.forEach((e) => {
          if (!on.has(e.s) || !on.has(e.t) || w.hide[e.key]) return;
          if (e.sec && !ui.mbSec) return;
          if (e.type === "contains") {
            const a = on.get(e.s),
              b = on.get(e.t);
            if (
              b.x >= a.x &&
              b.y >= a.y &&
              b.x + b.w <= a.x + a.w &&
              b.y + b.h <= a.y + a.h
            )
              return;
          }
          if (e.t === "scope") {
            const a = on.get(e.s),
              b = on.get(e.t);
            if (
              a.x >= b.x &&
              a.y >= b.y &&
              a.x + a.w <= b.x + b.w &&
              a.y + a.h <= b.y + b.h
            )
              return;
          }
          E.push(e);
        });
        (w.edges || []).forEach((e) => {
          if (on.has(e.s) && on.has(e.t) && !(e.gen && ui.mbGen === false))
            E.push(Object.assign({ key: "m:" + e.id }, e));
        });
        const ortho = v === "process",
          sel = MB.sel;
        const order = vis.slice().sort((a, b) => {
          const ca = mbIsCont(a[2], a[1]) ? 1 : 0,
            cb = mbIsCont(b[2], b[1]) ? 1 : 0;
          return cb - ca || b[1].w * b[1].h - a[1].w * a[1].h;
        });
        const conts = order.filter(([r, n, ob]) => mbIsCont(ob, n)),
          cards = order.filter(([r, n, ob]) => !mbIsCont(ob, n));
        const nst = (r) => ({
          sel: !o.export && sel && sel.k === "n" && sel.ref === r,
          dim: !o.export && dimSet.has(r),
          hit: !o.export && hits.has(r),
          edit: !o.export && MB.edit && !readOnly(),
          src: !o.export && MB.link && MB.link.src === r,
          view: v,
          std,
        });
        let es = "";
        E.forEach((e) => {
          const a = on.get(e.s),
            b = on.get(e.t),
            T = MB_E[e.type] || MB_E.related_to,
            Sx = MB_ES[T.st] || MB_ES.secondary,
            an = mbAnch(a, b),
            d = mbPath(an, ortho);
          const isSel = !o.export && sel && sel.k === "e" && sel.key === e.key,
            dim = !o.export && (dimSet.has(e.s) || dimSet.has(e.t)),
            col = isSel ? "#0B57D0" : Sx.c,
            mk = isSel ? "s" : Sx.m;
          es += `<g class="mbe" data-e="${esc(e.key)}"${dim ? ' opacity=".18"' : e.gen && !o.export ? ' opacity=".8"' : ""}><title>${esc(T.l + (e.gen ? " (proposition à valider)" : e.der ? " (donnée de la plateforme)" : " (relation graphique)"))}</title>${o.export ? "" : `<path d="${d}" fill="none" stroke="transparent" stroke-width="12"/>`}<path d="${d}" fill="none" stroke="${col}" stroke-width="${Sx.w + (isSel ? 1.2 : 0)}"${Sx.d ? ` stroke-dasharray="${Sx.d}"` : ""}${T.dir ? ` marker-end="url(#mbA${mk})"` : ""}/>`;
          if (e.gen && !o.export && MB.edit) {
            const mx = (an.p1[0] + an.p2[0]) / 2,
              my = (an.p1[1] + an.p2[1]) / 2;
            es += `<circle cx="${mx}" cy="${my}" r="8" fill="#FFF1DE" stroke="#E98A15"/><text x="${mx}" y="${my + 3.8}" font-size="10.5" font-weight="700" fill="#B45F06" text-anchor="middle">?</text>`;
          }
          es += "</g>";
        });
        const svg =
          conts.map(([r, n, ob]) => mbNodeSvg(r, n, ob, nst(r))).join("") +
          es +
          cards.map(([r, n, ob]) => mbNodeSvg(r, n, ob, nst(r))).join("");
        return { svg, nodes: vis, edges: E, hits, on };
      }
      function mbStdOn() {
        const p = source().perimeters.find((p) => p.id === ui.mbScope),
          ids = p?.frameworkIds || source().activeFw || [];
        return (source().frameworks || [])
          .filter((f) => ids.includes(f.id))
          .map((f) => f.name || f.label || f.id);
      }
      function mbPreset(v) {
        return (ui.mbPre || {})[v] || "all";
      }
      function mbPresetMatch(v, p, ref, o) {
        if (p === "all" || !o) return true;
        if (v === "context") {
          if (p === "scope")
            return (
              ["isms", "scope"].includes(o.type) ||
              ([
                "process",
                "subprocess",
                "application",
                "infrastructure",
                "site",
              ].includes(o.type) &&
                o.scope !== "out")
            );
          if (p === "pi")
            return ["isms", "stakeholder", "supplier"].includes(o.type);
          if (p === "issues")
            return [
              "isms",
              "scope",
              "band",
              "external_issue",
              "internal_issue",
              "process",
            ].includes(o.type);
          return true;
        }
        const k = { pil: "Management", rea: "Réalisation", sup: "Support" }[p];
        if (o.type === "lane") return o.fam === k;
        if (o.type === "process" || o.type === "subprocess")
          return o.family === k;
        return true;
      }

      /* Vue principale */
      function viewCarto() {
        scopePicker();
        const v = mbView();
        MB.objs = mbObjects();
        const w = mbWork(v),
          T =
            v === "context"
              ? "Cartographie du contexte pilotage"
              : "Cartographie des processus";
        const sub =
          v === "context"
            ? "Périmètre • Parties intéressées • Enjeux • Applications • Fournisseurs"
            : "Pilotage • Réalisation • Support • Sous-processus et flux";
        const und = (MB.undo[v] || []).length,
          red = (MB.redo[v] || []).length,
          dirty = !!MB.dirty[v],
          ro = readOnly(),
          ed = MB.edit && !ro;
        const sync = w ? mbSyncInfo(v) : null,
          saved = (mbStore() || {})[v];
        const btn = (act, l, o) =>
          `<button class="btn${o && o.cls ? " " + o.cls : ""}" data-mb="${act}"${o && o.dis ? " disabled" : ""}${o && o.t ? ` title="${esc(o.t)}"` : ""}>${o && o.ic ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${o.ic}</svg>` : ""}${l}</button>`;
        const I = {
          gen: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
          add: '<path d="M12 5v14M5 12h14"/>',
          edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
          link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
          undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
          redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
          save: '<path d="M5 3h11l4 4v14H5z"/><path d="M8 3v6h8M8 21v-7h8v7"/>',
          ver: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
          exp: '<path d="M12 3v12m0 0l-5-5m5 5l5-5M4 19h16"/>',
          lay: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
          panel:
            '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
          full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
          info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
        };
        const bar = `<div class="mb-bar">${ro ? "" : btn("wizard", "Générer…", { ic: I.gen, t: "Assistant de génération à partir des données de la plateforme" }) + btn("add", "Ajouter depuis la plateforme", { ic: I.add, dis: !w }) + '<span class="sep"></span>'}
    ${ro ? "" : btn("edit", ed ? "Terminer l’édition" : "Modifier la disposition", { ic: I.edit, cls: ed ? "on" : "", dis: !w })}${ed ? btn("link", MB.link ? "Annuler la liaison" : "Relier", { ic: I.link, cls: MB.link ? "on" : "", t: "Créer une relation graphique entre deux objets" }) + btn("undo", "", { ic: I.undo, dis: !und, t: "Annuler (Ctrl+Z)" }) + btn("redo", "", { ic: I.redo, dis: !red, t: "Rétablir (Ctrl+Y)" }) + btn("relayout", "Disposition automatique", { ic: I.lay, t: "Recalculer la disposition (les positions manuelles seront remplacées)" }) : ""}
    ${ro ? "" : `<span class="sep"></span>` + btn("save", "Enregistrer", { ic: I.save, cls: dirty ? "primary" : "", dis: !dirty }) + btn("versions", "Versions", { ic: I.ver, dis: !w && !(saved && saved.versions && saved.versions.length) })}
    ${dirty ? '<span class="mb-dirty">Modifications non enregistrées</span>' : ""}<span style="flex:1"></span>
    ${btn("info", "", { ic: I.info, cls: MB.info ? "on" : "", t: "Informations sur la carte", dis: !w })}${btn("panel", "", { ic: I.panel, cls: ui.mbLeftOff ? "" : "on", t: "Afficher ou masquer le panneau latéral" })}${btn("full", "", { ic: I.full, cls: MB.full ? "on" : "", t: "Plein écran" })}
    <details class="mb-dd"><summary class="btn"${w ? "" : ' style="pointer-events:none;opacity:.45"'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${I.exp}</svg>Exporter</summary><div><button data-mb="xpng">Image PNG (haute définition)</button><button data-mb="xpdf">PDF A3 paysage</button><button data-mb="xsvg">SVG (vectoriel, modifiable)</button><button data-mb="xjson">Disposition de la carte (JSON)</button></div></details></div>`;
        let ban = "";
        if (sync) {
          if (sync.miss.length)
            ban += `<div class="mb-banner warn"><b>${sync.miss.length} objet${sync.miss.length > 1 ? "s" : ""} indisponible${sync.miss.length > 1 ? "s" : ""}</b><span>Supprimé${sync.miss.length > 1 ? "s" : ""} ou renommé${sync.miss.length > 1 ? "s" : ""} dans la plateforme ; la position est conservée en attendant votre décision.</span>${ro ? "" : `<button class="btn" data-mb="dropmiss">Retirer de la carte</button>`}</div>`;
          if (sync.news.length && !ro)
            ban += `<div class="mb-banner"><b>${sync.news.length} nouvel${sync.news.length > 1 ? "s" : ""} objet${sync.news.length > 1 ? "s" : ""}</b><span>dans la plateforme ne figure${sync.news.length > 1 ? "nt" : ""} pas sur la carte (${esc(
              sync.news
                .slice(0, 3)
                .map((o) => o.name)
                .join(", "),
            )}${sync.news.length > 3 ? "…" : ""}).</span><button class="btn" data-mb="add">Choisir et ajouter</button><button class="btn" data-mb="ignorenew">Ignorer</button></div>`;
        }
        const empty = !w
          ? `<div class="mb-empty"><div><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#1677FF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS.carto}</svg><h3>${v === "context" ? "Aucune carte de contexte" : "Aucune carte des processus"}</h3><p>${v === "context" ? "Générez une première carte à partir du périmètre, des processus, des parties intéressées, des enjeux (objectifs et SWOT), des applications et des fournisseurs déjà saisis." : "Générez la carte à partir des processus de la plateforme : lignes pilotage, réalisation et support, sous-processus regroupés sous leur parent."} Vous pourrez ensuite tout déplacer, relier et masquer.</p>${ro ? '<p class="note">Mode lecture seule : la génération est désactivée.</p>' : `<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn primary" data-mb="wizard">Générer la carte</button><button class="btn" data-mb="blank">Partir d’une carte vide</button></div>`}</div></div>`
          : "";
        const hint = MB.link
          ? `<div class="mb-hint">${MB.link.src ? "Cliquez sur l’objet cible" : "Cliquez sur l’objet source"}<button data-mb="link">Annuler</button></div>`
          : ed
            ? `<div class="mb-hint">Mode édition : glisser pour déplacer, poignée pour redimensionner, Suppr pour retirer de la carte<button data-mb="edit">Terminer</button></div>`
            : "";
        return `<div class="mb-wrap${MB.full ? " mb-full" : ""}"><div class="sec-head mb-head"><div><h2>${T}</h2><p>${sub}</p>${scopePicker()}</div>
    <div class="mb-tools"><div class="mb-seg" role="group" aria-label="Vue"><button data-mb="view" data-v="context" aria-pressed="${v === "context"}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS.carto}</svg>Vue contexte</button><button data-mb="view" data-v="process" aria-pressed="${v === "process"}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${MB_I.users}</svg>Vue processus</button></div>
    <label class="pq mb-q"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="mbQ" type="text" placeholder="Rechercher un objet sur la carte" value="${esc(MB.q)}" autocomplete="off" data-ro-ok><span class="pqn" id="mbQn"></span></label></div></div>
    ${bar}${ban}<div class="mb-grid${ui.mbLeftOff ? " noleft" : ""}">${ui.mbLeftOff ? "" : `<aside class="mb-left" id="mbLeft">${mbLeftHtml(v)}</aside>`}
    <div class="mb-canvas${ed ? " edit" : ""}${MB.link ? " linking" : ""}" id="mbCanvas"><svg id="mbSvg" xmlns="http://www.w3.org/2000/svg" font-family="'Sauge Inter', 'Segoe UI', Arial, sans-serif">${MB_DEFS}<g id="mbVp"></g></svg>${empty}${hint}
      ${w ? `<div class="mb-zoom"><button data-mb="zin" title="Zoom avant" aria-label="Zoom avant">+</button><button data-mb="zout" title="Zoom arrière" aria-label="Zoom arrière">−</button><button data-mb="fit" title="Ajuster à l’écran" aria-label="Ajuster à l’écran"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${I.full}</svg></button></div><div class="mb-mini" id="mbMini" title="Aperçu : cliquer pour centrer la vue"></div>` : ""}
      <aside class="mb-insp" id="mbInsp" hidden></aside></div></div></div>`;
      }
      function mbLeftHtml(v) {
        const std = mbStdOn(),
          pre = mbPreset(v),
          w = mbWork(v);
        const sw = (k, l, ic) =>
          `<label class="mb-sw"><span style="display:flex;gap:8px;align-items:center">${ic}${l}</span><input type="checkbox" data-ro-ok data-mbchk="std" data-k="${k}" ${std.includes(k) ? "checked" : ""}></label>`;
        const pres =
          v === "context"
            ? [
                [
                  "all",
                  "Globale",
                  '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
                ],
                [
                  "scope",
                  "Périmètre",
                  '<path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"/>',
                ],
                ["pi", "Parties intéressées", MB_I.users],
                ["issues", "Enjeux", MB_I.target],
              ]
            : [
                [
                  "all",
                  "Globale",
                  '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
                ],
                ["pil", "Pilotage", MB_I.compass],
                ["rea", "Réalisation", MB_I.gear],
                ["sup", "Support", MB_I.tools],
              ];
        const li = (sw, l, b) => `<li>${sw}<span>${l}</span></li>`,
          box = (f, s, d) =>
            `<i style="background:${f};border:1.5px ${d ? "dashed" : "solid"} ${s}"></i>`,
          ln = (c, d, arrow) =>
            `<svg width="22" height="10" viewBox="0 0 22 10"><path d="M1 5H${arrow ? 17 : 21}" stroke="${c}" stroke-width="1.8"${d ? ` stroke-dasharray="${d}"` : ""}/>${arrow ? `<path d="M15 1.5L21 5L15 8.5z" fill="${c}"/>` : ""}</svg>`;
        const leg =
          v === "context"
            ? [
                li(box("#F6FAFF", "#6FA3F7", 1), "Périmètre"),
                li(
                  box("#FFFFFF", "#CFE0FA"),
                  "Élément interne (processus, SI, site)",
                ),
                li(box("#F8F5FF", "#DCCDF7"), "Partie intéressée, fournisseur"),
                li(box("#FFF9F1", "#F4DCB9"), "Enjeu interne ou externe"),
                li(box("#F8F9FB", "#CDD5DF", 1), "Hors périmètre"),
                li(ln("#1677FF", "", 1), "Lien principal"),
                li(ln("#1677FF", "4 3", 1), "Dépendance, support"),
                li(ln("#93A3BA", "3 3"), "Lien secondaire"),
                li(ln("#E98A15", "4 3", 1), "Impact d’un enjeu"),
              ]
            : [
                li(box("#F8F5FF", "#E2D7F9"), "Processus de pilotage"),
                li(box("#F2F7FF", "#D5E4FA"), "Processus de réalisation"),
                li(box("#F1FAF4", "#CBE9D6"), "Processus de support"),
                li(box("#FFFFFF", "#C9D6E8", 1), "Sous-processus"),
                li(ln("#1677FF", "", 1), "Flux principal"),
                li(ln("#1677FF", "4 3", 1), "Support, dépendance"),
                li(ln("#93A3BA", "3 3", 1), "S’applique à"),
                li(
                  `<i style="background:#FFF1DE;border:1.5px solid #E98A15;border-radius:50%;width:14px;height:14px"></i>`,
                  "Proposition à valider (mode édition)",
                ),
              ];
        const on = w
            ? Object.keys(w.nodes)
                .map((r) => mbObj(r))
                .filter((o) => o && !o.mapOnly)
            : [],
          cnt = (f) => on.filter(f).length;
        const kp =
          v === "context"
            ? [
                ["Objets sur la carte", on.length],
                [
                  "Processus",
                  cnt((o) => o.type === "process" || o.type === "subprocess"),
                ],
                ["Parties intéressées", cnt((o) => o.type === "stakeholder")],
                ["Enjeux", cnt((o) => /issue/.test(o.type))],
                [
                  "Applications et SI",
                  cnt((o) =>
                    ["application", "infrastructure", "site"].includes(o.type),
                  ),
                ],
                ["Fournisseurs", cnt((o) => o.type === "supplier")],
              ]
            : [
                ["Processus", cnt((o) => o.type === "process")],
                [
                  "Pilotage",
                  cnt((o) => o.type === "process" && o.family === "Management"),
                ],
                [
                  "Réalisation",
                  cnt(
                    (o) => o.type === "process" && o.family === "Réalisation",
                  ),
                ],
                [
                  "Support",
                  cnt((o) => o.type === "process" && o.family === "Support"),
                ],
                ["Sous-processus", cnt((o) => o.type === "subprocess")],
                [
                  "Propositions à valider",
                  w ? (w.edges || []).filter((e) => e.gen).length : 0,
                ],
              ];
        const nIso = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1677FF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${MB_I.shield}</svg>`,
          nHds = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7A4CE0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${MB_I.building}</svg>`;
        return `  <div class="mb-card"><h4>Vue</h4><div class="mb-pre">${pres.map(([k, l, ic]) => `<button class="${pre === k ? "on" : ""}" data-mb="preset" data-k="${k}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ic}</svg>${l}</button>`).join("")}</div>
    <label class="mb-sw" style="margin-top:8px"><span>Relations secondaires</span><input type="checkbox" data-ro-ok data-mbchk="sec" ${ui.mbSec ? "checked" : ""}></label>${v === "process" ? `<label class="mb-sw"><span>Propositions de flux</span><input type="checkbox" data-ro-ok data-mbchk="gen" ${ui.mbGen !== false ? "checked" : ""}></label>` : ""}</div>
  <div class="mb-card"><h4>Légende</h4><ul class="mb-leg">${leg.join("")}</ul></div>
  <div class="mb-card"><h4>Chiffres clés</h4><ul class="mb-kpi">${kp.map(([l, n]) => `<li><span>${l}</span><b>${n}</b></li>`).join("")}</ul></div>`;
      }

      /* Synchronisation avec les données métier */
      function mbSyncInfo(v) {
        const w = mbWork(v);
        if (!w) return { miss: [], news: [] };
        const objs = MB.objs;
        const miss = Object.keys(w.nodes).filter(
          (r) => !mbMapOnly(r) && !objs.has(r),
        );
        const types =
          v === "process"
            ? ["process", "subprocess"]
            : [
                "process",
                "stakeholder",
                "external_issue",
                "internal_issue",
                "application",
                "infrastructure",
                "site",
                "supplier",
              ];
        const news = [...objs.values()].filter(
          (o) => types.includes(o.type) && !w.nodes[o.ref] && !w.ignored[o.ref],
        );
        return { miss, news };
      }

      /* Montage, viewport, rendu */
      function mbMount() {
        const v = mbView(),
          cv = $("#mbCanvas");
        if (!cv) return;
        mbSize();
        mbDraw();
        mbInsp();
        if (!MB.vp[v]) {
          const sv = (ui.mbVp || {})[v];
          if (sv && isFinite(sv.k)) MB.vp[v] = sv;
          else mbFit(true);
        } else mbApplyVp();
        const svg = $("#mbSvg");
        svg.addEventListener("pointerdown", mbDown);
        svg.addEventListener("pointermove", mbMove);
        svg.addEventListener("pointerup", mbUp);
        svg.addEventListener("pointercancel", mbUp);
        svg.addEventListener("wheel", mbWheel, { passive: false });
        svg.addEventListener("dblclick", mbDbl);
        const mini = $("#mbMini");
        if (mini) mini.addEventListener("pointerdown", mbMiniDown);
        const q = $("#mbQ");
        if (q) {
          q.addEventListener("input", () => {
            MB.q = q.value;
            mbDraw();
            mbQCount();
          });
          q.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              mbFocusHit();
            }
            if (e.key === "Escape") {
              q.value = "";
              MB.q = "";
              mbDraw();
              mbQCount();
            }
          });
        }
        mbQCount();
      }
      function mbSize() {
        const g = document.querySelector(".mb-grid");
        if (!g) return;
        const top = g.getBoundingClientRect().top + (window.scrollY || 0),
          full = !!MB.full;
        const h = full
          ? Math.max(
              420,
              window.innerHeight - g.getBoundingClientRect().top - 12,
            )
          : Math.max(
              480,
              Math.min(
                1100,
                window.innerHeight -
                  Math.max(70, top - (window.scrollY || 0)) -
                  18,
              ),
            );
        g.style.setProperty(
          "--mbh",
          (window.innerWidth < 900
            ? Math.max(420, Math.round(window.innerHeight * 0.68))
            : h) + "px",
        );
      }
      function mbApplyVp() {
        const v = mbView(),
          p = MB.vp[v] || { x: 0, y: 0, k: 1 },
          g = $("#mbVp");
        if (g)
          g.setAttribute(
            "transform",
            `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${p.k.toFixed(4)})`,
          );
        mbMini();
      }
      function mbFit(silent) {
        const v = mbView(),
          w = mbWork(v),
          cv = $("#mbCanvas");
        if (!w || !cv) return;
        const sc = mbScene(v);
        const bb = mbBBox(sc.nodes.map((x) => x[1]));
        const r = cv.getBoundingClientRect(),
          insp = $("#mbInsp"),
          iw =
            insp && !insp.hidden && window.innerWidth >= 900
              ? insp.offsetWidth + 24
              : 0;
        const W = Math.max(200, r.width - iw - 40),
          H = Math.max(200, r.height - 40),
          k = Math.max(0.2, Math.min(1.25, W / bb.w, H / bb.h));
        MB.vp[v] = {
          k,
          x: 20 + (W - bb.w * k) / 2 - bb.x * k,
          y: 20 + (H - bb.h * k) / 2 - bb.y * k,
        };
        mbApplyVp();
        if (!silent) mbSaveVp();
      }
      function mbSaveVp() {
        ui.mbVp = ui.mbVp || {};
        ui.mbVp[mbView()] = MB.vp[mbView()];
        clearTimeout(MB._vt);
        MB._vt = setTimeout(() => {
          try {
            saveUI();
          } catch (e) {}
        }, 400);
      }
      function mbZoom(f, cx, cy) {
        const v = mbView(),
          p = MB.vp[v] || { x: 0, y: 0, k: 1 },
          cv = $("#mbCanvas");
        if (!cv) return;
        const r = cv.getBoundingClientRect();
        if (cx == null) {
          cx = r.width / 2;
          cy = r.height / 2;
        }
        const k = Math.max(0.2, Math.min(2.5, p.k * f)),
          wx = (cx - p.x) / p.k,
          wy = (cy - p.y) / p.k;
        MB.vp[v] = { k, x: cx - wx * k, y: cy - wy * k };
        mbApplyVp();
        mbSaveVp();
      }
      function mbDraw() {
        const v = mbView(),
          g = $("#mbVp");
        if (!g) return;
        const sc = mbScene(v);
        g.innerHTML = sc.svg;
        MB.last = sc;
        mbMini();
      }
      function mbReq() {
        if (MB.raf) return;
        MB.raf = requestAnimationFrame(() => {
          MB.raf = 0;
          mbDraw();
        });
      }
      function mbMini() {
        const box = $("#mbMini"),
          v = mbView();
        if (!box || !MB.last) return;
        const N = MB.last.nodes;
        if (!N.length) {
          box.innerHTML = "";
          return;
        }
        const bb = mbBBox(N.map((x) => x[1])),
          pad = 30,
          cv = $("#mbCanvas"),
          r = cv.getBoundingClientRect(),
          p = MB.vp[v] || { x: 0, y: 0, k: 1 };
        const vx = -p.x / p.k,
          vy = -p.y / p.k,
          vw = r.width / p.k,
          vh = r.height / p.k;
        box.innerHTML = `<svg viewBox="${bb.x - pad} ${bb.y - pad} ${bb.w + 2 * pad} ${bb.h + 2 * pad}" preserveAspectRatio="xMidYMid meet">${N.map(
          ([ref, n, o]) => {
            const c = !o
              ? "#C4CAD4"
              : o.type === "isms"
                ? MB_C.navy
                : o.type === "scope"
                  ? "none"
                  : mbIsCont(o, n)
                    ? "#EEF3FA"
                    : /issue|band/.test(o.type)
                      ? "#F6C88A"
                      : o.type === "stakeholder" || o.type === "supplier"
                        ? "#C9B5F2"
                        : "#9DC2FA";
            return `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" fill="${c}"${o && o.type === "scope" ? ' stroke="#6FA3F7" stroke-width="6" stroke-dasharray="20 14"' : ""}/>`;
          },
        ).join(
          "",
        )}<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="rgba(22,119,255,.08)" stroke="#1677FF" stroke-width="${Math.max(3, ((bb.w + 2 * pad) / 180) * 1.6)}" rx="6"/></svg>`;
        box._bb = {
          x: bb.x - pad,
          y: bb.y - pad,
          w: bb.w + 2 * pad,
          h: bb.h + 2 * pad,
        };
      }
      function mbMiniDown(e) {
        const box = e.currentTarget,
          bb = box._bb;
        if (!bb) return;
        e.preventDefault();
        const go = (ev) => {
          const r = box.getBoundingClientRect(),
            s = Math.min(r.width / bb.w, r.height / bb.h),
            ox = (r.width - bb.w * s) / 2,
            oy = (r.height - bb.h * s) / 2;
          const wx = bb.x + (ev.clientX - r.left - ox) / s,
            wy = bb.y + (ev.clientY - r.top - oy) / s;
          mbCenter(wx, wy);
        };
        go(e);
        const mv = (ev) => go(ev),
          up = () => {
            window.removeEventListener("pointermove", mv);
            window.removeEventListener("pointerup", up);
            mbSaveVp();
          };
        window.addEventListener("pointermove", mv);
        window.addEventListener("pointerup", up);
      }
      function mbCenter(wx, wy) {
        const v = mbView(),
          p = MB.vp[v] || { x: 0, y: 0, k: 1 },
          r = $("#mbCanvas").getBoundingClientRect();
        MB.vp[v] = {
          k: p.k,
          x: r.width / 2 - wx * p.k,
          y: r.height / 2 - wy * p.k,
        };
        mbApplyVp();
      }
      function mbWorld(e) {
        const v = mbView(),
          p = MB.vp[v] || { x: 0, y: 0, k: 1 },
          r = $("#mbCanvas").getBoundingClientRect();
        return {
          x: (e.clientX - r.left - p.x) / p.k,
          y: (e.clientY - r.top - p.y) / p.k,
        };
      }
      function mbQCount() {
        const n = $("#mbQn");
        if (!n) return;
        n.textContent =
          MB.q.trim() && MB.last
            ? MB.last.hits.size +
              " résultat" +
              (MB.last.hits.size > 1 ? "s" : "")
            : "";
      }
      function mbFocusHit() {
        if (!MB.last || !MB.last.hits.size) return;
        const r = [...MB.last.hits][0],
          n = MB.last.on.get(r);
        MB.sel = { k: "n", ref: r };
        mbCenter(n.x + n.w / 2, n.y + n.h / 2);
        mbDraw();
        mbInsp();
        mbSaveVp();
      }

      /* Interactions : sélection, déplacement, redimensionnement, liaison, panoramique */
      function mbDown(e) {
        if (e.button > 0) return;
        const v = mbView(),
          w = mbWork(v);
        if (!w) return;
        const svg = e.currentTarget,
          hEl = e.target.closest("[data-h]"),
          nEl = e.target.closest("[data-n]"),
          eEl = e.target.closest("[data-e]");
        const p = mbWorld(e),
          ed = MB.edit && !readOnly();
        MB.drag = { sx: e.clientX, sy: e.clientY, moved: false, p0: p };
        if (ed && hEl) {
          const ref = hEl.dataset.h,
            n = w.nodes[ref];
          MB.drag.kind = "rz";
          MB.drag.ref = ref;
          MB.drag.o = { w: n.w, h: n.h };
          MB.drag.snap = JSON.stringify(w);
        } else if (nEl) {
          const ref = nEl.dataset.n,
            n = w.nodes[ref];
          MB.drag.ref = ref;
          if (MB.link) {
            MB.drag.kind = "link";
          } else if (ed && n) {
            const o = mbObj(ref),
              cont = mbIsCont(o, n),
              grp = [[ref, n.x, n.y]];
            if (cont)
              for (const [r2, n2] of Object.entries(w.nodes)) {
                if (r2 === ref || n2.hidden) continue;
                if (
                  n2.w * n2.h < n.w * n.h &&
                  n2.x >= n.x - 1 &&
                  n2.y >= n.y - 1 &&
                  n2.x + n2.w <= n.x + n.w + 1 &&
                  n2.y + n2.h <= n.y + n.h + 1
                )
                  grp.push([r2, n2.x, n2.y]);
              }
            MB.drag.kind = "mv";
            MB.drag.grp = grp;
            MB.drag.snap = JSON.stringify(w);
          } else MB.drag.kind = "pan";
        } else if (eEl) {
          MB.drag.kind = "edge";
          MB.drag.key = eEl.dataset.e;
        } else MB.drag.kind = "pan";
        if (MB.drag.kind === "pan") {
          const vp = MB.vp[v] || { x: 0, y: 0, k: 1 };
          MB.drag.vp = { ...vp };
        }
        try {
          svg.setPointerCapture(e.pointerId);
        } catch (x) {}
      }
      function mbMove(e) {
        const d = MB.drag;
        if (!d) return;
        const dx = e.clientX - d.sx,
          dy = e.clientY - d.sy;
        if (!d.moved && Math.hypot(dx, dy) < 4) return;
        d.moved = true;
        const v = mbView(),
          w = mbWork(v);
        if (d.kind === "pan") {
          MB.vp[v] = { k: d.vp.k, x: d.vp.x + dx, y: d.vp.y + dy };
          $("#mbCanvas").classList.add("panning");
          mbApplyVp();
        } else if (d.kind === "mv") {
          const k = (MB.vp[v] || { k: 1 }).k;
          d.grp.forEach(([r, x, y]) => {
            const n = w.nodes[r];
            if (n) {
              n.x = Math.round(x + dx / k);
              n.y = Math.round(y + dy / k);
            }
          });
          mbReq();
        } else if (d.kind === "rz") {
          const k = (MB.vp[v] || { k: 1 }).k,
            n = w.nodes[d.ref],
            o = mbObj(d.ref);
          n.w = Math.max(
            mbIsCont(o, n) ? 240 : 140,
            Math.round(d.o.w + dx / k),
          );
          n.h = Math.max(mbIsCont(o, n) ? 120 : 52, Math.round(d.o.h + dy / k));
          mbReq();
        }
      }
      function mbUp(e) {
        const d = MB.drag;
        MB.drag = null;
        if (!d) return;
        const v = mbView(),
          w = mbWork(v);
        const cv = $("#mbCanvas");
        if (cv) cv.classList.remove("panning");
        if (d.kind === "pan") {
          if (d.moved) {
            mbSaveVp();
            return;
          }
          if (d.ref) {
            MB.sel = { k: "n", ref: d.ref };
          } else MB.sel = null;
          MB.info = false;
          mbDraw();
          mbInsp();
          return;
        }
        if (d.kind === "mv" || d.kind === "rz") {
          if (d.moved) {
            (MB.undo[v] = MB.undo[v] || []).push(d.snap);
            if (MB.undo[v].length > 60) MB.undo[v].shift();
            MB.redo[v] = [];
            MB.dirty[v] = true;
            mbDraw();
            mbBarRefresh();
          } else {
            MB.sel = { k: "n", ref: d.ref };
            MB.info = false;
            mbDraw();
            mbInsp();
          }
          return;
        }
        if (d.kind === "edge" && !d.moved) {
          MB.sel = { k: "e", key: d.key };
          MB.info = false;
          mbDraw();
          mbInsp();
          return;
        }
        if (d.kind === "link" && !d.moved) {
          if (!MB.link.src) {
            MB.link.src = d.ref;
            render();
            return;
          }
          if (MB.link.src === d.ref) return;
          mbLinkDialog(MB.link.src, d.ref);
        }
      }
      function mbWheel(e) {
        e.preventDefault();
        const r = $("#mbCanvas").getBoundingClientRect(),
          f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        mbZoom(f, e.clientX - r.left, e.clientY - r.top);
      }
      function mbDbl(e) {
        const nEl = e.target.closest("[data-n]");
        if (nEl && !MB.link) mbOpen(nEl.dataset.n);
      }
      function mbBarRefresh() {
        const v = mbView();
        document
          .querySelectorAll('[data-mb="undo"]')
          .forEach((b) => (b.disabled = !(MB.undo[v] || []).length));
        document
          .querySelectorAll('[data-mb="redo"]')
          .forEach((b) => (b.disabled = !(MB.redo[v] || []).length));
        const sv = document.querySelector('[data-mb="save"]');
        if (sv) {
          sv.disabled = !MB.dirty[v];
          sv.classList.toggle("primary", !!MB.dirty[v]);
        }
        if (MB.dirty[v] && !document.querySelector(".mb-dirty") && sv)
          sv.insertAdjacentHTML(
            "afterend",
            '<span class="mb-dirty">Modifications non enregistrées</span>',
          );
      }
      function mbMut(fn) {
        const v = mbView(),
          w = mbWork(v);
        if (!w) return;
        (MB.undo[v] = MB.undo[v] || []).push(JSON.stringify(w));
        if (MB.undo[v].length > 60) MB.undo[v].shift();
        MB.redo[v] = [];
        fn(w);
        MB.dirty[v] = true;
      }
      function mbUndo(redo) {
        const v = mbView(),
          A = redo ? MB.redo : MB.undo,
          B = redo ? MB.undo : MB.redo;
        const st = (A[v] || []).pop();
        if (!st) return;
        (B[v] = B[v] || []).push(JSON.stringify(mbWork(v)));
        MB.work[v] = JSON.parse(st);
        MB.dirty[v] = true;
        render();
      }

      /* Inspecteur (fiche détaillée) */
      function mbInsp() {
        const box = $("#mbInsp");
        if (!box) return;
        const v = mbView(),
          w = mbWork(v),
          sel = MB.sel;
        if (MB.info && w) {
          box.hidden = false;
          box.innerHTML = mbInfoHtml(v);
          return;
        }
        if (!sel || !w) {
          box.hidden = true;
          box.innerHTML = "";
          return;
        }
        box.hidden = false;
        box.innerHTML =
          sel.k === "e" ? mbEdgeHtml(sel.key) : mbNodeHtml(sel.ref);
      }
      const mbX = `<button class="mb-x" data-mb="closeinsp" aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
      const mbRow = (l, val) =>
        val === "" || val == null
          ? ""
          : `<div class="mb-row"><span>${l}</span><div>${val}</div></div>`;
      const mbTag = (l, c, attrs) =>
        attrs
          ? `<button class="mb-tag ${c || ""}" ${attrs}>${esc(l)}</button>`
          : `<span class="mb-tag ${c || ""}">${esc(l)}</span>`;
      function mbNodeHtml(ref) {
        const v = mbView(),
          w = mbWork(v),
          n = w.nodes[ref],
          o = mbObj(ref),
          ed = MB.edit && !readOnly();
        if (!n)
          return `<div class="mb-card">${mbX}<p class="note">Objet retiré de la carte.</p></div>`;
        if (!o)
          return `<div class="mb-card">${mbX}<div class="mb-ih"><span class="ic" style="background:#E9ECF1">${mbIcoH("ghost", "#98A2B3")}</span><div><h3>${esc(n.label || ref)}</h3><p>Objet indisponible</p></div></div><p class="note" style="margin-top:12px">Cet objet n’existe plus dans la plateforme ou n’est plus accessible. Sa position est conservée tant que vous ne le retirez pas.</p>${readOnly() ? "" : `<div class="mb-acts"><button class="btn danger" data-mb="remove" data-r="${esc(ref)}">Retirer de la carte</button></div>`}</div>`;
        const c =
          o.type === "isms"
            ? { ac: "#FFFFFF", soft: MB_C.navy }
            : o.type === "scope"
              ? { ac: MB_C.blue, soft: MB_C.blueSoft }
              : o.type === "lane"
                ? { ac: mbFam(o.fam).ac, soft: mbFam(o.fam).soft }
                : o.type === "band" || o.type === "zone"
                  ? { ac: "#B0630B", soft: "#FFF1DE" }
                  : mbColors(o);
        const ic =
          o.type === "isms"
            ? "building"
            : o.type === "scope"
              ? "shield"
              : o.type === "lane"
                ? mbFam(o.fam).ic
                : o.type === "band"
                  ? "alert"
                  : o.type === "zone"
                    ? "layers"
                    : o.ic || c.ic || "layers";
        const sc = o.scope ? mbScopeChip(o) : null,
          T = (MB_T[o.type] || {}).l || o.type,
          rows = [],
          secs = [],
          acts = [];
        const typeL =
          o.type === "process"
            ? mbFam(o.family).l.replace(/^Processus/, "Processus")
            : T;
        rows.push(mbRow("Type", mbTag(typeL, "b")));
        if (sc)
          rows.push(
            mbRow(
              "Périmètre",
              mbTag(sc[0], sc[1] === "in" ? "g" : sc[1] === "unk" ? "o" : ""),
            ),
          );
        if (o.owner) rows.push(mbRow("Responsable", esc(o.owner)));
        if (o.std && !o.mapOnly)
          rows.push(
            mbRow(
              "Référentiels",
              `<div class="mb-tags">${o.std.map((s) => mbTag(s, s === "HDS" ? "p" : "b")).join("")}</div>`,
            ),
          );
        const rel = mbRelations(MB.objs)
          .filter((e) => e.s === ref || e.t === ref)
          .concat(
            (w.edges || [])
              .filter((e) => e.s === ref || e.t === ref)
              .map((e) => Object.assign({ key: "m:" + e.id }, e)),
          );
        if (o.type === "process" || o.type === "subprocess") {
          const p = o.data,
            ob = (state().objectives || []).filter((x) =>
              (x.processes || []).includes(p.id),
            );
          const kids = (state().processes || []).filter(
            (x) =>
              (x.parent ||
                (String(x.id).includes(".")
                  ? String(x.id).split(".")[0]
                  : "")) === p.id,
          );
          if (o.parent)
            rows.push(
              mbRow(
                "Processus parent",
                mbTag(
                  o.parent.split(":")[1],
                  "b",
                  `data-mb="goto" data-r="${esc(o.parent)}"`,
                ),
              ),
            );
          if (kids.length)
            rows.push(
              mbRow(
                "Sous-processus",
                `<div class="mb-tags">${kids.map((k) => mbTag(k.id + " " + k.name, "b", `data-mb="goto" data-r="process:${esc(k.id)}"`)).join("")}</div>`,
              ),
            );
          secs.push([
            "Objectifs liés",
            ob.length
              ? `<div class="mb-tags">${ob.map((x) => mbTag(x.id, "b", `data-act="obj" data-obj="${esc(x.id)}" title="${esc(x.name)}"`)).join("")}</div>`
              : '<p class="note">Aucun objectif rattaché à ce processus.</p>',
          ]);
          const inds = (state().indicators || []).filter((i) =>
            ob.some((x) => x.id === i.obj),
          );
          if (inds.length)
            secs.push([
              "Indicateurs (KPI)",
              `<ul class="mb-list">${inds
                .slice(0, 8)
                .map((i) => {
                  const s = indState(i).st;
                  return `<li><button class="mb-tag ${s === "ok" ? "g" : s === "ko" ? "r" : ""}" data-act="ind" data-ind="${esc(i.id)}">${esc(i.id)}</button><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(i.name)}">${esc(i.name)}</span></li>`;
                })
                .join(
                  "",
                )}${inds.length > 8 ? `<li class="note">… et ${inds.length - 8} autre(s)</li>` : ""}</ul>`,
            ]);
          const sw = typeof swotLatest === "function" ? swotLatest(p.id) : null;
          secs.push([
            "SWOT",
            sw
              ? `<p class="note">Dernière analyse du ${esc(dFr(sw.date))} : ${["S", "W", "O", "T"].map((k) => (sw[k] || []).length + " " + { S: "force", W: "faiblesse", O: "opportunité", T: "menace" }[k] + ((sw[k] || []).length > 1 ? "s" : "")).join(", ")}.</p><div class="mb-acts"><button class="btn" data-mb="openswot" data-p="${esc(p.id)}">Ouvrir le SWOT</button></div>`
              : `<p class="note">Aucun SWOT pour ce processus.</p>${readOnly() ? "" : `<div class="mb-acts"><button class="btn" data-mb="openswot" data-p="${esc(p.id)}">Réaliser le SWOT</button></div>`}`,
          ]);
          acts.push(
            `<button class="btn" data-mb="openproc">Pilotage par processus</button>`,
          );
        }
        if (o.type === "stakeholder") {
          const p = o.data;
          rows.push(
            mbRow(
              "Nature",
              mbTag(p.type || "Externe", p.type === "Interne" ? "b" : "p"),
            ),
          );
          if (p.cat) rows.push(mbRow("Catégorie", esc(p.cat)));
          if (p.needs)
            secs.push([
              "Besoins et attentes",
              `<p class="note">${esc(p.needs)}</p>`,
            ]);
          if (p.req)
            secs.push([
              "Exigences pertinentes",
              `<div class="mb-tags">${mbLines(p.req)
                .map((x) => mbTag(x, "b"))
                .join("")}</div>`,
            ]);
          rows.push(
            mbRow(
              "Prise en compte",
              mbTag(
                p.addressed || "Non renseigné",
                /oui/i.test(p.addressed || "") ? "g" : "o",
              ),
            ),
          );
          if (p.reviewed) rows.push(mbRow("Revue", esc(dFr(p.reviewed))));
          acts.push(
            `<button class="btn" data-mb="nav" data-sec="pil" data-sub="ctx-pi">Registre des parties intéressées</button>`,
          );
        }
        if (o.type === "supplier") {
          const s = o.data;
          rows.push(
            mbRow(
              "Caractéristiques",
              `<div class="mb-tags">${
                [
                  s.saas ? ["SaaS", "b"] : null,
                  o.hds ? ["Hébergeur HDS", "p"] : null,
                  o.crit ? ["Critique", "r"] : null,
                  s.sso
                    ? ["SSO : " + s.sso, /oui/i.test(s.sso) ? "g" : "o"]
                    : null,
                  s.mfa
                    ? ["MFA : " + s.mfa, /oui/i.test(s.mfa) ? "g" : "o"]
                    : null,
                ]
                  .filter(Boolean)
                  .map(([l, c]) => mbTag(l, c))
                  .join("") || "—"
              }</div>`,
            ),
          );
          if ((s.certs || []).length)
            rows.push(
              mbRow(
                "Certifications",
                `<div class="mb-tags">${s.certs.map((x) => mbTag(typeof x === "string" ? x : x.name || x.t || "Certificat", "g")).join("")}</div>`,
              ),
            );
          const apps = (state().appGaps || []).filter(
            (a) =>
              String(a.supplier || "").toLowerCase() ===
              String(s.name || "").toLowerCase(),
          );
          if (apps.length)
            secs.push([
              "Applications liées",
              `<div class="mb-tags">${apps.map((a) => mbTag(a.name, "b", `data-act="gap" data-gap="${esc(a.id)}"`)).join("")}</div>`,
            ]);
          acts.push(
            `<button class="btn" data-act="sup" data-sup="${esc(s.id)}">Ouvrir la fiche fournisseur</button>`,
          );
        }
        if (o.type === "application") {
          const a = o.data;
          rows.push(
            mbRow(
              "Statut",
              mbTag(
                a.status || "À étudier",
                a.status === "Intégrée" ? "g" : "o",
              ),
            ),
          );
          if (a.supplier)
            rows.push(
              mbRow(
                "Fournisseur",
                o.supRef
                  ? mbTag(
                      a.supplier,
                      "p",
                      `data-mb="goto" data-r="${esc(o.supRef)}"`,
                    )
                  : esc(a.supplier),
              ),
            );
          if (a.dscp) rows.push(mbRow("Données de santé", esc(a.dscp)));
          if (a.cloud) rows.push(mbRow("Hébergement", esc(a.cloud)));
          acts.push(
            `<button class="btn" data-act="gap" data-gap="${esc(a.id)}">Ouvrir le GAP</button>`,
          );
        }
        if (o.type === "external_issue" || o.type === "internal_issue") {
          if (o.sub)
            secs.push(["Description", `<p class="note">${esc(o.sub)}</p>`]);
          rows.push(
            mbRow(
              "Nature",
              readOnly()
                ? mbTag(
                    o.type === "external_issue" ? "Externe" : "Interne",
                    "o",
                  )
                : `<select class="mini-sel" data-mbsel="ikind" data-r="${esc(ref)}"><option value="ext" ${o.type === "external_issue" ? "selected" : ""}>Enjeu externe</option><option value="int" ${o.type === "internal_issue" ? "selected" : ""}>Enjeu interne</option></select>`,
            ),
          );
          secs.push([
            "Origine dans la plateforme",
            `<ul class="mb-list">${o.src.map((s) => `<li>${s.k === "obj" ? mbTag(s.id, "b", `data-act="obj" data-obj="${esc(s.id)}"`) : mbTag("SWOT " + s.proc, "o", `data-mb="openswot" data-p="${esc(s.proc)}"`)}<span style="flex:1;min-width:0" class="note">${esc(s.l)}</span></li>`).join("")}</ul>`,
          ]);
          if (o.procs.size)
            secs.push([
              "Processus concernés",
              `<div class="mb-tags">${[...o.procs].map((p) => mbTag(p, "b", `data-mb="goto" data-r="process:${esc(p)}"`)).join("")}</div>`,
            ]);
        }
        if (o.type === "scope") {
          const d = o.data || {};
          if (d.statement)
            secs.push([
              "Déclaration",
              `<p class="note">${esc(d.statement)}</p>`,
            ]);
          rows.push(
            mbRow(
              "Processus inclus",
              d.processes && d.processes.length
                ? `<div class="mb-tags">${d.processes.map((p) => mbTag(p, "g", `data-mb="goto" data-r="process:${esc(p)}"`)).join("")}</div>`
                : mbTag("À préciser", "o"),
            ),
          );
          if (d.hds)
            rows.push(
              mbRow(
                "Activités HDS",
                d.hds.length ? d.hds.length + " activité(s)" : "—",
              ),
            );
          if (d.excl && d.excl.length)
            rows.push(
              mbRow("Exclusions", d.excl.length + " exclusion(s) justifiée(s)"),
            );
          if (d.validatedOn)
            rows.push(
              mbRow(
                "Validé le",
                esc(dFr(d.validatedOn)) +
                  (d.validatedBy ? " par " + esc(d.validatedBy) : ""),
              ),
            );
          acts.push(
            `<button class="btn" data-mb="nav" data-sec="pil" data-sub="perimeter-registry">Consulter le périmètre</button>`,
          );
        }
        if (o.type === "isms") {
          const pr = (state().processes || []).length,
            op = (state().findings || []).filter(
              (f) => f.status !== "Clos",
            ).length;
          secs.push([
            "Chiffres",
            `<ul class="mb-kpi"><li><span>Processus</span><b>${pr}</b></li><li><span>Parties intéressées</span><b>${(state().interested || []).length}</b></li><li><span>Fournisseurs</span><b>${(state().suppliers || []).length}</b></li><li><span>Écarts ouverts</span><b>${op}</b></li><li><span>Objectifs</span><b>${(state().objectives || []).length}</b></li></ul>`,
          ]);
          acts.push(
            `<button class="btn" data-mb="nav" data-sec="dash" data-sub="dash">Tableau de bord</button>`,
          );
        }
        if (o.type === "lane" || o.type === "band" || o.type === "zone")
          secs.push([
            "Cadre de la carte",
            `<p class="note">Élément de présentation propre à cette carte : il regroupe visuellement les objets et n’existe pas dans les données de la plateforme.</p>`,
          ]);
        if ((rel.length && !o.mapOnly) || (rel.length && o.type === "lane")) {
          secs.push([
            "Relations (" + rel.length + ")",
            `<ul class="mb-list">${rel
              .slice(0, 14)
              .map((e) => {
                const other = e.s === ref ? e.t : e.s,
                  oo = mbObj(other),
                  T2 = MB_E[e.type] || MB_E.related_to;
                return `<li><span class="note" style="min-width:86px">${esc(T2.l)}${e.s === ref ? " →" : " ←"}</span><span style="flex:1;min-width:0">${mbTag(oo ? oo.code || oo.name : other, e.gen ? "o" : e.der ? "b" : "", `data-mb="goto" data-r="${esc(other)}"`)}</span>${e.gen ? '<span class="mb-tag o" title="Proposition générée automatiquement, à valider">à valider</span>' : ""}</li>`;
              })
              .join(
                "",
              )}${rel.length > 14 ? `<li class="note">… et ${rel.length - 14} autre(s)</li>` : ""}</ul>`,
          ]);
        }
        if (
          !o.mapOnly &&
          !["lane", "band", "zone"].includes(o.type) &&
          o.type !== "scope" &&
          o.type !== "isms" &&
          ![
            "process",
            "subprocess",
            "stakeholder",
            "supplier",
            "application",
          ].includes(o.type)
        ) {
        }
        const edA = readOnly()
          ? ""
          : `<div class="mb-acts">${ed ? `<button class="btn" data-mb="defsize" data-r="${esc(ref)}">Taille par défaut</button>` : ""}<button class="btn danger" data-mb="remove" data-r="${esc(ref)}" title="L’objet reste dans la plateforme">Retirer de la carte</button></div>`;
        return `<div class="mb-card">${mbX}<h4 style="margin-bottom:12px">Fiche détaillée</h4><div class="mb-ih"><span class="ic" style="background:${c.soft}">${mbIcoH(ic, c.ac)}</span><div style="min-width:0"><h3>${esc(o.name)}${o.code ? ` <span class="mb-tag b" style="vertical-align:2px">${esc(o.code)}</span>` : ""}</h3><p>${esc(o.type === "process" ? mbFam(o.family).l : o.type === "subprocess" ? "Sous-processus — " + mbFam(o.family).l.toLowerCase() : o.sub && !/issue/.test(o.type) ? o.sub : T)}</p></div></div>
    <div class="mb-rows">${rows.join("")}</div>${secs.map(([h, b]) => `<div class="mb-sec"><h5>${h}</h5>${b}</div>`).join("")}${acts.length ? `<div class="mb-acts">${acts.join("")}</div>` : ""}<div class="mb-sec" style="margin-top:12px;padding-top:10px">${edA}<p class="note" style="font-size:11.5px;margin-top:8px">Double-cliquez sur un objet pour ouvrir sa fiche dans la plateforme. ${o.mapOnly ? "" : "Les informations affichées proviennent de la plateforme : un renommage y est repris ici sans déplacer l’objet."}</p></div></div>`;
      }
      const mbIcoH = (k, c) =>
        `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${MB_I[k] || MB_I.layers}</svg>`;
      function mbEdgeHtml(key) {
        const v = mbView(),
          w = mbWork(v),
          ed = MB.edit && !readOnly();
        let e;
        if (key.startsWith("m:"))
          e = (w.edges || []).find((x) => "m:" + x.id === key);
        else e = mbRelations(MB.objs).find((x) => x.key === key);
        if (!e)
          return `<div class="mb-card">${mbX}<p class="note">Relation introuvable.</p></div>`;
        const a = mbObj(e.s),
          b = mbObj(e.t),
          T = MB_E[e.type] || MB_E.related_to;
        const nm = (o, r) =>
          mbTag(
            o ? (o.code ? o.code + " — " : "") + o.name : r,
            "b",
            `data-mb="goto" data-r="${esc(r)}"`,
          );
        const nat = e.der
          ? "Relation issue des données de la plateforme"
          : e.gen
            ? "Proposition générée automatiquement, à valider"
            : "Relation graphique propre à cette carte";
        let acts = "";
        if (!readOnly()) {
          if (e.der)
            acts = `<button class="btn" data-mb="hideedge" data-k="${esc(key)}">Masquer sur cette carte</button>`;
          else
            acts = `${e.gen ? `<button class="btn primary" data-mb="validate" data-k="${esc(key)}">Valider la proposition</button>` : ""}<button class="btn danger" data-mb="deledge" data-k="${esc(key)}">Supprimer la relation</button>`;
        }
        return `<div class="mb-card">${mbX}<h4 style="margin-bottom:12px">Relation</h4><div class="mb-rows">${mbRow(
          "Type",
          e.der || readOnly()
            ? mbTag(T.l, "b")
            : `<select class="mini-sel" data-mbsel="etype" data-k="${esc(key)}">${Object.entries(
                MB_E,
              )
                .filter(([k]) => k !== "part_of")
                .map(
                  ([k, x]) =>
                    `<option value="${k}" ${k === e.type ? "selected" : ""}>${esc(x.l)}</option>`,
                )
                .join("")}</select>`,
        )}${mbRow("Origine", nm(a, e.s))}${mbRow("Destination", nm(b, e.t))}${mbRow("Nature", mbTag(nat, e.der ? "g" : e.gen ? "o" : ""))}</div>
    <p class="note" style="margin-top:12px">${e.der ? "Pour la modifier, ouvrez l’objet source dans la plateforme (périmètre, objectifs, SWOT, fournisseur…)." : "Cette relation n’est enregistrée que dans la présentation de la carte. Les relations entre processus ne sont pas encore modélisées dans la plateforme (point à arbitrer avant la bascule dans l’application Docker)."}</p><div class="mb-acts">${acts}</div></div>`;
      }
      function mbInfoHtml(v) {
        const w = mbWork(v),
          s = (mbStore() || {})[v] || {},
          sync = mbSyncInfo(v),
          vers = (s.versions || []).slice().reverse();
        return `<div class="mb-card">${mbX}<h4 style="margin-bottom:10px">${v === "context" ? "Carte du contexte" : "Carte des processus"}</h4><div class="mb-rows">${mbRow("Objets", Object.keys(w.nodes).length)}${mbRow("Relations graphiques", (w.edges || []).length + ((w.edges || []).some((e) => e.gen) ? " dont " + (w.edges || []).filter((e) => e.gen).length + " à valider" : ""))}${mbRow("Enregistrée", s.updatedAt ? esc(mbDt(s.updatedAt)) : "Jamais")}${mbRow("Synchronisation", sync.miss.length || sync.news.length ? mbTag(sync.miss.length + " indisponible(s), " + sync.news.length + " nouveau(x)", "o") : mbTag("À jour", "g"))}</div>
    <div class="mb-sec"><h5>Historique des versions</h5>${
      vers.length
        ? `<ul class="mb-list">${vers
            .slice(0, 5)
            .map(
              (x) =>
                `<li><span><b>${esc(x.label || "Version")}</b><br><span class="note">${esc(mbDt(x.at))}</span></span></li>`,
            )
            .join("")}</ul>`
        : '<p class="note">Aucune version enregistrée.</p>'
    }${readOnly() ? "" : `<div class="mb-acts"><button class="btn" data-mb="versions">Gérer les versions</button></div>`}</div>
    <div class="mb-sec"><h5>Données et présentation</h5><p class="note">La carte ne stocke que la présentation (positions, tailles, relations graphiques et masquages). Les noms, codes, responsables et l’appartenance au périmètre sont relus dans la plateforme à chaque affichage.</p></div></div>`;
      }

      /* Boîtes de dialogue */
      function mbDialog(title, body, btns) {
        return new Promise((res) => {
          let d = document.getElementById("mbDlg");
          if (!d) {
            d = document.createElement("dialog");
            d.id = "mbDlg";
            d.className = "modal mbdlg";
            document.body.appendChild(d);
          }
          d.innerHTML = `<form class="dlg" method="dialog"><div class="dlg-h"><h2 style="font-size:18px">${esc(title)}</h2><button class="x" type="button" data-close="1" aria-label="Fermer"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="dlg-b">${body}</div><div class="dlg-foot">${btns.map(([v, l, c]) => `<button class="btn ${c || ""}" value="${v}">${esc(l)}</button>`).join("")}</div></form>`;
          const f = d.querySelector("form");
          d.querySelector("[data-close]").addEventListener("click", () =>
            d.close(""),
          );
          d.querySelectorAll("[data-filter]").forEach((i) =>
            i.addEventListener("input", () => {
              const q = i.value.toLowerCase();
              d.querySelectorAll(".mb-addl label").forEach(
                (l) => (l.hidden = !l.textContent.toLowerCase().includes(q)),
              );
            }),
          );
          d.onclose = () => {
            const fd = {};
            f.querySelectorAll("input,select,textarea").forEach((i) => {
              if (!i.name) return;
              if (i.type === "checkbox") {
                if (i.dataset.multi) {
                  fd[i.name] = fd[i.name] || [];
                  if (i.checked) fd[i.name].push(i.value);
                } else fd[i.name] = i.checked;
              } else if (i.type === "radio") {
                if (i.checked) fd[i.name] = i.value;
              } else fd[i.name] = i.value;
            });
            res({ v: d.returnValue || "", fd });
          };
          d.returnValue = "";
          d.showModal();
          const fi = d.querySelector("[autofocus]");
          if (fi) fi.focus();
        });
      }
      async function mbWizard() {
        const v = mbView(),
          w = mbWork(v);
        MB.objs = mbObjects();
        const all = [...MB.objs.values()],
          c = (t) => all.filter((o) => o.type === t).length;
        const cb = (n, l, chk, k) =>
          `<label><input type="checkbox" name="${n}" ${chk ? "checked" : ""}> ${l}${k != null ? ` <span class="note">(${k})</span>` : ""}</label>`;
        let body;
        if (v === "context") {
          const sp = all.filter((o) => o.type === "supplier"),
            spc = sp.filter((o) => o.crit || o.hds).length;
          body = `<p class="note">La carte est construite à partir des objets déjà saisis dans la plateforme puis disposée automatiquement : périmètre et pilotage au centre, parties intéressées à gauche, fournisseurs à droite, enjeux externes en haut et internes en bas.</p>
    <div><h3>Types d’objets</h3><div class="mb-chk">${cb("process", "Processus", 1, c("process"))}${cb("subprocess", "Sous-processus", 0, c("subprocess"))}${cb("stakeholder", "Parties intéressées", 1, c("stakeholder"))}${cb("supplier", "Fournisseurs", 1, sp.length)}${cb("external_issue", "Enjeux externes", 1, c("external_issue"))}${cb("internal_issue", "Enjeux internes", 1, c("internal_issue"))}${cb("application", "Applications (GAP)", 1, c("application"))}${cb("assets", "Sites et infrastructures", 1, c("site") + c("infrastructure"))}</div></div>
    <div><h3>Origine des enjeux</h3><div class="mb-chk">${cb("iss_obj", "Enjeux des objectifs", 1)}${cb("iss_swot", "Éléments des SWOT par processus", 1)}</div></div>
    <div><h3>Fournisseurs</h3><div class="mb-radio"><label><input type="radio" name="sups" value="crit" ${spc ? "checked" : ""}> Critiques ou hébergeurs HDS, et ceux liés à une application <span class="note">(${spc} qualifié${spc > 1 ? "s" : ""})</span></label><label><input type="radio" name="sups" value="all" ${spc ? "" : "checked"}> Tous les fournisseurs <span class="note">(${sp.length})</span></label></div></div>
    <div class="mb-chk" style="grid-template-columns:1fr 1fr"><label class="fld">Profondeur des relations<select name="depth"><option value="1">1 — liens directs avec le pilotage et le périmètre</option><option value="2" selected>2 — et dépendances indirectes</option><option value="3">3 — toutes les relations</option></select></label>${w ? `<label class="fld">Carte existante<select name="mode"><option value="replace">Remplacer la disposition</option><option value="complete">Compléter (conserver les positions)</option></select></label>` : ""}</div>`;
        } else
          body = `<p class="note">Les processus sont répartis en lignes selon leur famille (pilotage, réalisation, support) ; les sous-processus sont regroupés sous leur processus parent.</p>
    <div><h3>Objets</h3><div class="mb-chk">${cb("process", "Processus", 1, c("process"))}${cb("subprocess", "Sous-processus", 1, c("subprocess"))}</div></div>
    <div><h3>Relations proposées</h3><div class="mb-radio"><label><input type="checkbox" name="flows" checked> Flux principal entre processus de réalisation et entre processus de pilotage (dans l’ordre des codes)</label><label><input type="checkbox" name="lanes" checked> Processus de support et de pilotage vers chaque processus de réalisation</label></div><p class="note" style="margin-top:6px">Les relations entre processus n’existent pas encore dans les données de la plateforme : elles sont créées comme <b>propositions à valider</b> sur la carte.</p></div>
    ${w ? `<label class="fld">Carte existante<select name="mode"><option value="replace">Remplacer la disposition</option><option value="complete">Compléter (conserver les positions)</option></select></label>` : ""}`;
        const r = await mbDialog(
          v === "context"
            ? "Générer la carte du contexte"
            : "Générer la carte des processus",
          body,
          [
            ["", "Annuler"],
            ["go", "Générer", "primary"],
          ],
        );
        if (r.v !== "go") return;
        mbGenerate(v, r.fd);
      }
      async function mbGenerate(v, fd) {
        const objs = MB.objs,
          all = [...objs.values()],
          T = new Set(["isms", "scope"]);
        let refs = new Set();
        if (v === "context") {
          [
            "process",
            "subprocess",
            "stakeholder",
            "supplier",
            "external_issue",
            "internal_issue",
            "application",
          ].forEach((t) => {
            if (fd[t]) T.add(t);
          });
          if (fd.assets) {
            T.add("site");
            T.add("infrastructure");
          }
          const appSup = new Set(
            all
              .filter(
                (o) =>
                  o.type === "application" && T.has("application") && o.supRef,
              )
              .map((o) => o.supRef),
          );
          const ok = (o) =>
            T.has(o.type) &&
            (o.type !== "supplier" ||
              fd.sups === "all" ||
              o.crit ||
              o.hds ||
              appSup.has(o.ref)) &&
            (!/issue/.test(o.type) ||
              o.src.some(
                (s) =>
                  (s.k === "obj" && fd.iss_obj) ||
                  (s.k === "swot" && fd.iss_swot),
              ));
          const rel = mbRelations(objs),
            adj = new Map();
          rel.forEach((e) => {
            (adj.get(e.s) || adj.set(e.s, []).get(e.s)).push(e.t);
            (adj.get(e.t) || adj.set(e.t, []).get(e.t)).push(e.s);
          });
          refs = new Set(["isms", "scope"]);
          let front = ["isms", "scope"];
          const D = +fd.depth || 2;
          for (let d = 0; d < (D >= 3 ? 20 : D) && front.length; d++) {
            const nx = [];
            front.forEach((r) =>
              (adj.get(r) || []).forEach((t) => {
                const o = objs.get(t);
                if (o && !refs.has(t) && ok(o)) {
                  refs.add(t);
                  nx.push(t);
                }
              }),
            );
            front = nx;
          }
          if (D >= 2)
            all.forEach((o) => {
              if (o.type === "process" && ok(o)) refs.add(o.ref);
            });
        } else
          all.forEach((o) => {
            if (
              (o.type === "process" && fd.process) ||
              (o.type === "subprocess" && fd.subprocess)
            )
              refs.add(o.ref);
          });
        const n = refs.size;
        if (n > 400) {
          toast(
            "Plus de 400 objets : la génération est limitée. Réduisez les types sélectionnés.",
          );
          return;
        }
        if (
          n > 80 &&
          !(await askModal(
            `La carte comportera ${n} objets, ce qui risque d’être difficile à lire. Continuer ?`,
            { yes: "Générer quand même" },
          ))
        )
          return;
        const old = mbWork(v),
          complete = fd.mode === "complete" && old;
        mbMutOrInit(v, (w) => {
          if (!complete) {
            w.nodes = {};
            w.edges = (w.edges || []).filter((e) => !e.gen);
            w.hide = {};
          }
          if (complete) {
            [...refs]
              .filter((r) => !w.nodes[r])
              .forEach((r) => mbPlace(w, r, v));
          } else {
            const P =
              v === "context" ? mbLayoutContext(refs) : mbLayoutProcess(refs);
            Object.entries(P).forEach(([r, p]) => {
              const o = mbObj(r);
              w.nodes[r] = {
                x: Math.round(p.x),
                y: Math.round(p.y),
                w: Math.round(p.w),
                h: Math.round(p.h),
                label: o ? o.name : "",
              };
            });
          }
          if (v === "process" && (fd.flows || fd.lanes)) {
            const ex = new Set(
              (w.edges || []).map((e) => e.s + ">" + e.t + ":" + e.type),
            );
            mbProcessGenEdges(refs, {
              flows: fd.flows,
              lanes: fd.lanes,
            }).forEach((e) => {
              if (
                w.nodes[e.s] &&
                w.nodes[e.t] &&
                !ex.has(e.s + ">" + e.t + ":" + e.type)
              )
                w.edges.push(e);
            });
          }
          w.edges = w.edges.filter((e) => w.nodes[e.s] && w.nodes[e.t]);
          Object.keys(w.ignored).forEach((r) => {
            if (refs.has(r)) delete w.ignored[r];
          });
          const rel =
            v === "process"
              ? ["process", "subprocess"]
              : [
                  "process",
                  "stakeholder",
                  "external_issue",
                  "internal_issue",
                  "application",
                  "infrastructure",
                  "site",
                  "supplier",
                ];
          all.forEach((o) => {
            if (rel.includes(o.type) && !refs.has(o.ref) && !w.nodes[o.ref])
              w.ignored[o.ref] = 1;
          });
        });
        MB.sel = null;
        MB.vp[v] = null;
        delete (ui.mbVp || {})[v];
        render();
        toast(
          `Carte générée : ${Object.keys(mbWork(v).nodes).length} éléments. Pensez à l’enregistrer.`,
        );
      }
      function mbMutOrInit(v, fn) {
        if (!mbWork(v)) MB.work[v] = mbClean({});
        mbMut(fn);
      }
      function mbPlace(w, ref, v) {
        const o = mbObj(ref),
          sz = mbDefSize(v, o),
          objs = MB.objs,
          rel = mbRelations(objs),
          nb = rel
            .filter(
              (e) =>
                (e.s === ref && w.nodes[e.t]) || (e.t === ref && w.nodes[e.s]),
            )
            .map((e) => (e.s === ref ? e.t : e.s))
            .filter((r) => !mbIsCont(mbObj(r), w.nodes[r]));
        const cards = Object.entries(w.nodes)
            .filter(([r, n]) => !n.hidden && !mbIsCont(mbObj(r), n))
            .map(([r, n]) => n),
          free = (x, y) =>
            !cards.some(
              (n) =>
                x < n.x + n.w + 16 &&
                x + sz.w + 16 > n.x &&
                y < n.y + n.h + 16 &&
                y + sz.h + 16 > n.y,
            );
        let ax, ay;
        if (nb.length) {
          const a = w.nodes[nb[0]];
          ax = a.x;
          ay = a.y;
        } else {
          const bb = mbBBox(Object.values(w.nodes));
          ax = bb.x + bb.w + 60;
          ay = bb.y;
        }
        const step = [sz.w + 24, sz.h + 20];
        for (let rr = nb.length ? 1 : 0; rr < 30; rr++) {
          const C = [];
          for (let i = -rr; i <= rr; i++)
            C.push([rr, i], [i, rr], [-rr, i], [i, -rr]);
          for (const [i, j] of C) {
            const x = ax + i * step[0],
              y = ay + j * step[1];
            if (free(x, y)) {
              w.nodes[ref] = {
                x: Math.round(x),
                y: Math.round(y),
                w: sz.w,
                h: sz.h,
                label: o ? o.name : "",
              };
              cards.push(w.nodes[ref]);
              return;
            }
          }
        }
        w.nodes[ref] = {
          x: ax,
          y: ay + 400,
          w: sz.w,
          h: sz.h,
          label: o ? o.name : "",
        };
      }
      async function mbAddDialog() {
        const v = mbView(),
          w = mbWork(v);
        if (!w) return;
        const objs = MB.objs;
        const types =
          v === "process"
            ? ["process", "subprocess"]
            : [
                "process",
                "subprocess",
                "stakeholder",
                "external_issue",
                "internal_issue",
                "application",
                "site",
                "infrastructure",
                "supplier",
              ];
        const L = [...objs.values()].filter(
          (o) => types.includes(o.type) && !w.nodes[o.ref],
        );
        if (!L.length) {
          toast("Tous les objets de la plateforme figurent déjà sur la carte.");
          return;
        }
        const grp = {};
        L.forEach((o) => (grp[o.type] = grp[o.type] || []).push(o));
        const body = `<label class="pq" style="min-width:0"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="text" placeholder="Filtrer les objets" data-filter="1"></label>
    <div class="mb-addl">${types
      .filter((t) => grp[t])
      .map(
        (t) =>
          `<h6>${esc(MB_T[t].l)} (${grp[t].length})</h6>${grp[t].map((o) => `<label><input type="checkbox" name="r" data-multi="1" value="${esc(o.ref)}"><span>${o.code ? `<b>${esc(o.code)}</b> ` : ""}${esc(o.name)}<small>${esc(o.sub || "")}${w.ignored[o.ref] ? " — ignoré précédemment" : ""}</small></span></label>`).join("")}`,
      )
      .join("")}</div>
    <label class="fld">Ajouter aussi<select name="dep"><option value="0">L’objet seul</option><option value="1">L’objet et ses dépendances directes</option><option value="9">L’objet et tous les objets liés</option></select></label>`;
        const r = await mbDialog("Ajouter depuis la plateforme", body, [
          ["", "Annuler"],
          ["go", "Ajouter", "primary"],
        ]);
        if (r.v !== "go" || !(r.fd.r || []).length) return;
        const set = new Set(r.fd.r),
          D = +r.fd.dep || 0;
        if (D) {
          const rel = mbRelations(objs);
          let front = [...set];
          for (let d = 0; d < D && front.length; d++) {
            const nx = [];
            front.forEach((x) =>
              rel.forEach((e) => {
                const t = e.s === x ? e.t : e.t === x ? e.s : null;
                if (
                  t &&
                  !set.has(t) &&
                  !w.nodes[t] &&
                  types
                    .concat(["isms", "scope"])
                    .includes((objs.get(t) || {}).type) &&
                  (v === "context" || true)
                ) {
                  set.add(t);
                  nx.push(t);
                }
              }),
            );
            front = nx;
          }
        }
        mbMut((w2) => {
          [...set].forEach((x) => {
            if (!w2.nodes[x]) mbPlace(w2, x, v);
            delete w2.ignored[x];
          });
        });
        render();
        toast(
          set.size +
            " objet" +
            (set.size > 1 ? "s" : "") +
            " ajouté" +
            (set.size > 1 ? "s" : "") +
            " à la carte.",
        );
      }
      async function mbLinkDialog(s, t) {
        const a = mbObj(s),
          b = mbObj(t);
        const def = mbView() === "process" ? "flows_to" : "related_to";
        const r = await mbDialog(
          "Nouvelle relation",
          `<p class="note"><b>${esc(a ? a.name : s)}</b> → <b>${esc(b ? b.name : t)}</b></p><label class="fld">Type de relation<select name="type">${Object.entries(
            MB_E,
          )
            .filter(([k]) => k !== "part_of")
            .map(
              ([k, x]) =>
                `<option value="${k}" ${k === def ? "selected" : ""}>${esc(x.l)}</option>`,
            )
            .join(
              "",
            )}</select></label><p class="note">La relation est enregistrée dans la présentation de la carte (relation graphique). Elle n’ajoute aucune donnée métier.</p>`,
          [
            ["", "Annuler"],
            ["go", "Créer la relation", "primary"],
          ],
        );
        MB.link = null;
        if (r.v === "go") {
          mbMut((w) =>
            w.edges.push({
              id:
                "e" +
                Date.now().toString(36) +
                Math.random().toString(36).slice(2, 5),
              s,
              t,
              type: r.fd.type || def,
            }),
          );
          MB.sel = {
            k: "e",
            key: "m:" + mbWork().edges[mbWork().edges.length - 1].id,
          };
        }
        render();
      }
      async function mbVersions() {
        const v = mbView(),
          st = mbStore();
        const s = st[v] || {};
        const vers = s.versions || [];
        const body = `${mbWork(v) ? `<div style="display:flex;gap:8px;align-items:flex-end"><label class="fld" style="flex:1">Nouvelle version<input name="label" type="text" placeholder="Ex. Revue de direction 2026, validée en COPIL" autofocus></label><button class="btn primary" value="new">Enregistrer une version</button></div>` : ""}
    <div><h3>Versions enregistrées (${vers.length})</h3>${
      vers.length
        ? `<div class="mb-radio">${vers
            .slice()
            .reverse()
            .map(
              (x) =>
                `<label><input type="radio" name="sel" value="${esc(x.id)}"> <span><b>${esc(x.label || "Version")}</b><br><span class="note">${esc(mbDt(x.at))} — ${Object.keys((x.map || {}).nodes || {}).length} éléments</span></span></label>`,
            )
            .join("")}</div>`
        : '<p class="note">Aucune version. Une version fige la disposition actuelle (par exemple pour la présenter en revue de direction) ; 20 versions au plus sont conservées.</p>'
    }</div>`;
        const r = await mbDialog(
          "Versions de la carte",
          body,
          vers.length
            ? [
                ["", "Fermer"],
                ["del", "Supprimer la version", "danger"],
                ["restore", "Restaurer la version", "primary"],
              ]
            : [["", "Fermer"]],
        );
        if (r.v === "new") {
          const w = mbWork(v);
          s.versions = vers
            .concat([
              {
                id: "v" + Date.now().toString(36),
                at: nowTs(),
                label: r.fd.label || "Version du " + todayFr(),
                map: clone(w),
              },
            ])
            .slice(-20);
          await mbSave(v, s.versions);
          toast("Version enregistrée.");
          render();
        } else if (r.v === "restore" && r.fd.sel) {
          const x = vers.find((y) => y.id === r.fd.sel);
          if (x) {
            mbMutOrInit(v, (w) => {
              const m = mbClean(clone(x.map));
              Object.keys(w).forEach((k) => delete w[k]);
              Object.assign(w, m);
            });
            MB.vp[v] = null;
            render();
            toast(
              "Version restaurée : enregistrez pour la conserver comme carte courante.",
            );
          }
        } else if (r.v === "del" && r.fd.sel) {
          if (
            await askModal("Supprimer cette version ?", {
              yes: "Supprimer",
              danger: true,
            })
          ) {
            s.versions = vers.filter((y) => y.id !== r.fd.sel);
            st[v] = s;
            touch(false);
            await LegacyServer.flush();
            render();
          }
        }
      }
      async function mbSave(v, versions) {
        const st = mbStore(),
          w = mbWork(v);
        if (!w) return;
        Object.entries(w.nodes).forEach(([r, n]) => {
          const o = MB.objs && MB.objs.get(r);
          if (o) n.label = o.name;
        });
        const prev = st[v] || {};
        st[v] = Object.assign(clone(w), {
          versions: versions || prev.versions || [],
          updatedAt: nowTs(),
        });
        const draft = clone(w);
        touch(false);
        await LegacyServer.flush();
        MB.sRef = source();
        MB.work[v] = draft;
        MB.at[v] = st[v].updatedAt;
        MB.dirty[v] = false;
      }

      /* Exports */
      function mbExportSvg(v) {
        const w = mbWork(v);
        if (!w) return null;
        MB.objs = MB.objs || mbObjects();
        const sc = mbScene(v, { export: true }),
          bb = mbBBox(sc.nodes.map((x) => x[1])),
          pad = 40,
          head = 78,
          leg = 54,
          W = Math.round(bb.w + 2 * pad),
          H = Math.round(bb.h + 2 * pad + head + leg);
        const T =
            v === "context"
              ? "Cartographie du contexte pilotage"
              : "Cartographie des processus",
          b = brand();
        const L =
          v === "context"
            ? [
                ["#F6FAFF", "#6FA3F7", "Périmètre", 1],
                ["#FFFFFF", "#CFE0FA", "Élément interne"],
                ["#F8F5FF", "#DCCDF7", "Partie intéressée, fournisseur"],
                ["#FFF9F1", "#F4DCB9", "Enjeu"],
              ]
            : [
                ["#F8F5FF", "#E2D7F9", "Pilotage"],
                ["#F2F7FF", "#D5E4FA", "Réalisation"],
                ["#F1FAF4", "#CBE9D6", "Support"],
                ["#FFFFFF", "#C9D6E8", "Sous-processus", 1],
              ];
        let lx = pad;
        const lg =
          L.map(([f, s, l, d]) => {
            const x = lx;
            lx += l.length * 6.6 + 44;
            return `<rect x="${x}" y="${H - leg + 16}" width="20" height="14" rx="4" fill="${f}" stroke="${s}" stroke-width="1.5"${d ? ' stroke-dasharray="4 3"' : ""}/><text x="${x + 28}" y="${H - leg + 27}" font-size="12" fill="#66758F">${esc(l)}</text>`;
          }).join("") +
          [
            [
              "#1677FF",
              "",
              v === "context" ? "Lien principal" : "Flux principal",
            ],
            ["#1677FF", "5 4", "Dépendance, support"],
            ["#E98A15", "5 4", "Impact d’un enjeu"],
          ]
            .slice(0, v === "context" ? 3 : 2)
            .map(([c, d, l]) => {
              const x = lx;
              lx += l.length * 6.6 + 60;
              return `<path d="M${x} ${H - leg + 23}h26" stroke="${c}" stroke-width="2"${d ? ` stroke-dasharray="${d}"` : ""}/><text x="${x + 34}" y="${H - leg + 27}" font-size="12" fill="#66758F">${esc(l)}</text>`;
            })
            .join("");
        return {
          W,
          H,
          svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Sauge Inter', 'Segoe UI', Arial, sans-serif">${MB_DEFS}<rect width="${W}" height="${H}" fill="#FFFFFF"/><text x="${pad}" y="44" font-size="24" font-weight="700" fill="${MB_C.navy}">${esc(T)}</text><text x="${pad}" y="68" font-size="13" fill="#66758F">${esc(b.org)} — ${esc(todayFr())} — Référentiels : ${esc(mbStdOn().join(", ") || "aucun")}</text><line x1="${pad}" x2="${W - pad}" y1="${head}" y2="${head}" stroke="#DDE5EF"/><g transform="translate(${pad - bb.x} ${pad + head - bb.y})">${sc.svg}</g><line x1="${pad}" x2="${W - pad}" y1="${H - leg}" y2="${H - leg}" stroke="#DDE5EF"/>${lg}</svg>`,
        };
      }
      function mbCanvasOf(x, scale) {
        return new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement("canvas"),
              s = Math.min(scale, Math.sqrt(36e6 / (x.W * x.H)));
            c.width = Math.round(x.W * s);
            c.height = Math.round(x.H * s);
            const g = c.getContext("2d");
            g.fillStyle = "#fff";
            g.fillRect(0, 0, c.width, c.height);
            g.drawImage(img, 0, 0, c.width, c.height);
            res(c);
          };
          img.onerror = () => rej(new Error("svg"));
          img.src =
            "data:image/svg+xml;charset=utf-8," + encodeURIComponent(x.svg);
        });
      }
      const mbB64 = (d) => {
        const b = atob(d.split(",")[1]),
          u = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
        return u;
      };
      function mbPdf(jpg, iw, ih, title) {
        const PW = 1190.55,
          PH = 841.89,
          m = 24,
          sc = Math.min((PW - 2 * m) / iw, (PH - 2 * m) / ih),
          w = iw * sc,
          h = ih * sc,
          x = (PW - w) / 2,
          y = (PH - h) / 2,
          enc = new TextEncoder(),
          parts = [],
          offs = [];
        let len = 0;
        const push = (b) => {
            if (typeof b === "string") b = enc.encode(b);
            parts.push(b);
            len += b.length;
          },
          obj = (n, s) => {
            offs[n] = len;
            push(n + " 0 obj\n" + s + "\nendobj\n");
          };
        const ttl = String(title)
          .replace(
            /[^\x20-\x7E]/g,
            (c) =>
              ({
                é: "e",
                è: "e",
                ê: "e",
                à: "a",
                ç: "c",
                ô: "o",
                î: "i",
                É: "E",
                "’": "'",
              })[c] || "",
          )
          .replace(/[()\\]/g, "");
        push("%PDF-1.4\n");
        obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
        obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
        obj(
          3,
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`,
        );
        offs[4] = len;
        push(
          `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`,
        );
        push(jpg);
        push("\nendstream\nendobj\n");
        const cs = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im1 Do Q`;
        obj(5, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
        obj(6, `<< /Title (${ttl}) /Producer (Suivi pilotage) >>`);
        const xr = len;
        push(
          `xref\n0 7\n0000000000 65535 f \n${[1, 2, 3, 4, 5, 6].map((n) => String(offs[n]).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xr}\n%%EOF`,
        );
        const out = new Uint8Array(len);
        let p = 0;
        parts.forEach((b) => {
          out.set(b, p);
          p += b.length;
        });
        return out;
      }
      async function mbExport(kind) {
        const v = mbView(),
          x = mbExportSvg(v);
        if (!x) {
          toast("Aucune carte à exporter.");
          return;
        }
        const base = `Cartographie_${v === "context" ? "contexte" : "processus"}_${stamp()}`;
        try {
          if (kind === "svg") {
            await saveFile(base + ".svg", new TextEncoder().encode(x.svg));
            return;
          }
          if (kind === "json") {
            await saveFile(
              base + ".json",
              new TextEncoder().encode(
                JSON.stringify(
                  {
                    type: "pilotage-map-layout",
                    view: v,
                    exportedAt: nowTs(),
                    map: mbWork(v),
                  },
                  null,
                  1,
                ),
              ),
            );
            return;
          }
          toast("Préparation de l’export…");
          const c = await mbCanvasOf(x, kind === "pdf" ? 1.6 : 2);
          if (kind === "png") {
            const u = mbB64(c.toDataURL("image/png"));
            await saveFile(base + ".png", u);
            return;
          }
          const jpg = mbB64(c.toDataURL("image/jpeg", 0.92));
          await saveFile(
            base + ".pdf",
            mbPdf(
              jpg,
              c.width,
              c.height,
              v === "context"
                ? "Cartographie du contexte pilotage"
                : "Cartographie des processus",
            ),
          );
        } catch (e) {
          toast("L’export n’a pas pu être produit dans ce navigateur.");
        }
      }

      /* Ouverture des fiches de la plateforme sans quitter la carte (tiroir) ou par navigation */
      function mbNav(sec, sub) {
        const it = navDef()
          .flatMap((s) => s.items)
          .find((i) => i.id === sub);
        if (it) navGo(it);
      }
      function mbOpen(ref) {
        const o = mbObj(ref);
        if (!o || o.mapOnly) return;
        const id = ref.slice(ref.indexOf(":") + 1);
        if (o.type === "supplier") openSheet("sup", id);
        else if (o.type === "application") openSheet("gap", id);
        else if (o.type === "process" || o.type === "subprocess") {
          MB.sel = { k: "n", ref };
          MB.info = false;
          mbInsp();
          mbDraw();
        } else if (/issue/.test(o.type)) {
          const s = o.src[0];
          if (s.k === "obj") openSheet("obj", s.id);
          else {
            ui.swotProc = s.proc;
            ui.swotSel = s.id;
            mbNav("pil", "ctx-swot");
          }
        } else if (o.type === "stakeholder") mbNav("pil", "ctx-pi");
        else if (o.type === "scope")
          ctx.navigate("perimeters", {
            perimetersView: "registry",
            perimeterFocus: ui.mbScope,
          });
        else {
          MB.sel = { k: "n", ref };
          mbInsp();
        }
      }

      /* Gestion des actions */
      async function mbAct(el) {
        const a = el.dataset.mb,
          v = mbView();
        if (
          readOnly() &&
          [
            "wizard",
            "blank",
            "add",
            "edit",
            "link",
            "undo",
            "redo",
            "relayout",
            "save",
            "versions",
            "remove",
            "dropmiss",
            "ignorenew",
            "defsize",
            "hideedge",
            "deledge",
            "validate",
          ].includes(a)
        )
          return;
        switch (a) {
          case "view":
            if (ui.mbView !== el.dataset.v) {
              ui.mbView = el.dataset.v;
              MB.sel = null;
              MB.link = null;
              MB.info = false;
              saveUI();
              render();
            }
            break;
          case "wizard":
            if (!readOnly()) await mbWizard();
            break;
          case "blank":
            if (!readOnly()) {
              MB.work[v] = mbClean({});
              MB.dirty[v] = true;
              if (v === "context") {
                MB.objs = MB.objs || mbObjects();
                MB.work[v].nodes.isms = {
                  x: 0,
                  y: 0,
                  w: 300,
                  h: 116,
                  label: "",
                };
              }
              render();
            }
            break;
          case "add":
            if (!readOnly()) await mbAddDialog();
            break;
          case "edit":
            if (readOnly()) break;
            if (MB.edit) {
              MB.edit = false;
              MB.link = null;
              render();
              if (
                MB.dirty[v] &&
                (await askModal("Enregistrer les modifications de la carte ?", {
                  yes: "Enregistrer",
                  no: "Plus tard",
                }))
              ) {
                await mbSave(v);
                render();
                toast("Carte enregistrée.");
              }
            } else {
              MB.edit = true;
              render();
            }
            break;
          case "link":
            MB.link = MB.link ? null : { src: null };
            render();
            break;
          case "undo":
            mbUndo(false);
            break;
          case "redo":
            mbUndo(true);
            break;
          case "relayout":
            if (
              await askModal(
                "Recalculer la disposition ? Les positions manuelles de cette carte seront remplacées (vous pourrez annuler).",
                { yes: "Recalculer" },
              )
            ) {
              const w = mbWork(v),
                refs = new Set(
                  Object.keys(w.nodes).filter(
                    (r) => !mbMapOnly(r) && MB.objs.has(r),
                  ),
                );
              mbMut((w2) => {
                const P =
                  v === "context"
                    ? mbLayoutContext(refs)
                    : mbLayoutProcess(refs);
                Object.keys(w2.nodes).forEach((r) => {
                  if (mbMapOnly(r) && !P[r]) delete w2.nodes[r];
                });
                Object.entries(P).forEach(([r, p]) => {
                  w2.nodes[r] = Object.assign(w2.nodes[r] || {}, {
                    x: Math.round(p.x),
                    y: Math.round(p.y),
                    w: Math.round(p.w),
                    h: Math.round(p.h),
                  });
                });
              });
              MB.vp[v] = null;
              render();
            }
            break;
          case "save":
            await mbSave(v);
            render();
            toast("Carte enregistrée.");
            break;
          case "versions":
            await mbVersions();
            break;
          case "info":
            MB.info = !MB.info;
            if (MB.info) MB.sel = null;
            mbInsp();
            el.classList.toggle("on", MB.info);
            mbDraw();
            break;
          case "panel":
            ui.mbLeftOff = !ui.mbLeftOff;
            saveUI();
            render();
            break;
          case "full":
            MB.full = !MB.full;
            render();
            break;
          case "closeinsp":
            MB.sel = null;
            MB.info = false;
            mbInsp();
            mbDraw();
            document
              .querySelectorAll('[data-mb="info"]')
              .forEach((b) => b.classList.remove("on"));
            break;
          case "zin":
            mbZoom(1.25);
            break;
          case "zout":
            mbZoom(0.8);
            break;
          case "fit":
            mbFit();
            break;
          case "preset":
            ui.mbPre = ui.mbPre || {};
            ui.mbPre[v] = el.dataset.k;
            render();
            break;
          case "goto": {
            const r = el.dataset.r,
              w = mbWork(v);
            if (w && w.nodes[r]) {
              MB.sel = { k: "n", ref: r };
              const n = w.nodes[r];
              mbCenter(n.x + n.w / 2, n.y + n.h / 2);
              mbDraw();
              mbInsp();
              mbSaveVp();
            } else if (MB.objs.has(r)) mbOpen(r);
            break;
          }
          case "remove": {
            const r = el.dataset.r;
            mbMut((w) => {
              delete w.nodes[r];
              w.edges = w.edges.filter((e) => e.s !== r && e.t !== r);
              if (!mbMapOnly(r)) w.ignored[r] = 1;
            });
            MB.sel = null;
            render();
            toast("Objet retiré de la carte (il reste dans la plateforme).");
            break;
          }
          case "dropmiss": {
            const miss = mbSyncInfo(v).miss;
            mbMut((w) => {
              miss.forEach((r) => {
                delete w.nodes[r];
                w.edges = w.edges.filter((e) => e.s !== r && e.t !== r);
              });
            });
            render();
            break;
          }
          case "ignorenew": {
            const nw = mbSyncInfo(v).news;
            mbMut((w) => nw.forEach((o) => (w.ignored[o.ref] = 1)));
            render();
            break;
          }
          case "defsize": {
            const r = el.dataset.r,
              o = mbObj(r),
              sz = mbDefSize(v, o);
            mbMut((w) => {
              Object.assign(w.nodes[r], sz);
            });
            mbDraw();
            mbBarRefresh();
            break;
          }
          case "hideedge": {
            const k = el.dataset.k;
            mbMut((w) => {
              w.hide[k] = 1;
            });
            MB.sel = null;
            render();
            break;
          }
          case "deledge": {
            const k = el.dataset.k;
            mbMut((w) => {
              w.edges = w.edges.filter((e) => "m:" + e.id !== k);
            });
            MB.sel = null;
            render();
            break;
          }
          case "validate": {
            const k = el.dataset.k;
            mbMut((w) => {
              const e = w.edges.find((x) => "m:" + x.id === k);
              if (e) delete e.gen;
            });
            render();
            break;
          }
          case "openswot":
            ui.swotProc = el.dataset.p;
            ui.swotSel = null;
            mbNav("pil", "ctx-swot");
            break;
          case "openproc":
            mbNav("pil", "proc");
            break;
          case "nav":
            mbNav(el.dataset.sec, el.dataset.sub);
            break;
          case "xpng":
          case "xpdf":
          case "xsvg":
          case "xjson": {
            const d = el.closest("details");
            if (d) d.open = false;
            await mbExport(a.slice(1));
            break;
          }
        }
      }
      if (!window.__legacyMbBound) {
        window.__legacyMbBound = 1;
        document.addEventListener("click", (e) => {
          const el = e.target.closest("[data-mb]");
          if (!el || el.disabled) return;
          if (el.closest("#mbDlg") && !el.dataset.mb) return;
          e.preventDefault();
          mbAct(el).catch((err) => toast(err.message));
        });
        document.addEventListener("change", async (e) => {
          const el = e.target;
          if (el.id === "mbScope") {
            if (
              Object.values(MB.dirty).some(Boolean) &&
              !(await askModal(
                "Changer de périmètre ? Les modifications non enregistrées seront abandonnées.",
                { yes: "Changer", no: "Rester" },
              ))
            ) {
              el.value = ui.mbScope;
              return;
            }
            ui.mbScope = el.value;
            MB.work = {};
            MB.dirty = {};
            MB.sRef = null;
            saveUI();
            render();
            return;
          }
          if (el.dataset.mbchk) {
            const k = el.dataset.mbchk;
            if (k === "std") {
              ui.mbStd = ui.mbStd || {};
              ui.mbStd[el.dataset.k] = el.checked;
            } else if (k === "sec") ui.mbSec = el.checked;
            else if (k === "gen") ui.mbGen = el.checked;
            saveUI();
            mbDraw();
            return;
          }
          if (el.dataset.mbsel === "ikind") {
            if (readOnly()) return;
            const o = MB.objs.get(el.dataset.r);
            mbMut((w) => {
              w.issueKind ||= {};
              if (o && el.value === o.auto) delete w.issueKind[el.dataset.r];
              else w.issueKind[el.dataset.r] = el.value;
            });
            mbBarRefresh();
            MB.objs = mbObjects();
            mbDraw();
            mbInsp();
            toast(
              "Nature de l’enjeu mise à jour. Utilisez « Disposition automatique » pour le déplacer dans la bonne bande.",
            );
            return;
          }
          if (el.dataset.mbsel === "etype") {
            const k = el.dataset.k;
            mbMut((w) => {
              const e = w.edges.find((x) => "m:" + x.id === k);
              if (e) e.type = el.value;
            });
            mbDraw();
            mbBarRefresh();
          }
        });
        document.addEventListener("keydown", (e) => {
          if (ui.tab !== "carto" || document.querySelector("dialog[open]"))
            return;
          const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
          if (typing) return;
          const v = mbView();
          if (e.key === "Escape") {
            if (MB.link) {
              MB.link = null;
              render();
            } else if (MB.sel || MB.info) {
              MB.sel = null;
              MB.info = false;
              mbInsp();
              mbDraw();
            }
          }
          if (!MB.edit || readOnly()) return;
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
            e.preventDefault();
            mbUndo(e.shiftKey);
          } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
            e.preventDefault();
            mbUndo(true);
          } else if ((e.key === "Delete" || e.key === "Backspace") && MB.sel) {
            e.preventDefault();
            const s = MB.sel;
            if (s.k === "n") mbAct({ dataset: { mb: "remove", r: s.ref } });
            else if (s.k === "e")
              mbAct({
                dataset: {
                  mb: s.key.startsWith("m:") ? "deledge" : "hideedge",
                  k: s.key,
                },
              });
          } else if (MB.sel && MB.sel.k === "n" && /^Arrow/.test(e.key)) {
            e.preventDefault();
            const st = e.shiftKey ? 20 : 4,
              r = MB.sel.ref;
            mbMut((w) => {
              const n = w.nodes[r];
              if (!n) return;
              if (e.key === "ArrowLeft") n.x -= st;
              if (e.key === "ArrowRight") n.x += st;
              if (e.key === "ArrowUp") n.y -= st;
              if (e.key === "ArrowDown") n.y += st;
            });
            mbDraw();
            mbBarRefresh();
          }
        });
        window.addEventListener("resize", () => {
          if (ui.tab === "carto") {
            mbSize();
            mbMini();
          }
        });
        window.addEventListener("beforeunload", (e) => {
          if (Object.values(MB.dirty).some(Boolean)) {
            e.preventDefault();
            e.returnValue = "";
          }
        });
      }

      ICONS.carto =
        '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><path d="M7 5h10M6 7l5 10M18 7l-5 10"/>';
      ctx.NAV_DEF.mbView = "context";
      ctx.TABS.push({
        id: "carto",
        label: () => "Cartographies",
        view: viewCarto,
        after: mbMount,
      });
      return { view: viewCarto };
    },
  };
})();

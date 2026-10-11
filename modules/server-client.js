/* Adaptateur de persistance : le serveur est la source de vérité en mode connecté. */
(function () {
  "use strict";
  let session = null,
    version = 0,
    adapter = null,
    saving = false,
    pending = null,
    broken = false;
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  async function request(path, options = {}) {
    const r = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body instanceof Blob
          ? {}
          : { "Content-Type": "application/json" }),
        ...(session ? { "X-CSRF-Token": session.csrf } : {}),
        ...options.headers,
      },
    });
    if (!r.ok) {
      let body;
      try {
        body = await r.json();
      } catch {}
      const error = Error(body?.error || "Serveur indisponible.");
      error.status = r.status;
      throw error;
    }
    return r.status === 204 ? null : options.blob ? r.blob() : r.json();
  }
  function mask(title, text) {
    let el = document.getElementById("legacy-session");
    if (!el) {
      el = document.createElement("section");
      el.id = "legacy-session";
      document.body.appendChild(el);
    }
    el.innerHTML = `<div class="lx-login"><span class="lx-eyebrow">Pilotage · Legacy</span><h1>${esc(title)}</h1><p>${esc(text)}</p></div>`;
    return el;
  }
  async function authenticate() {
    let current;
    try {
      current = await request("/api/session");
    } catch (e) {
      mask(
        "Démarrer le serveur Legacy",
        "Lancez demarrer.py ou demarrer.bat. Le parcours intégré exige le serveur local pour sauvegarder et contrôler les accès.",
      );
      throw e;
    }
    if (current.user) {
      session = current;
      return session;
    }
    return new Promise((resolve) => {
      const el = mask(
        current.configured ? "Connexion" : "Bienvenue dans votre pilotage",
        "Les données et les pièces restent sur votre serveur local.",
      );
      el.querySelector("div").insertAdjacentHTML(
        "beforeend",
        `<form id="lx-auth">${!current.configured ? '<label>Votre nom<input name="name" required maxlength="200" autocomplete="name"></label>' : ""}<label>Identifiant<input name="login" minlength="3" maxlength="80" required autocomplete="username"></label><label>Mot de passe<input name="password" type="password" minlength="${current.configured ? 1 : 12}" maxlength="200" required autocomplete="${current.configured ? "current-password" : "new-password"}"></label><p>${current.configured ? (current.testAccountAvailable ? "Compte de test : admin / admin." : "") : "Créez votre premier compte administrateur. Au moins 12 caractères pour le mot de passe."}</p><p role="alert" id="lx-auth-error"></p><button class="btn primary" type="submit">${current.configured ? "Se connecter" : "Créer mon accès"}</button></form>`,
      );
      el.querySelector("form").onsubmit = async (e) => {
        e.preventDefault();
        const b = el.querySelector("button");
        b.disabled = true;
        try {
          session = await request(
            current.configured ? "/api/login" : "/api/setup",
            {
              method: "POST",
              body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
            },
          );
          resolve(session);
        } catch (e) {
          el.querySelector("#lx-auth-error").textContent = e.message;
          b.disabled = false;
        }
      };
    });
  }
  async function start(context) {
    adapter = context;
    await authenticate();
    const data = await request("/api/state");
    version = data.version;
    return data.state;
  }
  function ready() {
    document.getElementById("legacy-session")?.remove();
    let bar = document.getElementById("lx-account");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "lx-account";
      bar.className = "lx-account";
      document.body.appendChild(bar);
    }
    bar.innerHTML = `<span>${esc(session.user.name)} · ${esc({ admin: "Administrateur", editor: "Contributeur", viewer: "Lecture" }[session.user.permission])}</span><span id="lx-save-state" role="status">Sauvegardé sur le serveur</span><button class="btn" id="lx-logout">Déconnexion</button>`;
    bar.querySelector("button").onclick = async () => {
      await flush();
      await request("/api/logout", { method: "POST", body: "{}" });
      location.reload();
    };
  }
  function status(text, error = false) {
    const el = document.getElementById("lx-save-state");
    if (el) {
      el.textContent = text;
      el.classList.toggle("lx-error", error);
    }
  }
  async function drain() {
    if (saving || !pending || broken) return;
    saving = true;
    const snapshot = pending;
    pending = null;
    status("Enregistrement…");
    try {
      const data = await request("/api/state", {
        method: "PUT",
        body: JSON.stringify({ version, state: snapshot }),
      });
      version = data.version;
      if (!pending) adapter?.ack(data.state);
      status("Sauvegardé sur le serveur");
    } catch (e) {
      broken = true;
      pending = snapshot;
      status(
        e.status === 409
          ? "Conflit : exportez votre saisie puis rechargez"
          : "Sauvegarde refusée : " + e.message,
        true,
      );
      adapter?.error(e);
      throw e;
    } finally {
      saving = false;
    }
    if (pending) return drain();
  }
  function save(state) {
    if (!session) return Promise.resolve();
    pending = JSON.parse(JSON.stringify(state));
    return drain();
  }
  async function flush() {
    if (broken)
      throw Error(
        "Sauvegarde en attente : exportez votre saisie avant de recharger.",
      );
    while (saving) await new Promise((r) => setTimeout(r, 40));
    if (pending) await drain();
  }
  async function refresh() {
    await flush();
    const data = await request("/api/state");
    if (data.version !== version) {
      version = data.version;
      adapter?.replace(data.state);
    }
    return data;
  }
  const localStore = window.LegacyDFStore;
  const localGet = localStore.get,
    localLoad = localStore.loadState;
  localStore.get = (key) =>
    session
      ? request("/api/files/" + encodeURIComponent(key), { blob: true }).catch(
          (e) => {
            if (e.status === 404 && session.user.permission === "admin")
              return localGet(key);
            throw e;
          },
        )
      : localGet(key);
  localStore.put = (key, blob) =>
    session
      ? request("/api/files/" + encodeURIComponent(key), {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": blob.type || "application/octet-stream" },
        })
      : Promise.reject(Error("Connexion requise."));
  // deposit() capturait les fonctions IndexedDB lexicales : utiliser ici les mêmes contrôles et métadonnées.
  localStore.deposit = async (state, evidenceId, file) => {
    const C = LegacyDF;
    if (!file || !file.size || file.size > localStore.MAX_FILE)
      throw Error("Pièce non vide de 20 Mo maximum.");
    if (!state.evidences.some((p) => p.id === evidenceId))
      throw Error("Preuve introuvable.");
    const key = C.id("FILE"),
      sha256 = await localStore.hash(file);
    await localStore.put(key, file);
    return C.addProofVersion(state, evidenceId, {
      fileKey: key,
      name: file.name,
      size: file.size,
      mime: file.type,
      sha256,
    });
  };
  localStore.checkedBlob = async (v) => {
    const b = await localStore.get(v.fileKey);
    if (!b || b.size !== v.size || (await localStore.hash(b)) !== v.sha256)
      throw Error("Pièce absente ou altérée : " + v.name);
    return b;
  };
  // zipFiles() utilisait checkedBlob lexical : centraliser également les exports sur l'API protégée.
  localStore.zipFiles = async (zip, evidences) => {
    const rows = [],
      vs = evidences.flatMap((p) => p.dfVersions || p.versions || []);
    if (
      vs.length > 3000 ||
      vs.reduce((n, v) => n + v.size, 0) > 95 * 1024 * 1024
    )
      throw Error("Sauvegarde de pièces trop volumineuse.");
    for (const p of evidences)
      for (const v of p.dfVersions || p.versions || []) {
        const blob = await localStore.checkedBlob(v),
          path =
            "pieces/" +
            p.id.replace(/[^\w-]/g, "_") +
            "/" +
            v.id.replace(/[^\w-]/g, "_") +
            "/" +
            localStore.fileName(v.name);
        zip.file(path, await blob.arrayBuffer());
        rows.push({
          fileKey: v.fileKey,
          path,
          sha256: v.sha256,
          size: v.size,
          mime: v.mime,
        });
        v.exportPath = path;
      }
    return rows;
  };
  localStore.backup = async (state) => {
    await flush();
    const zip = new JSZip(),
      copy = LegacyDF.clone(state),
      files = await localStore.zipFiles(zip, copy.evidences),
      text = JSON.stringify(copy, null, 2);
    if (
      files.reduce((n, f) => n + f.size, 0) +
        new TextEncoder().encode(text).length >
      localStore.MAX_ARCHIVE
    )
      throw Error("Sauvegarde dépassant 100 Mo.");
    zip.file("data/state.json", text);
    zip.file(
      "manifest.json",
      JSON.stringify(
        {
          format: "legacy-df-backup",
          version: 1,
          createdAt: LegacyDF.now(),
          stateSha256: await localStore.hash(text),
          files,
        },
        null,
        2,
      ),
    );
    return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  };
  localStore.saveState = (state) => save(state);
  localStore.loadState = () => (session ? Promise.resolve(null) : localLoad());
  localStore.restore = async (prepared) => {
    if (session?.user.permission !== "admin")
      throw Error("Restauration réservée à l’administration.");
    for (const f of prepared.blobs) {
      try {
        await localStore.put(f.key, f.blob);
      } catch (e) {
        if (e.status !== 409) throw e;
        const b = await request("/api/files/" + encodeURIComponent(f.key), {
          blob: true,
        });
        if ((await localStore.hash(b)) !== (await localStore.hash(f.blob)))
          throw Error("Collision de pièce : restauration annulée.");
      }
    }
    await save(prepared.state);
    await flush();
    return prepared.state;
  };
  async function loadOld() {
    return localLoad();
  }
  async function importOldFiles(state) {
    for (const p of state.evidences || [])
      for (const v of p.dfVersions || []) {
        const b = await localGet(v.fileKey);
        if (!b)
          throw Error(
            "Ancienne pièce introuvable. Restaurez une sauvegarde complète ZIP avant de poursuivre.",
          );
        try {
          await localStore.put(v.fileKey, b);
        } catch (e) {
          if (e.status !== 409) throw e;
        }
      }
  }
  window.LegacyServer = {
    request,
    start,
    ready,
    save,
    flush,
    refresh,
    loadOld,
    importOldFiles,
    user: () => session?.user,
    users: async () => (await request("/api/users")).users,
    canValidate: () => !!session?.user.canValidate,
  };
  window.addEventListener("beforeunload", (e) => {
    if (saving || pending || broken) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  setInterval(() => {
    if (
      session &&
      document.visibilityState === "visible" &&
      !document.querySelector("dialog[open]") &&
      !document.activeElement?.matches("input,textarea,select") &&
      !pending &&
      !saving &&
      !broken
    )
      refresh().catch((e) => {
        status(e.message, true);
      });
  }, 15000);
})();

/* Suivi des audits SMSI — intégration de l'outil historique (fichier unique) au serveur, sous /legacy.
   Remplace l'API window.claude de l'artefact d'origine :
   - use('artifact').publish({'data/state.json':…}) -> PUT /api/legacy/state (contrôle de version If-Match, jeton CSRF)
   - use('downloads').save({filename,data})          -> téléchargement navigateur
   Ajoute : menu vers la nouvelle interface, bandeau des modules repris (« Module géré dans la nouvelle interface »),
   avertissement en temps réel quand un autre utilisateur enregistre. Configuration : window.__SUIVI (injectée par le serveur). */
(function () {
  'use strict';
  var CFG = window.__SUIVI || { roles: [], canWrite: false, admin: false, readOnly: [], user: '', csrf: '', takenOver: [] };
  var KEY = 'suivi-audits-smsi:v1';
  // Ouverture directe d'une page depuis le menu de la nouvelle interface : /legacy/#ouvrir=<onglet>&<vue>=<valeur>.
  // L'onglet et la sous-vue sont écrits dans les préférences d'affichage lues par l'outil au démarrage (ce script
  // s'exécute avant lui) ; les droits restent appliqués par __SUIVI_ALLOW_PAGE. Seuls des identifiants simples passent.
  (function ouvrirPage() {
    var m = /^#ouvrir=([a-z]{2,20})((?:&[a-z]{2,10}View=[A-Za-z-]{1,12})?)$/.exec(location.hash || '');
    if (!m) return;
    try {
      var cle = 'suivi-audits-smsi:ui';
      var pref = JSON.parse(localStorage.getItem(cle) || '{}') || {};
      pref.tab = m[1];
      if (m[2]) {
        // Nom de vue pris dans la liste fixe des préférences de l'outil, jamais recopié depuis l'adresse.
        var kv = m[2].slice(1).split('=');
        var VUES = ['confView', 'crView', 'crrcView', 'ctxView', 'dashView', 'ecView', 'iaView', 'incView', 'invView',
          'orgaView', 'pilView', 'planView', 'prvView', 'repView', 'supView'];
        for (var i = 0; i < VUES.length; i++) if (VUES[i] === kv[0]) pref[VUES[i]] = kv[1];
      }
      localStorage.setItem(cle, JSON.stringify(pref));
    } catch (e) { /* stockage indisponible : l'outil s'ouvre sur sa page habituelle */ }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sans effet */ }
  })();
  var STATE_URL = '/api/legacy/state';
  function importExportDisabled() { return CFG.disabledModules && CFG.disabledModules.indexOf('import_export') !== -1; }
  function transferAction(action) { return /^(exp|json)/.test(action || '') || ['import', 'reset', 'tpl', 'tplblank', 'rectpl', 'xls', 'xlsx', 'docx', 'pptx', 'xexport', 'ximport', 'xlsimport', 'crexport', 'crimport', 'crxls', 'crrepx', 'invexp', 'tenacyx', 'gen'].indexOf(action) !== -1; }
  function hideTransfers() {
    if (!importExportDisabled()) return;
    document.querySelectorAll('[data-act]').forEach(function (button) {
      if (transferAction(button.getAttribute('data-act'))) { button.hidden = true; button.disabled = true; }
    });
  }
  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-act]');
    if (button && importExportDisabled() && transferAction(button.getAttribute('data-act'))) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);

  var etag = null;
  // Les groupes historiques mélangent plusieurs modules : filtrage par sous-menu.
  function pageModule(item) {
    var tab = item.tab;
    if (tab === 'dash') return null;
    if (tab === 'conformite') return item.set && item.set.confView === 'fw' ? 'conformite' : 'audit';
    if (tab === 'fournisseurs') return item.set && item.set.supView === 'ar' ? 'pilotage' : 'fournisseurs';
    if (tab === 'rapports') return item.set && item.set.repView === 'exp' ? 'import_export' : 'pilotage';
    return { cibles: 'audit', couverture: 'audit', orga: 'plan_audit', contexte: 'pilotage', pilotage: 'pilotage', ecarts: 'ecarts', supeval: 'fournisseurs', preuves: 'pilotage', plans: 'pilotage', gapapp: 'conformite', ia: 'ia', crrc: 'crrc', invest: 'investissements', incidents: 'incidents', crise: 'incidents' }[tab];
  }
  window.__SUIVI_FILTER_NAV = function (nav) {
    if (!CFG.enabled) return nav;
    return nav.map(function (section) {
      var copy = Object.assign({}, section);
      copy.items = section.items.filter(function (item) { var module = pageModule(item); return module === null || CFG.enabled.indexOf(module) !== -1; });
      if (copy.groups) copy.groups = copy.groups.filter(function (group) { return copy.items.some(function (item) { return item.g === group.id; }); });
      return copy;
    }).filter(function (section) { return section.items.length > 0; });
  };
  window.__SUIVI_MASK_OBJECTS = function (data) {
    Object.keys(CFG.emptyObjects || {}).forEach(function (key) { data[key] = JSON.parse(JSON.stringify(CFG.emptyObjects[key])); });
  };
  window.__SUIVI_ALLOW_PAGE = function (ui) {
    if (!CFG.enabled || ui.tab === 'dash') return true;
    var module = pageModule({ tab: ui.tab, set: { confView: ui.confView, supView: ui.supView, repView: ui.repView } });
    return CFG.enabled.indexOf(module) !== -1;
  };
  try {
    var versionKey = 'suivi-audits-smsi:activation';
    if (localStorage.getItem(versionKey) !== String(CFG.activationVersion)) localStorage.removeItem(KEY);
    localStorage.setItem(versionKey, String(CFG.activationVersion));
  } catch (e) { /* stockage local indisponible */ }


  try { localStorage.setItem('suivi-audits-smsi:ro', CFG.canWrite ? '0' : '1'); } catch (e) { /* stockage local indisponible : sans effet */ }

  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  var ready = fetch(STATE_URL, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' })
    .then(function (r) { etag = r.headers.get('ETag'); }).catch(function () {});

  function el(tag, cls, text) { var x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; }
  function css() {
    if (document.getElementById('suivi-shim-css')) return;
    var s = el('style'); s.id = 'suivi-shim-css';
    s.textContent = '.sv-banner{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;max-width:min(680px,calc(100% - 24px));background:#B42318;color:#fff;border-radius:10px;padding:12px 16px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);display:flex;flex-direction:column;gap:10px}' +
      '.sv-banner.sv-info{background:#14213D}' +
      '.sv-banner .sv-act{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}.sv-banner button,.sv-banner a{border:1px solid #fff;background:transparent;color:#fff;border-radius:6px;padding:6px 12px;font:600 13px system-ui,sans-serif;cursor:pointer;text-decoration:none}.sv-banner .sv-p{background:#fff;color:#B42318}.sv-banner.sv-info .sv-p{color:#14213D}' +
      '.sv-taken{position:fixed;left:16px;bottom:16px;z-index:8999;max-width:min(520px,calc(100% - 200px));background:#FBEBD9;color:#7A3A06;border:1px solid #F0C48A;border-radius:10px;padding:8px 12px;font:13px/1.4 system-ui,sans-serif}' +
      '.sv-menu{position:fixed;right:16px;bottom:16px;z-index:9000;font:14px system-ui,sans-serif}.sv-menu>button{border:0;border-radius:999px;background:#14213D;color:#fff;padding:9px 14px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer;display:flex;gap:8px;align-items:center}' +
      '.sv-menu>button i{width:8px;height:8px;border-radius:50%;background:#4CC38A;display:inline-block}.sv-menu>button i.ro{background:#F0A04B}' +
      '.sv-menu ul{position:absolute;right:0;bottom:calc(100% + 8px);list-style:none;margin:0;padding:6px;background:#fff;color:#14213D;border:1px solid #D2D9D8;border-radius:10px;min-width:240px;box-shadow:0 10px 30px rgba(0,0,0,.18)}' +
      '.sv-menu li a,.sv-menu li button{display:block;width:100%;text-align:left;border:0;background:none;padding:8px 10px;border-radius:6px;color:inherit;text-decoration:none;font:inherit;cursor:pointer}.sv-menu li a:hover,.sv-menu li button:hover{background:#F5F8F7}' +
      '.sv-menu li.sv-h{padding:6px 10px 8px;color:#51607A;font-size:12.5px;border-bottom:1px solid #E3E8E7;margin-bottom:4px}';
    document.head.appendChild(s);
  }
  function banner(msg, actions, info) {
    css();
    var b = document.getElementById('sv-banner');
    if (!b) { b = el('div', 'sv-banner'); b.id = 'sv-banner'; b.setAttribute('role', 'alert'); document.body.appendChild(b); }
    b.className = 'sv-banner' + (info ? ' sv-info' : '');
    b.replaceChildren(el('div', '', msg));
    var bar = el('div', 'sv-act');
    actions.forEach(function (a) {
      var x;
      if (a.href) { x = el('a', a.primary ? 'sv-p' : '', a.label); x.href = a.href; }
      else { x = el('button', a.primary ? 'sv-p' : '', a.label); x.type = 'button'; x.onclick = a.run; }
      bar.appendChild(x);
    });
    b.appendChild(bar);
  }
  function closeBanner() { var b = document.getElementById('sv-banner'); if (b) b.remove(); }
  function reloadServer() { try { localStorage.removeItem(KEY); } catch (e) { /* stockage local indisponible : sans effet */ } location.reload(); }

  async function put(content, force) {
    await ready;
    var h = { 'Content-Type': 'application/json', 'X-CSRF-Token': CFG.csrf };
    if (etag && !force) h['If-Match'] = etag;
    var r;
    try { r = await fetch(STATE_URL, { method: 'PUT', headers: h, body: content, credentials: 'same-origin', cache: 'no-store' }); }
    catch (e) { throw err('upstream_error'); }
    if (r.ok) { etag = r.headers.get('ETag') || etag; closeBanner(); return; }
    var j = {}; try { j = await r.json(); } catch (e) { /* stockage local indisponible : sans effet */ }
    if (r.status === 401) {
      banner('Votre session a expiré. Vos modifications sont conservées dans ce navigateur : reconnectez-vous puis utilisez « Enregistrer en ligne ».', [
        { label: 'Se reconnecter', primary: true, href: '/login?next=/legacy/' }]);
      throw err('conflict');
    }
    if (r.status === 409 && j.reason === 'module_taken_over') {
      banner((j.error || 'Module géré dans la nouvelle interface.') + ' Vos modifications sur ce module ne sont pas enregistrées.', [
        { label: 'Recharger la version du serveur', primary: true, run: reloadServer },
        { label: 'Ouvrir la nouvelle interface', href: '/' }]);
      throw err('conflict');
    }
    if (r.status === 403 && j.reason === 'permission') {
      banner((j.error || 'Droits insuffisants.') + ' Vos modifications sur ce module ne sont pas enregistrées.', [
        { label: 'Recharger la version du serveur', primary: true, run: reloadServer }]);
      throw err('conflict');
    }
    if (r.status === 403) throw err('not_writer');
    if (r.status === 412) {
      banner('Les données ont été modifiées par ' + (j.by || 'un autre utilisateur') + ' depuis votre chargement. Vos modifications ne sont pas encore enregistrées sur le serveur.', [
        { label: 'Recharger la version du serveur', primary: true, run: reloadServer },
        { label: 'Écraser avec ma version', run: function () { closeBanner(); put(content, true).catch(function () {}); } }]);
      throw err('conflict');
    }
    if (r.status === 413 || r.status === 422) throw err('invalid_content');
    if (r.status === 429) throw err('rate_limited');
    throw err('upstream_error');
  }

  function toBlob(d) { if (d instanceof Blob) return d; if (typeof d === 'string') return new Blob([d], { type: 'text/plain;charset=utf-8' }); return new Blob([d]); }
  var artifact = {
    publish: function (files) {
      if (!CFG.canWrite) return Promise.reject(err('not_writer'));
      if (typeof files === 'string') return Promise.reject(err('capability_disabled'));
      var f = files && files['data/state.json'];
      return f ? put(f.content, false) : Promise.reject(err('invalid_content'));
    }
  };
  var downloads = {
    save: function (o) {
      var url = URL.createObjectURL(toBlob(o.data)), a = document.createElement('a');
      a.href = url; a.download = o.filename || 'export'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      return Promise.resolve();
    }
  };
  window.claude = {
    use: function (name) {
      if (name === 'downloads') return importExportDisabled() ? Promise.reject(err('module_disabled', 'Import et export désactivés.')) : Promise.resolve(downloads);
      if (name === 'artifact') return CFG.canWrite ? Promise.resolve(artifact) : Promise.reject(err('not_granted'));
      return Promise.reject(err('not_declared'));
    }
  };

  // Temps réel : avertir quand un autre utilisateur enregistre l'état.
  function live() {
    if (!window.EventSource) return;
    var es = new EventSource('/api/events');
    es.addEventListener('hello', function () {
      fetch('/api/modules', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('Session expirée'); return r.json(); }).then(function (state) { if (state.version !== CFG.activationVersion) reloadServer(); }).catch(function () { location.assign('/login'); });
    });
    es.addEventListener('change', function (m) {
      var e; try { e = JSON.parse(m.data); } catch (x) { return; }
      if (e.entity === 'module_activation') { reloadServer(); return; }
      if (e.entity !== 'legacy_state' || e.author === CFG.user) return;
      banner('Les données ont été enregistrées par ' + (e.author || 'un autre utilisateur') + '. Rechargez pour voir la dernière version (pensez à enregistrer vos propres modifications avant).', [
        { label: 'Recharger', primary: true, run: reloadServer },
        { label: 'Plus tard', run: closeBanner }], true);
    });
    es.addEventListener('logout', function () { es.close(); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    css();
    if (importExportDisabled()) { hideTransfers(); new MutationObserver(hideTransfers).observe(document.body, { childList: true, subtree: true }); }
    // Modules repris : affichés ici, modifiables uniquement dans la nouvelle interface.
    if (CFG.takenOver && CFG.takenOver.length) {
      var t = el('div', 'sv-taken');
      t.setAttribute('role', 'note');
      t.textContent = 'Module géré dans la nouvelle interface : ' + CFG.takenOver.map(function (m) { return m.label; }).join(', ') + '. Consultation seule ici.';
      document.body.appendChild(t);
    } else if (CFG.canWrite && CFG.readOnly && CFG.readOnly.length) {
      var ro = el('div', 'sv-taken');
      ro.setAttribute('role', 'note');
      ro.textContent = 'Consultation seule (droits) : ' + CFG.readOnly.join(', ') + '. Les enregistrements qui modifient ces modules sont refusés.';
      document.body.appendChild(ro);
    }
    // Menu utilisateur
    var wrap = el('nav', 'sv-menu'); wrap.setAttribute('aria-label', 'Menu du compte');
    var btn = el('button'); btn.type = 'button'; btn.setAttribute('aria-expanded', 'false');
    var dot = el('i', CFG.canWrite ? '' : 'ro'); btn.append(dot, document.createTextNode(CFG.name || CFG.user));
    var ul = el('ul'); ul.hidden = true;
    var roleL = (CFG.roles || []).join(', ') || 'Aucun rôle';
    ul.appendChild(el('li', 'sv-h', CFG.user + ' · ' + roleL));
    [['Nouvelle interface (accueil)', '/'], ['Mon compte', '/account'], ['Pilotage', '/pilotage']].concat(!CFG.enabled || CFG.enabled.indexOf('documents') !== -1 ? [['Documents et liens', '/documents']] : []).concat(!CFG.enabled || CFG.enabled.indexOf('ia') !== -1 ? [['Évaluations IA versionnées', '/ia/evaluations']] : []).concat(CFG.admin ? [['Administration', '/admin']] : [])
      .forEach(function (x) { var li = el('li'), a = el('a', '', x[0]); a.href = x[1]; li.appendChild(a); ul.appendChild(li); });
    var lo = el('li'), lb = el('button', '', 'Déconnexion'); lb.type = 'button';
    lb.onclick = function () { fetch('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': CFG.csrf }, credentials: 'same-origin' }).finally(function () { location.href = '/login'; }); };
    lo.appendChild(lb); ul.appendChild(lo);
    btn.onclick = function () { ul.hidden = !ul.hidden; btn.setAttribute('aria-expanded', String(!ul.hidden)); };
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) { ul.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    wrap.append(ul, btn); document.body.appendChild(wrap);
    live();
  });
})();

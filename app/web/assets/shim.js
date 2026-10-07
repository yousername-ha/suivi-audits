/* Suivi des audits SMSI — intégration de l'outil (fichier unique) au serveur.
   Remplace l'API window.claude de l'artefact d'origine :
   - use('artifact').publish({'data/state.json':…}) -> PUT /api/state (contrôle de version If-Match, jeton CSRF)
   - use('downloads').save({filename,data})          -> téléchargement navigateur
   Ajoute un menu (Documents, Mon compte, Administration, Déconnexion). Configuration : window.__SUIVI (injectée par le serveur). */
(function () {
  'use strict';
  var CFG = window.__SUIVI || { role: 'ro', user: '', csrf: '' };
  var KEY = 'suivi-audits-smsi:v1';
  var etag = null;

  try { localStorage.setItem('suivi-audits-smsi:ro', CFG.role === 'ro' ? '1' : '0'); } catch (e) {}

  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  var ready = fetch('/api/state', { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' })
    .then(function (r) { etag = r.headers.get('ETag'); }).catch(function () {});

  function el(tag, cls, text) { var x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; }
  function css() {
    if (document.getElementById('suivi-shim-css')) return;
    var s = el('style'); s.id = 'suivi-shim-css';
    s.textContent = '.sv-banner{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;max-width:min(680px,calc(100% - 24px));background:#B42318;color:#fff;border-radius:10px;padding:12px 16px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);display:flex;flex-direction:column;gap:10px}' +
      '.sv-banner .sv-act{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}.sv-banner button{border:1px solid #fff;background:transparent;color:#fff;border-radius:6px;padding:6px 12px;font:600 13px system-ui,sans-serif;cursor:pointer}.sv-banner button.sv-p{background:#fff;color:#B42318}' +
      '.sv-menu{position:fixed;right:16px;bottom:16px;z-index:9000;font:14px system-ui,sans-serif}.sv-menu>button{border:0;border-radius:999px;background:#14213D;color:#fff;padding:9px 14px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer;display:flex;gap:8px;align-items:center}' +
      '.sv-menu>button i{width:8px;height:8px;border-radius:50%;background:#4CC38A;display:inline-block}.sv-menu>button i.ro{background:#F0A04B}' +
      '.sv-menu ul{position:absolute;right:0;bottom:calc(100% + 8px);list-style:none;margin:0;padding:6px;background:#fff;color:#14213D;border:1px solid #D2D9D8;border-radius:10px;min-width:220px;box-shadow:0 10px 30px rgba(0,0,0,.18)}' +
      '.sv-menu li a,.sv-menu li button{display:block;width:100%;text-align:left;border:0;background:none;padding:8px 10px;border-radius:6px;color:inherit;text-decoration:none;font:inherit;cursor:pointer}.sv-menu li a:hover,.sv-menu li button:hover{background:#F5F8F7}' +
      '.sv-menu li.sv-h{padding:6px 10px 8px;color:#51607A;font-size:12.5px;border-bottom:1px solid #E3E8E7;margin-bottom:4px}';
    document.head.appendChild(s);
  }
  function banner(msg, actions) {
    css();
    var b = document.getElementById('sv-banner');
    if (!b) { b = el('div', 'sv-banner'); b.id = 'sv-banner'; b.setAttribute('role', 'alert'); document.body.appendChild(b); }
    b.replaceChildren(el('div', '', msg));
    var bar = el('div', 'sv-act');
    actions.forEach(function (a) { var x = el('button', a.primary ? 'sv-p' : '', a.label); x.type = 'button'; x.onclick = a.run; bar.appendChild(x); });
    b.appendChild(bar);
  }
  function closeBanner() { var b = document.getElementById('sv-banner'); if (b) b.remove(); }

  async function put(content, force) {
    await ready;
    var h = { 'Content-Type': 'application/json', 'X-CSRF-Token': CFG.csrf };
    if (etag && !force) h['If-Match'] = etag;
    var r;
    try { r = await fetch('/api/state', { method: 'PUT', headers: h, body: content, credentials: 'same-origin', cache: 'no-store' }); }
    catch (e) { throw err('upstream_error'); }
    if (r.ok) { etag = r.headers.get('ETag') || etag; closeBanner(); return; }
    if (r.status === 401) {
      banner('Votre session a expiré. Vos modifications sont conservées dans ce navigateur : reconnectez-vous puis utilisez « Enregistrer en ligne ».', [
        { label: 'Se reconnecter', primary: true, run: function () { location.href = '/login?next=/'; } }]);
      throw err('conflict');
    }
    if (r.status === 403) throw err('not_writer');
    if (r.status === 412) {
      var j = {}; try { j = await r.json(); } catch (e) {}
      banner('Les données ont été modifiées par ' + (j.by || 'un autre utilisateur') + ' depuis votre chargement. Vos modifications ne sont pas encore enregistrées sur le serveur.', [
        { label: 'Recharger la version du serveur', primary: true, run: function () { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); } },
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
      if (CFG.role === 'ro') return Promise.reject(err('not_writer'));
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
      if (name === 'downloads') return Promise.resolve(downloads);
      if (name === 'artifact') return CFG.role === 'ro' ? Promise.reject(err('not_granted')) : Promise.resolve(artifact);
      return Promise.reject(err('not_declared'));
    }
  };

  // Menu utilisateur
  document.addEventListener('DOMContentLoaded', function () {
    css();
    var wrap = el('nav', 'sv-menu'); wrap.setAttribute('aria-label', 'Menu du compte');
    var btn = el('button'); btn.type = 'button'; btn.setAttribute('aria-expanded', 'false');
    var dot = el('i', CFG.role === 'ro' ? 'ro' : ''); btn.append(dot, document.createTextNode(CFG.name || CFG.user));
    var ul = el('ul'); ul.hidden = true;
    var roleL = { admin: 'Administrateur', rw: 'Lecture et écriture', ro: 'Lecture seule' }[CFG.role] || '';
    var h = el('li', 'sv-h', CFG.user + ' · ' + roleL); ul.appendChild(h);
    [['Documents et liens', '/documents'], ['Mon compte', '/account']].concat(CFG.role === 'admin' ? [['Administration', '/admin']] : [])
      .forEach(function (x) { var li = el('li'), a = el('a', '', x[0]); a.href = x[1]; li.appendChild(a); ul.appendChild(li); });
    var lo = el('li'), lb = el('button', '', 'Déconnexion'); lb.type = 'button';
    lb.onclick = function () { fetch('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': CFG.csrf }, credentials: 'same-origin' }).finally(function () { location.href = '/login'; }); };
    lo.appendChild(lb); ul.appendChild(lo);
    btn.onclick = function () { ul.hidden = !ul.hidden; btn.setAttribute('aria-expanded', String(!ul.hidden)); };
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) { ul.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    wrap.append(ul, btn); document.body.appendChild(wrap);
  });
})();

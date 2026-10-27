/* Tous les écrans, y compris l'outil historique et les écrans muraux : suivi indépendant de l'API. */
(() => {
  let banner = null;
  let admin = false;
  // Session complète (double authentification faite) ? Relue au plus toutes les 15 s : le bandeau ne s'affiche jamais
  // à un visiteur non connecté (écran de connexion compris).
  let session = { ok: false, admin: false, at: 0 };
  async function connecte() {
    if (Date.now() - session.at < 15000) return session;
    const me = await fetch('/api/auth/me', { cache: 'no-store' })
      .then((v) => v.json())
      .catch(() => null);
    const ok = me?.stage === 'ok';
    session = {
      ok,
      admin:
        ok && !!me?.user?.roles?.includes('Administrateur') && !!me.permissions?.includes('administration:administrer'),
      at: Date.now(),
    };
    return session;
  }
  const greater = (a, b) => {
    if (!/^\d+\.\d+\.\d+$/.test(a) || !/^\d+\.\d+\.\d+$/.test(b)) return false;
    const x = a.split('.').map(Number),
      y = b.split('.').map(Number);
    const i = x.findIndex((v, n) => v !== y[n]);
    return i >= 0 && x[i] > y[i];
  };
  async function tick() {
    try {
      const r = await fetch('/update/status.json', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return;
      const s = await r.json();
      if (s.maintenance === true) {
        location.replace(`/update/?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
        return;
      }
      const veut = !document.querySelector('[data-native-updates]') && greater(s.available, s.installed);
      const droit = veut ? await connecte() : null;
      if (veut && droit.ok) {
        admin = droit.admin;
        if (!banner) {
          const css = document.createElement('link');
          css.rel = 'stylesheet';
          css.href = '/update/notice.css';
          document.head.append(css);
          banner = document.createElement('div');
          banner.className = 'suivi-update-notice';
          banner.setAttribute('role', 'status');
          document.body.prepend(banner);
        }
        banner.replaceChildren();
        const text = document.createElement('span');
        text.textContent = `Mise à jour disponible : ${s.available} · Version installée : ${s.installed}`;
        banner.append(text);
        if (s.notes === `https://github.com/yousername-ha/suivi-audits/releases/tag/v${s.available}`) {
          const notes = document.createElement('a');
          notes.textContent = 'Nouveautés';
          notes.href = s.notes;
          notes.target = '_blank';
          notes.rel = 'noreferrer';
          banner.append(notes);
        }
        if (admin) {
          const action = document.createElement('a');
          action.textContent = 'Mettre à jour';
          action.href = '/admin/system#updates';
          banner.append(action);
        }
      } else if (banner) {
        banner.remove();
        banner = null;
      }
    } catch {
      /* Coupure temporaire : poursuivre sans fermer les sessions ni afficher d'erreur technique. */
    } finally {
      setTimeout(tick, 3000);
    }
  }
  void tick();
})();

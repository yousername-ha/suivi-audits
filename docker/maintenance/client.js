/* Tous les écrans, y compris l'outil historique et les écrans muraux : suivi indépendant de l'API. */
(() => {
  let banner = null;
  let admin = false;
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
      if (!document.querySelector('[data-native-updates]') && greater(s.available, s.installed)) {
        if (!banner) {
          const css = document.createElement('link');
          css.rel = 'stylesheet';
          css.href = '/update/notice.css';
          document.head.append(css);
          banner = document.createElement('div');
          banner.className = 'suivi-update-notice';
          banner.setAttribute('role', 'status');
          document.body.prepend(banner);
          const me = await fetch('/api/auth/me', { cache: 'no-store' })
            .then((v) => v.json())
            .catch(() => null);
          admin =
            me?.stage === 'ok' &&
            me?.user?.roles?.includes('Administrateur') &&
            me.permissions?.includes('administration:administrer');
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

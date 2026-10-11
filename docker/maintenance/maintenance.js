/* Indépendant de React, de l'API et de la base. Pas de progression artificielle. */
(() => {
  let preference = 'auto';
  try {
    preference = localStorage.getItem('mantine-color-scheme-value') || 'auto';
  } catch {
    /* La maintenance fonctionne aussi sans stockage navigateur. */
  }
  document.documentElement.dataset.mantineColorScheme =
    preference === 'dark' ||
    ((!preference || preference === 'auto') && matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';
  const get = (id) => document.getElementById(id);
  const phases = ['preparing', 'backup', 'installing', 'verifying', 'complete'];
  const next = new URLSearchParams(location.search).get('next');
  let destination = '/';
  if (next && next.startsWith('/')) {
    try {
      const url = new URL(next, location.origin);
      if (url.origin === location.origin && !url.pathname.startsWith('/update'))
        // Garder l'origine validée : un chemin normalisé peut commencer par « // ».
        destination = url.href;
    } catch {
      /* Une adresse mal formée revient à l'accueil ; elle ne doit pas interrompre le suivi. */
    }
  }
  let returned = false;
  async function tick() {
    try {
      const response = await fetch('/update/status.json', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('status');
      const state = await response.json();
      get('connection').hidden = true;
      const failed = ['failed', 'rolled_back', 'intervention'].includes(state.status);
      get('title').textContent =
        state.status === 'intervention'
          ? 'Une intervention est nécessaire'
          : failed
            ? 'La mise à jour n’a pas été installée'
            : state.status === 'success'
              ? 'Votre espace est prêt'
              : 'Mise à jour en cours';
      get('message').textContent = state.message || 'Nous préparons le retour de votre espace de travail.';
      get('versions').textContent = state.target
        ? `Version ${state.installed} → ${state.target}`
        : `Version ${state.installed || 'en service'}`;
      get('delay').hidden = !state.startedAt || Date.now() - Date.parse(state.startedAt) < 600000;
      get('animation').hidden = state.status === 'intervention' || (!state.maintenance && failed);
      document.querySelectorAll('[data-phase]').forEach((element) => {
        const index = phases.indexOf(element.dataset.phase);
        const current = phases.indexOf(state.phase);
        element.className = index < current ? 'done' : index === current ? 'current' : '';
      });
      if (!state.maintenance && state.status !== 'intervention') {
        const health = await fetch('/healthz', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (health.ok && (await health.text()).trim() === 'ok') {
          if (failed) {
            get('return').hidden = false;
            get('return').href = destination;
            get('animation').hidden = true;
            get('steps').hidden = true;
          } else {
            returned = true;
            location.replace(destination);
          }
        }
      }
    } catch {
      get('connection').hidden = false;
    } finally {
      if (!returned) setTimeout(tick, 2500);
    }
  }
  void tick();
})();

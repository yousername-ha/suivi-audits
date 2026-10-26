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
  const heure = (iso) =>
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const duree = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  };
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
  /* Ouverte juste après la confirmation : le service de mise à jour n'a pas encore pris la demande en charge, l'état
     publié est encore celui d'avant. On attend sa prise en charge (deux minutes au plus) sans renvoyer vers l'application. */
  const requested = /^[0-9a-f-]{36}$/.test(new URLSearchParams(location.search).get('demande') || '')
    ? new URLSearchParams(location.search).get('demande')
    : null;
  const openedAt = Date.now();
  let seen = false;
  let returned = false;
  async function tick() {
    try {
      const response = await fetch('/update/status.json', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('status');
      const state = await response.json();
      get('connection').hidden = true;
      if (requested && state.id === requested) seen = true;
      const waiting = !!requested && !seen && Date.now() - openedAt < 120000;
      const failed = !waiting && ['failed', 'rolled_back', 'intervention'].includes(state.status);
      // Préparation en cours côté service (avant l'arrêt de l'application) : ne pas revenir à l'application.
      const active = ['queued', 'running'].includes(state.status) && Date.now() - Date.parse(state.updatedAt) < 120000;
      get('title').textContent = waiting
        ? 'Mise à jour en cours'
        : state.status === 'intervention'
          ? 'Une intervention est nécessaire'
          : failed
            ? 'La mise à jour n’a pas été installée'
            : state.status === 'success'
              ? 'Votre espace est prêt'
              : 'Mise à jour en cours';
      get('message').textContent = waiting
        ? 'Demande enregistrée. Le service de mise à jour prépare l’installation ; cette page se met à jour toute seule.'
        : state.message || 'Nous préparons le retour de votre espace de travail.';
      get('versions').textContent = state.target
        ? `Version ${state.installed} → ${state.target}`
        : `Version ${state.installed || 'en service'}`;
      get('delay').hidden = !state.startedAt || Date.now() - Date.parse(state.startedAt) < 600000;
      get('animation').hidden = state.status === 'intervention' || (!state.maintenance && failed);
      // Frise horodatée : uniquement pour l'opération suivie (pas celle d'une installation précédente).
      const suivie = !waiting && !!state.target && !!state.startedAt && (!requested || state.id === requested);
      const etapes = suivie && Array.isArray(state.etapes) ? state.etapes : [];
      const franchies = new Map(etapes.map((e) => [e.phase, e.at]));
      const termine = ['success', 'failed', 'rolled_back', 'intervention'].includes(state.status);
      document.querySelectorAll('[data-phase]').forEach((element) => {
        const phase = element.dataset.phase;
        const index = phases.indexOf(phase);
        const current = phases.indexOf(waiting ? 'preparing' : state.phase);
        element.className =
          phase === 'rollback'
            ? state.phase === 'rollback' && !termine
              ? 'current'
              : franchies.has('rollback')
                ? 'done'
                : ''
            : index < current || (franchies.has(phase) && phase !== state.phase)
              ? 'done'
              : index === current
                ? 'current'
                : '';
        if (phase === 'rollback') element.hidden = !franchies.has('rollback');
        const time = element.querySelector('time');
        if (time) {
          const at = franchies.get(phase);
          time.textContent = at ? `· ${heure(at)}` : '';
          if (at) time.dateTime = at;
          else time.removeAttribute('datetime');
        }
      });
      get('elapsed').hidden = !suivie;
      if (suivie) {
        const fin = termine && state.finishedAt ? Date.parse(state.finishedAt) : Date.now();
        get('elapsed').textContent =
          `${termine ? 'Durée totale' : 'Durée écoulée'} : ${duree(fin - Date.parse(state.startedAt))}`;
      }
      get('receipt').hidden = !(suivie && termine);
      if (!state.maintenance && state.status !== 'intervention' && !waiting && !active) {
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

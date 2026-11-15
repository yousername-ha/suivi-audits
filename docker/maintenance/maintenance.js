/* Indépendant de React, de l'API et de la base. Pas de progression artificielle : l'illustration, le rang et les libellés
   de présentation découlent de l'état publié ; ils ne font jamais avancer d'étape et ne simulent ni pourcentage, ni débit,
   ni durée, ni ligne de journal. */
(() => {
  const root = document.documentElement;
  let preference = 'auto';
  try {
    preference = localStorage.getItem('mantine-color-scheme-value') || 'auto';
  } catch {
    /* La maintenance fonctionne aussi sans stockage navigateur. */
  }
  root.dataset.mantineColorScheme =
    preference === 'dark' ||
    ((!preference || preference === 'auto') && matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';
  const get = (id) => document.getElementById(id);
  // N'écrire que ce qui change : la zone annoncée (#message) n'est pas relue à chaque relevé.
  const ecrire = (id, texte) => {
    const element = get(id);
    if (element.textContent !== texte) element.textContent = texte;
  };
  const phases = ['preparing', 'backup', 'installing', 'verifying', 'complete'];
  const heure = (iso) =>
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const duree = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  };
  // Illustration d'après l'état réel : libellé de l'axe et titre de l'étape.
  const ARTS = {
    neutral: ['Mise à jour', 'Suivi de l’opération'],
    waiting: ['Prise en charge', 'Prise en charge de la demande'],
    download: ['Transfert de la version', 'Préparation et téléchargement'],
    backup: ['Sauvegarde', 'Sauvegarde en cours'],
    building: ['Installation', 'Installation en cours'],
    verifying: ['Vérification', 'Vérification en cours'],
    rollback: ['Restauration', 'Restauration en cours'],
    complete: ['Terminé', 'Mise à jour terminée'],
    restored: ['Version rétablie', 'Version précédente rétablie'],
    alert: ['Attention', 'Opération interrompue'],
  };
  const illustration = (state, waiting) => {
    if (waiting) return 'waiting';
    // Réussite seulement sur un succès publié : la phase « complete » seule ne suffit pas.
    if (state.status === 'success') return 'complete';
    if (state.status === 'rolled_back') return 'restored';
    if (state.status === 'failed' || state.status === 'intervention') return 'alert';
    if (state.phase === 'rollback') return 'rollback';
    if (state.status === 'queued') return 'waiting';
    return (
      { preparing: 'download', backup: 'backup', installing: 'building', verifying: 'verifying' }[state.phase] ||
      'neutral'
    );
  };
  // Pause : fige les effets visuels seulement ; le suivi et l'affichage des états continuent.
  const pause = get('pause');
  pause.addEventListener('click', () => {
    const figee = root.dataset.paused !== 'true';
    root.dataset.paused = String(figee);
    pause.setAttribute('aria-pressed', String(figee));
  });
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
  // Présentation de l'état : illustration, rang de l'étape, étiquettes. Aucune incidence sur le suivi ni le retour.
  function presenter(state, waiting, failed) {
    const art = illustration(state, waiting);
    root.dataset.art = art;
    const fin = waiting
      ? ''
      : state.status === 'intervention'
        ? 'intervention'
        : failed
          ? 'echec'
          : state.status === 'success'
            ? 'succes'
            : '';
    if (fin) root.dataset.fin = fin;
    else delete root.dataset.fin;
    ecrire('axis-label', ARTS[art][0]);
    ecrire('phase-title', fin === 'intervention' ? 'Intervention nécessaire' : ARTS[art][1]);
    // Rang de la phase parmi les cinq de la frise : une position, jamais un pourcentage.
    const rang = phases.indexOf(waiting ? 'preparing' : state.phase);
    const restauration = !waiting && (state.phase === 'rollback' || state.status === 'rolled_back');
    get('phase-index').hidden = art === 'neutral' || (rang < 0 && !restauration);
    get('phase-denominator').hidden = rang < 0;
    ecrire('phase-rank', rang < 0 ? '—' : String(rang + 1).padStart(2, '0'));
    ecrire('phase-rank-label', rang < 0 ? 'Restauration' : fin ? 'Dernière étape' : 'Étape en cours');
    ecrire(
      'step-chip',
      waiting
        ? 'Prise en charge'
        : restauration
          ? 'Restauration'
          : rang >= 0 && art !== 'neutral'
            ? `Étape ${String(rang + 1).padStart(2, '0')}`
            : 'Suivi',
    );
    ecrire(
      'live-label',
      waiting
        ? 'En attente'
        : fin === 'intervention'
          ? 'Intervention requise'
          : fin === 'echec'
            ? 'Opération interrompue'
            : fin === 'succes'
              ? 'Opération terminée'
              : 'En cours',
    );
    // Versions : installée, puis cible de l'opération suivie (pas celle d'une demande précédente pendant l'attente).
    const cible = waiting ? null : state.target;
    ecrire('installed-label', cible ? 'Version installée' : 'Version en service');
    ecrire('installed', state.installed || '—');
    ecrire('target', cible || '');
    get('target-block').hidden = !cible;
    get('version-connector').hidden = !cible;
  }
  function indiquerRetour(state, waiting, failed) {
    ecrire(
      'return-hint',
      !waiting && state.status === 'intervention'
        ? 'Le retour automatique reste suspendu dans l’attente d’une intervention.'
        : failed
          ? get('return').hidden
            ? 'Un lien vers votre espace apparaîtra dès qu’il sera disponible.'
            : 'Votre espace est disponible. Vous pouvez y consulter le résultat.'
          : 'Votre espace revient automatiquement dès qu’il est disponible.',
    );
  }
  async function tick() {
    try {
      const response = await fetch('/update/status.json', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('status');
      const state = await response.json();
      get('connection').hidden = true;
      root.dataset.suivi = 'actif';
      ecrire('tracking', 'Actif');
      if (requested && state.id === requested) seen = true;
      const waiting = !!requested && !seen && Date.now() - openedAt < 120000;
      const failed = !waiting && ['failed', 'rolled_back', 'intervention'].includes(state.status);
      // Préparation en cours côté service (avant l'arrêt de l'application) : ne pas revenir à l'application.
      const active = ['queued', 'running'].includes(state.status) && Date.now() - Date.parse(state.updatedAt) < 120000;
      ecrire(
        'title',
        waiting
          ? 'Mise à jour en cours'
          : state.status === 'intervention'
            ? 'Une intervention est nécessaire'
            : failed
              ? 'La mise à jour n’a pas été installée'
              : state.status === 'success'
                ? 'Votre espace est prêt'
                : 'Mise à jour en cours',
      );
      ecrire(
        'message',
        waiting
          ? 'Demande enregistrée. Le service de mise à jour prépare l’installation ; cette page se met à jour toute seule.'
          : state.message || 'Nous préparons le retour de votre espace de travail.',
      );
      // Lenteur : mesurée sur l'opération publiée, pas sur une opération précédente pendant l'attente de prise en charge.
      get('delay').hidden = waiting || !state.startedAt || Date.now() - Date.parse(state.startedAt) < 600000;
      presenter(state, waiting, failed);
      // Frise horodatée : uniquement pour l'opération suivie (pas celle d'une installation précédente).
      const suivie = !waiting && !!state.target && !!state.startedAt && (!requested || state.id === requested);
      const etapes = suivie && Array.isArray(state.etapes) ? state.etapes : [];
      const franchies = new Map(etapes.map((e) => [e.phase, e.at]));
      const termine = ['success', 'failed', 'rolled_back', 'intervention'].includes(state.status);
      document.querySelectorAll('#steps [data-phase]').forEach((element) => {
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
        if (element.className === 'current') element.setAttribute('aria-current', 'step');
        else element.removeAttribute('aria-current');
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
        ecrire('elapsed-label', termine ? 'Durée totale' : 'Durée écoulée');
        ecrire('elapsed-value', duree(fin - Date.parse(state.startedAt)));
      }
      get('receipt').hidden = !(suivie && termine);
      if (!state.maintenance && state.status !== 'intervention' && !waiting && !active) {
        const health = await fetch('/healthz', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (health.ok && (await health.text()).trim() === 'ok') {
          if (failed) {
            get('return').hidden = false;
            get('return').href = destination;
            get('steps').hidden = true;
            get('journey-note').hidden = true;
            ecrire('journey-title', 'Résultat de l’opération');
          } else {
            returned = true;
            location.replace(destination);
          }
        }
      }
      indiquerRetour(state, waiting, failed);
    } catch {
      // Dernier état connu conservé (titre, frise, illustration figée) ; seul l'avis de connexion change.
      get('connection').hidden = false;
      root.dataset.suivi = 'interrompu';
      ecrire('tracking', 'Interrompu');
      ecrire('live-label', 'Suivi interrompu');
      ecrire('step-chip', 'Dernier état connu');
    } finally {
      if (!returned) setTimeout(tick, 2500);
    }
  }
  void tick();
})();

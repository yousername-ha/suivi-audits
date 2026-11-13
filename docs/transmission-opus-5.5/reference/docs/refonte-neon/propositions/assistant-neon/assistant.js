/* global window, document, matchMedia, innerWidth */
(() => {
  'use strict';
  const data = structuredClone(window.ASSISTANT_GLOBAL_DEMO);
  const $ = (id) => document.getElementById(id);
  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const paths = {
    history: '<path d="M3 11a9 9 0 1 0 3-6M3 3v6h6M12 7v5l3 2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    layers: '<path d="m3 8 9-5 9 5-9 5Zm0 5 9 5 9-5M3 18l9 5 9-5"/>',
    chevron: '<path d="m7 9 5 5 5-5"/>',
    pin: '<path d="m8 3 8 0-1 6 4 4v2H5v-2l4-4Zm4 12v7"/>',
    send: '<path d="m3 3 19 9-19 9 4-9Zm4 9h15"/>',
    pause: '<path d="M8 4v16M16 4v16"/>',
    play: '<path d="m7 4 14 8-14 8Z"/>',
    file: '<path d="M6 3h8l4 4v14H6Zm8 0v5h4M9 12h6M9 16h6"/>',
    question: '<path d="M8 8a4 4 0 0 1 8 0c0 3-4 3-4 6M12 18h.01"/><circle cx="12" cy="12" r="10"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    bell: '<path d="M5 16h14l-2-3V9a5 5 0 0 0-10 0v4Zm5 4h4M12 2v2"/>',
    action: '<path d="m8 12 3 3 5-6M9 3h6l2 3h3v15H4V6h3Z"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  };
  const icon = (name) =>
    `<svg class="as-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
  let avatarId = 0;
  function avatar() {
    const id = `as-avatar-${++avatarId}`;
    return `<span class="as-avatar" aria-hidden="true">${window.ASSISTANT_AVATAR_NEON.replaceAll('__UID__', id)}</span>`;
  }
  const state = {
    open: true,
    profile: 'mise_en_oeuvre',
    current: { mise_en_oeuvre: 'demo-mise-en-oeuvre', audit_interne: 'demo-audit' },
    drafts: {},
    attachments: {},
    page: 'fournisseurs',
    pinned: true,
    expanded: false,
    view: 'chat',
    side: null,
    reply: false,
    replyDraft: '',
    replyError: '',
    proposalDraft: null,
    missionDraft: '',
    formError: '',
    missions: [],
    canModify: true,
    canAnswer: true,
    availability: 'ready',
    failure: null,
    sequence: 0,
    motion: !matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  const profileLabel = (id) => data.etat.profils.find((p) => p.id === id)?.libelle || id;
  const pageLabel = () => (state.page === 'dashboard' ? 'Tableau de bord' : 'Fournisseurs');
  const current = () => data.conversations.find((c) => c.id === state.current[state.profile]);
  const question = () => data.notifications.find((n) => n.kind === 'assistant_question');
  const readableTime = (date) =>
    new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(
      new Date(date),
    );
  const readableDate = (date) =>
    date
      ? new Intl.DateTimeFormat('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'Europe/Paris',
        }).format(new Date(date.includes('T') ? date : `${date}T12:00:00+01:00`))
      : 'Non définie';
  const count = () =>
    data.notifications.filter((n) => (n.kind === 'assistant_question' ? !n.reponse : !n.readAt)).length +
    data.propositions.filter((p) => p.etat === 'en_attente').length;
  const unavailable = () => {
    if (state.availability === 'offline') return 'Le service ne répond pas. Vos brouillons sont conservés.';
    if (!data.etat.actif) return 'L’assistant est désactivé pour cette plateforme.';
    if (!data.etat.pret) return data.etat.motif || 'L’assistant n’est pas disponible pour le moment.';
    if (state.availability === 'quota')
      return 'Le budget de la journée est atteint. La discussion reprendra à son renouvellement.';
    if (!data.etat.profils.find((p) => p.id === state.profile)?.perimetres.length)
      return 'Aucun périmètre n’est autorisé pour ce profil. Contactez votre administrateur.';
    return '';
  };
  const contextPrefix = () => {
    const attachment = state.attachments[current().id];
    return attachment
      ? `[Contexte joint : ${attachment.page} ; périmètre : ${attachment.scope}. Référence de navigation, pas une source consultée.]\n\n`
      : '';
  };
  const length = () => contextPrefix().length + $('as-message').value.length;
  function toast(message) {
    $('as-toast').textContent = message;
    $('as-toast').hidden = false;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => {
      $('as-toast').hidden = true;
    }, 4500);
  }
  function layout() {
    document.body.classList.toggle('as-pinned', state.open && state.pinned && !state.expanded && innerWidth >= 1700);
    document.body.classList.toggle('as-expanded', state.expanded);
    document.body.classList.toggle('as-dock-closed', !state.open);
    $('as-dock').hidden = !state.open;
    $('as-launcher').setAttribute('aria-expanded', String(state.open));
    $('as-launcher').setAttribute(
      'aria-label',
      state.open
        ? 'Réduire l’assistant RSSI'
        : `Ouvrir l’assistant RSSI, ${count()} point${count() > 1 ? 's' : ''} à suivre`,
    );
    $('as-expand').setAttribute('aria-pressed', String(state.expanded));
    $('as-expand').setAttribute(
      'aria-label',
      state.expanded ? 'Réduire la largeur de la discussion' : 'Agrandir la discussion',
    );
    $('as-pin').setAttribute('aria-pressed', String(state.pinned));
    $('as-launcher-count').textContent = count();
    $('as-launcher-count').hidden = !count();
    $('as-inbox-count').textContent = count();
    $('as-inbox-count').hidden = !count();
    document.documentElement.dataset.assistantMotion = state.motion ? 'on' : 'off';
    $('as-motion').innerHTML = icon(state.motion ? 'pause' : 'play');
    $('as-motion').setAttribute('aria-label', state.motion ? 'Suspendre les animations' : 'Reprendre les animations');
    $('as-motion').title = $('as-motion').getAttribute('aria-label');
  }
  function renderComposer() {
    const c = current();
    const attached = state.attachments[c.id];
    const pending = c.etat === 'en_cours';
    const reason = unavailable();
    $('as-availability').hidden = !reason;
    $('as-availability').textContent = reason;
    $('as-message').disabled = !!reason || pending;
    $('as-send').disabled = !!reason || pending || !$('as-message').value.trim() || length() > 4000;
    $('as-message').placeholder = pending
      ? 'Réponse en préparation…'
      : state.profile === 'audit_interne'
        ? 'Préparez votre audit interne…'
        : 'Posez une question sur votre SMSI…';
    $('as-message-count').hidden = length() < 3000;
    $('as-message-count').textContent = `${length().toLocaleString('fr-FR')} / 4 000`;
    $('as-message-count').dataset.over = String(length() > 4000);
    $('as-attached').hidden = !attached;
    $('as-attached-title').textContent = attached ? `Contexte joint : ${attached.page}` : '';
    $('as-context-shortcut').disabled = !!reason || pending;
    $('as-share-page').disabled = !!reason || pending;
  }
  function renderQuestion(place) {
    const q = question();
    if (!q) return '';
    const prefix = place === 'chat' ? 'as-inline' : 'as-inbox';
    const editing = state.reply && state.replyPlace === place && !q.reponse;
    return `<article class="as-question" data-notification="${q.id}"><div class="as-card-kicker">${icon('question')} Question reçue ${q.reponse ? '· Répondue' : '· À préciser'}</div><h3>${escape(q.message)}</h3><p class="as-card-meta">${icon('shield')} Pilotage de l’organisation · Revue des accès</p>${q.reponse ? `<p class="as-question-answer">${escape(q.reponse)}</p><p class="as-success">${icon('check')} Réponse transmise dans cet aperçu.</p><p class="as-card-meta">L’assistant la prendra en compte lors d’une prochaine ronde.</p>` : editing ? `<form class="as-question-reply" data-as-form="reply"><label for="${prefix}-answer">Votre réponse<textarea id="${prefix}-answer" name="texte" maxlength="2000" rows="3" required ${state.canAnswer ? '' : 'disabled'}>${escape(state.replyDraft)}</textarea></label><small>Votre réponse sera transmise à l’assistant et au référent RSSI. Elle sera reprise lors d’une prochaine ronde.</small>${state.replyError ? `<p class="as-inline-error" role="alert">${escape(state.replyError)}</p>` : ''}<div class="as-card-actions"><button class="as-small-button" type="submit" ${state.canAnswer ? '' : 'disabled'}>Transmettre la réponse</button><button type="button" class="as-small-button" data-variant="quiet" data-as-act="cancel-reply">Annuler</button></div></form>` : `<div class="as-card-actions"><button type="button" class="as-small-button" data-as-act="reply" data-place="${place}" ${state.canAnswer ? '' : 'disabled'}>${icon('arrow')} Répondre à la question</button>${place === 'chat' ? `<button type="button" class="as-small-button" data-variant="quiet" data-as-act="inbox">Voir les suivis</button>` : ''}</div>${!state.canAnswer ? '<p class="as-inline-error">Seul le destinataire peut répondre à cette question.</p>' : ''}`}</article>`;
  }
  function renderThread() {
    const c = current();
    let html = `<p class="as-thread-date">12 novembre 2026 · Discussion illustrative</p>`;
    if (!c.messages.length) {
      html += `<div class="as-empty-discussion">${avatar()}<h3>Un point à éclaircir ?</h3><p>${state.profile === 'audit_interne' ? 'Préparez les vérifications, consultez les fiches autorisées et documentez vos constats.' : 'Clarifiez vos priorités et préparez les prochaines étapes avec l’assistant RSSI.'}</p><div class="as-prompt-list"><button type="button" data-as-prompt="Quels points préparer pour la prochaine revue ?">${icon('shield')} Préparer une revue</button><button type="button" data-as-prompt="Quelles preuves faut-il vérifier pour la revue des accès ?">${icon('file')} Vérifier les preuves attendues</button><button type="button" data-as-act="mission">${icon('bell')} Demander un suivi</button></div></div>`;
    }
    for (const message of c.messages) {
      const user = message.role === 'utilisateur';
      html += `<article class="as-message" data-role="${user ? 'utilisateur' : 'assistant'}"><header class="as-message-head">${user ? '' : avatar()}<strong>${user ? 'Vous' : 'Assistant RSSI'}</strong><time datetime="${escape(message.createdAt)}">${readableTime(message.createdAt)}</time></header>${
        user
          ? `<p>${escape(message.contenu)}</p>`
          : `<div class="as-answer-text">${message.contenu
              .split('\n\n')
              .map((p) => `<p>${escape(p)}</p>`)
              .join(
                '',
              )}</div>${message.sources.length ? `<div class="as-sources">${message.sources.map((source, index) => `<button type="button" data-as-source="${escape(message.id)}" data-source-index="${index}">${icon(source.type === 'evidence' ? 'file' : 'action')} ${escape(source.type === 'evidence' ? 'Fiche documentaire' : source.nom)}</button>`).join('')}</div><p class="as-source-note">${message.sources.length} fiches consultées · Lecture selon vos droits</p>` : '<p class="as-source-note">Réponse illustrative · Aucune lecture de la plateforme</p>'}`
      }</article>`;
    }
    if (c.etat === 'en_cours')
      html +=
        '<div class="as-thinking" role="status"><span></span><span></span><span></span>Réponse en préparation…</div>';
    if (c.id === 'demo-mise-en-oeuvre') html += renderQuestion('chat');
    $('as-thread').innerHTML = html;
  }
  function renderInbox() {
    const reminder = data.notifications.find((n) => n.kind === 'assistant_rappel');
    $('as-inbox-cards').innerHTML =
      renderQuestion('inbox') +
      `<article class="as-inbox-card"><div class="as-card-kicker">${icon('bell')} Rappel reçu ${reminder.readAt ? '· Lu' : ''}</div><h3>${escape(reminder.title)}</h3><p>${escape(reminder.message)}</p><div class="as-card-actions"><button type="button" class="as-small-button" data-as-act="read" ${reminder.readAt ? 'disabled' : ''}>${icon('check')} ${reminder.readAt ? 'Marqué comme lu' : 'Marquer comme lu'}</button><button type="button" class="as-small-button" data-variant="quiet" data-as-avis="utile" aria-pressed="${reminder.avis === 'utile'}">Utile</button><button type="button" class="as-small-button" data-variant="quiet" data-as-avis="inutile" aria-pressed="${reminder.avis === 'inutile'}">Peu utile</button></div></article>` +
      data.propositions
        .map(
          (p) =>
            `<article class="as-inbox-card" data-kind="proposal"><div class="as-card-kicker">${icon('action')} Proposition d’action</div><h3>${escape(p.titre)}</h3><p>${escape(profileLabel(p.profil))} · Pilotage de l’organisation</p><dl><div><dt>Échéance proposée</dt><dd>${readableDate(p.echeance)}</dd></div><div><dt>À partir de</dt><dd>${escape(p.sourceNom)}</dd></div></dl>${p.etat === 'en_attente' ? `<div class="as-card-actions"><button type="button" class="as-small-button" data-as-proposal="${p.id}">Examiner la proposition ${icon('arrow')}</button></div><p class="as-card-meta">L’action n’est créée qu’après votre confirmation.</p>` : `<p class="as-success">${p.etat === 'confirmee' ? 'Proposition confirmée · Action simulée' : 'Proposition rejetée dans cet aperçu'}</p>`}</article>`,
        )
        .join('') +
      state.missions
        .map(
          (m) =>
            `<article class="as-inbox-card" data-kind="mission"><div class="as-card-kicker">${icon('clock')} Suivi demandé · Simulation</div><h3>${escape(m.consigne)}</h3><p>${escape(profileLabel(m.profil))} · Repris lors des prochaines rondes de l’assistant.</p></article>`,
        )
        .join('') +
      `<div class="as-card-actions"><button type="button" class="as-small-button" data-variant="quiet" data-as-act="mission">${icon('plus')} Demander un suivi</button></div><p class="as-source-note">Votre boîte personnelle reste commune aux deux profils.</p>`;
  }
  const back = (label = 'Retour') =>
    `<button type="button" class="as-back" data-as-act="back">${icon('back')}${label}</button>`;
  function renderSide() {
    const side = state.side;
    if (!side) return;
    let html = back(side.from === 'inbox' ? 'Retour aux suivis' : 'Retour à la discussion');
    if (side.kind === 'history') {
      html += `<span class="rr-kicker">${escape(profileLabel(state.profile))}</span><h3>Vos discussions</h3><p>Chaque profil conserve ses propres échanges.</p>${data.conversations
        .filter((c) => c.profil === state.profile)
        .map(
          (c) =>
            `<button type="button" class="as-history-row" data-as-conversation="${c.id}" ${current().id === c.id ? 'aria-current="true"' : ''}><strong>${escape(c.titre)}</strong><small>${c.messages.length} messages · ${readableDate(c.updatedAt)}${current().id === c.id ? ' · Discussion actuelle' : ''}</small></button>`,
        )
        .join('')}`;
    } else if (side.kind === 'source') {
      const source = side.source;
      html += `<span class="rr-kicker">Source consultée · Exemple fictif</span><h3>${escape(source.nom)}</h3><dl><div><dt>Type de source</dt><dd>${source.type === 'evidence' ? 'Fiche documentaire' : 'Fiche d’action'}</dd></div><div><dt>Périmètre</dt><dd>Pilotage de l’organisation</dd></div></dl><div class="as-source-box"><strong>${icon('file')} Une référence vérifiable</strong><p>Cette maquette présente les métadonnées de la fiche. Elle ne représente pas une lecture du contenu d’un PDF.</p></div><p>À l’intégration, l’ouverture de la fiche utilisera la navigation et les droits existants.</p>`;
    } else if (side.kind === 'proposal') {
      const p = data.propositions.find((x) => x.id === side.id);
      const draft = state.proposalDraft;
      const disabled = !state.canModify || p.etat !== 'en_attente';
      html += `<span class="rr-kicker">Proposition · ${escape(profileLabel(p.profil))}</span><h3>Examiner avant de décider</h3><p>Vous gardez la main sur le titre, le détail et l’échéance. L’assistant ne crée pas cette action sans confirmation.</p><form class="as-editor" data-as-form="proposal"><label>Titre de l’action<input name="titre" maxlength="200" required value="${escape(draft.titre)}" ${disabled ? 'disabled' : ''}/></label><label>Description<textarea name="description" rows="3" maxlength="4000" ${disabled ? 'disabled' : ''}>${escape(draft.description)}</textarea></label><label>Échéance proposée<input name="echeance" type="date" value="${escape(draft.echeance)}" ${disabled ? 'disabled' : ''}/></label><label>Note de décision<textarea name="note" rows="2" maxlength="2000" ${disabled ? 'disabled' : ''}>${escape(draft.note)}</textarea></label>${!state.canModify ? '<p class="as-inline-error">Votre droit de modification est nécessaire pour décider.</p>' : ''}${state.formError ? `<p class="as-inline-error" role="alert">${escape(state.formError)}</p>` : ''}<div class="as-card-actions"><button type="submit" class="as-small-button" ${disabled ? 'disabled' : ''}>${icon('check')} Confirmer l’action</button><button type="button" class="as-small-button" data-variant="quiet" data-as-act="reject" ${disabled ? 'disabled' : ''}>Rejeter</button></div><p>Simulation locale : aucun registre n’est modifié.</p></form>`;
    } else if (side.kind === 'mission') {
      html += `<span class="rr-kicker">${escape(profileLabel(state.profile))}</span><h3>Demander un suivi</h3><p>Confiez un point à l’assistant. Il sera repris lors des prochaines rondes, avec les périmètres autorisés pour ce profil.</p><form class="as-editor" data-as-form="mission"><label for="as-mission-text">Votre consigne<textarea id="as-mission-text" name="consigne" maxlength="2000" rows="5" required>${escape(state.missionDraft)}</textarea></label><p>Exemple : suivre la réception de la preuve pour la revue des accès.</p>${state.formError ? `<p class="as-inline-error" role="alert">${escape(state.formError)}</p>` : ''}<button type="submit" class="as-small-button" ${!state.canModify || unavailable() ? 'disabled' : ''}>${icon('bell')} Confier ce suivi</button><p>Pas d’envoi réel dans cet aperçu. La date d’exécution dépend des rondes configurées.</p></form>`;
    }
    $('as-side-view').innerHTML = html;
  }
  function renderViews() {
    const side = !!state.side;
    $('as-chat-view').hidden = side || state.view !== 'chat';
    $('as-inbox-view').hidden = side || state.view !== 'inbox';
    $('as-side-view').hidden = !side;
    for (const tab of ['chat', 'inbox']) {
      const el = $(`as-${tab}-tab`);
      el.setAttribute('aria-selected', String(state.view === tab));
      el.tabIndex = state.view === tab ? 0 : -1;
    }
  }
  function render() {
    layout();
    renderThread();
    renderInbox();
    renderSide();
    renderViews();
    renderComposer();
  }
  function showSide(kind, extra = {}) {
    state.side = { kind, from: state.view, ...extra };
    state.formError = '';
    renderSide();
    renderViews();
    $('as-side-view').querySelector('button')?.focus();
  }
  function selectTab(view, focus = true) {
    state.view = view;
    state.side = null;
    state.reply = false;
    render();
    if (focus) $(`as-${view}-tab`).focus();
  }
  function setOpen(open, focus = true) {
    state.open = open;
    layout();
    if (focus) (open ? ($('as-message').disabled ? $('as-chat-tab') : $('as-message')) : $('as-launcher')).focus();
  }
  function attachContext() {
    if (unavailable() || current().etat === 'en_cours') return;
    state.attachments[current().id] = { page: pageLabel(), scope: 'Pilotage de l’organisation' };
    $('as-context-details').hidden = true;
    $('as-context-button').setAttribute('aria-expanded', 'false');
    renderComposer();
    if (state.side || state.view !== 'chat') selectTab('chat', false);
    $('as-message').focus();
    toast('Contexte de la page joint à la prochaine question.');
  }
  function fail(kind) {
    if (state.failure !== kind) return false;
    state.failure = null;
    return true;
  }
  async function sendMessage() {
    const c = current();
    const value = $('as-message').value.trim();
    if (!value || unavailable() || c.etat === 'en_cours' || length() > 4000) return;
    if (fail('message')) {
      toast('Envoi non effectué dans cet aperçu. Votre brouillon est conservé.');
      return;
    }
    const text = contextPrefix() + value;
    c.messages.push({
      id: `demo-u-${++state.sequence}`,
      role: 'utilisateur',
      contenu: text,
      sources: [],
      outils: [],
      erreur: false,
      createdAt: new Date().toISOString(),
    });
    if (c.messages.length === 1) c.titre = value.slice(0, 60);
    c.etat = 'en_cours';
    state.drafts[c.id] = '';
    delete state.attachments[c.id];
    $('as-message').value = '';
    render();
    $('as-thread').scrollTop = $('as-thread').scrollHeight;
    await new Promise((resolve) => window.setTimeout(resolve, 550));
    c.messages.push({
      id: `demo-a-${++state.sequence}`,
      role: 'assistant',
      contenu:
        'Voici un exemple de réponse dans cette maquette. Après raccordement à Mistral, je pourrai examiner les fiches autorisées de ce profil et citer celles que j’ai réellement consultées.\n\nLe suivi de vos questions et des propositions reste accessible dans « Pour vous ».',
      sources: [],
      outils: [],
      erreur: false,
      createdAt: new Date().toISOString(),
    });
    c.etat = 'pret';
    c.updatedAt = new Date().toISOString();
    render();
    if (current().id === c.id) $('as-thread').scrollTop = $('as-thread').scrollHeight;
  }
  function decide(decision) {
    if (!state.canModify || state.side?.kind !== 'proposal') return;
    const p = data.propositions.find((x) => x.id === state.side.id);
    if (!p || p.etat !== 'en_attente') return;
    const draft = state.proposalDraft;
    if (!draft.titre.trim()) {
      state.formError = 'Indiquez le titre de l’action.';
      renderSide();
      return;
    }
    if (fail('decision')) {
      state.formError = 'Décision non enregistrée. Les champs sont conservés.';
      renderSide();
      return;
    }
    Object.assign(p, {
      titre: draft.titre.trim(),
      description: draft.description,
      echeance: draft.echeance || null,
      decisionNote: draft.note,
      decidedBy: 'Utilisateur fictif',
      etat: decision === 'confirmer' ? 'confirmee' : 'rejetee',
      objetCree: decision === 'confirmer' ? `simulation-action-${++state.sequence}` : null,
    });
    state.side = null;
    state.view = 'inbox';
    render();
    $('as-inbox-tab').focus();
    toast(
      decision === 'confirmer'
        ? 'Proposition confirmée dans l’aperçu. Création simulée, aucune donnée modifiée.'
        : 'Proposition rejetée dans l’aperçu.',
    );
  }
  document.querySelectorAll('[data-as-icon]').forEach((node) => {
    node.innerHTML = icon(node.dataset.asIcon);
  });
  $('as-launcher-avatar').innerHTML = avatar();
  $('as-header-avatar').innerHTML = avatar();
  $('as-launcher').addEventListener('click', () => setOpen(!state.open));
  $('as-close').addEventListener('click', () => setOpen(false));
  $('as-expand').addEventListener('click', () => {
    state.expanded = !state.expanded;
    layout();
  });
  $('as-pin').addEventListener('click', () => {
    state.pinned = !state.pinned;
    layout();
  });
  $('as-motion').addEventListener('click', () => {
    state.motion = !state.motion;
    layout();
  });
  $('as-context-button').addEventListener('click', () => {
    $('as-context-details').hidden = !$('as-context-details').hidden;
    $('as-context-button').setAttribute('aria-expanded', String(!$('as-context-details').hidden));
  });
  $('as-context-shortcut').addEventListener('click', attachContext);
  $('as-share-page').addEventListener('click', attachContext);
  $('as-remove-context').addEventListener('click', () => {
    delete state.attachments[current().id];
    renderComposer();
    $('as-message').focus();
  });
  $('as-chat-tab').addEventListener('click', () => selectTab('chat'));
  $('as-inbox-tab').addEventListener('click', () => selectTab('inbox'));
  document.querySelector('.as-tabs').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    selectTab(event.key === 'Home' ? 'chat' : event.key === 'End' ? 'inbox' : state.view === 'chat' ? 'inbox' : 'chat');
  });
  $('as-history-button').addEventListener('click', () => showSide('history'));
  $('as-new').addEventListener('click', () => {
    const id = `demo-conversation-${++state.sequence}`;
    data.conversations.push({
      id,
      profil: state.profile,
      titre: 'Nouvelle discussion',
      etat: 'pret',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    });
    state.current[state.profile] = id;
    state.side = null;
    state.view = 'chat';
    $('as-message').value = '';
    render();
    $('as-message').focus();
  });
  $('as-profile').addEventListener('change', (event) => {
    state.profile = event.target.value;
    state.side = null;
    state.reply = false;
    $('as-message').value = state.drafts[current().id] || '';
    render();
    toast(`Discussion distincte : ${profileLabel(state.profile)}.`);
  });
  $('as-message').addEventListener('input', () => {
    state.drafts[current().id] = $('as-message').value;
    renderComposer();
  });
  $('as-message').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  });
  $('as-compose-form').addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage();
  });
  document.querySelectorAll('[data-as-nav]').forEach((button) =>
    button.addEventListener('click', () => {
      state.page = button.dataset.asNav;
      $('fournisseurs-stage').hidden = state.page !== 'fournisseurs';
      $('dashboard-stage').hidden = state.page !== 'dashboard';
      $('as-context-page').textContent = pageLabel();
      $('as-organisation-group').classList.toggle('active', state.page === 'fournisseurs');
      document.querySelectorAll('[data-as-nav]').forEach((node) => {
        node.classList.toggle('current', node.dataset.asNav === state.page);
        if (node.dataset.asNav === state.page) node.setAttribute('aria-current', 'page');
        else node.removeAttribute('aria-current');
      });
      renderComposer();
    }),
  );
  $('as-dock').addEventListener('input', (event) => {
    const form = event.target.closest('[data-as-form]');
    if (!form) return;
    const name = event.target.name;
    if (form.dataset.asForm === 'reply') state.replyDraft = event.target.value;
    if (form.dataset.asForm === 'proposal') state.proposalDraft[name] = event.target.value;
    if (form.dataset.asForm === 'mission') state.missionDraft = event.target.value;
  });
  $('as-dock').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const action = button.dataset.asAct;
    if (action === 'reply' && state.canAnswer) {
      state.reply = true;
      state.replyPlace = button.dataset.place;
      state.replyError = '';
      renderThread();
      renderInbox();
      const container = state.replyPlace === 'chat' ? $('as-thread') : $('as-inbox-cards');
      container.querySelector('textarea')?.focus();
    }
    if (action === 'cancel-reply') {
      state.reply = false;
      render();
      document.querySelector(`#as-${state.view === 'chat' ? 'thread' : 'inbox-cards'} [data-as-act="reply"]`)?.focus();
    }
    if (action === 'inbox') selectTab('inbox');
    if (action === 'back') {
      state.side = null;
      renderViews();
      $(`as-${state.view}-tab`).focus();
    }
    if (action === 'read') {
      data.notifications.find((n) => n.kind === 'assistant_rappel').readAt = new Date().toISOString();
      renderInbox();
      layout();
      $('as-inbox-tab').focus();
    }
    if (button.dataset.asAvis) {
      data.notifications.find((n) => n.kind === 'assistant_rappel').avis = button.dataset.asAvis;
      renderInbox();
      document.querySelector(`[data-as-avis="${button.dataset.asAvis}"]`).focus();
      toast('Votre avis est conservé dans cet aperçu.');
    }
    if (action === 'mission') showSide('mission');
    if (action === 'reject') decide('rejeter');
    if (button.dataset.asProposal) {
      const p = data.propositions.find((x) => x.id === button.dataset.asProposal);
      state.proposalDraft = {
        titre: p.titre,
        description: p.description,
        echeance: p.echeance || '',
        note: p.decisionNote,
      };
      showSide('proposal', { id: p.id });
    }
    if (button.dataset.asSource) {
      const message = current().messages.find((m) => m.id === button.dataset.asSource);
      showSide('source', { source: message.sources[Number(button.dataset.sourceIndex)] });
    }
    if (button.dataset.asConversation) {
      const c = data.conversations.find((x) => x.id === button.dataset.asConversation && x.profil === state.profile);
      if (!c) return;
      state.current[state.profile] = c.id;
      state.side = null;
      state.view = 'chat';
      $('as-message').value = state.drafts[c.id] || '';
      render();
      $('as-chat-tab').focus();
    }
    if (button.dataset.asPrompt) {
      $('as-message').value = button.dataset.asPrompt;
      state.drafts[current().id] = $('as-message').value;
      renderComposer();
      $('as-message').focus();
    }
  });
  $('as-dock').addEventListener('submit', (event) => {
    const form = event.target.closest('[data-as-form]');
    if (!form) return;
    event.preventDefault();
    if (form.dataset.asForm === 'reply') {
      if (!state.canAnswer || question().reponse || !state.replyDraft.trim() || state.replyDraft.length > 2000) return;
      if (fail('reply')) {
        state.replyError = 'Réponse non transmise. Votre texte est conservé.';
        renderThread();
        renderInbox();
        return;
      }
      question().reponse = state.replyDraft.trim();
      question().readAt = new Date().toISOString();
      state.reply = false;
      render();
      $(`as-${state.view}-tab`).focus();
      toast('Réponse conservée dans l’aperçu, à reprendre lors d’une prochaine ronde.');
    }
    if (form.dataset.asForm === 'proposal') decide('confirmer');
    if (form.dataset.asForm === 'mission') {
      if (!state.canModify || unavailable() || !state.missionDraft.trim() || state.missionDraft.length > 2000) return;
      if (fail('mission')) {
        state.formError = 'Suivi non enregistré. Votre consigne est conservée.';
        renderSide();
        return;
      }
      state.missions.push({
        id: `simulation-mission-${++state.sequence}`,
        profil: state.profile,
        consigne: state.missionDraft.trim(),
      });
      state.missionDraft = '';
      state.side = null;
      state.view = 'inbox';
      render();
      $('as-inbox-tab').focus();
      toast('Demande de suivi simulée. Aucun rappel réel n’a été envoyé.');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (
      event.key !== 'Escape' ||
      !state.open ||
      !($('as-dock').contains(document.activeElement) || $('as-launcher') === document.activeElement)
    )
      return;
    event.preventDefault();
    if (state.side) {
      state.side = null;
      renderViews();
      $(`as-${state.view}-tab`).focus();
    } else if (!$('as-context-details').hidden) {
      $('as-context-details').hidden = true;
      $('as-context-button').setAttribute('aria-expanded', 'false');
      $('as-context-button').focus();
    } else if (state.reply) {
      state.reply = false;
      render();
      $(`as-${state.view}-tab`).focus();
    } else setOpen(false);
  });
  window.addEventListener('resize', layout);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (event) => {
    if (event.matches) {
      state.motion = false;
      layout();
    }
  });
  window.ASSISTANT_APERCU = {
    snapshot: () =>
      structuredClone({
        state,
        conversations: data.conversations,
        notifications: data.notifications,
        propositions: data.propositions,
      }),
    setEtat: (patch) => {
      Object.assign(data.etat, patch);
      render();
    },
    setAvailability: (value) => {
      state.availability = value;
      render();
    },
    setRights: (patch) => {
      Object.assign(state, {
        canAnswer: patch.canAnswer ?? state.canAnswer,
        canModify: patch.canModify ?? state.canModify,
      });
      render();
    },
    failNext: (kind) => {
      state.failure = kind;
    },
  };
  render();
})();

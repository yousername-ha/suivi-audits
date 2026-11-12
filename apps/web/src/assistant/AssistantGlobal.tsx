/* Présence globale de l’assistant : services existants, aucun moteur ni réponse locale.
   L’hôte reste dans Layout pendant les changements de page, puis disparaît avec la session. */
import { useMediaQuery } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ASSISTANT_GLOBAL } from './cles';
import { ApiError, api, errorMessage, get } from '../api';
import { ConfirmButton } from '../components/common';
import { localiser } from '../navigation';
import { useCan, useMe } from '../session';
import { AvatarAssistant, IconeAssistant } from './IdentiteAssistant';
import {
  conversationDuChemin,
  LONGUEURS,
  estNotificationAssistant,
  indisponibilite,
  LIBELLES,
  messageAEnvoyer,
  pointEnAttente,
  type ContextePage,
  type Conversation,
  type EtatAssistant,
  type Fil,
  type Mission,
  type NotificationAssistant,
  type Profil,
  type Proposition,
  type Source,
} from './contrats';

const NOTIFICATIONS = ['grc', 'notifications'] as const;
const date = (v: string | null) =>
  v
    ? new Date(v.includes('T') ? v : `${v}T12:00:00`).toLocaleDateString('fr-FR', {
        timeZone: 'Europe/Paris',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Non définie';
const heure = (v: string) =>
  new Date(v).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
type Detail =
  | { type: 'historique' }
  | { type: 'source'; source: Source }
  | { type: 'proposition'; proposition: Proposition }
  | { type: 'mission' };

/** Contrôle d’affichage par les permissions du serveur ; le backend reste seul juge à chaque requête.
    Aucune requête /assistant sans le droit dédié ; la boîte personnelle, elle, ne demande pas ce droit. */
export function AssistantGlobal({ onPinned }: { onPinned: (value: boolean) => void }) {
  const me = useMe();
  const can = useCan();
  const canRead = can('assistant', 'lire');
  const user = me.user?.id ?? '';
  const etat = useQuery({
    queryKey: [ASSISTANT_GLOBAL, user, 'etat'],
    queryFn: () => get<EtatAssistant>('/api/assistant/etat'),
    enabled: me.stage === 'ok' && canRead,
    retry: false,
    refetchInterval: 60_000,
  });
  const inbox = useQuery({
    queryKey: NOTIFICATIONS,
    queryFn: () => get<NotificationAssistant[]>('/api/grc/notifications'),
    enabled: me.stage === 'ok',
    refetchInterval: 60_000,
  });
  const forbidden = etat.error instanceof ApiError && [401, 403, 404].includes(etat.error.status);
  const notifications = (inbox.data ?? []).filter(estNotificationAssistant);
  const readable = canRead && !forbidden;
  const visible = me.stage === 'ok' && ((readable && etat.data?.actif !== false) || notifications.length > 0);
  useEffect(() => {
    if (!visible) onPinned(false);
  }, [visible, onPinned]);
  if (!visible) return null;
  return (
    <PanneauAssistant
      key={`${user}:${readable}`}
      user={user}
      canRead={readable}
      canModify={can('assistant', 'modifier') && readable}
      canMission={can('assistant', 'administrer') && readable}
      etat={readable ? etat.data : undefined}
      etatError={readable ? etat.error : null}
      notifications={notifications}
      inboxError={inbox.error}
      onPinned={onPinned}
    />
  );
}

function PanneauAssistant({
  user,
  canRead,
  canModify,
  canMission,
  etat,
  etatError,
  notifications,
  inboxError,
  onPinned,
}: {
  user: string;
  canRead: boolean;
  canModify: boolean;
  /** Confier un suivi (mission) relève de l’administration de l’assistant sur cette branche. */
  canMission: boolean;
  etat: EtatAssistant | undefined;
  etatError: unknown;
  notifications: NotificationAssistant[];
  inboxError: unknown;
  onPinned: (value: boolean) => void;
}) {
  const qc = useQueryClient(),
    loc = useLocation();
  const large = useMediaQuery('(min-width: 1700px)');
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [open, setOpen] = useState(false),
    [expanded, setExpanded] = useState(false),
    [pinned, setPinned] = useState(true),
    [pauseMotion, setPauseMotion] = useState(false);
  const [tab, setTab] = useState<'chat' | 'inbox'>(canRead ? 'chat' : 'inbox'),
    [detail, setDetail] = useState<Detail | null>(null),
    [contextOpen, setContextOpen] = useState(false);
  const [profileChoice, setProfile] = useState<Profil | null>(null),
    [selections, setSelections] = useState<Partial<Record<Profil, string>>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({}),
    [contexts, setContexts] = useState<Record<string, ContextePage | undefined>>({}),
    [replies, setReplies] = useState<Record<string, string>>({});
  const [replyId, setReplyId] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const dock = useRef<HTMLElement>(null),
    launcher = useRef<HTMLButtonElement>(null),
    composer = useRef<HTMLTextAreaElement>(null),
    thread = useRef<HTMLDivElement>(null);
  const alive = useRef(true),
    working = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      onPinned(false);
    };
  }, [onPinned]);
  const reserve = open && pinned && !expanded && !!large && !loc.pathname.startsWith('/cartographie');
  useEffect(() => {
    onPinned(reserve);
  }, [reserve, onPinned]);
  const root = [ASSISTANT_GLOBAL, user];
  const profils = etat?.profils ?? [];
  const profil = profils.find((p) => p.id === profileChoice)?.id ?? profils[0]?.id ?? null;
  const conversations = useQuery({
    queryKey: [...root, 'conversations'],
    queryFn: () => get<Conversation[]>('/api/assistant/conversations'),
    enabled: canRead && open,
  });
  const id = profil ? (selections[profil] ?? conversations.data?.find((c) => c.profil === profil)?.id) : undefined;
  const filKey = [...root, 'fil', id];
  const fil = useQuery({
    queryKey: filKey,
    queryFn: () => get<Fil>(`/api/assistant/conversations/${encodeURIComponent(id!)}`),
    enabled: canRead && open && !!id,
    refetchInterval: (q) => (q.state.data?.etat === 'en_cours' ? 1500 : false),
  });
  const proposals = useQuery({
    queryKey: [...root, 'propositions'],
    queryFn: () => get<Proposition[]>('/api/assistant/propositions'),
    enabled: canRead,
    refetchInterval: 60_000,
  });
  const missions = useQuery({
    queryKey: [...root, 'missions'],
    queryFn: () => get<Mission[]>('/api/assistant/missions'),
    enabled: canMission && open && tab === 'inbox',
  });
  // Lien direct /assistant/:id : la conversation s’ouvre dans ce panneau, dans le profil qui est réellement le sien.
  const lienDirect = conversationDuChemin(loc.pathname);
  const cible = useQuery({
    queryKey: [...root, 'fil', lienDirect],
    queryFn: () => get<Fil>(`/api/assistant/conversations/${encodeURIComponent(lienDirect!)}`),
    enabled: canRead && !!lienDirect,
    retry: false,
  });
  const cibleId = cible.data?.id,
    cibleProfil = cible.data?.profil;
  useEffect(() => {
    if (!lienDirect || cibleId !== lienDirect || !cibleProfil) return;
    setProfile(cibleProfil);
    setSelections((old) => ({ ...old, [cibleProfil]: cibleId }));
    setTab('chat');
    setDetail(null);
    setOpen(true);
  }, [lienDirect, cibleId, cibleProfil]);
  const conversation = fil.data?.profil === profil ? fil.data : undefined;
  const draftKey = id ?? `nouveau-${profil ?? 'aucun'}`;
  const texte = drafts[draftKey] ?? '',
    contexte = contexts[draftKey];
  const pending = conversation?.etat === 'en_cours';
  const blocker = !canRead
    ? 'Le dialogue nécessite le droit d’utiliser l’assistant.'
    : etatError
      ? errorMessage(etatError)
      : indisponibilite(etat, profil);
  const count =
    notifications.filter(pointEnAttente).length + (proposals.data ?? []).filter((p) => p.etat === 'en_attente').length;
  const page: ContextePage = {
    nom:
      loc.pathname === '/'
        ? 'Tableau de bord'
        : (localiser(loc.pathname)?.destination.label ??
          (loc.pathname.startsWith('/documents') ? 'Documents' : 'Page affichée')),
    chemin: loc.pathname,
    perimetre: new URLSearchParams(loc.search).get('perimetre'),
  };
  const sourceQuestions = notifications.filter(
    (n) =>
      n.kind === 'assistant_question' &&
      conversation?.messages.some((m) => m.sources.some((s) => s.objet === n.objectId && s.perimetre === n.smsiId)),
  );
  const provider = etat?.fournisseur;
  const providerLabel =
    provider === 'api.mistral.ai' || provider?.endsWith('.mistral.ai') ? 'Mistral' : 'Modèle configuré';
  const protectedRead = fil.error instanceof ApiError && [401, 403, 404].includes(fil.error.status);
  const longueur = messageAEnvoyer(texte, contexte).length;
  const setDraft = (value: string) => setDrafts((old) => ({ ...old, [draftKey]: value }));
  const perform = async <T,>(fn: () => Promise<T>, success: (result: T) => void) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await fn();
      if (alive.current) success(result);
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const refreshNotifications = () => {
    void qc.invalidateQueries({ queryKey: NOTIFICATIONS });
  };
  const mutateNotification = (
    n: NotificationAssistant,
    suffix: string,
    body: unknown,
    patch: Partial<NotificationAssistant>,
    message: string,
  ) =>
    perform(
      () => api('PUT', `/api/grc/notifications/${encodeURIComponent(n.id)}/${suffix}`, { body }),
      () => {
        qc.setQueryData<NotificationAssistant[]>(NOTIFICATIONS, (old) =>
          old?.map((item) => (item.id === n.id ? { ...item, ...patch } : item)),
        );
        if (suffix === 'reponse') {
          setReplies((old) => ({ ...old, [n.id]: '' }));
          setReplyId(null);
        }
        setNotice(message);
        refreshNotifications();
      },
    );
  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };
  const showDetail = (value: Detail) => {
    setDetail(value);
    setError(null);
    setNotice(null);
  };
  const joinPage = () => {
    setContexts((old) => ({ ...old, [draftKey]: { ...page } }));
    setContextOpen(false);
    setDetail(null);
    setTab('chat');
    composer.current?.focus();
  };
  const nouvelle = () => {
    if (!canRead || !profil || blocker) return;
    const chosen = profil;
    void perform(
      () => api<Conversation>('POST', '/api/assistant/conversations', { body: { profil: chosen } }),
      (c) => {
        if (c.profil !== chosen) {
          setError('Le profil de la conversation reçue est différent du profil demandé.');
          return;
        }
        setSelections((old) => ({ ...old, [chosen]: c.id }));
        setDetail(null);
        setTab('chat');
        void qc.invalidateQueries({ queryKey: [...root, 'conversations'] });
      },
    );
  };
  const envoyer = () => {
    if (
      !canRead ||
      blocker ||
      pending ||
      busy ||
      !profil ||
      !texte.trim() ||
      longueur > LONGUEURS.message ||
      (id && (!conversation || fil.error))
    )
      return;
    const chosen = profil,
      originalId = id,
      key = draftKey,
      body = { texte: messageAEnvoyer(texte, contexte) };
    void perform(
      async () => {
        const c = originalId
          ? { id: originalId, profil: chosen }
          : await api<Conversation>('POST', '/api/assistant/conversations', { body: { profil: chosen } });
        if (c.profil !== chosen) throw new Error('Profil de conversation inattendu.');
        // Garder la conversation créée même si l’envoi échoue : évite une création en double à la reprise.
        if (alive.current && !originalId) setSelections((old) => ({ ...old, [chosen]: c.id }));
        try {
          return await api<Fil>('POST', `/api/assistant/conversations/${encodeURIComponent(c.id)}/messages`, { body });
        } catch (e) {
          if (alive.current && !originalId) {
            setDrafts((old) => ({ ...old, [c.id]: texte }));
            setContexts((old) => ({ ...old, [c.id]: contexte }));
          }
          throw e;
        }
      },
      (d) => {
        if (d.profil !== chosen) {
          setError('Profil de réponse inattendu.');
          return;
        }
        qc.setQueryData([...root, 'fil', d.id], d);
        setDrafts((old) => ({ ...old, [key]: '', [d.id]: '' }));
        setContexts((old) => ({ ...old, [key]: undefined, [d.id]: undefined }));
        setSelections((old) => ({ ...old, [chosen]: d.id }));
        void qc.invalidateQueries({ queryKey: [...root, 'conversations'] });
      },
    );
  };
  const messageCount = conversation?.messages.length ?? 0;
  useEffect(() => {
    if (open && tab === 'chat' && !detail && thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [messageCount, pending, open, tab, detail]);
  useEffect(() => {
    if (conversation?.etat === 'pret') void qc.invalidateQueries({ queryKey: [ASSISTANT_GLOBAL, user, 'etat'] });
  }, [conversation?.etat, qc, user]);
  const [focusBack, setFocusBack] = useState(false);
  useEffect(() => {
    if (focusBack && open) {
      const target = dock.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
      target?.focus();
      setFocusBack(false);
    }
  }, [focusBack, open]);
  useEffect(() => {
    if (detail && open) dock.current?.querySelector<HTMLButtonElement>('.as-back')?.focus();
  }, [detail, open]);
  useEffect(() => {
    if (replyId && open) {
      const region = dock.current?.querySelector(tab === 'chat' ? '.as-thread' : '.as-inbox-view');
      const card = [...(region?.querySelectorAll<HTMLElement>('[data-notification]') ?? [])].find(
        (n) => n.dataset.notification === replyId,
      );
      card?.querySelector('textarea')?.focus();
    }
  }, [replyId, open, tab]);
  const returnToTab = () => {
    setDetail(null);
    setFocusBack(true);
  };
  const tool = (name: string, label: string, onClick: () => void, disabled = false, pressed?: boolean) => (
    <button
      type="button"
      className="as-icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
    >
      <IconeAssistant nom={name} />
    </button>
  );
  const errorBox = (e: unknown) =>
    e ? (
      <p className="as-inline-error" role="alert">
        {errorMessage(e)}
      </p>
    ) : null;
  const questionCard = (n: NotificationAssistant): ReactNode => (
    <article className="as-question" key={n.id} data-notification={n.id}>
      <div className="as-card-kicker">
        <IconeAssistant nom="question" />
        Question reçue · {n.reponse ? 'Répondue' : 'À préciser'}
      </div>
      <h3>{n.message}</h3>
      {n.reponse ? (
        <>
          <p className="as-question-answer">{n.reponse}</p>
          <p className="as-success">Réponse transmise, reprise lors d’une prochaine ronde.</p>
        </>
      ) : replyId === n.id ? (
        <form
          className="as-question-reply"
          onSubmit={(e) => {
            e.preventDefault();
            const answer = replies[n.id]?.trim();
            if (answer && answer.length <= LONGUEURS.reponse)
              void mutateNotification(
                n,
                'reponse',
                { texte: answer },
                { reponse: answer },
                'Réponse transmise. L’assistant la reprendra lors d’une prochaine ronde.',
              );
          }}
        >
          <label>
            Votre réponse
            <textarea
              aria-label="Votre réponse"
              rows={3}
              maxLength={LONGUEURS.reponse}
              required
              value={replies[n.id] ?? ''}
              onChange={(e) => setReplies((old) => ({ ...old, [n.id]: e.target.value }))}
              disabled={busy}
            />
          </label>
          <small>Transmise à l’assistant et au référent RSSI. Prise en compte lors d’une prochaine ronde.</small>
          <div className="as-card-actions">
            <button className="as-small-button" disabled={busy || !replies[n.id]?.trim()}>
              Transmettre la réponse
            </button>
            <button
              type="button"
              className="as-small-button"
              data-variant="quiet"
              onClick={() => setReplyId(null)}
              disabled={busy}
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="as-card-actions">
          <button
            type="button"
            className="as-small-button"
            onClick={() => {
              setReplyId(n.id);
              setError(null);
            }}
            disabled={busy}
          >
            <IconeAssistant nom="arrow" />
            Répondre à la question
          </button>
          {tab === 'chat' && (
            <button type="button" className="as-small-button" data-variant="quiet" onClick={() => setTab('inbox')}>
              Voir les suivis
            </button>
          )}
        </div>
      )}
    </article>
  );
  return (
    <div className="as-global" data-assistant-motion={pauseMotion || reduced ? 'off' : 'on'}>
      <button
        ref={launcher}
        className="as-launcher"
        type="button"
        aria-label={
          open ? 'Réduire l’assistant RSSI' : `Ouvrir l’assistant RSSI${count ? `, ${count} points à suivre` : ''}`
        }
        aria-controls="assistant-global-dock"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) setFocusBack(true);
        }}
      >
        <AvatarAssistant />
        <span className="as-launcher-label">
          <strong>Assistant RSSI</strong>
          <small>Votre compagnon de pilotage</small>
        </span>
        {count > 0 && <b>{count}</b>}
      </button>
      <aside
        className="as-dock"
        id="assistant-global-dock"
        ref={dock}
        hidden={!open}
        data-expanded={expanded}
        aria-label="Assistant RSSI"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && dock.current?.contains(document.activeElement)) {
            e.preventDefault();
            e.stopPropagation();
            if (detail) returnToTab();
            else if (contextOpen) setContextOpen(false);
            else if (replyId) setReplyId(null);
            else close();
          }
        }}
      >
        <header className="as-head">
          <AvatarAssistant />
          <div className="as-identity">
            <h2>Assistant RSSI</h2>
            <span>{provider ? `${providerLabel} · ${provider}` : 'Service de la plateforme'}</span>
          </div>
          <div className="as-head-tools">
            {tool('history', 'Historique des discussions', () => showDetail({ type: 'historique' }), !canRead)}
            {tool('plus', 'Nouvelle discussion', nouvelle, busy || !!blocker)}
            {tool(
              'expand',
              expanded ? 'Réduire la largeur de la discussion' : 'Agrandir la discussion',
              () => setExpanded(!expanded),
              false,
              expanded,
            )}
            {tool('close', 'Réduire l’assistant', close)}
          </div>
        </header>
        <div className="as-context">
          {canRead && (
            <label className="as-profile-label">
              <span className="as-sr">Profil de l’assistant</span>
              <select
                value={profil ?? ''}
                disabled={!profils.length}
                onChange={(e) => {
                  setProfile(e.target.value as Profil);
                  setDetail(null);
                  setError(null);
                }}
              >
                {!profils.length && <option value="">Aucun profil</option>}
                {profils.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.libelle}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="as-context-button"
            aria-label="Voir le contexte de la page"
            aria-expanded={contextOpen}
            onClick={() => setContextOpen(!contextOpen)}
          >
            <IconeAssistant nom="layers" />
            <span>{page.nom}</span>
            <IconeAssistant nom="chevron" />
          </button>
          <span className="as-pin">
            {tool('pin', 'Épingler le panneau à côté de la page', () => setPinned(!pinned), false, pinned)}
          </span>
        </div>
        {contextOpen && (
          <div className="as-context-details">
            <strong>{page.nom}</strong>
            <p>
              Joindre la référence de cette page à votre prochaine question. L’assistant la lira avec vos droits ; elle
              ne constitue pas encore une source consultée.
            </p>
            {profil && (
              <p>
                Périmètres autorisés :{' '}
                {profils
                  .find((p) => p.id === profil)
                  ?.perimetres.map((p) => p.nom)
                  .join(' ; ') || 'aucun'}
                .
              </p>
            )}
            <button
              type="button"
              className="as-small-button"
              onClick={joinPage}
              disabled={!!blocker || pending || busy}
            >
              Joindre le contexte de la page
            </button>
          </div>
        )}
        <div
          className="as-tabs"
          role="tablist"
          aria-label="Espace de l’assistant"
          onKeyDown={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
              e.preventDefault();
              setTab(e.key === 'Home' ? 'chat' : e.key === 'End' ? 'inbox' : tab === 'chat' ? 'inbox' : 'chat');
              setDetail(null);
              setFocusBack(true);
            }
          }}
        >
          {(['chat', 'inbox'] as const).map((t) => (
            <button
              role="tab"
              key={t}
              id={`assistant-${t}-tab`}
              aria-controls={`assistant-${t}-view`}
              aria-selected={tab === t}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => {
                setTab(t);
                setDetail(null);
                setError(null);
              }}
            >
              {t === 'chat' ? 'Discussion' : 'Pour vous'}
              {t === 'inbox' && count > 0 && <b>{count}</b>}
            </button>
          ))}
        </div>
        {blocker && tab === 'chat' && (
          <div className="as-availability" role="status">
            {blocker}
          </div>
        )}
        {etat?.enPause && tab === 'inbox' && (
          <div className="as-availability" role="status">
            Rondes automatiques en pause. Le dialogue reste disponible.
          </div>
        )}
        {errorBox(error)}
        {notice && (
          <p className="as-success" role="status">
            {notice}
          </p>
        )}
        <section
          hidden={!!detail || tab !== 'chat'}
          className="as-chat-view"
          id="assistant-chat-view"
          role="tabpanel"
          aria-labelledby="assistant-chat-tab"
        >
          <div
            className="as-thread"
            ref={thread}
            role="log"
            aria-label="Messages de la discussion"
            aria-live="polite"
            tabIndex={0}
          >
            {errorBox(conversations.error ?? fil.error)}
            {!id && !conversations.isLoading && (
              <div className="as-empty-discussion">
                <AvatarAssistant />
                <h3>Un point à éclaircir ?</h3>
                <p>Clarifiez vos priorités et préparez vos prochaines étapes avec l’assistant RSSI.</p>
                <div className="as-prompt-list">
                  {[
                    'Quels points préparer pour la prochaine revue ?',
                    'Quelles actions sont en retard dans mes périmètres ?',
                  ].map((p) => (
                    <button
                      type="button"
                      key={p}
                      disabled={!!blocker}
                      onClick={() => {
                        setDraft(p);
                        composer.current?.focus();
                      }}
                    >
                      <IconeAssistant nom="shield" />
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {id && fil.isLoading && (
              <p className="as-source-note" role="status">
                Chargement de la discussion…
              </p>
            )}
            {!protectedRead &&
              conversation?.messages.map((m) => (
                <article className="as-message" key={m.id} data-role={m.role} data-error={m.erreur || undefined}>
                  <header className="as-message-head">
                    {m.role === 'assistant' && <AvatarAssistant />}
                    <strong>{m.role === 'utilisateur' ? 'Vous' : 'Assistant RSSI'}</strong>
                    <time dateTime={m.createdAt}>{heure(m.createdAt)}</time>
                  </header>
                  <div className="as-answer-text">{m.contenu}</div>
                  {m.role === 'assistant' && !m.erreur && (
                    <>
                      {m.sources.length > 0 && (
                        <div className="as-sources">
                          {m.sources.map((s, i) => (
                            <button
                              type="button"
                              key={`${s.perimetre}:${s.objet ?? ''}:${i}`}
                              onClick={() => showDetail({ type: 'source', source: s })}
                            >
                              <IconeAssistant
                                nom={['evidence', 'document', 'lien'].includes(s.type ?? '') ? 'file' : 'action'}
                              />
                              {s.type === 'evidence' ? 'Fiche documentaire' : s.nom}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="as-source-note">
                        {m.outils.length
                          ? `${m.sources.length} référence(s) consultée(s) · Lecture selon vos droits`
                          : 'Réponse sans lecture de la plateforme : à vérifier.'}
                      </p>
                    </>
                  )}
                </article>
              ))}
            {pending && (
              <div className="as-thinking" role="status">
                <span />
                <span />
                <span />
                Réponse en préparation…
              </div>
            )}
            {!protectedRead && sourceQuestions.map(questionCard)}
          </div>
          <div className="as-compose">
            {contexte && (
              <div className="as-attached">
                <IconeAssistant nom="layers" />
                <span>Contexte joint : {contexte.nom}</span>
                <button
                  type="button"
                  aria-label="Retirer le contexte joint"
                  onClick={() => setContexts((old) => ({ ...old, [draftKey]: undefined }))}
                >
                  ×
                </button>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                envoyer();
              }}
            >
              <label className="as-sr" htmlFor="assistant-message">
                Votre message à l’assistant
              </label>
              <textarea
                ref={composer}
                id="assistant-message"
                rows={2}
                maxLength={LONGUEURS.message}
                value={texte}
                placeholder="Posez une question sur votre SMSI…"
                disabled={!!blocker || pending || busy || !!(id && (!conversation || fil.error))}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    envoyer();
                  }
                }}
              />
              <div className="as-compose-tools">
                <button
                  type="button"
                  className="as-context-shortcut"
                  onClick={joinPage}
                  disabled={!!blocker || pending || busy}
                >
                  <IconeAssistant nom="plus" />
                  Contexte de la page
                </button>
                {longueur > 3000 && (
                  <span id="as-message-count" data-over={longueur > LONGUEURS.message}>
                    {longueur.toLocaleString('fr-FR')} / 4 000
                  </span>
                )}
                <button
                  type="submit"
                  className="as-send"
                  aria-label="Envoyer le message"
                  disabled={
                    !!blocker ||
                    pending ||
                    busy ||
                    !texte.trim() ||
                    longueur > LONGUEURS.message ||
                    !!(id && (!conversation || fil.error))
                  }
                >
                  <IconeAssistant nom="send" />
                </button>
              </div>
            </form>
            <p className="as-compose-help">Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne</p>
          </div>
        </section>
        <section
          hidden={!!detail || tab !== 'inbox'}
          className="as-inbox-view"
          id="assistant-inbox-view"
          role="tabpanel"
          aria-labelledby="assistant-inbox-tab"
        >
          <header>
            <span className="rr-kicker">Votre suivi personnel</span>
            <h3>Les points qui vous attendent</h3>
            <p>Questions reçues, rappels et propositions à examiner.</p>
          </header>
          {errorBox(inboxError ?? proposals.error ?? missions.error)}
          {notifications.filter((n) => n.kind === 'assistant_question').map(questionCard)}
          {notifications
            .filter((n) => n.kind === 'assistant_rappel')
            .map((n) => (
              <article key={n.id} className="as-inbox-card">
                <div className="as-card-kicker">
                  <IconeAssistant nom="bell" />
                  Rappel reçu {n.readAt ? '· Lu' : ''}
                </div>
                <h3>{n.title}</h3>
                <p>{n.message}</p>
                <div className="as-card-actions">
                  <button
                    type="button"
                    className="as-small-button"
                    disabled={busy || !!n.readAt}
                    onClick={() =>
                      void mutateNotification(
                        n,
                        'read',
                        undefined,
                        { readAt: new Date().toISOString() },
                        'Rappel marqué comme lu.',
                      )
                    }
                  >
                    {n.readAt ? 'Marqué comme lu' : 'Marquer comme lu'}
                  </button>
                  {(['utile', 'inutile'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      className="as-small-button"
                      data-variant="quiet"
                      data-as-avis={a}
                      aria-pressed={n.avis === a}
                      disabled={busy}
                      onClick={() => void mutateNotification(n, 'avis', { avis: a }, { avis: a }, 'Avis enregistré.')}
                    >
                      {a === 'utile' ? 'Utile' : 'Peu utile'}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          {(proposals.data ?? []).map((p) => (
            <article key={p.id} className="as-inbox-card" data-kind="proposal">
              <div className="as-card-kicker">
                <IconeAssistant nom="action" />
                Proposition {p.type === 'constat' ? 'de constat' : 'd’action'}
              </div>
              <h3>{p.titre}</h3>
              <p>
                {LIBELLES[p.profil]} · {p.sourceNom}
              </p>
              {p.type === 'action' && (
                <dl>
                  <div>
                    <dt>Échéance proposée</dt>
                    <dd>{date(p.echeance)}</dd>
                  </div>
                  <div>
                    <dt>État</dt>
                    <dd>{p.etat === 'en_attente' ? 'À examiner' : p.etat === 'confirmee' ? 'Confirmée' : 'Rejetée'}</dd>
                  </div>
                </dl>
              )}
              {p.sourceIssueAssistant && (
                <p>L’élément visé provient déjà d’une proposition de l’assistant : à apprécier par l’auditeur.</p>
              )}
              {p.etat === 'en_attente' ? (
                <>
                  <button
                    type="button"
                    className="as-small-button"
                    onClick={() => showDetail({ type: 'proposition', proposition: p })}
                  >
                    Examiner la proposition <IconeAssistant nom="arrow" />
                  </button>
                  <p className="as-card-meta">
                    {p.type === 'constat'
                      ? 'Un constat reste en brouillon après confirmation.'
                      : 'L’action n’est créée qu’après votre confirmation.'}
                  </p>
                </>
              ) : (
                <p className="as-success">Décision enregistrée{p.decidedBy ? ` par ${p.decidedBy}` : ''}.</p>
              )}
            </article>
          ))}
          {(missions.data ?? [])
            .filter((m) => m.etat === 'ouverte')
            .map((m) => (
              <article key={m.id} className="as-inbox-card" data-kind="mission">
                <div className="as-card-kicker">
                  <IconeAssistant nom="bell" />
                  Suivi confié · {LIBELLES[m.profil]}
                </div>
                <h3>{m.consigne}</h3>
                <p>Repris lors des prochaines rondes.</p>
              </article>
            ))}
          {!notifications.length && !proposals.data?.length && !missions.data?.length && (
            <p className="as-source-note">Aucun point à suivre pour le moment.</p>
          )}
          {canMission && (
            <div className="as-card-actions">
              <button
                type="button"
                className="as-small-button"
                data-variant="quiet"
                onClick={() => showDetail({ type: 'mission' })}
                disabled={!!blocker}
              >
                <IconeAssistant nom="plus" />
                Demander un suivi
              </button>
            </div>
          )}
          <p className="as-source-note">Votre boîte personnelle est commune aux deux profils.</p>
          {canRead && (
            <p className="as-source-note">
              <Link to="/assistant">Rondes, rapports et supervision de l’assistant</Link>
            </p>
          )}
        </section>
        {detail && (
          <section className="as-side-view" aria-label="Détail dans l’assistant">
            <button type="button" className="as-back" onClick={returnToTab}>
              <IconeAssistant nom="back" />
              {tab === 'inbox' ? 'Retour aux suivis' : 'Retour à la discussion'}
            </button>
            {detail.type === 'historique' && (
              <>
                <span className="rr-kicker">{profil ? LIBELLES[profil] : ''}</span>
                <h3>Vos discussions</h3>
                {errorBox(conversations.error)}
                {conversations.data
                  ?.filter((c) => c.profil === profil)
                  .map((c) => (
                    <div key={c.id}>
                      <button
                        type="button"
                        className="as-history-row"
                        aria-current={c.id === id ? 'true' : undefined}
                        onClick={() => {
                          if (profil) setSelections((old) => ({ ...old, [profil]: c.id }));
                          setTab('chat');
                          returnToTab();
                        }}
                      >
                        <strong>{c.titre || 'Nouvelle discussion'}</strong>
                        <small>
                          {date(c.updatedAt)}
                          {c.id === id ? ' · Discussion actuelle' : ''}
                        </small>
                      </button>
                      <ConfirmButton
                        size="compact-xs"
                        variant="subtle"
                        disabled={busy || c.etat === 'en_cours'}
                        message="Supprimer cette conversation ? Elle ne pourra pas être retrouvée."
                        onConfirm={() =>
                          perform(
                            () => api('DELETE', `/api/assistant/conversations/${encodeURIComponent(c.id)}`),
                            () => {
                              qc.setQueryData<Conversation[]>([...root, 'conversations'], (old) =>
                                old?.filter((item) => item.id !== c.id),
                              );
                              qc.removeQueries({ queryKey: [...root, 'fil', c.id] });
                              setSelections((old) => {
                                const n = { ...old };
                                if (n[c.profil] === c.id) delete n[c.profil];
                                return n;
                              });
                              setDrafts((old) => {
                                const n = { ...old };
                                delete n[c.id];
                                return n;
                              });
                              setContexts((old) => {
                                const n = { ...old };
                                delete n[c.id];
                                return n;
                              });
                              void qc.invalidateQueries({ queryKey: [...root, 'conversations'] });
                              setNotice('Conversation supprimée.');
                            },
                          )
                        }
                      >
                        Supprimer la discussion
                      </ConfirmButton>
                    </div>
                  ))}
              </>
            )}
            {detail.type === 'source' && (
              <>
                <span className="rr-kicker">Source consultée</span>
                <h3>{detail.source.nom}</h3>
                <div className="as-source-box">
                  <strong>Référence de la plateforme</strong>
                  <p>
                    {detail.source.type === 'evidence'
                      ? 'Fiche documentaire ; le contenu du fichier n’est pas reproduit ici.'
                      : detail.source.type === 'lien'
                        ? 'Lien enregistré dans la plateforme. L’assistant en connaît le titre et l’adresse ; il n’a pas ouvert la page.'
                        : detail.source.type === 'document'
                          ? 'Document déposé dans la plateforme, cité par le service ; son contenu n’est pas reproduit ici.'
                          : 'Fiche ou périmètre consulté par l’assistant.'}
                  </p>
                </div>
                {/* Un document n’est rattaché à aucun périmètre : pas de lien inventé. */}
                {detail.source.perimetre && (
                  <p>
                    <Link to={`/pilotage/synthese?perimetre=${encodeURIComponent(detail.source.perimetre)}`}>
                      Ouvrir le périmètre consulté
                    </Link>
                  </p>
                )}
              </>
            )}
            {detail.type === 'proposition' && (
              <Decision
                key={detail.proposition.id}
                proposition={detail.proposition}
                canModify={canModify}
                busy={busy}
                decide={(body) => {
                  if (!canModify) return;
                  void perform(
                    () =>
                      api('POST', `/api/assistant/propositions/${encodeURIComponent(detail.proposition.id)}/decision`, {
                        body,
                      }),
                    () => {
                      void qc.invalidateQueries({ queryKey: [...root, 'propositions'] });
                      void qc.invalidateQueries({ queryKey: ['grc'] });
                      void qc.invalidateQueries({ queryKey: ['assistant', 'propositions'] });
                      setDetail(null);
                      setTab('inbox');
                      setNotice('Décision enregistrée par le service.');
                      setFocusBack(true);
                    },
                  );
                }}
              />
            )}
            {detail.type === 'mission' && (
              <MissionForm
                profil={profil}
                disabled={!canMission || busy || !!blocker}
                onSubmit={(consigne) => {
                  if (!canMission || !profil || blocker) return;
                  void perform(
                    () => api('POST', '/api/assistant/missions', { body: { profil, consigne } }),
                    () => {
                      void qc.invalidateQueries({ queryKey: [...root, 'missions'] });
                      void qc.invalidateQueries({ queryKey: ['assistant', 'missions'] });
                      setDetail(null);
                      setTab('inbox');
                      setNotice('Suivi confié à l’assistant pour ses prochaines rondes.');
                      setFocusBack(true);
                    },
                  );
                }}
              />
            )}
          </section>
        )}
        <footer className="as-bottom">
          <span className="as-live-mark" aria-hidden="true" />
          <span>{provider ? `Questions et extraits transmis à ${provider}` : 'Selon vos droits et périmètres'}</span>
          <button
            type="button"
            onClick={() => setPauseMotion(!pauseMotion)}
            disabled={!!reduced}
            aria-label={
              reduced
                ? 'Animations réduites par votre système'
                : pauseMotion
                  ? 'Reprendre les animations'
                  : 'Suspendre les animations'
            }
          >
            <IconeAssistant nom={pauseMotion || reduced ? 'play' : 'pause'} />
          </button>
        </footer>
      </aside>
    </div>
  );
}

function Decision({
  proposition: p,
  canModify,
  busy,
  decide,
}: {
  proposition: Proposition;
  canModify: boolean;
  busy: boolean;
  decide: (body: Record<string, unknown>) => void;
}) {
  const [titre, setTitre] = useState(p.titre),
    [description, setDescription] = useState(p.description),
    [echeance, setEcheance] = useState(p.echeance ?? ''),
    [note, setNote] = useState('');
  const constat = p.type === 'constat';
  return (
    <>
      <span className="rr-kicker">Proposition · {LIBELLES[p.profil]}</span>
      <h3>Examiner avant de décider</h3>
      <p>
        {constat
          ? 'Le constat sera créé en brouillon et devra suivre le circuit de validation de l’audit.'
          : 'Vous gardez la main sur le titre, le détail et l’échéance.'}
      </p>
      {p.nature && (
        <p>
          Nature proposée :{' '}
          {{ observation: 'Observation', nonconformity: 'Non-conformité', opportunity: 'Opportunité' }[p.nature]}.
        </p>
      )}
      {p.sourceIssueAssistant && (
        <p>L’élément visé provient déjà d’une proposition de l’assistant : à apprécier par l’auditeur.</p>
      )}
      <form
        className="as-editor"
        onSubmit={(e) => {
          e.preventDefault();
          if (canModify && !busy && titre.trim())
            decide({ decision: 'confirmer', titre: titre.trim(), description, echeance: echeance || null, note });
        }}
      >
        <label>
          Titre {constat ? 'du constat' : 'de l’action'}
          <input
            maxLength={LONGUEURS.titre}
            required
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            disabled={!canModify || busy}
          />
        </label>
        <label>
          Description
          <textarea
            aria-label="Description"
            rows={3}
            maxLength={LONGUEURS.description}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canModify || busy}
          />
        </label>
        {!constat && (
          <label>
            Échéance proposée
            <input
              type="date"
              value={echeance}
              onChange={(e) => setEcheance(e.target.value)}
              disabled={!canModify || busy}
            />
          </label>
        )}
        <label>
          Note de décision
          <textarea
            aria-label="Note de décision"
            rows={2}
            maxLength={LONGUEURS.note}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!canModify || busy}
          />
        </label>
        {!canModify && <p className="as-inline-error">Le droit de modification est nécessaire pour décider.</p>}
        <div className="as-card-actions">
          <button className="as-small-button" disabled={!canModify || busy || !titre.trim()}>
            <IconeAssistant nom="check" />
            {constat ? 'Créer le constat en brouillon' : 'Confirmer l’action'}
          </button>
          <button
            type="button"
            className="as-small-button"
            data-variant="quiet"
            disabled={!canModify || busy}
            onClick={() => {
              if (canModify && !busy) decide({ decision: 'rejeter', note });
            }}
          >
            Rejeter
          </button>
        </div>
      </form>
    </>
  );
}
function MissionForm({
  profil,
  disabled,
  onSubmit,
}: {
  profil: Profil | null;
  disabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const [consigne, setConsigne] = useState('');
  return (
    <>
      <span className="rr-kicker">{profil ? LIBELLES[profil] : ''}</span>
      <h3>Demander un suivi</h3>
      <p>
        Confiez un point à l’assistant. Il sera repris lors des prochaines rondes, avec les périmètres autorisés pour ce
        profil.
      </p>
      <form
        className="as-editor"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled && consigne.trim()) onSubmit(consigne.trim());
        }}
      >
        <label>
          Votre consigne
          <textarea
            aria-label="Votre consigne"
            rows={5}
            maxLength={LONGUEURS.mission}
            required
            value={consigne}
            onChange={(e) => setConsigne(e.target.value)}
            disabled={disabled}
          />
        </label>
        <button className="as-small-button" disabled={disabled || !consigne.trim()}>
          <IconeAssistant nom="bell" />
          Confier ce suivi
        </button>
        <p>La date d’exécution dépend des rondes configurées.</p>
      </form>
    </>
  );
}

/* Tableaux de bord multiples de l'accueil (ADR 0109) : encart des favoris (5 au plus) réordonnable au glisser comme les
   rubriques du menu (et Alt + flèches au clavier), bouton déroulant ⌄ de tous les tableaux de la personne avec « + » et
   « − » des favoris, « + » de création, fenêtres de création et de partage, bandeau d'un tableau qui n'est pas à la
   personne. Le premier favori s'ouvre à l'arrivée sur l'accueil. */
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  MultiSelect,
  NativeSelect,
  Popover,
  Switch,
  Text,
  TextInput,
  Tooltip,
  VisuallyHidden,
} from '@mantine/core';
import {
  DEFS_MODELES,
  MAX_FAVORIS,
  type AnnuaireTableauDeBord,
  type DepartTableau,
  type DestinataireTableau,
  type PartageTableauOut,
  type TableauDetail,
  type TableauResume,
  type TableauxOut,
} from '@suivi/shared';
import { ErrorAlert } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { api, get } from '../api';

export const CLE_TABLEAUX = ['tableaux-de-bord'] as const;
const URL = '/api/tableaux-de-bord';
const SANS_PORTAIL = { withinPortal: false } as const;
/** Distance (px) à partir de laquelle un appui sur un onglet devient un glisser : en deçà, c'est un clic. */
const SEUIL = 6;

export const useTableaux = () => useQuery({ queryKey: CLE_TABLEAUX, queryFn: () => get<TableauxOut>(URL) });

function IconeGlobe() {
  return (
    <svg
      className="tdb-onglet-icone"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.2" />
      <path d="M1.8 8h12.4M8 1.8c2 2 2 10.4 0 12.4M8 1.8c-2 2-2 10.4 0 12.4" />
    </svg>
  );
}
function IconePartage() {
  return (
    <svg
      className="tdb-onglet-icone"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <circle cx="5.5" cy="6" r="2.3" />
      <circle cx="11" cy="6.5" r="1.8" />
      <path d="M1.5 13.5c.6-2.4 2.2-3.6 4-3.6s3.4 1.2 4 3.6M9.7 10.2c1.6-.4 3.6.4 4.4 3.3" />
    </svg>
  );
}
function IconeCadenas() {
  return (
    <svg
      className="tdb-onglet-icone"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

/** Ce que dit l'icône d'un onglet, aussi lu par les lecteurs d'écran. */
function nature(t: TableauResume) {
  if (t.public) return { icone: <IconeGlobe />, texte: 'public' };
  if (t.origine === 'partage')
    return { icone: <IconePartage />, texte: `partagé par ${t.auteur ?? 'un autre compte'}` };
  if (t.origine === 'propose' && t.restreint) return { icone: <IconeCadenas />, texte: 'réservé à certains rôles' };
  return null;
}

/** Descriptif d'un tableau affiché hors favoris, sous son nom : celui du modèle pour un tableau proposé d'office, sinon
    son auteur. */
export function descriptifTableau(t: TableauResume): string {
  if (t.modele) return DEFS_MODELES[t.modele].description;
  if (t.origine === 'mien') return 'Votre tableau de bord';
  return `${t.public ? 'Tableau public' : 'Tableau partagé'} de ${t.auteur ?? 'un autre compte'}, en lecture seule`;
}

/** « + » de la barre d'outils : créer un tableau (droit tableau_de_bord:modifier). */
export function BoutonCreer({ onCreer }: { onCreer: () => void }) {
  return (
    <Tooltip label="Créer un tableau de bord" withArrow>
      <ActionIcon
        variant="default"
        size="lg"
        className="tdb-outil"
        aria-label="Créer un tableau de bord"
        onClick={onCreer}
      >
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M8 3v10M3 8h10" />
        </svg>
      </ActionIcon>
    </Tooltip>
  );
}

/** Bouton déroulant ⌄ : tous les tableaux que la personne peut afficher (favoris d'abord), avec un petit « + » pour en
    mettre un dans l’encart des favoris (5 au plus) ou un « − » pour l'en retirer (choix du RSSI du 20/11/2026). */
export function MenuTableaux({
  donnees,
  actif,
  onChoisir,
}: {
  donnees: TableauxOut;
  actif: string;
  onChoisir: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const favoris = donnees.onglets.map((t) => t.id);
  const plein = favoris.length >= MAX_FAVORIS;
  const parId = new Map<string, TableauResume>(donnees.disponibles.map((t) => [t.id, t]));
  for (const t of donnees.onglets) if (!parId.has(t.id)) parId.set(t.id, t);
  const liste = [
    ...favoris.map((id) => parId.get(id)!).filter(Boolean),
    ...donnees.disponibles.filter((t) => !favoris.includes(t.id)),
  ];
  async function ecrire(ids: string[]) {
    setErreur(null);
    try {
      await api('PUT', `${URL}/onglets`, { body: { tableaux: ids } });
      await qc.invalidateQueries({ queryKey: CLE_TABLEAUX });
    } catch (e) {
      setErreur(e);
    }
  }
  return (
    <Popover opened={ouvert} onChange={setOuvert} position="bottom-start" shadow="md" withinPortal={false}>
      <Popover.Target>
        <Tooltip label="Mes tableaux de bord" withArrow disabled={ouvert}>
          <ActionIcon
            variant="default"
            size="lg"
            className="tdb-outil"
            aria-label="Mes tableaux de bord"
            aria-expanded={ouvert}
            onClick={() => setOuvert((o) => !o)}
          >
            <svg
              viewBox="0 0 16 16"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown className="tdb-liste-tableaux">
        <div className="tdb-liste-tete">
          <span>Mes tableaux de bord</span>
          <span>
            Favoris : {favoris.length} / {MAX_FAVORIS}
          </span>
        </div>
        <ErrorAlert error={erreur} />
        <ul aria-label="Mes tableaux de bord">
          {liste.map((t) => {
            const favori = favoris.includes(t.id);
            const n = nature(t);
            return (
              <li key={t.id} className={t.id === actif ? 'tdb-liste-actif' : undefined}>
                <button
                  type="button"
                  className="tdb-liste-nom"
                  disabled={!t.disponible}
                  aria-current={t.id === actif ? 'true' : undefined}
                  onClick={() => {
                    setOuvert(false);
                    onChoisir(t.id);
                  }}
                >
                  <span>{t.nom}</span>
                  {n && (
                    <>
                      {n.icone}
                      {t.restreint && t.origine === 'propose' ? (
                        <VisuallyHidden>{n.texte}</VisuallyHidden>
                      ) : (
                        <small>{n.texte}</small>
                      )}
                    </>
                  )}
                  {!t.disponible && <small>bientôt</small>}
                </button>
                {favori ? (
                  <ActionIcon
                    size="sm"
                    variant="filled"
                    className="tdb-favori"
                    aria-label={`Retirer « ${t.nom} » des favoris`}
                    disabled={favoris.length < 2}
                    onClick={() => void ecrire(favoris.filter((x) => x !== t.id))}
                  >
                    −
                  </ActionIcon>
                ) : (
                  <ActionIcon
                    size="sm"
                    variant="default"
                    className="tdb-favori"
                    aria-label={`Ajouter « ${t.nom} » aux favoris`}
                    disabled={plein || !t.disponible}
                    onClick={() => void ecrire([...favoris, t.id])}
                  >
                    +
                  </ActionIcon>
                )}
              </li>
            );
          })}
        </ul>
        {plein && (
          <Text size="xs" c="dimmed">
            {MAX_FAVORIS} favoris au plus : retirez-en un pour en ajouter un autre.
          </Text>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}

/** Encart des favoris, à gauche de l'en-tête, au style des sélecteurs segmentés (5 au plus, « Global » d'office ; choix
    du RSSI du 20/11/2026) : réordonnables au glisser comme les rubriques du menu ; le premier s'ouvre à l'arrivée. */
export function OngletsTableaux({
  donnees,
  actif,
  onChoisir,
}: {
  donnees: TableauxOut;
  actif: string;
  onChoisir: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [brouillon, setBrouillon] = useState<string[] | null>(null);
  const [glisse, setGlisse] = useState<string | null>(null);
  const [annonce, setAnnonce] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const parId = new Map(donnees.onglets.map((t) => [t.id, t]));
  const ordre = brouillon ?? donnees.onglets.map((t) => t.id);
  const ordreRef = useRef(ordre);
  ordreRef.current = ordre;
  const clicIgnore = useRef(false);
  const fin = useRef<(() => void) | null>(null);
  const aRefocaliser = useRef<string | null>(null);
  const barre = useRef<HTMLDivElement>(null);

  useEffect(() => () => fin.current?.(), []);
  useEffect(() => {
    const id = aRefocaliser.current;
    if (!id) return;
    aRefocaliser.current = null;
    barre.current?.querySelector<HTMLElement>(`[data-onglet="${CSS.escape(id)}"]`)?.focus();
  });

  async function enregistrer(ids: string[]) {
    setErreur(null);
    try {
      qc.setQueryData<TableauxOut>(CLE_TABLEAUX, (d) =>
        d ? { ...d, onglets: ids.map((id) => d.onglets.find((t) => t.id === id)!).filter(Boolean) } : d,
      );
      await api('PUT', `${URL}/onglets`, { body: { tableaux: ids } });
    } catch (e) {
      setErreur(e);
    } finally {
      await qc.invalidateQueries({ queryKey: CLE_TABLEAUX });
    }
  }

  const deplacer = (ids: string[], id: string, cible: string, apres: boolean) => {
    const reste = ids.filter((x) => x !== id);
    const i = reste.indexOf(cible) + (apres ? 1 : 0);
    return [...reste.slice(0, i), id, ...reste.slice(i)];
  };

  const surPointeurBas = (id: string) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    fin.current?.();
    clicIgnore.current = false;
    const depart = { x: e.clientX, y: e.clientY };
    let actifGlisse = false;
    let courant: string[] | null = null;
    const deplace = (ev: PointerEvent) => {
      if (!actifGlisse) {
        if (Math.hypot(ev.clientX - depart.x, ev.clientY - depart.y) < SEUIL) return;
        actifGlisse = true;
        clicIgnore.current = true;
        setGlisse(id);
      }
      ev.preventDefault();
      const sous = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-onglet]')
        ?.dataset.onglet;
      if (!sous || sous === id) return;
      // Vers un onglet plus à droite : se placer après lui ; plus à gauche : avant lui (pas d'oscillation au survol).
      const ids = ordreRef.current;
      courant = deplacer(ids, id, sous, ids.indexOf(sous) > ids.indexOf(id));
      ordreRef.current = courant;
      setBrouillon(courant);
    };
    const arreter = (garder: boolean) => {
      window.removeEventListener('pointermove', deplace);
      window.removeEventListener('pointerup', relache);
      window.removeEventListener('pointercancel', annule);
      window.removeEventListener('keydown', echap);
      fin.current = null;
      setGlisse(null);
      if (garder && courant) {
        void enregistrer(courant);
        setAnnonce(`Position ${courant.indexOf(id) + 1} sur ${courant.length}.`);
      }
      setBrouillon(null);
    };
    const relache = () => arreter(actifGlisse);
    const annule = () => arreter(false);
    const echap = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === 'Escape' && actifGlisse) {
        ev.preventDefault();
        arreter(false);
      }
    };
    window.addEventListener('pointermove', deplace);
    window.addEventListener('pointerup', relache);
    window.addEventListener('pointercancel', annule);
    window.addEventListener('keydown', echap);
    fin.current = annule;
  };

  const surTouche = (t: TableauDetail) => (e: KeyboardEvent<HTMLElement>) => {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const i = ordre.indexOf(t.id);
    const j = i + (e.key === 'ArrowLeft' ? -1 : 1);
    if (j < 0 || j >= ordre.length) {
      setAnnonce(`« ${t.nom} » est déjà ${j < 0 ? 'en premier' : 'en dernier'}.`);
      return;
    }
    void enregistrer(deplacer(ordre, t.id, ordre[j]!, j > i));
    setAnnonce(`« ${t.nom} » : position ${j + 1} sur ${ordre.length}.`);
    aRefocaliser.current = t.id;
  };

  return (
    <div className="tdb-onglets" ref={barre}>
      <div
        className="tdb-favoris"
        role="tablist"
        aria-label="Mes favoris"
        data-tri-actif={glisse ? 'oui' : undefined}
        onClickCapture={(e) => {
          if (!clicIgnore.current) return;
          clicIgnore.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {ordre.map((id) => {
          const t = parId.get(id);
          if (!t) return null;
          const n = nature(t);
          return (
            <a
              key={id}
              href={`#tableau-${id}`}
              role="tab"
              data-onglet={id}
              data-glisse={glisse === id ? 'oui' : undefined}
              aria-selected={id === actif}
              aria-current={id === actif ? 'page' : undefined}
              aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
              draggable={false}
              onPointerDown={surPointeurBas(id)}
              onKeyDown={surTouche(t)}
              onClick={(e) => {
                e.preventDefault();
                onChoisir(id);
              }}
            >
              {t.nom}
              {n && (
                <>
                  {n.icone}
                  <VisuallyHidden>({n.texte})</VisuallyHidden>
                </>
              )}
            </a>
          );
        })}
      </div>
      <ErrorAlert error={erreur} />
      <VisuallyHidden aria-live="polite">{annonce}</VisuallyHidden>
    </div>
  );
}

/** Création d'un tableau : un nom, puis un point de départ (vide, disposition standard, copie d'un de ses tableaux ou
    d'un tableau public). Le nouveau tableau rejoint les favoris s'il reste une place et s'ouvre en modification. */
export function FenetreCreer({
  ouverte,
  donnees,
  onFermer,
  onCree,
}: {
  ouverte: boolean;
  donnees: TableauxOut;
  onFermer: () => void;
  onCree: (t: TableauDetail) => void;
}) {
  const qc = useQueryClient();
  const [nom, setNom] = useState('');
  const [type, setType] = useState<DepartTableau['type']>('standard');
  const sources = [
    ...donnees.disponibles.filter((t) => t.origine === 'mien').map((t) => ({ value: t.id, label: t.nom })),
    ...donnees.disponibles.filter((t) => t.public).map((t) => ({ value: t.id, label: `${t.nom} (Public)` })),
  ];
  const [source, setSource] = useState('');
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const sourceRetenue = source || sources[0]?.value || '';

  async function creer() {
    setPending(true);
    setErreur(null);
    try {
      const depart: DepartTableau = type === 'copie' ? { type, tableau: sourceRetenue } : { type };
      const t = await api<TableauDetail>('POST', URL, { body: { nom, depart } });
      await qc.invalidateQueries({ queryKey: CLE_TABLEAUX });
      setNom('');
      onCree(t);
    } catch (e) {
      setErreur(e);
    } finally {
      setPending(false);
    }
  }

  const departs: { type: DepartTableau['type']; titre: string; texte: string }[] = [
    { type: 'vide', titre: 'Vide', texte: 'Le catalogue des dalles s’ouvre aussitôt.' },
    { type: 'standard', titre: 'Disposition standard', texte: 'Les onze cartes de la vue analytique.' },
    { type: 'copie', titre: 'Copie d’un tableau', texte: 'Un de vos tableaux ou un tableau public.' },
  ];
  return (
    <Modal opened={ouverte} onClose={onFermer} title="Créer un tableau de bord" size="lg" lockScroll={false}>
      <div className="tdb-fenetre">
        <Text size="sm" c="dimmed">
          Il rejoint vos favoris s’il reste une place. Glissez-le en tête pour l’ouvrir à l’arrivée.
        </Text>
        <TextInput label="Nom" required maxLength={60} value={nom} onChange={(e) => setNom(e.currentTarget.value)} />
        <div role="radiogroup" aria-label="Point de départ" className="tdb-departs">
          {departs.map((d) => (
            <button
              key={d.type}
              type="button"
              role="radio"
              aria-checked={type === d.type}
              disabled={d.type === 'copie' && !sources.length}
              className="tdb-depart"
              onClick={() => setType(d.type)}
            >
              <span className={`tdb-depart-vignette tdb-depart-${d.type}`} aria-hidden="true" />
              <b>{d.titre}</b>
              <small>{d.texte}</small>
            </button>
          ))}
        </div>
        {type === 'copie' && (
          <>
            <NativeSelect
              label="Tableau à copier"
              data={sources}
              value={sourceRetenue}
              onChange={(e) => setSource(e.currentTarget.value)}
            />
            <Text size="xs" c="dimmed">
              Une copie est à vous et suit vos droits : les dalles des modules que vous ne lisez pas y restent vides.
            </Text>
          </>
        )}
        <ErrorAlert error={erreur} />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onFermer} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={() => void creer()} loading={pending} disabled={!nom.trim()}>
            Créer et modifier
          </Button>
        </Group>
      </div>
    </Modal>
  );
}

const valeur = (d: Pick<DestinataireTableau, 'type' | 'id'>) => `${d.type}:${d.id}`;
const destinataire = (v: string): DestinataireTableau => {
  const i = v.indexOf(':');
  return { type: v.slice(0, i) as DestinataireTableau['type'], id: v.slice(i + 1) };
};

/** Partage d'un tableau avec des personnes, des groupes ou des rôles, et publication pour tous (droit dédié). */
export function PartageTableau({
  tableau,
  peutPublier,
  onFin,
}: {
  tableau: TableauDetail;
  peutPublier: boolean;
  onFin: () => void;
}) {
  const qc = useQueryClient();
  const url = `${URL}/${tableau.id}/partage`;
  const partage = useQuery({
    queryKey: [...CLE_TABLEAUX, tableau.id, 'partage'],
    queryFn: () => get<PartageTableauOut>(url),
  });
  const annuaire = useQuery({
    queryKey: [...CLE_TABLEAUX, 'annuaire'],
    queryFn: () => get<AnnuaireTableauDeBord>(`${URL}/annuaire`),
  });
  const [choisis, setChoisis] = useState<string[] | null>(null);
  const [publique, setPublique] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const actuels = partage.data?.destinataires.map(valeur) ?? [];
  const valeurs = choisis ?? actuels;
  const pub = publique ?? partage.data?.public ?? false;
  const modifie =
    (choisis !== null && (choisis.length !== actuels.length || choisis.some((v) => !actuels.includes(v)))) ||
    (publique !== null && publique !== partage.data?.public);

  const options = (a: AnnuaireTableauDeBord) => {
    const roles = a.roles.map((r) => ({ value: `role:${r.id}`, label: `Rôle : ${r.nom}` }));
    const groupes = a.groupes.map((g) => ({
      value: `groupe:${g.id}`,
      label: `${g.nom} (${g.membres} membre${g.membres > 1 ? 's' : ''})`,
    }));
    const personnes = a.utilisateurs.map((u) => ({
      value: `utilisateur:${u.id}`,
      label: u.nom === u.identifiant ? u.nom : `${u.nom} (${u.identifiant})`,
    }));
    // Un destinataire désactivé ou supprimé depuis le partage reste affiché pour pouvoir être retiré.
    const connus = new Set([...roles, ...groupes, ...personnes].map((o) => o.value));
    const anciens = (partage.data?.destinataires ?? [])
      .filter((d) => !connus.has(valeur(d)))
      .map((d) => ({ value: valeur(d), label: d.nom }));
    return [
      { group: 'Rôles', items: roles },
      { group: 'Groupes', items: groupes },
      { group: 'Personnes', items: [...personnes, ...anciens] },
    ].filter((g) => g.items.length);
  };

  async function valider() {
    setPending(true);
    setErreur(null);
    try {
      await api('PUT', url, {
        body: { destinataires: valeurs.map(destinataire), public: pub },
        ifMatch: partage.data!.version,
      });
      await qc.invalidateQueries({ queryKey: CLE_TABLEAUX });
      onFin();
    } catch (e) {
      setErreur(e);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="tdb-edition-barre" role="region" aria-label="Partager mon tableau de bord">
      <Text size="sm">
        Les destinataires le trouvent dans la liste de leurs tableaux (⌄), en lecture seule.{' '}
        {peutPublier
          ? 'Ils voient vos chiffres et graphiques, même sans droit sur les modules ; listes nommées et registres selon leurs droits.'
          : 'Chacun voit les chiffres avec ses propres droits.'}
      </Text>
      <ErrorAlert error={partage.error ?? annuaire.error ?? erreur} />
      {partage.data && annuaire.data && (
        <MultiSelect
          label="Partager avec"
          placeholder={valeurs.length ? undefined : 'Rechercher une personne, un groupe ou un rôle'}
          searchable
          clearable
          comboboxProps={SANS_PORTAIL}
          nothingFoundMessage="Aucune personne, aucun groupe ni aucun rôle"
          data={options(annuaire.data)}
          value={valeurs}
          onChange={setChoisis}
        />
      )}
      {peutPublier && tableau.origine === 'mien' && partage.data && (
        <div className="tdb-publication">
          <Switch
            checked={pub}
            onChange={(e) => setPublique(e.currentTarget.checked)}
            label="Public : visible par tout le monde, en lecture seule"
          />
          <ul>
            <li>Chiffres et graphiques visibles par tous, même sans droit sur les modules concernés.</li>
            <li>Listes nommées, journal d’audit et accès aux registres : selon les droits de chacun.</li>
            <li>Publication et retrait inscrits au journal d’audit.</li>
          </ul>
        </div>
      )}
      <Group gap="xs">
        <Button disabled={!modifie || pending || !partage.data} loading={pending} onClick={() => void valider()}>
          Enregistrer le partage
        </Button>
        <Button variant="default" disabled={pending} onClick={onFin}>
          Fermer
        </Button>
      </Group>
    </div>
  );
}

/** Bandeau d'un tableau partagé avec la personne ou public : origine, lecture seule, retrait de ses favoris. */
export function BandeauTableau({ tableau, onRetirer }: { tableau: TableauDetail; onRetirer?: () => void }) {
  // Ses tableaux et les tableaux proposés d'office (l'accueil de chacun) n'ont pas de bandeau.
  if (tableau.origine === 'mien' || tableau.origine === 'propose') return null;
  const n = nature(tableau);
  const qui = tableau.public
    ? `Tableau public de ${tableau.auteur ?? 'un autre compte'}`
    : `Tableau partagé par ${tableau.auteur ?? 'un autre compte'}`;
  return (
    <div className={`tdb-bandeau${tableau.public ? ' tdb-bandeau--public' : ''}`} role="note">
      {n?.icone}
      <span>
        <b>{qui}</b> · lecture seule.{' '}
        {tableau.chiffresOuverts
          ? 'Chiffres et graphiques de son auteur ; listes et registres selon vos droits.'
          : 'Chiffres selon vos droits.'}{' '}
        {tableau.public && 'Pour en faire le vôtre : « + », puis Copie d’un tableau.'}
      </span>
      {onRetirer && (
        <Button size="compact-sm" variant="default" onClick={onRetirer}>
          Retirer de mes favoris
        </Button>
      )}
    </div>
  );
}

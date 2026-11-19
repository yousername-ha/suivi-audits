/* Mode « Modifier la disposition » du tableau de bord de l'accueil (ADR 0078, lot 2a ; tableau unique, ADR 0108) :
   déplacer les dalles au glisser (poignée ou surface de la dalle à la souris, poignée au doigt) ou au clavier (flèches,
   Origine, Fin sur la poignée), changer leur largeur et leur hauteur (bord droit, bord bas ou coin à tirer, aimantés sur
   les tailles proposées, ou listes), les retirer, ajouter n'importe quelle dalle du catalogue, plusieurs fois au besoin,
   régler leurs seuils, leur cible et leur visualisation (lot 2c). Pendant le glissé, la dalle suit le pointeur et une
   ombre bleue translucide marque sa place d'arrivée ; les autres se poussent en direct. Aimant (activé par défaut) : au
   lâcher, les places libres sont comblées par les dalles suivantes qui y tiennent. Enregistre la disposition personnelle
   (droit tableau_de_bord:modifier, lot 2b) ; un administrateur peut aussi la proposer à tous. Aucune donnée n'est
   enregistrée : seulement l'ordre, les tailles, les copies et les dalles masquées. Le déplacement visuel passe par des
   variables CSS posées par le CSSOM (permis par l'ADR 0006), jamais par un attribut style. */
import { Alert, Button, Drawer, Group, NativeSelect, NumberInput, Switch, Text, VisuallyHidden } from '@mantine/core';
import {
  ajouterDalle,
  cleDalle,
  compacterDisposition,
  COLONNES_TABLEAU_DE_BORD,
  completerDisposition,
  dallesAffichees,
  deplacerDalle,
  deplacerDalleAuClavier,
  dispositionStandard,
  hauteurAimantee,
  hauteurDalle,
  HAUTEURS_DALLE,
  largeurAimantee,
  LARGEURS_DALLE,
  LIBELLES_HAUTEUR,
  LIBELLES_LARGEUR,
  LIBELLES_VISUALISATION,
  memesDispositions,
  modifierDalle,
  REGLAGES_DALLE,
  retirerDalle,
  SEUILS_JOURS_STANDARD,
  SEUILS_STANDARD,
  visualisationDalle,
  type DalleDisposee,
  type Disposition,
  type DispositionsOut,
  type HauteurDisposee,
  type IdDalle,
  type ReglagesDalle,
  type Synthese,
  type Visualisation,
} from '@suivi/shared';
import { ConfirmButton, ErrorAlert, type LargeurDalle } from '@suivi/ui';
import { useQueryClient } from '@tanstack/react-query';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { api, del } from '../api';
import { useDallesTableauDeBord } from './TableauDeBord';
import { GROUPES_DALLES, type DalleTableauDeBord } from './tdb-types';

export const CLE_DISPOSITION = ['tableau-de-bord', 'disposition'] as const;
const URL_PERSO = '/api/tableau-de-bord/disposition';
const URL_DEFAUT = '/api/admin/tableau-de-bord/disposition-par-defaut';

const SENS_TOUCHES: Record<string, -1 | 1 | 'debut' | 'fin'> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
  Home: 'debut',
  End: 'fin',
};

/** Distance, en pixels, au-delà de laquelle un appui sur la surface d'une dalle devient un glissé (en deçà : un clic). */
const SEUIL_GLISSE = 6;
/** Bande, en pixels, près des bords haut et bas de la fenêtre où le glissé fait défiler la page. */
const BANDE_DEFILEMENT = 56;
/** Éléments d'une case qui gardent leur propre comportement : ils ne démarrent pas de glissé. */
const HORS_GLISSE =
  'button:not(.tdb-poignee), select, input, textarea, a, label, .tdb-reglages, .tdb-redim, .tdb-redim-bas, .tdb-redim-coin';

/** Glissé en cours : clé de la dalle, point de saisie dans la dalle, dernière position du pointeur, seuil franchi ou non. */
interface Glisse {
  id: string;
  decalX: number;
  decalY: number;
  departX: number;
  departY: number;
  x: number;
  y: number;
  demarre: boolean;
}
/** Redimensionnement en cours : clé de la dalle, bord tiré (droit, bas ou coin), coin haut gauche de la dalle (haut
    mesuré dans la page), largeur d'une colonne et hauteur d'une ligne (écarts compris), en pixels. */
interface Redim {
  id: string;
  sens: 'largeur' | 'hauteur' | 'coin';
  gauche: number;
  hautPage: number;
  colonne: number;
  ecart: number;
  ligne: number;
  ecartLignes: number;
}

/** Position et taille annoncées après un lâcher : la largeur après un glissé ou un bord droit, la hauteur après le bord
    bas, les deux après le coin. */
type Posee = { id: string; quoi: 'largeur' | 'hauteur' | 'coin' };

const minuscule = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

function IconeRetirer() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/** Catalogue « Ajouter une dalle » (ADR 0108) : toutes les dalles lisibles, par famille ; une dalle déjà affichée
    s'ajoute encore, en copie. */
function Catalogue({
  ouvert,
  onFermer,
  dalles,
  disposition,
  onAjouter,
}: {
  ouvert: boolean;
  onFermer: () => void;
  dalles: readonly DalleTableauDeBord[];
  disposition: Disposition;
  onAjouter: (id: IdDalle) => void;
}) {
  const affichees = (id: IdDalle) => disposition.dalles.filter((x) => x.id === id && !x.masquee).length;
  return (
    <Drawer opened={ouvert} onClose={onFermer} title="Ajouter une dalle" position="right" size="md" lockScroll={false}>
      <div className="tdb-catalogue">
        <Text size="sm" c="dimmed">
          Une dalle ajoutée se place à la fin, puis l’aimant la remonte dans la première place libre.
        </Text>
        {GROUPES_DALLES.map((groupe) => {
          const membres = dalles
            .filter((x) => x.groupe === groupe)
            .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
          if (!membres.length) return null;
          return (
            <section key={groupe} className="tdb-catalogue-groupe" aria-label={groupe}>
              <h3>{groupe}</h3>
              <ul>
                {membres.map((x) => {
                  const n = affichees(x.id);
                  return (
                    <li key={x.id} className="tdb-catalogue-dalle">
                      <div>
                        <b>{x.titre}</b>
                        <span>{x.description}</span>
                        {n > 0 && (
                          <span className="tdb-catalogue-etat">{n > 1 ? `Affichée ${n} fois` : 'Affichée'}</span>
                        )}
                      </div>
                      <Button
                        size="compact-sm"
                        variant={n ? 'default' : 'light'}
                        aria-label={`${n ? 'Ajouter encore' : 'Ajouter'} « ${x.titre} »`}
                        onClick={() => onAjouter(x.id)}
                      >
                        {n ? 'Ajouter encore' : 'Ajouter'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </Drawer>
  );
}

function IconePoignee() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <circle cx="5.5" cy="3.5" r="1.5" />
      <circle cx="10.5" cy="3.5" r="1.5" />
      <circle cx="5.5" cy="8" r="1.5" />
      <circle cx="10.5" cy="8" r="1.5" />
      <circle cx="5.5" cy="12.5" r="1.5" />
      <circle cx="10.5" cy="12.5" r="1.5" />
    </svg>
  );
}

/** Deux seuils liés (orange puis vert à partir de…) : l'un ne dépasse jamais l'autre. */
function Paliers({
  legende,
  unite,
  max,
  valeur,
  onChange,
}: {
  legende: string;
  unite: string;
  max: number;
  valeur: { orange: number; vert: number };
  onChange: (v: { orange: number; vert: number }) => void;
}) {
  const nombre = (v: number | string) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  return (
    <fieldset className="tdb-reglages-paliers">
      <legend>{legende}</legend>
      <NumberInput
        size="xs"
        label={`Orange à partir de (${unite})`}
        min={0}
        max={max}
        allowDecimal={false}
        value={valeur.orange}
        onChange={(v) => {
          const orange = nombre(v);
          onChange({ orange, vert: Math.max(orange, valeur.vert) });
        }}
      />
      <NumberInput
        size="xs"
        label={`Vert à partir de (${unite})`}
        min={0}
        max={max}
        allowDecimal={false}
        value={valeur.vert}
        onChange={(v) => {
          const vert = nombre(v);
          onChange({ orange: Math.min(valeur.orange, vert), vert });
        }}
      />
      <Text size="xs" c="dimmed">
        Rouge en dessous du seuil orange.
      </Text>
    </fieldset>
  );
}

/** Réglages d'une dalle (lot 2c) : visualisation, seuils de couleur, cible. Choix d'affichage, sans effet sur les
    données ; sans réglage, la dalle garde ses seuils et sa visualisation standard. */
function PanneauReglages({
  id,
  idPanneau,
  titre,
  reglages,
  onChange,
}: {
  id: IdDalle;
  idPanneau: string;
  titre: string;
  reglages: ReglagesDalle | undefined;
  onChange: (r: ReglagesDalle | undefined) => void;
}) {
  const permis = REGLAGES_DALLE[id]!;
  const r = reglages ?? {};
  const maj = (champs: Partial<ReglagesDalle>) => onChange({ ...r, ...champs });
  return (
    <div className="tdb-reglages" id={idPanneau} role="group" aria-label={`Réglages de « ${titre} »`}>
      {permis.visualisations && (
        <NativeSelect
          size="xs"
          label="Visualisation"
          value={visualisationDalle(id, reglages) ?? ''}
          data={permis.visualisations.map((v) => ({ value: v, label: LIBELLES_VISUALISATION[v] }))}
          onChange={(e) => {
            const v = e.currentTarget.value as Visualisation;
            maj({ visualisation: v === permis.visualisations![0] ? undefined : v });
          }}
        />
      )}
      {permis.seuils && (
        <Paliers
          legende={id === 'phare' ? 'Couleurs du taux global' : 'Couleurs du taux'}
          unite="%"
          max={100}
          valeur={r.seuils ?? SEUILS_STANDARD}
          onChange={(seuils) => maj({ seuils })}
        />
      )}
      {permis.seuilsJours && (
        <Paliers
          legende="Couleurs du compte à rebours de l’audit"
          unite="jours"
          max={365}
          valeur={r.seuilsJours ?? SEUILS_JOURS_STANDARD}
          onChange={(seuilsJours) => maj({ seuilsJours })}
        />
      )}
      {permis.cible && (
        <NumberInput
          size="xs"
          label="Cible (%)"
          description="Trait sur la jauge ou les barres ; vide : aucune cible."
          min={0}
          max={100}
          allowDecimal={false}
          value={r.cible ?? ''}
          onChange={(v) =>
            maj({ cible: v === '' ? undefined : Math.max(0, Math.min(100, Math.round(Number(v) || 0))) })
          }
        />
      )}
      <Button size="compact-sm" variant="subtle" disabled={!reglages} onClick={() => onChange(undefined)}>
        Réglages standard
      </Button>
    </div>
  );
}

export function EditionTableauDeBord({
  s,
  dispositions,
  base,
  peutDefinirDefaut,
  onFin,
}: {
  s: Synthese;
  dispositions: DispositionsOut;
  /** Disposition affichée au moment d'entrer en modification (la sienne, celle de l'organisation ou un tableau reçu). */
  base: Disposition | null;
  peutDefinirDefaut: boolean;
  onFin: () => void;
}) {
  const qc = useQueryClient();
  const aide = useId();
  const dalles = useDallesTableauDeBord(s);
  const parId = useMemo(() => new Map(dalles.map((x) => [x.id, x])), [dalles]);
  const idsDisponibles = dalles.map((x) => x.id).join(' ');
  const disponibles = useMemo(() => new Set<IdDalle>(idsDisponibles.split(' ') as IdDalle[]), [idsDisponibles]);
  // Départ : la disposition affichée (la sienne, celle de l'organisation ou un tableau reçu), complète, sinon la
  // disposition standard de la vue analytique (ADR 0108).
  const [depart] = useState<Disposition>(() =>
    base
      ? completerDisposition(
          base,
          Object.fromEntries(dalles.map((x) => [x.id, x.largeur])) as Partial<Record<IdDalle, LargeurDalle>>,
        )
      : dispositionStandard(),
  );
  // Partir d'un autre tableau que le sien : l'enregistrer en fait sa disposition, même sans changement.
  const autreQueLaSienne = base !== (dispositions.personnelle?.disposition ?? null);
  const [d, setD] = useState<Disposition>(depart);
  const [glisse, setGlisse] = useState<Glisse | null>(null);
  const [redim, setRedim] = useState<Redim | null>(null);
  const [magnetique, setMagnetique] = useState(true);
  const [catalogue, setCatalogue] = useState(false);
  const grille = useRef<HTMLDivElement>(null);
  const glissee = glisse?.demarre ? glisse.id : null;
  // Dalle posée au dernier lâcher : son rang et sa taille sont annoncés une fois la disposition rendue.
  const [posee, setPosee] = useState<Posee | null>(null);
  const [reglee, setReglee] = useState<string | null>(null);
  const [annonce, setAnnonce] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const vues = dallesAffichees(d, disponibles);
  /** Titre d'une dalle par sa clé ; une copie porte son numéro. */
  const titre = (cle: string) => {
    const x = d.dalles.find((y) => cleDalle(y) === cle);
    const t = (x && parId.get(x.id)?.titre) ?? cle;
    return x?.cle ? `${t} (copie ${x.cle.split('~')[1]})` : t;
  };
  const modifiee = !memesDispositions(d, depart);

  async function agir(fn: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: CLE_DISPOSITION });
      onFin();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }

  const surTouche = (id: string) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const sens = SENS_TOUCHES[e.key];
    if (!sens) return;
    e.preventDefault();
    const r = deplacerDalleAuClavier(d, id, sens, disponibles);
    setD(r.disposition);
    setAnnonce(`« ${titre(id)} » : position ${r.rang} sur ${r.total}.`);
  };

  const caseDe = (id: string) =>
    [...(grille.current?.querySelectorAll<HTMLElement>('[data-cle]') ?? [])].find((c) => c.dataset.cle === id) ?? null;

  /** Saisie d'une dalle : par la poignée (souris ou doigt, glissé immédiat) ou par sa surface (souris ou stylet, glissé
      au-delà de quelques pixels, pour laisser les clics). */
  const surPointeurBas = (id: string) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || redim) return;
    const cible = e.target as HTMLElement;
    const parPoignee = !!cible.closest('.tdb-poignee');
    if (!parPoignee && (cible.closest(HORS_GLISSE) || e.pointerType === 'touch')) return;
    const r = caseDe(id)?.getBoundingClientRect();
    if (!r) return;
    e.preventDefault();
    setGlisse({
      id,
      decalX: e.clientX - r.left,
      decalY: e.clientY - r.top,
      departX: e.clientX,
      departY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      demarre: parPoignee,
    });
  };

  /** Place d'arrivée : la dalle sous le pointeur (avant elle en remontant, après elle en descendant), ou la fin de la
      grille sous la dernière rangée. */
  const placer = (id: string, x: number, y: number) => {
    const cases = [...(grille.current?.querySelectorAll<HTMLElement>('[data-cle]') ?? [])].filter(
      (c) => c.dataset.cle !== id,
    );
    const sous = cases.find((c) => {
      const r = c.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    const bas = Math.max(...cases.map((c) => c.getBoundingClientRect().bottom));
    setD((cur) => {
      const cles = dallesAffichees(cur, disponibles).map(cleDalle);
      if (sous) {
        const cible = sous.dataset.cle!;
        return cles.includes(cible) ? deplacerDalle(cur, id, cible, cles.indexOf(cible) > cles.indexOf(id)) : cur;
      }
      const derniere = cles[cles.length - 1];
      return cases.length && y > bas && derniere && derniere !== id ? deplacerDalle(cur, id, derniere, true) : cur;
    });
  };

  useEffect(() => {
    if (!posee) return;
    const vuesApres = dallesAffichees(d, disponibles);
    const r = vuesApres.find((v) => cleDalle(v) === posee.id);
    const taille = !r
      ? ''
      : posee.quoi === 'hauteur'
        ? minuscule(LIBELLES_HAUTEUR[hauteurDalle(r)])
        : posee.quoi === 'coin'
          ? `${minuscule(LIBELLES_LARGEUR[r.largeur])}, ${minuscule(LIBELLES_HAUTEUR[hauteurDalle(r)])}`
          : minuscule(LIBELLES_LARGEUR[r.largeur]);
    setAnnonce(
      `« ${titre(posee.id)} » : position ${vuesApres.findIndex((v) => cleDalle(v) === posee.id) + 1} sur ${vuesApres.length}` +
        (taille ? `, ${taille}.` : '.'),
    );
    setPosee(null);
    // titre ne dépend que de la disposition et des dalles, déjà suivies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posee, d, disponibles]);

  // Suivi du pointeur pendant un glissé ou un redimensionnement, sur toute la fenêtre (posé dès le rendu, avant le
  // prochain mouvement).
  useLayoutEffect(() => {
    if (!glisse && !redim) return;
    const bouge = (e: globalThis.PointerEvent) => {
      if (redim) {
        const champs: Partial<Pick<DalleDisposee, 'largeur' | 'hauteur'>> = {};
        if (redim.sens !== 'hauteur') {
          const colonnes = (e.clientX - redim.gauche + redim.ecart) / redim.colonne;
          champs.largeur = largeurAimantee(Math.min(COLONNES_TABLEAU_DE_BORD, Math.max(1, colonnes)));
        }
        if (redim.sens !== 'largeur') {
          const lignes = (e.clientY + window.scrollY - redim.hautPage + redim.ecartLignes) / redim.ligne;
          champs.hauteur = hauteurAimantee(Math.max(1, lignes));
        }
        setD((cur) => {
          const x = cur.dalles.find((v) => cleDalle(v) === redim.id);
          if (!x) return cur;
          const memeLargeur = champs.largeur === undefined || champs.largeur === x.largeur;
          const memeHauteur = champs.hauteur === undefined || champs.hauteur === hauteurDalle(x);
          return memeLargeur && memeHauteur ? cur : modifierDalle(cur, redim.id, champs);
        });
        if (e.clientY < BANDE_DEFILEMENT && redim.sens !== 'largeur') window.scrollBy(0, -BANDE_DEFILEMENT / 4);
        else if (e.clientY > window.innerHeight - BANDE_DEFILEMENT && redim.sens !== 'largeur')
          window.scrollBy(0, BANDE_DEFILEMENT / 4);
        return;
      }
      if (!glisse) return;
      const demarre =
        glisse.demarre || Math.hypot(e.clientX - glisse.departX, e.clientY - glisse.departY) > SEUIL_GLISSE;
      if (!demarre) return;
      e.preventDefault();
      setGlisse((g) => (g ? { ...g, x: e.clientX, y: e.clientY, demarre: true } : g));
      if (e.clientY < BANDE_DEFILEMENT) window.scrollBy(0, -BANDE_DEFILEMENT / 4);
      else if (e.clientY > window.innerHeight - BANDE_DEFILEMENT) window.scrollBy(0, BANDE_DEFILEMENT / 4);
      placer(glisse.id, e.clientX, e.clientY);
    };
    const fin = () => {
      const id = redim?.id ?? (glisse?.demarre ? glisse.id : null);
      const quoi = redim?.sens ?? 'largeur';
      setGlisse(null);
      setRedim(null);
      if (!id) return;
      if (magnetique) setD((cur) => compacterDisposition(cur, disponibles, id));
      setPosee({ id, quoi });
    };
    window.addEventListener('pointermove', bouge);
    window.addEventListener('pointerup', fin);
    window.addEventListener('pointercancel', fin);
    return () => {
      window.removeEventListener('pointermove', bouge);
      window.removeEventListener('pointerup', fin);
      window.removeEventListener('pointercancel', fin);
    };
    // placer et titre ne dépendent que de l'état déjà listé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glisse, redim, magnetique, disponibles]);

  // La dalle glissée suit le pointeur : décalage entre sa place (l'ombre bleue) et la position du pointeur, recalculé après
  // chaque déplacement de la place dans la grille.
  useLayoutEffect(() => {
    if (!glisse?.demarre) return;
    const c = caseDe(glisse.id);
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--tdb-dx', `${glisse.x - glisse.decalX - r.left}px`);
    c.style.setProperty('--tdb-dy', `${glisse.y - glisse.decalY - r.top}px`);
  });

  /** Bord droit, bord bas ou coin d'une dalle : taille au glisser, aimantée sur les tailles proposées. */
  const surRedimBas = (id: string, sens: Redim['sens']) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !grille.current) return;
    const c = caseDe(id);
    if (!c) return;
    e.preventDefault();
    e.stopPropagation();
    const g = grille.current.getBoundingClientRect();
    const style = getComputedStyle(grille.current);
    const ecart = parseFloat(style.columnGap) || 0;
    const ecartLignes = parseFloat(style.rowGap) || 0;
    const r = c.getBoundingClientRect();
    // Hauteur minimale d'une ligne de la grille (« minmax(56px, auto) » une fois calculée).
    const ligneMin = parseFloat(/([\d.]+)px/.exec(style.gridAutoRows)?.[1] ?? '') || r.height / 4;
    setRedim({
      id,
      sens,
      gauche: r.left,
      hautPage: r.top + window.scrollY,
      colonne: (g.width + ecart) / COLONNES_TABLEAU_DE_BORD,
      ecart,
      ligne: ligneMin + ecartLignes,
      ecartLignes,
    });
  };
  const surRedimTouche = (id: string, largeur: LargeurDalle) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const pas = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!pas) return;
    e.preventDefault();
    const suivante = LARGEURS_DALLE[LARGEURS_DALLE.indexOf(largeur) + pas];
    if (!suivante) return;
    setD((cur) => modifierDalle(cur, id, { largeur: suivante }));
    setAnnonce(`« ${titre(id)} » : ${minuscule(LIBELLES_LARGEUR[suivante])}.`);
  };
  const surHauteurTouche = (id: string, hauteur: HauteurDisposee) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const pas = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!pas) return;
    e.preventDefault();
    const suivante = HAUTEURS_DALLE[HAUTEURS_DALLE.indexOf(hauteur) + pas];
    if (!suivante) return;
    setD((cur) => modifierDalle(cur, id, { hauteur: suivante }));
    setAnnonce(`« ${titre(id)} » : ${minuscule(LIBELLES_HAUTEUR[suivante])}.`);
  };

  function ajouter(id: IdDalle) {
    const r = ajouterDalle(d, id);
    if (!r.cle) {
      setAnnonce('Le tableau de bord est complet : retirez une dalle avant d’en ajouter une autre.');
      return;
    }
    const cle = r.cle;
    const suivante = magnetique ? compacterDisposition(r.disposition, disponibles) : r.disposition;
    setD(suivante);
    const apres = dallesAffichees(suivante, disponibles).map(cleDalle);
    const t = parId.get(id)?.titre ?? id;
    setAnnonce(`« ${t} » ajoutée : position ${apres.indexOf(cle) + 1} sur ${apres.length}.`);
  }

  return (
    <div className="tdb tdb--edition">
      <div className="tdb-edition-barre" role="region" aria-label="Modifier la disposition du tableau de bord">
        <Text size="sm" id={aide}>
          Glissez une dalle par sa poignée ou sa surface. Tirez son bord droit, son bord bas ou son coin pour la
          redimensionner. Au clavier, flèches sur la poignée (Origine et Fin : premier et dernier rang), sur le bord
          droit (largeur) et sur le bord bas (hauteur).
        </Text>
        <Group gap="xs" className="tdb-edition-outils">
          <Button variant="light" onClick={() => setCatalogue(true)}>
            + Ajouter une dalle
          </Button>
          <Switch
            label="Aimant : combler les places libres au lâcher"
            checked={magnetique}
            onChange={(e) => {
              const actif = e.currentTarget.checked;
              setMagnetique(actif);
              if (actif) setD((cur) => compacterDisposition(cur, disponibles));
            }}
          />
        </Group>
        <Group gap="xs">
          <Button
            disabled={(!modifiee && !autreQueLaSienne) || pending}
            loading={pending}
            onClick={() =>
              void agir(() =>
                api('PUT', URL_PERSO, { body: { disposition: d }, ifMatch: dispositions.personnelle?.version ?? 0 }),
              )
            }
          >
            Enregistrer
          </Button>
          <Button variant="default" disabled={pending} onClick={onFin}>
            Annuler
          </Button>
          {dispositions.personnelle && (
            <ConfirmButton
              variant="default"
              color="gray"
              message="Revenir à la disposition par défaut ? Votre disposition personnelle sera supprimée."
              onConfirm={() => void agir(() => del(URL_PERSO))}
            >
              Revenir à la disposition par défaut
            </ConfirmButton>
          )}
          {peutDefinirDefaut && (
            <ConfirmButton
              variant="light"
              color="blue"
              message="Proposer cette disposition à tous ? Elle s’affichera pour chaque personne qui n’a pas la sienne."
              onConfirm={() =>
                void agir(() =>
                  api('PUT', URL_DEFAUT, {
                    body: { disposition: d },
                    ifMatch: dispositions.organisation?.version ?? 0,
                  }),
                )
              }
            >
              Proposer cette disposition à tous
            </ConfirmButton>
          )}
          {peutDefinirDefaut && dispositions.organisation && (
            <ConfirmButton
              variant="default"
              color="gray"
              message="Rétablir la disposition standard pour tous ceux qui n’ont pas la leur ?"
              onConfirm={() => void agir(() => del(URL_DEFAUT))}
            >
              Rétablir la disposition standard pour tous
            </ConfirmButton>
          )}
        </Group>
        <ErrorAlert error={error} />
        {vues.length === 0 && (
          <Alert color="yellow" role="status">
            Aucune dalle n’est affichée : ajoutez-en au moins une pour garder un tableau de bord utile.
          </Alert>
        )}
        <VisuallyHidden aria-live="polite">{annonce}</VisuallyHidden>
      </div>
      <Catalogue
        ouvert={catalogue}
        onFermer={() => setCatalogue(false)}
        dalles={dalles}
        disposition={d}
        onAjouter={ajouter}
      />
      <div ref={grille} className="grille-cartes tdb-grille" data-glisse={glissee || redim ? 'oui' : undefined}>
        {vues.map((x) => {
          const cle = cleDalle(x);
          const dalle = parId.get(x.id)!;
          const nom = titre(cle);
          const hauteur = hauteurDalle(x);
          return (
            <div
              key={cle}
              data-dalle={x.id}
              data-cle={cle}
              className={`tdb-l${x.largeur} tdb-h${hauteur} tdb-case${glissee === cle ? ' tdb-case--glissee' : ''}${redim?.id === cle ? ' tdb-case--redim' : ''}`}
              onPointerDown={surPointeurBas(cle)}
            >
              <div className="tdb-case-corps">
                <div className="tdb-case-outils">
                  <button
                    type="button"
                    className="tdb-poignee"
                    aria-label={`Déplacer « ${nom} »`}
                    aria-describedby={aide}
                    onKeyDown={surTouche(cle)}
                  >
                    <IconePoignee />
                  </button>
                  <NativeSelect
                    className="tdb-case-largeur"
                    size="xs"
                    aria-label={`Largeur de « ${nom} »`}
                    value={String(x.largeur)}
                    data={LARGEURS_DALLE.map((l) => ({ value: String(l), label: LIBELLES_LARGEUR[l] }))}
                    onChange={(e) => {
                      const largeur = Number(e.currentTarget.value) as LargeurDalle;
                      setD((cur) => modifierDalle(cur, cle, { largeur }));
                    }}
                  />
                  <NativeSelect
                    className="tdb-case-largeur"
                    size="xs"
                    aria-label={`Hauteur de « ${nom} »`}
                    value={String(hauteur)}
                    data={HAUTEURS_DALLE.map((h) => ({ value: String(h), label: LIBELLES_HAUTEUR[h] }))}
                    onChange={(e) => {
                      const h = Number(e.currentTarget.value) as HauteurDisposee;
                      setD((cur) => modifierDalle(cur, cle, { hauteur: h }));
                    }}
                  />
                  {REGLAGES_DALLE[x.id] && (
                    <Button
                      size="compact-sm"
                      variant={reglee === cle ? 'light' : 'subtle'}
                      aria-label={`Réglages de « ${nom} »`}
                      aria-expanded={reglee === cle}
                      aria-controls={`${aide}-reglages-${cle}`}
                      onClick={() => setReglee((cur) => (cur === cle ? null : cle))}
                    >
                      Réglages
                    </Button>
                  )}
                  <button
                    type="button"
                    className="tdb-retirer"
                    aria-label={`${x.cle ? 'Retirer' : 'Masquer'} « ${nom} »`}
                    title={x.cle ? 'Retirer cette copie' : 'Masquer (elle reste au catalogue)'}
                    onClick={() => {
                      setD((cur) => retirerDalle(cur, cle));
                      setAnnonce(x.cle ? `« ${nom} » est retirée.` : `« ${nom} » est masquée.`);
                    }}
                  >
                    <IconeRetirer />
                  </button>
                </div>
                {reglee === cle && (
                  <PanneauReglages
                    id={x.id}
                    idPanneau={`${aide}-reglages-${cle}`}
                    titre={nom}
                    reglages={x.reglages}
                    onChange={(reglages) => setD((cur) => modifierDalle(cur, cle, { reglages }))}
                  />
                )}
                {dalle.rendu({ largeur: x.largeur, reglages: x.reglages })}
              </div>
              {redim?.id === cle && (
                <span className="tdb-redim-etiquette" aria-hidden="true">
                  {LIBELLES_LARGEUR[x.largeur]} · {minuscule(LIBELLES_HAUTEUR[hauteur])}
                </span>
              )}
              <button
                type="button"
                className="tdb-redim"
                aria-label={`Redimensionner « ${nom} » (${minuscule(LIBELLES_LARGEUR[x.largeur])}) : glisser, ou flèches gauche et droite`}
                onPointerDown={surRedimBas(cle, 'largeur')}
                onKeyDown={surRedimTouche(cle, x.largeur)}
              />
              <button
                type="button"
                className="tdb-redim-bas"
                aria-label={`Redimensionner en hauteur « ${nom} » (${minuscule(LIBELLES_HAUTEUR[hauteur])}) : glisser, ou flèches haut et bas`}
                onPointerDown={surRedimBas(cle, 'hauteur')}
                onKeyDown={surHauteurTouche(cle, hauteur)}
              />
              <span className="tdb-redim-coin" aria-hidden="true" onPointerDown={surRedimBas(cle, 'coin')} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

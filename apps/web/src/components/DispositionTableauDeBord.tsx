/* Mode « Modifier la disposition » du tableau de bord de l'accueil (ADR 0078, lot 2a) : déplacer les dalles au glisser
   (poignée ou surface de la dalle à la souris, poignée au doigt) ou au clavier (flèches, Origine, Fin sur la poignée),
   changer leur largeur (bord à tirer, aimanté sur les largeurs proposées, ou liste), les masquer et les réafficher, régler
   leurs seuils, leur cible et leur visualisation (lot 2c). Pendant le glissé, la dalle suit le pointeur et une ombre bleue
   translucide marque sa place d'arrivée ; les autres se poussent en direct. Placement magnétique (activé par défaut) : au
   lâcher, les fins de rangée libres sont comblées par les dalles suivantes qui y tiennent. Enregistre la disposition
   personnelle (droit tableau_de_bord:modifier, lot 2b) ; un administrateur peut aussi la proposer à tous. Aucune donnée
   n'est enregistrée : seulement l'ordre, les largeurs et les dalles masquées. Le déplacement visuel passe par des
   variables CSS posées par le CSSOM (permis par l'ADR 0006), jamais par un attribut style. */
import { Alert, Button, Group, NativeSelect, NumberInput, Switch, Text, VisuallyHidden } from '@mantine/core';
import {
  compacterDisposition,
  COLONNES_TABLEAU_DE_BORD,
  completerDisposition,
  dallesAffichees,
  deplacerDalle,
  deplacerDalleAuClavier,
  largeurAimantee,
  LARGEURS_DALLE,
  LIBELLES_LARGEUR,
  LIBELLES_VISUALISATION,
  memesDispositions,
  modifierDalle,
  REGLAGES_DALLE,
  SEUILS_JOURS_STANDARD,
  SEUILS_STANDARD,
  visualisationDalle,
  type Disposition,
  type DispositionsOut,
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
import { dallesTableauDeBord } from './TableauDeBord';

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
const HORS_GLISSE = 'button:not(.tdb-poignee), select, input, textarea, a, label, .tdb-reglages, .tdb-redim';

/** Glissé en cours : dalle, point de saisie dans la dalle, dernière position du pointeur, seuil franchi ou non. */
interface Glisse {
  id: IdDalle;
  decalX: number;
  decalY: number;
  departX: number;
  departY: number;
  x: number;
  y: number;
  demarre: boolean;
}
/** Redimensionnement en cours : bord gauche de la dalle et largeur d'une colonne (écart compris), en pixels. */
interface Redim {
  id: IdDalle;
  gauche: number;
  colonne: number;
  ecart: number;
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
  const dalles = useMemo(() => dallesTableauDeBord(s), [s]);
  const parId = useMemo(() => new Map(dalles.map((x) => [x.id, x])), [dalles]);
  const disponibles = useMemo(() => new Set<IdDalle>(parId.keys()), [parId]);
  // Départ : la disposition affichée (la sienne, celle de l'organisation, un tableau reçu ou la standard), complète.
  const depart = useMemo(
    () =>
      completerDisposition(
        base,
        Object.fromEntries(dalles.map((x) => [x.id, x.largeur])) as Partial<Record<IdDalle, LargeurDalle>>,
      ),
    [base, dalles],
  );
  // Partir d'un autre tableau que le sien : l'enregistrer en fait sa disposition, même sans changement.
  const autreQueLaSienne = base !== (dispositions.personnelle?.disposition ?? null);
  const [d, setD] = useState<Disposition>(depart);
  const [glisse, setGlisse] = useState<Glisse | null>(null);
  const [redim, setRedim] = useState<Redim | null>(null);
  const [magnetique, setMagnetique] = useState(true);
  const grille = useRef<HTMLDivElement>(null);
  const glissee = glisse?.demarre ? glisse.id : null;
  // Dalle posée au dernier lâcher : son rang et sa largeur sont annoncés une fois la disposition rendue.
  const [posee, setPosee] = useState<IdDalle | null>(null);
  const [reglee, setReglee] = useState<IdDalle | null>(null);
  const [annonce, setAnnonce] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const vues = dallesAffichees(d, disponibles);
  const masquees = d.dalles.filter((x) => x.masquee && disponibles.has(x.id));
  const titre = (id: IdDalle) => parId.get(id)?.titre ?? id;
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

  const surTouche = (id: IdDalle) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const sens = SENS_TOUCHES[e.key];
    if (!sens) return;
    e.preventDefault();
    const r = deplacerDalleAuClavier(d, id, sens, disponibles);
    setD(r.disposition);
    setAnnonce(`« ${titre(id)} » : position ${r.rang} sur ${r.total}.`);
  };

  const caseDe = (id: IdDalle) => grille.current?.querySelector<HTMLElement>(`[data-dalle="${id}"]`) ?? null;

  /** Saisie d'une dalle : par la poignée (souris ou doigt, glissé immédiat) ou par sa surface (souris ou stylet, glissé
      au-delà de quelques pixels, pour laisser les clics). */
  const surPointeurBas = (id: IdDalle) => (e: PointerEvent<HTMLElement>) => {
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
  const placer = (id: IdDalle, x: number, y: number) => {
    const cases = [...(grille.current?.querySelectorAll<HTMLElement>('[data-dalle]') ?? [])].filter(
      (c) => c.dataset.dalle !== id,
    );
    const sous = cases.find((c) => {
      const r = c.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    const bas = Math.max(...cases.map((c) => c.getBoundingClientRect().bottom));
    setD((cur) => {
      const ids = dallesAffichees(cur, disponibles).map((v) => v.id);
      if (sous) {
        const cible = sous.dataset.dalle as IdDalle;
        return disponibles.has(cible) ? deplacerDalle(cur, id, cible, ids.indexOf(cible) > ids.indexOf(id)) : cur;
      }
      const derniere = ids[ids.length - 1];
      return cases.length && y > bas && derniere && derniere !== id ? deplacerDalle(cur, id, derniere, true) : cur;
    });
  };

  useEffect(() => {
    if (!posee) return;
    const vuesApres = dallesAffichees(d, disponibles);
    const r = vuesApres.find((v) => v.id === posee);
    setAnnonce(
      `« ${titre(posee)} » : position ${vuesApres.findIndex((v) => v.id === posee) + 1} sur ${vuesApres.length}` +
        (r ? `, ${LIBELLES_LARGEUR[r.largeur].toLowerCase()}.` : '.'),
    );
    setPosee(null);
    // titre ne dépend que de parId, stable pendant l'édition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posee, d, disponibles]);

  // Suivi du pointeur pendant un glissé ou un redimensionnement, sur toute la fenêtre (posé dès le rendu, avant le
  // prochain mouvement).
  useLayoutEffect(() => {
    if (!glisse && !redim) return;
    const bouge = (e: globalThis.PointerEvent) => {
      if (redim) {
        const colonnes = (e.clientX - redim.gauche + redim.ecart) / redim.colonne;
        const largeur = largeurAimantee(Math.min(COLONNES_TABLEAU_DE_BORD, Math.max(1, colonnes)));
        setD((cur) =>
          cur.dalles.find((v) => v.id === redim.id)?.largeur === largeur
            ? cur
            : modifierDalle(cur, redim.id, { largeur }),
        );
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
      setGlisse(null);
      setRedim(null);
      if (!id) return;
      if (magnetique) setD((cur) => compacterDisposition(cur, disponibles, id));
      setPosee(id);
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

  /** Bord droit d'une dalle : largeur au glisser (aimantée), ou flèches gauche et droite au clavier. */
  const surRedimBas = (id: IdDalle) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !grille.current) return;
    const c = caseDe(id);
    if (!c) return;
    e.preventDefault();
    e.stopPropagation();
    const g = grille.current.getBoundingClientRect();
    const ecart = parseFloat(getComputedStyle(grille.current).columnGap) || 0;
    setRedim({
      id,
      gauche: c.getBoundingClientRect().left,
      colonne: (g.width + ecart) / COLONNES_TABLEAU_DE_BORD,
      ecart,
    });
  };
  const surRedimTouche = (id: IdDalle, largeur: LargeurDalle) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const pas = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!pas) return;
    e.preventDefault();
    const suivante = LARGEURS_DALLE[LARGEURS_DALLE.indexOf(largeur) + pas];
    if (!suivante) return;
    setD((cur) => modifierDalle(cur, id, { largeur: suivante }));
    setAnnonce(`« ${titre(id)} » : ${LIBELLES_LARGEUR[suivante].toLowerCase()}.`);
  };

  return (
    <div className="tdb tdb--edition">
      <div className="tdb-edition-barre" role="region" aria-label="Modifier la disposition du tableau de bord">
        <Text size="sm" id={aide}>
          Glissez une dalle par sa surface ou par sa poignée : une ombre bleue montre sa place d’arrivée. Tirez son bord
          droit pour changer sa largeur. Au clavier, flèches sur la poignée (Origine et Fin : premier et dernier rang)
          et sur le bord droit (largeur). Les dalles sans données lisibles avec vos droits n’apparaissent pas.
        </Text>
        <Switch
          label="Placement magnétique : combler les fins de rangée au lâcher d’une dalle"
          checked={magnetique}
          onChange={(e) => {
            const actif = e.currentTarget.checked;
            setMagnetique(actif);
            if (actif) setD((cur) => compacterDisposition(cur, disponibles));
          }}
        />
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
        {masquees.length > 0 && (
          <div className="tdb-masquees" role="group" aria-label="Dalles masquées">
            <Text size="sm" fw={600}>
              Dalles masquées :
            </Text>
            {masquees.map((x) => (
              <Button
                key={x.id}
                size="compact-sm"
                variant="light"
                onClick={() => {
                  setD((cur) => modifierDalle(cur, x.id, { masquee: false }));
                  setAnnonce(`« ${titre(x.id)} » est de nouveau affichée.`);
                }}
              >
                Afficher « {titre(x.id)} »
              </Button>
            ))}
          </div>
        )}
        {vues.length === 0 && (
          <Alert color="yellow" role="status">
            Toutes les dalles sont masquées : réaffichez-en au moins une pour garder un tableau de bord utile.
          </Alert>
        )}
        <VisuallyHidden aria-live="polite">{annonce}</VisuallyHidden>
      </div>
      <div ref={grille} className="grille-cartes tdb-grille" data-glisse={glissee || redim ? 'oui' : undefined}>
        {vues.map((x) => {
          const dalle = parId.get(x.id)!;
          return (
            <div
              key={x.id}
              data-dalle={x.id}
              className={`tdb-l${x.largeur} tdb-case${glissee === x.id ? ' tdb-case--glissee' : ''}${redim?.id === x.id ? ' tdb-case--redim' : ''}`}
              onPointerDown={surPointeurBas(x.id)}
            >
              <div className="tdb-case-corps">
                <div className="tdb-case-outils">
                  <button
                    type="button"
                    className="tdb-poignee"
                    aria-label={`Déplacer « ${dalle.titre} »`}
                    aria-describedby={aide}
                    onKeyDown={surTouche(x.id)}
                  >
                    <IconePoignee />
                  </button>
                  <NativeSelect
                    className="tdb-case-largeur"
                    size="xs"
                    aria-label={`Largeur de « ${dalle.titre} »`}
                    value={String(x.largeur)}
                    data={LARGEURS_DALLE.map((l) => ({ value: String(l), label: LIBELLES_LARGEUR[l] }))}
                    onChange={(e) => {
                      const largeur = Number(e.currentTarget.value) as LargeurDalle;
                      setD((cur) => modifierDalle(cur, x.id, { largeur }));
                    }}
                  />
                  {REGLAGES_DALLE[x.id] && (
                    <Button
                      size="compact-sm"
                      variant={reglee === x.id ? 'light' : 'subtle'}
                      aria-label={`Réglages de « ${dalle.titre} »`}
                      aria-expanded={reglee === x.id}
                      aria-controls={`${aide}-reglages-${x.id}`}
                      onClick={() => setReglee((cur) => (cur === x.id ? null : x.id))}
                    >
                      Réglages
                    </Button>
                  )}
                  <Button
                    size="compact-sm"
                    variant="subtle"
                    aria-label={`Masquer « ${dalle.titre} »`}
                    onClick={() => {
                      setD((cur) => modifierDalle(cur, x.id, { masquee: true }));
                      setAnnonce(`« ${dalle.titre} » est masquée.`);
                    }}
                  >
                    Masquer
                  </Button>
                </div>
                {reglee === x.id && (
                  <PanneauReglages
                    id={x.id}
                    idPanneau={`${aide}-reglages-${x.id}`}
                    titre={dalle.titre}
                    reglages={x.reglages}
                    onChange={(reglages) => setD((cur) => modifierDalle(cur, x.id, { reglages }))}
                  />
                )}
                {dalle.rendu(x.largeur, x.reglages)}
              </div>
              <button
                type="button"
                className="tdb-redim"
                aria-label={`Redimensionner « ${dalle.titre} » (${LIBELLES_LARGEUR[x.largeur].toLowerCase()}) : glisser, ou flèches gauche et droite`}
                onPointerDown={surRedimBas(x.id)}
                onKeyDown={surRedimTouche(x.id, x.largeur)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

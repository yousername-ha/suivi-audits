/* Recherche et filtres des listes (refonte Verre, règle validée par le RSSI le 27/11/2026, pour toute la plateforme). Elle
   remplace la boîte d'outils de la refonte Neon (loupe ronde, entonnoir des filtres avancés, entonnoirs sur le titre des
   colonnes) :
   - en-tête de la liste : titre et compteur à gauche, champ de recherche en gélule à droite (loupe, texte saisi, « N sur
     M » quand un critère est actif, bouton « Effacer la recherche »), raccourci « / » ;
   - dessous, les filtres en puces tirées des valeurs présentes, avec leur nombre ; puces d'un même critère exclusives,
     critères combinés ; « Tout effacer » dès qu'un critère est actif ;
   - un critère qui ne se prête pas aux puces (date, texte libre, plus de huit valeurs) va dans « Plus de filtres », petit
     panneau qui garde les champs existants (leurs noms, contraintes et formulaires) ;
   - moins de 8 éléments : ni recherche ni puces, sauf critère déjà actif (adresse), pour pouvoir l'effacer.
   Aucun filtre réel n'est retiré. Ctrl K (recherche du menu) ne change pas. Aspect « Verre » dans packages/ui/src/verre.css,
   présentation sobre des autres styles dans packages/ui/src/styles.css. */
import {
  ActionIcon,
  Anchor,
  Button,
  Checkbox,
  Divider,
  Group,
  Popover,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useMergedRef } from '@mantine/hooks';
import {
  Children,
  cloneElement,
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import type { TextInputProps } from '@mantine/core';
import { pucesUtiles, rechercheVisible, segmentsSurlignes, SEUIL_PUCES, type OptionPuce } from './recherche-liste';

/** Loupe du champ de recherche (décorative : le champ garde son libellé). */
export function IconeLoupe() {
  return (
    <svg
      className="barre-loupe"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

/** Flèche du bouton qui lance une recherche ou un filtrage (7.6.1) : distincte de la loupe du champ (décorative : le
    bouton garde son texte, masqué à l'écran). */
export function IconeLancer() {
  return (
    <svg
      className="barre-lancer"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h13" />
      <path d="m13 6.5 5.5 5.5-5.5 5.5" />
    </svg>
  );
}

/** Petite croix des puces actives et du bouton « Effacer la recherche » (décorative). */
function IconeCroix() {
  return (
    <svg className="liste-croix" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Curseurs de « Plus de filtres » (décoratifs). */
function IconeReglages() {
  return (
    <svg
      className="liste-plus__icone"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

/** Le raccourci « / » ne s'applique qu'en dehors d'une saisie, sans touche de modification ni fenêtre ouverte. */
export function doitOuvrirRecherche(
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'defaultPrevented'>,
  cible: { tagName?: string; isContentEditable?: boolean } | null,
  fenetreOuverte: boolean,
): boolean {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || fenetreOuverte) return false;
  const balise = cible?.tagName?.toUpperCase();
  return !(balise === 'INPUT' || balise === 'TEXTAREA' || balise === 'SELECT' || cible?.isContentEditable);
}

/** « / » place le curseur dans le champ de recherche de la liste affichée. */
export function useRaccourciRecherche(champ: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      const element = champ.current;
      if (!element || !element.getClientRects().length) return;
      const fenetreOuverte = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].some(
        (dialogue) => dialogue.getClientRects().length > 0,
      );
      if (!doitOuvrirRecherche(e, e.target as HTMLElement | null, fenetreOuverte)) return;
      e.preventDefault();
      element.focus();
      element.select();
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [champ]);
}

/** Vide un champ existant (contrôlé ou non) comme le ferait une saisie : la page reçoit son événement habituel. */
function viderChamp(input: HTMLInputElement | null) {
  if (!input) return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
}

/** Critère actif d'un filtre qui n'est pas en puces (champ de « Plus de filtres ») : montré en puce active, retirable. */
export interface CritereActif {
  cle: string;
  libelle: string;
  valeur: string;
  retirer: () => void;
}

/** Critère présenté en puces : ses valeurs, comptées sur la liste ; une seule valeur retenue à la fois. */
export interface CriterePuces {
  cle: string;
  libelle: string;
  /** Valeur retenue, ou null. */
  valeur: string | null;
  options: OptionPuce[];
  onChange: (v: string | null) => void;
}

/** Texte dont les correspondances de la recherche sont surlignées (élément mark), casse et accents ignorés. */
export function Surligne({ texte, recherche }: { texte: string; recherche: string }) {
  const segments = segmentsSurlignes(texte, recherche);
  if (!segments.some((s) => s.trouve)) return <>{texte}</>;
  return (
    <>
      {segments.map((s, i) =>
        s.trouve ? (
          <mark key={i} className="surligne">
            {s.texte}
          </mark>
        ) : (
          <Fragment key={i}>{s.texte}</Fragment>
        ),
      )}
    </>
  );
}

/** Puce de filtre : bouton à bascule, avec le nombre d'éléments ; active, elle porte une petite croix. */
export function Puce({
  label,
  compte,
  actif,
  ton,
  onClick,
  titre,
  sansCroix = false,
}: {
  label: ReactNode;
  compte?: number;
  actif: boolean;
  ton?: string;
  onClick: () => void;
  titre?: string;
  /** Puce « Toutes » : enfoncée sans critère, elle n'a rien à retirer, donc pas de croix. */
  sansCroix?: boolean;
}) {
  return (
    <button type="button" className="liste-puce" aria-pressed={actif} data-ton={ton} title={titre} onClick={onClick}>
      <span className="liste-puce__texte">{label}</span>
      {compte !== undefined && <span className="liste-puce__nombre">{compte}</span>}
      {actif && !sansCroix && <IconeCroix />}
    </button>
  );
}

/** « Plus de filtres » : gélule qui ouvre un petit panneau avec les champs qui ne se prêtent pas aux puces. Le panneau
    reste dans le DOM (et dans son formulaire) quand il est fermé : valeurs, contraintes et propriétaires des champs sont
    conservés. */
export function PlusDeFiltres({
  actifs,
  onReinitialiser,
  children,
}: {
  actifs: number;
  onReinitialiser?: () => void;
  children: ReactNode;
}) {
  const nom = actifs ? `Plus de filtres (${actifs} actif${actifs > 1 ? 's' : ''})` : 'Plus de filtres';
  return (
    <Popover
      position="bottom-start"
      shadow="md"
      trapFocus
      returnFocus
      withinPortal={false}
      keepMounted
      keepMountedMode="display-none"
      // Fermeture immédiate : pendant un fondu de sortie, le panneau conservé dans la barre perd sa position et
      // recouvre un instant les boutons voisins (recette du 22/11/2026, journal d'audit).
      transitionProps={{ duration: 0 }}
    >
      <Popover.Target>
        <button type="button" className="liste-plus" aria-label={nom} data-actif={actifs > 0 || undefined}>
          <IconeReglages />
          <span>Plus de filtres</span>
          {actifs > 0 && <span className="liste-puce__nombre">{actifs}</span>}
        </button>
      </Popover.Target>
      <Popover.Dropdown className="filtres-avances liste-plus__panneau" aria-label="Plus de filtres">
        <Stack gap="sm">
          {children}
          {onReinitialiser && (
            <Group justify="flex-end">
              <Button size="xs" variant="subtle" disabled={!actifs} onClick={onReinitialiser}>
                Réinitialiser
              </Button>
            </Group>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr');

/** Valeurs d'un filtre à choix multiple dont le libellé contient le texte cherché, sans tenir compte de la casse ni des
    accents ; un texte vide les garde toutes. */
export function filtrerOptions<T extends { label: string }>(options: readonly T[], texte: string): T[] {
  const cherche = sansAccents(texte.trim());
  return cherche ? options.filter((o) => sansAccents(o.label).includes(cherche)) : [...options];
}

/** Au-delà de ce nombre de valeurs, un filtre à choix multiple propose un champ de recherche. */
export const SEUIL_RECHERCHE_FILTRE = 8;

type OptionFiltre = { value: string; label: string };

/** Options d'un filtre à choix multiple, complétées des valeurs retenues qui n'y figurent pas (liste pas encore
    chargée, valeur ajoutée depuis une ligne) : elles restent visibles, pour pouvoir les décocher. */
export function optionsAvecValeurs(options: readonly OptionFiltre[], valeurs: readonly string[]): OptionFiltre[] {
  return [
    ...options,
    ...valeurs.filter((v) => !options.some((o) => o.value === v)).map((v) => ({ value: v, label: v })),
  ];
}

/** Liste d'un filtre à choix multiple (dans « Plus de filtres ») : champ de recherche au-delà de huit valeurs, « Tous »
    qui vide le filtre, puis une case à cocher par valeur. Le texte cherché disparaît avec la liste, à sa fermeture. */
export function ListeFiltreMultiple({
  libelle,
  valeurs,
  options,
  onChange,
  description,
  onTous,
}: {
  libelle: string;
  valeurs: string[];
  options: OptionFiltre[];
  onChange: (v: string[]) => void;
  description?: string;
  /** Appelé après « Tous » (par exemple, pour refermer la liste). */
  onTous?: () => void;
}) {
  const [texte, setTexte] = useState('');
  const idDescription = useId();
  const visibles = filtrerOptions(options, texte);
  const basculer = (v: string) => onChange(valeurs.includes(v) ? valeurs.filter((x) => x !== v) : [...valeurs, v]);
  return (
    <Stack gap="xs">
      {options.length > SEUIL_RECHERCHE_FILTRE && (
        <TextInput
          size="xs"
          aria-label={`Chercher dans « ${libelle} »`}
          placeholder="Chercher…"
          leftSection={<IconeLoupe />}
          value={texte}
          onChange={(e) => setTexte(e.currentTarget.value)}
        />
      )}
      <Button
        size="compact-sm"
        variant="subtle"
        justify="flex-start"
        fullWidth
        disabled={!valeurs.length}
        onClick={() => {
          onChange([]);
          onTous?.();
        }}
      >
        Tous
      </Button>
      <Divider />
      {description && (
        <Text id={idDescription} size="xs" c="dimmed">
          {description}
        </Text>
      )}
      <div
        role="group"
        aria-label={libelle}
        aria-describedby={description ? idDescription : undefined}
        className="filtre-colonne-multiple__liste"
      >
        {visibles.map((o) => (
          <Checkbox
            key={o.value}
            size="sm"
            label={o.label}
            checked={valeurs.includes(o.value)}
            onChange={() => basculer(o.value)}
          />
        ))}
        {!visibles.length && (
          <Text size="xs" c="dimmed">
            Aucune valeur.
          </Text>
        )}
      </div>
    </Stack>
  );
}

export interface VueBoite {
  value: string;
  label: string;
  icone: ReactNode;
  disabled?: boolean;
}

const TOUS = '__tous__';

/** « Tout effacer » par défaut : vide la recherche (ou le champ repris d'un formulaire, par `viderChamp`), retire les
    puces actives et les critères de « Plus de filtres ». */
export function toutEffacer(
  {
    recherche,
    puces = [],
    criteres = [],
    filtres,
  }: {
    recherche?: { onChange: (v: string) => void };
    puces?: readonly Pick<CriterePuces, 'valeur' | 'onChange'>[];
    criteres?: readonly Pick<CritereActif, 'retirer'>[];
    filtres?: { onReinitialiser?: () => void };
  },
  viderChamp?: () => void,
) {
  if (recherche) recherche.onChange('');
  else viderChamp?.();
  for (const p of puces) if (p.valeur !== null) p.onChange(null);
  for (const c of criteres) c.retirer();
  filtres?.onReinitialiser?.();
}

/** Rangées de recherche et de filtres d'une liste (refonte Verre, 27/11/2026). Les vues (pictogrammes), les outils
    supplémentaires et l'ajout restent toujours visibles ; la recherche, les puces et « Plus de filtres » suivent le
    seuil de 8 éléments quand `total` est connu. */
export function BoiteOutils({
  label,
  vues,
  nomVues = 'Vues',
  vue,
  onVue,
  recherche,
  champRecherche,
  filtres,
  ajout,
  children,
  titre,
  total,
  affiches,
  puces = [],
  criteres = [],
  onToutEffacer,
  libelleTout = 'Toutes',
}: {
  /** Nom du groupe d'outils, lu par les lecteurs d'écran. */
  label: string;
  vues?: readonly VueBoite[];
  nomVues?: string;
  vue?: string;
  onVue?: (v: string) => void;
  /** Recherche ; son libellé est de la forme « Rechercher dans … ». */
  recherche?: { label: string; value: string; onChange: (v: string) => void; placeholder?: string };
  /** Champ existant d'un formulaire : mêmes événements, nom, contraintes et soumission. */
  champRecherche?: ReactElement<TextInputProps & { ref?: Ref<HTMLInputElement> }>;
  /** Champs de « Plus de filtres » (dates, texte libre, longues listes). */
  filtres?: { actifs: number; onReinitialiser?: () => void; contenu: ReactNode };
  ajout?: ReactNode;
  /** Outils supplémentaires, placés après la recherche. */
  children?: ReactNode;
  /** Titre et compteur de la liste, à gauche de la recherche. */
  titre?: ReactNode;
  /** Nombre total d'éléments de la liste, avant filtrage : seuil d'apparition et « N sur M ». Inconnu : toujours affiché. */
  total?: number;
  /** Nombre d'éléments affichés après recherche et filtres (« N sur M »). */
  affiches?: number;
  /** Critères en puces. Au-delà de huit valeurs utiles, un critère passe dans « Plus de filtres ». */
  puces?: readonly CriterePuces[];
  /** Critères actifs des champs de « Plus de filtres », montrés en puces actives retirables. */
  criteres?: readonly CritereActif[];
  /** « Tout effacer » ; par défaut, vide la recherche, les puces, les critères et « Plus de filtres ». */
  onToutEffacer?: () => void;
  /** Puce qui retire tous les critères en puces (« Toutes », « Tous »). */
  libelleTout?: string;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const reference = useMergedRef(champ, champRecherche?.props.ref);
  useRaccourciRecherche(champ);
  const texteRecherche = recherche ? recherche.value : String(champRecherche?.props.value ?? '');
  const base = total ?? Number.POSITIVE_INFINITY;
  // Une valeur retenue absente de la liste (adresse ancienne, liste pas encore chargée) reste montrée, pour être retirée.
  const criteresPuces = puces.map((p) => ({
    ...p,
    utiles: pucesUtiles(
      p.valeur !== null && !p.options.some((o) => o.value === p.valeur)
        ? [...p.options, { value: p.valeur, label: p.valeur, compte: 0 }]
        : p.options,
      base,
      p.valeur,
    ),
  }));
  const enPuces = criteresPuces.filter((p) => p.utiles.length > 0 && p.utiles.length <= SEUIL_PUCES);
  const enListe = criteresPuces.filter((p) => p.utiles.length > SEUIL_PUCES);
  const actifsListe = enListe.filter((p) => p.valeur !== null);
  // Puces actives des critères qui ne sont pas en puces : ceux de « Plus de filtres » fournis par la page, et les critères
  // en puces passés en liste faute de place.
  const actifsHorsPuces: CritereActif[] = [
    ...actifsListe.map((p) => ({
      cle: p.cle,
      libelle: p.libelle,
      valeur: p.utiles.find((o) => o.value === p.valeur)?.label ?? String(p.valeur),
      retirer: () => p.onChange(null),
    })),
    ...criteres,
  ];
  const nbFiltres = puces.filter((p) => p.valeur !== null).length + criteres.length + (filtres?.actifs ?? 0);
  const actif = !!texteRecherche.trim() || nbFiltres > 0;
  const visible = rechercheVisible(total, actif);
  const plusActifs = actifsListe.length + (filtres?.actifs ?? 0);
  const plus = enListe.length > 0 || !!filtres;
  const effacerTout =
    onToutEffacer ??
    (() =>
      toutEffacer({ recherche, puces, criteres, filtres }, () => {
        if (champRecherche && texteRecherche) viderChamp(champ.current);
      }));
  const effacerRecherche = () => {
    if (recherche) {
      recherche.onChange('');
      champ.current?.focus();
    } else viderChamp(champ.current);
  };
  const champVisible = visible && (recherche || champRecherche);
  // Rangée du haut seulement si elle a un contenu (une barre réduite à « Plus de filtres » n'a pas de ligne vide).
  const ligne = !!vues?.length || !!titre || !!champVisible || Children.toArray(children).length > 0 || !!ajout;
  return (
    <div className="liste-outils" role="toolbar" aria-label={label}>
      {ligne && (
        <div className="liste-outils__ligne">
          {vues && vues.length > 0 && (
            <div className="liste-outils__vues" role="group" aria-label={nomVues}>
              {vues.map((v) => (
                <Tooltip
                  key={v.value}
                  label={v.label}
                  withArrow
                  openDelay={250}
                  events={{ hover: true, focus: true, touch: false }}
                >
                  <ActionIcon
                    size="lg"
                    variant={vue === v.value ? 'filled' : 'subtle'}
                    aria-label={v.label}
                    aria-pressed={vue === v.value}
                    disabled={v.disabled}
                    onClick={() => onVue?.(v.value)}
                  >
                    {v.icone}
                  </ActionIcon>
                </Tooltip>
              ))}
            </div>
          )}
          <div className="liste-outils__titre">{titre}</div>
          {champVisible && (
            <div className="liste-recherche" data-rempli={texteRecherche ? 'true' : undefined}>
              {!champRecherche?.props.leftSection && <IconeLoupe />}
              {recherche ? (
                <TextInput
                  ref={champ}
                  variant="unstyled"
                  className="liste-recherche__saisie"
                  aria-label={recherche.label}
                  placeholder={recherche.placeholder ?? 'Rechercher…'}
                  title="Raccourci : touche /"
                  value={recherche.value}
                  onChange={(e) => recherche.onChange(e.currentTarget.value)}
                />
              ) : (
                champRecherche &&
                cloneElement(champRecherche, {
                  ref: reference,
                  variant: 'unstyled',
                  className: [champRecherche.props.className, 'liste-recherche__saisie'].filter(Boolean).join(' '),
                  title:
                    champRecherche.props.title ??
                    (typeof champRecherche.props.description === 'string'
                      ? champRecherche.props.description
                      : 'Raccourci : touche /'),
                  placeholder:
                    champRecherche.props.placeholder ??
                    (typeof champRecherche.props.label === 'string' ? `${champRecherche.props.label}…` : 'Rechercher…'),
                })
              )}
              {actif && affiches !== undefined && total !== undefined && (
                <span className="liste-recherche__compte" aria-live="polite">
                  {affiches} sur {total}
                </span>
              )}
              {!!texteRecherche && (
                <button
                  type="button"
                  className="liste-recherche__effacer"
                  aria-label="Effacer la recherche"
                  onClick={effacerRecherche}
                >
                  <IconeCroix />
                </button>
              )}
            </div>
          )}
          {children}
          {ajout && <div className="barre-outils__ajout">{ajout}</div>}
        </div>
      )}
      {visible && (enPuces.length > 0 || actifsHorsPuces.length > 0 || plus) && (
        <div className="liste-puces" role="group" aria-label="Filtres">
          {enPuces.length > 0 && (
            <Puce
              label={libelleTout}
              compte={total}
              sansCroix
              actif={!enPuces.some((p) => p.valeur !== null)}
              onClick={() => {
                for (const p of enPuces) if (p.valeur !== null) p.onChange(null);
              }}
            />
          )}
          {enPuces.map((p, i) => (
            <Fragment key={p.cle}>
              {i > 0 && <span className="liste-puces__sep" aria-hidden="true" />}
              <div className="liste-puces__groupe" role="group" aria-label={p.libelle}>
                {p.utiles.map((o) => (
                  <Puce
                    key={o.value}
                    label={o.label}
                    compte={o.compte}
                    ton={o.ton}
                    actif={p.valeur === o.value}
                    onClick={() => p.onChange(p.valeur === o.value ? null : o.value)}
                  />
                ))}
              </div>
            </Fragment>
          ))}
          {actifsHorsPuces.map((c) => (
            <Puce
              key={c.cle}
              label={
                <>
                  {c.libelle} : <strong>{c.valeur}</strong>
                </>
              }
              actif
              titre="Retirer ce critère"
              onClick={c.retirer}
            />
          ))}
          {plus && (
            <PlusDeFiltres
              actifs={plusActifs}
              onReinitialiser={
                enListe.length || filtres?.onReinitialiser
                  ? () => {
                      for (const p of actifsListe) p.onChange(null);
                      filtres?.onReinitialiser?.();
                    }
                  : undefined
              }
            >
              {enListe.map((p) => (
                <Select
                  key={p.cle}
                  label={p.libelle}
                  allowDeselect={false}
                  searchable
                  data={[
                    { value: TOUS, label: 'Tous' },
                    ...p.utiles.map((o) => ({ value: o.value, label: `${o.label} (${o.compte})` })),
                  ]}
                  value={p.valeur ?? TOUS}
                  onChange={(v) => p.onChange(!v || v === TOUS ? null : v)}
                  comboboxProps={{ withinPortal: false }}
                />
              ))}
              {filtres?.contenu}
            </PlusDeFiltres>
          )}
          {actif && (
            <Anchor component="button" type="button" className="liste-puces__effacer" onClick={effacerTout}>
              Tout effacer
            </Anchor>
          )}
        </div>
      )}
    </div>
  );
}

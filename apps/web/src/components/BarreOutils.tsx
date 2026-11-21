/* Barre d'outils discrète des registres (refonte Neon, lot 8, ADR 0093 ; proposition « Vues en icônes et filtres à la
   demande » de la référence, retenue par le RSSI le 14/11/2026). Les champs de recherche et de filtre existants restent
   en place, avec leurs libellés : la barre ajoute une loupe dans le champ de recherche, le raccourci « / » qui y place le
   curseur, et les pastilles des critères actifs, supprimables une à une ou ensemble. Aucun filtre réel n'est retiré. */
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Menu,
  Popover,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useMergedRef } from '@mantine/hooks';
import {
  cloneElement,
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
import { useOngletVisible } from '../parcours-iso/mouvement';

/** Loupe du champ de recherche (décorative : le champ garde son libellé). */
export function IconeLoupe() {
  return (
    <svg
      className="barre-loupe"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
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

/** « / » place le curseur dans le champ de recherche du registre affiché. */
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

export interface CritereActif {
  cle: string;
  libelle: string;
  valeur: string;
  retirer: () => void;
}

/** Pastilles des critères actifs, sous la barre : chacune se retire seule ; « Effacer les critères » les retire toutes. */
export function PastillesCriteres({
  criteres,
  onToutEffacer,
}: {
  criteres: CritereActif[];
  onToutEffacer: () => void;
}) {
  if (!criteres.length) return null;
  return (
    <div className="barre-criteres" role="group" aria-label="Critères actifs">
      {criteres.map((c) => (
        <span key={c.cle} className="barre-critere">
          <span className="barre-critere__texte">
            {c.libelle} : <strong>{c.valeur}</strong>
          </span>
          <button
            type="button"
            className="barre-critere__retirer"
            aria-label={`Retirer le critère « ${c.libelle} : ${c.valeur} »`}
            onClick={c.retirer}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4.5 4.5 7 7m0-7-7 7" />
            </svg>
          </button>
        </span>
      ))}
      {criteres.length > 1 && (
        <Button size="compact-xs" variant="subtle" onClick={onToutEffacer}>
          Effacer les critères
        </Button>
      )}
    </div>
  );
}

/** Entonnoir des filtres avancés (décoratif : le bouton porte son nom). */
export function IconeFiltre() {
  return (
    <svg
      className="barre-filtre"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5h16l-6.2 7.4V18l-3.6 1.8v-7.4z" />
    </svg>
  );
}

/** Filtres avancés, dans la boîte d'outils : un bouton à icône ouvre le panneau des critères (maquette 7.3.0). */
export function FiltresAvances({
  actifs,
  onReinitialiser,
  children,
}: {
  actifs: number;
  onReinitialiser?: () => void;
  children: ReactNode;
}) {
  const nom = actifs ? `Filtres avancés (${actifs} actif${actifs > 1 ? 's' : ''})` : 'Filtres avancés';
  // Le panneau reste dans le formulaire et dans le DOM : valeurs, contraintes et propriétaires des champs sont
  // conservés quand il est fermé. display-none évite de suspendre ses effets/références via React Activity.
  return (
    <Popover
      position="bottom-start"
      shadow="md"
      trapFocus
      returnFocus
      withArrow
      withinPortal={false}
      keepMounted
      keepMountedMode="display-none"
    >
      <Popover.Target>
        <ActionIcon size="lg" variant="subtle" aria-label={nom} title={nom} className="barre-boite__outil">
          <IconeFiltre />
          {actifs > 0 && (
            <Badge size="xs" circle className="barre-boite__compte">
              {actifs}
            </Badge>
          )}
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown className="filtres-avances" aria-label="Filtres avancés">
        <Stack gap="sm">
          <Text size="sm" fw={500}>
            Filtres
          </Text>
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

/** Nom accessible d'un filtre de colonne : « Filtrer par X », suivi des valeurs retenues entre parenthèses. */
export function nomFiltreColonne(libelle: string, choisies: readonly string[]): string {
  return choisies.length ? `Filtrer par ${libelle} (filtre : ${choisies.join(', ')})` : `Filtrer par ${libelle}`;
}

/** Filtre posé sur le titre d'une colonne : un clic sur le mot ouvre les valeurs ; la colonne filtrée est marquée.
    En variante compacte, le bouton se réduit à l'entonnoir, à côté d'un titre qui garde son propre rôle (le tri). */
export function FiltreColonne({
  libelle,
  valeur,
  options,
  onChange,
  compact = false,
}: {
  libelle: string;
  valeur: string | null;
  options: { value: string; label: string }[];
  onChange: (v: string | null) => void;
  /** Bouton réduit à l'entonnoir (le nom accessible reste « Filtrer par X »). */
  compact?: boolean;
}) {
  const choisie = options.find((o) => o.value === valeur);
  const nom = nomFiltreColonne(libelle, choisie ? [choisie.label] : []);
  return (
    <Menu position="bottom-start" withArrow shadow="md">
      <Menu.Target>
        <UnstyledButton
          className={compact ? 'filtre-colonne filtre-colonne--icone' : 'filtre-colonne'}
          data-actif={choisie ? 'true' : undefined}
          aria-label={nom}
          title={compact ? nom : undefined}
        >
          {!compact && libelle}
          {!compact && choisie && <span className="filtre-colonne__valeur"> : {choisie.label}</span>}
          <IconeFiltre />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={() => onChange(null)} disabled={!choisie}>
          Tous
        </Menu.Item>
        <Menu.Divider />
        {options.map((o) => (
          <Menu.Item
            key={o.value}
            onClick={() => onChange(o.value)}
            data-choisi={o.value === valeur ? 'true' : undefined}
          >
            {o.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr');

/** Valeurs d'un filtre de colonne dont le libellé contient le texte cherché, sans tenir compte de la casse ni des
    accents ; un texte vide les garde toutes. */
export function filtrerOptions<T extends { label: string }>(options: readonly T[], texte: string): T[] {
  const cherche = sansAccents(texte.trim());
  return cherche ? options.filter((o) => sansAccents(o.label).includes(cherche)) : [...options];
}

/** Au-delà de ce nombre de valeurs, un filtre de colonne à choix multiple propose un champ de recherche. */
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

/** Liste d'un filtre de colonne à choix multiple : champ de recherche au-delà de huit valeurs, « Tous » qui vide le
    filtre, puis une case à cocher par valeur. Le texte cherché disparaît avec la liste, à sa fermeture. */
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
          data-autofocus
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

/** Filtre à choix multiple posé sur le titre d'une colonne (décision du RSSI du 18/11/2026, Documents) : le même bouton
    que FiltreColonne ouvre une liste à cases à cocher (ListeFiltreMultiple). « Tous » vide le filtre et referme la
    liste ; Échap la referme et rend la main au titre ; le clavier circule dans la liste (Tab, Espace). */
export function FiltreColonneMultiple({
  libelle,
  valeurs,
  options,
  onChange,
  description,
}: {
  libelle: string;
  valeurs: string[];
  options: OptionFiltre[];
  onChange: (v: string[]) => void;
  /** Précision affichée en tête de la liste (par exemple, la façon dont les valeurs cochées se combinent). */
  description?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const toutes = optionsAvecValeurs(options, valeurs);
  const choisies = valeurs.map((v) => toutes.find((o) => o.value === v)?.label ?? v);
  return (
    <Popover opened={ouvert} onChange={setOuvert} position="bottom-start" withArrow shadow="md" trapFocus returnFocus>
      <Popover.Target>
        <UnstyledButton
          className="filtre-colonne"
          data-actif={valeurs.length ? 'true' : undefined}
          aria-label={nomFiltreColonne(libelle, choisies)}
          onClick={() => setOuvert((o) => !o)}
        >
          {libelle}
          {choisies.length > 0 && (
            <span className="filtre-colonne__valeur filtre-colonne__resume"> : {choisies.join(', ')}</span>
          )}
          <IconeFiltre />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown className="filtre-colonne-multiple">
        <ListeFiltreMultiple
          libelle={libelle}
          valeurs={valeurs}
          options={toutes}
          onChange={onChange}
          description={description}
          onTous={() => setOuvert(false)}
        />
      </Popover.Dropdown>
    </Popover>
  );
}

export interface VueBoite {
  value: string;
  label: string;
  icone: ReactNode;
  disabled?: boolean;
}

/** Boîte d'outils commune aux registres (version 7.3.0, modèle validé par le RSSI le 16/11/2026) : petite boîte bleu
    nuit avec les vues, la recherche (raccourci « / ») et l'entonnoir des filtres avancés ; l'ajout se place au bout de
    la ligne. Les autres filtres se posent sur le titre des colonnes (FiltreColonne, FiltreColonneMultiple). */
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
}: {
  /** Nom de la barre d'outils, lu par les lecteurs d'écran. */
  label: string;
  vues?: readonly VueBoite[];
  nomVues?: string;
  vue?: string;
  onVue?: (v: string) => void;
  recherche?: { label: string; value: string; onChange: (v: string) => void; placeholder?: string };
  /** Champ existant d'un formulaire : mêmes événements, nom, contraintes et soumission. */
  champRecherche?: ReactElement<TextInputProps & { ref?: Ref<HTMLInputElement> }>;
  filtres?: { actifs: number; onReinitialiser?: () => void; contenu: ReactNode };
  ajout?: ReactNode;
  /** Outils supplémentaires, placés dans la boîte avant l'entonnoir. */
  children?: ReactNode;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const reference = useMergedRef(champ, champRecherche?.props.ref);
  useRaccourciRecherche(champ);
  // Lueur du champ de recherche : arrêtée quand l'onglet est masqué (ADR 0099).
  const ongletVisible = useOngletVisible();
  return (
    <div className="barre-boite-ligne" data-mouvement={ongletVisible ? 'anime' : 'pause'}>
      <div className="barre-boite" role="toolbar" aria-label={label}>
        {vues && vues.length > 0 && (
          <>
            <div className="barre-boite__vues" role="group" aria-label={nomVues}>
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
            {(recherche || champRecherche || filtres || children) && (
              <span className="barre-boite__sep" aria-hidden="true" />
            )}
          </>
        )}
        {recherche && (
          <TextInput
            ref={champ}
            className="barre-recherche barre-boite__recherche"
            aria-label={recherche.label}
            placeholder={recherche.placeholder ?? 'Rechercher…'}
            leftSection={<IconeLoupe />}
            title="Raccourci : touche /"
            value={recherche.value}
            onChange={(e) => recherche.onChange(e.currentTarget.value)}
          />
        )}
        {champRecherche &&
          cloneElement(champRecherche, {
            ref: reference,
            className: [champRecherche.props.className, 'barre-recherche barre-boite__recherche']
              .filter(Boolean)
              .join(' '),
            leftSection: champRecherche.props.leftSection ?? <IconeLoupe />,
            title:
              champRecherche.props.title ??
              (typeof champRecherche.props.description === 'string'
                ? champRecherche.props.description
                : 'Raccourci : touche /'),
            placeholder:
              champRecherche.props.placeholder ??
              (typeof champRecherche.props.label === 'string' ? `${champRecherche.props.label}…` : 'Rechercher…'),
          })}
        {children}
        {filtres && (
          <FiltresAvances actifs={filtres.actifs} onReinitialiser={filtres.onReinitialiser}>
            {filtres.contenu}
          </FiltresAvances>
        )}
      </div>
      {ajout && <div className="barre-outils__ajout">{ajout}</div>}
    </div>
  );
}

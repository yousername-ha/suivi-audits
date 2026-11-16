/* Barre d'outils discrète des registres (refonte Neon, lot 8, ADR 0093 ; proposition « Vues en icônes et filtres à la
   demande » de la référence, retenue par le RSSI le 14/11/2026). Les champs de recherche et de filtre existants restent
   en place, avec leurs libellés : la barre ajoute une loupe dans le champ de recherche, le raccourci « / » qui y place le
   curseur, et les pastilles des critères actifs, supprimables une à une ou ensemble. Aucun filtre réel n'est retiré. */
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  Popover,
  Stack,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

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
      const fenetreOuverte = !!document.querySelector('[role="dialog"]');
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
  onReinitialiser: () => void;
  children: ReactNode;
}) {
  const nom = actifs ? `Filtres avancés (${actifs} actif${actifs > 1 ? 's' : ''})` : 'Filtres avancés';
  return (
    <Popover position="bottom-start" shadow="md" trapFocus withArrow>
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
      <Popover.Dropdown className="filtres-avances">
        <Stack gap="sm">
          {children}
          <Group justify="flex-end">
            <Button size="xs" variant="subtle" disabled={!actifs} onClick={onReinitialiser}>
              Réinitialiser
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

/** Filtre posé sur le titre d'une colonne : un clic sur le mot ouvre les valeurs ; la colonne filtrée est marquée. */
export function FiltreColonne({
  libelle,
  valeur,
  options,
  onChange,
}: {
  libelle: string;
  valeur: string | null;
  options: { value: string; label: string }[];
  onChange: (v: string | null) => void;
}) {
  const choisie = options.find((o) => o.value === valeur);
  return (
    <Menu position="bottom-start" withArrow shadow="md">
      <Menu.Target>
        <UnstyledButton
          className="filtre-colonne"
          data-actif={choisie ? 'true' : undefined}
          aria-label={choisie ? `Filtrer par ${libelle} (filtre : ${choisie.label})` : `Filtrer par ${libelle}`}
        >
          {libelle}
          {choisie && <span className="filtre-colonne__valeur"> : {choisie.label}</span>}
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

export interface VueBoite {
  value: string;
  label: string;
  icone: ReactNode;
}

/** Boîte d'outils commune aux registres (version 7.3.0, modèle validé par le RSSI le 16/11/2026) : petite boîte bleu
    nuit avec les vues, la recherche (raccourci « / ») et l'entonnoir des filtres avancés ; l'ajout se place au bout de
    la ligne. Les autres filtres se posent sur le titre des colonnes (FiltreColonne). */
export function BoiteOutils({
  label,
  vues,
  vue,
  onVue,
  recherche,
  filtres,
  ajout,
  children,
}: {
  /** Nom de la barre d'outils, lu par les lecteurs d'écran. */
  label: string;
  vues?: readonly VueBoite[];
  vue?: string;
  onVue?: (v: string) => void;
  recherche?: { label: string; value: string; onChange: (v: string) => void; placeholder?: string };
  filtres?: { actifs: number; onReinitialiser: () => void; contenu: ReactNode };
  ajout?: ReactNode;
  /** Outils supplémentaires, placés dans la boîte avant l'entonnoir. */
  children?: ReactNode;
}) {
  const champ = useRef<HTMLInputElement>(null);
  useRaccourciRecherche(champ);
  return (
    <div className="barre-boite-ligne">
      <div className="barre-boite" role="toolbar" aria-label={label}>
        {vues && vues.length > 0 && (
          <>
            <div className="barre-boite__vues" role="group" aria-label="Vues">
              {vues.map((v) => (
                <Tooltip key={v.value} label={v.label} withArrow openDelay={250}>
                  <ActionIcon
                    size="lg"
                    variant={vue === v.value ? 'filled' : 'subtle'}
                    aria-label={v.label}
                    aria-pressed={vue === v.value}
                    onClick={() => onVue?.(v.value)}
                  >
                    {v.icone}
                  </ActionIcon>
                </Tooltip>
              ))}
            </div>
            {(recherche || filtres || children) && <span className="barre-boite__sep" aria-hidden="true" />}
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

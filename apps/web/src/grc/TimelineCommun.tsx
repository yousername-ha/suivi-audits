/* Pièces communes des frises (Timeline Studio, refonte des frises du 20/11/2026) : puces d'état et de résultat, commandes
   compactes de la barre d'outils (échelle en sélecteur segmenté, bascules), règle et pied des colonnes de temps, carré
   d'occurrence, fiches non dessinées et commande clavier des repères. Les textes disent l'état, le résultat et le retard :
   la teinte ne fait que les doubler. Positions et tailles par attributs SVG (CSP stricte) ; couleurs par les classes de
   neon-taches.css. */
import { Button, Group, Stack, Text, Tooltip } from '@mantine/core';
import type { BusinessPolicy, GrcObject } from '@suivi/shared';
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { classeResultat, libelleStatut, symboleStatut, tonStatut, tonTache, validationDe } from './etat-action';
import { initiales } from './Timeline';

/** Ouvre la petite fenêtre de résultat d'un repère ; le déclencheur reçoit le focus à sa fermeture. */
export type OuvrirResultat = (o: GrcObject, declencheur: HTMLElement | SVGElement) => void;

/* ---------- Infobulle des repères (survol et focus) ---------- */

export interface Infobulle {
  cible: SVGElement;
  lignes: string[];
}
/** Une seule infobulle par frise, ouverte au survol ou au focus d'un repère. */
export function useInfobulle() {
  const [infobulle, setInfobulle] = useState<Infobulle | null>(null);
  /** Gestionnaires à poser sur un repère : survol et focus ouvrent, sortie, perte du focus et clic referment. */
  const surRepere = (lignes: () => string[]) => ({
    onMouseEnter: (e: { currentTarget: SVGElement }) => setInfobulle({ cible: e.currentTarget, lignes: lignes() }),
    onFocus: (e: { currentTarget: SVGElement }) => setInfobulle({ cible: e.currentTarget, lignes: lignes() }),
    onMouseLeave: () => setInfobulle(null),
    onBlur: () => setInfobulle(null),
  });
  return { infobulle, fermer: () => setInfobulle(null), surRepere };
}
/** Infobulle Mantine rattachée au repère survolé (mode `target`) : elle n'ajoute pas de description au repère, dont le
    nom accessible dit déjà l'intitulé, l'état et les dates, et reste hors de l'arbre d'accessibilité. Elle ne capte
    aucun clic (non interactive) : le clic du repère ouvre toujours la petite fenêtre de résultat. */
export function InfobulleRepere({ infobulle }: { infobulle: Infobulle | null }) {
  const [titre, ...suite] = infobulle?.lignes ?? [];
  return (
    <Tooltip
      target={{ current: (infobulle?.cible ?? null) as HTMLElement | null }}
      opened={!!infobulle}
      position="top"
      withArrow
      multiline
      aria-hidden="true"
      classNames={{ tooltip: 'frise-infobulle' }}
      label={
        <>
          <span className="frise-infobulle__titre">{titre}</span>
          {suite.map((l) => (
            <span key={l} className="frise-infobulle__ligne">
              {l}
            </span>
          ))}
        </>
      }
    />
  );
}

/** Commande clavier d'un repère dessiné (Entrée ou Espace), comme un bouton. */
export function toucheRepere(action: (el: SVGElement) => void) {
  return (e: KeyboardEvent<SVGElement>) => {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    action(e.currentTarget);
  };
}

/** Puce d'état des autres vues (liste, Kanban, petite fenêtre) : symbole et libellé du statut de la politique. « À faire »
    sans résultat est animé (le halo seulement, jamais le texte). */
export function EtatTache({
  objet,
  policy,
  anime = true,
}: {
  objet: GrcObject;
  policy: BusinessPolicy;
  anime?: boolean;
}) {
  const ton = tonStatut(policy, objet.data.status);
  return (
    <span
      className="tache-etat"
      data-ton={ton}
      data-pouls={anime && ton === 'amber' && !validationDe(objet) ? '' : undefined}
    >
      <span aria-hidden="true">{symboleStatut(policy, objet.data.status)}</span>
      <span className="tache-etat__libelle">{libelleStatut(policy, objet)}</span>
    </span>
  );
}

/** Résultat d'une occurrence validée : information distincte du statut et du retard. */
export function ResultatTache({ objet }: { objet: GrcObject }) {
  const v = validationDe(objet);
  if (!v) return null;
  return (
    <span className="tache-resultat" data-resultat={classeResultat(objet)}>
      Validée : {v}
    </span>
  );
}

/** Pastille d'état des frises : point de la teinte de l'état et libellé du statut. Une occurrence validée dit son
    résultat (« Validée OK »), comme la ligne de la Timeline précédente ; son statut reste en infobulle. */
export function PastilleEtat({ objet, policy }: { objet: GrcObject; policy: BusinessPolicy }) {
  const v = validationDe(objet);
  if (v)
    return (
      <span
        className="frise-etat"
        data-ton={tonTache(objet, policy)}
        title={`${libelleStatut(policy, objet)}, validée (${v})`}
      >
        Validée {v}
      </span>
    );
  return (
    <span className="frise-etat" data-ton={tonStatut(policy, objet.data.status)}>
      {libelleStatut(policy, objet)}
    </span>
  );
}

/** Pastille de résultat (OK, KO, NA) d'une occurrence, ou tiret sans résultat. */
export function PastilleResultat({ objet }: { objet?: GrcObject }) {
  const v = objet ? validationDe(objet) : null;
  if (!objet || !v) return <span className="frise-sans">—</span>;
  return (
    <span className="frise-resultat" data-resultat={classeResultat(objet)}>
      {v}
    </span>
  );
}

/** Initiales du responsable dans une pastille, son libellé complet en infobulle ; tiret sans responsable. */
export function PastilleResponsable({ libelle, vide }: { libelle: string; vide: boolean }) {
  const lettres = vide ? '' : initiales(libelle);
  return (
    <span className={lettres ? 'frise-resp' : 'frise-resp frise-resp--vide'} title={libelle}>
      {lettres || '—'}
    </span>
  );
}

/** Texte masqué à l'écran, lu par les lecteurs d'écran. */
export function TexteMasque({ children }: { children: ReactNode }) {
  return <span className="frise-masque">{children}</span>;
}

/** Période affichée : « du … au … » à l'écran, précédé de « Période affichée : » pour les lecteurs d'écran. */
export function PeriodeAffichee({
  debut,
  fin,
  suite,
  souple = false,
}: {
  debut: string;
  fin: string;
  suite?: string;
  /** Vrai : la période prend l'espace libre de la barre et passe à la ligne s'il manque de place. */
  souple?: boolean;
}) {
  return (
    <span className={souple ? 'frise-barre__periode frise-barre__periode--souple' : 'frise-barre__periode'}>
      <span className="frise-barre__dates">
        <TexteMasque>Période affichée :</TexteMasque> du {debut} au {fin}
      </span>
      {suite && <span className="frise-barre__suite">{suite}</span>}
    </span>
  );
}

/** Sélecteur segmenté : un bouton par choix, le choix courant enfoncé (aria-pressed). */
export function Segmente<T extends string>({
  label,
  options,
  valeur,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  valeur: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="frise-segments">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="frise-segment"
          aria-pressed={valeur === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bascule compacte : case à cocher native (rôle checkbox, nom accessible complet) dessinée en interrupteur. */
export function Bascule({
  libelle,
  complement,
  coche,
  onChange,
}: {
  libelle: string;
  /** Fin du nom accessible, masquée à l'écran (« en fond »). */
  complement?: string;
  coche: boolean;
  onChange: (coche: boolean) => void;
}) {
  return (
    <label className="frise-bascule">
      <span className="frise-bascule__piste">
        <input
          type="checkbox"
          className="frise-bascule__entree"
          checked={coche}
          onChange={(e) => onChange(e.currentTarget.checked)}
        />
      </span>
      <span>
        {libelle}
        {complement && <TexteMasque> {complement}</TexteMasque>}
      </span>
    </label>
  );
}

/** Élément de légende : pastille dessinée, ou icône d'occurrence (décorative), et libellé. */
export function ElementLegende({
  forme,
  ton,
  icone,
  children,
}: {
  forme?: string;
  ton?: string;
  icone?: EtatCarre;
  children: ReactNode;
}) {
  return (
    <span className="frise-legende__item">
      {icone ? (
        <IconeLegende etat={icone} />
      ) : (
        <span className={`frise-pastille frise-pastille--${forme}`} data-ton={ton} aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

/* ---------- Mesure du texte des repères (troncature avec points de suspension) ---------- */

let contexte: CanvasRenderingContext2D | null | undefined;
let famille = '';
let racineMesuree = { largeur: -1, taille: 16 };
/** Taille de police de la racine (elle suit la largeur de la fenêtre) : relue quand la largeur change. */
function taillePoliceRacine(): number {
  if (typeof window === 'undefined') return 16;
  if (racineMesuree.largeur !== window.innerWidth)
    racineMesuree = {
      largeur: window.innerWidth,
      taille: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
    };
  return racineMesuree.taille;
}
/** Largeur en pixels d'un texte de `taille` rem à la police de l'application (estimation sans canevas). */
export function largeurTexte(texte: string, taille: number, graisse = 400): number {
  if (contexte === undefined) {
    try {
      contexte = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
      famille = typeof document === 'undefined' ? '' : getComputedStyle(document.body).fontFamily;
    } catch {
      contexte = null;
    }
  }
  const racine = taillePoliceRacine();
  if (!contexte) return texte.length * taille * racine * 0.6;
  contexte.font = `${graisse} ${taille * racine}px ${famille || 'sans-serif'}`;
  return contexte.measureText(texte).width;
}
/** Redessine une fois les polices chargées : les mesures faites avant reposaient sur la police de repli. */
export function usePolicesChargees() {
  const [, redessiner] = useState(0);
  useEffect(() => {
    let actif = true;
    void document.fonts?.ready.then(() => actif && redessiner((n) => n + 1));
    return () => {
      actif = false;
    };
  }, []);
}
/** Texte raccourci (points de suspension) pour tenir dans `largeur` pixels ; chaîne vide si rien ne tient. */
export function tronquer(texte: string, largeur: number, taille: number, graisse = 400): string {
  if (largeurTexte(texte, taille, graisse) <= largeur) return texte;
  let bas = 0,
    haut = texte.length - 1;
  while (bas < haut) {
    const m = Math.ceil((bas + haut) / 2);
    if (largeurTexte(texte.slice(0, m).trimEnd() + '…', taille, graisse) <= largeur) bas = m;
    else haut = m - 1;
  }
  return bas > 0 ? texte.slice(0, bas).trimEnd() + '…' : '';
}

/* ---------- Règle et pied des colonnes de temps ---------- */

export interface ColonneTemps {
  debut: number;
  fin: number;
  libelle: string;
  court: string;
}
/** Taille (rem) des libellés de la règle et des repères, et des étiquettes : celle des classes de neon-taches.css. */
export const TAILLE_LIBELLE = 0.72;
export const TAILLE_ETIQUETTE = 0.625;

/** Règle des colonnes : libellé de chaque période en haut à gauche de sa colonne, traits verticaux, ligne et étiquette
    « Aujourd'hui » en bas de la règle (le libellé de la période reste lisible). Décorative : la période est écrite dans la
    barre d'outils. */
export function RegleTemps({
  colonnes,
  x,
  largeur,
  hauteur,
  aujourdhui,
}: {
  colonnes: readonly ColonneTemps[];
  x: (n: number) => number;
  largeur: number;
  hauteur: number;
  aujourdhui: number;
}) {
  const xa = x(aujourdhui);
  const visible = Number.isFinite(xa) && xa >= 0 && xa <= largeur;
  const etiquette = 'Aujourd’hui',
    le = largeurTexte(etiquette, TAILLE_ETIQUETTE, 700) + 12,
    he = 16;
  const ex = Math.max(1, Math.min(largeur - le - 1, xa - le / 2));
  // Même forme de libellé pour toutes les colonnes : complète si elle tient partout, sinon courte, sinon aucune.
  const tient = (cle: 'libelle' | 'court') =>
    colonnes.every((c) => largeurTexte(c[cle], TAILLE_LIBELLE, 500) <= x(c.fin) - x(c.debut) - 12);
  const forme = tient('libelle') ? 'libelle' : tient('court') ? 'court' : null;
  return (
    <svg className="frise-regle" width={largeur} height={hauteur} aria-hidden="true">
      {colonnes.map((c, i) => {
        const gauche = x(c.debut);
        // En libellés courts, la première colonne et chaque changement d'année gardent le libellé complet s'il y tient.
        const debutAnnee =
          i === 0 || new Date(c.debut).getUTCFullYear() !== new Date(colonnes[i - 1]!.debut).getUTCFullYear();
        const complet =
          forme === 'court' && debutAnnee && largeurTexte(c.libelle, TAILLE_LIBELLE, 500) <= x(c.fin) - gauche - 12;
        const texte = complet ? c.libelle : forme ? c[forme] : '';
        return (
          <g key={c.debut}>
            <line className="frise-trait" x1={gauche} x2={gauche} y1="0" y2={hauteur} />
            {texte && (
              <text className="frise-regle__libelle" x={gauche + 8} y="18">
                {texte}
              </text>
            )}
          </g>
        );
      })}
      {visible && (
        <>
          <line className="grc-timeline__aujourdhui" x1={xa} x2={xa} y1={hauteur - he - 6} y2={hauteur} />
          <g className="frise-aujourdhui">
            <rect x={ex} y={hauteur - he - 5} width={le} height={he} rx="5" />
            <text x={ex + le / 2} y={hauteur - 9} textAnchor="middle">
              {etiquette}
            </text>
          </g>
        </>
      )}
    </svg>
  );
}

/** Pied des colonnes : nombre d'échéances (ou d'occurrences) de chaque colonne, en pastille ; nom accessible complet. */
export function PiedTemps({
  titre,
  colonnes,
  comptes,
  x,
  largeur,
  hauteur,
}: {
  titre: string;
  colonnes: readonly ColonneTemps[];
  comptes: readonly number[];
  x: (n: number) => number;
  largeur: number;
  hauteur: number;
}) {
  return (
    <svg
      className="frise-pied-temps"
      width={largeur}
      height={hauteur}
      role="img"
      // Nom accessible sans l'unité (« … du mois ») : il ne doit pas se confondre avec un champ « Mois » de la page.
      aria-label={`${titre.split(' ')[0]} par période : ${colonnes.map((c, i) => `${c.libelle}, ${comptes[i] ?? 0}`).join(' · ')}`}
    >
      {colonnes.map((c, i) => {
        const n = comptes[i] ?? 0,
          cx = (x(c.debut) + x(c.fin)) / 2,
          texte = String(n),
          l = Math.max(22, largeurTexte(texte, TAILLE_ETIQUETTE, 700) + 12),
          // Colonne plus étroite que la pastille (téléphone) : le nombre seul, sans fond.
          pastille = n > 0 && x(c.fin) - x(c.debut) >= l + 2;
        return (
          <g key={c.debut} className={pastille ? 'frise-nb' : n ? 'frise-nb frise-nb--nu' : 'frise-nb frise-nb--zero'}>
            <line className="frise-trait" x1={x(c.debut)} x2={x(c.debut)} y1="0" y2={hauteur} />
            {pastille && <rect x={cx - l / 2} y={hauteur / 2 - 8} width={l} height="16" rx="8" />}
            <text x={cx} y={hauteur / 2 + 3.5} textAnchor="middle">
              {texte}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Icônes des occurrences (décision du RSSI du 20/11/2026 : mélange C + D, verre Néon) ---------- */

export type EtatCarre = 'ok' | 'ko' | 'na' | 'attendu' | 'retard' | 'avenir';
/** Sens de l'icône d'une occurrence chargée : résultat enregistré (OK, KO, NA), en retard sans résultat (triangle),
    résultat attendu (échéance passée) ou à venir. */
export function etatCarre(o: GrcObject, maintenant: number, retard: boolean): EtatCarre {
  const r = classeResultat(o);
  if (r !== 'attente') return r;
  if (retard) return 'retard';
  const t = typeof o.data.dueAt === 'string' ? Date.parse(o.data.dueAt) : Number.NaN;
  return Number.isFinite(t) && t < maintenant ? 'attendu' : 'avenir';
}

const VERRES = ['ok', 'ko', 'na', 'attendu', 'retard'] as const;
/** Dégradés « verre » des icônes (de la teinte éclaircie vers la teinte), une fois par frise : couleurs des arrêts par
    les classes de neon-taches.css (CSP stricte, aucun style en ligne). La définition reste rendue (taille nulle). */
export function DefsVerre() {
  return (
    <svg className="frise-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        {VERRES.map((k) => (
          <linearGradient
            key={k}
            id={`frise-verre-${k}`}
            className={`frise-verre frise-verre--${k}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0" className="frise-verre__haut" />
            <stop offset="1" className="frise-verre__bas" />
          </linearGradient>
        ))}
      </defs>
    </svg>
  );
}

/** Dessin d'une icône dans un carré de 20 unités (origine en haut à gauche), sur le modèle validé : carré arrondi OK
    (coche), losange KO (croix aux bouts ronds), carré NA (barre oblique), carré orange « résultat attendu » (horloge),
    triangle « en retard » (point d'exclamation, seul repère animé : une lueur qui pulse) et carré pointillé « à venir ». */
export function DessinOccurrence({ etat }: { etat: EtatCarre }) {
  const fond = (cle: string) => `url(#frise-verre-${cle})`;
  const carre = (cle: string) => (
    <>
      <rect className="frise-icone__corps" x="1" y="1" width="18" height="18" rx="5" fill={fond(cle)} />
      <rect className="frise-icone__liseret" x="1.6" y="1.6" width="16.8" height="16.8" rx="4.4" />
    </>
  );
  if (etat === 'ok')
    return (
      <>
        {carre('ok')}
        <path className="frise-icone__glyphe" d="M5.8 10.4l2.8 2.8L14.2 7.4" strokeWidth="2.2" />
      </>
    );
  if (etat === 'ko')
    return (
      <>
        <rect
          className="frise-icone__corps"
          x="2.8"
          y="2.8"
          width="14.4"
          height="14.4"
          rx="3.2"
          transform="rotate(45 10 10)"
          fill={fond('ko')}
        />
        <rect
          className="frise-icone__liseret"
          x="3.4"
          y="3.4"
          width="13.2"
          height="13.2"
          rx="2.7"
          transform="rotate(45 10 10)"
        />
        <path className="frise-icone__glyphe" d="M7.4 7.4l5.2 5.2M12.6 7.4l-5.2 5.2" strokeWidth="2.8" />
      </>
    );
  if (etat === 'na')
    return (
      <>
        {carre('na')}
        <path className="frise-icone__glyphe" d="M6.5 13.5l7-7" strokeWidth="2.2" />
      </>
    );
  if (etat === 'attendu')
    return (
      <>
        {carre('attendu')}
        <circle className="frise-icone__glyphe" cx="10" cy="10" r="4.6" strokeWidth="1.7" />
        <path className="frise-icone__glyphe" d="M10 7.6V10l1.6 1.2" strokeWidth="1.6" />
      </>
    );
  if (etat === 'retard')
    return (
      <g className="frise-lueur">
        <path
          className="frise-icone__corps frise-icone__bord-retard"
          d="M10 1.6L18.6 17.2Q19 18 18 18H2Q1 18 1.4 17.2z"
          fill={fond('retard')}
          strokeWidth="0.6"
        />
        <path className="frise-icone__liseret" d="M10 3.4L17 16.4H3z" strokeWidth="0.9" />
        <path className="frise-icone__glyphe" d="M10 7.6v4.4" strokeWidth="2.1" />
        <circle className="frise-icone__point" cx="10" cy="14.6" r="1.15" />
      </g>
    );
  return (
    <rect
      className="frise-icone__corps frise-icone__avenir"
      x="1.5"
      y="1.5"
      width="17"
      height="17"
      rx="4.6"
      strokeWidth="1.5"
      strokeDasharray="3 2.5"
    />
  );
}

/** Le corps des carrés mesure 18 unités : à cette échelle, 15 pixels, la taille des carrés précédents. Le triangle du
    retard est un peu plus grand, comme dans le modèle. */
const ECHELLE_ICONE = 15 / 18;
/** Icône d'une occurrence centrée sur son échéance (position par l'attribut `transform`, jamais par un style). */
export function CarreOccurrence({ cx, cy, etat }: { cx: number; cy: number; etat: EtatCarre }) {
  const e = etat === 'retard' ? ECHELLE_ICONE * 1.08 : ECHELLE_ICONE;
  return (
    <g className="grc-timeline__occurrence" transform={`translate(${cx} ${cy}) scale(${e}) translate(-10 -10)`}>
      <DessinOccurrence etat={etat} />
    </g>
  );
}
/** Icône d'occurrence pour la légende (même dessin, décoratif). */
export function IconeLegende({ etat }: { etat: EtatCarre }) {
  return (
    <svg
      className="frise-icone-legende"
      width="15"
      height="15"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <DessinOccurrence etat={etat} />
    </svg>
  );
}

/** Fiches non dessinées (hors période, sans date, dates à vérifier) : toujours accessibles, sans date inventée. */
export function ListeHors({
  titre,
  message,
  objets,
  onOpen,
}: {
  titre: string;
  message?: string;
  objets: GrcObject[];
  onOpen: (o: GrcObject) => void;
}) {
  if (!objets.length) return null;
  return (
    <Stack gap="xs" className="timeline-hors">
      <Text size="sm" fw={600}>
        {titre}
      </Text>
      {message && (
        <Text size="xs" c="dimmed">
          {message}
        </Text>
      )}
      <Group gap="xs">
        {objets.map((o) => (
          <Button key={o.id} variant="subtle" size="compact-sm" onClick={() => onOpen(o)}>
            {o.name}
          </Button>
        ))}
      </Group>
    </Stack>
  );
}

/* Adaptateur des recherches déjà contrôlées : il conserve les champs et leurs callbacks, et les compose dans la
   boîte d'outils commune. Le formulaire reste propriétaire des champs, y compris ceux du panneau de filtres. */
import {
  Anchor,
  Button,
  SegmentedControl,
  Text,
  TextInput,
  VisuallyHidden,
  type TextInputProps,
  type SegmentedControlProps,
} from '@mantine/core';
import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode, type Ref } from 'react';
import { BoiteOutils, IconeLoupe, type VueBoite } from './BarreOutils';

type Champ = ReactElement<TextInputProps & { ref?: Ref<HTMLInputElement> }>;
type Controle = ReactElement<{
  value?: unknown;
  checked?: boolean;
  children?: ReactNode;
  type?: string;
  className?: string;
  'aria-label'?: string;
  title?: string;
}>;

function texte(n: ReactNode): string {
  return Children.toArray(n)
    .map((x) => (isValidElement(x) ? texte((x as Controle).props.children) : String(x)))
    .join(' ')
    .trim();
}

function elements(n: ReactNode): ReactNode[] {
  return Children.toArray(n).flatMap((x) =>
    isValidElement(x) && x.type === Fragment ? elements((x as Controle).props.children) : [x],
  );
}

function IconeVue({ nom }: { nom: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/faille/i.test(nom) ? (
        <>
          <path d="M12 3 2 21h20Z" />
          <path d="M12 9v5m0 3v.1" />
        </>
      ) : /correctif/i.test(nom) ? (
        <>
          <path d="m14 5 4-3a6 6 0 0 1-7 8L4 20a2 2 0 0 1-3-3l10-7a6 6 0 0 1 3-8Z" />
        </>
      ) : /machine/i.test(nom) ? (
        <>
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 21h8m-4-4v4" />
        </>
      ) : /carte|parc|panorama|graphe|globale/i.test(nom) ? (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="m10 10-5-5m9 5 5-5m-9 9-5 5m9-5 5 5" />
          <circle cx="4" cy="4" r="2" />
          <circle cx="20" cy="4" r="2" />
          <circle cx="4" cy="20" r="2" />
          <circle cx="20" cy="20" r="2" />
        </>
      ) : /dalle|tuile|bloc|compact|synth/i.test(nom) ? (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </>
      ) : (
        <>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1" />
        </>
      )}
    </svg>
  );
}

/** Compte les contrôles renseignés, sans confondre une recherche et un filtre. Le tri et les choix « Tous » restent
    disponibles dans le panneau ; les appels réels et la définition des valeurs par défaut restent dans les pages. */
export function compterFiltres(controles: readonly ReactNode[]): number {
  return controles.reduce<number>((total, n) => {
    if (!isValidElement(n)) return total;
    const p = (n as Controle).props;
    if (typeof p.checked === 'boolean') return total + Number(p.checked);
    const v = p.value;
    if (Array.isArray(v)) return total + Number(v.length > 0);
    if (v === undefined) return total + compterFiltres(Children.toArray(p.children));
    return total + Number(v !== null && v !== '' && v !== false && !['all', 'tous', 'toutes'].includes(String(v)));
  }, 0);
}

/** Nom de la barre quand son libellé est déjà celui du champ de recherche qu'elle contient. */
export const NOM_BARRE_NEUTRE = 'Barre d’outils';

export function BarreFiltres({
  label,
  children,
  actions,
  vues,
  vue,
  onVue,
}: {
  label: string;
  children: ReactNode;
  actions?: ReactNode;
  vues?: readonly VueBoite[];
  vue?: string;
  onVue?: (v: string) => void;
}) {
  const controles = elements(children);
  const champ = controles.find(
    (n) =>
      isValidElement(n) &&
      n.type === TextInput &&
      (!(n as Champ).props.type || ['text', 'search'].includes(String((n as Champ).props.type))),
  ) as Champ | undefined;
  const choixVue = controles.find(
    (n) =>
      isValidElement(n) &&
      n.type === SegmentedControl &&
      /vue|présentation|affichage/i.test(String((n as Controle).props['aria-label'] ?? '')),
  ) as ReactElement<SegmentedControlProps> | undefined;
  const commandes = controles.filter(
    (n) =>
      isValidElement(n) &&
      n.type === Button &&
      ((n as Controle).props.type === 'submit' ||
        /^(Rechercher|Filtrer)$/.test(String((n as Controle).props.children).trim())),
  ) as Controle[];
  const annexes = controles.filter(
    (n) =>
      isValidElement(n) &&
      (n.type === Text ||
        n.type === Anchor ||
        (n.type === Button &&
          !commandes.includes(n as Controle) &&
          !/effacer|initialiser/i.test(texte((n as Controle).props.children)))),
  );
  // Un sélecteur à segments qui n'est pas le choix de vue est le filtre principal d'un registre (« Ouverts »,
  // « Tous »…) : il reste visible à côté de la barre, à un clic, au lieu d'être replié dans le panneau de filtres où
  // ses choix ne tiennent pas.
  const segments = controles.filter((n) => isValidElement(n) && n.type === SegmentedControl && n !== choixVue);
  const filtres = controles.filter(
    (n) =>
      n !== champ &&
      n !== choixVue &&
      !commandes.includes(n as Controle) &&
      !annexes.includes(n) &&
      !segments.includes(n),
  );
  const presentations = choixVue?.props.data?.map((o) => {
    const item = typeof o === 'string' ? { value: o, label: o } : o;
    const nom = texte(item.label) || item.value;
    return {
      value: item.value,
      label: nom,
      disabled: choixVue.props.disabled || item.disabled,
      icone: <IconeVue nom={nom} />,
    };
  });
  // Une barre qui ne contient qu'une recherche porte souvent le nom de son champ : deux éléments auraient alors le même
  // nom accessible (annonce en double, champ introuvable par son seul libellé). La barre prend dans ce cas un nom neutre.
  const nomChamp = champ ? String(champ.props['aria-label'] ?? texte(champ.props.label)) : '';
  const nomBarre = nomChamp && nomChamp.trim().toLowerCase() === label.trim().toLowerCase() ? NOM_BARRE_NEUTRE : label;
  return (
    <BoiteOutils
      label={nomBarre}
      champRecherche={champ}
      vues={vues ?? presentations}
      nomVues={choixVue?.props['aria-label']}
      vue={vue ?? choixVue?.props.value}
      onVue={onVue ?? choixVue?.props.onChange}
      filtres={
        filtres.length
          ? { actifs: compterFiltres(filtres), contenu: <div className="barre-filtres-champs">{filtres}</div> }
          : undefined
      }
      ajout={
        segments.length || annexes.length || actions ? (
          <>
            {segments}
            {annexes}
            {actions}
          </>
        ) : undefined
      }
    >
      {commandes.map((commande, i) =>
        cloneElement(commande, {
          key: commande.key ?? i,
          className: [commande.props.className, 'barre-boite__soumettre'].filter(Boolean).join(' '),
          title: commande.props.title ?? String(commande.props.children).trim(),
          // Le nom du bouton reste son texte (masqué à l'écran), pas un attribut aria-label : un bouton « Rechercher »
          // à côté d'un champ « Rechercher » ne répond ainsi pas à la recherche d'un champ par son libellé.
          children: (
            <>
              <IconeLoupe />
              <VisuallyHidden>{commande.props.children}</VisuallyHidden>
            </>
          ),
        }),
      )}
    </BoiteOutils>
  );
}

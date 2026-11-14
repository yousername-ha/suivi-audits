/* Pièces communes de la Timeline Studio (refonte Neon, lot 6) : puces d'état et de résultat, légende, fiches non
   dessinées et commande clavier des repères. Les textes disent l'état, le résultat et le retard : la teinte ne fait que
   les doubler. */
import { Button, Group, Stack, Text } from '@mantine/core';
import type { BusinessPolicy, GrcObject } from '@suivi/shared';
import type { KeyboardEvent } from 'react';
import { classeResultat, libelleStatut, symboleStatut, tonStatut, validationDe } from './etat-action';

/** Ouvre la petite fenêtre de résultat d'un repère ; le déclencheur reçoit le focus à sa fermeture. */
export type OuvrirResultat = (o: GrcObject, declencheur: HTMLElement | SVGElement) => void;

/** Commande clavier d'un repère dessiné (Entrée ou Espace), comme un bouton. */
export function toucheRepere(action: (el: SVGElement) => void) {
  return (e: KeyboardEvent<SVGElement>) => {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    action(e.currentTarget);
  };
}

/** Puce d'état : symbole et libellé du statut de la politique (texte fixe). « À faire » sans résultat est animé (le
    halo seulement, jamais le texte). */
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

/** Légende commune : teinte et symbole de chaque statut, sens des carrés d'occurrence, repère du retard. */
export function LegendeTimeline({ policy }: { policy: BusinessPolicy }) {
  return (
    <Group
      gap="xs"
      className="timeline-legende"
      role="group"
      aria-label="Légende : état de l’action, symbole et couleur de la barre"
    >
      {policy.statuses.map((st) => (
        <span key={st.id} className="tache-etat" data-ton={tonStatut(policy, st.id)}>
          <span aria-hidden="true">{symboleStatut(policy, st.id)}</span>
          <span>{st.label}</span>
        </span>
      ))}
      <span className="timeline-legende__item">
        <svg width="14" height="14" aria-hidden="true" className="timeline-legende__carre">
          <rect
            x="2"
            y="2"
            width="10"
            height="10"
            rx="2"
            className="grc-timeline__occurrence grc-timeline__occurrence--attente"
          />
        </svg>
        Occurrence : jaune en attente de validation, puis vert (OK), rouge (KO) ou gris (NA)
      </span>
      <span className="timeline-legende__item grc-timeline__retard-legende">
        ! En retard : repère cerclé de rouge, en plus de l’état
      </span>
    </Group>
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

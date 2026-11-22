/* Commandes de ligne : raccourcis usuels en pictogrammes, décisions métier explicitement nommées. Les infobulles
   s'ouvrent aussi au focus ; les noms accessibles restent complets malgré les libellés courts. Aucun droit ni appel
   serveur ici : le registre conserve ses gardes et callbacks. */
import { ActionIcon, Button, Group, Tooltip } from '@mantine/core';
import { IconeActions } from '@suivi/ui';
import type { ReactNode } from 'react';

function Pictogramme({ children }: { children: ReactNode }) {
  return (
    <span className="nav-icone" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </span>
  );
}

const IconeAfficher = () => (
  <Pictogramme>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Pictogramme>
);
const IconeLiens = () => (
  <Pictogramme>
    <path d="m10 13 4-4m-6 6-2 2a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m4 0 2-2a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0" />
  </Pictogramme>
);

export function CommandesRisque({
  nom,
  onOpen,
  onPlan,
  onRelation,
  onEvaluation,
  onAcceptation,
}: {
  nom: string;
  onOpen: () => void;
  onPlan: () => void;
  onRelation: () => void;
  onEvaluation: () => void;
  onAcceptation?: () => void;
}) {
  const raccourcis = [
    { label: `Ouvrir ${nom}`, action: onOpen, icone: <IconeAfficher /> },
    { label: `Plan d’action de ${nom}`, action: onPlan, icone: <IconeActions /> },
    { label: `Liens et preuves de ${nom}`, action: onRelation, icone: <IconeLiens /> },
  ];
  return (
    <Group gap="2xs" wrap="wrap" className="risques-commandes">
      {raccourcis.map(({ label, action, icone }) => (
        <Tooltip
          key={label}
          label={label}
          withArrow
          openDelay={250}
          events={{ hover: true, focus: true, touch: false }}
        >
          <ActionIcon variant="default" className="risque-commande" aria-label={label} onClick={action}>
            {icone}
          </ActionIcon>
        </Tooltip>
      ))}
      <Tooltip
        label={`Apprécier / réévaluer ${nom}`}
        withArrow
        openDelay={250}
        events={{ hover: true, focus: true, touch: false }}
      >
        <Button
          size="xs"
          variant="light"
          className="risque-action-explicite"
          aria-label={`Apprécier / réévaluer ${nom}`}
          onClick={onEvaluation}
        >
          Évaluer
        </Button>
      </Tooltip>
      {onAcceptation && (
        <Tooltip
          label={`Décider de l’acceptation de ${nom}`}
          withArrow
          openDelay={250}
          events={{ hover: true, focus: true, touch: false }}
        >
          <Button
            size="xs"
            variant="light"
            className="risque-action-explicite"
            aria-label={`Décider de l’acceptation de ${nom}`}
            onClick={onAcceptation}
          >
            Décider
          </Button>
        </Tooltip>
      )}
    </Group>
  );
}

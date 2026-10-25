/* Détail d'une sous-action : attendu, exemple de livrable, accès au module et travaux déjà présents. Les dépliages sont de
   l'état d'interface : ils ne modifient aucun objet et n'ont aucun effet sur une revue. */
import { Anchor, Badge, Button, Group, Stack, Text } from '@mantine/core';
import { Link } from 'react-router';
import { GRC_LABELS, type EtapeParcours, type SousActionParcours } from '@suivi/shared';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { lienModule, resoudreDestination } from './destinations';
import { LIBELLE_PRESENCE, presence, type TravauxDuType } from './travaux';

const COULEUR_PRESENCE = {
  presents: 'teal',
  aucun: 'gray',
  chargement: 'gray',
  indisponible: 'orange',
  'non-compte': 'gray',
} as const;

export function TravauxPresents({
  smsi,
  sousAction,
  travaux,
}: {
  smsi: string;
  sousAction: SousActionParcours;
  travaux: Record<string, TravauxDuType>;
}) {
  const dest = resoudreDestination(sousAction.vers);
  const can = useCan();
  const peutOuvrir = !!dest && can(dest.module, 'lire');
  if (!sousAction.kinds.length)
    return (
      <Text size="sm" c="dimmed">
        Les travaux de cette sous-action ne sont pas comptés ici : ouvrez le module pour les consulter.
      </Text>
    );
  const liste = sousAction.kinds.map((k) => travaux[k]).filter((t): t is TravauxDuType => !!t);
  const plusieurs = liste.reduce((n, t) => n + (t.etat === 'ok' ? (t.total ?? 0) : 0), 0) > 1;
  return (
    <Stack gap="xs" role="group" aria-label="Travaux déjà présents dans le périmètre">
      <Text fw={600} size="sm">
        Travaux déjà présents dans ce périmètre
      </Text>
      {liste.map((t) => (
        <Stack key={t.kind} gap="xs">
          <Text size="sm">
            {GRC_LABELS[t.kind]} : {t.etat === 'chargement' && 'relecture en cours…'}
            {t.etat === 'refuse' && 'vous n’avez pas le droit de consulter ces fiches.'}
            {t.etat === 'erreur' && 'relevé impossible pour le moment.'}
            {t.etat === 'ok' && (t.total ? `${t.total} élément${t.total > 1 ? 's' : ''}` : 'aucun élément')}
          </Text>
          {t.etat === 'erreur' && <ErrorAlert error={t.erreur} />}
          {t.etat === 'ok' && t.elements.length > 0 && (
            <ul className="parcours-travaux">
              {t.elements.map((o) => (
                <li key={o.id}>
                  {peutOuvrir && dest ? (
                    <Anchor component={Link} to={lienModule(dest, smsi, o.id)}>
                      {o.name}
                    </Anchor>
                  ) : (
                    o.name
                  )}
                </li>
              ))}
            </ul>
          )}
          {t.etat === 'ok' && (t.total ?? 0) > t.elements.length && (
            <Text size="xs" c="dimmed">
              {t.total! - t.elements.length} autre(s) dans le module.
            </Text>
          )}
        </Stack>
      ))}
      {plusieurs && (
        <Text size="xs" c="dimmed">
          Plusieurs éléments existent : le parcours n’en choisit aucun. Ouvrez celui qui correspond à votre travail ; il
          garde son identifiant, sa version et ses droits dans le module.
        </Text>
      )}
      {liste.length > 0 && liste.every((t) => t.etat === 'ok' && !t.total) && (
        <Text size="xs" c="dimmed">
          Aucun travail trouvé : créez-le dans le module, il apparaîtra ici avec le même identifiant.
        </Text>
      )}
    </Stack>
  );
}

export function SousActionDetail({
  smsi,
  etape,
  sousAction,
  travaux,
  ouverte,
  onBascule,
  idPrefixe,
}: {
  smsi: string;
  etape: EtapeParcours;
  sousAction: SousActionParcours;
  travaux: Record<string, TravauxDuType>;
  ouverte: boolean;
  onBascule: () => void;
  idPrefixe: string;
}) {
  const can = useCan();
  const dest = resoudreDestination(sousAction.vers);
  const p = presence(travaux, sousAction.kinds);
  const idPanneau = `${idPrefixe}-${sousAction.id}`;
  return (
    <div className="parcours-sousaction" data-ouverte={ouverte || undefined}>
      <button
        type="button"
        className="parcours-sousaction__titre"
        aria-expanded={ouverte}
        aria-controls={ouverte ? idPanneau : undefined}
        onClick={onBascule}
        data-sousaction={sousAction.id}
      >
        <span className="parcours-sousaction__texte">
          <b>{sousAction.titre}</b>
          <small>{sousAction.description}</small>
        </span>
        <Badge variant="light" color={COULEUR_PRESENCE[p]} className="parcours-sousaction__presence">
          {LIBELLE_PRESENCE[p]}
        </Badge>
        <span className="parcours-chevron" aria-hidden="true">
          {ouverte ? '−' : '+'}
        </span>
      </button>
      {ouverte && (
        <Stack gap="sm" id={idPanneau} className="parcours-sousaction__contenu">
          <div>
            <Text fw={600} size="sm">
              L’attendu
            </Text>
            <Text size="sm">{sousAction.attendu}</Text>
          </div>
          <div>
            <Text fw={600} size="sm">
              Exemple de livrable
            </Text>
            <Text size="sm">{sousAction.livrable}</Text>
            <Text size="xs" c="dimmed">
              Format proposé, non imposé par la norme. Repère préparé : {etape.reperes[sousAction.repere]}.
            </Text>
          </div>
          <TravauxPresents smsi={smsi} sousAction={sousAction} travaux={travaux} />
          {dest && (
            <Group>
              {can(dest.module, 'lire') ? (
                <Button component={Link} to={lienModule(dest, smsi)} variant="light">
                  Ouvrir : {dest.libelle}
                </Button>
              ) : (
                <Text size="sm" c="dimmed">
                  Module « {dest.libelle} » : vous n’avez pas le droit de le consulter.
                </Text>
              )}
            </Group>
          )}
        </Stack>
      )}
    </div>
  );
}

/* Carte compacte de l'étape sélectionnée (en haut à droite de l'arbre) : sous-actions, accès au module et à la fiche détaillée.
   Elle se ferme par sa croix, par un clic sur le fond de l'arbre ou par Échap ; la fermer ne change aucune donnée. Un clic sur
   le cercle parent la rouvre. */
import { Anchor, Badge, Button, Group, Stack, Text } from '@mantine/core';
import { Link } from 'react-router';
import { etapeParcours, sousActionsDuRaccourci, type RaccourciParcours } from '@suivi/shared';
import { useCan } from '../session';
import { lienModule, resoudreDestination } from './destinations';
import { POINTS } from './geometrie';
import { iconeParcours } from './icones';
import { LIBELLE_PRESENCE, presence, type TravauxDuType } from './travaux';

export function CarteCompacte({
  smsi,
  raccourci,
  travaux,
  onFermer,
  onSousAction,
  onEtape,
}: {
  smsi: string;
  raccourci: RaccourciParcours;
  travaux: Record<string, TravauxDuType>;
  onFermer: () => void;
  onSousAction: (id: string) => void;
  onEtape: () => void;
}) {
  const can = useCan();
  const etape = etapeParcours(raccourci.etape)!;
  const sous = sousActionsDuRaccourci(raccourci);
  const pres = presence(
    travaux,
    sous.flatMap((s) => s.kinds),
  );
  const dest = resoudreDestination(sous[0]!.vers);
  return (
    <section className="parcours-carte" data-branche={POINTS[raccourci.id]!.branche} aria-label="Étape sélectionnée">
      <button type="button" className="parcours-carte__fermer" aria-label="Fermer la carte" onClick={onFermer}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4L12 12M12 4L4 12" />
        </svg>
      </button>
      <Group gap="sm" wrap="nowrap" className="parcours-carte__entete">
        <svg className="parcours-carte__icone" viewBox="0 0 24 24" aria-hidden="true">
          <path d={iconeParcours(raccourci.icone)} />
        </svg>
        <Stack gap="xs">
          <Text fw={700}>{raccourci.libelle}</Text>
          <Badge variant="light" color={pres === 'presents' ? 'teal' : pres === 'indisponible' ? 'orange' : 'gray'}>
            {LIBELLE_PRESENCE[pres]}
          </Badge>
        </Stack>
      </Group>
      <Text size="xs" c="dimmed">
        {etape.titre} · {etape.reference}
      </Text>
      <Stack gap="xs" role="list" aria-label="Sous-actions">
        {sous.map((s) => (
          <button
            key={s.id}
            type="button"
            role="listitem"
            className="parcours-carte__ligne"
            onClick={() => onSousAction(s.id)}
          >
            <span className="parcours-carte__ligne-texte">
              <b>{s.titre}</b>
              <small>{s.description}</small>
            </span>
            <span className="parcours-carte__voir">Voir l’attendu ›</span>
          </button>
        ))}
      </Stack>
      <Group gap="sm">
        {dest && can(dest.module, 'lire') && (
          <Anchor component={Link} to={lienModule(dest, smsi)} size="sm">
            → Ouvrir : {dest.libelle}
          </Anchor>
        )}
        <Button variant="light" size="compact-sm" onClick={onEtape}>
          Détail de l’étape →
        </Button>
      </Group>
    </section>
  );
}

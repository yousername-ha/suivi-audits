/* Jours de fond derrière les tâches (018-09) : jours fériés et jours d'autres calendriers de plateforme (ADR 0047), affichés
   dans le Calendrier et la Timeline. Chaque famille a sa propre bascule. Le fond n'est qu'un repère : l'afficher ou le
   masquer ne change ni une échéance, ni une occurrence, ni la possibilité de réaliser une tâche un jour exclu. */
import { Checkbox, Group, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { CalendrierPlateformeDto, JourCalendrierDto } from '@suivi/shared';
import { get } from '../api';

export type FamilleFond = 'feries' | 'autres';
export interface JourFond {
  date: string;
  famille: FamilleFond;
  calendrier: string;
  label: string;
}

/** Jours à afficher pour les familles choisies, triés par date. Un jour sans libellé garde le nom de son calendrier. */
export function joursDeFond(
  calendriers: readonly Pick<CalendrierPlateformeDto, 'id' | 'name' | 'kind'>[],
  jours: ReadonlyMap<string, readonly Pick<JourCalendrierDto, 'date' | 'label'>[]>,
  actives: Readonly<Record<FamilleFond, boolean>>,
): JourFond[] {
  const sortie: JourFond[] = [];
  for (const c of calendriers) {
    const famille: FamilleFond = c.kind === 'feries' ? 'feries' : 'autres';
    if (!actives[famille]) continue;
    for (const j of jours.get(c.id) ?? [])
      sortie.push({ date: j.date, famille, calendrier: c.name, label: j.label?.trim() || c.name });
  }
  return sortie.sort((a, b) => a.date.localeCompare(b.date) || a.calendrier.localeCompare(b.calendrier, 'fr'));
}

/** Jours de fond des familles actives ; ne charge rien tant qu'aucune n'est cochée. */
export function useJoursDeFond(actives: Readonly<Record<FamilleFond, boolean>>) {
  const voulu = actives.feries || actives.autres;
  const calendriers = useQuery({
    queryKey: ['calendriers-plateforme'],
    queryFn: () => get<CalendrierPlateformeDto[]>('/api/calendriers-plateforme'),
    enabled: voulu,
  });
  const pertinents = (calendriers.data ?? []).filter((c) => actives[c.kind === 'feries' ? 'feries' : 'autres']);
  const jours = useQuery({
    queryKey: ['calendriers-plateforme', 'jours', pertinents.map((c) => c.id).join(',')],
    queryFn: async () =>
      new Map(
        await Promise.all(
          pertinents.map(
            async (c) => [c.id, await get<JourCalendrierDto[]>(`/api/calendriers-plateforme/${c.id}/jours`)] as const,
          ),
        ),
      ),
    enabled: voulu && !!calendriers.data,
  });
  const liste = voulu && jours.data ? joursDeFond(pertinents, jours.data, actives) : [];
  return {
    jours: liste,
    charge: !voulu || (!!calendriers.data && !!jours.data),
    erreur: calendriers.error ?? jours.error,
  };
}

/** Deux bascules distinctes : jours fériés, autres calendriers (fermetures). */
export function BasculesFond({
  actives,
  onChange,
}: {
  actives: Readonly<Record<FamilleFond, boolean>>;
  onChange: (famille: FamilleFond, actif: boolean) => void;
}) {
  return (
    <Group gap="md" role="group" aria-label="Jours affichés en fond derrière les tâches">
      <Checkbox
        label="Jours fériés en fond"
        checked={actives.feries}
        onChange={(e) => onChange('feries', e.currentTarget.checked)}
      />
      <Checkbox
        label="Autres calendriers en fond"
        checked={actives.autres}
        onChange={(e) => onChange('autres', e.currentTarget.checked)}
      />
      <Text size="xs" c="dimmed">
        Le fond est un repère : le masquer ou l’afficher ne change aucune échéance ni aucune occurrence.
      </Text>
    </Group>
  );
}

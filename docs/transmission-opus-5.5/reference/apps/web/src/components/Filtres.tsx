/* Bouton « Filtres » des listes : ouvre un panneau de critères et affiche le nombre de filtres actifs. */
import { Badge, Button, Group, Popover, Stack } from '@mantine/core';
import type { ReactNode } from 'react';

export function Filtres({
  actifs,
  onReinitialiser,
  children,
}: {
  actifs: number;
  onReinitialiser: () => void;
  children: ReactNode;
}) {
  return (
    <Popover position="bottom-start" shadow="md" trapFocus withArrow>
      <Popover.Target>
        <Button variant="default" aria-label={actifs ? `Filtres (${actifs} actif${actifs > 1 ? 's' : ''})` : 'Filtres'}>
          <Group gap="xs" wrap="nowrap" component="span">
            Filtres
            {actifs > 0 && (
              <Badge size="sm" circle>
                {actifs}
              </Badge>
            )}
          </Group>
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
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

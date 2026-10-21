/* Périodicité d'une série (dossier 018) : sept préréglages ou personnalisée, avec l'aperçu des prochaines échéances
   calculées par le moteur de récurrence (fins de mois, fuseau, jours exclus). Il écrit l'unité et l'intervalle ; les autres
   réglages de la série restent ceux de la fiche. */
import { Group, NumberInput, Select, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import {
  apercuOccurrences,
  appliquerPeriodicite,
  PERIODICITE_PERSONNALISEE,
  PERIODICITES,
  periodiciteDe,
  UNITES_LABELS,
  type Recurrence,
} from '@suivi/shared';

const jourFr = (iso: string) => iso.split('-').reverse().join('/');

export function SelecteurPeriodicite({
  value,
  onChange,
  disabled,
}: {
  value: Recurrence;
  onChange: (r: Recurrence) => void;
  disabled?: boolean;
}) {
  // « Personnalisée » est un mode choisi par la personne : l'unité et l'intervalle courants peuvent encore correspondre à un
  // préréglage (ex. tous les 3 mois) sans qu'elle ait quitté la saisie libre.
  const [libre, setLibre] = useState(false);
  const choix = libre ? PERIODICITE_PERSONNALISEE : periodiciteDe(value);
  const apercu = apercuOccurrences(value, 5);
  return (
    <Stack gap="xs">
      <Group align="end">
        <Select
          label="Périodicité"
          description="« Tous les deux mois » : une échéance tous les deux mois. Deux fois par mois : créez deux séries."
          allowDeselect={false}
          data={[
            ...PERIODICITES.map((p) => ({ value: p.id, label: p.label })),
            { value: PERIODICITE_PERSONNALISEE, label: 'Personnalisée' },
          ]}
          value={choix}
          onChange={(v) => {
            if (!v) return;
            setLibre(v === PERIODICITE_PERSONNALISEE);
            onChange(appliquerPeriodicite(value, v));
          }}
          disabled={disabled}
        />
        {choix === PERIODICITE_PERSONNALISEE && (
          <>
            <NumberInput
              label="Tous les"
              min={1}
              max={365}
              allowDecimal={false}
              value={value.interval}
              onChange={(v) => typeof v === 'number' && v >= 1 && onChange({ ...value, interval: v })}
              disabled={disabled}
            />
            <Select
              label="Unité"
              allowDeselect={false}
              data={(Object.keys(UNITES_LABELS) as Recurrence['unit'][]).map((u) => ({
                value: u,
                label: UNITES_LABELS[u],
              }))}
              value={value.unit}
              onChange={(v) => v && onChange({ ...value, unit: v as Recurrence['unit'] })}
              disabled={disabled}
            />
          </>
        )}
      </Group>
      <Text size="sm" fw={600}>
        Prochaines échéances
      </Text>
      {apercu.length ? (
        <ul aria-label="Aperçu des prochaines échéances" data-testid="apercu-echeances">
          {apercu.map((o) => (
            <li key={o.dueAt}>
              {jourFr(o.local)} à {value.time}
              {o.decalee ? ' (reportée : jour exclu)' : ''}
            </li>
          ))}
        </ul>
      ) : (
        <Text size="sm">Aucune échéance à venir avec ces réglages.</Text>
      )}
    </Stack>
  );
}

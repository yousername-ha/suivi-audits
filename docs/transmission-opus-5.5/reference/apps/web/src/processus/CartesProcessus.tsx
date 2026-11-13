/* Requêtes et sélection conservées ; Studio présente la lecture, le formulaire existant conserve les écritures. */
import { Button, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { rendreFocusFiche } from '@suivi/ui';
import type { ProcessusCartes } from '@suivi/shared';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { FicheCarteProcessus, NouveauProcessus } from './FicheCarteProcessus';
import { useTypesProcessus } from './types';
import { ProcessusStudio } from './ProcessusStudio';
import { ProcessusPresentation } from './ProcessusPresentation';

export const CARTES_PROCESSUS_KEY = (smsi: string) => ['grc', smsi, 'processus-cartes'] as const;
export function CartesProcessus({ smsi, scopeName = 'Périmètre sélectionné' }: { smsi: string; scopeName?: string }) {
  const can = useCan();
  const q = useQuery({
    queryKey: CARTES_PROCESSUS_KEY(smsi),
    queryFn: () => get<ProcessusCartes>(`/api/grc/${smsi}/pilotage/processus-cartes`),
  });
  const types = useTypesProcessus();
  const [selection, setSelection] = useState<string | null>(null),
    [edition, setEdition] = useState(false),
    [creation, setCreation] = useState(false);
  const modifier = can('pilotage', 'modifier');
  const courante = q.data?.processus.find((p) => p.id === selection);
  const donnees = q.data ? { ...q.data, types: q.data.types ?? types.data ?? [] } : null;
  const close = () => {
    setSelection(null);
    setEdition(false);
    requestAnimationFrame(rendreFocusFiche);
  };
  return (
    <Stack className="pr-registry-shell">
      <ErrorAlert error={q.error} />
      {q.isPending && <Text role="status">Chargement des processus…</Text>}
      {q.isError && (
        <Button variant="default" onClick={() => void q.refetch()}>
          Réessayer le chargement des processus
        </Button>
      )}
      {donnees && (
        <ProcessusStudio
          donnees={donnees}
          scopeName={scopeName}
          modifiable={modifier}
          onOpen={(id) => {
            setSelection(id);
            setEdition(false);
          }}
          onCreate={() => setCreation(true)}
        />
      )}
      {courante &&
        donnees &&
        (edition && modifier ? (
          <FicheCarteProcessus
            key={courante.id}
            smsi={smsi}
            carte={courante}
            donnees={donnees}
            modifiable={modifier}
            onClose={close}
            onCancel={() => setEdition(false)}
            onSaved={() => setEdition(false)}
          />
        ) : (
          <ProcessusPresentation
            key={courante.id}
            carte={courante}
            donnees={donnees}
            onClose={close}
            onModify={modifier ? () => setEdition(true) : undefined}
          />
        ))}
      {creation && donnees && modifier && (
        <NouveauProcessus
          smsi={smsi}
          types={donnees.types}
          processus={donnees.processus}
          onClose={() => {
            setCreation(false);
            requestAnimationFrame(rendreFocusFiche);
          }}
          onCree={(id) => {
            setCreation(false);
            setSelection(id);
            setEdition(false);
          }}
        />
      )}
    </Stack>
  );
}

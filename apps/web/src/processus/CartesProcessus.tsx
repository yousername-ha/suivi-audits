/* Processus en cartes (Organisation) : une carte par processus, classées par type du registre de la Plateforme, avec leurs
   sous-processus. Une carte ouvre sa consultation (refonte Neon, lot 5, ADR 0093 : lecture distincte), puis le formulaire
   existant sur demande : identité (type, pilote, finalité) et rattachements (objectifs, indicateurs, SWOT, risques,
   fournisseurs). Les rattachements restent à leur source ; la cartographie se génère de ces mêmes processus. La requête,
   la création et les écritures sont inchangées ; ProcessusStudio ne fait que présenter. */
import { Button, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { rendreFocusFiche } from '@suivi/ui';
import type { ProcessusCartes } from '@suivi/shared';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { usePerimetres } from '../components/selecteurs';
import { useCan } from '../session';
import { FicheCarteProcessus, NouveauProcessus } from './FicheCarteProcessus';
import { useTypesProcessus } from './types';
import { ProcessusStudio } from './ProcessusStudio';
import { ProcessusPresentation } from './ProcessusPresentation';

export const CARTES_PROCESSUS_KEY = (smsi: string) => ['grc', smsi, 'processus-cartes'] as const;

export function CartesProcessus({ smsi }: { smsi: string }) {
  const can = useCan();
  const q = useQuery({
    queryKey: CARTES_PROCESSUS_KEY(smsi),
    queryFn: () => get<ProcessusCartes>(`/api/grc/${smsi}/pilotage/processus-cartes`),
  });
  const types = useTypesProcessus();
  const nomPerimetre = usePerimetres().data?.find((p) => p.id === smsi)?.name;
  const [selection, setSelection] = useState<string | null>(null),
    [edition, setEdition] = useState(false),
    [creation, setCreation] = useState(false);
  const modifier = can('pilotage', 'modifier');
  const courante = q.data?.processus.find((p) => p.id === selection) ?? null;
  const donnees: ProcessusCartes | null = q.data ? { ...q.data, types: q.data.types ?? types.data ?? [] } : null;
  // Les fenêtres sont démontées à la fermeture (pas de transition de sortie) : le focus est rendu explicitement.
  const fermer = () => {
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
          scopeName={nomPerimetre || 'Périmètre sélectionné'}
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
            onClose={fermer}
            onCancel={() => setEdition(false)}
            onSaved={() => setEdition(false)}
          />
        ) : (
          <ProcessusPresentation
            key={courante.id}
            carte={courante}
            donnees={donnees}
            onClose={fermer}
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
            // Comme une création du registre, le processus créé s'ouvre directement dans son formulaire (rattachements).
            setCreation(false);
            setSelection(id);
            setEdition(true);
          }}
        />
      )}
    </Stack>
  );
}

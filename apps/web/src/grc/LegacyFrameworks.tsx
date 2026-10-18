import { Alert, Anchor, Button, Card, Stack, Text, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
/** Vue de la source historique existante : aucun référentiel ni exigence recopié. */
export function LegacyFrameworks({ smsi }: { smsi: string }) {
  const can = useCan(),
    [search, setSearch] = useState(''),
    [limit, setLimit] = useState(50);
  const state = useQuery({
    queryKey: ['grc', smsi, 'legacy-frameworks'],
    queryFn: () =>
      get<{
        frameworks?: {
          id: string;
          name: string;
          version?: string;
          source?: string;
          requirements?: { id: string; text?: string }[];
        }[];
        items?: { id: string; ref: string; title: string }[];
        activeFw?: string;
      }>('/api/suivi/etat'),
    enabled: smsi === '00000000-0000-4000-8000-000000000001',
  });
  if (smsi !== '00000000-0000-4000-8000-000000000001') return null;
  const items = (state.data?.items ?? []).filter((i) =>
    (i.id + ' ' + i.title).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Stack>
      <Alert>
        Socle historique de l’instance : ces données sont relues depuis leur source v2 et restent liées aux objets de
        pilotage sans copie éditable. Leur provenance est celle de l’import d’origine.
      </Alert>
      <ErrorAlert error={state.error} />
      {(state.data?.frameworks ?? []).map((f) => (
        <Card key={f.id} withBorder>
          <Text fw={600}>
            {f.name} · {f.version}
          </Text>
          <Text>
            {f.id === state.data?.activeFw ? 'Actif dans le socle historique' : 'Conservé dans le socle historique'} ·{' '}
            {f.requirements?.length ?? 0} exigences
          </Text>
          <Text size="sm">{f.source}</Text>
          <Anchor href="/legacy/">Consulter le référentiel historique</Anchor>
        </Card>
      ))}
      {can('audit', 'lire') && (
        <>
          <Text fw={600}>Exigences ISO/HDS et mesures historiques</Text>
          <TextInput
            label="Rechercher une exigence historique"
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              setLimit(50);
            }}
          />
          {items.slice(0, limit).map((i) => (
            <Card withBorder key={i.id}>
              <Text>
                {i.id} · {i.title}
              </Text>
              <Text size="sm">Référence liée : legacy:items:{i.id}</Text>
            </Card>
          ))}
          {items.length > limit && (
            <Button variant="subtle" onClick={() => setLimit((n) => n + 50)}>
              Afficher 50 exigences historiques supplémentaires
            </Button>
          )}
        </>
      )}
    </Stack>
  );
}

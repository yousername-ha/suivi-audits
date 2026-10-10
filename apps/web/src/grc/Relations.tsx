import { Button, Card, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
export function Relations({ smsi, source }: { smsi: string; source: string }) {
  const qc = useQueryClient(),
    [search, setSearch] = useState(''),
    [target, setTarget] = useState<string | null>(null),
    [type, setType] = useState('related_to'),
    [note, setNote] = useState(''),
    [error, setError] = useState<unknown>(null);
  const options = useQuery({
    queryKey: ['grc', smsi, 'sources', search],
    queryFn: () =>
      get<{ items: { ref: string; name: string; kind: string }[] }>(
        `/api/grc/${smsi}/sources?search=${encodeURIComponent(search)}`,
      ),
  });
  const links = useQuery({
    queryKey: ['grc', smsi, 'links', source],
    queryFn: () =>
      get<
        {
          id: string;
          type: string;
          note: string;
          derived?: boolean;
          other: { ref: string; name: string; kind: string };
        }[]
      >(`/api/grc/${smsi}/links?ref=${encodeURIComponent(source)}`),
  });
  const save = async () => {
    try {
      setError(null);
      await api('POST', `/api/grc/${smsi}/links`, { body: { source, target, type, note } });
      await qc.invalidateQueries({ queryKey: ['grc', smsi] });
      setTarget(null);
    } catch (e) {
      setError(e);
    }
  };
  return (
    <Stack>
      <Text fw={600}>Relations bidirectionnelles et justificatifs</Text>
      <Text size="sm">
        Sélectionnez les données existantes, y compris une version précise de document. Aucune copie n’est créée.
      </Text>
      <ErrorAlert error={error ?? options.error ?? links.error} />
      <TextInput label="Rechercher un objet lié" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
      <Select
        label="Objet ou version de preuve"
        searchable
        value={target}
        onChange={setTarget}
        data={(options.data?.items ?? [])
          .filter((r) => r.ref !== source)
          .map((r) => ({ value: r.ref, label: r.name + ' · ' + r.kind }))}
      />
      <Select
        label="Type de relation"
        value={type}
        onChange={(v) => setType(v ?? 'related_to')}
        data={[
          { value: 'related_to', label: 'Lié à' },
          { value: 'supports', label: 'Supporte' },
          { value: 'impacts', label: 'Impacte' },
          { value: 'applies_to', label: 'S’applique à' },
          { value: 'depends_on', label: 'Dépend de' },
          { value: 'implements', label: 'Met en œuvre' },
          { value: 'demonstrates', label: 'Démontre' },
          { value: 'treats', label: 'Traite' },
        ]}
      />
      <Textarea label="Justification du lien" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      <Button disabled={!target} onClick={() => void save()}>
        Enregistrer la relation
      </Button>
      {links.data?.map((l) => (
        <Card withBorder key={l.id}>
          <Text>
            {l.other.name} · {l.other.kind}
          </Text>
          <Text>
            {l.type} · {l.note}
          </Text>
          {l.derived ? (
            <Text size="sm">Modifier cette référence dans la fiche source.</Text>
          ) : (
            <Button
              variant="subtle"
              onClick={async () => {
                try {
                  await api('DELETE', `/api/grc/${smsi}/links/${l.id}`);
                  await qc.invalidateQueries({ queryKey: ['grc', smsi] });
                } catch (e) {
                  setError(e);
                }
              }}
            >
              Retirer la relation
            </Button>
          )}
        </Card>
      ))}
    </Stack>
  );
}

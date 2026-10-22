/* Processus en cartes (Organisation) : une carte par processus, classées par type du registre de la Plateforme, avec leurs
   sous-processus. Une carte ouvre sa fiche : identité (type, pilote, finalité) et rattachements (objectifs, indicateurs, SWOT,
   risques, fournisseurs). Les rattachements restent à leur source ; la cartographie se génère de ces mêmes processus. */
import { Badge, Button, Card, Collapse, Group, Select, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  LIBELLES_RATTACHEMENT,
  NATURES_RATTACHEMENT,
  type CarteProcessus,
  type ProcessusCartes,
  type TypeProcessusDto,
} from '@suivi/shared';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { FicheCarteProcessus, NouveauProcessus } from './FicheCarteProcessus';
import { useTypesProcessus } from './types';

export const CARTES_PROCESSUS_KEY = (smsi: string) => ['grc', smsi, 'processus-cartes'] as const;
const SANS_TYPE = '__sans_type__';

interface Section {
  code: string;
  type: TypeProcessusDto | null;
  racines: CarteProcessus[];
}

function MiniCompteurs({ carte }: { carte: CarteProcessus }) {
  return (
    <Group gap="xs" className="carte-processus__compteurs">
      {NATURES_RATTACHEMENT.map((n) => {
        const nb = carte.rattaches[n]?.length;
        return nb === undefined ? null : (
          <Badge key={n} size="sm" variant={nb ? 'light' : 'outline'} color={nb ? 'green' : 'gray'}>
            {LIBELLES_RATTACHEMENT[n]} {nb}
          </Badge>
        );
      })}
    </Group>
  );
}

function CarteSimple({
  carte,
  enfants,
  ouvrir,
  ouverte,
  bascule,
}: {
  carte: CarteProcessus;
  enfants: CarteProcessus[];
  ouvrir: (id: string) => void;
  ouverte: boolean;
  bascule: () => void;
}) {
  return (
    <Card withBorder className="carte-processus">
      <button type="button" className="carte-processus__corps" onClick={() => ouvrir(carte.id)}>
        <Text size="xs" c="dimmed" className="mono">
          {carte.id}
        </Text>
        <Title order={3} size="h4">
          {carte.name}
        </Title>
        <Text size="sm" c="dimmed">
          {carte.owner ? `Pilote : ${carte.owner}` : 'Pilote non renseigné'}
        </Text>
        {carte.purpose && (
          <Text size="sm" className="carte-processus__finalite">
            {carte.purpose}
          </Text>
        )}
        <MiniCompteurs carte={carte} />
      </button>
      {enfants.length > 0 && (
        <>
          <Button
            variant="subtle"
            size="compact-sm"
            aria-expanded={ouverte}
            onClick={bascule}
            className="carte-processus__bascule"
          >
            {ouverte ? 'Masquer' : 'Afficher'} les sous-processus ({enfants.length})
          </Button>
          <Collapse expanded={ouverte}>
            <Stack gap="xs" className="carte-processus__enfants">
              {enfants.map((e) => (
                <button key={e.id} type="button" className="carte-processus__enfant" onClick={() => ouvrir(e.id)}>
                  <Text size="xs" c="dimmed" className="mono">
                    {e.id}
                  </Text>
                  <Text size="sm" fw={600}>
                    {e.name}
                  </Text>
                  <MiniCompteurs carte={e} />
                </button>
              ))}
            </Stack>
          </Collapse>
        </>
      )}
    </Card>
  );
}

export function CartesProcessus({ smsi }: { smsi: string }) {
  const can = useCan();
  const q = useQuery({
    queryKey: CARTES_PROCESSUS_KEY(smsi),
    queryFn: () => get<ProcessusCartes>(`/api/grc/${smsi}/pilotage/processus-cartes`),
  });
  const types = useTypesProcessus();
  const [recherche, setRecherche] = useState('');
  const [filtreType, setFiltreType] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);
  const [deplies, setDeplies] = useState<Record<string, boolean>>({});
  const modifier = can('pilotage', 'modifier');

  const registre = useMemo(() => q.data?.types ?? types.data ?? [], [q.data, types.data]);
  const sections = useMemo<Section[]>(() => {
    const tous = q.data?.processus ?? [];
    const filtre = recherche.trim().toLowerCase();
    const visibles = tous.filter(
      (p) =>
        (!filtreType || (p.family || SANS_TYPE) === filtreType) &&
        (!filtre || `${p.id} ${p.name} ${p.owner} ${p.purpose}`.toLowerCase().includes(filtre)),
    );
    const racines = visibles.filter((p) => !p.parent || !tous.some((x) => x.id === p.parent));
    const parCode = new Map<string, CarteProcessus[]>();
    for (const p of racines) parCode.set(p.family || SANS_TYPE, [...(parCode.get(p.family || SANS_TYPE) ?? []), p]);
    const out: Section[] = registre
      .filter((t) => parCode.has(t.code))
      .map((t) => ({ code: t.code, type: t, racines: parCode.get(t.code)! }));
    for (const [code, liste] of parCode)
      if (!registre.some((t) => t.code === code)) out.push({ code, type: null, racines: liste });
    return out;
  }, [q.data, registre, recherche, filtreType]);

  const tous = q.data?.processus ?? [];
  const enfantsDe = (id: string) => tous.filter((p) => p.parent === id);
  const courante = tous.find((p) => p.id === selection) ?? null;

  return (
    <Stack>
      <ErrorAlert error={q.error} />
      <Group align="flex-end">
        <TextInput
          label="Rechercher"
          placeholder="code, nom, pilote, finalité"
          value={recherche}
          onChange={(e) => setRecherche(e.currentTarget.value)}
        />
        <Select
          label="Type"
          clearable
          placeholder="Tous les types"
          data={[...registre.map((t) => ({ value: t.code, label: t.label })), { value: SANS_TYPE, label: 'Sans type' }]}
          value={filtreType}
          onChange={setFiltreType}
        />
        {modifier && <Button onClick={() => setCreation(true)}>Nouveau processus</Button>}
      </Group>
      {q.data && !tous.length && (
        <Text c="dimmed">
          Aucun processus pour l’instant. Créez le premier, ou dessinez-le depuis la cartographie : il apparaîtra ici.
        </Text>
      )}
      {sections.map((s) => (
        <section key={s.code} aria-label={s.type?.label ?? 'Sans type'} className="section-processus">
          <Group gap="xs" className="section-processus__titre">
            <span className="pastille-teinte" data-teinte={s.type?.tint ?? 'gris'} aria-hidden="true" />
            <Title order={2} size="h3">
              {s.type?.label ?? (s.code === SANS_TYPE ? 'Sans type' : s.code)}
              {s.type?.archived ? ' (type archivé)' : ''}
            </Title>
            <Badge variant="light" color="gray">
              {s.racines.length}
            </Badge>
          </Group>
          {s.type?.description && (
            <Text size="sm" c="dimmed">
              {s.type.description}
            </Text>
          )}
          <SimpleGrid
            cols={{ base: 1, sm: 2, lg: 3 }}
            className="grille-processus"
            data-teinte={s.type?.tint ?? 'gris'}
          >
            {s.racines.map((p) => (
              <CarteSimple
                key={p.id}
                carte={p}
                enfants={enfantsDe(p.id)}
                ouvrir={setSelection}
                ouverte={!!deplies[p.id]}
                bascule={() => setDeplies((d) => ({ ...d, [p.id]: !d[p.id] }))}
              />
            ))}
          </SimpleGrid>
        </section>
      ))}
      {courante && q.data && (
        <FicheCarteProcessus
          smsi={smsi}
          carte={courante}
          donnees={q.data}
          modifiable={modifier}
          onClose={() => setSelection(null)}
        />
      )}
      {creation && q.data && (
        <NouveauProcessus
          smsi={smsi}
          types={registre}
          processus={tous}
          onClose={() => setCreation(false)}
          onCree={(id) => {
            setCreation(false);
            setSelection(id);
          }}
        />
      )}
    </Stack>
  );
}

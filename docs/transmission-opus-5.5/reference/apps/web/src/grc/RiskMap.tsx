import { Alert, Button, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { GrcObject, RiskMethod } from '@suivi/shared';
import { computeScene, emptyLayout, type CartoObject, type MapLayout, type ObjectLookup } from '@suivi/shared/carto';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { Canevas, fitViewport, type Viewport, type Selection } from '../carto/Canevas';
import { exporter } from '../carto/exports';
import type { MethodVersion } from './Risks';
import { MatriceRisques } from './MatriceRisques';
import { useCan } from '../session';
export interface Projection {
  items: (GrcObject & {
    method: RiskMethod | null;
    assessment: {
      result: Record<
        'gross' | 'residual',
        { label: string; color: string; level: string; acceptability: string; score: number | null }
      >;
      ratings: Record<'gross' | 'residual', { dimensions: Record<string, string>; likelihood: string }>;
      revision: number;
      method_version_id: string;
      decision: string;
      created_at: string;
    } | null;
    comparison: { compatible: boolean; result: Record<string, unknown> } | null;
  })[];
  nodes: { ref: string; name: string; kind: string; data: Record<string, unknown> }[];
  edges: { source_ref: string; target_ref: string; type: string }[];
  facets: Record<string, Record<string, string[]>>;
  total: number;
  truncated: boolean;
  graphTruncated: boolean;
  generatedAt: string;
  basis: 'gross' | 'residual';
}
export function RiskMap({ smsi, onOpen }: { smsi: string; onOpen: (o: GrcObject) => void }) {
  const can = useCan(),
    [basis, setBasis] = useState<'gross' | 'residual'>('residual'),
    [methodId, setMethodId] = useState<string | null>(null),
    [domain, setDomain] = useState(''),
    [entity, setEntity] = useState(''),
    [scope, setScope] = useState(''),
    [relatedRef, setRelatedRef] = useState<string | null>(null),
    [search, setSearch] = useState(''),
    [at, setAt] = useState(''),
    [compareAt, setCompareAt] = useState(''),
    [strategy, setStrategy] = useState<string | null>(null),
    [grouping, setGrouping] = useState('method'),
    [mode, setMode] = useState('graph'),
    [selected, setSelected] = useState<Selection>(null),
    [vp, setVp] = useState<Viewport>({ x: 20, y: 20, k: 0.8 }),
    [error, setError] = useState<unknown>(null);
  const filters = new URLSearchParams({
    basis,
    domain,
    entity,
    scope,
    search,
    ...(relatedRef ? { relatedRef } : {}),
    ...(methodId ? { methodId } : {}),
    ...(strategy ? { strategy } : {}),
    ...(at ? { at: at + 'T23:59:59Z' } : {}),
    ...(compareAt ? { compareAt: compareAt + 'T23:59:59Z' } : {}),
  });
  const data = useQuery({
    queryKey: ['grc', smsi, 'risk-map', filters.toString()],
    queryFn: () => get<Projection>(`/api/grc/${smsi}/risk-map?${filters}`),
  });
  const methods = useQuery({
    queryKey: ['grc', smsi, 'methods'],
    queryFn: () => get<MethodVersion[]>(`/api/grc/${smsi}/methods`),
  });
  const sceneData = useMemo(() => {
    const objects = new Map<string, CartoObject>();
    const layout: MapLayout = emptyLayout();
    const items = data.data?.items ?? [];
    const names: Record<string, string> = {
      risk: 'Risque',
      risk_source: 'Source de risque',
      feared_event: 'Événement redouté',
      business_asset: 'Valeur métier',
      support_asset: 'Bien support',
      strategic_scenario: 'Scénario stratégique',
      operational_scenario: 'Scénario opérationnel',
      treatment: 'Traitement',
    };
    for (const item of items) {
      const result = item.assessment?.result[basis];
      objects.set('object:' + item.id, {
        ref: 'object:' + item.id,
        type: 'grc',
        name: item.name,
        sub: result
          ? `${result.label}${item.method?.display.showAcceptability ? ' · ' + result.acceptability : ''}${item.method?.display.showScores && result.score !== null ? ' · ' + result.score : ''}`
          : 'À apprécier',
        code: String(item.data.code ?? ''),
        std: [],
        riskColor: result?.color,
        details: { status: result?.label },
      });
    }
    for (const node of data.data?.nodes ?? [])
      if (!objects.has(node.ref))
        objects.set(node.ref, {
          ref: node.ref,
          type: 'grc',
          name: node.name,
          sub: names[node.kind] ?? node.kind,
          std: [],
        });
    let groupIndex = 0;
    const groups = new Map<string, number>();
    const positions = new Map<string, number>();
    for (const [ref, obj] of objects) {
      const item = items.find((o) => 'object:' + o.id === ref);
      let group = item
        ? grouping === 'method'
          ? (item.method?.name ?? 'Méthode non appréciée') +
            ' · ' +
            (item.assessment?.method_version_id.slice(0, 8) ?? '')
          : String(data.data?.facets[item.id]?.[grouping]?.join(', ') || item.data[grouping] || 'Sans rattachement')
        : 'Objets liés';
      if (item && !item.method?.display.groupings.includes(grouping as RiskMethod['display']['groupings'][number]))
        group = item.method?.name ?? 'Objets liés';
      if (!groups.has(group)) groups.set(group, groupIndex++);
      const n = groups.get(group)!;
      const row = positions.get(group) ?? 0;
      positions.set(group, row + 1);
      layout.nodes[ref] = { x: n * 320, y: row * 145, w: 280, h: 120, label: obj.name };
    }
    layout.edges = (data.data?.edges ?? [])
      .filter((e) => objects.has(e.source_ref) && objects.has(e.target_ref))
      .map((e, i) => ({
        id: String(i),
        s: e.source_ref,
        t: e.target_ref,
        type: ['impacts', 'supports', 'depends_on', 'applies_to'].includes(e.type)
          ? (e.type as 'impacts' | 'supports' | 'depends_on' | 'applies_to')
          : 'related_to',
      }));
    const lookup: ObjectLookup = (ref) => objects.get(ref);
    return {
      layout,
      lookup,
      scene: computeScene(layout, 'context', lookup, [], { std: [], preset: 'all', q: '', sec: true, gen: false }),
    };
  }, [data.data, basis, grouping]);
  const exportMap = async (format: 'svg' | 'png' | 'pdf' | 'json') => {
    try {
      setError(null);
      await get(`/api/grc/${smsi}/export/authorize?kind=risks`);
      await exporter(format, {
        ...sceneData,
        source: data.data,
        view: 'context',
        organisation: 'Pilotage · décisions issues du registre',
        title: 'Cartographie des risques — ' + (basis === 'gross' ? 'bruts' : 'résiduels'),
        legend: [
          ...new Map(
            data.data?.items.filter((i) => i.method).map((i) => [i.assessment!.method_version_id, i.method!]),
          ).values(),
        ].flatMap((m) => m.levels.map((l) => ({ label: m.name + ' · ' + l.label, color: l.color }))),
        std: [],
      });
    } catch (e) {
      setError(e);
    }
  };
  return (
    <Stack>
      <Group>
        <Select
          label="Base d’appréciation"
          value={basis}
          onChange={(v) => setBasis(v === 'gross' ? 'gross' : 'residual')}
          data={[
            { value: 'gross', label: 'Risque brut' },
            { value: 'residual', label: 'Risque résiduel' },
          ]}
        />
        <Select
          label="Méthode"
          clearable
          value={methodId}
          onChange={(id) => {
            setMethodId(id);
            const method = methods.data?.find((m) => m.methodId === id);
            if (method) setBasis(method.definition.display.defaultBasis);
          }}
          data={(methods.data ?? []).map((m) => ({ value: m.methodId, label: m.definition.name }))}
        />
        <TextInput label="Domaine" value={domain} onChange={(e) => setDomain(e.currentTarget.value)} />
        <TextInput label="Périmètre" value={scope} onChange={(e) => setScope(e.currentTarget.value)} />
        <Select
          label="Objet lié"
          searchable
          clearable
          value={relatedRef}
          onChange={setRelatedRef}
          data={(data.data?.nodes ?? []).filter((n) => n.kind !== 'risk').map((n) => ({ value: n.ref, label: n.name }))}
        />
        <TextInput label="Entité" value={entity} onChange={(e) => setEntity(e.currentTarget.value)} />
        <TextInput label="Rechercher un risque" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
        <Select
          label="Stratégie de traitement"
          clearable
          value={strategy}
          onChange={setStrategy}
          data={[
            { value: 'reduce', label: 'Réduction' },
            { value: 'accept', label: 'Acceptation' },
            { value: 'transfer', label: 'Transfert' },
            { value: 'avoid', label: 'Évitement' },
            { value: 'treated', label: 'Traité' },
          ]}
        />
        <TextInput label="Appréciations au" type="date" value={at} onChange={(e) => setAt(e.currentTarget.value)} />
        <TextInput
          label="Comparer au"
          type="date"
          value={compareAt}
          onChange={(e) => setCompareAt(e.currentTarget.value)}
        />
        <Select
          label="Regroupement"
          value={grouping}
          onChange={(v) => setGrouping(v ?? 'method')}
          data={[
            { value: 'method', label: 'Méthode' },
            { value: 'domain', label: 'Domaine' },
            { value: 'entity', label: 'Entité' },
            { value: 'scope', label: 'Périmètre' },
            { value: 'asset', label: 'Actif' },
            { value: 'process', label: 'Processus' },
            { value: 'scenario', label: 'Scénario' },
            { value: 'security_domain', label: 'Domaine de sécurité' },
          ]}
        />
        <Select
          label="Représentation"
          value={mode}
          onChange={(v) => setMode(v ?? 'graph')}
          data={[
            { value: 'graph', label: 'Cartographie des liens' },
            { value: 'matrix', label: 'Matrices et niveaux par méthode' },
          ]}
        />
      </Group>
      <ErrorAlert error={error ?? data.error ?? methods.error} />
      {data.data?.graphTruncated && (
        <Alert>
          Les liens affichés sont limités à 1 000 nœuds, 2 500 relations et six niveaux. Consultez les fiches pour
          poursuivre l’exploration.
        </Alert>
      )}
      {at && (
        <Text size="sm">
          Fiches et appréciations à la date choisie ; les relations représentent les liens actuels du registre.
        </Text>
      )}
      {data.data?.truncated && (
        <Alert>
          {data.data.items.length} risques affichés sur {data.data.total}. Affinez les filtres pour explorer le
          registre.
        </Alert>
      )}
      <Group>
        {[
          ...new Map(
            data.data?.items
              .filter((i) => i.method)
              .map((i) => [
                i.assessment!.method_version_id,
                { ...i.method!, publicationId: i.assessment!.method_version_id },
              ]),
          ).values(),
        ].map((m) => (
          <Card key={m.publicationId} withBorder>
            <Text fw={600}>
              {m.name} · publication {m.publicationId.slice(0, 8)}
            </Text>
            {m.levels.map((l) => (
              <Group key={l.id}>
                <svg width="14" height="14" aria-hidden="true">
                  <rect width="14" height="14" rx="3" fill={l.color} />
                </svg>
                <Text size="sm">
                  {l.label}
                  {m.display.showAcceptability ? ' · ' + l.acceptability : ''}
                </Text>
              </Group>
            ))}
          </Card>
        ))}
      </Group>
      {mode === 'graph' ? (
        <>
          <Group>
            <Button variant="light" onClick={() => setVp(fitViewport(sceneData.scene, 1000, 600))}>
              Ajuster la carte
            </Button>
            {can('import_export', 'exporter') &&
              can('cartographie', 'exporter') &&
              ['svg', 'png', 'pdf', 'json'].map((f) => (
                <Button key={f} variant="default" onClick={() => void exportMap(f as 'svg' | 'png' | 'pdf' | 'json')}>
                  Exporter {f.toUpperCase()}
                </Button>
              ))}
          </Group>
          <div className="grc-risk-canvas">
            <Canevas
              {...sceneData}
              view="context"
              std={[]}
              hidden={new Set()}
              sel={selected}
              edit={false}
              linkSrc={null}
              vp={vp}
              setVp={setVp}
              onSize={() => {}}
              onLive={() => {}}
              onCommit={() => {}}
              onSelect={setSelected}
              onOpen={(ref) => {
                const o = data.data?.items.find((i) => 'object:' + i.id === ref);
                if (o) onOpen(o);
                else setSelected({ k: 'n', ref });
              }}
              onLink={() => {}}
            />
          </div>
          {selected?.k === 'n' && (
            <Card withBorder>
              <Text fw={600}>{sceneData.lookup(selected.ref)?.name}</Text>
              {data.data?.nodes
                .filter((n) => n.ref === selected.ref && n.kind !== 'risk')
                .map((n) => (
                  <Stack key={n.ref}>
                    <Text>{n.kind}</Text>
                    <Text>{String(n.data.description ?? '')}</Text>
                    {n.ref.startsWith('object:') && (
                      <Button
                        onClick={async () => {
                          try {
                            onOpen(await get<GrcObject>(`/api/grc/${smsi}/objects/${n.ref.slice(7)}`));
                          } catch (e) {
                            setError(e);
                          }
                        }}
                      >
                        Ouvrir l’objet du registre
                      </Button>
                    )}
                  </Stack>
                ))}
              {data.data?.items
                .filter((i) => 'object:' + i.id === selected.ref)
                .map((i) => (
                  <Stack key={i.id}>
                    <Text>{String(i.data.description ?? '')}</Text>
                    <Text>
                      Évaluation : {i.assessment?.revision ?? 'Aucune'} · {i.assessment?.decision ?? ''}
                    </Text>
                    {i.comparison && (
                      <Text>
                        {i.comparison.compatible
                          ? 'Comparaison selon les mêmes critères : ' + JSON.stringify(i.comparison.result)
                          : 'Méthodes ou versions différentes : scores non comparables.'}
                      </Text>
                    )}
                    <Button onClick={() => onOpen(i)}>Ouvrir la fiche du registre</Button>
                  </Stack>
                ))}
            </Card>
          )}
        </>
      ) : (
        [
          ...new Map(
            data.data?.items
              .filter((i) => i.method)
              .map((i) => [
                i.assessment!.method_version_id,
                { ...i.method!, publicationId: i.assessment!.method_version_id },
              ]),
          ).values(),
        ].map((m) => (
          <Card withBorder key={m.publicationId}>
            <Text fw={600}>
              {m.name} · publication {m.publicationId.slice(0, 8)}
            </Text>
            {m.calculation.kind === 'matrix' ? (
              <MatriceRisques
                methode={m}
                publicationId={m.publicationId}
                items={data.data?.items ?? []}
                basis={basis}
                onOpen={onOpen}
              />
            ) : (
              <Text>
                Cette méthode utilise{' '}
                {m.calculation.kind === 'judgement' ? 'un jugement qualitatif' : 'des règles spécifiques'} : aucune
                matrice artificielle.
              </Text>
            )}
            {m.calculation.kind !== 'matrix' &&
              data.data?.items
                .filter((i) => i.assessment?.method_version_id === m.publicationId)
                .map((i) => (
                  <Button key={i.id} variant="subtle" onClick={() => onOpen(i)}>
                    {i.name} · {i.assessment?.result[basis].label}
                  </Button>
                ))}
          </Card>
        ))
      )}
    </Stack>
  );
}

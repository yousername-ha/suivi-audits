/* Cartographie des risques. Dessin validé par le RSSI le 27/11/2026 : niveau affiché (brut ou résiduel) en bascule visible,
   représentation (matrice par méthode ou carte des liens) en pictogrammes ; en matrice, à côté de la grille, la
   répartition du brut au résiduel, les risques non placés et la légende de l'échelle de la méthode. Toute échelle vient
   de la méthode publiée (décision 2) ; dans le style « Verre », la matrice est la représentation par défaut. */
import { Alert, Anchor, Button, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { libelleAcceptabilite, libelleModeCalcul, type GrcObject, type RiskMethod } from '@suivi/shared';
import { computeScene, emptyLayout, type CartoObject, type MapLayout, type ObjectLookup } from '@suivi/shared/carto';
import { get } from '../api';
import { BoiteOutils, type CritereActif } from '../components/BarreOutils';
import { ErrorAlert } from '../components/common';
import { Canevas, fitViewport, type Viewport, type Selection } from '../carto/Canevas';
import { exporter } from '../carto/exports';
import type { MethodVersion } from './Risks';
import { MatriceRisques } from './MatriceRisques';
import { useCan, useMe } from '../session';
import { BarreRepartition, LegendeEchelle, Pastille } from './EchelleRisques';
import { repartitionBrutResiduel, risquesNonPlaces } from './gestion-risques';
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
const STRATEGIES = [
  { value: 'reduce', label: 'Réduction' },
  { value: 'accept', label: 'Acceptation' },
  { value: 'transfer', label: 'Transfert' },
  { value: 'avoid', label: 'Évitement' },
  { value: 'treated', label: 'Traité' },
];
const jourFr = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR');
export function RiskMap({ smsi, onOpen }: { smsi: string; onOpen: (o: GrcObject) => void }) {
  const can = useCan(),
    verre = useMe().appearance.style === 'verre',
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
    [mode, setMode] = useState(verre ? 'matrix' : 'graph'),
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
          ? `${result.label}${item.method?.display.showAcceptability ? ' · ' + libelleAcceptabilite(result.acceptability) : ''}${item.method?.display.showScores && result.score !== null ? ' · ' + result.score : ''}`
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
  const optionsMethode = (methods.data ?? []).map((m) => ({ value: m.methodId, label: m.definition.name })),
    optionsObjetLie = (data.data?.nodes ?? [])
      .filter((n) => n.kind !== 'risk')
      .map((n) => ({ value: n.ref, label: n.name }));
  const reinitialiser = () => {
    setMethodId(null);
    setDomain('');
    setScope('');
    setRelatedRef(null);
    setEntity('');
    setStrategy(null);
    setAt('');
    setCompareAt('');
  };
  const critere = (cle: string, libelle: string, valeur: string, retirer: () => void): CritereActif[] => [
    { cle, libelle, valeur, retirer },
  ];
  const criteres: CritereActif[] = [
    ...(methodId
      ? critere('methode', 'Méthode', optionsMethode.find((o) => o.value === methodId)?.label ?? 'sélectionnée', () =>
          setMethodId(null),
        )
      : []),
    ...(domain ? critere('domaine', 'Domaine', domain, () => setDomain('')) : []),
    ...(scope ? critere('perimetre', 'Périmètre', scope, () => setScope('')) : []),
    ...(relatedRef
      ? critere('objet', 'Objet lié', optionsObjetLie.find((o) => o.value === relatedRef)?.label ?? 'sélectionné', () =>
          setRelatedRef(null),
        )
      : []),
    ...(entity ? critere('entite', 'Entité', entity, () => setEntity('')) : []),
    ...(strategy
      ? critere(
          'strategie',
          'Stratégie de traitement',
          STRATEGIES.find((o) => o.value === strategy)?.label ?? strategy,
          () => setStrategy(null),
        )
      : []),
    ...(at ? critere('date', 'Appréciations au', jourFr(at), () => setAt('')) : []),
    ...(compareAt ? critere('comparaison', 'Comparer au', jourFr(compareAt), () => setCompareAt('')) : []),
  ];
  return (
    <Stack>
      {/* Recherche et filtres des listes (refonte Verre, 27/11/2026) : la carte n'a ni liste ni colonnes ; tous les
          critères (texte libre, dates, longues listes), la base, le regroupement et la représentation restent dans « Plus
          de filtres », les critères actifs en puces retirables. */}
      <BoiteOutils
        label="Outils de la cartographie des risques"
        vues={[
          { value: 'matrix', label: 'Matrices et niveaux par méthode', icone: <IconeMatrice /> },
          { value: 'graph', label: 'Cartographie des liens', icone: <IconeLiens /> },
        ]}
        nomVues="Représentation"
        vue={mode}
        onVue={setMode}
        recherche={{ label: 'Rechercher dans les risques', value: search, onChange: setSearch }}
        criteres={criteres}
        onToutEffacer={() => {
          setSearch('');
          reinitialiser();
        }}
        filtres={{
          actifs: [methodId, domain, scope, relatedRef, entity, strategy, at, compareAt].filter(Boolean).length,
          onReinitialiser: reinitialiser,
          contenu: (
            <>
              <Select
                label="Méthode"
                clearable
                value={methodId}
                onChange={(id) => {
                  setMethodId(id);
                  const method = methods.data?.find((m) => m.methodId === id);
                  if (method) setBasis(method.definition.display.defaultBasis);
                }}
                data={optionsMethode}
                comboboxProps={{ withinPortal: false }}
              />
              <TextInput label="Domaine" value={domain} onChange={(e) => setDomain(e.currentTarget.value)} />
              <TextInput label="Périmètre" value={scope} onChange={(e) => setScope(e.currentTarget.value)} />
              <Select
                label="Objet lié"
                searchable
                clearable
                value={relatedRef}
                onChange={setRelatedRef}
                data={optionsObjetLie}
                comboboxProps={{ withinPortal: false }}
              />
              <TextInput label="Entité" value={entity} onChange={(e) => setEntity(e.currentTarget.value)} />
              <Select
                label="Stratégie de traitement"
                clearable
                value={strategy}
                onChange={setStrategy}
                data={STRATEGIES}
                comboboxProps={{ withinPortal: false }}
              />
              <TextInput
                label="Appréciations au"
                type="date"
                value={at}
                onChange={(e) => setAt(e.currentTarget.value)}
              />
              <TextInput
                label="Comparer au"
                type="date"
                value={compareAt}
                onChange={(e) => setCompareAt(e.currentTarget.value)}
              />
              <Select
                allowDeselect={false}
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
                comboboxProps={{ withinPortal: false }}
              />
            </>
          ),
        }}
      >
        <div className="ris-bascule" role="group" aria-label="Afficher le niveau">
          <span className="ris-bascule__titre" aria-hidden="true">
            Afficher le niveau
          </span>
          {(
            [
              ['gross', 'Brut'],
              ['residual', 'Résiduel'],
            ] as const
          ).map(([b, libelle]) => (
            <Button
              key={b}
              size="sm"
              variant={basis === b ? 'filled' : 'subtle'}
              aria-pressed={basis === b}
              onClick={() => setBasis(b)}
            >
              {libelle}
            </Button>
          ))}
        </div>
      </BoiteOutils>
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
      {mode === 'graph' && (
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
                    {m.display.showAcceptability ? ' · ' + libelleAcceptabilite(l.acceptability) : ''}
                  </Text>
                </Group>
              ))}
            </Card>
          ))}
        </Group>
      )}
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
        ].map((m, rang) => {
          const placement = repartitionBrutResiduel(data.data?.items ?? [], m.publicationId, m);
          const dimension =
            m.calculation.kind === 'matrix'
              ? m.dimensions.find((d) => m.calculation.kind === 'matrix' && d.id === m.calculation.dimension)
              : undefined;
          const nonPlaces = rang === 0 ? risquesNonPlaces(data.data?.items ?? []) : 0;
          const max = Math.max(1, ...placement.niveaux.flatMap((n) => [n.brut, n.residuel]));
          return (
            <div className="ris-carte" key={m.publicationId}>
              <section className="ris-carte__matrice" aria-labelledby={`ris-carte-${m.publicationId}`}>
                <div className="ris-carte__tete">
                  {dimension && (
                    <p className="ris-carte__surtitre">
                      Matrice {dimension.levels.length} × {m.likelihood.length}
                    </p>
                  )}
                  <h2 className="ris-carte__titre" id={`ris-carte-${m.publicationId}`}>
                    {basis === 'gross' ? 'Risques bruts placés' : 'Risques résiduels placés'}
                  </h2>
                  <Text className="ris-carte__methode">
                    {m.name} · publication {m.publicationId.slice(0, 8)}
                  </Text>
                </div>
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
                    {m.calculation.kind === 'judgement'
                      ? `un ${libelleModeCalcul('judgement')}`
                      : 'des règles spécifiques'}{' '}
                    : aucune matrice artificielle.
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
              </section>
              <aside className="ris-carte__cote" aria-label={`Synthèse de la méthode ${m.name}`}>
                <section className="ris-panneau" aria-labelledby={`ris-repartition-${m.publicationId}`}>
                  <p className="ris-carte__surtitre">Répartition</p>
                  <h3 className="ris-panneau__titre" id={`ris-repartition-${m.publicationId}`}>
                    Du brut au résiduel
                  </h3>
                  <ul className="ris-repartition">
                    {placement.niveaux.map((n) => (
                      <li key={n.id} aria-label={`${n.label} : ${n.brut} en brut, ${n.residuel} en résiduel`}>
                        <span className="ris-repartition__niveau" aria-hidden="true">
                          <Pastille couleur={n.color} />
                          {n.label}
                        </span>
                        <span className="ris-repartition__barres" aria-hidden="true">
                          <BarreRepartition
                            className="ris-barre ris-barre--brut"
                            parts={[
                              { id: 'n', color: n.color, nombre: n.brut },
                              { id: 'reste', color: 'transparent', nombre: max - n.brut },
                            ]}
                          />
                          <BarreRepartition
                            parts={[
                              { id: 'n', color: n.color, nombre: n.residuel },
                              { id: 'reste', color: 'transparent', nombre: max - n.residuel },
                            ]}
                          />
                        </span>
                        <span className="ris-repartition__nombres chiffres" aria-hidden="true">
                          {n.brut} → {n.residuel}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="ris-repartition__pied">
                    Barre du haut : brut ; du bas : résiduel ·{' '}
                    {placement.places > 1 ? `${placement.places} risques placés` : `${placement.places} risque placé`}
                  </p>
                </section>
                {nonPlaces > 0 && (
                  <section className="ris-panneau ris-panneau--ligne">
                    <span className="ris-panneau__nombre chiffres">{nonPlaces}</span>
                    <span>
                      <span className="ris-panneau__titre">
                        {nonPlaces > 1 ? 'Risques non placés' : 'Risque non placé'}
                      </span>
                      <span className="ris-panneau__detail">Aucune appréciation enregistrée</span>
                    </span>
                    <Anchor component={Link} to="/pilotage/risques" className="ris-panneau__lien">
                      Voir le registre
                    </Anchor>
                  </section>
                )}
                <section className="ris-panneau" aria-labelledby={`ris-legende-${m.publicationId}`}>
                  <p className="ris-carte__surtitre">Légende</p>
                  <h3 className="ris-panneau__titre" id={`ris-legende-${m.publicationId}`}>
                    Échelle de la méthode
                  </h3>
                  <LegendeEchelle methode={m} compacte />
                </section>
              </aside>
            </div>
          );
        })
      )}
    </Stack>
  );
}

/** Pictogrammes des représentations : grille (matrice) et nœuds reliés (carte des liens). */
function IconeMatrice() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      className="nav-icone"
    >
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconeLiens() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      className="nav-icone"
    >
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="8" r="2.5" />
      <circle cx="10" cy="18" r="2.5" />
      <path d="m8.3 7 7.4.6M7 8.3l2.2 7.4M16.4 10l-4.6 6" />
    </svg>
  );
}

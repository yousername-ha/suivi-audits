/* Panneau latéral de la carte (CARTO-06) : référentiels, préréglages de vue, relations secondaires, propositions,
   légende et chiffres clés. Les préréglages atténuent sans jamais déplacer. */
import { Button, Card, Group, Stack, Switch, Text, Title } from '@mantine/core';
import {
  PRESETS,
  REFERENTIELS,
  type CartoObject,
  type MapLayout,
  type MapView,
  type ObjectLookup,
  type Referentiel,
} from '@suivi/shared/carto';
import { Icone } from './rendu';

interface Entree {
  teinte: string;
  libelle: string;
  forme: 'boite' | 'trait' | 'pastille';
  classe?: string;
}
const LEGENDE: Record<MapView, Entree[]> = {
  context: [
    { teinte: 'bleu', libelle: 'Périmètre SMSI', forme: 'boite', classe: 'c-tirets' },
    { teinte: 'bleu', libelle: 'Élément interne (processus, SI, site)', forme: 'boite' },
    { teinte: 'violet', libelle: 'Partie intéressée, fournisseur', forme: 'boite' },
    { teinte: 'orange', libelle: 'Enjeu interne ou externe', forme: 'boite' },
    { teinte: 'gris', libelle: 'Hors périmètre', forme: 'boite', classe: 'c-tirets' },
    { teinte: 'bleu', libelle: 'Lien principal', forme: 'trait', classe: 'l-primary' },
    { teinte: 'bleu', libelle: 'Dépendance, support', forme: 'trait', classe: 'l-dependency' },
    { teinte: 'gris', libelle: 'Lien secondaire', forme: 'trait', classe: 'l-secondary' },
    { teinte: 'orange', libelle: 'Impact d’un enjeu', forme: 'trait', classe: 'l-issue' },
  ],
  process: [
    { teinte: 'violet', libelle: 'Processus de pilotage', forme: 'boite' },
    { teinte: 'bleu', libelle: 'Processus de réalisation', forme: 'boite' },
    { teinte: 'vert', libelle: 'Processus de support', forme: 'boite' },
    { teinte: 'gris', libelle: 'Sous-processus', forme: 'boite', classe: 'c-tirets' },
    { teinte: 'bleu', libelle: 'Flux principal', forme: 'trait', classe: 'l-primary' },
    { teinte: 'bleu', libelle: 'Support, dépendance', forme: 'trait', classe: 'l-dependency' },
    { teinte: 'gris', libelle: 'S’applique à', forme: 'trait', classe: 'l-secondary' },
    { teinte: 'orange', libelle: 'Proposition à valider (mode édition)', forme: 'pastille' },
  ],
};

function Echantillon({ e }: { e: Entree }) {
  return (
    <svg viewBox="0 0 22 14" className={`carte-echantillon ct-${e.teinte}`} aria-hidden="true">
      {e.forme === 'boite' && (
        <rect x={1} y={1} width={20} height={12} rx={3} className={`c-fond ${e.classe ?? ''}`} strokeWidth={1.5} />
      )}
      {e.forme === 'trait' && <path d="M1 7H21" className={`lien-trait ${e.classe ?? ''}`} fill="none" />}
      {e.forme === 'pastille' && <circle cx={11} cy={7} r={6} className="c-doux c-trait-accent" />}
    </svg>
  );
}

export interface PanneauProps {
  view: MapView;
  layout: MapLayout | null;
  lookup: ObjectLookup;
  std: Referentiel[];
  preset: string;
  sec: boolean;
  gen: boolean;
  onStd: (s: Referentiel[]) => void;
  onPreset: (p: string) => void;
  onSec: (v: boolean) => void;
  onGen: (v: boolean) => void;
  /** Calque « santé des indicateurs » (processus) et disponibilité du filtre ISO 9001 (référentiel 9001 rattaché). */
  sante: boolean;
  onSante: (v: boolean) => void;
  norme9001: boolean;
}

export function Panneau(p: PanneauProps) {
  const sur = p.layout
    ? Object.keys(p.layout.nodes)
        .map((r) => p.lookup(r))
        .filter((o): o is CartoObject => !!o && !('mapOnly' in o))
    : [];
  const n = (f: (o: CartoObject) => boolean) => sur.filter(f).length;
  const chiffres: [string, number][] =
    p.view === 'context'
      ? [
          ['Objets sur la carte', sur.length],
          ['Processus', n((o) => o.type === 'process' || o.type === 'subprocess')],
          ['Parties intéressées', n((o) => o.type === 'stakeholder')],
          ['Enjeux', n((o) => /issue/.test(o.type))],
          ['Applications et SI', n((o) => ['application', 'infrastructure', 'site'].includes(o.type))],
          ['Fournisseurs', n((o) => o.type === 'supplier')],
        ]
      : [
          ['Processus', n((o) => o.type === 'process')],
          ['Pilotage', n((o) => o.type === 'process' && o.family === 'Management')],
          ['Réalisation', n((o) => o.type === 'process' && o.family === 'Réalisation')],
          ['Support', n((o) => o.type === 'process' && o.family === 'Support')],
          ['Sous-processus', n((o) => o.type === 'subprocess')],
          ['Propositions à valider', p.layout ? p.layout.edges.filter((e) => e.gen).length : 0],
        ];
  return (
    <Stack gap="sm" className="carte-panneau">
      <Card padding="sm">
        <Title order={3} size="h6" mb="xs">
          Référentiels
        </Title>
        <Stack gap="2xs">
          {REFERENTIELS.filter((r) => r !== 'ISO 9001' || p.norme9001).map((r) => (
            <Switch
              key={r}
              label={r}
              checked={p.std.includes(r)}
              onChange={(e) => p.onStd(e.currentTarget.checked ? [...p.std, r] : p.std.filter((x) => x !== r))}
            />
          ))}
        </Stack>
        <Text size="xs" c="dimmed" mt="2xs">
          Masque les objets qui ne relèvent d’aucun référentiel activé.
        </Text>
      </Card>
      <Card padding="sm">
        <Title order={3} size="h6" mb="xs">
          Calques
        </Title>
        <Switch label="Santé des indicateurs" checked={p.sante} onChange={(e) => p.onSante(e.currentTarget.checked)} />
        <Text size="xs" c="dimmed" mt="2xs">
          Liseré au bas de chaque processus : rouge si un indicateur lié n’est pas atteint, vert si tous le sont, orange
          s’il en reste à mesurer. Un processus sans indicateur n’a pas de liseré.
        </Text>
      </Card>
      <Card padding="sm">
        <Title order={3} size="h6" mb="xs">
          Vue
        </Title>
        <div className="carte-prereglages" role="group" aria-label="Préréglages de vue">
          {PRESETS[p.view].map((x) => (
            <Button
              key={x.k}
              size="xs"
              variant={p.preset === x.k ? 'light' : 'default'}
              aria-pressed={p.preset === x.k}
              onClick={() => p.onPreset(x.k)}
              leftSection={
                <svg viewBox="0 0 24 24" className="carte-ic-bouton" aria-hidden="true">
                  <Icone k={x.ic} x={0} y={0} s={24} cls="c-courant" />
                </svg>
              }
            >
              {x.l}
            </Button>
          ))}
        </div>
        <Stack gap="2xs" mt="sm">
          <Switch label="Relations secondaires" checked={p.sec} onChange={(e) => p.onSec(e.currentTarget.checked)} />
          {p.view === 'process' && (
            <Switch label="Propositions de flux" checked={p.gen} onChange={(e) => p.onGen(e.currentTarget.checked)} />
          )}
        </Stack>
      </Card>
      <Card padding="sm">
        <Title order={3} size="h6" mb="xs">
          Légende
        </Title>
        <Stack gap="2xs">
          {LEGENDE[p.view].map((e) => (
            <Group key={e.libelle} gap="xs" wrap="nowrap">
              <Echantillon e={e} />
              <Text size="sm">{e.libelle}</Text>
            </Group>
          ))}
        </Stack>
      </Card>
      <Card padding="sm">
        <Title order={3} size="h6" mb="xs">
          Chiffres clés
        </Title>
        <Stack gap="2xs">
          {chiffres.map(([l, v]) => (
            <Group key={l} justify="space-between" wrap="nowrap">
              <Text size="sm">{l}</Text>
              <Text size="sm" fw={700} className="chiffres">
                {v}
              </Text>
            </Group>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}

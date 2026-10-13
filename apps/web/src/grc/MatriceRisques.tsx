/* Matrice des risques d'une méthode à calcul matriciel : cases entièrement colorées (couleur du niveau publié dans la
   méthode, jamais recalculée ici), libellé du niveau, nombre de risques, références cliquables. Impact décroissant de haut
   en bas, probabilité croissante de gauche à droite. Les couleurs viennent des données : la CSP interdit les styles en
   ligne, le fond de case est donc un SVG. Une méthode sans matrice (jugement, règles) n'en reçoit pas. */
import { Button, Group, Stack, Table, Text } from '@mantine/core';
import { useState } from 'react';
import type { RiskMethod } from '@suivi/shared';
import { MATRICE } from '@suivi/ui';
import type { Projection } from './RiskMap';

type Item = Projection['items'][number];
const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
/** Texte blanc ou encre foncée, selon le meilleur contraste avec le fond de la case. */
const texteSur = (fond: string) => {
  const l = lum(fond);
  const surBlanc = 1.05 / (l + 0.05);
  const surEncre = (l + 0.05) / (lum(MATRICE.encre) + 0.05);
  return surBlanc >= surEncre ? 'matrice-texte-clair' : 'matrice-texte-fonce';
};
const code = (i: Item) => String(i.data.code ?? i.name);

export function MatriceRisques({
  methode,
  publicationId,
  items,
  basis,
  onOpen,
}: {
  methode: RiskMethod;
  publicationId: string;
  items: Item[];
  basis: 'gross' | 'residual';
  onOpen: (i: Item) => void;
}) {
  const [sel, setSel] = useState<{ impact: string; likelihood: string } | null>(null);
  const calc = methode.calculation;
  if (calc.kind !== 'matrix') return null;
  const dimension = methode.dimensions.find((d) => d.id === calc.dimension);
  if (!dimension) return null;
  const mine = items.filter((i) => i.assessment?.method_version_id === publicationId);
  const placed = (impact: string, likelihood: string) =>
    mine.filter((i) => {
      const r = i.assessment?.ratings[basis];
      return r?.dimensions[calc.dimension] === impact && r.likelihood === likelihood;
    });
  const impacts = [...dimension.levels].sort((a, b) => b.value - a.value);
  const likelihoods = [...methode.likelihood].sort((a, b) => a.value - b.value);
  const choisis = sel ? placed(sel.impact, sel.likelihood) : mine;
  return (
    <Stack gap="xs">
      <div className="matrice-defilement">
        <Table className="matrice-risques" aria-label={`Matrice ${methode.name}`}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col">{dimension.label} ↓ · Probabilité →</Table.Th>
              {likelihoods.map((l) => (
                <Table.Th key={l.id} scope="col">
                  {l.label}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {impacts.map((impact) => (
              <Table.Tr key={impact.id}>
                <Table.Th scope="row">{impact.label}</Table.Th>
                {likelihoods.map((l) => {
                  const cell = calc.cells.find((c) => c.impact === impact.id && c.likelihood === l.id);
                  const niveau = methode.levels.find((x) => x.id === cell?.level);
                  const ici = placed(impact.id, l.id);
                  const actif = sel?.impact === impact.id && sel.likelihood === l.id;
                  const fond = niveau?.color ?? MATRICE.neutre;
                  return (
                    <Table.Td key={l.id} className="matrice-cellule-td">
                      <div className={`matrice-cellule ${texteSur(fond)}`}>
                        <svg className="matrice-fond" aria-hidden="true" focusable="false" preserveAspectRatio="none">
                          <rect width="100%" height="100%" rx="6" fill={fond} />
                        </svg>
                        <button
                          type="button"
                          className="matrice-choix"
                          aria-pressed={actif}
                          aria-label={`${dimension.label} ${impact.label}, probabilité ${l.label}, niveau ${niveau?.label ?? 'non défini'}, ${ici.length} risque(s)`}
                          onClick={() => setSel(actif ? null : { impact: impact.id, likelihood: l.id })}
                        >
                          <span className="matrice-niveau">{niveau?.label ?? '—'}</span>
                          <span className="matrice-nombre chiffres">{ici.length || '—'}</span>
                        </button>
                        {ici.length > 0 && (
                          <ul className="matrice-refs">
                            {ici.map((r) => (
                              <li key={r.id}>
                                <button type="button" className="matrice-ref" onClick={() => onOpen(r)}>
                                  {code(r)}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
      <Group justify="space-between">
        <Text fw={600} role="status">
          {sel ? `Risques sélectionnés · ${choisis.length}` : `Risques de la matrice · ${choisis.length}`}
        </Text>
        {sel && (
          <Button size="xs" variant="default" onClick={() => setSel(null)}>
            Réinitialiser la sélection
          </Button>
        )}
      </Group>
      {choisis.length === 0 ? (
        <Text size="sm">Aucun risque dans cette cellule.</Text>
      ) : (
        choisis.map((r) => (
          <Button key={r.id} variant="subtle" justify="flex-start" onClick={() => onOpen(r)}>
            {code(r)} · {r.name} · {r.assessment?.result[basis].label}
          </Button>
        ))
      )}
    </Stack>
  );
}

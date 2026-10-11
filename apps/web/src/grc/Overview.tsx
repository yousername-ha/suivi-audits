import { Card, Stack, Text, Table } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Anneau, type PartGraphique } from '@suivi/ui';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
interface Summary {
  total: number;
  closed?: number;
  overdue?: number;
  unassigned?: number;
  awaitingReview?: number;
}
/** Répartition graphique d'une section (UI-02) : uniquement des comptes calculés par le serveur, sans taux inventé. */
function parts(
  title: string,
  x: Summary & { pending?: number },
): { parts: PartGraphique[]; centre: string; sous: string } {
  const total = x.total;
  const retard = x.overdue ?? 0;
  if (title === 'Actions') {
    const closes = x.closed ?? 0;
    return {
      parts: [
        { libelle: 'Closes', valeur: closes, teinte: 'vert' },
        { libelle: 'En cours', valeur: Math.max(0, total - closes - retard), teinte: 'bleu' },
        { libelle: 'En retard', valeur: retard, teinte: 'rouge' },
      ],
      centre: String(total),
      sous: 'actions',
    };
  }
  if (title === 'Contrôles') {
    const nonRealises = x.pending ?? 0;
    return {
      parts: [
        { libelle: 'Réalisés', valeur: Math.max(0, total - nonRealises), teinte: 'vert' },
        { libelle: 'Non réalisés', valeur: nonRealises, teinte: 'orange' },
      ],
      centre: String(total),
      sous: 'contrôles',
    };
  }
  const aValider = x.awaitingReview ?? 0;
  return {
    parts: [
      {
        libelle: title === 'Risques' ? 'Appréciation validée' : 'Validées',
        valeur: Math.max(0, total - aValider),
        teinte: 'vert',
      },
      { libelle: 'À valider', valeur: aValider, teinte: 'orange' },
    ],
    centre: String(total),
    sous: title.toLowerCase(),
  };
}

export function Overview({ smsi }: { smsi: string }) {
  const data = useQuery({
    queryKey: ['grc', smsi, 'dashboard'],
    queryFn: () =>
      get<{
        display: { showOverdue: boolean; showUnvalidated: boolean };
        sections: {
          tasks?: { summary: Summary };
          risks?: Summary;
          controls?: Summary;
          evidence?: Summary;
          frameworks?: { id: string; name: string; version: number; requirements: number; mapped: number }[];
        };
      }>(`/api/grc/${smsi}/dashboard`),
  });
  const sections = data.data?.sections;
  const labels: Record<string, string> = {
    total: 'Total',
    closed: 'Closes',
    overdue: 'En retard',
    unassigned: 'Sans responsable',
    awaitingReview: 'À valider',
    pending: 'Non réalisés',
  };
  return (
    <Stack>
      <ErrorAlert error={data.error} />
      <Text>Résultats issus de vos registres et référentiels, selon vos droits d’accès.</Text>
      <div className="grc-dashboard-grid">
        {(
          [
            ['Actions', sections?.tasks?.summary],
            ['Risques', sections?.risks],
            ['Contrôles', sections?.controls],
            ['Preuves', sections?.evidence],
          ] as const
        )
          .filter(([, s]) => s)
          .map(([title, summary]) => (
            <Card key={title} withBorder>
              <Stack>
                <Text fw={600}>{title}</Text>
                {(() => {
                  const g = parts(title, summary as Summary & { pending?: number });
                  return <Anneau titre={title} parts={g.parts} centre={g.centre} sousCentre={g.sous} />;
                })()}
                {Object.entries(summary!)
                  .filter(
                    ([key]) =>
                      (key !== 'overdue' || data.data?.display.showOverdue) &&
                      (key !== 'awaitingReview' || data.data?.display.showUnvalidated),
                  )
                  .map(([key, value]) => (
                    <Text key={key}>
                      {labels[key] ?? key} : {value}
                    </Text>
                  ))}
              </Stack>
            </Card>
          ))}
      </div>
      {sections?.frameworks && (
        <Card withBorder>
          <Stack>
            <Text fw={600}>Référentiels activés et correspondances revues</Text>
            <Text size="sm">
              La couverture ci-dessous mesure les exigences ayant une correspondance humaine validée. Elle ne constitue
              pas un taux de conformité.
            </Text>
            <Table.ScrollContainer minWidth={600}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Référentiel</Table.Th>
                    <Table.Th>Version</Table.Th>
                    <Table.Th>Exigences</Table.Th>
                    <Table.Th>Correspondances revues</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sections.frameworks.map((f) => (
                    <Table.Tr key={f.id}>
                      <Table.Td>{f.name}</Table.Td>
                      <Table.Td>{f.version}</Table.Td>
                      <Table.Td>{f.requirements}</Table.Td>
                      <Table.Td>{f.mapped}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

/* Programme d'audit interne et plan d'exercices de l'outil historique (lot U2) : lecture seule depuis sa source, à côté
   des fiches du Pilotage, pour réunir audits internes et exercices sans double saisie. La planification se modifie
   dans l'outil historique (lien direct vers la bonne vue). */
import { Anchor, Card, Group, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { plansHistoriques } from '@suivi/shared';
import { DataTable, StatusChip } from '@suivi/ui';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { lienHistorique } from '../pilotage-navigation';

const SOCLE = '00000000-0000-4000-8000-000000000001';
const TYPES = {
  audit: { titre: 'Programme d’audit interne de l’outil de suivi', objet: 'Périmètre' },
  exo: { titre: 'Plan d’exercices de l’outil de suivi', objet: 'Scénario' },
} as const;
const jour = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : '–');
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function PlansHistoriques({ smsi, type }: { smsi: string; type: keyof typeof TYPES }) {
  const q = useQuery({
    queryKey: ['grc', smsi, 'legacy-plans'],
    queryFn: () => get<Record<string, unknown>>('/api/legacy/state'),
    enabled: smsi === SOCLE,
  });
  if (smsi !== SOCLE) return null;
  const plans = q.data ? plansHistoriques(q.data, type, aujourdhui()) : [];
  return (
    <Card withBorder>
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>{TYPES[type].titre}</Text>
          <Anchor href={lienHistorique({ onglet: 'plans', vue: `planView=${type}` })}>
            Planifier dans l’outil historique
          </Anchor>
        </Group>
        <ErrorAlert error={q.error} />
        {q.data && !plans.length && <Text size="sm">Aucune séance planifiée dans l’outil de suivi.</Text>}
        {!!plans.length && (
          <DataTable label={TYPES[type].titre}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Séance</Table.Th>
                  <Table.Th className="col-p2">{TYPES[type].objet}</Table.Th>
                  <Table.Th>Dates</Table.Th>
                  <Table.Th>Statut</Table.Th>
                  <Table.Th className="col-p3">Responsable</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {plans.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>
                      {p.id} · {p.titre || 'Sans intitulé'}
                      {p.modalite && (
                        <Text size="xs" c="dimmed">
                          {p.modalite}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td className="col-p2">{p.objet || '–'}</Table.Td>
                    <Table.Td>
                      {jour(p.debut)}
                      {p.fin && p.fin !== p.debut ? ` → ${jour(p.fin)}` : ''}
                      {p.realiseLe && (
                        <Text size="xs" c="dimmed">
                          Réalisé le {jour(p.realiseLe)}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {p.enRetard ? (
                        <StatusChip etat="erreur">En retard</StatusChip>
                      ) : (
                        <StatusChip etat={p.statut === 'Réalisé' ? 'succes' : 'neutre'}>
                          {p.statut || 'Planifié'}
                        </StatusChip>
                      )}
                    </Table.Td>
                    <Table.Td className="col-p3">{p.responsable || '–'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </DataTable>
        )}
      </Stack>
    </Card>
  );
}

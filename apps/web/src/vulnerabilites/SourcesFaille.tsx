/* Plusieurs sources (ADR 0100, décisions V23, V26 et V27 ; lot V4c) : ce que chaque source dit d'une faille, dans les listes
   (marques courtes : exploitation avérée, « exploitable », première source et sa date) et dans les fiches (sources de
   l'exploitation et de « exploitable » avec leurs dates, valeurs par source avec celle retenue pour la priorité, mentions
   du CERT Santé telles quelles). Composants sans état, avec ceux de la charte (packages/ui), sous la CSP stricte (ADR 0006). */
import { Group, Stack, Table, Text, Title } from '@mantine/core';
import type { FicheCertSanteDto, SourcesFailleDto } from '@suivi/shared';
import { DataTable, StatusChip } from '@suivi/ui';
import {
  libelleMention,
  lignesValeurs,
  marquesSources,
  mentionsFiche,
  resumeExploitable,
  resumeExploitation,
} from './sources';

/** Marques courtes d'une faille dans une liste (sans état). */
export function MarquesSources({ s }: { s: SourcesFailleDto }) {
  const marques = marquesSources(s);
  if (!marques.length) return null;
  return (
    <Stack gap="2xs">
      {marques.map((m) => (
        <Group key={m.libelle} gap="2xs">
          <StatusChip etat={m.etat}>{m.libelle}</StatusChip>
          <Text size="xs" c="dimmed">
            {m.detail}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

/** Section « Ce que disent les sources » d'une fiche (sans état). */
export function SourcesFaille({ s }: { s: SourcesFailleDto }) {
  const exploitation = resumeExploitation(s);
  const exploitable = resumeExploitable(s);
  const valeurs = lignesValeurs(s);
  return (
    <Stack gap="2xs">
      <Title order={3} size="h6">
        Ce que disent les sources
      </Title>
      <Text size="sm">Exploitation avérée : {exploitation ?? 'aucune source ne la signale'}.</Text>
      <Text size="sm">Exploitable : {exploitable ?? 'aucune source ne le signale'}.</Text>
      <Text size="xs" c="dimmed">
        Une seule source suffit ; la première à l’avoir signalé est citée d’abord.
      </Text>
      {valeurs.length ? (
        <DataTable label="Valeurs par source">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Fait</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Valeur</Table.Th>
                <Table.Th>Priorité</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {valeurs.map((v) => (
                <Table.Tr key={`${v.fait}-${v.source}`}>
                  <Table.Td>{v.fait}</Table.Td>
                  <Table.Td>{v.source}</Table.Td>
                  <Table.Td>{v.valeur}</Table.Td>
                  <Table.Td>{v.retenue ? <StatusChip etat="info">La plus sévère, retenue</StatusChip> : '—'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
      ) : (
        <Text size="sm" c="dimmed">
          Aucune gravité ni aucun score publié par les sources.
        </Text>
      )}
      {s.certSante && (
        <Text size="sm">
          Fiche du CERT Santé : un correctif existe : {libelleMention(s.certSante.correctif)} · une mesure de
          contournement existe : {libelleMention(s.certSante.contournement)}.
        </Text>
      )}
    </Stack>
  );
}

/** Mentions d'une fiche du CERT Santé, telles quelles (sans état). */
export function MentionsFicheCertSante({ f }: { f: FicheCertSanteDto }) {
  return (
    <Text size="xs" c="dimmed">
      {mentionsFiche(f)
        .map((m) => `${m.libelle} : ${m.valeur}`)
        .join(' · ')}
    </Text>
  );
}

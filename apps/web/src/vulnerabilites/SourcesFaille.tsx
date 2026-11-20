/* Plusieurs sources (ADR 0100, décisions V23, V26 et V27 ; lot V4c) : ce que chaque source dit d'une faille, dans les listes
   (marques courtes : exploitation avérée, « exploitable », première source et sa date) et dans les fiches (sources de
   l'exploitation et de « exploitable » avec leurs dates, valeurs par source avec celle retenue pour la priorité, mentions
   du CERT Santé telles quelles). Composants sans état, avec ceux de la charte (packages/ui), sous la CSP stricte (ADR 0006).
   Lot L1 : pastille de la première source à côté de chaque marque (décorative : le texte la nomme). */
import { Group, Stack, Table, Text, Title } from '@mantine/core';
import type { SourcesFailleDto } from '@suivi/shared';
import { DataTable, StatusChip } from '@suivi/ui';
import {
  libelleMention,
  lignesValeurs,
  marquesSources,
  MENTION_RANCONGICIEL,
  resumeExploitable,
  resumeExploitation,
} from './sources';
import { PictoSource } from './PictoSource';
import { PICTO_EXPLOITABLE, PICTO_EXPLOITATION, type SourcePicto } from './pictos-sources';

/** Marques courtes d'une faille dans une liste (sans état). */
export function MarquesSources({ s }: { s: SourcesFailleDto }) {
  const marques = marquesSources(s);
  if (!marques.length) return null;
  // Même ordre que les marques : exploitation avérée, puis « exploitable ».
  const premieres = [
    s.exploitation[0] && PICTO_EXPLOITATION[s.exploitation[0].source],
    s.exploitable[0] && PICTO_EXPLOITABLE[s.exploitable[0].source],
  ].filter((x): x is SourcePicto => !!x);
  return (
    <Stack gap="2xs">
      {marques.map((m, i) => (
        <Group key={m.libelle} gap="2xs" align="center">
          <StatusChip etat={m.etat}>{m.libelle}</StatusChip>
          {premieres[i] && <PictoSource source={premieres[i]} decoratif />}
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
  // Lot PRIO-1 : dans une fiche, libellés complets (terme officiel de Tenable, « Exploited by malware »).
  const exploitation = resumeExploitation(s, true);
  const exploitable = resumeExploitable(s);
  const valeurs = lignesValeurs(s);
  return (
    <Stack gap="2xs">
      <Title order={3} size="h6">
        Ce que disent les sources
      </Title>
      <Text size="sm">Exploitation avérée : {exploitation ?? 'aucune source ne la signale'}.</Text>
      {s.rancongiciel && <Text size="sm">{MENTION_RANCONGICIEL}.</Text>}
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

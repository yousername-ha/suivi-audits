/* Module Vulnérabilités (ADR 0100, lot S1) : onglet « Délais et exceptions ». Délais cibles par priorité (réglés dans
   « Seuils de priorité »), mesure des corrections sur une période (délai moyen et médian par priorité, part des corrections
   faites dans les délais ; les mêmes nombres pour tout le monde, sans nom) et exceptions (risques acceptés) en cours,
   bientôt échues, échues ou sans échéance, des failles que la personne lit : par qui et quand, justification, mesure
   compensatoire, échéance. Lecture seule : une exception s'accorde, se prolonge ou se lève dans la fiche de la faille, par le
   seul rôle RSSI. Composants de la charte, sous la CSP stricte (ADR 0006) ; libellés exacts, jamais la couleur seule. */
import { Alert, Anchor, Group, Select, Stack, Table, Text, Title } from '@mantine/core';
import {
  type DelaisVueDto,
  ETAT_SUIVI_LIBELLES,
  EXCEPTION_RESERVEE,
  type ExceptionDto,
  libelleDelai,
  libelleDuree,
  libelleTaux,
  type MesuresDelaisDto,
  NIVEAUX_PRIORITE,
  STATUT_EXCEPTION_LIBELLES,
  STATUTS_EXCEPTION,
  type StatutException,
} from '@suivi/shared';
import { DataTable, ErrorAlert, Page, PageHeader, StatusChip } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { get } from '../api';
import { fmtDate } from '../components/common';
import { useCan } from '../session';
import {
  CLE_DELAIS,
  fmtJourCivil,
  libelleStatutException,
  OPTIONS_PERIODE,
  STATUT_EXCEPTION_PUCE,
  urlDelais,
} from './delais';

/** Mesure des corrections (sans état) : une ligne par priorité, puis l'ensemble. */
export function MesuresTable({ m }: { m: MesuresDelaisDto }) {
  const lignes = [
    ...m.parPriorite.map((x) => ({ ...x, libelle: x.priorite as string })),
    { ...m.total, libelle: 'Toutes' },
  ];
  return (
    <DataTable label="Mesure des corrections par priorité">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Priorité</Table.Th>
            <Table.Th>Failles corrigées</Table.Th>
            <Table.Th>Délai moyen</Table.Th>
            <Table.Th>Délai médian</Table.Th>
            <Table.Th>Dans les délais</Table.Th>
            <Table.Th>Part dans les délais</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lignes.map((l) => (
            <Table.Tr key={l.libelle}>
              <Table.Td>{l.libelle}</Table.Td>
              <Table.Td>{l.nombre}</Table.Td>
              <Table.Td>{libelleDuree(l.moyenneHeures)}</Table.Td>
              <Table.Td>{libelleDuree(l.medianeHeures)}</Table.Td>
              <Table.Td>{l.avecDelai ? `${l.dansLesDelais} sur ${l.avecDelai}` : 'Sans délai'}</Table.Td>
              <Table.Td>{libelleTaux(l.taux)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Exceptions (sans état) : faille, statut, échéance, par qui et quand, justification, mesure compensatoire. */
export function ExceptionsTable({ exceptions }: { exceptions: ExceptionDto[] }) {
  return (
    <DataTable label="Exceptions">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Faille</Table.Th>
            <Table.Th>Statut</Table.Th>
            <Table.Th>Échéance</Table.Th>
            <Table.Th>Accordée par</Table.Th>
            <Table.Th>Justification</Table.Th>
            <Table.Th>Mesure compensatoire</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {exceptions.map((e) => (
            <Table.Tr key={`${e.nature}-${e.objetId}-${e.expireeLe ?? ''}`}>
              <Table.Td>
                <Text size="sm" lang={e.nature === 'constat' ? 'en' : undefined}>
                  {e.titre}
                </Text>
                <Text size="xs" c="dimmed">
                  {e.nature === 'constat' ? 'Détectée par Tenable' : 'Faille déclarée'}
                </Text>
              </Table.Td>
              <Table.Td>
                <StatusChip etat={STATUT_EXCEPTION_PUCE[e.statut]}>{libelleStatutException(e.statut)}</StatusChip>
                {e.expireeLe && (
                  <Text size="xs" c="dimmed">
                    Expirée le <span className="horodatage">{fmtDate(e.expireeLe)}</span>
                    {e.etatApres ? ` : faille rendue « ${ETAT_SUIVI_LIBELLES[e.etatApres]} »` : ''}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{e.echeance ? fmtJourCivil(e.echeance) : 'Aucune'}</Table.Td>
              <Table.Td>
                {e.par ?? '—'}
                {e.le && (
                  <Text size="xs" c="dimmed">
                    le <span className="horodatage">{fmtDate(e.le)}</span>
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{e.justification ?? '—'}</Table.Td>
              <Table.Td>{e.mesure ?? '—'}</Table.Td>
            </Table.Tr>
          ))}
          {exceptions.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text size="sm" c="dimmed">
                  Aucune exception, parmi les failles que vous pouvez lire.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

export function DelaisExceptionsPage() {
  const can = useCan();
  const lire = can('vulnerabilites', 'lire');
  const [periode, setPeriode] = useState('90');
  const [statut, setStatut] = useState<StatutException | ''>('');
  const vue = useQuery({
    queryKey: [...CLE_DELAIS, periode],
    queryFn: () => get<DelaisVueDto>(urlDelais(Number(periode))),
    enabled: lire,
  });
  if (!lire)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit de lire les vulnérabilités.</Alert>
      </Page>
    );
  const v = vue.data;
  return (
    <Page>
      <PageHeader
        title="Délais et exceptions"
        description="Délai cible de correction par priorité, mesure des corrections et exceptions (risques acceptés) avec leur échéance. Les délais, les échéances et les mesures sont calculés par la plateforme, les mêmes pour tout le monde ; les exceptions ne portent que sur les failles que vous pouvez lire. Aucun nom de machine ici."
      />
      <Stack>
        <ErrorAlert error={vue.error} />
        {v && (
          <>
            <Title order={2} size="h4">
              Délais cibles
            </Title>
            <Group gap="md">
              {NIVEAUX_PRIORITE.map((p) => (
                <Text key={p} size="sm">
                  <strong>{p}</strong> : {libelleDelai(v.delais[p])}
                </Text>
              ))}
            </Group>
            <Text size="sm" c="dimmed">
              Réglés dans{' '}
              <Anchor component={Link} to="/vulnerabilites/priorite" size="sm">
                Seuils de priorité
              </Anchor>
              . Les failles en dépassement se listent dans{' '}
              <Anchor component={Link} to="/vulnerabilites/failles?delai=en_depassement&tri=echeance" size="sm">
                Failles détectées, filtre « En dépassement »
              </Anchor>
              .
            </Text>
            <Title order={2} size="h4">
              Mesure des corrections
            </Title>
            <Group align="flex-end">
              <Select
                label="Période"
                allowDeselect={false}
                value={periode}
                onChange={(x) => setPeriode(x ?? '90')}
                data={OPTIONS_PERIODE}
                comboboxProps={{ withinPortal: false }}
              />
              <Text size="xs" c="dimmed">
                Du <span className="horodatage">{fmtDate(v.du)}</span> au{' '}
                <span className="horodatage">{fmtDate(v.au)}</span>
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              Failles passées à « Corrigée » sur la période : durée entre le départ du délai (première présence, ou fin
              d’une exception) et la correction (la proposition « corrigée » de la source, si la décision la confirme),
              avec la priorité et l’échéance relevées à la décision.
              {v.nonMesurees > 0 &&
                ` ${v.nonMesurees} correction${v.nonMesurees > 1 ? 's' : ''} décidée${v.nonMesurees > 1 ? 's' : ''} avant la mesure des délais ne ${v.nonMesurees > 1 ? 'sont' : 'est'} pas comptée${v.nonMesurees > 1 ? 's' : ''}.`}
            </Text>
            <MesuresTable m={v.mesures} />
            <Title order={2} size="h4">
              Exceptions
            </Title>
            <Text size="sm" c="dimmed">
              {EXCEPTION_RESERVEE} Elle exige une justification, une mesure compensatoire et une échéance de douze mois
              au plus (à confirmer par le RSSI), et se décide dans la fiche de la faille. À l’échéance passée,
              l’exception expire d’elle-même : la faille revient à traiter et son délai de correction repart. Rappel
              quatorze jours avant l’échéance.
              {!v.peutDeciderException && ' Vous ne tenez pas le rôle RSSI : vous pouvez seulement les lire.'}
            </Text>
            <Group gap="xs" role="status" aria-label="Exceptions par statut">
              {STATUTS_EXCEPTION.map((s) => (
                <StatusChip key={s} etat={STATUT_EXCEPTION_PUCE[s]}>
                  {STATUT_EXCEPTION_LIBELLES[s]} : {v.compteurs[s]}
                </StatusChip>
              ))}
            </Group>
            <Select
              label="Statut de l’exception"
              placeholder="Tous"
              clearable
              value={statut || null}
              onChange={(x) => setStatut((x ?? '') as StatutException | '')}
              data={STATUTS_EXCEPTION.map((s) => ({ value: s, label: STATUT_EXCEPTION_LIBELLES[s] }))}
              comboboxProps={{ withinPortal: false }}
            />
            <ExceptionsTable exceptions={v.exceptions.filter((e) => !statut || e.statut === statut)} />
          </>
        )}
      </Stack>
    </Page>
  );
}

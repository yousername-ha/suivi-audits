import { BarreFiltres } from '../components/BarreFiltres';
/* Module Vulnérabilités (ADR 0100, lot S2) : onglet « Tendances ». Courbes jour par jour (30 jours) ou semaine après semaine
   (13, 26 ou 52 semaines) des failles présentes par priorité, des failles exploitées, en dépassement, sous exception et
   corrigées, du niveau d'alerte de la plateforme et, pour un périmètre, des machines et actifs touchés ; indicateur
   « s'améliore / se dégrade / stable » par une règle écrite (à confirmer). L'historique commence à l'installation du lot :
   l'écran dit depuis quand. Courbes en SVG par le composant existant (NeonCourbes), chacune avec sa légende (teinte, trait,
   forme et libellé : jamais la couleur seule) et son équivalent en tableau. Sous la CSP stricte (ADR 0006) : aucun style en
   ligne ; classes de packages/ui/src/neon-tendances.css, jetons de la charte, clair et sombre. */
import { Alert, Anchor, Group, Select, Stack, Table, Text, Title } from '@mantine/core';
import {
  fmtJour,
  type Granularite,
  libellePortee,
  MESURE_DEFINITIONS,
  REGLE_TENDANCE,
  TENDANCE_LIBELLES,
  type TendancesDto,
} from '@suivi/shared';
import {
  cheminMarque,
  DataTable,
  ErrorAlert,
  formeMarque,
  FORMES_MARQUES,
  NeonCourbes,
  Page,
  StatusChip,
} from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { EnteteVulnerabilites } from './EnteteVulnerabilites';
import { get } from '../api';
import { fmtDate } from '../components/common';
import { useCan } from '../session';
import {
  ADRESSE_RAPPORT,
  cellule,
  CLE_TENDANCES,
  libelleNiveau,
  OPTIONS_PERIODE_TENDANCES,
  optionsPortee,
  type PointTendance,
  pointsAffiches,
  PORTEE_TOUT,
  type SerieTendance,
  serieNiveau,
  seriesParc,
  seriesPriorites,
  seriesSuivi,
  TENDANCE_FLECHE,
  TENDANCE_PUCE,
  urlTendances,
} from './tendances-presentation';

/** Légende d'une courbe : pour chaque série, son trait, sa marque et son libellé. */
export function LegendeCourbe({ series }: { series: readonly SerieTendance[] }) {
  return (
    <ul className="vt-legende" aria-label="Légende">
      {series.map((s, i) => (
        <li key={s.cle}>
          <svg viewBox="0 0 24 10" aria-hidden="true" className={s.classe}>
            <line x1="1" x2="23" y1="5" y2="5" className={`neon-courbe neon-trait-${i % FORMES_MARQUES.length}`} />
            <path className="neon-marque" d={cheminMarque(formeMarque(i), 12, 5, 3)} />
          </svg>
          <span>{s.libelle}</span>
        </li>
      ))}
    </ul>
  );
}

/** Une courbe et son tableau (mêmes valeurs ; « — » : aucun instantané). */
export function CourbeTendance({
  titre,
  description,
  series,
  points,
  granularite,
  entieres = true,
}: {
  titre: string;
  description: string;
  series: readonly SerieTendance[];
  points: readonly PointTendance[];
  granularite: Granularite;
  entieres?: boolean;
}) {
  const id = useId();
  const premier = points[0]?.etiquetteLongue ?? '';
  const dernier = points.at(-1)?.etiquetteLongue ?? '';
  return (
    <section className="vt-bloc" aria-labelledby={id}>
      <Title order={2} size="h4" id={id}>
        {titre}
      </Title>
      <details className="a-propos">
        <summary>Lire ce graphique</summary>
        <div className="a-propos__texte">{description}</div>
      </details>
      <LegendeCourbe series={series} />
      <div className="vt-graphique">
        <NeonCourbes
          titre={`${titre}, ${granularite === 'jour' ? 'jour par jour' : 'semaine après semaine'}, du ${premier} au ${dernier}`}
          debut={points[0]?.etiquette ?? ''}
          fin={points.at(-1)?.etiquette ?? ''}
          series={series.map((s) => ({ libelle: s.libelle, valeurs: s.valeurs, classe: s.classe }))}
          etiquettes={points.map((p) => p.etiquetteLongue)}
          marques
          entieres={entieres}
        />
      </div>
      <DataTable label={`${titre} : tableau`}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{granularite === 'jour' ? 'Jour' : 'Semaine'}</Table.Th>
              {series.map((s) => (
                <Table.Th key={s.cle}>{s.libelle}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {points.map((p, k) => (
              <Table.Tr key={p.etiquetteLongue}>
                <Table.Td>{p.etiquetteLongue}</Table.Td>
                {series.map((s) => (
                  <Table.Td key={s.cle}>
                    {s.cle === 'niveau'
                      ? libelleNiveau(s.valeurs[k] as 1 | 2 | 3 | 4 | null)
                      : cellule(s.valeurs[k] ?? null)}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataTable>
    </section>
  );
}

/** Indicateur de tendance : libellé, flèche en texte, explication et règle (à confirmer). */
export function IndicateurTendance({ tendance }: { tendance: TendancesDto['tendance'] }) {
  return (
    <section className="vt-indicateur" aria-label="Tendance de la période">
      <Group gap="xs">
        <Text fw={600}>Tendance de la période :</Text>
        <StatusChip etat={TENDANCE_PUCE[tendance.sens]}>
          <span aria-hidden="true">{TENDANCE_FLECHE[tendance.sens]} </span>
          {TENDANCE_LIBELLES[tendance.sens]}
        </StatusChip>
      </Group>
      <Text size="sm">{tendance.explication}</Text>
      <details className="a-propos">
        <summary>Règle de tendance</summary>
        <div className="a-propos__texte">{REGLE_TENDANCE}</div>
      </details>
    </section>
  );
}

export function TendancesVue({ v }: { v: TendancesDto }) {
  const points = pointsAffiches(v);
  const parPerimetre = v.perimetre.id !== null || v.perimetre.aucun;
  return (
    <Stack>
      <Text size="sm">
        {v.depuis ? (
          <>
            Historique depuis le <span className="horodatage">{fmtJour(v.depuis)}</span> : la plateforme prend un
            instantané de la situation chaque jour, à partir de l’installation de cette fonction ; aucun passé n’est
            reconstruit. Instantanés gardés {v.retentionAns} ans (à confirmer par le RSSI).
          </>
        ) : (
          <>
            Aucun instantané encore : l’historique commence à l’installation de cette fonction, et le premier instantané
            est pris dans la minute qui suit. Aucun passé n’est reconstruit.
          </>
        )}
      </Text>
      <IndicateurTendance tendance={v.tendance} />
      <CourbeTendance
        titre="Failles présentes par priorité"
        description={`Une faille (CVE, ou constat de Tenable sans CVE) compte une fois, avec sa priorité calculée par la plateforme, la même pour tout le monde. ${v.granularite === 'semaine' ? 'Nombres du dernier instantané de chaque semaine.' : ''}`}
        series={seriesPriorites(points)}
        points={points}
        granularite={v.granularite}
      />
      <CourbeTendance
        titre="Exploitation, délais, exceptions et corrections"
        description={`Exploitées et présentes : ${MESURE_DEFINITIONS.exploitees}. En dépassement : ${MESURE_DEFINITIONS.depassements}. Sous exception : ${MESURE_DEFINITIONS.exceptions}. Corrigées : ${MESURE_DEFINITIONS.corrigeesVeille}, lues dans l’instantané du lendemain.`}
        series={seriesSuivi(points, v.granularite)}
        points={points}
        granularite={v.granularite}
      />
      <CourbeTendance
        titre="Niveau d’alerte de la plateforme"
        description="De 1 (Veille) à 4 (Maximale) ; le même pour tout le monde, quel que soit le périmètre choisi."
        series={serieNiveau(points, v.granularite)}
        points={points}
        granularite={v.granularite}
      />
      {parPerimetre ? (
        <CourbeTendance
          titre="Machines et actifs exposés touchés"
          description={`Machines : ${MESURE_DEFINITIONS.machines}. Actifs : ${MESURE_DEFINITIONS.actifs}. Comptés dans la portée choisie.`}
          series={seriesParc(points)}
          points={points}
          granularite={v.granularite}
        />
      ) : (
        <Text size="sm" c="dimmed">
          Les nombres de machines et d’actifs exposés touchés se lisent par périmètre : choisissez un périmètre.
        </Text>
      )}
    </Stack>
  );
}

export function TendancesPage() {
  const lire = useCan()('vulnerabilites', 'lire');
  const [periode, setPeriode] = useState('30');
  const [portee, setPortee] = useState(PORTEE_TOUT);
  const vue = useQuery({
    queryKey: [...CLE_TENDANCES, periode, portee],
    queryFn: () => get<TendancesDto>(urlTendances(Number(periode), portee)),
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
      <EnteteVulnerabilites
        title="Tendances"
        description="La situation semaine après semaine (ou jour par jour sur 30 jours) : failles ouvertes par priorité, corrections, dépassements et niveau d’alerte, pour toute la plateforme ou un périmètre que vous lisez. Les nombres de failles sont calculés par la plateforme, les mêmes pour tout le monde. Aucun nom de machine ici."
      />
      <Stack>
        <ErrorAlert error={vue.error} />
        <BarreFiltres label="Affichage et filtres">
          <Select
            label="Période"
            allowDeselect={false}
            value={periode}
            onChange={(x) => setPeriode(x ?? '30')}
            data={OPTIONS_PERIODE_TENDANCES}
            comboboxProps={{ withinPortal: false }}
          />
          <Select
            label="Périmètre"
            allowDeselect={false}
            value={portee}
            onChange={(x) => setPortee(x ?? PORTEE_TOUT)}
            data={v ? optionsPortee(v) : [{ value: PORTEE_TOUT, label: 'Toute la plateforme' }]}
            comboboxProps={{ withinPortal: false }}
          />
        </BarreFiltres>
        {v && (
          <>
            <Text size="xs" c="dimmed">
              {libellePortee(v.perimetre)}, du {fmtJour(v.du)} au {fmtJour(v.au)} · calculé le{' '}
              <span className="horodatage">{fmtDate(v.calculeLe)}</span> ·{' '}
              <Anchor component={Link} to={ADRESSE_RAPPORT} size="xs">
                Rapport de pilotage
              </Anchor>
            </Text>
            <TendancesVue v={v} />
          </>
        )}
      </Stack>
    </Page>
  );
}

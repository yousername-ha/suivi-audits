/* Couverture du cycle (reprise de « Couverture du cycle ») : ce qui a été audité chaque année, par l'AFNOR et en
   interne ; une pastille passe de vide à prévue puis auditée. Écarts et pronostic de chaque exigence en regard. */
import { Button, Group, SegmentedControl, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { LV, itemCode, nextCoverage } from '@suivi/shared/audit';
import { DataTable } from '@suivi/ui';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { CycleAudit } from './CycleAudit';
import { libelleAnnee, useActionAudit, useAudit } from './commun';

const ETIQUETTE = { '': 'non auditée', P: 'prévue', X: 'auditée' } as const;

export function CouvertureCycle() {
  const { q, d, analyses } = useAudit();
  const can = useCan(),
    modifiable = can('audit', 'modifier'),
    agir = useActionAudit(),
    [erreur, setErreur] = useState<unknown>(null),
    [recherche, setRecherche] = useState(''),
    [ref, setRef] = useState('all'),
    [nonVues, setNonVues] = useState(false),
    [anglesMorts, setAnglesMorts] = useState(false),
    [avecEcart, setAvecEcart] = useState(false),
    [cycle, setCycle] = useState(false);
  if (!d) return <ErrorAlert error={q.error} />;
  if (!d.items.length) return <Text>Aucune exigence dans l’état de l’outil de suivi.</Text>;
  const P = d.nextYear - 1;
  const terme = recherche.trim().toLowerCase();
  const garde = (i: (typeof d.items)[number]) => {
    const a = analyses[i.id]!;
    if (ref !== 'all' && i.ref !== ref) return false;
    if (nonVues && !a.notSeen) return false;
    if (anglesMorts && !a.blind) return false;
    if (avecEcart && !a.open.length) return false;
    return !terme || itemCode(i).toLowerCase().includes(terme) || i.title.toLowerCase().includes(terme);
  };
  const marquer = (id: string, source: 'afnor' | 'interne', year: number, v: string | undefined) => {
    setErreur(null);
    agir('POST', '/couverture', { id, source, year, valeur: nextCoverage(v) }).catch(setErreur);
  };
  const groupes = d.groups
    .map((g) => ({ g, items: d.items.filter((i) => i.group === g.id && garde(i)) }))
    .filter((x) => x.items.length);
  const affichees = groupes.reduce((n, x) => n + x.items.length, 0);
  const colonnes = (source: 'afnor' | 'interne', it: (typeof d.items)[number]) =>
    d.years.map((y) => {
      const v = it[source][y] ?? '';
      const etat = ETIQUETTE[(v as keyof typeof ETIQUETTE) in ETIQUETTE ? (v as keyof typeof ETIQUETTE) : ''];
      const lib = `${itemCode(it)}, ${source === 'afnor' ? 'AFNOR' : 'interne'} ${y} : ${etat}`;
      return (
        <Table.Td key={source + y}>
          <button
            type="button"
            className={`audit-marque audit-marque-${source}${v === 'X' ? ' audit-marque-x' : v === 'P' ? ' audit-marque-p' : ''}`}
            aria-label={lib}
            title={lib}
            disabled={!modifiable}
            onClick={() => marquer(it.id, source, y, v)}
          />
        </Table.Td>
      );
    });
  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Couverture sur le cycle</Text>
          <Text size="sm" c="dimmed">
            Ce qui a été audité chaque année, par l’AFNOR et en interne. Sélectionnez une pastille pour la faire passer
            de vide à prévue puis auditée.
          </Text>
        </div>
        <Button variant="default" onClick={() => setCycle(true)}>
          Cycle d’audit
        </Button>
      </Group>
      <ErrorAlert error={erreur} />
      <Group align="flex-end">
        <TextInput
          label="Rechercher"
          placeholder="Une mesure ou un numéro"
          value={recherche}
          onChange={(e) => setRecherche(e.currentTarget.value)}
        />
        <SegmentedControl
          aria-label="Référentiel"
          value={ref}
          onChange={setRef}
          data={[
            { value: 'all', label: 'Tout' },
            { value: 'ISO', label: 'Clauses' },
            { value: 'A', label: 'Annexe A' },
            { value: 'HDS', label: 'HDS' },
          ]}
        />
        <Switch label={`Non vues AFNOR ${P}`} checked={nonVues} onChange={(e) => setNonVues(e.currentTarget.checked)} />
        <Switch
          label={`Angles morts ${P}`}
          checked={anglesMorts}
          onChange={(e) => setAnglesMorts(e.currentTarget.checked)}
        />
        <Switch label="Avec écart ouvert" checked={avecEcart} onChange={(e) => setAvecEcart(e.currentTarget.checked)} />
        <Text size="sm" c="dimmed">
          {affichees} mesure{affichees > 1 ? 's' : ''} affichée{affichees > 1 ? 's' : ''}
        </Text>
      </Group>
      {!affichees && <Text size="sm">Aucune mesure ne correspond à ces filtres.</Text>}
      {!!affichees && (
        <DataTable label="Couverture du cycle">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th rowSpan={2}>Mesure</Table.Th>
                <Table.Th colSpan={d.years.length}>AFNOR Certification</Table.Th>
                <Table.Th colSpan={d.years.length}>Audit interne</Table.Th>
                <Table.Th rowSpan={2}>Écarts</Table.Th>
                <Table.Th rowSpan={2}>Pronostic {d.nextYear}</Table.Th>
              </Table.Tr>
              <Table.Tr>
                {[...d.years, ...d.years].map((y, k) => (
                  <Table.Th key={k}>
                    {y}
                    <Text size="xs" c="dimmed">
                      {libelleAnnee(d, y)}
                    </Text>
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {groupes.flatMap(({ g, items }) => [
                <Table.Tr key={g.id}>
                  <Table.Td colSpan={3 + d.years.length * 2}>
                    <Text fw={600} size="sm">
                      {g.ref === 'A' ? `A.${g.num} ${g.title}` : g.ref === 'HDS' ? g.title : `${g.num}. ${g.title}`} (
                      {items.length})
                    </Text>
                  </Table.Td>
                </Table.Tr>,
                ...items.map((it) => {
                  const a = analyses[it.id]!;
                  return (
                    <Table.Tr key={it.id}>
                      <Table.Td>
                        <b>{itemCode(it)}</b> {it.title}
                      </Table.Td>
                      {colonnes('afnor', it)}
                      {colonnes('interne', it)}
                      <Table.Td>
                        {a.findings.length
                          ? a.findings
                              .map(
                                (f) =>
                                  `${f.type} ${f.source === 'AFNOR' ? 'A' : 'I'}${f.status === 'Clos' ? ' (clos)' : ''}`,
                              )
                              .join(', ')
                          : '–'}
                      </Table.Td>
                      <Table.Td>
                        <span className={`audit-niveau audit-niv-${a.level}`}>{LV[a.level].l}</span>
                      </Table.Td>
                    </Table.Tr>
                  );
                }),
              ])}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
      <Group component="ul" className="audit-legende" gap="md">
        <li>
          <span className="audit-marque audit-marque-afnor audit-marque-x" aria-hidden="true" />
          Auditée AFNOR
        </li>
        <li>
          <span className="audit-marque audit-marque-interne audit-marque-x" aria-hidden="true" />
          Auditée en interne
        </li>
        <li>
          <span className="audit-marque audit-marque-afnor audit-marque-p" aria-hidden="true" />
          Prévue
        </li>
        <li>
          <span className="audit-marque" aria-hidden="true" />
          Non auditée
        </li>
      </Group>
      {cycle && <CycleAudit d={d} ouvert modifiable={modifiable} onClose={() => setCycle(false)} />}
    </Stack>
  );
}

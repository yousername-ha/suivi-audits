/* Plan d'investissement (reprise de la page « Investissements » de l'outil de suivi) : budget sécurité sur trois ans à
   partir de l'année de référence, lignes budgétaires, renouvellements et comparaison des options. Données lues et
   écrites dans l'état historique (clé `invest`), sous verrou. */
import { Anchor, Button, Group, Modal, SegmentedControl, Stack, Table, Tabs, Text } from '@mantine/core';
import { useState } from 'react';
import {
  NATURES_INVEST,
  PRIORITES_INVEST,
  STATUTS_INVEST,
  comparerOptions,
  etatRenouvellement,
  ligneVivante,
  niveauStatutInvest,
  renouvellements,
  syntheseInvest,
  totalInvest,
  trierLignesInvest,
  type LigneInvest,
} from '@suivi/shared';
import { ConfirmButton, DataTable, StatusChip, type Etat } from '@suivi/ui';
import { ErrorAlert } from '../components/common';
import { ChampChoix, ChampTexte, ChampZone, useModule } from '../historique/champs';
import { Anneau, BarresEmpilees, Chiffres, LegendeSeries } from '../historique/graphiques';
import { useCan } from '../session';

interface Donnees {
  version: number;
  anneeN: number;
  lignes: LigneInvest[];
  fournisseurs: { id: string; name: string }[];
}
const ETAT: Record<'ok' | 'info' | 'mid' | 'bad' | 'na', Etat> = {
  ok: 'succes',
  info: 'info',
  mid: 'attention',
  bad: 'erreur',
  na: 'neutre',
};
const euros = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`;
const euroCourt = (v: number) => (v >= 1000 ? `${Math.round(v / 1000).toLocaleString('fr-FR')} k€` : euros(v));
const jourFr = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : '');
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const STATUT = (s: string) => <StatusChip etat={ETAT[niveauStatutInvest(s)]}>{s}</StatusChip>;

export function Investissements() {
  const can = useCan(),
    modifiable = can('investissements', 'modifier'),
    { d, agir, erreur } = useModule<Donnees>('investissements', '/api/investissements'),
    [fiche, setFiche] = useState<string | null>(null),
    [filtre, setFiltre] = useState('all');
  const jour = aujourdhui();
  const ouverte = d?.lignes.find((l) => l.id === fiche) ?? null;
  const s = d ? syntheseInvest(d.lignes, d.anneeN) : null;
  const ren = d ? renouvellements(d.lignes, 120, jour) : [];
  const ligneTableau = (l: LigneInvest) => (
    <Table.Tr key={l.id}>
      <Table.Td>
        <Anchor component="button" type="button" fw={600} onClick={() => setFiche(l.id)}>
          {l.company || '(sans nom)'}
        </Anchor>
        <Text size="xs" c="dimmed">
          {l.desc.slice(0, 70)}
        </Text>
      </Table.Td>
      <Table.Td>{l.type || '–'}</Table.Td>
      <Table.Td>{l.priority || '–'}</Table.Td>
      <Table.Td>{euros(l.n0)}</Table.Td>
      <Table.Td>{euros(l.n1)}</Table.Td>
      <Table.Td>{euros(l.n2)}</Table.Td>
      <Table.Td>
        <b>{euros(totalInvest(l))}</b>
      </Table.Td>
      <Table.Td>{STATUT(l.status)}</Table.Td>
    </Table.Tr>
  );
  const entete = d && (
    <Table.Tr>
      <Table.Th>Société</Table.Th>
      <Table.Th>Type</Table.Th>
      <Table.Th>Priorité</Table.Th>
      <Table.Th>{d.anneeN}</Table.Th>
      <Table.Th>{d.anneeN + 1}</Table.Th>
      <Table.Th>{d.anneeN + 2}</Table.Th>
      <Table.Th>Total 3 ans</Table.Th>
      <Table.Th>Statut</Table.Th>
    </Table.Tr>
  );
  const vues = d?.lignes.filter((l) => filtre === 'all' || l.status === filtre) ?? [];
  const triees = trierLignesInvest(vues);
  const totalAnnee = (k: 'n0' | 'n1' | 'n2') => vues.filter(ligneVivante).reduce((a, l) => a + l[k], 0);
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Plan d’investissement</Text>
          <Text size="sm" c="dimmed">
            {d
              ? `Budget sécurité sur trois ans, à partir de l’année de référence ${d.anneeN}. Les lignes annulées sont exclues des totaux.`
              : 'Budget sécurité sur trois ans.'}
          </Text>
        </div>
        {d && (
          <Group align="flex-end">
            <ChampTexte
              label="Année N"
              type="number"
              value={String(d.anneeN)}
              disabled={!modifiable}
              onCommit={(v) => void agir('PUT', '/api/investissements/annee', { baseYear: Number(v) })}
            />
            {modifiable && (
              <Button
                onClick={async () => {
                  const l = await agir<LigneInvest>('POST', '/api/investissements/lignes');
                  if (l) setFiche(l.id);
                }}
              >
                Ajouter une ligne
              </Button>
            )}
          </Group>
        )}
      </Group>
      {d && s && (
        <Tabs defaultValue="tableau" keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="tableau">Tableau de bord</Tabs.Tab>
            <Tabs.Tab value="lignes">Lignes budgétaires</Tabs.Tab>
            <Tabs.Tab value="renouvellements">Renouvellements</Tabs.Tab>
            <Tabs.Tab value="comparaison">Comparaison des options</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="tableau" pt="md">
            <Stack>
              <Chiffres
                items={[
                  {
                    valeur: euros(s.budgetN),
                    libelle: `Budget ${d.anneeN}`,
                    detail: `dont ${euros(s.budgetNEnPlace)} en place`,
                  },
                  { valeur: euros(s.total3ans), libelle: 'Total sur 3 ans', detail: `${d.anneeN} à ${d.anneeN + 2}` },
                  {
                    valeur: s.previsionnels.nombre,
                    libelle: 'Projets prévisionnels',
                    detail: `${euros(s.previsionnels.total)} sur 3 ans`,
                  },
                  {
                    valeur: ren.length,
                    libelle: 'Renouvellements à 120 jours',
                    detail: ren[0]
                      ? `prochain : ${ren[0].company} (${jourFr(ren[0].renewal)})`
                      : 'aucune échéance proche',
                  },
                ]}
              />
              <Group align="flex-start" grow>
                <Stack gap="xs">
                  <Text fw={600}>Budget par année</Text>
                  <BarresEmpilees
                    ariaLabel="Budget par année et par statut"
                    colonnes={s.parAnnee.map((a) => ({
                      libelle: String(a.annee),
                      valeurs: { a: a.enPlace, b: a.valide, c: a.previsionnel },
                    }))}
                    series={[
                      { cle: 'a', libelle: 'En place', teinte: 0 },
                      { cle: 'b', libelle: 'Validé', teinte: 1 },
                      { cle: 'c', libelle: 'Prévisionnel', teinte: 5 },
                    ]}
                    sommet={Math.max(1, ...s.parAnnee.map((a) => a.enPlace + a.valide + a.previsionnel)) * 1.18}
                    formatAxe={euroCourt}
                    formatTotal={euroCourt}
                  />
                  <LegendeSeries
                    series={[
                      { cle: 'a', libelle: 'En place', teinte: 0 },
                      { cle: 'b', libelle: 'Validé', teinte: 1 },
                      { cle: 'c', libelle: 'Prévisionnel', teinte: 5 },
                    ]}
                  />
                </Stack>
                <Stack gap="xs">
                  <Text fw={600}>Répartition par périmètre (total 3 ans)</Text>
                  <Anneau
                    ariaLabel="Répartition du budget par périmètre"
                    centre={Math.round(s.total3ans).toLocaleString('fr-FR')}
                    sous="€ sur 3 ans"
                    parts={s.parPerimetre.map((p, i) => ({
                      libelle: p.libelle,
                      valeur: p.valeur,
                      teinte: i % 6,
                      texte: euros(p.valeur),
                    }))}
                  />
                </Stack>
              </Group>
              <Text fw={600}>Renouvellements à venir</Text>
              {ren.length ? (
                <ul>
                  {ren.slice(0, 6).map((l) => (
                    <li key={l.id}>
                      <Anchor component="button" type="button" onClick={() => setFiche(l.id)}>
                        {l.company} — {l.type}
                      </Anchor>{' '}
                      <StatusChip etat={l.renewal < jour ? 'erreur' : 'attention'}>{jourFr(l.renewal)}</StatusChip>
                    </li>
                  ))}
                </ul>
              ) : (
                <Text size="sm">Aucune échéance proche.</Text>
              )}
              <Text fw={600}>Principales lignes</Text>
              <DataTable label="Principales lignes">
                <Table>
                  <Table.Thead>{entete}</Table.Thead>
                  <Table.Tbody>
                    {s.principales.map(ligneTableau)}
                    {!s.principales.length && (
                      <Table.Tr>
                        <Table.Td colSpan={8}>Aucune ligne : ajoutez une ligne budgétaire.</Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </DataTable>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="lignes" pt="md">
            <Stack>
              <Text size="sm" c="dimmed">
                {d.lignes.length} ligne(s). Totaux hors lignes annulées.
              </Text>
              <SegmentedControl
                aria-label="Filtre par statut"
                value={filtre}
                onChange={setFiltre}
                data={[{ value: 'all', label: 'Toutes' }, ...STATUTS_INVEST.map((x) => ({ value: x, label: x }))]}
              />
              <DataTable label="Lignes budgétaires">
                <Table>
                  <Table.Thead>{entete}</Table.Thead>
                  <Table.Tbody>
                    {triees.map(ligneTableau)}
                    {!triees.length && (
                      <Table.Tr>
                        <Table.Td colSpan={8}>Aucune ligne : ajoutez une ligne budgétaire.</Table.Td>
                      </Table.Tr>
                    )}
                    <Table.Tr>
                      <Table.Td>
                        <b>Total</b>
                      </Table.Td>
                      <Table.Td />
                      <Table.Td />
                      <Table.Td>
                        <b>{euros(totalAnnee('n0'))}</b>
                      </Table.Td>
                      <Table.Td>
                        <b>{euros(totalAnnee('n1'))}</b>
                      </Table.Td>
                      <Table.Td>
                        <b>{euros(totalAnnee('n2'))}</b>
                      </Table.Td>
                      <Table.Td>
                        <b>{euros(totalAnnee('n0') + totalAnnee('n1') + totalAnnee('n2'))}</b>
                      </Table.Td>
                      <Table.Td />
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </DataTable>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="renouvellements" pt="md">
            <Stack>
              <Text size="sm" c="dimmed">
                Échéances des abonnements, licences et contrats ; le préavis (en jours) déclenche l’alerte « à anticiper
                ».
              </Text>
              <DataTable label="Renouvellements">
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Société</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Nature</Table.Th>
                      <Table.Th>Renouvellement</Table.Th>
                      <Table.Th>Préavis</Table.Th>
                      <Table.Th>État</Table.Th>
                      <Table.Th>Coût {d.anneeN + 1}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {d.lignes
                      .filter(ligneVivante)
                      .sort((a, b) => (a.renewal || '9').localeCompare(b.renewal || '9'))
                      .map((l) => {
                        const [lib, niv] = etatRenouvellement(l, jour);
                        return (
                          <Table.Tr key={l.id}>
                            <Table.Td>
                              <Anchor component="button" type="button" fw={600} onClick={() => setFiche(l.id)}>
                                {l.company || '(sans nom)'}
                              </Anchor>
                            </Table.Td>
                            <Table.Td>{l.type}</Table.Td>
                            <Table.Td>{l.nature}</Table.Td>
                            <Table.Td>{jourFr(l.renewal) || '–'}</Table.Td>
                            <Table.Td>{l.notice} j</Table.Td>
                            <Table.Td>
                              <StatusChip etat={ETAT[niv]}>{lib}</StatusChip>
                            </Table.Td>
                            <Table.Td>{euros(l.n1)}</Table.Td>
                          </Table.Tr>
                        );
                      })}
                    {!d.lignes.filter(ligneVivante).length && (
                      <Table.Tr>
                        <Table.Td colSpan={7}>Aucune ligne.</Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </DataTable>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="comparaison" pt="md">
            <Stack>
              <Text size="sm" c="dimmed">
                Lignes de même type comparées sur le coût à 3 ans, avec les alternatives indiquées.
              </Text>
              {comparerOptions(d.lignes).map((g) => (
                <Stack key={g.type} gap="xs">
                  <Text fw={600}>
                    {g.type}{' '}
                    <Text span size="xs" c="dimmed">
                      ({g.options.length} option(s))
                    </Text>
                  </Text>
                  <DataTable label={`Options ${g.type}`}>
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Société</Table.Th>
                          <Table.Th>Description</Table.Th>
                          <Table.Th>{d.anneeN}</Table.Th>
                          <Table.Th>Total 3 ans</Table.Th>
                          <Table.Th>Alternative</Table.Th>
                          <Table.Th>Statut</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {g.options.map((l) => (
                          <Table.Tr key={l.id}>
                            <Table.Td>
                              <Anchor component="button" type="button" fw={600} onClick={() => setFiche(l.id)}>
                                {l.company || '(sans nom)'}
                              </Anchor>{' '}
                              {ligneVivante(l) && totalInvest(l) === g.minimum && (
                                <StatusChip etat="succes">moins cher</StatusChip>
                              )}
                            </Table.Td>
                            <Table.Td>{l.desc.slice(0, 90)}</Table.Td>
                            <Table.Td>{euros(l.n0)}</Table.Td>
                            <Table.Td>
                              <b>{euros(totalInvest(l))}</b>
                            </Table.Td>
                            <Table.Td>{l.alt || '–'}</Table.Td>
                            <Table.Td>{STATUT(l.status)}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </DataTable>
                </Stack>
              ))}
              {!comparerOptions(d.lignes).length && <Text size="sm">Aucun type ne comporte plusieurs options.</Text>}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      )}
      <Modal
        opened={!!ouverte}
        onClose={() => setFiche(null)}
        lockScroll={false}
        size="lg"
        title={ouverte ? `${ouverte.id} — ${ouverte.company || 'Ligne budgétaire'}` : ''}
      >
        {ouverte && d && (
          <FicheLigne
            l={ouverte}
            d={d}
            modifiable={modifiable}
            maj={(champ) => void agir('PATCH', `/api/investissements/lignes/${encodeURIComponent(ouverte.id)}`, champ)}
            supprimer={async () => {
              await agir('DELETE', `/api/investissements/lignes/${encodeURIComponent(ouverte.id)}`);
              setFiche(null);
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}

function FicheLigne({
  l,
  d,
  modifiable,
  maj,
  supprimer,
}: {
  l: LigneInvest;
  d: Donnees;
  modifiable: boolean;
  maj: (c: Record<string, unknown>) => void;
  supprimer: () => Promise<void>;
}) {
  const peutSupprimer = useCan()('investissements', 'supprimer');
  const montant = (cle: 'n0' | 'n1' | 'n2', libelle: string) => (
    <ChampTexte
      key={`${cle}-${l[cle]}`}
      label={libelle}
      type="number"
      value={String(l[cle])}
      disabled={!modifiable}
      onCommit={(v) => maj({ [cle]: Number(v) || 0 })}
    />
  );
  return (
    <Stack key={l.id}>
      <StatusChip etat={ETAT[niveauStatutInvest(l.status)]}>{l.status}</StatusChip>
      <div className="grille-formulaire">
        <div className="grille-formulaire__champs">
          <ChampTexte label="Société" value={l.company} disabled={!modifiable} onCommit={(v) => maj({ company: v })} />
          <ChampChoix
            label="Priorité"
            value={l.priority}
            options={PRIORITES_INVEST.filter(Boolean)}
            effacable
            disabled={!modifiable}
            onCommit={(v) => maj({ priority: v })}
          />
          <ChampTexte label="Type" value={l.type} disabled={!modifiable} onCommit={(v) => maj({ type: v })} />
          <ChampChoix
            label="Statut"
            value={l.status}
            options={STATUTS_INVEST}
            disabled={!modifiable}
            onCommit={(v) => maj({ status: v })}
          />
        </div>
      </div>
      <ChampZone label="Description" value={l.desc} disabled={!modifiable} onCommit={(v) => maj({ desc: v })} />
      <div className="grille-formulaire">
        <div className="grille-formulaire__champs">
          {montant('n0', `Prix ${d.anneeN} (€ TTC)`)}
          {montant('n1', String(d.anneeN + 1))}
          {montant('n2', String(d.anneeN + 2))}
          <div>
            <Text size="sm" fw={500}>
              Total 3 ans
            </Text>
            <Text fw={700}>{euros(totalInvest(l))}</Text>
          </div>
          <ChampChoix
            label="Nature"
            value={l.nature}
            options={NATURES_INVEST}
            disabled={!modifiable}
            onCommit={(v) => maj({ nature: v })}
          />
          <ChampTexte
            label="Date de renouvellement"
            type="date"
            value={l.renewal}
            disabled={!modifiable}
            onCommit={(v) => maj({ renewal: v })}
          />
          <ChampTexte
            label="Préavis (jours)"
            type="number"
            value={String(l.notice)}
            disabled={!modifiable}
            onCommit={(v) => maj({ notice: Math.max(0, Math.round(Number(v) || 0)) })}
          />
          <ChampTexte
            label="Périmètre"
            value={l.perimeter}
            disabled={!modifiable}
            onCommit={(v) => maj({ perimeter: v })}
          />
          <ChampTexte
            label="Code comptable"
            value={l.account}
            disabled={!modifiable}
            onCommit={(v) => maj({ account: v })}
          />
          <ChampChoix
            label="Fournisseur lié"
            value={l.supplier}
            options={d.fournisseurs.map((f) => ({ value: f.id, label: f.name }))}
            effacable
            disabled={!modifiable}
            onCommit={(v) => maj({ supplier: v })}
          />
        </div>
      </div>
      <ChampZone label="Alternative" value={l.alt} disabled={!modifiable} onCommit={(v) => maj({ alt: v })} />
      <ChampZone label="Commentaires" value={l.comment} disabled={!modifiable} onCommit={(v) => maj({ comment: v })} />
      {modifiable && peutSupprimer && (
        <Group justify="flex-end">
          <ConfirmButton message={`Supprimer la ligne ${l.company || l.id} ?`} onConfirm={supprimer} variant="light">
            Supprimer la ligne
          </ConfirmButton>
        </Group>
      )}
    </Stack>
  );
}

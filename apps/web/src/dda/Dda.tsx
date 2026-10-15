/* Déclaration d'applicabilité (reprise des pages « Clauses ISO 27001 », « Annexe A (DdA) » et « HDS (DdA) » de l'outil de
   suivi) : applicabilité et niveau de mise en œuvre de chaque mesure, indicateurs, incohérences (mesure « Total » avec un
   écart ouvert), documents associés et écarts ouverts. Le niveau de mise en œuvre de la DdA alimente la couverture
   présumée des autres référentiels. Données lues et écrites dans l'état historique (clé `dda`), sous verrou. L'import
   Excel de l'outil historique n'est pas repris. */
import { Anchor, Card, Group, Modal, SegmentedControl, Stack, Table, Text } from '@mantine/core';
import { useState } from 'react';
import {
  LIBELLES_REFERENTIEL_DDA,
  NIVEAUX_DDA,
  NIVEAU_DDA,
  codeMesure,
  ecartsOuvertsMesure,
  filtrerMesures,
  incoherente,
  lienDocument,
  lireDda,
  statsDda,
  type Dda as Declaration,
  type EcartDda,
  type FiltreDda,
  type MesureDda,
  type ReferenceDda,
} from '@suivi/shared';
import { DataTable, StatusChip, type Etat } from '@suivi/ui';
import { ErrorAlert } from '../components/common';
import { ChampChoix, ChampTexte, ChampZone, useModule } from '../historique/champs';
import { BarreRepartition, Chiffres } from '../historique/graphiques';
import { useCan } from '../session';

interface Donnees {
  version: number;
  reference: ReferenceDda;
  mesures: MesureDda[];
  dda: Record<string, Declaration>;
  ecarts: EcartDda[];
}
const ETAT: Record<'ok' | 'mid' | 'bad', Etat> = { ok: 'succes', mid: 'attention', bad: 'erreur' };
const APPLICABLE = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
];

function LienDocument({ url, libelle = 'Ouvrir le document' }: { url: string; libelle?: string }) {
  const h = lienDocument(url);
  return h ? (
    <Anchor href={h} target="_blank" rel="noopener noreferrer" size="sm" title={url}>
      {libelle}
    </Anchor>
  ) : null;
}

export function DeclarationApplicabilite({ reference }: { reference: ReferenceDda }) {
  const can = useCan(),
    modifiable = can('audit', 'modifier'),
    { d, agir, erreur } = useModule<Donnees>(`dda-${reference}`, `/api/dda?reference=${reference}`),
    [filtre, setFiltre] = useState<FiltreDda>('all'),
    [fiche, setFiche] = useState<string | null>(null);
  const dda = d?.dda ?? {};
  const st = d ? statsDda(d.mesures, dda, reference) : null;
  const liste = d ? filtrerMesures(d.mesures, dda, d.ecarts, reference, filtre) : [];
  const incoherentes = d ? d.mesures.filter((m) => incoherente(m, dda, d.ecarts)).length : 0;
  const maj = (id: string, champ: Record<string, unknown>) =>
    void agir('PATCH', `/api/dda/${encodeURIComponent(id)}`, champ);
  const ouverte = d?.mesures.find((m) => m.id === fiche) ?? null;
  const iso = reference === 'ISO';
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <div>
        <Text fw={600}>Conformité — {LIBELLES_REFERENTIEL_DDA[reference]} (DdA)</Text>
        <Text size="sm" c="dimmed">
          Déclaration d’applicabilité (ISO 27001 et HDS) et référentiels complémentaires importés. Le niveau de mise en
          œuvre de la DdA alimente la couverture présumée des autres référentiels.
        </Text>
      </div>
      {d && st && (
        <>
          <Chiffres
            items={[
              { valeur: `${st.pct} %`, libelle: 'en mise en œuvre totale' },
              { valeur: st.c.Partiel, libelle: `partielle${st.c.Partiel > 1 ? 's' : ''}` },
              { valeur: st.c.Insuffisant, libelle: `insuffisante${st.c.Insuffisant > 1 ? 's' : ''}` },
              { valeur: st.na, libelle: `exclue${st.na > 1 ? 's' : ''}` },
              { valeur: incoherentes, libelle: '« Total » avec écart ouvert' },
            ]}
          />
          <BarreRepartition
            ariaLabel="Répartition des mesures applicables par niveau de mise en œuvre"
            parts={[
              { libelle: 'Total', valeur: st.c.Total, teinte: 4 },
              { libelle: 'Partiel', valeur: st.c.Partiel, teinte: 3 },
              { libelle: 'Insuffisant', valeur: st.c.Insuffisant, teinte: 2 },
              { libelle: 'Non renseigné', valeur: st.c[''], teinte: 5 },
            ]}
          />
          <Group>
            <SegmentedControl
              aria-label="Filtre des mesures"
              value={filtre}
              onChange={(v) => setFiltre(v as FiltreDda)}
              data={[
                { value: 'all', label: 'Toutes' },
                ...NIVEAUX_DDA.map((n) => ({ value: n, label: n })),
                { value: 'none', label: 'Non renseignées' },
                { value: 'na', label: 'Exclues' },
                { value: 'inc', label: 'Total avec écart ouvert' },
              ]}
            />
            <Text size="sm" c="dimmed">
              {liste.length} mesure{liste.length > 1 ? 's' : ''}
            </Text>
          </Group>
          <DataTable label={`Déclaration d’applicabilité — ${LIBELLES_REFERENTIEL_DDA[reference]}`}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Mesure</Table.Th>
                  <Table.Th>Applicable</Table.Th>
                  <Table.Th>Mise en œuvre</Table.Th>
                  <Table.Th>Actions ou justification</Table.Th>
                  <Table.Th>Document associé</Table.Th>
                  <Table.Th>Écarts</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {liste.map((m) => {
                  const x = dda[m.id] ?? lireDda(null),
                    ecarts = ecartsOuvertsMesure(m.id, d.ecarts),
                    premiereLigne = x.docs.split('\n')[0] ?? '';
                  return (
                    <Table.Tr key={m.id}>
                      <Table.Td>
                        <Anchor component="button" type="button" fw={600} onClick={() => setFiche(m.id)}>
                          {codeMesure(m)}
                        </Anchor>{' '}
                        {m.title}
                      </Table.Td>
                      <Table.Td>
                        {iso ? (
                          <Text size="sm" c="dimmed">
                            Obligatoire
                          </Text>
                        ) : (
                          <ChampChoix
                            ariaLabel={`Applicabilité de ${codeMesure(m)}`}
                            value={x.app}
                            options={APPLICABLE}
                            effacable
                            disabled={!modifiable}
                            onCommit={(v) => maj(m.id, { app: v })}
                          />
                        )}
                      </Table.Td>
                      <Table.Td>
                        {x.app === 'non' ? (
                          <Text size="sm" c="dimmed">
                            Exclue
                          </Text>
                        ) : (
                          <ChampChoix
                            ariaLabel={`Niveau de ${codeMesure(m)}`}
                            value={x.level}
                            options={NIVEAUX_DDA}
                            effacable
                            disabled={!modifiable}
                            onCommit={(v) => maj(m.id, { level: v })}
                          />
                        )}
                      </Table.Td>
                      <Table.Td>{x.app === 'non' ? x.just : x.actions}</Table.Td>
                      <Table.Td>
                        {premiereLigne}
                        {x.docs.includes('\n') ? ' …' : ''}
                        <div>
                          <LienDocument url={x.url} />
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {ecarts.map((e) => (
                            <StatusChip key={e.id} etat={e.type.startsWith('NC') ? 'erreur' : 'attention'}>
                              {e.id}
                            </StatusChip>
                          ))}
                          {/tenacy/i.test(x.comment) && <StatusChip etat="info">Tenacy</StatusChip>}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {!liste.length && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>Aucune mesure.</Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </DataTable>
        </>
      )}
      <Modal
        opened={!!ouverte}
        onClose={() => setFiche(null)}
        lockScroll={false}
        size="lg"
        title={ouverte ? `${codeMesure(ouverte)} — ${ouverte.title}` : ''}
      >
        {ouverte && d && (
          <FicheMesure
            m={ouverte}
            x={dda[ouverte.id] ?? lireDda(null)}
            ecarts={ecartsOuvertsMesure(ouverte.id, d.ecarts)}
            modifiable={modifiable}
            maj={(champ) => maj(ouverte.id, champ)}
          />
        )}
      </Modal>
    </Stack>
  );
}

function FicheMesure({
  m,
  x,
  ecarts,
  modifiable,
  maj,
}: {
  m: MesureDda;
  x: Declaration;
  ecarts: EcartDda[];
  modifiable: boolean;
  maj: (c: Record<string, unknown>) => void;
}) {
  const iso = m.ref === 'ISO';
  const niveau = (
    <ChampChoix
      label={iso ? 'Niveau' : 'Mise en œuvre'}
      value={x.level}
      options={NIVEAUX_DDA}
      effacable
      disabled={!modifiable}
      onCommit={(v) => maj({ level: v })}
    />
  );
  return (
    <Stack key={m.id}>
      {ecarts.length > 0 && (
        <Group gap="xs">
          <Text size="sm">Écarts ouverts :</Text>
          {ecarts.map((e) => (
            <StatusChip key={e.id} etat={e.type.startsWith('NC') ? 'erreur' : 'attention'}>
              {e.id}
            </StatusChip>
          ))}
        </Group>
      )}
      {x.level && NIVEAU_DDA[x.level as keyof typeof NIVEAU_DDA] && (
        <div>
          <StatusChip etat={ETAT[NIVEAU_DDA[x.level as keyof typeof NIVEAU_DDA]]}>{x.level}</StatusChip>
        </div>
      )}
      <details open={!!m.refText}>
        <summary>Texte de référence{m.refText ? '' : ' (à saisir depuis votre exemplaire)'}</summary>
        <ChampZone
          ariaLabel="Texte de référence"
          lignes={m.refText ? 6 : 3}
          placeholder="Texte de l’exigence et recommandations, saisis par vous."
          value={m.refText}
          disabled={!modifiable}
          onCommit={(v) => maj({ refText: v })}
        />
      </details>
      <Card withBorder>
        <Stack>
          <Text fw={600}>{iso ? 'Mise en œuvre de l’exigence' : 'Déclaration d’applicabilité'}</Text>
          {!iso && x.req && (
            <Text size="sm" c="dimmed" className="evaluation-texte">
              {x.req.slice(0, 600)}
              {x.req.length > 600 ? '…' : ''}
            </Text>
          )}
          <div className="grille-formulaire">
            <div className="grille-formulaire__champs">
              {!iso && (
                <ChampChoix
                  label="Applicable"
                  value={x.app}
                  options={APPLICABLE}
                  effacable
                  disabled={!modifiable}
                  onCommit={(v) => maj({ app: v })}
                />
              )}
              {niveau}
              {!iso && (
                <ChampTexte
                  label="Risques traités"
                  value={x.risk}
                  disabled={!modifiable}
                  onCommit={(v) => maj({ risk: v })}
                />
              )}
            </div>
          </div>
          {!iso && (
            <ChampZone label="Justification" value={x.just} disabled={!modifiable} onCommit={(v) => maj({ just: v })} />
          )}
          {!iso && (
            <ChampZone label="Actions" value={x.actions} disabled={!modifiable} onCommit={(v) => maj({ actions: v })} />
          )}
          <ChampZone
            label="Documents associés"
            value={x.docs}
            disabled={!modifiable}
            onCommit={(v) => maj({ docs: v })}
          />
          <ChampTexte
            label="Lien vers le document (URL ou chemin réseau)"
            placeholder="https://… ou \\serveur\partage\document.pdf"
            value={x.url}
            disabled={!modifiable}
            onCommit={(v) => maj({ url: v })}
          />
          <LienDocument url={x.url} />
          <ChampTexte
            label={iso ? 'Commentaire' : 'Commentaire de la revue'}
            value={x.comment}
            disabled={!modifiable}
            onCommit={(v) => maj({ comment: v })}
          />
        </Stack>
      </Card>
    </Stack>
  );
}

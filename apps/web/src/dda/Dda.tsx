/* Déclaration d'applicabilité (reprise des pages « Clauses ISO 27001 », « Annexe A (DdA) » et « HDS (DdA) » de l'outil de
   suivi) : applicabilité et niveau de mise en œuvre de chaque mesure, indicateurs, incohérences (mesure « Total » avec un
   écart ouvert), documents associés et écarts ouverts. Le niveau de mise en œuvre de la DdA alimente la couverture
   présumée des autres référentiels. Données lues et écrites dans l'état historique (clé `dda`), sous verrou. L'import
   Excel de l'outil historique n'est pas repris. */
import { Anchor, Group, Modal, Stack, Table, Text } from '@mantine/core';
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
import { DdaSynthese } from './DdaSynthese';
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
  const nom = LIBELLES_REFERENTIEL_DDA[reference];
  const filtres: { value: FiltreDda; label: string; nombre: number }[] = st
    ? [
        { value: 'all', label: 'Toutes', nombre: st.total },
        ...NIVEAUX_DDA.map((n) => ({ value: n, label: n, nombre: st.c[n] })),
        { value: 'none', label: 'Non renseignées', nombre: st.c[''] },
        { value: 'na', label: 'Exclues', nombre: st.na },
        { value: 'inc', label: 'Total avec écart ouvert', nombre: incoherentes },
      ]
    : [];
  return (
    <div className="dda-module">
      <ErrorAlert error={erreur} />
      <header className="dda-heading">
        <span className="dda-eyebrow">Conformité et audits / ISO 27001 · HDS</span>
        <h2>Déclaration d’applicabilité</h2>
        <p>Mesures, niveaux de mise en œuvre et points de vigilance · {nom}</p>
      </header>
      {d && st && (
        <>
          <DdaSynthese st={st} reference={nom} incoherentes={incoherentes} />
          <p className="dda-section-title">Registre et détails</p>
          <section className="dda-panel dda-register" aria-label={`Mesures — ${nom}`}>
            <header className="dda-register-heading">
              <div>
                <span className="dda-eyebrow">Mesures du référentiel</span>
                <h3>{nom}</h3>
              </div>
              <span className="dda-counter">
                {liste.length} mesure{liste.length > 1 ? 's' : ''}
              </span>
            </header>
            <div className="dda-filters" role="group" aria-label="Filtre des mesures">
              {filtres.map((f) => (
                <button
                  type="button"
                  key={f.value}
                  aria-pressed={filtre === f.value}
                  onClick={() => setFiltre(f.value)}
                >
                  <span>{f.label}</span>
                  <strong>{f.nombre}</strong>
                </button>
              ))}
            </div>
            <DataTable label={`Déclaration d’applicabilité — ${nom}`}>
              <Table className="dda-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th scope="col">Mesure</Table.Th>
                    <Table.Th scope="col">Applicable</Table.Th>
                    <Table.Th scope="col">Mise en œuvre</Table.Th>
                    <Table.Th scope="col">Actions ou justification</Table.Th>
                    <Table.Th scope="col">Document associé</Table.Th>
                    <Table.Th scope="col">Écarts</Table.Th>
                    <Table.Th scope="col">
                      <span className="dda-sr-only">Fiche</span>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {liste.map((m) => {
                    const x = dda[m.id] ?? lireDda(null),
                      ecarts = ecartsOuvertsMesure(m.id, d.ecarts),
                      premiereLigne = x.docs.split('\n')[0] ?? '',
                      action = x.app === 'non' ? x.just : x.actions;
                    return (
                      <Table.Tr
                        key={m.id}
                        className="dda-row"
                        data-tone={x.app === 'non' ? 'exclue' : tonNiveau(x.level)}
                      >
                        <Table.Td className="dda-identity">
                          <button type="button" className="dda-code" onClick={() => setFiche(m.id)}>
                            {codeMesure(m)}
                          </button>
                          <button type="button" className="dda-measure-title" onClick={() => setFiche(m.id)}>
                            {m.title}
                          </button>
                        </Table.Td>
                        <Table.Td>
                          <span className="dda-cell-label">Applicable</span>
                          {iso ? (
                            <span className="dda-secondary">Obligatoire</span>
                          ) : (
                            <div
                              className="dda-choix"
                              data-tone={x.app === 'oui' ? 'total' : x.app === 'non' ? 'insuffisant' : 'inconnu'}
                            >
                              <ChampChoix
                                ariaLabel={`Applicabilité de ${codeMesure(m)}`}
                                value={x.app}
                                options={APPLICABLE}
                                effacable
                                placeholder="À déterminer"
                                disabled={!modifiable}
                                onCommit={(v) => maj(m.id, { app: v })}
                              />
                            </div>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <span className="dda-cell-label">Mise en œuvre</span>
                          {x.app === 'non' ? (
                            <span className="dda-secondary">Exclue</span>
                          ) : (
                            <div className="dda-choix" data-tone={tonNiveau(x.level)}>
                              <ChampChoix
                                ariaLabel={`Niveau de ${codeMesure(m)}`}
                                value={x.level}
                                options={NIVEAUX_DDA}
                                effacable
                                placeholder="Non renseigné"
                                disabled={!modifiable}
                                onCommit={(v) => maj(m.id, { level: v })}
                              />
                            </div>
                          )}
                        </Table.Td>
                        <Table.Td className="dda-detail" data-empty={!action}>
                          <IconeDda type="actions" />
                          <span>{action || '—'}</span>
                        </Table.Td>
                        <Table.Td className="dda-detail" data-empty={!premiereLigne && !x.url}>
                          <IconeDda type="document" />
                          <div>
                            <span>
                              {premiereLigne || '—'}
                              {x.docs.includes('\n') ? ' …' : ''}
                            </span>
                            <div>
                              <LienDocument url={x.url} />
                            </div>
                          </div>
                        </Table.Td>
                        <Table.Td className="dda-ecarts" data-empty={!ecarts.length && !/tenacy/i.test(x.comment)}>
                          <span className="dda-cell-label">Écarts</span>
                          <Group gap="xs">
                            {ecarts.map((e) => (
                              <StatusChip key={e.id} etat={e.type.startsWith('NC') ? 'erreur' : 'attention'}>
                                {e.id}
                              </StatusChip>
                            ))}
                            {/tenacy/i.test(x.comment) && <StatusChip etat="info">Tenacy</StatusChip>}
                            {!ecarts.length && !/tenacy/i.test(x.comment) && <span className="dda-secondary">—</span>}
                          </Group>
                        </Table.Td>
                        <Table.Td className="dda-open-cell">
                          <button
                            type="button"
                            className="dda-open"
                            aria-label={`Ouvrir la fiche ${codeMesure(m)}`}
                            onClick={() => setFiche(m.id)}
                          >
                            <IconeDda type="ouvrir" />
                          </button>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                  {!liste.length && (
                    <Table.Tr>
                      <Table.Td colSpan={7} className="dda-empty">
                        Aucune mesure.
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </DataTable>
          </section>
          <p className="dda-note">
            Niveaux déclarés, sans score de certification. Le niveau de mise en œuvre de la DdA alimente la couverture
            présumée des autres référentiels.
          </p>
        </>
      )}
      <Modal
        opened={!!ouverte}
        onClose={() => setFiche(null)}
        lockScroll={false}
        size="xl"
        classNames={{ content: 'dda-modal' }}
        title={ouverte ? `${codeMesure(ouverte)} — ${ouverte.title}` : ''}
      >
        <ErrorAlert error={erreur} />
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
    </div>
  );
}

function tonNiveau(niveau: string) {
  return niveau === 'Total'
    ? 'total'
    : niveau === 'Partiel'
      ? 'partiel'
      : niveau === 'Insuffisant'
        ? 'insuffisant'
        : 'inconnu';
}
function IconeDda({ type }: { type: 'actions' | 'document' | 'ouvrir' }) {
  return (
    <svg className="dda-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d={
          type === 'document'
            ? 'M5 2h7l3 3v13H5Z M12 2v4h3 M8 10h5 M8 13h5'
            : type === 'actions'
              ? 'M3 5h14 M3 10h10 M3 15h7'
              : 'M5 15 15 5 M5 5h10v10'
        }
      />
    </svg>
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
    <div className="dda-choix" data-tone={tonNiveau(x.level)}>
      <ChampChoix
        label={iso ? 'Niveau' : 'Mise en œuvre'}
        value={x.level}
        options={NIVEAUX_DDA}
        effacable
        disabled={!modifiable}
        onCommit={(v) => maj({ level: v })}
      />
    </div>
  );
  return (
    <div key={m.id} className="dda-fiche">
      <div className="dda-fiche-main">
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
        <section className="dda-fiche-section">
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
                  <div
                    className="dda-choix"
                    data-tone={x.app === 'oui' ? 'total' : x.app === 'non' ? 'insuffisant' : 'inconnu'}
                  >
                    <ChampChoix
                      label="Applicable"
                      value={x.app}
                      options={APPLICABLE}
                      effacable
                      disabled={!modifiable}
                      onCommit={(v) => maj({ app: v })}
                    />
                  </div>
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
              <ChampZone
                label="Justification"
                value={x.just}
                disabled={!modifiable}
                onCommit={(v) => maj({ just: v })}
              />
            )}
            {!iso && (
              <ChampZone
                label="Actions"
                value={x.actions}
                disabled={!modifiable}
                onCommit={(v) => maj({ actions: v })}
              />
            )}
          </Stack>
        </section>
        <section className="dda-fiche-section">
          <h3>Documents et justificatifs</h3>
          <Stack>
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
          </Stack>
        </section>
        <section className="dda-fiche-section">
          <h3>Revue de la mesure</h3>
          <Stack>
            <ChampTexte
              label={iso ? 'Commentaire' : 'Commentaire de la revue'}
              value={x.comment}
              disabled={!modifiable}
              onCommit={(v) => maj({ comment: v })}
            />
          </Stack>
        </section>
      </div>
      <aside className="dda-fiche-aside">
        <section className="dda-fiche-section">
          <h3>Repères</h3>
          <dl className="dda-fiche-reperes">
            <div>
              <dt>Référentiel</dt>
              <dd>{LIBELLES_REFERENTIEL_DDA[m.ref as ReferenceDda] ?? m.ref}</dd>
            </div>
            <div>
              <dt>Niveau déclaré</dt>
              <dd>{x.level || 'Non renseigné'}</dd>
            </div>
            <div>
              <dt>Applicabilité</dt>
              <dd>{iso ? 'Obligatoire' : x.app === 'oui' ? 'Oui' : x.app === 'non' ? 'Non' : 'À déterminer'}</dd>
            </div>
          </dl>
        </section>
        <section className="dda-fiche-section">
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
        </section>
      </aside>
    </div>
  );
}

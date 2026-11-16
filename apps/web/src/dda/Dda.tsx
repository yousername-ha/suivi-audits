/* Déclaration d'applicabilité (reprise des pages « Clauses ISO 27001 », « Annexe A (DdA) » et « HDS (DdA) » de l'outil de
   suivi) : applicabilité et niveau de mise en œuvre de chaque mesure, indicateurs, incohérences (mesure « Total » avec un
   écart ouvert), documents associés et écarts ouverts. Le niveau de mise en œuvre de la DdA alimente la couverture
   présumée des autres référentiels. Données lues et écrites dans l'état historique (clé `dda`), sous verrou. L'import
   Excel de l'outil historique n'est pas repris.
   Présentation « Studio » de la refonte Neon (lot 4, ADR 0093) : dalles de synthèse, mesures en lignes ouvrables, choix
   Applicable et Mise en œuvre remplis en vert, orange ou rouge. Données, droits, écritures et périmètre inchangés. */
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
import { APropos, DataTable, StatusChip, type Etat } from '@suivi/ui';
import { ErrorAlert } from '../components/common';
import { ficheCliquable } from '../fiche-cliquable';
import { ChampChoix, ChampTexte, ChampZone, useModule } from '../historique/champs';
import { useCan } from '../session';
import { IconeDda } from './DdaIcone';
import { DdaSynthese } from './DdaSynthese';
import { filtresDda, libelleApplicable, tonApplicable, tonNiveau } from './dda-studio';

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
const tenacy = (commentaire: string) => /tenacy/i.test(commentaire);

function LienDocument({ url, libelle = 'Ouvrir le document' }: { url: string; libelle?: string }) {
  const h = lienDocument(url);
  return h ? (
    <Anchor href={h} target="_blank" rel="noopener noreferrer" size="sm" title={url}>
      {libelle}
    </Anchor>
  ) : null;
}

/** `smsi` : périmètre affiché ; chaque périmètre a sa déclaration, une mesure sans décision y reste « non examinée » (BUG-062). */
export function DeclarationApplicabilite({ reference, smsi }: { reference: ReferenceDda; smsi?: string }) {
  const can = useCan(),
    modifiable = can('audit', 'modifier'),
    { d, agir, erreur } = useModule<Donnees>(
      `dda-${reference}:${smsi ?? ''}`,
      `/api/dda?reference=${reference}${smsi ? `&smsi=${smsi}` : ''}`,
    ),
    [filtre, setFiltre] = useState<FiltreDda>('all'),
    [fiche, setFiche] = useState<string | null>(null);
  const dda = d?.dda ?? {};
  const st = d ? statsDda(d.mesures, dda, reference) : null;
  const liste = d ? filtrerMesures(d.mesures, dda, d.ecarts, reference, filtre) : [];
  const incoherentes = d ? d.mesures.filter((m) => incoherente(m, dda, d.ecarts)).length : 0;
  const maj = (id: string, champ: Record<string, unknown>) =>
    void agir('PATCH', `/api/dda/${encodeURIComponent(id)}${smsi ? `?smsi=${smsi}` : ''}`, champ);
  const ouverte = d?.mesures.find((m) => m.id === fiche) ?? null;
  const iso = reference === 'ISO';
  const nom = LIBELLES_REFERENTIEL_DDA[reference];
  return (
    <div className="dda-module">
      <ErrorAlert error={erreur} />
      <header className="dda-heading">
        <span className="dda-eyebrow">Conformité et audits / ISO 27001 · HDS</span>
        <h2>Conformité — {nom} (DdA)</h2>
        <APropos>
          Déclaration d’applicabilité (ISO 27001 et HDS) et référentiels complémentaires importés. Le niveau de mise en
          œuvre de la DdA alimente la couverture présumée des autres référentiels.
        </APropos>
      </header>
      {d && st && (
        <>
          <DdaSynthese st={st} reference={nom} incoherentes={incoherentes} />
          <p className="dda-section-title">
            <span aria-hidden="true">02</span> Registre des mesures
          </p>
          <section className="dda-panel dda-register" aria-label={`Mesures — ${nom}`}>
            <header className="dda-register-heading">
              <div>
                <span className="dda-eyebrow">Mesures du référentiel</span>
                <h3>{nom}</h3>
              </div>
              <span className="dda-counter">
                <IconeDda type="liste" />
                <span>
                  <b>{liste.length}</b> mesure{liste.length > 1 ? 's' : ''}
                </span>
              </span>
            </header>
            <div className="dda-filters" role="group" aria-label="Filtre des mesures">
              {filtresDda(st, incoherentes).map((f) => (
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
                      action = x.app === 'non' ? x.just : x.actions,
                      repere = tenacy(x.comment);
                    return (
                      <Table.Tr
                        key={m.id}
                        {...ficheCliquable(() => setFiche(m.id), `Afficher la mesure ${codeMesure(m)}`)}
                        className="dda-row"
                        data-tone={x.app === 'non' ? 'exclue' : tonNiveau(x.level)}
                      >
                        <Table.Td className="dda-identity">
                          <button type="button" className="dda-code" onClick={() => setFiche(m.id)}>
                            {codeMesure(m)}
                          </button>{' '}
                          <span className="dda-measure-title">{m.title}</span>
                        </Table.Td>
                        <Table.Td>
                          <span className="dda-cell-label" aria-hidden="true">
                            Applicable
                          </span>
                          {iso ? (
                            <span className="dda-secondary">Obligatoire</span>
                          ) : (
                            <div className="dda-choix" data-tone={tonApplicable(x.app)}>
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
                          <span className="dda-cell-label" aria-hidden="true">
                            Mise en œuvre
                          </span>
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
                        <Table.Td className="dda-ecarts" data-empty={!ecarts.length && !repere}>
                          <span className="dda-cell-label" aria-hidden="true">
                            Écarts
                          </span>
                          <Group gap="xs">
                            {ecarts.map((e) => (
                              <StatusChip key={e.id} etat={e.type.startsWith('NC') ? 'erreur' : 'attention'}>
                                {e.id}
                              </StatusChip>
                            ))}
                            {repere && <StatusChip etat="info">Tenacy</StatusChip>}
                            {!ecarts.length && !repere && <span className="dda-secondary">—</span>}
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
        title={
          ouverte ? (
            <span className="dda-modal-titre">
              <span className="dda-tuile-icone">
                <IconeDda type="applicabilite" />
              </span>
              <span className="dda-modal-libelle">
                <span>
                  {codeMesure(ouverte)} — {ouverte.title}
                </span>
                <small>{nom} · Fiche mesure</small>
              </span>
            </span>
          ) : (
            ''
          )
        }
      >
        {ouverte && d && (
          <>
            <ErrorAlert error={erreur} />
            <FicheMesure
              m={ouverte}
              x={dda[ouverte.id] ?? lireDda(null)}
              ecarts={ecartsOuvertsMesure(ouverte.id, d.ecarts)}
              modifiable={modifiable}
              maj={(champ) => maj(ouverte.id, champ)}
            />
          </>
        )}
      </Modal>
    </div>
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
            <h3>
              <IconeDda type="niveaux" />
              {iso ? 'Mise en œuvre de l’exigence' : 'Déclaration d’applicabilité'}
            </h3>
            {!iso && x.req && (
              <Text size="sm" c="dimmed" className="evaluation-texte">
                {x.req.slice(0, 600)}
                {x.req.length > 600 ? '…' : ''}
              </Text>
            )}
            <div className="grille-formulaire">
              <div className="grille-formulaire__champs">
                {!iso && (
                  <div className="dda-choix" data-tone={tonApplicable(x.app)}>
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
          <h3>
            <IconeDda type="document" />
            Documents et justificatifs
          </h3>
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
          <h3>
            <IconeDda type="actions" />
            Revue de la mesure
          </h3>
          <ChampTexte
            label={iso ? 'Commentaire' : 'Commentaire de la revue'}
            value={x.comment}
            disabled={!modifiable}
            onCommit={(v) => maj({ comment: v })}
          />
        </section>
      </div>
      <aside className="dda-fiche-aside" aria-label="Repères de la mesure">
        <section className="dda-fiche-section">
          <h3>
            <IconeDda type="reperes" />
            Repères
          </h3>
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
              <dd>{libelleApplicable(x.app, iso)}</dd>
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

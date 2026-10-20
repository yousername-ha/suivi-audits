/* Évaluations de sécurité des fournisseurs par le clausier (reprise de la page « Évaluations sécurité » de l'outil de
   suivi). Évaluation facultative, en plus des évaluations natives de l'organisation : grille du Clausier Conformité
   Numérique 2026 du Club RSSI Santé (licence CC BY-NC-SA 4.0, usage non commercial). La note A à E est indicative
   (part des points conformes) et ne correspond pas à la notation officielle du Club RSSI Santé. */
import { Alert, Anchor, Button, Card, Checkbox, Group, SegmentedControl, Stack, Table, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  CAS_CLAUSIER,
  ETATS_POINT_CLAUSIER,
  etatPoint,
  type EvaluationClausier,
  type PointClausier,
  type ScoreEvaluation,
} from '@suivi/shared';
import { ConfirmButton, DataTable, StatusChip, type Etat } from '@suivi/ui';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { ChampChoix, ChampTexte, useModule } from '../historique/champs';
import { Chiffres } from '../historique/graphiques';
import { useCan } from '../session';

interface Resume extends EvaluationClausier {
  score: ScoreEvaluation;
}
interface Donnees {
  version: number;
  evaluations: Resume[];
  fournisseurs: { id: string; name: string; sso: string; mfa: string; certificats: string }[];
  clausier: { version: string; source: string };
}
interface Detail {
  evaluation: Resume;
  points: PointClausier[];
}
const ETAT_NOTE: Record<string, Etat> = { A: 'succes', B: 'succes', C: 'attention', D: 'erreur', E: 'erreur' };
const Note = ({ n }: { n: string }) => <StatusChip etat={ETAT_NOTE[n] ?? 'neutre'}>{n}</StatusChip>;
const ETAT_POINT: Record<string, Etat> = {
  Conforme: 'succes',
  Partiel: 'attention',
  'Non conforme': 'erreur',
  'Non applicable': 'neutre',
  'À évaluer': 'neutre',
};
const jour = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : '–');

export function EvaluationsClausier() {
  const can = useCan(),
    modifiable = can('fournisseurs', 'modifier'),
    { d, agir, erreur } = useModule<Donnees>('evaluations-clausier', '/api/evaluations-clausier'),
    [sel, setSel] = useState<string | null>(null);
  const nom = (id: string) => d?.fournisseurs.find((f) => f.id === id)?.name ?? id ?? '?';
  const courante = d?.evaluations.find((e) => e.id === sel) ?? null;
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      {d && courante ? (
        <DetailEvaluation key={courante.id} d={d} e={courante} modifiable={modifiable} onRetour={() => setSel(null)} />
      ) : (
        <>
          <Group justify="space-between" align="flex-end">
            <div>
              <Text fw={600}>Évaluations sécurité des fournisseurs — par le clausier</Text>
              <Text size="sm" c="dimmed">
                Évaluation facultative, en plus des évaluations natives de l’organisation : grille issue du{' '}
                {d?.clausier.source ?? 'Clausier Conformité Numérique 2026 du Club RSSI Santé'}. Les chapitres propres à
                un cas (RGPD, wi-fi, mobiles, dispositifs médicaux, hébergement, administration, développement, IA)
                s’ajoutent selon les cas cochés. La note A à E est indicative (part des points conformes) et ne
                correspond pas à la notation officielle du Club RSSI Santé.
              </Text>
            </div>
            {modifiable && (
              <Button
                disabled={!d?.fournisseurs.length}
                onClick={async () => {
                  const e = await agir<Resume>('POST', '/api/evaluations-clausier', {});
                  if (e) setSel(e.id);
                }}
              >
                Nouvelle évaluation
              </Button>
            )}
          </Group>
          <Alert color="gray" title="Licence du clausier">
            Contenu sous licence Creative Commons Attribution - Pas d’Utilisation Commerciale - Partage dans les Mêmes
            Conditions 4.0 (CC BY-NC-SA 4.0) : usage non commercial, mention de la source, adaptations partagées dans
            les mêmes conditions.{' '}
            <Anchor
              href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr"
              target="_blank"
              rel="noopener noreferrer"
            >
              Texte de la licence
            </Anchor>
            .
          </Alert>
          {d && (
            <DataTable label="Évaluations par le clausier">
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Fournisseur</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Évaluateur</Table.Th>
                    <Table.Th>Note</Table.Th>
                    <Table.Th>Conformité</Table.Th>
                    <Table.Th>Points évalués</Table.Th>
                    <Table.Th>Écarts</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {d.evaluations.map((e) => (
                    <Table.Tr key={e.id}>
                      <Table.Td>
                        <Anchor component="button" type="button" fw={600} onClick={() => setSel(e.id)}>
                          {nom(e.supplier)}
                        </Anchor>
                        <Text size="xs" c="dimmed">
                          {e.product}
                        </Text>
                      </Table.Td>
                      <Table.Td>{jour(e.date)}</Table.Td>
                      <Table.Td>{e.evaluator || '–'}</Table.Td>
                      <Table.Td>
                        <Note n={e.score.note} />
                      </Table.Td>
                      <Table.Td>{e.score.pc == null ? '–' : `${e.score.pc} %`}</Table.Td>
                      <Table.Td>
                        {e.score.done}/{e.score.n}
                      </Table.Td>
                      <Table.Td>
                        {e.score.nc} NC, {e.score.pa} partiel(s)
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {!d.evaluations.length && (
                    <Table.Tr>
                      <Table.Td colSpan={7}>Aucune évaluation.</Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </DataTable>
          )}
        </>
      )}
    </Stack>
  );
}

function DetailEvaluation({
  d,
  e,
  modifiable,
  onRetour,
}: {
  d: Donnees;
  e: Resume;
  modifiable: boolean;
  onRetour: () => void;
}) {
  const can = useCan(),
    qc = useQueryClient(),
    { agir, erreur } = useModule<Donnees>('evaluations-clausier', '/api/evaluations-clausier'),
    q = useQuery({
      queryKey: ['evaluation-clausier', e.id, e.cases.join(',')],
      queryFn: () => get<Detail>(`/api/evaluations-clausier/${encodeURIComponent(e.id)}`),
    }),
    [filtre, setFiltre] = useState('all'),
    [message, setMessage] = useState('');
  const base = `/api/evaluations-clausier/${encodeURIComponent(e.id)}`;
  const sp = d.fournisseurs.find((f) => f.id === e.supplier);
  const points = q.data?.points ?? [];
  const st = (p: PointClausier) => etatPoint(e, p.id);
  const chapitres = [...new Set(points.map((p) => p.chapitre))];
  const note = (p: PointClausier) =>
    !sp
      ? ''
      : p.id === 'O-1.3'
        ? `Certificats enregistrés : ${sp.certificats || 'aucun'}`
        : p.id === 'O-5.1'
          ? `SSO : ${sp.sso || 'non renseigné'}`
          : p.id === 'O-12.3.5'
            ? `MFA : ${sp.mfa || 'non renseignée'}`
            : '';
  const maj = (champ: Record<string, unknown>) => void agir('PATCH', base, champ);
  return (
    <Stack>
      <ErrorAlert error={erreur ?? q.error} />
      <Group justify="space-between">
        <Anchor component="button" type="button" onClick={onRetour}>
          ← Toutes les évaluations
        </Anchor>
      </Group>
      <Group>
        <Text fw={700} size="lg">
          {sp?.name ?? 'Évaluation'} {e.product ? `— ${e.product}` : ''}
        </Text>
      </Group>
      <Chiffres
        items={[
          { valeur: e.score.note, libelle: 'Note indicative de l’outil' },
          { valeur: e.score.pc == null ? 'Non évalué' : `${e.score.pc} % conforme`, libelle: 'conformité' },
          {
            valeur: `${e.score.done}/${e.score.n}`,
            libelle: 'points évalués',
            detail: `${e.score.nc} non conforme(s) · ${e.score.pa} partiel(s)`,
          },
        ]}
      />
      <Card withBorder>
        <Stack>
          <div className="grille-formulaire">
            <div className="grille-formulaire__champs">
              <ChampChoix
                label="Fournisseur"
                value={e.supplier}
                options={d.fournisseurs.map((f) => ({ value: f.id, label: f.name }))}
                disabled={!modifiable}
                onCommit={(v) => v && maj({ supplier: v })}
              />
              <ChampTexte
                label="Produit ou prestation"
                value={e.product}
                disabled={!modifiable}
                onCommit={(v) => maj({ product: v })}
              />
              <ChampTexte
                label="Date"
                type="date"
                value={e.date}
                disabled={!modifiable}
                onCommit={(v) => maj({ date: v })}
              />
              <ChampTexte
                label="Évaluateur"
                value={e.evaluator}
                disabled={!modifiable}
                onCommit={(v) => maj({ evaluator: v })}
              />
              <ChampTexte
                label="Source des réponses"
                placeholder="Questionnaire fournisseur, contrat, audit…"
                value={e.source}
                disabled={!modifiable}
                onCommit={(v) => maj({ source: v })}
              />
            </div>
          </div>
          <Text fw={600}>Chapitres applicables</Text>
          <Stack gap="xs">
            {CAS_CLAUSIER.map(([k, l]) => (
              <Checkbox
                key={k}
                label={l}
                checked={e.cases.includes(k)}
                disabled={!modifiable}
                onChange={(ev) =>
                  maj({
                    cases: ev.currentTarget.checked ? [...new Set([...e.cases, k])] : e.cases.filter((x) => x !== k),
                  })
                }
              />
            ))}
          </Stack>
          <Text size="sm" c="dimmed">
            Source : {d.clausier.source}. Libellés courts adaptés par l’outil ; texte des exigences reproduit selon la
            licence.
          </Text>
        </Stack>
      </Card>
      <Group justify="space-between">
        <Group>
          <SegmentedControl
            aria-label="Filtre des points"
            value={filtre}
            onChange={setFiltre}
            data={[
              { value: 'all', label: 'Tous les points' },
              { value: 'todo', label: 'À évaluer' },
              { value: 'gap', label: 'Écarts' },
            ]}
          />
          <Text size="sm" c="dimmed">
            {points.length} points
          </Text>
        </Group>
        {modifiable && (
          <Group>
            {can('ecarts', 'modifier') && (
              <Button
                variant="default"
                onClick={async () => {
                  setMessage('');
                  const r = await agir<{ action: string; taches: number }>('POST', `${base}/action`);
                  if (r) setMessage(`Action ${r.action} créée avec ${r.taches} point(s) à traiter.`);
                }}
              >
                Créer les actions pour les écarts
              </Button>
            )}
            <ConfirmButton
              message="Supprimer cette évaluation ?"
              variant="light"
              onConfirm={async () => {
                await agir('DELETE', base);
                onRetour();
              }}
            >
              Supprimer l’évaluation
            </ConfirmButton>
          </Group>
        )}
      </Group>
      {message && <Alert color="green">{message}</Alert>}
      {chapitres.map((ch) => {
        const tous = points.filter((p) => p.chapitre === ch),
          vus = tous.filter(
            (p) =>
              filtre === 'all' ||
              (filtre === 'todo' ? st(p) === 'À évaluer' : ['Partiel', 'Non conforme'].includes(st(p))),
          );
        if (!vus.length) return null;
        let derniere: string | null = null;
        return (
          <Stack key={ch} gap="xs">
            <Group justify="space-between">
              <Text fw={600}>{tous[0]!.libelleChapitre}</Text>
              <Text size="sm" c="dimmed">
                {tous.filter((p) => st(p) === 'Conforme').length}/{tous.length} conformes
              </Text>
            </Group>
            {vus.map((p) => {
              const sous = p.sousChapitre && p.sousChapitre !== derniere ? p.sousChapitre : null;
              derniere = p.sousChapitre;
              const r = e.ans[p.id];
              return (
                <Stack key={p.id} gap="xs">
                  {sous && (
                    <Text size="sm" fw={600} c="dimmed">
                      {sous}
                    </Text>
                  )}
                  <Card withBorder padding="xs">
                    <Group align="flex-start" wrap="nowrap" justify="space-between">
                      <div>
                        <details>
                          <summary>
                            <b>{p.id.replace('O-', '')}</b> {p.titre}
                          </summary>
                          <Text size="sm" className="evaluation-texte">
                            {p.texte}
                          </Text>
                        </details>
                        {note(p) && (
                          <Text size="xs" c="dimmed">
                            {note(p)}
                          </Text>
                        )}
                      </div>
                      <Group gap="xs" wrap="nowrap">
                        <StatusChip etat={ETAT_POINT[st(p)] ?? 'neutre'}>{st(p)}</StatusChip>
                        <ChampChoix
                          ariaLabel={`État du point ${p.id}`}
                          value={st(p)}
                          options={ETATS_POINT_CLAUSIER}
                          disabled={!modifiable}
                          onCommit={(v) =>
                            void agir('PUT', `${base}/points/${encodeURIComponent(p.id)}`, { st: v }).then(() =>
                              qc.invalidateQueries({ queryKey: ['evaluation-clausier'] }),
                            )
                          }
                        />
                      </Group>
                    </Group>
                    <ChampTexte
                      ariaLabel={`Réponse pour le point ${p.id}`}
                      placeholder="Réponse du fournisseur, preuve, réserve"
                      value={r?.c ?? ''}
                      disabled={!modifiable}
                      onCommit={(v) => void agir('PUT', `${base}/points/${encodeURIComponent(p.id)}`, { c: v })}
                    />
                  </Card>
                </Stack>
              );
            })}
          </Stack>
        );
      })}
      {!q.isLoading && !points.length && <Text size="sm">Aucun point pour cette évaluation.</Text>}
    </Stack>
  );
}

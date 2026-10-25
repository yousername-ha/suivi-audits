/* Conformité IA (reprise des vues de l'outil de suivi) : synthèse, registre des usages, évaluation des scénarios, plan
   d'action et politiques. Les données restent dans l'état historique (clé `ai`) ; l'écran modifie le registre (ajout,
   suppression, qualification), l'évaluation (périmètre, probabilité, maturité), l'avancement du plan et le statut des
   politiques. Aucun usage, scénario, étape ni politique n'est fourni par défaut. */
import { Alert, Button, Card, Checkbox, Group, Stack, Table, Tabs, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  AUTORISATIONS_IA,
  AVANCEMENTS_IA,
  CATEGORIES_IA,
  CHAMPS_A_QUALIFIER_IA,
  MATURITES_IA,
  PERIMETRES_IA,
  PRESENCES_IA,
  QUALIFICATIONS_IA,
  STATUTS_IA,
  etapeIa,
  evaluationIa,
  statistiquesIa,
  type DonneesIa,
  type NiveauIa,
} from '@suivi/shared';
import { ConfirmButton, DataTable, StatusChip, type Etat } from '@suivi/ui';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { ChampChoix, ChampTexte, ChampZone, useModule } from '../historique/champs';
import { useCan } from '../session';

const ETAT: Record<NiveauIa, Etat> = { ok: 'succes', mid: 'info', hi: 'attention', bad: 'erreur', na: 'neutre' };
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const jour = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : '–');
const NOMBRES = [0, 1, 2, 3, 4, 5].map(String);

export function ConformiteIa() {
  const can = useCan(),
    modifiable = can('ia', 'modifier'),
    { d, agir, erreur } = useModule<{ version: number; ia: DonneesIa | null }>('ia', '/api/ia');
  const ia = d?.ia;
  // Kit IA importé (ADR 0055) : le suivi des contrôles passe par le référentiel ; l'accès refusé n'est pas une erreur ici.
  const kit = useQuery({
    queryKey: ['library', 'ia-kit'],
    queryFn: () => get<{ importe: boolean }>('/api/library/ia-kit'),
    retry: false,
    enabled: can('conformite', 'lire'),
  });
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      {kit.data?.importe && (
        <Alert color="blue" title="Le kit IA est importé" data-testid="ia-kit-renvoi">
          Les contrôles IA se suivent désormais dans le référentiel « Contrôles IA internes » (page Couverture du
          périmètre) : les points de cette page n’y sont plus saisis. Les données ci-dessous restent consultables ; rien
          n’est supprimé automatiquement.
        </Alert>
      )}
      <div>
        <Text fw={600}>Conformité IA</Text>
        {ia?.context && (
          <Text size="sm" c="dimmed">
            {ia.context}
          </Text>
        )}
      </div>
      {ia && (
        <Tabs defaultValue="synthese" keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="synthese">Synthèse</Tabs.Tab>
            <Tabs.Tab value="registre">Usages de l’IA</Tabs.Tab>
            <Tabs.Tab value="evaluation">Évaluation des scénarios</Tabs.Tab>
            <Tabs.Tab value="plan">Plan d’action</Tabs.Tab>
            <Tabs.Tab value="politiques">Politiques</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="synthese" pt="md">
            <Synthese ia={ia} />
          </Tabs.Panel>
          <Tabs.Panel value="registre" pt="md">
            <Registre ia={ia} modifiable={modifiable} agir={agir} />
          </Tabs.Panel>
          <Tabs.Panel value="evaluation" pt="md">
            <Evaluation ia={ia} modifiable={modifiable} agir={agir} />
          </Tabs.Panel>
          <Tabs.Panel value="plan" pt="md">
            <Plan ia={ia} modifiable={modifiable} agir={agir} />
          </Tabs.Panel>
          <Tabs.Panel value="politiques" pt="md">
            <Politiques ia={ia} modifiable={modifiable} agir={agir} />
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  );
}

type Agir = <R>(methode: string, chemin: string, corps?: unknown) => Promise<R | undefined>;
const Carte = ({ n, l }: { n: string | number; l: string }) => (
  <Card withBorder padding="xs">
    <Text fw={700} size="lg">
      {n}
    </Text>
    <Text size="xs" c="dimmed">
      {l}
    </Text>
  </Card>
);

function Synthese({ ia }: { ia: DonneesIa }) {
  const s = statistiquesIa(ia, aujourdhui());
  const aVerifier = ia.register.filter((r) => (r.aiPresence || 'À vérifier') === 'À vérifier').length;
  const categories = CATEGORIES_IA.map(
    (c) => [c, ia.register.filter((r) => r.category === c && r.aiPresence === 'Oui')] as const,
  ).filter((x) => x[1].length);
  const prioritaires = ia.evals
    .map((e) => ({ e, r: evaluationIa(e) }))
    .filter((x) => x.r.indice != null)
    .sort((a, b) => b.r.indice! - a.r.indice!)
    .slice(0, 6);
  return (
    <Stack>
      <Group>
        <Carte n={`${s.couverts}/${s.applicables}`} l="scénarios avec maturité ≥ 3" />
        <Carte n={s.niveaux.Critique!} l="critiques" />
        <Carte n={s.niveaux['Élevé']!} l="élevés" />
        <Carte n={`${s.avancement} %`} l="avancement du plan" />
        <Carte n={s.enRetard} l="étapes en retard" />
        <Carte n={aVerifier} l="outils : présence d’IA à vérifier" />
      </Group>
      <Text fw={600}>Usages recensés et points à qualifier</Text>
      {!categories.length && <Text size="sm">Aucun usage d’IA recensé.</Text>}
      {categories.map(([c, liste]) => (
        <div key={c}>
          <Text size="sm" fw={600}>
            {c} ({liste.length})
          </Text>
          <ul className="audit-motifs">
            {liste.map((r) => {
              const q = CHAMPS_A_QUALIFIER_IA.filter(([k]) => {
                const v = String((r as unknown as Record<string, string>)[k] ?? '');
                return /qualifier|confirmer/i.test(v) || !v.trim();
              });
              return (
                <li key={r.id}>
                  <b>{r.provider.split(' — ')[1] || r.provider.split(' — ')[0] || r.id}</b> : {r.authz}
                  {q.length
                    ? `, ${q.length} point${q.length > 1 ? 's' : ''} à qualifier (${q.map((x) => x[1]).join(', ')})`
                    : ''}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <Text fw={600}>Écarts prioritaires</Text>
      {!prioritaires.length && <Text size="sm">Aucun scénario évalué.</Text>}
      <ul className="audit-motifs">
        {prioritaires.map((x) => (
          <li key={x.e.id}>
            <StatusChip etat={ETAT[x.r.cls]}>{x.r.indice}</StatusChip> <b>{x.e.id}</b> {x.e.domain}
          </li>
        ))}
      </ul>
      <Text size="xs" c="dimmed">
        Maturité ≥ 3 = « Déployé et documenté » selon l’échelle du classeur IA.
      </Text>
    </Stack>
  );
}

function Registre({ ia, modifiable, agir }: { ia: DonneesIa; modifiable: boolean; agir: Agir }) {
  const maj = (id: string, champ: Record<string, unknown>) =>
    void agir('PATCH', `/api/ia/usages/${encodeURIComponent(id)}`, champ);
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Règle issue du plan IA : DSCP, données patient, secrets, identifiants et contenus confidentiels sont interdits
        dans les services IA externes.
      </Text>
      {!ia.register.length && <Text size="sm">Aucun usage d’IA enregistré.</Text>}
      {ia.register.length > 0 && (
        <DataTable label="Usages de l’IA">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID</Table.Th>
                <Table.Th>IA présente</Table.Th>
                <Table.Th>Catégorie</Table.Th>
                <Table.Th>Fournisseur, service, offre</Table.Th>
                <Table.Th>Cas d’usage</Table.Th>
                <Table.Th className="col-p2">DSCP</Table.Th>
                <Table.Th className="col-p3">Réutilisation pour entraînement</Table.Th>
                <Table.Th className="col-p3">Pays de stockage</Table.Th>
                <Table.Th>Autorisation</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {ia.register.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <b>{r.id}</b>
                  </Table.Td>
                  <Table.Td>
                    <ChampChoix
                      ariaLabel={`IA présente — ${r.id}`}
                      value={r.aiPresence}
                      disabled={!modifiable}
                      options={PRESENCES_IA}
                      onCommit={(v) => maj(r.id, { aiPresence: v })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ChampChoix
                      ariaLabel={`Catégorie — ${r.id}`}
                      value={r.category}
                      disabled={!modifiable}
                      options={CATEGORIES_IA}
                      onCommit={(v) => maj(r.id, { category: v })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ChampZone
                      ariaLabel={`Fournisseur — ${r.id}`}
                      lignes={1}
                      value={r.provider}
                      disabled={!modifiable}
                      onCommit={(v) => maj(r.id, { provider: v })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ChampZone
                      ariaLabel={`Cas d’usage — ${r.id}`}
                      lignes={1}
                      value={r.usecase}
                      disabled={!modifiable}
                      onCommit={(v) => maj(r.id, { usecase: v })}
                    />
                  </Table.Td>
                  <Table.Td className="col-p2">
                    <ChampChoix
                      ariaLabel={`DSCP — ${r.id}`}
                      value={r.dscp}
                      disabled={!modifiable}
                      options={QUALIFICATIONS_IA}
                      onCommit={(v) => maj(r.id, { dscp: v })}
                    />
                  </Table.Td>
                  <Table.Td className="col-p3">
                    <ChampZone
                      ariaLabel={`Entraînement — ${r.id}`}
                      lignes={1}
                      value={r.training}
                      disabled={!modifiable}
                      onCommit={(v) => maj(r.id, { training: v })}
                    />
                  </Table.Td>
                  <Table.Td className="col-p3">
                    <ChampZone
                      ariaLabel={`Stockage — ${r.id}`}
                      lignes={1}
                      value={r.storage}
                      disabled={!modifiable}
                      onCommit={(v) => maj(r.id, { storage: v })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ChampChoix
                      ariaLabel={`Autorisation — ${r.id}`}
                      value={r.authz}
                      disabled={!modifiable}
                      options={AUTORISATIONS_IA}
                      onCommit={(v) => maj(r.id, { authz: v })}
                    />
                  </Table.Td>
                  <Table.Td>
                    {modifiable && (
                      <ConfirmButton
                        message={`Supprimer l’usage ${r.id} ?`}
                        onConfirm={() => agir('DELETE', `/api/ia/usages/${encodeURIComponent(r.id)}`)}
                        variant="subtle"
                      >
                        Supprimer
                      </ConfirmButton>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
      {modifiable && (
        <Group>
          <Button variant="default" onClick={() => void agir('POST', '/api/ia/usages')}>
            Ajouter un usage
          </Button>
        </Group>
      )}
    </Stack>
  );
}

function Evaluation({ ia, modifiable, agir }: { ia: DonneesIa; modifiable: boolean; agir: Agir }) {
  if (!ia.evals.length) return <Text size="sm">Aucun scénario évalué.</Text>;
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Méthode du classeur IA : indice = 70 % du risque résiduel + 30 % de l’effort de révision ; risque résiduel =
        min(25, impact max × probabilité × facteur HDS) × (1 − maturité/5). Seuils : 16 critique, 10 élevé, 5 modéré.
      </Text>
      <DataTable label="Évaluation des scénarios IA">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>Scénario</Table.Th>
              <Table.Th>Périmètre</Table.Th>
              <Table.Th>Prob.</Table.Th>
              <Table.Th>Maturité</Table.Th>
              <Table.Th>Indice</Table.Th>
              <Table.Th>Niveau</Table.Th>
              <Table.Th className="col-p3">Mesure attendue</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ia.evals.map((e) => {
              const r = evaluationIa(e);
              const maj = (champ: Record<string, unknown>) =>
                void agir('PATCH', `/api/ia/evaluations/${encodeURIComponent(e.id)}`, champ);
              return (
                <Table.Tr key={e.id}>
                  <Table.Td>
                    <b>{e.id}</b>
                    <Text size="xs" c="dimmed">
                      {e.domain}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {e.scenario}
                    <Text size="xs" c="dimmed">
                      ISO : {e.iso} ; HDS : {e.hds}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <ChampChoix
                      ariaLabel={`Périmètre — ${e.id}`}
                      value={e.scope}
                      disabled={!modifiable}
                      options={PERIMETRES_IA}
                      onCommit={(v) => maj({ scope: v })}
                    />
                    <Text size="xs" c="dimmed">
                      {e.app}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {r.indice == null ? (
                      '–'
                    ) : (
                      <ChampChoix
                        ariaLabel={`Probabilité — ${e.id}`}
                        value={String(e.prob)}
                        disabled={!modifiable}
                        options={NOMBRES}
                        onCommit={(v) => maj({ prob: Number(v) })}
                      />
                    )}
                  </Table.Td>
                  <Table.Td>
                    {r.indice == null ? (
                      '–'
                    ) : (
                      <ChampChoix
                        ariaLabel={`Maturité — ${e.id}`}
                        value={String(e.maturity)}
                        disabled={!modifiable}
                        options={MATURITES_IA.map((m, n) => ({ value: String(n), label: `${n} ${m}` }))}
                        onCommit={(v) => maj({ maturity: Number(v) })}
                      />
                    )}
                  </Table.Td>
                  <Table.Td>
                    <b>{r.indice ?? '–'}</b>
                  </Table.Td>
                  <Table.Td>
                    <StatusChip etat={ETAT[r.cls]}>{r.niveau}</StatusChip>
                  </Table.Td>
                  <Table.Td className="col-p3">
                    <Text size="xs">{e.measure}</Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </DataTable>
    </Stack>
  );
}

function Plan({ ia, modifiable, agir }: { ia: DonneesIa; modifiable: boolean; agir: Agir }) {
  const s = statistiquesIa(ia, aujourdhui());
  let phase = '';
  return (
    <Stack>
      <Group align="flex-end">
        <ChampTexte
          label="Date de début du plan"
          type="date"
          value={ia.start}
          disabled={!modifiable}
          onCommit={(v) => void agir('PATCH', '/api/ia/plan', { start: v })}
        />
        <Checkbox
          label={`Date validée${!ia.startValidated ? ' (indicative : pas d’alerte de retard)' : ''}`}
          checked={ia.startValidated}
          disabled={!modifiable}
          onChange={(e) => void agir('PATCH', '/api/ia/plan', { startValidated: e.currentTarget.checked })}
        />
        <Text size="sm" c="dimmed">
          {s.terminees}/{s.etapes} étapes terminées, avancement {s.avancement} %
        </Text>
      </Group>
      {!ia.plan.length && <Text size="sm">Aucune étape dans le plan.</Text>}
      {ia.plan.length > 0 && (
        <DataTable label="Plan d’action IA">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Étape</Table.Th>
                <Table.Th>Action</Table.Th>
                <Table.Th className="col-p2">Pilote</Table.Th>
                <Table.Th className="col-p2">Échéance</Table.Th>
                <Table.Th>Statut</Table.Th>
                <Table.Th>Avancement</Table.Th>
                <Table.Th>Alerte</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {ia.plan.flatMap((p) => {
                const r = etapeIa(p, ia.start, ia.startValidated, aujourdhui());
                const maj = (champ: Record<string, unknown>) =>
                  void agir('PATCH', `/api/ia/plan/etapes/${encodeURIComponent(p.cle)}`, champ);
                const rows = [];
                if (p.phase !== phase) {
                  phase = p.phase;
                  rows.push(
                    <Table.Tr key={'phase-' + p.cle}>
                      <Table.Td colSpan={7}>
                        <Text fw={600}>{p.phase}</Text>
                      </Table.Td>
                    </Table.Tr>,
                  );
                }
                rows.push(
                  <Table.Tr key={p.cle}>
                    <Table.Td>
                      <b>{p.step}</b>
                    </Table.Td>
                    <Table.Td>
                      {p.action}
                      <Text size="xs" c="dimmed">
                        {p.result}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Preuve : {p.proof} ; ISO {p.iso} ; HDS {p.hds}
                      </Text>
                    </Table.Td>
                    <Table.Td className="col-p2">
                      {p.owner}
                      <Text size="xs" c="dimmed">
                        {p.priority}
                      </Text>
                    </Table.Td>
                    <Table.Td className="col-p2">{jour(r.echeance)}</Table.Td>
                    <Table.Td>
                      <ChampChoix
                        ariaLabel={`Statut de l’étape ${p.step}`}
                        value={p.status}
                        disabled={!modifiable}
                        options={STATUTS_IA}
                        onCommit={(v) => maj({ status: v })}
                      />
                    </Table.Td>
                    <Table.Td>
                      <ChampChoix
                        ariaLabel={`Avancement de l’étape ${p.step}`}
                        value={String(p.progress)}
                        disabled={!modifiable}
                        options={AVANCEMENTS_IA.map((n) => ({ value: String(n), label: `${n} %` }))}
                        onCommit={(v) => maj({ progress: Number(v) })}
                      />
                    </Table.Td>
                    <Table.Td>
                      <StatusChip etat={ETAT[r.alerte[1]]}>{r.alerte[0]}</StatusChip>
                    </Table.Td>
                  </Table.Tr>,
                );
                return rows;
              })}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
    </Stack>
  );
}

function Politiques({ ia, modifiable, agir }: { ia: DonneesIa; modifiable: boolean; agir: Agir }) {
  if (!ia.policies.length) return <Text size="sm">Aucune politique ou procédure à adapter.</Text>;
  return (
    <DataTable label="Politiques et procédures à adapter">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Politique ou procédure</Table.Th>
            <Table.Th>Modification attendue</Table.Th>
            <Table.Th className="col-p2">Références</Table.Th>
            <Table.Th className="col-p2">Propriétaire</Table.Th>
            <Table.Th>Statut</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {ia.policies.map((p) => (
            <Table.Tr key={p.cle}>
              <Table.Td>
                <b>{p.policy}</b>
                <Text size="xs" c="dimmed">
                  Impact : {p.impact}
                </Text>
              </Table.Td>
              <Table.Td>{p.change}</Table.Td>
              <Table.Td className="col-p2">
                <Text size="xs" c="dimmed">
                  ISO {p.iso} ; Annexe A {p.annex} ; HDS {p.hds}
                </Text>
              </Table.Td>
              <Table.Td className="col-p2">
                {p.owner}
                <Text size="xs" c="dimmed">
                  {p.target}
                </Text>
              </Table.Td>
              <Table.Td>
                <ChampChoix
                  ariaLabel={`Statut — ${p.policy}`}
                  value={p.status}
                  disabled={!modifiable}
                  options={STATUTS_IA}
                  onCommit={(v) => void agir('PATCH', `/api/ia/politiques/${encodeURIComponent(p.cle)}`, { status: v })}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

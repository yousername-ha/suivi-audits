/* Couverture par référentiel (ADR 0031 et 0041) : pour chaque référentiel actif du périmètre, l'état de chaque exigence
   — applicabilité, mise en œuvre, test d'efficacité, validation métier — et les mesures qui la portent. Les états décrivent
   ce qui est établi dans le périmètre ; ils ne constituent ni un taux de conformité ni une preuve de conformité. Un
   rapprochement non décidé est affiché à part et n'est jamais compté. */
import { Alert, Button, Card, Group, Modal, Select, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  APPLICABILITES,
  ETATS_EXIGENCE,
  LIBELLES_APPLICABILITE,
  LIBELLES_ETAT,
  LIBELLES_MISE_EN_OEUVRE,
  LIBELLES_RESULTAT_TEST,
  MISES_EN_OEUVRE,
  RESULTATS_TEST,
  exigenceConforme,
  incoherencesEvaluation,
  type Applicabilite,
  type EtatExigence,
  type EvaluationExigence,
  type MiseEnOeuvre,
  type ResultatTest,
  type SyntheseEtats,
} from '@suivi/shared';
import { DataTable, StatusChip, type Etat } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { PlanEcarts } from './PlanEcarts';

interface Referentiel {
  frameworkId: string;
  name: string;
  version: number;
  requirements: number;
  covered: number;
  toValidate: number;
  uncovered: number;
  etats: SyntheseEtats & { applicables: number; aDeterminer: number; obligatoiresNonConformes: number };
}
interface Detail {
  id: string;
  title: string;
  status: 'covered' | 'to_validate' | 'uncovered';
  measures: { ref: string; name: string }[];
  evaluation: (EvaluationExigence & { frameworkVersion: number }) | null;
  etat: EtatExigence;
  /** Exigence obligatoire (clauses 4 à 10 de l'ISO/IEC 27001) : jamais excluable. */
  obligatoire: boolean;
  /** Une exclusion enregistrée avant l'interdiction : à corriger. */
  exclusionIllicite: boolean;
  sansMesure: boolean;
}
const COULEUR_ETAT: Record<EtatExigence, Etat> = {
  non_implemente: 'neutre',
  partiel: 'attention',
  implemente: 'info',
  teste: 'info',
  valide_metier: 'succes',
  non_applicable: 'neutre',
};
const ETATS_LIEN: Record<Detail['status'], string> = {
  covered: 'Mesure reliée',
  to_validate: 'Rapprochement à valider',
  uncovered: 'Aucune mesure reliée',
};

interface Formulaire {
  applicability: Applicabilite;
  justification: string;
  implementation: MiseEnOeuvre;
  implementationNote: string;
  testedAt: string;
  testResult: ResultatTest | null;
  testNote: string;
  testRef: string;
  validatedAt: string;
  validationNote: string;
  reason: string;
}
const depuis = (e: Detail['evaluation'], obligatoire: boolean): Formulaire => ({
  applicability: obligatoire && e?.applicability !== 'applicable' ? 'applicable' : (e?.applicability ?? 'a_determiner'),
  justification: e?.justification ?? '',
  implementation: e?.implementation ?? 'aucune',
  implementationNote: e?.implementationNote ?? '',
  testedAt: e?.testedAt ?? '',
  testResult: e?.testResult ?? null,
  testNote: e?.testNote ?? '',
  testRef: e?.testRef ?? '',
  validatedAt: e?.validatedAt ?? '',
  validationNote: e?.validationNote ?? '',
  reason: '',
});

function Evaluation({
  smsi,
  frameworkId,
  ligne,
  onClose,
}: {
  smsi: string;
  frameworkId: string;
  ligne: Detail;
  onClose: () => void;
}) {
  const can = useCan(),
    qc = useQueryClient(),
    peutValider = can('pilotage', 'administrer'),
    [f, setF] = useState<Formulaire>(depuis(ligne.evaluation, ligne.obligatoire)),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false);
  const historique = useQuery({
    queryKey: ['grc', smsi, 'evaluations', frameworkId, ligne.id],
    queryFn: () =>
      get<(EvaluationExigence & { etat: EtatExigence })[]>(
        `/api/grc/${smsi}/exigences/${frameworkId}/${encodeURIComponent(ligne.id)}/evaluations`,
      ),
  });
  const corps = {
    applicability: f.applicability,
    justification: f.justification,
    implementation: f.implementation,
    implementationNote: f.implementationNote,
    testedAt: f.testedAt || null,
    testResult: f.testResult,
    testNote: f.testNote,
    testRef: f.testRef,
    validatedAt: f.validatedAt || null,
    validationNote: f.validationNote,
  };
  const problemes = incoherencesEvaluation(corps);
  const maj = <K extends keyof Formulaire>(k: K, v: Formulaire[K]) => setF((x) => ({ ...x, [k]: v }));
  const enregistrer = async () => {
    setEnvoi(true);
    try {
      setErreur(null);
      await api('POST', `/api/grc/${smsi}/exigences/${frameworkId}/${encodeURIComponent(ligne.id)}/evaluations`, {
        body: { ...corps, reason: f.reason, confirm: 'EVALUER' },
        ifMatch: ligne.evaluation?.version ?? 0,
      });
      await qc.invalidateQueries({ queryKey: ['grc', smsi, 'couverture'] });
      await qc.invalidateQueries({ queryKey: ['grc', smsi, 'evaluations', frameworkId, ligne.id] });
      onClose();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Text size="sm">{ligne.title}</Text>
      <Select
        label="Applicabilité"
        allowDeselect={false}
        description={
          ligne.obligatoire
            ? 'Exigence obligatoire (ISO/IEC 27001, clauses 4 à 10) : elle ne peut pas être exclue.'
            : undefined
        }
        data={APPLICABILITES.filter((a) => !(ligne.obligatoire && a === 'exclue')).map((a) => ({
          value: a,
          label: LIBELLES_APPLICABILITE[a],
        }))}
        value={f.applicability}
        onChange={(v) => v && maj('applicability', v as Applicabilite)}
      />
      {f.applicability === 'exclue' && (
        <Textarea
          label="Justification de l’exclusion"
          required
          autosize
          minRows={2}
          value={f.justification}
          onChange={(e) => maj('justification', e.currentTarget.value)}
        />
      )}
      <Select
        label="Mise en œuvre"
        allowDeselect={false}
        data={MISES_EN_OEUVRE.map((a) => ({ value: a, label: LIBELLES_MISE_EN_OEUVRE[a] }))}
        value={f.implementation}
        onChange={(v) => v && maj('implementation', v as MiseEnOeuvre)}
      />
      <Textarea
        label="Note sur la mise en œuvre"
        autosize
        minRows={2}
        value={f.implementationNote}
        onChange={(e) => maj('implementationNote', e.currentTarget.value)}
      />
      <Group grow align="flex-end">
        <TextInput
          type="date"
          label="Date du test d’efficacité"
          value={f.testedAt}
          onChange={(e) => maj('testedAt', e.currentTarget.value)}
        />
        <Select
          label="Résultat du test"
          clearable
          data={RESULTATS_TEST.map((a) => ({ value: a, label: LIBELLES_RESULTAT_TEST[a] }))}
          value={f.testResult}
          onChange={(v) => maj('testResult', (v as ResultatTest | null) ?? null)}
        />
      </Group>
      <TextInput
        label="Référence de la preuve du test"
        description="Document, rapport ou lien : texte libre."
        value={f.testRef}
        onChange={(e) => maj('testRef', e.currentTarget.value)}
      />
      <Textarea
        label="Note sur le test"
        autosize
        minRows={2}
        value={f.testNote}
        onChange={(e) => maj('testNote', e.currentTarget.value)}
      />
      <TextInput
        type="date"
        label="Date de validation métier"
        description={
          peutValider
            ? 'Décision de pilotage : suppose une exigence applicable, complètement mise en œuvre et testée conforme.'
            : 'Réservée à l’administration du Pilotage.'
        }
        disabled={!peutValider}
        value={f.validatedAt}
        onChange={(e) => maj('validatedAt', e.currentTarget.value)}
      />
      {f.validatedAt && (
        <Textarea
          label="Note de validation"
          autosize
          minRows={2}
          value={f.validationNote}
          onChange={(e) => maj('validationNote', e.currentTarget.value)}
        />
      )}
      {problemes.length > 0 && (
        <Alert color="orange" role="alert">
          {problemes.map((p) => (
            <Text key={p} size="sm">
              {p}
            </Text>
          ))}
        </Alert>
      )}
      <TextInput
        label="Motif de cette version"
        required
        value={f.reason}
        onChange={(e) => maj('reason', e.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Annuler
        </Button>
        <Button loading={envoi} disabled={problemes.length > 0 || !f.reason.trim()} onClick={enregistrer}>
          Enregistrer une nouvelle version
        </Button>
      </Group>
      <Text fw={600}>Historique des versions</Text>
      <ErrorAlert error={historique.error} />
      {historique.data && !historique.data.length && <Text size="sm">Aucune évaluation enregistrée.</Text>}
      {(historique.data ?? []).map((h) => (
        <Text key={h.version} size="sm">
          v{h.version} · {LIBELLES_ETAT[h.etat]} · {h.createdBy} · {String(h.createdAt).slice(0, 10)} — {h.reason}
        </Text>
      ))}
    </Stack>
  );
}

export function Couverture({ smsi }: { smsi: string }) {
  const can = useCan(),
    [choix, setChoix] = useState<string | null>(null),
    [filtre, setFiltre] = useState<string | null>(null),
    [ouverte, setOuverte] = useState<Detail | null>(null),
    [plan, setPlan] = useState(false);
  const q = useQuery({
    queryKey: ['grc', smsi, 'couverture', choix],
    queryFn: () =>
      get<{ frameworks: Referentiel[]; detail: Detail[] | null }>(
        `/api/grc/${smsi}/couverture${choix ? `?frameworkId=${choix}` : ''}`,
      ),
  });
  const frameworks = q.data?.frameworks ?? [];
  const lignes = (q.data?.detail ?? []).filter((r) => !filtre || r.etat === filtre);
  return (
    <Stack>
      <Alert>
        L’état d’une exigence se déduit de son évaluation dans ce périmètre : mise en œuvre, test d’efficacité puis
        validation métier. Une mesure ou une preuve partagée avec un autre référentiel ne rend jamais une exigence «
        testée » ou « validée » : chaque exigence s’évalue pour elle-même. Un rapprochement non décidé est affiché à
        part et n’est pas compté. Ces états aident à piloter : ils ne constituent ni un taux de conformité ni une preuve
        de conformité à un référentiel.
      </Alert>
      <ErrorAlert error={q.error} />
      {q.data && !frameworks.length && (
        <Text>
          Aucun référentiel de la bibliothèque n’est rattaché et actif dans ce périmètre (page Périmètres, bouton «
          Référentiels »).
        </Text>
      )}
      <Stack>
        {frameworks.map((f) => (
          <Card key={f.frameworkId} withBorder>
            <Text fw={600}>{f.name}</Text>
            <Text size="sm" c="dimmed">
              Version {f.version} · {f.requirements} exigence(s) · {f.etats.applicables} applicable(s) ou à déterminer
            </Text>
            {f.etats.obligatoiresNonConformes > 0 && (
              <Alert color="red" mt="sm" role="alert">
                {f.etats.obligatoiresNonConformes} clause(s) obligatoire(s) (4 à 10) pas encore conforme(s). Une clause
                est conforme quand sa mise en œuvre est complète et son test d’efficacité conforme ; elle ne peut pas
                être exclue.
              </Alert>
            )}
            {f.etats.aDeterminer > 0 && (
              <Alert color="orange" mt="sm" role="alert">
                {f.etats.aDeterminer} exigence(s) à déterminer : leur applicabilité n’a pas encore été tranchée. À
                revoir : chaque exigence doit être déclarée applicable ou exclue (avec justification).
              </Alert>
            )}
            <Group mt="sm" gap="xs">
              {ETATS_EXIGENCE.map((e) => (
                <StatusChip key={e} etat={COULEUR_ETAT[e]}>
                  {f.etats[e]} · {LIBELLES_ETAT[e]}
                </StatusChip>
              ))}
            </Group>
            <Group mt="xs" gap="xs">
              <StatusChip etat="succes">{f.covered} avec mesure reliée</StatusChip>
              <StatusChip etat="info">{f.toValidate} rapprochement(s) à valider</StatusChip>
              <StatusChip etat="neutre">{f.uncovered} sans mesure reliée</StatusChip>
            </Group>
          </Card>
        ))}
      </Stack>
      {frameworks.length > 0 && (
        <Group align="flex-end">
          <Select
            label="Détail par exigence"
            placeholder="Choisir un référentiel"
            clearable
            data={frameworks.map((f) => ({ value: f.frameworkId, label: f.name }))}
            value={choix}
            onChange={setChoix}
          />
          {choix && can('ecarts', 'modifier') && (
            <Button variant="default" onClick={() => setPlan(true)}>
              Créer le plan d’action des écarts
            </Button>
          )}
          {choix && (
            <Select
              label="Filtrer par état"
              placeholder="Tous les états"
              clearable
              data={ETATS_EXIGENCE.map((e) => ({ value: e, label: LIBELLES_ETAT[e] }))}
              value={filtre}
              onChange={setFiltre}
            />
          )}
        </Group>
      )}
      {q.data?.detail && (
        <DataTable label="Exigences du référentiel, défilement horizontal possible">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Exigence</Table.Th>
                <Table.Th>Applicabilité</Table.Th>
                <Table.Th>État</Table.Th>
                <Table.Th>Mesures reliées</Table.Th>
                <Table.Th>Dernière évaluation</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lignes.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <b>{r.id}</b> · {r.title}
                  </Table.Td>
                  <Table.Td>
                    {r.obligatoire ? (
                      'Applicable (obligatoire)'
                    ) : (r.evaluation?.applicability ?? 'a_determiner') === 'a_determiner' ? (
                      <StatusChip etat="attention">À déterminer : à revoir</StatusChip>
                    ) : (
                      LIBELLES_APPLICABILITE[r.evaluation!.applicability]
                    )}
                    {r.exclusionIllicite && <StatusChip etat="erreur">Exclusion non permise</StatusChip>}
                    {r.obligatoire &&
                      (exigenceConforme(r.etat) ? (
                        <StatusChip etat="succes">Clause conforme</StatusChip>
                      ) : (
                        <StatusChip etat={r.evaluation?.testResult === 'non_conforme' ? 'erreur' : 'attention'}>
                          Clause pas encore conforme
                        </StatusChip>
                      ))}
                  </Table.Td>
                  <Table.Td>
                    <StatusChip etat={COULEUR_ETAT[r.etat]}>{LIBELLES_ETAT[r.etat]}</StatusChip>
                    {r.evaluation?.testResult === 'non_conforme' && (
                      <StatusChip etat="erreur">Test non conforme</StatusChip>
                    )}
                    {r.sansMesure && <StatusChip etat="attention">Aucune mesure reliée</StatusChip>}
                  </Table.Td>
                  <Table.Td>{r.measures.map((m) => m.name || m.ref).join(', ') || ETATS_LIEN[r.status]}</Table.Td>
                  <Table.Td>
                    {r.evaluation
                      ? `v${r.evaluation.version} · ${r.evaluation.createdBy} · ${String(r.evaluation.createdAt).slice(0, 10)}`
                      : '—'}
                  </Table.Td>
                  <Table.Td>
                    {can('conformite', 'lire') && (
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`${can('conformite', 'modifier') ? 'Évaluer' : 'Consulter'} l’exigence ${r.id}`}
                        onClick={() => setOuverte(r)}
                      >
                        {can('conformite', 'modifier') ? 'Évaluer' : 'Historique'}
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
      {plan && choix && <PlanEcarts smsi={smsi} frameworkId={choix} onClose={() => setPlan(false)} />}
      <Modal
        opened={!!ouverte}
        onClose={() => setOuverte(null)}
        size="lg"
        title={ouverte ? `Évaluation de l’exigence ${ouverte.id}` : ''}
      >
        {ouverte && choix && (
          <Evaluation
            key={ouverte.id}
            smsi={smsi}
            frameworkId={choix}
            ligne={ouverte}
            onClose={() => setOuverte(null)}
          />
        )}
      </Modal>
    </Stack>
  );
}

/* Registre des risques (lot U3, ADR 0027) : niveaux brut et résiduel de la dernière appréciation, option de
   traitement, état d'acceptation (décision formelle), prochaine revue ; filtres appliqués par le serveur. */
import { Button, Group, Select, Table, Text, TextInput } from '@mantine/core';
import { ETATS_ACCEPTATION, type EtatAcceptation, type GrcObject } from '@suivi/shared';
import { DataTable, StatusChip, type Etat } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';

interface Ligne {
  id: string;
  name: string;
  code: string;
  demarche: string | null;
  strategie: string;
  brut: string | null;
  residuel: string | null;
  acceptabilite: string | null;
  appreciationValidee: boolean;
  acceptation: EtatAcceptation;
  decisionAcceptation: { result: string; until: string | null; date: string; by: string } | null;
  prochaineRevue: string | null;
  enRetard: boolean;
  /** Référence « object:<id> » de l'étude dont le risque est issu. */
  etude: string | null;
}

const DEMARCHES: Record<string, string> = {
  ebios_rm: 'EBIOS RM',
  iso27005: 'ISO/IEC 27005',
  mehari: 'MÉHARI',
  custom: 'Personnalisée',
};
const OPTIONS: Record<string, string> = {
  reduce: 'Réduire',
  accept: 'Accepter',
  transfer: 'Transférer',
  avoid: 'Éviter',
  treated: 'Traité',
};
const ETAT_CHIP: Record<EtatAcceptation, Etat> = {
  sans_objet: 'neutre',
  a_decider: 'attention',
  acceptee: 'succes',
  refusee: 'erreur',
  echue: 'erreur',
};
const jour = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR') : '—');

export function RegistreRisques({
  smsi,
  onOpen,
  onEvaluation,
  onAcceptation,
  onRelation,
}: {
  smsi: string;
  onOpen: (o: GrcObject) => void;
  onEvaluation: (o: GrcObject) => void;
  onAcceptation: (o: GrcObject) => void;
  onRelation: (ref: string) => void;
}) {
  const can = useCan();
  const [demarche, setDemarche] = useState<string | null>(null),
    [strategie, setStrategie] = useState<string | null>(null),
    [acceptation, setAcceptation] = useState<string | null>(null),
    [etude, setEtude] = useState<string | null>(null),
    [retard, setRetard] = useState(false),
    [recherche, setRecherche] = useState('');
  const params = new URLSearchParams();
  if (demarche) params.set('demarche', demarche);
  if (strategie) params.set('strategie', strategie);
  if (acceptation) params.set('acceptation', acceptation);
  if (etude) params.set('etude', etude);
  if (retard) params.set('enRetard', '1');
  if (recherche) params.set('recherche', recherche);
  const q = useQuery({
    queryKey: ['grc', smsi, 'risk-register', params.toString()],
    queryFn: () => get<{ items: Ligne[]; tronque: boolean }>(`/api/grc/${smsi}/risks/register?${params}`),
  });
  const etudes = useQuery({
    queryKey: ['grc', smsi, 'objects', 'risk_study'],
    queryFn: () => get<{ items: GrcObject[] }>(`/api/grc/${smsi}/objects?kind=risk_study`),
  });
  const nomEtude = new Map((etudes.data?.items ?? []).map((e) => ['object:' + e.id, e.name] as const));
  const objet = (id: string) => get<GrcObject>(`/api/grc/${smsi}/objects/${id}`);
  return (
    <>
      <Group align="end">
        <TextInput label="Rechercher" value={recherche} onChange={(e) => setRecherche(e.currentTarget.value)} />
        <Select
          label="Démarche"
          clearable
          data={Object.entries(DEMARCHES).map(([value, label]) => ({ value, label }))}
          value={demarche}
          onChange={setDemarche}
        />
        <Select
          label="Étude"
          clearable
          data={(etudes.data?.items ?? []).map((e) => ({ value: e.id, label: e.name }))}
          value={etude}
          onChange={setEtude}
        />
        <Select
          label="Option de traitement"
          clearable
          data={Object.entries(OPTIONS).map(([value, label]) => ({ value, label }))}
          value={strategie}
          onChange={setStrategie}
        />
        <Select
          label="Acceptation"
          clearable
          data={Object.entries(ETATS_ACCEPTATION).map(([value, label]) => ({ value, label }))}
          value={acceptation}
          onChange={setAcceptation}
        />
        <Button variant={retard ? 'filled' : 'default'} onClick={() => setRetard((x) => !x)}>
          Revue dépassée
        </Button>
      </Group>
      <ErrorAlert error={q.error} />
      {q.data?.tronque && <Text size="sm">Seuls les 500 premiers risques sont affichés : précisez les filtres.</Text>}
      {q.data && !q.data.items.length && <Text>Aucun risque ne correspond.</Text>}
      {!!q.data?.items.length && (
        <DataTable label="Registre des risques">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Risque</Table.Th>
                <Table.Th className="col-p2">Démarche</Table.Th>
                <Table.Th className="col-p3">Étude</Table.Th>
                <Table.Th>Brut</Table.Th>
                <Table.Th>Résiduel</Table.Th>
                <Table.Th className="col-p2">Option</Table.Th>
                <Table.Th>Acceptation</Table.Th>
                <Table.Th className="col-p3">Prochaine revue</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {q.data.items.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    {r.code ? `${r.code} · ` : ''}
                    {r.name}
                  </Table.Td>
                  <Table.Td className="col-p2">{r.demarche ? (DEMARCHES[r.demarche] ?? r.demarche) : '—'}</Table.Td>
                  <Table.Td className="col-p3">{r.etude ? (nomEtude.get(r.etude) ?? 'Étude liée') : '—'}</Table.Td>
                  <Table.Td>{r.brut ?? 'Non apprécié'}</Table.Td>
                  <Table.Td>
                    {r.residuel ?? '—'}
                    {r.residuel && !r.appreciationValidee ? ' (brouillon)' : ''}
                  </Table.Td>
                  <Table.Td className="col-p2">{OPTIONS[r.strategie] ?? r.strategie}</Table.Td>
                  <Table.Td>
                    <StatusChip etat={ETAT_CHIP[r.acceptation]}>{ETATS_ACCEPTATION[r.acceptation]}</StatusChip>
                    {r.decisionAcceptation?.until && (
                      <Text size="xs" c="dimmed">
                        jusqu’au {jour(r.decisionAcceptation.until)}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td className="col-p3">
                    {r.enRetard ? (
                      <StatusChip etat="erreur">{jour(r.prochaineRevue)}</StatusChip>
                    ) : (
                      jour(r.prochaineRevue)
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Button size="xs" variant="default" onClick={() => void objet(r.id).then(onOpen)}>
                        Ouvrir
                      </Button>
                      <Button size="xs" variant="default" onClick={() => onRelation('object:' + r.id)}>
                        Liens et preuves
                      </Button>
                      <Button size="xs" variant="light" onClick={() => void objet(r.id).then(onEvaluation)}>
                        Apprécier / réévaluer
                      </Button>
                      {can('pilotage', 'administrer') && r.strategie === 'accept' && (
                        <Button size="xs" variant="light" onClick={() => void objet(r.id).then(onAcceptation)}>
                          Décider de l’acceptation
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
    </>
  );
}

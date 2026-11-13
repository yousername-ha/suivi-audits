/* Plan d'action des écarts (ADR 0056) : crée en une fois une action liée par exigence « applicable » dont l'état est « non
   implémenté » ou « partiel ». L'aperçu est en lecture seule ; la création est confirmée, idempotente (une exigence déjà
   portée par une action active n'en reçoit pas une deuxième) et ne modifie aucune évaluation. */
import { Alert, Button, Group, List, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { LIBELLES_ETAT, type EtatExigence, type RegistreDto } from '@suivi/shared';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';

interface Apercu {
  nom: string;
  ecarts: number;
  dejaCouverts: number;
  aCreer: number;
  horsEcart: number;
  limite: number;
  exigences: { id: string; title: string; etat: EtatExigence }[];
  avertissements: string[];
}

export function PlanEcarts({ smsi, frameworkId, onClose }: { smsi: string; frameworkId: string; onClose: () => void }) {
  const qc = useQueryClient(),
    [registre, setRegistre] = useState<string | null>(null),
    [echeance, setEcheance] = useState(''),
    [confirme, setConfirme] = useState(''),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false),
    [resultat, setResultat] = useState<string | null>(null);
  const apercu = useQuery({
    queryKey: ['grc', smsi, 'plan-ecarts', frameworkId],
    queryFn: () => get<Apercu>(`/api/grc/${smsi}/plan-ecarts?frameworkId=${frameworkId}`),
  });
  const registres = useQuery({
    queryKey: ['registres', 'plan_actions', smsi],
    queryFn: () => get<{ items: RegistreDto[] }>('/api/registres?kind=plan_actions'),
  });
  const options = (registres.data?.items ?? [])
    .filter((r) => r.referenceId === smsi && r.peut.gerer && !r.archived)
    .map((r) => ({ value: r.id, label: r.parDefaut ? `${r.name} (par défaut)` : r.name }));
  const a = apercu.data;
  const creer = async () => {
    if (!a) return;
    setEnvoi(true);
    try {
      setErreur(null);
      const r = await api<{ creees: number; dejaCouvertes: number }>('POST', `/api/grc/${smsi}/plan-ecarts`, {
        body: {
          frameworkId,
          requirementIds: a.exigences.map((e) => e.id),
          registreId: registre,
          dueAt: echeance || null,
          confirm: 'CREER',
        },
      });
      setResultat(
        r.creees
          ? `${r.creees} action(s) créée(s) et liée(s) à leur exigence. Les évaluations ne sont pas modifiées.`
          : 'Aucune action à créer : chaque écart est déjà porté par une action.',
      );
      await qc.invalidateQueries({ queryKey: ['grc', smsi] });
      await qc.invalidateQueries({ queryKey: ['registres'] });
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Modal opened onClose={onClose} size="lg" title="Créer le plan d’action des écarts">
      <Stack data-testid="plan-ecarts">
        <ErrorAlert error={erreur ?? apercu.error} />
        {a && (
          <>
            <Text size="sm">
              {a.nom} : {a.ecarts} écart(s) (exigences applicables non implémentées ou partielles), dont{' '}
              {a.dejaCouverts} déjà porté(s) par une action. {a.aCreer} action(s) seraient créées ; {a.horsEcart}{' '}
              exigence(s) ne sont pas des écarts.
            </Text>
            {a.avertissements.map((w) => (
              <Alert key={w} color="blue">
                {w}
              </Alert>
            ))}
            {a.exigences.length > 0 && (
              <List size="sm" aria-label="Exigences qui recevraient une action">
                {a.exigences.map((e) => (
                  <List.Item key={e.id}>
                    <b>{e.id}</b> · {e.title} — {LIBELLES_ETAT[e.etat]}
                  </List.Item>
                ))}
              </List>
            )}
            {a.aCreer > 0 && !resultat && (
              <>
                <Select
                  label="Plan d’actions d’accueil"
                  description="Sans choix : le registre par défaut du périmètre."
                  clearable
                  data={options}
                  value={registre}
                  onChange={setRegistre}
                />
                <TextInput
                  label="Échéance commune (facultative)"
                  type="date"
                  value={echeance}
                  onChange={(e) => setEcheance(e.currentTarget.value)}
                />
                <TextInput
                  label="Confirmation"
                  description="Saisissez CREER pour confirmer. Le responsable se précise ensuite, action par action."
                  value={confirme}
                  onChange={(e) => setConfirme(e.currentTarget.value)}
                />
              </>
            )}
          </>
        )}
        {resultat && <Alert color="green">{resultat}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Fermer
          </Button>
          <Button loading={envoi} disabled={!a || a.aCreer === 0 || confirme !== 'CREER' || !!resultat} onClick={creer}>
            Créer les actions
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

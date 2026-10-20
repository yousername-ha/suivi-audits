/* Déplacer un élément vers un autre registre de la même famille (R03) : choix du registre cible, aperçu de l'impact
   (périmètres avant et après, liens qui ne suivent pas, obstacles), motif, confirmation. L'API décide de tout. */
import { Alert, Button, Checkbox, Select, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { registreKindOf, type GrcObject, type ImpactDeplacement, type RegistreDto } from '@suivi/shared';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';

const DEPLACABLES = ['action', 'nonconformity', 'task_series'];

export const peutEtreDeplace = (o: GrcObject) =>
  DEPLACABLES.includes(o.kind) && !(o.kind === 'action' && typeof o.data.seriesId === 'string' && o.data.seriesId);

export function DeplacerElement({ smsi, object, onDone }: { smsi: string; object: GrcObject; onDone?: () => void }) {
  const qc = useQueryClient();
  const famille = registreKindOf(object.kind, object.data);
  const registres = useQuery({
    queryKey: ['registres', 'deplacement', famille],
    queryFn: () => get<{ items: RegistreDto[] }>(`/api/registres?kind=${famille}`),
    enabled: !!famille,
  });
  const [cible, setCible] = useState<string | null>(null);
  const [impact, setImpact] = useState<ImpactDeplacement | null>(null);
  const [retirer, setRetirer] = useState(false);
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const options = (registres.data?.items ?? [])
    .filter((r) => r.id !== object.registreId && r.peut.gerer && !r.archived)
    .map((r) => ({ value: r.id, label: r.name }));
  const appeler = async (corps: Record<string, unknown>, ifMatch?: number) =>
    api<{ impact: ImpactDeplacement }>('POST', `/api/grc/${smsi}/objects/${object.id}/deplacement`, {
      body: { registreId: cible, ...corps },
      ifMatch,
    });
  const apercu = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      setImpact((await appeler({ apercu: true })).impact);
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const confirmer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await appeler({ reason: motif, retirerLiensIncompatibles: retirer }, object.version);
      await qc.invalidateQueries({ queryKey: ['grc'] });
      await qc.invalidateQueries({ queryKey: ['registres'] });
      notifications.show({ color: 'teal', message: 'Élément déplacé.' });
      onDone?.();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  if (!famille || !options.length) return null;
  const nomsPerimetres = (l: { name: string }[]) => l.map((p) => p.name).join(', ');
  return (
    <Stack gap="xs" role="group" aria-label="Déplacer vers un autre registre">
      <Text fw={600}>Déplacer vers un autre registre</Text>
      <Text size="sm">
        L’élément garde son identifiant et son historique ; il hérite des périmètres du registre choisi.
      </Text>
      <ErrorAlert error={erreur} />
      <Select
        label="Registre cible"
        searchable
        data={options}
        value={cible}
        onChange={(v) => {
          setCible(v);
          setImpact(null);
        }}
      />
      {impact && (
        <Alert title="Impact du déplacement">
          <Text size="sm">
            De « {impact.depuis.name} » ({nomsPerimetres(impact.depuis.perimetres)}) vers « {impact.vers.name} » (
            {nomsPerimetres(impact.vers.perimetres)}). Éléments déplacés : {impact.elements}.{' '}
            {impact.referenceChange
              ? 'Le périmètre de référence change : la politique métier du nouveau périmètre s’applique.'
              : 'Le périmètre de référence ne change pas.'}{' '}
            Liens conservés : {impact.liensConserves}.
          </Text>
          {impact.liensIncompatibles.length > 0 && (
            <Text size="sm" mt="xs">
              Liens qui ne peuvent pas suivre : {impact.liensIncompatibles.map((l) => l.nom).join(', ')}.
            </Text>
          )}
          {impact.problemes.map((p) => (
            <Text key={p} size="sm" c="red">
              {p}
            </Text>
          ))}
        </Alert>
      )}
      {impact && impact.liensIncompatibles.length > 0 && (
        <Checkbox
          label="Retirer les liens qui ne peuvent pas suivre"
          checked={retirer}
          onChange={(e) => setRetirer(e.currentTarget.checked)}
        />
      )}
      {impact && (
        <Textarea
          label="Motif du déplacement"
          description="10 caractères au moins ; inscrit au journal."
          autosize
          minRows={2}
          value={motif}
          onChange={(e) => setMotif(e.currentTarget.value)}
        />
      )}
      {!impact ? (
        <Button variant="default" loading={envoi} disabled={!cible} onClick={() => void apercu()}>
          Prévisualiser l’impact
        </Button>
      ) : (
        <Button
          loading={envoi}
          disabled={
            motif.trim().length < 10 ||
            impact.problemes.length > 0 ||
            (impact.liensIncompatibles.length > 0 && !retirer)
          }
          onClick={() => void confirmer()}
        >
          Confirmer le déplacement
        </Button>
      )}
    </Stack>
  );
}

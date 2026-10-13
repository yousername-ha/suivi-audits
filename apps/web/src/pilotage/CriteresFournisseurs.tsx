/* Critères d'évaluation des fournisseurs (ADR 0032, lot M4) : définis par l'organisme, aucun n'est fourni. Les usages
   viennent de l'ISO 9001:2015, 8.4.1 ; les exigences visées viennent des référentiels de la bibliothèque. */
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  MultiSelect,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { USAGES_CRITERE, USAGES_CRITERE_LIBELLES } from '@suivi/shared';
import { DataTable, StatusChip } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { ExtremiteChamps } from './CorrespondancesBibliotheque';
import type { Critere } from './Fournisseurs';

interface Referentiel {
  id: string;
  name: string;
  version: number;
}
interface Formulaire {
  edition: Critere | null;
  label: string;
  description: string;
  purposes: string[];
  requirementRefs: string[];
  reason: string;
}
const VIDE_EXIGENCE = { frameworkId: '', version: '', requirementId: '' };

export function CriteresFournisseurs() {
  const can = useCan(),
    qc = useQueryClient(),
    administrer = can('fournisseurs', 'administrer'),
    [archives, setArchives] = useState(false),
    [formulaire, setFormulaire] = useState<Formulaire | null>(null),
    [exigence, setExigence] = useState(VIDE_EXIGENCE),
    [retrait, setRetrait] = useState<{ critere: Critere; motif: string } | null>(null),
    [erreur, setErreur] = useState<unknown>(null);
  const liste = useQuery({
    queryKey: ['suppliers', 'criteria', archives],
    queryFn: () => get<Critere[]>(`/api/suppliers/criteria?archived=${archives}`),
  });
  const referentiels = useQuery({
    queryKey: ['library', 'frameworks'],
    queryFn: () => get<Referentiel[]>('/api/library/frameworks'),
    enabled: can('conformite', 'lire'),
  });
  const noms = new Map((referentiels.data ?? []).map((r) => [r.id, r.name]));
  const libelleExigence = (ref: string) => {
    const [, fw, v, ...id] = ref.split(':');
    return `${noms.get(fw ?? '') ?? 'Référentiel'} v${v} · ${id.join(':')}`;
  };
  const ouvrir = (k: Critere | null) => {
    setErreur(null);
    setExigence(VIDE_EXIGENCE);
    setFormulaire({
      edition: k,
      label: k?.label ?? '',
      description: k?.description ?? '',
      purposes: k?.purposes ?? [],
      requirementRefs: k?.requirementRefs ?? [],
      reason: '',
    });
  };
  const champ = <K extends keyof Formulaire>(cle: K, v: Formulaire[K]) =>
    setFormulaire((f) => (f ? { ...f, [cle]: v } : f));
  const enregistrer = async () => {
    if (!formulaire) return;
    try {
      setErreur(null);
      const body = {
        label: formulaire.label.trim(),
        description: formulaire.description,
        purposes: formulaire.purposes,
        requirementRefs: formulaire.requirementRefs,
        reason: formulaire.reason.trim(),
      };
      if (formulaire.edition)
        await api('PUT', `/api/suppliers/criteria/${formulaire.edition.id}`, {
          body,
          ifMatch: formulaire.edition.version,
        });
      else await api('POST', '/api/suppliers/criteria', { body });
      await qc.invalidateQueries({ queryKey: ['suppliers'] });
      setFormulaire(null);
    } catch (e) {
      setErreur(e);
    }
  };
  const retirer = async () => {
    if (!retrait) return;
    try {
      setErreur(null);
      await api('POST', `/api/suppliers/criteria/${retrait.critere.id}/archive`, {
        body: { reason: retrait.motif.trim(), confirm: 'RETIRER' },
        ifMatch: retrait.critere.version,
      });
      await qc.invalidateQueries({ queryKey: ['suppliers'] });
      setRetrait(null);
    } catch (e) {
      setErreur(e);
    }
  };
  const ajouterExigence = () => {
    if (!exigence.requirementId) return;
    const ref = `requirement:${exigence.frameworkId}:${exigence.version}:${exigence.requirementId}`;
    setFormulaire((f) =>
      f && !f.requirementRefs.includes(ref) ? { ...f, requirementRefs: [...f.requirementRefs, ref] } : f,
    );
    setExigence(VIDE_EXIGENCE);
  };
  return (
    <Stack>
      <Alert>
        Les critères sont ceux que votre organisme définit : aucun n’est fourni, et il n’y a ni note ni seuil. Les
        usages proposés reprennent l’ISO 9001:2015, 8.4.1 (sélection, évaluation, surveillance des performances,
        réévaluation). Chaque modification crée une version ; une évaluation déjà enregistrée garde le libellé et la
        version du critère tels qu’ils étaient.
      </Alert>
      <ErrorAlert error={erreur ?? liste.error} />
      <Group justify="space-between">
        <Switch
          label="Afficher les critères retirés"
          checked={archives}
          onChange={(e) => setArchives(e.currentTarget.checked)}
        />
        {administrer && <Button onClick={() => ouvrir(null)}>Définir un critère</Button>}
      </Group>
      <DataTable label="Critères d’évaluation des fournisseurs, défilement horizontal possible">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Critère</Table.Th>
              <Table.Th>Usages</Table.Th>
              <Table.Th>Exigences visées</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(liste.data ?? []).map((k) => (
              <Table.Tr key={k.id}>
                <Table.Td>
                  <Text fw={600}>{k.label}</Text>
                  <Text size="xs" c="dimmed">
                    Version {k.version}
                    {k.description ? ` · ${k.description}` : ''}
                  </Text>
                  {k.archived && <StatusChip etat="neutre">Retiré</StatusChip>}
                </Table.Td>
                <Table.Td>
                  {k.purposes.length
                    ? k.purposes
                        .map((u) => USAGES_CRITERE_LIBELLES[u as keyof typeof USAGES_CRITERE_LIBELLES])
                        .join(', ')
                    : '—'}
                </Table.Td>
                <Table.Td>
                  {k.requirementRefs.length ? (
                    <Stack gap="2xs">
                      {k.requirementRefs.map((r) => (
                        <Text key={r} size="sm">
                          {libelleExigence(r)}
                        </Text>
                      ))}
                    </Stack>
                  ) : (
                    '—'
                  )}
                </Table.Td>
                <Table.Td>
                  {administrer && !k.archived && (
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`Modifier le critère ${k.label}`}
                        onClick={() => ouvrir(k)}
                      >
                        Modifier
                      </Button>
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`Retirer le critère ${k.label}`}
                        onClick={() => setRetrait({ critere: k, motif: '' })}
                      >
                        Retirer
                      </Button>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataTable>
      {liste.data && !liste.data.length && <Text>Aucun critère défini pour le moment.</Text>}
      <Modal
        opened={!!formulaire}
        onClose={() => setFormulaire(null)}
        size="lg"
        title={formulaire?.edition ? 'Modifier le critère' : 'Définir un critère'}
      >
        {formulaire && (
          <Stack>
            <ErrorAlert error={erreur} />
            <TextInput
              label="Libellé"
              required
              value={formulaire.label}
              onChange={(e) => champ('label', e.currentTarget.value)}
            />
            <Textarea
              label="Description"
              value={formulaire.description}
              onChange={(e) => champ('description', e.currentTarget.value)}
            />
            <MultiSelect
              label="Usages"
              data={USAGES_CRITERE.map((u) => ({ value: u, label: USAGES_CRITERE_LIBELLES[u] }))}
              value={formulaire.purposes}
              onChange={(v) => champ('purposes', v)}
            />
            <Stack gap="xs">
              <Text fw={600}>Exigences visées (référentiels de la bibliothèque)</Text>
              <Group gap="xs">
                {formulaire.requirementRefs.map((r) => (
                  <Badge key={r} variant="default" size="lg" tt="none">
                    {libelleExigence(r)}{' '}
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      aria-label={`Retirer l’exigence ${libelleExigence(r)}`}
                      onClick={() =>
                        champ(
                          'requirementRefs',
                          formulaire.requirementRefs.filter((x) => x !== r),
                        )
                      }
                    >
                      ×
                    </Button>
                  </Badge>
                ))}
              </Group>
              {can('conformite', 'lire') && (
                <>
                  <ExtremiteChamps
                    titre="Exigence"
                    valeur={exigence}
                    referentiels={referentiels.data ?? []}
                    onChange={setExigence}
                  />
                  <Group>
                    <Button variant="default" disabled={!exigence.requirementId} onClick={ajouterExigence}>
                      Ajouter cette exigence
                    </Button>
                  </Group>
                </>
              )}
            </Stack>
            <Textarea
              label="Motif"
              description="5 caractères au moins ; conservé dans l’historique du critère."
              value={formulaire.reason}
              onChange={(e) => champ('reason', e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setFormulaire(null)}>
                Annuler
              </Button>
              <Button
                disabled={formulaire.label.trim().length < 3 || formulaire.reason.trim().length < 5}
                onClick={enregistrer}
              >
                Enregistrer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
      <Modal opened={!!retrait} onClose={() => setRetrait(null)} title="Retirer le critère">
        {retrait && (
          <Stack>
            <ErrorAlert error={erreur} />
            <Text>
              « {retrait.critere.label} » ne sera plus proposé dans les nouvelles évaluations ; les évaluations déjà
              enregistrées le conservent.
            </Text>
            <Textarea
              label="Motif"
              description="5 caractères au moins."
              value={retrait.motif}
              onChange={(e) => setRetrait({ ...retrait, motif: e.currentTarget.value })}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setRetrait(null)}>
                Annuler
              </Button>
              <Button disabled={retrait.motif.trim().length < 5} onClick={retirer}>
                Retirer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

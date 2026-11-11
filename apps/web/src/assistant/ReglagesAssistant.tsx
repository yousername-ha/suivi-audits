/* Réglages de l'assistant RSSI (Plateforme, ADR 0086) : fournisseur du modèle, clé en écriture seule, profils et périmètres,
   budget quotidien. L'écran dit en clair vers quel fournisseur partent les extraits lus par l'assistant. Droit requis :
   assistant:administrer (le serveur reste seul juge). */
import {
  Alert,
  Button,
  Card,
  Group,
  MultiSelect,
  NumberInput,
  PasswordInput,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { StatusChip } from '@suivi/ui';
import type { ReglagesAssistantDto, TestModeleDto } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, errorMessage, get } from '../api';
import { ConfirmButton, ErrorAlert } from '../components/common';

export const CLE_ETAT_ASSISTANT = ['assistant', 'etat'];
const CLE_REGLAGES = ['assistant', 'reglages'];

type Saisie = Pick<ReglagesAssistantDto, 'actif' | 'adresse' | 'modele' | 'budgetJetonsJour' | 'profils'>;
const hote = (adresse: string) => {
  try {
    return new URL(adresse).host;
  } catch {
    return '';
  }
};

export function ReglagesAssistantPanel({ onDirty }: { onDirty?: (modifie: boolean) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: CLE_REGLAGES, queryFn: () => get<ReglagesAssistantDto>('/api/assistant/reglages') });
  const perimetres = useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () => get<{ id: string; name: string }[]>('/api/grc/smsis'),
  });
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  const [cle, setCle] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const [test, setTest] = useState<TestModeleDto | null>(null);

  useEffect(() => {
    if (q.data && !saisie) {
      const { actif, adresse, modele, budgetJetonsJour, profils } = q.data;
      setSaisie({ actif, adresse, modele, budgetJetonsJour, profils });
    }
  }, [q.data, saisie]);
  const modifie =
    !!q.data &&
    !!saisie &&
    JSON.stringify(saisie) !==
      JSON.stringify({
        actif: q.data.actif,
        adresse: q.data.adresse,
        modele: q.data.modele,
        budgetJetonsJour: q.data.budgetJetonsJour,
        profils: q.data.profils,
      });
  useEffect(() => onDirty?.(modifie || cle !== ''), [modifie, cle, onDirty]);

  if (q.error) return <ErrorAlert error={q.error} />;
  if (!q.data || !saisie) return <Text c="dimmed">Chargement des réglages…</Text>;
  const d = q.data;
  const changer = (c: Partial<Saisie>) => setSaisie({ ...saisie, ...c });
  const actualiser = async () => {
    setSaisie(null);
    await Promise.all([
      qc.invalidateQueries({ queryKey: CLE_REGLAGES }),
      qc.invalidateQueries({ queryKey: CLE_ETAT_ASSISTANT }),
    ]);
  };
  const agir = async (fn: () => Promise<unknown>, message: string) => {
    setEnvoi(true);
    try {
      setErreur(null);
      await fn();
      notifications.show({ message, color: 'green' });
      await actualiser();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const enregistrer = () =>
    agir(
      () =>
        api('PUT', '/api/assistant/reglages', {
          body: {
            ...saisie,
            profils: saisie.profils.map(({ id, actif, perimetres: p }) => ({ id, actif, perimetres: p })),
            version: d.version,
          },
        }),
      'Réglages de l’assistant enregistrés.',
    );
  const tester = async () => {
    setEnvoi(true);
    try {
      setErreur(null);
      setTest(await api<TestModeleDto>('POST', '/api/assistant/reglages/test'));
    } catch (e) {
      setTest({ ok: false, detail: errorMessage(e) });
    } finally {
      setEnvoi(false);
    }
  };
  const choix = (perimetres.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const fournisseur = hote(saisie.adresse);

  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Alert color="orange" title="Ce qui quitte le serveur">
        Pour répondre, l’assistant envoie au fournisseur du modèle la question posée et les extraits qu’il a lus
        (intitulés d’écarts, descriptions de risques, noms d’éléments). Il ne lit que les périmètres choisis ci-dessous,
        avec les droits de la personne qui l’interroge. N’ouvrez pas un périmètre qui peut contenir des données de santé
        tant que le fournisseur n’est pas qualifié pour cela.
        {fournisseur ? ` Fournisseur réglé : ${fournisseur}.` : ''}
      </Alert>
      {!d.relaisDeclare && (
        <Alert color="red" title="Relais de modèle absent">
          Le relais de modèle n’est pas installé sur le serveur : l’assistant ne peut pas répondre. Voir le guide
          d’installation, « Assistant RSSI ».
        </Alert>
      )}

      <Card withBorder>
        <Stack>
          <Title order={3} size="h5">
            Modèle
          </Title>
          <Switch
            label="Activer l’assistant"
            checked={saisie.actif}
            onChange={(e) => changer({ actif: e.currentTarget.checked })}
          />
          <TextInput
            label="Adresse du service de modèle"
            description="Adresse HTTPS d’une API compatible OpenAI, par exemple https://api.mistral.ai/v1"
            value={saisie.adresse}
            onChange={(e) => changer({ adresse: e.currentTarget.value })}
          />
          <TextInput
            label="Nom du modèle"
            description="Tel que le fournisseur le nomme. Le modèle doit gérer l’appel d’outils."
            value={saisie.modele}
            onChange={(e) => changer({ modele: e.currentTarget.value })}
          />
          <NumberInput
            label="Budget quotidien, en jetons"
            description="Au-delà, l’assistant ne répond plus jusqu’au lendemain."
            min={1000}
            max={50_000_000}
            step={50_000}
            value={saisie.budgetJetonsJour}
            onChange={(v) => changer({ budgetJetonsJour: typeof v === 'number' ? v : saisie.budgetJetonsJour })}
          />
        </Stack>
      </Card>

      <Card withBorder>
        <Stack>
          <Title order={3} size="h5">
            Profils et périmètres
          </Title>
          <Text size="sm" c="dimmed">
            Un profil sans périmètre ne lit rien. Les deux profils restent séparés : un auditeur n’audite pas son propre
            travail.
          </Text>
          {saisie.profils.map((p, i) => {
            const maj = (c: Partial<(typeof saisie.profils)[number]>) =>
              changer({ profils: saisie.profils.map((x, j) => (j === i ? { ...x, ...c } : x)) });
            return (
              <Stack key={p.id} gap="xs">
                <Switch
                  label={`Profil « ${p.libelle} »`}
                  checked={p.actif}
                  onChange={(e) => maj({ actif: e.currentTarget.checked })}
                />
                <MultiSelect
                  label={`Périmètres ouverts au profil « ${p.libelle} »`}
                  data={choix}
                  value={p.perimetres}
                  onChange={(v) => maj({ perimetres: v })}
                  searchable
                  clearable
                  disabled={!p.actif}
                  comboboxProps={{ withinPortal: true }}
                />
              </Stack>
            );
          })}
        </Stack>
      </Card>

      <Group>
        <Button onClick={() => void enregistrer()} loading={envoi} disabled={!modifie}>
          Enregistrer
        </Button>
        {d.updatedBy && (
          <Text size="xs" c="dimmed">
            Dernière modification par {d.updatedBy}.
          </Text>
        )}
      </Group>

      <Card withBorder>
        <Stack>
          <Group justify="space-between">
            <Title order={3} size="h5">
              Clé du modèle
            </Title>
            <StatusChip etat={d.cleDefinie ? 'succes' : 'attention'}>
              {d.cleDefinie ? 'Clé enregistrée' : 'Aucune clé'}
            </StatusChip>
          </Group>
          <Text size="sm" c="dimmed">
            La clé est scellée sur le serveur. Elle n’est jamais réaffichée ni écrite dans un journal.
          </Text>
          <PasswordInput
            label={d.cleDefinie ? 'Remplacer la clé' : 'Clé fournie par le fournisseur du modèle'}
            value={cle}
            onChange={(e) => setCle(e.currentTarget.value)}
            autoComplete="off"
          />
          <Group>
            <Button
              variant="default"
              disabled={cle.length < 8}
              loading={envoi}
              onClick={() =>
                void agir(
                  () => api('PUT', '/api/assistant/reglages/cle', { body: { cle } }),
                  'Clé du modèle enregistrée.',
                ).then(() => setCle(''))
              }
            >
              Enregistrer la clé
            </Button>
            {d.cleDefinie && (
              <ConfirmButton
                variant="default"
                message="Retirer la clé du modèle ? L’assistant ne pourra plus répondre."
                onConfirm={() => agir(() => api('DELETE', '/api/assistant/reglages/cle'), 'Clé du modèle retirée.')}
              >
                Retirer la clé
              </ConfirmButton>
            )}
          </Group>
        </Stack>
      </Card>

      <Card withBorder>
        <Stack>
          <Title order={3} size="h5">
            Test de connexion
          </Title>
          <Text size="sm" c="dimmed">
            Un appel réel et minimal au modèle, avec les réglages enregistrés. Aucune donnée de la plateforme n’est
            envoyée.
          </Text>
          <Group>
            <Button variant="default" onClick={() => void tester()} loading={envoi} disabled={modifie}>
              Tester le modèle
            </Button>
            {test && <StatusChip etat={test.ok ? 'succes' : 'erreur'}>{test.detail}</StatusChip>}
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}

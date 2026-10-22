/* Types de processus (Plateforme) : registre des types qui classent les processus (pilotage, réalisation, support ou ceux que
   l'organisation définit). Un type utilisé s'archive au lieu de se supprimer ; le code ne change jamais. */
import { Button, Card, Group, Modal, Select, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { StatusChip } from '@suivi/ui';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  LIBELLES_TEINTE,
  TEINTES_TYPE_PROCESSUS,
  type TeinteTypeProcessus,
  type TypeProcessusDto,
} from '@suivi/shared';
import { api, errorMessage } from '../api';
import { ConfirmButton, ErrorAlert } from '../components/common';
import { TYPES_PROCESSUS_KEY, useTypesProcessus } from '../processus/types';
import { useCan } from '../session';

interface Formulaire {
  label: string;
  description: string;
  tint: TeinteTypeProcessus;
}
const vide: Formulaire = { label: '', description: '', tint: 'gris' };

export function TypesProcessusPanel() {
  const can = useCan();
  const qc = useQueryClient();
  const q = useTypesProcessus();
  const types = q.data ?? [];
  const administrer = can('administration', 'administrer');
  const [edition, setEdition] = useState<{ id: string | null; f: Formulaire } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);

  const actualiser = () => qc.invalidateQueries({ queryKey: TYPES_PROCESSUS_KEY });
  const agir = async (fn: () => Promise<unknown>, message: string) => {
    setEnvoi(true);
    try {
      setErreur(null);
      await fn();
      notifications.show({ message, color: 'green' });
      await actualiser();
      return true;
    } catch (e) {
      notifications.show({ message: errorMessage(e), color: 'red' });
      setErreur(e);
      return false;
    } finally {
      setEnvoi(false);
    }
  };
  const enregistrer = async () => {
    if (!edition) return;
    const corps = { label: edition.f.label, description: edition.f.description, tint: edition.f.tint };
    const ok = await agir(
      () =>
        edition.id
          ? api('PUT', `/api/types-processus/${edition.id}`, { body: corps })
          : api('POST', '/api/types-processus', { body: corps }),
      edition.id ? 'Type modifié.' : 'Type créé.',
    );
    if (ok) setEdition(null);
  };
  const deplacer = (t: TypeProcessusDto, sens: -1 | 1) => {
    const ids = types.map((x) => x.id);
    const i = ids.indexOf(t.id),
      j = i + sens;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    void agir(() => api('PUT', '/api/types-processus/ordre', { body: { ids } }), 'Ordre enregistré.');
  };

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Les types classent les processus (carte des processus, cartographie). Le libellé, la description et la teinte se
        modifient ; le code, repris par les processus, ne change jamais. Un type porté par des processus s’archive : il
        n’est plus proposé, mais les processus le gardent.
      </Text>
      <ErrorAlert error={q.error ?? erreur} />
      {administrer && (
        <Group>
          <Button onClick={() => setEdition({ id: null, f: vide })}>Nouveau type</Button>
        </Group>
      )}
      <Card withBorder p={0}>
        <div className="table-wrap" role="region" aria-label="Types de processus" tabIndex={0}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Type</Table.Th>
                <Table.Th>Code</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Processus</Table.Th>
                <Table.Th>État</Table.Th>
                {administrer && <Table.Th>Actions</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {types.map((t, i) => (
                <Table.Tr key={t.id}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <span className="pastille-teinte" data-teinte={t.tint} aria-hidden="true" />
                      <b>{t.label}</b>
                    </Group>
                  </Table.Td>
                  <Table.Td className="mono">{t.code}</Table.Td>
                  <Table.Td>{t.description}</Table.Td>
                  <Table.Td>{t.usage}</Table.Td>
                  <Table.Td>
                    <StatusChip etat={t.archived ? 'neutre' : 'succes'}>{t.archived ? 'Archivé' : 'Actif'}</StatusChip>
                  </Table.Td>
                  {administrer && (
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          size="compact-sm"
                          variant="default"
                          aria-label={`Monter ${t.label}`}
                          disabled={i === 0 || envoi}
                          onClick={() => deplacer(t, -1)}
                        >
                          ↑
                        </Button>
                        <Button
                          size="compact-sm"
                          variant="default"
                          aria-label={`Descendre ${t.label}`}
                          disabled={i === types.length - 1 || envoi}
                          onClick={() => deplacer(t, 1)}
                        >
                          ↓
                        </Button>
                        <Button
                          size="compact-sm"
                          variant="default"
                          onClick={() =>
                            setEdition({ id: t.id, f: { label: t.label, description: t.description, tint: t.tint } })
                          }
                        >
                          Modifier
                        </Button>
                        <Button
                          size="compact-sm"
                          variant="default"
                          disabled={envoi}
                          onClick={() =>
                            void agir(
                              () => api('PUT', `/api/types-processus/${t.id}`, { body: { archived: !t.archived } }),
                              t.archived ? 'Type restauré.' : 'Type archivé.',
                            )
                          }
                        >
                          {t.archived ? 'Restaurer' : 'Archiver'}
                        </Button>
                        <ConfirmButton
                          size="compact-sm"
                          variant="light"
                          disabled={t.usage > 0 || envoi}
                          message={`Supprimer définitivement le type « ${t.label} » ?`}
                          onConfirm={() => agir(() => api('DELETE', `/api/types-processus/${t.id}`), 'Type supprimé.')}
                        >
                          Supprimer
                        </ConfirmButton>
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
      <Modal
        opened={edition !== null}
        onClose={() => setEdition(null)}
        title={edition?.id ? 'Modifier le type' : 'Nouveau type de processus'}
        centered
        classNames={{ content: 'fenetre-admin' }}
      >
        {edition && (
          <Stack>
            <TextInput
              label="Libellé"
              required
              data-autofocus
              value={edition.f.label}
              onChange={(e) => setEdition({ ...edition, f: { ...edition.f, label: e.currentTarget.value } })}
            />
            <Textarea
              label="Description"
              autosize
              minRows={2}
              value={edition.f.description}
              onChange={(e) => setEdition({ ...edition, f: { ...edition.f, description: e.currentTarget.value } })}
            />
            <Select
              label="Teinte"
              allowDeselect={false}
              data={TEINTES_TYPE_PROCESSUS.map((x) => ({ value: x, label: LIBELLES_TEINTE[x] }))}
              value={edition.f.tint}
              onChange={(v) => v && setEdition({ ...edition, f: { ...edition.f, tint: v as TeinteTypeProcessus } })}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEdition(null)}>
                Annuler
              </Button>
              <Button loading={envoi} disabled={!edition.f.label.trim()} onClick={() => void enregistrer()}>
                Enregistrer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

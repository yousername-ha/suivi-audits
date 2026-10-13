/* Page « Périmètres » (ADR 0030, lot M1) : créer et modifier les périmètres de management, leur donner une nature
   libre (SMSI, SMQ, SMI…) et gérer les accès des périmètres restreints. Création et modification : droit
   `pilotage:administrer`, comme l'exige l'API. La nature est une simple étiquette, sans règle de comportement. */
import { Alert, Autocomplete, Button, Group, Modal, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NATURES_PERIMETRE } from '@suivi/shared';
import { DataTable, StatusChip } from '@suivi/ui';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { ReferentielsDuPerimetre } from './Bibliotheque';
import { Members } from './Members';

interface Perimetre {
  id: string;
  name: string;
  scope: string;
  nature: string;
  visibility: 'instance' | 'restricted';
  timezone: string;
  version: number;
}
interface Formulaire {
  name: string;
  nature: string;
  scope: string;
  timezone: string;
}
const VIDE: Formulaire = { name: '', nature: '', scope: '', timezone: 'Europe/Paris' };

export function Perimetres({ affiche, onChoisir }: { affiche: string; onChoisir: (id: string) => void }) {
  const can = useCan(),
    qc = useQueryClient(),
    admin = can('pilotage', 'administrer'),
    [formulaire, setFormulaire] = useState<{ edition: Perimetre | null; valeurs: Formulaire } | null>(null),
    [acces, setAcces] = useState<Perimetre | null>(null),
    [referentiels, setReferentiels] = useState<Perimetre | null>(null),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false);
  const liste = useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () => get<Perimetre[]>('/api/grc/smsis'),
  });
  const ouvrir = (p: Perimetre | null) => {
    setErreur(null);
    setFormulaire({
      edition: p,
      valeurs: p ? { name: p.name, nature: p.nature, scope: p.scope, timezone: p.timezone } : VIDE,
    });
  };
  const enregistrer = async () => {
    if (!formulaire) return;
    const { edition, valeurs } = formulaire;
    setEnvoi(true);
    try {
      setErreur(null);
      if (edition)
        await api('PATCH', `/api/grc/smsis/${edition.id}`, {
          body: { ...valeurs, confirm: 'ENREGISTRER' },
          ifMatch: edition.version,
        });
      else await api('POST', '/api/grc/smsis', { body: valeurs });
      await qc.invalidateQueries({ queryKey: ['grc', 'smsis'] });
      setFormulaire(null);
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const champ = (k: keyof Formulaire) => (v: string) =>
    setFormulaire((f) => (f ? { ...f, valeurs: { ...f.valeurs, [k]: v } } : f));
  return (
    <Stack>
      <Alert>
        La nature est un libellé libre (par exemple SMSI, SMQ ou SMI) : elle ne change pas le fonctionnement du
        périmètre. Méthode de risque, politique métier et référentiels se gèrent dans les rubriques du Pilotage, pour le
        périmètre affiché.
      </Alert>
      <ErrorAlert error={liste.error} />
      <Group justify="space-between">
        <Text>
          {liste.data ? `${liste.data.length} périmètre(s) accessible(s)` : 'Chargement des périmètres…'}
          {!admin && ' · Création et modification réservées au rôle de Pilotage.'}
        </Text>
        {admin && <Button onClick={() => ouvrir(null)}>Créer un périmètre</Button>}
      </Group>
      <DataTable label="Périmètres de management, défilement horizontal possible">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nom</Table.Th>
              <Table.Th>Nature</Table.Th>
              <Table.Th>Périmètre</Table.Th>
              <Table.Th>Accès</Table.Th>
              <Table.Th>Fuseau</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(liste.data ?? []).map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td>
                  <Text fw={600}>{p.name}</Text>
                  {p.id === affiche && <StatusChip etat="info">Affiché dans le Pilotage</StatusChip>}
                </Table.Td>
                <Table.Td>{p.nature ? <StatusChip etat="neutre">{p.nature}</StatusChip> : 'Non précisée'}</Table.Td>
                <Table.Td>
                  <Text lineClamp={2}>{p.scope || '—'}</Text>
                </Table.Td>
                <Table.Td>{p.visibility === 'instance' ? 'Toute l’organisation' : 'Membres seulement'}</Table.Td>
                <Table.Td>{p.timezone}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {p.id !== affiche && (
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`Afficher le périmètre ${p.name} dans le Pilotage`}
                        onClick={() => onChoisir(p.id)}
                      >
                        Afficher
                      </Button>
                    )}
                    {admin && (
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`Modifier le périmètre ${p.name}`}
                        onClick={() => ouvrir(p)}
                      >
                        Modifier
                      </Button>
                    )}
                    {can('conformite', 'lire') && (
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`Référentiels rattachés au périmètre ${p.name}`}
                        onClick={() => setReferentiels(p)}
                      >
                        Référentiels
                      </Button>
                    )}
                    {admin && p.visibility === 'restricted' && (
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`Gérer l’accès au périmètre ${p.name}`}
                        onClick={() => setAcces(p)}
                      >
                        Accès
                      </Button>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataTable>
      <Modal
        opened={!!formulaire}
        onClose={() => setFormulaire(null)}
        title={formulaire?.edition ? 'Modifier le périmètre' : 'Créer un périmètre'}
      >
        {formulaire && (
          <Stack>
            <ErrorAlert error={erreur} />
            <TextInput
              label="Nom"
              required
              value={formulaire.valeurs.name}
              onChange={(e) => champ('name')(e.currentTarget.value)}
            />
            <Autocomplete
              label="Nature"
              description="Libellé libre ; facultatif."
              data={[...NATURES_PERIMETRE]}
              maxLength={60}
              value={formulaire.valeurs.nature}
              onChange={champ('nature')}
            />
            <Textarea
              label="Périmètre"
              description="Activités, entités et services concernés."
              autosize
              minRows={3}
              value={formulaire.valeurs.scope}
              onChange={(e) => champ('scope')(e.currentTarget.value)}
            />
            <TextInput
              label="Fuseau horaire"
              description="Par exemple Europe/Paris."
              required
              value={formulaire.valeurs.timezone}
              onChange={(e) => champ('timezone')(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setFormulaire(null)}>
                Annuler
              </Button>
              <Button loading={envoi} disabled={!formulaire.valeurs.name.trim()} onClick={enregistrer}>
                {formulaire.edition ? 'Enregistrer' : 'Créer'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
      <Modal
        opened={!!referentiels}
        onClose={() => setReferentiels(null)}
        size="lg"
        title={referentiels ? `Référentiels du périmètre ${referentiels.name}` : ''}
      >
        {referentiels && <ReferentielsDuPerimetre smsi={referentiels.id} />}
      </Modal>
      <Modal opened={!!acces} onClose={() => setAcces(null)} title={acces ? `Accès au périmètre ${acces.name}` : ''}>
        {acces && <Members smsi={acces.id} />}
      </Modal>
    </Stack>
  );
}

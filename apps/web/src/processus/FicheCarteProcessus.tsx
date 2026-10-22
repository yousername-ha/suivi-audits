/* Fiche d'une carte de processus : identité (type, parent, pilote, finalité) et rattachements. Chaque rattachement se lit et
   s'écrit à sa source : objectifs (champ `processes` de l'objectif), liens transverses (indicateurs, SWOT, risques,
   fournisseurs). Ce qui vient d'une autre fiche (objectif du processus, champ « processus » d'un SWOT, références d'un
   risque) se détache dans cette fiche d'origine. */
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  LIBELLES_RATTACHEMENT,
  NATURES_RATTACHEMENT,
  RELATION_RATTACHEMENT,
  type CarteProcessus,
  type NatureRattachement,
  type ProcessusCartes,
  type TypeProcessusDto,
} from '@suivi/shared';
import { api, errorMessage } from '../api';
import { ErrorAlert } from '../components/common';
import { CARTES_PROCESSUS_KEY } from './CartesProcessus';
import { optionsTypesProcessus } from './types';

const VIA: Record<'fiche' | 'objectif', string> = {
  fiche: 'Rattaché depuis la fiche d’origine : modifiez-la pour le détacher.',
  objectif: 'Indicateur d’un objectif du processus : il se détache avec l’objectif.',
};
const AIDE: Record<NatureRattachement, string> = {
  objectifs: 'Objectifs que ce processus contribue à atteindre.',
  indicateurs: 'Indicateurs de performance du processus (ceux de ses objectifs s’ajoutent seuls).',
  swots: 'Analyses SWOT du processus.',
  risques: 'Risques qui concernent ce processus.',
  fournisseurs: 'Fournisseurs dont dépend ce processus.',
};

function useActualiser(smsi: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: CARTES_PROCESSUS_KEY(smsi) }),
      qc.invalidateQueries({ queryKey: ['grc', smsi, 'legacy-objectifs'] }),
      qc.invalidateQueries({ queryKey: ['types-processus'] }),
    ]);
}

function Rattachements({
  smsi,
  carte,
  donnees,
  modifiable,
}: {
  smsi: string;
  carte: CarteProcessus;
  donnees: ProcessusCartes;
  modifiable: boolean;
}) {
  const actualiser = useActualiser(smsi);
  const [envoi, setEnvoi] = useState(false);
  const [choix, setChoix] = useState<Partial<Record<NatureRattachement, string | null>>>({});
  const agir = async (fn: () => Promise<unknown>, message: string) => {
    setEnvoi(true);
    try {
      await fn();
      notifications.show({ message, color: 'green' });
      await actualiser();
    } catch (e) {
      notifications.show({ message: errorMessage(e), color: 'red' });
    } finally {
      setEnvoi(false);
    }
  };
  /** Processus d'un objectif, lus sur les cartes : l'écriture remplace la liste complète de l'objectif. */
  const processusDeLObjectif = (objectifId: string) =>
    donnees.processus.filter((p) => p.rattaches.objectifs?.some((o) => o.id === objectifId)).map((p) => p.id);
  const ecrireObjectif = (objectifId: string, ids: string[]) =>
    api('PATCH', `/api/grc/${smsi}/pilotage/objectifs/objectives/${objectifId}`, { body: { processes: ids } });

  const rattacher = (nature: NatureRattachement, ref: string) => {
    if (nature === 'objectifs') {
      const id = ref.split(':')[2]!;
      return agir(
        () => ecrireObjectif(id, [...new Set([...processusDeLObjectif(id), carte.id])]),
        'Objectif rattaché.',
      );
    }
    return agir(
      () =>
        api('POST', `/api/grc/${smsi}/links`, {
          body: { source: ref, target: carte.ref, type: RELATION_RATTACHEMENT[nature], note: '' },
        }),
      'Élément rattaché.',
    );
  };
  const detacher = (nature: NatureRattachement, r: { id: string; via: string; lienId: string | null }) => {
    if (nature === 'objectifs')
      return agir(
        () =>
          ecrireObjectif(
            r.id,
            processusDeLObjectif(r.id).filter((p) => p !== carte.id),
          ),
        'Objectif détaché.',
      );
    return agir(() => api('DELETE', `/api/grc/${smsi}/links/${r.lienId}`), 'Élément détaché.');
  };

  return (
    <Stack gap="md">
      {NATURES_RATTACHEMENT.map((nature) => {
        const liste = carte.rattaches[nature];
        const candidats = donnees.candidats[nature];
        if (liste === null || candidats === null)
          return (
            <Text key={nature} size="sm" c="dimmed">
              {LIBELLES_RATTACHEMENT[nature]} : vous n’avez pas le droit de consulter ce module.
            </Text>
          );
        const deja = new Set(liste.map((x) => x.ref));
        const proposes = candidats.filter((c) => !deja.has(c.ref));
        return (
          <Stack key={nature} gap="xs" aria-label={LIBELLES_RATTACHEMENT[nature]} role="group">
            <Group gap="xs">
              <Title order={3} size="h5">
                {LIBELLES_RATTACHEMENT[nature]}
              </Title>
              <Badge variant="light" color="gray">
                {liste.length}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {AIDE[nature]}
            </Text>
            {liste.length === 0 && (
              <Text size="sm" c="dimmed">
                Aucun rattachement.
              </Text>
            )}
            <Group gap="xs">
              {liste.map((r) => {
                const detachable = nature === 'objectifs' ? true : r.via === 'lien';
                return (
                  <Badge
                    key={r.ref}
                    size="lg"
                    variant="light"
                    className="rattache"
                    title={r.via === 'lien' || nature === 'objectifs' ? undefined : VIA[r.via as 'fiche' | 'objectif']}
                    rightSection={
                      modifiable && detachable ? (
                        <ActionIcon
                          size="xs"
                          variant="transparent"
                          aria-label={`Détacher ${r.name}`}
                          disabled={envoi}
                          onClick={() => void detacher(nature, r)}
                        >
                          ×
                        </ActionIcon>
                      ) : undefined
                    }
                  >
                    {r.name}
                  </Badge>
                );
              })}
            </Group>
            {modifiable && (
              <Group align="flex-end">
                <Select
                  aria-label={`Rattacher : ${LIBELLES_RATTACHEMENT[nature]}`}
                  placeholder={proposes.length ? 'Rattacher…' : 'Rien d’autre à rattacher'}
                  searchable
                  disabled={!proposes.length || envoi}
                  data={proposes.map((c) => ({ value: c.ref, label: c.name }))}
                  value={choix[nature] ?? null}
                  onChange={(v) => {
                    setChoix((c) => ({ ...c, [nature]: null }));
                    if (v) void rattacher(nature, v);
                  }}
                />
              </Group>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}

export function FicheCarteProcessus({
  smsi,
  carte,
  donnees,
  modifiable,
  onClose,
}: {
  smsi: string;
  carte: CarteProcessus;
  donnees: ProcessusCartes;
  modifiable: boolean;
  onClose: () => void;
}) {
  const actualiser = useActualiser(smsi);
  const [v, setV] = useState({
    name: carte.name,
    owner: carte.owner,
    family: carte.family,
    parent: carte.parent,
    purpose: carte.purpose,
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const modifie =
    v.name !== carte.name ||
    v.owner !== carte.owner ||
    v.family !== carte.family ||
    v.parent !== carte.parent ||
    v.purpose !== carte.purpose;
  const parents = donnees.processus.filter((p) => p.id !== carte.id && p.parent !== carte.id);
  const enregistrer = async () => {
    setEnvoi(true);
    try {
      setErreur(null);
      await api('PATCH', `/api/grc/${smsi}/pilotage/objectifs/processes/${carte.id}`, { body: v });
      notifications.show({ message: 'Processus enregistré.', color: 'green' });
      await actualiser();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Modal
      opened
      onClose={onClose}
      size="xl"
      centered
      classNames={{ content: 'fenetre-admin' }}
      title={`${carte.id} · ${carte.name}`}
    >
      <Stack gap="lg">
        <ErrorAlert error={erreur} />
        <Group grow align="flex-start">
          <TextInput
            label="Nom du processus"
            disabled={!modifiable}
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.currentTarget.value })}
          />
          <TextInput
            label="Pilote"
            disabled={!modifiable}
            value={v.owner}
            onChange={(e) => setV({ ...v, owner: e.currentTarget.value })}
          />
        </Group>
        <Group grow align="flex-start">
          <Select
            label="Type de processus"
            clearable
            disabled={!modifiable}
            data={optionsTypesProcessus(donnees.types as TypeProcessusDto[], carte.family)}
            value={v.family || null}
            onChange={(f) => setV({ ...v, family: f ?? '' })}
          />
          <Select
            label="Processus parent"
            clearable
            searchable
            disabled={!modifiable}
            placeholder="Aucun (processus de premier niveau)"
            data={parents.map((p) => ({ value: p.id, label: `${p.id} · ${p.name}` }))}
            value={v.parent || null}
            onChange={(p) => setV({ ...v, parent: p ?? '' })}
          />
        </Group>
        <Textarea
          label="Finalité"
          autosize
          minRows={2}
          disabled={!modifiable}
          value={v.purpose}
          onChange={(e) => setV({ ...v, purpose: e.currentTarget.value })}
        />
        {modifiable && (
          <Group justify="flex-end">
            <Button loading={envoi} disabled={!modifie || !v.name.trim()} onClick={() => void enregistrer()}>
              Enregistrer
            </Button>
          </Group>
        )}
        <Rattachements smsi={smsi} carte={carte} donnees={donnees} modifiable={modifiable} />
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Fiche détaillée (ISO 9001, 4.4.1), objectifs et indicateurs : page « Objectifs par processus ».
          </Text>
          <Button component={Link} to="/pilotage/processus" variant="default" size="compact-sm">
            Ouvrir les objectifs par processus
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function NouveauProcessus({
  smsi,
  types,
  processus,
  onClose,
  onCree,
}: {
  smsi: string;
  types: TypeProcessusDto[];
  processus: CarteProcessus[];
  onClose: () => void;
  onCree: (id: string) => void;
}) {
  const actualiser = useActualiser(smsi);
  const premier = types.find((t) => !t.archived)?.code ?? '';
  const [v, setV] = useState({ name: '', owner: '', family: premier, parent: '' });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const creer = async () => {
    setEnvoi(true);
    try {
      setErreur(null);
      const corps = { name: v.name, owner: v.owner, family: v.family, ...(v.parent ? { parent: v.parent } : {}) };
      const r = await api<{ id: string }>('POST', `/api/grc/${smsi}/pilotage/objectifs/processes`, { body: corps });
      notifications.show({ message: 'Processus créé.', color: 'green' });
      await actualiser();
      onCree(r.id);
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Modal opened onClose={onClose} centered title="Nouveau processus" classNames={{ content: 'fenetre-admin' }}>
      <Stack>
        <ErrorAlert error={erreur} />
        <TextInput
          label="Nom du processus"
          required
          data-autofocus
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.currentTarget.value })}
        />
        <Select
          label="Type de processus"
          allowDeselect={false}
          data={types.filter((t) => !t.archived).map((t) => ({ value: t.code, label: t.label }))}
          value={v.family}
          onChange={(f) => setV({ ...v, family: f ?? '' })}
        />
        <Select
          label="Processus parent (pour un sous-processus)"
          clearable
          searchable
          data={processus.map((p) => ({ value: p.id, label: `${p.id} · ${p.name}` }))}
          value={v.parent || null}
          onChange={(p) => setV({ ...v, parent: p ?? '' })}
        />
        <TextInput label="Pilote" value={v.owner} onChange={(e) => setV({ ...v, owner: e.currentTarget.value })} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={envoi} disabled={!v.name.trim()} onClick={() => void creer()}>
            Créer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

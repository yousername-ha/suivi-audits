/* Page « Périmètres » (ADR 0030, lot M1) : créer et modifier les périmètres de management et gérer les accès des
   périmètres restreints. Création et modification : droit `pilotage:administrer`, comme l'exige l'API. Un périmètre est
   une organisation ou un fournisseur (amendement de l'ADR 0039) ; un fournisseur se relie à sa fiche du registre et n'a
   pour enfants que des fournisseurs. La nature (SMSI, SMQ…) n'est plus proposée : elle n'a pas de sens pour un périmètre. */
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  Radio,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  LIBELLES_TYPE_PERIMETRE,
  TYPES_PERIMETRE,
  parentPermis,
  aplatir,
  arbre,
  descendants,
  type SyntheseCartes,
  type TypePerimetre,
} from '@suivi/shared';
import { DataTable, StatusChip } from '@suivi/ui';
import { api, ApiError, get } from '../api';
import { ErrorAlert } from '../components/common';
import { CartesPerimetres, type FournisseurRattache } from './CartesPerimetres';
import { useCan } from '../session';
import { ReferentielsDuPerimetre } from './Bibliotheque';
import { Members } from './Members';

interface Perimetre {
  id: string;
  name: string;
  scope: string;
  parentId: string | null;
  entityKind: TypePerimetre;
  supplierId: string | null;
  inheritFrameworks: boolean;
  visibility: 'instance' | 'restricted';
  timezone: string;
  version: number;
}
interface Formulaire {
  name: string;
  scope: string;
  timezone: string;
  parentId: string | null;
  entityKind: TypePerimetre;
  supplierId: string | null;
  inheritFrameworks: boolean;
}
const VIDE: Formulaire = {
  name: '',
  scope: '',
  timezone: 'Europe/Paris',
  parentId: null,
  entityKind: 'organisation',
  supplierId: null,
  inheritFrameworks: false,
};

export function Perimetres({ affiche, onChoisir }: { affiche: string; onChoisir: (id: string) => void }) {
  const can = useCan(),
    qc = useQueryClient(),
    admin = can('pilotage', 'administrer'),
    [formulaire, setFormulaire] = useState<{ edition: Perimetre | null; valeurs: Formulaire } | null>(null),
    [acces, setAcces] = useState<Perimetre | null>(null),
    [referentiels, setReferentiels] = useState<Perimetre | null>(null),
    // Le graphe est la vue par défaut (demande du RSSI du 02/11/2026) ; la liste reste à un clic.
    [vue, setVue] = useState<'liste' | 'graphe'>('graphe'),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false);
  const liste = useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () => get<Perimetre[]>('/api/grc/smsis'),
  });
  // Les compteurs du graphe ne sont demandés que lorsqu'on l'affiche.
  const cartes = useQuery({
    queryKey: ['grc', 'perimetres', 'synthese'],
    queryFn: () => get<SyntheseCartes>('/api/grc/perimetres/synthese'),
    enabled: vue === 'graphe',
  });
  const fournisseurs = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => get<FournisseurRattache[]>('/api/suppliers'),
    enabled: can('fournisseurs', 'lire'),
  });
  const fiche = (id: string | null) => (id ? fournisseurs.data?.find((f) => f.id === id) : undefined);
  const ouvrir = (p: Perimetre | null, parentId: string | null = null) => {
    setErreur(null);
    setFormulaire({
      edition: p,
      valeurs: p
        ? {
            name: p.name,
            scope: p.scope,
            timezone: p.timezone,
            parentId: p.parentId,
            entityKind: p.entityKind,
            supplierId: p.supplierId,
            inheritFrameworks: p.inheritFrameworks,
          }
        : {
            ...VIDE,
            parentId,
            // Sous un fournisseur, seul un fournisseur (sous-traitant) peut être créé.
            entityKind: (liste.data ?? []).find((x) => x.id === parentId)?.entityKind ?? 'organisation',
          },
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
      await qc.invalidateQueries({ queryKey: ['grc', 'perimetres'] });
      setFormulaire(null);
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  /** Après un 412 : reprend la version enregistrée par l'autre session, en gardant la saisie en cours. */
  const recharger = async () => {
    const edition = formulaire?.edition;
    if (!edition) return;
    const frais = (
      await qc.fetchQuery({
        queryKey: ['grc', 'smsis'],
        queryFn: () => get<Perimetre[]>('/api/grc/smsis'),
        staleTime: 0,
      })
    ).find((x) => x.id === edition.id);
    if (!frais) return setFormulaire(null);
    setErreur(null);
    setFormulaire((f) => (f ? { ...f, edition: frais } : f));
  };
  const champ =
    <K extends keyof Formulaire>(k: K) =>
    (v: Formulaire[K]) =>
      setFormulaire((f) => (f ? { ...f, valeurs: { ...f.valeurs, [k]: v } } : f));
  const lignes = aplatir(arbre(liste.data ?? []));
  const noeuds = (liste.data ?? []).map((p) => ({
    id: p.id,
    parentId: p.parentId,
    inheritFrameworks: p.inheritFrameworks,
  }));
  // Parents proposés : tout périmètre accessible, sauf lui-même et ses descendants (une boucle est refusée par l'API).
  const interdits = formulaire?.edition
    ? new Set([formulaire.edition.id, ...descendants(noeuds, formulaire.edition.id)])
    : new Set<string>();
  const nomParent = (id: string | null) => (liste.data ?? []).find((p) => p.id === id)?.name;
  const typeDe = (id: string | null) => (liste.data ?? []).find((p) => p.id === id)?.entityKind;
  // Un périmètre qui a des organisations enfants ne peut pas devenir un fournisseur.
  const aOrganisationsEnfants =
    !!formulaire?.edition &&
    (liste.data ?? []).some((p) => p.parentId === formulaire.edition!.id && p.entityKind === 'organisation');
  // Fiches déjà reliées à un autre périmètre accessible (l'API refuse aussi celles des périmètres non accessibles).
  const fichesPrises = new Set(
    (liste.data ?? [])
      .filter((p) => p.supplierId && p.id !== formulaire?.edition?.id)
      .map((p) => p.supplierId as string),
  );
  const changerType = (t: TypePerimetre) =>
    setFormulaire((f) => {
      if (!f) return f;
      const parentType = typeDe(f.valeurs.parentId);
      const garderParent = !parentType || parentPermis(t, parentType);
      return {
        ...f,
        valeurs: {
          ...f.valeurs,
          entityKind: t,
          supplierId: t === 'fournisseur' ? f.valeurs.supplierId : null,
          parentId: garderParent ? f.valeurs.parentId : null,
          inheritFrameworks: garderParent ? f.valeurs.inheritFrameworks : false,
        },
      };
    });
  return (
    <Stack>
      <Alert>
        Un périmètre est une organisation ou un fournisseur. Une organisation peut avoir pour enfants des organisations
        et des fournisseurs ; un fournisseur, seulement des fournisseurs (ses sous-traitants). Méthode de risque,
        politique métier et référentiels se gèrent dans les rubriques du Pilotage, pour le périmètre affiché.
      </Alert>
      <ErrorAlert error={liste.error} />
      <Group justify="space-between">
        <Text>
          {liste.data ? `${liste.data.length} périmètre(s) accessible(s)` : 'Chargement des périmètres…'}
          {!admin && ' · Création et modification réservées au rôle de Pilotage.'}
        </Text>
        <Group>
          <SegmentedControl
            aria-label="Présentation des périmètres"
            value={vue}
            onChange={(v) => setVue(v as 'liste' | 'graphe')}
            data={[
              { value: 'liste', label: 'Liste' },
              { value: 'graphe', label: 'Graphe' },
            ]}
          />
          {admin && <Button onClick={() => ouvrir(null)}>Créer un périmètre</Button>}
        </Group>
      </Group>
      {vue === 'graphe' && (
        <>
          <ErrorAlert error={cartes.error} />
          {(cartes.isLoading || cartes.data) && (
            <CartesPerimetres
              chargement={cartes.isLoading}
              fournisseurs={can('fournisseurs', 'lire') ? fournisseurs.data : undefined}
              onModifier={
                admin
                  ? (id) => {
                      const p = (liste.data ?? []).find((x) => x.id === id);
                      if (p) ouvrir(p);
                    }
                  : undefined
              }
              cartes={cartes.data?.cartes ?? []}
              total={cartes.data?.total}
              affiche={affiche}
              onChoisir={onChoisir}
              onCreerEnfant={admin ? (parentId) => ouvrir(null, parentId) : undefined}
            />
          )}
        </>
      )}
      {vue === 'liste' && (
        <DataTable label="Périmètres de management, défilement horizontal possible">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nom</Table.Th>
                <Table.Th>Périmètre</Table.Th>
                <Table.Th>Accès</Table.Th>
                <Table.Th>Fuseau</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lignes.map(({ item: p, profondeur }) => (
                <Table.Tr key={p.id}>
                  <Table.Td className={`hier-n${Math.min(profondeur, 8)}`}>
                    <Text fw={600}>{p.name}</Text>
                    <Text size="xs">
                      {LIBELLES_TYPE_PERIMETRE[p.entityKind] ?? p.entityKind}
                      {p.parentId && nomParent(p.parentId)
                        ? ` · ${p.entityKind === 'fournisseur' ? 'rattaché' : 'rattachée'} à ${nomParent(p.parentId)}`
                        : ''}
                      {p.inheritFrameworks ? ' · hérite des référentiels du parent' : ''}
                      {fiche(p.supplierId) ? ` · fiche ${fiche(p.supplierId)!.name}` : ''}
                    </Text>
                    {fiche(p.supplierId)?.critical === 'Oui' && (
                      <StatusChip etat="erreur">Fournisseur critique</StatusChip>
                    )}
                    {p.id === affiche && <StatusChip etat="info">Affiché dans le Pilotage</StatusChip>}
                  </Table.Td>
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
      )}
      <Modal
        centered
        size="lg"
        opened={!!formulaire}
        onClose={() => setFormulaire(null)}
        title={formulaire?.edition ? 'Modifier le périmètre' : 'Créer un périmètre'}
      >
        {formulaire && (
          <Stack>
            <ErrorAlert error={erreur} />
            {erreur instanceof ApiError && erreur.status === 412 && formulaire.edition && (
              <Button variant="light" onClick={recharger}>
                Recharger la dernière version
              </Button>
            )}
            <TextInput
              label="Nom"
              required
              value={formulaire.valeurs.name}
              onChange={(e) => champ('name')(e.currentTarget.value)}
            />
            <Radio.Group
              label="Type"
              description={
                aOrganisationsEnfants
                  ? 'Ce périmètre a des organisations enfants : il reste une organisation.'
                  : 'Une organisation, ou un fournisseur (qui n’a pour enfants que des fournisseurs).'
              }
              value={formulaire.valeurs.entityKind}
              onChange={(v) => changerType(v as TypePerimetre)}
            >
              <Group gap="lg" mt="xs">
                {TYPES_PERIMETRE.map((t) => (
                  <Radio
                    key={t}
                    value={t}
                    label={LIBELLES_TYPE_PERIMETRE[t]}
                    disabled={t === 'fournisseur' && aOrganisationsEnfants}
                  />
                ))}
              </Group>
            </Radio.Group>
            {formulaire.valeurs.entityKind === 'fournisseur' && can('fournisseurs', 'lire') && (
              <Select
                label="Fiche du registre des fournisseurs"
                description={
                  fiche(formulaire.valeurs.supplierId)?.critical === 'Oui'
                    ? 'Fournisseur critique (case cochée dans sa fiche).'
                    : 'Facultatif. La criticité se coche dans la fiche du fournisseur.'
                }
                clearable
                searchable
                placeholder="Aucune fiche reliée"
                data={(fournisseurs.data ?? [])
                  .filter((f) => !fichesPrises.has(f.id))
                  .map((f) => ({ value: f.id, label: f.name }))}
                value={formulaire.valeurs.supplierId}
                onChange={(v) => champ('supplierId')(v)}
              />
            )}
            <Select
              label="Rattaché à"
              description="Parent dans la hiérarchie ; laisser vide pour une racine."
              clearable
              searchable
              placeholder="Aucun parent"
              data={(liste.data ?? [])
                .filter((p) => !interdits.has(p.id) && parentPermis(formulaire.valeurs.entityKind, p.entityKind))
                .map((p) => ({
                  value: p.id,
                  label: `${p.name} (${LIBELLES_TYPE_PERIMETRE[p.entityKind] ?? p.entityKind})`,
                }))}
              value={formulaire.valeurs.parentId}
              onChange={(v) => {
                champ('parentId')(v);
                if (!v) champ('inheritFrameworks')(false);
              }}
            />
            <Checkbox
              label="Hériter des référentiels du parent"
              description="Les référentiels rattachés au parent s’appliquent aussi ici, sauf s’ils sont désactivés localement."
              disabled={!formulaire.valeurs.parentId}
              checked={formulaire.valeurs.inheritFrameworks}
              onChange={(e) => champ('inheritFrameworks')(e.currentTarget.checked)}
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
        centered
        title={referentiels ? `Référentiels du périmètre ${referentiels.name}` : ''}
      >
        {referentiels && <ReferentielsDuPerimetre smsi={referentiels.id} />}
      </Modal>
      <Modal
        centered
        opened={!!acces}
        onClose={() => setAcces(null)}
        title={acces ? `Accès au périmètre ${acces.name}` : ''}
      >
        {acces && <Members smsi={acces.id} />}
      </Modal>
    </Stack>
  );
}

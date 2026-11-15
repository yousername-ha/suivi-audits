/* Module Vulnérabilités (ADR 0100), lot V1 : écran « Produits surveillés », registre de l'organisation (sans périmètre).
   Liste filtrée par famille, création, modification (If-Match) et suppression. Écran sobre avec les composants de la charte
   (packages/ui) ; le style du poste de commandement viendra au lot V8. Les boutons suivent les droits de la session pour
   l'affichage seulement : le serveur reste seul juge (droits, module actif, doublon, version). */
import { Alert, Badge, Button, Group, Modal, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  CRITICITE_PRODUIT_LIBELLES,
  CRITICITES_PRODUIT,
  FAMILLE_PRODUIT_LIBELLES,
  FAMILLES_PRODUIT,
  type ProduitSurveilleDto,
  type ResponsablesProposables,
} from '@suivi/shared';
import { DataTable, ErrorAlert, Page, PageHeader, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, get } from '../api';
import { useCan } from '../session';
import {
  champsManquants,
  corpsCreation,
  corpsModification,
  ETAT_CRITICITE,
  formulaireDepuis,
  libelleCriticite,
  libelleFamille,
  libelleOrigine,
  libelleResponsable,
  OPTIONS_FILTRE_FAMILLE,
  optionsResponsables,
  TOUTES_FAMILLES,
  urlProduits,
  type FiltreFamille,
  type FormulaireProduit,
} from './produits';

const CLE = ['vulnerabilites', 'produits'] as const;

interface FournisseurCourt {
  id: string;
  name: string;
}

/** Tableau du registre (sans état) : rendu testable hors navigateur. */
export function ProduitsTable({
  produits,
  fournisseurs,
  peutModifier,
  peutSupprimer,
  onModifier,
  onSupprimer,
}: {
  produits: ProduitSurveilleDto[];
  fournisseurs: ReadonlyMap<string, string>;
  peutModifier: boolean;
  peutSupprimer: boolean;
  onModifier: (p: ProduitSurveilleDto) => void;
  onSupprimer: (p: ProduitSurveilleDto) => void;
}) {
  const actions = peutModifier || peutSupprimer;
  return (
    <DataTable label="Produits surveillés">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Produit et éditeur</Table.Th>
            <Table.Th>Version</Table.Th>
            <Table.Th>Famille</Table.Th>
            <Table.Th>Criticité</Table.Th>
            <Table.Th>Responsable</Table.Th>
            <Table.Th>Origine</Table.Th>
            {actions && <Table.Th>Actions</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {produits.map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td>
                <Text fw={600}>{p.nom}</Text>
                <Text size="xs" c="dimmed">
                  {p.editeur}
                  {p.fournisseurId && ` · fournisseur ${fournisseurs.get(p.fournisseurId) ?? p.fournisseurId}`}
                </Text>
                {p.cpe && (
                  <Text size="xs" c="dimmed" className="produit-cpe">
                    {p.cpe}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{p.versionProduit || '—'}</Table.Td>
              <Table.Td>{libelleFamille(p.famille)}</Table.Td>
              <Table.Td>
                <StatusChip etat={ETAT_CRITICITE[p.criticite]}>{libelleCriticite(p.criticite)}</StatusChip>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c={p.responsable ? undefined : 'dimmed'}>
                  {libelleResponsable(p)}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge variant="outline">{libelleOrigine(p)}</Badge>
              </Table.Td>
              {actions && (
                <Table.Td>
                  <Group gap="2xs" wrap="nowrap">
                    {peutModifier && (
                      <Button
                        size="compact-sm"
                        variant="default"
                        onClick={() => onModifier(p)}
                        aria-label={`Modifier ${p.nom}`}
                      >
                        Modifier
                      </Button>
                    )}
                    {peutSupprimer && (
                      <Button
                        size="compact-sm"
                        variant="light"
                        color="red"
                        onClick={() => onSupprimer(p)}
                        aria-label={`Supprimer ${p.nom}`}
                      >
                        Supprimer
                      </Button>
                    )}
                  </Group>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
          {produits.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={actions ? 7 : 6}>
                <Text size="sm" c="dimmed">
                  Aucun produit surveillé. Ajoutez les produits de l’organisation (éditeur, produit, version) : la
                  veille des vulnérabilités s’appuiera sur ce registre.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

export function ProduitsSurveillesPage() {
  const can = useCan();
  const qc = useQueryClient();
  const lire = can('vulnerabilites', 'lire');
  const modifier = can('vulnerabilites', 'modifier');
  const supprimer = can('vulnerabilites', 'supprimer');
  const [filtre, setFiltre] = useState<FiltreFamille>(TOUTES_FAMILLES);
  const [edition, setEdition] = useState<{ produit: ProduitSurveilleDto | null } | null>(null);
  const [aSupprimer, setASupprimer] = useState<ProduitSurveilleDto | null>(null);
  const produits = useQuery({
    queryKey: [...CLE, filtre],
    queryFn: () => get<ProduitSurveilleDto[]>(urlProduits(filtre)),
    enabled: lire,
  });
  // Noms des fournisseurs liés : seulement pour qui lit les fournisseurs (sinon l'identifiant est affiché).
  const fournisseurs = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => get<FournisseurCourt[]>('/api/suppliers'),
    enabled: lire && can('fournisseurs', 'lire'),
  });
  const nomsFournisseurs = new Map((fournisseurs.data ?? []).map((f) => [f.id, f.name]));
  const rafraichir = () => qc.invalidateQueries({ queryKey: CLE });

  if (!lire)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit de lire les vulnérabilités.</Alert>
      </Page>
    );
  return (
    <Page>
      <PageHeader
        title="Produits surveillés"
        description="Registre de l’organisation : les produits dont la plateforme suivra les vulnérabilités publiées, par éditeur, produit et version. Un même produit (même éditeur, même version) n’est inscrit qu’une fois."
        actions={modifier && <Button onClick={() => setEdition({ produit: null })}>Ajouter un produit</Button>}
      />
      <Stack>
        <Group justify="space-between" align="flex-end">
          <Select
            label="Famille"
            data={OPTIONS_FILTRE_FAMILLE}
            value={filtre}
            onChange={(v) => setFiltre((v as FiltreFamille | null) ?? TOUTES_FAMILLES)}
            allowDeselect={false}
          />
          {produits.data && (
            <Text size="sm" c="dimmed" role="status">
              {produits.data.length} produit{produits.data.length > 1 ? 's' : ''}
            </Text>
          )}
        </Group>
        <ErrorAlert error={produits.error} />
        {produits.data && (
          <ProduitsTable
            produits={produits.data}
            fournisseurs={nomsFournisseurs}
            peutModifier={modifier}
            peutSupprimer={supprimer}
            onModifier={(p) => setEdition({ produit: p })}
            onSupprimer={setASupprimer}
          />
        )}
      </Stack>
      <Modal
        opened={!!edition}
        onClose={() => setEdition(null)}
        title={edition?.produit ? `Modifier ${edition.produit.nom}` : 'Ajouter un produit surveillé'}
        size="lg"
        centered
        lockScroll={false}
      >
        {edition && (
          <EditeurProduit
            produit={edition.produit}
            fournisseurs={can('fournisseurs', 'lire') ? (fournisseurs.data ?? []) : null}
            onFait={async () => {
              setEdition(null);
              await rafraichir();
            }}
          />
        )}
      </Modal>
      <Modal
        opened={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        title="Supprimer un produit surveillé"
        centered
        lockScroll={false}
      >
        {aSupprimer && (
          <Stack>
            <Text>
              Supprimer « {aSupprimer.nom} » ({aSupprimer.editeur}
              {aSupprimer.versionProduit ? `, version ${aSupprimer.versionProduit}` : ''}) du registre ? La suppression
              est inscrite au journal d’audit.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setASupprimer(null)}>
                Annuler
              </Button>
              <ConfirmerSuppression
                produit={aSupprimer}
                onFait={async () => {
                  setASupprimer(null);
                  await rafraichir();
                }}
              />
            </Group>
          </Stack>
        )}
      </Modal>
    </Page>
  );
}

function ConfirmerSuppression({ produit, onFait }: { produit: ProduitSurveilleDto; onFait: () => Promise<void> }) {
  const [enCours, setEnCours] = useState(false);
  return (
    <Button
      color="red"
      loading={enCours}
      onClick={async () => {
        setEnCours(true);
        try {
          await api('DELETE', `/api/vulnerabilites/produits/${produit.id}`, { ifMatch: produit.version });
          notifications.show({ color: 'teal', message: 'Produit supprimé.' });
          await onFait();
        } catch (e) {
          notifications.show({ color: 'red', message: errorMessage(e) });
        } finally {
          setEnCours(false);
        }
      }}
    >
      Supprimer
    </Button>
  );
}

function EditeurProduit({
  produit,
  fournisseurs,
  onFait,
}: {
  produit: ProduitSurveilleDto | null;
  /** Fournisseurs lisibles ; null : pas de droit de lecture des fournisseurs (champ non proposé). */
  fournisseurs: FournisseurCourt[] | null;
  onFait: () => Promise<void>;
}) {
  const [f, setF] = useState<FormulaireProduit>(() => formulaireDepuis(produit));
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const annuaire = useQuery({
    queryKey: ['vulnerabilites', 'responsables'],
    queryFn: () => get<ResponsablesProposables>('/api/vulnerabilites/responsables'),
  });
  const manque = champsManquants(f);
  const enregistrer = async () => {
    setErreur(null);
    if (manque.length) {
      setErreur(`À compléter : ${manque.join(', ')}.`);
      return;
    }
    setEnCours(true);
    try {
      if (produit) {
        const patch = corpsModification(produit, f);
        if (Object.keys(patch).length)
          await api('PATCH', `/api/vulnerabilites/produits/${produit.id}`, { body: patch, ifMatch: produit.version });
      } else await api('POST', '/api/vulnerabilites/produits', { body: corpsCreation(f) });
      notifications.show({ color: 'teal', message: produit ? 'Produit modifié.' : 'Produit ajouté.' });
      await onFait();
    } catch (e) {
      setErreur(errorMessage(e));
    } finally {
      setEnCours(false);
    }
  };
  return (
    <Stack>
      {erreur && (
        <Alert color="red" role="alert">
          {erreur}
        </Alert>
      )}
      {fournisseurs ? (
        <Select
          label="Fournisseur (registre de l’organisation)"
          description="Facultatif. Choisir un fournisseur reprend son nom comme éditeur si l’éditeur est vide."
          data={fournisseurs.map((x) => ({ value: x.id, label: x.name }))}
          value={f.fournisseurId}
          onChange={(v) => {
            const nom = fournisseurs.find((x) => x.id === v)?.name;
            setF({ ...f, fournisseurId: v, editeur: f.editeur.trim() || !nom ? f.editeur : nom });
          }}
          searchable
          clearable
        />
      ) : (
        f.fournisseurId && (
          <Text size="sm" c="dimmed">
            Fournisseur lié : {f.fournisseurId} (lien conservé ; le modifier demande le droit de lire les fournisseurs).
          </Text>
        )
      )}
      <TextInput
        label="Éditeur"
        required
        maxLength={200}
        value={f.editeur}
        onChange={(e) => setF({ ...f, editeur: e.currentTarget.value })}
      />
      <TextInput
        label="Nom du produit"
        required
        maxLength={200}
        value={f.nom}
        onChange={(e) => setF({ ...f, nom: e.currentTarget.value })}
      />
      <TextInput
        label="Version"
        description="Facultative. Même éditeur, même produit et même version : une seule fiche."
        maxLength={100}
        value={f.versionProduit}
        onChange={(e) => setF({ ...f, versionProduit: e.currentTarget.value })}
      />
      <TextInput
        label="Identifiant CPE 2.3"
        description="Facultatif, par exemple cpe:2.3:a:editeur:produit:1.0:*:*:*:*:*:*:*"
        maxLength={500}
        value={f.cpe}
        onChange={(e) => setF({ ...f, cpe: e.currentTarget.value })}
      />
      <Group grow align="flex-start">
        <Select
          label="Famille"
          required
          data={FAMILLES_PRODUIT.map((x) => ({ value: x, label: FAMILLE_PRODUIT_LIBELLES[x] }))}
          value={f.famille}
          onChange={(v) => setF({ ...f, famille: v as FormulaireProduit['famille'] })}
          allowDeselect={false}
        />
        <Select
          label="Criticité"
          required
          data={CRITICITES_PRODUIT.map((x) => ({ value: x, label: CRITICITE_PRODUIT_LIBELLES[x] }))}
          value={f.criticite}
          onChange={(v) => setF({ ...f, criticite: v as FormulaireProduit['criticite'] })}
          allowDeselect={false}
        />
      </Group>
      <Select
        label="Responsable"
        description="Facultatif : une personne, un groupe ou une fonction de l’organisation."
        data={optionsResponsables(annuaire.data)}
        value={f.responsable}
        onChange={(v) => setF({ ...f, responsable: v })}
        searchable
        clearable
        nothingFoundMessage="Aucun responsable"
      />
      <ErrorAlert error={annuaire.error} />
      <Group justify="flex-end">
        <Button onClick={() => void enregistrer()} loading={enCours}>
          {produit ? 'Enregistrer' : 'Ajouter'}
        </Button>
      </Group>
    </Stack>
  );
}

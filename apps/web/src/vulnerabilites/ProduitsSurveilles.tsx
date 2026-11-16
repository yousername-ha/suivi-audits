/* Module Vulnérabilités (ADR 0100), lot V1 : écran « Produits surveillés », registre de l'organisation (sans périmètre).
   Liste filtrée par famille, création, modification (If-Match) et suppression. Écran sobre avec les composants de la charte
   (packages/ui) ; le style du poste de commandement viendra au lot V8. Les boutons suivent les droits de la session pour
   l'affichage seulement : le serveur reste seul juge (droits, module actif, doublon, version).
   Lot V4a : version obligatoire ; identifiant CPE proposé à partir des couples éditeur et produit déjà connus de la veille
   (aucun appel réseau) ; fiche du produit : machines reliées (recherche de machines, relier, délier), CVE rattachées,
   écartées et propositions à décider (confirmer, rejeter, note), chacune avec sa priorité et ses faits. */
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  CRITICITE_PRODUIT_LIBELLES,
  CRITICITES_PRODUIT,
  FAMILLE_PRODUIT_LIBELLES,
  FAMILLES_PRODUIT,
  type FicheProduitDto,
  type MachineRelieeDto,
  type PageMachines,
  type ProduitSurveilleDto,
  type RapprochementDto,
  type ResponsablesProposables,
  STATUT_RAPPROCHEMENT_LIBELLES,
  type SuggestionCpeDto,
} from '@suivi/shared';
import { DataTable, ErrorAlert, Page, PageHeader, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, get } from '../api';
import { fmtDate } from '../components/common';
import { useCan } from '../session';
import { libelleMachine, libelleRole, urlMachines, FILTRES_MACHINES_VIDES } from './failles';
import { PrioriteFaits } from './FaillesDetectees';
import {
  champsManquants,
  explicationProposition,
  groupesRapprochements,
  libellePlage,
  urlSuggestionsCpe,
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
  onOuvrir,
}: {
  produits: ProduitSurveilleDto[];
  fournisseurs: ReadonlyMap<string, string>;
  peutModifier: boolean;
  peutSupprimer: boolean;
  onModifier: (p: ProduitSurveilleDto) => void;
  onSupprimer: (p: ProduitSurveilleDto) => void;
  /** Ouvre la fiche du produit (rapprochements, machines reliées). */
  onOuvrir?: (p: ProduitSurveilleDto) => void;
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
            <Table.Th>Failles rapprochées</Table.Th>
            <Table.Th>Origine</Table.Th>
            {actions && <Table.Th>Actions</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {produits.map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td>
                {onOuvrir ? (
                  <Anchor component="button" type="button" fw={600} onClick={() => onOuvrir(p)}>
                    {p.nom}
                  </Anchor>
                ) : (
                  <Text fw={600}>{p.nom}</Text>
                )}
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
              <Table.Td>
                {p.versionProduit || '—'}
                <Text size="xs" c="dimmed">
                  fiche mise à jour le <span className="horodatage">{fmtDate(p.updatedAt)}</span>
                </Text>
              </Table.Td>
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
                <Text size="sm">
                  {p.suivi.rattachees} rattachée{p.suivi.rattachees > 1 ? 's' : ''}
                </Text>
                {p.suivi.aDecider > 0 && <StatusChip etat="attention">{p.suivi.aDecider} à décider</StatusChip>}
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
              <Table.Td colSpan={actions ? 8 : 7}>
                <Text size="sm" c="dimmed">
                  Aucun produit surveillé. Ajoutez les produits de l’organisation (éditeur, produit, version) : les
                  failles publiées par la veille sont rapprochées de ce registre par leur version.
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
  const [ouvert, setOuvert] = useState<ProduitSurveilleDto | null>(null);
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
        description="Registre de l’organisation : les produits dont la plateforme suit les vulnérabilités publiées, par éditeur, produit et version. La version déclarée sert au rapprochement avec les failles de la veille : tenez-la à jour. Un même produit (même éditeur, même version) n’est inscrit qu’une fois."
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
            onOuvrir={setOuvert}
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
        opened={!!ouvert}
        onClose={() => setOuvert(null)}
        title={ouvert ? `${ouvert.nom} ${ouvert.versionProduit}` : 'Produit surveillé'}
        size="xl"
        centered
        lockScroll={false}
      >
        {ouvert && <FicheProduit id={ouvert.id} modifier={modifier} onChange={rafraichir} />}
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
        required
        description="Obligatoire : c’est elle qui sert au rapprochement avec les failles publiées (par exemple 10.1.2). Même éditeur, même produit et même version : une seule fiche."
        maxLength={100}
        value={f.versionProduit}
        onChange={(e) => setF({ ...f, versionProduit: e.currentTarget.value })}
      />
      <TextInput
        label="Identifiant CPE 2.3"
        description="Facultatif. Son éditeur et son produit permettent le rapprochement exact (sinon : par nom, toujours à confirmer) ; sa version n’est pas lue, seule compte la version déclarée."
        maxLength={500}
        value={f.cpe}
        onChange={(e) => setF({ ...f, cpe: e.currentTarget.value })}
      />
      <SuggestionCpe formulaire={f} onChoisir={(cpe) => setF({ ...f, cpe })} />
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

/** Couples éditeur et produit déjà connus de la veille qui ressemblent au nom saisi : la personne choisit (aucun appel
    réseau, recherche dans les données rangées). */
function SuggestionCpe({ formulaire, onChoisir }: { formulaire: FormulaireProduit; onChoisir: (cpe: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const suggestions = useQuery({
    queryKey: ['vulnerabilites', 'identites-cpe', url],
    queryFn: () => get<SuggestionCpeDto[]>(url!),
    enabled: !!url,
  });
  const cible = urlSuggestionsCpe(formulaire);
  return (
    <Stack gap="2xs">
      <Group>
        <Button variant="default" size="compact-sm" disabled={!cible} onClick={() => setUrl(cible)}>
          Chercher un identifiant dans la veille
        </Button>
      </Group>
      <ErrorAlert error={suggestions.error} />
      {suggestions.data &&
        (suggestions.data.length ? (
          <Select
            label="Identifiants connus de la veille"
            placeholder="Choisir un couple éditeur et produit"
            allowDeselect={false}
            data={suggestions.data.map((x) => ({
              value: x.cpe,
              label: `${x.editeur} : ${x.produit} (${x.cves} CVE)`,
            }))}
            onChange={(v) => v && onChoisir(v)}
            comboboxProps={{ withinPortal: false }}
          />
        ) : (
          <Text size="sm" c="dimmed">
            Aucun couple éditeur et produit de la veille ne ressemble à ce nom.
          </Text>
        ))}
    </Stack>
  );
}

/** Rapprochements d'un produit, regroupés par statut (sans état) ; décisions offertes sur les propositions. */
export function RapprochementsProduit({
  rapprochements,
  peutDecider,
  onDecider,
}: {
  rapprochements: RapprochementDto[];
  peutDecider: boolean;
  onDecider: (r: RapprochementDto) => void;
}) {
  const groupes = groupesRapprochements(rapprochements);
  if (!groupes.length)
    return (
      <Text size="sm" c="dimmed">
        Aucune faille de la veille ne correspond à ce produit pour l’instant.
      </Text>
    );
  return (
    <Stack>
      {groupes.map((g) => (
        <Stack key={g.titre} gap="2xs" role="group" aria-label={g.titre}>
          <Title order={3} size="h6">
            {g.titre} ({g.rapprochements.length})
          </Title>
          <DataTable label={g.titre}>
            <Table>
              <Table.Tbody>
                {g.rapprochements.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td>
                      <PrioriteFaits p={r.priorite} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" className="veille-code">
                        {r.cve}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {STATUT_RAPPROCHEMENT_LIBELLES[r.statut]}
                        {r.parIdentifiant ? ' · par identifiant CPE' : ' · par nom'}
                      </Text>
                      {r.statut === 'proposee' && <Text size="xs">{explicationProposition(r)}</Text>}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{r.plages.map(libellePlage).join(' ; ') || 'Aucune plage publiée'}</Text>
                      {r.tronque && (
                        <Text size="xs" c="orange">
                          La veille n’a pas pu garder tous les produits touchés de cette CVE.
                        </Text>
                      )}
                      {r.description && (
                        <Text size="xs" c="dimmed" className="veille-texte" lang="en">
                          {r.description}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {r.decidePar && (
                        <Text size="xs">
                          {r.statut === 'confirmee' ? 'Confirmée' : 'Rejetée'} par {r.decidePar}
                          {r.decideLe && (
                            <>
                              {' '}
                              le <span className="horodatage">{fmtDate(r.decideLe)}</span>
                            </>
                          )}
                          {r.versionDecidee ? ` (version ${r.versionDecidee})` : ''}
                          {r.note ? ` : ${r.note}` : ''}
                        </Text>
                      )}
                      {peutDecider && r.statut === 'proposee' && (
                        <Button size="compact-sm" variant="default" onClick={() => onDecider(r)}>
                          Décider {r.cve}
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </DataTable>
        </Stack>
      ))}
    </Stack>
  );
}

/** Machines reliées lisibles (sans état). */
export function MachinesReliees({
  machines,
  peutModifier,
  onDelier,
}: {
  machines: MachineRelieeDto[];
  peutModifier: boolean;
  onDelier: (m: MachineRelieeDto) => void;
}) {
  if (!machines.length)
    return (
      <Text size="sm" c="dimmed">
        Aucune machine reliée que vous puissiez lire.
      </Text>
    );
  return (
    <DataTable label="Machines reliées">
      <Table>
        <Table.Tbody>
          {machines.map((m) => (
            <Table.Tr key={m.id}>
              <Table.Td>
                <Text size="sm">{libelleMachine(m)}</Text>
                <Text size="xs" c="dimmed">
                  {libelleRole(m.role)} · {m.perimetreNom ?? 'Sans périmètre'}
                </Text>
              </Table.Td>
              <Table.Td>
                <StatusChip etat="attention">Déclaré</StatusChip>
              </Table.Td>
              {peutModifier && (
                <Table.Td>
                  <Button
                    size="compact-sm"
                    variant="light"
                    color="red"
                    onClick={() => onDelier(m)}
                    aria-label={`Délier ${libelleMachine(m)}`}
                  >
                    Délier
                  </Button>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Fiche d'un produit : machines reliées (relier par recherche, délier), rapprochements et décisions. */
function FicheProduit({ id, modifier, onChange }: { id: string; modifier: boolean; onChange: () => Promise<unknown> }) {
  const qc = useQueryClient();
  const cle = ['vulnerabilites', 'produits', 'fiche', id];
  const fiche = useQuery({
    queryKey: cle,
    queryFn: () => get<FicheProduitDto>(`/api/vulnerabilites/produits/${id}/fiche`),
  });
  const [saisie, setSaisie] = useState('');
  const [recherche, setRecherche] = useState<string | null>(null);
  const [choix, setChoix] = useState<string | null>(null);
  const [aDecider, setADecider] = useState<RapprochementDto | null>(null);
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const machines = useQuery({
    queryKey: ['vulnerabilites', 'machines', 'recherche', recherche],
    queryFn: () => get<PageMachines>(urlMachines({ ...FILTRES_MACHINES_VIDES, q: recherche ?? '' })),
    enabled: modifier && recherche !== null,
  });
  const action = async (fn: () => Promise<unknown>, message: string) => {
    setEnvoi(true);
    try {
      await fn();
      notifications.show({ color: 'teal', message });
      setChoix(null);
      setADecider(null);
      setNote('');
      await qc.invalidateQueries({ queryKey: ['vulnerabilites'] });
      await onChange();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      setEnvoi(false);
    }
  };
  const f = fiche.data;
  const relies = new Set((f?.machines ?? []).map((m) => m.id));
  return (
    <Stack>
      <ErrorAlert error={fiche.error ?? machines.error} />
      {f && (
        <>
          <Text size="sm">
            {f.produit.editeur} · version déclarée <strong>{f.produit.versionProduit}</strong>, fiche mise à jour le{' '}
            <span className="horodatage">{fmtDate(f.produit.updatedAt)}</span> : une version périmée fausse le
            rapprochement.
          </Text>
          <Text size="sm" c="dimmed">
            {f.identite
              ? `Rapprochement par identifiant CPE : ${f.identite.editeur} / ${f.identite.produit}.`
              : 'Sans identifiant CPE : rapprochement par nom seulement, toujours à confirmer.'}
          </Text>
          <Title order={2} size="h5">
            Machines reliées
          </Title>
          <MachinesReliees
            machines={f.machines}
            peutModifier={modifier}
            onDelier={(m) =>
              void action(
                () =>
                  api('DELETE', `/api/vulnerabilites/produits/${id}/machines/${m.id}`, { ifMatch: f.produit.version }),
                'Machine déliée du produit.',
              )
            }
          />
          {modifier && (
            <Group align="flex-end">
              <TextInput
                label="Rechercher une machine"
                description="Nom de la machine, parmi celles que vous pouvez lire."
                maxLength={100}
                value={saisie}
                onChange={(e) => setSaisie(e.currentTarget.value)}
              />
              <Button variant="default" onClick={() => setRecherche(saisie.trim())}>
                Rechercher
              </Button>
              <Select
                label="Machine à relier"
                placeholder="Choisir une machine"
                clearable
                value={choix}
                onChange={setChoix}
                data={(machines.data?.elements ?? [])
                  .filter((m) => !relies.has(m.id))
                  .map((m) => ({ value: m.id, label: libelleMachine(m) }))}
                nothingFoundMessage="Aucune machine"
                comboboxProps={{ withinPortal: false }}
              />
              <Button
                loading={envoi}
                disabled={!choix}
                onClick={() =>
                  void action(
                    () =>
                      api('POST', `/api/vulnerabilites/produits/${id}/machines`, {
                        body: { machineId: choix },
                        ifMatch: f.produit.version,
                      }),
                    'Machine reliée au produit.',
                  )
                }
              >
                Relier
              </Button>
            </Group>
          )}
          <Title order={2} size="h5">
            Failles de la veille rapprochées
          </Title>
          <Text size="sm" c="dimmed">
            {f.compteurs.proposee} à décider · {f.compteurs.rattachee} rattachée{f.compteurs.rattachee > 1 ? 's' : ''}{' '}
            d’office · {f.compteurs.confirmee} confirmée{f.compteurs.confirmee > 1 ? 's' : ''} · {f.compteurs.ecartee}{' '}
            écartée{f.compteurs.ecartee > 1 ? 's' : ''} · {f.compteurs.rejetee} rejetée
            {f.compteurs.rejetee > 1 ? 's' : ''}
          </Text>
          <RapprochementsProduit
            rapprochements={f.rapprochements}
            peutDecider={modifier}
            onDecider={(r) => {
              setADecider(r);
              setNote('');
            }}
          />
          {aDecider && (
            <Stack gap="xs" role="group" aria-label={`Décision sur ${aDecider.cve}`}>
              <Text size="sm">
                {aDecider.cve} : {explicationProposition(aDecider)}.
              </Text>
              <Textarea
                label="Note (facultative)"
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
              />
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setADecider(null)}>
                  Annuler
                </Button>
                {(['rejeter', 'confirmer'] as const).map((decision) => (
                  <Button
                    key={decision}
                    loading={envoi}
                    color={decision === 'rejeter' ? 'red' : undefined}
                    onClick={() =>
                      void action(
                        () =>
                          api('POST', `/api/vulnerabilites/rapprochements/${aDecider.id}/decision`, {
                            body: { decision, note },
                            ifMatch: aDecider.version,
                          }),
                        decision === 'confirmer' ? 'Rapprochement confirmé.' : 'Rapprochement rejeté.',
                      )
                    }
                  >
                    {decision === 'confirmer' ? 'Confirmer' : 'Rejeter'}
                  </Button>
                ))}
              </Group>
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}

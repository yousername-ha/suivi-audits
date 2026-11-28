/* Module Vulnérabilités (ADR 0100, lot GRP-MACHINES ; décision du RSSI du 23/11/2026, maquettes validées le même jour) :
   groupes de machines dans l'écran « Machines ».
   - MentionFournisseurGroupe : sous la barre de filtres, quand un groupe est filtré, « maintenu par <fournisseur> » (lien
     vers les fournisseurs pour qui les lit, nom seul sinon) ou « fournisseur supprimé », sans lien.
   - FenetreGroupes : fenêtre « Groupes de machines… » (droit de modifier les machines) : liste des groupes, création, puis
     la fenêtre d'un groupe : nom, description, fournisseur facultatif (menu masqué sans le droit de lire les fournisseurs,
     nom du fournisseur rattaché toujours affiché), machines lues à cocher, avec une recherche (nom, adresse IP), « Tout
     cocher (n trouvées) » et la mention « aussi dans « X » » ; enregistrement par lots bornés, If-Match sur la version du
     groupe ; suppression avec confirmation.
   Le serveur reste seul juge : machines lues, droits, version. Composants de la charte, CSP stricte (ADR 0006), aucun style
   nouveau. */
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Group,
  Modal,
  Pagination,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  GROUPES_MACHINES_BORNES,
  type BilanMembresGroupe,
  type GroupeMachines,
  type PageMachinesGroupe,
  refFournisseur,
} from '@suivi/shared';
import { ConfirmButton, DataTable, ErrorAlert } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, get } from '../api';
import { useCan } from '../session';
import { libelleMachine } from './failles';
import {
  aDesChangements,
  AUCUN_CHANGEMENT,
  basculer,
  type ChangementsMembres,
  CLE_GROUPES,
  estCochee,
  libelleToutCocher,
  lotsMembres,
  mentionAutresGroupes,
  mentionFournisseur,
  nombreMachines,
  toutCocher,
  URL_GROUPES,
  urlGroupe,
  urlMachinesGroupe,
} from './groupes';
import { NOMS_PAGINATION } from './pagination';
import { nombrePages } from './veille-presentation';

const CLE_MACHINES = ['vulnerabilites', 'machines'] as const;

/** « maintenu par <fournisseur> » sous la barre de filtres, quand un groupe est filtré. */
export function MentionFournisseurGroupe({
  groupe,
  lireFournisseurs,
}: {
  groupe: GroupeMachines;
  lireFournisseurs: boolean;
}) {
  const m = mentionFournisseur(groupe.fournisseur, lireFournisseurs);
  return (
    <Text size="sm" c="dimmed" role="note">
      Groupe « {groupe.nom} » : {nombreMachines(groupe.machinesLues)}
      {groupe.horsLecture ? ', et d’autres hors de votre lecture' : ''}
      {m && (
        <>
          {' · '}
          {m.texte}
          {m.nom && ' '}
          {m.nom && m.lien ? (
            <Anchor component={Link} to={m.lien} size="sm">
              {m.nom}
            </Anchor>
          ) : (
            m.nom
          )}
        </>
      )}
    </Text>
  );
}

interface FournisseurLu {
  id: string;
  name: string;
}

/** Menu du fournisseur (au plus un) : liste du registre ; un fournisseur supprimé reste nommé tel quel. */
function ChoixFournisseur({
  valeur,
  groupe,
  onChange,
}: {
  valeur: string | null;
  groupe: GroupeMachines | null;
  onChange: (ref: string | null) => void;
}) {
  // Même clé et même adresse que l'écran « Fournisseurs » (route du module Fournisseurs, droit fournisseurs:lire).
  const fournisseurs = useQuery({ queryKey: ['suppliers'], queryFn: () => get<FournisseurLu[]>('/api/suppliers') });
  const options = (fournisseurs.data ?? []).map((f) => ({ value: refFournisseur(f.id), label: f.name }));
  const actuel = groupe?.fournisseur;
  if (actuel && valeur === actuel.ref && !options.some((o) => o.value === actuel.ref))
    options.push({ value: actuel.ref, label: actuel.nom ?? 'Fournisseur supprimé' });
  return (
    <>
      <Select
        label="Fournisseur qui maintient ces machines"
        description="Facultatif, un seul fournisseur : celui du registre des fournisseurs."
        placeholder="Aucun"
        clearable
        searchable
        value={valeur}
        onChange={onChange}
        data={options}
        comboboxProps={{ withinPortal: false }}
      />
      <ErrorAlert error={fournisseurs.error} />
    </>
  );
}

/** Nom, description et fournisseur (création ou modification). */
function ChampsGroupe({
  nom,
  description,
  fournisseurRef,
  groupe,
  onChange,
}: {
  nom: string;
  description: string;
  fournisseurRef: string | null;
  groupe: GroupeMachines | null;
  onChange: (p: { nom?: string; description?: string; fournisseurRef?: string | null }) => void;
}) {
  const can = useCan();
  const lireFournisseurs = can('fournisseurs', 'lire');
  return (
    <>
      <TextInput
        label="Nom du groupe"
        required
        maxLength={GROUPES_MACHINES_BORNES.nom}
        description={`Unique, ${GROUPES_MACHINES_BORNES.nom} caractères au plus.`}
        descriptionProps={{ 'data-aide-permanente': true }}
        value={nom}
        onChange={(e) => onChange({ nom: e.currentTarget.value })}
      />
      <Textarea
        label="Description"
        description={`Facultative, ${GROUPES_MACHINES_BORNES.description} caractères au plus.`}
        maxLength={GROUPES_MACHINES_BORNES.description}
        autosize
        minRows={2}
        value={description}
        onChange={(e) => onChange({ description: e.currentTarget.value })}
      />
      {lireFournisseurs ? (
        <ChoixFournisseur valeur={fournisseurRef} groupe={groupe} onChange={(v) => onChange({ fournisseurRef: v })} />
      ) : (
        groupe?.fournisseur && (
          <Text size="sm">
            Fournisseur : {groupe.fournisseur.nom ?? 'fournisseur supprimé'} (le changer demande le droit de lire les
            fournisseurs).
          </Text>
        )
      )}
    </>
  );
}

/** Liste des groupes, dans la fenêtre « Groupes de machines ». */
function ListeGroupes({ onOuvrir, onNouveau }: { onOuvrir: (id: string) => void; onNouveau: () => void }) {
  const groupes = useQuery({
    queryKey: ['vulnerabilites', 'groupes'],
    queryFn: () => get<GroupeMachines[]>('/api/vulnerabilites/groupes'),
  });
  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Une machine peut être dans plusieurs groupes. Vous ne voyez et ne comptez que les machines que vous lisez.
        </Text>
        <Button onClick={onNouveau}>Nouveau groupe</Button>
      </Group>
      <ErrorAlert error={groupes.error} />
      {groupes.data && !groupes.data.length && <Text size="sm">Aucun groupe de machines.</Text>}
      {!!groupes.data?.length && (
        <DataTable label="Groupes de machines">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Groupe</Table.Th>
                <Table.Th>Machines</Table.Th>
                <Table.Th>Fournisseur</Table.Th>
                <Table.Th>
                  <span className="sr-only">Actions</span>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {groupes.data.map((g) => (
                <Table.Tr key={g.id}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {g.nom}
                    </Text>
                    {g.description && (
                      <Text size="xs" c="dimmed">
                        {g.description}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {nombreMachines(g.machinesLues)}
                    {g.horsLecture && (
                      <Text size="xs" c="dimmed">
                        et d’autres hors de votre lecture
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{g.fournisseur ? (g.fournisseur.nom ?? 'fournisseur supprimé') : '—'}</Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="default" onClick={() => onOuvrir(g.id)} aria-label={`Modifier ${g.nom}`}>
                      Modifier
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
    </Stack>
  );
}

/** Création : nom, description, fournisseur ; les machines se choisissent ensuite dans la fenêtre du groupe. */
function NouveauGroupe({ onCree, onAnnuler }: { onCree: (g: GroupeMachines) => void; onAnnuler: () => void }) {
  const qc = useQueryClient();
  const [champs, setChamps] = useState({ nom: '', description: '', fournisseurRef: null as string | null });
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const creer = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const g = await api<GroupeMachines>('POST', URL_GROUPES, { body: champs });
      await qc.invalidateQueries({ queryKey: [...CLE_GROUPES] });
      notifications.show({ color: 'teal', message: `Groupe « ${g.nom} » créé : choisissez ses machines.` });
      onCree(g);
    } catch (x) {
      setErreur(x);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <form onSubmit={(e) => void creer(e)}>
      <Stack>
        <ErrorAlert error={erreur} />
        <ChampsGroupe {...champs} groupe={null} onChange={(p) => setChamps({ ...champs, ...p })} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onAnnuler}>
            Annuler
          </Button>
          <Button type="submit" loading={envoi} disabled={!champs.nom.trim()}>
            Créer le groupe
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/** Fenêtre d'un groupe : champs, machines lues à cocher, enregistrement, suppression. */
function FicheGroupe({
  id,
  onRetour,
  onSupprime,
}: {
  id: string;
  onRetour: () => void;
  onSupprime: (id: string) => void;
}) {
  const qc = useQueryClient();
  const peutSupprimer = useCan()('vulnerabilites', 'supprimer');
  const [saisie, setSaisie] = useState('');
  const [recherche, setRecherche] = useState({ q: '', membres: '' as '' | 'oui' | 'non' });
  const [page, setPage] = useState(1);
  const [changements, setChangements] = useState<ChangementsMembres>(AUCUN_CHANGEMENT);
  const [champs, setChamps] = useState<{ nom: string; description: string; fournisseurRef: string | null } | null>(
    null,
  );
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const lecture = useQuery({
    queryKey: [...CLE_GROUPES, id, 'machines', recherche, page],
    queryFn: () => get<PageMachinesGroupe>(urlMachinesGroupe(id, recherche, page)),
  });
  const groupe = lecture.data?.groupe ?? null;
  // Champs repris du serveur à l'ouverture et après chaque enregistrement (nouvelle version).
  useEffect(() => {
    if (groupe)
      setChamps({
        nom: groupe.nom,
        description: groupe.description,
        fournisseurRef: groupe.fournisseur?.ref ?? null,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupe?.id, groupe?.version]);
  const champsModifies =
    !!groupe &&
    !!champs &&
    (champs.nom.trim() !== groupe.nom ||
      champs.description.trim() !== groupe.description ||
      champs.fournisseurRef !== (groupe.fournisseur?.ref ?? null));
  const chercher = (e: FormEvent) => {
    e.preventDefault();
    setRecherche({ ...recherche, q: saisie.trim() });
    setPage(1);
  };
  const enregistrer = async () => {
    if (!groupe || !champs) return;
    setEnvoi(true);
    setErreur(null);
    try {
      let version = groupe.version;
      if (champsModifies) {
        const g = await api<GroupeMachines>('PATCH', urlGroupe(id), {
          body: {
            nom: champs.nom,
            description: champs.description,
            ...(champs.fournisseurRef !== (groupe.fournisseur?.ref ?? null)
              ? { fournisseurRef: champs.fournisseurRef }
              : {}),
          },
          ifMatch: version,
        });
        version = g.version;
      }
      let ajoutees = 0;
      let retirees = 0;
      for (const lot of lotsMembres(changements)) {
        const b = await api<BilanMembresGroupe>('POST', `${urlGroupe(id)}/machines`, { body: lot, ifMatch: version });
        version = b.groupe.version;
        ajoutees += b.ajoutees;
        retirees += b.retirees;
      }
      setChangements(AUCUN_CHANGEMENT);
      await qc.invalidateQueries({ queryKey: [...CLE_GROUPES] });
      await qc.invalidateQueries({ queryKey: [...CLE_MACHINES] });
      notifications.show({
        color: 'teal',
        message: `Groupe enregistré${ajoutees || retirees ? ` : ${ajoutees} ajoutée${ajoutees > 1 ? 's' : ''}, ${retirees} retirée${retirees > 1 ? 's' : ''}` : ''}.`,
      });
    } catch (x) {
      setErreur(x);
      await qc.invalidateQueries({ queryKey: [...CLE_GROUPES, id] });
    } finally {
      setEnvoi(false);
    }
  };
  const supprimer = async () => {
    if (!groupe) return;
    try {
      await api('DELETE', urlGroupe(id), { ifMatch: groupe.version });
      await qc.invalidateQueries({ queryKey: [...CLE_GROUPES] });
      await qc.invalidateQueries({ queryKey: [...CLE_MACHINES] });
      notifications.show({ color: 'teal', message: `Groupe « ${groupe.nom} » supprimé ; ses machines restent.` });
      onSupprime(id);
    } catch (x) {
      setErreur(x);
    }
  };
  const page_ = lecture.data;
  const pages = page_ ? nombrePages(page_.total, page_.parPage) : 1;
  return (
    <Stack>
      <Group>
        <Button variant="subtle" onClick={onRetour}>
          Retour aux groupes
        </Button>
      </Group>
      <ErrorAlert error={erreur ?? lecture.error} />
      {groupe && champs && (
        <>
          <ChampsGroupe {...champs} groupe={groupe} onChange={(p) => setChamps({ ...champs, ...p })} />
          {groupe.horsLecture && (
            <Alert color="gray">
              Ce groupe compte aussi des machines que vous ne lisez pas : elles ne sont ni affichées ni comptées, et vos
              changements ne les touchent pas.
            </Alert>
          )}
          <form onSubmit={chercher} role="search">
            <Group align="flex-end">
              <TextInput
                label="Rechercher une machine"
                placeholder="Nom ou adresse IP"
                maxLength={100}
                value={saisie}
                onChange={(e) => setSaisie(e.currentTarget.value)}
              />
              <Button type="submit" variant="default">
                Rechercher
              </Button>
              <SegmentedControl
                aria-label="Machines montrées"
                value={recherche.membres}
                onChange={(v) => {
                  setRecherche({ ...recherche, membres: v as '' | 'oui' | 'non' });
                  setPage(1);
                }}
                data={[
                  { value: '', label: 'Toutes' },
                  { value: 'oui', label: 'Dans le groupe' },
                  { value: 'non', label: 'Hors du groupe' },
                ]}
              />
            </Group>
          </form>
          {page_ && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed" role="status">
                {page_.total} machine{page_.total > 1 ? 's' : ''} trouvée{page_.total > 1 ? 's' : ''} parmi celles que
                vous lisez
              </Text>
              <Button
                variant="default"
                size="xs"
                disabled={!page_.total}
                onClick={() => setChangements(toutCocher(page_.identifiants, changements))}
              >
                {libelleToutCocher(page_.total)}
              </Button>
            </Group>
          )}
          {page_?.identifiantsTronques && (
            <Text size="sm" c="dimmed">
              « Tout cocher » prend les {GROUPES_MACHINES_BORNES.lot} premières : affinez la recherche pour les autres.
            </Text>
          )}
          {page_ && !!page_.elements.length && (
            <DataTable label={`Machines du groupe ${groupe.nom}`}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>
                      <span className="sr-only">Dans le groupe</span>
                    </Table.Th>
                    <Table.Th>Machine</Table.Th>
                    <Table.Th>Adresse IP</Table.Th>
                    <Table.Th>Périmètre</Table.Th>
                    <Table.Th>Autres groupes</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {page_.elements.map((m) => (
                    <Table.Tr key={m.id}>
                      <Table.Td>
                        <Checkbox
                          aria-label={`${libelleMachine(m)} dans le groupe`}
                          checked={estCochee(m, changements)}
                          onChange={(e) => setChangements(basculer(m, e.currentTarget.checked, changements))}
                        />
                      </Table.Td>
                      <Table.Td>{libelleMachine(m)}</Table.Td>
                      <Table.Td>{m.adresse ?? '—'}</Table.Td>
                      <Table.Td>{m.perimetreNom ?? 'Sans périmètre'}</Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {mentionAutresGroupes(m) ?? '—'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </DataTable>
          )}
          {pages > 1 && (
            <Pagination
              {...NOMS_PAGINATION}
              total={pages}
              value={page}
              onChange={setPage}
              aria-label="Pages des machines du groupe"
            />
          )}
          <Group justify="space-between">
            {/* Supprimer un enregistrement exige le droit « supprimer » du module (ADR 0068) ; le serveur reste seul juge. */}
            {peutSupprimer ? (
              <ConfirmButton
                variant="default"
                message={`Supprimer le groupe « ${groupe.nom} » ? Les machines restent ; seul le groupe disparaît.`}
                onConfirm={supprimer}
              >
                Supprimer le groupe
              </ConfirmButton>
            ) : (
              <span />
            )}
            <Group>
              {aDesChangements(changements) && (
                <Text size="sm" c="dimmed" role="status">
                  Cases modifiées, non enregistrées
                </Text>
              )}
              <Button
                loading={envoi}
                disabled={!champs.nom.trim() || (!champsModifies && !aDesChangements(changements))}
                onClick={() => void enregistrer()}
              >
                Enregistrer
              </Button>
            </Group>
          </Group>
        </>
      )}
    </Stack>
  );
}

type Vue = { type: 'liste' } | { type: 'nouveau' } | { type: 'groupe'; id: string };

/** Fenêtre « Groupes de machines » (droit de modifier les machines du module ; le serveur en est seul juge). */
export function FenetreGroupes({
  opened,
  onClose,
  onSupprime,
}: {
  opened: boolean;
  onClose: () => void;
  onSupprime?: (id: string) => void;
}) {
  const [vue, setVue] = useState<Vue>({ type: 'liste' });
  const fermer = () => {
    setVue({ type: 'liste' });
    onClose();
  };
  return (
    <Modal
      closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
      opened={opened}
      onClose={fermer}
      title={
        vue.type === 'nouveau'
          ? 'Nouveau groupe de machines'
          : vue.type === 'groupe'
            ? 'Groupe de machines'
            : 'Groupes de machines'
      }
      size="xl"
      centered
      lockScroll={false}
    >
      {vue.type === 'liste' && (
        <ListeGroupes onOuvrir={(id) => setVue({ type: 'groupe', id })} onNouveau={() => setVue({ type: 'nouveau' })} />
      )}
      {vue.type === 'nouveau' && (
        <NouveauGroupe
          onCree={(g) => setVue({ type: 'groupe', id: g.id })}
          onAnnuler={() => setVue({ type: 'liste' })}
        />
      )}
      {vue.type === 'groupe' && (
        <FicheGroupe
          id={vue.id}
          onRetour={() => setVue({ type: 'liste' })}
          onSupprime={(id) => {
            setVue({ type: 'liste' });
            onSupprime?.(id);
          }}
        />
      )}
    </Modal>
  );
}

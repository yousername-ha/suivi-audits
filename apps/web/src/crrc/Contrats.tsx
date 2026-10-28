/* Gestion CRRC — contrats établissements, offres régionales et vue d'ensemble (reprise de l'outil de suivi). */
import { Anchor, Button, Card, Checkbox, Group, Modal, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import {
  DEPARTEMENTS_CRRC,
  STATUTS_CONTRAT_CRRC,
  STATUTS_OFFRE_CRRC,
  TECHNOLOGIES_CRRC,
  formaterVolume,
  libelleTechnologie,
  statutEtablissement,
  statutRessource,
  type EtatCrrc,
  type Etablissement,
  type Offre,
} from '@suivi/shared';
import { ConfirmButton, DataTable } from '@suivi/ui';
import { ErrorAlert } from '../components/common';
import { ChampChoix, ChampTexte, ChampZone } from '../historique/champs';
import { Anneau, Chiffres } from '../historique/graphiques';
import { useCan } from '../session';
import { Pastille, useCrrc, usePage, type AgirCrrc } from './commun';

const offreTechnique = (e: Etablissement) =>
  TECHNOLOGIES_CRRC.filter((t) => e.scopes[t.cle])
    .map((t) => t.libelle)
    .join(' + ') || '–';

function CataloguePerimetres({ offre }: { offre: Offre }) {
  return (
    <Stack gap="xs">
      {offre.perimeters.map((p) => (
        <Card key={p.cle} withBorder padding="xs">
          <Text fw={600} size="sm">
            {p.libelle}
          </Text>
          <Text size="xs" c="dimmed">
            {p.description}
          </Text>
          <Group gap="xs">
            {p.etiquettes.map((x) => (
              <Pastille key={x} s={x === 'À confirmer' ? 'À compléter' : 'Déploiement'} />
            ))}
          </Group>
        </Card>
      ))}
    </Stack>
  );
}

/* ----------------------------------------------------------------------------------------------- vue d'ensemble */
export function VueEnsembleCrrc() {
  const can = useCan(),
    { d, agir, erreur } = useCrrc(),
    [fiche, setFiche] = useState<string | null>(null);
  const e = d?.etat;
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Gestion CRRC</Text>
          <Text size="sm" c="dimmed">
            Suivi des contrats établissements et des offres du Centre de ressources régional en cybersécurité.
          </Text>
        </div>
        {can('crrc', 'modifier') && <NouveauContrat agir={agir} onCree={setFiche} />}
      </Group>
      {e && (
        <>
          <Chiffres
            items={[
              {
                valeur: e.establishments.length,
                libelle: 'Établissements suivis',
                detail: 'conventions et souscriptions',
              },
              {
                valeur: e.establishments.filter((x) => x.status === 'Actif').length,
                libelle: 'Contrats actifs',
                detail: `sur ${e.establishments.length} établissement(s)`,
              },
              {
                valeur: formaterVolume(e.establishments.reduce((a, x) => a + x.capacityGb, 0)),
                libelle: 'Capacité S3 souscrite',
                detail: 'tous contrats confondus',
              },
              {
                valeur: e.establishments.filter((x) => x.status === 'Déploiement').length,
                libelle: 'Déploiements en cours',
                detail: `${e.establishments.filter((x) => ['À compléter', 'À signer'].includes(x.status)).length} contrat(s) à finaliser`,
              },
            ]}
          />
          <Text fw={600}>Contrats établissements</Text>
          <ListeContrats e={e} lignes={e.establishments.slice(0, 10)} onOuvrir={setFiche} />
          <Group align="flex-start" grow>
            <Stack gap="xs">
              <Text fw={600}>Catalogue de l’offre de sauvegarde</Text>
              {e.offers.find((o) => o.id === 'backup') && (
                <CataloguePerimetres offre={e.offers.find((o) => o.id === 'backup')!} />
              )}
            </Stack>
            <Stack gap="xs">
              <Text fw={600}>Répartition des offres (par nombre de contrats)</Text>
              <Anneau
                ariaLabel="Répartition des contrats par offre technique"
                centre={String(e.establishments.length)}
                sous="contrats"
                parts={TECHNOLOGIES_CRRC.map((t) => ({
                  libelle: t.libelle,
                  valeur: e.establishments.filter((x) => x.scopes[t.cle]).length,
                  teinte: t.teinte,
                }))}
              />
            </Stack>
          </Group>
        </>
      )}
      <FicheContrat id={fiche} e={e} agir={agir} modifiable={can('crrc', 'modifier')} onFermer={() => setFiche(null)} />
    </Stack>
  );
}

function NouveauContrat({ agir, onCree }: { agir: AgirCrrc; onCree: (id: string) => void }) {
  return (
    <Button
      onClick={async () => {
        const r = await agir<{ id: string }>('POST', '/api/crrc/etablissements');
        if (r) onCree(r.id);
      }}
    >
      Nouveau contrat
    </Button>
  );
}

function ListeContrats({
  e,
  lignes,
  onOuvrir,
  exploitation,
}: {
  e: EtatCrrc;
  lignes: Etablissement[];
  onOuvrir: (id: string) => void;
  exploitation?: boolean;
}) {
  return (
    <DataTable label="Contrats établissements">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Établissement</Table.Th>
            <Table.Th>FINESS</Table.Th>
            <Table.Th>Contact</Table.Th>
            <Table.Th>Offre technique</Table.Th>
            <Table.Th>Capacité{exploitation ? ' souscrite' : ''}</Table.Th>
            <Table.Th>Rétention</Table.Th>
            <Table.Th>Statut du contrat</Table.Th>
            {exploitation && <Table.Th>Exploitation</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lignes.map((x) => {
            const [lib] = statutEtablissement(e, x);
            return (
              <Table.Tr key={x.id}>
                <Table.Td>
                  <Anchor component="button" type="button" fw={600} onClick={() => onOuvrir(x.id)}>
                    {x.name}
                  </Anchor>
                </Table.Td>
                <Table.Td>{x.finess || '–'}</Table.Td>
                <Table.Td>{x.adminContact || '–'}</Table.Td>
                <Table.Td>{offreTechnique(x)}</Table.Td>
                <Table.Td>{formaterVolume(x.capacityGb)}</Table.Td>
                <Table.Td>{x.retentionDays ? `${x.retentionDays} j` : '–'}</Table.Td>
                <Table.Td>
                  <Pastille s={x.status} />
                </Table.Td>
                {exploitation && (
                  <Table.Td>
                    <Pastille s={lib} />
                  </Table.Td>
                )}
              </Table.Tr>
            );
          })}
          {!lignes.length && (
            <Table.Tr>
              <Table.Td colSpan={exploitation ? 8 : 7}>Aucun contrat : créez le premier.</Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/* ---------------------------------------------------------------------------------- établissements et contrats */
export function EtablissementsCrrc() {
  const can = useCan(),
    { d, agir, erreur } = useCrrc(),
    [fiche, setFiche] = useState<string | null>(null),
    [f, setF] = useState({ q: '', st: '', of: '', dp: '' });
  const e = d?.etat;
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const liste =
    e?.establishments.filter(
      (x) =>
        (!f.st || x.status === f.st) &&
        (!f.of || x.scopes[f.of]) &&
        (!f.dp || DEPARTEMENTS_CRRC[x.finess.slice(0, 2)] === f.dp) &&
        (!f.q || norm(`${x.name} ${x.finess} ${x.adminContact} ${x.techContact}`).includes(norm(f.q))),
    ) ?? [];
  const p = usePage(liste, 10);
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Établissements et contrats</Text>
          <Text size="sm" c="dimmed">
            Conventions, contacts, capacités et périmètres souscrits par établissement.
          </Text>
        </div>
        {can('crrc', 'modifier') && <NouveauContrat agir={agir} onCree={setFiche} />}
      </Group>
      <Group align="flex-end">
        <TextInput
          label="Rechercher"
          placeholder="Rechercher un établissement…"
          value={f.q}
          onChange={(ev) => {
            setF({ ...f, q: ev.currentTarget.value });
            p.retour();
          }}
        />
        <Select
          aria-label="Statut du contrat"
          placeholder="Tous les statuts"
          clearable
          data={[...STATUTS_CONTRAT_CRRC]}
          value={f.st || null}
          onChange={(v) => {
            setF({ ...f, st: v ?? '' });
            p.retour();
          }}
        />
        <Select
          aria-label="Offre technique"
          placeholder="Toutes les offres"
          clearable
          data={TECHNOLOGIES_CRRC.map((t) => ({ value: t.cle, label: t.libelle }))}
          value={f.of || null}
          onChange={(v) => {
            setF({ ...f, of: v ?? '' });
            p.retour();
          }}
        />
        <Select
          aria-label="Département"
          placeholder="Tous les départements"
          clearable
          data={Object.values(DEPARTEMENTS_CRRC)}
          value={f.dp || null}
          onChange={(v) => {
            setF({ ...f, dp: v ?? '' });
            p.retour();
          }}
        />
      </Group>
      {e && <ListeContrats e={e} lignes={p.lignes} onOuvrir={setFiche} exploitation />}
      {p.nav}
      <FicheContrat id={fiche} e={e} agir={agir} modifiable={can('crrc', 'modifier')} onFermer={() => setFiche(null)} />
    </Stack>
  );
}

function FicheContrat({
  id,
  e,
  agir,
  modifiable,
  onFermer,
}: {
  id: string | null;
  e: EtatCrrc | undefined;
  agir: AgirCrrc;
  modifiable: boolean;
  onFermer: () => void;
}) {
  const peutSupprimer = useCan()('crrc', 'supprimer');
  const x = e?.establishments.find((y) => y.id === id) ?? null;
  const maj = (champ: Record<string, unknown>) =>
    void agir('PATCH', `/api/crrc/etablissements/${encodeURIComponent(id!)}`, champ);
  const texte = (cle: keyof Etablissement, label: string, type?: string) => (
    <ChampTexte
      label={label}
      type={type}
      value={String(x![cle] ?? '')}
      disabled={!modifiable}
      onCommit={(v) => maj({ [cle]: v })}
    />
  );
  const nombre = (cle: 'capacityGb' | 'retentionDays', label: string) => (
    <ChampTexte
      label={label}
      type="number"
      value={String(x![cle])}
      disabled={!modifiable}
      onCommit={(v) => maj({ [cle]: Math.max(0, Number(v) || 0) })}
    />
  );
  const ressources = e && x ? e.resources.filter((r) => r.est === x.id) : [];
  return (
    <Modal opened={!!x} onClose={onFermer} lockScroll={false} size="xl" title={x ? `${x.id} — ${x.name}` : ''}>
      {x && e && (
        <Stack key={x.id}>
          <Group>
            <Pastille s={x.status} />
            <Pastille s={statutEtablissement(e, x)[0]} />
          </Group>
          <div className="grille-formulaire">
            <div className="grille-formulaire__champs">
              <ChampTexte
                label="Établissement"
                value={x.name}
                requis
                disabled={!modifiable}
                onCommit={(v) => maj({ name: v })}
              />
              {texte('finess', 'FINESS')}
              <ChampChoix
                label="Statut"
                value={x.status}
                options={STATUTS_CONTRAT_CRRC}
                disabled={!modifiable}
                onCommit={(v) => maj({ status: v })}
              />
              {texte('signed', 'Date de signature', 'date')}
              {texte('serviceDate', 'Mise en service', 'date')}
              {texte('adminContact', 'Contact administratif')}
              {texte('adminEmail', 'Courriel administratif', 'email')}
              {texte('techContact', 'Contact technique')}
              {texte('techEmail', 'Courriel technique', 'email')}
              {texte('prestataire', 'Prestataire informatique local')}
              {texte('alerts', 'Destinataire(s) des alertes')}
              {nombre('capacityGb', 'Capacité S3 commandée (Go)')}
              {nombre('retentionDays', 'Rétention (jours)')}
              {texte('renewal', 'Échéance ou renouvellement', 'date')}
            </div>
          </div>
          <Text fw={600}>Périmètres souscrits</Text>
          <Group>
            {TECHNOLOGIES_CRRC.map((t) => (
              <Checkbox
                key={t.cle}
                label={t.libelle}
                checked={!!x.scopes[t.cle]}
                disabled={!modifiable}
                onChange={(ev) => maj({ scopes: { [t.cle]: ev.currentTarget.checked } })}
              />
            ))}
          </Group>
          {(x.scopes.m365 || x.scopes.gws) && (
            <Text size="sm" c="dimmed">
              Microsoft 365 et Google Workspace : la solution SaaS finale reste à confirmer contractuellement.
            </Text>
          )}
          <Text fw={600}>Ressources sauvegardées ({ressources.length})</Text>
          {ressources.length ? (
            <ul>
              {ressources.map((r) => (
                <li key={r.id}>
                  {r.name} — {libelleTechnologie(r.tech)} <Pastille s={statutRessource(e, r)[0]} />
                </li>
              ))}
            </ul>
          ) : (
            <Text size="sm">Aucune ressource.</Text>
          )}
          {modifiable && (
            <div>
              <Button variant="default" onClick={() => void agir('POST', '/api/crrc/ressources', { est: x.id })}>
                Ajouter une ressource
              </Button>
            </div>
          )}
          <ChampZone label="Notes" value={x.notes} disabled={!modifiable} onCommit={(v) => maj({ notes: v })} />
          {modifiable && peutSupprimer && (
            <Group justify="flex-end">
              <ConfirmButton
                message={`Supprimer le contrat « ${x.name} » ? Ses ressources restent dans l’historique.`}
                onConfirm={async () => {
                  await agir('DELETE', `/api/crrc/etablissements/${encodeURIComponent(x.id)}`);
                  onFermer();
                }}
                variant="light"
              >
                Supprimer le contrat
              </ConfirmButton>
            </Group>
          )}
        </Stack>
      )}
    </Modal>
  );
}

/* --------------------------------------------------------------------------------------- catalogue des offres */
export function OffresCrrc() {
  const can = useCan(),
    modifiable = can('crrc', 'modifier'),
    { d, agir, erreur } = useCrrc();
  const e = d?.etat;
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Catalogue des offres CRRC</Text>
          <Text size="sm" c="dimmed">
            Offres régionales proposées aux établissements. La première offre suivie est la sauvegarde ; d’autres offres
            peuvent être ajoutées.
          </Text>
        </div>
        {modifiable && <Button onClick={() => void agir('POST', '/api/crrc/offres')}>Ajouter une offre</Button>}
      </Group>
      {e?.offers.map((o) => {
        const maj = (champ: Record<string, unknown>) =>
          void agir('PATCH', `/api/crrc/offres/${encodeURIComponent(o.id)}`, champ);
        const souscripteurs = e.establishments.filter((x) => (x.offers.length ? x.offers : ['backup']).includes(o.id));
        return (
          <Card key={o.id} withBorder>
            <Stack key={`${o.id}-${o.name}`}>
              <Group justify="space-between">
                <Text fw={600}>{o.name}</Text>
                <Pastille s={o.status === 'Disponible' ? 'Actif' : o.status} />
              </Group>
              <div className="grille-formulaire">
                <div className="grille-formulaire__champs">
                  <ChampTexte
                    label="Nom"
                    value={o.name}
                    requis
                    disabled={!modifiable}
                    onCommit={(v) => maj({ name: v })}
                  />
                  <ChampChoix
                    label="Statut"
                    value={o.status}
                    options={STATUTS_OFFRE_CRRC}
                    disabled={!modifiable}
                    onCommit={(v) => maj({ status: v })}
                  />
                  <ChampTexte
                    label="Partenaire ou opérateur"
                    value={o.partner}
                    disabled={!modifiable}
                    onCommit={(v) => maj({ partner: v })}
                  />
                </div>
              </div>
              <ChampZone label="Description" value={o.desc} disabled={!modifiable} onCommit={(v) => maj({ desc: v })} />
              {o.perimeters.length > 0 && <CataloguePerimetres offre={o} />}
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {souscripteurs.length} établissement(s) souscripteur(s).
                </Text>
                {modifiable && can('crrc', 'supprimer') && o.id !== 'backup' && (
                  <ConfirmButton
                    message="Supprimer cette offre ?"
                    onConfirm={() => agir('DELETE', `/api/crrc/offres/${encodeURIComponent(o.id)}`)}
                    variant="light"
                  >
                    Supprimer l’offre
                  </ConfirmButton>
                )}
              </Group>
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}

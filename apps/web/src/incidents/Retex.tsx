/* RETEX d'un incident, côté pilote (droit de modification des incidents) : liste des RETEX, ouverture (seul ou avec des
   contributeurs d'autres pôles), saisie de la chronologie, contributeurs (invitation, relance, retrait), file à valider
   (accepter, corriger puis accepter, déjà connu, rejeter), récupération d'éléments (fiche de l'incident, main courante de
   crise), clôture, diffusion et chronologie animée générée. Données dans l'incident (champs `timeline` et `retexCollecte`
   de l'état historique), sous verrou, par les routes /api/incidents/:id/retex…. */
import {
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  GRAVITES_RETEX,
  LIBELLES_PROPOSITION,
  TYPES_EVENEMENT_RETEX,
  chronologieRetex,
  dateHeureRetex,
  dureeRetex,
  filtrerIncidents,
  indicateursRetex,
  obligationsIncident,
  syntheseCollecte,
  type CandidatRetex,
  type CollecteRetex,
  type EtatCrise,
  type EvenementRetex,
  type Incident,
  type PropositionRetex,
  type StatutProposition,
} from '@suivi/shared';
import { ConfirmButton, DataTable, StatusChip, type Etat } from '@suivi/ui';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { ChampTexte, ChampZone, useModule } from '../historique/champs';
import { Chiffres } from '../historique/graphiques';
import { useCan } from '../session';
import { ChronologieRetex, TEINTE_TYPE_RETEX } from './ChronologieRetex';
import {
  FormulaireEvenementRetex,
  isoVersLocal,
  maintenantLocal,
  nettoyerSaisie,
  saisieVide,
  type SaisieRetex,
} from './FormulaireEvenementRetex';

interface Donnees {
  version: number;
  incidents: Incident[];
  categorieEntite: string;
  ecarts: Record<string, string>;
}
type Agir = <R = unknown>(m: string, c: string, b?: unknown) => Promise<R | undefined>;
type Vue = 'saisie' | 'contributeurs' | 'valider' | 'recuperer' | 'chronologie';
const VUES: Vue[] = ['saisie', 'contributeurs', 'valider', 'recuperer', 'chronologie'];
const ETAT_PROPOSITION: Record<StatutProposition, Etat> = {
  en_attente: 'attention',
  acceptee: 'succes',
  doublon: 'info',
  rejetee: 'neutre',
};
const dateCourte = (iso: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '');
const dateJour = (d: string) => (d ? d.split('-').reverse().join('/') : '');
const urlRetex = (id: string) => `/api/incidents/${encodeURIComponent(id)}/retex`;

export const TypeRetex = ({ type }: { type: string }) => (
  <span className="retex-type">
    <span className={`retex-pastille graph-${TEINTE_TYPE_RETEX[type] ?? 'gris'}`} aria-hidden="true" />
    {type}
  </span>
);
export const StatutPropositionChip = ({ p }: { p: Pick<PropositionRetex, 'statut'> }) => (
  <StatusChip etat={ETAT_PROPOSITION[p.statut]}>{LIBELLES_PROPOSITION[p.statut]}</StatusChip>
);
const ChipCollecte = ({ c }: { c: CollecteRetex | null }) =>
  !c ? (
    <StatusChip etat="neutre">Saisie seule</StatusChip>
  ) : c.statut === 'cloturee' ? (
    <StatusChip etat="succes">{c.diffusee ? 'Close, diffusée' : 'Collecte close'}</StatusChip>
  ) : (
    <StatusChip etat="attention">Collecte ouverte</StatusChip>
  );

/* ================================================================================================ page */
export function RetexIncidents() {
  const can = useCan(),
    modifiable = can('incidents', 'modifier'),
    [params, setParams] = useSearchParams(),
    { d, agir, erreur } = useModule<Donnees>('incidents', '/api/incidents'),
    [ouverture, setOuverture] = useState<string | null>(null),
    [plein, setPlein] = useState(false);
  const incident = d?.incidents.find((i) => i.id === params.get('incident')) ?? null;
  const vue: Vue = VUES.includes(params.get('vue') as Vue) ? (params.get('vue') as Vue) : 'saisie';
  const aller = (id: string | null, v: Vue = 'saisie') =>
    setParams(id ? { incident: id, ...(v !== 'saisie' ? { vue: v } : {}) } : {}, { replace: true });

  return (
    <Stack>
      <ErrorAlert error={erreur} />
      {!incident ? (
        <ListeRetex d={d} modifiable={modifiable} ouvrir={(id) => aller(id)} nouveau={() => setOuverture('')} />
      ) : (
        <FicheRetex
          i={incident}
          vue={vue}
          modifiable={modifiable}
          agir={agir}
          aller={(v) => aller(incident.id, v)}
          retour={() => aller(null)}
          ouvrirCollecte={() => setOuverture(incident.id)}
          pleinEcran={() => setPlein(true)}
        />
      )}
      {d && ouverture !== null && (
        <OuvertureRetex
          d={d}
          incidentId={ouverture}
          agir={agir}
          fermer={(id) => {
            setOuverture(null);
            if (id) aller(id, 'contributeurs');
          }}
        />
      )}
      {incident && (
        <Modal
          opened={plein && vue === 'chronologie'}
          onClose={() => setPlein(false)}
          fullScreen
          lockScroll={false}
          title="Chronologie du RETEX"
        >
          <ChronologieRetex
            titre={`${incident.id} — ${incident.title || '(sans titre)'}`}
            points={chronologieRetex(incident.timeline)}
            indicateurs={indicateursRetex(incident.timeline)}
          />
        </Modal>
      )}
    </Stack>
  );
}

/* ================================================================================================ liste */
function ListeRetex({
  d,
  modifiable,
  ouvrir,
  nouveau,
}: {
  d: Donnees | undefined;
  modifiable: boolean;
  ouvrir: (id: string) => void;
  nouveau: () => void;
}) {
  const liste = (d ? filtrerIncidents(d.incidents, 'all') : []).filter((i) => i.collecte || i.timeline.length);
  const ouverts = liste.filter((i) => i.collecte?.statut === 'ouverte');
  const attente = liste.reduce((n, i) => n + syntheseCollecte(i.collecte).enAttente, 0);
  return (
    <>
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Retours d’expérience</Text>
          <Text size="sm" c="dimmed">
            Ouvrez un RETEX sur un incident, remplissez-le seul ou invitez des personnes d’autres pôles : chacune ajoute
            ses éléments sans voir le reste. Vous validez, puis vous générez la chronologie animée.
          </Text>
        </div>
        {modifiable && <Button onClick={nouveau}>Ouvrir un RETEX</Button>}
      </Group>
      <Chiffres
        items={[
          { valeur: liste.length, libelle: 'RETEX' },
          { valeur: ouverts.length, libelle: 'collectes ouvertes' },
          { valeur: attente, libelle: 'propositions à valider' },
        ]}
      />
      <DataTable label="Retours d’expérience">
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Incident</Table.Th>
              <Table.Th>Pilote</Table.Th>
              <Table.Th>Collecte</Table.Th>
              <Table.Th>Contributeurs</Table.Th>
              <Table.Th>À valider</Table.Th>
              <Table.Th>Échéance</Table.Th>
              <Table.Th>Chronologie</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {liste.map((i) => {
              const s = syntheseCollecte(i.collecte);
              return (
                <Table.Tr key={i.id}>
                  <Table.Td>
                    <Anchor component="button" type="button" fw={600} onClick={() => ouvrir(i.id)}>
                      {i.id}
                    </Anchor>
                    <Text size="xs" c="dimmed">
                      {i.title || '(sans titre)'}
                    </Text>
                  </Table.Td>
                  <Table.Td>{i.collecte?.piloteNom || '–'}</Table.Td>
                  <Table.Td>
                    <ChipCollecte c={i.collecte} />
                  </Table.Td>
                  <Table.Td>{s.contributeurs ? `${s.termines} / ${s.contributeurs} terminé(s)` : '–'}</Table.Td>
                  <Table.Td>{s.enAttente ? <Badge color="orange">{s.enAttente}</Badge> : '–'}</Table.Td>
                  <Table.Td>{dateJour(i.collecte?.echeance ?? '') || '–'}</Table.Td>
                  <Table.Td>{i.timeline.length} événement(s)</Table.Td>
                </Table.Tr>
              );
            })}
            {!liste.length && (
              <Table.Tr>
                <Table.Td colSpan={7}>Aucun RETEX. Ouvrez-en un depuis un incident du registre.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </DataTable>
    </>
  );
}

/* ================================================================================================ ouverture */
function OuvertureRetex({
  d,
  incidentId,
  agir,
  fermer,
}: {
  d: Donnees;
  incidentId: string;
  agir: Agir;
  fermer: (id?: string) => void;
}) {
  const [id, setId] = useState<string | null>(incidentId || null);
  const [mode, setMode] = useState<'seul' | 'collectif'>('collectif');
  const [consigne, setConsigne] = useState(
    'Ajoutez les événements que votre pôle a vécus pendant l’incident : ce que vous avez constaté, décidé ou fait, avec la date et l’heure les plus précises possible.',
  );
  const [echeance, setEcheance] = useState('');
  const [invites, setInvites] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const candidats = useCandidats(mode === 'collectif');
  const choix = filtrerIncidents(d.incidents, 'all').filter((i) => !i.collecte);
  return (
    <Modal opened onClose={() => fermer()} lockScroll={false} size="lg" title="Ouvrir un RETEX">
      <Stack>
        <Select
          label="Incident"
          placeholder="Choisir un incident du registre"
          searchable
          required
          comboboxProps={{ withinPortal: true }}
          value={id}
          onChange={setId}
          data={choix.map((i) => ({ value: i.id, label: `${i.id} — ${i.title || '(sans titre)'}` }))}
        />
        <SegmentedControl
          aria-label="Mode de collecte"
          value={mode}
          onChange={(v) => setMode(v as 'seul' | 'collectif')}
          data={[
            { value: 'collectif', label: 'J’invite des contributeurs' },
            { value: 'seul', label: 'Je remplis seul' },
          ]}
        />
        {mode === 'collectif' && (
          <>
            <MultiSelect
              label="Contributeurs"
              description="Comptes existants. Chacun n’aura accès qu’à ce RETEX, pour y ajouter ses propres éléments."
              placeholder="Rechercher une personne ou un pôle"
              searchable
              comboboxProps={{ withinPortal: true }}
              data={optionsCandidats(candidats.data ?? [], [])}
              value={invites}
              onChange={setInvites}
            />
            <Textarea
              label="Consigne aux contributeurs"
              autosize
              minRows={2}
              value={consigne}
              onChange={(e) => setConsigne(e.currentTarget.value)}
            />
            <TextInput
              label="Échéance de la collecte"
              type="date"
              value={echeance}
              onChange={(e) => setEcheance(e.currentTarget.value)}
            />
          </>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={() => fermer()}>
            Annuler
          </Button>
          <Button
            disabled={!id || (mode === 'collectif' && !invites.length)}
            loading={envoi}
            onClick={async () => {
              if (!id) return;
              setEnvoi(true);
              try {
                const corps = mode === 'collectif' ? { consigne: consigne.trim(), echeance } : {};
                const ok = await agir(`POST`, `${urlRetex(id)}/ouverture`, corps);
                if (!ok) return;
                if (mode === 'collectif' && invites.length)
                  await agir('POST', `${urlRetex(id)}/invitations`, { utilisateurs: invites });
                fermer(id);
              } finally {
                setEnvoi(false);
              }
            }}
          >
            {mode === 'collectif' ? 'Ouvrir et envoyer les invitations' : 'Ouvrir le RETEX'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
function useCandidats(actif: boolean) {
  return useQuery({
    queryKey: ['retex-candidats'],
    queryFn: () => get<CandidatRetex[]>('/api/retex/candidats'),
    enabled: actif,
    staleTime: 60_000,
  });
}
/** Options du sélecteur, groupées par pôle (premier groupe du compte). */
function optionsCandidats(c: CandidatRetex[], exclus: string[]) {
  const groupes = new Map<string, { value: string; label: string }[]>();
  for (const x of c.filter((x) => !exclus.includes(x.id))) {
    const pole = x.pole.split(', ')[0] || 'Sans pôle';
    groupes.set(pole, [...(groupes.get(pole) ?? []), { value: x.id, label: x.nom }]);
  }
  return [...groupes.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'fr'))
    .map(([group, items]) => ({ group, items }));
}

/* ================================================================================================ fiche */
function FicheRetex({
  i,
  vue,
  modifiable,
  agir,
  aller,
  retour,
  ouvrirCollecte,
  pleinEcran,
}: {
  i: Incident;
  vue: Vue;
  modifiable: boolean;
  agir: Agir;
  aller: (v: Vue) => void;
  retour: () => void;
  ouvrirCollecte: () => void;
  pleinEcran: () => void;
}) {
  const c = i.collecte;
  const s = syntheseCollecte(c);
  const points = chronologieRetex(i.timeline);
  const base = urlRetex(i.id);
  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <div>
          <Anchor component="button" type="button" size="sm" onClick={retour}>
            ‹ Tous les RETEX
          </Anchor>
          <Group gap="sm" mt="xs">
            <Text fw={700} size="lg">
              RETEX {i.id} — {i.title || '(sans titre)'}
            </Text>
            <ChipCollecte c={c} />
          </Group>
          {c && (
            <Text size="sm" c="dimmed">
              Pilote : {c.piloteNom} · ouvert le {dateCourte(c.ouverteLe)}
              {c.echeance ? ` · échéance de la collecte : ${dateJour(c.echeance)}` : ''}
            </Text>
          )}
        </div>
        {modifiable && (
          <Group gap="xs">
            {!c && <Button onClick={ouvrirCollecte}>Inviter des contributeurs</Button>}
            {c?.statut === 'ouverte' && (
              <Button
                variant="default"
                disabled={s.enAttente > 0}
                title={s.enAttente ? 'Traitez d’abord la file à valider' : undefined}
                onClick={() => void agir('POST', `${base}/cloture`)}
              >
                Clore la collecte
              </Button>
            )}
            {c?.statut === 'cloturee' && (
              <>
                <Switch
                  label="Diffuser aux contributeurs"
                  checked={c.diffusee}
                  onChange={(e) => void agir('PUT', `${base}/diffusion`, { diffusee: e.currentTarget.checked })}
                />
                <Button variant="default" onClick={() => void agir('POST', `${base}/reouverture`)}>
                  Rouvrir la collecte
                </Button>
              </>
            )}
            {vue === 'chronologie' ? (
              <Button variant="default" onClick={pleinEcran}>
                Plein écran
              </Button>
            ) : (
              <Button disabled={!points.length} onClick={() => aller('chronologie')}>
                Générer la chronologie
              </Button>
            )}
          </Group>
        )}
      </Group>
      <SegmentedControl
        aria-label="Rubrique du RETEX"
        value={vue}
        onChange={(v) => aller(v as Vue)}
        data={[
          { value: 'saisie', label: `Chronologie (${points.length})` },
          { value: 'contributeurs', label: `Contributeurs (${s.contributeurs})`, disabled: !c },
          { value: 'valider', label: `À valider (${s.enAttente})`, disabled: !c },
          { value: 'recuperer', label: 'Récupérer des éléments', disabled: !modifiable },
          { value: 'chronologie', label: 'Chronologie générée', disabled: !points.length },
        ]}
      />
      {vue === 'saisie' && <SaisieRetex incident={i} modifiable={modifiable} agir={agir} />}
      {vue === 'contributeurs' && c && <Contributeurs i={i} c={c} modifiable={modifiable} agir={agir} />}
      {vue === 'valider' && c && <FileAValider i={i} c={c} modifiable={modifiable} agir={agir} />}
      {vue === 'recuperer' && modifiable && <Recuperation i={i} agir={agir} />}
      {vue === 'chronologie' && points.length > 0 && (
        <ChronologieRetex
          titre={`${i.id} — ${i.title || '(sans titre)'}`}
          points={points}
          indicateurs={indicateursRetex(i.timeline)}
        />
      )}
    </Stack>
  );
}

/* ================================================================================================ saisie */
/** Origine lisible d'un événement de la chronologie. */
function origine(e: EvenementRetex) {
  if (e.apport) return `Proposé par ${e.apport}`;
  if (e.source.startsWith('crise:')) return 'Main courante de crise';
  if (e.source.startsWith('incident:')) return 'Fiche de l’incident';
  return 'Saisie du pilote';
}

function SaisieRetex({ incident, modifiable, agir }: { incident: Incident; modifiable: boolean; agir: Agir }) {
  const ind = indicateursRetex(incident.timeline);
  const points = chronologieRetex(incident.timeline);
  const dernier = points[points.length - 1];
  const [edite, setEdite] = useState<EvenementRetex | null>(null);
  const base = `/api/incidents/${encodeURIComponent(incident.id)}`;
  const maj = (champ: Record<string, unknown>) => void agir('PATCH', base, champ);
  return (
    <Stack>
      <Chiffres
        items={[
          { valeur: ind.evenements, libelle: 'événements' },
          { valeur: ind.dureeTotale == null ? '–' : dureeRetex(ind.dureeTotale), libelle: 'durée totale' },
          {
            valeur: ind.avantConfinement == null ? '–' : dureeRetex(ind.avantConfinement),
            libelle: 'avant confinement',
          },
          {
            valeur: ind.avantRetablissement == null ? '–' : dureeRetex(ind.avantRetablissement),
            libelle: 'avant rétablissement',
          },
          { valeur: ind.graviteMax || '–', libelle: 'gravité maximale' },
        ]}
      />
      {modifiable && (
        <Card withBorder>
          <Text fw={600} mb="xs">
            Ajouter un événement
          </Text>
          <FormulaireEvenementRetex
            key={`${incident.id}-${incident.timeline.length}`}
            initial={saisieVide(dernier?.ts || incident.detectedAt || maintenantLocal())}
            libelle="Ajouter à la chronologie"
            valider={async (s) => !!(await agir('POST', `${base}/retex`, nettoyerSaisie(s)))}
          />
        </Card>
      )}
      <DataTable label="Chronologie de l’incident">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date et heure</Table.Th>
              <Table.Th>Écart</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Événement</Table.Th>
              <Table.Th>Gravité</Table.Th>
              <Table.Th>Origine</Table.Th>
              {modifiable && <Table.Th>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {points.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td>{dateHeureRetex(p.ts)}</Table.Td>
                <Table.Td>{p.depuisPrecedent == null ? 'T0' : `+${dureeRetex(p.depuisPrecedent)}`}</Table.Td>
                <Table.Td>
                  <TypeRetex type={p.type} />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {p.titre}
                  </Text>
                  {p.description && (
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {p.description}
                    </Text>
                  )}
                  {p.acteur && (
                    <Text size="xs" c="dimmed">
                      Acteur : {p.acteur}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {p.gravite || (
                    <Text span size="sm" c="dimmed">
                      {GRAVITES_RETEX[p.niveau]} (reportée)
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{origine(p)}</Text>
                </Table.Td>
                {modifiable && (
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Anchor component="button" type="button" size="sm" onClick={() => setEdite(p)}>
                        Modifier
                      </Anchor>
                      <ConfirmButton
                        message={`Retirer « ${p.titre} » de la chronologie ?`}
                        onConfirm={async () => {
                          await agir('DELETE', `${base}/retex/${encodeURIComponent(p.id)}`);
                        }}
                        variant="subtle"
                        size="compact-sm"
                      >
                        Retirer
                      </ConfirmButton>
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
            {!points.length && (
              <Table.Tr>
                <Table.Td colSpan={modifiable ? 7 : 6}>
                  Aucun événement. Saisissez-les ici, récupérez-les depuis la fiche de l’incident ou la main courante de
                  crise, ou invitez des contributeurs.
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </DataTable>
      <ChampZone
        label="Cause identifiée"
        value={incident.cause}
        disabled={!modifiable}
        onCommit={(v) => maj({ cause: v })}
      />
      <ChampZone
        label="Enseignements (retour d’expérience)"
        lignes={4}
        value={incident.retex}
        disabled={!modifiable}
        onCommit={(v) => maj({ retex: v })}
      />
      <Modal opened={!!edite} onClose={() => setEdite(null)} lockScroll={false} size="lg" title="Modifier l’événement">
        {edite && (
          <FormulaireEvenementRetex
            initial={edite}
            libelle="Enregistrer"
            valider={async (s) => {
              const ok = !!(await agir('PATCH', `${base}/retex/${encodeURIComponent(edite.id)}`, nettoyerSaisie(s)));
              if (ok) setEdite(null);
              return ok;
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}

/* ================================================================================================ contributeurs */
function Contributeurs({ i, c, modifiable, agir }: { i: Incident; c: CollecteRetex; modifiable: boolean; agir: Agir }) {
  const base = urlRetex(i.id);
  const [invites, setInvites] = useState<string[]>([]);
  const candidats = useCandidats(modifiable && c.statut === 'ouverte');
  const parAuteur = (uid: string) => c.propositions.filter((p) => p.auteurId === uid);
  const restants = c.contributeurs.filter((x) => !x.termineLe);
  return (
    <Stack>
      <Group align="flex-start" grow>
        <ChampZone
          label="Consigne aux contributeurs"
          value={c.consigne}
          disabled={!modifiable}
          onCommit={(v) => void agir('PATCH', `${base}/collecte`, { consigne: v })}
        />
        <ChampTexte
          label="Échéance de la collecte"
          type="date"
          value={c.echeance}
          disabled={!modifiable}
          onCommit={(v) => void agir('PATCH', `${base}/collecte`, { echeance: v })}
        />
      </Group>
      {modifiable && c.statut === 'ouverte' && (
        <Card withBorder>
          <Group align="flex-end">
            <MultiSelect
              label="Inviter d’autres personnes"
              description="Chacune recevra une notification (dans l’application et par courriel selon ses réglages)."
              placeholder="Rechercher une personne ou un pôle"
              searchable
              comboboxProps={{ withinPortal: true }}
              data={optionsCandidats(
                candidats.data ?? [],
                c.contributeurs.map((x) => x.id),
              )}
              value={invites}
              onChange={setInvites}
              className="retex-invitation"
            />
            <Button
              disabled={!invites.length}
              onClick={async () => {
                if (await agir('POST', `${base}/invitations`, { utilisateurs: invites })) setInvites([]);
              }}
            >
              Inviter
            </Button>
            <Button
              variant="default"
              disabled={!restants.length}
              onClick={() => void agir('POST', `${base}/relances`, {})}
            >
              Relancer ceux qui n’ont pas terminé ({restants.length})
            </Button>
          </Group>
        </Card>
      )}
      <DataTable label="Contributeurs du RETEX">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Personne</Table.Th>
              <Table.Th>Pôle</Table.Th>
              <Table.Th>Invitée le</Table.Th>
              <Table.Th>Contribution</Table.Th>
              <Table.Th>Propositions</Table.Th>
              {modifiable && <Table.Th>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {c.contributeurs.map((x) => {
              const p = parAuteur(x.id);
              return (
                <Table.Tr key={x.id}>
                  <Table.Td fw={500}>{x.nom}</Table.Td>
                  <Table.Td>{x.pole || '–'}</Table.Td>
                  <Table.Td>
                    {dateCourte(x.inviteLe)}
                    {x.relanceLe && (
                      <Text size="xs" c="dimmed">
                        relancée le {dateCourte(x.relanceLe)}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {x.termineLe ? (
                      <StatusChip etat="succes">Terminée le {dateCourte(x.termineLe)}</StatusChip>
                    ) : (
                      <StatusChip etat="attention">En cours</StatusChip>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {p.length
                      ? `${p.length} (${p.filter((y) => y.statut === 'en_attente').length} à valider)`
                      : 'Aucune'}
                  </Table.Td>
                  {modifiable && (
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        {!x.termineLe && c.statut === 'ouverte' && (
                          <Anchor
                            component="button"
                            type="button"
                            size="sm"
                            onClick={() => void agir('POST', `${base}/relances`, { utilisateur: x.id })}
                          >
                            Relancer
                          </Anchor>
                        )}
                        <ConfirmButton
                          message={`Retirer ${x.nom} du RETEX ? Ses propositions en attente seront retirées ; les éléments déjà intégrés restent.`}
                          onConfirm={async () => {
                            await agir('DELETE', `${base}/contributeurs/${x.id}`);
                          }}
                          variant="subtle"
                          size="compact-sm"
                        >
                          Retirer
                        </ConfirmButton>
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              );
            })}
            {!c.contributeurs.length && (
              <Table.Tr>
                <Table.Td colSpan={modifiable ? 6 : 5}>Aucun contributeur : vous remplissez ce RETEX seul.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </DataTable>
    </Stack>
  );
}

/* ================================================================================================ file à valider */
function FileAValider({ i, c, modifiable, agir }: { i: Incident; c: CollecteRetex; modifiable: boolean; agir: Agir }) {
  const base = urlRetex(i.id);
  const attente = c.propositions.filter((p) => p.statut === 'en_attente');
  const traitees = c.propositions.filter((p) => p.statut !== 'en_attente');
  const [corrige, setCorrige] = useState<PropositionRetex | null>(null);
  const [doublon, setDoublon] = useState<PropositionRetex | null>(null);
  const [rejet, setRejet] = useState<PropositionRetex | null>(null);
  const decider = (p: PropositionRetex, corps: unknown) =>
    agir('POST', `${base}/propositions/${encodeURIComponent(p.id)}/decision`, corps);
  const pole = (uid: string) => c.contributeurs.find((x) => x.id === uid)?.pole ?? '';
  const evenements = chronologieRetex(i.timeline);
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Chaque élément proposé par un contributeur attend votre décision avant d’entrer dans la chronologie. Le
        contributeur voit l’issue de ses propositions (intégrée, déjà connue, non retenue avec le motif).
      </Text>
      {!attente.length && (
        <Card withBorder>
          <Text c="dimmed">Rien à valider pour le moment.</Text>
        </Card>
      )}
      {attente.map((p) => (
        <Card key={p.id} withBorder className="retex-proposition">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={0}>
              <Group gap="sm">
                <Text fw={700}>{dateHeureRetex(p.ts)}</Text>
                <TypeRetex type={p.type} />
                {p.gravite && <Badge variant="light">Gravité {p.gravite.toLowerCase()}</Badge>}
              </Group>
              <Text fw={600} mt="xs">
                {p.titre}
              </Text>
              {p.description && (
                <Text size="sm" className="retex-texte-libre">
                  {p.description}
                </Text>
              )}
              <Text size="xs" c="dimmed" mt="xs">
                Proposé par {p.auteurNom}
                {pole(p.auteurId) ? ` (${pole(p.auteurId)})` : ''} le {dateCourte(p.soumisLe)}
                {p.acteur ? ` · acteur : ${p.acteur}` : ''}
              </Text>
            </Stack>
            {modifiable && (
              <Stack gap="xs" className="retex-proposition__actions">
                <Button size="xs" onClick={() => void decider(p, { decision: 'accepter' })}>
                  Accepter
                </Button>
                <Button size="xs" variant="default" onClick={() => setCorrige(p)}>
                  Corriger puis accepter
                </Button>
                <Button size="xs" variant="default" disabled={!evenements.length} onClick={() => setDoublon(p)}>
                  Déjà connu
                </Button>
                <Button size="xs" variant="subtle" color="red" onClick={() => setRejet(p)}>
                  Rejeter
                </Button>
              </Stack>
            )}
          </Group>
        </Card>
      ))}
      {traitees.length > 0 && <Text fw={600}>Déjà traitées ({traitees.length})</Text>}
      {traitees.length > 0 && (
        <DataTable label="Propositions déjà traitées">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date et heure</Table.Th>
                <Table.Th>Proposition</Table.Th>
                <Table.Th>Auteur</Table.Th>
                <Table.Th>Décision</Table.Th>
                <Table.Th>Précision</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {traitees.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{dateHeureRetex(p.ts)}</Table.Td>
                  <Table.Td>
                    <TypeRetex type={p.type} />
                    <Text size="sm">{p.titre}</Text>
                  </Table.Td>
                  <Table.Td>{p.auteurNom}</Table.Td>
                  <Table.Td>
                    <StatutPropositionChip p={p} />
                  </Table.Td>
                  <Table.Td>{p.motif || (p.evenementId ? `Événement ${p.evenementId}` : '–')}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
      <Modal
        opened={!!corrige}
        onClose={() => setCorrige(null)}
        lockScroll={false}
        size="lg"
        title="Corriger puis accepter"
      >
        {corrige && (
          <FormulaireEvenementRetex
            initial={corrige}
            libelle="Accepter avec ces corrections"
            valider={async (s) => {
              const ok = !!(await decider(corrige, { decision: 'accepter', corrections: nettoyerSaisie(s) }));
              if (ok) setCorrige(null);
              return ok;
            }}
          />
        )}
      </Modal>
      <ModalDoublon
        p={doublon}
        evenements={evenements}
        fermer={() => setDoublon(null)}
        valider={async (evenementId, motif) => !!(await decider(doublon!, { decision: 'doublon', evenementId, motif }))}
      />
      <ModalRejet
        p={rejet}
        fermer={() => setRejet(null)}
        valider={async (motif) => !!(await decider(rejet!, { decision: 'rejeter', motif }))}
      />
    </Stack>
  );
}
function ModalDoublon({
  p,
  evenements,
  fermer,
  valider,
}: {
  p: PropositionRetex | null;
  evenements: EvenementRetex[];
  fermer: () => void;
  valider: (evenementId: string, motif: string) => Promise<boolean>;
}) {
  const [cible, setCible] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  return (
    <Modal opened={!!p} onClose={fermer} lockScroll={false} title="Élément déjà connu">
      <Stack>
        <Text size="sm">
          « {p?.titre} » correspond à un événement déjà présent dans la chronologie. Il n’est pas ajouté ; le
          contributeur voit qu’il était déjà connu.
        </Text>
        <Select
          label="Événement correspondant"
          required
          searchable
          comboboxProps={{ withinPortal: true }}
          value={cible}
          onChange={setCible}
          data={evenements.map((e) => ({ value: e.id, label: `${dateHeureRetex(e.ts)} — ${e.titre}` }))}
        />
        <TextInput label="Précision (facultative)" value={motif} onChange={(e) => setMotif(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button
            disabled={!cible}
            onClick={async () => {
              if (cible && (await valider(cible, motif.trim()))) {
                setCible(null);
                setMotif('');
                fermer();
              }
            }}
          >
            Marquer comme déjà connu
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
function ModalRejet({
  p,
  fermer,
  valider,
}: {
  p: PropositionRetex | null;
  fermer: () => void;
  valider: (motif: string) => Promise<boolean>;
}) {
  const [motif, setMotif] = useState('');
  return (
    <Modal opened={!!p} onClose={fermer} lockScroll={false} title="Ne pas retenir la proposition">
      <Stack>
        <Text size="sm">Le motif est communiqué au contributeur.</Text>
        <Textarea
          label="Motif"
          required
          autosize
          minRows={2}
          value={motif}
          onChange={(e) => setMotif(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button
            color="red"
            disabled={!motif.trim()}
            onClick={async () => {
              if (await valider(motif.trim())) {
                setMotif('');
                fermer();
              }
            }}
          >
            Ne pas retenir
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/* ================================================================================================ récupération */
interface Candidat extends SaisieRetex {
  source: string;
  origine: string;
}
/** Type d'événement proposé pour une entrée de main courante. */
const TYPE_DEPUIS_CRISE: Record<string, string> = {
  Information: 'Analyse',
  'Point de situation': 'Analyse',
  Décision: 'Décision',
  Action: 'Autre',
  Communication: 'Communication',
};
/** Éléments datés de la fiche de l'incident : détection, obligations traitées, résolution. */
function candidatsFiche(i: Incident, categorie: string): Candidat[] {
  const l: Candidat[] = [];
  if (i.detectedAt)
    l.push({
      ...saisieVide(i.detectedAt, 'Détection'),
      titre: `Détection : ${i.title || 'incident'}`.slice(0, 300),
      acteur: i.reporter,
      source: 'incident:detection',
      origine: 'Date de détection',
    });
  obligationsIncident(i.answers, i.kind, categorie).forEach(([titre], k) => {
    const t = i.notified[String(k)];
    if (t)
      l.push({
        ...saisieVide(isoVersLocal(t), 'Communication'),
        titre: `Obligation traitée : ${titre}`,
        source: `incident:obligation:${k}`,
        origine: 'Obligation cochée',
      });
  });
  if (i.resolvedAt)
    l.push({
      ...saisieVide(i.resolvedAt, 'Rétablissement'),
      titre: 'Résolution de l’incident',
      description: i.actions.slice(0, 5000),
      acteur: i.owner,
      source: 'incident:resolution',
      origine: 'Date de résolution',
    });
  return l.filter((x) => x.ts);
}

function Recuperation({ i, agir }: { i: Incident; agir: Agir }) {
  const d = useModule<Donnees>('incidents', '/api/incidents').d;
  const crise = useQuery({
    queryKey: ['crise'],
    queryFn: () => get<{ etat: EtatCrise }>('/api/crise'),
  });
  const [cellule, setCellule] = useState<string | null>(null);
  const deja = useMemo(() => new Set(i.timeline.map((e) => e.source).filter(Boolean)), [i.timeline]);
  const fiche = candidatsFiche(i, d?.categorieEntite ?? '');
  const cel = crise.data?.etat.cells.find((x) => x.id === cellule);
  const mainCourante: Candidat[] = (cel?.log ?? []).map((l, k) => {
    const texte = l.text.trim();
    const titre = texte.split('\n')[0]!.slice(0, 120);
    return {
      ...saisieVide(isoVersLocal(l.ts), TYPE_DEPUIS_CRISE[l.type] ?? 'Autre'),
      titre: titre || l.type,
      description: texte.length > titre.length ? texte.slice(0, 5000) : '',
      acteur: l.author,
      source: `crise:${cel!.id}:${k}`,
      origine: `Main courante (${l.type})`,
    };
  });
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Récupérez des éléments déjà datés ailleurs dans l’application. Cochez ce qui doit entrer dans la chronologie et
        ajustez le type si besoin ; un élément déjà importé n’est pas proposé deux fois.
      </Text>
      <Card withBorder>
        <Text fw={600}>Fiche de l’incident</Text>
        <Text size="sm" c="dimmed" mb="sm">
          Détection, obligations cochées et résolution renseignées dans le registre des incidents.
        </Text>
        <TableauImport
          candidats={fiche}
          deja={deja}
          vide="Aucun élément daté dans la fiche."
          importer={(lot) => agir('POST', `${urlRetex(i.id)}/import`, { evenements: lot })}
        />
      </Card>
      <Card withBorder>
        <Text fw={600}>Main courante de crise</Text>
        <Text size="sm" c="dimmed" mb="sm">
          Entrées horodatées d’une cellule de crise (réelle ou exercice).
        </Text>
        <Select
          label="Cellule de crise"
          placeholder={crise.data?.etat.cells.length ? 'Choisir une cellule' : 'Aucune cellule de crise'}
          comboboxProps={{ withinPortal: true }}
          disabled={!crise.data?.etat.cells.length}
          value={cellule}
          onChange={setCellule}
          data={(crise.data?.etat.cells ?? []).map((x) => ({
            value: x.id,
            label: `${x.title || x.id} (${x.mode}, ${x.log.length} entrées)`,
          }))}
          mb="sm"
        />
        {cel && (
          <TableauImport
            key={cel.id}
            candidats={mainCourante}
            deja={deja}
            vide="Main courante vide."
            importer={(lot) => agir('POST', `${urlRetex(i.id)}/import`, { evenements: lot })}
          />
        )}
      </Card>
    </Stack>
  );
}

function TableauImport({
  candidats,
  deja,
  vide,
  importer,
}: {
  candidats: Candidat[];
  deja: Set<string>;
  vide: string;
  importer: (lot: unknown[]) => Promise<unknown>;
}) {
  const [coches, setCoches] = useState<Set<string>>(
    () => new Set(candidats.filter((x) => !deja.has(x.source)).map((x) => x.source)),
  );
  const [types, setTypes] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const choisis = candidats.filter((x) => coches.has(x.source) && !deja.has(x.source));
  if (!candidats.length) return <Text c="dimmed">{vide}</Text>;
  return (
    <Stack gap="sm">
      <DataTable label="Éléments récupérables">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th />
              <Table.Th>Date et heure</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Élément</Table.Th>
              <Table.Th>Origine</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {candidats.map((x) => {
              const importe = deja.has(x.source);
              return (
                <Table.Tr key={x.source} data-importe={importe ? 'oui' : 'non'}>
                  <Table.Td>
                    <Checkbox
                      aria-label={`Importer ${x.titre}`}
                      disabled={importe}
                      checked={importe || coches.has(x.source)}
                      onChange={(e) => {
                        const n = new Set(coches);
                        if (e.currentTarget.checked) n.add(x.source);
                        else n.delete(x.source);
                        setCoches(n);
                      }}
                    />
                  </Table.Td>
                  <Table.Td>{dateHeureRetex(x.ts)}</Table.Td>
                  <Table.Td>
                    {importe ? (
                      <TypeRetex type={x.type} />
                    ) : (
                      <Select
                        aria-label="Type d’événement"
                        size="xs"
                        allowDeselect={false}
                        comboboxProps={{ withinPortal: true }}
                        data={[...TYPES_EVENEMENT_RETEX]}
                        value={types[x.source] ?? x.type}
                        onChange={(v) => setTypes({ ...types, [x.source]: v ?? x.type })}
                      />
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{x.titre}</Text>
                    {x.acteur && (
                      <Text size="xs" c="dimmed">
                        {x.acteur}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">{importe ? 'Déjà dans la chronologie' : x.origine}</Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </DataTable>
      <Group justify="flex-end">
        <Button
          disabled={!choisis.length}
          loading={envoi}
          onClick={async () => {
            setEnvoi(true);
            try {
              await importer(
                choisis.map(({ origine: _o, ...x }) => ({
                  ...nettoyerSaisie(x),
                  type: types[x.source] ?? x.type,
                  source: x.source,
                })),
              );
            } finally {
              setEnvoi(false);
            }
          }}
        >
          Ajouter à la chronologie ({choisis.length})
        </Button>
      </Group>
    </Stack>
  );
}

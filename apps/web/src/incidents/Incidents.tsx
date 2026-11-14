/* Registre des incidents (reprise des pages « Incidents » de l'outil de suivi) et fiche d'un incident à onglets
   (ADR 0091) : « Fiche », « Qualification guidée » (questionnaire oui / non / je ne sais pas, qualification proposée,
   obligations) et « Chronologie et RETEX ». Priorité ITIL impact × urgence, action du registre des écarts.
   Données lues et écrites dans l'état historique (clé `incidents`), sous verrou. */
import {
  Anchor,
  Button,
  Checkbox,
  Group,
  Select,
  SegmentedControl,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  CATEGORIES_INCIDENT,
  NIVEAUX_INCIDENT,
  QUALIFICATIONS_INCIDENT,
  STATUTS_INCIDENT,
  filtrerIncidents,
  incidentOuvert,
  obligationsIncident,
  prioriteIncident,
  syntheseIncidents,
  type FiltreIncidents,
  type Incident,
} from '@suivi/shared';
import { ConfirmButton, DataTable, StatusChip } from '@suivi/ui';
import { ErrorAlert } from '../components/common';
import { ficheCliquable } from '../fiche-cliquable';
import { ChampChoix, ChampTexte, ChampZone, useModule } from '../historique/champs';
import { Chiffres } from '../historique/graphiques';
import { useCan } from '../session';
import type { Agir, Donnees } from './donnees';
import { FILTRES_RETEX, etatRetexIncident, type CleEtatRetex } from './etat-retex';
import { ETAT_QUALIFICATION } from './qualification';
import { QualificationGuidee } from './QualificationGuidee';
import { RetexIncident } from './Retex';

type Onglet = 'fiche' | 'qualification' | 'retex';
const ONGLETS: Onglet[] = ['fiche', 'qualification', 'retex'];
const dateFr = (t: string) => (t ? `${t.slice(0, 10).split('-').reverse().join('/')} ${t.slice(11, 16)}` : '');
const Qualification = ({ k }: { k: string }) => <StatusChip etat={ETAT_QUALIFICATION[k] ?? 'neutre'}>{k}</StatusChip>;

/** `smsi` : périmètre affiché ; le registre n'en montre que les incidents et y crée les nouveaux (BUG-044). */
export function RegistreIncidents({ smsi }: { smsi?: string }) {
  const can = useCan(),
    modifiable = can('incidents', 'modifier'),
    [params, setParams] = useSearchParams(),
    { d, agir, erreur } = useModule<Donnees>(
      `incidents:${smsi ?? ''}`,
      smsi ? `/api/incidents?smsi=${smsi}` : '/api/incidents',
    ),
    [filtre, setFiltre] = useState<FiltreIncidents>('open'),
    [filtreRetex, setFiltreRetex] = useState<'tous' | CleEtatRetex>('tous');
  const ouverte = d?.incidents.find((i) => i.id === params.get('incident')) ?? null;
  const ouvrir = (id: string | null) => setParams(id ? { incident: id } : {});
  const liste = (d ? filtrerIncidents(d.incidents, filtre) : []).filter(
    (i) => filtreRetex === 'tous' || etatRetexIncident(i).cle === filtreRetex,
  );
  const s = d ? syntheseIncidents(d.incidents) : null;
  if (ouverte && d)
    return (
      <Stack>
        <ErrorAlert error={erreur} />
        <FicheIncident
          key={ouverte.id}
          i={ouverte}
          d={d}
          modifiable={modifiable}
          agir={agir}
          retour={() => ouvrir(null)}
        />
      </Stack>
    );
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Registre des incidents</Text>
          <Text size="sm" c="dimmed">
            Incidents, événements et demandes. Ouvrez la fiche d’un incident pour le qualifier (qualification guidée),
            suivre ses obligations et conduire son retour d’expérience (chronologie et RETEX). La priorité suit la
            matrice ITIL impact × urgence. Les chiffres alimentent la revue de direction (entrée d 2), le tableau de
            bord et le rapport de pilotage du périmètre.
          </Text>
        </div>
        {modifiable && (
          <Button
            onClick={async () => {
              const i = await agir<Incident>('POST', '/api/incidents', smsi ? { smsi } : {});
              if (i) ouvrir(i.id);
            }}
          >
            Nouvel incident
          </Button>
        )}
      </Group>
      {s && (
        <Chiffres
          items={[
            { valeur: s.ouverts, libelle: 'ouverts' },
            { valeur: s.securiteOuverts, libelle: 'incidents de sécurité ouverts' },
            { valeur: s.clos, libelle: 'résolus ou clos' },
            { valeur: s.total, libelle: 'au total' },
          ]}
        />
      )}
      <Group align="flex-end" justify="space-between">
        <SegmentedControl
          aria-label="Filtre du registre"
          value={filtre}
          onChange={(v) => setFiltre(v as FiltreIncidents)}
          data={[
            { value: 'open', label: 'Ouverts' },
            { value: 'sec', label: 'Incidents de sécurité' },
            { value: 'Incident', label: 'Incidents' },
            { value: 'Événement de sécurité', label: 'Événements de sécurité' },
            { value: 'Demande', label: 'Demandes' },
            { value: 'all', label: 'Tous' },
          ]}
        />
        <Select
          label="RETEX"
          allowDeselect={false}
          data={FILTRES_RETEX}
          value={filtreRetex}
          onChange={(v) => setFiltreRetex((v as 'tous' | CleEtatRetex | null) ?? 'tous')}
        />
      </Group>
      <DataTable label="Registre des incidents">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Réf.</Table.Th>
              <Table.Th>Détection</Table.Th>
              <Table.Th>Qualification</Table.Th>
              <Table.Th>Intitulé</Table.Th>
              <Table.Th>Priorité</Table.Th>
              <Table.Th>Statut</Table.Th>
              <Table.Th>RETEX</Table.Th>
              <Table.Th>Responsable</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {liste.map((i) => {
              const retex = etatRetexIncident(i);
              return (
                <Table.Tr key={i.id} {...ficheCliquable(() => ouvrir(i.id), `Afficher l’incident ${i.id}`)}>
                  <Table.Td>
                    <Anchor component="button" type="button" fw={600} onClick={() => ouvrir(i.id)}>
                      {i.id}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>{dateFr(i.detectedAt)}</Table.Td>
                  <Table.Td>
                    <Qualification k={i.kind} />
                  </Table.Td>
                  <Table.Td>
                    {i.title || '(sans titre)'}
                    <Text size="xs" c="dimmed">
                      {i.cat}
                    </Text>
                  </Table.Td>
                  <Table.Td>{prioriteIncident(i.impact, i.urgency) || '–'}</Table.Td>
                  <Table.Td>
                    <StatusChip etat={incidentOuvert(i) ? 'attention' : 'succes'}>{i.status}</StatusChip>
                  </Table.Td>
                  <Table.Td>
                    <StatusChip etat={retex.ton}>{retex.libelle}</StatusChip>
                    {retex.enAttente > 0 && (
                      <Text size="xs" c="dimmed">
                        {retex.enAttente} à valider
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{i.owner || '–'}</Table.Td>
                </Table.Tr>
              );
            })}
            {!liste.length && (
              <Table.Tr>
                <Table.Td colSpan={8}>Aucun élément.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </DataTable>
    </Stack>
  );
}

/* ------------------------------------------------------------------------------------------ fiche à onglets */
function FicheIncident({
  i,
  d,
  modifiable,
  agir,
  retour,
}: {
  i: Incident;
  d: Donnees;
  modifiable: boolean;
  agir: Agir;
  retour: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const can = useCan();
  const onglet: Onglet = ONGLETS.includes(params.get('onglet') as Onglet) ? (params.get('onglet') as Onglet) : 'fiche';
  const allerA = (o: string | null) =>
    setParams(o && o !== 'fiche' ? { incident: i.id, onglet: o } : { incident: i.id }, { replace: true });
  const retex = etatRetexIncident(i);
  return (
    <Stack>
      <div>
        <Anchor component="button" type="button" size="sm" onClick={retour}>
          ← Registre des incidents
        </Anchor>
      </div>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2} size="h3">
            {i.id} — {i.title || '(sans titre)'}
          </Title>
          <Group gap="xs" mt="xs">
            <Qualification k={i.kind} />
            <StatusChip etat={incidentOuvert(i) ? 'attention' : 'succes'}>{i.status}</StatusChip>
            <StatusChip etat={retex.ton}>{`RETEX : ${retex.libelle.toLowerCase()}`}</StatusChip>
            <Text size="sm" c="dimmed">
              Créé le {dateFr(i.detectedAt)}
            </Text>
          </Group>
        </div>
        {modifiable && can('incidents', 'supprimer') && (
          <ConfirmButton
            message={`Supprimer ${i.id} ?`}
            onConfirm={async () => {
              await agir('DELETE', `/api/incidents/${encodeURIComponent(i.id)}`);
              retour();
            }}
            variant="light"
          >
            Supprimer
          </ConfirmButton>
        )}
      </Group>
      <Tabs value={onglet} onChange={allerA} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="fiche">Fiche</Tabs.Tab>
          <Tabs.Tab value="qualification">Qualification guidée</Tabs.Tab>
          <Tabs.Tab value="retex">Chronologie et RETEX</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="fiche" pt="md">
          <ContenuFiche i={i} d={d} modifiable={modifiable} agir={agir} />
        </Tabs.Panel>
        <Tabs.Panel value="qualification" pt="md">
          <QualificationGuidee i={i} categorieEntite={d.categorieEntite} modifiable={modifiable} agir={agir} />
        </Tabs.Panel>
        <Tabs.Panel value="retex" pt="md">
          <RetexIncident incident={i} modifiable={modifiable} agir={agir} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function ContenuFiche({ i, d, modifiable, agir }: { i: Incident; d: Donnees; modifiable: boolean; agir: Agir }) {
  const obligations = obligationsIncident(i.answers, i.kind, d.categorieEntite);
  const can = useCan();
  const maj = (champ: Record<string, unknown>) =>
    void agir('PATCH', `/api/incidents/${encodeURIComponent(i.id)}`, champ);
  return (
    <Stack>
      <ChampTexte label="Intitulé" value={i.title} disabled={!modifiable} onCommit={(v) => maj({ title: v })} />
      <div className="grille-formulaire">
        <div className="grille-formulaire__champs">
          <ChampTexte
            label="Détecté le"
            type="datetime-local"
            value={i.detectedAt}
            disabled={!modifiable}
            onCommit={(v) => maj({ detectedAt: v })}
          />
          <ChampTexte
            label="Signalé par"
            value={i.reporter}
            disabled={!modifiable}
            onCommit={(v) => maj({ reporter: v })}
          />
          <ChampTexte label="Responsable" value={i.owner} disabled={!modifiable} onCommit={(v) => maj({ owner: v })} />
          <ChampChoix
            label="Qualification"
            value={i.kind}
            options={QUALIFICATIONS_INCIDENT}
            disabled={!modifiable}
            onCommit={(v) => maj({ kind: v })}
          />
          <ChampChoix
            label="Catégorie"
            value={i.cat}
            options={CATEGORIES_INCIDENT}
            disabled={!modifiable}
            onCommit={(v) => maj({ cat: v })}
          />
          <ChampChoix
            label="Statut"
            value={i.status}
            options={STATUTS_INCIDENT}
            disabled={!modifiable}
            onCommit={(v) => maj({ status: v })}
          />
          <ChampChoix
            label="Impact"
            value={i.impact}
            options={NIVEAUX_INCIDENT}
            effacable
            disabled={!modifiable}
            onCommit={(v) => maj({ impact: v })}
          />
          <ChampChoix
            label="Urgence"
            value={i.urgency}
            options={NIVEAUX_INCIDENT}
            effacable
            disabled={!modifiable}
            onCommit={(v) => maj({ urgency: v })}
          />
          <div>
            <Text size="sm" fw={500}>
              Priorité
            </Text>
            <Text fw={700}>{prioriteIncident(i.impact, i.urgency) || 'Impact et urgence à renseigner'}</Text>
          </div>
          <ChampTexte
            label="Résolu le"
            type="datetime-local"
            value={i.resolvedAt}
            disabled={!modifiable}
            onCommit={(v) => maj({ resolvedAt: v })}
          />
        </div>
      </div>
      <ChampZone
        label="Description"
        lignes={3}
        value={i.desc}
        disabled={!modifiable}
        onCommit={(v) => maj({ desc: v })}
      />
      <ChampZone
        label="Actions menées"
        lignes={3}
        value={i.actions}
        disabled={!modifiable}
        onCommit={(v) => maj({ actions: v })}
      />
      <ChampZone label="Cause" value={i.cause} disabled={!modifiable} onCommit={(v) => maj({ cause: v })} />
      <ChampZone
        label="Retour d’expérience"
        value={i.retex}
        disabled={!modifiable}
        onCommit={(v) => maj({ retex: v })}
      />
      {obligations.length > 0 && (
        <Stack gap="xs">
          <Text fw={600}>Obligations à vérifier</Text>
          {obligations.map(([titre, detail], k) => (
            <Checkbox
              key={titre}
              checked={!!i.notified[String(k)]}
              disabled={!modifiable}
              label={
                <span>
                  <b>{titre}</b> : {detail}
                  {i.notified[String(k)] ? ` (traité le ${dateFr(i.notified[String(k)]!)})` : ''}
                </span>
              }
              onChange={(ev) =>
                void agir('PUT', `/api/incidents/${encodeURIComponent(i.id)}/obligations/${k}`, {
                  traitee: ev.currentTarget.checked,
                })
              }
            />
          ))}
        </Stack>
      )}
      {i.findingId ? (
        <Text size="sm">
          Action {i.findingId} ({(d.ecarts[i.findingId] ?? '').toLowerCase() || 'registre des écarts'})
        </Text>
      ) : (
        modifiable &&
        can('ecarts', 'modifier') && (
          <div>
            <Button
              variant="default"
              onClick={() => void agir('POST', `/api/incidents/${encodeURIComponent(i.id)}/action`)}
            >
              Créer une action dans le registre des écarts
            </Button>
          </div>
        )
      )}
    </Stack>
  );
}

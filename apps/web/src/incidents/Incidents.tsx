/* Registre des incidents et qualification d'un signalement (reprise des pages « Incidents » de l'outil de suivi) :
   questionnaire de qualification, obligations à vérifier, priorité ITIL impact × urgence, action du registre des écarts.
   Données lues et écrites dans l'état historique (clé `incidents`), sous verrou. */
import {
  Anchor,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  CATEGORIES_INCIDENT,
  NIVEAUX_INCIDENT,
  QUALIFICATIONS_INCIDENT,
  QUESTIONS_INCIDENT,
  STATUTS_INCIDENT,
  filtrerIncidents,
  incidentOuvert,
  obligationsIncident,
  prioriteIncident,
  qualifierIncident,
  syntheseIncidents,
  type FiltreIncidents,
  type Incident,
  type Reponses,
} from '@suivi/shared';
import { ConfirmButton, DataTable, StatusChip, type Etat } from '@suivi/ui';
import { ErrorAlert } from '../components/common';
import { ChampChoix, ChampTexte, ChampZone, useModule } from '../historique/champs';
import { Chiffres } from '../historique/graphiques';
import { useCan } from '../session';

interface Donnees {
  version: number;
  incidents: Incident[];
  categorieEntite: string;
  ecarts: Record<string, string>;
}
const ETAT_KIND: Record<string, Etat> = {
  'Incident de sécurité': 'erreur',
  Incident: 'attention',
  'Événement de sécurité': 'info',
  Événement: 'neutre',
  Demande: 'neutre',
};
const dateFr = (t: string) => (t ? `${t.slice(0, 10).split('-').reverse().join('/')} ${t.slice(11, 16)}` : '');
const Qualification = ({ k }: { k: string }) => <StatusChip etat={ETAT_KIND[k] ?? 'neutre'}>{k}</StatusChip>;

export function RegistreIncidents() {
  const can = useCan(),
    modifiable = can('incidents', 'modifier'),
    navigate = useNavigate(),
    [params, setParams] = useSearchParams(),
    { d, agir, erreur } = useModule<Donnees>('incidents', '/api/incidents'),
    [filtre, setFiltre] = useState<FiltreIncidents>('open');
  const ouverte = d?.incidents.find((i) => i.id === params.get('incident')) ?? null;
  const ouvrir = (id: string | null) => setParams(id ? { incident: id } : {}, { replace: true });
  const liste = d ? filtrerIncidents(d.incidents, filtre) : [];
  const s = d ? syntheseIncidents(d.incidents) : null;
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Registre des incidents</Text>
          <Text size="sm" c="dimmed">
            Incidents, événements et demandes qualifiés. La priorité suit la matrice ITIL impact × urgence. Les chiffres
            alimentent la diapositive « Revue des incidents » du COPIL sécurité.
          </Text>
        </div>
        {modifiable && (
          <Group>
            <Button variant="default" onClick={() => void navigate('/pilotage/incidents-qualifier')}>
              Qualifier un signalement
            </Button>
            <Button
              onClick={async () => {
                const i = await agir<Incident>('POST', '/api/incidents', {});
                if (i) ouvrir(i.id);
              }}
            >
              Saisir directement
            </Button>
          </Group>
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
              <Table.Th>Responsable</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {liste.map((i) => (
              <Table.Tr key={i.id}>
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
                <Table.Td>{i.owner || '–'}</Table.Td>
              </Table.Tr>
            ))}
            {!liste.length && (
              <Table.Tr>
                <Table.Td colSpan={7}>Aucun élément.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </DataTable>
      <Modal
        opened={!!ouverte}
        onClose={() => ouvrir(null)}
        lockScroll={false}
        size="xl"
        title={ouverte ? ouverte.id : ''}
      >
        {ouverte && d && (
          <FicheIncident
            i={ouverte}
            d={d}
            modifiable={modifiable}
            maj={(champ) => void agir('PATCH', `/api/incidents/${encodeURIComponent(ouverte.id)}`, champ)}
            agir={agir}
            fermer={() => ouvrir(null)}
          />
        )}
      </Modal>
    </Stack>
  );
}

function FicheIncident({
  i,
  d,
  modifiable,
  maj,
  agir,
  fermer,
}: {
  i: Incident;
  d: Donnees;
  modifiable: boolean;
  maj: (c: Record<string, unknown>) => void;
  agir: <R = unknown>(m: string, c: string, b?: unknown) => Promise<R | undefined>;
  fermer: () => void;
}) {
  const obligations = obligationsIncident(i.answers, i.kind, d.categorieEntite);
  const can = useCan();
  return (
    <Stack key={i.id}>
      <Group>
        <Qualification k={i.kind} />
        <Text size="sm" c="dimmed">
          Créé le {dateFr(i.detectedAt)}
        </Text>
      </Group>
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
      {modifiable && (
        <Group justify="flex-end">
          <ConfirmButton
            message={`Supprimer ${i.id} ?`}
            onConfirm={async () => {
              await agir('DELETE', `/api/incidents/${encodeURIComponent(i.id)}`);
              fermer();
            }}
            variant="light"
          >
            Supprimer
          </ConfirmButton>
        </Group>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------------------------ qualifier un signalement */
export function QualifierSignalement() {
  const can = useCan(),
    navigate = useNavigate(),
    { d, agir, erreur } = useModule<Donnees>('incidents', '/api/incidents'),
    [reponses, setReponses] = useState<Reponses>({}),
    [titre, setTitre] = useState(''),
    [signale, setSignale] = useState('');
  const res = qualifierIncident(reponses);
  const renseignees = QUESTIONS_INCIDENT.filter(([k]) => reponses[k]).length;
  const ob = obligationsIncident(reponses, res.kind, d?.categorieEntite ?? '');
  const repondre = (k: (typeof QUESTIONS_INCIDENT)[number][0], v: 'oui' | 'non' | 'nsp') => {
    const suivant = { ...reponses };
    if (suivant[k] === v) delete suivant[k];
    else suivant[k] = v;
    setReponses(suivant);
  };
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <div>
        <Text fw={600}>Qualifier un signalement</Text>
        <Text size="sm" c="dimmed">
          Répondez aux questions : l’outil indique s’il s’agit d’un incident de sécurité, d’un incident, d’un événement
          ou d’une demande, puis crée la fiche dans le registre.
        </Text>
      </div>
      <Group align="flex-start" grow>
        <Stack>
          <TextInput
            label="Intitulé du signalement"
            placeholder="ex. Courriel suspect reçu par la comptabilité"
            value={titre}
            onChange={(e) => setTitre(e.currentTarget.value)}
          />
          <TextInput label="Signalé par" value={signale} onChange={(e) => setSignale(e.currentTarget.value)} />
          {QUESTIONS_INCIDENT.map(([k, q]) => (
            <Card key={k} withBorder padding="sm">
              <Text size="sm" id={`question-${k}`}>
                {q}
              </Text>
              <div role="group" aria-labelledby={`question-${k}`}>
                <Group gap="xs" mt="xs">
                  {(
                    [
                      ['oui', 'Oui'],
                      ['non', 'Non'],
                      ['nsp', 'Je ne sais pas'],
                    ] as const
                  ).map(([v, l]) => (
                    <Button
                      key={v}
                      size="compact-sm"
                      variant={reponses[k] === v ? 'filled' : 'default'}
                      aria-pressed={reponses[k] === v}
                      onClick={() => repondre(k, v)}
                    >
                      {l}
                    </Button>
                  ))}
                </Group>
              </div>
            </Card>
          ))}
          <Text size="sm" c="dimmed">
            « Je ne sais pas » est traité comme « non » pour la qualification ; à réévaluer dès que l’information est
            connue.
          </Text>
        </Stack>
        <Stack>
          <Text fw={600}>Résultat</Text>
          <Card withBorder>
            <Qualification k={res.kind} />
            <Text size="sm" mt="xs">
              {res.why}
            </Text>
          </Card>
          <Text size="sm" c="dimmed">
            {renseignees}/{QUESTIONS_INCIDENT.length} questions renseignées.
          </Text>
          {ob.length > 0 && (
            <>
              <Text fw={600}>À vérifier</Text>
              <ul>
                {ob.map(([t, detail]) => (
                  <li key={t}>
                    <b>{t}</b> : {detail}
                  </li>
                ))}
              </ul>
            </>
          )}
          {can('incidents', 'modifier') && (
            <Group>
              <Button
                onClick={async () => {
                  const i = await agir<Incident>('POST', '/api/incidents', {
                    title: titre,
                    reporter: signale,
                    answers: reponses,
                  });
                  if (i) void navigate(`/pilotage/incidents-registre?incident=${encodeURIComponent(i.id)}`);
                }}
              >
                Créer la fiche dans le registre
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  setReponses({});
                  setTitre('');
                  setSignale('');
                }}
              >
                Recommencer
              </Button>
            </Group>
          )}
        </Stack>
      </Group>
    </Stack>
  );
}

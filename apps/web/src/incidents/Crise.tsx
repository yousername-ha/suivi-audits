/* Cellule de crise (reprise des pages « Cellule de crise », « Contacts » et « Scénarios » de l'outil de suivi) :
   main courante horodatée, temps écoulé et échéances, check-list du scénario, contacts de crise et scénarios.
   Données lues et écrites dans l'état historique (clé `crisis`), sous verrou. L'export Excel de la main courante et
   l'import des scénarios depuis Excel ne sont pas repris. */
import {
  Anchor,
  Button,
  Card,
  Checkbox,
  Group,
  Radio,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import {
  ECHEANCES_RAPIDES,
  PHASES_CRISE,
  TYPES_ENTREE_CRISE,
  avancementChecklist,
  celluleActive,
  ecartMainCourante,
  formaterDateHeure,
  formaterDureeCrise,
  resteEcheance,
  type CelluleCrise,
  type EtatCrise,
  type ScenarioCrise,
} from '@suivi/shared';
import { ConfirmButton, DataTable, StatusChip } from '@suivi/ui';
import { ErrorAlert } from '../components/common';
import { ChampChoix, ChampTexte, ChampZone, useModule } from '../historique/champs';
import { Chiffres } from '../historique/graphiques';
import { useCan } from '../session';

interface Donnees {
  version: number;
  etat: EtatCrise;
  exercices: { id: string; title: string }[];
  fournisseursCritiques: string[];
}
type Agir = <R = unknown>(m: string, c: string, b?: unknown) => Promise<R | undefined>;
const useCrise = () => useModule<Donnees>('crise', '/api/crise');

/** Horloge d'une seconde, pour le temps écoulé et les échéances d'une cellule active. */
function useMaintenant(actif: boolean) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    if (!actif) return;
    const id = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(id);
  }, [actif]);
  return t;
}
const Mode = ({ mode }: { mode: string }) => (
  <StatusChip etat={mode === 'Réel' ? 'erreur' : 'info'}>{mode === 'Réel' ? 'CRISE RÉELLE' : 'EXERCICE'}</StatusChip>
);

/* ------------------------------------------------------------------------------------------------- cellules */
export function CelluleCriseVue() {
  const can = useCan(),
    modifiable = can('incidents', 'modifier'),
    { d, agir, erreur } = useCrise(),
    [sel, setSel] = useState<string | null>(null);
  const etat = d?.etat;
  const active = etat ? celluleActive(etat) : undefined;
  const cellule = etat?.cells.find((c) => c.id === sel) ?? (sel === '__liste' ? undefined : active);
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      {d && etat && !cellule && (
        <OuvertureCellule
          d={d}
          agir={agir}
          modifiable={modifiable}
          avertir={!!active}
          onOuverte={setSel}
          onSelect={setSel}
        />
      )}
      {d && etat && cellule && (
        <DetailCellule
          cellule={cellule}
          etat={etat}
          agir={agir}
          modifiable={modifiable}
          onListe={() => setSel('__liste')}
          plusieurs={etat.cells.length > 1 || cellule.status !== 'Active'}
        />
      )}
    </Stack>
  );
}

function OuvertureCellule({
  d,
  agir,
  modifiable,
  avertir,
  onOuverte,
  onSelect,
}: {
  d: Donnees;
  agir: Agir;
  modifiable: boolean;
  avertir: boolean;
  onOuverte: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const [mode, setMode] = useState('Exercice'),
    [titre, setTitre] = useState(''),
    [scenario, setScenario] = useState<string | null>(null),
    [plan, setPlan] = useState<string | null>(null);
  const ouvrir = async () => {
    const r = await agir<{ id: string }>('POST', '/api/crise/cellules', {
      mode,
      title: titre,
      scenario: scenario ?? '',
      plan: plan ?? '',
    });
    if (r) onOuverte(r.id);
  };
  const historique = [...d.etat.cells].sort((a, b) => b.start.localeCompare(a.start));
  return (
    <>
      <div>
        <Text fw={600}>Cellule de crise</Text>
        <Text size="sm" c="dimmed">
          Ouvrez une cellule pour tenir la main courante horodatée, suivre le temps écoulé et les échéances, cocher la
          check-list du scénario et joindre les contacts. Le mode « Exercice » permet de s’entraîner sans confusion avec
          une crise réelle.
        </Text>
      </div>
      {modifiable && (
        <Card withBorder>
          <Stack>
            <Radio.Group label="Type de cellule" value={mode} onChange={setMode}>
              <Stack gap="xs" mt="xs">
                <Radio
                  value="Exercice"
                  label="Exercice — entraînement : la main courante et les échéances sont marquées « exercice ». La clôture peut valider un exercice planifié."
                />
                <Radio
                  value="Réel"
                  label="Crise réelle — situation avérée : bandeau rouge sur le tableau de bord et dans le menu jusqu’à la clôture."
                />
              </Stack>
            </Radio.Group>
            <div className="grille-formulaire">
              <div className="grille-formulaire__champs">
                <TextInput
                  label="Intitulé"
                  placeholder="ex. Indisponibilité de la messagerie"
                  value={titre}
                  onChange={(e) => setTitre(e.currentTarget.value)}
                />
                <Select
                  label="Scénario"
                  placeholder="Sans scénario"
                  clearable
                  data={d.etat.scenarios.map((s) => ({ value: s.id, label: s.title }))}
                  value={scenario}
                  onChange={setScenario}
                />
                <Select
                  label="Exercice planifié lié"
                  placeholder="–"
                  clearable
                  data={d.exercices.map((p) => ({ value: p.id, label: `${p.id} ${p.title}` }))}
                  value={plan}
                  onChange={setPlan}
                />
              </div>
            </div>
            <div>
              {mode === 'Réel' || avertir ? (
                <ConfirmButton
                  color="blue"
                  message={
                    mode === 'Réel'
                      ? `Déclencher une cellule de CRISE RÉELLE ?${avertir ? ' Une cellule est déjà ouverte.' : ''}`
                      : 'Une cellule est déjà ouverte. En ouvrir une autre ?'
                  }
                  onConfirm={ouvrir}
                >
                  Ouvrir la cellule de crise
                </ConfirmButton>
              ) : (
                <Button onClick={() => void ouvrir()}>Ouvrir la cellule de crise</Button>
              )}
            </div>
          </Stack>
        </Card>
      )}
      {historique.length > 0 && (
        <>
          <Text fw={600}>Cellules précédentes</Text>
          <DataTable label="Cellules précédentes">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Intitulé</Table.Th>
                  <Table.Th>Mode</Table.Th>
                  <Table.Th>Ouverture</Table.Th>
                  <Table.Th>Clôture</Table.Th>
                  <Table.Th>Entrées</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {historique.map((h) => (
                  <Table.Tr key={h.id}>
                    <Table.Td>
                      <Anchor component="button" type="button" fw={600} onClick={() => onSelect(h.id)}>
                        {h.title}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>{h.mode}</Table.Td>
                    <Table.Td>{formaterDateHeure(h.start)}</Table.Td>
                    <Table.Td>{h.end ? formaterDateHeure(h.end) : '–'}</Table.Td>
                    <Table.Td>{h.log.length}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </DataTable>
        </>
      )}
    </>
  );
}

function DetailCellule({
  cellule: c,
  etat,
  agir,
  modifiable,
  onListe,
  plusieurs,
}: {
  cellule: CelluleCrise;
  etat: EtatCrise;
  agir: Agir;
  modifiable: boolean;
  onListe: () => void;
  plusieurs: boolean;
}) {
  const actif = c.status === 'Active',
    edition = actif && modifiable,
    maintenant = useMaintenant(actif),
    sc = etat.scenarios.find((s) => s.id === c.scenario),
    avancement = avancementChecklist(c, sc),
    derniere = c.log[c.log.length - 1],
    [type, setType] = useState<string>('Information'),
    [auteur, setAuteur] = useState(''),
    [texte, setTexte] = useState(''),
    [echeance, setEcheance] = useState({ label: '', heures: '' });
  const base = `/api/crise/cellules/${encodeURIComponent(c.id)}`;
  const ajouter = async () => {
    if (!texte.trim()) return;
    if (await agir('POST', `${base}/entrees`, { type, author: auteur, text: texte.trim() })) setTexte('');
  };
  const contacts = [...etat.contacts.filter((x) => x.key), ...etat.contacts.filter((x) => !x.key)].slice(0, 12);
  return (
    <>
      <Group justify="space-between" align="flex-start">
        <div>
          <Group>
            <Text fw={700} size="lg">
              {c.title}
            </Text>
            <Mode mode={c.mode} />
          </Group>
          <Text size="sm" c="dimmed">
            {sc ? `Scénario : ${sc.title} — ` : ''}ouverte le {formaterDateHeure(c.start)}
            {c.end ? `, clôturée le ${formaterDateHeure(c.end)}` : ''}
          </Text>
        </div>
        <Group>
          {plusieurs && (
            <Button variant="default" onClick={onListe}>
              Toutes les cellules
            </Button>
          )}
          {edition && (
            <>
              <ConfirmButton
                color="blue"
                variant="default"
                message={
                  c.mode === 'Réel'
                    ? 'Repasser cette cellule en exercice ?'
                    : 'Basculer cette cellule en CRISE RÉELLE ?'
                }
                onConfirm={() => agir('POST', `${base}/mode`, { author: auteur })}
              >
                {c.mode === 'Réel' ? 'Repasser en exercice' : 'Basculer en crise réelle'}
              </ConfirmButton>
              <ConfirmButton
                message="Clôturer la cellule de crise ?"
                onConfirm={() => agir('POST', `${base}/cloture`, { author: auteur })}
              >
                Clôturer la cellule
              </ConfirmButton>
            </>
          )}
        </Group>
      </Group>
      <Chiffres
        items={[
          {
            valeur: formaterDureeCrise((c.end ? Date.parse(c.end) : maintenant) - Date.parse(c.start)),
            libelle: actif ? 'écoulé depuis l’ouverture' : 'durée totale',
          },
          {
            valeur: derniere
              ? formaterDureeCrise((actif ? maintenant : Date.parse(c.end || derniere.ts)) - Date.parse(derniere.ts))
              : '–',
            libelle: 'depuis la dernière entrée',
          },
          { valeur: c.log.length, libelle: 'entrées de main courante' },
          { valeur: avancement.total ? `${avancement.faits}/${avancement.total}` : '–', libelle: 'check-list' },
        ]}
      />
      <Group align="flex-start" grow>
        <Stack>
          <Text fw={600}>Main courante</Text>
          {edition && (
            <Stack gap="xs">
              <Group align="flex-end">
                <Select
                  label="Type d’entrée"
                  allowDeselect={false}
                  data={[...TYPES_ENTREE_CRISE]}
                  value={type}
                  onChange={(v) => setType(v ?? 'Information')}
                />
                <TextInput label="Auteur" value={auteur} onChange={(e) => setAuteur(e.currentTarget.value)} />
              </Group>
              <Textarea
                label="Entrée"
                placeholder="Fait, décision, action, communication… (Ctrl+Entrée pour ajouter)"
                autosize
                minRows={2}
                value={texte}
                onChange={(e) => setTexte(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void ajouter();
                  }
                }}
              />
              <div>
                <Button onClick={() => void ajouter()} disabled={!texte.trim()}>
                  Ajouter
                </Button>
              </div>
            </Stack>
          )}
          <ol className="crise-log">
            {[...c.log].reverse().map((l, k) => (
              <li key={`${l.ts}-${k}`}>
                <Group gap="xs">
                  <b>{formaterDateHeure(l.ts).slice(11)}</b>
                  <Text size="sm" c="dimmed">
                    T+{ecartMainCourante(l.ts, c.start)}
                  </Text>
                  <StatusChip etat="neutre">{l.type}</StatusChip>
                  <Text size="sm" c="dimmed">
                    {l.author}
                  </Text>
                </Group>
                <Text size="sm">{l.text}</Text>
              </li>
            ))}
            {!c.log.length && <li>Aucune entrée.</li>}
          </ol>
        </Stack>
        <Stack>
          <Text fw={600}>Échéances</Text>
          <ul>
            {c.deadlines.map((e, k) => {
              const reste = resteEcheance(e, maintenant);
              return (
                <li key={`${e.label}-${k}`}>
                  <b>{e.label}</b>
                  <br />
                  {formaterDateHeure(e.due)}
                  {actif && (
                    <Text size="sm" c={reste < 3600e3 ? 'red' : 'dimmed'} component="span">
                      {' '}
                      — {reste < 0 ? `dépassée de ${formaterDureeCrise(-reste)}` : `reste ${formaterDureeCrise(reste)}`}
                    </Text>
                  )}
                  {edition && (
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      aria-label={`Supprimer l’échéance ${e.label}`}
                      onClick={() => void agir('DELETE', `${base}/echeances/${k}`)}
                    >
                      ×
                    </Button>
                  )}
                </li>
              );
            })}
            {!c.deadlines.length && <li>Aucune échéance.</li>}
          </ul>
          {edition && (
            <Stack gap="xs">
              <Group align="flex-end">
                <TextInput
                  label="Échéance"
                  placeholder="ex. Notification CNIL"
                  value={echeance.label}
                  onChange={(e) => setEcheance({ ...echeance, label: e.currentTarget.value })}
                />
                <TextInput
                  label="Heures"
                  type="number"
                  min={1}
                  value={echeance.heures}
                  onChange={(e) => setEcheance({ ...echeance, heures: e.currentTarget.value })}
                />
                <Button
                  variant="default"
                  disabled={!echeance.label.trim() || !Number(echeance.heures)}
                  onClick={async () => {
                    if (
                      await agir('POST', `${base}/echeances`, {
                        label: echeance.label.trim(),
                        heures: Math.round(Number(echeance.heures)),
                      })
                    )
                      setEcheance({ label: '', heures: '' });
                  }}
                >
                  Ajouter l’échéance
                </Button>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  Raccourcis :
                </Text>
                {ECHEANCES_RAPIDES.map((q) => (
                  <Button
                    key={q.court}
                    size="compact-xs"
                    variant="subtle"
                    onClick={() => void agir('POST', `${base}/echeances`, { label: q.libelle, heures: q.heures })}
                  >
                    {q.court}
                  </Button>
                ))}
              </Group>
            </Stack>
          )}
          <Text fw={600}>Check-list{sc ? ` — ${sc.title}` : ''}</Text>
          {sc?.items.length ? (
            PHASES_CRISE.map((ph) => {
              const l = sc.items.map((x, k) => [x, k] as const).filter(([x]) => (x.phase || 'Gestion') === ph);
              return l.length ? (
                <Stack key={ph} gap="xs">
                  <Text fw={600} size="sm">
                    {ph}
                  </Text>
                  {l.map(([x, k]) => (
                    <Checkbox
                      key={k}
                      checked={!!c.checks[String(k)]?.done}
                      disabled={!edition}
                      label={`${x.t}${x.owner ? ` (${x.owner})` : ''}${c.checks[String(k)]?.done ? ` — ${formaterDateHeure(c.checks[String(k)]!.ts).slice(11)}` : ''}`}
                      onChange={(e) =>
                        void agir('PUT', `${base}/checklist/${k}`, { fait: e.currentTarget.checked, author: auteur })
                      }
                    />
                  ))}
                </Stack>
              ) : null;
            })
          ) : (
            <Text size="sm" c="dimmed">
              Aucune check-list : associez un scénario (page Scénarios et check-lists).
            </Text>
          )}
          <Text fw={600}>Contacts</Text>
          <ul>
            {contacts.map((x, k) => (
              <li key={k}>
                <b>{x.name || '?'}</b> {[x.org, x.role].filter(Boolean).join(' · ')}
                {x.phone && (
                  <>
                    {' '}
                    — <a href={`tel:${x.phone.replace(/\s/g, '')}`}>{x.phone}</a>
                  </>
                )}
                {x.email && (
                  <>
                    {' '}
                    — <a href={`mailto:${x.email}`}>{x.email}</a>
                  </>
                )}
              </li>
            ))}
            {!contacts.length && <li>Aucun contact enregistré.</li>}
          </ul>
        </Stack>
      </Group>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------- contacts */
const CHAMPS_CONTACT = [
  ['name', 'Nom'],
  ['org', 'Organisation'],
  ['role', 'Rôle'],
  ['phone', 'Téléphone'],
  ['phone2', 'Téléphone 2'],
  ['email', 'Courriel'],
  ['avail', 'Disponibilité'],
  ['notes', 'Notes'],
] as const;

export function ContactsCrise() {
  const can = useCan(),
    modifiable = can('incidents', 'modifier'),
    { d, agir, erreur } = useCrise();
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Contacts de crise</Text>
          <Text size="sm" c="dimmed">
            Fournisseurs importants, astreintes, autorités et interlocuteurs internes. Les contacts cochés « clé »
            apparaissent en premier dans la cellule de crise.
          </Text>
        </div>
        {modifiable && (
          <Group>
            <Button variant="default" onClick={() => void agir('POST', '/api/crise/contacts/fournisseurs')}>
              Ajouter les fournisseurs critiques et hébergeurs
            </Button>
            <Button onClick={() => void agir('POST', '/api/crise/contacts')}>Ajouter un contact</Button>
          </Group>
        )}
      </Group>
      {d && (
        <DataTable label="Contacts de crise">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Clé</Table.Th>
                {CHAMPS_CONTACT.map(([, l]) => (
                  <Table.Th key={l}>{l}</Table.Th>
                ))}
                {modifiable && <Table.Th />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {d.etat.contacts.map((x, k) => (
                <Table.Tr key={`${x.createdAt}-${k}`}>
                  <Table.Td>
                    <Checkbox
                      aria-label={`Contact clé ${k + 1}`}
                      checked={x.key}
                      disabled={!modifiable}
                      onChange={(e) => void agir('PATCH', `/api/crise/contacts/${k}`, { key: e.currentTarget.checked })}
                    />
                  </Table.Td>
                  {CHAMPS_CONTACT.map(([f, l]) => (
                    <Table.Td key={f}>
                      <ChampTexte
                        ariaLabel={`${l} du contact ${k + 1}`}
                        value={x[f]}
                        disabled={!modifiable}
                        onCommit={(v) => void agir('PATCH', `/api/crise/contacts/${k}`, { [f]: v })}
                      />
                    </Table.Td>
                  ))}
                  {modifiable && (
                    <Table.Td>
                      <ConfirmButton
                        message="Supprimer ce contact ?"
                        variant="subtle"
                        onConfirm={() => agir('DELETE', `/api/crise/contacts/${k}`)}
                      >
                        Supprimer
                      </ConfirmButton>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
              {!d.etat.contacts.length && (
                <Table.Tr>
                  <Table.Td colSpan={10}>Aucun contact.</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
    </Stack>
  );
}

/* ----------------------------------------------------------------------------------------------- scénarios */
export function ScenariosCrise() {
  const can = useCan(),
    modifiable = can('incidents', 'modifier'),
    { d, agir, erreur } = useCrise(),
    [sel, setSel] = useState<string | null>(null);
  const scenarios = d?.etat.scenarios ?? [];
  const sc: ScenarioCrise | undefined = scenarios.find((s) => s.id === sel) ?? scenarios[0];
  const base = sc ? `/api/crise/scenarios/${encodeURIComponent(sc.id)}` : '';
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Scénarios et check-lists</Text>
          <Text size="sm" c="dimmed">
            Un scénario regroupe les actions à mener par phase (alerte, mobilisation, gestion, sortie de crise).
          </Text>
        </div>
        {modifiable && (
          <Button
            onClick={async () => {
              const r = await agir<{ id: string }>('POST', '/api/crise/scenarios');
              if (r) setSel(r.id);
            }}
          >
            Ajouter un scénario
          </Button>
        )}
      </Group>
      {d && !scenarios.length && <Text size="sm">Aucun scénario pour le moment : ajoutez-en un.</Text>}
      {sc && (
        <Group align="flex-start" grow>
          <Stack gap="xs" maw="20em">
            {scenarios.map((s) => (
              <Button
                key={s.id}
                variant={s.id === sc.id ? 'filled' : 'default'}
                justify="space-between"
                onClick={() => setSel(s.id)}
              >
                {s.title || '(sans titre)'} ({s.items.length})
              </Button>
            ))}
          </Stack>
          <Stack key={sc.id}>
            <div className="grille-formulaire">
              <div className="grille-formulaire__champs">
                <ChampTexte
                  label="Scénario"
                  value={sc.title}
                  disabled={!modifiable}
                  onCommit={(v) => void agir('PATCH', base, { title: v })}
                />
                <ChampTexte
                  label="Référence (PCA, PRA)"
                  value={sc.ref}
                  disabled={!modifiable}
                  onCommit={(v) => void agir('PATCH', base, { ref: v })}
                />
              </div>
            </div>
            <ChampZone
              label="Description et déclencheurs"
              value={sc.desc}
              disabled={!modifiable}
              onCommit={(v) => void agir('PATCH', base, { desc: v })}
            />
            <DataTable label="Actions du scénario">
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Phase</Table.Th>
                    <Table.Th>Action</Table.Th>
                    <Table.Th>Responsable</Table.Th>
                    {modifiable && <Table.Th />}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sc.items.map((x, k) => (
                    <Table.Tr key={`${k}-${x.t}`}>
                      <Table.Td>
                        <ChampChoix
                          ariaLabel={`Phase de l’action ${k + 1}`}
                          value={x.phase}
                          options={PHASES_CRISE}
                          disabled={!modifiable}
                          onCommit={(v) => void agir('PATCH', `${base}/actions/${k}`, { phase: v })}
                        />
                      </Table.Td>
                      <Table.Td>
                        <ChampTexte
                          ariaLabel={`Action ${k + 1}`}
                          value={x.t}
                          disabled={!modifiable}
                          onCommit={(v) => void agir('PATCH', `${base}/actions/${k}`, { t: v })}
                        />
                      </Table.Td>
                      <Table.Td>
                        <ChampTexte
                          ariaLabel={`Responsable de l’action ${k + 1}`}
                          value={x.owner}
                          disabled={!modifiable}
                          onCommit={(v) => void agir('PATCH', `${base}/actions/${k}`, { owner: v })}
                        />
                      </Table.Td>
                      {modifiable && (
                        <Table.Td>
                          <Button
                            size="compact-sm"
                            variant="subtle"
                            onClick={() => void agir('DELETE', `${base}/actions/${k}`)}
                          >
                            Retirer
                          </Button>
                        </Table.Td>
                      )}
                    </Table.Tr>
                  ))}
                  {!sc.items.length && (
                    <Table.Tr>
                      <Table.Td colSpan={4}>Aucune action.</Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </DataTable>
            {modifiable && (
              <Group justify="space-between">
                <Button variant="default" onClick={() => void agir('POST', `${base}/actions`)}>
                  Ajouter une action
                </Button>
                <ConfirmButton
                  message="Supprimer ce scénario ?"
                  variant="light"
                  onConfirm={async () => {
                    await agir('DELETE', base);
                    setSel(null);
                  }}
                >
                  Supprimer le scénario
                </ConfirmButton>
              </Group>
            )}
          </Stack>
        </Group>
      )}
    </Stack>
  );
}

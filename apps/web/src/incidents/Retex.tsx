/* RETEX d'un incident : saisie de la chronologie événement par événement (date et heure, type, intitulé,
   description, acteur, gravité), enseignements, puis génération de la chronologie animée et cliquable
   (`ChronologieRetex`). Données lues et écrites dans l'incident (champ `timeline` de la clé `incidents` de l'état
   historique), sous verrou, par les routes /api/incidents/:id/retex. */
import {
  Anchor,
  Button,
  Card,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import {
  GRAVITES_RETEX,
  TYPES_EVENEMENT_RETEX,
  chronologieRetex,
  dateHeureRetex,
  dureeRetex,
  filtrerIncidents,
  indicateursRetex,
  type EvenementRetex,
  type Incident,
} from '@suivi/shared';
import { ConfirmButton, DataTable } from '@suivi/ui';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ErrorAlert } from '../components/common';
import { ChampZone, useModule } from '../historique/champs';
import { Chiffres } from '../historique/graphiques';
import { useCan } from '../session';
import { ChronologieRetex, TEINTE_TYPE_RETEX } from './ChronologieRetex';

interface Donnees {
  version: number;
  incidents: Incident[];
  categorieEntite: string;
  ecarts: Record<string, string>;
}
type Saisie = Omit<EvenementRetex, 'id'>;

/** Date et heure locales courantes au format du champ « datetime-local ». */
const maintenantLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const vide = (ts: string): Saisie => ({
  ts,
  type: 'Détection',
  titre: '',
  description: '',
  acteur: '',
  gravite: '',
});

export function RetexIncidents() {
  const can = useCan(),
    modifiable = can('incidents', 'modifier'),
    [params, setParams] = useSearchParams(),
    { d, agir, erreur } = useModule<Donnees>('incidents', '/api/incidents'),
    [plein, setPlein] = useState(false);
  const incident = d?.incidents.find((i) => i.id === params.get('incident')) ?? null;
  const vue = params.get('vue') === 'chronologie' ? 'chronologie' : 'saisie';
  const regler = (incidentId: string | null, v: 'saisie' | 'chronologie' = 'saisie') =>
    setParams(incidentId ? { incident: incidentId, ...(v === 'chronologie' ? { vue: v } : {}) } : {}, {
      replace: true,
    });

  const points = incident ? chronologieRetex(incident.timeline) : [];
  const ind = incident ? indicateursRetex(incident.timeline) : null;
  const titre = incident ? `${incident.id} — ${incident.title || '(sans titre)'}` : '';

  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <div>
        <Text fw={600}>RETEX et chronologie d’incident</Text>
        <Text size="sm" c="dimmed">
          Reconstituez le déroulé de l’incident en ajoutant les événements un par un, puis générez la chronologie animée
          : chaque point se parcourt au clic, au clavier ou en lecture automatique.
        </Text>
      </div>
      <Select
        label="Incident"
        placeholder="Choisir un incident du registre"
        searchable
        comboboxProps={{ withinPortal: true }}
        value={incident?.id ?? null}
        onChange={(v) => regler(v)}
        data={(d ? filtrerIncidents(d.incidents, 'all') : []).map((i) => ({
          value: i.id,
          label: `${i.id} — ${i.title || '(sans titre)'} (${i.timeline.length} évén.)`,
        }))}
      />
      {incident && ind && (
        <>
          <Group justify="space-between" align="flex-end">
            <SegmentedControl
              aria-label="Vue du RETEX"
              value={vue}
              onChange={(v) => regler(incident.id, v as 'saisie' | 'chronologie')}
              data={[
                { value: 'saisie', label: 'Saisie des événements' },
                { value: 'chronologie', label: 'Chronologie générée', disabled: !points.length },
              ]}
            />
            {vue === 'saisie' ? (
              <Button disabled={!points.length} onClick={() => regler(incident.id, 'chronologie')}>
                Générer la chronologie
              </Button>
            ) : (
              <Button variant="default" onClick={() => setPlein(true)}>
                Plein écran
              </Button>
            )}
          </Group>

          {vue === 'chronologie' ? (
            <ChronologieRetex titre={titre} points={points} indicateurs={ind} />
          ) : (
            <SaisieRetex incident={incident} modifiable={modifiable} agir={agir} />
          )}

          <Modal
            opened={plein && vue === 'chronologie'}
            onClose={() => setPlein(false)}
            fullScreen
            lockScroll={false}
            title="Chronologie du RETEX"
          >
            <ChronologieRetex titre={titre} points={points} indicateurs={ind} />
          </Modal>
        </>
      )}
      {d && !d.incidents.length && (
        <Text c="dimmed">Le registre ne contient aucun incident : créez d’abord la fiche dans le registre.</Text>
      )}
    </Stack>
  );
}

function SaisieRetex({
  incident,
  modifiable,
  agir,
}: {
  incident: Incident;
  modifiable: boolean;
  agir: <R = unknown>(m: string, c: string, b?: unknown) => Promise<R | undefined>;
}) {
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
          <FormulaireEvenement
            // Nouveau formulaire après chaque ajout : la date proposée est celle du dernier événement.
            key={`${incident.id}-${incident.timeline.length}`}
            initial={vide(dernier?.ts || incident.detectedAt || maintenantLocal())}
            libelle="Ajouter à la chronologie"
            valider={async (s) => !!(await agir('POST', `${base}/retex`, nettoyer(s)))}
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
              <Table.Th>Acteur</Table.Th>
              {modifiable && <Table.Th>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {points.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td>{dateHeureRetex(p.ts)}</Table.Td>
                <Table.Td>{p.depuisPrecedent == null ? 'T0' : `+${dureeRetex(p.depuisPrecedent)}`}</Table.Td>
                <Table.Td>
                  <span className="retex-type">
                    <span
                      className={`retex-pastille graph-${TEINTE_TYPE_RETEX[p.type] ?? 'gris'}`}
                      aria-hidden="true"
                    />
                    {p.type}
                  </span>
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
                </Table.Td>
                <Table.Td>
                  {p.gravite || (
                    <Text span c="dimmed">
                      {GRAVITES_RETEX[p.niveau]} (reportée)
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{p.acteur || '–'}</Table.Td>
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
                  Aucun événement. Commencez par la détection, puis ajoutez les étapes dans l’ordre où elles vous
                  reviennent : la chronologie est triée automatiquement.
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
          <FormulaireEvenement
            initial={edite}
            libelle="Enregistrer"
            valider={async (s) => {
              const ok = !!(await agir('PATCH', `${base}/retex/${encodeURIComponent(edite.id)}`, nettoyer(s)));
              if (ok) setEdite(null);
              return ok;
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}

const nettoyer = (s: Saisie) => ({
  ts: s.ts,
  type: s.type,
  titre: s.titre.trim(),
  description: s.description.trim(),
  acteur: s.acteur.trim(),
  gravite: s.gravite,
});

function FormulaireEvenement({
  initial,
  libelle,
  valider,
}: {
  initial: Saisie;
  libelle: string;
  valider: (s: Saisie) => Promise<boolean>;
}) {
  const [s, setS] = useState<Saisie>({ ...initial });
  const [envoi, setEnvoi] = useState(false);
  const champ = <K extends keyof Saisie>(k: K, v: Saisie[K]) => setS((x) => ({ ...x, [k]: v }));
  const complet = !!s.ts && !!s.titre.trim();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!complet || envoi) return;
        setEnvoi(true);
        try {
          await valider(s);
        } finally {
          setEnvoi(false);
        }
      }}
    >
      <Stack gap="sm">
        <div className="grille-formulaire">
          <div className="grille-formulaire__champs">
            <TextInput
              label="Date et heure"
              type="datetime-local"
              required
              value={s.ts}
              onChange={(e) => champ('ts', e.currentTarget.value)}
            />
            <Select
              label="Type d’événement"
              required
              allowDeselect={false}
              comboboxProps={{ withinPortal: true }}
              data={[...TYPES_EVENEMENT_RETEX]}
              value={s.type}
              onChange={(v) => champ('type', v ?? 'Autre')}
            />
            <Select
              label="Gravité à ce moment"
              placeholder="Reprendre la précédente"
              clearable
              comboboxProps={{ withinPortal: true }}
              data={[...GRAVITES_RETEX]}
              value={s.gravite || null}
              onChange={(v) => champ('gravite', v ?? '')}
            />
            <TextInput label="Acteur" value={s.acteur} onChange={(e) => champ('acteur', e.currentTarget.value)} />
          </div>
        </div>
        <TextInput
          label="Intitulé"
          required
          placeholder="ex. Alerte EDR sur le poste de la comptabilité"
          value={s.titre}
          onChange={(e) => champ('titre', e.currentTarget.value)}
        />
        <Textarea
          label="Description"
          autosize
          minRows={2}
          value={s.description}
          onChange={(e) => champ('description', e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button type="submit" disabled={!complet} loading={envoi}>
            {libelle}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

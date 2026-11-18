/* Suivi d'une faille (ADR 0100, point 10 ; lot V4b), dans la fiche d'un constat de Tenable ou d'une faille déclarée : état
   et marques, proposition « corrigée » à confirmer ou à refuser, changement d'état avec note (obligatoire pour « risque
   accepté » et « non concernée ») et date de revue, historique, actions liées (détail des seules actions lisibles),
   « Créer une action » (formulaire prérempli, périmètre où la personne écrit) et « Relier une action » existante. Écran
   sobre avec les composants de la charte (packages/ui), sous la CSP stricte (ADR 0006). Le serveur reste seul juge des
   droits : un refus s'affiche tel qu'il est rendu. */
import { Alert, Button, Group, Select, Stack, Table, Text, Textarea, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  type ActionLieeDto,
  type EntreeHistoriqueSuiviDto,
  type EtatSuiviFaille,
  type GrcObject,
  type NatureSuivi,
  type PerimetreAffectableDto,
  type SuiviDto,
  type SuiviResumeDto,
} from '@suivi/shared';
import { DataTable, ErrorAlert, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, get } from '../api';
import { fmtDate } from '../components/common';
import { useCan } from '../session';
import { corpsChangementEtat, etatsChoisissables, libelleHistorique, marquesSuivi, urlSuivi } from './suivi';

/** Marques du suivi (sans état). */
export function MarquesSuivi({ s, present, source }: { s: SuiviResumeDto; present: boolean; source: string }) {
  return (
    <Group gap="2xs">
      {marquesSuivi(s, present, source).map((m) => (
        <StatusChip key={m.libelle} etat={m.etat}>
          {m.libelle}
        </StatusChip>
      ))}
    </Group>
  );
}

/** Historique du suivi, du plus récent au plus ancien (sans état). */
export function HistoriqueSuivi({ historique }: { historique: EntreeHistoriqueSuiviDto[] }) {
  if (!historique.length)
    return (
      <Text size="sm" c="dimmed">
        Aucun changement : la faille est dans son état initial.
      </Text>
    );
  return (
    <DataTable label="Historique du suivi">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Événement</Table.Th>
            <Table.Th>Auteur</Table.Th>
            <Table.Th>Note</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {historique.map((h) => (
            <Table.Tr key={h.id}>
              <Table.Td>
                <span className="horodatage">{fmtDate(h.le)}</span>
              </Table.Td>
              <Table.Td>
                {libelleHistorique(h)}
                {h.revueLe && (
                  <Text size="xs" c="dimmed">
                    Revue le <span className="horodatage">{fmtDate(h.revueLe)}</span>
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{h.auteur}</Table.Td>
              <Table.Td>{h.note || '—'}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Actions liées (sans état). Une action que la personne ne peut pas lire n'est signalée que par sa présence. */
export function ActionsLiees({
  actions,
  peutDelier,
  onDelier,
}: {
  actions: ActionLieeDto[];
  peutDelier: boolean;
  onDelier: (id: string) => void;
}) {
  if (!actions.length)
    return (
      <Text size="sm" c="dimmed">
        Aucune action liée.
      </Text>
    );
  return (
    <DataTable label="Actions liées">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Action</Table.Th>
            <Table.Th>État de l’action</Table.Th>
            <Table.Th>Échéance</Table.Th>
            {peutDelier && <Table.Th>Lien</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {actions.map((a, i) =>
            a.lisible ? (
              <Table.Tr key={a.id}>
                <Table.Td>
                  {a.nom}
                  {a.archivee && (
                    <Text size="xs" c="dimmed">
                      Archivée
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <StatusChip etat={a.terminee ? 'succes' : 'info'}>{a.statutLibelle}</StatusChip>
                </Table.Td>
                <Table.Td>{a.echeance ? <span className="horodatage">{fmtDate(a.echeance)}</span> : '—'}</Table.Td>
                {peutDelier && (
                  <Table.Td>
                    <Button
                      size="compact-sm"
                      variant="light"
                      color="red"
                      onClick={() => onDelier(a.id)}
                      aria-label={`Délier ${a.nom}`}
                    >
                      Délier
                    </Button>
                  </Table.Td>
                )}
              </Table.Tr>
            ) : (
              <Table.Tr key={`masquee-${i}`}>
                <Table.Td colSpan={peutDelier ? 4 : 3}>
                  <Text size="sm" c="dimmed">
                    Action liée que vous ne pouvez pas lire.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ),
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Suivi d'une faille : lecture et décisions. `source` : « Tenable » ou « la veille » (proposition « corrigée »). */
export function SuiviFaille({ nature, id, source }: { nature: NatureSuivi; id: string; source: string }) {
  const can = useCan();
  const qc = useQueryClient();
  const cle = ['vulnerabilites', 'suivi', nature, id];
  const suivi = useQuery({ queryKey: cle, queryFn: () => get<SuiviDto>(urlSuivi(nature, id)) });
  const s = suivi.data;
  const decider = !!s?.peutDecider;
  const creerActions = decider && can('ecarts', 'modifier');
  const relierActions = decider && can('ecarts', 'lire');
  const [etat, setEtat] = useState<EtatSuiviFaille | null>(null);
  const [note, setNote] = useState('');
  const [revue, setRevue] = useState('');
  const [noteRefus, setNoteRefus] = useState('');
  const [creation, setCreation] = useState<{
    perimetre: string | null;
    titre: string;
    description: string;
    echeance: string;
  } | null>(null);
  const [lien, setLien] = useState<{
    perimetre: string | null;
    saisie: string;
    recherche: string | null;
    action: string | null;
  } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const perimetresEcriture = useQuery({
    queryKey: ['vulnerabilites', 'perimetres'],
    queryFn: () => get<PerimetreAffectableDto[]>('/api/vulnerabilites/perimetres'),
    enabled: creation !== null,
  });
  const perimetresLecture = useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () => get<{ id: string; name: string }[]>('/api/grc/smsis'),
    enabled: lien !== null,
  });
  const recherche = useQuery({
    queryKey: ['vulnerabilites', 'suivi', 'actions', lien?.perimetre, lien?.recherche],
    queryFn: () =>
      get<{ items: GrcObject[] }>(
        `/api/grc/${lien!.perimetre}/objects?kind=action&search=${encodeURIComponent(lien!.recherche ?? '')}`,
      ),
    enabled: !!lien?.perimetre && lien.recherche !== null,
  });
  const envoyer = async (fn: () => Promise<unknown>, message: string) => {
    setEnvoi(true);
    try {
      await fn();
      notifications.show({ color: 'teal', message });
      setEtat(null);
      setNote('');
      setRevue('');
      setNoteRefus('');
      setCreation(null);
      setLien(null);
      await qc.invalidateQueries({ queryKey: ['vulnerabilites'] });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
      await qc.invalidateQueries({ queryKey: cle });
    } finally {
      setEnvoi(false);
    }
  };
  const poster = (suite: string, body: unknown) =>
    api('POST', urlSuivi(nature, id, suite), { body, ifMatch: s!.version });

  if (!s) return <ErrorAlert error={suivi.error} />;
  const changement = etat ? corpsChangementEtat(etat, note, revue) : null;
  const liees = new Set(s.actions.flatMap((a) => (a.lisible ? [a.id] : [])));
  return (
    <Stack gap="sm" role="region" aria-label="Suivi de la faille">
      <Title order={3} size="h6">
        Suivi
      </Title>
      <MarquesSuivi s={s} present={s.present} source={source} />
      {s.majLe && (
        <Text size="xs" c="dimmed">
          Dernier changement par {s.majPar} le <span className="horodatage">{fmtDate(s.majLe)}</span>
          {s.revueLe && (
            <>
              {' '}
              · revue prévue le <span className="horodatage">{fmtDate(s.revueLe)}</span>
            </>
          )}
        </Text>
      )}
      {!decider && s.motifRefus && (
        <Text size="sm" c="dimmed">
          {s.motifRefus}
        </Text>
      )}
      {s.proposition === 'a_confirmer' && (
        <Alert color="orange" title={`Corrigée selon ${source}, à confirmer`}>
          <Stack gap="xs">
            <Text size="sm">
              La source ne rapporte plus cette faille. Rien n’est passé à « corrigée » sans une personne : confirmez, ou
              refusez avec une note (la faille reste dans son état).
            </Text>
            {decider && (
              <>
                <Textarea
                  label="Note du refus (obligatoire pour refuser)"
                  maxLength={1000}
                  value={noteRefus}
                  onChange={(e) => setNoteRefus(e.currentTarget.value)}
                />
                <Group justify="flex-end">
                  <Button
                    variant="default"
                    color="red"
                    loading={envoi}
                    disabled={!noteRefus.trim()}
                    onClick={() =>
                      void envoyer(() => poster('/refus', { note: noteRefus.trim() }), 'Proposition refusée.')
                    }
                  >
                    Refuser
                  </Button>
                  <Button
                    loading={envoi}
                    onClick={() =>
                      void envoyer(() => poster('/etat', { etat: 'corrigee', note: '' }), 'Faille confirmée corrigée.')
                    }
                  >
                    Confirmer « corrigée »
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        </Alert>
      )}
      {decider && (
        <Stack gap="xs" role="group" aria-label="Changer l’état">
          <Group align="flex-end">
            <Select
              allowDeselect={false}
              label="Nouvel état"
              placeholder="Choisir"
              value={etat}
              onChange={(v) => setEtat(v as EtatSuiviFaille | null)}
              data={etatsChoisissables(s.etat)}
              comboboxProps={{ withinPortal: false }}
            />
            {etat === 'risque_accepte' && (
              <TextInput
                type="date"
                label="Date de revue (facultative)"
                value={revue}
                onChange={(e) => setRevue(e.currentTarget.value)}
              />
            )}
          </Group>
          {etat && (
            <>
              <Textarea
                label={changement?.erreur ? 'Note (obligatoire)' : 'Note (facultative)'}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
              />
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setEtat(null)}>
                  Annuler
                </Button>
                <Button
                  loading={envoi}
                  disabled={!!changement?.erreur}
                  onClick={() => void envoyer(() => poster('/etat', changement!.corps), 'État enregistré.')}
                >
                  Enregistrer
                </Button>
              </Group>
            </>
          )}
        </Stack>
      )}
      <Title order={3} size="h6">
        Actions liées
      </Title>
      <Text size="xs" c="dimmed">
        Le traitement passe par une action du registre. Créer ou relier une action fait passer une faille « nouvelle » à
        « à traiter » ; la clôture d’une action ne change pas l’état de la faille.
      </Text>
      <ActionsLiees
        actions={s.actions}
        peutDelier={decider}
        onDelier={(actionId) =>
          void envoyer(
            () => api('DELETE', urlSuivi(nature, id, `/liens/${actionId}`), { ifMatch: s.version }),
            'Action déliée.',
          )
        }
      />
      {(creerActions || relierActions) && !creation && !lien && (
        <Group>
          {creerActions && (
            <Button
              variant="default"
              onClick={() =>
                setCreation({
                  perimetre: null,
                  titre: s.preremplissage.titre,
                  description: s.preremplissage.description,
                  echeance: '',
                })
              }
            >
              Créer une action
            </Button>
          )}
          {relierActions && (
            <Button
              variant="default"
              onClick={() => setLien({ perimetre: null, saisie: '', recherche: null, action: null })}
            >
              Relier une action
            </Button>
          )}
        </Group>
      )}
      {creation && (
        <Stack gap="xs" role="group" aria-label="Créer une action">
          <ErrorAlert error={perimetresEcriture.error} />
          <Select
            allowDeselect={false}
            label="Périmètre de l’action"
            description="Périmètres où vous pouvez écrire."
            placeholder="Choisir"
            value={creation.perimetre}
            onChange={(v) => setCreation({ ...creation, perimetre: v })}
            data={(perimetresEcriture.data ?? []).map((p) => ({ value: p.id, label: p.nom }))}
            comboboxProps={{ withinPortal: false }}
          />
          <TextInput
            label="Intitulé"
            maxLength={200}
            value={creation.titre}
            onChange={(e) => setCreation({ ...creation, titre: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            description="Le correctif de la source est repris en anglais, tel quel."
            autosize
            minRows={4}
            maxLength={10000}
            value={creation.description}
            onChange={(e) => setCreation({ ...creation, description: e.currentTarget.value })}
          />
          {s.actifsAction && (
            <Textarea
              label="Actifs touchés, ajoutés à la description"
              description="La plateforme ajoute à l’action les machines touchées que vous pouvez lire (20 au plus, par rang) et les applications touchées, sans adresse."
              autosize
              minRows={2}
              readOnly
              value={s.actifsAction}
            />
          )}
          <TextInput
            type="date"
            label="Échéance (facultative)"
            value={creation.echeance}
            onChange={(e) => setCreation({ ...creation, echeance: e.currentTarget.value })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreation(null)}>
              Annuler
            </Button>
            <Button
              loading={envoi}
              disabled={!creation.perimetre || !creation.titre.trim()}
              onClick={() =>
                void envoyer(
                  () =>
                    poster('/actions', {
                      perimetreId: creation.perimetre,
                      titre: creation.titre.trim(),
                      description: creation.description,
                      echeance: creation.echeance || null,
                    }),
                  'Action créée et liée à la faille.',
                )
              }
            >
              Créer
            </Button>
          </Group>
        </Stack>
      )}
      {lien && (
        <Stack gap="xs" role="group" aria-label="Relier une action">
          <ErrorAlert error={perimetresLecture.error ?? recherche.error} />
          <Group align="flex-end">
            <Select
              allowDeselect={false}
              label="Périmètre"
              placeholder="Choisir"
              value={lien.perimetre}
              onChange={(v) => setLien({ ...lien, perimetre: v, action: null })}
              data={(perimetresLecture.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
              comboboxProps={{ withinPortal: false }}
            />
            <TextInput
              label="Rechercher une action"
              maxLength={200}
              value={lien.saisie}
              onChange={(e) => setLien({ ...lien, saisie: e.currentTarget.value })}
            />
            <Button
              variant="default"
              disabled={!lien.perimetre}
              onClick={() => setLien({ ...lien, recherche: lien.saisie.trim(), action: null })}
            >
              Rechercher
            </Button>
          </Group>
          <Select
            allowDeselect={false}
            label="Action à relier"
            placeholder="Choisir"
            value={lien.action}
            onChange={(v) => setLien({ ...lien, action: v })}
            data={(recherche.data?.items ?? [])
              .filter((o) => !liees.has(o.id))
              .map((o) => ({ value: o.id, label: o.name }))}
            nothingFoundMessage="Aucune action"
            comboboxProps={{ withinPortal: false }}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setLien(null)}>
              Annuler
            </Button>
            <Button
              loading={envoi}
              disabled={!lien.action}
              onClick={() =>
                void envoyer(() => poster('/liens', { actionId: lien.action }), 'Action reliée à la faille.')
              }
            >
              Relier
            </Button>
          </Group>
        </Stack>
      )}
      <Title order={3} size="h6">
        Historique
      </Title>
      <HistoriqueSuivi historique={s.historique} />
    </Stack>
  );
}

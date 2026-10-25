/* Calendriers de plateforme (Plateforme) : jours fériés français calculés et calendriers iCalendar importés, tenus par
   l'administrateur et repris par les séries de tâches. La mise à jour est annuelle et manuelle : aucune adresse distante n'est
   consultée. Chaque génération ou import passe par un aperçu ; le journal garde la provenance de chaque mise à jour. */
import {
  Alert,
  Button,
  Card,
  FileInput,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { StatusChip } from '@suivi/ui';
import {
  ICAL_MAX_OCTETS,
  LIBELLES_TYPE_CALENDRIER,
  TYPES_CALENDRIER_PLATEFORME,
  type ApercuMiseAJourCalendrier,
  type CalendrierPlateformeDto,
  type TypeCalendrierPlateforme,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, get } from '../api';
import { ConfirmButton, ErrorAlert, fmtDate } from '../components/common';
import { useCan } from '../session';

const CLE = ['calendriers-plateforme'];
const dateFr = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' });

interface Entree {
  seq: number;
  operation: string;
  year: number | null;
  daysAdded: number;
  daysRemoved: number;
  provenance: string;
  reason: string;
  createdBy: string;
  createdAt: string;
}
const LIBELLES_OPERATION: Record<string, string> = {
  creer: 'Création',
  generer: 'Jours fériés générés',
  importer: 'Fichier importé',
  retirer_annee: 'Année retirée',
  supprimer: 'Suppression',
};

export function CalendriersPanel() {
  const can = useCan();
  const qc = useQueryClient();
  const administrer = can('administration', 'administrer');
  const q = useQuery({ queryKey: CLE, queryFn: () => get<CalendrierPlateformeDto[]>('/api/calendriers-plateforme') });
  const [creation, setCreation] = useState<{ name: string; kind: TypeCalendrierPlateforme } | null>(null);
  const [maj, setMaj] = useState<CalendrierPlateformeDto | null>(null);
  const [historique, setHistorique] = useState<CalendrierPlateformeDto | null>(null);
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const actualiser = () => qc.invalidateQueries({ queryKey: CLE });
  const agir = async (fn: () => Promise<unknown>, message: string) => {
    setEnvoi(true);
    try {
      setErreur(null);
      await fn();
      notifications.show({ message, color: 'green' });
      await actualiser();
      return true;
    } catch (e) {
      setErreur(e);
      notifications.show({ message: errorMessage(e), color: 'red' });
      return false;
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Les jours fériés français se calculent d’après la loi (métropole) ; les autres calendriers (fermetures,
        événements) s’importent depuis un fichier iCalendar. Rien n’est récupéré à distance et rien ne se renouvelle
        seul : la mise à jour annuelle est une action de l’administrateur. Les séries de tâches copient ensuite ces
        jours dans leurs jours exclus. Les vacances scolaires ne sont pas gérées.
      </Text>
      <ErrorAlert error={q.error ?? erreur} />
      {administrer && (
        <Group>
          <Button onClick={() => setCreation({ name: '', kind: 'feries' })}>Nouveau calendrier</Button>
        </Group>
      )}
      <Card withBorder p={0}>
        <div className="table-wrap" role="region" aria-label="Calendriers de plateforme" tabIndex={0}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Calendrier</Table.Th>
                <Table.Th>Années couvertes</Table.Th>
                <Table.Th>Dernière mise à jour</Table.Th>
                <Table.Th>État</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(q.data ?? []).map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td>
                    <b>{c.name}</b>
                    <Text size="xs" c="dimmed">
                      {LIBELLES_TYPE_CALENDRIER[c.kind]}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {c.years.length ? c.years.map((y) => `${y.year} (${y.days} j)`).join(', ') : 'Aucune'}
                  </Table.Td>
                  <Table.Td>{c.updatedAt ? `${fmtDate(c.updatedAt)} par ${c.updatedBy}` : '—'}</Table.Td>
                  <Table.Td>
                    {c.missingYears.length ? (
                      <StatusChip etat="attention">À mettre à jour : {c.missingYears.join(', ')}</StatusChip>
                    ) : (
                      <StatusChip etat="succes">À jour</StatusChip>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {administrer && (
                        <Button size="compact-sm" variant="default" onClick={() => setMaj(c)}>
                          Mettre à jour
                        </Button>
                      )}
                      <Button size="compact-sm" variant="default" onClick={() => setHistorique(c)}>
                        Historique
                      </Button>
                      {administrer && (
                        <ConfirmButton
                          size="compact-sm"
                          variant="light"
                          disabled={c.years.length > 0 || envoi}
                          message={`Supprimer le calendrier vide « ${c.name} » ?`}
                          onConfirm={() =>
                            agir(() => api('DELETE', `/api/calendriers-plateforme/${c.id}`), 'Calendrier supprimé.')
                          }
                        >
                          Supprimer
                        </ConfirmButton>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {q.data?.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed">
                      Aucun calendrier. Créez un calendrier « Jours fériés », puis générez l’année en cours.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la création' }}
        opened={creation !== null}
        onClose={() => setCreation(null)}
        title="Nouveau calendrier"
        centered
        classNames={{ content: 'fenetre-admin' }}
      >
        {creation && (
          <Stack>
            <TextInput
              label="Nom"
              required
              data-autofocus
              value={creation.name}
              onChange={(e) => setCreation({ ...creation, name: e.currentTarget.value })}
            />
            <Select
              label="Type"
              allowDeselect={false}
              data={TYPES_CALENDRIER_PLATEFORME.map((k) => ({ value: k, label: LIBELLES_TYPE_CALENDRIER[k] }))}
              value={creation.kind}
              onChange={(v) => v && setCreation({ ...creation, kind: v as TypeCalendrierPlateforme })}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setCreation(null)}>
                Annuler
              </Button>
              <Button
                loading={envoi}
                disabled={!creation.name.trim()}
                onClick={async () => {
                  if (
                    await agir(() => api('POST', '/api/calendriers-plateforme', { body: creation }), 'Calendrier créé.')
                  )
                    setCreation(null);
                }}
              >
                Créer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la mise à jour' }}
        opened={maj !== null}
        onClose={() => setMaj(null)}
        title={maj ? `Mettre à jour « ${maj.name} »` : ''}
        centered
        size="lg"
        classNames={{ content: 'fenetre-admin' }}
      >
        {maj && <MiseAJour calendrier={maj} onFait={() => void actualiser()} />}
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer l’historique' }}
        opened={historique !== null}
        onClose={() => setHistorique(null)}
        title={historique ? `Historique de « ${historique.name} »` : ''}
        centered
        size="lg"
        classNames={{ content: 'fenetre-admin' }}
      >
        {historique && <Historique calendrier={historique} />}
      </Modal>
    </Stack>
  );
}

function MiseAJour({ calendrier, onFait }: { calendrier: CalendrierPlateformeDto; onFait: () => void }) {
  const can = useCan();
  const [annee, setAnnee] = useState<number | string>(new Date().getFullYear());
  const [texte, setTexte] = useState('');
  const [nomFichier, setNomFichier] = useState('');
  const [apercu, setApercu] = useState<{ source: 'feries' | 'ical'; r: ApercuMiseAJourCalendrier } | null>(null);
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const [retrait, setRetrait] = useState<{ year: number; reason: string } | null>(null);
  const url = `/api/calendriers-plateforme/${calendrier.id}`;
  const lancer = async (source: 'feries' | 'ical', appliquer: boolean) => {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api<ApercuMiseAJourCalendrier>('POST', `${url}/${source === 'feries' ? 'feries' : 'ical'}`, {
        body:
          source === 'feries'
            ? { year: Number(annee), apercu: !appliquer }
            : { ics: texte, filename: nomFichier, apercu: !appliquer },
      });
      setApercu({ source, r });
      if (appliquer) {
        notifications.show({
          color: r.applied ? 'green' : 'gray',
          message: r.applied ? `${r.added.length} jour(s) ajouté(s).` : 'Aucun nouveau jour : calendrier inchangé.',
        });
        onFait();
      }
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const lireFichier = async (f: File | null) => {
    setApercu(null);
    if (!f) return;
    if (f.size > ICAL_MAX_OCTETS)
      return setErreur(new Error(`Fichier trop volumineux (${Math.round(ICAL_MAX_OCTETS / 1024)} Ko au plus).`));
    setNomFichier(f.name);
    setTexte(await f.text());
  };
  const peut = can('administration', 'administrer');
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      {calendrier.kind === 'feries' && (
        <Stack gap="xs" role="group" aria-label="Jours fériés légaux">
          <Text fw={600}>Jours fériés légaux français</Text>
          <Text size="sm" c="dimmed">
            Onze jours de la métropole (Code du travail, art. L3133-1). Les jours propres à l’Alsace-Moselle ou à
            l’outre-mer se chargent par un fichier iCalendar.
          </Text>
          <Group align="flex-end">
            <NumberInput
              label="Année"
              min={1583}
              max={2200}
              allowDecimal={false}
              value={annee}
              onChange={(v) => {
                setAnnee(v);
                setApercu(null);
              }}
            />
            <Button variant="default" loading={envoi} disabled={!peut} onClick={() => void lancer('feries', false)}>
              Prévisualiser
            </Button>
            <Button
              loading={envoi}
              disabled={!peut || apercu?.source !== 'feries' || apercu.r.added.length === 0}
              onClick={() => void lancer('feries', true)}
            >
              Ajouter ces jours
            </Button>
          </Group>
        </Stack>
      )}
      <Stack gap="xs" role="group" aria-label="Import iCalendar">
        <Text fw={600}>Importer un fichier iCalendar</Text>
        <FileInput label="Fichier .ics" accept=".ics,text/calendar" clearable onChange={(f) => void lireFichier(f)} />
        <Textarea
          label="Ou collez le contenu du calendrier"
          description="Les événements deviennent des jours. Aucune adresse distante n’est consultée."
          autosize
          minRows={3}
          maxRows={8}
          value={texte}
          onChange={(e) => {
            setTexte(e.currentTarget.value);
            setApercu(null);
          }}
        />
        <Group>
          <Button
            variant="default"
            loading={envoi}
            disabled={!peut || !texte.trim()}
            onClick={() => void lancer('ical', false)}
          >
            Prévisualiser l’import
          </Button>
          <Button
            loading={envoi}
            disabled={!peut || apercu?.source !== 'ical' || apercu.r.errors.length > 0 || apercu.r.added.length === 0}
            onClick={() => void lancer('ical', true)}
          >
            Importer ces jours
          </Button>
        </Group>
      </Stack>
      {apercu && (
        <Stack gap="2xs" role="region" aria-label="Aperçu de la mise à jour">
          {apercu.r.errors.length > 0 && (
            <Alert color="red" role="alert" title="Le fichier contient des erreurs : rien ne sera importé">
              {apercu.r.errors.map((e, i) => (
                <Text key={i} size="sm">
                  Ligne {e.line} : {e.message}
                </Text>
              ))}
            </Alert>
          )}
          <Text size="sm">
            {apercu.r.added.length} jour(s) à ajouter
            {apercu.r.added.length
              ? ` : ${apercu.r.added
                  .slice(0, 12)
                  .map((j) => `${dateFr(j.date)}${j.label ? ' (' + j.label + ')' : ''}`)
                  .join(', ')}${apercu.r.added.length > 12 ? '…' : ''}`
              : ''}
            . {apercu.r.alreadyPresent.length} déjà présent(s).
          </Text>
          {apercu.r.ignored.map((e, i) => (
            <Text key={i} size="xs" c="dimmed">
              Ligne {e.line} : {e.message}
            </Text>
          ))}
        </Stack>
      )}
      {calendrier.years.length > 0 && peut && (
        <Stack gap="xs" role="group" aria-label="Retirer une année">
          <Text fw={600}>Retirer une année</Text>
          <Group align="flex-end">
            <Select
              label="Année"
              data={calendrier.years.map((y) => ({ value: String(y.year), label: `${y.year} (${y.days} jours)` }))}
              value={retrait ? String(retrait.year) : null}
              onChange={(v) => setRetrait(v ? { year: Number(v), reason: retrait?.reason ?? '' } : null)}
            />
            <TextInput
              label="Motif (consigné)"
              value={retrait?.reason ?? ''}
              disabled={!retrait}
              onChange={(e) => retrait && setRetrait({ ...retrait, reason: e.currentTarget.value })}
            />
            <ConfirmButton
              variant="light"
              disabled={!retrait || retrait.reason.trim().length < 5 || envoi}
              message={`Retirer tous les jours de ${retrait?.year} de ce calendrier ?`}
              onConfirm={async () => {
                if (!retrait) return;
                try {
                  await api('POST', `${url}/annees/${retrait.year}/retrait`, { body: { reason: retrait.reason } });
                  notifications.show({ message: 'Année retirée.', color: 'green' });
                  setRetrait(null);
                  onFait();
                } catch (e) {
                  setErreur(e);
                }
              }}
            >
              Retirer
            </ConfirmButton>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}

function Historique({ calendrier }: { calendrier: CalendrierPlateformeDto }) {
  const q = useQuery({
    queryKey: [...CLE, calendrier.id, 'journal'],
    queryFn: () => get<Entree[]>(`/api/calendriers-plateforme/${calendrier.id}/journal`),
  });
  return (
    <Stack>
      <ErrorAlert error={q.error} />
      <div className="table-wrap" role="region" aria-label="Historique des mises à jour" tabIndex={0}>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Opération</Table.Th>
              <Table.Th>Détail</Table.Th>
              <Table.Th>Par</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(q.data ?? []).map((e) => (
              <Table.Tr key={e.seq}>
                <Table.Td>{fmtDate(e.createdAt)}</Table.Td>
                <Table.Td>{LIBELLES_OPERATION[e.operation] ?? e.operation}</Table.Td>
                <Table.Td>
                  {[
                    e.year ? `Année ${e.year}` : '',
                    e.daysAdded ? `${e.daysAdded} jour(s) ajouté(s)` : '',
                    e.daysRemoved ? `${e.daysRemoved} jour(s) retiré(s)` : '',
                    e.provenance,
                    e.reason ? `Motif : ${e.reason}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </Table.Td>
                <Table.Td>{e.createdBy}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    </Stack>
  );
}

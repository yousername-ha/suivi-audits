/* Journaux techniques du serveur (012-13) : niveau de journalisation réglable à chaud (warn, info ; debug toujours
   temporaire), état réellement appliqué, dernières entrées filtrables et téléchargement. Le niveau est un seuil technique :
   les erreurs sont toujours collectées et le journal d'audit reste indépendant. */
import { Alert, Badge, Button, Card, Group, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { StatusChip, type Etat } from '@suivi/ui';
import { notifications } from '@mantine/notifications';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, download, errorMessage, get } from '../api';
import { ErrorAlert, fmtDate } from '../components/common';
import { useCan } from '../session';

interface Etat_ {
  niveauPermanent: 'info' | 'warn';
  niveauApplique: string;
  debugJusqua: string | null;
  modifiePar: string;
  modifieLe: string | null;
  tampon: { taille: number; capacite: number; plusAncienne: string | null };
}
interface Entree {
  n: number;
  date: string;
  niveau: string;
  message: string;
  contexte: Record<string, unknown>;
}
interface Page {
  etat: Etat_;
  entrees: Entree[];
  reste: boolean;
}

const PAGE = 200;
const NIVEAUX_AFFICHAGE = [
  { value: 'debug', label: 'Tous les niveaux (debug et plus)' },
  { value: 'info', label: 'Info et plus' },
  { value: 'warn', label: 'Avertissements et erreurs' },
  { value: 'error', label: 'Erreurs seulement' },
];
const LIBELLES_NIVEAU: Record<string, string> = {
  debug: 'Debug',
  info: 'Info',
  warn: 'Avertissement',
  error: 'Erreur',
  fatal: 'Erreur fatale',
};
const ETAT_NIVEAU: Record<string, Etat> = {
  debug: 'neutre',
  info: 'info',
  warn: 'attention',
  error: 'erreur',
  fatal: 'erreur',
};
const DUREES = [
  { value: '15', label: '15 minutes' },
  { value: '60', label: '1 heure' },
  { value: '240', label: '4 heures' },
  { value: '1440', label: '24 heures' },
];

export function JournauxTechniquesPanel() {
  const can = useCan();
  const qc = useQueryClient();
  const vide = { q: '', niveau: 'debug' };
  const [saisie, setSaisie] = useState(vide);
  const [filtres, setFiltres] = useState(vide);
  const [permanent, setPermanent] = useState<string | null>(null);
  const [duree, setDuree] = useState<string | null>('60');
  const [envoi, setEnvoi] = useState(false);
  const critere = (f: typeof vide) => new URLSearchParams({ niveau: f.niveau, ...(f.q ? { q: f.q } : {}) }).toString();
  const r = useInfiniteQuery({
    queryKey: ['admin', 'journaux-techniques', filtres],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      get<Page>(
        `/api/admin/journaux-techniques?limite=${PAGE}&${critere(filtres)}${pageParam ? `&avant=${pageParam}` : ''}`,
      ),
    getNextPageParam: (derniere) => (derniere.reste ? derniere.entrees[derniere.entrees.length - 1]?.n : undefined),
    // L'état affiché suit le serveur : le debug temporaire peut s'éteindre pendant la consultation.
    refetchInterval: 30_000,
  });
  const etat = useQuery({
    queryKey: ['admin', 'journaux-techniques', 'etat'],
    queryFn: async () => (await get<Page>('/api/admin/journaux-techniques?limite=1')).etat,
    refetchInterval: 30_000,
  });
  const lignes = r.data?.pages.flatMap((p) => p.entrees) ?? [];
  const e = etat.data ?? r.data?.pages[0]?.etat;
  const administrer = can('administration', 'administrer');

  const appliquer = async (corps: Record<string, unknown>, message: string) => {
    setEnvoi(true);
    try {
      await api('PUT', '/api/admin/journaux-techniques/niveau', {
        body: { ...corps, reason: 'Réglage depuis l’administration', confirm: 'APPLIQUER' },
      });
      notifications.show({ message, color: 'green' });
      await qc.invalidateQueries({ queryKey: ['admin', 'journaux-techniques'] });
    } catch (err) {
      notifications.show({ message: errorMessage(err), color: 'red' });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Stack>
      <ErrorAlert error={etat.error ?? r.error} />
      {e && (
        <Card withBorder>
          <Stack gap="xs">
            <Group gap="xs">
              <Text fw={600}>Niveau appliqué par le serveur :</Text>
              <StatusChip etat={ETAT_NIVEAU[e.niveauApplique] ?? 'neutre'}>
                {LIBELLES_NIVEAU[e.niveauApplique] ?? e.niveauApplique}
              </StatusChip>
              <Badge variant="light" color="gray">
                Seuil permanent : {LIBELLES_NIVEAU[e.niveauPermanent]}
              </Badge>
            </Group>
            {e.debugJusqua && (
              <Alert color="orange" title="Débogage temporaire actif" role="status">
                Le niveau debug s’éteindra le {fmtDate(e.debugJusqua)} ; le seuil permanent reprendra alors.
              </Alert>
            )}
            <Text size="sm" c="dimmed">
              Le niveau est un seuil technique : les erreurs sont toujours collectées et le journal d’audit reste
              indépendant. {e.modifiePar ? `Dernier réglage par ${e.modifiePar}, le ${fmtDate(e.modifieLe)}. ` : ''}
              Le serveur garde en mémoire les {e.tampon.capacite} dernières entrées ({e.tampon.taille} actuellement
              {e.tampon.plusAncienne ? `, depuis le ${fmtDate(e.tampon.plusAncienne)}` : ''}) ; la sortie standard du
              conteneur reste la source complète.
            </Text>
            {administrer && (
              <Group align="flex-end">
                <Select
                  label="Seuil permanent"
                  allowDeselect={false}
                  data={[
                    { value: 'warn', label: 'Avertissements et erreurs' },
                    { value: 'info', label: 'Info (recommandé)' },
                  ]}
                  value={permanent ?? e.niveauPermanent}
                  onChange={setPermanent}
                />
                <Button
                  variant="default"
                  loading={envoi}
                  disabled={(permanent ?? e.niveauPermanent) === e.niveauPermanent && !e.debugJusqua}
                  onClick={() =>
                    void appliquer({ niveau: permanent ?? e.niveauPermanent }, 'Seuil de journalisation appliqué.')
                  }
                >
                  Appliquer le seuil
                </Button>
                <Select
                  label="Débogage temporaire"
                  allowDeselect={false}
                  data={DUREES}
                  value={duree}
                  onChange={setDuree}
                />
                <Button
                  color="orange"
                  variant="light"
                  loading={envoi}
                  onClick={() =>
                    void appliquer({ niveau: 'debug', dureeMinutes: Number(duree) }, 'Débogage temporaire activé.')
                  }
                >
                  Activer le débogage
                </Button>
              </Group>
            )}
          </Stack>
        </Card>
      )}
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          setFiltres(saisie);
        }}
      >
        <Group align="flex-end">
          <Select
            label="Niveau minimal"
            allowDeselect={false}
            data={NIVEAUX_AFFICHAGE}
            value={saisie.niveau}
            onChange={(v) => v && setSaisie({ ...saisie, niveau: v })}
          />
          <TextInput
            label="Rechercher"
            placeholder="message ou contexte"
            value={saisie.q}
            onChange={(ev) => setSaisie({ ...saisie, q: ev.currentTarget.value })}
          />
          <Button type="submit" variant="default">
            Filtrer
          </Button>
          <Button
            variant="subtle"
            onClick={() => {
              setSaisie(vide);
              setFiltres(vide);
            }}
          >
            Réinitialiser
          </Button>
          {can('administration', 'exporter') && (
            <Button
              variant="light"
              onClick={() => download(`/api/admin/journaux-techniques?format=ndjson&export=1&${critere(filtres)}`)}
            >
              Télécharger (NDJSON)
            </Button>
          )}
        </Group>
      </form>
      <Text size="sm">
        {lignes.length} entrée(s) affichée(s){r.hasNextPage ? ' ; d’autres, plus anciennes, restent à charger' : ''}. Le
        téléchargement reprend les filtres et les 5 000 entrées les plus récentes ; il est tracé dans le journal
        d’audit.
      </Text>
      <Card withBorder p={0}>
        <div className="table-wrap" role="region" aria-label="Journaux techniques" tabIndex={0}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Niveau</Table.Th>
                <Table.Th>Message</Table.Th>
                <Table.Th>Contexte</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lignes.map((l) => (
                <Table.Tr key={l.n}>
                  <Table.Td className="nowrap">{fmtDate(l.date)}</Table.Td>
                  <Table.Td>
                    <StatusChip etat={ETAT_NIVEAU[l.niveau] ?? 'neutre'}>
                      {LIBELLES_NIVEAU[l.niveau] ?? l.niveau}
                    </StatusChip>
                  </Table.Td>
                  <Table.Td>{l.message}</Table.Td>
                  <Table.Td className="mono">
                    {Object.keys(l.contexte).length ? JSON.stringify(l.contexte) : ''}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
      {r.hasNextPage && (
        <Button variant="default" loading={r.isFetchingNextPage} onClick={() => void r.fetchNextPage()}>
          Charger les {PAGE} entrées plus anciennes
        </Button>
      )}
    </Stack>
  );
}

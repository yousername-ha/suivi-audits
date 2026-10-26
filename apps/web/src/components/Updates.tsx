import { Alert, Anchor, Button, Card, Group, Loader, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { UpdateReceiptSummary, UpdateState } from '@suivi/shared';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, download, get } from '../api';
import { ErrorAlert } from './common';
import { useCan, useMe } from '../session';

const ATTENTE_MAX_MS = 90_000;
const PAS_DE_SUIVI_MS = 1000;
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

function useUpdateState() {
  return useQuery({ queryKey: ['updates'], queryFn: () => get<UpdateState>('/api/updates'), refetchInterval: 15000 });
}
function available(s?: UpdateState) {
  if (!s?.available || !/^\d+\.\d+\.\d+$/.test(s.installed)) return false;
  const a = s.installed.split('.').map(Number),
    b = s.available.split('.').map(Number);
  const i = a.findIndex((v, index) => v !== b[index]);
  return i >= 0 && a[i]! < b[i]!;
}
function useUpdateAdmin() {
  const me = useMe();
  const can = useCan();
  return !!me.user?.roles.includes('Administrateur') && can('administration', 'administrer');
}
export function UpdateNotice() {
  const q = useUpdateState();
  const admin = useUpdateAdmin();
  if (!available(q.data)) return <div data-native-updates hidden />;
  return (
    <div className="update-notice" data-native-updates role="status">
      <span>
        Mise à jour disponible : <b>{q.data!.available}</b> · Version installée : {q.data!.installed}
      </span>
      {q.data?.notes && (
        <Anchor size="xs" href={q.data.notes} target="_blank" rel="noreferrer">
          Nouveautés
        </Anchor>
      )}
      {admin && (
        <Anchor size="xs" component={Link} to="/systeme/mises-a-jour">
          Mettre à jour
        </Anchor>
      )}
    </div>
  );
}
const STATUTS_RECU: Record<UpdateReceiptSummary['statut'], string> = {
  success: 'Installée',
  rolled_back: 'Annulée, version précédente restaurée',
  failed: 'Non installée',
  intervention: 'Intervention nécessaire',
};
const duree = (s: number | null) => (s == null ? '—' : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`);
/** Preuves de changement : reçus structurés écrits par le service de mise à jour, téléchargeables en JSON. */
function UpdateReceipts() {
  const q = useQuery({
    queryKey: ['updates', 'receipts'],
    queryFn: () => get<UpdateReceiptSummary[]>('/api/admin/updates/receipts'),
  });
  if (!q.data?.length) return null;
  return (
    <Stack gap="xs">
      <Title order={3} size="h5">
        Reçus des dernières installations
      </Title>
      <div className="table-wrap" role="region" aria-label="Reçus des dernières installations" tabIndex={0}>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fin</Table.Th>
              <Table.Th>Versions</Table.Th>
              <Table.Th>Résultat</Table.Th>
              <Table.Th>Durée</Table.Th>
              <Table.Th>Reçu</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {q.data.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td className="horodatage">{new Date(r.fin).toLocaleString('fr-FR')}</Table.Td>
                <Table.Td>
                  {r.depuis} → {r.vers}
                </Table.Td>
                <Table.Td>{STATUTS_RECU[r.statut]}</Table.Td>
                <Table.Td>{duree(r.dureeSecondes)}</Table.Td>
                <Table.Td>
                  <Button
                    size="compact-sm"
                    variant="default"
                    aria-label={`Télécharger le reçu ${r.depuis} vers ${r.vers}`}
                    onClick={() => download(`/api/admin/updates/receipts/${r.id}`)}
                  >
                    Télécharger
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    </Stack>
  );
}
export function UpdatesPanel() {
  const q = useUpdateState();
  const admin = useUpdateAdmin();
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [queued, setQueued] = useState<string | null>(null);
  const [verification, setVerification] = useState(false);
  const [resultat, setResultat] = useState<{ ton: 'info' | 'erreur'; texte: string } | null>(null);
  const id = useRef<string | null>(null);
  const s = q.data;
  const busy =
    pending || verification || !!queued || !!s?.maintenance || s?.status === 'queued' || s?.status === 'running';
  useEffect(() => {
    if (queued && s?.id === queued && ['success', 'failed', 'rolled_back', 'intervention'].includes(s.status)) {
      setQueued(null);
      id.current = null;
      setConfirm('');
      setCode('');
    }
  }, [queued, s?.id, s?.status]);
  /* La vérification est confiée au service de mise à jour : on suit son état seconde après seconde, au lieu d'attendre
     la prochaine lecture périodique, et on annonce le résultat. */
  async function check() {
    setPending(true);
    setVerification(true);
    setError(null);
    setResultat(null);
    const avant = s?.checkedAt ?? null;
    try {
      await api('POST', '/api/admin/updates/check');
      setPending(false);
      const debut = Date.now();
      let vuEnCours = false;
      for (;;) {
        await attendre(PAS_DE_SUIVI_MS);
        const etat = (await q.refetch()).data;
        if (etat) {
          vuEnCours ||= etat.checking || etat.phase === 'checking';
          const termine = !etat.checking && etat.phase !== 'checking';
          if (termine && (etat.checkedAt !== avant || etat.checkError || vuEnCours)) {
            setResultat(
              etat.checkError
                ? { ton: 'erreur', texte: 'La vérification a échoué : GitHub est temporairement indisponible.' }
                : available(etat)
                  ? { ton: 'info', texte: `Une nouvelle version est disponible : ${etat.available}.` }
                  : { ton: 'info', texte: 'Vérification terminée : aucune nouvelle version.' },
            );
            break;
          }
        }
        if (Date.now() - debut > ATTENTE_MAX_MS) {
          setResultat({
            ton: 'info',
            texte: 'La vérification prend plus de temps que prévu. Le résultat s’affichera ici dès qu’il est connu.',
          });
          break;
        }
      }
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
      setVerification(false);
    }
  }
  async function install() {
    if (!s?.available) return;
    id.current ??= crypto.randomUUID();
    setPending(true);
    setError(null);
    try {
      const response = await api<{ id: string }>('POST', '/api/admin/updates/install', {
        body: { requestId: id.current, version: s.available, confirm, code },
      });
      setQueued(response.id);
      // L'écran de mise à jour s'ouvre tout de suite : il attend la prise en charge de la demande par le service.
      const retour = encodeURIComponent('/systeme/mises-a-jour');
      window.location.assign(`/update/?next=${retour}&demande=${encodeURIComponent(response.id)}`);
      return;
    } catch (e) {
      // Un code est à usage unique : toujours en saisir un nouveau après un refus.
      setCode('');
      setError(e);
    } finally {
      setPending(false);
    }
  }
  const fenetreFermee = !!s?.fenetre?.active && !s.fenetre.ouverte;
  const codeValide = /^\d{6}$/.test(code);
  return (
    <Card withBorder id="updates">
      <Stack>
        <Title order={2} size="h4">
          Mise à jour de l’application
        </Title>
        <ErrorAlert error={error || q.error} />
        <Text size="sm">
          Version installée : {s?.installed ?? '…'}.{' '}
          {available(s)
            ? `Nouvelle version : ${s?.available}.`
            : s?.checkedAt && !s.checkError
              ? 'Aucune nouvelle version détectée.'
              : 'Disponibilité à vérifier.'}
        </Text>
        {s?.notes && (
          <Anchor href={s.notes} target="_blank" rel="noreferrer">
            Consulter les nouveautés
          </Anchor>
        )}
        {s?.checkError && (
          <Text size="sm">GitHub est temporairement indisponible. La dernière information connue est conservée.</Text>
        )}
        {s?.checkedAt && (
          <Text size="xs" c="dimmed">
            Dernière vérification : {new Date(s.checkedAt).toLocaleString()}.
          </Text>
        )}
        {s?.message && (
          <Text size="sm" role="status">
            {s.message}
          </Text>
        )}
        {queued && <Text size="sm">Demande enregistrée. Ouverture de l’écran de mise à jour…</Text>}
        {!s?.ready && <Text size="sm">Le service de mise à jour n’est pas disponible actuellement.</Text>}
        {admin && (
          <>
            <Group>
              <Button
                variant="default"
                loading={verification}
                disabled={busy || !s?.ready || s?.checking}
                onClick={() => void check()}
              >
                Vérifier les mises à jour
              </Button>
              {verification && (
                <Group gap="xs" role="status">
                  <Loader size="xs" aria-hidden="true" />
                  <Text size="sm">Vérification des nouvelles versions en cours…</Text>
                </Group>
              )}
            </Group>
            {resultat && (
              <Alert
                color={resultat.ton === 'erreur' ? 'red' : 'blue'}
                role="status"
                withCloseButton
                closeButtonLabel="Masquer le résultat"
                onClose={() => setResultat(null)}
              >
                {resultat.texte}
              </Alert>
            )}
            {available(s) && (
              <>
                <Text size="sm">
                  Enregistrez vos modifications en cours. Le serveur créera une sauvegarde chiffrée, vérifiera la
                  publication et le redémarrage. Tous les utilisateurs verront la page de maintenance pendant
                  l’installation ; un retour sécurisé sera tenté en cas d’échec.
                </Text>
                {s?.fenetre?.active && (
                  <Alert color={fenetreFermee ? 'orange' : 'blue'} role="status" title="Fenêtre de maintenance">
                    {fenetreFermee
                      ? `L’installation n’est possible que ${s.fenetre.libelle}. La vérification reste disponible.`
                      : `Créneau ouvert : ${s.fenetre.libelle}.`}
                  </Alert>
                )}
                <TextInput
                  label="Taper METTRE À JOUR pour confirmer"
                  value={confirm}
                  disabled={busy || fenetreFermee}
                  onChange={(e) => setConfirm(e.currentTarget.value)}
                />
                <TextInput
                  label="Code de double authentification"
                  description="Code à 6 chiffres de votre application d’authentification, demandé à chaque installation."
                  value={code}
                  disabled={busy || fenetreFermee}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  // Pas de maxLength : un code collé avec espace (« 123 456 ») serait tronqué avant le filtrage.
                  onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
                />
                <Group>
                  <Button
                    disabled={busy || !s?.ready || fenetreFermee || confirm !== 'METTRE À JOUR' || !codeValide}
                    loading={pending}
                    onClick={() => void install()}
                  >
                    Installer la version {s?.available}
                  </Button>
                </Group>
              </>
            )}
            <UpdateReceipts />
          </>
        )}
      </Stack>
    </Card>
  );
}

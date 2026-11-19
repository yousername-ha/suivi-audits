import { Alert, Anchor, Button, Card, Group, Loader, Stack, Text, TextInput, Title } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateReceiptSummary, UpdateState } from '@suivi/shared';
import { StatusChip, type Etat } from '@suivi/ui';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, download, get } from '../api';
import { ConfirmButton, ErrorAlert } from './common';
import { CLE_FLUX_EXTERNES, FluxFermeAlerte } from './FluxExternes';
import { useValidationFlux } from './ValidationFlux';
import { useCan, useMe } from '../session';
import { ECHEC_GITHUB_PERSISTANT, issueVerification, nouvelleVersion } from '../mises-a-jour';

const ATTENTE_MAX_MS = 90_000;
const PAS_DE_SUIVI_MS = 1000;
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

function useUpdateState() {
  return useQuery({ queryKey: ['updates'], queryFn: () => get<UpdateState>('/api/updates'), refetchInterval: 15000 });
}
function useUpdateAdmin() {
  const me = useMe();
  const can = useCan();
  return !!me.user?.roles.includes('Administrateur') && can('administration', 'administrer');
}
export function UpdateNotice() {
  const q = useUpdateState();
  const admin = useUpdateAdmin();
  if (!nouvelleVersion(q.data)) return <div data-native-updates hidden />;
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
const ETATS_RECU: Record<UpdateReceiptSummary['statut'], Etat> = {
  success: 'succes',
  rolled_back: 'attention',
  failed: 'erreur',
  intervention: 'erreur',
};
const duree = (s: number | null) => (s == null ? '—' : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`);
/** Nombre de reçus affichés (décision du RSSI du 19/11/2026) : les plus récents, l'API les renvoyant du plus récent au plus
    ancien. Les reçus plus anciens restent sur le serveur (dossier d'état). */
export const RECUS_AFFICHES = 3;
export const derniersRecus = (recus: readonly UpdateReceiptSummary[]) => recus.slice(0, RECUS_AFFICHES);
/** Preuves de changement : reçus structurés écrits par le service de mise à jour, téléchargeables en JSON, avec les SBOM
    vérifiés de chaque composant. Présentés en cartes compactes, du plus récent au plus ancien. */
export function RecusInstallations() {
  const q = useQuery({
    queryKey: ['updates', 'receipts'],
    queryFn: () => get<UpdateReceiptSummary[]>('/api/admin/updates/receipts'),
  });
  const titre = useId();
  if (!q.data?.length) return null;
  return (
    <section className="maj-recus" aria-labelledby={titre}>
      <Title order={3} size="h5" id={titre}>
        Reçus des dernières installations
      </Title>
      <ol className="maj-recus__liste">
        {derniersRecus(q.data).map((r) => (
          <li key={r.id} className="maj-recu">
            <div className="maj-recu__tete">
              <span className="maj-recu__versions chiffres">
                {r.depuis} <span aria-hidden="true">→</span>
                <span className="sr-only"> vers </span> {r.vers}
              </span>
              <StatusChip etat={ETATS_RECU[r.statut]}>{STATUTS_RECU[r.statut]}</StatusChip>
            </div>
            <dl className="maj-recu__details">
              <div>
                <dt>Fin</dt>
                <dd className="horodatage">{new Date(r.fin).toLocaleString('fr-FR')}</dd>
              </div>
              <div>
                <dt>Durée</dt>
                <dd className="chiffres">{duree(r.dureeSecondes)}</dd>
              </div>
            </dl>
            <div className="maj-recu__actions">
              <Button
                size="compact-sm"
                variant="default"
                aria-label={`Télécharger le reçu ${r.depuis} vers ${r.vers}`}
                onClick={() => download(`/api/admin/updates/receipts/${r.id}`)}
              >
                Télécharger
              </Button>
              <span className="maj-libelle">SBOM vérifiés</span>
              {r.sbom?.length ? (
                <Group gap="2xs">
                  {r.sbom.map((c) => (
                    <Button
                      key={c}
                      size="compact-sm"
                      variant="subtle"
                      aria-label={`Télécharger le SBOM ${c} de la version ${r.vers}`}
                      onClick={() => download(`/api/admin/updates/receipts/${r.id}/sbom/${c}`)}
                    >
                      {c}
                    </Button>
                  ))}
                </Group>
              ) : (
                <span className="maj-vide">aucun</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
/** Pastille d'état du bloc des versions (composition de la page de maintenance, dans le thème de l'application). */
export function etatMiseAJour(
  s: UpdateState | undefined,
  o: { verification: boolean; fluxFerme: boolean },
): { etat: Etat; libelle: string } {
  if (!s) return { etat: 'neutre', libelle: 'Lecture de l’état…' };
  if (o.verification || s.checking) return { etat: 'info', libelle: 'Vérification en cours' };
  if (s.maintenance || s.status === 'queued' || s.status === 'running')
    return { etat: 'info', libelle: 'Installation en cours' };
  if (o.fluxFerme) return { etat: 'attention', libelle: 'Flux fermé' };
  if (!s.ready) return { etat: 'attention', libelle: 'Service indisponible' };
  if (nouvelleVersion(s)) return { etat: 'info', libelle: 'Nouvelle version disponible' };
  if (s.checkError) return { etat: 'attention', libelle: 'Dernière vérification en échec' };
  if (s.checkedAt) return { etat: 'succes', libelle: 'À jour' };
  return { etat: 'neutre', libelle: 'Disponibilité à vérifier' };
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
  const flux = useValidationFlux();
  const qc = useQueryClient();
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
      const demande = await api<{ id?: string } | undefined>('POST', '/api/admin/updates/check');
      setPending(false);
      const debut = Date.now();
      for (;;) {
        await attendre(PAS_DE_SUIVI_MS);
        const etat = (await q.refetch()).data;
        const issue = etat ? issueVerification(etat, { id: demande?.id ?? null, checkedAt: avant }) : null;
        if (issue) {
          setResultat(issue);
          break;
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
  // Flux « mises-a-jour » fermé (ADR 0097) : ni vérification ni installation ; inconnu (champ absent), rien n'est bloqué.
  const fluxFerme = s?.fluxOuvert === false;
  /* Activer les mises à jour depuis l'interface, c'est ouvrir leur flux (ADR 0097, précision du RSSI du 15/11/2026) :
     validation explicite une fois ; les désactiver le referme. */
  async function basculerFlux(ouvert: boolean) {
    if (ouvert && !(await flux.valider('mises-a-jour'))) return;
    setPending(true);
    setError(null);
    try {
      await api('PUT', '/api/admin/flux-externes/mises-a-jour', { body: { ouvert, confirmation: true } });
      await q.refetch();
      await qc.invalidateQueries({ queryKey: CLE_FLUX_EXTERNES });
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  const codeValide = /^\d{6}$/.test(code);
  const pastille = etatMiseAJour(s, { verification, fluxFerme });
  return (
    <Card withBorder id="updates" className="maj">
      <Stack>
        <div className="maj-entete">
          <Title order={2} size="h4">
            Mise à jour de l’application
          </Title>
          <StatusChip etat={pastille.etat}>{pastille.libelle}</StatusChip>
        </div>
        <ErrorAlert error={error || q.error} />
        <div className="maj-versions">
          <p className="maj-version">
            <span className="maj-libelle">Version installée</span>
            <strong className="chiffres">{s?.installed ?? '…'}</strong>
          </p>
          {nouvelleVersion(s) ? (
            <>
              <span className="maj-fleche" aria-hidden="true" />
              <p className="maj-version maj-version--cible">
                <span className="maj-libelle">Version disponible</span>
                <strong className="chiffres">{s?.available}</strong>
                <span className="maj-libelle maj-etiquette">Nouvelle version</span>
              </p>
            </>
          ) : (
            <p className="maj-version maj-version--note">
              <span className="maj-libelle">Version disponible</span>
              <span>
                {s?.checkedAt && !s.checkError ? 'Aucune nouvelle version détectée.' : 'Disponibilité à vérifier.'}
              </span>
            </p>
          )}
        </div>
        {(s?.notes || s?.checkedAt) && (
          <Group gap="xs" justify="center" className="maj-meta">
            {s?.checkedAt && (
              <Text size="xs" c="dimmed" className="horodatage">
                Dernière vérification : {new Date(s.checkedAt).toLocaleString()}.
              </Text>
            )}
            {s?.notes && (
              <Anchor href={s.notes} target="_blank" rel="noreferrer" size="sm">
                Consulter les nouveautés
              </Anchor>
            )}
          </Group>
        )}
        {s?.checkError && <Text size="sm">{ECHEC_GITHUB_PERSISTANT}</Text>}
        {s?.message && (
          <Text size="sm" role="status">
            {s.message}
          </Text>
        )}
        {queued && <Text size="sm">Demande enregistrée. Ouverture de l’écran de mise à jour…</Text>}
        {!s?.ready && <Text size="sm">Le service de mise à jour n’est pas disponible actuellement.</Text>}
        {fluxFerme && <FluxFermeAlerte module="mises-a-jour" />}
        {admin && s?.fluxOuvert !== undefined && (
          <Group>
            {fluxFerme ? (
              <Button variant="default" disabled={pending} onClick={() => void basculerFlux(true)}>
                Activer les mises à jour depuis l’interface
              </Button>
            ) : (
              <ConfirmButton
                variant="subtle"
                color="red"
                disabled={busy}
                message="Désactiver les mises à jour depuis l’interface ? Le flux vers GitHub et le registre d’images est refermé : plus aucune vérification ni installation jusqu’à sa réactivation."
                onConfirm={() => void basculerFlux(false)}
              >
                Désactiver les mises à jour depuis l’interface
              </ConfirmButton>
            )}
            {flux.fenetre}
          </Group>
        )}
        {admin && (
          <>
            <Group>
              <Button
                variant="default"
                loading={verification}
                disabled={busy || fluxFerme || !s?.ready || s?.checking}
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
            {nouvelleVersion(s) && (
              <div className="maj-operation">
                <Stack gap="sm">
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
                    disabled={busy || fluxFerme || fenetreFermee}
                    onChange={(e) => setConfirm(e.currentTarget.value)}
                  />
                  <TextInput
                    label="Code de double authentification"
                    description="Code à 6 chiffres de votre application d’authentification, demandé à chaque installation."
                    value={code}
                    disabled={busy || fluxFerme || fenetreFermee}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    // Pas de maxLength : un code collé avec espace (« 123 456 ») serait tronqué avant le filtrage.
                    onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <Group>
                    <Button
                      disabled={
                        busy || fluxFerme || !s?.ready || fenetreFermee || confirm !== 'METTRE À JOUR' || !codeValide
                      }
                      loading={pending}
                      onClick={() => void install()}
                    >
                      Installer la version {s?.available}
                    </Button>
                  </Group>
                </Stack>
              </div>
            )}
            <RecusInstallations />
          </>
        )}
      </Stack>
    </Card>
  );
}

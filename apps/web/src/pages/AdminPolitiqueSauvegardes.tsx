/* Planification et conservation des sauvegardes (lot A, ADR 0106) : créneau UTC, durée de conservation, nombre maximal de
   sauvegardes régulières et nombre de sauvegardes d'avant mise à jour, transmis à l'exécutant d'exploitation. Une seule
   politique versionnée (If-Match) ; la destination et les clés restent configurées sur le serveur. */
import { Button, Card, Group, MultiSelect, NumberInput, Stack, Switch, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  CONSERVATION_SAUVEGARDES,
  SEUIL_ESPACE_LIBRE_POURCENT,
  nextBackupAt,
  type BackupPolicyOut,
  type ExploitationOut,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, get } from '../api';
import { ConfirmButton, ErrorAlert, fmtDate, fmtOctets } from '../components/common';
import { useCan } from '../session';

const KEY = ['admin', 'exploitation'];
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((label, i) => ({
  value: String(i + 1),
  label,
}));
const { maxBackups: MAX, preUpdateBackups: AVANT } = CONSERVATION_SAUVEGARDES;

export function PolitiqueSauvegardesPanel() {
  const q = useQuery({
    queryKey: KEY,
    queryFn: () => get<ExploitationOut>('/api/admin/exploitation'),
    refetchInterval: 5000,
  });
  const qc = useQueryClient();
  const admin = useCan()('administration', 'administrer');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [draft, setDraft] = useState<BackupPolicyOut | null>(null);
  const host = q.data?.host;
  const policy = draft ?? q.data?.policy;
  const setPolicy = (patch: Partial<BackupPolicyOut>) => policy && setDraft({ ...policy, ...patch });
  const next = policy ? nextBackupAt(policy) : null;
  const disque = host?.disque;
  const enregistrer = async (p: BackupPolicyOut) => {
    setPending(true);
    setError(null);
    try {
      const { version, ...body } = p;
      await api('PUT', '/api/admin/exploitation/politique', { body, ifMatch: version });
      setDraft(null);
      await qc.invalidateQueries({ queryKey: KEY });
      notifications.show({ message: 'Politique enregistrée.', color: 'teal' });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };
  return (
    <Card withBorder>
      <Stack>
        <Title order={2} size="h4">
          Planification et conservation
        </Title>
        <ErrorAlert error={error ?? q.error} />
        <Text size="sm">
          La destination et la clé de chiffrement restent configurées sur le serveur. La politique ci-dessous s’applique
          aux sauvegardes exécutées par le pilotage web et aux mises à jour lancées depuis l’interface.
        </Text>
        {host?.destination && <Text size="sm">Destination configurée : {host.destination}</Text>}
        {disque && (
          <Text size="sm" data-espace-disque>
            {`Disque des données : ${fmtOctets(disque.libreOctets)} libres sur ${fmtOctets(disque.totalOctets)} ` +
              `(${Math.floor((100 * disque.libreOctets) / disque.totalOctets)} %, alerte sous ${SEUIL_ESPACE_LIBRE_POURCENT} %). ` +
              `Sauvegardes : ${fmtOctets(disque.sauvegardesOctets)} ; images de l’application : ` +
              `${disque.imagesOctets === null ? 'non mesurées' : fmtOctets(disque.imagesOctets)}.`}
          </Text>
        )}
        {policy && (
          <>
            <Switch
              label="Activer la sauvegarde planifiée"
              checked={policy.enabled}
              disabled={!admin || pending}
              onChange={(e) => setPolicy({ enabled: e.currentTarget.checked })}
            />
            <MultiSelect
              label="Jours de sauvegarde"
              data={DAYS}
              value={policy.days.map(String)}
              disabled={!admin || pending}
              onChange={(v) => setPolicy({ days: v.map(Number) })}
            />
            <Group grow>
              <NumberInput
                label="Heure UTC"
                min={0}
                max={23}
                allowDecimal={false}
                value={policy.hourUtc}
                disabled={!admin || pending}
                onChange={(v) => setPolicy({ hourUtc: Number(v) })}
              />
              <NumberInput
                label="Minute UTC"
                min={0}
                max={59}
                allowDecimal={false}
                value={policy.minuteUtc}
                disabled={!admin || pending}
                onChange={(v) => setPolicy({ minuteUtc: Number(v) })}
              />
            </Group>
            <Text size="sm">
              {next
                ? `Prochain créneau prévu : ${fmtDate(next)} (heure locale affichée ; programmation UTC).`
                : 'Planification désactivée.'}
            </Text>
            <NumberInput
              label="Rétention (jours)"
              min={1}
              max={36500}
              allowDecimal={false}
              value={policy.retentionDays}
              disabled={!admin || pending}
              onChange={(v) => setPolicy({ retentionDays: Number(v) })}
            />
            <Group grow>
              <NumberInput
                label="Nombre maximal de sauvegardes"
                description={`De ${MAX.min} à ${MAX.max} ; ${MAX.defaut} par défaut.`}
                min={MAX.min}
                max={MAX.max}
                allowDecimal={false}
                value={policy.maxBackups}
                disabled={!admin || pending}
                onChange={(v) => setPolicy({ maxBackups: Number(v) })}
              />
              <NumberInput
                label="Sauvegardes d’avant mise à jour gardées"
                description={`De ${AVANT.min} à ${AVANT.max} ; ${AVANT.defaut} par défaut.`}
                min={AVANT.min}
                max={AVANT.max}
                allowDecimal={false}
                value={policy.preUpdateBackups}
                disabled={!admin || pending}
                onChange={(v) => setPolicy({ preUpdateBackups: Number(v) })}
              />
            </Group>
            <Text size="sm" c="dimmed">
              Une sauvegarde est supprimée, avec son empreinte, dès qu’elle dépasse la rétention ou le nombre maximal ;
              les plus récentes (BACKUP_GARDER_MIN sur le serveur, 7 par défaut) sont toujours gardées. Une baisse prend
              effet à la prochaine sauvegarde : externalisez d’abord les archives à garder. Les sauvegardes de sécurité
              des restaurations ne sont jamais supprimées. Le guide explique comment éviter un doublon avec un cron
              existant.
            </Text>
            {admin && (
              <Group>
                <ConfirmButton
                  disabled={
                    pending ||
                    !policy.days.length ||
                    !(policy.maxBackups >= MAX.min && policy.maxBackups <= MAX.max) ||
                    !(policy.preUpdateBackups >= AVANT.min && policy.preUpdateBackups <= AVANT.max)
                  }
                  message="Enregistrer cette planification et cette conservation ? Les prochaines sauvegardes et mises à jour l’appliqueront ; les archives au-delà de la rétention ou du nombre maximal seront supprimées."
                  onConfirm={() => void enregistrer(policy)}
                >
                  Enregistrer la politique
                </ConfirmButton>
                <Button
                  variant="default"
                  disabled={pending}
                  onClick={() => {
                    setDraft(null);
                    void q.refetch();
                  }}
                >
                  Recharger la politique
                </Button>
              </Group>
            )}
          </>
        )}
      </Stack>
    </Card>
  );
}

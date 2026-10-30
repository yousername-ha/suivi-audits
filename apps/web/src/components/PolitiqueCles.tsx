/* Administration, Sécurité : politique des clés de sécurité FIDO2 / WebAuthn (ADR 0079) et configuration de la relying party
   (RP_ID, RP_ORIGINS, lue seulement : elle vient du serveur). Enregistrement avec If-Match ; chaque changement est journalisé. */
import { Alert, Button, Card, Code, Group, NumberInput, Stack, Switch, Text, Textarea, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { AAGUID_CONNUS, type WebauthnPolitique, type WebauthnPolitiqueOut } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, errorMessage, get } from '../api';
import { ErrorAlert, fmtDate } from './common';

const CLE = ['admin', 'webauthn', 'politique'] as const;
const SOURCES = {
  env: 'variables RP_ID et RP_ORIGINS',
  adresse_site: 'déduite de l’adresse du site',
  aucune: 'aucune',
} as const;

const lignes = (v: string) =>
  v
    .split(/[\s,;]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
const certificats = (v: string) => v.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];

export function PolitiqueClesPanel({ ecriture }: { ecriture: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: CLE, queryFn: () => get<WebauthnPolitiqueOut>('/api/admin/webauthn/policy') });
  const [p, setP] = useState<WebauthnPolitique | null>(null);
  const [aaguids, setAaguids] = useState('');
  const [racines, setRacines] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!q.data) return;
    setP(q.data.politique);
    setAaguids(q.data.politique.aaguidAutorises.join('\n'));
    setRacines(q.data.politique.racinesSupplementaires.join('\n\n'));
  }, [q.data]);
  const d = q.data;
  const ro = !ecriture || !d?.serveur.disponible;
  return (
    <Card withBorder>
      <Title order={2} size="h4" mb="xs">
        Clés de sécurité (FIDO2 / WebAuthn)
      </Title>
      <ErrorAlert error={q.error} />
      {d && p && (
        <Stack>
          {d.serveur.disponible ? (
            <Text size="sm">
              Relying party : <Code>{d.serveur.rpId}</Code> ({SOURCES[d.serveur.source]}), origines acceptées :{' '}
              {d.serveur.origines.map((o) => (
                <Code key={o}>{o}</Code>
              ))}
              . Changer l’adresse du site rend les clés déjà enregistrées inutilisables (le code TOTP reste valable).
            </Text>
          ) : (
            <Alert color="orange">
              Clés non proposées : {d.serveur.raison}. Renseignez une adresse de site en nom de domaine (HTTPS), ou
              RP_ID et RP_ORIGINS dans la configuration du serveur.
            </Alert>
          )}
          <Switch
            label="Clé obligatoire pour les administrateurs"
            description="Comptes qui détiennent le droit « Administration : administrer ». Le code TOTP reste accepté en secours ; chaque usage déclenche une alerte."
            checked={p.obligatoireAdmins}
            disabled={ro}
            onChange={(e) => setP({ ...p, obligatoireAdmins: e.currentTarget.checked })}
          />
          <NumberInput
            label="Période de grâce pour l’enrôlement (jours)"
            description={
              d.activeeLe
                ? `Obligation active depuis le ${fmtDate(d.activeeLe)} : délai compté à partir de cette date (ou de la création du compte).`
                : 'Délai laissé aux administrateurs pour enregistrer leur clé après l’activation.'
            }
            min={0}
            max={90}
            w="fit-content"
            value={p.graceJours}
            disabled={ro}
            onChange={(v) => setP({ ...p, graceJours: typeof v === 'number' ? v : 0 })}
          />
          <Switch
            label="Clés matérielles uniquement"
            description="Attestation exigée et vérifiée jusqu’à une autorité racine (Yubico, plus celles ajoutées ci-dessous), modèle (AAGUID) dans la liste. Les passkeys synchronisées et Windows Hello sont alors refusés, sauf AAGUID ajouté."
            checked={p.materielUniquement}
            disabled={ro}
            onChange={(e) => setP({ ...p, materielUniquement: e.currentTarget.checked })}
          />
          {p.materielUniquement && (
            <>
              <Textarea
                label="Modèles autorisés (AAGUID, un par ligne)"
                autosize
                minRows={3}
                className="mono"
                value={aaguids}
                disabled={ro}
                onChange={(e) => setAaguids(e.currentTarget.value)}
              />
              <Group gap="xs">
                <Button
                  size="compact-sm"
                  variant="default"
                  disabled={ro}
                  onClick={() =>
                    setAaguids([...new Set([...lignes(aaguids), ...AAGUID_CONNUS.map((a) => a.aaguid)])].join('\n'))
                  }
                >
                  Ajouter les YubiKey 5 courantes
                </Button>
                <Text size="xs" c="dimmed">
                  {AAGUID_CONNUS.length} modèles USB et NFC (FIDO Metadata Service).
                </Text>
              </Group>
              <Textarea
                label="Autorités racines supplémentaires (PEM)"
                description="Facultatif : les racines FIDO de Yubico sont déjà incluses."
                autosize
                minRows={2}
                className="mono"
                value={racines}
                disabled={ro}
                onChange={(e) => setRacines(e.currentTarget.value)}
              />
            </>
          )}
          <Text size="xs" c="dimmed">
            Connexion sans mot de passe (passkeys) : prévue, désactivée dans cette version.
          </Text>
          {err && <Alert color="red">{err}</Alert>}
          {ecriture && (
            <Button
              w="fit-content"
              loading={busy}
              disabled={ro}
              onClick={async () => {
                setErr(null);
                setBusy(true);
                try {
                  await api('PUT', '/api/admin/webauthn/policy', {
                    body: { ...p, aaguidAutorises: lignes(aaguids), racinesSupplementaires: certificats(racines) },
                    ifMatch: d.version,
                  });
                  notifications.show({ color: 'teal', message: 'Politique des clés de sécurité enregistrée.' });
                  await qc.invalidateQueries({ queryKey: CLE });
                } catch (x) {
                  setErr(errorMessage(x));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Enregistrer la politique
            </Button>
          )}
        </Stack>
      )}
    </Card>
  );
}

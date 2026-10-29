/* Adresse du site (ADR 0077) : adresse en service, et changement (code de double authentification). L'exécutant du serveur
   l'applique sous une minute : l'application et le frontal redémarrent, l'ancienne adresse reste joignable avec le
   certificat interne. */
import { Alert, Badge, Button, Card, Code, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { estAdresseSite, type AdresseSiteEtat } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get } from '../api';
import { useCan } from '../session';
import { ErrorAlert, fmtDate } from './common';

const CLE = ['admin', 'adresse-site'] as const;

export function AdresseSitePanel() {
  const qc = useQueryClient();
  const peutAdministrer = useCan()('administration', 'administrer');
  const q = useQuery({
    queryKey: CLE,
    queryFn: () => get<AdresseSiteEtat>('/api/admin/adresse-site'),
    refetchInterval: (r) =>
      r.state.data?.demandee && r.state.data.demandee !== r.state.data.actuelle ? 10_000 : false,
  });
  const [adresse, setAdresse] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const etat = q.data;
  if (!etat) return <ErrorAlert error={q.error} />;
  const enAttente = !!etat.demandee && etat.demandee !== etat.actuelle;
  const valide = estAdresseSite(adresse.trim().toLowerCase());
  const pret = valide && adresse.trim().toLowerCase() !== etat.actuelle && /^\d{6}$/.test(code);

  async function envoyer() {
    setPending(true);
    setError(null);
    try {
      qc.setQueryData(
        CLE,
        await api<AdresseSiteEtat>('POST', '/api/admin/adresse-site', { body: { adresse: adresse.trim(), code } }),
      );
      setAdresse('');
    } catch (e) {
      setError(e);
    } finally {
      setCode('');
      setPending(false);
    }
  }

  return (
    <Card component="section" withBorder padding="md" aria-labelledby="adresse-site-titre">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={3} id="adresse-site-titre">
            Adresse du site
          </Title>
          {enAttente && (
            <Badge color="orange" variant="light">
              Changement en cours
            </Badge>
          )}
        </Group>
        <Text size="sm">
          Adresse en service : <Code>{etat.actuelle ?? '—'}</Code>.{' '}
          {enAttente &&
            `Passage à « ${etat.demandee} » demandé le ${fmtDate(etat.demandeeLe)} par ${etat.demandeePar ?? '—'} : l’application redémarre sous une minute, puis ouvrez-la à cette adresse.`}
        </Text>
        <ErrorAlert error={error} />
        {peutAdministrer && (
          <>
            <TextInput
              label="Nouvelle adresse"
              description="Nom DNS ou adresse IP, sans https:// ni port. Pour un certificat ACME ou de votre PKI, le choisir ensuite dans Certificats et opérations."
              autoComplete="off"
              spellCheck={false}
              maxLength={253}
              value={adresse}
              onChange={(e) => setAdresse(e.currentTarget.value)}
              error={adresse.trim() !== '' && !valide ? 'Adresse invalide.' : undefined}
            />
            <TextInput
              label="Code de double authentification"
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
            />
            <Alert color="orange" role="note">
              L’application et le frontal redémarrent (quelques secondes d’interruption) ; l’ancienne adresse reste
              joignable avec le certificat interne.
            </Alert>
            <Group>
              <Button disabled={!pret || pending} loading={pending} onClick={() => void envoyer()}>
                Changer l’adresse
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Card>
  );
}

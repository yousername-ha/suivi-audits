/* Module Vulnérabilités (ADR 0100, point 9 ; lot V4a) : écran « Seuils de priorité ». La grille est calculée par la
   plateforme (fonction pure du paquet partagé) ; seul le seuil du score EPSS se règle, avec le droit d'administrer le
   module et If-Match. Lecture avec le droit de lire le module. Composants de la charte, CSP stricte (ADR 0006). */
import { Alert, Button, Group, List, NumberInput, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { type ReglagePrioriteOut } from '@suivi/shared';
import { ErrorAlert, Page, PageHeader } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, get } from '../api';
import { useCan } from '../session';

const CLE = ['vulnerabilites', 'priorite', 'reglage'] as const;

/** Seuil en pourcentage pour la saisie (0,5 → 50). */
export const enPourcentage = (x: number) => Math.round(x * 10000) / 100;
/** Pourcentage saisi en probabilité (50 → 0,5) ; null si hors de 1 à 100. */
export function depuisPourcentage(v: number | string): number | null {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 1 || n > 100) return null;
  return Math.round(n * 100) / 10000;
}

/** Grille de départ, en clair (sans état). */
export function GrillePriorite({ seuilEpss }: { seuilEpss: number }) {
  const seuil = `${enPourcentage(seuilEpss).toLocaleString('fr-FR')} %`;
  return (
    <List size="sm" spacing="2xs">
      <List.Item>
        <strong>P1</strong> : exploitation avérée (catalogue KEV ou alerte du CERT-FR) et faille présente, détectée par
        Tenable ou déclarée par un produit surveillé.
      </List.Item>
      <List.Item>
        <strong>P2</strong> : exploitation avérée et produit à confirmer ; ou faille présente et critique ; ou présente
        et score EPSS d’au moins {seuil} ; ou présente, élevée et avec un code d’exploitation disponible.
      </List.Item>
      <List.Item>
        <strong>P3</strong> : faille présente et élevée.
      </List.Item>
      <List.Item>
        <strong>P4</strong> : le reste.
      </List.Item>
    </List>
  );
}

export function SeuilsPrioritePage() {
  const can = useCan();
  const lire = can('vulnerabilites', 'lire');
  const reglage = useQuery({
    queryKey: CLE,
    queryFn: () => get<ReglagePrioriteOut>('/api/vulnerabilites/priorite/reglage'),
    enabled: lire,
  });
  if (!lire)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit de lire les vulnérabilités.</Alert>
      </Page>
    );
  return (
    <Page>
      <PageHeader
        title="Seuils de priorité"
        description="La plateforme calcule la priorité de chaque faille, détectée ou déclarée, par une grille fixe et rejouable : jamais par le modèle. Chaque priorité affiche les faits qui la fondent. Aucun taux n’est calculé."
      />
      <Stack>
        <ErrorAlert error={reglage.error} />
        {reglage.data && (
          <>
            <Title order={2} size="h4">
              Grille appliquée
            </Title>
            <GrillePriorite seuilEpss={reglage.data.values.seuilEpss} />
            <Title order={2} size="h4">
              Seuil du score EPSS
            </Title>
            <ReglageSeuil
              key={reglage.data.version}
              reglage={reglage.data}
              administrer={can('vulnerabilites', 'administrer')}
            />
          </>
        )}
      </Stack>
    </Page>
  );
}

/** Saisie du seuil (réinitialisée à chaque nouvelle version du réglage). */
function ReglageSeuil({ reglage, administrer }: { reglage: ReglagePrioriteOut; administrer: boolean }) {
  const qc = useQueryClient();
  const [saisie, setSaisie] = useState<number | string>(enPourcentage(reglage.values.seuilEpss));
  const [envoi, setEnvoi] = useState(false);
  const seuil = depuisPourcentage(saisie);
  const enregistrer = async () => {
    if (seuil === null) return;
    setEnvoi(true);
    try {
      await api('PUT', '/api/vulnerabilites/priorite/reglage', {
        body: { seuilEpss: seuil },
        ifMatch: reglage.version,
      });
      notifications.show({ color: 'teal', message: 'Seuil de priorité enregistré.' });
      await qc.invalidateQueries({ queryKey: ['vulnerabilites'] });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Stack>
      <Text size="sm">
        Le score EPSS est une probabilité d’exploitation publiée par le FIRST, pas un constat. Les gravités de la grille
        sont fixes.
      </Text>
      <Group align="flex-end">
        <NumberInput
          label="Seuil EPSS (en %)"
          description="Entre 1 et 100 ; 50 par défaut."
          min={1}
          max={100}
          decimalScale={2}
          decimalSeparator=","
          value={saisie}
          onChange={setSaisie}
          disabled={!administrer}
        />
        {administrer && (
          <Button loading={envoi} disabled={seuil === null} onClick={() => void enregistrer()}>
            Enregistrer
          </Button>
        )}
      </Group>
      {!administrer && (
        <Text size="sm" c="dimmed">
          Régler le seuil demande le droit d’administrer le module Vulnérabilités.
        </Text>
      )}
    </Stack>
  );
}

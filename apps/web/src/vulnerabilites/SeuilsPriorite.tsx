/* Module Vulnérabilités (ADR 0100, point 9 ; lot V4a) : écran « Seuils de priorité ». La grille est calculée par la
   plateforme (fonction pure du paquet partagé) ; seul le seuil du score EPSS se règle, avec le droit d'administrer le
   module et If-Match. Lecture avec le droit de lire le module. Composants de la charte, CSP stricte (ADR 0006).
   Lot S1 : délai cible de correction par priorité, réglé ici avec le même droit, la même version (If-Match) et le même
   journal ; valeurs par défaut à confirmer par le RSSI. */
import { Alert, Button, Group, List, NumberInput, Select, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  DELAIS_CORRECTION_DEFAUT,
  libelleDelai,
  NIVEAUX_PRIORITE,
  type ReglagePrioriteOut,
  type UniteDelai,
} from '@suivi/shared';
import { DataTable, ErrorAlert, Page, PageHeader } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, get } from '../api';
import { useCan } from '../session';
import { depuisSaisie, type SaisieDelais, versSaisie } from './delais';

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
        <strong>P1</strong> : exploitation avérée (catalogue KEV, alerte du CERT-FR, fiche du CERT Santé,
        AlgoLightHouse, ou contrôle exploité par un logiciel malveillant selon Tenable) et faille présente, détectée par
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
      <List.Item>
        <strong>Fin de support</strong> : une faille présente sur une machine en fin de support (un système ou un
        produit qu’elle porte n’est plus maintenu par l’éditeur, date de Tenable passée) gagne un cran : P4 devient P3,
        P3 devient P2, P2 devient P1 ; P1 reste P1. Le fait est cité dans l’explication de la priorité. Le contrôle qui
        signale lui-même la fin de support ne monte pas, et ce cran ne se cumule pas avec celui d’un actif exposé relié
        à une machine interne vulnérable (un seul cran au plus).
      </List.Item>
      <List.Item>
        <strong>Rançongiciels</strong> : la mention du catalogue KEV « utilisée par des rançongiciels » est citée dans
        l’explication ; elle ne change pas le niveau, mais à priorité égale ces failles passent devant dans les listes.
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
            <Title order={2} size="h4">
              Délais de correction
            </Title>
            <ReglageDelais
              key={`delais-${reglage.data.version}`}
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

const CHOIX_UNITE = [
  { value: 'aucun', label: 'Aucun délai' },
  { value: 'heures', label: 'Heures' },
  { value: 'jours', label: 'Jours' },
];
const DEFAUTS = NIVEAUX_PRIORITE.map((p) => `${p} ${libelleDelai(DELAIS_CORRECTION_DEFAUT[p])}`).join(', ');

/** Délai cible de correction par priorité (lot S1), réinitialisé à chaque nouvelle version du réglage. */
function ReglageDelais({ reglage, administrer }: { reglage: ReglagePrioriteOut; administrer: boolean }) {
  const qc = useQueryClient();
  const [saisie, setSaisie] = useState<SaisieDelais>(() => versSaisie(reglage.values.delais));
  const [envoi, setEnvoi] = useState(false);
  const { delais, erreur } = depuisSaisie(saisie);
  const enregistrer = async () => {
    if (!delais) return;
    setEnvoi(true);
    try {
      await api('PUT', '/api/vulnerabilites/priorite/reglage', { body: { delais }, ifMatch: reglage.version });
      notifications.show({ color: 'teal', message: 'Délais de correction enregistrés.' });
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
        Délai cible pour corriger une faille suivie, selon sa priorité courante. Il court depuis la première présence
        connue chez nous (première détection de Tenable, ou date du rapprochement d’une faille déclarée), ou depuis la
        fin d’une exception. L’échéance est calculée par la plateforme ; une faille close, sous exception ou que la
        source ne rapporte plus n’est jamais en dépassement. Un jour vaut 24 heures. Valeurs par défaut, à confirmer par
        le RSSI : {DEFAUTS}.
      </Text>
      <DataTable label="Délais de correction par priorité">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Priorité</Table.Th>
              <Table.Th>Unité</Table.Th>
              <Table.Th>Durée</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {NIVEAUX_PRIORITE.map((p) => {
              const x = saisie[p];
              return (
                <Table.Tr key={p}>
                  <Table.Td>{p}</Table.Td>
                  <Table.Td>
                    <Select
                      label={`Unité du délai ${p}`}
                      allowDeselect={false}
                      value={x.actif ? x.unite : 'aucun'}
                      onChange={(v) =>
                        setSaisie({
                          ...saisie,
                          [p]:
                            v === 'aucun' || !v
                              ? { ...x, actif: false }
                              : { ...x, actif: true, unite: v as UniteDelai },
                        })
                      }
                      data={CHOIX_UNITE}
                      disabled={!administrer}
                      comboboxProps={{ withinPortal: false }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      label={`Durée du délai ${p}`}
                      min={1}
                      max={x.unite === 'jours' ? 365 : 8760}
                      allowDecimal={false}
                      value={x.actif ? x.duree : ''}
                      onChange={(v) => setSaisie({ ...saisie, [p]: { ...x, duree: v } })}
                      disabled={!administrer || !x.actif}
                    />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </DataTable>
      {erreur && (
        <Text size="sm" c="red" role="alert">
          {erreur}
        </Text>
      )}
      {administrer ? (
        <Group>
          <Button loading={envoi} disabled={!delais} onClick={() => void enregistrer()}>
            Enregistrer les délais
          </Button>
        </Group>
      ) : (
        <Text size="sm" c="dimmed">
          Régler les délais demande le droit d’administrer le module Vulnérabilités.
        </Text>
      )}
    </Stack>
  );
}

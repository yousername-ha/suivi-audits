/* Module Vulnérabilités et assistant RSSI (ADR 0100, décision V31) : écran « Mots à ne pas masquer ». Le masque des machines
   reste strict ; cette liste, tenue avec le droit d'administrer le module, laisse sortir un mot seul quand une machine porte
   le nom d'une application (« dpi », « pacs », « web »). Pour chaque mot, et à la saisie d'un nouveau mot, l'écran dit ce que
   le mot laisse sortir : le nombre de machines de l'inventaire dont il est le nom court, et leur nom seulement si la personne
   peut les lire. If-Match à chaque ajout ou retrait. Composants de la charte, CSP stricte (ADR 0006). */
import { Alert, Button, Group, List, Stack, Text, TextInput, Title } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  cleMotNonMasque,
  type EffetMotNonMasque,
  libelleEffetMot,
  MOTS_NON_MASQUES_MAX,
  type ReglageMasqueOut,
  refusMotNonMasque,
} from '@suivi/shared';
import { ErrorAlert, Page, PageHeader } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, get } from '../api';
import { useCan } from '../session';

const CLE = ['vulnerabilites', 'masque', 'reglage'] as const;
const URL_REGLAGE = '/api/vulnerabilites/masque/reglage';

/** Contrôle d'un nouveau mot avant l'envoi : forme admise, pas déjà dans la liste, liste non pleine. Null si admis. */
export function controleNouveauMot(saisie: string, mots: readonly string[]): string | null {
  const mot = saisie.trim();
  if (!mot) return null;
  const refus = refusMotNonMasque(mot);
  if (refus) return refus;
  if (mots.some((m) => cleMotNonMasque(m) === cleMotNonMasque(mot))) return 'Ce mot figure déjà dans la liste.';
  if (mots.length >= MOTS_NON_MASQUES_MAX) return `La liste compte déjà ${MOTS_NON_MASQUES_MAX} mots.`;
  return null;
}

/** Ce que le mot laisse sortir, en clair ; noms des machines lisibles seulement, les autres comptées. */
export function EffetMot({ effet }: { effet: EffetMotNonMasque }) {
  const autres = effet.machines - effet.nonLisibles - effet.noms.length;
  return (
    <Stack gap="2xs">
      <Text size="sm">{libelleEffetMot(effet)}</Text>
      {effet.noms.length > 0 && (
        <Text size="sm" c="dimmed">
          Machines : {effet.noms.join(', ')}
          {autres > 0 ? `, et ${autres} autre${autres > 1 ? 's' : ''}` : ''}.
        </Text>
      )}
      {effet.nonLisibles > 0 && (
        <Text size="sm" c="dimmed">
          {effet.nonLisibles === 1
            ? 'Dont une machine que vous ne pouvez pas lire : son nom n’est pas affiché.'
            : `Dont ${effet.nonLisibles} machines que vous ne pouvez pas lire : leur nom n’est pas affiché.`}
        </Text>
      )}
    </Stack>
  );
}

/** Liste des mots et de leur effet ; « Retirer » pour chacun. */
export function ListeMots({
  effets,
  envoi,
  onRetirer,
}: {
  effets: readonly EffetMotNonMasque[];
  envoi: boolean;
  onRetirer: (mot: string) => void;
}) {
  if (!effets.length)
    return (
      <Text size="sm" c="dimmed">
        Aucun mot : le masque est strict.
      </Text>
    );
  return (
    <List spacing="sm" listStyleType="none">
      {effets.map((e) => (
        <List.Item key={e.mot}>
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap="2xs">
              <Text fw={600}>{e.mot}</Text>
              <EffetMot effet={e} />
            </Stack>
            <Button variant="default" size="xs" disabled={envoi} onClick={() => onRetirer(e.mot)}>
              Retirer
            </Button>
          </Group>
        </List.Item>
      ))}
    </List>
  );
}

export function MotsNonMasquesPage() {
  const can = useCan();
  const administrer = can('vulnerabilites', 'administrer');
  const reglage = useQuery({
    queryKey: CLE,
    queryFn: () => get<ReglageMasqueOut>(URL_REGLAGE),
    enabled: administrer,
  });
  if (!administrer)
    return (
      <Page>
        <Alert>Régler les mots à ne pas masquer demande le droit d’administrer le module Vulnérabilités.</Alert>
      </Page>
    );
  return (
    <Page>
      <PageHeader
        title="Mots à ne pas masquer"
        description="Avant tout envoi au fournisseur du modèle de l’assistant, la plateforme remplace tout nom, adresse ou identifiant de machine de l’inventaire par un repère (« M-001 ») ou par « [machine] ». Quand une machine porte le nom d’une application, ce mot est masqué partout : la personne lit alors un nom de serveur là où elle parlait de l’application."
      />
      <Stack>
        <Alert color="orange" title="Le masque strict reste la règle">
          Chaque mot ajouté peut sortir vers le fournisseur du modèle : quand il est écrit seul, il n’est plus masqué,
          même s’il est aussi le nom court d’une machine. Le nom complet d’une machine, son adresse et ses identifiants
          restent toujours masqués.
        </Alert>
        <Text size="sm">
          Exemple : avec « dpi », « pacs » et « web » dans la liste, la question « Le DPI est-il touché ? » part telle
          quelle, mais « dpi.exemple.invalid » ou « dpi:8443 » restent masqués. Un mot ne contient que des lettres, des
          chiffres et des tirets : ni point, ni espace, ni « \ », ni « : ». La casse ne compte pas.
        </Text>
        <ErrorAlert error={reglage.error} />
        {reglage.data && <Reglage key={reglage.data.version} reglage={reglage.data} />}
      </Stack>
    </Page>
  );
}

/** Ajout et retrait (réinitialisés à chaque nouvelle version du réglage). */
function Reglage({ reglage }: { reglage: ReglageMasqueOut }) {
  const qc = useQueryClient();
  const [saisie, setSaisie] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const mots = reglage.values.mots;
  const erreur = controleNouveauMot(saisie, mots);
  const nouveau = saisie.trim();
  const [aVerifier] = useDebouncedValue(erreur === null ? nouveau : '', 300);
  const effet = useQuery({
    queryKey: ['vulnerabilites', 'masque', 'effet', aVerifier],
    queryFn: () => get<EffetMotNonMasque>(`/api/vulnerabilites/masque/effet?mot=${encodeURIComponent(aVerifier)}`),
    enabled: aVerifier !== '',
  });
  const enregistrer = async (liste: string[], message: string) => {
    setEnvoi(true);
    try {
      await api('PUT', URL_REGLAGE, { body: { mots: liste }, ifMatch: reglage.version });
      notifications.show({ color: 'teal', message });
      await qc.invalidateQueries({ queryKey: ['vulnerabilites', 'masque'] });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Stack>
      <Title order={2} size="h4">
        Mots de la liste ({mots.length} sur {MOTS_NON_MASQUES_MAX})
      </Title>
      <ListeMots
        effets={reglage.effets}
        envoi={envoi}
        onRetirer={(mot) =>
          void enregistrer(
            mots.filter((m) => m !== mot),
            `« ${mot} » est retiré : il est de nouveau masqué.`,
          )
        }
      />
      <Title order={2} size="h4">
        Ajouter un mot
      </Title>
      <Group align="flex-end">
        <TextInput
          label="Mot"
          description="De 2 à 60 caractères."
          value={saisie}
          onChange={(e) => setSaisie(e.currentTarget.value)}
          error={erreur}
        />
        <Button
          loading={envoi}
          disabled={!nouveau || erreur !== null}
          onClick={() => void enregistrer([...mots, nouveau], `« ${nouveau} » est ajouté à la liste.`)}
        >
          Ajouter
        </Button>
      </Group>
      <ErrorAlert error={effet.error} />
      {effet.data && effet.data.mot === nouveau && <EffetMot effet={effet.data} />}
    </Stack>
  );
}

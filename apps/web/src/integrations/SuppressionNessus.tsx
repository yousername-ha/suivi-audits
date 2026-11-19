/* Module Vulnérabilités (ADR 0100, lot N2 ; décision du RSSI du 19/11/2026) : suppression d'une instance « Nessus, import de
   fichier » et de tout ce qu'elle a importé, depuis la carte « Intégrations » (droit d'administrer les intégrations, le même
   que l'import). Fenêtre de confirmation explicite : nombres de ce qui disparaîtra (lus sur le serveur), action irréversible,
   saisie du mot SUPPRIMER (convention des confirmations à fortes conséquences de la plateforme), If-Match sur la version de
   l'instance. Les autres connecteurs n'ont pas cette action (le serveur la refuse). CSP stricte (ADR 0006). */
import { Alert, Button, Group, List, Stack, Text, TextInput } from '@mantine/core';
import type { IntegrationDto, SuppressionImportDto } from '@suivi/shared';
import { ErrorAlert } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { api, errorMessage, get } from '../api';

/** Mot à saisir pour confirmer. */
export const MOT_SUPPRESSION = 'SUPPRIMER';
/** Libellé du bouton de la tuile (décision du RSSI). */
export const LIBELLE_SUPPRESSION = 'Supprimer ce connecteur et tout ce qu’il a importé';

const pluriel = (n: number, un: string, plusieurs: string) => `${n.toLocaleString('fr-FR')} ${n > 1 ? plusieurs : un}`;

/** Ce qui disparaîtra, en clair. */
export function lignesSuppression(n: SuppressionImportDto): string[] {
  return [
    pluriel(n.machines, 'machine', 'machines'),
    `${pluriel(n.failles, 'faille', 'failles')} (${pluriel(n.detections, 'détection', 'détections')})`,
    `${pluriel(n.imports, 'import', 'imports')} et leurs exécutions`,
  ];
}

/** Contenu de la confirmation (sans requête) : nombres, conséquences, saisie du mot et bouton relié à l'avertissement. */
export function ConfirmationSuppression({
  instance,
  n,
  saisie,
  onSaisie,
  occupe,
  erreur,
  onConfirmer,
  onAnnuler,
}: {
  instance: Pick<IntegrationDto, 'nom'>;
  n: SuppressionImportDto;
  saisie: string;
  onSaisie: (v: string) => void;
  occupe: boolean;
  erreur: string | null;
  onConfirmer: () => void;
  onAnnuler: () => void;
}) {
  const id = useId();
  return (
    <Stack>
      <Alert color="red" title="Action irréversible">
        <Stack gap="xs" id={`${id}-avertissement`}>
          <Text size="sm">
            Le connecteur « {instance.nom} » et tout ce qu’il a importé disparaîtront définitivement :
          </Text>
          <List size="sm">
            {lignesSuppression(n).map((l) => (
              <List.Item key={l}>{l}</List.Item>
            ))}
          </List>
          <Text size="sm">
            Disparaissent aussi le suivi de ces failles et leurs liaisons (actifs exposés, produits surveillés). Les
            alertes sont réévaluées : celles dont la seule présence venait de ces imports se closent. L’historique du
            suivi, les instantanés des tendances et le journal d’audit restent.
          </Text>
        </Stack>
      </Alert>
      <TextInput
        label={`Saisissez ${MOT_SUPPRESSION} pour confirmer`}
        value={saisie}
        onChange={(e) => onSaisie(e.currentTarget.value)}
        disabled={occupe}
        autoComplete="off"
      />
      {erreur && (
        <Alert color="red" role="alert" title="Suppression refusée">
          {erreur}
        </Alert>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onAnnuler} disabled={occupe}>
          Annuler
        </Button>
        <Button
          color="red"
          loading={occupe}
          disabled={saisie !== MOT_SUPPRESSION}
          aria-describedby={`${id}-avertissement`}
          onClick={onConfirmer}
        >
          Supprimer définitivement
        </Button>
      </Group>
    </Stack>
  );
}

/** Fenêtre de suppression (l'appelant fournit la fenêtre) : lit l'aperçu, puis supprime avec la version de l'instance. */
export function SuppressionNessus({
  instance,
  onOccupe,
  onFait,
  onAnnuler,
}: {
  instance: Pick<IntegrationDto, 'id' | 'nom' | 'version'>;
  onOccupe?: (occupe: boolean) => void;
  onFait: (n: SuppressionImportDto) => void;
  onAnnuler: () => void;
}) {
  const [saisie, setSaisie] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const apercu = useQuery({
    queryKey: ['integrations', 'suppression', instance.id],
    queryFn: () => get<SuppressionImportDto>(`/api/integrations/instances/${instance.id}/suppression`),
    gcTime: 0,
  });
  const confirmer = async () => {
    setOccupe(true);
    onOccupe?.(true);
    setErreur(null);
    try {
      const n = await api<SuppressionImportDto>('DELETE', `/api/integrations/instances/${instance.id}`, {
        ifMatch: instance.version,
      });
      onFait(n);
    } catch (e) {
      setErreur(errorMessage(e));
    } finally {
      setOccupe(false);
      onOccupe?.(false);
    }
  };
  return (
    <Stack>
      <ErrorAlert error={apercu.error} />
      {apercu.isPending && (
        <Text size="sm" role="status">
          Lecture de ce que contient le connecteur…
        </Text>
      )}
      {apercu.data && (
        <ConfirmationSuppression
          instance={instance}
          n={apercu.data}
          saisie={saisie}
          onSaisie={setSaisie}
          occupe={occupe}
          erreur={erreur}
          onConfirmer={() => void confirmer()}
          onAnnuler={onAnnuler}
        />
      )}
    </Stack>
  );
}

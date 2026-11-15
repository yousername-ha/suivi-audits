/* Validation de l'ouverture d'un flux vers l'extérieur (ADR 0097, précision du RSSI du 15/11/2026) : activer un module ouvre
   son flux, sans étape séparée. Le geste d'activation du module (interrupteur de l'assistant, envoi des courriels, mode ACME,
   analyse antivirus, mises à jour depuis l'interface) affiche une fois cette fenêtre : destinations, ports, données qui
   sortent, porteur, pare-feu à faire autoriser, case de validation obligatoire. Réutilisée par l'assistant d'installation
   (« Activer / Plus tard », lot 3). */
import { Alert, Button, Checkbox, Group, List, Modal, Stack, Text, Title } from '@mantine/core';
import { fluxExterne, type FluxExterneDefinition, type FluxModule } from '@suivi/shared';
import { useCallback, useState, type ReactNode } from 'react';
import { peutConfirmer } from '../flux-externes';

export function Destinations({ f }: { f: FluxExterneDefinition }) {
  return (
    <List size="sm" spacing="xs">
      {f.destinations.map((d) => (
        <List.Item key={`${d.sens}-${d.hote}`}>
          {d.sens === 'entrant' ? 'Entrant depuis' : 'Sortant vers'} {d.hote} · {d.ports}
        </List.Item>
      ))}
    </List>
  );
}

/** Contenu de la validation, sans fenêtre : l'assistant d'installation peut l'afficher dans sa propre étape. */
export function DetailValidationFlux({
  module,
  valide,
  onValide,
}: {
  module: FluxModule;
  valide: boolean;
  onValide: (v: boolean) => void;
}) {
  const f = fluxExterne(module);
  return (
    <Stack>
      <Text size="sm">
        Activer ce module ouvre un flux vers l’extérieur du serveur. {f.role} La décision est inscrite au journal
        d’audit ; désactiver le module referme le flux.
      </Text>
      <Stack gap="xs">
        <Title order={3} size="h6">
          Destinations et ports
        </Title>
        <Destinations f={f} />
      </Stack>
      <Stack gap="xs">
        <Title order={3} size="h6">
          Ce qui sort du serveur
        </Title>
        <Text size="sm">{f.donnees}</Text>
      </Stack>
      <Stack gap="xs">
        <Title order={3} size="h6">
          Qui émet le flux
        </Title>
        <Text size="sm">{f.porteur.libelle}.</Text>
      </Stack>
      <Alert color="blue" title="Pare-feu de l’hôte et du réseau">
        La plateforme ouvre son propre flux ; le pare-feu reste du ressort de l’équipe infrastructure. À faire autoriser
        : {f.pareFeu.join(' ')}
      </Alert>
      <Text size="sm">
        L’exécutant d’exploitation applique la décision à son prochain passage (moins d’une minute).
      </Text>
      <Checkbox
        label="J’ai pris connaissance des destinations, des ports et des données qui sortent, et j’autorise ce flux."
        checked={valide}
        onChange={(e) => onValide(e.currentTarget.checked)}
      />
    </Stack>
  );
}

/** Fenêtre de validation : « Confirmer » n'est possible qu'une fois la case cochée. */
export function ValidationFlux({
  module,
  onConfirm,
  onCancel,
}: {
  module: FluxModule;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [valide, setValide] = useState(false);
  const f = fluxExterne(module);
  return (
    <Modal
      opened
      onClose={onCancel}
      title={`Activer « ${f.libelle} » : ouvrir son flux`}
      centered
      lockScroll={false}
      size="lg"
    >
      <Stack>
        <DetailValidationFlux module={module} valide={valide} onValide={setValide} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Annuler
          </Button>
          <Button disabled={!peutConfirmer(true, valide, false)} onClick={onConfirm}>
            Confirmer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Geste d'activation : `valider(module)` affiche la fenêtre et rend vrai si l'administrateur a coché et confirmé. Rendre
    `fenetre` dans la page. */
export function useValidationFlux(): { valider: (m: FluxModule) => Promise<boolean>; fenetre: ReactNode } {
  const [demande, setDemande] = useState<{ module: FluxModule; repondre: (ok: boolean) => void } | null>(null);
  const valider = useCallback(
    (module: FluxModule) => new Promise<boolean>((repondre) => setDemande({ module, repondre })),
    [],
  );
  const fin = (ok: boolean) => {
    demande?.repondre(ok);
    setDemande(null);
  };
  return {
    valider,
    fenetre: demande ? (
      <ValidationFlux
        key={demande.module}
        module={demande.module}
        onConfirm={() => fin(true)}
        onCancel={() => fin(false)}
      />
    ) : null,
  };
}

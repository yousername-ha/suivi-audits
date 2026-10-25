/* Fiche détaillée d'une étape (fenêtre centrale) : sous-actions dépliables, attendu, travaux présents, sources. Elle se ferme
   par la croix, le fond ou Échap et rend le focus à l'élément d'origine (comportement du composant Modal). Aucune écriture :
   parcourir une étape ne modifie ni revue, ni conformité, ni déclaration d'applicabilité. */
import { Anchor, Badge, Group, Modal, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { BRANCHE_LABELS, SOURCE_ETAPE, etapeParcours, type EtapeParcours } from '@suivi/shared';
import { SousActionDetail } from './SousActionDetail';
import type { TravauxDuType } from './travaux';

export function FicheEtape({
  smsi,
  etape,
  sousActionOuverte,
  travaux,
  onClose,
  onOuvrirEtape,
}: {
  smsi: string;
  etape: EtapeParcours;
  /** Sous-action à déplier à l'ouverture (clic sur un enfant de l'arbre ou « Voir l'attendu »). */
  sousActionOuverte?: string;
  travaux: Record<string, TravauxDuType>;
  onClose: () => void;
  onOuvrirEtape: (id: string) => void;
}) {
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set(sousActionOuverte ? [sousActionOuverte] : []));
  const bascule = (id: string) =>
    setOuvertes((o) => {
      const n = new Set(o);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const amont = etape.dependances.map((d) => etapeParcours(d)).filter((e): e is EtapeParcours => !!e);
  return (
    <Modal
      opened
      onClose={onClose}
      size="lg"
      centered
      title={etape.titre}
      closeButtonProps={{ 'aria-label': 'Fermer la fiche de l’étape' }}
    >
      <Stack gap="sm" data-etape-fiche={etape.id}>
        <Group gap="xs">
          <Badge variant="light" data-branche={etape.branche}>
            {BRANCHE_LABELS[etape.branche].nom}
          </Badge>
          <Badge variant="outline" color="gray">
            {etape.reference}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          {etape.sousTitre}
        </Text>
        <Text size="sm">
          Dépliez une sous-action pour consulter l’attendu, retrouver les travaux déjà présents et ouvrir le module qui
          les porte.
        </Text>
        {etape.sousActions.map((s) => (
          <SousActionDetail
            key={s.id}
            smsi={smsi}
            etape={etape}
            sousAction={s}
            travaux={travaux}
            ouverte={ouvertes.has(s.id)}
            onBascule={() => bascule(s.id)}
            idPrefixe="fiche"
          />
        ))}
        {amont.length > 0 && (
          <Text size="sm">
            Travaux liés en amont (proposition, jamais un verrou) :{' '}
            {amont.map((e, i) => (
              <span key={e.id}>
                {i > 0 && ', '}
                <Anchor component="button" type="button" onClick={() => onOuvrirEtape(e.id)}>
                  {e.titre}
                </Anchor>
              </span>
            ))}
            .
          </Text>
        )}
        <Anchor href={SOURCE_ETAPE[etape.source]} target="_blank" rel="noopener noreferrer" size="sm">
          Consulter la référence officielle (nouvel onglet)
        </Anchor>
        <Text size="xs" c="dimmed">
          À retrouver dans : {etape.module}. Consulter une étape, relier un document ou clore une action ne démontre pas
          la conformité : le texte applicable, les preuves du registre et la revue restent nécessaires.
        </Text>
      </Stack>
    </Modal>
  );
}

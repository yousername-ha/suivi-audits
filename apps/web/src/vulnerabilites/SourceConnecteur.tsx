/* Lot N1 (ADR 0100) : marque de la source d'une machine ou d'un constat dans les listes du module : pastille Tenable (un
   contrôle Nessus reste un contrôle de Tenable, aucun logo officiel), puis l'instance et son type en clair (Security
   Center, ou Nessus par import de fichier). Sous la CSP stricte (ADR 0006) : aucun style en ligne. */
import { Text } from '@mantine/core';
import type { OrigineConnecteurDto } from '@suivi/shared';
import { texteSource } from './failles';
import { PictoSource } from './PictoSource';

export function SourceConnecteur({ origine }: { origine: OrigineConnecteurDto }) {
  return (
    <span className="ps-source-connecteur" data-source-connecteur={origine.type}>
      <PictoSource source="tenable" decoratif infobulle={false} />
      <Text size="xs" c="dimmed" span>
        {texteSource(origine)}
      </Text>
    </span>
  );
}

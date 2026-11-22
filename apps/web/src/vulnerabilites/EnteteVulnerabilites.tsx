/* Les explications restent disponibles à la demande : les données et commandes commencent sous un en-tête court. */
import { APropos, PageHeader } from '@suivi/ui';
import type { ComponentProps } from 'react';

export function EnteteVulnerabilites({ description, ...props }: ComponentProps<typeof PageHeader>) {
  return (
    <>
      <PageHeader {...props} />
      {description && <APropos>{description}</APropos>}
    </>
  );
}

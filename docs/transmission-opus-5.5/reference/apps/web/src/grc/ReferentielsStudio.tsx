/* Présentation seule : définitions, provenance et exigences viennent des données publiées existantes. */
import { Button, Modal, Table } from '@mantine/core';
import type { FrameworkDefinition } from '@suivi/shared';
import { DataTable } from '@suivi/ui';

export const LIBELLES_SOURCE: Record<string, string> = {
  official_verified: 'Source officielle vérifiée',
  licensed_import: 'Importé sous licence',
  organisation: 'Choix de l’organisation',
  unverified: 'Repris de l’outil de suivi',
};
export function LivreReferentiel({ ton = 0 }: { ton?: number }) {
  return (
    <span className="rfs-livre" data-ton={ton % 3} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 3h13a1 1 0 0 1 1 1v17H6a3 3 0 0 1 0-6h13M5 3v12M8 7h7m-7 4h5" />
      </svg>
    </span>
  );
}

export function ExigencesReferentiel({
  definition,
  limite,
  label,
}: {
  definition: FrameworkDefinition;
  limite?: number;
  label?: string;
}) {
  const domaines = new Map(definition.domains.map((d) => [d.id, d.label]));
  return (
    <div className="rfs-exigences">
      <DataTable label={label ?? `Exigences de ${definition.name}`}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="rfs-code-col">Code</Table.Th>
              <Table.Th>Intitulé de l’exigence</Table.Th>
              <Table.Th className="rfs-domaine-col">Domaine</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {definition.requirements.slice(0, limite).map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>
                  <span className="rfs-code">{r.id}</span>
                </Table.Td>
                <Table.Td>
                  {r.title}
                  <span className="rfs-domaine-mobile">{domaines.get(r.domain) ?? r.domain}</span>
                </Table.Td>
                <Table.Td>
                  <span className="rfs-domaine">{domaines.get(r.domain) ?? r.domain}</span>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataTable>
    </div>
  );
}

export function SourceReferentiel({
  definition,
  versionFiche,
  versionPubliee,
  actif,
  onClose,
}: {
  definition: FrameworkDefinition;
  versionFiche?: number;
  versionPubliee?: number;
  actif?: boolean;
  onClose: () => void;
}) {
  const s = definition.source;
  const champ = (label: string, valeur: string | number | undefined) => (
    <div key={label}>
      <dt>{label}</dt>
      <dd>{valeur === undefined || valeur === '' ? 'Non renseigné' : valeur}</dd>
    </div>
  );
  return (
    <Modal
      opened
      onClose={onClose}
      title="Source et publication"
      size="xl"
      classNames={{ content: 'referentiels-fiche' }}
    >
      <div className="rfs-source-identite">
        <LivreReferentiel />
        <div>
          <strong>{definition.name}</strong>
          <small>{definition.identifier}</small>
        </div>
      </div>
      <dl className="rfs-source-grille">
        {champ('Organisation source', s.organisation)}
        {champ('Document source', s.document)}
        {champ('Édition de la source', s.version)}
        {champ('Date de la source', s.date)}
        {versionFiche !== undefined && champ('Version de fiche', versionFiche)}
        {versionPubliee !== undefined && champ('Dernière version publiée', versionPubliee)}
        {champ('Statut de la source', LIBELLES_SOURCE[s.status] ?? s.status)}
        {champ('Source vérifiée le', s.verifiedAt)}
        {champ('Caractère normatif déclaré par la source', s.normative ? 'Oui' : 'Non')}
        {actif !== undefined && champ('Statut dans le périmètre', actif ? 'Actif' : 'Inactif')}
        {champ('Exigences de cette définition', definition.requirements.length)}
        {champ('Licence', s.license)}
        <div className="rfs-source-large">
          <dt>Adresse de la source</dt>
          <dd>
            {/^https?:\/\//i.test(s.url) ? (
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.url}
              </a>
            ) : (
              s.url || 'Non renseignée'
            )}
          </dd>
        </div>
      </dl>
      <p className="rfs-note">
        Les métadonnées décrivent la provenance du contenu importé. Chaque version publiée est conservée ; la version de
        fiche est distincte de l’édition du document source.
      </p>
      <div className="rfs-source-pied">
        <Button variant="default" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </Modal>
  );
}

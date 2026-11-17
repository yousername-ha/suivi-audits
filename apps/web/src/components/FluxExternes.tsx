/* Flux vers l'extérieur (ADR 0097) : résumé par module (état voulu et appliqué, erreur, flux à autoriser sur le pare-feu).
   Précision du RSSI du 15/11/2026 : activer le module ouvre son flux, sans étape séparée. On n'ouvre donc rien ici : chaque
   ligne renvoie au geste d'activation du module ; on peut seulement fermer un flux ouvert (confirmation, journal d'audit).
   L'API enregistre la décision ; l'exécutant d'exploitation l'applique et rapporte l'état. */
import { Alert, Anchor, Badge, Button, Card, Group, List, Modal, Stack, Table, Text, Title } from '@mantine/core';
import {
  FLUX_EXTERNES,
  fluxExterne,
  passeParMandataire,
  type FluxExterneDefinition,
  type FluxExterneEtat,
  type FluxExternesOut,
  type FluxModule,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, get } from '../api';
import {
  etatApplique,
  libelleSens,
  LIEN_FLUX_EXTERNES,
  pareFeuAOuvrir,
  peutConfirmer,
  texteFermeture,
  type Ton,
} from '../flux-externes';
import { useCan } from '../session';
import { ErrorAlert, fmtDate } from './common';
import { Destinations } from './ValidationFlux';
import { LIEN_MANDATAIRE } from '../mandataire';

const COULEURS: Record<Ton, string> = { vert: 'green', gris: 'gray', rouge: 'red', orange: 'orange' };
export const CLE_FLUX_EXTERNES = ['admin', 'flux-externes'] as const;

/** Bandeau des pages de module (assistant, courriel, mises à jour, certificat, antivirus) quand leur flux est fermé. */
export function FluxFermeAlerte({ module }: { module: FluxModule }) {
  const f = fluxExterne(module);
  return (
    <Alert color="orange" role="status" title={`Flux « ${f.libelle} » fermé`}>
      Aucun échange avec l’extérieur n’est possible pour ce module : {f.siFerme.charAt(0).toLowerCase()}
      {f.siFerme.slice(1)} Activer le module ouvre son flux ({f.activation.geste}), après validation par un
      administrateur des destinations et des données qui sortent.{' '}
      <Anchor component={Link} to={LIEN_FLUX_EXTERNES}>
        Résumé des flux vers l’extérieur
      </Anchor>
    </Alert>
  );
}

/** Fermeture depuis le résumé : sens sûr, confirmée et inscrite au journal. */
function Fermeture({
  f,
  onClose,
  onDone,
}: {
  f: FluxExterneDefinition;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const confirmer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await api('PUT', `/api/admin/flux-externes/${f.id}`, { body: { ouvert: false, confirmation: true } });
      await onDone();
      onClose();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Modal
      opened
      onClose={onClose}
      title={`Fermer le flux « ${f.libelle} »`}
      centered
      lockScroll={false}
      size="lg"
      classNames={{ content: 'fenetre-flux' }}
    >
      <Stack>
        <ErrorAlert error={erreur} />
        <Text size="sm" className="flux-texte">
          {texteFermeture(f)}
        </Text>
        <Group justify="flex-end" className="fenetre-flux__actions">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button
            color="red"
            loading={envoi}
            disabled={!peutConfirmer(false, false, envoi)}
            onClick={() => void confirmer()}
          >
            Fermer le flux
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Tableau du résumé, sans requête : une ligne par module du registre. Quatre colonnes (module et sens, destinations, état,
    action) qui se replient sans rien tronquer ; dans un conteneur étroit (téléphone, fenêtre réduite), chaque ligne devient
    un bloc dont chaque cellule porte son intitulé (classe « tableau-empilable » de packages/ui). */
export function TableauFlux({
  etats,
  ecriture,
  onFermer,
  mandataire = false,
}: {
  etats: ReadonlyMap<FluxModule, FluxExterneEtat>;
  ecriture: boolean;
  onFermer: (f: FluxExterneDefinition) => void;
  /** Mandataire sortant actif (ADR 0101) : les flux qui l'empruntent le disent sous leurs destinations. */
  mandataire?: boolean;
}) {
  return (
    <div
      className="table-wrap tableau-empilable-conteneur"
      role="region"
      aria-label="Flux vers l’extérieur"
      tabIndex={0}
    >
      <Table striped className="tableau-empilable flux-tableau">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Module</Table.Th>
            <Table.Th>Destinations</Table.Th>
            <Table.Th>État</Table.Th>
            <Table.Th>Action</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {FLUX_EXTERNES.map((f) => {
            const e = etats.get(f.id);
            const a = e ? etatApplique(e) : null;
            return (
              <Table.Tr key={f.id}>
                <Table.Td data-label="Module">
                  <Text size="sm" fw={600}>
                    {f.libelle}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {libelleSens(f)}
                  </Text>
                </Table.Td>
                <Table.Td data-label="Destinations">
                  <Destinations f={f} />
                  {passeParMandataire(f.id, mandataire) && (
                    <Text size="xs" c="dimmed">
                      Par le mandataire réglé
                    </Text>
                  )}
                </Table.Td>
                <Table.Td data-label="État">
                  <Stack gap="2xs" align="flex-start">
                    <Group gap="xs">
                      {e && (
                        <Badge variant="light" color={e.ouvert ? 'green' : 'gray'}>
                          {`Voulu : ${e.ouvert ? 'ouvert' : 'fermé'}`}
                        </Badge>
                      )}
                      {a && (
                        <Badge variant="light" color={COULEURS[a.ton]}>
                          {`Appliqué : ${a.libelle.charAt(0).toLowerCase()}${a.libelle.slice(1)}`}
                        </Badge>
                      )}
                    </Group>
                    {e?.erreur && (
                      <Text size="sm" c="red" className="flux-erreur">
                        {`Erreur : ${e.erreur}`}
                      </Text>
                    )}
                    <div className="horodatage">
                      <Text size="xs">
                        {e?.decideLe ? `Décidé le ${fmtDate(e.decideLe)} par ${e.decidePar ?? '?'}` : 'Jamais décidé'}
                      </Text>
                      {e?.appliqueLe && <Text size="xs">Appliqué le {fmtDate(e.appliqueLe)}</Text>}
                    </div>
                  </Stack>
                </Table.Td>
                <Table.Td data-label="Action">
                  <Stack gap="xs" align="flex-start">
                    <Anchor size="xs" component={Link} to={f.reglage.lien}>
                      {e?.ouvert ? 'Page du module' : 'Activer dans la page du module'}
                    </Anchor>
                    {ecriture && e?.ouvert && (
                      <Button
                        size="compact-sm"
                        variant="default"
                        color="red"
                        aria-label={`Fermer le flux ${f.libelle}`}
                        onClick={() => onFermer(f)}
                      >
                        Fermer
                      </Button>
                    )}
                  </Stack>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </div>
  );
}

export function FluxExternesPanel() {
  const can = useCan();
  const ecriture = can('administration', 'administrer');
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: CLE_FLUX_EXTERNES,
    queryFn: () => get<FluxExternesOut>('/api/admin/flux-externes'),
    refetchInterval: 15000,
  });
  const [fermeture, setFermeture] = useState<FluxExterneDefinition | null>(null);
  const etats = new Map<FluxModule, FluxExterneEtat>((q.data?.modules ?? []).map((e) => [e.module, e]));
  const mandataire = q.data?.mandataire.actif === true;
  const pareFeu = pareFeuAOuvrir(FLUX_EXTERNES, q.data?.modules ?? [], mandataire);
  return (
    <Card withBorder className="flux-resume">
      <Stack>
        <Title order={2} size="h4">
          Flux vers l’extérieur
        </Title>
        <Text size="sm">
          Par défaut, aucun flux ne sort du serveur. Chaque module qui doit communiquer avec l’extérieur ou recevoir des
          connexions d’Internet est résumé ici. Un flux s’ouvre en activant son module, dans la page du module, après
          validation explicite par un administrateur ; désactiver le module le referme. Chaque décision est inscrite au
          journal d’audit. L’exécutant d’exploitation applique la décision et rapporte l’état appliqué.
        </Text>
        <ErrorAlert error={q.error} />
        {mandataire && (
          <Alert color="blue" title="Mandataire sortant de l’établissement actif">
            La veille des vulnérabilités passe par le mandataire réglé ; les autres flux sortent comme indiqué.{' '}
            <Anchor component={Link} to={LIEN_MANDATAIRE}>
              Réglage du mandataire
            </Anchor>
          </Alert>
        )}
        <TableauFlux etats={etats} ecriture={ecriture} onFermer={setFermeture} mandataire={mandataire} />
        <Alert color="blue" title="Pare-feu de l’hôte et du réseau">
          La plateforme ouvre ou ferme ses propres flux (conteneurs et exécutants). Le pare-feu du serveur et celui du
          réseau restent du ressort de l’équipe infrastructure.
          {pareFeu.length ? (
            <List size="sm" mt="xs">
              {pareFeu.flatMap((p) =>
                p.regles.map((r) => (
                  <List.Item key={`${p.libelle}-${r}`}>
                    {p.libelle} : {r}
                  </List.Item>
                )),
              )}
            </List>
          ) : (
            ' Aucun flux n’est ouvert : rien à autoriser.'
          )}
        </Alert>
      </Stack>
      {fermeture && (
        <Fermeture f={fermeture} onClose={() => setFermeture(null)} onDone={() => qc.invalidateQueries()} />
      )}
    </Card>
  );
}

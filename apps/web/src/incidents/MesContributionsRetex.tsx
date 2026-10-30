/* Mes contributions RETEX : page d'une personne invitée à contribuer au retour d'expérience d'un incident. Aucun droit de
   module n'est requis : le serveur ne renvoie que le contexte minimal (incident, pilote, consigne, échéance), les
   propositions de la personne et, si le pilote l'a diffusée après clôture, la chronologie en lecture seule. */
import { Anchor, Button, Group, Modal, Stack, Table, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  chronologieRetex,
  dateHeureRetex,
  indicateursRetex,
  type EvenementRetex,
  type InvitationVue,
  type PropositionRetex,
} from '@suivi/shared';
import { ConfirmButton, DataTable } from '@suivi/ui';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { ChronologieRetex } from './ChronologieRetex';
import {
  FormulaireEvenementRetex,
  maintenantLocal,
  nettoyerSaisie,
  saisieVide,
  type SaisieRetex,
} from './FormulaireEvenementRetex';
import { StatutPropositionChip, TypeRetex } from './Retex';
import { EnteteRetex, EspaceRetex, EtatRetex, SectionRetex } from './RetexHabillage';

export const CLE_INVITATIONS_RETEX = ['retex-invitations'] as const;
interface Contribution {
  invitation: InvitationVue;
  propositions: PropositionRetex[];
  chronologie: EvenementRetex[] | null;
}
const dateJour = (d: string) => (d ? d.split('-').reverse().join('/') : '');
/** Jours restants avant l'échéance (négatif si dépassée), null sans échéance. */
const joursRestants = (echeance: string) => {
  if (!echeance) return null;
  const j = new Date(`${echeance}T23:59:59`).getTime() - Date.now();
  return Math.ceil(j / 86_400_000);
};

export function useInvitationsRetex() {
  return useQuery({
    queryKey: CLE_INVITATIONS_RETEX,
    queryFn: () => get<InvitationVue[]>('/api/retex/invitations'),
    refetchInterval: 120_000,
  });
}

export function MesContributionsRetexPage() {
  const { incident } = useParams();
  const invitations = useInvitationsRetex();
  const liste = invitations.data ?? [];
  const actives = liste.filter((x) => x.statut === 'ouverte');
  return (
    <EspaceRetex>
      <EnteteRetex
        surtitre="Retour d’expérience · Contribution"
        titre="Mes contributions RETEX"
        sousTitre="Le pilote d’un retour d’expérience vous demande d’ajouter ce que votre pôle a vécu pendant un incident. Vous ne voyez que vos propres éléments ; le pilote les valide avant de les intégrer à la chronologie."
      />
      <ErrorAlert error={invitations.error} />
      {!liste.length && !invitations.isLoading && (
        <SectionRetex titre="Aucune demande" aide="Aucune demande de contribution pour le moment." />
      )}
      <div className="retex-contribution">
        {liste.length > 0 && (
          <nav className="retex-contribution__liste" aria-label="Demandes de contribution">
            <span className="retex-contribution__legende">Demandes ({liste.length})</span>
            {[...actives, ...liste.filter((x) => x.statut !== 'ouverte')].map((x) => (
              <Anchor
                key={x.incidentId}
                component={Link}
                to={`/retex/${encodeURIComponent(x.incidentId)}`}
                className="retex-demande"
                data-active={x.incidentId === incident ? 'oui' : 'non'}
                underline="never"
              >
                <span className="retex-demande__id">{x.incidentId}</span>
                <span className="retex-demande__titre">{x.titre || '(sans titre)'}</span>
                <span className="retex-demande__etat">
                  {x.statut === 'cloturee'
                    ? x.diffusee
                      ? 'Chronologie disponible'
                      : 'Collecte close'
                    : x.termineLe
                      ? 'Contribution terminée'
                      : `${x.propositions} élément(s) proposé(s)`}
                </span>
              </Anchor>
            ))}
          </nav>
        )}
        <div className="retex-contribution__detail">
          {incident ? (
            <Contribution id={incident} />
          ) : (
            liste.length > 0 && (
              <SectionRetex titre="Choisissez une demande" aide="Sélectionnez un RETEX dans la liste." />
            )
          )}
        </div>
      </div>
    </EspaceRetex>
  );
}

function Contribution({ id }: { id: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const cle = ['retex-contribution', id];
  const q = useQuery({ queryKey: cle, queryFn: () => get<Contribution>(`/api/retex/${encodeURIComponent(id)}`) });
  const [erreur, setErreur] = useState<unknown>(null);
  const [edite, setEdite] = useState<PropositionRetex | null>(null);
  const agir = async (methode: string, chemin: string, corps?: unknown) => {
    try {
      setErreur(null);
      const r = await api<Contribution>(methode, chemin, corps === undefined ? {} : { body: corps });
      await qc.invalidateQueries({ queryKey: cle });
      await qc.invalidateQueries({ queryKey: CLE_INVITATIONS_RETEX });
      return r;
    } catch (e) {
      setErreur(e);
      return undefined;
    }
  };
  if (q.error)
    return (
      <SectionRetex titre="Demande indisponible">
        <ErrorAlert error={q.error} />
        <Button mt="sm" variant="default" onClick={() => void navigate('/retex')}>
          Retour à mes demandes
        </Button>
      </SectionRetex>
    );
  const c = q.data;
  if (!c) return null;
  const inv = c.invitation;
  const base = `/api/retex/${encodeURIComponent(id)}`;
  const ouverte = inv.statut === 'ouverte';
  const jours = joursRestants(inv.echeance);
  const dernier = c.propositions[c.propositions.length - 1];
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <SectionRetex
        numero="01"
        titre={inv.titre || '(sans titre)'}
        aide={`Retour d’expérience de l’incident ${inv.incidentId} · pilote : ${inv.piloteNom}`}
        actions={
          <div className="retex-contexte__etat">
            {ouverte ? (
              <EtatRetex ton="attention">Collecte ouverte</EtatRetex>
            ) : (
              <EtatRetex ton="succes">Collecte close</EtatRetex>
            )}
            {inv.echeance && (
              <span className="retex-contexte__echeance" data-depassee={jours !== null && jours < 0 ? 'oui' : 'non'}>
                Échéance {dateJour(inv.echeance)}
                {ouverte && jours !== null ? (jours < 0 ? ' · dépassée' : ` · J-${jours}`) : ''}
              </span>
            )}
          </div>
        }
      >
        {inv.consigne && <p className="retex-consigne">{inv.consigne}</p>}
      </SectionRetex>

      {ouverte && !inv.termineLe && (
        <SectionRetex
          numero="02"
          titre="Ajouter un élément"
          aide="Un élément par fait marquant : ce que vous avez constaté, décidé, fait ou communiqué."
        >
          <FormulaireEvenementRetex
            key={c.propositions.length}
            initial={saisieVide(dernier?.ts || maintenantLocal(), 'Analyse')}
            libelle="Proposer au pilote"
            aideActeur="Personne ou équipe qui a agi."
            valider={async (s) => !!(await agir('POST', `${base}/propositions`, nettoyerSaisie(s)))}
          />
        </SectionRetex>
      )}

      <SectionRetex
        numero={ouverte && !inv.termineLe ? '03' : '02'}
        titre={`Mes éléments proposés (${c.propositions.length})`}
        aide="Suite donnée par le pilote : à valider, intégrée, déjà connue ou non retenue."
        actions={
          ouverte &&
          (inv.termineLe ? (
            <Button variant="default" onClick={() => void agir('PUT', `${base}/terminee`, { terminee: false })}>
              Reprendre ma contribution
            </Button>
          ) : (
            <Button
              disabled={!c.propositions.length}
              onClick={() => void agir('PUT', `${base}/terminee`, { terminee: true })}
            >
              J’ai terminé ma contribution
            </Button>
          ))
        }
      >
        {inv.termineLe && (
          <Text size="sm" c="dimmed" mb="sm">
            Contribution déclarée terminée le {new Date(inv.termineLe).toLocaleDateString('fr-FR')}.
          </Text>
        )}
        <DataTable label="Mes éléments proposés">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date et heure</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Élément</Table.Th>
                <Table.Th>Suite donnée</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {c.propositions.map((p) => {
                const modifiable = ouverte && p.statut === 'en_attente';
                return (
                  <Table.Tr key={p.id}>
                    <Table.Td className="retex-chiffre">{dateHeureRetex(p.ts)}</Table.Td>
                    <Table.Td>
                      <TypeRetex type={p.type} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {p.titre}
                      </Text>
                      {p.description && (
                        <Text size="xs" c="dimmed" lineClamp={2}>
                          {p.description}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <StatutPropositionChip p={p} />
                      {p.motif && (
                        <Text size="xs" c="dimmed">
                          {p.motif}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {modifiable ? (
                        <Group gap="xs" wrap="nowrap">
                          <Anchor component="button" type="button" size="sm" onClick={() => setEdite(p)}>
                            Modifier
                          </Anchor>
                          <ConfirmButton
                            message={`Retirer « ${p.titre} » ?`}
                            onConfirm={async () => {
                              await agir('DELETE', `${base}/propositions/${encodeURIComponent(p.id)}`);
                            }}
                            variant="subtle"
                            size="compact-sm"
                          >
                            Retirer
                          </ConfirmButton>
                        </Group>
                      ) : (
                        '–'
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {!c.propositions.length && (
                <Table.Tr>
                  <Table.Td colSpan={5}>Vous n’avez encore rien proposé.</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </DataTable>
      </SectionRetex>

      {c.chronologie && c.chronologie.length > 0 && (
        <Stack gap="xs">
          <ChronologieRetex
            titre={`${inv.incidentId} — ${inv.titre || '(sans titre)'}`}
            points={chronologieRetex(c.chronologie)}
            indicateurs={indicateursRetex(c.chronologie)}
          />
        </Stack>
      )}

      <Modal
        withinPortal={false}
        classNames={{ content: 'retex-modal' }}
        opened={!!edite}
        onClose={() => setEdite(null)}
        lockScroll={false}
        size="lg"
        title="Modifier mon élément"
      >
        {edite && (
          <FormulaireEvenementRetex
            initial={edite as SaisieRetex}
            libelle="Enregistrer"
            valider={async (s) => {
              const ok = !!(await agir(
                'PATCH',
                `${base}/propositions/${encodeURIComponent(edite.id)}`,
                nettoyerSaisie(s),
              ));
              if (ok) setEdite(null);
              return ok;
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}

/** Bandeau : demandes de contribution en attente (collecte ouverte, contribution non terminée). */
export function RetexInvitationNotice() {
  const q = useInvitationsRetex();
  const attente = (q.data ?? []).filter((x) => x.statut === 'ouverte' && !x.termineLe);
  if (!attente.length) return null;
  const premiere = attente[0]!;
  return (
    <div className="update-notice" role="status" data-retex-invitation>
      <span>
        <b>Contribution RETEX demandée</b> —{' '}
        {attente.length > 1
          ? `${attente.length} retours d’expérience attendent vos éléments.`
          : `${premiere.piloteNom} attend vos éléments pour le RETEX de l’incident ${premiere.incidentId}${premiere.echeance ? ` avant le ${dateJour(premiere.echeance)}` : ''}.`}
      </span>
      <Anchor
        size="xs"
        component={Link}
        to={attente.length > 1 ? '/retex' : `/retex/${encodeURIComponent(premiere.incidentId)}`}
      >
        Contribuer
      </Anchor>
    </div>
  );
}

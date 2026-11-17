/* Module Vulnérabilités (ADR 0100, lot V6) : onglet « Alertes ». Alertes décidées par la plateforme, par règle : critique
   (P1, faille exploitée présente chez nous), simple (P2). Liste (niveau, faille, priorité et ses faits, présence en nombres
   que la personne lit, état : ouverte, prise en compte ou close, par qui et quand), filtre par état et par niveau, fiche d'une
   alerte (ouverte par son titre ou par le lien d'une notification, `?alerte=`), prise en compte avec le droit de modifier.
   Rappel discret dans l'en-tête du module quand une alerte critique est en cours. Aucun nom de machine, de domaine,
   d'adresse ni de périmètre : ils se lisent dans les écrans du module, selon les droits. Charte et CSP stricte (ADR 0006). */
import { Alert, Anchor, Button, Group, List, Modal, Pagination, Select, Stack, Table, Text } from '@mantine/core';
import {
  type AlerteVulnerabiliteDto,
  type FenetreAlertesDto,
  FILTRE_ETAT_ALERTE_LIBELLES,
  FILTRES_ETAT_ALERTE,
  type FiltreEtatAlerte,
  NIVEAU_ALERTE_LIBELLES,
  NIVEAUX_ALERTE,
  type NiveauAlerte,
  type PageAlertesVulnerabilites,
} from '@suivi/shared';
import { DataTable, ErrorAlert, Page, PageHeader, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, ApiError, get } from '../api';
import { useCan } from '../session';
import {
  CLE_ALERTES,
  CLE_FENETRE,
  ETAT_ALERTE_PUCE,
  libelleEtatAlerte,
  libelleExploitation,
  libelleFaille,
  libellePresences,
  NIVEAU_ALERTE_PUCE,
  resumePresence,
  resumeSuiviAlerte,
  urlAlerte,
  urlAlertes,
  urlFenetre,
  urlPriseEnCompte,
} from './alertes';
import { PrioriteFaits } from './FaillesDetectees';
import { nombrePages } from './veille';

/** Liste des alertes (sans état) : rendu testable hors navigateur. */
export function AlertesTable({
  alertes,
  onOuvrir,
}: {
  alertes: AlerteVulnerabiliteDto[];
  onOuvrir: (id: string) => void;
}) {
  return (
    <DataTable label="Alertes du module Vulnérabilités">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Niveau</Table.Th>
            <Table.Th>Faille</Table.Th>
            <Table.Th>Priorité</Table.Th>
            <Table.Th>Présence</Table.Th>
            <Table.Th>État</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {alertes.map((a) => (
            <Table.Tr key={a.id}>
              <Table.Td>
                <StatusChip etat={NIVEAU_ALERTE_PUCE[a.niveau]}>{NIVEAU_ALERTE_LIBELLES[a.niveau]}</StatusChip>
              </Table.Td>
              <Table.Td>
                <Anchor component="button" type="button" onClick={() => onOuvrir(a.id)} className="veille-texte">
                  {a.titre}
                </Anchor>
                <Text size="xs" className="veille-code">
                  {libelleFaille(a)}
                </Text>
                {a.produit && (
                  <Text size="xs" c="dimmed">
                    Produit : {a.produit}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <PrioriteFaits p={a.priorite} />
              </Table.Td>
              <Table.Td>
                <Text size="xs">{libellePresences(a)}</Text>
                {resumePresence(a).map((l) => (
                  <Text key={l} size="xs" c="dimmed">
                    {l}
                  </Text>
                ))}
              </Table.Td>
              <Table.Td>
                <StatusChip etat={ETAT_ALERTE_PUCE[a.etat]}>{libelleEtatAlerte(a.etat)}</StatusChip>
                {resumeSuiviAlerte(a).map((l) => (
                  <Text key={l} size="xs" c="dimmed" className="horodatage">
                    {l}
                  </Text>
                ))}
              </Table.Td>
            </Table.Tr>
          ))}
          {alertes.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text size="sm" c="dimmed">
                  Aucune alerte ne correspond.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Fiche d'une alerte (sans état) : faits, présence en nombres lisibles, suivi, liens vers les écrans du module. */
export function FicheAlerte({
  a,
  peutPrendreEnCompte,
  envoi = false,
  onPrendreEnCompte,
}: {
  a: AlerteVulnerabiliteDto;
  peutPrendreEnCompte: boolean;
  envoi?: boolean;
  onPrendreEnCompte: () => void;
}) {
  return (
    <Stack gap="sm">
      <Group gap="xs">
        <StatusChip etat={NIVEAU_ALERTE_PUCE[a.niveau]}>{NIVEAU_ALERTE_LIBELLES[a.niveau]}</StatusChip>
        <StatusChip etat={ETAT_ALERTE_PUCE[a.etat]}>{libelleEtatAlerte(a.etat)}</StatusChip>
        <Text size="sm" className="veille-code">
          {libelleFaille(a)}
        </Text>
      </Group>
      {a.produit && <Text size="sm">Produit : {a.produit}</Text>}
      <PrioriteFaits p={a.priorite} />
      <Text size="sm">
        <strong>Exploitation avérée :</strong> {libelleExploitation(a)}
      </Text>
      <Text size="sm">
        <strong>Présence :</strong> {libellePresences(a) || 'aucune'}
      </Text>
      <List size="sm" spacing="2xs">
        {resumePresence(a).map((l) => (
          <List.Item key={l}>{l}</List.Item>
        ))}
      </List>
      <List size="sm" spacing="2xs" className="horodatage">
        {resumeSuiviAlerte(a).map((l) => (
          <List.Item key={l}>{l}</List.Item>
        ))}
      </List>
      {!a.notifiee && a.etat !== 'close' && (
        <Text size="xs" c="dimmed">
          Alerte ouverte sans notification : plafond des alertes simples notifiées par évaluation atteint.
        </Text>
      )}
      <Text size="sm">
        Le détail (machines, actifs exposés, produits) se lit dans les écrans du module, selon vos droits :{' '}
        <Anchor component={Link} to="/vulnerabilites/failles">
          Failles détectées
        </Anchor>
        ,{' '}
        <Anchor component={Link} to="/vulnerabilites/veille">
          Veille
        </Anchor>
        ,{' '}
        <Anchor component={Link} to="/vulnerabilites/surface-externe">
          Surface externe
        </Anchor>
        .
      </Text>
      {a.etat === 'ouverte' &&
        (peutPrendreEnCompte ? (
          <Group>
            <Button color="red" loading={envoi} onClick={onPrendreEnCompte}>
              Pris en compte
            </Button>
            <Text size="xs" c="dimmed">
              Pour tout le monde ; tracé au journal.
            </Text>
          </Group>
        ) : (
          <Text size="xs" c="dimmed">
            Prendre une alerte en compte demande le droit de modifier le module Vulnérabilités.
          </Text>
        ))}
    </Stack>
  );
}

const OPTIONS_ETAT = FILTRES_ETAT_ALERTE.map((v) => ({ value: v, label: FILTRE_ETAT_ALERTE_LIBELLES[v] }));
const OPTIONS_NIVEAU = [
  { value: '', label: 'Tous' },
  ...NIVEAUX_ALERTE.map((v) => ({ value: v, label: NIVEAU_ALERTE_LIBELLES[v] })),
];

export function AlertesPage() {
  const can = useCan();
  const qc = useQueryClient();
  const lire = can('vulnerabilites', 'lire');
  const modifier = can('vulnerabilites', 'modifier');
  const [params, setParams] = useSearchParams();
  const ouverte = params.get('alerte');
  const [etat, setEtat] = useState<FiltreEtatAlerte>('actives');
  const [niveau, setNiveau] = useState<NiveauAlerte | ''>('');
  const [page, setPage] = useState(1);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const liste = useQuery({
    queryKey: [...CLE_ALERTES, 'liste', etat, niveau, page],
    queryFn: () => get<PageAlertesVulnerabilites>(urlAlertes({ etat, niveau }, page)),
    enabled: lire,
  });
  const fiche = useQuery({
    queryKey: [...CLE_ALERTES, 'fiche', ouverte],
    queryFn: () => get<AlerteVulnerabiliteDto>(urlAlerte(ouverte!)),
    enabled: lire && !!ouverte,
    retry: false,
  });
  const prendre = async (a: AlerteVulnerabiliteDto) => {
    setEnvoi(true);
    setErreur(null);
    try {
      await api('POST', urlPriseEnCompte(a.id), { ifMatch: a.version });
    } catch (e) {
      setErreur(
        e instanceof ApiError && e.status === 412
          ? new Error('L’alerte a changé depuis son affichage : vérifiez-la, puis recommencez.')
          : e,
      );
    } finally {
      setEnvoi(false);
      await qc.invalidateQueries({ queryKey: CLE_ALERTES });
    }
  };
  if (!lire)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit de lire les vulnérabilités.</Alert>
      </Page>
    );
  const pages = liste.data ? nombrePages(liste.data.total, liste.data.parPage) : 1;
  return (
    <Page>
      <PageHeader
        title="Alertes"
        description="Alertes décidées par la plateforme, par règle, jamais par l’assistant : critique quand une faille exploitée est présente chez nous (priorité P1 : détectée par Tenable, déclarée par un produit surveillé ou exposée sur Internet), simple quand une faille présente passe en P2 (seuil à confirmer par le RSSI). Une alerte par faille ; elle se met à jour sans se rejouer et se clôt d’elle-même quand la faille n’est plus présente, est traitée ou redescend sous le seuil. Les nombres ne comptent que ce que vous pouvez lire."
      />
      <Stack>
        <ErrorAlert error={liste.error} />
        <Group align="flex-end">
          <Select
            label="État"
            data={OPTIONS_ETAT}
            value={etat}
            allowDeselect={false}
            onChange={(v) => {
              setEtat((v as FiltreEtatAlerte) ?? 'actives');
              setPage(1);
            }}
          />
          <Select
            label="Niveau"
            data={OPTIONS_NIVEAU}
            value={niveau}
            allowDeselect={false}
            onChange={(v) => {
              setNiveau((v as NiveauAlerte | '') ?? '');
              setPage(1);
            }}
          />
        </Group>
        {liste.data && (
          <>
            <Text size="sm" c="dimmed">
              {liste.data.total} alerte{liste.data.total > 1 ? 's' : ''}
            </Text>
            <AlertesTable alertes={liste.data.elements} onOuvrir={(id) => setParams({ alerte: id })} />
            {pages > 1 && <Pagination value={page} onChange={setPage} total={pages} aria-label="Pages des alertes" />}
          </>
        )}
      </Stack>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fiche' }}
        opened={!!ouverte}
        onClose={() => {
          setErreur(null);
          setParams({});
        }}
        title={fiche.data?.titre ?? 'Alerte'}
        size="lg"
        centered
        lockScroll={false}
      >
        <ErrorAlert error={erreur ?? fiche.error} />
        {fiche.data && (
          <FicheAlerte
            a={fiche.data}
            peutPrendreEnCompte={modifier}
            envoi={envoi}
            onPrendreEnCompte={() => void prendre(fiche.data!)}
          />
        )}
      </Modal>
    </Page>
  );
}

/** Rappel discret dans l'en-tête du module quand une alerte critique est en cours (ouverte ou prise en compte). */
export function RappelAlertesCritiquesVue({ enCours }: { enCours: number }) {
  if (enCours < 1) return null;
  return (
    <div className="ac-rappel" role="status">
      <span>
        {enCours === 1 ? 'Une alerte critique en cours' : `${enCours} alertes critiques en cours`} : faille exploitée
        présente chez nous.
      </span>
      <Anchor component={Link} to="/vulnerabilites/alertes" size="sm">
        Voir les alertes
      </Anchor>
    </div>
  );
}

export function RappelAlertesCritiques() {
  const lire = useCan()('vulnerabilites', 'lire');
  const q = useQuery({
    queryKey: CLE_FENETRE,
    queryFn: () => get<FenetreAlertesDto>(urlFenetre()),
    enabled: lire,
    refetchInterval: 60_000,
    retry: false,
  });
  if (!lire || !q.data) return null;
  return <RappelAlertesCritiquesVue enCours={q.data.enCours} />;
}

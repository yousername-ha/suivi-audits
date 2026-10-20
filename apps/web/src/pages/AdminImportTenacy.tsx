/* Administration → Import Tenacy : l'onglet « Gaps » d'un export Excel Tenacy devient des écarts et des actions du
   périmètre choisi. Lecture du classeur dans le navigateur, simulation sans écriture, puis application exacte. */
import { Alert, Badge, Button, Card, FileButton, Group, Select, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { TENACY_FEUILLE, TENACY_LIMITES } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, get } from '../api';
import { ouvrirClasseur } from '../grc/workbook';

interface Ligne {
  ligne: number;
  id: string;
  nom: string;
  resultat: 'cree' | 'maj' | 'inchange' | 'conserve';
  statut: string;
  changements: string[];
  actionsACreer: number;
  mesures: string[];
  mesuresInconnues: string[];
  pilote: string;
  piloteRattache: boolean;
}
interface Rapport {
  empreinte: string;
  totaux: {
    lignes: number;
    crees: number;
    miseAJour: number;
    inchanges: number;
    closConserves: number;
    actionsACreer: number;
  };
  lignes: Ligne[];
  avertissements: string[];
  erreurs: { ligne: number; message: string }[];
}
const RESULTAT: Record<Ligne['resultat'], [string, string]> = {
  cree: ['créé', 'teal'],
  maj: ['mis à jour', 'blue'],
  inchange: ['inchangé', 'gray'],
  conserve: ['conservé (clos)', 'gray'],
};
const STATUT: Record<string, string> = { open: 'Ouvert', progress: 'En cours', closed: 'Clos' };

export function ImportTenacyPanel() {
  const qc = useQueryClient();
  const perimetres = useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () => get<{ id: string; name: string }[]>('/api/grc/smsis'),
  });
  const [fichier, setFichier] = useState<{ nom: string; lignes: (string | null)[][] } | null>(null);
  const [perimetre, setPerimetre] = useState<string | null>(null);
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const corps = () => ({ perimetre, lignes: fichier!.lignes });
  const raz = () => {
    setRapport(null);
    setErreur('');
  };
  const executer = async (fn: () => Promise<void>) => {
    setOccupe(true);
    setErreur('');
    try {
      await fn();
    } catch (e) {
      setErreur(errorMessage(e));
    } finally {
      setOccupe(false);
    }
  };
  const lire = async (f: File | null) => {
    if (!f) return;
    raz();
    setFichier(null);
    try {
      const classeur = ouvrirClasseur(new Uint8Array(await f.arrayBuffer()), TENACY_LIMITES.colonnes);
      if (!classeur.feuilles().includes(TENACY_FEUILLE))
        throw new Error(`Ce classeur n’a pas d’onglet « ${TENACY_FEUILLE} » : choisissez un export Tenacy.`);
      const lignes = classeur.lignes(TENACY_FEUILLE);
      if (lignes.length > TENACY_LIMITES.lignes + 1)
        throw new Error(`Au plus ${TENACY_LIMITES.lignes} écarts par import.`);
      setFichier({ nom: f.name, lignes: lignes.map((r) => Array.from(r, (c) => c ?? null)) });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Classeur illisible.');
    }
  };
  const simuler = () =>
    executer(async () =>
      setRapport(await api<Rapport>('POST', '/api/admin/import/tenacy/simulate', { body: corps() })),
    );
  const appliquer = () =>
    executer(async () => {
      const r = await api<Rapport>('POST', '/api/admin/import/tenacy/apply', {
        body: { ...corps(), empreinte: rapport!.empreinte },
      });
      notifications.show({
        color: 'teal',
        title: 'Import Tenacy appliqué',
        message: `${r.totaux.crees} écart(s) créé(s), ${r.totaux.miseAJour} mis à jour, ${r.totaux.actionsACreer} action(s) créée(s).`,
      });
      setFichier(null);
      raz();
      await qc.invalidateQueries();
    });
  const t = rapport?.totaux;
  const modifie = !!t && t.crees + t.miseAJour + t.actionsACreer > 0;

  return (
    <Stack aria-label="Import Tenacy" role="region">
      <Title order={3} size="h4">
        Import Tenacy
      </Title>
      <Text c="dimmed" size="sm">
        Écarts d’un export Excel Tenacy (onglet « {TENACY_FEUILLE} ») : chaque ligne devient un écart du périmètre
        choisi, les étapes de la recommandation deviennent des actions liées. Un écart déjà importé est retrouvé par son
        identifiant Tenacy et mis à jour ; un écart clos dans l’outil est conservé. La simulation n’écrit rien.
      </Text>
      <Card withBorder>
        <Stack>
          <Select
            label="Périmètre de destination"
            data={(perimetres.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            value={perimetre}
            onChange={(v) => {
              setPerimetre(v);
              raz();
            }}
            searchable
            className="champ-l"
          />
          <Group>
            <FileButton accept=".xlsx" onChange={lire}>
              {(props) => (
                <Button {...props}>{fichier ? 'Changer de fichier' : 'Choisir l’export Tenacy (.xlsx)'}</Button>
              )}
            </FileButton>
            {fichier && (
              <Text size="sm">
                {fichier.nom} ({fichier.lignes.length - 1} ligne(s))
              </Text>
            )}
          </Group>
          <Button onClick={simuler} disabled={!fichier || !perimetre} loading={occupe && !rapport} w="fit-content">
            Simuler les écarts Tenacy
          </Button>
          {erreur && (
            <Alert color="red" title="Import Tenacy impossible" role="alert">
              {erreur}
            </Alert>
          )}
        </Stack>
      </Card>

      {rapport && t && (
        <Card withBorder>
          <Stack>
            <Group gap="xs">
              <Badge color="teal">{t.crees} créé(s)</Badge>
              <Badge color="blue">{t.miseAJour} mis à jour</Badge>
              <Badge color="gray">{t.inchanges} inchangé(s)</Badge>
              <Badge color="gray">{t.closConserves} clos conservé(s)</Badge>
              <Badge color="violet">{t.actionsACreer} action(s) à créer</Badge>
            </Group>
            {rapport.erreurs.length > 0 && (
              <Alert color="red" title="Lignes refusées" role="alert">
                {rapport.erreurs.map((e) => `Ligne ${e.ligne} : ${e.message}`).join('\n')}
              </Alert>
            )}
            {rapport.avertissements.map((a) => (
              <Alert key={a} color="yellow">
                {a}
              </Alert>
            ))}
            <div className="table-wrap" role="region" aria-label="Écarts Tenacy" tabIndex={0}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Id Tenacy</Table.Th>
                    <Table.Th>Écart</Table.Th>
                    <Table.Th>Statut</Table.Th>
                    <Table.Th>Résultat</Table.Th>
                    <Table.Th>Actions</Table.Th>
                    <Table.Th>Pilote</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rapport.lignes.map((l) => (
                    <Table.Tr key={l.id}>
                      <Table.Td>{l.id}</Table.Td>
                      <Table.Td>
                        {l.nom}
                        {l.changements.length > 0 && (
                          <Text size="xs" c="dimmed">
                            À modifier : {l.changements.join(', ')}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>{STATUT[l.statut] ?? l.statut}</Table.Td>
                      <Table.Td>
                        <Badge color={RESULTAT[l.resultat][1]} variant="light">
                          {RESULTAT[l.resultat][0]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{l.actionsACreer}</Table.Td>
                      <Table.Td>
                        {l.pilote || '—'}
                        {l.pilote && !l.piloteRattache && (
                          <Text size="xs" c="dimmed">
                            sans compte correspondant
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
            {!modifie ? (
              <Alert color="gray">Rien à importer : les écarts de ce fichier sont déjà à jour.</Alert>
            ) : (
              <Group>
                <Button onClick={appliquer} loading={occupe} disabled={rapport.erreurs.length > 0}>
                  Appliquer les écarts Tenacy
                </Button>
                <Button variant="default" onClick={raz}>
                  Annuler
                </Button>
              </Group>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

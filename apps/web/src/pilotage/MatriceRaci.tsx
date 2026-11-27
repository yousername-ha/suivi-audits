/* Matrice RACI d'un fournisseur (ADR 0113 ; décision du RSSI du 23/11/2026, maquette validée) : onglet « Machines et
   responsabilités » de la fiche. Activités en lignes, acteurs en colonnes (le fournisseur, puis les fonctions de
   l'établissement), une liste R / A / C / I / — par case, colonne « Contrôle » (Conforme, Aucun A, Plusieurs A, Aucun R)
   et résumé des activités à revoir (role=status). La règle avertit sans bloquer l'enregistrement. Lecture seule sans le
   droit de modifier les fournisseurs ; suppression de la matrice avec le droit « supprimer » (ADR 0068). */
import { ActionIcon, Alert, Button, Group, NativeSelect, Stack, Table, Text, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  RACI_LETTRES,
  RACI_LETTRES_LIBELLES,
  activitesARevoirRaci,
  controleRaci,
  libelleControleRaci,
  matriceRaciModele,
  nettoyerLibelleRaci,
  type LettreRaci,
  type MatriceRaciReponse,
} from '@suivi/shared';
import { ConfirmButton, DataTable, ErrorAlert, StatusChip } from '@suivi/ui';
import { api, ApiError, get } from '../api';
import { useCan } from '../session';
import {
  ajouterActeur,
  ajouterActivite,
  avecLettre,
  colonnesRaci,
  deplacerActivite,
  lettreRaci,
  libellesVides,
  nomCaseRaci,
  peutAjouterActeur,
  peutAjouterActivite,
  renommer,
  retirerActeur,
  retirerActivite,
  type ContenuRaci,
} from './raci';

const AUCUNE = '';
const OPTIONS = [{ value: AUCUNE, label: '—' }, ...RACI_LETTRES.map((l) => ({ value: l, label: l }))];
const cle = (id: string) => ['grc', 'fournisseurs-raci', id];
/** Clé et adresse de la matrice d'un fournisseur, partagées avec le pied de la fiche « Verre » (auteur de la modification). */
export const cleMatriceRaci = cle;
export const urlMatriceRaci = (id: string) => `/api/suppliers/${encodeURIComponent(id)}/raci`;

/** Légende de la maquette. */
export function LegendeRaci() {
  return (
    <Text size="sm" c="dimmed">
      Légende :{' '}
      {RACI_LETTRES.map((l, i) => (
        <span key={l}>
          {i > 0 && ' · '}
          <strong>{l}</strong> {RACI_LETTRES_LIBELLES[l]}
        </span>
      ))}
      {' · '}
      <strong>—</strong> non concerné.
    </Text>
  );
}

/** Résumé de la règle « exactement un A, au moins un R », annoncé sans interrompre (role=status). */
export function ResumeControleRaci({ contenu }: { contenu: ContenuRaci }) {
  const aRevoir = activitesARevoirRaci(controleRaci(contenu));
  return (
    <Alert role="status" color={aRevoir.length ? 'orange' : 'suivi'} title="Contrôle de la matrice">
      {!contenu.activites.length
        ? 'Aucune activité : ajoutez-en une.'
        : aRevoir.length
          ? `${aRevoir.length === 1 ? '1 activité à revoir' : `${aRevoir.length} activités à revoir`} (règle : exactement un A et au moins un R) : ${aRevoir
              .map((c) => `« ${c.libelle} » (${libelleControleRaci(c)})`)
              .join(' ; ')}. L’enregistrement reste possible.`
          : 'Toutes les activités ont exactement un A et au moins un R.'}
    </Alert>
  );
}

export interface TableauRaciProps {
  contenu: ContenuRaci;
  nomFournisseur: string;
  modifiable: boolean;
  onChange: (c: ContenuRaci) => void;
}

/** Tableau accessible : en-têtes de colonnes (acteurs) et de lignes (activités), une liste nommée par case. */
export function TableauRaci({ contenu, nomFournisseur, modifiable, onChange }: TableauRaciProps) {
  const colonnes = colonnesRaci(contenu, nomFournisseur);
  const controles = new Map(controleRaci(contenu).map((c) => [c.activite, c]));
  return (
    <DataTable label={`Matrice RACI de ${nomFournisseur}`}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Activité</Table.Th>
            {colonnes.map((col) => (
              <Table.Th scope="col" key={col.id}>
                {modifiable && !col.fournisseur ? (
                  <Group gap="xs" wrap="nowrap">
                    <TextInput
                      size="xs"
                      aria-label={`Nom de l’acteur « ${col.libelle} »`}
                      value={col.libelle}
                      onChange={(e) => onChange(renommer(contenu, 'acteurs', col.id, e.currentTarget.value))}
                    />
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Retirer l’acteur « ${col.libelle} »`}
                      onClick={() => onChange(retirerActeur(contenu, col.id))}
                    >
                      ×
                    </ActionIcon>
                  </Group>
                ) : (
                  col.libelle
                )}
              </Table.Th>
            ))}
            <Table.Th scope="col">Contrôle</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {contenu.activites.map((act, i) => {
            const controle = controles.get(act.id)!;
            return (
              <Table.Tr key={act.id}>
                <Table.Th scope="row">
                  {modifiable ? (
                    <Group gap="xs" wrap="nowrap">
                      <TextInput
                        size="xs"
                        aria-label={`Nom de l’activité « ${act.libelle} »`}
                        value={act.libelle}
                        onChange={(e) => onChange(renommer(contenu, 'activites', act.id, e.currentTarget.value))}
                      />
                      <ActionIcon
                        variant="subtle"
                        disabled={i === 0}
                        aria-label={`Monter l’activité « ${act.libelle} »`}
                        onClick={() => onChange(deplacerActivite(contenu, act.id, -1))}
                      >
                        ↑
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        disabled={i === contenu.activites.length - 1}
                        aria-label={`Descendre l’activité « ${act.libelle} »`}
                        onClick={() => onChange(deplacerActivite(contenu, act.id, 1))}
                      >
                        ↓
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Retirer l’activité « ${act.libelle} »`}
                        onClick={() => onChange(retirerActivite(contenu, act.id))}
                      >
                        ×
                      </ActionIcon>
                    </Group>
                  ) : (
                    act.libelle
                  )}
                </Table.Th>
                {colonnes.map((col) => {
                  const lettre = lettreRaci(contenu, act.id, col.id);
                  return (
                    <Table.Td key={col.id}>
                      {modifiable ? (
                        <NativeSelect
                          size="xs"
                          aria-label={nomCaseRaci(act.libelle, col.libelle)}
                          data={OPTIONS}
                          value={lettre ?? AUCUNE}
                          onChange={(e) =>
                            onChange(
                              avecLettre(
                                contenu,
                                act.id,
                                col.id,
                                e.currentTarget.value === AUCUNE ? null : (e.currentTarget.value as LettreRaci),
                              ),
                            )
                          }
                        />
                      ) : (
                        (lettre ?? '—')
                      )}
                    </Table.Td>
                  );
                })}
                <Table.Td>
                  <StatusChip etat={controle.ecarts.length ? 'attention' : 'succes'}>
                    {libelleControleRaci(controle)}
                  </StatusChip>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Section « Matrice RACI » de la fiche : lecture, création à partir du modèle, saisie, enregistrement et suppression. */
export function MatriceRaciFournisseur({
  fournisseurId,
  nomFournisseur,
}: {
  fournisseurId: string;
  nomFournisseur: string;
}) {
  const can = useCan(),
    qc = useQueryClient(),
    modifiable = can('fournisseurs', 'modifier'),
    supprimable = can('fournisseurs', 'supprimer'),
    [brouillon, setBrouillon] = useState<{ version: number; contenu: ContenuRaci } | null>(null),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false);
  const url = urlMatriceRaci(fournisseurId);
  const lue = useQuery({ queryKey: cle(fournisseurId), queryFn: () => get<MatriceRaciReponse>(url) });
  const matrice = lue.data?.matrice ?? null;
  const contenu: ContenuRaci | null =
    brouillon?.contenu ??
    (matrice ? { activites: matrice.activites, acteurs: matrice.acteurs, cases: matrice.cases } : null);
  const enregistrer = async (c: ContenuRaci, version: number) => {
    setEnvoi(true);
    try {
      setErreur(null);
      const r = await api<MatriceRaciReponse>('PUT', url, {
        ifMatch: version,
        body: {
          activites: c.activites.map((a) => ({ ...a, libelle: nettoyerLibelleRaci(a.libelle) })),
          acteurs: c.acteurs.map((a) => ({ ...a, libelle: nettoyerLibelleRaci(a.libelle) })),
          cases: c.cases,
        },
      });
      qc.setQueryData(cle(fournisseurId), r);
      setBrouillon(null);
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const supprimer = async () => {
    if (!matrice) return;
    try {
      setErreur(null);
      await api('DELETE', url, { ifMatch: matrice.version });
      setBrouillon(null);
      await qc.invalidateQueries({ queryKey: cle(fournisseurId) });
    } catch (e) {
      setErreur(e);
    }
  };
  const recharger = async () => {
    setBrouillon(null);
    setErreur(null);
    await qc.invalidateQueries({ queryKey: cle(fournisseurId) });
  };
  const modifier = (c: ContenuRaci) =>
    setBrouillon({ version: brouillon?.version ?? matrice?.version ?? 0, contenu: c });
  const conflit = erreur instanceof ApiError && erreur.status === 412;
  return (
    <Stack gap="sm">
      <Text fw={600} data-fiche-section="Matrice RACI">
        Matrice RACI
      </Text>
      <ErrorAlert error={erreur ?? lue.error} />
      {conflit && (
        <Group>
          <Button variant="default" onClick={recharger}>
            Recharger la matrice enregistrée
          </Button>
        </Group>
      )}
      {lue.isPending ? (
        <Text size="sm">Chargement de la matrice…</Text>
      ) : !contenu ? (
        <Stack gap="xs">
          <Text size="sm">
            Aucune matrice RACI pour ce fournisseur.
            {modifiable &&
              ' « Créer la matrice RACI » part du modèle (sept activités ; le fournisseur, RSSI, DSI et Référent métier), modifiable ensuite.'}
          </Text>
          {modifiable && (
            <Group>
              <Button loading={envoi} onClick={() => enregistrer(matriceRaciModele(), 0)}>
                Créer la matrice RACI
              </Button>
            </Group>
          )}
        </Stack>
      ) : (
        <>
          <LegendeRaci />
          <TableauRaci contenu={contenu} nomFournisseur={nomFournisseur} modifiable={modifiable} onChange={modifier} />
          <ResumeControleRaci contenu={contenu} />
          {modifiable && (
            <Group justify="space-between">
              <Group>
                <Button
                  variant="default"
                  disabled={!peutAjouterActeur(contenu)}
                  onClick={() => modifier(ajouterActeur(contenu))}
                >
                  Ajouter un acteur
                </Button>
                <Button
                  variant="default"
                  disabled={!peutAjouterActivite(contenu)}
                  onClick={() => modifier(ajouterActivite(contenu))}
                >
                  Ajouter une activité
                </Button>
              </Group>
              <Group>
                {supprimable && matrice && (
                  <ConfirmButton
                    variant="subtle"
                    message={`Supprimer la matrice RACI de ${nomFournisseur} ? Ses activités, ses acteurs et ses lettres seront effacés.`}
                    onConfirm={supprimer}
                  >
                    Supprimer la matrice
                  </ConfirmButton>
                )}
                {brouillon && (
                  <Button variant="default" onClick={() => setBrouillon(null)}>
                    Annuler les modifications
                  </Button>
                )}
                <Button
                  loading={envoi}
                  disabled={!brouillon || libellesVides(contenu)}
                  onClick={() => brouillon && enregistrer(brouillon.contenu, brouillon.version)}
                >
                  Enregistrer la matrice RACI
                </Button>
              </Group>
            </Group>
          )}
          {modifiable && libellesVides(contenu) && (
            <Text size="sm" c="red">
              Chaque activité et chaque acteur doit avoir un nom.
            </Text>
          )}
        </>
      )}
    </Stack>
  );
}

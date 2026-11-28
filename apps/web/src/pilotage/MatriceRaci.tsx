/* Matrice RACI d'un fournisseur (ADR 0113 ; décision du RSSI du 23/11/2026, maquette validée) : onglet « Machines et
   responsabilités » de la fiche. Activités en lignes, acteurs en colonnes (le fournisseur, puis les fonctions de
   l'établissement), une liste R / A / C / I / — par case, colonne « Contrôle » (Conforme, Aucun A, Plusieurs A, Aucun R)
   et résumé des activités à revoir (role=status). La règle avertit sans bloquer l'enregistrement. Lecture seule sans le
   droit de modifier les fournisseurs ; suppression de la matrice avec le droit « supprimer » (ADR 0068).
   La légende, la grille (GrilleRaci) et le résumé servent aussi à la matrice « Qui décide quoi » des rôles et
   responsabilités (ADR 0115, QuiDecideQuoi.tsx), avec leurs mots et leurs colonnes. */
import { ActionIcon, Alert, Button, Group, NativeSelect, Stack, Table, Text, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import {
  RACI_LETTRES,
  RACI_LETTRES_LIBELLES,
  activitesARevoirRaci,
  controleRaci,
  libelleControleRaci,
  matriceRaciModele,
  nettoyerLibelleRaci,
  type ControleActiviteRaci,
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
  colonnesGrilleFournisseur,
  deplacerActivite,
  lettreRaci,
  libellesVides,
  nomCaseRaci,
  peutAjouterActeur,
  peutAjouterActivite,
  renommer,
  retirerActeur,
  retirerActivite,
  type ColonneGrilleRaci,
  type ContenuRaci,
} from './raci';

const AUCUNE = '';
const OPTIONS = [{ value: AUCUNE, label: '—' }, ...RACI_LETTRES.map((l) => ({ value: l, label: l }))];
const cle = (id: string) => ['grc', 'fournisseurs-raci', id];
/** Clé et adresse de la matrice d'un fournisseur, partagées avec le pied de la fiche « Verre » (auteur de la modification). */
export const cleMatriceRaci = cle;
export const urlMatriceRaci = (id: string) => `/api/suppliers/${encodeURIComponent(id)}/raci`;

/** Légende de la maquette ; `libelles` : légende propre à une autre matrice (« Qui décide quoi »). */
export function LegendeRaci({
  libelles = RACI_LETTRES_LIBELLES,
  className,
}: {
  libelles?: Record<LettreRaci, string>;
  className?: string;
}) {
  return (
    <Text size="sm" c="dimmed" className={className}>
      Légende :{' '}
      {RACI_LETTRES.map((l, i) => (
        <span key={l}>
          {i > 0 && ' · '}
          <strong>{l}</strong> {libelles[l]}
        </span>
      ))}
      {' · '}
      <strong>—</strong> non concerné.
    </Text>
  );
}

/** Mots d'une matrice : nom des lignes (« activité », « décision », féminins) et des colonnes (« l’acteur », « le rôle »). */
export interface MotsRaci {
  /** En-tête de la colonne des lignes. */
  entete: string;
  /** Nom d'une ligne, au singulier et au pluriel. */
  ligne: string;
  lignes: string;
  /** Nom d'une ligne et d'une colonne avec leur article (« l’activité », « le rôle »). */
  laLigne: string;
  laColonne: string;
}
export const MOTS_ACTIVITES: MotsRaci = {
  entete: 'Activité',
  ligne: 'activité',
  lignes: 'activités',
  laLigne: 'l’activité',
  laColonne: 'l’acteur',
};

/** Résumé de la règle « exactement un A, au moins un R », annoncé sans interrompre (role=status). `controles` : contrôle
    déjà calculé (par défaut, celui de la matrice d'un fournisseur) ; `children` : précision ajoutée après le résumé. */
export function ResumeControleRaci({
  contenu,
  controles,
  mots = MOTS_ACTIVITES,
  children,
}: {
  contenu: ContenuRaci;
  controles?: readonly ControleActiviteRaci[];
  mots?: MotsRaci;
  children?: ReactNode;
}) {
  const aRevoir = activitesARevoirRaci(controles ?? controleRaci(contenu));
  return (
    <Alert role="status" color={aRevoir.length ? 'orange' : 'suivi'} title="Contrôle de la matrice">
      {!contenu.activites.length
        ? `Aucune ${mots.ligne} : ajoutez-en une.`
        : aRevoir.length
          ? `${aRevoir.length === 1 ? `1 ${mots.ligne} à revoir` : `${aRevoir.length} ${mots.lignes} à revoir`} (règle : exactement un A et au moins un R) : ${aRevoir
              .map((c) => `« ${c.libelle} » (${libelleControleRaci(c)})`)
              .join(' ; ')}. L’enregistrement reste possible.`
          : `Toutes les ${mots.lignes} ont exactement un A et au moins un R.`}
      {children}
    </Alert>
  );
}

export interface TableauRaciProps {
  contenu: ContenuRaci;
  nomFournisseur: string;
  modifiable: boolean;
  onChange: (c: ContenuRaci) => void;
}

/** Tableau de la matrice d'un fournisseur : la grille commune, avec la colonne du fournisseur puis les fonctions. */
export function TableauRaci({ contenu, nomFournisseur, modifiable, onChange }: TableauRaciProps) {
  return (
    <GrilleRaci
      label={`Matrice RACI de ${nomFournisseur}`}
      contenu={contenu}
      colonnes={colonnesGrilleFournisseur(contenu, nomFournisseur)}
      controles={controleRaci(contenu)}
      modifiable={modifiable}
      onChange={onChange}
    />
  );
}

export interface GrilleRaciProps {
  /** Nom accessible du tableau. */
  label: string;
  contenu: ContenuRaci;
  colonnes: readonly ColonneGrilleRaci[];
  /** Contrôle de chaque ligne (colonne « Contrôle »), dans n'importe quel ordre. */
  controles: readonly ControleActiviteRaci[];
  modifiable: boolean;
  onChange: (c: ContenuRaci) => void;
  mots?: MotsRaci;
  /** Taille des champs : « xs » pour la fiche du fournisseur, « sm » (14 px) pour une matrice de pleine page. */
  taille?: 'xs' | 'sm';
  className?: string;
  /** Lettres en puces colorées (matrice « Qui décide quoi » en style « Verre ») : chaque case porte sa lettre
      (data-lettre), la case « Contrôle » son état (data-controle : conforme ou a-revoir) et, en lecture, la lettre
      s'écrit dans une puce. Le texte lu reste la lettre, ou « — ». */
  lettresEnPuces?: boolean;
}

/** Grille accessible commune : en-têtes de colonnes et de lignes, une liste nommée « <ligne> – <colonne> » par case,
    colonne « Contrôle ». Une colonne retirée ne propose que sa lettre actuelle et « — ». */
export function GrilleRaci({
  label,
  contenu,
  colonnes,
  controles: liste,
  modifiable,
  onChange,
  mots = MOTS_ACTIVITES,
  taille = 'xs',
  className,
  lettresEnPuces = false,
}: GrilleRaciProps) {
  const controles = new Map(liste.map((c) => [c.activite, c]));
  return (
    <DataTable label={label}>
      <Table className={className}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">{mots.entete}</Table.Th>
            {colonnes.map((col) => (
              <Table.Th scope="col" key={col.id}>
                {modifiable && col.renommable ? (
                  <Group gap="xs" wrap="nowrap">
                    <TextInput
                      size={taille}
                      aria-label={`Nom de ${mots.laColonne} « ${col.libelle} »`}
                      value={col.libelle}
                      onChange={(e) => onChange(renommer(contenu, 'acteurs', col.id, e.currentTarget.value))}
                    />
                    {col.retirable && (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Retirer ${mots.laColonne} « ${col.libelle} »`}
                        onClick={() => onChange(retirerActeur(contenu, col.id))}
                      >
                        ×
                      </ActionIcon>
                    )}
                  </Group>
                ) : modifiable && col.retirable ? (
                  <Group gap="xs" wrap="nowrap">
                    {col.libelle}
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Retirer ${mots.laColonne} « ${col.libelle} » et ses lettres`}
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
            const controle = controles.get(act.id);
            return (
              <Table.Tr key={act.id}>
                <Table.Th scope="row">
                  {modifiable ? (
                    <Group gap="xs" wrap="nowrap">
                      <TextInput
                        size={taille}
                        aria-label={`Nom de ${mots.laLigne} « ${act.libelle} »`}
                        value={act.libelle}
                        onChange={(e) => onChange(renommer(contenu, 'activites', act.id, e.currentTarget.value))}
                      />
                      <ActionIcon
                        variant="subtle"
                        disabled={i === 0}
                        aria-label={`Monter ${mots.laLigne} « ${act.libelle} »`}
                        onClick={() => onChange(deplacerActivite(contenu, act.id, -1))}
                      >
                        ↑
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        disabled={i === contenu.activites.length - 1}
                        aria-label={`Descendre ${mots.laLigne} « ${act.libelle} »`}
                        onClick={() => onChange(deplacerActivite(contenu, act.id, 1))}
                      >
                        ↓
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Retirer ${mots.laLigne} « ${act.libelle} »`}
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
                    <Table.Td key={col.id} data-lettre={(lettresEnPuces && lettre) || undefined}>
                      {modifiable ? (
                        <NativeSelect
                          size={taille}
                          aria-label={nomCaseRaci(act.libelle, col.libelle)}
                          data={col.retiree ? OPTIONS.filter((o) => o.value === AUCUNE || o.value === lettre) : OPTIONS}
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
                      ) : lettresEnPuces ? (
                        <span className="raci-puce" data-lettre={lettre ?? undefined}>
                          {lettre ?? '—'}
                        </span>
                      ) : (
                        (lettre ?? '—')
                      )}
                    </Table.Td>
                  );
                })}
                <Table.Td
                  data-controle={
                    lettresEnPuces && controle ? (controle.ecarts.length ? 'a-revoir' : 'conforme') : undefined
                  }
                >
                  {controle && (
                    <StatusChip etat={controle.ecarts.length ? 'attention' : 'succes'}>
                      {libelleControleRaci(controle)}
                    </StatusChip>
                  )}
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

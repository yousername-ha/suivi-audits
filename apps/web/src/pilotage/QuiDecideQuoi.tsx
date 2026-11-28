/* « Qui décide quoi » (ADR 0115 ; décision du RSSI du 27/11/2026) : matrice RACI des décisions de l'organisation, sous la
   liste des fiches de « Rôles et responsabilités », pour le périmètre affiché. Décisions en lignes (saisies librement,
   aucune au départ), rôles du registre en colonnes (libellés de leur nom ; un rôle retiré du registre garde ses lettres
   dans une colonne « Rôle retiré », effaçables). Même grille et même règle que la matrice des fournisseurs (ADR 0113) :
   une liste R / A / C / I / — par case, colonne « Contrôle », résumé des décisions à revoir (role=status), sans bloquer
   l'enregistrement. Lecture seule sans le droit de modifier le pilotage. Textes de 14 px au moins, graisse 500 à 700
   (classe qui-decide-quoi, app.css). */
import { Button, Group, Stack, Text, Title } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { RACI_DECISIONS_LETTRES_LIBELLES, type MatriceDecisionsReponse } from '@suivi/shared';
import { ErrorAlert } from '@suivi/ui';
import { api, ApiError, get } from '../api';
import { useCan, useMe } from '../session';
import { GrilleRaci, LegendeRaci, ResumeControleRaci, type MotsRaci } from './MatriceRaci';
import {
  ajouterDecision,
  colonnesDecisions,
  contenuDecisions,
  controleSaisieDecisions,
  corpsDecisions,
  decisionsSansNom,
  peutAjouterDecision,
  rolesRetiresAvecLettres,
} from './qui-decide-quoi';
import { ANCRE_QUI_DECIDE_QUOI } from './role-verre';
import type { ContenuRaci } from './raci';

export const MOTS_DECISIONS: MotsRaci = {
  entete: 'Décision',
  ligne: 'décision',
  lignes: 'décisions',
  laLigne: 'la décision',
  laColonne: 'le rôle',
};
/** Clé de cache et adresse de la matrice d'un périmètre, partagées avec la fenêtre d'un rôle en style « Verre ». */
export const cleQuiDecideQuoi = (smsi: string) => ['grc', smsi, 'responsabilites-raci'];
export const urlQuiDecideQuoi = (smsi: string) => `/api/grc/${smsi}/pilotage/responsabilites/raci`;
const cle = cleQuiDecideQuoi;

/** Note du résumé : rôles retirés dont les lettres sont gardées hors du contrôle. */
export function NoteRolesRetires({ nombre }: { nombre: number }) {
  if (!nombre) return null;
  return (
    <Text size="sm" fw={500} mt="xs">
      {nombre === 1 ? 'Un rôle a quitté' : `${nombre} rôles ont quitté`} le registre : ses lettres sont conservées dans
      la colonne « Rôle retiré » mais ne comptent plus dans le contrôle. Reportez-les sur un rôle actuel, puis
      effacez-les (bouton × de la colonne).
    </Text>
  );
}

export function QuiDecideQuoi({ smsi }: { smsi: string }) {
  const can = useCan(),
    qc = useQueryClient(),
    titre = useId(),
    modifiable = can('pilotage', 'modifier'),
    // Style « Verre » : panneau de verre et lettres en puces colorées (verre-roles.css) ; mêmes opérations et règles.
    verre = useMe().appearance.style === 'verre',
    [brouillon, setBrouillon] = useState<{ version: number; contenu: ContenuRaci } | null>(null),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false);
  const url = urlQuiDecideQuoi(smsi);
  const lue = useQuery({ queryKey: cle(smsi), queryFn: () => get<MatriceDecisionsReponse>(url) });
  const roles = lue.data?.roles ?? [];
  const matrice = lue.data?.matrice ?? null;
  const enregistree = contenuDecisions(matrice, roles);
  // Les colonnes suivent toujours le registre, même pendant une saisie (rôle ajouté, renommé ou retiré entre-temps).
  const contenu: ContenuRaci = brouillon ? { ...brouillon.contenu, acteurs: enregistree.acteurs } : enregistree;
  const colonnes = colonnesDecisions(roles, contenu);
  const retires = rolesRetiresAvecLettres(roles, contenu);
  const modifier = (c: ContenuRaci) =>
    setBrouillon({ version: brouillon?.version ?? matrice?.version ?? 0, contenu: c });
  const enregistrer = async () => {
    if (!brouillon) return;
    setEnvoi(true);
    try {
      setErreur(null);
      const r = await api<MatriceDecisionsReponse>('PUT', url, {
        ifMatch: brouillon.version,
        body: corpsDecisions(contenu),
      });
      qc.setQueryData(cle(smsi), r);
      setBrouillon(null);
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const recharger = async () => {
    setBrouillon(null);
    setErreur(null);
    await qc.invalidateQueries({ queryKey: cle(smsi) });
  };
  const conflit = erreur instanceof ApiError && erreur.status === 412;
  return (
    // Ancre de « Voir la matrice complète » (fenêtre d'un rôle, style « Verre ») : la section reçoit le focus à l'arrivée.
    <section className="qui-decide-quoi" id={ANCRE_QUI_DECIDE_QUOI} tabIndex={-1} aria-labelledby={titre}>
      <Stack gap="sm">
        <Title order={2} size="h3" id={titre}>
          Qui décide quoi
        </Title>
        <LegendeRaci libelles={RACI_DECISIONS_LETTRES_LIBELLES} className="qui-decide-quoi__legende" />
        <ErrorAlert error={erreur ?? lue.error} />
        {conflit && (
          <Group>
            <Button variant="default" onClick={recharger}>
              Recharger le tableau enregistré
            </Button>
          </Group>
        )}
        {lue.isPending ? (
          <Text size="sm">Chargement du tableau…</Text>
        ) : (
          <>
            {!roles.length && (
              <Text size="sm" fw={500}>
                Aucun rôle dans le registre de ce périmètre : les rôles ajoutés ci-dessus forment les colonnes du
                tableau.
              </Text>
            )}
            {!contenu.activites.length ? (
              <Text size="sm" fw={500}>
                Aucune décision pour le moment.
                {modifiable &&
                  ' « Ajouter une décision » ouvre une ligne à nommer ; chaque rôle du registre a sa colonne.'}
              </Text>
            ) : (
              <>
                <GrilleRaci
                  label="Qui décide quoi : décisions et rôles"
                  className="qui-decide-quoi__grille"
                  contenu={contenu}
                  colonnes={colonnes}
                  controles={controleSaisieDecisions(contenu)}
                  modifiable={modifiable}
                  onChange={modifier}
                  mots={MOTS_DECISIONS}
                  taille="sm"
                  lettresEnPuces={verre}
                />
                <ResumeControleRaci
                  contenu={contenu}
                  controles={controleSaisieDecisions(contenu)}
                  mots={MOTS_DECISIONS}
                >
                  <NoteRolesRetires nombre={retires.length} />
                </ResumeControleRaci>
              </>
            )}
            {modifiable && (
              <Group justify="space-between">
                <Button
                  variant="default"
                  disabled={!peutAjouterDecision(contenu)}
                  onClick={() => modifier(ajouterDecision(contenu))}
                >
                  Ajouter une décision
                </Button>
                <Group>
                  {brouillon && (
                    <Button variant="default" onClick={() => setBrouillon(null)}>
                      Annuler les modifications
                    </Button>
                  )}
                  <Button loading={envoi} disabled={!brouillon || decisionsSansNom(contenu)} onClick={enregistrer}>
                    Enregistrer le tableau
                  </Button>
                </Group>
              </Group>
            )}
            {modifiable && decisionsSansNom(contenu) && (
              <Text size="sm" c="red">
                Chaque décision doit avoir un nom.
              </Text>
            )}
          </>
        )}
      </Stack>
    </section>
  );
}

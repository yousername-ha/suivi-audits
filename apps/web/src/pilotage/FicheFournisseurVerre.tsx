/* Fiche du fournisseur en style « Verre » (dessin FicheFournisseur validé par le RSSI le 27/11/2026). En-tête : initiales,
   nom, puces (criticité, hébergeur HDS déclaré, certificat à traiter) ; onglets « Fiche », « Contrats et certificats »,
   « Évaluations » et « Machines et responsabilités » (groupes de machines en cartes, matrice RACI « Qui décide quoi »).
   Les champs, l'enregistrement et les droits sont ceux de la fiche existante (Fournisseurs.tsx), passés tels quels ;
   cette vue ne fait que les répartir. Pied : dernière modification de la matrice RACI (seule donnée signée disponible),
   « Fermer » et « Enregistrer la fiche » sur les onglets qui portent des champs de la fiche. */
import { Button, Group, Stack, Tabs, Text, VisuallyHidden } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import type { MatriceRaciReponse } from '@suivi/shared';
import { get } from '../api';
import { useCan } from '../session';
import { GroupesDuFournisseurSection } from './GroupesDuFournisseur';
import { cleMatriceRaci, MatriceRaciFournisseur, urlMatriceRaci } from './MatriceRaci';
import type { Fournisseur } from './fournisseurs-types';
import { initiales, ligneModificationRaci, pucesFiche, teinteInitiales } from './fournisseurs-verre';

export type OngletFiche = 'fiche' | 'contrats' | 'evaluations' | 'responsabilites';
const ONGLETS: [OngletFiche, string][] = [
  ['fiche', 'Fiche'],
  ['contrats', 'Contrats et certificats'],
  ['evaluations', 'Évaluations'],
  ['responsabilites', 'Machines et responsabilités'],
];
const estOnglet = (v: string | null): v is OngletFiche => ONGLETS.some(([o]) => o === v);

/** Titre de la fenêtre : pastille aux initiales (décorative) et nom ; « Fiche de » reste lu par les lecteurs d'écran. */
export function TitreFicheVerre({ nom, id }: { nom: string; id: string }) {
  return (
    <span className="fsv-fiche-titre">
      <span className="fsv-initiales fsv-initiales--grand" data-teinte={teinteInitiales(id)} aria-hidden="true">
        {initiales(nom)}
      </span>
      <span>
        <VisuallyHidden component="span">Fiche de </VisuallyHidden>
        {nom}
      </span>
    </span>
  );
}

/** Auteur de la dernière modification de la matrice RACI (même requête et même cache que la matrice). */
function ModificationRaci({ fournisseurId }: { fournisseurId: string }) {
  const q = useQuery({
    queryKey: cleMatriceRaci(fournisseurId),
    queryFn: () => get<MatriceRaciReponse>(urlMatriceRaci(fournisseurId)),
  });
  const ligne = ligneModificationRaci(q.data?.matrice);
  return ligne ? <Text className="fsv-fiche-modif">{ligne}</Text> : <span />;
}

export function FicheFournisseurVerre({
  fournisseur,
  modifiable,
  ongletInitial,
  erreur,
  identite,
  certificats,
  controles,
  criteres,
  historique,
  enregistrer,
  onEvaluer,
  onDone,
}: {
  fournisseur: Fournisseur;
  modifiable: boolean;
  ongletInitial: OngletFiche;
  erreur: ReactNode;
  identite: ReactNode;
  certificats: ReactNode;
  controles: ReactNode;
  criteres: ReactNode;
  historique: ReactNode;
  /** Bouton « Enregistrer la fiche » (absent sans le droit de modifier). */
  enregistrer: ReactNode;
  onEvaluer: () => void;
  onDone: () => void;
}) {
  const [onglet, setOnglet] = useState<OngletFiche>(ongletInitial);
  const peutEvaluer = useCan()('fournisseurs', 'modifier');
  const puces = pucesFiche(fournisseur);
  const champsFiche = onglet === 'fiche' || onglet === 'contrats';
  return (
    <Stack className="fsv-fiche" gap="md">
      {puces.length > 0 && (
        <p className="fsv-fiche__puces">
          {puces.map((x) => (
            <span key={x.libelle} className="fsv-puce" data-tone={x.ton}>
              {x.libelle}
            </span>
          ))}
        </p>
      )}
      {erreur}
      <Tabs value={onglet} onChange={(v) => estOnglet(v) && setOnglet(v)} keepMounted>
        <Tabs.List aria-label="Rubriques de la fiche">
          {ONGLETS.map(([valeur, libelle]) => (
            <Tabs.Tab key={valeur} value={valeur}>
              {libelle}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {/* Contenu des onglets dans un simple bloc : une rangée de boutons en fin d'onglet (« Ajouter un contrôle »)
            n'est pas prise pour le pied de la fenêtre. */}
        <Tabs.Panel value="fiche" pt="md">
          <div className="fsv-onglet">{identite}</div>
        </Tabs.Panel>
        <Tabs.Panel value="contrats" pt="md">
          <div className="fsv-onglet">
            {certificats}
            {controles}
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="evaluations" pt="md">
          <div className="fsv-onglet">
            {criteres}
            {peutEvaluer && (
              <Group>
                <Button variant="default" onClick={onEvaluer}>
                  Nouvelle évaluation
                </Button>
              </Group>
            )}
            <Text fw={600}>Historique des évaluations</Text>
            {historique}
          </div>
        </Tabs.Panel>
        {/* Dessin validé par le RSSI le 27/11/2026 : groupes de machines maintenus en cartes, puis « Qui décide quoi ». */}
        <Tabs.Panel value="responsabilites" pt="md">
          <div className="fsv-onglet">
            <GroupesDuFournisseurSection fournisseurId={fournisseur.id} cartes />
            <section className="fsv-raci" aria-label="Qui décide quoi">
              <MatriceRaciFournisseur fournisseurId={fournisseur.id} nomFournisseur={fournisseur.name} />
            </section>
          </div>
        </Tabs.Panel>
      </Tabs>
      <Group justify="space-between" className="fenetre-actions fsv-fiche__pied">
        {onglet === 'responsabilites' ? <ModificationRaci fournisseurId={fournisseur.id} /> : <span />}
        <Group>
          <Button variant="default" onClick={onDone}>
            Fermer
          </Button>
          {modifiable && champsFiche && enregistrer}
        </Group>
      </Group>
    </Stack>
  );
}

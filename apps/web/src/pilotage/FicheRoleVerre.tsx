/* Fenêtre d'un rôle en style « Verre » (dessin FicheRole validé par le RSSI le 28/11/2026). En-tête : pastille violette,
   nom du rôle, puces « Titulaire désigné » et « Suppléant désigné » (seulement si renseignés) et les onglets habituels
   (Informations, Liens et justificatifs, Historique). Informations : à gauche le bloc « Le rôle » (champs du registre en
   creux, sur deux colonnes), à droite « Matrice RACI » : les lettres de ce rôle dans la matrice « Qui décide quoi » du
   périmètre (ADR 0115), en lecture, et le lien vers la matrice complète de la page. Pied : registre, périmètre et dernière
   modification quand la fiche les porte, puis « Archiver la fiche », « Fermer » et « Enregistrer ».
   Les champs, l'enregistrement (If-Match), l'archivage et les droits sont ceux de RecordEditor, passés tels quels : cette
   vue ne fait que les répartir. La matrice se lit avec la même requête et le même cache que la page (QuiDecideQuoi). */
import { Anchor, Button, Group, Modal, Stack, Tabs, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { GrcObject, MatriceDecisionsReponse } from '@suivi/shared';
import { ErrorAlert } from '@suivi/ui';
import { get } from '../api';
import { cleQuiDecideQuoi, urlQuiDecideQuoi } from './QuiDecideQuoi';
import { ANCRE_QUI_DECIDE_QUOI, ligneRegistreRole, matriceDuRole, pucesRole, refRoleRaci } from './role-verre';

type Onglet = 'details' | 'links' | 'history';
const estOnglet = (v: string | null): v is Onglet => v === 'details' || v === 'links' || v === 'history';

function Pastille() {
  return (
    <span className="rolev-pastille" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0116 0" />
      </svg>
    </span>
  );
}

/** Bloc « Matrice RACI » : les lettres du rôle, une décision par ligne, puis le lien vers la matrice complète. */
export function MatriceRaciDuRole({
  smsi,
  object,
  onVoirMatrice,
}: {
  smsi: string;
  object: GrcObject | null;
  onVoirMatrice: () => void;
}) {
  const titre = useId();
  const ref = refRoleRaci(object);
  const lue = useQuery({
    queryKey: cleQuiDecideQuoi(smsi),
    queryFn: () => get<MatriceDecisionsReponse>(urlQuiDecideQuoi(smsi)),
    enabled: !!ref,
  });
  const vue = matriceDuRole(lue.data, ref);
  return (
    <section className="rolev-bloc rolev-raci" aria-labelledby={titre}>
      <h3 id={titre} className="rolev-bloc__titre">
        Matrice RACI
      </h3>
      <ErrorAlert error={lue.error} />
      {vue.etat === 'sans-fiche' ? (
        <p className="rolev-vide">
          Le rôle prendra sa colonne dans la matrice « Qui décide quoi » une fois enregistré.
        </p>
      ) : lue.isPending ? (
        <p className="rolev-vide">Chargement de la matrice…</p>
      ) : lue.error ? null : vue.etat === 'sans-decision' ? (
        <p className="rolev-vide">Aucune décision n’est encore saisie dans la matrice « Qui décide quoi ».</p>
      ) : vue.etat === 'sans-lettre' ? (
        <p className="rolev-vide">
          Ce rôle ne porte aucune lettre dans {vue.decisions === 1 ? 'la décision' : `les ${vue.decisions} décisions`}{' '}
          de la matrice « Qui décide quoi ».
        </p>
      ) : (
        <ul className="rolev-lettres" aria-labelledby={titre}>
          {vue.lettres.map((l) => (
            <li key={l.decision}>
              <span className="rolev-lettres__decision">{l.libelle}</span>
              <span className="rolev-lettre" data-lettre={l.lettre}>
                {l.texte}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Anchor component="button" type="button" className="rolev-lien" onClick={onVoirMatrice}>
        Voir la matrice complète
      </Anchor>
    </section>
  );
}

export function FicheRoleVerre({
  smsi,
  object,
  opened,
  onClose,
  titre,
  avertissements,
  intitule,
  champs,
  complements,
  liens,
  historique,
  archiver,
  confirmationArchivage,
  enregistrer,
}: {
  smsi: string;
  object: GrcObject | null;
  opened: boolean;
  onClose: () => void;
  /** Nom du rôle, ou « Ajouter — Responsabilité » pour une nouvelle fiche. */
  titre: string;
  /** Erreur, alerte de nouvelle vérification et mention de lecture seule de la fiche existante. */
  avertissements: ReactNode;
  /** Champ « Intitulé » de la fiche existante. */
  intitule: ReactNode;
  /** Champs du registre (Fields, dans l'ordre du dessin). */
  champs: ReactNode;
  /** Description, registre et responsable de la fiche existante. */
  complements: ReactNode;
  liens: ReactNode;
  historique: ReactNode;
  /** « Archiver la fiche » (absent sans le droit « supprimer » ou pendant la confirmation). */
  archiver: ReactNode;
  confirmationArchivage: ReactNode;
  /** « Enregistrer » (absent en lecture seule). */
  enregistrer: ReactNode;
}) {
  const navigate = useNavigate();
  const [onglet, setOnglet] = useState<Onglet>('details');
  // Chaque ouverture repart de l'onglet Informations, comme la fenêtre habituelle (dont le contenu est démonté à la
  // fermeture) ; réglé pendant le rendu.
  const [ouverte, setOuverte] = useState(opened);
  if (opened !== ouverte) {
    setOuverte(opened);
    if (opened) setOnglet('details');
  }
  const titreRole = useId();
  // « Voir la matrice complète » : la fenêtre se ferme, puis la page descend à la matrice une fois la transition finie
  // (après le retour du focus sur la ligne d'origine, que Mantine rend dès la fermeture).
  const versMatrice = useRef(false);
  const perimetres = useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () => get<{ id: string; name: string }[]>('/api/grc/smsis'),
    enabled: opened,
  });
  const perimetre = perimetres.data?.find((s) => s.id === (object?.smsiId ?? smsi))?.name ?? null;
  const puces = pucesRole(object?.data);
  const allerALaMatrice = () => {
    const cible = document.getElementById(ANCRE_QUI_DECIDE_QUOI);
    if (!cible) {
      void navigate('/pilotage/responsabilites');
      return;
    }
    cible.scrollIntoView({ block: 'start' });
    cible.focus({ preventScroll: true });
  };
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      onExitTransitionEnd={() => {
        if (!versMatrice.current) return;
        versMatrice.current = false;
        allerALaMatrice();
      }}
      size="xl"
      closeButtonProps={{ 'aria-label': 'Fermer la fiche' }}
      classNames={{ content: 'rolev-fenetre fiche-defilement' }}
      title={
        <span className="rolev-titre">
          <Pastille />
          <span>{titre}</span>
        </span>
      }
    >
      <Tabs value={onglet} onChange={(v) => estOnglet(v) && setOnglet(v)} keepMounted className="rolev-onglets">
        <div className="rolev-tete">
          {puces.length > 0 ? (
            <p className="rolev-puces">
              {puces.map((p) => (
                <span key={p} className="rolev-puce">
                  {p}
                </span>
              ))}
            </p>
          ) : (
            <span />
          )}
          <Tabs.List aria-label="Rubriques de la fiche">
            <Tabs.Tab value="details">Informations</Tabs.Tab>
            <Tabs.Tab value="links">Liens et justificatifs</Tabs.Tab>
            {object && <Tabs.Tab value="history">Historique</Tabs.Tab>}
          </Tabs.List>
        </div>
        <Stack gap="sm" className="rolev-avertissements">
          {avertissements}
        </Stack>
        <Tabs.Panel value="details" pt="md">
          <div className="rolev-corps">
            <section className="rolev-bloc rolev-role" aria-labelledby={titreRole}>
              <h3 id={titreRole} className="rolev-bloc__titre">
                Le rôle
              </h3>
              <div className="rolev-champs">
                {intitule}
                {champs}
                {complements}
              </div>
            </section>
            <MatriceRaciDuRole
              smsi={smsi}
              object={object}
              onVoirMatrice={() => {
                versMatrice.current = true;
                onClose();
              }}
            />
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="links" pt="md">
          <div className="rolev-bloc">{liens}</div>
        </Tabs.Panel>
        {object && (
          <Tabs.Panel value="history" pt="md">
            <div className="rolev-bloc">{historique}</div>
          </Tabs.Panel>
        )}
      </Tabs>
      {confirmationArchivage}
      <Group justify="space-between" className="fenetre-actions rolev-pied">
        <Text className="rolev-pied__texte">{ligneRegistreRole(perimetre, object)}</Text>
        <Group>
          {archiver}
          <Button variant="default" onClick={onClose}>
            Fermer
          </Button>
          {enregistrer}
        </Group>
      </Group>
    </Modal>
  );
}

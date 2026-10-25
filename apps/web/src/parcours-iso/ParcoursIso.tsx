/* Parcours guidé ISO/IEC 27001 / HDS (dossier 024, référence v011) : une porte d'entrée visuelle (arbre ou liste) vers les
   modules de la plateforme. Ce n'est pas un registre : chaque étape renvoie aux fiches que les modules tiennent déjà, avec le
   même identifiant, les mêmes droits et les mêmes versions. Rien n'est écrit ici, sauf des préférences d'affichage (vue,
   compléments HDS, animations). Une étape parcourue, un document présent ou une action close n'établit ni revue, ni
   conformité, ni certification. */
import { Alert, Anchor, Button, Group, Modal, SegmentedControl, Select, Stack, Switch, Text } from '@mantine/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ETAPES_PARCOURS,
  RACCOURCIS_PARCOURS,
  SOURCES_PARCOURS,
  etapeParcours,
  etapesAffichees,
  type EtapeParcours,
  type RaccourciParcours,
} from '@suivi/shared';
import { useCan, usePreferences } from '../session';
import { Arbre } from './Arbre';
import { CarteCompacte } from './CarteCompacte';
import { FicheEtape } from './FicheEtape';
import { ListeEtapes } from './ListeEtapes';
import { MOUVEMENTS, useOngletVisible, type Mouvement } from './mouvement';
import { useTravauxExistants } from './travaux';

interface Detail {
  etape: string;
  sousAction?: string;
}

export function ParcoursIso({ smsi }: { smsi: string }) {
  const can = useCan();
  const { prefs, save } = usePreferences();
  const pc = prefs.parcoursIso ?? {};
  const vue = pc.vue ?? 'arbre';
  const hds = pc.hds ?? true;
  const mouvement: Mouvement = pc.mouvement ?? 'automatique';
  const maj = (patch: Partial<typeof pc>) => void save({ parcoursIso: { ...pc, ...patch } }).catch(() => {});
  const visible = useOngletVisible();

  const [selection, setSelection] = useState<string | null>(null);
  const [carteVisible, setCarteVisible] = useState(false);
  const [depliee, setDepliee] = useState<string | null>(null);
  const [halo, setHalo] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [sources, setSources] = useState(false);
  const minuterie = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(minuterie.current), []);

  const kinds = useMemo(() => etapesAffichees(hds).flatMap((e) => e.sousActions.flatMap((s) => s.kinds)), [hds]);
  const travaux = useTravauxExistants(smsi, kinds);

  // Échap ferme la carte compacte (la fenêtre détaillée gère sa propre fermeture).
  useEffect(() => {
    if (!carteVisible || detail) return;
    // Le même appui sur Échap ferme la fenêtre détaillée : l'écouteur n'est installé qu'au rendu suivant, on ignore donc les appuis antérieurs à l'installation.
    const installe = performance.now();
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && e.timeStamp > installe) setCarteVisible(false);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [carteVisible, detail]);
  // Masquer HDS ne supprime rien : seule la sélection d'une étape HDS devient sans objet.
  useEffect(() => {
    if (hds) return;
    const r = RACCOURCIS_PARCOURS.find((x) => x.id === selection);
    if (r && etapeParcours(r.etape)?.branche === 'hds') {
      setSelection(null);
      setCarteVisible(false);
    }
    const d = RACCOURCIS_PARCOURS.find((x) => x.id === depliee);
    if (d && etapeParcours(d.etape)?.branche === 'hds') setDepliee(null);
  }, [hds, selection, depliee]);

  const brille = (id: string) => {
    if (mouvement === 'arretees') return;
    setHalo(id);
    clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => setHalo(null), 1000);
  };
  const selectionner = (id: string) => {
    setSelection(id);
    setCarteVisible(true);
    brille(id);
  };
  const bascule = (id: string) => {
    setSelection(id);
    setCarteVisible(true);
    setDepliee((d) => (d === id ? null : id));
    brille(id);
  };
  const raccourci = RACCOURCIS_PARCOURS.find((r) => r.id === selection);
  const etapeDetail = detail ? etapeParcours(detail.etape) : undefined;
  // La fiche est démontée à sa fermeture : le focus est rendu ici, à l'élément qui l'avait ouverte.
  const origine = useRef<HTMLElement | null>(null);
  const ouvrirEtape = (etape: EtapeParcours | string, sousAction?: string) => {
    if (!detail) {
      const actif = document.activeElement;
      // Un clic à la souris ne place pas toujours le focus sur le groupe SVG : on retrouve alors la sous-action par son identifiant.
      origine.current =
        actif instanceof HTMLElement && actif !== document.body
          ? actif
          : sousAction
            ? document.querySelector<HTMLElement>(`[data-sous-action="${CSS.escape(sousAction)}"]`)
            : null;
    }
    setDetail({ etape: typeof etape === 'string' ? etape : etape.id, sousAction });
  };
  const fermerDetail = () => {
    setDetail(null);
    const cible = origine.current;
    origine.current = null;
    if (cible) requestAnimationFrame(() => cible.isConnected && cible.focus());
  };

  if (!can('pilotage', 'lire'))
    return <Text>Vous ne disposez pas du droit de consulter le pilotage, donc ce parcours.</Text>;
  return (
    <Stack>
      <Alert variant="light" color="gray" title="Une aide pour s’orienter, pas un verdict">
        Ce parcours regroupe les travaux d’un SMSI ISO/IEC 27001:2022 et, si votre périmètre est concerné, les
        compléments HDS. Il renvoie vers vos modules et ne crée aucune donnée : l’ordre est une proposition, tout reste
        consultable. Une étape parcourue, une preuve attachée ou une action close n’établit ni revue, ni conformité, ni
        certification.
      </Alert>
      <Group align="flex-end" gap="md">
        <SegmentedControl
          aria-label="Vue du parcours"
          value={vue}
          onChange={(v) => maj({ vue: v as 'arbre' | 'liste' })}
          data={[
            { value: 'arbre', label: 'Arbre' },
            { value: 'liste', label: 'Liste' },
          ]}
        />
        <Switch
          label="Afficher les compléments HDS"
          description="Affichage seulement : aucune décision d’applicabilité n’est modifiée."
          checked={hds}
          onChange={(e) => maj({ hds: e.currentTarget.checked })}
        />
        <Select
          label="Animations"
          description="Décoratives : elles ne signalent aucun état métier."
          allowDeselect={false}
          data={MOUVEMENTS}
          value={mouvement}
          onChange={(v) => v && maj({ mouvement: v as Mouvement })}
        />
        <Button variant="subtle" onClick={() => setSources(true)}>
          Sources et limites
        </Button>
      </Group>
      {vue === 'arbre' ? (
        <Arbre
          hds={hds}
          mouvement={mouvement}
          visible={visible}
          selection={selection}
          carteVisible={carteVisible}
          depliee={depliee}
          halo={halo}
          travaux={travaux}
          onSelectionner={selectionner}
          onFermerCarte={() => setCarteVisible(false)}
          onBascule={bascule}
          onOuvrirSousAction={(r: RaccourciParcours, sousAction) => {
            setSelection(r.id);
            ouvrirEtape(r.etape, sousAction);
          }}
          onOuvrirEtape={(id) => ouvrirEtape(id)}
          onToutes={() => maj({ vue: 'liste' })}
          carte={
            carteVisible && raccourci ? (
              <CarteCompacte
                smsi={smsi}
                raccourci={raccourci}
                travaux={travaux}
                onFermer={() => setCarteVisible(false)}
                onSousAction={(id) => ouvrirEtape(raccourci.etape, id)}
                onEtape={() => ouvrirEtape(raccourci.etape)}
              />
            ) : null
          }
        />
      ) : (
        <ListeEtapes smsi={smsi} hds={hds} travaux={travaux} onOuvrirEtape={(e, s) => ouvrirEtape(e, s)} />
      )}
      {etapeDetail && (
        <FicheEtape
          key={`${etapeDetail.id}:${detail!.sousAction ?? ''}`}
          smsi={smsi}
          etape={etapeDetail}
          sousActionOuverte={detail!.sousAction}
          travaux={travaux}
          onClose={fermerDetail}
          onOuvrirEtape={(id) => ouvrirEtape(id)}
        />
      )}
      <Modal
        opened={sources}
        onClose={() => setSources(false)}
        title="Sources et limites"
        size="lg"
        closeButtonProps={{ 'aria-label': 'Fermer les sources' }}
      >
        <Stack gap="sm">
          <Text size="sm">
            Les repères viennent des publications officielles ci-dessous ; le texte intégral des normes n’est ni
            reproduit ni distribué. Les regroupements, l’ordre et les exemples de livrables sont des aides de travail à
            valider, pas une méthode normative ni un programme de qualification.
          </Text>
          {SOURCES_PARCOURS.map((s) => (
            <div key={s.id}>
              <Anchor href={s.url} target="_blank" rel="noopener noreferrer" size="sm">
                {s.libelle} (nouvel onglet)
              </Anchor>
              <Text size="xs" c="dimmed">
                {s.limite}
              </Text>
            </div>
          ))}
          <Text size="xs" c="dimmed">
            {ETAPES_PARCOURS.length} étapes et {ETAPES_PARCOURS.reduce((n, e) => n + e.sousActions.length, 0)}{' '}
            sous-actions ; la couverture exigence par exigence est celle des référentiels de la plateforme (rubrique
            Conformité), pas celle de ce parcours.
          </Text>
        </Stack>
      </Modal>
    </Stack>
  );
}

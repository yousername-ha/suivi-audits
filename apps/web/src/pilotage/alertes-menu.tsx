/* Pastilles du menu du Pilotage : une pastille par groupe, collée au libellé, rouge quand un indicateur est mauvais
   (indicateur non atteint, échéance dépassée), neutre pour un simple volume à traiter. Les nombres viennent de la
   synthèse déjà servie au tableau de bord (aucun calcul supplémentaire, aucune valeur estimée). */
import { Badge, Group } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api';
import type { SyntheseApi } from '../components/Synthese';
import { canReadBusiness, useCan } from '../session';
import { useRapprochementsEnAttente } from './compteur-rapprochements';

export interface Alerte {
  n: number;
  /** Rouge : au moins un élément est en défaut (et non seulement à traiter). */
  rouge: boolean;
  /** Phrase lue par les lecteurs d'écran. */
  detail: string;
}
export type AlertesMenu = Record<string, Alerte | undefined>;

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Calcul pur (testé) : alertes par libellé de groupe du menu et total pour la racine « Pilotage ». */
export function alertesDepuisSynthese(s: SyntheseApi | undefined, rapprochements: number): AlertesMenu {
  const alertes: AlertesMenu = {};
  if (rapprochements > 0)
    alertes['Conformité'] = {
      n: rapprochements,
      rouge: false,
      detail: pluriel(rapprochements, 'rapprochement à valider', 'rapprochements à valider'),
    };
  const mauvais = s?.indicateurs?.nonAtteints ?? 0;
  if (mauvais > 0)
    alertes['Objectifs et indicateurs'] = {
      n: mauvais,
      rouge: true,
      detail: pluriel(mauvais, 'indicateur non atteint', 'indicateurs non atteints'),
    };
  const retard = (s?.ecarts?.enRetard ?? 0) + (s?.pilotage?.actionsEnRetard ?? 0);
  if (retard > 0)
    alertes['Écarts et actions'] = {
      n: retard,
      rouge: true,
      detail: pluriel(retard, 'échéance dépassée', 'échéances dépassées'),
    };
  const sansDecision = s?.pilotage?.risquesSansDecision ?? 0;
  if (sansDecision > 0)
    alertes['Risques'] = {
      n: sansDecision,
      rouge: false,
      detail: pluriel(sansDecision, 'risque sans décision', 'risques sans décision'),
    };
  const liste = Object.values(alertes).filter((a): a is Alerte => !!a);
  if (liste.length)
    alertes['Pilotage'] = {
      n: liste.reduce((t, a) => t + a.n, 0),
      rouge: liste.some((a) => a.rouge),
      detail: liste.map((a) => a.detail).join(', '),
    };
  return alertes;
}

/** Alertes du menu (vides sans droit de lecture du Pilotage). La synthèse est partagée avec le tableau de bord. */
export function useAlertesMenu(): AlertesMenu {
  const can = useCan();
  const q = useQuery({
    queryKey: ['synthese'],
    queryFn: () => get<SyntheseApi>('/api/mur/synthese'),
    enabled: canReadBusiness(can),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  });
  const rapprochements = useRapprochementsEnAttente();
  return alertesDepuisSynthese(q.data, rapprochements);
}

/** Libellé de menu suivi de sa pastille ; sans alerte, le libellé seul. */
export function LibelleAlerte({ libelle, alerte }: { libelle: string; alerte?: Alerte }) {
  if (!alerte) return <span className="nav-libelle">{libelle}</span>;
  return (
    <Group component="span" gap="xs" wrap="nowrap" className="nav-libelle-alerte">
      <span className="nav-libelle">{libelle}</span>
      <Badge
        size="sm"
        variant={alerte.rouge ? 'filled' : 'white'}
        color={alerte.rouge ? 'red' : 'suivi'}
        className="nav-pastille"
        data-alerte={alerte.rouge ? 'rouge' : 'neutre'}
        aria-label={alerte.detail}
      >
        {alerte.n}
      </Badge>
    </Group>
  );
}

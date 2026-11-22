/* Fiche illustrée d'une faille (lot PC4) : fiche fictive pour les tests de l'interface. Données entièrement fictives. */
import type { FicheFailleDto, RecommandationsFicheDto } from '@suivi/shared';

export const RECOMMANDATIONS_VIDES: RecommandationsFicheDto = {
  tenable: null,
  tenableRegroupes: [],
  kev: [],
  kevTronque: false,
  versionsNvd: [],
  versionsNvdTronquees: false,
  certSante: null,
  avis: [],
  avisTronques: false,
  alh: [],
  alhTronquees: false,
};

export const ficheFaille = (
  x: Partial<Omit<FicheFailleDto, 'recommandations'>> & { recommandations?: Partial<RecommandationsFicheDto> } = {},
): FicheFailleDto => ({
  nature: 'constat',
  cves: ['CVE-2026-90001'],
  nombreCves: 1,
  delai: null,
  exception: null,
  correctif: { etat: 'non_renseigne', sources: [] },
  situationExploitation: 'correctif_non_renseigne',
  finSupport: null,
  composant: 'Produit fictif 8.3',
  priorite: {
    niveau: 'P1',
    faits: [
      { fait: 'exploitation', sources: ['kev'] },
      { fait: 'presence', presence: 'detectee' },
    ],
  },
  marques: { zeroDay: true, exploitable: false },
  alerte: null,
  presence: { machines: 3, actifs: 1, horsLecture: false },
  vecteurs: [
    { source: 'nvd', cve: 'CVE-2026-90001', brut: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', score: 9.8 },
  ],
  ...x,
  recommandations: { ...RECOMMANDATIONS_VIDES, ...x.recommandations },
});

/* Module Vulnérabilités (ADR 0100, lot V6) : alertes, côté interface. Adresses de l'API, libellés et mise à l'écart « pour
   cette session » de la fenêtre d'alerte critique (mémoire de l'onglet, effacée à la fermeture de la session). Fonctions
   pures ou presque, testables hors navigateur. */
import {
  type AlerteVulnerabiliteDto,
  ETAT_ALERTE_LIBELLES,
  type EtatAlerte,
  type FiltreEtatAlerte,
  libelleFaitPriorite,
  MOTIF_CLOTURE_ALERTE_LIBELLES,
  type NiveauAlerte,
  PRESENCE_LIBELLES,
  resumeExploitationAlerte,
  resumeNombreLisible,
} from '@suivi/shared';
import type { Etat } from '@suivi/ui';
import { fmtDate } from '../components/common';

export const CLE_ALERTES = ['vulnerabilites', 'alertes'] as const;
export const CLE_FENETRE = ['vulnerabilites', 'alertes', 'fenetre'] as const;

export function urlAlertes(f: { etat: FiltreEtatAlerte; niveau: NiveauAlerte | '' }, page = 1): string {
  const p = new URLSearchParams();
  if (f.etat !== 'actives') p.set('etat', f.etat);
  if (f.niveau) p.set('niveau', f.niveau);
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return `/api/vulnerabilites/alertes${s ? `?${s}` : ''}`;
}
export const urlFenetre = () => '/api/vulnerabilites/alertes/fenetre';
export const urlAlerte = (id: string) => `/api/vulnerabilites/alertes/${encodeURIComponent(id)}`;
export const urlPriseEnCompte = (id: string) => `${urlAlerte(id)}/prise-en-compte`;
/** Fiche d'une alerte dans l'onglet « Alertes » du module. */
export const lienFicheAlerte = (id: string) => `/vulnerabilites/alertes?alerte=${encodeURIComponent(id)}`;

export const ETAT_ALERTE_PUCE: Record<EtatAlerte, Etat> = {
  ouverte: 'erreur',
  prise_en_compte: 'attention',
  close: 'neutre',
};
export const NIVEAU_ALERTE_PUCE: Record<NiveauAlerte, Etat> = { critique: 'erreur', simple: 'attention' };
export const libelleEtatAlerte = (e: EtatAlerte) => ETAT_ALERTE_LIBELLES[e];

/** « CVE-2026-90001 », ou « Constat de Tenable sans CVE ». */
export const libelleFaille = (a: Pick<AlerteVulnerabiliteDto, 'cve'>) => a.cve ?? 'Constat de Tenable sans CVE';
export const libellePresences = (a: Pick<AlerteVulnerabiliteDto, 'presences'>) =>
  a.presences.map((p) => PRESENCE_LIBELLES[p]).join(' · ');
export const libelleExploitation = (a: Pick<AlerteVulnerabiliteDto, 'exploitation'>) =>
  resumeExploitationAlerte(a.exploitation);
export const faitsAlerte = (a: Pick<AlerteVulnerabiliteDto, 'priorite'>) => a.priorite.faits.map(libelleFaitPriorite);

/** Présence chez nous, en nombres que la personne lit (jamais de nom). */
export function resumePresence(a: Pick<AlerteVulnerabiliteDto, 'machines' | 'actifs' | 'produits' | 'etat'>): string[] {
  if (a.etat === 'close') return ['Alerte close : plus rien n’est compté.'];
  const out: string[] = [];
  if (a.machines.lisibles || a.machines.horsLecture) out.push(`Machines touchées : ${resumeNombreLisible(a.machines)}`);
  if (a.actifs.lisibles || a.actifs.horsLecture)
    out.push(`Actifs exposés sur Internet : ${resumeNombreLisible(a.actifs, 'm')}`);
  if (a.produits) out.push(`Produits surveillés rattachés : ${a.produits}`);
  return out.length ? out : ['Aucune machine ni aucun actif que vous puissiez lire.'];
}

/** Suivi de l'alerte en une ligne : ouverte le…, prise en compte par… le…, close le… (motif). */
export function resumeSuiviAlerte(
  a: Pick<AlerteVulnerabiliteDto, 'etat' | 'ouverteLe' | 'priseEnCompte' | 'cloture'>,
): string[] {
  const out = [`Ouverte le ${fmtDate(a.ouverteLe)}`];
  if (a.priseEnCompte) out.push(`Prise en compte par ${a.priseEnCompte.par} le ${fmtDate(a.priseEnCompte.le)}`);
  if (a.cloture) out.push(`Close le ${fmtDate(a.cloture.le)} : ${MOTIF_CLOTURE_ALERTE_LIBELLES[a.cloture.motif]}`);
  return out;
}

/** Heure (« 06:31 ») et jour (« 15/11/2026 ») du passage au niveau critique. */
export function heureAlerte(a: Pick<AlerteVulnerabiliteDto, 'critiqueLe' | 'ouverteLe'>) {
  const d = new Date(a.critiqueLe ?? a.ouverteLe);
  return {
    heure: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    jour: d.toLocaleDateString('fr-FR'),
  };
}

export { ecarter, ecartees, marqueAlerte, oublierEcartees, PREFIXE_ECARTEES } from './alertes-session';

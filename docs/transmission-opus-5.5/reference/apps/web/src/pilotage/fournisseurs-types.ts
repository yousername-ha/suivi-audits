/* Types de présentation existants, sans dépendance aux composants ou aux requêtes. */
import type { EtatSuivi, ResumeControles } from '@suivi/shared';

export interface EvaluationCourante {
  id: string;
  evaluatedAt: string;
  evaluator: string;
  nextReviewAt: string | null;
  items: number;
  meets: number;
  notMeets: number;
  notAssessed: number;
}
export interface CertificatFournisseur {
  type: string;
  validUntil?: string;
  received?: string;
  scope?: string;
  location?: string;
}
export interface ControleFournisseur {
  id?: string;
  t: string;
  ref?: string;
  freq?: number;
  last?: string;
  result?: string;
  comment?: string;
}
export interface Fournisseur {
  id: string;
  name: string;
  saas: boolean;
  rattachement: string;
  contact: string;
  notes: string;
  sso: string;
  mfa: string;
  critical: string;
  hds: string;
  certs: CertificatFournisseur[];
  controls: ControleFournisseur[];
  certificateState: EtatSuivi;
  controlSummary: ResumeControles;
  current: EvaluationCourante | null;
  toReview: boolean;
  scopes: string[];
}

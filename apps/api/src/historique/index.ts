/* Modules de l'outil de suivi historique repris dans la nouvelle interface, sans copie (voir registre.ts). */
import type { Grc } from '../grc/core.js';
import { AuditSuivi } from './audit.js';
import { Plans } from './plans.js';
import { RegistreHistorique } from './registre.js';

export class Historique {
  readonly registre: RegistreHistorique;
  readonly plans: Plans;
  readonly audit: AuditSuivi;
  constructor(g: Grc) {
    this.registre = new RegistreHistorique(g);
    this.plans = new Plans(this.registre);
    this.audit = new AuditSuivi(this.registre);
  }
}

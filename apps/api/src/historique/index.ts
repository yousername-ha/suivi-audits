/* Modules de l'outil de suivi historique repris dans la nouvelle interface, sans copie (voir registre.ts). */
import type { Grc } from '../grc/core.js';
import { AuditSuivi } from './audit.js';
import { Gap } from './gap.js';
import { ConformiteIa } from './ia.js';
import { Plans } from './plans.js';
import { RevuesAcces } from './revues-acces.js';
import { RegistreHistorique } from './registre.js';

export class Historique {
  readonly registre: RegistreHistorique;
  readonly plans: Plans;
  readonly audit: AuditSuivi;
  readonly revuesAcces: RevuesAcces;
  readonly gap: Gap;
  readonly ia: ConformiteIa;
  constructor(g: Grc) {
    this.registre = new RegistreHistorique(g);
    this.plans = new Plans(this.registre);
    this.audit = new AuditSuivi(this.registre);
    this.revuesAcces = new RevuesAcces(this.registre);
    this.gap = new Gap(this.registre);
    this.ia = new ConformiteIa(this.registre);
  }
}

/* Modules de l'outil de suivi historique repris dans la nouvelle interface, sans copie (voir registre.ts). */
import type { Grc } from '../grc/core.js';
import { AuditSuivi } from './audit.js';
import { GestionCrrc } from './crrc.js';
import { Crise } from './crise.js';
import { DeclarationApplicabilite } from './dda.js';
import { EvaluationsClausier } from './evals-fournisseurs.js';
import { Gap } from './gap.js';
import { Incidents } from './incidents.js';
import { Retex } from './retex.js';
import { Investissements } from './invest.js';
import { Plans } from './plans.js';
import { RevuesAcces } from './revues-acces.js';
import { RegistreHistorique } from './registre.js';

export class Historique {
  readonly registre: RegistreHistorique;
  readonly plans: Plans;
  readonly audit: AuditSuivi;
  readonly revuesAcces: RevuesAcces;
  readonly gap: Gap;
  readonly invest: Investissements;
  readonly crrc: GestionCrrc;
  readonly incidents: Incidents;
  readonly retex: Retex;
  readonly crise: Crise;
  readonly evaluations: EvaluationsClausier;
  readonly dda: DeclarationApplicabilite;
  constructor(g: Grc) {
    this.registre = new RegistreHistorique(g);
    this.plans = new Plans(this.registre);
    this.audit = new AuditSuivi(this.registre);
    this.revuesAcces = new RevuesAcces(this.registre);
    this.gap = new Gap(this.registre);
    this.invest = new Investissements(this.registre);
    this.crrc = new GestionCrrc(this.registre);
    this.incidents = new Incidents(this.registre);
    this.retex = new Retex(this.registre);
    this.crise = new Crise(this.registre);
    this.evaluations = new EvaluationsClausier(this.registre);
    this.dda = new DeclarationApplicabilite(this.registre);
  }
}

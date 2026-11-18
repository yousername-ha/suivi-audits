/* Modules de l'outil de suivi historique repris dans la nouvelle interface, sans copie (voir registre.ts). */
import type { Grc } from '../grc/core.js';
import type { Settings } from '../settings.js';
import { AuditSuivi } from './audit.js';
import { Crise } from './crise.js';
import { DeclarationsIncidents } from './declarations.js';
import { DeclarationApplicabilite } from './dda.js';
import { EvaluationsClausier } from './evals-fournisseurs.js';
import { Incidents } from './incidents.js';
import { Retex } from './retex.js';
import { Plans } from './plans.js';
import { RegistreHistorique } from './registre.js';

export class Historique {
  readonly registre: RegistreHistorique;
  readonly plans: Plans;
  readonly audit: AuditSuivi;
  readonly incidents: Incidents;
  /** Déclarations réglementaires des incidents (ADR 0105). */
  readonly declarations: DeclarationsIncidents;
  readonly retex: Retex;
  readonly crise: Crise;
  readonly evaluations: EvaluationsClausier;
  readonly dda: DeclarationApplicabilite;
  constructor(g: Grc, settings: Pick<Settings, 'get'>) {
    this.registre = new RegistreHistorique(g);
    this.plans = new Plans(this.registre);
    this.audit = new AuditSuivi(this.registre);
    this.declarations = new DeclarationsIncidents(this.registre, settings);
    this.incidents = new Incidents(this.registre, this.declarations);
    this.retex = new Retex(this.registre);
    this.crise = new Crise(this.registre);
    this.evaluations = new EvaluationsClausier(this.registre);
    this.dda = new DeclarationApplicabilite(this.registre);
  }
}

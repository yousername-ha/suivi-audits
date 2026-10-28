/* Démonstration ISO 27001 / HDS / EBIOS RM : référentiels standards rattachés au pilotage, déclaration d'applicabilité,
   couverture par exigence et étude EBIOS RM complète (cinq ateliers) d'un établissement de santé entièrement fictif.
   Tout passe par l'API publique (mêmes validations que l'interface), au nom de l'administrateur créé à l'installation.
   Aucun texte normatif n'est reproduit : les intitulés viennent des référentiels déjà livrés avec l'application, et les
   niveaux, dates et scénarios ci-dessous sont des exemples de démonstration, à remplacer par les vôtres. */
import crypto from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';

type Json = Record<string, unknown>;
type Reponse = LightMyRequestResponse;
export interface ContexteDemo {
  appel: (
    method: 'GET' | 'POST' | 'PUT' | 'PATCH',
    url: string,
    json?: unknown,
    headers?: Record<string, string>,
  ) => Promise<Reponse>;
  exiger: <T>(res: Reponse, quoi: string) => Promise<T>;
  commun: string;
  decaler: (jours: number) => string;
  /** Méthode de risque publiée (EBIOS RM), utilisée par les risques de l'atelier 5. */
  methodeId: string;
}

export interface BilanNormes {
  referentiels: string[];
  exigencesEvaluees: number;
  ddaRenseignees: number;
  etudeEbios: string | null;
  elementsEbios: number;
  risquesEbios: number;
  traitements: number;
}

const DATE_COURTE = (d: string) => d.slice(0, 10);

/** Mesures de l'Annexe A jugées sans objet pour l'établissement fictif (justification donnée à la DdA). */
const SANS_OBJET: Record<string, string> = {
  'A-8.28': 'Aucun développement logiciel interne dans le périmètre de démonstration.',
  'A-8.30': 'Aucun développement externalisé dans le périmètre de démonstration.',
};

/** Niveau de mise en œuvre de démonstration, réparti de façon déterministe (environ 60 % total, 30 % partiel, 10 % insuffisant). */
const niveauDemo = (i: number): 'Total' | 'Partiel' | 'Insuffisant' =>
  i % 10 === 9 ? 'Insuffisant' : i % 3 === 1 ? 'Partiel' : 'Total';

interface ExigenceBib {
  id: string;
  title?: string;
}

/** Rend disponibles les référentiels ISO/IEC 27001:2022 et HDS, et les rattache au pilotage commun. */
export async function rattacherStandards(ctx: ContexteDemo) {
  const { appel, exiger, commun } = ctx;
  const rattacher = async (identifier: string) => {
    const f = await exiger<{ id: string; version: number; identifier: string }>(
      await appel('POST', '/api/library/standards/adopt', { identifier }),
      `Adoption du référentiel ${identifier}`,
    );
    await exiger(
      await appel('PUT', `/api/grc/${commun}/framework-attachments/${f.id}`, {
        version: f.version,
        confirm: 'RATTACHER',
      }),
      `Rattachement du référentiel ${identifier}`,
    );
    return f;
  };
  return { iso: await rattacher('iso-27001-2022'), hds: await rattacher('hds') };
}

/** Évalue chaque exigence des deux référentiels (applicabilité, mise en œuvre, test, validation) et renseigne la DdA. */
export async function couvertureEtDda(
  ctx: ContexteDemo,
  ref: { iso: { id: string; version: number }; hds: { id: string; version: number } },
): Promise<{ exigencesEvaluees: number; ddaRenseignees: number }> {
  const { appel, exiger, commun, decaler } = ctx;
  let exigencesEvaluees = 0;
  const evaluer = async (
    frameworkId: string,
    version: number,
    motif: string,
    choisir: (id: string, i: number) => Json,
  ) => {
    const v = await exiger<{ definition?: { requirements: ExigenceBib[] }; requirements?: ExigenceBib[] }>(
      await appel('GET', `/api/library/frameworks/${frameworkId}/versions/${version}`),
      'Exigences du référentiel',
    );
    let i = 0;
    for (const e of v.definition?.requirements ?? v.requirements ?? []) {
      const corps = {
        justification: '',
        implementationNote: '',
        testNote: '',
        testRef: '',
        validationNote: '',
        testedAt: null,
        testResult: null,
        validatedAt: null,
        ...choisir(e.id, i++),
        reason: motif,
        confirm: 'EVALUER',
      };
      await exiger(
        await appel(
          'POST',
          `/api/grc/${commun}/exigences/${frameworkId}/${encodeURIComponent(e.id)}/evaluations`,
          corps,
          { 'if-match': '"0"' },
        ),
        `Évaluation de l’exigence ${e.id}`,
      );
      exigencesEvaluees++;
    }
  };
  // ISO/IEC 27001:2022 : clauses 4 à 10 (jamais exclues) et mesures de l'Annexe A.
  await evaluer(ref.iso.id, ref.iso.version, 'Évaluation de démonstration (données fictives).', (id, i) => {
    if (SANS_OBJET[id])
      return {
        applicability: 'exclue',
        justification: SANS_OBJET[id],
        implementation: 'aucune',
      };
    if (i % 4 === 3)
      return {
        applicability: 'applicable',
        implementation: 'partielle',
        implementationNote: 'Mise en œuvre en cours (démonstration).',
      };
    if (i % 2 === 0)
      return {
        applicability: 'applicable',
        implementation: 'complete',
        implementationNote: 'Mesure en place (démonstration).',
        testedAt: decaler(-70 + (i % 20)),
        testResult: 'conforme',
        testNote: 'Contrôle interne fictif.',
        testRef: 'Rapport de contrôle interne (fictif)',
        ...(i % 4 === 0
          ? { validatedAt: decaler(-40 + (i % 20)), validationNote: 'Validé par le responsable (fictif).' }
          : {}),
      };
    return {
      applicability: 'applicable',
      implementation: 'complete',
      implementationNote: 'Mesure en place (démonstration).',
    };
  });
  // HDS v2 : exigences du référentiel de certification, évaluation partielle.
  await evaluer(ref.hds.id, ref.hds.version, 'Évaluation de démonstration (données fictives).', (_id, i) => {
    if (i % 7 === 0) return { applicability: 'applicable', implementation: 'aucune' };
    if (i % 3 === 0)
      return {
        applicability: 'applicable',
        implementation: 'partielle',
        implementationNote: 'Plan de mise en conformité en cours (démonstration).',
      };
    return {
      applicability: 'applicable',
      implementation: 'complete',
      implementationNote: 'Exigence couverte (démonstration).',
      testedAt: decaler(-50 + (i % 15)),
      testResult: 'conforme',
      testNote: 'Contrôle interne fictif.',
    };
  });
  // Déclaration d'applicabilité historique : mesures de l'Annexe A et clauses ISO.
  const etat = await exiger<{ items: { id: string; ref: string }[] }>(
    await appel('GET', '/api/suivi/etat'),
    'Lecture de l’état',
  );
  let ddaRenseignees = 0;
  let a = 0;
  for (const it of etat.items.filter((x) => x.ref === 'A')) {
    const i = a++;
    const corps = SANS_OBJET[it.id]
      ? { app: 'non', just: SANS_OBJET[it.id], level: '' }
      : {
          app: 'oui',
          level: niveauDemo(i),
          just: 'Mesure retenue au regard de l’appréciation des risques (démonstration).',
          docs: i % 2 === 0 ? 'Procédure associée (fictive)' : '',
          actions: niveauDemo(i) === 'Total' ? '' : 'Action d’amélioration planifiée (fictive).',
        };
    await exiger(await appel('PATCH', `/api/dda/${it.id}`, corps), `DdA ${it.id}`);
    ddaRenseignees++;
  }
  let c = 0;
  for (const it of etat.items.filter((x) => x.ref === 'ISO')) {
    const i = c++;
    await exiger(
      await appel('PATCH', `/api/dda/${it.id}`, {
        level: i % 5 === 4 ? 'Partiel' : 'Total',
        docs: 'Document du système de management (fictif)',
      }),
      `DdA ${it.id}`,
    );
    ddaRenseignees++;
  }
  return { exigencesEvaluees, ddaRenseignees };
}

/** Étude EBIOS RM d'un dossier patient informatisé : valeurs métier à traitements, ateliers 1 à 5 validés. */
export async function etudeEbios(
  ctx: ContexteDemo,
): Promise<Pick<BilanNormes, 'etudeEbios' | 'elementsEbios' | 'risquesEbios' | 'traitements'>> {
  const { appel, exiger, commun, decaler, methodeId } = ctx;
  let elementsEbios = 0;
  const creer = async (kind: string, name: string, data: Json, quoi = name) => {
    const r = await exiger<{ id: string; version: number }>(
      await appel('POST', `/api/grc/${commun}/objects`, { kind, name, data }),
      `EBIOS « ${quoi} »`,
    );
    elementsEbios++;
    return r.id;
  };
  const etude = await exiger<{ id: string }>(
    await appel('POST', `/api/grc/${commun}/objects`, {
      kind: 'risk_study',
      name: 'Étude EBIOS RM — dossier patient informatisé',
      data: {
        objective:
          'Identifier et traiter les risques qui pèsent sur le dossier patient informatisé et sur son hébergement, pour préparer la certification.',
        scope:
          'Dossier patient informatisé, hébergement des données de santé, accès des professionnels et échanges avec les établissements partenaires.',
        participants:
          'RSSI, DSI, délégué à la protection des données, direction des soins, direction (fonctions fictives).',
        startAt: decaler(-75),
        endAt: decaler(-5),
        baseline: [
          {
            referential: 'ISO/IEC 27001:2022 — Annexe A',
            status: 'partial',
            gap: 'Authentification multifacteur et revue des accès à généraliser (démonstration).',
            requirementRefs: [],
          },
          {
            referential: 'Référentiel HDS v2',
            status: 'partial',
            gap: 'Plan de continuité hébergeur à tester (démonstration).',
            requirementRefs: [],
          },
        ],
      },
    }),
    'Étude EBIOS RM',
  );
  elementsEbios++;
  const S = `object:${etude.id}`;
  const ref = (id: string) => `object:${id}`;

  // Atelier 1 — cadrage et socle de sécurité : valeurs métier, biens supports, événements redoutés.
  const vm = {
    soins: await creer('business_asset', 'Prise en charge des patients', {
      studyRef: S,
      nature: 'process',
      mission: 'Assurer la continuité et la qualité des soins.',
      processRefs: ['legacy:processes:PR2'],
    }),
    dossier: await creer('business_asset', 'Dossier patient', {
      studyRef: S,
      nature: 'information',
      mission: 'Conserver et partager les informations de santé des patients.',
    }),
    admin: await creer('business_asset', 'Facturation et gestion administrative', {
      studyRef: S,
      nature: 'process',
      mission: 'Facturer les actes et gérer les admissions.',
      processRefs: ['legacy:processes:PR1'],
    }),
  };
  const bs = {
    serveurs: await creer('support_asset', 'Serveurs applicatifs du dossier patient', {
      studyRef: S,
      assetType: 'Système',
      location: 'Hébergeur de données fictif',
      businessAssetRefs: [ref(vm.soins), ref(vm.dossier)],
    }),
    base: await creer('support_asset', 'Base de données patients', {
      studyRef: S,
      assetType: 'Données',
      location: 'Hébergeur de données fictif',
      businessAssetRefs: [ref(vm.dossier)],
    }),
    postes: await creer('support_asset', 'Postes de travail des soignants', {
      studyRef: S,
      assetType: 'Matériel',
      businessAssetRefs: [ref(vm.soins)],
    }),
    reseau: await creer('support_asset', 'Réseau local et accès Wi-Fi', {
      studyRef: S,
      assetType: 'Réseau',
      businessAssetRefs: [ref(vm.soins), ref(vm.admin)],
    }),
    personnel: await creer('support_asset', 'Administrateurs et personnel soignant', {
      studyRef: S,
      assetType: 'Personnel',
      businessAssetRefs: [ref(vm.soins), ref(vm.dossier)],
    }),
  };
  const er = {
    indispo: await creer('feared_event', 'Indisponibilité prolongée du dossier patient', {
      studyRef: S,
      businessAssetRef: ref(vm.soins),
      consequences: 'Soins retardés ou dégradés, retour au papier, risque pour la sécurité des patients.',
      impacts: ['D'],
      gravity: 4,
    }),
    fuite: await creer('feared_event', 'Divulgation de dossiers patients', {
      studyRef: S,
      businessAssetRef: ref(vm.dossier),
      consequences: 'Atteinte à la vie privée des patients, sanctions, perte de confiance.',
      impacts: ['C'],
      gravity: 4,
    }),
    alteration: await creer('feared_event', 'Altération de données de prescription', {
      studyRef: S,
      businessAssetRef: ref(vm.dossier),
      consequences: 'Erreur de traitement possible.',
      impacts: ['I'],
      gravity: 4,
    }),
    perte: await creer('feared_event', 'Perte définitive de dossiers', {
      studyRef: S,
      businessAssetRef: ref(vm.dossier),
      consequences: 'Perte d’historique médical, obligations de conservation non tenues.',
      impacts: ['D', 'I'],
      gravity: 3,
    }),
    factu: await creer('feared_event', 'Indisponibilité de la facturation', {
      studyRef: S,
      businessAssetRef: ref(vm.admin),
      consequences: 'Retard de facturation et de trésorerie.',
      impacts: ['D'],
      gravity: 2,
    }),
  };

  // Atelier 2 — sources de risque et objectifs visés.
  const rs = {
    crime: await creer('risk_source', 'Cybercriminel', {
      studyRef: S,
      category: 'criminel organisé',
      motive: 'Lucratif',
      resources: 'Outils d’attaque du marché, hameçonnage, rançongiciels.',
      targetObjective: '',
    }),
    initie: await creer('risk_source', 'Utilisateur interne malveillant ou négligent', {
      studyRef: S,
      category: 'interne',
      motive: 'Curiosité, vengeance ou négligence',
      resources: 'Accès légitimes au système.',
    }),
    activiste: await creer('risk_source', 'Activiste', {
      studyRef: S,
      category: 'pirate idéologique',
      motive: 'Notoriété, revendication',
      resources: 'Outils publics, déni de service.',
    }),
    sinistre: await creer('risk_source', 'Sinistre accidentel ou naturel', {
      studyRef: S,
      category: 'accident',
      motive: 'Aucune (événement non intentionnel)',
      resources: '',
    }),
  };
  const couple = async (
    nom: string,
    source: string,
    objective: string,
    motivation: number,
    resources: number,
    activity: number,
    retained: boolean,
    justification: string,
  ) =>
    creer('sr_ov', nom, {
      studyRef: S,
      sourceRef: ref(source),
      objective,
      motivation,
      resources,
      activity,
      retained,
      justification,
    });
  const cv = {
    rancon: await couple(
      'Cybercriminel / obtenir une rançon',
      rs.crime,
      'Chiffrer les systèmes du dossier patient pour obtenir une rançon.',
      4,
      3,
      3,
      true,
      'Menace active contre le secteur de la santé (hypothèse de démonstration).',
    ),
    vol: await couple(
      'Cybercriminel / revendre des données de santé',
      rs.crime,
      'Dérober des dossiers patients pour les revendre.',
      4,
      3,
      3,
      true,
      'Valeur élevée des données de santé (hypothèse de démonstration).',
    ),
    initie: await couple(
      'Utilisateur interne / consulter ou divulguer des dossiers',
      rs.initie,
      'Consulter sans besoin d’en connaître ou divulguer des dossiers.',
      2,
      4,
      2,
      true,
      'Accès légitimes étendus, traçabilité à renforcer (démonstration).',
    ),
    activiste: await couple(
      'Activiste / perturber les services',
      rs.activiste,
      'Rendre le service indisponible pour faire parler de soi.',
      2,
      2,
      2,
      false,
      'Attractivité jugée faible pour cet établissement (hypothèse de démonstration).',
    ),
    sinistre: await couple(
      'Sinistre / rendre l’hébergement indisponible',
      rs.sinistre,
      'Interruption de l’hébergement (incendie, inondation, panne majeure).',
      1,
      4,
      2,
      true,
      'Scénario de continuité à couvrir (démonstration).',
    ),
  };

  // Atelier 3 — écosystème et scénarios stratégiques.
  const pp = {
    hebergeur: await creer('ecosystem_party', 'Hébergeur de données fictif', {
      studyRef: S,
      supplierRef: 'legacy:suppliers:SUP-001',
      category: 'Fournisseur',
      dependency: 4,
      penetration: 3,
      maturity: 3,
      trust: 3,
      measures: 'Certification HDS, contrat avec clauses de sécurité.',
    }),
    editeur: await creer('ecosystem_party', 'Logiciel de dossiers fictif', {
      studyRef: S,
      supplierRef: 'legacy:suppliers:SUP-003',
      category: 'Fournisseur',
      dependency: 4,
      penetration: 4,
      maturity: 2,
      trust: 2,
      measures: 'Authentification multifacteur à activer, certificat à renouveler.',
    }),
    maintenance: await creer('ecosystem_party', 'Prestataire de maintenance fictif', {
      studyRef: S,
      supplierRef: 'legacy:suppliers:SUP-004',
      category: 'Prestataire',
      dependency: 3,
      penetration: 4,
      maturity: 2,
      trust: 2,
      measures: 'Accès distants encadrés par contrat.',
    }),
    partenaires: await creer('ecosystem_party', 'Établissements partenaires', {
      studyRef: S,
      category: 'Partenaire',
      dependency: 2,
      penetration: 2,
      maturity: 2,
      trust: 3,
      measures: 'Clauses de confidentialité à compléter.',
    }),
  };
  const ss = {
    rancon: await creer('strategic_scenario', 'Rançongiciel par le prestataire de maintenance', {
      studyRef: S,
      srOvRef: ref(cv.rancon),
      fearedEventRefs: [ref(er.indispo), ref(er.perte)],
      partyRefs: [ref(pp.maintenance)],
      attackPath: 'Compromission des accès distants du prestataire, puis déploiement d’un rançongiciel.',
      ecosystem: 'Prestataire de maintenance',
      gravity: 4,
    }),
    vol: await creer('strategic_scenario', 'Exfiltration de dossiers par le logiciel de dossiers', {
      studyRef: S,
      srOvRef: ref(cv.vol),
      fearedEventRefs: [ref(er.fuite), ref(er.alteration)],
      partyRefs: [ref(pp.editeur)],
      attackPath: 'Exploitation d’une faille de l’interface web de l’éditeur pour extraire des dossiers.',
      ecosystem: 'Éditeur du logiciel de dossiers',
      gravity: 4,
    }),
    initie: await creer('strategic_scenario', 'Consultation abusive par un utilisateur interne', {
      studyRef: S,
      srOvRef: ref(cv.initie),
      fearedEventRefs: [ref(er.fuite)],
      partyRefs: [],
      attackPath: 'Utilisation d’un compte à privilèges sans contrôle des consultations.',
      ecosystem: '',
      gravity: 3,
    }),
    sinistre: await creer('strategic_scenario', 'Interruption prolongée de l’hébergement', {
      studyRef: S,
      srOvRef: ref(cv.sinistre),
      fearedEventRefs: [ref(er.indispo), ref(er.factu)],
      partyRefs: [ref(pp.hebergeur)],
      attackPath: 'Sinistre sur le site de l’hébergeur sans bascule testée.',
      ecosystem: 'Hébergeur',
      gravity: 3,
    }),
  };

  // Atelier 4 — scénarios opérationnels.
  const so = {
    rancon: await creer('operational_scenario', 'Hameçonnage d’un administrateur puis chiffrement des serveurs', {
      studyRef: S,
      strategicScenarioRef: ref(ss.rancon),
      supportAssetRefs: [ref(bs.serveurs), ref(bs.reseau), ref(bs.personnel)],
      attackSequence:
        '1. Hameçonnage d’un compte du prestataire. 2. Rebond par l’accès distant. 3. Élévation de privilèges. 4. Chiffrement des serveurs et des sauvegardes accessibles.',
      likelihood: 3,
    }),
    vol: await creer('operational_scenario', 'Exploitation d’une vulnérabilité de l’interface web', {
      studyRef: S,
      strategicScenarioRef: ref(ss.vol),
      supportAssetRefs: [ref(bs.serveurs), ref(bs.base)],
      attackSequence:
        '1. Repérage de l’interface exposée. 2. Exploitation d’une faille non corrigée. 3. Extraction de la base de données patients.',
      likelihood: 3,
    }),
    initie: await creer('operational_scenario', 'Usage abusif d’un compte à privilèges', {
      studyRef: S,
      strategicScenarioRef: ref(ss.initie),
      supportAssetRefs: [ref(bs.postes), ref(bs.base), ref(bs.personnel)],
      attackSequence: '1. Connexion légitime. 2. Consultation de dossiers hors besoin. 3. Copie ou divulgation.',
      likelihood: 2,
    }),
    sinistre: await creer('operational_scenario', 'Perte du site de l’hébergeur sans bascule', {
      studyRef: S,
      strategicScenarioRef: ref(ss.sinistre),
      supportAssetRefs: [ref(bs.serveurs), ref(bs.base)],
      attackSequence:
        '1. Sinistre sur le site principal. 2. Absence de bascule testée. 3. Reprise tardive depuis les sauvegardes.',
      likelihood: 1,
    }),
  };

  // Atelier 5 — risques et traitement.
  const note = { dimensions: { severity: '' }, likelihood: '', level: null, inputs: {} };
  const cotation = (gravite: number, vraisemblance: number) => ({
    ...note,
    dimensions: { severity: `impact_${gravite}` },
    likelihood: `likelihood_${vraisemblance}`,
  });
  const risques: Record<string, string> = {};
  let risquesEbios = 0;
  const risque = async (
    cle: string,
    nom: string,
    scenario: string,
    domaine: string,
    strategie: 'reduce' | 'accept',
    brut: [number, number],
    residuel: [number, number],
    motifAcceptation = '',
  ) => {
    const c = await exiger<{ id: string; version: number }>(
      await appel('POST', `/api/grc/${commun}/objects`, {
        kind: 'risk',
        name: nom,
        data: {
          description: `Risque issu de l’étude EBIOS RM (scénario opérationnel : ${nom}).`,
          code: cle,
          ownerId: null,
          methodId: methodeId,
          methodVersion: 1,
          domain: domaine,
          entity: 'Établissement de santé fictif',
          scope: 'Dossier patient informatisé',
          strategy: strategie,
          acceptanceReason: motifAcceptation,
          reviewAt: decaler(180),
          stages: {},
          studyRef: S,
          scenarioRef: ref(scenario),
        },
      }),
      `Risque ${cle}`,
    );
    elementsEbios++;
    risquesEbios++;
    risques[cle] = c.id;
    const intention = {
      ratings: { gross: cotation(...brut), residual: cotation(...residuel) },
      rationale: 'Appréciation de démonstration issue de l’étude EBIOS RM (valeurs fictives).',
      decision: 'draft',
    };
    const p = await exiger<{ previewId: string }>(
      await appel('POST', `/api/grc/${commun}/risks/${c.id}/preview`, intention),
      `Simulation du risque ${cle}`,
    );
    await exiger(
      await appel(
        'POST',
        `/api/grc/${commun}/risks/${c.id}/evaluate`,
        { ...intention, previewId: p.previewId, requestId: crypto.randomUUID(), confirm: 'ENREGISTRER' },
        { 'if-match': `"${c.version}"` },
      ),
      `Appréciation du risque ${cle}`,
    );
    return c.id;
  };
  await risque('EB-01', 'Rançongiciel par le prestataire de maintenance', so.rancon, 'SSI', 'reduce', [4, 3], [3, 2]);
  await risque('EB-02', 'Exfiltration de dossiers par l’interface web', so.vol, 'SSI', 'reduce', [4, 3], [3, 2]);
  await risque(
    'EB-03',
    'Consultation abusive de dossiers par un utilisateur interne',
    so.initie,
    'SSI',
    'reduce',
    [3, 2],
    [2, 2],
  );
  await risque(
    'EB-04',
    'Perte du site de l’hébergeur sans bascule',
    so.sinistre,
    'Continuité',
    'accept',
    [3, 1],
    [3, 1],
    'Risque jugé acceptable au regard du contrat de l’hébergeur et de la vraisemblance estimée (démonstration).',
  );

  let traitements = 0;
  const traitement = async (
    nom: string,
    riskCles: string[],
    mesures: string[],
    effet: string,
    strategie = 'reduce',
  ) => {
    const id = await creer('treatment', nom, {
      studyRef: S,
      strategy: strategie,
      expectedEffect: effet,
      verification: 'Contrôle interne annuel (démonstration).',
      reviewAt: decaler(200),
      riskRefs: riskCles.map((k) => ref(risques[k]!)),
      measureRefs: mesures,
    });
    traitements++;
    return id;
  };
  const t1 = await traitement(
    'Généraliser l’authentification multifacteur',
    ['EB-01', 'EB-02', 'EB-03'],
    ['legacy:items:A-8.5', 'legacy:items:A-5.15'],
    'Réduire la vraisemblance des compromissions de comptes.',
  );
  const t2 = await traitement(
    'Renforcer la gestion des vulnérabilités',
    ['EB-02'],
    ['legacy:items:A-8.8'],
    'Corriger les failles de l’interface web avant exploitation.',
  );
  const t3 = await traitement(
    'Encadrer les accès distants des prestataires',
    ['EB-01'],
    ['legacy:items:A-5.19', 'legacy:items:A-5.22'],
    'Limiter la propagation depuis un prestataire.',
  );
  const t4 = await traitement(
    'Journaliser et contrôler les consultations de dossiers',
    ['EB-03'],
    ['legacy:items:A-8.15'],
    'Détecter et dissuader les consultations abusives.',
  );
  const t5 = await traitement(
    'Tester la restauration et la bascule',
    ['EB-01', 'EB-04'],
    ['legacy:items:A-8.13', 'legacy:items:A-5.30'],
    'S’assurer de pouvoir reprendre l’activité après un sinistre ou un chiffrement.',
  );
  for (const [id, nom, delai] of [
    [t1, 'Activer la MFA des accès administrateurs et à distance', 45],
    [t2, 'Mettre en place un cycle de correction des vulnérabilités', 60],
    [t3, 'Revoir les accès distants des prestataires', 30],
    [t4, 'Activer la journalisation des consultations de dossiers', 90],
    [t5, 'Réaliser un test de restauration complet', 75],
  ] as const) {
    await exiger(
      await appel('POST', `/api/grc/${commun}/treatments/${id}/action`, {
        name: nom,
        dueAt: `${ctx.decaler(delai)}T09:00:00Z`,
        ownerId: null,
      }),
      `Action du traitement « ${nom} »`,
    );
  }

  // Validation des cinq ateliers, dans l'ordre, sur la version courante de l'étude (rien ne doit la modifier ensuite).
  const lue = await appel('GET', `/api/grc/${commun}/objects/${etude.id}`);
  const versionEtude = String(lue.headers['etag'] ?? '').replace(/"/g, '');
  const atelier = [
    ['a1', -60, [vm.soins, bs.serveurs, er.indispo]],
    ['a2', -50, [rs.crime, cv.rancon]],
    ['a3', -40, [pp.hebergeur, ss.rancon]],
    ['a4', -30, [so.rancon]],
    ['a5', -20, [risques['EB-01']!, t1]],
  ] as const;
  for (const [step, jours, elements] of atelier) {
    await exiger(
      await appel(
        'POST',
        `/api/grc/${commun}/pilotage/decisions`,
        {
          ref: S,
          decision: {
            operation: 'step_validation',
            step,
            result: 'completed',
            requestId: crypto.randomUUID(),
            note: `Atelier ${step.slice(1)} validé (démonstration).`,
            date: DATE_COURTE(ctx.decaler(jours)),
            refs: elements.map(ref),
            confirm: 'ENREGISTRER',
          },
        },
        { 'if-match': `"${versionEtude}"` },
      ),
      `Validation de l’atelier ${step}`,
    );
  }
  // Acceptation formelle du risque accepté (décision de la direction fictive).
  const rEB4 = await appel('GET', `/api/grc/${commun}/objects/${risques['EB-04']}`);
  await exiger(
    await appel(
      'POST',
      `/api/grc/${commun}/pilotage/decisions`,
      {
        ref: ref(risques['EB-04']!),
        decision: {
          operation: 'risk_acceptance',
          result: 'accepted',
          requestId: crypto.randomUUID(),
          note: 'Acceptation par la direction fictive, à revoir au prochain cycle.',
          date: DATE_COURTE(ctx.decaler(-10)),
          until: DATE_COURTE(ctx.decaler(355)),
          refs: [],
          confirm: 'ENREGISTRER',
        },
      },
      { 'if-match': `"${String(rEB4.headers['etag'] ?? '').replace(/"/g, '')}"` },
    ),
    'Acceptation du risque EB-04',
  );
  return { etudeEbios: etude.id, elementsEbios, risquesEbios, traitements };
}

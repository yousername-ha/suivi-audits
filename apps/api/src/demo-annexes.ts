/* Démonstration, modules annexes : incidents, revues des accès (puis cellule de crise et GAP).
   Même principe que `demo-normes.ts` : tout passe par l'API publique, au nom de l'administrateur créé à l'installation, avec les
   mêmes validations que l'interface. Établissement, fournisseurs et circonstances sont entièrement fictifs et reprennent ceux
   du jeu de démonstration (fournisseurs SUP-001 à SUP-005) ; dates et montants sont des exemples à remplacer par les vôtres. */
import type { ContexteDemo } from './demo-normes.js';

type Json = Record<string, unknown>;
type Annexes = Pick<ContexteDemo, 'appel' | 'exiger' | 'decaler'>;

export interface BilanAnnexes {
  incidents: number;
  revuesAcces: number;
  crise: { contacts: number; scenarios: number; cellules: number };
  gap: { applications: number; usagesIa: number };
}

const heure = (jours: number, h: string) => `${new Date(Date.now() + jours * 86400e3).toISOString().slice(0, 10)}T${h}`;
const mois = (delta: number) => {
  const d = new Date();
  const t = d.getUTCFullYear() * 12 + d.getUTCMonth() + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

/** Incidents : cinq signalements de qualifications, de catégories et d'états différents, dont un incident de sécurité ouvert
    avec obligations (données personnelles et de santé) et un retour d'expérience. */
async function incidents({ appel, exiger }: Annexes): Promise<number> {
  const fiches: { creation: Json; suite: Json; obligations?: number[] }[] = [
    {
      creation: {
        title: 'Courriel d’hameçonnage reçu par plusieurs agents de l’accueil',
        reporter: 'Responsable accueil',
        answers: { demande: 'non', service: 'non', cia: 'non', politique: 'oui', dcp: 'non', sante: 'non' },
      },
      suite: {
        detectedAt: heure(-41, '09:10'),
        cat: 'Hameçonnage',
        impact: 'Faible',
        urgency: 'Moyen',
        status: 'Clos',
        owner: 'RSI',
        desc: 'Un faux message de livraison, adressé à une dizaine d’agents, invitait à saisir des identifiants sur une page imitant la messagerie.',
        actions:
          'Message bloqué par la passerelle, domaine ajouté à la liste de blocage, rappel des consignes aux agents.',
        cause: 'Campagne ciblant les établissements de santé ; aucun agent n’a saisi d’identifiants.',
        resolvedAt: heure(-40, '16:30'),
        retex:
          'La passerelle de messagerie a filtré le message dès le deuxième envoi ; ajouter ce scénario à la sensibilisation annuelle.',
      },
    },
    {
      creation: {
        title: 'Connexion inhabituelle d’un compte du prestataire de maintenance',
        reporter: 'RSI',
        answers: { demande: 'non', service: 'non', cia: 'oui', politique: 'oui', dcp: 'oui', sante: 'oui' },
      },
      suite: {
        detectedAt: heure(-6, '03:42'),
        cat: 'Compte compromis ou accès non autorisé',
        impact: 'Élevé',
        urgency: 'Élevé',
        status: 'En cours',
        owner: 'RSI',
        desc: 'Le compte nominatif d’un technicien du prestataire de maintenance fictif s’est connecté de nuit depuis une adresse inhabituelle à une machine du réseau administratif.',
        actions:
          'Compte suspendu, mots de passe réinitialisés, journaux conservés, analyse de l’étendue des accès en cours avec le prestataire.',
        cause: 'À déterminer : vol d’identifiants chez le prestataire envisagé.',
      },
      obligations: [0],
    },
    {
      creation: {
        title: 'Indisponibilité du logiciel de dossiers patients pendant trois heures',
        reporter: 'Responsable qualité',
        answers: { demande: 'non', service: 'oui', cia: 'non', politique: 'non', dcp: 'non', sante: 'non' },
      },
      suite: {
        detectedAt: heure(-24, '08:05'),
        cat: 'Indisponibilité de service',
        impact: 'Moyen',
        urgency: 'Élevé',
        status: 'Résolu',
        owner: 'RSI',
        desc: 'Le logiciel de dossiers fictif est resté inaccessible de 8 h à 11 h ; l’accueil a travaillé en mode dégradé sur papier.',
        actions:
          'Redémarrage du service applicatif par l’éditeur, mise en place d’une surveillance de la disponibilité.',
        cause: 'Saturation du disque du serveur d’application après une mise à jour.',
        resolvedAt: heure(-24, '11:05'),
        retex:
          'Le mode dégradé a tenu mais la procédure n’était pas affichée aux postes : l’afficher et la tester une fois par an.',
      },
    },
    {
      creation: {
        title: 'Perte d’un ordinateur portable chiffré en déplacement',
        reporter: 'Direction',
        answers: { demande: 'non', service: 'non', cia: 'oui', politique: 'oui', dcp: 'non', sante: 'non' },
      },
      suite: {
        detectedAt: heure(-75, '18:20'),
        cat: 'Perte ou vol de matériel',
        impact: 'Faible',
        urgency: 'Faible',
        status: 'Clos',
        owner: 'RSI',
        desc: 'Un ordinateur portable professionnel a été égaré dans un train.',
        actions: 'Appareil verrouillé et effacé à distance, certificats révoqués, déclaration de perte.',
        cause: 'Matériel laissé sans surveillance.',
        resolvedAt: heure(-74, '10:00'),
        retex: 'Disque chiffré : aucune donnée exposée. Rappel de la règle sur le matériel en déplacement.',
      },
    },
    {
      creation: {
        title: 'Demande d’accès au dossier partagé de la qualité pour un nouvel arrivant',
        reporter: 'Responsable qualité',
        answers: { demande: 'oui', service: 'non', cia: 'non', politique: 'non', dcp: 'non', sante: 'non' },
      },
      suite: { detectedAt: heure(-2, '14:00'), status: 'Nouveau', owner: 'RSI' },
    },
  ];
  let n = 0;
  for (const f of fiches) {
    const cree = await exiger<{ id: string }>(
      await appel('POST', '/api/incidents', f.creation),
      'Création de l’incident',
    );
    await exiger(await appel('PATCH', `/api/incidents/${cree.id}`, f.suite), `Incident ${cree.id}`);
    for (const k of f.obligations ?? [])
      await exiger(
        await appel('PUT', `/api/incidents/${cree.id}/obligations/${k}`, { traitee: true }),
        `Obligation de l’incident ${cree.id}`,
      );
    n++;
  }
  return n;
}

/** Revues des accès : cinq applications, une par état (à jour, à planifier, en retard, jamais réalisée). */
async function revuesAcces({ appel, exiger }: Annexes): Promise<number> {
  const revues: Json[] = [
    {
      app: 'Logiciel de dossiers patients',
      supplier: 'Logiciel de dossiers fictif',
      month: mois(-3),
      freq: 12,
      source: 'Export des comptes du logiciel',
      comment: 'Revue annuelle avec le responsable qualité.',
    },
    {
      app: 'Messagerie collaborative',
      supplier: 'Messagerie collaborative fictive',
      month: mois(-10),
      freq: 12,
      source: 'Console d’administration',
      comment: 'À planifier avant la fin de l’année.',
    },
    {
      app: 'Console de l’hébergeur de données',
      supplier: 'Hébergeur de données fictif',
      month: mois(-16),
      freq: 12,
      source: 'Console d’administration',
      comment: 'En retard : relancer l’hébergeur pour obtenir l’export.',
    },
    {
      app: 'Outil de visioconférence',
      supplier: 'Outil de visioconférence fictif',
      month: '',
      freq: 12,
      source: '',
      comment: 'Première revue à réaliser.',
    },
    {
      app: 'Annuaire interne',
      supplier: '',
      month: mois(-8),
      freq: 6,
      source: 'Export de l’annuaire',
      comment: 'Revue semestrielle des comptes à privilèges.',
    },
  ];
  for (const r of revues) {
    const cree = await exiger<{ id: string }>(
      await appel('POST', '/api/revues-acces'),
      'Création d’une revue des accès',
    );
    await exiger(await appel('PATCH', `/api/revues-acces/${cree.id}`, r), `Revue ${cree.id}`);
  }
  return revues.length;
}

/** Cellule de crise : contacts clés (numéros et adresses réservés à la fiction), deux scénarios avec leur check-list et un
    exercice clôturé dont la main courante, les échéances réglementaires et la check-list sont renseignées. */
async function crise({ appel, exiger }: Annexes): Promise<BilanAnnexes['crise']> {
  const contacts: Json[] = [
    {
      name: 'Direction de l’établissement',
      org: 'Établissement de santé fictif',
      role: 'Directeur de crise',
      phone: '01 99 00 00 01',
      phone2: '06 39 98 00 01',
      email: 'direction@exemple.invalid',
      avail: '24 h sur 24',
      notes: 'Décide de l’activation et de la clôture de la cellule.',
      key: true,
    },
    {
      name: 'RSI',
      org: 'Établissement de santé fictif',
      role: 'Responsable des systèmes d’information',
      phone: '01 99 00 00 02',
      phone2: '06 39 98 00 02',
      email: 'rsi@exemple.invalid',
      avail: 'Astreinte 24 h sur 24',
      notes: 'Pilote l’investigation technique et le plan de reprise.',
      key: true,
    },
    {
      name: 'RSSI',
      org: 'Établissement de santé fictif',
      role: 'Responsable de la sécurité des systèmes d’information',
      phone: '01 99 00 00 03',
      phone2: '',
      email: 'rssi@exemple.invalid',
      avail: 'Heures ouvrées, astreinte en cas de crise',
      notes: 'Qualifie l’incident et prépare les notifications.',
      key: true,
    },
    {
      name: 'Délégué à la protection des données',
      org: 'Établissement de santé fictif',
      role: 'DPO',
      phone: '01 99 00 00 04',
      phone2: '',
      email: 'dpo@exemple.invalid',
      avail: 'Heures ouvrées',
      notes: 'Consulté pour toute violation de données personnelles.',
      key: false,
    },
  ];
  for (const c of contacts) {
    const cree = await exiger<{ id: string }>(
      await appel('POST', '/api/crise/contacts'),
      'Création d’un contact de crise',
    );
    await exiger(await appel('PATCH', `/api/crise/contacts/${cree.id}`, c), `Contact de crise ${cree.id}`);
  }
  // Fournisseurs critiques ou hébergeurs HDS du registre, ajoutés comme contacts clés.
  const importes = await exiger<{ ajoutes: number }>(
    await appel('POST', '/api/crise/contacts/fournisseurs'),
    'Contacts des fournisseurs critiques',
  );

  const scenarios: { fiche: Json; actions: { phase: string; t: string; owner: string }[] }[] = [
    {
      fiche: {
        title: 'Rançongiciel sur le dossier patient',
        ref: 'Scénario de l’étude EBIOS RM de démonstration',
        desc: 'Chiffrement malveillant des serveurs du dossier patient : bascule en mode dégradé papier, isolement, investigation, restauration.',
      },
      actions: [
        { phase: 'Alerte', t: 'Isoler les serveurs touchés du réseau sans les éteindre', owner: 'RSI' },
        { phase: 'Alerte', t: 'Prévenir le directeur de crise et le RSSI', owner: 'RSI' },
        { phase: 'Mobilisation', t: 'Activer le mode dégradé papier dans les services de soins', owner: 'Direction' },
        {
          phase: 'Gestion',
          t: 'Conserver les preuves (journaux, copies mémoire) avant toute remise en service',
          owner: 'RSSI',
        },
        {
          phase: 'Gestion',
          t: 'Évaluer l’atteinte aux données personnelles et de santé et les notifications à faire',
          owner: 'DPO',
        },
        {
          phase: 'Sortie de crise',
          t: 'Restaurer depuis la copie hors site après validation de l’éradication',
          owner: 'RSI',
        },
      ],
    },
    {
      fiche: {
        title: 'Indisponibilité prolongée de l’hébergeur de données',
        ref: 'Plan de continuité de démonstration',
        desc: 'Perte de l’accès à l’hébergeur de données de santé pendant plus de quatre heures.',
      },
      actions: [
        { phase: 'Alerte', t: 'Contacter l’hébergeur et obtenir une estimation de la durée', owner: 'RSI' },
        { phase: 'Mobilisation', t: 'Informer les services de soins et le directeur de crise', owner: 'RSI' },
        { phase: 'Gestion', t: 'Basculer sur les consignes de continuité d’activité', owner: 'Direction' },
        { phase: 'Sortie de crise', t: 'Contrôler l’intégrité des données au retour du service', owner: 'RSI' },
      ],
    },
  ];
  const ids: string[] = [];
  for (const sc of scenarios) {
    const cree = await exiger<{ id: string }>(
      await appel('POST', '/api/crise/scenarios'),
      'Création d’un scénario de crise',
    );
    await exiger(await appel('PATCH', `/api/crise/scenarios/${cree.id}`, sc.fiche), `Scénario ${cree.id}`);
    for (const [k, a] of sc.actions.entries()) {
      await exiger(
        await appel('POST', `/api/crise/scenarios/${cree.id}/actions`),
        `Action ${k} du scénario ${cree.id}`,
      );
      await exiger(
        await appel('PATCH', `/api/crise/scenarios/${cree.id}/actions/${k}`, a),
        `Action ${k} du scénario ${cree.id}`,
      );
    }
    ids.push(cree.id);
  }
  // Un exercice sur le premier scénario, mené puis clôturé.
  const cellule = await exiger<{ id: string }>(
    await appel('POST', '/api/crise/cellules', {
      mode: 'Exercice',
      title: 'Exercice de crise : rançongiciel (démonstration)',
      scenario: ids[0],
    }),
    'Ouverture de la cellule',
  );
  const note = (type: string, author: string, text: string) =>
    appel('POST', `/api/crise/cellules/${cellule.id}/entrees`, { type, author, text });
  await exiger(
    await note('Information', 'RSI', 'Simulation : alerte de l’antivirus sur plusieurs serveurs du dossier patient.'),
    'Main courante',
  );
  await exiger(
    await note('Décision', 'Direction', 'Activation du mode dégradé papier dans les services de soins.'),
    'Main courante',
  );
  await exiger(await note('Action', 'RSSI', 'Isolement des serveurs et conservation des journaux.'), 'Main courante');
  await exiger(
    await note('Communication', 'DPO', 'Évaluation de la violation de données et préparation de la notification.'),
    'Main courante',
  );
  await exiger(
    await appel('POST', `/api/crise/cellules/${cellule.id}/echeances`, {
      label: 'Notification à l’autorité de protection des données (exercice)',
      heures: 72,
    }),
    'Échéance',
  );
  for (const k of [0, 1, 2]) {
    await exiger(
      await appel('PUT', `/api/crise/cellules/${cellule.id}/checklist/${k}`, { fait: true, author: 'RSI' }),
      `Check-list ${k}`,
    );
  }
  await exiger(
    await appel('POST', `/api/crise/cellules/${cellule.id}/cloture`, { author: 'Direction' }),
    'Clôture de la cellule',
  );
  return { contacts: contacts.length + importes.ajoutes, scenarios: scenarios.length, cellules: 1 };
}

/** GAP : un questionnaire guidé d'intégration d'application (avec plan d'actions), un questionnaire guidé des usages de l'IA
    et une application saisie à la main, dont quelques points sont déjà évalués. */
async function gap({ appel, exiger, decaler }: Annexes): Promise<BilanAnnexes['gap']> {
  const portail = await exiger<{ app: { id: string }; plan: string | null }>(
    await appel('POST', '/api/gap/guide', {
      modele: 'application',
      name: 'Portail de prise de rendez-vous des patients (démonstration)',
      owner: 'RSI',
      target: decaler(120),
      desc: 'Application en ligne fictive permettant aux patients de prendre rendez-vous.',
      mkPlan: true,
      answers: {
        type: 'SaaS (hébergé par l’éditeur)',
        dscp: 'Oui',
        dcp: 'Oui',
        loc: 'France',
        certs: ['ISO 27001', 'HDS'],
        expo: 'Accessible depuis internet',
        users: ['Patients ou usagers', 'Agents de l’organisation'],
        sso: 'Disponible, non activée',
        mfa: 'Disponible et activée',
        tma: 'Non',
        flux: 'Oui',
        crit: 'Importante : une journée',
        backup: 'Le fournisseur',
        logs: 'Oui',
        spec: ['Aucun'],
      },
    }),
    'GAP guidé de l’application',
  );
  const ia = await exiger<{ app: { id: string } }>(
    await appel('POST', '/api/gap/guide', {
      modele: 'ia',
      name: 'Usages de l’IA de l’établissement (démonstration)',
      owner: 'RSSI',
      target: decaler(180),
      desc: 'État des lieux fictif des usages d’outils d’IA par les agents.',
      mkPlan: false,
      answers: {
        iaCas: ['Outils d’IA grand public utilisés par les agents', 'Code généré par IA'],
        iaDscp: 'Possible, non maîtrisé',
        iaInventaire: 'Partiel',
        iaRegle: 'Rédigée, non diffusée',
        iaSensibilisation: 'Non',
        iaRisques: 'Non',
        gpComptes: 'Comptes personnels',
        gpFiltrage: 'Supervisés sans blocage',
        gpContrat: 'Sans compte professionnel',
        gpIncident: 'Non connu',
        codeOutils: 'Comptes personnels',
        codeRevue: 'Partiellement',
        codeCritique: 'Non',
      },
    }),
    'GAP guidé des usages de l’IA',
  );
  // Application saisie à la main, avec deux points évalués.
  const manuel = await exiger<{ id: string }>(await appel('POST', '/api/gap'), 'Création d’une application à intégrer');
  await exiger(
    await appel('PATCH', `/api/gap/${manuel.id}`, {
      name: 'Plateforme de téléconsultation (démonstration)',
      dscp: 'Oui',
      cloud: 'Oui',
      status: 'En cours',
      owner: 'RSI',
      target: decaler(90),
      desc: 'Application fictive de téléconsultation, en cours d’étude.',
    }),
    `Application ${manuel.id}`,
  );
  await exiger(
    await appel('PATCH', `/api/gap/${manuel.id}/points/G01`, {
      st: 'Conforme',
      comment: 'Périmètre mis à jour dans la démonstration.',
      owner: 'RSSI',
    }),
    'Point G01',
  );
  await exiger(
    await appel('PATCH', `/api/gap/${manuel.id}/points/G03`, {
      st: 'Partiel',
      comment: 'Appréciation des risques commencée, à terminer avant l’intégration.',
      owner: 'RSSI',
      due: decaler(45),
    }),
    'Point G03',
  );
  return { applications: [portail.app, manuel].length, usagesIa: [ia.app].length };
}

/** Charge les modules annexes de la démonstration. */
export async function modulesAnnexes(ctx: Annexes): Promise<BilanAnnexes> {
  const bilan: BilanAnnexes = {
    incidents: 0,
    revuesAcces: 0,
    crise: { contacts: 0, scenarios: 0, cellules: 0 },
    gap: { applications: 0, usagesIa: 0 },
  };
  bilan.incidents = await incidents(ctx);
  bilan.revuesAcces = await revuesAcces(ctx);
  bilan.crise = await crise(ctx);
  bilan.gap = await gap(ctx);
  return bilan;
}

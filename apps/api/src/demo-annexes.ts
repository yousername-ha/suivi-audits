/* Démonstration, modules annexes : incidents, investissements, revues des accès (puis cellule de crise, CRRC et GAP).
   Même principe que `demo-normes.ts` : tout passe par l'API publique, au nom de l'administrateur créé à l'installation, avec les
   mêmes validations que l'interface. Établissement, fournisseurs et circonstances sont entièrement fictifs et reprennent ceux
   du jeu de démonstration (fournisseurs SUP-001 à SUP-005) ; dates et montants sont des exemples à remplacer par les vôtres. */
import type { ContexteDemo } from './demo-normes.js';

type Json = Record<string, unknown>;
type Annexes = Pick<ContexteDemo, 'appel' | 'exiger' | 'decaler'>;

export interface BilanAnnexes {
  incidents: number;
  investissements: number;
  revuesAcces: number;
  crise: { contacts: number; scenarios: number; cellules: number };
  crrc: { etablissements: number; ressources: number; sauvegardes: number; restaurations: number; alertes: number };
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

/** Investissements : budget sur trois ans, dont deux options comparables pour la supervision de sécurité. */
async function investissements({ appel, exiger, decaler }: Annexes): Promise<number> {
  const annee = new Date().getFullYear();
  await exiger(await appel('PUT', '/api/investissements/annee', { baseYear: annee }), 'Année de référence du budget');
  const lignes: Json[] = [
    {
      company: 'Éditeur de protection des postes fictif',
      type: 'Protection des postes',
      desc: 'Détection et réponse sur les postes et serveurs (abonnement annuel).',
      nature: 'Abonnement',
      status: 'En place',
      priority: '1',
      n0: 18000,
      n1: 18000,
      n2: 18500,
      perimeter: 'Établissement',
      account: 'Fonctionnement',
      renewal: decaler(200),
      notice: 90,
    },
    {
      company: 'Intégrateur de supervision fictif A',
      type: 'Supervision de sécurité',
      desc: 'Collecte et corrélation des journaux, supervision par un centre externe en heures ouvrées.',
      nature: 'Prestation',
      status: 'Prévisionnel',
      priority: '2',
      n0: 22000,
      n1: 30000,
      n2: 30000,
      alt: 'Option B ci-dessous (supervision 24 h sur 24).',
      perimeter: 'Établissement',
      account: 'Investissement',
    },
    {
      company: 'Intégrateur de supervision fictif B',
      type: 'Supervision de sécurité',
      desc: 'Même périmètre, supervision 24 h sur 24 et 7 jours sur 7.',
      nature: 'Prestation',
      status: 'À qualifier',
      priority: '2',
      n0: 35000,
      n1: 42000,
      n2: 42000,
      comment: 'Devis à confirmer ; à comparer avec l’option A avant la revue de direction.',
      perimeter: 'Établissement',
      account: 'Investissement',
    },
    {
      company: 'Fournisseur de sauvegarde fictif',
      type: 'Sauvegarde',
      desc: 'Copie immuable hors site des sauvegardes du dossier patient.',
      nature: 'Abonnement',
      status: 'Validé',
      priority: '1',
      n0: 9000,
      n1: 9000,
      n2: 9000,
      perimeter: 'Dossier patient',
      account: 'Fonctionnement',
      supplier: 'SUP-001',
    },
    {
      company: 'Cabinet d’audit fictif',
      type: 'Audit de sécurité',
      desc: 'Test d’intrusion annuel et revue de configuration.',
      nature: 'Prestation',
      status: 'Prévisionnel',
      priority: '3',
      n0: 12000,
      n1: 12000,
      n2: 12000,
      perimeter: 'Établissement',
      account: 'Fonctionnement',
    },
    {
      company: 'Revendeur de matériel fictif',
      type: 'Authentification forte',
      desc: 'Clés d’authentification physiques pour les comptes d’administration et le personnel soignant.',
      nature: 'Matériel',
      status: 'En place',
      priority: '2',
      n0: 6500,
      n1: 0,
      n2: 0,
      perimeter: 'Établissement',
      account: 'Investissement',
    },
  ];
  for (const l of lignes) {
    const cree = await exiger<{ id: string }>(
      await appel('POST', '/api/investissements/lignes'),
      'Création d’une ligne budgétaire',
    );
    await exiger(await appel('PATCH', `/api/investissements/lignes/${cree.id}`, l), `Ligne ${cree.id}`);
  }
  return lignes.length;
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

/** CRRC : trois établissements partenaires fictifs (identifiants « 99-FICTIF », volontairement irréels) à des stades de contrat
    différents, cinq ressources sauvegardées, dix jours de sauvegardes avec un avertissement et un échec récents, deux demandes de
    restauration et deux alertes. */
async function crrc({ appel, exiger, decaler }: Annexes): Promise<BilanAnnexes['crrc']> {
  const partenaires: Json[] = [
    {
      name: 'Établissement partenaire fictif A',
      finess: '99-FICTIF-01',
      status: 'Actif',
      signed: decaler(-200),
      serviceDate: decaler(-170),
      renewal: decaler(195),
      adminContact: 'Direction (partenaire A)',
      adminEmail: 'direction-a@exemple.invalid',
      techContact: 'Informatique (partenaire A)',
      techEmail: 'it-a@exemple.invalid',
      prestataire: 'Prestataire de maintenance fictif',
      alerts: 'it-a@exemple.invalid',
      capacityGb: 2000,
      retentionDays: 90,
      scopes: { m365: true, windows: true, s3: false, gws: false },
      notes: 'Contrat de démonstration.',
    },
    {
      name: 'Établissement partenaire fictif B',
      finess: '99-FICTIF-02',
      status: 'Déploiement',
      signed: decaler(-30),
      serviceDate: '',
      renewal: decaler(335),
      adminContact: 'Direction (partenaire B)',
      adminEmail: 'direction-b@exemple.invalid',
      techContact: 'Informatique (partenaire B)',
      techEmail: 'it-b@exemple.invalid',
      prestataire: '',
      alerts: 'it-b@exemple.invalid',
      capacityGb: 500,
      retentionDays: 30,
      scopes: { s3: true, windows: false, m365: false, gws: false },
      notes: 'Agent en cours de déploiement.',
    },
    {
      name: 'Établissement partenaire fictif C',
      finess: '99-FICTIF-03',
      status: 'À signer',
      signed: '',
      serviceDate: '',
      renewal: '',
      adminContact: 'Direction (partenaire C)',
      adminEmail: 'direction-c@exemple.invalid',
      techContact: '',
      techEmail: '',
      prestataire: '',
      alerts: '',
      capacityGb: 0,
      retentionDays: 0,
      scopes: {},
      notes: 'Convention transmise pour signature.',
    },
  ];
  const est: string[] = [];
  for (const e of partenaires) {
    const cree = await exiger<{ id: string }>(
      await appel('POST', '/api/crrc/etablissements'),
      'Création d’un contrat établissement',
    );
    await exiger(await appel('PATCH', `/api/crrc/etablissements/${cree.id}`, e), `Contrat ${cree.id}`);
    est.push(cree.id);
  }
  // Ressource, établissement, technologie, fréquence, dernier état de ses sauvegardes (0 = toutes réussies).
  const ressources: {
    nom: string;
    e: number;
    tech: string;
    freq: string;
    retention: number;
    fin: 'ok' | 'alerte' | 'echec';
    gb: number;
  }[] = [
    {
      nom: 'Messagerie et documents du partenaire A',
      e: 0,
      tech: 'm365',
      freq: 'Quotidienne',
      retention: 90,
      fin: 'ok',
      gb: 420,
    },
    {
      nom: 'Serveur de fichiers du partenaire A',
      e: 0,
      tech: 'windows',
      freq: 'Quotidienne',
      retention: 90,
      fin: 'alerte',
      gb: 780,
    },
    {
      nom: 'Serveur d’imagerie du partenaire A',
      e: 0,
      tech: 'windows',
      freq: 'Hebdomadaire',
      retention: 90,
      fin: 'echec',
      gb: 1100,
    },
    {
      nom: 'NAS administratif du partenaire A',
      e: 0,
      tech: 's3',
      freq: 'Quotidienne',
      retention: 90,
      fin: 'ok',
      gb: 150,
    },
    { nom: 'NAS du partenaire B', e: 1, tech: 's3', freq: 'Quotidienne', retention: 30, fin: 'ok', gb: 240 },
  ];
  const ids: string[] = [];
  let sauvegardes = 0;
  for (const r of ressources) {
    const cree = await exiger<{ id: string }>(
      await appel('POST', '/api/crrc/ressources', { est: est[r.e], tech: r.tech }),
      'Création d’une ressource',
    );
    await exiger(
      await appel('PATCH', `/api/crrc/ressources/${cree.id}`, { name: r.nom, freq: r.freq, retention: r.retention }),
      `Ressource ${cree.id}`,
    );
    for (let j = 10; j >= 1; j--) {
      const dernier = j === 1;
      const status = dernier ? { ok: 'Réussie', alerte: 'Alerte', echec: 'Échec' }[r.fin] : 'Réussie';
      await exiger(
        await appel('POST', `/api/crrc/ressources/${cree.id}/sauvegardes`, {
          date: heure(-j, '02:00'),
          type: j % 7 === 0 ? 'Complète' : 'Incrémentale',
          status,
          volumeGb: status === 'Échec' ? 0 : Math.round((j % 7 === 0 ? r.gb : r.gb / 20) * 10) / 10,
          durationMin: status === 'Échec' ? 3 : j % 7 === 0 ? 240 : 25,
        }),
        `Sauvegarde ${j} de ${cree.id}`,
      );
      sauvegardes++;
    }
    ids.push(cree.id);
  }
  // Deux demandes de restauration : un test mené à bien, une demande en attente.
  const test = await exiger<{ id: string }>(
    await appel('POST', '/api/crrc/restaurations', {
      res: ids[0],
      point: heure(-3, '02:00'),
      scope: 'Boîte de messagerie de test',
      type: 'Test de restauration',
      owner: 'Informatique (partenaire A)',
      dest: 'Emplacement alternatif',
      path: '/restauration/test',
      conflict: 'Renommer',
    }),
    'Demande de restauration',
  );
  await exiger(
    await appel('PATCH', `/api/crrc/restaurations/${test.id}`, { status: 'Réussie', duration: '35 min' }),
    'Suivi de la restauration',
  );
  await exiger(
    await appel('POST', '/api/crrc/restaurations', {
      res: ids[1],
      point: heure(-2, '02:00'),
      scope: 'Dossier partagé de la comptabilité',
      type: 'Demande utilisateur',
      owner: 'Informatique (partenaire A)',
      dest: 'Emplacement d’origine',
      path: '',
      conflict: 'Ne pas écraser',
    }),
    'Demande de restauration',
  );
  // Deux alertes : l'échec de la sauvegarde d'imagerie (ouverte) et l'avertissement du serveur de fichiers (résolue).
  await exiger(
    await appel('POST', '/api/crrc/alertes', {
      severity: 'Haute',
      res: ids[2],
      message: 'La dernière sauvegarde hebdomadaire du serveur d’imagerie a échoué (agent injoignable).',
    }),
    'Alerte',
  );
  const avert = await exiger<{ id: string }>(
    await appel('POST', '/api/crrc/alertes', {
      severity: 'Moyenne',
      res: ids[1],
      message: 'Durée de sauvegarde supérieure à la moyenne sur le serveur de fichiers.',
    }),
    'Alerte',
  );
  await exiger(await appel('PATCH', `/api/crrc/alertes/${avert.id}`, { status: 'Résolue' }), 'Suivi de l’alerte');
  return {
    etablissements: partenaires.length,
    ressources: ressources.length,
    sauvegardes,
    restaurations: 2,
    alertes: 2,
  };
}

/** Charge les modules annexes de la démonstration. */
export async function modulesAnnexes(ctx: Annexes): Promise<BilanAnnexes> {
  const bilan: BilanAnnexes = {
    incidents: 0,
    investissements: 0,
    revuesAcces: 0,
    crise: { contacts: 0, scenarios: 0, cellules: 0 },
    crrc: { etablissements: 0, ressources: 0, sauvegardes: 0, restaurations: 0, alertes: 0 },
  };
  bilan.incidents = await incidents(ctx);
  bilan.investissements = await investissements(ctx);
  bilan.revuesAcces = await revuesAcces(ctx);
  bilan.crise = await crise(ctx);
  bilan.crrc = await crrc(ctx);
  return bilan;
}

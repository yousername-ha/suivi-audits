/* Données fictives partagées par toutes les maquettes (design-mockups/).
   Aucune donnée réelle : organisation, sites, personnes, audits, constats et incidents sont inventés.
   Chargement : <script src="../shared/fake-data.js"></script> puis window.FAKE (aucun module, pour fonctionner en file://).
   Génération déterministe (graine fixe) : les volumes et les écarts restent identiques d'une ouverture à l'autre.
   Date de référence : 31/10/2026 (certaines échéances sont volontairement dépassées). */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ Générateur déterministe */
  var seed = 20261031;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }
  function pick(arr) {
    return arr[Math.floor(rnd() * arr.length)];
  }
  function between(min, max) {
    return Math.floor(min + rnd() * (max - min + 1));
  }
  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }
  var TODAY = new Date(2026, 9, 31); // 31 octobre 2026
  function addDays(d, n) {
    var r = new Date(d.getTime());
    r.setDate(r.getDate() + n);
    return r;
  }
  function iso(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fr(isoDate) {
    if (!isoDate) return '';
    var p = isoDate.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function frLong(isoDate) {
    var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    var p = isoDate.split('-');
    return parseInt(p[2], 10) + ' ' + MOIS[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }
  function daysUntil(isoDate) {
    var p = isoDate.split('-');
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    return Math.round((d.getTime() - TODAY.getTime()) / 86400000);
  }
  function slug(s) {
    return s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  /* ------------------------------------------------------------------ Référentiels fictifs */
  var ORGANISATION = {
    nom: 'GHT Val-d’Ombre',
    sigle: 'GHT VO',
    application: 'Suivi des audits SMSI',
    sousTitre: 'Qualité, sécurité et référentiels',
    periode: 'Cycle de certification 2025 – 2028',
  };

  var UTILISATEURS = [
    { id: 'u1', nom: 'Camille Vauréal', role: 'RSSI', initiales: 'CV' },
    { id: 'u2', nom: 'Idriss Bellecombe', role: 'Auditeur interne', initiales: 'IB' },
    { id: 'u3', nom: 'Léonie Fargeot', role: 'Responsable qualité', initiales: 'LF' },
    { id: 'u4', nom: 'Marius Tcherkassov', role: 'DSI adjoint', initiales: 'MT' },
    { id: 'u5', nom: 'Anaïs Delorme-Petit', role: 'Référente HDS', initiales: 'AD' },
    { id: 'u6', nom: 'Oscar Winterhalter', role: 'Pilote de processus', initiales: 'OW' },
    { id: 'u7', nom: 'Salomé Nguema', role: 'Juriste DPO', initiales: 'SN' },
    { id: 'u8', nom: 'Théo Carvalhais', role: 'Administrateur systèmes', initiales: 'TC' },
  ];
  var MOI = UTILISATEURS[0];

  var SITES = [
    'CH de Brumeval',
    'Clinique des Trois-Cèdres',
    'Centre de données Ouest',
    'Plateforme régionale e-santé',
    'EHPAD Les Sarments',
    'Siège du GHT',
  ];

  var REFERENTIELS = [
    { id: 'iso', libelle: 'ISO 27001:2022', court: 'ISO 27001', couleur: 'vert' },
    { id: 'annexeA', libelle: 'Annexe A (93 mesures)', court: 'Annexe A', couleur: 'bleu' },
    { id: 'hds', libelle: 'HDS v2', court: 'HDS', couleur: 'violet' },
    { id: 'nis2', libelle: 'NIS 2', court: 'NIS 2', couleur: 'orange' },
    { id: 'rgpd', libelle: 'RGPD', court: 'RGPD', couleur: 'gris' },
  ];

  var TYPES_AUDIT = ['Certification', 'Surveillance', 'Interne', 'Fournisseur', 'Blanc', 'Réglementaire'];
  var STATUTS_AUDIT = ['Planifié', 'En préparation', 'En cours', 'Rapport attendu', 'Clos', 'Reporté'];
  var CRITICITES = ['Critique', 'Majeure', 'Mineure', 'Observation'];
  var TYPES_CONSTAT = ['NC majeure', 'NC mineure', 'Point sensible', 'Piste de progrès', 'Remarque'];
  var STATUTS_CONSTAT = ['Ouvert', 'En cours', 'À vérifier', 'Clos'];
  var STATUTS_ACTION = ['À faire', 'En cours', 'Bloquée', 'Terminée'];
  var PRIORITES = ['P1', 'P2', 'P3'];

  var THEMES_CONSTAT = [
    { ref: 'A.5.15', titre: 'Revue des droits d’accès non tracée sur deux applications métier' },
    { ref: 'A.8.8', titre: 'Correctifs critiques appliqués au-delà du délai cible de 30 jours' },
    { ref: 'A.5.23', titre: 'Clauses de sécurité absentes d’un contrat d’hébergement' },
    { ref: '6.1.2', titre: 'Appréciation des risques non revue depuis plus de douze mois' },
    { ref: 'A.8.13', titre: 'Test de restauration non réalisé sur le périmètre imagerie' },
    { ref: '9.2', titre: 'Programme d’audit interne incomplet pour l’exercice' },
    { ref: 'A.6.3', titre: 'Sensibilisation annuelle non suivie par 18 % des agents' },
    { ref: 'A.8.15', titre: 'Journaux d’administration conservés 30 jours au lieu de 180' },
    { ref: 'HDS 12', titre: 'Procédure de réversibilité non formalisée pour un sous-traitant' },
    { ref: 'A.5.30', titre: 'Plan de continuité non testé depuis la bascule du centre de données' },
    { ref: '7.5', titre: 'Documents du SMSI sans date de revue ni version maîtrisée' },
    { ref: 'A.8.2', titre: 'Comptes à privilèges partagés sur un serveur de rebond' },
    { ref: 'A.5.9', titre: 'Inventaire des actifs incomplet pour les équipements biomédicaux' },
    { ref: 'A.8.16', titre: 'Alertes de supervision sans procédure d’escalade écrite' },
    { ref: 'A.5.24', titre: 'Processus de gestion des incidents non communiqué aux prestataires' },
    { ref: '10.2', titre: 'Actions correctives sans analyse de cause racine' },
    { ref: 'A.7.4', titre: 'Contrôle d’accès physique de la salle serveurs à renforcer' },
    { ref: 'A.8.24', titre: 'Politique de chiffrement non appliquée aux supports amovibles' },
    { ref: 'HDS 05', titre: 'Convention de preuve de l’hébergeur à mettre à jour' },
    { ref: 'A.5.19', titre: 'Évaluation des fournisseurs critiques réalisée à 60 %' },
  ];

  var VERBES_ACTION = [
    'Formaliser', 'Déployer', 'Mettre à jour', 'Tester', 'Documenter', 'Auditer', 'Former', 'Contractualiser', 'Automatiser', 'Revoir',
  ];
  var OBJETS_ACTION = [
    'la procédure de revue des accès', 'le plan de patch management', 'les clauses contractuelles', 'le test de restauration',
    'la matrice des rôles', 'le registre des actifs', 'le runbook de supervision', 'le programme de sensibilisation',
    'la politique de journalisation', 'la fiche de réversibilité', 'le plan de continuité', 'le chiffrement des supports',
  ];

  /* ------------------------------------------------------------------ Audits (36) */
  var AUDITS = [];
  var NOMS_AUDIT = [
    'Certification initiale ISO 27001', 'Surveillance 1 ISO 27001', 'Surveillance 2 ISO 27001', 'Audit interne SMSI — hiver',
    'Audit interne SMSI — été', 'Audit HDS — hébergement imagerie', 'Audit HDS — plateforme régionale', 'Audit blanc avant surveillance',
    'Audit fournisseur — infogérance réseau', 'Audit fournisseur — hébergeur sauvegardes', 'Audit fournisseur — éditeur DPI',
    'Revue NIS 2 — mesures de gouvernance', 'Audit RGPD — registre des traitements', 'Audit interne — gestion des accès',
    'Audit interne — continuité d’activité', 'Audit interne — gestion des incidents', 'Audit interne — sécurité physique',
    'Audit interne — développement sécurisé', 'Audit interne — journalisation', 'Audit interne — fournisseurs',
    'Audit interne — actifs et classification', 'Audit interne — cryptographie', 'Audit interne — ressources humaines',
    'Audit interne — télétravail', 'Audit interne — biomédical connecté', 'Audit interne — sauvegardes',
    'Audit interne — messagerie', 'Audit interne — identité numérique', 'Audit réglementaire — PGSSI-S',
    'Audit interne — Wi-Fi et réseau', 'Audit interne — postes de travail', 'Audit interne — centre de données Ouest',
    'Audit interne — EHPAD Les Sarments', 'Audit interne — pharmacie à usage intérieur', 'Audit fournisseur — télémaintenance',
    'Renouvellement ISO 27001 (préparation)',
  ];
  var NB_AUDITS = NOMS_AUDIT.length; // 36
  for (var i = 0; i < NB_AUDITS; i++) {
    var nom = NOMS_AUDIT[i];
    var type = /Certification|Renouvellement/.test(nom)
      ? 'Certification'
      : /Surveillance/.test(nom)
        ? 'Surveillance'
        : /HDS/.test(nom)
          ? 'Réglementaire'
          : /fournisseur/i.test(nom)
            ? 'Fournisseur'
            : /blanc/i.test(nom)
              ? 'Blanc'
              : /NIS 2|RGPD|PGSSI/.test(nom)
                ? 'Réglementaire'
                : 'Interne';
    var refId = /HDS/.test(nom) ? 'hds' : /NIS 2/.test(nom) ? 'nis2' : /RGPD/.test(nom) ? 'rgpd' : i % 3 === 0 ? 'annexeA' : 'iso';
    var offset = between(-420, 240); // jours autour d'aujourd'hui
    if (i === 0) offset = -560;
    if (i === 1) offset = -200;
    if (i === 2) offset = 160;
    if (i === 5) offset = -1;
    if (i === 6) offset = 0;
    if (i === 7) offset = 12;
    if (i === NB_AUDITS - 1) offset = 230;
    var debut = addDays(TODAY, offset);
    var duree = type === 'Certification' ? 4 : type === 'Surveillance' ? 2 : between(1, 3);
    var fin = addDays(debut, duree - 1);
    var statut;
    if (offset > 45) statut = rnd() < 0.8 ? 'Planifié' : 'Reporté';
    else if (offset > 0) statut = 'En préparation';
    else if (offset > -duree) statut = 'En cours';
    else if (offset > -45) statut = rnd() < 0.5 ? 'Rapport attendu' : 'Clos';
    else statut = rnd() < 0.9 ? 'Clos' : 'Rapport attendu';
    var progression = statut === 'Clos' ? 100 : statut === 'Rapport attendu' ? between(80, 95) : statut === 'En cours' ? between(30, 70) : statut === 'En préparation' ? between(10, 40) : statut === 'Reporté' ? between(0, 20) : between(0, 10);
    var nbConstats = statut === 'Planifié' || statut === 'En préparation' || statut === 'Reporté' ? 0 : between(1, 7);
    AUDITS.push({
      id: 'AUD-' + pad(i + 1),
      nom: nom,
      type: type,
      referentiel: refId,
      site: pick(SITES),
      responsable: pick(UTILISATEURS).id,
      auditeur: type === 'Certification' || type === 'Surveillance' ? 'Organisme certificateur (fictif)' : pick(UTILISATEURS.slice(1, 4)).nom,
      debut: iso(debut),
      fin: iso(fin),
      statut: statut,
      progression: progression,
      criticite: nbConstats === 0 ? 'Observation' : pick(CRITICITES),
      nbConstats: nbConstats,
      perimetre: pick(['Périmètre complet du SMSI', 'Hébergement des données de santé', 'Infrastructure et exploitation', 'Processus métier et support', 'Fournisseurs critiques']),
      description: 'Audit ' + type.toLowerCase() + ' portant sur ' + pick(['les mesures organisationnelles', 'les mesures techniques', 'la gouvernance du SMSI', 'la continuité et la résilience', 'la chaîne de sous-traitance']) + ' du périmètre ' + pick(SITES).toLowerCase() + '.',
    });
  }

  /* ------------------------------------------------------------------ Constats et non-conformités */
  var CONSTATS = [];
  var compteur = 0;
  AUDITS.forEach(function (a) {
    for (var k = 0; k < a.nbConstats; k++) {
      compteur++;
      var theme = THEMES_CONSTAT[(compteur * 7) % THEMES_CONSTAT.length];
      var typeC = pick(TYPES_CONSTAT);
      var crit = typeC === 'NC majeure' ? (rnd() < 0.5 ? 'Critique' : 'Majeure') : typeC === 'NC mineure' ? (rnd() < 0.7 ? 'Majeure' : 'Mineure') : typeC === 'Point sensible' ? 'Mineure' : 'Observation';
      var statutC = a.statut === 'Clos' ? pick(['Clos', 'Clos', 'En cours', 'À vérifier', 'Ouvert']) : pick(['Ouvert', 'En cours', 'À vérifier']);
      var echeance = addDays(TODAY, between(-60, 120));
      if (statutC === 'Clos') echeance = addDays(TODAY, between(-120, -5));
      CONSTATS.push({
        id: 'C-' + pad(compteur),
        auditId: a.id,
        ref: theme.ref,
        titre: theme.titre,
        type: typeC,
        criticite: crit,
        statut: statutC,
        responsable: pick(UTILISATEURS).id,
        echeance: iso(echeance),
        creeLe: iso(addDays(new Date(a.fin), between(1, 10))),
        description: 'Constat relevé lors de « ' + a.nom + ' » sur le site ' + a.site + '. Preuve attendue : ' + pick(['compte rendu de revue', 'journal d’exécution', 'contrat signé', 'rapport de test', 'procédure versionnée']) + '.',
      });
    }
  });
  var NON_CONFORMITES = CONSTATS.filter(function (c) {
    return c.type === 'NC majeure' || c.type === 'NC mineure';
  });

  /* ------------------------------------------------------------------ Actions correctives */
  var ACTIONS = [];
  CONSTATS.forEach(function (c, idx) {
    var n = c.type.indexOf('NC') === 0 ? between(1, 3) : rnd() < 0.6 ? 1 : 0;
    for (var k = 0; k < n; k++) {
      var statutA = c.statut === 'Clos' ? 'Terminée' : pick(STATUTS_ACTION);
      var ech = addDays(TODAY, between(-45, 150));
      if (statutA === 'Terminée') ech = addDays(TODAY, between(-90, -1));
      ACTIONS.push({
        id: 'ACT-' + pad(ACTIONS.length + 1),
        constatId: c.id,
        auditId: c.auditId,
        titre: VERBES_ACTION[(idx + k) % VERBES_ACTION.length] + ' ' + OBJETS_ACTION[(idx * 3 + k) % OBJETS_ACTION.length],
        statut: statutA,
        priorite: c.criticite === 'Critique' ? 'P1' : c.criticite === 'Majeure' ? pick(['P1', 'P2']) : pick(['P2', 'P3']),
        responsable: pick(UTILISATEURS).id,
        echeance: iso(ech),
        avancement: statutA === 'Terminée' ? 100 : statutA === 'À faire' ? 0 : statutA === 'Bloquée' ? between(10, 50) : between(20, 90),
        charge: between(1, 12) + ' j',
      });
    }
  });

  /* ------------------------------------------------------------------ Risques */
  var RISQUES = [
    'Indisponibilité du dossier patient informatisé', 'Fuite de données de santé par un prestataire', 'Rançongiciel sur le réseau bureautique',
    'Perte des sauvegardes du centre de données Ouest', 'Usurpation d’un compte à privilèges', 'Défaillance de l’hébergeur HDS',
    'Compromission d’un équipement biomédical connecté', 'Erreur de configuration du pare-feu inter-sites', 'Indisponibilité de la messagerie sécurisée',
    'Non-conformité RGPD d’un traitement de recherche', 'Vol de supports amovibles non chiffrés', 'Panne électrique prolongée de la salle serveurs',
  ].map(function (t, i) {
    var g = between(1, 4);
    var v = between(1, 4);
    return {
      id: 'R-' + pad(i + 1),
      titre: t,
      gravite: g,
      vraisemblance: v,
      niveau: g * v,
      traitement: pick(['Réduire', 'Réduire', 'Accepter', 'Transférer', 'Éviter']),
      proprietaire: pick(UTILISATEURS).id,
      tendance: pick(['hausse', 'stable', 'stable', 'baisse']),
    };
  });

  /* ------------------------------------------------------------------ Indicateurs SMSI */
  var INDICATEURS = [
    { id: 'I1', libelle: 'Taux de conformité ISO 27001', valeur: 87, cible: 90, unite: '%', tendance: 'hausse', historique: [72, 74, 78, 79, 81, 83, 84, 85, 86, 86, 87, 87] },
    { id: 'I2', libelle: 'Mesures Annexe A couvertes', valeur: 81, cible: 93, unite: '/93', tendance: 'hausse', historique: [61, 64, 66, 70, 72, 73, 75, 77, 78, 79, 80, 81] },
    { id: 'I3', libelle: 'Délai moyen de clôture des NC', valeur: 46, cible: 30, unite: 'j', tendance: 'baisse', historique: [71, 69, 66, 62, 60, 58, 55, 52, 50, 49, 47, 46] },
    { id: 'I4', libelle: 'Agents sensibilisés', valeur: 82, cible: 95, unite: '%', tendance: 'hausse', historique: [40, 48, 55, 60, 64, 68, 71, 74, 77, 79, 80, 82] },
    { id: 'I5', libelle: 'Correctifs critiques < 30 j', valeur: 76, cible: 95, unite: '%', tendance: 'stable', historique: [70, 73, 72, 75, 74, 77, 76, 78, 75, 77, 76, 76] },
    { id: 'I6', libelle: 'Tests de restauration réussis', valeur: 9, cible: 12, unite: '/12', tendance: 'hausse', historique: [4, 4, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9] },
    { id: 'I7', libelle: 'Incidents de sécurité (mois)', valeur: 7, cible: 5, unite: '', tendance: 'baisse', historique: [12, 14, 11, 9, 13, 10, 8, 9, 7, 8, 6, 7] },
    { id: 'I8', libelle: 'Fournisseurs critiques évalués', valeur: 14, cible: 22, unite: '/22', tendance: 'hausse', historique: [5, 6, 6, 8, 9, 10, 11, 11, 12, 13, 14, 14] },
  ];
  var MOIS_12 = ['nov. 25', 'déc. 25', 'janv. 26', 'févr. 26', 'mars 26', 'avr. 26', 'mai 26', 'juin 26', 'juil. 26', 'août 26', 'sept. 26', 'oct. 26'];

  /* Évolution mensuelle des constats : ouverts / clos. */
  var EVOLUTION = MOIS_12.map(function (m, i) {
    return { mois: m, ouverts: [9, 11, 8, 14, 12, 10, 15, 13, 9, 11, 8, 10][i], clos: [6, 8, 9, 10, 11, 12, 12, 14, 11, 13, 12, 9][i] };
  });

  /* ------------------------------------------------------------------ RETEX : incidents et chronologie */
  var TYPES_EVENEMENT_RETEX = ['Détection', 'Qualification', 'Alerte et escalade', 'Analyse', 'Confinement', 'Décision', 'Communication', 'Éradication', 'Rétablissement', 'Clôture'];
  var GRAVITES_RETEX = ['Aucune', 'Faible', 'Modérée', 'Élevée', 'Critique'];
  var INCIDENTS = [
    {
      id: 'INC-2026-014',
      titre: 'Chiffrement malveillant d’un partage de fichiers du pôle imagerie',
      debut: '2026-09-14T06:42',
      fin: '2026-09-17T18:10',
      pilote: 'u1',
      graviteMax: 4,
      impact: 'Indisponibilité partielle des comptes rendus d’imagerie pendant 31 h ; aucun accès aux données de santé confirmé.',
      enseignements: [
        'La segmentation réseau a limité la propagation au seul partage du pôle.',
        'La procédure d’escalade de nuit manquait d’un contact de repli.',
        'Le test de restauration du mois précédent a réduit le délai de rétablissement de moitié.',
      ],
      evenements: [
        { h: '2026-09-14T06:42', type: 'Détection', gravite: 2, titre: 'Alerte EDR sur un poste du secrétariat', detail: 'Création massive de fichiers à extension inconnue détectée par l’agent de protection.', acteur: 'u8' },
        { h: '2026-09-14T07:05', type: 'Qualification', gravite: 3, titre: 'Incident qualifié « rançongiciel probable »', detail: 'Trois postes et le partage \\\\img-partage touchés ; note de rançon identifiée.', acteur: 'u8' },
        { h: '2026-09-14T07:20', type: 'Alerte et escalade', gravite: 4, titre: 'Cellule de crise convoquée', detail: 'RSSI, DSI adjoint, direction des soins et communication prévenus ; appel au CERT régional.', acteur: 'u1' },
        { h: '2026-09-14T07:45', type: 'Confinement', gravite: 4, titre: 'Isolation du VLAN imagerie', detail: 'Coupure des flux sortants du VLAN 120 et désactivation du compte de service compromis.', acteur: 'u4' },
        { h: '2026-09-14T09:30', type: 'Analyse', gravite: 3, titre: 'Vecteur identifié : pièce jointe macro', detail: 'Courriel reçu la veille à 17 h 12 ; macro exécutée à 6 h 38 ; mouvement latéral par partage SMB.', acteur: 'u8' },
        { h: '2026-09-14T11:00', type: 'Communication', gravite: 3, titre: 'Information des services cliniques', detail: 'Mode dégradé papier pour les comptes rendus ; message interne et affichage dans les secrétariats.', acteur: 'u3' },
        { h: '2026-09-14T14:15', type: 'Décision', gravite: 3, titre: 'Restauration depuis la sauvegarde J-1', detail: 'Perte acceptée : 5 h de production ; notification CNIL jugée non nécessaire à ce stade.', acteur: 'u1' },
        { h: '2026-09-15T02:30', type: 'Éradication', gravite: 2, titre: 'Postes réinstallés et mots de passe réinitialisés', detail: 'Réinstallation de 3 postes, rotation des secrets du domaine, blocage des indicateurs de compromission.', acteur: 'u8' },
        { h: '2026-09-15T13:50', type: 'Rétablissement', gravite: 1, titre: 'Partage imagerie rétabli en lecture', detail: 'Vérification d’intégrité par échantillon ; réouverture progressive des droits en écriture.', acteur: 'u4' },
        { h: '2026-09-16T09:00', type: 'Communication', gravite: 1, titre: 'Point de situation à la direction', detail: 'Bilan chiffré, plan de durcissement et calendrier de sensibilisation présentés.', acteur: 'u1' },
        { h: '2026-09-17T18:10', type: 'Clôture', gravite: 0, titre: 'Incident clos, RETEX planifié', detail: 'Clôture formelle ; réunion de retour d’expérience fixée au 24/09 avec les pilotes de processus.', acteur: 'u1' },
      ],
    },
    {
      id: 'INC-2026-009',
      titre: 'Panne de climatisation de la salle serveurs du centre de données Ouest',
      debut: '2026-06-02T22:15',
      fin: '2026-06-03T08:40',
      pilote: 'u4',
      graviteMax: 3,
      impact: 'Arrêt préventif de 12 serveurs non critiques ; aucune perte de données.',
      enseignements: ['La supervision de température a fonctionné ; l’astreinte prestataire n’a pas répondu avant 50 minutes.'],
      evenements: [
        { h: '2026-06-02T22:15', type: 'Détection', gravite: 1, titre: 'Alerte température 31 °C', detail: 'Sonde de la rangée B au-dessus du seuil d’alerte.', acteur: 'u8' },
        { h: '2026-06-02T22:40', type: 'Alerte et escalade', gravite: 2, titre: 'Astreinte DSI prévenue', detail: 'Prestataire climatisation injoignable, second numéro appelé.', acteur: 'u8' },
        { h: '2026-06-02T23:30', type: 'Décision', gravite: 3, titre: 'Arrêt préventif des serveurs non critiques', detail: 'Température 36 °C ; 12 serveurs de test et de pré-production éteints.', acteur: 'u4' },
        { h: '2026-06-03T01:05', type: 'Confinement', gravite: 2, titre: 'Climatisation de secours mobile installée', detail: 'Unité mobile branchée par le prestataire arrivé à 0 h 50.', acteur: 'u4' },
        { h: '2026-06-03T06:00', type: 'Rétablissement', gravite: 1, titre: 'Retour sous 24 °C, redémarrage progressif', detail: 'Redémarrage par lots de quatre serveurs.', acteur: 'u8' },
        { h: '2026-06-03T08:40', type: 'Clôture', gravite: 0, titre: 'Incident clos', detail: 'Demande de révision du contrat d’astreinte ouverte.', acteur: 'u4' },
      ],
    },
  ];

  /* ------------------------------------------------------------------ Historique d'un audit (journal) */
  function historiqueAudit(audit) {
    var base = new Date(audit.debut);
    var items = [
      { quand: iso(addDays(base, -60)), qui: 'u1', quoi: 'Audit créé et périmètre défini' },
      { quand: iso(addDays(base, -40)), qui: 'u3', quoi: 'Plan d’audit validé en revue de direction' },
      { quand: iso(addDays(base, -15)), qui: 'u2', quoi: 'Convocations envoyées aux pilotes de processus' },
      { quand: iso(addDays(base, 0)), qui: 'u2', quoi: 'Réunion d’ouverture' },
    ];
    if (audit.statut !== 'Planifié' && audit.statut !== 'En préparation' && audit.statut !== 'Reporté') {
      items.push({ quand: iso(addDays(new Date(audit.fin), 0)), qui: 'u2', quoi: 'Réunion de clôture, ' + audit.nbConstats + ' constat(s) présenté(s)' });
      items.push({ quand: iso(addDays(new Date(audit.fin), 12)), qui: 'u1', quoi: 'Rapport reçu et diffusé' });
    }
    if (audit.statut === 'Clos') items.push({ quand: iso(addDays(new Date(audit.fin), 30)), qui: 'u1', quoi: 'Audit clos, plan d’actions arbitré' });
    if (audit.statut === 'Reporté') items.push({ quand: iso(addDays(base, -10)), qui: 'u1', quoi: 'Audit reporté à la demande du site' });
    return items;
  }

  /* ------------------------------------------------------------------ Agrégats prêts à l'emploi */
  function compterPar(liste, cle) {
    var r = {};
    liste.forEach(function (x) {
      r[x[cle]] = (r[x[cle]] || 0) + 1;
    });
    return r;
  }
  var echeances = CONSTATS.filter(function (c) {
    return c.statut !== 'Clos';
  })
    .concat(
      ACTIONS.filter(function (a) {
        return a.statut !== 'Terminée';
      }),
    )
    .map(function (x) {
      return { id: x.id, titre: x.titre, echeance: x.echeance, jours: daysUntil(x.echeance), responsable: x.responsable, genre: x.id.indexOf('ACT') === 0 ? 'Action' : 'Constat' };
    })
    .sort(function (a, b) {
      return a.jours - b.jours;
    });

  var KPI = {
    audits: AUDITS.length,
    auditsEnCours: AUDITS.filter(function (a) {
      return a.statut === 'En cours' || a.statut === 'Rapport attendu';
    }).length,
    auditsAVenir: AUDITS.filter(function (a) {
      return a.statut === 'Planifié' || a.statut === 'En préparation';
    }).length,
    constatsOuverts: CONSTATS.filter(function (c) {
      return c.statut !== 'Clos';
    }).length,
    ncOuvertes: NON_CONFORMITES.filter(function (c) {
      return c.statut !== 'Clos';
    }).length,
    actionsEnRetard: ACTIONS.filter(function (a) {
      return a.statut !== 'Terminée' && daysUntil(a.echeance) < 0;
    }).length,
    actionsTerminees: ACTIONS.filter(function (a) {
      return a.statut === 'Terminée';
    }).length,
    actions: ACTIONS.length,
    conformite: INDICATEURS[0].valeur,
    risquesEleves: RISQUES.filter(function (r) {
      return r.niveau >= 9;
    }).length,
    parStatutAudit: compterPar(AUDITS, 'statut'),
    parCriticiteNC: compterPar(
      NON_CONFORMITES.filter(function (c) {
        return c.statut !== 'Clos';
      }),
      'criticite',
    ),
    parStatutAction: compterPar(ACTIONS, 'statut'),
    parTypeConstat: compterPar(CONSTATS, 'type'),
    prochainesEcheances: echeances.filter(function (e) {
      return e.jours >= 0;
    }).slice(0, 8),
    echeancesDepassees: echeances.filter(function (e) {
      return e.jours < 0;
    }),
  };

  /* ------------------------------------------------------------------ Export global */
  window.FAKE = {
    aujourdhui: iso(TODAY),
    organisation: ORGANISATION,
    moi: MOI,
    utilisateurs: UTILISATEURS,
    sites: SITES,
    referentiels: REFERENTIELS,
    vocabulaire: {
      typesAudit: TYPES_AUDIT,
      statutsAudit: STATUTS_AUDIT,
      criticites: CRITICITES,
      typesConstat: TYPES_CONSTAT,
      statutsConstat: STATUTS_CONSTAT,
      statutsAction: STATUTS_ACTION,
      priorites: PRIORITES,
      typesEvenementRetex: TYPES_EVENEMENT_RETEX,
      gravitesRetex: GRAVITES_RETEX,
      mois: MOIS_12,
    },
    audits: AUDITS,
    constats: CONSTATS,
    nonConformites: NON_CONFORMITES,
    actions: ACTIONS,
    risques: RISQUES,
    indicateurs: INDICATEURS,
    evolution: EVOLUTION,
    incidents: INCIDENTS,
    kpi: KPI,
    echeances: echeances,
    /* Aides */
    utilisateur: function (id) {
      return UTILISATEURS.filter(function (u) {
        return u.id === id;
      })[0] || { nom: '—', initiales: '?' };
    },
    referentiel: function (id) {
      return REFERENTIELS.filter(function (r) {
        return r.id === id;
      })[0];
    },
    audit: function (id) {
      return AUDITS.filter(function (a) {
        return a.id === id;
      })[0];
    },
    constatsDe: function (auditId) {
      return CONSTATS.filter(function (c) {
        return c.auditId === auditId;
      });
    },
    actionsDe: function (auditId) {
      return ACTIONS.filter(function (a) {
        return a.auditId === auditId;
      });
    },
    historiqueAudit: historiqueAudit,
    fr: fr,
    frLong: frLong,
    daysUntil: daysUntil,
    slug: slug,
    compterPar: compterPar,
  };
})();

/* global window */
/* Scénario FICTIF, compatible avec les familles de DTO de claude/assistant-rssi.
   Aucun appel à Mistral, aucune donnée de l’organisation ni notification réelle. */
window.ASSISTANT_GLOBAL_DEMO = {
  reference: '575154f42a1c5d4ebe5ec218b7d18e2fae7b26a5',
  date: '2026-11-12',
  etat: {
    actif: true,
    pret: true,
    motif: null,
    fournisseur: 'api.mistral.ai',
    modele: 'mistral-small-latest',
    enPause: false,
    profils: [
      {
        id: 'mise_en_oeuvre',
        libelle: 'Mise en œuvre',
        perimetres: [{ id: 'demo-perimetre', nom: 'Pilotage de l’organisation' }],
      },
      {
        id: 'audit_interne',
        libelle: 'Audit interne',
        perimetres: [{ id: 'demo-perimetre', nom: 'Pilotage de l’organisation' }],
      },
    ],
  },
  conversations: [
    {
      id: 'demo-mise-en-oeuvre',
      profil: 'mise_en_oeuvre',
      titre: 'Point avant la revue de direction',
      etat: 'pret',
      createdAt: '2026-11-12T08:40:00+01:00',
      updatedAt: '2026-11-12T08:45:00+01:00',
      messages: [
        {
          id: 'demo-user-1',
          role: 'utilisateur',
          contenu: 'Avant la revue de direction, quel point mérite mon attention ?',
          sources: [],
          outils: [],
          erreur: false,
          createdAt: '2026-11-12T08:40:00+01:00',
        },
        {
          id: 'demo-answer-1',
          role: 'assistant',
          contenu:
            'Je commencerais par la revue des accès. Son échéance est dépassée et une réponse du responsable est attendue.\n\nUne proposition d’action est également prête à être examinée. Tu peux la compléter avant de décider.',
          sources: [
            { perimetre: 'demo-perimetre', objet: 'demo-action-acces', type: 'task', nom: 'Revue des accès' },
            {
              perimetre: 'demo-perimetre',
              objet: 'demo-preuve-acces',
              type: 'evidence',
              nom: 'Procédure de gestion des accès — fiche documentaire',
            },
          ],
          outils: [{ nom: 'lire_element', elements: 2 }],
          erreur: false,
          createdAt: '2026-11-12T08:45:00+01:00',
        },
      ],
    },
    {
      id: 'demo-audit',
      profil: 'audit_interne',
      titre: 'Préparer un audit interne',
      etat: 'pret',
      createdAt: '2026-11-12T08:30:00+01:00',
      updatedAt: '2026-11-12T08:30:00+01:00',
      messages: [],
    },
  ],
  notifications: [
    {
      id: 'demo-notification-question',
      smsiId: 'demo-perimetre',
      objectId: 'demo-action-acces',
      kind: 'assistant_question',
      title: 'Une précision sur la revue des accès',
      message: 'La revue des accès a-t-elle été réalisée ? Si oui, quelle preuve permet de le vérifier ?',
      reponse: null,
      avis: null,
      readAt: null,
    },
    {
      id: 'demo-notification-rappel',
      smsiId: 'demo-perimetre',
      objectId: 'demo-action-acces',
      kind: 'assistant_rappel',
      title: 'Revue des accès à suivre',
      message: 'L’action est échue depuis le 10 novembre. Un rappel vous a été adressé par l’assistant.',
      reponse: null,
      avis: null,
      readAt: null,
    },
  ],
  propositions: [
    {
      id: 'demo-proposition',
      profil: 'mise_en_oeuvre',
      perimetre: 'demo-perimetre',
      type: 'action',
      titre: 'Organiser la revue des accès avec le responsable',
      description: 'Préciser les accès à revoir, le responsable et la preuve attendue avant de clôturer le point.',
      echeance: '2026-11-20',
      sourceNom: 'Revue des accès',
      etat: 'en_attente',
      decidedBy: '',
      decisionNote: '',
      objetCree: null,
      createdAt: '2026-11-12T08:45:00+01:00',
    },
  ],
};

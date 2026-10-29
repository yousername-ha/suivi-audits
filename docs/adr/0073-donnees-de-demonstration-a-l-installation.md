# ADR 0073 — Données de démonstration proposées à l'installation

- Statut : proposée (numéro à confirmer par le RSSI)
- Date : 2026-10-28
- Contexte : le jeu de données fictif existait déjà (`suivi jeu-de-test`) mais ne couvrait ni les référentiels réels (ISO 27001, HDS) ni EBIOS RM, et se chargeait seulement en ligne de commande. Le RSSI demande de le proposer au premier lancement, construit comme une vraie démarche ISO 27001 / HDS et alimentant l'étude EBIOS RM, sans rien inventer de normatif.

## Décision

1. **Case facultative, décochée par défaut** sur la page d'installation initiale. Sans coche, les données de départ restent vides (inchangé).
2. **Établissement de santé entièrement fictif** : aucun nom réel, aucun compte supplémentaire (les responsables sont des fonctions, sans identifiant ni mot de passe de démonstration).
3. **Contenu** : l'état de pilotage (contexte, processus, objectifs, indicateurs, parties intéressées, fournisseurs, plans, revue de direction), les référentiels **ISO/IEC 27001:2022** et **HDS** de la bibliothèque rattachés au pilotage commun avec une couverture par exigence et la déclaration d'applicabilité, une méthode de risque, et une **étude EBIOS RM complète** : valeurs métier, biens supports, événements redoutés, sources de risque et couples source/objectif, parties prenantes, scénarios stratégiques et opérationnels, risques appréciés, traitements rattachés à des mesures de l'Annexe A et à des actions, ateliers 1 à 5 validés, un risque accepté formellement. Les intitulés viennent des référentiels déjà livrés (aucun texte normatif reproduit) ; niveaux, dates et scénarios sont des exemples, signalés « fictif » ou « démonstration ».
4. **Chargement par l'API publique**, mêmes validations que l'interface, au nom de l'administrateur créé. Comme l'API exige un second facteur actif, la demande est mémorisée (réglage `demo_en_attente`) à la création du compte puis exécutée **une seule fois, à la fin de l'enrôlement du second facteur**. La demande est consommée avant l'exécution : un échec ne se rejoue pas.
5. **Un échec ne bloque jamais l'installation** : il est journalisé (`setup.demo_failed`, avec la cause) et signalé à l'écran ; un succès l'est aussi (`setup.demo_loaded`).
6. Les requêtes du chargement portent une adresse source qui change tous les 300 appels, pour ne pas épuiser la limite par adresse d'une instance réglée bas.
7. Pour retirer la démonstration : Administration, Remettre la base à vide ([ADR 0065](0065-remise-a-vide-de-la-base.md)).

## Conséquences

- Le chargement n'est pas transactionnel : en cas d'interruption, la base peut contenir une démonstration partielle ; la remise à vide permet de repartir.
- Le chargement dure environ 30 secondes en base locale et se fait pendant la confirmation du second facteur.
- Les modules annexes sont alimentés de la même façon (`apps/api/src/demo-annexes.ts`) : cinq incidents (dont un incident de sécurité ouvert avec ses obligations), un budget d'investissement sur trois ans avec deux options comparables, cinq revues des accès (une par état), la cellule de crise (contacts, deux scénarios, un exercice clôturé), le CRRC (trois établissements partenaires fictifs dont l'identifiant FINESS est volontairement irréel, « 99-FICTIF-nn », cinquante sauvegardes, deux restaurations, deux alertes) et le GAP (une application et les usages de l'IA par questionnaire guidé, une application saisie à la main). Le plan d'actions du GAP guidé ajoute un écart au registre. Dates et montants sont relatifs au jour du chargement ou d'exemple.
- Le registre des usages de l'IA n'est pas alimenté : il n'a pas de route d'écriture unitaire.
- Hypothèse de construction à valider : la démonstration décrit un établissement qui héberge le dossier patient pour ses établissements partenaires, ce qui rend les exigences HDS applicables.

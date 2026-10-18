# 018 — Timeline des tâches récurrentes

**Candidate UI/UX v002 — 18 octobre 2026 — à valider.** Style 08 conservé. Cette maquette permet de tester les interactions ; elle n'est pas raccordée au serveur métier.

[Télécharger le ZIP](ASTRA-018-timeline-validations-v002.zip) · [SHA-256](ASTRA-018-timeline-validations-v002.zip.sha256) · [Contrat d'intégration préparatoire](TECHNIQUE-MAQUETTE.md) · [Recette exécutée](technique/recette.json).

Extraire tout le ZIP puis lancer **DEMARRER.bat**, ou ouvrir `index.html`. Aucun Node, Python ou serveur n'est nécessaire pour l'essai utilisateur. Navigateur récent requis pour le stockage et les empreintes de fichiers. Le BAT n'a pas été exécuté nativement sous Windows ; recette sous Chromium Linux, via localhost.

## Parcours proposé

1. Sur la timeline, choisir une occurrence. Les vues **Semaine/Mois**, les filtres et la liste sont utilisables. Le jeu fictif couvre octobre 2026 ; aucune occurrence n'est inventée en dehors de cette période.
2. Dans le panneau latéral, choisir **OK**, **KO** ou **NA — Non applicable** et, si nécessaire, commenter. Aucun résultat n'est présélectionné.
3. Associer une preuve existante du même périmètre ou déposer un fichier fictif PDF, PNG, JPG ou TXT de 2 Mo maximum. La preuve reste **facultative dans cette proposition**, en attendant la décision utilisateur.
4. Vérifier le récapitulatif puis confirmer. La personne et l'heure sont renseignées automatiquement. Le responsable prévu reste distinct de la personne ayant validé.
5. La validation devient consultable en lecture seule ; ce parcours ne propose ni modification ni suppression. Les autres occurrences restent indépendantes.
6. La preuve se retrouve dans le **registre des preuves** : fichier téléchargeable, version, auteur, date et lien retour vers les validations. Réutiliser la même preuve ne crée pas de copie ; le même fichier sur le même périmètre est reconnu par son empreinte SHA-256.
7. Le **journal** permet de consulter et exporter les résultats, acteurs, dates et preuves du jeu local.

Annuler avant confirmation ne crée ni preuve ni validation. Une seconde validation de la même occurrence est refusée. En cas de stockage plein ou de révision obsolète, aucun succès n'est affiché. Les textes saisis sont affichés comme texte, pas comme HTML.

## Aperçus sur GitHub

| Vue | Aperçu |
| --- | --- |
| Timeline mensuelle | [01 — Vue d'ensemble](images/01-timeline-mensuelle.png) |
| Saisie OK / KO / NA et preuve | [02 — Panneau de validation](images/02-panneau-validation.png) |
| Validation nominative conservée | [03 — Lecture seule](images/03-validation-enregistree.png) |
| Récapitulatif avant confirmation | [04 — Résultat KO](images/04-confirmation-resultat-ko.png) |
| Version de preuve et liens inverses | [05 — Fiche de preuve](images/05-fiche-preuve-et-tracabilite.png) |
| Preuves centralisées | [06 — Registre des preuves](images/06-registre-des-preuves.png) |
| Historique des validations | [07 — Journal](images/07-journal-validations.png) |
| Petit écran | [08 — Vue mobile](images/08-timeline-mobile.png) |

## Ce qui est simulé

L'identité de session « Camille Martin — RSSI » est fictive ; elle n'est pas une authentification. L'horloge est celle du navigateur. Le verrouillage est celui du parcours local : les données du navigateur peuvent être effacées ou altérées hors de l'interface. **Cette maquette ne garantit donc pas l'irréversibilité serveur.** Le contrat préparatoire indique les garanties nécessaires à l'application intégrée.

La preuve est ici conservée dans la sauvegarde du navigateur. Ce stockage de démonstration n'est pas le registre documentaire de production. Le jeu initial contient deux fichiers TXT fictifs sans empreinte calculée, signalés comme tels ; les fichiers déposés par l'utilisateur reçoivent une empreinte calculée sur leurs octets.

La candidate ne crée pas de séries, ne modifie pas leur cadence et ne remplace pas le moteur de récurrence existant. Les autres rubriques du menu sont hors de ce prototype. Aucun fichier de Claude ni aucune cartographie dynamique n'est modifié. La version v001 reste conservée ; aucune validation utilisateur ni promotion du dossier n'est déduite des tests.

Pour rejouer les contrôles : `node technique/parcours.cjs` avec Playwright et Chromium installés (`CHROMIUM_EXECUTABLE` optionnel). Le script sert ce dossier sur localhost, écrit son rapport et les huit captures. `MAQUETTE_ROOT` peut viser une extraction du ZIP. Les 22 contrôles couvrent le parcours, les preuves, les refus, les erreurs de stockage, les libellés et le mobile ; ils ne constituent pas une certification d'accessibilité ou un test du backend.

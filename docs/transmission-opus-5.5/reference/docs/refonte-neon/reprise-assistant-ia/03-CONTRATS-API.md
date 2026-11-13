# Contrats de raccordement

Référence lue : `claude/assistant-rssi@460060a1e3b3597556bba0d64633d13146982c2b`, 12/11/2026. Revalider ces contrats sur la branche cible courante ; cette fiche n’est pas un nouveau protocole. Les formes TypeScript consommées sont dans `sources/apps/web/src/assistant/contrats.ts`.

| Fonction | API existante | Règle |
| --- | --- | --- |
| État | `GET /api/assistant/etat` | `actif`, `pret`, `motif`, `fournisseur`, `modele`, `profils` et leurs périmètres, `jetonsDuJour`, `budgetJetonsJour`, `enPause`. Fournisseur effectif affiché en permanence. |
| Liste/création | `GET/POST /api/assistant/conversations` | Création strictement `{profil}` ; profil `mise_en_oeuvre` ou `audit_interne`. |
| Fil/suppression | `GET/DELETE /api/assistant/conversations/:id` | Profil immuable, état `pret`/`en_cours`, messages du serveur. Confirmation avant suppression. |
| Message | `POST /api/assistant/conversations/:id/messages` | Corps strict `{texte}`, 4000 caractères maximum, contexte visible inclus dans cette limite. Pas de nouveau champ `context`. |
| Attente | Relecture du fil toutes les 1500 ms pendant `en_cours` | Pas de streaming ni de route d’annulation supposés. La réponse reste dans son fil d’origine. |
| Sources | `SourceAssistant {perimetre,objet?,type?,nom}` | Métadonnées, aucun extrait/page/version/confiance inventé. Les messages sont du texte React, pas du HTML exécutable. |
| Notifications propres | `GET /api/grc/notifications` | Garder `assistant_question` et `assistant_rappel`. Les notifications n’ont pas de profil. Utiliser l’identité/destinataire vérifiés par le serveur. |
| Réponse à sa question | `PUT /api/grc/notifications/:id/reponse` | `{texte}`, 2000 caractères max. Le droit assistant n’est pas exigé pour répondre à sa propre notification ; le serveur vérifie le destinataire. Reprise lors d’une prochaine ronde. |
| Lecture/avis | `PUT /api/grc/notifications/:id/read`, `PUT /api/grc/notifications/:id/avis` | Pour l’avis : `{avis:'utile'|'inutile'}`. Conserver les erreurs et réconcilier avec l’état serveur. |
| Propositions | `GET /api/assistant/propositions` | `type:'action'|'constat'`, profil, nature éventuelle et avertissement `sourceIssueAssistant`. |
| Décision | `POST /api/assistant/propositions/:id/decision` | `{decision:'confirmer'|'rejeter',titre?,description?,echeance?,note?}`. Titre 200, description 2000, note 500 max ; date `AAAA-MM-JJ` ou null. Un rejet peut envoyer seulement décision/note. |
| Mission de suivi | `GET/POST /api/assistant/missions` | Création `{profil,consigne}`, 2000 caractères max. Traitement aux prochaines rondes ; pas d’heure/date de rappel garantie. |

## Disponibilité, droits et décisions

`assistant:lire` permet les API de discussion. `assistant:modifier` conditionne les décisions et missions. Les périmètres autorisés du profil sont l’intersection serveur des droits et réglages, pas un accès à toute l’organisation. Le filtrage du menu ou la présence d’un bouton ne valent jamais garde.

Le frontend de refonte lit les permissions comme des chaînes pour rester compatible avec une branche dont le schéma partagé ne contient pas encore le module. Dans la branche assistant, utiliser les types et gardes client existants lorsque possible, tout en laissant les contrôles serveur en place.

**`enPause` concerne les rondes et laisse le chat disponible.** La consommation et le budget viennent du serveur ; leurs limites et les erreurs de réponse sont traitées séparément. Sans service disponible, aucun chat local ou résultat de démonstration ne doit le remplacer.

Une proposition confirmée crée son objet via le service existant, au nom et avec les droits de la personne. Un constat reste **en brouillon**, sans validation/publication d’audit. Aucun identifiant d’objet créé ne doit être fabriqué côté UI.

## Services à conserver

Le backend existant, ses clés/configuration, ses migrations, les extractions/indexations qu’il possède et ses droits restent la source de vérité. Le panneau ne remplace pas les réglages, rondes, mémoire, méthodes, supervision et historiques existants.

`GET /api/assistant/questions` est une vue de supervision ; ce n’est pas la route de réponse du destinataire. Une source jointe dans le texte n’est pas un document vérifié. Les visuels/fixtures de ce paquet n’attestent ni un RAG documentaire, ni une extraction de PDF, ni un appel Mistral réel.

Utiliser le client API du dépôt : cookie de session, CSRF pour les mutations, gestion des refus, cache et invalidations. Ne pas insérer de clé de modèle, cookie ou identifiant sensible dans le frontend, ce dossier ou les preuves.

# Assistant RSSI — raccordement à la version réelle

Le demandeur indique avoir connecté Mistral sur la branche Assistant RSSI. La refonte locale fournit le frontend global et son identité Neon ; elle n’a pas fusionné le backend distant. La branche distante a évolué depuis l’examen du contrat historique. **Rechercher et réutiliser le service déjà présent dans la cible avant de toucher au raccordement.**

## À conserver visuellement et fonctionnellement

Lanceur global dans toute la plateforme authentifiée, avatar SVG net/HD, cadre cyan/bleu plus présent, discussion en panneau stable, historique, profils, brouillons et boîte personnelle « Pour vous ». Conserver la discussion quand on navigue ; ne pas ajouter un menu métier Assistant ni deux chats concurrents en gardant simultanément l’ancien écran d’administration.

Contexte visible et figé lorsqu’il est joint, profils distincts, sources réelles des DTO, disponibilité/fournisseur effectifs, questions et rappels personnels, réponses, avis, propositions examinées et missions. Le design ne vaut pas droit de modifier silencieusement une action ou un constat. Maintenir les confirmations et gardes du service existant.

Avatar : `IdentiteAssistant.tsx` et `neon-assistant.css`, gradients à IDs uniques par instance, sans filtre diffus ni image floue. Repères internes/bordures présents, circuit lent et clignement léger, pause et mouvement réduit. Fichiers SVG et PNG 1024 de référence inclus dans l’atlas/les sources.

## Contrats : historiques, à rapprocher des DTO actuels

Le détail initial est dans [le dossier Assistant historique](reference/docs/refonte-neon/reprise-assistant-ia/03-CONTRATS-API.md) et [le frontend intégré](reference/docs/refonte-neon/ASSISTANT-RSSI-GLOBAL-INTEGRE.md). Il s’agit d’un contrat observé à une révision, pas d’une API à imposer à la cible.

| Sujet historique                | Vérification requise dans la cible                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/assistant/etat`       | Champs de disponibilité, profils, fournisseur, modèle, quota, pause et permissions réels                                  |
| Conversations/fils/messages     | DTO, pagination/streaming s’ils ont évolué, état serveur et limites réelles ; ne pas rétablir un ancien corps de requête  |
| Contexte de page                | Modalité réellement prise en charge, visible pour la personne, limites et sources préservées                              |
| Notifications/questions/rappels | Identité du destinataire vérifiée côté serveur ; ne pas confondre notification personnelle et profil de chat              |
| Réponses aux questions et avis  | Reprise, erreurs, lecture et états réconciliés selon le vrai contrat                                                      |
| Propositions et missions        | Flux de confirmation, brouillon de constat, droits et journalisation existants                                            |
| `enPause` historique            | Suspendait les rondes, pas le chat ; vérifier la sémantique actuelle et ne pas la remplacer par un simple disabled global |

`apps/web/src/assistant/contrats.ts` est un pont utilisé dans la référence non fusionnée. Si la cible possède déjà ses types dans `@suivi/shared` ou ailleurs, importer ceux de cette cible et garder uniquement les adaptateurs de présentation nécessaires. Ne pas créer un deuxième module/table/service de conversation.

## Documents, RAG et Mistral réels

La connaissance des documents et du contexte est une capacité annoncée par le demandeur ; les captures UI ne la prouvent pas. Vérifier indexation/extraction, contrôle d’accès aux documents et périmètres, citations des sources, isolation de la personne et de l’organisation, questions/rappels et calendrier réels. Ne pas afficher un document de démonstration comme preuve du RAG réel. Aucune clé de modèle ne doit parvenir au frontend ou au dossier.

Exercer la recette Mistral/API/DB seulement dans l’environnement de test autorisé du dépôt cible ; conserver ses gardes et ses tests. Distinguer clairement résultats du frontend intercepté et recette du service réel. Les anciennes captures et suites à réponses fictives restent des preuves de présentation/contrat, jamais d’un moteur IA effectif.

Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

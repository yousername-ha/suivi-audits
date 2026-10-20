# 012 — Paramètres système et plateforme : dossier d’implémentation

Édition du 20 octobre 2026. **Périmètre approuvé pour transmission au codage**, sous contrôle préalable de l’existant. Référence de conception : [v007-echelles-partagees](../maquettes/v007-echelles-partagees/README.md). Aucun statut « implémenté » ni validation serveur revendiqué.

## Instruction obligatoire avant développement

Lire [Contrôle de l’existant et consignes de codage](../../_dossiers-transversaux/implementation-ui-2026-10/CONTROLE-EXISTANT-ET-CODAGE.md). Pour chaque exigence ci-dessous, vérifier la branche/SHA cible et renseigner preuve, état et écart. **Si c’est déjà implémenté et vérifié, conserver l’existant.** Ne coder que le manque ; aucune reconstruction sur la seule base d’une ancienne maquette ou documentation.

## Demandes, règle retenue et recette

Ces lignes consolident les remarques utilisateur applicables au périmètre. Les précisions d’intégrité, d’erreur et d’accessibilité complètent leur traduction technique. Les propositions non confirmées figurent dans les limites ci-dessous ; elles ne deviennent pas des règles normatives implicites.

| ID | Demande / sujet | Règle retenue pour l’intégration | Critère à vérifier sur la cible |
| --- | --- | --- | --- |
| 012-01 | Deux pages à cartes avec icône et nom | Séparer exploitation système et configuration de la plateforme ; détails dans des fenêtres centrales, contenues et à bordure visible. | Parcours clair dans les deux pages ; pas de formulaire global illisible. |
| 012-02 | Sauvegarde et mise à jour | Planification/rétention/historique, préparation et suivi d’opération ; restauration distincte avec copie et impact ; version installée/disponible. | États attente/échec/succès/annulation réels, refus et reprise ; aucune fausse réussite à réception 202. |
| 012-03 | Stack technique et statistiques | Versions des composants, capacité/utilisation disque, base/pièces/journaux ; fraîcheur et source des métriques. | Indisponibilité affichée ; chiffres issus du service réel. |
| 012-04 | Trois modes de certificat | Importer certificat/chaîne/clé ; autosigné ; Let’s Encrypt ou ACME. Contrôler domaines, échéance, chaîne et capacités du service. | Prévisualisation, confirmation, erreur et conservation du certificat actif ; secrets absents des logs. |
| 012-05 | Deux styles globaux | Sauge et Clair, choix administrateur appliqué à tous. Préserver l’identité Normand’e-Santé visible mais discrète. | Aucun réglage local divergent ; accessibilité dans les deux thèmes. |
| 012-06 | Échelles et utilisateurs/groupes/droits | Entrées sur les composants 019 et 022 ; aucun catalogue ou annuaire concurrent. | Modifier une échelle dans configuration puis la sélectionner dans une étude. |
| 012-07 | Nettoyage automatique configurable | Activation globale et par catégorie, délai pour justificatifs/écarts clos/actions terminées ; distinguer archive, corbeille et purge optionnelle. | Prévisualisation et motifs d’exclusion ; durées de démonstration non imposées. |
| 012-08 | Cohérence des suppressions imbriquées | Vérifier références directes/indirectes, cycles, enfants, versions, fichiers partagés et conservation ; recontrôle atomique au traitement. | Un lien ajouté après aperçu bloque la suppression ; aucun fichier encore utilisé supprimé. |
| 012-09 | Contact technique | Destinataire dédié pour sauvegarde échouée, disponibilité/échec de mise à jour et alertes d’exploitation. | Contact technique exclu des rappels métier sauf affectation métier indépendante. |
| 012-10 | Notifications métier sur groupe ou profil | Actions, récurrences et rapports réglés dans ces contextes ; canaux/fréquences selon capacités ; audience filtrée par droits. | Personne sans accès exclue ; canal partagé non autorisé ne reçoit pas de contenu sensible. |
| 012-11 | Envoi mail et Teams | Profils SMTP/SMTPS pour Exchange Server, Exchange Online, Postfix ; Teams Workflow, propriétaire et destination ; identifiants protégés côté serveur. | Validation des paramètres, échec auth/TLS/envoi, suivi ; un test réel requiert une destination d’essai autorisée. |
| 012-12 | Télécharger les journaux | Traçabilité et journaux techniques distincts, dates/recherche/utilisateur ou service/niveau ; formats adaptés et export autorisé. | Export filtré complet ou limite explicite, permissions, absence de secrets, export lui-même tracé. |
| 012-13 | Niveaux Info / Warning / Debug | Seuil technique uniquement ; erreurs toujours collectées ; journal d’audit indépendant ; durée de Debug proposée et état réellement appliqué. | Changer le seuil ne supprime pas les anciens logs et ne désactive pas la traçabilité. |
| 012-14 | Calendriers plateforme | Configurer imports iCal scolaires et jours fériés distincts ; les tâches réutilisent ces sources. | Erreur/import répété sans perte ; pas de calendrier scolaire présenté comme inventaire des jours fériés. |

## UI/UX, composants et références

Conserver les états et visuels de la [maquette de référence](../maquettes/v007-echelles-partagees/README.md) et les composants natifs déjà conformes. La règle commune de style 08 et de défilements s’applique ; ne pas recopier globalement les CSS de prototype. Prévoir chargement, vide, recherche sans résultat, refus d’accès, erreur réseau, conflit de version et confirmation lorsqu’une opération le nécessite. Contrôles et actions accessibles au clavier, focus explicite, légendes textuelles, écrans étroits et thèmes Sauge/Clair.

Documents complémentaires à lire :

- [PARAMETRES-SYSTEME-PLATEFORME.md](PARAMETRES-SYSTEME-PLATEFORME.md).
- [ECHELLES-PLATEFORME.md](../../003-ebios-rm/implementation/ECHELLES-PLATEFORME.md).

## Architecture et contrats à réutiliser

Le relevé détaillé conserve les routes vérifiées au SHA 284cb1e : admin/systeme, admin/info, sauvegardes, admin/exploitation, updates, config-grc, settings et admin/audit. Auditer les capacités et l’exécutant réel ; une demande acceptée ne signifie pas opération terminée. SMTP/Teams, ACME, politiques de nettoyage et préférences fines ne sont pas réputés absents ou opérationnels sans nouvelle vérification.

020 pour la coque ; 019 pour les configurations ; 022 pour les habilitations ; services d’exploitation existants.

Les modèles/réponses/API réels restent autoritaires. Identifier les composants, queries et mutations existants, conserver les IDs, versions et droits. Les fixtures ne remplacent pas les schémas partagés. Après mutation réussie, actualiser les vues liées sans création en double ; en erreur conserver les saisies. Toute migration doit préserver données et historiques et avoir une reprise documentée.

## Limites et décisions à expliciter

Ne pas inventer CPU, disque, succès de sauvegarde ou renouvellement. La priorité des préférences individuelles sur les groupes et le Debug temporaire sont des propositions d’UX : vérifier les politiques existantes et signaler toute décision nouvelle. La livraison documentaire ne déclenche aucun envoi, TLS, restauration, purge ou déploiement.

Ces points sont à établir par le contrôle du code courant ou à signaler comme décision manquante. Ils n’autorisent ni invention de méthode normative, ni extension silencieuse des droits, ni annonce d’une capacité non vérifiée. Le code disponible chez Claude n’est consulté qu’en lecture seule ; toute adaptation autorisée se fait sur la branche propre de l’IA de codage.

## Ordre, recette et remise

1. Auditer chaque exigence et les dépendances ; rendre le relevé d’existant avant de modifier.
2. Conserver les comportements satisfaisants et réutiliser leurs composants. Adapter lecture/navigation, puis formulaires et commandes effectivement supportées, puis relations entre modules.
3. Exécuter les critères du tableau sur données synthétiques, les contrôles métier et permissions côté serveur, puis typage/build/lint/tests pertinents et non-régressions UI. Les résultats de [tests historiques](../tests/README.md) ne sont pas une preuve d’intégration actuelle.
4. Livrer branche/SHA, écarts traités, tests, visuels et limites ; utiliser le marqueur uniquement selon les consignes communes, après intégration réelle vérifiée.

[Prompt dédié](PROMPT-IMPLEMENTATION.md). Le classement « à implémenter » transmet ce dossier à l’IA ; il ne signifie pas que tout doit être recodé ni que la maquette contient déjà tous les services.

## Références graphiques complémentaires à conserver

- [v002-deux-espaces](../maquettes/v002-deux-espaces/README.md).
- [v003-echelles-certificats](../maquettes/v003-echelles-certificats/README.md).
- [v004-historique-conservation](../maquettes/v004-historique-conservation/README.md).
- [v005-notifications-dependances](../maquettes/v005-notifications-dependances/README.md).
- [v006-journaux-exports](../maquettes/v006-journaux-exports/README.md).
- [v007-echelles-partagees](../maquettes/v007-echelles-partagees/README.md).

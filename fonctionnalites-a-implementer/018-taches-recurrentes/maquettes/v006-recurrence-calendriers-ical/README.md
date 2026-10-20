# 018 — Récurrence personnalisée et calendriers iCal

**Proposition visuelle v006 à valider. Six images, aucun ZIP ni BAT.** Aucun import de production, moteur de report ou sauvegarde métier n’est annoncé comme opérationnel. Les sources servent au rendu des visuels ; quelques interactions illustratives sont présentes.

| Vue | Image |
| --- | --- |
| Configuration commune de la plateforme | [Calendriers et jours exclus](images/01-configuration-calendriers.png) |
| Examen du flux scolaire fourni | [Aperçu d’import](images/02-apercu-import-scolaire.png) |
| Source distincte pour les jours fériés | [URL ou fichier iCal](images/03-import-jours-feries.png) |
| Fréquence, fenêtre et exclusions | [Récurrence personnalisée](images/04-recurrence-personnalisee.png) |
| Vacances couvrant toute la fenêtre | [Conflit à arbitrer](images/05-conflit-vacances-fenetre.png) |
| Configuration sur petit écran | [Mobile](images/06-calendriers-mobile.png) |

## Fonctionnement prévu

- Personnalisée : tous les N jours/semaines/mois/années ; jours de semaine ; ancrage ; fin par date ou nombre d’occurrences. Pour le mensuel, prévoir jour du mois ou rang du jour (dernier mardi, etc.), avec traitement explicite des dates inexistantes.
- Fenêtre : jours calendaires ou jours autorisés, sans confondre durée et fréquence. Les exclusions s’appliquent aux dates candidates et à la possibilité réelle de réaliser dans la fenêtre.
- Calendriers partagés dans la configuration de la plateforme ; fichiers ou URL iCal, portée géographique et périmètres. Vacances scolaires et jours fériés sont deux sources distinctes. Une zone par périmètre, héritage explicite et résolution des conflits multi-périmètres avant activation.
- Au niveau de la tâche : activer séparément vacances, jours fériés et week-ends. Importer une source ne réorganise pas les tâches sans décision.
- Reporter, avancer ou ignorer avec trace : **règle par défaut non choisie**, question utilisateur en attente. Tout déplacement hors fenêtre doit être signalé et arbitré. Ignorer une occurrence ne produit pas automatiquement NA.
- Conserver les occurrences et validations passées. Présenter dates initiales, propositions, motifs, conflits et version de calendrier ; ne jamais fusionner silencieusement deux occurrences qui arrivent le même jour après report.

## Source réellement lue

[Flux fourni](https://fr.ftp.opendatasoft.com/openscol/fr-en-calendrier-scolaire/Zone-A-B-C-Corse.ics), consulté le 18 octobre 2026 : HTTP 200, 244 VEVENT, cinq événements avec DTSTART = DTEND. Les `LOCATION` regroupent parfois plusieurs zones (A/B/C/Corse) ; ne pas appliquer tous les événements à toutes les zones.

L’événement Toussaint 2026 commence le 17 octobre et a un DTEND du 2 novembre **exclusif**, soit exclusion jusqu’au 1er novembre inclus. Il recouvre intégralement la fenêtre du 18 au 31 octobre. Le 2 novembre proposé est hors de cette fenêtre ; le 16 octobre est aussi hors fenêtre et déjà passé au jour de démonstration. Ces dates ne sont pas appliquées automatiquement.

Le flux contient aussi des événements de prérentrée et des durées nulles. Ils doivent être examinés avant de produire des exclusions ; aucune durée n’est inventée. Ses dates extrêmes ne prouvent pas la couverture complète d’une zone ou d’une année. Il ne constitue pas une source dédiée aux jours fériés, qui reste à fournir. Aucun fichier réel de jours fériés n’a été inventé.

[Relevé et empreinte de la source](technique/source-verifiee.json) · [Contrôles des visuels](technique/verification-visuels.json).

## À intégrer après validation

Réutiliser le moteur `SeriesData.recurrence` de Claude, consulté en lecture seule dans la référence 284cb1e4ffbaee37e0952073db5659c2257c888e. La recherche ciblée dans `packages/shared/src` et `apps/api/src` n’a pas identifié d’import iCal/exclusions scolaires ; cela ne prouve pas leur absence dans toutes les versions. Vérifier à nouveau la branche de référence avant de coder, sans créer de contrat concurrent. Aucune modification Claude.

L’import réel exige un parseur iCalendar éprouvé : lignes repliées, champs échappés, DATE/DATE-TIME, TZID/UTC et Europe/Paris, DTEND exclusif, DURATION, RRULE/RDATE/EXDATE, RECURRENCE-ID, annulations et mises à jour. Les RRULE du VTIMEZONE ne sont pas des occurrences de vacances. `TRANSP:TRANSPARENT` ne suffit pas à décider si un événement doit exclure un jour : la catégorie et la sélection utilisateur commandent cette règle.

Importer en prévisualisation puis activation atomique et versionnée, avec erreurs par événement, rapprochement source/UID/RECURRENCE-ID, doublons et couverture par zone/année. En cas d’identifiants instables, proposer une comparaison explicite, jamais une déduplication aveugle. Une actualisation impacte seulement le futur après revue ; conserver les versions des décisions et validations. Un calendrier expiré, inconnu ou indisponible doit être visible et ne pas être assimilé à une période sans vacances.

Les URL seront récupérées côté serveur sous droits administrateur, avec taille/durée bornées et contrôle des destinations/redirections pour empêcher l’accès au réseau interne. Traiter libellés et descriptions comme du texte ; ne pas charger les liens ou pièces embarqués. Fichier local et URL utilisent la même prévisualisation. Ce sont des exigences d’intégration, pas des garanties du visuel HTML.

Recette future : plusieurs zones, chevauchements, années bissextiles et jours inexistants, changements d’heure, calendrier incomplet, exclusions couvrant toute la fenêtre, report au-delà de la fin de série, deux occurrences reportées sur une même date, mise à jour iCal sans réécriture des traces et permissions administrateur.

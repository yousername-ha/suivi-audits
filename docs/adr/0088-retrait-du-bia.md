# ADR 0088 — Retrait de l'analyse d'impact sur l'activité (BIA)

- Statut : acceptée (décision du RSSI du 12/11/2026 ; numéro annoncé et accepté dans la session, le 0086 étant pris par l'ADR
  « Assistant RSSI intégré » de la branche `claude/assistant-rssi`)
- Date : 2026-11-12
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- Même logique que l'[ADR 0084](0084-retrait-des-modules-crrc-et-investissements.md) et l'[ADR 0087](0087-retrait-du-module-revues-des-acces.md),
  avec une différence : le BIA n'est pas un module à tables propres mais un **type d'objet natif** du Pilotage (`kind = 'bia'`).

## Contexte

Le RSSI demande de retirer le BIA (analyse d'impact sur l'activité : activité, scénario, durées d'interruption, impacts dans le
temps, objectifs de reprise). Les plans de continuité (PCA, PRA, PCRA) et les exercices **restent**.

## Décision

- **Le type d'objet `bia` disparaît** : définition et schéma (`BiaData`), libellé et rattachement au module, formulaire de saisie,
  règles de validation et d'approbation, liens autorisés avec les actifs, processus, plans et audits, export (`kind=bia` refusé),
  rapport imprimable, menu « Impacts sur l'activité — BIA », aide.
- **Compteurs** : les cartes de périmètre, la synthèse et le tableau de bord ne comptent plus que les plans PCRA
  (`continuite: { pcra }`, au lieu de `{ bia, pcra }`).
- **Aucune migration de données** : l'application n'est pas encore en production et sera réinstallée par le RSSI. Les fiches BIA
  d'une éventuelle instance de test, leurs versions et les décisions de validation (tables à historique immuable, que la base
  protège volontairement) ne sont ni supprimées ni archivées. **Une instance de test qui contient des fiches BIA doit être
  réinstallée** ; sur une installation neuve, il n'y en a pas.

## Ce qui n'est pas fait

- Aucune migration `058` : la règle « migrations additives » n'est pas dérogée, et les gardes d'immutabilité de la base ne sont pas
  contournées.
- Les plans de continuité existants qui citaient un BIA dans leurs références gardent cette référence textuelle, devenue sans cible.
  Sans objet sur une installation neuve.

## Conséquences

Moins de code à maintenir (type, formulaire, règles, compteurs). L'API change de forme : `continuite` ne porte plus que `pcra`.
Les captures de référence des écrans qui affichaient le compteur ou la rubrique BIA sont régénérées dans le conteneur Playwright de la CI.

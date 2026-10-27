# ADR 0049 — Courriel SMTP/SMTPS envoyé par l'exécutant d'exploitation

- Statut : acceptée
- Date : 2026-10-25
- Contexte : décision 1 du 25/10/2026 (dossiers 012-09 à 012-11) ; [ADR 0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md) (l'application n'a pas d'accès Internet) ; exigence de l'utilisateur : **tout se configure depuis l'interface, aucun fichier à modifier**.

## Décision

- **Canal unique : SMTP ou SMTPS.** Teams et les autres canaux sont au [fichier d'idées](../08_PILOTAGE/IDEES.md). Pas d'échange sans chiffrement : STARTTLS (le serveur doit le proposer, sinon l'envoi est refusé) ou TLS implicite. Le certificat du serveur est toujours vérifié ; un relais interne à autorité privée se règle en collant le certificat PEM de l'autorité dans l'interface. Authentification PLAIN ou LOGIN en UTF-8 ; XOAUTH2 n'est pas pris en charge.
- **Tout est dans l'interface** (Administration, Configuration système, Courriel) : activation, hôte, port, chiffrement, compte, mot de passe, adresse d'expédition, contact technique, autorité de certification, message de test. Droit `parametres:administrer`. Aucun fichier de composition, aucune variable d'environnement, aucune règle réseau à poser pour l'application.
- **L'API n'envoie rien et n'obtient aucun accès réseau sortant.** Elle met la demande en file (`courriel_jobs`, migration 040). L'**exécutant d'exploitation du serveur** (`scripts/exploitation-worker.py`, déjà installé pour les sauvegardes et les certificats) réclame la demande par la CLI (`suivi mail-claim`), lance `scripts/courriel-envoi.py` sous un compte sans privilège (65534), dans un interpréteur isolé, avec un délai, puis rapporte le résultat (`suivi mail-finish`). L'envoi a lieu à son prochain passage, en général en moins d'une minute.
- **Mot de passe** scellé par le coffre (AES-GCM), enregistré à part (`settings`, clé `secret:courriel`), écriture seule : jamais relu, jamais dans les valeurs de la section, les réponses, la trace du test ni le journal d'audit. Il ne quitte l'API que pour l'exécutant, par la CLI.
- **Message de test réel** (`POST /api/settings/courriel/test`) : il ne part que vers le contact technique configuré, une seule demande à la fois, cinq essais par dix minutes et par compte. Sans exécutant disponible, la demande est refusée avec une explication. La trace dit étape par étape ce qui a marché (connexion, chiffrement, accueil, authentification, acceptation) et, en cas d'échec, pourquoi (hôte introuvable, connexion refusée, certificat refusé, identifiants refusés…).

## Ce qui n'est pas fait

- Aucun courriel n'est envoyé automatiquement : ni rappel métier, ni alerte de sauvegarde ou de mise à jour. Le contact technique est enregistré et reçoit le message de test ; brancher les alertes d'exploitation sur la file est une étape suivante.
- Pas de XOAUTH2 (Exchange Online avec authentification moderne), pas de nouvelle tentative automatique.
- Le serveur hôte garde la maîtrise de son pare-feu : si l'exécutant ne peut pas joindre le relais SMTP, le test échoue avec l'explication correspondante.
- Rien n'est testé contre un serveur réel : les tests utilisent un faux serveur SMTP local (TLS implicite, STARTTLS, serveur sans STARTTLS, certificat inconnu, mauvais mot de passe, port fermé, hôte introuvable).

## Conséquences

- Migration additive `040_courriel_jobs.sql`. Aucune dépendance ajoutée : le script d'envoi n'utilise que la bibliothèque standard de Python.
- Une version antérieure de ce chantier proposait un fichier `docker-compose.sortie-reseau.yml` pour donner un réseau sortant à l'API ; il est abandonné.

## Addendum du 27/10/2026 — alertes d'exploitation (012-09)

La première puce de « Ce qui n'est pas fait » ne vaut plus pour les alertes d'exploitation (les rappels métier restent régis par l'[ADR 0058](0058-notifications-metier.md)) :

- Une **sauvegarde échouée**, une **mise à jour** qui échoue, est annulée (retour arrière) ou demande une intervention, et une **opération d'exploitation** en échec ou en intervention mettent un courriel en file pour le **contact technique**, dans la transaction qui constate l'échec. Rejouer le même constat n'en met pas deux.
- Le texte est brut et sans donnée métier : l'événement, une référence courte et le lien vers l'écran concerné.
- Elles passent par la file `courriel_jobs` (type `notification`, demandeur `alerte-exploitation`, adresse = contact technique) : l'exécutant d'exploitation les envoie, avec les mêmes relances que les notifications. Elles ne comptent pas dans la synthèse des envois de notification.
- Un interrupteur « Envoyer les alertes d'exploitation au contact technique » (activé par défaut) figure dans Courriel. Rien n'est mis en file si l'envoi est désactivé ou incomplet (hôte, expéditeur, contact technique).
- Sans migration. Toujours pas de XOAUTH2 (nouvelle dépendance, donc ADR séparée) ni de Teams (écarté).

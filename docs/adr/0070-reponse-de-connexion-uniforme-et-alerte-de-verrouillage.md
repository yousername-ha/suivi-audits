# ADR 0070 — Réponse de connexion uniforme et alerte de verrouillage de compte

- Statut : proposée (numéro à confirmer par le RSSI)
- Date : 2026-10-28
- Contexte : revue de sécurité de l'authentification (OWASP ASVS 4.0 niveau 2 ; CWE-204 ; ISO 27001:2022 A.5.17, A.8.5 et A.8.16). La connexion répondait 423 à un compte verrouillé et 401 aux autres échecs : la différence révélait l'existence d'un compte. Le RSSI a demandé, le 28/10/2026, d'être averti dès qu'un compte est verrouillé.

## Décision

1. **Réponse uniforme.** Tout échec de connexion (compte inconnu, mot de passe faux, compte verrouillé, désactivé ou expiré) répond **401** avec un seul message : « Identifiant ou mot de passe incorrect, ou compte temporairement verrouillé après plusieurs échecs. » Il en va de même du refus du second facteur sur un compte verrouillé (la session est détruite). Le motif exact reste dans le journal d'audit (`auth.login_failed`, champ `reason`). Le temps de réponse ne change pas : `dummyVerify` est déjà appelé pour un compte inconnu ou verrouillé. Cela remplace le 423 de l'[ADR 0066](0066-limitation-des-essais-du-second-facteur-et-verrouillage-partage.md) (point 4).
2. **Alerte à la transition.** `Auth.enregistrerEchec` détecte, dans une seule instruction SQL qui verrouille la ligne, le passage de l'état libre à l'état verrouillé. Seule cette transition déclenche l'alerte : une alerte par verrou, jamais pour un échec sur un compte déjà verrouillé. Sont couverts les échecs de mot de passe, du second facteur et des vérifications du mot de passe actuel.
3. **Destinataires.** Le **contact technique** (`courriel.contactTechnique`) et chaque **administrateur actif** (rôle `administrateur`, directement ou par un groupe), y compris l'administrateur verrouillé. Un compte désactivé ou expiré n'est pas prévenu. Les adresses sont dédoublonnées.
4. **Alerte de sécurité non désactivable.** Les réglages personnels, par rôle et par groupe de l'[ADR 0058](0058-notifications-metier.md) et l'interrupteur « alertes d'exploitation » ne s'y appliquent pas : c'est une exception assumée à l'ADR 0058. Seule l'absence de courriel configuré (envoi inactif, serveur ou expéditeur manquant) empêche l'envoi.
5. **Contenu.** Objet `[<nom de l'application>] Compte verrouillé : <identifiant>`. Corps : identifiant et nom affiché, date et heure (Europe/Paris), motif et nombre d'échecs, fin prévue du verrou, liens vers Administration (comptes, journal d'audit) et consigne de traiter le cas comme un incident de sécurité s'il ne vient pas de l'utilisateur. **Ni adresse IP (elle reste dans le journal) ni code saisi.** Les caractères de contrôle sont retirés des champs repris.
6. **Anti-inondation.** Au plus **10 alertes détaillées par heure** (décompte du journal d'audit : action `auth.account_locked`, sous verrou consultatif PostgreSQL), puis **une seule synthèse par heure** (« N comptes verrouillés depuis HH:MM »). Chaque verrou reste inscrit au journal, quel que soit le plafond.
7. **Envoi.** Même file `courriel_jobs` que les alertes d'exploitation ([ADR 0049](0049-courriel-et-sortie-reseau-optionnelle.md), [0059](0059-relance-automatique-des-courriels.md)) : l'adresse est celle de la demande, l'exécutant d'exploitation les traite comme des notifications, avec relances et abandon. Un échec d'écriture ou d'envoi ne fait jamais échouer la connexion.
8. **Interface.** Administration, Configuration système, Courriel affiche un avertissement tant que le courriel ou le contact technique n'est pas configuré : « Les alertes de sécurité ne sont pas envoyées par courriel : configurez le courriel et le contact technique. »

## Conséquences

- **Aucune migration** : la file existante suffit (les alertes d'exploitation y sont déjà adressées à une adresse de la demande). La variante du dossier (nouveau genre `alerte`) n'est donc pas nécessaire.
- **Notification dans l'application** : ajoutée ensuite sur décision du RSSI, par l'[ADR 0074](0074-alerte-de-securite-dans-l-application.md) (migration qui rend facultatifs le SMSI et l'objet pour ce seul type). L'événement reste aussi visible dans le journal d'audit (`auth.account_locked`).
- **Compromis accepté** : un utilisateur légitime ne sait plus, à l'écran, si son compte est verrouillé ; le message le suggère. Le déverrouillage par un administrateur reste disponible.
- Un attaquant qui verrouille de nombreux comptes déclenche au plus 10 alertes détaillées, puis une synthèse par heure.

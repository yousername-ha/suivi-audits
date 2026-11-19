# ADR 0106 — Conservation des sauvegardes et espace disque

- Statut : **acceptée** par le RSSI le 19/11/2026, dans la session (numéros 0106 et migration `091` si nécessaire annoncés et
  acceptés ; décisions 1 à 5 ci-dessous prises une à une).
- Date : 2026-11-19
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- **Complète** l'[ADR 0071](0071-sauvegardes-chiffrees-avec-age.md) (sauvegardes chiffrées) et l'[ADR 0061](0061-mise-a-jour-web-renforcee.md)
  (mise à jour depuis l'interface).

## Contexte

Le 19/11/2026, la mise à jour 7.2.3 → 7.3.0 depuis l'interface a échoué pendant la sauvegarde de sécurité, faute de place sur
le disque du serveur (retour arrière automatique, aucune donnée touchée). La conservation actuelle :

- sauvegardes régulières : supprimées au-delà de `RETENTION_DAYS` jours (90 par défaut, réglable aussi dans Configuration
  système pour la planification web), les `BACKUP_GARDER_MIN` plus récentes (7) toujours gardées ; avec une sauvegarde par nuit,
  environ 90 archives ;
- sauvegardes d'avant mise à jour : les 5 dernières, nombre figé dans `scripts/mettre-a-jour.sh` ;
- images Docker : `mettre-a-jour.sh` garde, après une mise à jour réussie, la version en service, la précédente et celle du
  frontal ; les images téléchargées par une tentative échouée restent ;
- aucun contrôle de l'espace disque avant une sauvegarde ou une mise à jour, aucune alerte.

## Décisions du RSSI (19/11/2026)

1. **Nombre et durée** : un **nombre maximal** de sauvegardes régulières, réglable dans Configuration système > Sauvegardes
   (de 7 à 365, 30 par défaut), **en plus** de la durée existante. Une archive est supprimée dès que l'une des deux limites est
   dépassée (plus ancienne que la durée, ou au-delà du nombre maximal) ; les `BACKUP_GARDER_MIN` plus récentes restent toujours
   gardées.
2. **Sauvegardes d'avant mise à jour** : nombre réglable dans le même écran (de 1 à 10), **3 par défaut**.
3. **Espace disque** :
   - **contrôle avant opération** : avant une sauvegarde et avant une mise à jour, l'exécutant estime la place nécessaire
     (taille de la dernière sauvegarde, images à télécharger, marge) et refuse proprement, avant de commencer, avec un message
     clair qui donne la place libre, la place nécessaire et ce qui l'occupe ;
   - **alerte** dans l'application, pour les administrateurs, quand l'espace libre du disque des données passe sous **15 %**,
     avec l'occupation par les sauvegardes et par les images de l'application.
4. **Images** : nettoyage automatique des images de l'application qui ne sont ni la version en service, ni la précédente, ni
   celle du frontal en service (`GATEWAY_VERSION`), y compris après une tentative échouée et y compris les images téléchargées
   par leur empreinte (sans étiquette de version) ; aucune autre image du serveur n'est touchée.
5. **Frontal** (19/11/2026) : le frontal n'est pas figé ; il est mis à jour et redémarré chaque fois que c'est nécessaire
   (correctif, mise à jour de sécurité de son image de base), selon l'[ADR 0103](0103-frontal-mis-a-jour-a-la-demande.md),
   addendum du 19/11/2026. Seule son image en service est gardée par le nettoyage.

## Mise en œuvre

- Les réglages se rangent dans la table des réglages existante si possible ; sinon, migration additive `091`. Leurs valeurs
  sont transmises à l'exécutant par le même chemin que la durée de conservation actuelle ; `.env` garde la priorité pour les
  appels directs des scripts, avec les mêmes bornes.
- Rotation : `scripts/backup.sh` (nombre maximal) et `scripts/mettre-a-jour.sh` (nombre d'avant mise à jour). Le nouveau nombre
  ne s'applique qu'aux mises à jour lancées depuis une version qui le contient (script de la version installée).
- Contrôle d'espace : dans l'exécutant de mise à jour (avant la préparation), dans `mettre-a-jour.sh` (avant la sauvegarde,
  pour les appels en ligne de commande), dans l'exécutant des sauvegardes.
- Alerte : relevé de l'espace par l'exécutant d'exploitation, publié sans chemin hôte ; notification aux administrateurs
  (mécanisme des notifications métier), une fois par franchissement de seuil.
- Aucune suppression ne touche les sauvegardes de sécurité des restaurations (`.restauration-securite/`), ni les archives des
  anciennes versions (`.tar.enc`, `.tar`), comme aujourd'hui.

## Conséquences

- Avec les valeurs par défaut, au plus 30 sauvegardes régulières et 3 d'avant mise à jour restent sur le serveur : les
  sauvegardes plus anciennes doivent être externalisées (copie hors du serveur), ce que le guide demande déjà.
- Une opération qui manque de place est refusée avant d'avoir commencé, au lieu d'échouer au milieu.

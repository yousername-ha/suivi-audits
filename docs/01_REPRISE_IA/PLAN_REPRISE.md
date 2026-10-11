# Plan de reprise pour la prochaine session

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

1. Lire AGENTS/HANDOVER/PROJECT_STATUS, vérifier branche et état Git. Comparer
   l’HEAD réel au commit analysé ; revalider toute preuve devenue obsolète.
2. Obtenir le compte rendu TEST-041 du serveur : version installée, services,
   chemin DATA_DIR, navigation au clic, résultat sauvegarde et données anciennes.
   Aucun secret ni fichier brut de production dans Git.
3. Si l’ancien updater est présent, utiliser la procédure déjà fournie et
   INSTALLATION 12.0, sur une fenêtre autorisée ; vérifier santé et heartbeat.
   Ne pas confondre nouvelle CI documentaire et nouvelle version d’application.
4. Faire les parcours métier TEST-042 avec l’utilisateur et consigner les
   réserves ; PV reste en attente jusqu’à décision explicite.
5. Pour une reprise métier, choisir un domaine dans MIG-001, relever son
   contrat v2, données inconnues, permissions et exports, préparer mapper/
   adaptateur et tests sur fixture. Conserver une source modifiable unique.
6. Mettre à jour guides, traces, états et décision ; PR sans fusion automatique.

Commandes de lecture initiales :

```bash
git status --short --branch
git rev-parse HEAD
git log -10 --oneline
git tag --list
```

Le choix du prochain domaine fonctionnel dépend du périmètre autorisé ; ne pas
commencer CRRC/finances ou transport email en présumant que D/I sont réouverts.

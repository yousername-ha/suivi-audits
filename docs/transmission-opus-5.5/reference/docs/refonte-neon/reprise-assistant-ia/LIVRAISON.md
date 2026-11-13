# Livraison — dossier Assistant IA uniquement

12/11/2026 · Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Archive locale : `assistant-ia-implementation-2026-11-12.zip`, **1,968,751 octets**, 26 fichiers, un seul dossier racine. SHA-256 : `bb6049a49ea764d6482e5f16ad66b626806b07f7c03403fa662071207bf6e955`. Le fichier `.zip.sha256` accompagne la livraison.

Code de référence : `04a310fe14efaf9878268bd3c20589c87fcd127c`. Backend indiqué, non embarqué : `claude/assistant-rssi`, référence de lecture `460060a1e3b3597556bba0d64633d13146982c2b`.

## Résumé technique de cette intervention

Création de huit guides de reprise Assistant IA et de `construire.py`, assembleur reproductible depuis les sources Git fixées. Le paquet contient quatre sources UI, huit tests unitaires dans un fichier, deux patchs ciblés, deux captures HD déjà produites, rapports/empreintes historiques et références des dix E2E Assistant avec dépendances externes explicitement signalées. Aucun code des autres modules n’est fourni à porter ; les tests d’arrière-plan de Fournisseurs ne sont pas embarqués. Le dossier ne constitue ni l’application complète ni un Docker autonome.

Les guides précisent : hôte stable hors des pages, maintien des gardes, profils séparés, contexte explicite, notifications personnelles sans profil, pause des rondes distincte du quota de chat, décisions sur actions/constats, types partagés à réconcilier et recette réelle après raccordement. Les fichiers partagés sont livrés sous forme de patch de référence, pas d’anciennes copies intégrales à écraser.

**Application inchangée par ce conditionnement.** Aucun nouveau build, test applicatif, appel Mistral, notification, backend, migration, reconstruction Docker, fusion, push ou déploiement. Les résultats applicatifs de 04a310f sont des preuves antérieures clairement identifiées.

## Contrôles exécutés pour le paquet

- Quatre sources UI et le test unitaire identiques aux octets du commit de référence.
- Deux patchs contrôlés puis appliqués dans une copie minimale isolée de leur base `338f40d87c3a2f2836209b0e50ab788747a0fbb2` ; huit fichiers reconstruits identiques à 04a310f. Cela ne prouve pas une application automatique sur la branche assistant courante : adapter ses raccordements.
- Vérificateur Python autonome exécuté : 25 fichiers empreintés, zéro erreur ; manifeste fourni en plus.
- ZIP : 26 entrées uniques, chemins relatifs bornés au dossier racine, CRC corrects, relecture de chaque entrée identique au dossier ; empreinte ZIP recalculée et égale au fichier de contrôle.
- Deux PNG existants confirmés à 3840×2160 ; aucune nouvelle image générée ni retouche.
- PR ouvertes consultées : aucune au contrôle. Diff documentaire et nouveaux fichiers examinés.

Commande de reproduction, depuis un clone contenant le commit source et ce dossier documentaire :

```bash
python3 docs/refonte-neon/reprise-assistant-ia/construire.py --sortie /chemin/vers/un-repertoire-de-livraison
```

L’assembleur refuse d’écraser une sortie existante. Il ne modifie pas le worktree applicatif ; les patchs sont seulement appliqués dans un répertoire temporaire isolé. Depuis le dossier extrait, `python verifier.py` contrôle les empreintes sans dépendance ni réseau.

Suite : transmettre l’archive à l’IA d’implémentation, lire les guides 00/01, réconcilier avec le backend approuvé et effectuer les contrôles de la cible. Une construction du paquet n’est pas une recette Mistral/Docker.

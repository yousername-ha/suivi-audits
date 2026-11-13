# Transmission de la refonte Neon à Opus 5.5

13 novembre 2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Cette branche publie le dossier complet demandé : **22 ensembles, 128 images PNG originales,
les décisions validées, les sources de référence et les consignes de portage**. Elle ne porte pas
la refonte dans l’application actuelle. Aucun fichier de `apps/`, `packages/`, API, migration,
configuration Docker ou authentification de la branche de base n’est remplacé.

- [Commencer ici](docs/transmission-opus-5.5/00-LIRE-MOI-D-ABORD.md).
- [Prompt à donner à Opus 5.5](docs/transmission-opus-5.5/01-PROMPT-OPUS-5.5.md).
- [Audit obligatoire de l’existant](docs/transmission-opus-5.5/02-AUDIT-DE-L-EXISTANT.md).
- [Décisions retenues, rejetées et états d’intégration](docs/transmission-opus-5.5/03-DECISIONS-ET-ETAT.md).
- [Atlas des visuels](docs/transmission-opus-5.5/08-ATLAS-VISUEL.html) : télécharger la branche,
  puis ouvrir ce fichier localement avec ses sous-dossiers ; GitHub affiche le code HTML.
- [Intégrité et provenance](docs/transmission-opus-5.5/MANIFESTE.json).

## Priorité à la version actuelle

Branche de base : `claude-suivi-smsi`, commit
`967de1d92a2b0d21d9031380ab471670ea5baa98`, obtenu le 13 novembre 2026.
Il inclut déjà la PR **#267, retrait des correspondances entre référentiels et des rapprochements**
(ADR 0089, migration 059). **Ne pas réintroduire ces fonctions à partir des captures ou des sources
historiques.** Recontrôler la branche de travail et la version effectivement exécutée avant portage.

Les instantanés embarqués correspondent à la refonte locale `55d43ee`, dernier état applicatif
`d9d1478`. Ils servent à comprendre les composants et le rendu : ne pas les recopier par-dessus
le code courant. La version exécutée chez le demandeur n’a pas été auditée. Les métadonnées
distantes plus anciennes du dossier sont des observations datées, pas la référence actuelle.
Les médias historiques intermédiaires non embarqués restent des index de provenance, sans
promesse de téléchargement ; les visuels principaux sont présents dans ce dossier.

## Résumé technique pour l’IA repreneuse

- **Ajout documentaire** : `docs/transmission-opus-5.5/`, copie exacte des 1 020 fichiers du dossier
  livré en ZIP, sans nouveau conditionnement ni altération des captures/sources figées.
- **Entrée de reprise** : le présent document signale la base actuelle, les retraits récents,
  les points d’entrée et les limites. Lire l’audit et remplir la matrice de compatibilité avant
  toute modification. Préserver les fonctionnalités, droits, contrats et données plus récents.
- **Isolation des références** : une exclusion ESLint vise uniquement le nouveau dossier documentaire.
  Les fichiers de l’application restent couverts par les règles existantes. Les workspaces pnpm et
  les inclusions TypeScript restent inchangés ; aucun paquet de référence n’y est ajouté.
- **Vérifications de publication** : intégrité ZIP et SHA-256, manifeste des 1 019 fichiers de contenu,
  128 PNG, 22 ensembles, liens principaux, périmètre du diff et absence de changement applicatif.
  Le manifeste ne se hache pas lui-même. Les contrôles historiques du dossier restent datés.
- **Non exécutés pour cette publication documentaire** : nouveaux tests/builds applicatifs,
  Docker, DB, Mistral et recette de la version déployée. Aucun résultat de CI distante anticipé.
- **Suite** : Opus audite la cible, rapproche l’existant des choix validés, puis adapte et teste
  les lots retenus. Aucun portage, fusion, déploiement ou nouvelle release réalisé ici.

Vérification locale du dossier (Python standard, aucun service lancé) :

```sh
python docs/transmission-opus-5.5/outils/verifier_dossier.py
```

Archive d’origine : `refonte-neon-opus-5.5-2026-11-13.zip`, 89 947 562 octets,
SHA-256 `d64fc1058f68dcb7b0f354932e6b4b19e026f48337cca5e5293cb471d8eabfea`.
L’archive ZIP n’est pas dupliquée dans Git ; le dossier est publié décompressé pour lecture et
comparaison. Le bouton GitHub **Code → Download ZIP** permet de télécharger cette branche complète.

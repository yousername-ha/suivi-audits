# Import ARM et migration des historiques

## Import en deux temps

1. Préparer un espace temporaire local ; inspecter l’archive sans exécuter son contenu. Refuser chemins absolus/traversées, liens symboliques, archive chiffrée, nombre/taille décompressée excessifs et formats inattendus ; fixer les limites dans une configuration d’exploitation. Ignorer `Thumbs.db` avec motif tracé.
2. Lire XLSX sans exécuter de formule, macro ou lien externe. Conserver les valeurs source et adresses de cellules dans la piste privée. Les classeurs fournis n’ont pas de formule ; traiter le cas futur explicitement.
3. Extraire schéma, couleurs de remplissage, groupes de cellules fusionnées et marqueurs. Décoder `_x000D_` uniquement dans la valeur normalisée ; garder le texte brut. Pour la feuille des missions, lire les neuf ancres de mission et leurs groupes, pas 89 objets.
4. Présenter un mapping des colonnes et le type cible ; associer l’organisation et les périmètres. Créer des candidats de rapprochement explicables ; aucun rapprochement par nom seul entre organisations.
5. Importer d’abord taxonomies/échelles, puis critères/profils, objets, contexte et évaluations. Les versions importées restent en brouillon jusqu’à validation de leur sens, portée et provenance. Les identifiants cibles sont générés ; les codes ARM deviennent des identifiants externes qualifiés.
6. Résoudre les propriétaires, hiérarchies et références. Conserver les ambigus en file de rapprochement ; autoriser la sauvegarde du brouillon sans autoriser la validation du livrable incomplet.
7. Les PNG sont des pièces de référence privées. La matrice transcrite est préremplie dans un brouillon explicitement « transcription manuelle à valider ». Ne pas créer les évaluations individuelles de couples depuis les positions du cercle.
8. Exécuter un dry-run : créations, correspondances, éléments ignorés, erreurs, avertissements, versions et permissions. Confirmer les décisions métier dans l’application ; écrire atomiquement, avec rapport et auteur serveur.

Clé d’idempotence : organisation cible + empreinte archive + version du parseur + profil d’import et décisions normalisées. À rejouer, retourner le rapport existant ou une nouvelle révision justifiée ; ne pas doubler les objets. Une modification des mappings produit un nouvel aperçu avant écriture.

Le rapport public expose seulement structures/comptes/erreurs génériques. Les valeurs originales, noms d’études et pièces restent dans le stockage local protégé, jamais dans Git ou les captures de démonstration.

## Mapping historique legacy

- Préserver exactement les collections canoniques et les objets immuables. Créer des `legacyBindings` vers des versions de configuration correspondant aux politiques existantes ; une déduplication éventuelle ne doit pas modifier `policyId` des évaluations.
- Créer un contexte d’étude hérité documenté, sans prétendre connaître une version de méthode qui n’était pas enregistrée. Utiliser un adaptateur `legacy-declared` et un niveau de complétude explicite.
- Conserver `workshops` comme notes originales. Proposer une saisie structurée complémentaire ; aucun découpage automatique ne vaut validation métier.
- Garder les anciens champs de scénario pour lecture/export ; ajouter des liaisons structurées à côté. Une suppression des champs historiques nécessite une migration séparée et une preuve de compatibilité.
- Pour les nouvelles évaluations v2, conserver la collection centrale et faire évoluer les validateurs/exporteurs par version. Un ancien lecteur incompatible doit être refusé explicitement, jamais recevoir un résultat tronqué présenté comme complet.

## Déploiement de migration proposé

Avant toute migration réelle : sauvegarde locale de SQLite et des pièces, inventaire du nombre d’objets/liens, empreintes des évaluations/politiques/décisions, test de restauration sur copie. Aucun jeu réel n’est envoyé à GitHub.

Un script déterministe prépare un rapport ; la migration s’exécute dans une transaction, avec numéro de schéma et journal. Tester deux exécutions identiques, panne avant commit, conflit de version et rollback. Après commit, vérifier les empreintes des objets historiques, les liens Annex A, les risques de référence, les fichiers, les périmètres et les exports.

Le rollback restaure sauvegarde et version applicative compatibles ensemble ; ne pas rétrograder uniquement le code sur un état v2. Tant que le lot n’est pas validé, un indicateur fonctionnel garde le nouveau parcours désactivé ; les pages historiques restent utilisables. L’activation multi-organisation et la publication des configurations importées sont des étapes distinctes.

# Conservation de la version 2

`v2-source.zip` conserve les 44 fichiers suivis du commit `b148c1ba303954b7023996fce3d0eff2923326b5`, base `main` constatée avant intégration. Le contenu de chaque entrée a été comparé au blob Git original, sans transformation. Les permissions Git exécutables sont conservées dans les métadonnées du ZIP.

`v2-manifest.json` contient le commit d'origine, les empreintes SHA-256 des 44 fichiers, de l'archive de conservation et du ZIP Sauge, ainsi que l'inventaire des chemins partagés et des fichiers v2 désormais archivés. L'archive est exclue du contexte Docker : elle n'est pas livrée dans l'image applicative v3.

Cette archive contient le code source, pas les données, secrets ou dépendances locales. Les volumes de données v2 de l'environnement ont été conservés. Extraire l'archive dans un dossier séparé pour consulter ou préparer une restauration de code ; ne pas l'extraire sur la base v3 active. Une restauration de code ne constitue pas une restauration de base après migration.

# Diagnostic avant intégration — 11 octobre 2026

Le Legacy conserve une interface HTML et des registres JSON, servis localement
par Python/SQLite. Les autorisations, les périmètres et les références automatiques
sont contrôlés par le serveur. Le registre central des risques et sa cartographie
existent déjà et restent indépendants des études EBIOS RM.

Le module historique de cartographie contexte/processus a été retrouvé dans
`docs/cartographie/reference-beta-legacy` du dépôt source. Son canevas SVG,
ses dispositions, son inspecteur et ses exports peuvent être réutilisés sans
introduire React ni une autre dépendance. Son stockage global `S.maps` et ses
libellés SMSI doivent cependant être adaptés au pilotage de plusieurs référentiels.

Le menu actuel concentre contexte, objectifs, conformité, actions, fournisseurs,
preuves et calendriers sous Pilotage. L'ordre affiché dépend également de l'ordre
d'installation des extensions, même lorsque les groupes déclarent un autre ordre.

L'évolution prévoit donc des dispositions par périmètre, alimentées par les
registres existants, des contrôles serveur sur leurs références et leurs versions,
et une entrée Cartographies réunissant contexte, processus, risques et conformité.
Les fonctions unitaires seront rangées selon leur usage sans changer leurs données.
Les anciennes dispositions importées seront conservées dans une carte privée
d'administration. Aucune modification de l'application principale n'est prévue.

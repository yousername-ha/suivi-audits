# ADR 0089 — Simplification du menu Conformité : six pages retirées, couverture fusionnée dans la Bibliothèque

- Statut : acceptée (décision du RSSI du 12/11/2026 ; numéro annoncé et accepté dans la session)
- Date : 2026-11-12
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- Même logique que l'[ADR 0084](0084-retrait-des-modules-crrc-et-investissements.md) et l'[ADR 0087](0087-retrait-du-module-revues-des-acces.md)
  pour le retrait ; programme en **trois lots**, chacun dans sa PR. Cette ADR est complétée par chaque lot.

## Contexte

La destination « Référentiels et exigences » du menu Conformité et audits réunissait huit pages (capture annotée par le RSSI). Le RSSI
décide de n'en garder qu'une, la **Bibliothèque de référentiels**, et d'y fusionner la **Couverture par référentiel**, comme sur sa
maquette (une carte par référentiel qui mêle la bibliothèque et la couverture du périmètre). Les six autres pages « ne servent à rien
pour le moment » : il choisit la **suppression complète**, comme pour CRRC, Budget, Revues des accès et le BIA.

Pages retirées : Référentiels et exigences, Correspondances entre exigences, Rapprochements à valider, Analyser un service,
Applications à intégrer (GAP), Correspondances de la bibliothèque.

## Décision

**Lot 1 (interface, cette PR)**
- Le menu « Conformité et audits » passe de huit pages à une pour cette destination, renommée « Bibliothèque de référentiels ».
- **Fusion de la couverture dans la Bibliothèque** : chaque référentiel est une carte (exigences au catalogue, périmètres rattachés,
  « Exigences », « Nouvelle édition ») qui affiche, pour le périmètre affiché, la barre et les états des exigences, les mesures
  reliées, les clauses obligatoires pas encore conformes et les exigences à déterminer. « Voir la couverture » ouvre le détail
  exigence par exigence (évaluation, historique, plan d'action des écarts), conservé tel quel. La barre des états est un SVG
  (CSP stricte : aucun style en ligne). Le périmètre se choisit par le sélecteur « Périmètre affiché » de l'application, pas par un
  sélecteur propre à la page.
- Pages, composants, bandeau et pastille de menu des rapprochements, notification « rapprochement » (masquée), aide, tests de
  navigation et tests de bout en bout des six pages retirés. Le sélecteur d'extrémité de correspondance, réutilisé par les critères
  des fournisseurs, est extrait dans son propre fichier.
- **Pas de changement de serveur** dans ce lot : API, tables et données de ces fonctions restent en place, sans interface.

**Lot 2 (fait, 12/11/2026)** : retrait complet des « Applications à intégrer » (GAP) et des applications de la cartographie.
- Serveur : service `historique/gap.ts`, routes `/api/gap*`, collection `appGaps`, rubriques d'export Excel `gapApps` et `gapLignes` (groupe
  « GAP — Applications »), données de démonstration et du jeu de test supprimés.
- **Migration `058_retrait_gap_applications.sql`, destructive** : `DROP TABLE suivi_app_gaps`, suppression de la clé `appGaps` (présence et état
  historique) ; le module relevait de `conformite` (pas de droit propre à retirer). La même migration retire des cartes enregistrées (`maps`) et de
  leurs versions figées (`map_versions`) les nœuds `app:*`, les relations graphiques qui les touchent et leurs masquages ou relations ignorées. Pas de
  reprise de données : l'application n'est pas en production, la sauvegarde de la mise à jour reste le seul retour arrière.
- Schéma partagé : `suivi-gap.ts` supprimé ; `appGaps` rejoint `CLES_RETIREES` (clé écartée à l'import d'un fichier de l'outil historique), contrat
  d'import régénéré.
- Cartographie : le type d'objet `application`, sa création, son renommage (préfixe `app`), la propagation du renommage d'un fournisseur vers ses
  applications, le lien application → fournisseur, la génération (case « Applications »), la fiche, la légende et l'icône sont retirés ; la section
  « Applications liées » de la fiche d'un fournisseur disparaît. Les fournisseurs critiques ou HDS restent les seuls retenus par la génération « critiques ».
  Le préfixe `app` reste toléré dans la validation d'une référence de carte (fichier historique importé) : un tel nœud s'affiche comme objet indisponible et se
  retire de la carte.

**Lot 3 (à venir)** : retrait complet du système de correspondances et de rapprochements : tables `lib_mappings`,
`lib_mapping_history` et `grc_rapprochements`, objets `mapping`, routes, notifications et fournisseurs liés. Attention : le calcul de
couverture (`coverage`) vit aujourd'hui dans `grc/rapprochements.ts` et reste nécessaire à la Bibliothèque : il sera déplacé.

## Ce qui n'est pas fait

- Aucune suppression de donnée dans le lot 1 ; les lots 2 et 3 diront, chacun, ce que devient la donnée (l'application n'étant pas
  encore en production, une réinstallation est acceptée).
- Pas de sélecteur de périmètre propre à la Bibliothèque : la maquette en montrait un ; l'application a déjà le sien.

## Conséquences

Une page de moins à maintenir par fonction retirée, un menu court. La page Bibliothèque est plus riche : elle interroge aussi la
couverture du périmètre affiché. Les anciens signets vers les pages retirées n'aboutissent plus.

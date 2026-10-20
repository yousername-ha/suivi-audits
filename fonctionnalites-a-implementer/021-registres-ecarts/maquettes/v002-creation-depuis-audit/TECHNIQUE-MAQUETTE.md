# Contrat préparatoire — registres d’écarts, plans et conformité

Statut : **à valider**. Dossier préparatoire pour le prototype 021, en lien avec les fonctionnalités 004, 007 et 017. Le dossier final pour l’IA de codage sera consolidé après validation. Ce ZIP n’intègre pas le code métier legacy.

## Identités et relations

| Objet | Relations | Rôle |
| --- | --- | --- |
| Périmètre | Applicabilité des exigences | Contexte commun des constats et évaluations |
| Référentiel | Version explicite, exigences | Pas de correspondance ISO/HDS déduite automatiquement |
| Audit | Un périmètre, plusieurs registres possibles | Origine du constat, sans duplication des écarts |
| Registre d’écarts | Un périmètre, audit facultatif, plusieurs écarts | Dossier de suivi d’une campagne |
| Écart | Un registre, plusieurs exigences applicables, plusieurs actions | Constat, classification, cause, correction, vérification |
| Plan d’action | Un ou plusieurs périmètres, plusieurs actions | Registre d’actions ; les deux termes désignent ici le même objet |
| Action | Un plan, un périmètre, zéro à plusieurs écarts du même périmètre, exigences directes facultatives | Travail autonome ou correctif, responsable, échéance, résultat/preuve |
| Évaluation | Une exigence + un périmètre, date, justification, preuve, évaluateur | Décision distincte de l’exécution des actions |

Une action possède une seule identité et un seul plan de rattachement. Ses liens vers plusieurs écarts ne créent pas de copies. Les exigences effectives de l’action sont l’union des liens directs et des exigences des écarts liés. Les liens à la norme visent des exigences ou mesures identifiées, pas seulement un texte libre.

## Règles proposées, à valider

- Les exigences sélectionnables sont celles déclarées applicables au périmètre. Les éditions des référentiels sont explicites. L’exemple HDS est volontairement fictif : aucune exigence officielle ni édition HDS n’est prétendue importée.
- Une action ne peut relier des écarts hors de son périmètre. Un plan peut couvrir plusieurs périmètres, mais ne confère aucun droit d’accès : l’intégration devra vérifier les permissions serveur sur chaque objet et sur toute la couverture d’un plan.
- Un écart reste ouvert lorsque ses actions sont terminées. Clôturer exige une vérification distincte, avec cause, correction, résultat d’efficacité, preuve et responsable. L’exigence d’au moins une action et de toutes les actions terminées est un choix de maquette, pas une prescription normative universelle.
- Les classifications proposées sont des libellés de démonstration. Une observation ou piste de progrès n’est pas automatiquement une non-conformité normative ; la politique finale devra préciser l’effet de chaque classification sur la conformité.
- Cette version bloque une évaluation Conforme en présence d’un écart ouvert lié, toutes classifications confondues. Cette règle conservatrice est à valider et à rendre configurable selon la politique retenue.
- Toute modification d’une action liée à un écart clos le remet À vérifier. Une évaluation historique Conforme s’affiche À réévaluer si un écart lié reste ouvert. L’évaluation historique n’est pas réécrite et aucun nouveau pourcentage de conformité n’est calculé à partir des actions.
- Une nouvelle évaluation est ajoutée à l’historique. Les objets archivés et leurs liens restent présents. Les références ne peuvent pas être supprimées par changement de périmètre ou d’applicabilité.
- Les changements de périmètre d’un registre contenant des écarts sont refusés dans cette version. Une procédure de reclassement et de migration contrôlée restera à concevoir si nécessaire.

## UI / UX

Style 08 : menu forêt, fond clair sauge, touches turquoise, boutons bleus. Icônes colorées et chevrons conservés. Rouge/rose pour les écarts, bleu pour les plans/actions, violet pour l’exemple HDS. Les états portent aussi un libellé, pas uniquement une couleur.

Écrans : collection des registres ; détail de registre ; fiche d’écart ; collection des plans ; détail du plan en liste et Kanban ; conformité consolidée et détail d’exigence avec historique ; audits ; référentiels ; preuves textuelles ; journal et sauvegardes. Les neuf aperçus sont des captures réelles du prototype.

Le style du menu a reçu un retour positif de l’utilisateur. L’ordre et l’arborescence restent à valider. Les cartographies dynamiques sont exclues et leurs fichiers ne sont pas modifiés.

## Technique et persistance

HTML/CSS/JavaScript classiques, sans dépendance réseau ou module ES à l’exécution. `DEMARRER.bat` ouvre `index.html`. `localStorage['astra-registres-ecarts-v1']` est indépendant de la maquette EBIOS v2. JSON complet pour sauvegarder/restaurer les essais, CSV pour les actions. Le stockage navigateur dépend du chemin et du navigateur : exporter avant déplacement.

Toute mutation est appliquée à une copie, validée, puis enregistrée. Une erreur ne modifie pas l’état courant. Les références, périmètres, identifiants uniques par collection et règles de clôture sont contrôlés à la restauration. Une sauvegarde corrompue est protégée de l’écrasement automatique ; export, restauration ou réinitialisation explicite restent possibles.

Pour une intégration future, réutiliser les registres d’écarts/actions/preuves existants et leurs identifiants. Ajouter les conteneurs de registres/plans et les associations manquantes après audit du modèle existant. Ne pas créer un deuxième moteur de conformité ni un deuxième registre d’actions. Les contrôles serveur, droits, concurrence, migrations, versions de référentiels et historique auditable devront être spécifiés dans le dossier final à partir du code réellement ciblé.

## Limites

Pas de serveur, authentification, isolation organisationnelle, pièces jointes physiques, import tableur ou catalogue HDS officiel. Les périmètres de démonstration sont préconfigurés. Pas de glisser-déposer, diagramme Gantt ni notifications. L’historique est local et modifiable dans le navigateur ; il ne constitue pas un journal serveur inaltérable. Le module EBIOS complet demeure dans son ZIP séparé.

Recette Chromium via localhost, sans exécution native du BAT Windows. Les décisions de conformité sont des essais, aucune certification n’est produite. Les tests techniques ne valent pas validation utilisateur.

## Évolution v002 : entrée depuis l’audit

Le bouton Ajouter un écart de la ligne d’audit ouvre un formulaire de création directe. Les registres sélectionnables sont actifs, rattachés à cet audit et de même périmètre. Le choix Nouveau registre crée le conteneur et l’écart dans une transaction locale unique ; une validation refusée ou une annulation ne crée rien. Un registre archivé n’est pas proposé.

L’origine de l’écart reste le lien canonique écart → registre → audit. Aucun champ audit redondant ni copie de l’écart n’est ajouté. Le retour Audit d’origine est disponible depuis la fiche d’écart. Pour l’intégration future, appliquer cette atomicité et ces contrôles de références côté serveur.

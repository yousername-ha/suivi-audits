# Diagnostic préalable — version legacy locale

11 octobre 2026. Source : `app/public/index.html` à la révision `5a3bd0c` ;
copie indépendante dans `/workspace/legacy-local-d-f`. Aucun développement ou
push dans le dépôt GitHub. Le manifeste de conservation est extérieur au dépôt.

## Architecture observée

Interface autonome, JavaScript classique dans une closure, styles Sauge embarqués,
menu déclaré par `navDef` et registre `TABS`. État JSON `S`, schéma legacy 15,
migrations additives, import/export et IDs stables. La clé localStorage actuelle
est `suivi-audits-smsi:v1`. Les données opérationnelles initiales sont vides.
157 mesures et un référentiel ReCyF servent de catalogue documentaire.

Le registre `S.evidences` fournit les métadonnées et relations ; il ne stocke
actuellement pas les pièces jointes physiques. Les actions sont dans `S.findings`
et leurs tâches ; les référentiels dans `S.frameworks`. Ces registres seront
réutilisés, sans registre de preuve ou plan d'action parallèle.

Les téléchargements de cette source dépendent encore de l'hôte Artifact.
Dans cette copie locale, un téléchargement navigateur et une sauvegarde complète
ZIP seront ajoutés. Les bibliothèques Excel, Word, PowerPoint et ZIP déjà fournies
seront chargées localement. Le stockage des pièces jointes utilisera IndexedDB.

## Décisions avant développement

- Lots D/F uniquement ; conserver le menu, les styles et tous les modules actuels.
- Ajouter des fichiers de module JS/CSS/JSON et un point d'intégration minimal
  dans la copie HTML. Conserver le schéma 15 et ajouter un espace de données `df`.
- Un moteur commun d'évaluation pour CaRE/HAS et des références vers les registres
  existants ; versions de référentiels et évaluations historisées explicitement.
- Budgets en centimes entiers ; aucune formule de subvention supposée.
- Versions physiques de preuves et validation interne distinctes d'une acceptation
  institutionnelle. Les anciens liens/documents restent exploitables.
- Mode auditeur : export limité à une sélection explicite, application autonome
  distincte, observations importées après confirmation. Pas de prétendue sécurité
  fondée uniquement sur le masquage du menu.
- Aucune nouvelle API, aucun SMTP, aucun MCP, aucun serveur métier requis.
  Un serveur statique local est proposé pour un lancement et un stockage stables.

## Sources et limites à contrôler

Les pages ANS consultées renvoient actuellement un challenge anti-robot vide.
Ne pas considérer leur code HTTP 200 comme une validation des objectifs.
Les documents HAS, leur version et les modalités de réutilisation seront contrôlés
avant incorporation. Les contenus indisponibles restent signalés et importables
explicitement ; aucune grille officielle reconstituée par supposition.

## Recette prévue

Tests de migration/conservation, budgets décimaux, évaluations et historique,
liens réutilisés, exports et filtrage physique du dossier auditeur. Parcours réels
Chromium pour création/modification, preuves versionnées, restauration, observations,
Excel et impression PDF, écrans étroits et thème sombre. Profils et fixtures
temporaires isolés. Vérification SHA-256 des 592 fichiers du dépôt source.

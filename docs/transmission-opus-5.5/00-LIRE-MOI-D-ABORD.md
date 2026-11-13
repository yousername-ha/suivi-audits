# Transmission complète de la refonte Neon à Opus 5.5

13/11/2026 — Europe/Paris. Demande : transmettre toutes les décisions, sources utiles et images de la refonte pour les porter sur une version de l’application susceptible d’avoir évolué.

**La première opération est un audit de la version cible. La version fonctionnelle actuelle fait autorité : aucun remplacement global de l’application, aucun retour à une ancienne version métier.**

Ce dossier est une référence d’implémentation, pas un installateur, un Docker de production ni une nouvelle version exécutable. `reference/` contient un instantané de code à comparer, jamais à extraire par-dessus le dépôt cible. Aucune base, clé, session, dépendance installée ou donnée réelle n’est fournie.

## Ordre de lecture

1. [Prompt prêt à donner à Opus 5.5](01-PROMPT-OPUS-5.5.md).
2. [Audit obligatoire de la version cible](02-AUDIT-DE-L-EXISTANT.md), puis compléter [la matrice de compatibilité](annexes/MATRICE-COMPATIBILITE.csv).
3. [Décisions, état et priorités](03-DECISIONS-ET-ETAT.md).
4. [Spécification par module](04-PORTAGE-PAR-MODULE.md), [menu final](05-MENU-FINAL.md), [charte et adaptation](06-CHARTE-ET-RESPONSIVE.md).
5. [Assistant RSSI et raccordement à l’existant](07-ASSISTANT-RSSI.md).
6. [Atlas visuel local avec images originales](08-ATLAS-VISUEL.html).
7. [Plan de réalisation](09-PLAN-DE-PORTAGE.md), [recette/Docker](10-RECETTE-ET-DOCKER.md) et [sources, limites et résumé IA](11-SOURCES-PREUVES-ET-LIMITES.md).

## Ce qui est retenu au dernier échange

Le menu **bleu nuit opaque** est validé, identique dans les deux thèmes, avec une couleur par icône et les animations des formes. Le fond crème/jaune et l’essai plus transparent sont rejetés. Les deux vues du Dashboard avec ce menu ont reçu « Top ». Elles sont des projections natives du Dashboard existant avec le menu isolé, pas une preuve d’intégration React déjà effectuée.

La DDA, les périmètres compacts avec expansion horizontale, les objectifs compacts Studio, la bibliothèque unifiée, le SWOT au centre agrandi, le PESTEL, les Timelines, les lignes ouvrables, Parties intéressées, Processus, Fournisseurs et le frontend Assistant ont été portés sur la branche de refonte. Leur présence dans la cible doit être vérifiée. Les tableaux de décisions distinguent les modèles non approuvés et les limites de réalisation.

La cartographie SMSI garde sa présentation et sa génération automatiques. Sa proposition de remplacement est rejetée, son habillage ultérieur mis de côté. Le graphe RETEX généré reste également protégé.

## Comment utiliser l’archive

Extraire dans un dossier de consultation, séparé du dépôt cible. Ouvrir `08-ATLAS-VISUEL.html` dans un navigateur ; les visuels retenus sont locaux et les aperçus HTML autonomes peuvent s’ouvrir hors ligne. Les documents Markdown se lisent dans l’éditeur d’Opus. Les 128 PNG embarqués couvrent les références sélectionnées. Les médias intermédiaires non nécessaires au portage sont indexés comme historique non embarqué ; leur révision locale n’est pas publiée sur GitHub et leurs liens Git sont des références de provenance, pas des téléchargements actuellement disponibles. Ils ne remplacent jamais les images retenues, disponibles localement.

Lancer `python outils/verifier_dossier.py` depuis le dossier extrait pour vérifier l’intégrité. Les fichiers de la référence et les documents générés ont des empreintes dans `MANIFESTE.json`. Les historiques de validation restent datés ; aucun résultat ancien ne vaut test de la version cible.

## Autorisation et périmètre

Les choix visuels validés n’ont pas à être redemandés pour leur portage. En revanche, un autre design ou une fonctionnalité absente non couverte par le portage nécessite un état explicite et, si nécessaire, une nouvelle proposition. Ne pas déduire une approbation globale des anciens « Continue ». Le présent dossier ne donne pas ordre de fusionner, publier ou déployer ; suivre les instructions et les accords du dépôt cible.

Chaque lot doit livrer son résumé pour une IA connaissant le code, ses vérifications réellement exécutées et ses captures natives après portage.

Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

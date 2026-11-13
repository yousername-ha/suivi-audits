# Dossier d’implémentation — Assistant IA RSSI uniquement

12 novembre 2026 · Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Ce dossier transmet **uniquement l’interface globale de l’assistant IA**, son raccordement et sa recette à une IA ou à un développeur. Il ne contient ni l’application entière, ni un Docker prêt à lancer, ni les autres modules de la refonte.

**État à conserver :** le visuel a été validé par « top ». Le frontend correspondant est intégré sur `codex/refonte-neon-main` au commit **`04a310fe14efaf9878268bd3c20589c87fcd127c`**. Le backend Mistral est sur **`claude/assistant-rssi`**, consulté à **`460060a1e3b3597556bba0d64633d13146982c2b`** ; il n’a pas été fusionné dans cette livraison. Réconcilier avec sa version courante avant raccordement. Aucun moteur, clé de modèle ou schéma de base n’est embarqué ici.

## Ordre de reprise

1. Lire `01-PROMPT-IMPLEMENTATION-IA.md`, puis les décisions et contrats.
2. Vérifier le contenu avec `python verifier.py` depuis le dossier extrait (ou `python3` selon le poste).
3. Étudier `sources/` et les deux patchs. **Le patch des fichiers partagés est une référence à adapter à la branche cible**, pas une invitation à écraser le cadre, les routes ou les imports CSS.
4. Suivre `04-PLAN-INTEGRATION.md`, puis la recette dans l’environnement du dépôt cible.
5. Livrer un résumé des modifications et un visuel réel après intégration.

## Contenu de l’archive

| Dossier | Contenu |
| --- | --- |
| `sources/` | Trois fichiers React/TypeScript de l’assistant et sa feuille de style dans `packages/ui`. Sources exactes du commit livré. |
| `tests/` | Les huit tests unitaires des règles de l’assistant, à placer dans le dépôt hôte. |
| `patches/` | Création des cinq fichiers ci-dessus ; raccordement ciblé de `Layout.tsx`, `main.tsx` et `neon.css` en référence. Aucun fichier partagé complet à remplacer. |
| `visuels/` | Proposition validée et capture du frontend intégré, 3840×2160, déjà produites. La seconde utilise une API fictive interceptée. |
| `references/` | Rapport technique, reçu des contrôles historiques et sources des tests E2E Assistant à adapter au dépôt cible. |
| `MANIFESTE.json`, `verifier.py` | Provenances, dépendances et empreintes SHA-256 de chaque fichier livré ; contrôle local en lecture seule. |

Les quatre sources métier UI et le test unitaire sont portables dans le dépôt hôte sous réserve des imports listés dans `07-FICHIERS-ET-DEPENDANCES.md`. Les références E2E ne sont pas un environnement de test autonome : elles utilisent des fixtures d’arrière-plan déjà présentes sur la branche de refonte, volontairement absentes de ce dossier limité à l’assistant. Leur adaptation est expliquée dans la recette.

Les textes de ce dossier décrivent les sources livrées, pas un nouveau raccordement Mistral testé. Aucun build, test applicatif, appel de modèle, ZIP Docker, migration ou notification réelle n’a été exécuté pour ce conditionnement documentaire. Les preuves antérieures sont datées et identifiées comme telles.

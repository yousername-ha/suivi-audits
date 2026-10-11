# Pilotage legacy local — CaRE, HAS et auditeur

Version `1.0.0-local-df` · 11 octobre 2026.

Copie indépendante de l’interface legacy, avec les lots **D et F** validés.
Les lots I et J sont exclus. Cette livraison de test est publiée uniquement sur
la branche **`legacy/test-lots-d-f`**, sur autorisation utilisateur du 11 octobre 2026.
Le menu et la charte Sauge sont conservés ; les deux rubriques ajoutées sont
**Programme CaRE** et **Qualité · HAS**.

## Récupérer cette version de test

Sur GitHub, sélectionner la branche `legacy/test-lots-d-f`, puis utiliser
**Code → Download ZIP**. Extraire l’archive entière avant de lancer l’application.
Les liens de téléchargement du chat ne sont pas nécessaires.

Pour cloner directement cette version dans un nouveau dossier :

```sh
git clone --single-branch --branch legacy/test-lots-d-f https://github.com/yousername-ha/suivi-audits.git suivi-audits-legacy-test
cd suivi-audits-legacy-test
python3 demarrer.py
```

Le dépôt est privé au moment de la livraison : utiliser son accès GitHub habituel.
La branche a un historique indépendant et sert uniquement aux tests locaux.
Les données restent dans le navigateur ; aucun Docker n’est nécessaire.

## Démarrer

1. Extraire **tout le ZIP** dans un dossier local. Garder `index.html`, `lib/`
   et `modules/` ensemble.
2. Avec Python 3 installé : sous Windows, double-cliquer sur `demarrer.bat`.
   Sous Linux ou macOS, ouvrir un terminal dans ce dossier et lancer :

   ```sh
   python3 demarrer.py
   ```

3. L’application s’ouvre sur **http://127.0.0.1:8123**. Garder cette fenêtre de
   lancement ouverte ; `Ctrl+C` arrête le serveur. Aucun Docker, compte GitHub,
   jeton ni serveur métier n’est nécessaire.

Le serveur fourni ne sert que les fichiers statiques, sur cet appareil.
Les données et pièces sont conservées dans le navigateur. Utiliser le **même
navigateur, profil, adresse et port** pour retrouver son travail. `localhost`
et `127.0.0.1` constituent deux espaces de stockage différents.

L’ouverture directe de `index.html` dépend des autorisations du navigateur.
Le lancement sur localhost est celui qui a été qualifié ; le navigateur du
workspace interdit `file://` par politique d’administration.

## Retrouver ses données legacy

Depuis l’ancienne interface locale, exporter une sauvegarde JSON. Dans cette
copie, ouvrir **CaRE ou HAS → Sources et sauvegarde → Importer un JSON legacy**.
L’import demande confirmation avant de remplacer les données locales.
Ne copier aucun fichier dans l’application GitHub pour utiliser cette livraison.

Les anciennes données, mesures, référentiels, actions et métadonnées de preuves
sont préservées. Les anciens liens documentaires restent des liens ; leur contenu
n’est pas téléchargé automatiquement. Les pièces physiques ajoutées ici se
sauvegardent avec le **ZIP complet**, et pas avec le seul JSON.

## Fonctionnalités livrées

- CaRE : suivis D1/D1bis/D2/D3/D4, périmètres, responsables, échéances,
  évaluations historisées, objectifs locaux identifiés, budgets et financements.
- HAS : campagnes versionnées, 118 critères du référentiel des établissements
  de santé 2025, applicabilité justifiée, évaluations et tableaux de bord.
- Registres communs : preuves physiques versionnées et contrôlées par SHA-256,
  vérifications internes, liens vers les mesures et le plan d’action legacy.
- Excel, rapports imprimables/PDF, sauvegarde et restauration avec pièces,
  dossier auditeur autonome limité à une sélection explicite.

Le guide CaRE D1 intégré est la **version 1.9 du 18/03/2025**. Sa qualité de
dernière version n’est pas confirmée. Les autres domaines disposent d’un suivi
générique et d’un import de grille ; leurs objectifs officiels n’ont pas été
inventés. Les fiches détaillées HAS/CaRE restent consultables dans les documents
officiels liés. L’applicabilité dépend des activités de chaque établissement.

Les résultats affichés sont des évaluations internes, sans décision de
certification ni calcul d’éligibilité. Cette application locale n’ajoute pas
d’authentification serveur. Le dossier auditeur protège le périmètre par les
données réellement incluses dans l’export. Les sauvegardes ZIP **ne sont pas
chiffrées** ; leur contenu doit rester sur un support adapté à sa classification.

## Documentation

- [Guide d’utilisation CaRE et HAS](docs/GUIDE-UTILISATION.md)
- [Préparer un dossier auditeur et examiner ses observations](docs/MODE-AUDITEUR.md)
- [Sources officielles, versions et limites](docs/SOURCES-ET-LIMITES.md)
- [Architecture et conservation des données](docs/ARCHITECTURE.md)
- [Diagnostic réalisé avant développement](docs/DIAGNOSTIC.md)
- [Recette et non-régression](docs/RECETTE.md)
- [Modifications livrées](docs/CHANGEMENTS.md)

`MANIFESTE-LIVRAISON.json` donne les empreintes des fichiers livrés.
`recette/` contient uniquement des résultats et captures à données synthétiques.

## Rejouer les tests

L’application ne nécessite pas Node.js. Pour la recette développeur uniquement :

```sh
node --test tests/core.test.cjs
```

Pour les parcours navigateur, installer Playwright dans son environnement de
test, lancer le serveur local, puis :

```sh
node tests/browser.cjs
```

Variables facultatives : `PLAYWRIGHT_MODULE` (module déjà installé),
`CHROMIUM_PATH` (par défaut `/usr/bin/chromium`) et `LEGACY_URL` (par défaut
`http://127.0.0.1:8123`). Cette recette utilise des profils isolés et des fixtures
synthétiques ; elle ne reprend pas les données de votre profil habituel.

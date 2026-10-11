# Architecture locale et données

Le socle est la copie de `app/public/index.html` du dépôt à la révision
`5a3bd0c872eed96ef89fba5a7d694be237fb705e`. Les bibliothèques déjà présentes sont
copiées dans `lib/` ; aucune nouvelle dépendance d’exécution n’est installée.

| Fichier | Responsabilité |
| --- | --- |
| `index.html` | Interface legacy, moteur existant, migration et pont d’intégration |
| `modules/df-core.js` | Moteur commun CaRE/HAS : dossiers, évaluations, liens, budgets et observations |
| `modules/df-storage.js` | IndexedDB, pièces physiques, SHA-256, ZIP, contrôle et restauration atomique |
| `modules/df-ui.js` | Menus, tableaux de bord, formulaires, filtres, pagination et Excel |
| `modules/df-reports.js` | Rapports imprimables/PDF du responsable |
| `modules/df-auditor.js` | Application autonome limitée au dossier exporté et lanceurs locaux |
| `modules/df-sources.js` | Catalogue documentaire chargé sans requête réseau |
| `modules/df.css` | Extensions de la charte Sauge et adaptations mobile |
| `sources/catalogue.json` | Version JSON lisible du même catalogue |
| `demarrer.py` | Serveur statique de lancement, lié uniquement à 127.0.0.1 |

## Registres partagés

Le schéma legacy reste **15**. L’espace additif `S.df`, schéma **1**, contient
dossiers, évaluations, budgets, historique, exports auditeur et observations.
Les migrations conservent les autres champs, y compris les champs legacy inconnus.

- `S.frameworks` reste le registre des versions de référentiels.
- `S.evidences` reste le registre des preuves, complété par les versions physiques
  et décisions internes ; les liens vers les évaluations sont bidirectionnels.
- `S.findings` reste le plan d’action ; une action peut être liée à plusieurs critères.
- `S.items` reste le catalogue des mesures associées.

Les snapshots du libellé et de la version de référentiel à la création d’un dossier
conservent le contexte historique ; ils ne constituent pas un second catalogue
modifiable. Les réévaluations conservent le précédent état. Les versions physiques
ne sont pas remplacées en place ; chaque lien précise une version.

Les montants sont stockés en **centimes entiers**. Les tableaux de bord et exports
calculent depuis les registres réels. Une action clôturée, un import de grille ou
une observation d’auditeur ne modifie pas implicitement le statut d’une évaluation.

## Stockage local

Les clés de données sont indépendantes de celles de l’ancienne application :
`suivi-audits-legacy-df:v1` et `suivi-audits-legacy-df:ui`.
IndexedDB `suivi-audits-legacy-df` possède les magasins `state` et `files`.
L’interface sauvegarde l’état local ; les blobs restent dans IndexedDB.

Une sauvegarde complète comprend `data/state.json`, les fichiers physiques et un
manifeste avec SHA-256. Toutes les références et empreintes sont contrôlées avant
écriture. La restauration IndexedDB utilise une seule transaction pour les pièces
et l’état. Le JSON seul ne contient pas les blobs. Les anciennes pièces situées
sur des liens externes restent externes.

Le serveur statique n’enregistre aucune donnée métier. Les noms d’auteur sont
déclarés localement. Aucun token GitHub, compte cloud ou secret de production n’est
requis. Les bibliothèques et polices d’interface ne sont pas récupérées sur un CDN
pendant le fonctionnement normal.

## Limites et exploitation

Cette copie vise un appareil et un profil navigateur, sans concurrence multiutilisateur
ou synchronisation distante. Il n’y a ni authentification serveur, ni journal
inaltérable, ni chiffrement des sauvegardes. Les limites de taille évitent les
archives excessives ; elles ne font pas de cette application un coffre documentaire
pour de grands volumes.

La pagination des grilles limite le nombre de lignes rendues. Les archives et
historisations conservent la traçabilité. Les captures et tests utilisent des données
synthétiques ; aucun profil navigateur, pièce utilisateur ou export de production
n’est livré.

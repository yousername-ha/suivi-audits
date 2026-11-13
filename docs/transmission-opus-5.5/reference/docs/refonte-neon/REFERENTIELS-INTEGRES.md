# Référentiels Studio intégrés

05/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Le demandeur valide la [proposition Référentiels Studio](propositions/referentiels-studio/README.md) avec
**« trs bien le référentiiel »**. Son intégration est effectuée sur la copie isolée de main, branche
`codex/refonte-neon-main`, commit applicatif **`65bd22f`**. Aucun nouvel accord préalable n’est requis pour ce lot.

## Présentation intégrée

- Catalogue compact des référentiels publiés dans le périmètre : sélection, nombre d’exigences, édition de la source,
  version de fiche et activation. Accents indigo, vert et ambre ; panneaux opaques en relief discret.
- Exigences en lignes avec code, intitulé et domaine. La première publication est consultée à l’ouverture ; le choix
  d’une autre publication, l’historique, l’export et la préparation d’une version restent disponibles.
- Fiche de lecture « Source et publication » alimentée par les métadonnées réelles. Édition du document, version de
  fiche et dernière version publiée sont distinguées ; une source non vérifiée ne devient pas une source officielle.
- Bibliothèque de l’organisation assortie : exigences, versions et rattachements, sources verrouillées et copies
  personnalisables. Import, simulation, confirmation, copie et nouvelle édition conservent leurs commandes et droits.
- Socle historique et kit IA dans des sections repliables. Recherche et chargement des exigences historiques conservés.
- Clair et sombre, hauteurs naturelles sans défilement interne aux dalles, exigences adaptées au téléphone.

Les deux circuits de données existants restent distincts : publication locale au périmètre et bibliothèque partagée.
Les modèles de méthodes continuent d’utiliser le même composant avec leur présentation précédente. L’ordre des huit
rubriques et les six autres écrans de cette famille restent conservés. Aucun changement d’API, schéma, migration,
dépendance, calcul ou droit ; aucune modification des autres intégrations validées ni du Dashboard.

## Captures réelles et données utilisées

Application compilée, API réelle et base de recette isolée. Les images sont des captures natives Chromium, sans retouche
ni réponse API simulée. Les pages HD font 3 840 px de large.

Dans cette base, le périmètre racine ne contient aucune publication locale : ses deux référentiels initiaux proviennent
de la bibliothèque (ISO/IEC 27001, 126 exigences, et HDS, 31). L’application conserve cette réalité et propose le lien vers
la bibliothèque lorsqu’aucune publication locale n’est présente.

Pour montrer le catalogue, trois publications ont été créées **uniquement dans un périmètre fictif dédié**, avec les API
existantes : 33 intitulés ISO, 93 de l’Annexe A et 31 HDS, issus du jeu fictif fourni. Aucun texte normatif supplémentaire.
L’édition « Jeu fictif 2026 » décrit la démonstration ; elle ne prétend pas être une édition officielle. Ces publications
et leur activation sont des données de recette, absentes du ZIP de sources. La bibliothèque peut également montrer les
objets fictifs créés par les E2E.

| Présentation | Clair | Sombre |
| --- | --- | --- |
| Aperçu de bureau | [Image](captures-referentiels/apercu-light-1440.png) | [Image](captures-referentiels/apercu-dark-1440.png) |
| Page entière, 33 exigences | [Image](captures-referentiels/referentiels-light-1440.png) | [Image](captures-referentiels/referentiels-dark-1440.png) |
| Page entière HD | [Image](captures-referentiels/referentiels-light-hd.png) | [Image](captures-referentiels/referentiels-dark-hd.png) |
| Annexe A, 50 premières lignes | [Image](captures-referentiels/annexe-a-light-1440.png) | [Image](captures-referentiels/annexe-a-dark-1440.png) |
| Bibliothèque | [Image](captures-referentiels/bibliotheque-light-1440.png) | [Image](captures-referentiels/bibliotheque-dark-1440.png) |
| Provenance | [Image](captures-referentiels/source-light-1440.png) | [Image](captures-referentiels/source-dark-1440.png) |
| Téléphone | [Image](captures-referentiels/referentiels-light-mobile.png) | [Image](captures-referentiels/referentiels-dark-mobile.png) |
| Bibliothèque sur téléphone | [Image](captures-referentiels/bibliotheque-light-mobile.png) | [Image](captures-referentiels/bibliotheque-dark-mobile.png) |
| Absence de publication locale | [Image](captures-referentiels/sans-publication-light-mobile.png) | [Image](captures-referentiels/sans-publication-dark-mobile.png) |

[Reçu synthétique des contrôles](captures-referentiels/validation.json). Les sessions et rapports bruts restent hors Git.

## Contrôles exécutés

Node 26, Chromium système, PostgreSQL 18 dans la base séparée `suivi_neon_perimetres_compacts`, ports locaux 8087/5177.
Aucune base de production utilisée. Les mutations des parcours de test concernent leurs propres objets fictifs.

| Contrôle | Résultat |
| --- | --- |
| TypeScript web, ESLint complet, Prettier complet, contrôle du diff | Code 0 ; fichiers retouchés ensuite contrôlés à nouveau |
| Variables Mantine et compilation web | Code 0 ; avertissements préexistants sur le script d’exploitation et la taille des bundles |
| Vitest web | 30 fichiers, 234 tests réussis |
| Publication de référentiel | Création confirmée, export JSON identique, révision, deux versions historiques distinctes et immuables, activation réussis |
| Promotion avant changement d’activation | Copie dans la bibliothèque et conservation des exigences de l’original vérifiées |
| Bibliothèque | Import, rattachement persistant, source verrouillée, copie personnalisable et ajout d’exigence réussis |
| Composant partagé des méthodes | Publication ISO 27005 avec échelles et matrice épinglées réussie |
| Kit IA replié | Ouverture puis parcours existant d’aperçu, confirmation, import, rejeu idempotent et veille réussi |
| E2E | Cinq scénarios distincts réussis après corrections, en séries ciblées avec un worker et zéro rejeu automatique |
| Dimensions | 32 vues contrôlées en clair/sombre, de 390 à 1 920 px et HD ; aucun débordement de page ni défilement interne détecté ; panneaux et lignes contenus |
| Axe sur les modules et fiches | 14 analyses, aucune violation détectée sur les critères WCAG A/AA sélectionnés |
| Lecture seule réelle | Consultation des publications, provenance et exigences de la bibliothèque permise ; commandes d’écriture absentes et export sans droit désactivé |
| Écriture d’activation en lecture seule, corps valide | 403 ; objets identiques avant/après |
| JavaScript, CSP stricte et captures | Aucune erreur détectée, aucune écriture métier pendant les captures |

Les premiers passages ont exposé des sélecteurs E2E devenus inadéquats (combobox, cartes de bibliothèque, retour au graphe
après rechargement), corrigés sans retirer les assertions métier. Le rattachement utilise désormais un périmètre fictif
dédié. La présentation a aussi nécessité de retirer la limite de hauteur héritée du tableau, de rétablir l’étirement du
registre sur mobile et de renforcer légèrement le contraste des boutons vert/ambre. Les captures finales remplacent les
essais intermédiaires ; le thème effectivement appliqué est vérifié. Aucune référence visuelle de CI approuvée automatiquement.

Commandes : TypeScript via `node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit`, ESLint et Prettier
depuis la racine, Vitest depuis `apps/web`, puis script de variables Mantine et `vite build`. Les scripts privés de
`/workspace/work/neon-referentiels-instance` produisent les parcours, mesures, analyses et captures. Le reçu public ne
contient aucun cookie, compte ou identifiant de session d’authentification.

## Défaut préexistant relevé : promotion après activation

**Ouvert, hors du périmètre graphique.** Un parcours supplémentaire a échoué : après publication des versions 1 et 2,
une activation/désactivation incrémente la version de fiche à 3 sans publier une version 3 du référentiel. La simulation
de promotion renvoie alors **404 « Version publiée introuvable. »**. La promotion avant ce changement d’activation est
testée avec succès ; le parcours inverse conserve cette limite et n’est pas déclaré réussi.

La cause est dans le service existant : `Frameworks.activate` modifie la fiche via `g.write`, tandis que
`Library.promotionPreview` cherche une publication dont la version égale `o.version`. Les fichiers API correspondants
sont identiques à ceux de l’intégration précédente `eed9f21` (diff vide). Aucune correction métier ajoutée à la refonte.
Prochaine action séparée : traiter la distinction entre version de fiche et version publiée dans la promotion, avec
tests API dédiés. Ce constat n’est pas présenté comme résolu par les cinq parcours réussis.

## Livraison pour Docker Desktop Windows

Archive locale : `suivi-audits-neon-docker-referentiels.zip`, racine `suivi-audits-neon-test/`. Elle contient les sources
de cette intégration et celles des périmètres, objectifs et DdA déjà validés. Dépendances installées, données locales,
secrets, maquettes et grandes captures exclus ; intégrité et identité des sources applicatives vérifiées après création.

Dans le dossier de test existant contenant `docker-compose.dev.yml` :

```powershell
docker compose -p neon-refonte-test -f docker-compose.dev.yml stop web api
# Remplacer les sources par le CONTENU du dossier suivi-audits-neon-test extrait.
# Conserver .donnees-dev et la configuration locale.
docker compose -p neon-refonte-test -f docker-compose.dev.yml up -d --force-recreate web api
docker compose -p neon-refonte-test -f docker-compose.dev.yml ps
```

Ouvrir `http://localhost:5173`, puis `Ctrl+F5`. Aller à **Conformité et audits → Référentiels et exigences**, puis à
**Bibliothèque de référentiels**. Les publications et compteurs affichés dépendent des données déjà présentes localement ;
aucun jeu fictif de capture n’est injecté dans la base du demandeur.

Non exécutés : recette sur son Docker Desktop Windows, suite API complète, recette exhaustive des autres rubriques et CI
distante. Aucun push, fusion, nouvelle image publiée ou déploiement. Le dépôt principal est resté propre. Prochaine action :
essai du paquet de sources dans la copie Docker de test ; la correction de promotion reste un sujet métier distinct.

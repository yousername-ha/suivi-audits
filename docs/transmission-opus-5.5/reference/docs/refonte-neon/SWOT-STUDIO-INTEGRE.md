# SWOT Matrice Studio — intégré

10/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Le demandeur a validé la proposition par « Ok j’aime beaucoup beaucoup . Top intégre ».
**La matrice est intégrée**, au commit applicatif `016d69c50c7775a62640e9e2d75d2875e9c85374`, sur
`codex/refonte-neon-main`, copie isolée de main. Proposition approuvée : `82981f7`.
Aucune nouvelle validation préalable n’est requise pour ce lot.

## Résultat

L’onglet **Organisation → Contexte de l’organisation → SWOT par processus** présente d’abord la matrice :
processus identifié, quatre catégories colorées, axes interne/externe et favorable/défavorable, cadre biseauté,
liaisons et pictogrammes animés. Pause, reprise et réduction des mouvements sont prises en charge.
Le bouton Lire ouvre une lecture agrandie ; la fiche de modification reste distincte.
Le repère central ouvre un résumé du processus avec ses informations réelles.

La matrice utilise les analyses et les processus existants. Elle lit le rattachement historique `swots.process`
et les relations transverses, dans les deux sens. Les processus natifs sont lus avec leur pagination ; une analyse
rattachée peut être chargée directement depuis sa référence, indépendamment de la page courante du registre.
Les références communes aux deux sources sont dédoublonnées et les analyses archivées des liens sont écartées.
Les textes éditables priment sur les anciennes colonnes, y compris lorsqu’un texte a été effacé.
Aucun score, recommandation ou objet métier n’est ajouté pour compléter la présentation.

**Parcourir le registre** donne accès au registre complet conservé : recherche, filtres, pages suivantes, création,
ouverture et historique. Les filtres restent dans l’adresse. La fiche existante conserve ses champs, ses liens et
justificatifs, son responsable, son registre d’appartenance et son historique, avec les mêmes API, versions et droits.
Le nom de l’auteur historique n’est pas substitué au responsable de la fiche.
Les nouvelles commandes de création utilisent le formulaire existant ; elles ne fabriquent pas de rattachement automatique.

La lecture agrandie est retirée avant l’ouverture de la fiche, avec retour du focus sur sa commande d’origine :
une seule fenêtre reste active. Les panneaux gardent une hauteur naturelle, et les connecteurs suivent les hauteurs
réelles des textes. Sur téléphone, les quatre catégories s’empilent et gardent leurs libellés.

## Périmètre des changements

- `apps/web/src/pilotage/SwotMatrice.tsx` : présentation, sélections, lecture et animations ; appels de lecture existants.
- `apps/web/src/pilotage/swot-presentation.ts` : adaptation des textes et dédoublonnage des références, sans écriture.
- `apps/web/src/pilotage/Registry.tsx` : insertion de la matrice et ouverture du registre complet ; commandes existantes conservées.
- `packages/ui/src/neon-swot.css`, chargé par `neon.css` : styles locaux dans le module de charte graphique.
- Six tests purs et trois scénarios E2E. Les maquettes navigateur ont reçu leurs déclarations de variables globales
  pour le lint, sans modification de leur rendu.

Aucun changement de route API, modèle, migration, dépendance, droit ou calcul métier. Le dépôt original est préservé.
Parties intéressées, PESTEL et les autres destinations Organisation ne sont pas validés par cet accord sur le SWOT.

## Captures réelles

Jeu fictif de l’instance isolée de recette. Les dates et contenus viennent de cette instance, sans être remplacés par
les valeurs de la maquette. Les captures suivantes montrent l’application intégrée, pas le prototype.

| Vue | Clair | Sombre |
| --- | --- | --- |
| Page complète | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/swot-light-1440.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/swot-dark-1440.png) |
| Page complète HD | [3 840 px](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/swot-light-hd.png) | [3 840 px](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/swot-dark-hd.png) |
| Matrice | [Détail](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/matrice-light.png) | [Détail](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/matrice-dark.png) |
| Lecture agrandie | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/lecture-light.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/lecture-dark.png) |
| Fiche existante | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/fiche-light.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/fiche-dark.png) |
| Registre complet | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/registre-light.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/registre-dark.png) |
| Téléphone | [390 px](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/swot-light-mobile.png) | [390 px](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/swot-dark-mobile.png) |

[Animation intégrée GIF](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/animation-swot-integre.gif) ·
[Vidéo intégrée MP4](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-swot/animation-swot-integre.mp4).
La vidéo est un enregistrement de l’application simplement recadré sur la matrice, sans retouche de ses éléments.

## Contrôles exécutés

Node 26.13.0, Chromium système, PostgreSQL 18 du conteneur de recette `codex-neon-db`, base isolée
`suivi_neon_perimetres_compacts`, ports locaux 8087/5177. Aucune base de production utilisée.
Les écritures des tests concernent leurs propres objets et comptes fictifs.
Rapports bruts et sessions conservés hors Git dans `/workspace/work/neon-swot-instance`.

| Contrôle | Résultat final |
| --- | --- |
| TypeScript web | Code 0 |
| ESLint complet et Prettier complet | Codes 0 ; aucune règle ni assertion de contrôle supprimée |
| Variables Mantine et compilation web | Codes 0 ; avertissements de taille des bundles et du script d’exploitation préexistants |
| Vitest web | 31 fichiers, 240 tests réussis, dont six tests de lecture SWOT |
| Vitest UI | 4 fichiers, 243 tests réussis |
| Lecture historique | Quatre quadrants, processus, lecture agrandie, fiche, filtres, rechargement et historique ; analyse strictement inchangée |
| Parcours natif | Création par le formulaire existant, liens dans les deux sens, choix entre deux analyses, édition et rechargement ; autres champs et processus inchangés |
| Lecture seule | Création absente, champs désactivés, sauvegarde absente, tentative serveur refusée 403 et source inchangée |
| E2E final | Trois scénarios réussis, un worker, zéro rejeu |
| Dimensions | 22 dispositions contrôlées : 390, 768, 1 024, 1 280, 1 440 et 1 920 px, lecture, résumé du processus et fiche ; aucun débordement ni défilement vertical interne détecté dans ces zones |
| Accessibilité | Dix analyses Axe ciblées, deux thèmes, aucune violation détectée |
| Animations | Actives, pause, reprise et préférence de réduction vérifiées dans l’application |

[Reçu visuel et d’accessibilité](captures-swot/validation.json).
Les captures n’ont déclenché aucune écriture métier. La bascule clair/sombre a enregistré deux préférences du compte
fictif, via la fonction existante. L’aperçu Vite renvoie 404 pour `/update/client.js`, fourni par la passerelle dans la
pile complète ; ces cinq réponses sont conservées comme observations d’environnement. Aucune autre erreur HTTP ou
JavaScript observée lors des captures finales.

Les essais de préparation ont corrigé l’emplacement initial des styles dans le module de charte, un paramètre de
pagination non accepté par l’API, deux libellés de contrôle de recette et la transition de fenêtre décrite plus haut.
Le gestionnaire pnpm global sélectionnait un autre runtime et tentait une installation : les contrôles ont été exécutés
directement avec Node 26 et les dépendances déjà installées. Les contrôles des captures distinguent les préférences
graphiques et le script d’exploitation absent des écritures métier et erreurs applicatives. Les échecs initiaux ne sont
pas présentés comme réussis ; les résultats ci-dessus correspondent aux passages finaux après correction.

## Livraison Docker Desktop Windows

Paquet de sources : **`suivi-audits-neon-docker-swot-studio.zip`**. Il conserve aussi les intégrations précédentes
DdA, Périmètres, Objectifs et Référentiels. Les données et comptes de recette ne sont pas injectés dans l’installation.
L’archive exclut dépendances installées, données locales, secrets, grandes captures et maquettes ; son intégrité et
l’identité des sources applicatives sont contrôlées avant livraison. Un fichier SHA-256 accompagne le ZIP.

Dans le dossier de test contenant `docker-compose.dev.yml` : arrêter web et API, remplacer les sources par le contenu
du ZIP en conservant `.donnees-dev` et la configuration locale, puis relancer :

```powershell
docker compose -p neon-refonte-test -f docker-compose.dev.yml up -d --force-recreate web api
docker compose -p neon-refonte-test -f docker-compose.dev.yml ps
```

Ouvrir `http://localhost:5173`, puis `Ctrl+F5`. Aucun effacement des données ni `down -v`.

**Non exécutés : recette sur le Docker Desktop Windows du demandeur, CI distante et déploiement.** Aucun push.
Les limites historiques de promotion d’un référentiel après activation et du retour de focus du Contexte ne sont pas
traitées par ce lot SWOT. Prochaine action : essai du demandeur sur sa copie Docker, avec les données locales conservées.

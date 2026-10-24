# Cycle des fonctionnalités sur legacy

Trois dossiers correspondent aux trois étapes demandées par l’utilisateur. Le dossier complet d’une fonctionnalité est **déplacé**, avec son historique, ses maquettes, tests et documents ; il n’est pas dupliqué entre étapes.

| Dossier | Contenu | Condition de sortie |
| --- | --- | --- |
| [fonctionnalites-en-developpement](../fonctionnalites-en-developpement/README.md) | Maquettes et visuels en cours, prototypes testables, dossiers techniques préparatoires | Validation explicite de la version par l’utilisateur et dossier complet prêt |
| [fonctionnalites-a-implementer](../fonctionnalites-a-implementer/README.md) | Maquettes validées et dossier complet pour l’IA de codage | Lecture du marqueur « implémentation ok » confirmant la version livrée |
| [fonctionnalites-implementees](../fonctionnalites-implementees/README.md) | Dossiers livrés avec preuves d’intégration et recette | Conservation de l’historique ; une évolution ouvre une nouvelle version en développement |

## 1. Concevoir et tester

Commencer dans `fonctionnalites-en-developpement/<NNN-fonctionnalite>/`. Utiliser le [modèle](../fonctionnalites-en-developpement/_modele/README.md), créer une version `maquettes/vNNN-description/`, garder les versions utiles et les images. Renseigner le [catalogue commun](catalogue-fonctionnalites.json) et `suivi.json`.

Publier les visuels sur GitHub. Depuis la consigne courante, ne générer aucun ZIP/BAT sans nouvelle demande explicite. Conserver les archives précédentes. Une publication ou des tests réussis ne valent pas validation de la maquette.

Le [prototype transversal v2](../fonctionnalites-en-developpement/_prototype-transversal/README.md) couvre plusieurs fonctionnalités : conserver une source commune et indiquer la version et le périmètre concernés dans chaque dossier. Les [dossiers transversaux préparatoires](../fonctionnalites-en-developpement/_dossiers-transversaux/README.md) restent en développement jusqu’à la demande de passage au codage. Le 19 octobre 2026, l’utilisateur a explicitement demandé le déplacement du [dossier technique UI/UX et registres](../fonctionnalites-a-implementer/_dossiers-transversaux/implementation-ui-2026-10/README.md) vers « à implémenter ». Ce dossier commun conserve ses liens vers les fonctionnalités numérotées et consigne sa décision de classement dans son propre `suivi.json`.

## 2. Valider et préparer le codage

Après accord explicite de l’utilisateur, consigner dans `suivi.json` la date, la version, le périmètre et la référence de sa décision. Consolider dans `implementation/` :

- périmètre validé, exclusions, parcours et critères d’acceptation ;
- sources de la maquette fonctionnelle, captures de chaque écran et états importants ;
- charte graphique, composants, comportements, responsive et accessibilité ;
- architecture, modèle de données, API/contrats, droits, migrations et compatibilité ;
- dépendances, sources officielles, décisions et limites connues ;
- plan de réalisation, recette, résultats réellement exécutés et prompt de codage ;
- inventaire des fichiers et empreintes ; ZIP et lanceur uniquement sur nouvelle demande explicite.

Déplacer ensuite **tout le dossier** dans `fonctionnalites-a-implementer/<NNN-fonctionnalite>/`. Mettre à jour chemins, liens, catalogue, manifestes et historique. Une validation partielle ne valide que son périmètre : laisser le reste en développement. Référencer les ressources communes par une version ou un SHA précis.

L’IA de codage travaille exclusivement sur **sa propre branche** ; `origin/legacy` est sa référence en lecture. Elle ne fusionne, ne déploie et ne modifie pas la branche legacy. Le déplacement documentaire sur legacy est assuré ici.

## 3. Clore l’intégration

À chaque reprise, rechercher et lire les marqueurs « implémentation ok » dans les dossiers de fonctionnalités, et dans la branche de codage si elle est accessible en lecture seule. Nom conseillé : `implementation/IMPLEMENTATION-OK.md`. Accepter également `implémentation ok`, avec ou sans extension, espaces, tirets ou accents.

Si le fichier confirme la livraison de la version concernée, déplacer tout le dossier dans `fonctionnalites-implementees/<NNN-fonctionnalite>/`. Conserver le marqueur, son origine et les informations de livraison dans `suivi.json`, puis actualiser catalogue et liens. Ne pas annoncer des tests exécutés par Codex sur la seule foi du marqueur : distinguer déclaration de l’implémenteur et vérification indépendante. Une information absente est « non communiquée ».

Un modèle vide ou une intention future n’est pas un marqueur de livraison. Lire la version concernée pour ne pas classer une évolution récente sur la base d’une ancienne confirmation. L’agent de codage écrit uniquement dans sa branche ; les changements de classement sur legacy restent à la charge de Codex.

Informations recommandées dans le marqueur : numéro et nom de la fonctionnalité, version de maquette implémentée, périmètre livré, branche/SHA, date, contrôles exécutés et limites. Ne pas créer le fichier pour simuler une intégration.

Le 19 octobre 2026, aucun marqueur n’a été trouvé dans les trois dossiers locaux ; aucun déplacement vers « implémentées » n’a donc été effectué.

## Contrôles et conservation

```sh
python scripts/verifier_structure.py
```

Le catalogue est centralisé dans `docs/catalogue-fonctionnalites.json`, indépendant du dossier d’étape. `etape`, `dossier`, `suivi`, `maquetteCourante`, `tests` et `dossierImplementation` doivent rester cohérents. `suivi.json` conserve les décisions réelles et les transitions ; ne pas inventer de validation ou de recette.

Les liens existants des ZIP dans `downloads/` restent stables. Les archives, PDF et rapports antérieurs restent des instantanés datés ; leurs chemins internes peuvent refléter l’organisation d’origine. Les documents Markdown courants et le catalogue indiquent les chemins actuels. Conserver les versions utiles dans Git.

Le code métier et les lanceurs historiques restent à leur place. La cartographie dynamique demeure protégée. Les références partagées restent dans `references/`. Aucun déploiement, fusion ou CI n’est déclenché par cette organisation.

## Numéros et liste séparée

Chaque fonctionnalité possède un dossier `NNN-identifiant`, par exemple `001-tableau-de-bord`, `002-gestion-risques` et `003-ebios-rm`. Ce numéro est permanent, sans rapport avec l’étape, la priorité ou la version de la maquette. Le déplacement entre étapes conserve le nom complet du dossier.

La [liste séparée](../LISTE-FONCTIONNALITES.md) contient le numéro, le nom, une courte description, l’étape et un lien direct vers chaque dossier. Le catalogue JSON en est la source ; son compteur `prochainNumero` indique le prochain numéro libre (022 après la création de la fonctionnalité 021). Ne jamais réutiliser un ancien numéro.

Après toute modification du catalogue :

```sh
python scripts/generer_liste_fonctionnalites.py
python scripts/verifier_structure.py
```

Les répertoires `_modele`, `_dossiers-transversaux` et `_prototype-transversal` regroupent des ressources partagées et ne reçoivent pas de numéro de fonctionnalité.

## Transmission du 20 octobre 2026

Après accord sur les périmètres, les dossiers complets 002, 003, 012, 017, 018, 019, 020, 021 et 022 sont déplacés vers « à implémenter ». Le statut `reference-implementation` désigne les références graphiques de cette transmission ; il ne transforme pas une fixture en fonction serveur ni une hypothèse non arbitrée en règle métier. Chaque dossier contient les demandes consolidées, leurs critères de recette et un prompt imposant l’audit préalable de l’existant.

[Point d’entrée de cette livraison](../fonctionnalites-a-implementer/_dossiers-transversaux/implementation-ui-2026-10/DOSSIERS-2026-10-20.md). Aucun marqueur de confirmation trouvé lors de cette reprise. Le dossier 010 reste en développement dans l’attente de sa confirmation séparée.

## Transmission distincte du 24 octobre 2026 — fonctionnalité 024

À la demande explicite de l’utilisateur, le dossier [024 — Parcours guidé ISO 27001 / HDS](../fonctionnalites-a-implementer/024-parcours-iso-hds/README.md) a été déplacé depuis « en développement » après consolidation du dossier technique et du prompt de codage. La maquette v011 et son aperçu public servent de référence visuelle. L’IA de codage doit vérifier l’existant sur sa propre branche et ne développer que les écarts. Ce classement transmet les spécifications ; il ne constate aucune intégration au produit. Aucun marqueur `IMPLEMENTATION-OK.md` valide n’a été trouvé et le dossier reste « à implémenter ».

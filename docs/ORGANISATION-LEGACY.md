# Cycle des fonctionnalités sur legacy

Trois dossiers correspondent aux trois étapes demandées par l’utilisateur. Le dossier complet d’une fonctionnalité est **déplacé**, avec son historique, ses maquettes, tests et documents ; il n’est pas dupliqué entre étapes.

| Dossier | Contenu | Condition de sortie |
| --- | --- | --- |
| [fonctionnalites-en-developpement](../fonctionnalites-en-developpement/README.md) | Maquettes et visuels en cours, prototypes testables, dossiers techniques préparatoires | Validation explicite de la version par l’utilisateur et dossier complet prêt |
| [fonctionnalites-a-implementer](../fonctionnalites-a-implementer/README.md) | Maquettes validées et dossier complet pour l’IA de codage | Intégration terminée, version du code identifiée et vérifications consignées |
| [fonctionnalites-implementees](../fonctionnalites-implementees/README.md) | Dossiers livrés avec preuves d’intégration et recette | Conservation de l’historique ; une évolution ouvre une nouvelle version en développement |

## 1. Concevoir et tester

Commencer dans `fonctionnalites-en-developpement/<NNN-fonctionnalite>/`. Utiliser le [modèle](../fonctionnalites-en-developpement/_modele/README.md), créer une version `maquettes/vNNN-description/`, garder les versions utiles et les images. Renseigner le [catalogue commun](catalogue-fonctionnalites.json) et `suivi.json`.

Publier les ZIP de test dans `downloads/` sur GitHub dès qu’ils sont testables, avec BAT, guide et empreinte SHA-256. Ne pas attendre la validation utilisateur pour publier. Une publication ou des tests réussis ne valent pas validation de la maquette.

Le [prototype transversal v2](../fonctionnalites-en-developpement/_prototype-transversal/README.md) couvre plusieurs fonctionnalités : conserver une source commune et indiquer la version et le périmètre concernés dans chaque dossier. Les [dossiers transversaux préparatoires](../fonctionnalites-en-developpement/_dossiers-transversaux/README.md) restent en développement. Leur nom « dossier d’implémentation » ne signifie pas qu’ils sont validés.

## 2. Valider et préparer le codage

Après accord explicite de l’utilisateur, consigner dans `suivi.json` la date, la version, le périmètre et la référence de sa décision. Consolider dans `implementation/` :

- périmètre validé, exclusions, parcours et critères d’acceptation ;
- sources de la maquette fonctionnelle, captures de chaque écran et états importants ;
- charte graphique, composants, comportements, responsive et accessibilité ;
- architecture, modèle de données, API/contrats, droits, migrations et compatibilité ;
- dépendances, sources officielles, décisions et limites connues ;
- plan de réalisation, recette, résultats réellement exécutés et prompt de codage ;
- ZIP complet, lanceur, inventaire des fichiers et empreintes.

Déplacer ensuite **tout le dossier** dans `fonctionnalites-a-implementer/<NNN-fonctionnalite>/`. Mettre à jour chemins, liens, catalogue, manifestes et historique. Une validation partielle ne valide que son périmètre : laisser le reste en développement. Référencer les ressources communes par une version ou un SHA précis.

L’IA de codage travaille exclusivement sur **sa propre branche** ; `origin/legacy` est sa référence en lecture. Elle ne fusionne, ne déploie et ne modifie pas la branche legacy. Le déplacement documentaire sur legacy est assuré ici.

## 3. Clore l’intégration

Quand l’intégration est terminée et vérifiée, consigner dans `suivi.json` la branche d’implémentation, le SHA exact, le périmètre livré, les résultats de recette et la référence de confirmation. Déplacer le dossier dans `fonctionnalites-implementees/<NNN-fonctionnalite>/` et actualiser le catalogue et les liens. Une maquette fonctionnelle seule ne constitue pas une implémentation dans l’application.

Les fonctions déjà présentes historiquement dans l’application ne prouvent pas que les nouvelles maquettes sont intégrées. Les 20 propositions actuelles restent donc en développement. Aucun dossier n’est déclaré prêt à coder ou implémenté par cette réorganisation.

## Contrôles et conservation

```sh
python scripts/verifier_structure.py
python scripts/packager_maquette.py ebios-rm
```

Le catalogue est centralisé dans `docs/catalogue-fonctionnalites.json`, indépendant du dossier d’étape. `etape`, `dossier`, `suivi`, `maquetteCourante`, `tests` et `dossierImplementation` doivent rester cohérents. `suivi.json` conserve les décisions réelles et les transitions ; ne pas inventer de validation ou de recette.

Les liens existants des ZIP dans `downloads/` restent stables. Les archives, PDF et rapports antérieurs restent des instantanés datés ; leurs chemins internes peuvent refléter l’organisation d’origine. Les documents Markdown courants et le catalogue indiquent les chemins actuels. Conserver les versions utiles dans Git.

Le code métier et les lanceurs historiques restent à leur place. La cartographie dynamique demeure protégée. Les références partagées restent dans `references/`. Aucun déploiement, fusion ou CI n’est déclenché par cette organisation.

## Numéros et liste séparée

Chaque fonctionnalité possède un dossier `NNN-identifiant`, par exemple `001-tableau-de-bord`, `002-gestion-risques` et `003-ebios-rm`. Ce numéro est permanent, sans rapport avec l’étape, la priorité ou la version de la maquette. Le déplacement entre étapes conserve le nom complet du dossier.

La [liste séparée](../LISTE-FONCTIONNALITES.md) contient le numéro, le nom, une courte description, l’étape et un lien direct vers chaque dossier. Le catalogue JSON en est la source ; son compteur `prochainNumero` indique le prochain numéro libre (021 après les vingt premières entrées). Ne jamais réutiliser un ancien numéro.

Après toute modification du catalogue :

```sh
python scripts/generer_liste_fonctionnalites.py
python scripts/verifier_structure.py
```

Les répertoires `_modele`, `_dossiers-transversaux` et `_prototype-transversal` regroupent des ressources partagées et ne reçoivent pas de numéro de fonctionnalité.

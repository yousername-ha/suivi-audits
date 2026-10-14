# ASTRA — refonte GRC locale

## Cycle des fonctionnalités

1. **[En développement](fonctionnalites-en-developpement/README.md)** : maquettes, essais et corrections.
2. **[À implémenter](fonctionnalites-a-implementer/README.md)** : après ta validation, maquette et dossier technique complet pour coder.
3. **[Implémentées](fonctionnalites-implementees/README.md)** : après intégration terminée et vérifiée.

[Tester la maquette fonctionnelle v2](downloads/ASTRA-maquette-fonctionnelle-v2.zip) · [Téléchargements](downloads/README.md) · [Règles de passage](docs/ORGANISATION-LEGACY.md) · [Catalogue](docs/catalogue-fonctionnalites.json).

Les 20 propositions actuelles sont en développement. Les ZIP de test continuent d’être publiés sur GitHub avant validation.

La maquette EBIOS RM est autonome. Les instructions ci-dessous concernent l’application métier historique, dont le lanceur et les chemins sont conservés.

Cette livraison est prête à lancer après extraction : voir [LIRE-MOI-ASTRA.txt](LIRE-MOI-ASTRA.txt).
La navigation, les vues et leurs limites sont détaillées dans [la documentation ASTRA](docs/ASTRA-REFONTE.md).
Les informations ci-dessous décrivent également les mécanismes historiques conservés.

# Pilotage Legacy — périmètres, risques, parcours guidé, CaRE/HAS et PCRA

Refonte ASTRA intégrée le 12 octobre 2026, exclusivement sur **`legacy`**.
La branche principale et la nouvelle application restent inchangées.

## Télécharger et démarrer

Sur GitHub : sélectionner `legacy`, puis **Code → Download ZIP**.
Extraire toute l’archive. Le téléchargement est également disponible à cette adresse :

https://github.com/yousername-ha/suivi-audits/archive/refs/heads/legacy.zip

Avec **Python 3.10 ou supérieur**, lancer `demarrer.bat` sous Windows ou :

```sh
python3 demarrer.py
```

Le navigateur ouvre `http://127.0.0.1:8123`. Garder le lanceur ouvert.
Aucun Docker, Node.js, jeton GitHub ni service externe n’est nécessaire à l’exécution.
Se connecter avec **`admin` / `admin`**, compte de test créé automatiquement.
Si cet identifiant existe déjà, son compte et son mot de passe sont conservés.
Le serveur reste lié à localhost. Les autres comptes sont créés dans Administration.
Pour tester la création du premier accès sans ce compte :
`python3 demarrer.py --sans-compte-test` sur un stockage vierge.

Pour cloner dans un nouveau dossier :

```sh
git clone --single-branch --branch legacy https://github.com/yousername-ha/suivi-audits.git suivi-audits-legacy-test
cd suivi-audits-legacy-test
python3 demarrer.py
```

## Retrouver ses données et mettre à jour

**Changement depuis la version 1.0 locale :** les données et pièces sont désormais
conservées dans `.legacy-data/legacy.sqlite3` sur le serveur local, avec comptes et
contrôles d’accès. Ce dossier est privé, exclu de Git et inaccessible par HTTP.
Les données métier ne sont plus enregistrées dans le cache partagé du navigateur.

Avant de remplacer une ancienne copie, télécharger sa **sauvegarde complète ZIP**
depuis CaRE/HAS → Sources et sauvegarde. Le JSON seul ne contient pas les fichiers.

- Si le serveur ne possède encore aucune donnée, le premier administrateur peut
  importer explicitement l’ancien stockage du **même navigateur, adresse et port**.
  Les pièces IndexedDB sont transférées avec contrôle de leurs empreintes.
- Sinon, démarrer cette version, puis utiliser **CaRE/HAS → Sources et sauvegarde
  → Restaurer un ZIP**. Un JSON ancien reste importable s’il ne contient que des
  liens externes ou des versions physiques déjà présentes sur ce serveur.
- Les données anciennes sans périmètre restent privées à l’administration.
  Les classer dans **Périmètres → Relations et classement**. Aucun GHT, FINESS
  ni rattachement n’est deviné automatiquement.
- Pour les prochaines mises à jour, arrêter le lanceur, conserver intégralement
  `.legacy-data`, remplacer le code, puis relancer. Ne supprimer jamais ce dossier
  pour changer de version. Le ZIP métier sauvegarde les données et preuves ; il
  n’exporte pas les comptes, mots de passe ou sessions. Pour déplacer toute
  l’installation, sauvegarder aussi `.legacy-data`, **serveur arrêté**.

Les imports remplacent le jeu de données après confirmation. Les sauvegardes
métier ZIP **ne sont pas chiffrées**. Utiliser un support adapté à la classification.
L’ouverture directe de `index.html` ne fournit plus la persistance et les permissions :
le lanceur Python local est nécessaire. Le dossier auditeur exporté reste autonome.

## Utiliser les fonctions intégrées

1. **Périmètres** : GHT, établissement support, établissements, entités juridiques,
   sites, activités et SI mutualisés. Rattachements hiérarchiques et liens partagés.
   Les établissements CRRC existants se relient explicitement au registre commun.
2. **Pilotage → Rôles et responsabilités** : même registre `roles` que les anciens menus ;
   titulaire, fonction, comptes affectés et couverture des établissements.
   Un rôle fonctionnel ne remplace pas l’habilitation du compte.
3. **Parcours guidé** : étapes issues du parcours existant, données modifiables
   depuis le parcours, sous-tâches, exigences CaRE/HAS, responsables, échéances,
   preuves et actions centrales. Une clôture d’action ne vaut pas conformité.
4. **Programme CaRE** : D1 documenté et **D2 avec 13 références officielles**,
   critères et pièces attendues. Budgets, financements et justificatifs financiers
   utilisent les mêmes évaluations, actions et preuves.
5. **Qualité · HAS** : les 118 critères 2025, évaluations, rapports et export auditeur
   existants sont conservés.
6. **PCRA** : politiques d’impact versionnées, BIA par activité, impacts temporels,
   besoins humains/matériels/SI, PCA et PRA distincts, objectifs métier et techniques,
   exercices, RETEX et actions correctives. Modifier un BIA signale les plans à revoir.
7. **Risques et études EBIOS RM** : registre central indépendant des études,
   évaluations historisées, références initiale/résiduelle et décision d’acceptation,
   scénarios, traitements, mesures/preuves et actions partagées. Cartographie consolidée
   par périmètre avec barèmes/couleurs versionnés, Excel et rapport imprimable/PDF.
8. **Administration** : comptes/habilitations, dix rôles de base, paramètres,
   référentiels et journal. Aucun écran de sauvegarde ou de mise à jour dans ce panneau.
   **Données de démonstration → Ajouter le jeu FICTIF** fournit sur confirmation un
   GHT, CaRE/PCRA et trois risques dans deux études, sans écrasement ni compte ajouté.

Les références internes (`PERI-`, `IMP-`, `RISK-`, `EVR-`, etc.) sont attribuées
automatiquement par le serveur. Les anciennes clés techniques et leurs liens sont
conservés. La mise à niveau ajoute les compteurs et rôles manquants sans changer
les validations BIA/PCA/parcours existantes.

La navigation conserve les anciennes pages et les regroupe dans cinq rubriques
repliables, sur un fond neutre avec des accents Sauge. **Cartographies** réunit
la **Vue d’ensemble** en cases cliquables de la V2, puis le contexte, les processus
et les risques consolidés. Les cartes
contexte/processus sont générées depuis les registres, modifiables et versionnées
par périmètre, avec exports SVG/PNG/PDF/JSON. Les menus d’actions, de preuves,
de conformité et de fournisseurs sont distincts de Pilotage (objectifs, indicateurs et rôles).
Voir [le guide des cartographies et du menu](docs/CARTOGRAPHIES-NAVIGATION.md).

## Permissions et contrôles internes

Administrateur : structure organisationnelle, comptes, rôles, référentiels communs
et restauration. Contributeur : objets affectés aux périmètres autorisés. Lecture :
consultation et exports autorisés. La capacité de validation interne est attribuée
séparément. Les contrôles s’appliquent aux API et aux fichiers, même si l’interface
est contournée. Une habilitation à un parent couvre ses descendants ; les liens
mutualisés ne donnent pas de droits supplémentaires. Un objet couvrant plusieurs
établissements exige l’accès à toute sa couverture. Les anciens snapshots sans
cloisonnement sûr restent réservés à l’administration.

L’application contrôle les données présentes et les décisions internes. Elle ne
calcule pas l’éligibilité financière et ne prononce aucune conformité ou certification
ANS/HAS. Les échelles BIA initiales sont **des choix internes**, adaptables.
Le PDF D2 consulté porte un pied de page « 1.1.6 » et un historique mentionnant
« 1.1.7 » : cette incohérence est conservée, sans affirmation de dernière version.

En cas de modifications concurrentes, le serveur refuse l’écrasement. Exporter
la saisie en JSON avant de recharger et rapprocher les modifications avec
l’administrateur. Le message de sauvegarde en bas indique le résultat serveur.

## Documentation

- [Diagnostic avant toute modification](docs/DIAGNOSTIC-REFONTE-LEGACY.md)
- [Modèles, API, migrations et décisions](docs/REFONTE-LEGACY.md)
- [Risques centraux, administration et jeu FICTIF](docs/RISQUES-ADMINISTRATION.md)
- [Recette risques/administration et non-régression](docs/RECETTE-RISQUES-ADMINISTRATION.md)
- [Guide CaRE/HAS existant](docs/GUIDE-UTILISATION.md)
- [Sources officielles et limites](docs/SOURCES-ET-LIMITES.md)
- [Dossier auditeur autonome](docs/MODE-AUDITEUR.md)
- [Recette actuelle et résultats historiques](docs/RECETTE-REFONTE.md)

## Tests développeur, exclusivement avec données synthétiques

Python seul pour le serveur ; Node.js et Playwright sont utilisés pour les tests.

```sh
node --test tests/*.test.cjs
python3 -m unittest discover -s tests -p 'server*test.py'
node tests/browser-refonte.cjs
node tests/browser-risks.cjs
node tests/browser-carto.cjs
node tests/browser-interface.cjs
```

Les quatre recettes navigateur intégrées démarrent **leur propre serveur et un stockage temporaire**.
Pour la recette historique adaptée au serveur, lancer un serveur **neuf et dédié**,
jamais celui contenant vos données :

```sh
python3 demarrer.py --sans-compte-test --sans-navigateur --port 8140 --donnees /tmp/legacy-recette-neuve
LEGACY_URL=http://127.0.0.1:8140 node tests/browser.cjs
```

Variables développeur : `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `LEGACY_URL`,
`REFONTE_PORT`, `RISKS_PORT`, `CARTO_PORT`, `INTERFACE_PORT`. Les fixtures ne reprennent aucun profil ni document de production.
`recette/*refonte*` contient la recette actuelle ; les anciennes preuves restent
identifiées comme historiques. Le manifeste exclut les bases locales et les nouvelles captures de debug.

La correction des accents, des cartes et du compte de test est décrite dans
[le diagnostic](docs/DIAGNOSTIC-ROLES-INTERFACE.md) et
[la recette exécutée](recette/INTERFACE-RECETTE.md).

## Dossier GRC transversal et navigation simplifiée

[Analyse ARM, architecture, douze chapitres techniques et prompt IA](fonctionnalites-en-developpement/_dossiers-transversaux/grc-transversal/v001-dossier-arm/README.md) · [Menu proposé](fonctionnalites-en-developpement/navigation/README.md) · [Téléchargements](downloads/README.md). Proposition documentaire et graphique du 14 octobre 2026, sans modification du moteur métier.

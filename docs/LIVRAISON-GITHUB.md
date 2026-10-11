# Livraison de la refonte Legacy

L’évolution du registre central, de l’administration et des identifiants est décrite
dans [RISQUES-ADMINISTRATION.md](RISQUES-ADMINISTRATION.md). Le jeu de démonstration
se charge depuis **Administration → Données de démonstration**, après confirmation.
Il n’est pas préinstallé dans les données d’un utilisateur.

Branche exclusive : **`legacy/test-lots-d-f`**. La publication sur cette branche
Legacy autonome est autorisée par l’utilisateur pour permettre ses tests et son
téléchargement. Son nom historique reste inchangé. `main` et
`feature/gpt6-evolution-smsi-grc` sont conservées ; aucune fusion, PR vers main,
CI, image Docker ou release n’est lancée par cette livraison.

## Obtenir la copie

[Ouvrir la branche](https://github.com/yousername-ha/suivi-audits/tree/legacy/test-lots-d-f),
puis **Code → Download ZIP**, ou utiliser le
[ZIP de la branche](https://github.com/yousername-ha/suivi-audits/archive/refs/heads/legacy/test-lots-d-f.zip).
Le dépôt privé nécessite une session GitHub autorisée.

Après extraction, lancer `python3 demarrer.py` ou `demarrer.bat` sous Windows.
Python 3.10+ est requis. Ouvrir `http://127.0.0.1:8123`, puis créer le premier
compte administrateur. Ne pas ouvrir directement `index.html` : les données,
pièces et contrôles d’accès passent maintenant par le serveur local.

## Actualiser une installation Legacy

Arrêter son lanceur, sauvegarder le dossier privé `.legacy-data` entier puis
remplacer les fichiers applicatifs avec cette branche. **Conserver `.legacy-data`**
à son emplacement ou utiliser `--donnees` avec son chemin existant. Relancer le
serveur. La sauvegarde ZIP de l’interface contient les données métier et pièces ;
les comptes et mots de passe restent dans la sauvegarde du dossier privé.

Pour migrer une ancienne copie qui conservait tout dans le navigateur, suivre
la procédure du [README](../README.md). Les données du même navigateur et de la
même adresse peuvent être importées explicitement à la première ouverture ;
une sauvegarde métier de l’ancienne copie reste conseillée avant migration.

## Contrôles et transmission

- [Diagnostic préalable](DIAGNOSTIC-REFONTE-LEGACY.md).
- [Modèles, migrations, API, intégrations et limites](REFONTE-LEGACY.md).
- [Recette actuelle et critères d’acceptation](RECETTE-REFONTE.md).
- [Sources officielles et éléments à confirmer](SOURCES-ET-LIMITES.md).

Les anciennes recettes et documents sont conservés comme historique de la version
1.0. Les nouveaux résultats portent le préfixe `recette/refonte-`. Le manifeste
contient les empreintes des fichiers livrés, à l’exception de sa propre empreinte.
Aucune donnée métier réelle, base d’installation ou session de recette n’est publiée.

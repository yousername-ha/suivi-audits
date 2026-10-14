# Organisation de legacy par fonctionnalité

## Où travailler

```text
fonctionnalites/
  catalogue.json
  ebios-rm/
    README.md
    maquettes/
      README.md
      v001-parcours-anime/
        index.html
        DEMARRER.bat
        images/
        technique/
        version.json
    tests/README.md
    implementation/README.md
  plans-action/…
  taches-recurrentes/…
  _modele/…
implementation/socle-astra/   dossier et prompt communs
references/                  style 08 et captures partagées
downloads/                   ZIP lançables et empreintes
samples/                     table de correspondance historique
```

Le [catalogue](../fonctionnalites/README.md) couvre les 18 fonctionnalités représentées par les captures existantes. Une capture statique n’est pas présentée comme un prototype lançable. Les composants historiques de l’application restent à leurs chemins actuels pour préserver le démarrage et les imports.

## À chaque nouvelle maquette

1. Ouvrir le dossier de la fonctionnalité. Si elle n’existe pas, copier le [modèle](../fonctionnalites/_modele/README.md), choisir un nom simple et l’ajouter au catalogue.
2. Créer `maquettes/v002-description/`, puis `v003-description/`, etc. Conserver la version utile précédente ; ne pas recopier ses données réelles ou ses notes locales.
3. Placer les sources du prototype, les captures, la galerie et les références méthodologiques dans cette version. Pour des images partagées, créer des liens vers `references/` plutôt que des copies.
4. Compléter `version.json` : identifiant, statut, type, commit source, références, version précédente et décision utilisateur lorsqu’elle existe. États proposés : `brouillon`, `a-valider`, `validee`, `a-corriger`, `remplacee`. Un changement d’état doit refléter une décision réelle, pas seulement une réussite technique.
5. Ajouter les résultats datés dans `tests/` ou dans `technique/` de la version, en précisant le SHA testé. Distinguer les tests de maquette, les tests de code intégré et la validation utilisateur.
6. Actualiser `maquettes/README.md`, le README de la fonctionnalité et `catalogue.json`. Mettre à jour les consignes de son dossier `implementation/` si la demande change ; les invariants communs restent dans le socle.
7. Pour un prototype Windows autonome, fournir `DEMARRER.bat`, tester ce qui est disponible et publier le ZIP. Le script de packaging lit la version courante du catalogue et vérifie les chemins et l’archive.

```sh
python scripts/packager_maquette.py ebios-rm
python scripts/verifier_structure.py
```

L’archive EBIOS RM garde le même nom et le même lien public : [télécharger](https://github.com/yousername-ha/suivi-audits/raw/refs/heads/legacy/downloads/EBIOS-RM-maquette-Windows.zip). Le téléchargement est la version courante ; une version antérieure reste récupérable par son commit Git.

## Passage à l’implémentation

L’intégration s’appuie sur la version explicitement demandée par l’utilisateur. Les tests réussis n’accordent pas automatiquement une validation visuelle. Le statut « à suivre » décrit le travail d’intégration de la proposition, sans nier les fonctions déjà présentes dans le moteur legacy.

L’agent d’implémentation suit [le prompt commun](../implementation/socle-astra/PROMPT-IMPLEMENTATION.md) et travaille uniquement sur sa propre branche. `legacy` reste sa référence en lecture. Documenter la branche, le SHA, le périmètre intégré et les résultats dans le dossier de la fonctionnalité. Ne pas déclencher de CI, fusion ou déploiement par cette organisation.

Les cartographies dynamiques restent protégées. Les fichiers locaux étrangers à ce travail ne sont ni déplacés ni publiés.

## Historique et manifestes

Les anciennes séries 08, 14, 15, 16 et 20 ont été déplacées ; [la table de correspondance](../samples/README.md) permet de retrouver leurs fichiers. Les images originales sont conservées. Les rapports de tests historiques gardent leur date et leur portée, sans être attribués à ce nouveau commit.

Les anciens manifestes de livraison décrivent leur livraison d’origine. Les manifestes courants de la maquette lançable et du dossier consolidé sont actualisés lors d’un changement de leurs fichiers. Le nettoyage ultérieur d’une version utile ou validée nécessite une demande de l’utilisateur.

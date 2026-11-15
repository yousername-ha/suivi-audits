# Référence visuelle autonome — démonstration uniquement

Version cumulative du prototype `maintenance-neon-journal-erreurs`, source locale `89b5ac5`. Les chemins d’assets sont ramenés au même dossier ; ordre et contenu des couches conservés. Aucune donnée réelle ni requête vers les services de l’application. Versions, heures, états et logs sont simulés. Pas d’installation npm, pas de Docker.

Depuis le dossier `maintenance-neon` :

```sh
python3 -m http.server 8800 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8800/maquette/index.html` et sélectionner les scénarios. Exemples : `?scene=failed`, `?scene=preparing`, `?scene=backup`, `?scene=verifying`, `?scene=success`, `?scene=rollback`, `?scene=rolled_back`, `?scene=intervention`, `?scene=connection`, `?scene=delay`, `?scene=waiting`. `?theme=light` est une variante d’étude sans capture finale claire livrée ; ne pas la déclarer validée.

La maquette permet de voir les effets dans le navigateur ; aucune nouvelle vidéo n’est livrée. Les captures originales de référence sont dans [l’atlas](../08-ATLAS-VISUEL.html). Un arrêt des animations ne simule pas un arrêt de mise à jour.

**Ne pas copier les scripts de démo dans le produit.** Ils possèdent des fixtures, durées/versions constantes, un sélecteur de scènes, `focus=1`, et un clic de retour neutralisé. Le client réel, les gardes et le flux autorisé restent à adapter. Le sélecteur et les labels « simulés » servent uniquement à identifier cette référence.

Le fichier `journal.css` conserve une couche historique encadrée, annulée par `direct.css`. Ne pas supprimer ou déplacer ces feuilles lors de l’examen du prototype. Le portage consolidera les règles utiles ; voir [la note UI](../04-PORTAGE-UI-ET-ANIMATIONS.md).

Police : copie inchangée d’Inter déjà présente dans le dépôt ; licence [SIL OFL 1.1](assets/LICENSE-Inter.txt). Noyau/icônes vectoriels intégrés au HTML ; aucune reconstruction à partir d’images.

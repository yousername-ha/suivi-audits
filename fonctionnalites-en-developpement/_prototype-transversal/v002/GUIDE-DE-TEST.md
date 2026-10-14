# Tester la maquette fonctionnelle v2

**Statut : à valider.** Ce ZIP est un prototype de navigateur autonome. Il ne modifie pas l’application legacy. La vidéo et ses captures ne sont pas incluses.

## 1. Menu et style

Ouvrir chaque famille : Pilotage, Organisation, Risques, Conformité & audits, Actions, Résilience, Documents. Administration est séparée. Cliquer sur un chevron puis un sous-menu ; une seule famille reste ouverte. Les 31 destinations affichent un écran. Tester aussi le menu à largeur mobile.

Dans Administration → Apparence, alterner Forêt et Sauge clair. Recharger la page : le choix doit rester enregistré dans ce navigateur. Ce choix concerne la maquette locale, pas les utilisateurs de l’application réelle.

## 2. Parcours EBIOS de bout en bout

Le bouton « Créer une étude » crée une étude vide, avec un périmètre et un rôle existants. Les versions courantes de configuration sont conservées dans cette étude.

1. **Atelier 1** : ajouter un événement redouté, choisir une valeur métier et un support, choisir un critère et une gravité fictive, justifier, enregistrer puis valider l’atelier.
2. **Atelier 2** : ajouter un couple SR/OV ; choisir ressources et motivation ; documenter l’activité ; décider Oui/Non avec justification. Sélectionner la ligne, son point dans le cercle et une cellule de matrice. Tester une cellule vide. Valider l’atelier.
3. **Atelier 3** : créer un scénario stratégique lié au couple retenu, à une partie prenante et à l’événement de l’étude. Décrire les hypothèses et valider.
4. **Atelier 4** : créer un scénario opérationnel lié au précédent ; modifier les cinq libellés de nœuds, choisir une vraisemblance fictive et la justifier. Sélectionner Tous les chemins, Accès A et Accès B. Les flux et contours suivent la sélection. Valider.
5. **Atelier 5** : créer le risque et son évaluation, ajouter une action liée à ce risque et à une mesure proposée, puis prendre une décision justifiée. Si la décision est Réduire, une action liée est requise. Valider l’atelier.

**Contrôles négatifs** : tenter de valider l’atelier 2 avant le 1 ; laisser une justification vide ; sélectionner un événement qui ne correspond pas au scénario opérationnel lors de l’évaluation. Le prototype doit refuser la validation concernée.

Les contrôles de cette maquette sont volontairement limités. Ils ne constituent ni le validateur métier définitif ni une certification de l’étude EBIOS. Les autres méthodes ne disposent pas de parcours détaillé dans ce ZIP.

## 3. Risques et traitement

Dans Risques → Registre, sélectionner une ligne ou une cellule. Le détail doit correspondre au risque choisi. La matrice de risque utilise un barème **fictif**, distinct de la matrice de pertinence issue de la structure ARM.

Clôturer une action : le résiduel doit rester inchangé. Choisir explicitement « Réévaluer le résiduel », saisir les niveaux et la justification : une nouvelle évaluation apparaît, et l’atelier 5 est à revoir. Les évaluations et décisions antérieures de la maquette se consultent dans la fiche du risque.

La décision enregistrée est une simulation locale : elle ne vérifie pas une habilitation serveur ni une signature réelle.

## 4. Configurations et versions

Dans Administration → Configuration GRC, ouvrir une échelle. Créer une version, changer un libellé et sa couleur, renseigner le motif puis publier dans la maquette. La version précédente reste conservée.

Ouvrir la matrice de pertinence, changer une cellule et publier une version. L’étude active garde sa version. « Adopter une version dans l’étude » demande un motif, conserve le contexte antérieur et les couples de ce contexte, puis remet les validations à revoir.

Les huit échelles sont éditables pour tester l’interface de versionnement. Le moteur complet de critères, d’héritage et de calcul multiméthode reste une spécification du dossier technique ; tous les champs du parcours ne sont pas dynamiquement produits à partir de ces échelles dans cette maquette.

## 5. Actions, récurrences et preuves

- Créer une action, choisir le risque, le responsable, l’échéance, la mesure et éventuellement une preuve ; changer le statut en liste ou depuis le Kanban.
- Créer une tâche récurrente ; enregistrer une réalisation et ouvrir son historique. La prochaine date est proposée à partir de la date réalisée ; pour une récurrence mensuelle, le jour est borné au dernier jour du mois. Ce choix de démonstration n’est pas une règle de récurrence déjà validée pour la production.
- Créer une fiche de preuve et utiliser la recherche. Le ZIP ne gère pas le stockage sécurisé de pièces réelles.
- Exporter les listes en CSV et vérifier le fichier téléchargé.

## 6. Import de démonstration et sauvegarde

L’écran Import ARM propose un **lot synthétique**, sans lecture de XLSX : préparer l’aperçu, rapprocher le propriétaire, justifier et valider. Répéter l’opération : aucun doublon de la fiche synthétique n’est créé.

Dans Journal & données : exporter la sauvegarde JSON, remettre la maquette à zéro puis restaurer ce fichier. Les études, fiches, versions et historiques reviennent. Un fichier JSON invalide doit être refusé sans écraser les essais présents.

Ne pas confondre l’import JSON de sauvegarde de la maquette et le futur import d’exports métier ARM.

## 7. Retour de validation

Pour chaque point à corriger, indiquer le menu, le bouton ou l’étape, le résultat obtenu et le résultat souhaité. Valider séparément la navigation, le style, les interactions et le parcours métier. Les ZIP de test sont publiés sur GitHub pour permettre leur téléchargement. Le dossier final destiné au codage sera consolidé après votre validation explicite.

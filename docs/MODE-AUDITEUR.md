# Dossier auditeur autonome

Le responsable conserve l’application complète sur son appareil. L’auditeur
reçoit un **autre ZIP**, contenant exclusivement la sélection préparée. Il
ne reçoit ni l’application legacy complète ni les données non sélectionnées.

## Préparer le dossier

1. Ouvrir **CaRE → Dossiers auditeur** ou **HAS → Mode auditeur**.
2. Donner un titre, un destinataire déclaré et, si nécessaire, une date de fin
   de mission. Cette date est informative : elle ne révoque pas des fichiers
   déjà transmis.
3. Cocher les critères autorisés. Aucun critère n’est coché initialement.
   Le filtre par dossier aide à sélectionner plusieurs critères ; les critères
   déjà cochés dans un autre dossier restent cochés.
4. Saisir **PARTAGER**. La seconde confirmation présente le nombre de critères,
   pièces et actions, ainsi que les dossiers et périmètres concernés.
5. Télécharger le ZIP, l’extraire et relire son contenu avant de le transmettre
   par le canal choisi pour sa classification.

Sont inclus : dossiers sélectionnés, évaluations courantes, versions de preuves
précisément rattachées, décisions internes de ces versions, projections des
actions et mesures associées. Les budgets, historiques globaux, autres critères,
autres objets legacy et versions de preuves non rattachées sont exclus.

Les notes et pièces incluses peuvent elles-mêmes contenir des données sensibles.
La sélection d’un critère autorise la transmission de ses justificatifs : vérifier
leur contenu avant diffusion. Le filtrage ne réécrit pas les documents.

## Travail de l’auditeur

Extraire **tout le ZIP**. Ouvrir `index.html` ; si le navigateur interdit les
fichiers locaux, lancer `demarrer.bat` sous Windows avec Python, ou
`python3 demarrer.py` sous Linux/macOS. L’adresse auditeur est
**http://127.0.0.1:8124**, différente de celle de l’application responsable.

L’auditeur consulte le périmètre remis, les critères, les évaluations et les
pièces présentes dans `pieces/`. Les liens vers des documents externes nécessitent
leurs propres droits d’accès. Aucun appel de synchronisation, courriel ou accès
à l’application source n’est effectué.

Saisir son **auteur déclaré**, puis ajouter les éléments en distinguant :

- **Constat** : fait relevé.
- **Observation** : remarque à examiner.
- **Écart** : divergence relevée par l’auditeur.
- **Recommandation** : proposition d’amélioration.

Les observations restent dans le navigateur de l’auditeur. **Exporter les
observations JSON** avant de fermer ou changer d’appareil, puis remettre le fichier
au responsable. **Rapport / PDF** produit un rapport où les quatre types et le
statut **À examiner** restent distincts.

## Retour au responsable

Utiliser **Importer les observations JSON** depuis la page auditeur de
l’application complète. L’import vérifie l’identifiant du dossier remis, son
empreinte de référence et les critères autorisés. Un élément hors périmètre ou
un conflit d’identifiants annule l’import avant toute écriture. Réimporter le même
fichier ne duplique pas les observations déjà reçues.

Chaque observation reçue est **À examiner**. Le responsable peut la confirmer
en interne, la contester ou la classer, avec décision, nom et date. Ces décisions
ne changent pas les évaluations. Une réévaluation, si nécessaire, est effectuée
explicitement dans la fiche du critère.

## Limites de sécurité de la version locale

Le nom d’auteur est déclaré, sans authentification. L’empreinte rattache le retour
au dossier remis ; elle n’identifie pas cryptographiquement son auteur. Le journal
local est consultable et exportable, mais ne constitue pas un journal serveur
inaltérable. Le bouton lecture seule est une aide de consultation, sans contrôle
d’accès à des données déjà présentes dans un navigateur.

La protection du périmètre repose sur les **données physiquement exportées**.
Les copies déjà transmises ne sont pas révocables à distance. Le ZIP est non chiffré.
L’usage multiutilisateur avec comptes authentifiés, droits côté serveur et
révocation nécessiterait une application serveur, exclue du périmètre validé ici.

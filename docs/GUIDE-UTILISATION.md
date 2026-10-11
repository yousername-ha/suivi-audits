# Utiliser CaRE et HAS

Les rubriques se trouvent dans le menu legacy, après Pilotage. Sur les écrans
étroits, leurs sous-rubriques sont dans une barre d’onglets défilante.
Les grilles passent en fiches lisibles sur téléphone.

## Premier suivi CaRE

1. Ouvrir **Programme CaRE → Suivis par domaine → Créer un suivi**.
2. Saisir un nom, le domaine, le responsable, les dates et les périmètres
   concernés, avec un établissement, une entité ou un groupement par ligne.
3. Pour D1, sélectionner le guide version 1.9 si cette version convient au
   suivi. Pour un autre domaine, choisir le suivi générique ou importer
   préalablement une grille obtenue auprès d’une source officielle.
4. Ouvrir **Objectifs**. Un suivi générique propose **+ Objectif local** ; son
   libellé, sa description, ses prérequis et ses critères de vérification sont
   saisis explicitement et identifiés comme non officiels.
5. Ouvrir chaque objectif pour renseigner avancement, responsable, échéance,
   observations, mesures, actions et preuves.

Un dossier conserve la version sélectionnée. Importer un nouveau référentiel
ne modifie pas les évaluations passées : créer un nouveau dossier pour la
nouvelle version. Archiver masque le dossier dans la sélection courante tout
en gardant ses données ; cocher **Archives** pour le consulter ou le réouvrir.

## Première campagne HAS

1. Ouvrir **Qualité · HAS → Campagnes → Créer une campagne**.
2. Sélectionner la version HAS **2025**, donner le périmètre et le responsable.
3. La grille reprend les **118 critères**, avec chapitre, niveau, champ
   d’application et lien vers la page officielle.
4. Utiliser recherche, chapitre, situation et échéances pour filtrer ; la grille
   est paginée par 50 critères.
5. Évaluer chaque critère. **Non applicable** exige une justification ;
   l’application ne déduit pas l’applicabilité des seuls noms des périmètres.

Les statuts « Conforme », « Partiel » et « Non conforme » sont des choix de suivi
interne. Ils ne reproduisent pas une cotation officielle HAS ni le résultat
d’une visite de certification. Les 21 critères impératifs sont identifiés dans
la grille, mais ne déclenchent pas une décision automatique de certification.

## Déposer et examiner une preuve

Dans une fiche d’évaluation, **Créer une preuve** ou **Rattacher une version
existante**. Le registre des preuves est partagé avec les pages legacy.

Une preuve possède un titre, une classification, un responsable, des dates,
des notes et éventuellement un lien HTTP/HTTPS. Chaque pièce physique possède
son numéro de version, son nom, sa taille et son empreinte SHA-256. Le dépôt
reste sur cet appareil ; aucune pièce n’est envoyée vers GitHub ou un stockage
externe.

Depuis **Preuves et versions**, ouvrir une preuve et cliquer **Vérifier** sur
la version concernée. Saisir la décision interne, le vérificateur, la date et
les commentaires. Pour passer un objectif à **Atteint** ou un critère à
**Conforme**, il faut une version rattachée acceptée en interne, un vérificateur
et une date d’évaluation.

Une même version peut justifier plusieurs objectifs CaRE ou critères HAS.
Déposer une version supplémentaire garde les anciennes versions et ne change
pas les liens des évaluations. Rattacher explicitement la nouvelle version lors
d’une réévaluation. La vérification interne ne vaut pas acceptation par l’ANS,
la HAS ou le financeur.

## Mesures et actions

Dans la fiche, **Choisir les mesures** utilise le catalogue legacy.
**Créer une action** ajoute un objet au plan d’action existant ; **Rattacher
une action existante** réutilise cet objet sans duplication.

Le bouton **Ouvrir** renvoie au tiroir de l’action legacy pour son suivi.
Une action terminée ne valide pas automatiquement l’objectif : le responsable
réévalue lui-même la situation et les justificatifs. Les évaluations antérieures
sont conservées avec leur version, date, auteur déclaré et situation.

## Budget CaRE

Dans **Budgets et financements**, créer une ligne par exercice et dossier.
Renseigner séparément prévu, engagé, réalisé, déclaré, demandé, notifié et reçu.
Les montants sont en euros, avec deux décimales au maximum ; `0,10` et `0,20`
totalisent exactement `0,30`. Les pièces existantes peuvent être rattachées.

La page calcule les sommes, prévu moins réalisé et notifié moins reçu.
Une différence négative reste visible. L’historique conserve les anciens
montants. La source du dispositif et les références de notification sont saisies
sur la ligne ; aucun taux de subvention, montant accordé ou seuil d’éligibilité
n’est calculé à partir d’une hypothèse.

## Exports et conservation

Le filtre **Dossier** détermine le périmètre des exports Excel et des rapports.
Le rapport s’ouvre dans une fenêtre séparée ; cliquer **Imprimer / enregistrer
en PDF**. Autoriser cette fenêtre si le navigateur bloque les fenêtres secondaires.
Les rapports incluent périmètres, versions, évaluations, justificatifs, actions,
décisions et historique ; CaRE inclut également le suivi financier.

Pour conserver réellement les pièces, utiliser **Sources et sauvegarde →
Télécharger la sauvegarde complète**, ou **Exporter → Sauvegarde complète avec
pièces (ZIP)** dans la barre legacy. Restaurer ce ZIP dans un nouveau navigateur
ou appareil pour retrouver les fichiers. Le JSON seul conserve les métadonnées.
Les liens externes ne sont pas incorporés comme fichiers dans le ZIP.

Limites de la copie locale : 20 Mio par fichier, 95 Mio de pièces et 3 000 versions
par archive, 100 Mio au total, JSON limité à 40 Mio. L’espace effectivement
disponible dépend du navigateur. Sauvegarder régulièrement et avant tout import
ou changement de profil. Les empreintes détectent une altération accidentelle ;
elles ne constituent pas une signature authentifiée.

## Importer une grille versionnée

Dans **Sources et sauvegarde**, télécharger **Modèle JSON**, remplacer les
exemples par les informations de la version officielle obtenue, puis **Importer
une grille JSON**. Le référentiel est ajouté au registre partagé avec la mention
**Importé — à vérifier**. Une confirmation présente nom, version et nombre de
critères. Une même source/version avec un contenu différent est refusée.

**Tracer une vérification** enregistre la date et les modalités de réutilisation
contrôlées. Cette déclaration locale n’est pas une validation par l’éditeur du
référentiel. Choisir ensuite cette version à la création d’un nouveau dossier.

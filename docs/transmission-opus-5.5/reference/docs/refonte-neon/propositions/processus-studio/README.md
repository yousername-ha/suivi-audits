# Processus Studio — suite de la refonte

12 novembre 2026 — Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

**Nouvelle proposition autonome, à examiner avant intégration.** Application inchangée à `81ea06a`. La demande de poursuivre la refonte après le centrage est traitée avec la prochaine destination Organisation : Processus (`/pilotage/processus-cartes`). Une seule image est livrée, celle du cercle ; aucune capture de cet écran n’a été créée.

[Aperçu interactif autonome](apercu-autonome.html) · [Contrôles](validation.json).

## Présentation préparée

- Cartes regroupées selon les types du registre, couleurs sobres de ces types et titres lisibles ; survol avec un léger relief, dans la charte Studio.
- Chaque carte expose le code, l’intitulé, le pilote et les cinq catégories de rattachements. Le bouton + centré en bas déplie la finalité et les sous-processus ; le corps entier ouvre la consultation.
- Liste compacte, recherche à la demande, filtres type/pilote/catégorie rattachée et critères actifs retirables. Défilement dans la zone des résultats.
- Fiche de consultation distincte de la modification : identité et finalité à gauche, rattachements par catégorie à droite. Les origines `fiche`, `objectif` et `lien` restent visibles. Un rattachement inaccessible (`null`) est distinct d’une liste vide.
- Édition et création illustratives en mémoire seulement ; annulation, retour du focus et conservation des rattachements lors d’une modification. Le rechargement rétablit les données fictives. Les boutons d’écriture sont masqués dans le scénario de lecture seule.
- Les natures et types ne sont pas des états de conformité. Aucun score, évolution, avancement ou lien entre processus n’est ajouté.

## Données et correspondance avec le code existant

`donnees.js` contient une copie de lecture des **seuls champs de présentation** de la réponse `ProcessusCartes` de l’instance locale Docker exclusivement fictive : `types`, `processus`, `id/ref/name/owner/family/parent/purpose/rattaches`. Les candidats et autres champs ne sont pas copiés. Une lecture GET a préparé ce fichier ; la maquette elle-même n’appelle aucune API.

Les six processus PR1–PR6, leurs pilotes, leur finalité, le SWOT de PR2 et leurs autres rattachements sont conservés. Les compteurs proviennent des listes présentes, pas de nombres décoratifs. Les couleurs viennent de `types[].tint`. Les modifications des cas de contrôle (sous-processus et catégorie inaccessible) restent dans la mémoire du navigateur et ne sont pas enregistrées dans ce fichier.

Le portage, après validation, doit conserver :

- `CartesProcessus.tsx` et sa clé `CARTES_PROCESSUS_KEY(smsi)` pour la requête `/api/grc/:smsi/pilotage/processus-cartes` ; garde actuelle sur le pilotage commun inchangée sans demande métier distincte.
- Le type `CarteProcessus` et le registre des types, dont les codes absents/archivés ; recherche d’un enfant sans perdre son affichage lorsque son parent ne correspond pas au filtre.
- Les écritures de `FicheCarteProcessus.tsx` : PATCH `/pilotage/objectifs/processes/:id`, rattachement d’objectifs dans leur liste `processes`, liens transverses POST/DELETE `/links`, et restrictions `via` pour les détachements. Aucune copie locale de ces relations dans l’application.
- Les droits de lecture/écriture, les erreurs et invalidations de cache existantes. Le mode lecteur de l’aperçu ne vérifie aucune garde serveur.

## Fichiers et contrôles

`index.html`, `processus.css` et `processus.js` portent la nouvelle présentation ; `donnees.js` est le jeu fictif figé. `exporter.py` assemble les styles, les scripts et la police locale dans `apercu-autonome.html`. Exemple : `python3 exporter.py` depuis le dossier. Cet export est réservé à la maquette ; ne pas porter ses scripts en ligne dans l’application à CSP stricte.

Huit dispositions PC dans les deux thèmes : 1024×768, 1366×768, 1920×1080 et 2560×1440. Aucun débordement de page détecté ; résultats défilants localement, titres à 16/17/18 px selon la fenêtre. Dix cas fonctionnels de maquette : lecture et SWOT, annulation/focus, recherche sans accents, filtres, liste/défilement, lecteur simulé, repli, sous-processus/recherche, catégorie inaccessible, édition sans perte de rattachements et non persistante.

Quatre analyses Axe (cartes et consultation dans les deux thèmes) sans violation détectée. Aucun appel API par les maquettes, aucune erreur JavaScript. Aperçu autonome contrôlé via HTTP : six cartes, ouverture d’une fiche, zéro ressource externe. L’ouverture `file://` est bloquée dans le navigateur cloud ; le fichier exporté a donc été servi en HTTP pour la recette. Son ouverture directe sur Windows n’a pas été rejouée.

ESLint ciblé et format des nouvelles sources HTML/CSS/JS contrôlés. Le premier test complémentaire a été précisé pour viser la carte et non le bouton Annuler encore présent dans le dialogue fermé ; aucune assertion métier supprimée. Le retour de focus après modification a également été conservé lors du nouveau rendu des cartes.

**Aucun code applicatif, route API, migration, permission, dépendance ou ancien ZIP modifié. Aucun build ni test applicatif exécuté avant validation.** PR ouverte #257 consultée en lecture : retrait des revues des accès, sans recouvrement des nouveaux fichiers de proposition ni de HANDOVER ; aucune fusion ou publication.

Suite précise : examiner le centrage et cet aperçu, puis intégrer les seuls ajustements retenus et exécuter les contrôles applicatifs correspondants. La proposition responsive générale reste distincte.

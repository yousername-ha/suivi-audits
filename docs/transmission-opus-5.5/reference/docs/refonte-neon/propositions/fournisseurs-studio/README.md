# Fournisseurs et applications — proposition Studio

12 novembre 2026 — Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

**Proposition de référence désormais portée dans l’application à la demande « Tu peux faire fournisseur ».** Voir le [rapport d’intégration](../../FOURNISSEURS-STUDIO-INTEGRES.md). Les sources et contrôles ci-dessous décrivent la maquette historique avant portage, sans modifier ses preuves. L’habillage de la cartographie reste de côté ; aucune validation déduite pour les autres propositions.

[Aperçu interactif autonome clair/sombre](apercu-autonome.html) · [Contrôles](validation.json). Lors de la proposition initiale, aucun PNG distinct n’avait été généré pour Fournisseurs ; le nouveau visuel du frontend intégré est dans le rapport lié ci-dessus.

## Présentation

Registre compact par défaut, lignes entières ouvrables au clic, Entrée et Espace, pictogramme de type, couleurs d’état nettes et contours Studio. Six colonnes : fournisseur/application, accès SSO/MFA, criticité/HDS déclaré, certificats, contrôles périodiques et évaluation courante. Les intitulés sont alignés, avec les colonnes d’état centrées. Les fenêtres PC étroites gardent un défilement horizontal local ; les listes longues défilent verticalement dans le registre, pas dans la page.

Deux petites icônes règlent la densité : compacte ou détaillée (notes et nombre de périmètres rattachés). Recherche par loupe et filtres à la demande. Les critères correspondent aux filtres actuels : sans MFA confirmée, contrôles à faire, certificats à traiter, critiques ; type SaaS/hors SaaS. La recherche est insensible aux accents.

La consultation sépare identité/accès, évaluation, certificats, contrôles et notes/rattachements. Les certificats conservent type, date, périmètre et emplacement. Les contrôles conservent fréquence, date, résultat, référence et commentaire. Aucun formulaire d’écriture simulé.

## Données et sens des couleurs

`donnees.js` reprend les cinq fournisseurs de l’archive **fictive** `jeu-test-suivi-audits/api/fournisseurs.json`. Les identités, champs, certificats, contrôles, synthèses, évaluation courante et rattachements sont conservés. Aucun appel API depuis la maquette, aucun seuil ou grille ajouté.

Les indicateurs hauts calculent uniquement : cinq fournisseurs, quatre services SaaS, trois SaaS avec MFA confirmée (75 %), deux avec SSO confirmé (50 %). Sans SaaS, l’indicateur affiche « — », pas un taux fictif. SSO/MFA verts = réponse Oui ; orange = En cours ; rouge = Non ; vide/N/A neutres. Une criticité Oui est orange, pas un succès. « HDS déclaré » est un champ de suivi, pas une attestation vérifiée.

L’évaluation conserve les nombres **répond / ne répond pas / non évalué**, sans score de conformité ni taux global. Les évaluations appartiennent à l’organisation ; les périmètres n’en reçoivent pas une copie. Les états `certificateState`, `controlSummary` et `toReview` sont ceux de l’export figé, sans recalcul à la date actuelle. Les dates et la mention d’export préviennent une interprétation comme résultat serveur à jour.

## Résumé technique pour la reprise IA

- `index.html` : structure, repères, densité par icônes, filtres et dialogue natif. Navigation illustrative.
- `fournisseurs.css` : palettes clair/sombre, lignes fines, en-têtes collants et zone défilante, consultation en rubriques. Réutilise les styles des propositions existantes sans les modifier.
- `fournisseurs.js` : `matches()` applique les filtres existants ; `render()` calcule les quatre indicateurs et rend le registre ; `row()` sépare les états ; `controls()` conserve les trois alertes indépendantes. `open()` affiche la consultation ; `closeDialog()` restitue le focus. Les valeurs sont échappées. Densité et filtres changent uniquement la présentation.
- `donnees.js` : jeu source figé. `exporter.py` assemble styles/scripts/police dans `apercu-autonome.html`. L’export n’a ni ressource externe ni écriture ; ne pas copier ses scripts en ligne sous la CSP de l’application.

### Portage après validation

Partir de `apps/web/src/pilotage/Fournisseurs.tsx`, affiché par `pages/Pilotage.tsx` pour `section === 'fournisseurs'`. Conserver `FicheFournisseur`, l’évaluation, l’historique et les rattachements réels, ainsi que les droits `fournisseurs:lire/modifier` et les erreurs/invalidation des requêtes. La maquette est seulement une consultation proposée ; son absence de formulaires ne supprime aucune fonction de l’application.

Conserver GET/POST `/api/suppliers`, PATCH `/api/suppliers/:id`, critères `/api/suppliers/criteria`, GET/POST des évaluations, PUT/DELETE des rattachements `/api/grc/:smsi/suppliers/:id` et suites d’évaluation. Ne pas remplacer les contrats de `packages/shared/src/fournisseurs.ts` ni les calculs `partSaas`, `etatCertificats`, `resumeControles` de `suivi-fournisseurs.ts` par les valeurs figées de cette maquette. Préserver les évaluations immuables, la version des critères et les écritures existantes des certificats/contrôles ; les raccourcis de mutation de la vraie interface doivent rester disponibles selon les droits.

## Contrôles de la maquette uniquement

Huit dispositions PC, clair/sombre : 1024×768, 1366×768, 1920×1080, 2560×1440. Aucun débordement de page ; titres de lignes à 14 px minimum. Quatre analyses Axe (registre/fiche dans les deux thèmes), sans violation détectée ; pas une certification complète d’accessibilité.

Cinq parcours : consultation complète et retour du focus, recherche sans accents/remise à zéro, filtre des certificats, changement de densité sans mutation des données, soixante lignes fictives injectées en mémoire et défilement local sans déplacement de page. Aucun appel API, erreur JavaScript ou ressource en échec dans le contrôle final. Export autonome servi en HTTP : cinq lignes, fiche ouvrable/fermable, zéro ressource externe.

ESLint ciblé, format HTML/CSS/JS et diff contrôlés. Aucun build/test applicatif ; aucune API, permission, migration, dépendance, archive existante, publication ou déploiement modifié. Suite : avis sur cette proposition, puis intégration du lot retenu et nouveaux visuels réels. L’habillage de la cartographie conserve sa validation distincte.

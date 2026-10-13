# Prompt technique prêt à utiliser

Copier le bloc ci-dessous dans une session disposant du dépôt et de la branche `legacy`.

---

Tu interviens dans le dépôt `yousername-ha/suivi-audits`, **sur la branche `legacy` exclusivement**. Implémente le style retenu dans `samples/2026-10-12-astra-09`, à partir du dossier technique et de ses aperçus. La base inspectée du dossier est `f7e543a5c1f31e0bd904f40cf941dbed32fa9dd3` ; commence par vérifier le HEAD réel et les changements intervenus depuis. Préserve les modifications locales sans rapport.

Lis dans cet ordre : `AGENTS.md`, le README de la série 09, `DOSSIER-TECHNIQUE.md`, `INVENTAIRE-MENUS.md`, `VERIFICATIONS.md`, puis `technique/navigation.json`. Consulte l’image `images/000-reference-style.png` et les aperçus de chaque rubrique. Les scripts et la CSS de `technique/` servent à expliquer/reproduire les maquettes ; ce n’est pas une implémentation prête à copier en production.

## Résultat attendu

Retrouver le style de la capture validée : barre latérale **vert profond**, fond chaud très clair, cartes blanches, touches sauge, signature typographique Normand’e-Santé bleu marine et accents **bleu-vert sombre**. Ne pas reprendre la barre gauche sauge clair des variantes 05–07, ni le cyan vif des premières propositions.

Palette cible : navigation et titres `#173F34`, navigation active `#315B4B`, texte clair `#F6FAF6`, sauge `#84A28C`, sauge clair `#E4EEE6`, marine `#142F61`, accent `#236B70`, fond `#F5F6F1`, surface `#FFFFFF`, bordure `#DCE2DB`. Garder les couleurs métier des statuts et des graphiques. Polices locales existantes, rayon des cartes 12 px, espacement 20–24 px.

L’en-tête doit reprendre « Suivi des audits SMSI », « Qualité, sécurité et référentiels » et une signature discrète Normand’e-Santé. Préserver compte, rôle, déconnexion, recherche, sauvegarde, notifications, import/export et paramètres. Utiliser le lien exact `https://www.normand-esante.fr/`, ouvert seulement par clic, avec `target="_blank" rel="noopener noreferrer"`. Aucun iframe, chargement distant ou dépendance réseau au fonctionnement normal. La signature textuelle n’est pas un logo officiel : ne pas inventer d’actif officiel.

Le cockpit cible commence par prochain audit, écarts, conformité et répartition des écarts en grille 2 × 2. Utiliser les calculs existants et les données autorisées. Conserver les priorités, risques, incidents et récurrences du cockpit actuel en dessous ou dans les vues détaillées. Ne pas recopier les valeurs fictives de l’image.

## Contraintes impératives

1. **Ne touche ni à l’interface ni au fonctionnement du module cartographique dynamique.** Ne modifie pas `modules/carto-core.js`, `modules/carto-ui.js`, `modules/carto.css` ou `legacy_cartography.py`. Exclue du nouveau thème les routes `ui.tab === 'carto'` et `ui.tab === 'dash' && ui.dashView === 'map'`. Retire l’attribut de thème et le nouvel habillage sur ces routes. Aucun changement indirect par héritage CSS, variables, polices, en-tête, offsets ou taille de canevas. Vérifie entrée, sortie et navigation directe, avec comparaison de captures et interactions.
2. Garde les 24 rubriques et 100 destinations du registre réel, leurs IDs et paramètres. La navigation simplifiée de l’image est une référence visuelle, pas l’autorisation de supprimer des modules. Ne crée pas de nouveau routeur. Réutilise `LegacyIntegrationUI.toolkit.api().navigate` et le registre `api().astra.navigation()`.
3. Préserve architecture HTML/CSS/JS, lanceurs Python et SQLite locale. Pas de migration React/Vite/Tailwind/Docker, pas de CDN, pas de nouveau serveur, pas de schéma métier pour une modification visuelle.
4. Préserve toutes les permissions serveur, sessions, rôles, périmètres, références internes, files de sauvegarde et gestion de conflit. Le mode lecteur ne reçoit aucun nouveau contrôle de mutation.
5. Préserve les liens risque ↔ mesures Annexe A ISO 27001:2022 via `objectRefs`, les liens des plans de traitement, les évaluations et décisions immuables. Une mesure liée ne vaut ni conformité ni réduction automatique du risque.
6. Réutilise les formulaires, dialogues, gestionnaires et exports existants. Ne remplace pas leurs nœuds/attributs sans rétablir exactement leurs comportements. Les indicateurs sont calculés, jamais des constantes issues des maquettes.
7. Garde le thème sombre, le responsive, les préférences de navigation et le fonctionnement hors ligne. Protège les états chargement, vide, erreur, interdit et lecture seule. Les marqueurs « maquette / démonstration » du dossier ne doivent pas apparaître sur de vraies données.
8. Ne touche à aucune autre branche et ne supprime aucun historique `samples`. Aucun déploiement, CI, release, force-push ou fusion. Les répertoires non suivis `apps/`, `packages/`, `tests/e2e/` ne font pas partie de la tâche.

## Méthode

- Avant édition : inventaire du HEAD, captures cartographiques de référence sur base fictive, vérification du registre de navigation et des points d’extension.
- Ajouter de préférence `modules/nes-sage.css` et `modules/nes-sage-ui.js`, avec activation explicite par route et montage idempotent. Borner les sélecteurs sous un attribut de thème ; ne pas faire de recherche/remplacement global de couleurs.
- Charger ces modules au bon endroit après les couches existantes. Vérifier les règles `!important` déjà présentes et l’héritage CSS. Les exceptions cartographiques doivent s’appliquer avant le rendu pour éviter les sauts visuels.
- Recomposer le cockpit sans modifier ses calculs ; conserver les accès détaillés.
- Décliner sur toutes les destinations de l’inventaire, puis les paramètres, la recherche, les exports et notifications. Si une différence de registre apparaît au HEAD réel, documente-la et couvre les nouvelles routes ; ne supprime pas une route pour faire passer un test.
- Mesurer contraste, débordements, clavier, focus et taille des cibles ; vérifier 390/768/1440/1920 px et thème sombre.

## Validation et livraison

Exécute les tests de moteur/API pertinents et les recettes navigateur existantes : `node --test tests/*.test.cjs`, `python3 -m unittest discover -s tests -p '*_test.py'`, puis les recettes `tests/astra-browser.cjs`, `tests/browser-carto.cjs` et `tests/browser-interface.cjs` avec Chromium configuré. Adapte uniquement les assertions visuelles devenues obsolètes ; ne diminue pas les contrôles métier pour faire passer les tests.

Contrôle spécialement la création suivie d’une modification immédiate, les états 409/422, les rôles lecteurs et éditeurs, les liens Annexe A réciproques, le changement de statut Kanban, les tâches récurrentes et les exports. Teste la cartographie avec le même jeu de données avant/après et assure-toi que son interface et son fonctionnement restent identiques.

Livre un diff ciblé, une nouvelle série d’images dans `samples/AAAA-MM-JJ-astra-NN`, un index mis à jour, les résultats réels et leurs limites, et le ZIP de l’application via le script de packaging existant. Préserve les anciens aperçus. Ne déclare ni tests ni publication réussis sans les avoir vérifiés. Utilise l’identité Git anonyme prévue et `[skip ci]` si tu commits dans le périmètre autorisé.

## Mise à jour prioritaire — deux styles et panneau Apparence

Lire également `samples/2026-10-13-astra-13/COMPLEMENT-TECHNIQUE.md` et ouvrir le prototype `index.html` de cette série. Cette section prévaut sur les prescriptions du prompt original pour le fond unique et le nombre de destinations.

Implémenter les deux styles `sage` (fond #F5F6F1) et `clair` (fond #F7F9FB), avec navigation vert profond et accent #236B70 communs. Ajouter Administration → Apparence, destination `admin-appearance` avec `adminView: 'appearance'`, deux choix radio illustrés, prévisualisation locale puis bouton Enregistrer pour tous, retour au défaut Sauge doux et message accessible. Préserver les 100 destinations existantes et ajouter cette 101e destination, sous réserve du registre courant.

Portée confirmée par l’utilisateur : **style global pour tous les utilisateurs de l’instance**. Seuls les administrateurs peuvent écrire ce réglage ; tous les comptes authentifiés doivent le recevoir sur tous leurs appareils. Persister côté serveur/SQLite dans la configuration d’instance, avec validation, autorisation serveur, révision/conflits et audit. Une migration minimale de configuration est autorisée si aucun stockage approprié n’existe ; ne pas modifier le schéma métier. `localStorage` ne peut pas être la source de vérité. Charger après connexion et propager aux sessions ouvertes sous 30 secondes, sans perdre les formulaires ni recharger la page. Gérer erreur réseau, refus et concurrence sans faux succès. Maintenir le mode Système/Clair/Sombre personnel et distinct ; les fonds clairs ne doivent jamais écraser le mode sombre existant.

La totalité de l’habillage reste suspendue sur les trois routes cartographiques protégées, sans modifier leur interface, leurs dimensions ou leurs interactions. Appliquer également cette exclusion lors d’un changement global depuis un autre compte ou appareil. Exécuter la recette du complément en plus des contrôles pertinents du dossier initial. Ne pas recopier le menu abrégé ou la clé localStorage de démonstration du prototype.

---

Fin du prompt.

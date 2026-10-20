> Transmission du 20 octobre 2026 : [dossier courant](../../implementation/DOSSIER-IMPLEMENTATION.md). Cette version est une référence de conception ; les statuts et limites historiques ci-dessous restent attachés à sa production initiale. Vérifier l’existant avant tout codage.

# 021 — Clôture préservée et nouveau constat lié

**Version candidate v003 du 18 octobre 2026 — à valider.** Maquette locale, sans backend ni données réelles. Le catalogue général conserve v002 comme version publiée de référence ; cette candidate issue de l’audit est proposée séparément et ne vaut pas validation ou intégration.

[Télécharger le ZIP](ASTRA-021-registres-ecarts-v003.zip) · [Empreinte SHA-256](ASTRA-021-registres-ecarts-v003.zip.sha256) · [Résultat des tests](technique/recette.json).

Extraire tout le ZIP, puis double-cliquer sur **DEMARRER.bat** sous Windows, ou ouvrir `index.html` dans un navigateur. Aucun Node, Python ou serveur n’est requis pour l’essai utilisateur. Le BAT ouvre le fichier local ; il n’a pas été exécuté nativement sous Windows pendant cette recette.

## Ce qui change

- Le constat clos et sa vérification restent conservés. Les commandes « Modifier » et « Rouvrir » sont remplacées par **Créer un constat lié**.
- La modification d’une action liée ne rouvre plus silencieusement le constat.
- Le nouveau constat reçoit un autre identifiant, ses nouveaux faits et le motif du lien. Il est ouvert, sans copie des actions ni de la clôture précédente.
- Un lien permet de naviguer dans les deux sens. Le registre peut être choisi parmi les registres actifs du même périmètre.
- À la clôture d’un nouveau constat, une copie des actions à cette date est conservée dans la sauvegarde de démonstration. Le tableau affiche explicitement l’état actuel des actions, qui peut évoluer ensuite.
- La candidate utilise sa propre clé de stockage navigateur `astra-registres-ecarts-v3`. Elle n’écrase pas les essais v1/v2. Leur restauration JSON reste un choix explicite dans l’historique.

Les fonctions précédentes restent présentes : audit → écart, registres, plans, actions, conformité illustrative, filtres, Kanban, exports, sauvegarde/restauration. Les menus hors périmètre de cette maquette restent signalés. Aucune cartographie dynamique n’a été modifiée.

## Parcours à essayer

1. Ouvrir un registre puis un écart ; lui associer une action dans un plan.
2. Terminer l’action et renseigner sa référence de preuve. L’écart reste ouvert.
3. Vérifier et clôturer l’écart en renseignant cause, correction, résultat, preuve et vérificateur.
4. Modifier l’action liée : la clôture et ses preuves doivent rester intactes. Le tableau affiche l’état actuel des actions.
5. Dans le constat clos, choisir **Créer un constat lié**. Renseigner les nouveaux faits et le motif. Annuler doit laisser les données intactes.
6. Enregistrer : le nouveau constat est ouvert ; ses actions et sa clôture sont vides. Les exigences et le périmètre sont repris pour cette proposition.
7. Naviguer vers le constat d’origine, puis revenir par « Constats liés ».
8. Exporter la sauvegarde JSON depuis l’historique, puis tester sa restauration. Une origine absente, cyclique ou hors périmètre doit être refusée.
9. Tester le menu mobile, la navigation au clavier et les libellés. Les essais sont fictifs ; exporter avant d’effacer le stockage du navigateur.

## Aperçus

| Vue | Image |
| --- | --- |
| Nouveau constat et lien d’origine | [10 — Constat lié](images/10-nouveau-constat-lie.png) |
| Clôture conservée et constats suivants | [11 — Clôture préservée](images/11-cloture-preservee.png) |
| Registres | [01](images/01-registres-ecarts.png) |
| Registre de surveillance | [02](images/02-registre-surveillance.png) |
| Fiche écart | [03](images/03-fiche-ecart.png) |
| Plans d’action | [04](images/04-plans-action.png) |
| Plan transversal | [05](images/05-plan-transversal.png) |
| Conformité par périmètre | [06](images/06-conformite-perimetre.png) |
| Kanban | [07](images/07-kanban.png) |
| Audits | [08](images/08-audits-ajouter-ecart.png) |
| Créer depuis un audit | [09](images/09-creation-ecart-depuis-audit.png) |

## Transmission technique

L’[audit courant](https://github.com/yousername-ha/suivi-audits/blob/legacy/fonctionnalites-en-developpement/AUDIT-CONVERGENCE.md) et le [prompt de convergence](https://github.com/yousername-ha/suivi-audits/blob/legacy/fonctionnalites-en-developpement/_dossiers-transversaux/socle-astra/PROMPT-IMPLEMENTATION.md) précèdent tout codage applicatif. La règle de clôture vient du code Claude au SHA `d044eb9265930b55029f9dae46be8f21edc0bca0`, consulté en lecture seule ; ce ZIP n’en copie pas le backend.

Le champ local `recurrenceOf`, le choix de registre, `recurrenceReason` et `closure.actionsSnapshot` sont des **propositions de représentation pour cette maquette**, pas de nouveaux champs acceptés par l’API native. Les convertir via les références et décisions réellement disponibles ; faire préciser tout contrat manquant par le responsable métier. La règle de démonstration « toutes les actions terminées avant clôture » n’est pas une exigence ISO ou HDS déduite de cet audit.

`app.js` contient l’interface et les transactions locales. `seed.js` fournit uniquement les fixtures fictives. `base.css`, `prototype.css`, `registres.css` sont embarqués pour l’autonomie du ZIP. Le garde de transaction compare les constats déjà clos avant/après ; il s’agit d’une garantie de parcours local, **pas d’un contrôle de sécurité serveur**. Un import sauvegarde remplace explicitement les essais ; il ne constitue pas une migration de production ni une preuve inviolable.

Recette exécutée avec Playwright/Chromium sous Linux et localhost : 30 contrôles, 11 captures, sans erreur JavaScript. Rejouer avec `node technique/registres.cjs` dans un environnement de test disposant de Playwright et Chromium (`CHROMIUM_EXECUTABLE` optionnel) ; le script écrit ses captures et son rapport dans ce dossier. `MAQUETTE_ROOT` permet de tester une extraction du ZIP. Pas de validation Windows native, de raccordement API, de certification d’accessibilité ni de conformité normative revendiqués.

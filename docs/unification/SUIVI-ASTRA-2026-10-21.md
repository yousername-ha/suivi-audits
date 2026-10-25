# Suivi d'avancement du prompt maître ASTRA du 21/10/2026 (état honnête)

Ce document tient à jour l'[audit du 21/10/2026](AUDIT-ASTRA-2026-10-21.md) (89 exigences, dix dossiers) à mesure que l'ordre de
codage L0 à L11 avance. Il ne remplace ni l'audit (état de départ, sur `main` 3.6.1) ni la [recette R01 à R18](RECETTE-INTEGRATION-ASTRA.md).

**Aucun marqueur `IMPLEMENTATION-OK` n'est posé pour ce prompt** : des exigences restent partielles ou absentes, et plusieurs attendent
une décision de l'utilisateur (section « Décisions en attente »). Un état « corrigé » ci-dessous veut dire : le code est livré sur la
branche, avec un test qui échoue sans lui ; la colonne « Preuve » dit lequel. Rien n'est « vérifié » sur `main` tant que la CI de la
pull request correspondante n'est pas verte sur le commit exact.

Légende des états : **Corrigé** (critère de l'audit satisfait et testé) · **Amélioré** (écart réduit, critère restant écrit) ·
**Inchangé** (rien n'a été touché) · **Décision** (bloqué par une décision de l'utilisateur).

## Ce qui a changé depuis l'audit, par exigence

### 020 Navigation et 012 Paramètres

| ID | État | Ce qui a été fait | Reste | Preuve |
| --- | --- | --- | --- | --- |
| 020-01 | Amélioré | Inventaire de référence des rubriques, adresses et droits du menu ; familles avec `aria-expanded` | Épuration éventuelle des doublons de rubriques | `navigation.test.ts` |
| 020-03 | Corrigé | Hauteur du menu bornée en tablette comme sur ordinateur, défilement propre | — | e2e `…-coque.spec.ts` |
| 020-04 / 012-05 | Corrigé | Style Clair appliqué en direct aux sessions ouvertes ; contrastes Clair vérifiés (feuille de styles et jetons) | Capture de recette en clair sur tous les écrans | `contraste.test.ts`, e2e `…-coque.spec.ts` |
| 020-05 / 012-01 | Amélioré | Deux entrées de menu « Plateforme » et « Configuration système », pages à cartes (icône, nom, synthèse), détail en fenêtre centrée à bordure visible, cartes filtrées par droit, anciennes adresses conservées | Synthèses chiffrées seulement pour sauvegardes et versions | `administration-droits.test.ts`, e2e `…-administration-cartes.spec.ts`, axe sur `/plateforme` et `/systeme` |
| 012-03 | Amélioré | « Non disponible » quand le serveur ne mesure pas ; volume des pièces ; date du relevé ; `/api/admin/info` testé | Versions de Caddy et ClamAV, répartition base/pièces/journaux | `security.test.ts` « informations système », e2e `…-journal-audit.spec.ts` |
| 012-08 | Corrigé | La purge définitive d'un document cité comme preuve (fiche, lien, décision, validation) est refusée (409) | Parcours de graphe général (liés à 012-07) | `documents.test.ts` |
| 012-12 | Amélioré | Filtres période et compte, pagination, export JSON sous le droit d'exportation (comme le CSV), export tracé avec ses filtres, troncature signalée | Rien : la carte « Journaux techniques » (012-13) donne désormais accès aux entrées du serveur | `security.test.ts` « journal d'audit », e2e `…-journal-audit.spec.ts` |
| 012-04 | Amélioré | Aperçu en lecture seule du certificat avant installation (format, validité, chaîne, hôte, clé, empreinte, noms) | Modes autorité interne (autosigné) et ACME choisis dans l'interface, racine interne téléchargeable ([ADR 0050](../adr/0050-certificats-depuis-l-interface.md)) | Émission ACME réelle non constatée ; serveur ACME privé | `operations.test.ts`, `test_exploitation.py`, e2e `y-exploitation.spec.ts` |
| 012-02, 012-06 | Corrigé | Le catalogue `environment` (usages de l'IA) et ses évaluations sont supprimés ([ADR 0046](../adr/0046-retrait-du-catalogue-environnement.md), migration 037) : la Configuration GRC est le seul catalogue d'échelles et de matrices | — | `migrations.test.ts`, suite API complète |
| 012-13 | Amélioré | Carte « Journaux techniques » : niveau réglable à chaud (avertissement, info ; debug toujours temporaire, 24 h au plus), niveau appliqué lu sur le serveur, erreurs toujours collectées, journal d'audit indépendant, dernières entrées filtrables, téléchargement NDJSON sous le droit d'exportation (tracé), secrets masqués | Rétention limitée aux 5 000 dernières entrées en mémoire (la sortie du conteneur reste la source complète) | `journaux-techniques.test.ts` (8), e2e `…-administration-cartes.spec.ts` |
| 012-14 | Amélioré | Calendriers de plateforme : fériés français calculés, import iCal, mise à jour annuelle signalée, reprise par les séries ([ADR 0047](../adr/0047-calendriers-de-plateforme.md)) | Zones scolaires (écartées par décision) ; référence vivante des séries | `calendriers-plateforme.test.ts`, `jours-feries.test.ts` |
| 012-07 | Amélioré | Durées de conservation par catégorie et aperçu de ce qui serait purgé ([ADR 0048](../adr/0048-conservation-sans-purge-automatique.md)) | Purge elle-même (écartée : aucune suppression automatique) ; motifs d'exclusion | `conservation.test.ts` |
| 012-09, 012-11 | Amélioré | Contact technique ; configuration SMTP/SMTPS et message de test réel ([ADR 0049](../adr/0049-courriel-et-sortie-reseau-optionnelle.md)) | Alertes d'exploitation envoyées automatiquement ; XOAUTH2 ; Teams (écarté) | `courriel.test.ts` |
| 012-10 | Décision | — | Notifications métier par groupe ou profil, canaux et fréquences | — |

### 010 Périmètres graphiques et 022 Droits

| ID | État | Ce qui a été fait | Reste | Preuve |
| --- | --- | --- | --- | --- |
| 010-01 | Corrigé | « Modifier » depuis le graphe (même formulaire, même identifiant) | Test de double clic | e2e `…-cartes-perimetres.spec.ts` |
| 010-03 | Corrigé | Colonne « Fournisseur extérieur » (lien vers la fiche, jamais un parent) | — | e2e `…-cartes-perimetres.spec.ts` |
| 010-04 | Amélioré (*) | La carte reprend le calcul de l'écran Couverture (référentiels rattachés ou hérités, états communs) et s'appelle « Couverture » ; un enfant qui hérite n'affiche plus « indisponible » | Agrégation avec descendants, provenance et détail par référentiel | `cartes-perimetres.test.ts` |
| 010-05 | Corrigé | Écarts ouverts ventilés en majeurs (rouge), mineurs (orange foncé), sensibles (violet), avec texte ; liens vers la liste filtrée | — | `cartes-perimetres.test.ts`, e2e `…-cartes-perimetres.spec.ts` |
| 010-06 | Amélioré | Chaque compteur est un lien vers la liste du module, dans le même périmètre ; retard des écarts comparé à la date locale du périmètre | La tuile ne compte plus que les plans de type PCRA (décision 7) ; mise en forme en quatre tuiles compactes | `cartes-perimetres.test.ts` |
| 010-07 | Amélioré | Hauteur de carte agrandie pour ne rien tronquer ; `disposer` testé (parent centré, aucune carte superposée, grand arbre, noms longs) | Capture de recette avec libellés longs | `disposition-perimetres.test.ts` |
| 010-08 | Corrigé | Liaisons orientées (pointe de flèche), flux animé, pause/reprise, mouvement réduit respecté | — | e2e `…-cartes-perimetres.spec.ts` |
| 010-09 | Amélioré | Fenêtres centrées ; graphe audité par axe-core, clair et sombre | Capture de recette | e2e `…-cartes-perimetres.spec.ts` |
| 010-11 | Amélioré | État de chargement du graphe ; rechargement de la version après un 412 | Tests de double soumission et de seconde session | e2e `…-cartes-perimetres.spec.ts` |
| 010-12 | Corrigé | Les quatre fichiers du module cartographique dont le mot-clé `export` avait été retiré sont rétablis | Marqueur 010 à poser en dernier | `carto.test.ts` |
| 010-10 | Décision | — | Registres par défaut créés paresseusement (ADR 0043) : garder ou exiger un choix | — |
| 022-01 | Corrigé | Vue des accès (Registres) : rôle par registre pour une personne ou un groupe, origine, pagination | — | e2e `…-acces-sujets.spec.ts`, `registres-droits.test.ts` |
| 022-02 | Corrigé | Fenêtre d'aperçu avant confirmation (rôle avant/après, personnes concernées, rôles qui subsistent, motif) | — | `registres-droits.test.ts` |
| 022-05 | Corrigé | La trace des droits est écrite dans la même transaction que la modification | — | `droits-audit-atomique.test.ts` |
| 022-03 | Corrigé | Le collaborateur est le rôle de contributeur : droit de registre (direct ou par groupe) = tout le registre, droit sur une action = cette action seulement ; commentaire et preuve jointe à une action (migration 036, journal immuable, idempotent) ; refus de création, modification, suppression, droits et périmètres testés | Un rôle nommé « Collaborateur » n'existe pas : le libellé reste « Contributeur » | `collaborateur.test.ts`, e2e `…-collaborateur.spec.ts` |

(*) Provisoire : la mesure « Couverture » est l'option recommandée de la décision « conformité » ; elle est reprise ici faute de réponse.

### 017 Plans, 021 Écarts, 018 Tâches récurrentes

| ID | État | Ce qui a été fait | Reste | Preuve |
| --- | --- | --- | --- | --- |
| 017-01 / 021-01 / 018-01 | Amélioré | Éléments d'un registre partagé listés sous chaque périmètre qui le porte et ouverts avec leur périmètre de référence ; sélecteur de registre à la création ; filtre « Registre » et filtres conservés dans l'adresse | Regroupement par registre dans la liste ; filtre multiple | `registres-droits.test.ts`, e2e `…-registres-partages.spec.ts`, `…-filtres-taches.spec.ts` |
| 017-03 / 018-03 | Amélioré | Kanban à autant de colonnes que d'états de la politique, zone bornée, titres fixes | Test de volume sur le Kanban | e2e `…-timeline-lisible.spec.ts` (Timeline) |
| 017-06 / 018-02 | Corrigé | Timeline : intitulés fixes, zone bornée pour cent actions, état, retard et validation (OK, KO, NA) en toutes lettres, légende ; guide pointillé par ligne et carré d'occurrence (jaune en attente, puis vert OK, rouge KO, gris NA) | — | e2e `…-timeline-lisible.spec.ts` |
| 017-07 | Amélioré | Liens entrants affichés : action liée par audit d'origine ou par récidive | — | `liens.test.ts` |
| 021-05 | Amélioré | Test : un écart et une action reliés à une exigence, l'action terminée, laissent l'évaluation et l'état de l'exigence inchangés | — (le contexte d'applicabilité s'affiche à côté du lien vers une exigence) | `couverture-exigences.test.ts`, `risques-traitement.test.ts` |
| 021-06 | Corrigé | Classification en rouge, orange foncé et violet, avec légende, en liste et en fiche | — | `etat-action.test.ts`, e2e |
| 018-04 | Amélioré | Bouton de validation expliqué (désactivé hors fenêtre) | Gabarit compact, test mobile | e2e `…-validation-occurrence.spec.ts` |
| 018-05 | Corrigé | La preuve est une version de document ou une fiche de preuve (sélecteur, refus des autres objets) ; le journal affiche son intitulé selon les droits | Droit par document (décision de l'audit § 5) | `validations-occurrences.test.ts` |
| 018-06 | Corrigé | Sept préréglages (dont « Tous les deux mois ») ou personnalisé, aperçu des cinq prochaines échéances, choix « Personnalisée » effectif | — (« bimensuel » retenu comme « tous les deux mois », décision 7) | e2e `…-periodicite.spec.ts` |
| 018-10 | Amélioré | Validation (OK, KO, NA) visible dans les listes de tâches ; une occurrence validée n'est plus « en retard » | Gabarit maître-détail (décision de l'audit § 5) | `etat-action.test.ts` |
| 018-11 | Amélioré | « Occurrence suivante » cherche dans la liste courante (filtres compris), toutes séries confondues ; aucune validation automatique | Test e2e de la case d'enchaînement | `validations-occurrences.test.ts` |
| 018-08 | Amélioré | Fériés français et iCal en plateforme, avec provenance (journal) et import répété sans perte | Vacances scolaires A/B/C/Corse (écartées) | `calendriers-plateforme.test.ts` |
| 018-09 | Décision | — | Couche d'affichage des fériés derrière les tâches (Timeline, Calendrier) | — |

### 002 Risques et 003 EBIOS RM

| ID | État | Ce qui a été fait | Reste | Preuve |
| --- | --- | --- | --- | --- |
| 002-01 | Amélioré | Filtre et colonne « Étude » ; drapeau « revue dépassée » testé | Règle commune registre/carte pour l'évaluation retenue (décision 8) | `risques.test.ts` |
| 002-02 | Amélioré | Mesure d'un traitement = exigence d'un cadre publié (ex. Annexe A), proposée dans le sélecteur, lisible depuis l'exigence ; le lien ne modifie pas la couverture ; relations proposées = celles que le serveur accepte | — (l'applicabilité de l'exigence dans le périmètre est lue à côté du lien, sans effet sur la couverture) | `risques-traitement.test.ts` |
| 002-05 | Corrigé | Action de traitement avec choix du plan d'accueil (gestion exigée, même famille) ; étude archivée sans effet sur les évaluations | — | `risques-traitement.test.ts`, e2e `…-risques-traitement.spec.ts` |
| 003-01 | Amélioré | Une modification postérieure à la validation d'un atelier la rend caduque (« modifié depuis la validation ») | Schémas illustrés ; test de reprise après rechargement | `risques.test.ts` |
| 003-02 | Amélioré | Socle de sécurité saisi et restitué ; gravité de l'échelle publiée affichée avec son libellé ; niveaux contrôlés par le serveur | Barème local résiduel (gravité en dur) | `risques.test.ts`, e2e `…-risques-traitement.spec.ts` |
| 003-03 | Corrigé | Pertinence retenue différente de la proposition : justification exigée ; un couple dont le niveau écarte ne peut pas être « retenu » | — | `config-grc-etudes.test.ts` |
| 003-04 | Amélioré | Mesures de l'écosystème par référence ; justification de la dangerosité | Formule et échelle des critères en dur | `risques-traitement.test.ts` |
| 003-06 | Amélioré | Gardes testées : résiduel inacceptable avec option « accepter », étape non validée | Synthèse de l'atelier 5 ; validation de l'atelier 5 | `grc.test.ts` |
| 003-05, 003-11 | Amélioré | `StudyConfiguration` épingle une échelle de vraisemblance (scénarios opérationnels) et une échelle de gravité (scénarios stratégiques), avec contrôle serveur du niveau retenu, aperçu et migration explicites, libellé publié dans la synthèse ; études sans épinglage inchangées ([ADR 0038](../adr/0038-socle-de-configuration-grc-transversal.md), addendum) | Échelle des critères des parties prenantes (`ECHELLE_CRITERE`) toujours locale ; structuration des opérations (décision métier) | `config-grc-echelles-scenario.test.ts` (4), e2e `…-echelles-scenarios.spec.ts` |
| 003-07 | Amélioré | Suivi en liste, matrice et cercle avec sélection et filtres communs ; non placés dits explicitement ([ADR 0051](../adr/0051-couche-visuelle-ebios.md)) | Matrice colorée du registre non fusionnée ; rang numérique 1-4 seulement | `ebios-visuel.test.ts`, e2e `zzzz-ebios-visuel.spec.ts` |
| 003-08 | Amélioré | Chemins stratégiques (source → parties prenantes → événements), choix, alternatives, aller-retour avec la synthèse ; chemins incomplets non dessinés | Pas d'éditeur graphique ; séquence opérationnelle en texte libre | idem |
| 003-09 | Amélioré | Sept pictogrammes indicatifs d'après la catégorie, libellé écrit, sans reclasser la source | Reconnaissance par mots-clés | idem |
| 003-10 | Amélioré | Flux et contour épais sur le chemin choisi seulement ; pause, Animées/Automatiques/Arrêtées, mouvement réduit | — | idem |

## Décisions de l'utilisateur

Les quinze décisions restantes ont été tranchées le 25/10/2026 : voir [DECISIONS-2026-10-25.md](DECISIONS-2026-10-25.md). La liste ci-dessous garde l'historique de leur énoncé.

1. ~~Structure de l'Administration~~ **Décidé (21/10/2026)** : deux entrées, « Plateforme » (organisation, comptes, référentiels, échelles, apparence, notifications, écrans muraux, import/export) et « Configuration système » (sauvegardes, mises à jour, certificats, sécurité, sessions, journal d'audit, journaux techniques, modules, environnement), chacune en page d'accueil à cartes ; détails en fenêtres centrées ; anciennes adresses conservées en alias. Réalisé (012-01, 020-05).
2. ~~Définition de « conformité »~~ **Décidé (21/10/2026)** : « Couverture » (testées ou validées / applicables), jamais présentée comme conformité ISO/IEC 27001. Les clauses 4 à 10 sont obligatoires donc non excluables ; une exigence « à déterminer » est comptée à part et signalée comme à revoir (appliqué dans le code).
3. ~~Modèle « collaborateur »~~ **Décidé (21/10/2026)** : membre d'un groupe qui a le droit sur le registre : tout le registre ; attribué directement sur une action : cette action seulement. Réalisé (022-03).
4. ~~Canaux d'envoi (courriel, Teams), conservation et nettoyage automatique, certificats autosignés et ACME~~ **Décidé (25/10/2026)**, réalisé en partie (012-04, 012-07, 012-09 à 012-11). Les niveaux de journalisation (012-13) sont réalisés.
5. Calendriers de plateforme (zones scolaires, jours fériés) et leur couche d'affichage (012-14, 018-08, 018-09).
6. ~~Couche visuelle EBIOS RM : cercle, chemins, pictogrammes, flux animés (003-07 à 003-10)~~ **Décidé (25/10/2026)** et réalisé ([ADR 0051](../adr/0051-couche-visuelle-ebios.md)).
7. ~~« Bimensuel »~~ **Décidé (21/10/2026)** : tous les deux mois (mois × 2, comme trimestriel et semestriel) (018-06) ; ~~PCRA~~ **Décidé** : la tuile compte les plans de type PCRA seulement (010-06). Reste : liens entre périmètres et condition de clôture.
8. Règle d'évaluation retenue commune au registre et à la matrice (002-01).

## Preuves exécutées

- Tests Vitest sur PostgreSQL 18 (conteneur) : suites ciblées de chaque lot rejouées sur la copie de travail ; la suite complète de l'API est rejouée avant chaque publication.
- Parcours Playwright (conteneur `mcr.microsoft.com/playwright:v1.56.1-noble`) sur la pile Docker construite depuis le commit : cartes de périmètres, coque, Timeline (cent actions), périodicité, registres partagés, journal d'audit, traitement. La suite complète de 26 minutes tourne dans la CI de la pull request.
- Qualité : `prettier --check`, `eslint --max-warnings 0`, `tsc --noEmit` (shared, API, web).

## Idée « Processus en cartes » (cadrée le 21/10/2026, réalisée dans la 4.2.0 — [ADR 0044](../adr/0044-processus-en-cartes-et-types-de-processus.md))

Onglet Processus de la famille Organisation, en cartes au design épuré ; la cartographie des processus est générée à partir de ces cartes. Décisions de l'utilisateur :

1. **Source unique** : un processus existe une fois ; la cartographie devient une vue des processus. Créé dans la cartographie, il apparaît en carte, et inversement.
2. **Types** : le registre des types de processus (métier, opérationnel, support…) se trouve dans la Plateforme avec les autres registres et échelles ; il remplace les familles actuelles « Pilotage / Réalisation / Support », reprises comme types de départ, avec migration des processus existants.
3. **Rattachements** : SWOT, objectifs, indicateurs, risques et fournisseurs.
4. **Multiplicité** : un élément peut être rattaché à plusieurs processus (relation N–N).
5. **Imbrication** : les cartes sont imbriquées (processus et sous-processus).
6. **Disposition** : automatique (colonnes par type), avec ajustement manuel mémorisé ; un nouveau processus s'ajoute sans déplacer les autres.

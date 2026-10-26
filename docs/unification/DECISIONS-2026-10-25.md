# Décisions de l'utilisateur du 25/10/2026

Réponses données une par une aux quinze décisions en attente du [suivi ASTRA](SUIVI-ASTRA-2026-10-21.md). Chaque ligne dit ce qui est décidé et ce qui reste à faire ; rien n'est « réalisé » tant que le suivi ne le dit pas.

| N° | Sujet | Décision | Suite |
| --- | --- | --- | --- |
| 1 | Canaux d'envoi (012-09 à 012-11) | SMTP / SMTPS seulement. Le reste (Teams, autres canaux) va dans le [fichier d'idées](../08_PILOTAGE/IDEES.md). | Configuration SMTP/SMTPS, contact technique, envoi de test honnête **Réalisé en partie** ([ADR 0049](../adr/0049-courriel-et-sortie-reseau-optionnelle.md)) : configuration entièrement dans l'interface, contact technique, envoi de test réel par l'exécutant du serveur ; aucun envoi automatique encore. |
| 2 | Conservation et nettoyage (012-07, 012-10) | Durées de conservation configurables, **sans purge automatique** ; aperçu de ce qui serait purgé. | Réglages de durées et aperçu ; aucune suppression automatique **Réalisé** ([ADR 0048](../adr/0048-conservation-sans-purge-automatique.md)) : durées par catégorie et aperçu, sans aucune purge ni planificateur. |
| 3 | Certificats (012-04) | Autosigné **et** ACME. | Deux modes de génération en plus de l'import **Réalisé en partie** ([ADR 0050](../adr/0050-certificats-depuis-l-interface.md)) : autorité interne et ACME se choisissent dans l'interface (racine interne téléchargeable, retour arrière automatique). Limites : ACME non essayé contre un serveur réel ; serveur ACME privé non pris en charge |
| 4 | Calendriers de plateforme (012-14, 018-08, 018-09) | Jours fériés français et import iCal ; pas de zones scolaires ; mise à jour annuelle à la charge de l'administrateur. | Calendrier de plateforme des fériés ; zones scolaires au fichier d'idées **Réalisé en partie** ([ADR 0047](../adr/0047-calendriers-de-plateforme.md)) : calendriers, fériés calculés, import iCal, reprise par les séries. Reste la couche d'affichage (018-09). |
| 5 | Couche visuelle EBIOS RM (003-07 à 003-10) | Oui, dans le style du parcours 024. | Cercle, chemins, pictogrammes, flux, mouvement réglable **Réalisé** ([ADR 0051](../adr/0051-couche-visuelle-ebios.md)) : onglets « Suivi, matrice et cercle » et « Chemins » ; aucune migration |
| 6 | Évaluation registre / matrice (002-01) | Le **registre** porte les évaluations de risque ; la **matrice** et les échelles sont les barèmes. En cas d'écart entre le niveau enregistré et celui de la matrice courante, le registre fait foi et l'écart est signalé, sans recalcul silencieux. Vérifié contre le guide ANSSI EBIOS RM (niveau déduit de la gravité et de la vraisemblance, échelles définies par l'organisation) et ISO/IEC 27005 (la norme ne prescrit pas de matrice ni de modèle de registre). | Signalement de l'écart dans le registre **Réalisé** ([ADR 0052](../adr/0052-registre-fait-foi-matrice-bareme.md)) : colonne et filtre dans le registre, même appréciation de référence sur la carte et la matrice ; rien n'est recalculé |
| 7 | Clôture et liens ouverts | Clôture refusée tant qu'un lien est ouvert, sauf motif écrit, tracé au journal. | Garde serveur + motif **Réalisé** ([ADR 0053](../adr/0053-cloture-avec-liens-ouverts.md)) : actions liées et tâches ouvertes ; motif écrit (15 caractères) conservé avec la décision, sur la fiche et au journal |
| 8 | Catalogue « Environnement » | Supprimer le catalogue, ses évaluations des usages de l'IA et la page ; repartir au propre sur la Configuration GRC. **But précisé** : pouvoir faire l'analyse d'écart (gap analysis) d'un service, de l'IA ou d'une application interne face à un référentiel, pour construire le plan d'action. Le service analysé est **un périmètre enfant** de la hiérarchie (droits, héritage, couverture et plans d'action existants). L'utilisateur précise ensuite que le besoin est d'être **en conformité ISO 27001 / HDS avec l'IA**, plus qu'un référentiel officiel : l'analyse d'écart existante (« Applications à intégrer », déjà rattachée à l'ISO 27001 et à l'HDS, avec plan d'action) est donc complétée par des points propres à l'IA (réalisé dans la PR « Analyse d'écart d'un service qui embarque de l'IA »). Un référentiel officiel de l'ANSSI reste possible plus tard (accès réseau à ouvrir). | Migration de suppression (après la sauvegarde automatique) ; assistant « Analyser un service » ; création en lot du plan d'action des écarts ; référentiel officiel IA (ANSSI) facultatif, bloqué tant que l'accès réseau aux sites de l'ANSSI est refusé (aucun texte reconstruit de mémoire) |
| 9 | Registres par défaut (010-10) | Garder la création automatique. | Rien |
| 10 | SR/OV (019-07) | Bibliothèque partagée réutilisable (et non propres à chaque étude). | **Réalisé en partie** ([ADR 0054](../adr/0054-bibliotheque-sources-de-risque.md)) : sources sans étude, versionnées, partagées entre les études du périmètre ; choix par référence avec version retenue, dérive signalée. Limites : bibliothèque propre à un périmètre (pas d'héritage ni de bibliothèque d'organisation) ; objectifs visés non catalogués à part |
| 11 | Droit sur une preuve (018-05) | Celui du module Documents. | Rien |
| 12 | Maître-détail des tâches (018-10) | Non, garder la fenêtre centrée. | Rien |
| 13 | Parcours 024 : associations | Oui, créer les associations fiche/preuve ↔ sous-action. | **Réalisé** : table journal immuable (migration 038), droits, interface, tests |
| 14 | Parcours 024 : applicabilité HDS | Oui, lecture seule, avec la source. Jamais déduite du secteur de santé. | **Réalisé** : lecture des évaluations d'exigences du périmètre |
| 15 | Rôle collaborateur | Garder « Contributeur ». | Rien |

Rappel : l'étiquette `v4.5.0` sera posée par l'utilisateur quand tout sera implémenté.

## Décisions complémentaires du 26/10/2026

| N° | Sujet | Décision | Suite |
| --- | --- | --- | --- |
| 16 | Page « Conformité IA » | **Supprimer la page et ses données**, dans la prochaine livraison (4.5.0), après la sauvegarde automatique. | **Réalisé** ([ADR 0057](../adr/0057-retrait-de-la-conformite-ia.md)), migration 043 |
| 17 | Points IA du questionnaire « Applications à intégrer » | Les retirer dès maintenant. | **Réalisé** ([ADR 0057](../adr/0057-retrait-de-la-conformite-ia.md)) |
| 18 | Notifications métier (012-10) | Application et courriel (si configuré) ; réglage par groupe, par profil (rôle) et par utilisateur ; le réglage personnel l'emporte sur celui du groupe ; l'utilisateur règle aussi les siennes dans son profil. | **Réalisé** ([ADR 0058](../adr/0058-notifications-metier.md)) |
| 19 | Registres par défaut (010-10) | Garder la création automatique. | Rien |
| 20 | Contrôle de secrets dans la CI | Oui, comme septième contrôle (gitleaks). | **Réalisé** : travail `Secrets (gitleaks, historique complet)` |


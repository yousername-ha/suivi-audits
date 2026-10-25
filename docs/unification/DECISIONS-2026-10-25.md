# Décisions de l'utilisateur du 25/10/2026

Réponses données une par une aux quinze décisions en attente du [suivi ASTRA](SUIVI-ASTRA-2026-10-21.md). Chaque ligne dit ce qui est décidé et ce qui reste à faire ; rien n'est « réalisé » tant que le suivi ne le dit pas.

| N° | Sujet | Décision | Suite |
| --- | --- | --- | --- |
| 1 | Canaux d'envoi (012-09 à 012-11) | SMTP / SMTPS seulement. Le reste (Teams, autres canaux) va dans le [fichier d'idées](../08_PILOTAGE/IDEES.md). | Configuration SMTP/SMTPS, contact technique, envoi de test honnête |
| 2 | Conservation et nettoyage (012-07, 012-10) | Durées de conservation configurables, **sans purge automatique** ; aperçu de ce qui serait purgé. | Réglages de durées et aperçu ; aucune suppression automatique |
| 3 | Certificats (012-04) | Autosigné **et** ACME. | Deux modes de génération en plus de l'import |
| 4 | Calendriers de plateforme (012-14, 018-08, 018-09) | Jours fériés français et import iCal ; pas de zones scolaires ; mise à jour annuelle à la charge de l'administrateur. | Calendrier de plateforme des fériés ; zones scolaires au fichier d'idées |
| 5 | Couche visuelle EBIOS RM (003-07 à 003-10) | Oui, dans le style du parcours 024. | Cercle, chemins, pictogrammes, flux, mouvement réglable |
| 6 | Évaluation registre / matrice (002-01) | Le **registre** porte les évaluations de risque ; la **matrice** et les échelles sont les barèmes. En cas d'écart entre le niveau enregistré et celui de la matrice courante, le registre fait foi et l'écart est signalé, sans recalcul silencieux. Vérifié contre le guide ANSSI EBIOS RM (niveau déduit de la gravité et de la vraisemblance, échelles définies par l'organisation) et ISO/IEC 27005 (la norme ne prescrit pas de matrice ni de modèle de registre). | Signalement de l'écart dans le registre |
| 7 | Clôture et liens ouverts | Clôture refusée tant qu'un lien est ouvert, sauf motif écrit, tracé au journal. | Garde serveur + motif |
| 8 | Catalogue « Environnement » | Supprimer le catalogue, ses évaluations des usages de l'IA et la page ; repartir au propre sur la Configuration GRC. **But précisé** : pouvoir faire l'analyse d'écart (gap analysis) d'un service, de l'IA ou d'une application interne face à un référentiel, pour construire le plan d'action. Le service analysé est **un périmètre enfant** de la hiérarchie (droits, héritage, couverture et plans d'action existants). L'utilisateur précise ensuite que le besoin est d'être **en conformité ISO 27001 / HDS avec l'IA**, plus qu'un référentiel officiel : l'analyse d'écart existante (« Applications à intégrer », déjà rattachée à l'ISO 27001 et à l'HDS, avec plan d'action) est donc complétée par des points propres à l'IA (réalisé dans la PR « Analyse d'écart d'un service qui embarque de l'IA »). Un référentiel officiel de l'ANSSI reste possible plus tard (accès réseau à ouvrir). | Migration de suppression (après la sauvegarde automatique) ; assistant « Analyser un service » ; création en lot du plan d'action des écarts ; référentiel officiel IA (ANSSI) facultatif, bloqué tant que l'accès réseau aux sites de l'ANSSI est refusé (aucun texte reconstruit de mémoire) |
| 9 | Registres par défaut (010-10) | Garder la création automatique. | Rien |
| 10 | SR/OV (019-07) | Bibliothèque partagée réutilisable (et non propres à chaque étude). | À concevoir : catalogue versionné, droits, référence depuis les études |
| 11 | Droit sur une preuve (018-05) | Celui du module Documents. | Rien |
| 12 | Maître-détail des tâches (018-10) | Non, garder la fenêtre centrée. | Rien |
| 13 | Parcours 024 : associations | Oui, créer les associations fiche/preuve ↔ sous-action. | Table versionnée et journalisée, droits, interface (nouvelle migration) |
| 14 | Parcours 024 : applicabilité HDS | Oui, lecture seule, avec la source. Jamais déduite du secteur de santé. | Lecture des évaluations d'exigences du périmètre |
| 15 | Rôle collaborateur | Garder « Contributeur ». | Rien |

Rappel : l'étiquette `v4.5.0` sera posée par l'utilisateur quand tout sera implémenté.

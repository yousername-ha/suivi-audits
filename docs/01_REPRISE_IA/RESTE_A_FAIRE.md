# Reste à faire

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

L’ordre détaillé est dans [BACKLOG](../08_PILOTAGE/BACKLOG.md). Priorités :

1. Recetter l’installation réellement utilisée et accepter le parcours Pilotage.
2. Confirmer sauvegarde, clés, catalogue et possibilité de reprise hors serveur.
3. Inventorier et prioriser les familles legacy sans remplacement complet,
   puis leurs exports/liens/champs avant toute normalisation.
4. Terminer raccordements B2 ; compléter E depuis des sources officielles
   accessibles et réutilisables.
5. Mesurer coûts CI et volumes ; aucune baisse chiffrée de durée présumée.

Familles concernées : fournisseurs, CRRC, investissements, incidents/crise,
revues d’accès métier, plans ; reprises partielles audit/plan d’audit/DdA/IA ;
revues de direction présentes mais recette autonome non retrouvée.

D/J/I/F restent exclus, OIDC et exports bureautiques serveur de la feuille de
route ne sont pas déclarés livrés. L’étude L n’est pas réalisée. Aucun abandon
de fonctionnalité historique n’est présumé.

## Module Vulnérabilités (mise à jour du 20/11/2026, Europe/Paris)

Session « Module surveillance vulnérabilités SMSI ». Détail, décisions et limites : [reprise du 20/11/2026](REPRISE-2026-11-20.md)
et addenda de l'[ADR 0100](../adr/0100-module-vulnerabilites.md). Ordre de la file décidé par le RSSI :

1. Terminer la PR #339 (correctifs de performance PERF-01 à PERF-04), puis rejouer le banc de performance.
2. Veille réglementaire (ADR 0110 et migration `098` réservées) : CNIL, CEPD, EUR-Lex, ANS, ANSSI, Journal officiel par
   l'open data de la DILA ; qualification par le rôle RSSI et un rôle DPO.
3. Règles de priorité et marques décidées les 19 et 20/11/2026 (kit d'exploitation, zero-day, libellé « logiciel malveillant
   (Tenable) », fin de support, P1 sous exception).
4. CVE inconnue de la veille : cve.org et NVD sur clic, lien « Voir chez Tenable ».
5. Produits vus par Silène rapprochés des CVE « à confirmer ».
6. Rapport d'analyse de l'Active Directory importé par fichier JSON lu dans le navigateur.

Décidés sans place dans la file : rançongiciels (catalogue KEV et évaluation de la CISA), volume de la veille à mesurer,
quatre réglages des fréquences, marques « présente sur le parc » et « exposée sur Internet » sur les cartes d'avis, rapport
de pilotage en vrai PDF (plus tard). Détail : § 3 de la reprise.

Décisions encore attendues du RSSI : PERF-09 (bornes de synchronisation Tenable), ordre du calcul global de la vue d'ensemble
à priorité égale, sens des classes des constats Silène, sens du champ « type » du rapport de l'Active Directory.

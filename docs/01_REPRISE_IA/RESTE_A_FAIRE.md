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

## Module Vulnérabilités (mise à jour du 22/11/2026, Europe/Paris)

Session « Module surveillance vulnérabilités SMSI ». Détail, décisions et limites : [reprise du 22/11/2026](REPRISE-2026-11-22.md), [reprise du 20/11/2026](REPRISE-2026-11-20.md)
et addenda de l'[ADR 0100](../adr/0100-module-vulnerabilites.md). Ordre de la file décidé par le RSSI :

Livrés en 7.5.0 et 7.5.1 : correctifs PERF-01 à PERF-04 et PERF-13, outils de l'assistant (ASSISTANT-V1), règles de
priorité (PRIO-1), import du rapport AD (AD-1), veille réglementaire première tranche (VR-1, ADR 0110). Le RSSI fait ses
essais sur la 7.5.1 avant la suite ; la session Coeur rejoue le banc.

1. CVE inconnue de la veille : cve.org et NVD sur clic, lien « Voir chez Tenable », évaluation SSVC de la CISA, Security
   Center sans clic (recherche de contrôles par CVE vérifiée chez le RSSI le 20/11), préavis Cloudflare Radar toutes les
   15 minutes (produits surveillés et critiques, remplacé à l'arrivée de la fiche NVD), tldrcve en source facultative avec
   cartes « Est-ce grave ? / Êtes-vous concerné ? / Que faire ? » construites par la plateforme.
2. « Quoi faire » enrichi des correctifs regroupés de Tenable (`sumremediation`, qui répond chez le RSSI).
3. Produits vus par Silène rapprochés des CVE « à confirmer » ; actifs vus par Silène seul remis à l'assistant.
4. Veille réglementaire, tranche suivante (ADR 0110, décision du 22/11/2026) : CERT Santé actualités, Journal officiel par
   les données ouvertes de la DILA et par l'API PISTE ; rattachement d'une publication aux exigences, actions et documents
   (contrat à convenir avec la session Coeur).
6. Rapport d'analyse de l'Active Directory importé par fichier JSON lu dans le navigateur.

Lot ASSISTANT-V1 (outils de l'assistant alignés sur la vue d'ensemble, actifs exposés dans « Machines prioritaires »,
« Quoi faire » sans renvoi interne ; addendum de l'ADR 0100) : réalisé le 20/11/2026, sans migration. Restent à confirmer
par le RSSI les choix de réalisation de l'addendum (ordre des actifs exposés, rien d'exposé pour un constat de Tenable, ce
qui compte comme correctif) et, avec la session de l'assistant, la mise à jour des descriptions des outils
(`apps/api/src/assistant/outils.ts`, non touché) ; qualité des réponses non vérifiée avec un modèle réel.

Décidés sans place dans la file : rançongiciels (catalogue KEV et évaluation de la CISA), volume de la veille à mesurer,
quatre réglages des fréquences, marques « présente sur le parc » et « exposée sur Internet » sur les cartes d'avis, rapport
de pilotage en vrai PDF (plus tard). Détail : § 3 de la reprise.

Décisions encore attendues du RSSI (PERF-09 est tranché le 20/11/2026 : bornes inchangées pour la 7.5.0 ; l'ordre du calcul
global l'est aussi le 20/11/2026 : à priorité égale, le contrôle détecté le plus récemment, réalisé par le lot PERF-04) : sens
des classes des constats Silène, sens du champ « type » du rapport de l'Active Directory.

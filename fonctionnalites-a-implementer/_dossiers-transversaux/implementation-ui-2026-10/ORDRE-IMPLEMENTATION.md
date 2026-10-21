# Ordre de codage des dix dossiers

Édition du 21 octobre 2026. **Référence unique pour l’ordre technique**, remplaçant les anciennes séquences L0–L8. Les numéros de fonctionnalités restent stables ; ils ne sont pas leur ordre de réalisation. Cet ordre ne décide pas de l’ordre visuel des menus.

Lire le [prompt maître](PROMPT-IMPLEMENTATION.md), le [contrôle obligatoire de l’existant](CONTROLE-EXISTANT-ET-CODAGE.md) et l’[index des dix dossiers](DOSSIERS-2026-10-20.md). Ne coder que les écarts établis sur la branche cible. Un contrat existant et vérifié satisfait un prérequis sans réimplémentation.

## Lots et conditions de passage

| Lot | Dossiers / travail | Prérequis réels | Critère de passage |
| --- | --- | --- | --- |
| L0 | Audit des dix dossiers sur la cible | Branche/SHA et accès de lecture | Matrice par exigence : code, API, permissions, tests exécutés, état, manque exact et action retenue. Préserver tout existant conforme. |
| L1 | Fondations communes de 010, 019, 022 et des registres | L0 | Vérifier hiérarchie et UUID des périmètres, catalogue versionné, annuaires, accès multi-périmètres, applicabilité, audit, preuves et journal. Identifier les services risques, fournisseurs, BIA/PCRA, séries/occurrences. Contrats manquants isolés ; aucune reconstruction globale. |
| L2 | 020 navigation ; coque commune et entrées 012 | Inventaire routes/droits L1 ; design system existant | Routes et alias préservés, menu fixe, panneaux centraux, thèmes communs, défilements indépendants. Valider l’ordre visuel encore ouvert avant remplacement global du menu. |
| L3 | 010 périmètres — liste, graphe et hiérarchie ; 022 droits visuels | Contrats périmètres/identité/permissions L1 ; coque L2 | Création/édition réciproque sur le même ID ; héritage explicite ; fournisseur extérieur. Droits collaborateur et autorisations serveur vérifiés avant exposition des mutations. Pas de moteur de droits frontend. Les compteurs complets attendent L10. |
| L4 | 019 configuration GRC ; 012 réglages utilisés par les modules | Catalogue versionné L1 ; accès L3 | Échelles et matrices publiées utilisables sans recalcul historique ; utilisateurs/groupes/droits raccordés à 022 ; calendriers iCal et fenêtres disponibles pour 018 ; préférences métier sur profils/groupes. Aucun catalogue concurrent. |
| L5 | Noyau partagé des registres 017, 021, 018 | Périmètres et droits L3 ; contrats de registres L1 | Un ou plusieurs périmètres au registre ; éléments hérités, filtres et vues cohérents ; changements de registre/périmètres contrôlés et historique préservé. Tester les trois familles sans confondre leurs règles métier. |
| L6 | 017 plans d’action | L5 ; annuaires, transitions, preuves et journal L1 | Actions directes, dates, statuts, personne/groupe/fonction, Timeline/Kanban/Liste sur les mêmes objets. Contrats de liens disponibles pour écarts et traitement des risques. |
| L7 | 021 écarts et liens correctifs | L5 ; actions L6 ; contrats audit/exigence/applicabilité L1 | Audit → écart → action → vérification, sans clôture ou conformité automatique ; nouvelle récidive liée préservant l’ancienne clôture. |
| L8 | 018 tâches récurrentes | L5 ; calendriers/fenêtres L4 ; commandes séries/occurrences, preuves et journal vérifiés | Récurrences et fenêtres, trois vues, réalisation OK/KO/NA idempotente, auteur/heure serveur immuables, preuve centrale, enchaînement seulement après succès. N’attend pas L7. |
| L9 | 002 risques puis 003 parcours EBIOS RM | Échelles/politiques L4 ; périmètres/droits L3 ; objets risques/études/évaluations/décisions L1 ; actions L6 pour traitements | Risque canonique et matrice conformes au catalogue ; cinq ateliers et représentations cohérentes ; historique et liens Annexe A ISO 27001:2022 conservés. N’attend pas L7/L8 si ses contrats sont prêts. |
| L10 | 010 cartes — compteurs et synthèses ; 012 exploitation et intégrité | Producteurs disponibles L6/L7/L8 et conformité/BIA/PCRA ; services système réels pour 012 | Compteurs autorisés sans doublons ; indisponible ≠ zéro. Pour 012 : sauvegarde, mise à jour, stack, ressources, certificat, transports mail/Teams et contact technique, journaux, rétention et dépendances. Aucune opération simulée présentée comme réelle. |
| L11 | Recette croisée et remise par fonctionnalité | Lots nécessaires au périmètre livré | Exigences des dix dossiers et scénarios communs testés au SHA livré ; permissions, conflits, accessibilité, responsive, thèmes et cartographie protégée. Bilan, limites et marqueurs seulement pour les fonctionnalités réellement intégrées et vérifiées. |

## Éviter les dépendances artificielles

- **010 se livre en deux incréments.** Les objets, la hiérarchie et les vues arrivent avant les registres. Les compteurs attendent leurs producteurs. Ne pas attendre les compteurs pour rendre possible la création d’un périmètre ; ne pas inventer un zéro pour terminer une carte.
- **022 intervient tôt.** Les permissions existantes sont vérifiées en L1, l’interface et les compléments autorisés en L3. Le noyau de registres de L5 réutilise les contrats identifiés en L1 : aucune dépendance circulaire entre création d’un écran de droits et modèle de registre. Une permission manquante bloque la mutation concernée, pas les consultations indépendantes.
- **012 est scindé.** Les entrées arrivent avec la coque ; les réglages consommés par les modules (catalogue, calendriers, profils) précèdent leur usage. L’exploitation peut avancer dès que ses API et droits sont confirmés ; elle n’a pas à attendre les risques. Le nettoyage effectif attend le graphe complet des usages et protections des données visées.
- **019 précède les évaluations 002/003.** Lire les versions publiées et les politiques compatibles ; les données ARM servent de référence de conception, pas de référentiel normatif à importer automatiquement.
- **017 précède les liens correctifs 021 et les liens de traitement 002/003.** Les écrans de lecture des risques ou écarts peuvent avancer sans attendre la refonte des plans si les contrats d’action existants suffisent.
- **018 n’attend pas 021.** Si les occurrences reposent sur des actions du socle, vérifier ce contrat avant réalisation ; aucune obligation de créer un écart après chaque KO.
- **BIA, PCRA, conformité, preuves et annuaires ne sont pas de nouveaux dossiers à reconstruire.** Réutiliser les services vérifiés. Tout contrat manquant est transmis précisément au responsable métier ; aucun changement chez Claude.

## Index par fonctionnalité

| Dossier | Lots concernés | Référence de conception |
| --- | --- | --- |
| 020 Navigation | L0–L2, L11 | v001-menu-epure |
| 010 Périmètres | L1, L3, L10, L11 | v007-fond-uni |
| 022 Droits | L1, L3 puis contrôle à chaque mutation | v001-acces-visuels |
| 019 Configuration GRC | L1, L4, L11 | v001-dossier-arm |
| 012 Paramètres système et plateforme | L2, L4, L10, L11 | v007-echelles-partagees |
| 017 Plans d’action | L5–L6, L11 | v004-perimetres-herites |
| 021 Écarts | L5, L7, L11 | v003-cloture-preservee |
| 018 Tâches récurrentes | L4–L5, L8, L11 | v008-defilement-zones-fixes |
| 002 Risques | L9 avant 003, L11 | v001-matrice |
| 003 EBIOS RM | L9 après 002, L11 | v002-echelles-plateforme |

## Exécution et blocages

Tester chaque incrément dans l’espace de codage avant d’élargir ; L11 ne remplace pas ces contrôles. Un contrat manquant doit être décrit avec producteur, consommateur, permission, données et erreur attendus. Continuer les travaux indépendants. Aucun mock/localStorage ne remplace un service de production.

Ne modifier que sa propre branche. Legacy et Claude restent en lecture seule pour l’IA de codage. Ne pas renuméroter les dossiers ni déclencher fusion/déploiement. La préparation documentaire ne constitue pas une implémentation. Pas de ZIP/BAT sans nouvelle demande.

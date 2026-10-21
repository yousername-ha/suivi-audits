# Prompt maître — intégration des dix dossiers ASTRA

Tu dois intégrer les interfaces validées à l’application existante en réutilisant son socle métier et son design system. **Avant de coder, vérifie pour chaque exigence si elle est déjà implémentée. Conserve ce qui est conforme et vérifié ; complète uniquement les écarts.**

## Source à lire

Dossier de référence :
https://github.com/yousername-ha/suivi-audits/tree/legacy/fonctionnalites-a-implementer/_dossiers-transversaux/implementation-ui-2026-10

Lis dans cet ordre :

1. [Contrôle de l’existant et consignes](CONTROLE-EXISTANT-ET-CODAGE.md).
2. [Ordre de codage L0–L11](ORDRE-IMPLEMENTATION.md), référence unique des dépendances.
3. [Index des dix dossiers](DOSSIERS-2026-10-20.md), puis leurs DOSSIER-IMPLEMENTATION.md, prompts, spécifications détaillées et maquettes de référence.
4. [Règles communes UI/UX](SPECIFICATIONS.md), [contrats et recette transversale](INTEGRATION-RECETTE.md) et [navigation proposée](navigation.json).

Le périmètre comprend 020 navigation, 010 périmètres, 022 droits, 019 configuration GRC, 012 paramètres, 017 plans d’action, 021 écarts, 018 récurrences, 002 risques et 003 EBIOS RM. L’ordre numérique des dossiers n’est pas l’ordre de codage. Les anciennes variantes restent historiques ; les exigences actuelles identifiées prévalent.

## Espace de travail autorisé

Travaille et publie uniquement sur TA propre branche dédiée, dans ton espace. `legacy` sert de référence en lecture seule. Claude est strictement en lecture seule : aucun fichier, index, branche, référence, configuration ou état de travail modifié ; aucun build, test ou générateur susceptible d’y écrire. Ne fais aucune fusion globale ni aucun déploiement implicite. Préserve les changements locaux étrangers et la cartographie dynamique protégée.

## Méthode obligatoire

Commence par relever la branche, le SHA, l’état Git et les instructions locales. Pour chaque exigence de chaque dossier, fournis : ID → code/API/permission et SHA → preuve ou test exécuté → état → écart → action. Classe conforme et vérifié, présent non validé, partiel, absent ou indéterminé. Un Markdown ou une CI ancienne ne prouve pas le fonctionnement courant. Si indéterminé, précise le manque d’accès ou de preuve, sans conclure absent.

Suis les lots de l’ORDRE-IMPLEMENTATION.md et leurs conditions de passage. Vérifie le socle avant de refaire une interface ; réutilise les composants, clients de données, schémas, permissions et services disponibles. Les périmètres et droits précèdent les mutations des registres ; les échelles précèdent les évaluations ; les plans d’action précèdent les liens correctifs et de traitement. Les compteurs des cartes attendent leurs producteurs. Les réglages calendaires de 012 précèdent les récurrences ; l’exploitation peut avancer indépendamment lorsque ses contrats sont prêts.

Ne crée pas de moteur métier ou API concurrent. Si un contrat manque, décris le besoin pour le responsable métier et continue les travaux indépendants. Aucun stockage navigateur ou faux succès ne doit masquer un service absent. Les extensions éventuelles restent dans le périmètre explicitement autorisé et jamais dans l’environnement Claude.

## Invariants à préserver

- Liste et graphe des périmètres sont deux vues des mêmes objets ; mêmes UUID et mutations. Le fournisseur est externe, lié à son registre canonique.
- Le registre porte un ou plusieurs périmètres ; actions, écarts, séries et occurrences héritent de ce contexte sans sélecteur indépendant. Les accès et changements de contexte sont contrôlés côté serveur ; aucun historique immuable réécrit.
- Risques et EBIOS utilisent les versions publiées du catalogue 019, exposé dans 012. Ne pas recopier les barèmes des fixtures ni recalculer les évaluations passées. Conserver les liens Annexe A ISO 27001:2022 et les différences d’applicabilité HDS/ISO 9001.
- Une action terminée n’implique ni écart clos ni conformité acquise. Preuves, décisions et évaluations conservent identité, version, acteur et heure serveur.
- Réutiliser le style 08, les thèmes globaux, icônes colorées, panneaux centraux et menu fixe avec zones de défilement bornées. Prévoir clavier, mobile, focus et mouvement réduit. Ne pas modifier la cartographie dynamique historique.
- Paramètres système : secrets côté serveur, contrôles d’accès réels, journaux techniques distincts de la traçabilité ; nettoyage dépendant des usages, protections et liens réexaminés avant traitement. Les notifications métier restent dans profils/groupes ; le contact technique reçoit les alertes d’exploitation.

## Recette et livraison

Teste chaque incrément dans ton espace : critères du dossier, parcours positifs/négatifs, permissions serveur, conflits, doublons, erreurs, accessibilité, responsive et non-régression. Exécute build/typage/lint/tests selon les scripts réels de la cible. Ne confonds pas tests historiques de maquette et recette de l’application.

Livre le relevé d’existant, les changements ou l’absence justifiée de changement, les composants réutilisés, branche/SHA, commandes et résultats, captures et blocages. Pas de ZIP/BAT sans demande.

Quand une fonctionnalité et sa version sont réellement intégrées et vérifiées, publie sur TA branche son fichier `implementation/IMPLEMENTATION-OK.md` avec numéro, version, périmètre livré, branche/SHA, tests et limites. Si elle n’est que partielle, fournis un bilan partiel sans marqueur de livraison complète. Codex consultera le marqueur et gérera le classement documentaire sur `legacy` ; ne déplace pas toi-même ses dossiers de référence.

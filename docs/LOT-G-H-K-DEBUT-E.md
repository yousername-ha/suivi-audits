# Pilotage multi-référentiels — G, H, K et début E

## Périmètre

Le diagnostic utilisateur et technique est dans [le diagnostic préalable](archive/diagnostics/2026-10-10-pilotage-ghke.md). Le guide métier est [PILOTAGE.md](PILOTAGE.md). D, J, I et F restent explicitement hors de cette livraison ; le lot E est commencé, pas déclaré entièrement livré.

Le menu reprend les familles historiques et la charte Sauge. Les onze onglets techniques et la création de SMSI disparaissent du parcours normal. Les écrans affichent une rubrique métier à la fois, des formulaires français et des décisions explicites. Sur téléphone, les registres deviennent des fiches lisibles avec leurs commandes accessibles. Les UUID et noms d’attributs ne servent plus de libellés de saisie courante.

## G — preuves et contrôles

Documents physiques/versionnés existants, liens multi-objets et consultation bidirectionnelle conservés. Un examen conserve les références `document:ID:version` exactes, sans copie. Les réalisations de contrôles enregistrent résultats, dates, justificatifs et décisions immuables ; écarts et actions peuvent être générés dans la même transaction. Les types, catégories et fréquences utilisent la politique métier existante. Les répétitions utilisent les séries/occurrences du lot C, rappels et vues d’actions ; tableau de bord des contrôles non réalisés et retards. Le contrôle exécuté et la clôture de l’action planifiée demeurent distincts selon le workflow configuré.

## H — amélioration

Origines audit, risque, incident, mesure, contrôle, revue ou autre ; constats/non-conformités/opportunités, causes, échéances, responsables et priorités. Les constats communs sont écrits directement dans `findings` ; les périmètres privés utilisent les objets du même moteur. Les actions sont liées, sans deuxième registre d’écarts pour les données communes. Efficacité et clôture exigent des décisions documentées ; les clôtures sont gardées côté serveur, y compris contre les appels génériques ou nouvelles décisions sur une fiche close.

Les compteurs d’actions ouvertes/closes/en retard utilisent le moteur partagé. Les résultats d’efficacité, causes récurrentes et délais d’écarts utilisent les données renseignées. Les délais sont des jours calendaires dans le fuseau du périmètre, avec nombre de constats datés annoncé. Les agrégats natifs sont calculés en SQL ; la liste de causes est bornée à 1 000 causes natives, explicitement signalée, sans borner les compteurs/délais globaux. Les actions historiques n’ayant pas de date de création/clôture exploitable ne produisent pas un faux délai.

## K — parcours guidé

Démarches qualité/SMQ, sécurité/SMSI, HDS, intégrée ou personnalisée. Onze étapes pédagogiques communes : contexte, périmètre, responsabilités, risques, traitement, applicabilité, documents, mesure/contrôle, audit, revue, amélioration. L’applicabilité n’impose pas une DdA ISO 27001 à une démarche qualité. Les activités et le périmètre HDS doivent être justifiés si cette démarche est choisie. Le parcours référence les objets existants, ne crée pas de copies de système de management. Enregistrement/reprise et validations historisées par version du parcours ; une modification du périmètre demande une nouvelle revue. Aucun score de conformité ou certificat automatique.

## Début E

BIA (services, ressources, dépendances, scénarios, impacts temporels, criticité, service minimum, durée maximale d’interruption, reprise et perte de données), plans distincts PCA/PRA/PCRA/activité, validations, exercices et RETEX. Les objectifs de reprise ne peuvent dépasser la durée maximale déclarée. Les liens réutilisent processus, actifs, risques, mesures, documents et actions. Rapports HTML imprimables et JSON avec décisions. Les schémas et formulaires constituent une première structure générique : les grilles officielles ANS, configurations de méthodologies de continuité et ressources D2 indisponibles restent à intégrer après vérification de version, licence et contenu. Aucune partie CaRE/financement du lot D n’est implémentée.

## Données et sécurité

Migration additive `015_pilotage_decisions.sql`, initialisation par l’installation existante, aucun service/secret/dépendance supplémentaire. Les tables privées `grc_smsis` et API de compatibilité restent conservées. Le périmètre commun change de nom seulement si son nom initial n’a pas été personnalisé.

Décisions immuables (triggers UPDATE/DELETE/TRUNCATE), identifiant de réessai unique et empreinte d’intention, version requise, verrouillage transactionnel, audit et notification atomiques. Contrôles serveur des droits métier, accès aux périmètres, activations de modules, références, rôle de validation, MFA/session, origine et CSRF. L’édition générique ne peut fabriquer une validation, une efficacité, une clôture ou un résultat de contrôle. Les libellés de justificatifs historiques sont résolus avec les droits actuels ; les références conservées demeurent traçables après suppression d’un document.

Adaptateurs directs pour contexte, parties intéressées, SWOT, responsabilités, processus, objectifs, indicateurs, preuves, constats et revues. Les identifiants synthétiques de rôles ne sont pas écrits dans le socle. Les séries de valeurs, décisions structurées et champs non modélisés sont préservés. Les deux libellés de menu historiques sont adaptés ; l’archive v2 n’est pas modifiée.

## Vérification

Tests serveur : migration vierge et v2, schéma ORM identique, droits, version documentaire réelle v1/v2, absence de copie physique, immutabilité/idempotence, contrôle générant constat/action, récurrences, causes/efficacité/actions/clôture, anti-contournement, héritage, reprise/prérequis et historique qualité, BIA/plan/export, périmètres privés et agrégation de 10 000 constats.

Recette Playwright : quatre parcours C conservés/adaptés à la navigation ; preuves versionnées et contrôle/écart/action, parcours qualité enregistré/repris/validé, BIA et plan liés sur téléphone et rapport imprimable. Assertions CSP/JavaScript et absence de débordement conservées. Les références visuelles touchées par la nouvelle navigation sont revues avant renouvellement. La CI complète reste nécessaire sur le commit final de PR, notamment pour le déploiement, la mise à jour intégrée et le retour arrière.

Vérifications locales du 10 octobre : **587 tests Vitest** (222 shared, 102 UI, 246 API, 17 web), TypeScript, ESLint, formatage et build réussis. Sur une installation Docker/TLS neuve, **100 tests Playwright** passent : installation, cartographie, responsive/captures historiques et trois parcours G/H/K/E. Les neuf références historiques concernées sont renouvelées après inspection de la navigation et des écrans ; les assertions CSP et les seuils de comparaison sont conservés. Deux nouvelles références protègent le plan de contrôle sur ordinateur et la continuité sur téléphone. Le test d’exploitation lié au dossier serveur reste vérifié par la CI complète, dont les fixtures reproduisent l’installation standard.

## Sources

Les étapes/formulaires sont des choix organisationnels, sans reproduction de textes normatifs. Ressources officielles : [ISO 27001](https://www.iso.org/fr/standard/27001), [ISO 9001](https://www.iso.org/standard/62085.html), [HDS/ANS](https://esante.gouv.fr/services/hebergeurs-de-donnees-de-sante), [kits de continuité ANS](https://esante.gouv.fr/strategie-nationale/cybersecurite/axe-1). Ces liens indiquent la provenance à consulter ; ils ne valent pas vérification ou acquisition des contenus indisponibles. Les métadonnées méthodologiques de risques et publications C restent dans [sources-lot-c.json](sources-lot-c.json).

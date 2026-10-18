# Diagnostic avant reprise du Pilotage — G, H, K et première étape E

La recette utilisateur du 10 octobre signale une interface inutilisable : création de SMSI imposée visuellement, langage de modèle de données, onze onglets sans hiérarchie. L’existant historique organise le pilotage en contexte, objectifs/indicateurs, conformité, écarts/actions, fournisseurs, preuves et plans. La demande actuelle impose de reprendre cette organisation, un pilotage multi-référentiels (SMQ ISO 9001 compris), G/H/K et un début E. D/J/I/F sont explicitement exclus.

## Capacités réutilisables

React/Mantine, charte Sauge, menu latéral, routes et autorisations serveur ; objets/relations/historiques GRC et documents avec versions physiques ; actions/séries récurrentes et vues C ; données historiques dans app_state avec verrou/version ; publications immuables des référentiels et méthodes ; canevas cartographique. Les tables grc_smsis restent un espace technique de conservation/droits : aucun effacement ni regroupement des périmètres privés existants. Le parcours normal utilise l’espace commun automatiquement, sans créer un système de management.

## Lacunes à traiter

G : preuves génériques sans validation de la version examinée, contrôle sans exécution structurée/écart/action générée. H : pas de formulaire natif d’écart avec causes et efficacité, ni clôture gardée ; préserver findings et leurs tâches directement. K : pas de parcours métier reprenable ni critères vérifiables ; ne pas transformer une progression documentaire en conformité. E : pas de BIA/plan/exercice natifs ; démarrer une structure générique reliée aux processus/ressources/risques, sans reproduire un kit ANS indisponible ni implémenter CaRE.

## Solution

Menu Pilotage hiérarchique et écrans par métier, libellés français, résumés et actions explicites ; configuration avancée séparée. Formulaires typés, adaptateurs de lecture/écriture de l’historique sans copie, validations serveur, commandes traçables/idempotentes et décisions immuables. Migration additive pour les décisions de pilotage et index. Début E limité aux BIA, plans distincts PCA/PRA/PCRA et exercices/RETEX configurables ; aucun contenu normatif inventé. Tester sécurité, concurrence, références aux documents exacts, efficacité/clôture, reprise du parcours, héritage et responsive/CSP. La navigation change volontairement ; les captures concernées seront examinées, pas remplacées aveuglément.

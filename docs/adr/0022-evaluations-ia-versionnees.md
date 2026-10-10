# ADR 0022 — Décisions IA versionnées sur les sources historiques

Statut : acceptée. Date : 2026-10-10. Périmètre : B2b.

## Contexte

`app_state.ai.evals` est le registre opérationnel des scénarios IA. La v2 calcule un indice à chaque affichage et export, sans conserver une configuration de calcul par décision. B2a fournit des échelles organisationnelles immuables, dont la méthode diffère du calcul IA historique. Les appliquer silencieusement modifierait les résultats.

## Décision

Conserver le registre comme source éditable unique et ajouter `risk_assessments` (migration additive 011). Une nouvelle décision référence un identifiant existant non ambigu et une version publiée explicitement choisie ; elle conserve l’instantané complet et son SHA-256, les niveaux choisis, le résultat calculé par le serveur, la justification, l’auteur et la date. Les clés inconnues et l’ordre des tableaux participent à l’empreinte. Les niveaux ne sont jamais convertis automatiquement depuis les notes historiques.

Prévisualiser ne crée aucune décision. La confirmation ENREGISTRER, l’empreinte de la prévisualisation, If-Match de la dernière révision et le SHA de source sont obligatoires. Le verrou sur `app_state` sérialise l’enregistrement avec les mutations/imports historiques ; la décision et l’audit partagent la transaction. Un UUID de demande assure un réessai identique, réservé au même auteur. Une reprise modifiée est refusée. Le serveur vérifie droits IA, MFA, origine, CSRF et activation B1. L’export exige également le module et le droit import/export.

Les déclencheurs PostgreSQL interdisent UPDATE, DELETE et TRUNCATE des décisions. Les configurations référencées sont déjà immuables. L’identité de l’auteur est conservée sans cascade liée au compte. Une source retirée conserve son historique mais ne peut être réévaluée ; une source conditionnelle ou ambiguë doit être corrigée dans le registre. L’écran Sauge distingue calcul historique courant et décisions conservées ; il rend les instantanés consultables et signale une source changée.

## Conséquences et limites

Aucun changement du fichier v2 archivé ou de ses calculs/exports. L’accès au nouvel écran se fait par le guide et le menu utilisateur adapté à l’exécution. Aucun nouveau service ni paquet. La migration s’exécute pendant le démarrage normal sur installation neuve ou existante. Les sauvegardes/restaurations PostgreSQL transportent les décisions ; l’export JSON v2 ne les transporte pas et aucun import de décisions n’est proposé.

Un instantané est limité à 256 Ko, la liste à 50 scénarios par page, l’historique à 25 décisions (50 maximum par requête), l’export complet à 1 000 décisions. Les dépassements ne sont pas tronqués silencieusement. La liste utilise seulement des résumés de décisions ; les définitions et instantanés complets sont chargés au détail/historique. L’historique des configurations propose les 100 dernières versions ; toute version connue reste consultable par l’API. Une republication de configuration ne recalcule jamais les décisions. Le raccordement des autres familles et les nomenclatures/workflows B2 restent à développer ; cette livraison ne migre pas l’ensemble du module IA.

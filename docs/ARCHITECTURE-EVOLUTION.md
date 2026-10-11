# Architecture d'évolution minimale SMSI / GRC

> Mise en perspective — 11 octobre 2026 : Ce cadrage historique précède plusieurs livraisons A/B/C/G/H/K. Les formulations « reste à concevoir » ne sont pas l’état courant : lire le [DAT](03_ARCHITECTURE/DAT.md) et le [registre](02_FONCTIONNALITES/INVENTAIRE_FONCTIONNEL.md).


Ce cadrage complète ARCHITECTURE.md et les ADR existantes ; il n'ajoute ni service ni modèle parallèle. Le backlog et ses critères sont dans [BACKLOG-EVOLUTION-SMSI-GRC.md](BACKLOG-EVOLUTION-SMSI-GRC.md).

## Contrats conservés

Les écrans Sauge réutilisent packages/ui et ses jetons. Les nouvelles routes passent par route(), droits serveur et CSRF ; les données versionnées utilisent If-Match. Les preuves réutilisent documents/document_versions et leur chiffrement. Les cartes gardent seulement la disposition ; la donnée métier vient des sources communes.

Le document legacy n'est pas recopié dans chaque nouveau module. Toute normalisation conserve les identifiants et données inconnues et fournit un mapper pour recomposer l'export, comme cartographie. Une migration publiée reste inchangée. Une structure destructive nécessite extension/reprise puis réduction en versions séparées.

La reprise s'applique aussi à **toutes les fonctions encore sous l'ancien style**, inventoriées dans [REPRISE-SOCLE-LEGACY.md](REPRISE-SOCLE-LEGACY.md). Ni une archive du code ni un lien vers `/legacy` ne constituent une migration fonctionnelle terminée. Chaque famille garde une source modifiable unique jusqu'à la validation de sa nouvelle interface Sauge.

## Trois décisions préalables aux grandes extensions

1. **Activation ≠ autorisation ≠ visibilité.** Un registre décrit modules et dépendances. La sécurité, les sessions et l'intégrité restent indispensables. La désactivation s'applique au serveur, conserve données et historique et doit expliciter son effet sur tâches/imports/intégrations. Un filtre de dashboard n'active ni ne désactive une capacité.
2. **Référentiel générique, SMSI facultatif.** Les organisations peuvent choisir leur référentiel, y compris ISO 9001 seul ou une PSSI personnalisée. Versions/exigences/mesures/preuves/mappings appartiennent au moteur commun ; les parcours ISO/HDS et programmes CaRE ne font qu'orchestrer ces objets. Les évaluations gardent les versions d'échelles et les sources utilisées.
3. **Exploitation hors API métier.** La pile actuelle est isolée sans Internet pour API/base. Sauvegarde/restauration et TLS nécessitent un exécutant à commandes prédéfinies, un protocole de tâches/audit et un périmètre fixe. Ne pas introduire accès Docker, shell arbitraire ou clés privées en réponse pour satisfaire une interface web. Documenter les modes compatibles et le rollback avant de les implémenter.

Ces décisions fixent les contraintes. Le protocole A1a est implémenté et décrit dans l’[ADR 0016](adr/0016-pilotage-sauvegardes.md) : file SQL exclusive et audit atomique, requêtes idempotentes, annulation If-Match, heartbeat, puis exécution de backup.sh par une tâche hôte sous verrou. L’API ne reçoit aucun chemin, secret ou commande. La restauration guidée, la planification web et TLS restent à concevoir dans leurs lots. Les données ou conclusions réglementaires ne sont pas supposées : sources officielles/versionnées et validations humaines sont nécessaires.

## Fiabilisation de session livrée

Le cache conserve sa requête de session observée. Après fermeture confirmée par le serveur, les lectures sont annulées, les données privées supprimées et le compte local devient anonyme ; le jeton CSRF est effacé. BroadcastChannel transmet seulement l'événement logout, sans identifiant ni secret, pour fermer l'affichage des autres onglets. Le flux SSE utilise la même purge quand le serveur signale une session révoquée/expirée. La relecture de session purge aussi les données privées quand elle devient anonyme.

Un échec réseau/CSRF/serveur ne vaut pas fermeture réussie : l'interface montre l'erreur et permet de réessayer. Une réponse 401 signifie que la session est déjà expirée ; la purge locale est alors possible. Les permissions et la validité de la session restent contrôlées par l'API, sans changement de MFA ou de cookie.

L'écran mural possède une autorisation distincte de la session utilisateur. Sa requête observée n'est pas supprimée lors de l'initialisation anonyme : cela annulerait son chargement et masquerait le refus après révocation. À la déconnexion utilisateur, sa donnée est réinitialisée et les observateurs actifs recontrôlent l'accès auprès de l'API. Le droit mural n'est pas déduit du cache ni accordé par le navigateur.

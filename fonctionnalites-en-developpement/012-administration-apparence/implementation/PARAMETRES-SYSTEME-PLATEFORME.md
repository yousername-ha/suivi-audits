# Paramètres système et plateforme — proposition v004

Statut : maquette à valider, dossier préparatoire. [Galerie et sources courantes](../maquettes/v004-historique-conservation/README.md). Cette version étend 012, sans créer un second module d’administration concurrent. Elle ne remplace pas les fonctionnalités 019 Configuration GRC et 022 Gestion des droits : elle fournit leurs points d’entrée.

## Navigation proposée

Administration contient deux entrées : « Paramètres système » et « Paramètres plateforme ». La page expose les mêmes deux destinations. Conserver un état de navigation unique ; à l’intégration, raccorder chaque entrée aux routes et alias existants. Les filtres s’appliquent à la page sélectionnée et sont réinitialisés en changeant d’espace. Les anciens liens directs doivent continuer à fonctionner.

Système : deux sections de trois cartes, Exploitation puis Supervision & sécurité. Plateforme : trois sections de trois cartes, Évaluation & référentiels, Utilisateurs & accès, Préférences communes. Chaque carte associe icône colorée, nom, courte description, information de synthèse et accès au détail. Les chiffres et badges de la maquette sont des fixtures, pas un diagnostic.

La recherche et la grille restent compactes. Le menu fixe possède sa propre zone de défilement ; le contenu défile indépendamment. Les détails s’ouvrent au centre. Sur mobile : menu repliable, cartes en colonne et fenêtre contenue dans l’écran. Un parcours complexe, tel qu’une restauration ou un inventaire paginé de comptes, pourra poursuivre dans une page de détail plutôt qu’allonger indéfiniment la fenêtre.

## Écrans et comportements à raccorder

| Carte | Contenu et action attendus |
|---|---|
| Sauvegardes/restauration | Historique, état de l’exécutant, planification UTC, rétention, demande de sauvegarde ; restauration dans un parcours distinct avec copie sélectionnée, compatibilité et confirmation de l’impact |
| Mises à jour | Version installée/disponible, notes, état de vérification ; préparation, confirmation puis suivi du travail demandé |
| Stack technique | Inventaire des composants, versions, état, date et source de la relève |
| Ressources/stockage | Capacité/utilisation disque, base, pièces, sauvegardes, journaux ; CPU et mémoire uniquement si le serveur les expose |
| Certificat HTTPS | Domaine, chaîne, échéance, état, renouvellement/remplacement ; vérifications avant changement |
| Journaux/diagnostics | Événements techniques, filtres de date/service/gravité, pagination et détails sans secrets |
| Échelles | Impact, sévérité, probabilité et autres types du catalogue ; niveaux, critères, brouillon, usages, prévisualisation et publication versionnée |
| Matrices/seuils | Références vers les versions d’échelles, grille et seuils ; ne pas modifier automatiquement les évaluations passées |
| Catalogues | Catégories, types et correspondances réellement supportés, sans registre de configuration parallèle |
| Utilisateurs | Réutiliser comptes, état, groupes, expiration et opérations d’administration existants |
| Groupes/fonctions | Séparer équipe porteuse de droits et fonction responsable ; aucun droit implicitement accordé par une responsabilité |
| Rôles/droits | Ouvrir la vue 022 ; Collaborateur toujours proposé selon la définition en attente de confirmation |
| Apparence | Réutiliser le choix global Sauge/Clair, applicable à tous ; pas de préférence utilisateur concurrente |
| Calendriers | Import iCal, source, date de synchronisation, zones et jours fériés ; distinguer visualisation et effet sur les récurrences |
| Notifications | Préférences, destinataires, canaux et rappels réellement disponibles ; respecter les accès aux objets |

## Existant lu, sans modification

Instantané Claude `284cb1e4ffbaee37e0952073db5659c2257c888e`, consulté le 20 octobre 2026. Il s’agit d’une lecture de code, pas d’un test de fonctionnement ni d’une vérification de la dernière branche distante.

- `apps/api/src/routes/admin.ts` : `GET /api/admin/systeme` et `/api/admin/info` pour informations système ; `GET/POST /api/admin/sauvegardes` et annulation d’une demande. Les routes demandent une exécution au service, elles ne constituent pas une preuve d’exécution réussie.
- `apps/api/src/routes/operations.ts` : `GET /api/admin/exploitation`, `PUT /api/admin/exploitation/politique`, `POST /api/admin/exploitation/operations`, annulation. La description couvre sauvegarde, vérification, restauration et TLS. `tls_install` exige HTTPS ; conserver ce contrôle et les contrats `OperationIn` existants.
- `apps/api/src/routes/updates.ts` : `GET /api/updates`, `POST /api/admin/updates/check`, `POST /api/admin/updates/install`. Réutiliser les états et le contrat de confirmation ; ne pas assimiler une réponse 202 à une installation réussie.
- `apps/api/src/routes/config-grc.ts` : catalogue `/api/config-grc/items`, brouillon, prévisualisation, publication immuable, usages, impact, variantes et archivage. Réutiliser ces ressources pour 019 ; les échelles illustrées ne constituent pas des seuils normatifs.
- Comptes, groupes et droits : consulter le [relevé de 022](../../022-gestion-droits/implementation/README.md), en réexaminant les contrats actuels de la branche cible avant codage.
- Apparence : réglage global déjà identifié dans le [dossier 012](README.md), à recontrôler avant intégration.

CPU, mémoire, détails de tous les composants, état de renouvellement et certains réglages de notification/calendrier ne sont pas confirmés par ce relevé. Afficher « Non disponible » si une source manque. Ne pas fabriquer de métriques ni inventer une API concurrente. Le backend doit fournir les données et leurs autorisations ; l’interface ne donne pas accès à l’hôte.

## Garanties d’intégration

Afficher uniquement les cartes consultables et distinguer consultation et modification. Le serveur contrôle chaque accès ; masquer une carte n’est pas une autorisation suffisante. Conserver MFA/CSRF, concurrence If-Match, idempotence et journalisation prévus par les contrats. Afficher les erreurs, permissions refusées, opérations en attente, annulées, échouées et réussies avec leur véritable état.

Aucune clé privée, secret, contenu d’une sauvegarde ni donnée personnelle ne doit figurer dans une capture ou un journal. La maquette TLS ne collecte aucune clé. La restauration et le déploiement nécessitent leurs validations explicites dans le produit ; aucun de ces actes n’est exécuté pour cette livraison visuelle.

Les échelles publiées et évaluations historiques restent versionnées. Les changements de brouillon sont séparés de la publication. Le changement d’apparence reste global. Les périmètres sont toujours ceux des registres ; les pages de paramètres ne créent pas de rattachement divergent sur les éléments.

## Ordre et limites

Auditer les contrats actuels sur la branche de codage (L1), raccorder coque/navigation et écrans de consultation (L2), puis les formulaires et opérations autorisées avec leurs tests métier. Les composants de 019 et 022 sont réutilisés à leur place. Les nouveaux écrans ne bloquent pas arbitrairement les autres modules.

La présente livraison propose une navigation et six aperçus. La recette v002 comptait dix-neuf contrôles locaux vérifiant les interactions principales, la mémoire de simulation, le lien vers 022 et les dimensions. Aucun backend, exécutant système, déploiement, sauvegarde, restauration ou changement TLS n’a été testé. Le contraste et l’accessibilité complète restent à recetter.

Après validation de cette version, finaliser contrats, scénarios de recette et prompt, puis déplacer le dossier entier vers « à implémenter ». L’IA de codage travaille uniquement sur sa propre branche ; Claude et legacy lui servent de références en lecture. Un marqueur d’implémentation vérifié sera nécessaire pour le classement « implémenté ».

## Extension v003 — personnalisation des échelles

Demande utilisateur confirmée : pouvoir ajouter/supprimer pour personnaliser les échelles, au-delà de libellés fixes. La maquette prévoit création, duplication, nom et nature, niveaux ajoutables/supprimables/réordonnables, score, couleur et description libre. Un niveau garde son identifiant lors d’un déplacement. La duplication crée de nouveaux identifiants.

Le contrat lu dans `packages/shared/src/config-grc.ts` (`ScaleDefinition`, `ScaleLevel`) expose déjà niveaux, descriptions, valeurs, couleurs, nature et versions. Il impose 2 à 20 niveaux, identifiants uniques, valeurs renseignées strictement croissantes, score obligatoire en quantitatif. Les limites numériques sont reprises du schéma : −1 milliard à +1 milliard. La maquette applique ces règles ; élargir leur plage éventuelle relève d’une décision métier, pas d’une divergence silencieuse du frontend.

Le champ « Description / critère » de chaque ligne représente la description libre du niveau. Les critères par dimension, l’unité, la catégorie, l’applicabilité, l’acceptabilité et l’effet du niveau existent aussi dans le contrat ; ne pas les effacer lors de l’édition d’un objet réel. Ils ne sont pas édités dans cette proposition ciblée. Conserver ces attributs dans l’adaptateur, ou les exposer dans un détail avancé lors de leur conception.

Une modification de niveau constitue une nouvelle proposition de version, pas une réécriture de l’ancienne. Avant publication : appeler la prévisualisation et lire usages/impact ; vérifier les matrices et correspondances qui référencent les identifiants retirés. Les analyses historiques restent épinglées à leur version. Le nouveau nombre de niveaux n’impose pas de recalcul des anciennes évaluations.

Supprimer : brouillon jamais publié seulement, avec confirmation. Archiver : échelle déjà publiée, conservée pour ses usages historiques et retirée des nouveaux choix. La suppression en masse ou une cascade vers les évaluations n’est pas prévue. La maquette illustre ces états avec des snapshots fictifs ; l’autorisation, la concurrence et l’intégrité appartiennent au serveur.

## Extension v003 — les trois modes de certificat

1. **Certificat fourni** : sélectionner certificat/chaîne PEM et clé PEM ; présenter après contrôle serveur domaine/SAN, dates, empreinte, chaîne et correspondance clé/certificat. Le prototype conserve uniquement les noms ; il ne lit pas le contenu des fichiers. Les formats chiffrés/PFX et passphrases ne sont pas présentés comme supportés par le contrat actuel.
2. **Autosigné** : noms DNS/SAN, durée souhaitée, choix de clé illustratif. Faire générer la clé dans le service d’exploitation, jamais dans les fichiers de maquette. La durée et les algorithmes seront validés par la politique réelle. Prévoir confirmation et suivi du changement ; un autosigné ne devient pas automatiquement une autorité reconnue par les postes.
3. **ACME** : Let’s Encrypt ou annuaire configurable ; staging/production pour Let’s Encrypt, liste de noms DNS, contact, validation HTTP-01 ou DNS-01 et renouvellement. Pour un autre service, résoudre son annuaire, ses conditions et capacités côté serveur. Le choix affiché n’atteste aucune compatibilité backend existante.

HTTP-01 utilise le port 80 et ne délivre pas de certificat générique ; DNS-01 permet les noms génériques, nécessite la gestion du TXT et peut être automatisé via une API DNS compatible. Les identifiants doivent être limités au besoin et conservés côté serveur, pas dans le navigateur ou les logs. [Documentation officielle des challenges](https://letsencrypt.org/docs/challenge-types/).

Prévoir un essai en staging avant émission de production. Les certificats staging ne sont pas reconnus par les magasins de confiance habituels ; ne pas les présenter comme un certificat de production. [Documentation officielle du staging](https://letsencrypt.org/docs/staging-environment/).

Le prototype illustre les noms DNS. Ne pas en déduire le support ou l’absence de support des adresses IP par le produit final : vérifier le client, l’autorité et les contrats retenus. Les valeurs `example.org`/`exemple.test` sont des exemples, jamais des domaines à émettre réellement pour cette livraison.

### Correspondance backend réellement observée

Même instantané en lecture seule `284cb1e4ffbaee37e0952073db5659c2257c888e`. `OperationIn` dans `packages/shared/src/exploitation.ts` expose `tls_install` avec `certificate` et `privateKey`, ainsi que `tls_reset` avec confirmation. Le reset n’est pas assimilé à une génération autosignée personnalisable. `HostState` expose le mode TLS (`env`, `web`, `external`). `apps/api/src/operations.ts` refuse une modification incompatible avec une gestion serveur/externe.

L’import doit donc réutiliser les opérations existantes en vérifiant la capacité de l’exécutant et HTTPS. Les contrats dédiés d’émission autosignée avec SAN/durée/type de clé et de compte/émission/renouvellement ACME ne sont pas démontrés par ce relevé. Demander leur prise en charge au socle métier avant raccordement ; ne pas leur inventer des endpoints. Si le TLS est géré par un proxy ou service externe, afficher le responsable et l’état, sans proposer un changement local impossible.

### Parcours réel à finaliser

Prévisualiser les changements, confirmer l’application puis suivre l’opération. Conserver le certificat actif jusqu’au succès du remplacement ; prévoir l’échec et le retour à la configuration précédente. Une demande acceptée ne vaut pas certificat installé. Pour ACME : journal de challenge, prochain renouvellement, erreurs, reprise et notification ; aucun renouvellement réussi fictif dans le produit.

Conserver permissions serveur, MFA/CSRF, concurrence, chiffrement des secrets et audit sans secrets. L’annuaire ACME personnalisé doit être validé selon la politique réseau de l’installation ; HTTPS seul n’est pas une protection suffisante contre les requêtes serveur non autorisées. Les conditions de l’autorité doivent être présentées et acceptées dans le parcours réel. La case de la maquette ne réalise aucun acte auprès d’un service.

### Recette v003

39 contrôles locaux exécutés : personnalisation, suppression/archivage, conservation des snapshots, limites du contrat, import fictif, durée autosignée, choix ACME, joker HTTP/DNS, annuaire HTTPS, erreurs, mobile et absence d’appels API. [Résultats](../maquettes/v003-echelles-certificats/technique/verification.json). Aucune vérification cryptographique, connexion DNS, demande ACME, publication d’échelle ou modification réelle du serveur.

Six nouveaux visuels remplacent les détails d’échelles/certificat de v002 comme référence courante. Les vues générales à cartes restent celles du même parcours. La version v002 est conservée à titre historique.

## Extension v004 — historique, conservation et nettoyage

Demande utilisateur : activer ou désactiver un nettoyage après un délai afin de maîtriser le volume de la plateforme. La carte « Historique & nettoyage » complète les paramètres système. Elle ouvre trois onglets : Règles, Prévisualisation, Journal & corbeille. Les autres paramètres restent dans le même parcours ; aucune nouvelle famille de menu principale.

### Règles de la proposition

Le réglage global est désactivé par défaut ; les catégories peuvent être préparées indépendamment. Enregistrer une activation passe par la prévisualisation et une confirmation explicite. Désactiver la politique suspend les futurs passages ; les catégories désactivées ne doivent plus être traitées, y compris leur purge automatique.

| Catégorie | Début du délai | Exemple fictif | Traitement initial |
|---|---|---|---|
| Justificatifs | Retrait explicite, après contrôle des références | 24 mois | Corbeille |
| Écarts | Dernière clôture effective | 36 mois | Archivage |
| Actions | Fin effective avec statut terminé | 36 mois | Archivage |
| Exports temporaires | Génération du fichier temporaire | 30 jours | Corbeille |
| Journaux techniques | Rotation du segment de journal | 90 jours | Corbeille |

Ces valeurs ne fixent aucune durée légale ou normative. Elles devront être décidées par l’organisation selon ses besoins de conservation. Une preuve utilisée par une évaluation ou un dossier conservé ne devient pas supprimable du seul fait de son ancienneté. Ne pas utiliser la date de création d’une action comme date de fin ni la date d’ajout d’un fichier comme date de retrait.

La configuration illustrée accepte des durées entières positives en jours, mois et années. Les mois/années sont calendaires, avec ajustement au dernier jour du mois cible si nécessaire ; la recette couvre février et les années bissextiles. Une date absente/invalide exclut l’élément. Le passage proposé est quotidien, à une heure UTC explicite ; ce choix d’interface ne crée pas de tâche réelle.

Trois étapes distinctes : archivage consultable dans les vues historiques, corbeille restaurable, suppression définitive. La purge est une seconde option, désactivée initialement, limitée à la corbeille créée par la politique et soumise à un délai de récupération séparé (30 jours fictifs). La maquette ne permet pas de purger un objet mis en corbeille au même passage. Une restauration remet l’élément à disposition et ajoute une protection pour éviter son retrait immédiat au prochain passage ; sa levée devra être une opération autorisée et tracée dans le produit.

### Exclusions et intégrité

Réévaluer au moment du traitement : statut actif/rouvert, références bloquantes, protection de conservation, date et politique encore applicables. Répéter ces contrôles avant purge. Le prototype traite toute référence de sa fixture comme bloquante ; le serveur devra résoudre les références métier réelles, les liens transversaux et les versions, et expliquer précisément le blocage.

Les périmètres restent hérités des registres. Aucun changement de périmètre ne doit rendre invisible un lien qui protège une preuve. Préserver les validations immuables, les décisions, les versions d’échelles et les évaluations historiques. Le journal d’audit est distinct des journaux techniques : il n’est pas visé par cette politique. La rétention des sauvegardes reste dans son module dédié.

Aucune suppression en cascade implicite d’un registre, de ses pièces ou d’un plan lié à un écart. Une clôture ne suffit pas à établir l’éligibilité. Pour les fichiers, examiner toutes les références, variantes et versions partageant un même objet de stockage ; le fichier physique n’est éliminable que s’il n’est plus référencé et n’est soumis à aucune protection.

### Prévisualisation et traçabilité

La prévisualisation liste les objets avec leur date de référence, traitement envisagé ou motif d’exclusion ; distinguer nombre d’archives, de mises en corbeille et de purges éligibles. Afficher la date du calcul, la version de politique et un état périmé si les règles ou objets changent. Un ancien aperçu n’autorise pas à ignorer les changements intervenus depuis.

Dans le produit, conserver un journal serveur des changements de politique et passages : identifiant, version, déclencheur/acteur, dates, portée autorisée, états par étape, identifiants d’objets, motifs d’exclusion/échec, nombres et volumes réellement traités. Conserver une trace minimale de suppression sans dupliquer le contenu supprimé ni ses secrets. Prévoir pagination, filtres, consultation des détails et reprise des échecs. Le journal local de la maquette n’est ni immuable ni une preuve d’audit.

### Code existant consulté en lecture seule

Même instantané Claude `284cb1e4ffbaee37e0952073db5659c2257c888e`. Dans `apps/api/src/routes/documents.ts`, `DELETE /api/documents/:id` met en corbeille ; `purge=1` requiert un document déjà en corbeille et la permission supplémentaire `documents:administrer`. `POST /api/documents/:id/restore` restaure le document. Des événements d’audit sont écrits. La route observée montre une suppression de métadonnées SQL ; elle ne démontre pas à elle seule l’effacement des fichiers physiques ou la protection complète des liens.

Ces routes ne constituent pas un moteur de rétention transversal. Aucun contrat de politique globale, planificateur, prévisualisation, corbeille des écarts/actions ou collecte des fichiers orphelins n’est confirmé par ce relevé. La politique de sauvegarde et la purge des sessions existantes sont des sujets différents. Ne pas appeler une suppression générique de document pour prétendre traiter un écart ou une action.

Réutiliser services, permissions et traces existants après vérification dans la branche de codage actuelle. Faire préciser les capacités manquantes au socle métier avant raccordement, sans créer d’API concurrente. Les champs `stage`, `refs`, `hold` et `autoTrash` de cette maquette sont des fixtures, pas un schéma serveur prescrit.

### Exécution et objectif de performance

Le serveur devrait traiter des lots bornés, avec index adaptés aux statuts/dates, pagination stable, verrouillage contre les passages concurrents, idempotence, reprise sur incident et progression consultable. Ne pas charger tous les objets dans le navigateur. Recontrôler les droits et protections dans la transaction ; après engagement des métadonnées, la suppression physique doit suivre un travail fiable et rejouable, sans casser de référence.

L’archivage peut alléger les vues courantes mais ne réduit pas automatiquement le disque ni les coûts de requête. La corbeille conserve les fichiers. La purge de lignes SQL ne garantit ni l’effacement des blobs ni la restitution immédiate de l’espace au système. Afficher séparément volumes potentiellement récupérables, volumes réellement supprimés et consommation observée après traitement ; ne pas compter plusieurs fois un fichier partagé. Aucune promesse de gain de performance à partir des chiffres fictifs.

La recette d’intégration devra mesurer temps de requêtes, taille des index/tables et stockage avant/après sur un jeu représentatif. Tester notamment réouverture concurrente, ajout de preuve partagée, suspension de politique, droits insuffisants, annulation, verrou de conservation, restauration, perte/reprise du travail et cohérence après incident entre base et fichiers. L’activation réelle de suppression devra être validée dans le produit, pas déduite de l’approbation d’un visuel.

### Livrable et recette v004

Quatre nouveaux aperçus et 39 contrôles locaux exécutés : règles indépendantes, dates calendaires, exclusions, confirmation, recontrôle avant passage, conservation en corbeille, restauration protégée, purge limitée, désactivation, absence d’appels API, mobile et conservation des entrées échelles/certificats. [Résultats](../maquettes/v004-historique-conservation/technique/verification.json). Aucun job réel créé, aucune donnée supprimée, aucune mesure de performance serveur.

La version reste à valider, dans le dossier en développement. Après validation, compléter les contrats et recette du dossier avant déplacement vers « à implémenter », conformément au cycle existant.

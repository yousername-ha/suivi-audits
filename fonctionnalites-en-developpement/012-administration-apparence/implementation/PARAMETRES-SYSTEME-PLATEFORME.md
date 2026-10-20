# Paramètres système et plateforme — proposition v003

Statut : maquette à valider, dossier préparatoire. [Galerie et sources courantes](../maquettes/v003-echelles-certificats/README.md). Cette version étend 012, sans créer un second module d’administration concurrent. Elle ne remplace pas les fonctionnalités 019 Configuration GRC et 022 Gestion des droits : elle fournit leurs points d’entrée.

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

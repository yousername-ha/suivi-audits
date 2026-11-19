# ADR 0100 — Module Vulnérabilités : veille sur listes fiables, lecture de Tenable Security Center et d'Ekialis, priorité calculée par la plateforme, alerte par l'assistant

- Statut : **acceptée** par le RSSI le 15/11/2026, dans la session (« t'as mon accord »). Numéro 0100 annoncé au RSSI et retenu
  par lui le même jour (libre sur toutes les branches du dépôt à cette date). Les lots démarrent ; les points ouverts gardent
  leur réponse proposée tant que le RSSI n'en décide pas autrement (lecture de la session, à confirmer par lui).
- Date : 2026-11-15
- Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`)
- Contexte : le RSSI demande, le 15/11/2026, un **module de surveillance des vulnérabilités** : suivre les failles publiées à
  partir du nom du fournisseur et du produit, récupérer par API les éléments de **Tenable Security Center** (interne) et
  d'**Ekialis**, surveiller les publications, et faire **prioriser et alerter l'assistant RSSI** quand une faille est exploitée
  (exemple donné : une faille de PHP). Cadrage détaillé et lots :
  [CADRAGE-MODULE-VULNERABILITES](../unification/CADRAGE-MODULE-VULNERABILITES.md).
- S'appuie sur : [ADR 0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md) (API sans accès sortant),
  [ADR 0019](0019-activation-modules.md) (modules), [ADR 0032](0032-fournisseurs-de-l-organisation.md) (fournisseurs),
  [ADR 0058](0058-notifications-metier.md) (notifications), [ADR 0076](0076-module-integrations.md) (connecteurs en lecture
  seule, appels réseau par l'exécutant), [ADR 0086](0086-assistant-rssi-integre.md) (assistant),
  [ADR 0097](0097-flux-sortants-pilotes-par-les-modules.md) (flux pilotés par les modules).

## Décisions du RSSI (15/11/2026)

| N°  | Question                  | Décision                                                                                                                                         |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| V1  | Place dans l'application  | **Nouveau module « Vulnérabilités »**, avec ses droits et son activation. Il s'appuie sur le socle des connecteurs de l'ADR 0076                  |
| V2  | Sources de veille         | **CERT-FR, CERT Santé, catalogue CISA des failles exploitées (KEV), EPSS, NVD**. Des **listes fiables** seulement, pour limiter l'injection       |
| V3  | Tenable Security Center   | Lu **par API**. La plateforme est **hébergée en interne** et peut le joindre                                                                     |
| V4  | Ekialis                   | Lu **par API**                                                                                                                                   |
| V5  | Ce que reçoit le modèle   | **Des agrégats seulement**, par faille et par produit (gravité, exploitation, nombre de machines). Ni nom de machine ni adresse IP ne sort (précisé par V14) |
| V6  | Rôle de l'assistant       | Il **priorise et alerte** en cas d'exploitation                                                                                                  |
| V7  | Démarrage                 | Cadrage et ADR d'abord, **sans code**                                                                                                            |
| V8 | Style des écrans | Celui de la **page de mise à jour** (Neon), dans l'esprit d'un **poste de commandement** : supervision de type militaire |
| V9 | Radar | Chaque point du radar est **une faille réellement remontée**, placée par la plateforme |
| V10 | Fiche d'une faille | Elle porte la **recommandation**, le **vecteur d'attaque traduit en clair avec des icônes** et un **schéma** qui le représente |
| V11 | Recherche et vues | **Barre de recherche** (CVE, produit, éditeur) ; vue **par faille** avec les machines touchées ; vue **par machine** avec le nombre de failles par gravité |
| V12 | Rôles et périmètres | Le RSSI indique les serveurs **front, back applicatif et base de données**. Par périmètre, une vue montre les machines **ensemble**, ou le front relié au back, séparés |
| V13 | Machines | Elles sont **récupérées d'Ekialis et de Tenable** et rangées dans la plateforme. Remplace la proposition initiale (détail laissé dans Tenable) |
| V14 | Assistant et machines | L'assistant **classe les machines par criticité**. Il **n'envoie ni nom, ni adresse IP, ni rôle** au modèle : c'est **la plateforme, en local**, qui replace le résultat sur les machines au retour du modèle |
| V15 | Accès expérimentaux de Tenable | L'accès « solutions » (correctifs) et l'**inventaire des machines** de Tenable sont retenus **bien qu'expérimentaux**. Essai du 16/11/2026 : « solutions » est refusé au compte de consultation ; les correctifs sont lus par l'analyse, accès stable, sans élargir le rôle du compte |
| V16 | Marques | Un **avertissement** sur la machine qui porte une faille zero-day ; une **icône propre** aux failles exploitables |
| V17 | Alerte critique | Une **grande fenêtre rouge** quand une faille critique de type zero-day touche le parc |
| V18 | Systèmes qui ne sont plus maintenus | Les constats de Tenable **sans CVE** (système ou logiciel obsolète) entrent dans le module et comptent dans le rang de la machine (16/11/2026) |
| V19 | Textes de Tenable | Affichés **en anglais, tels quels** : pas de traduction par le modèle (16/11/2026) |
| V20 | Produit déclaré non détecté | Quand un produit surveillé (par exemple GLPI) n'est pas détecté automatiquement, le RSSI **relie lui-même le produit aux machines** qui le portent (16/11/2026) |
| V21 | Version du produit déclaré | Un produit se déclare **avec sa version** (par exemple GLPI 10.1.2) ; c'est elle qui sert au rapprochement avec les failles publiées (16/11/2026) |
| V22 | Produit déclaré sans machine reliée | Une faille rattachée à un produit déclaré **compte comme présente**, même sans machine reliée (16/11/2026) |
| V23 | CERT Santé et exploitation | Une publication du CERT Santé compte comme exploitation **quand elle l'écrit** : faille exploitée, ou exploitable (16/11/2026) |
| V24 | Décision de rapprochement | Une confirmation ou un rejet **peut être annulé** (16/11/2026) |
| V25 | Assistant et CVE | Quand le RSSI donne une CVE à l'assistant, celui-ci dit **si l'organisation est touchée, quoi faire, quels actifs traiter d'abord**, et propose un **plan d'action** ; à voir avec la session « Assistant RSSI intégré plateforme » (16/11/2026) |
| V26 | Plusieurs sources | **« Ou » logique entre les sources** : la surveillance est multi-source, et **la source en avance prime** (première à publier une CVE, première à signaler une exploitation). Aucune source n'est attendue pour agir (16/11/2026) |
| V27 | Valeurs différentes selon les sources | La **plus sévère** sert à la priorité ; chaque valeur est gardée avec sa source (16/11/2026) |
| V28 | Branchement de l'assistant | Réalisé par la session du module Vulnérabilités, la session « Assistant RSSI intégré plateforme » en étant informée (16/11/2026) |
| V29 | Noms des machines dans une action de l'assistant | Une action proposée par l'assistant puis confirmée **peut nommer les machines** ; rien d'identifiant ne part pour autant chez le fournisseur du modèle (16/11/2026) |
| V30 | Contenu d'une action | Toute action créée depuis le module, par une personne ou sur proposition de l'assistant, porte **le ou les noms des machines touchées et/ou le ou les noms des applications touchées**, selon ce qui est connu (16/11/2026). Remplace le choix du lot V4b (action sans nom de machine) |
| V31 | Masque et noms d'applications | Le **masque strict reste la règle** ; une **liste de mots à ne pas masquer**, tenue par le RSSI, lève le contresens quand une machine porte le nom d'une application (« dpi », « pacs », « web ») (17/11/2026) |

## Faits relevés le 15/11/2026

- **Existant** : l'ADR 0076 est acceptée, mais le module Intégrations n'est pas réalisé (DEV-006, « À FAIRE ») : ni table
  `integrations`, ni commandes `integrations-claim` et `integrations-finish`, ni socle HTTP de l'exécutant. L'assistant
  (ADR 0086) et le registre des flux (ADR 0097, `packages/shared/src/flux-externes.ts`) existent. Le registre des fournisseurs
  existe, sans notion de produit ; la cartographie applicative a été retirée (ADR 0089).
- **Sources essayées depuis le conteneur de la session** (une requête de lecture chacune, réponse 200) :
  - CISA KEV : `www.cisa.gov`, fichier JSON unique (1 781 failles, champs `cveID`, `vendorProject`, `product`, dates) ;
  - EPSS : `api.first.org/data/v1/epss`, JSON (score et centile par faille) ;
  - NVD : `services.nvd.nist.gov/rest/json/cves/2.0`, JSON ;
  - CERT-FR : flux RSS des alertes et des avis ; l'adresse historique `www.cert.ssi.gouv.fr` renvoie vers `cert.cyber.gouv.fr` ;
  - CERT Santé : flux RSS `cyberveille.esante.gouv.fr/alertes-et-vulnerabilites/rss.xml` (titre « produit - identifiant CVE »).
- **Hébergement** : le RSSI indique que la plateforme est hébergée en interne. L'ADR 0086 décrivait un VPS ; ce point ne
  change rien à l'assistant, dont le modèle reste distant.
- **Tenable Security Center 6.9** (version indiquée par le RSSI) : la documentation publique donne l'authentification par clés
  d'API (`x-apikey`), l'API de session étant dépréciée en 6.9 ; les failles par `POST /analysis` avec des vues agrégées et
  le détail par machine ; les machines par `GET /hosts` ; le correctif par `/solutions`, annoncé expérimental. Relevé complet
  au [cadrage, §5 bis](../unification/CADRAGE-MODULE-VULNERABILITES.md).
- **Non vérifié** : l'API de Tenable Security Center telle que l'instance du RSSI l'expose (la documentation publique décrit
  une interrogation `POST /rest/analysis` de type `vuln` ; l'authentification par clé d'API et les vues agrégées restent à lire
  sur l'instance) ; **l'existence, le contenu et les conditions d'une API Ekialis** (rien trouvé sur le site public) ; les
  conditions d'usage et les limites de débit de chaque source ; un téléchargement en masse des scores EPSS ; l'accès par API à la liste des machines touchées et au correctif indiqué par
  Tenable ; ce qu'Ekialis sait des machines, de leur rôle et de leur périmètre ; la consigne détaillée du CERT-FR, absente du
  flux RSS (seul un résumé y figure).

## Décision

1. **Nouveau module `vulnerabilites`**, ajouté à `MODULES`, désactivable (ADR 0019), avec des dépendances facultatives vers
   `fournisseurs`, `ecarts` et `assistant`. Actions :
   - `vulnerabilites:lire` : failles suivies, produits surveillés, état des sources ;
   - `vulnerabilites:modifier` : qualifier une faille, confirmer un rapprochement, tenir les produits surveillés ;
   - `vulnerabilites:administrer` : sources de veille, connecteurs, secrets, seuils de priorité.

   Créer une action à partir d'une faille exige **en plus** le droit du registre des actions et l'écriture sur le périmètre.
   Migration additive qui recrée la contrainte des modules, sans réécrire une migration publiée.

2. **Registre des produits surveillés.** Une fiche par produit : fournisseur (lien vers `SUP-nnn` quand il existe), nom du
   produit, version, identifiant normalisé facultatif (CPE), criticité, responsable, origine (saisie, Ekialis, Tenable). C'est
   la base de la veille « par fournisseur et par produit ». Le registre est proposé **au niveau de l'organisation**, comme les
   fournisseurs (ADR 0032) : point à confirmer par le RSSI (voir « Points ouverts »).

3. **Veille par l'exécutant d'exploitation, jamais par l'API ni par le modèle.** L'API garde zéro accès sortant (ADR 0014).
   Un script isolé de l'exécutant, sur le modèle de `courriel-envoi.py` (`python -I`, uid 65534, environnement minimal, durée
   bornée, bibliothèque standard seule), télécharge les sources retenues :
   - **liste fermée d'hôtes, écrite dans le code** : aucune adresse de source n'est réglable dans l'interface ;
   - lectures seules, HTTPS, certificat vérifié, taille et nombre d'éléments bornés, redirections suivies seulement vers un
     hôte de la liste ;
   - téléchargement **en masse ou par fenêtre de dates**, jamais par produit : les requêtes ne révèlent pas le parc ;
   - cadence par source, inscrite par le tic de l'API ; le résultat revient par la CLI, comme pour le courriel.

4. **Un flux déclaré par besoin** dans le registre de l'ADR 0097, fermé par défaut, ouvert par l'activation et sa validation
   explicite, refermé par la désactivation du module :
   - `veille-vulnerabilites` : sortie TCP 443 vers les cinq sources ; ce qui sort : l'adresse IP du serveur et des demandes de
     lecture, aucune donnée métier ;
   - `tenable` et `ekialis` : sortie vers l'adresse réglée de chaque outil ; ce qui sort : la clé d'API et des requêtes de
     lecture. Le flux vers Tenable ne quitte pas le réseau interne ; il est déclaré quand même, puisqu'il quitte le serveur.

5. **Les avis sont des données, pas des consignes.** De chaque source, la plateforme ne retient que des **champs
   structurés** : identifiant de la faille (CVE), identifiant de l'avis, fournisseur et produit, gravité, exploitation avérée,
   score EPSS, dates, adresse de l'avis. Le texte libre (titre, résumé) est débarrassé de son balisage, borné en longueur et
   rangé comme texte venu de l'extérieur. Un identifiant qui ne respecte pas son format est écarté. Les flux RSS sont lus avec
   la bibliothèque standard, taille bornée, toute déclaration de type de document refusée. **Aucun lien n'est jamais ouvert**
   par l'assistant.

6. **Tenable Security Center : connecteur en lecture seule**, sur le socle de l'ADR 0076 (instance, secret scellé en écriture
   seule, exécution en file, exécutant, rapport sans secret). L'interrogation de Tenable est une lecture émise par `POST` :
   le socle, qui refuse les méthodes d'écriture, admet pour ce connecteur une **liste fermée de points d'accès de lecture**. Le
   connecteur demande des résultats **déjà filtrés et agrégés par faille** : gravité, exploit disponible, nombre de machines
   touchées, première et dernière détection. Il lit aussi **les machines touchées** par chaque faille (V13) : nom, adresse, identifiant dans Tenable, dates
   de détection. Les points d'accès et les champs sont lus sur l'instance, pas supposés ici.

7. **Ekialis : connecteur en lecture seule** qui alimente le registre des produits surveillés et l'inventaire des machines
   (point 14) par **propositions** soumises à
   décision (`pending | confirmed | rejected | withdrawn`), comme les fournisseurs GLPI de l'ADR 0076. Tant que son API n'est
   pas lue sur sa documentation, aucun champ n'est supposé ; à défaut d'API utilisable, un import de fichier la remplace.

8. **Rapprochement entre une faille publiée et l'organisation**, par ordre de fiabilité :
   - **détectée** : Tenable rapporte la faille sur au moins une machine ;
   - **produit concerné, à confirmer** : la faille vise un produit surveillé, par identifiant normalisé s'il est renseigné,
     sinon par nom normalisé du fournisseur et du produit. Un rapprochement par nom est toujours **confirmé ou rejeté par une
     personne** ; un rejet n'est pas reproposé à données égales ;
   - **sans rapport connu** : la faille n'est pas suivie.

   Un produit surveillé peut être **relié à la main à une ou plusieurs machines** (V20). Une faille publiée pour ce produit
   est alors rattachée à ces machines avec la mention « déclaré », distincte de « détecté par Tenable » : elle compte pour la
   machine, sans prétendre à une détection.

   **Rapprochement par version (V21).** La version d'un produit surveillé est obligatoire. Une faille publiée est rattachée
   d'office au produit quand la source donne une **plage de versions touchées** et que la version déclarée s'y trouve ; elle
   est écartée quand la version déclarée est hors de la plage. Quand la source ne donne aucune plage (avis sans version,
   CVE sans configuration publiée) ou que les versions ne se comparent pas sûrement, le rattachement est **proposé** et une
   personne le confirme ou le rejette. La version déclarée se tient à jour à la main, ou par Ekialis s'il la fournit : une
   version périmée fausse le résultat, et l'écran affiche la date de dernière mise à jour de la fiche.

9. **Priorité calculée par la plateforme, pas par le modèle.** Des règles déterministes classent chaque faille suivie selon
   quatre faits : exploitation avérée (présence au catalogue KEV, alerte du CERT-FR ou du CERT Santé), présence dans
   l'organisation (détectée, à confirmer), gravité, score EPSS. Les seuils se règlent avec `vulnerabilites:administrer`. Le
   plus haut niveau est : **exploitée et détectée**. Aucun taux n'est inventé ; chaque niveau cite les faits qui le fondent.

10. **Suivi d'une faille.** Chaque faille suivie porte un état décidé par une personne : nouvelle, à traiter, en cours,
    corrigée, risque accepté, non concernée. Le traitement passe par une **action du registre existant**, liée à la faille :
    pas de second registre d'actions. Quand Tenable ne rapporte plus la faille, la plateforme **propose** de la passer
    « corrigée » ; la personne décide.

11. **Assistant RSSI** (ADR 0086), en plus et non à la place :
    - un outil de lecture rend les failles suivies **en agrégats** (V5), avec leur priorité calculée et leurs faits ;
    - une faille qui atteint le plus haut niveau déclenche une **ronde sur événement** ; l'assistant rédige l'alerte, rappelle
      le responsable du produit et peut **proposer une action**, décidée par une personne ;
    - **classement des machines** (V14) : la plateforme calcule le rang de chaque machine (point 16) et remet au modèle une
      liste où chaque machine n'est qu'un **repère** (« M-01 ») avec ses compteurs. Le modèle explique le classement et
      propose les actions en citant ces repères ; **la plateforme, en local, remplace chaque repère par la machine** avant
      d'afficher ou de notifier. La table de correspondance ne quitte jamais le serveur ;
    - **ne partent jamais chez le fournisseur du modèle** : nom de machine, adresse IP, rôle, identifiant dans Tenable ou dans
      Ekialis. Un test le prouve sur la requête émise. Un repère inconnu dans la réponse du modèle est écarté ;
    - le modèle hiérarchise et rédige ; il ne calcule ni priorité ni nombre, n'ouvre aucune page, n'écrit dans aucun registre.

    **Sans assistant, le module alerte quand même** : une notification métier (ADR 0058) part vers les personnes désignées
    quand une faille atteint le plus haut niveau. La surveillance de base ne dépend pas du modèle.

12. **Traçabilité.** Chaque collecte, chaque synchronisation et chaque décision écrit un audit `vulnerabilites.*`, sans secret.
    Chaque source affiche la date de sa dernière collecte réussie ; une source en panne est signalée.

13. **Aucune dépendance nouvelle**, ni côté API ni côté exécutant.

14. **Inventaire des machines** (V12, V13). Une fiche par machine : nom, adresse, origine (Tenable, Ekialis), identifiant
    dans la source, **rôle** (front, back applicatif, base de données, ou non renseigné), **périmètre**. Tenable et Ekialis
    apportent les machines ; le rôle et le périmètre viennent d'Ekialis s'il les fournit, sinon ils sont indiqués par une
    personne, une machine à la fois ou en masse (`vulnerabilites:modifier`). Une machine se lit à travers les droits de son
    périmètre (ADR 0092 et 0095) ; une machine sans périmètre n'est visible qu'avec `vulnerabilites:administrer`.

15. **Recherche et vues** (V11). Une barre de recherche commune au module cherche dans l'identifiant de la faille, le nom du
    produit, l'éditeur et le nom de la machine, dans la limite de ce que la personne peut lire. Deux vues rangent les mêmes
    résultats : **par faille**, chaque faille se dépliant sur ses machines regroupées par rôle ; **par machine**, avec le
    nombre de failles critiques, élevées, moyennes et faibles.

16. **Rang d'une machine, calculé par la plateforme.** Ordre : faille dont l'exploitation est avérée, puis rôle (front avant
    back avant base de données), puis nombre de failles critiques. Le rang affiche les faits qui le fondent. Le rôle entre
    dans ce calcul local et ne sort pas du serveur (V14). La vue par machine montre des icônes de machines rangées par ligne,
    avec une **frontière visible** entre le front et le back, puis entre le back et les bases ; ces frontières séparent les
    rôles indiqués et ne prouvent pas un cloisonnement du réseau. Deux modes : **réduit**, qui ne garde que les machines les
    plus prioritaires de chaque ligne, et **grand écran**, qui montre tout le parc. Deux marques s'affichent sur une machine et sur une faille : un **avertissement** pour une
    faille **zero-day** (exploitation en cours) et une **icône d'éclair** pour une faille **exploitable** (un code
    d'exploitation existe, d'après le champ `exploitAvailable` de Tenable, sans exploitation observée). La définition exacte
    du zero-day reste à arrêter (point ouvert).

17. **Vue par périmètre** (V12). Pour un périmètre, deux présentations : **globale**, toutes les machines ensemble ; **par
    ligne**, le front en première ligne, relié au back applicatif, lui-même relié aux bases de données. Les liens sont
    tracés **entre lignes**, pas de machine à machine : aucune source connue ne fournit ces liens (point ouvert).

18. **Radar et niveau d'alerte** (V8, V9). Chaque point du radar est une faille suivie, placée par un calcul fixe :
    distance au centre selon la priorité (puis le score EPSS), secteur selon la **famille du produit**, taille selon le
    nombre de machines touchées, couleur selon la priorité, cercle vide pour un produit à confirmer, halo pour une
    exploitation avérée. Seul le faisceau tournant est décoratif. Un **niveau d'alerte** à quatre crans (veille, vigilance,
    alerte, maximale) est calculé par la plateforme ; le dernier cran correspond à une faille exploitée et détectée. La
    famille du produit est un champ du registre des produits surveillés.

19. **Vecteur d'attaque et recommandations** (V10). Le vecteur publié avec la faille (CVSS) est traduit par une **table fixe**
    de la plateforme : chaque valeur a son libellé et son icône, un schéma va de l'attaquant à la cible puis à l'effet, et
    une phrase en clair est composée à partir des mêmes valeurs. Le modèle n'intervient pas. Sans vecteur publié, la fiche
    l'indique. Les **recommandations** sont celles des sources, bornées et présentées par source : action exigée et
    échéance du catalogue KEV, correctif indiqué par Tenable, renvoi vers l'avis du CERT-FR ou du CERT Santé. Le correctif de Tenable est lu par la vue des correctifs de
    l'analyse (`sumremediation`), accès stable, qui a répondu le 16/11/2026 avec un compte de rôle Auditor ; l'accès
    expérimental `/solutions`, refusé à ce rôle, n'est pas utilisé. Si la lecture échoue, la fiche affiche les autres
    recommandations et signale que celle de Tenable est indisponible, sans bloquer la synchronisation.

20. **Charte** (V8). Les écrans reprennent le langage visuel de la page de mise à jour (`docker/maintenance`), porté dans
    `packages/ui` et l'interface native, sous la CSP stricte (ADR 0006). Maquettes de référence, données fictives :
    [maquettes-vulnerabilites](../unification/maquettes-vulnerabilites/).

21. **Fenêtre d'alerte critique** (demande du RSSI du 15/11/2026). Quand une faille atteint le plus haut niveau (exploitée et
    détectée), une **grande fenêtre rouge** s'affiche par-dessus l'écran, pour les personnes qui ont le droit de lire le
    module et la faille : produit, identifiant, nombre de machines, sources de l'exploitation, heure. Elle reste affichée
    tant que la personne ne l'a pas **prise en compte** ; la prise en compte est tracée dans le journal d'audit. Une seule
    fenêtre par faille et par personne tant que la faille ne change pas. Elle s'ajoute à la notification du point 11 et ne
    dépend pas de l'assistant. Les animations s'arrêtent avec le réglage « mouvement réduit » du système (ADR 0099).

## Avancement

- **Lot V1** (15/11/2026) : module `vulnerabilites`, migration `072`, registre des produits surveillés.
- **Socle des connecteurs** (16/11/2026) : module `integrations`, migration `073`, connecteur Tenable Security Center limité
  au test de connexion, flux `tenable` ; voir l'addendum de l'[ADR 0076](0076-module-integrations.md). Les points d'accès
  portent le préfixe `/rest`, observé sur l'instance du RSSI.
- **Veille, lots V2 et V3** (16/11/2026) : migration `074`, collecte des cinq sources par l'exécutant
  (`scripts/veille-vulnerabilites.py`), flux `veille-vulnerabilites`, écran « Veille » avec recherche. Précisions par rapport
  aux points 3 et 5, à confirmer par le RSSI :
  - **aucune redirection n'est suivie**, même vers un hôte de la liste (plus strict que le point 3) ;
  - CERT-FR : hôte `cert.cyber.gouv.fr` ; son flux RSS ne cite aucune CVE, elles sont lues dans l'export JSON de chaque
    alerte et de chaque avis nouveau, sur le même hôte (80 lectures au plus par collecte) ;
  - une collecte par source et par jour, plus « Collecter maintenant » ; NVD par fenêtre de dates de modification (7 jours
    de rattrapage au plus) ; EPSS demandé seulement pour des CVE déjà publiées par les autres sources, 2 000 au plus par jour ;
  - une source est signalée en retard après 36 heures sans collecte réussie ;
  - le retour de l'exécutant se fait par lots bornés (500 éléments, 40 lots par collecte) ;
  - les scripts de l'exécutant joignent les sources **directement** : un serveur qui ne sort que par un mandataire (proxy)
    n'est pas pris en charge à ce jour.
  Non vérifié : aucune collecte réelle par l'exécutant (tests sur un faux service local), conditions d'usage des cinq sources,
  limites de débit de NVD et d'EPSS.
- **Lot V5, lecture des failles et des machines de Tenable** (16/11/2026) : migration `075`, opération « synchroniser » du
  connecteur, écrans « Failles détectées » et « Machines ». À confirmer par le RSSI :
  - **droits resserrés** : le module est réservé par défaut à l'administrateur et au RSSI (point ouvert 13, réglage prudent
    appliqué) ; il ne peut plus être ouvert à l'auditeur externe ;
  - seuls les champs listés d'un résultat sont gardés ; le texte détaillé du contrôle (`pluginText`) ne sort jamais du script ;
  - une synchronisation par jour et par instance, critiques et élevées par défaut, 20 000 détections au plus ; au-delà, la
    synchronisation est incomplète et ne fait rien disparaître ;
  - une détection absente d'une synchronisation complète n'est plus comptée, sans être effacée ; la proposition « corrigée »
    reste à faire ;
  - les adresses IP sont affichées, derrière les droits du périmètre (point ouvert 8) ;
  - retirer le périmètre d'une machine demande `vulnerabilites:administrer` ; l'affectation en masse est tout ou rien ;
  - pendant une synchronisation (une dizaine de minutes au plus), l'exécutant ne traite pas ses autres demandes ;
  - port de Tenable réglable (443 par défaut).
  Non vérifié sur l'instance : la correspondance entre les machines de l'analyse et celles de l'inventaire (`uuid` ou
  `tenableUUID`), la pagination de l'inventaire, toute synchronisation réelle.
- **Lot V4a, rapprochement, priorité et rang** (16/11/2026) : migration `076`. Version d'un produit obligatoire ; la veille
  NVD garde les plages de versions touchées ; rapprochement d'office, écarté ou proposé ; produit relié à la main à ses
  machines avec la mention « déclaré » ; priorité P1 à P4 et rang des machines, avec leurs faits. À confirmer par le RSSI :
  - le rattachement d'office exige que le produit porte son identifiant normalisé (CPE), que l'écran propose parmi ceux
    connus de la veille ; sans lui, le rapprochement se fait par nom et reste à décider ;
  - une plage à une seule borne compte comme une plage ; une version non numérique, un produit touché sans plage ou une
    liste de produits tronquée (20 par CVE) donnent une proposition, jamais un écart ;
  - **une CVE rattachée à un produit compte comme présente même si aucune machine n'est reliée au produit** : elle peut
    donc être en P1 ;
  - l'exploitation avérée vient du catalogue KEV ou d'une alerte du CERT-FR ; **les alertes du CERT Santé ne comptent pas**,
    contrairement au point 9 ;
  - seul le seuil EPSS se règle (0,5 par défaut) ; les gravités de la grille sont fixes ;
  - une décision (confirmation, rejet) ne peut pas être annulée ; un rejet est reproposé si le produit ou les plages
    publiées changent ;
  - une faille exploitée que NVD n'a pas republiée dans la fenêtre de collecte n'est pas rapprochée d'un produit déclaré.
  Non réalisé : états de suivi d'une faille, lien avec une action, proposition « corrigée ».
- **Lot V4b, suivi d'une faille** (16/11/2026) : migration `077`. États de suivi historisés (historique en ajout seul),
  lien avec les actions du registre existant (création sous l'identité de la personne, ou action existante reliée),
  proposition « corrigée » après une synchronisation complète. À confirmer par le RSSI :
  - pour **décider** (état, action, refus), il faut lire **toutes** les machines touchées ; pour lire, une seule suffit ;
  - la clôture d'une action ne change jamais l'état de la faille ; créer ou relier une action fait passer « nouvelle » à
    « à traiter » ;
  - la proposition « corrigée » vise aussi les failles en « risque accepté » et « non concernée » ; refusée, elle n'est
    refaite que si la faille a été de nouveau rapportée entre-temps ;
  - une faille marquée « corrigée » par une personne alors que Tenable la voit encore reste corrigée et est signalée ; elle
    ne repasse « à traiter » que si elle avait été vue absente puis revient ;
  - un constat qui n'est plus rapporté a une présence « absente » : sa priorité baisse ;
  - la note d'une décision est gardée dans l'historique, pas dans le journal d'audit ;
  - une action créée depuis le module ne nommait aucune machine : **remplacé par V30**, à réaliser (machines et application
    touchées nommées dans l'action, dans la limite de ce que la personne peut lire, liste bornée).
  Non réalisé : notification, lien de la fiche vers l'action dans Pilotage.
- **Lot V4c, règle des sources** (16/11/2026) : migration `078`. Une faille est suivie dès qu'une source la publie, avec
  la provenance et la date de chaque fait ; exploitation avérée par le catalogue KEV, une alerte du CERT-FR ou la mention
  « La faille est activement exploitée : Oui » du CERT Santé ; « exploitable » par Tenable ou par la mention de preuve de
  concept du CERT Santé ; valeur la plus sévère pour la priorité ; décision de rapprochement annulable. Trois points du lot
  V4a sont dépassés : le CERT Santé compte, une décision s'annule, une faille citée par le CERT Santé est rapprochée sans
  attendre NVD. Constaté sur 15 fiches réelles du CERT Santé : les trois mentions oui/non et la phrase de preuve de concept
  ont une forme unique ; toute autre forme vaut « non renseigné ». À confirmer par le RSSI :
  - **« exploitable » ne vaut pas exploitation avérée** : une preuve de concept disponible pèse en P2 et ne donne jamais P1,
    alors que la décision V23 dit « exploitée, ou exploitable » (écart avec la lettre de V23) ;
  - une fiche du CERT Santé est lue par publication nouvelle ou modifiée : 30 au plus par collecte, relecture après 7 jours ;
  - le rapprochement par le nom exige que la source cite le produit ; un titre qui ne cite que l'éditeur ne rapproche rien,
    et les alertes du CERT-FR, qui ne citent aucun produit structuré, ne sont pas rapprochées par le nom ;
  - annuler une confirmation alors que la règle d'office tranche désormais donne « rattaché d'office » ;
  - à valeur égale entre sources, l'ordre d'affichage est NVD, Tenable, CERT Santé, FIRST.
  Non vérifié : conditions d'usage du site du CERT Santé pour la lecture de ses pages, toute collecte réelle.
- **Lot « Assistant », évaluer une CVE** (16/11/2026) : migration `079`. Outils `evaluer_cve`, `machines_prioritaires`,
  `failles_prioritaires` et `proposer_action_vulnerabilite`, offerts **en conversation seulement** (pas en ronde autonome),
  au profil « Mise en œuvre », à une personne qui a `vulnerabilites:lire`. À confirmer par le RSSI :
  - les machines ne sont remises au modèle que sous forme de **repères stables par conversation** (point ouvert 10 tranché :
    stables) ; ni rôle ni nom de périmètre ne sont transmis (point ouvert 9) ;
  - le texte est gardé avec les repères ; les noms sont remis à l'affichage, pour la personne qui regarde et selon ses
    droits ; un repère inconnu est affiché « non reconnu » (et non écarté, écart avec le point 11) ;
  - **masque de sortie** : avant tout envoi au fournisseur du modèle, en conversation comme en ronde, tout nom de machine
    de l'inventaire, toute adresse et tout identifiant de Tenable est remplacé par le repère de la machine, ou par
    « [machine] ». Il couvre ce que la personne tape, les actions qui nomment des machines depuis V30, les documents et le
    contexte de l'organisation. Limites : un nom de machine qui est aussi un mot courant est masqué partout ; un nom absent
    de l'inventaire n'est pas reconnu ;
  - une proposition d'action de l'assistant est gardée avec ses repères ; à la confirmation, sur le serveur, les noms sont
    remis et l'action est créée sous l'identité de la personne (V29), sans retour vers le modèle ; seule la personne qui a
    mené la conversation décide ;
  - **contenu d'une action (V30)** : les noms des machines et des applications touchées sont ajoutés par le serveur à la
    description (20 machines au plus, puis « et N autres ») ; aucune adresse ; une machine sans nom est comptée « sans nom » ;
    le journal d'audit reste sans nom de machine.
  **Relecture par la session « Assistant RSSI intégré plateforme » (16/11/2026, commit `9739bb73`)**, en lecture seule, avec
  des essais du masque. Défaut bloquant trouvé et corrigé : un nom de machine qui contient un espace, une lettre accentuée,
  « $ », ou de la forme « DOMAINE\\MACHINE », n'était pas reconnu et serait parti chez le fournisseur du modèle. Le masque
  cherche désormais ces noms tels quels, entre deux frontières de mot, et reconnaît aussi « MACHINE » seul et le nom sans
  « $ » final. Les trois risques relus (historique, points de sortie, déclaration des outils) sont jugés conformes ; un test
  échoue désormais si le masque n'est plus branché par les services. Restent, à trancher par le RSSI ou à connaître :
  - **sur-masquage** : quand une machine porte le nom d'une application (« dpi », « web », « pacs »), ce mot est masqué
    partout ; en conversation, la personne peut lire le nom d'un serveur là où elle avait écrit le nom de l'application ;
  - toute ronde de l'assistant dépend désormais de l'inventaire des machines, même quand le module Vulnérabilités ne sert
    pas : une lecture en échec fait échouer la ronde, ce qui est le sens prudent de la panne ;
  - l'identifiant interne d'une machine n'est pas masqué ; il ne désigne rien hors de la base ;
  - un petit modèle peut écrire qu'il a déposé une proposition sans l'avoir fait : la consigne l'interdit, mais seule une
    mention posée par la plateforme le garantirait.
  Non vérifié : aucun modèle réel n'a répondu (faux transport) ; la qualité des réponses n'est pas mesurée.
- **Liste de mots à ne pas masquer (V31)** (17/11/2026) : réglage du module, rangé avec les réglages existants, sans
  migration, lu et écrit avec `vulnerabilites:administrer`, vide par défaut ; il vaut pour les conversations et pour les
  rondes. À confirmer par le RSSI :
  - un mot de la liste n'est laissé que **seul** : collé à une lettre ou un chiffre, précédé de « \\ », suivi de « $ », ou
    relié par un point, un tiret, un tiret bas ou deux-points, il reste masqué ; le nom complet d'une machine, son adresse
    et ses identifiants restent toujours masqués ;
  - **limite** : la barre oblique ne relie pas ; `https://dpi/chemin` laisse sortir « dpi » ;
  - forme d'un mot : lettres, chiffres et tirets, de 2 à 60 caractères ; une adresse, un identifiant ou un repère sont
    refusés, et le masque les ignore même s'ils lui étaient remis ;
  - l'écran indique combien de machines chaque mot désigne ; le nom de ces machines n'est montré qu'à qui peut les lire,
    le nombre l'est à tout administrateur du module ;
  - un réglage illisible vaut liste vide : le masque strict s'applique.
- **Lot ALH1, surface externe lue dans AlgoLightHouse** (17/11/2026) : migration `080`, connecteur `algolighthouse` en lecture
  seule, écran « Surface externe ». Décisions et choix de réalisation : voir l'addendum du 17/11/2026 ci-dessous.
- **Lot ALH2, recommandations, priorité et assistant pour la surface externe** (17/11/2026) : migration `081`, défauts et
  résolutions de l'éditeur dans la fiche d'une alerte, AlgoLightHouse source de plus pour la priorité (présence « exposée »),
  tri par priorité, vue dans la veille, rapprochement avec les produits surveillés, exposition d'une CVE pour l'assistant avec
  repères « E-… » et masque étendu. Voir l'addendum « lot ALH2 » ci-dessous.
- **Lot ALH3, actif exposé relié aux machines internes** (17/11/2026) : migration `083`, liaison d'un actif d'AlgoLightHouse
  à une ou plusieurs machines de Tenable, à la main ou par proposition confirmée. Voir l'addendum « lot ALH3 » ci-dessous.
- **Lot ALH4, carte « Lignes d'approche »** (17/11/2026) : sans migration, onglet « Carte » de « Surface externe » (de
  l'Internet aux machines internes reliées, branches repliables, filtres, chemin d'entrée critique). Voir l'addendum « lot
  ALH4 » ci-dessous.
- **Lot V6, alertes et fenêtre d'alerte critique** (17/11/2026) : migration `086`, alertes décidées par la plateforme (critique
  en P1, simple en P2), fenêtre rouge sur toutes les pages, prise en compte par alerte, onglet « Alertes », notifications par le
  module existant. Voir l'addendum « lot V6 » ci-dessous.
- **Lot PC1, vue d'ensemble du poste de commandement** (18/11/2026) : sans migration, premier onglet et adresse d'accueil du
  module, niveau d'alerte de 1 à 4 (règle à confirmer), radar dont chaque point est une faille suivie réelle. Voir l'addendum
  « lot PC1 » ci-dessous.
- **Lot PC2, écran « Machines », présentation « Parc »** (18/11/2026) : sans migration, tuiles par machine dans les zones de
  rôle, murs animés, marques zero-day et exploitable, échelle réduite ou grand écran. Voir l'addendum « lot PC2 » ci-dessous.
- **Lot PC3, onglet « Périmètres »** (18/11/2026) : sans migration, cartes des périmètres lus, détail par ligne ou au global,
  mention « Exposée sur Internet » des machines reliées par une liaison confirmée. Voir l'addendum « lot PC3 » ci-dessous.
- **Lot PC4, fiche de faille illustrée** (18/11/2026) : sans migration, présentation commune en tête des fiches existantes,
  vecteur CVSS traduit avec une icône par métrique, schéma, recommandations par source. Voir l'addendum « lot PC4 » ci-dessous.
- **Lot S1, délais de correction et exceptions à échéance** (18/11/2026) : migration `087`, délai cible par priorité réglé
  avec les seuils, âge, échéance et état du délai, tuile « En dépassement », exceptions (risque accepté) réservées au rôle
  RSSI avec justification, mesure compensatoire et échéance, expiration et rappel, onglet « Délais et exceptions ». Voir
  l'addendum « lot S1 » ci-dessous.
- **Lot S2, tendances et rapport de pilotage** (18/11/2026) : migration `088`, instantané quotidien de la situation (niveau
  d'alerte, nombres de failles, globaux et par périmètre, sans nom), onglet « Tendances », variation sur sept jours de la vue
  d'ensemble, rapport mensuel imprimable (PDF par le navigateur) et CSV. Voir l'addendum « lot S2 » ci-dessous.
- **Lot S3, regroupement par correctif, fin de support, état du correctif** (18/11/2026) : sans migration, vue « Par
  correctif » de « Failles détectées » (« n mises à jour à faire pour m failles »), état du correctif à trois valeurs avec sa
  source, précision « sans correctif connu » à côté de la marque zero-day, fin de support signalée et filtrée. Voir
  l'addendum « lot S3 » ci-dessous.
- **Règle des sources (V26), à appliquer partout** : un fait est retenu dès qu'**une** source le publie, avec sa provenance
  et sa date ; les sources suivantes complètent sans retarder. Conséquences à réaliser : une CVE publiée par le CERT-FR ou
  le CERT Santé avant NVD est suivie tout de suite, avec ce que la source en dit (produit, gravité, exploitation), et entre
  dans le rapprochement avec les produits déclarés, par le nom, comme proposition à décider ; l'exploitation est avérée dès
  qu'une source le dit (catalogue KEV, alerte du CERT-FR, mention du CERT Santé). Quand deux sources donnent une valeur
  différente pour un même fait (score de gravité), chacune est gardée avec sa source et la **plus sévère** sert à la
  priorité (V27).
- **À réaliser après les décisions V23 et V24** : la fiche de chaque publication du CERT Santé porte des mentions
  structurées, relevées le 16/11/2026 sur une alerte (« La faille est activement exploitée : Oui / Non », « Un correctif
  existe », « Une mesure de contournement existe », rubrique « Preuve de concept »). Le flux RSS ne les porte pas : la veille
  devra lire la page de chaque publication nouvelle, sur le même hôte, et n'en retenir que ces mentions. Un simple mot-clé ne
  convient pas : le mot « exploitée » figure dans toutes les fiches (« La vulnérabilité exploitée est du type… »).
- **Assistant (V25, V28), à réaliser** : outils de lecture offerts seulement à une personne qui a `vulnerabilites:lire`
  (capacité facultative du contexte, comme pour les documents) ; service de lecture fourni par le module, appelé avec les
  droits de la personne ou du référent ; machines remises au modèle sous forme de repères. **Le texte est gardé avec les
  repères** : l'historique d'une conversation repart chez le fournisseur à chaque tour, les noms ne sont donc remis qu'à
  l'affichage, par une table de correspondance qui vit aussi longtemps que la conversation ; ni la mémoire ni les fiches de
  méthode ne gardent de repère ou de nom. Réglages retenus à défaut de décision contraire du RSSI : outils ouverts au
  profil « Mise en œuvre » seulement ; une action proposée à partir d'un plan **peut nommer les machines** (V29) : la proposition est gardée avec les
  repères, et ils sont remplacés par les noms **à la confirmation**, sur le serveur, sans retour vers le modèle ; les noms
  sont alors lisibles par les personnes qui lisent les actions du périmètre.

## Conséquences

- La plateforme gagne trois flux réseau de plus, tous fermés par défaut et portés par l'exécutant. La surface de l'API ne
  change pas.
- **Dépendance au module Intégrations** : le socle des connecteurs (lots I1 et I4 de l'ADR 0076) doit être réalisé avant les
  connecteurs Tenable et Ekialis. La veille sur les sources publiques n'en dépend pas.
- Les failles et leur présence dans l'organisation sont des informations sensibles : elles sont lues à travers les droits du
  module, et seuls des agrégats partent chez le fournisseur du modèle.
- **La plateforme détient désormais un inventaire de machines** (noms, adresses, rôles, failles par machine) : c'est une
  cible de choix. Il reste dans la base, derrière les droits des périmètres, hors de tout envoi au modèle.
- Le rôle et le périmètre de chaque machine sont à tenir à jour : sans eux, ni classement complet ni vue par ligne.
- **L'injection par le contenu reste un risque résiduel** : même venu d'une source officielle, un résumé est un texte
  extérieur. Parades : champs structurés, texte borné, aucun lien ouvert, aucune écriture sans décision humaine.
- **Limites assumées** :
  - la plateforme ne balaie aucun réseau : ce qui n'est ni scanné par Tenable ni inscrit au registre des produits n'est pas vu ;
  - le rapprochement par nom produit des faux positifs et des oublis, d'où la confirmation humaine ;
  - pas de lecture de réseaux sociaux ni de sites non listés ;
  - les sources publient avec retard ; le score EPSS est une probabilité, pas un constat ;
  - aucune écriture dans Tenable ni dans Ekialis.
- **Alternatives écartées** : veille par le modèle avec navigation web (contraire aux parades de l'ADR 0086) ; sortie réseau
  donnée à l'API (ADR 0014) ; tout porter dans le module Intégrations (droits non distincts, écarté par V1) ; transmettre le
  détail des machines au modèle (écarté par V5 et V14) ; adresses de sources réglables dans l'interface (ouvre la veille à une source
  non fiable).

## Points ouverts, à trancher par le RSSI

1. Registre des produits surveillés : au niveau de l'organisation (proposé), ou rattaché aux périmètres ?
2. Qui reçoit l'alerte du plus haut niveau quand le produit n'a pas de responsable ?
3. Seuils de départ de la priorité (gravité, score EPSS).
4. Ordre des travaux par rapport à DEV-006 (socle des connecteurs).
5. Liens de la vue par périmètre : entre lignes (proposé), ou de machine à machine, saisis à la main ?
6. Familles de produits du radar : Systèmes, Réseau, Messagerie, Applications métier, Postes de travail, Web (proposé) ?
7. Thème : sombre seul comme la page de mise à jour, ou clair et sombre comme le reste de l'application ?
8. Adresses IP : affichées dans les vues, ou seulement rangées ?
9. Nom du périmètre d'une machine : transmis au modèle avec son repère, ou gardé en local comme le rôle (proposé) ?
10. Durée de vie des repères : renouvelés à chaque échange avec le modèle (proposé), ou stables d'un échange à l'autre ?
11. Zero-day : toute faille dont l'exploitation est avérée (proposé), ou seulement celles sans correctif publié ?
12. Fenêtre d'alerte critique : au niveau 4 seulement (proposé), ou dès le niveau 3 (exploitée, produit à confirmer) ?
13. Droits par défaut : comme les autres modules métier (retenu au lot V1 : le contributeur lit et modifie, le lecteur lit), ou
    réservés à l'administrateur et au RSSI comme l'assistant ? À trancher avant l'arrivée des failles et des machines.
14. Unité affichée : Tenable raisonne par contrôle (un correctif, plusieurs CVE), la veille par CVE. Les listes et le radar
    montrent-ils les contrôles de Tenable regroupés (proposé), ou chaque CVE ?
15. Radar : le parc compte plusieurs milliers de constats ; le radar montre-t-il les plus prioritaires seulement (proposé) ?
16. Sortie du serveur vers Internet : le RSSI indique le 16/11/2026 qu'elle passe par un **mandataire (proxy) de
    l'établissement** ; Tenable, lui, est joint directement. La plateforme n'a aujourd'hui aucun réglage de mandataire, pour
    aucun de ses flux : à cadrer (adresse, authentification éventuelle, autorité de certification si le mandataire inspecte
    le trafic chiffré) avant la mise en service de la veille.
17. Rapprochement du lot V4 : utiliser aussi le champ « affected » de NVD (éditeur et produit hors CPE) ?

## Addendum du 17/11/2026 — connecteur AlgoLightHouse (lot ALH1)

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). AlgoLightHouse (ALH),
de l'éditeur AlgoSecure, surveille la surface d'attaque exposée sur Internet (EASM) : alertes de ses analystes, hôtes, domaines,
technologies détectées. Forme des réponses lue sur le descriptif OpenAPI 3 de l'éditeur (version 1.14.0, non versé au dépôt) ;
**aucune réponse réelle n'a été vue**.

### Décisions du RSSI (17/11/2026)

| N°   | Question                     | Décision                                                                                                         |
| ---- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| ALH1 | Place                        | Un type de connecteur de plus du module Intégrations, rattaché au module Vulnérabilités comme Tenable ; clé saisie dans la plateforme, jamais réaffichée |
| ALH2 | Appels                       | Lecture seule, liste fermée : `GET /api/v1/health`, `/version`, `/alerts` (filtres), `/alerts/{id}`, `/perimeters`, `/targets/hosts`, `/targets/domains`, `/technologies`. Jamais `POST` ni `PUT` (commentaires, statut), jamais les adresses sans `/v1`, ni `/api/contacts` ni `/api/search`. En-tête `X-API-Key`. Preuve par test qu'aucune écriture n'est émise |
| ALH3 | Flux                         | Service sur Internet : flux propre, fermé par défaut ; sortie par le mandataire de l'établissement quand il est actif (Tenable reste direct) ; certificat toujours vérifié |
| ALH4 | Droits                       | L'administrateur du module relie chaque périmètre ALH à un périmètre de la plateforme ; ce qui en vient hérite de ce périmètre ; un périmètre ALH non relié n'est visible que de qui administre le module |
| ALH5 | Types d'alerte               | Tous repris : `vulnerable_service`, `exposed_service`, `config_defect`, `data_leak`, `typosquatting`              |
| ALH6 | Textes et données            | Textes de l'éditeur gardés tels quels ; aucune donnée réelle dans le dépôt                                       |
| ALH7 | Assistant et masque          | Ce lot ne branche pas l'assistant ; rien n'est exposé qui contournerait le masque ; `sensitive_data`, `has_sensitive_data`, `uploads`, `note`, `comments` ne sont pas stockés (liste blanche de champs) |

### Réalisation

- **Catalogue** (`packages/shared/src/integrations.ts`) : type `algolighthouse`, portée organisation, opérations « Tester la
  connexion » (`health` puis `version`, seule la version sort) et « Synchroniser » ; flux `algolighthouse` au registre
  (`FLUX_SANS_REPRISE`, `USAGE_MANDATAIRE` « utilise ») ; liste fermée recopiée dans `scripts/integration-http.py` et comparée par
  `apps/api/test/integrations-architecture.test.ts`.
- **Socle** : chaque opération par lots est rangée par le récepteur de **son type** (`enLots['<type>:<opération>']`) ; le
  mandataire est joint à la réclamation pour les seuls types dont le flux l'utilise ; l'exécutant ne le passe qu'à eux
  (`INTEGRATIONS_MANDATAIRE`) ; le script le refuse pour tout autre type et reprend le tunnel `CONNECT` de la veille.
- **Données** (migration `080`) : périmètres ALH et leur liaison, actifs (hôtes, domaines), alertes et leurs CVE, technologies,
  leurs actifs et leurs CVE, état et journal des synchronisations ; même règle de présence que Tenable.
- **Lecture** (`apps/api/src/vulnerabilites/surface-externe.ts`) : alertes, actifs, technologies à travers le périmètre relié
  (`grc_smsi_visible`) ; liste et liaison des périmètres avec `vulnerabilites:administrer`. Écran Risques > Vulnérabilités >
  « Surface externe ».

### Choix de réalisation, à confirmer par le RSSI

- **Adresse** : `https://<espace>.algolighthouse.fr` seulement (domaine de l'éditeur écrit dans le code, recontrôlé par le
  script), port 443, sans autorité de certification propre ; la clé d'API ne peut partir vers aucun autre hôte.
- **Forme de la clé** non documentée par l'éditeur : 16 à 256 caractères parmi lettres, chiffres et `._~+/=-`.
- **Aucun paramètre de requête n'est émis** (filtres admis par ALH2 mais inutiles ici) et l'en-tête `X-Perimeters-Filter`
  n'est pas envoyé : chaque liste est lue en entier, dans la limite des droits de la clé.
- **Pas de pagination documentée** : chaque liste est lue en une réponse, bornée à 16 Mio et en nombre (500 périmètres,
  5 000 alertes, 10 000 hôtes, 10 000 domaines, 2 000 technologies ; par technologie, 50 versions, 200 actifs et 200 CVE par
  version ; 20 000 liens et 20 000 CVE de technologies), profondeur JSON bornée (`trop_imbrique`), huit minutes de lecture.
  Au-delà, la synchronisation est incomplète et ne fait rien disparaître.
- **Détail des alertes** : lu pour les 300 alertes les plus récemment modifiées à chaque synchronisation (la liste ne donne
  que des identifiants de type et de criticité) ; le type et la criticité des autres sont déduits des identifiants vus dans ces
  détails, sinon « non renseignés » ; leur cible et leurs CVE gardent la dernière valeur lue. Un détail introuvable (404) est
  écarté et rend la synchronisation incomplète ; toute autre erreur l'arrête.
- **CVE d'une alerte** (forme non décrite par l'éditeur) : seules les valeurs texte du premier niveau des objets `cves` et
  `fragments[].alert_cves[].cve` qui sont exactement un identifiant CVE sont retenues ; rien n'est lu plus loin.
- **Défauts et résolutions** (`defects`) : ni lus ni rangés (hors de la liste de champs du lot) ; les recommandations de
  l'éditeur ne sont donc pas affichées.
- **EPSS** des technologies : gardé seulement entre 0 et 1 ; une autre valeur est écartée, jamais convertie.
- **Liaison d'un périmètre** : en plus de `vulnerabilites:administrer`, l'écriture sur le périmètre actuel et sur le périmètre
  visé (même règle que le périmètre d'une machine de Tenable) ; un périmètre visé illisible est « introuvable » (422). Le
  nombre de périmètres non reliés n'est donné qu'à l'administration du module.
- **Technologie** : lue par ses actifs ; une version qui ne tourne que sur des actifs illisibles, et ses CVE, ne sont ni
  listées ni comptées ; un actif inconnu de la cartographie n'est lisible qu'avec `vulnerabilites:administrer`.
- **Liste des alertes** : par défaut, celles encore ouvertes chez l'éditeur (non traitée, en cours, à retester, à retraiter,
  en attente).
- **Réglage du mandataire illisible** : la demande est close sans appel, jamais faite en direct (même règle que la veille).
- Le client HTTP commun explique désormais un code 429 (limite de débit), aussi pour Tenable.

### Non vérifié

Aucun appel vers un vrai espace AlgoLightHouse (tests sur un faux service HTTPS local et un faux mandataire) ; forme réelle des
objets CVE d'une alerte ; volumes réels (nombre d'alertes, taille des réponses) ; limites de débit et conditions d'usage de
l'API ; passage par le mandataire réel de l'établissement ; Docker et Node 26. Le parcours Playwright du connecteur a été
joué en local seulement, sur une pile sans Docker.

### Formes constatées sur un espace réel (17/11/2026)

Le RSSI a relevé des réponses anonymisées avec `scripts/dev/exemples-alh.ps1` (aucune n'est dans le dépôt). Elles confirment
que les listes sont des tableaux directs, sans pagination, et que les volumes tiennent très en dessous des bornes. Trois
formes ont demandé une adaptation, couverte par un test : la liste des alertes peut rendre une date de création vide (an 1),
le détail porte la vraie ; « * » tient lieu de valeur absente pour le produit et le nom affiché d'une technologie, dont la
version peut être vide ; le numéro d'AS peut être préfixé par « AS ». Les deux détails relevés n'avaient aucune CVE : la
forme réelle des objets CVE d'une alerte reste non vérifiée.

### Points ouverts (hors lot)

1. **Priorité et règle du « ou » entre sources** (V26, V27) : faire entrer les CVE d'ALH (exploitation selon l'éditeur, preuve
   de concept, score) dans les faits de la priorité, avec leur provenance.
2. **Rapprochement** des technologies d'ALH avec les produits surveillés (éditeur, produit, version).
3. **Assistant** : aucun outil ne lit la surface externe. Avant de l'y brancher, le masque devra couvrir les adresses et les
   domaines d'ALH, qui ne sont pas dans l'inventaire des machines.
4. **Alertes** : notification ou fenêtre d'alerte sur une alerte critique d'ALH.
5. Affichage des **défauts et résolutions** de l'éditeur (texte HTML à nettoyer).
6. Lecture **incrémentale** des détails (toutes les alertes finissent par être détaillées) ; pagination si l'éditeur la
   documente ; usage de `X-Perimeters-Filter`.

## Addendum du 17/11/2026 — lot ALH2 : recommandations, priorité et assistant pour la surface externe

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). Migration `081`
(additive : colonne `defauts` de `vulnerabilites_alh_alertes`, table `vulnerabilites_assistant_reperes_externes`). Lève les
points ouverts 1, 2, 3 et 5 de l'addendum du lot ALH1 ; les points 4 (alerte ou fenêtre sur une alerte critique) et 6
(lecture incrémentale, pagination, `X-Perimeters-Filter`) restent ouverts.

### Décisions du RSSI (17/11/2026)

| N° | Question | Décision |
| --- | --- | --- |
| A | Recommandations de l'éditeur | Affichées dans la fiche d'une alerte : `defects` du détail déjà lu, en **liste blanche** (nom, description, résolutions), bornés ; texte de l'éditeur tel quel mais **toujours rendu en texte**, jamais de HTML interprété. `note`, `uploads`, `comments`, `sensitive_data` restent non lus |
| B | Priorité | Les CVE vues par ALH (technologies, alertes) entrent dans la priorité selon la règle du « ou » : ALH est une **source de plus** (`is_exploited` = exploitation avérée, `has_poc` = exploitable, CVSS et EPSS : la valeur la plus sévère). Une CVE portée par un actif exposé est une **faille présente chez nous** : elle apparaît avec sa priorité dans « Surface externe » (alertes et technologies triables par priorité) et, si le modèle le permet, dans la veille (« vue sur la surface externe : n actifs »). Rapprochement des technologies avec les produits surveillés par le mécanisme existant |
| C | Assistant | Il répond sur l'exposition externe d'une CVE (touchés ou non, combien d'actifs, quoi faire, priorité). **Rien d'identifiant ne part** : ni domaine, ni adresse, ni nom de périmètre, ni FAI ou AS ; seulement des repères locaux (« E-001 ») et des compteurs, remplacés en local. Le masque couvre les domaines et adresses d'ALH avant que tout outil les expose ; les recommandations passent par le masque ou ne sont pas envoyées |

### Réalisation

- **Recommandations (A)** : le script de l'exécutant lit `defects` dans le détail déjà demandé (aucun appel nouveau, liste
  fermée inchangée) avec deux listes blanches (`CHAMPS_DEFAUT_ALH` : `name`, `description`, `resolutions` ;
  `CHAMPS_RESOLUTION_ALH` : `name`, `description`, `ease_of_execution`, `security_gain`, dont seule la valeur est lue), balises
  retirées et entités décodées comme pour les titres (texte sur une ligne), 20 défauts par alerte, 10 résolutions par défaut,
  300 caractères pour un nom, 4 000 pour une description, 60 pour la facilité et le gain. L'API valide chaque défaut (schéma
  strict, texte externe nettoyé) ; rangés avec l'alerte (colonne `defauts`), remplacés quand le détail est relu, gardés sinon.
  Fiche d'une alerte : `GET /api/vulnerabilites/surface/alertes/{id}` (mêmes droits que la liste) ; à l'écran, fenêtre ouverte
  par le titre, textes rendus comme texte (échappés par React).
- **Priorité (B)** : nouvelle présence « exposée sur Internet » (`exposee`), qui vaut présence avérée pour la grille (P1 avec
  une exploitation avérée). Nouvelle source `alh` pour l'exploitation, « exploitable » et les valeurs (CVSS, EPSS, gravité
  déduite du score comme pour le CERT Santé). Alerte : priorité la plus haute de ses CVE, présence « exposée » tant qu'elle est
  ouverte chez l'éditeur ; technologie : priorité la plus haute des CVE de ses versions encore détectées ; tri `?tri=priorite`.
  La règle du « ou » vaut **partout** : constats de Tenable, failles déclarées, fiche d'un produit, veille et assistant prennent
  aussi ce que dit ALH, et les filtres et compteurs « exploitation avérée » et « exploitable » en SQL aussi.
- **Veille** : chaque faille connue porte `surfaceExterne` (actifs exposés lisibles qui la portent, alertes ouvertes lisibles
  qui la citent), affichée « Vue sur la surface externe : n actifs exposés » avec un lien vers l'écran.
- **Rapprochement** : une technologie est rapprochée d'un produit surveillé par l'identifiant CPE du produit (éditeur et
  produit exacts) s'il en porte un, sinon par les noms normalisés de l'éditeur et du produit ; la version déclarée est comparée
  aux versions détectées (même version, différente, non comparable). Affiché sur la technologie et dans la fiche du produit
  (« Vu sur la surface externe »).
- **Assistant (C)** : `evaluer_cve` rend en plus une section `surfaceExterne` (exposée ou non, nombre d'actifs exposés,
  repères « E-… » des 20 premiers, technologies avec nom, éditeur, versions et faits de l'éditeur, 5 alertes ouvertes avec
  criticité, type, statut, titre et 3 défauts de 3 résolutions au plus, bornés à 600 caractères) et la présence
  `exposeeSurInternet` ; la priorité de la CVE tient compte de la présence « exposée ». Repères « E-001 » à « E-999 » par
  conversation (table `vulnerabilites_assistant_reperes_externes`, même règle que « M-… »), remplacés à l'affichage par le
  domaine ou l'adresse pour une personne qui lit l'actif. Le **masque de sortie** reçoit tous les domaines, adresses, adresses
  de résolution, libellés d'actifs des technologies et cibles d'alertes (domaine ou hôte) d'ALH, toujours protégés (jamais
  démasqués par la liste V31), plus les sous-domaines d'un domaine connu, et les FAI et numéros d'AS des hôtes ; remplacement :
  le repère « E-… » pour un actif lisible en conversation, sinon « [actif externe] » (« [réseau externe] » pour un FAI ou un AS).
  Un test échoue si le masque n'est plus branché sur ces valeurs.

### Choix de réalisation, à confirmer par le RSSI

- **Ce que dit ALH ne compte que pour ce que la personne lit** : un fait d'ALH (exploitée, preuve, score) n'entre dans une
  priorité, une liste de la veille ou une fiche que si la version touchée tourne sur un actif qu'elle peut lire. Sans cela, il
  révélerait qu'une CVE est exposée dans un périmètre qu'elle ne lit pas. Conséquence : deux personnes peuvent voir deux
  priorités différentes pour la même faille.
- **ALH ne date pas ses faits** : ses signalements sont « date inconnue », rangés après les sources datées (V26).
- **Gravité ALH** déduite de son score CVSS (échelle de FIRST), comme pour le CERT Santé ; le champ `severity` n'est pas lu
  pour la priorité.
- **Ordre des sources** à valeur égale : NVD, Tenable, CERT Santé, FIRST, puis AlgoLightHouse.
- **Alerte sans CVE** : pas de priorité calculée (« Sans CVE »), seule la criticité de l'éditeur ; triée après les alertes
  qui en ont une. **Alerte terminée** : présence « absente ».
- **Tri par priorité** : toutes les alertes (5 000 au plus) ou technologies (2 000 au plus) lisibles sont évaluées à chaque
  page ; à priorité égale, l'ordre par défaut est gardé. L'ordre par défaut reste celui du lot ALH1.
- **Rapprochement technologie ↔ produit** : indication calculée à la lecture, **sans décision ni table** (pas de
  confirmation, pas de rejet), sans effet sur la priorité ni sur les failles déclarées ; une technologie sans éditeur ou sans
  produit connu n'est pas rapprochée. Le mécanisme existant fait confirmer un rapprochement par nom : ce n'est pas repris ici.
- **Défauts** : texte rendu sur une ligne (paragraphes et listes de l'éditeur aplatis), bornes ci-dessus ; un défaut ou une
  résolution sans nom est écarté ; un défaut rangé illisible n'est pas affiché.
- **Masque** : les noms de périmètres d'ALH ne sont pas masqués (des mots courants seraient masqués partout) ; les outils ne
  les envoient jamais. Un FAI ou un numéro d'AS est masqué partout où il apparaît, y compris un nombre identique sans rapport.
  Un domaine sans point (« intranet ») est masqué partout. Les sous-domaines d'un domaine connu sont masqués, pas ses parents.
- **Propositions d'action** : elles ne visent que des machines (« M-… ») ; un repère « E-… » cité dans une proposition reste tel
  quel dans l'action confirmée (ni domaine ni adresse n'y est écrit).
- **Veille** : « actifs » compte les actifs distincts (par identifiant chez l'éditeur) qui portent la CVE par une version
  encore détectée ou comme cible d'une alerte ouverte ; une alerte qui vise un service ou un mot-clé ne compte qu'en alerte.

### Non vérifié

Aucun appel vers un vrai espace AlgoLightHouse ; **forme réelle des `defects`**, lue sur le descriptif de l'éditeur seulement
(champs `name`, `description` en HTML, `resolutions`) ; forme réelle des objets CVE d'une alerte ; qualité des réponses de l'assistant avec un modèle
réel (faux transport seulement) ; volumes réels pour le tri par priorité ; Docker et Node 26. Le parcours Playwright adapté n'a
pas été joué (CI seulement).

### Points ouverts (hors lot)

1. **Alertes** : notification ou fenêtre d'alerte sur une alerte critique d'ALH, ou sur une CVE exposée en P1.
2. Lecture **incrémentale** des détails ; pagination si l'éditeur la documente ; usage de `X-Perimeters-Filter`.
3. Rapprochement technologie ↔ produit **décidé** (confirmer, rejeter) et effet sur les failles déclarées, si le RSSI le veut.
4. Masquer aussi les noms de périmètres d'ALH (risque de sur-masquage) ?
5. Propositions d'action de l'assistant sur une alerte d'ALH (aujourd'hui : constats de Tenable et failles déclarées seulement).

## Addendum du 17/11/2026 — lot V4d : périmètre des machines Tenable relié par dépôt

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). Migration `082`
(additive : table `vulnerabilites_tenable_depots`, colonne nullable `depot_id` de `vulnerabilites_machines`). Amende le
point 14 (lecture d'une machine par son périmètre) sans en changer la règle : le périmètre lu est désormais le périmètre
**effectif** de la machine.

### Décision du RSSI (17/11/2026)

Pour Tenable, le périmètre se relie **par groupe entier**, et non machine par machine, comme les périmètres AlgoLightHouse se
relient aux périmètres de la plateforme (lot ALH1, onglet « Périmètres » de « Surface externe »). Le rattachement d'une
machine à la main (une machine ou une sélection, lot V5) reste possible.

### Réalisation

- **Groupe = dépôt de Tenable** (`repository`, choix à confirmer ci-dessous). Le script de l'exécutant le lit dans chaque
  résultat de l'analyse `vulndetails` **déjà reçu** : aucun appel nouveau, liste fermée inchangée (`POST /rest/analysis`,
  `GET /rest/hosts`, `GET /rest/hosts/{uuid}`, `GET /rest/system`). Liste blanche `CHAMPS_DEPOT` : `id` (entier positif, motif
  `DEPOT_TENABLE` recopié du paquet partagé et comparé par le test d'architecture) et `name` (texte nettoyé, 200 caractères) ;
  `description`, `dataFormat` et tout autre champ ne sortent pas du script. L'élément « machine » porte `depot` (facultatif,
  nul si inconnu).
- **Rangement** : un dépôt par instance et par identifiant Tenable, nom mis à jour à chaque synchronisation, **liaison jamais
  touchée** par une synchronisation ; le dépôt d'une machine suit Tenable, une machine rapportée sans dépôt garde le sien.
- **Règle** : périmètre effectif = celui **indiqué à la main** sur la machine, qui **prime**, sinon celui de son **dépôt relié**,
  sinon aucun (machine lisible avec `vulnerabilites:administrer` seulement, comme avant). Un seul fragment SQL
  (`perimetreMachine`, `apps/api/src/vulnerabilites/sql.ts`) porte cette règle ; le contrôle de lecture `lisible` s'appuie
  dessus, donc **tous** ses usages suivent : listes et fiches des machines, fiche et compteurs d'un constat, failles déclarées
  et leur fiche, fiche d'un produit, suivi des failles (lecture de toutes les machines touchées), rang et priorité, outils de
  l'assistant (machines rangées, repères et leur résolution), masque de sortie et décompte des mots à ne pas masquer. Le nom
  de périmètre affiché (fiches, listes) est aussi le périmètre effectif ; le filtre « Périmètre » de la liste aussi.
- **Retour à l'hérité** : retirer le périmètre indiqué à la main (`perimetreId: null`, unitaire ou en masse) fait revenir la
  machine au périmètre de son dépôt. Garde-fous : écriture sur le périmètre effectif actuel ; écriture sur le périmètre du dépôt
  s'il diffère ; sans dépôt relié, la machine n'aurait plus de périmètre : `vulnerabilites:administrer`, comme avant.
- **API** : `GET /api/vulnerabilites/depots` (dépôts, périmètre relié, présence, machines et exceptions) et
  `PUT /api/vulnerabilites/depots/{id}` (relier ou délier), avec `vulnerabilites:administrer`, If-Match, écriture sur le
  périmètre actuel et sur le périmètre visé (périmètre visé inaccessible : 422, comme un inconnu), journal
  `vulnerabilites.depot.relie` / `.delie` (identifiants, nombre de machines qui héritent ; ni nom de machine ni nom de dépôt).
  `MachineDto` porte `perimetreOrigine` (`machine`, `depot` ou nul) et `depot` (identifiant, nom, et périmètre du dépôt
  **seulement s'il est visible** de la personne).
- **Écran « Machines »** : onglet « Dépôts Tenable » (administrateurs du module) pour relier chaque dépôt ; la colonne
  « Périmètre » dit « Hérité du dépôt « … » », « Indiqué à la main » ou « Dépôt « … » non relié » ; le choix « Hérité du dépôt
  (retirer le périmètre indiqué à la main) » remplace « Retirer le périmètre » et est proposé à toute personne qui peut
  modifier (le serveur juge).
- **Rôle** : inchangé, toujours par machine.
- Sans reprise de données : les machines déjà rattachées à la main gardent leur périmètre (elles deviennent des exceptions).

### Choix de réalisation, à confirmer par le RSSI

- **Le groupe est le dépôt de Tenable** (choix de la session principale), parce qu'il est déjà dans les réponses lues et ne
  demande ni appel ni droit nouveau. Les autres groupes de Tenable (listes d'actifs `/rest/asset`, dépôts lus par
  `/rest/repository`) demanderaient un appel hors de la liste fermée, peut-être refusé au rôle « Auditor ».
- **Machine vue dans plusieurs dépôts** : le script retient le plus petit identifiant (choix stable d'une synchronisation à
  l'autre). La forme exacte de `repository` (objet `{id, name, description, dataFormat}`) est celle des exemples anonymisés
  du 16/11/2026 ; une autre forme donne « dépôt inconnu », sans écarter le résultat.
- **« Retirer le périmètre » devient « revenir au dépôt »** : il n'y a pas d'exception « aucun périmètre malgré le dépôt ».
  Pour soustraire une machine au périmètre de son dépôt, il faut l'indiquer à la main dans un autre périmètre.
- **Garde-fou du retour à l'hérité** : écriture exigée sur le périmètre du dépôt (c'est un changement de périmètre) ; sans
  dépôt relié, `administrer`.
- **Périmètre du dépôt montré dans la liste des machines** seulement à qui le lit (sinon nul) : son nom ne fuit pas par une
  machine lue par un autre périmètre. Le nom du dépôt, lui, est montré à qui lit la machine.
- **Journal des affectations** : `avant` et `apres` gardent le périmètre **indiqué à la main** (`perimetreId`), pas le
  périmètre effectif.
- Une liaison qui change pendant l'affectation d'une machine n'est pas verrouillée : le contrôle lit la liaison du moment.

### Non vérifié

Aucun appel vers une vraie instance Tenable ; **forme réelle de `repository`** sur l'instance (relevée sur des exemples
anonymisés seulement), nombre de dépôts et cas d'une même machine dans plusieurs dépôts ; Docker et Node 26 ; le parcours
Playwright adapté n'a pas été joué (CI seulement).

### Points ouverts (hors lot)

1. Confirmer le dépôt comme groupe, ou désigner un autre groupe de Tenable (liste d'actifs, étiquette), au prix d'un appel
   nouveau à valider.
2. Exception « sans périmètre malgré le dépôt » (machine réservée à l'administration du module), si le RSSI la veut.
3. Choix du dépôt d'une machine vue dans plusieurs dépôts (plus petit identifiant aujourd'hui).

## Addendum du 17/11/2026 — lot ALH3 : actif exposé relié aux machines internes

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). Migration `083`
(additive : table `vulnerabilites_alh_liaisons_machines` et deux index, colonne `liaisons_version` de
`vulnerabilites_alh_actifs`). Aucun appel réseau nouveau ; liste fermée des appels et liste blanche des champs inchangées.

### Décision du RSSI (17/11/2026)

Relier chaque actif exposé sur Internet (vu par AlgoLightHouse) à la machine interne vers laquelle va la connexion (machine
lue dans Tenable), pour montrer la chaîne domaine → sous-domaine → hôte → service → machine interne. Deux voies, toutes deux
retenues :

1. **À la main** : sur un actif exposé, choisir la machine interne ; délier.
2. **Proposé par la plateforme, confirmé par une personne** : proposition quand l'adresse de l'hôte (ou l'adresse de
   résolution d'un domaine) est une adresse de la machine, ou quand le nom de la machine correspond au sous-domaine (nom
   complet égal, ou première étiquette du domaine égale au nom court de la machine, après normalisation). La personne
   confirme ou rejette ; un rejet n'est pas reproposé à données égales ; rien n'est relié sans confirmation.

Seul le premier maillon est demandé (actif exposé → machine interne).

### Réalisation

- **Granularité : l'actif.** La migration `080` ne range que des hôtes et des domaines ; un service n'est connu que comme
  cible d'une alerte (`cible_type = 'service'`, texte libre) et une technologie comme un lien vers un actif. Sans appel nouveau
  ni champ nouveau, le niveau le plus fin rangé est l'actif : **un actif → une ou plusieurs machines internes** (répartiteur),
  **vingt au plus** (`LIAISONS_MACHINES_PAR_ACTIF_MAX`).
- **Mécanisme repris du rapprochement des failles** (migration `076`, `transitionRapprochement` du paquet partagé) :
  statuts « proposée, confirmée, rejetée, retirée » (sans « rattachée d'office » ni « écartée »), empreintes des données de
  l'actif (nature, valeur, adresse) et de la machine (nom, adresse), schéma de décision `DecisionRapprochement`. Une liaison
  confirmée tient quelles que soient les données ; une rejetée reste tant que les empreintes sont les mêmes, puis est
  reproposée si un critère tient encore, retirée sinon. Règles pures : `packages/shared/src/liaisons-surface.ts`.
- **Critères** (du plus sûr au moins sûr, un seul gardé par paire) : même adresse (IPv4 sans zéro de tête, IPv6 développée,
  IPv4 portée par une IPv6 ramenée à l'IPv4) ; nom complet égal (minuscules, point final retiré, joker jamais comparé) ; nom
  court de la machine (première étiquette de son nom) égal à la première étiquette du domaine. Le nom ne vaut que pour un
  domaine. Seuls les actifs et les machines vus par la dernière synchronisation complète de leur instance sont proposés ;
  vingt propositions au plus par actif (`PROPOSITIONS_MACHINES_PAR_ACTIF_MAX`).
- **Calcul** : à la fin de chaque synchronisation **reçue** d'AlgoLightHouse ou de Tenable, dans sa transaction, sous un verrou
  consultatif partagé avec les décisions ; jamais à la lecture (une lecture n'écrit rien) ; journal
  `vulnerabilites.surface.liaisons.recalculees` (nombres seulement).
- **Lecture** (`vulnerabilites:lire`) : une liaison ou une proposition n'est rendue que si la personne lit l'actif (périmètre
  ALH relié visible, sinon administrer) **et** la machine (périmètre effectif, `lisible`). Sinon la machine n'est ni nommée ni
  comptée ; une liaison **confirmée** vers une machine illisible est seulement signalée (« reliée aussi à une machine que vous
  ne pouvez pas lire », drapeau sans nombre) ; une **proposition** vers une machine illisible ne laisse aucune trace (ni
  ligne, ni compteur, ni filtre). Symétriquement, la fiche d'une machine ne nomme que les actifs lisibles et signale les
  autres sans nombre.
- **Écriture** (`vulnerabilites:modifier`) : confirmer, rejeter, relier, délier exigent de lire l'actif et la machine (sinon
  404, même réponse qu'un élément inconnu), l'écriture sur le périmètre de l'actif et sur le périmètre effectif de la machine
  (un élément sans périmètre n'est lisible qu'avec administrer : sa lecture vaut le contrôle, comme l'affectation d'une
  machine), et `If-Match` sur `liaisons_version` de l'actif. Journal `vulnerabilites.surface.liaison.confirmee`, `.rejetee`,
  `.reliee`, `.deliee` : identifiants internes, critère, origine, version ; ni nom de machine, ni domaine, ni adresse, ni note.
- **API** : `GET /api/vulnerabilites/surface/actifs/{id}/machines` (fiche, ETag), `POST` même adresse (relier à la main),
  `GET /api/vulnerabilites/surface/liaisons?statut=` (propositions par défaut), `POST …/liaisons/{id}/decision`,
  `POST …/liaisons/{id}/deliaison`, `GET /api/vulnerabilites/machines/{id}/surface` ; la liste des actifs porte
  `machinesInternes` (trois machines reliées lisibles au plus, nombres, drapeau) et `versionLiaisons`, et se filtre par
  `liaison=reliee|proposee|a_relier`.
- **Écrans** : « Surface externe », onglet « Actifs » : colonne et filtre « Machine interne » (« Reliée », « Proposée, à
  décider », « À relier »), fiche d'un actif ouverte par sa valeur (confirmer, rejeter, relier à la main par un sélecteur avec
  recherche, délier, note facultative) ; « Machines » : rubrique « Exposition sur Internet » de la fiche d'une machine
  (« Exposée sur Internet par … »). Pas de carte graphique dans ce lot.
- **Assistant** : rien de nouveau ; aucun outil ne lit les liaisons, `MachineDto` est inchangé ; les repères « M-… » et
  « E-… » et le masque restent tels quels.

### Choix de réalisation, à confirmer par le RSSI

- **Calcul à la fin des synchronisations**, plutôt qu'à la lecture : une lecture n'écrit rien et un rejet doit être gardé ;
  conséquence : une proposition n'apparaît qu'après la synchronisation suivante d'AlgoLightHouse ou de Tenable.
- **Délier = rejeter** : une liaison déliée devient « rejetée » et n'est pas reproposée tant que les données ne changent pas.
  Une confirmation ou un rejet s'annule en reliant à la main (ou en déliant), sans route d'annulation propre.
- **Relier à la main une machine proposée** vaut confirmation de la proposition (origine « proposition »).
- **Liaison confirmée vers une machine illisible** : signalée par un drapeau sans nom ni nombre (le maximum permis par la
  consigne), dans la liste, la fiche de l'actif et, symétriquement, la fiche d'une machine. Le refus « nombre maximal
  atteint » compte aussi les liaisons vers des machines illisibles.
- **Nom court** : la règle est appliquée telle quelle ; une première étiquette courante (« www », « mail ») peut proposer une
  machine nommée ainsi, d'où la confirmation humaine. Le nom ne vaut que pour un domaine ; un hôte ne se rapproche que par
  l'adresse.
- **Concurrence** : `If-Match` porte sur l'ensemble des liaisons de l'actif (`liaisons_version`), pas sur chaque liaison ; un
  recalcul ne change pas cette version (une décision vérifie de toute façon que la proposition est encore à décider).
- **Vingt** machines au plus par actif et vingt propositions au plus par actif (choix de la session).
- **Note** d'une décision gardée sur la liaison, jamais au journal (elle pourrait nommer une machine).

### Non vérifié

Aucune synchronisation réelle (tests sur données fictives rangées par le service) ; pertinence des propositions sur un parc
réel (adresses traduites par un équipement de filtrage, répartiteurs, noms DNS internes différents des noms publics : une
adresse publique d'AlgoLightHouse rencontre rarement l'adresse interne vue par Tenable, d'où l'intérêt du nom et de la
liaison à la main) ; volumes réels pour le recalcul (tous les actifs et toutes les machines à chaque fin de
synchronisation) ; Docker et Node 26. Le parcours Playwright adapté n'a pas été joué (CI seulement), et il ne couvre ni la
fiche d'un actif ni la liaison (aucune donnée sur une pile vierge).

### Points ouverts (hors lot)

1. **Priorité** : une machine interne reliée à un actif exposé doit-elle peser dans la priorité d'une faille ou dans le rang
   de la machine ? Le RSSI n'a pas tranché ; ce lot n'a **aucun effet sur la priorité**.
2. **Chaînage front → back → base de données** (machine interne vers machine interne) : non réalisé dans ce lot.
3. **Carte graphique** de la chaîne domaine → sous-domaine → hôte → machine interne : à venir.
4. Liaison au niveau du **service** (port) si AlgoLightHouse le documente comme objet, ou à partir des détections de Tenable
   (port et protocole), au prix d'un champ ou d'un appel nouveau à valider.
5. Faut-il signaler une liaison vers une machine illisible (choix actuel : drapeau sans nom), ou ne rien en montrer ?

## Addendum du 17/11/2026 — lot ALH4 : carte « Lignes d'approche » de la surface externe

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). **Aucune migration**,
aucun stockage nouveau, aucun appel réseau nouveau ; liste fermée des appels et liste blanche des champs inchangées ; aucune
dépendance nouvelle (dessin SVG fait à la main). Lève le point ouvert 3 (« carte graphique ») de l'addendum « lot ALH3 ».

### Décision du RSSI (17/11/2026)

Carte « Lignes d'approche » retenue, d'après les maquettes `08d` (grande échelle : environ 150 domaines, plus de 100 hôtes,
branches repliables, filtres, déplacement) et `08e` (prolongement jusqu'aux machines internes) de
`docs/unification/maquettes-vulnerabilites`. Nouvel onglet « Carte » de l'écran « Surface externe », affiché en premier ; les
onglets « Alertes », « Actifs », « Technologies » et « Périmètres » restent et en sont l'équivalent en tableau.

### Réalisation

- **Route de lecture** `GET /api/vulnerabilites/surface/carte` (`vulnerabilites:lire`) : graphe déjà filtré par les droits —
  actifs lisibles et présents (périmètre ALH relié visible, sinon `administrer`), domaine parent (`parent_alh` de la migration
  080) rendu seulement s'il est lui aussi rendu, alertes **ouvertes** lisibles et présentes avec leur priorité (la plus haute
  de leurs CVE, présence « exposée », règle du lot ALH2), actif visé seulement s'il est rendu, machines internes des liaisons
  **confirmées** lisibles (périmètre effectif), propositions lisibles comptées, liaison vers une machine illisible réduite à un
  drapeau (règles de lecture du lot ALH3, fonction `liaisonsCarte`). Bornée (`CARTE_SURFACE_BORNES` : 3 000 actifs, ceux qui
  portent une alerte ouverte d'abord ; 3 000 alertes, les plus graves d'abord ; 20 CVE par alerte), troncature signalée avec
  les totaux. Rien n'est écrit, aucune entrée de journal.
- **Mise en page côté web**, fonctions pures (`apps/web/src/vulnerabilites/carte-surface.ts`) : branches, filtres, repli, mise
  en page en colonnes et caméra. Colonnes : Internet → branches → domaines → hôtes exposés → alertes ouvertes → rempart →
  machines internes. Un domaine est suivi de l'hôte vers lequel il résout (même adresse) ; un hôte sans domaine forme sa
  propre ligne (branche « Hôtes sans domaine »).
- **Regroupement** par domaine parent (racine de la chaîne `parent`) ou par périmètre (« Regrouper par »).
- **Échelle** : par défaut, seules les branches qui portent une alerte retenue sont dépliées ; leurs lignes sans alerte et les
  autres branches sont repliées en **faisceaux chiffrés** (lignes, hôtes, alertes dont critiques, machines), d'épaisseur
  croissante avec le nombre de lignes (bornée). Clic ou Entrée sur une branche ou un faisceau : déplier ou replier ; une
  branche sans alerte se déplie directement sur ses lignes. « Tout replier », « Tout déplier » **borné à 250 lignes affichées**
  (`LIGNES_MAX`) : au-delà, les branches suivantes restent en faisceau et l'écran le dit.
- **Filtres** (côté web, sur le graphe reçu) : texte (domaine, adresse, CVE), criticité (cases), « Branches en alerte
  seulement », périmètre, type d'alerte.
- **Chemin d'entrée critique** : une ligne dont une alerte ouverte est en **P1** (CVE d'exploitation avérée portée par un actif
  exposé) est tracée en rouge pointillé animé de l'Internet jusqu'aux machines reliées, avec un halo sur l'alerte et un
  bandeau qui ouvre la fiche. Typosquatting et fuites de données sont tracés **côté Internet**, hors des branches. Balayage
  animé décoratif. Toutes les animations sont coupées sous `prefers-reduced-motion: reduce` et à l'impression (le pointillé
  reste, immobile).
- **Déplacement et zoom** par la seule `viewBox` : glisser, Ctrl (ou ⌘) + molette (la molette seule fait défiler la page),
  boutons « Rapprocher », « Éloigner », « Recadrer », flèches, + / − / 0 au clavier ; vue d'ensemble miniature avec le cadre de
  la zone affichée (clic pour y centrer la vue).
- **Clic sur un nœud** : fiche existante de l'alerte (défauts et recommandations), de l'actif (machines internes, décisions) ou
  de la machine (`GET /api/vulnerabilites/machines/{id}`, fiche de l'écran « Machines ») ; aucun écran nouveau.
- **Accessibilité** : SVG nommé (`role="group"`, résumé et mode d'emploi en `aria-describedby`), nœuds atteignables au
  clavier (`role="button"`, nom lisible), formes distinctes (losange : domaine, carré : hôte, rond : alerte, écran : machine,
  « ? » : à relier, losange pointillé : typosquatting, triangle : fuite) et libellés en plus de la couleur, légende, boutons
  nommés. Couleurs des jetons de la cartographie (`--carte-*`), contrastes vérifiés en clair et en sombre. Sur petit écran, la
  carte garde une largeur lisible et défile dans son cadre.
- **CSP** : aucun attribut `style` ; positions par attributs SVG, couleurs, traits et animations par les classes de
  `packages/ui/src/neon-surface.css` (sans px ni rem).

### Écarts à la maquette

- **Pas de colonne « services »** : la migration 080 ne range que des hôtes et des domaines ; un service (port) n'est connu que
  comme cible d'une alerte (`cible_type = 'service'`, texte libre) ou par une technologie. La carte montre à la place, sur la
  ligne de l'actif, l'**alerte ouverte la plus haute** (criticité de l'éditeur, P1 signalé) et le nombre d'alertes. Pour avoir
  la colonne de la maquette, il faudrait ranger les services comme objets (port, protocole, produit) : un champ ou un appel
  nouveau d'AlgoLightHouse (`/targets/services` si l'éditeur le documente) ou les détections de Tenable, à valider par le RSSI
  (point ouvert 4 du lot ALH3).
- **Pas de colonne « derrière »** (machine interne vers machine interne, 08e) : le chaînage front → back → base n'est pas
  rangé (point ouvert 2 du lot ALH3).
- **Pas de panneaux** « exposition prioritaire », « journal de la surface externe », « technologies », « capteurs » ni de
  chiffres clés en tête : hors du lot (carte seulement) ; les onglets existants donnent ces informations.
- **Le sous-domaine racine** est une ligne de sa branche, comme les autres ; la maquette ne le montre pas.
- **Plusieurs machines** sur une ligne : trois dessinées, les autres comptées (« et n autres »).
- **Une alerte par ligne** est dessinée (la plus haute) ; un clic ouvre sa fiche, les autres sont dans l'onglet « Alertes ».

### Choix de réalisation, à confirmer par le RSSI

- **Regroupement par défaut : domaine parent** (le RSSI n'a pas tranché ; le sélecteur dit « Choix par défaut à confirmer »).
- **« À relier »** : affiché sur une ligne sans machine lisible reliée **et** sans liaison vers une machine illisible, pour qui a
  `vulnerabilites:modifier` (le serveur juge l'écriture) ; une proposition en attente donne « à relier (proposée) ». Une
  liaison confirmée vers une machine illisible s'affiche « machine non lisible », sans nom (choix du lot ALH3).
- **Chemin critique = alerte ouverte en P1**, priorité calculée pour ce que la personne lit (lot ALH2).
- **Bornes** : 3 000 actifs, 3 000 alertes, 250 lignes affichées, six alertes tracées côté Internet (les autres comptées).
- **Filtres côté web** sur le graphe reçu (une seule lecture, pas de paramètre de requête) ; la criticité et le type ne font
  que choisir les alertes retenues, « Branches en alerte seulement » masque les lignes sans alerte retenue.
- **Molette** : zoom seulement avec Ctrl ou ⌘, pour ne pas piéger le défilement de la page.
- **Alertes sans actif de la carte** (cible non rangée ou illisible) : comptées sous la colonne Internet (« n hors carte »).

### Non vérifié

Aucune donnée réelle (tests et rendu sur données fictives) ; volumes réels au-delà de la fixture de test (150 domaines,
120 hôtes) et de la borne ; lisibilité sur un parc réel (noms longs, branches très inégales). Rendu vu par une capture locale
(Chromium, banc de rendu temporaire hors base, clair et sombre, 1440 et 390 px, axe `wcag2a`/`wcag2aa` sans violation), pas
dans la pile complète ; Docker et Node 26 ; le parcours Playwright adapté n'a pas été joué (CI seulement) et ne voit qu'une
carte vide (aucune donnée sur une pile vierge).

### Points ouverts (hors lot)

1. Ranger les **services** (port, protocole) pour la colonne de la maquette, et relier au niveau du service (point 4 du lot
   ALH3).
2. **Chaînage** machine interne → machine interne (« derrière ») pour prolonger le chemin critique.
3. Confirmer le **regroupement par défaut** et les bornes d'affichage.
4. Panneaux de la maquette autour de la carte (exposition prioritaire, journal, capteurs), si le RSSI les veut.

## Addendum du 17/11/2026 — lot ALH5 : priorité commune, majoration par la machine interne, liaison en masse

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). Migration `084`
(additive : la contrainte des origines de `vulnerabilites_alh_liaisons_machines` est recréée pour admettre `masse` ; aucune
donnée modifiée). Aucun appel réseau nouveau, aucune dépendance nouvelle ; liste fermée des appels et liste blanche des champs
inchangées. Remplace le choix n° 1 de l'addendum « lot ALH2 » ; lève le point ouvert 1 de l'addendum « lot ALH3 » et le
point ouvert 3 (regroupement par défaut) de l'addendum « lot ALH4 ».

### Décisions du RSSI (17/11/2026)

| N° | Question | Décision |
| --- | --- | --- |
| A | Priorité selon les droits | « Une priorité est la même pour tout le monde, sinon ça n'a pas de logique. » La priorité d'une CVE, d'une faille, d'une alerte, d'une technologie, le rang d'une machine et tout filtre ou compteur fondé sur la priorité se calculent sur **tous les faits connus** de la plateforme, sans tenir compte des droits de lecture. Restent soumis aux droits : les **noms et le détail** (domaines, adresses, machines, périmètres, nombre d'actifs touchés hors de ce que la personne lit, liens vers les fiches) |
| B | Faille exposée qui mène à une machine vulnérable | Une alerte ouverte ou une technologie exposée dont l'actif a une liaison **confirmée** (lot ALH3) vers au moins une machine interne portant elle-même au moins une faille présente en P1 ou P2 monte d'**un cran** (P4 → P3, P3 → P2, P2 → P1 ; P1 reste P1), avec le fait « mène à une machine interne vulnérable ». Jamais sur une proposition non confirmée. Même résultat pour tout le monde ; la machine n'est nommée qu'à qui la lit |
| C | Liaison en masse | « Si la machine a le même préfixe, type pre ou preprod, la possibilité de faire un rapprochement massif via filtre avec wildcard. » Interprétation de la session principale, **à confirmer** : voir « Réalisation » |
| — | Regroupement par défaut de la carte (lot ALH4) | **Domaine parent**, confirmé ; la mention « Choix par défaut à confirmer » est retirée de l'écran |
| — | Groupe de Tenable (lot V4d) | Le groupe est bien le **dépôt** de Tenable : confirmé (choix n° 1 et point ouvert 1 de l'addendum « lot V4d » levés) |
| — | Preuve de concept du CERT Santé | Elle reste « **exploitable** » (P2 avec une gravité élevée et une présence avérée), pas « exploitée » : règle V23 inchangée |

### Réalisation

- **A — priorité commune.** Le fragment SQL des faits d'AlgoLightHouse devient `cvesAlh` (`apps/api/src/vulnerabilites/sql.ts`) :
  CVE des versions encore détectées des technologies présentes, sur **tout** actif. `lireFaitsCve`, `exploiteeCve` et
  `preuveCertSante` (`sources.ts`) perdent leur paramètre « personne » ; tous leurs appelants suivent : constats de Tenable
  (liste, fiche, filtres « exploitée » et « exploitable »), machines (compteurs et rang), failles déclarées, fiche d'un
  produit, veille, surface externe (alertes, fiche, technologies, carte) et assistant. `lisible(user)` et `lisibleAlh(user)`
  filtrent toujours les **lignes** rendues.
  - Technologie : sa priorité porte sur **toutes** ses versions encore détectées, y compris sur des actifs que la personne ne
    lit pas ; les versions détaillées (avec leurs actifs et leurs CVE), les compteurs de CVE (`nombreCves`, `exploitees`,
    `preuves`, `cvssMax`), la recherche par CVE et le filtre « exploitée selon l'éditeur » restent ceux des versions lisibles
    (détail). L'écran dit « Priorité tenue de versions détectées sur des actifs que vous ne pouvez pas lire » quand aucune CVE
    détaillée n'atteint le niveau de la technologie.
  - Veille : les sources (AlgoLightHouse compris) sont les mêmes pour tous ; `surfaceExterne` compte les actifs et alertes
    lisibles et porte `horsLecture` (exposée aussi ailleurs, sans nom ni nombre).
  - Assistant (`evaluer_cve`, addendum à l'ADR 0086) : présence (détectée, déclarée, exposée) et priorité sur tous les faits ;
    constats, machines, repères « M-… » et « E-… », technologies et alertes limités aux droits ; `aussiHorsDeVosDroits` signale
    une exposition ailleurs, sans repère, nom ni nombre.
  - Une personne peut donc voir « P1 : exploitée et exposée sur Internet » sans voir sur quel actif. Aucun nom ni identifiant
    d'un actif ou d'une machine illisible ne sort : ni en API (listes, fiches, carte, veille), ni dans les faits (le fait de la
    majoration est sans nom), ni au journal (une lecture n'écrit rien), ni chez l'assistant. Tests : « deux personnes, même
    priorité » et non-fuite (`apps/api/test/vulnerabilites-priorite-commune.test.ts`), tests du lot ALH2 adaptés.
- **B — majoration.** Règle dans la grille partagée (`majorerPriorite`, `machineVulnerable`, `NIVEAUX_MACHINE_VULNERABLE`,
  fait `machine_interne_vulnerable`, `packages/shared/src/priorite-vulnerabilites.ts`), testée par des cas en table ; pas de
  seconde grille. `apps/api/src/vulnerabilites/majoration.ts` dit quels actifs mènent, par une liaison confirmée, à une machine
  vulnérable : au moins une faille **présente** en P1 ou P2 (constat de Tenable présent sur la machine, présence « détectée » ;
  ou faille déclarée par un produit relié à la machine et non détectée sur elle, présence « déclarée »), calculée sur tous les
  faits. **Majorés** : la priorité d'une alerte ouverte (et de ses CVE dans sa fiche) dont l'actif visé mène à une machine
  vulnérable ; la priorité d'une CVE de technologie pour une version encore détectée sur un tel actif, et celle de la
  technologie (la plus haute de ses CVE) ; la carte (chemin critique = alerte ouverte en P1 **après** majoration) et les tris par
  priorité qui en découlent. **Non majorés** : les failles des machines elles-mêmes (constats, failles déclarées, rang), la
  priorité d'une CVE dans la veille ou chez l'assistant (CVE « globale ») — la majorer ferait dépendre la priorité d'une faille
  de machine de celle d'une autre machine par la surface externe (cycle possible) et rendrait ambiguë la priorité d'une CVE
  portée à la fois par des actifs qui mènent à une machine vulnérable et par d'autres ; une alerte terminée (présence
  « absente ») ; une alerte sans CVE (pas de priorité à majorer).
- **C — liaison en masse.** Onglet « Actifs » de « Surface externe », bouton « Relier en masse » (droit de modifier) :
  - Motif des actifs (valeur : domaine ou adresse) et, en mode « **un pour un** », motif des machines (nom), avec le seul joker
    `*` (zéro caractère ou plus), sans distinction de casse ; caractères admis : lettres, chiffres, `.`, `-`, `_`, `:` et `*`,
    au moins un caractère qui n'est pas un joker. Comparaison **littérale** par découpage sur `*` (`correspondanceJoker`,
    `packages/shared/src/liaisons-surface.ts`), en temps linéaire : ni `LIKE`, ni expression régulière construite. Un pour un :
    même nombre de jokers dans les deux motifs (au moins un) ; un actif est relié à la machine dont les parties couvertes par
    les jokers sont identiques aux siennes (`pre-*.exemple.example` et `srv-pre-*` relient `pre-web01.exemple.example` à
    `srv-pre-web01`) ; plusieurs machines : écarté. Mode « **tous vers une machine** » : tous les actifs du motif vers la
    machine choisie.
  - **Aperçu obligatoire** (`POST /api/vulnerabilites/surface/liaisons/masse/apercu`, rien n'est écrit) : paires proposées,
    actifs sans correspondance, correspondances multiples écartées (200 lignes au plus par liste, nombres exacts), déjà
    reliées, actifs au plafond de vingt machines, paires hors des droits d'écriture ; au-delà de **200 paires**, refus (422)
    avec le nombre. Seuls les actifs lisibles et présents et les machines lisibles y paraissent ou y sont comptés.
  - **Application** (`POST /api/vulnerabilites/surface/liaisons/masse`) sur l'aperçu validé : l'interface renvoie les paires
    (identifiants et version des liaisons de l'actif) et l'**empreinte** de l'aperçu (SHA-256 de la personne, de la demande et
    des paires) ; une empreinte qui ne correspond pas est refusée (422). Sous le verrou consultatif des liaisons, les actifs
    sont verrouillés, puis chaque paire est **revérifiée** : elle doit figurer encore parmi les paires que la demande donne à la
    personne (lecture et écriture sur le périmètre de l'actif et sur le périmètre effectif de la machine, plafond, pas déjà
    reliée) avec la même version ; sinon elle est **écartée et comptée**. Jamais une paire calculée de nouveau n'est reliée.
  - Liaisons créées : **confirmées**, origine `masse` (« Reliée en masse par motif »), auteur et date de la décision, sans note ;
    une proposition ou un rejet existant pour la paire devient cette liaison. La version des liaisons de chaque actif touché
    avance. **Une entrée de journal** par opération, `vulnerabilites.surface.liaisons.reliees_en_masse` : mode, motifs saisis,
    machine choisie (identifiant interne) en mode « tous vers une machine », nombres demandés, reliés et écartés ; ni nom
    d'actif ni nom de machine au-delà des motifs saisis.
  - Pas de nouvelle table : la table du lot ALH3 suffit (migration `084` pour la valeur d'origine) ; le recalcul des
    propositions garde l'origine d'une liaison confirmée.

### Choix de réalisation, à confirmer par le RSSI

- **Interprétation de la décision C** (session principale) : les deux modes, l'aperçu obligatoire, la borne de 200 paires et
  l'application sur l'aperçu validé ci-dessus.
- **Machine vulnérable** : les failles **closes** (corrigée, risque accepté, non concernée) ne comptent pas, comme pour le rang
  des machines ; une faille déclarée compte comme un constat présent.
- **Fait de la majoration sur un P1** : ajouté aussi quand le niveau ne change pas (P1 reste P1), pour dire que l'actif mène à
  une machine vulnérable.
- **Technologie** : priorité sur toutes les versions, détail (versions, CVE, compteurs, recherche, filtre « exploitée selon
  l'éditeur ») sur les versions lisibles seulement.
- **Veille et assistant** : exposition hors des droits signalée par un drapeau sans nombre (`horsLecture`,
  `aussiHorsDeVosDroits`) ; l'assistant ne dit plus « CVE inconnue » quand seul un constat illisible la porte.
- **Liaison en masse** : actifs **présents** seulement (vus par la dernière synchronisation complète), machines lisibles de tout
  état de présence (comme la liaison à la main) ; une machine sans nom n'est jamais retenue par un motif ; un actif ne figure
  qu'une fois par opération ; une paire hors des droits d'écriture est comptée dans l'aperçu (elle est lisible) et non reliée ;
  la machine choisie en mode « tous vers une machine » devenue illisible fait échouer l'opération (404).

### Non vérifié

Aucune donnée réelle (tests sur données fictives) ; volumes réels pour le calcul des machines vulnérables (toutes les machines
liées par une liaison confirmée, à chaque lecture d'une liste de la surface externe) et pour l'aperçu en masse (tous les actifs
lisibles et toutes les machines lisibles parcourus en mémoire) ; Docker et Node 26. Le parcours Playwright adapté (fenêtre
« Relier en masse », aperçu vide, motif refusé) n'a pas été joué (CI seulement) : sur une pile vierge, il ne relie rien.

### Points ouverts (hors lot)

1. Confirmer l'interprétation de la décision C (modes, borne, aperçu).
2. Majorer aussi la priorité d'une CVE « globale » (veille, assistant) ou d'une faille de machine, si le RSSI le veut, en
   tranchant le cas d'une CVE portée par plusieurs actifs.
3. Chaînage machine interne → machine interne : une machine « derrière » une machine vulnérable n'est pas prise en compte.
4. Annuler une liaison en masse d'un coup (aujourd'hui : délier liaison par liaison).

## Addendum du 17/11/2026 — lot ALH6 : services exposés et colonne « Service » de la carte

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). Migration `085`
(additive : tables `vulnerabilites_alh_services` et `vulnerabilites_alh_service_alertes`, deux index). Aucun appel réseau
nouveau (liste fermée inchangée), aucune dépendance nouvelle. Lève le point ouvert 1 (« ranger les services ») de l'addendum
« lot ALH4 » et l'écart « pas de colonne services » de cet addendum ; la liaison au niveau du service (point 4 du lot ALH3)
reste ouverte.

### Décision du RSSI (17/11/2026)

Lire les services (ports) chez AlgoLightHouse pour afficher la colonne « Service » de la carte « Lignes d'approche », avec des
termes techniques exacts : « 443/tcp · HTTPS » puis le produit (« nginx 1.18 »). Chaque colonne porte un terme précis (domaine
parent, nom de domaine, IP publique, service port/protocole, machine interne).

### Faits relevés sur le descriptif de l'éditeur

Le descriptif (OpenAPI, version 1.14.0) ne documente **aucune liste des services d'un hôte**. Les ports n'apparaissent que
dans le détail d'une alerte, dans `fragments[].json_data`, objet discriminé par `fragment_type` : `PortFragmentData` (`port`,
`protocol` tcp ou udp, `state`, `service_name`, `product`, `version`, `vendor`, `banner`, `cpe`, `is_cdn`),
`VulnerableComponentFragmentData` (`ports` : entiers, `vendor`, `product`, `version`, `cpe`, `latest_version`,
`version_status` eol ou outdated), `SubdomainFragmentData` (`subdomain`, `port`) ; les autres types (fuite, mention git, S3,
chemin, WordPress, certificat TLS, faiblesse) ne portent pas de service. Sur les exemples réels anonymisés relevés par le RSSI,
`json_data` valait `null` dans les deux détails vus ; la liste des alertes portait un objet `data` (déclaré obsolète) avec un
port et un produit, qui n'est pas lu.

### Réalisation

- **Exécutant** (`scripts/integration-http.py`) : dans le détail déjà lu, un fragment est réduit à `alert_cves` et `json_data`
  (`CHAMPS_FRAGMENT_ALH`), puis `json_data`, pour les seuls types `port`, `vulnerable_component` et `subdomain`
  (`TYPES_FRAGMENT_SERVICE_ALH`), à `fragment_type`, `port`, `protocol`, `service_name`, `product`, `version`, `vendor`,
  `cpe`, `ports`, `version_status` (`CHAMPS_SERVICE_ALH`). Jamais `banner`, `state`, `subdomain` (un nom de domaine),
  `latest_version`, `description` ni `note` de fragment, `sensitive_data`, ni aucun champ des autres types. Port entier de 1 à
  65535 (un texte est écarté), protocole `tcp` ou `udp` sinon **non renseigné** (jamais « tcp » par défaut), textes nettoyés et
  bornés comme les autres (nom du service 100, produit, version, éditeur 100, CPE 300 commençant par `cpe:`), « * » et vide
  tiennent lieu d'absence. Un composant vulnérable donne un service par port (20 ports au plus), sans protocole ; un
  sous-domaine, le port seul. Dans une alerte, un même port et protocole n'apparaît qu'une fois (les champs connus se
  complètent) et un port sans protocole rejoint le seul service de même port dont le protocole est connu ; 50 services au plus
  par alerte. Forme absente, nulle ou inattendue : rien n'est retenu, la synchronisation continue. Les listes et les bornes
  sont recopiées du paquet partagé et comparées par `apps/api/test/integrations-architecture.test.ts`.
- **Stockage** (migration `085`, `apps/api/src/vulnerabilites/services-surface.ts`) : un service par instance, actif, port et
  protocole (`UNIQUE NULLS NOT DISTINCT`, protocole nul admis), avec nom, produit, version, éditeur, CPE et cycle de vie ;
  liens vers les alertes qui le portent. À chaque lecture du détail d'une alerte, ses liens sont remplacés et ses services
  rangés sur l'actif qu'elle vise (hôte, sinon domaine) ; une valeur lue remplace la valeur rangée, une valeur absente ne
  l'efface pas ; un service qu'aucune alerte ne porte plus est supprimé. Une alerte dont le détail n'est pas relu garde ses
  liens (comme ses CVE). Remise à vide : avec le travail.
- **Présence** : un service n'est rendu que si son actif est présent et qu'au moins une alerte **ouverte et présente** le porte
  (vue par la dernière synchronisation complète) : seule une synchronisation complète le fait disparaître, comme le reste de
  la surface externe.
- **API** : la carte (`services`, `nombreServices` de chaque actif), la liste des actifs (même champs), la fiche d'un actif
  (`GET …/surface/actifs/{id}/machines`, `services` avec les alertes ouvertes lisibles qui les portent) et la fiche d'une
  alerte (`services` qu'elle porte) les rendent **sous les droits de lecture de l'actif** ; vingt services au plus par actif
  dans la carte et la liste (`SERVICES_PAR_ACTIF_MAX`), tous dans la fiche. Priorité inchangée (règles des lots ALH2 et ALH5).
- **Écrans** : colonne « Service » de la carte entre « IP publique » et « Alerte ouverte » : « port/protocole · service » (nom
  du service en capitales, « (+n) » s'il y en a d'autres), produit et version en dessous ; « port non communiqué » pour un
  actif en alerte sans port connu ; nombre de services connus dans les faisceaux ; le filtre cherche aussi le port (« 443 »,
  « 443/tcp ») et le nom du service, le produit, sa version ou son éditeur. Onglet « Actifs » : colonne « Services connus » ;
  fiche d'un actif : « Services exposés » ; fiche d'une alerte : « Services portés par l'alerte ». La légende, l'aide de la
  carte, l'onglet « Actifs », la fiche d'un actif et l'aide en ligne disent que seuls les services portés par une alerte sont
  connus.
- **Défaut corrigé côté Internet** : les traits d'Internet vers les branches filent à droite de la colonne « Internet » avant de
  descendre ; les libellés du typosquatting et des fuites tiennent sur trois lignes de 24 caractères au plus, coupées après un
  point, un tiret ou une espace. Au passage : les traits d'une branche vers ses lignes passent sous les noms de domaine, une
  IPv6 longue tient sur deux lignes, les en-têtes de colonnes ne chevauchent plus les libellés de la première ligne.
- **Assistant** : rien de nouveau ; aucun outil ne lit les services, le masque et les outils sont inchangés. Les champs
  nouveaux (port, protocole, nom du service, produit, version, éditeur, CPE) ne désignent ni domaine ni adresse.

### Choix de réalisation, à confirmer par le RSSI

- **Colonne séparée** plutôt que fusionnée avec l'alerte : à 1440 px, la scène passe de 1 176 à 1 460 unités (texte un peu plus
  petit, environ 11,5 px à l'écran) ; aucun chevauchement de texte mesuré (banc de rendu, noms de domaine de 30 caractères et plus).
- **Un service par ligne affiché** (le plus petit port), les autres comptés « (+n ») et listés dans la fiche de l'actif.
- **Nom du service en capitales** (« HTTPS » pour `https` du scanner), comme l'exemple du RSSI.
- **Fusion d'un port sans protocole** dans le seul service de même port dont le protocole est connu (sinon il reste à part,
  affiché « 8443 » seul) ; au rangement, la fusion n'a lieu que dans une même alerte, à l'affichage sur tout l'actif.
- **Services d'un actif portés par une alerte illisible** : rendus (droits de l'actif), sans nommer l'alerte. **Fiche d'une
  alerte lisible dont l'actif ne l'est pas** : aucun service.
- **Alerte dont l'actif n'est pas rangé** : ses services ne sont pas rangés (l'éditeur range l'actif dans la même
  synchronisation, avant l'alerte).
- **Alerte terminée** : ses services ne sont plus rendus dans la carte ni la liste ; sa fiche les montre encore.
- **Champ `resolved` d'un fragment** : non lu (hors de la liste) ; un port d'un constat résolu peut donc être montré tant que
  l'alerte est ouverte.

### Non vérifié

**Forme réelle de `json_data`** : lue sur le descriptif seulement ; sur les deux détails réels relevés, elle valait `null`. Le
lecteur est tolérant (rien n'est rangé si la forme diffère) : la colonne peut rester vide (« port non communiqué ») sur un
espace réel. Volumes réels (nombre de fragments, de services par actif) ; Docker et Node 26. Le parcours Playwright adapté n'a
pas été joué (CI seulement) ; sur une pile vierge, la carte est vide. Rendu vu sur un banc local (Chromium, clair et sombre,
1440 et 390 px, axe `wcag2a`/`wcag2aa` sans violation), pas dans la pile complète.

### Points ouverts (hors lot)

1. Vérifier sur un espace réel la forme de `json_data` (et si `data` de la liste, obsolète, porte des ports que les détails
   n'ont pas) ; demander à l'éditeur une liste des services d'un hôte.
2. Liaison au niveau du **service** (actif + port vers une machine interne), au lieu de l'actif.
3. Lire `resolved` d'un fragment pour écarter un port résolu, si le RSSI le veut.
4. Services lus aussi dans les détections de Tenable (port et protocole des constats) pour la machine interne.

## Addendum du 17/11/2026 — lot V6 : alertes décidées par la plateforme, fenêtre d'alerte critique

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). Migration `086` (additive :
table `vulnerabilites_alertes`, trois index et son déclencheur de temps réel ; contrainte de portée de `grc_notifications`
recréée pour admettre deux types de plus, index unique partiel). Aucun appel réseau, aucun appel au modèle, aucune dépendance
nouvelle. Réalise le point 21 et la notification « sans assistant » du point 11 ; lève le point ouvert 4 de l'addendum « lot
ALH1 » et le point ouvert 1 de l'addendum « lot ALH2 » pour les CVE exposées (pas pour une alerte de l'éditeur sans CVE).

### Décision du RSSI (17/11/2026)

« Les alertes ensuite » : être alerté quand une faille devient prioritaire ; « en cas d'alerte critique zero-day, comme PHP, une
fenêtre alerte rouge en gros comme notification », avec des bandes diagonales animées (maquette validée
`docs/unification/maquettes-vulnerabilites/07-alerte-critique.png`). La plateforme décide d'une alerte, par règle ; jamais
l'assistant.

### Réalisation

- **Règles** (`packages/shared/src/alertes-vulnerabilites.ts`, fonctions pures testées en table) : niveau d'alerte d'une faille
  présente (`niveauAlerte` : P1 critique, P2 simple, rien pour P3 et P4), décision (`deciderAlerte` : créer, mettre à jour sans
  rejeu, monter, descendre, clore), motif de clôture (`motifCloture` : plus présente, traitée, sous le seuil), empreinte des
  faits, clé d'une faille (`cleAlerte` : la CVE, ou « constat:<identifiant> » pour un constat sans CVE), titre de notification
  (niveau, CVE, produit). La priorité reste celle de la grille (`calculerPriorite`, `majorerPriorite`).
- **Faits** (`apps/api/src/vulnerabilites/alertes.ts`) sur **tous** les faits connus (lot ALH5, décision A) : une faille est
  présente par un constat de Tenable présent et non traité (présence « détectée », avec les valeurs de Tenable pour ce constat),
  par une faille déclarée rattachée et non traitée (« déclarée »), ou par une exposition sur Internet (« exposée », version
  encore détectée d'une technologie ou alerte ouverte et présente de l'éditeur ; majorée si l'actif mène, par liaison
  confirmée, à une machine interne vulnérable). Sa priorité est la plus haute de ses présences. Rangés avec l'alerte : priorité
  et faits, présences, sources de l'exploitation avec leur date, nombres globaux, titre et produit ; aucun nom.
- **Déclenchement** : à la fin de chaque synchronisation reçue de Tenable ou d'AlgoLightHouse, dans sa transaction, sous un point
  de sauvegarde (un échec est journalisé et annulé seul, la synchronisation reste reçue ; l'évaluation suivante rattrape) ; après
  chaque collecte reçue de la veille, quelle que soit la source (après le recalcul des rapprochements) ; après une décision qui
  change les faits, dans une transaction propre qui suit la sienne (produit surveillé créé, modifié ou supprimé, rapprochement
  décidé ou annulé, état de suivi, liaison d'un actif à la main, décidée, déliée ou en masse, seuil de priorité). Verrou
  consultatif propre. Module désactivé : rien n'est évalué ni créé.
- **Une alerte par faille** tant qu'elle n'est pas close (index unique partiel) ; une faille revenue après clôture ouvre une
  nouvelle alerte. Journal : `vulnerabilites.alerte.ouverte`, `.niveau`, `.close`, `.prise_en_compte`,
  `vulnerabilites.alertes.evaluees` (identifiants, CVE, niveaux, motifs, nombres, déclencheur ; jamais de nom).
- **Prise en compte** : `POST /api/vulnerabilites/alertes/{id}/prise-en-compte`, `vulnerabilites:modifier`, `If-Match` sur la
  version de l'alerte ; 409 sur une alerte close ou déjà prise en compte. Lecture : `GET /api/vulnerabilites/alertes` (filtres
  état et niveau), `GET …/alertes/fenetre`, `GET …/alertes/{id}` (ETag), avec `vulnerabilites:lire`.
- **Fenêtre d'alerte critique** (`apps/web/src/vulnerabilites/FenetreAlerteCritique.tsx`), montée une fois dans la mise en page,
  pour qui lit le module, tant qu'une alerte critique est ouverte et non prise en compte : grande fenêtre rouge centrée d'après la
  maquette 07, bandes diagonales qui défilent et onde du pictogramme (classes `ac-*` de `packages/ui/src/neon-surface.css`, sans
  style en ligne ni longueur en px ou rem), toutes coupées sous `prefers-reduced-motion: reduce` et à l'impression ; pas de
  texte clignotant (contrairement à la maquette). `role="alertdialog"`, `aria-modal`, nom et description accessibles, focus
  piégé (`FocusTrap`) puis rendu (`useFocusReturn`), Échap sans effet. Au-dessus de la page sans la démonter. Contenu : niveau et
  priorité, titre, CVE et produit, présence en nombres lisibles, sources de l'exploitation, heure ; plusieurs alertes dans la
  même fenêtre, la plus récente en tête, cinq listées au plus et le reste compté. Boutons : « Pris en compte », « Plus tard » et
  « Ouvrir la fiche » avec le droit de modifier ; « Fermer pour cette session » et « Ouvrir la fiche » en lecture seule.
- **Onglet « Alertes »** (Risques > Vulnérabilités) : liste (niveau, faille, priorité et faits, présence, état, par qui et quand),
  filtres par état et par niveau, fiche ouverte par le titre ou par `?alerte=` (lien des notifications), prise en compte ; rappel
  discret en tête des écrans du module tant qu'une alerte critique est en cours. Temps réel : entité `vulnerabilites_alertes`.
- **Notifications** par le module existant (ADR 0058) : types `vulnerabilites_alerte_critique` et `vulnerabilites_alerte`
  (réglables par groupe, rôle et personne ; application par défaut, courriel si choisi et si le courriel est configuré), sans
  SMSI ni objet ; une par personne, alerte et niveau ; titre et courriel : niveau, CVE, produit et lien seulement. Listées dans
  « Mes rappels » avec un lien vers l'alerte, à qui lit encore le module.

### Choix de réalisation, à confirmer par le RSSI

- **Seuil de l'alerte simple : P2** (le RSSI ne l'a pas fixé ; option prudente). Rien pour P3 et P4.
- **Prise en compte par alerte, pour tout le monde**, réservée à `vulnerabilites:modifier` (option la plus prudente du cadrage).
  **Écart avec le point 21**, qui parle d'une prise en compte et d'une fenêtre « par faille et par personne ».
- **Destinataires** : tous les comptes actifs qui lisent le module, selon leurs réglages de notification (point ouvert 2 : pas de
  ciblage du responsable du produit). Les réglages personnels s'appliquent aussi aux alertes critiques (contrairement aux
  alertes de sécurité de l'ADR 0074) ; la fenêtre, elle, ne dépend d'aucun réglage.
- **Plafond** : vingt alertes simples notifiées par évaluation (les critiques le sont toutes) ; au-delà, elles sont ouvertes et
  listées sans notification (« notifiée : non »), pour ne pas inonder les personnes au premier passage sur un grand parc.
- **Montée et descente** : une alerte simple qui devient critique est notifiée une fois de plus et sa prise en compte éventuelle
  est annulée (la fenêtre doit paraître) ; une alerte critique qui redescend en P2 reste ouverte en alerte simple, sans
  notification, avec sa prise en compte.
- **« Plus tard », « Fermer pour cette session » et « Ouvrir la fiche »** masquent la fenêtre dans l'onglet jusqu'à la fin de la
  session (mémoire de l'onglet, effacée à la déconnexion) ou jusqu'à une nouvelle montée en critique ; un autre onglet la
  remontre.
- **Nombres** : machines et actifs exposés que la personne lit, et un drapeau sans nombre pour les autres (comme le lot ALH5) ;
  jamais de total global, même si la mention « dont n que vous pouvez lire » du cadrage pouvait le laisser entendre.
- **Faille** : la CVE ; un constat de Tenable avec plusieurs CVE donne une alerte par CVE (priorité de la CVE avec les valeurs de
  Tenable pour ce constat) ; un constat sans CVE a sa propre alerte (P2 au plus). Une alerte d'AlgoLightHouse sans CVE n'en
  donne aucune (pas de priorité).
- **Titre** : nom du catalogue KEV, sinon nom du contrôle de Tenable, sinon éditeur et produit déclaré ; **produit** : celui du
  catalogue KEV, sinon de NVD, sinon le nom du produit surveillé (sans sa version).
- **Évaluation globale** à chaque déclencheur (toutes les failles présentes) ; relier un produit à une machine ou changer un
  périmètre ne la déclenche pas (seuls des nombres changeraient ; ceux qu'on lit sont recalculés à chaque lecture).
- **« Mes rappels »** : la route des rappels est réservée à qui lit un module métier ; une personne qui ne lit que le module
  Vulnérabilités reçoit la notification (et le courriel si elle l'a choisi) mais ne la voit pas dans « Mes rappels » ; elle a la
  fenêtre et l'onglet « Alertes ». Limite du module de notifications, laissée telle quelle (pas de contournement).

### Contradictions relevées avec le cadrage antérieur (non tranchées)

- Point 21 : fenêtre « pour les personnes qui ont le droit de lire le module **et la faille** » et prise en compte « par
  personne » ; le lot suit le cadrage du 17/11/2026 (existence et priorité communes, lot ALH5 ; prise en compte par alerte).
- Point 11 et V6 : « l'assistant priorise et alerte », « ronde sur événement » : non réalisé ici (la plateforme alerte sans
  l'assistant) ; la ronde sur événement reste à faire.
- Point ouvert 12 : la fenêtre ne s'ouvre qu'au plus haut niveau (P1 : exploitée et présente) ; « exploitée, produit à
  confirmer » (P2 de la grille) n'ouvre **aucune** alerte, puisque la faille n'est pas présente.
- Point ouvert 11 (zero-day) : l'alerte critique vaut pour toute faille dont l'exploitation est avérée et présente (réponse
  proposée), sans distinguer les failles sans correctif publié.

### Non vérifié

Aucune donnée réelle (tests sur données fictives) ; durée de l'évaluation globale sur un parc réel (tous les constats présents,
toutes les failles déclarées et toutes les expositions à chaque déclencheur, dans la transaction d'une synchronisation) ; envoi
réel d'un courriel ; plusieurs onglets ouverts ; Docker et Node 26. Rendu vu sur un banc local (Chromium, clair et sombre, 1440
et 390 px, mouvement normal et réduit, axe `wcag2a`/`wcag2aa` sans violation, CSP stricte, focus piégé et rendu, Échap sans
effet), pas dans la pile complète. Le parcours Playwright (onglet « Alertes » sur une pile vierge, aucune fenêtre) n'a pas été
joué (CI seulement) : une pile de test n'a aucune faille présente, la fenêtre n'y est jamais affichée.

### Points ouverts (hors lot)

1. **Niveau d'alerte 1 à 4 et radar** (point 18, maquettes du poste de commandement) : non réalisés ; la fenêtre dit « priorité
   P1 » et non « niveau 4 sur 4 ».
2. Confirmer le seuil P2, la prise en compte par alerte, le plafond de notifications et les destinataires (responsable du
   produit, point ouvert 2).
3. **Ronde de l'assistant sur événement** quand une alerte critique s'ouvre (point 11).
4. Alerte sur une alerte **critique d'AlgoLightHouse sans CVE** (criticité de l'éditeur), si le RSSI le veut.
5. Synthèse périodique des alertes simples (au lieu du plafond), si le volume réel l'exige.
6. Visibilité dans « Mes rappels » pour une personne qui ne lit que le module Vulnérabilités (route des rappels).

## Addendum du 18/11/2026 — lot V6b : réglages des alertes

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). Aucune migration (le motif
de clôture `sous_le_seuil` existant est réutilisé, la clé du résumé tient dans `due_key`), aucun appel réseau, aucune dépendance
nouvelle, aucun rôle ni droit nouveau. Remplace, dans l'addendum « lot V6 », les choix « seuil de l'alerte simple : P2 »,
« prise en compte réservée à `vulnerabilites:modifier` » et « plafond de vingt alertes simples notifiées », et lève les points
ouverts 2 (seuil, prise en compte, plafond) et 5 (synthèse des alertes simples) de cet addendum ; les destinataires restent
inchangés (point ouvert 2, responsable du produit, toujours ouvert).

### Décisions du RSSI (18/11/2026)

| N° | Question | Décision |
| --- | --- | --- |
| A | Seuil des alertes | « P1 et P2 exploitable sur les asset qui sont exposé directement sur internet ». Alerte **critique** inchangée (faille présente en P1, fenêtre rouge). Alerte **simple** : seulement une faille en P2 à la fois **exploitable** au sens de la grille et présente sur un actif **exposé directement sur Internet** (présence « exposée » du lot ALH2). Une faille P2 présente seulement sur des machines internes n'ouvre plus d'alerte simple ; les alertes simples ouvertes qui ne satisfont plus la règle se closent d'elles-mêmes, sans migration de données. Rien pour P3 et P4 |
| B | Qui prend une alerte en compte | La prise en compte reste « une fois pour tous », tracée, mais réservée au **seul rôle « RSSI »** de la plateforme. Toute autre personne, même avec `vulnerabilites:modifier`, ne peut que masquer la fenêtre pour sa session |
| C | Notifications | Chaque alerte critique garde sa notification individuelle. Les alertes simples ouvertes au cours d'une même évaluation donnent **une seule** notification de résumé (« n nouvelles alertes », lien vers l'onglet « Alertes » filtré) ; le plafond de vingt disparaît ; aucune quand n vaut 0. Aucun nom de machine, de domaine, d'adresse ni de périmètre. Réglages par personne respectés ; le type « Vulnérabilités : alerte » devient celui du résumé |
| D | Points du lot ALH5 et suite | Liaison en masse : les deux modes (un pour un, tous vers une machine) sont **confirmés** (point ouvert 1 de l'addendum « lot ALH5 », interprétation de la décision C, levé pour les modes). Majoration de priorité : reste **limitée à la surface externe**, confirmé (point ouvert 2 de l'addendum « lot ALH5 » : pas de majoration de la CVE « globale » ni des failles de machine). Exception d'audit `picomatch` : réexamen le 25/11/2026 (consigné à l'ADR 0063, au CHANGELOG et dans `pnpm-workspace.yaml`). Prochain chantier décidé : **écrans du poste de commandement**. Le RSSI indique que l'interface web de l'éditeur AlgoLightHouse montre les ports ouverts : la limite « seuls les services portés par une alerte sont connus » (lot ALH6) tient au descriptif de l'API ; un nouveau relevé est attendu (point ouvert) |

### Réalisation

- **A — seuil** (`packages/shared/src/alertes-vulnerabilites.ts`) : `niveauAlerte` reçoit la priorité de la faille, un booléen
  `exploitable` et un booléen `exposee` : critique en P1 ; simple en P2 si exploitable **et** exposée ; sinon rien. La notion
  d'« exploitable » est celle de la grille (`SOURCES_EXPLOITABLE` de `priorite-vulnerabilites.ts` : `exploitAvailable` de
  Tenable, preuve de concept selon le CERT Santé, `has_poc` d'AlgoLightHouse), sans nouvelle notion. L'évaluation
  (`apps/api/src/vulnerabilites/alertes.ts`) tient, par faille, si au moins une de ses présences **non traitées** porte une
  source exploitable, et si elle a la présence « exposée » (version encore détectée d'une technologie ou alerte ouverte et
  présente de l'éditeur, comme au lot V6). Une alerte simple (ou critique redescendue en P2) qui ne satisfait plus la règle
  est **close** avec le motif existant `sous_le_seuil`, dont le libellé devient « Sous le seuil d'alerte : ni P1, ni P2
  exploitable sur un actif exposé directement sur Internet (priorité redescendue, ou faille non exploitable ou non
  exposée) ». Une clôture ne notifie personne. Un constat de Tenable sans CVE n'est jamais exposé : il n'ouvre plus d'alerte.
- **B — prise en compte** : rôle prédéfini `rssi` (`SYSTEM_ROLES`, nom « RSSI », `ROLE_PRISE_EN_COMPTE_ALERTE`), tenu
  directement ou par un groupe (`loadGrants`, lu à chaque appel), sans portée par modules qui écarterait `vulnerabilites`. La
  route `POST /api/vulnerabilites/alertes/{id}/prise-en-compte` garde `vulnerabilites:lire` comme garde de route (module actif,
  session, CSRF) ; le service répond **403** « Seul le RSSI peut prendre en compte une alerte. » à tout autre compte, avant
  toute lecture de l'alerte, y compris avec `vulnerabilites:modifier`, `vulnerabilites:administrer` ou le rôle
  **Administrateur**. `peutPrendreEnCompte` de la fenêtre et, nouveau, de la liste des alertes est calculé de même par le
  serveur ; la fenêtre et la fiche de l'onglet « Alertes » n'offrent « Pris en compte » qu'au RSSI ; toute autre personne a
  « Fermer pour cette session » et « Ouvrir la fiche ». La fenêtre, la fiche, l'en-tête de l'onglet et l'aide disent « Seul le
  RSSI peut prendre en compte une alerte ».
- **C — notifications** : une notification par alerte critique (création ou montée), clé `<alerte>:critique`, inchangée. Les
  alertes simples **créées** par l'évaluation donnent un seul résumé par personne, type `vulnerabilites_alerte`, clé
  `resume:<identifiant aléatoire de l'évaluation>`, titre « Vulnérabilités : n nouvelles alertes » (« 1 nouvelle alerte »),
  message sans CVE ni nom ; aucun résumé quand n vaut 0 ; plus aucune notification individuelle d'alerte simple. Chaque
  alerte du résumé est marquée notifiée. Lien du résumé, dans « Mes rappels » et dans le courriel :
  `/vulnerabilites/alertes?niveau=simple&etat=ouverte` ; l'onglet « Alertes » reprend ces filtres de l'adresse. Les
  réglages par groupe, rôle et personne s'appliquent par la diffusion existante. La mention « plafond atteint » de la fiche est
  retirée.

### Choix de réalisation, à confirmer par le RSSI

- **« Directement »** : seule la présence « exposée » (actif vu par AlgoLightHouse) compte ; une machine interne reliée à un
  actif exposé (lot ALH3) ne rend pas la faille exposée.
- **P2 et exploitable jugés sur la faille** (CVE), et non présence par présence : la faille est en P2 (la plus haute de ses
  présences, majoration du lot ALH5 comprise), elle est exposée, et une source dit qu'elle est exploitable sur l'une de ses
  présences non traitées. Exemple : un `exploitAvailable` de Tenable sur une machine interne rend exploitable la même CVE
  exposée sur Internet (le code d'exploitation vise la faille, pas la machine).
- **Motif de clôture** : `sous_le_seuil` réutilisé (libellé précisé) plutôt qu'un motif nouveau, pour éviter une migration.
- **Prise en compte des alertes simples** : réservée au RSSI aussi (même règle que les critiques).
- **Rôle tenu par un groupe** : vaut comme le rôle direct.
- **Montée d'une alerte simple en critique** : toujours notifiée individuellement (alerte critique) ; une alerte critique
  redescendue en P2 exploitable exposée reste ouverte en alerte simple, sans notification ni résumé.

### Point à trancher

- **Aucun compte RSSI** : le compte créé à l'installation n'a que le rôle « Administrateur », qui ne permet pas la prise en
  compte. Sur une plateforme sans compte qui tienne le rôle « RSSI », **aucune alerte ne peut être prise en compte** et la
  fenêtre rouge réapparaît à chaque connexion pour tous. Rien ne le contourne ; un administrateur attribue le rôle dans
  l'administration des accès (note de mise à jour du CHANGELOG).

### Non vérifié

Aucune donnée réelle (tests sur données fictives) ; volume réel des alertes simples et des résumés ; envoi réel d'un courriel ;
Docker et Node 26. Le parcours Playwright adapté (administrateur sans prise en compte, filtres repris du lien du résumé) n'a
pas été joué (CI seulement) ; sur une pile vierge, aucune alerte n'existe.

### Points ouverts (hors lot)

1. Nouveau relevé de l'API d'AlgoLightHouse : l'interface web de l'éditeur montre les ports ouverts ; l'API n'en documente pas
   la liste (lot ALH6). À relever pour lever la limite « seuls les services portés par une alerte sont connus ».
2. Écrans du poste de commandement (niveau d'alerte 1 à 4, radar) : prochain chantier.
3. Destinataires des notifications (responsable du produit, point ouvert 2 de l'addendum « lot V6 ») : inchangés.

## Addendum du 18/11/2026 — lot PC1 : « Vue d'ensemble », poste de commandement

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). **Aucune migration**,
aucun stockage nouveau, aucun appel réseau nouveau, aucune dépendance nouvelle. Réalise une partie du point 18 (radar et
niveau d'alerte) et de V8 et V9 ; lève le point ouvert 1 de l'addendum « lot V6 » et le point ouvert 2 de l'addendum
« lot V6b » pour l'écran d'accueil.

### Demande du RSSI

« Pour le design du module, je veux qu'il soit dans le même style que la page de maintenance / mise à jour. » ; « Le radar doit
avoir de vrais points basés sur les vulnérabilités remontées. Ça doit être l'idée d'un centre de commandement de l'armée. Une
supervision militaire. » (15/11/2026). Chantier décidé le 18/11/2026 (décision D de l'addendum « lot V6b ») ; maquette validée
`docs/unification/maquettes-vulnerabilites/01-vue.png`.

### Réalisation

- **Écran** `apps/web/src/vulnerabilites/VueEnsemble.tsx`, premier onglet du module (`/vulnerabilites/vue`) ; `/vulnerabilites`
  et le lien du menu y mènent désormais. Les autres onglets sont inchangés. Langage visuel de la page de mise à jour
  (`docker/maintenance` : étiquettes en capitales espacées, chiffres à chasse fixe, liseré de couleur, angles dissymétriques,
  écran cerné de crochets) porté sur les jetons de la charte dans `packages/ui/src/neon-commandement.css`, en clair et en
  sombre, sans style en ligne ni longueur en px ou rem (ADR 0006).
- **Niveau d'alerte** (`niveauAlerteGlobal`, `packages/shared/src/vue-ensemble-vulnerabilites.ts`, testé en table) : 4
  (Maximale), 3 (Alerte), 2 (Vigilance), 1 (Veille), avec une phrase d'explication et la règle écrite sous le niveau.
- **Tuiles** : exploitées et présentes (vers les alertes critiques), à traiter en P1 et en P2 (vers « Failles détectées »
  filtrée par priorité), produits à confirmer (vers le registre des produits), corrigées ce mois (vers « Failles détectées »
  filtrée sur « Corrigée »). « Failles détectées » reprend désormais ses filtres de l'adresse.
- **Radar « Situation tactique »** (SVG ; mise en page pure `apps/web/src/vulnerabilites/radar.ts`, testée) : chaque point est
  une faille suivie ; anneau = priorité (P1 au centre, anneaux nommés) ; secteur = famille du produit surveillé rapproché
  (rattaché, confirmé ou proposé), sinon « Non classé » (sept secteurs égaux, aucune nomenclature nouvelle) ; taille = machines
  et actifs exposés que la personne lit ; halo = exploitation avérée ; cercle vide = produit à confirmer. Emplacements fixes
  par case (secteur × anneau), séparés de deux rayons maximaux ; une faille prend l'emplacement désigné par une empreinte de sa
  clé (sonde linéaire), de la plus prioritaire à la moins prioritaire : même faille, même place tant que sa case ne change pas.
  Au-delà de la capacité d'une case (5 en P1, 14 en P2, 24 en P3, 20 en P4 par secteur), les plus prioritaires restent des
  points et les autres forment une **pastille chiffrée** (qui compte aussi les failles non rendues par la route) ; un clic
  filtre le tableau sur la case. Six étiquettes au plus, en marge du disque, reliées au point, sans chevauchement entre elles
  ni avec les noms des secteurs. Balayage tournant décoratif. Clavier : un seul arrêt de tabulation, flèches, Début, Fin,
  Entrée ; chaque point a un nom lisible (priorité, CVE, titre, secteur, faits, nombres lisibles, EPSS).
- **Clic sur un point ou une ligne** : fiche existante du constat de Tenable ou de la faille déclarée si la personne lit au moins
  une machine touchée ; sinon la veille, cherchée sur la CVE (`?q=`) ; un constat sans CVE illisible montre un court résumé.
- **Cible prioritaire** (la première faille dans l'ordre commun), **journal** (dernières collectes de la veille,
  synchronisations de Tenable et d'AlgoLightHouse, alertes ouvertes et closes, sans texte d'erreur), tableau **« Cibles par
  priorité »** (mêmes failles que le radar, filtres « Toutes / Exploitées / Détectées / À confirmer », responsable du produit
  lu dans le registre, « Tout voir »), **capteurs** (sources de veille et connecteurs en deux listes, état et dernière collecte
  réussie, lus par les routes existantes) et **bandeau** quand une alerte critique est en cours (liste des alertes du lot V6 ;
  le rappel discret du lot V6 n'est plus affiché sur cet écran).
- **Route** `GET /api/vulnerabilites/vue-ensemble` (`vulnerabilites:lire`, `apps/api/src/vulnerabilites/vue-ensemble.ts`) :
  lecture seule, aucune entrée de journal. Elle réutilise le calcul de l'évaluation des alertes
  (`AlertesVulnerabilites.situationGlobale`, faits sur tous les faits connus, majoration du lot ALH5 comprise), complété par
  les rapprochements proposés, sans effet sur les alertes. **Nombre de requêtes fixe**, aucune par faille : 18 au plus
  (propositions 1 ; réglage 1, constats 1, failles déclarées 1, expositions 2, majoration 4 au plus, faits des sources 3,
  titres 1 ; corrigées 1 ; machines lisibles 1 ; actifs lisibles 2 ; journal 1). **Bornes** : 40 failles rendues par case
  secteur × priorité (1 120 au plus), totaux de chaque case toujours rendus ; 12 entrées de journal.
- **Mesure** (PostgreSQL de test local, données fictives : 150 machines, 2 000 constats, 10 000 CVE, 16 000 détections) :
  environ 1,1 s par lecture, 80 à 90 Kio de réponse, pour un administrateur comme pour un lecteur ; l'écran se relit toutes les
  minutes.

### Règle du niveau d'alerte, à confirmer par le RSSI

4 (Maximale) : au moins une faille au seuil d'alerte critique, c'est-à-dire présente en P1 ; 3 (Alerte) : sinon, au moins une
faille au seuil d'alerte simple (P2 exploitable sur un actif exposé directement sur Internet, V6b) ; 2 (Vigilance) : sinon, au
moins une faille présente en P2, ou une faille à exploitation avérée dont le produit reste à confirmer ; 1 (Veille) : sinon.

### Choix de réalisation, à confirmer par le RSSI

- **Niveau calculé sur les faits du moment**, par les mêmes règles que les alertes (`niveauAlerte`), et non sur les alertes
  rangées : il ne dépend ni d'une évaluation en retard ni d'une prise en compte. Une alerte prise en compte laisse donc le
  niveau à 4 tant que la faille est présente en P1.
- **Faille suivie** : une CVE (ou un constat de Tenable sans CVE) qui a au moins une présence non traitée, ou un rapprochement
  proposé ; une faille dont tous les objets suivis sont corrigés, en risque accepté ou non concernés n'apparaît plus.
- **Ordre commun** des failles (`comparerCibles`) : priorité, exploitation avérée, présence avant « à confirmer », exploitable,
  gravité, score EPSS, clé ; aucun nombre lié aux droits n'y entre.
- **Nombres globaux de failles** (niveau, tuiles, secteurs, cases, « corrigées ce mois ») : les mêmes pour tout le monde,
  comme la priorité (lot ALH5) ; seuls les nombres de machines et d'actifs sont limités à ce que la personne lit, avec un
  drapeau sans nombre pour le reste. Les titres des failles suivent la règle des alertes (catalogue KEV, sinon nom du contrôle
  de Tenable, sinon produit déclaré).
- **« À traiter (P1 et P2) »** compte les failles présentes et celles à confirmer ; **« Produits à confirmer »** compte les failles
  dont un rapprochement est proposé, avec le nombre de produits ; **« Corrigées ce mois »** compte les objets suivis passés à
  « Corrigée » depuis le premier jour du mois (Europe/Paris) et encore dans cet état.
- **État** d'une faille dans le tableau : le moins avancé de ses objets suivis encore ouverts.
- **Responsable** : celui du produit surveillé rapproché (le premier par identifiant s'il y en a plusieurs).
- **Ordre clavier du radar** : par priorité, puis par secteur ; un seul arrêt de tabulation (navigation par flèches).

### Écarts à la maquette

- **Deux colonnes au lieu de trois** sur grand écran : niveau, tuiles et cible prioritaire à gauche ; radar, journal et
  secteurs à droite. Dans la mise en page de l'application (menu latéral), la colonne centrale de la maquette laissait au radar
  moins de 500 px : textes illisibles. Une colonne en dessous de 1 200 px environ ; sur téléphone, le radar garde une largeur
  lisible et défile dans son cadre.
- **Sept secteurs** au lieu de six : « Non classé » s'ajoute aux six familles. Sur un parc lu surtout par Tenable, la plupart
  des failles n'ont pas de produit rapproché et tombent dans ce secteur, regroupées en pastilles.
- **Étiquettes en marge** du disque, reliées par un trait, au lieu d'être posées près du point : près du centre, elles
  couvraient les autres points ; elles disent « n lisibles · EPSS x » (nombres lisibles seulement).
- **Pastilles chiffrées** de regroupement : absentes de la maquette (23 failles), nécessaires à 10 000.
- **Graduations sans chiffres de cap** (030, 060…), décoratives et sans sens ; pas d'heure de la maquette mais « calculée le ».
- Titre de page « Vue d'ensemble » (onglet) au lieu de « Surveillance des vulnérabilités » ; pas de barre de recherche commune
  (point 15, non réalisé) ; pas de cran clignotant (la maquette fait clignoter le dernier cran : ici, seul le cran atteint
  pulse doucement, sans texte clignotant, coupé par le mouvement réduit).
- Capteurs : sources de veille et connecteurs en **deux listes** (décision du RSSI), libellés des sources ceux de l'écran
  « Veille ».
- Journal : pas de prévision « nouvel essai à 07:06 », pas de comptage « 1 ajout » par source (non rangés tels quels).

### Non vérifié

Aucune donnée réelle. Rendu vu sur un **banc local** (Vite, données fictives : 320 failles sur les quatre priorités, 45 % sans
produit rapproché ; Chromium, clair et sombre, 1440, 1024 et 390 px ; axe `wcag2a`/`wcag2aa` sans violation ; aucun
chevauchement de texte dans le radar ; aucun débordement de page ; clavier et pastille essayés), pas dans la pile complète ;
la CSP n'a pas été vérifiée sur le banc (serveur de développement), seulement par les tests de l'interface (aucun attribut
`style` sur le balisage propre à l'écran) ; le parcours Playwright n'a pas été joué (CI seulement) et ne voit qu'un radar vide
(aucune faille sur une pile vierge). Durée sur un parc réel et sous l'agent de charge du RSSI ; Docker et Node 26.

### Points ouverts (hors lot)

1. **Confirmer la règle du niveau d'alerte** et les choix ci-dessus.
2. **Vue « par machine »** avec icônes de PC et frontières de rôles (point 16, maquettes 04 et 04b).
3. **Vue par périmètre** front / back / base (point 17, maquette 05).
4. **Fiche de faille illustrée** : vecteur d'attaque traduit avec icônes et schéma (point 19, maquette 02).
5. **Marques zero-day** sur les machines et les failles (point 16, V16 ; définition du zero-day, point ouvert 11).
6. Barre de recherche commune au module (point 15).
7. Durée de la lecture sur un très grand parc : le calcul global est refait à chaque lecture (environ 1 s pour 10 000 CVE) ;
   le garder en mémoire entre deux évaluations si l'agent de charge le montre nécessaire.

## Addendum du 18/11/2026 — lot PC2 : écran « Machines », présentation « Parc »

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). **Aucune migration**,
aucun appel réseau nouveau, aucune dépendance nouvelle, rien de nouveau chez l'assistant. Réalise la vue « par machine » du
point 16 et de V11, la part « front, back, base » de V12 pour l'écran « Machines » et les marques de V16 ; lève les points
ouverts 2 et 5 de l'addendum « lot PC1 » (sous réserve de la définition du zero-day ci-dessous).

### Demandes du RSSI (15 et 16/11/2026)

« Une vue par machine pour voir le nombre de failles (critique etc). L'assistant classe par machine plus critique. Une vue où
j'indique les serveurs front, bdd, back applicative. » ; « Pour la vue machine, j'imagine plus des vraies icônes de pc plutôt
que des lignes et séparation. » ; « Il faut prévoir en grand écran pour en voir plus. En réduit, si trop de machines, pour
afficher les plus critiques/prioritaires. Il manque aussi cette séparation front du back. » ; « Les barres en diagonale des
barres de séparation rouge et violet doivent être animées. » ; « Faille zero day : un petit warning sur la machine. Une icône
spéciale sur les vulnérabilités exploitables aussi. » Maquettes validées `04-machines.png` et `04b-machines-grand-ecran.png`.

### Réalisation

- **Écran « Machines »** (`apps/web/src/vulnerabilites/Machines.tsx`) : bascule « Liste » (l'existant) ou « Parc »
  (`ParcMachines.tsx`), mémorisée dans les **préférences de la personne** (`Preferences.vulnerabilitesMachines`, déjà rangées
  en base avec le compte, aucune colonne nouvelle), ainsi que l'échelle du parc. Filtres conservés (nom, rôle, périmètre) ;
  l'affectation du rôle et du périmètre reste dans la liste (cases à cocher).
- **Tuile** : bouton, une par machine lisible ; icône d'ordinateur selon le **rôle** (poste avec un globe pour le front,
  serveur en baie pour le back applicatif, cylindre pour la base de données, poste avec un point d'interrogation sans rôle :
  seule la donnée de rôle permet de choisir l'icône, Tenable ne dit pas « serveur » ou « poste ») ; nom ; **rang** (numéro) ;
  failles présentes **critiques, élevées, moyennes, faibles** (compteurs existants) ; **priorité la plus haute** en couleur et
  en texte (P1 à P4, « Aucune » sans faille présente). Nom accessible complet, par exemple « srv-web-03 : rang 3 sur 150, front,
  2 critiques, priorité P1, zero-day, exploitation avérée » ; clic ou Entrée : fiche existante de la machine.
- **Zones** « Front », « Back applicatif », « Base de données » côte à côte, puis « Rôle non indiqué » en dessous ; dans chaque
  zone, l'ordre du rang (la plus critique d'abord). **Murs** entre les zones, d'après la maquette : rouge entre le front et le
  back, violet entre le back et les bases ; bandes diagonales qui défilent (une période par seconde, 1,6 s pour le violet),
  coupées par `prefers-reduced-motion: reduce` et à l'impression ; nom de la frontière lisible. Parc étroit (requête de
  conteneur) : zones empilées, murs horizontaux.
- **Marques** (tuiles, colonne « Priorité et marques » de la liste, légende) : triangle **« Zero-day : exploitation avérée »**
  quand la machine porte une faille **présente** (constat de Tenable présent ou faille déclarée, non traités) **dont
  l'exploitation est avérée** (catalogue KEV, alerte du CERT-FR, fiche du CERT Santé, AlgoLightHouse) : c'est la définition
  du lot V6, c'est-à-dire une faille P1 de la grille ; éclair **« Exploitable »** quand elle porte une faille présente pour
  laquelle une source dit qu'un code d'exploitation existe (`SOURCES_EXPLOITABLE` de la grille : Tenable, preuve de concept du
  CERT Santé, AlgoLightHouse) **sans exploitation avérée**. La marque zero-day concorde avec le compteur existant
  `exploitationAveree` (test d'API).
- **Échelle** : « Réduit » par défaut (les 5 plus prioritaires de chaque zone, 8 pour « Rôle non indiqué », puis une tuile « et
  n autres : tout montrer » qui déplie la zone et devient « Replier ») ; « Grand écran » : toutes les machines reçues, tuiles
  denses, zones de rôle élargies selon leur nombre de tuiles (classe de poids 1 à 4, sans style en ligne). Au-delà de la borne
  de la route, une tuile « et n autres : voir la liste » ouvre la liste filtrée sur ce rôle.
- **Route** `GET /api/vulnerabilites/machines/parc` (`vulnerabilites:lire`, filtres `q`, `role`, `perimetre`), lecture seule,
  aucune entrée de journal : quatre zones toujours rendues, chacune avec son total, son nombre de machines « zero-day » et au
  plus **250 machines** (les plus prioritaires) ; `tronquee` signale une zone bornée. **Nombre de requêtes fixe**, aucune par
  machine : machines lisibles et leurs compteurs 2, réglage 1, failles présentes des machines 9 (constats 1, failles déclarées
  1, CVE des constats 1, faits des sources 3 + 3) ; **12 au plus**, quel que soit le parc. Le calcul des failles présentes par
  machine (`faillesDesMachines`, `apps/api/src/vulnerabilites/failles.ts`) est celui qui servait déjà à la majoration du lot
  ALH5 (`machinesVulnerables` l'appelle désormais, mêmes requêtes). `GET /api/vulnerabilites/machines` rend aussi les marques
  des machines de la page (mêmes 9 requêtes, sur 25 machines).
- **Droits** : seules les machines que la personne lit sont listées ou comptées (périmètre effectif du lot V4d) ; aucun total,
  nom ni adresse d'une machine illisible, pas même un drapeau ; priorité et marques calculées sur tous les faits connus, les
  mêmes pour tout le monde (lot ALH5), sans majoration par la surface externe ; rang inchangé (parmi les machines lisibles,
  comme la liste).
- **Assistant** : rien de branché. Le rang affiché est celui de la plateforme (point 16), déjà remis à l'assistant par
  `machines_prioritaires` sous forme de repères.
- Fonctions pures `repartirParc`, `visiblesZone`, `marquesMachine` (`packages/shared/src/parc-machines.ts`) et `urlParc`,
  `nomAccessibleMachine`, `poidsZones` (`apps/web/src/vulnerabilites/parc.ts`), testées ; feuille
  `packages/ui/src/neon-parc.css` (jetons de la charte, clair et sombre, aucune longueur en px ni en rem).

### Définition du marqueur zero-day, à confirmer par le RSSI

Le marqueur dit « exploitation avérée » d'une faille **présente** sur la machine, comme l'alerte critique du lot V6 (point
ouvert 11, réponse proposée appliquée). Il ne distingue pas les failles **sans correctif publié** : si le RSSI réserve
« zero-day » à celles-là, il faudra une source qui le dise (mention « Un correctif existe : Non » du CERT Santé, date de
correctif de Tenable), à trancher.

### Choix de réalisation, à confirmer par le RSSI

- **Présentation par défaut : « Liste »** (l'existant), « Parc » sur choix de la personne, mémorisé ; échelle « Réduit » par
  défaut.
- **Nombres du mode réduit** : 5 par zone de rôle, 8 pour « Rôle non indiqué » (comme la maquette) ; **borne de la route** :
  250 par zone.
- **Exploitable** : seulement pour une faille sans exploitation avérée (point 16 : « sans exploitation observée ») ; une
  machine peut porter les deux marques si deux failles différentes les justifient.
- **Priorité de la machine** : la plus haute de ses failles présentes non traitées (constats et failles déclarées), sans la
  majoration par la surface externe (lot ALH5 : jamais appliquée aux failles des machines).
- **Affectation** : seulement en présentation « Liste » ; la tuile ouvre la fiche, sans case à cocher.
- **Zone « Rôle non indiqué »** : nom demandé par la consigne, au lieu de « Machines sans rôle » de la maquette.

### Écarts à la maquette

- **Murs** : la maquette en compte deux (rouge front · back, violet back · bases) ; ils sont repris tels quels. La consigne
  du lot parlait d'un mur rouge « entre Internet et le front » et d'un mur violet « entre le front et le back » : la maquette a
  été suivie, à trancher si un mur de plus est voulu devant le front.
- **Pas de bandeau de l'assistant** (« Lecture de l'assistant · classement des machines », « Proposer les actions ») : rien
  n'est branché chez l'assistant dans ce lot.
- **Pas de bascule « Par faille / Par machine »** dans l'écran (elle reste dans « Failles détectées ») ni de puces « Exploitées
  seulement », « Avec critique » : les filtres existants (nom, rôle, périmètre) sont conservés tels quels.
- **Pas de nom d'application** sous le nom de la machine (« Portail patient ») : la donnée n'existe pas ; pas de choix
  « Front / Back / BDD » sur les tuiles sans rôle (l'affectation se fait dans la liste).
- **Quatre chiffres de gravité** sur chaque tuile (la maquette n'en montre que deux), le zéro grisé, et un libellé de priorité
  P1 à P4 (absent de la maquette, exigé : jamais la couleur seule).
- **Marque zero-day sans clignotement** : une lueur douce, coupée par le mouvement réduit (la maquette fait clignoter le
  triangle).
- **« Grand écran »** : tout le parc en tuiles denses sur toute la largeur de la zone de contenu, menu latéral compris ; pas de
  plein écran du navigateur (la fiche d'une machine, fenêtre posée sur la page, n'y serait plus visible). À 1 440 px avec le
  menu, trois à quatre tuiles par ligne et par zone, contre neuf dans la maquette `04b` (relevée à 2 560 px sans menu).
- Titre de zone « 1re ligne · exposée », « 2e ligne », « 3e ligne », « À classer » repris ; en-tête de zone : nombre de
  machines lisibles et nombre « avec une exploitation avérée » (au lieu de « n critiques »).

### Non vérifié

Aucune donnée réelle. Rendu vu sur un **banc local** (Vite, composants de l'écran avec 150 machines fictives : 38 front, 66
back, 34 bases, 12 sans rôle ; Chromium, clair et sombre, 1 440 et 390 px, plus 768, 1 024 et 2 560 px ; réduit, grand écran
et liste ; axe `wcag2a`/`wcag2aa` sans violation ; aucun chevauchement de texte ni débordement de page ; clavier, fiche,
« et n autres » et animation des murs essayés, animation coupée sous mouvement réduit), pas dans la pile complète ; la CSP n'a
pas été vérifiée sur le banc, seulement par les tests de l'interface (aucun attribut `style` sur le balisage propre à
l'écran). Le parcours Playwright adapté n'a pas été joué (CI seulement) et ne voit qu'un parc vide. Durée de la route sur un
parc réel (12 requêtes, toutes les machines lisibles et leurs failles présentes en mémoire) ; Docker et Node 26.

### Points ouverts (hors lot)

1. **Définition du zero-day** (ci-dessus) et mur supplémentaire devant le front.
2. **Vue par périmètre** front / back / base (point 17, maquette 05).
3. **Fiche de faille illustrée** : vecteur d'attaque traduit avec icônes et schéma (point 19, maquette 02).
4. **Liens front → back → base entre machines** : aucune source ne les fournit (point ouvert 5).
5. Bandeau de l'assistant sur l'écran (classement commenté et « Proposer les actions »), si le RSSI le veut.
6. Marques zero-day et exploitable sur les **failles** elles-mêmes (listes « Failles détectées », radar) : seules les machines
   les portent dans ce lot.

## Addendum du 18/11/2026 — lot PC3 : onglet « Périmètres »

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). **Aucune migration**,
aucun stockage nouveau, aucun appel réseau nouveau, aucune dépendance nouvelle, rien de nouveau chez l'assistant. Réalise le
point 17 et la part « par périmètre » de V12 ; lève le point ouvert 3 de l'addendum « lot PC1 » et le point ouvert 2 de
l'addendum « lot PC2 ».

### Demande du RSSI (15/11/2026)

« Et par périmètre une vue où sur un périmètre on voit les machines au global ou […] en front reliées, séparées à celles en
back. » Maquette validée `05-perimetre.png`.

### Réalisation

- **Onglet** « Périmètres » du module, après « Machines » (`/vulnerabilites/perimetres`, `apps/web/src/vulnerabilites/Perimetres.tsx`).
- **Liste** : une carte par périmètre que la personne lit (bouton, nom accessible complet) : nom, machines lues, priorité la plus
  haute de leurs failles présentes (couleur et texte P1 à P4, « Aucune »), failles présentes critiques, élevées, moyennes et
  faibles, machines marquées « zero-day » et « exploitable » (marques du lot PC2, avec leur nombre), actifs exposés sur Internet
  rattachés (actifs présents dont le périmètre AlgoLightHouse est relié au périmètre). Tri du plus critique au moins critique
  (`comparerPerimetres`, paquet partagé) : priorité, machines zero-day, failles critiques, machines exploitables, failles
  élevées, moyennes, faibles, actifs exposés, machines, puis nom. Carte **« Sans périmètre »** pour qui a
  `vulnerabilites:administrer` seulement (machines sans périmètre effectif, actifs d'un périmètre AlgoLightHouse non relié).
- **Détail** (clic ou Entrée, adresse partageable `?perimetre=<id>|aucun`, `&presentation=global`) : chiffres clés (machines,
  failles critiques, machines avec exploitation avérée, machines sans rôle, actifs exposés rattachés), bandeau quand des machines
  de première ligne portent une faille à exploitation avérée, puis **« Par ligne »** (composant `ParcMachines` du lot PC2 : zones
  front, back applicatif, base de données, rôle non indiqué, murs animés, mode réduit et « et n autres ») ou **« Vue globale »**
  (toutes les machines ensemble dans l'ordre du rang, 24 d'abord puis « et n autres »). Mêmes tuiles, marques, fiche au clic.
- **Exposition** (lot ALH3) : une machine reliée par une liaison **confirmée** à un actif exposé que la personne lit porte la
  mention « Exposée sur Internet » (texte et globe, détail dans le nom accessible) ; la liste sous le parc donne les actifs (trois
  au plus par machine, puis le nombre des autres actifs **lisibles**). Rien d'un actif illisible : ni nom, ni nombre, ni drapeau ;
  une proposition non confirmée n'apparaît pas.
- **Aucun trait entre machines** : le lien front → back → base de machine à machine n'existe pas en données (point ouvert 5) ;
  l'écran et l'aide le disent. Les murs séparent les rôles indiqués, comme au lot PC2.
- **Routes** (`vulnerabilites:lire`, `apps/api/src/vulnerabilites/perimetres.ts`), lecture seule, aucune entrée de journal :
  `GET /api/vulnerabilites/machines/perimetres` (cartes) et `GET /api/vulnerabilites/machines/perimetres/{id|aucun}` (carte, parc
  du lot PC2 restreint au périmètre, expositions). `/api/vulnerabilites/perimetres` étant déjà pris (périmètres où l'on peut
  écrire), les routes sont sœurs de celle du parc. **Nombre de requêtes fixe**, aucune par périmètre ni par machine : liste 16 au
  plus (périmètres 1, machines lisibles et compteurs 2, réglage 1, marques 9, failles par périmètre 2, actifs 1), détail 17 au
  plus (périmètre 1, mêmes calculs restreints, liaisons 1) ; mesuré sur PostgreSQL de test : 13 pour la liste, 10 à 14 pour un
  détail (test d'API qui compte les requêtes). **Bornes** : 250 machines par ligne dans le détail (`PARC_PAR_ZONE`, totaux exacts,
  « et n autres : voir la liste » vers l'écran « Machines » filtré par l'adresse) ; trois actifs nommés par machine ; liste des
  périmètres non bornée (taille du référentiel lu).
- **Droits** : périmètres visibles de la pyramide (`grc_smsi_visible`) ; machines par leur périmètre effectif (lot V4d) ; actifs
  par leur périmètre AlgoLightHouse relié. Un périmètre illisible est absent de la liste et répond comme un inconnu (404, même
  message) ; « aucun » sans `administrer` aussi. Qui lit un périmètre lit toutes ses machines : deux personnes qui le lisent en
  voient la même carte ; priorité et marques sur tous les faits connus (lot ALH5). Aucun total de ce qui est illisible.
- **Liens croisés** : dans la liste de l'écran « Machines », le nom du périmètre ouvre son détail ; en présentation « Parc »
  filtrée sur un périmètre, un lien mène à son détail ; l'écran « Machines » lit ses filtres `perimetre` et `role` dans l'adresse.
  La vue d'ensemble (lot PC1) n'affiche aucun nom de périmètre : rien n'y est ajouté.
- **Assistant** : rien de branché ; aucun nom de périmètre ne lui est remis.

### Choix de réalisation, à confirmer par le RSSI

- **Failles d'un périmètre** : chaque constat de Tenable compté une fois par périmètre (gravité de Tenable), chaque CVE déclarée
  une fois (gravité la plus sévère entre NVD et le CERT Santé), mêmes règles de présence et de traitement que les compteurs d'une
  machine ; une CVE déclarée sur une machine et détectée par un constat sur une autre machine du même périmètre compte deux fois.
- **Périmètres listés** : ceux de l'organisation que la personne lit, même vides (« 0 machine lue »), et tout autre périmètre lu
  (entité fournisseur) seulement s'il porte une machine ou un actif exposé. Machines rangées par leur périmètre effectif exact,
  sans cumul dans un périmètre parent.
- **Présentation par défaut « Par ligne »** (comme la maquette), non mémorisée dans les préférences : elle est dans l'adresse.
- **Rang** affiché : celui de la plateforme parmi toutes les machines que la personne lit (comme la liste et le parc), pas un
  rang propre au périmètre.
- **Exposition** : aucune trace d'une liaison vers un actif illisible (plus strict que la fiche d'une machine du lot ALH3, qui
  la signale par un drapeau sans nombre).

### Écarts à la maquette

- **Liste de cartes** en plus de la maquette (qui montre seulement le détail, avec des puces de choix du périmètre en tête) :
  pas de puces ; un lien « Tous les périmètres » ramène à la liste.
- **Pas de bloc « Extérieur »** ni de **flèches entre les lignes** : les murs du lot PC2 séparent les lignes ; le mur
  « Internet → front » reste hors lot.
- **Bandeau** : « n machines de première ligne portent une faille dont l'exploitation est avérée », sans « reliées à deux
  serveurs applicatifs » (aucune donnée) ni « Ouvrir la faille » (plusieurs failles possibles ; la fiche de chaque machine les
  donne).
- **Tuiles** du parc (icône, rang, quatre gravités, priorité en texte) au lieu des lignes de la maquette ; pas de « PHP exploitée »
  sous le nom (nom de faille non porté par la tuile).
- **Cinq chiffres clés** au lieu de quatre (« Actifs exposés rattachés » ajouté) ; zone « Rôle non indiqué » toujours affichée.
- Pas de barre de recherche commune (point 15, non réalisé).

### Non vérifié

Aucune donnée réelle. Rendu vu sur un **banc local** (application réelle sous Vite, API simulée par Playwright, données
fictives : 8 périmètres, 150 machines, 10 sans périmètre, actifs exposés reliés à deux machines ; Chromium, clair et sombre,
1 440 et 390 px ; liste, détail par ligne, vue globale, « Sans périmètre » ; axe `wcag2a`/`wcag2aa` sans violation, aucun
chevauchement de texte, aucun débordement de page ; Entrée sur une carte et clic sur une tuile essayés), pas dans la pile
complète ; la CSP n'a pas été vérifiée sur le banc (serveur de développement), seulement par les tests de l'interface (aucun
attribut `style` sur le balisage propre à l'écran). Le parcours Playwright ajouté n'a pas été joué (CI seulement) et ne voit que
la carte « Sans périmètre » vide d'une pile vierge. Durée des routes sur un parc réel ; Docker et Node 26.

### Points ouverts (hors lot)

1. **Liens entre machines** (front → back → base) : aucune source ne les fournit ; saisie à la main ou autre source, à trancher
   (point ouvert 5).
2. **Mur « Internet → front »** devant la première ligne (addendum « lot PC2 », point ouvert 1).
3. **Fiche de faille illustrée** (point 19, maquette 02).
4. Confirmer les choix ci-dessus (décompte des failles d'un périmètre, périmètres vides listés, présentation par défaut).
5. Puces de choix du périmètre dans le détail, si le RSSI les veut.

## Addendum du 18/11/2026 — lot PC4 : fiche de faille illustrée

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). **Aucune migration**,
aucun stockage nouveau, aucun appel réseau nouveau, aucune liste blanche élargie, aucune dépendance nouvelle, aucun appel au
modèle. Réalise V10 et le point 19 ; lève le point ouvert 4 de l'addendum « lot PC1 », le point ouvert 3 de l'addendum « lot
PC2 » (fiche illustrée) et le point ouvert 3 de l'addendum « lot PC3 ».

### Demande du RSSI (15/11/2026)

« Possible d'ajouter la recommandation, la traduction du vecteur d'attaque avec des icônes, un schéma qui le représente. »
Maquette validée `docs/unification/maquettes-vulnerabilites/02-fiche.png`.

### Source du vecteur

Le vecteur CVSS est **déjà rangé** : NVD, v3.1 et v4.0 par CVE (`cvss31_vecteur`, `cvss40_vecteur` de
`vulnerabilites_veille_cve`, lot V2), et Tenable, vecteur v3 du contrôle (`cvss3_vecteur` de `vulnerabilites_constats`, lot V5,
souvent sans préfixe « CVSS:3.x/ »). AlgoLightHouse ne range aucun vecteur (score seulement) : il n'en apporte pas ; aucun champ
n'a été ajouté. Le CERT Santé ne range qu'un score. **Règle des sources** (V27, lot V4c) appliquée au vecteur : parmi les
vecteurs lisibles, celui dont le score publié est le plus sévère parle ; à score égal (ou sans score), NVD avant Tenable et, chez
NVD, la v4.0 avant la v3.1. La fiche dit laquelle parle (« Vecteur retenu : NVD (CVE-…), CVSS v3.1, score 9,8 : le plus sévère
des vecteurs publiés ») et montre les autres en petit.

### Réalisation

- **Paquet partagé** (`packages/shared/src/fiche-faille-vulnerabilites.ts`, testé en table) : `decoderVecteurCvss` (v3.0, v3.1,
  v3 sans préfixe, v4.0 ; toute métrique inconnue, en double, de valeur inconnue, ou métrique de base absente : `null`, jamais
  une traduction devinée ; métriques temporelles, de menace, environnementales et supplémentaires admises mais non traduites),
  `conditionsTraduites` et `impactsTraduits` (terme exact en français, traduction, icône et force pour l'attaquant par
  métrique), `phraseVecteur`, `vecteurRetenu`, `libelleSourceVecteur`, `schemaVecteur` (étapes et nom accessible),
  `marquesFaille`, `libellePresence`, `libelleVersionsNvd`, DTO `FicheFailleDto` et paramètres de route.
- **Route** `GET /api/vulnerabilites/fiches/{nature}/{id}` (`vulnerabilites:lire`, `apps/api/src/vulnerabilites/fiches.ts`),
  natures `constat`, `declaree`, `cve`, `alerte-alh` : lecture seule, aucune entrée de journal, nombre de lectures fixe. Le
  constat, la faille déclarée et l'alerte se lisent par leur fiche existante (404, même message, pour l'illisible et l'inconnu) ;
  une CVE de la veille avec `lire` (404 si la plateforme ne la connaît pas). Rend : CVE (cinq) et leur nombre, composant
  (produit du catalogue KEV, sinon de NVD, sinon nom du contrôle de Tenable ou du produit déclaré, ou produit du service de
  l'alerte), priorité et faits, marques, alerte ouverte de la plateforme (la plus haute), présence lue, vecteurs publiés (six
  au plus), recommandations par source.
- **Recommandations**, chaque source à part, telles quelles et bornées : correctif du contrôle de Tenable (anglais, V19) ;
  action exigée et échéance du catalogue KEV (cinq) ; versions touchées selon NVD (bornes publiées, huit) ; mentions « un
  correctif existe » et « une mesure de contournement existe » du CERT Santé ; alertes et avis du CERT-FR et du CERT Santé qui
  citent la faille, avec le lien vers la source (six) ; défauts et résolutions de l'éditeur d'AlgoLightHouse (ceux de l'alerte
  ouverte, ou ceux des trois alertes ouvertes, présentes et **lisibles** qui citent la faille). Rien de connu : « Aucune
  recommandation connue […]. La plateforme n'en invente aucune. »
- **Présence** : machines lisibles touchées (constat : ses machines ; faille déclarée : machines reliées ; CVE : détections
  présentes et machines reliées à un produit rattaché) et actifs exposés lisibles qui portent la CVE ; drapeau sans nombre
  `horsLecture` pour le reste (lot ALH5). Alerte d'AlgoLightHouse : l'actif visé, sans machine.
- **Interface** (`apps/web/src/vulnerabilites/FicheFaille.tsx`, `fiche-faille.ts`) : composant unique `FicheFaille`, placé en tête
  des fenêtres existantes (« Failles détectées » et « Vue d'ensemble » : constat et faille déclarée ; « Surface externe » :
  alerte, onglets « Alertes » et « Carte ») et d'une fenêtre nouvelle de l'écran « Veille », ouverte par la CVE (recherche et
  catalogue KEV). Les blocs que la fiche illustrée reprend sont retirés des fiches existantes pour ne pas les dire deux fois :
  priorité (constat, faille déclarée), correctif de Tenable, action exigée du catalogue KEV, recommandations de l'éditeur
  d'AlgoLightHouse ; le vecteur brut reste dans les scores de Tenable. Schéma SVG en deux mises en page (quatre colonnes en
  large, empilé sous 46 em de conteneur), `role="img"` et nom accessible en une phrase, équivalent texte en liste numérotée
  dessous ; libellé texte sur chaque étape et chaque rangée, teinte en double. Feuille `packages/ui/src/neon-fiche.css`
  (jetons de la charte, clair et sombre, ni px ni rem, aucun style en ligne).

### Écarts à la maquette

- **Pas de radar « Position de la cible »** dans la fiche (il est dans la vue d'ensemble, lot PC1), ni de colonne « État,
  secteur, produit surveillé, responsable, action liée » : l'état de suivi et les actions restent dans la rubrique de suivi
  existante, sous la fiche.
- **Pas de bloc « Proposition de l'assistant »** ni de **« parcours de la faille »** horodaté (publiée, exploitation avérée,
  détectée, action décidée, corrigée) : hors lot (plan d'action de l'assistant) ou données dispersées entre sources et suivi.
- **Pas de tuiles « Machines touchées » et « Jours depuis l'alerte »** : la présence lue est une phrase de l'en-tête et du
  schéma ; aucun total global.
- **« Ce qu'il lui faut »** : les métriques du vecteur seulement (AV, AC, AT en v4.0, PR, UI, S en v3) ; l'exploitation observée
  et l'EPSS, que la maquette y mettait, sont dans les faits de la priorité de l'en-tête (ils ne sont pas dans le vecteur).
- **Schéma SVG distinct** des cartes de métriques (la maquette n'a qu'un chemin en HTML) : la consigne demande un schéma
  composé, nommé et doublé d'un texte ; il porte aussi la présence lue.
- **Effets sur les systèmes en aval** (v4.0) ajoutés ; termes exacts sous chaque traduction ; vecteur brut et version en tête.
- Recommandations en grille de largeur libre (une à trois par ligne selon la place) ; titre « Recommandations des sources »
  et mention « rien n'est rédigé par la plateforme ni par l'assistant ».

### Choix de réalisation, à confirmer par le RSSI

- **Vecteur de Tenable sans préfixe** lu comme un vecteur CVSS v3, « version mineure non précisée par la source » (les métriques
  de base de la v3.0 et de la v3.1 sont les mêmes) ; un vecteur v2 est illisible.
- **Règle du vecteur retenu** ci-dessus (score le plus sévère, puis NVD, puis v4.0) ; pour un constat à plusieurs CVE, les
  vecteurs de NVD des CVE au score le plus haut, deux cents CVE lues au plus.
- **Marques** de la fiche : celles du lot PC2 appliquées à la faille : « zero-day » si elle est présente et que son exploitation
  est avérée, « exploitable » si elle est présente, exploitable et non exploitée ; une CVE de la veille seulement connue n'en a
  aucune. Présence d'une CVE de la veille sans tenir compte des états de suivi (comme l'assistant).
- **Versions touchées selon NVD** données comme recommandation (« versions touchées avant 8.3.29 (8.3.29 n'est plus citée
  comme touchée) ») : c'est une borne publiée, jamais présentée comme « version corrigée ».
- **Blocs retirés des fiches existantes** (priorité, correctif de Tenable, action du catalogue KEV, recommandations de
  l'éditeur) au profit de la fiche illustrée placée au-dessus ; les tests de l'interface ont été adaptés en conséquence (mêmes
  assertions, rendues sur la fiche illustrée).
- **Composant touché** : produit du catalogue KEV, sinon premier éditeur et produit des CPE de NVD, sinon nom du contrôle.

### Non vérifié

Aucune donnée réelle (tests et rendu sur données fictives). Rendu vu sur un **banc local** (Vite, composant réel dans une
fenêtre Mantine de taille « xl », quatre failles fictives : réseau sans privilège, local avec privilèges élevés, CVSS v4.0,
vecteur illisible ; Chromium, clair et sombre, 1 440 et 390 px ; axe `wcag2a`/`wcag2aa` sans violation, aucun chevauchement de
texte ni texte hors de sa boîte dans le schéma, aucun débordement de page), pas dans la pile complète ; la CSP n'a pas été
vérifiée sur le banc (serveur de développement), seulement par les tests de l'interface. Le parcours Playwright ajouté
(`zzz…-vulnerabilites-fiche.spec.ts`, réponses de lecture remplacées par des données fictives) n'a pas été joué (CI
seulement). Docker et Node 26.

### Points ouverts (hors lot)

1. **Plan d'action rédigé par l'assistant** dans la fiche (bloc « Proposition de l'assistant » de la maquette, V25).
2. **Liens entre machines** (front → back → base) : aucune source ne les fournit (point ouvert 5).
3. Parcours horodaté de la faille (publiée, exploitée, détectée, action, corrigée), si le RSSI le veut.
4. Vecteur d'AlgoLightHouse : à ranger seulement si l'éditeur le publie (champ à ajouter à la liste blanche, à valider).

## Addendum du 18/11/2026 — lot S1 : délais de correction et exceptions à échéance

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). Migration `087`
(additive : colonnes facultatives sur `vulnerabilites_suivis` et `vulnerabilites_suivi_historique`, contrainte des
événements de l'historique recréée avec « expiration », table `vulnerabilites_depassements`, contrainte de portée de
`grc_notifications` recréée avec deux types, quatre index ; aucune donnée reprise ni modifiée ; numéro libre sur toutes les
branches distantes le 18/11/2026). Aucun appel réseau, aucun appel au modèle, aucune dépendance nouvelle, aucun rôle ni droit
nouveau ; l'assistant n'est pas touché (il lit l'état de suivi des failles, inchangé). Remplace, dans
l'addendum « lot V4b », le choix « date de revue facultative, signal calculé quand elle est passée, sans changement d'état ».

### Décision du RSSI (18/11/2026)

Transformer l'outil de surveillance en outil de pilotage, dans cet ordre : (1) le suivi de la correction dans le temps,
(3) les exceptions formalisées ; puis un rapport et le regroupement par correctif (lots suivants). Ses mots : « un délai
cible par priorité (par exemple P1 sous 48 h, P2 sous 15 jours), l'âge de chaque faille, et les dépassements signalés » ;
« quand une faille ne peut pas être corrigée (équipement biomédical, application d'éditeur), pouvoir enregistrer une
acceptation du risque avec une justification, une mesure compensatoire et une date d'échéance. L'état "risque accepté"
existe, mais sans échéance ni rappel ». Contexte : certification ISO/IEC 27001:2022 et HDS, éléments attendus en audit.

### Réalisation

- **Délai cible par priorité** (`packages/shared/src/delais-vulnerabilites.ts`, fonctions pures testées en table) : rangé
  avec les seuils de priorité (clé `vulnerabilites:priorite` de `settings`, champ `delais`), réglé dans « Seuils de
  priorité » avec `vulnerabilites:administrer`, If-Match et le journal `vulnerabilites.priorite.reglage_modifie` ; une
  saisie peut ne porter que le seuil ou que les délais (`SaisieReglagePriorite`), le reste est gardé ; un réglage rangé avant
  le lot prend les délais par défaut du code. Durée entière d'une heure à un an, en heures ou en jours, ou « aucun délai ».
- **Âge et point de départ** : dates déjà rangées, aucune inventée. Constat : la première détection de Tenable sur une de
  ses machines (`min(premiere_detection)` des détections), sinon l'entrée du constat dans la plateforme (`cree_le`) ;
  faille déclarée : la date du rapprochement (`cree_le`, plus ancienne que sa confirmation éventuelle). L'âge court depuis
  cette première présence ; le délai, depuis elle ou depuis sa **reprise** (`delai_repart_le`) si elle est plus récente :
  fin d'une exception (expiration ou levée) et réapparition d'une faille corrigée.
- **Priorité qui fixe le délai** : la priorité courante, sur tous les faits connus (lot ALH5), celle des listes. Le passage
  d'une priorité à une autre **n'est pas historisé** (la priorité est recalculée à chaque lecture ; seules les alertes P1 et
  P2 exposées gardent un niveau) : après une montée P2 → P1, le délai P1 court donc depuis la première présence. Échéance
  calculée, jamais saisie ; un jour vaut 24 heures.
- **États** (`calculerDelai`) : « En dépassement » (échéance passée), « Échéance proche » (moins d'un quart du délai
  restant), « Dans les délais », « Sans délai » (P4 par défaut) ; jamais en dépassement : « Close » (corrigée, non
  concernée), « Sous exception » (risque accepté), « Plus rapportée par la source » (proposition « corrigée » à confirmer).
- **Écrans** : colonne « Délai » (état en clair, âge, échéance, délai de la priorité) des listes de « Failles détectées »
  (constats et failles déclarées), filtre « Délai » et « Trier par : Échéance de correction », repris de l'adresse ; mention
  dans la fiche illustrée (PC4) ; tuile « En dépassement » de la vue d'ensemble (PC1), vers la liste filtrée et triée ;
  onglet « Délais et exceptions » (`/vulnerabilites/delais`) : délais cibles, mesure des corrections sur 30 jours, 90 jours
  ou 12 mois, exceptions.
- **Dépassements signalés** : évaluation au tic de l'API, au plus une fois par quart d'heure, dans une transaction sous
  verrou consultatif (`apps/api/src/vulnerabilites/delais.ts`) ; elle reprend le calcul global des alertes
  (`situationGlobale`, objets suivis présents). Les failles entrées en dépassement depuis l'évaluation précédente (table
  `vulnerabilites_depassements`, une ligne par faille signalée, recalculée) donnent **un** résumé « n failles en
  dépassement de délai » (type `vulnerabilites_delais`, lien vers la liste filtrée), aux comptes qui lisent le module, selon
  leurs réglages ; aucun quand il n'y en a pas ; ni CVE ni nom. Une faille dont l'échéance change (délai reparti) est
  signalée de nouveau. Journal `vulnerabilites.delais.evalues` (nombres seulement). Module désactivé : rien.
- **Mesure** (`mesurerCorrections`) : au passage à « corrigée », l'historique relève la priorité, le point de départ, la
  fin et l'échéance du délai ; la fin est la date de la proposition « corrigée » quand la décision la confirme, sinon la
  date de la décision. Par priorité et en tout : nombre, délai moyen et médian, corrections avec délai et faites au plus
  tard à l'échéance, part dans les délais. Les mêmes nombres pour tout le monde, sans nom. Les corrections décidées avant le
  lot sont comptées à part (« non mesurées »). Fonctions réutilisables pour le rapport d'un lot suivant.
- **Exceptions** : un risque accepté exige une justification (la note), une mesure compensatoire et une échéance (la date de
  revue du lot V4b, champ `revueLe`), ni passée ni au-delà de **douze mois**. Accorder, prolonger (même état, nouvelle
  échéance) ou lever (tout autre état) une exception est réservé au **rôle « RSSI »** de la plateforme (`rssi.ts`, même
  mécanisme que la prise en compte d'une alerte du lot V6b, direct ou par un groupe), en plus de `vulnerabilites:modifier` et
  de la lecture de toutes les machines touchées : **403** « Seul le RSSI peut accorder, prolonger ou lever une exception
  (risque accepté). » sinon, administrateur compris. Rangés sur le suivi : justification, mesure, auteur et date, état d'avant
  l'exception, date du rappel ; à l'historique : la note, la mesure et l'échéance. Le lien existant avec une action du
  registre (lot V4b) reste disponible, sans être obligatoire.
- **Expiration et rappel** (même évaluation) : une exception dont l'échéance est passée (fuseau de l'organisation) expire
  d'elle-même : la faille revient à l'état d'avant l'exception s'il était « à traiter » ou « en cours », sinon « à
  traiter » ; son délai repart de l'expiration ; l'événement « expiration » (auteur « système », avec l'échéance) entre à
  l'historique ; journal `vulnerabilites.exceptions.echues` (identifiants internes) ; puis les alertes sont réévaluées. Un
  rappel part quatorze jours avant l'échéance, une fois par exception et par échéance (journal
  `vulnerabilites.exceptions.rappel`). Un seul résumé « n exceptions échues, m à échéance sous 14 jours » par évaluation
  (type `vulnerabilites_exceptions`, lien vers l'onglet). Exceptions listées dans l'onglet : en cours, bientôt échues, échues
  depuis 90 jours, sans échéance, des seules failles que la personne lit (au moins une machine touchée lisible, comme les
  listes), avec qui et quand, justification, mesure compensatoire et échéance ; filtre « Risque accepté » des listes
  inchangé ; mention dans la fiche illustrée et marque « Exception … » dans la colonne « Suivi ».
- **Requêtes ajoutées aux routes existantes** : listes des constats et des failles déclarées 0 (colonnes ajoutées aux
  requêtes existantes, calcul en mémoire) ; vue d'ensemble 0 (objets du calcul global déjà fait) ; fiche illustrée 0 ;
  fiche du suivi 1 (rôle RSSI) ; changement d'état 1 à 2 (rôle RSSI) et, au passage à « corrigée », 7 environ (délai de
  l'objet : réglage, objet, CVE et faits des sources, date de la proposition) ; réglage 0. Route nouvelle `GET
  /api/vulnerabilites/delais` : 4. Évaluation au tic : nombre fixe (verrou, expiration 2 à 4, rappel 1, calcul global des
  alertes, dépassements 1 à 3), plus la lecture des destinataires (une par compte actif, comme les alertes) quand il y a
  quelque chose à notifier ; aucune par faille.

### Choix de réalisation, à confirmer par le RSSI

- **Valeurs par défaut** : P1 48 heures, P2 15 jours, P3 90 jours, P4 aucun délai ; un jour vaut 24 heures (ni jours
  ouvrés ni jours fériés).
- **Échéance proche** : moins d'un quart du délai restant (fixe) : P1 12 heures, P2 3 jours et 18 heures, P3 22 jours et
  12 heures.
- **Montée de priorité** : délai de la nouvelle priorité compté depuis la première présence (le passage n'est pas historisé).
- **Reprise du délai** : à la fin d'une exception (expiration ou levée, délai complet de la priorité courante) et à la
  réapparition d'une faille corrigée ; pas à la réouverture manuelle d'une faille corrigée.
- **Faille déclarée** : première présence = date du rapprochement, même s'il a été confirmé plus tard.
- **Faille que la source ne rapporte plus** (proposition « corrigée » à confirmer) : jamais en dépassement ; la mesure prend
  la date de la proposition comme fin quand la décision la confirme.
- **Date de revue devenue échéance** : la colonne `revue_le` du lot V4b porte l'échéance, sans colonne nouvelle. Une
  exception enregistrée avant le lot **avec** une date de revue passée expire à la première évaluation ; **sans** date, elle
  reste valide, signalée « sans échéance, à compléter » (aucune migration de données).
- **Durée maximale** : douze mois, même jour du mois (fin du mois s'il n'existe pas).
- **Qui décide** : seul le rôle « RSSI » accorde, prolonge ou lève, y compris pour passer une faille sous exception à
  « corrigée » ; les autres personnes ne peuvent que **lire** l'exception : un état « proposée » ne s'insère pas proprement
  dans le cycle existant (il faudrait un second jeu de champs proposés et une décision d'acceptation ou de refus à côté de la
  proposition « corrigée ») ; à trancher si le RSSI le veut. **Conséquence déjà connue** : le compte créé à l'installation n'a
  que le rôle « Administrateur » ; sans compte qui tienne le rôle « RSSI », aucune exception ne peut être accordée (note de
  mise à jour du CHANGELOG).
- **Rappel** : quatorze jours avant l'échéance (fixe), aussi seuil de « bientôt échue » ; un résumé par évaluation, aux
  lecteurs du module (pas seulement au RSSI).
- **Évaluation** : au tic de l'API, au plus une fois par quart d'heure (expiration dans le quart d'heure qui suit le
  changement de jour), plutôt qu'à la fin des synchronisations, puisqu'un dépassement et une échéance arrivent avec le
  temps ; l'intervalle est gardé en mémoire (un redémarrage évalue au premier tic, sans double notification).
- **Mesure** : une correction par faille et par période (la dernière) ; priorité et échéance relevées à la décision.

### Point à trancher : faille P1 sous exception et alertes critiques

Le code ne change pas la règle des alertes (aucune décision prise). Aujourd'hui, un constat ou une faille déclarée en
« risque accepté » est **traité** au sens des alertes (`close` de `suivi.ts`, comme « corrigée » et « non concernée ») : sa
présence détectée ou déclarée ne compte plus. Une faille P1 dont **tous** les objets suivis sont sous exception n'ouvre donc
plus d'alerte critique, et l'alerte ouverte se clôt avec le motif « traitée » ; **sauf** si la même CVE est aussi exposée
sur Internet (présence « exposée », que le suivi ne couvre pas) : l'alerte critique reste ouverte et la fenêtre rouge
s'affiche. À l'expiration de l'exception, la faille compte de nouveau et une nouvelle alerte critique s'ouvre. Le RSSI
veut-il qu'une faille P1 sous exception garde son alerte critique (ou une alerte d'un autre niveau) ?

### Non vérifié

Aucune donnée réelle (tests sur données fictives). Rendu vu sur un **banc local** (application réelle sous Vite, API
simulée par Playwright, données fictives ; Chromium, clair et sombre, 1 440 et 390 px ; onglet « Délais et exceptions »,
« Failles détectées » filtrée et triée, « Seuils de priorité », vue d'ensemble, fiche d'un constat avec le formulaire
d'exception ; axe `wcag2a`/`wcag2aa` sans violation, aucun débordement de page), pas dans la pile complète ; la CSP n'a pas été
vérifiée sur le banc (serveur de développement), seulement par les tests de l'interface (aucune prop `style` dans les sources
du lot). Le parcours Playwright ajouté (`zzz…-vulnerabilites-delais.spec.ts`, pile sans faille) et le parcours adapté
(`zzz…-vulnerabilites-failles.spec.ts`) n'ont pas été joués (CI seulement). Durée de l'évaluation au tic sur un parc réel
(150 machines, 10 000 vulnérabilités annoncées : même calcul global que les alertes, environ une seconde mesurée au lot
PC1) ; envoi réel d'un courriel ; Docker et Node 26.

### Points ouverts (hors lot)

1. **Rapport** (PDF) des délais et des exceptions pour l'audit : lot suivant ; les fonctions de mesure sont prêtes.
2. **Regroupement par correctif** (un correctif, plusieurs failles) : lot suivant.
3. **Criticité métier des machines** (délai plus court sur une machine critique) : non réalisée.
4. Nombre de failles en dépassement sur les **cartes de périmètre** (PC3) : non réalisé (une faille touche plusieurs
   périmètres ; décompte à définir).
5. **Proposition d'exception** par une personne qui n'est pas RSSI : à trancher (voir ci-dessus).
6. **Faille P1 sous exception et alertes critiques** : à trancher (voir ci-dessus).
7. Historiser le **passage de priorité** pour faire courir le délai depuis la montée, si le RSSI le veut.
8. Confirmer les valeurs par défaut, l'échéance proche, la durée maximale et le rappel.

## Addendum du 18/11/2026 — lot S2 : tendances et rapport de pilotage

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). Migration `088`
(additive : tables `vulnerabilites_instantanes` et `vulnerabilites_instantanes_mesures`, deux index, sans clé étrangère vers
`grc_smsis` comme les autres tables du module ; aucune donnée reprise ni reconstruite ; numéro libre sur toutes les branches
distantes le 18/11/2026). Aucun appel réseau, aucun appel au modèle, aucune dépendance nouvelle, aucun rôle ni droit
nouveau. Lève le point ouvert 1 (« Rapport ») de l'addendum « lot S1 ».

### Décision du RSSI (18/11/2026)

« Tendances. Une courbe des failles ouvertes et corrigées semaine après semaine, par périmètre. Sans historique, le radar ne
dit pas si la situation s'améliore. » ; « Rapport pour la direction et l'audit. Un export PDF mensuel : niveau d'alerte,
failles critiques, délais de correction, exceptions en cours. Vous en aurez besoin pour la revue de direction. » Contexte :
groupement de santé certifié ISO/IEC 27001:2022 et HDS.

### Réalisation

- **Instantané quotidien** (`apps/api/src/vulnerabilites/tendances.ts`, composition pure `composerInstantane` de
  `packages/shared/src/tendances-vulnerabilites.ts`, testée en table) : au tic de l'API, au plus un par jour (fuseau
  Europe/Paris), après l'évaluation des délais. Le créneau du jour est consommé **avant** le calcul (ligne « en_cours », sa
  propre transaction) ; un calcul en échec laisse « echec » et n'est pas refait le même jour ; un jour sans tic reste sans
  instantané, rien n'est rattrapé. Module désactivé : rien, et le créneau n'est pas consommé. Le calcul reprend le calcul
  global des alertes (`situationGlobale`, tous les faits connus, lot ALH5) et les objets suivis du lot S1. Nombres rangés,
  pour toute la plateforme (« global »), par périmètre (périmètre effectif des machines, périmètre AlgoLightHouse relié des
  actifs) et « sans périmètre » (« aucun ») : failles présentes par priorité (P1 à P4), failles présentes dont l'exploitation
  est avérée, objets suivis présents en dépassement de délai et sous exception, objets passés à « Corrigée » au cours du jour
  civil précédent, machines et actifs exposés touchés ; niveau d'alerte de la plateforme (règle du lot PC1). Une faille compte
  une fois dans chaque périmètre où elle a une machine ou un actif ; une faille déclarée sans machine reliée ne compte que pour
  toute la plateforme. Aucun nom de machine, de domaine, d'adresse ni de compte. Journal `vulnerabilites.instantane.pris`
  (jour, niveau, nombre de périmètres, instantanés purgés). **L'historique commence à l'installation du lot** ; l'écran dit
  « historique depuis le … ».
- **Rétention** : trois ans (`RETENTION_INSTANTANES_ANS`), purge au même tic que l'instantané.
- **Onglet « Tendances »** (`/vulnerabilites/tendances`, `apps/web/src/vulnerabilites/Tendances.tsx`) : période (30 jours
  jour par jour ; 13, 26 ou 52 semaines semaine après semaine), portée (toute la plateforme, un périmètre lu, « Sans
  périmètre » avec `administrer`). Courbes : failles présentes par priorité ; exploitées, en dépassement, sous exception et
  corrigées ; niveau d'alerte ; machines et actifs touchés (par périmètre seulement). Dessin par le composant existant
  `NeonCourbes` (`packages/ui/src/neon-graphiques.tsx`), étendu sans changer son rendu d'origine : valeurs absentes qui
  coupent la courbe (aucun zéro inventé), marques de points (une forme par série), trait propre à chaque série, graduations
  entières, nom accessible. Chaque courbe a sa légende (teinte, trait, forme, libellé) et son tableau aux mêmes valeurs ; « — »
  : aucun instantané. Semaine après semaine : nombres du dernier instantané de la semaine, niveau le plus haut, somme des
  corrections connues (les corrections d'un jour sont lues dans l'instantané du lendemain). Indicateur de tendance (règle
  ci-dessous). Route `GET /api/vulnerabilites/tendances` (`vulnerabilites:lire`), lecture seule, sans journal.
- **Vue d'ensemble** (lot PC1) : bloc « Sur 7 jours » sous les tuiles (failles présentes en P1 et P2, exploitées, en
  dépassement, sous exception, niveau), écarts en texte (« +2 (en hausse) »), par rapport au plus récent instantané pris
  entre J-14 et J-7 ; sans lui, l'écran le dit. Les nombres du moment sont composés par la même fonction que l'instantané,
  à partir du calcul global déjà fait.
- **Rapport de pilotage** (`/vulnerabilites/rapport`, `apps/api/src/vulnerabilites/rapport.ts`, tableaux composés par
  `tableauxRapport` du paquet partagé, les mêmes à l'écran et dans le CSV) : mois choisi ou période libre (366 jours au plus,
  fin ramenée à aujourd'hui), toute la plateforme ou un périmètre lu. Sections : niveau d'alerte (au moment du rapport, premier
  et dernier instantané, plus haut, jours par niveau) ; situation du moment ; failles critiques (P1) présentes listées par CVE
  et produit, avec leur présence, leur première présence et le dépassement, et le nombre de P2 ; délais de correction (mesure du
  lot S1 sur la période : moyen, médian, part dans les délais, par priorité) ; dépassements du moment ; exceptions en cours,
  bientôt échues, sans échéance et échues pendant la période (justification, mesure compensatoire, échéance, qui l'a accordée
  et quand) ; tendances semaine après semaine ; alertes critiques de la période (ouvertes, prises en compte, closes, encore
  en cours, délai de prise en compte moyen, médian et le plus long) ; état des sources de veille et des connecteurs. Listes
  bornées à 200 lignes, total toujours dit. Route `GET /api/vulnerabilites/rapport` (`vulnerabilites:lire`, `format=json` ou
  `csv`).
- **Confidentialité** : aucun nom de machine, de domaine ni d'adresse ; les textes (titres, produits, justification et mesure
  compensatoire d'une exception) passent par le masque des machines de l'assistant en mode strict (« [machine] ») ; les
  connecteurs sont désignés par leur type et un numéro (ni nom d'instance ni adresse) ; état des sources sans texte d'erreur.
  Le nom de la personne qui a accordé une exception figure (demande du RSSI). Journal `vulnerabilites.rapport.produit` (qui,
  quand, période, portée, format, `detail: false`), sans contenu.
- **Droits** : les nombres de failles, le niveau d'alerte et les alertes sont communs à tous (lot ALH5) ; un périmètre illisible
  répond 404 (même message qu'un inconnu), « sans périmètre » exige `administrer` ; toute la plateforme ne rend aucun total de
  machines ni d'actifs (comme la vue d'ensemble) ; les exceptions listées sont celles des failles dont la personne lit une
  machine.
- **Requêtes** (mesurées par un test d'API qui compte les requêtes, données fictives, une instance de Tenable) : tendances 3 ;
  rapport 37 (nombre fixe, plus trois environ par instance de connecteur) ; instantané 21 (transaction comprise) ; vue
  d'ensemble 1 de plus (instantané de référence). Aucune requête par faille.

### Format du rapport, et pourquoi

La plateforme **ne produit aucun PDF côté serveur** : elle produit des documents Office sans dépendance (revue de direction :
Word, PowerPoint, Excel, `apps/api/src/export/office.ts`) et des rapports HTML autonomes (Pilotage, comité SMSI) ; `pdfjs-dist`
ne sert qu'à lire des PDF. Un vrai PDF côté serveur demanderait une dépendance nouvelle (moteur de rendu ou bibliothèque PDF),
donc une ADR : **question posée au RSSI**. Le lot livre une **page imprimable** dans l'application (feuille d'impression de
`packages/ui/src/neon-tendances.css` : page nommée A4, numéro de page en marge, ni menu, ni en-tête, ni bouton, ni fenêtre,
noir sur blanc, en-têtes de tableau répétés, lignes non coupées), que le navigateur enregistre en PDF (« Imprimer ou enregistrer
en PDF »), et l'**export CSV** des mêmes tableaux (règles de l'export CSV existant : « ; », BOM, formules neutralisées).

### Règle de la tendance, à confirmer par le RSSI

On compare le premier et le dernier instantané de la période : d'abord le nombre de failles présentes en P1 ; à égalité,
celui des failles en P2 ; à égalité encore, celui des failles en dépassement de délai. Moins : la situation s'améliore ;
plus : elle se dégrade ; tout égal : stable. Moins de deux instantanés : indéterminée.

### Choix de réalisation, à confirmer par le RSSI

- **Rétention** de trois ans.
- **Corrigées** : objets suivis passés à « Corrigée » au cours du jour civil précédent, rangés avec l'instantané du jour et
  replacés sur leur jour dans les courbes ; un jour sans instantané au lendemain reste sans nombre.
- **Exploitées et présentes** : failles présentes dont l'exploitation est avérée par une source (au lieu de « présentes en
  P1 » de la tuile, presque toujours égal) ; **dépassements et exceptions** comptés en objets suivis (comme la tuile du lot S1),
  les priorités en failles.
- **Variation sur sept jours** : instantané de J-7, ou le plus récent jusqu'à J-14 ; P2 compté en failles présentes (la tuile
  « À traiter » compte aussi les produits à confirmer).
- **Qui produit le rapport** : toute personne qui lit le module, pour ce qu'elle lit (option prudente).
- **Alertes et niveau dans un rapport de périmètre** : ceux de la plateforme, communs à tous (une alerte n'est rattachée à aucun
  périmètre).
- **Pas d'option « avec le détail des machines »** (point ouvert ci-dessous) ; le texte d'une exception est masqué même pour
  qui lit la machine.

### Non vérifié

Aucune donnée réelle. Rendu vu sur un **banc local** (API réelle sur une base temporaire du PostgreSQL de test, servie par
Vite ; historique fictif de 120 jours, 14 machines, 40 constats ; Chromium, clair et sombre, 1440 et 390 px : onglet
« Tendances » au global et par périmètre sur 13 semaines, vue d'ensemble, rapport ; axe `wcag2a`/`wcag2aa` sans violation,
aucun chevauchement, aucun débordement, aucune violation de CSP ni erreur dans la console) ; PDF d'essai produit par
`page.pdf()` en A4 : quatre pages, ni menu ni bouton, aucun nom de machine ni d'adresse. Le parcours Playwright ajouté
(`zzz…-vulnerabilites-tendances.spec.ts`) n'a pas été joué (CI seulement). Impression par un navigateur autre que Chromium (rendu des marges de page nommée, donc du numéro de page, non vérifié); durée sur un parc réel ; Docker et Node 26.

### Points ouverts (hors lot)

1. **PDF produit par le serveur** : dépendance nouvelle à décider (ADR) ; sinon l'impression du navigateur reste la voie.
2. **Option « avec le détail des machines »** dans le rapport, réservée à qui les lit : non réalisée.
3. **Envoi automatique du rapport** par courriel chaque mois : non réalisé.
4. **Lien avec la revue de direction** (module Pilotage) : la revue prépare ses entrées (ISO/IEC 27001:2022, 9.3.2) à partir
   des données de la plateforme (`apps/api/src/pilotage/revue.ts`) et s'exporte en Word, PowerPoint ou Excel ; elle ne lit rien
   du module Vulnérabilités. Il faudrait une entrée « vulnérabilités » (niveau d'alerte, P1, délais, exceptions) tirée des
   mêmes fonctions que le rapport, selon les droits de la personne qui prépare la revue.
5. **Regroupement par correctif**, **fin de support**, **vrai zero-day** (sans correctif publié), **criticité métier des
   machines** : non réalisés (lots suivants).
6. Confirmer la rétention, la règle de la tendance, les définitions ci-dessus et les droits du rapport.

## Addendum du 18/11/2026 — lot S3 : regroupement par correctif, fin de support, faille sans correctif

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). **Aucune migration**,
aucun appel réseau nouveau (liste fermée de Tenable inchangée : `POST /rest/analysis`, `GET /rest/hosts`,
`GET /rest/hosts/{uuid}`, `GET /rest/system`), **aucune liste blanche élargie**, aucun script de l'exécutant modifié, aucune
dépendance nouvelle, aucun rôle ni droit nouveau, rien de nouveau chez l'assistant. Lève le point ouvert 2 de l'addendum
« lot S1 » et, en partie, le point ouvert 5 de l'addendum « lot S2 » ; répond au point ouvert 14 (unité affichée) pour la
vue par correctif.

### Décision du RSSI (18/11/2026)

Propositions acceptées (« tout m'intéresse ») : **regroupement par correctif** (« 12 mises à jour à faire plutôt que 400
failles ») ; **fin de support** (signaler les systèmes et produits qui ne reçoivent plus de correctifs ; Tenable et
AlgoLightHouse le disent déjà) ; **disponibilité d'un correctif** (distinguer « exploitée et corrigible » de « exploitée sans
correctif », le vrai zero-day). Parc annoncé : 150 machines, 10 000 vulnérabilités ; termes techniques exacts exigés.

### Inventaire des données déjà lues et rangées (règle d'or : rien d'inventé)

| Sujet | Source | Champ lu par l'exécutant | Rangé | Utilisé par ce lot |
| --- | --- | --- | --- | --- |
| Correctif | Tenable (`vulndetails`) | `solution` | `vulnerabilites_constats.correctif` (anglais, nettoyé, 2 000 caractères) | **Oui** : clé du regroupement |
| Correctif | Tenable (`vulndetails`) | `patchPubDate` | `correctif_publie_le` | **Oui** : « correctif disponible » à cette date |
| Correctif | Tenable (`sumremediation`) | — | **Non** : la vue est permise (même appel `POST /rest/analysis`) mais le connecteur ne la demande pas ; seul `scripts/dev/exemples-tenable.ps1` l'a lue le 16/11/2026 | Non (voir « Points ouverts ») |
| Correctif | CERT Santé (fiche) | mention « Un correctif existe : Oui / Non » | `vulnerabilites_veille_avis.fiche_correctif` (lot V4c) | **Oui** : « disponible » ou « aucun correctif connu » |
| Correctif | CISA KEV | `requiredAction` | `kev_action` | Non pour l'état : une consigne (« appliquer les mesures de l'éditeur ou cesser l'usage »), pas la preuve d'un correctif ; reste affichée dans la fiche |
| Correctif | NVD | bornes `versionEndExcluding` / `versionEndIncluding` | `vulnerabilites_veille_cve_produits` | Non pour l'état : une borne haute publiée suggère une version corrigée sans la prouver ; reste affichée dans la fiche (« n'est plus citée comme touchée ») |
| Correctif | AlgoLightHouse | `latest_version` (fragment `vulnerable_component`) | **Non** : exclu de la liste blanche au lot ALH6 | Non |
| Fin de support | Tenable (`vulndetails`) | `seolDate` (« -1 » quand elle ne s'applique pas) | `fin_support_le` | **Oui** : critère unique, date passée |
| Fin de support | Tenable | famille du contrôle (`family`) | `famille` | Non : aucune famille propre aux systèmes non maintenus dans le relevé du RSSI ; aucune liste de noms codée en dur |
| Fin de support | Tenable | constat sans CVE (V18) | calculé | Non : reste la marque distincte « Non maintenu » |
| Fin de support | AlgoLightHouse | `version_status` = `eol` / `outdated` (fragment `vulnerable_component`) | `vulnerabilites_alh_services.statut_version` (lot ALH6) | **Oui** : `eol` seulement ; `outdated` reste « version dépassée » |
| Fin de support | AlgoLightHouse | `version_status` des technologies | **Non** : `/technologies` ne le porte pas dans la liste blanche | Non : la marque porte sur le **service exposé** (produit et version au port), pas sur la technologie |

### Réalisation

- **Paquet partagé** (`packages/shared/src/correctifs-vulnerabilites.ts`, testé en table) : `etatCorrectif` (trois valeurs et
  les sources qui parlent), `situationExploitation`, `etatFinSupport`, `serviceEnFinDeSupport`, `texteCorrectif`,
  `regrouperParCorrectif`, `comparerCorrectifs`, `enteteCorrectifs`, DTO et paramètres des routes.
- **État du correctif** : « correctif disponible » dès qu'une source le dit (date de publication de Tenable, « Oui » du CERT
  Santé) ; « aucun correctif connu » quand le CERT Santé écrit « Non » et qu'aucune source ne dit le contraire ; « non
  renseigné » sinon, **jamais lu comme « aucun correctif »**. Règle des sources (V26) : une source suffit ; un correctif publié
  ne disparaît pas, donc « disponible » l'emporte ; les sources sont rendues de la première à la dernière. Pour une CVE (fiche
  d'une CVE, d'une faille déclarée, d'une alerte, vue d'ensemble, rapport), Tenable parle s'il cite la CVE dans un contrôle qui
  porte une date de correctif ; pour un constat, sa propre date.
- **Précision du zero-day** (la marque n'est pas renommée, ni les alertes ni la priorité ne changent) : « exploitée, correctif
  disponible », « exploitée, sans correctif connu », « exploitée, correctif non renseigné » : fiche illustrée, détail d'un
  correctif, tuile « Exploitées et présentes » (« dont n sans correctif connu, m correctif non renseigné »), tuile du parc et
  liste des machines (`exploiteeSansCorrectif` de `MarquesMachineDto`).
- **Fin de support** : constat dont `seolDate` est passée (`finDeSupport`, marque et filtre `finSupport=oui` de la liste) ;
  date à venir : « fin de support annoncée », sans marque. Machine : au moins un constat **présent** en fin de support, quel que
  soit son état de suivi (un fait, pas une décision) : `finDeSupport` et les cinq premiers contrôles en cause
  (`finsDeSupport`) de `MachineDto`, colonnes ajoutées à la requête existante ; mention sur la tuile du parc (donc aussi dans
  « Périmètres »), dans la liste, rubrique de la fiche, filtre des machines et du parc. Service exposé `eol` : mention dans
  l'onglet « Actifs » et les fiches de la surface externe. Vue d'ensemble : tuile « Fin de support » (contrôles, communs à
  tous ; machines et services exposés lus, drapeau sans nombre pour le reste). Rapport : section « Contrôles de Tenable en fin
  de support » (nom masqué, date, machines de la portée, aucun total pour toute la plateforme). Fiche illustrée : source et
  date.
- **Vue « Par correctif »** (`GET /api/vulnerabilites/correctifs`, `GET …/correctifs/{cle}`, `vulnerabilites:lire`, lecture
  seule, sans journal ; `apps/api/src/vulnerabilites/correctifs.ts`, `apps/web/src/vulnerabilites/Correctifs.tsx`) : constats
  de Tenable présents et encore à traiter (comme la liste par défaut), regroupés par texte de solution (empreinte SHA-256
  tronquée comme clé) ; par groupe : failles, CVE distinctes, machines lues (drapeau pour les autres), priorité la plus haute,
  exploitées (dont sans correctif connu), exploitables, fin de support, état de délai le plus défavorable, échéance la plus
  proche, nombre en dépassement, répartition par état du correctif et sources. Tri par gain, le même pour tout le monde :
  priorité, failles corrigées, exploitées, CVE, texte. Recherche dans le texte, filtre de priorité. Détail : toutes les
  failles du groupe (bornées à 500) avec leur état du correctif ; la fiche existante ne s'ouvre que si la personne lit une de
  leurs machines (sinon, le seul contrôle, comme la vue d'ensemble) ; les machines lues (250 au plus), leur fiche au clic.
  **Requêtes** : liste 7 au plus (réglage 1, constats 1, machines lues 1, CVE 1, faits des sources 3), détail 8 ; aucune par
  faille ni par correctif (test d'API qui compte). Vue d'ensemble : 2 de plus (machines lues et services en fin de support) ;
  listes, parc, rapport : 0.

### Choix de réalisation, à confirmer par le RSSI

- **Regroupement par le texte de la solution**, pas par `sumremediation` : la vue n'est pas lue par le connecteur ; elle
  fusionnerait les libellés (`solutionID`, `remediationList`). Limite dite à l'écran : deux libellés différents pour la même
  mise à jour ne sont pas fusionnés.
- **Unité « faille »** de la vue : le constat de Tenable (contrôle), comme « Failles détectées » ; les CVE distinctes sont
  données à côté.
- **Failles déclarées et CVE de la surface externe absentes** de la vue : aucune source rangée ne leur donne de correctif ;
  l'écran le dit.
- **Nombres de failles communs, noms de contrôles montrés à tous** dans le détail (comme la vue d'ensemble, lot PC1) ; seules
  les machines suivent les droits.
- **Fin de support d'une machine** indépendante de l'état de suivi (même un risque accepté la laisse marquée).
- **Texte de la solution de Tenable non lu comme preuve** d'un correctif ; seule la date de publication compte.
- **Mention « Fin de support »** distincte de « Non maintenu » (constat sans CVE, inchangé) et de « version dépassée ».

### Questions au RSSI

1. **Mot « zero-day »** (proposition, non appliquée) : le réserver à une faille exploitée **sans correctif connu**, et
   afficher « exploitation avérée » pour une faille exploitée dont un correctif est disponible ? Tant qu'il n'a pas tranché, la
   marque reste « Zero-day : exploitation avérée » et la précision est ajoutée à côté ; alertes et priorité inchangées.
2. **Priorité d'une machine en fin de support** : doit-elle monter d'un cran (ou la faille qu'elle porte) ? Aucun effet dans ce
   lot.
3. **Lire `sumremediation`** dans la synchronisation (même appel `POST /rest/analysis`, champs `solutionID`, `solution`,
   `remediationList`, `pluginID`, en liste blanche) pour fusionner les libellés d'un même correctif ? Demanderait une page
   d'analyse de plus par synchronisation et une migration (table des correctifs).
4. **Lire `latest_version`** d'AlgoLightHouse (exclu au lot ALH6) pour faire entrer les CVE exposées dans la vue par correctif
   (« passer à la version x ») ? Élargissement de liste blanche et migration additive ; ce n'est pas la preuve qu'elle corrige
   chaque CVE.
5. **Base de dates de fin de vie** (par exemple endoflife.date) : ce serait une nouvelle source de veille, sur Internet, à
   décider (flux, liste fermée, conditions d'usage).

### Non vérifié

Aucune donnée réelle : forme réelle de `seolDate` et de `patchPubDate` sur les contrôles de systèmes non supportés de
l'instance (le relevé du 16/11/2026 nomme les champs, `seolDate` valant « -1 » quand elle ne s'applique pas) ; part des
contrôles dont la solution est identique d'une machine à l'autre ; forme réelle de `json_data` d'AlgoLightHouse (toujours
nulle sur les exemples, lot ALH6) : la mention « Fin de support » des services peut ne jamais paraître. Rendu vu sur un **banc
local** (API réelle sur une base temporaire du PostgreSQL de test, servie par Vite ; 150 machines, 421 failles en 15
correctifs et un groupe sans correctif, six machines en fin de support, une faille exploitée sans correctif connu ; Chromium,
clair et sombre, 1 440 et 390 px : vue par correctif et ses deux fenêtres, fiche d'une faille, failles filtrées, machines en
liste filtrée, fiche, parc, vue d'ensemble, rapport ; axe `wcag2a`/`wcag2aa` sans violation, aucun débordement de page), pas
dans la pile complète ; la CSP n'a pas été vérifiée sur le banc (serveur de développement), seulement par les tests de
l'interface. À 390 px, les tables du détail d'un correctif sont serrées (colonnes étroites). Le parcours Playwright ajouté
(`zzz…-vulnerabilites-correctifs.spec.ts`) et le parcours adapté (`zzz…-vulnerabilites-fiche.spec.ts`) n'ont pas été joués
(CI seulement). Docker et Node 26.

### Points ouverts (hors lot)

1. Les cinq questions ci-dessus.
2. Criticité métier des machines (point ouvert 3 de l'addendum « lot S1 ») : non réalisée.
3. Fin de support au niveau de la **technologie** d'AlgoLightHouse : la liste `/technologies` ne porte pas `version_status`
   dans ce qui est lu.

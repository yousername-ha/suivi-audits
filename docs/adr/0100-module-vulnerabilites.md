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

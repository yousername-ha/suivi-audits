# Constats de l'agent 6 : installation, comptes, Plateforme, Système, paramètres

| Élément | Valeur |
| --- | --- |
| Campagne | Phase 1, tranche 6 ([CAMPAGNE-MULTI-AGENT.md](../CAMPAGNE-MULTI-AGENT.md), §5) |
| Commit testé | `2e63e86` (branche `claude/recette-rssi-2026-11-12`), images construites depuis la branche (version affichée « local ») |
| Date | 12/11/2026, de 20:55 à 22:00 (Europe/Paris) |
| Pile | `https://127.0.0.16` (pile Docker 6 de `lancer.sh`), vierge au premier contact (`GET /api/setup` : `needed:true`, `adminExists:false`) |
| Briques relevées | Node.js v26.12.1, PostgreSQL 18.6 (écran Détails techniques et `GET /api/admin/info`) |
| Navigateur | Chrome sans interface du pilote (`PILOTE_PORT=9339`, `.pilote-6`), fenêtre 1440 × 900, fuseau du navigateur UTC (les heures formatées par le navigateur ne sont pas jugées) |
| Données | Jeu fictif `organisation-fictive.json` ; aucun secret recopié ici (poivre, clé de secours, TOTP, mots de passe temporaires, lien d'écran mural gardés dans `.pilote-6/`) |
| Résultat de la tranche | 210 cases : 69 ok, 40 défaut, 101 sans objet, 0 non testée (`matrice.mjs bilan`) |

## Écrans couverts

Tous les écrans de la tranche ont été ouverts et exercés sous le périmètre principal « SMSI Groupement Santé Fictif » :
installation (`/setup`), connexion (`/login`), Mon compte (`/account`), guide (`/aide`), les 18 cartes Plateforme, les
10 cartes Système, `/parametres/:section`, `/parametres/configuration-grc/:kind`, `/admin/:tab` et
`/pilotage/configuration`. Chaque formulaire a été rempli avec des données fictives, relu par l'API, puis soumis à des
valeurs invalides ou en double. Les suppressions n'ont porté que sur des objets créés exprès (préfixe test6).

Sous le sous-périmètre « Hébergement HDS » (créé rattaché au principal, héritage des référentiels coché), les écrans qui
dépendent du périmètre ont été testés : Configuration du pilotage (méthodes publiées et accès au périmètre),
Configuration GRC (portée « Un périmètre »), Import Tenacy (périmètre de destination), Utilisateurs (accès au
périmètre), Écrans muraux (absence de périmètre).

## Cases sans objet, et pourquoi

- **Réglages d'instance** (Général, Cycle, Référentiels, Groupes, Fonctions, Rôles, Conservation, Calendriers, Types de
  processus, Apparence, Notifications, Destinataires, toutes les cartes Système, `/admin`, `/parametres`) : la fenêtre
  n'a pas de sélecteur de périmètre et lit `/api/settings` ou `/api/admin/*` sans identifiant de périmètre. Les trois
  cases « sous-périmètre » de ces écrans sont sans objet.
- **Connexion, installation, Mon compte, guide** : indépendants du périmètre.
- **Écrans sans saisie libre** (Apparence, Destinataires, Sessions, Détails techniques) ou **jamais vides** (journal
  d'audit, journaux techniques, détails techniques, guide) : case « erreur » ou « vide » sans objet, raison écrite dans
  le CSV.
- **Opérations d'exploitation non exécutées sur la pile de recette** : mise à jour, restauration d'une version ou d'une
  archive, remise à vide, changement d'adresse, changement de poivre, remplacement de la clé de secours, renouvellement
  de certificat. Chacune a été menée jusqu'au refus ou à la confirmation, puis annulée.
- **Services extérieurs** : envoi réel de courriel, vérification des mises à jour. Les erreurs de saisie de ces
  formulaires ont été testées.
- **Clés de sécurité WebAuthn** : non proposées sur une adresse IP (message explicite de l'application et du journal
  technique) ; étape « clé de sécurité » de l'installation absente pour la même raison.
- **Import Tenacy dans le sous-périmètre** : aucun export Tenacy fictif dans le jeu de données ; seul le refus d'un
  faux fichier a été testé.

## Constats

### C6-01 — Messages de refus avec la clé technique du champ ou le texte brut du validateur

- Gravité : mineur
- Écrans : Général, Courriel, Utilisateurs, Groupes, Rôles, Fonctions, Configuration GRC, Configuration du pilotage
- Référence : CAMPAGNE §5.3 (« le message doit désigner le champ en français ») ; AGENTS.md (interface en français)
- Observé :
  - `remplir "Adresse e-mail de contact" "pas-un-courriel"`, `remplir "Site web" "pas une url"`, `cliquer button
    "Enregistrer"` (Général) → `alert: "email : Adresse e-mail invalide. ; site : Adresse web invalide (http ou https)."` ;
    organisation vide → `orgName : Organisation obligatoire.` Le champ fautif n'est pas marqué.
  - Courriel → `hote : Nom d'hôte invalide. ; expediteur : … ; contactTechnique : … ; autoriteCertification : …`.
  - Fonctions, nom vide → `Données invalides — name : Trop petit : chaîne de caractères doit avoir >=1 caractères`.
  - Configuration du pilotage, publication sans motif → `Données invalides — reason : Trop petit : chaîne de caractères
    doit avoir >=10 caractères` (et `>=5` pour la politique métier), alors que « Simuler la publication » venait
    d'afficher « Configuration valide ».
  - Configuration GRC, échelle quantitative sans valeurs → `levels : Une échelle quantitative exige une valeur…`.
  - Utilisateurs, Groupes, Rôles → `username : …`, `name : Nom obligatoire.`
  - Cause visible dans le code : `apps/api/src/settings.ts` compose le message avec `i.path.join('.')`.
- Attendu : le libellé affiché du champ (« Adresse e-mail de contact », « Motif de publication »…), le champ marqué
  en erreur, aucune formule du validateur (`>=1 caractères`).
- Reproductible par : à écrire (test de formulaire Général avec un courriel invalide).

### C6-02 — Cycle de certification inventé sur une installation neuve

- Gravité : mineur
- Écran : Cycle de certification (`/plateforme/cycle`), tableau de bord
- Référence : scénario, étape 8 (« le cycle correspond aux dates de l'organisation, pas à un cycle par défaut ») ;
  AGENTS.md (aucune donnée inventée)
- Observé : juste après l'installation, `GET /api/settings/cycle` → `years [2025, 2026, 2027]`, libellés
  « Certification initiale / Surveillance 1 / Surveillance 2 », `nextYear 2027`, `iso27001Certified true`. Le tableau
  de bord affiche « Prochain audit — 2027 — Surveillance 2 » alors que le RSSI n'a rien saisi (pour le jeu fictif, 2027
  est la surveillance 1).
- Attendu : cycle vide et « Organisation certifiée » non coché tant que le RSSI ne l'a pas renseigné ; tableau de bord
  « Cycle non renseigné ».
- Reproductible par : à écrire (pile vierge, `GET /api/settings/cycle`).

### C6-03 — Cycle incohérent accepté sans message

- Gravité : mineur
- Écran : Cycle de certification
- Référence : ISO/IEC 27001:2022, 9.2 (programme d'audit) ; cohérence des chiffres
- Observé : années « abcd » et « 1850 » tapées puis Entrée : ignorées sans message. Années 2026 à 2029, année du
  prochain audit 2027, `remplir "Date du prochain audit" "2031-03-15"` → « Cycle d'audit et années : enregistré. ». Le
  tableau de bord affiche alors « 15/03/2031 dans 1584 j — 2027 — Surveillance 1 ».
- Attendu : refus (ou avertissement) d'une date hors du cycle et d'une date qui ne tombe pas l'année du prochain audit ;
  message quand une année saisie est rejetée.
- Reproductible par : à écrire.

### C6-04 — « Référentiel complémentaire actif » affiché vide ; le choisir désactive ReCyF

- Gravité : majeur
- Écran : Référentiels (`/plateforme/referentiels`) ; effet sur `/pilotage/referentiels` (tranche 3)
- Référence : traçabilité du référentiel appliqué ; donnée fausse à l'écran
- Observé : `GET /api/settings/referentiels` → `activeFw: "recyf-2.5"`, mais la liste « Référentiel complémentaire
  actif » est vide. Sa seule option est « ReCyF » : la choisir et enregistrer écrit `activeFw: "ReCyF"`, et
  `/pilotage/referentiels` passe de « Actif dans le socle historique · 152 exigences » à « Conservé dans le socle
  historique ». Cause visible dans le code : `apps/web/src/pages/Settings.tsx` donne les noms (`comp.map((c) => c.nom)`)
  comme valeurs de la liste, alors que la valeur enregistrée est un identifiant. Valeur d'origine remise par l'API.
- Attendu : la liste affiche le référentiel réellement actif et enregistre son identifiant.
- Reproductible par : à écrire.

### C6-05 — Catégorie NIS 2 impossible à remettre à « Non renseignée » ; « enregistré » et journal d'audit inexacts

- Gravité : majeur
- Écran : Référentiels
- Référence : ISO/IEC 27001:2022, A.8.15 (journalisation) et 7.5.3 (maîtrise des informations documentées)
- Observé : catégorie passée à « Entité importante » et enregistrée, puis `choisir "Catégorie d'entité (NIS 2)" "Non
  renseignée"`, `cliquer button "Enregistrer"` → « Référentiels : enregistré. ». Rechargement et
  `GET /api/settings/referentiels` → `entityCategory: "importante"`. Le journal d'audit (export CSV) consigne pourtant
  `"before": {"entityCategory": "importante"}, "after": {"entityCategory": ""}` : il trace un changement qui n'a pas eu
  lieu. La valeur reste « importante » sur la pile (impossible à remettre, c'est le défaut).
- Attendu : la valeur vide est enregistrée, ou refusée avec un message ; le journal ne consigne que ce qui est écrit.
- Reproductible par : à écrire (PUT puis GET de la section `referentiels`).

### C6-06 — Adresses de carte qui n'ouvrent rien

- Gravité : remarque
- Écrans : `/plateforme/echelles`, `/plateforme/configuration-pilotage`
- Observé : ces deux cartes mènent à `/parametres/configuration-grc` et `/pilotage/configuration`. Ouvertes
  directement, leurs propres adresses affichent la grille des cartes sans fenêtre ni redirection.
- Attendu : redirection vers la page cible (un favori ou un lien partagé doit aboutir).
- Reproductible par : à écrire.

### C6-07 — Boutons sans nom ou ambigus pour un lecteur d'écran

- Gravité : mineur
- Écrans : fenêtres secondaires de Plateforme et Système, Configuration GRC
- Référence : RGAA 11.9 / WCAG 2.4.6 et 4.1.2
- Observé : dans les fenêtres « Nouveau compte », « Nouveau groupe », « Nouvelle fonction », « Confirmation »,
  « Nouvel élément : échelle », « Publier la version 1 », « Lien d'activation de l'écran », l'arbre montre
  `button: - img` (croix de fermeture sans nom), alors que les fenêtres principales ont « Fermer Général ». Boutons
  répétés sans contexte : « Adopter ce modèle » (×3), « Révoquer l'accès » (×2), « Fermer » dans Sessions actives,
  « Modifier » et « Supprimer » à chaque ligne d'Utilisateurs. Croix des années du cycle absentes de l'arbre.
- Attendu : « Fermer », « Adopter le modèle EBIOS RM », « Révoquer l'accès de Pilote du processus infrastructure ».
- Reproductible par : à écrire (axe-core sur ces fenêtres).

### C6-08 — Configuration GRC : champ obligatoire non signalé

- Gravité : mineur
- Écran : `/parametres/configuration-grc` (Nouvel élément : échelle)
- Observé : nom, identifiant valide et deux niveaux saisis, « Créer le brouillon » reste désactivé. Rien n'indique que la
  catégorie (ou le périmètre, en portée « Un périmètre ») manque ; le bouton s'active dès qu'elle est choisie. Les
  autres refus sont clairs : identifiant « Gravité HDS » → « Format invalide. », doublon → « Cet identifiant existe
  déjà pour ce type d'élément. » (409).
- Attendu : champs obligatoires marqués, ou message au clic.
- Reproductible par : à écrire.

### C6-09 — Échelle limitée à un périmètre proposée aux méthodes d'un autre périmètre

- Gravité : mineur
- Écrans : Configuration du pilotage, Configuration GRC
- Référence : CAMPAGNE §5.3 (une donnée d'un périmètre n'apparaît pas sous l'autre)
- Observé : échelle « Disponibilité hébergement (fictive) » créée avec la portée « Un périmètre » / Hébergement HDS et
  publiée. Sous le périmètre principal, « Créer ISO 27005 » puis `cliquer combobox "Échelle de la dimension « Gravité
  »"` → elle est proposée. La liste « Échelle de vraisemblance » propose aussi des échelles de gravité, d'impact, de
  motivation et de ressources. La colonne « Portée » affiche « Périmètre » sans le nom. Cause visible dans le code :
  `SelecteurElement` (`apps/web/src/config-grc/commun.tsx`) ne filtre que sur la famille.
- Attendu : seules les échelles de l'organisation et du périmètre affiché, de la bonne catégorie.
- Reproductible par : à écrire.

### C6-10 — Publication d'une méthode sans retour ; « Méthode publiée » vide au rechargement

- Gravité : mineur
- Écran : Configuration du pilotage
- Observé : « Créer ISO 27005 », motif saisi, simulation, « Publier cette version », « Confirmer la publication » :
  aucun message de réussite. `GET /api/grc/<principal>/methods` montre la version 1. Après rechargement, « Méthode
  publiée » est vide (la méthode n'apparaît qu'en ouvrant la liste) et le périmètre garde `riskMethodId: null`.
- Attendu : « Méthode publiée (version 1) » affiché et sélectionné après la publication.
- Reproductible par : à écrire.

### C6-11 — « Dernière connexion » vide pour le compte créé à l'installation

- Gravité : mineur
- Écran : Utilisateurs, export de revue des accès
- Référence : ISO/IEC 27001:2022, A.5.18
- Observé : export CSV de revue des accès, ligne `rssi` : « Dernière connexion » vide alors que le compte avait une
  session ouverte depuis l'installation (`last_login_at: null`, `sessions: 1`). La valeur est renseignée après une
  connexion ordinaire.
- Attendu : la connexion qui suit l'enrôlement TOTP de l'installation est comptée.
- Reproductible par : à écrire.

### C6-12 — Revue des accès sans les accès aux périmètres

- Gravité : majeur
- Écrans : Utilisateurs, Droits effectifs, export « Revue des accès (ISO 27001 A.5.18) »
- Référence : ISO/IEC 27001:2022, A.5.15 et A.5.18 ; HDS (accès au périmètre d'hébergement)
- Observé : accès en écriture de `pilote.infra` au périmètre Hébergement HDS attribué dans Configuration du pilotage
  (journal `grc.membership.changed`). Ni la liste des comptes, ni « Droits effectifs », ni l'export CSV de revue des
  accès (colonnes Identifiant, Nom, E-mail, État, Double authentification, Groupes, Rôles, Droits effectifs, Dernière
  connexion, Expiration) ne mentionnent les périmètres accessibles.
- Attendu : la revue des accès indique, pour chaque compte, les périmètres lisibles et modifiables (c'est ce que
  l'auditeur HDS contrôle en premier).
- Reproductible par : à écrire.

### C6-13 — Journal d'audit peu lisible à l'écran

- Gravité : mineur
- Écran : Journal d'audit (`/systeme/journal`)
- Référence : ISO/IEC 27001:2022, A.8.15
- Observé : colonnes Date, Compte, Action, Cible, IP. Actions en codes (`grc.membership.changed`,
  `admin.user_password_reset`, `admin.session_revoke`), cibles en UUID pour un périmètre, un compte réinitialisé ou une
  session (préfixe d'identifiant technique). Le détail avant/après n'est visible que dans l'export CSV ou JSON. Points positifs : chaque
  action du RSSI est tracée avec son auteur, les exports sont eux-mêmes tracés (`admin.audit_export`), le verrouillage
  (`auth.account_locked`) et les échecs de double authentification sont journalisés.
- Attendu : libellés français, cible nommée, détail consultable à l'écran.
- Reproductible par : à écrire.

### C6-14 — Période inversée du journal sans message

- Gravité : remarque
- Écran : Journal d'audit
- Observé : `remplir "Du" "2026-11-13"`, `remplir "Au" "2026-11-01"`, Filtrer → « 0 entrée(s) affichée(s). »
- Attendu : « La date de fin précède la date de début. »
- Reproductible par : à écrire.

### C6-15 — Valeurs numériques corrigées en silence, parfois différentes de ce qui est affiché

- Gravité : majeur
- Écrans : Sécurité, Notifications, Conservation, Écrans muraux, Sauvegardes, Certificats et opérations, Courriel
- Référence : cohérence entre l'écran et la donnée ; ISO/IEC 27001:2022, A.5.17 et A.8.5 (réglages d'authentification)
- Observé :
  - Sécurité : « Échecs avant verrouillage du compte » saisi 0, affiché 0 au moment d'enregistrer, « Sécurité :
    enregistré. », mais `GET /api/settings/securite` → `lockoutThreshold: 3`. Longueur 8 ramenée à 12, inactivité 0
    ramenée à 5, sans message.
  - Notifications : 99999 affiché à l'enregistrement, 365 enregistré ; -3 ramené à 0.
  - Conservation : 0 jour ramené à 1 jour et enregistré.
  - Écrans muraux : durée 400 (aide « entre 1 et 365 ») ramenée à 365, écran créé.
  - Sauvegardes : fréquence 0 ramenée à 1 mois. Certificats et opérations : heure UTC 25 ramenée à 23, rétention 0 à
    1 jour (avant une confirmation, annulée). Courriel : port 70000 ramené à 65535.
  - Toutes les valeurs d'origine ont été remises après le test.
- Attendu : refus avec un message qui désigne le champ ; jamais un réglage de sécurité enregistré différent de celui
  qui est affiché.
- Reproductible par : à écrire (Sécurité : saisir 0 échec, enregistrer, relire l'API).

### C6-16 — Calendrier : année hors de propos acceptée

- Gravité : remarque
- Écran : Calendriers
- Observé : `remplir "Année" "1800"`, Prévisualiser → « 11 jour(s) à ajouter : … 08/05/1800 (Victoire 1945) …
  11/11/1800 (Armistice 1918) ». Les autres contrôles sont bons : calcul 2026 exact (Pâques 06/04, Ascension 14/05,
  Pentecôte 25/05), doublons détectés, iCalendar invalide refusé (« Ligne 1 : … BEGIN:VCALENDAR attendu »).
- Attendu : année bornée (par exemple autour de l'année en cours).
- Reproductible par : à écrire.

### C6-17 — Écran mural sans choix de périmètre

- Gravité : mineur
- Écran : Écrans muraux
- Référence : HDS (affichage dans la salle d'hébergement) ; la carte annonce « jeton, périmètre et contenu »
- Observé : le formulaire n'a que nom, durée et modules ; aucun champ de périmètre (`apps/api/src/walls.ts` n'en
  contient pas). Un écran installé dans la salle d'hébergement affichera tous les périmètres.
- Attendu : choix du périmètre affiché, ou carte corrigée.
- Reproductible par : à écrire.

### C6-18 — L'application signale comme inconnus des champs de son propre export

- Gravité : mineur
- Écran : Import et export
- Observé : « Exporter au format legacy » (schéma 15, empreinte sha256), puis dépôt de ce fichier et « Simuler
  l'import » (fusion) → résultat cohérent (0 création, 0 mise à jour, 175 inchangés), mais avertissement « Champs
  inconnus du contrat (32) Ces champs sont conservés tels quels : $.hdsChap $.hdsChap.HDS-01 … ». Import Tenacy d'un
  faux `.xlsx` : « XML manquant ou entités externes interdites. » (refus juste, message technique).
- Attendu : un export réimporté sans avertissement ; message « Le fichier n'est pas un classeur Excel valide ».
- Reproductible par : à écrire (aller-retour export legacy → simulation).

### C6-19 — Réglage « Format par défaut de la revue des accès » sans effet

- Gravité : remarque
- Écran : Import et export
- Observé : réglage enregistré (`formatRevue: csv`), mais il n'est lu nulle part ailleurs (`apps/web/src/pages/Settings.tsx`
  seulement) ; Utilisateurs propose toujours Excel et CSV. Remis à Excel.
- Attendu : réglage utilisé ou retiré.
- Reproductible par : à écrire.

### C6-20 — Exécutant d'exploitation indisponible sur la pile Docker : sauvegarde, mise à jour et certificats impossibles

- Gravité : majeur, **à confirmer en phase 3** (cause : pile de `lancer.sh` ou application)
- Écrans : Sauvegardes et restauration, Mises à jour et versions, Certificats et opérations, Courriel, onglet Système
- Référence : ISO/IEC 27001:2022, A.8.13 (sauvegarde) ; scénario, étape 17
- Observé : 40 minutes après l'installation, « Exécutant serveur indisponible », « Demander une sauvegarde » désactivé ;
  `GET /api/admin/sauvegardes` → `"worker":{"available":false,"seenAt":null,"message":"Exécutant serveur non
  configuré."}` ; clé de secours « En attente de l'exécutant » (l'écran annonce « sous une minute ») ; « Le service de
  mise à jour est indisponible. » ; « Pilotage serveur indisponible » et « Métadonnées du certificat indisponibles ».
  Le service `updater` fait partie de `docker-compose.yml` ; Docker n'a pas été inspecté (hors du mandat de l'agent).
- Attendu : sur une installation Docker standard, l'exécutant répond et la première sauvegarde chiffrée est possible
  depuis l'écran.
- Reproductible par : à écrire (pile neuve, `GET /api/admin/sauvegardes` après une minute).

### C6-21 — Date du dernier test de restauration dans le futur acceptée : l'alerte disparaît

- Gravité : majeur
- Écran : Sauvegardes et restauration
- Référence : ISO/IEC 27001:2022, A.8.13 ; guide d'installation, étape 11.4 (cité par l'écran)
- Observé : `remplir "Date du dernier test de restauration" "2027-12-01"`, Enregistrer → « Sauvegardes : enregistré. »,
  `info: {"prochainTest":"2028-01-01","enRetard":false}` : l'alerte « Test de restauration à faire » ne s'affiche plus.
  Un emplacement relatif (« relatif/pas-absolu ») est aussi accepté. Valeurs d'origine remises.
- Attendu : date postérieure à aujourd'hui refusée ; chemin absolu exigé.
- Reproductible par : à écrire.

### C6-22 — Versions de l'état toutes vides : télécharger ou restaurer une version ne rend rien

- Gravité : majeur, **à confirmer** (restauration non exécutée sur la pile)
- Écran : Mises à jour et versions (« Versions de l'application »), onglet Versions de `/admin`
- Référence : ISO/IEC 27001:2022, 7.5.3 ; AGENTS.md (aucune promesse que l'outil ne tient pas)
- Observé : les réglages ont créé les versions v2 à v7 (« Paramètres : cycle », « Paramètres : referentiels »).
  `GET /api/admin/versions` → chaque version `bytes: 5`, `items: 0`, même `sha256` ; `GET /api/admin/versions/1`, `/2`,
  `/7` → `{}`. L'écran propose pourtant « Télécharger » et « Restaurer » (« Restaurer la version 4 ? L'état actuel
  restera disponible dans l'historique. », annulé). La zone est nommée « Versions de l'application » alors qu'il s'agit
  de versions de données.
- Attendu : versions qui contiennent l'état qu'elles datent, ou écran retiré ; libellé « Versions des données ».
- Reproductible par : à écrire (`GET /api/admin/versions` après une modification de réglage).

### C6-23 — Module désactivé : l'adresse directe affiche un titre seul

- Gravité : mineur
- Écran : Modules (effet sur `/pilotage/fournisseurs`, tranche 1)
- Observé : Fournisseurs désactivé (aperçu des conséquences, saisie VALIDER) : menu masqué, API bloquée (409 « Ce
  module est désactivé. »). `ouvrir /pilotage/fournisseurs` → titre « Fournisseurs de l'organisation » et sélecteur
  de périmètre, rien d'autre. Module réactivé ensuite (`GET /api/modules` : `disabled: []`).
- Attendu : « Ce module est désactivé par l'administrateur. »
- Reproductible par : à écrire.

### C6-24 — Détails techniques : migrations absentes, volumétrie en JSON brut

- Gravité : mineur
- Écran : Détails techniques
- Observé : ligne « Migrations appliquées » vide, alors que `GET /api/admin/info` en liste 54 ; « Volumétrie »
  affichée `{"users":6,"documents":0,"links":0,"versions":7,"audit":129,"imports":0}` ; « Modules repris de
  l'ancienne interface » en clés techniques ; unités mêlées « 14 MB » et « 14 Mo ».
- Attendu : nombre et dernière migration, volumétrie en tableau français.
- Reproductible par : à écrire.

### C6-25 — Guide d'utilisation sans rubrique sur l'installation et les secrets

- Gravité : mineur
- Écran : `/aide`
- Observé : « Documentation 2026-10-30 ». Recherche « poivre », « clé de secours », « verrouill » → « Aucun article ne
  correspond à votre recherche. » Le guide renvoie à « Paramètres > Apparence » et « Dans Administration » alors que le
  menu dit Plateforme et Configuration système.
- Attendu : rubriques sur le poivre, la clé de secours, le verrouillage et la reprise ; chemins du menu actuel.
- Reproductible par : à écrire.

## Défauts connus reconfirmés / non reproduits

- **BUG-018 reconfirmé sur les briques réelles, et plus large que décrit** : « Toggle password visibility » sur
  l'installation (« Votre poivre », « Mot de passe », « Confirmation »), l'écran de changement du mot de passe
  temporaire à la première connexion (trois champs), Mon compte (quatre champs), Courriel (mot de passe SMTP) et
  Sécurité (« Ancien poivre »). L'écran de connexion, lui, a « Afficher la saisie ».
- **BUG-017, partie « à part »** : le tableau de bord d'une installation neuve affiche « 0 % Moyenne des référentiels »
  sur trois référentiels alors que rien n'est évalué (vu en passant, hors tranche).
- Les autres défauts BUG-016 à BUG-037 portent sur des écrans d'autres tranches et n'ont pas été rejoués ici.

## Signalements pour d'autres tranches

- Tranche 3, `/pilotage/referentiels` : le lien « Consulter le référentiel historique » mène à `/legacy/`, qui répond
  « Page introuvable » (écran retiré, ADR 0042).
- Tranche 1, `/pilotage/fournisseurs` : voir C6-23.

## Ce qui fonctionne et a été vérifié

Installation (chaque secret exige la recopie de sa fin, jeton faux refusé et tracé, `/setup` fermé ensuite) ; première
connexion d'un compte (TOTP, puis changement imposé du mot de passe temporaire) ; verrouillage après 5 échecs, message
générique sans énumération des comptes, alerte au RSSI avec heure de Paris, déverrouillage par l'administrateur ;
fermeture des sessions à la déconnexion et révocation d'une session ; rôles prédéfinis non modifiables, duplication et
matrice d'un rôle, compteurs d'attribution exacts ; groupes, fonctions, types de processus, calendriers fériés ;
destinataires des notifications résolus par groupe avec signalement des comptes sans adresse ; activation des modules
avec contrôle des dépendances ; refus des opérations sensibles avec un code TOTP faux (poivre, clé de secours, adresse
du site) ; aucune erreur JavaScript, CSP ou HTTP 5xx relevée par le pilote ; aucun mot de passe ni clé privée dans les
5 000 dernières entrées des journaux techniques.

## Outillage de recette (hors application)

`pilote.mjs api` échoue sur les piles Docker (« unable to get local issuer certificate ») : le contexte de requêtes de
Playwright ne fait pas confiance à l'autorité locale de Caddy. Contournement sans désactiver TLS : exporter
`NODE_EXTRA_CA_CERTS` vers le certificat racine de la pile
(`/srv/suivi-rssi-virtuel-N/donnees/caddy/data/caddy/pki/authorities/local/root.crt`). À intégrer à `lancer.sh` ou au
pilote. Le pilote n'envoie pas non plus d'en-tête `If-Match` : la remise d'un réglage par l'API a demandé un script
d'appoint.

## État de la pile laissée pour la phase 2

- Comptes (identifiants seulement ; secrets TOTP et mots de passe temporaires dans `.pilote-6/comptes.json`) :
  `rssi` (Administrateur, TOTP enrôlé), `dpo.fictif` et `pilote.infra` (Contributeurs, mot de passe temporaire,
  première connexion à faire), `auditeur.interne` et `direction` (Lecteurs, première connexion à faire),
  `test6-verrou` (Lecteur, TOTP enrôlé, mot de passe `PASSWORD` de `helpers.ts`, déverrouillé).
- Périmètres : « SMSI Groupement Santé Fictif » (principal) et « Hébergement HDS » (rattaché, héritage des
  référentiels) ; `pilote.infra` a l'écriture sur Hébergement HDS.
- Données laissées : coordonnées et logo fictifs, cycle 2026-2029, groupe « Cellule SSI (fictive) », quatre fonctions,
  rôle « Auditeur interne (lecture et export) », type de processus « Hébergement de données de santé », calendrier des
  jours fériés 2026-2027, échelles « Gravité HDS (fictive) » et « Disponibilité hébergement (fictive) », modèle SR/OV
  adopté, méthode ISO 27005 publiée (principal) et EBIOS RM publiée (Hébergement HDS), écran mural « Salle
  d'exploitation HDS (fictive) » en attente d'activation, courriel de `dpo.fictif`.
- Réglages remis à leur valeur d'origine, sauf la catégorie NIS 2 restée « Entité importante » (C6-05).

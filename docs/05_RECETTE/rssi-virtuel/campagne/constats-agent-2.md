# Constats de l’agent 2 : risques (méthode, appréciation, traitement, EBIOS RM)

| Élément | Valeur |
|---|---|
| Commit testé | `2e63e86` (branche `claude/recette-rssi-2026-11-12`, version du dépôt 6.3.0) |
| Date | 12/11/2026, 20:58 à 21:40 (Europe/Paris) |
| Pile | `https://127.0.0.12`, pile Docker éphémère n° 2 (PostgreSQL 18, Node 26), vierge au premier contact (`GET /api/setup` : `needed:true`, `adminExists:false`) |
| Version affichée | `GET /api/version` : `local`, dernière migration `054_retrait_revues_acces.sql` |
| Compte | `rssi` (Administrateur), créé à l’installation ; aucun autre compte créé |
| Périmètres | principal « SMSI Groupement Santé Fictif » (racine renommée), sous-périmètre « Hébergement HDS » (rattaché, héritage des référentiels coché) |
| Données | jeu fictif uniquement (`organisation-fictive.json`) |
| Matrice | tranche 2 : 42 cases, **13 ok, 28 défaut, 1 sans objet, 0 non testée** (`matrice.mjs bilan`) |

Outillage : le pilote (`pilote.mjs`) a servi pour la navigation, l’arbre d’accessibilité, les captures et l’API. La
commande `pilote.mjs api` échouait sur le certificat de l’autorité locale de Caddy (« unable to get local issuer
certificate ») : la racine publique de cette autorité, lue dans le dossier de la pile, a été donnée à Node par
`NODE_EXTRA_CA_CERTS` (vérification TLS conservée). Les clics dans une ligne ou une région précise (le pilote clique le
premier élément d’un nom donné) ont été faits par un petit script Playwright relié au même Chrome (CDP, port 9335),
gardé dans le bloc-notes de la session, hors du dépôt. Aucune erreur JavaScript ni CSP relevée ; les seules réponses
HTTP en erreur sont les 4xx décrites ci-dessous.

## Écrans couverts

Sous chaque périmètre, états vide, rempli et erreur :

| Écran | Principal | Sous-périmètre HDS |
|---|---|---|
| Registre des risques | R-01 à R-04 du jeu fictif, R-05 issu d’EBIOS RM ; appréciations v1 (jugement) et v2 (matrice) ; acceptation ; archivage d’un doublon | HDS-R-01, HDS-R-02 avec méthode propre (matrice épinglée) |
| Opportunités | 1 opportunité reliée à R-04, état modifié | 1 opportunité |
| Études EBIOS RM | étude complète (ateliers 1 à 5, suivi, chemins) | étude, source de bibliothèque, couple |
| Cartographie des risques | vues liens et matrice, brut et résiduel, 4 exports | vues liens et matrice, filtre de date |
| Traitements | T-01 à T-04 (mesures du jeu fictif), modification, action générée | T-HDS-01 |
| Scénarios et actifs | 1 valeur métier, 4 biens supports | 1 valeur métier, 1 bien support |
| Configuration des analyses | 2 modèles adoptés, erreurs de format et de doublon, brouillon supprimé | échelle de portée « Un périmètre » publiée |

Types d’objets créés : `risk`, `risk_source`, `feared_event`, `business_asset`, `support_asset`, `strategic_scenario`,
`operational_scenario`, `treatment`, `risk_study`, `sr_ov`, `ecosystem_party`, `opportunity`. Modifiés : `risk`
(méthode, appréciation, acceptation), `treatment` (version 2), `opportunity` (état). Liés : risque ↔ actifs, traitement ↔
risque et mesures, opportunité ↔ risque, action ↔ traitement, objets EBIOS entre eux. Supprimés : seul `risk` (archivage
du doublon créé pour le test) et un brouillon d’échelle ; les autres types n’offrent pas la suppression (C2-10).
Exportés : carte (SVG, PNG, PDF, JSON), « Rapport de pilotage / audit » (HTML et JSON) ; aucun export des autres
types (C2-05).

Vérifications de cohérence faites et conformes :

- Niveau brut recalculé depuis les échelles, méthode v2 du principal et méthode du sous-périmètre (matrice
  `matrice_risque_ebios_rm` épinglée) : G4×V3 = Élevé, G4×V1 = Moyen, G3×V3 = Élevé, G3×V1 = Faible, G2×V2 = Faible,
  conformes aux cellules de la matrice publiée (`GET /api/config-grc/items/<matrice>/versions/1`).
- Carte des risques = registre (`GET /api/grc/<périmètre>/risks/register`) sous chaque périmètre, en brut et en
  résiduel, y compris après le changement de version de méthode de R-01 ; aucune donnée d’un périmètre visible sous
  l’autre (registre, carte, actifs proposés, traitements, opportunités, études).
- EBIOS RM : pertinence SR/OV proposée par la matrice (+++ × +++ = Élevée), alerte quand l’analyste s’en écarte ; indice de
  menace de la partie prenante 2.25 = (3 × 3) / (2 × 2) ; gravité du scénario stratégique reprise de l’événement redouté.
- Traçabilité : le risque montre ses actifs, son traitement et l’opportunité liée ; l’action générée depuis T-01 porte la
  relation « Met en œuvre » ; versions et historique de la fiche traitement tenus.
- Invariants (`pilote.mjs invariants`) : INV-01 à INV-08 OK sur l’état laissé en place.

## Cases non couvertes

Aucune case de la tranche n’est non testée. Une case est `sans-objet` : Configuration des analyses, sous-périmètre, vide
(le catalogue de portée Organisation est commun à tous les périmètres ; sous HDS il montre ce qui a été adopté depuis le
principal, l’état vide n’existe pas séparément ; voir C2-16). L’état vide de la carte sous le périmètre principal a été
observé par une recherche sans résultat, le registre étant déjà rempli lors de la première ouverture de la carte.

## Constats

### C2-01 — « Stratégie » affiche « Réduire » mais envoie une valeur vide ; refus en termes techniques
- Gravité : majeur
- Écran : Registre des risques, fiche « Créer — Risque » (principal)
- Référence : ISO/IEC 27001 6.1.3 a) (choix de l’option de traitement), ergonomie (AGENTS.md : messages en français)
- Observé : formulaire neuf, « Stratégie » pré-rempli « Réduire » ; `pilote.mjs choisir "Stratégie" "Réduire"` (l’utilisateur
  rouvre la liste et reclique la valeur affichée). Arbre après coup : `combobox "Stratégie": Réduire`. « Enregistrer la
  fiche » envoie `"strategy":null` (corps de la requête relevé) et reçoit 422 : « Erreur Données invalides — strategy :
  Option invalide : une valeur parmi "reduce"|"accept"|"transfer"|"avoid"|"treated" attendue ». Reproduit deux fois. Même
  mécanisme sur « Méthode publiée » : la reclicker la vide, puis « methodId : Entrée invalide : chaîne de caractères
  attendu, null reçu ».
- Attendu : la valeur affichée est celle qui est enregistrée ; si un champ manque, le message le nomme en français
  (« Choisissez une stratégie de traitement »).
- Reproductible par : à écrire (fiche risque, re-sélection de la stratégie, assertion sur le corps de la requête).

### C2-02 — Erreur d’enregistrement de la fiche risque affichée hors de vue
- Gravité : mineur
- Écran : Registre des risques, fiche risque (principal et HDS)
- Référence : ergonomie (retour clair après chaque action)
- Observé : après « Enregistrer la fiche » (bouton en bas de la fenêtre), l’alerte d’erreur est en haut de la fenêtre :
  `boundingBox` de l’alerte `y = -3166` par rapport à la fenêtre d’affichage, `inView: false` ; la capture
  `c2-strategie-desync.png` ne montre aucun message, l’utilisateur croit que rien ne s’est passé.
- Attendu : défilement vers l’erreur ou message à côté du bouton, champ fautif mis en évidence.
- Reproductible par : à écrire.

### C2-03 — Un risque jamais apprécié peut être formellement accepté
- Gravité : majeur
- Écran : Registre des risques, « Décider de l’acceptation » (principal)
- Référence : ISO/IEC 27001 6.1.2 d) et e), 6.1.3 f) (acceptation des risques résiduels), 8.3
- Observé : risque « Doublon de code (test) », option « Accepter », colonne « Brut » = « Non apprécié ». « Décider de
  l’acceptation » → date, échéance 2027-11-12, justification, case de confirmation → enregistré : ligne « Non apprécié — Accepter
  Acceptée jusqu’au 12/11/2027 », historique « Version 2 ». Aucune alerte.
- Attendu : acceptation refusée (ou au moins signalée) tant que le risque n’a pas d’appréciation enregistrée ; un auditeur
  relèverait une acceptation sans niveau de risque comparé aux critères.
- Reproductible par : à écrire (risque sans appréciation, POST de la décision d’acceptation attendu en refus).

### C2-04 — Code de risque en doublon accepté sans alerte
- Gravité : mineur
- Écran : Registre des risques (principal)
- Référence : ISO/IEC 27001 7.5.2 (identification), 6.1.2 (résultats comparables)
- Observé : création d’un second risque avec le code « R-01 » : enregistré ; le registre affiche deux lignes « R-01 · … ».
  (Fiche archivée ensuite : « Confirmer l’archivage » fonctionne et retire la ligne.)
- Attendu : refus ou avertissement « Le code R-01 est déjà utilisé dans ce périmètre ».
- Reproductible par : à écrire.

### C2-05 — Registre des risques, plan de traitement et études EBIOS RM non exportables
- Gravité : majeur
- Écrans : les sept écrans de la tranche ; « Exports Excel » (`/exports`) et « Import et rapports » (agent 5) pour vérification
- Référence : ISO/IEC 27001 6.1.2 e), 6.1.3 e) (plan de traitement), 8.2, 8.3 (conserver les résultats en information documentée)
- Observé : aucun bouton d’export sur le registre, les traitements, les opportunités, les études, les actifs (seule la carte
  exporte, C2-11). « Excel classique : export complet » et « Excel pro : export complet » : 28 feuilles (DdA, écarts,
  actions, fournisseurs…), aucune feuille de risques, de traitements ni d’EBIOS RM (`unzip -p … xl/workbook.xml`).
  « Rapport de pilotage / audit » : section « Registre et décisions de risques » présente, mais aucun traitement (« T-01 »
  absent du JSON) et valeurs brutes (C2-06).
- Attendu : export lisible du registre, des appréciations, du plan de traitement et des livrables EBIOS RM, remis tel quel à
  un auditeur.
- Reproductible par : à écrire (feuilles du classeur d’export complet).

### C2-06 — Codes anglais et valeurs techniques hors de l’historique des décisions (extension de BUG-023)
- Gravité : majeur
- Écrans : Cartographie des risques, Études EBIOS RM (atelier 5), rapport de pilotage, éditeur de méthode (`/pilotage/configuration`, agent 6)
- Référence : ISO/IEC 27001 7.5 (information documentée lisible), AGENTS.md (interface en français)
- Observé : légende de la carte « Modéré · conditional », « Élevé · unacceptable », méthode désignée « publication b6fcedd4 »
  au lieu de « version 1 » ; atelier 5 « Option : reduce » ; rapport HTML « conditional reduce … draft rssi
  2026-11-12T20:10:38.070636+00:00 » ; éditeur de méthode : « Acceptabilité » en texte libre « acceptable / conditional /
  unacceptable », « Mode » = « judgement », boutons nommés « Retirer configuration.dimensions 1 »,
  « Retirer configuration.likelihood 1 ».
- Attendu : libellés français partout (acceptable, sous conditions, inacceptable ; réduire ; brouillon), dates au format
  français, versions de méthode par numéro.
- Reproductible par : à écrire ; à fusionner avec BUG-023 à la consolidation si la cause est commune.

### C2-07 — Choix des mesures d’un traitement sans référence, avec doublons et textes tronqués
- Gravité : majeur
- Écrans : Traitements (« Mesures de sécurité (mesures, DdA) »), Études EBIOS RM (partie prenante, « Mesures associées (références) »)
- Référence : ISO/IEC 27001 6.1.3 b) et c) (comparaison avec l’annexe A), traçabilité traitement → mesure
- Observé : 160 options sans numéro (« Sauvegarde des informations » au lieu de « A.8.13 ») mélangeant clauses 4 à 10,
  annexe A et exigences HDS ; « Généralités » trois fois, « Appréciation des risques de sécurité de l’information » et
  « Traitement des risques… » deux fois chacune (6.1.2 et 8.2, 6.1.3 et 8.3 indiscernables) ; exigences HDS tronquées
  (« Conformément au 1° de l’article R.1111-11 du CSP, le contrat d’hébergement conclu entre l’Hébergeur et son… », dix
  options commencent ainsi). Les références choisies (`legacy:items:A-8.13`) n’apparaissent pas non plus dans l’onglet
  « Liens et justificatifs » du traitement (seul le risque y figure).
- Attendu : chaque option préfixée de sa référence (A.8.13, 8.2, HDS …), regroupée par référentiel ; mesures liées
  visibles dans les liens du traitement.
- Reproductible par : à écrire.

### C2-08 — Sous-périmètre : aucune mesure proposée pour un traitement
- Gravité : majeur
- Écran : Traitements, périmètre « Hébergement HDS »
- Référence : ISO/IEC 27001 6.1.3 b) à d), HDS v2 (DdA du périmètre HDS), traçabilité
- Observé : « Ajouter un traitement » sous HDS : liste « Mesures de sécurité (mesures, DdA) » ouverte : 0 option, 0 listbox,
  y compris en tapant « Sauvegarde » (capture `hds-mesures-vides.png`). Sous le principal, la même liste propose 160 mesures.
  `GET /api/grc/<HDS>/framework-attachments` → `[]` ; les options du principal viennent du registre historique
  (`legacy:items:…`), comme pour BUG-037.
- Attendu : sous un sous-périmètre qui hérite des référentiels du parent, les mesures de l’annexe A et HDS sont proposées.
- Reproductible par : à écrire.

### C2-09 — EBIOS RM : scénario opérationnel G4 × V2 non placé dans la matrice de l’étude
- Gravité : majeur
- Écran : Études EBIOS RM, onglet « Suivi, matrice et cercle » (principal)
- Référence : ISO/IEC 27001 6.1.2 d) (niveaux de risque), cohérence des chiffres
- Observé : étude avec échelles publiées épinglées (`gravite_ebios_rm`, `vraisemblance_ebios_rm`) ; SO-01 « G4 — Critique »
  × « V2 — Vraisemblable ». La matrice gravité × vraisemblance de l’onglet est entièrement vide et l’écran indique « Non
  placés dans la matrice (gravité ou vraisemblance sans rang de 1 à 4) : 1. SO-01 … » ; le cercle affiche pourtant les deux
  niveaux. Cause probable : les niveaux des échelles publiées s’appellent `g4`, `v2` et non 1 à 4.
- Attendu : SO-01 placé dans la case G4 / V2.
- Reproductible par : à écrire (étude avec échelles épinglées, contrôle de la case).

### C2-10 — Traitements, actifs, sources, opportunités : ni archivage ni suppression
- Gravité : majeur
- Écrans : Traitements, Scénarios et actifs, Opportunités, Études EBIOS RM (fiches génériques)
- Référence : ISO/IEC 27001 7.5.3 (maîtrise, retrait des informations obsolètes)
- Observé : fiche « Opportunité à supprimer (test) » : boutons `["", "Fermer", "Enregistrer"]`, menu « Autres actions » =
  « Décisions et réalisations » seulement ; mêmes boutons dans les fiches traitement et valeur métier. Seule la fiche risque
  a « Archiver la fiche ». L’opportunité de test est donc restée en place.
- Attendu : archivage (avec historique conservé) sur tous les types d’objets du registre.
- Reproductible par : à écrire.

### C2-11 — Exports de la carte : pictogrammes noirs, nom de fichier trompeur, JSON sans niveaux
- Gravité : mineur
- Écran : Cartographie des risques (principal)
- Référence : ISO/IEC 27001 7.5 (information documentée exploitable)
- Observé : « Exporter SVG / PNG / PDF / JSON » → `Cartographie_contexte_20261112-2013.*` ; dans le SVG, chaque
  pictogramme est `<rect … rx="10" fill="rgb(0, 0, 0)"/>` (carrés noirs, visibles dans le PNG et le PDF relus) ; le JSON
  est un `smsi-map-layout` (positions des nœuds) sans niveau ni acceptabilité ; en vue « Matrices et niveaux par méthode »,
  plus aucun bouton d’export.
- Attendu : pictogrammes rendus, fichier nommé « Cartographie_des_risques… », export de la vue matrice.
- Reproductible par : à écrire.

### C2-12 — Carte des risques vide sans message
- Gravité : mineur
- Écran : Cartographie des risques (principal et HDS)
- Référence : ergonomie
- Observé : sous HDS avant saisie, avec une recherche « zzz-inexistant » sous le principal, et avec « Appréciations au »
  01/01/2020 : canevas blanc (capture `carte-vide-hds.png`, `carte-hds-date-2020.png`), aucun texte « aucun risque »,
  boutons d’export actifs.
- Attendu : message « Aucun risque à afficher pour ces critères » et lien de création.
- Reproductible par : à écrire.

### C2-13 — « Enregistrer » grisé sans désigner le champ obligatoire
- Gravité : mineur
- Écrans : Traitements, Opportunités, Scénarios et actifs, Études EBIOS RM (fiches génériques) ; décision d’acceptation
- Référence : ergonomie ; même famille que BUG-025 (autres formulaires)
- Observé : « Intitulé » vide ou fait d’espaces : bouton « Enregistrer » `[disabled]`, champ sans `required` ni
  `aria-required`, aucun astérisque, aucun message (principal et HDS). Décision d’acceptation : « Confirmer
  l’enregistrement » reste grisé tant que « Échéance de l’acceptation » est vide, champ présenté comme une simple aide.
- Attendu : champ marqué obligatoire et message qui le nomme.
- Reproductible par : à écrire.

### C2-14 — EBIOS RM : libellés techniques au lieu des noms, catégories et échelles mal guidées
- Gravité : mineur
- Écran : Études EBIOS RM (principal et HDS)
- Référence : traçabilité, ergonomie
- Observé : « Étude EBIOS RM : Référence déjà liée » dans les fiches événement redouté et source de risque, « Source de
  risque : Référence déjà liée » dans le couple créé depuis la bibliothèque ; synthèse de l’atelier 1 « valeur métier :
  Élément lié » ; option « instance » dans « Processus, périmètre ou valeurs métier étudiés » ; source de catégorie
  « Crime organisé » marquée « (pictogramme indicatif : Catégorie non reconnue) » alors que l’aide du champ cite « crime
  organisé » ; les listes d’échelles des ateliers 3 et 4 proposent toutes les échelles (Motivation, Ressources…), et celle
  de l’atelier 2 la matrice de risque ; « Créer le risque » reste proposé sur SO-01 après création de R-05, et les biens
  supports du scénario ne sont pas repris dans le risque.
- Attendu : nom de l’objet lié affiché ; catégories reconnues sans tenir compte de la casse ; listes filtrées par catégorie.
- Reproductible par : à écrire.

### C2-15 — Accessibilité : boutons sans nom et noms en double
- Gravité : mineur
- Écrans : Registre (appréciation), Configuration des analyses, Traitements
- Référence : AGENTS.md (accessibilité, RGAA)
- Observé : bouton de fermeture annoncé `button: img` (sans nom) dans « Appréciation — … », « Nouvel élément : échelle »,
  « Générer une action de traitement », « Publier la version 1 », « Supprimer le brouillon » (et « Modifier le
  périmètre », hors tranche) ; boutons « Ouvrir la fiche », « Liens et preuves » et « Générer une action de traitement »
  répétés sans le nom de la fiche ; dans l’appréciation, deux listes « Gravité » et deux « Vraisemblance » (brut et
  résiduel) de même nom ; cinq champs « Analyse et justification » dans la fiche risque (déjà cité par BUG-025).
- Attendu : chaque bouton nommé (« Fermer »), nom contextualisé (« Ouvrir la fiche T-01 … »), « Gravité brute » /
  « Gravité résiduelle ».
- Reproductible par : à écrire (axe-core sur ces fenêtres).

### C2-16 — Configuration des analyses : sélecteur de périmètre sans effet, fenêtre non réinitialisée
- Gravité : mineur
- Écran : Configuration des analyses (principal et HDS)
- Référence : ergonomie, cohérence entre périmètres
- Observé : échelle « Besoin de disponibilité HDS (fictif) », portée « Un périmètre » = Hébergement HDS, publiée ; sous
  « Périmètre affiché : SMSI Groupement Santé Fictif », elle reste listée, colonne « Portée » = « Périmètre » sans dire
  lequel. Après un refus de doublon puis « Annuler », « Nouvel élément : échelle » rouvre avec la catégorie, les niveaux
  « Bas Haut » et l’alerte « Cet identifiant existe déjà… » précédents. Après « Supprimer le brouillon », aucun message
  et un GET de l’élément supprimé en 404. Après adoption, le bouton « Adopter ce modèle » est inchangé (la réadoption est
  refusée proprement). L’aide de l’étude renvoie à « Paramètres → Configuration GRC → Modèles », alors que les modèles
  sont sous « Configuration des analyses → Modèles ».
- Attendu : filtre par périmètre ou mention explicite du périmètre ; fenêtre vide à chaque ouverture ; confirmation après
  suppression ; modèle marqué « adopté ».
- Reproductible par : à écrire.

### C2-17 — Synthèse : 7 risques et 5 risques sur le même écran (autre tranche)
- Gravité : majeur
- Écran : Pilotage → Synthèse, périmètre principal (case de l’agent 1, signalée ici)
- Référence : cohérence des chiffres (grille de l’agent), 9.1
- Observé : capture `synthese-principal.png` : carte « Risques et continuité » « 7 risques, 7 sans appréciation validée »
  et, plus bas, anneau « Risques : 5 risques, À valider 5 » (`img "Risques : Appréciation validée : 0, À valider : 5"`).
  Le registre compte 5 risques sous le principal et 2 sous HDS : la première carte additionne le sous-périmètre sans le dire.
  Le tableau de bord affiche aussi 7 ; la pastille du menu « Risques » vaut « 7 risques sans décision » quel que soit le
  périmètre affiché.
- Attendu : même périmètre de calcul pour tous les indicateurs d’un écran, ou mention « y compris les sous-périmètres ».
- Reproductible par : invariant à écrire (somme du registre par périmètre = indicateurs de la synthèse).

### C2-18 — Remarques
- Gravité : remarque
- Liste des traitements : seulement l’intitulé et la version, sans stratégie, risque, mesures, responsable ni échéance : le
  plan de traitement (6.1.3 e) n’est pas lisible d’un coup d’œil.
- Historique des fiches : « Version 2 · Modification » sans le détail de ce qui a changé.
- Option de traitement « Traité » proposée à côté de réduire, accepter, transférer, éviter (c’est un état, pas une option).
- Registre vide : « Aucun risque ne correspond. » laisse croire à un filtre ; ordre des lignes par date de modification
  (R-02, R-04, R-03, R-01), pas par code ; aucun moyen de voir les risques archivés.
- Le sous-périmètre HDS n’hérite pas de la méthode d’appréciation du parent (il faut en publier une seconde).
- Méthode : aucune confirmation après « Confirmer la publication » ni après « Utiliser pour les nouveaux risques », la
  liste « Méthode publiée » reste vide (écran de l’agent 6).
- Opportunités rattachées à « l’article 6.1 (ISO 9001:2015) » seulement, alors que 6.1.1 de l’ISO/IEC 27001 les vise aussi ;
  « Ajouter opportunité » sans article.
- En-tête générique « Qualité, sécurité et référentiels : pilotez vos travaux… » et aide « Les accès existants sont
  conservés. » sous « Périmètre affiché » sur tous les écrans : n’expliquent rien.
- Indice de menace « 2.25 » avec un point décimal ; en-tête de matrice « Probabilité » alors que l’échelle s’appelle
  « Vraisemblance ».
- Installation : après la saisie du code TOTP, l’écran « Connexion » s’est affiché un instant, puis le tableau de bord
  (la clé de sécurité facultative n’a pas été proposée sur une adresse IP) : à vérifier par l’agent 6.

## Défauts connus reconfirmés / non reproduits

| Défaut | Résultat sur la pile Docker (PostgreSQL 18, Node 26) |
|---|---|
| BUG-022 | **Reconfirmé**, sous les deux périmètres : « Méthode publiée » vide, « Données invalides — methodId : UUID invalide » (422). |
| BUG-023 | **Reconfirmé** : « Décisions conservées » en JSON (`{"gross":{"color":"#718975","label":"Faible","level":"low",…`), « Méthode conservée : … · draft », simulation « Brut : Élevé · unacceptable ». Étendu à d’autres écrans : C2-06. |
| BUG-024 | **Reconfirmé** avec la méthode ISO/IEC 27005 du modèle (jugement) : « Critique » × « Probable » → « Faible » accepté, « Brut : Faible · acceptable », filtre « Écart avec la matrice » vide. Constat pour l’arbitrage : en épinglant une matrice du catalogue (version 2 de la méthode), le niveau n’est plus choisi mais calculé, et le calcul est juste ; le registre signale alors « Matrice courante non comparable » pour l’appréciation v1. Non tranché. |
| BUG-025 | **Reconfirmé** : « Approbation humaine » → « Validez toutes les étapes avant d’approuver l’appréciation. » (409) ; « Validation — Contexte et critères » à « Validée » → « Complétez les champs obligatoires avant de valider. » (422), sans champ désigné. Dans la fiche de création, les « Analyse et justification » portent désormais un astérisque. |
| BUG-026 | **Reconfirmé** (DdA de l’agent 3, signalé seulement) : T-01 relié à A.8.13 ; `GET …/links?ref=legacy:items:A-8.13` renvoie bien la relation entrante de T-01, mais la fiche A.8.13 de « Annexe A (DdA) » garde « Risques traités » vide (texte libre). Les mesures ne figurent pas non plus dans les liens du traitement (C2-07). |
| Non reproduits | aucun |

## État laissé pour la phase 2

- Compte : `rssi` (Administrateur) seulement ; identifiant et secret TOTP dans `tests/e2e/rssi-virtuel/.pilote-2/comptes.json`
  (ignoré par Git). Chrome du pilote ouvert (port 9335), pile en marche.
- Principal : méthode ISO/IEC 27005 v1 et v2 (v2 active, matrice EBIOS RM épinglée) ; R-01 à R-05 (R-01 en v2) ; T-01 à
  T-05 ; une action « Mettre en œuvre : T-01 … » ; deux opportunités (dont « Opportunité à supprimer (test) », impossible à
  supprimer, C2-10) ; une valeur métier, quatre biens supports ; étude EBIOS RM complète ; un risque « Doublon de code
  (test) » archivé.
- Hébergement HDS : méthode ISO/IEC 27005 v1 (matrice épinglée) ; HDS-R-01, HDS-R-02 ; T-HDS-01 ; une opportunité ; une
  valeur métier, un bien support ; une étude, une source de bibliothèque et un couple.
- Catalogue : modèles « Pertinence SR/OV » et « Gravité, vraisemblance et niveau de risque (EBIOS RM) » adoptés ; échelle
  « Besoin de disponibilité HDS (fictif) » de portée HDS.

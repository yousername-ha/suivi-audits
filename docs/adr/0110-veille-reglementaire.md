# ADR 0110 — Veille réglementaire : publications des autorités collectées par la mécanique de la veille, qualifiées par le RSSI et le DPO

- Statut : **acceptée** par le RSSI le 20/11/2026 pour le droit spécial « DPO », la qualification réservée au rôle RSSI et au
  droit DPO, la place dans le menu, les sources désactivées au départ, la collecte quotidienne par défaut et le filtre d'EUR-Lex par mots-clés
  (voir « Décisions du RSSI, second échange ») ; les choix restants sont listés dans « Choix de réalisation, à confirmer par
  le RSSI ». Numéro 0110 réservé par le RSSI.
- Date : 2026-11-20
- Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`), lot VR-1.
- S'appuie sur l'[ADR 0100](0100-module-vulnerabilites.md) (veille des vulnérabilités : exécutant, script isolé, liste fermée,
  lot F1 des fréquences), l'[ADR 0097](0097-flux-sortants-pilotes-par-les-modules.md) (registre des flux),
  l'[ADR 0101](0101-mandataire-sortant.md) (mandataire sortant), l'[ADR 0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md)
  (l'API n'a pas d'accès Internet), l'[ADR 0019](0019-activation-modules.md) (activation des modules), l'[ADR 0092](0092-refonte-des-droits-pyramide-des-perimetres.md)
  (droits) et l'[ADR 0006](0006-front-react-mantine-csp-stricte.md) (CSP stricte).

## Contexte

Le RSSI veut suivre, dans la plateforme, les publications qui peuvent changer les obligations de l'établissement : RGPD,
sécurité de l'information, santé (PGSSI-S, HDS). Aujourd'hui, ce suivi se fait à la main, hors de la plateforme, sans trace de
ce qui a été lu ni de ce qui a été jugé sans objet. La plateforme dispose déjà, pour les vulnérabilités, d'une veille sur des
flux publics lue par l'exécutant d'exploitation, dans une liste fermée, avec un flux vers l'extérieur fermé par défaut.

## Décisions du RSSI (19 et 20/11/2026)

1. **Module de veille réglementaire** : RGPD, sécurité de l'information, santé (PGSSI-S, HDS).
2. **Sources de la première tranche**, chacune activable et réglable en fréquence, inscrites au registre des flux :
   - CNIL : `https://www.cnil.fr/fr/rss.xml` (licence CC BY-ND : titre, date, lien, résumé du flux tel quel, source citée,
     aucune modification du texte) ;
   - CEPD : `https://www.edpb.europa.eu/feed/publications_en` ;
   - EUR-Lex : `https://eur-lex.europa.eu/EN/display-feed.rss?rssId=222` ;
   - ANSSI `https://cyber.gouv.fr/actualites/rss/` et ANS `https://esante.gouv.fr/rss.xml` : **titre, date et lien seulement,
     jamais de résumé** (pour l'ANS, voir les constats ci-dessous : aucun flux).
   - Légifrance (Journal officiel) : pas dans cette tranche (pas de flux) ; la valeur est prévue, sans collecteur.
3. **Qualification** : chaque publication arrive « à qualifier », puis « sans objet », « à suivre » ou « impactant ». Le **rôle
   RSSI** qualifie le domaine sécurité, un **rôle DPO** le domaine données personnelles (devenu un droit spécial cumulable, voir le second échange) ; la lecture se fait avec le droit de
   lecture du module. Qualification avec `If-Match` et journal d'audit.
4. **Hors de cette tranche** : le rattachement d'une publication « impactant » à une exigence de référentiel, à une action ou
   à une revue de document (contrat à convenir avec la session Coeur). L'API rend `suites: { exigences: 0, actions: 0,
   documents: 0 }` et n'écrit rien dans ces modules.
5. **Sécurité** : l'API n'a aucun accès sortant ; seule la collecte par l'exécutant sort, par les hôtes du registre ;
   certificat toujours vérifié ; taille et nombre d'éléments bornés ; analyse XML sûre ; textes affichés en texte simple ;
   liens acceptés seulement en https sur l'hôte attendu ; aucune nouvelle dépendance.

## Décisions du RSSI, second échange (20/11/2026)

1. **DPO est un droit spécial cumulable, pas un rôle** (décision remplaçant celle d'un rôle prédéfini, même jour ; forme fixée
   par l'addendum de l'[ADR 0092](0092-refonte-des-droits-pyramide-des-perimetres.md) (addendum du 20/11/2026, point 5)). **Exception connue en attendant le lot 3 de l'ADR 0092** : le droit réservé
   `veille_reglementaire:dpo`, hors de la matrice module × action, se coche dans un rôle personnalisé (table « Droits
   réservés » de l'écran des rôles) et s'ajoute à n'importe quel profil (« Contributeur + DPO ») ; il ouvre à lui seul la
   lecture de la veille réglementaire et permet de qualifier le domaine « données personnelles » ; désactiver le module le
   retire. Il n'est donné d'office à aucun rôle prédéfini, ni à l'Administrateur ni au RSSI, et n'entre pas dans « tous les
   droits ». Aucun rôle prédéfini « DPO » n'est créé.
2. **L'administrateur ne qualifie pas** : validé. La qualification « données personnelles » exige le droit DPO, même pour un
   administrateur ; la qualification « sécurité » reste au rôle RSSI jusqu'au lot 3. Avant ce lot, un RSSI qui doit qualifier
   les données personnelles reçoit le droit DPO par un rôle personnalisé.
3. **Menu « Conformité et audits »**, **sources désactivées au départ**, **collecte quotidienne par défaut** : validés.
4. **EUR-Lex filtré par mots-clés** : le flux `rssId=222` publie tous les actes du Journal officiel (série L ; 100 éléments,
   tous domaines, constat de la session principale). Ne garder que les actes dont le titre contient au moins un mot d'une
   liste réglable par qui administre la veille, en français et en anglais ; chaque mot porte son domaine, le domaine de l'acte
   en découle ; comparaison insensible à la casse et aux accents ; bornes sur le nombre et la longueur des mots ; réglage par
   une route protégée par le droit d'administration du module, `If-Match`, journal ; filtre appliqué à la collecte (les actes
   écartés ne sont pas rangés, seulement comptés dans le bilan).

## Constats sur les flux réels (session principale, 20/11/2026, une lecture de chaque adresse)

- CNIL, CEPD, EUR-Lex, ANSSI : RSS 2.0, respectivement 10, 10, 100 et 20 éléments, liens sur `www.cnil.fr`,
  `www.edpb.europa.eu`, `eur-lex.europa.eu`, `cyber.gouv.fr` : conformes aux hypothèses du lot.
- ANS : `https://esante.gouv.fr/rss.xml` ne rend pas de flux (code 200, `text/html`, 212 octets). L'ANS est traitée comme
  Légifrance : valeur d'énumération conservée, sans collecteur, affichée « Non disponible : aucun flux public connu » ; son
  hôte n'est ni une destination du flux, ni une règle de pare-feu. Aucune autre adresse n'a été cherchée.

## Décision

1. **Même mécanique que la veille des vulnérabilités, file propre au module.** L'API inscrit des collectes (planification à
   la fréquence de chaque source activée, ou « Collecter maintenant ») dans `veille_reglementaire_collectes` ; l'exécutant
   d'exploitation les réclame par la CLI (`suivi veille-reglementaire-claim`, `-lot <id>`, `-finish <id>`, mêmes schémas
   `LotVeille` et `RapportCollecte` que `veille-*`), lance **le même script isolé** `scripts/veille-vulnerabilites.py` (compte
   sans privilège, `python -I`, environnement minimal, délai borné, demande sur l'entrée standard) et remonte les
   publications par lots. La file est distincte de celle des vulnérabilités : fermer l'un des deux flux ne ferme pas l'autre
   file, et aucune requête de la veille des vulnérabilités n'est modifiée. Les règles de planification (prochaine échéance,
   référence consommée avant l'inscription, aucune rafale) sont les fonctions pures du lot F1
   (`frequences-synchronisation.ts`).
2. **Registre des flux** : module `veille-reglementaire` (ADR 0097), porté par l'exécutant (`updater`), quatre destinations
   TCP 443 (`www.cnil.fr`, `www.edpb.europa.eu`, `eur-lex.europa.eu`, `cyber.gouv.fr`), activation par le flux
   lui-même (« Activer la veille réglementaire », administrateur, validation explicite, route commune), refermé par la
   désactivation du module `veille_reglementaire` ; passe par le mandataire de l'établissement quand il est actif (ADR 0101).
3. **Script** : la liste fermée `SOURCES_REGLEMENTAIRES` (un hôte, un chemin exact par source, requête comprise pour EUR-Lex)
   est recopiée dans le script et comparée au registre par un test d'architecture. Le flux RSS est lu par l'analyseur déjà
   utilisé pour le CERT-FR et le CERT Santé (`lire_rss` : UTF-8 seulement, refus de toute déclaration de type de document ou
   d'entité avant l'analyse, profondeur et nombre d'éléments bornés, 200 éléments gardés, réponse de 2 Mio au plus, aucune
   redirection suivie). Pour chaque élément : titre, date (`pubDate`), lien et identifiant (`guid`, sinon le lien), balises
   retirées. **Titre et résumé ne sont jamais tronqués** (licence CC BY-ND) : un titre trop long fait écarter l'élément, un
   résumé trop long n'est pas gardé. **La description n'est jamais lue pour l'ANSSI.** Un lien qui n'est pas en https sur
   l'hôte exact de la source fait écarter l'élément ; une date illisible aussi.
   **EUR-Lex** : la liste des mots-clés en vigueur (réglée, sinon `MOTS_CLES_EURLEX_DEFAUT`) part avec la demande
   (`parametres.motsCles`, 1 à 60 objets `{ mot, domaine }`, mot de 2 à 60 caractères ; forme inattendue : rien n'est lu) ;
   le script ne remonte que les actes dont le titre contient un mot, comparé sous une forme sans accent, en minuscules, la
   ponctuation réduite à une espace, en mot entier (« personal database » ne vaut pas « personal data ») ; les autres sont
   comptés comme écartés dans le bilan. La forme comparée est écrite deux fois (`normaliserMotCle` en TypeScript,
   `normaliser` en Python), vérifiée sur les mêmes cas par les deux tests.
4. **API** : chaque élément est revalidé par zod (`elementPublication(source)` : champs stricts, texte nettoyé, résumé refusé
   pour l'ANSSI, lien sur l'hôte de la source) ; un élément refusé fait refuser tout le lot. Les publications sont
   rangées sans doublon par (source, identifiant) ; une collecte rejouée met à jour le texte, jamais la qualification. La base
   (migration `098`) refuse elle aussi un résumé de l'ANSSI, un lien hors hôte, une ANS ou une Légifrance activée.
   EUR-Lex : l'API recalcule le domaine de chaque acte sur la liste en vigueur (`domaineSelonMotsCles`) et ne range pas un
   acte qui n'en contient plus aucun (liste changée pendant la collecte) ; si des mots des deux domaines sont trouvés,
   « données personnelles » l'emporte. La liste se règle par `PUT /api/veille-reglementaire/sources/eur-lex/mots-cles`
   (`{ motsCles: [...] | null }`, `null` rétablit la liste par défaut ; `administrer`, `If-Match` sur la version de la
   source, sans doublon une fois normalisés ; journal `veille_reglementaire.mots_cles.regles` avec la liste avant et après) ;
   elle est rangée dans `veille_reglementaire_sources.mots_cles` (jsonb, 1 à 60 éléments, EUR-Lex seulement).
5. **Qualification et lecture.** Sécurité : le rôle prédéfini `rssi` (`QUALIFICATION_SECURITE_ROLE`, sur le modèle de la prise
   en compte des alertes, ADR 0100, lot V6b), tenu directement ou par un groupe, sans portée qui écarte le module, relu à
   chaque appel. Données personnelles : le droit réservé `veille_reglementaire:dpo` (`DROIT_DPO`), lu dans les droits de la
   requête (module désactivé : retiré). Ni le rôle Administrateur ni `veille_reglementaire:administrer` ne qualifient.
   Le droit est dans `PERMISSIONS_RESERVEES` (donc dans `ALL_PERMISSIONS`) mais exclu explicitement des permissions des rôles
   prédéfinis Administrateur et RSSI (`DROITS_HORS_ROLES_PREDEFINIS`). **Lecture** : les routes de lecture et la route de
   qualification déclarent `access: LECTURE_VEILLE_REGLEMENTAIRE`, soit `['veille_reglementaire:lire',
   'veille_reglementaire:dpo']`. Extension minimale de `route()` (fichier du socle, `apps/api/src/http/route.ts`) : `access`
   accepte une liste non vide de permissions **d'un même module** (contrôlé à l'enregistrement de la route) dont **l'une
   suffit** ; module désactivé : 409 ; aucune : 403 qui nomme la première ; OpenAPI : `x-access` donne la liste. Tests :
   `apps/api/test/route-permissions-alternatives.test.ts` et la matrice de `rbac.test.ts` (refus sans aucune des deux, accès
   avec chacune seule). Le menu suit (rubrique ouverte aussi par le droit DPO). Le domaine
   d'une publication est celui de sa source, sauf pour EUR-Lex (celui du mot-clé trouvé).
6. **Contrat de lecture** (communiqué à la session du tableau de bord) :
   - `GET /api/veille-reglementaire/synthese` : `{ aQualifier, aSuivre, impactant, sansObjet, parDomaine: { securite,
     donneesPersonnelles }, derniereCollecteLe, sourcesEnErreur }` ;
   - `GET /api/veille-reglementaire/publications?statut=&domaine=&source=&q=&page=` : `{ elements, total, page, parPage: 25 }`,
     publication `{ id, source, domaine, titre, resume, lien, publieLe, collecteLe, statut, qualifieLe, qualifiePar: { id, nom }
     | null, suites, version }` ;
   - `GET /api/veille-reglementaire/sources` : `{ flux: { ouvert, applique }, executant: { disponible }, mandataire: { actif },
     sources: [{ source, libelle, organisme, hote, domaine, langue, reprise, collecteur, activee, frequenceHeures,
     derniereReussite, dernierEssai, erreur, enErreur, enRetard, motsCles, derniereCollecte, prochaineCollecte, version }] }`,
     sur le modèle de `GET /api/vulnerabilites/veille/etat` (`motsCles` : `{ liste, parDefaut }` pour EUR-Lex, `null`
     sinon) ;
   - écritures : `PATCH /api/veille-reglementaire/publications/:id` (`{ statut }`, `If-Match`, rôle du domaine),
     `PATCH /api/veille-reglementaire/sources/:source` (`{ activee?, frequenceHeures? }`, `If-Match`, `administrer`),
     `PUT /api/veille-reglementaire/sources/eur-lex/mots-cles` (`If-Match`, `administrer`),
     `POST /api/veille-reglementaire/collectes` (`administrer`, quatre demandes par heure et par personne) ; lecture annexe
     `GET /api/veille-reglementaire/droits` (affichage seulement).
   Journal : `veille_reglementaire.publication.qualifiee` (source, domaine, avant, après), `veille_reglementaire.source.reglee`,
   `veille_reglementaire.collecte.*`, sans contenu de source.
7. **Interface** : page `/veille-reglementaire` (Conformité et audits > Veille réglementaire) : synthèse, liste filtrable par
   statut, domaine et source, recherche dans le titre et le résumé, qualification en un clic pour qui tient le rôle du
   domaine, activation du flux, tableau des sources (activation et fréquence pour qui administre). Charte `packages/ui`, CSP
   stricte, textes en texte simple, lien rendu seulement s'il est en https sur l'hôte de la source (contrôle repris côté
   interface), ouvert sans référent ; pastilles dessinées pour la charte (sigle, forme, teinte), aucun logo officiel ; carte
   « Filtre d'EUR-Lex » (mots par domaine, un par ligne, pour qui administre ; lecture pour les autres ; « Rétablir la liste
   par défaut »).

## Choix de réalisation

Validés par le RSSI le 20/11/2026 : droit spécial « DPO » cumulable, donné à personne d'office (voir le second échange) ;
l'administrateur ne qualifie pas (comme pour la prise en compte des alertes, décision B du 18/11/2026) ; place dans le menu
« Conformité et audits » ; sources désactivées par défaut (ouvrir le flux ne lance aucune collecte) ; collecte quotidienne par
défaut.

### À confirmer par le RSSI

1. **Les deux domaines trouvés dans un titre d'EUR-Lex** : « données personnelles » l'emporte (consigne de la session
   principale ; le DPO qualifie alors l'acte, le RSSI ne le voit qu'en lecture).
2. **Liste de mots-clés par défaut** (25 mots) : données personnelles, protection des données, vie privée, données de santé
   (domaine données personnelles) ; cybersécurité, sécurité des réseaux, sécurité de l'information, dispositifs médicaux,
   intelligence artificielle, identité numérique, identification électronique, services de confiance, résilience (domaine
   sécurité) ; chacun en français et en anglais (« résilience » et « resilience » ne font qu'un une fois les accents
   retirés). Les dispositifs médicaux, l'intelligence artificielle et l'identité numérique sont rangés en sécurité faute
   d'un troisième domaine. « Santé » seul n'y est pas (trop large) ; « resilience » ramène aussi des actes financiers
   (facilité pour la reprise et la résilience).
3. **Domaine de l'ANSSI et de Légifrance** : sécurité par défaut (Légifrance sans collecteur).
4. **Fréquences** : 4, 12, 24 (par défaut) ou 168 heures pour toutes les sources ; « en retard » après trois périodes sans
   réussite (règle de la décision 7 du 20/11/2026, prise pour la veille des vulnérabilités et appliquée ici d'emblée).
5. **Liste changée** : la nouvelle liste vaut pour les collectes suivantes ; les actes déjà rangés gardent leur domaine et leur
   qualification.
6. **Requalification** : une publication qualifiée peut être requalifiée entre « sans objet », « à suivre » et « impactant » ;
   elle ne revient jamais à « à qualifier ». Une collecte rejouée peut mettre à jour le titre ou le résumé d'une publication
   déjà qualifiée sans toucher à sa qualification.
7. **RSS 2.0 seulement** : un flux Atom ou RDF ne donnerait aucune publication (zéro élément, sans erreur) ; les quatre flux
   collectés sont en RSS 2.0 (constat du 20/11/2026).
8. **Remise à vide** : les trois tables partent avec le travail, comme la veille des vulnérabilités (qualifications et liste
   de mots-clés comprises) ; les rôles personnalisés qui portent le droit DPO suivent la règle de la remise à vide.

## Exécutant d'exploitation

`scripts/exploitation-worker.py` (fichier tenu par la session Coeur, modifié dans ce lot avec son accord, qui le relit) :
`FLUX_MODULES` et `FLUX_PORTES` connaissent `veille-reglementaire` ; l'exécutant réclame la file réglementaire
(`veille-reglementaire-claim | -lot | -finish`, sources `VEILLE_REGLEMENTAIRE_SOURCES` : CNIL, CEPD, EUR-Lex, ANSSI ; flux
`VEILLE_REGLEMENTAIRE_FLUX`) avec la même routine que la veille des vulnérabilités (`VEILLE_FILES`, une file après l'autre,
chacune avec son débit par passage) et rapporte l'état appliqué du nouveau flux. Rien d'autre n'y change. Tests :
`scripts/tests/test_exploitation.py`, `apps/api/test/veille-reglementaire-architecture.test.ts`,
`apps/api/test/architecture-flux.test.ts`.

## Ce qui n'est pas fait

- ANS (aucun flux public connu), Légifrance (Journal officiel, open data de la DILA), purge des publications anciennes, temps réel (SSE), suites données à
  une publication « impactant », notification d'une publication nouvelle.
- Aucune collecte réelle par la plateforme : le script est vérifié sur des flux fictifs écrits à la main ; seule la forme des
  flux a été relevée sur les adresses réelles (constats ci-dessus), pas le passage du filtre d'EUR-Lex sur ses vrais titres.

## Conséquences

- Une trace, dans le SMSI, de chaque publication des autorités et du jugement porté (qui, quand, quel statut) : appui pour la
  conformité (ISO 27001, 5.31 et 5.34 ; PGSSI-S, HDS).
- Quatre hôtes de plus à autoriser sur le pare-feu (ou sur le mandataire), seulement si la veille réglementaire est activée.
- Un droit réservé de plus dans l'écran des rôles (table « Droits réservés ») ; `route()` admet des permissions
  alternatives d'un même module.

## Preuves

`apps/api/test/veille-reglementaire.test.ts` (droits RSSI, DPO, lecteur, sans droit, administrateur ; `If-Match` ; filtres et
synthèse ; cycle par le service et par la vraie CLI ; éléments refusés ; flux fermé, module désactivé ; planification ; file
indépendante ; ANS sans collecteur ; filtre d'EUR-Lex : liste remise avec la collecte, domaine déduit, réglage, bornes,
journal), `apps/api/test/veille-reglementaire-architecture.test.ts` (concordance du script, de la migration et du
registre), `scripts/tests/test_veille_reglementaire.py` (analyse des flux, bornes, ANSSI sans résumé, lien hors hôte refusé, RSS piégé,
redirection, certificat, filtre d'EUR-Lex et forme comparée), `packages/shared/test/veille-reglementaire.test.ts`,
`apps/web/test/veille-reglementaire.test.ts`, e2e `zzz…-veille-reglementaire.spec.ts` (écrit, non exécuté localement).

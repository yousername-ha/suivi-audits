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

## Décision du RSSI du 22/11/2026 : sources de la tranche suivante

Constat de la session principale (une lecture de chaque adresse, 22/11/2026) : le CERT Santé publie, en plus du flux des
alertes lu par la veille des vulnérabilités, un flux RSS 2.0 de ses **actualités** (`https://cyberveille.esante.gouv.fr/actualites/rss.xml`,
20 articles : menaces visant le secteur de la santé, quelques sujets réglementaires), non signalé en page d'accueil ; le flux
des dossiers thématiques existe mais est vide. Aucune condition de réutilisation n'est publiée. Le site principal de l'ANS
(`esante.gouv.fr`) n'a toujours aucun flux.

Le RSSI retient pour la tranche suivante :

1. **CERT Santé, actualités** : nouvelle source, titre, date et lien seulement (règle de l'ANSSI et de l'ANS), domaine
   sécurité ; hôte déjà ouvert pour la veille des vulnérabilités.
2. **Journal officiel par les données ouvertes de la DILA** (fichier quotidien, sans compte), filtré par mots-clés comme
   EUR-Lex ; nouvel hôte en sortie.
3. **Journal officiel par l'API Légifrance (plateforme PISTE)** : compte et clé créés par l'établissement, clé saisie dans
   l'application seulement (jamais transmise ailleurs).

Non retenu : lire les pages du site principal de l'ANS (fragile à chaque refonte). La ligne « ANS » reste « non disponible ».

## Addendum du 22/11/2026 : réalisation du lot VR-2

Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`). Cet addendum complète
la décision ci-dessus ; la section « Ce qui n'est pas fait » plus bas décrit l'état du lot VR-1 et vaut, depuis ce lot,
seulement pour l'ANS, l'API Légifrance (PISTE) et les autres points qui y sont listés.

### Réalisé

1. **Actualités du CERT Santé** : source `cert-sante-actualites` (identifiant distinct de la source `cert-sante` de la veille
   des vulnérabilités, les deux listes étant réunies dans le script), flux RSS 2.0
   `https://cyberveille.esante.gouv.fr/actualites/rss.xml`, lu par `lire_rss` comme l'ANSSI : titre, date et lien
   seulement, **la description n'est jamais lue** (pas dans `RESUME_REGLEMENTAIRE`), domaine sécurité, désactivée au départ,
   fréquences communes. L'hôte, déjà ouvert pour la veille des vulnérabilités, est inscrit aussi dans le flux
   « veille-reglementaire » (registre, script, guide) : fermer l'un des deux flux ne ferme pas l'autre.
2. **Journal officiel par les données ouvertes de la DILA** : la valeur `legifrance`, prévue par la migration 098, a son
   collecteur (`journal_officiel` dans le script). Hôte joint : `echanges.dila.gouv.fr` (nouvelle destination TCP 443 du flux).
   Chemins de la liste fermée : `/OPENDATA/JORF/` (page d'index du dossier) et `/OPENDATA/JORF/{archive}`, où `{archive}` est
   contrôlé par `^JORF_(\d{8})(?:-\d{6})?\.tar\.gz$` avant toute lecture. Déroulement :
   - la demande porte la liste de mots-clés du Journal officiel et, après une première réussite, `parametres.depuis` (la
     veille de la dernière collecte réussie, AAAA-MM-JJ, en UTC ; sept jours sinon dans le script) ;
   - la page d'index (4 Mio au plus) n'est pas analysée : les noms d'archives y sont relevés par leur forme exacte, datés,
     ceux d'avant la date de départ écartés ; **dix archives au plus** (les plus récentes, collecte signalée incomplète
     au-delà), une demi-seconde entre deux, plus aucune après 180 secondes de collecte ;
   - chaque archive : **32 Mio au plus** (au-delà, refusée sans être lue, d'après la longueur annoncée ou à la lecture),
     décompressée en mémoire par `gzip` et `tarfile` (mode flux `r|`, rien n'est écrit sur disque), **512 Mio** au plus une fois
     décompressée (bombe de décompression refusée), **200 000 fichiers** au plus. Une archive refusée ou illisible est
     écartée (collecte incomplète) ; si aucune ne peut être lue, la collecte échoue avec l'explication ;
   - seuls les fichiers `JORFTEXT<12 chiffres>.xml` sont ouverts, et seulement leurs 64 premiers Kio : décodage UTF-8 strict,
     refus de toute déclaration de type de document ou d'entité, analyse par `XMLPullParser` bornée en profondeur (12) et en
     éléments (2 000), arrêt à la fin de l'élément `META`. Racine autre que `TEXTE_VERSION` (structure, par exemple) :
     fichier ignoré ; en-tête illisible : fichier écarté et compté. Si des fichiers étaient candidats mais qu'aucune version
     de texte n'a pu être lue dans toute la collecte, la collecte échoue (« forme inattendue ») plutôt que de rendre zéro
     publication sans le dire ;
   - champs lus : `ID` (sinon `CID`) de forme `JORFTEXT\d{12}`, `TITREFULL` (sinon `TITRE`), `DATE_PUBLI` (AAAA-MM-JJ, date
     réelle) ; un champ illisible fait écarter le texte. Filtre : le titre complet nettoyé (balises retirées) doit contenir un
     mot-clé (même `normaliser` et même `domaine_titre` qu'EUR-Lex) ; le domaine en découle. Le même texte présent dans deux
     archives : la plus récente l'emporte ; 200 textes au plus par collecte ;
   - publication : identifiant JORFTEXT, titre abrégé à 300 caractères (terminé par « … ») quand il est plus long, date de
     publication à minuit UTC, lien `https://www.legifrance.gouv.fr/jorf/id/<JORFTEXT…>`, **jamais de résumé ni de texte
     intégral**. L'hôte des liens (`hoteLiens`) n'est jamais joint par la plateforme ; la forme exacte du lien (`formeLien`)
     est contrôlée par le script, `lienPublicationValide` (API et interface) et la base (migration 104).
3. **Filtre par mots-clés** : **liste propre au Journal officiel** (`MOTS_CLES_JO_DEFAUT`, 19 mots, en français), plutôt que
   la liste d'EUR-Lex, bilingue et faite pour des titres anglais : même schéma (`MotCleEurLex`), mêmes bornes, même route
   (`PUT /api/veille-reglementaire/sources/legifrance/mots-cles`, `administrer`, `If-Match`, journal
   `veille_reglementaire.mots_cles.regles`), rangée dans `veille_reglementaire_sources.mots_cles` de la ligne `legifrance`
   (`SOURCES_FILTREES_MOTS_CLES`), carte « Filtre du Journal officiel » à côté de celle d'EUR-Lex (même composant, une région
   nommée par carte).
4. **Migration 104** (additive) : listes fermées des sources, des collectes et des liens recréées ; activation refusée pour
   l'ANS seule ; mots-clés admis pour EUR-Lex et le Journal officiel. Les contraintes sans nom de la migration 098 sont
   retirées sous les noms que PostgreSQL leur a donnés (`veille_reglementaire_sources_check`, `_check1`,
   `veille_reglementaire_publications_check1`), sans `IF EXISTS`, et recréées avec un nom explicite. La règle du résumé
   (migration 098) n'est pas touchée : ni le CERT Santé ni le Journal officiel ne peuvent en ranger un.
5. **Exécutant** : `VEILLE_REGLEMENTAIRE_SOURCES` reçoit `cert-sante-actualites` et `legifrance` ; rien d'autre ne change
   (les paramètres passent au script tels quels par l'entrée standard). Test : `scripts/tests/test_exploitation.py`.

### Hôtes nouveaux autorisés par le RSSI

| Hôte | Décision | Ce qui sort |
| --- | --- | --- |
| `cyberveille.esante.gouv.fr` (CERT Santé), sous le flux « veille-reglementaire » | 22/11/2026 : « CERT Santé – actualités » (décision du RSSI du 22/11/2026, ci-dessus, point 1) ; hôte déjà ouvert sous le flux « veille-vulnerabilites », inscrit aussi sous ce flux | la demande de lecture du flux RSS des actualités, sans paramètre |
| `echanges.dila.gouv.fr` (DILA, données ouvertes du JORF) | 22/11/2026 : « Journal officiel, données ouvertes » (décision du RSSI du 22/11/2026, ci-dessus, point 2) | la demande de la page d'index du dossier, puis des archives quotidiennes récentes, sans paramètre |

Les deux sont sous le flux « veille-reglementaire » (fermé par défaut, ADR 0097) et leurs sources sont désactivées au départ.
`www.legifrance.gouv.fr` n'est pas une destination : seul le navigateur de la personne qui suit un lien l'ouvre. Aucun hôte de
PISTE n'est autorisé (voir ci-dessous).

### API Légifrance (plateforme PISTE) : lot à part, plus tard (décision du RSSI du 23/11/2026)

La décision du RSSI la retient en option. Elle n'est pas livrée dans ce lot, pour trois raisons :

- **le script n'émet que des `GET`** (invariant vérifié par `test_veille_vulnerabilites.py`) ; PISTE demande un `POST` pour le
  jeton OAuth 2 (`https://oauth.piste.gouv.fr/api/oauth/token`, « client credentials ») et des `POST` pour l'API
  Légifrance (`https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/…`, par exemple `consult/lastNJo` puis le sommaire
  de chaque JO). Relâcher cet invariant, et y faire sortir un secret, est un choix de sécurité à faire explicitement ;
- **la clé** (identifiant et secret du client) devrait être rangée scellée comme les secrets des intégrations
  (`vault.sealSmall` avec données associées, écriture seule, `apps/api/src/integrations/integrations.ts`), saisie dans
  l'application seulement, remise à l'exécutant avec la réclamation de la collecte (comme `secrets` des intégrations) et
  jamais journalisée : nouvelle colonne, nouvelle route en écriture seule, nouveau champ d'écran ;
- **la forme des réponses n'est pas vérifiée** (réponse du jeton, conteneurs du JO, sommaire, identifiants) et ne peut l'être
  sans une vraie clé.

La voie DILA donne le même contenu (titres et identifiants des textes du JO), sans compte ni secret. **Décision du RSSI du
23/11/2026 : la voie PISTE est un lot à part, plus tard**, après la création d'un compte PISTE par l'établissement et un essai
réel de sa clé (forme du jeton : `access_token`, `expires_in` ; forme de `lastNJo` et du sommaire ; quotas). Rien n'est codé
pour elle dans ce lot ; aucun hôte PISTE n'est inscrit au registre ; le guide d'installation précise qu'aucun compte n'est à
créer pour cette version. Le lot à venir devra trancher l'émission de `POST` par le script et la remise d'un secret à
l'exécutant.

### Non vérifié

- **Forme réelle du fichier quotidien du JORF** : nom des archives (`JORF_<AAAAMMJJ>-<HHMMSS>.tar.gz` supposé ; le motif
  admet aussi `JORF_<AAAAMMJJ>.tar.gz`), présentation de la page d'index (index HTML de serveur supposé), arborescence et
  noms des fichiers dans l'archive (`…/texte/version/…/JORFTEXT<12 chiffres>.xml` supposé), racine `TEXTE_VERSION`, champs
  `META/META_COMMUN/ID`, `META_TEXTE_CHRONICLE/DATE_PUBLI`, `META_TEXTE_VERSION/TITREFULL`, encodage UTF-8 sans déclaration
  de type de document, taille des archives quotidiennes (borne de 32 Mio choisie sans mesure), réponse du serveur à l'en-tête
  `Accept` du script (JSON et XML) pour une page HTML et un fichier `tar.gz`. Les tests utilisent des archives fictives
  construites en mémoire à cette forme supposée. **Première lecture réelle à faire** (une collecte « Collecter maintenant »
  sur une pile de recette) ; si la forme diffère, la collecte échoue avec une explication et rien n'est rangé.
- Flux des actualités du CERT Santé : forme relevée par la session principale le 22/11/2026 (20 éléments, liens
  `https://cyberveille.esante.gouv.fr/actualites/<slug>`), pas par la plateforme.

### Choix de réalisation, à confirmer par le RSSI

1. Liste de mots-clés **propre au Journal officiel**, en français (19 mots) : données à caractère personnel, données
   personnelles, protection des données, informatique et libertés, vie privée, données de santé (données personnelles) ;
   cybersécurité, sécurité des systèmes d'information, sécurité numérique, sécurité des réseaux, sécurité de l'information,
   numérique en santé, identité numérique, identification électronique, services de confiance, intelligence artificielle,
   importance vitale, cryptologie, résilience (sécurité). « Dispositifs médicaux » n'y est pas (des dizaines d'arrêtés de
   remboursement par semaine).
2. **Titre abrégé** au-delà de 300 caractères (terminé par « … ») pour le Journal officiel, quand les flux RSS écartent un
   titre trop long : les titres du JO dépassent souvent 300 caractères et ses données ouvertes sont sous Licence Ouverte (le
   filtre porte sur le titre complet).
3. Date de départ : la veille de la dernière réussite ; dix archives au plus par collecte ; une collecte incomplète (archive
   trop grosse, durée) compte comme une réussite, signalée « incomplète », et la suivante repart de la veille de cette
   réussite : une archive intermédiaire non lue peut alors ne jamais l'être.
4. Le domaine du CERT Santé est la sécurité (qualifié par le rôle RSSI).
5. Mandataire sortant injoignable (décision du RSSI du 23/11/2026, lot CVE-INC) : les deux sources nouvelles passent par le
   même client que les autres (`Client.lire`, `ConnexionMandataire`) ; l'erreur affichée ne nomme ni l'hôte ni le port du
   mandataire, le détail sort à part (champ `detail`) pour le seul journal d'audit. Vérifié par
   `test_unreachable_proxy_never_names_its_host_or_port_in_the_error_of_any_source`.

### Preuves du lot VR-2

`scripts/tests/test_veille_reglementaire.py` (classe `JournalOfficiel` : archives fictives construites en mémoire, versions
de texte seules lues, texte intégral jamais repris, filtre, titre abrégé, archive trop grosse refusée sans être lue, bombe de
décompression, trop de fichiers, en-têtes piégés, nom d'archive hors forme, date de départ illisible, durée, aucune écriture
sur disque ; CERT Santé sans résumé), `scripts/tests/test_exploitation.py`, `apps/api/test/veille-reglementaire.test.ts`
(migration 104, CERT Santé, Journal officiel : liste et date de départ remises avec la collecte, domaine déduit, lien de forme
exacte, réglage de la liste à part), `apps/api/test/veille-reglementaire-architecture.test.ts`,
`packages/shared/test/veille-reglementaire.test.ts`, `apps/web/test/veille-reglementaire.test.ts`, e2e
`zzz…-veille-reglementaire.spec.ts` (adapté, non exécuté localement). Aucune source réelle jointe.

## Ce qui n'est pas fait

- ANS (aucun flux public connu), Légifrance (Journal officiel : données ouvertes de la DILA et API PISTE, retenues le 22/11/2026), CERT Santé actualités (retenu le 22/11/2026), purge des publications anciennes, temps réel (SSE), suites données à
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

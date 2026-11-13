# Organisation — Parties intéressées, SWOT et PESTEL

> Mise à jour du 10/11/2026 : pour le SWOT, cette première proposition est remplacée par la
> [Matrice Studio validée et intégrée](../../SWOT-STUDIO-INTEGRE.md), commit `016d69c`.
> Parties intéressées et PESTEL restent des propositions non validées.

09/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Demande : « Travaillons sur organisation ». Premier ensemble proposé : les trois onglets restant à revoir dans
Contexte de l’organisation. La question de priorité a été posée ; aucune réponse n’était reçue lors de cette préparation.
Le premier ensemble du menu est donc utilisé comme point de départ.

**Nouvelle proposition autonome, à valider avant intégration.** Application conservée à `65bd22f` ; documents précédents
à `e930a14`. Aucun changement dans `apps`, `packages`, les tests existants, les dépendances ou Docker ; aucun build ou test
applicatif exécuté pour cette proposition. Le Contexte et les Périmètres déjà approuvés restent conservés.

## Ajustement : le SWOT reste rattaché aux processus

Rappel du demandeur : « Le swot et relié aux processus ». La proposition prend désormais explicitement le processus
comme point d’entrée : bandeau avec son identifiant, son nom, son type, son pilote et sa finalité, choix du processus,
puis ses analyses SWOT. Le lien **processus → analyse** est visible entre les panneaux et dans la fiche ouverte.
Le registre inférieur est limité aux analyses du processus choisi ; il conserve l’accès à leur ouverture et leur recherche.

Les six processus viennent du même jeu fictif fourni. Une seule analyse y existe : `SW1`, rattachée à `PR2`.
Choisir un autre processus affiche l’absence d’analyse associée ; aucune analyse supplémentaire n’est fabriquée.
Le processus reste identifié dans l’illustration du formulaire, sans modification de son rattachement ni enregistrement.

Sources complémentaires lues : `apps/api/src/pilotage/processus-cartes.ts`, `pilotage/legacy.ts`,
`apps/web/src/processus/CartesProcessus.tsx` et `FicheCarteProcessus.tsx`. Le rattachement historique utilise `swots.process` ;
les cartes processus tiennent également compte des liens transverses. Une éventuelle intégration devra conserver ces deux
sources et leurs permissions, sans imposer un nouveau champ obligatoire ni recopier les analyses dans les processus.
Cet ajustement ne déplace aucun onglet de l’application et ne constitue pas une validation de l’ensemble Organisation.

**Maquette ajustée, encore en attente de validation.** Les captures SWOT de la première proposition restent conservées
pour l’historique ; les liens SWOT du tableau ci-dessous pointent sur les nouveaux rendus. Parties intéressées et PESTEL
restent les propositions précédentes, sans nouvelle intégration.

## Présentation

- **Parties intéressées** : quatre synthèses compactes, registre en lignes, identité et nature de l’acteur, besoins et
  exigences, traitement, date de revue et responsable. La prise en compte d’une exigence et l’actualité de la revue restent
  deux informations différentes. Une fiche de formulaire assortie illustre l’ouverture d’un enregistrement.
- **SWOT par processus** : processus identifié en tête, sélection du processus puis analyse présentée en quatre quadrants,
  avec repères interne/externe et métadonnées de la fiche. La liste compacte regroupe les analyses de ce processus.
- **PESTEL** : facteurs de la nomenclature en panneaux, enjeux externes non classés dans une zone distincte et enjeux
  internes clairement conservés hors PESTEL. L’aide méthodologique facultative reste accessible dans un détail dépliable.
- Palette Studio déjà retenue : panneaux opaques blancs/lavande ou marine, contours nets, relief discret, accents
  répartis entre bleu, vert, ambre et indigo. Les couleurs de facteurs PESTEL servent au repérage, sans score de criticité.
- Hauteurs naturelles, adaptation sur téléphone, zéro défilement vertical interne dans les panneaux contrôlés.

La navigation conserve les neuf destinations Organisation et les quatre onglets du Contexte. Les autres destinations
(Processus, responsabilités, cartographie, fournisseurs, accès, plans et budget) ne sont pas redessinées dans ce premier lot.
Le bouton du Contexte déjà validé rappelle sa conservation ; il ne charge pas une nouvelle proposition de cet écran.

## Sources lues et données fictives

La lecture a couvert `pages/Pilotage.tsx`, `pilotage/Registry.tsx`, `RecordEditor.tsx`, `Fields.tsx`, `Pestel.tsx`, les champs
de `packages/shared/src/pilotage.ts`, le regroupement et les synthèses de `packages/shared/src/pestel.ts`, ainsi que la charte
consolidée et les précédentes propositions Studio. Aucun de ces fichiers applicatifs n’est modifié.

Les six parties intéressées et l’analyse SWOT viennent du jeu fictif déjà fourni. Les noms, attentes, exigences,
traitements et dates ne sont pas des données de production. La situation de démonstration est figée au 09/11/2026.
Les synthèses reprennent la règle existante : Oui, Partiel/Non, et revue absente ou antérieure au seuil de 365 jours.
Leur source lors de l’intégration devra rester celle de `SynthesePartiesBandeau`, avec sa portée actuelle ; il ne faut pas
la remplacer silencieusement par les seules pages chargées ou les lignes filtrées du registre.

Le PESTEL illustre cinq enjeux externes et trois enjeux internes à partir des textes fictifs du contexte et du SWOT.
Les natures et affectations PESTEL de ce scénario sont **illustratives**, choisies uniquement dans `donnees.js`.
Elles ne prétendent pas reproduire les affectations de la base, ne sont pas déduites automatiquement du texte et ne créent
aucun objet. Les six facteurs présentés sont la nomenclature par défaut existante ; une nomenclature d’organisation
différente devra rester prise en charge. Les panneaux ne présentent aucun taux de conformité ni score ajouté.

## Interactions de maquette

La bascule clair/sombre, les trois onglets, la recherche des parties par nom, les filtres illustrés, l’ouverture des fiches,
Annuler/Échap et le classement PESTEL fonctionnent localement. Le classement reste en mémoire et disparaît au rechargement.
Enregistrer affiche un message de maquette, sans écrire. Les historiques et justificatifs sont représentés par leur
emplacement, sans inventer de décision ou de pièce jointe. Le choix du processus et la recherche dans ses analyses SWOT
fonctionnent localement. La création illustre un formulaire vierge avec le processus choisi ; elle ne simule pas un cycle
métier complet ni une nouvelle écriture d’association dans l’application.

Les formulaires sont des illustrations de présentation. À l’intégration, `RecordEditor`, le sélecteur de registre,
les responsables, tous les champs existants, les relations, versions, confirmations et gardes doivent être conservés.
Les données génériques d’état ou d’échéance éventuellement renseignées sur une fiche native devront rester consultables ;
leur absence dans les six fiches historiques illustrées n’autorise pas leur suppression. Les permissions et restrictions
au périmètre commun du PESTEL ne sont pas validées par cette maquette et restent celles de l’application.

## Visuels

| Écran | Clair | Sombre |
| --- | --- | --- |
| Parties intéressées | [Page entière](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/parties-light-1440.png) | [Page entière](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/parties-dark-1440.png) |
| SWOT par processus, ajusté | [Page entière](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/swot-processus-light-1440.png) | [Page entière](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/swot-processus-dark-1440.png) |
| PESTEL | [Page entière](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/pestel-light-1440.png) | [Page entière](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/pestel-dark-1440.png) |
| Parties HD, 3 840 px | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/parties-light-hd.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/parties-dark-hd.png) |
| SWOT ajusté HD, 3 840 px | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/swot-processus-light-hd.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/swot-processus-dark-hd.png) |
| PESTEL HD, 3 840 px | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/pestel-light-hd.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/pestel-dark-hd.png) |
| Parties sur téléphone | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/parties-light-mobile.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/parties-dark-mobile.png) |
| SWOT ajusté sur téléphone | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/swot-processus-light-mobile.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/swot-processus-dark-mobile.png) |
| Fiche SWOT, processus identifié | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/fiche-swot-processus-light.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/fiche-swot-processus-dark.png) |
| PESTEL sur téléphone | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/pestel-light-mobile.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/pestel-dark-mobile.png) |

[Aperçu du formulaire Partie intéressée](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/fiche-partie-light.png). Les images sont des captures natives du prototype,
sans retouche ; elles ne sont pas des captures d’une nouvelle intégration applicative. `index.html` utilise Inter locale
avec sa licence `OFL.txt` et n’appelle aucun service externe.

[Exemple d’un processus sans analyse SWOT](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-contexte-studio/swot-processus-sans-analyse-light.png).

## Contrôles de maquette uniquement

Script privé : `/workspace/work/organisation-contexte-studio/rendre.mjs`.
[Reçu des contrôles](controles-maquette.json) : 36 dispositions inspectées, trois pages et deux thèmes, à 390, 768, 1 024,
1 280, 1 440 et 1 920 px. Aucun débordement horizontal de page, de panneau ou défilement vertical interne détecté.
Six analyses Axe ciblées sans violation détectée après correction du rôle accessible d’un repère décoratif SWOT.
Recherche, filtres, nombre de lignes, ouverture/fermeture de fiche, changement d’onglet, classement local et bascule de thème
vérifiés. Aucun appel externe, aucune écriture HTTP et aucune erreur JavaScript observés.

Les deux scripts autonomes passent `node --check`. La première sélection de filtre par libellé exact ne reconnaissait
pas le nom implicite du contrôle ; les libellés accessibles de la maquette ont été explicités avant le contrôle final.
Aucun contrôle métier ou assertion applicative modifié pour obtenir ces résultats.

Contrôle complémentaire du SWOT ajusté :
`/workspace/work/organisation-contexte-studio/rendre-swot-processus.mjs`, serveur statique local sur le port 8133.
[Reçu distinct](controles-swot-processus.json) : 18 dispositions, dont les deux états de formulaire sur ordinateur et
téléphone et les processus sans analyse ; quatre analyses Axe sans violation détectée, neuf nouvelles captures natives.
Choix et rechargement du processus, quatre quadrants de `SW1`, recherche, formulaire et rattachement en lecture seule,
annulation et conservation du jeu de données vérifiés. Aucun appel externe, écriture HTTP ou erreur JavaScript observé.
Les essais de préparation ont révélé un nom accessible englobant le texte d’aide du sélecteur et des contrôles ambigus
entre panneaux et formulaire : noms accessibles explicités et sélecteurs de contrôle bornés au dialogue avant le passage
final. Aucun test applicatif ni seuil de contrôle modifié. Vérifications syntaxiques des deux scripts autonomes réussies.

**Non exécutés : intégration, build et tests de l’application, recette Docker Windows, nouveau paquet applicatif.**
Prochaine action : recueillir la validation ou les ajustements sur ces trois vues, puis intégrer le lot retenu et fournir
les captures réelles après ses contrôles. Les autres destinations Organisation restent à traiter séparément.

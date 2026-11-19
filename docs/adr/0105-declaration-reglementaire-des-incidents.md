# ADR 0105 — Déclaration réglementaire des incidents (santé et NIS 2)

- Statut : **acceptée** par le RSSI le 18/11/2026, dans la session (numéros 0105 et migration `087` annoncés et acceptés ;
  décisions 1 à 8 ci-dessous prises une à une).
- Renumérotée 089 le 19/11/2026 (collision avec 087 du module Vulnérabilités) : le fichier devient
  `089_declarations_incidents.sql` et sa contrainte de portée des notifications reprend aussi les types `vulnerabilites_delais`
  et `vulnerabilites_exceptions` de la 087 (numéro à faire accepter par le RSSI).
- Date : 2026-11-18
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- **Complète** l'[ADR 0091](0091-simplification-du-menu-resilience-incidents.md) (fiche de l'incident à onglets) et s'appuie sur
  l'[ADR 0058](0058-notifications-metier.md) (notifications métier) et le registre historique (ADR 0040).

## Contexte

Un établissement de santé doit signaler les incidents graves de sécurité de ses systèmes d'information (article L. 1111-8-2 du
code de la santé publique, portail de signalement, CERT Santé et ARS). S'il est entité essentielle ou importante au sens de
NIS 2, il doit aussi notifier les incidents importants : alerte précoce sous 24 heures, notification sous 72 heures, rapport
final dans le mois qui suit la notification (article 23 de la directive).

Aujourd'hui, la fiche d'un incident qualifié « Incident de sécurité » affiche une liste « Obligations à vérifier », calculée,
avec une simple case « traité le … ». Aucun délai n'est calculé, aucun rappel n'est envoyé, rien n'est figé, et la date de
qualification n'est pas enregistrée. Les échéances NIS 2 de la cellule de crise partent de l'ouverture de la cellule, sans lien
avec l'incident.

## Décisions du RSSI (18/11/2026)

1. **Régimes suivis** : santé (CERT Santé / ARS) et NIS 2 (ANSSI). Le RGPD (CNIL, 72 heures) reste dans la liste « Obligations
   à vérifier », sans suivi de déclaration.
2. **Départ des délais** : la **qualification horodatée**. Le premier passage de l'incident à la qualification « Incident de
   sécurité » enregistre la date et l'heure, automatiquement. Le RSSI peut la corriger ; la correction est tracée (ancienne et
   nouvelle valeur, auteur) et recalcule les échéances des déclarations non encore envoyées.
3. **Production** : une **fiche de préparation** par déclaration, rubrique par rubrique, chaque rubrique avec un bouton
   « Copier » pour la recopier dans le formulaire du portail ; pré-remplie depuis la fiche de l'incident, sa chronologie et
   l'identité de l'établissement, modifiable jusqu'à l'envoi ; et **téléchargeable en Word** pour archive ou relecture.
4. **Envoi figé** : « Marquer comme envoyée » fige le texte transmis, la date et l'heure, la personne et le numéro de dossier ou
   d'accusé de réception. Une déclaration envoyée, ou écartée « non requise », ne peut plus être ni modifiée ni supprimée
   (déclencheur en base, comme les journaux existants). Un complément se fait par une nouvelle déclaration liée.
5. **Rappels** dans l'application et par courriel, au responsable de l'incident et aux comptes qui ont le rôle prédéfini
   « RSSI » :
   - à la qualification, pour chaque déclaration proposée ;
   - NIS 2 : à mi-délai et 2 heures avant chaque échéance, puis au dépassement ;
   - santé (« sans délai ») : à la qualification, puis toutes les 4 heures tant que le signalement n'est ni envoyé ni écarté.
6. **Droits** : préparer (rubriques, numéro de dossier pressenti) demande `incidents:modifier` sur le périmètre de l'incident ;
   **confirmer « à déclarer », écarter « non requise » et marquer « envoyée » sont réservés au rôle prédéfini « RSSI »**, sans
   délégation, comme la prise en compte des alertes critiques du module Vulnérabilités.
7. **Identité de l'établissement** : nouvelle rubrique de Configuration (droit `conformite`), vide au départ : raison sociale,
   FINESS juridique et géographique, ARS de rattachement, contact de signalement (nom, fonction, téléphone, courriel), secteur
   d'activité au sens de NIS 2. La catégorie d'entité NIS 2 existante est réutilisée.
8. **Déclenchement** : à la qualification « Incident de sécurité », l'outil **propose** les déclarations probables :
   - santé si la qualification guidée indique des données de santé ou une activité HDS touchées (réponse « oui » ou « je ne
     sais pas ») ;
   - NIS 2 (alerte précoce, notification, rapport final) si l'établissement est entité essentielle ou importante.
   Le compte à rebours démarre aussitôt. Le RSSI confirme « à déclarer » ou écarte « non requise » avec un **motif
   obligatoire**, figé. Il peut aussi ouvrir à la main une déclaration non proposée.

## Mise en œuvre

- **Migration `087`, renumérotée `089`** (additive) :
  - table des déclarations d'incident : incident, périmètre, régime (`sante`, `nis2`), étape (`signalement`,
    `alerte_precoce`, `notification`, `rapport_final`, `complement`), déclaration liée (complément), statut (`proposee`,
    `a_declarer`, `non_requise`, `envoyee`), échéance, rubriques du brouillon, motif, envoi (date, auteur, référence, contenu
    figé) ; déclencheur qui refuse toute modification ou suppression d'une ligne `envoyee` ou `non_requise` ;
  - date de qualification de l'incident (colonne de `suivi_incidents`, alignée avec la table de correspondance des champs) ;
  - types de notification de la déclaration (contrainte de portée recréée, index unique de rappel) ;
  - aucune reprise de données : les incidents existants n'ont pas de date de qualification et ne reçoivent aucune proposition
    rétroactive ; le RSSI peut ouvrir une déclaration à la main.
- **Échéances**, calculées par le serveur depuis la date de qualification : santé « dès que possible » (pas d'échéance chiffrée,
  rappels toutes les 4 heures) ; alerte précoce + 24 h ; notification + 72 h ; rapport final un mois après l'envoi de la
  notification (sans notification envoyée, pas d'échéance chiffrée).
- **Rubriques** : celles de l'article 23 de NIS 2 pour chaque étape (alerte précoce : caractère malveillant ou illicite
  soupçonné, effet transfrontière ; notification : évaluation initiale, gravité, impact, indicateurs de compromission ; rapport
  final : description détaillée, type de menace ou cause, mesures appliquées, effet transfrontière) ; pour la santé, l'identité
  de l'établissement, la description, la date de détection, les conséquences sur la prise en charge des patients et les
  mesures prises. Elles sont définies dans le paquet partagé, avec leur source ; **à confirmer par le RSSI contre les
  formulaires réels des portails** avant la première utilisation.
- **Fiche de l'incident** : un bloc « Déclarations » dans l'onglet Fiche, avec pour chaque déclaration son régime, son étape,
  son statut et un compte à rebours ; la fiche de préparation s'ouvre depuis le bloc. La liste « Obligations à vérifier » reste
  identique (rangs inchangés), ses lignes santé et NIS 2 renvoient au bloc.
- **Suppression d'un incident** : refusée tant qu'il porte une déclaration envoyée ou écartée (la preuve ne doit pas
  disparaître avec la fiche).
- **Journal d'audit** : chaque proposition, confirmation, mise à l'écart, préparation, envoi et correction de la date de
  qualification.
- **Rappels** : traités par l'automate de rappels existant, indépendamment de l'activation du module des écarts.

## Ce qui n'est pas fait

- Aucun envoi automatique vers un portail : les portails sont des formulaires web, la déclaration reste un geste du RSSI.
- Pas de suivi de la notification CNIL ni de l'information des personnes (RGPD), qui restent dans « Obligations à vérifier ».
- Pas de lien avec la cellule de crise, dont les échéances restent propres à la cellule.

## Conséquences

- Les délais légaux sont visibles et rappelés ; la preuve de déclaration (contenu, date, référence) est figée et opposable.
- Un incident déclaré ne peut plus être supprimé.
- Le rôle prédéfini « RSSI » devient nécessaire pour déclarer : sans compte qui le tienne, aucune déclaration ne peut être
  confirmée ni marquée envoyée (même règle que les alertes du module Vulnérabilités).

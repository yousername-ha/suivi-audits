# ADR 0078 — Disposition et partage du tableau de bord de l'accueil

- Statut : acceptée (lot 2a)
- Date : 2026-10-29
- Contexte : étape 2 de l'[ADR 0069](0069-tableau-de-bord-verre-et-relief.md) (backlog DEV-004). Décisions du RSSI du
  29/10/2026 : on commence par la **disposition** (déplacer, redimensionner, masquer les dalles), au glisser-déposer et au
  clavier ; chaque personne a **son** tableau de bord, enregistré côté serveur ; une disposition **par défaut** est
  proposée à tous ; une personne peut **partager** son tableau de bord avec une ou plusieurs personnes ou groupes.

## Décision

1. **Ce qui est enregistré : une disposition, jamais des données.** Une disposition est la liste ordonnée des dalles du
   tableau de bord, chacune avec sa largeur (3, 4, 6, 8 ou 12 colonnes sur 12) et son état masqué ou affiché :
   `{dalles: [{id, largeur, masquee}]}`. Les identifiants sont ceux du catalogue `DALLES_TABLEAU_DE_BORD`
   (`packages/shared/src/disposition-tableau-de-bord.ts`) ; un identifiant inconnu, en double, une largeur hors liste ou
   plus de dalles que le catalogue sont refusés (422). Les valeurs affichées viennent toujours de la synthèse filtrée
   selon les droits de **la personne qui regarde** : une dalle sans donnée lisible n'apparaît pas, quelle que soit la
   disposition.
2. **Stockage.** Table `tableaux_de_bord` (migration `047`) : `proprietaire` (compte, supprimé avec lui) ou `NULL` pour
   la disposition par défaut de l'organisation, `nom`, `disposition` (JSON, 16 Kio au plus), `version`, auteur et date
   de la dernière modification. Une seule disposition personnelle par compte et une seule par défaut (index uniques) ;
   le lot 2b pourra lever la première contrainte pour plusieurs tableaux par personne.
3. **Disposition affichée.** Celle de la personne si elle existe, sinon celle de l'organisation, sinon la disposition
   standard du lot 1 (ordre et largeurs de l'ADR 0069, inchangés). Une dalle ajoutée par une version ultérieure et
   absente d'une disposition enregistrée s'affiche à la fin, à sa largeur standard ; une dalle retirée du catalogue est
   ignorée à la lecture.
4. **Routes** (`route()`, concurrence optimiste par `If-Match`, version `0` pour une création, 412 en cas de conflit) :
   - `GET /api/tableau-de-bord/disposition` (toute personne connectée) : sa disposition et celle de l'organisation ;
   - `PUT` et `DELETE /api/tableau-de-bord/disposition` : enregistrer la sienne, ou revenir à la disposition par
     défaut ; non journalisés (préférence personnelle, sans donnée) ;
   - `PUT` et `DELETE /api/admin/tableau-de-bord/disposition-par-defaut` (droit `administration:administrer`) :
     définir la disposition proposée à tous, ou revenir à la standard ; journalisés
     (`tableau_de_bord.defaut_enregistre`, `tableau_de_bord.defaut_supprime`). Elle ne remplace pas les dispositions
     personnelles déjà enregistrées.
5. **Interface** (lot 2a). Bouton « Modifier la disposition » au-dessus des dalles. En mode modification, chaque dalle
   porte une poignée (glisser à la souris ou au doigt par les évènements de pointeur ; flèches, Origine et Fin au
   clavier, avec annonce du nouveau rang), un choix de largeur et « Masquer » ; les dalles masquées se réaffichent depuis
   la liste en tête. « Enregistrer », « Annuler », « Revenir à la disposition par défaut » ; pour un administrateur,
   « Proposer cette disposition à tous » et « Rétablir la disposition standard pour tous ». Aucune dépendance nouvelle,
   aucun style en ligne (CSP, [ADR 0006](0006-front-react-mantine-csp-stricte.md)) : le glissé réordonne la grille en
   direct, sans élément flottant positionné par script.
6. **Partage** (lot 2b, non réalisé dans ce lot). Une personne partage sa disposition, en lecture, avec des comptes ou
   des groupes ; la personne qui reçoit choisit d'afficher son propre tableau ou un tableau partagé, et peut le copier
   comme le sien. Le partage ne transmet **que la disposition** : chacun voit les dalles avec ses propres droits (point
   1), aucun chiffre n'est copié ni transmis. Il exigera une table de partage, des routes et des contrôles de droits
   testés, et sera décrit ici avant d'être livré.
7. **Réglages des dalles** (lot 2c, non réalisé) : métrique, visualisation, cible et seuils par dalle, bibliothèque de
   dalles. Les seuils restent d'ici là les seuils d'affichage de l'ADR 0069.

## Conséquences

- Migration additive `047` : aucune donnée existante n'est modifiée ; sans disposition enregistrée, l'accueil ne change
  pas.
- Le bouton « Modifier la disposition » apparaît sur l'accueil : les captures de référence du tableau de bord changent et
  sont relues dans la PR (règle de CONTRIBUTING).
- L'écran mural (`/mur`) et la synthèse du Pilotage ne sont pas concernés.
- Une disposition ne contient aucune donnée personnelle ni métier : elle est incluse dans les sauvegardes avec la base,
  sans précaution particulière.

## Alternatives écartées

- *Préférences d'affichage existantes (`users.preferences`)* : simples pour une disposition personnelle, mais ni
  disposition par défaut, ni partage, ni version propre.
- *Bibliothèque de glisser-déposer* : dépendance nouvelle et souvent des styles en ligne, contraires à la CSP ; les
  évènements de pointeur et le clavier suffisent pour réordonner une grille.
- *Copier les chiffres dans un tableau partagé* : contournerait les droits de la personne qui reçoit le partage.

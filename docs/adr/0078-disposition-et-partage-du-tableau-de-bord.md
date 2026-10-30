# ADR 0078 — Disposition et partage du tableau de bord de l'accueil

- Statut : acceptée (lots 2a et 2b)
- Date : 2026-10-29
- Rédaction : session « Dashboard maquette personnalisable »
- Contexte : étape 2 de l'[ADR 0069](0069-tableau-de-bord-verre-et-relief.md) (backlog DEV-004). Décisions du RSSI du
  29/10/2026 : on commence par la **disposition** (déplacer, redimensionner, masquer les dalles), au glisser-déposer et au
  clavier ; chaque personne a **son** tableau de bord, enregistré côté serveur ; une disposition **par défaut** est
  proposée à tous ; une personne peut **partager** son tableau de bord avec une ou plusieurs personnes ou groupes.
  Décisions du RSSI du 30/10/2026 (lot 2b) : un **droit dédié** pour créer, modifier et partager un tableau de bord, qui
  donne aussi accès à la liste des personnes et des groupes ; la disposition personnelle lui est aussi réservée ; la
  personne qui reçoit choisit le tableau affiché et peut le copier ; un seul tableau par personne ; partage journalisé,
  sans notification.

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
   de la dernière modification. Une seule disposition personnelle par compte et une seule par défaut (index uniques),
   maintenues au lot 2b (un seul tableau par personne, décision du RSSI du 30/10/2026).
3. **Disposition affichée.** Le tableau choisi par la personne s'il lui est encore visible (lot 2b, table
   `tableaux_de_bord_choix`), sinon le sien, sinon celui de l'organisation, sinon la disposition standard du lot 1 (ordre et largeurs de l'ADR 0069, inchangés). Une dalle ajoutée par une version ultérieure et
   absente d'une disposition enregistrée s'affiche à la fin, à sa largeur standard ; une dalle retirée du catalogue est
   ignorée à la lecture.
4. **Droit dédié** (lot 2b). Nouveau module de droits « Tableau de bord de l'accueil » (`tableau_de_bord`) ; seule
   l'action « Créer et modifier » (`tableau_de_bord:modifier`) est utilisée : enregistrer sa disposition, la partager et
   consulter l'annuaire des destinataires. Rôles prédéfinis : Administrateur, RSSI et Contributeur l'ont ; Lecteur et
   Auditeur externe ne l'ont pas ; un rôle personnalisé le reçoit sur décision d'un administrateur (aucun rôle
   personnalisé existant ne le reçoit d'office). Le module peut être désactivé comme les autres modules non protégés.
   Sans ce droit, on affiche la disposition par défaut ou un tableau partagé ; une disposition personnelle enregistrée
   avant le lot 2b reste affichée et « Revenir à la disposition par défaut » reste possible.
5. **Routes** (`route()`, concurrence optimiste par `If-Match`, version `0` pour une création, 412 en cas de conflit) :
   - `GET /api/tableau-de-bord/disposition` (toute personne connectée) : sa disposition, celle de l'organisation, les
     tableaux partagés avec elle (disposition et nom de l'auteur) et le tableau qu'elle a choisi d'afficher ;
   - `PUT /api/tableau-de-bord/disposition` (`tableau_de_bord:modifier`) : enregistrer la sienne, qui devient le tableau
     affiché ; copier un tableau reçu passe par cette route ; non journalisé (préférence personnelle, sans donnée) ;
   - `DELETE /api/tableau-de-bord/disposition` (toute personne connectée) : revenir à la disposition par défaut ; ses
     partages disparaissent avec elle (journalisé, `tableau_de_bord.partage_supprime`, s'il y en avait) ;
   - `PUT /api/tableau-de-bord/choix` (toute personne connectée) : afficher le sien, celui de l'organisation ou un tableau
     reçu (`null` : choix automatique) ; un tableau qui ne lui est pas visible est refusé (404). La visibilité est
     recontrôlée à chaque lecture : un partage retiré, un départ du groupe ou un tableau supprimé ramène au choix
     automatique ;
   - `GET /api/tableau-de-bord/annuaire` (`tableau_de_bord:modifier`) : comptes actifs (nom affiché et identifiant, sans
     courriel), sauf soi, et groupes avec leur nombre de membres actifs ;
   - `GET` et `PUT /api/tableau-de-bord/partage` (`tableau_de_bord:modifier`) : destinataires de son tableau ; la liste
     complète est remplacée d'un coup (`If-Match` : version du tableau, incrémentée) ; tableau non encore enregistré :
     409 ; soi-même, compte inconnu ou inactif, groupe inconnu, doublon : 422. Journalisé
     (`tableau_de_bord.partage_modifie`, destinataires ajoutés et retirés) ;
   - `PUT` et `DELETE /api/admin/tableau-de-bord/disposition-par-defaut` (droit `administration:administrer`) :
     définir la disposition proposée à tous, ou revenir à la standard ; journalisés
     (`tableau_de_bord.defaut_enregistre`, `tableau_de_bord.defaut_supprime`). Elle ne remplace pas les dispositions
     personnelles déjà enregistrées.
6. **Interface.** Lot 2a : bouton « Modifier la disposition » au-dessus des dalles. En mode modification, chaque dalle
   porte une poignée (glisser à la souris ou au doigt par les évènements de pointeur ; flèches, Origine et Fin au
   clavier, avec annonce du nouveau rang), un choix de largeur et « Masquer » ; les dalles masquées se réaffichent depuis
   la liste en tête. « Enregistrer », « Annuler », « Revenir à la disposition par défaut » ; pour un administrateur,
   « Proposer cette disposition à tous » et « Rétablir la disposition standard pour tous ». Aucune dépendance nouvelle,
   aucun style en ligne (CSP, [ADR 0006](0006-front-react-mantine-csp-stricte.md)) : le glissé réordonne la grille en
   direct, sans élément flottant positionné par script. Lot 2b : « Tableau affiché » (le sien, celui de l'organisation,
   « Tableau de bord de <auteur> » pour chaque tableau reçu) dès qu'il y a un choix ; « Partager » (personnes et groupes,
   liste avec recherche) ; « Copier comme mon tableau » sur un tableau reçu. Les boutons qui modifient n'apparaissent
   qu'avec le droit ; la modification part du tableau affiché.
7. **Partage** (lot 2b). Une personne partage sa disposition, en lecture, avec des comptes ou des groupes (table
   `tableaux_de_bord_partages`, migration `050`, supprimée avec le tableau, le compte ou le groupe) ; un membre d'un
   groupe reçoit le partage tant qu'il en fait partie. Le partage ne transmet **que la disposition** : chacun voit les
   dalles avec ses propres droits (point 1), aucun chiffre n'est copié ni transmis. Le destinataire ne peut ni modifier
   ni repartager le tableau reçu ; il peut le copier comme le sien (avec le droit). Un seul tableau par personne : la
   contrainte d'unicité du lot 2a reste en place ; plusieurs tableaux nommés pourront venir sans changer les partages.
   Pas de notification au destinataire : le tableau reçu apparaît dans « Tableau affiché ».
8. **Réglages des dalles** (lot 2c, non réalisé) : métrique, visualisation, cible et seuils par dalle, bibliothèque de
   dalles. Les seuils restent d'ici là les seuils d'affichage de l'ADR 0069.

## Conséquences

- Migrations additives `047` et `050` : aucune donnée existante n'est modifiée ; sans disposition enregistrée, l'accueil
  ne change pas. La `050` ajoute aussi `tableau_de_bord` à la liste des modules désactivables.
- Le nombre de permissions passe de 70 à 75 (15 modules × 5 actions) ; la matrice des rôles affiche le nouveau module.
- Un compte qui n'a qu'un rôle personnalisé perd la modification de sa disposition tant qu'un administrateur n'ajoute
  pas le droit à ce rôle.
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

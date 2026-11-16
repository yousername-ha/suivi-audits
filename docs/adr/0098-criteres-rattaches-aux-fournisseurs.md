# ADR 0098 — Critères d'évaluation rattachés aux fournisseurs : sélection en masse, dernière réponse sur la fiche et la ligne

- Statut : **acceptée** par le RSSI le 15/11/2026, dans la session (numéro 0098 annoncé et accepté).
- Date : 2026-11-15
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- **Complète** l'[ADR 0032](0032-fournisseurs-de-l-organisation.md) (fournisseurs de l'organisation, lot M4) ;
  présentation dans le registre compact de la refonte Neon ([ADR 0093](0093-refonte-neon-charte-menu-et-accueil.md), lot 5).

## Contexte

Constat du RSSI : « dans Fournisseurs, je peux ajouter un critère mais il n'apparaît jamais dans les fournisseurs ». Depuis
l'ADR 0032, les critères d'évaluation (`sup_criteria`, page « Critères d'évaluation des fournisseurs ») ne servent que dans la
fenêtre « Évaluer » d'un fournisseur (cases à cocher), puis dans l'historique des évaluations. Rien ne dit quels critères
concernent quel fournisseur, ni où en est chacun d'eux.

## Décision

1. **Le registre des critères reste commun** à l'organisation (inchangé : définition, versions, retrait, droit
   `fournisseurs:administrer`).
2. **Rattachement par fournisseur.** Une table additive `sup_criterion_links` (migration `070_criteres_rattaches_fournisseurs.sql`)
   relie un critère à un fournisseur, désigné par son identifiant historique (le même que `sup_evaluations.supplier_id` et
   `sup_scope_links.supplier_id`), avec l'auteur et la date ; le couple est unique (clé primaire). Un critère **retiré reste
   rattaché** mais n'est plus proposé : on ne peut plus le rattacher à un nouveau fournisseur, on peut encore l'en détacher.
   Le rattachement ne porte aucune réponse. Pas de reprise de données (installation neuve).
3. **Sélection en masse depuis un critère.** Dans la page des critères, le bouton « Fournisseurs concernés » ouvre une fenêtre
   où l'on coche ou décoche plusieurs fournisseurs (recherche par nom, « Tout sélectionner » sur la liste filtrée), puis on
   enregistre en une seule opération : `POST /api/suppliers/criteria/{id}/suppliers` avec `{ attach: [...], detach: [...] }`.
   L'écran n'envoie que l'écart avec ce qu'il a lu ; un rattachement déjà présent ou un détachement déjà fait est ignoré, ce
   qui évite d'écraser le travail d'une autre personne. L'opération est transactionnelle : un fournisseur absent du registre
   l'annule en entier (404). Journal d'audit : `supplier.criterion.attached` et `supplier.criterion.detached`, un événement
   par sens, cible = critère, détail = liste des fournisseurs concernés.
4. **Depuis un fournisseur.** Sa fiche liste les critères rattachés et permet d'en rattacher un (`PUT
   /api/suppliers/{id}/criteria/{criterionId}`, 409 si déjà rattaché) ou d'en détacher un (`DELETE`, 404 si absent), avec les
   mêmes événements d'audit.
5. **Affichage.** `GET /api/suppliers` (et la lecture par périmètre) donne pour chaque fournisseur ses critères rattachés, retirés
   compris, avec la **dernière réponse** : celle de la plus récente évaluation du fournisseur (date d'évaluation, puis ordre
   d'enregistrement) **qui a porté ce critère** — Oui, Non ou Non évalué — et sa date. Un critère rattaché jamais évalué pour ce
   fournisseur apparaît « Non évalué ». La fiche montre le détail ; la ligne du registre un résumé compact (« 3/5 critères
   remplis · 1 non · 1 non évalué »), teinté selon la charte Neon (rouge si un critère n'est pas rempli, vert si tous le sont),
   avec le détail au survol. Ce n'est ni une note ni un seuil.
6. **« Évaluer »** coche d'office les critères rattachés (non retirés), regroupés en tête ; les autres critères actifs restent
   disponibles. L'évaluation reste immuable et inchangée côté serveur.
7. **Droits** (décision du RSSI). Lecture : `fournisseurs:lire`. Rattacher et détacher depuis la fiche du fournisseur :
   `fournisseurs:modifier`, le droit qui permet déjà d'évaluer. Sélection en masse depuis le registre des critères :
   `fournisseurs:administrer`, le droit de définition des critères.

## Ce qui n'est pas fait dans cette ADR

- Aucun score, aucun seuil, aucune obligation d'évaluer un critère rattaché.
- Le rattachement depuis la fiche n'est pas ouvert à `fournisseurs:modifier` (droit des évaluateurs) : question laissée au RSSI.

## Conséquences

- Migration additive `070` : une table, un index ; aucune table existante modifiée. La remise à vide la vide avec les autres
  tables des fournisseurs ; le contrôle des relations signale un rattachement vers un fournisseur absent du registre.
- Le jeu de démonstration rattache des critères à trois fournisseurs (dont un critère jamais évalué).

# ADR 0033 — Importer dans la bibliothèque les référentiels déjà saisis dans l'outil de suivi (lot M4 suite)

**Statut** : proposée le 13/10/2026. Complète l'[ADR 0031](0031-bibliotheque-de-referentiels.md). Demande du RSSI : « fournis les
référentiels, je te les ai donnés » (ISO/IEC 27001:2022, Annexe A, HDS, ReCyF).

## Contexte

Les clauses ISO 27001 (33), les mesures de l'Annexe A (93), les exigences HDS (31) et le ReCyF 2.5 (152 exigences, 20 objectifs)
sont **déjà** dans l'état de l'outil historique (`app_state`, jeu de départ `apps/api/seed/state.json`). Ils n'existent pas dans la
bibliothèque (ADR 0031), donc ne peuvent être ni rattachés à un périmètre ni rapprochés entre eux. Les données de départ d'une
installation restent vides : rien ne peut être importé automatiquement.

## Décision

1. **Action d'administration explicite**, jamais automatique : « Importer depuis l'outil de suivi » dans la Bibliothèque
   (droit `conformite:modifier`). `GET /api/library/tracker-import` **simule** (aucune écriture) : par référentiel, nombre
   d'exigences et de domaines, doublon éventuel, points d'attention, empreinte de simulation (`previewId`).
   `POST /api/library/tracker-import` importe **un** référentiel, en version 1 immuable, avec `confirm: "IMPORTER"` et
   l'empreinte reçue ; une simulation périmée ou un identifiant déjà présent est refusé (422, 409).
2. **Rien d'inventé.** Seuls les champs présents dans l'état sont repris :
   - ISO/IEC 27001:2022 (clauses et Annexe A, un seul référentiel `iso-27001-2022`) et HDS : **intitulés uniquement**
     (`description` et `applicability` vides) — le texte des exigences n'est pas dans l'outil de suivi et la norme est protégée.
   - ReCyF (et tout référentiel de la liste `frameworks` ayant la même forme) : texte de l'exigence, intitulé de l'objectif
     (domaine), portée indiquée. **Non repris** : correspondances, auto-évaluations et commentaires, qui sont des données de
     périmètre (la bibliothèque ne porte aucun lien vers une mesure).
3. **Statut de la source honnête** : `unverified`, `normative: false`, `verifiedAt` vide, licence « non renseigné » quand l'état
   ne la donne pas. L'aperçu rappelle « Source non vérifiée ». Les URL sont celles déjà citées dans la documentation du dépôt
   (iso.org, esante.gouv.fr, cyber.gouv.fr) : des points d'entrée à vérifier, pas des liens vers le texte.
4. **Intitulés tronqués** : les 31 intitulés HDS se terminent par « … » dans l'outil de suivi ; ils sont repris tels quels et
   signalés dans la simulation. Le texte complet reste à ressaisir par l'organisme.
5. Pas de migration : l'import utilise les tables de l'ADR 0031 et le journal d'audit existant (`library.framework.published`).

## Conséquences

- Les trois référentiels de sécurité peuvent être rattachés aux périmètres et servir aux correspondances/rapprochements avec
  l'ISO 9001:2015 (lots suivants), sans ressaisie.
- L'import ne remplace pas l'outil de suivi : celui-ci reste la source des évaluations ; une mise à jour ultérieure des
  intitulés se publie comme nouvelle version par l'import manuel de la bibliothèque (hors de ce lot).

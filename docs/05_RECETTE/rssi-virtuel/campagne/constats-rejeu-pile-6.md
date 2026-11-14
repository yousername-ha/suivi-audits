# Constats du rejeu des cases C6-20 (pile 6, phase 3)

| Élément | Valeur |
| --- | --- |
| Code testé | `2e63e86` |
| Date | 13/11/2026, 02:05 à 02:15 (Europe/Paris) |
| Pile | `https://127.0.0.16`, après correction de l'outillage (exécutant d'exploitation disponible) |
| Objet | Retester les six cases de `agent-6.csv` et `agent-7-tranche-6.csv` rattachées à C6-20, écarté comme « outillage » |

Ce qui a été exécuté : trois sauvegardes demandées (deux par `rssi`, dont une au format téléphone, une par
`test7-admin`), toutes réussies (360,4 Ko, chiffrées, SHA-256 vérifié ; journal d'audit `backup.request`, `backup.start`,
`backup.success`) ; « Vérifier » (contrôle d'intégrité en lecture seule) sur une archive ; « Vérifier les mises à jour »
(GitHub injoignable depuis la pile). Aucune restauration, mise à jour, ni opération sur les certificats.

| Case | Résultat |
| --- | --- |
| `systeme/sauvegardes\|principal\|rssi\|rempli\|bureau` | défaut, R6-01 (et R6-02) |
| `systeme/mises-a-jour\|principal\|rssi\|rempli\|bureau` | défaut, R6-03 ; C6-22 toujours reproduit |
| `systeme/certificats\|principal\|rssi\|rempli\|bureau` | ok (remarque R6-04) |
| `systeme/sauvegardes\|principal\|administrateur\|rempli\|bureau` | ok |
| `systeme/sauvegardes\|sous-perimetre\|administrateur\|rempli\|bureau` | ok (réglage d'instance, arbre identique) |
| `systeme/sauvegardes\|principal\|rssi\|rempli\|telephone` | défaut, T6-04 (tableau des demandes coupé, « Annuler la demande » hors champ) |

### R6-01 — L'emplacement des sauvegardes affiché ne correspond pas à la destination réelle
- Gravité : mineur
- Étape du scénario : Système › Sauvegardes et restauration (rempli)
- Référence : ISO/IEC 27001:2022 7.5 ; mesure A.8.13
- Observé : `pilote.mjs ouvrir /systeme/sauvegardes` montre `textbox "Emplacement des sauvegardes sur le serveur"` à
  `/srv/sauvegardes/suivi-audits` et la commande `sudo ./scripts/backup.sh /srv/sauvegardes/suivi-audits` ;
  `GET /api/settings/sauvegardes` → `emplacement: "/srv/sauvegardes/suivi-audits"` (valeur saisie). La fenêtre
  « Certificats et opérations » affiche « Destination configurée : sauvegardes » (`GET /api/admin/exploitation` :
  `host.destination "sauvegardes"`), où vont réellement les sauvegardes demandées à l'écran. Le champ saisi n'est relié à
  rien et contredit l'autre écran.
- Attendu : afficher la destination réelle de l'exécutant, ou signaler l'écart avec le réglage saisi.
- Reproductible par : à écrire (comparer `settings.sauvegardes.emplacement` et `exploitation.host.destination`).

### R6-02 — Le renvoi « ci-dessous » vers la restauration guidée ne mène à rien
- Gravité : mineur
- Étape du scénario : Système › Sauvegardes et restauration
- Référence : ergonomie (pas d'impasse) ; mesure A.8.13
- Observé : « La restauration guidée, la planification et la rétention sont accessibles ci-dessous lorsque le pilotage
  serveur est activé. » : rien ne suit, ces fonctions sont dans « Certificats et opérations ». La colonne « Actions » des
  demandes réussies est vide ; « Restaurer » reste désactivé sans explication tant que l'archive n'est pas vérifiée.
- Attendu : un lien vers « Certificats et opérations », ou un texte juste, et le motif de désactivation de « Restaurer ».
- Reproductible par : à écrire.

### R6-03 — L'échec de la vérification des mises à jour n'est jamais annoncé
- Gravité : mineur
- Étape du scénario : Système › Mises à jour et versions
- Référence : grille RSSI (retour clair après chaque action)
- Observé : `pilote.mjs cliquer button "Vérifier les mises à jour"` ; `GET /api/updates` → `checking:false`,
  `checkError:true`, `status:"failed"` mais `phase:"checking"`. Pendant 90 s l'écran affiche à la fois « GitHub est
  temporairement indisponible… » et « Vérification des nouvelles versions en cours… », bouton désactivé ; puis « La
  vérification prend plus de temps que prévu… », alors que l'échec est connu. Le message « La vérification a échoué :
  GitHub est temporairement indisponible. » ne s'affiche jamais. Piste : `scripts/update-worker.py`, `finish()`, garde
  `phase` en cas d'échec, et `Updates.tsx` attend `phase !== 'checking'`.
- Attendu : l'échec annoncé dès qu'il est connu, bouton réactivé.
- Reproductible par : à écrire (pile sans accès à GitHub : `/api/updates` ne renvoie pas `checkError true` avec
  `phase "checking"`).

### R6-04 — Alerte d'expiration sur un certificat interne qui se renouvelle seul ; sujet vide
- Gravité : remarque
- Étape du scénario : Système › Certificats et opérations
- Référence : mesure A.8.24 ; ergonomie
- Observé : `alert "Expiration prochaine"` : « Le certificat expire dans 1 jour(s) » pour un certificat émis par
  `CN=Caddy Local Authority - ECC Intermediate`, valable 12 h, que l'écran dit renouvelé automatiquement ; champ « Sujet : »
  vide (`certificate.subject ""`).
- Attendu : pas d'alerte permanente pour un certificat interne renouvelé automatiquement ; nom de l'hôte (SAN) affiché
  quand le sujet est vide.
- Reproductible par : à écrire.

Aucune erreur JavaScript, CSP ni 5xx relevée. Heures en UTC et format de date « mm/dd/yyyy » : réglages du Chrome de la
recette, pas un défaut de l'application.

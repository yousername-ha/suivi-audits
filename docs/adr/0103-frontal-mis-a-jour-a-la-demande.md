# ADR 0103 — Frontal mis à jour à la demande, coupure annoncée sur la page de maintenance

- Statut : **acceptée** par le RSSI le 17/11/2026, dans la session (numéro 0103 annoncé et accepté ; « frontal à la demande »
  et « empreinte automatique » retenus).
- Date : 2026-11-17
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- **Modifie** l'[ADR 0061](0061-mise-a-jour-web-renforcee.md) : le frontal stable n'est plus figé pour toujours pendant une mise
  à jour web ; l'exception ponctuelle de la 7.2.2 (addendum du 17/11/2026) devient la règle générale décrite ici, et la
  constante `FRONTAL_AVEC_LA_VERSION` est retirée.

## Contexte

Le frontal `gateway` (Caddy) sert le site, les certificats et la page de maintenance. L'ADR 0061 le fige à `GATEWAY_VERSION`
pendant une mise à jour depuis l'interface : la page de suivi ne s'interrompt jamais, mais un serveur mis à jour de cette façon
garde indéfiniment l'ancienne page de maintenance et l'ancien Caddy. La 7.2.2 a levé ce blocage une fois, pour servir la page
de maintenance Neon, avec une coupure de quelques secondes acceptée par le RSSI.

Le RSSI demande (17/11/2026) que la page de maintenance prévienne quand un redémarrage global peut avoir lieu. Hors la 7.2.2,
aucune mise à jour web ne redémarre le frontal : la seule coupure possible de la page est celle du frontal. Plutôt que de
revenir au frontal figé, le RSSI retient une mise à jour du frontal **à la demande**, décidée automatiquement, et annoncée.

## Décision

1. **Empreinte du frontal.** L'image `web` contient, calculée à sa construction, une empreinte SHA-256 de tout ce que le
   frontal exécute ou sert : binaire Caddy, `Caddyfile.gateway` et `Caddyfile.internal`, `demarrer-gateway`, page de
   maintenance (fichiers, thème, polices). L'empreinte porte sur le contenu seul : deux constructions des mêmes fichiers
   donnent la même empreinte.
2. **Décision automatique.** À la fin d'une mise à jour web réussie (santé et contrôle des données de la nouvelle version
   réussis, maintenance encore active), l'exécutant de la version cible compare l'empreinte du frontal **en service** à celle
   de l'image `web` **vérifiée** de la cible :
   - identiques : rien n'est touché, `GATEWAY_VERSION` ne change pas, aucune coupure ;
   - différentes, ou frontal en service sans empreinte (image antérieure à cette ADR) : le frontal est mis à jour ;
   - empreinte de la cible illisible : le frontal n'est pas touché, avec l'avertissement « Frontal non mis à jour ».
3. **Mise à jour du frontal.** Procédure de l'addendum 7.2.2 de l'ADR 0061, inchangée : image locale égale à l'image signée et
   épinglée, configuration validée dans un conteneur éphémère (`demarrer-gateway --valider`), certificat servi relevé,
   `GATEWAY_VERSION` passée à la cible et frontal recréé, même certificat exigé, rétablissement de l'ancien frontal sinon (trois
   essais). Les réglages TLS ne sont ni transmis ni modifiés. L'application reste mise à jour quoi qu'il arrive au frontal.
4. **Coupure annoncée.** Avant la recréation, l'exécutant publie dans l'état de l'opération un indicateur de coupure prévue,
   retiré une fois le frontal vérifié ou rétabli. La page de maintenance affiche alors un encadré dédié : redémarrage du frontal
   du site, interruption de quelques secondes, reprise automatique, et la consigne de recharger la page si elle ne revient pas
   après une minute. Si la connexion se perd pendant une coupure annoncée, l'avis de connexion reprend ce message au lieu de
   l'avis générique.
5. **Limite connue.** L'encadré est affiché par la page du frontal **en service** pendant l'opération : il apparaît à partir des
   mises à jour lancées depuis une version qui contient cette ADR. La mise à jour qui l'introduit montre seulement le texte de
   l'étape, comme la 7.2.2.
6. La mise à jour en ligne de commande (`scripts/mettre-a-jour.sh`) est inchangée : elle recrée toute la pile, frontal compris.

## Conséquences

- Plus de constante à retirer à chaque version : une nouvelle page de maintenance ou un correctif Caddy atteint les serveurs
  mis à jour depuis l'interface, sans action de l'administrateur.
- Une coupure de quelques secondes de la page à la fin des seules mises à jour qui changent le frontal, annoncée sur la page.
- Une ancienne installation (frontal sans empreinte) voit son frontal mis à jour une fois, à la première mise à jour web.
- Toute modification d'un fichier servi par le frontal (page de maintenance, thème, polices) déclenche ce redémarrage.

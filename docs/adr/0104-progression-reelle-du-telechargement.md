# ADR 0104 — Progression réelle du téléchargement sur la page de maintenance

- Statut : **acceptée** par le RSSI le 18/11/2026, dans la session (numéro 0104 annoncé et accepté ; « octets réels » retenu).
- Date : 2026-11-18
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- **Modifie** la règle de la page de maintenance « aucune progression artificielle » (refonte Neon, page de maintenance) :
  la règle reste, mais une progression **mesurée** est désormais affichée pendant le téléchargement.

## Contexte

La page de maintenance montre, pendant l'étape « Préparation », une illustration de transfert dont la barre est animée en
continu. Elle ne mesure rien : la règle de la page interdit toute progression simulée (pourcentage, débit, durée). Le RSSI
demande (18/11/2026) que la barre se remplisse selon le téléchargement réel.

Le téléchargement réel est celui des trois images signées (`api`, `web`, `updater`) de la version cible, fait par l'exécutant
de mise à jour avant toute vérification de signature et avant l'arrêt de l'application.

## Décision

1. **Mesure en octets.** L'exécutant télécharge les images par l'API du moteur Docker (socket déjà monté), qui rend pour
   chaque couche les octets reçus et leur taille. Il calcule, pour l'ensemble des trois images, les octets reçus sur le total à
   télécharger. Le total est connu avant le début (tailles des couches lues dans les manifestes du registre) ; les couches déjà
   présentes sur le serveur ne comptent pas. La valeur ne recule jamais et ne dépasse jamais le total.
2. **Publication.** L'état public de l'opération porte `telechargement: {recu, total}` (octets), mis à jour au plus une fois par
   seconde pendant le téléchargement, et retiré ensuite. Aucune autre donnée (nom de couche, registre, identifiants) n'est
   publiée.
3. **Affichage.** La barre de l'illustration se remplit selon `recu / total`, avec le pourcentage et les tailles en Mo
   (exemple : « 62 % · 180 / 290 Mo »), exposés aussi aux technologies d'assistance. Sans cette donnée, la barre garde son
   animation décorative actuelle, sans aucun chiffre.
4. **Repli.** Si l'API ne peut pas servir le téléchargement (registre privé avec identifiants configurés, erreur de l'API),
   l'exécutant télécharge comme aujourd'hui avec la commande `docker pull`, sans progression publiée. La sécurité ne change pas :
   l'empreinte de chaque image, sa signature, son attestation SBOM et la révision de ses sources sont vérifiées après le
   téléchargement, exactement comme avant ; la barre pleine n'annonce rien d'autre que la fin du téléchargement.
5. **Règle conservée.** Aucune progression n'est simulée : pas de pourcentage, de débit ni de durée qui ne viennent pas d'une
   mesure publiée par l'exécutant.

## Conséquences

- La barre n'apparaît remplie qu'à partir des mises à jour lancées depuis une version qui contient cette ADR : le téléchargement
  est fait par l'exécutant de la version **installée**, et la page est celle du frontal en service.
- Sur une connexion rapide, l'étape ne dure que quelques secondes ; la barre est surtout utile sur une connexion lente.
- Un code de téléchargement de plus dans l'exécutant, couvert par des tests (flux simulé de l'API, repli, bornes).

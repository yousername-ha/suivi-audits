# ADR 0104 — Progression réelle du téléchargement sur la page de maintenance

- Statut : **acceptée** par le RSSI le 18/11/2026, dans la session (numéro 0104 annoncé et accepté ; « octets réels » retenu).
- Date : 2026-11-18
- **Addendum du 19/11/2026** (décision du RSSI) : la valeur finale reste publiée, barre pleine, pendant la vérification des
  signatures qui suit le téléchargement (modifie le point 2 ; voir la dernière section).
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- **Modifie** l'[ADR 0020](0020-mise-a-jour-integree.md) (« Le système n'invente aucun pourcentage ») et la règle de la page de
  maintenance « aucune progression artificielle » (refonte Neon, `docs/refonte-neon/MAINTENANCE-LOT-1.md`) : la règle reste,
  mais une progression **mesurée** est désormais affichée pendant le téléchargement.

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

## Mise en œuvre (18/11/2026)

- **Total** : tailles des couches de la plateforme du moteur (`GET /version` : système et architecture), lues par
  `docker manifest inspect -v` (CLI déjà présente dans l'exécutant, qui joint déjà le registre pour cosign), une fois par
  couche partagée entre les trois images. Index sans entrée unique pour cette plateforme, manifeste illisible : repli.
- **Couches déjà présentes** : ni l'API du moteur ni le registre ne disent, avant le téléchargement, quelles couches le serveur
  possède déjà ; le flux le dit au début de chaque image (« Already exists »). Pour garder un total fixe, ces couches restent
  dans le total et comptent comme reçues dès leur annonce : la barre peut partir au-dessus de zéro (écart au point 1, « ne
  comptent pas », signalé au RSSI). Une image déjà à jour, dont le flux ne décrit aucune couche, compte entière à sa fin.
- **API du moteur** : chemins sans préfixe de version (version du moteur en service ; un préfixe fixe serait refusé par un
  moteur trop ancien ou trop récent). Délai de 900 s par image, comme `docker pull`.
- **Repli** : `DOCKER_CONFIG/config.json` (par défaut `/root/.docker`, monté par `UPDATER_DOCKER_CONFIG`) avec `auths`,
  `credsStore` ou `credHelpers` non vides, ou illisible ; ou API sans réponse exploitable avant le premier événement du flux
  (socket absent, statut HTTP autre que 200, première ligne illisible, flux vide) : `docker pull` pour l'image et les suivantes.
  Une erreur une fois le flux commencé (`error`, flux coupé ou illisible, délai) est un échec, sans nouvel essai : un repli à ce
  stade retéléchargerait l'image et pourrait masquer la cause ; l'administrateur relance la mise à jour.

## Addendum du 19/11/2026 — mesure finale gardée pendant la vérification (décision du RSSI)

**Constat** (serveur du RSSI) : la barre se remplissait bien pendant le téléchargement ; mais, une fois les images reçues,
l'étape « Préparation » continue (signatures cosign, attestations SBOM, révision des sources) et l'exécutant retirait
`telechargement` de l'état publié : la page repassait à l'animation décorative, sans aucun chiffre, comme si le téléchargement
reprenait. La dernière valeur pouvait en outre être retenue par la limite d'une publication par seconde.

**Décision** (modifie le point 2, « retiré ensuite ») :

1. **Valeur finale publiée et gardée.** Quand les trois images ont été tirées par l'API du moteur, l'exécutant publie aussitôt,
   sans attendre la seconde de la limite, la valeur finale `{recu: total, total}`, et la garde jusqu'à la fin de l'étape de
   préparation. Elle est retirée dès que la phase publiée quitte `preparing` (sauvegarde, ou toute autre phase), à la reprise
   d'une opération interrompue et à sa clôture (succès, échec, retour arrière) ; elle l'est aussi, comme avant, en cas d'échec du
   téléchargement ou de repli sur `docker pull`, et par un exécutant redémarré. L'état public ne porte toujours rien d'autre que
   `{recu, total}`.
2. **Affichage.** Reçu égal au total pendant la préparation : la page passe en `data-telechargement="termine"` ; la barre
   reste pleine avec « 100 % · X / X Mo », et une ligne écrite dans la page, masquée sinon, s'affiche : « Téléchargement
   terminé — vérification des signatures ». Les technologies d'assistance la lisent dans la valeur de la barre
   (`aria-valuetext` : « 100 %, X Mo sur X Mo, téléchargement terminé, vérification des signatures ») ; la zone annoncée reste
   le seul texte de l'étape. Un petit sceau, à côté de cette ligne, pulse (échelle et opacité) pendant l'attente ; il est
   immobile quand le poste demande moins d'animations, et figé si le suivi est interrompu. Il ne mesure rien : ni pourcentage,
   ni débit, ni durée de la vérification (point 5 inchangé).
3. **Limite connue, inchangée.** L'effet complet ne vaut que pour les mises à jour lancées depuis une version qui contient ce
   changement : c'est l'exécutant de la version installée qui télécharge et publie, et la page est celle du frontal en service.
   Les fichiers de la page changent, donc l'empreinte du frontal aussi : il est recréé une fois, à la fin de la mise à jour vers
   la version qui contient ce changement (coupure de quelques secondes annoncée, ADR 0103).

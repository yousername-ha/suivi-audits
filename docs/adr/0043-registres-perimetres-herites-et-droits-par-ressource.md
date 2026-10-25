# ADR 0043 — Registres, périmètres hérités et droits par ressource

**Statut** : acceptée le 20/10/2026 (proposée le 19/10/2026, lot L3 de l'intégration des interfaces ASTRA, [audit L0](../unification/AUDIT-L0-INTEGRATION-UI-ASTRA.md)) ; suites livrées dans la 3.6.0, voir l'addendum en fin de document.
Complète l'[ADR 0010](0010-droits-rbac.md) (droits de module), l'[ADR 0039](0039-hierarchie-des-perimetres.md) (hiérarchie) et
l'[ADR 0040](0040-sortie-du-json-plat-modules-en-tables.md).

## Contexte

Le prompt d'implémentation ASTRA confirme une règle fonctionnelle : un **registre** porte un ou plusieurs périmètres ; ses
éléments (actions d'un plan, écarts, séries et occurrences de tâches récurrentes) **héritent** ce rattachement, sans choix de
périmètre propre dans la fiche. L'audit L0 montre qu'aucune entité « registre » n'existe : chaque objet GRC porte son propre
`smsi_id`, et l'accès se décide par périmètre unique. Par ailleurs l'utilisateur demande une **gestion fine des droits** : un
utilisateur ou un groupe doit pouvoir avoir des droits sur une tâche, une action, un registre entier ou un plan, avec un
rôle **contributeur** qui remplit (par exemple marque une tâche récurrente comme réalisée) sans pouvoir la modifier.

## Décision

1. **Registre.** Table `registres` (famille `plan_actions`, `ecarts` ou `recurrences`, nom, description, version, archivage,
   indicateur « restreint »), table `registre_perimetres` (N-N vers `grc_smsis`). Un **périmètre de référence** est fixé à la
   création : il porte la politique métier épinglée, le fuseau et les responsables proposables ; il ne peut pas être retiré.
   Un plan est un registre de la famille `plan_actions`.
2. **Héritage sans copie.** Un élément référence son registre (`grc_objects.registre_id`) ; son `smsi_id` reste le périmètre de
   référence (aucun changement du code qui raisonne par périmètre, ni des tables immuables). Les périmètres affichés sont
   toujours résolus depuis le registre. Un registre est créé par défaut par famille et par périmètre (`par_defaut`) et accueille
   les éléments créés sans choix ; le périmètre commun reçoit trois registres « Pilotage commun » (reprise des données
   historiques, ADR 0040).
3. **Changement de périmètres** : commande atomique `PUT /api/registres/:id/perimetres` avec **aperçu d'impact** (éléments,
   séries, liens, droits, périmètres ajoutés et retirés), motif obligatoire, `If-Match`, trace au journal ; aucune écriture
   individuelle sur les éléments. Rattacher un registre à un périmètre exige de pouvoir le consulter.
4. **Droits par ressource.** Table `droits_ressources` : un utilisateur ou un groupe, sur un registre ou sur un élément, avec
   l'un des rôles `lecteur`, `contributeur`, `gestionnaire`. Le rôle effectif est le plus élevé parmi les droits directs et ceux
   des groupes de l'utilisateur, sur le registre et sur l'élément.
   - *lecteur* : consulte ;
   - *contributeur* : renseigne l'avancement (statut selon le workflow, compte rendu), par la commande dédiée
     `POST /api/grc/:smsi/objects/:id/contribution` ; ne modifie ni la définition, ni les dates, ni le responsable, ne crée ni
     n'archive ni n'attribue de droits ;
   - *gestionnaire* : modifie, crée dans le registre, archive, attribue les droits de la ressource.
5. **Cumul avec l'existant.** L'accès à un registre est accordé si **l'une** de ces conditions est vraie : administrateur ; rôle
   attribué suffisant ; droits de module (`ecarts`) et périmètres (lecture si au moins un périmètre est accessible, modification si
   **tous** le sont en écriture : un registre multi-périmètre ne se modifie pas depuis un seul périmètre). Un registre
   **restreint** supprime la troisième voie : seuls les droits attribués et les administrateurs y accèdent. Un droit attribué
   n'exige aucun droit de module ; le module `ecarts` doit seulement être actif.
6. **Aucune fuite.** Sans droit de lecture, la réponse est un 404 uniforme ; avec lecture mais sans le droit requis, 403 avec le
   rôle en clair. Un utilisateur ne voit que les périmètres du registre qu'il peut consulter ; les autres sont comptés
   (`autresPerimetres`), jamais nommés. Les éléments d'un registre restreint sont masqués des listes par périmètre.
7. **Reprise (migration 029, additive).** Chaque famille d'éléments déjà présente dans un périmètre reçoit un registre par défaut ;
   les occurrences vont dans le registre de tâches récurrentes de leur série ; les autres types d'objets (risques, preuves…) restent
   sans registre. Rien n'est supprimé ni réécrit hors ce rattachement. Le champ de périmètre en texte libre des fiches
   (`scope`, `entity`, `domain`) est conservé comme contexte historique.
8. **Traçabilité.** Création, modification, changement de périmètres, archivage et attribution ou retrait de droit sont écrits au
   journal d'audit append-only dans la transaction (auteur de session, horodatage serveur). Les décisions historiques
   immuables ne sont jamais réécrites par un changement de périmètre.

## Conséquences et limites assumées

- Le périmètre de référence d'un registre est définitif. Déplacer l'essentiel d'un registre vers un autre périmètre de référence
  passe par un nouveau registre (déplacement d'éléments : lot suivant).
- Les compteurs agrégés par périmètre (tableau de bord, mur) comptent encore tous les éléments du périmètre, registres restreints
  compris : à traiter avec les cartes de périmètres (lot L7).
- Les événements temps réel portent un seul périmètre (celui de référence) : un utilisateur qui n'a qu'un droit attribué ne reçoit
  pas encore les mises à jour en direct et recharge ses vues.
- Un registre multi-périmètre n'a qu'une politique métier (celle du périmètre de référence) ; les responsables proposés suivent
  ce périmètre. Le responsable de type groupe ou fonction fait l'objet d'un lot séparé.
- La validation OK/KO/NA d'une occurrence récurrente, avec preuve et immutabilité, reprendra le rôle de contributeur (lot L6).
- Cette ADR ne modifie ni les routes ni l'interface de la cartographie dynamique.

## Addendum du 22/10/2026 — le collaborateur (dossier 022-03)

Décision du RSSI (21/10/2026) : le « collaborateur » est le **rôle de contributeur** de cette ADR, sans nouveau rôle ; un membre
d'un groupe qui a le droit sur le registre contribue à tout le registre, une personne à qui une action est attribuée directement
ne contribue qu'à cette action (le droit par élément, déjà décrit plus haut). Ce qui manquait est livré :

- **Commentaire et preuve** : `POST …/objects/:id/contributions/commentaire` et `…/preuve`, `GET …/contributions` (migration 036,
  table `contributions_elements`). Rôle de contributeur requis pour écrire, de lecteur pour consulter ; 404 sans accès, 403 pour un
  lecteur. Seules les actions (occurrences comprises) reçoivent des contributions, jamais une action archivée.
- **Preuve** : version de document ou fiche de preuve que la personne peut lire (même contrôle que la validation d'occurrence,
  partagé dans `exigerPreuve`) ; sans le droit de lire les documents, elle peut commenter mais pas joindre.
- **Journal immuable** (aucune mise à jour ni suppression, même en base), auteur et horodatage fixés par le serveur, commande
  idempotente par `requestId`, trace d'audit `element.commentaire` et `element.preuve`. Les contributions ne touchent ni la
  version ni les champs de l'action.
- **Refus testés** (`collaborateur.test.ts`) : création d'action, de série et d'écart, modification, suppression, attribution de
  droits, changement de périmètres, autre action du registre pour un droit attribué sur une seule action.

## Addendum du 20/10/2026 — limites levées dans la 3.6.1

- **Déplacement d'un élément** : commande atomique avec aperçu d'impact, motif, `If-Match` et droit de gestion des deux
  registres (même famille) ; l'élément garde son identifiant, ses versions antérieures restent rattachées à leur ancien
  périmètre. Les constats historiques du périmètre commun, qui vivaient dans des tables propres sans registre, sont supprimés (migration 033) : tout écart est une fiche de registre, donc déplaçable.
- **Registres restreints et compteurs** : le tableau de bord des tâches, le calendrier, les compteurs partagés, les cartes de
  périmètres et le flux temps réel n'exposent ni élément, ni identifiant, ni version d'un registre restreint à qui ne peut pas
  le lire. Les droits attribués rétablissent la lecture.
- **Responsable de type groupe ou fonction** : `fonctions` et `fonction_membres` (migration 031) ; l'action ou la série porte
  soit `ownerId` (personne), soit `responsable` (groupe ou fonction), jamais les deux ; le serveur résout les titulaires actifs
  pour les rappels.
- **Plan d'actions conteneur** : période, statut, responsable et actions ordonnées portés par le registre de la famille « plan
  d'actions » (migration 032) ; l'ordre est une commande de gestion, versionnée et journalisée.
- **Cartes de périmètres** : chaque carte compte les éléments visibles dans son périmètre, les siens et ceux des registres qui le
  portent ; un élément n'est compté qu'une fois dans une carte, une occurrence de tâche récurrente que dans les récurrences ;
  un registre multi-périmètre figure dans chacune de ses cartes ; la carte d'un périmètre parent affiche son total avec ses sous-périmètres, et un total général est affiché sous les cartes, chaque élément n'y étant compté qu'une fois (conformité non agrégée).

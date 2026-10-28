# ADR 0067 — Attribution des droits par ressource réservée

- Statut : acceptée
- Date : 2026-10-28
- Contexte : revue de sécurité des droits par ressource (OWASP ASVS 4.0 niveau 2 ; ISO 27001:2022 A.5.15). Amende les paragraphes 4 et 5 de l'[ADR 0043](0043-registres-perimetres-herites-et-droits-par-ressource.md) (délégation par le gestionnaire ; rôle attribué suffisant sans droit de module) sans réécrire la décision d'origine.

## Décision

1. **Qui attribue.** Attribuer, modifier ou retirer un droit sur un registre ou sur un élément exige, **en plus** de la gestion de la ressource, l'une de ces deux conditions :
   - le **rôle de gestionnaire attribué** sur la ressource (la délégation prévue par l'ADR 0043 est conservée) ;
   - le droit **d'administrer le module** (`ecarts:administrer`, par la voie des modules et des périmètres) ; les administrateurs gardent la main.
   Un droit de module `modifier` et l'écriture sur les périmètres ne suffisent plus pour attribuer.
2. **On ne modifie pas ses propres droits.** Hors administrateurs, attribuer, modifier ou retirer un droit qui vise soi-même, ou un groupe dont on est membre, est refusé (403, « Vous ne pouvez pas modifier vos propres droits. »). Cela vaut pour l'aperçu d'une attribution.
3. **Registre restreint.** Passer un registre en « restreint », ou l'ouvrir, exige la même condition que l'attribution. Un renommage ou une modification d'autres champs reste ouvert à qui gère le registre. **Créer** un registre restreint reste permis à qui peut le créer : le créateur en devient gestionnaire (ADR 0043).
4. **Rang des rôles.** Un rôle supérieur au sien ne s'attribue pas lorsque l'on agit au titre d'un rôle attribué. Sans effet aujourd'hui (« gestionnaire » est le rang maximal), la règle est consignée pour l'avenir.
5. **Relations.** Créer ou retirer une relation depuis un élément d'un registre exige le droit de gérer cet élément (rôle attribué ou droit de module), comme toute autre écriture sur l'élément.
6. **Interface.** Le serveur calcule `peutAttribuer` pour un registre et pour un élément ; l'écran masque les commandes d'attribution, de retrait et le réglage « restreint » sans ce drapeau. Le serveur refuse de toute façon ce qui dépasse les droits.

## Conséquences

- Aucune migration. Les droits déjà attribués sont conservés ; rien n'est supprimé automatiquement.
- Un contributeur de périmètre qui gérait un registre par ses droits de module ne peut plus attribuer de droits sur ce registre ; il peut toujours le gérer (renommer, ordonner, archiver selon ses droits de module).
- Le journal `droit.accorde` permet une revue des attributions passées : celles où l'auteur et le titulaire sont la même personne méritent un examen.

# ADR 0095 — Un périmètre n'est visible que par rattachement : plus d'exception pour le périmètre commun

**Statut** : acceptée le 14/11/2026 (décision du RSSI du 13/11/2026, précisée le 14/11/2026 : « J'exige votre règle complète »). Numéro annoncé au RSSI.
Amende l'[ADR 0092](0092-refonte-des-droits-pyramide-des-perimetres.md) (pyramide des périmètres, lot 3 pour le périmètre commun) et l'[ADR 0039](0039-hierarchie-des-perimetres.md).

## Contexte

L'ADR 0092 fait valoir un accès sur un périmètre pour tous ses descendants, mais laissait le périmètre commun (visibilité « instance ») ouvert à
tout compte, rattaché ou non, puis à tout compte rattaché quelque part. Un compte rattaché au seul sous-périmètre voyait donc le périmètre commun
et ses données (BUG-037, BUG-044, BUG-051 ; rejeu de la recette du 14/11/2026, CAMP-T1-01).

## Décision

1. **Un périmètre n'est visible que d'un compte qui y a accès** : rattaché à ce périmètre ou à l'un de ses ancêtres (pyramide de l'ADR 0092).
   Aucune exception pour la visibilité « instance » : le périmètre commun suit la même règle.
2. **Conséquences** :
   - un compte sans aucun rattachement ne voit aucun périmètre ;
   - un compte rattaché à un périmètre enfant ne voit que ce périmètre et ses descendants : le parent et le périmètre commun lui sont
     invisibles, en lecture comme en écriture (404, comme pour tout périmètre non accessible) ;
   - un compte rattaché au parent voit le parent et ses enfants ; un compte rattaché à la racine garde tout ;
   - les administrateurs voient tout.
3. **Écriture** : un accès en écriture au périmètre ou à l'un de ses ancêtres (403 sinon, en lecture seule).
4. Le calcul est fait en base par `grc_smsi_visible(périmètre, compte)` (migration `062`, fonction pure, additive), utilisé par l'accès à un
   périmètre, la liste des périmètres, les responsables proposables et acceptés, et les rappels d'échéance.
5. Les registres historiques par périmètre (incidents, RETEX, crise, plans, DdA, objectifs, indicateurs, processus) ne servent que les périmètres
   lisibles par ce calcul ; une entrée sans périmètre relève du périmètre commun, donc d'un compte qui y a accès. La liste des mesures de l'outil de
   suivi et les registres encore communs (clausier, fournisseurs, pages d'audit) restent gouvernés par les droits de module.

## Conséquences

- Aucune reprise de données : un compte existant non rattaché perd l'accès jusqu'à son rattachement ; les comptes rattachés à la racine gardent
  tout. L'instance n'est pas en production.
- **À relire avant la mise à jour d'un serveur peuplé** : un compte rattaché à un enfant seulement ne voit plus le périmètre commun. Le rattacher
  aussi à la racine pour le lui rendre.
- Le retrait de la matrice de rôles et l'auditeur externe (reste du lot 3 de l'ADR 0092) ne sont pas traités ici.
- Retour arrière : la fonction est ignorée d'une version antérieure, qui retrouve la visibilité « instance » pour tous.

# ADR 0095 — Sans rattachement, un compte ne voit aucun périmètre

**Statut** : acceptée le 14/11/2026 (décision du RSSI du 13/11/2026, campagne de recette). Numéro annoncé au RSSI.
Amende l'[ADR 0092](0092-refonte-des-droits-pyramide-des-perimetres.md) (pyramide des périmètres) et l'[ADR 0039](0039-hierarchie-des-perimetres.md).

## Contexte

L'ADR 0092 fait valoir un accès sur un périmètre pour tous ses descendants, mais laisse les périmètres de visibilité « instance » (le périmètre
commun) ouverts à tout compte, rattaché ou non. Un compte créé et jamais rattaché voyait donc le périmètre commun et ses données (BUG-037, BUG-044).

## Décision

1. **Un compte sans aucun rattachement (aucune ligne de `grc_members`) ne voit aucun périmètre**, y compris un périmètre « instance » : 404, comme
   pour un périmètre inexistant. Les administrateurs voient tout.
2. **Un compte rattaché quelque part** garde le comportement de l'ADR 0092 : ses périmètres et leurs descendants, plus les périmètres « instance ».
3. Le calcul est fait en base par `grc_smsi_visible(périmètre, compte)` (migration `062`, fonction pure, additive), utilisé par l'accès à un
   périmètre, la liste des périmètres, les responsables proposables et acceptés, et les rappels d'échéance.
4. Les registres historiques par périmètre (incidents, RETEX, crise, plans, DdA, objectifs, indicateurs, processus) ne servent que les
   périmètres lisibles par ce calcul.
4b. **Écriture** : un périmètre « instance » ne s'écrit pas sans accès en écriture au périmètre ou à l'un de ses ancêtres (rejeu de la PR #269,
   CAMP-T1-01) : un compte rattaché au seul enfant lit le périmètre commun mais n'y écrit pas (403).

## Conséquences

- Aucune reprise de données : un compte existant non rattaché perd l'accès jusqu'à son rattachement. L'instance n'est pas en production.
- Lot 3 de l'ADR 0092 (commun = sommet de la pyramide réservé à ses pilotes) : cette règle en est une étape ; le lot 3 reste à livrer par la session
  « Refonte des droits d'accès ».
- Retour arrière : la fonction est ignorée d'une version antérieure, qui retrouve la visibilité « instance » pour tous.

# Maintenance Neon — dossier de portage pour l’IA

15 novembre 2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Ce complément concerne **l’écran autonome qui s’ouvre pendant une mise à jour**, avec animations par étape et journal technique. Le dossier général de refonte du 13 novembre reste dans le répertoire parent. Ce complément est prioritaire pour la maintenance ; il ne demande pas de recommencer les modules déjà intégrés.

**Livraison actuelle : documentation, captures originales et maquette de référence. Aucun code applicatif intégré.** La demande de ce dossier ne constitue pas une validation visuelle des dernières propositions. Ne pas intégrer ni lancer de tests/builds applicatifs pour ce nouveau lot avant l’accord visuel explicite demandé par l’utilisateur. La lecture des sources et le rendu isolé de la maquette sont possibles maintenant. Captures fixes d’abord ; aucune nouvelle vidéo avant leur validation.

## Lire dans cet ordre

1. [Prompt à donner à l’IA](01-PROMPT-POUR-IA.md).
2. [Exigences et statut exact](02-EXIGENCES-FINALES.md).
3. [Audit GitHub de l’existant](03-AUDIT-EXISTANT.md), à refaire sur la cible réelle.
4. [Portage UI et animations](04-PORTAGE-UI-ET-ANIMATIONS.md).
5. [Journal complet et secrets](05-JOURNAL-COMPLET-ET-SECRETS.md).
6. [Plan et recette future](06-PLAN-ET-RECETTE.md).
7. [Provenance et vérifications de cette livraison](07-PREUVES-ET-PROVENANCE.md).
8. [Atlas illustré](08-ATLAS-VISUEL.html), [images originales](visuels/03-erreurs-ensemble.jpg), [maquette](maquette/index.html).

GitHub affiche le HTML comme du code : consulter directement les images dans `visuels/`, ou télécharger le dossier avec ses sous-dossiers puis ouvrir l’atlas. Pour la maquette et les vérifications navigateur, servir les fichiers sur un serveur HTTP local : voir [son mode d’emploi](maquette/README.md). Aucun build requis.

## Références constatées, pas prescriptions de remplacement

| Rôle | Référence au 15/11/2026 |
| --- | --- |
| Branche active de l’IA Neon | `claude/refonte-neon` @ `28d48cacc3995200359fd4854286584a89d8b34f` |
| Branche de travail comparée | `claude-suivi-smsi` @ `8ff37b62fa5645368158d7c3b3c37ef40a177d65` |
| Branche de transmission avant ce complément | `codex/transmission-neon-opus-5-5` @ `fb1ca1448479c370bd3fcb112b824e9471ee5b61` |
| Sources locales de la proposition finale | `codex/refonte-neon-main` @ `89b5ac5` (SHA complet dans la provenance) |

Les branches peuvent avancer. Lire les instructions actuelles du dépôt, vérifier `git status`, le code existant et la version réellement exécutée. Les 16 fichiers centraux audités sont identiques entre les deux branches actives ci-dessus ; cela ne signifie pas que toutes leurs autres fonctionnalités sont identiques. La version Docker de l’utilisateur n’a pas été auditée.

**Ne pas fusionner cette branche de transmission comme une branche de code applicatif.** Elle est basée sur une révision ancienne. Lire ou importer uniquement les documents nécessaires, puis adapter les changements depuis la branche active selon les règles actuelles. Préserver toute implémentation plus récente. La cartographie SMSI, le menu définitif, l’assistant RSSI et les autres modules ne font pas partie de ce lot.

## Résumé technique pour l’IA

- Référence visuelle cumulative : SVG/HTML de `maquette/index.html`, huit couches CSS dans l’ordre documenté et quatre scripts de démonstration. Seuls les chemins d’assets ont été aplatis ; aucune logique métier ajoutée.
- Six images originales avec dimensions et empreintes, sans retouche ni agrandissement artificiel ; la planche 4K décrit une étude de mouvements antérieure au journal final.
- Audit distant : maintenance autonome déjà existante, polling et santé réels à conserver ; aucun flux autonome de logs de mise à jour actuellement disponible. Le journal API général existe, mais ne répond pas pendant l’arrêt API.
- Backend restant : collecte réellement complète, expurgation serveur, transport privé autonome et reprise par curseur. Aucun de ces éléments n’est implémenté par la maquette.
- Vérification de ce dossier : voir le rapport de conditionnement et le manifeste. Aucun test/build applicatif, mise à jour réelle, nouvelle vidéo, fusion ou déploiement.

Vérification documentaire, depuis la racine du dépôt :

```sh
python3 docs/transmission-opus-5.5/maintenance-neon/outils/verifier_dossier.py
```

# Preuves, provenance et résumé de livraison

15 novembre 2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

## Modifications effectivement réalisées

Ajout du complément `docs/transmission-opus-5.5/maintenance-neon/` à la branche de transmission documentaire ; point d’entrée racine mis à jour. Prompt, demandes finales, audit distant, plan de portage/recette, spécification du journal, matrice à remplir, atlas et référence visuelle autonome réunis. Aucun fichier applicatif, contrat, route, worker, Dockerfile d’exploitation ou configuration d’authentification modifié par cette livraison.

La branche d’implémentation `claude/refonte-neon` n’est pas modifiée. Le dossier général de 1 020 fichiers du 13/11 reste intact ; son manifeste d’origine demeure applicable à ses entrées. Ce complément possède un manifeste séparé, qui ne s’inclut pas lui-même.

## Provenance vérifiable

| Contenu | Provenance et transformation |
| --- | --- |
| Proposition cumulative | Source locale `89b5ac5d414c1b8f0187b77f645aca980ea5a495`. HTML issu de `maintenance-neon-journal-erreurs/index.html` ; seuls les préfixes relatifs des assets sont aplatis. Huit CSS et quatre scripts copiés sans altération, dans leur ordre initial. |
| Police | Inter existante dans le dépôt, copie inchangée de la proposition ; licence SIL OFL incluse depuis `packages/ui/src/fonts/LICENSE`. Pas de téléchargement de police externe. |
| Six images | Copies originales avec SHA-256, dimensions et sources dans [la provenance](annexes/PROVENANCE-MAQUETTE-ET-VISUELS.json) et [l’index visuel](annexes/VISUELS.json). Aucune retouche, recomposition ou montée en résolution. |
| Audit des sources actuelles | 16 fichiers comparés entre deux branches ; 22 instantanés uniques de la branche Neon, dont six lectures complémentaires, avec liens immuables, tailles, blob Git et SHA-256 dans [SNAPSHOTS-GITHUB.json](annexes/SNAPSHOTS-GITHUB.json). Sources publiques uniquement ; pas de journal privé réel consulté. |
| Source de publication | Base documentaire `fb1ca1448479c370bd3fcb112b824e9471ee5b61`, distincte de la branche de code active. Le SHA de la présente livraison est celui du commit qui ajoute ce dossier ; consulter l’historique GitHub. |

La planche 3840×2160 décrit les mouvements dans une étude antérieure au journal final/violet/rouge. Les ensembles récents sont natifs 1920×1080. Ne pas qualifier les six fichiers de captures 4K. Les détails ont leur définition native, affichable sans extrapolation.

## Vérifications réellement exécutées pour ce conditionnement

- Copie et empreintes des sources, médias et instantanés ; blobs des 16 sources centrales recoupés avec les métadonnées GitHub reçues. Inventaire et liens du dossier contrôlés par l’outil standard Python joint.
- Contrôle du manifeste d’origine du dossier général pour vérifier sa conservation. Contrôle du diff de publication : documents et références isolées uniquement.
- Rendu Chromium de la **maquette isolée aplatie**, pas de l’application : 12 scénarios à 1920×1080, assets locaux chargés, aucune erreur JS/HTTP détectée, absence de sous-dalle/titre du journal contrôlée par les styles calculés, rouge des erreurs vérifié en sombre et clair.
- Pause : le scénario et ses données restent actualisables ; mouvement réduit : aucune animation active dans ce contrôle. Cela ne constitue pas une recette de polling réel.
- Atlas documentaire chargé avec ses six images à 1280×720, 1440×900, 1920×1080 et 2560×1440, sans débordement horizontal. Vue de contrôle et maquette sombre ouvertes pour inspection. [Rapport navigateur détaillé](annexes/CONTROLES-NAVIGATEUR.json).

Le rendu du journal dans la première image temporaire de contrôle était pris avant la fin du mouvement d’entrée : cadrage repris après stabilisation pour inspection, sans modifier la maquette ou les images de référence. Les captures de contrôle restent hors dossier, pour ne pas les confondre avec les six références originales.

## Limites explicites

**Non exécutés ici :** nouveau test/build applicatif, lint/typecheck global de l’application, recette Docker, API, base, vraie mise à jour, lecture du log privé, collecteur, masquage serveur, authentification autonome, CI distante, nouvel audit complet d’accessibilité, vidéo, intégration, fusion ou déploiement. La version réellement utilisée chez le demandeur n’a pas été inspectée.

Les contrôles antérieurs des maquettes (autres tailles, analyses Axe, vidéos historiques) restent des résultats datés de ces versions ; ils ne sont pas attribués à ce complément ou à la cible actuelle. Le thème clair du prototype est une étude, pas une validation finale de contraste. Les 12 scénarios ne prouvent aucune transition réseau réelle ni l’absence de secret dans un futur backend.

## Reprise précise pour l’IA

1. Lire le prompt et refaire l’audit sur le checkout réel, remplir la matrice, conserver les évolutions déjà présentes.
2. Présenter les captures fixes et constater la validation visuelle de ce lot avant son portage applicatif ; ne pas demander à nouveau un accord déjà donné plus récemment dans son périmètre.
3. Porter UI autonome et contrat réel, puis instrumenter/expurger/autoriser le journal complet avec le composant stable retenu. Aucun endpoint de logs d’update n’est fourni par ce dossier.
4. Après accord et implémentation : tests ciblés, recette isolée, captures de l’application et compte rendu exact. Ne pas déclarer le lot complet avec seulement les fixtures ou un état de journal indisponible.

Commandes documentaires, depuis la racine du dépôt :

```sh
python3 docs/transmission-opus-5.5/maintenance-neon/outils/verifier_dossier.py
python3 docs/transmission-opus-5.5/outils/verifier_dossier.py
git diff --check
```

Le script du complément contrôle empreintes, inventaire exact, copies de provenance, snapshots et liens/ressources locaux ; il ne valide pas le code applicatif ni le contenu arbitraire d’un futur journal. Aucun secret ou fichier `.env` ne doit être ajouté aux preuves publiques.

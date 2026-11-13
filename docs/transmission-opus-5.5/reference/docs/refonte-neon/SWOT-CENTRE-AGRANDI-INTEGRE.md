# SWOT — centre agrandi validé et intégré

10/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Le demandeur a explicitement retenu le dernier modèle SWOT : « J’ai oublié de dire que j’adore le dernier modèle et que c’est celui ci qu’on garde pour le swot ». La [proposition de centre agrandi](propositions/organisation-swot-centre-agrandi/README.md) est **intégrée au commit `51d70229aa560cd466a92478b7e0a8d333e03014`**, sur `codex/refonte-neon-main`. Aucun nouvel accord préalable n’est nécessaire pour ce lot. La [proposition PESTEL](propositions/organisation-pestel-studio/README.md) et les Parties intéressées restent distinctes, en attente de validation.

## Rendu conservé

Le cercle du processus mesure 184 px sur ordinateur, 134 px sur tablette et 120 px sur téléphone. Il reste au croisement des quatre panneaux sur ordinateur et tablette ; sur téléphone il précède les panneaux empilés. Les quatre découpes circulaires et une réserve pour les titres, compteurs et boutons dégagent les textes. Les dernières lignes des panneaux supérieurs disposent aussi d’une marge pour les analyses longues.

Le libellé central suit la maquette : 28 px sur ordinateur, 22 px sur tablette et 21 px sur téléphone. Une ancienne règle locale qui le maintenait à 15 px a été retirée. Biseau, couleurs, pictogrammes, animations, pause et mise en avant au survol et au clavier sont conservés.

Le cercle ouvre toujours le résumé du processus. Les boutons Lire, la lecture agrandie, la fiche existante, le registre, ses filtres, l’historique et les droits restent disponibles. Aucun appel API, modèle, calcul, migration ou dépendance n’a changé. Le code applicatif se limite à un élément décoratif dans `SwotMatrice.tsx` et à `packages/ui/src/neon-swot.css`.

## Visuels de l’application

- [Matrice claire HD](captures-swot-centre-agrandi/matrice-light-hd.png).
- [Matrice sombre HD](captures-swot-centre-agrandi/matrice-dark-hd.png).
- [Vidéo intégrée](captures-swot-centre-agrandi/animation-integree.mp4).

Captures natives Chromium de l’instance isolée et de ses données fictives existantes ; les dates et textes proviennent de l’application. Deux PNG de 3180 × 1404 px et une vidéo H.264 recadrée sur la matrice, sans retouche. [Manifeste des médias](captures-swot-centre-agrandi/captures.json).

## Contrôles exécutés

Node 26.13.0, Chromium système, instance de recette déjà isolée sur les ports 8087/5177, PostgreSQL 18 ; aucune base de production utilisée. Rapports bruts, comptes et sessions privés dans `/workspace/work/neon-swot-centre-integre` et l’instance de recette antérieure.

| Contrôle | Résultat |
| --- | --- |
| TypeScript web, ESLint, Prettier, compilation web | Codes 0 ; avertissements de taille des bundles et du script d’exploitation préexistants |
| Tests unitaires web / UI | 240 / 243 réussis, soit 483 |
| Trois parcours E2E existants, zéro rejeu | Réussis : lecture historique sans écriture, édition native et liens transverses, lecture seule et refus serveur 403 |
| Dimensions | 36 dispositions : deux thèmes, 390 à 1920 px, textes longs, lecture agrandie, fiche et processus ; aucun débordement horizontal ou défilement vertical intérieur dans les zones contrôlées |
| Centre et textes | 32 mesures complémentaires, dont survols et textes longs : centre à moins de 1 px du croisement sur ordinateur/tablette, aucun texte dans la réserve et aucun titre superposé au compteur |
| Accessibilité | 12 analyses Axe ciblées, sans violation détectée |
| Animations | Actives, pause, reprise et préférence de mouvement réduit vérifiées |
| Données | Analyse historique inchangée ; jeux natifs fictifs créés pour les contrôles, contenus conservés |

[Reçu de validation](captures-swot-centre-agrandi/validation.json) et [lecture de la vidéo](captures-swot-centre-agrandi/validation-video.json).

L’aperçu sert la compilation, pas les sources à chaud : les médias et contrôles finaux ont été repris après compilation de la correction typographique. La mesure des réserves utilise le diamètre calculé, puis vérifie les rectangles des textes et des titres. Aucun résultat de mesure non numérique n’est utilisé comme preuve.

Les captures finales n’ont effectué aucune écriture métier. Leurs préparations ont créé des objets fictifs dans des périmètres de recette dédiés ; les bascules de thème ont enregistré cinq préférences du compte fictif. Sept réponses 404 pour `/update/client.js`, fourni par la passerelle dans la pile complète, restent signalées comme observations d’environnement ; aucune autre erreur HTTP ni JavaScript observée lors des captures finales.

## Livraison locale

Archive de sources **`suivi-audits-neon-docker-swot-centre-agrandi.zip`**, avec guide et empreinte SHA-256. Le ZIP conserve les intégrations précédentes et exclut dépendances installées, comptes de recette, données locales, secrets et grands médias. Le PESTEL proposé n’y est pas intégré.

Pour mettre à jour la copie Docker Desktop existante, suivre le guide `LIRE-MOI-REFONTE.txt` du paquet : préserver `.donnees-dev` et la configuration locale, remplacer les sources puis recréer web/API avec le même projet `neon-refonte-test`. Aucune suppression de volume.

**Non exécutés : recette sur le Docker Desktop Windows du demandeur, CI distante ou déploiement. Aucun push.** Les limites métier et de focus historiques extérieures au lot restent documentées dans les comptes rendus précédents. Prochaine action : essai local du modèle retenu ; poursuivre séparément les retours sur le PESTEL.

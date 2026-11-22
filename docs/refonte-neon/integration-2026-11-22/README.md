# Refonte Neon compacte — intégration du 22/11/2026

Reprise par la session Coeur du [dossier préparé par la session « Codex »](../implementation-interface-2026-11-21/README.md)
(branche `codex/refonte-densite-2026-11-21`) : comparaison avec la version 7.5.1, intégration, correction des limites
documentées du prototype des fiches et recette sur une pile Docker réelle. Branche `claude/refonte-neon-compacte`,
PR de travail vers `claude-suivi-smsi`, **sans fusion ni déploiement**. Aucune migration, aucune dépendance nouvelle,
aucun changement du contrat de l'API. Données fictives uniquement.

## 1. Comparaison avec la version 7.5.1

La branche Codex part exactement de la 7.5.1 (huit commits au-dessus, aucun en retard). Rien de son contenu n'existait
donc dans la version actuelle ; la comparaison porte sur l'état de chaque lot au regard des règles du dépôt.

| Lot du dossier | Dans la 7.5.1 | Dans la branche Codex | Constat à la reprise | Dans cette livraison |
| --- | --- | --- | --- | --- |
| Densité de travail (jetons, normal plus serré que l'ancien compact) | Absent | Complet | Conforme (CSS statique, CSP respectée) | Repris tel quel |
| Outils communs (`BarreOutils`, `BarreFiltres`, filtres repliés) | Boîte d'outils des registres seulement | Étendu à 39 écrans | Défaut : la barre portait le même nom accessible que son champ de recherche (dix écrans) | Repris, défaut corrigé |
| Proportions des champs et des fenêtres | Absent | Complet | Conforme | Repris tel quel |
| Boutons en contour (`commande-neon`) | Absent | Complet | Conforme | Repris tel quel |
| En-tête (pastille « En direct » et signature d'organisation retirées) | Présentes | Retirées | Une coupure du temps réel n'était plus visible | Repris ; « Hors ligne » affiché si la coupure dure |
| Fiches sans défilement vertical (mini-menu) | Absent | Prototype | Cassait des parcours réels (voir § 2) | Moteur réécrit, limites corrigées |
| Essai « boîte d'outils claire ou bleu nuit » (Mon compte) | Présent | Retiré (bleu nuit partout) | Choix d'apparence fait par le lot | Repris ; à confirmer par le RSSI |
| Recette sur pile réelle, tests de bout en bout | — | Non faite | Dix parcours en échec sur l'import brut | Faite (§ 4) |
| Contrôle de qualité (lint) | Vert | Rouge (script de preuves en CommonJS) | — | Corrigé |

## 2. Ce que la recette réelle a montré sur le prototype

L'import brut de la branche Codex, joué sur une pile neuve, mettait en échec dix parcours de bout en bout. Causes :

- **Dernière rangée cachée sous les boutons.** La place du pied n'était pas réservée : la règle du prototype était
  écrasée par le retrait commun des fenêtres (`neon-harmonisation.css`, plus spécifique). C'est la coupure visible sur
  la capture « fournisseur » du dossier.
- **Contenu tronqué et inaccessible.** Un bloc qui ne peut pas être découpé (carte à débordement masqué, grille à
  requête de conteneur) et plus haut qu'une partie était coupé : dans « Sécurité », le bas du formulaire du poivre
  (saisie des huit caractères, code, bouton) n'était plus atteignable.
- **Clics perdus.** Un champ situé sur une autre partie, mis en vue par le navigateur, déclenchait un recalage de la
  fenêtre pendant le clic : la case ou la liste visée ne recevait pas le clic.
- **Noms accessibles en double** entre la barre d'outils et son champ de recherche.

## 3. Le moteur des fiches en parties

Fichiers : `apps/web/src/components/FichesSansDefilement.tsx` (mesure), `fiches-parties.ts` (règles pures),
`packages/ui/src/neon-fiches-pages.css`.

Principe conservé : la fragmentation CSS en colonnes ne démonte ni ne déplace aucun champ ; formulaires, valeurs,
contraintes et callbacks restent ceux de l'écran métier. Aucune balise de style injectée : attributs `data-*` et
propriétés personnalisées posées par le modèle objet CSS, comme ailleurs dans l'application (CSP inchangée).

| Limite documentée | Correction |
| --- | --- |
| Hauteur imposée à 90 %, partie presque vide | La fenêtre prend la plus petite hauteur qui garde le même nombre de parties : parties équilibrées, fenêtre à la taille du contenu. Une hauteur retenue est conservée tant qu'elle donne le même découpage (pas de saut à la frappe). |
| Groupes coupés au bord d'une partie | Place du pied réellement réservée ; rangées de champs, lignes de tableau et de liste, commandes et encadrés petits devant une partie sont indivisibles. |
| Intitulés « Suite 2 », « Analyse » répétés | Une section déclarée par le formulaire (`data-fiche-section`) ouvre une partie et la nomme ; sinon le titre placé en tête de partie ; sinon « Section (suite) ». Jamais d'intitulé générique ni répété. |
| Pieds atypiques | Pied reconnu aussi quand il est enveloppé dans un formulaire ou une pile ; sans pied reconnu, les boutons restent à leur place dans la dernière partie. |
| Focus d'un champ d'une autre partie | Accrochage natif du défilement (`scroll-snap`) sur un repère par partie : la fenêtre est alignée avant le clic, rien ne bouge sous le pointeur. |
| Erreurs | La partie qui contient une erreur nouvelle (message ou champ invalide) est affichée. |
| Documents intégrés, blocs indécoupables | Contrôle après chaque découpage : un champ tronqué, à cheval sur deux parties ou recouvert, un document intégré, un bloc plus haut qu'une partie, et la fenêtre **garde son défilement vertical habituel**. Un écran peut aussi le demander avec `data-fiche-defilement`. |
| Fenêtres imbriquées | Un découpage par fenêtre, clés stables à l'ouverture et à la fermeture. Les fenêtres RETEX gardent leur mise en page. |
| Partie fantôme | Si tout tient une fois le pied fixé, il n'y a qu'une partie et pas de menu. |

Sections déclarées dans cette livraison : fiche de risque (« Informations », « Analyse », « Liens et preuves »). Les
autres fiches utilisent les intitulés tirés de leurs titres ; déclarer une section se fait en posant
`data-fiche-section="Nom"` sur le titre ou le bloc qui l'ouvre.

**Limite assumée.** Le principe « aucune fiche ne défile verticalement » n'est pas tenu quand le contenu ne peut pas
être découpé sans risque (carte ou grille plus haute qu'une partie, document intégré) : la fenêtre défile alors comme
dans la 7.5.1. C'est le cas de « Sécurité » en 1280 × 720 (trois parties entières en 1920 × 1080).

## 4. Recette

Voir [RECETTE.md](RECETTE.md) : contrôles locaux, recette de bout en bout sur la pile réelle, cas obligatoires du
dossier, tests modifiés et captures de référence à valider par le RSSI.

## 5. Ce qui reste à décider ou à faire

- **Validation du RSSI** : captures de référence régénérées et tests de bout en bout modifiés (liste dans la recette).
- Essai « boîte d'outils claire ou bleu nuit » : le lot retient le bleu nuit ; la préférence enregistrée n'a plus
  d'effet. À confirmer, puis retirer le champ du schéma des préférences.
- Sections métier à déclarer sur d'autres fiches longues si leurs intitulés automatiques ne conviennent pas.
- La branche `codex/refonte-densite-2026-11-21` et sa PR restent en l'état ; elles ne sont pas fusionnées.

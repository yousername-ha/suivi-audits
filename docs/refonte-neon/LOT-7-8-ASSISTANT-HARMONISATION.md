# Refonte Neon — lots 7 et 8 : Assistant RSSI et harmonisation

14/11/2026. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), branche `claude/refonte-neon`, partie de
`claude-suivi-smsi` (version 7.1.0). Demande du RSSI : porter tous les lots restants sans s'arrêter, pour la version 7.1.1.
Décisions : [ADR 0093](../adr/0093-refonte-neon-charte-menu-et-accueil.md), points 15 et 16.

## Lot 7 — Assistant RSSI

La cible portait déjà l'interface de l'Assistant validée en `04a310f` (panneau global, boîte « Pour vous », brouillons) et
raccordée au service réel par sa propre session ([ADR 0086](../adr/0086-assistant-rssi-integre.md)). La dernière direction
validée (`d9d1478`, « Bibliothèque Studio et Assistant Neon ») y ajoute :

- **avatar vectoriel 96×96** (`apps/web/src/assistant/IdentiteAssistant.tsx`) : bouclier et bulle redessinés, tracés nets,
  dégradés à identifiants uniques (`useId`), couleurs dans la feuille de charte et non dans le JSX ;
- **habillage final** (`packages/ui/src/neon-assistant.css`, 316 lignes ajoutées en fin de feuille) : cadre de 2 px, contours
  intérieurs de 1,5 px, accents cyan et bleu, avatar de 60, 48 et 32 px selon l'endroit, cycle d'opacité du circuit (7 s) et
  clignement (9 s) en `opacity` et `transform`, arrêtés par la pause existante (`data-assistant-motion`), le mouvement réduit et
  l'impression.

Conservé tel quel : `AssistantGlobal.tsx`, `contrats.ts` (DTO réels de `@suivi/shared`), profils, brouillons, droits, limites et
raccordement au service. L'intitulé de section propre à la cible (`.as-dock .rr-kicker`) reste en fin de feuille. La feuille est
chargée par `styles.css` (`@import`) ; aucun import supplémentaire.

## Lot 8 — Harmonisation

- **Règles transversales vérifiées module par module** par les portages (rapports des lots 3 à 6) : couleurs tirées des seuls
  jetons existants (aucun hexadécimal dans les nouvelles feuilles), rayons de 12 px au plus, animations en `transform` et
  `opacity`, arrêtées par le mouvement réduit, l'impression et les couleurs forcées ; listes à défilement local et fiches à hauteur
  naturelle (lot 2) ; largeurs de 390 à 2560 px et zoom 150 % sans débordement de page.
- **CSS mort retiré** : sections, grille teintée et sous-éléments `.carte-processus__*` de l'ancienne grille des processus
  (`apps/web/src/app.css`). La règle `.carte-processus` reste : la carte Studio garde cette classe, lue par les tests.
- **Barre d'outils discrète des registres** (demande du RSSI du 14/11/2026, proposition « Vues en icônes et filtres à la
  demande » de la référence) : `apps/web/src/components/BarreOutils.tsx` (loupe, raccourci « / », pastilles des critères
  actifs), branchée sur le registre commun (`Registry.tsx`) et sur le Plan d'actions et les Tâches récurrentes (`Tasks.tsx`) ;
  style dans `lignes-fiches.css`. Les parcours de bout en bout remplissent directement « Rechercher », « Vue synchronisée »,
  « Mois », « Registre » et « Responsable » : ces champs restent donc affichés, au lieu d'être repliés dans un panneau comme
  dans la maquette. Les icônes de vues du Plan d'actions viennent du lot 6. Test ajouté : `apps/web/test/barre-outils.test.ts`.
- **Non repris** : « Rôles et responsabilités » (proposition non validée).
- **Code laissé en place** : `EtatsCouverture` (`apps/web/src/pilotage/Couverture.tsx`) n'est plus utilisé par la Bibliothèque ;
  le retirer est un nettoyage séparé.

## Points laissés à la décision du RSSI

1. **Vue par défaut des tâches** : la référence ouvre la Timeline ; la cible reste sur la liste, réglée par la politique métier
   (`defaultTaskView` dans `packages/shared/src/business-policy.ts`). Une ligne hors interface, non modifiée.
2. **Parties intéressées** : le bandeau « Synthèse des parties intéressées », conservé parce qu'un parcours le lit, coexiste avec
   les compteurs du panorama et peut afficher d'autres chiffres (constat RSSI-05). Le parcours hebdomadaire RSSI-05, marqué
   `test.fail`, cherche une ligne du registre désormais replié : il échoue toujours, mais ne signalera plus la correction du
   constat.
3. **Croix de fermeture des fenêtres** : sans nom accessible (règle axe `button-name`), avant comme après la refonte ; le lot 2
   n'a pas ajouté de nom par défaut parce que des tests cherchent un bouton « Fermer » par nom partiel.

## Contrôles

Après intégration des cinq portages et fusion de `claude-suivi-smsi` à jour : ESLint et Prettier sur tout le dépôt, `tsc` des cinq
paquets, Vitest shared 608, ui 284, web 380 (dont 129 ajoutés par les lots 3 à 6), construction de l'interface. Suite de bout en
bout complète et captures de référence : voir la PR.

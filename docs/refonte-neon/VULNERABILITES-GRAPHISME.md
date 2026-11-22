# Refonte Neon — Module Vulnérabilités : aspect graphique

22/11/2026. Session « Ergonomie et refonte Neon », branche `claude/vulnerabilites-graphisme`, partie de `claude-suivi-smsi`.
Demande du RSSI : le module « fait trop fin, trop lien hypertexte ». Module de la session « Module surveillance
vulnérabilités SMSI », prévenue avant les maquettes et avant l'intégration.

## Décisions du RSSI (22/11/2026)

Prises sur maquettes injectées dans les vraies pages, avec des données fictives (scan Nessus inventé, domaine
`example.org`, CVE inventées) :

1. **Style de la page de maintenance** (`docker/maintenance`) : grande dalle (biseau, bord teinté de violet, traits
   lumineux), en-têtes en capitales espacées, cartes d'état comme la carte « Étape » (liseré épais de la teinte, bord
   violet à droite, dégradé), liens d'action en boutons comme « Consulter le résultat dans l'application ».
2. **Moins de cyan, plus foncé** : le bleu nuit du menu (`--menu-fond-haut`) remplace le cyan en clair, un bleu doux
   assombri en sombre ; flèches en violet.
3. **Ligne allégée de « Failles détectées »** (choix « D ») : nom ; numéro, famille et source ; faits sans doublon. Le
   détail des sources (« d'abord… », « (1 source) ») et la règle du délai restent dans la fiche de la faille.
4. **Niveau d'alerte et chiffres clés** (proposition 1, avec vidéos) : réacteur animé dans le vocabulaire de la
   maintenance (croix de visée, graduations, anneau en tirets qui tourne, orbites et satellite, crans du niveau en arc)
   et six cases d'instrument sur deux colonnes (icône dans un carré bordé, numéro, trait lumineux quand une action est
   attendue). La proposition 2 (cadran à aiguille et mini-radars) est écartée.

## Fichiers

| Fichier | Changement |
| --- | --- |
| `packages/ui/src/neon-vulnerabilites.css` | Nouvelle feuille, limitée au module par `main[data-module='vulnerabilites']`, chargée après les autres. |
| `apps/web/src/components/Layout.tsx` | Attribut `data-module` sur la zone principale des pages du module. |
| `apps/web/src/vulnerabilites/Instruments.tsx` | Nouveau : réacteur (SVG décoratif), en-tête des cases, ondes. |
| `apps/web/src/vulnerabilites/VueEnsemble.tsx` | Niveau d'alerte posé sur le réacteur, règle repliée ; cases des chiffres clés. |
| `apps/web/src/vulnerabilites/FaillesDetectees.tsx`, `failles.ts` | Ligne allégée : `PrioriteCourte`, `DelaiCourt`, `SourceCourte`, `faitsListe`, `raisonPriorite`. |

Inchangés : libellés, liens, rôles et noms accessibles. Les flèches ajoutées en CSS ont un texte de remplacement vide
(`content: '→' / ''`) pour rester hors des noms accessibles. La source garde son texte complet pour les lecteurs d'écran
(« Source : … (Nessus, import de fichier) »), le type étant masqué à l'écran. La règle commune des liens (`styles.css`) pèse
(0,5,0) : la portée des règles de liens est doublée (`.app-main.app-main`).

Sous la CSP stricte (ADR 0006) : aucun style en ligne, positions par attributs SVG. Jetons de la charte seulement, ni px ni
rem ni couleur codée. Animations en `transform` et `opacity`, déclarées sous `prefers-reduced-motion: no-preference`, coupées
par le mouvement réduit et à l'impression (ADR 0099).

## Tests

Validés par le RSSI avant commit :

- `apps/web/test/vulnerabilites-failles.test.ts` : deux cas suivent la ligne allégée (un seul « Exploitation avérée »,
  raison courte de la priorité, source nommée). Les vérifications de la fiche sont inchangées.
- Spec e2e d'import Nessus : la ligne dit « Exploitation avérée » ; ajout de l'ouverture de la fiche, qui dit
  « Exploitée par un logiciel malveillant selon Tenable ».
- Nouveau `apps/web/test/vulnerabilites-graphisme.test.ts` (11 cas) : faits sans doublon, raison courte, délai, source,
  réacteur décoratif, règle repliée, feuille de style (jetons, portée, flèches décoratives, mouvement réduit).

## Relevés hors périmètre (signalés à la session Vulnérabilités)

- Machines : deux boutons de pagination sans nom (axe, « button-name »).
- Vue d'ensemble à 390 px : radar coupé à droite.

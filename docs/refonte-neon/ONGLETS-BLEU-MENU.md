# Onglets aux couleurs du menu, à l'essai

19/11/2026. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), branche `claude/onglets-page`,
partie de `claude-suivi-smsi`.

## Demandes et décisions du RSSI (19/11/2026)

1. Refonte visuelle des onglets de page (exemple : Calendrier des plans, Planning annuel des plans, Plan de formation, Plan
   de sensibilisation). Trois formes présentées sur maquettes (données fictives) : pastilles, soulignement bleu, barre bleu
   nuit.
2. Le RSSI retient deux formes pour les essayer sur la plateforme : la barre bleu nuit et les pastilles. La forme écartée
   sera retirée plus tard.
3. Chaque personne choisit sa forme dans Mon compte > Affichage, « Onglets de page (essai) ». Par défaut : la barre bleu
   nuit.
4. La forme s'applique à toute la plateforme.

## Réalisation

- Préférence d'affichage `onglets` (`'barre' | 'pastilles'`, facultative) dans `packages/shared/src/affichage.ts`,
  enregistrée sur le serveur avec les autres préférences, sans migration (colonne JSON des préférences).
- `apps/web/src/components/Layout.tsx` : attribut `data-onglets` sur `html` (`barre` par défaut).
- `apps/web/src/pages/Account.tsx` : réglage « Onglets de page (essai) » dans la carte Affichage.
- `packages/ui/src/neon-ergonomie.css`, section « Onglets, une seule forme sur toute la plateforme » : rubriques sous le titre
  des pages (`.onglets-rubriques`), onglets Mantine horizontaux des pages et des fenêtres, onglets du RETEX
  (`.retex-onglets`) et de l'Assistant RSSI (`.as-tabs`). Les onglets verticaux ne changent pas.
- Habillages d'onglets propres à un écran retirés : fenêtres (`neon-fenetres.css`), présentations du contexte
  (`neon-fenetres.css`), sélecteur de vues des objectifs (`neon-objectifs.css`).

## Pour retirer la forme écartée

1. Supprimer, dans `neon-ergonomie.css`, les règles `html[data-onglets='…']` de la forme écartée, et remplacer les sélecteurs
   `html:is([data-onglets='barre'], [data-onglets='pastilles'])` et `html[data-onglets='…']` de la forme gardée par `html`.
2. Retirer la préférence `onglets` (`affichage.ts`), l'attribut `data-onglets` (`Layout.tsx`) et le réglage (`Account.tsx`).
   Une valeur déjà enregistrée est ignorée à la lecture suivante.

## Tests

- Aucun test existant modifié. Captures de référence : 32 remplacées (onglets seulement), après régénération dans le
  conteneur Playwright officiel sur une pile neuve (261 tests réussis) et accord du RSSI sur les planches avant/après.

# Rôles et responsabilités — proposition Studio

12 novembre 2026 — Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

**Maquette indépendante à valider avant intégration.** Aucun changement applicatif depuis `67a334a`. Suite du parcours Organisation après Processus Studio ; ces rôles métier sont distincts des permissions de comptes dans Administration.

[Image HD sombre, 3840 × 2160](responsabilites-hd.png) · [Aperçu interactif autonome](apercu-autonome.html) · [Reçu des contrôles](validation.json).

## Présentation

- Trois cartes centrées, titres lisibles, palette cyan/bleu/ambre dans la charte Studio. Titulaire et suppléant séparés ; responsabilités, ressources et engagement ont chacun leur rubrique.
- Le + centré en bas déplie la carte en largeur, avec contacts visibles. La carte développée passe en tête dans le DOM : ordre visuel et clavier cohérent.
- Toute la surface principale ouvre une consultation distincte du formulaire. Liste compacte ouvrable au clavier, recherche par loupe et filtres discrets : rôle métier, titulaire renseigné et engagement renseigné.
- Défilement local au registre pour les listes longues ; dispositions adaptées aux fenêtres PC plutôt qu’une réduction générale de l’interface.
- Léger relief au survol et au focus, anneau décoratif lent, pause et préférence de mouvement réduit. Les couleurs ne représentent aucun état de conformité.
- Valeurs absentes affichées « Non renseigné ». Les compteurs indiquent uniquement les données présentes : trois rôles, aucun titulaire renseigné, un texte d’engagement renseigné. « Engagement signé » est le texte source, sans vérification de signature.

## Données et contrats existants

`donnees.js` reprend uniquement les champs de présentation de l’archive fictive `jeu-test-suivi-audits/tables/suivi_roles.json`. Aucune donnée de comptes copiée. Le service local 5174 n’était pas disponible ; aucun redémarrage Docker n’a été effectué pour cette proposition. Aucune lecture de l’API courante ni écriture serveur.

| Champ canonique | Sens / origine historique |
| --- | --- |
| `holder` | Titulaire, texte libre |
| `deputy` | Suppléant, texte libre |
| `email` | Adresse de contact |
| `phone` | Téléphone |
| `role` | Rôle métier |
| `responsibilities` | Responsabilités, champ historique `resp` |
| `resources` | Ressources et compétences |
| `commitment` | Engagement et délégation |

Les trois identités RL1 Direction, RL2 Responsable qualité et RL3 RSI sont conservées. Les quatre champs d’attribution/contact sont absents dans le jeu source ; aucun nom ni contact inventé. Les valeurs canoniques priment sur les champs historiques lors de la préparation du jeu. `resources: Budget annuel` reste un contenu existant, sans réintroduire le module Budget.

Le formulaire illustratif modifie seulement une copie en mémoire ; recharger rétablit le jeu initial. Le scénario `?lecture=1` masque création et modification, mais ne teste pas une autorisation serveur.

## Résumé technique pour la reprise

- `index.html` définit navigation illustrative, repères, commandes par icônes, zone défilante, filtres et dialogue natif.
- `responsabilites.css` porte les deux thèmes, les dimensions PC, le dépliage horizontal et le mouvement limité.
- `responsabilites.js` : `filtered()` recherche et filtre ; `card()` / `rows()` rendent les vues ; `render()` calcule les compteurs et ordonne la carte ouverte ; `read()` sépare la consultation ; `editor()` et le gestionnaire `submit` ne modifient que la mémoire. Les valeurs sont échappées ; `id/ref` et champs supplémentaires restent conservés lors d’une édition. Retour du focus prévu après fermeture, enregistrement et retrait d’un filtre.
- `exporter.py` assemble styles, scripts et police locale dans `apercu-autonome.html`, sans ressource externe. Cet export est une maquette ; ne pas copier ses scripts en ligne dans l’application à CSP stricte.

Après validation, porter la présentation dans le chemin `responsabilites` de `apps/web/src/pages/Pilotage.tsx`, aujourd’hui fondé sur **BusinessRegistry / RecordEditor** (`kind: governance`, `legacy: roles`). Conserver les requêtes réelles, pagination, recherches, champs supplémentaires et droits existants. Réutiliser le formulaire applicatif et ses écritures plutôt que le stockage mémoire de cette maquette.

Préserver le contrat de `packages/shared/src/pilotage.ts` et l’adaptation `roles` de `apps/api/src/pilotage/legacy.ts` : `name`, `role`, `resp`, `resources`, `commitment` et les compléments canoniques. Ne pas confondre `ownerId` (responsable de fiche) avec `holder` (titulaire métier). Conserver description, références, liens, historique, versions, contrôle de concurrence et invalidations de cache. Aucun organigramme, RACI, score ni hiérarchie déduit des fiches.

## Vérifications de cette maquette uniquement

- Huit dispositions PC : 1024×768, 1366×768, 1920×1080, 2560×1440, dans les deux thèmes. Pas de débordement de page détecté ; carte dépliée au moins deux fois plus large dans les cas mesurés.
- Quatre analyses Axe ciblant synthèse et consultation, clair et sombre : aucune violation détectée. Cela ne remplace pas une recette d’accessibilité complète.
- Lecture, annulation sans mutation, focus clavier, recherche sans accents, filtres, liste et scénario de lecture seule contrôlés. Compléments : édition en mémoire sans perte d’identité/champs supplémentaires, attribution distincte, restauration après rechargement, résultat vide, focus après réinitialisation et mouvement réduit.
- Quarante rôles fictifs injectés en mémoire : défilement de 500 px dans le registre, page à 0 px. Ce contrôle n’est pas une mesure de performance de l’API.
- Export autonome servi en HTTP : ouverture/fermeture d’une fiche, zéro ressource externe et zéro erreur JavaScript. Une seule capture native HD sombre produite. L’ouverture directe sur Windows n’a pas été rejouée.
- ESLint ciblé, format explicite des nouvelles sources et contrôle du diff. Un sélecteur du contrôle complémentaire a été précisé pour viser le dialogue plutôt que le filtre masqué ; aucune assertion métier retirée. Les flèches de consultation utilisent un SVG pour éviter un glyphe mal rendu.

**Aucun build ou test applicatif, modification API, migration, dépendance, ZIP, push ou déploiement.** PR ouvertes consultées en lecture : aucune au moment du contrôle. Suite : retour sur ce visuel, puis intégration et contrôles applicatifs du lot retenu. Les autres propositions transversales conservent leur statut propre.

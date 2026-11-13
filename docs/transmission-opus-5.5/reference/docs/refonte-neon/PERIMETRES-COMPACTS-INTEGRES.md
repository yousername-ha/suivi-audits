# Périmètres : cartes compactes, repliables et graphe centré

04/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Le demandeur a validé les trois visuels avec **« Go intégration »**. Présentation intégrée sur la copie isolée de main, branche `codex/refonte-neon-main`, commit applicatif **`495427d54a68d8382fa9e49d9ba417f53c5e789a`**. Aucun nouvel accord préalable n'est nécessaire pour cette intégration et ses contrôles. Le dépôt initial et main restent inchangés.

## Résultat

- La page Périmètres ouvre la vue Graphe ; la vue Liste reste disponible.
- Les cartes sont repliées par défaut : nom, nature, périmètre affiché, couverture, actions, écarts et alertes essentielles. Largeur 260 px et hauteur naturelle d'environ 197 à 206 px dans le jeu de recette, contre l'estimation précédente de 380 × 680 px.
- Chaque « + » déplie sa carte indépendamment ; « − » la replie. Tout replier agit sur les cartes ouvertes.
- Le détail conserve les récurrences, la continuité, les classifications, les retards, les sous-totaux dédupliqués et les commandes de gestion autorisées. Le panneau Détail conserve la provenance de couverture par référentiel.
- Le graphe complet est centré, fournisseurs extérieurs compris. Les cartes suivent leur hauteur naturelle ; les rangées suivantes sont repositionnées, sans défilement interne aux dalles.
- Les arbres indépendants sont répartis en rangées ; les écrans étroits emploient une hiérarchie verticale lisible. Ajustement, taille réelle, zoom, déplacement sur le fond et commandes clavier restent disponibles pour les grandes structures.
- Les fournisseurs restent des rattachements extérieurs, jamais des parents. Leurs liaisons contournent les cartes.
- Les textes de la version claire ont été légèrement foncés pour corriger les contrastes détectés par Axe.

Les valeurs et agrégats viennent toujours de `/api/grc/perimetres/synthese`. Les compteurs absents restent indisponibles ; aucun zéro ni score de certification n'est inventé. La synthèse globale n'est pas une somme des cartes. API, schémas, identifiants, modèle, permissions et formulaires métier conservés. Aucun fichier API ni configuration Docker modifié, aucune dépendance ajoutée.

## Captures réelles après intégration

Application compilée et API réelle, données de démonstration fictives. Les captures finales utilisent un compte de recette disposant explicitement de quatre périmètres, afin que les objets ajoutés par les tests de bout en bout ne polluent pas la présentation. Aucune réponse API simulée pour les visuels.

![Graphe compact clair de l’application](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/graphe-replie-light-1440.png)

| Vue | Clair | Sombre |
| --- | --- | --- |
| Graphe replié | [1440](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/graphe-replie-light-1440.png) · [HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/graphe-replie-light-hd.png) | [1440](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/graphe-replie-dark-1440.png) · [HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/graphe-replie-dark-hd.png) |
| Carte dépliée | [1440](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/graphe-deplie-light-1440.png) · [HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/graphe-deplie-light-hd.png) | [1440](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/graphe-deplie-dark-1440.png) · [HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/graphe-deplie-dark-hd.png) |
| Page complète HD | [Repliée](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/replie-light-hd.png) · [Dépliée](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/deplie-light-hd.png) | [Repliée](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/replie-dark-hd.png) · [Dépliée](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/deplie-dark-hd.png) |
| Téléphone | [Replié](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/replie-light-390.png) · [Déplié](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/deplie-light-390.png) | [Replié](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/replie-dark-390.png) · [Déplié](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/deplie-dark-390.png) |
| Panneau Détail | [Ordinateur](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/detail-light-1440.png) · [Téléphone](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/detail-light-390.png) | [Ordinateur](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/detail-dark-1440.png) · [Téléphone](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/detail-dark-390.png) |
| Accès limité à un périmètre | [Centrage et compteurs indisponibles](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures-perimetres-compacts/perimetre-seul-lecteur.png) | — |

Captures directes de Chromium, sans retouche ; cadrage du graphe par la capture native de la page, après retour en haut pour éviter que la barre fixe ne recouvre le cadrage. Les vues HD utilisent 1920 × 1440 à densité ×2, soit 3840 px de large pour les pages complètes. [Reçu synthétique](captures-perimetres-compacts/validation.json).

## Contrôles exécutés

Node 26, Chromium système, PostgreSQL 18 dans la base isolée `suivi_neon_perimetres_compacts`. Serveurs de recette sur les ports locaux 8087 et 5177 ; aucune production utilisée. Les journaux bruts et sessions restent hors Git.

| Contrôle | Résultat |
| --- | --- |
| TypeScript web, ESLint complet, Prettier complet, vérification du diff | Code 0 |
| Compilation web Vite | Code 0 ; avertissements existants sur le script d’exploitation et la taille des bundles |
| Vitest web | 30 fichiers, 232 tests réussis, dont six tests de disposition |
| E2E Périmètres existants, adaptés au dépliage explicite | Quatre réussites, aucun rejeu |
| Compte en lecture seule | Graphe initial et dépliage permis, gestion absente, fournisseurs non demandés, compteurs non autorisés indisponibles |
| Modification avec un corps valide en lecture seule | 403 ; nom et version du périmètre inchangés |
| Dimensions et centrage | 16 vues, clair/sombre, 1440/1024/390 et HD ; aucun chevauchement, carte hors cadre, défilement interne ou débordement horizontal mesuré ; écart de centrage nul |
| Périmètre unique autorisé | Écart de centrage nul, vérifié avec le compte de lecture seule |
| Axe sur le module | Huit analyses, aucune violation détectée sur les critères sélectionnés |
| Erreurs JavaScript, CSP et écritures métier pendant les captures | Aucune |

Les quatre E2E couvrent la création d'un enfant, la concordance liste/graphe, les hauteurs après ouverture des sous-totaux, la modification avec conservation de l'identifiant, les fournisseurs, les flèches, la pause/reprise, les classifications et leurs liens filtrés, ainsi que le mouvement réduit. L'analyse Axe globale du scénario existant est également conservée.

Les premières passes ont signalé des contrastes de 4,08 à 4,13 sur certains fonds clairs, corrigés avant la collecte finale. Le lint complet avait également relevé 61 erreurs dans deux maquettes autonomes : leurs variables de navigateur ont été déclarées, un argument inutilisé renommé et une expression remplacée par son équivalent conditionnel, sans changement visuel. Les scripts privés de recette ont été corrigés pour distinguer les deux groupes de couverture du panneau, respecter le périmètre réellement autorisé au lecteur et envoyer un corps de modification valide avant de vérifier le refus 403. Aucun test de référence visuelle n'a été approuvé automatiquement.

Commandes : `node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit`, `node node_modules/eslint/bin/eslint.js . --max-warnings 0`, `node node_modules/prettier/bin/prettier.cjs --check .`, `node node_modules/vitest/vitest.mjs run --passWithNoTests` depuis `apps/web`, puis script de variables Mantine et `vite build`. E2E : Playwright avec configuration privée, un worker, zéro rejeu ; captures et garde de lecture seule par scripts privés sous `/workspace/work/neon-perimetres-instance`.

## Livraison Docker Desktop Windows

Le ZIP Docker local reprend les sources applicatives courantes, le travail DdA déjà intégré, les paquets, scripts et fichiers Compose. Il exclut les dépendances installées, données locales, secrets, maquettes et captures de référence volumineuses. Il ne remplace pas une archive Git complète destinée à rejouer les comparaisons visuelles de CI.

Dans le dossier de test existant : arrêter les services web/API avant de remplacer les fichiers, conserver `.donnees-dev` et la configuration locale, puis redémarrer :

```powershell
docker compose -p neon-refonte-test -f docker-compose.dev.yml stop web api
# Remplacer ici les fichiers par ceux du ZIP, dans ce même dossier de test.
docker compose -p neon-refonte-test -f docker-compose.dev.yml up -d --force-recreate web api
docker compose -p neon-refonte-test -f docker-compose.dev.yml ps
```

Ouvrir `http://localhost:5173`, puis recharger avec `Ctrl+F5`. Aucun `down -v`, effacement de données ou changement du projet Compose nécessaire. La recette sur le Docker Desktop Windows du demandeur reste à effectuer ; les contrôles ci-dessus proviennent de l'environnement de recette cloud.

Aucun push, déclenchement de CI, fusion ou déploiement. Publication GitHub toujours en attente de l'autorisation distincte déjà demandée après le refus automatique antérieur ; aucun nouvel essai. Prochaine action : essai du demandeur avec le ZIP Docker intégré.

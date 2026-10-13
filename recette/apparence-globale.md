# Recette — habillage global « Référence 08 » (13 octobre 2026)

Code recetté : `05dadbb78e28858cb1d647a0b9af705a9038312b` (branche `claude/audit-suivi-docker-github-0pfu4y`, fondée sur `909aebc` de `legacy`).
Environnement : Linux, Node 22.22.0, Python 3.13.16, Chromium 1194 de Playwright 1.56.1 (`/usr/bin/chromium` relié à ce binaire pour les
anciens parcours qui le codent en dur). Bases temporaires, comptes et données **fictifs**. Rien n’a été déployé ni fusionné ; aucune CI lancée.
Les preuves brutes sont dans [`recette/apparence-globale/`](apparence-globale/).

## Commandes exécutées et résultats

| Commande | Résultat |
| --- | --- |
| `node --test tests/*.test.cjs` | 55 tests, 55 réussis (état de départ : 55) |
| `python3 -m unittest discover -s tests -p '*_test.py'` | 41 tests, tous réussis (état de départ : 31 ; +10 : contrat d’apparence et migration) |
| `node tests/astra-browser.cjs` | 16 contrôles réussis, **101 destinations** (100 + Apparence) |
| `node tests/browser-nes.cjs` (nouveau) | 16 contrôles réussis ([détail](apparence-globale/browser-nes.txt)) |
| `node tests/nes-cartographies.cjs <avant 909aebc> <après>` (nouveau) | 10 comparaisons identiques, trois routes cartographiques ([détail](apparence-globale/cartographies.txt)) |
| `node samples/2026-10-13-astra-17/technique/capture.cjs` | 50 images, 15 contrôles, 0 erreur JavaScript, 0 requête externe |
| `node tests/browser-carto.cjs`, `browser-interface.cjs`, `browser-risks.cjs`, `browser-refonte.cjs`, `browser.cjs` | **échecs identiques avant (`909aebc`) et après** ([comparaison](apparence-globale/anciens-parcours-avant-apres.json)) |

Échecs préexistants, non imputables à cette livraison : les quatre premiers parcours s’arrêtent sur une attente périmée de l’ancien menu
(par exemple un titre « Vue d’ensemble » attendu à la place de « Pilotage & stratégie ») avant toute assertion visuelle ; `browser.cjs`
exige un serveur lancé à la main sur le port 8123. Leur couverture au-delà de ce premier échec n’a donc pas été exécutée. Le seul
changement de ces tests est `browser-risks.cjs` : le schéma annoncé par `/api/admin/status` passe de 2 à 3.

## Domaines de la recette du dossier

| Domaine | Statut | Preuve ou limite |
| --- | --- | --- |
| Référence, deux styles, mode sombre | Exécuté | Captures de la série 17 ; couleurs calculées dans les deux styles et en sombre (`browser-nes`) |
| Icônes, dépli/repli | Exécuté | Icône, filet et fond actifs mesurés ; chevrons droite / bas ; `aria-expanded`, `aria-controls` ; Entrée au clavier |
| Navigation | Exécuté | 101 destinations, une seule ajoutée (`admin-appearance`) |
| Style commun, deux comptes indépendants | Exécuté | Trois contextes (deux administrateurs, un contributeur) ; persistance après redémarrage du serveur |
| Propagation | Partiel | Mesurée entre 17 et 18 s (< 30 s) sans rechargement, saisie, focus ni nœud DOM perdus. Le retour au premier plan et le rétablissement du réseau sont codés (`visibilitychange`, `online`) mais **non simulés** automatiquement |
| Droits, authentification, validation, concurrence, audit, migration | Exécuté | `tests/server_appearance_test.py` (401, 403 non administrateur / sans CSRF / sans Origin, compte désactivé, 422 sur types, valeurs et clés, 409, même style sans écriture, audit avant / après, migration depuis un schéma 2, jamais abaissée) ; refus direct du contributeur dans `browser-nes` |
| Réseau | Exécuté | Écriture coupée : message d’échec, aucun faux succès, aperçu conservé ; lecture coupée : dernier style connu conservé |
| Prévisualisation | Exécuté | Aperçu sans écriture, abandon, quitter le panneau, mise à jour distante pendant l’aperçu (conflit à l’enregistrement, choix conservé) |
| Plans d’action (6 vues), récurrences (4 vues, fiche, historique) | Exécuté | Navigation entre les vues, `aria-pressed`, historique de réalisation ; création, édition, Kanban, réalisation et lecture seule via `astra-browser` (moteurs inchangés) |
| Modification de fréquence d’une série | Non rejoué | Moteur non modifié ; couvert seulement par les tests existants |
| Matrice des risques, politiques de risque | Exécuté | 16 cases, quatre niveaux, contraste texte ≥ 4,5:1 (rouge ajusté à `#E5192F`), sélection, case vide, réinitialisation, totaux identiques, politique personnalisée et manuelle, politique versionnée non modifiée |
| Annexe A | Exécuté | Tests ASTRA existants (liaison, déliaison, lien inverse) |
| Cartographies | Exécuté | Accès direct : captures et interactions identiques au pixel ; styles calculés identiques ; style reçu pendant l’affichage sans effet ; sortie et retour |
| Responsive, zoom 200 % | Exécuté | 390, 768, 1440, 1920 px et 720 × 450 px (équivalent d’un zoom à 200 % sur 1440 px) : aucun débordement global |
| Régressions métier | Partiel | Tests Node et Python, `astra-browser` ; anciens parcours en échec avant comme après (voir ci-dessus) |
| Contrôle d’accessibilité automatique (axe-core) | **Non exécuté** | Une exécution a été refusée par le contrôle d’autorisation de la session ; seules les mesures de contraste et de structure de `browser-nes` ont été faites. Ni lecteur d’écran ni audit humain |

## Écarts connus et décisions

- Palette de la matrice : le rouge `#FF293F` du dossier donne 4,03:1 avec le meilleur texte ; il est remplacé par `#E5192F` (4,65:1 avec le texte blanc). La palette ne vaut que pour la politique reconnue comme standard (calcul matriciel, `L1` à `L4`, libellés et couleurs d’origine).
- Le badge « En retard » en double des tâches récurrentes (échéance et statut) est supprimé ; la règle métier est inchangée.
- Après une navigation depuis un écran habillé vers une cartographie, 28 pixels de bord de la barre d’outils diffèrent d’un niveau sur 255 de l’état d’origine alors que les 435 styles calculés sont identiques ; l’accès direct est identique au pixel près.
- Le PNG de référence 08 n’a pas été comparé pixel à pixel : la série 14 et le dossier précisent qu’il s’agit d’une transposition, non d’une copie.

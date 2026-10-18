# Lot initial de fiabilisation et cadrage du socle SMSI / GRC

Branche exclusive : `feature/gpt6-evolution-smsi-grc`. Ce lot complète l'intégration du ZIP Sauge, sans modifier la branche principale ni les données de production. Le prompt demande de commencer par le diagnostic, le backlog et les corrections indépendantes avant les extensions structurelles.

## Résultats livrés

| Sujet | État initial / correction | Fichiers et données | Sécurité et recette |
|---|---|---|---|
| A4 déconnexion | L'erreur serveur était ignorée et clear() supprimait la requête de session observée. Fermeture serveur confirmée, anonymisation locale, annulation/purge du cache privé, synchronisation des onglets ; erreur visible et réessai | logout.ts, Layout, session, realtime ; aucune migration | Cookie expiré, rejeu refusé, CSRF invalide conserve la session ; erreurs réseau/403/500/401 et requête en cours testées |
| A3 connexion | Bandeau numéroté retiré au-dessus du formulaire ; étapes MFA/enrôlement/changement imposé conservées | Login.tsx ; CSS et design system inchangés | Parcours MFA existant, absence de bandeau/débordement à 390/768/1440, surveillance CSP |
| A6 / CARTO-10 | La colonne vide réservait de la largeur en 4K. Fiche ouverte sur sélection/Infos, fermable et largeur rendue au canevas | Cartographie.tsx ; aucune donnée de carte modifiée | Ouverture/fermeture et largeur vérifiées à 3840 px ; panneau filtres et comportement mobile conservés |
| A5 aide | Guide embarqué versionné, recherché sans sensibilité aux accents, articles filtrés par permissions ; toutes les familles historiques incluses | help.ts, Help.tsx, route authentifiée /aide, entrée menu | Couverture de chaque famille, lecteur limité aux fournisseurs, recherche/aucun résultat ; liens soumis aux gardes API existantes |
| Sécurité du guide CI | CodeQL signalait la sortie du mot de passe temporaire dans add-mask. Retirer toute sortie d'un secret inutilisé et tout corps HTTP d'erreur | guide-api.mjs ; pas de suppression de règle | Deux tests exécutent le script contre des réponses fictives 201/500 et interdisent la fuite du marqueur secret |
| Fichier de recette | CodeQL signalait un chemin temporaire prévisible. Charger le document fictif dans Playwright en mémoire | parcours.spec.ts | Le même parcours dépôt/fiche/modification/version est conservé |
| Socle v2 complet | Inventaire et rattachement des modules encore dans l'ancien style ; reprise Sauge obligatoire, sans suppression prématurée | REPRISE-SOCLE-LEGACY, BACKLOG-EVOLUTION, ARCHITECTURE-EVOLUTION | Clés et relations conservées, mapper aller-retour et recette par famille avant bascule en lecture seule |

## Validation exécutée

- Suite Vitest complète finale : **423 tests réussis** (192 shared, 102 UI, 117 API, 12 web), après correction du cas mural.
- ESLint, TypeScript, Prettier, build et diff sans erreur. Pas de nouvelle dépendance, pas de migration SQL ; migration v2 vers v3 et contrat legacy vérifiés par les tests existants.
- Recette native ciblée : 15 scénarios réussis sur une base neuve (parcours, système et fiabilisation).
- Recette officielle finale : **105 scénarios réussis en 5,9 minutes**, sur une nouvelle base PostgreSQL, dans `mcr.microsoft.com/playwright:v1.56.1-noble`, sans `--update-snapshots`. Sortie du conteneur : 0. Aucune désactivation d'assertion ni modification de seuil.
- 66 références PNG alignées sur Sauge, puis comparées avec succès. Revue d'images représentatives : carte mobile claire et 4K sombre, tableau de bord tablette clair, document mobile sombre, paramètres bureau clair, administration 4K sombre. La feuille CSS compilée garde son empreinte `index-BVNHOy3h.css` ; aucun jeton, thème ou style modifié.
- Révocation murale et A6 réussis après correction des deux échecs intermédiaires ; absence de débordement et surveillance CSP conservées. Guide d'installation extrait (57 blocs) et syntaxe bash vérifiée, CHANGELOG contrôlé.

## Échecs intermédiaires de recette et corrections

La première exécution officielle (génération des références) a passé 103 scénarios et échoué sur 2. Le test mural a révélé une régression de purge : l'initialisation anonyme supprimait sa requête observée, provoquant un chargement bloqué après révocation. La requête murale, soumise à une autorisation indépendante, reste maintenant observée ; ses anciennes données sont réinitialisées à la déconnexion, avec recontrôle serveur. Un test unitaire vérifie ce comportement sans conservation de la synthèse privée précédente.

Le nouveau test A6 consultait trop tôt l'état « carte absente » : après les autres suites, la recette nettoie les cartes et le chargement n'était pas encore terminé. Il attend désormais l'état chargé (carte ou état vide) avant de décider de générer. Aucune assertion fonctionnelle n'est retirée. La suite officielle est relancée sur une nouvelle base sans mise à jour des références.

## Anomalies identifiées avant ce lot

La CI de l'intégration `7dc4c37` avait deux alertes CodeQL de gravité élevée (sortie de mot de passe, fichier temporaire), traitées ci-dessus. La pile avait 26 tests réussis et 3 tests en échec de comparaison visuelle. Les images attendues fournies avec le ZIP présentaient la charte antérieure (fond gris/teal, ancien tableau de bord), alors que les images produites utilisaient déjà Sauge. Ce lot ne revient pas à l'ancienne charte : il aligne les références sur le rendu Sauge demandé, après revue avec le conteneur Playwright officiel 1.56.1, puis comparaison sans mise à jour automatique.

## Limites et lots suivants

A1/A2 (pilotage web sauvegardes/TLS), B–L et la reprise Sauge complète des interfaces historiques ne sont pas livrés par ce premier lot. Ils restent décrits dans le backlog avec critères, impacts et sources à vérifier. Les règles de financement et textes normatifs ne sont pas inventés. Les capacités historiques restent accessibles sous `/legacy` et ne sont pas considérées migrées du seul fait de leur archivage.

Les tests locaux utilisent l'API native et PostgreSQL/Caddy de recette. Ils ne remplacent pas les contrôles GitHub de construction/signature/scanners ni une restauration réelle de production. La PR reste ouverte en brouillon, sans fusion ni publication de version.

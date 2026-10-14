# Décisions, incertitudes et sources

## Choix retenus pour la proposition

1. Évolution de legacy et stockage existant ; namespace additionnel et adaptateurs, pas de réécriture autonome.
2. Risques, évaluations finales, politiques historiques et décisions restent dans leurs registres actuels.
3. Référentiels transversaux à portée explicite ; configuration publiée immuable, contexte d’étude épinglé.
4. Import ARM préparatoire et contrôlé ; les barèmes observés sont locaux, jamais attribués par défaut à une norme.
5. Style 08, deux variantes globales d’apparence, icônes colorées, chevrons ; cartographie dynamique protégée.
6. L’IA de codage travaille uniquement sur sa propre branche. Le présent travail documentaire est livré sur `legacy` conformément aux instructions utilisateur.

## Questions courtes à poser au moment où elles bloquent un lot

| Décision | Question | Travail possible en attendant |
|---|---|---|
| Organisation propriétaire | « Une installation correspond-elle à une seule organisation indépendante ? » | Socle mono-organisation explicite, sans activer le partage inter-organisations |
| Barèmes importés | « Publie-t-on les échelles ARM telles quelles, après revue ? » | Import en brouillon, aucune version activée |
| Disponibilité | « Quelles bornes exactes pour 30 min, 4 h et 1 jour ? » | Conserver les descriptions qualitatives |
| Agrégation impacts | « Quelle règle approuvée donne la gravité proposée ? » | Appréciation manuelle justifiée, pas de maximum implicite |
| Accidentel | « Classe-t-on les cas accidentels dans le socle de sécurité ? » | Conserver et signaler les cas, sans les valider comme attaques intentionnelles |
| Ateliers absents | « As-tu un export structuré des ateliers 3 à 5 ? » | Implémentation sur fixtures fictives et guide officiel ; aucun remplissage réel |
| ISO 27005 | « Quelle édition et quel parcours interne faut-il appliquer ? » | Contrats génériques et adaptateur historique, pas d’allégation de conformité |
| Données réelles | « Quels objets existants correspondent aux missions/VM/supports importés ? » | File de rapprochement, relations non validées |

Ces décisions ne bloquent pas la réalisation du dossier. L’agent de codage pose seulement la question nécessaire au lot concerné et continue les tâches indépendantes. Ne pas demander une confirmation pour chaque changement réversible déjà autorisé.

## Sources et degré d’autorité

- **Code suivi par Git**, SHA `472a81fe315ac323d75a59db74e16b8d39a5b0e8` : fichiers cités dans le diagnostic. Preuve de l’existant technique, pas des données installées chez l’utilisateur.
- **Export ARM.zip**, reçu de l’utilisateur : 25 fichiers inventoriés en annexes. Preuve des valeurs exportées et de représentations, pas d’une règle cachée ou d’un schéma complet. Les données sources restent privées.
- **Prompt de refonte structurelle fourni par l’utilisateur**, 16 sections : exigences traduites dans `annexes/exigences.csv`. Le livrable demandé ici est le dossier de préparation, pas l’exécution de toute l’implémentation.
- **ANSSI, EBIOS Risk Manager, guide v1.5, septembre 2024, ANSSI-PA-048** : [page officielle](https://messervices.cyber.gouv.fr/guides/la-methode-ebios-risk-manager-le-guide), [PDF officiel](https://messervices.cyber.gouv.fr/documents-guides/250129_np_anssi_guide_ebios_fr_final_collection_WEB.pdf). Version indiquée dans le document consulté. Numéros de pages ci-dessous = pagination imprimée, généralement +2 dans le lecteur PDF.

| Sujet | Pages imprimées du guide |
|---|---|
| Socle et risques accidentels / scénarios intentionnels | 4 |
| Démarche itérative et cinq ateliers | 6–11 |
| Cadre, périmètre, ER, socle de sécurité | 18–31 |
| Sources, objectifs, pertinence, sélection | 34–39, en particulier 38 |
| Écosystème, scénarios stratégiques, mesures | 42–55 |
| Scénarios opérationnels et graphes | 58–64 |
| Vraisemblance | 65–67 |
| Traitement, mesures, résiduel, suivi | 70–82 |

Les exemples graphiques de ce dossier utilisent des noms fictifs et des valeurs de démonstration. Les règles et étapes supplémentaires de validation de l’application sont signalées comme propositions. Le texte intégral ISO/IEC 27005 n’a pas été consulté : aucune certification ou conformité normative n’est revendiquée. Les références Annex A visent bien ISO 27001:2022, selon la confirmation utilisateur.

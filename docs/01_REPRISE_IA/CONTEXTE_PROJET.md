# Contexte, mission et sources

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

L’application sert le suivi des audits et le pilotage de systèmes de management
qualité, sécurité, HDS et référentiels personnalisés. Le parcours normal est
multi-référentiels ; une instance n’est pas assimilée silencieusement à un SMSI.
La première livraison provenait d’un ZIP Sauge superposé à une base v2 conservée.

La présente mission est documentaire : inventaire, architecture, comparaison,
preuves, guides et transmission, sans modification métier ni intervention serveur.
La demande de reprise intégrale v2 reste valable. D/J/I/F restent exclus du
développement demandé ; E est partiel. Une inclusion nouvelle nécessite un cadrage.

Sources effectivement examinées : code apps/packages, scripts/Docker/workflows,
15 migrations, fichiers de test, documents existants, archive v2, manifeste,
historique Git et état GitHub en lecture seule. 13 branches distantes et 2 tags
numérotés ont été récupérés pour lecture ; 116 commits atteignables par ces refs.
Ce nombre n’inclut pas toutes les anciennes refs de PR ou les objets supprimés.

| Statut      | Sens                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| CONFIRMÉ    | Preuve examinée : source, comparaison ou résultat exécuté.                    |
| OBSERVÉ     | Constat de lecture ou d’inventaire, sans validation complète du comportement. |
| DÉCLARÉ     | Information d’un diagnostic/historique non reproduite indépendamment ici.     |
| SUPPOSÉ     | Hypothèse, jamais utilisée pour annoncer une livraison.                       |
| NON VÉRIFIÉ | Contrôle non réalisé, même si le code existe.                                 |
| INCONNU     | Information indisponible.                                                     |

« VALIDÉ AUTOMATIQUEMENT » désigne uniquement le périmètre décrit et le commit testé.
La CI n’est pas une acceptation utilisateur, un certificat ISO/HDS ni une preuve
d’équivalence exhaustive avec v2. PARTIEL est un état de livraison, pas un échec
de tous les tests du module. NON REPRISE signifie « pas de remplacement Sauge
complet identifié » : le code legacy peut rester disponible.

Informations manquantes : état réel du serveur client, données/configurations
réelles, acceptation humaine, charge cible/SLO, toute source historique non
accessible par ces refs, originaux normatifs sous licence et grilles ANS/HDS
inaccessibles. Ne pas remplir ces inconnues par inférence.

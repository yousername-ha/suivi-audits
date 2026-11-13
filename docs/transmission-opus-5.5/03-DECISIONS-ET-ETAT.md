# Décisions applicables et état de réalisation

## Autorité des informations

La demande actuelle et les consignes du dépôt cible priment. Pour le design, appliquer la décision explicite la plus récente du module, puis ce dossier de synthèse, puis les preuves datées. Les README historiques copiés dans `reference/` décrivent leur époque ; leur mention « à valider » peut avoir été remplacée par un accord ultérieur. Pour les fonctions et contrats, l’existant vérifié dans la version cible fait autorité ; un exemple de code plus ancien ne l’annule pas.

## Dernières décisions à ne pas perdre

| Sujet               | Choix applicable                                                                                                  | Choix à ne pas porter                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Menu principal      | Bleu nuit/pétrole opaque dans les deux thèmes ; icônes modernes, treize teintes distinctes, formes animées        | Fond crème/jaune, fond translucide de l’ultime essai, petits carrés brillants et anciennes variantes de menu |
| Dashboard avec menu | Deux vues finales approuvées par « Top »                                                                          | Les considérer comme preuve d’un portage React déjà terminé                                                  |
| Cartographie SMSI   | Présentation et génération automatique actuelles conservées                                                       | Panorama Cartographie Studio rejeté ; habillage ultérieur mis de côté                                        |
| SWOT                | Matrice Studio au grand cercle processus centré                                                                   | Les premières compositions au centre petit/décalé                                                            |
| PESTEL              | Constellation Studio, processus réellement rattachés, nomenclature API                                            | Six facteurs ou associations codés en dur d’après la maquette                                                |
| DDA                 | Dernière direction Studio intégrée, mesures en lignes compactes                                                   | Cartes par mesure, variante Bootstrap, anciens essais gris/sauge/transparents ou trop lumineux               |
| Objectifs           | Compact par défaut, proportion B et style Studio ; cible violette, valeurs/états colorés, alertes/flèches animées | Variante A aux titres agrandis ; supprimer les flèches à la suite du mot « annulé » (corrigé en « animer »)  |
| Périmètres          | Graphe centré, cartes repliées, + centré en bas et expansion horizontale                                          | Cartes immenses ouvertes et expansion seulement verticale                                                    |
| Bibliothèque        | Une destination regroupant bibliothèque et couverture                                                             | Rétablir les onglets barrés ou fusionner/supprimer arbitrairement les données et routes                      |
| Listes/Timeline     | Ligne entière ouvrable, commande embarquée indépendante, résultat rapide OK/KO/preuve/commentaire                 | Obliger à viser Afficher ; modifier une décision ancienne sans historique                                    |
| Authentification    | Application courante sécurisée préservée ; ancien profil sans connexion réservé aux tests UI isolés               | Copier ce profil ou sa session de démonstration dans l’application normale                                   |

## Registre par module

Le tableau suivant est généré depuis `annexes/MODULES.json`. **« Intégré dans la référence » ne signifie ni présent dans la version cible, ni fusionné/déployé.** Tous les états de cible restent à constater.

| Module                                                | État dans la référence                                                          | Révision utile                   | Cible       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------- | ----------- |
| Charte, cadres et fenêtres                            | Validé ; intégré dans la référence                                              | `fede361`                        | À constater |
| Dashboard analytique et graphiques                    | Intégré dans la référence ; deux dernières images sont des projections de menu  | `d9d1478 + visuels 55d43ee`      | À constater |
| Organisation — Périmètre et contexte                  | Validé ; intégré dans la référence                                              | `e5dabd2 / validation fede361`   | À constater |
| Périmètres — graphe compact centré                    | Validé ; intégré dans la référence                                              | `495427d puis eed9f21`           | À constater |
| Objectifs et indicateurs — compact Studio             | Validé ; intégré dans la référence                                              | `eed9f21`                        | À constater |
| DDA — synthèse et mesures en lignes                   | Dernière direction validée ; intégrée dans la référence                         | `008cc30 (succède à 4a1304b)`    | À constater |
| Référentiels et exigences                             | Validé ; intégré, puis bibliothèque unifiée plus récente                        | `65bd22f puis 35e700c`           | À constater |
| Bibliothèque de référentiels et couverture fusionnées | Validé ; intégré dans la référence                                              | `35e700c puis d9d1478`           | À constater |
| SWOT relié aux processus — Matrice Studio             | Dernier modèle explicitement retenu ; intégré                                   | `51d7022`                        | À constater |
| PESTEL — constellation Studio                         | Validé ; intégré                                                                | `5dd1c68`                        | À constater |
| Plan d’actions — Timeline Studio                      | Validé ; intégré puis validation rapide                                         | `5ed760b puis 23b33b5`           | À constater |
| Tâches récurrentes — Timeline adaptative              | Validé ; intégré puis validation rapide                                         | `5ed760b puis 23b33b5`           | À constater |
| Registres — lignes ouvrables et filtres discrets      | Exigences acquises ; lignes intégrées, déclinaison épurée partielle             | `23b33b5 + propositions PC`      | À constater |
| Adaptation PC, largeur et hauteur                     | Règle transversale demandée ; réalisation partielle selon module                | `Référence par lot`              | À constater |
| Parties intéressées — panorama centré et liaisons     | Intégré après poursuite autorisée ; centrage final intégré                      | `81ea06a puis 67a334a`           | À constater |
| Processus — cartes Studio et lecture distincte        | Intégré après poursuite autorisée                                               | `67a334a`                        | À constater |
| Rôles et responsabilités — proposition Studio         | Proposition non explicitement validée ; ne pas présenter comme intégrée         | `166990f`                        | À constater |
| Fournisseurs — registre compact Studio                | Validé ; intégré                                                                | `ee8b524`                        | À constater |
| Assistant RSSI global et avatar HD Neon               | Frontend intégré ; backend séparé à réconcilier avec la cible                   | `04a310f puis d9d1478`           | À constater |
| Menu latéral commun final — bleu nuit opaque          | Validé à porter ; aperçu seulement dans les dernières captures                  | `e100b28 + confirmation 55d43ee` | À constater |
| Cartographie SMSI et génération automatique           | Conserver existant ; proposition de remplacement rejetée, habillage mis de côté | `a0d7747 (décision)`             | À constater |
| Autres menus et modules non spécifiquement revus      | Pas de nouveau modèle spécifique validé                                         | `À comparer sur la cible`        | À constater |

## Propositions et limites qui restent distinctes

Rôles et responsabilités Studio est une proposition non explicitement validée. Le Responsive et les commandes discrètes sont des exigences transversales acquises, mais leur déclinaison exhaustive à tous les écrans n’est pas attestée par cette branche. Les modules non spécifiquement revus gardent leur écran et leurs flux actuels ; appliquer les composants communs validés sans inventer une refonte particulière.

Les graphiques et captures peuvent contenir des exemples anciens (CRRC, noms de catégories ou styles de menu) conservés comme historique. Utiliser le registre de décisions pour le périmètre réel et vérifier les retraits déjà effectués dans la cible. Ne pas rendre un module obsolète à nouveau accessible parce qu’il apparaît dans une capture ancienne.

Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

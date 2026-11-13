# PESTEL Studio — intégré après validation

10/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Le demandeur a validé la [proposition PESTEL Studio](propositions/organisation-pestel-studio/README.md) par « Ok implémente le pestel j’aime aussi beaucoup. ». **Le modèle est intégré au commit applicatif `5dd1c68350730f6a59ff204a5e721a482b3125eb`**, sur `codex/refonte-neon-main`, copie isolée de main. Aucun accord préalable restant pour cette intégration. Le dernier SWOT au centre agrandi est conservé ; les Parties intéressées restent une proposition distincte non validée.

## Résultat

Organisation → Contexte de l’organisation → PESTEL présente la constellation des facteurs, leurs couleurs et compteurs, les enjeux du facteur sélectionné et les processus concernés. Les libellés des processus viennent du cache de l’API existante des cartes ; une référence non résolue reste affichée. Aucun rattachement n’est fabriqué.

Les enjeux externes non classés restent dans leur bandeau orange. Les enjeux internes sont dans un panneau distinct et repliable, sans commande de classement PESTEL. Le registre complet conserve tous les enjeux externes, leurs descriptions et processus, avec recherche par intitulé, description, facteur, référence ou nom du processus. La note méthodologique ISO 9001 existante est conservée dans l’accordéon À propos.

Les facteurs sont ceux de la nomenclature renvoyée par l’API : aucune liste de six identifiants n’est imposée à la donnée. Plus de six facteurs, ou des libellés longs, utilisent une disposition en grille dans la même charte. Les facteurs vides, la nomenclature absente et l’absence complète d’enjeux disposent d’états explicites.

La sélection d’un facteur est conservée dans l’adresse avec le périmètre. Les écritures utilisent toujours le PUT PESTEL existant ; les contrôles restent indisponibles pendant l’enregistrement, puis les valeurs reviennent de l’API. Une erreur reste visible sans modifier le contenu ; le focus revient au champ ou à sa zone après déplacement d’un enjeu. Le bouton d’effacement est nommé, accessible au clavier et aux lecteurs d’écran. Les lecteurs consultent les classements sans commande d’écriture.

Les deux thèmes, le relief au survol et au clavier, les animations, la pause/reprise et la préférence de mouvement réduit sont conservés. Les panneaux gardent une hauteur naturelle, sans défilement intérieur ajouté. La restriction au pilotage commun de l’organisation est maintenue.

## Périmètre technique

- `apps/web/src/pilotage/Pestel.tsx` : garde, requêtes et écritures existantes, attente et erreurs ; lecture des noms des processus par la clé partagée des cartes. Le bandeau de synthèse des Parties intéressées, dans le même fichier, est conservé.
- `apps/web/src/pilotage/PestelStudio.tsx` : présentation, sélection, registre, recherche et accessibilité.
- `packages/ui/src/neon-pestel.css`, importé par `neon.css` : styles et dimensions locaux dans la charte.
- Quatre scénarios E2E PESTEL ; l’ancien scénario du jeu de test ouvre désormais la note méthodologique avant son assertion, qui reste présente.

Aucune route API, règle métier, permission, migration, dépendance ou valeur de référence modifiée. Aucun score de conformité, poids d’influence ou évolution historique ajouté.

## Captures de l’application

- [Clair HD](captures-pestel/pestel-light-hd.png).
- [Sombre HD](captures-pestel/pestel-dark-hd.png).
- [Vidéo intégrée](captures-pestel/pestel-integre.mp4).

Deux captures natives complètes de 3840 × 2904 px, sans retouche ; la vidéo est une capture simplement recadrée sur le PESTEL. [Manifeste](captures-pestel/captures.json) et [validation vidéo](captures-pestel/validation-video.json).

L’instance fictive de recette contient trois enjeux externes et un interne : les volumes diffèrent de la maquette. Deux affectations illustratives ont été préparées uniquement dans cette instance pour montrer la lecture des facteurs, puis les affectations initiales ont été rétablies et comparées. Aucun enjeu n’a été créé pour les captures ; aucun classement de démonstration n’est injecté dans le ZIP ou appliqué automatiquement dans l’application.

## Contrôles exécutés

Node 26.13.0, Chromium système, PostgreSQL 18 de l’instance isolée existante, ports 8087/5177 ; aucune base de production utilisée. Rapports bruts, sessions et comptes fictifs hors Git dans `/workspace/work/neon-pestel-instance`.

| Contrôle | Résultat final |
| --- | --- |
| TypeScript web, ESLint complet, Prettier complet, compilation web | Codes 0 ; avertissement préexistant sur la taille de certains bundles |
| Tests unitaires web / UI | 240 / 243 réussis, soit 483 |
| E2E PESTEL | Quatre réussis, zéro rejeu : lecture et recherche sans écriture, classement/retrait persistants et erreur de sauvegarde, lecteur et refus serveur 403, nomenclature personnalisée/état vide/erreur de lecture/réessai/autre périmètre |
| E2E SWOT conservé | Trois réussis, zéro rejeu ; dernier modèle et fonctions conservés |
| Dimensions réelles | 30 dispositions dans les deux thèmes, de 390 à 1920 px, facteurs, registre, internes et note ; aucun débordement horizontal, défilement vertical intérieur ou chevauchement du centre avec les boutons détecté |
| Cas supplémentaires simulés | 12 dispositions : nomenclature longue, absence de facteurs et contenus longs ; aucune perte ni découpe de contenu détectée dans les zones contrôlées |
| Accessibilité | 14 analyses Axe ciblées sur `main`, dont six sur réponses simulées, sans violation détectée |
| Animations et données | Actives, pause/reprise et réduction vérifiées ; affectations de départ restituées après captures et vidéo |

[Reçu des contrôles visuels](captures-pestel/validation.json).

Les premiers essais ont corrigé le format des réponses de panne simulées pour respecter la clé `error` du client existant. Le contrôle du retrait a ensuite identifié le bouton d’effacement masqué par défaut aux technologies d’assistance dans Mantine ; son accessibilité et le retour de focus ont été corrigés. Les assertions ont été conservées. Le passage final des sept E2E est réussi en une seule exécution, un worker et zéro rejeu.

Les consultations de capture n’ont déclenché aucune écriture métier depuis la page ; la préparation et la restauration des affectations fictives sont séparées dans le reçu. Huit préférences de thème ont été enregistrées pendant les captures. Douze réponses 404 pour `/update/client.js`, fourni par la passerelle de la pile complète, sont conservées comme observations de l’aperçu ; aucune autre erreur HTTP ou JavaScript observée dans les captures finales.

## Livraison Docker Desktop Windows

Paquet **`suivi-audits-neon-docker-pestel-studio.zip`**, guide `LIRE-MOI-REFONTE.txt` et empreinte SHA-256. Il conserve DdA, Périmètres, Objectifs compacts, Référentiels et le dernier SWOT validé. Dépendances installées, sessions, comptes de recette, données locales et grands médias sont exclus.

Dans le dossier de test existant : arrêter web/API, remplacer les sources en conservant `.donnees-dev` et la configuration locale, puis suivre le guide et recréer web/API avec le même projet `neon-refonte-test`. Aucune suppression de volume ni réinitialisation des données.

**Non exécutés : suite E2E intégrale de toutes les fonctions, CI distante, recette sur le Docker Desktop Windows du demandeur et déploiement. Aucun push.** Les limites historiques extérieures au lot restent dans les comptes rendus précédents. Prochaine action : essai local du PESTEL intégré ; poursuivre séparément les autres rubriques Organisation.

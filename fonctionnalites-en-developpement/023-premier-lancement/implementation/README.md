# 023 — Premier lancement : règles de conception

## Demandes traduites

1. Assistant central : modèle → organisation/premier périmètre → référentiels → impact/sévérité/probabilité → aperçu et confirmation.
2. Bouton « Passer toute la configuration » accessible à chaque étape. Aucun modèle ni réglage n’est appliqué par ce bouton ; brouillon conservé et reprise proposée. Une configuration antérieure ne doit jamais être supprimée par un report.
3. Revenir, compléter plus tard et reprendre après rechargement. La simulation sauvegarde les saisies dans ce navigateur. Les sessions réelles nécessiteront un brouillon serveur versionné et autorisé.
4. Modèles fournis : libre, socle ISO 27001, ISO 27001 + HDS. Ce sont des modèles de navigation/configuration ASTRA, pas des templates officiels ISO/ANS. Ils ne contiennent ni évaluation prévalidée ni barème inventé.
5. Échelles : choix d’une version dans le catalogue commun existant, aperçu des niveaux, accès à Paramètres plateforme. Sévérité ≠ matrice de criticité ; ne pas inventer un produit impact × probabilité ni ses seuils. Aucune échelle choisie par défaut dans cette v001 ; si aucune version n’existe, permettre de compléter plus tard et signaler les opérations qui en dépendent. Le catalogue affiché dans les captures est fictif.
6. Organisation/périmètre : mêmes objets que 010, aucun doublon de cartographie. Pas de création automatique de risque, preuve, action ou registre. Le formulaire de démo prépare seulement les choix locaux.
7. Aperçu d’impact et confirmation avant toute application. En production : réutiliser l’existant, détecter les doublons, ne pas écraser les réglages et versions ; prévisualiser les associations proposées. Transaction ou reprise partielle explicite selon contrats existants, aucun faux succès.
8. L’assistant métier est facultatif **après** l’accès sécurisé initial. Il ne permet pas d’éviter la création/authentification de l’administrateur ni d’accéder aux données sans droits.

## Limites visuelles v001

Les templates préparent les choix et l’entrée du parcours, ils n’importent aucun corpus normatif. L’applicabilité HDS reste à instruire ; le fait d’être un GHT ou un établissement de santé n’impose pas à lui seul le modèle HDS. Aucun réglage SMTP, certificat, secret ou exploitation n’est collecté dans cet assistant. Ces réglages restent dans 012.

Le périmètre sans organisation est conservable en brouillon pour permettre de passer les étapes. Au raccordement, la commande de création réelle devra vérifier ou demander un parent valable, sans créer silencieusement une organisation vide.

## Existant et limites d’intégration

Aucune modification de l’environnement Claude. La copie de référence locale `onboarding-suivi/zip-analysis/suivi-audits-refonte-cartographie/apps/web/src/pages/Setup.tsx` a été consultée en lecture seule : elle gère le compte initial et `/api/setup`, pas une preuve d’existence du nouvel assistant métier. Son SHA actuel n’est pas établi. Le snapshot 284cb1e mentionné dans les précédents dossiers n’est pas accessible comme objet Git dans cette copie ; l’avancement courant de Claude demeure à revérifier. Aucun test n’y a été exécuté.

Avant codage, auditer sa propre branche : organisation/périmètres (010), configuration (019/012), droits (022), preuves, registres, conformité et éventuel parcours existant. Conserver ce qui fonctionne, compléter seulement le manque. Les routes exactes du parcours, du brouillon et de ses revues ne sont pas inventées par la maquette. Les clés localStorage n’établissent ni sécurité, ni persistance serveur, ni traçabilité immuable.

Réutiliser les identifiants, versions et permissions serveur. Les contrôles d’accès restent côté backend ; les mutations doivent gérer refus, concurrence, reprise et double soumission. Ne pas convertir la fixture en modèle métier concurrent. Ne pas toucher à la cartographie dynamique historique.

## Cycle de validation

Cette proposition reste **en développement / à valider**. Après accord sur les visuels et les comportements : compléter le dossier technique avec les contrats vérifiés et déplacer dans « à implémenter ». Après confirmation par un marqueur d’intégration valable : classement « implémenté ». Aucun marqueur créé et aucun ZIP/BAT généré pour cette livraison.

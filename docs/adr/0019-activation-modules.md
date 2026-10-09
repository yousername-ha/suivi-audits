# ADR 0019 — Activation globale des modules

Statut : acceptée. Lot B1, branche feature/gpt6-evolution-smsi-grc.

## Contexte

Les permissions existantes déterminent qui peut agir, mais ne permettent pas à l'organisation de désactiver un module. Les données héritées et les menus mixtes v2 imposent un contrôle commun aux nouvelles routes et aux chemins transversaux.

## Décision

Le registre partagé conserve les quinze identifiants RBAC. Administration et paramètres sont protégés ; authentification, stockage, journal de sécurité, sauvegarde/restauration et TLS restent fondamentaux. Le module métier plan d'audit dépend obligatoirement du module audit. Les autres rattachements sont facultatifs : leurs données restent stockées, sans enrichissement visible lorsque le fournisseur est désactivé.

La configuration singleton est créée par migration additive 008, tous les modules actifs. Chaque changement exige administration:administrer, session complète, origine identique, CSRF, prévisualisation, empreinte de ses conséquences, confirmation VALIDER et If-Match. Une cascade doit être explicitement demandée. La confirmation recalcule les conséquences sous verrou et refuse une version périmée. Le journal d'audit en ajout seul conserve avant/après, version, auteur et cascade dans la même transaction.

Un verrou consultatif PostgreSQL partagé couvre chaque mutation authentifiée, à l'exception des routes de configuration qui acquièrent le verrou exclusif elles-mêmes. Un pool de verrous borné et distinct du pool de transactions évite leur saturation circulaire. Les mutations déjà commencées terminent avant la désactivation ; les suivantes utilisent une configuration actuelle. Un snapshot par requête assure un filtrage cohérent. Les notifications SSE reconsultent la configuration actuelle au lieu de réutiliser le snapshot du flux ouvert.

Les permissions actives sont l'intersection des droits attribués et des modules activés. Les attributions restent intactes et retrouvent leur effet à la réactivation. La garde commune bloque les API directes ; les synthèses, écrans muraux, JSON historique, imports, fichiers bruts, restaurations historiques et paramètres métier appliquent la même politique. Les valeurs vides de l'état historique filtré sont conservées à l'écriture sans effacer les données masquées ; une modification explicite non vide d'un module désactivé est refusée.

Les menus Sauge utilisent les permissions actives. Les sous-menus v2 et la page historique restaurée depuis le navigateur sont filtrés par le shim et l'adaptation serveur, sans modification du fichier source conservé. Une notification ou reconnexion renouvelle la session et réinitialise les données privées des observateurs actifs du cache navigateur.

Le bloc de données initiales embarqué dans le HTML historique est filtré lui aussi. Les objets masqués reçoivent uniquement, dans l'adaptateur navigateur, des tableaux et valeurs neutres compatibles avec les vues v2 : désactiver l'IA ne doit pas faire planter le tableau de bord commun. Ces espaces réservés sont ignorés lors de l'enregistrement pour préserver les données stockées. Les commandes de transfert v2 sont masquées et leurs téléchargements refusés lorsque le module import/export est désactivé.

Au premier contact SSE, la session est reconsultée. Si ses droits n'ont pas changé, le cache qui vient d'être chargé est conservé pour éviter une seconde transition à vide. Des droits différents, une reconnexion ou une notification d'activation imposent la réinitialisation complète des données privées.

## Conséquences

La désactivation est réversible et ne supprime ni données, ni références, ni configuration. Les imports complets et restitutions historiques touchant un module désactivé sont refusés jusqu'à sa réactivation. Les sauvegardes de secours demeurent intégrales pour préserver la restaurabilité. Les tâches métier et intégrations futures devront appeler le service d'activation avant chaque exécution ; le socle ne comporte pas de tels exécutants autonomes aujourd'hui.

L'écran Administration > Système regroupe registre, changements souhaités, prévisualisation, confirmation et historique. Les composants et tokens Sauge existants sont réutilisés, sans nouvelle feuille de style ni modification des captures de référence.

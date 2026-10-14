# Nettoyage autorisé des aperçus

Demande utilisateur : retirer les samples devenus inutiles. Périmètre : `samples/` sur **legacy uniquement**. Aucun changement d’une autre branche, aucune réécriture d’historique, aucune modification de la cartographie dynamique.

**15 anciennes séries retirées**, soit environ 45.1 Mio de fichiers de l’arbre courant. Les séries 08, 14, 15 et 16 restent nécessaires aux références d’implémentation ; la série 20 reprend le parcours et les vues EBIOS RM courantes.

État complet avant nettoyage : [commit 95058fb](https://github.com/yousername-ha/suivi-audits/tree/95058fbeeb2daff1cb1c525d70a736322e69705b/samples).

Séries retirées : 2026-10-12-astra-01, 2026-10-12-astra-02, 2026-10-12-astra-03, 2026-10-12-astra-04, 2026-10-12-astra-05, 2026-10-12-astra-06, 2026-10-12-astra-07, 2026-10-12-astra-09, 2026-10-13-astra-10, 2026-10-13-astra-11, 2026-10-13-astra-12, 2026-10-13-astra-13, 2026-10-13-astra-17, 2026-10-13-astra-18, 2026-10-13-astra-19.

Les liens des références conservées sont actualisés. Le manifeste racine `MANIFESTE-LIVRAISON.json` reste le relevé historique de la livraison du 12 octobre ; il ne décrit pas l’arbre courant après ce nettoyage. Le ZIP Windows dispose de son propre manifeste et de son empreinte SHA-256 dans `downloads/`.

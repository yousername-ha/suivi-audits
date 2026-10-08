# ADR 0016 — Cartographie : créer les objets depuis la carte

**Statut** : proposée (exigences `CARTO-15` à `CARTO-19`). Complète l'[ADR 0013](0013-cartographie.md).
Spécification : [`docs/cartographie/SPEC-EDITION-LIBRE.md`](../cartographie/SPEC-EDITION-LIBRE.md).

## Contexte
L'ADR 0013 fait de la carte une **présentation** d'objets saisis dans leurs modules. Sur une installation neuve, ou
pour dessiner un contexte qui n'est pas encore saisi, la carte reste vide : le RSSI demande de pouvoir la construire
de zéro (clic droit, glisser-déposer). Les modules sources (parties intéressées, processus, périmètre, fournisseurs,
applications) sont encore dans l'outil historique.

## Décision
1. **Un objet créé depuis la carte est un objet de la plateforme**, enregistré dans son module ; la règle « une seule
   source par donnée » de l'ADR 0013 est conservée. Route `POST /api/carto/objects` (type, champs minimaux, vue) :
   double contrôle des droits (`cartographie:modifier` et la permission `modifier` du module d'origine), validation
   zod par type, journal `carto.object_create`.
2. Écriture dans l'**état legacy** tant que le module n'est pas repris : lecture et écriture de `app_state` dans une
   transaction **sous verrou de ligne**, incrément de version, notification `legacy_state` ; l'outil historique
   ouvert ailleurs voit le conflit à son prochain enregistrement. Quand le module sera repris, la même route écrira
   dans sa table (adaptateur d'écriture à côté de l'adaptateur de lecture `CartoObjectSource`).
3. Identifiants au format du module (`PI-…`, `PR…`, etc.) ; enjeux créés sur la carte rangés dans
   `maps.settings.issues` (référence `issue:<hachage>`, comme les enjeux dérivés) jusqu'à la reprise des enjeux.
4. Renommer depuis la carte modifie le module d'origine (même double contrôle) ; **aucune suppression** d'un objet de
   la plateforme depuis la carte.
5. Éléments propres à la carte : notes et cadres libres (`note:<id>`, `frame:<id>`) dans la disposition,
   `MapLayoutSchema` étendu (texte, teinte, 200 au plus).
6. Interactions sans dépendance : menu contextuel maison (clic droit, appui long, Maj+F10, ARIA `menu`), palette en
   glisser-déposer par événements pointeur (pas l'API HTML5 de glisser-déposer, peu fiable au tactile), sous CSP
   stricte.

## Conséquences
- La carte devient un point d'entrée de saisie ; la fiche « Créer et compléter » renvoie vers le module (dans
  `/legacy` jusqu'à sa reprise).
- Annuler (Ctrl+Z) n'efface jamais un objet créé : il ne fait que le retirer de la carte.
- Aucune nouvelle dépendance npm ; aucune nouvelle permission.

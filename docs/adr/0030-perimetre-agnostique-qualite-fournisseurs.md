# ADR 0030 — Périmètre agnostique, groupe « Qualité » et module Fournisseurs du Pilotage

**Statut** : proposée le 13/10/2026, après les décisions du RSSI (D1 à D6 du
[cadrage](../unification/CADRAGE-MODULE-QUALITE-9001.md)). Aucun code n'est écrit ; l'ADR fixe l'orientation du premier lot
(M4, module Fournisseurs) et des suivants.

## Contexte

Le RSSI veut ajouter un volet qualité fondé sur l'ISO 9001:2015 (texte fourni, aucun passage reproduit ici) à côté de
l'ISO/IEC 27001:2022 et de l'HDS, avec une vision par processus, des indicateurs, des fournisseurs et un PESTEL. Il demande
une solution **agnostique au démarrage** : si le système de management qualité et le SMSI ont le même périmètre, ils le
partagent au sein d'un système de management intégré (SMI).

Constats de lecture du code (état `78ba57e`) :

- chaque objet du registre commun appartient à un seul périmètre (`smsi_id` de `grc_objects`) et l'activation d'un
  référentiel se fait par périmètre (`frameworks.activate`) ;
- le registre des fournisseurs existe dans l'outil historique ; le registre commun résout déjà ses références
  (`liens.ts`, `apps/api/src/pilotage/legacy.ts`) et le Pilotage sait afficher et modifier une donnée historique sans la
  copier (déclaration d'applicabilité, FCT-030) ;
- le plan de contrôle (`control`, FCT-024) planifie une vérification récurrente, enregistre un résultat immuable et crée le
  constat et l'action ensemble ; le module de droits `fournisseurs` existe.

## Décision

1. **Le SMI n'est pas un nouvel objet** : c'est un périmètre dans lequel plusieurs référentiels sont actifs. Aucun « mode
   qualité » ni « mode sécurité » n'est supposé au démarrage ; une vue propre à un référentiel n'apparaît que s'il est actif
   dans le périmètre courant. Un périmètre distinct garde ses propres objets.
2. **Groupe « Qualité » dans le Pilotage, sans nouveau module de droits** : les droits restent ceux des modules des objets
   (pilotage, écarts, documents, audit, fournisseurs). Un module `qualite` pourra être ajouté plus tard sans migration de
   données.
3. **Module « Gestion des fournisseurs » dans le Pilotage**, par adaptateur du registre existant : lecture et modification
   sous verrou, **sans copie ni migration**, sur le module de droits `fournisseurs` existant. Les critères d'évaluation sont des
   contrôles du plan de contrôle liés au fournisseur et aux exigences des référentiels actifs (ISO/IEC 27001:2022, HDS,
   ISO 9001), la revue étant l'exécution récurrente de ces contrôles.
4. **Aucune grille d'évaluation n'est livrée** (décision du RSSI) : aucun critère, aucune fréquence ni aucun seuil par
   défaut ; l'organisme les saisit.
5. **Les référentiels sont des publications importées, livrées vides, sans texte normatif** ; l'édition est une donnée de la
   publication, jamais une constante du code, ce qui absorbera l'édition 2026 de l'ISO 9001 sans refonte.
6. **Les correspondances entre référentiels ne sont pas livrées** : elles sont rédigées et validées par le RSSI.

## Conséquences

- Le module Fournisseurs apporte de la valeur au SMSI **avant** l'existence d'un référentiel 9001 : il peut être le premier
  lot (M4). Il ne crée pas de table ; une migration additive n'est prévue que si l'ADR de détail du lot en démontre le besoin.
- **Limite connue** : un objet n'appartient qu'à un périmètre. Un fournisseur commun à deux périmètres **distincts** serait
  saisi deux fois ; le partage entre périmètres n'est pas prévu au premier lot (question Q11 du cadrage).
- Le libellé « SMSI » du conteneur devra devenir neutre dans l'interface (« périmètre de management ») ; les noms
  techniques (`grc_smsis`, `/api/grc/smsis`) ne changent pas.
- **Non traité ici** : granularité des exigences 9001 (Q3), axes du PESTEL (Q7), opportunités de 6.1 (Q8), texte de la
  révision 2026 (Q9, attendu du RSSI), design (Q10). Ils feront l'objet de leurs propres décisions avant leur lot.
- Les états « existant » ci-dessus sont des constats de lecture, vérifiés lot par lot par des tests ; ils ne prouvent ni la
  conformité à l'ISO 9001 ni à aucun autre référentiel.
- Retour arrière : supprimer le groupe du Pilotage et l'adaptateur ; le registre historique n'étant pas copié, il n'y a aucune
  donnée à restaurer.

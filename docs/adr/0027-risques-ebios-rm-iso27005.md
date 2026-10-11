# ADR 0027 — Gestion des risques : étude EBIOS RM et processus ISO/IEC 27005 distincts, registre commun

**Statut** : proposée le 11/10/2026 (lot U3 du [plan d'unification](../unification/PLAN-EVOLUTION.md)). Spécification :
[`docs/risques/SPEC-RISQUES-V3.md`](../risques/SPEC-RISQUES-V3.md). Complète l'[ADR 0023](0023-smsi-referentiels-taches-risques.md).

## Contexte

L'audit L1 constate que les quatre familles de méthode (EBIOS RM, ISO/IEC 27005, MÉHARI, personnalisée) partagent une
seule structure : les « cinq ateliers EBIOS » sont des sections du formulaire d'un risque, les objets EBIOS existants
(`risk_source`, `feared_event`, scénarios…) n'ont que des champs texte sans schéma serveur, et les références entre
eux ne sont pas typées. Côté ISO/IEC 27005, il n'y a ni décision d'acceptation formelle, ni identification structurée.

## Décision

1. **Une étude EBIOS RM est un objet** (`risk_study`). Ses éléments sont des objets GRC typés, reliés par des
   références typées : valeurs métier, biens supports, événements redoutés (gravité), sources de risque, couples
   source de risque / objectif visé (`sr_ov`, nouveau), parties prenantes de l'écosystème (`ecosystem_party`,
   nouveau), scénarios stratégiques (gravité) et opérationnels (vraisemblance), mesures de traitement.
2. **Le processus ISO/IEC 27005 reste porté par la fiche de risque** du registre, enrichie (actifs, menace,
   vulnérabilité, conséquences) ; les appréciations brut / résiduel existantes sont conservées.
3. **Décisions immuables réutilisées** (`pilotage_decisions`) : validation d'atelier (`step_validation`) et nouvelle
   opération `risk_acceptance` (responsable, date, conditions, échéance). Aucune décision ne se fabrique par
   l'édition générique d'une fiche.
4. **Références typées** déclarées dans `packages/shared` (`RISK_REF_KINDS`) et vérifiées par le serveur (type,
   périmètre, droit de lecture), en plus de la résolution existante.
5. **Pas de nouvelle table ni dépendance** : `grc_objects.kind` est un texte libre, validé par les schémas zod ;
   aucune migration n'est nécessaire. Retour arrière : une version antérieure ignore les nouveaux types.
6. **Pas de conformité revendiquée** : libellés « inspiré de », échelles publiées par l'organisation ; l'indice de
   menace des parties prenantes (formule du guide EBIOS RM) est une aide à la décision, pas une notation imposée.

## Conséquences

- Les risques existants restent valides (champs nouveaux facultatifs) ; les appréciations passées ne sont pas
  recalculées.
- Les vues EBIOS (par atelier, chaînage SR/OV → scénarios → risques) et le registre filtrable s'appuient sur les
  mêmes objets ; la carte des risques existante les affiche par ses liens.
- Les écrans génériques restent disponibles pour les autres types ; les ateliers ont leurs propres écrans.

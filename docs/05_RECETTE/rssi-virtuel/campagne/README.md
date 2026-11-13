# Résultats de campagne

Un fichier `agent-N.csv` et un fichier `constats-agent-N.md` par agent. Format et consignes :
[CAMPAGNE-MULTI-AGENT.md](../CAMPAGNE-MULTI-AGENT.md). Bilan : `node tests/e2e/rssi-virtuel/matrice.mjs bilan`.

Campagne des 12 et 13/11/2026 ([rapport](../RAPPORT-CAMPAGNE-2026-11-13.md)) :

| Fichiers | Contenu |
| --- | --- |
| `agent-1.csv` à `agent-6.csv`, `constats-agent-1.md` à `constats-agent-6.md` | Phase 1 : une tranche par agent, rôle RSSI, périmètre principal et sous-périmètre (constats `C<N>-xx`) |
| `agent-7-tranche-N.csv`, `constats-agent-7-tranche-N.md` | Phase 2 : autres rôles, compte restreint, téléphone (constats `T<N>-xx`) |
| `rejeu-piles-1-2.md`, `rejeu-piles-3-4.md`, `rejeu-piles-5-6.md` | Phase 3 : rejeu indépendant des bloquants et majeurs, verdict, gravité retenue, doublons, recette du test |


## Amendement du 13/11/2026 — entrées de la revue selon l'ISO/IEC 27001:2022, 9.3.2 (BUG-031, BUG-042)

Arbitrage du RSSI du 13/11/2026 : l'application se concentre sur l'ISO/IEC 27001 ; **l'ISO 9001 n'est plus suivie pour le moment**.

1. **Décision 9 remplacée** : les entrées de la revue sont celles de l'ISO/IEC 27001:2022, 9.3.2 : a) actions des revues précédentes ; b) enjeux
   externes et internes ; c) besoins et attentes des parties intéressées ; d) performance de sécurité (d 1 non-conformités et actions
   correctives, d 2 surveillance, mesure et incidents, d 3 audits, d 4 objectifs) ; e) retours des parties intéressées ; f) appréciation des
   risques et plan de traitement ; g) opportunités d'amélioration continue. Les sorties (9.3.3) sont les décisions d'amélioration et les
   besoins de changement du SMSI ; la sortie « besoins en ressources » (9.3.3 c de l'ISO 9001) n'est plus proposée. Les champs déjà saisis
   (`entree_c1`…, `resourceNeeds`) restent dans les fiches, sans être supprimés.
2. **Une revue par périmètre** (BUG-042) : chaque périmètre prépare ses entrées à partir de ses propres fiches (constats, risques, incidents,
   parties, contexte). Un périmètre enfant qui hérite des référentiels de son parent (`inherit_frameworks`, ADR 0039) **remonte** dans la revue
   du parent, avec la mention de ses périmètres ; un enfant qui n'hérite pas reste hors de la revue du parent. Les données historiques de l'outil
   de suivi (indicateurs, plans d'audit, fournisseurs) relèvent du périmètre commun.
3. Les incidents du périmètre entrent dans l'entrée d 2 (BUG-070).

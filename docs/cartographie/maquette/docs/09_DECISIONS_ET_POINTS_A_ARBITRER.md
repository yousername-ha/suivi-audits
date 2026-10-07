# 9. Décisions prises et points à arbitrer

## Décisions retenues

- conserver la vue graphique de contexte comme référence principale ;
- faire du canvas un éditeur, pas un simple rendu ;
- séparer données métier et données de présentation ;
- réutiliser le même moteur pour Vue contexte et Vue processus ;
- génération automatique assistée, puis ajustement manuel ;
- ne jamais écraser les positions manuelles lors d’une synchronisation métier ;
- rendre les relations secondaires masquables ;
- utiliser un panneau de détail unique, contextuel selon le type d’objet.

## À arbitrer avant développement

1. La cartographie peut-elle créer de nouveaux objets métier ou uniquement référencer des objets existants ?
2. Quelles relations sont métier et lesquelles peuvent rester purement graphiques ?
3. Qui peut modifier l’appartenance au périmètre ?
4. Le périmètre SMSI est-il déjà modélisé dans la plateforme ?
5. Les référentiels sont-ils déjà des entités configurables ?
6. Les exigences sont-elles liées directement aux processus, actifs, risques, ou via une table générique de relations ?
7. Quels droits et rôles existent déjà ?
8. Quelle stratégie de versionnement est souhaitée : version automatique, publication explicite, ou les deux ?
9. L’export PDF doit-il constituer une preuve documentaire formelle ou seulement un support visuel ?
10. Quels volumes maximaux de nodes/relations doit-on supporter ?
11. Le design system de la plateforme impose-t-il déjà des tokens et composants ?
12. La vue processus doit-elle afficher les processus de pilotage ultérieurement ?

# Tester les registres d’écarts et les plans d’action

Extraire le ZIP puis lancer **DEMARRER.bat**. Les données sont fictives ; le menu conserve le style retenu. Les rubriques hors du périmètre de ce prototype sont indiquées comme telles. La maquette EBIOS v2 reste disponible séparément.

## Parcours audit → écart → actions → conformité

1. Dans **Conformité & audits → Audits**, créer un audit et choisir son périmètre. Cliquer sur **Créer un registre**. Il est aussi possible de créer un registre hors audit.
2. Nommer le registre, choisir son responsable et sa description. Ouvrir le registre et **Ajouter un écart**.
3. Saisir le constat, sa classification, son responsable et son échéance. Cocher une ou plusieurs exigences applicables sur ce périmètre. Renseigner la cause et la correction lorsqu’elles sont connues.
4. Dans **Actions → Plans d’action**, créer un plan et sélectionner un ou plusieurs périmètres. Créer plusieurs plans pour tester leur indépendance.
5. Depuis la fiche d’écart, cliquer sur **Action corrective**. Sélectionner le plan, le périmètre, les écarts concernés et les éventuelles exigences supplémentaires. Une action peut corriger plusieurs écarts de différents registres du même périmètre.
6. Ouvrir un plan en **Liste** puis en **Kanban**. Le bouton **Modifier / déplacer** permet de changer l’état de l’action ; le glisser-déposer n’est pas simulé.
7. Passer l’action à **Terminée** et renseigner son résultat ou sa référence de preuve. L’écart reste ouvert. Si un écart a plusieurs actions, les terminer toutes.
8. Ouvrir l’écart puis **Vérifier et clôturer**. Saisir cause, correction, résultat de vérification, référence de preuve et vérificateur. La maquette exige au moins une action liée et toutes les actions terminées : c’est une règle de démonstration à valider, pas une règle universelle ISO/HDS.
9. Dans **Conformité & applicabilité**, filtrer le périmètre, ouvrir l’exigence et enregistrer une évaluation justifiée. Les écarts et les actions y sont visibles. La clôture de l’écart n’a pas validé automatiquement la conformité.
10. Rouvrir une action : les écarts clos concernés repassent **À vérifier**. Une conformité précédemment retenue **Conforme** apparaît **À réévaluer** en présence d’écarts ouverts ; son évaluation historique reste conservée.

## Autres essais

- Ajouter une exigence dans **Administration → Référentiels**, avec sa référence et les périmètres où elle s’applique.
- Vérifier qu’un périmètre sans HDS ne propose pas l’exemple HDS dans le formulaire d’écart.
- Essayer de changer le périmètre d’un registre contenant des écarts : refus explicite.
- Essayer de déclarer une exigence non applicable alors que des écarts/actions la référencent : refus pour préserver les liens.
- Archiver un registre dont les écarts sont tous clos ou un plan dont les actions sont toutes terminées. Les objets restent dans l’historique et dans les relations ; **Afficher les archives** permet de les réactiver.
- Exporter les actions en CSV ; exporter les essais en JSON depuis **Journal & données**.
- Exporter, réinitialiser avec le mot EFFACER puis restaurer le JSON avec le mot RESTAURER. Les sauvegardes de la maquette EBIOS v2 sont distinctes et ne sont pas importables ici.

## Points proposés à valider

Liens multiples écart/exigences ; plans transversaux à plusieurs registres ; périmètres multiples par plan mais un périmètre par action ; classifications et règles de clôture ; emplacement des registres sous Conformité & audits. Le style du menu est conservé, son ordre reste provisoire.

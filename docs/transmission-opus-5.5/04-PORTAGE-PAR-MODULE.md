# Spécification de portage par module

L’état ci-dessous concerne la référence de refonte, pas la version actuelle du demandeur. Pour chaque lot, renseigner la ligne cible de la matrice avant de coder. Les images de l’atlas sont légendées avec leur statut.

## Charte, cadres et fenêtres

**État de référence :** Validé ; intégré dans la référence. Révision : `fede361`.

- Inter locale, titres lisibles et neutres, valeurs/états colorés ; pas de faux lien hypertexte dans les intitulés.
- Biseau retenu pour les cadres et le Contexte ; ne pas imposer des angles coupés aux cartes Studio arrondies déjà validées.
- Lecture propre distincte du formulaire ; toutes les données métier et commandes de modification restent accessibles selon les droits.
- Pas de corps de fiche à défilement vertical imbriqué : hauteur naturelle, voile extérieur défilant si la fiche dépasse l’écran ; longs formulaires accessibles du haut au bas.
- Les tables/listes longues gardent leur défilement local. Les listes déroulantes, champs multiligne et graphes horizontaux conservent leur fonctionnement.

**Points de comparaison de code :**

- [apps/web/src/pilotage/RecordEditor.tsx](reference/apps/web/src/pilotage/RecordEditor.tsx)
- [apps/web/src/pilotage/Registry.tsx](reference/apps/web/src/pilotage/Registry.tsx)
- [packages/ui/src/neon-fenetres.css](reference/packages/ui/src/neon-fenetres.css)
- [packages/ui/src/neon.css](reference/packages/ui/src/neon.css)
- [packages/ui/src/styles.css](reference/packages/ui/src/styles.css)
- [packages/ui/src/theme.ts](reference/packages/ui/src/theme.ts)
- [packages/ui/src/tokens.ts](reference/packages/ui/src/tokens.ts)

**Détails et preuves datées :**

- [FENETRES-GLOBALES](reference/docs/refonte-neon/FENETRES-GLOBALES.md)
- [CADRES-NEON](reference/docs/refonte-neon/CADRES-NEON.md)
- [FENETRES](reference/docs/refonte-neon/FENETRES.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Dashboard analytique et graphiques

**État de référence :** Intégré dans la référence ; deux dernières images sont des projections de menu. Révision : `d9d1478 + visuels 55d43ee`.

- Vue analytique Neon de douze cartes ; conserver une disposition personnelle/organisation/partagée existante et son éditeur, ne pas l’écraser.
- Les valeurs et détails viennent des API réelles et des droits ; zéro indisponible ne devient pas un vrai résultat ; aucun historique ni score de certification inventé.
- Le filtre ISO/HDS, la recherche de cartes, les exports et l’accès aux détails restent présents.
- Les images finales ont le menu bleu nuit dans les deux thèmes mais ne prouvent pas son intégration React. Les dalles du Dashboard ne sont pas redessinées par la demande de menu.

**Points de comparaison de code :**

- [apps/web/src/components/DispositionTableauDeBord.tsx](reference/apps/web/src/components/DispositionTableauDeBord.tsx)
- [apps/web/src/components/NeonAnalytics.tsx](reference/apps/web/src/components/NeonAnalytics.tsx)
- [apps/web/src/components/TableauDeBord.tsx](reference/apps/web/src/components/TableauDeBord.tsx)
- [apps/web/src/pages/Home.tsx](reference/apps/web/src/pages/Home.tsx)
- [packages/ui/src/neon-analytics.css](reference/packages/ui/src/neon-analytics.css)
- [packages/ui/src/neon-graphiques.tsx](reference/packages/ui/src/neon-graphiques.tsx)

**Détails et preuves datées :**

- [PROTOTYPE-INTEGRE](reference/docs/refonte-neon/PROTOTYPE-INTEGRE.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Organisation — Périmètre et contexte

**État de référence :** Validé ; intégré dans la référence. Révision : `e5dabd2 / validation fede361`.

- Quatre zones lisibles séparées : Interfaces, Dépendances, Enjeux internes, Enjeux externes ; puces, titres et pictogrammes propres.
- Conserver Organisation, activités, exclusions, responsables et tous les champs du contexte ; vue d’audit distincte de la saisie.
- Les champs historiques sont des textes libres : classer uniquement les rubriques explicitement indiquées, garder le reste dans « À préciser » ; aucune classification sémantique ou réécriture de données à l’ouverture.
- Biseau et cinq pictogrammes animés retenus ; textes fixes, pause/réduction système, pas d’ascenseur interne au panneau.

**Points de comparaison de code :**

- [apps/web/src/pilotage/ContextPresentation.tsx](reference/apps/web/src/pilotage/ContextPresentation.tsx)
- [apps/web/src/pilotage/RecordEditor.tsx](reference/apps/web/src/pilotage/RecordEditor.tsx)
- [apps/web/src/pilotage/categories-contexte.ts](reference/apps/web/src/pilotage/categories-contexte.ts)
- [packages/ui/src/neon-fenetres.css](reference/packages/ui/src/neon-fenetres.css)

**Détails et preuves datées :**

- [CONTEXTE-PRESENTATION](reference/docs/refonte-neon/CONTEXTE-PRESENTATION.md)
- [CONTEXTE-CATEGORIES](reference/docs/refonte-neon/CONTEXTE-CATEGORIES.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Périmètres — graphe compact centré

**État de référence :** Validé ; intégré dans la référence. Révision : `495427d puis eed9f21`.

- Graphe par défaut, cartes repliées au chargement avec seules informations essentielles ; ensemble centré.
- Commande +/− centrée en bas. Une carte s’élargit en rectangle (référence PC 260 → 620 px), sans devenir une simple liste verticale.
- Recalculer positions et liaisons sur dimensions réelles, contenu et polices ; pas de titre tronqué ni scrollbar dans une dalle.
- Préserver sous-périmètres, fournisseurs externes, sous-totaux dédupliqués, alertes, commandes, filtres et données ; adapter le gabarit à la fenêtre sans réduction globale.

**Points de comparaison de code :**

- [apps/web/src/pilotage/CartesPerimetres.tsx](reference/apps/web/src/pilotage/CartesPerimetres.tsx)
- [apps/web/src/pilotage/Perimetres.tsx](reference/apps/web/src/pilotage/Perimetres.tsx)
- [packages/ui/src/neon-perimetres.css](reference/packages/ui/src/neon-perimetres.css)

**Détails et preuves datées :**

- [PERIMETRES-COMPACTS-INTEGRES](reference/docs/refonte-neon/PERIMETRES-COMPACTS-INTEGRES.md)
- [HORIZONTAL-STUDIO-INTEGRE](reference/docs/refonte-neon/HORIZONTAL-STUDIO-INTEGRE.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Objectifs et indicateurs — compact Studio

**État de référence :** Validé ; intégré dans la référence. Révision : `eed9f21`.

- Vue compacte par défaut ; dernière proportion B avec blocs réduits, titres des objectifs lisibles conservés.
- Cible à atteindre violette et visible ; valeur mesurée et état en blocs cohérents colorés, couleurs soutenues et contours nets.
- En-têtes alignés et centrés ; ne pas perdre les noms des colonnes.
- « Non atteint » accent rouge animé et icône warning ; flèches d’évolution vertes/rouges animées conservées, pas supprimées (ambiguïté levée dans la conversation).
- Les flèches décrivent la variation numérique ; l’atteinte dépend de la cible et de son opérateur. Ne pas transformer une baisse favorable à un maximum en échec.
- Préserver vues alternatives, boîtes de pilotage, processus, dates, opérateurs, filtres et formulaires existants.

**Points de comparaison de code :**

- [apps/web/src/pilotage/FichesObjectifs.tsx](reference/apps/web/src/pilotage/FichesObjectifs.tsx)
- [apps/web/src/pilotage/ObjectifsProcessus.tsx](reference/apps/web/src/pilotage/ObjectifsProcessus.tsx)
- [packages/ui/src/neon-objectifs.css](reference/packages/ui/src/neon-objectifs.css)

**Détails et preuves datées :**

- [OBJECTIFS-VERSION-B](reference/docs/refonte-neon/OBJECTIFS-VERSION-B.md)
- [OBJECTIFS-VUE-COMPACTE](reference/docs/refonte-neon/OBJECTIFS-VUE-COMPACTE.md)
- [HORIZONTAL-STUDIO-INTEGRE](reference/docs/refonte-neon/HORIZONTAL-STUDIO-INTEGRE.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## DDA — synthèse et mesures en lignes

**État de référence :** Dernière direction validée ; intégrée dans la référence. Révision : `008cc30 (succède à 4a1304b)`.

- Conserver les dalles supérieures de statistiques ; nombreuses mesures en lignes compactes, pas en grandes cartes individuelles.
- Applicable et Mise en œuvre remplis, plus foncés, distincts, vert/orange/rouge ; choix au clic sans petit chevron décoratif, avec clavier et nom accessibles.
- Dernière direction Studio claire lavande/blanc et sombre bleu nuit ; les anciens gris/sauge trop transparents/Bootstrap et halos excessifs sont remplacés.
- Préserver restrictions des clauses obligatoires, niveau Total vs certification, statuts, preuves, documents, commentaires, risques, écarts, actions et marqueurs métier.
- La nouvelle sidebar commune remplace seulement les anciens overrides de navigation conditionnés par la DDA ; conserver le thème du contenu métier.

**Points de comparaison de code :**

- [apps/web/src/dda/Dda.tsx](reference/apps/web/src/dda/Dda.tsx)
- [apps/web/src/dda/DdaIcone.tsx](reference/apps/web/src/dda/DdaIcone.tsx)
- [apps/web/src/dda/DdaSynthese.tsx](reference/apps/web/src/dda/DdaSynthese.tsx)
- [packages/ui/src/neon-dda.css](reference/packages/ui/src/neon-dda.css)

**Détails et preuves datées :**

- [DDA-STUDIO-INTEGREE](reference/docs/refonte-neon/DDA-STUDIO-INTEGREE.md)
- [DDA-INTEGREE](reference/docs/refonte-neon/DDA-INTEGREE.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Référentiels et exigences

**État de référence :** Validé ; intégré, puis bibliothèque unifiée plus récente. Révision : `65bd22f puis 35e700c`.

- Catalogue compact, exigences en lignes avec code/intitulé/domaine ; fiches de source/publication propres et provenance explicite.
- Distinguer édition documentaire, version de fiche, publication et activation ; source à vérifier n’est pas source officielle.
- Conserver import/simulation/confirmation/copie/publication/historique/exports selon les capacités présentes de la cible.
- Ne pas ressusciter l’ancien onglet Référentiels et exigences retiré du menu si la cible utilise déjà la bibliothèque unifiée ; vérifier ses accès directs et liens métier.

**Points de comparaison de code :**

- [apps/web/src/grc/LegacyFrameworks.tsx](reference/apps/web/src/grc/LegacyFrameworks.tsx)
- [apps/web/src/grc/Publication.tsx](reference/apps/web/src/grc/Publication.tsx)
- [apps/web/src/grc/ReferentielsStudio.tsx](reference/apps/web/src/grc/ReferentielsStudio.tsx)
- [apps/web/src/pilotage/Bibliotheque.tsx](reference/apps/web/src/pilotage/Bibliotheque.tsx)
- [packages/ui/src/neon-referentiels.css](reference/packages/ui/src/neon-referentiels.css)

**Détails et preuves datées :**

- [REFERENTIELS-INTEGRES](reference/docs/refonte-neon/REFERENTIELS-INTEGRES.md)
- [BIBLIOTHEQUE-UNIFIEE-INTEGREE](reference/docs/refonte-neon/BIBLIOTHEQUE-UNIFIEE-INTEGREE.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Bibliothèque de référentiels et couverture fusionnées

**État de référence :** Validé ; intégré dans la référence. Révision : `35e700c puis d9d1478`.

- Une destination Bibliothèque réunit catalogue global et couverture du périmètre choisi dans chaque dalle.
- Identité/nom/source à gauche, couverture à droite ; panneau de nom plus foncé en clair, contours visibles et palette équilibrée SWOT/PESTEL.
- Bandeau ambre des clauses obligatoires non encore conformes : légère pulsation du contour, texte fixe, pause/réduction ; pas d’alerte ni de score inventé.
- Correspondances, rapprochements à valider, analyse service, applications à intégrer et anciens onglets barrés ne redeviennent pas visibles ; conserver les flux et données existants utiles.
- Seule l’ancienne adresse Couverture redirige dans la référence, avec contexte ; les six autres routes cachées restent directement accessibles. Vérifier les routes de la cible avant toute nouvelle redirection.

**Points de comparaison de code :**

- [apps/web/src/pilotage-navigation.ts](reference/apps/web/src/pilotage-navigation.ts)
- [apps/web/src/pilotage/Bibliotheque.tsx](reference/apps/web/src/pilotage/Bibliotheque.tsx)
- [apps/web/src/pilotage/BibliothequeStudio.tsx](reference/apps/web/src/pilotage/BibliothequeStudio.tsx)
- [apps/web/src/pilotage/bibliotheque-types.ts](reference/apps/web/src/pilotage/bibliotheque-types.ts)
- [packages/ui/src/neon-bibliotheque.css](reference/packages/ui/src/neon-bibliotheque.css)

**Détails et preuves datées :**

- [BIBLIOTHEQUE-UNIFIEE-INTEGREE](reference/docs/refonte-neon/BIBLIOTHEQUE-UNIFIEE-INTEGREE.md)
- [BIBLIOTHEQUE-ASSISTANT-NEON-INTEGRES](reference/docs/refonte-neon/BIBLIOTHEQUE-ASSISTANT-NEON-INTEGRES.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## SWOT relié aux processus — Matrice Studio

**État de référence :** Dernier modèle explicitement retenu ; intégré. Révision : `51d7022`.

- Quatre quadrants lisibles et biseautés, couleurs propres, pictogrammes animés et relief subtil au survol/focus.
- Grand cercle processus centré au croisement sans empiéter sur titres/textes ; référence 184 px PC, 134 tablette, 120 petit écran avec adaptation.
- Les réserves et découpes évitent le chevauchement des analyses longues ; cercle ouvre toujours le processus réel.
- Conserver lectures, registre, filtres, historique, relations et droits ; pas de nouveau processus ou lien généré par le décor.

**Points de comparaison de code :**

- [apps/web/src/pilotage/SwotMatrice.tsx](reference/apps/web/src/pilotage/SwotMatrice.tsx)
- [apps/web/src/pilotage/swot-presentation.ts](reference/apps/web/src/pilotage/swot-presentation.ts)
- [packages/ui/src/neon-swot.css](reference/packages/ui/src/neon-swot.css)

**Détails et preuves datées :**

- [SWOT-STUDIO-INTEGRE](reference/docs/refonte-neon/SWOT-STUDIO-INTEGRE.md)
- [SWOT-CENTRE-AGRANDI-INTEGRE](reference/docs/refonte-neon/SWOT-CENTRE-AGRANDI-INTEGRE.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## PESTEL — constellation Studio

**État de référence :** Validé ; intégré. Révision : `5dd1c68`.

- Constellation des facteurs, enjeux du facteur sélectionné et processus associés ; couleurs et animations dans le style SWOT.
- Facteurs de la nomenclature API, pas six identifiants codés en dur ; nomenclature étendue/absente, textes longs et états vides gérés.
- Enjeux externes non classés dans leur bandeau ambre ; enjeux internes séparés et non classables en PESTEL.
- Préserver sélection URL/périmètre, PUT existant, chargement/erreurs, noms de processus, non-résolus et contrôles de droits.

**Points de comparaison de code :**

- [apps/web/src/pilotage/Pestel.tsx](reference/apps/web/src/pilotage/Pestel.tsx)
- [apps/web/src/pilotage/PestelStudio.tsx](reference/apps/web/src/pilotage/PestelStudio.tsx)
- [packages/ui/src/neon-pestel.css](reference/packages/ui/src/neon-pestel.css)

**Détails et preuves datées :**

- [PESTEL-STUDIO-INTEGRE](reference/docs/refonte-neon/PESTEL-STUDIO-INTEGRE.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Plan d’actions — Timeline Studio

**État de référence :** Validé ; intégré puis validation rapide. Révision : `5ed760b puis 23b33b5`.

- Timeline par défaut ; lignes fines mais lisibles, liste longue à défilement local, commandes de vues en icônes.
- Statut À faire orange animé plus visible, cycle 2,2 s, texte fixe, pause/réduction système ; retard distinct du statut et du résultat.
- Clic sur repère : petite fenêtre résultat OK/KO, preuve et commentaire ; clic sur fond de ligne : fiche complète. Préserver l’aperçu du titre.
- Validation existante réouverte avec motif ; décisions antérieures/historique/versionnement conservés. Pas de décision écrasée silencieusement.
- Conserver les vues alternatives, responsables, dates, registres, filtres et commandes métier de la cible.

**Points de comparaison de code :**

- [apps/web/src/fiche-cliquable.ts](reference/apps/web/src/fiche-cliquable.ts)
- [apps/web/src/grc/Timeline.tsx](reference/apps/web/src/grc/Timeline.tsx)
- [apps/web/src/grc/TimelineStudio.tsx](reference/apps/web/src/grc/TimelineStudio.tsx)
- [apps/web/src/grc/ValidationRapide.tsx](reference/apps/web/src/grc/ValidationRapide.tsx)
- [packages/ui/src/neon-taches.css](reference/packages/ui/src/neon-taches.css)

**Détails et preuves datées :**

- [TIMELINE-STUDIO-INTEGREE](reference/docs/refonte-neon/TIMELINE-STUDIO-INTEGREE.md)
- [LIGNES-ET-VALIDATION-RAPIDE](reference/docs/refonte-neon/LIGNES-ET-VALIDATION-RAPIDE.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Tâches récurrentes — Timeline adaptative

**État de référence :** Validé ; intégré puis validation rapide. Révision : `5ed760b puis 23b33b5`.

- Même style/mouvements et Timeline par défaut ; réglages, séries, modèles et iCalendar restent accessibles.
- Auto suit la série choisie, sinon l’unité la plus fine présente. Jour = 14 jours, semaine = 12 semaines ISO, mois = 12 mois réels, année = 5 années civiles.
- Bissextiles, bornes calendaires, navigation, aujourd’hui, ajustement horizon et repères proches étagés ; aucune occurrence créée par le rendu.
- Repère ouvre OK/KO et NA pour les occurrences si le contrat cible le permet, avec commentaire/preuve et réouverture motivée.
- Conserver séries en pause/vides, fiches hors horizon/sans date/incohérentes et moteur métier existant.

**Points de comparaison de code :**

- [apps/web/src/grc/TimelineStudio.tsx](reference/apps/web/src/grc/TimelineStudio.tsx)
- [apps/web/src/grc/ValidationRapide.tsx](reference/apps/web/src/grc/ValidationRapide.tsx)
- [apps/web/src/grc/timeline-calendrier.ts](reference/apps/web/src/grc/timeline-calendrier.ts)
- [packages/ui/src/neon-taches.css](reference/packages/ui/src/neon-taches.css)

**Détails et preuves datées :**

- [TIMELINE-STUDIO-INTEGREE](reference/docs/refonte-neon/TIMELINE-STUDIO-INTEGREE.md)
- [LIGNES-ET-VALIDATION-RAPIDE](reference/docs/refonte-neon/LIGNES-ET-VALIDATION-RAPIDE.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Registres — lignes ouvrables et filtres discrets

**État de référence :** Exigences acquises ; lignes intégrées, déclinaison épurée partielle. Révision : `23b33b5 + propositions PC`.

- Clic sur toute ligne/zone libre, Entrée/Espace ; ne pas imposer le seul bouton Afficher à droite.
- Boutons, liens, inputs, menus, sélection de texte et touches modificatrices gardent leur action ; retour du focus à la ligne après fermeture.
- Loupe et filtres accessibles à la demande, petits boutons de vues avec nom/info-bulle/focus ; ne supprimer aucun filtre réel pour épurer.
- Compteurs, recherche locale sur fiches chargées et totaux serveur distingués ; pagination conservée.
- Pas de grand panneau de recherche permanent ; ne pas imposer un prototype de toolbar non validé à tous les modules sans contrôler l’existant.

**Points de comparaison de code :**

- [apps/web/src/fiche-cliquable.ts](reference/apps/web/src/fiche-cliquable.ts)
- [apps/web/src/pilotage/Registry.tsx](reference/apps/web/src/pilotage/Registry.tsx)
- [packages/ui/src/lignes-fiches.css](reference/packages/ui/src/lignes-fiches.css)

**Détails et preuves datées :**

- [LIGNES-ET-VALIDATION-RAPIDE](reference/docs/refonte-neon/LIGNES-ET-VALIDATION-RAPIDE.md)
- [CHARTE-RESPONSIVE](reference/docs/refonte-neon/CHARTE-RESPONSIVE.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Adaptation PC, largeur et hauteur

**État de référence :** Règle transversale demandée ; réalisation partielle selon module. Révision : `Référence par lot`.

- Priorité PC : portable, bureau, grand écran et fenêtre redimensionnée. Téléphone non prioritaire, sans casse délibérée des usages existants.
- Lire à taille stable ; réorganiser colonnes/commandes plutôt que zoom CSS ou transform:scale global.
- Contrôler aussi la hauteur, le zoom 150 %, les textes longs et les grandes listes ; pas de dalles gigantesques ou textes miniaturisés.
- Listes locales défilantes ; fiches longues à hauteur naturelle dans voile extérieur. Aucun champ/commande/donnée perdu pour rentrer dans l’écran.
- Les dimensions des maquettes PC sont des références à adapter aux composants/tokens de la cible, pas une nouvelle logique métier.

**Points de comparaison de code :**

- [packages/ui/src/neon.css](reference/packages/ui/src/neon.css)
- [packages/ui/src/styles.css](reference/packages/ui/src/styles.css)
- [packages/ui/src/tokens.ts](reference/packages/ui/src/tokens.ts)

**Détails et preuves datées :**

- [CHARTE-RESPONSIVE](reference/docs/refonte-neon/CHARTE-RESPONSIVE.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Parties intéressées — panorama centré et liaisons

**État de référence :** Intégré après poursuite autorisée ; centrage final intégré. Révision : `81ea06a puis 67a334a`.

- Internes à gauche, externes à droite ; cercle centré sur la rangée des cartes, légende en colonne indépendante.
- Deux sorties maximum, rails et branches orthogonaux dans gouttières sans traverser le texte ; recalcul après resize/polices/contenu.
- Deux points lumineux maximum, flux discret décoratif, lignes fixes, pause/reprise et mouvement réduit.
- Nature inconnue dans À préciser sans faux lien ; panorama/liste compacte, critères et pagination de fiches chargées conservés.
- Lecture distincte de la modification ; traitement/revue/dates/justificatifs/historique et retour du focus préservés.

**Points de comparaison de code :**

- [apps/web/src/pilotage/PartiePresentation.tsx](reference/apps/web/src/pilotage/PartiePresentation.tsx)
- [apps/web/src/pilotage/PartiesInteresseesStudio.tsx](reference/apps/web/src/pilotage/PartiesInteresseesStudio.tsx)
- [apps/web/src/pilotage/parties-liaisons.ts](reference/apps/web/src/pilotage/parties-liaisons.ts)
- [packages/ui/src/neon-parties.css](reference/packages/ui/src/neon-parties.css)

**Détails et preuves datées :**

- [PARTIES-STUDIO-INTEGREES](reference/docs/refonte-neon/PARTIES-STUDIO-INTEGREES.md)
- [PROCESSUS-STUDIO-INTEGRE](reference/docs/refonte-neon/PROCESSUS-STUDIO-INTEGRE.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Processus — cartes Studio et lecture distincte

**État de référence :** Intégré après poursuite autorisée. Révision : `67a334a`.

- Cartes regroupées par types, pilotes et cinq catégories de rattachements ; + centré déplie finalité/sous-processus.
- Cartes par défaut, liste compacte et filtres via icônes ; corps ouvre consultation au clic/clavier, résultats défilent localement.
- Conserver rattachements et origines via, distinguer catégorie inaccessible de vide et référence inconnue de relation inexistante.
- Enfant trouvé visible même si parent filtré ; types archivés/inconnus conservés, parent exclut descendants.
- Formulaire métier réel, mutations et annulation/erreurs conservés ; pas de recomposition arbitraire de la cartographie.

**Points de comparaison de code :**

- [apps/web/src/processus/CartesProcessus.tsx](reference/apps/web/src/processus/CartesProcessus.tsx)
- [apps/web/src/processus/ProcessusIcone.tsx](reference/apps/web/src/processus/ProcessusIcone.tsx)
- [apps/web/src/processus/ProcessusPresentation.tsx](reference/apps/web/src/processus/ProcessusPresentation.tsx)
- [apps/web/src/processus/ProcessusStudio.tsx](reference/apps/web/src/processus/ProcessusStudio.tsx)
- [apps/web/src/processus/processus-presentation.ts](reference/apps/web/src/processus/processus-presentation.ts)
- [packages/ui/src/neon-processus.css](reference/packages/ui/src/neon-processus.css)

**Détails et preuves datées :**

- [PROCESSUS-STUDIO-INTEGRE](reference/docs/refonte-neon/PROCESSUS-STUDIO-INTEGRE.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Rôles et responsabilités — proposition Studio

**État de référence :** Proposition non explicitement validée ; ne pas présenter comme intégrée. Révision : `166990f`.

- Le dossier contient la maquette historique pour connaissance, pas un ordre de remplacement de l’écran courant.
- Contrôler ce qui existe sur la cible. Conserver sa logique et appliquer seulement les composants transversaux déjà validés.
- Toute présentation spécifique différente demande un visuel avant portage.

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Fournisseurs — registre compact Studio

**État de référence :** Validé ; intégré. Révision : `ee8b524`.

- Compact par défaut, lignes fines ouvrables et états colorés ; détail supplémentaire à la demande, recherche/loupe et filtres discrets.
- Lecture différente de l’édition ; informations/certificats/contrôles/évaluation séparés, certificats et contrôles paginés pour éviter fiche interminable.
- Édition directe des sélecteurs autorisés sans ouvrir la ligne ; droits lecture/évaluation/modification appliqués.
- SSO/MFA Oui vert, Non rouge, En cours ambre, non renseigné/NA neutres. Criticité Oui = attention, HDS déclaré n’est pas certification vérifiée.
- Préserver historique, évaluations, rattachements, versionnement, dates et commentaires ; données indisponibles = —, pas de résultat zéro inventé.

**Points de comparaison de code :**

- [apps/web/src/pilotage/Fournisseurs.tsx](reference/apps/web/src/pilotage/Fournisseurs.tsx)
- [apps/web/src/pilotage/FournisseursStudio.tsx](reference/apps/web/src/pilotage/FournisseursStudio.tsx)
- [apps/web/src/pilotage/fournisseurs-types.ts](reference/apps/web/src/pilotage/fournisseurs-types.ts)
- [packages/ui/src/neon-fournisseurs.css](reference/packages/ui/src/neon-fournisseurs.css)

**Détails et preuves datées :**

- [FOURNISSEURS-STUDIO-INTEGRES](reference/docs/refonte-neon/FOURNISSEURS-STUDIO-INTEGRES.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Assistant RSSI global et avatar HD Neon

**État de référence :** Frontend intégré ; backend séparé à réconcilier avec la cible. Révision : `04a310f puis d9d1478`.

- Présence dans toute la plateforme authentifiée, pas un nouveau menu métier : lanceur, avatar vectoriel net, panneau de discussion et boîte personnelle.
- Identité, contexte, profils, historique, brouillons persistants lors des changements de rubrique ; pas deux chats concurrents après raccordement de la page administration.
- Cadres plus présents, accents cyan/bleu, avatar SVG HD sans image floue, gradients à IDs uniques, animations discrètes et pause/réduction.
- Réutiliser impérativement le backend assistant déjà présent dans la cible, ses DTO, routes, limites, gardes et sources ; pas de Mistral fictif ni de nouvelles tables par défaut.
- Notifications/rappels/questions et propositions suivent le vrai contrat. Ne pas prétendre qu’une preuve RAG, une extraction documentaire ou une ronde réelle a été validée par les captures UI.

**Points de comparaison de code :**

- [apps/web/src/assistant/AssistantGlobal.tsx](reference/apps/web/src/assistant/AssistantGlobal.tsx)
- [apps/web/src/assistant/IdentiteAssistant.tsx](reference/apps/web/src/assistant/IdentiteAssistant.tsx)
- [apps/web/src/assistant/contrats.ts](reference/apps/web/src/assistant/contrats.ts)
- [apps/web/src/components/Layout.tsx](reference/apps/web/src/components/Layout.tsx)
- [packages/ui/src/neon-assistant.css](reference/packages/ui/src/neon-assistant.css)

**Détails et preuves datées :**

- [ASSISTANT-RSSI-GLOBAL-INTEGRE](reference/docs/refonte-neon/ASSISTANT-RSSI-GLOBAL-INTEGRE.md)
- [BIBLIOTHEQUE-ASSISTANT-NEON-INTEGRES](reference/docs/refonte-neon/BIBLIOTHEQUE-ASSISTANT-NEON-INTEGRES.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Menu latéral commun final — bleu nuit opaque

**État de référence :** Validé à porter ; aperçu seulement dans les dernières captures. Révision : `e100b28 + confirmation 55d43ee`.

- Même dégradé bleu nuit/pétrole dans les deux thèmes ; pas de fond jaune/crème ni de transparence de l’ultime essai rejeté.
- Mêmes formes SVG modernes, teinte par icône et mouvements dans les deux thèmes, comme les deux projections Dashboard approuvées.
- Une seule charte de sidebar, indépendante de l’onglet ; remplacer uniquement ses anciens overrides par page, pas les styles des contenus.
- Conserver calcul des droits, ordre personnel, compteurs réels, alertes, destinations et accès conditionnels ; ne jamais recopier les tableaux statiques de la maquette.
- Voir le document dédié 05-MENU-FINAL pour treize couleurs, géométrie, animations et recette.

**Points de comparaison de code :**

- [apps/web/src/components/Layout.tsx](reference/apps/web/src/components/Layout.tsx)
- [apps/web/src/components/tri-menu.ts](reference/apps/web/src/components/tri-menu.ts)
- [apps/web/src/navigation.ts](reference/apps/web/src/navigation.ts)
- [apps/web/src/pilotage-navigation.ts](reference/apps/web/src/pilotage-navigation.ts)
- [packages/ui/src/neon-dda.css](reference/packages/ui/src/neon-dda.css)

**Détails et preuves datées :**

- [BIBLIOTHEQUE-UNIFIEE-INTEGREE](reference/docs/refonte-neon/BIBLIOTHEQUE-UNIFIEE-INTEGREE.md)

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Cartographie SMSI et génération automatique

**État de référence :** Conserver existant ; proposition de remplacement rejetée, habillage mis de côté. Révision : `a0d7747 (décision)`.

- Ne pas modifier canevas, objets, positions, liens, génération automatique, éditeur ou présentation actuelle.
- Le panorama cartographie-studio est NON RETENU. L’habillage cartographie-habillage est MIS DE CÔTÉ, pas validé à porter.
- Le graphique RETEX généré reste également protégé. Une éventuelle harmonisation ultérieure doit partir de l’existant et être présentée séparément.

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

## Autres menus et modules non spécifiquement revus

**État de référence :** Pas de nouveau modèle spécifique validé. Révision : `À comparer sur la cible`.

- Risques, Résilience, documents, accès, plans annuels et administration gardent leurs fonctions et leurs écrans existants ; seuls les composants transversaux validés peuvent être harmonisés.
- Budget et CRRC retirés de la navigation de la référence ; conserver données/exports et ne jamais supprimer de tables au titre de la refonte. Le module CRRC ne doit pas être ressuscité par un exemple ancien du Dashboard.
- Une fonctionnalité absente ou retirée de la cible est signalée et traitée comme écart de périmètre ; pas de backend reconstitué ni de faux bouton opérationnel.
- Le profil sans connexion est un ancien bac à sable Docker interfaces, pas une demande de supprimer authentification/MFA/gardes de l’application courante.

**Recette de portage :** vérifier la présence/équivalence dans la cible, préserver ses contrats et droits, tester lecture/édition/erreurs/clavier/long contenu selon le lot, puis recapturer le rendu dans les deux thèmes. Ne pas traiter les captures de maquette comme une recette applicative.

Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

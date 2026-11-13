# Décisions validées et charte

La référence visuelle est `visuels/assistant-valide-hd.png`. Le résultat porté sur le frontend de refonte est `visuels/assistant-integre-hd.png`. Les pages derrière le panneau illustrent sa présence globale ; elles ne font pas partie du travail à reprendre ici.

## Présence globale

- Entrée flottante en bas à droite, badge des points à suivre, avatar original bouclier/dialogue bleu et turquoise. Pas de logo officiel Mistral ni de nouvelle marque de produit.
- Dock non modal, fermé au démarrage, réductible et agrandissable ; épinglage possible sur grand écran. La page de travail reste accessible.
- Conversation, sélection et brouillons conservés pendant la navigation ; remise à zéro au rechargement/changement de session. Aucun stockage persistant du contenu de conversation dans le navigateur.
- Discussion et boîte personnelle « Pour vous » distinctes. Une notification peut être rappelée sous le fil uniquement si celui-ci cite réellement le même objet et périmètre ; elle garde le même identifiant et état.
- Profils Mise en œuvre/Audit interne séparés ; historique et fil rattachés à leur profil réel. Nouvelle discussion sur action explicite uniquement.

## Aspect graphique et adaptation

Palettes clair/sombre de la feuille `neon-assistant.css`, surfaces lisibles, contours nets, coins biseautés, ombres/lueur modérées. Cyan/bleu pour le compagnon ; ambre pour une précision attendue ; vert pour un résultat transmis. Typographie sobre, icônes petites et actions explicites, pas de gros bandeau de recherche.

Avatar : orbite lente, clignement discret, survol léger. Pause manuelle et préférence système de mouvement réduit ; aucune animation ne représente une progression métier réelle. Le fournisseur effectif du modèle est visible, il n’est pas toujours appelé « Mistral » si la configuration serveur change.

Le dock reste dans la hauteur disponible ; fil, boîte et détails ont leur propre défilement. Les commandes et le compositeur restent accessibles. À partir de 1700 px, l’épinglage réserve la largeur dans le contenu ; sur les fenêtres PC plus étroites, superposition. Le mode agrandi ne réserve pas une seconde marge. Préserver les unités/jetons de la charte du dépôt cible et vérifier également la hauteur et la taille d’affichage 150 %. Le téléphone n’est pas prioritaire.

Échap et retour du focus concernent le panneau actif, sans fermer les dialogues de la page. Les dialogues natifs de la plateforme restent prioritaires. Ne pas ouvrir le dock ni voler le focus lorsqu’un simple rappel arrive.

## Limites métier à préserver

Le contexte joint est une référence de navigation, pas une source déjà consultée. Les sources sont des métadonnées réelles du DTO ; aucune extraction documentaire n’est prouvée par cette interface. Une réponse à une question reçue sera reprise lors d’une prochaine ronde, sans dialogue instantané promis à partir de cette réponse.

« Demander un suivi » crée une mission pour les prochaines rondes, pas un nouveau planificateur à date/heure arbitraires. Les actions et constats proposés restent sous décision humaine autorisée ; le constat est créé en brouillon. Les fonctions d’administration, mémoire, méthodes, rondes et supervision existantes sont conservées hors du travail de présentation.

La cartographie du SMSI garde son canevas, sa génération et son aspect actuel : ni réorganisation, ni remplacement, ni réservation de largeur pour le dock sur `/cartographie/*`. Les autres rubriques ne sont pas à refondre à partir de ce dossier.

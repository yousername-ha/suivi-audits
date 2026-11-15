# Prompt à transmettre à l’IA qui travaille sur GitHub

Copier le bloc ci-dessous. Le dossier est consultable sur la branche `codex/transmission-neon-opus-5-5` de `yousername-ha/suivi-audits`. Il complète le dossier général de refonte du 13/11/2026.

```text
Reprends le lot Maintenance / mise à jour de la refonte Neon.

Lis d’abord DOSSIER-REFONTE-NEON-OPUS.md sur la branche de transmission, puis
docs/transmission-opus-5.5/maintenance-neon/00-LIRE-EN-PREMIER.md
et les documents 02 à 07. Consulte les six images de visuels/ et la maquette/index.html.

Avant toute édition, lis les AGENTS.md et documents de reprise de TA branche actuelle,
constate git status, les branches et la version de l’application. Compare l’existant
avec l’audit daté et remplis annexes/MATRICE-COMPATIBILITE.csv : existant, équivalent,
partiel, absent ou obsolète, avec chemins, preuve et action. Ne réimplémente pas ce qui
existe et ne remplace jamais un fichier actuel par une copie historique du dossier.
Ne fusionne pas la branche de documentation dans ta branche applicative.

La dernière proposition de maintenance n’a pas encore reçu de validation explicite
d’intégration : prépare d’abord les captures fixes de la proposition isolée et attends
cet accord avant modification ou tests/builds applicatifs de ce lot. Si une validation
plus récente est déjà présente dans notre échange, applique-la dans son périmètre
sans la redemander. Aucune nouvelle vidéo sans validation préalable des captures.

Direction graphique : grande dalle biseautée bleu nuit, cyan dominant, léger violet
Neon, noyau vectoriel HD, réseau/paquets de fond discrets. Une animation logique pour
chaque phase réelle : transfert indéterminé, sauvegarde, cubes d’installation, scanner,
succès confirmé, restauration inverse. Ne simule ni pourcentage ni durée ni résultat.

Le journal doit afficher les vraies lignes techniques de l’opération, directement
dans la partie centrale droite, sans sous-carte, titre, compteur ou séparateur.
Texte monospace blanc semi-transparent ; message ET horaire rouges pour une erreur.
Les nouvelles lignes remontent, les anciennes s’effacent visuellement au sommet.
Ce fondu n’efface pas l’historique assaini. Pas de faux logs pour remplir un silence.

Conserve le fonctionnement autonome de /update/ pendant l’arrêt de React/API/DB,
la CSP et les assets auto-hébergés. Préserve demande/id, attente du bon job, polling,
état de connexion, lenteur, temps réels, next same-origin, maintenance, intervention,
rollback, reçus privés, autorisations et santé réelle /healthz avant tout retour.
Un simple complete n’est pas un succès ; stderr n’est pas automatiquement une erreur.
Ne porte pas les sélecteurs, fixtures, dates, versions ni clics neutralisés de la démo.

Pour les logs complets, commence par vérifier ce qui existe : le fichier worker privé
et le tampon Pino API sont distincts ; aucun flux autonome de logs d’update n’était
présent dans la branche auditée. Conçois le raccordement sans exposer Docker ni rendre
le fichier privé public. Expurge les secrets côté serveur avant stockage affichable
et transmission, y compris texte libre, URL, PEM et fragments répartis entre chunks.
Préserve les droits : les détails d’update sont réservés à l’administrateur système.
N’invente pas de route existante ; documente et teste le contrat retenu. Une panne de
journal ne doit pas empêcher le suivi public ni la mise à jour. Affiche une indisponibilité
honnête tant que le vrai flux n’est pas disponible, sans déclarer le lot terminé.

Après validation visuelle : adapte par lots ciblés depuis le code actuel, sans toucher
aux autres modules. Exécute les contrôles pertinents de la cible sur un environnement
isolé, ajoute les tests manquants réellement utiles, puis fournis les captures de
l’application intégrée. Ne réduis pas les assertions de santé ou de secrets et ne
valide pas automatiquement de nouvelles références visuelles. Respecte les règles
actuelles de branche/PR/ADR ; pas de fusion, déploiement ou release sans autorisation.

À chaque livraison, rédige un résumé précis pour une autre IA : fichiers et contrats
modifiés, comportements préservés, tests réellement exécutés, limites, captures,
état exact d’intégration et prochaine action. Conserve-le dans le dossier de reprise.
```

Le prompt autorise la préparation du portage. Le statut de validation et l’autorisation effective de modification restent ceux de la conversation courante, pas ceux déduits d’une vieille capture.

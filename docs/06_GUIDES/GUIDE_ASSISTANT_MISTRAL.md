# Connecter l'assistant RSSI à Mistral — guide pas à pas

Rédigé le 11/11/2026 (Europe/Paris) par la session « Assistant RSSI intégré plateforme » (`session_01EnWdzfTjPHLznQbaTS7Ugc`).
Décisions : [ADR 0086](../adr/0086-assistant-rssi-integre.md). Ce guide s'adresse à une personne qui n'a jamais utilisé
Mistral ni réglé l'assistant.

> **À lire avant de commencer.**
>
> - L'assistant n'est dans **aucune version publiée** à ce jour : il existe sur la branche `claude/assistant-rssi`. Ce guide
>   servira tel quel quand une version le contiendra ; d'ici là, il vaut pour un serveur de recette construit depuis cette
>   branche (annexe A).
> - Ce guide **n'a pas été rejoué de bout en bout** : le service Docker du relais n'a pas été démarré. En revanche, l'assistant
>   a été essayé le 12/11/2026 avec une clé Mistral de test, sur des données fictives : test de connexion, conversation et
>   ronde fonctionnent avec `mistral-small-latest` et `mistral-large-latest`. Les étapes côté Mistral viennent de sa
>   documentation, relue le 11/11/2026 ; ses écrans peuvent avoir changé.
> - Une fois l'assistant activé, **vos questions et les extraits qu'il lit partent chez Mistral**. Lisez l'étape 1.

Temps à prévoir : environ 30 minutes. Il vous faut : un compte de la plateforme avec le rôle Administrateur (seul un
administrateur valide l'ouverture du flux), et un moyen de paiement pour Mistral. Aucune commande n'est à taper sur le
serveur : le relais y démarre seul ([ADR 0097](../adr/0097-flux-sortants-pilotes-par-les-modules.md), lot 2).

## Vue d'ensemble

| Étape | Où | Ce que vous faites |
|---|---|---|
| 1 | Sur papier | Décider ce que l'assistant a le droit de lire |
| 2 | Site de Mistral | Créer un compte, activer la facturation, créer une clé |
| 3 | Équipe réseau | Autoriser la sortie vers Mistral (le relais démarre seul) |
| 4 | Plateforme | Activer l'assistant (ce qui ouvre son flux, après validation), régler le modèle, la clé, un profil et un périmètre |
| 5 | Plateforme | Tester, puis poser une première question |
| 6 | Plateforme | Facultatif : activer les rondes autonomes |

## Étape 1 — Décider ce que l'assistant peut lire

Pour répondre, l'assistant envoie à Mistral la question posée et ce qu'il a lu pour y répondre : intitulés d'écarts,
descriptions de risques, noms d'actions, états de couverture. Il ne lit que les **périmètres** que vous lui ouvrez, avec les
droits de la personne qui l'interroge. Les comptes, les mots de passe, les secrets et les sauvegardes ne peuvent pas partir.

Avant d'aller plus loin :

1. Sachez ce qui est ouvert par défaut : chaque profil lit **tous les périmètres et tous les documents**, dans la limite
   des droits de la personne qui l'interroge. Ce qui part chez Mistral, ce sont des informations sur votre sécurité
   (écarts, risques, extraits de politiques). Vous pouvez restreindre un profil à l'étape 4.
2. Lisez les conditions de l'API de Mistral et son accord de traitement des données (liens en fin de guide). C'est à
   votre organisation de décider ce qui peut être envoyé.
3. Inscrivez ce flux dans votre appréciation des risques.

## Étape 2 — Obtenir une clé chez Mistral

1. Ouvrez `https://console.mistral.ai` et créez un compte avec une adresse professionnelle, pas personnelle.
2. Activez la facturation : dans l'administration de Mistral (`https://admin.mistral.ai`), rubrique **Subscription**,
   achetez des crédits (le paiement à l'usage est prépayé) puis activez le paiement à l'usage (« pay-as-you-go »).
   **Un compte gratuit ne suffit pas** : d'après la documentation de Mistral relue le 12/11/2026, le mode gratuit sert à
   essayer ses interfaces et « n'inclut pas l'accès à l'API ». Des sites tiers décrivent encore une offre gratuite
   « Experiment » avec accès à l'API ; ses pages d'aide officielles ne répondent plus. Si votre compte vous laisse créer une
   clé sans payer, le test de l'étape 5 dira si elle fonctionne, mais n'y envoyez aucune donnée réelle : en mode gratuit,
   Mistral peut utiliser les questions et les réponses pour entraîner ses modèles.
3. Au même endroit, fixez un **plafond de dépense** pour l'espace de travail. C'est votre garde-fou côté Mistral.
4. Revenez dans la console, ouvrez **API Keys**, puis créez une clé (« New key » ou « Create new key » selon l'écran) :
   - nom : par exemple `suivi-audits-assistant` ;
   - date d'expiration : choisissez-en une (un an au plus) et notez-la dans votre calendrier.
5. **Copiez la clé tout de suite** et gardez-la dans votre coffre de mots de passe. Mistral ne l'affiche qu'une fois.
6. Refusez l'utilisation de vos données pour l'entraînement : dans l'administration de Mistral, menu **Privacy**, section
   « Anonymous improvement data », désactivez l'interrupteur (emplacement donné par le centre d'aide de Mistral, non essayé
   pour ce guide). La suppression de toute conservation (« Zero Data Retention ») se demande au support de Mistral, qui
   l'accorde ou non, et seulement avec le paiement à l'usage.

Ne collez jamais la clé dans un courriel, un ticket ou une conversation.

## Étape 3 — Le relais et le pare-feu

L'application n'a aucun accès à Internet. Un petit service, le **relais** (`assistant-relais`), est le seul à sortir, vers
Mistral uniquement. Par défaut, ce flux est **fermé** ([ADR 0097](../adr/0097-flux-sortants-pilotes-par-les-modules.md)) :
il s'ouvre quand un administrateur active l'assistant, à l'étape 4. **Rien n'est à faire sur le serveur** : à la validation,
l'exécutant d'exploitation du serveur démarre le relais à son passage suivant (en général moins d'une minute), et l'arrête
quand l'assistant est désactivé. Aucune ligne n'est à ajouter dans `.env` : l'application connaît l'adresse du relais. Si
l'assistant a été activé à la dernière étape de l'installation (« Flux vers l'extérieur », avec l'adresse et le modèle), le flux
est déjà ouvert : à l'étape 4, il reste à enregistrer la clé et à vérifier les profils.

1. Pare-feu : le serveur doit pouvoir joindre `api.mistral.ai` sur le port TCP 443. Si votre pare-feu filtre les sorties,
   demandez cette règle à l'équipe réseau (la carte « Flux vers l'extérieur » de Configuration système la rappelle). Aucun
   port n'est à ouvrir en entrée.
2. Après l'étape 4, vous pourrez vérifier que le relais tourne : dans **Configuration système > Flux vers l'extérieur**, la
   ligne « Assistant RSSI » doit afficher **Ouvert** dans les colonnes « Voulu » et « Appliqué ». « Ouverture en attente »
   pendant une minute est normal ; une **Erreur** est expliquée dans la colonne voisine.

## Étape 4 — Régler l'assistant dans la plateforme

1. Connectez-vous à la plateforme avec un compte Administrateur (seul un administrateur peut valider l'ouverture du flux).
2. Dans le menu, ouvrez **Plateforme**, puis la carte **Assistant RSSI**.
3. Un bandeau « Flux « Assistant RSSI » fermé » est normal tant que l'assistant n'est pas activé : il disparaît au point 6.
4. Dans **Modèle**, renseignez :

   | Champ | Valeur |
   |---|---|
   | Activer l'assistant | coché |
   | Adresse du service de modèle | `https://api.mistral.ai/v1` |
   | Nom du modèle | `mistral-small-latest` pour commencer |
   | Budget quotidien, en jetons | laissez 500 000 |

5. Dans **Profils et périmètres**, rien n'est obligatoire : les deux profils sont cochés et lisent tout par défaut. Pour
   restreindre un profil, décochez « lit tous les périmètres » et choisissez les périmètres, ou baissez la classification
   des documents. Chaque option porte son explication à l'écran.
6. Cliquez sur **Enregistrer les réglages**. La première fois, comme « Activer l'assistant » est coché, une fenêtre
   « Activer « Assistant RSSI » : ouvrir son flux » indique la destination (le fournisseur du modèle, TCP 443) et ce qui sort
   du serveur : cochez la case de validation, puis **Confirmer**. L'activation et l'ouverture du flux sont enregistrées
   ensemble et inscrites au journal d'audit. Le texte à côté du bouton doit dire « Tous les réglages ci-dessus sont
   enregistrés ». Une erreur s'affiche juste au-dessus du bouton.
7. Dans **Clé du modèle**, collez la clé de l'étape 2 puis cliquez sur **Enregistrer la clé**. La puce passe à « Clé
   enregistrée ». La clé n'est plus jamais affichée : c'est normal.

**Quel modèle choisir ?** Le modèle doit gérer l'appel d'outils. D'après la documentation de Mistral, c'est le cas de
`mistral-small-latest` (le moins cher), `mistral-medium-latest` et `mistral-large-latest` (le plus capable). Commencez par
le petit ; passez à un plus grand si les réponses sont trop pauvres. À titre d'ordre de grandeur, Mistral affichait le
11/11/2026 environ 0,15 $ par million de jetons en entrée et 0,60 $ en sortie pour son petit modèle, et 0,70 $ et 2,10 $
pour le grand ; vérifiez la grille officielle. Une question simple a consommé environ 2 700 jetons pendant nos essais sur un
faux modèle : ce n'est pas une mesure sur Mistral.

## Étape 5 — Tester et poser une première question

1. Toujours dans la carte, cliquez sur **Tester le modèle**. Aucune donnée de la plateforme n'est envoyée par ce test.
   **Résultat attendu** : « Le modèle a répondu. »
2. Fermez la carte. Une entrée **Assistant RSSI** est apparue dans le menu : ouvrez-la.
3. Vérifiez la ligne « Périmètres que ce profil peut lire pour vous » : elle doit nommer votre périmètre.
4. Cliquez sur **Nouvelle conversation**, puis posez une question simple, par exemple :
   *« Quelles actions sont en retard dans ce périmètre ? »*
5. Sous la réponse, regardez **Lectures faites** et **Éléments lus** : c'est ce que l'assistant a réellement consulté.

**Comment juger la réponse :**

- Comparez-la à l'écran des actions de la plateforme. Les chiffres doivent être les mêmes.
- Une réponse marquée « donnée sans lecture de la plateforme » n'est appuyée sur rien : ne vous y fiez pas.
- L'assistant ne modifie rien. S'il annonce avoir créé ou changé quelque chose, c'est faux.

## Étape 6 — Laisser l'assistant travailler seul (facultatif)

Une fois le dialogue validé, vous pouvez activer les **rondes** : l'assistant relève chaque jour les retards et les manques,
rappelle les responsables et vous rend un rapport. Il ne modifie toujours aucun registre.

1. Dans **Plateforme > Assistant RSSI**, pour le profil choisi, désignez un **référent** : c'est le compte dont les droits
   bornent ce que la ronde lit, et qui reçoit les rapports. Prenez le vôtre pour commencer.
2. Activez **Ronde quotidienne** pour ce profil, réglez l'heure (heure de Paris) et le nombre maximal de rappels par personne
   et par jour, puis **Enregistrer**.
3. Facultatif : rédigez une **mission**, par exemple « suivre le plan d'action du dernier audit interne ».
4. Sans attendre le lendemain, ouvrez la page **Assistant RSSI** et cliquez sur **Lancer une ronde maintenant**. Quand elle
   est « Terminée », lisez le rapport.
5. Vérifiez ce que la ronde a fait : les rappels envoyés apparaissent chez leurs destinataires dans **Pilotage > Rappels**,
   les notes dans **Mémoire de l'assistant**.

Pour qu'il devienne meilleur avec le temps, toujours dans **Plateforme > Assistant RSSI** :

- rédigez le **contexte de l'organisation** (périmètre de certification, vocabulaire, priorités de l'année) ;
- après chaque rapport, dites s'il était **utile** et pourquoi : l'assistant relit vos avis ;
- lisez les **fiches de méthode** qu'il propose, corrigez-les, puis validez ou refusez : il ne suit que les fiches validées ;
- regardez le tableau **Mesure** une fois par mois.

Ces textes partent chez Mistral comme le reste : n'y écrivez aucune donnée personnelle.

Pour tout arrêter d'un geste : interrupteur **Mettre l'assistant en pause**. Chaque personne peut couper les rappels de
l'assistant dans **Mon compte > Notifications**. Une ronde consomme plus de jetons qu'une question : surveillez la
consommation du jour les premières fois.

## En cas de problème

| Message affiché | Cause probable | Que faire |
|---|---|---|
| Le flux « Assistant RSSI » vers l'extérieur est fermé | Assistant pas encore activé par un administrateur, ou flux refermé | Refaire l'étape 4, points 4 à 6, avec un compte Administrateur |
| Le flux « Assistant RSSI » est ouvert ; l'exécutant d'exploitation du serveur l'applique… | Relais en cours de démarrage | Attendre une minute, puis réessayer |
| Le flux « Assistant RSSI » est ouvert, mais l'exécutant… n'a pas pu l'appliquer | Le relais n'a pas démarré | Lire l'erreur dans Configuration système > Flux vers l'extérieur ; transmettre à l'exploitant du serveur |
| Le relais de modèle ne répond pas | Relais arrêté ou redémarré depuis le dernier passage de l'exécutant | Attendre une minute ; sinon, voir l'étape 3, point 2 |
| Le fournisseur du modèle est injoignable depuis le relais | Pare-feu ou résolution de noms | Autoriser la sortie vers `api.mistral.ai`, TCP 443 |
| Le fournisseur du modèle refuse la clé enregistrée | Clé mal copiée, expirée, ou facturation non activée | Vérifier la facturation chez Mistral, recréer une clé, la réenregistrer |
| Le fournisseur du modèle ne connaît pas cette adresse ou ce modèle | Faute dans l'adresse ou le nom du modèle | Reprendre les valeurs du tableau de l'étape 4 |
| Le fournisseur du modèle limite les appels | Trop d'appels en peu de temps | Attendre une minute ; voir les limites de votre compte Mistral |
| Adresse HTTPS attendue… | L'adresse ne commence pas par `https://` | Corriger l'adresse |
| Le budget quotidien de l'assistant est atteint | Consommation du jour au plafond | Attendre le lendemain ou relever le budget dans les réglages |
| Aucune entrée « Assistant RSSI » dans le menu | Assistant non activé, ou compte sans le droit dédié | Cocher « Activer l'assistant » ; vérifier le rôle du compte |
| La réponse parle d'un accès refusé | Le périmètre n'est pas ouvert au profil, ou vous n'y avez pas accès vous-même | Vérifier le périmètre du profil et vos droits |

Pour voir ce que fait le relais (il n'écrit ni la clé ni le contenu) :

```text
sudo docker compose --profile assistant logs --tail 20 assistant-relais
```

Chaque question laisse une ligne `assistant.message` dans le journal d'audit de la plateforme : profil, outils appelés,
jetons consommés, sans le contenu.

## Arrêter ou revenir en arrière

- **Couper tout de suite** : décochez « Activer l'assistant » et enregistrez. Plus rien ne part.
- **Retirer la clé** : bouton « Retirer la clé » dans la carte. Supprimez-la aussi dans la console de Mistral.
- **Arrêter le relais** : décocher « Activer l'assistant » suffit : l'exécutant d'exploitation arrête et retire le relais à
  son passage suivant, et ne le redémarre pas.
- **Si la clé a pu fuiter** : supprimez-la d'abord chez Mistral, puis créez-en une nouvelle.

## Bonnes pratiques

- Une clé réservée à la plateforme, jamais réutilisée ailleurs, avec une date d'expiration.
- Un plafond de dépense chez Mistral **et** un budget quotidien dans la plateforme.
- Ouvrez les périmètres un par un.
- Le droit d'utiliser l'assistant n'est donné qu'aux rôles Administrateur et RSSI ; pour une autre personne, créez un rôle
  personnalisé avec le droit « Assistant RSSI : Lire ».

## Annexe A — Serveur de recette depuis la branche

Sur un poste Windows avec Docker Desktop, suivez plutôt le
[guide de recette pour Windows](GUIDE_RECETTE_DOCKER_WINDOWS.md).

Tant qu'aucune version publiée ne contient l'assistant, les images officielles ne le contiennent pas non plus. Sur un serveur
de **recette** (jamais la production), il faut récupérer la branche et construire les images sur place, comme le décrit
[CONTRIBUTING](../../CONTRIBUTING.md) (« Tests de bout en bout ») :

```text
cd /opt/suivi-audits
sudo git fetch origin claude/assistant-rssi
sudo git checkout claude/assistant-rssi
sudo docker compose -f docker-compose.yml -f docker-compose.build.yml build
sudo docker compose up -d
```

Le relais n'est pas démarré par cette commande : l'exécutant d'exploitation le démarre quand l'assistant est activé (étape 4).

Cette suite de commandes n'a pas été exécutée pendant le développement : faites une sauvegarde avant, et relevez le
premier message d'erreur si elle échoue.

## Sources côté Mistral

Relues le 11/11/2026 :

- [Activer la facturation et créer une clé](https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key)
- [Espaces de travail et plafonds](https://docs.mistral.ai/getting-started/quickstarts/admin/manage-workspaces)
- [Appel d'outils et modèles compatibles](https://docs.mistral.ai/capabilities/function_calling/)
- [Référence de l'API](https://docs.mistral.ai/api/)
- [Tarifs de l'API](https://docs.mistral.ai/inference/pricing)
- [Centre d'aide : gouvernance des données](https://help.mistral.ai/en/collections/789667-data-governance) (durée de
  conservation et lieu de traitement non trouvés)

Relues le 12/11/2026 :

- [Abonnements et paiement à l'usage](https://docs.mistral.ai/admin/billing-usage/subscriptions)
- [Limites d'usage (le mode gratuit n'inclut pas l'API)](https://docs.mistral.ai/admin/billing-usage/usage-limits)
- [Refuser l'entraînement sur ses données](https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training)
- [Utilisation des données pour l'entraînement](https://help.mistral.ai/en/articles/347617-do-you-use-my-user-data-to-train-your-artificial-intelligence-models)
- [Zero Data Retention](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr)

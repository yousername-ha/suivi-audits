# Connecter l'assistant RSSI à Mistral — guide pas à pas

Rédigé le 11/11/2026 (Europe/Paris) par la session « Assistant RSSI intégré plateforme » (`session_01EnWdzfTjPHLznQbaTS7Ugc`).
Décisions : [ADR 0086](../adr/0086-assistant-rssi-integre.md). Ce guide s'adresse à une personne qui n'a jamais utilisé
Mistral ni réglé l'assistant.

> **À lire avant de commencer.**
>
> - L'assistant n'est dans **aucune version publiée** à ce jour : il existe sur la branche `claude/assistant-rssi`. Ce guide
>   servira tel quel quand une version le contiendra ; d'ici là, il vaut pour un serveur de recette construit depuis cette
>   branche (annexe A).
> - Ce guide **n'a pas été rejoué de bout en bout** : aucun appel réel à Mistral n'a été fait pendant le développement, et le
>   service Docker n'a pas été démarré. Les étapes côté Mistral viennent de sa documentation, relue le 11/11/2026 ; ses écrans
>   peuvent avoir changé.
> - Une fois l'assistant activé, **vos questions et les extraits qu'il lit partent chez Mistral**. Lisez l'étape 1.

Temps à prévoir : environ 30 minutes. Il vous faut : un accès au serveur en ligne de commande, un compte de la plateforme
avec le rôle Administrateur ou RSSI, et un moyen de paiement pour Mistral.

## Vue d'ensemble

| Étape | Où | Ce que vous faites |
|---|---|---|
| 1 | Sur papier | Décider ce que l'assistant a le droit de lire |
| 2 | Site de Mistral | Créer un compte, activer la facturation, créer une clé |
| 3 | Serveur | Démarrer le relais et le déclarer |
| 4 | Plateforme | Régler le modèle, la clé, un profil et un périmètre |
| 5 | Plateforme | Tester, puis poser une première question |

## Étape 1 — Décider ce que l'assistant peut lire

Pour répondre, l'assistant envoie à Mistral la question posée et ce qu'il a lu pour y répondre : intitulés d'écarts,
descriptions de risques, noms d'actions, états de couverture. Il ne lit que les **périmètres** que vous lui ouvrez, avec les
droits de la personne qui l'interroge. Les comptes, les mots de passe, les secrets et les sauvegardes ne peuvent pas partir.

Avant d'aller plus loin :

1. Choisissez **un seul périmètre** pour le premier essai, qui **ne contient aucune donnée de santé** ni de patient.
2. Lisez les conditions de l'API de Mistral et son accord de traitement des données (liens en fin de guide). Aucune
   certification HDS de Mistral n'a été trouvée : c'est à votre organisation, avec son DPO, de décider ce qui peut être envoyé.
3. Inscrivez ce flux dans votre appréciation des risques.

## Étape 2 — Obtenir une clé chez Mistral

1. Ouvrez `https://console.mistral.ai` et créez un compte avec une adresse professionnelle, pas personnelle.
2. Activez la facturation : dans l'administration de Mistral (`https://admin.mistral.ai`), rubrique des abonnements et de la
   facturation, ajoutez un moyen de paiement. **Une clé reste inactive tant qu'aucun moyen de paiement n'est enregistré.**
3. Au même endroit, fixez un **plafond de dépense** pour l'espace de travail. C'est votre garde-fou côté Mistral.
4. Revenez dans la console, ouvrez **API Keys**, puis créez une clé (« New key » ou « Create new key » selon l'écran) :
   - nom : par exemple `suivi-audits-assistant` ;
   - date d'expiration : choisissez-en une (un an au plus) et notez-la dans votre calendrier.
5. **Copiez la clé tout de suite** et gardez-la dans votre coffre de mots de passe. Mistral ne l'affiche qu'une fois.
6. Cherchez dans votre compte Mistral le réglage sur l'utilisation de vos données pour l'entraînement des modèles et
   désactivez-le s'il est proposé. Son emplacement exact n'a pas pu être vérifié pour ce guide.

Ne collez jamais la clé dans un courriel, un ticket ou une conversation.

## Étape 3 — Démarrer le relais sur le serveur

L'application n'a aucun accès à Internet. Un petit service, le **relais**, est le seul à sortir, vers Mistral uniquement.

1. Connectez-vous au serveur et placez-vous dans le dossier de l'application :

   ```text
   cd /opt/suivi-audits
   ```

2. Ouvrez le fichier `.env` (par exemple avec `sudo nano .env`) et ajoutez cette ligne, sans `#` devant :

   ```text
   ASSISTANT_RELAIS_URL=http://assistant-relais:8787
   ```

   Enregistrez et fermez (`Ctrl+O`, `Entrée`, `Ctrl+X` dans nano).

3. Démarrez le relais et recréez l'application pour qu'elle le connaisse :

   ```text
   sudo docker compose --profile assistant up -d
   ```

4. Vérifiez qu'il tourne :

   ```text
   sudo docker compose --profile assistant ps assistant-relais
   ```

   **Résultat attendu** : une ligne `assistant-relais` avec l'état `running` puis `healthy`.

5. Pare-feu : le serveur doit pouvoir joindre `api.mistral.ai` sur le port TCP 443. Si votre pare-feu filtre les sorties,
   ajoutez cette règle. Aucun port n'est à ouvrir en entrée.

> Par la suite, gardez `--profile assistant` dans vos commandes `docker compose up`, sinon le relais n'est pas redémarré.

## Étape 4 — Régler l'assistant dans la plateforme

1. Connectez-vous à la plateforme avec un compte Administrateur ou RSSI.
2. Dans le menu, ouvrez **Plateforme**, puis la carte **Assistant RSSI**.
3. Si un bandeau rouge « Relais de modèle absent » apparaît, revenez à l'étape 3.
4. Dans **Modèle**, renseignez :

   | Champ | Valeur |
   |---|---|
   | Activer l'assistant | coché |
   | Adresse du service de modèle | `https://api.mistral.ai/v1` |
   | Nom du modèle | `mistral-small-latest` pour commencer |
   | Budget quotidien, en jetons | laissez 500 000 |

5. Dans **Profils et périmètres**, cochez **Profil « Mise en œuvre »** et choisissez le périmètre retenu à l'étape 1. Laissez
   le profil « Audit interne » décoché pour l'instant.
6. Cliquez sur **Enregistrer**.
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

## En cas de problème

| Message affiché | Cause probable | Que faire |
|---|---|---|
| Le relais de modèle n'est pas installé sur le serveur | `ASSISTANT_RELAIS_URL` absent de `.env`, ou `app` non recréée | Refaire l'étape 3, points 2 et 3 |
| Le relais de modèle ne répond pas | Le service `assistant-relais` est arrêté | `sudo docker compose --profile assistant up -d`, puis l'étape 3, point 4 |
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
- **Arrêter le relais** : `sudo docker compose --profile assistant stop assistant-relais`.
- **Si la clé a pu fuiter** : supprimez-la d'abord chez Mistral, puis créez-en une nouvelle.

## Bonnes pratiques

- Une clé réservée à la plateforme, jamais réutilisée ailleurs, avec une date d'expiration.
- Un plafond de dépense chez Mistral **et** un budget quotidien dans la plateforme.
- Ouvrez les périmètres un par un, et aucun qui puisse contenir des données de santé.
- Le droit d'utiliser l'assistant n'est donné qu'aux rôles Administrateur et RSSI ; pour une autre personne, créez un rôle
  personnalisé avec le droit « Assistant RSSI : Lire ».

## Annexe A — Serveur de recette depuis la branche

Tant qu'aucune version publiée ne contient l'assistant, les images officielles ne le contiennent pas non plus. Sur un serveur
de **recette** (jamais la production), il faut récupérer la branche et construire les images sur place, comme le décrit
[CONTRIBUTING](../../CONTRIBUTING.md) (« Tests de bout en bout ») :

```text
cd /opt/suivi-audits
sudo git fetch origin claude/assistant-rssi
sudo git checkout claude/assistant-rssi
sudo docker compose -f docker-compose.yml -f docker-compose.build.yml build
sudo docker compose --profile assistant up -d
```

Cette suite de commandes n'a pas été exécutée pendant le développement : faites une sauvegarde avant, et relevez le
premier message d'erreur si elle échoue.

## Sources côté Mistral (relues le 11/11/2026)

- [Activer la facturation et créer une clé](https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key)
- [Espaces de travail et plafonds](https://docs.mistral.ai/getting-started/quickstarts/admin/manage-workspaces)
- [Appel d'outils et modèles compatibles](https://docs.mistral.ai/capabilities/function_calling/)
- [Référence de l'API](https://docs.mistral.ai/api/)
- [Tarifs de l'API](https://docs.mistral.ai/inference/pricing)
- [Centre d'aide : gouvernance des données](https://help.mistral.ai/en/collections/789667-data-governance) (non lu pour ce guide :
  conservation, lieu de traitement, entraînement)

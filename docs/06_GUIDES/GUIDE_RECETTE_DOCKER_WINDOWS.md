# Essayer la branche de l'assistant sur un poste Windows (Docker Desktop)

Ce guide sert à **essayer une branche non publiée**, ici `claude/assistant-rssi`, sur votre poste Windows, avant toute
demande de fusion. Il construit les images sur place et démarre la même pile qu'un serveur, avec le relais de l'assistant.

> **À savoir avant de commencer**
>
> - Ce guide **n'a pas été rejoué sur Windows** : l'environnement de développement n'a ni Windows ni Docker. Les commandes de
>   l'étape 3 sont celles que l'intégration continue exécute sur Linux (`installer.sh --construire`) ; leur comportement sous
>   WSL 2 reste à constater. Relevez le premier message d'erreur si une étape échoue.
> - C'est une **recette jetable**, avec des **données fictives** uniquement. N'y importez aucune donnée réelle.
> - Tout se fait **dans WSL 2** (le Linux intégré à Windows), pas dans PowerShell : les scripts du dépôt sont des scripts
>   Linux.

## Ce qu'il faut

- Windows 10 ou 11, 16 Go de mémoire conseillés, 15 Go de disque libres.
- Docker Desktop, avec le moteur **WSL 2**.
- Une distribution Ubuntu dans WSL.
- 30 à 45 minutes, dont 10 à 20 de construction des images.
- Pour l'assistant : une clé Mistral (voir le [guide Mistral](GUIDE_ASSISTANT_MISTRAL.md), étape 2).

## Étape 1 — Préparer Windows

1. Ouvrez **PowerShell en administrateur** et installez WSL avec Ubuntu, si ce n'est pas déjà fait :

   ```text
   wsl --install -d Ubuntu
   ```

   Redémarrez si Windows le demande, puis choisissez un nom d'utilisateur et un mot de passe Ubuntu.

2. Installez **Docker Desktop**. Dans ses réglages :
   - _General_ : « Use the WSL 2 based engine » coché ;
   - _Resources > WSL integration_ : activez l'intégration pour **Ubuntu**.
3. Vérifiez depuis le terminal **Ubuntu** (menu Démarrer > Ubuntu) :

   ```text
   docker version
   docker compose version
   ```

   Les deux commandes doivent répondre sans erreur. Si `docker` est introuvable, l'intégration WSL de l'étape 2 n'est pas
   active.

## Étape 2 — Récupérer la branche, dans Ubuntu

Travaillez dans le dossier personnel d'Ubuntu (`~`), **pas** sous `/mnt/c/` : les fichiers Windows y sont lents et leurs fins
de ligne cassent les scripts.

```text
sudo apt-get update && sudo apt-get install -y git
cd ~
git clone --branch claude/assistant-rssi https://github.com/yousername-ha/suivi-audits.git
cd suivi-audits
```

## Étape 3 — Construire et démarrer

Les ports 80 et 443 de votre poste doivent être libres (fermez IIS, un autre serveur web ou une autre pile Docker).

```text
sudo ./installer.sh --construire --site localhost
```

La commande crée `.env`, prépare le dossier des données (`/srv/suivi-audits/donnees`, dans Ubuntu), construit les images,
démarre l'application, puis affiche un **jeton d'installation**. Comptez 10 à 20 minutes la première fois.

Si la commande s'arrête sur la vérification de l'heure ou des ports, lisez son message : elle dit quoi corriger.

## Étape 4 — Créer le compte administrateur

1. Dans le navigateur de Windows, ouvrez `https://localhost/setup`.
2. Le navigateur affiche un avertissement de certificat : c'est attendu, le certificat est émis par l'autorité interne de la
   pile. Acceptez-le pour cet essai.
3. Suivez l'assistant d'installation avec le jeton affiché à l'étape 3 (détail :
   [guide d'installation](../INSTALLATION.md), étape 8). Le jeton est perdu ? `sudo docker compose exec app setup-token` en
   donne un nouveau.

Pour des données fictives prêtes à l'emploi :

```text
sudo docker compose exec app suivi jeu-de-test <compte administrateur> --confirmer
```

## Étape 5 — Démarrer le relais de l'assistant

1. Ajoutez la ligne du relais à `.env` :

   ```text
   echo 'ASSISTANT_RELAIS_URL=http://assistant-relais:8787' | sudo tee -a .env
   ```

2. Démarrez le relais et recréez l'application :

   ```text
   sudo docker compose --profile assistant up -d
   ```

3. Vérifiez :

   ```text
   sudo docker compose ps assistant-relais
   ```

   L'état attendu est `running (healthy)`.

Le relais doit pouvoir joindre `api.mistral.ai` en HTTPS. Derrière un mandataire d'entreprise qui inspecte le trafic, il
échouera : essayez alors depuis un réseau sans mandataire.

## Étape 6 — Régler et essayer l'assistant

Suivez le [guide Mistral](GUIDE_ASSISTANT_MISTRAL.md) à partir de l'**étape 4** (réglages dans la plateforme), puis l'étape 5
(test et première question) et l'étape 6 (rondes). Points à contrôler pendant l'essai :

| À vérifier | Où |
| --- | --- |
| « Tester le modèle » répond « Le modèle a répondu. » | Plateforme > Assistant RSSI |
| Une question en conversation cite des éléments réels du périmètre | Assistant RSSI |
| « Lancer une ronde maintenant » se termine, avec un rapport et un bloc « Constaté par la plateforme » | Assistant RSSI |
| Un rappel ou une question arrive chez le responsable d'une action en retard | Pilotage > Rappels |
| La réponse à une question est reprise à la ronde suivante | Assistant RSSI > Questions |
| La pause arrête les rondes | Plateforme > Assistant RSSI |

Journal du relais, sans clé ni contenu (hôte joint, code de réponse, durée) :

```text
sudo docker compose logs assistant-relais --tail 20
```

## Reprendre une version plus récente de la branche

```text
cd ~/suivi-audits
git pull
sudo ./installer.sh --construire
sudo docker compose --profile assistant up -d
```

Les migrations s'appliquent au démarrage. Sur une recette jetable, en cas de doute, repartez de zéro (ci-dessous).

## Tout arrêter et tout effacer

```text
cd ~/suivi-audits
sudo docker compose --profile assistant down
sudo rm -rf /srv/suivi-audits/donnees
rm .env
```

La dernière suppression efface **toutes** les données de la recette. Pensez à retirer ou à révoquer la clé de test chez
Mistral si vous ne vous en servez plus.

## En cas de problème

| Symptôme | Piste |
| --- | --- |
| `docker: command not found` dans Ubuntu | Activer l'intégration WSL d'Ubuntu dans Docker Desktop (étape 1) |
| `bad interpreter` ou `$'\r'` au lancement d'un script | Le dépôt a été cloné côté Windows : le recloner dans `~`, depuis Ubuntu |
| « le port 443 est déjà utilisé » | Arrêter le service Windows ou la pile Docker qui l'occupe |
| Double authentification refusée | Heure de Windows déréglée : la resynchroniser, puis `wsl --shutdown` et relancer Ubuntu |
| Construction interrompue faute de mémoire | Augmenter la mémoire de WSL (fichier `.wslconfig`), ou fermer d'autres applications |
| « Le relais de modèle ne répond pas » | `sudo docker compose ps assistant-relais`, puis ses journaux |
| « Le fournisseur du modèle est injoignable depuis le relais » | Mandataire ou pare-feu du poste : essayer un autre réseau |

# Essayer la branche de l'assistant sur un poste Windows : les commandes

Recette **jetable**, données **fictives** uniquement. La double authentification y est désactivée : ne jamais faire cela sur
un serveur réel. Ces commandes n'ont pas été rejouées sur Windows ; la création du compte, elle, est couverte par les tests.

Une seule fois, dans PowerShell **en administrateur** (puis redémarrer si Windows le demande), et activer Ubuntu dans Docker
Desktop (Settings > Resources > WSL integration) :

```text
wsl --install -d Ubuntu
```

Installer et démarrer, dans PowerShell :

```text
wsl -d Ubuntu -- bash -lc "sudo apt-get update && sudo apt-get install -y git && cd ~ && git clone --branch claude/assistant-rssi https://github.com/yousername-ha/suivi-audits.git"
wsl -d Ubuntu -- bash -lc "cd ~/suivi-audits && sudo ./scripts/dev/recette-locale.sh"
```

La seconde commande prend 10 à 20 minutes, puis affiche l'**identifiant** et le **mot de passe** du compte administrateur.
Ouvrir `https://localhost`, accepter l'avertissement de certificat, se connecter. Il n'y a ni assistant d'installation, ni
jeton, ni double authentification. Le relais de l'assistant est déjà démarré : il reste à saisir la clé du modèle dans
Plateforme > Assistant RSSI ([guide Mistral](GUIDE_ASSISTANT_MISTRAL.md), étape 4).

Reprendre une version plus récente de la branche :

```text
wsl -d Ubuntu -- bash -lc "cd ~/suivi-audits && git pull && sudo ./scripts/dev/recette-locale.sh"
```

Mot de passe perdu :

```text
wsl -d Ubuntu -- bash -lc "cd ~/suivi-audits && sudo docker compose exec app suivi reset-password recette"
```

Tout arrêter et tout effacer (efface **toutes** les données de la recette) :

```text
wsl -d Ubuntu -- bash -lc "cd ~/suivi-audits && sudo docker compose --profile assistant down && sudo rm -rf /srv/suivi-audits/donnees && rm .env"
```

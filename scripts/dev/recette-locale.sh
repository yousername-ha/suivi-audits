#!/usr/bin/env bash
# Recette locale d'une branche sur un poste de test (Linux ou WSL 2), en une commande :
#   sudo ./scripts/dev/recette-locale.sh
# Construit les images depuis le dépôt, démarre la pile sur https://localhost avec le relais de l'assistant, crée le compte
# administrateur sans assistant d'installation et affiche son identifiant et son mot de passe. La double authentification
# est désactivée (MFA_REQUIRED=false) : NE JAMAIS utiliser ce script sur un serveur réel ni avec des données réelles.
# Relancer la commande reconstruit et redémarre ; le compte déjà créé est conservé.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ "$(id -u)" = 0 ] || { echo "À lancer avec sudo." >&2; exit 1; }

if [ ! -f .env ]; then
  ( umask 077 && cp .env.example .env )
  sed -i 's/^SITE_ADDRESS=.*/SITE_ADDRESS=localhost/; s/^APP_VERSION=.*/APP_VERSION=test/; s/^MFA_REQUIRED=.*/MFA_REQUIRED=false/' .env
  grep -q '^MFA_REQUIRED=' .env || echo 'MFA_REQUIRED=false' >> .env
  echo 'ASSISTANT_RELAIS_URL=http://assistant-relais:8787' >> .env
fi
grep -q '^SITE_ADDRESS=localhost$' .env || { echo "Ce script ne sert que pour localhost : .env désigne un autre site." >&2; exit 1; }

./installer.sh --construire --site localhost > /dev/null
docker compose --profile assistant up -d

echo
if docker compose exec -T app suivi recette-locale; then
  echo "Ouvrez https://localhost (acceptez l'avertissement de certificat) et connectez-vous avec ce compte."
  echo "Notez le mot de passe : il n'est affiché qu'une fois."
else
  echo "Compte déjà créé lors d'un lancement précédent : ouvrez https://localhost et connectez-vous avec lui."
  echo "Mot de passe perdu : sudo docker compose exec app suivi reset-password recette"
fi

#!/usr/bin/env bash
# CI : rejoue docs/INSTALLATION.md sur une machine virtuelle Rocky Linux 10 vierge (ADR 0085), sous QEMU/KVM sur un runner
# Ubuntu. Les commandes du guide (dnf, firewalld, Docker CE, SELinux en mode enforcing) s'exécutent dans la machine
# virtuelle ; seuls l'extraction du guide et le démarrage de la machine se font sur le runner.
# Image : Rocky-10-GenericCloud-Base, vérifiée par une empreinte SHA-256 figée ici (comme scripts/ci/installer-outils.sh).
# Mettre à jour l'image : changer la version ET l'empreinte, relevée dans le fichier *.CHECKSUM du miroir officiel.
# Variables : GUIDE_ROCKY_TRAVAIL (dossier de travail, défaut $RUNNER_TEMP/rocky), GUIDE_ROCKY_CONSERVER=1 (ne pas arrêter la machine).
set -euo pipefail

IMAGE_VERSION=10.2-20260525.0
IMAGE_SHA256=9fc9e9ff16888bb68ac39b0392e25c9c92684d50c85f1cce6ab549363bbc4b48
IMAGE_URL="https://dl.rockylinux.org/pub/rocky/10/images/x86_64/Rocky-10-GenericCloud-Base-$IMAGE_VERSION.x86_64.qcow2"
DEPOT="$(cd "$(dirname "$0")/../.." && pwd)"
TRAVAIL="${GUIDE_ROCKY_TRAVAIL:-${RUNNER_TEMP:-$(mktemp -d)}/rocky}"
PORT_SSH=2222
mkdir -p "$TRAVAIL/seed"
cd "$TRAVAIL"

arret() { echo "::error::$*" >&2; exit 1; }
cleanup() {
  local code=$?
  if [ "${GUIDE_ROCKY_CONSERVER:-}" != 1 ]; then
    [ ! -f qemu.pid ] || kill "$(cat qemu.pid)" 2> /dev/null || true
    [ ! -f seed.pid ] || kill "$(cat seed.pid)" 2> /dev/null || true
  fi
  if [ "$code" != 0 ] && [ -f serial.log ]; then echo "::group::Console série de la machine virtuelle (fin)"; tail -n 80 serial.log; echo "::endgroup::"; fi
  exit "$code"
}
trap cleanup EXIT

# --- KVM et QEMU sur le runner
if [ ! -w /dev/kvm ]; then
  echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules > /dev/null
  sudo udevadm control --reload-rules && sudo udevadm trigger --name-match=kvm
fi
[ -w /dev/kvm ] || arret "KVM indisponible sur ce runner : impossible de démarrer la machine virtuelle Rocky Linux."
command -v qemu-system-x86_64 > /dev/null || { sudo apt-get update -qq && sudo apt-get install -y -qq qemu-system-x86 qemu-utils > /dev/null; }

# --- Image officielle, empreinte vérifiée
curl -fsSL --retry 3 --proto '=https' --tlsv1.2 -o image.qcow2 "$IMAGE_URL"
echo "$IMAGE_SHA256  image.qcow2" | sha256sum -c --quiet - || arret "Empreinte de l'image Rocky Linux incorrecte : refus."
qemu-img create -q -f qcow2 -b image.qcow2 -F qcow2 disque.qcow2 40G

# --- Configuration cloud-init servie par HTTP (source « nocloud-net » : aucun outil de création d'ISO nécessaire)
ssh-keygen -q -t ed25519 -N '' -f cle
cat > seed/meta-data <<META
instance-id: guide-rocky
local-hostname: suivi-rocky
META
cat > seed/user-data <<USER
#cloud-config
ssh_pwauth: false
users:
  - name: rocky
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh_authorized_keys:
      - $(cat cle.pub)
USER
(cd seed && python3 -m http.server 8000 --bind 0.0.0.0 > ../seed.log 2>&1 & echo $! > ../seed.pid)

qemu-system-x86_64 -machine accel=kvm -cpu host -smp 4 -m 10240 \
  -drive file=disque.qcow2,if=virtio,format=qcow2 \
  -netdev "user,id=n0,hostfwd=tcp:127.0.0.1:$PORT_SSH-:22" -device virtio-net-pci,netdev=n0 \
  -smbios 'type=1,serial=ds=nocloud-net;s=http://10.0.2.2:8000/' \
  -display none -serial file:serial.log -daemonize -pidfile qemu.pid

SSH=(ssh -i cle -p "$PORT_SSH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=5 -o ServerAliveInterval=30 rocky@127.0.0.1)
echo "Attente de la machine virtuelle (SSH)…"
for _ in $(seq 1 90); do "${SSH[@]}" true 2> /dev/null && break; sleep 5; done
"${SSH[@]}" true || arret "La machine virtuelle ne répond pas en SSH après 7 min 30 s."
"${SSH[@]}" 'sudo cloud-init status --wait > /dev/null; cat /etc/os-release | grep -E "^(NAME|VERSION_ID)="; getenforce'
[ "$("${SSH[@]}" getenforce)" = Enforcing ] || arret "SELinux n'est pas en mode enforcing sur l'image : le guide doit être rejoué dans l'état par défaut de Rocky Linux."

# --- Dépôt, Node (copié du runner : binaire autonome) et guide extrait pour Rocky
tar -C "$DEPOT" --exclude=node_modules --exclude='.pnpm-store' -czf - . | "${SSH[@]}" 'mkdir -p ~/work ~/bin ~/tmp && tar -xzf - -C ~/work'
scp -q -i cle -P "$PORT_SSH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR "$(command -v node)" rocky@127.0.0.1:bin/node
node "$DEPOT/scripts/ci/guide-extraire.mjs" --os=rocky "$DEPOT/docs/INSTALLATION.md" nom_dns=localhost version=ci > guide.sh
"${SSH[@]}" 'cat > ~/guide.sh' < guide.sh

ENV_VM='export GITHUB_WORKSPACE=$HOME/work GITHUB_ACTIONS=true RUNNER_TEMP=$HOME/tmp PATH=$HOME/bin:$PATH'
echo "::group::Rejeu du guide sur Rocky Linux 10"
"${SSH[@]}" "$ENV_VM; bash ~/guide.sh"
echo "::endgroup::"
echo "::group::Lot A — pilotage réel, restauration et retours arrière, TLS"
"${SSH[@]}" "$ENV_VM; cd /opt/suivi-audits && NODE_EXTRA_CA_CERTS=/opt/suivi-audits/racine-suivi-audits.crt node \$GITHUB_WORKSPACE/scripts/ci/guide-api.mjs lot-a https://localhost"
echo "::endgroup::"
[ "$("${SSH[@]}" getenforce)" = Enforcing ] || arret "SELinux a été modifié pendant le rejeu : refus."
echo "Guide rejoué sur Rocky Linux 10 (SELinux enforcing) : toutes les étapes ont réussi."

#!/usr/bin/env bash
# CI : rejoue docs/INSTALLATION.md sur une machine virtuelle vierge Rocky Linux 10 ou Debian 12 (ADR 0085), sous QEMU/KVM
# sur un runner Ubuntu. Les commandes du guide (dnf, firewalld, SELinux enforcing pour Rocky ; apt, ufw pour Debian) et
# Docker CE s'exécutent dans la machine virtuelle ; seuls l'extraction du guide et le démarrage de la machine se font sur le runner.
#   scripts/ci/guide-vm.sh rocky10|debian12
# Images officielles « cloud générique », vérifiées par une empreinte figée ici (comme scripts/ci/installer-outils.sh).
# Mettre à jour une image : changer l'adresse ET l'empreinte, relevées dans le fichier de sommes de contrôle du miroir officiel.
# Variables : GUIDE_VM_TRAVAIL (dossier de travail, défaut $RUNNER_TEMP/vm), GUIDE_VM_CONSERVER=1 (ne pas arrêter la machine).
set -euo pipefail

SYSTEME="${1:-}"
case "$SYSTEME" in
  rocky10)
    IMAGE_URL="https://dl.rockylinux.org/pub/rocky/10/images/x86_64/Rocky-10-GenericCloud-Base-10.2-20260525.0.x86_64.qcow2"
    IMAGE_ALGO=sha256
    IMAGE_SOMME=9fc9e9ff16888bb68ac39b0392e25c9c92684d50c85f1cce6ab549363bbc4b48
    UTILISATEUR=rocky
    OS_GUIDE=rocky
    ;;
  debian12)
    IMAGE_URL="https://cloud.debian.org/images/cloud/bookworm/20261026-2643/debian-12-genericcloud-amd64-20261026-2643.qcow2"
    IMAGE_ALGO=sha512
    IMAGE_SOMME=0464b5d4ae3aa4f658468d88da83af7857b71548b30d46dcb6282770955a747fb95a983476db90d25afd0653af607224c7ebd05122ab71faa106fd712aaad652
    UTILISATEUR=debian
    OS_GUIDE=debian
    ;;
  *)
    echo "Usage : $0 rocky10|debian12" >&2
    exit 2
    ;;
esac

DEPOT="$(cd "$(dirname "$0")/../.." && pwd)"
TRAVAIL="${GUIDE_VM_TRAVAIL:-${RUNNER_TEMP:-$(mktemp -d)}/vm-$SYSTEME}"
PORT_SSH=2222
mkdir -p "$TRAVAIL/seed"
cd "$TRAVAIL"

arret() { echo "::error::$*" >&2; exit 1; }
cleanup() {
  local code=$?
  if [ "${GUIDE_VM_CONSERVER:-}" != 1 ]; then
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
  # La règle est appliquée de façon asynchrone : attendre que les droits soient posés.
  for _ in $(seq 1 30); do [ -w /dev/kvm ] && break; sleep 1; done
fi
if [ ! -w /dev/kvm ]; then
  echo "::group::Diagnostic KVM"
  ls -l /dev/kvm 2>&1 || true
  echo "processeurs avec virtualisation matérielle (vmx|svm) : $(grep -cE '(vmx|svm)' /proc/cpuinfo || true)"
  lscpu | grep -iE 'model name|virtualization|hypervisor' || true
  nproc; free -m | head -2
  echo "::endgroup::"
  arret "KVM indisponible sur ce runner : impossible de démarrer la machine virtuelle ($SYSTEME)."
fi
command -v qemu-system-x86_64 > /dev/null || { sudo apt-get update -qq && sudo apt-get install -y -qq qemu-system-x86 qemu-utils > /dev/null; }

# --- Image officielle, empreinte vérifiée
curl -fsSL --retry 3 --proto '=https' --tlsv1.2 -o image.qcow2 "$IMAGE_URL"
echo "$IMAGE_SOMME  image.qcow2" | "${IMAGE_ALGO}sum" -c --quiet - || arret "Empreinte de l'image $SYSTEME incorrecte : refus."
qemu-img create -q -f qcow2 -b image.qcow2 -F qcow2 disque.qcow2 40G

# --- Configuration cloud-init servie par HTTP (source « nocloud-net » : aucun outil de création d'ISO nécessaire)
ssh-keygen -q -t ed25519 -N '' -f cle
cat > seed/meta-data <<META
instance-id: guide-$SYSTEME
local-hostname: suivi-$SYSTEME
META
cat > seed/user-data <<USER
#cloud-config
ssh_pwauth: false
users:
  - name: $UTILISATEUR
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

SSH=(ssh -i cle -p "$PORT_SSH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=5 -o ServerAliveInterval=30 "$UTILISATEUR@127.0.0.1")
echo "Attente de la machine virtuelle (SSH)…"
for _ in $(seq 1 90); do "${SSH[@]}" true 2> /dev/null && break; sleep 5; done
"${SSH[@]}" true || arret "La machine virtuelle ne répond pas en SSH après 7 min 30 s."
"${SSH[@]}" 'sudo cloud-init status --wait > /dev/null; grep -E "^(NAME|VERSION_ID)=" /etc/os-release'
if [ "$SYSTEME" = rocky10 ]; then
  [ "$("${SSH[@]}" getenforce)" = Enforcing ] || arret "SELinux n'est pas en mode enforcing sur l'image : le guide doit être rejoué dans l'état par défaut de Rocky Linux."
fi

# --- Dépôt, Node (copié du runner : binaire autonome) et guide extrait pour Rocky
tar -C "$DEPOT" --exclude=node_modules --exclude='.pnpm-store' -czf - . | "${SSH[@]}" 'mkdir -p ~/work ~/bin ~/tmp && tar -xzf - -C ~/work'
scp -q -i cle -P "$PORT_SSH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR "$(command -v node)" "$UTILISATEUR@127.0.0.1:bin/node"
node "$DEPOT/scripts/ci/guide-extraire.mjs" --os="$OS_GUIDE" "$DEPOT/docs/INSTALLATION.md" nom_dns=localhost version=ci > guide.sh
"${SSH[@]}" 'cat > ~/guide.sh' < guide.sh

ENV_VM='export GITHUB_WORKSPACE=$HOME/work GITHUB_ACTIONS=true RUNNER_TEMP=$HOME/tmp PATH=$HOME/bin:$PATH'
# En cas d'échec, l'état de la machine (Docker, noyau, SELinux, pare-feu) explique l'erreur mieux que la console série.
diagnostic_vm() {
  echo "::group::Diagnostic de la machine virtuelle ($SYSTEME)"
  "${SSH[@]}" 'uname -r; rpm -q kernel-core 2> /dev/null || true; (getenforce 2> /dev/null || true); sudo systemctl status docker --no-pager -l 2>&1 | tail -25; echo "--- journal docker"; sudo journalctl -u docker --no-pager 2>&1 | tail -40; echo "--- journal noyau (nftables, iptables, overlay)"; sudo dmesg 2>&1 | grep -iE "nf_tables|iptables|overlay|bridge|audit.*denied" | tail -15; (sudo ausearch -m avc -ts recent 2>&1 | tail -15 || true)' || true
  echo "::endgroup::"
}
echo "::group::Rejeu du guide sur $SYSTEME"
"${SSH[@]}" "$ENV_VM; bash ~/guide.sh" || { echo "::endgroup::"; diagnostic_vm; arret "Le rejeu du guide a échoué sur $SYSTEME."; }
echo "::endgroup::"
echo "::group::Lot A — pilotage réel, restauration et retours arrière, TLS"
"${SSH[@]}" "$ENV_VM; cd /opt/suivi-audits && NODE_EXTRA_CA_CERTS=/opt/suivi-audits/racine-suivi-audits.crt node \$GITHUB_WORKSPACE/scripts/ci/guide-api.mjs lot-a https://localhost" || { echo "::endgroup::"; diagnostic_vm; arret "Le lot A a échoué sur $SYSTEME."; }
echo "::endgroup::"
if [ "$SYSTEME" = rocky10 ]; then
  [ "$("${SSH[@]}" getenforce)" = Enforcing ] || arret "SELinux a été modifié pendant le rejeu : refus."
fi
echo "Guide rejoué sur $SYSTEME : toutes les étapes ont réussi."

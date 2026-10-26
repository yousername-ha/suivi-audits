"""Exécutant Compose isolé : pas de serveur HTTP, commandes fermées, état durable non sensible.

Le frontal stable n'est jamais recréé. La dernière étape remplace cet exécutant lui-même ;
son successeur lit le reçu durable et ouvre l'application seulement après santé réelle.
"""
import contextlib
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid

REPOSITORY = "yousername-ha/suivi-audits"
PUBLIC_GIT = f"https://github.com/{REPOSITORY}.git"
SIGNER_ISSUER = "https://token.actions.githubusercontent.com"
VERSION = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
TERMINAL = {"success", "rolled_back", "failed", "intervention"}
PHASES = {"controles": "preparing", "notes": "preparing", "sauvegarde": "backup", "images": "installing", "demarrage": "installing", "sante": "verifying", "termine": "complete"}


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def atomic(file, data, mode=0o600):
    file = Path(file)
    file.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".update-", dir=file.parent)
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, "w") as stream:
            json.dump(data, stream)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, file)
        parent = os.open(file.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(parent)
        finally:
            os.close(parent)
    finally:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(name)


def read(file, default=None):
    try:
        return json.loads(Path(file).read_text())
    except (OSError, ValueError):
        return default


def version(v):
    if not isinstance(v, str) or not VERSION.fullmatch(v) or len(v) > 40:
        raise ValueError("Version stable invalide")
    return tuple(map(int, v.split(".")))


def release(payload):
    if not isinstance(payload, dict) or payload.get("draft") or payload.get("prerelease"):
        raise ValueError("Publication stable requise")
    tag = payload.get("tag_name", "")
    if not isinstance(tag, str) or not tag.startswith("v"):
        raise ValueError("Étiquette invalide")
    v = tag[1:]
    version(v)
    return v, f"https://github.com/{REPOSITORY}/releases/tag/v{v}"


class Failure(Exception):
    pass


class Worker:
    def __init__(self):
        self.repo = Path(os.environ["REPO"]).resolve()
        self.data = Path(os.environ["DATA_DIR"]).resolve()
        self.public = self.data / "etat/updates"
        self.private = self.data / "reprise-updates"
        self.private.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.private, 0o700)
        self.guard = threading.RLock()
        self.job = read(self.private / "active.json")
        self.locked = False
        self.stop = threading.Event()
        installed = self.env().get("APP_VERSION", "")
        self.state = read(self.public / "status.json", {})
        defaults = dict(installed=installed, available=None, checkedAt=None, notes=None, checking=False,
                        checkError=False, ready=False, maintenance=False, id=None, target=None,
                        status="idle", phase="idle", message="Aucune mise à jour en cours.", startedAt=None, updatedAt=now(),
                        etapes=[], finishedAt=None)
        self.state = {**defaults, **self.state, "installed": installed}

    def env(self):
        result = {}
        for line in (self.repo / ".env").read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                result[k.strip()] = v.strip().strip("\"'")
        return result

    def publish(self, **changes):
        with self.guard:
            # Frise publique de l'installation : seules les transitions de phase, horodatées (aucune donnée sensible).
            phase = changes.get("phase")
            if (phase and phase not in ("idle", "checking") and self.job and self.job.get("kind") == "install"
                    and (phase != self.state.get("phase") or "etapes" in changes)):
                etapes = list(changes.get("etapes", self.state.get("etapes") or []))
                if not etapes or etapes[-1].get("phase") != phase:
                    etapes.append({"phase": phase, "at": now()})
                changes["etapes"] = etapes[-30:]
            self.state.update(changes, updatedAt=now())
            atomic(self.public / "status.json", self.state, 0o644)
            flag = self.public / "maintenance"
            if self.state["maintenance"]:
                if not flag.exists():
                    atomic(flag, {"maintenance": True}, 0o644)
            else:
                with contextlib.suppress(FileNotFoundError):
                    flag.unlink()

    def run(self, args, timeout=120, extra_env=None):
        env = {**os.environ, "SUIVI_MAJ_WEB": "1", "PWD": str(self.repo), "GIT_CONFIG_COUNT": "1", "GIT_CONFIG_KEY_0": "safe.directory", "GIT_CONFIG_VALUE_0": str(self.repo), "GIT_SSH_COMMAND": "ssh -o BatchMode=yes -o StrictHostKeyChecking=yes", **(extra_env or {})}
        # Ne jamais journaliser stdout/stderr : ils peuvent contenir des données sensibles de la CLI.
        p = subprocess.Popen(args, cwd=self.repo, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             start_new_session=True, pass_fds=(8, 9) if self.locked else ())
        try:
            out, _ = p.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGTERM)
            try:
                p.communicate(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(p.pid, signal.SIGKILL)
                p.communicate()
            raise Failure("Délai dépassé") from None
        if p.returncode:
            raise Failure("Commande interrompue")
        return out.decode()

    def cli(self, *args):
        return self.run(["docker", "compose", "exec", "-T", "app", "suivi", *args])

    def check(self):
        self.publish(checking=True, checkError=False)
        try:
            req = urllib.request.Request(f"https://api.github.com/repos/{REPOSITORY}/releases/latest",
                                         headers={"Accept": "application/vnd.github+json", "User-Agent": "suivi-smsi-updater", "X-GitHub-Api-Version": "2022-11-28"})
            try:
                with urllib.request.urlopen(req, timeout=20) as response:
                    payload = response.read(2_000_001)
                    if len(payload) > 2_000_000:
                        raise Failure("Réponse trop volumineuse")
                    available, notes = release(json.loads(payload))
            except urllib.error.HTTPError as error:
                if error.code not in (401, 403, 404):
                    raise
                # Dépôt privé : réutiliser la clé de déploiement et l'authentification au registre du guide.
                tags = self.run(["git", "ls-remote", "--tags", "--refs", "origin", "v*"], timeout=45)
                candidates = [line.split("refs/tags/v", 1)[1] for line in tags.splitlines() if "refs/tags/v" in line]
                candidates = [v for v in candidates if VERSION.fullmatch(v)]
                if not candidates:
                    raise Failure("Aucune version publiée")
                available = max(candidates, key=version)
                # Ne pas annoncer une publication dont un artefact n'est pas encore disponible.
                for component in ("api", "web", "updater"):
                    self.run(["docker", "manifest", "inspect", f"ghcr.io/{REPOSITORY}-{component}:{available}"], timeout=45)
                notes = f"https://github.com/{REPOSITORY}/releases/tag/v{available}"
            self.publish(available=available, notes=notes, checkedAt=now(), checking=False, checkError=False)
        except Exception:
            # Conserver la dernière disponibilité connue ; ne jamais inventer « à jour » en cas de panne réseau.
            self.publish(checking=False, checkError=True)
            raise Failure("La vérification GitHub a échoué") from None

    def health(self, expected):
        payload = json.loads(self.run(["docker", "compose", "exec", "-T", "app", "node", "-e",
            "fetch('http://127.0.0.1:8080/api/health/ready').then(async r=>{if(!r.ok)process.exit(1);console.log(await r.text())}).catch(()=>process.exit(1))"]))
        if payload.get("pret") is not True or payload.get("version") != expected or payload.get("migrationsEnAttente"):
            raise Failure("L'application n'est pas prête")
        # Relecture des documents chiffrés et contrôle de la base, puis trajet HTTP frontal interne.
        control = json.loads(self.cli("controle-donnees"))
        if control.get("ok") is not True:
            raise Failure("Contrôle des données en échec")
        before = self.job.get("before") if self.job else None
        if before:
            if control.get("documents", {}).get("empreinte") != before.get("documents", {}).get("empreinte"):
                raise Failure("Les documents ont changé pendant la mise à jour")
            for table, count in before.get("tables", {}).items():
                if control.get("tables", {}).get(table, -1) < count:
                    raise Failure("Des données ont disparu pendant la mise à jour")
        if self.job:
            identical = None
            if before and before.get("documents", {}).get("empreinte"):
                identical = control.get("documents", {}).get("empreinte") == before["documents"]["empreinte"]
            self.job["after"] = {"ok": True, "documentsIdentiques": identical}
        result = self.run(["docker", "compose", "exec", "-T", "gateway", "wget", "-qO-", "http://web:8080/healthz"])
        if result.strip() != "ok":
            raise Failure("Le frontal applicatif n'est pas prêt")

    def exploitation(self):
        # Réutiliser l'exécutant existant, séquentiellement : pas de cron ni de service supplémentaire.
        config = self.env()
        if config.get("EXPLOITATION_AUTO", "1") != "1" or self.state["maintenance"]:
            return
        temporary = self.data / "reprise-exploitation/tmp"
        temporary.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(temporary.parent, 0o700)
        os.chmod(temporary, 0o700)
        if not config.get("BACKUP_DEST"):
            destination = self.data / "sauvegardes"
            destination.mkdir(mode=0o700, parents=True, exist_ok=True)
            os.chmod(destination, 0o700)
        settings = {
            "BACKUP_DEST": config.get("BACKUP_DEST") or str(self.data / "sauvegardes"),
            "BACKUP_PASSPHRASE_FILE": config.get("BACKUP_PASSPHRASE_FILE") or str(self.data / "update-secrets/backup-pass"),
            "TMPDIR": str(temporary),
            "EXPLOITATION_TLS_HOST": "gateway",
            "EXPLOITATION_TLS_PORT": "8443",
        }
        self.run(["python3", str(self.repo / "scripts/exploitation-worker.py")], timeout=4000, extra_env=settings)

    def reconcile(self):
        # Les reçus survivent au rollback/restauration ; des demandes restaurées ne sont jamais rejouées.
        for receipt in sorted((self.private / "receipts").glob("*.json")):
            r = read(receipt)
            if r and r.get("status") in TERMINAL:
                with contextlib.suppress(Failure):
                    self.cli("update-finish", str(uuid.UUID(r["id"])), r["status"])
        # Fermer les demandes dont le résultat est connu AVANT de neutraliser les autres intentions restaurées.
        with contextlib.suppress(Failure):
            self.cli("update-sync")

    def receipt(self, status, message, end):
        """Reçu structuré d'une installation (preuve de changement), sans sortie brute de commande."""
        job = self.job or {}
        if job.get("kind") != "install" or not job.get("target"):
            return
        backup = None
        progress = read(self.private / "progress.json", {})
        if progress.get("jobId") == job["id"] and str(progress.get("backup", "")).endswith(".enc"):
            path = Path(progress["backup"])
            digest = None
            with contextlib.suppress(OSError, IndexError):
                first = (path.parent / (path.name + ".sha256")).read_text().split()[0]
                digest = first if re.fullmatch(r"[a-f0-9]{64}", first) else None
            backup = {"fichier": path.name[:200], "sha256": digest}
        start = self.state.get("startedAt")
        duration = None
        with contextlib.suppress(TypeError, ValueError):
            parse = lambda v: dt.datetime.fromisoformat(v.replace("Z", "+00:00"))
            duration = max(0, int((parse(end) - parse(start)).total_seconds()))
        before, after = job.get("before") or {}, job.get("after") or {}
        revision = job.get("revision")
        data = {
            "format": 1, "id": job["id"], "depuis": str(job.get("installed", ""))[:80], "vers": job["target"],
            "statut": status, "message": message[:500], "debut": start, "fin": end, "dureeSecondes": duration,
            "etapes": list(self.state.get("etapes") or [])[-30:],
            "images": {k: v for k, v in (job.get("images") or {}).items() if k in ("api", "web", "updater")},
            "signature": {"verifiee": bool(revision), "identite": self.signer(job["target"]), "emetteur": SIGNER_ISSUER,
                          "revision": revision if revision and re.fullmatch(r"[a-f0-9]{40}", revision) else None},
            "sauvegarde": backup,
            "controles": {"avant": before.get("ok") is True if before else None,
                          "apres": after.get("ok") is True if after else None,
                          "documentsIdentiques": after.get("documentsIdentiques")},
        }
        # Le reçu ne doit jamais empêcher la clôture d'une opération.
        with contextlib.suppress(OSError, ValueError):
            atomic(self.data / "etat/recus-mises-a-jour" / f'{job["id"]}.json', data, 0o644)

    def finish(self, status, message):
        if status not in TERMINAL:
            raise Failure("État terminal invalide")
        atomic(self.private / "receipts" / f'{self.job["id"]}.json', {"id": self.job["id"], "status": status, "at": now()})
        self.reconcile()
        end = now()
        self.publish(id=self.job["id"], target=self.job.get("target"), status=status, phase="complete" if status == "success" else self.state["phase"],
                     maintenance=status == "intervention", ready=status != "intervention", message=message, finishedAt=end,
                     installed=self.env().get("APP_VERSION", self.state["installed"]))
        self.receipt(status, message, end)
        if status == "intervention":
            self.job["blocked"] = True
            atomic(self.private / "active.json", self.job)
        else:
            with contextlib.suppress(FileNotFoundError):
                (self.private / "active.json").unlink()
            self.job = None

    def recover(self):
        if not self.job:
            return
        self.publish(maintenance=True, ready=False, id=self.job["id"], target=self.job.get("target"))
        if self.job.get("blocked"):
            self.publish(status="intervention", message="Une intervention de l’administrateur est nécessaire. Les accès restent protégés.")
            return
        if self.job.get("handoff"):
            try:
                self.health(self.job["target"])
                self.finish("success", "Mise à jour installée et vérifiée. Votre espace est prêt.")
            except Exception:
                self.finish("intervention", "Le contrôle final a échoué. Les accès restent protégés ; contactez l’administrateur.")
            return
        progress = read(self.private / "progress.json", {})
        if progress.get("jobId") != self.job["id"] or progress.get("phase") in (None, "controles", "notes", "sauvegarde"):
            self.finish("failed", "L’opération a été interrompue avant le remplacement. Vous pouvez vérifier puis réessayer.")
            return
        try:
            self.publish(phase="rollback", message="Retour sécurisé à la version précédente.")
            ref = self.job["previousRef"]
            if not re.fullmatch(r"[a-f0-9]{40}", ref):
                raise Failure("Référence invalide")
            backup = Path(progress.get("backup", ""))
            backup.resolve().relative_to(self.data / "sauvegardes-updates")
            if not backup.is_file() or backup.suffix != ".enc":
                raise Failure("Sauvegarde absente")
            self.run(["git", "checkout", "--detach", ref])
            (self.repo / ".env").write_text(self.job["previousEnv"])
            self.run(["bash", str(self.repo / "scripts/restore.sh"), str(backup)], timeout=1800,
                     extra_env={"RESTAURER_SANS_CONFIRMATION": "1", "BACKUP_PASSPHRASE_FILE": str(self.data / "update-secrets/backup-pass"),
                                "RESTORE_WORKER_LOCK_HELD": "1", "RESTORE_SAUVEGARDE_LOCK_HELD": "1"})
            self.health(self.job["installed"])
            self.finish("rolled_back", "La mise à jour a été interrompue. La version précédente a été restaurée et vérifiée.")
        except Exception:
            self.finish("intervention", "Le retour sécurisé nécessite une intervention de l’administrateur. Les accès restent protégés.")

    def signatures(self, target):
        # Le commit des sources doit correspondre à celui des images signées (label inclus dans l'empreinte).
        refspec = f"refs/tags/v{target}:refs/tags/v{target}"
        try:
            self.run(["git", "fetch", "--no-tags", "origin", refspec], timeout=120)
        except Failure:
            # Sans clé de déploiement (ADR 0061) : lecture publique en HTTPS. L'intégrité ne dépend pas de la source :
            # la révision lue doit être celle portée par les images signées, sinon l'installation est refusée.
            self.run(["git", "fetch", "--no-tags", PUBLIC_GIT, refspec], timeout=120)
        revision = self.run(["git", "rev-parse", f"refs/tags/v{target}^{{commit}}"]).strip()
        if not re.fullmatch(r"[a-f0-9]{40}", revision):
            raise Failure("Référence de publication invalide")
        # Vérifier les trois artefacts avant d'arrêter l'application, sans possibilité de désactiver la signature.
        for component in ("api", "web", "updater"):
            image = f"ghcr.io/{REPOSITORY}-{component}:{target}"
            self.run(["docker", "pull", image], timeout=900)
            digests = json.loads(self.run(["docker", "inspect", "--format", "{{json .RepoDigests}}", image]))
            prefix = f"ghcr.io/{REPOSITORY}-{component}@sha256:"
            digest = next((d for d in digests if d.startswith(prefix) and re.fullmatch(r"[a-f0-9]{64}", d[len(prefix):])), None)
            if not digest:
                raise Failure("Empreinte d'image absente")
            self.run(["cosign", "verify", digest, "--certificate-identity", self.signer(target),
                "--certificate-oidc-issuer", SIGNER_ISSUER], timeout=300)
            source = self.run(["docker", "inspect", "--format", '{{index .Config.Labels "org.opencontainers.image.revision"}}', digest]).strip()
            if source != revision:
                raise Failure("Les sources ne correspondent pas aux images signées")
            # Une étiquette modifiée entre téléchargement et application est refusée par le script (empreinte attendue).
            self.job.setdefault("images", {})[component] = digest
        # Révision vérifiée (signature et sources concordantes) : reprise dans le reçu.
        self.job["revision"] = revision
        atomic(self.private / "active.json", self.job)

    @staticmethod
    def signer(target):
        return f"https://github.com/{REPOSITORY}/.github/workflows/release.yml@refs/tags/v{target}"

    def install(self, job):
        target = job["target"]
        version(target)
        self.check()
        installed = self.env().get("APP_VERSION", "")
        if self.state["available"] != target or version(installed) >= version(target):
            raise Failure("Disponibilité modifiée")
        self.job = {**job, "installed": installed, "previousRef": self.run(["git", "rev-parse", "HEAD"]).strip(),
                    "previousEnv": (self.repo / ".env").read_text(), "handoff": False}
        atomic(self.private / "active.json", self.job)
        self.publish(id=job["id"], target=target, status="running", phase="preparing", startedAt=now(),
                     finishedAt=None, etapes=[], ready=False, message="Préparation et vérification de la nouvelle version.")
        self.signatures(target)
        # Les utilisateurs ne sont interrompus qu'après téléchargement et vérification des images.
        self.publish(maintenance=True, phase="backup", message="Sauvegarde de sécurité de vos données.")
        self.cli("update-drain")
        self.job["before"] = json.loads(self.cli("controle-donnees"))
        if self.job["before"].get("ok") is not True:
            raise Failure("Contrôle préalable des données en échec")
        atomic(self.private / "active.json", self.job)
        key = self.data / "update-secrets/backup-pass"
        log = self.private / f'{job["id"]}.log'
        env = {"BACKUP_PASSPHRASE_FILE": str(key), "SUIVI_UPDATE_PROGRESS": str(self.private / "progress.json"),
               "SUIVI_UPDATE_JOB": job["id"], "SUIVI_UPDATE_IMAGES": json.dumps(self.job["images"]),
               "UPDATE_SAUVEGARDE_LOCK_HELD": "1", "RESTORE_WORKER_LOCK_HELD": "1", "RESTORE_SAUVEGARDE_LOCK_HELD": "1"}
        # Le script établi garde sauvegarde, migrations et rollback. Aucun argument contrôlé librement.
        p = subprocess.Popen(["bash", str(self.repo / "scripts/mettre-a-jour.sh"), target, "--auto", "--sauvegardes", str(self.data / "sauvegardes-updates")],
                             cwd=self.repo, env={**os.environ, **env, "SUIVI_MAJ_WEB": "1", "PWD": str(self.repo), "GIT_CONFIG_COUNT": "1", "GIT_CONFIG_KEY_0": "safe.directory", "GIT_CONFIG_VALUE_0": str(self.repo)},
                             stdout=log.open("w"), stderr=subprocess.STDOUT, pass_fds=(8, 9), start_new_session=True)
        start = time.monotonic()
        while p.poll() is None:
            progress = read(self.private / "progress.json", {})
            if progress.get("jobId") == job["id"]:
                phase = PHASES.get(progress.get("phase"), "rollback" if str(progress.get("phase", "")).startswith("retour") else "installing")
                messages = {"preparing": "Préparation de la version.", "backup": "Sauvegarde de sécurité de vos données.",
                    "installing": "Installation de la nouvelle version.", "verifying": "Vérification du service et de vos données.",
                    "rollback": "Retour sécurisé à la version précédente.", "complete": "Dernières vérifications."}
                self.publish(phase=phase, message=messages[phase])
            if time.monotonic() - start > 3600:
                os.killpg(p.pid, signal.SIGTERM)
                try:
                    p.wait(timeout=20)
                except subprocess.TimeoutExpired:
                    os.killpg(p.pid, signal.SIGKILL)
                    p.wait()
                self.recover()
                return
            time.sleep(2)
        if p.returncode:
            # Le script a déjà tenté le rollback ; valider réellement l'ancienne version.
            try:
                self.health(installed)
                self.finish("rolled_back", "La mise à jour a échoué. La version précédente reste disponible et a été vérifiée.")
            except Exception:
                self.recover()
            return
        self.health(target)
        # Rendre l'exécutant auto-évolutif sans interrompre le frontal de maintenance.
        self.job["handoff"] = True
        atomic(self.private / "active.json", self.job)
        self.publish(phase="verifying", message="Vérification finale du système de mise à jour.")
        # Un conteneur éphémère indépendant lance la recréation ; il survit à l'arrêt de cet exécutant.
        image = self.job["images"]["updater"]
        self.run(["docker", "run", "--rm", "-d", "--name", "suivi-update-handoff", "--network", "none",
                  "-v", "/var/run/docker.sock:/var/run/docker.sock", "-v", f"{self.repo}:{self.repo}",
                  "-w", str(self.repo), "-e", f"PWD={self.repo}", image,
                  "docker", "compose", "up", "-d", "--no-deps", "updater"])
        # Le successeur finalise le reçu ; ne pas relancer une demande dans l'ancienne instance.
        self.stop.set()

    def locked_operation(self, callback):
        handles = []
        try:
            for fd, file in ((8, "backup-worker.lock"), (9, "sauvegarde.lock")):
                h = open(self.data / "etat" / file, "a+")
                handles.append(h)
                fcntl.flock(h, fcntl.LOCK_EX | fcntl.LOCK_NB)
                os.dup2(h.fileno(), fd, inheritable=True)
            self.locked = True
            callback()
        finally:
            self.locked = False
            for h in reversed(handles):
                fcntl.flock(h, fcntl.LOCK_UN)
                h.close()
            for fd in (8, 9):
                with contextlib.suppress(OSError):
                    os.close(fd)

    def loop(self):
        # Verrou commun à toutes les instances du conteneur, indépendant de PostgreSQL.
        with open(self.private / "worker.lock", "a+") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            if self.job:
                self.locked_operation(self.recover)
            last_check = 0
            while not self.stop.is_set():
                self.publish(ready=self.state["status"] != "intervention")
                self.reconcile()
                try:
                    if self.state["status"] != "intervention":
                        # Le poller détient son propre verrou partagé avec les sauvegardes et mises à jour.
                        # Son échec ne bloque pas la vérification GitHub ni la reprise d'une mise à jour.
                        with contextlib.suppress(Failure, OSError):
                            self.exploitation()
                    raw = self.cli("update-claim").strip()
                    job = json.loads(raw) if raw else None
                    if job:
                        if set(job) != {"id", "kind", "target"} or str(uuid.UUID(job["id"])) != job["id"]:
                            raise Failure("Demande invalide")
                        if job["kind"] == "check":
                            self.job = job
                            self.publish(id=job["id"], target=None, status="running", phase="checking", ready=False,
                                         message="Vérification des publications disponibles.")
                            try:
                                self.check()
                                self.finish("success", "Vérification des publications terminée.")
                            except Failure:
                                self.finish("failed", "GitHub est temporairement indisponible. La dernière version connue est conservée.")
                            last_check = time.monotonic()
                        elif job["kind"] == "install" and self.state["status"] != "intervention":
                            try:
                                self.locked_operation(lambda: self.install(job))
                            except Exception:
                                if self.job:
                                    self.locked_operation(self.recover)
                                else:
                                    self.job = job
                                    self.finish("failed", "Une opération serveur ou une vérification empêche l’installation. Réessayez plus tard.")
                        else:
                            raise Failure("Commande inconnue")
                    elif time.monotonic() - last_check > 21600:
                        with contextlib.suppress(Failure):
                            self.check()
                        last_check = time.monotonic()
                except Exception:
                    # Pas de sortie du daemon à la première indisponibilité de l'API.
                    pass
                self.stop.wait(15)
            # Attend sa recréation. Le vieux daemon ne réouvre jamais le service prématurément.
            self.stop.wait()
            while True:
                time.sleep(30)


if __name__ == "__main__":
    Worker().loop()

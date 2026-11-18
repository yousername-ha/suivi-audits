"""Exécutant Compose isolé : pas de serveur HTTP, commandes fermées, état durable non sensible.

Le frontal stable n'est pas recréé au milieu d'une mise à jour (ADR 0061) ; à la toute fin, il n'est mis à jour que si son
empreinte diffère de celle de l'image web vérifiée de la cible (ADR 0103). La dernière étape remplace cet exécutant lui-même ;
son successeur lit le reçu durable et ouvre l'application seulement après santé réelle.
"""
import contextlib
import datetime as dt
import fcntl
import base64
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import signal
import socket
import ssl
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

REPOSITORY = "yousername-ha/suivi-audits"
PUBLIC_GIT = f"https://github.com/{REPOSITORY}.git"
SIGNER_ISSUER = "https://token.actions.githubusercontent.com"
CYCLONEDX = "https://cyclonedx.org/bom"
SBOM_MAX = 20_000_000
VERSION = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
TERMINAL = {"success", "rolled_back", "failed", "intervention"}
PHASES = {"controles": "preparing", "notes": "preparing", "sauvegarde": "backup", "images": "installing", "demarrage": "installing", "sante": "verifying", "termine": "verifying"}
# Flux vers l'extérieur (ADR 0097) : identifiants du registre partagé (packages/shared/src/flux-externes.ts) et conteneurs de
# sortie démarrés par leur profil Compose, services dans l'ordre de démarrage (clamav attend les signatures de freshclam).
# Listes fermées : aucun nom reçu de l'application ne sert d'argument de commande. Leur concordance avec le registre et le
# compose est vérifiée par apps/api/test/architecture-flux.test.ts (garder chaque constante sur une ligne, en JSON).
FLUX_MODULES = ("assistant", "courriel", "acme", "antivirus", "mises-a-jour", "tenable", "veille-vulnerabilites", "algolighthouse")
FLUX_CONTENEURS = {"assistant": {"profil": "assistant", "services": ["assistant-relais"]}, "antivirus": {"profil": "antivirus", "services": ["freshclam", "clamav"]}}
FLUX_ERREUR_MAX = 300
# Rapport de l'état appliqué : à chaque changement, et renouvelé à cette période (secondes) pour ne pas inonder la base.
FLUX_RAPPORT_PERIODE = 1800
# « up -d » renouvelé sur les conteneurs ouverts à cette période et au démarrage de l'exécutant (nouvelle image après une mise
# à jour, réglage changé) ; Compose ne recrée un conteneur que si sa configuration a changé.
FLUX_CONVERGENCE_PERIODE = 3600
FLUX_REESSAI = 600
# Reprise de l'existant (précision du RSSI du 16/11/2026 : une mise à jour ne referme pas un flux en service). Avant toute
# fermeture, l'exécutant déclare à l'application (« suivi flux-reprise ») les modules qu'il porte et qui sont réellement en
# service, avec le motif constaté ; un module jamais décidé est alors enregistré ouvert, un module décidé n'est jamais touché.
# Codes recopiés de FLUX_REPRISE_MOTIFS (packages/shared/src/flux-externes.ts), concordance vérifiée par le test d'architecture.
FLUX_REPRISE_MOTIFS = {"assistant": ["conteneur-present", "env-renseigne"], "antivirus": ["conteneur-present", "env-renseigne"], "mises-a-jour": ["mise-a-jour-installee"]}
# Réglage de .env qui, renseigné, montre que le module était en service avant la 7.2 (guide d'installation de la 7.1).
FLUX_REPRISE_ENV = {"assistant": "ASSISTANT_RELAIS_URL", "antivirus": "CLAMAV_HOST"}
# Frontal stable « gateway » mis à jour à la demande (ADR 0103, qui remplace l'exception ponctuelle de la 7.2.2) : à la fin
# d'une mise à jour web réussie, l'exécutant de la cible (seul code de la cible qui s'exécute alors : scripts/mettre-a-jour.sh
# est celui de la version installée) compare l'empreinte du frontal en service à celle de l'image web vérifiée de la cible,
# calculée à la construction de l'image (docker/web.Dockerfile) et écrite à ce chemin, une ligne de 64 caractères hexadécimaux.
FRONTAL_EMPREINTE = "/etc/suivi-frontal.sha256"
FRONTAL_IMAGE = f"ghcr.io/{REPOSITORY}-web"
FRONTAL_DELAI = 120
UUID_JSON = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json$")
# Progression réelle du téléchargement (ADR 0104) : images tirées par l'API du moteur Docker, sur le socket déjà monté, sans
# préfixe de version (celle du moteur : un préfixe fixe serait refusé par un moteur trop ancien ou trop récent). Délai par image
# identique à celui de « docker pull » ; octets reçus publiés au plus une fois par TELECHARGEMENT_PERIODE secondes.
DOCKER_SOCKET = "/var/run/docker.sock"
TELECHARGEMENT_DELAI = 900
TELECHARGEMENT_PERIODE = 1.0
# Statuts du flux de l'API qui disent une couche entièrement reçue (ou déjà présente sur le serveur). « Extracting » porte la
# progression de la décompression, jamais des octets reçus : seule sa présence compte.
COUCHE_RECUE = {"Download complete", "Verifying Checksum", "Extracting", "Pull complete", "Already exists"}


class Indisponible(Exception):
    """L'API du moteur ne peut pas servir le téléchargement et rien n'en a encore été reçu : repli sur « docker pull »."""


class MoteurDocker(http.client.HTTPConnection):
    """Connexion HTTP à l'API du moteur Docker par son socket Unix (bibliothèque standard seule)."""

    def __init__(self, chemin, timeout):
        super().__init__("localhost", timeout=timeout)
        self.chemin = chemin
        # Référence propre au socket : http.client l'oublie quand la réponse annonce la fermeture de la connexion.
        self.brut = None

    def connect(self):
        self.sock = self.brut = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(self.chemin)


class Progression:
    """Octets reçus sur le total à télécharger pour les trois images (ADR 0104). Le total est fixé avant le début : somme des
    tailles des couches de la plateforme du serveur, lues dans les manifestes du registre, une fois par couche partagée. Une
    couche déjà présente sur le serveur n'est connue qu'au début de son flux (« Already exists ») : elle compte alors comme
    reçue, la barre peut donc partir au-dessus de zéro. La valeur ne recule jamais et ne dépasse jamais le total."""

    def __init__(self, couches):
        # Le flux désigne chaque couche par les 12 premiers caractères hexadécimaux de son empreinte.
        self.tailles = {digest[7:19]: taille for digest, taille in couches.items()}
        self.total = sum(self.tailles.values())
        self.recus = {}

    def evenement(self, evenement):
        ident = evenement.get("id")
        if not isinstance(ident, str) or ident not in self.tailles:
            return
        taille, statut = self.tailles[ident], evenement.get("status")
        if statut == "Downloading":
            detail = evenement.get("progressDetail")
            courant = detail.get("current") if isinstance(detail, dict) else None
            if not isinstance(courant, int) or isinstance(courant, bool) or courant < 0:
                return
            valeur = min(courant, taille)
        elif statut in COUCHE_RECUE:
            valeur = taille
        else:
            return
        self.recus[ident] = max(self.recus.get(ident, 0), valeur)

    def terminer(self, couches):
        """Image tirée sans erreur : toutes ses couches sont là (une image déjà à jour ne décrit aucune couche dans son flux)."""
        for digest in couches:
            ident = digest[7:19]
            self.recus[ident] = self.tailles[ident]

    @property
    def recu(self):
        return min(self.total, sum(self.recus.values()))


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


def flux_souhaites(raw):
    """Modules voulus ouverts, d'après la sortie de « suivi flux-souhaites » ; None si elle est illisible (sens sûr : une réponse
    douteuse n'ouvre rien). Un nom inconnu du registre est ignoré : il ne sert jamais d'argument de commande."""
    try:
        data = json.loads(raw)
    except ValueError:
        return None
    if (not isinstance(data, dict) or set(data) != {"ouverts"} or not isinstance(data["ouverts"], list)
            or not all(isinstance(m, str) for m in data["ouverts"])):
        return None
    return frozenset(m for m in data["ouverts"] if m in FLUX_MODULES)


def flux_entree(etat, erreur=None):
    """Entrée du rapport « suivi flux-appliques » : une erreur courte (une ligne, sans caractère de contrôle, phrase fixe de
    l'exécutant, jamais une sortie de commande) accompagne l'état « erreur », et lui seul."""
    if etat != "erreur":
        return {"etat": etat}
    texte = re.sub(r"[\x00-\x1f\x7f]+", " ", erreur or "Erreur sans détail.").strip() or "Erreur sans détail."
    return {"etat": "erreur", "erreur": texte[:FLUX_ERREUR_MAX]}


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
                        etapes=[], finishedAt=None, coupure=False, telechargement=None)
        self.state = {**defaults, **self.state, "installed": installed}
        # Coupure du frontal annoncée (ADR 0103) : seulement pendant une opération active.
        if not self.job:
            self.state["coupure"] = False
        # Progression du téléchargement (ADR 0104) : mesurée par ce processus seul ; celle d'un exécutant arrêté est périmée.
        self.state["telechargement"] = None
        self.telechargement_publie_le = None
        # Flux vers l'extérieur (ADR 0097) : dernier état voulu lu (None : illisible à ce passage), dernier rapport accepté
        # par l'application et son horodatage, dernier « up -d » complet des conteneurs ouverts (0 : au démarrage).
        self.flux_voulus = None
        self.flux_applique = {}
        self.flux_rapporte = None
        self.flux_rapporte_le = 0.0
        self.flux_convergence = 0.0
        self.flux_a_converger = set()
        # Après une erreur de démarrage, nouvel essai à ce moment (monotone) seulement : un téléchargement d'image qui
        # échoue ne bloque pas la boucle à chaque passage.
        self.flux_reessai = {}
        # Une mise à jour déjà installée ne disparaît pas : constatée une fois, elle n'est plus recherchée.
        self.mise_a_jour_vue = False

    def env(self):
        result = {}
        for line in (self.repo / ".env").read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                result[k.strip()] = v.strip().strip("\"'")
        return result

    def crypto_env(self, config=None):
        """Clés age (ADR 0077) : identité du serveur et clés publiques de secours, dans le dossier des données par défaut."""
        config = self.env() if config is None else config
        return {"BACKUP_KEY_FILE": config.get("BACKUP_KEY_FILE") or str(self.data / "cles-sauvegarde/serveur.key"),
                "BACKUP_RECIPIENTS_FILE": config.get("BACKUP_RECIPIENTS_FILE") or str(self.data / "cles-sauvegarde/secours.pub")}

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

    def run(self, args, timeout=120, extra_env=None, input_text=None):
        env = {**os.environ, "SUIVI_MAJ_WEB": "1", "PWD": str(self.repo), "GIT_CONFIG_COUNT": "1", "GIT_CONFIG_KEY_0": "safe.directory", "GIT_CONFIG_VALUE_0": str(self.repo), "GIT_SSH_COMMAND": "ssh -o BatchMode=yes -o StrictHostKeyChecking=yes", **(extra_env or {})}
        # Ne jamais journaliser stdout/stderr : ils peuvent contenir des données sensibles de la CLI.
        p = subprocess.Popen(args, cwd=self.repo, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             stdin=subprocess.PIPE if input_text is not None else None,
                             start_new_session=True, pass_fds=(8, 9) if self.locked else ())
        try:
            out, _ = p.communicate(input_text.encode() if input_text is not None else None, timeout=timeout)
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

    def channel_ok(self, ref, target):
        """Le manifeste de publication de la révision (ou de l'étiquette) indique bien cette version et un canal autorisé :
        « stable » seul, ou aussi « development » si le serveur l'a choisi (UPDATE_CHANNEL=development dans .env)."""
        try:
            manifest = json.loads(self.run(["git", "show", f"{ref}:.github/publication.json"], timeout=30))
        except (Failure, ValueError):
            return False
        allowed = {"stable"} | ({"development"} if self.env().get("UPDATE_CHANNEL") == "development" else set())
        return (isinstance(manifest, dict) and set(manifest) == {"version", "channel"}
                and manifest["version"] == target and manifest["channel"] in allowed)

    def check(self):
        # Flux « mises-a-jour » fermé ou illisible (ADR 0097) : rien ne part vers GitHub ni vers le registre d'images.
        self.exiger_flux("mises-a-jour")
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
                # Repli sur les étiquettes git seulement pour un dépôt déclaré privé (UPDATER_SSH_DIR) et une réponse de refus
                # ou d'absence : une limite de débit (403/429) ou un dépôt public injoignable est une erreur, jamais un repli.
                if error.code not in (401, 404) or not self.env().get("UPDATER_SSH_DIR"):
                    raise
                # Dépôt privé : réutiliser la clé de déploiement et l'authentification au registre du guide.
                tags = self.run(["git", "ls-remote", "--tags", "--refs", "origin", "v*"], timeout=45)
                candidates = [line.split("refs/tags/v", 1)[1] for line in tags.splitlines() if "refs/tags/v" in line]
                candidates = [v for v in candidates if VERSION.fullmatch(v)]
                if not candidates:
                    raise Failure("Aucune version publiée")
                available = None
                # La plus récente dont le manifeste signé par la publication porte un canal autorisé.
                for candidate in sorted(candidates, key=version, reverse=True)[:20]:
                    try:
                        self.run(["git", "fetch", "--no-tags", "origin", f"refs/tags/v{candidate}:refs/tags/v{candidate}"], timeout=120)
                    except Failure:
                        continue
                    if self.channel_ok(f"refs/tags/v{candidate}", candidate):
                        available = candidate
                        break
                if not available:
                    raise Failure("Aucune version publiée sur le canal autorisé")
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
            **self.crypto_env(config),
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
        if progress.get("jobId") == job["id"] and str(progress.get("backup", "")).endswith(".age"):
            path = Path(progress["backup"])
            digest = None
            with contextlib.suppress(OSError, IndexError):
                first = (path.parent / (path.name + ".sha256")).read_text().split()[0]
                digest = first if re.fullmatch(r"[a-f0-9]{64}", first) else None
            backup = {"fichier": path.name[:200], "sha256": digest}
        start = self.state.get("startedAt")
        duration = None
        # Début inconnu (état public perdu) : durée inconnue, le reçu est écrit quand même.
        with contextlib.suppress(AttributeError, TypeError, ValueError):
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
            "sbom": {k: v for k, v in (job.get("sbom") or {}).items() if k in ("api", "web", "updater")},
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
        phase = "complete" if status == "success" else self.state["phase"]
        if self.job.get("kind") == "check" and phase == "checking":
            # Vérification en échec : elle est terminée, la page ne doit plus l'afficher « en cours » (R6-03).
            phase = "idle"
        self.publish(id=self.job["id"], target=self.job.get("target"), status=status, phase=phase,
                     maintenance=status == "intervention", ready=status != "intervention", message=message, finishedAt=end,
                     coupure=False, telechargement=None, installed=self.env().get("APP_VERSION", self.state["installed"]))
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
                # Exécutant interrompu pendant la recréation du frontal : l'ancien est rétabli avant tout contrôle.
                self.frontal_reprise()
                self.health(self.job["target"])
                message = "Mise à jour installée et vérifiée. Votre espace est prêt."
                # Après santé et contrôle des données réussis, juste avant la sortie de maintenance ; ne lève jamais.
                avertissement = self.frontal_a_la_demande()
                self.finish("success", message + (" " + avertissement if avertissement else ""))
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
            if not backup.is_file() or backup.suffix != ".age":
                raise Failure("Sauvegarde absente")
            self.run(["git", "checkout", "--detach", ref])
            (self.repo / ".env").write_text(self.job["previousEnv"])
            self.run(["bash", str(self.repo / "scripts/restore.sh"), str(backup)], timeout=1800,
                     extra_env={"RESTAURER_SANS_CONFIRMATION": "1", **self.crypto_env(),
                                "RESTORE_WORKER_LOCK_HELD": "1", "RESTORE_SAUVEGARDE_LOCK_HELD": "1"})
            self.health(self.job["installed"])
            self.finish("rolled_back", "La mise à jour a été interrompue. La version précédente a été restaurée et vérifiée.")
        except Exception:
            self.finish("intervention", "Le retour sécurisé nécessite une intervention de l’administrateur. Les accès restent protégés.")

    # ------------------------------------------------------------------ Frontal mis à jour à la demande (ADR 0103)
    # Ordre retenu : rien n'est touché avant que la nouvelle version soit en service, saine et ses données contrôlées
    # (health) ; le frontal n'est recréé que si son empreinte diffère de celle de l'image web vérifiée de la cible ; la
    # configuration du nouveau frontal est validée dans un conteneur éphémère avant toute modification ; la recréation, annoncée
    # sur la page de maintenance (indicateur « coupure » de l'état public), a lieu maintenance encore active, juste avant sa
    # levée. Les réglages TLS ne sont jamais transmis ni modifiés : le frontal recréé lit les mêmes .env et volumes (mode choisi
    # dans l'interface, certificats ACME, fourni ou interne), et il doit servir exactement le même certificat qu'avant.

    def ecrire_env(self, cle, valeur):
        """Réglage de .env remplacé, ou ajouté s'il manque (comme ecrire_env de scripts/lib-commun.sh)."""
        fichier = self.repo / ".env"
        texte = fichier.read_text()
        ligne = f"{cle}={valeur}"
        motif = re.compile(rf"^{re.escape(cle)}=.*$", re.M)
        if motif.search(texte):
            texte = motif.sub(lambda _: ligne, texte)
        else:
            texte += ("" if not texte or texte.endswith("\n") else "\n") + ligne + "\n"
        fichier.write_text(texte)

    def frontal_etat(self, **changes):
        """Avancement durable de la mise à jour du frontal, dans la demande active : un exécutant relancé sait où il en était."""
        self.job["frontal"] = {**(self.job.get("frontal") or {}), **changes}
        atomic(self.private / "active.json", self.job)

    def frontal_journal(self, texte):
        """Phrase fixe ajoutée au journal privé de l'opération, jamais une sortie de commande."""
        with contextlib.suppress(Exception):
            with (self.private / f'{self.job["id"]}.log').open("a") as journal:
                journal.write(f"{now()} Frontal : {texte}\n")

    def frontal_echec(self, avertissement):
        with contextlib.suppress(Exception):
            self.frontal_etat(etape="echec", avertissement=avertissement)
        self.frontal_journal(avertissement)
        return avertissement

    def frontal_empreinte_cible(self):
        """Empreinte du frontal contenue dans l'image web de la cible, lue dans l'image désignée par son empreinte de dépôt
        vérifiée (signatures) : conteneur éphémère sans réseau ni téléchargement. Lève Failure si elle est illisible ou mal
        formée."""
        image = str((self.job.get("images") or {}).get("web", ""))
        if not re.fullmatch(re.escape(FRONTAL_IMAGE) + r"@sha256:[a-f0-9]{64}", image):
            raise Failure("Image web non vérifiée")
        empreinte = self.run(["docker", "run", "--rm", "--pull", "never", "--network", "none", "--cap-drop", "ALL",
                              "--read-only", "--entrypoint", "cat", image, FRONTAL_EMPREINTE], timeout=60).strip()
        if not re.fullmatch(r"[a-f0-9]{64}", empreinte):
            raise Failure("Empreinte du frontal mal formée")
        return empreinte

    def frontal_empreinte_en_service(self):
        """Empreinte du frontal en service, ou None : fichier absent (image antérieure à l'ADR 0103) ou toute autre erreur de
        lecture, ce qui vaut empreinte différente (le contrôle de santé qui précède vient de passer par ce frontal)."""
        try:
            empreinte = self.run(["docker", "compose", "exec", "-T", "gateway", "cat", FRONTAL_EMPREINTE], timeout=30).strip()
        except Exception:
            return None
        return empreinte if re.fullmatch(r"[a-f0-9]{64}", empreinte) else None

    def frontal_sonde(self):
        """Frontal en service : relais interne vers l'interface, puis /healthz en HTTPS local avec le nom du site. Renvoie
        l'empreinte du certificat servi. Observation seulement : aucun cookie ni aucune donnée n'est envoyé."""
        relais = self.run(["docker", "compose", "exec", "-T", "gateway", "wget", "-qO-", "http://web:8080/healthz"], timeout=30)
        if relais.strip() != "ok":
            raise Failure("Le frontal ne relaie pas l'interface")
        site = self.env().get("SITE_ADDRESS", "")
        if not re.fullmatch(r"[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?", site):
            raise Failure("Adresse du site invalide")
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        with socket.create_connection(("gateway", 8443), timeout=5) as brut:
            with context.wrap_socket(brut, server_hostname=site) as tls:
                empreinte = hashlib.sha256(tls.getpeercert(binary_form=True)).hexdigest()
                tls.sendall(f"GET /healthz HTTP/1.1\r\nHost: {site}\r\nConnection: close\r\n\r\n".encode())
                if not tls.recv(1024).startswith((b"HTTP/1.1 200", b"HTTP/1.0 200")):
                    raise Failure("Le frontal ne répond pas en HTTPS")
        return empreinte

    def frontal_attendre(self, certificat=None):
        """Attend que le frontal recréé réponde (FRONTAL_DELAI au plus). Avec une empreinte, il doit servir exactement ce
        certificat : un autre (retour à l'autorité interne, par exemple) bloquerait le site par HSTS."""
        limite = time.monotonic() + FRONTAL_DELAI
        while True:
            try:
                servi = self.frontal_sonde()
            except (Failure, OSError):
                servi = None
            if servi is not None:
                if certificat and servi != certificat:
                    raise Failure("Certificat servi différent")
                return
            if time.monotonic() >= limite:
                raise Failure("Le frontal ne répond pas")
            time.sleep(2)

    def frontal_retablir(self):
        """Ancienne GATEWAY_VERSION réinscrite et ancien frontal recréé, jusqu'à trois essais : le site ne reste pas sans
        frontal. L'application, elle, reste mise à jour. La coupure reste annoncée pendant le rétablissement et est retirée
        ensuite, qu'il réussisse ou non. Ne lève jamais."""
        avant = (self.job.get("frontal") or {}).get("avant")
        try:
            if avant:
                with contextlib.suppress(Exception):
                    self.publish(coupure=True)
            for _ in range(3 if avant else 0):
                try:
                    self.ecrire_env("GATEWAY_VERSION", avant)
                    self.run(["docker", "compose", "up", "-d", "--no-deps", "gateway"], timeout=180)
                    self.frontal_attendre()
                    return self.frontal_echec("Frontal non mis à jour : le nouveau frontal n’a pas pu être vérifié ; l’ancien a été rétabli et répond.")
                except Exception:
                    continue
            return self.frontal_echec("Frontal non mis à jour, et l’ancien frontal ne répond pas après son rétablissement : sur le serveur, dans le dossier de l’application, lancer « sudo docker compose up -d gateway » (docs/INSTALLATION.md, section 12).")
        finally:
            with contextlib.suppress(Exception):
                self.publish(coupure=False)

    def frontal_reprise(self):
        """Exécutant relancé pendant la mise à jour du frontal : recréation entamée, l'ancien frontal est rétabli avant le
        contrôle de santé (qui passe par lui) ; validation entamée, rien n'avait été modifié. Ne lève jamais."""
        etape = ((self.job or {}).get("frontal") or {}).get("etape")
        if etape == "recreation":
            self.frontal_retablir()
        elif etape == "validation":
            self.frontal_echec("Frontal non mis à jour : opération interrompue avant toute modification ; l’ancien frontal reste en service.")

    def frontal_a_la_demande(self):
        """Frontal mis à jour à la demande (ADR 0103) : à la fin d'une mise à jour réussie, maintenance encore active, le
        frontal est recréé avec l'image web vérifiée et épinglée de la cible si son empreinte diffère de celle du frontal en
        service (ou si celui-ci n'en a pas). Empreintes identiques : rien n'est touché, aucune coupure. Empreinte de la cible
        illisible : frontal non touché, avec un avertissement. Renvoie None (rien à faire, ou frontal mis à jour et vérifié) ou
        l'avertissement à porter au reçu ; ne lève jamais : l'application reste mise à jour quoi qu'il arrive au frontal."""
        try:
            target = self.job.get("target")
            if self.job.get("frontal"):
                return self.job["frontal"].get("avertissement")
            avant = self.env().get("GATEWAY_VERSION", "")
            if not avant or avant == target:
                return None
            if not re.fullmatch(r"[\w.-]{1,40}", avant):
                raise Failure("GATEWAY_VERSION inattendue")
            try:
                cible = self.frontal_empreinte_cible()
            except Exception:
                return self.frontal_echec("Frontal non mis à jour : l’empreinte de sa nouvelle image n’a pas pu être lue ; l’ancien frontal reste en service, sans changement.")
            if self.frontal_empreinte_en_service() == cible:
                self.frontal_journal(f"inchangé, même empreinte que l’image de la version {target} ; non redémarré.")
                return None
            self.frontal_etat(avant=avant, etape="validation")
            self.publish(phase="verifying", message="Redémarrage du frontal du site. Cette page peut s’interrompre quelques secondes, puis elle reprend toute seule.")
            # L'étiquette locale, utilisée par Compose pour le frontal, doit désigner l'image web vérifiée (signature,
            # attestation, révision) de la cible.
            attendue = str((self.job.get("images") or {}).get("web", ""))
            empreintes = json.loads(self.run(["docker", "image", "inspect", "--format", "{{json .RepoDigests}}", f"{FRONTAL_IMAGE}:{target}"]))
            if not attendue.startswith(FRONTAL_IMAGE + "@sha256:") or attendue not in empreintes:
                raise Failure("Image du frontal non vérifiée")
            # Même principe que fermer_acme (exploitation-worker.py) : configuration contrôlée avec la nouvelle image, les
            # réglages et les volumes en service, sans port publié ni recréation.
            self.run(["docker", "compose", "run", "--rm", "--no-deps", "gateway", "/usr/local/bin/demarrer-gateway", "--valider"],
                     timeout=120, extra_env={"GATEWAY_VERSION": target})
            certificat = self.frontal_sonde()
        except Exception:
            return self.frontal_echec("Frontal non mis à jour : sa nouvelle image ou sa configuration n’a pas été validée ; l’ancien frontal reste en service, sans changement.")
        try:
            self.frontal_etat(etape="recreation")
            # Coupure annoncée sur la page de maintenance avant la recréation, retirée une fois le frontal vérifié ou rétabli.
            self.publish(coupure=True)
            self.ecrire_env("GATEWAY_VERSION", target)
            self.run(["docker", "compose", "up", "-d", "--no-deps", "gateway"], timeout=180)
            self.frontal_attendre(certificat)
            self.frontal_etat(etape="fait")
            self.publish(coupure=False)
            self.frontal_journal(f"mis à jour de {avant} à {target} ; configuration validée, même certificat servi, frontal vérifié.")
            return None
        except Exception:
            return self.frontal_retablir()

    # ------------------------------------------------------------------ Téléchargement des images (ADR 0104)
    # Par l'API du moteur Docker, qui rend les octets reçus de chaque couche, quand aucun identifiant de registre n'est
    # configuré pour l'exécutant ; sinon, ou si l'API ne répond pas avant d'avoir rien servi, « docker pull » comme avant, sans
    # progression. Une erreur une fois le flux commencé est un échec du téléchargement, sans nouvel essai : la mise à jour
    # s'arrête avant toute vérification et l'administrateur peut la relancer. Seuls les octets reçus et le total sont publiés.

    def identifiants_docker(self):
        """Identifiants de registre configurés pour la CLI de l'exécutant (UPDATER_DOCKER_CONFIG monté sur /root/.docker) :
        l'API du moteur ne les reçoit pas, le téléchargement passe alors par « docker pull ». Un fichier présent mais illisible
        compte comme configuré (sens sûr : comportement d'avant)."""
        dossier = os.environ.get("DOCKER_CONFIG") or os.path.join(os.path.expanduser("~"), ".docker")
        try:
            config = json.loads(Path(dossier, "config.json").read_text())
        except FileNotFoundError:
            return False
        except (OSError, ValueError):
            return True
        return not isinstance(config, dict) or any(config.get(cle) for cle in ("auths", "credsStore", "credHelpers"))

    def moteur(self, methode, chemin, timeout):
        """Requête à l'API du moteur Docker ; renvoie la connexion et la réponse (en-têtes lus)."""
        connexion = MoteurDocker(DOCKER_SOCKET, timeout)
        try:
            connexion.request(methode, chemin, headers={"Content-Length": "0"} if methode == "POST" else {})
            return connexion, connexion.getresponse()
        except BaseException:
            connexion.close()
            raise

    def plateforme(self):
        """Système et architecture du moteur, ceux des images qu'il tire."""
        try:
            connexion, reponse = self.moteur("GET", "/version", 30)
            try:
                if reponse.status != 200:
                    raise Indisponible()
                data = json.loads(reponse.read(65536))
            finally:
                connexion.close()
        except (OSError, ValueError, http.client.HTTPException):
            raise Indisponible() from None
        if not isinstance(data, dict) or not all(isinstance(data.get(k), str) and re.fullmatch(r"[\w.-]{1,40}", data[k]) for k in ("Os", "Arch")):
            raise Indisponible()
        return data["Os"], data["Arch"]

    def couches(self, image, plateforme):
        """Couches de l'image pour la plateforme du serveur, {empreinte: taille}, lues dans le manifeste du registre par la CLI
        (déjà utilisée par l'exécutant et cosign pour joindre le registre). Index multi-plateforme : une seule entrée doit
        correspondre (les attestations sont « unknown/unknown »)."""
        try:
            sortie = json.loads(self.run(["docker", "manifest", "inspect", "-v", image], timeout=60))
        except (Failure, ValueError):
            raise Indisponible() from None
        entrees = sortie if isinstance(sortie, list) else [sortie]
        if len(entrees) > 1:
            entrees = [e for e in entrees if isinstance(e, dict) and isinstance(e.get("Descriptor"), dict)
                       and isinstance(e["Descriptor"].get("platform"), dict)
                       and (e["Descriptor"]["platform"].get("os"), e["Descriptor"]["platform"].get("architecture")) == plateforme]
        if len(entrees) != 1 or not isinstance(entrees[0], dict):
            raise Indisponible()
        manifeste = entrees[0].get("OCIManifest") or entrees[0].get("SchemaV2Manifest")
        couches = manifeste.get("layers") if isinstance(manifeste, dict) else None
        if not isinstance(couches, list) or not couches:
            raise Indisponible()
        result = {}
        for couche in couches:
            digest, taille = (couche.get("digest"), couche.get("size")) if isinstance(couche, dict) else (None, None)
            if (not isinstance(digest, str) or not re.fullmatch(r"sha256:[a-f0-9]{64}", digest)
                    or not isinstance(taille, int) or isinstance(taille, bool) or taille < 0):
                raise Indisponible()
            result[digest] = taille
        return result

    def publier_telechargement(self, progression):
        """{recu, total} publié s'il a changé, au plus une fois par TELECHARGEMENT_PERIODE ; jamais en recul."""
        actuel = self.state.get("telechargement") or {}
        recu = max(progression.recu, actuel.get("recu", 0) if actuel.get("total") == progression.total else 0)
        if actuel == {"recu": recu, "total": progression.total}:
            return
        maintenant = time.monotonic()
        if self.telechargement_publie_le is not None and maintenant - self.telechargement_publie_le < TELECHARGEMENT_PERIODE:
            return
        self.telechargement_publie_le = maintenant
        self.publish(telechargement={"recu": recu, "total": progression.total})

    def tirer(self, depot, tag, couches, progression):
        """Une image tirée par l'API du moteur, flux lu ligne à ligne. Lève Indisponible si rien n'a été reçu (repli permis),
        Failure si le téléchargement échoue ou dépasse TELECHARGEMENT_DELAI."""
        limite = time.monotonic() + TELECHARGEMENT_DELAI
        chemin = "/images/create?" + urllib.parse.urlencode({"fromImage": depot, "tag": tag})
        try:
            connexion, reponse = self.moteur("POST", chemin, TELECHARGEMENT_DELAI)
        except TimeoutError:
            raise Failure("Délai dépassé") from None
        except (OSError, http.client.HTTPException):
            raise Indisponible() from None
        # Fermer la connexion interrompt le téléchargement côté moteur (délai dépassé, erreur).
        try:
            if reponse.status != 200:
                raise Indisponible()
            commence = False
            while True:
                reste = limite - time.monotonic()
                if reste <= 0:
                    raise Failure("Délai dépassé")
                connexion.brut.settimeout(reste)
                try:
                    ligne = reponse.readline(65536)
                    evenement = json.loads(ligne) if ligne.strip() else None
                    if ligne.strip() and not isinstance(evenement, dict):
                        raise ValueError
                except TimeoutError:
                    raise Failure("Délai dépassé") from None
                except (OSError, ValueError, http.client.HTTPException):
                    if commence:
                        raise Failure("Téléchargement interrompu") from None
                    raise Indisponible() from None
                if not ligne:
                    break
                if evenement is None:
                    continue
                commence = True
                # Message du moteur jamais repris : il peut citer le registre ou des identifiants.
                if "error" in evenement or "errorDetail" in evenement:
                    raise Failure("Téléchargement en échec")
                progression.evenement(evenement)
                self.publier_telechargement(progression)
            if not commence:
                raise Indisponible()
            progression.terminer(couches)
            self.publier_telechargement(progression)
        finally:
            connexion.close()

    def telecharger(self, target):
        """Les trois images de la cible : par l'API du moteur avec progression publiée, sinon par « docker pull »."""
        images = [(f"ghcr.io/{REPOSITORY}-{c}", target) for c in ("api", "web", "updater")]
        progression = par_image = None
        if not self.identifiants_docker():
            try:
                plateforme = self.plateforme()
                par_image = [self.couches(f"{depot}:{tag}", plateforme) for depot, tag in images]
                progression = Progression({d: t for couches in par_image for d, t in couches.items()})
                if progression.total <= 0:
                    progression = None
            except Indisponible:
                progression = None
        self.telechargement_publie_le = None
        try:
            if progression:
                self.publier_telechargement(progression)
            for index, (depot, tag) in enumerate(images):
                if progression:
                    try:
                        self.tirer(depot, tag, par_image[index], progression)
                        continue
                    except Indisponible:
                        # Rien reçu de cette image : elle et les suivantes passent par la CLI, sans progression.
                        progression = None
                        self.publish(telechargement=None)
                self.run(["docker", "pull", f"{depot}:{tag}"], timeout=TELECHARGEMENT_DELAI)
        finally:
            if self.state.get("telechargement") is not None:
                with contextlib.suppress(Exception):
                    self.publish(telechargement=None)

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
        # Le canal est lié à la révision signée : une préversion de développement ne s'installe que si le serveur l'a choisi.
        if not self.channel_ok(revision, target):
            raise Failure("Canal de publication non autorisé")
        # Téléchargement des trois images (progression publiée, ADR 0104), puis vérification de chacune avant d'arrêter
        # l'application, sans possibilité de désactiver la signature. Rien de ce qui est téléchargé n'est utilisé avant.
        self.telecharger(target)
        for component in ("api", "web", "updater"):
            image = f"ghcr.io/{REPOSITORY}-{component}:{target}"
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
            # Attestation SBOM signée par la même identité, pour la même empreinte (ADR 0063) : une image publiée hors de
            # la procédure normale (sans analyse ni SBOM) est refusée.
            sbom = self.sbom(digest, target)
            self.job.setdefault("sbom", {})[component] = self.keep_sbom(target, component, sbom)
            # Une étiquette modifiée entre téléchargement et application est refusée par le script (empreinte attendue).
            self.job.setdefault("images", {})[component] = digest
        # Révision vérifiée (signature et sources concordantes) : reprise dans le reçu.
        self.job["revision"] = revision
        atomic(self.private / "active.json", self.job)

    def sbom(self, digest, target):
        """SBOM CycloneDX extrait de l'attestation vérifiée ; refus si absente, mal formée ou liée à une autre image."""
        out = self.run(["cosign", "verify-attestation", digest, "--type", "cyclonedx", "--certificate-identity",
                        self.signer(target), "--certificate-oidc-issuer", SIGNER_ISSUER], timeout=300)
        expected = digest.rsplit("@sha256:", 1)[1]
        for line in out.splitlines():
            try:
                envelope = json.loads(line)
                statement = json.loads(base64.b64decode(envelope["payload"]))
            except (ValueError, KeyError, TypeError):
                continue
            subjects = statement.get("subject") or []
            if (statement.get("predicateType") == CYCLONEDX and isinstance(statement.get("predicate"), dict)
                    and any((s.get("digest") or {}).get("sha256") == expected for s in subjects if isinstance(s, dict))):
                predicate = statement["predicate"]
                if predicate.get("bomFormat") != "CycloneDX":
                    continue
                data = json.dumps(predicate, sort_keys=True, separators=(",", ":")).encode()
                if len(data) > SBOM_MAX:
                    raise Failure("SBOM trop volumineux")
                return data
        raise Failure("Attestation SBOM absente ou invalide")

    def keep_sbom(self, target, component, data):
        """Conserve le SBOM vérifié de la version (lu par l'API, jamais servi par le frontal public)."""
        folder = self.data / "etat/sbom" / target
        name = f"{component}.cdx.json"
        fd, tmp = tempfile.mkstemp(prefix=".sbom-", dir=self._mkdir(folder))
        try:
            os.fchmod(fd, 0o644)
            with os.fdopen(fd, "wb") as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(tmp, folder / name)
        finally:
            with contextlib.suppress(FileNotFoundError):
                os.unlink(tmp)
        return {"fichier": name, "sha256": hashlib.sha256(data).hexdigest()}

    @staticmethod
    def _mkdir(folder):
        folder.mkdir(mode=0o755, parents=True, exist_ok=True)
        return folder

    @staticmethod
    def signer(target):
        return f"https://github.com/{REPOSITORY}/.github/workflows/release.yml@refs/tags/v{target}"

    def install(self, job):
        target = job["target"]
        version(target)
        # Flux fermé : ni vérification, ni git fetch, ni téléchargement d'image, ni vérification Sigstore.
        self.exiger_flux("mises-a-jour")
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
        log = self.private / f'{job["id"]}.log'
        env = {**self.crypto_env(), "SUIVI_UPDATE_PROGRESS": str(self.private / "progress.json"),
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
                    "rollback": "Retour sécurisé à la version précédente."}
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

    # ------------------------------------------------------------------ Flux vers l'extérieur (ADR 0097, lot 2)
    # Règle en cas d'état voulu illisible (application arrêtée, redémarrage, réponse inattendue) : l'exécutant n'émet rien
    # lui-même (aucune vérification ni installation de version) et laisse les conteneurs de sortie dans l'état où il les a mis,
    # sans rien rapporter ; il reprend au premier passage où l'état se relit. Une indisponibilité passagère de l'application
    # n'arrête donc pas l'assistant ni l'antivirus, et elle n'ouvre jamais rien.

    def lire_flux(self, en_service=None):
        """État voulu. Avec des modules en service (reprise de l'existant), « suivi flux-reprise » les enregistre ouverts s'ils
        n'ont jamais été décidés, puis rend l'état voulu sous la même forme que « suivi flux-souhaites »."""
        try:
            if en_service:
                brut = self.run(["docker", "compose", "exec", "-T", "app", "suivi", "flux-reprise"],
                                input_text=json.dumps({"enService": en_service}))
            else:
                brut = self.cli("flux-souhaites")
            self.flux_voulus = flux_souhaites(brut)
        except Failure:
            self.flux_voulus = None
        return self.flux_voulus

    def mise_a_jour_installee(self):
        """Au moins une mise à jour déjà installée sur ce serveur : reçu d'une installation réussie depuis l'interface
        (etat/recus-mises-a-jour) ou rapport réussi du script de mise à jour (etat/mises-a-jour). Une installation neuve n'en a
        aucun. Fichiers ordinaires seulement (ni lien ni fichier spécial), lecture bornée."""
        if self.mise_a_jour_vue:
            return True
        for dossier, cle, valeur, nom_valide in (
                (self.data / "etat/recus-mises-a-jour", "statut", "success", UUID_JSON.fullmatch),
                (self.data / "etat/mises-a-jour", "resultat", "reussie", lambda n: re.fullmatch(r"[\w.-]{1,120}\.json", n))):
            try:
                noms = sorted(n for n in os.listdir(dossier) if nom_valide(n))
            except OSError:
                continue
            for nom in noms[-200:]:
                fichier = dossier / nom
                try:
                    if fichier.is_symlink() or not fichier.is_file() or fichier.stat().st_size > 65536:
                        continue
                    data = json.loads(fichier.read_text())
                except (OSError, ValueError):
                    continue
                if isinstance(data, dict) and data.get(cle) == valeur:
                    self.mise_a_jour_vue = True
                    return True
        return False

    def en_service(self, presents):
        """Modules portés ici et réellement en service sur le serveur, avec le motif constaté (reprise de l'existant) :
        conteneur de sortie présent (en marche ou arrêté), ou réglage de .env renseigné ; mises à jour : une mise à jour déjà
        installée. « presents » vaut None si Docker n'a pas répondu : seuls les autres motifs sont alors constatés."""
        try:
            config = self.env()
        except OSError:
            config = {}
        result = {}
        for module, c in FLUX_CONTENEURS.items():
            if presents and any(s in presents for s in c["services"]):
                result[module] = "conteneur-present"
            elif config.get(FLUX_REPRISE_ENV[module], "").strip():
                result[module] = "env-renseigne"
        if self.mise_a_jour_installee():
            result["mises-a-jour"] = "mise-a-jour-installee"
        return result

    def flux_ouvert(self, module):
        """État voulu relu au moment de l'usage ; illisible vaut fermé."""
        voulus = self.lire_flux()
        return voulus is not None and module in voulus

    def exiger_flux(self, module):
        if not self.flux_ouvert(module):
            raise Failure("Flux fermé")

    def conteneurs(self):
        """Conteneurs des profils de sortie, par service : état Docker et santé. Seuls les services des listes fermées sont lus."""
        profils = [arg for c in FLUX_CONTENEURS.values() for arg in ("--profile", c["profil"])]
        out = self.run(["docker", "compose", *profils, "ps", "-a", "--format", "json"], timeout=60)
        connus = {s for c in FLUX_CONTENEURS.values() for s in c["services"]}
        result = {}
        for line in out.splitlines():
            if not line.strip():
                continue
            try:
                data = json.loads(line)
            except ValueError:
                raise Failure("État des conteneurs illisible") from None
            # Une ligne JSON par conteneur ; les versions plus anciennes de Compose renvoient un tableau.
            for item in data if isinstance(data, list) else [data]:
                if isinstance(item, dict) and item.get("Service") in connus:
                    result[item["Service"]] = {"etat": str(item.get("State", "")), "sante": str(item.get("Health", ""))}
        return result

    def ouvrir_conteneurs(self, profil, services, presents):
        """Démarre les services dans l'ordre, sans bloquer la boucle : un service n'est lancé que lorsque les précédents tournent
        et sont sains (clamav attend que freshclam ait téléchargé les signatures). --no-deps : ni « init » ni autre service ne
        sont relancés. Renvoie « ouvert » quand tous tournent, None tant que le démarrage est en cours."""
        for service in services:
            present = presents.get(service, {})
            actif = present.get("etat") == "running"
            if not actif or service in self.flux_a_converger:
                try:
                    # Premier démarrage : téléchargement éventuel de l'image (ClamAV), d'où le délai.
                    self.run(["docker", "compose", "--profile", profil, "up", "-d", "--no-deps", service], timeout=900)
                except Failure as error:
                    detail = " (délai dépassé)" if str(error) == "Délai dépassé" else ""
                    return flux_entree("erreur", f"Démarrage du conteneur « {service} » (profil Compose « {profil} ») en échec{detail}.")
                self.flux_a_converger.discard(service)
                if not actif:
                    return None
            if present.get("sante") not in ("", "healthy"):
                return None
        return flux_entree("ouvert")

    def fermer_conteneurs(self, profil, services, presents):
        if not any(s in presents for s in services):
            return flux_entree("ferme")
        try:
            # Arrêt puis retrait : un conteneur fermé ne redémarre pas avec Docker (restart: unless-stopped).
            self.run(["docker", "compose", "--profile", profil, "rm", "--stop", "--force", *services], timeout=180)
        except Failure:
            return flux_entree("erreur", f"Arrêt des conteneurs du profil Compose « {profil} » en échec : le flux peut rester ouvert.")
        return flux_entree("ferme")

    def appliquer_conteneurs(self, voulus, presents):
        """Profils Compose des modules à conteneur dédié (assistant, antivirus) : ouverts démarrés, fermés arrêtés et retirés.
        « presents » : conteneurs lus avant la reprise de l'existant ; None si Docker n'a pas répondu (rien n'est touché)."""
        if presents is None:
            return {m: flux_entree("erreur", "État des conteneurs illisible : Docker ne répond pas.") for m in FLUX_CONTENEURS}
        if not self.flux_convergence or time.monotonic() - self.flux_convergence > FLUX_CONVERGENCE_PERIODE:
            # Chaque service ouvert reçoit un « up -d » une fois dans la période, même s'il tourne déjà.
            self.flux_a_converger = {s for c in FLUX_CONTENEURS.values() for s in c["services"]}
            self.flux_convergence = time.monotonic()
        etats = {}
        for module, c in FLUX_CONTENEURS.items():
            if module in voulus:
                if time.monotonic() < self.flux_reessai.get(module, 0):
                    etats[module] = None  # l'erreur rapportée reste affichée jusqu'au prochain essai
                    continue
                etats[module] = self.ouvrir_conteneurs(c["profil"], c["services"], presents)
                if etats[module] and etats[module]["etat"] == "erreur":
                    self.flux_reessai[module] = time.monotonic() + FLUX_REESSAI
                else:
                    self.flux_reessai.pop(module, None)
            else:
                self.flux_reessai.pop(module, None)
                self.flux_a_converger.difference_update(c["services"])
                etats[module] = self.fermer_conteneurs(c["profil"], c["services"], presents)
        return etats

    def rapporter_flux(self, etats):
        """État appliqué rapporté par « suivi flux-appliques », seulement s'il change ou après FLUX_RAPPORT_PERIODE. Un module
        en cours de démarrage (None) garde son dernier état rapporté."""
        for module, entree in etats.items():
            if entree is not None and module in FLUX_MODULES:
                self.flux_applique[module] = entree
        if not self.flux_applique:
            return
        if self.flux_applique == self.flux_rapporte and time.monotonic() - self.flux_rapporte_le < FLUX_RAPPORT_PERIODE:
            return
        rapport = dict(self.flux_applique)
        self.run(["docker", "compose", "exec", "-T", "app", "suivi", "flux-appliques"], input_text=json.dumps(rapport))
        self.flux_rapporte, self.flux_rapporte_le = rapport, time.monotonic()

    def flux(self):
        """Un passage : constate les modules en service, fait la reprise de l'existant AVANT toute fermeture (un module jamais
        décidé et en service est enregistré ouvert : ni son conteneur n'est arrêté, ni ses mises à jour coupées), lit l'état
        voulu qui en résulte, l'applique aux conteneurs dédiés et à l'exécutant lui-même (mises à jour), rapporte l'état
        appliqué. Le courriel et l'ACME sont appliqués et rapportés par scripts/exploitation-worker.py."""
        try:
            presents = self.conteneurs()
        except Failure:
            presents = None
        voulus = self.lire_flux(self.en_service(presents))
        if voulus is None:
            return
        etats = self.appliquer_conteneurs(voulus, presents)
        # Porteur « exécutant » : fermé, aucune vérification automatique ni demande de vérification ou d'installation ne part.
        etats["mises-a-jour"] = flux_entree("ouvert" if "mises-a-jour" in voulus else "ferme")
        with contextlib.suppress(Failure):
            self.rapporter_flux(etats)

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
                # Flux vers l'extérieur (ADR 0097) : appliqués avant tout le reste ; un échec n'empêche pas la suite du passage.
                with contextlib.suppress(Failure, OSError, ValueError):
                    self.flux()
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
                        if ((job["kind"] == "check" or (job["kind"] == "install" and self.state["status"] != "intervention"))
                                and not self.flux_ouvert("mises-a-jour")):
                            # Fermé depuis la demande (l'application ne la remet pas si le flux est fermé) : rien ne part.
                            self.job = job
                            self.finish("failed", "Le flux « Mises à jour de la plateforme » est fermé : rien n’a été vérifié ni téléchargé.")
                        elif job["kind"] == "check":
                            self.job = job
                            self.publish(id=job["id"], target=None, status="running", phase="checking", ready=False,
                                         message="Vérification des publications disponibles.")
                            try:
                                self.check()
                                self.finish("success", "Vérification des publications terminée.")
                            except Failure:
                                self.finish("failed", "Le serveur n’a pas pu joindre GitHub (pare-feu de l’hôte ou du réseau, ou GitHub indisponible). La dernière version connue est conservée.")
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
                    elif time.monotonic() - last_check > 21600 and self.flux_voulus and "mises-a-jour" in self.flux_voulus:
                        # Contrôle automatique toutes les 6 h seulement si le flux est ouvert ; fermé, il attend sa réouverture.
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

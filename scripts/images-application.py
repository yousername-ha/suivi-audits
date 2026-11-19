#!/usr/bin/env python3
"""Images Docker de l'application (ADR 0106, décisions 4 et 5) : place occupée et ménage.

  images-application.py taille
      Octets occupés par les images de l'application (somme des tailles déclarées par le moteur ; une couche partagée par deux
      images est comptée deux fois : estimation haute). N'affiche rien si le moteur Docker ne répond pas.
  images-application.py menage --en-service V [--precedente V] [--frontal V] [--env FICHIER]... [--simulation]
      Retire les images de l'application qui ne sont ni la version en service, ni la précédente, ni celle du frontal en service
      (GATEWAY_VERSION), y compris celles téléchargées par leur empreinte (sans étiquette de version). Sans --precedente, la
      précédente est la plus récente version présente antérieure à celle en service.

Une image est « de l'application » si TOUTES ses références (étiquettes et empreintes de dépôt) désignent l'un des trois dépôts
ghcr.io/<propriétaire>/suivi-audits-{api,web,updater} ; une image sans référence, ou qui en a une ailleurs, n'est jamais
touchée. Une image est gardée si l'une de ses étiquettes, ou son étiquette OCI org.opencontainers.image.version (posée par la
publication), désigne une version gardée, si l'une de ses empreintes est épinglée dans un des fichiers --env (API_IMAGE,
WEB_IMAGE, UPDATER_IMAGE), ou si un conteneur (même arrêté) l'utilise. Le retrait se fait référence par référence, sans
forcer : le moteur refuse de toute façon une image utilisée. Aucune autre commande, aucun « prune » global.
"""
import argparse
import json
import re
import subprocess
import sys

DEPOT = "ghcr.io/yousername-ha/suivi-audits"
COMPOSANTS = ("api", "web", "updater")
DEPOTS = frozenset(f"{DEPOT}-{c}" for c in COMPOSANTS)
EPINGLES = {"API_IMAGE": "api", "WEB_IMAGE": "web", "UPDATER_IMAGE": "updater"}
ETIQUETTE_VERSION = "org.opencontainers.image.version"
SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
VERSION = re.compile(r"^[\w.-]{1,40}$")
EMPREINTE = re.compile(r"^sha256:[a-f0-9]{64}$")


class Echec(Exception):
    pass


def docker(*args, timeout=120):
    try:
        resultat = subprocess.run(["docker", *args], capture_output=True, text=True, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise Echec("moteur Docker injoignable") from None
    if resultat.returncode:
        raise Echec("commande Docker en échec")
    return resultat.stdout


def depot(reference):
    """Dépôt d'une référence « depot:etiquette » ou « depot@sha256:… » (le registre ghcr.io n'a pas de port)."""
    if "@" in reference:
        return reference.split("@", 1)[0]
    return reference.rsplit(":", 1)[0] if ":" in reference else reference


def references(image):
    tags = [r for r in (image.get("RepoTags") or []) if isinstance(r, str) and not r.endswith(":<none>")]
    digests = [r for r in (image.get("RepoDigests") or []) if isinstance(r, str)]
    return tags, digests


def de_l_application(image):
    tags, digests = references(image)
    refs = tags + digests
    return bool(refs) and all(depot(r) in DEPOTS for r in refs)


def versions(image):
    tags, _ = references(image)
    result = {t.rsplit(":", 1)[1] for t in tags if ":" in t}
    label = ((image.get("Config") or {}).get("Labels") or {}).get(ETIQUETTE_VERSION)
    if isinstance(label, str) and label:
        result.add(label)
    return result


def cle(version):
    return tuple(int(x) for x in version.split("."))


def images():
    ids = sorted(set(docker("image", "ls", "-a", "--no-trunc", "--format", "{{.ID}}").split()))
    if not ids:
        return []
    data = json.loads(docker("image", "inspect", *ids))
    if not isinstance(data, list):
        raise Echec("réponse du moteur inattendue")
    return [i for i in data if isinstance(i, dict) and isinstance(i.get("Id"), str)]


def utilisees():
    """Images utilisées par un conteneur, même arrêté (identifiants)."""
    conteneurs = docker("ps", "-a", "-q", "--no-trunc").split()
    if not conteneurs:
        return set()
    data = json.loads(docker("container", "inspect", *conteneurs))
    return {c.get("Image") for c in data if isinstance(c, dict) and isinstance(c.get("Image"), str)}


def epingles(fichiers):
    """Empreintes épinglées (API_IMAGE, WEB_IMAGE, UPDATER_IMAGE) des fichiers .env donnés ; un fichier absent est ignoré."""
    result = set()
    for fichier in fichiers:
        try:
            lignes = open(fichier, encoding="utf8").read().splitlines()
        except OSError:
            continue
        for ligne in lignes:
            if "=" not in ligne or ligne.lstrip().startswith("#"):
                continue
            nom, valeur = ligne.split("=", 1)
            composant = EPINGLES.get(nom.strip())
            valeur = valeur.strip().strip("\"'")
            if composant and depot(valeur) == f"{DEPOT}-{composant}" and EMPREINTE.fullmatch(valeur.split("@", 1)[-1]):
                result.add(valeur)
    return result


def taille():
    return sum(int(i.get("Size") or 0) for i in images() if de_l_application(i))


def precedente_de(en_service, liste):
    """Plus récente version numérotée présente, antérieure à celle en service (None si aucune ou version non numérotée)."""
    if not SEMVER.fullmatch(en_service):
        return None
    anterieures = {v for i in liste if de_l_application(i) for v in versions(i)
                   if SEMVER.fullmatch(v) and cle(v) < cle(en_service)}
    return max(anterieures, key=cle) if anterieures else None


def menage(en_service, precedente=None, frontal=None, fichiers_env=(), simulation=False):
    """Références retirées (ou à retirer en simulation), dans l'ordre."""
    liste = images()
    if precedente is None:
        precedente = precedente_de(en_service, liste)
    gardees = {v for v in (en_service, precedente, frontal) if v}
    pins = epingles(fichiers_env)
    en_usage = utilisees()
    retirees = []
    for image in liste:
        if not de_l_application(image) or image["Id"] in en_usage:
            continue
        tags, digests = references(image)
        if versions(image) & gardees or set(digests) & pins:
            continue
        for reference in tags + digests:
            if simulation:
                retirees.append(reference)
                continue
            try:
                docker("image", "rm", reference)
                retirees.append(reference)
            except Echec:
                pass  # déjà retirée avec la référence précédente, ou refusée par le moteur (image utilisée)
    return retirees


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sous = parser.add_subparsers(dest="commande", required=True)
    sous.add_parser("taille")
    m = sous.add_parser("menage")
    m.add_argument("--en-service", required=True)
    m.add_argument("--precedente")
    m.add_argument("--frontal")
    m.add_argument("--env", action="append", default=[])
    m.add_argument("--simulation", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.commande == "taille":
            print(taille())
            return 0
        for v in (args.en_service, args.precedente, args.frontal):
            if v is not None and not VERSION.fullmatch(v):
                print("Version invalide.", file=sys.stderr)
                return 2
        for reference in menage(args.en_service, args.precedente, args.frontal, args.env, args.simulation):
            print(("À retirer : " if args.simulation else "Image retirée : ") + reference)
        return 0
    except (Echec, ValueError, TypeError) as erreur:
        print(f"Images de l'application : {erreur}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

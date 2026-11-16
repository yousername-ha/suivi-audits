#!/usr/bin/env python3
"""Appel en lecture seule d'un outil externe pour le module Intégrations (ADR 0076, point 5 ; ADR 0100, point 6).

Lancé par l'exécutant d'exploitation du serveur (scripts/exploitation-worker.py) sous un compte sans privilège, par
`python -I`, avec un environnement minimal et un délai borné, jamais par l'API (qui reste sans accès réseau sortant).
Bibliothèque standard seule.

Entrée : un objet JSON sur l'entrée standard (type, opération, configuration, secrets) ; ni argument ni variable
d'environnement ne porte de secret. Sortie : un objet JSON {ok, resultat, erreur} sur la sortie standard, normalisé et
borné ; il ne contient jamais de secret ni de contenu de réponse, et l'erreur tient sur une ligne.

Règles :
- HTTPS seulement, certificat toujours vérifié (autorité fournie, sinon magasin du système), TLS 1.2 au minimum ;
- aucune redirection suivie (http.client ne les suit pas ; un code 3xx est une erreur) ;
- seuls les couples méthode/chemin de la liste fermée du type sont émis : POINTS_ACCES, recopiée de
  packages/shared/src/integrations.ts et comparée par apps/api/test/integrations-architecture.test.ts ;
- réponse bornée en taille ; seule la donnée attendue en est extraite (Tenable, « tester » : la version, rien d'autre).
"""
import http.client
import json
import re
import socket
import ssl
import sys

# Liste fermée des points d'accès de lecture, par type (méthode, chemin exact ou motif dont {uuid} est la seule partie
# variable). Une seule ligne JSON : le test d'architecture la lit telle quelle.
POINTS_ACCES = {"tenable": [["POST", "/rest/analysis"], ["GET", "/rest/hosts"], ["GET", "/rest/hosts/{uuid}"], ["GET", "/rest/system"]]}
OPERATIONS = {"tenable": ["tester"]}
ENTREE_MAX = 65536
REPONSE_MAX = 1024 * 1024
ERREUR_MAX = 300
DELAI_MIN, DELAI_MAX = 5, 60
UUID = "[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}"
HOTE = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$|^\[[0-9a-f:.]+\]$")
ADRESSE = re.compile(r"^https://([^/?#@\s\\]+)/?$")
CLE_API = re.compile(r"^[A-Za-z0-9]{16,128}$")
VERSION_TENABLE = re.compile(r"^[0-9]{1,4}(?:\.[0-9]{1,6}){0,4}$")


class Refus(Exception):
    """Erreur expliquée, sans secret ni contenu de réponse."""


def point_admis(type_, methode, chemin):
    for m, motif in POINTS_ACCES.get(type_, ()):
        regle = "^" + UUID.join(re.escape(s) for s in motif.split("{uuid}")) + "$"
        if m == methode and re.fullmatch(regle, chemin):
            return True
    return False


def hote_et_port(adresse):
    """Adresse https://hote (port 443 seulement), sans identifiant, chemin, paramètre ni fragment."""
    m = ADRESSE.fullmatch(adresse or "") if isinstance(adresse, str) else None
    if not m:
        raise Refus("Adresse refusée : https://serveur attendu, sans chemin, paramètre ni identifiant.")
    hote, port = m.group(1).lower(), 443
    if not hote.startswith("[") and ":" in hote:
        hote, brut = hote.rsplit(":", 1)
        if brut != "443":
            raise Refus("Adresse refusée : port 443 seulement.")
    if not HOTE.fullmatch(hote):
        raise Refus("Adresse refusée : nom d'hôte invalide.")
    return hote.strip("[]"), port


def contexte(ca):
    """Certificat toujours vérifié : autorité fournie (PEM) ou magasin du système ; TLS 1.2 au minimum."""
    ctx = ssl.create_default_context(cadata=ca or None)
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.check_hostname = True
    ctx.verify_mode = ssl.CERT_REQUIRED
    return ctx


def explication(erreur):
    if isinstance(erreur, Refus):
        return str(erreur)
    if isinstance(erreur, socket.gaierror):
        return "Nom d'hôte introuvable depuis le serveur (DNS). Vérifiez l'adresse saisie."
    if isinstance(erreur, ConnectionRefusedError):
        return "Connexion refusée : le service n'écoute pas sur ce port, ou un pare-feu la refuse."
    if isinstance(erreur, (TimeoutError, socket.timeout)):
        return "Délai dépassé : le service ne répond pas (pare-feu, adresse ou délai à revoir)."
    if isinstance(erreur, ssl.SSLCertVerificationError):
        return "Certificat du service refusé (%s). Il doit correspondre à l'adresse et être signé par une autorité reconnue (ou ajoutée dans la configuration)." % (erreur.verify_message or "vérification impossible")
    if isinstance(erreur, ssl.SSLError):
        return "Échec de la négociation TLS (%s)." % (erreur.reason or "erreur TLS")
    if isinstance(erreur, http.client.HTTPException):
        return "Réponse HTTP illisible."
    if isinstance(erreur, OSError):
        return "Réseau injoignable depuis le serveur (%s)." % (erreur.strerror or type(erreur).__name__)
    return "Échec de l'appel (%s)." % type(erreur).__name__


def une_ligne(texte):
    texte = re.sub(r"[\x00-\x1f\x7f]+", " ", str(texte)).strip() or "Erreur sans détail."
    return texte[:ERREUR_MAX]


class Client:
    """Client HTTPS d'un seul hôte, limité à la liste fermée du type. Aucune redirection n'est suivie."""

    def __init__(self, type_, configuration, en_tetes):
        self.type = type_
        self.hote, self.port = hote_et_port(configuration.get("adresse"))
        ca = configuration.get("autoriteCertification") or ""
        if not isinstance(ca, str) or len(ca) > 20000:
            raise Refus("Autorité de certification illisible.")
        try:
            self.contexte = contexte(ca.strip())
        except (ssl.SSLError, ValueError):
            raise Refus("Autorité de certification illisible : certificat PEM attendu.") from None
        delai = configuration.get("delaiSecondes", 30)
        if not isinstance(delai, int) or isinstance(delai, bool) or not DELAI_MIN <= delai <= DELAI_MAX:
            raise Refus("Délai invalide.")
        self.delai = delai
        self.en_tetes = en_tetes

    def requete(self, methode, chemin, corps=None):
        if not point_admis(self.type, methode, chemin):
            raise Refus("Appel refusé : %s %s hors de la liste fermée du connecteur." % (methode, chemin[:80]))
        donnees = None if corps is None else json.dumps(corps).encode("utf-8")
        connexion = http.client.HTTPSConnection(self.hote, self.port, timeout=self.delai, context=self.contexte)
        try:
            en_tetes = {"Accept": "application/json", "User-Agent": "suivi-audits-integrations", **self.en_tetes}
            if donnees is not None:
                en_tetes["Content-Type"] = "application/json"
            connexion.request(methode, chemin, body=donnees, headers=en_tetes)
            reponse = connexion.getresponse()
            if 300 <= reponse.status < 400:
                raise Refus("Redirection refusée (code %d) : l'adresse réglée doit être celle du service, sans redirection." % reponse.status)
            if reponse.status in (401, 403):
                raise Refus("Accès refusé par le service (code %d) : vérifiez les clés et les droits du compte." % reponse.status)
            if reponse.status != 200:
                raise Refus("Réponse inattendue du service (code %d)." % reponse.status)
            longueur = reponse.getheader("Content-Length")
            if longueur is not None and (not longueur.strip().isdigit() or int(longueur) > REPONSE_MAX):
                raise Refus("Réponse trop volumineuse : refusée.")
            brut = reponse.read(REPONSE_MAX + 1)
            if len(brut) > REPONSE_MAX:
                raise Refus("Réponse trop volumineuse : refusée.")
        finally:
            connexion.close()
        try:
            return json.loads(brut.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise Refus("Réponse illisible : JSON attendu.") from None


# ------------------------------------------------------------------ Tenable Security Center
def cles_tenable(secrets):
    acces, secret = secrets.get("accessKey"), secrets.get("secretKey")
    if not (isinstance(acces, str) and CLE_API.fullmatch(acces) and isinstance(secret, str) and CLE_API.fullmatch(secret)):
        raise Refus("Clés d'API absentes ou de forme invalide.")
    return {"x-apikey": "accesskey=%s; secretkey=%s;" % (acces, secret)}


def reponse_tenable(donnees):
    """Enveloppe de Tenable Security Center : {type, response, error_code, error_msg, …}. Le message d'erreur n'est jamais
    repris (contenu de réponse) : seul son code numérique l'est."""
    if not isinstance(donnees, dict):
        raise Refus("Réponse de Tenable illisible.")
    code = donnees.get("error_code", 0)
    if code not in (0, None):
        raise Refus("Tenable a renvoyé une erreur (code %s)." % (code if isinstance(code, int) else "inconnu"))
    contenu = donnees.get("response")
    if not isinstance(contenu, dict):
        raise Refus("Réponse de Tenable illisible.")
    return contenu


def tenable_tester(client):
    """GET /rest/system : seule la version sort. Licence, code d'activation et tout autre champ sont ignorés."""
    version = reponse_tenable(client.requete("GET", "/rest/system")).get("version")
    if not isinstance(version, str) or not VERSION_TENABLE.fullmatch(version):
        raise Refus("Version de Tenable absente ou de forme inattendue.")
    return {"version": version}


TYPES = {"tenable": (cles_tenable, {"tester": tenable_tester})}


def executer(p):
    try:
        if not isinstance(p, dict):
            raise Refus("Demande illisible.")
        type_, operation = p.get("type"), p.get("operation")
        if type_ not in TYPES or operation not in OPERATIONS.get(type_, ()):
            raise Refus("Type ou opération inconnu : rien n'a été appelé.")
        configuration, secrets = p.get("configuration"), p.get("secrets")
        if not isinstance(configuration, dict) or not isinstance(secrets, dict):
            raise Refus("Demande illisible.")
        en_tetes, operations = TYPES[type_]
        client = Client(type_, configuration, en_tetes(secrets))
        return {"ok": True, "resultat": operations[operation](client), "erreur": None}
    except Exception as erreur:  # noqa: BLE001 - tout échec est expliqué, jamais propagé avec ses détails
        return {"ok": False, "resultat": None, "erreur": une_ligne(explication(erreur))}


def main():
    brut = sys.stdin.read(ENTREE_MAX + 1)
    try:
        p = json.loads(brut) if len(brut) <= ENTREE_MAX else None
    except ValueError:
        p = None
    sys.stdout.write(json.dumps(executer(p), ensure_ascii=True))


if __name__ == "__main__":
    main()

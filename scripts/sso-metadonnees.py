#!/usr/bin/env python3
"""Lecture des métadonnées d'un fournisseur d'identité SAML pour la connexion unique (ADR 0114 ; décision du RSSI du 25/11/2026).

Lancé par l'exécutant d'exploitation du serveur (scripts/exploitation-worker.py) sous un compte sans privilège, par
`python -I`, avec un environnement minimal et un délai borné, jamais par l'API (qui reste sans accès réseau sortant).
Bibliothèque standard seule.

Entrée : un objet JSON sur l'entrée standard {type, url, autorite} ; aucun secret. Sortie : {ok: true, contenu} (document reçu,
en base64) ou {ok: false, erreur} (une ligne). Le document n'est PAS analysé ici : l'API le contrôle (XML durci, signature,
entityID, adresse de connexion, certificats).

Règles :
- HTTPS seulement, certificat et nom toujours vérifiés (autorités du système, plus l'autorité facultative du fournisseur pour
  cette seule lecture), TLS 1.2 au minimum ;
- adresse sans identifiant ni mot de passe ; pour Microsoft Entra ID, l'hôte login.microsoftonline.com seulement (port 443) ;
- GET seulement, aucune redirection suivie (http.client ne les suit pas ; un code 3xx est une erreur) ;
- réponse bornée (REPONSE_MAX) ; aucun mandataire dans ce lot (accès direct).
"""
import base64
import http.client
import json
import re
import socket
import ssl
import sys

ENTREE_MAX = 65536
REPONSE_MAX = 1024 * 1024
ERREUR_MAX = 300
DELAI = 20
TYPES = ("entra", "keycloak", "saml")
HOTE_ENTRA = "login.microsoftonline.com"
ADRESSE = re.compile(r"^https://([^/?#@\s\\]+)(/[^#\s]*)?$")
HOTE = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
CONTROLE = re.compile(r"[\x00-\x1f\x7f]")


class Refus(Exception):
    """Erreur expliquée, sans contenu de réponse."""


def une_ligne(texte):
    return CONTROLE.sub(" ", str(texte)).strip()[:ERREUR_MAX] or "Erreur sans détail."


def lire_demande(brut):
    if len(brut) > ENTREE_MAX:
        raise Refus("Demande trop volumineuse : rien n'a été lu.")
    try:
        d = json.loads(brut)
    except ValueError:
        raise Refus("Demande illisible : rien n'a été lu.") from None
    if not isinstance(d, dict) or set(d) != {"type", "url", "autorite"}:
        raise Refus("Demande illisible : rien n'a été lu.")
    type_, url, autorite = d["type"], d["url"], d["autorite"]
    if type_ not in TYPES or not isinstance(url, str) or not (autorite is None or isinstance(autorite, str)):
        raise Refus("Demande illisible : rien n'a été lu.")
    m = ADRESSE.match(url)
    if not m:
        raise Refus("Adresse refusée : https:// sans identifiant ni mot de passe attendu.")
    hote_port = m.group(1).lower()
    hote, _, port = hote_port.partition(":")
    if not HOTE.match(hote) or (port and (not port.isdigit() or not 1 <= int(port) <= 65535)):
        raise Refus("Adresse refusée : hôte ou port invalide.")
    if type_ == "entra" and hote_port != HOTE_ENTRA:
        raise Refus("Adresse refusée : pour Microsoft Entra ID, seul %s est joint." % HOTE_ENTRA)
    return {"hote": hote, "port": int(port) if port else 443, "chemin": m.group(2) or "/", "autorite": autorite}


def contexte(autorite):
    c = ssl.create_default_context()
    c.minimum_version = ssl.TLSVersion.TLSv1_2
    if autorite:
        try:
            c.load_verify_locations(cadata=autorite)
        except (ssl.SSLError, ValueError):
            raise Refus("Autorité de certification du fournisseur illisible.") from None
    return c


def lire(demande, delai=DELAI):
    connexion = http.client.HTTPSConnection(demande["hote"], demande["port"], timeout=delai, context=contexte(demande["autorite"]))
    try:
        try:
            connexion.request("GET", demande["chemin"], headers={"Accept": "application/samlmetadata+xml, application/xml, text/xml", "User-Agent": "suivi-audits-sso"})
            r = connexion.getresponse()
        except ssl.SSLCertVerificationError:
            raise Refus("Certificat du serveur du fournisseur refusé (autorité inconnue ou nom différent).") from None
        except socket.gaierror:
            raise Refus("Nom du fournisseur introuvable depuis le serveur (DNS).") from None
        except ConnectionRefusedError:
            raise Refus("Connexion refusée par le fournisseur (port fermé ou pare-feu).") from None
        except (socket.timeout, TimeoutError):
            raise Refus("Délai dépassé : le fournisseur ne répond pas (pare-feu ou service indisponible).") from None
        except (OSError, http.client.HTTPException) as e:
            raise Refus("Connexion au fournisseur impossible (%s)." % type(e).__name__) from None
        if 300 <= r.status < 400:
            raise Refus("Redirection refusée (code %d) : indiquez l'adresse finale des métadonnées." % r.status)
        if r.status != 200:
            raise Refus("Réponse inattendue du fournisseur (code %d)." % r.status)
        corps = r.read(REPONSE_MAX + 1)
        if len(corps) > REPONSE_MAX:
            raise Refus("Métadonnées trop volumineuses (plus de 1 Mio).")
        if not corps:
            raise Refus("Métadonnées vides.")
        return corps
    finally:
        connexion.close()


def main():
    try:
        demande = lire_demande(sys.stdin.read(ENTREE_MAX + 1))
        sortie = {"ok": True, "contenu": base64.b64encode(lire(demande)).decode("ascii")}
    except Refus as e:
        sortie = {"ok": False, "erreur": une_ligne(e)}
    except Exception:  # noqa: BLE001 - aucune trace ni contenu ne sort
        sortie = {"ok": False, "erreur": "Lecture impossible (erreur interne du script)."}
    sys.stdout.write(json.dumps(sortie))


if __name__ == "__main__":
    main()

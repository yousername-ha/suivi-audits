#!/usr/bin/env python3
"""Appel en lecture seule d'un outil externe pour le module Intégrations (ADR 0076, point 5 ; ADR 0100, point 6 et lot ALH1).

Lancé par l'exécutant d'exploitation du serveur (scripts/exploitation-worker.py) sous un compte sans privilège, par
`python -I`, avec un environnement minimal et un délai borné, jamais par l'API (qui reste sans accès réseau sortant).
Bibliothèque standard seule.

Entrée : un objet JSON sur l'entrée standard (type, opération, configuration, secrets, mandataire facultatif) ; ni argument ni variable
d'environnement ne porte de secret. Sortie : un objet JSON {ok, resultat, erreur} sur la sortie standard, normalisé et
borné ; il ne contient jamais de secret, et l'erreur tient sur une ligne. « synchroniser » ajoute `elements` : les machines,
constats, détections, machines d'inventaire et correctifs regroupés, réduits aux seuls champs listés (CHAMPS_ANALYSE,
CHAMPS_DEPOT pour le dépôt d'une machine, CHAMPS_HOTE, CHAMPS_CORRECTIF), que l'exécutant rapporte par lots bornés.

Règles :
- HTTPS seulement, sur le port réglé (443 par défaut), certificat toujours vérifié (autorité fournie, sinon magasin du système), TLS 1.2 au minimum ;
- aucune redirection suivie (http.client ne les suit pas ; un code 3xx est une erreur) ;
- seuls les couples méthode/chemin de la liste fermée du type sont émis : POINTS_ACCES, recopiée de
  packages/shared/src/integrations.ts et comparée par apps/api/test/integrations-architecture.test.ts ; un paramètre de
  requête n'est admis que s'il figure dans PARAMETRES_ACCES, avec une valeur entière ;
- réponse bornée en taille ; seule la donnée attendue en est extraite (Tenable, « tester » : la version, rien d'autre ;
  « synchroniser » : les champs listés, `pluginText` et tout autre champ étant écartés dès la lecture) ;
- synchronisation bornée : pages, détections, machines d'inventaire et durée (BORNES_SYNCHRO, recopiées de
  packages/shared/src/failles-tenable.ts). Une borne atteinte rend une synchronisation « tronquée », jamais une erreur.

AlgoLightHouse (lot ALH1), service sur Internet de l'éditeur AlgoSecure :
- GET seulement, sur la liste fermée des points d'accès de la version 1 de l'API, en-tête X-API-Key ; jamais POST ni PUT
  (commentaires, statut), jamais les adresses sans /v1, ni /api/contacts ni /api/search ; aucun paramètre de requête ;
- adresse https://<espace>.algolighthouse.fr seulement (ADRESSE_ALH, recopiée du paquet partagé), port 443 ;
- seuls les champs listés sont lus (CHAMPS_*_ALH) ; ne sont jamais lus : la description HTML (`note`), les pièces jointes
  (`uploads`), les commentaires, les données sensibles des fragments (`sensitive_data`, `has_sensitive_data`), le champ
  déprécié `data`, la bannière d'un service (`banner`) ; d'un fragment, seuls `alert_cves` et les champs de service de
  `json_data` sont lus (lot ALH6, CHAMPS_FRAGMENT_ALH et CHAMPS_SERVICE_ALH) ;
- le descriptif ne documente aucune pagination : chaque liste est lue en une réponse, bornée en taille et en nombre
  d'éléments (BORNES_ALH, recopiées de packages/shared/src/surface-externe.ts) ;
- mandataire de l'établissement (ADR 0101), seulement s'il est reçu et seulement pour ce type (TYPES_MANDATAIRE) : tunnel
  CONNECT vers l'espace à travers le mandataire, puis TLS jusqu'à l'éditeur, certificat et nom toujours vérifiés ;
  l'identifiant et le mot de passe ne vont qu'au mandataire (authentification simple seulement) ; l'autorité de
  l'établissement s'ajoute aux autorités du système pour ces seules connexions. Un mandataire reçu pour un connecteur
  interne (Tenable) est refusé : il reste en accès direct, par construction.
"""
import base64
import datetime as dt
import html
import http.client
import ipaddress
import json
import re
import socket
import ssl
import sys
import time
import unicodedata

# Liste fermée des points d'accès de lecture, par type (méthode, chemin exact ou motif dont {uuid} est la seule partie
# variable). Une seule ligne JSON : le test d'architecture la lit telle quelle.
POINTS_ACCES = {"tenable": [["POST", "/rest/analysis"], ["GET", "/rest/hosts"], ["GET", "/rest/hosts/{uuid}"], ["GET", "/rest/system"]], "algolighthouse": [["GET", "/api/v1/health"], ["GET", "/api/v1/version"], ["GET", "/api/v1/alerts"], ["GET", "/api/v1/alerts/{uuid}"], ["GET", "/api/v1/perimeters"], ["GET", "/api/v1/targets/hosts"], ["GET", "/api/v1/targets/domains"], ["GET", "/api/v1/technologies"]]}
PARAMETRES_ACCES = {"tenable": {"GET /rest/hosts": ["limit", "offset"]}, "algolighthouse": {}}
OPERATIONS = {"tenable": ["tester", "synchroniser"], "algolighthouse": ["tester", "synchroniser"]}
# Types qui sortent vers Internet et peuvent passer par le mandataire de l'établissement (USAGE_MANDATAIRE « utilise » du
# paquet partagé) ; tout autre type le refuse.
TYPES_MANDATAIRE = ["algolighthouse"]
BORNES_ALH = {"reponseListe": 16777216, "reponseDetail": 2097152, "reponseCourte": 65536, "perimetres": 500, "alertes": 5000, "hotes": 10000, "domaines": 10000, "technologies": 2000, "details": 300, "versionsParTechnologie": 50, "actifsParVersion": 200, "cvesParVersion": 200, "cvesParAlerte": 200, "liensTechnologies": 20000, "cvesTechnologies": 20000, "dureeSecondes": 480, "titre": 300, "nomPerimetre": 200, "valeurCible": 300, "domaine": 253, "fai": 200, "nomTechnologie": 200, "editeur": 100, "produit": 100, "version": 100, "cleTechnologie": 410, "titreCve": 300, "severite": 20, "defautsParAlerte": 20, "resolutionsParDefaut": 10, "nomDefaut": 300, "descriptionDefaut": 4000, "niveauResolution": 60, "servicesParAlerte": 50, "portsParComposant": 20, "nomService": 100, "cpe": 300, "lot": 500, "lots": 200}
BORNES_SYNCHRO = {"pageAnalyse": 200, "pagesAnalyse": 100, "detections": 20000, "pageMachines": 500, "pagesMachines": 20, "dureeSecondes": 480, "reponseAnalyse": 8388608, "reponseMachines": 4194304, "cvesParConstat": 500, "nomControle": 300, "famille": 100, "synopsis": 1000, "correctif": 2000, "libelleExploit": 100, "voirAussi": 500, "nomMachine": 255, "systeme": 200, "exposition": 40, "nomDepot": 200, "correctifs": 5000, "pagesCorrectifs": 25, "controlesParCorrectif": 1000, "identifiantCorrectif": 64, "lot": 500, "lots": 200}
ENTREE_MAX = 65536
REPONSE_MAX = 1024 * 1024
ERREUR_MAX = 300
DELAI_MIN, DELAI_MAX = 5, 60
UUID = "[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}"
HOTE = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$|^\[[0-9a-f:.]+\]$")
ADRESSE = re.compile(r"^https://([^/?#@\s\\]+)/?$")
CLE_API = re.compile(r"^[A-Za-z0-9]{16,128}$")
VERSION_TENABLE = re.compile(r"^[0-9]{1,4}(?:\.[0-9]{1,6}){0,4}$")
ADRESSE_ALH = re.compile(r"^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.algolighthouse\.fr$")
CLE_API_ALH = re.compile(r"^[A-Za-z0-9._~+/=-]{16,256}$")
VERSION_ALH = re.compile(r"^[0-9]{1,4}(?:\.[0-9]{1,6}){0,4}$")
# Mandataire : champs reçus (recopiés de scripts/exploitation-worker.py), réponse à la demande de tunnel bornée.
MANDATAIRE_CHAMPS = ("hote", "port", "identifiant", "motDePasse", "autorite")
TUNNEL_REPONSE_MAX = 16 * 1024
NOM_HOTE = re.compile(r"^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$")
CONTROLE = re.compile(r"[\x00-\x1f\x7f]")
SEULE_BASIC = "Seule l'authentification simple (Basic) est prise en charge ; NTLM et Kerberos ne le sont pas."


# Profondeur d'imbrication admise dans une réponse JSON. Selon la version et la construction de Python, un JSON très
# imbriqué est refusé par l'analyseur (RecursionError) ou accepté : la borne est donc posée ici, avant l'analyse, pour que
# le refus ne dépende pas de l'environnement. Les sources lues n'approchent pas cette profondeur.
PROFONDEUR_JSON_MAX = 64
CHAINE_JSON = re.compile(rb'"(?:[^"\\]|\\.)*"')
HORS_CROCHETS = bytes(c for c in range(256) if c not in b"[]{}")


def trop_imbrique(brut):
    """Vrai si le JSON dépasse PROFONDEUR_JSON_MAX niveaux. Les crochets et accolades écrits dans une chaîne ne comptent pas."""
    profondeur = 0
    for c in CHAINE_JSON.sub(b"", brut).translate(None, HORS_CROCHETS):
        if c in (91, 123):
            profondeur += 1
            if profondeur > PROFONDEUR_JSON_MAX:
                return True
        elif profondeur:
            profondeur -= 1
    return False


class Refus(Exception):
    """Erreur expliquée, sans secret ni contenu de réponse."""


class ReponseInattendue(Refus):
    """Code HTTP inattendu (ni 200, ni redirection, ni refus d'accès) : le code seul est gardé."""

    def __init__(self, code):
        super().__init__("Réponse inattendue du service (code %d)." % code)
        self.code = code


def point_admis(type_, methode, chemin):
    for m, motif in POINTS_ACCES.get(type_, ()):
        regle = "^" + UUID.join(re.escape(s) for s in motif.split("{uuid}")) + "$"
        if m == methode and re.fullmatch(regle, chemin):
            return True
    return False


def hote_et_port(adresse):
    """Adresse https://hote ou https://hote:port (port de 1 à 65535, 443 par défaut ; décision du RSSI du 16/11/2026), sans
    identifiant, chemin, paramètre ni fragment."""
    m = ADRESSE.fullmatch(adresse or "") if isinstance(adresse, str) else None
    if not m:
        raise Refus("Adresse refusée : https://serveur attendu, sans chemin, paramètre ni identifiant.")
    hote, port = m.group(1).lower(), 443
    fin_hote = hote.rfind("]") if hote.startswith("[") else -1
    if ":" in hote[fin_hote + 1:]:
        hote, brut = hote.rsplit(":", 1)
        if not (brut.isascii() and brut.isdigit() and len(brut) <= 5 and 1 <= int(brut) <= 65535):
            raise Refus("Adresse refusée : port invalide (un nombre de 1 à 65535).")
        port = int(brut)
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


# ------------------------------------------------------------------ Mandataire de l'établissement (ADR 0101)
def lire_mandataire(m):
    """Paramètres du mandataire reçus sur l'entrée standard : None s'il n'y en a pas, sinon forme stricte (hôte nom ou adresse
    IP, port, identifiant sans deux-points, mot de passe, autorité PEM facultative). Le contenu n'est jamais repris dans une
    erreur. Même règle que le script de la veille."""
    if m is None:
        return None
    illisible = Refus("Paramètres du mandataire illisibles : rien n'a été appelé.")
    if not isinstance(m, dict) or set(m) != set(MANDATAIRE_CHAMPS):
        raise illisible
    hote, port, identifiant, mot_de_passe, autorite = (m[k] for k in MANDATAIRE_CHAMPS)
    if not all(isinstance(x, str) for x in (hote, identifiant, mot_de_passe, autorite)):
        raise illisible
    if not isinstance(port, int) or isinstance(port, bool) or not 1 <= port <= 65535:
        raise illisible
    try:
        ipaddress.ip_address(hote)
    except ValueError:
        if re.fullmatch(r"[0-9.]+", hote) or not NOM_HOTE.fullmatch(hote):
            raise illisible from None
    if (len(identifiant) > 255 or ":" in identifiant or CONTROLE.search(identifiant) or len(mot_de_passe) > 500
            or CONTROLE.search(mot_de_passe) or len(autorite) > 20000
            or (autorite.strip() and "-----BEGIN CERTIFICATE-----" not in autorite)):
        raise illisible
    return {"hote": hote, "port": port, "identifiant": identifiant, "motDePasse": mot_de_passe, "autorite": autorite.strip()}


def nom_mandataire(m):
    return ("[%s]:%d" if ":" in m["hote"] else "%s:%d") % (m["hote"], m["port"])


def lire_reponse_tunnel(sock):
    """Ligne d'état et en-têtes de la réponse du mandataire à CONNECT, lus octet par octet jusqu'à la ligne vide : rien de
    la suite (le chiffré du service) n'est consommé. Renvoie (code, schémas d'authentification proposés)."""
    brut = b""
    while not brut.endswith(b"\r\n\r\n"):
        octet = sock.recv(1)
        if not octet:
            raise Refus("Le mandataire a fermé la connexion pendant la demande de tunnel.")
        brut += octet
        if len(brut) > TUNNEL_REPONSE_MAX:
            raise Refus("Réponse du mandataire à la demande de tunnel illisible (trop longue).")
    lignes = brut.decode("latin-1").split("\r\n")
    m = re.fullmatch(r"HTTP/1\.[01] (\d{3})(?: .*)?", lignes[0])
    if not m:
        raise Refus("Réponse du mandataire à la demande de tunnel illisible.")
    schemas = []
    for ligne in lignes[1:]:
        nom, _, valeur = ligne.partition(":")
        if nom.strip().lower() == "proxy-authenticate":
            schema = valeur.strip().split(" ", 1)[0]
            if re.fullmatch(r"[A-Za-z0-9-]{1,20}", schema) and schema not in schemas and len(schemas) < 4:
                schemas.append(schema)
    return int(m.group(1)), schemas


def ouvrir_tunnel(m, hote, port, delai):
    """Tunnel CONNECT vers hote:port à travers le mandataire ; l'authentification simple n'est envoyée qu'au mandataire.
    Renvoie la connexion ouverte, prête pour TLS vers le service. Chaque échec est expliqué sur une ligne, sans secret."""
    try:
        sock = socket.create_connection((m["hote"], m["port"]), timeout=delai)
    except socket.gaierror:
        raise Refus("Mandataire injoignable : nom %s introuvable depuis le serveur (DNS)." % m["hote"]) from None
    except ConnectionRefusedError:
        raise Refus("Mandataire injoignable : connexion refusée sur %s (le mandataire n'écoute pas, ou un pare-feu la refuse)." % nom_mandataire(m)) from None
    except (TimeoutError, socket.timeout):
        raise Refus("Mandataire injoignable : délai dépassé vers %s (pare-feu ou mandataire indisponible)." % nom_mandataire(m)) from None
    except OSError as e:
        raise Refus("Mandataire injoignable : %s (%s)." % (nom_mandataire(m), e.strerror or type(e).__name__)) from None
    try:
        cible = ("[%s]:%d" if ":" in hote else "%s:%d") % (hote, port)
        lignes = ["CONNECT %s HTTP/1.1" % cible, "Host: %s" % cible, "User-Agent: suivi-audits-integrations"]
        if m["identifiant"]:
            jeton = base64.b64encode(("%s:%s" % (m["identifiant"], m["motDePasse"])).encode("utf-8")).decode("ascii")
            lignes.append("Proxy-Authorization: Basic " + jeton)
        sock.sendall(("\r\n".join(lignes) + "\r\n\r\n").encode("ascii"))
        code, schemas = lire_reponse_tunnel(sock)
    except Refus:
        sock.close()
        raise
    except (TimeoutError, socket.timeout):
        sock.close()
        raise Refus("Le mandataire ne répond pas à la demande de tunnel (délai dépassé).") from None
    except OSError as e:
        sock.close()
        raise Refus("Connexion au mandataire interrompue pendant la demande de tunnel (%s)." % (e.strerror or type(e).__name__)) from None
    if 200 <= code < 300:
        return sock
    sock.close()
    if code == 407:
        if not m["identifiant"]:
            raise Refus("Le mandataire exige une authentification (code 407) : renseignez l'identifiant et le mot de passe. " + SEULE_BASIC)
        if schemas and not any(x.lower() == "basic" for x in schemas):
            raise Refus("Authentification refusée par le mandataire (code 407) : il demande %s. %s" % (", ".join(schemas), SEULE_BASIC))
        raise Refus("Authentification refusée par le mandataire (code 407) : vérifiez l'identifiant et le mot de passe. " + SEULE_BASIC)
    raise Refus("Tunnel refusé par le mandataire vers %s (code %d) : la destination n'est peut-être pas autorisée par le mandataire." % (hote, code))


class ConnexionMandataire(http.client.HTTPSConnection):
    """Connexion HTTPS au service à travers un tunnel ouvert sur le mandataire : TLS de bout en bout, certificat et nom du
    service vérifiés par le même contexte qu'en accès direct."""

    def __init__(self, hote, port, delai, contexte_tls, mandataire):
        super().__init__(hote, port, timeout=delai, context=contexte_tls)
        self.contexte_tls = contexte_tls
        self.mandataire = mandataire

    def connect(self):
        brut = ouvrir_tunnel(self.mandataire, self.host, self.port, self.timeout)
        try:
            self.sock = self.contexte_tls.wrap_socket(brut, server_hostname=self.host)
        except ssl.SSLCertVerificationError as e:
            brut.close()
            raise Refus("Certificat du service refusé à travers le mandataire (%s). Si le mandataire inspecte le trafic "
                        "chiffré, fournissez l'autorité de certification de l'établissement dans son réglage."
                        % (e.verify_message or "vérification impossible")) from None
        except BaseException:
            brut.close()
            raise


class Client:
    """Client HTTPS d'un seul hôte, limité à la liste fermée du type. Aucune redirection n'est suivie. Avec un mandataire
    (types de TYPES_MANDATAIRE seulement), chaque connexion passe par un tunnel CONNECT."""

    def __init__(self, type_, configuration, en_tetes, mandataire=None):
        self.type = type_
        if mandataire is not None and type_ not in TYPES_MANDATAIRE:
            raise Refus("Mandataire refusé : ce connecteur est joint directement, jamais par le mandataire.")
        if type_ == "algolighthouse":
            adresse = configuration.get("adresse")
            if not isinstance(adresse, str) or not ADRESSE_ALH.fullmatch(adresse):
                raise Refus("Adresse refusée : https://espace.algolighthouse.fr attendu, sans port, chemin ni identifiant.")
            if "autoriteCertification" in configuration:
                raise Refus("Configuration refusée : pas d'autorité de certification propre pour ce connecteur.")
        self.hote, self.port = hote_et_port(configuration.get("adresse"))
        ca = configuration.get("autoriteCertification") or ""
        if not isinstance(ca, str) or len(ca) > 20000:
            raise Refus("Autorité de certification illisible.")
        try:
            self.contexte = contexte(ca.strip())
        except (ssl.SSLError, ValueError):
            raise Refus("Autorité de certification illisible : certificat PEM attendu.") from None
        self.mandataire = mandataire
        if mandataire and mandataire["autorite"]:
            # Autorité de l'établissement ajoutée aux autorités reconnues, pour les seules connexions par le mandataire.
            try:
                self.contexte.load_verify_locations(cadata=mandataire["autorite"])
            except (ssl.SSLError, ValueError):
                raise Refus("Autorité de certification de l'établissement illisible : rien n'a été appelé.") from None
        delai = configuration.get("delaiSecondes", 30)
        if not isinstance(delai, int) or isinstance(delai, bool) or not DELAI_MIN <= delai <= DELAI_MAX:
            raise Refus("Délai invalide.")
        self.delai = delai
        self.en_tetes = en_tetes

    def requete(self, methode, chemin, corps=None, parametres=None, maximum=REPONSE_MAX):
        if not point_admis(self.type, methode, chemin):
            raise Refus("Appel refusé : %s %s hors de la liste fermée du connecteur." % (methode, chemin[:80]))
        cible = chemin
        if parametres:
            admis = PARAMETRES_ACCES.get(self.type, {}).get("%s %s" % (methode, chemin), [])
            for nom, valeur in parametres.items():
                if nom not in admis or not isinstance(valeur, int) or isinstance(valeur, bool) or not 0 <= valeur <= 10 ** 9:
                    raise Refus("Appel refusé : paramètre %s hors de la liste fermée du connecteur." % str(nom)[:40])
            cible = chemin + "?" + "&".join("%s=%d" % (nom, valeur) for nom, valeur in parametres.items())
        donnees = None if corps is None else json.dumps(corps).encode("utf-8")
        if self.mandataire:
            connexion = ConnexionMandataire(self.hote, self.port, self.delai, self.contexte, self.mandataire)
        else:
            connexion = http.client.HTTPSConnection(self.hote, self.port, timeout=self.delai, context=self.contexte)
        try:
            en_tetes = {"Accept": "application/json", "Accept-Encoding": "identity", "User-Agent": "suivi-audits-integrations", **self.en_tetes}
            if donnees is not None:
                en_tetes["Content-Type"] = "application/json"
            connexion.request(methode, cible, body=donnees, headers=en_tetes)
            reponse = connexion.getresponse()
            if 300 <= reponse.status < 400:
                raise Refus("Redirection refusée (code %d) : l'adresse réglée doit être celle du service, sans redirection." % reponse.status)
            if reponse.status in (401, 403):
                raise Refus("Accès refusé par le service (code %d) : vérifiez les clés et les droits du compte." % reponse.status)
            if reponse.status == 429:
                raise Refus("Limite de débit du service atteinte (code 429) : nouvel essai à la prochaine synchronisation.")
            if reponse.status != 200:
                raise ReponseInattendue(reponse.status)
            longueur = reponse.getheader("Content-Length")
            if longueur is not None and (not longueur.strip().isdigit() or int(longueur) > maximum):
                raise Refus("Réponse trop volumineuse : refusée.")
            brut = reponse.read(maximum + 1)
            if len(brut) > maximum:
                raise Refus("Réponse trop volumineuse : refusée.")
        finally:
            connexion.close()
        if trop_imbrique(brut):
            raise Refus("Réponse illisible : JSON attendu (imbrication excessive).")
        try:
            return json.loads(brut.decode("utf-8"))
        except (UnicodeDecodeError, ValueError, RecursionError):
            raise Refus("Réponse illisible : JSON attendu.") from None


# ------------------------------------------------------------------ Tenable Security Center
def cles_tenable(secrets):
    acces, secret = secrets.get("accessKey"), secrets.get("secretKey")
    if not (isinstance(acces, str) and CLE_API.fullmatch(acces) and isinstance(secret, str) and CLE_API.fullmatch(secret)):
        raise Refus("Clés d'API absentes ou de forme invalide.")
    return {"x-apikey": "accesskey=%s; secretkey=%s;" % (acces, secret)}


def reponse_tenable(donnees, forme=dict):
    """Enveloppe de Tenable Security Center : {type, response, error_code, error_msg, …}. Le message d'erreur n'est jamais
    repris (contenu de réponse) : seul son code numérique l'est. `forme` : objet (analyse, système) ou liste (machines)."""
    if not isinstance(donnees, dict):
        raise Refus("Réponse de Tenable illisible.")
    code = donnees.get("error_code", 0)
    if code not in (0, None):
        raise Refus("Tenable a renvoyé une erreur (code %s)." % (code if isinstance(code, int) else "inconnu"))
    contenu = donnees.get("response")
    if not isinstance(contenu, forme):
        raise Refus("Réponse de Tenable illisible.")
    return contenu


def tenable_tester(client):
    """GET /rest/system : seule la version sort. Licence, code d'activation et tout autre champ sont ignorés."""
    version = reponse_tenable(client.requete("GET", "/rest/system")).get("version")
    if not isinstance(version, str) or not VERSION_TENABLE.fullmatch(version):
        raise Refus("Version de Tenable absente ou de forme inattendue.")
    return {"version": version}


# ------------------------------------------------------------------ Tenable : synchronisation des failles et des machines
# Champs lus dans un résultat de l'analyse `vulndetails` (cadrage, §5 bis) : tout autre champ, `pluginText` d'abord, est
# écarté dès la lecture et ne sort jamais du script. Lot TEN-SCORES (décision du RSSI du 22/11/2026) : `assetExposureScore`
# (AES, score d'exposition de l'actif selon Tenable), seul champ ajouté.
CHAMPS_ANALYSE = ("pluginID", "pluginName", "severity", "family", "synopsis", "solution", "cvssV3Vector", "cvssV3BaseScore",
                  "vprScore", "epssScore", "exploitAvailable", "exploitEase", "exploitFrameworks", "vulnPubDate",
                  "patchPubDate", "seolDate",
                  "seeAlso", "cve", "ip", "dnsName", "netbiosName", "operatingSystem", "hostUUID", "acrScore",
                  "assetExposureScore", "keyDrivers", "firstSeen", "lastSeen", "port", "protocol", "hasBeenMitigated", "acceptRisk", "recastRisk", "repository")
# Lot PRIO-1 : kits d'exploitation que Tenable nomme (« Exploitable with ») dans la CHAÎNE `exploitFrameworks` (pas une liste).
# Seuls ces trois noms sont retenus, comme KITS_EXPLOITATION du paquet partagé ; le reste de la chaîne ne sort jamais.
KITS_EXPLOITATION = (("metasploit", re.compile(r"\bmetasploit\b")), ("core_impact", re.compile(r"\bcore\s+impact\b")),
                     ("canvas", re.compile(r"\bcanvas\b")))


def kits_exploitation(v):
    """Kits cités par `exploitFrameworks` (chaîne), dans l'ordre fixe ; toute autre forme : aucun."""
    t = v.lower() if isinstance(v, str) else ""
    return [k for k, motif in KITS_EXPLOITATION if motif.search(t)]


# Champs lus du dépôt d'un résultat (`repository`, objet ; lot V4d) : identifiant et nom seulement.
CHAMPS_DEPOT = ("id", "name")
# Champs lus dans une machine de l'inventaire (`GET /rest/hosts`, liste directe).
CHAMPS_HOTE = ("uuid", "tenableUUID", "name", "os", "firstSeen", "lastSeen", "ipAddress")
GRAVITES = {"critique": "4", "elevee": "3", "moyenne": "2", "faible": "1"}
GRAVITE_DE_ID = {v: k for k, v in GRAVITES.items()}
GRAVITES_DEFAUT = ["critique", "elevee"]
PLUGIN_ID = re.compile(r"^[1-9]\d{0,8}$")
DEPOT_TENABLE = re.compile(r"^[1-9]\d{0,8}$")
CVE_ID = re.compile(r"^CVE-[12]\d{3}-\d{4,9}$")
UUID_STRICT = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
ADRESSE_IP = re.compile(r"^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}|(?=[0-9a-f:.]*:)[0-9a-f:.]{2,45})$")
NOM_MACHINE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,254}$")
EXPOSITION = re.compile(r"^[a-z][a-z0-9 _-]{0,39}$")
CVSS3_VECTEUR = re.compile(r"^(?:CVSS:3\.[01]\/)?[A-Za-z]{1,3}:[A-Za-z]{1,2}(?:\/[A-Za-z]{1,3}:[A-Za-z]{1,2}){0,20}$")
VOIR_AUSSI = re.compile(r"^https:\/\/[A-Za-z0-9.-]{1,253}(?::\d{1,5})?(?:[/?#][\x21-\x7e]*)?$")
VOIR_AUSSI_INTERDITS = re.compile(r"[\"'<>\\`]")
PROTOCOLE = re.compile(r"^[A-Z0-9]{1,10}$")
BALISE = re.compile(r"<[A-Za-z/!?][^<>]{0,2000}>")
INVISIBLES = ("Cc", "Cf", "Co", "Cs", "Zl", "Zp")
DATE_MAX = 4102444800  # 2100-01-01


def texte(brut, maximum):
    """Texte simple sur une ligne (comme la veille) : balises retirées, entités décodées, caractères de contrôle et de mise en
    forme invisibles remplacés, espaces réduits, longueur bornée. Vide : None."""
    if not isinstance(brut, str):
        return None
    t = brut[: maximum * 20]
    for _ in range(3):
        avant = t
        t = html.unescape(BALISE.sub(" ", t))
        if t == avant:
            break
    t = BALISE.sub(" ", t)
    t = re.sub(r"<(?=[A-Za-z/!?])", "‹", t)
    t = "".join(" " if unicodedata.category(c) in INVISIBLES else c for c in t)
    t = " ".join(t.split())
    if len(t) > maximum:
        t = t[: maximum - 1].rstrip() + "…"
    return t or None


def instant(v):
    """Secondes depuis 1970, en texte ou en nombre ; « -1 », vide ou hors bornes : None."""
    if isinstance(v, bool) or not isinstance(v, (str, int)):
        return None
    v = v.strip() if isinstance(v, str) else str(v)
    if not v.isdigit() or not 0 < int(v) < DATE_MAX:
        return None
    return time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(int(v)))


def decimal(v, minimum, maximum, diviseur=1):
    if isinstance(v, bool) or not isinstance(v, (str, int, float)):
        return None
    try:
        n = float(v)
    except ValueError:
        return None
    if n != n or not minimum <= n <= maximum:
        return None
    return round(n / diviseur, 5 if diviseur != 1 else 1)


def oui(v):
    return isinstance(v, str) and v.strip() in ("1", "Yes", "true")


AES = re.compile(r"^\d{1,4}$")


def score_exposition(v):
    """AES (`assetExposureScore`, lot TEN-SCORES) : entier de 0 à 1000, en texte ou en nombre entier. Vide (Tenable ne le
    calcule pas, par exemple pour un actif non licencié), absent, hors bornes, décimal ou non numérique : None."""
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        n = v
    elif isinstance(v, str) and AES.fullmatch(v.strip()):
        n = int(v.strip())
    else:
        return None
    return n if 0 <= n <= 1000 else None


def adresse_ip(v):
    if not isinstance(v, str):
        return None
    for morceau in v.split(","):
        a = morceau.strip().lower()
        if ADRESSE_IP.fullmatch(a):
            return a
    return None


def nom_machine(v):
    if not isinstance(v, str):
        return None
    n = v.strip().lower()
    if "\\" in n:  # NetBIOS : « DOMAINE\\NOM »
        n = n.rsplit("\\", 1)[1]
    return n if NOM_MACHINE.fullmatch(n) else None


def uuid_strict(v):
    return v.strip().lower() if isinstance(v, str) and UUID_STRICT.fullmatch(v.strip().lower()) else None


def cle_machine(uuid, adresse, nom):
    """Identifiant d'une machine dans sa source (même règle que cleMachine de packages/shared)."""
    if uuid:
        return "uuid:" + uuid
    if not adresse:
        return None
    return "ip:%s|%s" % (adresse, nom) if nom else "ip:" + adresse


def exposition(v):
    """`keyDrivers` est une chaîne JSON : seule la valeur de « internet exposure » en est gardée, si elle est un mot court."""
    if not isinstance(v, str) or len(v) > 4000:
        return None
    try:
        d = json.loads(v)
    except ValueError:
        return None
    e = d.get("internet exposure") if isinstance(d, dict) else None
    e = e.strip().lower() if isinstance(e, str) else None
    return e if e and EXPOSITION.fullmatch(e) else None


def voir_aussi(v):
    if not isinstance(v, str):
        return None
    for lien in v.split():
        if len(lien) <= BORNES_SYNCHRO["voirAussi"] and VOIR_AUSSI.fullmatch(lien) and not VOIR_AUSSI_INTERDITS.search(lien):
            return lien
    return None


def cves(v):
    vues = []
    if isinstance(v, str):
        for morceau in v.split(","):
            c = morceau.strip().upper()
            if CVE_ID.fullmatch(c) and c not in vues:
                vues.append(c)
    borne = BORNES_SYNCHRO["cvesParConstat"]
    return vues[:borne], len(vues) > borne


def nom_objet(v):
    """`severity`, `family` : objets {id, name, …} ; seul le champ demandé est lu."""
    return v if isinstance(v, dict) else {}


def depot(v):
    """Dépôt d'un résultat (`repository` : objet {id, name, …}) : identifiant entier positif et nom nettoyé, rien d'autre.
    Forme inattendue : None (la machine garde son dépôt rangé)."""
    if not isinstance(v, dict):
        return None
    d = {k: v[k] for k in CHAMPS_DEPOT if k in v}
    ident = d.get("id")
    ident = str(ident).strip() if isinstance(ident, (str, int)) and not isinstance(ident, bool) else ""
    nom = texte(d.get("name"), BORNES_SYNCHRO["nomDepot"])
    if not DEPOT_TENABLE.fullmatch(ident) or not nom:
        return None
    return {"id": ident, "nom": nom}


def lire_resultat(brut, sortie, bilan):
    """Un résultat de `vulndetails` : réduit d'abord aux champs listés, puis réparti en machine, constat et détection."""
    if not isinstance(brut, dict):
        bilan["ecartes"] += 1
        return
    r = {k: brut[k] for k in CHAMPS_ANALYSE if k in brut}
    plugin = r.get("pluginID").strip() if isinstance(r.get("pluginID"), str) else None
    gravite = GRAVITE_DE_ID.get(str(nom_objet(r.get("severity")).get("id", "")).strip())
    nom = texte(r.get("pluginName"), BORNES_SYNCHRO["nomControle"])
    uuid = uuid_strict(r.get("hostUUID"))
    adresse = adresse_ip(r.get("ip"))
    nom_m = nom_machine(r.get("dnsName")) or nom_machine(r.get("netbiosName"))
    cle = cle_machine(uuid, adresse, nom_m)
    if not plugin or not PLUGIN_ID.fullmatch(plugin) or not gravite or not nom or not cle:
        bilan["ecartes"] += 1
        return
    premiere, derniere = instant(r.get("firstSeen")), instant(r.get("lastSeen"))
    d = depot(r.get("repository"))
    m = sortie["machines"].get(cle)
    if m is None:
        # ACR et AES (lot TEN-SCORES) : ceux du premier résultat lu pour la machine dans la synchronisation.
        acr = decimal(r.get("acrScore"), 0, 10)
        m = sortie["machines"][cle] = {
            "type": "machine", "cle": cle, "uuid": uuid, "nom": nom_m, "adresse": adresse,
            "systeme": texte(r.get("operatingSystem"), BORNES_SYNCHRO["systeme"]),
            "premiere": premiere, "derniere": derniere, "exposition": exposition(r.get("keyDrivers")), "acr": acr,
            "aes": score_exposition(r.get("assetExposureScore")), "depot": d,
        }
    else:
        if premiere and (not m["premiere"] or premiere < m["premiere"]):
            m["premiere"] = premiere
        if derniere and (not m["derniere"] or derniere > m["derniere"]):
            m["derniere"] = derniere
        # Machine vue dans plusieurs dépôts : le plus petit identifiant, pour un choix stable d'une synchronisation à l'autre.
        if d and (not m["depot"] or int(d["id"]) < int(m["depot"]["id"])):
            m["depot"] = d
    if plugin not in sortie["constats"]:
        liste, tronquees = cves(r.get("cve"))
        vecteur = r.get("cvssV3Vector").strip() if isinstance(r.get("cvssV3Vector"), str) else ""
        sortie["constats"][plugin] = {
            "type": "constat", "plugin": plugin, "nom": nom, "gravite": gravite,
            "famille": texte(nom_objet(r.get("family")).get("name"), BORNES_SYNCHRO["famille"]),
            "synopsis": texte(r.get("synopsis"), BORNES_SYNCHRO["synopsis"]),
            "correctif": texte(r.get("solution"), BORNES_SYNCHRO["correctif"]),
            "cvss3Vecteur": vecteur if len(vecteur) <= 200 and CVSS3_VECTEUR.fullmatch(vecteur) else None,
            "cvss3Score": decimal(r.get("cvssV3BaseScore"), 0, 10),
            "vpr": decimal(r.get("vprScore"), 0, 10),
            # Tenable rend le score EPSS en pourcentage (0 à 100) ; la plateforme le range entre 0 et 1, comme la veille.
            "epss": decimal(r.get("epssScore"), 0, 100, diviseur=100),
            "exploitable": isinstance(r.get("exploitAvailable"), str) and r["exploitAvailable"].strip() == "Yes",
            "exploitLibelle": texte(r.get("exploitEase"), BORNES_SYNCHRO["libelleExploit"]),
            "kitsExploitation": kits_exploitation(r.get("exploitFrameworks")),
            "failleLe": instant(r.get("vulnPubDate")), "correctifLe": instant(r.get("patchPubDate")),
            "finSupportLe": instant(r.get("seolDate")), "voirAussi": voir_aussi(r.get("seeAlso")),
            "cves": liste, "cvesTronquees": tronquees,
        }
    port = r.get("port").strip() if isinstance(r.get("port"), str) else str(r.get("port", ""))
    port = int(port) if port.isdigit() and int(port) <= 65535 else 0
    protocole = r.get("protocol").strip().upper() if isinstance(r.get("protocol"), str) else ""
    protocole = protocole if PROTOCOLE.fullmatch(protocole) else "UNKNOWN"
    sortie["detections"][(plugin, cle, port, protocole)] = {
        "type": "detection", "plugin": plugin, "machine": cle, "port": port, "protocole": protocole,
        "premiere": premiere, "derniere": derniere, "attenue": oui(r.get("hasBeenMitigated")),
        "risqueAccepte": oui(r.get("acceptRisk")), "risqueRequalifie": oui(r.get("recastRisk")),
    }


def entier(v):
    if isinstance(v, int) and not isinstance(v, bool):
        return v
    return int(v) if isinstance(v, str) and v.strip().isdigit() else None


def gravites_demandees(configuration):
    g = configuration.get("gravites", GRAVITES_DEFAUT)
    if not isinstance(g, list) or not g or len(g) > len(GRAVITES) or any(x not in GRAVITES for x in g) or len(set(g)) != len(g):
        raise Refus("Filtre de gravité invalide.")
    return ",".join(GRAVITES[x] for x in GRAVITES if x in g)


def lire_hotes(client, debut, sortie, bilan, horloge=time.monotonic):
    """Inventaire (`GET /rest/hosts`, accès annoncé expérimental), paginé par `limit` et `offset`. Une page sans machine
    nouvelle arrête la lecture (pagination ignorée par le service : inventaire partiel, signalé)."""
    pas = BORNES_SYNCHRO["pageMachines"]
    for page in range(BORNES_SYNCHRO["pagesMachines"]):
        if horloge() - debut > BORNES_SYNCHRO["dureeSecondes"]:
            raise Refus("Durée maximale atteinte : inventaire incomplet.")
        liste = reponse_tenable(client.requete("GET", "/rest/hosts", parametres={"limit": pas, "offset": page * pas},
                                               maximum=BORNES_SYNCHRO["reponseMachines"]), forme=list)
        nouvelles = 0
        for brut in liste:
            if not isinstance(brut, dict):
                bilan["ecartes"] += 1
                continue
            h = {k: brut[k] for k in CHAMPS_HOTE if k in brut}
            uuid = uuid_strict(h.get("uuid"))
            if not uuid:
                bilan["ecartes"] += 1
                continue
            if uuid in sortie["hotes"]:
                continue
            nouvelles += 1
            sortie["hotes"][uuid] = {
                "type": "hote", "uuid": uuid, "tenableUuid": uuid_strict(h.get("tenableUUID")),
                "nom": nom_machine(h.get("name")), "adresse": adresse_ip(h.get("ipAddress")),
                "systeme": texte(h.get("os"), BORNES_SYNCHRO["systeme"]),
                "premiere": instant(h.get("firstSeen")), "derniere": instant(h.get("lastSeen")),
            }
        if len(liste) < pas:
            return
        if not nouvelles:
            raise Refus("Inventaire : la pagination n'est pas suivie par le service, lecture arrêtée (inventaire partiel).")
    raise Refus("Inventaire : nombre maximal de pages atteint (inventaire partiel).")


# Lot QF-TEN (demande du RSSI du 22/11/2026) : correctifs regroupés de Tenable, lus par la vue `sumremediation` de la même
# analyse (`POST /rest/analysis`, mêmes filtres que les failles). Champs lus : tout autre champ est écarté dès la lecture, en
# particulier `remediationList` (contenu non documenté, qui peut nommer des machines ou des adresses), `cpe`, `score`,
# `totalPctg`, `scorePctg`, `msbulletinTotal` et `cvssV4BaseScore`.
CHAMPS_CORRECTIF = ("solutionID", "solution", "pluginID", "hostTotal", "cveTotal", "total", "vprScore", "cvssV3BaseScore",
                    "epssScore")
IDENTIFIANT_CORRECTIF = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$")
COMPTE_MAX = 100000000


def plugins_corriges(v):
    """`pluginID` d'un correctif : chaîne de numéros séparés par des virgules (forme probable, non vérifiée), liste de numéros
    ou numéro seul. Numéros valides seulement, sans doublon, bornés à BORNES_SYNCHRO["controlesParCorrectif"]."""
    if isinstance(v, bool):
        return []
    if isinstance(v, int):
        morceaux = [str(v)]
    elif isinstance(v, str):
        morceaux = re.split(r"[,;\s]+", v)
    elif isinstance(v, list):
        morceaux = [str(x) if isinstance(x, int) and not isinstance(x, bool) else x for x in v]
    else:
        return []
    vus = []
    for m in morceaux:
        m = m.strip() if isinstance(m, str) else ""
        if PLUGIN_ID.fullmatch(m) and m not in vus:
            vus.append(m)
            if len(vus) >= BORNES_SYNCHRO["controlesParCorrectif"]:
                break
    return vus


def compte_tenable(v):
    n = entier(v)
    return n if n is not None and 0 <= n <= COMPTE_MAX else None


def lire_correctif(brut):
    """Un résultat de `sumremediation` réduit à CHAMPS_CORRECTIF ; None s'il n'a ni identifiant, ni texte, ni contrôle."""
    if not isinstance(brut, dict):
        return None
    r = {k: brut[k] for k in CHAMPS_CORRECTIF if k in brut}
    ident = r.get("solutionID").strip() if isinstance(r.get("solutionID"), str) else ""
    solution = texte(r.get("solution"), BORNES_SYNCHRO["correctif"])
    plugins = plugins_corriges(r.get("pluginID"))
    if not IDENTIFIANT_CORRECTIF.fullmatch(ident) or not solution or not plugins:
        return None
    return {"type": "correctif", "identifiant": ident, "solution": solution, "plugins": plugins,
            "machines": compte_tenable(r.get("hostTotal")), "cves": compte_tenable(r.get("cveTotal")),
            "detections": compte_tenable(r.get("total")), "vpr": decimal(r.get("vprScore"), 0, 10),
            "cvss3Score": decimal(r.get("cvssV3BaseScore"), 0, 10),
            # Rendu en pourcentage par Tenable, comme dans `vulndetails` (forme supposée) : rangé entre 0 et 1.
            "epss": decimal(r.get("epssScore"), 0, 100, diviseur=100)}


def lire_correctifs(client, filtre, debut, etat, horloge=time.monotonic):
    """Correctifs regroupés (`sumremediation`), paginés comme les failles. Rendus seulement si la lecture est complète (toutes
    les pages, sans borne atteinte) : une lecture partielle ne rapporte rien et l'application garde ceux qu'elle a. Une
    erreur est propagée à l'appelant, qui ne fait pas échouer la synchronisation des failles. Un résultat écarté est compté
    dans `etat` (pas dans le bilan des failles)."""
    pas, offset, lus = BORNES_SYNCHRO["pageAnalyse"], 0, {}
    for _ in range(BORNES_SYNCHRO["pagesCorrectifs"]):
        if horloge() - debut > BORNES_SYNCHRO["dureeSecondes"]:
            raise Refus("Durée maximale atteinte : correctifs regroupés non lus.")
        corps = {"type": "vuln", "sourceType": "cumulative", "startOffset": offset, "endOffset": offset + pas,
                 "query": {"type": "vuln", "tool": "sumremediation",
                           "filters": [{"filterName": "severity", "operator": "=", "value": filtre}]}}
        reponse = reponse_tenable(client.requete("POST", "/rest/analysis", corps, maximum=BORNES_SYNCHRO["reponseAnalyse"]))
        resultats = reponse.get("results")
        if not isinstance(resultats, list) or len(resultats) > pas:
            raise Refus("Réponse de la vue des correctifs illisible.")
        total = entier(reponse.get("totalRecords"))
        for brut in resultats:
            c = lire_correctif(brut)
            if c is None:
                etat["ecartes"] += 1
                continue
            lus[c["identifiant"]] = c
            if len(lus) > BORNES_SYNCHRO["correctifs"]:
                raise Refus("Nombre maximal de correctifs regroupés atteint : correctifs non rapportés.")
        offset += len(resultats)
        if len(resultats) < pas or (total is not None and offset >= total):
            return list(lus.values())
    raise Refus("Nombre maximal de pages de correctifs atteint : correctifs non rapportés.")


def tenable_synchroniser(client, configuration, horloge=time.monotonic):
    """Failles par l'analyse `vulndetails` (source cumulative, filtre de gravité de l'instance), paginée par pages modestes,
    regroupées par contrôle ; puis inventaire des machines. Bornes : pages, détections, durée. L'inventaire peut échouer sans
    faire échouer la synchronisation des failles : le bilan le dit."""
    debut = horloge()
    filtre = gravites_demandees(configuration)
    sortie = {"machines": {}, "constats": {}, "detections": {}, "hotes": {}}
    bilan = {"pages": 0, "ecartes": 0, "tronque": False}
    pas, offset, total = BORNES_SYNCHRO["pageAnalyse"], 0, None
    while True:
        if bilan["pages"] >= BORNES_SYNCHRO["pagesAnalyse"] or horloge() - debut > BORNES_SYNCHRO["dureeSecondes"]:
            bilan["tronque"] = True
            break
        corps = {"type": "vuln", "sourceType": "cumulative", "startOffset": offset, "endOffset": offset + pas,
                 "query": {"type": "vuln", "tool": "vulndetails",
                           "filters": [{"filterName": "severity", "operator": "=", "value": filtre}]}}
        reponse = reponse_tenable(client.requete("POST", "/rest/analysis", corps, maximum=BORNES_SYNCHRO["reponseAnalyse"]))
        resultats = reponse.get("results")
        if not isinstance(resultats, list) or len(resultats) > pas:
            raise Refus("Réponse de l'analyse illisible.")
        total = entier(reponse.get("totalRecords"))
        bilan["pages"] += 1
        for brut in resultats:
            if len(sortie["detections"]) >= BORNES_SYNCHRO["detections"]:
                bilan["tronque"] = True
                break
            lire_resultat(brut, sortie, bilan)
        offset += len(resultats)
        # Fin : page courte ou vide, ou total annoncé atteint (sans total, on lit jusqu'à une page courte).
        if bilan["tronque"] or len(resultats) < pas or (total is not None and offset >= total):
            break
    # Lot QF-TEN : correctifs regroupés, après les failles ; leur échec est rapporté, pas propagé (aucun n'est rapporté).
    correctifs, etat_correctifs = [], {"ok": True, "erreur": None, "ecartes": 0}
    try:
        correctifs = lire_correctifs(client, filtre, debut, etat_correctifs, horloge)
    except Exception as erreur:  # noqa: BLE001 - la recommandation de Tenable est facultative (ADR 0100, point 19)
        etat_correctifs.update(ok=False, erreur=une_ligne("Correctifs regroupés indisponibles : " + explication(erreur)))
    inventaire = {"ok": True, "erreur": None}
    try:
        lire_hotes(client, debut, sortie, bilan, horloge)
    except Exception as erreur:  # noqa: BLE001 - l'inventaire est expérimental : son échec est rapporté, pas propagé
        inventaire = {"ok": False, "erreur": une_ligne("Inventaire des machines indisponible : " + explication(erreur))}
    elements = (list(sortie["machines"].values()) + list(sortie["constats"].values())
                + list(sortie["detections"].values()) + list(sortie["hotes"].values()) + correctifs)
    # `correctifs` (état de la lecture et nombre rapporté) : propre au script ; l'exécutant ne transmet que les comptes connus
    # de son type (SYNCHRO_COMPTES), l'API n'en dépend pas.
    resultat = {"pages": bilan["pages"], "constats": len(sortie["constats"]), "detections": len(sortie["detections"]),
                "machines": len(sortie["machines"]), "hotes": len(sortie["hotes"]), "ecartes": bilan["ecartes"],
                "tronque": bilan["tronque"], "inventaire": inventaire,
                "correctifs": dict(etat_correctifs, nombre=len(correctifs))}
    return resultat, elements


# ------------------------------------------------------------------ AlgoLightHouse (lots ALH1, ALH2 et ALH6)
# Champs lus, par réponse : tout autre champ est écarté dès la lecture et ne sort jamais du script. Jamais lus : `note`
# (description HTML), `data` (déprécié), `uploads`, commentaires, `sensitive_data`, `has_sensitive_data`, et dans un fragment
# tout ce qui n'est ni `alert_cves` ni `json_data` (CHAMPS_FRAGMENT_ALH). Lot ALH2 (décision A du RSSI du 17/11/2026) : les
# défauts (`defects`) d'un détail sont lus en liste blanche (CHAMPS_DEFAUT_ALH, CHAMPS_RESOLUTION_ALH), balises retirées : du
# texte simple, jamais du HTML. Lot ALH6 (décision du RSSI du 17/11/2026) : les services (port, protocole, produit) d'une
# alerte sont lus dans `json_data` de ses fragments, pour les seuls types `port`, `vulnerable_component` et `subdomain`
# (TYPES_FRAGMENT_SERVICE_ALH), réduits à CHAMPS_SERVICE_ALH : ni `banner`, ni `state`, ni `subdomain`, ni `description`, ni
# aucun champ des autres types (fuite, mention git, S3, chemin, WordPress, certificat TLS).
CHAMPS_FRAGMENT_ALH = ("alert_cves", "json_data")
CHAMPS_SERVICE_ALH = ("fragment_type", "port", "protocol", "service_name", "product", "version", "vendor", "cpe", "ports",
                      "version_status")
CHAMPS_PERIMETRE_ALH = ("id", "name")
CHAMPS_HOTE_ALH = ("id", "perimeter_id", "status", "ip_address", "isp", "asn", "country", "is_shared_server", "is_cdn",
                   "is_alive", "alive_at", "is_manual_import", "created_at", "updated_at")
CHAMPS_DOMAINE_ALH = ("id", "perimeter_id", "status", "domain", "level", "is_manual_import", "ip_address",
                      "parent_target_domain_id", "created_at", "updated_at")
CHAMPS_ALERTE_ALH = ("id", "title", "status", "type_id", "perimeter_id", "criticity_id", "is_verified", "created_at",
                     "updated_at")
CHAMPS_DETAIL_ALH = ("id", "type", "criticity", "target", "cves", "fragments", "defects", "completed_at", "created_at")
CHAMPS_DEFAUT_ALH = ("name", "description", "resolutions")
CHAMPS_RESOLUTION_ALH = ("name", "description", "ease_of_execution", "security_gain")
CHAMPS_CIBLE_ALH = ("type", "value", "target_host_id", "target_domain_id")
CHAMPS_TECHNOLOGIE_ALH = ("display_name", "vendor", "product", "technology", "active_versions", "inactive_assets",
                          "last_scanned_at")
CHAMPS_CVE_TECHNOLOGIE_ALH = ("cve", "title", "cvss", "epss", "severity", "has_poc", "is_exploited", "published_at")
TYPES_ALERTE_ALH = ("vulnerable_service", "exposed_service", "config_defect", "data_leak", "typosquatting")
CRITICITES_ALH = ("critical", "major", "important", "minor")
STATUTS_ALERTE_ALH = ("untreated", "in-progress", "to-retest", "to-reprocess", "standbye", "completed", "abandoned",
                      "accepted-risk")
STATUTS_ACTIF_ALH = ("new", "monitored", "ignored", "pending-approval", "provider")
TYPES_CIBLE_ALH = ("domain", "host", "service", "keyword")
TYPES_ACTIF_ALH = {"host": "hote", "domain": "domaine"}
TYPES_FRAGMENT_SERVICE_ALH = ("port", "vulnerable_component", "subdomain")
PROTOCOLES_ALH = ("tcp", "udp")
STATUTS_VERSION_ALH = ("eol", "outdated")
NOM_DOMAINE_ALH = re.compile(r"^(?:\*\.)?(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
ASN_ALH = re.compile(r"^[0-9]{1,10}$")
PAYS_ALH = re.compile(r"^[A-Z]{2}$")
SEVERITE_ALH = re.compile(r"^[a-z]{1,20}$")
INSTANT_ISO = re.compile(r"^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$")


def cle_alh(secrets):
    cle = secrets.get("cleApi")
    if not (isinstance(cle, str) and CLE_API_ALH.fullmatch(cle)):
        raise Refus("Clé d'API absente ou de forme invalide.")
    return {"X-API-Key": cle}


def liste_alh(donnees):
    """Les listes de la version 1 sont des tableaux JSON directs."""
    if not isinstance(donnees, list):
        raise Refus("Réponse d'AlgoLightHouse illisible : liste attendue.")
    return donnees


def instant_iso(v):
    """Date ISO 8601 de l'éditeur (fuseau obligatoire) rendue en UTC à la milliseconde ; toute autre forme : None."""
    m = INSTANT_ISO.fullmatch(v.strip()) if isinstance(v, str) and len(v) <= 40 else None
    if not m:
        return None
    try:
        d = dt.datetime.fromisoformat("%s-%s-%sT%s:%s:%s" % m.groups()[:6] + ("+00:00" if m.group(7) == "Z" else m.group(7)))
    except ValueError:
        return None
    d = d.astimezone(dt.timezone.utc)
    if not 1970 < d.year < 2100:
        return None
    return d.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def booleen(v):
    return v if isinstance(v, bool) else None


def parmi(v, valeurs):
    return v if isinstance(v, str) and v in valeurs else None


def adresse_unique(v):
    """Une seule adresse IP, normalisée (minuscules, forme courte) ; toute autre valeur : None."""
    if not isinstance(v, str) or len(v) > 45:
        return None
    try:
        a = str(ipaddress.ip_address(v.strip()))
    except ValueError:
        return None
    return a if ADRESSE_IP.fullmatch(a) else None


def domaine_alh(v):
    if not isinstance(v, str):
        return None
    d = v.strip().lower().rstrip(".")
    return d if len(d) <= BORNES_ALH["domaine"] and NOM_DOMAINE_ALH.fullmatch(d) else None


def cves_de(objet):
    """CVE d'un objet dont la forme n'est pas décrite par l'éditeur (CVE d'une alerte, d'un fragment) : seules les valeurs
    texte du premier niveau qui sont exactement un identifiant CVE sont retenues ; rien n'est lu plus loin."""
    if isinstance(objet, str):
        objet = {"cve": objet}
    if not isinstance(objet, dict):
        return []
    trouvees = []
    for v in objet.values():
        if isinstance(v, str) and len(v) <= 20:
            c = v.strip().upper()
            if CVE_ID.fullmatch(c) and c not in trouvees:
                trouvees.append(c)
    return trouvees


def alh_tester(client):
    """GET /api/v1/health (statut « ok » exigé), puis GET /api/v1/version : seule la version sort."""
    sante = client.requete("GET", "/api/v1/health", maximum=BORNES_ALH["reponseCourte"])
    if not isinstance(sante, dict) or sante.get("status") != "ok":
        raise Refus("AlgoLightHouse se dit indisponible.")
    version = client.requete("GET", "/api/v1/version", maximum=BORNES_ALH["reponseCourte"])
    version = version.get("version") if isinstance(version, dict) else None
    if not isinstance(version, str) or not VERSION_ALH.fullmatch(version):
        raise Refus("Version d'AlgoLightHouse absente ou de forme inattendue.")
    return {"version": version}


def defauts_alh(brut):
    """Défauts d'un détail (lot ALH2) : nom, description et résolutions (nom, description, facilité, gain), en liste blanche,
    balises retirées et textes bornés ; un défaut ou une résolution sans nom est écarté. Seule la valeur (`value`) de la
    facilité et du gain est lue."""
    out = []
    for d in brut[: BORNES_ALH["defautsParAlerte"]] if isinstance(brut, list) else []:
        d = {k: d[k] for k in CHAMPS_DEFAUT_ALH if k in d} if isinstance(d, dict) else {}
        nom = texte(d.get("name"), BORNES_ALH["nomDefaut"])
        if not nom:
            continue
        resolutions = []
        brutes = d.get("resolutions") if isinstance(d.get("resolutions"), list) else []
        for r in brutes[: BORNES_ALH["resolutionsParDefaut"]]:
            r = {k: r[k] for k in CHAMPS_RESOLUTION_ALH if k in r} if isinstance(r, dict) else {}
            nom_r = texte(r.get("name"), BORNES_ALH["nomDefaut"])
            if not nom_r:
                continue
            niveau = lambda o: texte(o.get("value"), BORNES_ALH["niveauResolution"]) if isinstance(o, dict) else None
            resolutions.append({"nom": nom_r, "description": texte(r.get("description"), BORNES_ALH["descriptionDefaut"]),
                                "facilite": niveau(r.get("ease_of_execution")), "gain": niveau(r.get("security_gain"))})
        out.append({"nom": nom, "description": texte(d.get("description"), BORNES_ALH["descriptionDefaut"]),
                    "resolutions": resolutions})
    return out


def port_alh(v):
    """Numéro de port entier de 1 à 65535 ; toute autre valeur (texte, booléen, hors bornes) : None."""
    return v if isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= 65535 else None


def services_de_fragment(j):
    """Services (port, protocole, produit) d'un `json_data` de fragment, déjà réduit à CHAMPS_SERVICE_ALH. `port` : un service ;
    `vulnerable_component` : un service par port de `ports` (protocole non renseigné) ; `subdomain` : le port seul (le nom du
    sous-domaine n'est pas lu). Protocole absent ou inconnu : non renseigné (jamais « tcp » par défaut). Les valeurs « * » et
    vides tiennent lieu d'absence."""
    type_ = j.get("fragment_type")
    connu = lambda v: None if v == "*" else v
    commun = {
        "nom": None, "produit": connu(texte(j.get("product"), BORNES_ALH["produit"])),
        "version": connu(texte(j.get("version"), BORNES_ALH["version"])),
        "editeur": connu(texte(j.get("vendor"), BORNES_ALH["editeur"])), "cpe": None, "statutVersion": None,
    }
    cpe = texte(j.get("cpe"), BORNES_ALH["cpe"])
    commun["cpe"] = cpe if cpe and cpe.lower().startswith("cpe:") else None
    if type_ == "port":
        port = port_alh(j.get("port"))
        if port is None:
            return []
        return [dict(commun, port=port, protocole=parmi(j.get("protocol"), PROTOCOLES_ALH),
                     nom=texte(j.get("service_name"), BORNES_ALH["nomService"]))]
    if type_ == "vulnerable_component":
        commun["statutVersion"] = parmi(j.get("version_status"), STATUTS_VERSION_ALH)
        ports = j.get("ports") if isinstance(j.get("ports"), list) else []
        vus = []
        for p in ports[: BORNES_ALH["portsParComposant"]]:
            p = port_alh(p)
            if p is not None and p not in vus:
                vus.append(p)
        return [dict(commun, port=p, protocole=None) for p in vus]
    if type_ == "subdomain":
        port = port_alh(j.get("port"))
        vide = dict.fromkeys(commun)
        return [dict(vide, port=port, protocole=None)] if port is not None else []
    return []


def services_alh(fragments):
    """Services d'une alerte, lus dans `json_data` de ses fragments (lot ALH6). Forme absente, nulle ou inattendue : rien
    n'est retenu, la lecture continue. Un même port et protocole n'apparaît qu'une fois (les champs connus se complètent) ;
    un port sans protocole rejoint le seul service de même port dont le protocole est connu. Bornés à
    BORNES_ALH["servicesParAlerte"]."""
    trouves = []
    for fragment in fragments if isinstance(fragments, list) else []:
        f = {k: fragment[k] for k in CHAMPS_FRAGMENT_ALH if k in fragment} if isinstance(fragment, dict) else {}
        j = f.get("json_data")
        if not isinstance(j, dict) or j.get("fragment_type") not in TYPES_FRAGMENT_SERVICE_ALH:
            continue
        trouves += services_de_fragment({k: j[k] for k in CHAMPS_SERVICE_ALH if k in j})
    # Protocole connu d'abord : un port sans protocole peut alors rejoindre le service de même port.
    trouves.sort(key=lambda s: s["protocole"] is None)
    out = []
    for s in trouves:
        meme = [x for x in out if x["port"] == s["port"] and x["protocole"] == s["protocole"]]
        if not meme and s["protocole"] is None:
            meme = [x for x in out if x["port"] == s["port"]]
            meme = meme if len(meme) == 1 else []
        if meme:
            for k, v in s.items():
                if meme[0][k] is None and v is not None:
                    meme[0][k] = v
        elif len(out) < BORNES_ALH["servicesParAlerte"]:
            out.append(s)
    return sorted(out, key=lambda s: (s["port"], s["protocole"] or ""))


def alh_detail(client, alerte, types, criticites):
    """Détail d'une alerte : type, criticité, cible, CVE et défauts (lot ALH2, liste blanche) ; tout autre champ (note,
    pièces jointes, données sensibles des fragments) est écarté dès la lecture. Les correspondances identifiant -> valeur de
    type et de criticité sont apprises au passage, pour les alertes dont le détail n'est pas lu."""
    brut = client.requete("GET", "/api/v1/alerts/" + alerte["id"], maximum=BORNES_ALH["reponseDetail"])
    if not isinstance(brut, dict):
        raise Refus("Détail d'alerte illisible.")
    d = {k: brut[k] for k in CHAMPS_DETAIL_ALH if k in brut}
    if uuid_strict(d.get("id")) != alerte["id"]:
        raise Refus("Détail d'alerte illisible : identifiant inattendu.")
    for objet, valeurs, table, champ in ((d.get("type"), TYPES_ALERTE_ALH, types, "typeAlerte"),
                                         (d.get("criticity"), CRITICITES_ALH, criticites, "criticite")):
        objet = objet if isinstance(objet, dict) else {}
        valeur = parmi(objet.get("value"), valeurs)
        alerte[champ] = valeur
        ident = uuid_strict(objet.get("id"))
        if ident and valeur:
            table[ident] = valeur
    cible = d.get("target") if isinstance(d.get("target"), dict) else None
    if cible is not None:
        c = {k: cible[k] for k in CHAMPS_CIBLE_ALH if k in cible}
        alerte["cibleType"] = parmi(c.get("type"), TYPES_CIBLE_ALH)
        alerte["cibleValeur"] = texte(c.get("value"), BORNES_ALH["valeurCible"])
        alerte["cibleHote"] = uuid_strict(c.get("target_host_id"))
        alerte["cibleDomaine"] = uuid_strict(c.get("target_domain_id"))
    trouvees = []
    for objet in d.get("cves") if isinstance(d.get("cves"), list) else []:
        trouvees += [c for c in cves_de(objet) if c not in trouvees]
    for fragment in d.get("fragments") if isinstance(d.get("fragments"), list) else []:
        f = {k: fragment[k] for k in CHAMPS_FRAGMENT_ALH if k in fragment} if isinstance(fragment, dict) else {}
        liens = f.get("alert_cves")
        for lien in liens if isinstance(liens, list) else []:
            if isinstance(lien, dict):
                trouvees += [c for c in cves_de(lien.get("cve")) if c not in trouvees]
    alerte["cves"] = trouvees[: BORNES_ALH["cvesParAlerte"]]
    alerte["defauts"] = defauts_alh(d.get("defects"))
    alerte["services"] = services_alh(d.get("fragments"))
    # Constaté sur un espace réel : la liste peut rendre une date de création vide (an 1), le détail porte la vraie.
    if alerte.get("creeLe") is None:
        alerte["creeLe"] = instant_iso(d.get("created_at"))
    termine = instant_iso(d.get("completed_at"))
    if termine:
        alerte["termineeLe"] = termine
    alerte["detail"] = True


def alh_technologie(brut, sortie, bilan, totaux):
    """Une technologie : la technologie, puis ses actifs et ses CVE par version (actifs inactifs : version vide)."""
    if not isinstance(brut, dict):
        bilan["ecartes"] += 1
        return
    t = {k: brut[k] for k in CHAMPS_TECHNOLOGIE_ALH if k in brut}
    # Constaté sur un espace réel : « * » (joker de CPE) tient lieu de valeur absente pour le produit et le nom affiché.
    connu = lambda v: None if v == "*" else v
    editeur = connu(texte(t.get("vendor"), BORNES_ALH["editeur"]))
    produit = connu(texte(t.get("product"), BORNES_ALH["produit"]))
    techno = texte(t.get("technology"), BORNES_ALH["nomTechnologie"])
    nom = connu(texte(t.get("display_name"), BORNES_ALH["nomTechnologie"])) or produit or techno
    if not nom:
        bilan["ecartes"] += 1
        return
    cle = ("%s|%s|%s" % (editeur or "", produit or "", techno or "")).lower()
    if cle == "||":
        cle = "|" + nom.lower() + "|"
    cle = cle[: BORNES_ALH["cleTechnologie"]]
    if cle in sortie["cles"]:
        return
    sortie["cles"].add(cle)
    element = {"type": "technologie", "cle": cle, "nom": nom, "editeur": editeur, "produit": produit,
               "technologie": techno, "derniere": instant_iso(t.get("last_scanned_at")), "tronquee": False}
    sortie["technologies"].append(element)

    def actif(a, version, actuel):
        if not isinstance(a, dict):
            return
        ident, type_ = uuid_strict(a.get("id")), TYPES_ACTIF_ALH.get(a.get("type"))
        libelle = texte(a.get("label"), BORNES_ALH["valeurCible"])
        if not ident or not type_ or not libelle:
            bilan["ecartes"] += 1
            return
        if totaux["liens"] >= BORNES_ALH["liensTechnologies"]:
            element["tronquee"] = bilan["tronque"] = True
            return
        totaux["liens"] += 1
        sortie["liens"].append({"type": "technologie_actif", "technologie": cle, "version": version, "actif": ident,
                                "typeActif": type_, "libelle": libelle, "actuel": actuel})

    versions = t.get("active_versions") if isinstance(t.get("active_versions"), list) else []
    if len(versions) > BORNES_ALH["versionsParTechnologie"]:
        element["tronquee"] = True
    for v in versions[: BORNES_ALH["versionsParTechnologie"]]:
        if not isinstance(v, dict):
            bilan["ecartes"] += 1
            continue
        version = v.get("version") if isinstance(v.get("version"), str) else ""
        version = texte(version, BORNES_ALH["version"]) or ""
        actifs = v.get("assets") if isinstance(v.get("assets"), list) else []
        cves = v.get("cves") if isinstance(v.get("cves"), list) else []
        if len(actifs) > BORNES_ALH["actifsParVersion"] or len(cves) > BORNES_ALH["cvesParVersion"]:
            element["tronquee"] = True
        for a in actifs[: BORNES_ALH["actifsParVersion"]]:
            actif(a, version, True)
        vues = set()
        for brute in cves[: BORNES_ALH["cvesParVersion"]]:
            c = {k: brute[k] for k in CHAMPS_CVE_TECHNOLOGIE_ALH if k in brute} if isinstance(brute, dict) else {}
            ident = c.get("cve").strip().upper() if isinstance(c.get("cve"), str) else ""
            if not CVE_ID.fullmatch(ident) or ident in vues:
                bilan["ecartes"] += 1
                continue
            if totaux["cves"] >= BORNES_ALH["cvesTechnologies"]:
                element["tronquee"] = bilan["tronque"] = True
                break
            vues.add(ident)
            totaux["cves"] += 1
            severite = c.get("severity").strip().lower() if isinstance(c.get("severity"), str) else ""
            sortie["cves"].append({
                "type": "technologie_cve", "technologie": cle, "version": version, "cve": ident,
                "titre": texte(c.get("title"), BORNES_ALH["titreCve"]), "cvss": decimal(c.get("cvss"), 0, 10),
                # Probabilité entre 0 et 1 (exemple du descriptif : 0.42) ; toute autre valeur est écartée, pas convertie.
                "epss": None if decimal(c.get("epss"), 0, 1) is None else round(float(c["epss"]), 5),
                "severite": severite if SEVERITE_ALH.fullmatch(severite) else None,
                "preuve": booleen(c.get("has_poc")), "exploitee": booleen(c.get("is_exploited")),
                "publieeLe": instant_iso(c.get("published_at")),
            })
    inactifs = t.get("inactive_assets") if isinstance(t.get("inactive_assets"), list) else []
    if len(inactifs) > BORNES_ALH["actifsParVersion"]:
        element["tronquee"] = True
    for a in inactifs[: BORNES_ALH["actifsParVersion"]]:
        actif(a, "", False)


def alh_synchroniser(client, configuration, horloge=time.monotonic):
    """Périmètres, hôtes, domaines, alertes (liste, puis détail des plus récentes) et technologies. Aucune pagination n'est
    documentée : chaque liste est lue en une réponse bornée ; au-delà des bornes (éléments, détails, durée), la
    synchronisation est « tronquée » et ne fait rien disparaître."""
    debut = horloge()
    bilan = {"ecartes": 0, "tronque": False, "details": 0}
    sortie = {"cles": set(), "technologies": [], "liens": [], "cves": []}

    def lire(chemin, borne):
        if horloge() - debut > BORNES_ALH["dureeSecondes"]:
            raise Refus("Durée maximale atteinte : synchronisation interrompue.")
        liste = liste_alh(client.requete("GET", chemin, maximum=BORNES_ALH["reponseListe"]))
        if len(liste) > BORNES_ALH[borne]:
            bilan["tronque"] = True
        return liste[: BORNES_ALH[borne]]

    perimetres = {}
    for brut in lire("/api/v1/perimeters", "perimetres"):
        p = {k: brut[k] for k in CHAMPS_PERIMETRE_ALH if k in brut} if isinstance(brut, dict) else {}
        ident, nom = uuid_strict(p.get("id")), texte(p.get("name"), BORNES_ALH["nomPerimetre"])
        if not ident or not nom:
            bilan["ecartes"] += 1
            continue
        perimetres[ident] = {"type": "perimetre", "id": ident, "nom": nom}
    hotes = {}
    for brut in lire("/api/v1/targets/hosts", "hotes"):
        h = {k: brut[k] for k in CHAMPS_HOTE_ALH if k in brut} if isinstance(brut, dict) else {}
        ident, adresse = uuid_strict(h.get("id")), adresse_unique(h.get("ip_address"))
        if not ident or not adresse:
            bilan["ecartes"] += 1
            continue
        asn = h.get("asn").strip() if isinstance(h.get("asn"), str) else ""
        asn = asn[2:] if asn[:2].upper() == "AS" else asn  # « AS64500 » comme « 64500 »
        pays = h.get("country").strip().upper() if isinstance(h.get("country"), str) else ""
        hotes[ident] = {
            "type": "hote", "id": ident, "perimetre": uuid_strict(h.get("perimeter_id")),
            "statut": parmi(h.get("status"), STATUTS_ACTIF_ALH), "adresse": adresse,
            "fai": texte(h.get("isp"), BORNES_ALH["fai"]), "asn": asn if ASN_ALH.fullmatch(asn) else None,
            "pays": pays if PAYS_ALH.fullmatch(pays) else None, "mutualise": booleen(h.get("is_shared_server")),
            "cdn": booleen(h.get("is_cdn")), "joignable": booleen(h.get("is_alive")),
            "joignableLe": instant_iso(h.get("alive_at")), "importManuel": booleen(h.get("is_manual_import")),
            "creeLe": instant_iso(h.get("created_at")), "majLe": instant_iso(h.get("updated_at")),
        }
    domaines = {}
    for brut in lire("/api/v1/targets/domains", "domaines"):
        d = {k: brut[k] for k in CHAMPS_DOMAINE_ALH if k in brut} if isinstance(brut, dict) else {}
        ident, nom = uuid_strict(d.get("id")), domaine_alh(d.get("domain"))
        if not ident or not nom:
            bilan["ecartes"] += 1
            continue
        niveau = d.get("level")
        domaines[ident] = {
            "type": "domaine", "id": ident, "perimetre": uuid_strict(d.get("perimeter_id")),
            "statut": parmi(d.get("status"), STATUTS_ACTIF_ALH), "domaine": nom,
            "niveau": niveau if isinstance(niveau, int) and not isinstance(niveau, bool) and 1 <= niveau <= 127 else None,
            "importManuel": booleen(d.get("is_manual_import")), "adresse": adresse_unique(d.get("ip_address")),
            "parent": uuid_strict(d.get("parent_target_domain_id")),
            "creeLe": instant_iso(d.get("created_at")), "majLe": instant_iso(d.get("updated_at")),
        }
    alertes, ids_types, ids_criticites = {}, {}, {}
    for brut in lire("/api/v1/alerts", "alertes"):
        a = {k: brut[k] for k in CHAMPS_ALERTE_ALH if k in brut} if isinstance(brut, dict) else {}
        ident, titre = uuid_strict(a.get("id")), texte(a.get("title"), BORNES_ALH["titre"])
        statut = parmi(a.get("status"), STATUTS_ALERTE_ALH)
        if not ident or not titre or not statut or ident in alertes:
            bilan["ecartes"] += 1
            continue
        ids_types[ident] = uuid_strict(a.get("type_id"))
        ids_criticites[ident] = uuid_strict(a.get("criticity_id"))
        alertes[ident] = {
            "type": "alerte", "id": ident, "perimetre": uuid_strict(a.get("perimeter_id")), "typeAlerte": None,
            "criticite": None, "statut": statut, "titre": titre, "verifiee": booleen(a.get("is_verified")),
            "detail": False, "cibleType": None, "cibleValeur": None, "cibleHote": None, "cibleDomaine": None,
            "cves": [], "defauts": [], "services": [], "creeLe": instant_iso(a.get("created_at")), "majLe": instant_iso(a.get("updated_at")),
            "termineeLe": None,
        }
    # Détail des alertes les plus récemment modifiées, dans la limite des bornes (nombre, durée).
    types, criticites = {}, {}
    ordre = sorted(alertes.values(), key=lambda x: x["majLe"] or x["creeLe"] or "", reverse=True)
    for alerte in ordre:
        if bilan["details"] >= BORNES_ALH["details"] or horloge() - debut > BORNES_ALH["dureeSecondes"]:
            bilan["tronque"] = True
            break
        try:
            alh_detail(client, alerte, types, criticites)
        except ReponseInattendue as e:
            # Alerte retirée entre la liste et son détail (404) : écartée, la synchronisation est incomplète.
            if e.code != 404:
                raise
            bilan["ecartes"] += 1
            bilan["tronque"] = True
            continue
        bilan["details"] += 1
    for ident, alerte in alertes.items():
        if not alerte["detail"]:
            alerte["typeAlerte"] = types.get(ids_types[ident])
            alerte["criticite"] = criticites.get(ids_criticites[ident])
    totaux = {"liens": 0, "cves": 0}
    for brut in lire("/api/v1/technologies", "technologies"):
        alh_technologie(brut, sortie, bilan, totaux)
    elements = (list(perimetres.values()) + list(hotes.values()) + list(domaines.values()) + list(alertes.values())
                + sortie["technologies"] + sortie["liens"] + sortie["cves"])
    resultat = {"perimetres": len(perimetres), "hotes": len(hotes), "domaines": len(domaines), "alertes": len(alertes),
                "details": bilan["details"], "technologies": len(sortie["technologies"]), "ecartes": bilan["ecartes"],
                "tronque": bilan["tronque"]}
    return resultat, elements


TYPES = {
    "tenable": (cles_tenable, {"tester": tenable_tester, "synchroniser": tenable_synchroniser}),
    "algolighthouse": (cle_alh, {"tester": alh_tester, "synchroniser": alh_synchroniser}),
}


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
        client = Client(type_, configuration, en_tetes(secrets), lire_mandataire(p.get("mandataire")))
        if operation == "synchroniser":
            resultat, elements = operations[operation](client, configuration)
            return {"ok": True, "resultat": resultat, "elements": elements, "erreur": None}
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

#!/usr/bin/env python3
"""Veille du module Vulnérabilités sur cinq sources publiques (ADR 0100, points 3 à 5 ; lots V2 et V3).

Lancé par l'exécutant d'exploitation du serveur (scripts/exploitation-worker.py) sous un compte sans privilège, par
`python -I`, avec un environnement minimal et un délai borné, jamais par l'API (qui reste sans accès réseau sortant).
Bibliothèque standard seule.

Entrée : un objet JSON sur l'entrée standard {source, parametres, mandataire?}. Sortie : un objet JSON {ok, elements, bilan, erreur} sur
la sortie standard ; les éléments sont normalisés en champs structurés et bornés, l'erreur tient sur une ligne et ne
reprend jamais un contenu de réponse.

Règles :
- liste fermée des hôtes et des chemins, écrite ici (SOURCES), recopiée de packages/shared/src/veille-vulnerabilites.ts et
  comparée par apps/api/test/veille-architecture.test.ts ; aucune adresse n'est reçue de l'application ;
- GET seulement, HTTPS, certificat toujours vérifié (magasin du système), TLS 1.2 au minimum ;
- mandataire sortant de l'établissement (ADR 0101, lot P1), seulement s'il est reçu : tunnel CONNECT vers l'hôte de la liste
  fermée à travers le mandataire, puis TLS jusqu'à la source, certificat et nom toujours vérifiés ; l'identifiant et le mot
  de passe ne vont qu'au mandataire (en-tête Proxy-Authorization de la demande CONNECT, authentification simple seulement :
  ni NTLM ni Kerberos), jamais à la source ; l'autorité de l'établissement, si elle est fournie, est ajoutée au magasin du
  système pour ces connexions (mandataire qui inspecte le trafic). Aucune option pour ne pas vérifier ;
- aucune redirection suivie (http.client ne les suit pas ; un code 3xx est une erreur) ;
- réponse bornée en taille, nombre d'éléments borné ; NVD est lu par fenêtre de dates de modification, EPSS seulement pour
  des failles déjà publiées par les sources (liste reçue de l'application), jamais par produit ;
- les avis sont des données, pas des consignes : identifiants contrôlés par expression régulière et écartés sinon, texte
  libre débarrassé de tout balisage et des caractères de contrôle, borné ; adresse gardée seulement en https sur l'hôte de
  la source ; RSS refusé s'il déclare un type de document ou une entité, profondeur et nombre d'éléments bornés.
"""
import base64
import datetime as dt
from email.utils import parsedate_to_datetime
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
import xml.etree.ElementTree as ET

# Liste fermée des sources : hôte et chemins exacts ({reference} : identifiant CERT-FR contrôlé). Une seule ligne JSON : le
# test d'architecture la lit telle quelle.
SOURCES = {"cisa-kev": {"hote": "www.cisa.gov", "chemins": ["/sites/default/files/feeds/known_exploited_vulnerabilities.json"]}, "nvd": {"hote": "services.nvd.nist.gov", "chemins": ["/rest/json/cves/2.0"]}, "epss": {"hote": "api.first.org", "chemins": ["/data/v1/epss"]}, "cert-fr": {"hote": "cert.cyber.gouv.fr", "chemins": ["/alerte/feed/", "/avis/feed/", "/alerte/{reference}/json/", "/avis/{reference}/json/"]}, "cert-sante": {"hote": "cyberveille.esante.gouv.fr", "chemins": ["/alertes-et-vulnerabilites/rss.xml"]}}
# Bornes, recopiées de VEILLE_BORNES (packages/shared) et comparées par le même test.
BORNES = {"titre": 300, "resume": 1000, "description": 1000, "action": 1000, "nomFaille": 300, "editeur": 200, "produit": 200, "nomsCpe": 20, "cvesParAvis": 200, "lot": 500, "lots": 40, "epss": 2000}
CVE_ID = re.compile(r"^CVE-[12]\d{3}-\d{4,9}$")
CERTFR_ID = re.compile(r"^CERTFR-20\d{2}-(?:ALE|AVI)-\d{2,4}$")
CERTSANTE_ID = re.compile(r"^[1-9]\d{0,9}$")
ADRESSE_CERTSANTE = re.compile(r"^https:\/\/cyberveille\.esante\.gouv\.fr\/alertes\/[a-z0-9-]{1,200}$")
CVSS31_VECTEUR = re.compile(r"^CVSS:3\.1(?:\/[A-Z]{1,3}:[A-Z]{1,2}){8,20}$")
CVSS40_VECTEUR = re.compile(r"^CVSS:4\.0(?:\/[A-Za-z]{1,3}:[A-Za-z]{1,10}){11,40}$")
NOM_CPE = re.compile(r"^[\x21-\x3b\x3d\x3f-\x7e]{1,100}$")
CVE_DANS_TEXTE = re.compile(r"\bCVE-[12]\d{3}-\d{4,9}\b")
REFERENCE_CERTFR = re.compile(r"/(?:alerte|avis)/(CERTFR-20\d{2}-(?:ALE|AVI)-\d{2,4})/")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HORODATAGE_NVD = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z?$")
INSTANT = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$")
GRAVITES = ("NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL")

ENTREE_MAX = 256 * 1024
# Mandataire : champs reçus, réponse à la demande de tunnel bornée.
MANDATAIRE_CHAMPS = ("hote", "port", "identifiant", "motDePasse", "autorite")
TUNNEL_REPONSE_MAX = 16 * 1024
NOM_HOTE = re.compile(r"^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$")
CONTROLE = re.compile(r"[\x00-\x1f\x7f]")
SEULE_BASIC = "Seule l'authentification simple (Basic) est prise en charge ; NTLM et Kerberos ne le sont pas."
ELEMENTS_MAX = BORNES["lot"] * BORNES["lots"]
REPONSE_MAX = {"cisa-kev": 16 * 1024 * 1024, "nvd": 32 * 1024 * 1024, "epss": 1024 * 1024, "cert-fr": 2 * 1024 * 1024, "cert-sante": 2 * 1024 * 1024}
ERREUR_MAX = 300
DELAI_REQUETE = 30
DUREE_MAX = 240
# NVD : 2000 failles par page (maximum de l'API), cinq pages au plus, six secondes entre deux pages (débit public sans clé
# d'API, d'après la documentation de NVD) ; fenêtre de 120 jours au plus (limite de l'API).
NVD_PAR_PAGE = 2000
NVD_PAGES_MAX = 5
NVD_PAUSE = 6
NVD_FENETRE_MAX = dt.timedelta(days=120)
# EPSS : cent failles par demande (taille de page par défaut observée), une seconde entre deux demandes.
EPSS_PAR_DEMANDE = 100
EPSS_PAUSE = 1
# CERT-FR : export JSON des alertes et des avis nouveaux, au plus 80 par collecte, une demi-seconde entre deux lectures.
CERTFR_DETAILS_MAX = 80
CERTFR_PAUSE = 0.5
# RSS : profondeur et nombre d'éléments XML bornés, éléments <item> gardés bornés.
RSS_PROFONDEUR_MAX = 8
RSS_ELEMENTS_MAX = 5000
RSS_ITEMS_MAX = 200

BALISE = re.compile(r"<[A-Za-z/!?][^<>]{0,2000}>")
BLOC_ACTIF = re.compile(r"<(script|style)\b[^>]{0,2000}>.{0,100000}?</\1\s*>", re.IGNORECASE | re.DOTALL)
INVISIBLES = ("Cc", "Cf", "Co", "Cs", "Zl", "Zp")


class Refus(Exception):
    """Erreur expliquée, sans contenu de réponse."""


# ------------------------------------------------------------------ Texte venu de l'extérieur
def texte(brut, maximum):
    """Texte simple sur une ligne : blocs actifs et balises retirés (entités décodées puis balises retirées à nouveau),
    caractères de contrôle et de mise en forme invisibles remplacés, espaces réduits, longueur bornée."""
    if not isinstance(brut, str):
        return ""
    s = brut[: maximum * 20]
    for _ in range(3):
        avant = s
        s = html.unescape(BALISE.sub(" ", BLOC_ACTIF.sub(" ", s)))
        if s == avant:
            break
    s = BALISE.sub(" ", BLOC_ACTIF.sub(" ", s))
    s = re.sub(r"<(?=[A-Za-z/!?])", "‹", s)
    s = "".join(" " if unicodedata.category(c) in INVISIBLES else c for c in s)
    s = re.sub(r" ([,.)])", r"\1", " ".join(s.split()))
    if len(s) > maximum:
        s = s[: maximum - 1].rstrip() + "…"
    return s


def une_ligne(t):
    t = re.sub(r"[\x00-\x1f\x7f]+", " ", str(t)).strip() or "Erreur sans détail."
    return t[:ERREUR_MAX]


def date_iso(v):
    if isinstance(v, str) and DATE.fullmatch(v):
        try:
            dt.date.fromisoformat(v)
            return v
        except ValueError:
            return None
    return None


def horodatage_nvd(v):
    """« 2026-06-26T15:16:40.587 » (UTC, sans zone) -> « 2026-06-26T15:16:40.587Z »."""
    m = HORODATAGE_NVD.fullmatch(v) if isinstance(v, str) else None
    if not m:
        return None
    try:
        dt.datetime.fromisoformat(m.group(1))
    except ValueError:
        return None
    return "%s.%sZ" % (m.group(1), (m.group(2) or "0").ljust(3, "0")[:3])


def horodatage_rss(v):
    try:
        d = parsedate_to_datetime(v) if isinstance(v, str) and len(v) <= 64 else None
    except (TypeError, ValueError, IndexError):
        return None
    if d is None:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


# ------------------------------------------------------------------ Réseau
def destination(source):
    """Hôte de la liste fermée, port 443. Remplacé en test par un faux service local."""
    return SOURCES[source]["hote"], 443


def contexte():
    """Certificat toujours vérifié (magasin du système), nom vérifié, TLS 1.2 au minimum."""
    ctx = ssl.create_default_context()
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.check_hostname = True
    ctx.verify_mode = ssl.CERT_REQUIRED
    return ctx


def lire_mandataire(m):
    """Paramètres du mandataire reçus sur l'entrée standard : None s'il n'y en a pas, sinon forme stricte (hôte nom ou adresse
    IP, port, identifiant sans deux-points, mot de passe, autorité PEM facultative). Le contenu n'est jamais repris dans une
    erreur."""
    if m is None:
        return None
    illisible = Refus("Paramètres du mandataire illisibles : rien n'a été lu.")
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
    la suite (le chiffré de la source) n'est consommé. Renvoie (code, schémas d'authentification proposés)."""
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
    Renvoie la connexion ouverte, prête pour TLS vers la source. Chaque échec est expliqué sur une ligne, sans secret."""
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
        lignes = ["CONNECT %s HTTP/1.1" % cible, "Host: %s" % cible, "User-Agent: suivi-audits-veille"]
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
    """Connexion HTTPS à la source à travers un tunnel ouvert sur le mandataire : TLS de bout en bout, certificat et nom de
    la source vérifiés par le même contexte qu'en accès direct."""

    def __init__(self, hote, port, contexte_tls, mandataire):
        super().__init__(hote, port, timeout=DELAI_REQUETE, context=contexte_tls)
        self.contexte_tls = contexte_tls
        self.mandataire = mandataire

    def connect(self):
        brut = ouvrir_tunnel(self.mandataire, self.host, self.port, self.timeout)
        try:
            self.sock = self.contexte_tls.wrap_socket(brut, server_hostname=self.host)
        except ssl.SSLCertVerificationError as e:
            brut.close()
            raise Refus("Certificat de la source refusé à travers le mandataire (%s). Si le mandataire inspecte le trafic "
                        "chiffré, fournissez l'autorité de certification de l'établissement dans son réglage."
                        % (e.verify_message or "vérification impossible")) from None
        except BaseException:
            brut.close()
            raise


def chemin_admis(source, chemin):
    for motif in SOURCES.get(source, {}).get("chemins", ()):
        if "{reference}" in motif:
            debut, fin = motif.split("{reference}")
            if chemin.startswith(debut) and chemin.endswith(fin) and CERTFR_ID.fullmatch(chemin[len(debut): len(chemin) - len(fin)]):
                return True
        elif chemin == motif:
            return True
    return False


def explication(erreur):
    if isinstance(erreur, Refus):
        return str(erreur)
    if isinstance(erreur, socket.gaierror):
        return "Nom d'hôte de la source introuvable depuis le serveur (DNS)."
    if isinstance(erreur, ConnectionRefusedError):
        return "Connexion refusée : la source n'écoute pas, ou un pare-feu la refuse."
    if isinstance(erreur, (TimeoutError, socket.timeout)):
        return "Délai dépassé : la source ne répond pas (pare-feu ou source indisponible)."
    if isinstance(erreur, ssl.SSLCertVerificationError):
        return "Certificat de la source refusé (%s)." % (erreur.verify_message or "vérification impossible")
    if isinstance(erreur, ssl.SSLError):
        return "Échec de la négociation TLS (%s)." % (erreur.reason or "erreur TLS")
    if isinstance(erreur, http.client.HTTPException):
        return "Réponse HTTP illisible."
    if isinstance(erreur, OSError):
        return "Réseau injoignable depuis le serveur (%s)." % (erreur.strerror or type(erreur).__name__)
    return "Échec de la lecture (%s)." % type(erreur).__name__


class Client:
    """Client HTTPS d'une source, limité à son hôte et à ses chemins. GET seulement ; aucune redirection suivie."""

    def __init__(self, source, debut=None, mandataire=None):
        self.source = source
        self.hote, self.port = destination(source)
        self.contexte = contexte()
        self.mandataire = mandataire
        if mandataire and mandataire["autorite"]:
            # Autorité de l'établissement ajoutée au magasin du système, pour les seules connexions par le mandataire.
            try:
                self.contexte.load_verify_locations(cadata=mandataire["autorite"])
            except (ssl.SSLError, ValueError):
                raise Refus("Autorité de certification de l'établissement illisible : rien n'a été lu.") from None
        self.debut = time.monotonic() if debut is None else debut

    def lire(self, chemin, requete=""):
        if not chemin_admis(self.source, chemin):
            raise Refus("Lecture refusée : %s hors de la liste fermée de la source." % chemin[:80])
        if requete and not re.fullmatch(r"[A-Za-z0-9=&,:.\-]{1,4000}", requete):
            raise Refus("Paramètres de lecture refusés.")
        if time.monotonic() - self.debut > DUREE_MAX:
            raise Refus("Durée maximale de la collecte atteinte : collecte interrompue.")
        maximum = REPONSE_MAX[self.source]
        if self.mandataire:
            connexion = ConnexionMandataire(self.hote, self.port, self.contexte, self.mandataire)
        else:
            connexion = http.client.HTTPSConnection(self.hote, self.port, timeout=DELAI_REQUETE, context=self.contexte)
        try:
            connexion.request("GET", chemin + ("?" + requete if requete else ""), headers={
                "Accept": "application/json, application/rss+xml, application/xml;q=0.9",
                "Accept-Encoding": "identity",
                "User-Agent": "suivi-audits-veille",
            })
            reponse = connexion.getresponse()
            if 300 <= reponse.status < 400:
                raise Refus("Redirection refusée (code %d) : la source n'est lue qu'à son adresse de la liste fermée." % reponse.status)
            if reponse.status == 429:
                raise Refus("Limite de débit de la source atteinte (code 429) : nouvel essai à la prochaine collecte.")
            if reponse.status != 200:
                raise Refus("Réponse inattendue de la source (code %d)." % reponse.status)
            longueur = reponse.getheader("Content-Length")
            if longueur is not None and (not longueur.strip().isdigit() or int(longueur) > maximum):
                raise Refus("Réponse trop volumineuse : refusée.")
            brut = reponse.read(maximum + 1)
            if len(brut) > maximum:
                raise Refus("Réponse trop volumineuse : refusée.")
        finally:
            connexion.close()
        return brut

    def json(self, chemin, requete=""):
        brut = self.lire(chemin, requete)  # hors du try : une erreur TLS est aussi une ValueError
        try:
            return json.loads(brut.decode("utf-8"))
        except (UnicodeDecodeError, ValueError, RecursionError):
            raise Refus("Réponse illisible : JSON attendu.") from None


# ------------------------------------------------------------------ RSS
def lire_rss(brut):
    """Éléments <item> d'un flux RSS 2.0 (title, link, description, guid, pubDate), en texte brut. UTF-8 seulement ; toute
    déclaration de type de document ou d'entité est refusée avant l'analyse ; profondeur et nombre d'éléments bornés."""
    try:
        s = brut.decode("utf-8")
    except UnicodeDecodeError:
        raise Refus("Flux RSS refusé : UTF-8 attendu.") from None
    minuscules = s.lower()
    if "<!doctype" in minuscules or "<!entity" in minuscules:
        raise Refus("Flux RSS refusé : déclaration de type de document ou d'entité.")
    analyseur = ET.XMLPullParser(events=("start", "end"))
    profondeur = nombre = 0
    items = []
    try:
        for i in range(0, len(s), 65536):
            analyseur.feed(s[i: i + 65536])
            for evenement, el in analyseur.read_events():
                if evenement == "start":
                    profondeur += 1
                    nombre += 1
                    if profondeur > RSS_PROFONDEUR_MAX or nombre > RSS_ELEMENTS_MAX:
                        raise Refus("Flux RSS refusé : trop profond ou trop d'éléments.")
                    continue
                profondeur -= 1
                if el.tag == "item":
                    if len(items) < RSS_ITEMS_MAX:
                        items.append({c.tag: c.text or "" for c in el if c.tag in ("title", "link", "description", "guid", "pubDate")})
                    el.clear()
        analyseur.close()
    except ET.ParseError:
        raise Refus("Flux RSS illisible.") from None
    return items


# ------------------------------------------------------------------ Sources
class Bilan:
    def __init__(self):
        self.ecartes = 0
        self.tronque = False
        self.details_echoues = 0


def kev(client, _parametres, bilan):
    d = client.json(SOURCES["cisa-kev"]["chemins"][0])
    liste = d.get("vulnerabilities") if isinstance(d, dict) else None
    if not isinstance(liste, list):
        raise Refus("Catalogue KEV illisible : liste « vulnerabilities » absente.")
    if len(liste) > ELEMENTS_MAX:
        bilan.tronque = True
    elements = []
    for v in liste[:ELEMENTS_MAX]:
        cve, ajout = (v.get("cveID"), date_iso(v.get("dateAdded"))) if isinstance(v, dict) else (None, None)
        if not (isinstance(cve, str) and CVE_ID.fullmatch(cve) and ajout):
            bilan.ecartes += 1
            continue
        rancon = v.get("knownRansomwareCampaignUse")
        elements.append({
            "cve": cve,
            "editeur": texte(v.get("vendorProject"), BORNES["editeur"]),
            "produit": texte(v.get("product"), BORNES["produit"]),
            "nom": texte(v.get("vulnerabilityName"), BORNES["nomFaille"]),
            "description": texte(v.get("shortDescription"), BORNES["description"]),
            "action": texte(v.get("requiredAction"), BORNES["action"]),
            "ajoutLe": ajout,
            "echeance": date_iso(v.get("dueDate")),
            "rancongiciel": True if rancon == "Known" else False if rancon == "Unknown" else None,
        })
    return elements


def cvss(metriques, cle, version, motif):
    """Score de NVD : la mesure « Primary » si elle existe, sinon la première ; forme contrôlée, sinon aucune."""
    liste = metriques.get(cle) if isinstance(metriques, dict) else None
    if not isinstance(liste, list) or not liste:
        return None
    choix = next((m for m in liste if isinstance(m, dict) and m.get("type") == "Primary"), liste[0])
    donnees = choix.get("cvssData") if isinstance(choix, dict) else None
    if not isinstance(donnees, dict) or donnees.get("version") != version:
        return None
    score, vecteur, gravite = donnees.get("baseScore"), donnees.get("vectorString"), donnees.get("baseSeverity")
    if (isinstance(score, (int, float)) and not isinstance(score, bool) and 0 <= score <= 10 and isinstance(vecteur, str)
            and len(vecteur) <= 400 and motif.fullmatch(vecteur) and gravite in GRAVITES):
        return {"score": round(float(score), 1), "vecteur": vecteur, "gravite": gravite}
    return None


def composantes_cpe(cpe):
    """Composantes d'un CPE 2.3 formaté (deux-points échappés par une barre oblique inverse), échappements retirés."""
    parts, courant, echappe = [], [], False
    for c in cpe[:500]:
        if echappe:
            courant.append(c)
            echappe = False
        elif c == "\\":
            echappe = True
        elif c == ":":
            parts.append("".join(courant))
            courant = []
        else:
            courant.append(c)
    parts.append("".join(courant))
    return parts


def noms_cpe(configurations):
    """Éditeurs et produits des CPE marqués vulnérables, sans doublon, bornés."""
    editeurs, produits = [], []
    for conf in configurations if isinstance(configurations, list) else ():
        for noeud in (conf.get("nodes") if isinstance(conf, dict) else None) or ():
            for m in (noeud.get("cpeMatch") if isinstance(noeud, dict) else None) or ():
                if not (isinstance(m, dict) and m.get("vulnerable") is True and isinstance(m.get("criteria"), str)):
                    continue
                p = composantes_cpe(m["criteria"])
                if len(p) < 5 or p[0] != "cpe" or p[1] != "2.3":
                    continue
                for valeur, liste in ((p[3], editeurs), (p[4], produits)):
                    if valeur not in ("*", "-", "") and NOM_CPE.fullmatch(valeur) and valeur not in liste and len(liste) < BORNES["nomsCpe"]:
                        liste.append(valeur)
    return editeurs, produits


def faille_nvd(v):
    c = v.get("cve") if isinstance(v, dict) else None
    if not isinstance(c, dict) or not isinstance(c.get("id"), str) or not CVE_ID.fullmatch(c["id"]):
        return None
    publie, modifie = horodatage_nvd(c.get("published")), horodatage_nvd(c.get("lastModified"))
    if not publie or not modifie:
        return None
    descriptions = c.get("descriptions") if isinstance(c.get("descriptions"), list) else []
    anglais = next((d.get("value") for d in descriptions if isinstance(d, dict) and d.get("lang") == "en"), "")
    editeurs, produits = noms_cpe(c.get("configurations"))
    metriques = c.get("metrics")
    return {
        "cve": c["id"],
        "publieLe": publie,
        "modifieLe": modifie,
        "description": texte(anglais, BORNES["description"]),
        "cvss31": cvss(metriques, "cvssMetricV31", "3.1", CVSS31_VECTEUR),
        "cvss40": cvss(metriques, "cvssMetricV40", "4.0", CVSS40_VECTEUR),
        "editeurs": editeurs,
        "produits": produits,
    }


def instant(v):
    if not (isinstance(v, str) and INSTANT.fullmatch(v)):
        raise Refus("Fenêtre de dates illisible : rien n'a été lu.")
    return dt.datetime.strptime(v[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=dt.timezone.utc)


def nvd(client, parametres, bilan):
    """Failles modifiées dans la fenêtre [depuis, jusqua] : jamais de recherche par produit ni par mot-clé."""
    depuis, jusqua = instant(parametres.get("depuis")), instant(parametres.get("jusqua"))
    if not dt.timedelta(0) < jusqua - depuis <= NVD_FENETRE_MAX:
        raise Refus("Fenêtre de dates refusée (120 jours au plus) : rien n'a été lu.")
    format_nvd = "%Y-%m-%dT%H:%M:%S.000Z"
    elements, vus, debut, total = [], set(), 0, 0
    for page in range(NVD_PAGES_MAX):
        if page:
            time.sleep(NVD_PAUSE)
        d = client.json(SOURCES["nvd"]["chemins"][0], "lastModStartDate=%s&lastModEndDate=%s&resultsPerPage=%d&startIndex=%d" % (
            depuis.strftime(format_nvd), jusqua.strftime(format_nvd), NVD_PAR_PAGE, debut))
        if not isinstance(d, dict) or not isinstance(d.get("vulnerabilities"), list) or not isinstance(d.get("totalResults"), int):
            raise Refus("Réponse de NVD illisible.")
        total, liste = d["totalResults"], d["vulnerabilities"][:NVD_PAR_PAGE]
        for v in liste:
            f = faille_nvd(v)
            if f is None:
                bilan.ecartes += 1
            elif f["cve"] not in vus:
                vus.add(f["cve"])
                elements.append(f)
        debut += len(liste)
        if not liste or debut >= total:
            break
    bilan.tronque = debut < total
    return elements


def nombre_epss(v):
    try:
        x = float(v) if isinstance(v, (str, int, float)) and not isinstance(v, bool) else None
    except ValueError:
        return None
    return x if x is not None and 0 <= x <= 1 else None


def epss(client, parametres, bilan):
    """Scores des failles reçues de l'application (déjà publiées par les sources), par paquets de cent."""
    cves = parametres.get("cves")
    if not isinstance(cves, list) or len(cves) > BORNES["epss"] or not all(isinstance(c, str) and CVE_ID.fullmatch(c) for c in cves):
        raise Refus("Liste de failles illisible : rien n'a été lu.")
    cves = list(dict.fromkeys(cves))
    elements = []
    for i in range(0, len(cves), EPSS_PAR_DEMANDE):
        if i:
            time.sleep(EPSS_PAUSE)
        paquet = cves[i: i + EPSS_PAR_DEMANDE]
        d = client.json(SOURCES["epss"]["chemins"][0], "cve=" + ",".join(paquet))
        if not isinstance(d, dict) or not isinstance(d.get("data"), list):
            raise Refus("Réponse d'EPSS illisible.")
        attendues = set(paquet)
        for x in d["data"][:EPSS_PAR_DEMANDE]:
            cve = x.get("cve") if isinstance(x, dict) else None
            score, centile, date = (nombre_epss(x.get("epss")), nombre_epss(x.get("percentile")), date_iso(x.get("date"))) if cve else (None, None, None)
            if cve not in attendues or score is None or centile is None or not date:
                bilan.ecartes += 1
                continue
            attendues.discard(cve)
            elements.append({"cve": cve, "score": score, "centile": centile, "date": date})
    return elements


def avis_rss(item, bilan):
    """Champs communs d'un élément RSS : titre (obligatoire), résumé, date."""
    titre = texte(item.get("title"), BORNES["titre"])
    if not titre:
        bilan.ecartes += 1
        return None
    return {"titre": titre, "resume": texte(item.get("description"), BORNES["resume"]), "publieLe": horodatage_rss(item.get("pubDate"))}


def cert_fr(client, parametres, bilan):
    """Flux RSS des alertes et des avis, puis export JSON (documenté par l'API du CERT-FR) des alertes et des avis nouveaux,
    pour leurs identifiants CVE. L'adresse gardée est recomposée à partir de l'identifiant contrôlé, sur l'hôte joint."""
    connus = parametres.get("connus", [])
    if not isinstance(connus, list) or len(connus) > 2000 or not all(isinstance(c, str) and CERTFR_ID.fullmatch(c) for c in connus):
        raise Refus("Liste des avis connus illisible : rien n'a été lu.")
    connus = set(connus)
    elements, vus, lus = [], set(), 0
    for nature, chemin in (("alerte", "/alerte/feed/"), ("avis", "/avis/feed/")):
        for item in lire_rss(client.lire(chemin)):
            m = REFERENCE_CERTFR.search(item.get("link") or "") or REFERENCE_CERTFR.search(item.get("guid") or "")
            reference = m.group(1) if m else None
            if not reference or ("-ALE-" in reference) != (nature == "alerte"):
                bilan.ecartes += 1
                continue
            commun = avis_rss(item, bilan)
            if not commun or reference in vus:
                continue
            vus.add(reference)
            cves, cves_lues = [], False
            if not (nature == "avis" and reference in connus):
                if lus >= CERTFR_DETAILS_MAX:
                    bilan.details_echoues += 1
                else:
                    if lus:
                        time.sleep(CERTFR_PAUSE)
                    lus += 1
                    try:
                        d = client.json("/%s/%s/json/" % (nature, reference))
                        if not isinstance(d, dict) or d.get("reference") != reference or not isinstance(d.get("cves"), list):
                            raise Refus("Export illisible.")
                        noms = [c.get("name") for c in d["cves"] if isinstance(c, dict)]
                        cves = list(dict.fromkeys(n for n in noms if isinstance(n, str) and CVE_ID.fullmatch(n)))[: BORNES["cvesParAvis"]]
                        cves_lues = True
                    except (Refus, OSError, http.client.HTTPException, ssl.SSLError):
                        bilan.details_echoues += 1
            elements.append({"identifiant": reference, "nature": nature, **commun,
                             "adresse": "https://%s/%s/%s/" % (SOURCES["cert-fr"]["hote"], nature, reference),
                             "cves": cves, "cvesLues": cves_lues})
    return elements


def cert_sante(client, _parametres, bilan):
    """Flux RSS : identifiant = numéro de l'élément (guid) ; CVE relevées dans le titre (« Produit - CVE-… ») et le résumé."""
    elements, vus = [], set()
    for item in lire_rss(client.lire(SOURCES["cert-sante"]["chemins"][0])):
        guid = (item.get("guid") or "").strip()
        if not CERTSANTE_ID.fullmatch(guid):
            bilan.ecartes += 1
            continue
        commun = avis_rss(item, bilan)
        if not commun or guid in vus:
            continue
        vus.add(guid)
        lien = (item.get("link") or "").strip()
        cves = list(dict.fromkeys(CVE_DANS_TEXTE.findall(commun["titre"] + " " + commun["resume"])))[: BORNES["cvesParAvis"]]
        elements.append({"identifiant": guid, "nature": "alerte", **commun,
                         "adresse": lien if ADRESSE_CERTSANTE.fullmatch(lien) else None,
                         "cves": [c for c in cves if CVE_ID.fullmatch(c)], "cvesLues": True})
    return elements


COLLECTES = {"cisa-kev": kev, "nvd": nvd, "epss": epss, "cert-fr": cert_fr, "cert-sante": cert_sante}


def executer(p):
    try:
        if not isinstance(p, dict):
            raise Refus("Demande illisible.")
        source, parametres = p.get("source"), p.get("parametres")
        if source not in COLLECTES or source not in SOURCES:
            raise Refus("Source inconnue : rien n'a été lu.")
        if not isinstance(parametres, dict):
            raise Refus("Demande illisible.")
        mandataire = lire_mandataire(p.get("mandataire"))
        bilan = Bilan()
        elements = COLLECTES[source](Client(source, mandataire=mandataire), parametres, bilan)
        if len(elements) > ELEMENTS_MAX:
            elements, bilan.tronque = elements[:ELEMENTS_MAX], True
        return {"ok": True, "elements": elements, "erreur": None,
                "bilan": {"elements": len(elements), "ecartes": bilan.ecartes, "tronque": bilan.tronque, "detailsEchoues": bilan.details_echoues}}
    except Exception as erreur:  # noqa: BLE001 - tout échec est expliqué, jamais propagé avec ses détails
        return {"ok": False, "elements": [], "bilan": None, "erreur": une_ligne(explication(erreur))}


def main():
    brut = sys.stdin.read(ENTREE_MAX + 1)
    try:
        p = json.loads(brut) if len(brut) <= ENTREE_MAX else None
    except ValueError:
        p = None
    sys.stdout.write(json.dumps(executer(p), ensure_ascii=True))


if __name__ == "__main__":
    main()

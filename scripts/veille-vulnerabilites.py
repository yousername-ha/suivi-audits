#!/usr/bin/env python3
"""Veille du module Vulnérabilités sur cinq sources publiques (ADR 0100, points 3 à 5 ; lots V2 et V3), et veille
réglementaire sur quatre flux officiels (ADR 0110, lot VR-1 : CNIL, CEPD, EUR-Lex, ANSSI), par le même mécanisme.

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
- CERT Santé (V23, V26) : après le flux RSS, la page (« fiche ») de chaque publication nouvelle ou dont le titre a changé
  (« | modifié le … ») et qui cite une CVE, sur le même hôte, au chemin tiré de l'adresse contrôlée du flux ; 30 fiches au
  plus par collecte, une seconde entre deux lectures, durée bornée. La page est lue avec html.parser, sans rien exécuter ni
  suivre ; seules des mentions structurées en sont tirées (texte exact d'un nœud, hors commentaires, attributs et scripts),
  jamais par mot-clé dans le texte libre : une mention absente, d'une forme imprévue ou contradictoire vaut « non
  renseigné » (null), jamais « non » ;
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
  la source ; RSS refusé s'il déclare un type de document ou une entité, profondeur et nombre d'éléments bornés ;
- veille réglementaire (SOURCES_REGLEMENTAIRES, recopiée de packages/shared/src/veille-reglementaire.ts) : un seul flux RSS
  par source, à son chemin exact ; titre, date, lien et, pour les seules sources de RESUME_REGLEMENTAIRE, résumé. ANSSI :
  le résumé n'est jamais lu. EUR-Lex : seuls les actes dont le titre contient un mot-clé de la liste reçue de l'application
  (parametres.motsCles, forme contrôlée et bornée) sont remontés ; les autres sont comptés comme écartés. Un titre ou un résumé trop long n'est pas tronqué (licence CC BY-ND de la CNIL : aucune
  modification du texte) : la publication est écartée (titre) ou gardée sans résumé ; lien gardé seulement en https sur
  l'hôte de la source, sinon la publication est écartée ; date illisible : écartée ;
- dictionnaire CPE de la NVD (ADR 0100, lot CPE-1 ; SOURCES_CPE, recopiée de packages/shared/src/dictionnaire-cpe.ts) :
  source « nvd-cpe », même hôte que la veille NVD, un seul chemin. Deux opérations : « dictionnaire » (une page à
  partir d'un indice reçu, sans aucune attente, ou les entrées modifiées pendant une fenêtre de dates ;
  produits distincts et, pour la copie complète, versions distinctes ; entrées obsolètes écartées) et « versions » (une
  page pour un éditeur et un produit reçus, versions distinctes non obsolètes, les plus récentes d'abord,
  BORNES_CPE["versions"] au plus). Rien d'autre n'est reçu de l'application que ces paramètres ; l'intitulé anglais est
  nettoyé, borné et privé de la version ;
- CVE inconnue de la veille (ADR 0100, lot CVE-INC ; SOURCES_CVE_INCONNUE, recopiée de packages/shared/src/cve-inconnue.ts) :
  source « cve-inconnue », sur le clic d'une personne, pour une seule CVE reçue (forme contrôlée) : l'enregistrement CVE JSON 5
  de cve.org (cveawg.mitre.org, chemin /api/cve/{cve}) réduit à une liste blanche (titre, description anglaise, dates, CNA,
  références https, produits déclarés, évaluation SSVC et mention KEV du conteneur ADP de la CISA), puis la même CVE chez NVD
  (paramètre cveId, même forme qu'une collecte NVD). Chaque partie a son état (trouvée, absente, échec) ;
- sources facultatives (SOURCES_ANNONCES, recopiée de packages/shared/src/annonces-veille.ts) : le flux JSON Feed des CVE
  annoncées de Cloudflare Radar (requête fixe format=json ; jamais les « briefings ») et le flux RSS 2.0 de tldrcve. Champs
  en liste blanche, clés inconnues ignorées, textes simples bornés, liens gardés seulement en https sur l'hôte de la source.
  Le filtre par produit surveillé du préavis est fait par l'API : le script ne reçoit aucun nom de produit.
"""
import base64
import datetime as dt
import functools
from email.utils import parsedate_to_datetime
import hashlib
import html
from html.parser import HTMLParser
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
SOURCES = {"cisa-kev": {"hote": "www.cisa.gov", "chemins": ["/sites/default/files/feeds/known_exploited_vulnerabilities.json"]}, "nvd": {"hote": "services.nvd.nist.gov", "chemins": ["/rest/json/cves/2.0"]}, "epss": {"hote": "api.first.org", "chemins": ["/data/v1/epss"]}, "cert-fr": {"hote": "cert.cyber.gouv.fr", "chemins": ["/alerte/feed/", "/avis/feed/", "/alerte/{reference}/json/", "/avis/{reference}/json/"]}, "cert-sante": {"hote": "cyberveille.esante.gouv.fr", "chemins": ["/alertes-et-vulnerabilites/rss.xml", "/alertes/{slug}"]}}
# Veille réglementaire (ADR 0110) : hôte et chemin exact du flux de chaque source, sources dont le résumé est gardé, bornes ;
# recopiés de packages/shared/src/veille-reglementaire.ts et comparés par apps/api/test/veille-reglementaire-architecture.test.ts.
SOURCES_REGLEMENTAIRES = {"cnil": {"hote": "www.cnil.fr", "chemins": ["/fr/rss.xml"]}, "cepd": {"hote": "www.edpb.europa.eu", "chemins": ["/feed/publications_en"]}, "eur-lex": {"hote": "eur-lex.europa.eu", "chemins": ["/EN/display-feed.rss?rssId=222"]}, "anssi": {"hote": "cyber.gouv.fr", "chemins": ["/actualites/rss/"]}}
RESUME_REGLEMENTAIRE = ["cnil", "cepd", "eur-lex"]
BORNES_REGLEMENTAIRES = {"identifiant": 300, "titre": 300, "resume": 1000, "lien": 500, "items": 200, "motsCles": 60, "motCle": 60}
DOMAINES_REGLEMENTAIRES = ("securite", "donnees-personnelles")
# Dictionnaire CPE (ADR 0100, lot CPE-1) : hôte et chemin exacts, recopiés de SOURCE_DICTIONNAIRE_CPE
# (packages/shared/src/dictionnaire-cpe.ts) et comparés par apps/api/test/veille-architecture.test.ts ; bornes de CPE_BORNES.
SOURCES_CPE = {"nvd-cpe": {"hote": "services.nvd.nist.gov", "chemins": ["/rest/json/cpes/2.0"]}}
BORNES_CPE = {"parPage": 10000, "pagesParPassage": 1, "versions": 2000, "intitule": 300}
# CVE inconnue (ADR 0100, lot CVE-INC) : hôte nouveau de cve.org ({cve} : identifiant contrôlé par CVE_ID), recopié de
# SOURCE_CVE_ORG (packages/shared/src/cve-inconnue.ts) ; NVD est lu par la source « nvd » ci-dessus. Bornes de CVE_INCONNUE_BORNES.
SOURCES_CVE_INCONNUE = {"cve-org": {"hote": "cveawg.mitre.org", "chemins": ["/api/cve/{cve}"]}}
BORNES_CVE_INCONNUE = {"titre": 300, "description": 1000, "cna": 60, "references": 20, "reference": 500, "nomReference": 200, "produits": 20, "editeur": 200, "produit": 200, "versionsParProduit": 10}
# Sources facultatives (lot CVE-INC) : hôte, chemin et requête fixe, recopiés de SOURCES_ANNONCES_DEFINITIONS
# (packages/shared/src/annonces-veille.ts) ; bornes d'ANNONCES_BORNES.
SOURCES_ANNONCES = {"cloudflare-radar": {"hote": "radar.cloudflare.com", "chemins": ["/zero-wire/cves/feed"]}, "tldrcve": {"hote": "tldrcve.com", "chemins": ["/feed.xml"]}}
REQUETES_ANNONCES = {"cloudflare-radar": "format=json", "tldrcve": ""}
BORNES_ANNONCES = {"identifiant": 300, "titre": 300, "resume": 1000, "lien": 500, "verdict": 200, "cvesParAnnonce": 20, "items": 500}
TOUTES_SOURCES = {**SOURCES, **SOURCES_REGLEMENTAIRES, **SOURCES_CPE, **SOURCES_CVE_INCONNUE, **SOURCES_ANNONCES}
# Bornes, recopiées de VEILLE_BORNES (packages/shared) et comparées par le même test.
BORNES = {"titre": 300, "resume": 1000, "description": 1000, "action": 1000, "nomFaille": 300, "editeur": 200, "produit": 200, "nomsCpe": 20, "produitsTouches": 20, "cvesParAvis": 200, "fichesCertSante": 30, "lot": 500, "lots": 40, "epss": 2000}
CVE_ID = re.compile(r"^CVE-[12]\d{3}-\d{4,9}$")
CERTFR_ID = re.compile(r"^CERTFR-20\d{2}-(?:ALE|AVI)-\d{2,4}$")
CERTSANTE_ID = re.compile(r"^[1-9]\d{0,9}$")
ADRESSE_CERTSANTE = re.compile(r"^https:\/\/cyberveille\.esante\.gouv\.fr\/alertes\/[a-z0-9-]{1,200}$")
SLUG_CERTSANTE = re.compile(r"^[a-z0-9-]{1,200}$")
CVSS31_VECTEUR = re.compile(r"^CVSS:3\.1(?:\/[A-Z]{1,3}:[A-Z]{1,2}){8,20}$")
CVSS40_VECTEUR = re.compile(r"^CVSS:4\.0(?:\/[A-Za-z]{1,3}:[A-Za-z]{1,10}){11,40}$")
NOM_CPE = re.compile(r"^[\x21-\x3b\x3d\x3f-\x7e]{1,100}$")
VERSION_CPE = re.compile(r"^[\x21-\x3b\x3d\x3f-\x7e]{1,60}$")
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
REPONSE_MAX.update({s: 2 * 1024 * 1024 for s in SOURCES_REGLEMENTAIRES})
REPONSE_MAX["nvd-cpe"] = 32 * 1024 * 1024
REPONSE_MAX.update({"cve-org": 1024 * 1024, "cloudflare-radar": 4 * 1024 * 1024, "tldrcve": 2 * 1024 * 1024})
# Dictionnaire CPE : une seule page par tranche, sans aucune attente dans le script ; le débit de la NVD (une demande toutes
# les 6,5 secondes au plus pour les versions, cinq par trente secondes sans clé) est tenu par l'exécutant.
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
# CERT Santé : fiches (pages HTML d'environ 35 Kio, relevé du 16/11/2026) bornées en taille, une seconde entre deux lectures,
# plus aucune lecture de fiche passé FICHE_DUREE_MAX secondes de collecte (la collecte entière reste sous DUREE_MAX).
FICHE_MAX = 512 * 1024
FICHE_PAUSE = 1
FICHE_DUREE_MAX = 150
FICHE_FRAGMENTS_MAX = 20000
# Fiches déjà lues, reçues de l'application : identifiant -> empreinte du titre lu (16 caractères hexadécimaux).
FICHES_LUES_MAX = 2000
EMPREINTE = re.compile(r"^[0-9a-f]{16}$")
# Titre du flux : « Produit - CVE-… », suivi au besoin de « | modifié le JJ-MM-AAAA ».
PRODUIT_TITRE = re.compile(r"^(.{1,200}?) - CVE-[12]\d{3}-\d{4,9}(?:\s|$)")
# RSS : profondeur et nombre d'éléments XML bornés, éléments <item> gardés bornés.
RSS_PROFONDEUR_MAX = 8
RSS_ELEMENTS_MAX = 5000
RSS_ITEMS_MAX = 200

BALISE = re.compile(r"<[A-Za-z/!?][^<>]{0,2000}>")
BLOC_ACTIF = re.compile(r"<(script|style)\b[^>]{0,2000}>.{0,100000}?</\1\s*>", re.IGNORECASE | re.DOTALL)
INVISIBLES = ("Cc", "Cf", "Co", "Cs", "Zl", "Zp")


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
    """Erreur expliquée, sans contenu de réponse."""


class Introuvable(Refus):
    """cve.org ne connaît pas l'identifiant demandé (code 404) : ce n'est pas un échec de la lecture."""


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
    return TOUTES_SOURCES[source]["hote"], 443


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
    for motif in TOUTES_SOURCES.get(source, {}).get("chemins", ()):
        for variable, forme in (("{reference}", CERTFR_ID), ("{slug}", SLUG_CERTSANTE), ("{cve}", CVE_ID)):
            if variable in motif:
                debut, fin = motif.split(variable)
                if (len(chemin) > len(debut) + len(fin) and chemin.startswith(debut) and chemin.endswith(fin)
                        and forme.fullmatch(chemin[len(debut): len(chemin) - len(fin)])):
                    return True
                break
        else:
            if chemin == motif:
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

    def lire(self, chemin, requete="", maximum=None):
        if not chemin_admis(self.source, chemin):
            raise Refus("Lecture refusée : %s hors de la liste fermée de la source." % chemin[:80])
        if requete and (not re.fullmatch(r"[A-Za-z0-9=&,:._~%\-]{1,4000}", requete)
                        or chemin not in TOUTES_SOURCES[self.source]["chemins"]):
            raise Refus("Paramètres de lecture refusés.")
        if time.monotonic() - self.debut > DUREE_MAX:
            raise Refus("Durée maximale de la collecte atteinte : collecte interrompue.")
        maximum = maximum or REPONSE_MAX[self.source]
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
            if reponse.status == 404 and self.source == "cve-org":
                raise Introuvable("Identifiant inconnu de cve.org (code 404).")
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
        if trop_imbrique(brut):
            raise Refus("Réponse illisible : JSON attendu (imbrication excessive).")
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


BORNES_PLAGE = (("versionStartIncluding", "debutInclus"), ("versionStartExcluding", "debutExclus"),
                ("versionEndIncluding", "finInclus"), ("versionEndExcluding", "finExclus"))
SANS_VERSION = ("*", "-", "")


def produit_touche(m):
    """Un produit touché tiré d'une entrée « cpeMatch » (lot V4a) : partie, éditeur et produit du CPE, version exacte s'il en
    porte une, bornes de la plage, drapeau « vulnérable ». None si le CPE est illisible. Une version ou une borne de forme
    inattendue, ou une mise à jour précisée (« update » du CPE), fait retirer version et bornes : la plage devient absente
    et le rapprochement reste à décider par une personne, jamais écarté à tort."""
    if not (isinstance(m, dict) and isinstance(m.get("criteria"), str) and isinstance(m.get("vulnerable"), bool)):
        return None
    p = composantes_cpe(m["criteria"])
    if len(p) < 7 or p[0] != "cpe" or p[1] != "2.3" or p[2] not in ("a", "o", "h"):
        return None
    if p[3] in SANS_VERSION or p[4] in SANS_VERSION or not NOM_CPE.fullmatch(p[3]) or not NOM_CPE.fullmatch(p[4]):
        return None
    e = {"partie": p[2], "editeur": p[3], "produit": p[4], "version": None, "debutInclus": None, "debutExclus": None,
         "finInclus": None, "finExclus": None, "vulnerable": m["vulnerable"]}
    lisible = p[6] in SANS_VERSION
    if p[5] not in SANS_VERSION:
        lisible = lisible and bool(VERSION_CPE.fullmatch(p[5]))
        e["version"] = p[5]
    for cle, champ in BORNES_PLAGE:
        borne = m.get(cle)
        if borne is None:
            continue
        lisible = lisible and isinstance(borne, str) and bool(VERSION_CPE.fullmatch(borne))
        e[champ] = borne
    if (e["debutInclus"] is not None and e["debutExclus"] is not None) or (e["finInclus"] is not None and e["finExclus"] is not None):
        lisible = False
    if not lisible:
        for champ in ("version", "debutInclus", "debutExclus", "finInclus", "finExclus"):
            e[champ] = None
    return e


def produits_touches(configurations):
    """Produits touchés d'une CVE, sans doublon : les vulnérables d'abord, puis les conditions de plateforme, bornés.
    Renvoie (liste, tronque) ; `tronque` : un produit vulnérable n'a pas pu être gardé."""
    vulnerables, autres = [], []
    for conf in configurations if isinstance(configurations, list) else ():
        for noeud in (conf.get("nodes") if isinstance(conf, dict) else None) or ():
            for m in (noeud.get("cpeMatch") if isinstance(noeud, dict) else None) or ():
                e = produit_touche(m)
                if e is None:
                    continue
                liste = vulnerables if e["vulnerable"] else autres
                if e not in liste:
                    liste.append(e)
    garde = (vulnerables + autres)[: BORNES["produitsTouches"]]
    return garde, len(vulnerables) > BORNES["produitsTouches"]


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
    touches, tronques = produits_touches(c.get("configurations"))
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
        "produitsTouches": touches,
        "produitsTronques": tronques,
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


# ------------------------------------------------------------------ Fiches du CERT Santé
# Libellés exacts relevés sur les fiches le 16/11/2026 (quinze fiches, une seule forme) : chaque libellé est le texte entier
# d'un nœud, suivi du nœud de la valeur (« Oui » ou « Non »). La rubrique « Preuve de concept » est suivie d'une phrase ;
# seules les deux phrases observées sont reconnues. Le score figure dans un lien « [Score CVSS v3.1 : 7.5] ».
FICHE_MENTIONS = {
    "La faille est activement exploitée :": "exploitee",
    "Un correctif existe :": "correctif",
    "Une mesure de contournement existe :": "contournement",
}
FICHE_OUI_NON = {"Oui": "oui", "Non": "non"}
FICHE_PREUVE = "Preuve de concept"
FICHE_PREUVES = {
    "Actuellement, aucune preuve de concept n'est disponible en sources ouvertes.": "indisponible",
    "Une preuve de concept est disponible en sources ouvertes.": "disponible",
}
FICHE_SCORE = re.compile(r"^\[Score CVSS v3\.1 : (\d{1,2}(?:\.\d)?)\]$")
# Éléments de bloc : une valeur n'est lue que dans le même bloc que son libellé (« <p><span>libellé</span> Oui</p> »).
FICHE_BLOCS = ("p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "table", "tr", "td", "th", "section",
               "article", "header", "footer", "main", "nav", "aside", "dl", "dt", "dd", "blockquote", "form", "body",
               "html", "pre")
# Éléments dont le contenu n'est jamais lu (code, styles, gabarits, en-tête, objets embarqués).
FICHE_IGNORES = ("script", "style", "template", "noscript", "textarea", "head", "title", "iframe", "object", "svg", "math")


class Fragments(HTMLParser):
    """Texte d'une page découpé aux balises : un fragment (texte, numéro de bloc) par nœud de texte, espaces réduits,
    apostrophe typographique ramenée à l'apostrophe simple. Commentaires, déclarations, instructions et attributs ne
    produisent aucun texte ; le contenu des éléments de FICHE_IGNORES est écarté. Rien n'est exécuté ni suivi."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.fragments = []
        self.tampon = []
        self.ignore = 0
        self.bloc = 0

    def vider(self):
        t = " ".join("".join(self.tampon).replace("\u2019", "'").split())
        self.tampon = []
        if t and not self.ignore:
            if len(self.fragments) >= FICHE_FRAGMENTS_MAX:
                raise Refus("Fiche refusée : trop de fragments.")
            self.fragments.append((t, self.bloc))

    def balise(self, tag):
        self.vider()
        if tag in FICHE_BLOCS:
            self.bloc += 1

    def handle_starttag(self, tag, attrs):
        self.balise(tag)
        if tag in FICHE_IGNORES:
            self.ignore += 1

    def handle_startendtag(self, tag, attrs):
        self.balise(tag)

    def handle_endtag(self, tag):
        self.balise(tag)
        if tag in FICHE_IGNORES and self.ignore:
            self.ignore -= 1

    def handle_data(self, data):
        if not self.ignore:
            self.tampon.append(data)


def unique(valeurs):
    """Valeur d'une mention lue une ou plusieurs fois : la même partout, sinon null (contradiction ou forme imprévue)."""
    return valeurs[0] if valeurs and None not in valeurs and len(set(valeurs)) == 1 else None


def lire_fiche(brut):
    """Mentions structurées d'une fiche : exploitée, correctif, contournement (oui, non, null), preuve de concept
    (disponible, indisponible, null), score CVSS v3.1 (null s'il n'a pas une forme valide)."""
    try:
        page = brut.decode("utf-8")
    except UnicodeDecodeError:
        raise Refus("Fiche refusée : UTF-8 attendu.") from None
    f = Fragments()
    try:
        f.feed(page)
        f.close()
    except (AssertionError, ValueError):
        raise Refus("Fiche illisible.") from None
    f.vider()
    lu = {cle: [] for cle in FICHE_MENTIONS.values()}
    preuves, scores = [], []
    fr = f.fragments
    for i, (x, bloc) in enumerate(fr):
        # Valeur : le fragment suivant, s'il est dans le même bloc que le libellé.
        suivant = fr[i + 1][0] if i + 1 < len(fr) and fr[i + 1][1] == bloc else None
        if x in FICHE_MENTIONS:
            lu[FICHE_MENTIONS[x]].append(FICHE_OUI_NON.get(suivant))
        elif x == FICHE_PREUVE:
            preuves.append(FICHE_PREUVES.get(suivant))
        else:
            m = FICHE_SCORE.fullmatch(x)
            if m:
                score = float(m.group(1))
                scores.append(score if 0 <= score <= 10 else None)
    return {"exploitee": unique(lu["exploitee"]), "correctif": unique(lu["correctif"]),
            "contournement": unique(lu["contournement"]), "preuveConcept": unique(preuves), "cvss31": unique(scores)}


def empreinte_titre(titre):
    return hashlib.sha256(titre.encode("utf-8")).hexdigest()[:16]


def fiches_lues(parametres):
    lues = parametres.get("lues", {})
    if (not isinstance(lues, dict) or len(lues) > FICHES_LUES_MAX
            or not all(isinstance(k, str) and CERTSANTE_ID.fullmatch(k) and isinstance(e, str) and EMPREINTE.fullmatch(e)
                       for k, e in lues.items())):
        raise Refus("Liste des fiches déjà lues illisible : rien n'a été lu.")
    return lues


def cert_sante(client, parametres, bilan):
    """Flux RSS : identifiant = numéro de l'élément (guid) ; CVE relevées dans le titre (« Produit - CVE-… ») et le résumé ;
    produit tiré du titre. Puis la fiche des publications qui citent une CVE, nouvelles ou dont le titre a changé depuis la
    lecture précédente (empreinte reçue de l'application), dans les bornes de la collecte. Une fiche non lue (borne, échec)
    est comptée dans `detailsEchoues` et rendue à null : l'application garde les mentions déjà lues."""
    lues = fiches_lues(parametres)
    elements, vus, lus = [], set(), 0
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
        adresse = lien if ADRESSE_CERTSANTE.fullmatch(lien) else None
        cves = list(dict.fromkeys(CVE_DANS_TEXTE.findall(commun["titre"] + " " + commun["resume"])))[: BORNES["cvesParAvis"]]
        cves = [c for c in cves if CVE_ID.fullmatch(c)]
        m = PRODUIT_TITRE.match(commun["titre"])
        produit = texte(m.group(1), BORNES["produit"]) if m else ""
        fiche = None
        if cves and adresse and lues.get(guid) != empreinte_titre(commun["titre"]):
            if lus >= BORNES["fichesCertSante"] or time.monotonic() - client.debut > FICHE_DUREE_MAX:
                bilan.details_echoues += 1
            else:
                if lus:
                    time.sleep(FICHE_PAUSE)
                lus += 1
                try:
                    fiche = lire_fiche(client.lire(adresse[len("https://" + SOURCES["cert-sante"]["hote"]):], maximum=FICHE_MAX))
                except (Refus, OSError, http.client.HTTPException, ssl.SSLError):
                    bilan.details_echoues += 1
        elements.append({"identifiant": guid, "nature": "alerte", **commun, "adresse": adresse, "cves": cves,
                         "cvesLues": True, "produit": produit or None, "fiche": fiche})
    return elements


# ------------------------------------------------------------------ Veille réglementaire (ADR 0110)
CARACTERES_LIEN = re.compile(r"^[\x21-\x7e]+$")


def texte_entier(brut, maximum):
    """Texte simple (balises retirées, comme texte()), mais jamais tronqué : None s'il dépasse la borne ou s'il est vide."""
    s = texte(brut, maximum * 20)
    return s if s and len(s) <= maximum else None


def lien_reglementaire(source, brut):
    """Lien gardé seulement en https sur l'hôte exact de la source, sans espace, guillemet ni chevron, borné."""
    lien = (brut or "").strip() if isinstance(brut, str) else ""
    prefixe = "https://%s/" % SOURCES_REGLEMENTAIRES[source]["hote"]
    if (len(lien) > BORNES_REGLEMENTAIRES["lien"] or not lien.startswith(prefixe) or not CARACTERES_LIEN.fullmatch(lien)
            or any(c in lien for c in "\"'<>\\`")):
        return None
    return lien


def normaliser(t):
    """Forme comparée (normaliserMotCle de packages/shared) : sans accent, en minuscules, tout ce qui n'est ni lettre ni
    chiffre réduit à une espace."""
    t = "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn").lower()
    return " ".join(re.sub(r"[^a-z0-9]+", " ", t).split())


def mots_cles(parametres):
    """Mots-clés d'EUR-Lex reçus de l'application : liste de 1 à 60 objets {mot, domaine}, mot de 2 à 60 caractères ;
    renvoie [(forme comparée, domaine)]. Forme inattendue : rien n'est lu."""
    l = parametres.get("motsCles") if isinstance(parametres, dict) else None
    illisible = Refus("Liste des mots-clés illisible : rien n'a été lu.")
    if not isinstance(l, list) or not 1 <= len(l) <= BORNES_REGLEMENTAIRES["motsCles"]:
        raise illisible
    out = []
    for m in l:
        if not isinstance(m, dict) or set(m) != {"mot", "domaine"} or m["domaine"] not in DOMAINES_REGLEMENTAIRES:
            raise illisible
        mot = m["mot"]
        if not isinstance(mot, str) or not 2 <= len(mot.strip()) <= BORNES_REGLEMENTAIRES["motCle"] or len(normaliser(mot)) < 2:
            raise illisible
        out.append((normaliser(mot), m["domaine"]))
    return out


def domaine_titre(titre, mots):
    """Domaine du mot-clé trouvé (mot entier) ; données personnelles l'emporte ; None si aucun."""
    t = " %s " % normaliser(titre)
    trouves = {d for m, d in mots if " %s " % m in t}
    return "donnees-personnelles" if "donnees-personnelles" in trouves else ("securite" if trouves else None)


def reglementaire(source):
    """Collecteur d'une source réglementaire : le flux RSS à son chemin exact, une publication par élément <item>."""
    def collecter(client, parametres, bilan):
        elements, vus = [], set()
        mots = mots_cles(parametres) if source == "eur-lex" else None
        items = lire_rss(client.lire(SOURCES_REGLEMENTAIRES[source]["chemins"][0]))
        if len(items) >= BORNES_REGLEMENTAIRES["items"]:
            bilan.tronque = True
        for item in items[: BORNES_REGLEMENTAIRES["items"]]:
            titre = texte_entier(item.get("title"), BORNES_REGLEMENTAIRES["titre"])
            lien = lien_reglementaire(source, item.get("link"))
            publie = horodatage_rss(item.get("pubDate"))
            guid = texte_entier(item.get("guid"), BORNES_REGLEMENTAIRES["identifiant"])
            identifiant = guid or lien
            if not (titre and lien and publie and identifiant) or identifiant in vus:
                bilan.ecartes += 1
                continue
            # EUR-Lex : un acte sans mot-clé n'est pas remonté, seulement compté.
            if mots is not None and domaine_titre(titre, mots) is None:
                bilan.ecartes += 1
                continue
            vus.add(identifiant)
            # ANSSI : la description du flux n'est jamais lue (décision du RSSI du 20/11/2026).
            resume = texte_entier(item.get("description"), BORNES_REGLEMENTAIRES["resume"]) if source in RESUME_REGLEMENTAIRE else None
            elements.append({"identifiant": identifiant, "titre": titre, "resume": resume, "lien": lien, "publieLe": publie})
        return elements
    return collecter


# ------------------------------------------------------------------ Dictionnaire CPE de la NVD (ADR 0100, lot CPE-1)
PARTIES_CPE = ("a", "o", "h")


def echapper_cpe(v):
    """Échappement d'une composante au format « chaîne formatée » du CPE 2.3 : lettres, chiffres, « _ », « - » et « . »
    tels quels, tout autre caractère précédé d'une barre oblique inverse (echapperComposanteCpe de packages/shared)."""
    return re.sub(r"[^A-Za-z0-9_.\-]", lambda m: "\\" + m.group(0), v)


def pourcent(v):
    """Encodage d'URL d'un paramètre, écrit ici (aucun module de requêtes de haut niveau dans ce script) : lettres,
    chiffres, « _ », « . », « ~ », « - » et « : » tels quels, tout autre octet en %XX."""
    return "".join(c if re.fullmatch(r"[A-Za-z0-9_.~:\-]", c) else "".join("%%%02X" % o for o in c.encode("utf-8")) for c in v)


def nom_cpe_valide(v):
    return isinstance(v, str) and v not in SANS_VERSION and bool(NOM_CPE.fullmatch(v))


def morceaux_version(v):
    return [int(m[:15]) if m[0].isdigit() else m for m in re.findall(r"\d+|[a-z]+", v.lower())]


def comparer_versions(a, b):
    """Même règle que comparerVersionsCpe (packages/shared) : nombres comparés comme des nombres, lettres dans l'ordre
    alphabétique, un nombre l'emporte sur des lettres ; un morceau de plus en chiffres rend la version plus récente, en
    lettres plus ancienne ; à égalité, ordre des textes."""
    x, y = morceaux_version(a), morceaux_version(b)
    for i in range(max(len(x), len(y))):
        u = x[i] if i < len(x) else None
        w = y[i] if i < len(y) else None
        if u is None:
            return -1 if isinstance(w, int) else 1
        if w is None:
            return 1 if isinstance(u, int) else -1
        if isinstance(u, int) and isinstance(w, int):
            if u != w:
                return -1 if u < w else 1
        elif isinstance(u, int):
            return 1
        elif isinstance(w, int):
            return -1
        elif u != w:
            return -1 if u < w else 1
    return -1 if a < b else 1 if a > b else 0


def versions_triees(versions, maximum):
    """Versions distinctes, de la plus récente à la plus ancienne, bornées."""
    return sorted(set(versions), key=functools.cmp_to_key(comparer_versions), reverse=True)[:maximum]


def titre_sans_version(titre, version):
    """Intitulé sans la version, retirée seulement en mot entier (intituleSansVersion de packages/shared)."""
    t = titre.strip()
    if not version or version in SANS_VERSION:
        return t
    motif = " " + version
    i = t.rfind(motif)
    while i > 0:
        apres = t[i + len(motif): i + len(motif) + 1]
        if apres in ("", " "):
            return t[:i].strip() or t
        i = t.rfind(motif, 0, i)
    return t


def entree_cpe(p):
    """Une entrée du dictionnaire : partie, éditeur, produit (échappements retirés), version (None pour « * », « - » ou une
    forme non admise), intitulé anglais nettoyé, borné et privé de la version, drapeau « obsolète ». None si le nom CPE est
    illisible."""
    c = p.get("cpe") if isinstance(p, dict) else None
    nom = c.get("cpeName") if isinstance(c, dict) else None
    if not isinstance(nom, str) or len(nom) > 500:
        return None
    parts = composantes_cpe(nom)
    if len(parts) != 13 or parts[0] != "cpe" or parts[1] != "2.3" or parts[2] not in PARTIES_CPE:
        return None
    if not nom_cpe_valide(parts[3]) or not nom_cpe_valide(parts[4]):
        return None
    version = parts[5] if parts[5] not in SANS_VERSION and VERSION_CPE.fullmatch(parts[5]) else None
    titres = c.get("titles") if isinstance(c.get("titles"), list) else []
    anglais = next((t.get("title") for t in titres if isinstance(t, dict) and t.get("lang") == "en"), None)
    intitule = texte(anglais, BORNES_CPE["intitule"] * 4) if isinstance(anglais, str) else ""
    intitule = titre_sans_version(intitule, version)[: BORNES_CPE["intitule"]].strip() if intitule else ""
    return {"partie": parts[2], "editeur": parts[3], "produit": parts[4], "version": version,
            "intitule": intitule or None, "obsolete": c.get("deprecated") is True}


def page_cpe(client, requete):
    d = client.json(SOURCES_CPE["nvd-cpe"]["chemins"][0], requete)
    if (not isinstance(d, dict) or not isinstance(d.get("products"), list) or not isinstance(d.get("totalResults"), int)
            or isinstance(d.get("totalResults"), bool) or not 0 <= d["totalResults"] <= 10000000):
        raise Refus("Réponse du dictionnaire CPE illisible.")
    return d["products"][: BORNES_CPE["parPage"]], d["totalResults"]


def entier_borne(v, mini, maxi):
    return isinstance(v, int) and not isinstance(v, bool) and mini <= v <= maxi


def cpe_dictionnaire(client, parametres, bilan):
    """Une page du dictionnaire (BORNES_CPE["pagesParPassage"]) à partir de l'indice reçu, sans attente (ou des entrées modifiées pendant une fenêtre de dates) :
    produits distincts (premier intitulé gardé) et, si la copie complète est demandée, versions distinctes ; entrées
    obsolètes écartées et comptées. Jamais de recherche par produit."""
    debut, pages, avec_versions = parametres.get("debut"), parametres.get("pages"), parametres.get("versions")
    if (not entier_borne(debut, 0, 10000000) or not entier_borne(pages, 1, BORNES_CPE["pagesParPassage"])
            or not isinstance(avec_versions, bool)):
        raise Refus("Demande de tranche illisible : rien n'a été lu.")
    fenetre = ""
    if "depuis" in parametres or "jusqua" in parametres:
        depuis, jusqua = instant(parametres.get("depuis")), instant(parametres.get("jusqua"))
        if not dt.timedelta(0) < jusqua - depuis <= NVD_FENETRE_MAX:
            raise Refus("Fenêtre de dates refusée (120 jours au plus) : rien n'a été lu.")
        f = "%Y-%m-%dT%H:%M:%S.000Z"
        fenetre = "&lastModStartDate=%s&lastModEndDate=%s" % (depuis.strftime(f), jusqua.strftime(f))
    produits, versions = {}, set()
    indice, total, entrees, obsoletes = debut, 0, 0, 0
    for _page in range(pages):
        liste, total = page_cpe(client, "resultsPerPage=%d&startIndex=%d%s" % (BORNES_CPE["parPage"], indice, fenetre))
        if not liste and indice < total:
            raise Refus("Page vide du dictionnaire CPE avant la fin annoncée : nouvel essai plus tard.")
        for p in liste:
            e = entree_cpe(p)
            if e is None:
                bilan.ecartes += 1
                continue
            entrees += 1
            if e["obsolete"]:
                obsoletes += 1
                continue
            cle = (e["partie"], e["editeur"], e["produit"])
            if produits.get(cle) is None:
                produits[cle] = e["intitule"]
            if avec_versions and e["version"]:
                versions.add(cle + (e["version"],))
        indice += len(liste)
        if not liste or indice >= total:
            break
    return {
        "produits": [{"partie": k[0], "editeur": k[1], "produit": k[2], "intitule": v} for k, v in produits.items()],
        "versions": [{"partie": k[0], "editeur": k[1], "produit": k[2], "version": k[3]} for k in sorted(versions)],
        "bilan": {"total": total, "suivant": min(indice, total), "entrees": entrees, "obsoletes": obsoletes},
    }


def cpe_versions(client, parametres, bilan):
    """Versions d'un éditeur et d'un produit reçus de l'application : une page (nom CPE commençant par la partie, l'éditeur
    et le produit), entrées du même produit seulement, obsolètes écartées, les plus récentes d'abord, bornées."""
    partie, editeur, produit = parametres.get("partie"), parametres.get("editeur"), parametres.get("produit")
    if partie not in PARTIES_CPE or not nom_cpe_valide(editeur) or not nom_cpe_valide(produit):
        raise Refus("Produit demandé illisible : rien n'a été lu.")
    motif = "cpe:2.3:%s:%s:%s" % (partie, echapper_cpe(editeur), echapper_cpe(produit))
    liste, total = page_cpe(client, "cpeMatchString=%s&resultsPerPage=%d" % (
        pourcent(motif), BORNES_CPE["parPage"]))
    trouvees = set()
    for p in liste:
        e = entree_cpe(p)
        if e is None:
            bilan.ecartes += 1
        elif (e["partie"], e["editeur"], e["produit"]) == (partie, editeur, produit) and not e["obsolete"] and e["version"]:
            trouvees.add(e["version"])
    bilan.tronque = total > len(liste) or len(trouvees) > BORNES_CPE["versions"]
    return versions_triees(trouvees, BORNES_CPE["versions"])


def cpe(client, parametres, bilan):
    operation = parametres.get("operation")
    if operation == "dictionnaire":
        return cpe_dictionnaire(client, parametres, bilan)
    if operation == "versions":
        return cpe_versions(client, parametres, bilan)
    raise Refus("Opération inconnue : rien n'a été lu.")


# ------------------------------------------------------------------ CVE inconnue de la veille (ADR 0100, lot CVE-INC)
INSTANT_RFC3339 = re.compile(r"^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:?\d{2})?$")
CNA_CVE = re.compile(r"^[A-Za-z0-9_.-]{1,60}$")
REFERENCE_CVE = re.compile(r"^https:\/\/[A-Za-z0-9.-]{1,253}(?::\d{1,5})?(?:[/?#][\x21-\x7e]*)?$")
INTERDITS_LIEN = re.compile(r"[\"'<>\\`]")
SSVC_CHAMPS = {"exploitation": ("Exploitation", ("none", "poc", "active")), "automatisable": ("Automatable", ("yes", "no")),
               "impact": ("Technical Impact", ("partial", "total"))}
STATUTS_VERSION_CVE = ("affected", "unaffected", "unknown")


def instant_rfc3339(v):
    """Date et heure RFC 3339 (« 2026-11-20T10:00:00.123Z », décalage admis, sans zone : UTC) -> « …T10:00:00.123Z »."""
    m = INSTANT_RFC3339.fullmatch(v.strip()) if isinstance(v, str) and len(v) <= 40 else None
    if not m:
        return None
    zone = m.group(4) or "Z"
    zone = "+00:00" if zone == "Z" else (zone if ":" in zone else zone[:3] + ":" + zone[3:])
    try:
        d = dt.datetime.fromisoformat("%sT%s%s" % (m.group(1), m.group(2), zone))
    except ValueError:
        return None
    fraction = (m.group(3) or "0").ljust(3, "0")[:3]
    return d.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + fraction + "Z"


def objet(v):
    return v if isinstance(v, dict) else {}


def liste(v, maximum=1000):
    return v[:maximum] if isinstance(v, list) else []


def texte_ou_rien(v, maximum):
    t = texte(v, maximum)
    return t or None


def version_cve(v):
    return v if isinstance(v, str) and VERSION_CPE.fullmatch(v) and v not in ("*", "-") else None


def reference_cve(v):
    return v if (isinstance(v, str) and len(v) <= BORNES_CVE_INCONNUE["reference"] and REFERENCE_CVE.fullmatch(v)
                 and not INTERDITS_LIEN.search(v)) else None


def evaluation_ssvc(adp):
    """Conteneur ADP de la CISA (« CISA-ADP ») : évaluation SSVC (options Exploitation, Automatable, Technical Impact) et
    mention du catalogue KEV (date d'ajout). Toute autre valeur : null."""
    ssvc, kev = None, None
    for a in liste(adp, 50):
        if objet(objet(a).get("providerMetadata")).get("shortName") != "CISA-ADP":
            continue
        for m in liste(objet(a).get("metrics"), 50):
            autre = objet(objet(m).get("other"))
            contenu = objet(autre.get("content"))
            if autre.get("type") == "ssvc" and ssvc is None:
                options = {}
                for o in liste(contenu.get("options"), 20):
                    for cle, valeur in objet(o).items():
                        if isinstance(cle, str) and isinstance(valeur, str):
                            options[cle] = valeur.strip().lower()
                ssvc = {champ: (options.get(nom) if options.get(nom) in admis else None)
                        for champ, (nom, admis) in SSVC_CHAMPS.items()}
                ssvc["evalueLe"] = instant_rfc3339(contenu.get("timestamp"))
            elif autre.get("type") == "kev" and kev is None:
                ajout = contenu.get("dateAdded")
                kev = date_iso(ajout[:10]) if isinstance(ajout, str) else None
    return ssvc, kev


def fiche_cve_org(d, cve):
    """Liste blanche d'un enregistrement CVE JSON 5 ; l'identifiant doit être celui demandé."""
    meta = objet(objet(d).get("cveMetadata"))
    if meta.get("cveId") != cve:
        raise Refus("Enregistrement de cve.org illisible : identifiant inattendu.")
    conteneurs = objet(objet(d).get("containers"))
    cna = objet(conteneurs.get("cna"))
    descriptions = liste(cna.get("descriptions")) or liste(cna.get("rejectedReasons"))
    anglais = next((x.get("value") for x in descriptions if isinstance(x, dict) and str(x.get("lang", "")).lower().startswith("en")), None)
    references, vues = [], set()
    for r in liste(cna.get("references")):
        url = reference_cve(objet(r).get("url"))
        if url and url not in vues and len(references) < BORNES_CVE_INCONNUE["references"]:
            vues.add(url)
            references.append({"url": url, "nom": texte_ou_rien(objet(r).get("name"), BORNES_CVE_INCONNUE["nomReference"])})
    produits = []
    for a in liste(cna.get("affected")):
        a = objet(a)
        editeur, produit = texte(a.get("vendor"), BORNES_CVE_INCONNUE["editeur"]), texte(a.get("product"), BORNES_CVE_INCONNUE["produit"])
        if not (editeur or produit) or len(produits) >= BORNES_CVE_INCONNUE["produits"]:
            continue
        versions = []
        for v in liste(a.get("versions"), BORNES_CVE_INCONNUE["versionsParProduit"]):
            v = objet(v)
            statut = v.get("status")
            versions.append({"version": version_cve(v.get("version")),
                             "statut": statut if statut in STATUTS_VERSION_CVE else None,
                             "inferieurA": version_cve(v.get("lessThan")), "auPlus": version_cve(v.get("lessThanOrEqual"))})
        produits.append({"editeur": editeur, "produit": produit, "versions": versions})
    ssvc, kev = evaluation_ssvc(conteneurs.get("adp"))
    cna_nom = meta.get("assignerShortName")
    etat = {"PUBLISHED": "publiee", "REJECTED": "rejetee"}.get(meta.get("state"))
    return {"cve": cve, "etat": etat, "titre": texte_ou_rien(cna.get("title"), BORNES_CVE_INCONNUE["titre"]),
            "description": texte_ou_rien(anglais, BORNES_CVE_INCONNUE["description"]),
            "publieLe": instant_rfc3339(meta.get("datePublished")), "majLe": instant_rfc3339(meta.get("dateUpdated")),
            "cna": cna_nom if isinstance(cna_nom, str) and CNA_CVE.fullmatch(cna_nom) else None,
            "references": references, "produits": produits, "ssvc": ssvc, "kevAjoutLe": kev}


def cve_inconnue(parametres, mandataire):
    """Une CVE inconnue de la veille : cve.org puis NVD, chacun avec son état (trouvee, absente, echec). Échec global si les
    deux ont échoué. Rien d'autre que l'identifiant n'est envoyé."""
    cve = parametres.get("cve") if isinstance(parametres, dict) else None
    if not (isinstance(cve, str) and CVE_ID.fullmatch(cve)):
        raise Refus("Identifiant CVE illisible : rien n'a été lu.")
    debut = time.monotonic()
    erreurs = []
    fiche, etat_cveorg = None, "echec"
    try:
        fiche = fiche_cve_org(Client("cve-org", debut, mandataire).json("/api/cve/" + cve), cve)
        etat_cveorg = "trouvee"
    except Introuvable:
        etat_cveorg = "absente"
    except Exception as e:  # noqa: BLE001 - échec expliqué, sans contenu de réponse
        erreurs.append("cve.org : " + explication(e))
    faille, etat_nvd = None, "echec"
    try:
        d = Client("nvd", debut, mandataire).json(SOURCES["nvd"]["chemins"][0], "cveId=" + cve)
        if not isinstance(d, dict) or not isinstance(d.get("vulnerabilities"), list) or not isinstance(d.get("totalResults"), int):
            raise Refus("Réponse de NVD illisible.")
        if not d["vulnerabilities"]:
            etat_nvd = "absente"
        else:
            faille = faille_nvd(d["vulnerabilities"][0])
            if faille is None or faille["cve"] != cve:
                raise Refus("Réponse de NVD illisible.")
            etat_nvd = "trouvee"
    except Exception as e:  # noqa: BLE001
        faille = None
        erreurs.append("NVD : " + explication(e))
    if etat_cveorg == "echec" and etat_nvd == "echec":
        return {"ok": False, "erreur": une_ligne(" ; ".join(erreurs)), "cveOrg": None, "cveOrgEtat": None, "nvd": None, "nvdEtat": None}
    return {"ok": True, "erreur": None, "cveOrg": fiche, "cveOrgEtat": etat_cveorg, "nvd": faille, "nvdEtat": etat_nvd}


# ------------------------------------------------------------------ Sources facultatives (ADR 0100, lot CVE-INC)
GRAVITES_ANNONCE = {g.lower(): g for g in GRAVITES}
VERSION_CVSS = re.compile(r"^[234]\.[01]$")
VERDICT_TLDRCVE = re.compile(r"\bVerdict\s*:\s*(Patch now if\b[^.\n]{0,180}|Patch now|Next cycle|Watching)", re.IGNORECASE)
NATURE_TLDRCVE = re.compile(r"^(New|Update)\s*:\s*", re.IGNORECASE)


def lien_annonce(source, v):
    prefixe = "https://%s/" % SOURCES_ANNONCES[source]["hote"]
    lien = v.strip() if isinstance(v, str) else ""
    if (not lien.startswith(prefixe) or len(lien) > BORNES_ANNONCES["lien"] or not CARACTERES_LIEN.fullmatch(lien)
            or INTERDITS_LIEN.search(lien)):
        return None
    return lien


def score_annonce(v):
    try:
        x = float(v) if isinstance(v, (int, float, str)) and not isinstance(v, bool) else None
    except ValueError:
        return None
    return round(x, 1) if x is not None and 0 <= x <= 10 else None


def kev_annonce(*valeurs):
    """`kev_added` : vrai pour true ou une date, faux pour false ; absent ou autre forme : null."""
    for v in valeurs:
        if v is True or (isinstance(v, str) and date_iso(v[:10])):
            return True
        if v is False:
            return False
    return None


def preavis_cloudflare(client, _parametres, bilan):
    """JSON Feed des CVE annoncées (`items[]`) : identifiant, adresse, titre, résumé, date, et `_cve` (identifiant, gravité,
    score, version CVSS) ; `kev_added` s'il est présent ; toute autre clé est ignorée. Tous les éléments lisibles sont
    remontés : l'API ne garde que les CVE critiques et celles qui citent un produit surveillé."""
    d = client.json(SOURCES_ANNONCES["cloudflare-radar"]["chemins"][0], REQUETES_ANNONCES["cloudflare-radar"])
    items = d.get("items") if isinstance(d, dict) else None
    if not isinstance(items, list):
        raise Refus("Flux de Cloudflare Radar illisible : liste « items » absente.")
    if len(items) > BORNES_ANNONCES["items"]:
        bilan.tronque = True
    elements, vus = [], set()
    for it in items[: BORNES_ANNONCES["items"]]:
        it = objet(it)
        c = objet(it.get("_cve"))
        cve = c.get("id")
        titre = texte(it.get("title"), BORNES_ANNONCES["titre"])
        ident = texte(it.get("id"), BORNES_ANNONCES["identifiant"]) if isinstance(it.get("id"), str) else ""
        ident = ident or (cve if isinstance(cve, str) else "")
        if not (isinstance(cve, str) and CVE_ID.fullmatch(cve) and titre and ident) or ident in vus:
            bilan.ecartes += 1
            continue
        vus.add(ident)
        version = c.get("cvss_version")
        version = str(version) if isinstance(version, (str, int, float)) and not isinstance(version, bool) else ""
        gravite = c.get("severity")
        elements.append({
            "identifiant": ident, "cve": cve, "titre": titre,
            "resume": texte(it.get("summary"), BORNES_ANNONCES["resume"]),
            "lien": lien_annonce("cloudflare-radar", it.get("url")),
            "publieLe": instant_rfc3339(it.get("date_published")),
            "gravite": GRAVITES_ANNONCE.get(gravite.strip().lower()) if isinstance(gravite, str) else None,
            "score": score_annonce(c.get("score")),
            "versionCvss": version if VERSION_CVSS.fullmatch(version) else None,
            "kev": kev_annonce(c.get("kev_added"), it.get("kev_added")),
        })
    return elements


def resumes_tldrcve(client, _parametres, bilan):
    """Flux RSS 2.0 de tldrcve : titre (« New: … » ou « Update: … »), CVE citées par le titre et le résumé, résumé du flux,
    verdict (phrase « Verdict: … » du résumé seulement), date et lien (https sur tldrcve.com, sinon l'élément est écarté)."""
    elements, vus = [], set()
    items = lire_rss(client.lire(SOURCES_ANNONCES["tldrcve"]["chemins"][0]))
    if len(items) >= RSS_ITEMS_MAX:
        bilan.tronque = True
    for item in items:
        titre = texte(item.get("title"), BORNES_ANNONCES["titre"])
        resume = texte(item.get("description"), BORNES_ANNONCES["resume"])
        lien = lien_annonce("tldrcve", item.get("link"))
        guid = texte(item.get("guid"), BORNES_ANNONCES["identifiant"])
        ident = guid or lien
        cves = list(dict.fromkeys(c for c in CVE_DANS_TEXTE.findall(titre + " " + resume) if CVE_ID.fullmatch(c)))
        if not (titre and lien and ident and cves) or ident in vus:
            bilan.ecartes += 1
            continue
        vus.add(ident)
        m = NATURE_TLDRCVE.match(titre)
        nature = None if not m else ("nouvelle" if m.group(1).lower() == "new" else "mise_a_jour")
        v = VERDICT_TLDRCVE.search(resume)
        verdict = verdict_texte = None
        if v:
            phrase = v.group(1).strip().rstrip(".")
            bas = phrase.lower()
            verdict = ("patch-now-if" if bas.startswith("patch now if") else "patch-now" if bas == "patch now"
                       else "next-cycle" if bas == "next cycle" else "watching")
            verdict_texte = texte(phrase, BORNES_ANNONCES["verdict"]) or None
            if verdict_texte is None:
                verdict = None
        elements.append({"identifiant": ident, "titre": titre, "nature": nature,
                         "cves": cves[: BORNES_ANNONCES["cvesParAnnonce"]], "resume": resume, "verdict": verdict,
                         "verdictTexte": verdict_texte, "lien": lien, "publieLe": horodatage_rss(item.get("pubDate"))})
    return elements


COLLECTES = {"cisa-kev": kev, "nvd": nvd, "epss": epss, "cert-fr": cert_fr, "cert-sante": cert_sante}
COLLECTES.update({s: reglementaire(s) for s in SOURCES_REGLEMENTAIRES})
COLLECTES["nvd-cpe"] = cpe
COLLECTES.update({"cloudflare-radar": preavis_cloudflare, "tldrcve": resumes_tldrcve})


def executer(p):
    try:
        if not isinstance(p, dict):
            raise Refus("Demande illisible.")
        source, parametres = p.get("source"), p.get("parametres")
        if source == "cve-inconnue":
            # CVE inconnue (lot CVE-INC) : deux lectures (cve.org, NVD), chacune avec son état ; forme de sortie propre.
            if not isinstance(parametres, dict):
                raise Refus("Demande illisible.")
            try:
                return cve_inconnue(parametres, lire_mandataire(p.get("mandataire")))
            except Exception as erreur:  # noqa: BLE001
                return {"ok": False, "erreur": une_ligne(explication(erreur)), "cveOrg": None, "cveOrgEtat": None,
                        "nvd": None, "nvdEtat": None}
        if source not in COLLECTES or source not in TOUTES_SOURCES:
            raise Refus("Source inconnue : rien n'a été lu.")
        if not isinstance(parametres, dict):
            raise Refus("Demande illisible.")
        mandataire = lire_mandataire(p.get("mandataire"))
        bilan = Bilan()
        elements = COLLECTES[source](Client(source, mandataire=mandataire), parametres, bilan)
        if source == "nvd-cpe" and isinstance(elements, dict):
            # Dictionnaire : produits en éléments, versions à part, curseur dans le bilan.
            return {"ok": True, "elements": elements["produits"], "versions": elements["versions"], "erreur": None,
                    "bilan": {**elements["bilan"], "ecartes": bilan.ecartes}}
        if source == "nvd-cpe":
            return {"ok": True, "elements": elements, "erreur": None,
                    "bilan": {"elements": len(elements), "ecartes": bilan.ecartes, "tronque": bilan.tronque}}
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

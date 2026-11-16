#!/usr/bin/env python3
"""Appel en lecture seule d'un outil externe pour le module Intégrations (ADR 0076, point 5 ; ADR 0100, point 6).

Lancé par l'exécutant d'exploitation du serveur (scripts/exploitation-worker.py) sous un compte sans privilège, par
`python -I`, avec un environnement minimal et un délai borné, jamais par l'API (qui reste sans accès réseau sortant).
Bibliothèque standard seule.

Entrée : un objet JSON sur l'entrée standard (type, opération, configuration, secrets) ; ni argument ni variable
d'environnement ne porte de secret. Sortie : un objet JSON {ok, resultat, erreur} sur la sortie standard, normalisé et
borné ; il ne contient jamais de secret, et l'erreur tient sur une ligne. « synchroniser » ajoute `elements` : les machines,
constats, détections et machines d'inventaire, réduits aux seuls champs listés (CHAMPS_ANALYSE, CHAMPS_HOTE), que
l'exécutant rapporte par lots bornés.

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
"""
import html
import http.client
import json
import re
import socket
import ssl
import sys
import time
import unicodedata

# Liste fermée des points d'accès de lecture, par type (méthode, chemin exact ou motif dont {uuid} est la seule partie
# variable). Une seule ligne JSON : le test d'architecture la lit telle quelle.
POINTS_ACCES = {"tenable": [["POST", "/rest/analysis"], ["GET", "/rest/hosts"], ["GET", "/rest/hosts/{uuid}"], ["GET", "/rest/system"]]}
PARAMETRES_ACCES = {"tenable": {"GET /rest/hosts": ["limit", "offset"]}}
OPERATIONS = {"tenable": ["tester", "synchroniser"]}
BORNES_SYNCHRO = {"pageAnalyse": 200, "pagesAnalyse": 100, "detections": 20000, "pageMachines": 500, "pagesMachines": 20, "dureeSecondes": 480, "reponseAnalyse": 8388608, "reponseMachines": 4194304, "cvesParConstat": 500, "nomControle": 300, "famille": 100, "synopsis": 1000, "correctif": 2000, "libelleExploit": 100, "voirAussi": 500, "nomMachine": 255, "systeme": 200, "exposition": 40, "lot": 500, "lots": 200}
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
        connexion = http.client.HTTPSConnection(self.hote, self.port, timeout=self.delai, context=self.contexte)
        try:
            en_tetes = {"Accept": "application/json", "User-Agent": "suivi-audits-integrations", **self.en_tetes}
            if donnees is not None:
                en_tetes["Content-Type"] = "application/json"
            connexion.request(methode, cible, body=donnees, headers=en_tetes)
            reponse = connexion.getresponse()
            if 300 <= reponse.status < 400:
                raise Refus("Redirection refusée (code %d) : l'adresse réglée doit être celle du service, sans redirection." % reponse.status)
            if reponse.status in (401, 403):
                raise Refus("Accès refusé par le service (code %d) : vérifiez les clés et les droits du compte." % reponse.status)
            if reponse.status != 200:
                raise Refus("Réponse inattendue du service (code %d)." % reponse.status)
            longueur = reponse.getheader("Content-Length")
            if longueur is not None and (not longueur.strip().isdigit() or int(longueur) > maximum):
                raise Refus("Réponse trop volumineuse : refusée.")
            brut = reponse.read(maximum + 1)
            if len(brut) > maximum:
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
# écarté dès la lecture et ne sort jamais du script.
CHAMPS_ANALYSE = ("pluginID", "pluginName", "severity", "family", "synopsis", "solution", "cvssV3Vector", "cvssV3BaseScore",
                  "vprScore", "epssScore", "exploitAvailable", "exploitEase", "vulnPubDate", "patchPubDate", "seolDate",
                  "seeAlso", "cve", "ip", "dnsName", "netbiosName", "operatingSystem", "hostUUID", "acrScore", "keyDrivers",
                  "firstSeen", "lastSeen", "port", "protocol", "hasBeenMitigated", "acceptRisk", "recastRisk")
# Champs lus dans une machine de l'inventaire (`GET /rest/hosts`, liste directe).
CHAMPS_HOTE = ("uuid", "tenableUUID", "name", "os", "firstSeen", "lastSeen", "ipAddress")
GRAVITES = {"critique": "4", "elevee": "3", "moyenne": "2", "faible": "1"}
GRAVITE_DE_ID = {v: k for k, v in GRAVITES.items()}
GRAVITES_DEFAUT = ["critique", "elevee"]
PLUGIN_ID = re.compile(r"^[1-9]\d{0,8}$")
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
    m = sortie["machines"].get(cle)
    if m is None:
        acr = decimal(r.get("acrScore"), 0, 10)
        m = sortie["machines"][cle] = {
            "type": "machine", "cle": cle, "uuid": uuid, "nom": nom_m, "adresse": adresse,
            "systeme": texte(r.get("operatingSystem"), BORNES_SYNCHRO["systeme"]),
            "premiere": premiere, "derniere": derniere, "exposition": exposition(r.get("keyDrivers")), "acr": acr,
        }
    else:
        if premiere and (not m["premiere"] or premiere < m["premiere"]):
            m["premiere"] = premiere
        if derniere and (not m["derniere"] or derniere > m["derniere"]):
            m["derniere"] = derniere
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
    inventaire = {"ok": True, "erreur": None}
    try:
        lire_hotes(client, debut, sortie, bilan, horloge)
    except Exception as erreur:  # noqa: BLE001 - l'inventaire est expérimental : son échec est rapporté, pas propagé
        inventaire = {"ok": False, "erreur": une_ligne("Inventaire des machines indisponible : " + explication(erreur))}
    elements = (list(sortie["machines"].values()) + list(sortie["constats"].values())
                + list(sortie["detections"].values()) + list(sortie["hotes"].values()))
    resultat = {"pages": bilan["pages"], "constats": len(sortie["constats"]), "detections": len(sortie["detections"]),
                "machines": len(sortie["machines"]), "hotes": len(sortie["hotes"]), "ecartes": bilan["ecartes"],
                "tronque": bilan["tronque"], "inventaire": inventaire}
    return resultat, elements


TYPES = {"tenable": (cles_tenable, {"tester": tenable_tester, "synchroniser": tenable_synchroniser})}


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

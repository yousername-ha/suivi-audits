"""Script isolé des connecteurs (scripts/integration-http.py, ADR 0076 point 5, ADR 0100 point 6) contre un faux service
HTTPS local : seule la version sort de /rest/system, liste fermée des points d'accès, aucune redirection suivie, certificat
toujours vérifié, réponse bornée, erreur sur une ligne sans secret. Synchronisation (ADR 0100, lot V5) : seuls les champs
listés sortent (jamais pluginText), pagination et bornes, inventaire en échec toléré, score EPSS converti.
AlgoLightHouse (lot ALH1) contre un faux espace local et un faux mandataire (tunnel CONNECT) : GET seulement sur la liste
fermée, jamais d'écriture, champs en liste blanche (ni note, ni pièces jointes, ni données sensibles des fragments), bornes,
mandataire refusé pour Tenable. Données entièrement fictives (noms en .invalid et .example, adresses de 192.0.2.0/24 et
198.51.100.0/24, CVE fictives) ; aucun service réel."""
import base64
import http.server
import importlib.util
import json
import os
from pathlib import Path
import socket
import socketserver
import ssl
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "integration-http.py"
SPEC = importlib.util.spec_from_file_location("integration_http", SCRIPT)
h = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(h)

CLE_ACCES = "a1b2c3d4e5f60718293a4b5c6d7e8f90"
CLE_SECRETE = "f0e1d2c3b4a5968778695a4b3c2d1e0f"
FAUX_CODE = "CODE-ACTIVATION-FICTIF-0000-1111"
UUID_FICTIF = "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d"
TEXTE_SENSIBLE = "SORTIE-DE-CONTROLE-FICTIVE-A-NE-JAMAIS-GARDER"
CHAMP_INCONNU = "VALEUR-DE-CHAMP-INCONNU-FICTIVE"


def resultat_fictif(i, plugin="900001", cve="CVE-2026-90001,CVE-2026-90002", hote=None, **extra):
    """Un résultat de « vulndetails » de même forme que celui relevé sur l'instance 6.9.1 (valeurs fictives)."""
    n = hote if hote is not None else i
    r = {
        "pluginID": plugin, "severity": {"id": "4", "name": "Critical", "description": "Critical Severity"},
        "hasBeenMitigated": "0", "acceptRisk": "0", "recastRisk": "0", "ip": "192.0.2.%d" % (10 + n),
        "uuid": "00000000-0000-4000-8000-%012d" % i, "port": "0", "protocol": "TCP",
        "pluginName": "Exemple Linux : noyau (EX-2026-%04d)" % int(plugin[-2:]), "firstSeen": "1784336701",
        "lastSeen": "1794809088", "exploitAvailable": "Yes", "exploitEase": "Exploits are available", "exploitFrameworks": "",
        "synopsis": "The remote host is missing a security update.", "description": "Description fictive.",
        "solution": "Update the affected packages.", "seeAlso": "https://example.org/advisory\nhttp://example.org/autre",
        "riskFactor": "High", "stigSeverity": "", "vprScore": "5.0", "vprContext": "[]", "baseScore": "8.3",
        "temporalScore": "6.1", "cvssVector": "AV:N/AC:L/Au:M/C:C/I:C/A:C/E:U/RL:OF/RC:C", "cvssV3BaseScore": "9.1",
        "cvssV3TemporalScore": "7.9", "cvssV3Vector": "AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H/E:U/RL:O/RC:C",
        "cvssV4BaseScore": "9.4", "cvssV4Vector": "AV:N/AC:L/AT:N/PR:H/UI:N/VC:H/VI:H/VA:H/SC:H/SI:H/SA:H",
        "cvssV4ThreatScore": "7.6", "cvssV4ThreatVector": "E:U", "cvssV4Supplemental": "", "cpe": "cpe:/a:exemple:produit",
        "vulnPubDate": "1784030400", "patchPubDate": "1784030400", "pluginPubDate": "1784116800",
        "pluginModDate": "1784116800", "checkType": "local", "version": "1.1", "cve": cve, "bid": "", "xref": "",
        "seolDate": "-1", "epssScore": "0.56", "pluginText": "<plugin_output>%s</plugin_output>" % TEXTE_SENSIBLE,
        "dnsName": "srv-exemple-%02d.exemple.invalid" % n, "macAddress": "00:00:5e:00:53:01", "netbiosName": "",
        "operatingSystem": "Linux Kernel 5.14 on Exemple Linux 9", "ips": "192.0.2.%d" % (10 + n),
        "recastRiskRuleComment": "", "acceptRiskRuleComment": "", "hostUniqueness": "repositoryID,ip,dnsName",
        "hostUUID": "00000000-0000-4000-8000-0000000000%02x" % (0xa0 + n), "acrScore": "4.0",
        "keyDrivers": "{\"internet exposure\":\"internal\",\"device capability\":\"\",\"device type\":\"general_purpose\"}",
        "assetExposureScore": "207", "vulnUniqueness": "repositoryID,vulnUUID",
        "vulnUUID": "00000000-0000-4000-8000-0000000000bb", "cgiScanEnabled": "Disabled", "thoroughScanEnabled": "Disabled",
        "paranoidScanEnabled": "Not Paranoid", "attachment": "", "uniqueness": "repositoryID,hostUUID",
        "family": {"id": "23", "name": "Misc.", "type": "active"},
        "repository": {"id": "1", "name": "Depot", "description": "", "dataFormat": "universal"},
        "pluginInfo": "%s (0/6) Exemple" % plugin, "champInconnu": CHAMP_INCONNU,
    }
    r.update(extra)
    return r


def hote_fictif(n):
    return {"id": str(n), "uuid": "00000000-0000-4000-8000-0000000001%02x" % n, "tenableUUID": "",
            "name": "poste-%02d.exemple.invalid" % n, "os": "Exemple OS 1", "firstSeen": "1784336701",
            "lastSeen": "1794809088", "ipAddress": "192.0.2.%d" % (100 + n), "macAddress": "00:00:5e:00:53:02",
            "champInconnu": CHAMP_INCONNU}


def certificat(dossier, nom):
    subprocess.run(
        ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", str(dossier / (nom + ".key")),
         "-out", str(dossier / (nom + ".crt")), "-days", "2", "-subj", "/CN=localhost",
         "-addext", "subjectAltName=DNS:localhost"],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    return (dossier / (nom + ".crt")).read_text()


class Faux(http.server.BaseHTTPRequestHandler):
    """Faux Tenable Security Center : /rest/system rend la version, une licence et un code d'activation fictifs."""

    protocol_version = "HTTP/1.0"
    mode = "normal"
    recues = []
    corps = []
    # Synchronisation : résultats de l'analyse servis par pages (startOffset, endOffset), machines de l'inventaire.
    analyse = []
    hotes = []
    mode_hotes = "normal"

    def log_message(self, *args):
        pass

    def repondre(self, code, corps, longueur=True, en_tetes=()):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        for k, v in en_tetes:
            self.send_header(k, v)
        if longueur:
            self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def traiter(self):
        Faux.recues.append({"methode": self.command, "chemin": self.path, "cle": self.headers.get("x-apikey")})
        longueur = int(self.headers.get("Content-Length") or 0)
        corps = json.loads(self.rfile.read(longueur)) if longueur else None
        Faux.corps.append(corps)
        if self.path == "/rest/analysis" and Faux.mode in ("synchro", "analyse-erreur"):
            if Faux.mode == "analyse-erreur":
                return self.repondre(200, json.dumps({"type": "regular", "response": {}, "error_code": 74, "error_msg": "détail " + FAUX_CODE}).encode())
            debut, fin = corps["startOffset"], corps["endOffset"]
            page = Faux.analyse[debut:fin]
            return self.repondre(200, json.dumps({"type": "regular", "response": {
                "totalRecords": str(len(Faux.analyse)), "returnedRecords": len(page), "startOffset": str(debut),
                "endOffset": str(fin), "matchingDataElementCount": "-1", "results": page},
                "error_code": 0, "error_msg": "", "warnings": [], "timestamp": 1794830225}).encode())
        if self.path.startswith("/rest/hosts") and Faux.mode == "synchro":
            if Faux.mode_hotes == "refus":
                return self.repondre(403, b"{}")
            limite = int(self.path.split("limit=")[1].split("&")[0])
            offset = int(self.path.split("offset=")[1]) if Faux.mode_hotes == "normal" else 0
            return self.repondre(200, json.dumps({"type": "regular", "response": Faux.hotes[offset:offset + limite],
                                                  "error_code": 0, "error_msg": "", "warnings": [], "timestamp": 1794830225}).encode())
        if Faux.mode == "redirection":
            return self.repondre(302, b"{}", en_tetes=[("Location", "https://localhost/rest/system")])
        if Faux.mode == "refus":
            return self.repondre(403, json.dumps({"error_msg": "message de " + CLE_SECRETE}).encode())
        if Faux.mode == "gros":
            return self.repondre(200, b"[" + b"0," * (h.REPONSE_MAX // 2 + 10) + b"0]")
        if Faux.mode == "gros-sans-longueur":
            return self.repondre(200, b"[" + b"0," * (h.REPONSE_MAX // 2 + 10) + b"0]", longueur=False)
        if Faux.mode == "erreur-tenable":
            return self.repondre(200, json.dumps({"type": "regular", "response": {}, "error_code": 74, "error_msg": "détail " + FAUX_CODE}).encode())
        if Faux.mode == "version-invalide":
            return self.repondre(200, json.dumps({"type": "regular", "response": {"version": "6.9.1\n" + FAUX_CODE}, "error_code": 0}).encode())
        corps = {
            "type": "regular",
            "response": {
                "version": "6.9.1",
                "buildID": "202611010000",
                "licenseStatus": "Valid",
                "ActivationCode": FAUX_CODE,
                "licence": {"type": "fictive", "ips": 1024, "code": FAUX_CODE},
                "banner": "Bannière fictive",
            },
            "error_code": 0,
            "error_msg": "",
            "warnings": [],
            "timestamp": 1794787200,
        }
        self.repondre(200, json.dumps(corps).encode())

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = traiter


class IntegrationHttp(unittest.TestCase):
    def test_json_trop_imbrique_est_refuse_avant_l_analyse(self):
        # Le refus ne dépend ni de la version ni de la construction de Python (RecursionError ou non).
        self.assertTrue(h.trop_imbrique(b"[" * 100000 + b"]" * 100000))
        self.assertTrue(h.trop_imbrique(b'{"a":' * 65 + b"1" + b"}" * 65))
        self.assertFalse(h.trop_imbrique(b'{"a":' * 64 + b"1" + b"}" * 64))
        # Crochets et accolades écrits dans une chaîne, guillemet échappé compris : ils ne comptent pas.
        self.assertFalse(h.trop_imbrique(b'{"texte": "' + b"[{" * 500 + b' \\" [[[", "n": [1, 2]}'))
        self.assertFalse(h.trop_imbrique(b""))

    @classmethod
    def setUpClass(cls):
        cls.dossier = tempfile.TemporaryDirectory()
        d = Path(cls.dossier.name)
        cls.ca = certificat(d, "serveur")
        cls.autre_ca = certificat(d, "autre")
        cls.serveur = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Faux)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.load_cert_chain(str(d / "serveur.crt"), str(d / "serveur.key"))
        cls.serveur.socket = ctx.wrap_socket(cls.serveur.socket, server_side=True)
        cls.port = cls.serveur.server_address[1]
        cls.fil = threading.Thread(target=cls.serveur.serve_forever, daemon=True)
        cls.fil.start()

    @classmethod
    def tearDownClass(cls):
        cls.serveur.shutdown()
        cls.serveur.server_close()
        cls.dossier.cleanup()

    def setUp(self):
        Faux.mode = "normal"
        Faux.mode_hotes = "normal"
        Faux.recues = []
        Faux.corps = []
        Faux.analyse = []
        Faux.hotes = []

    def demande(self, ca=None, **extra):
        p = {
            "type": "tenable",
            "operation": "tester",
            # Port réglable : le faux service écoute sur un port libre, réglé dans l'adresse comme le ferait l'administrateur.
            "configuration": {"adresse": "https://localhost:%d" % self.port, "autoriteCertification": self.ca if ca is None else ca, "delaiSecondes": 5},
            "secrets": {"accessKey": CLE_ACCES, "secretKey": CLE_SECRETE},
        }
        p.update(extra)
        return p

    def sans_secret(self, sortie):
        texte = json.dumps(sortie)
        self.assertNotIn(CLE_ACCES, texte)
        self.assertNotIn(CLE_SECRETE, texte)
        self.assertNotIn(FAUX_CODE, texte)
        if sortie.get("erreur") is not None:
            self.assertNotIn("\n", sortie["erreur"])
            self.assertLessEqual(len(sortie["erreur"]), h.ERREUR_MAX)

    def test_only_the_version_leaves_a_system_response(self):
        sortie = h.executer(self.demande())
        self.assertEqual(sortie, {"ok": True, "resultat": {"version": "6.9.1"}, "erreur": None})
        self.sans_secret(sortie)
        self.assertEqual(Faux.recues, [{"methode": "GET", "chemin": "/rest/system", "cle": "accesskey=%s; secretkey=%s;" % (CLE_ACCES, CLE_SECRETE)}])

    def test_the_call_goes_to_the_configured_port(self):
        """L'appel part vers le port réglé dans l'adresse (le faux service n'écoute que sur celui-ci) ; sans port, 443."""
        client = h.Client("tenable", self.demande()["configuration"], {})
        self.assertEqual((client.hote, client.port), ("localhost", self.port))
        h.executer(self.demande())
        self.assertEqual(len(Faux.recues), 1)
        with patch.object(h.http.client, "HTTPSConnection", wraps=h.http.client.HTTPSConnection) as connexion:
            h.executer(self.demande())
        self.assertEqual(connexion.call_args.args[:2], ("localhost", self.port))
        self.assertEqual(h.Client("tenable", {"adresse": "https://localhost"}, {}).port, 443)

    def test_methods_and_paths_outside_the_closed_list_are_refused_before_any_call(self):
        client = h.Client("tenable", self.demande()["configuration"], {})
        for methode, chemin in (("DELETE", "/rest/hosts/" + UUID_FICTIF), ("PATCH", "/rest/hosts/%s/acr" % UUID_FICTIF),
                                ("GET", "/rest/solutions"), ("PUT", "/rest/system"), ("POST", "/rest/system"),
                                ("GET", "/rest/hosts/../system"), ("GET", "/rest/hosts/pas-un-uuid"),
                                ("GET", "/rest/system?x=1"), ("GET", "/rest/hosts/%s/" % UUID_FICTIF), ("GET", "http://ailleurs/rest/system")):
            with self.subTest(methode=methode, chemin=chemin):
                with self.assertRaises(h.Refus):
                    client.requete(methode, chemin)
        self.assertEqual(Faux.recues, [])
        # Les points d'accès de la liste passent le contrôle.
        for methode, chemin in (("POST", "/rest/analysis"), ("GET", "/rest/hosts"), ("GET", "/rest/hosts/" + UUID_FICTIF), ("GET", "/rest/system")):
            self.assertTrue(h.point_admis("tenable", methode, chemin), chemin)
        self.assertFalse(h.point_admis("inconnu", "GET", "/rest/system"))

    def test_a_redirect_is_never_followed(self):
        Faux.mode = "redirection"
        sortie = h.executer(self.demande())
        self.assertFalse(sortie["ok"])
        self.assertIn("Redirection refusée (code 302)", sortie["erreur"])
        self.assertEqual(len(Faux.recues), 1)
        self.sans_secret(sortie)

    def test_an_invalid_certificate_is_refused(self):
        for ca in ("", self.autre_ca):
            with self.subTest(ca="système" if not ca else "autre autorité"):
                Faux.recues = []
                sortie = h.executer(self.demande(ca=ca))
                self.assertFalse(sortie["ok"])
                self.assertIn("Certificat du service refusé", sortie["erreur"])
                self.assertEqual(Faux.recues, [])
                self.sans_secret(sortie)

    def test_tls_context_always_verifies_with_tls_1_2_minimum(self):
        ctx = h.contexte("")
        self.assertEqual(ctx.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(ctx.check_hostname)
        self.assertEqual(ctx.minimum_version, ssl.TLSVersion.TLSv1_2)
        sortie = h.executer(self.demande(ca="pas un certificat"))
        self.assertFalse(sortie["ok"])
        self.assertIn("Autorité de certification illisible", sortie["erreur"])

    def test_an_oversized_response_is_refused(self):
        for mode in ("gros", "gros-sans-longueur"):
            with self.subTest(mode=mode):
                Faux.mode = mode
                sortie = h.executer(self.demande())
                self.assertEqual(sortie, {"ok": False, "resultat": None, "erreur": "Réponse trop volumineuse : refusée."})

    def test_service_errors_are_explained_without_response_content_or_secret(self):
        for mode, attendu in (("refus", "Accès refusé par le service (code 403)"), ("erreur-tenable", "code 74"),
                              ("version-invalide", "forme inattendue")):
            with self.subTest(mode=mode):
                Faux.mode = mode
                sortie = h.executer(self.demande())
                self.assertFalse(sortie["ok"])
                self.assertIn(attendu, sortie["erreur"])
                self.sans_secret(sortie)

    def test_bad_requests_call_nothing(self):
        for p in (self.demande(type="inconnu"), self.demande(operation="supprimer"),
                  self.demande(secrets={"accessKey": CLE_ACCES, "secretKey": "a; secretkey=b"}),
                  self.demande(secrets={"accessKey": CLE_ACCES}), self.demande(configuration="x"), None, []):
            with self.subTest(p=p if not isinstance(p, dict) else {k: v for k, v in p.items() if k != "secrets"}):
                sortie = h.executer(p)
                self.assertFalse(sortie["ok"])
                self.sans_secret(sortie)
        self.assertEqual(Faux.recues, [])

    # ------------------------------------------------------------------ Synchronisation (ADR 0100, lot V5)
    def synchro(self, **configuration):
        p = self.demande(operation="synchroniser")
        p["configuration"].update(configuration)
        return h.executer(p)

    def test_synchronisation_keeps_only_listed_fields_grouped_by_control(self):
        Faux.mode = "synchro"
        Faux.analyse = [resultat_fictif(1), resultat_fictif(2, hote=1, port="443"), resultat_fictif(3, hote=2),
                        # Système qui n'est plus maintenu : aucune CVE, date de fin de support.
                        resultat_fictif(4, plugin="900002", cve="", seolDate="1735689600", epssScore="", vprScore="",
                                        exploitAvailable="No", hote=2, dnsName="", netbiosName="EXEMPLE\\POSTE-02",
                                        hostUUID=""),
                        {"pas": "un résultat utile"}]
        Faux.hotes = [hote_fictif(1), hote_fictif(2)]
        sortie = self.synchro()
        self.assertTrue(sortie["ok"], sortie.get("erreur"))
        self.sans_secret(sortie)
        texte = json.dumps(sortie)
        for interdit in (TEXTE_SENSIBLE, "pluginText", CHAMP_INCONNU, "macAddress", "00:00:5e", "vulnUUID", "description",
                         "Description fictive", "cpe:/a", "repository", "dataFormat", "universal", "assetExposureScore"):
            self.assertNotIn(interdit, texte)
        el = sortie["elements"]
        self.assertEqual([e["type"] for e in el], ["machine"] * 3 + ["constat"] * 2 + ["detection"] * 4 + ["hote"] * 2)
        self.assertEqual(sortie["resultat"], {"pages": 1, "constats": 2, "detections": 4, "machines": 3, "hotes": 2,
                                              "ecartes": 1, "tronque": False, "inventaire": {"ok": True, "erreur": None}})
        c1, c2 = [e for e in el if e["type"] == "constat"]
        self.assertEqual(c1, {
            "type": "constat", "plugin": "900001", "nom": "Exemple Linux : noyau (EX-2026-0001)", "gravite": "critique",
            "famille": "Misc.", "synopsis": "The remote host is missing a security update.",
            "correctif": "Update the affected packages.",
            "cvss3Vecteur": "AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H/E:U/RL:O/RC:C", "cvss3Score": 9.1, "vpr": 5.0,
            # 0,56 % rendu par Tenable : 0,0056 rangé, comme la veille.
            "epss": 0.0056, "exploitable": True, "exploitLibelle": "Exploits are available",
            # Lot PRIO-1 : `exploitFrameworks` vide, aucun kit.
            "kitsExploitation": [],
            "failleLe": "2026-07-14T12:00:00.000Z", "correctifLe": "2026-07-14T12:00:00.000Z", "finSupportLe": None,
            "voirAussi": "https://example.org/advisory", "cves": ["CVE-2026-90001", "CVE-2026-90002"], "cvesTronquees": False})
        self.assertEqual((c2["cves"], c2["finSupportLe"], c2["epss"], c2["vpr"], c2["exploitable"]),
                         ([], "2025-01-01T00:00:00.000Z", None, None, False))
        m = [e for e in el if e["type"] == "machine"]
        self.assertEqual(m[0], {"type": "machine", "cle": "uuid:00000000-0000-4000-8000-0000000000a1",
                                "uuid": "00000000-0000-4000-8000-0000000000a1", "nom": "srv-exemple-01.exemple.invalid",
                                "adresse": "192.0.2.11", "systeme": "Linux Kernel 5.14 on Exemple Linux 9",
                                "premiere": "2026-07-18T01:05:01.000Z", "derniere": "2026-11-16T06:04:48.000Z",
                                "exposition": "internal", "acr": 4.0,
                                # Lot V4d : dépôt de Tenable, identifiant et nom seulement.
                                "depot": {"id": "1", "nom": "Depot"}})
        d = [e for e in el if e["type"] == "detection"]
        self.assertEqual(sorted((x["machine"][-2:], x["port"]) for x in d), [("02", 0), ("a1", 0), ("a1", 443), ("a2", 0)])
        # Sans hostUUID, la machine est identifiée par son adresse et son nom (ici NetBIOS).
        self.assertEqual(m[2]["cle"], "ip:192.0.2.12|poste-02")
        self.assertEqual(el[-1]["nom"], "poste-02.exemple.invalid")
        # Appels : analyse vulndetails cumulative filtrée par gravité (critiques et élevées par défaut), puis inventaire.
        self.assertEqual([(r["methode"], r["chemin"]) for r in Faux.recues],
                         [("POST", "/rest/analysis"), ("GET", "/rest/hosts?limit=500&offset=0")])
        self.assertEqual(Faux.corps[0], {"type": "vuln", "sourceType": "cumulative", "startOffset": 0, "endOffset": 200,
                                         "query": {"type": "vuln", "tool": "vulndetails", "filters": [
                                             {"filterName": "severity", "operator": "=", "value": "4,3"}]}})
        Faux.recues, Faux.corps = [], []
        self.synchro(gravites=["moyenne", "critique"])
        self.assertEqual(Faux.corps[0]["query"]["filters"][0]["value"], "4,2")

    def test_synchronisation_reads_only_the_id_and_name_of_the_repository(self):
        """Lot V4d : le dépôt d'une machine est lu dans le résultat de l'analyse déjà reçu (aucun appel nouveau), réduit à son
        identifiant et à son nom nettoyé ; vue dans plusieurs dépôts, la machine garde le plus petit identifiant ; une forme
        inattendue donne un dépôt inconnu (None), sans écarter le résultat."""
        Faux.mode = "synchro"
        Faux.analyse = [
            resultat_fictif(1, repository={"id": "7", "name": "<b>Dépôt</b> fictif B", "description": "Texte fictif",
                                           "dataFormat": "IPv4", "organization": {"id": "1"}}),
            resultat_fictif(2, hote=1, port="443", repository={"id": 3, "name": "Dépôt fictif A"}),
            resultat_fictif(3, hote=1, port="22", repository={"id": "12", "name": "Dépôt fictif C"}),
            resultat_fictif(4, hote=2, repository={"id": "0", "name": "Dépôt fictif"}),
            resultat_fictif(5, hote=3, repository={"id": "4", "name": ""}),
            resultat_fictif(6, hote=4, repository="5"),
            resultat_fictif(7, hote=5, repository={"id": True, "name": "Dépôt fictif"}),
            resultat_fictif(8, hote=6, repository={"id": "1; DROP", "name": "Dépôt fictif"}),
            resultat_fictif(9, hote=7, repository={"id": "8", "name": "x" * 500}),
        ]
        Faux.hotes = []
        sortie = self.synchro()
        self.assertTrue(sortie["ok"], sortie.get("erreur"))
        texte = json.dumps(sortie)
        for interdit in ("Texte fictif", "IPv4", "organization", "repository", "<b>"):
            self.assertNotIn(interdit, texte)
        depots = {e["cle"][-2:]: e["depot"] for e in sortie["elements"] if e["type"] == "machine"}
        self.assertEqual(depots["a1"], {"id": "3", "nom": "Dépôt fictif A"})
        for cle in ("a2", "a3", "a4", "a5", "a6"):
            self.assertIsNone(depots[cle], cle)
        self.assertEqual(depots["a7"]["id"], "8")
        self.assertEqual(len(depots["a7"]["nom"]), h.BORNES_SYNCHRO["nomDepot"])
        self.assertEqual(sortie["resultat"]["ecartes"], 0)
        # Aucun appel nouveau : l'analyse, puis l'inventaire, comme avant.
        self.assertEqual([(r["methode"], r["chemin"].split("?")[0]) for r in Faux.recues],
                         [("POST", "/rest/analysis"), ("GET", "/rest/hosts")])
        self.assertEqual(h.depot({"id": "7", "name": "<b>Dépôt</b> fictif B"}), {"id": "7", "nom": "Dépôt fictif B"})

    def test_synchronisation_paginates_and_stops_at_its_bounds(self):
        Faux.mode = "synchro"
        Faux.analyse = [resultat_fictif(i, plugin="9000%02d" % (i % 3 + 1)) for i in range(1, 11)]
        with patch.dict(h.BORNES_SYNCHRO, {"pageAnalyse": 4}):
            sortie = self.synchro()
        self.assertEqual((sortie["resultat"]["pages"], sortie["resultat"]["detections"], sortie["resultat"]["tronque"]), (3, 10, False))
        self.assertEqual([c["startOffset"] for c in Faux.corps if c], [0, 4, 8])
        # Bornes : pages, détections, durée. La synchronisation réussit et se dit tronquée.
        for bornes, attendu in (({"pageAnalyse": 2, "pagesAnalyse": 3}, (3, 6)), ({"pageAnalyse": 4, "detections": 5}, (2, 5))):
            with self.subTest(bornes=bornes), patch.dict(h.BORNES_SYNCHRO, bornes):
                sortie = self.synchro()
                self.assertTrue(sortie["ok"])
                self.assertTrue(sortie["resultat"]["tronque"])
                self.assertEqual((sortie["resultat"]["pages"], sortie["resultat"]["detections"]), attendu)
        temps = iter([0, 0, 1000, 1000, 1000])
        client = h.Client("tenable", self.demande()["configuration"], {})
        with patch.dict(h.BORNES_SYNCHRO, {"pageAnalyse": 4}):
            resultat, elements = h.tenable_synchroniser(client, {}, horloge=lambda: next(temps))
        self.assertEqual(len([e for e in elements if e["type"] == "detection"]), 4)
        self.assertTrue(resultat["tronque"])
        self.assertEqual(resultat["pages"], 1)
        self.assertFalse(resultat["inventaire"]["ok"])
        self.assertIn("Durée maximale", resultat["inventaire"]["erreur"])

    def test_inventory_failure_does_not_fail_the_synchronisation(self):
        Faux.mode = "synchro"
        Faux.analyse = [resultat_fictif(1)]
        Faux.hotes = [hote_fictif(n) for n in range(1, 4)]
        for mode, attendu in (("refus", "code 403"), ("sans-pagination", "pagination")):
            with self.subTest(mode=mode), patch.dict(h.BORNES_SYNCHRO, {"pageMachines": 2}):
                Faux.mode_hotes = mode
                sortie = self.synchro()
                self.assertTrue(sortie["ok"])
                self.assertEqual(sortie["resultat"]["constats"], 1)
                inv = sortie["resultat"]["inventaire"]
                self.assertFalse(inv["ok"])
                self.assertIn("Inventaire des machines indisponible", inv["erreur"])
                self.assertIn(attendu, inv["erreur"])
                self.assertNotIn("\n", inv["erreur"])
                self.sans_secret(sortie)

    def test_synchronisation_errors_oversized_answers_and_bad_filters(self):
        Faux.mode = "analyse-erreur"
        sortie = self.synchro()
        self.assertEqual((sortie["ok"], sortie["resultat"]), (False, None))
        self.assertIn("code 74", sortie["erreur"])
        self.assertNotIn("elements", sortie)
        self.sans_secret(sortie)
        Faux.mode = "synchro"
        Faux.analyse = [resultat_fictif(i) for i in range(1, 30)]
        with patch.dict(h.BORNES_SYNCHRO, {"reponseAnalyse": 2000}):
            sortie = self.synchro()
        self.assertEqual(sortie, {"ok": False, "resultat": None, "erreur": "Réponse trop volumineuse : refusée."})
        Faux.recues = []
        for gravites in ([], ["info"], ["critique", "critique"], "critique"):
            with self.subTest(gravites=gravites):
                sortie = self.synchro(gravites=gravites)
                self.assertFalse(sortie["ok"])
                self.assertIn("Filtre de gravité invalide", sortie["erreur"])
        self.assertEqual(Faux.recues, [])

    def test_query_parameters_outside_the_closed_list_are_refused_before_any_call(self):
        client = h.Client("tenable", self.demande()["configuration"], {})
        for methode, chemin, parametres in (("GET", "/rest/hosts", {"filter": 1}), ("GET", "/rest/hosts", {"limit": "5"}),
                                            ("GET", "/rest/hosts", {"limit": True}), ("GET", "/rest/hosts", {"limit": -1}),
                                            ("GET", "/rest/system", {"limit": 5}), ("POST", "/rest/analysis", {"offset": 0})):
            with self.subTest(chemin=chemin, parametres=parametres), self.assertRaises(h.Refus):
                client.requete(methode, chemin, parametres=parametres)
        self.assertEqual(Faux.recues, [])

    def test_exploit_frameworks_is_a_string_and_only_three_kits_are_kept(self):
        # Lot PRIO-1 : Security Center rend `exploitFrameworks` en CHAÎNE ; seuls Metasploit, Core Impact et CANVAS sortent,
        # dans un ordre fixe ; tout autre texte, une liste ou un nombre ne donnent rien.
        self.assertEqual(h.kits_exploitation("CANVAS (EXEMPLE), Metasploit (exploit/exemple/fictif)"),
                         ["metasploit", "canvas"])
        self.assertEqual(h.kits_exploitation("Core Impact"), ["core_impact"])
        self.assertEqual(h.kits_exploitation("core"), [])
        self.assertEqual(h.kits_exploitation("Exploit-DB, autre outil"), [])
        self.assertEqual(h.kits_exploitation(""), [])
        self.assertEqual(h.kits_exploitation(["Metasploit"]), [])
        self.assertEqual(h.kits_exploitation(None), [])

    def test_field_parsers(self):
        self.assertIsNone(h.instant("-1"))

        self.assertIsNone(h.instant(""))
        self.assertIsNone(h.instant("99999999999"))
        self.assertEqual(h.instant("0000001"), "1970-01-01T00:00:01.000Z")
        self.assertEqual(h.decimal("56", 0, 100, diviseur=100), 0.56)
        self.assertIsNone(h.decimal("101", 0, 100, diviseur=100))
        self.assertIsNone(h.decimal("nan", 0, 10))
        self.assertEqual(h.cves("CVE-2026-90001, cve-2026-90002,X-1,CVE-2026-90001"), (["CVE-2026-90001", "CVE-2026-90002"], False))
        with patch.dict(h.BORNES_SYNCHRO, {"cvesParConstat": 2}):
            self.assertEqual(h.cves("CVE-2026-90001,CVE-2026-90002,CVE-2026-90003"), (["CVE-2026-90001", "CVE-2026-90002"], True))
        self.assertEqual(h.exposition('{"internet exposure":"External"}'), "external")
        self.assertIsNone(h.exposition('{"internet exposure":"<b>x</b>"}'))
        self.assertIsNone(h.exposition("pas du json"))
        self.assertIsNone(h.voir_aussi("javascript:alert(1) http://example.org"))
        self.assertEqual(h.texte("<b>Mettre</b>\n à jour‮", 100), "Mettre à jour")
        self.assertEqual(h.nom_machine("EXEMPLE\\POSTE-01"), "poste-01")
        self.assertIsNone(h.nom_machine("srv exemple"))
        self.assertEqual(h.adresse_ip("192.0.2.300,192.0.2.4"), "192.0.2.4")
        self.assertEqual(h.cle_machine(None, "192.0.2.4", "srv.exemple.invalid"), "ip:192.0.2.4|srv.exemple.invalid")

# ------------------------------------------------------------------ AlgoLightHouse (lot ALH1)
CLE_ALH = "cle-api-fictive-0123456789abcdef"
MARQUES_INTERDITES = ("NOTE-SENSIBLE", "DONNEE-DEPRECIEE", "PIECE-JOINTE", "DESCRIPTION-FRAGMENT", "MOT-DE-PASSE-FUITE",
                      "NOTE-FRAGMENT", "DEFAUT-FICTIF", "NOTE-HOTE", "CHAMP-INCONNU-ALH", "BANNIERE-INTERDITE",
                      "ETAT-BRUT-INTERDIT", "sous-domaine-interdit", "fuite-interdite", "DEPOT-GIT-INTERDIT")
U = "0190a000-0000-7000-8000-%012d"


def alh_donnees():
    """Un espace fictif : deux périmètres, deux hôtes, deux domaines, trois alertes, une technologie."""
    perimetres = [{"id": U % 1, "name": "Périmètre fictif A", "created_at": "2026-01-01T00:00:00Z", "autre": "CHAMP-INCONNU-ALH"},
                  {"id": U % 2, "name": "Périmètre fictif B"}, {"id": "pas-un-uuid", "name": "Écarté"}]
    hotes = [{"id": U % 11, "perimeter_id": U % 1, "status": "monitored", "ip_address": "192.0.2.10", "ip_version": 4,
              "isp": "FAI fictif", "asn": "64500", "country": "fr", "is_shared_server": False, "is_cdn": False,
              "is_alive": True, "alive_at": "2026-11-16T08:00:00+01:00", "is_manual_import": False,
              "alerts_by_criticity": {U % 90: 1}, "created_at": "2026-06-10T14:00:00.175603Z", "updated_at": None,
              "note": "NOTE-HOTE"},
             {"id": U % 12, "perimeter_id": U % 2, "status": "new", "ip_address": "198.51.100.20"},
             {"id": U % 13, "perimeter_id": U % 2, "ip_address": "192.0.2.10, 192.0.2.11"}]
    domaines = [{"id": U % 21, "perimeter_id": U % 1, "status": "monitored", "domain": "WWW.Exemple-Fictif.example.",
                 "level": 2, "is_manual_import": True, "ip_address": "192.0.2.10", "parent_target_domain_id": None,
                 "created_at": "2026-02-01T10:11:01Z"},
                {"id": U % 22, "perimeter_id": U % 2, "domain": "app.exemple-fictif.example", "level": 2},
                {"id": U % 23, "domain": "<script>.example"}]
    alertes = [
        {"id": U % 31, "title": "Exposed RDP service (fictif)", "status": "untreated", "type_id": U % 81,
         "perimeter_id": U % 1, "criticity_id": U % 91, "is_verified": True, "created_at": "2026-11-10T10:00:00Z",
         "updated_at": "2026-11-15T10:00:00Z", "note": "<p>NOTE-SENSIBLE</p>", "data": {"x": "DONNEE-DEPRECIEE"}},
        {"id": U % 32, "title": "Typosquatting fictif", "status": "in-progress", "type_id": U % 82,
         "perimeter_id": U % 2, "criticity_id": U % 92, "created_at": "2026-11-09T10:00:00Z",
         "updated_at": "2026-11-14T10:00:00Z"},
        {"id": U % 33, "title": "Autre service exposé (fictif)", "status": "completed", "type_id": U % 81,
         "perimeter_id": U % 1, "criticity_id": U % 92, "created_at": "2026-10-01T10:00:00Z",
         "updated_at": "2026-10-02T10:00:00Z"},
    ]
    details = {
        U % 31: {"id": U % 31, "title": "Exposed RDP service (fictif)", "status": "untreated",
                 "note": "<p>NOTE-SENSIBLE</p>", "data": {"x": "DONNEE-DEPRECIEE"},
                 "type": {"id": U % 81, "value": "vulnerable_service"}, "criticity": {"id": U % 91, "value": "critical", "level": 4},
                 "perimeter": {"id": U % 1, "name": "Périmètre fictif A"},
                 "target": {"id": U % 41, "perimeter_id": U % 1, "type": "host", "value": "192.0.2.10",
                            "target_host_id": U % 11, "target_domain_id": None,
                            "target_host": {"id": U % 11, "note": "NOTE-HOTE", "isp": "FAI fictif"}},
                 "defects": [{"id": U % 71, "category_id": U % 72, "category": {"name": "DEFAUT-FICTIF"}, "note": "DEFAUT-FICTIF",
                              "name": "Exposed port or service",
                              "description": "<p>Service <b>exposé</b> &amp; joignable sur <a href='https://x.example'>Internet</a>.</p>",
                              "resolutions": [{"id": U % 73, "name": "Restrict access",
                                               "description": "<p>Filtrer par adresse IP.</p><script>alert(1)</script>",
                                               "ease_of_execution": {"id": U % 74, "value": "Quick Win", "level": 1},
                                               "security_gain": {"value": "Strong", "level": 3, "note": "DEFAUT-FICTIF"},
                                               "created_at": "2026-01-15T10:00:00Z", "autre": "DEFAUT-FICTIF"},
                                              {"description": "sans nom : écartée"}]},
                             {"description": "défaut sans nom : écarté"}],
                 "uploads": [{"name": "PIECE-JOINTE"}],
                 "cves": [{"id": U % 51, "name": "CVE-2026-91001", "score": 9.8}, "CVE-2026-91003", {"x": "pas une CVE"}],
                 "fragments": [{"id": U % 61, "description": "DESCRIPTION-FRAGMENT", "note": "NOTE-FRAGMENT",
                                "has_sensitive_data": True, "sensitive_data": {"password": "MOT-DE-PASSE-FUITE"},
                                "json_data": {"fragment_type": "port", "note": "NOTE-FRAGMENT", "port": 3389,
                                              "protocol": "tcp", "state": "ETAT-BRUT-INTERDIT", "service_name": "ms-wbt-server",
                                              "product": "Microsoft Terminal Services", "banner": "BANNIERE-INTERDITE",
                                              "is_cdn": True},
                                "alert_cves": [{"cve_id": U % 52, "cve": {"id": "CVE-2026-91002", "x": "MOT-DE-PASSE-FUITE CVE-2026-99999"}}]}],
                 "completed_at": None, "created_at": "2026-11-10T10:00:00Z"},
        U % 32: {"id": U % 32, "type": {"id": U % 82, "value": "typosquatting"},
                 "criticity": {"id": U % 92, "value": "major"},
                 "target": {"type": "domain", "value": "app.exemple-fictif.example", "target_domain_id": U % 22},
                 "cves": [], "fragments": []},
        U % 33: {"id": U % 33, "type": {"id": U % 81, "value": "vulnerable_service"},
                 "criticity": {"id": U % 92, "value": "major"}, "completed_at": "2026-10-02T10:00:00Z"},
    }
    technologies = [{
        "display_name": "nginx", "vendor": "F5", "product": "Nginx", "technology": "", "last_scanned_at": "2026-11-16T00:00:00Z",
        "active_versions": [{"version": "1.18.0", "assets": [{"id": U % 11, "label": "192.0.2.10", "type": "host"},
                                                             {"id": U % 21, "label": "www.exemple-fictif.example", "type": "domain"},
                                                             {"id": "x", "label": "écarté", "type": "host"}],
                             "cves": [{"cve": "CVE-2026-92001", "title": "Faille fictive", "cvss": 7.5, "epss": 0.42,
                                       "severity": "HIGH", "has_poc": True, "is_exploited": False,
                                       "published_at": "2026-03-01T00:00:00Z", "autre": "CHAMP-INCONNU-ALH"},
                                      {"cve": "CVE-2026-92002", "epss": 42, "cvss": 11, "is_exploited": True}]}],
        "inactive_assets": [{"id": U % 22, "label": "app.exemple-fictif.example", "type": "domain"}],
    }, {"vendor": None}]
    return {"/api/v1/perimeters": perimetres, "/api/v1/targets/hosts": hotes, "/api/v1/targets/domains": domaines,
            "/api/v1/alerts": alertes, "/api/v1/technologies": technologies, "details": details}


class FauxAlh(http.server.BaseHTTPRequestHandler):
    """Faux espace AlgoLightHouse : listes en tableaux directs, détail d'une alerte, santé et version."""

    protocol_version = "HTTP/1.0"
    donnees = {}
    recues = []
    absentes = set()

    def log_message(self, *args):
        pass

    def repondre(self, code, valeur):
        corps = json.dumps(valeur).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def traiter(self):
        FauxAlh.recues.append({"methode": self.command, "chemin": self.path, "cle": self.headers.get("X-API-Key"),
                               "mandataire": self.headers.get("Proxy-Authorization")})
        if self.path == "/api/v1/health":
            return self.repondre(200, {"status": FauxAlh.donnees.get("sante", "ok")})
        if self.path == "/api/v1/version":
            return self.repondre(200, {"version": "1.14.0", "date": "2026-11-05", "autre": "CHAMP-INCONNU-ALH"})
        if self.path in FauxAlh.donnees:
            return self.repondre(200, FauxAlh.donnees[self.path])
        if self.path.startswith("/api/v1/alerts/"):
            ident = self.path.rsplit("/", 1)[1]
            if ident in FauxAlh.absentes or ident not in FauxAlh.donnees["details"]:
                return self.repondre(404, {"message": "introuvable"})
            return self.repondre(200, FauxAlh.donnees["details"][ident])
        return self.repondre(404, {})

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = traiter


class FauxMandataire(socketserver.ThreadingTCPServer):
    """Faux mandataire HTTP : n'accepte que CONNECT, exige au besoin l'authentification simple, puis relaie les octets."""

    daemon_threads = True
    allow_reuse_address = True

    def __init__(self):
        super().__init__(("127.0.0.1", 0), TraitementMandataire)
        self.demandes = []
        self.attendu = None


class TraitementMandataire(socketserver.BaseRequestHandler):
    def handle(self):
        srv, client = self.server, self.request
        brut = b""
        while b"\r\n\r\n" not in brut:
            d = client.recv(4096)
            if not d:
                return
            brut += d
        tete, _, reste = brut.partition(b"\r\n\r\n")
        lignes = tete.decode("latin-1").split("\r\n")
        entetes = {k.strip().lower(): val.strip() for k, _, val in (x.partition(":") for x in lignes[1:])}
        srv.demandes.append({"ligne": lignes[0], "entetes": entetes})
        methode, cible, _ = lignes[0].split(" ", 2)
        if methode != "CONNECT":
            client.sendall(b"HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\n\r\n")
            return
        if srv.attendu is not None:
            jeton = "Basic " + base64.b64encode(("%s:%s" % srv.attendu).encode("utf-8")).decode("ascii")
            if entetes.get("proxy-authorization") != jeton:
                client.sendall(b"HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm=\"fictif\"\r\nContent-Length: 0\r\n\r\n")
                return
        hote, port = cible.rsplit(":", 1)
        dest = socket.create_connection(("127.0.0.1" if hote == "localhost" else hote, int(port)), timeout=10)
        client.sendall(b"HTTP/1.1 200 Connection established\r\n\r\n")
        if reste:
            dest.sendall(reste)

        def copier(de, vers):
            try:
                while True:
                    d = de.recv(65536)
                    if not d:
                        break
                    vers.sendall(d)
            except OSError:
                pass
            finally:
                try:
                    vers.shutdown(socket.SHUT_WR)
                except OSError:
                    pass
        t = threading.Thread(target=copier, args=(dest, client), daemon=True)
        t.start()
        copier(client, dest)
        t.join(10)
        dest.close()


class AlgoLightHouse(unittest.TestCase):
    """Connecteur AlgoLightHouse contre un faux espace local. L'adresse de l'éditeur est remplacée par celle du faux service
    (ADRESSE_ALH élargie au seul localhost pour le test) ; le certificat du faux service est reconnu par le contexte de test."""

    @classmethod
    def setUpClass(cls):
        cls.dossier = tempfile.TemporaryDirectory()
        d = Path(cls.dossier.name)
        cls.ca = certificat(d, "alh")
        cls.serveur = http.server.ThreadingHTTPServer(("127.0.0.1", 0), FauxAlh)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.load_cert_chain(str(d / "alh.crt"), str(d / "alh.key"))
        cls.serveur.socket = ctx.wrap_socket(cls.serveur.socket, server_side=True)
        cls.port = cls.serveur.server_address[1]
        threading.Thread(target=cls.serveur.serve_forever, daemon=True).start()
        cls.mandataire = FauxMandataire()
        threading.Thread(target=cls.mandataire.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        for srv in (cls.serveur, cls.mandataire):
            srv.shutdown()
            srv.server_close()
        cls.dossier.cleanup()

    def setUp(self):
        FauxAlh.donnees, FauxAlh.recues, FauxAlh.absentes = alh_donnees(), [], set()
        self.mandataire.demandes, self.mandataire.attendu = [], None
        reel = h.contexte
        self.reconnu = True
        for cible, valeur in (("ADRESSE_ALH", h.re.compile(r"^https://localhost:%d$" % self.port)),
                              ("contexte", lambda ca: reel(self.ca if self.reconnu else ca))):
            p = patch.object(h, cible, valeur)
            p.start()
            self.addCleanup(p.stop)

    def demande(self, operation="tester", **extra):
        p = {"type": "algolighthouse", "operation": operation,
             "configuration": {"adresse": "https://localhost:%d" % self.port, "delaiSecondes": 5},
             "secrets": {"cleApi": CLE_ALH}}
        p.update(extra)
        return p

    def propre(self, sortie):
        texte = json.dumps(sortie, ensure_ascii=False)
        self.assertNotIn(CLE_ALH, texte)
        for marque in MARQUES_INTERDITES:
            self.assertNotIn(marque, texte)
        if sortie.get("erreur") is not None:
            self.assertNotIn("\n", sortie["erreur"])
            self.assertLessEqual(len(sortie["erreur"]), h.ERREUR_MAX)

    def lecture_seule(self):
        """Chaque appel reçu est une lecture (GET) d'un chemin de la liste fermée, sans paramètre de requête."""
        for r in FauxAlh.recues:
            self.assertEqual(r["methode"], "GET", r)
            self.assertNotIn("?", r["chemin"])
            self.assertTrue(h.point_admis("algolighthouse", "GET", r["chemin"]), r)
            self.assertTrue(r["chemin"].startswith("/api/v1/"), r)
            self.assertEqual(r["cle"], CLE_ALH)

    def test_tester_reads_health_then_version_and_only_the_version_leaves(self):
        sortie = h.executer(self.demande())
        self.assertEqual(sortie, {"ok": True, "resultat": {"version": "1.14.0"}, "erreur": None})
        self.assertEqual([r["chemin"] for r in FauxAlh.recues], ["/api/v1/health", "/api/v1/version"])
        self.lecture_seule()
        self.propre(sortie)
        FauxAlh.donnees["sante"] = "unavailable"
        sortie = h.executer(self.demande())
        self.assertFalse(sortie["ok"])
        self.assertIn("indisponible", sortie["erreur"])

    def test_synchronisation_keeps_only_listed_fields_and_never_writes(self):
        sortie = h.executer(self.demande("synchroniser"))
        self.assertTrue(sortie["ok"], sortie)
        self.propre(sortie)
        self.lecture_seule()
        self.assertEqual(sortie["resultat"], {"perimetres": 2, "hotes": 2, "domaines": 2, "alertes": 3, "details": 3,
                                              "technologies": 1, "ecartes": 5, "tronque": False})
        par = {}
        for e in sortie["elements"]:
            par.setdefault(e["type"], []).append(e)
        self.assertEqual(par["perimetre"][0], {"type": "perimetre", "id": U % 1, "nom": "Périmètre fictif A"})
        self.assertEqual(par["hote"][0], {
            "type": "hote", "id": U % 11, "perimetre": U % 1, "statut": "monitored", "adresse": "192.0.2.10",
            "fai": "FAI fictif", "asn": "64500", "pays": "FR", "mutualise": False, "cdn": False, "joignable": True,
            "joignableLe": "2026-11-16T07:00:00.000Z", "importManuel": False, "creeLe": "2026-06-10T14:00:00.000Z",
            "majLe": None})
        self.assertEqual(par["domaine"][0]["domaine"], "www.exemple-fictif.example")
        self.assertEqual(par["domaine"][1]["perimetre"], U % 2)
        a1 = next(a for a in par["alerte"] if a["id"] == U % 31)
        self.assertEqual(a1, {
            "type": "alerte", "id": U % 31, "perimetre": U % 1, "typeAlerte": "vulnerable_service", "criticite": "critical",
            "statut": "untreated", "titre": "Exposed RDP service (fictif)", "verifiee": True, "detail": True,
            "cibleType": "host", "cibleValeur": "192.0.2.10", "cibleHote": U % 11, "cibleDomaine": None,
            "cves": ["CVE-2026-91001", "CVE-2026-91003", "CVE-2026-91002"],
            "defauts": [{"nom": "Exposed port or service", "description": "Service exposé & joignable sur Internet .",
                         "resolutions": [{"nom": "Restrict access", "description": "Filtrer par adresse IP. alert(1)",
                                          "facilite": "Quick Win", "gain": "Strong"}]}],
            "services": [{"port": 3389, "protocole": "tcp", "nom": "ms-wbt-server", "produit": "Microsoft Terminal Services",
                          "version": None, "editeur": None, "cpe": None, "statutVersion": None}],
            "creeLe": "2026-11-10T10:00:00.000Z", "majLe": "2026-11-15T10:00:00.000Z", "termineeLe": None})
        # Les défauts ne viennent que du détail ; sans défaut publié, la liste est vide.
        self.assertEqual(next(a for a in par["alerte"] if a["id"] == U % 32)["defauts"], [])
        # Une valeur au-delà du premier niveau d'un objet CVE n'est jamais lue (CVE-2026-99999 dans un texte libre).
        self.assertNotIn("CVE-2026-99999", json.dumps(sortie))
        self.assertEqual(next(a for a in par["alerte"] if a["id"] == U % 33)["termineeLe"], "2026-10-02T10:00:00.000Z")
        self.assertEqual(par["technologie"], [{"type": "technologie", "cle": "f5|nginx|", "nom": "nginx", "editeur": "F5",
                                              "produit": "Nginx", "technologie": None, "derniere": "2026-11-16T00:00:00.000Z",
                                              "tronquee": False}])
        self.assertEqual([(x["version"], x["typeActif"], x["libelle"], x["actuel"]) for x in par["technologie_actif"]],
                         [("1.18.0", "hote", "192.0.2.10", True), ("1.18.0", "domaine", "www.exemple-fictif.example", True),
                          ("", "domaine", "app.exemple-fictif.example", False)])
        self.assertEqual(par["technologie_cve"][0], {
            "type": "technologie_cve", "technologie": "f5|nginx|", "version": "1.18.0", "cve": "CVE-2026-92001",
            "titre": "Faille fictive", "cvss": 7.5, "epss": 0.42, "severite": "high", "preuve": True, "exploitee": False,
            "publieeLe": "2026-03-01T00:00:00.000Z"})
        # EPSS hors de 0 à 1 et score hors de 0 à 10 : écartés, jamais convertis.
        self.assertEqual((par["technologie_cve"][1]["epss"], par["technologie_cve"][1]["cvss"]), (None, None))
        # Ordre : chaque technologie précède ses actifs et ses CVE.
        types = [e["type"] for e in sortie["elements"]]
        self.assertLess(types.index("technologie"), types.index("technologie_actif"))
        self.assertEqual(types[: len(par["perimetre"])], ["perimetre"] * len(par["perimetre"]))

    def test_defects_are_plain_bounded_text_from_a_closed_list_of_fields(self):
        """Lot ALH2 : défauts et résolutions en liste blanche, balises retirées (jamais de HTML), bornés en nombre et en
        longueur ; aucun autre champ (catégorie, notes, identifiants) ne sort."""
        d = FauxAlh.donnees["details"][U % 31]
        d["defects"] = [{"name": "Défaut %d <img src=x onerror=alert(1)>" % i, "description": "<p>" + "x" * 5000 + "</p>",
                         "resolutions": [{"name": "Résolution %d" % j, "ease_of_execution": "pas un objet"}
                                         for j in range(12)]} for i in range(22)]
        sortie = h.executer(self.demande("synchroniser"))
        self.assertTrue(sortie["ok"], sortie)
        self.propre(sortie)
        a1 = next(e for e in sortie["elements"] if e["type"] == "alerte" and e["id"] == U % 31)
        self.assertEqual(len(a1["defauts"]), h.BORNES_ALH["defautsParAlerte"])
        premier = a1["defauts"][0]
        self.assertEqual(premier["nom"], "Défaut 0")
        self.assertEqual(len(premier["description"]), h.BORNES_ALH["descriptionDefaut"])
        self.assertTrue(premier["description"].endswith("…"))
        self.assertEqual(len(premier["resolutions"]), h.BORNES_ALH["resolutionsParDefaut"])
        self.assertEqual(premier["resolutions"][0], {"nom": "Résolution 0", "description": None, "facilite": None,
                                                     "gain": None})
        texte = json.dumps(sortie, ensure_ascii=False)
        for balise in ("<img", "<p>", "onerror=alert(1)>"):
            self.assertNotIn(balise, texte)
        self.assertEqual(set(premier), {"nom", "description", "resolutions"})

    def test_services_are_read_from_port_component_and_subdomain_fragments_only(self):
        """Lot ALH6 : services lus dans `json_data` des fragments `port`, `vulnerable_component` et `subdomain`, réduits à
        la liste blanche ; protocole non renseigné quand l'éditeur ne le donne pas (jamais « tcp » par défaut) ; ni bannière,
        ni état brut, ni nom de sous-domaine, ni aucun champ des autres types de fragment."""
        d = FauxAlh.donnees["details"][U % 31]
        d["fragments"] = [
            {"id": U % 61, "description": "DESCRIPTION-FRAGMENT", "note": "NOTE-FRAGMENT",
             "json_data": {"fragment_type": "port", "port": 443, "protocol": "tcp", "state": "ETAT-BRUT-INTERDIT",
                           "service_name": "https", "product": "nginx", "version": "1.18.0", "vendor": "F5",
                           "banner": "BANNIERE-INTERDITE", "cpe": "cpe:/a:f5:nginx:1.18.0",
                           "description": "DESCRIPTION-FRAGMENT", "autre": "CHAMP-INCONNU-ALH"}},
            {"json_data": {"fragment_type": "vulnerable_component", "vendor": "", "product": "nginx", "version": "1.18.0",
                           "cpe": "cpe:2.3:a:f5:nginx:1.18.0", "ports": [443, 8443, "80", 70000, True, 8443],
                           "latest_version": "1.27.0", "version_status": "eol"}},
            {"json_data": {"fragment_type": "port", "port": 53, "protocol": "udp", "service_name": "<b>domain</b>"}},
            {"json_data": {"fragment_type": "port", "port": 22, "protocol": "sctp", "product": "*"}},
            {"json_data": {"fragment_type": "subdomain", "subdomain": "sous-domaine-interdit.example", "port": 8080}},
            {"json_data": {"fragment_type": "leak", "leak_type": "email", "email": "fuite-interdite@exemple.example",
                           "port": 25}},
            {"json_data": {"fragment_type": "git_mention", "match_type": "repo_mention", "provider": "GitHub",
                           "repo": "DEPOT-GIT-INTERDIT", "port": 9418}},
            {"json_data": {"fragment_type": "tls_certificate", "weakness": "expired", "serial_number": "00", "port": 993}},
            {"json_data": {"fragment_type": "port", "port": "21", "protocol": "tcp"}},
            {"json_data": {"fragment_type": "port", "port": 0, "protocol": "tcp"}},
            {"json_data": None}, {"json_data": "port 80"}, {"json_data": [{"fragment_type": "port", "port": 81}]},
            "pas un objet", None,
        ]
        sortie = h.executer(self.demande("synchroniser"))
        self.assertTrue(sortie["ok"], sortie)
        self.propre(sortie)
        self.lecture_seule()
        a1 = next(e for e in sortie["elements"] if e["type"] == "alerte" and e["id"] == U % 31)
        vide = {"nom": None, "produit": None, "version": None, "editeur": None, "cpe": None, "statutVersion": None}
        self.assertEqual(a1["services"], [
            dict(vide, port=22, protocole=None),
            dict(vide, port=53, protocole="udp", nom="domain"),
            {"port": 443, "protocole": "tcp", "nom": "https", "produit": "nginx", "version": "1.18.0", "editeur": "F5",
             "cpe": "cpe:/a:f5:nginx:1.18.0", "statutVersion": "eol"},
            dict(vide, port=8080, protocole=None),
            dict(vide, port=8443, protocole=None, produit="nginx", version="1.18.0", cpe="cpe:2.3:a:f5:nginx:1.18.0",
                 statutVersion="eol"),
        ])
        for s in a1["services"]:
            self.assertEqual(set(s), {"port", "protocole", "nom", "produit", "version", "editeur", "cpe", "statutVersion"})
        texte = json.dumps(sortie, ensure_ascii=False)
        for interdit in ("<b>", "latest_version", "1.27.0", '"tcp", "port": 21', "is_cdn"):
            self.assertNotIn(interdit, texte)

    def test_services_with_unexpected_shapes_are_skipped_and_bounded(self):
        """Forme réelle de `json_data` non vérifiée : fragments absents, nuls ou d'une autre forme ne rangent rien et la
        synchronisation continue ; le nombre de services par alerte est borné ; aucun appel n'est ajouté."""
        details = FauxAlh.donnees["details"]
        details[U % 31]["fragments"] = {"json_data": {"fragment_type": "port", "port": 443}}
        details[U % 32]["fragments"] = [{"json_data": {"fragment_type": "port", "port": 1000 + i, "protocol": "tcp"}}
                                        for i in range(60)]
        details[U % 33]["fragments"] = [{"json_data": {"fragment_type": "vulnerable_component", "ports": "443"}},
                                        {"json_data": {"fragment_type": "subdomain", "port": None}},
                                        {"json_data": {"fragment_type": None, "port": 443}}]
        with patch.dict(h.BORNES_ALH, {"servicesParAlerte": 5}):
            sortie = h.executer(self.demande("synchroniser"))
        self.assertTrue(sortie["ok"], sortie)
        self.assertFalse(sortie["resultat"]["tronque"])
        par = {e["id"]: e for e in sortie["elements"] if e["type"] == "alerte"}
        self.assertEqual(par[U % 31]["services"], [])
        self.assertEqual([s["port"] for s in par[U % 32]["services"]], [1000, 1001, 1002, 1003, 1004])
        self.assertEqual(par[U % 33]["services"], [])
        # Aucun appel nouveau : les listes, puis un détail par alerte, puis les technologies, comme avant le lot ALH6.
        self.assertEqual(sorted(r["chemin"] for r in FauxAlh.recues), sorted(
            ["/api/v1/perimeters", "/api/v1/targets/hosts", "/api/v1/targets/domains", "/api/v1/alerts",
             "/api/v1/technologies"] + ["/api/v1/alerts/" + U % n for n in (31, 32, 33)]))
        self.lecture_seule()

    def test_alerts_without_detail_get_type_and_criticity_from_known_identifiers(self):
        with patch.dict(h.BORNES_ALH, {"details": 2}):
            sortie = h.executer(self.demande("synchroniser"))
        self.assertTrue(sortie["ok"], sortie)
        self.assertTrue(sortie["resultat"]["tronque"])
        self.assertEqual(sortie["resultat"]["details"], 2)
        a3 = next(e for e in sortie["elements"] if e["type"] == "alerte" and e["id"] == U % 33)
        # Plus ancienne, son détail n'est pas lu : type et criticité viennent des identifiants vus dans d'autres détails.
        self.assertEqual((a3["detail"], a3["typeAlerte"], a3["criticite"], a3["cves"], a3["cibleType"], a3["services"]),
                         (False, "vulnerable_service", "major", [], None, []))
        self.assertNotIn("/api/v1/alerts/" + U % 33, [r["chemin"] for r in FauxAlh.recues])

    def test_shapes_seen_on_a_real_workspace_are_read(self):
        """Formes relevées sur un espace réel (exemples anonymisés du RSSI) : date de création vide dans la liste, joker
        « * » pour le produit et le nom affiché, version vide, numéro d'AS préfixé, date de dernier passage absente."""
        d = FauxAlh.donnees
        d["/api/v1/alerts"][0]["created_at"] = "0001-01-01T00:00:00Z"
        d["details"][U % 31]["created_at"] = "2026-03-03T07:27:20.927961Z"
        d["/api/v1/targets/hosts"][0]["asn"] = "AS64500"
        d["/api/v1/technologies"].append({
            "display_name": "*", "vendor": "editeur-fictif", "product": "*", "technology": "Service fictif",
            "active_versions": [{"version": "", "assets": [{"id": U % 21, "label": "www.exemple-fictif.example", "type": "domain"}],
                                 "cves": []}],
            "inactive_assets": [], "last_scanned_at": None})
        sortie = h.executer(self.demande("synchroniser"))
        self.assertTrue(sortie["ok"], sortie)
        self.propre(sortie)
        texte = json.dumps(sortie, ensure_ascii=False)
        self.assertIn("2026-03-03T07:27:20.000Z", texte)
        self.assertNotIn("0001-01-01", texte)
        self.assertIn('"asn": "64500"', texte)
        self.assertIn("Service fictif", texte)
        self.assertNotIn('"*"', texte)

    def test_bounds_missing_details_and_duration_make_an_incomplete_synchronisation(self):
        with patch.dict(h.BORNES_ALH, {"alertes": 2, "hotes": 1}):
            sortie = h.executer(self.demande("synchroniser"))
        self.assertTrue(sortie["resultat"]["tronque"])
        self.assertEqual((sortie["resultat"]["alertes"], sortie["resultat"]["hotes"]), (2, 1))
        FauxAlh.absentes = {U % 32}
        sortie = h.executer(self.demande("synchroniser"))
        self.assertTrue(sortie["ok"])
        self.assertTrue(sortie["resultat"]["tronque"])
        self.assertEqual(sortie["resultat"]["details"], 2)
        horloge = iter([0] + [10 ** 6] * 50)
        client = h.Client("algolighthouse", self.demande()["configuration"], h.cle_alh({"cleApi": CLE_ALH}))
        with self.assertRaises(h.Refus):
            h.alh_synchroniser(client, {}, horloge=lambda: next(horloge))

    def test_writes_and_paths_outside_the_closed_list_are_refused_before_any_call(self):
        client = h.Client("algolighthouse", self.demande()["configuration"], h.cle_alh({"cleApi": CLE_ALH}))
        for methode, chemin in (("POST", "/api/alerts/%s/comments" % (U % 31)), ("PUT", "/api/alerts/%s/status" % (U % 31)),
                                ("POST", "/api/v1/alerts/%s/comments" % (U % 31)), ("PUT", "/api/v1/alerts/" + U % 31),
                                ("GET", "/api/alerts"), ("GET", "/api/contacts"), ("POST", "/api/search"),
                                ("GET", "/api/v1/targets/keywords"), ("GET", "/api/alert-types"), ("DELETE", "/api/v1/alerts"),
                                ("GET", "/api/v1/alerts/../contacts"), ("GET", "/api/v1/alerts?status=untreated")):
            with self.subTest(chemin=chemin), self.assertRaises(h.Refus):
                client.requete(methode, chemin)
        self.assertEqual(FauxAlh.recues, [])
        with self.assertRaises(h.Refus):
            client.requete("GET", "/api/v1/alerts", parametres={"status": 1})
        # Toute la liste fermée du type est en lecture.
        self.assertEqual({m for m, _ in h.POINTS_ACCES["algolighthouse"]}, {"GET"})

    def test_address_key_and_configuration_are_checked_before_any_call(self):
        p = patch.object(h, "ADRESSE_ALH", h.re.compile(r"^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.algolighthouse\.fr$"))
        p.start()
        self.addCleanup(p.stop)
        for adresse in ("https://localhost:%d" % self.port, "https://espace.algolighthouse.fr:8443",
                        "https://espace.algolighthouse.fr.exemple.invalid", "http://espace.algolighthouse.fr",
                        "https://espace.algolighthouse.fr/api", "https://compte@espace.algolighthouse.fr"):
            with self.subTest(adresse=adresse):
                sortie = h.executer(self.demande(configuration={"adresse": adresse, "delaiSecondes": 5}))
                self.assertFalse(sortie["ok"])
                self.assertIn("Adresse refusée", sortie["erreur"])
        sortie = h.executer(self.demande(configuration={"adresse": "https://espace.algolighthouse.fr", "autoriteCertification": self.ca}))
        self.assertIn("pas d'autorité de certification propre", sortie["erreur"])
        for cle in ("courte", "avec espace 0123456789", "x" * 257, None):
            with self.subTest(cle=cle):
                sortie = h.executer(self.demande(secrets={"cleApi": cle}))
                self.assertIn("Clé d'API absente", sortie["erreur"])
        self.assertEqual(FauxAlh.recues, [])
        self.assertTrue(h.ADRESSE_ALH.fullmatch("https://espace-fictif.algolighthouse.fr"))

    def mandataire_params(self, **extra):
        m = {"hote": "127.0.0.1", "port": self.mandataire.server_address[1], "identifiant": "", "motDePasse": "",
             "autorite": ""}
        m.update(extra)
        return m

    def test_through_the_proxy_the_key_never_reaches_it_and_basic_auth_goes_to_the_proxy_only(self):
        self.mandataire.attendu = ("compte-fictif", "Mdp-fictif:42")
        sortie = h.executer(self.demande(mandataire=self.mandataire_params(identifiant="compte-fictif", motDePasse="Mdp-fictif:42")))
        self.assertEqual(sortie, {"ok": True, "resultat": {"version": "1.14.0"}, "erreur": None})
        self.assertEqual([d["ligne"] for d in self.mandataire.demandes], ["CONNECT localhost:%d HTTP/1.1" % self.port] * 2)
        for d in self.mandataire.demandes:
            self.assertNotIn(CLE_ALH, json.dumps(d))
        # Le service reçoit la clé, jamais l'authentification du mandataire.
        self.assertEqual({(r["cle"], r["mandataire"]) for r in FauxAlh.recues}, {(CLE_ALH, None)})
        sortie = h.executer(self.demande(mandataire=self.mandataire_params()))
        self.assertIn("exige une authentification (code 407)", sortie["erreur"])
        self.assertNotIn("Mdp-fictif", json.dumps(sortie))

    def test_through_the_proxy_the_certificate_is_still_verified_and_the_authority_can_be_added(self):
        self.reconnu = False  # autorités du système seulement : le faux service n'y est pas
        sortie = h.executer(self.demande(mandataire=self.mandataire_params()))
        self.assertFalse(sortie["ok"])
        self.assertIn("Certificat du service refusé à travers le mandataire", sortie["erreur"])
        sortie = h.executer(self.demande(mandataire=self.mandataire_params(autorite=self.ca)))
        self.assertTrue(sortie["ok"], sortie)

    def test_malformed_proxy_or_proxy_for_tenable_calls_nothing(self):
        for m in ("http://mandataire.exemple.invalid:3128", {"hote": "x"}, self.mandataire_params(port="3128"),
                  self.mandataire_params(identifiant="a:b"), self.mandataire_params(autorite="pas un certificat")):
            with self.subTest(mandataire=str(m)[:40]):
                sortie = h.executer(self.demande(mandataire=m))
                self.assertIn("Paramètres du mandataire illisibles", sortie["erreur"])
        # Tenable est interne : un mandataire reçu pour lui est refusé, rien n'est appelé.
        sortie = h.executer({"type": "tenable", "operation": "tester", "configuration": {"adresse": "https://localhost:%d" % self.port},
                             "secrets": {"accessKey": CLE_ACCES, "secretKey": CLE_SECRETE}, "mandataire": self.mandataire_params()})
        self.assertIn("Mandataire refusé", sortie["erreur"])
        self.assertEqual((FauxAlh.recues, self.mandataire.demandes), ([], []))

    def test_iso_dates_and_field_parsers(self):
        self.assertEqual(h.instant_iso("2024-02-01T10:11:01.175603Z"), "2024-02-01T10:11:01.000Z")
        self.assertEqual(h.instant_iso("2026-11-16T08:00:00+01:00"), "2026-11-16T07:00:00.000Z")
        for refusee in ("2024-02-01", "2024-02-01T10:11:01", "2024-13-01T00:00:00Z", "demain", 1794787200, None):
            self.assertIsNone(h.instant_iso(refusee))
        self.assertEqual(h.adresse_unique("2001:DB8::1"), "2001:db8::1")
        self.assertIsNone(h.adresse_unique("192.0.2.1, 192.0.2.2"))
        self.assertEqual(h.domaine_alh("*.Exemple.example"), "*.exemple.example")
        self.assertIsNone(h.domaine_alh("exemple.example/chemin"))
        self.assertEqual(h.cves_de({"a": "cve-2026-90001", "b": {"c": "CVE-2026-90002"}}), ["CVE-2026-90001"])



class Adresse(unittest.TestCase):
    def test_only_a_bare_https_address_on_port_443_is_accepted(self):
        self.assertEqual(h.hote_et_port("https://tenable.exemple.test"), ("tenable.exemple.test", 443))
        self.assertEqual(h.hote_et_port("https://10.0.0.5/"), ("10.0.0.5", 443))
        self.assertEqual(h.hote_et_port("https://tenable.exemple.test:443"), ("tenable.exemple.test", 443))
        # Port réglable de 1 à 65535 (décision du RSSI du 16/11/2026).
        self.assertEqual(h.hote_et_port("https://tenable.exemple.test:8443"), ("tenable.exemple.test", 8443))
        self.assertEqual(h.hote_et_port("https://10.0.0.5:1/"), ("10.0.0.5", 1))
        self.assertEqual(h.hote_et_port("https://[fd00::5]:65535"), ("fd00::5", 65535))
        self.assertEqual(h.hote_et_port("https://[fd00::5]"), ("fd00::5", 443))
        for refusee in ("http://tenable.exemple.test", "https://compte:mdp@tenable.exemple.test", "https://tenable.exemple.test/rest",
                        "https://tenable.exemple.test?x=1", "https://tenable.exemple.test#a", "https://tenable.exemple.test:0",
                        "https://tenable.exemple.test:65536", "https://tenable.exemple.test:abc", "https://tenable.exemple.test:",
                        "https://tenable.exemple.test:+443", "https://tenable.exemple.test:８４４３", "https://tenable.exemple.test:8443/rest",
                        "https://tenable exemple.test", "ftp://tenable.exemple.test", "", None, 42):
            with self.subTest(adresse=refusee), self.assertRaises(h.Refus):
                h.hote_et_port(refusee)


class Isolement(unittest.TestCase):
    def test_runs_isolated_reads_stdin_and_writes_one_normalized_object(self):
        """Lancé comme par l'exécutant (python -I, environnement minimal) : entrée standard seulement, sortie JSON bornée,
        aucun secret même quand l'adresse est refusée avant tout appel."""
        p = {"type": "tenable", "operation": "tester", "configuration": {"adresse": "http://tenable.exemple.test"},
             "secrets": {"accessKey": CLE_ACCES, "secretKey": CLE_SECRETE}}
        fait = subprocess.run([sys.executable, "-I", str(SCRIPT)], input=json.dumps(p), capture_output=True, text=True,
                              timeout=30, env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"}, cwd="/")
        self.assertEqual(fait.returncode, 0, fait.stderr)
        sortie = json.loads(fait.stdout)
        self.assertEqual(set(sortie), {"ok", "resultat", "erreur"})
        self.assertFalse(sortie["ok"])
        self.assertIn("Adresse refusée", sortie["erreur"])
        self.assertNotIn(CLE_SECRETE, fait.stdout + fait.stderr)
        # Entrée trop grosse ou illisible : refus explicite, rien d'appelé.
        for entree in ("{", "x" * (h.ENTREE_MAX + 2)):
            fait = subprocess.run([sys.executable, "-I", str(SCRIPT)], input=entree, capture_output=True, text=True, timeout=30)
            self.assertEqual(json.loads(fait.stdout), {"ok": False, "resultat": None, "erreur": "Demande illisible."})

    def test_standard_library_only(self):
        import ast
        arbre = ast.parse(SCRIPT.read_text(encoding="utf8"))
        modules = {a.name.split(".")[0] for n in ast.walk(arbre) if isinstance(n, ast.Import) for a in n.names}
        modules |= {n.module.split(".")[0] for n in ast.walk(arbre) if isinstance(n, ast.ImportFrom) and n.module}
        self.assertTrue(modules <= set(sys.stdlib_module_names), modules - set(sys.stdlib_module_names))
        self.assertNotIn("urllib", modules)  # http.client direct : aucun gestionnaire de redirection


if __name__ == "__main__":
    unittest.main()

"""Script isolé des connecteurs (scripts/integration-http.py, ADR 0076 point 5, ADR 0100 point 6) contre un faux service
HTTPS local : seule la version sort de /rest/system, liste fermée des points d'accès, aucune redirection suivie, certificat
toujours vérifié, réponse bornée, erreur sur une ligne sans secret. Synchronisation (ADR 0100, lot V5) : seuls les champs
listés sortent (jamais pluginText), pagination et bornes, inventaire en échec toléré, score EPSS converti. Données
entièrement fictives (noms en .invalid, adresses de 192.0.2.0/24, CVE fictives) ; aucun service réel."""
import http.server
import importlib.util
import json
import os
from pathlib import Path
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
    @classmethod
    def setUpClass(cls):
        cls.dossier = tempfile.TemporaryDirectory()
        d = Path(cls.dossier.name)
        cls.ca = certificat(d, "serveur")
        cls.autre_ca = certificat(d, "autre")
        cls.serveur = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Faux)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
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
                         "Description fictive", "cpe:/a", "repository", "Depot", "assetExposureScore"):
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
            "failleLe": "2026-07-14T12:00:00.000Z", "correctifLe": "2026-07-14T12:00:00.000Z", "finSupportLe": None,
            "voirAussi": "https://example.org/advisory", "cves": ["CVE-2026-90001", "CVE-2026-90002"], "cvesTronquees": False})
        self.assertEqual((c2["cves"], c2["finSupportLe"], c2["epss"], c2["vpr"], c2["exploitable"]),
                         ([], "2025-01-01T00:00:00.000Z", None, None, False))
        m = [e for e in el if e["type"] == "machine"]
        self.assertEqual(m[0], {"type": "machine", "cle": "uuid:00000000-0000-4000-8000-0000000000a1",
                                "uuid": "00000000-0000-4000-8000-0000000000a1", "nom": "srv-exemple-01.exemple.invalid",
                                "adresse": "192.0.2.11", "systeme": "Linux Kernel 5.14 on Exemple Linux 9",
                                "premiere": "2026-07-18T01:05:01.000Z", "derniere": "2026-11-16T06:04:48.000Z",
                                "exposition": "internal", "acr": 4.0})
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

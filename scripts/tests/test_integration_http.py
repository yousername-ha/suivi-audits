"""Script isolé des connecteurs (scripts/integration-http.py, ADR 0076 point 5, ADR 0100 point 6) contre un faux service
HTTPS local : seule la version sort de /rest/system, liste fermée des points d'accès, aucune redirection suivie, certificat
toujours vérifié, réponse bornée, erreur sur une ligne sans secret. Données entièrement fictives ; aucun service réel."""
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
        Faux.recues = []
        # Le script n'admet que le port 443 : en test, le faux service écoute sur un port libre, joint sous le nom localhost.
        patcher = patch.object(h, "hote_et_port", return_value=("localhost", self.port))
        patcher.start()
        self.addCleanup(patcher.stop)

    def demande(self, ca=None, **extra):
        p = {
            "type": "tenable",
            "operation": "tester",
            "configuration": {"adresse": "https://localhost", "autoriteCertification": self.ca if ca is None else ca, "delaiSecondes": 5},
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


class Adresse(unittest.TestCase):
    def test_only_a_bare_https_address_on_port_443_is_accepted(self):
        self.assertEqual(h.hote_et_port("https://tenable.exemple.test"), ("tenable.exemple.test", 443))
        self.assertEqual(h.hote_et_port("https://10.0.0.5/"), ("10.0.0.5", 443))
        self.assertEqual(h.hote_et_port("https://tenable.exemple.test:443"), ("tenable.exemple.test", 443))
        for refusee in ("http://tenable.exemple.test", "https://compte:mdp@tenable.exemple.test", "https://tenable.exemple.test/rest",
                        "https://tenable.exemple.test?x=1", "https://tenable.exemple.test#a", "https://tenable.exemple.test:8443",
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
